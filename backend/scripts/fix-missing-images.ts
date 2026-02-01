import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

interface ApiResponse {
  status: string;
  results?: {
    name: string;
    photos?: { photo_reference: string }[];
  }[];
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function getPhotoUrl(ref: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_API_KEY}`;
}

async function searchPlace(name: string, location: string): Promise<string | null> {
  const query = `${name} ${location} campground`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json() as ApiResponse;
    if (data.status === 'OK' && data.results && data.results[0]?.photos?.[0]) {
      return getPhotoUrl(data.results[0].photos[0].photo_reference);
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('🏕️  Fix Missing Images Script');
  console.log('==============================\n');
  
  const noImage = await prisma.campground.findMany({
    where: {
      OR: [
        { imageUrl: null },
        { imageUrl: '' }
      ]
    },
    select: { id: true, name: true, location: true, state: true }
  });
  
  console.log(`Found ${noImage.length} campgrounds without images\n`);
  
  let updated = 0;
  let notFound = 0;
  
  for (let i = 0; i < noImage.length; i++) {
    const camp = noImage[i];
    
    const imageUrl = await searchPlace(camp.name, camp.location || camp.state || '');
    await delay(200);
    
    if (imageUrl) {
      await prisma.campground.update({
        where: { id: camp.id },
        data: { imageUrl }
      });
      console.log(`✅ ${camp.name}`);
      updated++;
    } else {
      console.log(`❌ ${camp.name}`);
      notFound++;
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${noImage.length} | Updated: ${updated} | Not found: ${notFound}\n`);
    }
  }
  
  console.log('\n==============================');
  console.log('🏁 COMPLETE');
  console.log('==============================');
  console.log(`Images added: ${updated}`);
  console.log(`Not found: ${notFound}`);
  
  const stillMissing = await prisma.campground.count({
    where: {
      OR: [
        { imageUrl: null },
        { imageUrl: '' }
      ]
    }
  });
  console.log(`\nStill missing images: ${stillMissing}`);
}

main().catch(console.error).finally(() => process.exit());
