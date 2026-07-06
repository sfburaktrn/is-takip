'use strict';

const fs = require('fs');
const path = require('path');
const { Prisma } = require('@prisma/client');
const {
    lookups,
    buildArizaKodu,
    calcAracCikisSuresiGun,
    exitTimeCoefficient,
    parseDateOnly,
    prioCoefficientFromName,
    etkiScoreFromName,
    calcAnalizPuani,
    calcKritikPuan,
} = require('./sshCalculations');
const { normalizeMaliyetDetay, calcMaliyetTotals, hasMaliyetActivity, roundMoney } = require('./sshCost');
const partCodes = require('./sshPartCodes.json');
const { buildSsh8dReport, safe8dFilename, parse8dMeta } = require('./ssh8dReport');

const SSH_8D_EKIP_FILE = path.join(__dirname, '..', 'data', 'ssh8dEkipDirectory.json');

const SSH_MAX_PHOTOS = 8;
const SSH_MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const SSH_ALLOWED_PHOTO_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const sshPhotosInclude = {
    photos: { orderBy: { displayOrder: 'asc' } },
};

function mapSshPhotos(photos) {
    return (photos || []).map(p => ({
        id: p.id,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
        originalFileName: p.originalFileName,
        displayOrder: p.displayOrder,
        createdAt: p.createdAt?.toISOString?.() ?? p.createdAt,
    }));
}

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
        tedarikciAdi: row.tedarikciAdi,
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
        maliyetDetay: row.maliyetDetay ?? null,
        toplamTutar: mapDecimal(row.toplamTutar),
        onaylananTutar: mapDecimal(row.onaylananTutar),
        faturaTarihi: row.faturaTarihi?.toISOString?.() ?? row.faturaTarihi ?? null,
        onarim: row.onarim,
        onarimTarihi: row.onarimTarihi?.toISOString?.() ?? row.onarimTarihi ?? null,
        kokNeden: row.kokNeden,
        kaliciOnlem: row.kaliciOnlem,
        kaliciOnlemTarihi: row.kaliciOnlemTarihi?.toISOString?.() ?? row.kaliciOnlemTarihi ?? null,
        d6UygulananAksiyon: row.d6UygulananAksiyon,
        d7SikayetKapanis: row.d7SikayetKapanis,
        status: row.status,
        createdByUsername: row.createdByUsername,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
        updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
        photos: mapSshPhotos(row.photos),
    };
}

async function loadSshComplaintWithPhotos(prisma, id) {
    return prisma.sshComplaint.findUnique({
        where: { id },
        include: sshPhotosInclude,
    });
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

    if (!partial || has('talepNo')) {
        set('talepNo', String(body.talepNo || '').trim() || null);
    }
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
    if (!partial || has('tedarikciAdi')) set('tedarikciAdi', String(body.tedarikciAdi || '').trim() || null);
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
    setOptionalIntField(set, body, 'cikisSureKatsayisi', 'Çıkış süre katsayısı', { partial, has });
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
    if (!partial || has('maliyetDetay')) {
        set('maliyetDetay', body.maliyetDetay != null ? normalizeMaliyetDetay(body.maliyetDetay) : null);
    }
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
    if (!partial || has('d6UygulananAksiyon')) {
        set('d6UygulananAksiyon', String(body.d6UygulananAksiyon || '').trim() || null);
    }
    if (!partial || has('d7SikayetKapanis')) {
        set('d7SikayetKapanis', String(body.d7SikayetKapanis || '').trim() || null);
    }
    if (!partial || has('status')) set('status', normalizeStatus(body.status));

    return out;
}

function normHataKaynak(v) {
    return String(v || '')
        .trim()
        .toUpperCase()
        .replace(/İ/g, 'I');
}

function isTedarikciKaynak(v) {
    const s = normHataKaynak(v);
    return s === 'TEDARIKCI' || s.includes('TEDARIK');
}

function validateRequiredForCreate(payload) {
    const required = ['talepNo', 'talepTipi', 'sikayetBildirimTarihi', 'garantiBaslangicTarihi', 'musteriAdi', 'ustYapiTipi'];
    for (const k of required) {
        if (payload[k] == null || payload[k] === '') {
            if (k === 'talepNo') throw new Error('Talep no zorunludur');
            throw new Error(`${k} zorunludur`);
        }
    }
    validateTedarikciAdi(payload);
}

function validateTedarikciAdi(payload) {
    if (!isTedarikciKaynak(payload.hataKaynagi)) return;
    if (!String(payload.tedarikciAdi || '').trim()) {
        throw new Error('Hata kaynağı Tedarikçi seçildiğinde tedarikçi adı zorunludur');
    }
}

function mergeComputed(data) {
    const aracCikisSuresiGun = calcAracCikisSuresiGun(data.sikayetBildirimTarihi, data.garantiBaslangicTarihi);
    const hasManualPrioCoef =
        data.oncelikKatsayisi != null &&
        data.oncelikKatsayisi !== '' &&
        Number.isFinite(Number(data.oncelikKatsayisi));
    const hasManualEtkiCoef =
        data.etkiKatsayisi != null &&
        data.etkiKatsayisi !== '' &&
        Number.isFinite(Number(data.etkiKatsayisi));
    const oncelikKatsayisi = hasManualPrioCoef
        ? parseInt(String(data.oncelikKatsayisi), 10)
        : prioCoefficientFromName(data.oncelikPrio);
    const etkiKatsayisi = hasManualEtkiCoef
        ? parseInt(String(data.etkiKatsayisi), 10)
        : etkiScoreFromName(data.etkiAdi);
    const cikisSureKatsayisi = exitTimeCoefficient(aracCikisSuresiGun);
    const tekrarForCalc =
        data.tekrarEdenHataSayisi != null && Number.isFinite(Number(data.tekrarEdenHataSayisi))
            ? parseInt(String(data.tekrarEdenHataSayisi), 10)
            : 1;
    const analizPuani = calcAnalizPuani(oncelikKatsayisi, etkiKatsayisi, tekrarForCalc);
    const kritikPuan = calcKritikPuan(analizPuani, cikisSureKatsayisi);

    const maliyetDetay = data.maliyetDetay != null ? normalizeMaliyetDetay(data.maliyetDetay) : null;
    let toplamTutar = data.toplamTutar;
    if (maliyetDetay && hasMaliyetActivity(maliyetDetay)) {
        toplamTutar = calcMaliyetTotals(maliyetDetay).toplamTutar;
    } else if (toplamTutar != null && Number.isFinite(Number(toplamTutar))) {
        toplamTutar = roundMoney(Number(toplamTutar));
    }

    const tedarikciAdi = isTedarikciKaynak(data.hataKaynagi)
        ? String(data.tedarikciAdi || '').trim() || null
        : null;

    return {
        ...data,
        tedarikciAdi,
        arizaKodu: buildArizaKodu(data.arizaBolge1, data.arizaBolge2, data.arizaBolge3, data.arizaTipi),
        aracCikisSuresiGun,
        cikisSureKatsayisi,
        oncelikKatsayisi,
        etkiKatsayisi,
        analizPuani,
        kritikPuan,
        maliyetDetay,
        toplamTutar,
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

function readSsh8dEkipDirectory() {
    try {
        const raw = fs.readFileSync(SSH_8D_EKIP_FILE, 'utf8');
        const data = JSON.parse(raw);
        const people = (Array.isArray(data.people) ? data.people : [])
            .map(p => ({
                name: String(p?.name || '').trim(),
                dept: String(p?.dept || '').trim(),
            }))
            .filter(p => p.name);
        const departmanlar = (Array.isArray(data.departmanlar) ? data.departmanlar : [])
            .map(d => String(d || '').trim())
            .filter(Boolean);
        return { people, departmanlar };
    } catch {
        return { people: [], departmanlar: [] };
    }
}

function writeSsh8dEkipDirectory(payload) {
    const people = (Array.isArray(payload.people) ? payload.people : [])
        .map(p => ({
            name: String(p?.name || '').trim(),
            dept: String(p?.dept || '').trim(),
        }))
        .filter(p => p.name);
    const departmanlar = (Array.isArray(payload.departmanlar) ? payload.departmanlar : [])
        .map(d => String(d || '').trim())
        .filter(Boolean);
    fs.mkdirSync(path.dirname(SSH_8D_EKIP_FILE), { recursive: true });
    fs.writeFileSync(SSH_8D_EKIP_FILE, JSON.stringify({ people, departmanlar }, null, 2), 'utf8');
    return { people, departmanlar };
}

function registerSshRoutes(app, prisma, requireAuth) {
    app.get('/api/ssh/lookups', requireAuth, (_req, res) => {
        res.json(lookups);
    });

    app.get('/api/ssh/8d-ekip-directory', requireAuth, (_req, res) => {
        res.json(readSsh8dEkipDirectory());
    });

    app.put('/api/ssh/8d-ekip-directory', requireAuth, (req, res) => {
        try {
            const saved = writeSsh8dEkipDirectory(req.body || {});
            res.json(saved);
        } catch (error) {
            console.error('SSH 8d ekip directory save error:', error);
            res.status(500).json({ error: 'Ekip listesi kaydedilemedi' });
        }
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
                    tedarikciAdi: true,
                    kritikPuan: true,
                    onaylananTutar: true,
                    toplamTutar: true,
                    talepNo: true,
                    musteriAdi: true,
                    aracPlakasi: true,
                    garantiTipi: true,
                    ustYapiTipi: true,
                    oncelikPrio: true,
                    tekrarEdenHataSayisi: true,
                    aracCikisSuresiGun: true,
                    sikayetBildirimTarihi: true,
                },
            });
            const total = rows.length;
            const acik = rows.filter((r) => r.status === 'AÇIK').length;
            const kapali = rows.filter((r) => r.status === 'KAPALI').length;
            const kapamaOrani = total > 0 ? kapali / total : 0;
            let costSum = 0;
            let kritikSum = 0;
            let kritikCount = 0;
            let yuksekKritikCount = 0;
            let tekrarSum = 0;
            let cikisSum = 0;
            let cikisCount = 0;
            for (const r of rows) {
                const amt = r.onaylananTutar != null ? Number(r.onaylananTutar) : r.toplamTutar != null ? Number(r.toplamTutar) : 0;
                costSum += amt;
                if (r.kritikPuan != null && Number.isFinite(r.kritikPuan)) {
                    kritikSum += r.kritikPuan;
                    kritikCount += 1;
                    if (r.kritikPuan >= 50) yuksekKritikCount += 1;
                }
                if (r.tekrarEdenHataSayisi != null && Number.isFinite(r.tekrarEdenHataSayisi)) {
                    tekrarSum += r.tekrarEdenHataSayisi;
                }
                if (r.aracCikisSuresiGun != null && Number.isFinite(r.aracCikisSuresiGun)) {
                    cikisSum += r.aracCikisSuresiGun;
                    cikisCount += 1;
                }
            }
            const aracBasiMaliyet = total > 0 ? costSum / total : 0;
            const ortalamaKritikPuan = kritikCount > 0 ? kritikSum / kritikCount : null;
            const ortalamaTekrarHata = total > 0 ? tekrarSum / total : null;
            const ortalamaCikisSuresiGun = cikisCount > 0 ? cikisSum / cikisCount : null;

            const countBy = (field, limit = 5) => {
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
                    .slice(0, limit);
            };

            const tedarikciRows = rows.filter((r) => isTedarikciKaynak(r.hataKaynagi));
            const tedarikciTotal = tedarikciRows.length;
            const tedarikciMap = new Map();
            for (const r of tedarikciRows) {
                const k = String(r.tedarikciAdi || '').trim() || 'Belirtilmemiş';
                tedarikciMap.set(k, (tedarikciMap.get(k) || 0) + 1);
            }
            const tedarikciDagilimi = [...tedarikciMap.entries()]
                .map(([name, count]) => ({
                    name,
                    count,
                    rate: tedarikciTotal > 0 ? count / tedarikciTotal : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8);

            const monthMap = new Map();
            for (const r of rows) {
                if (!r.sikayetBildirimTarihi) continue;
                const d = new Date(r.sikayetBildirimTarihi);
                if (Number.isNaN(d.getTime())) continue;
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthMap.set(key, (monthMap.get(key) || 0) + 1);
            }
            const aylikTrend = [...monthMap.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-6)
                .map(([month, count]) => ({ month, count }));

            const last5 = await prisma.sshComplaint.findMany({
                orderBy: [{ kritikPuan: 'desc' }, { createdAt: 'desc' }],
                take: 5,
                include: sshPhotosInclude,
            });

            res.json({
                total,
                acik,
                kapali,
                kapamaOrani,
                aracBasiMaliyet,
                toplamMaliyet: costSum,
                ortalamaKritikPuan,
                yuksekKritikCount,
                ortalamaTekrarHata,
                ortalamaCikisSuresiGun,
                arizaTipiDagilimi: countBy('arizaTipi', 6),
                hataKaynagiDagilimi: countBy('hataKaynagi', 6),
                garantiTipiDagilimi: countBy('garantiTipi', 6),
                ustYapiTipiDagilimi: countBy('ustYapiTipi', 6),
                oncelikPrioDagilimi: countBy('oncelikPrio', 6),
                tedarikciDagilimi,
                aylikTrend,
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
                include: sshPhotosInclude,
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
            const row = await loadSshComplaintWithPhotos(prisma, id);
            if (!row) return res.status(404).json({ error: 'Kayıt bulunamadı' });
            res.json(mapSshComplaint(row));
        } catch (error) {
            console.error('SSH get error:', error);
            res.status(500).json({ error: 'Kayıt getirilemedi' });
        }
    });

    app.post('/api/ssh/complaints/:id/8d-report', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz id' });
            const row = await prisma.sshComplaint.findUnique({ where: { id } });
            if (!row) return res.status(404).json({ error: 'Kayıt bulunamadı' });
            const meta = parse8dMeta(req.body);
            const mapped = mapSshComplaint(row);
            const buffer = await buildSsh8dReport(mapped, meta);
            const filename = safe8dFilename(mapped.talepNo);
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(buffer);
        } catch (error) {
            if (error.message && !error.code) {
                return res.status(400).json({ error: error.message });
            }
            console.error('SSH 8D report error:', error);
            const msg =
                error.code === 'ENOENT'
                    ? '8D şablon dosyası bulunamadı'
                    : error.message || '8D raporu oluşturulamadı';
            res.status(500).json({ error: msg });
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
            const talepNo = String(merged.talepNo || '').trim();
            const actor = req.session?.username ?? null;
            const created = await prisma.$transaction(async (tx) => {
                const dup = await tx.sshComplaint.findUnique({
                    where: { talepNo },
                    select: { id: true },
                });
                if (dup) throw new Error('Bu talep numarası zaten kullanılıyor');
                const { talepNo: _drop, ...rest } = merged;
                return tx.sshComplaint.create({
                    data: {
                        ...toPrismaData(rest),
                        talepNo,
                        createdByUsername: actor,
                    },
                });
            });
            const withPhotos = await loadSshComplaintWithPhotos(prisma, created.id);
            res.status(201).json(mapSshComplaint(withPhotos ?? created));
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
                tedarikciAdi: existing.tedarikciAdi,
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
                maliyetDetay: existing.maliyetDetay ?? null,
                toplamTutar: existing.toplamTutar != null ? Number(existing.toplamTutar) : null,
                onaylananTutar: existing.onaylananTutar != null ? Number(existing.onaylananTutar) : null,
                faturaTarihi: existing.faturaTarihi,
                onarim: existing.onarim,
                onarimTarihi: existing.onarimTarihi,
                kokNeden: existing.kokNeden,
                kaliciOnlem: existing.kaliciOnlem,
                kaliciOnlemTarihi: existing.kaliciOnlemTarihi,
                d6UygulananAksiyon: existing.d6UygulananAksiyon,
                d7SikayetKapanis: existing.d7SikayetKapanis,
                status: existing.status,
                ...patch,
            };
            const merged = mergeComputed(base);
            validateTedarikciAdi(merged);
            await prisma.sshComplaint.update({
                where: { id },
                data: toPrismaData(merged),
            });
            const updated = await loadSshComplaintWithPhotos(prisma, id);
            res.json(mapSshComplaint(updated));
        } catch (error) {
            if (error.message && !error.code) {
                return res.status(400).json({ error: error.message });
            }
            console.error('SSH update error:', error);
            res.status(500).json({ error: 'SSH kaydı güncellenemedi' });
        }
    });

    app.get('/api/ssh/complaints/:id/photos/:photoId', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const photoId = parseInt(req.params.photoId, 10);
            if (!Number.isFinite(id) || !Number.isFinite(photoId)) {
                return res.status(400).json({ error: 'Geçersiz id' });
            }
            const photo = await prisma.sshComplaintPhoto.findUnique({ where: { id: photoId } });
            if (!photo || photo.sshComplaintId !== id) {
                return res.status(404).json({ error: 'Fotoğraf bulunamadı' });
            }
            res.setHeader('Content-Type', photo.mimeType);
            res.setHeader('Cache-Control', 'private, max-age=3600');
            res.send(Buffer.from(photo.data));
        } catch (error) {
            console.error('SSH photo get error:', error);
            res.status(500).json({ error: 'Fotoğraf getirilemedi' });
        }
    });

    app.post('/api/ssh/complaints/:id/photos', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz id' });
            const mimeType = String(req.body?.mimeType || '').trim().toLowerCase();
            const dataBase64 = String(req.body?.dataBase64 || '').trim();
            const originalFileName = String(req.body?.originalFileName || '').trim() || null;

            if (!SSH_ALLOWED_PHOTO_MIME.has(mimeType)) {
                return res.status(400).json({ error: 'Desteklenmeyen görsel tipi (JPEG, PNG, WebP)' });
            }
            if (!dataBase64) return res.status(400).json({ error: 'Görsel verisi eksik' });
            const dataBuffer = Buffer.from(dataBase64, 'base64');
            if (!dataBuffer.length) return res.status(400).json({ error: 'Görsel çözümlenemedi' });
            if (dataBuffer.length > SSH_MAX_PHOTO_BYTES) {
                return res.status(400).json({ error: 'Görsel boyutu limiti aşıyor (max 4MB)' });
            }

            const existing = await prisma.sshComplaint.findUnique({
                where: { id },
                include: sshPhotosInclude,
            });
            if (!existing) return res.status(404).json({ error: 'Kayıt bulunamadı' });
            if (existing.photos.length >= SSH_MAX_PHOTOS) {
                return res.status(400).json({ error: `En fazla ${SSH_MAX_PHOTOS} fotoğraf eklenebilir` });
            }

            await prisma.sshComplaintPhoto.create({
                data: {
                    sshComplaintId: id,
                    mimeType,
                    data: dataBuffer,
                    sizeBytes: dataBuffer.length,
                    originalFileName,
                    displayOrder: existing.photos.length,
                },
            });

            const updated = await loadSshComplaintWithPhotos(prisma, id);
            res.status(201).json(mapSshComplaint(updated));
        } catch (error) {
            console.error('SSH photo add error:', error);
            res.status(500).json({ error: 'Fotoğraf eklenemedi' });
        }
    });

    app.delete('/api/ssh/complaints/:id/photos/:photoId', requireAuth, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const photoId = parseInt(req.params.photoId, 10);
            if (!Number.isFinite(id) || !Number.isFinite(photoId)) {
                return res.status(400).json({ error: 'Geçersiz id' });
            }
            const photo = await prisma.sshComplaintPhoto.findUnique({ where: { id: photoId } });
            if (!photo || photo.sshComplaintId !== id) {
                return res.status(404).json({ error: 'Fotoğraf bulunamadı' });
            }

            await prisma.$transaction(async tx => {
                await tx.sshComplaintPhoto.delete({ where: { id: photoId } });
                const rest = await tx.sshComplaintPhoto.findMany({
                    where: { sshComplaintId: id },
                    orderBy: { displayOrder: 'asc' },
                });
                for (let i = 0; i < rest.length; i += 1) {
                    if (rest[i].displayOrder !== i) {
                        await tx.sshComplaintPhoto.update({
                            where: { id: rest[i].id },
                            data: { displayOrder: i },
                        });
                    }
                }
            });

            const updated = await loadSshComplaintWithPhotos(prisma, id);
            res.json(mapSshComplaint(updated));
        } catch (error) {
            console.error('SSH photo delete error:', error);
            res.status(500).json({ error: 'Fotoğraf silinemedi' });
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
