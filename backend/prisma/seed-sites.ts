import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding campsite sites...');

  const campgrounds = await prisma.campground.findMany();

  if (campgrounds.length === 0) {
    console.log('No campgrounds found. Please run seed-campsites.ts first.');
    return;
  }

  for (const campground of campgrounds) {
    console.log(`Creating sites for ${campground.name}...`);

    // Tent Sites (5-10 sites)
    const tentCount = Math.floor(Math.random() * 6) + 5;
    for (let i = 1; i <= tentCount; i++) {
      await prisma.campsiteSite.create({
        data: {
          campgroundId: campground.id,
          name: `Tent Site ${i}`,
          siteNumber: `T${i.toString().padStart(2, '0')}`,
          siteType: 'TENT',
          description: 'Primitive tent camping site with fire ring and picnic table',
          maxOccupancy: 6,
          amenities: ['FIRE_RING', 'PICNIC_TABLE', 'LANTERN_POST'],
          pricePerNight: 25 + Math.floor(Math.random() * 15),
        }
      });
    }

    // RV Sites (8-15 sites)
    const rvCount = Math.floor(Math.random() * 8) + 8;
    for (let i = 1; i <= rvCount; i++) {
      const hasFullHookup = Math.random() > 0.3;
      await prisma.campsiteSite.create({
        data: {
          campgroundId: campground.id,
          name: `RV Site ${i}`,
          siteNumber: `RV${i.toString().padStart(2, '0')}`,
          siteType: 'RV',
          description: hasFullHookup 
            ? 'Full hookup RV site with water, electric (50A), and sewer'
            : 'RV site with water and electric (30A)',
          maxOccupancy: 8,
          amenities: hasFullHookup 
            ? ['WATER', 'ELECTRIC_50A', 'SEWER', 'PICNIC_TABLE', 'FIRE_RING']
            : ['WATER', 'ELECTRIC_30A', 'PICNIC_TABLE', 'FIRE_RING'],
          pricePerNight: hasFullHookup ? 65 + Math.floor(Math.random() * 25) : 45 + Math.floor(Math.random() * 20),
        }
      });
    }

    // Cabins (2-5 cabins)
    const cabinCount = Math.floor(Math.random() * 4) + 2;
    for (let i = 1; i <= cabinCount; i++) {
      await prisma.campsiteSite.create({
        data: {
          campgroundId: campground.id,
          name: `Cabin ${i}`,
          siteNumber: `C${i.toString().padStart(2, '0')}`,
          siteType: 'CABIN',
          description: 'Rustic cabin with beds, heating, and electricity. Bring your own linens.',
          maxOccupancy: 4 + Math.floor(Math.random() * 4),
          amenities: ['BEDS', 'HEATING', 'ELECTRIC', 'PORCH', 'FIRE_RING'],
          pricePerNight: 125 + Math.floor(Math.random() * 75),
        }
      });
    }

    // Glamping (1-3 sites)
    const glampingCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 1; i <= glampingCount; i++) {
      await prisma.campsiteSite.create({
        data: {
          campgroundId: campground.id,
          name: `Glamping Safari Tent ${i}`,
          siteNumber: `G${i.toString().padStart(2, '0')}`,
          siteType: 'GLAMPING',
          description: 'Luxury safari tent with real beds, linens, heating, and private bathroom',
          maxOccupancy: 4,
          amenities: ['BEDS', 'LINENS', 'HEATING', 'PRIVATE_BATHROOM', 'DECK', 'FIRE_RING', 'MINI_FRIDGE'],
          pricePerNight: 200 + Math.floor(Math.random() * 100),
        }
      });
    }

    // Group Sites (1-2 sites)
    const groupCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 1; i <= groupCount; i++) {
      await prisma.campsiteSite.create({
        data: {
          campgroundId: campground.id,
          name: `Group Site ${i}`,
          siteNumber: `GRP${i.toString().padStart(2, '0')}`,
          siteType: 'GROUP',
          description: 'Large group camping area with multiple fire rings and picnic tables',
          maxOccupancy: 25 + Math.floor(Math.random() * 25),
          amenities: ['FIRE_RINGS', 'PICNIC_TABLES', 'PAVILION', 'WATER_ACCESS'],
          pricePerNight: 150 + Math.floor(Math.random() * 100),
        }
      });
    }

    console.log(`  - Created sites for ${campground.name}`);
  }

  console.log('Site seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
