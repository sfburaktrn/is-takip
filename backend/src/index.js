require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// ==================== ROUTES ====================

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

// Create new damper
app.post('/api/dampers', async (req, res) => {
    try {
        const damper = await prisma.damper.create({
            data: req.body
        });
        res.status(201).json(addCalculatedSteps(damper));
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

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
