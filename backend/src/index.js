require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
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
if (isProduction) {
    app.set('trust proxy', 1); // Trust first proxy for secure cookies
}
app.use(session({
    secret: process.env.SESSION_SECRET || 'damper-takip-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction, // HTTPS only in production
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 saat (1 vardiya)
        sameSite: isProduction ? 'none' : 'lax' // Cross-domain cookies in production
    }
}));

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

// Login
app.post('/api/auth/login', async (req, res) => {
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

// Get all dampers with optional filters
app.get('/api/dampers', async (req, res) => {
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
        res.status(500).json({ error: 'Failed to fetch dampers' });
    }
});

// Get single damper
app.get('/api/dampers/:id', async (req, res) => {
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

// Create new damper(s) - creates multiple if adet > 1
app.post('/api/dampers', async (req, res) => {
    try {
        const { adet, musteri, ...restData } = req.body;
        const quantity = adet || 1;

        // If quantity is 1, create single damper
        if (quantity === 1) {
            const damper = await prisma.damper.create({
                data: {
                    ...restData,
                    musteri,
                    adet: 1
                }
            });
            return res.status(201).json(addCalculatedSteps(damper));
        }

        // If quantity > 1, create multiple dampers with numbered names
        const createdDampers = [];
        for (let i = 1; i <= quantity; i++) {
            const damper = await prisma.damper.create({
                data: {
                    ...restData,
                    musteri: `${musteri} ${i}`,
                    adet: 1
                }
            });
            createdDampers.push(addCalculatedSteps(damper));
        }

        res.status(201).json(createdDampers);
    } catch (error) {
        console.error('Error creating damper:', error);
        res.status(500).json({ error: 'Failed to create damper' });
    }
});

// Update damper
app.put('/api/dampers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const damper = await prisma.damper.update({
            where: { id: parseInt(id) },
            data: req.body
        });
        res.json(addCalculatedSteps(damper));
    } catch (error) {
        console.error('Error updating damper:', error);
        res.status(500).json({ error: 'Failed to update damper' });
    }
});

// Delete damper
app.delete('/api/dampers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.damper.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Damper deleted successfully' });
    } catch (error) {
        console.error('Error deleting damper:', error);
        res.status(500).json({ error: 'Failed to delete damper' });
    }
});

// ==================== SASI ROUTES ====================

// Get all sasis
app.get('/api/sasis', async (req, res) => {
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

// Get single sasi
app.get('/api/sasis/:id', async (req, res) => {
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

// Create sasi with auto-naming
app.post('/api/sasis', async (req, res) => {
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

        if (quantity === 1) {
            let finalMusteri = musteri;
            if (musteri === 'Stok') finalMusteri = `Stok ${lastStokNumber + 1}`;

            const sasi = await prisma.sasi.create({
                data: { ...restData, musteri: finalMusteri, adet: 1 }
            });
            return res.status(201).json(addCalculatedSasiSteps(sasi));
        }

        const createdSasis = [];
        for (let i = 1; i <= quantity; i++) {
            let finalMusteri = musteri;
            if (musteri === 'Stok') finalMusteri = `Stok ${lastStokNumber + i}`;
            else finalMusteri = `${musteri} ${i}`;

            const sasi = await prisma.sasi.create({
                data: { ...restData, musteri: finalMusteri, adet: 1 }
            });
            createdSasis.push(addCalculatedSasiSteps(sasi));
        }
        res.status(201).json(createdSasis);
    } catch (error) {
        console.error('Error creating sasi:', error);
        res.status(500).json({ error: 'Failed to create sasi' });
    }
});

// Update sasi
app.put('/api/sasis/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sasi = await prisma.sasi.update({
            where: { id: parseInt(id) },
            data: req.body
        });
        res.json(addCalculatedSasiSteps(sasi));
    } catch (error) {
        console.error('Error updating sasi:', error);
        res.status(500).json({ error: 'Failed to update sasi' });
    }
});

// Delete sasi
app.delete('/api/sasis/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.sasi.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Sasi deleted successfully' });
    } catch (error) {
        console.error('Error deleting sasi:', error);
        res.status(500).json({ error: 'Failed to delete sasi' });
    }
});

// Delete sasi
app.delete('/api/sasis/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.sasi.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Sasi deleted successfully' });
    } catch (error) {
        console.error('Error deleting sasi:', error);
        res.status(500).json({ error: 'Failed to delete sasi' });
    }
});

// Get dorse summary view
app.get('/api/dorses-summary', async (req, res) => {
    try {
        const dorses = await prisma.dorse.findMany({
            orderBy: { imalatNo: 'desc' }
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
            teslimat: dorse.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI'
        }));

        res.json(summary);
    } catch (error) {
        console.error('Error fetching dorse summary:', error);
        res.status(500).json({ error: 'Failed to fetch dorse summary' });
    }
});

// Get summary view (only main steps)
app.get('/api/dampers-summary', async (req, res) => {
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

// Get company summary with step completion stats
app.get('/api/company-summary', async (req, res) => {
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
            tip: ['HAVUZ DAMPER', 'HAVUZ DAMPER + HİDROLİK KAPAK', 'KÖŞELİ DAMPER'],
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

// Get statistics
app.get('/api/stats', async (req, res) => {
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
            const allUnlinkedSasis = await prisma.sasi.findMany({
                where: { dorse: null },
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
                musteriSasiCount: musteriCount
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
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== ANALYTICS ENDPOINTS ====================

// Get analytics step stats (for charts) - with 3 states: başlanmadı, devam ediyor, tamamlandı
// Get analytics step stats (for charts) - with 3 states
app.get('/api/analytics/step-stats', async (req, res) => {
    console.log('DEBUG: Analytics requested for:', req.query.type);
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
// Get company distribution for pie chart
app.get('/api/analytics/company-distribution', async (req, res) => {
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
// Get recent activity (today's updated items that have actual work done)
app.get('/api/analytics/recent-activity', async (req, res) => {
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

// Delete dampers/dorses by Company and M3
app.delete('/api/company-m3', async (req, res) => {
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
                m3: parseFloat(m3)
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

// Get all dorses
app.get('/api/dorses', async (req, res) => {
    try {
        const dorses = await prisma.dorse.findMany({
            orderBy: { imalatNo: 'desc' }
        });
        res.json(dorses);
    } catch (error) {
        console.error('Error fetching dorses:', error);
        res.status(500).json({ error: 'Failed to fetch dorses' });
    }
});

// Create new dorse
app.post('/api/dorses', async (req, res) => {
    try {
        const { adet, musteri, ...restData } = req.body;
        const quantity = adet || 1;

        if (quantity === 1) {
            const dorse = await prisma.dorse.create({
                data: {
                    ...restData,
                    musteri,
                    adet: 1
                }
            });
            return res.status(201).json(dorse);
        }

        const createdDorses = [];
        for (let i = 1; i <= quantity; i++) {
            const dorse = await prisma.dorse.create({
                data: {
                    ...restData,
                    musteri: `${musteri} ${i}`,
                    adet: 1
                }
            });
            createdDorses.push(dorse);
        }

        res.status(201).json(createdDorses);
    } catch (error) {
        console.error('Error creating dorse:', error);
        res.status(500).json({ error: 'Failed to create dorse' });
    }
});

// Update dorse
app.put('/api/dorses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const dorse = await prisma.dorse.update({
            where: { id: parseInt(id) },
            data: req.body
        });
        res.json(dorse);
    } catch (error) {
        console.error('Error updating dorse:', error);
        res.status(500).json({ error: 'Failed to update dorse' });
    }
});

// Delete dorse
app.delete('/api/dorses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.dorse.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Dorse deleted successfully' });
    } catch (error) {
        console.error('Error deleting dorse:', error);
        res.status(500).json({ error: 'Failed to delete dorse' });
    }
});

// Link Sasi to Dorse
app.put('/api/dorses/:id/link-sasi', async (req, res) => {
    try {
        const { id } = req.params;
        const { sasiId } = req.body;

        if (!sasiId) {
            return res.status(400).json({ error: 'Sasi ID is required' });
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

// Update dorse detail to include sasi
app.get('/api/dorses/:id', async (req, res) => {
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

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
