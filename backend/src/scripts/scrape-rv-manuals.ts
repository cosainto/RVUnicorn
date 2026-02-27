/**
 * RVUnicorn — RV Owner Manual Scraper
 * =====================================
 * Scrapes owner manual PDFs from major manufacturer websites
 * and stores them in the RVModel.manualUrl field.
 *
 * Run: npx tsx src/scripts/scrape-rv-manuals.ts
 *
 * Requires puppeteer: npm install puppeteer
 * (already installed if you ran scrape-maps.ts before)
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// Progress tracking
// ─────────────────────────────────────────────────────────────
const PROGRESS_FILE = path.join(__dirname, '../../rv-manual-progress.json');
interface Progress {
  processed: string[];       // manufacturer slugs completed
  manualCount: number;
  lastRun: string;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return { processed: [], manualCount: 0, lastRun: '' };
}

function saveProgress(p: Progress) {
  p.lastRun = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ─────────────────────────────────────────────────────────────
// Manufacturer scraping configs
// Each entry has:
//   slug      - unique key for progress tracking
//   make      - must match RVModel.make exactly (or array of aliases)
//   scrapeUrl - the owners/manuals page to scrape
//   scraper   - async function returning array of { model, year?, url }
// ─────────────────────────────────────────────────────────────

interface ManualEntry {
  model: string;       // model name/number
  year?: number;
  url: string;         // direct PDF or page URL
}

interface ManufacturerConfig {
  slug: string;
  makes: string[];     // matches RVModel.make (case-insensitive)
  scrapeUrl: string;
  scraper: (page: Page, browser: Browser) => Promise<ManualEntry[]>;
}

// ─────────────────────────────────────────────────────────────
// Helper: get all PDF links from a page
// ─────────────────────────────────────────────────────────────
async function getPDFLinks(page: Page, baseUrl?: string): Promise<{href: string, text: string}[]> {
  return page.evaluate((base) => {
    const links: {href: string, text: string}[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = a.href || '';
      const text = (a.textContent || a.title || '').trim();
      if (href.match(/\.pdf($|\?)/i) || href.includes('/owners-manual') || href.includes('/owner-manual')) {
        links.push({ href, text });
      }
    });
    return links;
  }, baseUrl);
}

// ─────────────────────────────────────────────────────────────
// Helper: fuzzy-match a manual entry's model name against DB
// ─────────────────────────────────────────────────────────────
function extractModelName(text: string): string {
  // Remove years like "2023", "2022-2024", etc.
  return text
    .replace(/\b(19|20)\d{2}(\s*[-–]\s*(19|20)\d{2})?\b/g, '')
    .replace(/owner'?s?\s*manual/gi, '')
    .replace(/supplement/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYear(text: string): number | undefined {
  const m = text.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  return m ? parseInt(m[1]) : undefined;
}

// ─────────────────────────────────────────────────────────────
// MANUFACTURER SCRAPERS
// ─────────────────────────────────────────────────────────────

const MANUFACTURERS: ManufacturerConfig[] = [

  // ── Coachmen ──────────────────────────────────────────────
  {
    slug: 'coachmen',
    makes: ['coachmen', 'coachman'],
    scrapeUrl: 'https://www.coachmenrv.com/resources/owners-manuals/',
    scraper: async (page) => {
      await page.goto('https://www.coachmenrv.com/resources/owners-manuals/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Winnebago ─────────────────────────────────────────────
  {
    slug: 'winnebago',
    makes: ['winnebago'],
    scrapeUrl: 'https://www.winnebago.com/owners/manuals',
    scraper: async (page) => {
      await page.goto('https://www.winnebago.com/owners/manuals', { waitUntil: 'networkidle2', timeout: 30000 });
      // Winnebago uses a dropdown/filter system
      await page.waitForSelector('a[href*=".pdf"], .manual-download, .owner-manual', { timeout: 10000 }).catch(() => {});
      const links = await getPDFLinks(page);
      if (links.length === 0) {
        // Try alternate URL
        await page.goto('https://www.winnebago.com/customer-support/owners-manuals', { waitUntil: 'networkidle2', timeout: 30000 });
        const links2 = await getPDFLinks(page);
        return links2.map(l => ({
          model: extractModelName(l.text),
          year: extractYear(l.text),
          url: l.href,
        })).filter(l => l.model.length > 2);
      }
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Thor Motor Coach ──────────────────────────────────────
  {
    slug: 'thor-motor-coach',
    makes: ['thor motor coach', 'thor motorcoach'],
    scrapeUrl: 'https://www.thormotorcoach.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.thormotorcoach.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Jayco ─────────────────────────────────────────────────
  {
    slug: 'jayco',
    makes: ['jayco'],
    scrapeUrl: 'https://www.jayco.com/owners/manuals/',
    scraper: async (page) => {
      await page.goto('https://www.jayco.com/owners/manuals/', { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('a[href*=".pdf"], .manual', { timeout: 10000 }).catch(() => {});
      const links = await getPDFLinks(page);
      // Jayco may paginate — check for "next" buttons
      const nextLink = await page.$eval('a[aria-label="Next"], a.next, .pagination-next', el => (el as HTMLAnchorElement).href).catch(() => null);
      if (nextLink) {
        await page.goto(nextLink, { waitUntil: 'networkidle2', timeout: 30000 });
        const links2 = await getPDFLinks(page);
        links.push(...links2);
      }
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Grand Design ──────────────────────────────────────────
  {
    slug: 'grand-design',
    makes: ['grand design'],
    scrapeUrl: 'https://www.granddesignrv.com/owner-resources/owners-manuals/',
    scraper: async (page) => {
      await page.goto('https://www.granddesignrv.com/owner-resources/owners-manuals/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Keystone RV ───────────────────────────────────────────
  {
    slug: 'keystone',
    makes: ['keystone'],
    scrapeUrl: 'https://www.keystonerv.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.keystonerv.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      if (links.length === 0) {
        await page.goto('https://www.keystonerv.com/owners/manuals/', { waitUntil: 'networkidle2', timeout: 30000 });
        const links2 = await getPDFLinks(page);
        return links2.map(l => ({
          model: extractModelName(l.text),
          year: extractYear(l.text),
          url: l.href,
        })).filter(l => l.model.length > 2);
      }
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Heartland RV ──────────────────────────────────────────
  {
    slug: 'heartland',
    makes: ['heartland'],
    scrapeUrl: 'https://www.heartlandrvs.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.heartlandrvs.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Forest River ──────────────────────────────────────────
  {
    slug: 'forest-river',
    makes: ['forest river'],
    scrapeUrl: 'https://www.forestriverinc.com/owners/manuals',
    scraper: async (page) => {
      await page.goto('https://www.forestriverinc.com/owners/manuals', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Tiffin Motorhomes ─────────────────────────────────────
  {
    slug: 'tiffin',
    makes: ['tiffin', 'tiffin motorhomes'],
    scrapeUrl: 'https://www.tiffinmotorhomes.com/owners/manuals/',
    scraper: async (page) => {
      await page.goto('https://www.tiffinmotorhomes.com/owners/manuals/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      if (links.length === 0) {
        await page.goto('https://www.tiffinmotorhomes.com/resources/manuals/', { waitUntil: 'networkidle2', timeout: 30000 });
        const links2 = await getPDFLinks(page);
        return links2.map(l => ({
          model: extractModelName(l.text),
          year: extractYear(l.text),
          url: l.href,
        })).filter(l => l.model.length > 2);
      }
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Newmar ────────────────────────────────────────────────
  {
    slug: 'newmar',
    makes: ['newmar'],
    scrapeUrl: 'https://www.newmarcorp.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.newmarcorp.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Fleetwood ─────────────────────────────────────────────
  {
    slug: 'fleetwood',
    makes: ['fleetwood'],
    scrapeUrl: 'https://www.fleetwoodrv.com/owners-center/manuals',
    scraper: async (page) => {
      await page.goto('https://www.fleetwoodrv.com/owners-center/manuals', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Entegra Coach ─────────────────────────────────────────
  {
    slug: 'entegra',
    makes: ['entegra', 'entegra coach'],
    scrapeUrl: 'https://www.entegracoach.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.entegracoach.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Airstream ─────────────────────────────────────────────
  {
    slug: 'airstream',
    makes: ['airstream'],
    scrapeUrl: 'https://www.airstream.com/owners/manuals/',
    scraper: async (page) => {
      await page.goto('https://www.airstream.com/owners/manuals/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      if (links.length === 0) {
        // Try their support portal
        await page.goto('https://support.airstream.com/hc/en-us/sections/200553927', { waitUntil: 'networkidle2', timeout: 30000 });
        const links2 = await getPDFLinks(page);
        return links2.map(l => ({
          model: extractModelName(l.text),
          year: extractYear(l.text),
          url: l.href,
        })).filter(l => l.model.length > 2);
      }
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Lance Campers ─────────────────────────────────────────
  {
    slug: 'lance',
    makes: ['lance', 'lance campers'],
    scrapeUrl: 'https://www.lancecamper.com/owners/manuals/',
    scraper: async (page) => {
      await page.goto('https://www.lancecamper.com/owners/manuals/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Dutchmen ──────────────────────────────────────────────
  {
    slug: 'dutchmen',
    makes: ['dutchmen'],
    scrapeUrl: 'https://www.dutchmen.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.dutchmen.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── Holiday Rambler ───────────────────────────────────────
  {
    slug: 'holiday-rambler',
    makes: ['holiday rambler'],
    scrapeUrl: 'https://www.holidayrambler.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.holidayrambler.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── KZ RV ─────────────────────────────────────────────────
  {
    slug: 'kz-rv',
    makes: ['kz rv', 'k-z rv', 'kz'],
    scrapeUrl: 'https://www.kz-rv.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.kz-rv.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── CrossRoads RV ─────────────────────────────────────────
  {
    slug: 'crossroads',
    makes: ['crossroads', 'crossroads rv'],
    scrapeUrl: 'https://www.crossroadsrv.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.crossroadsrv.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

  // ── NuCamp RV (Tab, T@B) ──────────────────────────────────
  {
    slug: 'nucamp',
    makes: ['nucamp', 'nu-camp'],
    scrapeUrl: 'https://www.nucamprv.com/owners/',
    scraper: async (page) => {
      await page.goto('https://www.nucamprv.com/owners/', { waitUntil: 'networkidle2', timeout: 30000 });
      const links = await getPDFLinks(page);
      return links.map(l => ({
        model: extractModelName(l.text),
        year: extractYear(l.text),
        url: l.href,
      })).filter(l => l.model.length > 2);
    },
  },

];

// ─────────────────────────────────────────────────────────────
// Match scraped manuals to database models
// ─────────────────────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function matchAndSaveManuals(
  manuals: ManualEntry[],
  makeNames: string[]
): Promise<number> {
  if (manuals.length === 0) return 0;

  const db = prisma as any;

  // Find the RVMake record(s) for this manufacturer
  const rvMakes = await prisma.rVMake.findMany({
    where: { name: { in: makeNames, mode: 'insensitive' } },
    include: { models: { select: { id: true, name: true } } },
  });

  if (rvMakes.length === 0) {
    console.log(`    ⚠️  No RVMake found for: ${makeNames.join(', ')}`);
    return 0;
  }

  // Use the first matching make
  const rvMake = rvMakes[0];
  const existingModels = rvMake.models;

  let saved = 0;

  // Filter out navigation junk
  const JUNK_PATTERNS = /skip to|main content|page footer|javascript|cookie|privacy policy|terms of use|sign in|log in|subscribe|newsletter|search|menu|navigation/i;

  for (const entry of manuals) {
    if (!entry.url || !entry.model) continue;
    const modelName = entry.model.trim();
    if (modelName.length < 3) continue;
    if (JUNK_PATTERNS.test(modelName)) continue;
    // Must look like a real model name (has alphanumeric chars beyond just short words)
    if (modelName.split(' ').every(w => w.length <= 2)) continue;

    const normEntry = normalizeStr(modelName);

    // Try to match existing model
    let matchedId: string | null = null;
    let bestScore = 0;

    for (const dbModel of existingModels) {
      const normDb = normalizeStr(dbModel.name);
      if (normDb.includes(normEntry) || normEntry.includes(normDb)) {
        const score = Math.min(normEntry.length, normDb.length);
        if (score > bestScore) {
          bestScore = score;
          matchedId = dbModel.id;
        }
      }
    }

    if (matchedId && matchedId !== 'new' && bestScore >= 4) {
      // Update existing model
      await db.rVModel.update({
        where: { id: matchedId },
        data: { manualUrl: entry.url },
      });
      console.log(`    ✅ Updated: ${rvMake.name} ${modelName} → ${entry.url.slice(0, 55)}...`);
      saved++;
    } else {
      // Create new model record with the manual URL
      try {
        await db.rVModel.create({
          data: {
            makeId: rvMake.id,
            name: modelName,
            type: guessRvType(modelName, rvMake.types),
            features: [],
            manualUrl: entry.url,
          },
        });
        // Add to local list so we don't duplicate within this run
        existingModels.push({ id: 'new', name: modelName });
        console.log(`    ✨ Created: ${rvMake.name} ${modelName} → ${entry.url.slice(0, 55)}...`);
        saved++;
      } catch (e: any) {
        console.error(`    ❌ Failed to create model ${modelName}:`, e.message || String(e));
      }
    }
  }

  return saved;
}

function guessRvType(modelName: string, makeTypes: string[]): string {
  const lower = modelName.toLowerCase();
  if (lower.includes('class a') || lower.includes('motorhome') || lower.includes('marathon') || lower.includes('allegro') || lower.includes('phaeton')) return 'Class A';
  if (lower.includes('class b') || lower.includes('wonder') || lower.includes('travato') || lower.includes('revel')) return 'Class B';
  if (lower.includes('class c') || lower.includes('leprechaun') || lower.includes('sunseeker') || lower.includes('pursuit')) return 'Class C';
  if (lower.includes('fifth') || lower.includes('5th') || lower.includes('wheel')) return 'Fifth Wheel';
  if (lower.includes('toy hauler') || lower.includes('toyhauler')) return 'Toy Hauler';
  if (lower.includes('pop') || lower.includes('tent')) return 'Pop-Up Camper';
  if (lower.includes('truck') || lower.includes('camper')) return 'Truck Camper';
  // Fall back to first type from make's known types, or Travel Trailer
  if (makeTypes && makeTypes.length > 0) return makeTypes[0];
  return 'Travel Trailer';
}

// ─────────────────────────────────────────────────────────────
// Also: for models WITHOUT a scraped manual, try constructing
// a search URL so users at least get directed somewhere useful
// ─────────────────────────────────────────────────────────────

async function fillFallbackManualUrls() {
  console.log('\n🔍 Filling fallback manual search URLs for unmatched models...');

  const db = prisma as any;
  const modelsWithoutManual: Array<{ id: string; name: string; make: { name: string } }> = await db.rVModel.findMany({
    where: { manualUrl: null },
    include: { make: { select: { name: true } } },
  });

  console.log(`   Found ${modelsWithoutManual.length} models without manuals`);

  // Known manufacturer support URL patterns
  const SUPPORT_URL_PATTERNS: { [make: string]: (name: string) => string } = {
    'coachmen':         (n, y) => `https://www.coachmenrv.com/resources/owners-manuals/?search=${encodeURIComponent(n)}`,
    'coachman':         (n, y) => `https://www.coachmenrv.com/resources/owners-manuals/?search=${encodeURIComponent(n)}`,
    'winnebago':        (n, y) => `https://www.winnebago.com/owners/manuals?model=${encodeURIComponent(n)}${y ? `&year=${y}` : ''}`,
    'jayco':            (n, y) => `https://www.jayco.com/owners/manuals/?model=${encodeURIComponent(n)}`,
    'forest river':     (n, y) => `https://www.forestriverinc.com/owners/manuals?search=${encodeURIComponent(n)}`,
    'grand design':     (_) => `https://www.granddesignrv.com/owner-resources/owners-manuals/`,
    'keystone':         (_) => `https://www.keystonerv.com/owners/`,
    'heartland':        (_) => `https://www.heartlandrvs.com/owners/`,
    'tiffin':           (_) => `https://www.tiffinmotorhomes.com/owners/manuals/`,
    'tiffin motorhomes':(_) => `https://www.tiffinmotorhomes.com/owners/manuals/`,
    'newmar':           (_) => `https://www.newmarcorp.com/owners/`,
    'fleetwood':        (_) => `https://www.fleetwoodrv.com/owners-center/manuals`,
    'entegra':          (_) => `https://www.entegracoach.com/owners/`,
    'entegra coach':    (_) => `https://www.entegracoach.com/owners/`,
    'airstream':        (_) => `https://www.airstream.com/owners/manuals/`,
    'thor motor coach': (_) => `https://www.thormotorcoach.com/owners/`,
    'lance':            (_) => `https://www.lancecamper.com/owners/manuals/`,
    'lance campers':    (_) => `https://www.lancecamper.com/owners/manuals/`,
    'dutchmen':         (_) => `https://www.dutchmen.com/owners/`,
    'holiday rambler':  (_) => `https://www.holidayrambler.com/owners/`,
    'kz rv':            (_) => `https://www.kz-rv.com/owners/`,
    'crossroads':       (_) => `https://www.crossroadsrv.com/owners/`,
    'nucamp':           (_) => `https://www.nucamprv.com/owners/`,
  };

  let filled = 0;
  for (const model of modelsWithoutManual) {
    const makeNorm = model.make.name.toLowerCase();
    const urlFn = SUPPORT_URL_PATTERNS[makeNorm];
    if (urlFn) {
      await db.rVModel.update({
        where: { id: model.id },
        data: { manualUrl: urlFn(model.name) },
      });
      filled++;
    }
  }

  console.log(`   ✅ Filled ${filled} fallback manual URLs`);
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🚐 RVUnicorn Manual Scraper');
  console.log('══════════════════════════════════════════════════════');

  const progress = loadProgress();
  console.log(`\nPreviously processed: ${progress.processed.length} manufacturers`);
  console.log(`Total manuals stored so far: ${progress.manualCount}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let totalSaved = progress.manualCount;

  for (const mfr of MANUFACTURERS) {
    if (progress.processed.includes(mfr.slug)) {
      console.log(`\n⏭️  Skipping ${mfr.slug} (already processed)`);
      continue;
    }

    console.log(`\n📋 Scraping: ${mfr.slug} (${mfr.makes.join(', ')})`);
    console.log(`   URL: ${mfr.scrapeUrl}`);

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    try {
      const manuals = await mfr.scraper(page, browser);
      console.log(`   Found ${manuals.length} manual entries`);

      const saved = await matchAndSaveManuals(manuals, mfr.makes);
      console.log(`   Saved ${saved} to database`);
      totalSaved += saved;

      progress.processed.push(mfr.slug);
      progress.manualCount = totalSaved;
      saveProgress(progress);

    } catch (err) {
      console.error(`   ❌ Error scraping ${mfr.slug}:`, (err as Error).message);
    } finally {
      await page.close();
    }

    // Polite delay between manufacturers
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  // Fill fallback URLs for models that still have no manual
  await fillFallbackManualUrls();

  // Final stats
  const totalWithManual = await prisma.rVModel.count({ where: { manualUrl: { not: null } } });
  const totalModels = await prisma.rVModel.count();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('✅ Manual scraping complete!');
  console.log(`   Total models in DB:    ${totalModels}`);
  console.log(`   Models with manual URL: ${totalWithManual} (${Math.round(totalWithManual/totalModels*100)}%)`);
  console.log('\nNext step: Run the Prisma migration to add manualUrl column,');
  console.log('then run this script.');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
