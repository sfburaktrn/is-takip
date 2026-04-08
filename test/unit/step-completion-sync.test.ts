import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const mod = require(path.join(dir, '../../backend/src/stepCompletionSync.js')) as {
  TRACKED_MAIN_STEPS: Record<string, string[]>;
  STEP_LABELS: Record<string, Record<string, string>>;
  syncStepCompletionEvents: (
    prisma: unknown,
    productType: string,
    productId: number,
    before: object | null,
    after: object,
    getStatusForKey: (r: object, key: string) => string
  ) => Promise<void>;
};

describe('stepCompletionSync sabitleri', () => {
  it('DAMPER ana adımları tanımlı ve sonKontrol yok', () => {
    const keys = mod.TRACKED_MAIN_STEPS.DAMPER;
    expect(keys).toContain('montaj');
    expect(keys).not.toContain('sonKontrol');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('DORSE son kontrol grubu yok', () => {
    expect(mod.TRACKED_MAIN_STEPS.DORSE).not.toContain('sonKontrol');
    expect(mod.TRACKED_MAIN_STEPS.DORSE).toContain('tamamlama');
  });

  it('Şasi üç ana grup', () => {
    expect(mod.TRACKED_MAIN_STEPS.SASI).toEqual(['kesimBukum', 'onHazirlik', 'montaj']);
  });

  it('her TRACKED_MAIN_STEPS anahtarı için STEP_LABELS var', () => {
    for (const pt of Object.keys(mod.TRACKED_MAIN_STEPS)) {
      const labels = mod.STEP_LABELS[pt];
      expect(labels, pt).toBeDefined();
      for (const key of mod.TRACKED_MAIN_STEPS[pt]) {
        expect(labels[key], `${pt}.${key}`).toBeTruthy();
      }
    }
  });
});

describe('syncStepCompletionEvents', () => {
  const create = vi.fn();
  const findFirst = vi.fn();
  const del = vi.fn();

  beforeEach(() => {
    create.mockReset();
    findFirst.mockReset();
    del.mockReset();
  });

  const prisma = () =>
    ({
      stepCompletionEvent: {
        create,
        findFirst,
        delete: del,
      },
    }) as const;

  it('productionStartedAt yoksa hiç DB çağrısı yapmaz', async () => {
    await mod.syncStepCompletionEvents(prisma(), 'DAMPER', 1, null, { musteri: 'x' }, () => 'BAŞLAMADI');
    expect(create).not.toHaveBeenCalled();
  });

  it('yeni tamamlanma → create (tek ana adım)', async () => {
    const after = { productionStartedAt: new Date(), x: true };
    const getStatus = (_rec: object | null, key: string) => (key === 'montaj' ? 'TAMAMLANDI' : 'BAŞLAMADI');
    await mod.syncStepCompletionEvents(prisma(), 'DAMPER', 42, null, after, getStatus);
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.data.productType).toBe('DAMPER');
    expect(arg.data.productId).toBe(42);
    expect(arg.data.mainStepKey).toBe('montaj');
  });

  it('before + after ile yeni tamamlanma', async () => {
    const before = { productionStartedAt: new Date() };
    const after = { productionStartedAt: new Date() };
    const getStatus = (rec: object | null, key: string) => {
      if (key !== 'kesimBukum') return 'BAŞLAMADI';
      if (rec === before) return 'BAŞLAMADI';
      return 'TAMAMLANDI';
    };
    await mod.syncStepCompletionEvents(prisma(), 'DORSE', 7, before, after, getStatus);
    expect(create.mock.calls.some((c) => c[0].data.mainStepKey === 'kesimBukum')).toBe(true);
  });

  it('tamamlanmıştan geri alınırsa findFirst + delete', async () => {
    findFirst.mockResolvedValue({ id: 99 });
    const before = { productionStartedAt: new Date() };
    const after = { productionStartedAt: new Date() };
    const getStatus = (rec: object | null, key: string) => {
      if (key !== 'montaj') return 'BAŞLAMADI';
      if (rec === before) return 'TAMAMLANDI';
      return 'BAŞLAMADI';
    };
    await mod.syncStepCompletionEvents(prisma(), 'DAMPER', 1, before, after, getStatus);
    expect(findFirst).toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith({ where: { id: 99 } });
  });

  it('geri almada findFirst null ise delete yok', async () => {
    findFirst.mockResolvedValue(null);
    const before = { productionStartedAt: new Date() };
    const after = { productionStartedAt: new Date() };
    const getStatus = (rec: object | null, key: string) => {
      if (key !== 'montaj') return 'BAŞLAMADI';
      if (rec === before) return 'TAMAMLANDI';
      return 'BAŞLAMADI';
    };
    await mod.syncStepCompletionEvents(prisma(), 'SASI', 2, before, after, getStatus);
    expect(del).not.toHaveBeenCalled();
  });
});
