#!/usr/bin/env node
/**
 * RVUnicorn Overnight Social Media Scraper
 * Scrapes campground websites for social media links
 * Writes progress to ~/Downloads/scraper_progress.log
 * Run: node ~/Downloads/scrape_campground_socials.js
 */

const { PrismaClient } = require('@prisma/client');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const LOG_FILE = path.join(process.env.HOME, 'Downloads', 'scraper_progress.log');
const RESULTS_FILE = path.join(process.env.HOME, 'Downloads', 'scraper_results.json');

// ── Config ────────────────────────────────────────────────────────────────────
const DELAY_MS = 1500;          // 1.5s between requests — polite crawling
const TIMEOUT_MS = 8000;        // 8s timeout per page
const MAX_RETRIES = 1;          // 1 retry on failure
const BATCH_SIZE = 10;          // Log progress every 10 campgrounds
const SKIP_ALREADY_SCRAPED = true; // Skip if all social fields already filled

// ── Logging ──────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
function fetchPage(url, redirectCount = 0) {
  return new Promise((resolve) => {
    if (redirectCount > 3) { resolve(null); return; }
    try {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.get(url, {
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RVUnicorn/1.0; +https://rvunicorn.com)',
          'Accept': 'text/html',
        }
      }, (res) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
          resolve(fetchPage(next, redirectCount + 1));
          return;
        }
        if (res.statusCode !== 200) { resolve(null); return; }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; if (body.length > 500000) res.destroy(); });
        res.on('end', () => resolve(body));
        res.on('error', () => resolve(null));
      });
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
    } catch { resolve(null); }
  });
}

// ── Extract social links from HTML ────────────────────────────────────────────
function extractSocials(html, baseUrl) {
  const result = {
    facebookUrl: null,
    instagramUrl: null,
    twitterUrl: null,
    youtubeUrl: null,
    tiktokUrl: null,
  };

  if (!html) return result;

  // Extract all href values from anchor tags
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  const hrefs = new Set();
  while ((match = hrefRegex.exec(html)) !== null) {
    hrefs.add(match[1]);
  }

  for (const href of hrefs) {
    const lower = href.toLowerCase();

    // Facebook — skip generic facebook.com links, share buttons, etc.
    if (!result.facebookUrl && lower.includes('facebook.com/') && 
        !lower.includes('facebook.com/sharer') && 
        !lower.includes('facebook.com/share') &&
        !lower.includes('facebook.com/dialog') &&
        !lower.includes('facebook.com/tr?') &&
        !lower.includes('facebook.com/plugins')) {
      // Clean up tracking params
      try {
        const u = new URL(href.startsWith('http') ? href : `https://facebook.com${href}`);
        const clean = `https://facebook.com${u.pathname}`.replace(/\/$/, '');
        if (u.pathname.length > 1) result.facebookUrl = clean;
      } catch { result.facebookUrl = href.split('?')[0]; }
    }

    // Instagram
    if (!result.instagramUrl && lower.includes('instagram.com/') &&
        !lower.includes('instagram.com/p/') &&
        !lower.includes('instagram.com/share')) {
      try {
        const u = new URL(href.startsWith('http') ? href : `https://instagram.com${href}`);
        const clean = `https://instagram.com${u.pathname}`.replace(/\/$/, '');
        if (u.pathname.length > 1) result.instagramUrl = clean;
      } catch { result.instagramUrl = href.split('?')[0]; }
    }

    // Twitter / X
    if (!result.twitterUrl && (lower.includes('twitter.com/') || lower.includes('x.com/')) &&
        !lower.includes('/share') && !lower.includes('/intent/')) {
      result.twitterUrl = href.split('?')[0];
    }

    // YouTube
    if (!result.youtubeUrl && lower.includes('youtube.com/') &&
        !lower.includes('/watch') && !lower.includes('/embed')) {
      result.youtubeUrl = href.split('?')[0];
    }

    // TikTok
    if (!result.tiktokUrl && lower.includes('tiktok.com/@')) {
      result.tiktokUrl = href.split('?')[0];
    }
  }

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Clear log file
  fs.writeFileSync(LOG_FILE, '');
  log('🚀 RVUnicorn Social Media Scraper starting...');

  const campgrounds = await prisma.campground.findMany({
    where: { websiteUrl: { not: null } },
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      facebookUrl: true,
      instagramUrl: true,
      twitterUrl: true,
      youtubeUrl: true,
      tiktokUrl: true,
    },
    orderBy: { id: 'asc' },
  });

  log(`📊 Found ${campgrounds.length} campgrounds with website URLs`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];

  for (const cg of campgrounds) {
    processed++;

    // Skip if already has all social data
    if (SKIP_ALREADY_SCRAPED && 
        cg.facebookUrl && cg.instagramUrl) {
      skipped++;
      if (processed % BATCH_SIZE === 0) {
        log(`Progress: ${processed}/${campgrounds.length} | Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`);
      }
      continue;
    }

    // Normalize URL
    let url = cg.websiteUrl;
    if (!url.startsWith('http')) url = 'https://' + url;

    let html = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      html = await fetchPage(url);
      if (html) break;
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 1000));
    }

    if (!html) {
      failed++;
      if (processed % BATCH_SIZE === 0) {
        log(`Progress: ${processed}/${campgrounds.length} | Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`);
      }
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    const socials = extractSocials(html, url);

    // Only update fields that are null and we found something
    const updateData = {};
    if (!cg.facebookUrl && socials.facebookUrl)   updateData.facebookUrl = socials.facebookUrl;
    if (!cg.instagramUrl && socials.instagramUrl) updateData.instagramUrl = socials.instagramUrl;
    if (!cg.twitterUrl && socials.twitterUrl)     updateData.twitterUrl = socials.twitterUrl;
    if (!cg.youtubeUrl && socials.youtubeUrl)     updateData.youtubeUrl = socials.youtubeUrl;
    if (!cg.tiktokUrl && socials.tiktokUrl)       updateData.tiktokUrl = socials.tiktokUrl;

    if (Object.keys(updateData).length > 0) {
      try {
        await prisma.campground.update({
          where: { id: cg.id },
          data: updateData,
        });
        updated++;
        results.push({ id: cg.id, name: cg.name, ...updateData });
        log(`✅ ${cg.name}: ${Object.keys(updateData).join(', ')}`);
      } catch (e) {
        log(`❌ DB error for ${cg.name}: ${e.message}`);
        failed++;
      }
    }

    if (processed % BATCH_SIZE === 0) {
      log(`Progress: ${processed}/${campgrounds.length} | Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`);
      // Save intermediate results
      fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    }

    // Polite delay
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // Final summary
  log('');
  log('🏁 SCRAPING COMPLETE');
  log(`Total processed: ${processed}`);
  log(`Updated with socials: ${updated}`);
  log(`Skipped (already had data): ${skipped}`);
  log(`Failed/no response: ${failed}`);
  log(`Results saved to: ${RESULTS_FILE}`);

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  await prisma.$disconnect();
}

main().catch(e => {
  log(`FATAL ERROR: ${e.message}`);
  process.exit(1);
});
