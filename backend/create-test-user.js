const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createUser() {
  try {
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: 'test@test.com' }
    });

    if (existing) {
      console.log('User already exists, updating password...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      await prisma.user.update({
        where: { email: 'test@test.com' },
        data: { password: hashedPassword }
      });
      console.log('Password updated!');
    } else {
      console.log('Creating new user...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      const user = await prisma.user.create({
        data: {
          email: 'test@test.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser',
          // role: 'USER'  // ❌ remove this line
        }
      });
      console.log('User created:', user.email);
    }

    console.log('');
    console.log('Login with:');
    console.log('Email: test@test.com');
    console.log('Password: password123');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();

