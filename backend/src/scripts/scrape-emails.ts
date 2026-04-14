#!/usr/bin/env npx tsx
/**
 * Email Scraper for Campground Websites
 * Visits campground websites and extracts contact email addresses.
 * Saves found emails to the campground's businessEmail field.
 *
 * Run: npx tsx src/scripts/scrape-emails.ts
 */

import { PrismaClient } from '@prisma/client';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient() as any;
const LOG_FILE = path.join(process.cwd(), 'scrape-emails.log');
const BATCH_SIZE = 10;
const DELAY_MS = 1500;
const TIMEOUT_MS = 8000;

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SKIP_EMAILS = /example\.com|sentry\.|wixpress|wordpress|gravatar|schema\.org|googleapis|cloudflare|w3\.org/i;

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RVUnicornBot/1.0)' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timeout);
        fetchPage(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; if (data.length > 500000) { res.destroy(); resolve(data); } });
      res.on('end', () => { clearTimeout(timeout); resolve(data); });
    });
    req.on('error', (e) => { clearTimeout(timeout); reject(e); });
  });
}

async function main() {
  fs.writeFileSync(LOG_FILE, '');
  log('Starting email scraper');

  const campgrounds = await prisma.campground.findMany({
    where: {
      businessEmail: null,
      websiteUrl: { not: null },
    },
    select: { id: true, name: true, websiteUrl: true },
    orderBy: { name: 'asc' },
  });

  log(`Found ${campgrounds.length} campgrounds without emails`);

  let found = 0;
  let errors = 0;

  for (let i = 0; i < campgrounds.length; i += BATCH_SIZE) {
    const batch = campgrounds.slice(i, i + BATCH_SIZE);
    log(`\n── Batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}–${Math.min(i + BATCH_SIZE, campgrounds.length)} of ${campgrounds.length}) ──`);

    for (const cg of batch) {
      try {
        let url = cg.websiteUrl!;
        if (!url.startsWith('http')) url = 'https://' + url;

        const html = await fetchPage(url);
        const emails = html.match(EMAIL_PATTERN) || [];

        // Filter out junk emails
        const validEmails = [...new Set(emails)]
          .filter(e => !SKIP_EMAILS.test(e))
          .filter(e => !e.includes('..'))
          .filter(e => e.length < 60);

        // Prefer info@, contact@, office@, reservations@ etc
        const preferred = validEmails.find(e => /^(info|contact|office|reservations|booking|admin|hello|camp|park|front)/i.test(e));
        const bestEmail = preferred || validEmails[0];

        if (bestEmail) {
          await prisma.campground.update({
            where: { id: cg.id },
            data: { businessEmail: bestEmail },
          });
          found++;
          log(`  ✓ ${cg.name}: ${bestEmail}`);
        } else {
          log(`  - ${cg.name}: no email found`);
        }
      } catch (e: any) {
        errors++;
        log(`  ✗ ${cg.name}: ${e.message}`);
      }
    }

    if (i + BATCH_SIZE < campgrounds.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  log(`\n── Done ──`);
  log(`Emails found: ${found}`);
  log(`Errors: ${errors}`);
  log(`Total processed: ${campgrounds.length}`);

  await prisma.$disconnect();
}

main().catch(err => { log(`Fatal: ${err.message}`); process.exit(1); });
