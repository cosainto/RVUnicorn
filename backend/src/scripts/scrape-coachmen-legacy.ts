/**
 * RVUnicorn — Coachmen Legacy PDF Scraper (2014 and under)
 * Source: https://coachmenrv.com/owners (dropdown for older models)
 * Run: npx tsx src/scripts/scrape-coachmen-legacy.ts
 */

import puppeteer, { Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const prisma = new PrismaClient();
const db = prisma as any;

// Where to save downloaded PDFs locally before uploading
const PDF_DIR = path.join(process.cwd(), 'downloads', 'coachmen-manuals');

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanName(text: string): string {
  return text
    .replace(/\b(19|20)\d{2}(\s*[-–]\s*(19|20)\d{2})?\b/g, '')
    .replace(/owner'?s?\s*manual/gi, '')
    .replace(/supplement/gi, '')
    .replace(/\.pdf/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYear(text: string): number | undefined {
  const m = text.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  return m ? parseInt(m[1]) : undefined;
}

// ─── Download a PDF to local disk ─────────────────────────────────────────────
async function downloadPdf(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        const redirectUrl = response.headers.location || '';
        if (!redirectUrl) { resolve(false); return; }
        downloadPdf(redirectUrl, destPath).then(resolve);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', () => {
      file.close();
      fs.unlink(destPath, () => {});
      resolve(false);
    });
  });
}

// ─── Save manual URL to DB ────────────────────────────────────────────────────
async function saveManual(modelName: string, pdfUrl: string): Promise<'created' | 'updated' | 'skipped'> {
  const make = await prisma.rVMake.findFirst({
    where: { name: { equals: 'Coachmen', mode: 'insensitive' } },
    include: { models: { select: { id: true, name: true } } },
  });

  if (!make) {
    console.log('    ⚠️  Coachmen make not found in DB');
    return 'skipped';
  }

  const normNew = normalizeStr(modelName);
  let bestId: string | null = null;
  let bestScore = 0;

  for (const m of make.models) {
    const normDb = normalizeStr(m.name);
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
      data: {
        makeId: make.id,
        name: modelName,
        type: make.types?.[0] || 'Travel Trailer',
        features: [],
        manualUrl: pdfUrl,
      },
    });
    return 'created';
  } catch (e: any) {
    if (e.message?.includes('Unique constraint')) return 'skipped';
    console.error(`    ❌ DB error for ${modelName}:`, e.message);
    return 'skipped';
  }
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────
async function scrapeCoachmenLegacy(page: Page) {
  console.log('\n📋 COACHMEN LEGACY (2014 and under)');
  console.log('   URL: https://coachmenrv.com/owners');

  let created = 0;
  let updated = 0;
  let downloaded = 0;

  await page.goto('https://coachmenrv.com/owners', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Dump page structure so we can see what dropdowns/selects exist
  const pageInfo = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select')).map(s => ({
      id: s.id,
      name: s.name,
      className: s.className,
      options: Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() })).slice(0, 5),
      totalOptions: s.options.length,
    }));

    const allPdfs = Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="PDF"]')).map(a => ({
      href: (a as HTMLAnchorElement).href,
      text: (a.textContent || '').trim(),
    }));

    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      id: f.id,
      action: f.action,
      fields: Array.from(f.querySelectorAll('select, input')).map(el => ({
        tag: el.tagName,
        name: (el as HTMLInputElement).name,
        id: el.id,
        type: (el as HTMLInputElement).type,
      })),
    }));

    return { selects, allPdfs, forms };
  });

  console.log('\n   Page structure:');
  console.log('   Selects:', JSON.stringify(pageInfo.selects, null, 2));
  console.log('   Direct PDFs found:', pageInfo.allPdfs.length);
  console.log('   Forms:', JSON.stringify(pageInfo.forms, null, 2));

  // If there are direct PDFs on the page, grab them first
  if (pageInfo.allPdfs.length > 0) {
    console.log(`\n   Processing ${pageInfo.allPdfs.length} direct PDF links...`);
    for (const pdf of pageInfo.allPdfs) {
      const modelName = cleanName(pdf.text);
      const year = extractYear(pdf.text) || extractYear(pdf.href);
      const fullName = year ? `${year} ${modelName}` : modelName;
      if (fullName.length < 3) continue;

      console.log(`   📄 ${fullName} → ${pdf.href.slice(0, 60)}...`);

      // Download the PDF
      const safeName = fullName.replace(/[^a-z0-9 ]/gi, '_');
      const destPath = path.join(PDF_DIR, `${safeName}.pdf`);
      const didDownload = await downloadPdf(pdf.href, destPath);
      if (didDownload) {
        downloaded++;
        console.log(`      ⬇️  Downloaded to ${destPath}`);
      }

      const status = await saveManual(fullName, pdf.href);
      if (status === 'created') created++;
      if (status === 'updated') updated++;
    }
  }

  // Work through select dropdowns
  if (pageInfo.selects.length > 0) {
    console.log(`\n   Working through ${pageInfo.selects.length} dropdowns...`);

    // Try each select — find the year one first
    for (const selectInfo of pageInfo.selects) {
      const yearOptions = selectInfo.options.filter(o => o.text.match(/\b20\d{2}\b|\b19\d{2}\b/));
      if (yearOptions.length === 0) continue;

      console.log(`   Found year dropdown: ${selectInfo.id || selectInfo.name || selectInfo.className}`);

      // Get ALL options for this select
      const allOptions = await page.evaluate((selectId, selectName) => {
        const sel = (selectId ? document.getElementById(selectId) : document.querySelector(`select[name="${selectName}"]`)) as HTMLSelectElement;
        if (!sel) return [];
        return Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() }));
      }, selectInfo.id, selectInfo.name);

      // Filter to 2014 and under
      const legacyYears = allOptions.filter(o => {
        const y = parseInt(o.text.match(/\b(19\d{2}|20\d{2})\b/)?.[1] || '0');
        return y > 1990 && y <= 2014;
      });

      console.log(`   Legacy years (≤2014): ${legacyYears.map(y => y.text).join(', ')}`);

      for (const yearOpt of legacyYears) {
        const year = parseInt(yearOpt.text.match(/\b(19\d{2}|20\d{2})\b/)?.[1] || '0');
        console.log(`\n   Year: ${year}`);

        // Select this year
        const selector = selectInfo.id
          ? `#${selectInfo.id}`
          : `select[name="${selectInfo.name}"]`;
        
        await page.select(selector, yearOpt.value);
        await new Promise(r => setTimeout(r, 1500));

        // Look for a model dropdown that appeared
        const modelDropdowns = await page.evaluate(() => {
          const selects = Array.from(document.querySelectorAll('select'));
          return selects.map(s => ({
            id: s.id,
            name: s.name,
            options: Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() })),
          })).filter(s => s.options.length > 1);
        });

        // Find the model select (not the year one)
        const modelSelect = modelDropdowns.find(s =>
          s.id !== selectInfo.id && s.name !== selectInfo.name
        );

        if (modelSelect && modelSelect.options.length > 1) {
          console.log(`   Models for ${year}: ${modelSelect.options.length - 1}`);

          for (const modelOpt of modelSelect.options) {
            if (!modelOpt.value || modelOpt.text.toLowerCase().includes('select')) continue;

            const modelSelector = modelSelect.id
              ? `#${modelSelect.id}`
              : `select[name="${modelSelect.name}"]`;

            await page.select(modelSelector, modelOpt.value).catch(() => {});
            await new Promise(r => setTimeout(r, 1000));

            // Look for PDF links that appeared
            const pdfs = await page.evaluate(() => {
              return Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="PDF"]')).map(a => ({
                href: (a as HTMLAnchorElement).href,
                text: (a.textContent || '').trim() || (a as HTMLAnchorElement).href.split('/').pop() || '',
              }));
            });

            // Pick owner's manual
            const ownerManual = pdfs.find(p =>
              p.text.toLowerCase().includes('owner') || p.href.toLowerCase().includes('owner')
            ) || pdfs[0];

            if (ownerManual) {
              const fullName = `${year} ${modelOpt.text}`;
              console.log(`      ✅ ${fullName} → ${ownerManual.href.slice(0, 55)}...`);

              // Download it
              const safeName = fullName.replace(/[^a-z0-9 ]/gi, '_');
              const destPath = path.join(PDF_DIR, `${safeName}.pdf`);
              const didDownload = await downloadPdf(ownerManual.href, destPath);
              if (didDownload) {
                downloaded++;
                console.log(`         ⬇️  Downloaded`);
              }

              const status = await saveManual(fullName, ownerManual.href);
              if (status === 'created') created++;
              if (status === 'updated') updated++;
            }
          }
        } else {
          // No model dropdown — look for PDFs directly after year selection
          const pdfs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="PDF"]')).map(a => ({
              href: (a as HTMLAnchorElement).href,
              text: (a.textContent || '').trim() || (a as HTMLAnchorElement).href.split('/').pop() || '',
            }));
          });

          for (const pdf of pdfs) {
            const modelName = cleanName(pdf.text);
            if (modelName.length < 2) continue;
            const fullName = `${year} ${modelName}`;
            console.log(`      📄 ${fullName}`);

            const safeName = fullName.replace(/[^a-z0-9 ]/gi, '_');
            const destPath = path.join(PDF_DIR, `${safeName}.pdf`);
            await downloadPdf(pdf.href, destPath);

            const status = await saveManual(fullName, pdf.href);
            if (status === 'created') created++;
            if (status === 'updated') updated++;
          }
        }
      }
    }
  }

  console.log(`\n   Coachmen Legacy done:`);
  console.log(`   Created: ${created}, Updated: ${updated}, Downloaded: ${downloaded}`);
  return { created, updated, downloaded };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚐 Coachmen Legacy Manual Scraper (≤2014)');
  console.log('══════════════════════════════════════════════════════');

  // Create download directory
  fs.mkdirSync(PDF_DIR, { recursive: true });
  console.log(`📁 PDF download dir: ${PDF_DIR}`);

  const browser = await puppeteer.launch({
    headless: false, // Run visible so you can see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    const result = await scrapeCoachmenLegacy(page);
    await page.close();

    const totalWithManual = await db.rVModel.count({ where: { manualUrl: { not: null } } });
    const pdfFiles = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));

    console.log('\n══════════════════════════════════════════════════════');
    console.log(`✅ Done!`);
    console.log(`   Created: ${result.created} new DB records`);
    console.log(`   Updated: ${result.updated} existing DB records`);
    console.log(`   PDFs downloaded: ${pdfFiles.length} files in ${PDF_DIR}`);
    console.log(`   Total models with manual URL in DB: ${totalWithManual}`);
  } finally {
    await browser.close();
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
