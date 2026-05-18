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

function exitTimeCoefficient(days) {
    if (days == null || !Number.isFinite(days)) return 1;
    for (const row of lookups.exitTimeCoefficients) {
        if (row.maxDays == null) return row.coefficient;
        if (days < row.maxDays) return row.coefficient;
    }
    return 1;
}

function etkiScoreFromName(etkiAdi) {
    if (!etkiAdi) return null;
    const found = lookups.etkiOptions.find((e) => e.name === etkiAdi);
    return found ? found.score : null;
}

function prioCoefficientFromName(oncelikPrio) {
    if (!oncelikPrio) return 10;
    const found = lookups.prioOptions.find((p) => p.name === oncelikPrio);
    return found ? found.coefficient : 10;
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

module.exports = {
    lookups,
    parseDateOnly,
    calendarDaysBetween,
    exitTimeCoefficient,
    isCustomerSource,
    buildArizaKodu,
    parseOptionalInt,
};
