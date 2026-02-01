import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

interface ApiResponse {
  status: string;
  results?: {
    name: string;
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    photos?: { photo_reference: string }[];
    types?: string[];
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

function isLikelyCampground(types: string[]): boolean {
  const campgroundTypes = ['campground', 'rv_park', 'lodging', 'park', 'tourist_attraction', 'natural_feature'];
  const badTypes = ['real_estate_agency', 'car_dealer', 'storage', 'moving_company', 'lawyer', 'doctor', 'dentist', 'hospital', 'school', 'restaurant', 'bar', 'gas_station', 'car_repair', 'grocery_or_supermarket', 'convenience_store', 'clothing_store'];
  
  if (types.some(t => badTypes.includes(t))) return false;
  if (types.some(t => campgroundTypes.includes(t))) return true;
  return true; // Be more lenient for these since they're already in database
}

async function searchPlace(name: string, state: string): Promise<ApiResponse['results']> {
  const query = `${name} ${state} campground`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json() as ApiResponse;
    return data.status === 'OK' ? data.results : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  console.log('🏕️  Fix Incomplete Locations Script');
  console.log('====================================\n');
  
  const all = await prisma.campground.findMany({
    select: { id: true, name: true, location: true, state: true, latitude: true, longitude: true, imageUrl: true }
  });
  
  const incomplete = all.filter(c => !c.location || c.location === '' || !c.location.includes(','));
  
  console.log(`Found ${incomplete.length} campgrounds with incomplete locations\n`);
  
  let updated = 0;
  let deleted = 0;
  let kept = 0;
  
  for (let i = 0; i < incomplete.length; i++) {
    const camp = incomplete[i];
    
    const results = await searchPlace(camp.name, camp.state || '');
    await delay(200);
    
    if (results && results.length > 0) {
      const place = results[0];
      const state = extractState(place.formatted_address);
      
      // Check if in USA
      if (!place.formatted_address.includes('USA') && !place.formatted_address.includes('United States')) {
        console.log(`🗑️  Deleting (not USA): ${camp.name}`);
        await prisma.campground.delete({ where: { id: camp.id } });
        deleted++;
        continue;
      }
      
      // Check if types suggest it's not a campground
      if (place.types && !isLikelyCampground(place.types)) {
        console.log(`🗑️  Deleting (not campground): ${camp.name}`);
        await prisma.campground.delete({ where: { id: camp.id } });
        deleted++;
        continue;
      }
      
      // Update with full address
      const photoUrl = (!camp.imageUrl && place.photos?.[0]) ? getPhotoUrl(place.photos[0].photo_reference) : undefined;
      
      await prisma.campground.update({
        where: { id: camp.id },
        data: {
          location: place.formatted_address,
          state: state || camp.state,
          latitude: camp.latitude || place.geometry.location.lat,
          longitude: camp.longitude || place.geometry.location.lng,
          ...(photoUrl && { imageUrl: photoUrl })
        }
      });
      console.log(`✅ Updated: ${camp.name} → ${place.formatted_address.substring(0, 50)}...`);
      updated++;
    } else {
      // Not found - keep it if it has coordinates, delete if not
      if (camp.latitude && camp.longitude) {
        console.log(`⏭️  Kept (has coords): ${camp.name}`);
        kept++;
      } else {
        console.log(`🗑️  Deleting (not found): ${camp.name}`);
        await prisma.campground.delete({ where: { id: camp.id } });
        deleted++;
      }
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${incomplete.length} | Updated: ${updated} | Deleted: ${deleted} | Kept: ${kept}\n`);
    }
  }
  
  console.log('\n====================================');
  console.log('🏁 COMPLETE');
  console.log('====================================');
  console.log(`Updated: ${updated}`);
  console.log(`Deleted: ${deleted}`);
  console.log(`Kept (with coords): ${kept}`);
  
  const total = await prisma.campground.count();
  console.log(`\nTotal campgrounds: ${total}`);
}

main().catch(console.error).finally(() => process.exit());
