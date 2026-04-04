/**
 * Verimlilik metrikleri: yalnızca productionStartedAt dolu ürünlerde ana adım tamamlanma olayları.
 * Damper: SON KONTROL, muayene ve teslimat metriğe girmez.
 * Dorse: SON KONTROL grubu metriğe girmez.
 * Şasi: Kesim-Büküm, Ön Hazırlık, Montaj (tüm tanımlı ana adımlar).
 */

const TRACKED_MAIN_STEPS = {
    DAMPER: ['kesimBukum', 'sasiBitis', 'onHazirlik', 'montaj', 'hidrolik', 'boyaBitis', 'tamamlamaBitis'],
    DORSE: ['kesimBukum', 'onHazirlik', 'montaj', 'boya', 'tamamlama'],
    SASI: ['kesimBukum', 'onHazirlik', 'montaj']
};

const STEP_LABELS = {
    DAMPER: {
        kesimBukum: 'KESİM - BÜKÜM',
        sasiBitis: 'ŞASİ BİTİŞ',
        onHazirlik: 'ÖN HAZIRLIK',
        montaj: 'MONTAJ',
        hidrolik: 'HİDROLİK',
        boyaBitis: 'BOYA BİTİŞ',
        tamamlamaBitis: 'TAMAMLAMA BİTİŞ'
    },
    DORSE: {
        kesimBukum: 'KESİM - BÜKÜM',
        onHazirlik: 'ÖN HAZIRLIK',
        montaj: 'MONTAJ',
        boya: 'BOYA',
        tamamlama: 'TAMAMLAMA'
    },
    SASI: {
        kesimBukum: 'KESİM - BÜKÜM',
        onHazirlik: 'ÖN HAZIRLIK',
        montaj: 'MONTAJ'
    }
};

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {'DAMPER'|'DORSE'|'SASI'} productType
 * @param {number} productId
 * @param {object|null} before - null on create
 * @param {object} after
 * @param {(record: object, key: string) => string} getStatusForKey
 */
async function syncStepCompletionEvents(prisma, productType, productId, before, after, getStatusForKey) {
    if (!after || !after.productionStartedAt) return;

    const keys = TRACKED_MAIN_STEPS[productType];
    if (!keys) return;

    for (const mainStepKey of keys) {
        const prev = before ? getStatusForKey(before, mainStepKey) : 'BAŞLAMADI';
        const next = getStatusForKey(after, mainStepKey);

        if (prev !== 'TAMAMLANDI' && next === 'TAMAMLANDI') {
            await prisma.stepCompletionEvent.create({
                data: {
                    productType,
                    productId,
                    mainStepKey,
                    completedAt: new Date()
                }
            });
        } else if (prev === 'TAMAMLANDI' && next !== 'TAMAMLANDI') {
            const last = await prisma.stepCompletionEvent.findFirst({
                where: { productType, productId, mainStepKey },
                orderBy: { completedAt: 'desc' },
                select: { id: true }
            });
            if (last) {
                await prisma.stepCompletionEvent.delete({ where: { id: last.id } });
            }
        }
    }
}

module.exports = {
    TRACKED_MAIN_STEPS,
    STEP_LABELS,
    syncStepCompletionEvents
};
