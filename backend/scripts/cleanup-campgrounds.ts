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

function extractCity(address: string): string {
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 3]?.trim() || parts[0].trim();
  }
  return parts[0].trim();
}

function getPhotoUrl(ref: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_API_KEY}`;
}

// Check if this looks like a legitimate campground based on Google types
function isLikelyCampground(types: string[]): boolean {
  const campgroundTypes = ['campground', 'rv_park', 'lodging', 'park', 'tourist_attraction'];
  const badTypes = ['real_estate_agency', 'car_dealer', 'storage', 'moving_company', 'lawyer', 'doctor', 'dentist', 'hospital', 'school', 'church', 'restaurant', 'bar', 'gas_station', 'car_repair', 'car_wash', 'grocery_or_supermarket', 'convenience_store', 'clothing_store', 'home_goods_store', 'furniture_store', 'hardware_store', 'electronics_store', 'jewelry_store', 'shoe_store', 'pet_store', 'florist'];
  
  if (types.some(t => badTypes.includes(t))) return false;
  if (types.some(t => campgroundTypes.includes(t))) return true;
  return false;
}

async function searchPlace(name: string, location: string): Promise<ApiResponse['results']> {
  const query = `${name} ${location} campground RV park`;
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
  console.log('🏕️  Campground Cleanup Script');
  console.log('==============================\n');
  
  // Get all campgrounds without valid state
  const campgrounds = await prisma.campground.findMany({
    where: {
      OR: [
        { state: 'Unknown' },
        { state: '' },
        { state: null }
      ]
    },
    select: { id: true, name: true, location: true, state: true }
  });
  
  console.log(`Found ${campgrounds.length} campgrounds to process\n`);
  
  let updated = 0;
  let deleted = 0;
  let skipped = 0;
  
  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];
    
    // Skip obviously non-campground entries
    const skipPatterns = ['LLC', 'Inc', 'Corp', 'Properties', 'Homes', 'Auto', 'Repair', 'Store', 'Restaurant', 'Church', 'School', 'Hospital', 'Dentist', 'Doctor', 'Lawyer', 'Insurance', 'Bank', 'Real Estate', 'Storage', 'Walmart', 'Costco', 'Target', 'casa de', 'Casa de', 'casa del', 'Rancho', 'Finca', 'Ejido', 'Fraccionamiento', 'Quinta', 'calle', 'Calle', 'Boulevard', 'Privada'];
    
    if (skipPatterns.some(p => camp.name.includes(p))) {
      console.log(`🗑️  Deleting (non-campground): ${camp.name}`);
      await prisma.campground.delete({ where: { id: camp.id } });
      deleted++;
      continue;
    }
    
    // Search Google Places
    const results = await searchPlace(camp.name, camp.location || '');
    await delay(200);
    
    if (results && results.length > 0) {
      const place = results[0];
      const state = extractState(place.formatted_address);
      
      // Check if result is in USA
      if (!place.formatted_address.includes('USA') && !place.formatted_address.includes('United States') && !state) {
        console.log(`🗑️  Deleting (not in USA): ${camp.name}`);
        await prisma.campground.delete({ where: { id: camp.id } });
        deleted++;
        continue;
      }
      
      // Check if it's a likely campground
      if (place.types && !isLikelyCampground(place.types)) {
        console.log(`🗑️  Deleting (not a campground): ${camp.name} [${place.types?.join(', ')}]`);
        await prisma.campground.delete({ where: { id: camp.id } });
        deleted++;
        continue;
      }
      
      if (state) {
        const photoUrl = place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : undefined;
        
        await prisma.campground.update({
          where: { id: camp.id },
          data: {
            state: state,
            location: place.formatted_address,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            ...(photoUrl && { imageUrl: photoUrl })
          }
        });
        console.log(`✅ Updated: ${camp.name} → ${state}`);
        updated++;
      } else {
        console.log(`🗑️  Deleting (no state found): ${camp.name}`);
        await prisma.campground.delete({ where: { id: camp.id } });
        deleted++;
      }
    } else {
      console.log(`🗑️  Deleting (not found): ${camp.name}`);
      await prisma.campground.delete({ where: { id: camp.id } });
      deleted++;
    }
    
    // Progress update every 50
    if ((i + 1) % 50 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${campgrounds.length} | Updated: ${updated} | Deleted: ${deleted}\n`);
    }
  }
  
  console.log('\n==============================');
  console.log('🏁 CLEANUP COMPLETE');
  console.log('==============================');
  console.log(`Updated: ${updated}`);
  console.log(`Deleted: ${deleted}`);
  console.log(`Skipped: ${skipped}`);
  
  const total = await prisma.campground.count();
  console.log(`\nTotal campgrounds remaining: ${total}`);
}

main().catch(console.error).finally(() => process.exit());
