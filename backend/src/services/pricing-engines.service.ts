/**
 * Phase 2 — Per-engine pricing extractors
 *
 * Most independent campgrounds in the US run their reservations through one
 * of a handful of platforms. Each platform has a recognizable URL pattern
 * AND a recognizable HTML shape, so a per-engine extractor is much more
 * reliable than a generic scraper.
 *
 * Engines covered (in priority order — highest market share first):
 *
 *   1. Recreation.gov         — federal sites, handled by Phase 1 script
 *   2. ReserveAmerica         — many state parks
 *   3. Campspot               — independent RV parks, fast-growing
 *   4. ResNexus               — independent RV parks
 *   5. RMS / The Roverpass    — independent
 *   6. KOA                    — proprietary platform, koa.com URLs
 *   7. Hipcamp                — boutique sites
 *
 * For each engine, this module exports:
 *   - detectEngine(url) : returns the engine name or null
 *   - extractPriceFromHtml(engine, html) : returns a number or null
 *
 * Phase 3 (the generic AI scraper) only runs when detectEngine returns
 * null — i.e. for the long tail of bespoke campground websites.
 */

export type PricingEngine =
  | 'recreation.gov'
  | 'reserveamerica'
  | 'campspot'
  | 'resnexus'
  | 'rms'
  | 'koa'
  | 'hipcamp'
  | 'unknown';

/**
 * Identify which reservation engine a website URL is using.
 * Returns 'unknown' if it doesn't match any known pattern.
 */
export function detectEngine(websiteUrl: string | null | undefined): PricingEngine {
  if (!websiteUrl) return 'unknown';
  const u = websiteUrl.toLowerCase();
  if (u.includes('recreation.gov')) return 'recreation.gov';
  if (u.includes('reserveamerica.com')) return 'reserveamerica';
  if (u.includes('campspot.com')) return 'campspot';
  if (u.includes('resnexus.com') || u.includes('reservenextcamp')) return 'resnexus';
  if (u.includes('rms') && u.includes('cloud')) return 'rms';
  if (u.includes('roverpass.com')) return 'rms';
  if (u.includes('koa.com')) return 'koa';
  if (u.includes('hipcamp.com')) return 'hipcamp';
  return 'unknown';
}

/**
 * Extract a starting nightly rate from HTML for a given engine. Returns
 * null if no price could be confidently parsed.
 *
 * Each engine's extractor reads the page differently — some embed JSON-LD,
 * some have data-price attributes, some require parsing visible HTML.
 */
export function extractPriceFromHtml(engine: PricingEngine, html: string): number | null {
  switch (engine) {
    case 'recreation.gov':
      return extractRecGov(html);
    case 'campspot':
      return extractCampspot(html);
    case 'reserveamerica':
      return extractReserveAmerica(html);
    case 'resnexus':
      return extractResNexus(html);
    case 'koa':
      return extractKOA(html);
    case 'hipcamp':
      return extractHipcamp(html);
    case 'rms':
      return extractGenericMinPrice(html);
    default:
      return null;
  }
}

// ── Recreation.gov ─────────────────────────────────────────────
// JSON-LD Campground / makesOffer / price (already validated in Phase 1)
function extractRecGov(html: string): number | null {
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const block of blocks) {
    const jsonText = block.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '');
    try {
      const data = JSON.parse(jsonText);
      const candidates = Array.isArray(data) ? data : [data];
      for (const c of candidates) {
        if (c['@type'] === 'Campground' && c.makesOffer) {
          const offer = Array.isArray(c.makesOffer) ? c.makesOffer[0] : c.makesOffer;
          const price = parseFloat(String(offer?.price));
          if (!isNaN(price) && price > 0) return price;
        }
      }
    } catch {}
  }
  return null;
}

// ── Campspot ────────────────────────────────────────────────────
// Campspot pages often surface pricing in a "from $XX/night" pattern OR
// in their embedded availability widget JSON. We grab the lowest visible
// dollar amount in a "from $XX" or "starting at $XX" context.
function extractCampspot(html: string): number | null {
  // Try JSON-LD first (some Campspot sites have it)
  const ld = extractRecGov(html);
  if (ld) return ld;
  // Then look for "from $XX" / "starting at $XX" patterns
  const matches = html.match(/(?:from|starting at|starts at)\s*\$(\d+(?:\.\d{2})?)/gi);
  if (matches && matches.length > 0) {
    const prices = matches
      .map((m) => parseFloat(m.replace(/[^0-9.]/g, '')))
      .filter((p) => p > 0 && p < 500); // sanity bound
    if (prices.length > 0) return Math.min(...prices);
  }
  return null;
}

// ── ReserveAmerica ──────────────────────────────────────────────
// Most ReserveAmerica state-park pages have a "Site fee starts at $XX"
// or a price column in the search results. The detail pages embed JSON
// in window state under window.__INITIAL_STATE__ or similar.
function extractReserveAmerica(html: string): number | null {
  const initialState = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (initialState) {
    try {
      const data = JSON.parse(initialState[1]);
      const flat = JSON.stringify(data);
      const m = flat.match(/"feeAmount"\s*:\s*([0-9.]+)/);
      if (m) {
        const price = parseFloat(m[1]);
        if (price > 0 && price < 500) return price;
      }
    } catch {}
  }
  return extractGenericMinPrice(html);
}

// ── ResNexus ────────────────────────────────────────────────────
// ResNexus uses a widget at the top with "Starting at $X.XX" or
// renders a rate table with class names like "rate-row".
function extractResNexus(html: string): number | null {
  const m = html.match(/(?:starting at|from|rates start at)\s*\$?(\d+(?:\.\d{2})?)/i);
  if (m) {
    const price = parseFloat(m[1]);
    if (price > 0 && price < 500) return price;
  }
  return extractGenericMinPrice(html);
}

// ── KOA ─────────────────────────────────────────────────────────
// KOA pages have a price-from on the campground detail page in a
// "campground-rates" or "rate-snapshot" block. They also have JSON-LD
// occasionally.
function extractKOA(html: string): number | null {
  const ld = extractRecGov(html);
  if (ld) return ld;
  const m = html.match(/(?:rates?\s*from|from)\s*\$(\d+(?:\.\d{2})?)/i);
  if (m) {
    const price = parseFloat(m[1]);
    if (price > 0 && price < 500) return price;
  }
  return null;
}

// ── Hipcamp ─────────────────────────────────────────────────────
// Hipcamp pages embed listing data in window.__APOLLO_STATE__. Extract
// the basePrice / nightlyPrice from the first listing.
function extractHipcamp(html: string): number | null {
  const apolloState = html.match(/__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (apolloState) {
    try {
      const data = JSON.parse(apolloState[1]);
      const flat = JSON.stringify(data);
      const m = flat.match(/"basePrice"\s*:\s*([0-9.]+)/) || flat.match(/"nightlyPrice"\s*:\s*([0-9.]+)/);
      if (m) {
        const price = parseFloat(m[1]);
        if (price > 0 && price < 500) return price;
      }
    } catch {}
  }
  return null;
}

// ── Generic fallback ───────────────────────────────────────────
// Find the smallest "$XX" or "$XX.XX" amount that appears alongside a
// per-night word ("/night", "per night", "nightly"). Used when no
// engine-specific extractor matches.
function extractGenericMinPrice(html: string): number | null {
  // Match "$XX/night", "$XX per night", "$XX nightly", "$XX a night"
  const matches = html.match(/\$(\d+(?:\.\d{2})?)\s*(?:\/|per\s+|\s*a\s+)?night(?:ly)?/gi) || [];
  const prices = matches
    .map((m) => parseFloat(m.replace(/[^0-9.]/g, '')))
    .filter((p) => p > 0 && p < 500);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}
