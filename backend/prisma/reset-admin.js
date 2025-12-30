const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Resetting admin password...');
    const hashedPassword = await bcrypt.hash('Ozunlu22', 10);

    try {
        console.log('Deleting existing login logs for admin...');
        // Find user first to get ID
        const user = await prisma.user.findUnique({ where: { username: 'admin' } });
        if (user) {
            await prisma.loginLog.deleteMany({ where: { userId: user.id } });
            await prisma.user.delete({ where: { id: user.id } });
            console.log('Existing admin deleted.');
        }
    } catch (e) {
        console.error('Error deleting existing admin:', e);
    }

    console.log('Creating new admin user...');
    await prisma.user.create({
        data: {
            username: 'admin',
            password: hashedPassword,
            fullName: 'Sistem Yöneticisi',
            isAdmin: true
        }
    });

    console.log('Admin user successfully reset: admin / Ozunlu22');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
