const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function test() {
  const user = await prisma.user.findUnique({
    where: { email: 'test@test.com' }
  });
  
  if (!user) {
    console.log('User not found!');
    process.exit(1);
  }
  
  console.log('User found:', user.email);
  console.log('Stored hash:', user.password);
  
  const testPassword = 'password123';
  const isValid = await bcrypt.compare(testPassword, user.password);
  
  console.log('Password test with "password123":', isValid);
  
  const newHash = await bcrypt.hash('password123', 10);
  console.log('New hash for comparison:', newHash);
  const isNewValid = await bcrypt.compare('password123', newHash);
  console.log('New hash valid:', isNewValid);
  
  process.exit(0);
}

test();
