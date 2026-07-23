/**
 * Excel saç stok içe aktarımı.
 * - Malzeme hücresi boşsa bir üst satırdaki malzeme adı kullanılır (Excel dolgu mantığı).
 * - Tarihli sayfalardan en güncel olan tercih edilir (örn. 11.07).
 * - Aradaki tamamen boş satırdan sonraki bloklar (kopya/tekrar) atlanır.
 *
 * Kullanım:
 *   node scripts/import-sheet-stock-from-xlsx.js [xlsxPath] [--replace] [--sheet=11.07]
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

function toDec(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return new Prisma.Decimal(n);
}

function findXlsx(explicit) {
    if (explicit && !explicit.startsWith('--') && fs.existsSync(explicit)) return explicit;
    const candidates = [
        path.join(__dirname, '..', '..', '09.07.2026 SAC STOK.xlsx'),
        path.join(process.cwd(), '09.07.2026 SAC STOK.xlsx'),
        path.join(process.cwd(), '..', '09.07.2026 SAC STOK.xlsx'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

/** "11.07", "13.06 " gibi sayfa adlarını tarihe çevirir (yıl yoksa aynı yıl). */
function sheetDateScore(name) {
    const m = String(name || '')
        .trim()
        .match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?$/);
    if (!m) return -1;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = m[3] != null ? parseInt(m[3], 10) : 2026;
    if (year < 100) year += 2000;
    if (!(day >= 1 && day <= 31 && month >= 1 && month <= 12)) return -1;
    return year * 10000 + month * 100 + day;
}

function pickSheetName(wb, forced) {
    if (forced) {
        const hit = wb.SheetNames.find((n) => String(n).trim() === String(forced).trim());
        if (!hit) throw new Error(`Sayfa bulunamadı: ${forced}`);
        return hit;
    }
    let best = null;
    let bestScore = -1;
    for (const n of wb.SheetNames) {
        const score = sheetDateScore(n);
        if (score > bestScore) {
            bestScore = score;
            best = n;
        }
    }
    if (best) return best;
    const sac = wb.SheetNames.find((n) => String(n).trim().toUpperCase() === 'SAC STOK');
    return sac || wb.SheetNames[0];
}

/**
 * Excel satırlarını malzeme adına göre okur.
 * Boş malzeme → önceki dolu malzeme (fill-down).
 * İlk tamamen boş satırdan sonrası ignore.
 */
function parseSheetRows(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    const out = [];
    let lastMaterial = null;
    let started = false;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;

        const rawMat = row[0] != null ? String(row[0]).replace(/\s+/g, ' ').trim() : '';
        const thickness = toDec(row[1]);
        const width = toDec(row[2]);
        const length = toDec(row[3]);
        const quantity = toDec(row[4]);

        const hasDims = thickness != null || width != null || length != null || quantity != null;

        // Tamamen boş satır: veri başladıysa tablonun sonu (altındaki kopya blokları alma)
        if (!rawMat && !hasDims) {
            if (started) break;
            continue;
        }

        const isTitleOrHeader =
            rawMat.toUpperCase() === 'SAC' ||
            rawMat.toLowerCase() === 'malzeme' ||
            rawMat.toLowerCase() === 'kalınlık' ||
            rawMat.toLowerCase() === 'kalinlik';

        if (isTitleOrHeader && !hasDims) {
            continue;
        }

        let material = rawMat;
        if (!material) {
            material = lastMaterial;
        } else {
            lastMaterial = material;
        }

        if (!material) continue;
        if (thickness == null || width == null || length == null) continue;

        started = true;
        out.push({
            material,
            thickness,
            width,
            length,
            quantity: quantity ?? new Prisma.Decimal(0),
            excelRow: i + 1,
        });
    }

    return out;
}

async function main() {
    const args = process.argv.slice(2);
    const replace = args.includes('--replace');
    const sheetArg = args.find((a) => a.startsWith('--sheet='));
    const forcedSheet = sheetArg ? sheetArg.slice('--sheet='.length) : null;
    const xlsxPath = findXlsx(args.find((a) => !a.startsWith('--')));

    if (!xlsxPath) {
        console.error('Excel bulunamadı: 09.07.2026 SAC STOK.xlsx');
        process.exit(1);
    }

    const wb = XLSX.readFile(xlsxPath);
    const sheetName = pickSheetName(wb, forcedSheet);
    console.log('Okunuyor:', xlsxPath);
    console.log('Sayfa:', JSON.stringify(sheetName));

    const parsed = parseSheetRows(wb.Sheets[sheetName]);
    console.log('Satır:', parsed.length);

    const byMat = {};
    for (const p of parsed) {
        byMat[p.material] = (byMat[p.material] || 0) + 1;
    }
    console.log('Malzeme grupları:', byMat);

    if (replace) {
        const del = await prisma.sheetStockItem.deleteMany({});
        console.log(`Replace: ${del.count} eski kayıt silindi`);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const p of parsed) {
        const existing = await prisma.sheetStockItem.findFirst({
            where: {
                material: p.material,
                thickness: p.thickness,
                width: p.width,
                length: p.length,
            },
        });

        if (existing) {
            await prisma.sheetStockItem.update({
                where: { id: existing.id },
                data: { quantity: p.quantity },
            });
            updated += 1;
        } else {
            await prisma.sheetStockItem.create({
                data: {
                    material: p.material,
                    thickness: p.thickness,
                    width: p.width,
                    length: p.length,
                    quantity: p.quantity,
                },
            });
            created += 1;
        }
    }

    // Replace sonrası Excel'de olmayan eski ölçüleri temizle (upsert yolu için)
    if (!replace) {
        // no-op
    } else {
        // already wiped
    }

    console.log(`Tamam: ${created} eklendi, ${updated} güncellendi, ${skipped} atlandı.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
