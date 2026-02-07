import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';
import cloudinary from 'cloudinary';

const prisma = new PrismaClient();
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

cloudinary.v2.config({
  cloud_name: 'dy6eetmh7',
  api_key: '333927774328418',
  api_secret: '9phbOjjX2YxVI43orwmWdoiCvew',
});

const SKIP_PATTERNS = [/sitemap/i, /site-map#/i, /firedanger/i, /recreation\.gov/i, /fs\.usda\.gov\/sitemap/i, /404/i, /login/i, /signin/i];

function shouldSkip(url: string): boolean {
  return SKIP_PATTERNS.some(p => p.test(url));
}

async function screenshotAndUpload(browser: any, url: string, campgroundId: string): Promise<string | null> {
  let page: any = null;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    try {
      await page.evaluate(() => {
        // @ts-ignore
        const selectors = ['[class*="cookie"] button', '[class*="consent"] button', '[class*="popup"] button[class*="close"]', 'button[aria-label="Close"]'];
        for (const sel of selectors) { const el = document.querySelector(sel) as any; if (el) el.click(); }
      });
      await delay(1000);
    } catch (e) {}

        // @ts-ignore
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) || '');
    if (bodyText.toLowerCase().includes('404') || bodyText.toLowerCase().includes('not found')) return null;

    const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.v2.uploader.upload_stream(
        { folder: 'rvunicorn/campground-maps', public_id: campgroundId, resource_type: 'image', overwrite: true, format: 'png' },
        (error: any, result: any) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(screenshotBuffer);
    });

    return result.secure_url;
  } catch (err: any) {
    console.log(`  ❌ Error: ${err.message}`);
    return null;
  } finally {
    if (page) { try { await page.close(); } catch (e) {} }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 9999;
  const dryRun = args.includes('--dry-run');

  console.log('🗺️  CONVERT EXTERNAL MAP LINKS TO CLOUDINARY IMAGES');
  console.log('====================================================');
  if (dryRun) console.log('🔍 DRY RUN\n');

  const campgrounds = await prisma.campground.findMany({
    where: { campgroundMapUrl: { not: { contains: 'cloudinary' } } },
    select: { id: true, name: true, campgroundMapUrl: true },
    take: limit,
    orderBy: { name: 'asc' },
  });

  const validCampgrounds = campgrounds.filter(cg => cg.campgroundMapUrl && !shouldSkip(cg.campgroundMapUrl));
  const skipped = campgrounds.length - validCampgrounds.length;
  if (skipped > 0) console.log(`Skipped ${skipped} known bad URLs`);
  console.log(`Processing ${validCampgrounds.length} campgrounds...\n`);

  if (dryRun) {
    validCampgrounds.slice(0, 20).forEach((cg, i) => console.log(`${i + 1}. ${cg.name}\n   ${cg.campgroundMapUrl}\n`));
    await prisma.$disconnect();
    return;
  }

  const browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  let success = 0, failed = 0;

  for (let i = 0; i < validCampgrounds.length; i++) {
    const cg = validCampgrounds[i];
    process.stdout.write(`[${i + 1}/${validCampgrounds.length}] ${cg.name}... `);

    const cloudinaryUrl = await screenshotAndUpload(browser, cg.campgroundMapUrl!, cg.id);

    if (cloudinaryUrl) {
      await prisma.campground.update({ where: { id: cg.id }, data: { campgroundMapUrl: cloudinaryUrl } });
      success++;
      console.log('✅ Saved');
    } else {
      await prisma.campground.update({ where: { id: cg.id }, data: { campgroundMapUrl: null } });
      failed++;
      console.log('❌ Failed — URL cleared');
    }

    if (i % 5 === 0 && i > 0) await delay(1000);
    if ((i + 1) % 50 === 0) console.log(`\n--- Progress: ${i + 1}/${validCampgrounds.length} | ✅ ${success} | ❌ ${failed} ---\n`);
  }

  await browser.close();
  console.log(`\n✅ Converted: ${success} | ❌ Failed: ${failed}`);
  const totalMaps = await prisma.campground.count({ where: { campgroundMapUrl: { not: null } } });
  console.log(`🗺️  Total campgrounds with maps: ${totalMaps}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
