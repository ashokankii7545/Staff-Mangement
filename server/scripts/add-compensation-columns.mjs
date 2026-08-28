/**
 * One-time migration: add admin-managed compensation columns to users
 * (salary + bonus, both nullable jsonb). Idempotent — safe to run repeatedly.
 *
 * Mirrors the pattern in enable-pgvector.mjs so schema changes that must touch
 * the live DB stay explicit and reviewable.
 *
 *   node scripts/add-compensation-columns.mjs
 */
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, {
  ssl: process.env.DATABASE_SSL === 'no-verify' ? { rejectUnauthorized: false } : undefined,
  prepare: false,
  max: 1,
});

const run = async () => {
  console.log('→ adding users.salary jsonb …');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS salary jsonb`;

  console.log('→ adding users.bonus jsonb …');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus jsonb`;

  const cols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'users' AND column_name IN ('salary', 'bonus')
    ORDER BY column_name
  `;
  console.log('✓ columns present:', cols);

  await sql.end({ timeout: 5 });
  console.log('✓ done');
};

run().catch(async (err) => {
  console.error('✗ migration failed:', err.message);
  try { await sql.end({ timeout: 2 }); } catch {}
  process.exit(1);
});
