const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const dCount = await prisma.dorse.count();
    const dmCount = await prisma.damper.count();
    const sCount = await prisma.sasi.count();
    console.log(`Dorse Count: ${dCount}`);
    console.log(`Damper Count: ${dmCount}`);
    console.log(`Sasi Count: ${sCount}`);

    if (dCount > 0) {
        const d = await prisma.dorse.findFirst();
        console.log('First Dorse ID:', d.id);
        console.log('Boya Hazirlik:', d.boyaHazirlik);
        console.log('Dorse Sasi Boyama:', d.dorseSasiBoyama);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
