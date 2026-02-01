import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Keywords to search for each field
const FIELD_KEYWORDS: { [key: string]: string[] } = {
  hasFullHookups: ['full hookup', 'full hook-up', 'full hook up', 'full service', 'fhu'],
  hasWaterHookup: ['water hookup', 'water hook-up', 'water connection', 'water available', 'water/electric'],
  hasElectricHookup: ['electric hookup', 'electric hook-up', '30 amp', '50 amp', '30/50 amp', 'electrical hookup', 'electric service', '20/30/50'],
  hasSewerHookup: ['sewer hookup', 'sewer hook-up', 'sewer connection', 'sewage hookup'],
  hasPullThrough: ['pull-through', 'pull through', 'pullthrough', 'pull-thru', 'pull thru'],
  hasBackIn: ['back-in', 'back in', 'backin'],
  hasDumpStation: ['dump station', 'dumping station', 'rv dump', 'sanitary dump', 'sanitary station', 'dump site'],
  hasWifi: ['wifi', 'wi-fi', 'wireless internet', 'internet access', 'free wifi', 'free wi-fi'],
  hasCableTV: ['cable tv', 'cable television', 'satellite tv'],
  hasShowers: ['shower', 'hot shower', 'shower house', 'bathhouse', 'shower facilities'],
  hasRestrooms: ['restroom', 'bathroom', 'flush toilet', 'modern restroom', 'toilet facilities'],
  hasLaundry: ['laundry', 'washer', 'dryer', 'laundromat', 'coin laundry', 'laundry facilities'],
  hasPool: ['pool', 'swimming pool', 'heated pool'],
  hasStore: ['camp store', 'general store', 'store', 'convenience store', 'gift shop', 'camp shop'],
  hasPropane: ['propane', 'lp gas', 'propane refill'],
  isPetFriendly: ['pet friendly', 'pets allowed', 'pets welcome', 'dog friendly', 'dogs allowed', 'pet-friendly'],
  isBigRigFriendly: ['big rig', 'big-rig', 'large rv', '45 foot', '40 foot', '45 ft', '40 ft', 'big rig friendly', 'class a'],
  isWaterfront: ['waterfront', 'lakefront', 'oceanfront', 'beachfront', 'riverfront', 'on the water', 'lake view', 'ocean view', 'beach access'],
};

// Amenity strings to add to amenities array
const AMENITY_KEYWORDS: { [key: string]: string[] } = {
  'flush_toilets': ['flush toilet', 'restroom', 'bathroom', 'modern restroom'],
  'vault_toilets': ['vault toilet', 'pit toilet', 'outhouse'],
  'showers': ['shower', 'hot shower', 'shower house', 'bathhouse'],
  'dump_station': ['dump station', 'dumping station', 'rv dump', 'sanitary dump'],
  'laundry': ['laundry', 'washer', 'dryer', 'laundromat'],
  'wifi': ['wifi', 'wi-fi', 'wireless internet', 'internet access'],
  'cable_tv': ['cable tv', 'cable television'],
  'pool': ['pool', 'swimming pool'],
  'hot_tub': ['hot tub', 'spa', 'jacuzzi'],
  'playground': ['playground', 'play area'],
  'dog_park': ['dog park', 'pet area', 'off-leash'],
  'camp_store': ['camp store', 'general store', 'gift shop'],
  'propane': ['propane', 'lp gas'],
  'firewood': ['firewood', 'fire wood'],
  'picnic_tables': ['picnic table', 'picnic area'],
  'fire_rings': ['fire ring', 'fire pit', 'campfire'],
  'grills': ['grill', 'bbq', 'barbecue'],
  'fishing': ['fishing', 'fish'],
  'hiking': ['hiking', 'hiking trail', 'nature trail'],
  'biking': ['biking', 'bike trail', 'bicycle'],
  'boating': ['boating', 'boat ramp', 'boat launch', 'marina'],
  'kayaking': ['kayak', 'canoe', 'paddleboard'],
  'swimming': ['swimming', 'swim', 'beach'],
  'golf': ['golf', 'mini golf'],
  'beach_access': ['beach access', 'beach', 'oceanfront'],
  'full_hookups': ['full hookup', 'full hook-up', 'fhu'],
  'water_electric': ['water/electric', 'w/e', 'water and electric'],
  '30_amp': ['30 amp', '30amp', '30-amp'],
  '50_amp': ['50 amp', '50amp', '50-amp'],
  'pull_through': ['pull-through', 'pull through', 'pull-thru'],
  'big_rig_friendly': ['big rig', 'big-rig'],
  'pet_friendly': ['pet friendly', 'pets allowed', 'dogs allowed'],
  'handicap_accessible': ['handicap', 'accessible', 'ada', 'wheelchair'],
  'tent_sites': ['tent site', 'tent camping'],
  'cabin_rentals': ['cabin', 'cottage', 'rental unit'],
};

// Extract max RV length from text
function extractMaxRvLength(html: string): number | null {
  const patterns = [
    /(\d{2,3})\s*(?:foot|ft|feet)\s*(?:rv|rig|motorhome|max)/i,
    /max(?:imum)?\s*(?:rv|rig)?\s*(?:length|size)?\s*:?\s*(\d{2,3})/i,
    /accommodate\s*(?:rv|rig)s?\s*up\s*to\s*(\d{2,3})/i,
    /up\s*to\s*(\d{2,3})\s*(?:foot|ft|feet)/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const length = parseInt(match[1]);
      if (length >= 20 && length <= 100) {
        return length;
      }
    }
  }
  return null;
}

// Extract max amp service
function extractMaxAmpService(html: string): number | null {
  if (html.includes('50 amp') || html.includes('50amp') || html.includes('50-amp')) {
    return 50;
  }
  if (html.includes('30 amp') || html.includes('30amp') || html.includes('30-amp')) {
    return 30;
  }
  if (html.includes('20 amp') || html.includes('20amp') || html.includes('20-amp')) {
    return 20;
  }
  return null;
}

// Extract price per night
function extractPrice(html: string): number | null {
  const patterns = [
    /\$(\d{2,3})(?:\.\d{2})?\s*(?:\/|\s*per)\s*(?:night|nightly)/i,
    /(?:rate|price|from)\s*:?\s*\$(\d{2,3})/i,
    /starting\s*(?:at|from)\s*\$(\d{2,3})/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const price = parseInt(match[1]);
      if (price >= 15 && price <= 500) {
        return price;
      }
    }
  }
  return null;
}

async function fetchWebsite(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RVUnicorn/1.0; +https://rvunicorn.com)',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    
    const html = await res.text();
    return html.toLowerCase();
  } catch {
    return null;
  }
}

function extractBooleanFields(html: string): { [key: string]: boolean } {
  const fields: { [key: string]: boolean } = {};
  
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    for (const keyword of keywords) {
      if (html.includes(keyword.toLowerCase())) {
        fields[field] = true;
        break;
      }
    }
  }
  
  return fields;
}

function extractAmenities(html: string): string[] {
  const found: string[] = [];
  
  for (const [amenity, keywords] of Object.entries(AMENITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (html.includes(keyword.toLowerCase())) {
        if (!found.includes(amenity)) {
          found.push(amenity);
        }
        break;
      }
    }
  }
  
  return found;
}

async function main() {
  console.log('🏕️  Scrape Amenities & RV Details Script');
  console.log('========================================\n');
  
  const campgrounds = await prisma.campground.findMany({
    where: {
      websiteUrl: { not: null },
    },
    select: { 
      id: true, 
      name: true, 
      websiteUrl: true, 
      amenities: true,
      hasFullHookups: true,
      maxRvLength: true
    }
  });
  
  // Filter to those that need data (no boolean fields set yet)
  const needsData = campgrounds.filter(c => c.hasFullHookups === null && c.maxRvLength === null);
  
  console.log(`Found ${needsData.length} campgrounds to scrape\n`);
  
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  
  for (let i = 0; i < needsData.length; i++) {
    const camp = needsData[i];
    
    if (!camp.websiteUrl) {
      skipped++;
      continue;
    }
    
    const html = await fetchWebsite(camp.websiteUrl);
    
    if (html) {
      const booleanFields = extractBooleanFields(html);
      const amenities = extractAmenities(html);
      const maxRvLength = extractMaxRvLength(html);
      const maxAmpService = extractMaxAmpService(html);
      const pricePerNight = extractPrice(html);
      
      // Merge amenities
      const existingAmenities = camp.amenities || [];
      const mergedAmenities = [...new Set([...existingAmenities, ...amenities])];
      
      const updateData: any = {
        amenities: mergedAmenities,
        ...booleanFields,
      };
      
      if (maxRvLength) updateData.maxRvLength = maxRvLength;
      if (maxAmpService) updateData.maxAmpService = maxAmpService;
      if (pricePerNight) updateData.pricePerNight = pricePerNight;
      
      // Count what we found
      const fieldsFound = Object.keys(booleanFields).length + (maxRvLength ? 1 : 0) + (maxAmpService ? 1 : 0) + amenities.length;
      
      if (fieldsFound > 0) {
        await prisma.campground.update({
          where: { id: camp.id },
          data: updateData
        });
        
        console.log(`✅ ${camp.name}: ${fieldsFound} fields, ${amenities.length} amenities`);
        updated++;
      } else {
        skipped++;
      }
    } else {
      failed++;
    }
    
    await delay(500);
    
    if ((i + 1) % 50 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${needsData.length} | Updated: ${updated} | Failed: ${failed}\n`);
    }
  }
  
  console.log('\n========================================');
  console.log('🏁 COMPLETE');
  console.log('========================================');
  console.log(`Updated: ${updated}`);
  console.log(`Failed to fetch: ${failed}`);
  console.log(`Skipped: ${skipped}`);
}

main().catch(console.error).finally(() => process.exit());
