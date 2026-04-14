#!/usr/bin/env npx tsx
/**
 * Campground Rules Scraper
 * Visits campground websites and extracts rules, policies, hours.
 * Uses Claude Haiku to parse unstructured text into structured fields.
 *
 * Run: npx tsx src/scripts/scrape-rules.ts
 */

import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient() as any;
const anthropic = new Anthropic();
const LOG_FILE = path.join(process.cwd(), 'scrape-rules.log');
const BATCH_SIZE = 5;
const DELAY_MS = 2000;
const TIMEOUT_MS = 10000;

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const RULES_KEYWORDS = /\b(rule|policy|policies|regulation|guideline|quiet hour|check.?in|check.?out|pet|fire|generator|speed limit|alcohol|trash|garbage|guest|vehicle|swim|pool hour|age restriction|curfew|firework|drone|campfire|leash|parking|visitor|reservation|cancel|refund|noise)\b/i;

async function scrapeRulesFromPage(page: any, url: string): Promise<string> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

  // Look for rules/policies pages
  const rulesLinks = await page.evaluate(() => {
    const links: string[] = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = (a as HTMLAnchorElement).href;
      const text = (a as HTMLElement).innerText?.toLowerCase() || '';
      if (/rule|polic|regulation|guideline|faq|info|about/i.test(href) || /rule|polic|regulation|guideline/i.test(text)) {
        links.push(href);
      }
    });
    return [...new Set(links)].slice(0, 3);
  });

  // Collect text from main page
  let allText = await page.evaluate(() => {
    const els = document.querySelectorAll('p, li, td, h1, h2, h3, h4, div');
    const texts: string[] = [];
    els.forEach(el => {
      const text = (el as HTMLElement).innerText?.trim();
      if (text && text.length > 10 && text.length < 1000) texts.push(text);
    });
    return texts.join('\n');
  });

  // Also scrape rules subpages
  for (const link of rulesLinks) {
    try {
      await page.goto(link, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
      const subText = await page.evaluate(() => {
        const els = document.querySelectorAll('p, li, td, div');
        return Array.from(els).map(el => (el as HTMLElement).innerText?.trim()).filter(t => t && t.length > 10 && t.length < 1000).join('\n');
      });
      allText += '\n' + subText;
    } catch {}
  }

  // Filter to rules-relevant text
  const lines = allText.split('\n').filter((line: any) => RULES_KEYWORDS.test(line));
  return lines.join('\n').slice(0, 5000);
}

async function parseRulesWithAI(rawText: string, campgroundName: string): Promise<any> {
  if (!rawText || rawText.length < 50) return null;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Extract campground rules from this text for "${campgroundName}". Return ONLY valid JSON, no other text:
{
  "checkInTime": "string or null",
  "checkOutTime": "string or null",
  "quietHoursStart": "string or null",
  "quietHoursEnd": "string or null",
  "petPolicy": "string or null (allowed/not allowed/leash required/etc)",
  "petRestrictions": "string or null (breed restrictions, weight limits, etc)",
  "firePolicy": "string or null (campfires allowed, fire rings only, seasonal bans, etc)",
  "generatorHours": "string or null",
  "speedLimit": "string or null",
  "ageRestrictions": "string or null",
  "maxVehicles": "string or null",
  "maxGuests": "string or null",
  "alcoholPolicy": "string or null",
  "swimRules": "string or null",
  "trashPolicy": "string or null",
  "additionalRules": ["array of other important rules as strings"]
}

Text:
${rawText.slice(0, 4000)}`
      }],
    });

    const text = (response.content[0] as any)?.text?.trim() || '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch { return null; }
}

async function main() {
  fs.writeFileSync(LOG_FILE, '');
  log('Starting campground rules scraper');

  const campgrounds = await prisma.campground.findMany({
    where: {
      websiteUrl: { not: null },
      rules: null, // Only scrape campgrounds without rules
    },
    select: { id: true, name: true, websiteUrl: true },
    orderBy: { name: 'asc' },
  });

  log(`Found ${campgrounds.length} campgrounds to scrape`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  let found = 0;
  let errors = 0;

  for (let i = 0; i < campgrounds.length; i += BATCH_SIZE) {
    const batch = campgrounds.slice(i, i + BATCH_SIZE);
    log(`\n── Batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}–${Math.min(i + BATCH_SIZE, campgrounds.length)} of ${campgrounds.length}) ──`);

    const results = await Promise.allSettled(
      batch.map(async (cg: any) => {
        const page = await browser.newPage();
        page.setDefaultTimeout(TIMEOUT_MS);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        // Block images/fonts/media
        await page.setRequestInterception(true);
        page.on('request', req => {
          if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
          else req.continue();
        });

        try {
          let url = cg.websiteUrl!;
          if (!url.startsWith('http')) url = 'https://' + url;

          const rawText = await scrapeRulesFromPage(page, url);
          if (!rawText || rawText.length < 50) {
            log(`  - ${cg.name}: no rules text found`);
            return;
          }

          const parsed = await parseRulesWithAI(rawText, cg.name);
          if (!parsed) {
            log(`  - ${cg.name}: AI parsing failed`);
            return;
          }

          await prisma.campgroundRules.create({
            data: {
              campgroundId: cg.id,
              checkInTime: parsed.checkInTime,
              checkOutTime: parsed.checkOutTime,
              quietHoursStart: parsed.quietHoursStart,
              quietHoursEnd: parsed.quietHoursEnd,
              petPolicy: parsed.petPolicy,
              petRestrictions: parsed.petRestrictions,
              firePolicy: parsed.firePolicy,
              generatorHours: parsed.generatorHours,
              speedLimit: parsed.speedLimit,
              ageRestrictions: parsed.ageRestrictions,
              maxVehicles: parsed.maxVehicles,
              maxGuests: parsed.maxGuests,
              alcoholPolicy: parsed.alcoholPolicy,
              swimRules: parsed.swimRules,
              trashPolicy: parsed.trashPolicy,
              additionalRules: parsed.additionalRules || [],
              rawText: rawText.slice(0, 5000),
            },
          });

          found++;
          const ruleCount = Object.values(parsed).filter(v => v && v !== null && !(Array.isArray(v) && v.length === 0)).length;
          log(`  ✓ ${cg.name}: ${ruleCount} rules extracted`);
        } catch (e: any) {
          errors++;
          log(`  ✗ ${cg.name}: ${e.message}`);
        } finally {
          await page.close();
        }
      })
    );

    if (i + BATCH_SIZE < campgrounds.length) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await browser.close();
  log(`\n── Done ──`);
  log(`Rules found: ${found}`);
  log(`Errors: ${errors}`);
  log(`Total processed: ${campgrounds.length}`);

  await prisma.$disconnect();
}

main().catch(err => { log(`Fatal: ${err.message}`); process.exit(1); });
