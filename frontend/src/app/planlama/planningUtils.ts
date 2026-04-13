/** Teklif miktarına göre planlanacak araç (birim) sayısı — üst sınır sabit. */
export const MAX_PLAN_UNITS = 100;

export function planningUnitCount(quantity: number | undefined | null): number {
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) return 1;
    return Math.min(MAX_PLAN_UNITS, Math.max(1, Math.ceil(q)));
}

export type TimelineView = 'week' | 'month';

export function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonthExclusive(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}

/** Haftanın Pazartesi 00:00 (yerel). */
export function mondayOfWeek(d: Date): Date {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
}

export function addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

export function rangeForTimeline(anchor: Date, view: TimelineView): { start: Date; end: Date } {
    if (view === 'week') {
        const start = mondayOfWeek(anchor);
        const end = addDays(start, 7);
        return { start, end };
    }
    const start = startOfMonth(anchor);
    const end = endOfMonthExclusive(anchor);
    return { start, end };
}

/** Gantt çubuğu: görünür aralıkta sol% ve genişlik%. */
export function segmentBarPercent(
    rangeStart: Date,
    rangeEnd: Date,
    segStart: Date,
    segEnd: Date
): { left: number; width: number } | null {
    const t0 = rangeStart.getTime();
    const t1 = rangeEnd.getTime();
    if (t1 <= t0) return null;
    const a = segStart.getTime();
    const b = segEnd.getTime();
    const lo = Math.max(t0, a);
    const hi = Math.min(t1, b);
    if (hi <= lo) return null;
    const left = ((lo - t0) / (t1 - t0)) * 100;
    const width = ((hi - lo) / (t1 - t0)) * 100;
    return { left, width: Math.max(width, 0.4) };
}

const MONTH_NAMES_TR = [
    'Oca',
    'Şub',
    'Mar',
    'Nis',
    'May',
    'Haz',
    'Tem',
    'Ağu',
    'Eyl',
    'Eki',
    'Kas',
    'Ara',
];

export function monthTitleTr(d: Date): string {
    return `${MONTH_NAMES_TR[d.getMonth()]} ${d.getFullYear()}`;
}

export type MonthCell = { date: Date; inMonth: boolean; isToday: boolean };

/** 6 satır × 7 sütun ay ızgarası (Pazartesi başlangıç). */
export function buildMonthGrid(year: number, month: number, today: Date): MonthCell[] {
    const first = new Date(year, month, 1);
    const dow = first.getDay();
    const mondayOffset = dow === 0 ? 6 : dow - 1;
    const cells: MonthCell[] = [];
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    for (let i = 0; i < 42; i++) {
        const d = new Date(year, month, 1 - mondayOffset + i);
        const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        cells.push({
            date: d,
            inMonth: d.getMonth() === month,
            isToday: d0 === t0,
        });
    }
    return cells;
}

/** Bölüm anahtarına göre çubuk rengi (ileride tema ile genişletilebilir). */
export function stepBarGradient(mainStepKey: string, index: number): string {
    const palette = [
        'linear-gradient(90deg,#6366f1,#4f46e5)',
        'linear-gradient(90deg,#0ea5e9,#0284c7)',
        'linear-gradient(90deg,#14b8a6,#0d9488)',
        'linear-gradient(90deg,#a855f7,#7c3aed)',
        'linear-gradient(90deg,#f97316,#ea580c)',
        'linear-gradient(90deg,#ec4899,#db2777)',
        'linear-gradient(90deg,#22c55e,#16a34a)',
    ];
    const keys = [
        'kesimBukum',
        'sasiBitis',
        'onHazirlik',
        'montaj',
        'hidrolik',
        'boyaBitis',
        'tamamlamaBitis',
        'boya',
        'tamamlama',
    ];
    const i = keys.indexOf(mainStepKey);
    return palette[i >= 0 ? i % palette.length : index % palette.length];
}
