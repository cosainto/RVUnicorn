/**
 * RVUnicorn — Coachmen Manual Scraper (forestriverinc.help)
 * Structure: year → category → model → owner's manual → PDFs
 * Run: npx tsx src/scripts/scrape-coachmen-forestriver.ts
 */

import puppeteer, { Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { PDFDocument } from 'pdf-lib';

const prisma = new PrismaClient();
const db = prisma as any;

const BRAND    = 'palominorv';
const BASE     = 'https://forestriverinc.help';
const MAKE     = 'Palomino';
const PDF_DIR  = path.join(process.cwd(), 'downloads', 'coachmen-forestriver');
const YEARS    = Array.from({ length: 12 }, (_, i) => 2026 - i); // 2024–2015
const CATEGORIES = ['camping_trailer', 'fifth_wheel', 'motorhome', 'toy_hauler', 'travel_trailer'];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function safe(s: string)   { return s.replace(/[^a-z0-9 ]/gi, '_').replace(/\s+/g, '_').slice(0, 80); }

// ─── Hash-navigate and wait for new links to appear ──────────────────────────
async function hashGoto(page: Page, hash: string, waitMs = 3000) {
  const url = `https://forestriverinc.help/#${hash}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(waitMs);
}

// ─── Get all links whose href matches a pattern ───────────────────────────────
async function getLinks(page: Page, pattern: RegExp): Promise<{ text: string; href: string }[]> {
  return page.evaluate((pat: string) => {
    const re = new RegExp(pat);
    const found: { text: string; href: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      const href = (a as HTMLAnchorElement).href || '';
      const text = (a.textContent || '').trim();
      if (re.test(href)) found.push({ text, href });
    });
    return [...new Map(found.map(l => [l.href, l])).values()];
  }, pattern.source);
}

// ─── Download a PDF ───────────────────────────────────────────────────────────
async function downloadPdf(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    const get = (u: string) => {
      const proto = u.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      proto.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close(); fs.unlink(dest, () => {});
          get(res.headers.location || ''); return;
        }
        if (res.statusCode !== 200) {
          file.close(); fs.unlink(dest, () => {}); resolve(false); return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      }).on('error', () => { file.close(); fs.unlink(dest, () => {}); resolve(false); });
    };
    get(url);
  });
}

// ─── Merge PDFs into one ──────────────────────────────────────────────────────
async function mergePdfs(paths: string[], outPath: string): Promise<boolean> {
  try {
    const merged = await PDFDocument.create();
    for (const p of paths) {
      if (!fs.existsSync(p)) continue;
      const doc = await PDFDocument.load(fs.readFileSync(p), { ignoreEncryption: true });
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(pg => merged.addPage(pg));
    }
    fs.writeFileSync(outPath, await merged.save());
    return true;
  } catch (e: any) {
    console.error(`   ❌ Merge failed: ${e.message}`);
    return false;
  }
}

// ─── Save manual URL to DB ────────────────────────────────────────────────────
async function saveManual(modelName: string, year: number, pdfUrl: string): Promise<'created' | 'updated' | 'skipped'> {
  const make = await prisma.rVMake.findFirst({
    where: { name: { equals: MAKE, mode: 'insensitive' } },
    include: { models: { select: { id: true, name: true } } },
  });
  if (!make) return 'skipped';

  const fullName = `${year} ${modelName}`;
  const normNew = fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
  let bestId: string | null = null;
  let bestScore = 0;

  for (const m of make.models) {
    const normDb = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normDb === normNew) { bestId = m.id; bestScore = 999; break; }
    if (normDb.includes(normNew) || normNew.includes(normDb)) {
      const score = Math.min(normDb.length, normNew.length);
      if (score > bestScore) { bestScore = score; bestId = m.id; }
    }
  }

  if (bestId && bestScore >= 4) {
    await db.rVModel.update({ where: { id: bestId }, data: { manualUrl: pdfUrl } });
    return 'updated';
  }

  try {
    await db.rVModel.create({
      data: { makeId: make.id, name: fullName, type: make.types?.[0] || 'Travel Trailer', features: [], manualUrl: pdfUrl },
    });
    return 'created';
  } catch (e: any) {
    if (e.message?.includes('Unique constraint')) return 'skipped';
    return 'skipped';
  }
}

// ─── Process one model page → find owner's manual → download & merge PDFs ────
async function processModel(page: Page, modelHref: string, modelName: string, year: number) {
  const hash = '/' + modelHref.split('#/')[1];

  // Go to model page
  await hashGoto(page, hash, 2500);

  // PDFs are S3 links directly on the /browse page
  // Look for s3.amazonaws.com PDF links (English only)
  const allLinks = await getLinks(page, /.+/);
  const pdfLinks = allLinks.filter(l =>
    l.href.includes('s3.amazonaws.com') &&
    l.href.includes('/pdf/') &&
    !l.href.includes('/fr_ca/') &&  // skip French
    !l.href.includes('/fr/')
  );

  if (pdfLinks.length === 0) {
    // Save the forestriverinc.help guide page — user lands directly on the model page
    const guideUrl = `https://forestriverinc.help/#/coachmenrv/guide/${year}`;
    console.log(`         📄 Saving guide page URL`);
    await saveManual(modelName, year, guideUrl);
    return;
  }

  // Save S3 URL directly — no download needed
  console.log(`         ✅ S3 URL saved`);
  await saveManual(modelName, year, pdfLinks[0].href);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚐 Coachmen Manual Scraper — forestriverinc.help');
  console.log('══════════════════════════════════════════════════════');
  fs.mkdirSync(PDF_DIR, { recursive: true });
  console.log(`📁 Output: ${PDF_DIR}\n`);

  const browser = await puppeteer.launch({ protocolTimeout: 60000,
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 900 },
  });

  let totalCreated = 0;
  let totalUpdated = 0;

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // Load app once
    console.log('Loading app...');
    await page.goto(`${BASE}/#/${BRAND}/vehicles/2025`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(4000);

    for (const year of YEARS) {
      console.log(`\n📅 Year: ${year}`);

      for (const category of CATEGORIES) {
        // Navigate to year/category page
        const catHash = `/${BRAND}/vehicles/${year}/${category}`;
        await hashGoto(page, catHash, 4000);

        // Get individual model links for this category
        // Model links look like: #/coachmenrv/vehicles/2025/travel_trailer/Freedom_Express_224RBS
        const modelPattern = new RegExp(`/${BRAND}/guide/${year}/\\d+-[a-z]`);
        const modelLinks = await getLinks(page, modelPattern);

        if (modelLinks.length === 0) {
          console.log(`   ${category}: no models`);
          continue;
        }

        console.log(`   ${category}: ${modelLinks.length} models`);

        for (const model of modelLinks) {
          // Clean up model name from URL slug
          const modelName = model.text.trim();
          console.log(`\n      🚐 ${year} ${modelName}`);

          await processModel(page, model.href, modelName, year);

          // Count what was saved
          const existing = await db.rVModel.findFirst({
            where: {
              name: { contains: modelName, mode: 'insensitive' },
              make: { name: { equals: MAKE, mode: 'insensitive' } },
              manualUrl: { not: null },
            },
          });
          if (existing) totalUpdated++;
          else totalCreated++;

          await sleep(2000);
        }
      }
    }
  } finally {
    await browser.close();
  }

  const totalWithManual = await db.rVModel.count({ where: { manualUrl: { not: null } } });
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`✅ Done!`);
  console.log(`   Total models with manual URL in DB: ${totalWithManual}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
