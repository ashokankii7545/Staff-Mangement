import { sql } from './config/drizzle.js';
import { userRepository } from './modules/user/user.repository.js';
import { settingsRepository } from './modules/settings/settings.repository.js';

const seed = async (): Promise<void> => {
  console.log('\n🌱 Seeding database…\n');

  // Create admin user (idempotent by employeeId).
  const existingAdmin = await userRepository.queries.findByEmployeeId('ADMIN001');
  if (!existingAdmin) {
    await userRepository.queries.create({
      employeeId: 'ADMIN001',
      name: 'Manish',
      email: 'tgyan065@gmail.com',
      password: 'admin123',
      role: 'ADMIN',
      department: 'Management',
      loginMethod: 'PASSWORD',
    });
    console.log('✅ Admin created:');
    console.log('   Employee ID: ADMIN001');
    console.log('   Password: admin123');
    console.log('   Email: tgyan065@gmail.com');
    console.log('   (Can also login with Google using this email)');
  } else {
    console.log('ℹ️  Admin already exists: ADMIN001');
  }

  // Create default settings (single-row, lazily created).
  const existingSettings = await settingsRepository.queries.findFirst();
  if (!existingSettings) {
    const created = await settingsRepository.queries.getOrCreate();
    await settingsRepository.queries.updateById(String(created._id), {
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
  await sql.end({ timeout: 5 });
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
