import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const campgrounds = [
  {
    name: 'The Vineyards of Fredericksburg',
    location: '2647 N US 87',
    city: 'Fredericksburg',
    state: 'TX',
    zipCode: '78624',
    phone: '830-992-1237',
    latitude: 30.2985,
    longitude: -98.8723,
    hasElectricHookup: true,
    hasFullHookups: true,
  },
  {
    name: 'Alamogordo/White Sands KOA',
    location: '412 24th Street',
    city: 'Alamogordo',
    state: 'NM',
    zipCode: '88310',
    phone: '575-437-3003',
    latitude: 32.8995,
    longitude: -105.9603,
    hasElectricHookup: true,
  },
  {
    name: 'Zephyr Cove RV & Campsite',
    location: '760 US HWY 50',
    city: 'Zephyr Cove',
    state: 'NV',
    zipCode: '89448',
    phone: '775-589-4980',
    latitude: 38.9949,
    longitude: -119.9329,
    hasElectricHookup: true,
    isWaterfront: true,
  },
  {
    name: 'Gateway Luxury RV Resort',
    location: '596 North Main Street',
    city: 'La Verkin',
    state: 'UT',
    zipCode: '84745',
    phone: '435-288-0330',
    latitude: 37.2097,
    longitude: -113.2671,
    hasElectricHookup: true,
    hasFullHookups: true,
  },
  {
    name: 'Alpine Valley Resort',
    location: '64 Lunch Counter Lane',
    city: 'Alpine',
    state: 'WY',
    zipCode: '83128',
    phone: '307-241-5707',
    latitude: 43.1647,
    longitude: -111.0074,
    hasElectricHookup: true,
  },
  {
    name: 'Buffalo Crossing RV Park',
    location: '101 S Canyon St',
    city: 'West Yellowstone',
    state: 'MT',
    zipCode: '59758',
    phone: '406-646-4300',
    latitude: 44.6605,
    longitude: -111.1016,
    hasElectricHookup: true,
    hasFullHookups: true,
  },
  {
    name: 'Stanley RV + Camp',
    location: '12655 State Highway 21',
    city: 'Stanley',
    state: 'ID',
    zipCode: '83278',
    latitude: 44.2088,
    longitude: -114.9368,
    hasElectricHookup: true,
  },
  {
    name: 'Columbia River RV Park',
    location: '1881 Dike Road',
    city: 'Woodland',
    state: 'WA',
    zipCode: '98674',
    phone: '360-225-2227',
    latitude: 45.9076,
    longitude: -122.7429,
    hasElectricHookup: true,
    hasFullHookups: true,
    isWaterfront: true,
  },
  {
    name: 'Meredith Lodging Pacific Shores',
    location: '6225 North Coast Hwy 101',
    city: 'Newport',
    state: 'OR',
    zipCode: '97365',
    phone: '541-265-3750',
    latitude: 44.6809,
    longitude: -124.0658,
    hasElectricHookup: true,
    isWaterfront: true,
  },
  {
    name: 'Lighthouse Cove RV Park',
    location: '900 Sunset Circle',
    city: 'Crescent City',
    state: 'CA',
    zipCode: '95531',
    phone: '707-464-2473',
    latitude: 41.7558,
    longitude: -124.2026,
    hasElectricHookup: true,
    isWaterfront: true,
  },
];

async function main() {
  for (const cg of campgrounds) {
    const existing = await prisma.campground.findFirst({ where: { name: cg.name, state: cg.state } });
    if (existing) {
      console.log(`SKIP (exists): ${cg.name}`);
      continue;
    }
    const created = await prisma.campground.create({ data: cg as any });
    console.log(`CREATED: ${created.name} — ${created.id}`);
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
