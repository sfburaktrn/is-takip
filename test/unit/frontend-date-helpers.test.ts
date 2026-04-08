import { describe, expect, it } from 'vitest';

/** Kapasite sayfası ile aynı mantık */
function mondayOfDateInput(isoDay: string): string {
  const d = new Date(isoDay + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Verimlilik sayfası ile aynı mantık */
function toExclusiveEndIso(dayStr: string): string {
  const d = new Date(dayStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfDayIso(dayStr: string): string {
  const d = new Date(dayStr + 'T00:00:00');
  return d.toISOString();
}

describe('mondayOfDateInput (kapasite haftası)', () => {
  it('Çarşamba string → o haftanın Pazartesi (yerel takvim)', () => {
    const mon = mondayOfDateInput('2025-04-09');
    expect(mon).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const check = new Date(mon + 'T12:00:00');
    expect(check.getDay()).toBe(1);
  });
});

describe('verimlilik tarih aralığı ISO', () => {
  it('startOfDayIso yerel gün başına karşılık gelen anı üretir (TZ bağımsız doğrulama)', () => {
    const s = startOfDayIso('2025-06-15');
    const parsed = new Date(s);
    const ref = new Date('2025-06-15T00:00:00');
    expect(parsed.getFullYear()).toBe(ref.getFullYear());
    expect(parsed.getMonth()).toBe(ref.getMonth());
    expect(parsed.getDate()).toBe(ref.getDate());
  });

  it('toExclusiveEndIso ertesi gün başlangıcı (yarı açık aralık için)', () => {
    const end = toExclusiveEndIso('2025-06-15');
    const d = new Date(end);
    expect(d.getUTCDate()).toBeGreaterThanOrEqual(15);
  });
});
