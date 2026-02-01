import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

interface TextSearchResponse {
  status: string;
  results?: {
    place_id: string;
    name: string;
  }[];
}

interface PlaceDetailsResponse {
  status: string;
  result?: {
    name: string;
    types?: string[];
    wheelchair_accessible_entrance?: boolean;
    serves_breakfast?: boolean;
    reviews?: { text: string }[];
    editorial_summary?: { overview: string };
    website?: string;
  };
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Map Google types to our amenities
const TYPE_TO_AMENITY: { [key: string]: string[] } = {
  'rv_park': ['rv_sites'],
  'campground': ['tent_sites', 'campfire'],
  'lodging': ['cabin_rentals'],
  'park': ['hiking', 'nature'],
  'tourist_attraction': ['scenic'],
};

// Keywords to search in reviews and descriptions
const REVIEW_KEYWORDS: { [key: string]: string[] } = {
  hasFullHookups: ['full hookup', 'full hook-up', 'fhu', 'water sewer electric'],
  hasWaterHookup: ['water hookup', 'water hook'],
  hasElectricHookup: ['electric', '30 amp', '50 amp', 'power'],
  hasSewerHookup: ['sewer', 'sewage'],
  hasPullThrough: ['pull through', 'pull-through', 'pull thru'],
  hasDumpStation: ['dump station', 'dump site'],
  hasWifi: ['wifi', 'wi-fi', 'internet'],
  hasShowers: ['shower', 'bath house', 'bathhouse'],
  hasRestrooms: ['restroom', 'bathroom', 'toilet'],
  hasLaundry: ['laundry', 'washer', 'dryer'],
  hasPool: ['pool', 'swimming'],
  hasStore: ['store', 'shop', 'supplies'],
  isPetFriendly: ['pet friendly', 'dogs allowed', 'dog park', 'pets welcome'],
  isBigRigFriendly: ['big rig', 'large rv', '40 foot', '45 foot'],
  isWaterfront: ['lake', 'river', 'beach', 'waterfront', 'ocean', 'creek'],
};

const AMENITY_KEYWORDS: { [key: string]: string[] } = {
  'flush_toilets': ['flush toilet', 'restroom', 'bathroom'],
  'showers': ['shower', 'bath house'],
  'dump_station': ['dump station'],
  'laundry': ['laundry', 'washer'],
  'wifi': ['wifi', 'wi-fi', 'internet'],
  'pool': ['pool', 'swimming pool'],
  'playground': ['playground', 'play area'],
  'camp_store': ['store', 'camp store'],
  'propane': ['propane'],
  'fishing': ['fishing', 'fish'],
  'hiking': ['hiking', 'trail'],
  'boating': ['boat', 'marina', 'kayak'],
  'pet_friendly': ['pet friendly', 'dogs'],
  'full_hookups': ['full hookup'],
  'pull_through': ['pull through', 'pull-through'],
  'big_rig_friendly': ['big rig'],
};

async function getPlaceId(name: string, location: string): Promise<string | null> {
  const query = `${name} ${location} campground rv park`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json() as TextSearchResponse;
    if (data.status === 'OK' && data.results && data.results[0]) {
      return data.results[0].place_id;
    }
  } catch {}
  return null;
}

async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResponse['result'] | null> {
  const fields = 'name,types,wheelchair_accessible_entrance,reviews,editorial_summary,website';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json() as PlaceDetailsResponse;
    if (data.status === 'OK' && data.result) {
      return data.result;
    }
  } catch {}
  return null;
}

function extractFromText(text: string): { fields: { [key: string]: boolean }, amenities: string[] } {
  const lowerText = text.toLowerCase();
  const fields: { [key: string]: boolean } = {};
  const amenities: string[] = [];
  
  // Extract boolean fields
  for (const [field, keywords] of Object.entries(REVIEW_KEYWORDS)) {
    for (const kw of keywords) {
      if (lowerText.includes(kw)) {
        fields[field] = true;
        break;
      }
    }
  }
  
  // Extract amenities
  for (const [amenity, keywords] of Object.entries(AMENITY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lowerText.includes(kw) && !amenities.includes(amenity)) {
        amenities.push(amenity);
        break;
      }
    }
  }
  
  return { fields, amenities };
}

async function main() {
  console.log('🏕️  Scrape Amenities via Google Places API');
  console.log('==========================================\n');
  
  // Find campgrounds with few amenities
  const campgrounds = await prisma.campground.findMany({
    where: {
      hasFullHookups: null,
    },
    select: { 
      id: true, 
      name: true, 
      location: true, 
      state: true,
      amenities: true 
    }
  });
  
  // Filter to those with 3 or fewer amenities
  const needsData = campgrounds.filter(c => !c.amenities || c.amenities.length <= 3);
  
  console.log(`Found ${needsData.length} campgrounds needing amenity data\n`);
  
  let updated = 0;
  let notFound = 0;
  
  for (let i = 0; i < needsData.length; i++) {
    const camp = needsData[i];
    
    const placeId = await getPlaceId(camp.name, camp.location || camp.state || '');
    await delay(100);
    
    if (placeId) {
      const details = await getPlaceDetails(placeId);
      await delay(100);
      
      if (details) {
        // Combine all text to search
        let allText = details.editorial_summary?.overview || '';
        if (details.reviews) {
          allText += ' ' + details.reviews.map(r => r.text).join(' ');
        }
        
        const { fields, amenities } = extractFromText(allText);
        
        // Add wheelchair accessible if indicated
        if (details.wheelchair_accessible_entrance) {
          // handicap accessible - add to amenities only;
          amenities.push('handicap_accessible');
        }
        
        // Merge amenities
        const existingAmenities = camp.amenities || [];
        const mergedAmenities = [...new Set([...existingAmenities, ...amenities])];
        
        const fieldsFound = Object.keys(fields).length + amenities.length;
        
        if (fieldsFound > 0) {
          await prisma.campground.update({
            where: { id: camp.id },
            data: {
              amenities: mergedAmenities,
              ...fields
            }
          });
          console.log(`✅ ${camp.name}: ${Object.keys(fields).length} fields, ${amenities.length} amenities`);
          updated++;
        } else {
          console.log(`⏭️  ${camp.name}: No data found`);
          notFound++;
        }
      } else {
        notFound++;
      }
    } else {
      notFound++;
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${needsData.length} | Updated: ${updated} | No data: ${notFound}\n`);
    }
  }
  
  console.log('\n==========================================');
  console.log('🏁 COMPLETE');
  console.log('==========================================');
  console.log(`Updated: ${updated}`);
  console.log(`No data found: ${notFound}`);
}

main().catch(console.error).finally(() => process.exit());
