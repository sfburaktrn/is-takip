const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();
const name = '20260723170000_sheet_stock_documents';
const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', name, 'migration.sql');
const checksum = crypto.createHash('sha256').update(fs.readFileSync(sqlPath)).digest('hex');

(async () => {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = $1`,
    name
  );
  if (existing.length) {
    console.log('already recorded');
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, $1, NOW(), $2, NULL, NULL, NOW(), 1)`,
      checksum,
      name
    );
    console.log('migration recorded');
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
