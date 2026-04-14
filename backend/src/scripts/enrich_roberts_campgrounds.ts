import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient() as any;

const updates = [
  {
    name: 'The Vineyards of Fredericksburg',
    state: 'TX',
    data: {
      websiteUrl: 'https://www.thevineyardsrvpark.com',
      description: 'A premier RV park in the Texas Hill Country, 1.5 miles from Main Street Fredericksburg. 145 sites with 20/30/50 amp electric, water, sewer, WiFi, and cable TV. Big rig friendly with 85ft pull-throughs. Features a heated pool, hot tub, laundry, gym, off-leash dog park, playground, gift shop, and propane on site. Voted Best RV Park in Fredericksburg 2022, 2023, and 2025.',
      googleRating: 4.7,
      hasElectricHookup: true,
      hasFullHookups: true,
      hasSewerHookup: true,
      hasWaterHookup: true,
      hasWifi: true,
      hasCableTV: true,
      hasPool: true,
      hasShowers: true,
      hasLaundry: true,
      hasStore: true,
      hasPropane: true,
      hasPullThrough: true,
      isBigRigFriendly: true,
      isPetFriendly: true,
      maxAmpService: 50,
      maxRvLength: 85,
    }
  },
  {
    name: 'Alamogordo/White Sands KOA',
    state: 'NM',
    data: {
      websiteUrl: 'https://koa.com/campgrounds/alamogordo',
      description: 'KOA campground near White Sands National Park. Full hookup sites with electric, water, and sewer. Note: no sewer on some sites — use bags if assigned one. Convenient base for exploring White Sands, Holloman AFB area, and the Sacramento Mountains.',
      googleRating: 4.3,
      hasElectricHookup: true,
      hasFullHookups: true,
      hasWifi: true,
      hasShowers: true,
      hasLaundry: true,
      hasPool: true,
      isPetFriendly: true,
      hasPullThrough: true,
      isBigRigFriendly: true,
      maxAmpService: 50,
    }
  },
  {
    name: 'Zephyr Cove RV & Campsite',
    state: 'NV',
    data: {
      websiteUrl: 'https://www.zephyrcove.com/lodging/zephyr-cove-rv-campground',
      description: 'Award-winning RV park and campground on the south shore of Lake Tahoe with 92 RV sites (full hookups) and 47 walk-in campsites. Steps from a mile-long sandy beach, marina, restaurant, horseback riding, and the M.S. Dixie II paddlewheeler. Full hookups include water, sewer, and electricity. Cable TV in lobby, WiFi in resort areas. Pet friendly.',
      googleRating: 4.2,
      hasElectricHookup: true,
      hasFullHookups: true,
      hasSewerHookup: true,
      hasWaterHookup: true,
      hasWifi: true,
      hasCableTV: true,
      hasShowers: true,
      hasLaundry: true,
      isWaterfront: true,
      isPetFriendly: true,
      maxAmpService: 30,
      maxRvLength: 50,
    }
  },
  {
    name: 'Gateway Luxury RV Resort',
    state: 'UT',
    data: {
      websiteUrl: 'https://www.gatewayluxuryrvresort.com',
      description: 'Luxury RV resort in La Verkin, Utah — gateway to Zion National Park (20 min) and Bryce Canyon. Full hookup sites with 50-amp service, concrete pads, and premium amenities. Close to Zion Canyon and the Virgin River Gorge scenic drive.',
      googleRating: 4.6,
      hasElectricHookup: true,
      hasFullHookups: true,
      hasSewerHookup: true,
      hasWaterHookup: true,
      hasWifi: true,
      hasShowers: true,
      hasLaundry: true,
      hasPool: true,
      hasPullThrough: true,
      isBigRigFriendly: true,
      isPetFriendly: true,
      maxAmpService: 50,
      maxRvLength: 80,
    }
  },
  {
    name: 'Alpine Valley Resort',
    state: 'WY',
    data: {
      websiteUrl: 'https://www.alpinevalleyresort.com',
      description: 'RV resort in Alpine, Wyoming — the gateway to Jackson Hole and Grand Teton National Park. Full hookup sites with electric, water, and sewer. Surrounded by mountain scenery with easy access to the Snake River, fishing, and the Bridger-Teton National Forest. Jackson Hole is 45 minutes north.',
      googleRating: 4.4,
      hasElectricHookup: true,
      hasFullHookups: true,
      hasSewerHookup: true,
      hasWaterHookup: true,
      hasWifi: true,
      hasShowers: true,
      hasLaundry: true,
      hasPullThrough: true,
      isBigRigFriendly: true,
      isPetFriendly: true,
      maxAmpService: 50,
    }
  },
  {
    name: 'Buffalo Crossing RV Park',
    state: 'MT',
    data: {
      websiteUrl: 'https://www.buffalocrossingrvpark.com',
      description: 'Full-service RV park in West Yellowstone, Montana — the west entrance to Yellowstone National Park. Full hookup sites with 50-amp service. Walking distance to restaurants and shops in West Yellowstone. Perfect base for exploring Yellowstone\'s geysers, wildlife, and hot springs.',
      googleRating: 4.3,
      hasElectricHookup: true,
      hasFullHookups: true,
      hasSewerHookup: true,
      hasWaterHookup: true,
      hasWifi: true,
      hasShowers: true,
      hasLaundry: true,
      hasPullThrough: true,
      isBigRigFriendly: true,
      isPetFriendly: true,
      maxAmpService: 50,
    }
  },
  {
    name: 'Stanley RV + Camp',
    state: 'ID',
    data: {
      websiteUrl: 'https://www.stanleyidaho.com',
      description: 'RV campground in Stanley, Idaho — heart of the Sawtooth National Recreation Area. Sites with electric hookups surrounded by spectacular mountain scenery. Early check-in available for $10. No arrivals after 10pm. Ideal base for hiking the Sawtooth Mountains, fishing the Salmon River, and stargazing in one of Idaho\'s darkest skies.',
      googleRating: 4.5,
      hasElectricHookup: true,
      hasShowers: true,
      hasWifi: true,
      isPetFriendly: true,
      maxAmpService: 30,
    }
  },
  {
    name: 'Columbia River RV Park',
    state: 'WA',
    data: {
      websiteUrl: 'https://www.columbiariverrvpark.com',
      description: 'Scenic RV park on the Columbia River in Woodland, Washington. Site 10 is riverfront with stunning water views. Full hookup sites with electric, water, and sewer. Mount St. Helens is just 45 minutes away. Great fishing and birdwatching along the river.',
      googleRating: 4.4,
      hasElectricHookup: true,
      hasFullHookups: true,
      hasSewerHookup: true,
      hasWaterHookup: true,
      hasWifi: true,
      hasShowers: true,
      hasLaundry: true,
      hasPullThrough: true,
      isBigRigFriendly: true,
      isPetFriendly: true,
      isWaterfront: true,
      maxAmpService: 50,
    }
  },
  {
    name: 'Meredith Lodging Pacific Shores',
    state: 'OR',
    data: {
      websiteUrl: 'https://www.meredith-lodging.com',
      description: 'Oceanfront RV resort on the Oregon Coast in Newport. Site P-130R is a premium oceanfront pull-through with stunning Pacific Ocean views. Full hookup sites with electric, water, and sewer. Steps from the beach. Close to the Oregon Coast Aquarium, Rogue Ales brewery, and the historic Bayfront district.',
      googleRating: 4.5,
      hasElectricHookup: true,
      hasFullHookups: true,
      hasSewerHookup: true,
      hasWaterHookup: true,
      hasWifi: true,
      hasShowers: true,
      hasLaundry: true,
      hasPullThrough: true,
      isBigRigFriendly: true,
      isPetFriendly: true,
      isWaterfront: true,
      maxAmpService: 50,
    }
  },
  {
    name: 'Lighthouse Cove RV Park',
    state: 'CA',
    data: {
      websiteUrl: 'https://www.lighthousecovervpark.com',
      description: 'Oceanfront RV park in Crescent City, California — gateway to the Redwoods. Site 25 is oceanfront with direct Pacific views and includes a firepit (add-on paid). Full hookup sites with electric, water, and sewer. Minutes from Redwood National and State Parks, Battery Point Lighthouse, and stunning coastal hiking trails.',
      googleRating: 4.6,
      hasElectricHookup: true,
      hasFullHookups: true,
      hasSewerHookup: true,
      hasWaterHookup: true,
      hasWifi: true,
      hasShowers: true,
      hasLaundry: true,
      hasPullThrough: true,
      isBigRigFriendly: true,
      isPetFriendly: true,
      isWaterfront: true,
      maxAmpService: 50,
    }
  },
];

async function main() {
  for (const cg of updates) {
    const existing = await prisma.campground.findFirst({ where: { name: cg.name, state: cg.state } });
    if (!existing) { console.log(`NOT FOUND: ${cg.name}`); continue; }
    await prisma.campground.update({ where: { id: existing.id }, data: cg.data as any });
    console.log(`✅ Updated: ${cg.name}`);
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
