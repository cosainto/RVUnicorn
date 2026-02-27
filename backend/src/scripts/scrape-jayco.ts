/**
 * Jayco Owner Manual Scraper
 * Source: https://www.jayco.com/manuals/
 * Run: npx tsx src/scripts/scrape-jayco.ts
 */

import puppeteer from 'puppeteer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma as any;
const MAKE = 'Jayco';
const YEARS = Array.from({ length: 12 }, (_, i) => 2026 - i); // 2026–2015

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function saveManual(modelName: string, year: number, url: string) {
  const make = await db.rVMake.upsert({
    where: { name: MAKE },
    create: { name: MAKE },
    update: {},
  });

  const models = await db.rVModel.findMany({
    where: { makeId: make.id },
    select: { id: true, name: true },
  });

  const normTarget = normalize(modelName);
  const match = models.find((m: any) => normalize(m.name).includes(normTarget) || normTarget.includes(normalize(m.name)));

  if (match) {
    await db.rVModel.update({ where: { id: match.id }, data: { manualUrl: url } });
  } else {
    await db.rVModel.create({
      data: { name: `${year} ${modelName}`, makeId: make.id, manualUrl: url, type: 'unknown' },
    });
  }
}

async function main() {
  console.log(`🚐 Jayco Manual Scraper`);
  console.log('══════════════════════════════════════════════════════');

  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 60000 });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  let totalWithManual = 0;

  for (const year of YEARS) {
    console.log(`\n📅 Year: ${year}`);

    try {
      await page.goto(`https://www.jayco.com/manuals/?year=${year}`, {
        waitUntil: 'networkidle2', timeout: 30000
      });
      await sleep(2000);

      // Get all model links on the page
      const modelLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim() || '',
          href: (a as HTMLAnchorElement).href,
        })).filter(l =>
          l.href.includes('jayco.com/manuals') &&
          l.href.includes('model=') &&
          l.text.length > 0
        );
      });

      if (modelLinks.length === 0) {
        // Try getting PDF links directly
        const pdfLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent?.trim() || '',
            href: (a as HTMLAnchorElement).href,
          })).filter(l => l.href.includes('.pdf') || l.href.includes('manual'));
        });

        if (pdfLinks.length > 0) {
          console.log(`   Found ${pdfLinks.length} direct PDF links`);
          for (const link of pdfLinks) {
            await saveManual(link.text || `${year} Jayco`, year, link.href);
          }
        } else {
          // Save the year's manual page as fallback
          console.log(`   No models found — saving year page URL`);
          await saveManual(`Jayco ${year}`, year, `https://www.jayco.com/manuals/?year=${year}`);
        }
        continue;
      }

      console.log(`   Found ${modelLinks.length} models`);

      for (const link of modelLinks) {
        console.log(`\n      🚐 ${year} ${link.text}`);

        try {
          await page.goto(link.href, { waitUntil: 'networkidle2', timeout: 30000 });
          await sleep(1500);

          // Find PDF link on model page
          const pdfLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const pdf = links.find(a => (a as HTMLAnchorElement).href.includes('.pdf'));
            return pdf ? (pdf as HTMLAnchorElement).href : null;
          });

          if (pdfLink) {
            console.log(`         ✅ PDF found`);
            await saveManual(link.text, year, pdfLink);
          } else {
            console.log(`         📄 Saving page URL`);
            await saveManual(link.text, year, link.href);
          }
        } catch (e: any) {
          console.log(`         ⚠️  Error: ${e.message?.slice(0, 50)}`);
          await saveManual(link.text, year, link.href);
        }

        await sleep(1000);
      }
    } catch (e: any) {
      console.log(`   ⚠️  Year ${year} failed: ${e.message?.slice(0, 60)}`);
      await saveManual(`Jayco ${year}`, year, `https://www.jayco.com/manuals/?year=${year}`);
    }
  }

  totalWithManual = await db.rVModel.count({ where: { manualUrl: { not: null } } });

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`✅ Done!`);
  console.log(`   Total models with manual URL in DB: ${totalWithManual}`);

  await browser.close();
  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
