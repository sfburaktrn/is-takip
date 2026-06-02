require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { syncMaintenanceData } = require('../src/maintenanceUtils');

async function main() {
    const prisma = new PrismaClient();
    try {
        const result = await syncMaintenanceData(prisma);
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
