#!/usr/bin/env npx tsx
/**
 * Import scraped event data from scrape-events-output.json into CampgroundEvent table.
 * Parses free-form text into structured events with dates and titles.
 *
 * Run: npx tsx src/scripts/import-scraped-events.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient() as any;
const INPUT_FILE = path.join(process.cwd(), 'scrape-events-output.json');
const LOG_FILE = path.join(process.cwd(), 'import-events.log');

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Date parsing ─────────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

interface ParsedEvent {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
  tags: string[];
}

/**
 * Try to extract a date from text. Handles:
 *  - "May 22-25, 2026"
 *  - "June 19-21, 2026"
 *  - "April 6, 2026"
 *  - "May 1-3, 2026"
 *  - "October 9-11, 2026"
 */
function parseDate(text: string): { start: Date; end: Date | null } | null {
  // Pattern: "Month Day-Day, Year"
  const rangeMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(2025|2026)\b/i);
  if (rangeMatch) {
    const month = MONTHS[rangeMatch[1].toLowerCase()];
    const startDay = parseInt(rangeMatch[2]);
    const endDay = parseInt(rangeMatch[3]);
    const year = parseInt(rangeMatch[4]);
    return {
      start: new Date(year, month, startDay, 10, 0),
      end: new Date(year, month, endDay, 18, 0),
    };
  }

  // Pattern: "Month Day, Year"
  const singleMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s*(2025|2026)\b/i);
  if (singleMatch) {
    const month = MONTHS[singleMatch[1].toLowerCase()];
    const day = parseInt(singleMatch[2]);
    const year = parseInt(singleMatch[3]);
    return {
      start: new Date(year, month, day, 10, 0),
      end: null,
    };
  }

  // Pattern: "MM/DD/YYYY" or "MM-DD-YYYY"
  const numericMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](2025|2026)\b/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1]) - 1;
    const day = parseInt(numericMatch[2]);
    const year = parseInt(numericMatch[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return { start: new Date(year, month, day, 10, 0), end: null };
    }
  }

  return null;
}

/**
 * Extract a title from the event text. Takes the first meaningful line.
 */
function extractTitle(text: string): string {
  // Split into lines and find the first non-empty, non-date-only line
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  for (const line of lines) {
    // Skip lines that are just dates or very short
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(line)) continue;
    if (/^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d/i.test(line) && line.length < 25) continue;
    if (line.length > 5) {
      return line.slice(0, 150);
    }
  }

  return text.slice(0, 150).replace(/\n/g, ' ').trim();
}

/**
 * Parse a single raw event text into structured event(s).
 * Some texts contain multiple events (bulleted lists), try to split them.
 */
function parseEventText(text: string): ParsedEvent[] {
  const results: ParsedEvent[] = [];
  const now = new Date();

  // Check if this text contains multiple date-headed events (like a schedule list)
  const multiEventPattern = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s*(?:2025|2026)\b/gi;
  const dateMatches = [...text.matchAll(multiEventPattern)];

  if (dateMatches.length > 1) {
    // Multiple events in one text block — split by date occurrences
    for (let i = 0; i < dateMatches.length; i++) {
      const start = dateMatches[i].index!;
      const end = i + 1 < dateMatches.length ? dateMatches[i + 1].index! : text.length;
      const chunk = text.slice(start, end).trim();

      const dateInfo = parseDate(chunk);
      if (dateInfo && dateInfo.start > now) {
        const title = extractTitle(chunk);
        results.push({
          title,
          description: chunk.slice(0, 500),
          startDate: dateInfo.start,
          endDate: dateInfo.end,
          tags: ['scraped'],
        });
      }
    }
  } else {
    // Single event
    const dateInfo = parseDate(text);
    if (dateInfo && dateInfo.start > now) {
      const title = extractTitle(text);
      results.push({
        title,
        description: text.slice(0, 500),
        startDate: dateInfo.start,
        endDate: dateInfo.end,
        tags: ['scraped'],
      });
    }
  }

  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.writeFileSync(LOG_FILE, '');
  log('Starting event import from scrape-events-output.json');

  if (!fs.existsSync(INPUT_FILE)) {
    log(`ERROR: ${INPUT_FILE} not found`);
    process.exit(1);
  }

  const rawData: { campgroundId: string; campgroundName: string; websiteUrl: string; events: string[] }[] =
    JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  log(`Loaded ${rawData.length} campgrounds with event data`);

  // Get or create system user
  let systemUser = await prisma.user.findFirst({ where: { username: 'rvunicorn-system' } });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: 'system@rvunicorn.com',
        username: 'rvunicorn-system',
        firstName: 'RVUnicorn',
        lastName: 'System',
        password: 'SYSTEM_NO_LOGIN_' + Date.now(),
      },
    });
    log(`Created system user: ${systemUser.id}`);
  } else {
    log(`Using existing system user: ${systemUser.id}`);
  }

  let totalParsed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let campgroundsWithEvents = 0;

  for (const item of rawData) {
    // Verify campground exists
    const campground = await prisma.campground.findUnique({ where: { id: item.campgroundId }, select: { id: true } });
    if (!campground) {
      log(`  SKIP: campground ${item.campgroundId} not found in DB`);
      continue;
    }

    // Get existing events to avoid duplicates
    const existingEvents = await prisma.campgroundEvent.findMany({
      where: { campgroundId: item.campgroundId },
      select: { title: true, startDate: true },
    });
    const existingKeys = new Set(existingEvents.map((e: any) => `${e.title}|${e.startDate.toISOString()}`));

    let campgroundInserted = 0;

    for (const eventText of item.events) {
      const parsed = parseEventText(eventText);
      totalParsed += parsed.length;

      for (const evt of parsed) {
        const key = `${evt.title}|${evt.startDate.toISOString()}`;
        if (existingKeys.has(key)) {
          totalSkipped++;
          continue;
        }

        try {
          await prisma.campgroundEvent.create({
            data: {
              campgroundId: item.campgroundId,
              createdById: systemUser.id,
              title: evt.title,
              description: evt.description,
              startDate: evt.startDate,
              endDate: evt.endDate,
              tags: evt.tags,
            },
          });
          existingKeys.add(key);
          totalInserted++;
          campgroundInserted++;
        } catch (err: any) {
          log(`  ERROR inserting event for ${item.campgroundName}: ${err.message}`);
        }
      }
    }

    if (campgroundInserted > 0) {
      campgroundsWithEvents++;
      log(`  ✓ ${item.campgroundName}: inserted ${campgroundInserted} events`);
    }
  }

  log(`\n── Done ──`);
  log(`Parsed: ${totalParsed} events from text`);
  log(`Inserted: ${totalInserted} new events`);
  log(`Skipped: ${totalSkipped} duplicates`);
  log(`Campgrounds with new events: ${campgroundsWithEvents}`);

  await prisma.$disconnect();
}

main().catch(err => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
