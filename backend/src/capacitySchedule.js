/**
 * Türkiye fabrika varsayılanı: Pazartesi–Cumartesi, 09:00–17:30, 12:30–13:30 mola.
 * Net günlük: 7,5 saat × 6 gün = 45 kişi-saat / kişi / hafta.
 */
const WORK_DAYS_PER_WEEK = 6;
const NET_HOURS_PER_DAY = 7.5;
const HOURS_PER_PERSON_WEEK = WORK_DAYS_PER_WEEK * NET_HOURS_PER_DAY;

const SCHEDULE_DESCRIPTION =
    'Pazartesi–Cumartesi 09:00–17:30 (Türkiye saati), 12:30–13:30 arası 1 saat mola; haftalık net 45 saat/kişi.';

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayStart(d) {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
}

/** Pazartesi 00:00 UTC takvim günü (tarih seçicileriyle uyumlu). */
function mondayOfUtcWeekContaining(d) {
    const x = utcDayStart(d);
    const dow = x.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    x.setUTCDate(x.getUTCDate() + diff);
    return x;
}

function addDaysUTC(d, n) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
}

/** [rangeFrom, rangeTo) ile kesişen haftaların Pazartesi tarihleri */
function listWeekStartsOverlapping(rangeFrom, rangeTo) {
    const rs = rangeFrom.getTime();
    const re = rangeTo.getTime();
    let mon = mondayOfUtcWeekContaining(rangeFrom);
    const out = [];
    for (let i = 0; i < 120; i++) {
        const ws = mon.getTime();
        const we = ws + 7 * DAY_MS;
        if (ws >= re) break;
        if (we > rs) out.push(new Date(mon));
        mon = addDaysUTC(mon, 7);
    }
    return out;
}

function overlapFractionWeek(weekStart, rangeFrom, rangeTo) {
    const ws = utcDayStart(weekStart).getTime();
    const we = ws + 7 * DAY_MS;
    const lo = Math.max(rangeFrom.getTime(), ws);
    const hi = Math.min(rangeTo.getTime(), we);
    if (hi <= lo) return 0;
    return (hi - lo) / (we - ws);
}

function weekStartToDateKey(d) {
    const x = utcDayStart(d);
    const y = x.getUTCFullYear();
    const m = String(x.getUTCMonth() + 1).padStart(2, '0');
    const day = String(x.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} productType
 * @param {Date} rangeFrom
 * @param {Date} rangeTo exclusive end
 */
async function aggregateCapacityForRange(prisma, productType, rangeFrom, rangeTo) {
    const weeks = listWeekStartsOverlapping(rangeFrom, rangeTo);
    const byStep = {};

    for (const mon of weeks) {
        const frac = overlapFractionWeek(mon, rangeFrom, rangeTo);
        if (frac <= 0) continue;

        const key = weekStartToDateKey(mon);
        const weekDate = new Date(`${key}T12:00:00.000Z`);

        const rows = await prisma.departmentWeekCapacity.findMany({
            where: { productType, weekStart: weekDate }
        });

        for (const r of rows) {
            if (!byStep[r.mainStepKey]) {
                byStep[r.mainStepKey] = {
                    normalHours: 0,
                    overtimeHours: 0,
                    headcountWeighted: 0,
                    weightSum: 0
                };
            }
            byStep[r.mainStepKey].normalHours += frac * r.normalHours;
            byStep[r.mainStepKey].overtimeHours += frac * r.overtimeHours;
            byStep[r.mainStepKey].headcountWeighted += frac * r.headcount;
            byStep[r.mainStepKey].weightSum += frac;
        }
    }

    return byStep;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} productType
 * @param {Date} rangeFrom
 * @param {Date} rangeTo exclusive end
 */
async function aggregateTargetForRange(prisma, productType, rangeFrom, rangeTo) {
    const weeks = listWeekStartsOverlapping(rangeFrom, rangeTo);
    const byStep = {};

    for (const mon of weeks) {
        const frac = overlapFractionWeek(mon, rangeFrom, rangeTo);
        if (frac <= 0) continue;

        const key = weekStartToDateKey(mon);
        const weekDate = new Date(`${key}T12:00:00.000Z`);

        const rows = await prisma.weeklyStepTarget.findMany({
            where: { productType, weekStart: weekDate }
        });

        for (const r of rows) {
            byStep[r.mainStepKey] = (byStep[r.mainStepKey] || 0) + frac * r.targetCount;
        }
    }

    return byStep;
}

module.exports = {
    WORK_DAYS_PER_WEEK,
    NET_HOURS_PER_DAY,
    HOURS_PER_PERSON_WEEK,
    SCHEDULE_DESCRIPTION,
    listWeekStartsOverlapping,
    overlapFractionWeek,
    weekStartToDateKey,
    mondayOfUtcWeekContaining,
    aggregateCapacityForRange,
    aggregateTargetForRange
};
