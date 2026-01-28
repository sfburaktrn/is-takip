const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting safe column rename...');
  
  const renames = [
    { table: 'Dorse', old: 'dorseGeldiMi', new: 'cekiciGeldiMi' },
    { table: 'Dorse', old: 'sacCinsi', new: 'kalinlik' },
    { table: 'Dorse', old: 'dorseCatim', new: 'dorseKurulmasi' },
    { table: 'Dorse', old: 'boya', new: 'dorseSasiBoyama' },
    { table: 'Dorse', old: 'kurumMuayenesi', new: 'akmTseMuayenesi' }
  ];

  for (const { table, old: oldCol, new: newCol } of renames) {
    try {
      // Check if old column exists
      // Note: This is postgres specific check
      const check = await prisma.$queryRawUnsafe(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${table}' AND column_name = '${oldCol}';
      `);
      
      if (check.length > 0) {
        console.log(`Renaming ${table}.${oldCol} -> ${newCol}`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" RENAME COLUMN "${oldCol}" TO "${newCol}";`);
      } else {
        console.log(`Column ${table}.${oldCol} not found (might already be renamed).`);
      }
    } catch (e) {
      console.warn(`Error processing ${oldCol} -> ${newCol}: ${e.message}`);
    }
  }

  console.log('Rename operations completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
