import { ne } from 'drizzle-orm';
import { db, sql } from './src/config/drizzle.js';
import {
  attendance,
  leaveRequests,
  documents,
  notifications,
  users,
  counters,
} from './src/db/schema/index.js';

/**
 * Danger: wipes operational data and all NON-admin users, then resets the
 * employee-ID counter. Admin accounts are preserved. Postgres/Drizzle version.
 */
async function run() {
  try {
    await db.delete(attendance);
    console.log('🗑️  Deleted all attendance records.');

    await db.delete(leaveRequests);
    console.log('🗑️  Deleted all leave records.');

    await db.delete(documents);
    console.log('🗑️  Deleted all staff documents.');

    await db.delete(notifications);
    console.log('🗑️  Deleted all notifications.');

    // FK cascades from users → attendance/leaves/etc are already cleared above.
    const deleted = await db.delete(users).where(ne(users.role, 'ADMIN')).returning({ id: users.id });
    console.log(`🗑️  Deleted ${deleted.length} non-admin users.`);

    await db
      .insert(counters)
      .values({ id: 'employeeId', seq: 1000 })
      .onConflictDoUpdate({ target: counters.id, set: { seq: 1000 } });
    console.log('🔄 Reset employee ID counter to 1000.');

    console.log('✨ Database cleaned successfully! Only Admin remains.');
    await sql.end({ timeout: 5 });
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
