/**
 * Supabase: DATABASE_URL genelde PgBouncer (6543) olur; prisma db push DDL için
 * bazen güvenilir değil. Bu script .env'deki DIRECT_URL (5432) ile db push çalıştırır.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { execSync } = require('child_process');
const path = require('path');

const direct = process.env.DIRECT_URL;
if (!direct) {
    console.error('db-push-direct: .env içinde DIRECT_URL gerekli (Supabase doğrudan PostgreSQL bağlantısı).');
    process.exit(1);
}

const cwd = path.join(__dirname, '..');
const env = { ...process.env, DATABASE_URL: direct };
console.log('db-push-direct: prisma db push → DIRECT_URL (pooler değil)');
execSync('npx prisma db push --skip-generate', { stdio: 'inherit', cwd, env });
