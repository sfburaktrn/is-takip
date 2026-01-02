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
        const dampers = await prisma.damper.findMany({
            orderBy: { musteri: 'asc' }
        });

        // All step fields to check
        const allSteps = [
            'plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'damperSasiPlazmaKesim', 'presBukum',
            'aracBraket', 'damperSasi', 'sasiYukleme',
            'milAltKutuk', 'taban', 'yan', 'onGogus', 'arkaKapak', 'yuklemeMalzemesi',
            'damperKurulmasi', 'damperKaynak', 'sasiKapakSiperlik', 'yukleme',
            'hidrolik', 'boyaHazirlik', 'boya',
            'elektrik', 'hava', 'tamamlama', 'sonKontrol', 'teslimat'
        ];

        // Group by base company
        const companyMap = {};

        dampers.forEach(damper => {
            const baseCompany = getBaseCompany(damper.musteri);
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
                    dampers: [],
                    // Step-based completion statistics - 3 states
                    stepStats: {
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
                    }
                };
            }

            const company = companyMap[baseCompany];
            company.totalOrders++;

            // Track M³
            const m3Value = damper.m3 || 0;
            company.totalM3 += m3Value;

            // Calculate damper status
            const completedSteps = allSteps.filter(step => damper[step] === true).length;
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
            const stepStatuses = {
                kesimBukum: calculateMainStepStatus(damper, 'kesimBukum'),
                sasiBitis: calculateMainStepStatus(damper, 'sasiBitis'),
                onHazirlik: calculateMainStepStatus(damper, 'onHazirlik'),
                montaj: calculateMainStepStatus(damper, 'montaj'),
                hidrolik: damper.hidrolik ? 'TAMAMLANDI' : 'BAŞLAMADI',
                boyaBitis: calculateMainStepStatus(damper, 'boyaBitis'),
                tamamlamaBitis: calculateMainStepStatus(damper, 'tamamlamaBitis'),
                sonKontrol: damper.sonKontrol ? 'TAMAMLANDI' : 'BAŞLAMADI',
                kurumMuayenesi: damper.kurumMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                dmoMuayenesi: damper.dmoMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                teslimat: damper.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI'
            };

            Object.keys(stepStatuses).forEach(stepKey => {
                company.stepStats[stepKey].total++;
                const status = stepStatuses[stepKey];
                if (status === 'TAMAMLANDI') {
                    company.stepStats[stepKey].tamamlandi++;
                } else if (status === 'DEVAM EDİYOR') {
                    company.stepStats[stepKey].devamEdiyor++;
                } else {
                    company.stepStats[stepKey].baslamadi++;
                }
            });

            // Track variant (original customer name)
            if (!company.variants[damper.musteri]) {
                company.variants[damper.musteri] = {
                    name: damper.musteri,
                    total: 0,
                    totalM3: 0,
                    tamamlanan: 0,
                    devamEden: 0,
                    baslamayan: 0
                };
            }
            company.variants[damper.musteri].total++;
            company.variants[damper.musteri].totalM3 += m3Value;
            company.variants[damper.musteri][status]++;

            // Track M³ groups with stepStats
            const m3Key = m3Value.toString();
            if (!company.m3Groups[m3Key]) {
                company.m3Groups[m3Key] = {
                    m3: m3Value,
                    count: 0,
                    tamamlanan: 0,
                    devamEden: 0,
                    baslamayan: 0,
                    stepStats: {
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
                    }
                };
            }
            company.m3Groups[m3Key].count++;
            company.m3Groups[m3Key][status]++;

            // Update M³ group stepStats
            Object.keys(stepStatuses).forEach(stepKey => {
                company.m3Groups[m3Key].stepStats[stepKey].total++;
                const stepStatus = stepStatuses[stepKey];
                if (stepStatus === 'TAMAMLANDI') {
                    company.m3Groups[m3Key].stepStats[stepKey].tamamlandi++;
                } else if (stepStatus === 'DEVAM EDİYOR') {
                    company.m3Groups[m3Key].stepStats[stepKey].devamEdiyor++;
                } else {
                    company.m3Groups[m3Key].stepStats[stepKey].baslamadi++;
                }
            });

            // Add damper info
            company.dampers.push({
                id: damper.id,
                imalatNo: damper.imalatNo,
                musteri: damper.musteri,
                m3: m3Value,
                progress,
                status,
                kesimBukumStatus: calculateMainStepStatus(damper, 'kesimBukum'),
                sasiBitisStatus: calculateMainStepStatus(damper, 'sasiBitis'),
                onHazirlikStatus: calculateMainStepStatus(damper, 'onHazirlik'),
                montajStatus: calculateMainStepStatus(damper, 'montaj'),
                hidrolikStatus: damper.hidrolik ? 'TAMAMLANDI' : 'BAŞLAMADI',
                boyaBitisStatus: calculateMainStepStatus(damper, 'boyaBitis'),
                tamamlamaBitisStatus: calculateMainStepStatus(damper, 'tamamlamaBitis'),
                sonKontrolStatus: damper.sonKontrol ? 'YAPILDI' : 'BAŞLAMADI'
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
        const totalDampers = await prisma.damper.count();
        const dampers = await prisma.damper.findMany();

        let tamamlanan = 0;
        let devamEden = 0;
        let baslamayan = 0;

        // All step fields to check
        const allSteps = [
            'plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'damperSasiPlazmaKesim', 'presBukum',
            'aracBraket', 'damperSasi', 'sasiYukleme',
            'milAltKutuk', 'taban', 'yan', 'onGogus', 'arkaKapak', 'yuklemeMalzemesi',
            'damperKurulmasi', 'damperKaynak', 'sasiKapakSiperlik', 'yukleme',
            'hidrolik', 'boyaHazirlik', 'boya',
            'elektrik', 'hava', 'tamamlama', 'sonKontrol', 'teslimat'
        ];

        dampers.forEach(damper => {
            // Count completed steps
            const completedSteps = allSteps.filter(step => damper[step] === true).length;
            const totalSteps = allSteps.length;

            if (completedSteps === totalSteps) {
                // All steps completed
                tamamlanan++;
            } else if (completedSteps === 0) {
                // No steps started
                baslamayan++;
            } else {
                // Some steps completed
                devamEden++;
            }
        });

        res.json({
            total: totalDampers,
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
app.get('/api/analytics/step-stats', async (req, res) => {
    try {
        const dampers = await prisma.damper.findMany();

        // Helper to initialize stats structure
        const createInitStats = () => ({
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
        });

        const stepStats = createInitStats();
        const m3StepStats = {}; // Objects keyed by M3 string (e.g. "16", "18")

        // Helper to update a stats object based on a damper
        const updateStats = (stats, stepStatuses) => {
            Object.keys(stepStatuses).forEach(stepKey => {
                const status = stepStatuses[stepKey];
                stats[stepKey].total++;
                if (status === 'TAMAMLANDI') {
                    stats[stepKey].tamamlandi++;
                } else if (status === 'DEVAM EDİYOR') {
                    stats[stepKey].devamEdiyor++;
                } else {
                    stats[stepKey].baslamadi++;
                }
            });
        };

        dampers.forEach(damper => {
            // Calculate statuses for this damper
            const stepStatuses = {
                kesimBukum: calculateMainStepStatus(damper, 'kesimBukum'),
                sasiBitis: calculateMainStepStatus(damper, 'sasiBitis'),
                onHazirlik: calculateMainStepStatus(damper, 'onHazirlik'),
                montaj: calculateMainStepStatus(damper, 'montaj'),
                hidrolik: damper.hidrolik ? 'TAMAMLANDI' : 'BAŞLAMADI',
                boyaBitis: calculateMainStepStatus(damper, 'boyaBitis'),
                tamamlamaBitis: calculateMainStepStatus(damper, 'tamamlamaBitis'),
                sonKontrol: damper.sonKontrol ? 'TAMAMLANDI' : 'BAŞLAMADI',
                kurumMuayenesi: damper.kurumMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                dmoMuayenesi: damper.dmoMuayenesi === 'YAPILDI' ? 'TAMAMLANDI' : 'BAŞLAMADI',
                teslimat: damper.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI'
            };

            // Update Total Stats
            updateStats(stepStats, stepStatuses);

            // Update M3 Group Stats
            const m3Value = damper.m3 || 0;
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
app.get('/api/analytics/company-distribution', async (req, res) => {
    try {
        const dampers = await prisma.damper.findMany();

        const companyMap = {};
        dampers.forEach(damper => {
            const baseCompany = getBaseCompany(damper.musteri);
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
app.get('/api/analytics/recent-activity', async (req, res) => {
    try {
        // Get start of today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const recentDampers = await prisma.damper.findMany({
            where: {
                updatedAt: {
                    gte: today
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 50
        });

        const activity = recentDampers.map(damper => {
            const kesimBukumStatus = calculateMainStepStatus(damper, 'kesimBukum');
            const montajStatus = calculateMainStepStatus(damper, 'montaj');
            const boyaBitisStatus = calculateMainStepStatus(damper, 'boyaBitis');
            const teslimatStatus = damper.teslimat ? 'TAMAMLANDI' : 'BAŞLAMADI';

            // Check if any step has progress (not just BAŞLAMADI)
            const hasProgress =
                kesimBukumStatus !== 'BAŞLAMADI' ||
                montajStatus !== 'BAŞLAMADI' ||
                boyaBitisStatus !== 'BAŞLAMADI' ||
                teslimatStatus !== 'BAŞLAMADI' ||
                damper.hidrolik === true ||
                damper.sonKontrol === true;

            // Build detailed completed steps list
            const completedSubSteps = [];

            // Kesim-Büküm alt aşamaları
            if (damper.plazmaProgrami) completedSubSteps.push('Plazma Programı (Kesim-Büküm)');
            if (damper.sacMalzemeKontrolu) completedSubSteps.push('Sac Malzeme Kontrolü (Kesim-Büküm)');
            if (damper.plazmaKesim) completedSubSteps.push('Plazma Kesim (Kesim-Büküm)');
            if (damper.damperSasiPlazmaKesim) completedSubSteps.push('Damper Şasi Plazma Kesim (Kesim-Büküm)');
            if (damper.presBukum) completedSubSteps.push('Pres Büküm (Kesim-Büküm)');

            // Şasi Bitiş alt aşamaları
            if (damper.aracBraket) completedSubSteps.push('Araç Braket (Şasi Bitiş)');
            if (damper.damperSasi) completedSubSteps.push('Damper Şasi (Şasi Bitiş)');
            if (damper.sasiYukleme) completedSubSteps.push('Şasi Yükleme (Şasi Bitiş)');

            // Ön Hazırlık alt aşamaları
            if (damper.milAltKutuk) completedSubSteps.push('Mil Alt Kütük (Ön Hazırlık)');
            if (damper.taban) completedSubSteps.push('Taban (Ön Hazırlık)');
            if (damper.yan) completedSubSteps.push('Yan (Ön Hazırlık)');
            if (damper.onGogus) completedSubSteps.push('Ön Göğüs (Ön Hazırlık)');
            if (damper.arkaKapak) completedSubSteps.push('Arka Kapak (Ön Hazırlık)');
            if (damper.yuklemeMalzemesi) completedSubSteps.push('Yükleme Malzemesi (Ön Hazırlık)');

            // Montaj alt aşamaları
            if (damper.damperKurulmasi) completedSubSteps.push('Damper Kurulması (Montaj)');
            if (damper.damperKaynak) completedSubSteps.push('Damper Kaynak (Montaj)');
            if (damper.sasiKapakSiperlik) completedSubSteps.push('Şasi Kapak Siperlik (Montaj)');
            if (damper.yukleme) completedSubSteps.push('Yükleme (Montaj)');

            // Diğer aşamalar
            if (damper.hidrolik) completedSubSteps.push('Hidrolik');
            if (damper.boyaHazirlik) completedSubSteps.push('Boya Hazırlık (Boya)');
            if (damper.boya) completedSubSteps.push('Boya (Boya)');
            if (damper.elektrik) completedSubSteps.push('Elektrik (Tamamlama)');
            if (damper.hava) completedSubSteps.push('Hava (Tamamlama)');
            if (damper.tamamlama) completedSubSteps.push('Tamamlama (Tamamlama)');
            if (damper.sonKontrol) completedSubSteps.push('Son Kontrol');
            if (damper.teslimat) completedSubSteps.push('Teslimat ✅');

            return {
                id: damper.id,
                imalatNo: damper.imalatNo,
                musteri: damper.musteri,
                updatedAt: damper.updatedAt,
                kesimBukumStatus,
                montajStatus,
                boyaBitisStatus,
                teslimatStatus,
                completedSubSteps,
                hasProgress
            };
        });

        // Only return dampers with actual progress
        const activeWork = activity.filter(a => a.hasProgress);

        res.json(activeWork.slice(0, 20));
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
});

// Delete dampers by Company and M3
app.delete('/api/company-m3', async (req, res) => {
    try {
        const { companyName, m3 } = req.body;

        if (!companyName || m3 === undefined) {
            return res.status(400).json({ error: 'Company name and M3 value are required' });
        }

        // Fetch dampers that might match to filter them in memory
        // Optimization: rough filter by name first
        const potentialDampers = await prisma.damper.findMany({
            where: {
                musteri: {
                    contains: companyName,
                    mode: 'insensitive'
                },
                m3: parseFloat(m3)
            }
        });

        // Filter using the exact same logic as the summary view
        const targetIds = potentialDampers
            .filter(d => getBaseCompany(d.musteri) === companyName)
            .map(d => d.id);

        if (targetIds.length > 0) {
            await prisma.damper.deleteMany({
                where: {
                    id: {
                        in: targetIds
                    }
                }
            });
        }

        res.json({ message: 'Dampers deleted successfully', deletedCount: targetIds.length });
    } catch (error) {
        console.error('Error deleting company M3 group:', error);
        res.status(500).json({ error: 'Failed to delete company M3 group' });
    }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
