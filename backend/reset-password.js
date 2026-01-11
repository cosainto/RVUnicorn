const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function reset() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user = await prisma.user.update({
    where: { email: 'test@test.com' },
    data: { password: hashedPassword }
  });
  
  console.log('Password reset for:', user.email);
  console.log('New hash:', hashedPassword);
  
  // Verify it works
  const isValid = await bcrypt.compare('password123', hashedPassword);
  console.log('Verification:', isValid);
  
  process.exit(0);
}

reset();
