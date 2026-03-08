/**
 * Campspot Slug Matcher for RVUnicorn
 * 
 * Strategy (tiered for efficiency):
 *  1. Slug generation  - derive slug from name, check campspot.com/park/{slug} via HTTP
 *  2. Search scraping  - use Campspot's search page via Puppeteer for harder matches
 *  3. Fuzzy matching   - score candidates with fuse.js, require high confidence before writing
 * 
 * Progress is saved to campspot-progress.json so you can stop/resume at any time.
 * Matched slugs are written directly to your Railway DB.
 * 
 * Usage:
 *   node match-campspot-slugs.js              # run full match
 *   node match-campspot-slugs.js --dry-run    # preview matches without writing to DB
 *   node match-campspot-slugs.js --resume     # skip already-processed campgrounds
 *   node match-campspot-slugs.js --report     # print summary of progress file
 */

import pg from 'pg';
import Fuse from 'fuse.js';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:TjOdtmmhaqkBQsHjsoJvoNJMwLrmVWMC@crossover.proxy.rlwy.net:49565/railway';

const PROGRESS_FILE = path.join(__dirname, 'campspot-progress.json');
const REPORT_FILE   = path.join(__dirname, 'campspot-matches.json');

const CONCURRENCY   = 3;   // parallel Puppeteer tabs
const BATCH_SIZE    = 50;  // DB write batch size
const MIN_SCORE     = 0.72; // minimum fuse.js confidence to auto-accept (0-1)
const RATE_LIMIT_MS = 800;  // ms between requests to avoid rate limiting
const MAX_RESULTS   = 10;   // max Campspot search results to evaluate per campground

const DRY_RUN  = process.argv.includes('--dry-run');
const RESUME   = process.argv.includes('--resume');
const REPORT   = process.argv.includes('--report');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[''']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Generate slug candidates from a campground name */
function candidateSlugs(name) {
  const base = slugify(name);
  const candidates = [base];

  // Strip common prefixes
  for (const prefix of ['campspot-at-', 'rv-park-at-', 'the-']) {
    if (base.startsWith(prefix)) candidates.push(base.slice(prefix.length));
  }

  // Strip common suffixes
  for (const suffix of ['-rv-park', '-rv-resort', '-campground', '-campsite',
                         '-camp', '-camping', '-resort', '-park']) {
    if (base.endsWith(suffix)) candidates.push(base.slice(0, -suffix.length));
  }

  // Add suffix variants
  for (const suffix of ['-rv-park', '-campground', '-resort']) {
    if (!base.endsWith(suffix)) candidates.push(base + suffix);
  }

  return [...new Set(candidates)];
}

/** Check if a campspot.com/park/{slug} URL resolves (non-404) */
async function checkSlugExists(slug) {
  try {
    const res = await fetch(`https://www.campspot.com/park/${slug}`, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RVUnicorn/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    return res.status !== 404;
  } catch {
    return false;
  }
}

/** Fuzzy score between two strings (0=no match, 1=perfect) */
function nameScore(a, b) {
  const normalize = s => s.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const fuse = new Fuse([nb], { includeScore: true, threshold: 1 });
  const result = fuse.search(na);
  return result.length ? 1 - result[0].score : 0;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── PROGRESS FILE ────────────────────────────────────────────────────────────

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { processed: {}, matched: 0, noMatch: 0, skipped: 0, startedAt: new Date().toISOString() };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ─── CAMPSPOT SEARCH (PUPPETEER) ──────────────────────────────────────────────

async function searchCampspot(browser, query, state) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121 Safari/537.36'
    );

    const searchQuery = encodeURIComponent(`${query} ${state}`);
    await page.goto(
      `https://www.campspot.com/book/search?text=${searchQuery}&start=0&limit=${MAX_RESULTS}`,
      { waitUntil: 'networkidle2', timeout: 20000 }
    );

    // Try to extract JSON from __NEXT_DATA__ (Next.js SSR data)
    const nextData = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      return el ? el.textContent : null;
    });

    if (nextData) {
      try {
        const data = JSON.parse(nextData);
        const parks = data?.props?.pageProps?.initialResults?.parks ||
                      data?.props?.pageProps?.parks ||
                      [];
        return parks.map(p => ({
          name: p.name || p.parkName,
          slug: p.slug || p.urlSlug,
          city: p.city,
          state: p.state || p.stateAbbr,
        })).filter(p => p.slug);
      } catch {}
    }

    // Fallback: extract park links from DOM
    const results = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="/park/"]')];
      return links.map(a => {
        const slug = a.href.match(/\/park\/([^/?#]+)/)?.[1];
        const name = a.querySelector('h2,h3,[class*="name"],[class*="title"]')?.textContent?.trim()
                  || a.textContent?.trim();
        return { slug, name };
      }).filter(r => r.slug && r.name);
    });

    return [...new Map(results.map(r => [r.slug, r])).values()];
  } catch (err) {
    console.error(`  Search error for "${query}": ${err.message}`);
    return [];
  } finally {
    await page.close();
  }
}

// ─── MATCH A SINGLE CAMPGROUND ────────────────────────────────────────────────

async function matchCampground(browser, campground, progress) {
  const { id, name, city, state } = campground;

  // ── Tier 1: Slug generation + HEAD check ──
  const candidates = candidateSlugs(name);
  for (const slug of candidates) {
    const exists = await checkSlugExists(slug);
    if (exists) {
      console.log(`  ✅ SLUG HIT  [${name}] → ${slug}`);
      return { id, name, slug, method: 'slug', score: 0.95 };
    }
    await sleep(100);
  }

  // ── Tier 2: Campspot search + fuzzy match ──
  await sleep(RATE_LIMIT_MS);
  const searchResults = await searchCampspot(browser, name, state || '');

  if (searchResults.length === 0) {
    return { id, name, slug: null, method: 'search', score: 0 };
  }

  // Score each result: name similarity + state match bonus
  const scored = searchResults.map(r => {
    let score = nameScore(name, r.name || '');
    // Boost if state matches
    if (r.state && state && r.state.toUpperCase() === state.toUpperCase()) {
      score = Math.min(1, score + 0.08);
    }
    // Boost if city matches
    if (r.city && city && r.city.toLowerCase() === city.toLowerCase()) {
      score = Math.min(1, score + 0.05);
    }
    return { ...r, score };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (best.score >= MIN_SCORE) {
    console.log(
      `  ✅ SEARCH HIT [${name}] → ${best.slug} ` +
      `(matched: "${best.name}", score: ${best.score.toFixed(2)})`
    );
    return { id, name, slug: best.slug, method: 'search', score: best.score };
  }

  // Low confidence — log for manual review
  if (best.score >= 0.5) {
    console.log(
      `  ⚠️  LOW CONF  [${name}] best candidate: "${best.name}" (${best.slug}) ` +
      `score: ${best.score.toFixed(2)} — skipping`
    );
    return { id, name, slug: null, method: 'low_confidence', score: best.score,
             candidate: best.slug, candidateName: best.name };
  }

  return { id, name, slug: null, method: 'no_match', score: 0 };
}

// ─── DB OPERATIONS ────────────────────────────────────────────────────────────

async function fetchCampgrounds(client, resumeIds) {
  const where = resumeIds.size > 0
    ? `WHERE c."campspotSlug" IS NULL AND c.id NOT IN (${[...resumeIds].map((_, i) => `$${i+1}`).join(',')})`
    : `WHERE c."campspotSlug" IS NULL`;

  const { rows } = await client.query(
    `SELECT c.id, c.name, c.city, c.state
     FROM "Campground" c
     ${where}
     ORDER BY c.name
     LIMIT 15000`,
    resumeIds.size > 0 ? [...resumeIds] : []
  );
  return rows;
}

async function batchUpdateSlugs(client, matches) {
  if (matches.length === 0) return;
  const values = matches.map((m, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
  const params = matches.flatMap(m => [m.id, m.slug]);
  await client.query(
    `UPDATE "Campground" AS c
     SET "campspotSlug" = v.slug
     FROM (VALUES ${values}) AS v(id, slug)
     WHERE c.id = v.id`,
    params
  );
}

// ─── REPORT MODE ──────────────────────────────────────────────────────────────

function printReport() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    console.log('No progress file found. Run the matcher first.');
    return;
  }
  const progress = loadProgress();
  const total = Object.keys(progress.processed).length;
  const matched = Object.values(progress.processed).filter(p => p.slug).length;
  const lowConf = Object.values(progress.processed).filter(p => p.method === 'low_confidence').length;
  const noMatch = Object.values(progress.processed).filter(p => p.method === 'no_match').length;

  console.log('\n═══ Campspot Matching Report ═══');
  console.log(`Total processed : ${total}`);
  console.log(`Matched         : ${matched} (${((matched/total)*100).toFixed(1)}%)`);
  console.log(`Low confidence  : ${lowConf}`);
  console.log(`No match        : ${noMatch}`);
  console.log(`Started at      : ${progress.startedAt}`);
  console.log('\nLow confidence candidates (review manually):');

  const candidates = Object.values(progress.processed)
    .filter(p => p.method === 'low_confidence')
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  candidates.forEach(c => {
    console.log(`  ${c.name.padEnd(45)} → ${(c.candidate || '').padEnd(40)} score: ${c.score.toFixed(2)}`);
  });

  fs.writeFileSync(REPORT_FILE, JSON.stringify(
    Object.values(progress.processed).filter(p => p.method === 'low_confidence'),
    null, 2
  ));
  console.log(`\nFull low-confidence list saved to ${REPORT_FILE}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  if (REPORT) { printReport(); return; }

  console.log('═══ Campspot Slug Matcher ═══');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Resume: ${RESUME}`);
  console.log(`DB: ${DB_URL.replace(/:.*@/, ':***@')}\n`);

  const progress = loadProgress();
  const processedIds = new Set(Object.keys(progress.processed));

  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to database\n');

  const campgrounds = await fetchCampgrounds(client, RESUME ? processedIds : new Set());
  console.log(`Found ${campgrounds.length} campgrounds without a campspotSlug\n`);

  if (campgrounds.length === 0) {
    console.log('Nothing to process!');
    await client.end();
    return;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  console.log('✅ Browser launched\n');

  let pendingWrites = [];
  let totalMatched = 0;

  try {
    for (let i = 0; i < campgrounds.length; i++) {
      const cg = campgrounds[i];
      process.stdout.write(`[${i + 1}/${campgrounds.length}] ${cg.name} (${cg.state || '?'})...  `);

      const result = await matchCampground(browser, cg, progress);
      progress.processed[cg.id] = result;

      if (result.slug) {
        totalMatched++;
        if (!DRY_RUN) {
          pendingWrites.push(result);
          if (pendingWrites.length >= BATCH_SIZE) {
            await batchUpdateSlugs(client, pendingWrites);
            console.log(`  💾 Wrote ${pendingWrites.length} slugs to DB`);
            pendingWrites = [];
          }
        }
      }

      // Save progress every 25 campgrounds
      if ((i + 1) % 25 === 0) {
        saveProgress(progress);
        console.log(`\n  📊 Progress: ${i + 1}/${campgrounds.length} | Matched: ${totalMatched}\n`);
      }
    }

    // Final write
    if (!DRY_RUN && pendingWrites.length > 0) {
      await batchUpdateSlugs(client, pendingWrites);
      console.log(`\n  💾 Wrote final ${pendingWrites.length} slugs to DB`);
    }

    saveProgress(progress);

    console.log('\n═══ Complete ═══');
    console.log(`Processed : ${campgrounds.length}`);
    console.log(`Matched   : ${totalMatched} (${((totalMatched / campgrounds.length) * 100).toFixed(1)}%)`);
    console.log(`Dry run   : ${DRY_RUN ? 'YES — nothing written to DB' : 'NO — DB updated'}`);
    console.log(`\nRun with --report to see low-confidence candidates for manual review.`);

  } finally {
    await browser.close();
    await client.end();
    saveProgress(progress);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
