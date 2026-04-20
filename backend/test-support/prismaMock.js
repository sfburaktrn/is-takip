/**
 * MOCK_PRISMA=1 ile API testlerinde gerçek DB bağlanmaz.
 * Eksik model çağrıları için Proxy ile boş findMany / güvenli no-op.
 */
'use strict';

const bcryptHashForPassword = '$2a$10$9TjJ5P/Uz3Bnq.z.9aUQ5uM3ks2iFkGEN3dVVVYqNG1Mmjtsck6Xy'; // "password"

const testUser = {
    id: 1,
    username: 'testuser',
    password: bcryptHashForPassword,
    fullName: 'Test Kullanıcı',
    isAdmin: false,
};

const adminUser = {
    id: 2,
    username: 'adminuser',
    password: bcryptHashForPassword,
    fullName: 'Admin Kullanıcı',
    isAdmin: true,
};

const defaultModel = {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
    count: async () => 0,
    create: async ({ data }) => ({ id: 1, ...data }),
    createMany: async () => ({ count: 0 }),
    update: async ({ data }) => ({ id: 1, ...data }),
    updateMany: async () => ({ count: 0 }),
    delete: async () => ({ id: 1 }),
    deleteMany: async () => ({ count: 0 }),
    upsert: async ({ create }) => ({ id: 1, ...create }),
};

function toNumberMaybe(x) {
    if (x === null || x === undefined) return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
}

function asDecimalNumber(x) {
    // Prisma Decimal mock: route layer mostly does Number() usage.
    const n = typeof x === 'number' ? x : Number(String(x).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

let seq = 100;
const nextId = () => (++seq);

// Minimal in-memory store for stock endpoints
const mem = {
    stockGroups: [
        { id: 10, name: 'GENEL', sortOrder: 0, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') },
    ],
    stockItems: [],
    stockMovements: [],
    stockSupplierHistory: [],
    stockUnitPriceHistory: [],
};

function pick(obj, keys) {
    const out = {};
    for (const k of keys) out[k] = obj[k];
    return out;
}

const base = {
    user: {
        findUnique: async ({ where }) => {
            if (where.username === testUser.username) return { ...testUser };
            if (where.username === adminUser.username) return { ...adminUser };
            if (where.id === testUser.id) return { ...testUser };
            if (where.id === adminUser.id) return { ...adminUser };
            return null;
        },
        findMany: async () => [
            {
                id: testUser.id,
                username: testUser.username,
                fullName: testUser.fullName,
                isAdmin: testUser.isAdmin,
                createdAt: new Date('2025-01-01'),
            },
            {
                id: adminUser.id,
                username: adminUser.username,
                fullName: adminUser.fullName,
                isAdmin: adminUser.isAdmin,
                createdAt: new Date('2025-01-02'),
            },
        ],
    },
    loginLog: {
        create: async () => ({ id: 1 }),
    },
    damper: {
        findMany: async () => [],
    },
    dorse: {
        findMany: async () => [],
    },
    sasi: {
        findMany: async () => [],
    },
    departmentWeekCapacity: {
        findMany: async () => [],
    },
    weeklyStepTarget: {
        findMany: async () => [],
    },
    stepCompletionEvent: {
        findMany: async () => [],
    },
    $transaction: async (arg) => {
        // Supports both: prisma.$transaction([op1, op2]) and prisma.$transaction(async (tx) => {})
        if (typeof arg === 'function') {
            return arg(base);
        }
        if (Array.isArray(arg)) {
            return Promise.all(arg);
        }
        return arg;
    },
    $disconnect: async () => {},
    /** Prisma.$queryRaw\`...\` etiketli şablon çağrısı */
    $queryRaw: async (strings, ..._values) => [{ '?column?': 1 }],
    $executeRaw: async () => 0,

    // --- Stock models (stateful for tests) ---
    stockGroup: {
        findMany: async ({ include, orderBy } = {}) => {
            // orderBy ignored (stable sort by sortOrder then name)
            const rows = [...mem.stockGroups].sort((a, b) => {
                const so = (a.sortOrder || 0) - (b.sortOrder || 0);
                if (so !== 0) return so;
                return String(a.name).localeCompare(String(b.name), 'tr-TR');
            });
            if (include && include._count && include._count.select && include._count.select.items) {
                return rows.map((g) => ({
                    ...g,
                    _count: { items: mem.stockItems.filter((it) => it.groupId === g.id).length },
                }));
            }
            return rows;
        },
        findUnique: async ({ where } = {}) => {
            if (!where) return null;
            if (where.id != null) return mem.stockGroups.find((g) => g.id === where.id) || null;
            if (where.name != null) return mem.stockGroups.find((g) => g.name === where.name) || null;
            return null;
        },
        upsert: async ({ where, create } = {}) => {
            if (where && where.name) {
                const ex = mem.stockGroups.find((g) => g.name === where.name);
                if (ex) return { ...ex };
            }
            const g = {
                id: nextId(),
                name: String(create?.name || '').trim() || `G-${seq}`,
                sortOrder: toNumberMaybe(create?.sortOrder) ?? 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mem.stockGroups.push(g);
            return { ...g };
        },
    },
    stockItem: {
        findMany: async ({ where, include } = {}) => {
            let rows = [...mem.stockItems];
            if (where && where.groupId != null) {
                rows = rows.filter((r) => r.groupId === where.groupId);
            }
            // 'where.OR' for q search in real implementation; here we only do a simple contains on description/purchaseCode/supplierName
            if (where && where.OR && Array.isArray(where.OR)) {
                const raw = where.__q || null;
                if (typeof raw === 'string' && raw.trim().length >= 2) {
                    const q = raw.trim().toLocaleLowerCase('tr-TR');
                    rows = rows.filter((r) => {
                        const h = `${r.description || ''} ${r.purchaseCode || ''} ${r.supplierName || ''}`.toLocaleLowerCase('tr-TR');
                        return h.includes(q);
                    });
                }
            }
            return rows.map((r) => {
                const out = { ...r };
                if (include && include.group) {
                    out.group =
                        mem.stockGroups.find((g) => g.id === r.groupId) || { id: r.groupId, name: `G#${r.groupId}` };
                    // select form: group: { select: { id,name } }
                    if (include.group.select) {
                        out.group = pick(out.group, Object.keys(include.group.select));
                    }
                }
                if (include && include.priceHistory) {
                    const take = include.priceHistory.take ?? 100;
                    const ph = mem.stockUnitPriceHistory
                        .filter((p) => p.stockItemId === r.id)
                        .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
                        .slice(0, take);
                    out.priceHistory = ph;
                }
                return out;
            });
        },
        count: async ({ where } = {}) => {
            return (await base.stockItem.findMany({ where })).length;
        },
        findUnique: async ({ where, include } = {}) => {
            const id = where?.id;
            if (id == null) return null;
            const row = mem.stockItems.find((r) => r.id === id) || null;
            if (!row) return null;
            if (include) {
                const group = mem.stockGroups.find((g) => g.id === row.groupId) || { id: row.groupId, name: `G#${row.groupId}` };
                const priceHistory = mem.stockUnitPriceHistory
                    .filter((p) => p.stockItemId === id)
                    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
                const movements = mem.stockMovements
                    .filter((m) => m.stockItemId === id)
                    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
                const supplierHistory = mem.stockSupplierHistory
                    .filter((s) => s.stockItemId === id)
                    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
                return {
                    ...row,
                    group,
                    priceHistory,
                    movements,
                    supplierHistory,
                };
            }
            return { ...row };
        },
        create: async ({ data } = {}) => {
            const now = new Date();
            const groupId = data.groupId;
            const row = {
                id: nextId(),
                groupId,
                purchaseCode: data.purchaseCode ?? null,
                description: data.description ?? '',
                unit: data.unit ?? null,
                quantity: data.quantity ?? null,
                supplierName: data.supplierName ?? null,
                supplierContact: data.supplierContact ?? null,
                createdAt: now,
                updatedAt: now,
            };
            mem.stockItems.push(row);
            return { ...row };
        },
        update: async ({ where, data } = {}) => {
            const id = where?.id;
            const idx = mem.stockItems.findIndex((r) => r.id === id);
            if (idx < 0) return null;
            const cur = mem.stockItems[idx];
            const next = { ...cur, ...data, updatedAt: new Date() };
            mem.stockItems[idx] = next;
            return { ...next };
        },
    },
    stockMovement: {
        create: async ({ data, include } = {}) => {
            const now = data.recordedAt ? new Date(data.recordedAt) : new Date();
            const row = {
                id: nextId(),
                stockItemId: data.stockItemId,
                type: data.type,
                quantity: asDecimalNumber(data.quantity),
                balanceAfter: data.balanceAfter != null ? asDecimalNumber(data.balanceAfter) : null,
                note: data.note ?? null,
                userId: data.userId ?? null,
                recordedAt: now,
            };
            mem.stockMovements.push(row);
            if (include && include.user) {
                return { ...row, user: null };
            }
            return { ...row };
        },
        findMany: async () => [],
    },
    stockSupplierHistory: {
        create: async ({ data, include } = {}) => {
            const now = data.recordedAt ? new Date(data.recordedAt) : new Date();
            const row = {
                id: nextId(),
                stockItemId: data.stockItemId,
                prevSupplierName: data.prevSupplierName ?? null,
                prevSupplierContact: data.prevSupplierContact ?? null,
                supplierName: data.supplierName ?? null,
                supplierContact: data.supplierContact ?? null,
                note: data.note ?? null,
                userId: data.userId ?? null,
                recordedAt: now,
            };
            mem.stockSupplierHistory.push(row);
            if (include && include.user) {
                return { ...row, user: null };
            }
            return { ...row };
        },
        deleteMany: async ({ where } = {}) => {
            const before = mem.stockSupplierHistory.length;
            mem.stockSupplierHistory = mem.stockSupplierHistory.filter((r) => !(r.id === where?.id && r.stockItemId === where?.stockItemId));
            return { count: before - mem.stockSupplierHistory.length };
        },
    },
    stockUnitPriceHistory: {
        create: async ({ data } = {}) => {
            const now = data.recordedAt ? new Date(data.recordedAt) : new Date();
            const row = {
                id: nextId(),
                stockItemId: data.stockItemId,
                recordedAt: now,
                unitPrice: asDecimalNumber(data.unitPrice),
                note: data.note ?? null,
                supplierName: data.supplierName ?? null,
                supplierContact: data.supplierContact ?? null,
            };
            mem.stockUnitPriceHistory.push(row);
            return { ...row };
        },
        deleteMany: async ({ where } = {}) => {
            const before = mem.stockUnitPriceHistory.length;
            mem.stockUnitPriceHistory = mem.stockUnitPriceHistory.filter((r) => !(r.id === where?.id && r.stockItemId === where?.stockItemId));
            return { count: before - mem.stockUnitPriceHistory.length };
        },
        findMany: async () => [],
    },
};

module.exports = new Proxy(base, {
    get(target, prop) {
        if (prop === Symbol.toStringTag) return 'PrismaClientMock';
        if (Object.prototype.hasOwnProperty.call(target, prop)) {
            return target[prop];
        }
        if (String(prop).startsWith('$')) {
            return async () => undefined;
        }
        return defaultModel;
    },
});
