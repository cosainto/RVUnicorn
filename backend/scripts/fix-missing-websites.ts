import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

interface TextSearchResponse {
  status: string;
  results?: {
    place_id: string;
    name: string;
    formatted_address: string;
  }[];
}

interface PlaceDetailsResponse {
  status: string;
  result?: {
    website?: string;
    url?: string;
  };
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function searchPlace(name: string, location: string): Promise<string | null> {
  const query = `${name} ${location} campground`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json() as TextSearchResponse;
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0].place_id;
    }
    return null;
  } catch {
    return null;
  }
}

async function getPlaceDetails(placeId: string): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${GOOGLE_API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json() as PlaceDetailsResponse;
    if (data.status === 'OK' && data.result?.website) {
      return data.result.website;
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('🏕️  Fix Missing Websites Script');
  console.log('================================\n');
  
  // Find campgrounds without websiteUrl
  const noWebsite = await prisma.campground.findMany({
    where: {
      OR: [
        { websiteUrl: null },
        { websiteUrl: '' }
      ]
    },
    select: { id: true, name: true, location: true, state: true }
  });
  
  console.log(`Found ${noWebsite.length} campgrounds without websites\n`);
  
  let updated = 0;
  let notFound = 0;
  
  for (let i = 0; i < noWebsite.length; i++) {
    const camp = noWebsite[i];
    
    const placeId = await searchPlace(camp.name, camp.location || camp.state || '');
    await delay(100);
    
    if (placeId) {
      const website = await getPlaceDetails(placeId);
      await delay(100);
      
      if (website) {
        await prisma.campground.update({
          where: { id: camp.id },
          data: { websiteUrl: website }
        });
        console.log(`✅ ${camp.name} → ${website}`);
        updated++;
      } else {
        notFound++;
      }
    } else {
      notFound++;
    }
    
    if ((i + 1) % 100 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${noWebsite.length} | Updated: ${updated} | No website: ${notFound}\n`);
    }
  }
  
  console.log('\n================================');
  console.log('🏁 COMPLETE');
  console.log('================================');
  console.log(`Websites added: ${updated}`);
  console.log(`No website found: ${notFound}`);
  
  const withWebsite = await prisma.campground.count({
    where: {
      websiteUrl: { not: null }
    }
  });
  const total = await prisma.campground.count();
  console.log(`\nCampgrounds with websites: ${withWebsite}/${total}`);
}

main().catch(console.error).finally(() => process.exit());
