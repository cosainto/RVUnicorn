import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

const missing = [
  'Bella Terra RV Resort Gulf Shores AL',
  'Bluewater Key RV Resort FL',
  'Blazing Star Luxury RV Resort TX',
  'Coachella Lakes RV Resort CA',
  'Coral Shores RV Resort FL',
  'Crown Villa RV Resort OR',
  'Dunes Harbor Family Camp MI',
  'Eagle View RV Resort AZ',
  'Gateway RV Resort FL',
  'Gulfport Luxury RV Resort MS',
  'Hearthside Grove Luxury Motorcoach Resort MI',
  'Infinity Lakes RV Resort TX',
  'Lagoon Ranch RV Resort TX',
  'Little Arrow Outdoor Resort TN',
  'Moorings Oceanfront RV Resort ME',
  'North Myrtle Beach RV Resort SC',
  'Petoskey RV Resort MI',
  'Polson Motorcoach Resort MT',
  'Resort at Canopy Oaks FL',
  'Rivers Edge RV Cabins Resort',
  'Savannah Lakes RV Resort SC',
  'Stella Mare RV Resort TX',
  'StoneRidge Golf RV Resort AZ',
  'Sunset Beach RV Resort FL',
  'Verde Ranch RV Resort AZ',
  'Two Rivers Landing RV Resort TN',
  'Waves RV Resort FL',
  'Acadia Mountain RV Resort ME',
  'Alpine Mountain RV Resort NC',
  'Asheville Bear Creek RV Park NC',
  'Bay Cove RV Resort FL',
  'Big Bass Lake RV Resort PA',
  'Bluewater Bay Resort MI',
  'Brooksville RV Resort FL',
  'Capitol Reef RV Resort UT',
  'Chesapeake Bay RV Resort MD',
  'Coyote Ranch RV Resort CA',
  'Great Escapes RV Resort TX',
  'Gulf State Park Campground AL',
  'Hidden Ridge RV Resort WY',
  'Lake Erie RV Resort OH',
  'Lake Texoma RV Resort TX',
  'Mystic Woods Resort',
  'Newport Dunes Waterfront Resort CA',
  'Oak Island RV Park NC',
  'Palisade Basecamp RV Resort CO',
  'Red Bay RV Resort AL',
  'River Plantation RV Resort MS',
  'Shenandoah Valley Campground VA',
  'Smoky Bear Campground TN',
  'Topsail Hill Preserve State Park FL',
  'Tropic Breeze RV Resort FL',
  'Tuscaloosa North RV Park AL',
  'Village Camp Flagstaff AZ',
  'White Sands RV Resort NM',
  'Willow Tree RV Resort FL'
];

interface ApiResponse {
  status: string;
  results?: {
    place_id: string;
    name: string;
    formatted_address?: string;
    geometry: { location: { lat: number; lng: number } };
    photos?: { photo_reference: string }[];
  }[];
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function extractState(address: string): string | null {
  const match = address.match(/,\s*([A-Z]{2})\s*\d{5}/) || address.match(/,\s*([A-Z]{2})(?:,|\s|$)/);
  return match ? match[1] : null;
}

function getPhotoUrl(ref: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_API_KEY}`;
}

async function searchAndAdd(query: string) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' RV campground')}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json() as ApiResponse;
  
  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    console.log('❌ Not found:', query);
    return null;
  }
  
  const place = data.results[0];
  const address = place.formatted_address || '';
  const state = extractState(address);
  
  // Check if exists
  const existing = await prisma.campground.findFirst({
    where: {
      latitude: { gte: place.geometry.location.lat - 0.005, lte: place.geometry.location.lat + 0.005 },
      longitude: { gte: place.geometry.location.lng - 0.005, lte: place.geometry.location.lng + 0.005 }
    }
  });
  
  if (existing) {
    console.log('⏭️  Already exists:', place.name);
    return null;
  }
  
  const created = await prisma.campground.create({
    data: {
      name: place.name,
      location: address,
      state: state || 'Unknown',
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      imageUrl: place.photos && place.photos[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
      amenities: [],
      verificationStatus: 'UNCLAIMED'
    }
  });
  
  console.log('✅ Added:', place.name);
  return created;
}

async function main() {
  console.log('🏕️  Importing Luxury RV Parks');
  console.log('==============================\n');
  
  let added = 0;
  let skipped = 0;
  let notFound = 0;
  
  for (const query of missing) {
    const result = await searchAndAdd(query);
    if (result) added++;
    else if (result === null) {
      // Could be skipped or not found - counted in logs
    }
    await delay(200);
  }
  
  const total = await prisma.campground.count();
  console.log('\n==============================');
  console.log('Total campgrounds:', total);
}

main().catch(console.error).finally(() => process.exit());
