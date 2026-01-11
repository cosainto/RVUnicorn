import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding campsites...');

  // Create some sample campsites
  const campsites = [
    {
      name: 'Grand Canyon KOA',
      slug: 'grand-canyon-koa',
      description: 'Premier camping near the Grand Canyon',
      fullDescription: 'Experience the majestic Grand Canyon from our full-service campground. We offer RV sites with full hookups, tent sites, and cabin rentals. Amenities include a swimming pool, hot tub, mini golf, and a camp store.',
      location: 'Williams, Arizona',
      state: 'Arizona',
      amenities: ['Full Hookups', 'WiFi', 'Pool', 'Hot Tub', 'Showers', 'Laundry', 'Store', 'Playground'],
      imageUrl: '/uploads/campsites/grand-canyon-koa.jpg',
      nightlyRate: 65.00,
      phone: '(928) 635-2307',
      email: 'info@grandcanyonkoa.com',
      website: 'https://koa.com/campgrounds/grand-canyon',
      socialLinks: {
        facebook: 'https://facebook.com/grandcanyonkoa',
        instagram: 'https://instagram.com/grandcanyonkoa',
      },
      hours: {
        monday: '8:00 AM - 10:00 PM',
        tuesday: '8:00 AM - 10:00 PM',
        wednesday: '8:00 AM - 10:00 PM',
        thursday: '8:00 AM - 10:00 PM',
        friday: '8:00 AM - 10:00 PM',
        saturday: '8:00 AM - 10:00 PM',
        sunday: '8:00 AM - 10:00 PM',
      },
      bathroomSchedule: 'Bathrooms cleaned daily at 9:00 AM and 4:00 PM',
    },
    {
      name: 'Yellowstone Under Canvas',
      slug: 'yellowstone-under-canvas',
      description: 'Luxury glamping near Yellowstone National Park',
      fullDescription: 'Immerse yourself in nature without sacrificing comfort. Our luxury safari tents and tipis offer a unique glamping experience just minutes from Yellowstone. Each tent features real beds, wood-burning stoves, and private bathrooms.',
      location: 'West Yellowstone, Montana',
      state: 'Montana',
      amenities: ['Glamping', 'Private Bathrooms', 'Restaurant', 'Fire Pits', 'WiFi', 'Hot Showers'],
      imageUrl: '/uploads/campsites/yellowstone-canvas.jpg',
      nightlyRate: 289.00,
      phone: '(406) 219-0441',
      email: 'info@undercanvas.com',
      website: 'https://www.undercanvas.com/camps/yellowstone',
      socialLinks: {
        facebook: 'https://facebook.com/undercanvas',
        instagram: 'https://instagram.com/undercanvas',
      },
      hours: {
        monday: '7:00 AM - 9:00 PM',
        tuesday: '7:00 AM - 9:00 PM',
        wednesday: '7:00 AM - 9:00 PM',
        thursday: '7:00 AM - 9:00 PM',
        friday: '7:00 AM - 9:00 PM',
        saturday: '7:00 AM - 9:00 PM',
        sunday: '7:00 AM - 9:00 PM',
      },
      restaurantMenu: {
        breakfast: ['Pancakes - $12', 'Eggs & Bacon - $14', 'Oatmeal - $8'],
        lunch: ['Burgers - $16', 'Salads - $14', 'Sandwiches - $12'],
        dinner: ['Steak - $32', 'Salmon - $28', 'Pasta - $18'],
      },
    },
    {
      name: 'Acadia Oceanside Campground',
      slug: 'acadia-oceanside',
      description: 'Ocean views and coastal camping in Maine',
      fullDescription: 'Wake up to the sound of waves at our oceanfront campground near Acadia National Park. We offer tent sites, RV sites, and cozy cabins with stunning ocean views. Enjoy fresh lobster at our on-site seafood restaurant.',
      location: 'Bar Harbor, Maine',
      state: 'Maine',
      amenities: ['Ocean Front', 'Full Hookups', 'Restaurant', 'WiFi', 'Showers', 'Lobster Pound', 'Boat Launch'],
      imageUrl: '/uploads/campsites/acadia-oceanside.jpg',
      nightlyRate: 75.00,
      phone: '(207) 288-5703',
      email: 'info@acadiaoceanside.com',
      website: 'https://www.acadiaoceanside.com',
      socialLinks: {
        facebook: 'https://facebook.com/acadiaoceanside',
        instagram: 'https://instagram.com/acadiaoceanside',
      },
      hours: {
        monday: '6:00 AM - 11:00 PM',
        tuesday: '6:00 AM - 11:00 PM',
        wednesday: '6:00 AM - 11:00 PM',
        thursday: '6:00 AM - 11:00 PM',
        friday: '6:00 AM - 11:00 PM',
        saturday: '6:00 AM - 11:00 PM',
        sunday: '6:00 AM - 11:00 PM',
      },
      restaurantMenu: {
        lunch: ['Lobster Roll - $24', 'Clam Chowder - $12', 'Fish Tacos - $16'],
        dinner: ['Steamed Lobster - $32', 'Clam Bake - $38', 'Fish & Chips - $18'],
      },
    },
    {
      name: 'Zion Ponderosa Ranch',
      slug: 'zion-ponderosa-ranch',
      description: 'Adventure resort near Zion National Park',
      fullDescription: 'Your base camp for Zion adventures! We offer glamping tents, cabins, and RV sites on 4,000 acres of pristine wilderness. Activities include horseback riding, ATV tours, zip lining, and rock climbing.',
      location: 'Orderville, Utah',
      state: 'Utah',
      amenities: ['Glamping', 'Horseback Riding', 'Zip Line', 'ATVs', 'Pool', 'Restaurant', 'WiFi'],
      imageUrl: '/uploads/campsites/zion-ponderosa.jpg',
      nightlyRate: 159.00,
      phone: '(800) 293-5444',
      email: 'info@zionponderosa.com',
      website: 'https://www.zionponderosa.com',
      socialLinks: {
        facebook: 'https://facebook.com/zionponderosa',
        instagram: 'https://instagram.com/zionponderosa',
      },
      hours: {
        monday: '7:00 AM - 10:00 PM',
        tuesday: '7:00 AM - 10:00 PM',
        wednesday: '7:00 AM - 10:00 PM',
        thursday: '7:00 AM - 10:00 PM',
        friday: '7:00 AM - 10:00 PM',
        saturday: '7:00 AM - 10:00 PM',
        sunday: '7:00 AM - 10:00 PM',
      },
    },
    {
      name: 'Smoky Mountains RV Resort',
      slug: 'smoky-mountains-rv-resort',
      description: 'Family-friendly RV resort in the Smokies',
      fullDescription: 'Nestled in the Great Smoky Mountains, our resort offers luxury RV sites with mountain views. Enjoy our water park, mini golf, arcade, and seasonal activities. Perfect for families!',
      location: 'Pigeon Forge, Tennessee',
      state: 'Tennessee',
      amenities: ['Water Park', 'Full Hookups', 'WiFi', 'Mini Golf', 'Arcade', 'Store', 'Playground', 'Dog Park'],
      imageUrl: '/uploads/campsites/smoky-mountains-rv.jpg',
      nightlyRate: 85.00,
      phone: '(865) 453-8181',
      email: 'info@smokymountainsrv.com',
      website: 'https://www.smokymountainsrvresort.com',
      socialLinks: {
        facebook: 'https://facebook.com/smokymountainsrv',
        instagram: 'https://instagram.com/smokymountainsrv',
      },
      hours: {
        monday: '8:00 AM - 9:00 PM',
        tuesday: '8:00 AM - 9:00 PM',
        wednesday: '8:00 AM - 9:00 PM',
        thursday: '8:00 AM - 9:00 PM',
        friday: '8:00 AM - 10:00 PM',
        saturday: '8:00 AM - 10:00 PM',
        sunday: '8:00 AM - 9:00 PM',
      },
    },
  ];

  for (const campsiteData of campsites) {
    const campsite = await prisma.campground.create({
      data: campsiteData,
    });

    console.log(`Created campsite: ${campsite.name}`);

    // Add sample announcements
    await prisma.campsiteAnnouncement.create({
      data: {
        campgroundId: campsite.id,
        title: 'Welcome to the 2025 Season!',
        content: 'We\'re excited to announce that we\'re now open for the 2025 camping season! Book your stay today and enjoy our newly renovated facilities.',
        target: 'ALL_FOLLOWERS',
      },
    });

    await prisma.campsiteAnnouncement.create({
      data: {
        campgroundId: campsite.id,
        title: 'Weekend Special Event',
        content: 'Join us this weekend for live music by the campfire, s\'mores making, and stargazing! Event starts at 7 PM Saturday.',
        target: 'CHECKED_IN_USERS',
      },
    });

    // Add sample events
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);

    await prisma.campsiteEvent.create({
      data: {
        campgroundId: campsite.id,
        title: 'Family Movie Night Under the Stars',
        description: 'Bring your blankets and chairs! We\'ll be showing a family-friendly movie on our outdoor screen. Free popcorn for all campers!',
        startDate: nextWeek,
      },
    });

    await prisma.campsiteEvent.create({
      data: {
        campgroundId: campsite.id,
        title: 'Annual Chili Cook-Off',
        description: 'Show off your best chili recipe and compete for prizes! Registration opens two weeks before the event.',
        startDate: nextMonth,
      },
    });

    // Add sample rentals
    const rentals = [
      { name: 'Kayak', description: 'Single-person kayak with paddle and life jacket', pricePerDay: 35, pricePerHour: 12 },
      { name: 'Mountain Bike', description: 'Adult mountain bike with helmet', pricePerDay: 45, pricePerHour: 15 },
      { name: 'Fishing Rod & Tackle', description: 'Complete fishing setup with basic tackle', pricePerDay: 25, pricePerHour: null },
      { name: 'Camping Chair Set', description: 'Set of 4 folding camp chairs', pricePerDay: 15, pricePerHour: null },
    ];

    for (const rental of rentals) {
      await prisma.campsiteRental.create({
        data: {
          campgroundId: campsite.id,
          ...rental,
        },
      });
    }

    // Add sample store items
    const storeItems = [
      { name: 'Firewood Bundle', description: 'Seasoned firewood, perfect for campfires', price: 8 },
      { name: 'Ice (10 lbs)', description: 'Bag of ice', price: 5 },
      { name: 'S\'mores Kit', description: 'Everything you need: graham crackers, marshmallows, and chocolate', price: 12 },
      { name: 'Camp Coffee', description: 'Fresh brewed coffee (16 oz)', price: 4 },
      { name: 'Propane Tank Refill', description: '20 lb propane tank refill', price: 22 },
      { name: 'Camping T-Shirt', description: 'Official campground t-shirt', price: 25 },
    ];

    for (const item of storeItems) {
      await prisma.campsiteStoreItem.create({
        data: {
          campgroundId: campsite.id,
          ...item,
        },
      });
    }

    console.log(`  - Added announcements, events, rentals, and store items`);
  }

  console.log('Campsite seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
