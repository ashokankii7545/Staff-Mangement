import mongoose from 'mongoose';
import { database } from './config/db.js';
import { logger } from './shared/logger/logger.js';
import { UserModel } from './modules/user/user.model.js';
import { SettingsModel } from './modules/settings/settings.model.js';

const seed = async (): Promise<void> => {
  await database.connect();

  console.log('\n🌱 Seeding database…\n');

  // Create admin user with your email
  const existingAdmin = await UserModel.findOne({ employeeId: 'ADMIN001' });
  if (!existingAdmin) {
    await UserModel.create({
      employeeId: 'ADMIN001',
      name: 'Manish',
      email: 'tgayn065@gmail.com',
      password: 'admin123',
      role: 'ADMIN',
      department: 'Management',
      loginMethod: 'PASSWORD',
    });
    console.log('✅ Admin created:');
    console.log('   Employee ID: ADMIN001');
    console.log('   Password: admin123');
    console.log('   Email: tgayn065@gmail.com');
    console.log('   (Can also login with Google using this email)');
  } else {
    console.log('ℹ️  Admin already exists: ADMIN001');
  }

  // Create default settings
  const existingSettings = await SettingsModel.findOne();
  if (!existingSettings) {
    await SettingsModel.create({
      officeLatitude: 28.6139,
      officeLongitude: 77.209,
      officeName: 'Head Office - Delhi',
      geofenceRadius: 200,
      shiftStartTime: '09:00',
      shiftEndTime: '18:00',
      lateThresholdMinutes: 15,
    });
    console.log('✅ Default settings created (Delhi, 200m geofence)');
  } else {
    console.log('ℹ️  Settings already exist');
  }

  console.log('\n🎉 Seeding complete!\n');
  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
