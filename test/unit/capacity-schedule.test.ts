import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const cs = require(path.join(dir, '../../backend/src/capacitySchedule.js')) as {
  WORK_DAYS_PER_WEEK: number;
  NET_HOURS_PER_DAY: number;
  HOURS_PER_PERSON_WEEK: number;
  SCHEDULE_DESCRIPTION: string;
  mondayOfUtcWeekContaining: (d: Date) => Date;
  weekStartToDateKey: (d: Date) => string;
  listWeekStartsOverlapping: (from: Date, to: Date) => Date[];
  overlapFractionWeek: (weekStart: Date, rangeFrom: Date, rangeTo: Date) => number;
  aggregateCapacityForRange: (
    prisma: { departmentWeekCapacity: { findMany: (args: unknown) => Promise<unknown[]> } },
    productType: string,
    rangeFrom: Date,
    rangeTo: Date
  ) => Promise<Record<string, unknown>>;
  aggregateTargetForRange: (
    prisma: { weeklyStepTarget: { findMany: (args: unknown) => Promise<unknown[]> } },
    productType: string,
    rangeFrom: Date,
    rangeTo: Date
  ) => Promise<Record<string, number>>;
};

describe('capacitySchedule sabitleri', () => {
  it('haftalık çalışma günü ve net saat tutarlı', () => {
    expect(cs.WORK_DAYS_PER_WEEK).toBe(6);
    expect(cs.NET_HOURS_PER_DAY).toBe(7.5);
    expect(cs.HOURS_PER_PERSON_WEEK).toBe(45);
    expect(cs.SCHEDULE_DESCRIPTION).toContain('Pazartesi');
  });
});

describe('mondayOfUtcWeekContaining', () => {
  it('Çarşamba 2025-04-09 UTC günü → Pazartesi 2025-04-07', () => {
    const wed = new Date('2025-04-09T12:00:00.000Z');
    const mon = cs.mondayOfUtcWeekContaining(wed);
    expect(cs.weekStartToDateKey(mon)).toBe('2025-04-07');
  });

  it('Pazar 2025-04-13 → bir önceki Pazartesi 2025-04-07', () => {
    const sun = new Date('2025-04-13T12:00:00.000Z');
    const mon = cs.mondayOfUtcWeekContaining(sun);
    expect(cs.weekStartToDateKey(mon)).toBe('2025-04-07');
  });

  it('Pazartesi aynı haftanın başı', () => {
    const mon = new Date('2025-04-07T00:00:00.000Z');
    const out = cs.mondayOfUtcWeekContaining(mon);
    expect(cs.weekStartToDateKey(out)).toBe('2025-04-07');
  });
});

describe('weekStartToDateKey', () => {
  it('UTC gün başını YYYY-MM-DD üretir', () => {
    const d = new Date('2026-01-05T15:30:00.000Z');
    expect(cs.weekStartToDateKey(d)).toBe('2026-01-05');
  });
});

describe('listWeekStartsOverlapping', () => {
  it('tek hafta içi aralıkta tek Pazartesi', () => {
    const from = new Date('2025-04-08T00:00:00.000Z');
    const to = new Date('2025-04-10T00:00:00.000Z');
    const weeks = cs.listWeekStartsOverlapping(from, to);
    expect(weeks.length).toBe(1);
    expect(cs.weekStartToDateKey(weeks[0])).toBe('2025-04-07');
  });

  it('14 günlük aralıkta iki Pazartesi', () => {
    const from = new Date('2025-04-07T00:00:00.000Z');
    const to = new Date('2025-04-21T00:00:00.000Z');
    const weeks = cs.listWeekStartsOverlapping(from, to);
    const keys = weeks.map((w: Date) => cs.weekStartToDateKey(w));
    expect(keys).toContain('2025-04-07');
    expect(keys).toContain('2025-04-14');
  });

  it('sıfır uzunluklu [from,to) aralığında hafta ile örtüşme kesri 0', () => {
    const from = new Date('2025-04-10T12:00:00.000Z');
    const to = new Date('2025-04-10T12:00:00.000Z');
    const weeks = cs.listWeekStartsOverlapping(from, to);
    expect(weeks.length).toBeGreaterThanOrEqual(0);
    for (const w of weeks) {
      expect(cs.overlapFractionWeek(w, from, to)).toBe(0);
    }
  });
});

describe('overlapFractionWeek', () => {
  it('aralık tüm haftayı kaplıyorsa 1', () => {
    const weekStart = new Date('2025-04-07T00:00:00.000Z');
    const from = new Date('2025-04-07T00:00:00.000Z');
    const to = new Date('2025-04-14T00:00:00.000Z');
    expect(cs.overlapFractionWeek(weekStart, from, to)).toBe(1);
  });

  it('haftanın yarısı [from,to) ise ~0.5', () => {
    const weekStart = new Date('2025-04-07T00:00:00.000Z');
    const from = new Date('2025-04-07T00:00:00.000Z');
    const to = new Date('2025-04-10T12:00:00.000Z');
    const f = cs.overlapFractionWeek(weekStart, from, to);
    expect(f).toBeGreaterThan(0.49);
    expect(f).toBeLessThan(0.51);
  });

  it('kesişim yoksa 0', () => {
    const weekStart = new Date('2025-04-07T00:00:00.000Z');
    const from = new Date('2025-04-21T00:00:00.000Z');
    const to = new Date('2025-04-22T00:00:00.000Z');
    expect(cs.overlapFractionWeek(weekStart, from, to)).toBe(0);
  });
});

describe('aggregateCapacityForRange (mock prisma)', () => {
  it('tek hafta tam kaplama + tek satır → oranlı toplam', async () => {
    const prisma = {
      departmentWeekCapacity: {
        findMany: async () => [
          { mainStepKey: 'montaj', normalHours: 100, overtimeHours: 10, headcount: 5 },
        ],
      },
    };
    const from = new Date('2025-04-07T00:00:00.000Z');
    const to = new Date('2025-04-14T00:00:00.000Z');
    const out = (await cs.aggregateCapacityForRange(prisma, 'DAMPER', from, to)) as Record<
      string,
      { normalHours: number; overtimeHours: number; headcountWeighted: number; weightSum: number }
    >;
    expect(out.montaj.normalHours).toBe(100);
    expect(out.montaj.overtimeHours).toBe(10);
    expect(out.montaj.headcountWeighted).toBe(5);
    expect(out.montaj.weightSum).toBe(1);
    expect(prisma.departmentWeekCapacity.findMany).toBeDefined();
  });

  it('yarım hafta → saatler yarıya iner', async () => {
    const prisma = {
      departmentWeekCapacity: {
        findMany: async () => [{ mainStepKey: 'a', normalHours: 80, overtimeHours: 0, headcount: 4 }],
      },
    };
    const from = new Date('2025-04-07T00:00:00.000Z');
    const to = new Date('2025-04-10T12:00:00.000Z');
    const out = (await cs.aggregateCapacityForRange(prisma, 'DAMPER', from, to)) as Record<
      string,
      { normalHours: number; weightSum: number }
    >;
    expect(out.a.normalHours).toBeCloseTo(40, 0);
    expect(out.a.weightSum).toBeCloseTo(0.5, 1);
  });
});

describe('aggregateTargetForRange (mock prisma)', () => {
  it('hedef adet orantılı toplanır', async () => {
    const prisma = {
      weeklyStepTarget: {
        findMany: async () => [{ mainStepKey: 'montaj', targetCount: 20 }],
      },
    };
    const from = new Date('2025-04-07T00:00:00.000Z');
    const to = new Date('2025-04-14T00:00:00.000Z');
    const out = await cs.aggregateTargetForRange(prisma, 'DAMPER', from, to);
    expect(out.montaj).toBe(20);
  });
});
