/** Diagnostic: show which users have an enrolled face_vector, its dimension
 * and L2 norm (should be ~1.0 for SFace). Read-only.
 *   node scripts/inspect-face-vectors.mjs
 */
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = postgres(url, {
  ssl: process.env.DATABASE_SSL === 'no-verify' ? { rejectUnauthorized: false } : undefined,
  prepare: false, max: 1,
});

const run = async () => {
  const rows = await sql`
    SELECT id, employee_id, name, email,
           (face_vector IS NOT NULL) AS enrolled,
           face_vector
    FROM users
    ORDER BY created_at
  `;
  for (const r of rows) {
    if (!r.enrolled) {
      console.log(`✗ ${r.employee_id ?? '-'} ${r.name} — NOT enrolled`);
      continue;
    }
    // pgvector returns the vector as a string like "[0.1,0.2,...]"
    const arr = String(r.face_vector).replace(/^\[|\]$/g, '').split(',').map(Number);
    const dim = arr.length;
    const norm = Math.sqrt(arr.reduce((s, x) => s + x * x, 0));
    const allZero = arr.every((x) => x === 0);
    console.log(
      `✓ ${r.employee_id ?? '-'} ${r.name} — enrolled dim=${dim} norm=${norm.toFixed(4)}${allZero ? ' ⚠️ ALL ZERO' : ''}`,
    );
  }
  await sql.end({ timeout: 5 });
};
run().catch(async (e) => { console.error('failed:', e.message); try { await sql.end({ timeout: 2 }); } catch {} process.exit(1); });
