const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DORSE ID 3 FULL OBJECT ---');
    const d = await prisma.dorse.findUnique({ where: { id: 3 } });
    console.log(JSON.stringify(d, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
