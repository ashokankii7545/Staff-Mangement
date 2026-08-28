/**
 * One-time migration: switch the attendance table from a single-punch-per-day
 * model to Zoho People-style multi-session.
 *
 *   - DROP the unique (user, date, type) index that physically blocked a
 *     second CLOCK_IN / CLOCK_OUT on the same day.
 *   - ADD a plain composite (user, date) index for fast per-day punch lookups.
 *
 * Idempotent — safe to run repeatedly.
 *
 *   node scripts/attendance-multisession.mjs
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
  console.log('→ dropping unique (user,date,type) index …');
  await sql`DROP INDEX IF EXISTS attendance_user_date_type_unique`;

  console.log('→ creating composite (user,date) index …');
  await sql`
    CREATE INDEX IF NOT EXISTS attendance_user_date_idx
    ON attendance (user_id, date)
  `;

  const idx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'attendance'
    ORDER BY indexname
  `;
  console.log('✓ attendance indexes now:', idx.map((r) => r.indexname));

  await sql.end({ timeout: 5 });
  console.log('✓ done');
};

run().catch(async (err) => {
  console.error('✗ migration failed:', err.message);
  try { await sql.end({ timeout: 2 }); } catch {}
  process.exit(1);
});
