'use strict';

/**
 * Excel'den stok kalemi içe aktarır (GÜNCEL STOK1.xlsx formatı).
 * Mevcut üretim tablolarına dokunmaz; yalnızca StockGroup / StockItem yazar.
 *
 * Kullanım:
 *   node scripts/import-stock-from-xlsx.js "C:\path\GÜNCEL STOK1.xlsx"
 * veya:
 *   set STOCK_XLSX_PATH=C:\path\file.xlsx && node scripts/import-stock-from-xlsx.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient, Prisma } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const HEADER_ALIASES = {
    group: ['GRUP', 'GRUP ADI'],
    code: ['SATINALMA KODU', 'SATIN ALMA KODU', 'KOD'],
    desc: ['MALZEME TANIMI', 'MALZEME', 'TANIM', 'AÇIKLAMA'],
    unit: ['BİRİM', 'BIRIM'],
    qty: ['STOK', 'MİKTAR', 'MIKTAR', 'GÜNCEL STOK', 'GUNCEL STOK']
};

function normHeader(h) {
    return String(h || '')
        .trim()
        .toLocaleUpperCase('tr-TR')
        .replace(/\s+/g, ' ');
}

function buildColMap(headerRow) {
    const normToIdx = {};
    headerRow.forEach((cell, i) => {
        const n = normHeader(cell);
        if (n) normToIdx[n] = i;
    });
    function findField(fieldKey) {
        const aliases = HEADER_ALIASES[fieldKey];
        for (const a of aliases) {
            const n = normHeader(a);
            if (normToIdx[n] !== undefined) return normToIdx[n];
        }
        return null;
    }
    return {
        group: findField('group'),
        code: findField('code'),
        desc: findField('desc'),
        unit: findField('unit'),
        qty: findField('qty')
    };
}

function normalizePurchaseCode(v) {
    if (v === undefined || v === null || v === '') return null;
    const s = String(v).trim();
    return s.length === 0 ? null : s;
}

function parseQty(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
    if (!Number.isFinite(n)) return null;
    return new Prisma.Decimal(n);
}

async function ensureGroup(name) {
    const n = String(name || '').trim() || 'Genel';
    return prisma.stockGroup.upsert({
        where: { name: n },
        create: { name: n, sortOrder: 0 },
        update: {}
    });
}

async function upsertItem({ groupId, purchaseCode, description, unit, quantity }) {
    if (purchaseCode) {
        await prisma.stockItem.upsert({
            where: {
                groupId_purchaseCode: {
                    groupId,
                    purchaseCode
                }
            },
            create: {
                groupId,
                purchaseCode,
                description,
                unit,
                quantity
            },
            update: {
                description,
                unit,
                quantity
            }
        });
        return;
    }

    const existing = await prisma.stockItem.findFirst({
        where: {
            groupId,
            purchaseCode: null,
            description
        }
    });
    if (existing) {
        await prisma.stockItem.update({
            where: { id: existing.id },
            data: { description, unit, quantity }
        });
    } else {
        await prisma.stockItem.create({
            data: {
                groupId,
                purchaseCode: null,
                description,
                unit,
                quantity
            }
        });
    }
}

async function main() {
    const filePath = process.argv[2] || process.env.STOCK_XLSX_PATH;
    if (!filePath) {
        console.error('Dosya yolu verin: node scripts/import-stock-from-xlsx.js "<dosya.xlsx>"');
        process.exit(1);
    }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
        console.error('Dosya bulunamadı:', resolved);
        process.exit(1);
    }
    console.log('Stok import başlıyor:', resolved);

    const wb = XLSX.readFile(resolved);
    const sh = wb.SheetNames[0];
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sh], { header: 1, defval: '' });
    if (matrix.length < 2) {
        console.error('Sheet boş veya yetersiz:', sh);
        process.exit(1);
    }

    const col = buildColMap(matrix[0]);
    if (col.desc == null) {
        console.error('MALZEME TANIMI (veya eşdeğeri) sütunu bulunamadı. Başlık:', matrix[0]);
        process.exit(1);
    }
    if (col.group == null) {
        console.warn('GRUP sütunu bulunamadı; tüm satırlar "Genel" grubuna yazılacak.');
    }

    let imported = 0;
    let skipped = 0;

    const groupCache = new Map();
    async function groupIdFor(name) {
        const key = String(name || '').trim() || 'Genel';
        if (groupCache.has(key)) return groupCache.get(key);
        const g = await ensureGroup(key);
        groupCache.set(key, g.id);
        return g.id;
    }

    for (let r = 1; r < matrix.length; r++) {
        const row = matrix[r];
        const groupName = col.group != null ? String(row[col.group] ?? '').trim() : '';
        const desc = String(row[col.desc] ?? '').trim();
        if (!desc) {
            skipped++;
            continue;
        }

        const gid = await groupIdFor(groupName || 'Genel');
        const code = col.code != null ? normalizePurchaseCode(row[col.code]) : null;
        const unitRaw = col.unit != null ? String(row[col.unit] ?? '').trim() : '';
        const unit = unitRaw.length > 0 ? unitRaw : null;
        const quantity = col.qty != null ? parseQty(row[col.qty]) : null;

        await upsertItem({
            groupId: gid,
            purchaseCode: code,
            description: desc,
            unit,
            quantity
        });
        imported++;
        if (imported % 200 === 0) console.log('…', imported, 'satır');
    }

    console.log('Tamam.', { sheet: sh, imported, skippedEmpty: skipped, file: resolved });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
