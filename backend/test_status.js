const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
    }
};

function calculateMainDorseStepStatus(dorse, groupKey) {
    const group = DORSE_STEP_GROUPS[groupKey];
    if (!group) return 'BAŞLAMADI';

    const completedCount = group.subSteps.filter(step => dorse[step] === true).length;
    const totalCount = group.subSteps.length;

    console.log(`  DEBUG [${groupKey}]: completedCount=${completedCount}, totalCount=${totalCount}`);

    if (completedCount === 0) return 'BAŞLAMADI';
    if (completedCount === totalCount) return 'TAMAMLANDI';
    return 'DEVAM EDİYOR';
}

async function main() {
    console.log('--- DORSE STATUS TEST ---');
    const dorses = await prisma.dorse.findMany();
    dorses.forEach(d => {
        console.log(`Dorse ID: ${d.id}, Musteri: ${d.musteri}`);
        const status = calculateMainDorseStepStatus(d, 'boya');
        console.log(`  Boya Status: ${status}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
