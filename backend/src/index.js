require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma =
    process.env.MOCK_PRISMA === '1'
        ? require('../test-support/prismaMock.js')
        : new PrismaClient();

/** SQL LIKE/ILIKE özel karakterlerini kaçır */
function escapeSqlLikePattern(q) {
    return q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function searchIlikeParam(raw) {
    return `%${escapeSqlLikePattern(raw)}%`;
}

/**
 * Türkçe İ/I/ı/i için PostgreSQL ILIKE tek başına yetmez; aynı kelimenin olası yazılışlarını üretir.
 * Örn. "rize" → "RİZE", "rİze" vb. (kayıtta RİZE iken küçük harfli arama bulsun).
 */
function expandTrSearchTerms(s) {
    const t = (s || '').trim().normalize('NFKC');
    if (t.length < 2) return [];
    const out = new Set();
    const add = (x) => {
        const v = String(x || '').trim().normalize('NFKC');
        if (v.length >= 2) out.add(v);
    };
    add(t);
    add(t.toLocaleLowerCase('tr-TR'));
    add(t.toLocaleUpperCase('tr-TR'));
    add(t.toLocaleLowerCase('en-US'));
    add(t.toLocaleUpperCase('en-US'));
    if (/i/.test(t)) {
        add(t.replace(/i/g, 'İ'));
        add(t.replace(/i/g, 'ı'));
    }
    if (/I/.test(t) && !/İ/.test(t)) {
        add(t.replace(/I/g, 'İ'));
        add(t.replace(/I/g, 'ı'));
    }
    if (/ı/.test(t)) {
        add(t.replace(/ı/g, 'i'));
        add(t.replace(/ı/g, 'I'));
    }
    if (/İ/.test(t)) {
        add(t.replace(/İ/g, 'i'));
        add(t.replace(/İ/g, 'I'));
    }
    return [...out];
}

function buildSearchPatList(raw) {
    return [...new Set(expandTrSearchTerms(raw).map(searchIlikeParam))];
}

function buildProductTextSearchOr(fieldExprs, patList, includeImalatText) {
    const conds = [];
    for (const pat of patList) {
        for (const expr of fieldExprs) {
            conds.push(Prisma.sql`${expr} ILIKE ${pat} ESCAPE '\\'`);
        }
        if (includeImalatText) {
            conds.push(Prisma.sql`("imalatNo" IS NOT NULL AND CAST("imalatNo" AS TEXT) ILIKE ${pat} ESCAPE '\\')`);
        }
    }
    return conds.length ? Prisma.join(conds, ' OR ') : Prisma.sql`FALSE`;
}

function buildDamperSearchWhere(patList, num) {
    const fields = [
        Prisma.sql`musteri`,
        Prisma.sql`COALESCE("sasiNo", '')`,
        Prisma.sql`tip`,
        Prisma.sql`"malzemeCinsi"`,
        Prisma.sql`COALESCE(renk, '')`,
        Prisma.sql`COALESCE("aracMarka", '')`,
        Prisma.sql`COALESCE(model, '')`,
        Prisma.sql`COALESCE(m3::text, '')`
    ];
    const likeOr = buildProductTextSearchOr(fields, patList, true);
    if (Number.isFinite(num)) {
        return Prisma.sql`(${likeOr}) OR "imalatNo" = ${num}`;
    }
    return Prisma.sql`(${likeOr})`;
}

function buildDorseSearchWhere(patList, num) {
    const fields = [
        Prisma.sql`musteri`,
        Prisma.sql`COALESCE("sasiNo", '')`,
        Prisma.sql`COALESCE("malzemeCinsi", '')`,
        Prisma.sql`COALESCE(silindir, '')`,
        Prisma.sql`COALESCE(renk, '')`,
        Prisma.sql`COALESCE(m3::text, '')`
    ];
    const likeOr = buildProductTextSearchOr(fields, patList, true);
    if (Number.isFinite(num)) {
        return Prisma.sql`(${likeOr}) OR "imalatNo" = ${num}`;
    }
    return Prisma.sql`(${likeOr})`;
}

function buildSasiSearchWhere(patList, num) {
    const fields = [
        Prisma.sql`COALESCE(musteri, '')`,
        Prisma.sql`COALESCE("sasiNo", '')`,
        Prisma.sql`COALESCE(tampon, '')`,
        Prisma.sql`COALESCE(dingil, '')`
    ];
    const likeOr = buildProductTextSearchOr(fields, patList, true);
    if (Number.isFinite(num)) {
        return Prisma.sql`(${likeOr}) OR "imalatNo" = ${num}`;
    }
    return Prisma.sql`(${likeOr})`;
}

const app = express();

// Middleware
const allowedOrigins = [
    'http://localhost:3000',
    'http://frontend:3000',
    process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Handle preflight requests explicitly
app.options('*', cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());

// Session middleware
const isProduction = process.env.NODE_ENV === 'production';

// Session secret validation - production ortamda zorunlu
if (isProduction && !process.env.SESSION_SECRET) {
    console.error('HATA: SESSION_SECRET ortam değişkeni tanımlanmalı!');
    process.exit(1);
}

if (isProduction) {
    app.set('trust proxy', 1); // Trust first proxy for secure cookies
}
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction, // HTTPS only in production
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 saat (1 vardiya)
        sameSite: isProduction ? 'none' : 'lax' // Cross-domain cookies in production
    }
}));

// Rate Limiter - Login brute force koruması (API testlerinde MOCK_PRISMA ile kapatılır)
const loginLimiter =
    process.env.DISABLE_RATE_LIMIT === '1'
        ? (req, res, next) => next()
        : rateLimit({
              windowMs: 60 * 60 * 1000, // 1 saat
              max: 10, // IP başına 10 deneme
              message: { error: 'Çok fazla giriş denemesi. Lütfen 1 saat sonra tekrar deneyin.' },
              standardHeaders: true,
              legacyHeaders: false,
          });

// Auth Middleware - Giriş kontrolü
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
    }
    next();
};

// Admin Middleware - Admin kontrolü
const requireAdmin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
    }
    if (!req.session.isAdmin) {
        return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekiyor' });
    }
    next();
};

/** Teklif Takip sunucu-sunucu ingest: Bearer IMALAT_INGEST_SECRET (oturum kullanılmaz). */
function requireTeklifIngestSecret(req, res, next) {
    const secret = process.env.IMALAT_INGEST_SECRET;
    if (!secret || String(secret).trim() === '') {
        return res.status(503).json({ error: 'Entegrasyon yapılandırılmamış' });
    }
    const h = req.headers.authorization;
    if (!h || typeof h !== 'string' || !h.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    const token = h.slice(7).trim();
    if (token !== secret) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    next();
}

function strOrNull(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

function parseRequiredIsoDate(val, field) {
    if (val === null || val === undefined || val === '') {
        return { ok: false, error: `${field} zorunlu` };
    }
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) {
        return { ok: false, error: `${field} geçersiz tarih` };
    }
    return { ok: true, date: d };
}

function parseOptionalIsoDate(val) {
    if (val === null || val === undefined || val === '') {
        return { ok: true, date: null };
    }
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) {
        return { ok: false, error: 'Geçersiz tarih' };
    }
    return { ok: true, date: d };
}

// Step group definitions - which sub-steps belong to which main step
const STEP_GROUPS = {
    kesimBukum: {
        name: 'KESİM - BÜKÜM',
        subSteps: ['plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'damperSasiPlazmaKesim', 'presBukum']
    },
    sasiBitis: {
        name: 'ŞASİ BİTİŞ',
        subSteps: ['aracBraket', 'damperSasi', 'sasiYukleme']
    },
    onHazirlik: {
        name: 'ÖN HAZIRLIK',
        subSteps: ['milAltKutuk', 'taban', 'yan', 'onGogus', 'arkaKapak', 'yuklemeMalzemesi']
    },
    montaj: {
        name: 'MONTAJ',
        subSteps: ['damperKurulmasi', 'damperKaynak', 'sasiKapakSiperlik', 'yukleme']
    },
    boyaBitis: {
        name: 'BOYA BİTİŞ',
        subSteps: ['boyaHazirlik', 'boya']
    },
    tamamlamaBitis: {
        name: 'TAMAMLAMA BİTİŞ',
        subSteps: ['elektrik', 'hava', 'tamamlama']
    }
};

const DORSE_STEP_GROUPS = {
    kesimBukum: {
        name: 'KESİM - BÜKÜM',
        subSteps: ['plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'presBukum', 'dorseSasi']
    },
    onHazirlik: {
        name: 'ÖN HAZIRLIK',
        subSteps: ['milAltKutuk', 'taban', 'yan', 'onGogus', 'arkaKapak', 'yuklemeMalzemesi']
    },
    montaj: {
        name: 'MONTAJ',
        subSteps: ['dorseKurulmasi', 'dorseKaynak', 'kapakSiperlik', 'yukleme', 'hidrolik']
    },
    boya: {
        name: 'BOYA',
        subSteps: ['boyaHazirlik', 'dorseSasiBoyama']
    },
    tamamlama: {
        name: 'TAMAMLAMA',
        subSteps: ['fren', 'dorseElektrik', 'tamamlama', 'cekiciElektrik', 'cekiciHidrolik', 'aracKontrolBypassAyari']
    },
    sonKontrol: {
        name: 'SON KONTROL',
        subSteps: ['sonKontrol', 'tipOnay', 'fatura', 'akmTseMuayenesi', 'dmoMuayenesi', 'tahsilat', 'teslimat']
    }
};

// Calculate main step status based on sub-steps
function calculateMainStepStatus(damper, groupKey) {
    const group = STEP_GROUPS[groupKey];
    if (!group) return 'BAŞLAMADI';

    const completedCount = group.subSteps.filter(step => damper[step] === true).length;
    const totalCount = group.subSteps.length;

    if (completedCount === 0) return 'BAŞLAMADI';
    if (completedCount === totalCount) return 'TAMAMLANDI';
    return 'DEVAM EDİYOR';
}

function calculateMainDorseStepStatus(dorse, groupKey) {
    const group = DORSE_STEP_GROUPS[groupKey];
    if (!group) return 'BAŞLAMADI';

    const completedCount = group.subSteps.filter(step => dorse[step] === true).length;
    const totalCount = group.subSteps.length;

    if (completedCount === 0) return 'BAŞLAMADI';
    if (completedCount === totalCount) return 'TAMAMLANDI';
    return 'DEVAM EDİYOR';
}

const SASI_STEP_GROUPS = {
    kesimBukum: {
        name: 'KESİM - BÜKÜM',
        subSteps: ['plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'presBukum']
    },
    onHazirlik: {
        name: 'ÖN HAZIRLIK',
        subSteps: ['lenjorenMontaji', 'robotKaynagi']
    },
    montaj: {
        name: 'MONTAJ',
        subSteps: ['saseFiksturCatim', 'kaynak', 'dingilMontaji', 'genelKaynak', 'tesisatCubugu', 'mekanikAyak', 'korukMontaji', 'lastikMontaji']
    }
};

function calculateMainSasiStepStatus(sasi, groupKey) {
    const group = SASI_STEP_GROUPS[groupKey];
    if (!group) return 'BAŞLAMADI';

    const completedCount = group.subSteps.filter(step => sasi[step] === true).length;
    const totalCount = group.subSteps.length;

    if (completedCount === 0) return 'BAŞLAMADI';
    if (completedCount === totalCount) return 'TAMAMLANDI';
    return 'DEVAM EDİYOR';
}

function addCalculatedSasiSteps(sasi) {
    return {
        ...sasi,
        kesimBukumStatus: calculateMainSasiStepStatus(sasi, 'kesimBukum'),
        onHazirlikStatus: calculateMainSasiStepStatus(sasi, 'onHazirlik'),
        montajStatus: calculateMainSasiStepStatus(sasi, 'montaj'),
    };
}

const { syncStepCompletionEvents, STEP_LABELS, TRACKED_MAIN_STEPS } = require('./stepCompletionSync');
const {
    aggregateCapacityForRange,
    aggregateTargetForRange,
    HOURS_PER_PERSON_WEEK,
    SCHEDULE_DESCRIPTION,
    WORK_DAYS_PER_WEEK,
    NET_HOURS_PER_DAY,
    weekStartToDateKey,
    mondayOfUtcWeekContaining
} = require('./capacitySchedule');

function getDamperTrackedStatus(rec, key) {
    if (!rec) return 'BAŞLAMADI';
    if (key === 'hidrolik') return rec.hidrolik ? 'TAMAMLANDI' : 'BAŞLAMADI';
    return calculateMainStepStatus(rec, key);
}

function getDorseTrackedStatus(rec, key) {
    if (!rec) return 'BAŞLAMADI';
    return calculateMainDorseStepStatus(rec, key);
}

function getSasiTrackedStatus(rec, key) {
    if (!rec) return 'BAŞLAMADI';
    return calculateMainSasiStepStatus(rec, key);
}

function parseProductionStartedAt(body) {
    if (body.productionStartedAt != null && body.productionStartedAt !== '') {
        const d = new Date(body.productionStartedAt);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
}

function omitProductionStartedFromUpdate(body) {
    if (!body || typeof body !== 'object') return body;
    const { productionStartedAt: _omit, ...rest } = body;
    return rest;
}

const AUDIT_SKIP_KEYS = new Set(['updatedAt', 'createdAt']);

function serializeAuditValue(v) {
    if (v === null || v === undefined) return v;
    if (v instanceof Date) return v.toISOString();
    return v;
}

function collectFieldChanges(before, after) {
    if (!before || !after) return [];
    const out = [];
    for (const key of Object.keys(after)) {
        if (AUDIT_SKIP_KEYS.has(key)) continue;
        const bv = before[key];
        const av = after[key];
        const sb = serializeAuditValue(bv);
        const sa = serializeAuditValue(av);
        if (sb === sa) continue;
        out.push({ field: key, from: sb, to: sa });
    }
    return out;
}

async function writeAuditLog(req, { action, productType, productId, summary, details }) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: req.session.userId ?? null,
                username: req.session.username ?? null,
                action,
                productType,
                productId,
                summary: summary ?? null,
                details: details === undefined ? undefined : details
            }
        });
    } catch (e) {
        console.error('Audit log write failed:', e);
    }
}

// Add calculated main steps to damper object
function addCalculatedSteps(damper) {
    return {
        ...damper,
        kesimBukumStatus: calculateMainStepStatus(damper, 'kesimBukum'),
        sasiBitisStatus: calculateMainStepStatus(damper, 'sasiBitis'),
        onHazirlikStatus: calculateMainStepStatus(damper, 'onHazirlik'),
        montajStatus: calculateMainStepStatus(damper, 'montaj'),
        hidrolikStatus: damper.hidrolik ? 'TAMAMLANDI' : 'BAŞLAMADI',
        boyaBitisStatus: calculateMainStepStatus(damper, 'boyaBitis'),
        tamamlamaBitisStatus: calculateMainStepStatus(damper, 'tamamlamaBitis'),
        sonKontrolStatus: damper.sonKontrol ? 'YAPILDI' : 'BAŞLAMADI',
        teslimatStatus: damper.teslimat ? 'YAPILDI' : 'BAŞLAMADI'
    };
}

// ==================== AUTH ROUTES ====================

// Login - Rate limited to prevent brute force
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
        }

        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
        }

        // Session'a kullanıcı bilgilerini kaydet
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = user.isAdmin;

        // Giriş logunu kaydet
        await prisma.loginLog.create({
            data: {
                userId: user.id,
                ipAddress: req.ip || req.connection.remoteAddress
            }
        });

        res.json({
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            isAdmin: user.isAdmin
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Giriş yapılamadı' });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Çıkış yapılamadı' });
        }
        res.json({ message: 'Başarıyla çıkış yapıldı' });
    });
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Giriş yapılmamış' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.session.userId }
        });

        if (!user) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }

        res.json({
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            isAdmin: user.isAdmin
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Kullanıcı bilgisi alınamadı' });
    }
});

// ==================== USER MANAGEMENT ROUTES (Admin Only) ====================

// Get all users
app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                fullName: true,
                isAdmin: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Kullanıcılar alınamadı' });
    }
});

// Create new user
app.post('/api/users', requireAdmin, async (req, res) => {
    try {
        const { username, password, fullName, isAdmin } = req.body;

        if (!username || !password || !fullName) {
            return res.status(400).json({ error: 'Kullanıcı adı, şifre ve isim gerekli' });
        }

        // Check if username exists
        const existingUser = await prisma.user.findUnique({
            where: { username }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                fullName,
                isAdmin: isAdmin || false
            },
            select: {
                id: true,
                username: true,
                fullName: true,
                isAdmin: true,
                createdAt: true
            }
        });

        res.status(201).json(user);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Kullanıcı oluşturulamadı' });
    }
});

// Update user (change password, fullName, isAdmin)
app.put('/api/users/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { password, fullName, isAdmin } = req.body;

        const updateData = {};
        if (fullName) updateData.fullName = fullName;
        if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
        if (password) updateData.password = await bcrypt.hash(password, 10);

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData,
            select: {
                id: true,
                username: true,
                fullName: true,
                isAdmin: true,
                createdAt: true
            }
        });

        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Kullanıcı güncellenemedi' });
    }
});

// Delete user
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting self
        if (parseInt(id) === req.session.userId) {
            return res.status(400).json({ error: 'Kendinizi silemezsiniz' });
        }

        await prisma.user.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Kullanıcı silindi' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Kullanıcı silinemedi' });
    }
});

// Get login logs
app.get('/api/login-logs', requireAdmin, async (req, res) => {
    try {
        const { limit = 100 } = req.query;

        const logs = await prisma.loginLog.findMany({
            include: {
                user: {
                    select: {
                        username: true,
                        fullName: true
                    }
                }
            },
            orderBy: { loginAt: 'desc' },
            take: parseInt(limit)
        });

        res.json(logs);
    } catch (error) {
        console.error('Get login logs error:', error);
        res.status(500).json({ error: 'Giriş logları alınamadı' });
    }
});

// ==================== DAMPER ROUTES ====================

// Get all dampers with optional filters - Requires authentication
app.get('/api/dampers', requireAuth, async (req, res) => {
    try {
        const { search, tip, malzemeCinsi, status } = req.query;

        let where = {};

        if (search) {
            where.OR = [
                { musteri: { contains: search, mode: 'insensitive' } },
                { imalatNo: isNaN(parseInt(search)) ? undefined : parseInt(search) }
            ].filter(Boolean);
        }

        if (tip) where.tip = tip;
        if (malzemeCinsi) where.malzemeCinsi = malzemeCinsi;

        const dampers = await prisma.damper.findMany({
            where,
            orderBy: { imalatNo: 'desc' }
        });

        const dampersWithStatus = dampers.map(addCalculatedSteps);
        res.json(dampersWithStatus);
    } catch (error) {
        console.error('Error fetching dampers:', error);
        const hint =
            error.code === 'P2021' || error.code === 'P2022'
                ? ' Veritabanı şeması kodla uyumsuz: backend klasöründe önce npx prisma migrate deploy, gerekirse npx prisma db push'
                : '';
        res.status(500).json({ error: `Failed to fetch dampers.${hint}` });
    }
});

// Get single damper - Requires authentication
app.get('/api/dampers/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const damper = await prisma.damper.findUnique({
            where: { id: parseInt(id) }
        });

        if (!damper) {
            return res.status(404).json({ error: 'Damper not found' });
        }

        res.json(addCalculatedSteps(damper));
    } catch (error) {
        console.error('Error fetching damper:', error);
        res.status(500).json({ error: 'Failed to fetch damper' });
    }
});

// Create new damper(s) - creates multiple if adet > 1 - Requires authentication
app.post('/api/dampers', requireAuth, async (req, res) => {
    try {
        const { adet, musteri, productionStartedAt: _ps, ...restData } = req.body;
        const quantity = adet || 1;
        const t0 = parseProductionStartedAt(req.body);

        // If quantity is 1, create single damper
        if (quantity === 1) {
            const damper = await prisma.damper.create({
                data: {
                    ...restData,
                    musteri,
                    adet: 1,
                    productionStartedAt: t0
                }
            });
            await syncStepCompletionEvents(prisma, 'DAMPER', damper.id, null, damper, getDamperTrackedStatus);
            return res.status(201).json(addCalculatedSteps(damper));
        }

        // If quantity > 1, create multiple dampers with numbered names
        const createdDampers = [];
        for (let i = 1; i <= quantity; i++) {
            const damper = await prisma.damper.create({
                data: {
                    ...restData,
                    musteri: `${musteri} ${i}`,
                    adet: 1,
                    productionStartedAt: new Date()
                }
            });
            await syncStepCompletionEvents(prisma, 'DAMPER', damper.id, null, damper, getDamperTrackedStatus);
            createdDampers.push(addCalculatedSteps(damper));
        }

        res.status(201).json(createdDampers);
    } catch (error) {
        console.error('Error creating damper:', error);
        res.status(500).json({ error: 'Failed to create damper', details: String(error) });
    }
});

// Update damper - Requires authentication
app.put('/api/dampers/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id);
        const before = await prisma.damper.findUnique({ where: { id: idNum } });
        if (!before) {
            return res.status(404).json({ error: 'Damper not found' });
        }
        const damper = await prisma.damper.update({
            where: { id: idNum },
            data: omitProductionStartedFromUpdate(req.body)
        });
        await syncStepCompletionEvents(prisma, 'DAMPER', damper.id, before, damper, getDamperTrackedStatus);
        const changes = collectFieldChanges(before, damper);
        if (changes.length > 0) {
            await writeAuditLog(req, {
                action: 'UPDATE',
                productType: 'DAMPER',
                productId: damper.id,
                summary: `Damper güncellendi (#${damper.imalatNo ?? damper.id}, ${changes.length} alan)`,
                details: { changes }
            });
        }
        res.json(addCalculatedSteps(damper));
    } catch (error) {
        console.error('Error updating damper:', error);
        res.status(500).json({ error: 'Failed to update damper' });
    }
});

// Delete damper - Requires authentication
app.delete('/api/dampers/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id);
        await prisma.stepCompletionEvent.deleteMany({
            where: { productType: 'DAMPER', productId: idNum }
        });
        await prisma.damper.delete({
            where: { id: idNum }
        });
        res.json({ message: 'Damper deleted successfully' });
    } catch (error) {
        console.error('Error deleting damper:', error);
        res.status(500).json({ error: 'Failed to delete damper' });
    }
});

// ==================== SASI ROUTES ====================

// Get all sasis - Requires authentication
app.get('/api/sasis', requireAuth, async (req, res) => {
    try {
        const { unlinkedOnly } = req.query;
        let where = {};
        if (unlinkedOnly === 'true') {
            where.dorse = null;
        }

        const sasis = await prisma.sasi.findMany({
            where,
            include: { dorse: true },
            orderBy: { imalatNo: 'desc' }
        });

        const sasisWithStatus = sasis.map(s => {
            const base = addCalculatedSasiSteps(s);
            return {
                ...base,
                isLinked: !!s.dorse,
                linkedDorseId: s.dorse?.id,
                linkedDorseMusteri: s.dorse?.musteri
            };
        });
        res.json(sasisWithStatus);
    } catch (error) {
        console.error('Error fetching sasis:', error);
        res.status(500).json({ error: 'Failed to fetch sasis' });
    }
});

// Get single sasi - Requires authentication
app.get('/api/sasis/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const sasi = await prisma.sasi.findUnique({
            where: { id: parseInt(id) },
            include: { dorse: true }
        });

        if (!sasi) {
            return res.status(404).json({ error: 'Sasi not found' });
        }

        const base = addCalculatedSasiSteps(sasi);
        res.json({
            ...base,
            isLinked: !!sasi.dorse,
            linkedDorseId: sasi.dorse?.id,
            linkedDorseMusteri: sasi.dorse?.musteri
        });
    } catch (error) {
        console.error('Error fetching sasi:', error);
        res.status(500).json({ error: 'Failed to fetch sasi' });
    }
});

// Create sasi with auto-naming - Requires authentication
app.post('/api/sasis', requireAuth, async (req, res) => {
    try {
        const { adet, musteri, ...restData } = req.body;
        const quantity = adet || 1;

        let lastStokNumber = 0;
        if (musteri === 'Stok') {
            const allStokSasis = await prisma.sasi.findMany({
                where: { musteri: { startsWith: 'Stok' } },
                select: { musteri: true }
            });

            let maxNum = 0;
            allStokSasis.forEach(s => {
                const name = s.musteri;
                if (name.startsWith('Stok ')) {
                    const num = parseInt(name.substring(5));
                    if (!isNaN(num) && num > maxNum) maxNum = num;
                }
            });
            lastStokNumber = maxNum;
        }

        const { productionStartedAt: _sps, ...sasiRest } = restData;

        if (quantity === 1) {
            let finalMusteri = musteri;
            if (musteri === 'Stok') finalMusteri = `Stok ${lastStokNumber + 1}`;

            const sasi = await prisma.sasi.create({
                data: {
                    ...sasiRest,
                    musteri: finalMusteri,
                    adet: 1,
                    productionStartedAt: parseProductionStartedAt(req.body)
                }
            });
            await syncStepCompletionEvents(prisma, 'SASI', sasi.id, null, sasi, getSasiTrackedStatus);
            return res.status(201).json(addCalculatedSasiSteps(sasi));
        }

        const createdSasis = [];
        for (let i = 1; i <= quantity; i++) {
            let finalMusteri = musteri;
            if (musteri === 'Stok') finalMusteri = `Stok ${lastStokNumber + i}`;
            else finalMusteri = `${musteri} ${i}`;

            const sasi = await prisma.sasi.create({
                data: {
                    ...sasiRest,
                    musteri: finalMusteri,
                    adet: 1,
                    productionStartedAt: new Date()
                }
            });
            await syncStepCompletionEvents(prisma, 'SASI', sasi.id, null, sasi, getSasiTrackedStatus);
            createdSasis.push(addCalculatedSasiSteps(sasi));
        }
        res.status(201).json(createdSasis);
    } catch (error) {
        console.error('Error creating sasi:', error);
        res.status(500).json({ error: 'Failed to create sasi' });
    }
});

// Update sasi - Requires authentication
app.put('/api/sasis/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id);
        const before = await prisma.sasi.findUnique({ where: { id: idNum } });
        if (!before) {
            return res.status(404).json({ error: 'Sasi not found' });
        }
        const sasi = await prisma.sasi.update({
            where: { id: idNum },
            data: omitProductionStartedFromUpdate(req.body)
        });
        await syncStepCompletionEvents(prisma, 'SASI', sasi.id, before, sasi, getSasiTrackedStatus);
        const sasiChanges = collectFieldChanges(before, sasi);
        if (sasiChanges.length > 0) {
            await writeAuditLog(req, {
                action: 'UPDATE',
                productType: 'SASI',
                productId: sasi.id,
                summary: `Şasi güncellendi (#${sasi.imalatNo ?? sasi.id}, ${sasiChanges.length} alan)`,
                details: { changes: sasiChanges }
            });
        }
        res.json(addCalculatedSasiSteps(sasi));
    } catch (error) {
        console.error('Error updating sasi:', error);
        res.status(500).json({ error: 'Failed to update sasi' });
    }
});

// Delete sasi - Requires authentication
app.delete('/api/sasis/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id);
        await prisma.stepCompletionEvent.deleteMany({
            where: { productType: 'SASI', productId: idNum }
        });
        await prisma.sasi.delete({
            where: { id: idNum }
        });
        res.json({ message: 'Sasi deleted successfully' });
    } catch (error) {
        console.error('Error deleting sasi:', error);
        res.status(500).json({ error: 'Failed to delete sasi' });
    }
});

// Get dorse summary view - Requires authentication
app.get('/api/dorses-summary', requireAuth, async (req, res) => {
    try {
        const dorses = await prisma.dorse.findMany({
            orderBy: { imalatNo: 'desc' },
            include: { sasi: true }
        });

        const summary = dorses.map(dorse => ({
            id: dorse.id,
            imalatNo: dorse.imalatNo,
            musteri: dorse.musteri,
            cekiciGeldiMi: dorse.cekiciGeldiMi,
            dingil: dorse.dingil,
            lastik: dorse.lastik,
            tampon: dorse.tampon,
            kalinlik: dorse.kalinlik,
            m3: dorse.m3,
            adet: dorse.adet,
            sasiNo: dorse.sasiNo,
            kesimBukum: calculateMainDorseStepStatus(dorse, 'kesimBukum'),
            sasiBitis: calculateMainDorseStepStatus(dorse, 'sasiBitis'),
            onHazirlik: calculateMainDorseStepStatus(dorse, 'onHazirlik'),
            montaj: calculateMainDorseStepStatus(dorse, 'montaj'),
            hidrolik: dorse.hidrolik ? 'TAMAMLANDI' : 'BAŞLAMADI', // Standalone step in dorse? Check usage.
            // Wait, hidrolik is part of montaj in backend DORSE_STEP_GROUPS for Dorse?
            // "montaj": subSteps: ['dorseKurulmasi', 'dorseKaynak', 'kapakSiperlik', 'yukleme', 'hidrolik']
            // So 'hidrolik' is inside 'montaj'. But in damper summary it's separate.
            // Let's check DORSE_STEP_GROUPS again in prev view_file.
            // 'montaj' group has 'hidrolik'.
            // In 'damper', 'hidrolik' is a separate GROUP.
            // Let's stick to returning what ozet page expects.
            // If ozet page has 'Hidrolik' column, I should probably expose it or use the group status if it exists.
            // For now, let's map according to DORSE_STEP_GROUPS.
            // Groups are: kesimBukum, sasiBitis, onHazirlik, montaj, boya, tamamlama, sonKontrol.
            // Wait, does Dorse have 'boyaBitis'? The group is named 'boya'.
            boyaBitis: calculateMainDorseStepStatus(dorse, 'boya'),
            tamamlamaBitis: calculateMainDorseStepStatus(dorse, 'tamamlama'),
            sonKontrol: calculateMainDorseStepStatus(dorse, 'sonKontrol'),
            // Specific extra fields if needed:
            kurumMuayenesi: dorse.akmTseMuayenesi || 'YOK', // Map to akmTse?
            dmoMuayenesi: dorse.dmoMuayenesi || 'YOK',
            teslimat: dorse.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI',
            sasi: dorse.sasi ? {
                musteri: dorse.sasi.musteri,
                sasiNo: dorse.sasi.sasiNo,
                imalatNo: dorse.sasi.imalatNo
            } : null
        }));

        res.json(summary);
    } catch (error) {
        console.error('Error fetching dorse summary:', error);
        res.status(500).json({ error: 'Failed to fetch dorse summary' });
    }
});

// Get summary view (only main steps) - Requires authentication
app.get('/api/dampers-summary', requireAuth, async (req, res) => {
    try {
        const dampers = await prisma.damper.findMany({
            orderBy: { imalatNo: 'desc' }
        });

        const summary = dampers.map(damper => ({
            id: damper.id,
            imalatNo: damper.imalatNo,
            musteri: damper.musteri,
            aracGeldiMi: damper.aracGeldiMi,
            aracMarka: damper.aracMarka,
            model: damper.model,
            tip: damper.tip,
            malzemeCinsi: damper.malzemeCinsi,
            m3: damper.m3,
            kesimBukum: calculateMainStepStatus(damper, 'kesimBukum'),
            sasiBitis: calculateMainStepStatus(damper, 'sasiBitis'),
            onHazirlik: calculateMainStepStatus(damper, 'onHazirlik'),
            montaj: calculateMainStepStatus(damper, 'montaj'),
            hidrolik: damper.hidrolik ? 'TAMAMLANDI' : 'BAŞLAMADI',
            boyaBitis: calculateMainStepStatus(damper, 'boyaBitis'),
            tamamlamaBitis: calculateMainStepStatus(damper, 'tamamlamaBitis'),
            sonKontrol: damper.sonKontrol ? 'YAPILDI' : 'BAŞLAMADI',
            kurumMuayenesi: damper.kurumMuayenesi,
            dmoMuayenesi: damper.dmoMuayenesi,
            teslimat: damper.teslimat ? 'YAPILDI' : 'BAŞLAMADI'
        }));

        res.json(summary);
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

// Helper function to extract base company name
function getBaseCompany(name) {
    if (!name) return null;
    let baseName = name.trim().toUpperCase();
    // Remove trailing numbers like "1", "2", etc.
    baseName = baseName.replace(/\s*\d+\s*$/, '');
    // Remove trailing dashes like "EFATUR-1" -> "EFATUR"
    baseName = baseName.replace(/\s*[-_]\s*\d*\s*$/, '');
    return baseName.trim();
}

// Get company summary with step completion stats - Requires authentication
app.get('/api/company-summary', requireAuth, async (req, res) => {
    try {
        const { type } = req.query; // 'DAMPER' or 'DORSE'
        const productType = type === 'DORSE' ? 'DORSE' : 'DAMPER';

        let items;
        if (productType === 'DORSE') {
            items = await prisma.dorse.findMany({ orderBy: { musteri: 'asc' } });
        } else {
            items = await prisma.damper.findMany({ orderBy: { musteri: 'asc' } });
        }

        // All step fields to check
        const damperSteps = [
            'plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'damperSasiPlazmaKesim', 'presBukum',
            'aracBraket', 'damperSasi', 'sasiYukleme',
            'milAltKutuk', 'taban', 'yan', 'onGogus', 'arkaKapak', 'yuklemeMalzemesi',
            'damperKurulmasi', 'damperKaynak', 'sasiKapakSiperlik', 'yukleme',
            'hidrolik', 'boyaHazirlik', 'boya',
            'elektrik', 'hava', 'tamamlama', 'sonKontrol', 'teslimat'
        ];

        const dorseSteps = [
            'plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'presBukum', 'dorseSasi',
            'milAltKutuk', 'taban', 'yan', 'onGogus', 'arkaKapak', 'yuklemeMalzemesi',
            'dorseKurulmasi', 'dorseKaynak', 'kapakSiperlik', 'yukleme', 'hidrolik',
            'boyaHazirlik', 'dorseSasiBoyama',
            'fren', 'dorseElektrik', 'tamamlama', 'cekiciElektrik', 'cekiciHidrolik', 'aracKontrolBypassAyari',
            'sonKontrol', 'tipOnay', 'fatura', 'akmTseMuayenesi', 'dmoMuayenesi', 'tahsilat', 'teslimat'
        ];

        const allSteps = productType === 'DORSE' ? dorseSteps : damperSteps;

        // Initial stats object creator
        const createInitStats = () => {
            if (productType === 'DORSE') {
                return {
                    kesimBukum: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    onHazirlik: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    montaj: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    boya: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    tamamlama: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    sonKontrol: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    kurumMuayenesi: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    dmoMuayenesi: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    teslimat: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 }
                };
            }
            return {
                kesimBukum: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                sasiBitis: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                onHazirlik: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                montaj: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                hidrolik: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                boyaBitis: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                tamamlamaBitis: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                sonKontrol: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                kurumMuayenesi: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                dmoMuayenesi: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                teslimat: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 }
            };
        };

        // Group by base company
        const companyMap = {};

        items.forEach(item => {
            const baseCompany = getBaseCompany(item.musteri);
            if (!baseCompany) return;

            if (!companyMap[baseCompany]) {
                companyMap[baseCompany] = {
                    baseCompany,
                    totalOrders: 0,
                    totalM3: 0,
                    tamamlanan: 0,
                    devamEden: 0,
                    baslamayan: 0,
                    variants: {},
                    m3Groups: {},
                    dampers: [], // Keeping the key 'dampers' for compatibility, but it contains items
                    stepStats: createInitStats()
                };
            }

            const company = companyMap[baseCompany];
            company.totalOrders++;

            // Track M³
            const m3Value = item.m3 || 0;
            company.totalM3 += m3Value;

            // Calculate status
            const completedSteps = allSteps.filter(step => item[step] === true).length;
            const progress = Math.round((completedSteps / allSteps.length) * 100);

            let status;
            if (completedSteps === allSteps.length) {
                status = 'tamamlanan';
                company.tamamlanan++;
            } else if (completedSteps === 0) {
                status = 'baslamayan';
                company.baslamayan++;
            } else {
                status = 'devamEden';
                company.devamEden++;
            }

            // Update step-based statistics
            let stepStatuses;
            if (productType === 'DORSE') {
                stepStatuses = {
                    kesimBukum: calculateMainDorseStepStatus(item, 'kesimBukum'),
                    onHazirlik: calculateMainDorseStepStatus(item, 'onHazirlik'),
                    montaj: calculateMainDorseStepStatus(item, 'montaj'),
                    boya: calculateMainDorseStepStatus(item, 'boya'),
                    tamamlama: calculateMainDorseStepStatus(item, 'tamamlama'),
                    sonKontrol: item.sonKontrol ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    // New Son Kontrol Steps
                    tipOnay: item.tipOnay ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    fatura: item.fatura ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    akmTseMuayenesi: item.akmTseMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    dmoMuayenesi: item.dmoMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    tahsilat: item.tahsilat ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    teslimat: item.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI'
                };
            } else {
                stepStatuses = {
                    kesimBukum: calculateMainStepStatus(item, 'kesimBukum'),
                    sasiBitis: calculateMainStepStatus(item, 'sasiBitis'),
                    onHazirlik: calculateMainStepStatus(item, 'onHazirlik'),
                    montaj: calculateMainStepStatus(item, 'montaj'),
                    hidrolik: item.hidrolik ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    boyaBitis: calculateMainStepStatus(item, 'boyaBitis'),
                    tamamlamaBitis: calculateMainStepStatus(item, 'tamamlamaBitis'),
                    sonKontrol: item.sonKontrol ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    kurumMuayenesi: item.kurumMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    dmoMuayenesi: item.dmoMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    teslimat: item.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI'
                };
            }

            Object.keys(stepStatuses).forEach(stepKey => {
                if (company.stepStats[stepKey]) {
                    company.stepStats[stepKey].total++;
                    const status = stepStatuses[stepKey];
                    if (status === 'TAMAMLANDI') {
                        company.stepStats[stepKey].tamamlandi++;
                    } else if (status === 'DEVAM EDİYOR') {
                        company.stepStats[stepKey].devamEdiyor++;
                    } else {
                        company.stepStats[stepKey].baslamadi++;
                    }
                }
            });

            // Track variant (original customer name)
            if (!company.variants[item.musteri]) {
                company.variants[item.musteri] = {
                    name: item.musteri,
                    total: 0,
                    totalM3: 0,
                    tamamlanan: 0,
                    devamEden: 0,
                    baslamayan: 0
                };
            }
            company.variants[item.musteri].total++;
            company.variants[item.musteri].totalM3 += m3Value;
            company.variants[item.musteri][status]++;

            // Track M³ groups with stepStats
            const m3Key = m3Value.toString();
            if (!company.m3Groups[m3Key]) {
                company.m3Groups[m3Key] = {
                    m3: m3Value,
                    count: 0,
                    tamamlanan: 0,
                    devamEden: 0,
                    baslamayan: 0,
                    stepStats: createInitStats()
                };
            }
            company.m3Groups[m3Key].count++;
            company.m3Groups[m3Key][status]++;

            // Update M³ group stepStats
            Object.keys(stepStatuses).forEach(stepKey => {
                if (company.m3Groups[m3Key].stepStats[stepKey]) {
                    company.m3Groups[m3Key].stepStats[stepKey].total++;
                    const stepStatus = stepStatuses[stepKey];
                    if (stepStatus === 'TAMAMLANDI') {
                        company.m3Groups[m3Key].stepStats[stepKey].tamamlandi++;
                    } else if (stepStatus === 'DEVAM EDİYOR') {
                        company.m3Groups[m3Key].stepStats[stepKey].devamEdiyor++;
                    } else {
                        company.m3Groups[m3Key].stepStats[stepKey].baslamadi++;
                    }
                }
            });

            // Add item info with keys mapped for frontend table
            // We use the same keys as stepStatuses which already handles the difference
            company.dampers.push({
                id: item.id,
                imalatNo: item.imalatNo,
                musteri: item.musteri,
                m3: m3Value,
                progress,
                status,
                ...stepStatuses,
                // Add specific status keys based on type so table can rely on them being present if needed,
                // but simpler to just spread stepStatuses which are the calculated main steps.
                // However, the frontend table expects keys like 'kesimBukumStatus'.
                // calculateMainStepStatus returns a string.
                // We'll add the 'Status' suffix to keys to match frontend expectation
                kesimBukumStatus: stepStatuses.kesimBukum,
                onHazirlikStatus: stepStatuses.onHazirlik,
                montajStatus: stepStatuses.montaj,
                sonKontrolStatus: stepStatuses.sonKontrol,

                // Conditioner fields
                ...(productType === 'DORSE' ? {
                    boyaStatus: stepStatuses.boya,
                    tamamlamaStatus: stepStatuses.tamamlama
                } : {
                    sasiBitisStatus: stepStatuses.sasiBitis,
                    hidrolikStatus: stepStatuses.hidrolik,
                    boyaBitisStatus: stepStatuses.boyaBitis,
                    tamamlamaBitisStatus: stepStatuses.tamamlamaBitis,
                })
            });
        });

        // Convert to array and sort by total orders
        const result = Object.values(companyMap)
            .map(c => ({
                ...c,
                variants: Object.values(c.variants),
                m3Groups: Object.values(c.m3Groups).sort((a, b) => b.m3 - a.m3)
            }))
            .sort((a, b) => b.totalOrders - a.totalOrders);

        res.json(result);
    } catch (error) {
        console.error('Error fetching company summary:', error);
        res.status(500).json({ error: 'Failed to fetch company summary' });
    }
});

// Get dropdown options
app.get('/api/dropdowns', async (req, res) => {
    try {
        const dropdowns = {
            aracGeldiMi: ['EVET', 'HAYIR'],
            tip: ['HAVUZ DAMPER', 'HAVUZ DAMPER + HİDROLİK KAPAK', 'KÖŞELİ DAMPER', 'Ahşap Kasa', 'Lambiri Kasa', '3 Yöne Devirme Damper'],
            malzemeCinsi: ['HARDOX', 'ST52'],
            aracMarka: ['FORD', 'MERCEDES', 'MAN', 'MBT 3342'],
            model: ['3545 D', '3345 K', '1833', '2533 D', '4145 D', '41440'],
            kurumMuayenesi: ['YOK', 'YAPILDI'],
            dmoMuayenesi: ['MUAYENE YOK', 'YAPILDI']
        };
        res.json(dropdowns);
    } catch (error) {
        console.error('Error fetching dropdowns:', error);
        res.status(500).json({ error: 'Failed to fetch dropdowns' });
    }
});

// Get statistics - Requires authentication
app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const { type } = req.query;
        const isDorse = type === 'DORSE';
        const isSasi = type === 'SASI';

        let total, items;
        if (isDorse) {
            total = await prisma.dorse.count();
            items = await prisma.dorse.findMany();
        } else if (isSasi) {
            total = await prisma.sasi.count();
            items = await prisma.sasi.findMany();
        } else {
            total = await prisma.damper.count();
            items = await prisma.damper.findMany();
        }

        let tamamlanan = 0;
        let devamEden = 0;
        let baslamayan = 0;

        // All step fields to check
        const damperSteps = [
            'plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'damperSasiPlazmaKesim', 'presBukum',
            'aracBraket', 'damperSasi', 'sasiYukleme',
            'milAltKutuk', 'taban', 'yan', 'onGogus', 'arkaKapak', 'yuklemeMalzemesi',
            'damperKurulmasi', 'damperKaynak', 'sasiKapakSiperlik', 'yukleme',
            'hidrolik', 'boyaHazirlik', 'boya',
            'elektrik', 'hava', 'tamamlama', 'sonKontrol', 'teslimat'
        ];

        const dorseSteps = [
            'plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'presBukum', 'dorseSasi',
            'milAltKutuk', 'taban', 'yan', 'onGogus', 'arkaKapak', 'yuklemeMalzemesi',
            'dorseKurulmasi', 'dorseKaynak', 'kapakSiperlik', 'yukleme', 'hidrolik',
            'boyaHazirlik', 'dorseSasiBoyama',
            'fren', 'dorseElektrik', 'tamamlama', 'cekiciElektrik', 'cekiciHidrolik', 'aracKontrolBypassAyari',
            'sonKontrol', 'tipOnay', 'fatura', 'akmTseMuayenesi', 'dmoMuayenesi', 'tahsilat', 'teslimat'
        ];

        const sasiSteps = [
            'plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'presBukum',
            'lenjorenMontaji', 'robotKaynagi',
            'saseFiksturCatim', 'kaynak', 'dingilMontaji', 'genelKaynak', 'tesisatCubugu', 'mekanikAyak', 'korukMontaji', 'lastikMontaji'
        ];

        const allSteps = isDorse ? dorseSteps : (isSasi ? sasiSteps : damperSteps);

        items.forEach(item => {
            // Count completed steps
            const completedCount = allSteps.filter(step => {
                if (step === 'akmTseMuayenesi') return item[step] === 'YAPILDI';
                if (step === 'dmoMuayenesi') return item[step] === 'YAPILDI';
                return item[step] === true;
            }).length;
            const totalSteps = allSteps.length;

            if (completedCount === totalSteps) {
                tamamlanan++;
            } else if (completedCount === 0) {
                baslamayan++;
            } else {
                devamEden++;
            }
        });

        if (isSasi) {
            let tamamlananStok = 0;
            let devamEdenStok = 0;
            let tamamlananMusteri = 0;
            let devamEdenMusteri = 0;

            items.forEach(item => {
                const isStok = (item.musteri || '').trim().toLowerCase().startsWith('stok');

                const completedCount = allSteps.filter(step => item[step] === true).length;
                const isCompleted = completedCount === allSteps.length;
                const isStarted = completedCount > 0;

                if (isCompleted) {
                    if (isStok) tamamlananStok++;
                    else tamamlananMusteri++;
                } else if (isStarted) {
                    if (isStok) devamEdenStok++;
                    else devamEdenMusteri++;
                }
            });

            const allUnlinkedSasis = await prisma.sasi.findMany({
                where: { dorse: { is: null } },
                select: { musteri: true }
            });

            const stokCount = allUnlinkedSasis.filter(s => (s.musteri || '').toLowerCase().startsWith('stok')).length;
            const musteriCount = allUnlinkedSasis.length - stokCount;

            return res.json({
                total,
                tamamlanan,
                devamEden,
                baslamayan,
                stokSasiCount: stokCount,
                musteriSasiCount: musteriCount,
                tamamlananStok,
                devamEdenStok,
                tamamlananMusteri,
                devamEdenMusteri
            });
        }

        res.json({
            total,
            tamamlanan,
            devamEden,
            baslamayan
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        const hint =
            error.code === 'P2021' || error.code === 'P2022'
                ? ' Veritabanı şeması kodla uyumsuz: backend klasöründe npx prisma migrate deploy; hâlâ olursa npx prisma db push'
                : '';
        res.status(500).json({ error: `İstatistik alınamadı.${hint}` });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/health/db', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'OK', db: 'up', timestamp: new Date().toISOString() });
    } catch (e) {
        console.error('health db:', e);
        res.status(503).json({ status: 'ERROR', db: 'down', timestamp: new Date().toISOString() });
    }
});

// ==================== ANALYTICS ENDPOINTS ====================

// Get analytics step stats (for charts) - with 3 states: başlanmadı, devam ediyor, tamamlandı
// Get analytics step stats (for charts) - with 3 states
app.get('/api/analytics/step-stats', requireAuth, async (req, res) => {
    try {
        const { type } = req.query;
        const productType = type === 'DORSE' ? 'DORSE' : 'DAMPER';

        let items;
        if (productType === 'DORSE') {
            items = await prisma.dorse.findMany();
        } else {
            items = await prisma.damper.findMany();
        }

        // Helper to initialize stats structure
        const createInitStats = () => {
            if (productType === 'DORSE') {
                return {
                    kesimBukum: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    onHazirlik: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    montaj: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    boya: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    tamamlama: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    sonKontrol: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    tipOnay: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    fatura: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    kurumMuayenesi: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    dmoMuayenesi: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    tahsilat: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                    teslimat: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 }
                };
            }
            return {
                kesimBukum: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                sasiBitis: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                onHazirlik: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                montaj: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                hidrolik: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                boyaBitis: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                tamamlamaBitis: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                sonKontrol: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                kurumMuayenesi: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                dmoMuayenesi: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 },
                teslimat: { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 }
            };
        };

        const stepStats = createInitStats();
        const m3StepStats = {}; // Objects keyed by M3 string (e.g. "16", "18")

        // Helper to update a stats object based on an item
        const updateStats = (stats, stepStatuses) => {
            Object.keys(stepStatuses).forEach(stepKey => {
                if (stats[stepKey]) {
                    const status = stepStatuses[stepKey];
                    stats[stepKey].total++;
                    if (status === 'TAMAMLANDI') {
                        stats[stepKey].tamamlandi++;
                    } else if (status === 'DEVAM EDİYOR') {
                        stats[stepKey].devamEdiyor++;
                    } else {
                        stats[stepKey].baslamadi++;
                    }
                }
            });
        };

        items.forEach(item => {
            console.log(`DEBUG: Processing ${productType} ID ${item.id}`);
            let stepStatuses;
            if (productType === 'DORSE') {
                stepStatuses = {
                    kesimBukum: calculateMainDorseStepStatus(item, 'kesimBukum'),
                    onHazirlik: calculateMainDorseStepStatus(item, 'onHazirlik'),
                    montaj: calculateMainDorseStepStatus(item, 'montaj'),
                    boya: calculateMainDorseStepStatus(item, 'boya'),
                    tamamlama: calculateMainDorseStepStatus(item, 'tamamlama'),
                    sonKontrol: item.sonKontrol ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    kurumMuayenesi: item.akmTseMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    dmoMuayenesi: item.dmoMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    teslimat: item.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI'
                };
                console.log(`DEBUG: Dorse ID ${item.id} statuses:`, JSON.stringify(stepStatuses));
            } else {
                stepStatuses = {
                    kesimBukum: calculateMainStepStatus(item, 'kesimBukum'),
                    sasiBitis: calculateMainStepStatus(item, 'sasiBitis'),
                    onHazirlik: calculateMainStepStatus(item, 'onHazirlik'),
                    montaj: calculateMainStepStatus(item, 'montaj'),
                    hidrolik: item.hidrolik ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    boyaBitis: calculateMainStepStatus(item, 'boyaBitis'),
                    tamamlamaBitis: calculateMainStepStatus(item, 'tamamlamaBitis'),
                    sonKontrol: item.sonKontrol ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    kurumMuayenesi: item.kurumMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    dmoMuayenesi: item.dmoMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                    teslimat: item.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI'
                };
            }

            // Update Total Stats
            updateStats(stepStats, stepStatuses);

            // Update M3 Group Stats
            const m3Value = item.m3 || 0;
            const m3Key = m3Value.toString();

            if (!m3StepStats[m3Key]) {
                m3StepStats[m3Key] = createInitStats();
            }
            updateStats(m3StepStats[m3Key], stepStatuses);
        });

        res.json({
            total: stepStats,
            byM3: m3StepStats
        });
    } catch (error) {
        console.error('Error fetching analytics step stats:', error);
        res.status(500).json({ error: 'Failed to fetch analytics step stats' });
    }
});

// Get company distribution for pie chart
// Get company distribution for pie chart - Requires authentication
app.get('/api/analytics/company-distribution', requireAuth, async (req, res) => {
    try {
        const { type } = req.query;
        const isDorse = type === 'DORSE';

        let items;
        if (isDorse) {
            items = await prisma.dorse.findMany();
        } else {
            items = await prisma.damper.findMany();
        }

        const companyMap = {};
        items.forEach(item => {
            const baseCompany = getBaseCompany(item.musteri);
            if (baseCompany) {
                companyMap[baseCompany] = (companyMap[baseCompany] || 0) + 1;
            }
        });

        const distribution = Object.entries(companyMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8); // Top 8 companies

        res.json(distribution);
    } catch (error) {
        console.error('Error fetching company distribution:', error);
        res.status(500).json({ error: 'Failed to fetch company distribution' });
    }
});

// Get recent activity (today's updated dampers that have actual work done)
// Get recent activity (today's updated items that have actual work done) - Requires authentication
app.get('/api/analytics/recent-activity', requireAuth, async (req, res) => {
    try {
        const { type } = req.query;
        const productType = type === 'DORSE' ? 'DORSE' : 'DAMPER';

        // Get start of today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let recentItems = [];
        if (productType === 'DORSE') {
            recentItems = await prisma.dorse.findMany({
                where: { updatedAt: { gte: today } },
                orderBy: { updatedAt: 'desc' },
                take: 50
            });
        } else {
            recentItems = await prisma.damper.findMany({
                where: { updatedAt: { gte: today } },
                orderBy: { updatedAt: 'desc' },
                take: 50
            });
        }

        const activity = recentItems.map(item => {
            let kesimBukumStatus, montajStatus, boyaBitisStatus, teslimatStatus, hasProgress, completedSubSteps;

            if (productType === 'DORSE') {
                kesimBukumStatus = calculateMainDorseStepStatus(item, 'kesimBukum');
                montajStatus = calculateMainDorseStepStatus(item, 'montaj');
                boyaBitisStatus = calculateMainDorseStepStatus(item, 'boya');
                teslimatStatus = item.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI';

                // Check progress
                hasProgress =
                    kesimBukumStatus !== 'BAŞLAMADI' ||
                    montajStatus !== 'BAŞLAMADI' ||
                    boyaBitisStatus !== 'BAŞLAMADI' ||
                    teslimatStatus !== 'BAŞLAMADI' ||
                    item.sonKontrol === true;

                completedSubSteps = [];
                // Kesim-Büküm
                if (item.plazmaProgrami) completedSubSteps.push('Plazma Programı');
                if (item.sacMalzemeKontrolu) completedSubSteps.push('Sac Malzeme Kontrolü');
                if (item.plazmaKesim) completedSubSteps.push('Plazma Kesim');
                if (item.presBukum) completedSubSteps.push('Pres Büküm');
                if (item.dorseSasi) completedSubSteps.push('Dorse Şasi');

                // Ön Hazırlık
                if (item.milAltKutuk) completedSubSteps.push('Mil Alt Kütük');
                if (item.taban) completedSubSteps.push('Taban');
                if (item.yan) completedSubSteps.push('Yan');
                if (item.onGogus) completedSubSteps.push('Ön Göğüs');
                if (item.arkaKapak) completedSubSteps.push('Arka Kapak');
                if (item.yuklemeMalzemesi) completedSubSteps.push('Yükleme Malzemesi');

                // Montaj
                if (item.dorseKurulmasi) completedSubSteps.push('Dorse Kurulması');
                if (item.dorseKaynak) completedSubSteps.push('Dorse Kaynak');
                if (item.kapakSiperlik) completedSubSteps.push('Kapak Siperlik');
                if (item.yukleme) completedSubSteps.push('Yükleme');
                if (item.hidrolik) completedSubSteps.push('Hidrolik');

                // Boya
                if (item.boyaHazirlik) completedSubSteps.push('Boya Hazırlık');
                if (item.dorseSasiBoyama) completedSubSteps.push('Dorse Şasi Boyama');

                // Tamamlama
                if (item.fren) completedSubSteps.push('Fren');
                if (item.dorseElektrik) completedSubSteps.push('Dorse Elektrik');
                if (item.tamamlama) completedSubSteps.push('Tamamlama');
                if (item.cekiciElektrik) completedSubSteps.push('Çekici Elektrik');
                if (item.cekiciHidrolik) completedSubSteps.push('Çekici Hidrolik');
                if (item.aracKontrolBypassAyari) completedSubSteps.push('Araç Kontrol Bypass Ayarı');

                if (item.sonKontrol) completedSubSteps.push('Son Kontrol');
                if (item.tipOnay) completedSubSteps.push('Tip Onay');
                if (item.fatura) completedSubSteps.push('Fatura');
                if (item.akmTseMuayenesi === 'YAPILDI') completedSubSteps.push('AKM-TSE Muayenesi');
                if (item.dmoMuayenesi === 'YAPILDI') completedSubSteps.push('DMO Muayenesi');
                if (item.tahsilat) completedSubSteps.push('Tahsilat');
                if (item.teslimat) completedSubSteps.push('Teslimat ✅');

            } else {
                // DAMPER LOGIC (Existing)
                kesimBukumStatus = calculateMainStepStatus(item, 'kesimBukum');
                montajStatus = calculateMainStepStatus(item, 'montaj');
                boyaBitisStatus = calculateMainStepStatus(item, 'boyaBitis');
                teslimatStatus = item.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI';

                hasProgress =
                    kesimBukumStatus !== 'BAŞLAMADI' ||
                    montajStatus !== 'BAŞLAMADI' ||
                    boyaBitisStatus !== 'BAŞLAMADI' ||
                    teslimatStatus !== 'BAŞLAMADI' ||
                    item.hidrolik === true ||
                    item.sonKontrol === true;

                completedSubSteps = [];
                // Kesim-Büküm
                if (item.plazmaProgrami) completedSubSteps.push('Plazma Programı (Kesim-Büküm)');
                if (item.sacMalzemeKontrolu) completedSubSteps.push('Sac Malzeme Kontrolü (Kesim-Büküm)');
                if (item.plazmaKesim) completedSubSteps.push('Plazma Kesim (Kesim-Büküm)');
                if (item.damperSasiPlazmaKesim) completedSubSteps.push('Damper Şasi Plazma Kesim (Kesim-Büküm)');
                if (item.presBukum) completedSubSteps.push('Pres Büküm (Kesim-Büküm)');

                // Şasi Bitiş
                if (item.aracBraket) completedSubSteps.push('Araç Braket (Şasi Bitiş)');
                if (item.damperSasi) completedSubSteps.push('Damper Şasi (Şasi Bitiş)');
                if (item.sasiYukleme) completedSubSteps.push('Şasi Yükleme (Şasi Bitiş)');

                // Ön Hazırlık
                if (item.milAltKutuk) completedSubSteps.push('Mil Alt Kütük (Ön Hazırlık)');
                if (item.taban) completedSubSteps.push('Taban (Ön Hazırlık)');
                if (item.yan) completedSubSteps.push('Yan (Ön Hazırlık)');
                if (item.onGogus) completedSubSteps.push('Ön Göğüs (Ön Hazırlık)');
                if (item.arkaKapak) completedSubSteps.push('Arka Kapak (Ön Hazırlık)');
                if (item.yuklemeMalzemesi) completedSubSteps.push('Yükleme Malzemesi (Ön Hazırlık)');

                // Montaj
                if (item.damperKurulmasi) completedSubSteps.push('Damper Kurulması (Montaj)');
                if (item.damperKaynak) completedSubSteps.push('Damper Kaynak (Montaj)');
                if (item.sasiKapakSiperlik) completedSubSteps.push('Şasi Kapak Siperlik (Montaj)');
                if (item.yukleme) completedSubSteps.push('Yükleme (Montaj)');

                // Diğer
                if (item.hidrolik) completedSubSteps.push('Hidrolik');
                if (item.boyaHazirlik) completedSubSteps.push('Boya Hazırlık (Boya)');
                if (item.boya) completedSubSteps.push('Boya (Boya)');
                if (item.elektrik) completedSubSteps.push('Elektrik (Tamamlama)');
                if (item.hava) completedSubSteps.push('Hava (Tamamlama)');
                if (item.tamamlama) completedSubSteps.push('Tamamlama (Tamamlama)');
                if (item.sonKontrol) completedSubSteps.push('Son Kontrol');
                if (item.teslimat) completedSubSteps.push('Teslimat ✅');
            }

            return {
                id: item.id,
                imalatNo: item.imalatNo,
                musteri: item.musteri,
                updatedAt: item.updatedAt,
                kesimBukumStatus,
                montajStatus,
                boyaBitisStatus,
                teslimatStatus,
                completedSubSteps,
                hasProgress
            };
        });

        const activeWork = activity.filter(a => a.hasProgress);

        res.json(activeWork.slice(0, 20));
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
});

// Delete dampers/dorses by Company and M3 - Requires authentication
app.delete('/api/company-m3', requireAuth, async (req, res) => {
    try {
        const { companyName, m3, type = 'DAMPER' } = req.body;

        if (!companyName || m3 === undefined) {
            return res.status(400).json({ error: 'Company name and M3 value are required' });
        }

        const isDorse = type === 'DORSE';
        const prismaModel = isDorse ? prisma.dorse : prisma.damper;

        // Fetch items that might match to filter them in memory
        // Optimization: rough filter by name first
        const potentialItems = await prismaModel.findMany({
            where: {
                musteri: {
                    contains: companyName,
                    mode: 'insensitive'
                },
                m3: m3
            }
        });

        // Filter using the exact same logic as the summary view
        const targetIds = potentialItems
            .filter(d => getBaseCompany(d.musteri) === companyName)
            .map(d => d.id);

        if (targetIds.length > 0) {
            await prismaModel.deleteMany({
                where: {
                    id: {
                        in: targetIds
                    }
                }
            });
        }

        res.json({ message: `${isDorse ? 'Dorses' : 'Dampers'} deleted successfully`, deletedCount: targetIds.length });
    } catch (error) {
        console.error('Error deleting company M3 group:', error);
        res.status(500).json({ error: 'Failed to delete company M3 group' });
    }
});

// ==================== DORSE ROUTES ====================

// Get all dorses - Requires authentication
app.get('/api/dorses', requireAuth, async (req, res) => {
    try {
        const dorses = await prisma.dorse.findMany({
            orderBy: { imalatNo: 'desc' },
            include: { sasi: true }
        });
        res.json(dorses);
    } catch (error) {
        console.error('Error fetching dorses:', error);
        const hint =
            error.code === 'P2021' || error.code === 'P2022'
                ? ' Veritabanı şeması kodla uyumsuz: backend klasöründe önce npx prisma migrate deploy, gerekirse npx prisma db push'
                : '';
        res.status(500).json({ error: `Failed to fetch dorses.${hint}` });
    }
});

// Create new dorse - Requires authentication
app.post('/api/dorses', requireAuth, async (req, res) => {
    try {
        const { adet, musteri, sasiId, productionStartedAt: _dps, ...restData } = req.body;
        const quantity = adet || 1;
        const t0 = parseProductionStartedAt(req.body);

        if (quantity === 1) {
            const dorse = await prisma.dorse.create({
                data: {
                    ...restData,
                    musteri,
                    adet: 1,
                    sasiId: sasiId ? parseInt(sasiId) : null,
                    productionStartedAt: t0
                },
                include: { sasi: true }
            });
            await syncStepCompletionEvents(prisma, 'DORSE', dorse.id, null, dorse, getDorseTrackedStatus);
            return res.status(201).json(dorse);
        }

        const createdDorses = [];
        for (let i = 1; i <= quantity; i++) {
            const dorse = await prisma.dorse.create({
                data: {
                    ...restData,
                    musteri: `${musteri} ${i}`,
                    adet: 1,
                    productionStartedAt: new Date()
                }
            });
            await syncStepCompletionEvents(prisma, 'DORSE', dorse.id, null, dorse, getDorseTrackedStatus);
            createdDorses.push(dorse);
        }

        res.status(201).json(createdDorses);
    } catch (error) {
        console.error('Error creating dorse:', error);
        res.status(500).json({ error: 'Failed to create dorse' });
    }
});

// Update dorse - Requires authentication
app.put('/api/dorses/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id);
        const before = await prisma.dorse.findUnique({ where: { id: idNum } });
        if (!before) {
            return res.status(404).json({ error: 'Dorse not found' });
        }
        const dorse = await prisma.dorse.update({
            where: { id: idNum },
            data: omitProductionStartedFromUpdate(req.body)
        });
        await syncStepCompletionEvents(prisma, 'DORSE', dorse.id, before, dorse, getDorseTrackedStatus);
        const dorseChanges = collectFieldChanges(before, dorse);
        if (dorseChanges.length > 0) {
            await writeAuditLog(req, {
                action: 'UPDATE',
                productType: 'DORSE',
                productId: dorse.id,
                summary: `Dorse güncellendi (#${dorse.imalatNo ?? dorse.id}, ${dorseChanges.length} alan)`,
                details: { changes: dorseChanges }
            });
        }
        res.json(dorse);
    } catch (error) {
        console.error('Error updating dorse:', error);
        res.status(500).json({ error: 'Failed to update dorse' });
    }
});

// Delete dorse - Requires authentication
app.delete('/api/dorses/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const idNum = parseInt(id);
        await prisma.stepCompletionEvent.deleteMany({
            where: { productType: 'DORSE', productId: idNum }
        });
        await prisma.dorse.delete({
            where: { id: idNum }
        });
        res.json({ message: 'Dorse deleted successfully' });
    } catch (error) {
        console.error('Error deleting dorse:', error);
        res.status(500).json({ error: 'Failed to delete dorse' });
    }
});

// Link Sasi to Dorse - Requires authentication
app.put('/api/dorses/:id/link-sasi', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { sasiId } = req.body;

        if (!sasiId) {
            // Unlink if sasiId is null/undefined?
            const dorse = await prisma.dorse.update({
                where: { id: parseInt(id) },
                data: { sasiId: null },
                include: { sasi: true }
            });
            return res.json(dorse);
        }

        // Check if sasi is already linked
        const existingLink = await prisma.dorse.findUnique({
            where: { sasiId: parseInt(sasiId) }
        });

        if (existingLink && existingLink.id !== parseInt(id)) {
            return res.status(400).json({ error: 'Bu şasi zaten başka bir dorseye bağlı' });
        }

        const dorse = await prisma.dorse.update({
            where: { id: parseInt(id) },
            data: { sasiId: parseInt(sasiId) },
            include: { sasi: true }
        });

        res.json(dorse);
    } catch (error) {
        console.error('Error linking sasi:', error);
        res.status(500).json({ error: 'Şasi bağlanamadı' });
    }
});

// Update dorse detail to include sasi - Requires authentication
app.get('/api/dorses/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const dorse = await prisma.dorse.findUnique({
            where: { id: parseInt(id) },
            include: { sasi: true }
        });

        if (!dorse) {
            return res.status(404).json({ error: 'Dorse not found' });
        }

        res.json(dorse);
    } catch (error) {
        console.error('Error fetching dorse:', error);
        res.status(500).json({ error: 'Failed to fetch dorse' });
    }
});

async function loadAdetMapForVerimlilik(productType, productIds) {
    const map = {};
    if (!productIds.length) return map;
    if (productType === 'DAMPER') {
        const rows = await prisma.damper.findMany({
            where: { id: { in: productIds } },
            select: { id: true, adet: true }
        });
        rows.forEach(r => { map[r.id] = r.adet || 1; });
    } else if (productType === 'DORSE') {
        const rows = await prisma.dorse.findMany({
            where: { id: { in: productIds } },
            select: { id: true, adet: true }
        });
        rows.forEach(r => { map[r.id] = r.adet || 1; });
    } else {
        const rows = await prisma.sasi.findMany({
            where: { id: { in: productIds } },
            select: { id: true, adet: true }
        });
        rows.forEach(r => { map[r.id] = r.adet || 1; });
    }
    return map;
}

async function throughputForVerimlilikRange(productType, fromDate, toDate) {
    let events;
    try {
        events = await prisma.stepCompletionEvent.findMany({
            where: {
                productType,
                completedAt: { gte: fromDate, lt: toDate }
            },
            select: { productId: true, mainStepKey: true }
        });
    } catch (err) {
        if (err.code === 'P2021') {
            console.error(
                'StepCompletionEvent tablosu yok. Veritabanında çalıştırın: npx prisma migrate deploy'
            );
            return {};
        }
        throw err;
    }
    const ids = [...new Set(events.map(e => e.productId))];
    const adetMap = await loadAdetMapForVerimlilik(productType, ids);
    const byStep = {};
    for (const e of events) {
        const w = adetMap[e.productId] ?? 1;
        byStep[e.mainStepKey] = (byStep[e.mainStepKey] || 0) + w;
    }
    return byStep;
}

async function computeVerimlilikReport(productType, fromDate, toDate) {
    const ms = toDate.getTime() - fromDate.getTime();
    const prevTo = new Date(fromDate.getTime());
    const prevFrom = new Date(fromDate.getTime() - ms);

    const current = await throughputForVerimlilikRange(productType, fromDate, toDate);
    const previous = await throughputForVerimlilikRange(productType, prevFrom, prevTo);

    let capCurrent = {};
    let capPrev = {};
    let targetCurrentRaw = {};
    let targetPrevRaw = {};
    try {
        capCurrent = await aggregateCapacityForRange(prisma, productType, fromDate, toDate);
        capPrev = await aggregateCapacityForRange(prisma, productType, prevFrom, prevTo);
    } catch (err) {
        if (err.code === 'P2021') {
            console.error('DepartmentWeekCapacity tablosu eksik; kapasite 0 kabul edildi. migrate deploy çalıştırın.');
        } else {
            throw err;
        }
    }
    try {
        targetCurrentRaw = await aggregateTargetForRange(prisma, productType, fromDate, toDate);
        targetPrevRaw = await aggregateTargetForRange(prisma, productType, prevFrom, prevTo);
    } catch (err) {
        if (err.code === 'P2021') {
            console.error('WeeklyStepTarget tablosu eksik; hedef 0 kabul edildi. migrate deploy çalıştırın.');
        } else {
            throw err;
        }
    }

    const keys = TRACKED_MAIN_STEPS[productType] || [];
    const labels = STEP_LABELS[productType] || {};

    const steps = keys.map(key => {
        const cur = current[key] || 0;
        const prev = previous[key] || 0;
        const delta = cur - prev;
        let deltaPercent = null;
        if (prev > 0) {
            deltaPercent = Math.round((delta / prev) * 1000) / 10;
        } else if (cur > 0) {
            deltaPercent = null;
        } else {
            deltaPercent = 0;
        }

        const c = capCurrent[key] || { normalHours: 0, overtimeHours: 0, headcountWeighted: 0, weightSum: 0 };
        const pCap = capPrev[key] || { normalHours: 0, overtimeHours: 0, headcountWeighted: 0, weightSum: 0 };
        const capNorm = Math.round(c.normalHours * 100) / 100;
        const capOt = Math.round(c.overtimeHours * 100) / 100;
        const capTotal = Math.round((capNorm + capOt) * 100) / 100;
        const efficiency = capTotal > 0 ? Math.round((cur / capTotal) * 10000) / 10000 : null;

        const prevCapTotal = Math.round((pCap.normalHours + pCap.overtimeHours) * 100) / 100;
        const previousEfficiency = prevCapTotal > 0 ? Math.round((prev / prevCapTotal) * 10000) / 10000 : null;

        const avgHeadcount = c.weightSum > 0 ? Math.round((c.headcountWeighted / c.weightSum) * 10) / 10 : null;

        const tgtCur = Math.round((targetCurrentRaw[key] || 0) * 100) / 100;
        const tgtPrev = Math.round((targetPrevRaw[key] || 0) * 100) / 100;
        const targetInPeriod = tgtCur > 0 ? tgtCur : null;
        const previousTargetInPeriod = tgtPrev > 0 ? tgtPrev : null;
        const targetVariance =
            targetInPeriod != null ? Math.round((cur - targetInPeriod) * 100) / 100 : null;
        const previousTargetVariance =
            previousTargetInPeriod != null ? Math.round((prev - previousTargetInPeriod) * 100) / 100 : null;

        return {
            mainStepKey: key,
            label: labels[key] || key,
            current: cur,
            previous: prev,
            delta,
            deltaPercent,
            capacityNormalHours: capTotal > 0 ? capNorm : null,
            capacityOvertimeHours: capTotal > 0 ? capOt : null,
            capacityTotalHours: capTotal > 0 ? capTotal : null,
            efficiency,
            previousCapacityTotalHours: prevCapTotal > 0 ? prevCapTotal : null,
            previousEfficiency,
            avgHeadcountInPeriod: avgHeadcount,
            targetInPeriod,
            previousTargetInPeriod,
            targetVariance,
            previousTargetVariance
        };
    });

    const trackedProductCountWithT0 = productType === 'DAMPER'
        ? await prisma.damper.count({ where: { productionStartedAt: { not: null } } })
        : productType === 'DORSE'
            ? await prisma.dorse.count({ where: { productionStartedAt: { not: null } } })
            : await prisma.sasi.count({ where: { productionStartedAt: { not: null } } });

    return {
        productType,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        previousFrom: prevFrom.toISOString(),
        previousTo: prevTo.toISOString(),
        steps,
        trackedProductCountWithT0,
        scheduleDefaults: {
            workDaysPerWeek: WORK_DAYS_PER_WEEK,
            netHoursPerDay: NET_HOURS_PER_DAY,
            hoursPerPersonWeek: HOURS_PER_PERSON_WEEK,
            description: SCHEDULE_DESCRIPTION
        }
    };
}

// Verimlilik: bölüm bazlı tamamlanan adet (T0’lu yeni kayıtların olayları), önceki dönemle kıyas + kapasite
app.get('/api/capacity/defaults', requireAuth, (req, res) => {
    res.json({
        workDaysPerWeek: WORK_DAYS_PER_WEEK,
        netHoursPerDay: NET_HOURS_PER_DAY,
        hoursPerPersonWeek: HOURS_PER_PERSON_WEEK,
        description: SCHEDULE_DESCRIPTION
    });
});

app.get('/api/capacity/week', requireAuth, async (req, res) => {
    try {
        const { type, weekStart } = req.query;
        const productType = type === 'DORSE' ? 'DORSE' : type === 'SASI' ? 'SASI' : 'DAMPER';
        if (!weekStart || typeof weekStart !== 'string') {
            return res.status(400).json({ error: 'weekStart gerekli (YYYY-MM-DD)' });
        }
        const mon = mondayOfUtcWeekContaining(new Date(`${weekStart}T12:00:00.000Z`));
        const key = weekStartToDateKey(mon);
        const weekDate = new Date(`${key}T12:00:00.000Z`);

        const keys = TRACKED_MAIN_STEPS[productType] || [];
        const labels = STEP_LABELS[productType] || {};
        const [dbRows, targetRows] = await Promise.all([
            prisma.departmentWeekCapacity.findMany({
                where: { productType, weekStart: weekDate }
            }),
            prisma.weeklyStepTarget.findMany({
                where: { productType, weekStart: weekDate }
            })
        ]);
        const map = Object.fromEntries(dbRows.map(r => [r.mainStepKey, r]));
        const targetMap = Object.fromEntries(targetRows.map(r => [r.mainStepKey, r]));

        const rows = keys.map(mainStepKey => {
            const r = map[mainStepKey];
            const t = targetMap[mainStepKey];
            return {
                mainStepKey,
                label: labels[mainStepKey] || mainStepKey,
                headcount: r?.headcount ?? 0,
                normalHours: r?.normalHours ?? 0,
                overtimeHours: r?.overtimeHours ?? 0,
                targetCount: t?.targetCount ?? 0
            };
        });

        res.json({
            productType,
            weekStart: key,
            hoursPerPersonWeek: HOURS_PER_PERSON_WEEK,
            rows
        });
    } catch (error) {
        console.error('Error fetching capacity week:', error);
        res.status(500).json({ error: 'Kapasite verisi alınamadı' });
    }
});

app.put('/api/capacity/week', requireAuth, async (req, res) => {
    try {
        const { productType, weekStart, mainStepKey, headcount, normalHours, overtimeHours } = req.body;
        if (!productType || !weekStart || !mainStepKey) {
            return res.status(400).json({ error: 'productType, weekStart, mainStepKey gerekli' });
        }
        const mon = mondayOfUtcWeekContaining(new Date(`${weekStart}T12:00:00.000Z`));
        const key = weekStartToDateKey(mon);
        const weekDate = new Date(`${key}T12:00:00.000Z`);

        const hc = parseInt(String(headcount), 10);
        const nh = parseFloat(String(normalHours));
        const oh = parseFloat(String(overtimeHours));

        const row = await prisma.departmentWeekCapacity.upsert({
            where: {
                productType_mainStepKey_weekStart: {
                    productType,
                    mainStepKey,
                    weekStart: weekDate
                }
            },
            create: {
                productType,
                mainStepKey,
                weekStart: weekDate,
                headcount: Number.isFinite(hc) ? hc : 0,
                normalHours: Number.isFinite(nh) ? nh : 0,
                overtimeHours: Number.isFinite(oh) ? oh : 0
            },
            update: {
                headcount: Number.isFinite(hc) ? hc : 0,
                normalHours: Number.isFinite(nh) ? nh : 0,
                overtimeHours: Number.isFinite(oh) ? oh : 0
            }
        });
        res.json(row);
    } catch (error) {
        console.error('Error upserting capacity week:', error);
        res.status(500).json({ error: 'Kapasite kaydedilemedi' });
    }
});

app.delete('/api/capacity/week', requireAuth, async (req, res) => {
    try {
        const { type, weekStart, mainStepKey } = req.query;
        const productType = type === 'DORSE' ? 'DORSE' : type === 'SASI' ? 'SASI' : 'DAMPER';
        if (!weekStart || !mainStepKey) {
            return res.status(400).json({ error: 'weekStart ve mainStepKey gerekli' });
        }
        const mon = mondayOfUtcWeekContaining(new Date(`${weekStart}T12:00:00.000Z`));
        const key = weekStartToDateKey(mon);
        const weekDate = new Date(`${key}T12:00:00.000Z`);

        await prisma.departmentWeekCapacity.deleteMany({
            where: { productType, mainStepKey, weekStart: weekDate }
        });
        res.json({ ok: true });
    } catch (error) {
        console.error('Error deleting capacity week:', error);
        res.status(500).json({ error: 'Kapasite silinemedi' });
    }
});

app.put('/api/capacity/target', requireAuth, async (req, res) => {
    try {
        const { productType, weekStart, mainStepKey, targetCount } = req.body;
        if (!productType || !weekStart || !mainStepKey) {
            return res.status(400).json({ error: 'productType, weekStart, mainStepKey gerekli' });
        }
        const mon = mondayOfUtcWeekContaining(new Date(`${weekStart}T12:00:00.000Z`));
        const key = weekStartToDateKey(mon);
        const weekDate = new Date(`${key}T12:00:00.000Z`);
        const tc = parseInt(String(targetCount), 10);
        const row = await prisma.weeklyStepTarget.upsert({
            where: {
                productType_mainStepKey_weekStart: {
                    productType,
                    mainStepKey,
                    weekStart: weekDate
                }
            },
            create: {
                productType,
                mainStepKey,
                weekStart: weekDate,
                targetCount: Number.isFinite(tc) ? tc : 0
            },
            update: {
                targetCount: Number.isFinite(tc) ? tc : 0
            }
        });
        res.json(row);
    } catch (error) {
        console.error('Error upserting weekly target:', error);
        res.status(500).json({ error: 'Hedef kaydedilemedi' });
    }
});

app.delete('/api/capacity/target', requireAuth, async (req, res) => {
    try {
        const { type, weekStart, mainStepKey } = req.query;
        const productType = type === 'DORSE' ? 'DORSE' : type === 'SASI' ? 'SASI' : 'DAMPER';
        if (!weekStart || !mainStepKey) {
            return res.status(400).json({ error: 'weekStart ve mainStepKey gerekli' });
        }
        const mon = mondayOfUtcWeekContaining(new Date(`${weekStart}T12:00:00.000Z`));
        const key = weekStartToDateKey(mon);
        const weekDate = new Date(`${key}T12:00:00.000Z`);
        await prisma.weeklyStepTarget.deleteMany({
            where: { productType, mainStepKey, weekStart: weekDate }
        });
        res.json({ ok: true });
    } catch (error) {
        console.error('Error deleting weekly target:', error);
        res.status(500).json({ error: 'Hedef silinemedi' });
    }
});

app.get('/api/audit-logs', requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
        const skip = Math.max(0, parseInt(String(req.query.skip || '0'), 10) || 0);
        const { productType, productId } = req.query;
        const where = {};
        if (productType && typeof productType === 'string') where.productType = productType;
        if (productId != null && productId !== '') {
            const pid = parseInt(String(productId), 10);
            if (Number.isFinite(pid)) where.productId = pid;
        }
        const [rows, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
                include: { user: { select: { username: true, fullName: true } } }
            }),
            prisma.auditLog.count({ where })
        ]);
        res.json({ rows, total, limit, skip });
    } catch (error) {
        console.error('Error listing audit logs:', error);
        res.status(500).json({ error: 'Denetim kayıtları alınamadı' });
    }
});

app.get('/api/search', requireAuth, async (req, res) => {
    try {
        const raw = (req.query.q || '').trim();
        if (raw.length < 2) {
            return res.status(400).json({ error: 'En az 2 karakter girin' });
        }
        const take = 15;
        const patList = buildSearchPatList(raw);
        const digitOnly = /^\d+$/.test(raw);
        const num = digitOnly ? parseInt(raw, 10) : NaN;

        const mapRow = (r) => ({
            id: Number(r.id),
            imalatNo: r.imalatNo != null ? Number(r.imalatNo) : null,
            musteri: r.musteri,
            sasiNo: r.sasiNo
        });

        const whereDamper = buildDamperSearchWhere(patList, num);
        const whereDorse = buildDorseSearchWhere(patList, num);
        const whereSasi = buildSasiSearchWhere(patList, num);

        const [dampers, dorses, sasis] = await Promise.all([
            prisma.$queryRaw`
                SELECT id, "imalatNo", musteri, "sasiNo"
                FROM "Damper"
                WHERE ${whereDamper}
                ORDER BY "updatedAt" DESC
                LIMIT ${take}
            `,
            prisma.$queryRaw`
                SELECT id, "imalatNo", musteri, "sasiNo"
                FROM "Dorse"
                WHERE ${whereDorse}
                ORDER BY "updatedAt" DESC
                LIMIT ${take}
            `,
            prisma.$queryRaw`
                SELECT id, "imalatNo", musteri, "sasiNo"
                FROM "Sasi"
                WHERE ${whereSasi}
                ORDER BY "updatedAt" DESC
                LIMIT ${take}
            `
        ]);

        res.json({
            q: raw,
            dampers: dampers.map((d) => ({ productType: 'DAMPER', ...mapRow(d) })),
            dorses: dorses.map((d) => ({ productType: 'DORSE', ...mapRow(d) })),
            sasis: sasis.map((s) => ({ productType: 'SASI', ...mapRow(s) }))
        });
    } catch (error) {
        console.error('Error search:', error);
        res.status(500).json({ error: 'Arama yapılamadı' });
    }
});

app.get('/api/analytics/stale-products', requireAuth, async (req, res) => {
    try {
        const days = Math.min(90, Math.max(1, parseInt(String(req.query.days || '14'), 10) || 14));
        const cutoff = new Date(Date.now() - days * 86400000);

        const [dampers, dorses, sasis] = await Promise.all([
            prisma.damper.findMany({
                where: {
                    productionStartedAt: { not: null },
                    teslimat: false,
                    updatedAt: { lt: cutoff }
                },
                orderBy: { updatedAt: 'asc' },
                take: 40,
                select: { id: true, imalatNo: true, musteri: true, updatedAt: true }
            }),
            prisma.dorse.findMany({
                where: {
                    productionStartedAt: { not: null },
                    teslimat: false,
                    updatedAt: { lt: cutoff }
                },
                orderBy: { updatedAt: 'asc' },
                take: 40,
                select: { id: true, imalatNo: true, musteri: true, updatedAt: true }
            }),
            prisma.sasi.findMany({
                where: {
                    productionStartedAt: { not: null },
                    lastikMontaji: false,
                    updatedAt: { lt: cutoff }
                },
                orderBy: { updatedAt: 'asc' },
                take: 40,
                select: { id: true, imalatNo: true, musteri: true, sasiNo: true, updatedAt: true }
            })
        ]);

        res.json({
            days,
            cutoff: cutoff.toISOString(),
            dampers: dampers.map(d => ({ productType: 'DAMPER', ...d })),
            dorses: dorses.map(d => ({ productType: 'DORSE', ...d })),
            sasis: sasis.map(s => ({ productType: 'SASI', ...s }))
        });
    } catch (error) {
        console.error('Error stale-products:', error);
        res.status(500).json({ error: 'Veri alınamadı' });
    }
});

app.get('/api/analytics/verimlilik', requireAuth, async (req, res) => {
    try {
        const { type, from, to } = req.query;
        const productType = type === 'DORSE' ? 'DORSE' : type === 'SASI' ? 'SASI' : 'DAMPER';
        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;
        if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
            return res.status(400).json({ error: 'from ve to zorunlu (ISO 8601)' });
        }
        if (fromDate >= toDate) {
            return res.status(400).json({ error: 'from, to tarihinden önce olmalı' });
        }

        const report = await computeVerimlilikReport(productType, fromDate, toDate);
        res.json(report);
    } catch (error) {
        console.error('Error fetching verimlilik:', error);
        const hint =
            error.code === 'P2021' || error.code === 'P2022'
                ? ' Veritabanı şeması eksik olabilir: backend klasöründe npx prisma migrate deploy'
                : '';
        res.status(500).json({
            error: `Verimlilik verisi alınamadı.${hint}`,
            code: error.code || undefined
        });
    }
});

/** Teklif Takip → İmalat Takip: onaylı teklif özeti (Damper/Dorse/Şasi kayıtlarına dokunmaz). */
app.post('/api/integrations/teklif-takip/ingest', requireTeklifIngestSecret, async (req, res) => {
    try {
        const b = req.body;
        if (!b || typeof b !== 'object' || Array.isArray(b)) {
            return res.status(400).json({ error: 'Geçersiz gövde' });
        }
        const sourceProposalId = strOrNull(b.sourceProposalId);
        if (!sourceProposalId) {
            return res.status(400).json({ error: 'sourceProposalId zorunlu' });
        }
        const companyName = strOrNull(b.companyName);
        if (!companyName) {
            return res.status(400).json({ error: 'companyName zorunlu' });
        }
        const pd = parseRequiredIsoDate(b.proposalDate, 'proposalDate');
        if (!pd.ok) return res.status(400).json({ error: pd.error });
        const qn = Number(b.quantity);
        if (!Number.isFinite(qn)) {
            return res.status(400).json({ error: 'quantity sayısal olmalı' });
        }
        const pushed = parseRequiredIsoDate(b.pushedAt, 'pushedAt');
        if (!pushed.ok) return res.status(400).json({ error: pushed.error });

        let deliveryDate = null;
        if (b.deliveryDate !== null && b.deliveryDate !== undefined && b.deliveryDate !== '') {
            const dd = parseOptionalIsoDate(b.deliveryDate);
            if (!dd.ok) return res.status(400).json({ error: 'deliveryDate geçersiz' });
            deliveryDate = dd.date;
        }
        let approvalLoggedAt = null;
        if (b.approvalLoggedAt !== null && b.approvalLoggedAt !== undefined && b.approvalLoggedAt !== '') {
            const ad = parseOptionalIsoDate(b.approvalLoggedAt);
            if (!ad.ok) return res.status(400).json({ error: 'approvalLoggedAt geçersiz' });
            approvalLoggedAt = ad.date;
        }

        const teknikPdfUrl = strOrNull(b.teknikPdfUrl);
        const manufacturingNot = strOrNull(b.manufacturingNot);
        const rawAciliyet = strOrNull(b.manufacturingAciliyet);
        const VALID_ACILIYET = ['Normal', 'Acil', 'Çok Acil'];
        const manufacturingAciliyet = rawAciliyet && VALID_ACILIYET.includes(rawAciliyet) ? rawAciliyet : null;

        const row = await prisma.proposalIngest.upsert({
            where: { sourceProposalId },
            create: {
                sourceProposalId,
                companyName,
                proposalDate: pd.date,
                quantity: qn,
                equipment: strOrNull(b.equipment),
                vehicle: strOrNull(b.vehicle),
                volume: strOrNull(b.volume),
                thickness: strOrNull(b.thickness),
                deliveryDate,
                contactPerson: strOrNull(b.contactPerson),
                notes: strOrNull(b.notes),
                ownerEmail: strOrNull(b.ownerEmail),
                pushedAt: pushed.date,
                pushedBy: strOrNull(b.pushedBy),
                approvalLoggedAt,
                teknikPdfUrl,
                manufacturingNot,
                manufacturingAciliyet
            },
            update: {
                companyName,
                proposalDate: pd.date,
                quantity: qn,
                equipment: strOrNull(b.equipment),
                vehicle: strOrNull(b.vehicle),
                volume: strOrNull(b.volume),
                thickness: strOrNull(b.thickness),
                deliveryDate,
                contactPerson: strOrNull(b.contactPerson),
                notes: strOrNull(b.notes),
                ownerEmail: strOrNull(b.ownerEmail),
                pushedAt: pushed.date,
                pushedBy: strOrNull(b.pushedBy),
                approvalLoggedAt,
                teknikPdfUrl,
                manufacturingNot,
                manufacturingAciliyet
            }
        });
        res.status(200).json({ ok: true, id: row.id });
    } catch (error) {
        console.error('teklif-takip ingest:', error);
        const hint =
            error.code === 'P2021' || error.code === 'P2022'
                ? ' Veritabanı şeması eksik olabilir: npx prisma migrate deploy'
                : '';
        res.status(500).json({ error: `Kayıt işlenemedi.${hint}` });
    }
});

app.get('/api/integrations/teklif-takip/proposals', requireAuth, async (req, res) => {
    try {
        let limit = parseInt(String(req.query.limit || ''), 10);
        if (!Number.isFinite(limit) || limit < 1) limit = 300;
        if (limit > 500) limit = 500;
        const rows = await prisma.proposalIngest.findMany({
            orderBy: [{ imalataAlindi: 'asc' }, { pushedAt: 'desc' }],
            take: limit
        });
        res.json(rows);
    } catch (error) {
        console.error('teklif-takip proposals:', error);
        const hint =
            error.code === 'P2021' || error.code === 'P2022'
                ? ' Veritabanı şeması eksik olabilir: npx prisma migrate deploy'
                : '';
        res.status(500).json({ error: `Liste alınamadı.${hint}` });
    }
});

app.patch('/api/integrations/teklif-takip/proposals/:id', requireAuth, async (req, res) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isFinite(id) || id < 1) {
            return res.status(400).json({ error: 'Geçersiz id' });
        }
        const { imalataAlindi } = req.body || {};
        if (typeof imalataAlindi !== 'boolean') {
            return res.status(400).json({ error: 'imalataAlindi (boolean) gerekli' });
        }
        const row = await prisma.proposalIngest.update({
            where: { id },
            data: { imalataAlindi }
        });
        res.json(row);
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Kayıt bulunamadı' });
        }
        console.error('teklif-takip patch proposal:', error);
        res.status(500).json({ error: 'Güncellenemedi' });
    }
});

app.delete('/api/integrations/teklif-takip/proposals/:id', requireAuth, async (req, res) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isFinite(id) || id < 1) {
            return res.status(400).json({ error: 'Geçersiz id' });
        }
        await prisma.proposalIngest.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Kayıt bulunamadı' });
        }
        console.error('teklif-takip delete proposal:', error);
        res.status(500).json({ error: 'Silinemedi' });
    }
});

const aiInsightLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 8,
    message: { error: 'Çok fazla AI isteği. Bir dakika sonra deneyin.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.post('/api/analytics/ai-insight', requireAdmin, aiInsightLimiter, async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(503).json({ error: 'OPENAI_API_KEY tanımlı değil' });
        }
        const { type, from, to } = req.body || {};
        const productType = type === 'DORSE' ? 'DORSE' : type === 'SASI' ? 'SASI' : 'DAMPER';
        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;
        if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
            return res.status(400).json({ error: 'from ve to zorunlu (ISO 8601)' });
        }
        if (fromDate >= toDate) {
            return res.status(400).json({ error: 'from, to tarihinden önce olmalı' });
        }

        const report = await computeVerimlilikReport(productType, fromDate, toDate);
        const payload = {
            uyari: 'Bu metin karar desteği içindir; resmi KPI veya muhasebe kaydı değildir.',
            rapor: report
        };

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content:
                            'Sen bir üretim verimliliği asistanısın. Türkçe, kısa ve net yaz. Sadece verilen JSON sayılarına dayan; uydurma. En fazla 8 cümle: özet, dikkat çeken bölümler, varsa düşük verim veya mesai ipuçları.'
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(payload)
                    }
                ],
                temperature: 0.4,
                max_tokens: 600
            })
        });

        if (!openaiRes.ok) {
            const errText = await openaiRes.text();
            console.error('OpenAI error:', openaiRes.status, errText);
            return res.status(502).json({ error: 'AI yanıtı alınamadı' });
        }

        const aiJson = await openaiRes.json();
        const text = aiJson.choices?.[0]?.message?.content?.trim() || '';
        res.json({ text, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' });
    } catch (error) {
        console.error('Error ai-insight:', error);
        res.status(500).json({ error: 'AI özeti oluşturulamadı' });
    }
});

// Start server (önce şema — P2022 drift önleme)
const PORT = process.env.PORT || 3001;
const { ensureDatabaseSchema } = require('./ensureSchema');

async function startServer() {
    try {
        await ensureDatabaseSchema();
    } catch (err) {
        console.error('[ensureSchema] Başarısız:', err.message);
        process.exit(1);
    }
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = { app, prisma, startServer };

if (require.main === module) {
    startServer();
}
