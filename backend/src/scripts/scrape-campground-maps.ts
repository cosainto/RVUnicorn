/**
 * RVUnicorn — Campground Map Scraper
 * =====================================
 * 
 * Finds campground site maps from:
 *   1. Campground's own website (links to PDF/images with "map" in text)
 *   2. Google search "[campground name] campground site map"
 *   3. Recreation.gov map pages (for federal campgrounds)
 * 
 * Uploads maps (PDF or image) to Cloudinary and saves URL.
 * Progress saved. Ctrl+C safe.
 * 
 * Run: npx tsx src/scripts/scrape-campground-maps.ts
 * Options: --limit=500   (process N campgrounds)
 *          --state=TX    (only one state)
 * 
 * Requires: npm install puppeteer
 */

import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient() as any;
const PROGRESS_FILE = path.join(__dirname, 'map-scraper-progress.json');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dy6eetmh7',
  api_key: process.env.CLOUDINARY_API_KEY || '333927774328418',
  api_secret: process.env.CLOUDINARY_API_SECRET || '9phbOjjX2YxVI43orwmWdoiCvew',
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || '';

// ═══════════════════════════════════════════════════════════
// MAP LINK PATTERNS
// ═══════════════════════════════════════════════════════════
// Good map link patterns
const MAP_LINK_TEXT = [
  'site map', 'campground map', 'park map', 'resort map',
  'facility map', 'property map', 'trail map', 'area map',
  'map of campground', 'map of park', 'view map', 'download map',
  'camp map', 'rv park map', 'rv map', 'layout map',
];

// Bad generic links to skip
const BAD_MAP_URLS = [
  /recreation\.gov\/site-?map/i,
  /recreation\.gov\/sitemap/i,
  /\.gov\/sitemap/i,
  /google\.com\/maps/i,
  /goo\.gl\/maps/i,
  /bing\.com\/maps/i,
  /mapquest\.com/i,
  /\/sitemap\.xml/i,
  /\/sitemap\.html/i,
  /#main-content/i,
  /facebook\.com/i,
  /twitter\.com/i,
  /instagram\.com/i,
];

function isGoodMapUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  if (BAD_MAP_URLS.some(re => re.test(url))) return false;
  // Must be a PDF, image, or page likely containing a map
  const lower = url.toLowerCase();
  return lower.endsWith('.pdf') || 
         lower.endsWith('.jpg') || 
         lower.endsWith('.jpeg') || 
         lower.endsWith('.png') ||
         lower.endsWith('.webp') ||
         lower.includes('map') ||
         lower.includes('layout') ||
         lower.includes('sitemap') && !lower.includes('sitemap.xml');
}

// ═══════════════════════════════════════════════════════════
// PROGRESS
// ═══════════════════════════════════════════════════════════
interface Progress {
  lastId: string | null;
  processed: number;
  mapsFound: number;
  mapsFromWebsite: number;
  mapsFromGoogle: number;
  failed: number;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {}
  return { lastId: null, processed: 0, mapsFound: 0, mapsFromWebsite: 0, mapsFromGoogle: 0, failed: 0 };
}

function saveProgress(p: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ═══════════════════════════════════════════════════════════
// SCRAPE MAP FROM WEBSITE
// ═══════════════════════════════════════════════════════════
async function findMapOnWebsite(page: any, websiteUrl: string): Promise<string | null> {
  try {
    await page.goto(websiteUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await delay(1500);

    // Strategy 1: Find links with "map" text pointing to PDFs/images
    const mapUrl = await page.evaluate((mapTexts: string[], badPatterns: string[]) => {
      const links = Array.from(document.querySelectorAll('a'));
      
      // Score each link
      const candidates: { url: string; score: number }[] = [];
      
      for (const link of links) {
        const href = link.href || '';
        const text = (link.textContent || '').toLowerCase().trim();
        const title = (link.title || '').toLowerCase();
        
        if (!href || !href.startsWith('http')) continue;
        
        // Check if any bad pattern matches
        let isBad = false;
        for (const pattern of badPatterns) {
          if (new RegExp(pattern, 'i').test(href)) { isBad = true; break; }
        }
        if (isBad) continue;

        let score = 0;
        
        // Text matches
        for (const mapText of mapTexts) {
          if (text.includes(mapText)) score += 10;
          if (title.includes(mapText)) score += 5;
        }
        
        // URL matches
        const hrefLower = href.toLowerCase();
        if (hrefLower.endsWith('.pdf') && hrefLower.includes('map')) score += 15;
        if (hrefLower.endsWith('.pdf')) score += 5;
        if (hrefLower.endsWith('.jpg') && hrefLower.includes('map')) score += 12;
        if (hrefLower.endsWith('.png') && hrefLower.includes('map')) score += 12;
        if (hrefLower.includes('campground-map') || hrefLower.includes('campground_map')) score += 15;
        if (hrefLower.includes('site-map') && !hrefLower.includes('sitemap.xml')) score += 10;
        if (hrefLower.includes('park-map') || hrefLower.includes('park_map')) score += 10;
        if (hrefLower.includes('facility-map')) score += 10;
        
        if (score > 0) candidates.push({ url: href, score });
      }
      
      // Strategy 2: Find images that look like maps
      const imgs = Array.from(document.querySelectorAll('img'));
      for (const img of imgs) {
        const src = img.src || '';
        const alt = (img.alt || '').toLowerCase();
        if (!src.startsWith('http')) continue;
        
        const srcLower = src.toLowerCase();
        let score = 0;
        
        if ((alt.includes('map') || alt.includes('layout') || alt.includes('site plan')) && img.naturalWidth > 500) score += 12;
        if (srcLower.includes('map') && img.naturalWidth > 500) score += 8;
        if (srcLower.includes('campground-map') || srcLower.includes('site-map')) score += 15;
        
        if (score > 0) candidates.push({ url: src, score });
      }
      
      // Return highest scoring candidate
      candidates.sort((a, b) => b.score - a.score);
      return candidates.length > 0 ? candidates[0].url : null;
    }, MAP_LINK_TEXT, BAD_MAP_URLS.map(r => r.source));

    // If we found a map link on the main page, check if there's a dedicated map page too
    if (!mapUrl) {
      // Try clicking through to a map/gallery page
      const subpageUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          const text = (link.textContent || '').toLowerCase().trim();
          const href = (link.href || '').toLowerCase();
          if ((text === 'map' || text === 'maps' || text === 'campground map' || text === 'site map' || text === 'park map') &&
              href.startsWith('http') && !href.includes('google.com') && !href.includes('maps.google')) {
            return link.href;
          }
        }
        return null;
      });

      if (subpageUrl) {
        try {
          await page.goto(subpageUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          await delay(1000);

          // Look for map on the subpage
          const subpageMap = await page.evaluate(() => {
            // Check for PDFs
            const links = Array.from(document.querySelectorAll('a'));
            for (const link of links) {
              const href = (link.href || '').toLowerCase();
              if (href.endsWith('.pdf')) return link.href;
            }
            // Check for large images
            const imgs = Array.from(document.querySelectorAll('img'));
            for (const img of imgs) {
              if (img.naturalWidth > 600 && img.src.startsWith('http')) return img.src;
            }
            return null;
          });

          if (subpageMap) return subpageMap;
        } catch {}
      }
    }

    return mapUrl;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// SEARCH GOOGLE FOR MAP
// ═══════════════════════════════════════════════════════════
async function findMapViaGoogle(page: any, campName: string, state: string): Promise<string | null> {
  if (!campName) return null;

  try {
    const query = `${campName} ${state || ''} campground site map filetype:pdf OR filetype:jpg`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(2000);

    const mapUrl = await page.evaluate((badPatterns: string[]) => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const href = link.href || '';
        if (!href.startsWith('http')) continue;
        
        // Check if bad
        let isBad = false;
        for (const pattern of badPatterns) {
          if (new RegExp(pattern, 'i').test(href)) { isBad = true; break; }
        }
        if (isBad) continue;

        const hrefLower = href.toLowerCase();
        if ((hrefLower.endsWith('.pdf') || hrefLower.endsWith('.jpg') || hrefLower.endsWith('.png')) &&
            (hrefLower.includes('map') || hrefLower.includes('layout') || hrefLower.includes('site-plan'))) {
          return href;
        }
      }
      return null;
    }, BAD_MAP_URLS.map(r => r.source));

    return mapUrl;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// UPLOAD MAP TO CLOUDINARY
// ═══════════════════════════════════════════════════════════
async function uploadMap(mapUrl: string, campgroundId: string): Promise<string | null> {
  try {
    const isPdf = mapUrl.toLowerCase().endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(mapUrl);

    const result = await cloudinary.uploader.upload(mapUrl, {
      folder: 'rvunicorn/campground-maps',
      public_id: campgroundId,
      resource_type: isPdf ? 'raw' : 'image',
      timeout: 60000,
      ...(isImage ? { transformation: [{ width: 3000, height: 3000, crop: 'limit' }, { quality: 'auto:good' }] } : {}),
    });

    return result.secure_url;
  } catch (e: any) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🗺️  Campground Map Scraper');
  console.log('═'.repeat(60));

  const args = process.argv.slice(2);
  let limitArg = Infinity;
  let stateFilter: string | null = null;
  for (const arg of args) {
    if (arg.startsWith('--limit=')) limitArg = parseInt(arg.split('=')[1]);
    if (arg.startsWith('--state=')) stateFilter = arg.split('=')[1];
  }

  const progress = loadProgress();

  // Stats
  const totalCamps = await prisma.campground.count();
  const withMaps = await prisma.campground.count({ where: { campgroundMapUrl: { not: null } } });
  const withWebsite = await prisma.campground.count({ where: { websiteUrl: { not: null } } });
  console.log(`\n  Total campgrounds: ${totalCamps}`);
  console.log(`  With maps already: ${withMaps}`);
  console.log(`  With website: ${withWebsite}`);

  // Load puppeteer
  let puppeteer: any;
  let browser: any;
  try {
    puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch {
    console.log('  ❌ Puppeteer required. Run: npm install puppeteer');
    return;
  }

  // Get campgrounds without maps
  const where: any = {
    campgroundMapUrl: null,
    websiteUrl: { not: null },
  };
  if (stateFilter) where.state = stateFilter;
  if (progress.lastId) where.id = { gt: progress.lastId };

  const campgrounds = await prisma.campground.findMany({
    where,
    orderBy: { id: 'asc' },
    select: { id: true, name: true, state: true, websiteUrl: true },
    take: Math.min(limitArg, 20000),
  });

  console.log(`  To process: ${campgrounds.length}\n`);

  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];
    const page = await browser.newPage();

    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });

      let mapUrl: string | null = null;
      let source = '';

      // Strategy 1: Find map on campground's own website
      mapUrl = await findMapOnWebsite(page, camp.websiteUrl!);
      if (mapUrl && isGoodMapUrl(mapUrl)) {
        source = 'website';
      } else {
        mapUrl = null;
      }

      // Strategy 2: Google search if no map found on website
      if (!mapUrl) {
        mapUrl = await findMapViaGoogle(page, camp.name, camp.state || '');
        if (mapUrl && isGoodMapUrl(mapUrl)) {
          source = 'google';
        } else {
          mapUrl = null;
        }
      }

      // Upload if found
      if (mapUrl) {
        const cloudinaryUrl = await uploadMap(mapUrl, camp.id);
        if (cloudinaryUrl) {
          await prisma.campground.update({
            where: { id: camp.id },
            data: { campgroundMapUrl: cloudinaryUrl },
          });
          progress.mapsFound++;
          if (source === 'website') progress.mapsFromWebsite++;
          else progress.mapsFromGoogle++;
        } else {
          progress.failed++;
        }
      }

    } catch {
      // Skip failures
    } finally {
      await page.close();
    }

    progress.lastId = camp.id;
    progress.processed++;

    if ((i + 1) % 25 === 0) {
      saveProgress(progress);
      console.log(`  ${i + 1}/${campgrounds.length} | Maps: ${progress.mapsFound} (website: ${progress.mapsFromWebsite}, google: ${progress.mapsFromGoogle}) | Failed: ${progress.failed}`);
    }

    await delay(800); // Polite rate limiting
  }

  await browser.close();
  saveProgress(progress);

  const finalWithMaps = await prisma.campground.count({ where: { campgroundMapUrl: { not: null } } });

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ MAP SCRAPING COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Processed: ${progress.processed}`);
  console.log(`  Maps found: ${progress.mapsFound}`);
  console.log(`    From website: ${progress.mapsFromWebsite}`);
  console.log(`    From Google: ${progress.mapsFromGoogle}`);
  console.log(`  Failed uploads: ${progress.failed}`);
  console.log(`  Total with maps: ${finalWithMaps}/${totalCamps}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
