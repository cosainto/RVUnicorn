const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 'cmjzxinqu00001auvffzsyutl';

  const activity = await prisma.activity.findFirst({
    where: { content: 'test to like', type: 'RECIPE_COMMENTED' },
    include: { recipe: true }
  });

  if (activity === null) {
    console.log('Activity not found');
    return;
  }

  console.log('Activity recipeId:', activity.recipeId);
  console.log('Activity content:', activity.content);

  const comment = await prisma.recipeComment.findFirst({
    where: {
      recipeId: activity.recipeId,
      content: activity.content
    },
    include: {
      _count: { select: { likes: true } },
      likes: { where: { userId }, take: 1 }
    }
  });

  if (comment) {
    console.log('Comment found:', comment.id);
    console.log('Like count:', comment._count.likes);
    console.log('User likes:', comment.likes.length);
    console.log('userHasLiked would be:', comment.likes.length > 0);
  } else {
    console.log('Comment NOT found');
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
