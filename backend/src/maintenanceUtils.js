const { getBaseCompany } = require('./companyUtils');

const DEFAULT_INTERVAL_DAYS = 365;
const DEFAULT_DUE_SOON_DAYS = 30;

function addDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function computeDueAt(deliveredAt, intervalDays = DEFAULT_INTERVAL_DAYS) {
    const d = deliveredAt instanceof Date ? deliveredAt : new Date(deliveredAt);
    return addDays(d, intervalDays);
}

function computeScheduleStatus({ dueAt, completedAt } = {}, now = new Date(), dueSoonDays = DEFAULT_DUE_SOON_DAYS) {
    if (completedAt) return 'COMPLETED';
    const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    if (dueDay.getTime() < today.getTime()) return 'OVERDUE';
    const soonUntil = addDays(today, dueSoonDays);
    if (dueDay.getTime() <= soonUntil.getTime()) return 'DUE_SOON';
    return 'SCHEDULED';
}

function calcDayDiff(from, to) {
    const a = new Date(from);
    const b = new Date(to);
    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);
    return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function scheduleUiFields(row, now = new Date()) {
    const dueAt = row.dueAt instanceof Date ? row.dueAt : new Date(row.dueAt);
    const completedAt = row.completedAt ? (row.completedAt instanceof Date ? row.completedAt : new Date(row.completedAt)) : null;
    const status = row.status || computeScheduleStatus({ dueAt, completedAt }, now);
    const daysUntilDue = calcDayDiff(now, dueAt);
    const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;
    return {
        ...row,
        status,
        daysUntilDue,
        daysOverdue,
        urgency: status === 'OVERDUE' ? 'overdue' : status === 'DUE_SOON' ? 'soon' : status === 'COMPLETED' ? 'completed' : 'ok',
    };
}

function pickProductSummary(productType, product) {
    if (!product) return null;
    const base = {
        productType,
        productId: product.id,
        imalatNo: product.imalatNo ?? null,
        m3: product.m3 ?? null,
        sasiNo: product.sasiNo ?? null,
        teslimSasiNo: product.teslimSasiNo ?? null,
        teslimAt: product.teslimAt ?? null,
        teslimat: product.teslimat === true,
        musteri: product.musteri ?? null,
    };
    if (productType === 'DAMPER') {
        return {
            ...base,
            tip: product.tip ?? null,
            model: product.model ?? null,
            aracMarka: product.aracMarka ?? null,
        };
    }
    return {
        ...base,
        dingil: product.dingil ?? null,
        lastik: product.lastik ?? null,
        kalinlik: product.kalinlik ?? null,
    };
}

/** Teslim tarihi: teslimAt → StepToggleEvent (teslimat) → ürün updatedAt */
async function resolveDeliveredAt(prisma, productType, product) {
    if (product.teslimAt) {
        return product.teslimAt instanceof Date ? product.teslimAt : new Date(product.teslimAt);
    }
    if (!product.teslimat) return null;

    const toggle = await prisma.stepToggleEvent.findFirst({
        where: {
            productType,
            productId: product.id,
            fieldKey: 'teslimat',
            toValue: true,
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, username: true },
    });
    if (toggle?.createdAt) return toggle.createdAt;

    if (product.updatedAt) {
        return product.updatedAt instanceof Date ? product.updatedAt : new Date(product.updatedAt);
    }
    return null;
}

function mapDeliveryEvents(events) {
    return events.map((e) => ({
        fieldKey: e.fieldKey,
        fromValue: e.fromValue,
        toValue: e.toValue,
        at: e.createdAt,
        username: e.username,
    }));
}

async function getDeliveryLog(prisma, productType, productId) {
    const events = await prisma.stepToggleEvent.findMany({
        where: {
            productType,
            productId,
            fieldKey: { in: ['teslimat', 'teslimEden', 'teslimAlan', 'teslimSasiNo'] },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: {
            fieldKey: true,
            fromValue: true,
            toValue: true,
            createdAt: true,
            username: true,
        },
    });
    return mapDeliveryEvents(events);
}

/** Liste için toplu teslimat logu (N+1 önleme). */
async function getDeliveryLogsBatch(prisma, rows) {
    const map = new Map();
    if (!rows.length) return map;

    const damperIds = [];
    const dorseIds = [];
    for (const r of rows) {
        if (r.productType === 'DORSE') dorseIds.push(r.productId);
        else damperIds.push(r.productId);
    }

    const or = [];
    if (damperIds.length) or.push({ productType: 'DAMPER', productId: { in: damperIds } });
    if (dorseIds.length) or.push({ productType: 'DORSE', productId: { in: dorseIds } });
    if (!or.length) return map;

    const events = await prisma.stepToggleEvent.findMany({
        where: {
            OR: or,
            fieldKey: { in: ['teslimat', 'teslimEden', 'teslimAlan', 'teslimSasiNo'] },
        },
        orderBy: { createdAt: 'asc' },
        select: {
            productType: true,
            productId: true,
            fieldKey: true,
            fromValue: true,
            toValue: true,
            createdAt: true,
            username: true,
        },
    });

    for (const e of events) {
        const key = `${e.productType}:${e.productId}`;
        if (!map.has(key)) map.set(key, []);
        const list = map.get(key);
        if (list.length < 50) list.push(e);
    }
    for (const [key, list] of map) {
        map.set(key, mapDeliveryEvents(list));
    }
    return map;
}

async function upsertScheduleForProduct(prisma, { productType, product, deliveryDateCache }) {
    try {
        if (!product?.teslimat) return { ok: true, skipped: 'not-delivered' };
        let teslimAt = product.teslimAt
            ? product.teslimAt instanceof Date
                ? product.teslimAt
                : new Date(product.teslimAt)
            : null;
        if (!teslimAt && deliveryDateCache) {
            teslimAt = deliveryDateCache.get(product.id) ?? null;
        }
        if (!teslimAt) {
            teslimAt = await resolveDeliveredAt(prisma, productType, product);
        }
        if (!teslimAt) return { ok: true, skipped: 'no-delivery-date' };

        const musteri = product.musteri;
        const normalizedKey = getBaseCompany(musteri);
        if (!normalizedKey) return { ok: true, skipped: 'no-company' };

        const company = await prisma.company.upsert({
            where: { normalizedKey },
            create: { normalizedKey, displayName: String(musteri || '').trim() || normalizedKey },
            update: {},
            select: { id: true },
        });

        const existing = await prisma.maintenanceSchedule.findUnique({
            where: { productType_productId: { productType, productId: product.id } },
            select: { id: true, status: true, completedAt: true },
        });
        if (existing && (existing.status === 'COMPLETED' || existing.completedAt)) {
            return { ok: true, skipped: 'completed' };
        }

        const deliveredAt = teslimAt instanceof Date ? teslimAt : new Date(teslimAt);
        const dueAt = computeDueAt(deliveredAt, DEFAULT_INTERVAL_DAYS);
        const status = computeScheduleStatus({ dueAt, completedAt: null });

        if (!existing) {
            const created = await prisma.maintenanceSchedule.create({
                data: {
                    productType,
                    productId: product.id,
                    companyId: company.id,
                    deliveredAt,
                    dueAt,
                    intervalDays: DEFAULT_INTERVAL_DAYS,
                    status,
                },
                select: { id: true },
            });
            return { ok: true, created: true, id: created.id };
        }

        await prisma.maintenanceSchedule.update({
            where: { id: existing.id },
            data: {
                companyId: company.id,
                deliveredAt,
                dueAt,
                intervalDays: DEFAULT_INTERVAL_DAYS,
                status,
            },
        });
        return { ok: true, updated: true, id: existing.id };
    } catch (e) {
        console.error('[maintenance] upsert schedule failed:', e);
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

/** Tüm damper/dorse müşterilerinden firma rehberi oluşturur (sadece teslim edilmişler değil). */
async function syncAllCompanies(prisma) {
    const [dampers, dorses] = await Promise.all([
        prisma.damper.findMany({ select: { musteri: true }, distinct: ['musteri'] }),
        prisma.dorse.findMany({ select: { musteri: true }, distinct: ['musteri'] }),
    ]);

    const byKey = new Map();
    for (const row of [...dampers, ...dorses]) {
        const key = getBaseCompany(row.musteri);
        if (!key) continue;
        const raw = String(row.musteri || '').trim();
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, { displayName: raw || key, productCount: 1 });
        } else {
            prev.productCount++;
            if (raw.length > prev.displayName.length) prev.displayName = raw;
        }
    }

    const data = [];
    for (const [normalizedKey, meta] of byKey) {
        data.push({ normalizedKey, displayName: meta.displayName });
    }
    if (data.length) {
        await prisma.company.createMany({ data, skipDuplicates: true });
    }
    return { companiesUpserted: data.length, uniqueKeys: byKey.size };
}

async function buildDeliveryDateCache(prisma, productType, productIds) {
    const map = new Map();
    if (!productIds.length) return map;
    const events = await prisma.stepToggleEvent.findMany({
        where: {
            productType,
            productId: { in: productIds },
            fieldKey: 'teslimat',
            toValue: true,
        },
        orderBy: { createdAt: 'asc' },
        select: { productId: true, createdAt: true },
    });
    for (const e of events) {
        if (!map.has(e.productId)) map.set(e.productId, e.createdAt);
    }
    return map;
}

/** Teslim edilmiş tüm ürünler için bakım planı oluşturur / günceller. */
async function syncAllMaintenanceSchedules(prisma) {
    const [dampers, dorses] = await Promise.all([
        prisma.damper.findMany({ where: { teslimat: true } }),
        prisma.dorse.findMany({ where: { teslimat: true } }),
    ]);

    const [damperDeliveryCache, dorseDeliveryCache] = await Promise.all([
        buildDeliveryDateCache(
            prisma,
            'DAMPER',
            dampers.filter((d) => !d.teslimAt).map((d) => d.id)
        ),
        buildDeliveryDateCache(
            prisma,
            'DORSE',
            dorses.filter((d) => !d.teslimAt).map((d) => d.id)
        ),
    ]);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const d of dampers) {
        const r = await upsertScheduleForProduct(prisma, {
            productType: 'DAMPER',
            product: d,
            deliveryDateCache: damperDeliveryCache,
        });
        if (r.created) created++;
        else if (r.updated) updated++;
        else if (r.skipped) skipped++;
        else if (r.ok === false) failed++;
    }
    for (const d of dorses) {
        const r = await upsertScheduleForProduct(prisma, {
            productType: 'DORSE',
            product: d,
            deliveryDateCache: dorseDeliveryCache,
        });
        if (r.created) created++;
        else if (r.updated) updated++;
        else if (r.skipped) skipped++;
        else if (r.ok === false) failed++;
    }

    return {
        scanned: dampers.length + dorses.length,
        created,
        updated,
        skipped,
        failed,
    };
}

async function syncMaintenanceData(prisma) {
    const companies = await syncAllCompanies(prisma);
    const schedules = await syncAllMaintenanceSchedules(prisma);
    return { ok: true, companies, schedules };
}

module.exports = {
    DEFAULT_INTERVAL_DAYS,
    DEFAULT_DUE_SOON_DAYS,
    addDays,
    computeDueAt,
    computeScheduleStatus,
    calcDayDiff,
    scheduleUiFields,
    pickProductSummary,
    resolveDeliveredAt,
    getDeliveryLog,
    getDeliveryLogsBatch,
    upsertScheduleForProduct,
    syncAllCompanies,
    syncAllMaintenanceSchedules,
    syncMaintenanceData,
};
