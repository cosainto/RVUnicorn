/**
 * RVUnicorn — Re-scrape Campground Maps
 * =======================================
 * Visits campground websites, finds map pages, screenshots them,
 * uploads to Cloudinary, and saves the URL to campgroundMapUrl.
 *
 * Run: node re-scrape-maps.js
 * Resume: node re-scrape-maps.js --skip=500  (skip first 500)
 * Limit:  node re-scrape-maps.js --limit=100
 */

const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const prisma = new PrismaClient();
const PROGRESS_FILE = path.join(__dirname, 'map-scrape-progress.json');
const ERROR_FILE = path.join(__dirname, 'map-scrape-errors.json');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const skipArg = args.find(a => a.startsWith('--skip='));
const limitArg = args.find(a => a.startsWith('--limit='));
const SKIP = skipArg ? parseInt(skipArg.split('=')[1]) : 0;
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 99999;

// ─── URL patterns that indicate a map page ────────────────────────────────────
const MAP_PATH_PATTERNS = [
  '/map', '/maps', '/campground-map', '/site-map-page', '/park-map',
  '/campsite-map', '/area-map', '/trail-map', '/property-map',
  '/camp-map', '/facilities', '/sites', '/campground-layout',
];

const SKIP_URL_PATTERNS = [
  /sitemap\.xml/i, /sitemap\.html/i, /site-map#/i,
  /recreation\.gov\/site-map/i, /fs\.usda\.gov\/sitemap/i,
  /login/i, /signin/i, /firedanger/i,
];

// ─── Try to find a map link on a page ─────────────────────────────────────────
async function findMapUrl(page, baseUrl) {
  try {
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: a.textContent?.toLowerCase().trim() || '' }))
        .filter(l => l.href && l.href.startsWith('http'));
    });

    // 1. Link text says "map"
    const mapTextLink = links.find(l =>
      /\bmap\b|\bsite map\b|\bcamp map\b|\bpark map\b|\bproperty map\b/.test(l.text) &&
      !/sitemap|site-map/.test(l.href)
    );
    if (mapTextLink) return mapTextLink.href;

    // 2. URL path contains map keywords
    const mapPathLink = links.find(l =>
      MAP_PATH_PATTERNS.some(p => l.href.toLowerCase().includes(p)) &&
      !SKIP_URL_PATTERNS.some(p => p.test(l.href))
    );
    if (mapPathLink) return mapPathLink.href;

    // 3. Direct image/PDF map links
    const directMap = links.find(l =>
      /map.*\.(jpg|jpeg|png|gif|pdf|webp)/i.test(l.href) ||
      /\.(jpg|jpeg|png|gif|pdf|webp)/i.test(l.href) && /map/i.test(l.text)
    );
    if (directMap) return directMap.href;

    return null;
  } catch (e) {
    return null;
  }
}

// ─── Screenshot a page and upload to Cloudinary ───────────────────────────────
async function screenshotAndUpload(page, url, campgroundId) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    await delay(2000);

    // Dismiss cookie banners
    try {
      await page.evaluate(() => {
        const selectors = [
          '[class*="cookie"] button', '[class*="consent"] button',
          '[class*="popup"] button', 'button[aria-label*="close" i]',
          '[id*="cookie"] button', '.cc-btn', '#accept-cookies',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) el.click();
        }
      });
      await delay(800);
    } catch (e) {}

    // Check it's not a 404
    const bodyText = await page.evaluate(() =>
      document.body?.innerText?.slice(0, 300).toLowerCase() || ''
    );
    if (bodyText.includes('404') || bodyText.includes('page not found') ||
        bodyText.includes('not exist')) return null;

    // If it's a direct image URL, upload from URL
    if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) {
      const result = await cloudinary.uploader.upload(url, {
        folder: 'rvunicorn/campground-maps',
        public_id: campgroundId,
        resource_type: 'image',
        overwrite: true,
      });
      return result.secure_url;
    }

    // If it's a PDF, upload from URL
    if (/\.pdf(\?|$)/i.test(url)) {
      const result = await cloudinary.uploader.upload(url, {
        folder: 'rvunicorn/campground-maps',
        public_id: campgroundId,
        resource_type: 'image', // Cloudinary converts PDF page 1 to image
        overwrite: true,
        format: 'png',
      });
      return result.secure_url;
    }

    // Otherwise screenshot the page
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 900 },
    });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'rvunicorn/campground-maps',
          public_id: campgroundId,
          resource_type: 'image',
          overwrite: true,
          format: 'png',
        },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(screenshotBuffer);
    });

    return result.secure_url;
  } catch (err) {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🗺️  RVUnicorn Map Re-scraper');
  console.log('================================');

  // Load progress
  let progress = { done: [], errors: [] };
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log(`📂 Resuming — ${progress.done.length} already done`);
  }

  const doneSet = new Set(progress.done);

  // Fetch campgrounds with websites but no map (or skipped ones)
  console.log('📊 Loading campgrounds...');
  const campgrounds = await prisma.campground.findMany({
    where: {
      websiteUrl: { not: null },
      campgroundMapUrl: null, // only ones missing maps
    },
    select: { id: true, name: true, state: true, websiteUrl: true },
    orderBy: { name: 'asc' },
    skip: SKIP,
    take: LIMIT,
  });

  const todo = campgrounds.filter(c => !doneSet.has(c.id));
  console.log(`🎯 ${todo.length} campgrounds to process (${campgrounds.length - todo.length} already done)\n`);

  let success = 0, failed = 0, noMap = 0;
  const errors = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    // Block heavy resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    for (let i = 0; i < todo.length; i++) {
      const camp = todo[i];
      const pct = Math.round(((i + 1) / todo.length) * 100);

      process.stdout.write(
        `[${String(i + 1).padStart(5)}/${todo.length}] ${pct}% | ${camp.state || '??'} | ${camp.name.slice(0, 40).padEnd(40)} `
      );

      try {
        // Step 1: Load homepage
        await page.goto(camp.websiteUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await delay(1500);

        // Step 2: Look for a map link
        let mapUrl = await findMapUrl(page, camp.websiteUrl);

        if (!mapUrl) {
          // Try /map and /maps directly
          for (const suffix of ['/map', '/maps', '/campground-map', '/park-map']) {
            try {
              const testUrl = new URL(suffix, camp.websiteUrl).href;
              const response = await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
              if (response && response.status() === 200) {
                mapUrl = testUrl;
                break;
              }
            } catch (e) {}
          }
        }

        if (!mapUrl) {
          process.stdout.write('— no map found\n');
          noMap++;
          doneSet.add(camp.id);
          progress.done.push(camp.id);
          continue;
        }

        // Step 3: Screenshot and upload
        const cloudinaryUrl = await screenshotAndUpload(page, mapUrl, camp.id);

        if (cloudinaryUrl) {
          await prisma.campground.update({
            where: { id: camp.id },
            data: { campgroundMapUrl: cloudinaryUrl },
          });
          process.stdout.write(`✅ saved\n`);
          success++;
        } else {
          process.stdout.write(`❌ upload failed\n`);
          failed++;
          errors.push({ id: camp.id, name: camp.name, url: mapUrl });
        }
      } catch (err) {
        process.stdout.write(`❌ ${err.message?.slice(0, 50)}\n`);
        failed++;
        errors.push({ id: camp.id, name: camp.name, url: camp.websiteUrl, error: err.message });
      }

      doneSet.add(camp.id);
      progress.done.push(camp.id);
      progress.errors = errors;

      // Save progress every 25
      if ((i + 1) % 25 === 0) {
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      }

      // Small delay between campgrounds
      await delay(800);
    }

    // Final save
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    fs.writeFileSync(ERROR_FILE, JSON.stringify(errors, null, 2));

  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  console.log('\n================================');
  console.log(`✅ Saved maps:   ${success}`);
  console.log(`⛔ No map found: ${noMap}`);
  console.log(`❌ Errors:       ${failed}`);
  console.log(`📄 Errors log:   ${ERROR_FILE}`);
}

main().catch(console.error);
