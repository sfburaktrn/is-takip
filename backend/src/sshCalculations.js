'use strict';

const lookups = require('./sshLookups.json');

function parseDateOnly(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function calendarDaysBetween(start, end) {
    const s = parseDateOnly(start);
    const e = parseDateOnly(end);
    if (!s || !e) return null;
    const s0 = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
    const e0 = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
    return Math.max(0, Math.round((e0 - s0) / 86400000));
}

function exitTimeCoefficient(days, table = lookups.exitTimeCoefficients) {
    if (days == null || !Number.isFinite(days)) return null;
    for (const row of table) {
        if (row.maxDays == null) return row.coefficient;
        if (days < row.maxDays) return row.coefficient;
    }
    return 1;
}

function etkiScoreFromName(etkiAdi) {
    if (!etkiAdi) return null;
    const found = lookups.etkiOptions.find((e) => e.name === String(etkiAdi).trim());
    return found ? found.score : null;
}

function prioCoefficientFromName(oncelikPrio) {
    if (!oncelikPrio) return null;
    const found = lookups.prioOptions.find((p) => p.name === String(oncelikPrio).trim());
    return found ? found.coefficient : null;
}

function isCustomerSource(hataKaynagi) {
    if (!hataKaynagi) return false;
    const upper = String(hataKaynagi).toUpperCase();
    return lookups.customerSourceKeywords.some((kw) => upper.includes(kw));
}

/** Arıza bölgesi 1–3 ve arıza tipi; dolu olanlar "/" ile birleştirilir. */
function buildArizaKodu(bolge1, bolge2, bolge3, arizaTipi) {
    const parts = [bolge1, bolge2, bolge3, arizaTipi]
        .map((p) => (p == null ? '' : String(p).trim()))
        .filter(Boolean);
    return parts.length ? parts.join('/') : null;
}

function parseOptionalInt(raw) {
    if (raw == null || raw === '') return null;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : null;
}

/** Araç çıkış süresi (gün) = şikayet bildirim − garanti başlangıç (takvim günü). */
function calcAracCikisSuresiGun(sikayetBildirimTarihi, garantiBaslangicTarihi) {
    return calendarDaysBetween(garantiBaslangicTarihi, sikayetBildirimTarihi);
}

/** Analiz puanı = öncelik katsayısı × etki katsayısı × tekrar eden hata sayısı */
function calcAnalizPuani(oncelikKatsayisi, etkiKatsayisi, tekrarEdenHataSayisi) {
    const prio = parseOptionalInt(oncelikKatsayisi);
    const etki = parseOptionalInt(etkiKatsayisi);
    if (prio == null || etki == null) return null;
    const tekrar =
        tekrarEdenHataSayisi == null || tekrarEdenHataSayisi === ''
            ? 1
            : parseOptionalInt(tekrarEdenHataSayisi);
    if (tekrar == null || tekrar < 1) return null;
    return prio * etki * tekrar;
}

/** Kritik puan = analiz puanı × çıkış süre katsayısı */
function calcKritikPuan(analizPuani, cikisSureKatsayisi) {
    const analiz = parseOptionalInt(analizPuani);
    const cikis = parseOptionalInt(cikisSureKatsayisi);
    if (analiz == null || cikis == null) return null;
    return analiz * cikis;
}

module.exports = {
    lookups,
    parseDateOnly,
    calendarDaysBetween,
    calcAracCikisSuresiGun,
    calcAnalizPuani,
    calcKritikPuan,
    exitTimeCoefficient,
    etkiScoreFromName,
    prioCoefficientFromName,
    isCustomerSource,
    buildArizaKodu,
    parseOptionalInt,
};
