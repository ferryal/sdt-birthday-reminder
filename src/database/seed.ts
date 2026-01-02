import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { BirthdayMessage } from '../birthday/entities/birthday-message.entity';

/**
 * Seed script to populate the database with sample users for testing
 *
 * Usage:
 *   npm run seed        - Add sample users
 *   npm run seed:clear  - Clear all data and add sample users
 */

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'birthday_user',
  password: process.env.DATABASE_PASSWORD || 'birthday_pass',
  database: process.env.DATABASE_NAME || 'birthday_db',
  entities: [User, BirthdayMessage],
  synchronize: false,
});

// Get today's date for birthday users
const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

// Sample users with different timezones
const sampleUsers = [
  // ========================================
  // INDONESIA - WIB (Asia/Jakarta) UTC+7
  // Jakarta, Tangerang, Bogor, Semarang, Surabaya, Bandung
  // ========================================
  {
    firstName: 'Budi',
    lastName: 'Jakarta',
    email: 'budi.jakarta@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jakarta',
  },
  {
    firstName: 'Dewi',
    lastName: 'Tangerang',
    email: 'dewi.tangerang@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jakarta',
  },
  {
    firstName: 'Agus',
    lastName: 'Bogor',
    email: 'agus.bogor@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jakarta',
  },
  {
    firstName: 'Siti',
    lastName: 'Semarang',
    email: 'siti.semarang@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jakarta',
  },
  {
    firstName: 'Eko',
    lastName: 'Surabaya',
    email: 'eko.surabaya@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jakarta',
  },
  {
    firstName: 'Rina',
    lastName: 'Bandung',
    email: 'rina.bandung@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jakarta',
  },
  {
    firstName: 'Andi',
    lastName: 'Yogyakarta',
    email: 'andi.yogyakarta@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jakarta',
  },
  {
    firstName: 'Mega',
    lastName: 'Bekasi',
    email: 'mega.bekasi@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jakarta',
  },
  // ========================================
  // INDONESIA - WITA (Asia/Makassar) UTC+8
  // Bali, Makassar, Balikpapan
  // ========================================
  {
    firstName: 'Wayan',
    lastName: 'Bali',
    email: 'wayan.bali@example.com',
    birthday: todayStr,
    timezone: 'Asia/Makassar',
  },
  {
    firstName: 'Rudi',
    lastName: 'Makassar',
    email: 'rudi.makassar@example.com',
    birthday: todayStr,
    timezone: 'Asia/Makassar',
  },
  {
    firstName: 'Putri',
    lastName: 'Balikpapan',
    email: 'putri.balikpapan@example.com',
    birthday: todayStr,
    timezone: 'Asia/Makassar',
  },
  // ========================================
  // INDONESIA - WIT (Asia/Jayapura) UTC+9
  // Papua
  // ========================================
  {
    firstName: 'Yohanes',
    lastName: 'Jayapura',
    email: 'yohanes.jayapura@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jayapura',
  },
  {
    firstName: 'Maria',
    lastName: 'Sorong',
    email: 'maria.sorong@example.com',
    birthday: todayStr,
    timezone: 'Asia/Jayapura',
  },
  // ========================================
  // INTERNATIONAL (for comparison)
  // ========================================
  {
    firstName: 'John',
    lastName: 'NewYork',
    email: 'john.newyork@example.com',
    birthday: todayStr,
    timezone: 'America/New_York',
  },
  {
    firstName: 'Sarah',
    lastName: 'Melbourne',
    email: 'sarah.melbourne@example.com',
    birthday: todayStr,
    timezone: 'Australia/Melbourne',
  },
  {
    firstName: 'Yuki',
    lastName: 'Tokyo',
    email: 'yuki.tokyo@example.com',
    birthday: todayStr,
    timezone: 'Asia/Tokyo',
  },
  {
    firstName: 'Emma',
    lastName: 'London',
    email: 'emma.london@example.com',
    birthday: todayStr,
    timezone: 'Europe/London',
  },
  // Users with TOMORROW's birthday (for next day test)
  {
    firstName: 'Joko',
    lastName: 'Tomorrow',
    email: 'joko.tomorrow@example.com',
    birthday: '2026-01-02',
    timezone: 'Asia/Jakarta',
  },
];

async function seed() {
  const clearData = process.argv.includes('--clear');

  console.log('🌱 Starting database seed...');

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const userRepository = dataSource.getRepository(User);
    const messageRepository = dataSource.getRepository(BirthdayMessage);

    if (clearData) {
      console.log('🗑️  Clearing existing data...');
      await messageRepository.createQueryBuilder().delete().execute();
      await userRepository.createQueryBuilder().delete().execute();
      console.log('✅ Data cleared');
    }

    console.log('👥 Creating sample users...');

    for (const userData of sampleUsers) {
      // Check if user already exists
      const existing = await userRepository.findOne({
        where: { email: userData.email },
      });

      if (existing) {
        console.log(`   ⏭️  User ${userData.email} already exists, skipping`);
        continue;
      }

      const user = userRepository.create({
        ...userData,
        birthdayMonth: new Date(userData.birthday).getMonth() + 1,
        birthdayDay: new Date(userData.birthday).getDate(),
      });

      await userRepository.save(user);
      console.log(
        `   ✅ Created: ${userData.firstName} ${userData.lastName} (${userData.timezone})`,
      );
    }

    // Summary
    const totalUsers = await userRepository.count();
    const todayBirthdays = await userRepository.count({
      where: {
        birthdayMonth: today.getMonth() + 1,
        birthdayDay: today.getDate(),
      },
    });

    console.log('\n📊 Summary:');
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Users with birthday today: ${todayBirthdays}`);
    console.log('\n🎉 Seed completed successfully!');

    console.log('\n📝 Next steps:');
    console.log('   1. Run the app: npm run start:dev');
    console.log('   2. Watch logs for birthday messages being processed');
    console.log(
      '   3. Check database: docker exec birthday-postgres psql -U birthday_user -d birthday_db -c "SELECT * FROM birthday_messages;"',
    );
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

seed();
