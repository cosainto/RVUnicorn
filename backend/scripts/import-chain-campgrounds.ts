import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

const CHAINS = [
  'Jellystone Park Camp-Resort',
  'Yogi Bear Jellystone',
  'KOA Kampground',
  'KOA Journey',
  'KOA Holiday',
  'KOA Resort',
  'Thousand Trails',
  'Good Sam RV Park',
  'Sun RV Resorts',
  'Encore RV Resort',
  'Harvest Hosts',
  'Escapees RV',
  'Passport America',
  'Lazydays RV',
  'Kampgrounds of America',
  'Yosemite Pines RV Resort',
  'Ocean Lakes Family Campground',
  'Disney Fort Wilderness',
  'Chip\'s Campground',
  'Cherry Hill Park',
  'Hersheypark Camping Resort',
  'Camp Margaritaville',
  'Petoskey KOA',
  'Zion River Resort',
  'Lake George RV Park',
];

// US states for regional searches
const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

interface PlaceResult {
  place_id: string;
  name: string;
  geometry: { location: { lat: number; lng: number } };
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  photos?: { photo_reference: string }[];
}

interface ApiResponse {
  status: string;
  error_message?: string;
  results?: PlaceResult[];
  next_page_token?: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function textSearch(query: string): Promise<PlaceResult[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json() as ApiResponse;
  
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error(`API Error: ${data.status} - ${data.error_message || ''}`);
    return [];
  }
  
  let results: PlaceResult[] = data.results || [];
  
  // Get next pages
  if (data.next_page_token) {
    await delay(2000);
    const nextUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${data.next_page_token}&key=${GOOGLE_API_KEY}`;
    const nextResponse = await fetch(nextUrl);
    const nextData = await nextResponse.json() as ApiResponse;
    results = [...results, ...(nextData.results || [])];
  }
  
  return results;
}

function extractState(address: string): string | null {
  const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/) || 
                     address.match(/,\s*([A-Z]{2})(?:,|\s|$)/);
  return stateMatch ? stateMatch[1] : null;
}

function getPhotoUrl(photoReference: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;
}

async function findExisting(lat: number, lng: number, name: string) {
  // Check by coordinates first (within ~500m)
  const nearby = await prisma.campground.findFirst({
    where: {
      latitude: { gte: lat - 0.005, lte: lat + 0.005 },
      longitude: { gte: lng - 0.005, lte: lng + 0.005 },
    }
  });
  if (nearby) return nearby;
  
  return null;
}

async function importChainCampgrounds(dryRun: boolean = true) {
  console.log('🏕️  Premium Chain Campgrounds Import');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE IMPORT'}`);
  console.log('=====================================\n');
  
  const stats = { found: 0, newAdded: 0, updated: 0, skipped: 0, apiCalls: 0 };
  const seenPlaceIds = new Set<string>();
  
  // Search for each chain
  for (const chain of CHAINS) {
    console.log(`\n🔍 Searching: ${chain}`);
    
    stats.apiCalls++;
    const results = await textSearch(`${chain} campground USA`);
    console.log(`   Found ${results.length} results`);
    
    for (const place of results) {
      if (seenPlaceIds.has(place.place_id)) continue;
      seenPlaceIds.add(place.place_id);
      stats.found++;
      
      const address = place.formatted_address || '';
      const state = extractState(address);
      
      const existing = await findExisting(
        place.geometry.location.lat,
        place.geometry.location.lng,
        place.name
      );
      
      if (existing) {
        const updates: { imageUrl?: string; latitude?: number; longitude?: number } = {};
        
        if (!existing.imageUrl && place.photos?.[0]) {
          updates.imageUrl = getPhotoUrl(place.photos[0].photo_reference);
        }
        if (!existing.latitude) updates.latitude = place.geometry.location.lat;
        if (!existing.longitude) updates.longitude = place.geometry.location.lng;
        
        if (Object.keys(updates).length > 0) {
          console.log(`   ✏️  Update: ${place.name}`);
          if (!dryRun) {
            await prisma.campground.update({ where: { id: existing.id }, data: updates });
          }
          stats.updated++;
        } else {
          stats.skipped++;
        }
      } else {
        console.log(`   ➕ New: ${place.name} (${state || 'Unknown'})`);
        
        if (!dryRun) {
          await prisma.campground.create({
            data: {
              name: place.name,
              location: address,
              state: state || 'Unknown',
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng,
              imageUrl: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
              amenities: [],
              verificationStatus: 'UNCLAIMED',
            }
          });
        }
        stats.newAdded++;
      }
    }
    
    await delay(500);
  }
  
  // Also search by state for major chains
  const majorChains = ['KOA', 'Jellystone', 'Thousand Trails'];
  for (const chain of majorChains) {
    for (const state of STATES) {
      stats.apiCalls++;
      const results = await textSearch(`${chain} ${state}`);
      
      for (const place of results) {
        if (seenPlaceIds.has(place.place_id)) continue;
        seenPlaceIds.add(place.place_id);
        stats.found++;
        
        const address = place.formatted_address || '';
        const stateCode = extractState(address);
        
        const existing = await findExisting(
          place.geometry.location.lat,
          place.geometry.location.lng,
          place.name
        );
        
        if (!existing) {
          console.log(`   ➕ New: ${place.name} (${stateCode || state})`);
          
          if (!dryRun) {
            await prisma.campground.create({
              data: {
                name: place.name,
                location: address,
                state: stateCode || state.substring(0, 2).toUpperCase(),
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
                imageUrl: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
                amenities: [],
                verificationStatus: 'UNCLAIMED',
              }
            });
          }
          stats.newAdded++;
        } else {
          stats.skipped++;
        }
      }
      
      await delay(300);
    }
    console.log(`\n✅ Finished ${chain} state search`);
  }
  
  const cost = stats.apiCalls * 0.032;
  
  console.log('\n=====================================');
  console.log('🏁 IMPORT COMPLETE');
  console.log('=====================================');
  console.log(`Total Found: ${stats.found}`);
  console.log(`New Added: ${stats.newAdded}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`API Calls: ${stats.apiCalls}`);
  console.log(`Estimated Cost: $${cost.toFixed(2)}`);
}

const isLive = process.argv.includes('--live');
importChainCampgrounds(!isLive)
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
