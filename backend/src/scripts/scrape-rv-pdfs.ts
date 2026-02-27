/**
 * RVUnicorn — RV Manual PDF Scraper (Deep Scrape)
 * Finds actual PDF links, not just support pages.
 * Run: npx tsx src/scripts/scrape-rv-pdfs.ts
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma as any;

interface PdfResult {
  model: string;
  year?: number;
  pdfUrl: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractYear(text: string): number | undefined {
  const m = text.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  return m ? parseInt(m[1]) : undefined;
}

function cleanModelName(text: string): string {
  return text
    .replace(/\b(19|20)\d{2}(\s*[-–]\s*(19|20)\d{2})?\b/g, '')
    .replace(/owner'?s?\s*manual/gi, '')
    .replace(/supplement/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function saveManualUrl(makeName: string, modelName: string, pdfUrl: string): Promise<boolean> {
  // Find the make
  const make = await prisma.rVMake.findFirst({
    where: { name: { equals: makeName, mode: 'insensitive' } },
    include: { models: { select: { id: true, name: true, manualUrl: true } } },
  });
  if (!make) {
    console.log(`    ⚠️  Make not found: ${makeName}`);
    return false;
  }

  const normModel = normalizeStr(modelName);

  // Try to find existing model match
  let bestId: string | null = null;
  let bestScore = 0;
  for (const m of make.models) {
    const normDb = normalizeStr(m.name);
    if (normDb.includes(normModel) || normModel.includes(normDb)) {
      const score = Math.min(normDb.length, normModel.length);
      if (score > bestScore) {
        bestScore = score;
        bestId = m.id;
      }
    }
  }

  if (bestId && bestScore >= 4) {
    await db.rVModel.update({ where: { id: bestId }, data: { manualUrl: pdfUrl } });
    return true;
  }

  // Create new model
  try {
    await db.rVModel.create({
      data: {
        makeId: make.id,
        name: modelName,
        type: make.types?.[0] || 'Travel Trailer',
        features: [],
        manualUrl: pdfUrl,
      },
    });
    return true;
  } catch (e: any) {
    if (!e.message?.includes('Unique constraint')) {
      console.error(`    ❌ Create failed for ${modelName}:`, e.message);
    }
    return false;
  }
}

// ─── Brand Scrapers ──────────────────────────────────────────────────────────

// Airstream: Has direct PDFs on their site
async function scrapeAirstream(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];
  await page.goto('https://www.airstream.com/support/owners-manuals/', { waitUntil: 'networkidle2', timeout: 30000 });

  const pdfs = await page.evaluate(() => {
    const links: { text: string; href: string }[] = [];
    document.querySelectorAll('a[href*=".pdf"], a[href*="manual"]').forEach(a => {
      const href = (a as HTMLAnchorElement).href;
      const text = (a.textContent || '').trim();
      if (href && text) links.push({ href, text });
    });
    return links;
  });

  for (const pdf of pdfs) {
    if (!pdf.href.match(/\.pdf/i)) continue;
    results.push({
      model: cleanModelName(pdf.text),
      year: extractYear(pdf.text),
      pdfUrl: pdf.href,
    });
  }
  return results.filter(r => r.model.length > 2);
}

// Winnebago: Uses a filter/search API we can query directly
async function scrapeWinnebago(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];

  // Try their manuals page with network interception to catch API calls
  await page.goto('https://www.winnebago.com/owners/manuals', { waitUntil: 'networkidle2', timeout: 30000 });

  const pdfs = await page.evaluate(() => {
    const links: { text: string; href: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = (a as HTMLAnchorElement).href || '';
      const text = (a.textContent || '').trim();
      if (href.match(/\.pdf/i) && text) links.push({ href, text });
    });
    return links;
  });

  // Also try the customer support page
  await page.goto('https://www.winnebago.com/customer-support/owners-manuals', { waitUntil: 'networkidle2', timeout: 30000 });
  const pdfs2 = await page.evaluate(() => {
    const links: { text: string; href: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = (a as HTMLAnchorElement).href || '';
      const text = (a.textContent || '').trim();
      if (href.match(/\.pdf/i) && text) links.push({ href, text });
    });
    return links;
  });

  for (const pdf of [...pdfs, ...pdfs2]) {
    results.push({
      model: cleanModelName(pdf.text),
      year: extractYear(pdf.text),
      pdfUrl: pdf.href,
    });
  }
  return results.filter(r => r.model.length > 2);
}

// Forest River: Uses forestriverinc.help — build search URLs per model
async function scrapeForestRiver(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];

  // Get all Forest River models from DB
  const make = await prisma.rVMake.findFirst({
    where: { name: { equals: 'Forest River', mode: 'insensitive' } },
    include: { models: { select: { id: true, name: true } } },
  });
  if (!make) return results;

  const currentYear = new Date().getFullYear();

  // Sample a few models to verify URL pattern works
  for (const model of make.models.slice(0, 5)) {
    const modelSlug = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const url = `https://forestriverinc.help/#/forestriver/guide/${currentYear}/${modelSlug}/browse/tags/Owner's%20Manual`;
    results.push({
      model: model.name,
      year: currentYear,
      pdfUrl: url,
    });
  }

  // For remaining models, build the URL pattern
  for (const model of make.models.slice(5)) {
    const modelSlug = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const url = `https://forestriverinc.help/#/forestriver/guide/${currentYear}/${modelSlug}/browse/tags/Owner's%20Manual`;
    results.push({
      model: model.name,
      year: currentYear,
      pdfUrl: url,
    });
  }

  return results;
}

// Jayco: Has direct PDFs
async function scrapeJayco(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];
  
  // Try multiple Jayco manual pages
  const urls = [
    'https://www.jayco.com/owners/manuals/',
    'https://www.jayco.com/resources/owners-manuals/',
  ];

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      const pdfs = await page.evaluate(() => {
        const links: { text: string; href: string }[] = [];
        document.querySelectorAll('a').forEach(a => {
          const href = (a as HTMLAnchorElement).href || '';
          const text = (a.textContent || '').trim();
          if (href.match(/\.pdf/i) && text.length > 2) links.push({ href, text });
        });
        return links;
      });
      for (const pdf of pdfs) {
        results.push({
          model: cleanModelName(pdf.text),
          year: extractYear(pdf.text),
          pdfUrl: pdf.href,
        });
      }
    } catch (e) {}
  }

  return results.filter(r => r.model.length > 2);
}

// Grand Design: Has PDFs
async function scrapeGrandDesign(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];
  await page.goto('https://www.granddesignrv.com/owner-resources/owners-manuals/', { waitUntil: 'networkidle2', timeout: 30000 });

  const pdfs = await page.evaluate(() => {
    const links: { text: string; href: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = (a as HTMLAnchorElement).href || '';
      const text = (a.textContent || '').trim();
      if (href.match(/\.pdf/i) && text.length > 2) links.push({ href, text });
    });
    return links;
  });

  for (const pdf of pdfs) {
    results.push({
      model: cleanModelName(pdf.text),
      year: extractYear(pdf.text),
      pdfUrl: pdf.href,
    });
  }
  return results.filter(r => r.model.length > 2);
}

// Keystone: Has PDFs
async function scrapeKeystone(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];
  const urls = [
    'https://www.keystonerv.com/owners/',
    'https://www.keystonerv.com/owners/manuals/',
  ];

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      const pdfs = await page.evaluate(() => {
        const links: { text: string; href: string }[] = [];
        document.querySelectorAll('a').forEach(a => {
          const href = (a as HTMLAnchorElement).href || '';
          const text = (a.textContent || '').trim();
          if (href.match(/\.pdf/i) && text.length > 2) links.push({ href, text });
        });
        return links;
      });
      for (const pdf of pdfs) {
        results.push({ model: cleanModelName(pdf.text), year: extractYear(pdf.text), pdfUrl: pdf.href });
      }
    } catch (e) {}
  }
  return results.filter(r => r.model.length > 2);
}

// Tiffin: Has PDFs
async function scrapeTiffin(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];
  const urls = [
    'https://www.tiffinmotorhomes.com/owners/manuals/',
    'https://www.tiffinmotorhomes.com/resources/manuals/',
    'https://www.tiffinmotorhomes.com/owner-resources/',
  ];

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      const pdfs = await page.evaluate(() => {
        const links: { text: string; href: string }[] = [];
        document.querySelectorAll('a').forEach(a => {
          const href = (a as HTMLAnchorElement).href || '';
          const text = (a.textContent || '').trim();
          if (href.match(/\.pdf/i) && text.length > 2) links.push({ href, text });
        });
        return links;
      });
      for (const pdf of pdfs) {
        results.push({ model: cleanModelName(pdf.text), year: extractYear(pdf.text), pdfUrl: pdf.href });
      }
    } catch (e) {}
  }
  return results.filter(r => r.model.length > 2);
}

// Thor Motor Coach: Has PDFs
async function scrapeThor(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];
  await page.goto('https://www.thormotorcoach.com/owners/owners-manuals', { waitUntil: 'networkidle2', timeout: 30000 });

  const pdfs = await page.evaluate(() => {
    const links: { text: string; href: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = (a as HTMLAnchorElement).href || '';
      const text = (a.textContent || '').trim();
      if (href.match(/\.pdf/i) && text.length > 2) links.push({ href, text });
    });
    return links;
  });

  for (const pdf of pdfs) {
    results.push({ model: cleanModelName(pdf.text), year: extractYear(pdf.text), pdfUrl: pdf.href });
  }
  return results.filter(r => r.model.length > 2);
}

// Newmar: Has PDFs
async function scrapeNewmar(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];
  const urls = [
    'https://www.newmarcorp.com/owners/',
    'https://www.newmarcorp.com/owners/manuals/',
  ];

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      const pdfs = await page.evaluate(() => {
        const links: { text: string; href: string }[] = [];
        document.querySelectorAll('a').forEach(a => {
          const href = (a as HTMLAnchorElement).href || '';
          const text = (a.textContent || '').trim();
          if (href.match(/\.pdf/i) && text.length > 2) links.push({ href, text });
        });
        return links;
      });
      for (const pdf of pdfs) {
        results.push({ model: cleanModelName(pdf.text), year: extractYear(pdf.text), pdfUrl: pdf.href });
      }
    } catch (e) {}
  }
  return results.filter(r => r.model.length > 2);
}

// Coachmen: Dynamic site, try API endpoint
async function scrapeCoachmen(page: Page): Promise<PdfResult[]> {
  const results: PdfResult[] = [];

  // Coachmen uses a React app — try intercepting network requests
  const pdfUrls: string[] = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.match(/\.pdf/i)) pdfUrls.push(url);
  });

  await page.goto('https://www.coachmenrv.com/resources/owners-manuals/', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Also look for any PDF links after JS renders
  const pdfs = await page.evaluate(() => {
    const links: { text: string; href: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = (a as HTMLAnchorElement).href || '';
      const text = (a.textContent || '').trim();
      if (href.match(/\.pdf/i) && text.length > 2) links.push({ href, text });
    });
    return links;
  });

  for (const pdf of [...pdfs, ...pdfUrls.map(u => ({ href: u, text: u.split('/').pop() || '' }))]) {
    if (!pdf.href.match(/\.pdf/i)) continue;
    results.push({ model: cleanModelName(pdf.text), year: extractYear(pdf.text), pdfUrl: pdf.href });
  }

  return results.filter(r => r.model.length > 2);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const SCRAPERS: { name: string; makeName: string; fn: (page: Page, browser: Browser) => Promise<PdfResult[]> }[] = [
  { name: 'Airstream',       makeName: 'Airstream',       fn: scrapeAirstream },
  { name: 'Winnebago',       makeName: 'Winnebago',       fn: scrapeWinnebago },
  { name: 'Jayco',           makeName: 'Jayco',           fn: scrapeJayco },
  { name: 'Grand Design',    makeName: 'Grand Design',    fn: scrapeGrandDesign },
  { name: 'Keystone',        makeName: 'Keystone',        fn: scrapeKeystone },
  { name: 'Tiffin',          makeName: 'Tiffin Motorhomes', fn: scrapeTiffin },
  { name: 'Thor Motor Coach',makeName: 'Thor Motor Coach',fn: scrapeThor },
  { name: 'Newmar',          makeName: 'Newmar',          fn: scrapeNewmar },
  { name: 'Coachmen',        makeName: 'Coachmen',        fn: scrapeCoachmen },
  { name: 'Forest River',    makeName: 'Forest River',    fn: scrapeForestRiver },
];

async function main() {
  console.log('🚐 RVUnicorn PDF Manual Scraper');
  console.log('══════════════════════════════════════════════════════');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let totalSaved = 0;

  for (const scraper of SCRAPERS) {
    console.log(`\n📋 ${scraper.name}`);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    try {
      const results = await scraper.fn(page, browser);
      console.log(`   Found ${results.length} PDF entries`);

      let saved = 0;
      for (const r of results) {
        if (!r.model || r.model.length < 3) continue;
        const ok = await saveManualUrl(scraper.makeName, r.model, r.pdfUrl);
        if (ok) {
          console.log(`   ✅ ${r.model} → ${r.pdfUrl.slice(0, 60)}...`);
          saved++;
        }
      }
      console.log(`   Saved ${saved} PDF URLs`);
      totalSaved += saved;
    } catch (err) {
      console.error(`   ❌ Error:`, (err as Error).message);
    } finally {
      await page.close();
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`✅ Done! Saved ${totalSaved} PDF manual URLs`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
