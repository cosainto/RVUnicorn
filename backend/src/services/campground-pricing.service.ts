import { prisma } from '../prisma';

/**
 * Crowdsourced campground pricing.
 *
 * Background: Phase 1 (Recreation.gov) + Phase 3 (AI scraping) covered
 * 28% of the 16k campgrounds. The other 72% are independent sites that
 * either don't publish prices in HTML or hide them behind quote forms.
 *
 * The fundamental problem with scraping is that you get _advertised_
 * rates — not what people actually paid (after discounts, off-season,
 * loyalty pricing, etc). Crowdsourcing solves both problems at once:
 * we collect real prices from real campers, and the long tail fills
 * itself in over time without burning Anthropic credits or risking
 * ToS violations.
 *
 * This service:
 *
 *   submitPriceReport()  — record what a user paid
 *   getPriceStats()      — aggregate stats for one campground
 *   recomputeCampgroundPrice() — update Campground.pricePerNight from
 *                                community reports, with attribution
 *
 * Pricing precedence:
 *
 *   OFFICIAL > COMMUNITY (3+ reports) > SCRAPED > COMMUNITY (1-2 reports) > null
 *
 * Reasoning: an official rate from Recreation.gov is the most reliable.
 * Community pricing with 3+ reports beats a scraped rate because real
 * paid prices are more accurate than advertised. With only 1-2 reports
 * we don't yet trust the median, so a scraped rate (if any) wins until
 * the community sample is bigger.
 */

export type PriceSource = 'OFFICIAL' | 'COMMUNITY' | 'SCRAPED' | null;

export interface PriceReportInput {
  campgroundId: string;
  userId: string;
  pricePaid: number;
  siteType?: string;
  hookupLevel?: string;
  season?: string;
  notes?: string;
}

export async function submitPriceReport(input: PriceReportInput) {
  // Sanity-bound the price so a typo doesn't end up as $4500/night
  if (!Number.isFinite(input.pricePaid) || input.pricePaid <= 0 || input.pricePaid > 1000) {
    throw new Error('pricePaid must be between $0 and $1000');
  }

  // One report per user per campground per 30 days. Updates the latest
  // report rather than stacking duplicates from a single user — keeps
  // the median honest and gives users an easy "edit my last report"
  // path without a separate edit endpoint.
  const recent = await prisma.campgroundPriceReport.findFirst({
    where: {
      userId: input.userId,
      campgroundId: input.campgroundId,
      reportedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { reportedAt: 'desc' },
  });

  let report;
  if (recent) {
    report = await prisma.campgroundPriceReport.update({
      where: { id: recent.id },
      data: {
        pricePaid: input.pricePaid,
        siteType: input.siteType,
        hookupLevel: input.hookupLevel,
        season: input.season,
        notes: input.notes,
        reportedAt: new Date(),
      },
    });
  } else {
    report = await prisma.campgroundPriceReport.create({
      data: input,
    });
  }

  // Recompute the campground's headline price asynchronously — don't
  // block the response on it.
  recomputeCampgroundPrice(input.campgroundId).catch((e) =>
    console.error('[campground-pricing] recompute failed:', e),
  );

  return report;
}

export interface PriceStats {
  count: number;
  median: number | null;
  min: number | null;
  max: number | null;
  latestReportedAt: Date | null;
}

export async function getPriceStats(campgroundId: string): Promise<PriceStats> {
  const reports = await prisma.campgroundPriceReport.findMany({
    where: { campgroundId },
    select: { pricePaid: true, reportedAt: true },
    orderBy: { reportedAt: 'desc' },
    // 200 is more than enough — anything older is unlikely to reflect current pricing
    take: 200,
  });

  if (reports.length === 0) {
    return { count: 0, median: null, min: null, max: null, latestReportedAt: null };
  }

  const prices = reports.map((r) => r.pricePaid).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];

  return {
    count: prices.length,
    median,
    min: prices[0],
    max: prices[prices.length - 1],
    latestReportedAt: reports[0].reportedAt,
  };
}

/**
 * Recompute the campground's headline pricePerNight from community
 * reports. Source precedence:
 *
 *   OFFICIAL  — only set by an explicit official-source ingestion
 *               (we never overwrite an OFFICIAL price)
 *   COMMUNITY — when we have 3+ reports, the median wins
 *   SCRAPED   — leave alone if we already have one and community is < 3
 *   null      — set to community median if we have 1+ report
 *
 * Returns the new effective state for logging/debugging.
 */
export async function recomputeCampgroundPrice(campgroundId: string) {
  const cg = await prisma.campground.findUnique({
    where: { id: campgroundId },
    select: { pricePerNight: true, pricePerNightSource: true },
  });
  if (!cg) return null;

  // Never overwrite an OFFICIAL price — that comes from a verified source
  if (cg.pricePerNightSource === 'OFFICIAL') {
    return { skipped: 'official' as const };
  }

  const stats = await getPriceStats(campgroundId);

  // Need at least 1 report to do anything
  if (stats.count === 0 || stats.median === null) {
    return { skipped: 'no-reports' as const };
  }

  // With 3+ reports the community median wins regardless of any prior price
  // (this is what makes the long-tail crowd-source actually useful — we
  // believe 3 real campers more than one scraped advertised rate)
  if (stats.count >= 3) {
    await prisma.campground.update({
      where: { id: campgroundId },
      data: {
        pricePerNight: Math.round(stats.median * 100) / 100,
        pricePerNightSource: 'COMMUNITY',
        pricePerNightUpdatedAt: new Date(),
      },
    });
    return { updated: true, source: 'COMMUNITY' as const, median: stats.median };
  }

  // With 1-2 reports we only fill in IF there's no scraped/official price
  // already. Don't overwrite anything yet — sample size is too small.
  if (cg.pricePerNight === null || cg.pricePerNight === undefined) {
    await prisma.campground.update({
      where: { id: campgroundId },
      data: {
        pricePerNight: Math.round(stats.median * 100) / 100,
        pricePerNightSource: 'COMMUNITY',
        pricePerNightUpdatedAt: new Date(),
      },
    });
    return { updated: true, source: 'COMMUNITY' as const, median: stats.median };
  }

  return { skipped: 'too-few-reports-with-existing-price' as const };
}

/**
 * Decide whether to prompt this user for a price report on this
 * campground. Returns true when:
 *   - The user has visited (Stay/CheckIn/StateVisit/past Event)
 *   - The visit ended (or started) in the last 90 days
 *   - The user hasn't already submitted a report for this campground
 *     in the last 30 days
 */
export async function shouldPromptForPriceReport(
  userId: string,
  campgroundId: string,
): Promise<boolean> {
  // Already reported recently?
  const recent = await prisma.campgroundPriceReport.findFirst({
    where: {
      userId,
      campgroundId,
      reportedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (recent) return false;

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Did this user actually stay here in the last 90 days? Check all four
  // possible source tables (matching the visit-stats service's coverage).
  const [stay, checkin, stateVisit, event] = await Promise.all([
    prisma.stay.findFirst({
      where: { userId, campgroundId, OR: [
        { startDate: { gte: ninetyDaysAgo } },
        { endDate: { gte: ninetyDaysAgo } },
      ] },
      select: { id: true },
    }),
    prisma.checkIn.findFirst({
      where: { userId, campgroundId, checkInDate: { gte: ninetyDaysAgo } },
      select: { id: true },
    }),
    prisma.stateVisit.findFirst({
      where: { userId, campsiteId: campgroundId, startDate: { gte: ninetyDaysAgo } },
      select: { id: true },
    }),
    prisma.event.findFirst({
      where: {
        campgroundId,
        startDate: { gte: ninetyDaysAgo, lte: new Date() },
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId } } },
        ],
      },
      select: { id: true },
    }),
  ]);

  return !!(stay || checkin || stateVisit || event);
}
