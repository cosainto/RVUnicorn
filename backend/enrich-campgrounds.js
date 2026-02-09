// ============================================================
// ENRICH CAMPGROUNDS - Scrape websites for RV params & amenities
// Targets campgrounds with websiteUrl but missing data
// Run: cd ~/Downloads/kindletribe-mvp/backend && node enrich-campgrounds.js
// Options:
//   --limit=500       (max campgrounds to process)
//   --dry-run         (show what would be extracted without saving)
//   --state=CA        (only process one state)
//   --start-from=ID   (resume from a specific campground ID)
//   --reverse         (process Z to A)
// ============================================================

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================================
// RV PARAMETER EXTRACTION PATTERNS
// ============================================================

function extractRvLength(html) {
  // Look for max RV/trailer length mentions
  const patterns = [
    /max(?:imum)?\s*(?:rv|rig|vehicle|trailer|motorhome)?\s*(?:length|size)[:\s]*(\d{2,3})\s*(?:ft|feet|'|foot)/i,
    /(?:rv|rig|vehicle|trailer|motorhome)\s*(?:up\s*to|max|maximum|limit)[:\s]*(\d{2,3})\s*(?:ft|feet|'|foot)/i,
    /(\d{2,3})\s*(?:ft|feet|'|foot)\s*(?:rv|rig|vehicle|trailer|motorhome)/i,
    /(?:accommodate|fit|handle)s?\s*(?:rv|rig|vehicle|trailer)s?\s*(?:up\s*to)?\s*(\d{2,3})\s*(?:ft|feet|'|foot)/i,
    /pull[- ]?thr(?:ough|u)\s*(?:sites?\s*)?(?:up\s*to\s*)?(\d{2,3})\s*(?:ft|feet|'|foot)/i,
    /sites?\s*(?:are|up\s*to)\s*(\d{2,3})\s*(?:ft|feet|'|foot)/i,
    /(\d{2,3})['′]\s*(?:pull|back)/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const len = parseInt(match[1]);
      if (len >= 15 && len <= 120) return len; // Reasonable RV length range
    }
  }
  return null;
}

function extractAmpService(html) {
  // Look for amp/electric service levels
  const patterns = [
    /50[- ]?amp/i,
    /30[- ]?amp/i,
    /20[- ]?amp/i,
    /50[\/&,]\s*30[- ]?amp/i,
    /30[\/&,]\s*50[- ]?amp/i,
    /20[\/&,]\s*30[\/&,]\s*50[- ]?amp/i,
  ];
  
  if (/50[- ]?amp/i.test(html)) return 50;
  if (/30[- ]?amp/i.test(html) && !/50[- ]?amp/i.test(html)) return 30;
  if (/20[- ]?amp/i.test(html) && !/30[- ]?amp/i.test(html)) return 20;
  return null;
}

function extractTotalSites(html) {
  const patterns = [
    /(\d{1,4})\s*(?:total\s*)?(?:camp)?sites/i,
    /(\d{1,4})\s*(?:rv|camping|camp)\s*(?:sites?|spots?|spaces?|pads?)/i,
    /(?:we\s*(?:have|offer)|featuring|with)\s*(\d{1,4})\s*(?:sites?|spots?|spaces?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const num = parseInt(match[1]);
      if (num >= 2 && num <= 2000) return num;
    }
  }
  return null;
}

function extractPrice(html) {
  const patterns = [
    /\$(\d{1,3}(?:\.\d{2})?)\s*(?:\/|per)\s*(?:night|nightly)/i,
    /(?:rate|price|cost|fee)s?\s*(?:from|starting\s*at|:)?\s*\$(\d{1,3}(?:\.\d{2})?)/i,
    /\$(\d{1,3}(?:\.\d{2})?)\s*[-–]\s*\$\d{1,3}/i, // Price range - take low end
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const price = parseFloat(match[1]);
      if (price >= 5 && price <= 500) return price;
    }
  }
  return null;
}

// ============================================================
// BOOLEAN FIELD EXTRACTION
// ============================================================

const FIELD_PATTERNS = {
  hasFullHookups: [
    /full\s*hook\s*-?\s*ups?/i,
    /full\s*service\s*(?:sites?|hookups?)/i,
    /water,?\s*(?:electric(?:ity)?|power),?\s*(?:and\s*)?sewer/i,
    /w\/e\/s\s*hook/i,
  ],
  hasWaterHookup: [
    /water\s*hook\s*-?\s*ups?/i,
    /water\s*(?:connection|available|at\s*site|hookup)/i,
    /(?:sites?\s*with|includes?)\s*water/i,
  ],
  hasElectricHookup: [
    /electri(?:c(?:al)?|city)\s*hook\s*-?\s*ups?/i,
    /electri(?:c(?:al)?|city)\s*(?:connection|available|at\s*site|hookup|service)/i,
    /(?:\d{2}[\/&,]\s*)?(?:20|30|50)[- ]?amp/i,
  ],
  hasSewerHookup: [
    /sewer\s*hook\s*-?\s*ups?/i,
    /sewer\s*(?:connection|available|at\s*site|hookup)/i,
    /(?:sites?\s*with|includes?)\s*sewer/i,
  ],
  hasPullThrough: [
    /pull[- ]?thr(?:ough|u)/i,
    /drive[- ]?thr(?:ough|u)/i,
  ],
  hasBackIn: [
    /back[- ]?in\s*(?:sites?|only|available)/i,
    /back[- ]?in/i,
  ],
  hasDumpStation: [
    /dump\s*station/i,
    /sanitary\s*(?:dump|station)/i,
    /rv\s*dump/i,
  ],
  hasWifi: [
    /wi[- ]?fi/i,
    /wireless\s*internet/i,
    /internet\s*(?:access|available|service)/i,
    /free\s*wifi/i,
  ],
  hasCableTV: [
    /cable\s*tv/i,
    /cable\s*television/i,
    /satellite\s*tv/i,
  ],
  hasShowers: [
    /(?:hot\s*)?showers?(?:\s*available)?/i,
    /shower\s*(?:house|facilities|building)/i,
    /bath\s*house/i,
    /bathhouse/i,
  ],
  hasRestrooms: [
    /restroom/i,
    /(?:flush\s*)?toilet/i,
    /bath\s*house/i,
    /bathhouse/i,
    /comfort\s*station/i,
  ],
  hasLaundry: [
    /laundry/i,
    /laundromat/i,
    /washer\s*(?:and|&|\/)\s*dryer/i,
    /coin[- ]?(?:op(?:erated)?)?\s*laundry/i,
  ],
  hasPool: [
    /swimming\s*pool/i,
    /(?:heated\s*)?pool(?:\s*available)?/i,
  ],
  hasStore: [
    /camp\s*store/i,
    /general\s*store/i,
    /convenience\s*store/i,
    /(?:on[- ]?site|camp)\s*(?:store|shop)/i,
  ],
  hasPropane: [
    /propane/i,
    /lp\s*gas/i,
    /lpg/i,
  ],
  isPetFriendly: [
    /pet[- ]?friendly/i,
    /pets?\s*(?:allowed|welcome|permitted|ok|okay)/i,
    /dog[- ]?friendly/i,
    /(?:dogs?|pets?)\s*(?:are\s*)?welcome/i,
    /bring\s*your\s*(?:pet|dog|furry)/i,
  ],
  isBigRigFriendly: [
    /big\s*rig/i,
    /large\s*(?:rv|rig|motorhome)/i,
    /class\s*a\s*(?:friendly|welcome|motorhome)/i,
    /(?:accommodate|fit|handle)s?\s*(?:large|big)\s*(?:rv|rig)/i,
  ],
  isWaterfront: [
    /waterfront/i,
    /(?:lake|river|ocean|beach|creek|bay|shore)[- ]?(?:front|side)/i,
    /on\s*the\s*(?:lake|river|ocean|beach|water|creek|bay|shore)/i,
  ],
};

function extractBooleanFields(html) {
  const fields = {};
  
  for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(html)) {
        fields[field] = true;
        break;
      }
    }
  }
  
  return fields;
}

// ============================================================
// AMENITY STRING EXTRACTION (for amenities[] array)
// ============================================================

const AMENITY_KEYWORDS = {
  'WiFi': ['wi-fi', 'wifi', 'wireless internet'],
  'Showers': ['shower', 'bath house', 'bathhouse'],
  'Restrooms': ['restroom', 'toilet', 'comfort station'],
  'Laundry': ['laundry', 'washer', 'laundromat'],
  'Pool': ['swimming pool', 'pool'],
  'Playground': ['playground', 'play area', 'play ground'],
  'Camp Store': ['camp store', 'general store', 'convenience store'],
  'Dump Station': ['dump station', 'sanitary dump', 'rv dump'],
  'Propane': ['propane', 'lp gas'],
  'Fire Rings': ['fire ring', 'fire pit', 'campfire'],
  'Picnic Tables': ['picnic table'],
  'Pet Friendly': ['pet friendly', 'pets allowed', 'pets welcome', 'dog friendly'],
  'Fishing': ['fishing', 'fish'],
  'Hiking': ['hiking', 'trail', 'hike'],
  'Boat Ramp': ['boat ramp', 'boat launch', 'boat access'],
  'Electric Hookups': ['electric hookup', 'electrical hookup', '30 amp', '50 amp', '20 amp'],
  'Water Hookups': ['water hookup', 'water connection'],
  'Sewer Hookups': ['sewer hookup', 'sewer connection', 'full hookup'],
  'Pull-Through Sites': ['pull-through', 'pull through', 'pullthrough', 'drive-through'],
  'Cable TV': ['cable tv', 'cable television', 'satellite tv'],
  'Firewood': ['firewood', 'fire wood'],
  'Ice': ['ice available', 'bag of ice', 'ice machine'],
  'ADA Accessible': ['ada accessible', 'wheelchair', 'handicap accessible', 'accessible sites'],
  'Rec Hall': ['rec hall', 'recreation hall', 'clubhouse', 'recreation room'],
  'Mini Golf': ['mini golf', 'miniature golf', 'putt putt'],
  'Hot Tub': ['hot tub', 'spa', 'jacuzzi'],
  'Horseshoes': ['horseshoe'],
  'Volleyball': ['volleyball'],
  'Basketball': ['basketball'],
  'Dog Park': ['dog park', 'off-leash', 'dog run'],
  'Nature Trails': ['nature trail', 'hiking trail', 'walking trail'],
  'Bike Rentals': ['bike rental', 'bicycle rental'],
  'Kayak/Canoe': ['kayak', 'canoe', 'paddleboard'],
};

function extractAmenities(html) {
  const found = [];
  const lowerHtml = html.toLowerCase();
  
  for (const [amenity, keywords] of Object.entries(AMENITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerHtml.includes(keyword.toLowerCase())) {
        if (!found.includes(amenity)) {
          found.push(amenity);
        }
        break;
      }
    }
  }
  
  return found;
}

// ============================================================
// SEASON EXTRACTION
// ============================================================

function extractSeason(html) {
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const shortMonths = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  
  const seasonPatterns = [
    /(?:open|season)\s*[:]*\s*((?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[\w]*)\s*(?:[-–through to]+)\s*((?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[\w]*)/i,
    /(?:open|operating)\s*(?:from\s*)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\w]*)\s*(?:[-–]|through|to|thru)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\w]*)/i,
  ];
  
  for (const pattern of seasonPatterns) {
    const match = html.match(pattern);
    if (match) {
      return { seasonStart: match[1].trim(), seasonEnd: match[2].trim() };
    }
  }
  
  if (/year[- ]?round|open\s*all\s*year|365\s*days/i.test(html)) {
    return { seasonStart: 'Year-round', seasonEnd: 'Year-round' };
  }
  
  return {};
}

// ============================================================
// SITE TYPE EXTRACTION
// ============================================================

function extractSiteType(html) {
  const types = [];
  if (/rv\s*(?:site|camping|park|space|pad)/i.test(html)) types.push('RV');
  if (/tent\s*(?:site|camping|only|space)/i.test(html)) types.push('Tent');
  if (/cabin/i.test(html)) types.push('Cabin');
  if (/yurt/i.test(html)) types.push('Yurt');
  if (/glamping/i.test(html)) types.push('Glamping');
  if (/dry\s*camp|boondock|dispersed/i.test(html)) types.push('Dry Camping');
  
  return types.length > 0 ? types.join(', ') : null;
}

// ============================================================
// FETCH WEBSITE HTML
// ============================================================

async function fetchWebsite(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RVUnicorn/1.0; +https://rvunicorn.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    
    const html = await res.text();
    return html;
  } catch {
    return null;
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('🏕️  Enrich Campgrounds - RV Params & Amenities');
  console.log('================================================\n');
  
  // Parse args
  const args = process.argv.slice(2);
  let limit = 99999;
  let dryRun = false;
  let targetState = null;
  let startFrom = null;
  let reverse = false;
  
  for (const arg of args) {
    if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1]);
    if (arg === '--dry-run') dryRun = true;
    if (arg.startsWith('--state=')) targetState = arg.split('=')[1].toUpperCase();
    if (arg.startsWith('--start-from=')) startFrom = arg.split('=')[1];
    if (arg === '--reverse') reverse = true;
  }
  
  // Build query
  const where = {
    websiteUrl: { not: null },
    OR: [
      { hasFullHookups: null },
      { maxRvLength: null },
      { hasPullThrough: null },
      { maxAmpService: null },
      { isPetFriendly: null },
      { hasShowers: null },
    ],
  };
  
  if (targetState) {
    where.state = targetState;
  }
  
  if (startFrom) {
    where.id = { gt: startFrom };
  }
  
  const campgrounds = await prisma.campground.findMany({
    where,
    select: {
      id: true,
      name: true,
      state: true,
      websiteUrl: true,
      amenities: true,
      hasFullHookups: true,
      maxRvLength: true,
      hasPullThrough: true,
      maxAmpService: true,
      isPetFriendly: true,
      hasShowers: true,
      hasRestrooms: true,
      hasWifi: true,
      hasPool: true,
      hasLaundry: true,
      hasStore: true,
      hasPropane: true,
      hasDumpStation: true,
      hasWaterHookup: true,
      hasElectricHookup: true,
      hasSewerHookup: true,
      hasBackIn: true,
      hasCableTV: true,
      isBigRigFriendly: true,
      isWaterfront: true,
      siteType: true,
      pricePerNight: true,
      seasonStart: true,
      seasonEnd: true,
      description: true,
      imageUrl: true,
    },
    orderBy: { name: reverse ? 'desc' : 'asc' },
    take: limit,
  });
  
  console.log(`📊 Found ${campgrounds.length} campgrounds to enrich`);
  if (dryRun) console.log('🔍 DRY RUN - no changes will be saved\n');
  
  // Skip generic URLs
  const SKIP_DOMAINS = [
    'recreation.gov', 'fs.usda.gov', 'nps.gov/index', 'blm.gov/office',
    'reserveamerica.com', 'google.com', 'facebook.com', 'yelp.com',
  ];
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let noData = 0;
  
  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];
    const url = camp.websiteUrl;
    
    // Skip generic/unusable URLs
    if (!url || url.length < 10) {
      skipped++;
      continue;
    }
    
    const isGeneric = SKIP_DOMAINS.some(d => {
      try {
        const hostname = new URL(url).hostname;
        const pathname = new URL(url).pathname;
        return hostname.includes(d) && (pathname === '/' || pathname === '' || pathname.includes('sitemap'));
      } catch { return false; }
    });
    
    if (isGeneric) {
      skipped++;
      continue;
    }
    
    // Fetch website
    const html = await fetchWebsite(url);
    
    if (!html) {
      failed++;
      if ((i + 1) % 100 === 0) {
        console.log(`[${i + 1}/${campgrounds.length}] Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed} | No data: ${noData}`);
      }
      continue;
    }
    
    // Extract everything
    const booleanFields = extractBooleanFields(html);
    const rvLength = extractRvLength(html);
    const ampService = extractAmpService(html);
    const totalSites = extractTotalSites(html);
    const price = extractPrice(html);
    const season = extractSeason(html);
    const siteType = extractSiteType(html);
    const newAmenities = extractAmenities(html);
    
    // Build update object - only update NULL fields
    const updateData = {};
    let fieldsFound = 0;
    
    // Boolean fields - only set if currently null
    for (const [field, value] of Object.entries(booleanFields)) {
      if (camp[field] === null || camp[field] === undefined) {
        updateData[field] = value;
        fieldsFound++;
      }
    }
    
    // Numeric/string fields
    if (rvLength && !camp.maxRvLength) {
      updateData.maxRvLength = rvLength;
      fieldsFound++;
    }
    if (ampService && !camp.maxAmpService) {
      updateData.maxAmpService = ampService;
      fieldsFound++;
    }
    if (price && !camp.pricePerNight) {
      updateData.pricePerNight = price;
      fieldsFound++;
    }
    if (siteType && !camp.siteType) {
      updateData.siteType = siteType;
      fieldsFound++;
    }
    if (season.seasonStart && !camp.seasonStart) {
      updateData.seasonStart = season.seasonStart;
      fieldsFound++;
    }
    if (season.seasonEnd && !camp.seasonEnd) {
      updateData.seasonEnd = season.seasonEnd;
      fieldsFound++;
    }
    
    // Merge amenities (don't duplicate)
    const existingAmenities = camp.amenities || [];
    const mergedAmenities = [...new Set([...existingAmenities, ...newAmenities])];
    if (mergedAmenities.length > existingAmenities.length) {
      updateData.amenities = mergedAmenities;
      fieldsFound += (mergedAmenities.length - existingAmenities.length);
    }
    
    if (fieldsFound > 0) {
      if (!dryRun) {
        try {
          await prisma.campground.update({
            where: { id: camp.id },
            data: updateData,
          });
        } catch (err) {
          console.log(`  ⚠️ DB error for ${camp.name}: ${err.message}`);
          failed++;
          continue;
        }
      }
      
      const highlights = [];
      if (updateData.maxRvLength) highlights.push(`RV:${updateData.maxRvLength}ft`);
      if (updateData.maxAmpService) highlights.push(`${updateData.maxAmpService}A`);
      if (updateData.hasPullThrough) highlights.push('pull-thru');
      if (updateData.hasFullHookups) highlights.push('full-hookup');
      if (updateData.isPetFriendly) highlights.push('pets');
      if (updateData.isBigRigFriendly) highlights.push('big-rig');
      if (updateData.pricePerNight) highlights.push(`$${updateData.pricePerNight}/night`);
      
      const amenityCount = mergedAmenities.length - existingAmenities.length;
      if (amenityCount > 0) highlights.push(`+${amenityCount} amenities`);
      
      console.log(`✅ [${i + 1}] ${camp.name} (${camp.state}): ${fieldsFound} fields [${highlights.join(', ')}]`);
      updated++;
    } else {
      noData++;
    }
    
    // Progress update every 100
    if ((i + 1) % 100 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${campgrounds.length} | Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed} | No data: ${noData}\n`);
    }
    
    // Rate limiting - be respectful
    await delay(300);
  }
  
  // Final summary
  console.log('\n====================================================');
  console.log('🏁 ENRICHMENT COMPLETE');
  console.log('====================================================');
  console.log(`Processed: ${campgrounds.length}`);
  console.log(`Updated:   ${updated}`);
  console.log(`Skipped:   ${skipped} (generic URLs)`);
  console.log(`Failed:    ${failed} (fetch errors)`);
  console.log(`No data:   ${noData} (page had no extractable info)`);
  
  if (!dryRun) {
    // Show final coverage stats
    const total = await prisma.campground.count();
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(CASE WHEN "hasFullHookups" IS NOT NULL THEN 1 END) as hookups,
        COUNT(CASE WHEN "maxRvLength" IS NOT NULL THEN 1 END) as rv_length,
        COUNT(CASE WHEN "hasPullThrough" IS NOT NULL THEN 1 END) as pull_through,
        COUNT(CASE WHEN "maxAmpService" IS NOT NULL THEN 1 END) as amp_service,
        COUNT(CASE WHEN "isPetFriendly" IS NOT NULL THEN 1 END) as pet_friendly,
        COUNT(CASE WHEN "hasShowers" IS NOT NULL THEN 1 END) as showers,
        COUNT(CASE WHEN "isBigRigFriendly" IS NOT NULL THEN 1 END) as big_rig,
        COUNT(CASE WHEN "pricePerNight" IS NOT NULL THEN 1 END) as price
      FROM "Campground"
    `;
    
    console.log(`\n📊 Updated Coverage (out of ${total}):`);
    if (stats[0]) {
      const s = stats[0];
      console.log(`  Full Hookups:    ${s.hookups}`);
      console.log(`  Max RV Length:   ${s.rv_length}`);
      console.log(`  Pull-Through:   ${s.pull_through}`);
      console.log(`  Amp Service:     ${s.amp_service}`);
      console.log(`  Pet Friendly:    ${s.pet_friendly}`);
      console.log(`  Showers:         ${s.showers}`);
      console.log(`  Big Rig:         ${s.big_rig}`);
      console.log(`  Price/Night:     ${s.price}`);
    }
  }
  
  // Save last processed ID for resume
  if (campgrounds.length > 0) {
    const lastId = campgrounds[campgrounds.length - 1].id;
    console.log(`\nTo resume: node enrich-campgrounds.js --start-from=${lastId}`);
  }
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
