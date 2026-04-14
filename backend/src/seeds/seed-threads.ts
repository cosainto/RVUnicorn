import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

async function main() {
  console.log('🧵 Seeding sample threads...');

  // Get a user to be the author
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('❌ No users found. Create a user first!');
    return;
  }

  // Get some campgrounds
  const campgrounds = await prisma.campground.findMany({ take: 5 });
  
  // Get tags
  const tags = await prisma.threadTag.findMany();
  const questionTag = tags.find((t: any) => t.slug === 'question');
  const tipsTag = tags.find((t: any) => t.slug === 'tips-tricks');
  const reviewTag = tags.find((t: any) => t.slug === 'review');
  const gearTag = tags.find((t: any) => t.slug === 'gear');
  const wildlifeTag = tags.find((t: any) => t.slug === 'wildlife');

  const sampleThreads = [
    {
      title: 'Best time to visit national parks?',
      content: 'Planning my first big camping trip and wondering when the best time to visit would be. I want to avoid crowds but still have good weather. Any recommendations?',
      slug: 'best-time-visit-national-parks-' + Date.now().toString(36),
      authorId: user.id,
      campgroundId: campgrounds[0]?.id || null,
      tags: questionTag ? [questionTag.id] : []
    },
    {
      title: '10 Essential Camping Hacks Everyone Should Know',
      content: `Here are my top camping hacks after years of experience:\n\n1. Use a headlamp instead of a flashlight - keeps hands free\n2. Freeze water bottles to use as ice packs\n3. Bring extra tarps - they have 100 uses\n4. Pack clothes in compression bags\n5. Bring a portable phone charger\n6. Use sage in your campfire to repel mosquitoes\n7. Line your cooler with aluminum foil\n8. Bring a small first aid kit\n9. Pack baby wipes for quick cleanups\n10. Always bring extra socks!\n\nWhat are your favorite camping hacks?`,
      slug: 'essential-camping-hacks-' + Date.now().toString(36),
      authorId: user.id,
      campgroundId: null,
      tags: tipsTag ? [tipsTag.id] : []
    },
    {
      title: 'Amazing weekend at Yellowstone!',
      content: 'Just got back from an incredible 3-day trip to Yellowstone. The geysers were spectacular and we even saw a family of bears from a safe distance. The campground was clean and well-maintained. Highly recommend booking early - spots fill up fast!',
      slug: 'amazing-weekend-yellowstone-' + Date.now().toString(36),
      authorId: user.id,
      campgroundId: campgrounds[1]?.id || null,
      tags: reviewTag ? [reviewTag.id] : []
    },
    {
      title: 'Tent recommendations for family of 4?',
      content: 'Looking for a reliable tent that can fit our family of 4 (2 adults, 2 kids). Budget is around $300-400. We mostly do car camping in mild weather. Any suggestions?',
      slug: 'tent-recommendations-family-' + Date.now().toString(36),
      authorId: user.id,
      campgroundId: null,
      tags: gearTag && questionTag ? [gearTag.id, questionTag.id] : []
    },
    {
      title: 'Bear encounter tips - stay safe out there!',
      content: `Had a close call with a black bear last weekend. Sharing what I learned:\n\n• ALWAYS store food in bear canisters or hang it properly\n• Make noise while hiking\n• Never run from a bear\n• Carry bear spray and know how to use it\n• Keep a clean campsite\n\nStay safe everyone!`,
      slug: 'bear-encounter-tips-' + Date.now().toString(36),
      authorId: user.id,
      campgroundId: campgrounds[2]?.id || null,
      tags: wildlifeTag && tipsTag ? [wildlifeTag.id, tipsTag.id] : []
    }
  ];

  for (const threadData of sampleThreads) {
    const { tags, ...data } = threadData;
    
    const thread = await prisma.thread.create({
      data: {
        ...data,
        tags: tags.length > 0 ? {
          create: tags.map(tagId => ({ tagId }))
        } : undefined
      }
    });
    
    console.log(`  ✅ Created: ${thread.title}`);

    // Add a sample reply
    await prisma.threadPost.create({
      data: {
        content: 'Great post! Thanks for sharing this with the community.',
        threadId: thread.id,
        authorId: user.id
      }
    });
  }

  console.log('\n✨ Sample threads seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
