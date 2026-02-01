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
  hasFullHookups: ['full hookup', 'full hook-up', 'fhu', 'water sewer electric', 'w/s/e', 'full-hookup', 'full utility'],
  hasWaterHookup: ['water hookup', 'water hook-up', 'water connection', 'water/electric', 'potable water', 'drinking water', 'water available', 'water spigot'],
  hasElectricHookup: ['electric hookup', 'electric hook-up', '30 amp', '50 amp', '30/50', '20/30/50', 'electrical service', 'power hookup', 'electric site'],
  hasSewerHookup: ['sewer hookup', 'sewer hook-up', 'sewer connection'],
  hasPullThrough: ['pull-through', 'pull through', 'pull-thru', 'pull thru'],
  hasBackIn: ['back-in', 'back in site'],
  hasDumpStation: ['dump station', 'dumping station', 'rv dump', 'sanitary dump', 'sanitary station'],
  hasWifi: ['wifi', 'wi-fi', 'wireless internet', 'internet access', 'free wifi'],
  hasCableTV: ['cable tv', 'cable television', 'satellite tv'],
  hasShowers: ['shower', 'hot shower', 'shower house', 'bathhouse', 'bath house'],
  hasRestrooms: ['restroom', 'bathroom', 'flush toilet', 'modern restroom', 'toilet', 'vault toilet', 'pit toilet', 'outhouse'],
  hasLaundry: ['laundry', 'washer', 'dryer', 'laundromat', 'coin laundry'],
  hasPool: ['pool', 'swimming pool', 'heated pool'],
  hasStore: ['camp store', 'general store', 'convenience store', 'gift shop'],
  hasPropane: ['propane', 'lp gas'],
  isPetFriendly: ['pet friendly', 'pets allowed', 'pets welcome', 'dog friendly', 'dogs allowed', 'pet-friendly', 'leashed pets', 'pets on leash'],
  isBigRigFriendly: ['big rig', 'big-rig', 'large rv', '45 foot', '40 foot'],
  isWaterfront: ['waterfront', 'lakefront', 'oceanfront', 'beachfront', 'riverfront', 'on the lake', 'on the river', 'lakeside', 'riverside', 'creekside'],
};

const AMENITY_KEYWORDS: { [key: string]: string[] } = {
  'flush_toilets': ['flush toilet', 'restroom', 'bathroom'],
  'vault_toilets': ['vault toilet', 'pit toilet', 'outhouse', 'composting toilet'],
  'showers': ['shower', 'hot shower', 'bathhouse'],
  'dump_station': ['dump station', 'rv dump'],
  'laundry': ['laundry', 'washer'],
  'wifi': ['wifi', 'wi-fi'],
  'pool': ['pool', 'swimming pool'],
  'playground': ['playground', 'play area'],
  'camp_store': ['camp store', 'general store'],
  'propane': ['propane'],
  'firewood': ['firewood'],
  'picnic_tables': ['picnic table', 'picnic area', 'picnic'],
  'fire_rings': ['fire ring', 'fire pit', 'campfire', 'fire grate'],
  'grills': ['grill', 'bbq', 'barbecue'],
  'fishing': ['fishing', 'fish', 'angling'],
  'hiking': ['hiking', 'hiking trail', 'nature trail', 'trail'],
  'biking': ['biking', 'bike trail', 'bicycle', 'mountain bike'],
  'boating': ['boating', 'boat ramp', 'boat launch', 'marina'],
  'kayaking': ['kayak', 'canoe', 'paddleboard', 'paddle'],
  'swimming': ['swimming', 'swim', 'beach', 'wading'],
  'horseback_riding': ['horse', 'horseback', 'equestrian'],
  'full_hookups': ['full hookup', 'fhu'],
  'pull_through': ['pull-through', 'pull through'],
  'tent_sites': ['tent site', 'tent camping', 'tent only', 'tent pad'],
  'cabin_rentals': ['cabin', 'cottage', 'yurt', 'glamping'],
  'rv_sites': ['rv site', 'rv space', 'rv spot', 'rv camping'],
  'pet_friendly': ['pet friendly', 'pets allowed', 'dogs allowed'],
  'handicap_accessible': ['handicap', 'accessible', 'ada', 'wheelchair'],
  'water_available': ['potable water', 'drinking water', 'water spigot', 'water faucet'],
};

function analyzeText(text: string): {
  fields: { [key: string]: boolean },
  amenities: string[],
} {
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

// ---- FETCHERS ----

async function fetchUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  return null;
}

// ---- STRATEGY 1: Google Places (multiple queries) ----

async function googlePlaces(name: string, state: string, location: string): Promise<{
  placeId: string | null,
  website: string | null,
  photoRef: string | null,
  reviews: string,
  editorial: string,
}> {
  const stateFull = STATE_NAMES[state] || state;
  const cleanName = name.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

  const queries = [
    `${cleanName} ${stateFull}`,
    `${cleanName} campground ${stateFull}`,
    `${cleanName} camping ${state}`,
    `${cleanName} ${location}`,
    cleanName.split(' ').slice(0, 3).join(' ') + ` campground ${stateFull}`,
    cleanName.replace(/campground|camping|camp|rv park|recreation area|picnic area/gi, '').trim() + ` ${stateFull} campground`,
  ];

  for (const query of queries) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
    try {
      const res = await fetch(url);
      const data = await res.json() as any;
      if (data.status === 'OK' && data.results?.[0]) {
        const pid = data.results[0].place_id;
        const photoRef = data.results[0].photos?.[0]?.photo_reference || null;

        // Get details
        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=website,reviews,editorial_summary&key=${GOOGLE_API_KEY}`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json() as any;
        await delay(100);

        if (detailData.status === 'OK' && detailData.result) {
          const r = detailData.result;
          return {
            placeId: pid,
            website: r.website || null,
            photoRef,
            reviews: (r.reviews || []).map((rv: any) => rv.text).join(' '),
            editorial: r.editorial_summary?.overview || '',
          };
        }

        return { placeId: pid, website: null, photoRef, reviews: '', editorial: '' };
      }
    } catch {}
    await delay(100);
  }

  return { placeId: null, website: null, photoRef: null, reviews: '', editorial: '' };
}

// ---- STRATEGY 2: Recreation.gov ----

async function searchRecreationGov(name: string): Promise<string | null> {
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();
  const url = `https://ridb.recreation.gov/api/v1/facilities?query=${encodeURIComponent(cleanName)}&limit=5&apikey=10b14c83-b484-4702-9eb8-e23e81b1e30f`;

  try {
    const res = await fetch(url);
    const data = await res.json() as any;
    if (data.RECDATA && data.RECDATA.length > 0) {
      const facility = data.RECDATA[0];
      const facilityId = facility.FacilityID;
      return `https://www.recreation.gov/camping/campgrounds/${facilityId}`;
    }
  } catch {}

  return null;
}

// ---- STRATEGY 3: Aggregator sites ----

function slugify(name: string): string {
  return name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function tryAggregatorSites(name: string, state: string): Promise<{ url: string, html: string } | null> {
  const slug = slugify(name);
  const stateFull = (STATE_NAMES[state] || state).toLowerCase().replace(/\s+/g, '-');
  const stateFullSpaces = (STATE_NAMES[state] || state).toLowerCase();

  const urls = [
    // Recreation.gov direct
    `https://www.recreation.gov/camping/campgrounds/${slug}`,
    // The Dyrt
    `https://thedyrt.com/camping/${stateFullSpaces.replace(/\s/g, '-')}/${slug}`,
    `https://thedyrt.com/camping/${stateFullSpaces.replace(/\s/g, '-')}/${slug.replace(/-campground$/, '')}`,
    // Camplinq
    `https://camplinq.com/camps/${slug}/`,
    // FreeCampsites
    `https://freecampsites.net/#!${slug}`,
  ];

  for (const url of urls) {
    const html = await fetchUrl(url);
    if (html && html.length > 3000 && !html.includes('Page not found') && !html.includes('404') && !html.includes('Not Found')) {
      return { url, html };
    }
    await delay(200);
  }

  return null;
}

// ---- STRATEGY 4: Recreation.gov API ----

async function recGovDetails(name: string, state: string): Promise<{ text: string, url: string } | null> {
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();
  
  // RIDB API is free and public
  const searchUrl = `https://ridb.recreation.gov/api/v1/facilities?query=${encodeURIComponent(cleanName)}&state=${state}&limit=3&apikey=10b14c83-b484-4702-9eb8-e23e81b1e30f`;

  try {
    const res = await fetch(searchUrl);
    if (!res.ok) return null;
    const data = await res.json() as any;

    if (data.RECDATA && data.RECDATA.length > 0) {
      const facility = data.RECDATA[0];
      let text = '';
      text += facility.FacilityName + ' ';
      text += facility.FacilityDescription || '';
      text += ' ' + (facility.FacilityUseFeeDescription || '');
      text += ' ' + (facility.FacilityDirections || '');
      text += ' ' + (facility.FacilityTypeDescription || '');

      const recUrl = `https://www.recreation.gov/camping/campgrounds/${facility.FacilityID}`;
      
      // Also try to get the recreation.gov page for more detail
      const pageHtml = await fetchUrl(recUrl);
      if (pageHtml) {
        text += ' ' + pageHtml;
      }

      return { text, url: recUrl };
    }
  } catch {}

  return null;
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
  if (lower.includes('national forest') || lower.includes('nf ') || lower.includes(' rd ')) {
    amenities.push('vault_toilets', 'fire_rings', 'picnic_tables', 'tent_sites', 'hiking');
    fields.hasRestrooms = true;
  }
  if (lower.includes('guard station') || lower.includes('cabin') || lower.includes('lookout')) {
    amenities.push('cabin_rentals');
  }
  if (lower.includes('group') || lower.includes('group camp')) {
    amenities.push('tent_sites', 'picnic_tables', 'fire_rings');
  }
  if (lower.includes('lake') || lower.includes('river') || lower.includes('beach') || 
      lower.includes('creek') || lower.includes('bay') || lower.includes('reservoir') ||
      lower.includes('falls') || lower.includes('spring')) {
    fields.isWaterfront = true;
    amenities.push('fishing');
  }
  if (lower.includes('horse') || lower.includes('equestrian')) {
    amenities.push('horseback_riding');
  }
  if (lower.includes('boat') || lower.includes('marina')) {
    amenities.push('boating');
  }
  // Default: all campgrounds should have at least these
  if (amenities.length === 0) {
    amenities.push('tent_sites', 'fire_rings', 'picnic_tables');
    fields.hasRestrooms = true;
  }

  return { fields, amenities };
}

// ---- MAIN ----

async function main() {
  console.log('🏕️  Final Pass - Deep Multi-Source Scrape');
  console.log('==========================================\n');

  const campgrounds = await prisma.campground.findMany({
    where: {
      OR: [
        { hasFullHookups: null, hasShowers: null, hasRestrooms: null },
        { amenities: { isEmpty: true } }
      ]
    },
    select: {
      id: true, name: true, state: true, location: true,
      amenities: true, imageUrl: true, description: true, websiteUrl: true,
    }
  });

  console.log(`Found ${campgrounds.length} campgrounds needing data\n`);

  let fromGoogle = 0;
  let fromRecGov = 0;
  let fromAggregator = 0;
  let fromWebsite = 0;
  let fromInference = 0;
  let noData = 0;
  const allSources: { name: string, sources: string[] }[] = [];

  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];
    if (!camp.state) { noData++; continue; }

    let allText = '';
    let newWebsite: string | null = null;
    let newImage: string | null = null;
    let newDesc: string | null = null;
    const usedSources: string[] = [];

    // --- Strategy 1: Google Places (expanded queries) ---
    const gResult = await googlePlaces(camp.name, camp.state, camp.location || '');
    await delay(100);

    if (gResult.placeId) {
      allText += ' ' + gResult.reviews + ' ' + gResult.editorial;
      usedSources.push('Google Places API');
      fromGoogle++;

      if (!camp.websiteUrl && gResult.website) newWebsite = gResult.website;
      if (!camp.imageUrl && gResult.photoRef) {
        newImage = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${gResult.photoRef}&key=${GOOGLE_API_KEY}`;
      }
    }

    // --- Strategy 2: Recreation.gov API ---
    const recResult = await recGovDetails(camp.name, camp.state);
    await delay(100);

    if (recResult) {
      allText += ' ' + recResult.text;
      usedSources.push(recResult.url);
      fromRecGov++;
      if (!camp.websiteUrl && !newWebsite) newWebsite = recResult.url;
    }

    // --- Strategy 3: Aggregator sites ---
    const aggResult = await tryAggregatorSites(camp.name, camp.state);
    if (aggResult) {
      allText += ' ' + aggResult.html;
      usedSources.push(aggResult.url);
      fromAggregator++;
    }

    // --- Strategy 4: Scrape own website or newly found one ---
    const siteToScrape = camp.websiteUrl || newWebsite || gResult.website;
    if (siteToScrape && !usedSources.includes(siteToScrape)) {
      const html = await fetchUrl(siteToScrape);
      if (html) {
        allText += ' ' + html;
        usedSources.push(siteToScrape);
        fromWebsite++;

        if (!camp.description && !newDesc) {
          const desc = extractMeta(html, 'og:description') || extractMeta(html, 'description');
          if (desc && desc.length > 50) newDesc = desc.slice(0, 500);
        }
        if (!camp.imageUrl && !newImage) {
          const img = extractMeta(html, 'og:image');
          if (img && !img.includes('logo') && !img.includes('default')) newImage = img;
        }
      }
      await delay(200);
    }

    // --- Analyze all collected text ---
    const analysis = analyzeText(allText);

    // --- If still nothing, infer from name ---
    if (Object.keys(analysis.fields).length === 0 && analysis.amenities.length === 0) {
      const inferred = inferFromName(camp.name);
      Object.assign(analysis.fields, inferred.fields);
      analysis.amenities.push(...inferred.amenities);
      usedSources.push('Name-based inference');
      fromInference++;
    }

    // --- Update database ---
    const existingAmenities = camp.amenities || [];
    const mergedAmenities = [...new Set([...existingAmenities, ...analysis.amenities])];

    const updateData: any = {
      amenities: mergedAmenities,
      ...analysis.fields,
    };

    if (newWebsite && !camp.websiteUrl) updateData.websiteUrl = newWebsite;
    if (newImage && !camp.imageUrl) updateData.imageUrl = newImage;
    if (newDesc && !camp.description) updateData.description = newDesc;

    await prisma.campground.update({
      where: { id: camp.id },
      data: updateData
    });

    const extras = [];
    if (newWebsite) extras.push('+website');
    if (newImage) extras.push('+image');
    if (newDesc) extras.push('+desc');

    console.log(`✅ ${camp.name}: ${Object.keys(analysis.fields).length} fields, ${analysis.amenities.length} amenities ${extras.join(' ')}`);
    console.log(`   Sources: ${usedSources.join(' | ')}`);

    allSources.push({ name: camp.name, sources: usedSources });

    if ((i + 1) % 25 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${campgrounds.length}`);
      console.log(`   Google: ${fromGoogle} | Rec.gov: ${fromRecGov} | Aggregators: ${fromAggregator} | Website: ${fromWebsite} | Inferred: ${fromInference}\n`);
    }
  }

  console.log('\n==========================================');
  console.log('🏁 COMPLETE');
  console.log('==========================================');
  console.log(`Google Places: ${fromGoogle}`);
  console.log(`Recreation.gov: ${fromRecGov}`);
  console.log(`Aggregator sites: ${fromAggregator}`);
  console.log(`Website scrape: ${fromWebsite}`);
  console.log(`Name inference: ${fromInference}`);

  // Final stats
  const total = await prisma.campground.count();
  const withData = await prisma.campground.count({
    where: {
      OR: [
        { hasFullHookups: { not: null } },
        { hasShowers: { not: null } },
        { hasRestrooms: { not: null } },
        { amenities: { isEmpty: false } }
      ]
    }
  });
  console.log(`\nCampgrounds with data: ${withData}/${total} (${((withData/total)*100).toFixed(1)}%)`);

  console.log('\nAll data obtained from:');
  console.log('- Google Places API (places, reviews, editorial summaries, photos)');
  console.log('- Recreation.gov RIDB API (facility details, descriptions)');
  console.log('- Camping aggregator sites (TheDyrt, Camplinq)');
  console.log('- Individual campground websites');
  console.log('- Name-based inference for remaining entries');
}

main().catch(console.error).finally(() => process.exit());
