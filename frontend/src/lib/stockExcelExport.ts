import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { SheetStockItemRow, StockItemRow } from '@/lib/api';

const NAVY = 'FF022347';
const WHITE = 'FFFFFFFF';
const GRAY_HEADER = 'FFE8ECF1';
const ZEBRA = 'FFF5F7FA';

const SAFE_BG = 'FFD1FAE5';
const SAFE_FG = 'FF065F46';
const WARN_BG = 'FFFEF3C7';
const WARN_FG = 'FF92400E';
const CRITICAL_BG = 'FFFEE2E2';
const CRITICAL_FG = 'FFB91C1C';
const UNKNOWN_BG = 'FFF1F5F9';
const UNKNOWN_FG = 'FF475569';

export type StockLevelZone = 'safe' | 'warn' | 'critical';

function parseStockNum(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function stockLevelRatio(qty: string | number | null | undefined, critical: string | number | null | undefined): number | null {
    const q = parseStockNum(qty);
    const c = parseStockNum(critical);
    if (q == null || c == null || c <= 0) return null;
    return q / c;
}

export function stockLevelZone(
    qty: string | number | null | undefined,
    critical: string | number | null | undefined
): StockLevelZone | null {
    const r = stockLevelRatio(qty, critical);
    if (r == null) return null;
    if (r <= 1) return 'critical';
    if (r < 2) return 'warn';
    return 'safe';
}

export function stockLevelLabel(zone: StockLevelZone | null): string {
    if (zone === 'safe') return 'Kritik seviyeden uzakta';
    if (zone === 'warn') return 'Kritik seviyeye yaklaşıyor';
    if (zone === 'critical') return 'Kritik seviyede';
    return 'Kritik seviye tanımsız';
}

function thinBorder(): Partial<ExcelJS.Borders> {
    return {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
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

function formatQty(v: string | number | null | undefined): number | string {
    const n = parseStockNum(v);
    if (n == null) return '';
    return n;
}

type ColDef = { header: string; key: string; width: number };

const PRODUCT_COLUMNS: ColDef[] = [
    { header: 'Grup', key: 'groupName', width: 18 },
    { header: 'Ürün adı', key: 'description', width: 36 },
    { header: 'Satınalma kodu', key: 'purchaseCode', width: 16 },
    { header: 'Birim', key: 'unit', width: 10 },
    { header: 'Güncel stok', key: 'quantity', width: 14 },
    { header: 'Kritik stok', key: 'criticalQuantity', width: 14 },
    { header: 'Durum', key: 'status', width: 28 },
];

const SHEET_COLUMNS: ColDef[] = [
    { header: 'Malzeme', key: 'material', width: 18 },
    { header: 'Kalınlık (mm)', key: 'thickness', width: 14 },
    { header: 'En (mm)', key: 'width', width: 12 },
    { header: 'Boy (mm)', key: 'length', width: 12 },
    { header: 'Güncel stok', key: 'quantity', width: 14 },
    { header: 'Kritik stok', key: 'criticalQuantity', width: 14 },
    { header: 'Durum', key: 'status', width: 28 },
];

function zoneColors(zone: StockLevelZone | null): { bg: string; fg: string } {
    if (zone === 'critical') return { bg: CRITICAL_BG, fg: CRITICAL_FG };
    if (zone === 'warn') return { bg: WARN_BG, fg: WARN_FG };
    if (zone === 'safe') return { bg: SAFE_BG, fg: SAFE_FG };
    return { bg: UNKNOWN_BG, fg: UNKNOWN_FG };
}

function countZones(zones: Array<StockLevelZone | null>) {
    let critical = 0;
    let warn = 0;
    let safe = 0;
    let unknown = 0;
    for (const z of zones) {
        if (z === 'critical') critical += 1;
        else if (z === 'warn') warn += 1;
        else if (z === 'safe') safe += 1;
        else unknown += 1;
    }
    return { critical, warn, safe, unknown };
}

function applyHeaderBlock(
    sheet: ExcelJS.Worksheet,
    title: string,
    meta: string,
    columns: ColDef[]
) {
    const lastCol = colLetter(columns.length);
    sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

    sheet.mergeCells(`A1:${lastCol}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16, color: { argb: WHITE } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.mergeCells(`A2:${lastCol}2`);
    const metaCell = sheet.getCell('A2');
    metaCell.value = meta;
    metaCell.font = { size: 11, color: { argb: 'FF334155' } };
    metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_HEADER } };
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 22;

    sheet.getRow(3).height = 6;

    const headerRow = sheet.getRow(4);
    headerRow.height = 28;
    columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder();
    });
}

function paintDataRow(
    row: ExcelJS.Row,
    columns: ColDef[],
    zone: StockLevelZone | null,
    zebra: boolean,
    numericKeys: Set<string>
) {
    const colors = zoneColors(zone);
    const statusColIdx = columns.findIndex((c) => c.key === 'status') + 1;

    columns.forEach((col, i) => {
        const cell = row.getCell(i + 1);
        cell.border = thinBorder();
        cell.alignment = {
            vertical: 'middle',
            horizontal: numericKeys.has(col.key) || col.key === 'status' || col.key === 'unit' ? 'center' : 'left',
            wrapText: col.key === 'description' || col.key === 'status',
        };

        if (zone != null) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
            if (i + 1 === statusColIdx) {
                cell.font = { bold: true, color: { argb: colors.fg }, size: 10 };
            }
        } else if (zebra) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
        }

        if (numericKeys.has(col.key) && typeof cell.value === 'number') {
            // Tam sayılarda ondalık ayırıcı (TR'de virgül) görünmesin: 7, → 7
            cell.numFmt = Number.isInteger(cell.value) ? '0' : '0.####';
        }
    });

    if (zone != null) {
        const statusCell = row.getCell(statusColIdx);
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        statusCell.font = { bold: true, color: { argb: colors.fg }, size: 10 };
    }
}

function fileDateSlug() {
    return new Date().toISOString().slice(0, 10);
}

export async function exportStockItemsToExcel(
    items: StockItemRow[],
    options: { scopeLabel: string; searchQ?: string; groupName?: string | null }
): Promise<void> {
    if (items.length === 0) {
        throw new Error('Dışa aktarılacak kayıt yok. Filtreyi değiştirin veya yeni kayıt ekleyin.');
    }

    const zones = items.map((it) => stockLevelZone(it.quantity, it.criticalQuantity ?? null));
    const counts = countZones(zones);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Özünal İmalat Takip';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Stok Listesi', {
        views: [{ state: 'frozen', ySplit: 4 }],
    });

    const filterBits = [
        `Kapsam: ${options.scopeLabel}`,
        options.groupName ? `Grup: ${options.groupName}` : null,
        options.searchQ ? `Arama: ${options.searchQ}` : null,
        `Kayıt: ${items.length}`,
        `Kritik: ${counts.critical} · Yaklaşan: ${counts.warn} · Güvenli: ${counts.safe}`,
        `Tarih: ${new Date().toLocaleString('tr-TR')}`,
    ].filter(Boolean);

    applyHeaderBlock(sheet, 'STOK LİSTESİ — ÖZÜNLÜ', filterBits.join('  ·  '), PRODUCT_COLUMNS);

    const numericKeys = new Set(['quantity', 'criticalQuantity']);

    items.forEach((it, idx) => {
        const zone = zones[idx];
        const payload = {
            groupName: it.group?.name ?? '',
            description: it.description ?? '',
            purchaseCode: it.purchaseCode ?? '',
            unit: it.unit ?? '',
            quantity: formatQty(it.quantity),
            criticalQuantity: formatQty(it.criticalQuantity ?? null),
            status: stockLevelLabel(zone),
        };
        const row = sheet.addRow(payload);
        row.height = 22;
        paintDataRow(row, PRODUCT_COLUMNS, zone, idx % 2 === 1, numericKeys);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const slug = options.scopeLabel.replace(/\s+/g, '_');
    saveAs(blob, `Stok_Listesi_${slug}_${fileDateSlug()}.xlsx`);
}

export async function exportSheetStockItemsToExcel(
    items: SheetStockItemRow[],
    options: { searchQ?: string }
): Promise<void> {
    if (items.length === 0) {
        throw new Error('Dışa aktarılacak saç kaydı yok.');
    }

    const zones = items.map((it) => stockLevelZone(it.quantity, it.criticalQuantity));
    const counts = countZones(zones);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Özünal İmalat Takip';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Saç Stok', {
        views: [{ state: 'frozen', ySplit: 4 }],
    });

    const filterBits = [
        'Kapsam: Saç',
        options.searchQ ? `Arama: ${options.searchQ}` : null,
        `Kayıt: ${items.length}`,
        `Kritik: ${counts.critical} · Yaklaşan: ${counts.warn} · Güvenli: ${counts.safe}`,
        `Tarih: ${new Date().toLocaleString('tr-TR')}`,
    ].filter(Boolean);

    applyHeaderBlock(sheet, 'SAÇ STOK LİSTESİ — ÖZÜNLÜ', filterBits.join('  ·  '), SHEET_COLUMNS);

    const numericKeys = new Set(['thickness', 'width', 'length', 'quantity', 'criticalQuantity']);

    items.forEach((it, idx) => {
        const zone = zones[idx];
        const payload = {
            material: it.material ?? '',
            thickness: formatQty(it.thickness),
            width: formatQty(it.width),
            length: formatQty(it.length),
            quantity: formatQty(it.quantity),
            criticalQuantity: formatQty(it.criticalQuantity),
            status: stockLevelLabel(zone),
        };
        const row = sheet.addRow(payload);
        row.height = 22;
        paintDataRow(row, SHEET_COLUMNS, zone, idx % 2 === 1, numericKeys);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `Sac_Stok_Listesi_${fileDateSlug()}.xlsx`);
}
