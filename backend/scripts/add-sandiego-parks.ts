import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

const missing = [
  'Mission Bay RV Resort San Diego CA',
  'Fiddlers Cove RV Park Marina Coronado CA',
  'Paradise by the Sea Beach RV Resort Oceanside CA',
  'Escondido RV Resort CA',
  'Country Creek RV Resort El Cajon CA'
];

interface ApiResponse {
  status: string;
  results?: {
    name: string;
    formatted_address: string;
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
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json() as ApiResponse;
  
  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    console.log('❌ Not found:', query);
    return;
  }
  
  const place = data.results[0];
  const address = place.formatted_address || '';
  const state = extractState(address) || 'CA';
  
  // Check if exists
  const existing = await prisma.campground.findFirst({
    where: {
      latitude: { gte: place.geometry.location.lat - 0.005, lte: place.geometry.location.lat + 0.005 },
      longitude: { gte: place.geometry.location.lng - 0.005, lte: place.geometry.location.lng + 0.005 }
    }
  });
  
  if (existing) {
    console.log('⏭️  Already exists:', place.name);
    return;
  }
  
  const photoUrl = place.photos && place.photos[0] ? getPhotoUrl(place.photos[0].photo_reference) : null;
  
  const created = await prisma.campground.create({
    data: {
      name: place.name,
      location: address,
      state: state,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      imageUrl: photoUrl,
      amenities: [],
      verificationStatus: 'UNCLAIMED'
    }
  });
  
  console.log('✅ Added:', created.name);
}

async function main() {
  console.log('🏕️  Adding San Diego RV Parks\n');
  
  for (const query of missing) {
    await searchAndAdd(query);
    await delay(300);
  }
  
  const total = await prisma.campground.count();
  console.log('\nTotal campgrounds:', total);
}

main().catch(console.error).finally(() => process.exit());
