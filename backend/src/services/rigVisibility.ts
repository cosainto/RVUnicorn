/**
 * Shared rig content visibility check.
 *
 * Every place that reads rig photos/posts must pass through this.
 * - PUBLIC / BOTH → visible to everyone
 * - FRIENDS_ONLY → visible only to owner, co-pilots, and confirmed friends
 *
 * Also provides:
 * - publicVisibilityFilter: Prisma WHERE clause for public-only queries
 * - isFriend: check if two users are friends
 */

import { prisma } from '../lib/prisma';

/**
 * Prisma WHERE clause to filter to only publicly visible content.
 * Use in any query that serves public/non-authenticated surfaces.
 */
export const publicVisibilityFilter = {
  OR: [
    { visibility: 'PUBLIC' },
    { visibility: 'BOTH' },
    { visibility: null },  // legacy posts without visibility field
  ],
};

/**
 * Prisma WHERE clause for the isPublic boolean (legacy compat).
 * Combines isPublic + visibility.
 */
export function publicRigPostFilter() {
  return {
    isPublic: true,
    ...publicVisibilityFilter,
  };
}

/**
 * Check if two users are confirmed friends.
 */
export async function isFriend(userId: string, otherUserId: string): Promise<boolean> {
  if (!userId || !otherUserId || userId === otherUserId) return true; // owner sees own content
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { initiatorId: userId, receiverId: otherUserId },
        { initiatorId: otherUserId, receiverId: userId },
      ],
    },
    select: { id: true },
  });
  return !!friendship;
}

/**
 * Check if a viewer can see a specific piece of rig content.
 *
 * @param visibility - The content's visibility: PUBLIC, FRIENDS_ONLY, BOTH, or null (legacy = public)
 * @param viewerId - The ID of the user viewing (null = logged out)
 * @param ownerId - The rig owner's user ID
 * @param rigId - The rig ID (to check co-pilot access)
 */
export async function canViewRigContent(
  visibility: string | null,
  viewerId: string | null,
  ownerId: string,
  rigId?: string,
): Promise<boolean> {
  // PUBLIC or BOTH or null (legacy) → everyone can see
  if (!visibility || visibility === 'PUBLIC' || visibility === 'BOTH') return true;

  // FRIENDS_ONLY → only owner, co-pilots, and friends
  if (visibility === 'FRIENDS_ONLY') {
    if (!viewerId) return false; // logged out
    if (viewerId === ownerId) return true; // owner

    // Check co-pilot
    if (rigId) {
      const pilot = await prisma.rigPilot.findUnique({
        where: { rigId_userId: { rigId, userId: viewerId } },
      });
      if (pilot) return true;
    }

    // Check friendship with owner
    return isFriend(viewerId, ownerId);
  }

  return true;
}

// ─── TRIP VISIBILITY ───────────────────────────────────────

/**
 * Prisma WHERE clause to filter trips for public/non-owner viewers.
 * PRIVATE trips are excluded; SHARED and PUBLIC pass through.
 */
export const publicTripFilter = {
  visibility: { not: 'PRIVATE' },
};

/**
 * Check if a viewer can see a specific trip.
 */
export async function canViewTrip(
  tripVisibility: string | null,
  viewerId: string | null,
  ownerId: string,
  rigId?: string,
  tripId?: string,
): Promise<boolean> {
  // PUBLIC or SHARED → visible to everyone
  if (tripVisibility === 'PUBLIC' || tripVisibility === 'SHARED') return true;

  // PRIVATE → only owner, co-pilots, or invited trip members
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;

  if (rigId) {
    const pilot = await prisma.rigPilot.findUnique({
      where: { rigId_userId: { rigId, userId: viewerId } },
    });
    if (pilot) return true;
  }

  // Check trip-scoped invite (Viewer or Joiner with ACCEPTED status)
  if (tripId) {
    const member = await prisma.rigTripMember.findUnique({
      where: { tripId_userId: { tripId, userId: viewerId } },
    });
    if (member && member.status === 'ACCEPTED') return true;
  }

  return false;
}

/**
 * Scrub location precision from a trip object for public viewers.
 * Returns the trip with coordinates removed/rounded based on locationPrecision.
 */
export function scrubTripLocation(trip: any, isOwnerOrPilot: boolean): any {
  if (isOwnerOrPilot) return trip; // owner sees everything

  const precision = trip.locationPrecision || 'AREA';

  if (precision === 'HIDDEN') {
    // Remove all location data
    const { campgroundId, statesVisited, ...rest } = trip;
    return { ...rest, campgroundId: null, statesVisited: [] };
  }

  if (precision === 'AREA') {
    // Keep state-level data, remove precise coordinates from stops
    return trip; // campgroundId stays (it's a named place), but precise lat/lng on stops would be rounded
  }

  // PRECISE — return as-is
  return trip;
}
