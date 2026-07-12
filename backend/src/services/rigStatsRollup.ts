/**
 * Rig Stats Rollup — computes rig stats from the deduplicated UNION
 * of all crew members' check-ins (where sharing is permitted).
 *
 * Rules:
 *   - One stay per rig per campground per overlapping date range.
 *   - Nights = sum of deduplicated stay durations.
 *   - States = distinct states across stays.
 *   - Trips = distinct non-null tripIds across stays.
 *   - Miles = ONLY from real distance data (fuel log odometer deltas). Stays 0 if none.
 *   - Gated by RigPilot.shareActivityWithRig.
 */

import { prisma } from '../lib/prisma';

interface Stay {
  campgroundId: string;
  state: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  tripId: string | null;
}

/**
 * Merge overlapping date ranges for the same campground into deduplicated stays.
 */
function deduplicateStays(stays: Stay[]): Stay[] {
  // Group by campgroundId
  const byCampground = new Map<string, Stay[]>();
  for (const s of stays) {
    const list = byCampground.get(s.campgroundId) || [];
    list.push(s);
    byCampground.set(s.campgroundId, list);
  }

  const deduped: Stay[] = [];
  for (const [, group] of byCampground) {
    // Sort by checkInDate
    group.sort((a, b) => a.checkInDate.getTime() - b.checkInDate.getTime());

    let current = { ...group[0] };
    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      // Overlapping or adjacent (within 1 day gap)
      if (next.checkInDate.getTime() <= current.checkOutDate.getTime() + 86400000) {
        // Merge: extend the end date
        if (next.checkOutDate.getTime() > current.checkOutDate.getTime()) {
          current.checkOutDate = next.checkOutDate;
        }
        // Keep tripId if either has one
        if (!current.tripId && next.tripId) current.tripId = next.tripId;
      } else {
        deduped.push(current);
        current = { ...next };
      }
    }
    deduped.push(current);
  }

  return deduped;
}

/**
 * Compute and update rig stats from all crew members' check-ins.
 */
export async function rollupRigStats(rigId: string): Promise<{
  nights: number;
  states: number;
  trips: number;
  miles: number;
  statesVisited: string[];
}> {
  // Get all crew member userIds who allow sharing
  const pilots = await prisma.rigPilot.findMany({
    where: { rigId, shareActivityWithRig: true },
    select: { userId: true },
  });
  const rig = await prisma.rig.findUnique({ where: { id: rigId }, select: { ownerId: true } });
  if (!rig) return { nights: 0, states: 0, trips: 0, miles: 0, statesVisited: [] };

  // Owner is always included
  const userIds = [...new Set([rig.ownerId, ...pilots.map((p: any) => p.userId)])];

  // Fetch all check-ins from crew members with campground data
  const checkIns = await prisma.checkIn.findMany({
    where: {
      userId: { in: userIds },
      campgroundId: { not: null },
      checkOutDate: { not: null },
    },
    select: {
      campgroundId: true,
      checkInDate: true,
      checkOutDate: true,
      tripId: true,
      campground: { select: { state: true } },
    },
    orderBy: { checkInDate: 'asc' },
  });

  // Build stays
  const stays: Stay[] = checkIns
    .filter((ci: any) => ci.campgroundId && ci.checkOutDate)
    .map((ci: any) => ({
      campgroundId: ci.campgroundId!,
      state: ci.campground?.state || null,
      checkInDate: new Date(ci.checkInDate),
      checkOutDate: new Date(ci.checkOutDate),
      tripId: ci.tripId || null,
    }));

  // Deduplicate overlapping stays
  const deduped = deduplicateStays(stays);

  // Compute stats
  // Trips = count of deduplicated check-in events (revisits count, co-pilot overlap collapses)
  let totalNights = 0;
  const stateSet = new Set<string>();

  for (const stay of deduped) {
    const nights = Math.max(0, Math.round((stay.checkOutDate.getTime() - stay.checkInDate.getTime()) / 86400000));
    totalNights += nights;
    if (stay.state) stateSet.add(stay.state);
  }

  const statesVisited = Array.from(stateSet).sort();

  // Miles: only from real fuel log odometer deltas
  let totalMiles = 0;
  const fuelLogs = await prisma.fuelLog.findMany({
    where: { rigId, odometer: { not: null } },
    orderBy: { loggedAt: 'asc' },
    select: { odometer: true },
  });
  if (fuelLogs.length >= 2) {
    const first = fuelLogs[0].odometer;
    const last = fuelLogs[fuelLogs.length - 1].odometer;
    totalMiles = Math.max(0, last - first);
  }

  // Update rig record
  await prisma.rig.update({
    where: { id: rigId },
    data: {
      totalNightsCamped: totalNights,
      totalStatesCount: statesVisited.length,
      totalTripCount: deduped.length,
      totalMilesDriven: totalMiles,
      totalStatesVisited: statesVisited,
      totalNightsAllTime: totalNights,
      totalCampgroundsAllTime: deduped.length,
    },
  });

  return {
    nights: totalNights,
    states: statesVisited.length,
    trips: deduped.length,
    miles: totalMiles,
    statesVisited,
  };
}
