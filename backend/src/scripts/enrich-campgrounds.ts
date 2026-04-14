/**
 * RVUnicorn — Campground Mega Enrichment Script
 * ================================================
 * 
 * Stage 1: Clean summer camps / sleep-away camps from DB
 * Stage 2: Discover new campgrounds from The Dyrt (all 50 states)
 * Stage 3: Enrich all campgrounds with amenities from Google Places
 * Stage 4: Scrape photos from campground websites → Cloudinary → CampgroundPhoto
 * Stage 5: Scrape campground maps → Cloudinary
 * 
 * Progress saved after each stage. Ctrl+C safe.
 * 
 * Run: npx tsx src/scripts/enrich-campgrounds.ts
 * 
 * Requires: puppeteer (npm install puppeteer)
 */

import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient() as any;
const PROGRESS_FILE = path.join(__dirname, 'enrich-progress.json');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dy6eetmh7',
  api_key: process.env.CLOUDINARY_API_KEY || '333927774328418',
  api_secret: process.env.CLOUDINARY_API_SECRET || '9phbOjjX2YxVI43orwmWdoiCvew',
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
// SUMMER CAMP FILTER TERMS
// ═══════════════════════════════════════════════════════════
const SUMMER_CAMP_TERMS = [
  /\bsummer camp\b/i,
  /\bsleep.?away\b/i,
  /\bday camp\b/i,
  /\bcamp .*(kids|children|youth|teen|boys|girls)\b/i,
  /\b(kids|children|youth|teen|boys|girls) camp\b/i,
  /\bchurch camp\b/i,
  /\bbible camp\b/i,
  /\bscout camp\b/i,
  /\bband camp\b/i,
  /\bcheer camp\b/i,
  /\bsports camp\b/i,
  /\bbasketball camp\b/i,
  /\bsoccer camp\b/i,
  /\bfootball camp\b/i,
  /\bswim camp\b/i,
  /\bart camp\b/i,
  /\bmusic camp\b/i,
  /\btheater camp\b/i,
  /\btheatre camp\b/i,
  /\bdance camp\b/i,
  /\bcoding camp\b/i,
  /\bSTEM camp\b/i,
  /\bweight loss camp\b/i,
  /\bfitness camp\b/i,
  /\bboot camp\b/i,
  /\bcamp .*academy\b/i,
  /\bcamp .*school\b/i,
  /\bovernight camp\b/i,
  /\bresident(ial)? camp\b/i,
  /\bJCC camp\b/i,
  /\bYMCA camp\b/i,
  /\b4-?H camp\b/i,
];

function isSummerCamp(name: string, description?: string | null): boolean {
  const text = `${name} ${description || ''}`;
  return SUMMER_CAMP_TERMS.some(re => re.test(text));
}

// ═══════════════════════════════════════════════════════════
// STATE HELPERS
// ═══════════════════════════════════════════════════════════
const STATE_SLUGS: Record<string, string> = {
  'AL': 'alabama', 'AK': 'alaska', 'AZ': 'arizona', 'AR': 'arkansas', 'CA': 'california',
  'CO': 'colorado', 'CT': 'connecticut', 'DE': 'delaware', 'FL': 'florida', 'GA': 'georgia',
  'HI': 'hawaii', 'ID': 'idaho', 'IL': 'illinois', 'IN': 'indiana', 'IA': 'iowa',
  'KS': 'kansas', 'KY': 'kentucky', 'LA': 'louisiana', 'ME': 'maine', 'MD': 'maryland',
  'MA': 'massachusetts', 'MI': 'michigan', 'MN': 'minnesota', 'MS': 'mississippi', 'MO': 'missouri',
  'MT': 'montana', 'NE': 'nebraska', 'NV': 'nevada', 'NH': 'new-hampshire', 'NJ': 'new-jersey',
  'NM': 'new-mexico', 'NY': 'new-york', 'NC': 'north-carolina', 'ND': 'north-dakota', 'OH': 'ohio',
  'OK': 'oklahoma', 'OR': 'oregon', 'PA': 'pennsylvania', 'RI': 'rhode-island', 'SC': 'south-carolina',
  'SD': 'south-dakota', 'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah', 'VT': 'vermont',
  'VA': 'virginia', 'WA': 'washington', 'WV': 'west-virginia', 'WI': 'wisconsin', 'WY': 'wyoming',
};

// ═══════════════════════════════════════════════════════════
// PROGRESS TRACKING
// ═══════════════════════════════════════════════════════════
interface Progress {
  stage1_clean: { completed: boolean; removed: number };
  stage2_discover: { completed: boolean; statesCompleted: string[]; added: number };
  stage3_amenities: { completed: boolean; lastId: string | null; enriched: number };
  stage4_photos: { completed: boolean; lastId: string | null; scraped: number; uploaded: number };
  stage5_maps: { completed: boolean; lastId: string | null; found: number };
  systemUserId: string | null;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {}
  return {
    stage1_clean: { completed: false, removed: 0 },
    stage2_discover: { completed: false, statesCompleted: [], added: 0 },
    stage3_amenities: { completed: false, lastId: null, enriched: 0 },
    stage4_photos: { completed: false, lastId: null, scraped: 0, uploaded: 0 },
    stage5_maps: { completed: false, lastId: null, found: 0 },
    systemUserId: null,
  };
}

function saveProgress(p: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

async function ensureSystemUser(progress: Progress): Promise<string> {
  if (progress.systemUserId) {
    const exists = await prisma.user.findUnique({ where: { id: progress.systemUserId } });
    if (exists) return progress.systemUserId;
  }
  let sys = await prisma.user.findFirst({ where: { username: 'rvunicorn-system' } });
  if (!sys) {
    sys = await prisma.user.create({
      data: { email: 'system@rvunicorn.com', username: 'rvunicorn-system', firstName: 'RVUnicorn', lastName: 'System', password: 'SYSTEM_NO_LOGIN_' + Date.now() },
    });
  }
  progress.systemUserId = sys.id;
  saveProgress(progress);
  return sys.id;
}

// ═══════════════════════════════════════════════════════════
// STAGE 1: Remove summer camps / sleep-away camps
// ═══════════════════════════════════════════════════════════
async function stage1(progress: Progress) {
  if (progress.stage1_clean.completed) {
    console.log('  ✅ Stage 1 already completed');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Stage 1: Cleaning summer/sleep-away camps');
  console.log('═'.repeat(60));

  const allCamps = await prisma.campground.findMany({
    select: { id: true, name: true, description: true },
  });

  console.log(`  Scanning ${allCamps.length} campgrounds...`);

  const toRemove: string[] = [];
  for (const c of allCamps) {
    if (isSummerCamp(c.name, c.description)) {
      toRemove.push(c.id);
      if (toRemove.length <= 20) {
        console.log(`  🗑️  ${c.name}`);
      }
    }
  }

  console.log(`  Found ${toRemove.length} summer/sleep-away camps to remove`);

  if (toRemove.length > 0) {
    // Delete related records first
    for (const id of toRemove) {
      try {
        await prisma.campgroundPhoto.deleteMany({ where: { campgroundId: id } });
        await prisma.campground.delete({ where: { id } });
      } catch (e: any) {
        // Skip if cascade handles it or already deleted
      }
    }
    console.log(`  ✅ Removed ${toRemove.length} non-campground entries`);
  }

  progress.stage1_clean = { completed: true, removed: toRemove.length };
  saveProgress(progress);
}

// ═══════════════════════════════════════════════════════════
// STAGE 2: Discover new campgrounds from The Dyrt
// ═══════════════════════════════════════════════════════════
async function stage2(progress: Progress) {
  if (progress.stage2_discover.completed) {
    console.log('  ✅ Stage 2 already completed');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Stage 2: Discovering new campgrounds from The Dyrt');
  console.log('═'.repeat(60));

  const systemUserId = await ensureSystemUser(progress);

  for (const [stateCode, stateSlug] of Object.entries(STATE_SLUGS)) {
    if (progress.stage2_discover.statesCompleted.includes(stateCode)) continue;

    console.log(`\n  📍 ${stateCode} (${stateSlug})...`);

    // Get existing campground names for dedup
    const existing = await prisma.campground.findMany({
      where: { state: stateCode },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((c: any) => c.name.toLowerCase().trim()));

    let page = 0;
    let stateAdded = 0;

    while (page < 20) { // Max 20 pages per state
      try {
        // The Dyrt API-like endpoint
        const url = `https://thedyrt.com/api/v6/campgrounds?filter[search][state]=${stateSlug}&page[number]=${page}&page[size]=50&sort=recommended`;
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        });

        if (!res.ok) {
          // Try alternative URL format
          const altUrl = `https://thedyrt.com/api/v6/autocomplete/campgrounds?q=campground+${stateSlug.replace(/-/g, '+')}`;
          const altRes = await fetch(altUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
          });
          if (!altRes.ok) break;
          const altData: any = await altRes.json();
          // Process alternative results
          const results = altData.data || altData.results || altData || [];
          if (!Array.isArray(results) || results.length === 0) break;
          
          for (const camp of results) {
            const name = camp.name || camp.attributes?.name;
            const lat = camp.latitude || camp.attributes?.latitude;
            const lng = camp.longitude || camp.attributes?.longitude;
            if (!name || !lat || !lng) continue;
            if (existingNames.has(name.toLowerCase().trim())) continue;
            if (isSummerCamp(name, camp.description || camp.attributes?.description)) continue;

            try {
              await prisma.campground.create({
                data: {
                  name: name.trim(),
                  state: stateCode,
                  latitude: parseFloat(lat),
                  longitude: parseFloat(lng),
                  location: camp.address || camp.attributes?.address || `${name}, ${stateCode}`,
                  description: camp.description || camp.attributes?.description || null,
                  websiteUrl: camp.website || camp.attributes?.website || null,
                  source: 'thedyrt',
                },
              });
              existingNames.add(name.toLowerCase().trim());
              stateAdded++;
              progress.stage2_discover.added++;
            } catch {}
          }
          break; // Alt endpoint doesn't paginate well
        }

        const data: any = await res.json();
        const campgrounds = data.data || data.results || data.campgrounds || [];
        if (!Array.isArray(campgrounds) || campgrounds.length === 0) break;

        for (const camp of campgrounds) {
          const attrs = camp.attributes || camp;
          const name = attrs.name || camp.name;
          const lat = attrs.latitude || camp.latitude;
          const lng = attrs.longitude || camp.longitude;

          if (!name || !lat || !lng) continue;
          if (existingNames.has(name.toLowerCase().trim())) continue;
          if (isSummerCamp(name, attrs.description)) continue;

          try {
            const amenities: string[] = [];
            if (attrs.has_electric_hookup || attrs.electric_hookup) amenities.push('Electric Hookups');
            if (attrs.has_water_hookup || attrs.water_hookup) amenities.push('Water Hookups');
            if (attrs.has_sewer_hookup || attrs.sewer_hookup) amenities.push('Sewer Hookups');
            if (attrs.has_showers || attrs.showers) amenities.push('Showers');
            if (attrs.has_restrooms || attrs.restrooms) amenities.push('Restrooms');
            if (attrs.has_wifi || attrs.wifi) amenities.push('WiFi');
            if (attrs.has_laundry || attrs.laundry) amenities.push('Laundry');
            if (attrs.has_store || attrs.store) amenities.push('Camp Store');
            if (attrs.has_swimming || attrs.swimming) amenities.push('Swimming');
            if (attrs.has_fishing || attrs.fishing) amenities.push('Fishing');
            if (attrs.has_hiking || attrs.hiking) amenities.push('Hiking');
            if (attrs.pets_allowed || attrs.has_pets) amenities.push('Pets Allowed');

            const imageUrl = attrs.photo_url || attrs.primary_photo_url || attrs.thumbnail_url || null;

            await prisma.campground.create({
              data: {
                name: name.trim(),
                state: stateCode,
                latitude: parseFloat(lat),
                longitude: parseFloat(lng),
                location: attrs.address || attrs.full_address || `${name}, ${stateCode}`,
                description: attrs.description || null,
                websiteUrl: attrs.website || attrs.external_url || null,
                phoneNumber: attrs.phone || attrs.phone_number || null,
                source: 'thedyrt',
                amenities,
                hasElectric: attrs.has_electric_hookup || attrs.electric_hookup || null,
                hasWater: attrs.has_water_hookup || attrs.water_hookup || null,
                hasSewer: attrs.has_sewer_hookup || attrs.sewer_hookup || null,
                hasShowers: attrs.has_showers || attrs.showers || null,
                hasRestrooms: attrs.has_restrooms || attrs.restrooms || null,
                hasWifi: attrs.has_wifi || attrs.wifi || null,
                petsAllowed: attrs.pets_allowed || null,
                hasFullHookups: (attrs.has_electric_hookup && attrs.has_water_hookup && attrs.has_sewer_hookup) || null,
                imageUrl,
              },
            });
            existingNames.add(name.toLowerCase().trim());
            stateAdded++;
            progress.stage2_discover.added++;
          } catch {}
        }

        page++;
        await delay(1500); // Rate limit
      } catch (e: any) {
        console.log(`    Error on page ${page}: ${e.message}`);
        break;
      }
    }

    console.log(`    +${stateAdded} new campgrounds`);
    progress.stage2_discover.statesCompleted.push(stateCode);
    saveProgress(progress);
  }

  progress.stage2_discover.completed = true;
  saveProgress(progress);
  console.log(`\n  ✅ Stage 2 complete: ${progress.stage2_discover.added} new campgrounds added`);
}

// ═══════════════════════════════════════════════════════════
// STAGE 3: Enrich with Google Places amenities
// ═══════════════════════════════════════════════════════════
async function stage3(progress: Progress) {
  if (progress.stage3_amenities.completed) {
    console.log('  ✅ Stage 3 already completed');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Stage 3: Enriching amenities via Google Places');
  console.log('═'.repeat(60));

  const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) {
    console.log('  ⚠️ No GOOGLE_API_KEY found in .env, skipping Stage 3');
    progress.stage3_amenities.completed = true;
    saveProgress(progress);
    return;
  }

  const where: any = {
    amenities: { isEmpty: true },
  };
  if (progress.stage3_amenities.lastId) {
    where.id = { gt: progress.stage3_amenities.lastId };
  }

  const campgrounds = await prisma.campground.findMany({
    where,
    orderBy: { id: 'asc' },
    select: { id: true, name: true, state: true, latitude: true, longitude: true },
    take: 10000,
  });

  console.log(`  ${campgrounds.length} campgrounds need amenity enrichment`);

  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];

    try {
      // Use Place Search to find the campground
      const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(camp.name + ' ' + (camp.state || ''))}&inputtype=textquery&fields=place_id&locationbias=point:${camp.latitude},${camp.longitude}&key=${GOOGLE_API_KEY}`;
      const searchRes = await fetch(searchUrl);
      const searchData: any = await searchRes.json() as any;

      if (searchData.candidates && searchData.candidates.length > 0) {
        const placeId = searchData.candidates[0].place_id;

        // Get Place Details
        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,website,opening_hours,rating,user_ratings_total,reviews,types,formatted_address&key=${GOOGLE_API_KEY}`;
        const detailRes = await fetch(detailUrl);
        const detailData: any = await detailRes.json() as any;
        const place = detailData.result;

        if (place) {
          const updateData: any = {};

          if (place.formatted_phone_number && !camp.name) {
            updateData.phoneNumber = place.formatted_phone_number;
          }
          if (place.website) updateData.websiteUrl = place.website;
          if (place.rating) updateData.rating = place.rating;
          if (place.user_ratings_total) updateData.reviewCount = place.user_ratings_total;

          // Extract amenities from reviews text
          const reviewText = (place.reviews || []).map((r: any) => r.text).join(' ').toLowerCase();
          const amenities: string[] = [];

          if (/\b(full hook.?up|full service)\b/i.test(reviewText)) amenities.push('Full Hookups');
          if (/\b(electric|30.?amp|50.?amp|power)\b/i.test(reviewText)) amenities.push('Electric Hookups');
          if (/\b(water hook.?up|city water|potable water)\b/i.test(reviewText)) amenities.push('Water Hookups');
          if (/\b(sewer|dump station)\b/i.test(reviewText)) amenities.push('Dump Station');
          if (/\b(shower|bath house)\b/i.test(reviewText)) amenities.push('Showers');
          if (/\b(restroom|bathroom|toilet)\b/i.test(reviewText)) amenities.push('Restrooms');
          if (/\b(wi-?fi|wifi|internet)\b/i.test(reviewText)) amenities.push('WiFi');
          if (/\b(laundry|washer|dryer)\b/i.test(reviewText)) amenities.push('Laundry');
          if (/\b(store|camp store|general store)\b/i.test(reviewText)) amenities.push('Camp Store');
          if (/\b(pool|swimming pool)\b/i.test(reviewText)) amenities.push('Swimming Pool');
          if (/\b(playground|play area)\b/i.test(reviewText)) amenities.push('Playground');
          if (/\b(dog|pet.?friendly|pets? (allowed|welcome))\b/i.test(reviewText)) amenities.push('Pets Allowed');
          if (/\b(pull.?through|drive.?through)\b/i.test(reviewText)) amenities.push('Pull-Through Sites');
          if (/\b(big.?rig|large rv|40.?f(oo)?t|45.?f(oo)?t)\b/i.test(reviewText)) amenities.push('Big Rig Friendly');
          if (/\b(fishing|fish)\b/i.test(reviewText)) amenities.push('Fishing');
          if (/\b(hiking|trail)\b/i.test(reviewText)) amenities.push('Hiking');
          if (/\b(kayak|canoe|boat)\b/i.test(reviewText)) amenities.push('Boating');
          if (/\b(fire.?pit|campfire|fire ring)\b/i.test(reviewText)) amenities.push('Fire Pits');
          if (/\b(picnic|picnic table)\b/i.test(reviewText)) amenities.push('Picnic Tables');

          if (amenities.length > 0) updateData.amenities = amenities;

          // RV-specific fields from reviews
          if (/\bfull hook.?up/i.test(reviewText)) updateData.hasFullHookups = true;
          if (/\b(shower)/i.test(reviewText)) updateData.hasShowers = true;
          if (/\b(restroom|bathroom)/i.test(reviewText)) updateData.hasRestrooms = true;
          if (/\b(wi-?fi|wifi)/i.test(reviewText)) updateData.hasWifi = true;
          if (/\b(pull.?through)/i.test(reviewText)) updateData.hasPullThrough = true;
          if (/\b(big.?rig)/i.test(reviewText)) updateData.isBigRigFriendly = true;
          if (/\b(pet|dog).*(allowed|friendly|welcome)/i.test(reviewText)) updateData.petsAllowed = true;

          const ampMatch = reviewText.match(/\b(50|30)\s*amp/i);
          if (ampMatch) updateData.maxAmpService = parseInt(ampMatch[1]);

          const lengthMatch = reviewText.match(/\b(\d{2,3})\s*f(oo)?t\b/);
          if (lengthMatch) {
            const len = parseInt(lengthMatch[1]);
            if (len >= 20 && len <= 120) updateData.maxRvLength = len;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.campground.update({ where: { id: camp.id }, data: updateData });
            progress.stage3_amenities.enriched++;
          }
        }
      }

      progress.stage3_amenities.lastId = camp.id;
      if ((i + 1) % 100 === 0) {
        saveProgress(progress);
        console.log(`  Progress: ${i + 1}/${campgrounds.length} | Enriched: ${progress.stage3_amenities.enriched}`);
      }
      await delay(200);
    } catch (e: any) {
      // Skip failures
    }
  }

  progress.stage3_amenities.completed = true;
  saveProgress(progress);
  console.log(`\n  ✅ Stage 3 complete: ${progress.stage3_amenities.enriched} campgrounds enriched`);
}

// ═══════════════════════════════════════════════════════════
// STAGE 4: Scrape photos from campground websites
// ═══════════════════════════════════════════════════════════
async function stage4(progress: Progress) {
  if (progress.stage4_photos.completed) {
    console.log('  ✅ Stage 4 already completed');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Stage 4: Scraping photos from campground websites');
  console.log('═'.repeat(60));

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.log('  ⚠️ Puppeteer not installed. Run: npm install puppeteer');
    console.log('  Skipping Stage 4');
    progress.stage4_photos.completed = true;
    saveProgress(progress);
    return;
  }

  const systemUserId = await ensureSystemUser(progress);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const EXCLUDE_PATTERNS = [
    /logo/i, /icon/i, /favicon/i, /sprite/i, /button/i, /avatar/i, /badge/i,
    /facebook/i, /twitter/i, /instagram/i, /youtube/i, /pinterest/i, /google/i,
    /payment/i, /visa/i, /mastercard/i, /paypal/i, /\.gif$/i, /\.svg$/i,
    /data:image/i, /placeholder/i, /spinner/i, /arrow/i, /1x1/i, /spacer/i,
    /advertisement/i, /tracking/i, /analytics/i,
  ];

  const where: any = {
    websiteUrl: { not: null },
    photos: { none: {} }, // Only campgrounds without photos in CampgroundPhoto table
  };
  if (progress.stage4_photos.lastId) {
    where.id = { gt: progress.stage4_photos.lastId };
  }

  // Get campgrounds that have a website but only 1 or fewer photos
  const campgrounds = await prisma.campground.findMany({
    where,
    orderBy: { id: 'asc' },
    select: { id: true, name: true, websiteUrl: true },
    take: 5000,
  });

  console.log(`  ${campgrounds.length} campgrounds need photos`);

  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];
    const page = await browser.newPage();

    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.goto(camp.websiteUrl, { waitUntil: 'networkidle2', timeout: 20000 });
      await delay(2000);

      // Extract images
      const images: string[] = await page.evaluate(() => {
        const imgs: string[] = [];
        document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
          if (img.src && img.src.startsWith('http') && img.naturalWidth >= 300 && img.naturalHeight >= 200) {
            imgs.push(img.src);
          }
        });
        // Also check CSS background images
        document.querySelectorAll('[style*="background"]').forEach(el => {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundImage;
          const match = bg.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
          if (match) imgs.push(match[1]);
        });
        return imgs;
      });

      // Filter and upload up to 8 photos
      const validImages = images.filter(url => !EXCLUDE_PATTERNS.some(p => p.test(url)));
      const uniqueImages = [...new Set(validImages)].slice(0, 8);

      let uploaded = 0;
      for (const imgUrl of uniqueImages) {
        try {
          const result = await cloudinary.uploader.upload(imgUrl, {
            folder: `campgrounds/${camp.id}`,
            resource_type: 'image',
            timeout: 30000,
            transformation: [{ width: 1920, height: 1080, crop: 'limit' }, { quality: 'auto:good' }],
          });

          await prisma.campgroundPhoto.create({
            data: {
              campgroundId: camp.id,
              userId: systemUserId,
              imageUrl: result.secure_url,
              status: 'APPROVED',
            },
          });

          // Set first photo as main imageUrl if not set
          if (uploaded === 0) {
            await prisma.campground.update({
              where: { id: camp.id },
              data: { imageUrl: result.secure_url },
            });
          }

          uploaded++;
          progress.stage4_photos.uploaded++;
        } catch {}
      }

      if (uploaded > 0) {
        progress.stage4_photos.scraped++;
      }

      progress.stage4_photos.lastId = camp.id;
      if ((i + 1) % 25 === 0) {
        saveProgress(progress);
        console.log(`  Progress: ${i + 1}/${campgrounds.length} | Scraped: ${progress.stage4_photos.scraped} | Photos: ${progress.stage4_photos.uploaded}`);
      }
    } catch {
      progress.stage4_photos.lastId = camp.id;
    } finally {
      await page.close();
    }

    await delay(500);
  }

  await browser.close();
  progress.stage4_photos.completed = true;
  saveProgress(progress);
  console.log(`\n  ✅ Stage 4 complete: ${progress.stage4_photos.scraped} campgrounds, ${progress.stage4_photos.uploaded} photos`);
}

// ═══════════════════════════════════════════════════════════
// STAGE 5: Find and save campground maps
// ═══════════════════════════════════════════════════════════
async function stage5(progress: Progress) {
  if (progress.stage5_maps.completed) {
    console.log('  ✅ Stage 5 already completed');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Stage 5: Finding campground maps');
  console.log('═'.repeat(60));

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.log('  ⚠️ Puppeteer not installed. Skipping Stage 5');
    progress.stage5_maps.completed = true;
    saveProgress(progress);
    return;
  }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const where: any = {
    websiteUrl: { not: null },
    campgroundMapUrl: null,
  };
  if (progress.stage5_maps.lastId) {
    where.id = { gt: progress.stage5_maps.lastId };
  }

  const campgrounds = await prisma.campground.findMany({
    where,
    orderBy: { id: 'asc' },
    select: { id: true, name: true, websiteUrl: true },
    take: 5000,
  });

  console.log(`  ${campgrounds.length} campgrounds need map discovery`);

  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];
    const page = await browser.newPage();

    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      await page.goto(camp.websiteUrl, { waitUntil: 'networkidle2', timeout: 20000 });

      // Look for map links
      const mapUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          const href = link.href?.toLowerCase() || '';
          const text = link.textContent?.toLowerCase() || '';
          if ((text.includes('map') || text.includes('site map') || text.includes('campground map') || text.includes('park map')) &&
              (href.endsWith('.pdf') || href.endsWith('.jpg') || href.endsWith('.png') || href.includes('map'))) {
            return link.href;
          }
        }
        // Check for map images
        const imgs = Array.from(document.querySelectorAll('img'));
        for (const img of imgs) {
          const alt = img.alt?.toLowerCase() || '';
          const src = img.src?.toLowerCase() || '';
          if ((alt.includes('map') || alt.includes('site map') || src.includes('map')) && img.naturalWidth > 500) {
            return img.src;
          }
        }
        return null;
      });

      if (mapUrl) {
        // Upload map to Cloudinary
        try {
          const isPdf = mapUrl.toLowerCase().endsWith('.pdf');
          const result = await cloudinary.uploader.upload(mapUrl, {
            folder: 'rvunicorn/campground-maps',
            public_id: camp.id,
            resource_type: isPdf ? 'raw' : 'image',
            timeout: 60000,
          });

          await prisma.campground.update({
            where: { id: camp.id },
            data: { campgroundMapUrl: result.secure_url },
          });
          progress.stage5_maps.found++;
        } catch {}
      }

      progress.stage5_maps.lastId = camp.id;
      if ((i + 1) % 50 === 0) {
        saveProgress(progress);
        console.log(`  Progress: ${i + 1}/${campgrounds.length} | Maps found: ${progress.stage5_maps.found}`);
      }
    } catch {
      progress.stage5_maps.lastId = camp.id;
    } finally {
      await page.close();
    }

    await delay(500);
  }

  await browser.close();
  progress.stage5_maps.completed = true;
  saveProgress(progress);
  console.log(`\n  ✅ Stage 5 complete: ${progress.stage5_maps.found} maps found`);
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🏕️  RVUnicorn Campground Mega Enrichment');
  console.log('═'.repeat(60));

  const progress = loadProgress();

  // Show current DB stats
  const total = await prisma.campground.count();
  const withPhotos = await prisma.campgroundPhoto.groupBy({ by: ['campgroundId'] });
  const withAmenities = await prisma.campground.count({ where: { amenities: { isEmpty: false } } });
  console.log(`\n  Current: ${total} campgrounds | ${withPhotos.length} with photos | ${withAmenities} with amenities`);

  await stage1(progress);
  await stage2(progress);
  await stage3(progress);
  await stage4(progress);
  await stage5(progress);

  // Final stats
  const finalTotal = await prisma.campground.count();
  const finalPhotos = await prisma.campgroundPhoto.count();
  const finalAmenities = await prisma.campground.count({ where: { amenities: { isEmpty: false } } });

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ ALL STAGES COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Campgrounds: ${finalTotal}`);
  console.log(`  Photos: ${finalPhotos}`);
  console.log(`  With amenities: ${finalAmenities}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
