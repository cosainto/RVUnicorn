// ============================================
// DISCOVER ALL USA CAMPGROUNDS - STATE BY STATE
// Searches all 50 states with multiple queries
// Skips existing, adds new with full details
// Estimated cost: ~$20-30 in Google Places API
// Run: DATABASE_URL="..." npx ts-node scripts/discover-usa-campgrounds.ts
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---- ALL 50 STATES ----
const STATES: { abbr: string; name: string }[] = [
  { abbr: 'AL', name: 'Alabama' }, { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' }, { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' }, { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' }, { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' }, { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' }, { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' }, { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' }, { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' }, { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' }, { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' }, { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' }, { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' }, { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' }, { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' }, { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' }, { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' }, { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' }, { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' }, { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' }, { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' }, { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' }, { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' }, { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' }, { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' }, { abbr: 'WY', name: 'Wyoming' },
];

const STATE_ABBREVS: { [key: string]: string } = {};
const STATE_NAMES: { [key: string]: string } = {};
for (const s of STATES) {
  STATE_ABBREVS[s.name] = s.abbr;
  STATE_NAMES[s.abbr] = s.name;
}

// ---- SEARCH QUERIES PER STATE ----
function getSearchQueries(stateName: string): string[] {
  return [
    `campgrounds in ${stateName}`,
    `RV parks in ${stateName}`,
    `RV resorts in ${stateName}`,
    `camping ${stateName}`,
    `state park campgrounds ${stateName}`,
    `national forest campgrounds ${stateName}`,
    `KOA ${stateName}`,
    `public campgrounds ${stateName}`,
    `tent camping ${stateName}`,
    `boondocking ${stateName}`,
    `county park campground ${stateName}`,
    `lakeside campground ${stateName}`,
  ];
}

// ---- EXCLUSION PATTERNS ----
const EXCLUDE_PATTERNS = [
  /mobile home/i, /manufactured home/i, /trailer park(?!.*camp)/i,
  /apartment/i, /condo/i, /senior living/i, /assisted living/i,
  /storage/i, /self storage/i, /mini storage/i,
  /car wash/i, /gas station/i, /truck stop/i,
  /real estate/i, /property management/i,
  /hotel(?!.*camp)/i, /motel(?!.*camp)/i,
  /cemetery/i, /funeral/i, /church/i,
  /office\s*(space|building|park)/i,
  /strip mall/i, /shopping/i,
  /permanently closed/i,
];

function isLikelyCampground(name: string, types?: string[]): boolean {
  const lower = name.toLowerCase();
  const positives = [
    'campground', 'camping', 'camp ', 'campsite', 'rv park', 'rv resort',
    'trailer park', 'tent', 'glamping', 'koa', 'jellystone', 'yogi bear',
    'thousand trails', 'encore', 'sun outdoors',
    'state park', 'national park', 'national forest', 'recreation area',
    'county park', 'regional park', 'wilderness', 'primitive camp',
    'fish camp', 'horse camp', 'group camp', 'boat camp',
    'cabins', 'lodge', 'retreat',
  ];

  const hasPositive = positives.some(p => lower.includes(p)) ||
    (types || []).some(t => ['campground', 'rv_park', 'park'].includes(t));

  if (!hasPositive) return false;

  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(name)) return false;
  }

  return true;
}

// ---- AMENITY DETECTION ----
const FIELD_KEYWORDS: { [key: string]: string[] } = {
  hasFullHookups: ['full hookup', 'full hook-up', 'fhu', 'water sewer electric', 'full-hookup'],
  hasWaterHookup: ['water hookup', 'water hook-up', 'water connection', 'water/electric', 'potable water'],
  hasElectricHookup: ['electric hookup', 'electric hook-up', '30 amp', '50 amp', '30/50', 'electrical service'],
  hasSewerHookup: ['sewer hookup', 'sewer hook-up', 'sewer connection'],
  hasPullThrough: ['pull-through', 'pull through', 'pull-thru', 'pull thru'],
  hasBackIn: ['back-in', 'back in site'],
  hasDumpStation: ['dump station', 'dumping station', 'rv dump', 'sanitary dump'],
  hasWifi: ['wifi', 'wi-fi', 'wireless internet', 'internet access'],
  hasCableTV: ['cable tv', 'cable television', 'satellite tv'],
  hasShowers: ['shower', 'hot shower', 'shower house', 'bathhouse'],
  hasRestrooms: ['restroom', 'bathroom', 'flush toilet', 'modern restroom', 'toilet', 'vault toilet'],
  hasLaundry: ['laundry', 'washer', 'dryer', 'laundromat'],
  hasPool: ['pool', 'swimming pool', 'heated pool'],
  hasStore: ['camp store', 'general store', 'convenience store', 'gift shop'],
  hasPropane: ['propane', 'lp gas'],
  isPetFriendly: ['pet friendly', 'pets allowed', 'pets welcome', 'dog friendly', 'pet-friendly'],
  isBigRigFriendly: ['big rig', 'big-rig', 'large rv', '45 foot', '40 foot'],
  isWaterfront: ['waterfront', 'lakefront', 'oceanfront', 'beachfront', 'riverfront', 'on the lake', 'lakeside', 'riverside'],
};

const AMENITY_KEYWORDS: { [key: string]: string[] } = {
  'flush_toilets': ['flush toilet', 'restroom', 'bathroom'],
  'vault_toilets': ['vault toilet', 'pit toilet', 'outhouse'],
  'showers': ['shower', 'hot shower', 'bathhouse'],
  'dump_station': ['dump station', 'rv dump'],
  'laundry': ['laundry', 'washer'],
  'wifi': ['wifi', 'wi-fi'],
  'pool': ['pool', 'swimming pool'],
  'playground': ['playground', 'play area'],
  'camp_store': ['camp store', 'general store'],
  'propane': ['propane'],
  'firewood': ['firewood'],
  'picnic_tables': ['picnic table', 'picnic area'],
  'fire_rings': ['fire ring', 'fire pit', 'campfire'],
  'grills': ['grill', 'bbq', 'barbecue'],
  'fishing': ['fishing', 'fish', 'angling'],
  'hiking': ['hiking', 'hiking trail', 'nature trail', 'trail'],
  'biking': ['biking', 'bike trail', 'bicycle'],
  'boating': ['boating', 'boat ramp', 'boat launch', 'marina'],
  'kayaking': ['kayak', 'canoe', 'paddleboard'],
  'swimming': ['swimming', 'swim', 'beach'],
  'horseback_riding': ['horse', 'horseback', 'equestrian'],
  'full_hookups': ['full hookup', 'fhu'],
  'pull_through': ['pull-through', 'pull through'],
  'tent_sites': ['tent site', 'tent camping'],
  'cabin_rentals': ['cabin', 'cottage', 'yurt', 'glamping'],
  'rv_sites': ['rv site', 'rv space', 'rv spot'],
  'pet_friendly': ['pet friendly', 'pets allowed', 'dogs allowed'],
  'handicap_accessible': ['handicap', 'accessible', 'ada', 'wheelchair'],
};

function analyzeText(text: string): { fields: { [key: string]: boolean }, amenities: string[] } {
  const lower = text.toLowerCase();
  const fields: { [key: string]: boolean } = {};
  const amenities: string[] = [];

  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) { fields[field] = true; break; }
    }
  }
  for (const [amenity, keywords] of Object.entries(AMENITY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw) && !amenities.includes(amenity)) { amenities.push(amenity); break; }
    }
  }
  return { fields, amenities };
}

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
  if (lower.includes('national forest') || lower.includes('nf ')) {
    amenities.push('vault_toilets', 'fire_rings', 'picnic_tables', 'tent_sites', 'hiking');
    fields.hasRestrooms = true;
  }
  if (/lake|river|beach|creek|bay|reservoir|falls|spring/i.test(lower)) {
    fields.isWaterfront = true;
    amenities.push('fishing');
  }
  if (amenities.length === 0) {
    amenities.push('tent_sites', 'fire_rings', 'picnic_tables');
    fields.hasRestrooms = true;
  }
  return { fields, amenities };
}

// ---- WEBSITE SCRAPING ----
async function fetchUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  }
  return null;
}

// ---- GOOGLE PLACES ----
async function searchGooglePlaces(query: string): Promise<any[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  const allResults: any[] = [];
  let nextPageToken: string | null = null;

  for (let page = 0; page < 3; page++) {
    const fetchUrl = nextPageToken
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${GOOGLE_API_KEY}`
      : url;

    try {
      const res = await fetch(fetchUrl);
      const data = await res.json() as any;
      if (data.status === 'OK' && data.results) {
        allResults.push(...data.results);
        nextPageToken = data.next_page_token || null;
        if (!nextPageToken) break;
        await delay(2000); // Google requires wait for next_page_token
      } else {
        break;
      }
    } catch { break; }
  }

  return allResults;
}

async function getPlaceDetails(placeId: string): Promise<any> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,website,formatted_phone_number,rating,user_ratings_total,reviews,editorial_summary,photos,types,address_components&key=${GOOGLE_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json() as any;
    if (data.status === 'OK' && data.result) return data.result;
  } catch {}
  return null;
}

function extractStateFromAddress(address: string, components?: any[]): string | null {
  if (components) {
    for (const comp of components) {
      if (comp.types?.includes('administrative_area_level_1')) {
        const abbr = comp.short_name;
        if (STATE_NAMES[abbr]) return abbr;
        if (STATE_ABBREVS[comp.long_name]) return STATE_ABBREVS[comp.long_name];
      }
    }
  }
  for (const [name, abbr] of Object.entries(STATE_ABBREVS)) {
    if (address.includes(`, ${abbr} `) || address.includes(`, ${abbr},`) || address.endsWith(`, ${abbr}`)) {
      return abbr;
    }
  }
  return null;
}

function extractCityFromAddress(address: string): string {
  const parts = address.split(',').map(s => s.trim());
  if (parts.length >= 3) {
    return parts.slice(1, -1).join(', ');
  }
  return address;
}

// ---- DEDUPLICATION ----
function normalizeNameForMatch(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(campground|camping|camp|rv park|rv resort|park|recreation area|state park)\b/g, '')
    .trim();
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---- MAIN ----
async function main() {
  console.log('==============================================');
  console.log('  DISCOVER ALL USA CAMPGROUNDS');
  console.log('  State-by-State Search (50 States)');
  console.log('  Estimated cost: ~$20-30');
  console.log('==============================================\n');

  // Load all existing campgrounds for dedup
  console.log('Loading existing campgrounds...');
  const existing = await prisma.campground.findMany({
    select: { id: true, name: true, state: true, latitude: true, longitude: true, googlePlaceId: true },
  });

  const existingPlaceIds = new Set(existing.filter(c => c.googlePlaceId).map(c => c.googlePlaceId!));
  const existingByState: { [state: string]: typeof existing } = {};
  for (const camp of existing) {
    if (camp.state) {
      if (!existingByState[camp.state]) existingByState[camp.state] = [];
      existingByState[camp.state].push(camp);
    }
  }

  console.log(`Loaded ${existing.length} existing campgrounds (${existingPlaceIds.size} with Place IDs)\n`);

  function isDuplicate(name: string, state: string, lat: number, lng: number, placeId?: string): boolean {
    if (placeId && existingPlaceIds.has(placeId)) return true;

    const normalized = normalizeNameForMatch(name);
    const stateEntries = existingByState[state] || [];

    for (const entry of stateEntries) {
      const existNorm = normalizeNameForMatch(entry.name);

      // Exact normalized name match
      if (normalized === existNorm) return true;

      if (entry.latitude && entry.longitude) {
        const dist = haversineDistance(lat, lng, entry.latitude, entry.longitude);

        // Within 1km = same place regardless of name
        if (dist < 1) return true;

        // Within 5km and similar name
        if (dist < 5 && (normalized.includes(existNorm) || existNorm.includes(normalized))) return true;

        // Within 50km and name containment
        if (dist < 50 && normalized.length > 3 && existNorm.length > 3) {
          if (normalized === existNorm) return true;
        }
      }
    }

    return false;
  }

  const seenPlaceIds = new Set<string>();
  let totalNew = 0;
  let totalSkipped = 0;
  let totalExcluded = 0;
  let totalApiCalls = 0;
  const stateResults: { state: string; existing: number; newFound: number }[] = [];

  for (let si = 0; si < STATES.length; si++) {
    const state = STATES[si];
    const queries = getSearchQueries(state.name);
    const existingCount = (existingByState[state.abbr] || []).length;
    let stateNew = 0;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🏕️  ${state.name} (${state.abbr}) - ${existingCount} existing campgrounds`);
    console.log(`${'='.repeat(50)}`);

    for (const query of queries) {
      const results = await searchGooglePlaces(query);
      totalApiCalls++;
      await delay(200);

      for (const result of results) {
        const placeId = result.place_id;

        // Skip if already seen this run
        if (seenPlaceIds.has(placeId)) continue;
        seenPlaceIds.add(placeId);

        const name = result.name;
        const lat = result.geometry?.location?.lat;
        const lng = result.geometry?.location?.lng;
        const address = result.formatted_address || '';

        // Must be in USA
        if (!address.includes('USA') && !address.includes('United States')) continue;

        // Must look like a campground
        if (!isLikelyCampground(name, result.types)) {
          totalExcluded++;
          continue;
        }

        // Extract state from address
        const detectedState = extractStateFromAddress(address) || state.abbr;

        // Check for duplicates
        if (isDuplicate(name, detectedState, lat, lng, placeId)) {
          totalSkipped++;
          continue;
        }

        // ---- NEW CAMPGROUND - Get full details ----
        const details = await getPlaceDetails(placeId);
        totalApiCalls++;
        await delay(100);

        if (!details) continue;

        const website = details.website || null;
        const phone = details.formatted_phone_number || null;
        const rating = details.rating || null;
        const reviewCount = details.user_ratings_total || null;
        const photoRef = details.photos?.[0]?.photo_reference || null;
        const imageUrl = photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`
          : null;

        // Gather text for amenity analysis
        let allText = name + ' ' + address + ' ';
        allText += (details.editorial_summary?.overview || '') + ' ';
        allText += (details.reviews || []).map((r: any) => r.text).join(' ');

        // Scrape website
        let description: string | null = null;
        if (website) {
          const html = await fetchUrl(website);
          if (html) {
            allText += ' ' + html;
            description = extractMeta(html, 'og:description') || extractMeta(html, 'description');
            if (description && description.length > 500) description = description.slice(0, 500);
          }
          await delay(100);
        }

        if (!description && details.editorial_summary?.overview) {
          description = details.editorial_summary.overview;
        }

        // Analyze amenities
        const analysis = analyzeText(allText);

        if (Object.keys(analysis.fields).length === 0 && analysis.amenities.length === 0) {
          const inferred = inferFromName(name);
          Object.assign(analysis.fields, inferred.fields);
          analysis.amenities.push(...inferred.amenities);
        }

        const location = extractCityFromAddress(details.formatted_address || address);
        const finalState = extractStateFromAddress(details.formatted_address || address, details.address_components) || detectedState;

        // Create campground
        try {
          const created = await prisma.campground.create({
            data: {
              name,
              state: finalState,
              location: location || address,
              latitude: lat,
              longitude: lng,
              websiteUrl: website,
              phone,
              description,
              imageUrl,
              googlePlaceId: placeId,
              googleRating: rating,
              googleReviewCount: reviewCount,
              amenities: [...new Set(analysis.amenities)],
              ...analysis.fields,
            },
          });

          totalNew++;
          stateNew++;

          // Add to dedup index
          existingPlaceIds.add(placeId);
          if (!existingByState[finalState]) existingByState[finalState] = [];
          existingByState[finalState].push({
            id: created.id,
            name,
            state: finalState,
            latitude: lat,
            longitude: lng,
            googlePlaceId: placeId,
          });

          const amenityCount = Object.keys(analysis.fields).length + analysis.amenities.length;
          console.log(`  ✅ ${name} | ${finalState} | ${amenityCount} amenities${website ? ' +website' : ''}${imageUrl ? ' +photo' : ''}`);
        } catch (err: any) {
          if (err.code === 'P2002') {
            totalSkipped++;
          } else {
            console.error(`  ❌ Error: ${name} - ${err.message}`);
          }
        }
      }
    }

    stateResults.push({ state: state.abbr, existing: existingCount, newFound: stateNew });
    console.log(`\n  📊 ${state.name}: ${existingCount} existing + ${stateNew} new = ${existingCount + stateNew} total`);
    console.log(`  Running total — New: ${totalNew} | Skipped: ${totalSkipped} | API calls: ${totalApiCalls}`);
  }

  // ---- FINAL STATS ----
  const finalCount = await prisma.campground.count();
  const withAmenities = await prisma.campground.count({
    where: { OR: [{ hasShowers: { not: null } }, { amenities: { isEmpty: false } }] },
  });
  const withWebsites = await prisma.campground.count({ where: { websiteUrl: { not: null } } });
  const withImages = await prisma.campground.count({ where: { imageUrl: { not: null } } });

  console.log('\n\n==============================================');
  console.log('  COMPLETE');
  console.log('==============================================');
  console.log(`New campgrounds added: ${totalNew}`);
  console.log(`Skipped (duplicates): ${totalSkipped}`);
  console.log(`Excluded (not campgrounds): ${totalExcluded}`);
  console.log(`Unique places evaluated: ${seenPlaceIds.size}`);
  console.log(`Total API calls: ${totalApiCalls}`);
  console.log('');
  console.log(`Total campgrounds: ${finalCount}`);
  console.log(`With amenity data: ${withAmenities} (${((withAmenities/finalCount)*100).toFixed(1)}%)`);
  console.log(`With websites: ${withWebsites} (${((withWebsites/finalCount)*100).toFixed(1)}%)`);
  console.log(`With images: ${withImages} (${((withImages/finalCount)*100).toFixed(1)}%)`);

  // State breakdown
  console.log('\n--- State Breakdown ---');
  const sorted = stateResults.sort((a, b) => b.newFound - a.newFound);
  for (const s of sorted) {
    if (s.newFound > 0) {
      console.log(`  ${s.state}: ${s.existing} existing + ${s.newFound} new = ${s.existing + s.newFound}`);
    }
  }
  const noNew = sorted.filter(s => s.newFound === 0);
  if (noNew.length > 0) {
    console.log(`\n  No new campgrounds in: ${noNew.map(s => s.state).join(', ')}`);
  }
}

main().catch(console.error).finally(() => process.exit());
