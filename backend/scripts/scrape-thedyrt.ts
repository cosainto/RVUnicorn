import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const STATE_NAMES: { [key: string]: string } = {
  'AL': 'alabama', 'AK': 'alaska', 'AZ': 'arizona', 'AR': 'arkansas', 'CA': 'california',
  'CO': 'colorado', 'CT': 'connecticut', 'DE': 'delaware', 'FL': 'florida', 'GA': 'georgia',
  'HI': 'hawaii', 'ID': 'idaho', 'IL': 'illinois', 'IN': 'indiana', 'IA': 'iowa',
  'KS': 'kansas', 'KY': 'kentucky', 'LA': 'louisiana', 'ME': 'maine', 'MD': 'maryland',
  'MA': 'massachusetts', 'MI': 'michigan', 'MN': 'minnesota', 'MS': 'mississippi', 'MO': 'missouri',
  'MT': 'montana', 'NE': 'nebraska', 'NV': 'nevada', 'NH': 'new-hampshire', 'NJ': 'new-jersey',
  'NM': 'new-mexico', 'NY': 'new-york', 'NC': 'north-carolina', 'ND': 'north-dakota', 'OH': 'ohio',
  'OK': 'oklahoma', 'OR': 'oregon', 'PA': 'pennsylvania', 'RI': 'rhode-island', 'SC': 'south-carolina',
  'SD': 'south-dakota', 'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah', 'VT': 'vermont',
  'VA': 'virginia', 'WA': 'washington', 'WV': 'west-virginia', 'WI': 'wisconsin', 'WY': 'wyoming'
};

// TheDyrt amenity mappings
const DYRT_AMENITIES: { [key: string]: { field?: string, amenity?: string } } = {
  'full hookups': { field: 'hasFullHookups', amenity: 'full_hookups' },
  'water hookup': { field: 'hasWaterHookup', amenity: 'water_hookup' },
  'electric hookup': { field: 'hasElectricHookup', amenity: 'electric_hookup' },
  'sewer hookup': { field: 'hasSewerHookup', amenity: 'sewer_hookup' },
  'pull-through': { field: 'hasPullThrough', amenity: 'pull_through' },
  'dump station': { field: 'hasDumpStation', amenity: 'dump_station' },
  'wifi': { field: 'hasWifi', amenity: 'wifi' },
  'showers': { field: 'hasShowers', amenity: 'showers' },
  'hot showers': { field: 'hasShowers', amenity: 'showers' },
  'restrooms': { field: 'hasRestrooms', amenity: 'flush_toilets' },
  'flush toilets': { field: 'hasRestrooms', amenity: 'flush_toilets' },
  'vault toilets': { amenity: 'vault_toilets' },
  'pit toilets': { amenity: 'vault_toilets' },
  'laundry': { field: 'hasLaundry', amenity: 'laundry' },
  'pool': { field: 'hasPool', amenity: 'pool' },
  'swimming pool': { field: 'hasPool', amenity: 'pool' },
  'store': { field: 'hasStore', amenity: 'camp_store' },
  'camp store': { field: 'hasStore', amenity: 'camp_store' },
  'propane': { field: 'hasPropane', amenity: 'propane' },
  'pets allowed': { field: 'isPetFriendly', amenity: 'pet_friendly' },
  'pet friendly': { field: 'isPetFriendly', amenity: 'pet_friendly' },
  'big rigs': { field: 'isBigRigFriendly', amenity: 'big_rig_friendly' },
  'waterfront': { field: 'isWaterfront', amenity: 'waterfront' },
  'lake': { field: 'isWaterfront', amenity: 'fishing' },
  'river': { field: 'isWaterfront', amenity: 'fishing' },
  'beach': { field: 'isWaterfront', amenity: 'beach_access' },
  'fishing': { amenity: 'fishing' },
  'hiking': { amenity: 'hiking' },
  'boating': { amenity: 'boating' },
  'kayaking': { amenity: 'kayaking' },
  'swimming': { amenity: 'swimming' },
  'playground': { amenity: 'playground' },
  'fire rings': { amenity: 'fire_rings' },
  'fire pits': { amenity: 'fire_rings' },
  'picnic tables': { amenity: 'picnic_tables' },
  'tent sites': { amenity: 'tent_sites' },
  'rv sites': { amenity: 'rv_sites' },
  'cabins': { amenity: 'cabin_rentals' },
  'cable tv': { field: 'hasCableTV', amenity: 'cable_tv' },
  '30 amp': { field: 'hasElectricHookup' },
  '50 amp': { field: 'hasElectricHookup' },
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchDyrtPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    
    return await res.text();
  } catch {
    return null;
  }
}

function extractAmenitiesFromHtml(html: string): { fields: { [key: string]: boolean }, amenities: string[] } {
  const lowerHtml = html.toLowerCase();
  const fields: { [key: string]: boolean } = {};
  const amenities: string[] = [];
  
  for (const [keyword, mapping] of Object.entries(DYRT_AMENITIES)) {
    if (lowerHtml.includes(keyword)) {
      if (mapping.field) {
        fields[mapping.field] = true;
      }
      if (mapping.amenity && !amenities.includes(mapping.amenity)) {
        amenities.push(mapping.amenity);
      }
    }
  }
  
  return { fields, amenities };
}

function extractDescription(html: string): string | null {
  // Look for meta description or og:description
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i) ||
                    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  
  if (metaMatch && metaMatch[1] && metaMatch[1].length > 50) {
    return metaMatch[1].slice(0, 500);
  }
  
  return null;
}

function extractImageUrl(html: string): string | null {
  // Look for og:image
  const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                   html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  
  if (imgMatch && imgMatch[1] && !imgMatch[1].includes('default') && !imgMatch[1].includes('placeholder')) {
    return imgMatch[1];
  }
  
  return null;
}

async function searchDyrt(name: string, state: string): Promise<string | null> {
  const stateName = STATE_NAMES[state] || state.toLowerCase();
  const slug = slugify(name);
  
  // Try different URL patterns
  const urls = [
    `https://thedyrt.com/camping/${stateName}/${slug}`,
    `https://thedyrt.com/camping/${stateName}/${slug}-campground`,
    `https://thedyrt.com/camping/${stateName}/${slug.replace('-campground', '')}`,
  ];
  
  for (const url of urls) {
    const html = await fetchDyrtPage(url);
    if (html && html.includes('thedyrt') && !html.includes('Page not found') && !html.includes('404')) {
      return url;
    }
    await delay(300);
  }
  
  return null;
}

async function main() {
  console.log('🏕️  Scrape Campground Data from TheDyrt.com');
  console.log('============================================\n');
  
  // Find campgrounds still needing data
  const campgrounds = await prisma.campground.findMany({
    where: {
      OR: [
        { hasFullHookups: null, hasShowers: null, hasRestrooms: null },
        { amenities: { isEmpty: true } }
      ]
    },
    select: { 
      id: true, 
      name: true, 
      state: true,
      amenities: true,
      imageUrl: true,
      description: true,
    },
    take: 500 // Process in batches
  });
  
  console.log(`Found ${campgrounds.length} campgrounds to check on TheDyrt\n`);
  
  let updated = 0;
  let notFound = 0;
  const sources: { name: string, url: string }[] = [];
  
  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];
    
    if (!camp.state) {
      notFound++;
      continue;
    }
    
    const dyrtUrl = await searchDyrt(camp.name, camp.state);
    
    if (dyrtUrl) {
      const html = await fetchDyrtPage(dyrtUrl);
      
      if (html) {
        const { fields, amenities } = extractAmenitiesFromHtml(html);
        const description = !camp.description ? extractDescription(html) : null;
        const imageUrl = !camp.imageUrl ? extractImageUrl(html) : null;
        
        const existingAmenities = camp.amenities || [];
        const mergedAmenities = [...new Set([...existingAmenities, ...amenities])];
        
        const totalFound = Object.keys(fields).length + amenities.length;
        
        if (totalFound > 0 || description || imageUrl) {
          const updateData: any = { 
            amenities: mergedAmenities, 
            ...fields 
          };
          if (description) updateData.description = description;
          if (imageUrl) updateData.imageUrl = imageUrl;
          
          await prisma.campground.update({
            where: { id: camp.id },
            data: updateData
          });
          
          console.log(`✅ ${camp.name}: ${Object.keys(fields).length} fields, ${amenities.length} amenities`);
          console.log(`   Source: ${dyrtUrl}`);
          sources.push({ name: camp.name, url: dyrtUrl });
          updated++;
        } else {
          console.log(`⏭️  ${camp.name}: Page found but no amenity data`);
          notFound++;
        }
      } else {
        notFound++;
      }
    } else {
      console.log(`❌ ${camp.name}: Not found on TheDyrt`);
      notFound++;
    }
    
    await delay(500); // Be respectful to TheDyrt
    
    if ((i + 1) % 25 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${campgrounds.length} | Updated: ${updated} | Not found: ${notFound}\n`);
    }
  }
  
  console.log('\n============================================');
  console.log('🏁 COMPLETE');
  console.log('============================================');
  console.log(`Updated from TheDyrt: ${updated}`);
  console.log(`Not found: ${notFound}`);
  
  console.log('\n📋 Sources Used:');
  console.log('================');
  sources.forEach(s => console.log(`${s.name}: ${s.url}`));
  
  // Final stats
  const total = await prisma.campground.count();
  const withData = await prisma.campground.count({
    where: {
      OR: [
        { hasFullHookups: { not: null } },
        { hasShowers: { not: null } },
        { amenities: { isEmpty: false } }
      ]
    }
  });
  console.log(`\nCampgrounds with amenity data: ${withData}/${total}`);
}

main().catch(console.error).finally(() => process.exit());
