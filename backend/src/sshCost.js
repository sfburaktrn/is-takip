'use strict';

function roundMoney(n) {
    return Math.round(n * 100) / 100;
}

function lineTotal(birim, qty) {
    const b = birim == null || birim === '' ? null : Number(birim);
    const q = qty == null || qty === '' ? null : Number(qty);
    if (b == null || q == null || !Number.isFinite(b) || !Number.isFinite(q)) return 0;
    return b * q;
}

function emptyMalzemeRow() {
    return { id: `m-${Date.now()}`, aciklama: '', birimTutar: null, miktar: null };
}

function emptyIscilikRow() {
    return { id: `i-${Date.now()}`, aciklama: '', birimTutar: null, sureSaat: null };
}

function normalizeMaliyetDetay(raw) {
    if (!raw || typeof raw !== 'object') {
        return { karOraniYuzde: 15, malzemeler: [emptyMalzemeRow()], iscilik: [emptyIscilikRow()] };
    }
    const kar = raw.karOraniYuzde;
    const karOraniYuzde =
        kar == null || kar === ''
            ? 15
            : Number.isFinite(Number(kar))
              ? Number(kar)
              : 15;

    const malzemeler = Array.isArray(raw.malzemeler)
        ? raw.malzemeler.map((r, i) => ({
              id: String(r.id ?? `m-${i}`),
              aciklama: String(r.aciklama ?? '').trim(),
              birimTutar:
                  r.birimTutar == null || r.birimTutar === '' ? null : roundMoney(Number(r.birimTutar)),
              miktar: r.miktar == null || r.miktar === '' ? null : Number(r.miktar),
          }))
        : [emptyMalzemeRow()];

    const iscilik = Array.isArray(raw.iscilik)
        ? raw.iscilik.map((r, i) => ({
              id: String(r.id ?? `i-${i}`),
              aciklama: String(r.aciklama ?? '').trim(),
              birimTutar:
                  r.birimTutar == null || r.birimTutar === '' ? null : roundMoney(Number(r.birimTutar)),
              sureSaat: r.sureSaat == null || r.sureSaat === '' ? null : Number(r.sureSaat),
          }))
        : [emptyIscilikRow()];

    return { karOraniYuzde, malzemeler, iscilik };
}

function calcMaliyetTotals(detay) {
    const malzemeToplam = detay.malzemeler.reduce(
        (s, r) => s + lineTotal(r.birimTutar, r.miktar),
        0
    );
    const iscilikToplam = detay.iscilik.reduce((s, r) => s + lineTotal(r.birimTutar, r.sureSaat), 0);
    const araToplam = malzemeToplam + iscilikToplam;
    const kar = detay.karOraniYuzde != null && Number.isFinite(detay.karOraniYuzde) ? detay.karOraniYuzde : 0;
    const toplamTutar = araToplam * (1 + kar / 100);
    return {
        malzemeToplam: roundMoney(malzemeToplam),
        iscilikToplam: roundMoney(iscilikToplam),
        araToplam: roundMoney(araToplam),
        toplamTutar: roundMoney(toplamTutar),
    };
}

function hasMaliyetActivity(detay) {
    const totals = calcMaliyetTotals(detay);
    return totals.araToplam > 0;
}

module.exports = {
    normalizeMaliyetDetay,
    calcMaliyetTotals,
    hasMaliyetActivity,
    roundMoney,
};
