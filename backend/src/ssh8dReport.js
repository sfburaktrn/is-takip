'use strict';

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const TEMPLATE_PATH = path.join(__dirname, '..', 'assets', 'ssh-8d-template.xlsx');

function assertTemplateExists() {
    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new Error(
            `8D şablon dosyası bulunamadı: ${TEMPLATE_PATH}. ` +
                'backend/assets/ssh-8d-template.xlsx dosyasının repoda ve Docker imajında olduğundan emin olun.'
        );
    }
}

/** Örnek verileri temizle; başlık satırları ve birleşimler kalır. */
const SAMPLE_CLEAR_RANGES = [
    { r1: 2, c1: 8, r2: 5, c2: 10 }, // H:J doküman meta değerleri
    { r1: 7, c1: 2, r2: 7, c2: 5 },
    { r1: 7, c1: 6, r2: 7, c2: 10 },
    { r1: 9, c1: 2, r2: 9, c2: 10 },
    { r1: 12, c1: 2, r2: 13, c2: 5 },
    { r1: 12, c1: 6, r2: 13, c2: 10 },
    { r1: 16, c1: 3, r2: 20, c2: 4 },
    { r1: 16, c1: 5, r2: 17, c2: 10 },
    { r1: 19, c1: 5, r2: 23, c2: 10 },
    { r1: 26, c1: 2, r2: 28, c2: 10 },
    { r1: 32, c1: 2, r2: 32, c2: 10 },
    { r1: 38, c1: 2, r2: 38, c2: 10 },
    { r1: 44, c1: 2, r2: 44, c2: 10 },
    { r1: 48, c1: 2, r2: 49, c2: 10 },
    { r1: 52, c1: 7, r2: 52, c2: 10 },
];

function toDate(v) {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function clearRange(ws, { r1, c1, r2, c2 }) {
    for (let r = r1; r <= r2; r += 1) {
        for (let c = c1; c <= c2; c += 1) {
            ws.getCell(r, c).value = null;
        }
    }
}

/** Etki % ve Katkı % değer hücreleri — şablondaki örnek sayılar ve yanlış yazımları temizler. */
const PERCENT_VALUE_CLEAR_RANGES = [
    { r1: 12, c1: 6, r2: 13, c2: 7 }, // F12:G13 acil aksiyon etki %
    { r1: 38, c1: 9, r2: 38, c2: 10 }, // I38:J38 D5 etki %
];

/** I39:J40 = Uygulama Tarihi etiketi; yanlışlıkla yazılan tarih/sayı temizlenir. */
function clearMisplacedDateInEtkiBlock(ws) {
    for (const r of [39, 40]) {
        for (const c of [9, 10]) {
            const cell = ws.getCell(r, c);
            const v = cell.value;
            if (v instanceof Date || typeof v === 'number') {
                cell.value = null;
            }
        }
    }
}

function clearPercentValueCells(ws) {
    for (const range of PERCENT_VALUE_CLEAR_RANGES) {
        clearRange(ws, range);
    }
}

/** Paylaşılan örnek Excel’deki doldurulmuş alanları temizler; başlık/birleşim kalır. */
function clearTemplateSampleData(ws) {
    for (const range of SAMPLE_CLEAR_RANGES) {
        clearRange(ws, range);
    }
    clearPercentValueCells(ws);
    clearMisplacedDateInEtkiBlock(ws);
    clearRange(ws, { r1: 8, c1: 6, r2: 8, c2: 10 });
    clearRange(ws, { r1: 26, c1: 9, r2: 26, c2: 10 });
    clearRange(ws, { r1: 41, c1: 9, r2: 42, c2: 10 });
    clearRange(ws, { r1: 52, c1: 2, r2: 52, c2: 6 });
}

async function writeCleanSsh8dTemplate() {
    assertTemplateExists();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_PATH);
    const ws = wb.getWorksheet('8D') || wb.worksheets[0];
    if (!ws) throw new Error('8D şablon sayfası bulunamadı');
    clearTemplateSampleData(ws);
    await wb.xlsx.writeFile(TEMPLATE_PATH);
}

function setCell(ws, address, value) {
    if (value == null || value === '') return;
    ws.getCell(address).value = value;
}

/** "200(DAMPER)" → "DAMPER" */
function bolgeParenLabel(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    const m = s.match(/\(([^)]+)\)/);
    return m ? m[1].trim() : s;
}

/** Parça bilgisi: önce bölge 3 parantez içi, yoksa bölge 2, yoksa bölge 1. */
function partInfo(c) {
    const b3 = bolgeParenLabel(c.arizaBolge3);
    if (b3) return b3;
    const b2 = bolgeParenLabel(c.arizaBolge2);
    if (b2) return b2;
    return bolgeParenLabel(c.arizaBolge1) || '';
}

function konuTitle(c) {
    const aciklama = (c.arizaAciklamasi || '').trim();
    if (aciklama) return aciklama;
    return `SSH ${c.talepNo}`;
}

function parse8dMeta(body) {
    const src = body && typeof body === 'object' ? body : {};
    const dokumanNo = String(src.dokumanNo || '').trim();
    const revizyonNo = String(src.revizyonNo || '').trim();
    if (!dokumanNo) throw new Error('Doküman no zorunludur');
    if (!revizyonNo) throw new Error('Revizyon no zorunludur');

    let revizyonTarihi = toDate(src.revizyonTarihi);
    if (!revizyonTarihi) revizyonTarihi = new Date();

    let ekipLider = null;
    if (src.ekipLider && src.ekipLider.name) {
        ekipLider = {
            name: String(src.ekipLider.name).trim(),
            dept: String(src.ekipLider.dept || '').trim(),
        };
    }

    const ekipUyeleri = (Array.isArray(src.ekipUyeleri) ? src.ekipUyeleri : [])
        .map(m => ({
            name: String(m?.name || '').trim(),
            dept: String(m?.dept || '').trim(),
        }))
        .filter(m => m.name);

    return { dokumanNo, revizyonNo, revizyonTarihi, ekipLider, ekipUyeleri };
}

function fillTeam(ws, meta) {
    const memberRows = [17, 18, 19, 20];
    if (meta.ekipLider?.name) {
        setCell(ws, 'C16', meta.ekipLider.name);
        if (meta.ekipLider.dept) setCell(ws, 'D16', meta.ekipLider.dept);
    }
    meta.ekipUyeleri.slice(0, memberRows.length).forEach((m, i) => {
        const row = memberRows[i];
        setCell(ws, `C${row}`, m.name);
        if (m.dept) setCell(ws, `D${row}`, m.dept);
    });
}

const DOC_META_ROWS = [2, 3, 4, 5];
const DOC_VALUE_COL = 8; // H (H:J birleşik değer alanı)

function safeUnmerge(ws, range) {
    try {
        ws.unMergeCells(range);
    } catch {
        /* zaten birleşik değil */
    }
}

function labelText(ws, row) {
    for (const c of [6, 7]) {
        const v = ws.getCell(row, c).value;
        if (v == null || v === '') continue;
        if (typeof v === 'object' && v.richText) return v.richText.map((t) => t.text).join('');
        return String(v);
    }
    return '';
}

/** Şablon düzeni: etiket F:G, değer H:J (orijinal 8D formu). */
function applyDocumentMetaLayout(ws) {
    const colWidths = { 6: 9.29, 7: 6, 8: 9.29, 9: 6, 10: 14.29 };
    for (const r of DOC_META_ROWS) {
        safeUnmerge(ws, `F${r}:H${r}`);
        safeUnmerge(ws, `I${r}:J${r}`);
        safeUnmerge(ws, `F${r}:G${r}`);
        safeUnmerge(ws, `H${r}:J${r}`);
        const text = labelText(ws, r);
        clearRange(ws, { r1: r, c1: 6, r2: r, c2: 10 });
        ws.mergeCells(`F${r}:G${r}`);
        ws.mergeCells(`H${r}:J${r}`);
        if (text) {
            const label = ws.getCell(r, 6);
            label.value = text;
            label.alignment = { ...(label.alignment || {}), horizontal: 'left', vertical: 'middle' };
        }
    }
    Object.entries(colWidths).forEach(([c, w]) => {
        ws.getColumn(Number(c)).width = w;
    });
}

const BORDER_THIN = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER_MEDIUM = { style: 'medium', color: { argb: 'FF000000' } };

/** clearRange birleşik hücre kenarlıklarını silebiliyor; şablondaki tablo çerçevesini yeniler. */
function applyDocumentMetaBorders(ws) {
    for (const r of DOC_META_ROWS) {
        const first = r === 2;
        ws.getCell(r, 6).border = {
            left: BORDER_MEDIUM,
            top: first ? BORDER_MEDIUM : BORDER_THIN,
            bottom: BORDER_THIN,
        };
        ws.getCell(r, 7).border = {
            right: BORDER_THIN,
            top: first ? BORDER_MEDIUM : BORDER_THIN,
            bottom: BORDER_THIN,
        };
        ws.getCell(r, 8).border = {
            left: BORDER_THIN,
            top: first ? BORDER_MEDIUM : BORDER_THIN,
            bottom: BORDER_THIN,
        };
        ws.getCell(r, 9).border = {
            top: first ? BORDER_MEDIUM : BORDER_THIN,
            bottom: BORDER_THIN,
        };
        ws.getCell(r, 10).border = {
            right: BORDER_MEDIUM,
            top: first ? BORDER_MEDIUM : BORDER_THIN,
            bottom: BORDER_THIN,
        };
    }
}

function fillDocumentMeta(ws, meta) {
    setCell(ws, 'H2', meta.dokumanNo);
    if (meta.revizyonTarihi) {
        const dateCell = ws.getCell('H3');
        dateCell.value = meta.revizyonTarihi;
        dateCell.numFmt = 'd.m.yyyy';
    }
    if (meta.revizyonNo != null && meta.revizyonNo !== '') {
        ws.getCell('H4').value = String(meta.revizyonNo);
    }
    setCell(ws, 'H5', '1/1');
    for (const r of DOC_META_ROWS) {
        const cell = ws.getCell(r, DOC_VALUE_COL);
        cell.alignment = { ...(cell.alignment || {}), horizontal: 'right', vertical: 'middle' };
    }
    applyDocumentMetaBorders(ws);
}

/**
 * @param {object} c mapSshComplaint
 * @param {object} meta parse8dMeta çıktısı
 */
async function buildSsh8dReport(c, meta = {}) {
    assertTemplateExists();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_PATH);
    const ws = wb.getWorksheet('8D') || wb.worksheets[0];
    if (!ws) throw new Error('8D şablon sayfası bulunamadı');

    applyDocumentMetaLayout(ws);
    clearTemplateSampleData(ws);

    const opened = toDate(c.sikayetBildirimTarihi);
    const updated = toDate(c.updatedAt);
    const onarimDt = toDate(c.onarimTarihi);
    const kaliciDt = toDate(c.kaliciOnlemTarihi);

    fillDocumentMeta(ws, meta);
    fillTeam(ws, meta);

    setCell(ws, 'B7', konuTitle(c));
    if (opened) setCell(ws, 'F7', opened);
    if (updated) setCell(ws, 'J7', updated);

    setCell(ws, 'B9', partInfo(c));
    setCell(ws, 'F9', 'Özünlü Damper');

    const d6Text = (c.d6UygulananAksiyon || '').trim();
    // Acil alınan aksiyonlar (üst) = D6 ile aynı metin; etki % (F12–G13) boş
    if (d6Text) setCell(ws, 'B12', d6Text);

    // D2 – E16:J17 kısa ifade; E18 etiket kalır; E19:J23 tam açıklama
    const d2Short = (c.arizaTipi || '').trim() || konuTitle(c).split('\n')[0]?.trim() || '';
    const d2Full = (c.arizaAciklamasi || '').trim();
    setCell(ws, 'E16', d2Short);
    if (d2Full) setCell(ws, 'E19', d2Full);

    setCell(ws, 'B26', (c.onarim || '').trim());
    if (onarimDt) setCell(ws, 'I26', onarimDt);

    setCell(ws, 'B32', (c.kokNeden || '').trim());

    setCell(ws, 'B38', (c.kaliciOnlem || '').trim());
    if (kaliciDt) {
        const dateCell = ws.getCell('I41');
        dateCell.value = kaliciDt;
        dateCell.numFmt = 'd.m.yyyy';
    }

    if (d6Text) setCell(ws, 'B44', d6Text);

    const d7 =
        (c.d7SikayetKapanis || '').trim() ||
        (c.status === 'KAPALI' ? 'Yapılan aksiyonlarla şikayet çözülmüştür.' : '');
    setCell(ws, 'B48', d7);

    if (c.status === 'KAPALI') {
        const closed = kaliciDt || updated;
        if (closed) setCell(ws, 'G52', closed);
    }
    if (c.createdByUsername) setCell(ws, 'I52', c.createdByUsername);

    clearPercentValueCells(ws);
    clearMisplacedDateInEtkiBlock(ws);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
}

function safe8dFilename(talepNo) {
    const base = String(talepNo || 'rapor').replace(/[^\w.-]+/g, '_');
    return `8D_${base}.xlsx`;
}

module.exports = {
    buildSsh8dReport,
    safe8dFilename,
    parse8dMeta,
    writeCleanSsh8dTemplate,
    clearTemplateSampleData,
};
