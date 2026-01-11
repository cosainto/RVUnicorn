// seed-badges.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const badges = [
  {
    slug: 'rvunicorn-member',
    name: 'RVUnicorn Member',
    description: 'Joined the RVUnicorn community',
    imageUrl: '/images/Logo_RVUnicorn.png',
    category: 'GENERAL',
    requirement: 'Create an account',
    triggerType: 'ACCOUNT_CREATED',
    triggerValue: 1,
    sortOrder: 1
  },
  {
    slug: 'welcome-to-club',
    name: 'Welcome to the Club',
    description: 'Joined your first RV group',
    imageUrl: '/images/Welcome_to_the_Club.png',
    category: 'SOCIAL',
    requirement: 'Join a group',
    triggerType: 'GROUP_JOINED',
    triggerValue: 1,
    sortOrder: 10
  },
  {
    slug: 'weekend-warrior',
    name: 'Weekend Warrior',
    description: 'Spent 10 weekends at campgrounds',
    imageUrl: '/images/Weekendwarriorbadge.png',
    category: 'CAMPING',
    requirement: '10 weekend stays',
    triggerType: 'WEEKEND_STAYS',
    triggerValue: 10,
    sortOrder: 20
  },
  {
    slug: 'true-camper',
    name: 'True Camper',
    description: 'Camped for over 90 days total',
    imageUrl: '/images/TruecamperBadge.png',
    category: 'CAMPING',
    requirement: '90+ days camped',
    triggerType: 'DAYS_CAMPED',
    triggerValue: 90,
    sortOrder: 21
  },
  {
    slug: 'social-butterfly',
    name: 'Social Butterfly',
    description: 'Made 25 friends in the community',
    imageUrl: '/images/social-butterfly.png',
    category: 'SOCIAL',
    requirement: 'Have 25 friends',
    triggerType: 'FRIENDS_COUNT',
    triggerValue: 25,
    sortOrder: 11
  },
  {
    slug: 'first-trip',
    name: 'First Adventure',
    description: 'Created your first camping trip',
    imageUrl: '/images/first-trip.png',
    category: 'CAMPING',
    requirement: 'Create a trip',
    triggerType: 'TRIPS_CREATED',
    triggerValue: 1,
    sortOrder: 22
  },
  {
    slug: 'trailblazer',
    name: 'Trailblazer',
    description: 'Visited 10 different states',
    imageUrl: '/images/trailblazer.png',
    category: 'CAMPING',
    requirement: 'Visit 10 states',
    triggerType: 'STATES_VISITED',
    triggerValue: 10,
    sortOrder: 30
  },
  {
    slug: 'recipe-master',
    name: 'Recipe Master',
    description: 'Shared 10 camping recipes',
    imageUrl: '/images/recipe-master.png',
    category: 'ACHIEVEMENT',
    requirement: 'Share 10 recipes',
    triggerType: 'RECIPES_SHARED',
    triggerValue: 10,
    sortOrder: 40
  },
  {
    slug: 'campground-critic',
    name: 'Campground Critic',
    description: 'Wrote 5 campground reviews',
    imageUrl: '/images/campground-critic.png',
    category: 'ACHIEVEMENT',
    requirement: 'Write 5 reviews',
    triggerType: 'REVIEWS_WRITTEN',
    triggerValue: 5,
    sortOrder: 41
  },
  {
    slug: 'storyteller',
    name: 'Storyteller',
    description: 'Created 25 posts sharing your adventures',
    imageUrl: '/images/storyteller.png',
    category: 'SOCIAL',
    requirement: 'Create 25 posts',
    triggerType: 'POSTS_CREATED',
    triggerValue: 25,
    sortOrder: 43
  }
];

async function seedBadges() {
  console.log('🏆 Seeding badges...');

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: badge,
      create: badge
    });
    console.log(`  ✓ ${badge.name}`);
  }

  console.log(`\n✅ Seeded ${badges.length} badges`);
}

seedBadges()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
