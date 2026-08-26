import 'dotenv/config';
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// PURGE NON-ADMIN USERS
// Deletes every user whose role is NOT 'ADMIN', plus all of their related
// records (attendance / leaves / regularizations / notifications / exemptions).
// Admin accounts and admin-created reference data are left untouched.
// ─────────────────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI missing in environment');
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
const db = mongoose.connection.db;

const usersCol = db.collection('users');
const victims = await usersCol
  .find({ role: { $ne: 'ADMIN' } }, { projection: { _id: 1, email: 1, employeeId: 1 } })
  .toArray();
const ids = victims.map((u) => u._id);

console.log(`Found ${ids.length} non-admin account(s):`);
victims.forEach((u) => console.log(`  - ${u.employeeId || '(no id)'} ${u.email || ''}`));

if (ids.length === 0) {
  console.log('Nothing to purge.');
  await mongoose.disconnect();
  process.exit(0);
}

let total = 0;
for (const name of ['attendances', 'leaverequests', 'regularizations', 'notifications', 'exemptions']) {
  try {
    const col = db.collection(name);
    const own = await col.deleteMany({ user: { $in: ids } });
    if (own.deletedCount) console.log(`  ${name}: ${own.deletedCount} record(s) removed`);
    total += own.deletedCount;
    const byCreator = await col.deleteMany({ createdBy: { $in: ids } });
    if (byCreator.deletedCount) console.log(`  ${name} (createdBy): ${byCreator.deletedCount}`);
    total += byCreator.deletedCount;
  } catch (err) {
    console.warn(`  skip ${name}: ${err.message}`);
  }
}

const ru = await usersCol.deleteMany({ _id: { $in: ids } });
console.log(`Users deleted: ${ru.deletedCount}`);

const remaining = await usersCol.find({}, { projection: { employeeId: 1, email: 1, role: 1 } }).toArray();
console.log('\nRemaining accounts:');
remaining.forEach((u) => console.log(`  [${u.role}] ${u.employeeId} ${u.email || ''}`));
console.log(`\nDone. ${total} related record(s) cleaned.`);

await mongoose.disconnect();