/**
 * Phase 2 + Phase 3 — Generic pricing scraper for non-Recreation.gov campgrounds
 *
 * For every Campground with a websiteUrl that isn't already covered by
 * Phase 1 (recreation.gov), this script:
 *
 *   1. Fetches the campground's home page with polite throttling
 *   2. Detects which reservation engine the site uses (Phase 2)
 *   3. Tries the engine-specific extractor first (high accuracy when match)
 *   4. Falls back to a generic dollar-amount-near-night regex
 *   5. Falls back to Anthropic Claude Haiku as a last resort (Phase 3)
 *      — only when the visible HTML clearly mentions per-night pricing
 *      and only when --use-ai is passed
 *
 * Safety rails:
 *
 *   - Default limit is 25 sites unless --confirm-large is passed
 *   - --use-ai is opt-in for the AI fallback (each call costs ~$0.001)
 *   - Sites are randomized with --shuffle so a small batch is representative
 *   - --dry-run skips DB writes
 *   - User-Agent identifies us honestly + links to a bot-info page
 *   - 500ms delay between sites by default (slower than RIDB script — sites
 *     are independent and we want to be gentle)
 *
 * Usage:
 *   npx tsx src/scripts/scrape-pricing-generic.ts --limit 25 --shuffle --dry-run
 *   npx tsx src/scripts/scrape-pricing-generic.ts --limit 100 --use-ai --shuffle
 *   npx tsx src/scripts/scrape-pricing-generic.ts --confirm-large --use-ai
 *      (^ runs on EVERY uncovered site — only with explicit confirmation)
 */

import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { detectEngine, extractPriceFromHtml, PricingEngine } from '../services/pricing-engines.service';

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const REQUEST_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 15000;
const SAFETY_DEFAULT_LIMIT = 25;
const USER_AGENT =
  'Mozilla/5.0 (compatible; RVUnicornBot/1.0; +https://www.rvunicorn.com/about/bot)';

interface ScrapeResult {
  campgroundId: string;
  name: string;
  url: string;
  engine: PricingEngine;
  price: number | null;
  source: 'engine' | 'generic' | 'ai' | null;
  reason?: string;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Last-resort AI extraction. Only called when neither the engine-specific
 * extractor nor the generic regex found a price, AND the HTML mentions
 * per-night pricing (so we don't waste tokens on pages that have nothing).
 *
 * We strip the HTML to a small relevant snippet before sending to keep
 * the prompt tight (Claude Haiku token cost stays around $0.001/page).
 */
async function extractWithAI(html: string, name: string): Promise<number | null> {
  // Pull a window around any "$XX/night" or "per night" mention
  const lower = html.toLowerCase();
  const idx = lower.search(/per\s*night|nightly|\/\s*night|a\s*night/);
  if (idx < 0) return null;

  const start = Math.max(0, idx - 800);
  const end = Math.min(html.length, idx + 800);
  const snippet = html.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (snippet.length < 50) return null;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      system:
        'You extract starting nightly rates from campground websites. Return ONLY a number (e.g. 45 or 32.50). If multiple rates appear, return the LOWEST regular nightly rate. If you cannot find a confident per-night rate, return the literal string "none".',
      messages: [
        {
          role: 'user',
          content: `Page from ${name}:\n\n${snippet}\n\nLowest nightly rate (number only or "none"):`,
        },
      ],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text.toLowerCase().includes('none')) return null;
    const price = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (isNaN(price) || price <= 0 || price > 500) return null;
    return price;
  } catch {
    return null;
  }
}

async function scrapeCampground(
  campground: { id: string; name: string; websiteUrl: string },
  useAI: boolean,
): Promise<ScrapeResult> {
  const engine = detectEngine(campground.websiteUrl);
  const html = await fetchHtml(campground.websiteUrl);

  if (!html) {
    return {
      campgroundId: campground.id,
      name: campground.name,
      url: campground.websiteUrl,
      engine,
      price: null,
      source: null,
      reason: 'fetch failed',
    };
  }

  // 1) Engine-specific extractor
  let price = extractPriceFromHtml(engine, html);
  if (price) {
    return { campgroundId: campground.id, name: campground.name, url: campground.websiteUrl, engine, price, source: 'engine' };
  }

  // 2) AI fallback (opt-in only)
  if (useAI) {
    price = await extractWithAI(html, campground.name);
    if (price) {
      return { campgroundId: campground.id, name: campground.name, url: campground.websiteUrl, engine, price, source: 'ai' };
    }
  }

  return {
    campgroundId: campground.id,
    name: campground.name,
    url: campground.websiteUrl,
    engine,
    price: null,
    source: null,
    reason: 'no price extracted',
  };
}

async function main() {
  const args = process.argv.slice(2);
  const requestedLimit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : SAFETY_DEFAULT_LIMIT;
  const shuffle = args.includes('--shuffle');
  const dryRun = args.includes('--dry-run');
  const useAI = args.includes('--use-ai');
  const confirmLarge = args.includes('--confirm-large');

  // Safety: refuse to run >100 sites unless --confirm-large is passed
  if (requestedLimit > 100 && !confirmLarge) {
    console.error(
      `[generic-scrape] Refusing to run with limit ${requestedLimit} without --confirm-large. ` +
        'This protects against accidentally scraping thousands of sites. Pass --confirm-large to override.',
    );
    process.exit(2);
  }

  console.log(
    `[generic-scrape] Starting (limit=${requestedLimit}, shuffle=${shuffle}, dry-run=${dryRun}, use-ai=${useAI})`,
  );

  // Pull campgrounds with a website URL but no current price, excluding
  // recreation.gov (handled by Phase 1) and the long-tail of dead URLs
  let pool = await prisma.campground.findMany({
    where: {
      websiteUrl: { not: null },
      pricePerNight: null,
      NOT: { websiteUrl: { contains: 'recreation.gov' } },
    },
    select: { id: true, name: true, websiteUrl: true },
    take: shuffle ? 5000 : requestedLimit,
  });

  if (shuffle) {
    pool = pool
      .map((c, i) => ({ c, k: (i * 2654435761) % 2 ** 32 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.c);
  }

  const targets = pool.slice(0, requestedLimit);
  console.log(`[generic-scrape] ${targets.length} campgrounds to process`);

  const startedAt = Date.now();
  const byEngine: Record<string, { tried: number; priced: number }> = {};
  let totalPriced = 0;
  let totalUpdated = 0;

  for (let i = 0; i < targets.length; i++) {
    const cg = targets[i];
    if (!cg.websiteUrl) continue;

    const result = await scrapeCampground(
      { id: cg.id, name: cg.name, websiteUrl: cg.websiteUrl },
      useAI,
    );

    if (!byEngine[result.engine]) byEngine[result.engine] = { tried: 0, priced: 0 };
    byEngine[result.engine].tried++;
    if (result.price) {
      byEngine[result.engine].priced++;
      totalPriced++;
      if (!dryRun) {
        await prisma.campground.update({
          where: { id: result.campgroundId },
          data: { pricePerNight: result.price },
        });
        totalUpdated++;
      }
    }

    // Per-row log so we can see what's happening
    const status = result.price ? `$${result.price.toFixed(2)} via ${result.source}` : (result.reason || '—');
    console.log(`  [${i + 1}/${targets.length}] ${result.engine.padEnd(15)} ${result.name.slice(0, 40).padEnd(42)} ${status}`);

    await sleep(REQUEST_DELAY_MS);
  }

  console.log('\n[generic-scrape] DONE');
  console.log(`  Processed:    ${targets.length}`);
  console.log(`  Priced:       ${totalPriced} (${((totalPriced / targets.length) * 100).toFixed(0)}%)`);
  console.log(`  Updated:      ${totalUpdated}${dryRun ? ' (DRY RUN — no writes)' : ''}`);
  console.log(`  Elapsed:      ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
  console.log('\n  By engine:');
  for (const [engine, stats] of Object.entries(byEngine)) {
    const pct = stats.tried > 0 ? Math.round((stats.priced / stats.tried) * 100) : 0;
    console.log(`    ${engine.padEnd(15)} ${stats.priced}/${stats.tried} (${pct}%)`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[generic-scrape] FATAL', e);
  process.exit(1);
});
