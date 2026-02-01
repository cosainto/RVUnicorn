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

const HIPCAMP_AMENITIES: { [key: string]: { field?: string, amenity?: string } } = {
  'full hookup': { field: 'hasFullHookups', amenity: 'full_hookups' },
  'water hookup': { field: 'hasWaterHookup', amenity: 'water_hookup' },
  'electric hookup': { field: 'hasElectricHookup', amenity: 'electric_hookup' },
  'electricity': { field: 'hasElectricHookup', amenity: 'electric_hookup' },
  'sewer hookup': { field: 'hasSewerHookup', amenity: 'sewer_hookup' },
  'pull-through': { field: 'hasPullThrough', amenity: 'pull_through' },
  'dump station': { field: 'hasDumpStation', amenity: 'dump_station' },
  'wifi': { field: 'hasWifi', amenity: 'wifi' },
  'showers': { field: 'hasShowers', amenity: 'showers' },
  'hot shower': { field: 'hasShowers', amenity: 'showers' },
  'restroom': { field: 'hasRestrooms', amenity: 'flush_toilets' },
  'flush toilet': { field: 'hasRestrooms', amenity: 'flush_toilets' },
  'vault toilet': { amenity: 'vault_toilets' },
  'pit toilet': { amenity: 'vault_toilets' },
  'outhouse': { amenity: 'vault_toilets' },
  'composting toilet': { amenity: 'vault_toilets' },
  'laundry': { field: 'hasLaundry', amenity: 'laundry' },
  'pool': { field: 'hasPool', amenity: 'pool' },
  'swimming pool': { field: 'hasPool', amenity: 'pool' },
  'store': { field: 'hasStore', amenity: 'camp_store' },
  'camp store': { field: 'hasStore', amenity: 'camp_store' },
  'propane': { field: 'hasPropane', amenity: 'propane' },
  'pets allowed': { field: 'isPetFriendly', amenity: 'pet_friendly' },
  'pet friendly': { field: 'isPetFriendly', amenity: 'pet_friendly' },
  'dogs allowed': { field: 'isPetFriendly', amenity: 'pet_friendly' },
  'big rig': { field: 'isBigRigFriendly', amenity: 'big_rig_friendly' },
  'waterfront': { field: 'isWaterfront', amenity: 'waterfront' },
  'lakefront': { field: 'isWaterfront', amenity: 'waterfront' },
  'oceanfront': { field: 'isWaterfront', amenity: 'beach_access' },
  'beachfront': { field: 'isWaterfront', amenity: 'beach_access' },
  'fishing': { amenity: 'fishing' },
  'hiking': { amenity: 'hiking' },
  'boating': { amenity: 'boating' },
  'kayaking': { amenity: 'kayaking' },
  'canoeing': { amenity: 'kayaking' },
  'swimming': { amenity: 'swimming' },
  'playground': { amenity: 'playground' },
  'campfire': { amenity: 'fire_rings' },
  'fire ring': { amenity: 'fire_rings' },
  'fire pit': { amenity: 'fire_rings' },
  'picnic table': { amenity: 'picnic_tables' },
  'tent': { amenity: 'tent_sites' },
  'rv site': { amenity: 'rv_sites' },
  'cabin': { amenity: 'cabin_rentals' },
  'potable water': { amenity: 'water_available' },
  'drinking water': { amenity: 'water_available' },
  'firewood': { amenity: 'firewood' },
  'accessible': { amenity: 'handicap_accessible' },
};

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

// Use Google to find the Hipcamp URL for a campground
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

async function findHipcampUrl(name: string, state: string): Promise<string | null> {
  // Clean up name for search
  const cleanName = name
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const stateName = STATE_NAMES[state] || state;

  // Strategy 1: Google Text Search to find hipcamp listing
  const query = `${cleanName} ${stateName} hipcamp campground`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json() as any;

    if (data.status === 'OK' && data.results && data.results[0]) {
      // We got a Google result - now construct a Hipcamp search URL
      const placeName = data.results[0].name;
    }
  } catch {}

  // Strategy 2: Try Hipcamp search page
  const searchUrl = `https://www.hipcamp.com/en-US/search?q=${encodeURIComponent(cleanName + ' ' + stateName)}`;
  const searchHtml = await fetchPage(searchUrl);

  if (searchHtml) {
    // Look for campground links matching our state
    const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
    const regex = new RegExp(`href=["'](/en-US/campground/united-states/${stateSlug}/[^"']+)["']`, 'gi');
    const matches = [...searchHtml.matchAll(regex)];

    if (matches.length > 0) {
      // Take first match
      return `https://www.hipcamp.com${matches[0][1]}`;
    }

    // Also check for any campground link
    const anyRegex = /href=["'](\/en-US\/campground\/united-states\/[^"']+)["']/gi;
    const anyMatches = [...searchHtml.matchAll(anyRegex)];

    if (anyMatches.length > 0) {
      return `https://www.hipcamp.com${anyMatches[0][1]}`;
    }
  }

  // Strategy 3: Try constructing URL with common slug patterns
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');

  const guessUrls = [
    `https://www.hipcamp.com/en-US/campground/united-states/${stateSlug}/${slug}`,
    `https://www.hipcamp.com/en-US/campground/united-states/${stateSlug}/${slug.replace(/-campground$/, '')}`,
  ];

  for (const guessUrl of guessUrls) {
    const html = await fetchPage(guessUrl);
    if (html && html.length > 5000 && !html.includes('Page not found') && !html.includes('404')) {
      return guessUrl;
    }
    await delay(300);
  }

  return null;
}

function extractData(html: string): {
  fields: { [key: string]: boolean },
  amenities: string[],
  description: string | null,
  imageUrl: string | null
} {
  const lowerHtml = html.toLowerCase();
  const fields: { [key: string]: boolean } = {};
  const amenities: string[] = [];

  for (const [keyword, mapping] of Object.entries(HIPCAMP_AMENITIES)) {
    if (lowerHtml.includes(keyword)) {
      if (mapping.field) fields[mapping.field] = true;
      if (mapping.amenity && !amenities.includes(mapping.amenity)) amenities.push(mapping.amenity);
    }
  }

  // Description from meta tags
  let description: string | null = null;
  const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch && descMatch[1] && descMatch[1].length > 50) {
    description = descMatch[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .slice(0, 500);
  }

  // Image from og:image
  let imageUrl: string | null = null;
  const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                   html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (imgMatch && imgMatch[1] && !imgMatch[1].includes('logo') && !imgMatch[1].includes('default')) {
    imageUrl = imgMatch[1];
  }

  return { fields, amenities, description, imageUrl };
}

async function main() {
  console.log('🏕️  Scrape All Missing Campgrounds from Hipcamp.com');
  console.log('====================================================\n');

  // Find ALL campgrounds still needing data
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
    }
  });

  console.log(`Found ${campgrounds.length} campgrounds to check on Hipcamp\n`);

  let updated = 0;
  let notFound = 0;
  let failed = 0;
  const sources: { name: string, url: string }[] = [];

  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];

    if (!camp.state) {
      notFound++;
      continue;
    }

    const hipcampUrl = await findHipcampUrl(camp.name, camp.state);
    await delay(300);

    if (hipcampUrl) {
      // Fetch the actual campground page (if not already fetched by URL guessing)
      const html = await fetchPage(hipcampUrl);
      await delay(300);

      if (html) {
        const { fields, amenities, description, imageUrl } = extractData(html);

        const existingAmenities = camp.amenities || [];
        const mergedAmenities = [...new Set([...existingAmenities, ...amenities])];

        const totalFound = Object.keys(fields).length + amenities.length;

        if (totalFound > 0 || description || imageUrl) {
          const updateData: any = {
            amenities: mergedAmenities,
            ...fields
          };
          if (!camp.description && description) updateData.description = description;
          if (!camp.imageUrl && imageUrl) updateData.imageUrl = imageUrl;

          await prisma.campground.update({
            where: { id: camp.id },
            data: updateData
          });

          const extras = [];
          if (!camp.imageUrl && imageUrl) extras.push('+image');
          if (!camp.description && description) extras.push('+desc');

          console.log(`✅ ${camp.name}: ${Object.keys(fields).length} fields, ${amenities.length} amenities ${extras.join(' ')}`);
          console.log(`   Source: ${hipcampUrl}`);
          sources.push({ name: camp.name, url: hipcampUrl });
          updated++;
        } else {
          console.log(`⏭️  ${camp.name}: Page found but no data extracted`);
          notFound++;
        }
      } else {
        failed++;
      }
    } else {
      console.log(`❌ ${camp.name}, ${camp.state}`);
      notFound++;
    }

    if ((i + 1) % 25 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${campgrounds.length} | Updated: ${updated} | Not found: ${notFound} | Failed: ${failed}\n`);
    }
  }

  console.log('\n====================================================');
  console.log('🏁 COMPLETE');
  console.log('====================================================');
  console.log(`Updated from Hipcamp: ${updated}`);
  console.log(`Not found on Hipcamp: ${notFound}`);
  console.log(`Failed to fetch: ${failed}`);

  if (sources.length > 0) {
    console.log(`\n📋 Data Sources (${sources.length} campgrounds):`);
    console.log('=================================================');
    sources.forEach(s => console.log(`  ${s.name} → ${s.url}`));
    console.log('\nAll data obtained from: https://www.hipcamp.com');
  }

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
  const noData = total - withData;
  console.log(`\nCampgrounds with amenity data: ${withData}/${total}`);
  console.log(`Still missing data: ${noData} (these will get "unverified" badge)`);
}

main().catch(console.error).finally(() => process.exit());
