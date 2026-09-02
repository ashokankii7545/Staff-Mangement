import postgres from 'postgres';
const sql = postgres('postgresql://postgres.pydxqjgtsrzddglpzgsw:Manish%4070040@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres');
async function run() {
  try {
    const res = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'settings'`;
    console.log("Columns in DB for settings:");
    console.log(res.map(r => r.column_name));
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}
run();
