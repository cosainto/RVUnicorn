/**
 * Phase 1 — Recreation.gov pricing ingestion
 *
 * Recreation.gov publishes a free 561 MB bulk export at:
 *   https://ridb.recreation.gov/downloads/RIDBFullExport_V1_JSON.zip
 *
 * The export gives us FacilityID + name + lat/lng for ~5,669 federal
 * campgrounds (NPS, USFS, BLM, Army Corps, etc) but NO fee data.
 *
 * The fees ARE embedded as JSON-LD on each campground's public page:
 *   https://www.recreation.gov/camping/campgrounds/{FacilityID}
 *
 *   <script type="application/ld+json">
 *     { "@type": "Campground", ..., "makesOffer": { "price": "28.00", ... } }
 *
 * This script:
 *   1. Reads the bulk Facilities export from /tmp/Facilities_API_v1.json
 *      (downloaded once via the bulk URL above)
 *   2. For each Campground facility with coordinates, fetches the public
 *      page with a polite 250ms delay between requests
 *   3. Parses the JSON-LD block and reads makesOffer.price
 *   4. Matches the facility to an existing Campground row by:
 *        a) FacilityID extracted from existing websiteUrl, or
 *        b) lat/lng within 0.005 degrees + name fuzzy match
 *   5. Upserts pricePerNight on the matched row
 *
 * No API key, no Puppeteer, no AI extraction. Plain HTTP + JSON parse.
 *
 * Usage:
 *   npx tsx src/scripts/scrape-pricing-recreation-gov.ts             # full run
 *   npx tsx src/scripts/scrape-pricing-recreation-gov.ts --limit 50  # quick test
 *   npx tsx src/scripts/scrape-pricing-recreation-gov.ts --dry-run   # no DB writes
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const FACILITIES_PATH = '/tmp/Facilities_API_v1.json';
const RG_BASE = 'https://www.recreation.gov/camping/campgrounds';
const REQUEST_DELAY_MS = 250;
// Recreation.gov serves a stripped-down placeholder page to UAs that look
// bot-y. We identify ourselves but lead with Mozilla/5.0 so we get the
// same JSON-LD-bearing HTML a real browser would. Direct comparison test
// confirmed: pure "RVUnicornBot/1.0" returns 3.7KB stub; this UA returns
// the full 31KB page with the schema.org Campground block.
const USER_AGENT =
  'Mozilla/5.0 (compatible; RVUnicornBot/1.0; +https://www.rvunicorn.com/about/bot)';

interface RIDBFacility {
  FacilityID: string;
  FacilityName: string;
  FacilityTypeDescription: string;
  FacilityLatitude?: number;
  FacilityLongitude?: number;
  FacilityPhone?: string;
}

interface ScrapedPrice {
  facilityId: string;
  name: string;
  price: number | null;
  url: string;
  parsedAt: Date;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Levenshtein-based similarity for name matching, 0-1
function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.85;
  // Token-set overlap
  const ax = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const ay = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const inter = [...ax].filter(t => ay.has(t)).length;
  const union = new Set([...ax, ...ay]).size;
  return union > 0 ? inter / union : 0;
}

async function fetchFacilityPrice(facilityId: string): Promise<ScrapedPrice | null> {
  const url = `${RG_BASE}/${facilityId}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Pull all <script type="application/ld+json"> blocks; one of them is
    // the schema.org Campground object with makesOffer.price.
    const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    for (const block of blocks) {
      const jsonText = block.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '');
      try {
        const data = JSON.parse(jsonText);
        const candidates = Array.isArray(data) ? data : [data];
        for (const c of candidates) {
          if (c['@type'] === 'Campground' && c.makesOffer) {
            const offer = Array.isArray(c.makesOffer) ? c.makesOffer[0] : c.makesOffer;
            const priceStr = offer?.price;
            const price = priceStr ? parseFloat(String(priceStr)) : null;
            return {
              facilityId,
              name: c.name || '',
              price: price && !isNaN(price) ? price : null,
              url,
              parsedAt: new Date(),
            };
          }
        }
      } catch {
        // skip malformed JSON-LD blocks
      }
    }
    return null;
  } catch {
    return null;
  }
}

interface MatchResult {
  campgroundId: string;
  matchedBy: 'url' | 'coords+name' | 'name+state';
  similarity?: number;
}

// Try to match a RIDB facility to a Campground row in our DB
async function matchFacility(
  facility: RIDBFacility,
  byFacilityIdInUrl: Map<string, string>,
): Promise<MatchResult | null> {
  // Strategy 1 — FacilityID already in the existing websiteUrl
  const fromUrl = byFacilityIdInUrl.get(facility.FacilityID);
  if (fromUrl) {
    return { campgroundId: fromUrl, matchedBy: 'url' };
  }

  // Strategy 2 — lat/lng within 0.005 degrees AND name similarity >= 0.6
  if (facility.FacilityLatitude && facility.FacilityLongitude) {
    const candidates = await prisma.campground.findMany({
      where: {
        latitude: {
          gte: facility.FacilityLatitude - 0.005,
          lte: facility.FacilityLatitude + 0.005,
        },
        longitude: {
          gte: facility.FacilityLongitude - 0.005,
          lte: facility.FacilityLongitude + 0.005,
        },
      },
      select: { id: true, name: true },
      take: 10,
    });

    let best: { id: string; sim: number } | null = null;
    for (const c of candidates) {
      const sim = nameSimilarity(facility.FacilityName, c.name);
      if (sim > 0.6 && (!best || sim > best.sim)) {
        best = { id: c.id, sim };
      }
    }
    if (best) {
      return { campgroundId: best.id, matchedBy: 'coords+name', similarity: best.sim };
    }
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : Infinity;
  const dryRun = args.includes('--dry-run');
  const shuffle = args.includes('--shuffle');
  const offset = args.includes('--offset') ? parseInt(args[args.indexOf('--offset') + 1], 10) : 0;

  console.log(`[ridb-scrape] Starting (limit=${limit === Infinity ? 'all' : limit}, dry-run=${dryRun})`);

  if (!fs.existsSync(FACILITIES_PATH)) {
    console.error(`[ridb-scrape] Facilities export not found at ${FACILITIES_PATH}`);
    console.error('Download with:');
    console.error('  curl -L -o /tmp/ridb.zip https://ridb.recreation.gov/downloads/RIDBFullExport_V1_JSON.zip');
    console.error('  cd /tmp && unzip -o ridb.zip Facilities_API_v1.json');
    process.exit(1);
  }

  console.log('[ridb-scrape] Loading bulk Facilities export...');
  const raw = JSON.parse(fs.readFileSync(FACILITIES_PATH, 'utf-8'));
  const all: RIDBFacility[] = raw.RECDATA || [];
  let pool = all.filter(
    (f) => f.FacilityTypeDescription === 'Campground' && f.FacilityLatitude && f.FacilityLongitude,
  );
  if (shuffle) {
    // Deterministic-ish shuffle for sampling — same seed every run
    pool = pool
      .map((f, i) => ({ f, k: ((i * 2654435761) % 2 ** 32) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.f);
  }
  const campgrounds = pool.slice(offset, offset + (limit === Infinity ? pool.length : limit));
  console.log(`[ridb-scrape] ${campgrounds.length} campground facilities to process (pool=${pool.length}, offset=${offset}, shuffle=${shuffle})`);

  // Build a map of FacilityID -> Campground.id by parsing existing websiteUrl values
  console.log('[ridb-scrape] Indexing existing recreation.gov URLs in DB...');
  const dbWithRgUrls = await prisma.campground.findMany({
    where: { websiteUrl: { contains: 'recreation.gov/camping/campgrounds/' } },
    select: { id: true, websiteUrl: true },
  });
  const byFacilityIdInUrl = new Map<string, string>();
  for (const c of dbWithRgUrls) {
    const m = c.websiteUrl?.match(/\/camping\/campgrounds\/(\d+)/);
    if (m) byFacilityIdInUrl.set(m[1], c.id);
  }
  console.log(`[ridb-scrape] Pre-matched ${byFacilityIdInUrl.size} facilities by URL`);

  let scraped = 0;
  let priced = 0;
  let matched = 0;
  let updated = 0;
  let skipped = 0;
  const startedAt = Date.now();

  for (const facility of campgrounds) {
    scraped++;
    const result = await fetchFacilityPrice(facility.FacilityID);
    if (result?.price !== null && result?.price !== undefined) {
      priced++;
    } else {
      // No price on the page — could be reservation-only without a public fee,
      // or a permit-only site. Skip but keep the matched row in case we want
      // to enrich it later.
    }

    const match = await matchFacility(facility, byFacilityIdInUrl);
    if (match) {
      matched++;
      if (result?.price && !dryRun) {
        await prisma.campground.update({
          where: { id: match.campgroundId },
          data: {
            pricePerNight: result.price,
            websiteUrl: `${RG_BASE}/${facility.FacilityID}`,
            ...(facility.FacilityPhone ? { phone: facility.FacilityPhone } : {}),
          },
        });
        updated++;
      }
    } else {
      skipped++;
    }

    if (scraped % 25 === 0) {
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = scraped / elapsed;
      const eta = (campgrounds.length - scraped) / rate;
      console.log(
        `[ridb-scrape] ${scraped}/${campgrounds.length} | priced ${priced} | matched ${matched} | updated ${updated} | skipped ${skipped} | ${rate.toFixed(1)}/s | ETA ${Math.round(eta)}s`,
      );
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log('\n[ridb-scrape] DONE');
  console.log(`  Total processed:     ${scraped}`);
  console.log(`  Pages with a price:  ${priced}`);
  console.log(`  Matched to DB row:   ${matched}`);
  console.log(`  Updated in DB:       ${updated}${dryRun ? ' (DRY RUN — no writes)' : ''}`);
  console.log(`  Skipped (no match):  ${skipped}`);
  console.log(`  Elapsed:             ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[ridb-scrape] FATAL', e);
  process.exit(1);
});
