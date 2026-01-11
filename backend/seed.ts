import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@kindletribe.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin',
      role: 'ADMIN',
      bio: 'KindleTribe Administrator',
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create invite code
  await prisma.inviteCode.create({
    data: {
      code: 'WELCOME2025',
      isUsed: false,
    },
  });

  console.log('✅ Invite code created: WELCOME2025');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

