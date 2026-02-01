import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updates = [
  { name: 'North Arm (Timothy Lake)', city: 'Government Camp', state: 'OR', website: 'https://www.fs.usda.gov' },
  { name: 'Dry Lake Campground', city: 'Leadville', state: 'CO', website: null },
  { name: 'Backbone Horse Campground', city: 'Strawberry Point', state: 'IA', website: 'https://www.iowadnr.gov' },
  { name: 'Harlequin Campground', city: 'Big Sur', state: 'CA', website: 'https://www.fs.usda.gov' },
  { name: 'Sylvania (Clark Lake)', city: 'Watersmeet', state: 'MI', website: 'https://www.fs.usda.gov' },
  { name: 'Ten Mile Campground', city: 'Fort Bragg', state: 'CA', website: 'https://www.fs.usda.gov' },
  { name: 'Mt. Figueroa Campground', city: 'Los Olivos', state: 'CA', website: 'https://www.fs.usda.gov' },
  { name: 'Mt. Pinos Campground', city: 'Frazier Park', state: 'CA', website: 'https://www.fs.usda.gov' },
  { name: 'Grassy Hollow Campground', city: 'Brian Head', state: 'UT', website: 'https://www.fs.usda.gov' },
  { name: 'Middle Lion Campground', city: 'Craig', state: 'AK', website: 'https://www.fs.usda.gov' },
  { name: 'Piney Campground and Boat Launch', city: 'Piney Woods', state: 'MS', website: null },
  { name: 'Sunset Marina and RV Park', city: 'Brandon', state: 'MS', website: null },
  { name: 'Black River Campsite', city: 'Edwards', state: 'MS', website: null },
  { name: 'Ratliff Ferry Trading Post', city: 'Canton', state: 'MS', website: null },
  { name: 'The Landing at Movietown', city: 'Canton', state: 'MS', website: null },
  { name: 'Ohana Celebration Park', city: 'Vilonia', state: 'AR', website: 'https://ohanacelebrationpark.com' },
  { name: 'Sunsets on the Arkansas River', city: 'Bigelow', state: 'AR', website: null },
  { name: 'Fort Javelin RV Park', city: 'Conway', state: 'AR', website: null },
  { name: 'Triple L Campground', city: 'Salem', state: 'VA', website: null },
  { name: 'Walnut RV Park', city: 'Northridge', state: 'CA', website: null },
  { name: 'WVU Jacksons Mill', city: 'Weston', state: 'WV', website: 'https://jacksonsmill.wvu.edu' },
  { name: 'Camp Faith Youth Camp', city: 'Shinnston', state: 'WV', website: null },
  { name: 'Mission Bay RV Resort', city: 'San Diego', state: 'CA', website: 'https://www.missionbayrvresort.com' },
  { name: 'Campland on the Bay', city: 'San Diego', state: 'CA', website: 'https://www.campland.com' },
  { name: 'San Diego Metro KOA', city: 'Chula Vista', state: 'CA', website: 'https://koa.com/campgrounds/san-diego' },
  { name: 'Paradise by the Sea', city: 'Oceanside', state: 'CA', website: 'https://www.paradisebythesearvresort.com' },
  { name: 'Bella Terra of Gulf Shores', city: 'Gulf Shores', state: 'AL', website: 'https://www.bellaterragulfshores.com' },
  { name: 'Bluewater Key RV Resort', city: 'Key West', state: 'FL', website: 'https://www.bluewaterkey.com' },
  { name: 'Hearthside Grove', city: 'Petoskey', state: 'MI', website: 'https://www.hearthsidegrove.com' },
  { name: 'Las Vegas Motorcoach Resort', city: 'Las Vegas', state: 'NV', website: 'https://www.lvmresort.com' },
  { name: 'Verde Ranch RV Resort', city: 'Camp Verde', state: 'AZ', website: 'https://www.verderanchrvresort.com' },
  { name: 'Savannah Lakes RV Resort', city: 'Hardeeville', state: 'SC', website: 'https://www.savannahlakesrvresort.com' },
  { name: 'Normandy Farms Campground', city: 'Foxborough', state: 'MA', website: 'https://www.normandyfarms.com' },
  { name: 'Acadia Mountain RV Resort', city: 'Bar Harbor', state: 'ME', website: 'https://www.acadiamountainrvresort.com' },
  { name: 'Ocean Lakes Family Campground', city: 'Myrtle Beach', state: 'SC', website: 'https://www.oceanlakes.com' },
  { name: 'White Sands RV Resort', city: 'Alamogordo', state: 'NM', website: 'https://www.whitesandsrvresort.com' },
];

async function main() {
  console.log('Updating campground cities, states, and websites...\n');
  
  let updated = 0;
  let notFound = 0;
  
  for (const u of updates) {
    const campground = await prisma.campground.findFirst({
      where: { name: { contains: u.name, mode: 'insensitive' } }
    });
    
    if (campground) {
      const newLocation = `${u.city}, ${u.state}`;
      const data: any = { 
        state: u.state,
        location: newLocation
      };
      
      if (u.website) {
        data.websiteUrl = u.website;
      }
      
      await prisma.campground.update({
        where: { id: campground.id },
        data
      });
      console.log(`✅ ${campground.name} → ${u.city}, ${u.state}`);
      updated++;
    } else {
      console.log(`❌ Not found: ${u.name}`);
      notFound++;
    }
  }
  
  console.log('\n==================');
  console.log('Updated:', updated);
  console.log('Not found:', notFound);
  
  const remaining = await prisma.campground.count({
    where: {
      OR: [
        { state: 'Unknown' },
        { state: '' },
        { state: null }
      ]
    }
  });
  console.log('Remaining without valid state:', remaining);
}

main().catch(console.error).finally(() => process.exit());
