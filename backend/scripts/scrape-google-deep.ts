import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const STATE_NAMES: { [key: string]: string } = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

// ---- AMENITY DETECTION ----

const FIELD_KEYWORDS: { [key: string]: string[] } = {
  hasFullHookups: ['full hookup', 'full hook-up', 'fhu', 'water sewer electric', 'w/s/e', 'full-hookup'],
  hasWaterHookup: ['water hookup', 'water hook-up', 'water connection', 'water/electric', 'w/e hookup'],
  hasElectricHookup: ['electric hookup', 'electric hook-up', '30 amp', '50 amp', '30/50', '20/30/50', 'electrical service', 'power hookup'],
  hasSewerHookup: ['sewer hookup', 'sewer hook-up', 'sewer connection'],
  hasPullThrough: ['pull-through', 'pull through', 'pull-thru', 'pull thru'],
  hasBackIn: ['back-in', 'back in site'],
  hasDumpStation: ['dump station', 'dumping station', 'rv dump', 'sanitary dump', 'sanitary station'],
  hasWifi: ['wifi', 'wi-fi', 'wireless internet', 'internet access', 'free wifi'],
  hasCableTV: ['cable tv', 'cable television', 'satellite tv'],
  hasShowers: ['shower', 'hot shower', 'shower house', 'bathhouse', 'shower facilities', 'bath house'],
  hasRestrooms: ['restroom', 'bathroom', 'flush toilet', 'modern restroom', 'toilet facilities'],
  hasLaundry: ['laundry', 'washer', 'dryer', 'laundromat', 'coin laundry', 'laundry room'],
  hasPool: ['pool', 'swimming pool', 'heated pool', 'outdoor pool'],
  hasStore: ['camp store', 'general store', 'convenience store', 'gift shop', 'camp shop', 'country store'],
  hasPropane: ['propane', 'lp gas', 'propane refill'],
  isPetFriendly: ['pet friendly', 'pets allowed', 'pets welcome', 'dog friendly', 'dogs allowed', 'pet-friendly', 'leashed pets'],
  isBigRigFriendly: ['big rig', 'big-rig', 'large rv', '45 foot', '40 foot', '45 ft', '40 ft', 'class a motorhome'],
  isWaterfront: ['waterfront', 'lakefront', 'oceanfront', 'beachfront', 'riverfront', 'on the lake', 'on the river', 'lake view', 'ocean view', 'beach access', 'creek side', 'creekside'],
};

const AMENITY_KEYWORDS: { [key: string]: string[] } = {
  'flush_toilets': ['flush toilet', 'restroom', 'bathroom', 'modern restroom'],
  'vault_toilets': ['vault toilet', 'pit toilet', 'outhouse', 'composting toilet'],
  'showers': ['shower', 'hot shower', 'bathhouse'],
  'dump_station': ['dump station', 'rv dump', 'sanitary dump'],
  'laundry': ['laundry', 'washer', 'dryer'],
  'wifi': ['wifi', 'wi-fi', 'internet'],
  'pool': ['pool', 'swimming pool'],
  'hot_tub': ['hot tub', 'spa', 'jacuzzi'],
  'playground': ['playground', 'play area'],
  'dog_park': ['dog park', 'off-leash'],
  'camp_store': ['camp store', 'general store', 'gift shop'],
  'propane': ['propane', 'lp gas'],
  'firewood': ['firewood', 'fire wood'],
  'picnic_tables': ['picnic table', 'picnic area'],
  'fire_rings': ['fire ring', 'fire pit', 'campfire', 'fire circle'],
  'grills': ['grill', 'bbq', 'barbecue'],
  'fishing': ['fishing', 'fish'],
  'hiking': ['hiking', 'hiking trail', 'nature trail', 'walking trail'],
  'biking': ['biking', 'bike trail', 'bicycle', 'cycling'],
  'boating': ['boating', 'boat ramp', 'boat launch', 'marina'],
  'kayaking': ['kayak', 'canoe', 'paddleboard'],
  'swimming': ['swimming', 'swim', 'beach'],
  'golf': ['golf', 'mini golf', 'putt putt'],
  'beach_access': ['beach access', 'sandy beach'],
  'full_hookups': ['full hookup', 'full hook-up', 'fhu'],
  'water_electric': ['water/electric', 'w/e'],
  '30_amp': ['30 amp', '30-amp'],
  '50_amp': ['50 amp', '50-amp'],
  'pull_through': ['pull-through', 'pull through'],
  'big_rig_friendly': ['big rig'],
  'pet_friendly': ['pet friendly', 'pets allowed', 'dogs allowed'],
  'handicap_accessible': ['handicap', 'accessible', 'ada', 'wheelchair'],
  'tent_sites': ['tent site', 'tent camping'],
  'cabin_rentals': ['cabin', 'cottage', 'rental unit'],
  'rv_sites': ['rv site', 'rv space', 'rv spot'],
};

function extractMaxRvLength(text: string): number | null {
  const patterns = [
    /(\d{2,3})\s*(?:foot|ft|feet)\s*(?:rv|rig|motorhome|max)/i,
    /max(?:imum)?\s*(?:rv|rig)?\s*(?:length|size)?\s*:?\s*(\d{2,3})/i,
    /accommodate\s*(?:rv|rig)s?\s*up\s*to\s*(\d{2,3})/i,
    /up\s*to\s*(\d{2,3})\s*(?:foot|ft|feet)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { const n = parseInt(m[1]); if (n >= 20 && n <= 100) return n; }
  }
  return null;
}

function extractMaxAmp(text: string): number | null {
  if (text.includes('50 amp') || text.includes('50-amp')) return 50;
  if (text.includes('30 amp') || text.includes('30-amp')) return 30;
  if (text.includes('20 amp') || text.includes('20-amp')) return 20;
  return null;
}

function extractPrice(text: string): number | null {
  const patterns = [
    /\$(\d{2,3})(?:\.\d{2})?\s*(?:\/|\s*per)\s*(?:night|nightly)/i,
    /(?:rate|price|from)\s*:?\s*\$(\d{2,3})/i,
    /starting\s*(?:at|from)\s*\$(\d{2,3})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { const n = parseInt(m[1]); if (n >= 15 && n <= 500) return n; }
  }
  return null;
}

function analyzeText(text: string): {
  fields: { [key: string]: boolean },
  amenities: string[],
  maxRvLength: number | null,
  maxAmpService: number | null,
  pricePerNight: number | null,
} {
  const lowerText = text.toLowerCase();
  const fields: { [key: string]: boolean } = {};
  const amenities: string[] = [];

  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    for (const kw of keywords) {
      if (lowerText.includes(kw)) { fields[field] = true; break; }
    }
  }

  for (const [amenity, keywords] of Object.entries(AMENITY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lowerText.includes(kw) && !amenities.includes(amenity)) { amenities.push(amenity); break; }
    }
  }

  return {
    fields,
    amenities,
    maxRvLength: extractMaxRvLength(lowerText),
    maxAmpService: extractMaxAmp(lowerText),
    pricePerNight: extractPrice(lowerText),
  };
}

// ---- GOOGLE PLACES API ----

async function findPlaceId(name: string, state: string): Promise<string | null> {
  const stateFull = STATE_NAMES[state] || state;
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();

  // Try multiple search queries
  const queries = [
    `${cleanName} ${stateFull}`,
    `${cleanName} campground ${stateFull}`,
    `${cleanName} ${state}`,
    cleanName.replace(/campground|camping|rv park|camp/gi, '').trim() + ` campground ${stateFull}`,
    cleanName.replace(/ rd$| nf$| ranger district$/gi, '').trim() + ` ${stateFull}`,
  ];

  for (const query of queries) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
    try {
      const res = await fetch(url);
      const data = await res.json() as any;
      if (data.status === 'OK' && data.results && data.results[0]) {
        return data.results[0].place_id;
      }
    } catch {}
    await delay(100);
  }

  return null;
}

async function getPlaceDetails(placeId: string): Promise<{
  website: string | null,
  reviews: string,
  editorial: string,
  photoRef: string | null,
} | null> {
  const fields = 'website,reviews,editorial_summary,photos';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json() as any;
    if (data.status === 'OK' && data.result) {
      const r = data.result;
      return {
        website: r.website || null,
        reviews: (r.reviews || []).map((rv: any) => rv.text).join(' '),
        editorial: r.editorial_summary?.overview || '',
        photoRef: r.photos?.[0]?.photo_reference || null,
      };
    }
  } catch {}
  return null;
}

// ---- WEBSITE SCRAPER ----

async function fetchWebsite(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ---- INFER FROM NAME ----

function inferFromName(name: string): { fields: { [key: string]: boolean }, amenities: string[] } {
  const lower = name.toLowerCase();
  const fields: { [key: string]: boolean } = {};
  const amenities: string[] = [];

  if (lower.includes('koa')) {
    fields.hasFullHookups = true; fields.hasWifi = true; fields.hasPool = true;
    fields.hasStore = true; fields.hasShowers = true; fields.hasRestrooms = true;
    fields.hasLaundry = true; fields.isPetFriendly = true;
    amenities.push('full_hookups', 'wifi', 'pool', 'camp_store', 'showers', 'laundry', 'playground');
  }

  if (lower.includes('rv resort') || lower.includes('rv park')) {
    fields.hasFullHookups = true; fields.hasWifi = true; fields.hasRestrooms = true;
    amenities.push('full_hookups', 'wifi', 'rv_sites');
  }

  if (lower.includes('state park') || lower.includes('state recreation')) {
    fields.hasRestrooms = true; fields.hasShowers = true;
    amenities.push('flush_toilets', 'showers', 'picnic_tables', 'fire_rings', 'hiking');
  }

  if (lower.includes('national forest') || lower.includes('nf ') || lower.includes('usfs')) {
    amenities.push('vault_toilets', 'fire_rings', 'picnic_tables', 'tent_sites', 'hiking');
  }

  if (lower.includes('lake') || lower.includes('river') || lower.includes('beach') || lower.includes('creek') || lower.includes('bay')) {
    fields.isWaterfront = true;
    amenities.push('fishing');
  }

  return { fields, amenities };
}

// ---- MAIN ----

async function main() {
  console.log('🏕️  Deep Google Scrape - All Missing Campgrounds');
  console.log('=================================================\n');

  const campgrounds = await prisma.campground.findMany({
    where: {
      OR: [
        { hasFullHookups: null, hasShowers: null, hasRestrooms: null },
        { amenities: { isEmpty: true } }
      ]
    },
    select: {
      id: true, name: true, state: true, amenities: true,
      imageUrl: true, description: true, websiteUrl: true,
      maxRvLength: true, maxAmpService: true, pricePerNight: true,
    }
  });

  console.log(`Found ${campgrounds.length} campgrounds needing data\n`);

  let fromGoogle = 0;
  let fromWebsite = 0;
  let fromInference = 0;
  let noData = 0;

  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];
    if (!camp.state) { noData++; continue; }

    let allText = '';
    let newWebsite: string | null = null;
    let newImage: string | null = null;

    // --- Step 1: Google Places ---
    const placeId = await findPlaceId(camp.name, camp.state);
    await delay(100);

    if (placeId) {
      const details = await getPlaceDetails(placeId);
      await delay(100);

      if (details) {
        allText += ' ' + details.reviews + ' ' + details.editorial;

        if (!camp.websiteUrl && details.website) {
          newWebsite = details.website;
        }

        if (!camp.imageUrl && details.photoRef) {
          newImage = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${details.photoRef}&key=${GOOGLE_API_KEY}`;
        }
      }
    }

    // --- Step 2: Scrape website (existing or newly found) ---
    const websiteToScrape = camp.websiteUrl || newWebsite;
    if (websiteToScrape) {
      const html = await fetchWebsite(websiteToScrape);
      if (html) {
        allText += ' ' + html.toLowerCase();
        fromWebsite++;
      }
      await delay(200);
    }

    // --- Step 3: Analyze all collected text ---
    const analysis = analyzeText(allText);

    // --- Step 4: If still nothing, infer from name ---
    if (Object.keys(analysis.fields).length === 0 && analysis.amenities.length === 0) {
      const inferred = inferFromName(camp.name);
      Object.assign(analysis.fields, inferred.fields);
      analysis.amenities.push(...inferred.amenities);
      if (Object.keys(inferred.fields).length > 0) fromInference++;
    } else {
      fromGoogle++;
    }

    // --- Step 5: Update database ---
    const existingAmenities = camp.amenities || [];
    const mergedAmenities = [...new Set([...existingAmenities, ...analysis.amenities])];

    const totalFound = Object.keys(analysis.fields).length + analysis.amenities.length;

    if (totalFound > 0 || newWebsite || newImage) {
      const updateData: any = {
        amenities: mergedAmenities,
        ...analysis.fields,
      };

      if (newWebsite) updateData.websiteUrl = newWebsite;
      if (newImage) updateData.imageUrl = newImage;
      if (analysis.maxRvLength && !camp.maxRvLength) updateData.maxRvLength = analysis.maxRvLength;
      if (analysis.maxAmpService && !camp.maxAmpService) updateData.maxAmpService = analysis.maxAmpService;
      if (analysis.pricePerNight && !camp.pricePerNight) updateData.pricePerNight = analysis.pricePerNight;

      await prisma.campground.update({
        where: { id: camp.id },
        data: updateData
      });

      const extras = [];
      if (newWebsite) extras.push('+website');
      if (newImage) extras.push('+image');

      console.log(`✅ ${camp.name}: ${Object.keys(analysis.fields).length} fields, ${analysis.amenities.length} amenities ${extras.join(' ')}`);
    } else {
      console.log(`❌ ${camp.name}, ${camp.state}: No data found anywhere`);
      noData++;
    }

    if ((i + 1) % 25 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${campgrounds.length}`);
      console.log(`   Google: ${fromGoogle} | Website: ${fromWebsite} | Inferred: ${fromInference} | None: ${noData}\n`);
    }
  }

  console.log('\n=================================================');
  console.log('🏁 COMPLETE');
  console.log('=================================================');
  console.log(`From Google Places + Reviews: ${fromGoogle}`);
  console.log(`From Website scrape: ${fromWebsite}`);
  console.log(`From name inference: ${fromInference}`);
  console.log(`No data found: ${noData}`);

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
  console.log(`\nCampgrounds with data: ${withData}/${total}`);
  console.log(`Still unverified: ${total - withData}`);
  console.log('\nAll data obtained from: Google Places API, campground websites, and name-based inference');
}

main().catch(console.error).finally(() => process.exit());
