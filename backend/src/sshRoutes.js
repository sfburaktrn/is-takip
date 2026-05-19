'use strict';

const { Prisma } = require('@prisma/client');
const { lookups, buildArizaKodu, parseDateOnly } = require('./sshCalculations');
const partCodes = require('./sshPartCodes.json');

function mapDecimal(v) {
    if (v == null) return null;
    return Number(v);
}

function mapSshComplaint(row) {
    if (!row) return null;
    return {
        id: row.id,
        talepNo: row.talepNo,
        talepTipi: row.talepTipi,
        sikayetBildirimTarihi: row.sikayetBildirimTarihi?.toISOString?.() ?? row.sikayetBildirimTarihi,
        garantiBaslangicTarihi: row.garantiBaslangicTarihi?.toISOString?.() ?? row.garantiBaslangicTarihi,
        musteriAdi: row.musteriAdi,
        ilgiliKisi: row.ilgiliKisi,
        ilgiliKisiTel: row.ilgiliKisiTel,
        ustYapiTipi: row.ustYapiTipi,
        sasiMarka: row.sasiMarka,
        sasiModel: row.sasiModel,
        aracPlakasi: row.aracPlakasi,
        sasiNo: row.sasiNo,
        imalatNo: row.imalatNo,
        arizaBolge1: row.arizaBolge1,
        arizaBolge2: row.arizaBolge2,
        arizaBolge3: row.arizaBolge3,
        arizaTipi: row.arizaTipi,
        arizaKodu: row.arizaKodu,
        hataKaynagi: row.hataKaynagi,
        arizaAciklamasi: row.arizaAciklamasi,
        tekrarEdenHataSayisi: row.tekrarEdenHataSayisi,
        aracCikisSuresiGun: row.aracCikisSuresiGun,
        cikisSureKatsayisi: row.cikisSureKatsayisi,
        oncelikPrio: row.oncelikPrio,
        oncelikKatsayisi: row.oncelikKatsayisi,
        etkiAdi: row.etkiAdi,
        etkiKatsayisi: row.etkiKatsayisi,
        analizPuani: row.analizPuani,
        kritikPuan: row.kritikPuan,
        fabrikaGarantiKarari: row.fabrikaGarantiKarari,
        garantiTipi: row.garantiTipi,
        toplamTutar: mapDecimal(row.toplamTutar),
        onaylananTutar: mapDecimal(row.onaylananTutar),
        faturaTarihi: row.faturaTarihi?.toISOString?.() ?? row.faturaTarihi ?? null,
        onarim: row.onarim,
        onarimTarihi: row.onarimTarihi?.toISOString?.() ?? row.onarimTarihi ?? null,
        kokNeden: row.kokNeden,
        kaliciOnlem: row.kaliciOnlem,
        kaliciOnlemTarihi: row.kaliciOnlemTarihi?.toISOString?.() ?? row.kaliciOnlemTarihi ?? null,
        status: row.status,
        createdByUsername: row.createdByUsername,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
        updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    };
}

function parseOptionalDate(raw) {
    if (raw == null || raw === '' || raw === '-') return null;
    const d = parseDateOnly(raw);
    return d;
}

function parseRequiredDate(raw, label) {
    const d = parseOptionalDate(raw);
    if (!d) throw new Error(`${label} geçerli bir tarih olmalıdır`);
    return d;
}

function setOptionalIntField(set, body, key, label, { partial, has }) {
    if (partial && !has(key)) return;
    const v = body[key];
    if (v == null || v === '') {
        set(key, null);
        return;
    }
    const n = parseInt(String(v), 10);
    if (!Number.isFinite(n)) throw new Error(`${label} geçersiz`);
    set(key, n);
}

function parseSshPayload(body, { partial = false } = {}) {
    const out = {};
    const set = (key, val) => {
        out[key] = val;
    };
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    if (!partial || has('talepTipi')) set('talepTipi', String(body.talepTipi || '').trim() || null);
    if (!partial || has('sikayetBildirimTarihi')) {
        set('sikayetBildirimTarihi', parseRequiredDate(body.sikayetBildirimTarihi, 'Şikayet bildirim tarihi'));
    }
    if (!partial || has('garantiBaslangicTarihi')) {
        set('garantiBaslangicTarihi', parseRequiredDate(body.garantiBaslangicTarihi, 'Garanti başlangıç tarihi'));
    }
    if (!partial || has('musteriAdi')) set('musteriAdi', String(body.musteriAdi || '').trim() || null);
    if (!partial || has('ilgiliKisi')) set('ilgiliKisi', String(body.ilgiliKisi || '').trim() || null);
    if (!partial || has('ilgiliKisiTel')) set('ilgiliKisiTel', String(body.ilgiliKisiTel || '').trim() || null);
    if (!partial || has('ustYapiTipi')) set('ustYapiTipi', String(body.ustYapiTipi || '').trim() || null);
    if (!partial || has('sasiMarka')) set('sasiMarka', String(body.sasiMarka || '').trim() || null);
    if (!partial || has('sasiModel')) set('sasiModel', String(body.sasiModel || '').trim() || null);
    if (!partial || has('aracPlakasi')) set('aracPlakasi', String(body.aracPlakasi || '').trim() || null);
    if (!partial || has('sasiNo')) set('sasiNo', String(body.sasiNo || '').trim() || null);
    if (!partial || has('imalatNo')) set('imalatNo', String(body.imalatNo || '').trim() || null);
    if (!partial || has('arizaBolge1')) set('arizaBolge1', String(body.arizaBolge1 || '').trim() || null);
    if (!partial || has('arizaBolge2')) set('arizaBolge2', String(body.arizaBolge2 || '').trim() || null);
    if (!partial || has('arizaBolge3')) set('arizaBolge3', String(body.arizaBolge3 || '').trim() || null);
    if (!partial || has('arizaTipi')) set('arizaTipi', String(body.arizaTipi || '').trim() || null);
    if (!partial || has('hataKaynagi')) set('hataKaynagi', String(body.hataKaynagi || '').trim() || null);
    if (!partial || has('arizaAciklamasi')) set('arizaAciklamasi', String(body.arizaAciklamasi || '').trim() || null);
    if (!partial || has('tekrarEdenHataSayisi')) {
        const v = body.tekrarEdenHataSayisi;
        if (v == null || v === '') {
            if (!partial) set('tekrarEdenHataSayisi', 1);
        } else {
            const t = parseInt(String(v), 10);
            if (!Number.isFinite(t)) throw new Error('Tekrar eden hata sayısı geçersiz');
            set('tekrarEdenHataSayisi', t);
        }
    }
    if (!partial || has('oncelikPrio')) set('oncelikPrio', String(body.oncelikPrio || '').trim() || null);
    setOptionalIntField(set, body, 'aracCikisSuresiGun', 'Araç çıkış süresi (gün)', { partial, has });
    setOptionalIntField(set, body, 'cikisSureKatsayisi', 'Çıkış süre katsayısı', { partial, has });
    setOptionalIntField(set, body, 'analizPuani', 'Analiz puanı', { partial, has });
    setOptionalIntField(set, body, 'kritikPuan', 'Kritik puan', { partial, has });
    if (!partial || has('etkiAdi')) set('etkiAdi', String(body.etkiAdi || '').trim() || null);
    if (!partial || has('oncelikKatsayisi')) {
        const v = body.oncelikKatsayisi;
        if (v == null || v === '') set('oncelikKatsayisi', null);
        else {
            const n = parseInt(String(v), 10);
            if (!Number.isFinite(n)) throw new Error('Öncelik katsayısı geçersiz');
            set('oncelikKatsayisi', n);
        }
    }
    if (!partial || has('etkiKatsayisi')) {
        const v = body.etkiKatsayisi;
        if (v == null || v === '') set('etkiKatsayisi', null);
        else {
            const n = parseInt(String(v), 10);
            if (!Number.isFinite(n)) throw new Error('Etki katsayısı geçersiz');
            set('etkiKatsayisi', n);
        }
    }
    if (!partial || has('fabrikaGarantiKarari')) {
        set('fabrikaGarantiKarari', String(body.fabrikaGarantiKarari || '').trim() || null);
    }
    if (!partial || has('garantiTipi')) set('garantiTipi', String(body.garantiTipi || '').trim() || null);
    if (!partial || has('toplamTutar')) {
        const v = body.toplamTutar;
        if (v == null || v === '') set('toplamTutar', null);
        else {
            const n = Number(v);
            if (!Number.isFinite(n)) throw new Error('Toplam tutar geçersiz');
            set('toplamTutar', n);
        }
    }
    if (!partial || has('onaylananTutar')) {
        const v = body.onaylananTutar;
        if (v == null || v === '') set('onaylananTutar', null);
        else {
            const n = Number(v);
            if (!Number.isFinite(n)) throw new Error('Onaylanan tutar geçersiz');
            set('onaylananTutar', n);
        }
    }
    if (!partial || has('faturaTarihi')) set('faturaTarihi', parseOptionalDate(body.faturaTarihi));
    if (!partial || has('onarim')) set('onarim', String(body.onarim || '').trim() || null);
    if (!partial || has('onarimTarihi')) set('onarimTarihi', parseOptionalDate(body.onarimTarihi));
    if (!partial || has('kokNeden')) set('kokNeden', String(body.kokNeden || '').trim() || null);
    if (!partial || has('kaliciOnlem')) set('kaliciOnlem', String(body.kaliciOnlem || '').trim() || null);
    if (!partial || has('kaliciOnlemTarihi')) set('kaliciOnlemTarihi', parseOptionalDate(body.kaliciOnlemTarihi));
    if (!partial || has('status')) set('status', normalizeStatus(body.status));

    return out;
}

function validateRequiredForCreate(payload) {
    const required = ['talepTipi', 'sikayetBildirimTarihi', 'garantiBaslangicTarihi', 'musteriAdi', 'ustYapiTipi'];
    for (const k of required) {
        if (payload[k] == null || payload[k] === '') {
            throw new Error(`${k} zorunludur`);
        }
    }
}

function mergeComputed(data) {
    return {
        ...data,
        arizaKodu: buildArizaKodu(data.arizaBolge1, data.arizaBolge2, data.arizaBolge3, data.arizaTipi),
    };
}

function toPrismaData(payload) {
    const d = { ...payload };
    if (d.toplamTutar != null) d.toplamTutar = new Prisma.Decimal(d.toplamTutar);
    if (d.onaylananTutar != null) d.onaylananTutar = new Prisma.Decimal(d.onaylananTutar);
    return d;
}

function normalizeStatus(raw) {
    const s = String(raw || 'AÇIK')
        .trim()
        .toUpperCase()
        .replace(/İ/g, 'I');
    if (s === 'KAPALI' || s.startsWith('KAPAL')) return 'KAPALI';
    return 'AÇIK';
}

/** Yıl + 4 hane; silinen kayıtların numarası tekrar kullanılır (en küçük boş sıra). */
async function allocateTalepNo(prisma, txClient = null) {
    const run = async (tx) => {
        const year = new Date().getFullYear();
        const prefix = String(year);
        const rows = await tx.sshComplaint.findMany({
            where: { talepNo: { startsWith: prefix } },
            select: { talepNo: true },
        });
        const used = new Set();
        for (const r of rows) {
            const n = parseInt(String(r.talepNo).slice(prefix.length), 10);
            if (Number.isFinite(n) && n > 0) used.add(n);
        }
        let seq = 1;
        while (used.has(seq)) seq += 1;
        const talepNo = `${prefix}${String(seq).padStart(4, '0')}`;
        const maxUsed = used.size > 0 ? Math.max(...used) : 0;
        await tx.sshTalepNoSequence.upsert({
            where: { year },
            create: { year, lastNumber: Math.max(seq, maxUsed) },
            update: { lastNumber: Math.max(seq, maxUsed) },
        });
        return talepNo;
    };
    if (txClient) return run(txClient);
    return prisma.$transaction(run);
}

function registerSshRoutes(app, prisma, requireAuth) {
    app.get('/api/ssh/lookups', requireAuth, (_req, res) => {
        res.json(lookups);
    });

    app.get('/api/ssh/part-codes', requireAuth, (_req, res) => {
        res.json({
            ...partCodes,
            arizaTipleri: lookups.arizaTipleri,
        });
    });

    app.get('/api/ssh/next-talep-no', requireAuth, async (_req, res) => {
        try {
            const talepNo = await allocateTalepNo(prisma);
            res.json({ talepNo });
        } catch (error) {
            console.error('SSH next talep no error:', error);
            res.status(500).json({ error: 'Talep numarası üretilemedi' });
        }
    });

    app.get('/api/ssh/stats', requireAuth, async (_req, res) => {
        try {
            const rows = await prisma.sshComplaint.findMany({
                select: {
                    status: true,
                    arizaTipi: true,
                    hataKaynagi: true,
                    kritikPuan: true,
                    onaylananTutar: true,
                    toplamTutar: true,
                    talepNo: true,
                    musteriAdi: true,
                    aracPlakasi: true,
                    garantiTipi: true,
                },
            });
            const total = rows.length;
            const acik = rows.filter((r) => r.status === 'AÇIK').length;
            const kapali = rows.filter((r) => r.status === 'KAPALI').length;
            let costSum = 0;
            for (const r of rows) {
                const amt = r.onaylananTutar != null ? Number(r.onaylananTutar) : r.toplamTutar != null ? Number(r.toplamTutar) : 0;
                costSum += amt;
            }
            const aracBasiMaliyet = total > 0 ? costSum / total : 0;

            const countBy = (field) => {
                const m = new Map();
                for (const r of rows) {
                    const k = r[field] || 'Belirtilmemiş';
                    m.set(k, (m.get(k) || 0) + 1);
                }
                return [...m.entries()]
                    .map(([name, count]) => ({
                        name,
                        count,
                        rate: total > 0 ? count / total : 0,
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);
            };

            const last5 = await prisma.sshComplaint.findMany({
                orderBy: [{ kritikPuan: 'desc' }, { createdAt: 'desc' }],
                take: 5,
            });

            res.json({
                total,
                acik,
                kapali,
                aracBasiMaliyet,
                arizaTipiDagilimi: countBy('arizaTipi'),
                hataKaynagiDagilimi: countBy('hataKaynagi'),
                son5: last5.map(mapSshComplaint),
            });
        } catch (error) {
            console.error('SSH stats error:', error);
            const hint =
                error.code === 'P2021' || String(error.message).includes('does not exist')
                    ? ' npx prisma migrate deploy'
                    : '';
            res.status(500).json({ error: `SSH istatistikleri alınamadı${hint}` });
        }
    });

    app.get('/api/ssh/complaints', requireAuth, async (req, res) => {
        try {
            const status = cleanQuery(req.query.status);
            const q = cleanQuery(req.query.q);
            const where = {};
            if (status && status !== 'ALL') where.status = status;
            if (q) {
                where.OR = [
                    { talepNo: { contains: q, mode: 'insensitive' } },
                    { musteriAdi: { contains: q, mode: 'insensitive' } },
                    { aracPlakasi: { contains: q, mode: 'insensitive' } },
                ];
            }
            const rows = await prisma.sshComplaint.findMany({
                where,
                orderBy: [{ kritikPuan: 'desc' }, { createdAt: 'desc' }],
            });
            res.json(rows.map(mapSshComplaint));
        } catch (error) {
            console.error('SSH list error:', error);
            res.status(500).json({ error: 'SSH kayıtları getirilemedi' });
        }
    });

    app.get('/api/ssh/complaints/:id', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz id' });
            const row = await prisma.sshComplaint.findUnique({ where: { id } });
            if (!row) return res.status(404).json({ error: 'Kayıt bulunamadı' });
            res.json(mapSshComplaint(row));
        } catch (error) {
            console.error('SSH get error:', error);
            res.status(500).json({ error: 'Kayıt getirilemedi' });
        }
    });

    app.post('/api/ssh/complaints', requireAuth, async (req, res) => {
        try {
            const payload = parseSshPayload(req.body);
            validateRequiredForCreate(payload);
            const merged = mergeComputed({
                ...payload,
                status: normalizeStatus(payload.status),
            });
            const actor = req.session?.username ?? null;
            const created = await prisma.$transaction(async (tx) => {
                const talepNo = await allocateTalepNo(prisma, tx);
                return tx.sshComplaint.create({
                    data: {
                        ...toPrismaData(merged),
                        talepNo,
                        createdByUsername: actor,
                    },
                });
            });
            res.status(201).json(mapSshComplaint(created));
        } catch (error) {
            if (error.message && !error.code) {
                return res.status(400).json({ error: error.message });
            }
            console.error('SSH create error:', error);
            res.status(500).json({ error: 'SSH kaydı oluşturulamadı' });
        }
    });

    app.put('/api/ssh/complaints/:id', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz id' });
            const existing = await prisma.sshComplaint.findUnique({ where: { id } });
            if (!existing) return res.status(404).json({ error: 'Kayıt bulunamadı' });

            const patch = parseSshPayload(req.body, { partial: true });
            const base = {
                talepTipi: existing.talepTipi,
                sikayetBildirimTarihi: existing.sikayetBildirimTarihi,
                garantiBaslangicTarihi: existing.garantiBaslangicTarihi,
                musteriAdi: existing.musteriAdi,
                ilgiliKisi: existing.ilgiliKisi,
                ilgiliKisiTel: existing.ilgiliKisiTel,
                ustYapiTipi: existing.ustYapiTipi,
                sasiMarka: existing.sasiMarka,
                sasiModel: existing.sasiModel,
                aracPlakasi: existing.aracPlakasi,
                sasiNo: existing.sasiNo,
                imalatNo: existing.imalatNo,
                arizaBolge1: existing.arizaBolge1,
                arizaBolge2: existing.arizaBolge2,
                arizaBolge3: existing.arizaBolge3,
                arizaTipi: existing.arizaTipi,
                hataKaynagi: existing.hataKaynagi,
                arizaAciklamasi: existing.arizaAciklamasi,
                tekrarEdenHataSayisi: existing.tekrarEdenHataSayisi,
                aracCikisSuresiGun: existing.aracCikisSuresiGun,
                cikisSureKatsayisi: existing.cikisSureKatsayisi,
                oncelikPrio: existing.oncelikPrio,
                analizPuani: existing.analizPuani,
                kritikPuan: existing.kritikPuan,
                oncelikKatsayisi: existing.oncelikKatsayisi,
                etkiAdi: existing.etkiAdi,
                etkiKatsayisi: existing.etkiKatsayisi,
                fabrikaGarantiKarari: existing.fabrikaGarantiKarari,
                garantiTipi: existing.garantiTipi,
                toplamTutar: existing.toplamTutar != null ? Number(existing.toplamTutar) : null,
                onaylananTutar: existing.onaylananTutar != null ? Number(existing.onaylananTutar) : null,
                faturaTarihi: existing.faturaTarihi,
                onarim: existing.onarim,
                onarimTarihi: existing.onarimTarihi,
                kokNeden: existing.kokNeden,
                kaliciOnlem: existing.kaliciOnlem,
                kaliciOnlemTarihi: existing.kaliciOnlemTarihi,
                status: existing.status,
                ...patch,
            };
            const merged = mergeComputed(base);
            const updated = await prisma.sshComplaint.update({
                where: { id },
                data: toPrismaData(merged),
            });
            res.json(mapSshComplaint(updated));
        } catch (error) {
            if (error.message && !error.code) {
                return res.status(400).json({ error: error.message });
            }
            console.error('SSH update error:', error);
            res.status(500).json({ error: 'SSH kaydı güncellenemedi' });
        }
    });

    app.delete('/api/ssh/complaints/:id', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz id' });
            await prisma.sshComplaint.delete({ where: { id } });
            res.json({ ok: true });
        } catch (error) {
            if (error.code === 'P2025') return res.status(404).json({ error: 'Kayıt bulunamadı' });
            console.error('SSH delete error:', error);
            res.status(500).json({ error: 'SSH kaydı silinemedi' });
        }
    });
}

function cleanQuery(v) {
    if (v == null) return '';
    return String(v).trim();
}

module.exports = { registerSshRoutes, mapSshComplaint };
