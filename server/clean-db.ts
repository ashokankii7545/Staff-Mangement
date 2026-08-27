import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModel } from './src/modules/user/user.model.js';
import { AttendanceModel } from './src/modules/attendance/attendance.model.js';
import { LeaveRequestModel } from './src/modules/leave/leave.model.js';
import { StaffDocumentModel } from './src/modules/document/document.model.js';
import { NotificationModel } from './src/modules/notification/notification.model.js';
import { CounterModel } from './src/modules/user/counter.model.js';

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to Database');

    // 1. Delete all Attendance records
    await AttendanceModel.deleteMany({});
    console.log('🗑️  Deleted all attendance records.');

    // 2. Delete all Leaves
    await LeaveRequestModel.deleteMany({});
    console.log('🗑️  Deleted all leave records.');

    // 3. Delete all Staff Documents
    await StaffDocumentModel.deleteMany({});
    console.log('🗑️  Deleted all staff documents.');

    // 4. Delete all Notifications
    await NotificationModel.deleteMany({});
    console.log('🗑️  Deleted all notifications.');

    // 5. Delete all Users EXCEPT Admins
    const result = await UserModel.deleteMany({ role: { $ne: 'ADMIN' } });
    console.log(`🗑️  Deleted ${result.deletedCount} non-admin users.`);

    // 6. Reset Employee ID Counter back to 1000
    await CounterModel.findOneAndUpdate(
      { _id: 'userId' },
      { seq: 1000 },
      { upsert: true }
    );
    console.log('🔄 Reset employee ID counter to 1000.');

    console.log('✨ Database cleaned successfully! Only Admin remains.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
