/**
 * ═══════════════════════════════════════════════════════════════════════
 *  RVUnicorn Master Campground Repopulation Script
 * ═══════════════════════════════════════════════════════════════════════
 * 
 *  Restores 20,000+ campgrounds with full data across all 50 US states.
 *  
 *  STAGES:
 *    1. Recreation.gov RIDB API  → ~5,500 federal campgrounds
 *    2. Google Places Discovery  → ~15,000+ additional (state-by-state grid search)
 *    3. Google Places Enrichment → amenities, reviews, websites, RV specs for ALL
 *    4. Google Photos → Cloudinary upload for campground images
 *    5. State code fix → reverse geocode any missing states
 *
 *  USAGE:
 *    # Move to scripts folder first:
 *    mv ~/Downloads/repopulate-campgrounds.ts ~/Downloads/kindletribe-mvp/backend/src/scripts/
 *    
 *    # Delete old progress if starting fresh:
 *    rm -f ~/Downloads/kindletribe-mvp/backend/src/scripts/repopulate-progress.json
 *    
 *    # Run it:
 *    cd ~/Downloads/kindletribe-mvp/backend
 *    npx tsx src/scripts/repopulate-campgrounds.ts
 *
 *  Can be stopped (Ctrl+C) and resumed — progress is saved per stage.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════
// API KEYS (from your .env)
// ═══════════════════════════════════════════════════════════════
const RIDB_API_KEY = '0df4c4d6-1be3-4f76-99b0-0ab0a676a8fa';
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';
const CLOUDINARY_CLOUD = 'dy6eetmh7';
const CLOUDINARY_KEY = '333927774328418';
const CLOUDINARY_SECRET = '9phbOjjX2YxVI43orwmWdoiCvew';

const RIDB_BASE = 'https://ridb.recreation.gov/api/v1';
const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api/place';

// ═══════════════════════════════════════════════════════════════
// PROGRESS TRACKING (resumable)
// ═══════════════════════════════════════════════════════════════
const PROGRESS_FILE = path.join(__dirname, 'repopulate-progress.json');

interface Progress {
  stage1_ridb: { completed: boolean; offset: number; imported: number };
  stage2_google_discover: { completed: boolean; statesCompleted: string[]; imported: number };
  stage3_enrich: { completed: boolean; lastId: string; enriched: number };
  stage4_photos: { completed: boolean; lastId: string; uploaded: number };
  stage5_states: { completed: boolean; fixed: number };
}

function defaultProgress(): Progress {
  return {
    stage1_ridb: { completed: false, offset: 0, imported: 0 },
    stage2_google_discover: { completed: false, statesCompleted: [], imported: 0 },
    stage3_enrich: { completed: false, lastId: '', enriched: 0 },
    stage4_photos: { completed: false, lastId: '', uploaded: 0 },
    stage5_states: { completed: false, fixed: 0 },
  };
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return defaultProgress();
}

function saveProgress(p: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// STATE DATA — grid search points for Google Places discovery
// Each state has multiple lat/lng points to ensure coverage
// ═══════════════════════════════════════════════════════════════
const US_STATES: Record<string, { abbr: string; points: [number, number][] }> = {
  'Alabama': { abbr: 'AL', points: [[32.8,-86.8],[33.5,-87.5],[34.7,-86.6],[31.2,-85.4],[30.7,-88.0]] },
  'Alaska': { abbr: 'AK', points: [[61.2,-149.9],[64.8,-147.7],[58.3,-134.4],[57.1,-135.3],[60.5,-151.0],[63.0,-143.0]] },
  'Arizona': { abbr: 'AZ', points: [[33.4,-112.0],[34.9,-111.8],[36.1,-112.1],[32.2,-110.9],[35.2,-114.0],[31.9,-109.9]] },
  'Arkansas': { abbr: 'AR', points: [[34.7,-92.3],[35.5,-93.7],[36.3,-94.2],[33.7,-91.5],[35.8,-91.4]] },
  'California': { abbr: 'CA', points: [[37.8,-122.4],[34.1,-118.2],[36.7,-119.8],[38.6,-121.5],[33.8,-117.9],[41.8,-122.4],[37.3,-119.5],[39.5,-121.5],[35.4,-120.6],[40.6,-122.4],[33.0,-117.0],[36.0,-118.5]] },
  'Colorado': { abbr: 'CO', points: [[39.7,-105.0],[38.8,-106.9],[40.0,-105.5],[37.5,-106.8],[38.5,-105.0],[39.6,-106.4],[40.5,-106.8]] },
  'Connecticut': { abbr: 'CT', points: [[41.8,-72.7],[41.2,-73.2],[41.5,-72.1]] },
  'Delaware': { abbr: 'DE', points: [[39.2,-75.5],[38.7,-75.1]] },
  'Florida': { abbr: 'FL', points: [[28.5,-81.4],[25.8,-80.2],[30.3,-81.7],[27.9,-82.5],[29.7,-85.0],[26.6,-82.0],[30.4,-84.3],[28.0,-80.6]] },
  'Georgia': { abbr: 'GA', points: [[33.7,-84.4],[34.9,-83.4],[32.1,-81.1],[31.6,-84.2],[33.5,-82.0],[30.8,-83.3]] },
  'Hawaii': { abbr: 'HI', points: [[21.3,-157.8],[20.8,-156.3],[19.7,-155.1],[22.0,-159.3]] },
  'Idaho': { abbr: 'ID', points: [[43.6,-116.2],[47.7,-116.8],[44.7,-114.0],[42.9,-114.5],[46.4,-117.0],[45.5,-114.2]] },
  'Illinois': { abbr: 'IL', points: [[41.9,-87.6],[39.8,-89.6],[40.7,-89.6],[37.7,-89.2],[38.6,-90.2]] },
  'Indiana': { abbr: 'IN', points: [[39.8,-86.2],[41.7,-86.3],[38.3,-86.5],[40.4,-86.9]] },
  'Iowa': { abbr: 'IA', points: [[41.6,-93.6],[42.5,-96.4],[41.3,-91.7],[43.1,-93.2]] },
  'Kansas': { abbr: 'KS', points: [[39.0,-95.7],[37.7,-97.3],[38.9,-99.3],[39.3,-94.8]] },
  'Kentucky': { abbr: 'KY', points: [[38.3,-85.8],[37.8,-84.3],[36.8,-88.1],[37.1,-86.3]] },
  'Louisiana': { abbr: 'LA', points: [[30.0,-90.1],[32.5,-93.7],[30.2,-92.0],[31.3,-92.4]] },
  'Maine': { abbr: 'ME', points: [[44.3,-69.8],[43.7,-70.3],[45.3,-68.5],[44.8,-68.8],[46.1,-68.0]] },
  'Maryland': { abbr: 'MD', points: [[39.3,-76.6],[38.9,-77.0],[39.6,-78.8],[38.3,-75.6]] },
  'Massachusetts': { abbr: 'MA', points: [[42.4,-71.1],[41.7,-70.3],[42.6,-72.6],[42.1,-72.6]] },
  'Michigan': { abbr: 'MI', points: [[42.3,-83.0],[44.3,-85.0],[46.5,-87.4],[43.0,-83.7],[44.8,-84.7],[45.8,-84.7]] },
  'Minnesota': { abbr: 'MN', points: [[44.9,-93.3],[47.9,-91.7],[46.8,-94.7],[44.0,-92.5],[48.2,-93.5]] },
  'Mississippi': { abbr: 'MS', points: [[32.3,-90.2],[34.3,-89.5],[30.4,-89.1],[31.3,-89.3]] },
  'Missouri': { abbr: 'MO', points: [[38.6,-90.2],[39.1,-94.6],[37.2,-93.3],[36.7,-90.4],[38.6,-92.6]] },
  'Montana': { abbr: 'MT', points: [[46.9,-110.4],[48.5,-114.1],[45.7,-111.0],[47.5,-111.3],[46.0,-105.5],[45.2,-109.2]] },
  'Nebraska': { abbr: 'NE', points: [[41.3,-96.0],[40.8,-99.0],[42.0,-100.8],[41.1,-101.0]] },
  'Nevada': { abbr: 'NV', points: [[36.2,-115.1],[39.5,-119.8],[40.8,-117.8],[38.5,-118.0],[36.0,-116.5]] },
  'New Hampshire': { abbr: 'NH', points: [[43.2,-71.5],[44.0,-71.5],[44.3,-71.8],[43.6,-72.3]] },
  'New Jersey': { abbr: 'NJ', points: [[40.7,-74.2],[39.4,-74.5],[40.9,-74.8],[40.1,-74.7]] },
  'New Mexico': { abbr: 'NM', points: [[35.1,-106.6],[32.3,-106.7],[36.4,-105.6],[33.4,-105.5],[34.5,-108.8]] },
  'New York': { abbr: 'NY', points: [[40.7,-74.0],[43.0,-73.8],[42.4,-76.5],[44.7,-73.5],[43.1,-77.6]] },
  'North Carolina': { abbr: 'NC', points: [[35.8,-78.6],[35.6,-82.6],[35.2,-80.8],[34.2,-77.9],[36.1,-80.2]] },
  'North Dakota': { abbr: 'ND', points: [[46.8,-96.8],[47.9,-103.0],[46.9,-100.8],[48.2,-101.3]] },
  'Ohio': { abbr: 'OH', points: [[39.1,-84.5],[41.5,-81.7],[40.0,-82.9],[39.3,-82.1]] },
  'Oklahoma': { abbr: 'OK', points: [[35.5,-97.5],[36.2,-95.9],[34.7,-96.4],[34.6,-98.4],[36.4,-94.8]] },
  'Oregon': { abbr: 'OR', points: [[45.5,-122.7],[44.1,-121.2],[42.3,-122.9],[44.6,-123.3],[43.2,-124.3],[44.9,-117.0],[45.8,-121.5]] },
  'Pennsylvania': { abbr: 'PA', points: [[40.0,-75.2],[40.4,-80.0],[41.4,-77.0],[41.8,-79.0],[40.3,-76.9]] },
  'Rhode Island': { abbr: 'RI', points: [[41.8,-71.4],[41.5,-71.5]] },
  'South Carolina': { abbr: 'SC', points: [[34.0,-81.0],[32.8,-79.9],[34.9,-82.4],[33.4,-81.1]] },
  'South Dakota': { abbr: 'SD', points: [[43.5,-96.7],[44.1,-103.2],[43.9,-100.4],[43.8,-103.5]] },
  'Tennessee': { abbr: 'TN', points: [[36.2,-86.8],[35.1,-90.0],[35.0,-85.3],[36.0,-83.9],[35.6,-87.4]] },
  'Texas': { abbr: 'TX', points: [[29.8,-95.4],[32.8,-96.8],[30.3,-97.7],[31.8,-106.4],[33.5,-101.8],[27.5,-99.5],[29.4,-98.5],[26.2,-98.2],[35.2,-101.8],[30.5,-100.4]] },
  'Utah': { abbr: 'UT', points: [[40.8,-111.9],[37.3,-113.0],[38.6,-109.5],[37.6,-112.2],[40.0,-109.5],[39.3,-111.1]] },
  'Vermont': { abbr: 'VT', points: [[44.5,-72.6],[43.6,-72.9],[44.0,-72.1]] },
  'Virginia': { abbr: 'VA', points: [[37.5,-77.4],[38.0,-79.4],[37.3,-80.1],[36.9,-76.3],[38.9,-77.5]] },
  'Washington': { abbr: 'WA', points: [[47.6,-122.3],[48.8,-122.5],[46.7,-120.5],[47.8,-120.7],[46.3,-119.3],[48.0,-117.4]] },
  'West Virginia': { abbr: 'WV', points: [[38.3,-81.6],[39.3,-80.0],[37.8,-81.2],[39.5,-79.5]] },
  'Wisconsin': { abbr: 'WI', points: [[43.1,-89.4],[44.5,-88.0],[46.0,-89.6],[44.3,-90.3],[45.5,-88.8]] },
  'Wyoming': { abbr: 'WY', points: [[41.1,-104.8],[44.5,-110.8],[43.0,-108.4],[42.8,-106.3],[44.8,-106.9]] },
};

const STATE_ABBR_TO_NAME: Record<string, string> = {};
for (const [name, data] of Object.entries(US_STATES)) {
  STATE_ABBR_TO_NAME[data.abbr] = name;
}

// ═══════════════════════════════════════════════════════════════
// KEYWORD EXTRACTION from text (reviews, descriptions)
// ═══════════════════════════════════════════════════════════════
const FIELD_KEYWORDS: Record<string, string[]> = {
  hasFullHookups: ['full hookup', 'full hook-up', 'fhu', 'water sewer electric'],
  hasWaterHookup: ['water hookup', 'water hook-up', 'water connection'],
  hasElectricHookup: ['electric hookup', 'electric hook-up', '30 amp', '50 amp', 'electrical connection', 'shore power'],
  hasSewerHookup: ['sewer hookup', 'sewer hook-up', 'sewer connection'],
  hasPullThrough: ['pull through', 'pull-through', 'pull thru', 'drive-through site'],
  hasBackIn: ['back in', 'back-in', 'backin'],
  hasDumpStation: ['dump station', 'dump site', 'sanitary station', 'rv dump'],
  hasWifi: ['wifi', 'wi-fi', 'wireless internet', 'internet access'],
  hasShowers: ['shower', 'bath house', 'bathhouse'],
  hasRestrooms: ['restroom', 'bathroom', 'toilet', 'vault toilet', 'flush toilet', 'pit toilet', 'comfort station'],
  hasLaundry: ['laundry', 'washer', 'dryer', 'coin laundry'],
  hasPool: ['pool', 'swimming pool'],
  hasStore: ['store', 'camp store', 'general store', 'gift shop', 'convenience store'],
  hasPropane: ['propane', 'lp gas'],
  hasCableTV: ['cable tv', 'cable television'],
  isPetFriendly: ['pet friendly', 'pets allowed', 'dogs allowed', 'dog park', 'pets welcome', 'pet area'],
  isBigRigFriendly: ['big rig', 'big-rig', 'large rv', '40 foot', '45 foot', 'class a motorhome'],
  isWaterfront: ['lake', 'river', 'beach', 'waterfront', 'ocean', 'creek', 'stream', 'lakefront', 'riverside', 'oceanfront', 'beachfront'],
};

const AMENITY_KEYWORDS: Record<string, string[]> = {
  'vault_toilets': ['vault toilet', 'pit toilet'],
  'flush_toilets': ['flush toilet', 'restroom', 'bathroom'],
  'showers': ['shower', 'bath house'],
  'dump_station': ['dump station', 'sanitary station'],
  'fishing': ['fishing', 'fish'],
  'hiking': ['hiking', 'trail', 'hike'],
  'boating': ['boat', 'marina', 'kayak', 'canoe'],
  'swimming': ['swimming', 'swim', 'beach'],
  'picnic_tables': ['picnic table', 'picnic area'],
  'fire_rings': ['fire ring', 'fire pit', 'campfire'],
  'tent_sites': ['tent site', 'tent camping', 'tent pad'],
  'rv_sites': ['rv site', 'rv space', 'rv camping', 'rv park'],
  'playground': ['playground', 'play area'],
  'camp_store': ['store', 'camp store'],
  'propane': ['propane'],
  'wifi': ['wifi', 'wi-fi'],
  'electric_hookups': ['electric hookup', 'shore power'],
  'water_hookups': ['water hookup'],
  'sewer_hookups': ['sewer hookup'],
  'horseback_riding': ['horseback', 'horse trail', 'equestrian'],
  'mountain_biking': ['mountain bik', 'bike trail'],
  'atv_ohv': ['atv', 'ohv', 'off-road'],
};

function extractMaxRvLength(text: string): number | null {
  const patterns = [
    /(\d{2,3})\s*(?:foot|ft|')\s*(?:rv|rig|motorhome|trailer|max)/i,
    /max(?:imum)?\s*(?:rv|rig|vehicle|trailer|length)[:\s]*(\d{2,3})/i,
    /(?:rv|rig|trailer|vehicle)\s*(?:up to|max|limit)[:\s]*(\d{2,3})/i,
    /accommodat(?:e|es)\s*(?:rv|rig)s?\s*up\s*to\s*(\d{2,3})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { const n = parseInt(m[1]); if (n >= 15 && n <= 120) return n; }
  }
  return null;
}

function extractMaxAmp(text: string): number | null {
  const patterns = [/(\d{2,3})\s*-?\s*amp/i];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { const n = parseInt(m[1]); if ([15, 20, 30, 50, 100].includes(n)) return n; }
  }
  return null;
}

function extractPrice(text: string): number | null {
  const patterns = [
    /\$(\d{2,3})(?:\.\d{2})?\s*(?:\/?\s*night|per\s*night|nightly)/i,
    /(?:rate|price|from)\s*:?\s*\$(\d{2,3})/i,
    /starting\s*(?:at|from)\s*\$(\d{2,3})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { const n = parseInt(m[1]); if (n >= 10 && n <= 500) return n; }
  }
  return null;
}

function analyzeText(text: string): {
  fields: Record<string, boolean>;
  amenities: string[];
  maxRvLength: number | null;
  maxAmpService: number | null;
  pricePerNight: number | null;
} {
  const lower = text.toLowerCase();
  const fields: Record<string, boolean> = {};
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

  return {
    fields,
    amenities,
    maxRvLength: extractMaxRvLength(lower),
    maxAmpService: extractMaxAmp(lower),
    pricePerNight: extractPrice(lower),
  };
}

// ═══════════════════════════════════════════════════════════════
// CLOUDINARY UPLOAD
// ═══════════════════════════════════════════════════════════════
async function uploadToCloudinary(imageUrl: string, folder: string = 'campgrounds'): Promise<string | null> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_SECRET}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    const formData = new URLSearchParams();
    formData.append('file', imageUrl);
    formData.append('folder', folder);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', CLOUDINARY_KEY);
    formData.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json() as any;
      return data.secure_url;
    }
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════════════════
// STAGE 1: Recreation.gov RIDB Import (~5,500 federal campgrounds)
// ═══════════════════════════════════════════════════════════════
async function stage1_RIDB(progress: Progress) {
  if (progress.stage1_ridb.completed) {
    console.log('✅ Stage 1 (Recreation.gov) already completed. Skipping.');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  STAGE 1: Recreation.gov Federal Campgrounds');
  console.log('═'.repeat(60));

  let offset = progress.stage1_ridb.offset;
  let hasMore = true;

  while (hasMore) {
    try {
      const res = await fetch(`${RIDB_BASE}/facilities?offset=${offset}&limit=50&activity=CAMPING`, {
        headers: { 'apikey': RIDB_API_KEY, 'accept': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 429) {
          console.log('  ⏱️  Rate limited, waiting 60s...');
          await delay(60000);
          continue;
        }
        throw new Error(`RIDB API error: ${res.status}`);
      }

      const data = await res.json() as any;
      const facilities = data.RECDATA || [];
      const total = data.METADATA?.RESULTS?.TOTAL_COUNT || 0;

      if (facilities.length === 0) { hasMore = false; break; }

      console.log(`📥 [${offset}/${total}] Fetched ${facilities.length} facilities...`);

      let batchImported = 0;
      for (const f of facilities) {
        const name = f.FacilityName;
        const lat = parseFloat(f.FacilityLatitude);
        const lon = parseFloat(f.FacilityLongitude);
        if (!name || !lat || !lon || isNaN(lat) || isNaN(lon)) continue;

        // Dedup: check by name + coordinates
        const existing = await prisma.campground.findFirst({
          where: { name, latitude: lat, longitude: lon },
        });
        if (existing) continue;

        // Extract state and location from RIDB address data
        const addrs = f.FACILITYADDRESS || [];
        const addr = addrs[0] || {};
        const stateCode = addr.AddressStateCode || 'Unknown';
        const city = addr.City || '';
        const location = city ? `${city}, ${stateCode}` : stateCode;

        // Parse amenities from description + activities
        const desc = (f.FacilityDescription || '').replace(/<[^>]*>/g, '');
        const parsed = analyzeText(desc);

        const baseAmenities: string[] = [];
        for (const a of (f.ACTIVITY || [])) {
          const an = (a.ActivityName || '').toUpperCase();
          if (an.includes('CAMP')) baseAmenities.push('camping');
          if (an.includes('SWIM')) baseAmenities.push('swimming');
          if (an.includes('FISH')) baseAmenities.push('fishing');
          if (an.includes('HIK')) baseAmenities.push('hiking');
          if (an.includes('BOAT')) baseAmenities.push('boating');
        }
        const allAmenities = [...new Set([...baseAmenities, ...parsed.amenities])];

        try {
          await prisma.campground.create({
            data: {
              name,
              location,
              state: stateCode,
              latitude: lat,
              longitude: lon,
              description: desc.substring(0, 2000) || `${name} - Federal recreation area`,
              amenities: allAmenities,
              websiteUrl: f.FacilityReservationURL || null,
              phone: f.FacilityPhone || null,
              ...parsed.fields,
              maxRvLength: parsed.maxRvLength,
              maxAmpService: parsed.maxAmpService,
              pricePerNight: parsed.pricePerNight,
            },
          });
          batchImported++;
          progress.stage1_ridb.imported++;
        } catch {}
      }

      if (batchImported > 0) console.log(`  ✅ +${batchImported} new campgrounds`);

      offset += 50;
      progress.stage1_ridb.offset = offset;
      saveProgress(progress);

      if (offset >= total) hasMore = false;
      else await delay(1200);

    } catch (e: any) {
      console.error(`  ❌ Error: ${e.message}. Saving and continuing...`);
      saveProgress(progress);
      break;
    }
  }

  progress.stage1_ridb.completed = true;
  saveProgress(progress);
  console.log(`\n🏁 Stage 1 done: ${progress.stage1_ridb.imported} federal campgrounds imported`);
}

// ═══════════════════════════════════════════════════════════════
// STAGE 2: Google Places Discovery — find NEW campgrounds state by state
// Uses Text Search + Nearby Search with multiple queries per grid point
// ═══════════════════════════════════════════════════════════════
async function stage2_GoogleDiscover(progress: Progress) {
  if (progress.stage2_google_discover.completed) {
    console.log('✅ Stage 2 (Google Discovery) already completed. Skipping.');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  STAGE 2: Google Places Discovery (all 50 states)');
  console.log('═'.repeat(60));

  const searchQueries = [
    'campground', 'rv park', 'camping', 'state park campground',
    'KOA campground', 'national forest campground', 'county park camping',
    'rv resort', 'glamping',
  ];

  for (const [stateName, stateData] of Object.entries(US_STATES)) {
    if (progress.stage2_google_discover.statesCompleted.includes(stateData.abbr)) {
      continue;
    }

    console.log(`\n🔍 ${stateName} (${stateData.abbr}) — ${stateData.points.length} grid points × ${searchQueries.length} queries`);
    let stateImported = 0;

    for (const [lat, lng] of stateData.points) {
      for (const query of searchQueries) {
        try {
          const url = `${GOOGLE_BASE}/textsearch/json?query=${encodeURIComponent(query + ' ' + stateName)}&location=${lat},${lng}&radius=80000&key=${GOOGLE_API_KEY}`;
          const res = await fetch(url);
          const data = await res.json() as any;

          if (data.status !== 'OK' || !data.results) continue;

          for (const place of data.results) {
            const pLat = place.geometry?.location?.lat;
            const pLng = place.geometry?.location?.lng;
            if (!pLat || !pLng) continue;

            // Skip if coords already exist (within ~100m)
            const existing = await prisma.campground.findFirst({
              where: {
                AND: [
                  { latitude: { gte: pLat - 0.001, lte: pLat + 0.001 } },
                  { longitude: { gte: pLng - 0.001, lte: pLng + 0.001 } },
                ],
              },
            });
            if (existing) continue;

            // Also check name + state match
            const nameMatch = await prisma.campground.findFirst({
              where: { name: place.name, state: stateData.abbr },
            });
            if (nameMatch) continue;

            // Parse address for location
            const addr = place.formatted_address || '';
            const addrParts = addr.split(',').map((s: string) => s.trim());
            const city = addrParts[0] || '';
            const locationStr = city ? `${city}, ${stateData.abbr}` : stateData.abbr;

            // Get photo reference
            let imageUrl: string | null = null;
            if (place.photos?.[0]) {
              imageUrl = `${GOOGLE_BASE}/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
            }

            try {
              await prisma.campground.create({
                data: {
                  name: place.name,
                  location: locationStr,
                  state: stateData.abbr,
                  latitude: pLat,
                  longitude: pLng,
                  googlePlaceId: place.place_id,
                  googleRating: place.rating || null,
                  googleReviewCount: place.user_ratings_total || null,
                  imageUrl,
                  amenities: [],
                  description: '',
                },
              });
              stateImported++;
              progress.stage2_google_discover.imported++;
            } catch {}
          }

          // Also try next_page_token for more results
          if (data.next_page_token) {
            await delay(2000); // Google requires 2s delay before using token
            try {
              const nextUrl = `${GOOGLE_BASE}/textsearch/json?pagetoken=${data.next_page_token}&key=${GOOGLE_API_KEY}`;
              const nextRes = await fetch(nextUrl);
              const nextData = await nextRes.json() as any;

              if (nextData.status === 'OK' && nextData.results) {
                for (const place of nextData.results) {
                  const pLat = place.geometry?.location?.lat;
                  const pLng = place.geometry?.location?.lng;
                  if (!pLat || !pLng) continue;

                  const existing = await prisma.campground.findFirst({
                    where: {
                      AND: [
                        { latitude: { gte: pLat - 0.001, lte: pLat + 0.001 } },
                        { longitude: { gte: pLng - 0.001, lte: pLng + 0.001 } },
                      ],
                    },
                  });
                  if (existing) continue;

                  const nameMatch = await prisma.campground.findFirst({
                    where: { name: place.name, state: stateData.abbr },
                  });
                  if (nameMatch) continue;

                  const pAddr = place.formatted_address || '';
                  const pCity = pAddr.split(',')[0]?.trim() || '';

                  let pImageUrl: string | null = null;
                  if (place.photos?.[0]) {
                    pImageUrl = `${GOOGLE_BASE}/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
                  }

                  try {
                    await prisma.campground.create({
                      data: {
                        name: place.name,
                        location: pCity ? `${pCity}, ${stateData.abbr}` : stateData.abbr,
                        state: stateData.abbr,
                        latitude: pLat,
                        longitude: pLng,
                        googlePlaceId: place.place_id,
                        googleRating: place.rating || null,
                        googleReviewCount: place.user_ratings_total || null,
                        imageUrl: pImageUrl,
                        amenities: [],
                        description: '',
                      },
                    });
                    stateImported++;
                    progress.stage2_google_discover.imported++;
                  } catch {}
                }
              }
            } catch {}
          }

          await delay(200);
        } catch (e: any) {
          // Continue on error
        }
      }
    }

    console.log(`  ✅ ${stateName}: +${stateImported} campgrounds`);
    progress.stage2_google_discover.statesCompleted.push(stateData.abbr);
    saveProgress(progress);
  }

  progress.stage2_google_discover.completed = true;
  saveProgress(progress);
  console.log(`\n🏁 Stage 2 done: ${progress.stage2_google_discover.imported} campgrounds discovered via Google`);
}

// ═══════════════════════════════════════════════════════════════
// STAGE 3: Google Places Enrichment — full details for ALL campgrounds
// Gets: website, reviews (→ amenities/RV specs), editorial, photos, rating
// ═══════════════════════════════════════════════════════════════
async function stage3_Enrich(progress: Progress) {
  if (progress.stage3_enrich.completed) {
    console.log('✅ Stage 3 (Google Enrichment) already completed. Skipping.');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  STAGE 3: Google Places Enrichment (reviews, amenities, RV data)');
  console.log('═'.repeat(60));

  const batchSize = 500;
  let cursor = progress.stage3_enrich.lastId || undefined;
  let totalEnriched = progress.stage3_enrich.enriched;

  while (true) {
    // Find campgrounds that need enrichment
    const campgrounds = await prisma.campground.findMany({
      where: {
        OR: [
          { googlePlaceId: null },
          { hasShowers: null },
          { description: '' }, { description: null },
        ],
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: {
        id: true, name: true, state: true, location: true,
        latitude: true, longitude: true, googlePlaceId: true, amenities: true,
      },
    });

    if (campgrounds.length === 0) break;

    console.log(`\n📦 Enriching batch of ${campgrounds.length} (total done: ${totalEnriched})`);

    for (const cg of campgrounds) {
      try {
        let placeId = cg.googlePlaceId;
        let photoRef: string | null = null;

        // Find Google Place ID if missing
        if (!placeId) {
          const stateFull = STATE_ABBR_TO_NAME[cg.state || ''] || cg.state || '';
          const queries = [
            `${cg.name} ${stateFull}`,
            `${cg.name} campground ${stateFull}`,
            `${cg.name} ${cg.state}`,
          ];

          for (const q of queries) {
            const url = `${GOOGLE_BASE}/textsearch/json?query=${encodeURIComponent(q)}&key=${GOOGLE_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json() as any;
            if (data.status === 'OK' && data.results?.[0]) {
              placeId = data.results[0].place_id;
              photoRef = data.results[0].photos?.[0]?.photo_reference || null;
              break;
            }
            await delay(100);
          }
        }

        if (!placeId) { cursor = cg.id; continue; }

        // Get full Place Details
        const dUrl = `${GOOGLE_BASE}/details/json?place_id=${placeId}&fields=website,reviews,editorial_summary,photos,rating,user_ratings_total,formatted_phone_number&key=${GOOGLE_API_KEY}`;
        const dRes = await fetch(dUrl);
        const dData = await dRes.json() as any;

        if (dData.status !== 'OK' || !dData.result) {
          cursor = cg.id;
          await delay(100);
          continue;
        }

        const r = dData.result;

        // Gather all text for keyword analysis
        let allText = r.editorial_summary?.overview || '';
        if (r.reviews) {
          allText += ' ' + r.reviews.map((rv: any) => rv.text || '').join(' ');
        }

        const analysis = analyzeText(allText);
        const mergedAmenities = [...new Set([...(cg.amenities || []), ...analysis.amenities])];

        if (!photoRef && r.photos?.[0]) photoRef = r.photos[0].photo_reference;

        // Build update
        const updateData: any = {
          googlePlaceId: placeId,
          googleRating: r.rating || undefined,
          googleReviewCount: r.user_ratings_total || undefined,
          amenities: mergedAmenities,
        };

        if (r.website) updateData.websiteUrl = r.website;
        if (r.formatted_phone_number) updateData.phone = r.formatted_phone_number;
        if (r.editorial_summary?.overview) updateData.description = r.editorial_summary.overview;
        if (photoRef) {
          updateData.imageUrl = `${GOOGLE_BASE}/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;
        }

        // Apply all extracted boolean fields + specs
        for (const [field, val] of Object.entries(analysis.fields)) {
          updateData[field] = val;
        }
        if (analysis.maxRvLength) updateData.maxRvLength = analysis.maxRvLength;
        if (analysis.maxAmpService) updateData.maxAmpService = analysis.maxAmpService;
        if (analysis.pricePerNight) updateData.pricePerNight = analysis.pricePerNight;

        await prisma.campground.update({ where: { id: cg.id }, data: updateData });

        totalEnriched++;
        cursor = cg.id;
        progress.stage3_enrich.enriched = totalEnriched;
        progress.stage3_enrich.lastId = cursor;

        if (totalEnriched % 50 === 0) {
          console.log(`  📊 Enriched: ${totalEnriched}`);
          saveProgress(progress);
        }

        await delay(150);
      } catch (e: any) {
        cursor = cg.id;
      }
    }

    saveProgress(progress);
  }

  progress.stage3_enrich.completed = true;
  saveProgress(progress);
  console.log(`\n🏁 Stage 3 done: ${totalEnriched} campgrounds enriched`);
}

// ═══════════════════════════════════════════════════════════════
// STAGE 4: Upload Google Photos to Cloudinary
// (so photo URLs don't expire — Google refs expire after days)
// ═══════════════════════════════════════════════════════════════
async function stage4_Photos(progress: Progress) {
  if (progress.stage4_photos.completed) {
    console.log('✅ Stage 4 (Cloudinary Upload) already completed. Skipping.');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  STAGE 4: Upload Photos to Cloudinary');
  console.log('═'.repeat(60));

  let cursor = progress.stage4_photos.lastId || undefined;
  let uploaded = progress.stage4_photos.uploaded;
  const batchSize = 50;

  while (true) {
    const campgrounds = await prisma.campground.findMany({
      where: {
        imageUrl: { startsWith: 'https://maps.googleapis.com' },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: { id: true, name: true, imageUrl: true },
    });

    if (campgrounds.length === 0) break;

    console.log(`\n📷 Uploading batch of ${campgrounds.length} (total: ${uploaded})`);

    for (const cg of campgrounds) {
      try {
        if (!cg.imageUrl) continue;

        const cloudUrl = await uploadToCloudinary(cg.imageUrl, 'campgrounds');
        if (cloudUrl) {
          await prisma.campground.update({
            where: { id: cg.id },
            data: { imageUrl: cloudUrl },
          });
          uploaded++;
          progress.stage4_photos.uploaded = uploaded;
        }
        cursor = cg.id;
        progress.stage4_photos.lastId = cursor;

        if (uploaded % 25 === 0) {
          console.log(`  📊 Uploaded: ${uploaded}`);
          saveProgress(progress);
        }
        await delay(300);
      } catch { cursor = cg.id; }
    }

    saveProgress(progress);
  }

  progress.stage4_photos.completed = true;
  saveProgress(progress);
  console.log(`\n🏁 Stage 4 done: ${uploaded} photos uploaded to Cloudinary`);
}

// ═══════════════════════════════════════════════════════════════
// STAGE 5: Fix missing state codes via Google reverse geocoding
// ═══════════════════════════════════════════════════════════════
async function stage5_FixStates(progress: Progress) {
  if (progress.stage5_states.completed) {
    console.log('✅ Stage 5 (State Fix) already completed. Skipping.');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  STAGE 5: Fix Missing State Codes');
  console.log('═'.repeat(60));

  const campgrounds = await prisma.campground.findMany({
    where: {
      OR: [{ state: null }, { state: '' }, { state: 'Unknown' }],
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  console.log(`Found ${campgrounds.length} campgrounds needing state fix`);
  let fixed = progress.stage5_states.fixed;

  for (const cg of campgrounds) {
    if (!cg.latitude || !cg.longitude) continue;

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${cg.latitude},${cg.longitude}&key=${GOOGLE_API_KEY}&result_type=administrative_area_level_1`;
      const res = await fetch(url);
      const data = await res.json() as any;

      if (data.status === 'OK' && data.results?.[0]) {
        let stateCode = '';
        let city = '';
        for (const comp of (data.results[0].address_components || [])) {
          if (comp.types.includes('administrative_area_level_1')) stateCode = comp.short_name;
          if (comp.types.includes('locality')) city = comp.long_name;
        }
        if (stateCode) {
          await prisma.campground.update({
            where: { id: cg.id },
            data: { state: stateCode, location: city ? `${city}, ${stateCode}` : stateCode },
          });
          fixed++;
          progress.stage5_states.fixed = fixed;
        }
      }

      await delay(100);
      if (fixed % 25 === 0 && fixed > 0) {
        console.log(`  📊 Fixed: ${fixed}`);
        saveProgress(progress);
      }
    } catch {}
  }

  progress.stage5_states.completed = true;
  saveProgress(progress);
  console.log(`\n🏁 Stage 5 done: ${fixed} state codes fixed`);
}

// ═══════════════════════════════════════════════════════════════
// MAIN — runs all 5 stages in order, resuming where it left off
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  🏕️  RVUnicorn Master Campground Repopulation');
  console.log('═'.repeat(60));
  console.log('  Sources: Recreation.gov RIDB + Google Places + Cloudinary');
  console.log('  Stop anytime with Ctrl+C — progress is saved!\n');

  const startCount = await prisma.campground.count();
  console.log(`📊 Current campgrounds in database: ${startCount}`);

  const progress = loadProgress();

  await stage1_RIDB(progress);
  const c1 = await prisma.campground.count();
  console.log(`📊 Total after Stage 1: ${c1}`);

  await stage2_GoogleDiscover(progress);
  const c2 = await prisma.campground.count();
  console.log(`📊 Total after Stage 2: ${c2}`);

  await stage3_Enrich(progress);
  await stage4_Photos(progress);
  await stage5_FixStates(progress);

  // ═══════ FINAL REPORT ═══════
  const total = await prisma.campground.count();
  const withImg = await prisma.campground.count({ where: { imageUrl: { not: null } } });
  const withWeb = await prisma.campground.count({ where: { websiteUrl: { not: null } } });
  const withAmen = await prisma.campground.count({ where: { amenities: { isEmpty: false } } });
  const withGoogle = await prisma.campground.count({ where: { googlePlaceId: { not: null } } });
  const withHookup = await prisma.campground.count({ where: { hasFullHookups: { not: null } } });
  const top10 = await prisma.campground.groupBy({
    by: ['state'], _count: true,
    orderBy: { _count: { state: 'desc' } }, take: 10,
  });

  console.log('\n\n' + '═'.repeat(60));
  console.log('  🎉 REPOPULATION COMPLETE!');
  console.log('═'.repeat(60));
  console.log(`\n📊 Final Stats:`);
  console.log(`   Total campgrounds:   ${total}`);
  console.log(`   With images:         ${withImg} (${((withImg/total)*100).toFixed(1)}%)`);
  console.log(`   With websites:       ${withWeb} (${((withWeb/total)*100).toFixed(1)}%)`);
  console.log(`   With amenities:      ${withAmen} (${((withAmen/total)*100).toFixed(1)}%)`);
  console.log(`   With Google Place ID: ${withGoogle} (${((withGoogle/total)*100).toFixed(1)}%)`);
  console.log(`   With RV hookup data: ${withHookup} (${((withHookup/total)*100).toFixed(1)}%)`);
  console.log(`\n🏆 Top 10 States:`);
  for (const s of top10) {
    console.log(`   ${s.state || 'N/A'}: ${s._count}`);
  }
  console.log(`\n💾 Progress: ${PROGRESS_FILE} (delete to re-run from scratch)\n`);

  await prisma.$disconnect();
}

process.on('SIGINT', () => {
  console.log('\n\n⏸️  Interrupted! Progress saved. Run again to resume.');
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
