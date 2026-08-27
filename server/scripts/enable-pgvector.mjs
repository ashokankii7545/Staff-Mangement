/**
 * One-time migration: enable pgvector + add a 128-d face embedding column to
 * users, with an HNSW cosine index. Idempotent — safe to run repeatedly.
 *
 * The `vector` type isn't expressible in drizzle-kit, so this DDL is managed
 * here (raw SQL) rather than in the generated Drizzle migrations.
 *
 *   node scripts/enable-pgvector.mjs
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
  console.log('→ enabling pgvector extension …');
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  console.log('→ adding users.face_vector vector(128) …');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS face_vector vector(128)`;

  console.log('→ creating HNSW cosine index …');
  await sql`
    CREATE INDEX IF NOT EXISTS users_face_vector_hnsw
    ON users USING hnsw (face_vector vector_cosine_ops)
  `;

  const [{ ext }] = await sql`
    SELECT count(*)::int AS ext FROM pg_extension WHERE extname = 'vector'
  `;
  const cols = await sql`
    SELECT column_name, udt_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'face_vector'
  `;
  console.log(`✓ pgvector installed: ${ext === 1}`);
  console.log(`✓ face_vector column:`, cols[0] ?? 'MISSING');

  await sql.end({ timeout: 5 });
  console.log('✓ done');
};

run().catch(async (err) => {
  console.error('✗ migration failed:', err.message);
  try { await sql.end({ timeout: 2 }); } catch {}
  process.exit(1);
});
