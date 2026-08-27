/**
 * Backfill SFace face embeddings for existing users from their stored avatar.
 * Enrolls every ACTIVE user that has an avatar URL but no face_vector yet.
 *
 * Requires FACE_SERVICE_URL (and FACE_SERVICE_TOKEN if the service is guarded).
 *
 *   node scripts/backfill-face-vectors.mjs            # only missing enrollments
 *   node scripts/backfill-face-vectors.mjs --all      # re-enroll everyone w/ avatar
 */
import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL?.replace(/\/$/, '');
const FACE_SERVICE_TOKEN = process.env.FACE_SERVICE_TOKEN;
const REDO_ALL = process.argv.includes('--all');

if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
if (!FACE_SERVICE_URL) { console.error('FACE_SERVICE_URL not set'); process.exit(1); }

const sql = postgres(DATABASE_URL, {
  ssl: process.env.DATABASE_SSL === 'no-verify' ? { rejectUnauthorized: false } : undefined,
  prepare: false,
  max: 1,
});

const authHeaders = FACE_SERVICE_TOKEN ? { Authorization: `Bearer ${FACE_SERVICE_TOKEN}` } : {};

const embedFromUrl = async (url) => {
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`avatar fetch ${imgRes.status}`);
  const buf = await imgRes.arrayBuffer();
  const fd = new FormData();
  fd.append('file', new Blob([buf]), 'image.jpg');
  const res = await fetch(`${FACE_SERVICE_URL}/api/v1/embed`, { method: 'POST', body: fd, headers: authHeaders });
  if (!res.ok) throw new Error(`embed ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.embedding) || !data.embedding.length) throw new Error('empty embedding');
  return data.embedding;
};

const run = async () => {
  const rows = REDO_ALL
    ? await sql`SELECT id, name, avatar FROM users WHERE avatar <> '' AND is_active = true`
    : await sql`SELECT id, name, avatar FROM users WHERE avatar <> '' AND is_active = true AND face_vector IS NULL`;

  console.log(`Found ${rows.length} user(s) to enroll${REDO_ALL ? ' (re-enroll all)' : ' (missing only)'}.`);
  let ok = 0, skip = 0, fail = 0;

  for (const u of rows) {
    try {
      const emb = await embedFromUrl(u.avatar);
      await sql`UPDATE users SET face_vector = ${'[' + emb.join(',') + ']'}::vector, updated_at = now() WHERE id = ${u.id}`;
      console.log(`✓ enrolled ${u.name} (${u.id.slice(0, 8)})`);
      ok++;
    } catch (e) {
      // Most common: no detectable face in the stored avatar.
      console.log(`✗ skipped ${u.name} (${u.id.slice(0, 8)}): ${e.message}`);
      if (String(e.message).includes('422') || String(e.message).includes('empty embedding')) skip++;
      else fail++;
    }
  }

  console.log(`\nDone. enrolled=${ok} no-face=${skip} errors=${fail}`);
  await sql.end({ timeout: 5 });
  process.exit(0);
};

run().catch(async (e) => {
  console.error('Backfill failed:', e.message);
  try { await sql.end({ timeout: 2 }); } catch {}
  process.exit(1);
});
