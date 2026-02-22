/**
 * RVUnicorn — Camp Store URL Scraper
 * ====================================
 * Visits each campground website and looks for a store / shop link.
 * Saves the URL to campground.storeUrl in the database.
 *
 * Run:   node scrape-store-urls.js
 * Test:  node scrape-store-urls.js --limit=30
 * Resume: automatically resumes from progress file
 */

const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const prisma = new PrismaClient();
const PROGRESS_FILE = path.join(__dirname, 'store-scrape-progress.json');
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 99999;

// ─── Keywords that suggest a store page ──────────────────────────────────────
const STORE_LINK_TEXT = [
  /\bstore\b/i, /\bshop\b/i, /\bcamp store\b/i, /\bgear\b/i,
  /\bgeneral store\b/i, /\boutfitter\b/i, /\bsupplies\b/i,
  /\bmerchandise\b/i, /\bmerch\b/i, /\bcamp shop\b/i,
];

const STORE_URL_PATTERNS = [
  /\/store\b/i, /\/shop\b/i, /\/camp-store/i, /\/campstore/i,
  /\/general-store/i, /\/outfitter/i, /\/merchandise/i, /\/merch/i,
  /\/supplies/i, /\/gear/i,
];

// Skip external shopping platforms that aren't the campground's own store
const SKIP_DOMAINS = [
  'amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com',
  'facebook.com', 'instagram.com', 'twitter.com', 'youtube.com',
  'google.com', 'yelp.com', 'tripadvisor.com',
];

function isSkippableDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return SKIP_DOMAINS.some(d => hostname.includes(d));
  } catch { return true; }
}

function isSameDomain(url, baseUrl) {
  try {
    return new URL(url).hostname === new URL(baseUrl).hostname;
  } catch { return false; }
}

// ─── Find store link on a page ────────────────────────────────────────────────
async function findStoreUrl(page, baseUrl) {
  try {
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map(a => ({
        href: a.href,
        text: a.textContent?.trim().toLowerCase() || '',
        title: (a.getAttribute('title') || '').toLowerCase(),
      })).filter(l => l.href && l.href.startsWith('http'))
    );

    // 1. Link text explicitly says "store" or "shop"
    const byText = links.find(l =>
      STORE_LINK_TEXT.some(p => p.test(l.text) || p.test(l.title)) &&
      !isSkippableDomain(l.href)
    );
    if (byText) return byText.href;

    // 2. URL path contains store keywords (same domain only)
    const byPath = links.find(l =>
      STORE_URL_PATTERNS.some(p => p.test(l.href)) &&
      isSameDomain(l.href, baseUrl) &&
      !isSkippableDomain(l.href)
    );
    if (byPath) return byPath.href;

    return null;
  } catch { return null; }
}

// ─── Try common store paths directly ─────────────────────────────────────────
async function tryDirectPaths(page, baseUrl) {
  const paths = ['/store', '/shop', '/camp-store', '/campstore', '/general-store', '/outfitter', '/gear'];
  for (const p of paths) {
    try {
      const testUrl = new URL(p, baseUrl).href;
      const res = await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
      if (res && res.status() === 200) {
        // Verify it's actually a store page, not just a 200 on the homepage
        const text = await page.evaluate(() => document.body?.innerText?.slice(0, 500).toLowerCase() || '');
        if (/store|shop|cart|checkout|product|add to cart|buy|order/i.test(text)) {
          return testUrl;
        }
      }
    } catch { }
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏪 RVUnicorn Camp Store Scraper');
  console.log('================================');

  // Load progress
  let progress = { done: [] };
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log(`📂 Resuming — ${progress.done.length} already processed`);
  }
  const doneSet = new Set(progress.done);

  // Load campgrounds with websites but no storeUrl yet
  const campgrounds = await prisma.campground.findMany({
    where: {
      websiteUrl: { not: null },
      storeUrl: null,
    },
    select: { id: true, name: true, state: true, websiteUrl: true },
    orderBy: { name: 'asc' },
    take: LIMIT,
  });

  const todo = campgrounds.filter(c => !doneSet.has(c.id));
  console.log(`🎯 ${todo.length} campgrounds to check\n`);

  let found = 0, notFound = 0, errors = 0;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    // Block images/fonts/media for speed
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['image', 'media', 'font', 'stylesheet'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    for (let i = 0; i < todo.length; i++) {
      const camp = todo[i];
      const pct = Math.round(((i + 1) / todo.length) * 100);

      process.stdout.write(
        `[${String(i + 1).padStart(5)}/${todo.length}] ${pct}% | ${(camp.state || '??').padEnd(3)} | ${camp.name.slice(0, 40).padEnd(40)} `
      );

      try {
        await page.goto(camp.websiteUrl, { waitUntil: 'domcontentloaded', timeout: 18000 });
        await delay(1000);

        let storeUrl = await findStoreUrl(page, camp.websiteUrl);

        if (!storeUrl) {
          storeUrl = await tryDirectPaths(page, camp.websiteUrl);
        }

        if (storeUrl) {
          await prisma.campground.update({
            where: { id: camp.id },
            data: { storeUrl },
          });
          process.stdout.write(`🏪 ${storeUrl.slice(0, 60)}\n`);
          found++;
        } else {
          process.stdout.write(`— no store\n`);
          notFound++;
        }
      } catch (err) {
        process.stdout.write(`❌ ${err.message?.slice(0, 50)}\n`);
        errors++;
      }

      doneSet.add(camp.id);
      progress.done.push(camp.id);

      if ((i + 1) % 50 === 0) {
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
        console.log(`\n💾 Progress saved (${found} stores found so far)\n`);
      }

      await delay(600);
    }

    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  console.log('\n================================');
  console.log(`🏪 Stores found:  ${found}`);
  console.log(`— No store:      ${notFound}`);
  console.log(`❌ Errors:        ${errors}`);
}

main().catch(console.error);
