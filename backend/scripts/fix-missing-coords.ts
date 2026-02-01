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
  }[];
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function getPhotoUrl(ref: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_API_KEY}`;
}

async function searchPlace(name: string, location: string): Promise<ApiResponse['results']> {
  const query = `${name} ${location} campground`;
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
  console.log('🏕️  Fix Missing Coordinates Script');
  console.log('===================================\n');
  
  // Find campgrounds without lat/lng
  const noCoords = await prisma.campground.findMany({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    },
    select: { id: true, name: true, location: true, state: true, imageUrl: true }
  });
  
  console.log(`Found ${noCoords.length} campgrounds without coordinates\n`);
  
  let updated = 0;
  let deleted = 0;
  let notFound = 0;
  
  for (let i = 0; i < noCoords.length; i++) {
    const camp = noCoords[i];
    
    const results = await searchPlace(camp.name, camp.location || camp.state || '');
    await delay(200);
    
    if (results && results.length > 0) {
      const place = results[0];
      
      // Check if in USA
      if (!place.formatted_address.includes('USA') && !place.formatted_address.includes('United States')) {
        console.log(`🗑️  Deleting (not USA): ${camp.name}`);
        await prisma.campground.delete({ where: { id: camp.id } });
        deleted++;
        continue;
      }
      
      const photoUrl = (!camp.imageUrl && place.photos?.[0]) ? getPhotoUrl(place.photos[0].photo_reference) : undefined;
      
      await prisma.campground.update({
        where: { id: camp.id },
        data: {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          ...(photoUrl && { imageUrl: photoUrl })
        }
      });
      console.log(`✅ Updated: ${camp.name} → ${place.geometry.location.lat.toFixed(4)}, ${place.geometry.location.lng.toFixed(4)}`);
      updated++;
    } else {
      console.log(`🗑️  Deleting (not found): ${camp.name}`);
      await prisma.campground.delete({ where: { id: camp.id } });
      deleted++;
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${noCoords.length} | Updated: ${updated} | Deleted: ${deleted}\n`);
    }
  }
  
  console.log('\n===================================');
  console.log('🏁 COMPLETE');
  console.log('===================================');
  console.log(`Updated: ${updated}`);
  console.log(`Deleted: ${deleted}`);
  
  const total = await prisma.campground.count();
  console.log(`\nTotal campgrounds: ${total}`);
  
  // Verify no more missing coords
  const stillMissing = await prisma.campground.count({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    }
  });
  console.log(`Still missing coordinates: ${stillMissing}`);
}

main().catch(console.error).finally(() => process.exit());
