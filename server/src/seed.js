import { config } from './config/environment.js';
import connectDB from './config/db.js';
import User from './models/User.js';
import Settings from './models/Settings.js';
import mongoose from 'mongoose';

const seed = async () => {
  await connectDB();
  
  console.log('🌱 Seeding database...\n');
  
  // Create admin user with your email
  const existingAdmin = await User.findOne({ employeeId: 'ADMIN001' });
  if (!existingAdmin) {
    await User.create({
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
  const existingSettings = await Settings.findOne();
  if (!existingSettings) {
    await Settings.create({
      officeLatitude: 28.6139,
      officeLongitude: 77.2090,
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
