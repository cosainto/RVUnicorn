const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const Anthropic = require('./backend/node_modules/@anthropic-ai/sdk').default;

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const campgrounds = [
  {
    name: "Pacific Shores Motorcoach Resort",
    // address: "6225 N Coast Highway 101",
    city: "Newport",
    state: "OR",
    zipCode: "97365",
    latitude: 44.6887,
    longitude: -124.0596,
    businessPhone: "(541) 265-3750",
    websiteUrl: "https://psmcr.com",
    siteType: "RV",
    maxRvLength: 75,
    maxAmpService: 50,
    hasFullHookups: true,
    hasElectricHookup: true,
    hasWaterHookup: true,
    hasSewerHookup: true,
    hasWifi: true,
    hasCableTV: true,
    hasPool: true,
    hasShowers: true,
    hasRestrooms: true,
    hasLaundry: true,
    isPetFriendly: true,
    isWaterfront: true,
    isBigRigFriendly: true,
    hasPullThrough: false,
    hasBackIn: true,
    pricePerNight: 105,
    prompt: "Pacific Shores Motorcoach Resort in Newport, Oregon. A luxury gated resort on 22 oceanfront acres along the Pacific Coast Highway. Exclusively for Class A and Class C motorcoaches 29 feet or longer. 209 sites with full hookups, 50-amp service, cable TV, and WiFi. Amenities include indoor heated pool and spa, outdoor pool and spa, sauna, fitness center, pickleball and basketball courts, clubhouse, laundry facilities, private beach access, and ocean-view walking trails. Near Yaquina Bay Lighthouse and Oregon Coast Aquarium. Open year-round."
  },
  {
    name: "Alpine Valley RV Resort",
    // address: "118450 US-26",
    city: "Alpine",
    state: "WY",
    zipCode: "83128",
    latitude: 43.1720,
    longitude: -111.0159,
    businessPhone: "(307) 241-5707",
    websiteUrl: "https://alpinevalleyresortwy.com",
    siteType: "RV",
    maxRvLength: 75,
    maxAmpService: 50,
    hasFullHookups: true,
    hasElectricHookup: true,
    hasWaterHookup: true,
    hasSewerHookup: true,
    hasWifi: true,
    hasShowers: true,
    hasRestrooms: true,
    hasLaundry: false,
    isPetFriendly: true,
    isWaterfront: false,
    isBigRigFriendly: true,
    hasPullThrough: true,
    hasBackIn: true,
    pricePerNight: 75,
    prompt: "Alpine Valley RV Resort in Alpine, Wyoming. Voted #1 RV Park in the Jackson Hole area. Located at 118450 US-26, just 1/4 mile from Palisades Reservoir and a scenic drive to Jackson Hole, Grand Teton National Park, and Yellowstone. Offers paved pull-through sites for rigs up to 75 feet and paved back-in sites for rigs up to 60 feet. All sites are full hookup. Pet friendly. White-water rafting packages available. Stunning mountain scenery."
  },
  {
    name: "Buffalo Crossing RV Park",
    // address: "128 S Electric Street",
    city: "West Yellowstone",
    state: "MT",
    zipCode: "59758",
    latitude: 44.6613,
    longitude: -111.1007,
    businessPhone: "(406) 646-4300",
    websiteUrl: "https://www.buffalocrossingrvpark.com",
    siteType: "RV",
    maxRvLength: 70,
    maxAmpService: 50,
    hasFullHookups: true,
    hasElectricHookup: true,
    hasWaterHookup: true,
    hasSewerHookup: true,
    hasWifi: true,
    hasShowers: true,
    hasRestrooms: true,
    hasLaundry: true,
    isPetFriendly: true,
    isWaterfront: false,
    isBigRigFriendly: true,
    hasPullThrough: true,
    hasBackIn: true,
    pricePerNight: 105,
    prompt: "Buffalo Crossing RV Park in West Yellowstone, Montana. The closest RV park to the West Entrance of Yellowstone National Park — just a few hundred feet from the gate. One of the newest parks in West Yellowstone. 25 generously proportioned sites including pull-through (30x70ft) and back-in (25x45ft). All sites have 20/30/50 amp electric, water, sewer, and WiFi. Hot showers, laundry, and sparkling restrooms. Pet-friendly with a grassy relief area. Walking distance to West Yellowstone dining and shopping. Each stay includes a $20 gift voucher for Yellowstone Park Village."
  },
  {
    name: "Zion Canyon Campground & RV Resort",
    // address: "479 Zion Park Blvd",
    city: "Springdale",
    state: "UT",
    zipCode: "84767",
    latitude: 37.1936,
    longitude: -112.9922,
    businessPhone: "(435) 772-3237",
    websiteUrl: "https://zioncamp.com",
    siteType: "RV",
    maxRvLength: 40,
    maxAmpService: 50,
    hasFullHookups: true,
    hasElectricHookup: true,
    hasWaterHookup: true,
    hasSewerHookup: true,
    hasWifi: true,
    hasShowers: true,
    hasRestrooms: true,
    hasLaundry: true,
    hasPool: true,
    isPetFriendly: true,
    isWaterfront: true,
    isBigRigFriendly: false,
    hasPullThrough: true,
    hasBackIn: true,
    hasDumpStation: true,
    hasStore: true,
    pricePerNight: 85,
    prompt: "Zion Canyon Campground & RV Resort in Springdale, Utah. The closest private campground to Zion National Park, just 1/4 mile from the south entrance. Family-owned by the Ferber family since 1973. 184 sites with full hookups including pull-through options. Located along the Virgin River with stunning canyon views. Amenities include swimming pool, playground, laundry, hot showers, convenience store, and free Zion shuttle stop at the entrance. Big rig access limited due to nearby tunnel restrictions. Pet-friendly with restrictions. Open year-round."
  },
  {
    name: "The Vineyards of Fredericksburg RV Park",
    // address: "2797 US-290",
    city: "Fredericksburg",
    state: "TX",
    zipCode: "78624",
    latitude: 30.2552,
    longitude: -98.8720,
    businessPhone: "(830) 992-1237",
    websiteUrl: "https://www.thevineyardsrvpark.com",
    siteType: "RV",
    maxRvLength: 70,
    maxAmpService: 50,
    hasFullHookups: true,
    hasElectricHookup: true,
    hasWaterHookup: true,
    hasSewerHookup: true,
    hasWifi: true,
    hasShowers: true,
    hasRestrooms: true,
    hasLaundry: true,
    hasPool: true,
    hasPropane: true,
    hasStore: true,
    isPetFriendly: true,
    isWaterfront: false,
    isBigRigFriendly: true,
    hasPullThrough: true,
    hasBackIn: true,
    pricePerNight: 65,
    prompt: "The Vineyards of Fredericksburg RV Park in Fredericksburg, Texas Hill Country. Award-winning park voted Best RV Park in Fredericksburg in 2022, 2023, and 2025. Located in the heart of Texas wine country with pastoral vineyard views. All sites include 20/30/50-amp service, water, and sewer. Amenities include pool and jacuzzi (seasonal), fitness center, off-leash dog park, playground with tire swing and rock-climbing wall, gift shop, laundry, showers, outdoor sports, valet trash pickup, and propane on site. Glamping covered wagons also available. Minutes from wineries, German architecture, and Fredericksburg shops."
  },
  {
    name: "Grand Canyon Camper Village",
    // address: "549 Camper Village Lane",
    city: "Grand Canyon Village",
    state: "AZ",
    zipCode: "86023",
    latitude: 35.9753,
    longitude: -112.1245,
    businessPhone: "(928) 638-2887",
    websiteUrl: "https://www.grandcanyoncampervillage.com",
    siteType: "RV",
    maxRvLength: 60,
    maxAmpService: 50,
    hasFullHookups: true,
    hasElectricHookup: true,
    hasWaterHookup: true,
    hasSewerHookup: false,
    hasWifi: false,
    hasShowers: true,
    hasRestrooms: true,
    hasLaundry: true,
    isPetFriendly: false,
    isWaterfront: false,
    isBigRigFriendly: true,
    hasPullThrough: true,
    hasBackIn: true,
    hasDumpStation: true,
    pricePerNight: 55,
    prompt: "Grand Canyon Camper Village in Tusayan, Arizona, 1 mile south of the Grand Canyon's South Rim entrance on Highway 64, just 6 miles from the canyon rim. Open year-round at 7,200 feet elevation. Offers 50-amp full hookup sites, 30-amp full hookup pull-through sites, and water/electric-only sites. Tent and dry camping also available. Amenities include coin-operated laundry, restrooms, and showers available to guests and non-guests. Walking distance to IMAX theater, restaurants, general store, and shopping. Access to the Arizona Trail. No WiFi or propane available on site."
  }
];

async function generateDescription(prompt) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `Write a compelling 4-6 sentence Hitch-style campground description for RVers based on these facts. Be specific, enthusiastic, and practical. Focus on what makes it special for RV travelers. Don't start with the campground name.\n\nFacts: ${prompt}`
    }]
  });
  return msg.content[0].text;
}

async function main() {
  for (const cg of campgrounds) {
    // Check if already exists
    const existing = await prisma.campground.findFirst({
      where: { name: cg.name, state: cg.state }
    });
    if (existing) {
      console.log(`SKIP: ${cg.name} already exists`);
      continue;
    }

    console.log(`Generating description for ${cg.name}...`);
    const description = await generateDescription(cg.prompt);

    const { prompt: _, ...data } = cg;
    await prisma.campground.create({
      data: {
        ...data,
        description,
        location: `${cg.city}, ${cg.state}`,
      }
    });
    console.log(`✓ Added: ${cg.name}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  await prisma.$disconnect();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
