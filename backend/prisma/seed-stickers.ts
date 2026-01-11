import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding stickers...');

  // Get all campgrounds
  const campgrounds = await prisma.campground.findMany();

  if (campgrounds.length === 0) {
    console.log('No campgrounds found. Please run seed-campsites.ts first.');
    return;
  }

  // Create stickers for each campground
  for (const campground of campgrounds) {
    console.log(`Creating stickers for ${campground.name}...`);

    // Sticker 1: First Timer
    await prisma.sticker.create({
      data: {
        campgroundId: campground.id,
        name: 'First Timer',
        description: 'Stayed at our campground for the first time!',
        artworkUrl: '/uploads/stickers/first-timer.png',
        criteria: 'Complete your first stay at our campground',
        isLimited: false,
      }
    });

    // Sticker 2: Weekend Warrior
    await prisma.sticker.create({
      data: {
        campgroundId: campground.id,
        name: 'Weekend Warrior',
        description: 'Visited us on 5 different weekends',
        artworkUrl: '/uploads/stickers/weekend-warrior.png',
        criteria: 'Stay with us for 5 weekend visits',
        isLimited: false,
      }
    });

    // Sticker 3: Season Pass Holder
    await prisma.sticker.create({
      data: {
        campgroundId: campground.id,
        name: 'Season Pass Holder',
        description: 'Stayed with us 10+ nights in a single season',
        artworkUrl: '/uploads/stickers/season-pass.png',
        criteria: 'Accumulate 10 nights in one camping season',
        isLimited: false,
      }
    });

    // Sticker 4: Event Participant
    await prisma.sticker.create({
      data: {
        campgroundId: campground.id,
        name: 'Event Participant',
        description: 'Joined one of our special campground events',
        artworkUrl: '/uploads/stickers/event-participant.png',
        criteria: 'Attend any campground-hosted event',
        isLimited: false,
      }
    });

    // Sticker 5: Limited Edition - Grand Opening (Limited to 50 people)
    await prisma.sticker.create({
      data: {
        campgroundId: campground.id,
        name: '2025 Grand Opening',
        description: 'Limited edition sticker for early season campers!',
        artworkUrl: '/uploads/stickers/grand-opening-2025.png',
        criteria: 'Stay with us during our 2025 grand opening weekend',
        isLimited: true,
        maxEarners: 50,
      }
    });

    // Sticker 6: Explorer
    await prisma.sticker.create({
      data: {
        campgroundId: campground.id,
        name: 'Trail Explorer',
        description: 'Hiked all our nature trails',
        artworkUrl: '/uploads/stickers/trail-explorer.png',
        criteria: 'Complete all hiking trails on our property',
        isLimited: false,
      }
    });

    // Sticker 7: Social Butterfly
    await prisma.sticker.create({
      data: {
        campgroundId: campground.id,
        name: 'Social Butterfly',
        description: 'Made friends and shared camping stories',
        artworkUrl: '/uploads/stickers/social-butterfly.png',
        criteria: 'Attend a community campfire and share your story',
        isLimited: false,
      }
    });

    // Sticker 8: Family Reunion (Limited to 100)
    await prisma.sticker.create({
      data: {
        campgroundId: campground.id,
        name: 'Family Reunion Host',
        description: 'Hosted a family reunion at our campground',
        artworkUrl: '/uploads/stickers/family-reunion.png',
        criteria: 'Host a family gathering of 10+ people',
        isLimited: true,
        maxEarners: 100,
      }
    });

    console.log(`  - Created 8 stickers for ${campground.name}`);
  }

  console.log('Sticker seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
