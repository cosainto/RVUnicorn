/**
 * Rig Mileage Estimation — computes miles from road distances between
 * consecutive check-ins along the true chronological timeline.
 *
 * Rules:
 *   - Recompute-by-date: backfilled past trips slot into correct position.
 *   - Leg distance via HERE routing, cached permanently by campground pair.
 *   - Chain-break: >30 days between stays = don't connect them.
 *   - Crew-dedup: same set as Nights/States (one stay per overlapping range).
 *   - Sticky correction: total = baseline + legs after baselineAt.
 *   - No home bookends: only count legs between actual check-ins.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

const CHAIN_BREAK_DAYS = 30;
const HERE_API_KEY = process.env.HERE_API_KEY || '15BglBtc7-1HzjsdvTvzscQGOYwrpZPvJWZRqkyOrLE';

interface DedupedStay {
  campgroundId: string;
  checkInDate: Date;
  checkOutDate: Date;
  lat: number | null;
  lng: number | null;
}

/**
 * Get cached road distance between two campgrounds, or compute via HERE.
 * Returns null if either campground lacks coordinates.
 */
async function getLegDistance(campgroundAId: string, campgroundBId: string): Promise<number | null> {
  if (campgroundAId === campgroundBId) return 0;

  // Normalize key order for cache consistency
  const [idA, idB] = [campgroundAId, campgroundBId].sort();

  // Check cache
  const cached = await prisma.rigLegCache.findUnique({
    where: { campgroundAId_campgroundBId: { campgroundAId: idA, campgroundBId: idB } },
  }).catch(() => null);
  if (cached) return cached.distanceMiles;

  // Get coordinates
  const [cgA, cgB] = await Promise.all([
    prisma.campground.findUnique({ where: { id: campgroundAId }, select: { latitude: true, longitude: true } }),
    prisma.campground.findUnique({ where: { id: campgroundBId }, select: { latitude: true, longitude: true } }),
  ]);

  if (!cgA?.latitude || !cgA?.longitude || !cgB?.latitude || !cgB?.longitude) return null;

  // Call HERE routing API
  try {
    const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${cgA.latitude},${cgA.longitude}&destination=${cgB.latitude},${cgB.longitude}&return=summary&apikey=${HERE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    const section = data?.routes?.[0]?.sections?.[0];
    if (!section?.summary) return null;

    const distanceMiles = Math.round((section.summary.length / 1609.344) * 10) / 10;
    const durationMinutes = Math.round(section.summary.duration / 60);

    // Cache permanently
    await prisma.rigLegCache.upsert({
      where: { campgroundAId_campgroundBId: { campgroundAId: idA, campgroundBId: idB } },
      create: { campgroundAId: idA, campgroundBId: idB, distanceMiles, durationMinutes },
      update: { distanceMiles, durationMinutes },
    }).catch(() => {});

    return distanceMiles;
  } catch (err: any) {
    console.error('[RigMileage] HERE API error:', err.message);
    return null;
  }
}

/**
 * Compute total estimated miles for a rig from its deduplicated stay set.
 * Respects sticky correction baseline.
 */
export async function computeRigMileage(rigId: string, dedupedStays: DedupedStay[]): Promise<{
  totalMiles: number;
  legCount: number;
  isEstimated: boolean;
}> {
  // Get rig's correction baseline
  const rig = await prisma.rig.findUnique({
    where: { id: rigId },
    select: { milesBaseline: true, milesBaselineAt: true, milesEstimated: true },
  });

  const baseline = rig?.milesBaseline || 0;
  const baselineAt = rig?.milesBaselineAt ? new Date(rig.milesBaselineAt) : null;

  // Sort stays chronologically by checkInDate
  const sorted = [...dedupedStays]
    .filter(s => s.lat != null && s.lng != null)
    .sort((a, b) => a.checkInDate.getTime() - b.checkInDate.getTime());

  if (sorted.length < 2) {
    return { totalMiles: Math.round(baseline), legCount: 0, isEstimated: rig?.milesEstimated ?? true };
  }

  // Compute legs between consecutive stays
  let estimatedMilesAfterBaseline = 0;
  let legCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // Chain-break: skip if gap > 30 days
    const gapDays = (curr.checkInDate.getTime() - prev.checkOutDate.getTime()) / (1000 * 60 * 60 * 24);
    if (gapDays > CHAIN_BREAK_DAYS) continue;

    // Skip legs dated before the correction baseline (already accounted for)
    if (baselineAt && curr.checkInDate <= baselineAt) continue;

    // Same campground = 0 miles leg (not skipped — still a valid trip, just 0 distance)
    if (prev.campgroundId === curr.campgroundId) {
      legCount++;
      continue;
    }

    const distance = await getLegDistance(prev.campgroundId, curr.campgroundId);
    if (distance !== null) {
      estimatedMilesAfterBaseline += distance;
      legCount++;
    }
  }

  const totalMiles = Math.round(baseline + estimatedMilesAfterBaseline);

  return { totalMiles, legCount, isEstimated: rig?.milesEstimated ?? true };
}

/**
 * Full mileage rollup for a rig — fetches deduped stays, computes, and updates.
 */
export async function rollupRigMileage(rigId: string): Promise<{
  totalMiles: number;
  legCount: number;
  isEstimated: boolean;
}> {
  // Get crew user IDs (same as Nights/States rollup)
  const rig = await prisma.rig.findUnique({ where: { id: rigId }, select: { ownerId: true } });
  if (!rig) return { totalMiles: 0, legCount: 0, isEstimated: true };

  const pilots = await prisma.rigPilot.findMany({
    where: { rigId, shareActivityWithRig: true },
    select: { userId: true },
  });
  const userIds = [...new Set([rig.ownerId, ...pilots.map((p: any) => p.userId)])];

  // Fetch check-ins with campground coordinates
  const checkIns = await prisma.checkIn.findMany({
    where: { userId: { in: userIds }, campgroundId: { not: null }, checkOutDate: { not: null } },
    select: {
      campgroundId: true, checkInDate: true, checkOutDate: true,
      campground: { select: { latitude: true, longitude: true } },
    },
    orderBy: { checkInDate: 'asc' },
  });

  // Build stays with coordinates
  const stays: DedupedStay[] = checkIns
    .filter((ci: any) => ci.campgroundId && ci.checkOutDate)
    .map((ci: any) => ({
      campgroundId: ci.campgroundId!,
      checkInDate: new Date(ci.checkInDate),
      checkOutDate: new Date(ci.checkOutDate),
      lat: ci.campground?.latitude || null,
      lng: ci.campground?.longitude || null,
    }));

  // Deduplicate overlapping stays (same logic as Nights/States)
  const byCampground = new Map<string, DedupedStay[]>();
  for (const s of stays) {
    const list = byCampground.get(s.campgroundId) || [];
    list.push(s);
    byCampground.set(s.campgroundId, list);
  }
  const deduped: DedupedStay[] = [];
  for (const [, group] of byCampground) {
    group.sort((a, b) => a.checkInDate.getTime() - b.checkInDate.getTime());
    let current = { ...group[0] };
    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      if (next.checkInDate.getTime() <= current.checkOutDate.getTime() + 86400000) {
        if (next.checkOutDate.getTime() > current.checkOutDate.getTime()) {
          current.checkOutDate = next.checkOutDate;
        }
      } else {
        deduped.push(current);
        current = { ...next };
      }
    }
    deduped.push(current);
  }

  const result = await computeRigMileage(rigId, deduped);

  // Update rig
  await prisma.rig.update({
    where: { id: rigId },
    data: {
      totalMilesDriven: result.totalMiles,
      totalMilesAllTime: result.totalMiles,
    },
  });

  return result;
}
