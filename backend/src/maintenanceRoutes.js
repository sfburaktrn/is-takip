const {
    DEFAULT_DUE_SOON_DAYS,
    addDays,
    calcDayDiff,
    computeScheduleStatus,
    scheduleUiFields,
    pickProductSummary,
    getDeliveryLog,
    getDeliveryLogsBatch,
    upsertScheduleForProduct,
    syncMaintenanceData,
    syncAllCompanies,
} = require('./maintenanceUtils');

let maintenanceNotifySyncInFlight = false;
let maintenanceNotifySyncLastRunAt = 0;
const MAINTENANCE_NOTIFY_COOLDOWN_MS = 10_000;

const REMINDER_STATUSES = ['PENDING', 'ACKNOWLEDGED', 'CONTACTED', 'SERVICED'];

/**
 * Firma bazlı "etkin" hatırlatma durumu.
 * Kullanıcı bir firmayı işaretledikten (reminderHandledAt) sonra, o tarihten
 * SONRA bakım vadesine giren (DUE_SOON/OVERDUE olan) yeni bir kayıt çıkarsa
 * durum otomatik olarak PENDING'e döner (yeni hatırlatma).
 */
function effectiveReminderStatus(company, schedules, now, dueSoonDays = DEFAULT_DUE_SOON_DAYS) {
    const stored = REMINDER_STATUSES.includes(company.reminderStatus) ? company.reminderStatus : 'PENDING';
    const handledAt = company.reminderHandledAt ? new Date(company.reminderHandledAt) : null;
    const dueSoonMs = dueSoonDays * 24 * 60 * 60 * 1000;

    let latestAlertOnset = null;
    for (const s of schedules) {
        const status = computeScheduleStatus(s, now, dueSoonDays);
        if (status !== 'DUE_SOON' && status !== 'OVERDUE') continue;
        const onset = new Date(new Date(s.dueAt).getTime() - dueSoonMs);
        if (latestAlertOnset == null || onset > latestAlertOnset) latestAlertOnset = onset;
    }

    if (latestAlertOnset != null && (handledAt == null || latestAlertOnset > handledAt)) {
        return 'PENDING';
    }
    return stored;
}

const PRODUCT_SELECT_DAMPER = {
    id: true,
    imalatNo: true,
    m3: true,
    sasiNo: true,
    teslimSasiNo: true,
    teslimAt: true,
    teslimat: true,
    musteri: true,
    tip: true,
    model: true,
    aracMarka: true,
    teslimEden: true,
    teslimAlan: true,
    updatedAt: true,
};

const PRODUCT_SELECT_DORSE = {
    id: true,
    imalatNo: true,
    m3: true,
    sasiNo: true,
    teslimSasiNo: true,
    teslimAt: true,
    teslimat: true,
    musteri: true,
    dingil: true,
    lastik: true,
    kalinlik: true,
    teslimEden: true,
    teslimAlan: true,
    updatedAt: true,
};

async function loadProductsMap(prisma, rows) {
    const damperIds = [];
    const dorseIds = [];
    for (const r of rows) {
        if (r.productType === 'DORSE') dorseIds.push(r.productId);
        else damperIds.push(r.productId);
    }
    const [dampers, dorses] = await Promise.all([
        damperIds.length
            ? prisma.damper.findMany({ where: { id: { in: damperIds } }, select: PRODUCT_SELECT_DAMPER })
            : Promise.resolve([]),
        dorseIds.length
            ? prisma.dorse.findMany({ where: { id: { in: dorseIds } }, select: PRODUCT_SELECT_DORSE })
            : Promise.resolve([]),
    ]);
    return {
        damperMap: new Map(dampers.map((d) => [d.id, d])),
        dorseMap: new Map(dorses.map((d) => [d.id, d])),
    };
}

function enrichScheduleRow(row, now, maps, deliveryLogsMap) {
    const ui = scheduleUiFields(row, now);
    const product =
        row.productType === 'DORSE'
            ? maps.dorseMap.get(row.productId)
            : maps.damperMap.get(row.productId);
    const deliveryLog = deliveryLogsMap.get(`${row.productType}:${row.productId}`) || [];
    return {
        ...ui,
        productSummary: pickProductSummary(row.productType, product),
        deliveryLog,
    };
}

async function syncMaintenanceNotificationGaps(prisma, { force = false, dueSoonDays = DEFAULT_DUE_SOON_DAYS } = {}) {
    if (maintenanceNotifySyncInFlight) return { ok: true, skipped: 'in-flight' };
    if (!force && Date.now() - maintenanceNotifySyncLastRunAt < MAINTENANCE_NOTIFY_COOLDOWN_MS) {
        return { ok: true, skipped: 'cooldown' };
    }
    maintenanceNotifySyncInFlight = true;
    try {
        const now = new Date();
        const dueSoonUntil = addDays(now, dueSoonDays);
        const rows = await prisma.maintenanceSchedule.findMany({
            where: {
                status: { in: ['SCHEDULED', 'DUE_SOON', 'OVERDUE'] },
                completedAt: null,
                dueAt: { lte: dueSoonUntil },
            },
            include: { company: { select: { displayName: true } } },
            orderBy: { dueAt: 'asc' },
            take: 300,
        });

        const maps = await loadProductsMap(prisma, rows);
        let created = 0;
        let scanned = 0;
        for (const s of rows) {
            scanned++;
            const status = computeScheduleStatus(s, now, dueSoonDays);
            const daysUntilDue = calcDayDiff(now, s.dueAt);
            const product =
                s.productType === 'DORSE'
                    ? maps.dorseMap.get(s.productId)
                    : maps.damperMap.get(s.productId);
            const imalat = product?.imalatNo != null ? ` #${product.imalatNo}` : '';
            const title =
                status === 'OVERDUE'
                    ? `Bakım gecikti: ${s.company?.displayName || 'Firma'}`
                    : `Bakım hatırlatması: ${s.company?.displayName || 'Firma'}`;
            const body =
                status === 'OVERDUE'
                    ? `${s.productType}${imalat} — bakım ${Math.abs(daysUntilDue)} gün gecikti. Vade: ${new Date(s.dueAt).toLocaleDateString('tr-TR')}`
                    : `${s.productType}${imalat} — bakıma ${daysUntilDue} gün kaldı. Vade: ${new Date(s.dueAt).toLocaleDateString('tr-TR')}`;

            const dup = await prisma.notification.findFirst({
                where: {
                    kind: 'MAINTENANCE_DUE',
                    productType: 'MAINTENANCE',
                    productId: s.id,
                },
                select: { id: true },
            });
            if (dup) continue;

            await prisma.notification.create({
                data: {
                    kind: 'MAINTENANCE_DUE',
                    productType: 'MAINTENANCE',
                    productId: s.id,
                    title,
                    body,
                    actorUserId: null,
                },
            });
            created++;

            await prisma.maintenanceSchedule.update({
                where: { id: s.id },
                data: { status, lastNotifiedAt: now },
            });
        }

        maintenanceNotifySyncLastRunAt = Date.now();
        return { ok: true, scanned, created };
    } catch (e) {
        console.error('[maintenance] notify sync failed:', e);
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
    } finally {
        maintenanceNotifySyncInFlight = false;
    }
}

function registerMaintenanceRoutes(app, prisma, requireAuth) {
    app.get('/api/bakim/stats', requireAuth, async (_req, res) => {
        try {
            const now = new Date();
            const rows = await prisma.maintenanceSchedule.findMany({
                where: { status: { not: 'CANCELLED' } },
                select: { status: true, dueAt: true, completedAt: true, productType: true },
            });
            let total = 0;
            let dueSoon = 0;
            let overdue = 0;
            let completed = 0;
            let damper = 0;
            let dorse = 0;
            for (const r of rows) {
                total++;
                if (r.productType === 'DAMPER') damper++;
                if (r.productType === 'DORSE') dorse++;
                const status = computeScheduleStatus(r, now);
                if (status === 'DUE_SOON') dueSoon++;
                else if (status === 'OVERDUE') overdue++;
                else if (status === 'COMPLETED') completed++;
            }
            res.json({ total, dueSoon, overdue, completed, byType: { DAMPER: damper, DORSE: dorse } });
        } catch (e) {
            console.error('[maintenance] stats error:', e);
            res.status(500).json({ error: 'Bakım istatistikleri alınamadı' });
        }
    });

    app.get('/api/bakim/companies', requireAuth, async (_req, res) => {
        try {
            await syncAllCompanies(prisma);
            const rows = await prisma.company.findMany({
                orderBy: { displayName: 'asc' },
                include: {
                    maintenanceSchedules: {
                        select: { id: true, status: true, dueAt: true, completedAt: true, productType: true },
                        where: { status: { not: 'CANCELLED' } },
                    },
                    reminderHandledByUser: { select: { id: true, fullName: true, username: true } },
                },
            });
            const now = new Date();
            const out = rows.map((c) => {
                let dueSoon = 0;
                let overdue = 0;
                let active = 0;
                let damperCount = 0;
                let dorseCount = 0;
                for (const s of c.maintenanceSchedules) {
                    const status = computeScheduleStatus(s, now);
                    if (s.productType === 'DAMPER') damperCount++;
                    if (s.productType === 'DORSE') dorseCount++;
                    if (status === 'COMPLETED') continue;
                    active++;
                    if (status === 'DUE_SOON') dueSoon++;
                    if (status === 'OVERDUE') overdue++;
                }
                const effectiveStatus = effectiveReminderStatus(c, c.maintenanceSchedules, now);
                return {
                    id: c.id,
                    normalizedKey: c.normalizedKey,
                    displayName: c.displayName,
                    email: c.email,
                    phone: c.phone,
                    phone2: c.phone2,
                    notes: c.notes,
                    reminderStatus: effectiveStatus,
                    storedReminderStatus: c.reminderStatus || 'PENDING',
                    reminderNote: c.reminderNote || null,
                    reminderHandledAt: c.reminderHandledAt,
                    reminderHandledBy: c.reminderHandledByUser
                        ? { id: c.reminderHandledByUser.id, name: c.reminderHandledByUser.fullName || c.reminderHandledByUser.username }
                        : null,
                    needsAttention: dueSoon > 0 || overdue > 0,
                    counts: { active, dueSoon, overdue, damper: damperCount, dorse: dorseCount },
                };
            });
            res.json(out);
        } catch (e) {
            console.error('[maintenance] companies error:', e);
            res.status(500).json({ error: 'Firmalar alınamadı' });
        }
    });

    app.get('/api/bakim/companies/:id', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const c = await prisma.company.findUnique({
                where: { id },
                include: {
                    maintenanceSchedules: {
                        orderBy: { dueAt: 'asc' },
                    },
                    reminderHandledByUser: { select: { id: true, fullName: true, username: true } },
                },
            });
            if (!c) return res.status(404).json({ error: 'Firma bulunamadı' });
            const now = new Date();
            const maps = await loadProductsMap(prisma, c.maintenanceSchedules);
            const deliveryLogsMap = await getDeliveryLogsBatch(prisma, c.maintenanceSchedules);
            const schedules = c.maintenanceSchedules.map((s) => enrichScheduleRow(s, now, maps, deliveryLogsMap));
            const effectiveStatus = effectiveReminderStatus(c, c.maintenanceSchedules, now);
            res.json({
                ...c,
                reminderStatus: effectiveStatus,
                storedReminderStatus: c.reminderStatus || 'PENDING',
                reminderHandledBy: c.reminderHandledByUser
                    ? { id: c.reminderHandledByUser.id, name: c.reminderHandledByUser.fullName || c.reminderHandledByUser.username }
                    : null,
                maintenanceSchedules: schedules,
            });
        } catch (e) {
            console.error('[maintenance] company detail error:', e);
            res.status(500).json({ error: 'Firma detayı alınamadı' });
        }
    });

    app.put('/api/bakim/companies/:id', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const patch = req.body || {};
            const updated = await prisma.company.update({
                where: { id },
                data: {
                    displayName: typeof patch.displayName === 'string' ? patch.displayName.trim() : undefined,
                    email: typeof patch.email === 'string' ? patch.email.trim() : patch.email === null ? null : undefined,
                    phone: typeof patch.phone === 'string' ? patch.phone.trim() : patch.phone === null ? null : undefined,
                    phone2: typeof patch.phone2 === 'string' ? patch.phone2.trim() : patch.phone2 === null ? null : undefined,
                    notes: typeof patch.notes === 'string' ? patch.notes : patch.notes === null ? null : undefined,
                },
            });
            res.json(updated);
        } catch (e) {
            console.error('[maintenance] company update error:', e);
            res.status(500).json({ error: 'Firma güncellenemedi' });
        }
    });

    app.get('/api/bakim/schedules', requireAuth, async (req, res) => {
        try {
            const { productType, status, companyId, q, sort } = req.query;
            const companyIdNum = companyId ? parseInt(String(companyId), 10) : null;
            if (companyId != null && !Number.isFinite(companyIdNum)) {
                return res.status(400).json({ error: 'Geçersiz companyId' });
            }
            const where = {
                status: status ? String(status) : undefined,
                productType: productType ? String(productType) : undefined,
                companyId: companyIdNum ?? undefined,
            };
            if (q && String(q).trim()) {
                const raw = String(q).trim();
                where.OR = [
                    { company: { displayName: { contains: raw, mode: 'insensitive' } } },
                    { company: { normalizedKey: { contains: raw, mode: 'insensitive' } } },
                ];
            }
            const orderBy = sort === 'createdAt' ? { createdAt: 'desc' } : { dueAt: 'asc' };
            const rows = await prisma.maintenanceSchedule.findMany({
                where,
                include: { company: { select: { id: true, displayName: true, normalizedKey: true } } },
                orderBy,
                take: 1000,
            });
            const now = new Date();
            const maps = await loadProductsMap(prisma, rows);
            const deliveryLogsMap = await getDeliveryLogsBatch(prisma, rows);
            const out = rows.map((r) => enrichScheduleRow(r, now, maps, deliveryLogsMap));
            res.json(out);
        } catch (e) {
            console.error('[maintenance] schedules error:', e);
            res.status(500).json({ error: 'Bakım listesi alınamadı' });
        }
    });

    app.get('/api/bakim/schedules/:id', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const s = await prisma.maintenanceSchedule.findUnique({
                where: { id },
                include: { company: true },
            });
            if (!s) return res.status(404).json({ error: 'Bakım kaydı bulunamadı' });
            const maps = await loadProductsMap(prisma, [s]);
            const deliveryLogsMap = await getDeliveryLogsBatch(prisma, [s]);
            const enriched = enrichScheduleRow(s, new Date(), maps, deliveryLogsMap);
            const product =
                s.productType === 'DORSE'
                    ? maps.dorseMap.get(s.productId)
                    : maps.damperMap.get(s.productId);
            res.json({ ...enriched, product });
        } catch (e) {
            console.error('[maintenance] schedule detail error:', e);
            res.status(500).json({ error: 'Bakım detayı alınamadı' });
        }
    });

    app.patch('/api/bakim/schedules/:id/complete', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const note = typeof req.body?.note === 'string' ? req.body.note : null;
            const updated = await prisma.maintenanceSchedule.update({
                where: { id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    completedByUserId: req.session.userId ?? null,
                    completionNote: note,
                },
            });
            res.json(scheduleUiFields(updated, new Date()));
        } catch (e) {
            console.error('[maintenance] complete error:', e);
            res.status(500).json({ error: 'Bakım tamamlanamadı' });
        }
    });

    app.patch('/api/bakim/companies/:id/reminder', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const status = String(req.body?.status || '').toUpperCase();
            if (!REMINDER_STATUSES.includes(status)) {
                return res.status(400).json({ error: 'Geçersiz durum' });
            }
            const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
            const updated = await prisma.company.update({
                where: { id },
                data: {
                    reminderStatus: status,
                    reminderHandledAt: new Date(),
                    reminderHandledByUserId: req.session.userId ?? null,
                    reminderNote: note === undefined ? undefined : note || null,
                },
                include: { reminderHandledByUser: { select: { id: true, fullName: true, username: true } } },
            });
            res.json({
                id: updated.id,
                reminderStatus: updated.reminderStatus,
                reminderNote: updated.reminderNote || null,
                reminderHandledAt: updated.reminderHandledAt,
                reminderHandledBy: updated.reminderHandledByUser
                    ? { id: updated.reminderHandledByUser.id, name: updated.reminderHandledByUser.fullName || updated.reminderHandledByUser.username }
                    : null,
            });
        } catch (e) {
            console.error('[maintenance] reminder update error:', e);
            res.status(500).json({ error: 'Hatırlatma durumu güncellenemedi' });
        }
    });

    app.post('/api/bakim/companies/:id/complete-all', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const note = typeof req.body?.note === 'string' ? req.body.note : null;
            const now = new Date();
            const result = await prisma.maintenanceSchedule.updateMany({
                where: { companyId: id, completedAt: null, status: { not: 'CANCELLED' } },
                data: {
                    status: 'COMPLETED',
                    completedAt: now,
                    completedByUserId: req.session.userId ?? null,
                    completionNote: note,
                },
            });
            await prisma.company.update({
                where: { id },
                data: {
                    reminderStatus: 'SERVICED',
                    reminderHandledAt: now,
                    reminderHandledByUserId: req.session.userId ?? null,
                },
            });
            res.json({ ok: true, completed: result.count });
        } catch (e) {
            console.error('[maintenance] complete-all error:', e);
            res.status(500).json({ error: 'Firma bakımları tamamlanamadı' });
        }
    });

    app.post('/api/bakim/sync', requireAuth, async (req, res) => {
        const force = req.query.force === '1' || req.query.force === 'true';
        const rebuild = req.query.rebuild === '1' || req.query.rebuild === 'true';
        let data = {};
        if (rebuild) {
            data = await syncMaintenanceData(prisma);
        }
        const notify = await syncMaintenanceNotificationGaps(prisma, { force });
        res.json({ ...data, notify });
    });

    app.post('/api/bakim/rebuild', requireAuth, async (_req, res) => {
        try {
            const data = await syncMaintenanceData(prisma);
            const notify = await syncMaintenanceNotificationGaps(prisma, { force: true });
            res.json({ ...data, notify });
        } catch (e) {
            console.error('[maintenance] rebuild error:', e);
            res.status(500).json({ error: 'Bakım verisi yenilenemedi' });
        }
    });
}

module.exports = {
    registerMaintenanceRoutes,
    syncMaintenanceNotificationGaps,
    upsertScheduleForProduct,
    syncMaintenanceData,
};
