const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const sasis = await prisma.sasi.findMany({
            where: { musteri: 'Stok 1' }
        });
        console.log('Found Sasi records for "Stok 1":', JSON.stringify(sasis, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
