#!/usr/bin/env npx tsx
/**
 * RVUnicorn Social Media & Events Scraper (Puppeteer)
 *
 * Visits campground websites, scrapes social links and event/schedule info.
 * - Social links saved directly to the Campground model in Postgres
 * - Events/schedules saved to scrape-events-output.json for review
 *
 * Run:  npx tsx src/scripts/scrape-socials-puppeteer.ts
 */

import { PrismaClient } from '@prisma/client';
import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ── Config ───────────────────────────────────────────────────────────────────
const BATCH_SIZE = 10;
const DELAY_MS = 2000;
const TIMEOUT_MS = 10000;
const SKIP_ALREADY_SCRAPED = true;

const LOG_FILE = path.join(process.cwd(), 'scrape-socials.log');
const EVENTS_FILE = path.join(process.cwd(), 'scrape-events-output.json');

// ── Logging ──────────────────────────────────────────────────────────────────
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Social link patterns ─────────────────────────────────────────────────────
const SOCIAL_PATTERNS: Record<string, RegExp> = {
  facebookUrl:  /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)]+/i,
  instagramUrl: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/i,
  youtubeUrl:   /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[^\s"'<>)]+/i,
  twitterUrl:   /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s"'<>)]+/i,
  tiktokUrl:    /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>)]+/i,
};

// ── Event/schedule patterns ──────────────────────────────────────────────────
const EVENT_KEYWORDS = /\b(event|schedule|calendar|season|opening|closing|winter hours|summer hours|holiday|special|rally|rally|festival|potluck|concert|live music|fireworks|halloween|christmas|thanksgiving|memorial day|labor day|4th of july|fourth of july)\b/i;
const YEAR_PATTERN = /\b(2025|2026)\b/;

interface SocialLinks {
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
}

interface EventInfo {
  campgroundId: string;
  campgroundName: string;
  websiteUrl: string;
  events: string[];
}

// ── Scrape a single page ─────────────────────────────────────────────────────
async function scrapePage(page: Page, url: string): Promise<{ socials: SocialLinks; eventTexts: string[] }> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

  // Extract all links and page text in one evaluate call
  const result = await page.evaluate(() => {
    const allLinks: string[] = [];
    document.querySelectorAll('a[href]').forEach(a => {
      allLinks.push((a as HTMLAnchorElement).href);
    });

    // Also grab link hrefs from the raw HTML (catches dynamically set hrefs)
    const htmlContent = document.documentElement.outerHTML;

    // Grab text content of elements that might contain event info
    const eventCandidates: string[] = [];
    const selectors = 'h1,h2,h3,h4,p,li,td,span,div.event,div.calendar,.event,.schedule,.calendar,[class*="event"],[class*="schedule"],[class*="calendar"]';
    document.querySelectorAll(selectors).forEach(el => {
      const text = (el as HTMLElement).innerText?.trim();
      if (text && text.length > 10 && text.length < 500) {
        eventCandidates.push(text);
      }
    });

    return { allLinks, htmlContent, eventCandidates };
  });

  // Extract social links
  const socials: SocialLinks = {};
  const allText = result.allLinks.join(' ') + ' ' + result.htmlContent;

  for (const [field, pattern] of Object.entries(SOCIAL_PATTERNS)) {
    const match = allText.match(pattern);
    if (match) {
      // Clean trailing slashes and tracking params
      let url = match[0].replace(/[)"'<>]+$/, '').replace(/\/+$/, '');
      (socials as any)[field] = url;
    }
  }

  // Extract event-related text
  const eventTexts: string[] = [];
  const seen = new Set<string>();
  for (const text of result.eventCandidates) {
    if (EVENT_KEYWORDS.test(text) && YEAR_PATTERN.test(text) && !seen.has(text)) {
      seen.add(text);
      eventTexts.push(text);
    }
  }

  return { socials, eventTexts };
}

// Try to find events/schedule subpages
async function findEventPages(page: Page): Promise<string[]> {
  const links = await page.evaluate(() => {
    const found: string[] = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = (a as HTMLAnchorElement).href;
      const text = (a as HTMLElement).innerText?.toLowerCase() || '';
      if (/event|calendar|schedule|activities|things.to.do/i.test(href) ||
          /event|calendar|schedule|activities|things to do/i.test(text)) {
        found.push(href);
      }
    });
    return [...new Set(found)];
  });
  return links.slice(0, 3); // Max 3 subpages
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('Starting social media & events scraper (Puppeteer)');

  // Clear log file
  fs.writeFileSync(LOG_FILE, '');

  // Query campgrounds with websites
  const campgrounds = await prisma.campground.findMany({
    where: { websiteUrl: { not: null } },
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      facebookUrl: true,
      instagramUrl: true,
      youtubeUrl: true,
      twitterUrl: true,
      tiktokUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  log(`Found ${campgrounds.length} campgrounds with website URLs`);

  // Filter out already-scraped if configured
  const toScrape = SKIP_ALREADY_SCRAPED
    ? campgrounds.filter(cg =>
        !cg.facebookUrl || !cg.instagramUrl || !cg.youtubeUrl || !cg.twitterUrl || !cg.tiktokUrl
      )
    : campgrounds;

  log(`Scraping ${toScrape.length} campgrounds (${campgrounds.length - toScrape.length} skipped — already have all socials)`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  let updated = 0;
  let errors = 0;
  const allEvents: EventInfo[] = [];

  // Process in batches
  for (let i = 0; i < toScrape.length; i += BATCH_SIZE) {
    const batch = toScrape.slice(i, i + BATCH_SIZE);
    log(`\n── Batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}–${Math.min(i + BATCH_SIZE, toScrape.length)} of ${toScrape.length}) ──`);

    const results = await Promise.allSettled(
      batch.map(cg => scrapeOneCampground(browser, cg))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const cg = batch[j];

      if (result.status === 'fulfilled') {
        const { socialsFound, eventsFound } = result.value;

        // Update DB with any new social links
        const updateData: Record<string, string> = {};
        for (const [field, url] of Object.entries(socialsFound)) {
          // Only update if the field is currently empty
          if (!(cg as any)[field] && url) {
            updateData[field] = url;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.campground.update({
            where: { id: cg.id },
            data: updateData,
          });
          updated++;
          log(`  ✓ ${cg.name}: updated ${Object.keys(updateData).join(', ')}`);
        } else {
          log(`  - ${cg.name}: no new socials found`);
        }

        if (eventsFound.length > 0) {
          allEvents.push({
            campgroundId: cg.id,
            campgroundName: cg.name,
            websiteUrl: cg.websiteUrl!,
            events: eventsFound,
          });
          log(`  📅 ${cg.name}: found ${eventsFound.length} event/schedule mentions`);
        }
      } else {
        errors++;
        log(`  ✗ ${cg.name}: ${result.reason?.message || 'Unknown error'}`);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < toScrape.length) {
      await sleep(DELAY_MS);
    }
  }

  await browser.close();

  // Write events to JSON file
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(allEvents, null, 2));

  log(`\n── Done ──`);
  log(`Updated: ${updated} campgrounds`);
  log(`Events found: ${allEvents.length} campgrounds with event/schedule info`);
  log(`Errors: ${errors}`);
  log(`Events saved to: ${EVENTS_FILE}`);
  log(`Log saved to: ${LOG_FILE}`);

  await prisma.$disconnect();
}

async function scrapeOneCampground(
  browser: Browser,
  cg: { id: string; name: string; websiteUrl: string | null }
): Promise<{ socialsFound: SocialLinks; eventsFound: string[] }> {
  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // Block images/fonts/media to speed things up
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    let url = cg.websiteUrl!;
    if (!url.startsWith('http')) url = 'https://' + url;

    // Scrape the main page
    const { socials, eventTexts } = await scrapePage(page, url);

    // Try to find and scrape event subpages
    const eventPageUrls = await findEventPages(page);
    for (const eventUrl of eventPageUrls) {
      try {
        const sub = await scrapePage(page, eventUrl);
        // Merge socials
        for (const [k, v] of Object.entries(sub.socials)) {
          if (!(socials as any)[k]) (socials as any)[k] = v;
        }
        eventTexts.push(...sub.eventTexts);
      } catch {
        // Skip failed subpages silently
      }
    }

    return { socialsFound: socials, eventsFound: [...new Set(eventTexts)] };
  } finally {
    await page.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
