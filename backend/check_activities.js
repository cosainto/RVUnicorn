const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activities = await prisma.activity.findMany({
    where: { type: 'RECIPE_COMMENTED' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('RECIPE_COMMENTED activities:', activities.length);
  activities.forEach(a => {
    console.log('userId:', a.userId, '| targetUserId:', a.targetUserId, '| recipeId:', a.recipeId, '| content:', a.content?.substring(0,30));
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
