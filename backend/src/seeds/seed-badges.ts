// seed-badges.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const badges = [
  // ─── GENERAL ───────────────────────────────────────────────
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
    slug: 'founding-member',
    name: 'Founding Member',
    description: 'One of the first members to join RVUnicorn',
    imageUrl: '/images/founding-member.png',
    category: 'GENERAL',
    requirement: 'Join during the founding period',
    triggerType: 'ACCOUNT_CREATED',
    triggerValue: 1,
    sortOrder: 2
  },

  // ─── SOCIAL ────────────────────────────────────────────────
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
    slug: 'first-friend',
    name: 'First Friend',
    description: 'Made your first friend on RVUnicorn',
    imageUrl: '/images/first-friend.png',
    category: 'SOCIAL',
    requirement: 'Add 1 friend',
    triggerType: 'FRIENDS_COUNT',
    triggerValue: 1,
    sortOrder: 11
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
    sortOrder: 12
  },
  {
    slug: 'find-your-herd',
    name: 'Find Your Herd',
    description: 'Connected with 10 fellow RVers',
    imageUrl: '/images/Find_Your_Herd_Default_Poppy.png',
    category: 'SOCIAL',
    requirement: 'Have 10 friends',
    triggerType: 'FRIENDS_COUNT',
    triggerValue: 10,
    sortOrder: 13
  },
  {
    slug: 'top8-member',
    name: 'Top 8 Star',
    description: 'Added to someone\'s Top 8',
    imageUrl: '/images/you_are_a_top8.png',
    category: 'SOCIAL',
    requirement: 'Be in someone\'s Top 8',
    triggerType: 'TOP8_ADDED',
    triggerValue: 1,
    sortOrder: 14
  },
  {
    slug: 'helpful-camper',
    name: 'Helpful Camper',
    description: 'Received 50 upvotes from the community',
    imageUrl: '/images/helpful-camper.png',
    category: 'SOCIAL',
    requirement: 'Receive 50 upvotes',
    triggerType: 'UPVOTES_RECEIVED',
    triggerValue: 50,
    sortOrder: 15
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
    sortOrder: 16
  },
  {
    slug: 'daydreaming',
    name: 'Daydreaming',
    description: 'Wishlisted 10 campgrounds you want to visit',
    imageUrl: '/images/Daydreaming.png',
    category: 'SOCIAL',
    requirement: 'Wishlist 10 campgrounds',
    triggerType: 'WISHLISTED_CAMPGROUNDS',
    triggerValue: 10,
    sortOrder: 17
  },

  // ─── CAMPING ───────────────────────────────────────────────
  {
    slug: 'first-trip',
    name: 'First Adventure',
    description: 'Created your first camping trip',
    imageUrl: '/images/first-trip.png',
    category: 'CAMPING',
    requirement: 'Create a trip',
    triggerType: 'TRIPS_CREATED',
    triggerValue: 1,
    sortOrder: 20
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
    sortOrder: 21
  },
  {
    slug: 'seasoned-camper',
    name: 'Seasoned Camper',
    description: 'Camped for 30 total days',
    imageUrl: '/images/SeasonedCamper.png',
    category: 'CAMPING',
    requirement: '30 days camped',
    triggerType: 'DAYS_CAMPED',
    triggerValue: 30,
    sortOrder: 22
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
    sortOrder: 23
  },
  {
    slug: 'road-warrior',
    name: 'Road Warrior',
    description: 'Lived the RV life for 365 days on the road',
    imageUrl: '/images/road-warrior.png',
    category: 'CAMPING',
    requirement: '365 days camped',
    triggerType: 'DAYS_CAMPED',
    triggerValue: 365,
    sortOrder: 24
  },
  {
    slug: 'trailblazer',
    name: 'Trailblazer',
    description: 'Visited campgrounds in 10 different states',
    imageUrl: '/images/trailblazer.png',
    category: 'CAMPING',
    requirement: 'Visit 10 states',
    triggerType: 'STATES_VISITED',
    triggerValue: 10,
    sortOrder: 25
  },
  {
    slug: 'fifty-state-explorer',
    name: '50 State Explorer',
    description: 'Camped in all 50 states',
    imageUrl: '/images/fifty-state-explorer.png',
    category: 'CAMPING',
    requirement: 'Visit all 50 states',
    triggerType: 'STATES_VISITED',
    triggerValue: 50,
    sortOrder: 26
  },
  {
    slug: 'pacific-drift',
    name: 'Pacific Drift',
    description: 'Camped along the entire Pacific Coast',
    imageUrl: '/images/pacificDrift.png',
    category: 'CAMPING',
    requirement: 'Camp in CA, OR, and WA',
    triggerType: 'STATES_VISITED',
    triggerValue: 3,
    sortOrder: 27
  },
  {
    slug: 'new-england-way',
    name: 'New England Way',
    description: 'Explored campgrounds across New England',
    imageUrl: '/images/NewEngLandway.png',
    category: 'CAMPING',
    requirement: 'Camp in ME, VT, NH, MA, CT, RI',
    triggerType: 'STATES_VISITED',
    triggerValue: 6,
    sortOrder: 28
  },
  {
    slug: 'american-heritage',
    name: 'American Heritage',
    description: 'Visited 5+ historic American campgrounds',
    imageUrl: '/images/AmericanHeritage.png',
    category: 'CAMPING',
    requirement: 'Visit 5 heritage campgrounds',
    triggerType: 'HERITAGE_CAMPGROUNDS',
    triggerValue: 5,
    sortOrder: 29
  },

  // ─── ACHIEVEMENT ───────────────────────────────────────────
  {
    slug: 'show-us-your-rig',
    name: 'Show Us Your Rig',
    description: 'Added your RV details to your profile',
    imageUrl: '/images/showusyourrig.png',
    category: 'ACHIEVEMENT',
    requirement: 'Register your RV',
    triggerType: 'RV_REGISTERED',
    triggerValue: 1,
    sortOrder: 40
  },
  {
    slug: 'maintenance-pro',
    name: 'Maintenance Pro',
    description: 'Logged 10 maintenance records',
    imageUrl: '/images/maintenance_pro.png',
    category: 'ACHIEVEMENT',
    requirement: 'Log 10 maintenance entries',
    triggerType: 'MAINTENANCE_LOGGED',
    triggerValue: 10,
    sortOrder: 41
  },
  {
    slug: 'shutterbug',
    name: 'Shutterbug',
    description: 'Uploaded 10+ photos to your albums',
    imageUrl: '/images/Shutterbug.png',
    category: 'ACHIEVEMENT',
    requirement: 'Upload 10 photos',
    triggerType: 'PHOTOS_UPLOADED',
    triggerValue: 10,
    sortOrder: 42
  },
  {
    slug: 'album-pro',
    name: 'Album Pro',
    description: 'Created 5 photo albums',
    imageUrl: '/images/album-pro.png',
    category: 'ACHIEVEMENT',
    requirement: 'Create 5 albums',
    triggerType: 'ALBUMS_CREATED',
    triggerValue: 5,
    sortOrder: 43
  },
  {
    slug: 'add-photo-album',
    name: 'Memory Maker',
    description: 'Created your first photo album',
    imageUrl: '/images/add_photoalbum_badge.jpeg',
    category: 'ACHIEVEMENT',
    requirement: 'Create 1 album',
    triggerType: 'ALBUMS_CREATED',
    triggerValue: 1,
    sortOrder: 44
  },
  {
    slug: 'first-review',
    name: 'First Impression',
    description: 'Wrote your first campground review',
    imageUrl: '/images/Firstime_review.png',
    category: 'ACHIEVEMENT',
    requirement: 'Write 1 review',
    triggerType: 'REVIEWS_WRITTEN',
    triggerValue: 1,
    sortOrder: 45
  },
  {
    slug: 'campground-critic',
    name: 'Campground Critic',
    description: 'Wrote 5 campground reviews',
    imageUrl: '/images/Campgroundcritic.png',
    category: 'ACHIEVEMENT',
    requirement: 'Write 5 reviews',
    triggerType: 'REVIEWS_WRITTEN',
    triggerValue: 5,
    sortOrder: 46
  },
  {
    slug: 'first-recipe',
    name: 'Camp Cook',
    description: 'Shared your first camp recipe',
    imageUrl: '/images/first-recipe.png',
    category: 'ACHIEVEMENT',
    requirement: 'Share 1 recipe',
    triggerType: 'RECIPES_SHARED',
    triggerValue: 1,
    sortOrder: 47
  },
  {
    slug: 'recipe-master',
    name: 'Recipe Master',
    description: 'Shared 10 camping recipes',
    imageUrl: '/images/RecipeMaster.png',
    category: 'ACHIEVEMENT',
    requirement: 'Share 10 recipes',
    triggerType: 'RECIPES_SHARED',
    triggerValue: 10,
    sortOrder: 48
  },
  {
    slug: 'campfire-chef',
    name: 'Campfire Chef',
    description: 'Shared 25 camping recipes with the community',
    imageUrl: '/images/campfirechef.png',
    category: 'ACHIEVEMENT',
    requirement: 'Share 25 recipes',
    triggerType: 'RECIPES_SHARED',
    triggerValue: 25,
    sortOrder: 49
  },
  {
    slug: 'registered-badge',
    name: 'Fully Registered',
    description: 'Completed your full RV profile with all details',
    imageUrl: '/images/registeredBadge.png',
    category: 'ACHIEVEMENT',
    requirement: 'Complete RV profile',
    triggerType: 'RV_REGISTERED',
    triggerValue: 1,
    sortOrder: 50
  },
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
