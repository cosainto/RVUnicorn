const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    console.log('Finding orphaned photos...');
    
    // Delete photos where albumId doesn't exist in Album table
    const result = await prisma.$executeRaw`
      DELETE FROM "Photo" 
      WHERE "albumId" NOT IN (SELECT "id" FROM "Album")
    `;
    
    console.log(`✅ Deleted ${result} orphaned photos`);
  } catch (error) {
    console.error('Cleanup error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
