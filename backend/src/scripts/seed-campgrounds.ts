import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

const campgrounds = [
  // California
  {
    name: "Yosemite Pines RV Resort",
    slug: "yosemite-pines-rv-resort-ca",
    location: "Groveland, California",
    state: "California",
    description: "Family-friendly RV resort near Yosemite National Park with full hookups, pool, and activities.",
    latitude: 37.8339,
    longitude: -120.1850,
    amenities: ["WIFI", "POOL", "SHOWERS", "RESTROOMS", "ELECTRIC_HOOKUPS", "WATER", "DUMP_STATION", "LAUNDRY", "CAMP_STORE"],
    phone: "(209) 962-7690",
    website: "https://www.yosemitepinesrv.com",
  },
  {
    name: "Pfeiffer Big Sur State Park",
    slug: "pfeiffer-big-sur-state-park-ca",
    location: "Big Sur, California",
    state: "California",
    description: "Stunning coastal campground in Big Sur with hiking trails and ocean views.",
    latitude: 36.2441,
    longitude: -121.7847,
    amenities: ["RESTROOMS", "SHOWERS", "FIRE_PITS", "PICNIC_TABLES", "TRAILS"],
    phone: "(831) 667-2315",
  },
  {
    name: "Lake Tahoe KOA",
    slug: "lake-tahoe-koa-ca",
    location: "South Lake Tahoe, California",
    state: "California",
    description: "Mountain camping near Lake Tahoe with cabins and RV sites.",
    latitude: 38.9593,
    longitude: -119.9772,
    amenities: ["WIFI", "POOL", "SHOWERS", "RESTROOMS", "ELECTRIC_HOOKUPS", "WATER", "DUMP_STATION", "CAMP_STORE", "PLAYGROUND"],
    phone: "(530) 577-3693",
    website: "https://koa.com/campgrounds/lake-tahoe/",
  },

  // Colorado
  {
    name: "Garden of the Gods RV Resort",
    slug: "garden-of-the-gods-rv-resort-co",
    location: "Colorado Springs, Colorado",
    state: "Colorado",
    description: "Premium RV resort near Garden of the Gods with mountain views.",
    latitude: 38.8747,
    longitude: -104.8858,
    amenities: ["WIFI", "POOL", "HOT_TUB", "SHOWERS", "RESTROOMS", "ELECTRIC_HOOKUPS", "WATER", "DUMP_STATION", "LAUNDRY"],
    phone: "(719) 475-9450",
    website: "https://www.gardenofthegodsrvresort.com",
  },
  {
    name: "Rocky Mountain National Park - Moraine Park",
    slug: "rmnp-moraine-park-co",
    location: "Estes Park, Colorado",
    state: "Colorado",
    description: "Iconic national park camping with elk viewing and mountain hiking.",
    latitude: 40.3598,
    longitude: -105.5897,
    amenities: ["RESTROOMS", "FIRE_PITS", "PICNIC_TABLES", "TRAILS", "AMPHITHEATER"],
    phone: "(970) 586-1206",
  },

  // Arizona
  {
    name: "Flagstaff KOA Journey",
    slug: "flagstaff-koa-journey-az",
    location: "Flagstaff, Arizona",
    state: "Arizona",
    description: "Mountain camping near the Grand Canyon with full amenities.",
    latitude: 35.1983,
    longitude: -111.6513,
    amenities: ["WIFI", "POOL", "SHOWERS", "RESTROOMS", "ELECTRIC_HOOKUPS", "WATER", "DUMP_STATION", "CAMP_STORE", "PLAYGROUND"],
    phone: "(928) 526-9926",
    website: "https://koa.com/campgrounds/flagstaff/",
  },
  {
    name: "Mather Campground - Grand Canyon",
    slug: "mather-campground-grand-canyon-az",
    location: "Grand Canyon Village, Arizona",
    state: "Arizona",
    description: "South Rim camping in Grand Canyon National Park.",
    latitude: 36.0544,
    longitude: -112.1401,
    amenities: ["RESTROOMS", "SHOWERS", "LAUNDRY", "CAMP_STORE", "FIRE_PITS"],
    phone: "(928) 638-7851",
  },

  // Florida
  {
    name: "Disney's Fort Wilderness Resort",
    slug: "disneys-fort-wilderness-fl",
    location: "Orlando, Florida",
    state: "Florida",
    description: "Disney-themed camping resort with pools, activities, and transportation to parks.",
    latitude: 28.4113,
    longitude: -81.5672,
    amenities: ["WIFI", "POOL", "SHOWERS", "RESTROOMS", "ELECTRIC_HOOKUPS", "WATER", "RESTAURANT", "CAMP_STORE", "PLAYGROUND", "ACTIVITIES"],
    phone: "(407) 824-2900",
    website: "https://disneyworld.disney.go.com/resorts/campsites-at-fort-wilderness-resort/",
  },
  {
    name: "Bahia Honda State Park",
    slug: "bahia-honda-state-park-fl",
    location: "Big Pine Key, Florida",
    state: "Florida",
    description: "Tropical beach camping in the Florida Keys with snorkeling and swimming.",
    latitude: 24.6614,
    longitude: -81.2761,
    amenities: ["RESTROOMS", "SHOWERS", "BEACH", "BOAT_LAUNCH", "TRAILS"],
    phone: "(305) 872-2353",
  },

  // Texas
  {
    name: "Big Bend National Park - Chisos Basin",
    slug: "big-bend-chisos-basin-tx",
    location: "Big Bend National Park, Texas",
    state: "Texas",
    description: "Desert mountain camping with incredible stargazing and hiking.",
    latitude: 29.2727,
    longitude: -103.3027,
    amenities: ["RESTROOMS", "CAMP_STORE", "TRAILS", "AMPHITHEATER"],
    phone: "(432) 477-2251",
  },

  // Washington
  {
    name: "La Push Beach Resort",
    slug: "la-push-beach-resort-wa",
    location: "La Push, Washington",
    state: "Washington",
    description: "Oceanfront camping on the Olympic Peninsula with beach access.",
    latitude: 47.9042,
    longitude: -124.6368,
    amenities: ["RESTROOMS", "SHOWERS", "BEACH", "TRAILS"],
    phone: "(360) 374-5267",
  },
  {
    name: "Mount Rainier - Cougar Rock Campground",
    slug: "mount-rainier-cougar-rock-wa",
    location: "Ashford, Washington",
    state: "Washington",
    description: "Old-growth forest camping with views of Mount Rainier.",
    latitude: 46.7679,
    longitude: -121.7742,
    amenities: ["RESTROOMS", "FIRE_PITS", "TRAILS", "AMPHITHEATER"],
    phone: "(360) 569-2211",
  },

  // Oregon
  {
    name: "Cannon Beach RV Resort",
    slug: "cannon-beach-rv-resort-or",
    location: "Cannon Beach, Oregon",
    state: "Oregon",
    description: "Coastal RV resort near Haystack Rock with ocean views.",
    latitude: 45.8918,
    longitude: -123.9615,
    amenities: ["WIFI", "SHOWERS", "RESTROOMS", "ELECTRIC_HOOKUPS", "WATER", "DUMP_STATION", "LAUNDRY"],
    phone: "(503) 436-2231",
    website: "https://www.cbrvresort.com",
  },

  // Montana
  {
    name: "Glacier National Park - Many Glacier",
    slug: "glacier-np-many-glacier-mt",
    location: "Browning, Montana",
    state: "Montana",
    description: "Spectacular mountain camping with glacier views and wildlife.",
    latitude: 48.7956,
    longitude: -113.6761,
    amenities: ["RESTROOMS", "FIRE_PITS", "CAMP_STORE", "TRAILS"],
    phone: "(406) 888-7800",
  },

  // Wyoming
  {
    name: "Yellowstone - Madison Campground",
    slug: "yellowstone-madison-wy",
    location: "Yellowstone National Park, Wyoming",
    state: "Wyoming",
    description: "Riverside camping near geysers and wildlife viewing areas.",
    latitude: 44.6550,
    longitude: -110.8579,
    amenities: ["RESTROOMS", "FIRE_PITS", "AMPHITHEATER", "TRAILS"],
    phone: "(307) 344-7381",
  },

  // Utah
  {
    name: "Zion National Park - Watchman Campground",
    slug: "zion-watchman-ut",
    location: "Springdale, Utah",
    state: "Utah",
    description: "Red rock canyon camping with access to Zion's famous trails.",
    latitude: 37.2000,
    longitude: -112.9872,
    amenities: ["RESTROOMS", "ELECTRIC_HOOKUPS", "FIRE_PITS", "TRAILS", "AMPHITHEATER"],
    phone: "(435) 772-3256",
  },
  {
    name: "Moab Under Canvas",
    slug: "moab-under-canvas-ut",
    location: "Moab, Utah",
    state: "Utah",
    description: "Luxury glamping near Arches National Park with safari tents.",
    latitude: 38.7331,
    longitude: -109.7287,
    amenities: ["RESTROOMS", "SHOWERS", "RESTAURANT", "WIFI"],
    phone: "(888) 496-1148",
    website: "https://www.undercanvas.com/camps/moab/",
  },

  // Maine
  {
    name: "Acadia National Park - Blackwoods Campground",
    slug: "acadia-blackwoods-me",
    location: "Bar Harbor, Maine",
    state: "Maine",
    description: "Forest camping near the rocky Maine coast and mountain hiking.",
    latitude: 44.3106,
    longitude: -68.2133,
    amenities: ["RESTROOMS", "FIRE_PITS", "TRAILS", "AMPHITHEATER"],
    phone: "(207) 288-3274",
  },

  // North Carolina
  {
    name: "Great Smoky Mountains - Cades Cove",
    slug: "smoky-mountains-cades-cove-nc",
    location: "Townsend, Tennessee",
    state: "North Carolina",
    description: "Historic valley camping with wildlife viewing and mountain views.",
    latitude: 35.5951,
    longitude: -83.8277,
    amenities: ["RESTROOMS", "FIRE_PITS", "CAMP_STORE", "TRAILS"],
    phone: "(865) 448-4103",
  },

  // Canada - British Columbia
  {
    name: "Whistler RV Park & Campground",
    slug: "whistler-rv-park-bc",
    location: "Whistler, British Columbia",
    state: "British Columbia",
    description: "Mountain resort camping near world-class skiing and hiking.",
    latitude: 50.1163,
    longitude: -122.9574,
    amenities: ["WIFI", "SHOWERS", "RESTROOMS", "ELECTRIC_HOOKUPS", "WATER", "DUMP_STATION", "LAUNDRY"],
    phone: "(604) 905-5533",
    website: "https://whistlercamping.com",
  },
  {
    name: "Pacific Rim National Park - Green Point",
    slug: "pacific-rim-green-point-bc",
    location: "Tofino, British Columbia",
    state: "British Columbia",
    description: "Oceanfront camping on Vancouver Island with beach access and rainforest trails.",
    latitude: 49.0856,
    longitude: -125.8633,
    amenities: ["RESTROOMS", "SHOWERS", "BEACH", "TRAILS"],
    phone: "(250) 726-3500",
  },

  // Canada - Alberta
  {
    name: "Banff National Park - Two Jack Lakeside",
    slug: "banff-two-jack-lakeside-ab",
    location: "Banff, Alberta",
    state: "Alberta",
    description: "Mountain lake camping with stunning Rocky Mountain views.",
    latitude: 51.2417,
    longitude: -115.5028,
    amenities: ["RESTROOMS", "FIRE_PITS", "BOAT_LAUNCH", "TRAILS"],
    phone: "(403) 762-1550",
  },
  {
    name: "Jasper National Park - Whistlers Campground",
    slug: "jasper-whistlers-ab",
    location: "Jasper, Alberta",
    state: "Alberta",
    description: "Large campground with mountain views and wildlife viewing.",
    latitude: 52.8534,
    longitude: -118.0814,
    amenities: ["RESTROOMS", "SHOWERS", "ELECTRIC_HOOKUPS", "FIRE_PITS", "PLAYGROUND", "AMPHITHEATER"],
    phone: "(780) 852-6176",
  },

  // Canada - Ontario
  {
    name: "Algonquin Park - Mew Lake Campground",
    slug: "algonquin-mew-lake-on",
    location: "Whitney, Ontario",
    state: "Ontario",
    description: "Wilderness camping in Canada's iconic provincial park.",
    latitude: 45.5787,
    longitude: -78.3634,
    amenities: ["RESTROOMS", "SHOWERS", "FIRE_PITS", "TRAILS", "CANOE_RENTAL"],
    phone: "(705) 633-5572",
  },

  // Canada - Quebec
  {
    name: "Parc National du Mont-Tremblant",
    slug: "mont-tremblant-national-park-qc",
    location: "Mont-Tremblant, Quebec",
    state: "Quebec",
    description: "French Canadian wilderness camping with lakes and mountains.",
    latitude: 46.5489,
    longitude: -74.6431,
    amenities: ["RESTROOMS", "FIRE_PITS", "TRAILS", "CANOE_RENTAL", "BEACH"],
    phone: "(819) 688-2281",
  },

  // Canada - Nova Scotia
  {
    name: "Cape Breton Highlands National Park",
    slug: "cape-breton-highlands-ns",
    location: "Ingonish, Nova Scotia",
    state: "Nova Scotia",
    description: "Coastal mountain camping with ocean views and hiking trails.",
    latitude: 46.6833,
    longitude: -60.4167,
    amenities: ["RESTROOMS", "SHOWERS", "FIRE_PITS", "TRAILS", "BEACH"],
    phone: "(902) 224-2306",
  },
];

async function main() {
  console.log('🏕️  Starting Campground Seed');
  console.log(`📍 Adding ${campgrounds.length} popular campgrounds...\n`);

  let imported = 0;
  let skipped = 0;

  for (const campground of campgrounds) {
    try {
      const existing = await prisma.campground.findUnique({
        where: { slug: campground.slug },
      });

      if (existing) {
        console.log(`⏭️  Skipped (exists): ${campground.name}`);
        skipped++;
        continue;
      }

      await prisma.campground.create({
        data: {
          ...campground,
          },
      });

      console.log(`✅ Imported: ${campground.name} - ${campground.location}`);
      imported++;
    } catch (error: any) {
      console.error(`❌ Error importing ${campground.name}:`, error.message);
      skipped++;
    }
  }

  console.log('\n✅ Seed Complete!');
  console.log(`📊 Stats:`);
  console.log(`   - Successfully imported: ${imported}`);
  console.log(`   - Skipped: ${skipped}`);
  console.log(`\n🎉 Your database now has ${imported} campgrounds!`);

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
