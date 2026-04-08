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
    $disconnect: async () => {},
    /** Prisma.$queryRaw\`...\` etiketli şablon çağrısı */
    $queryRaw: async (strings, ..._values) => [{ '?column?': 1 }],
    $executeRaw: async () => 0,
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
