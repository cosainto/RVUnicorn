/**
 * RVUnicorn — Robust Campground Photo Scraper
 * ==============================================
 * 
 * Scrapes up to 8 photos per campground from their websites.
 * - Restarts browser every 25 campgrounds
 * - Recovers from any crash
 * - Progress saved. Ctrl+C safe.
 * 
 * Run: npx tsx src/scripts/scrape-photos-robust.ts
 * Options: --limit=500  --state=TX
 */

import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const PROGRESS_FILE = path.join(__dirname, 'photo-scraper-progress.json');
const MAX_PHOTOS = 8;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dy6eetmh7',
  api_key: process.env.CLOUDINARY_API_KEY || '333927774328418',
  api_secret: process.env.CLOUDINARY_API_SECRET || '9phbOjjX2YxVI43orwmWdoiCvew',
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Patterns to exclude
const EXCLUDE = [
  /logo/i, /icon/i, /favicon/i, /sprite/i, /button/i, /avatar/i, /badge/i,
  /facebook/i, /twitter/i, /instagram/i, /youtube/i, /pinterest/i, /linkedin/i,
  /google/i, /yelp/i, /tripadvisor/i, /payment/i, /visa/i, /mastercard/i,
  /paypal/i, /ssl/i, /widget/i, /pixel/i, /tracking/i, /analytics/i,
  /\.gif$/i, /\.svg$/i, /data:image/i, /placeholder/i, /spinner/i,
  /arrow/i, /chevron/i, /close/i, /menu/i, /1x1/i, /spacer/i,
  /advertisement/i, /banner-ad/i,
];

// Good campground photo indicators
const GOOD_PHOTO = [
  /campground/i, /campsite/i, /cabin/i, /rv/i, /tent/i, /lodge/i,
  /pool/i, /lake/i, /river/i, /trail/i, /nature/i, /outdoor/i,
  /park/i, /scenic/i, /gallery/i, /photo/i, /hero/i, /slide/i, /feature/i,
];

interface Progress {
  lastId: string | null;
  processed: number;
  scraped: number;
  photosUploaded: number;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {}
  return { lastId: null, processed: 0, scraped: 0, photosUploaded: 0 };
}

function saveProgress(p: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

async function launchBrowser(puppeteer: any) {
  return puppeteer.launch({
    headless: 'new',
    protocolTimeout: 120000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--single-process',
    ],
  });
}

async function scrapeSite(browser: any, websiteUrl: string): Promise<string[]> {
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    // Block unnecessary resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const type = req.resourceType();
      if (['stylesheet', 'font', 'media', 'websocket'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(2000);

    // Extract images
    const images: { src: string; width: number; height: number; alt: string }[] = await page.evaluate((minW: number, minH: number) => {
      const imgs: any[] = [];
      
      // Regular img tags
      document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
        if (img.src && img.src.startsWith('http')) {
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w >= minW || h >= minH || (w === 0 && h === 0)) {
            imgs.push({ src: img.src, width: w, height: h, alt: img.alt || '' });
          }
        }
      });

      // Background images
      document.querySelectorAll('[style*="background"]').forEach(el => {
        try {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundImage;
          const match = bg.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
          if (match) {
            imgs.push({ src: match[1], width: (el as HTMLElement).offsetWidth || 0, height: (el as HTMLElement).offsetHeight || 0, alt: '' });
          }
        } catch {}
      });

      // Srcset images
      document.querySelectorAll('source[srcset], img[srcset]').forEach(el => {
        const srcset = (el as HTMLSourceElement).srcset || '';
        srcset.split(',').forEach(s => {
          const url = s.trim().split(' ')[0];
          if (url && url.startsWith('http')) {
            imgs.push({ src: url, width: 0, height: 0, alt: '' });
          }
        });
      });

      return imgs;
    }, 300, 200);

    // Also try to find a gallery/photos page and scrape that too
    const galleryUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = (link.textContent || '').toLowerCase().trim();
        const href = link.href || '';
        if ((text.includes('gallery') || text.includes('photos') || text.includes('photo gallery') || text.includes('pictures')) &&
            href.startsWith('http')) {
          return href;
        }
      }
      return null;
    });

    if (galleryUrl) {
      try {
        await page.goto(galleryUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await delay(2000);
        
        const galleryImages: { src: string; width: number; height: number; alt: string }[] = await page.evaluate((minW: number, minH: number) => {
          const imgs: any[] = [];
          document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
            if (img.src && img.src.startsWith('http')) {
              const w = img.naturalWidth || img.width || 0;
              const h = img.naturalHeight || img.height || 0;
              if (w >= minW || h >= minH || (w === 0 && h === 0)) {
                imgs.push({ src: img.src, width: w, height: h, alt: img.alt || '' });
              }
            }
          });
          return imgs;
        }, 300, 200);
        
        images.push(...galleryImages);
      } catch {}
    }

    await page.close();
    page = null;

    // Filter, score, deduplicate
    const seen = new Set<string>();
    const scored: { url: string; score: number }[] = [];

    for (const img of images) {
      if (seen.has(img.src)) continue;
      seen.add(img.src);
      if (EXCLUDE.some(p => p.test(img.src))) continue;

      let score = 0;
      if (GOOD_PHOTO.some(p => p.test(img.src) || p.test(img.alt))) score += 10;
      score += Math.min(img.width * img.height / 100000, 10); // Size bonus
      scored.push({ url: img.src, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_PHOTOS).map(s => s.url);

  } catch (e) {
    if (page) try { await page.close(); } catch {}
    return [];
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  📸 Robust Campground Photo Scraper');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  let limitArg = Infinity;
  let stateFilter: string | null = null;
  for (const arg of args) {
    if (arg.startsWith('--limit=')) limitArg = parseInt(arg.split('=')[1]);
    if (arg.startsWith('--state=')) stateFilter = arg.split('=')[1];
  }

  const progress = loadProgress();

  // System user
  let sys = await prisma.user.findFirst({ where: { username: 'rvunicorn-system' } });
  if (!sys) {
    sys = await prisma.user.create({
      data: { email: 'system@rvunicorn.com', username: 'rvunicorn-system', firstName: 'RVUnicorn', lastName: 'System', password: 'SYSTEM_NO_LOGIN_' + Date.now() },
    });
  }

  // Get photo counts
  const photoCounts = await prisma.campgroundPhoto.groupBy({
    by: ['campgroundId'],
    _count: { id: true },
  });
  const photoMap = new Map(photoCounts.map(p => [p.campgroundId, p._count.id]));

  // Get campgrounds needing photos
  const where: any = { websiteUrl: { not: null } };
  if (stateFilter) where.state = stateFilter;
  if (progress.lastId) where.id = { gt: progress.lastId };

  const campgrounds = await prisma.campground.findMany({
    where,
    orderBy: { id: 'asc' },
    select: { id: true, name: true, websiteUrl: true },
    take: Math.min(limitArg, 50000),
  });

  // Filter to those with < MAX_PHOTOS
  const needsPhotos = campgrounds.filter(c => (photoMap.get(c.id) || 0) < MAX_PHOTOS);

  console.log(`  Total with website: ${campgrounds.length}`);
  console.log(`  Need photos (< ${MAX_PHOTOS}): ${needsPhotos.length}`);
  console.log(`  Resuming from: ${progress.lastId || 'beginning'}`);
  console.log('');

  // Load puppeteer
  let puppeteer: any;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.log('  ❌ Run: npm install puppeteer');
    return;
  }

  let browser = await launchBrowser(puppeteer);
  let browserAge = 0;

  for (let i = 0; i < needsPhotos.length; i++) {
    const camp = needsPhotos[i];
    const existingCount = photoMap.get(camp.id) || 0;

    // Restart browser every 25 campgrounds
    browserAge++;
    if (browserAge >= 25) {
      try { await browser.close(); } catch {}
      await delay(1000);
      browser = await launchBrowser(puppeteer);
      browserAge = 0;
    }

    try {
      const imageUrls = await scrapeSite(browser, camp.websiteUrl!);
      const toUpload = imageUrls.slice(0, MAX_PHOTOS - existingCount);

      let added = 0;
      for (const imgUrl of toUpload) {
        try {
          const result = await cloudinary.uploader.upload(imgUrl, {
            folder: `campgrounds/${camp.id}`,
            resource_type: 'image',
            timeout: 30000,
            transformation: [{ width: 1920, height: 1080, crop: 'limit' }, { quality: 'auto:good' }],
          });

          await prisma.campgroundPhoto.create({
            data: {
              campgroundId: camp.id,
              userId: sys!.id,
              imageUrl: result.secure_url,
              status: 'APPROVED',
            },
          });

          added++;
          progress.photosUploaded++;
        } catch {
          // Upload failed — skip this image
        }
      }

      if (added > 0) progress.scraped++;

    } catch (e: any) {
      // Browser might have crashed — restart it
      try { await browser.close(); } catch {}
      await delay(2000);
      try {
        browser = await launchBrowser(puppeteer);
        browserAge = 0;
      } catch {
        console.log('  ❌ Browser failed to restart, waiting 10s...');
        await delay(10000);
        browser = await launchBrowser(puppeteer);
        browserAge = 0;
      }
    }

    progress.lastId = camp.id;
    progress.processed++;

    if ((i + 1) % 25 === 0) {
      saveProgress(progress);
      console.log(`  ${i + 1}/${needsPhotos.length} | Scraped: ${progress.scraped} | Photos: ${progress.photosUploaded}`);
    }

    await delay(300);
  }

  try { await browser.close(); } catch {}
  saveProgress(progress);

  const totalPhotos = await prisma.campgroundPhoto.count();
  console.log('\n' + '='.repeat(60));
  console.log('  ✅ PHOTO SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Processed: ${progress.processed}`);
  console.log(`  Scraped: ${progress.scraped}`);
  console.log(`  Photos uploaded: ${progress.photosUploaded}`);
  console.log(`  Total photos in DB: ${totalPhotos}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
