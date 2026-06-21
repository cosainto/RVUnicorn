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
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

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
