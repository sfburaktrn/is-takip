import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getSshComplaintPhotoUrl, SSH_MAX_PHOTOS, type SshComplaint, type SshComplaintPhoto } from '@/lib/api';
import { calcMaliyetTotals, parseMaliyetDetay } from '@/lib/sshCost';

export type SshExcelStatusFilter = 'ALL' | 'AÇIK' | 'KAPALI';

const NAVY = 'FF022347';
const WHITE = 'FFFFFFFF';
const GRAY_HEADER = 'FFE8ECF1';
const ZEBRA = 'FFF5F7FA';
const OPEN_BG = 'FFFF9F0A';
const OPEN_FG = 'FF1D1D1F';
const CLOSED_BG = 'FF34C759';
const CLOSED_FG = 'FFFFFFFF';
const HIGH_KRITIK_BG = 'FFFEE2E2';
const HIGH_KRITIK_FG = 'FFB91C1C';

const PHOTO_ROW_HEIGHT = 76;
const PHOTO_COL_WIDTH = 12;

/** 1-based column index → Excel column letter (A, B, …, AA). */
function excelColLetter(col1Based: number): string {
    let n = col1Based;
    let s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s || 'A';
}

type ColDef = { header: string; key: string; width: number };

const PHOTO_COLUMNS: ColDef[] = Array.from({ length: SSH_MAX_PHOTOS }, (_, i) => ({
    header: `Foto ${i + 1}`,
    key: `foto${i + 1}`,
    width: PHOTO_COL_WIDTH,
}));

const COLUMNS: ColDef[] = [
    { header: 'Talep No', key: 'talepNo', width: 14 },
    { header: 'Durum', key: 'status', width: 10 },
    { header: 'Talep Tipi', key: 'talepTipi', width: 11 },
    { header: 'Şikayet Bildirim', key: 'sikayetBildirimTarihi', width: 14 },
    { header: 'Garanti Başlangıç', key: 'garantiBaslangicTarihi', width: 14 },
    { header: 'Müşteri', key: 'musteriAdi', width: 22 },
    { header: 'İlgili Kişi', key: 'ilgiliKisi', width: 16 },
    { header: 'Telefon', key: 'ilgiliKisiTel', width: 14 },
    { header: 'Üst Yapı', key: 'ustYapiTipi', width: 12 },
    { header: 'Şasi Marka', key: 'sasiMarka', width: 12 },
    { header: 'Şasi Model', key: 'sasiModel', width: 12 },
    { header: 'Plaka', key: 'aracPlakasi', width: 11 },
    { header: 'Şasi No', key: 'sasiNo', width: 16 },
    { header: 'İmalat No', key: 'imalatNo', width: 10 },
    { header: 'Arıza Bölge 1', key: 'arizaBolge1', width: 14 },
    { header: 'Arıza Bölge 2', key: 'arizaBolge2', width: 14 },
    { header: 'Arıza Bölge 3', key: 'arizaBolge3', width: 14 },
    { header: 'Arıza Tipi', key: 'arizaTipi', width: 14 },
    { header: 'Arıza Kodu', key: 'arizaKodu', width: 14 },
    { header: 'Hata Kaynağı', key: 'hataKaynagi', width: 16 },
    { header: 'Tedarikçi', key: 'tedarikciAdi', width: 18 },
    { header: 'Arıza Açıklaması', key: 'arizaAciklamasi', width: 36 },
    { header: 'Tekrar Eden Hata', key: 'tekrarEdenHataSayisi', width: 12 },
    { header: 'Çıkış Süresi (gün)', key: 'aracCikisSuresiGun', width: 12 },
    { header: 'Çıkış Katsayısı', key: 'cikisSureKatsayisi', width: 12 },
    { header: 'Öncelik', key: 'oncelikPrio', width: 10 },
    { header: 'Öncelik Kats.', key: 'oncelikKatsayisi', width: 11 },
    { header: 'Etki', key: 'etkiAdi', width: 12 },
    { header: 'Etki Kats.', key: 'etkiKatsayisi', width: 10 },
    { header: 'Analiz Puanı', key: 'analizPuani', width: 11 },
    { header: 'Kritik Puan', key: 'kritikPuan', width: 11 },
    { header: 'Fabrika Garanti', key: 'fabrikaGarantiKarari', width: 14 },
    { header: 'Garanti Tipi', key: 'garantiTipi', width: 14 },
    { header: 'Kar %', key: 'karOraniYuzde', width: 8 },
    { header: 'Malzeme Toplam', key: 'malzemeToplam', width: 14 },
    { header: 'İşçilik Toplam', key: 'iscilikToplam', width: 14 },
    { header: 'Toplam Tutar', key: 'toplamTutar', width: 14 },
    { header: 'Onaylanan Tutar', key: 'onaylananTutar', width: 14 },
    { header: 'Malzeme Detay', key: 'malzemeDetay', width: 32 },
    { header: 'İşçilik Detay', key: 'iscilikDetay', width: 32 },
    { header: 'Fatura Tarihi', key: 'faturaTarihi', width: 12 },
    { header: 'Onarım', key: 'onarim', width: 28 },
    { header: 'Onarım Tarihi', key: 'onarimTarihi', width: 12 },
    { header: 'Kök Neden', key: 'kokNeden', width: 28 },
    { header: 'Kalıcı Önlem', key: 'kaliciOnlem', width: 28 },
    { header: 'Önlem Tarihi', key: 'kaliciOnlemTarihi', width: 12 },
    ...PHOTO_COLUMNS,
    { header: 'Oluşturan', key: 'createdByUsername', width: 14 },
    { header: 'Oluşturma', key: 'createdAt', width: 18 },
    { header: 'Güncelleme', key: 'updatedAt', width: 18 },
];

function filterLabel(f: SshExcelStatusFilter): string {
    if (f === 'AÇIK') return 'Açık';
    if (f === 'KAPALI') return 'Kapalı';
    return 'Tümü';
}

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString('tr-TR');
}

function fmtDateTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtNum(v: number | null | undefined): number | string {
    if (v == null || !Number.isFinite(v)) return '';
    return v;
}

function colLetter(n: number): string {
    let s = '';
    let num = n;
    while (num > 0) {
        const rem = (num - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        num = Math.floor((num - 1) / 26);
    }
    return s;
}

function thinBorder(): Partial<ExcelJS.Borders> {
    return {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
}

function malzemeDetayText(c: SshComplaint): string {
    const detay = parseMaliyetDetay(c.maliyetDetay);
    return detay.malzemeler
        .filter(m => m.aciklama?.trim() || m.birimTutar != null || m.miktar != null)
        .map(m => {
            const t = (m.birimTutar ?? 0) * (m.miktar ?? 0);
            return `${m.aciklama || '—'} (${m.miktar ?? 0} × ${m.birimTutar ?? 0} = ${t.toFixed(2)} ₺)`;
        })
        .join(' | ');
}

function iscilikDetayText(c: SshComplaint): string {
    const detay = parseMaliyetDetay(c.maliyetDetay);
    return detay.iscilik
        .filter(r => r.aciklama?.trim() || r.birimTutar != null || r.sureSaat != null)
        .map(r => {
            const t = (r.birimTutar ?? 0) * (r.sureSaat ?? 0);
            return `${r.aciklama || '—'} (${r.sureSaat ?? 0} sa × ${r.birimTutar ?? 0} = ${t.toFixed(2)} ₺)`;
        })
        .join(' | ');
}

function rowPayload(c: SshComplaint): Record<string, string | number> {
    const detay = parseMaliyetDetay(c.maliyetDetay);
    const totals = calcMaliyetTotals(detay);
    return {
        talepNo: c.talepNo,
        status: c.status,
        talepTipi: c.talepTipi ?? '',
        sikayetBildirimTarihi: fmtDate(c.sikayetBildirimTarihi),
        garantiBaslangicTarihi: fmtDate(c.garantiBaslangicTarihi),
        musteriAdi: c.musteriAdi ?? '',
        ilgiliKisi: c.ilgiliKisi ?? '',
        ilgiliKisiTel: c.ilgiliKisiTel ?? '',
        ustYapiTipi: c.ustYapiTipi ?? '',
        sasiMarka: c.sasiMarka ?? '',
        sasiModel: c.sasiModel ?? '',
        aracPlakasi: c.aracPlakasi ?? '',
        sasiNo: c.sasiNo ?? '',
        imalatNo: c.imalatNo != null ? String(c.imalatNo) : '',
        arizaBolge1: c.arizaBolge1 ?? '',
        arizaBolge2: c.arizaBolge2 ?? '',
        arizaBolge3: c.arizaBolge3 ?? '',
        arizaTipi: c.arizaTipi ?? '',
        arizaKodu: c.arizaKodu ?? '',
        hataKaynagi: c.hataKaynagi ?? '',
        tedarikciAdi: c.tedarikciAdi ?? '',
        arizaAciklamasi: c.arizaAciklamasi ?? '',
        tekrarEdenHataSayisi: c.tekrarEdenHataSayisi ?? 0,
        aracCikisSuresiGun: fmtNum(c.aracCikisSuresiGun),
        cikisSureKatsayisi: fmtNum(c.cikisSureKatsayisi),
        oncelikPrio: c.oncelikPrio ?? '',
        oncelikKatsayisi: fmtNum(c.oncelikKatsayisi),
        etkiAdi: c.etkiAdi ?? '',
        etkiKatsayisi: fmtNum(c.etkiKatsayisi),
        analizPuani: fmtNum(c.analizPuani),
        kritikPuan: fmtNum(c.kritikPuan),
        fabrikaGarantiKarari: c.fabrikaGarantiKarari ?? '',
        garantiTipi: c.garantiTipi ?? '',
        karOraniYuzde: fmtNum(detay.karOraniYuzde ?? 15),
        malzemeToplam: totals.malzemeToplam,
        iscilikToplam: totals.iscilikToplam,
        toplamTutar: fmtNum(c.toplamTutar ?? totals.toplamTutar),
        onaylananTutar: fmtNum(c.onaylananTutar),
        malzemeDetay: malzemeDetayText(c),
        iscilikDetay: iscilikDetayText(c),
        faturaTarihi: fmtDate(c.faturaTarihi),
        onarim: c.onarim ?? '',
        onarimTarihi: fmtDate(c.onarimTarihi),
        kokNeden: c.kokNeden ?? '',
        kaliciOnlem: c.kaliciOnlem ?? '',
        kaliciOnlemTarihi: fmtDate(c.kaliciOnlemTarihi),
        ...Object.fromEntries(PHOTO_COLUMNS.map((col, i) => [`foto${i + 1}`, ''])),
        createdByUsername: c.createdByUsername ?? '',
        createdAt: fmtDateTime(c.createdAt),
        updatedAt: fmtDateTime(c.updatedAt),
    };
}

function styleStatusCell(cell: ExcelJS.Cell, status: string) {
    const isOpen = status === 'AÇIK';
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isOpen ? OPEN_BG : CLOSED_BG },
    };
    cell.font = { bold: true, color: { argb: isOpen ? OPEN_FG : CLOSED_FG }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

type ExcelImageExt = 'png' | 'jpeg';

async function blobToExcelImage(
    blob: Blob,
    mimeType: string
): Promise<{ buffer: ArrayBuffer; extension: ExcelImageExt } | null> {
    const mt = (mimeType || blob.type || '').toLowerCase();
    if (mt === 'image/png') {
        return { buffer: await blob.arrayBuffer(), extension: 'png' };
    }
    if (mt === 'image/jpeg' || mt === 'image/jpg') {
        return { buffer: await blob.arrayBuffer(), extension: 'jpeg' };
    }
    try {
        const bitmap = await createImageBitmap(blob);
        const max = 320;
        const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height, 1));
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close?.();
        const pngBlob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(b => resolve(b), 'image/png', 0.9)
        );
        if (!pngBlob) return null;
        return { buffer: await pngBlob.arrayBuffer(), extension: 'png' };
    } catch {
        return null;
    }
}

async function fetchPhotoForExcel(
    complaintId: number,
    photo: SshComplaintPhoto
): Promise<{ buffer: ArrayBuffer; extension: ExcelImageExt } | null> {
    try {
        const res = await fetch(getSshComplaintPhotoUrl(complaintId, photo.id), {
            credentials: 'include',
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        return blobToExcelImage(blob, photo.mimeType || res.headers.get('content-type') || '');
    } catch {
        return null;
    }
}

function styleKritikCell(cell: ExcelJS.Cell, value: number | string) {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (!Number.isFinite(n) || n < 50) return;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HIGH_KRITIK_BG } };
    cell.font = { bold: true, color: { argb: HIGH_KRITIK_FG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

export async function exportSshComplaintsToExcel(
    items: SshComplaint[],
    options: { statusFilter: SshExcelStatusFilter; searchQ?: string }
): Promise<void> {
    if (items.length === 0) {
        throw new Error('Dışa aktarılacak kayıt yok. Filtreyi değiştirin veya yeni kayıt ekleyin.');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Özünal İmalat Takip';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('SSH Şikayet Listesi', {
        views: [{ state: 'frozen', ySplit: 4, xSplit: 2 }],
    });

    const colCount = COLUMNS.length;
    const lastColLetter = colLetter(colCount);

    sheet.columns = COLUMNS.map(c => ({ key: c.key, width: c.width }));

    sheet.mergeCells(`A1:${lastColLetter}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'SSH ŞİKAYET LİSTESİ — ÖZÜNLÜ';
    titleCell.font = { bold: true, size: 16, color: { argb: WHITE } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.mergeCells(`A2:${lastColLetter}2`);
    const metaCell = sheet.getCell('A2');
    metaCell.value = `Filtre: ${filterLabel(options.statusFilter)}  ·  Kayıt: ${items.length}  ·  Tarih: ${new Date().toLocaleString('tr-TR')}`;
    metaCell.font = { size: 11, color: { argb: 'FF334155' } };
    metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_HEADER } };
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 22;

    sheet.getRow(3).height = 6;

    const headerRow = sheet.getRow(4);
    headerRow.height = 28;
    COLUMNS.forEach((col, i) => {
        headerRow.getCell(i + 1).value = col.header;
        const cell = headerRow.getCell(i + 1);
        cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder();
    });

    const statusColIdx = COLUMNS.findIndex(c => c.key === 'status') + 1;
    const kritikColIdx = COLUMNS.findIndex(c => c.key === 'kritikPuan') + 1;
    const photoColStart = COLUMNS.findIndex(c => c.key === 'foto1') + 1;
    const moneyKeys = new Set(['malzemeToplam', 'iscilikToplam', 'toplamTutar', 'onaylananTutar']);
    const photoKeys = new Set(PHOTO_COLUMNS.map(c => c.key));

    for (let idx = 0; idx < items.length; idx += 1) {
        const complaint = items[idx];
        const payload = rowPayload(complaint);
        const row = sheet.addRow(payload);
        const photos = [...(complaint.photos || [])].sort((a, b) => a.displayOrder - b.displayOrder);
        row.height = photos.length > 0 ? PHOTO_ROW_HEIGHT : 22;
        const zebra = idx % 2 === 1;

        COLUMNS.forEach((col, i) => {
            const cell = row.getCell(i + 1);
            cell.border = thinBorder();
            const isPhotoCol = photoKeys.has(col.key);
            cell.alignment = {
                vertical: 'middle',
                wrapText:
                    !isPhotoCol &&
                    (col.key === 'arizaAciklamasi' || col.key.includes('Detay') || col.key === 'onarim'),
                horizontal:
                    isPhotoCol || col.key === 'status' || col.key === 'kritikPuan' || typeof payload[col.key] === 'number'
                        ? 'center'
                        : 'left',
            };
            if (zebra && i + 1 !== statusColIdx) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
            }
            if (isPhotoCol) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
            if (moneyKeys.has(col.key) && typeof cell.value === 'number') {
                cell.numFmt = '#,##0.00" ₺"';
            }
        });

        styleStatusCell(row.getCell(statusColIdx), complaint.status);
        styleKritikCell(row.getCell(kritikColIdx), payload.kritikPuan);

        if (photos.length > 0 && photoColStart > 0) {
            const embeds = await Promise.all(
                photos.slice(0, SSH_MAX_PHOTOS).map(async (photo, slot) => {
                    const img = await fetchPhotoForExcel(complaint.id, photo);
                    return { slot, img };
                })
            );
            for (const { slot, img } of embeds) {
                if (!img) continue;
                const col1 = photoColStart + slot;
                const imageId = workbook.addImage({
                    buffer: img.buffer as ExcelJS.Buffer,
                    extension: img.extension,
                });
                const cellRef = `${excelColLetter(col1)}${row.number}`;
                sheet.addImage(imageId, `${cellRef}:${cellRef}`);
            }
        }
    }

    sheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4 + items.length, column: colCount },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const slug = filterLabel(options.statusFilter).replace(/\s+/g, '_');
    const date = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    saveAs(blob, `SSH_Sikayet_Listesi_${slug}_${date}.xlsx`);
}
