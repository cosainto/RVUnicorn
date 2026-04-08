import { prisma } from '../prisma';

/**
 * Single source of truth for "who can do what on a photo album."
 *
 * Access tiers:
 *
 *   - Owner          — full control (read, write, manage collaborators, delete)
 *   - Collaborator   — explicit invite via PhotoAlbumCollaborator (read + write,
 *                      can set cover)
 *   - Co-pilot       — the album owner's RigConnection partner (status APPROVED).
 *                      Treated as a collaborator for read+write without needing
 *                      an explicit invite.
 *   - Event co-attendee — when the album is linked to an event (PhotoAlbum.eventId
 *                      is set), every other attendee on that event has read+write
 *                      access. This is what makes "share an album with everyone
 *                      on the trip" work without an N-way invite dance.
 *   - Public viewer  — privacy-based, read only.
 *
 * The check returns a small structured result so callers can branch on the
 * specific tier (e.g. only owners can manage collaborators) without re-running
 * the check multiple times.
 */
export interface AlbumAccess {
  exists: boolean;
  isOwner: boolean;
  isCollaborator: boolean;
  isCoPilot: boolean;
  isEventCoAttendee: boolean;
  /** Can view the album and its photos. */
  canRead: boolean;
  /** Can upload photos and set the cover. */
  canWrite: boolean;
  /** Can add/remove collaborators and delete the album. Owner only. */
  canManage: boolean;
}

const DENIED: AlbumAccess = {
  exists: false,
  isOwner: false,
  isCollaborator: false,
  isCoPilot: false,
  isEventCoAttendee: false,
  canRead: false,
  canWrite: false,
  canManage: false,
};

/**
 * Compute the access tier for `userId` on `albumId`. The album record is
 * fetched once and reused — callers don't need to do their own lookup.
 *
 * Privacy is also factored into canRead: a non-collaborator non-co-pilot
 * non-event-mate can still read PUBLIC albums. PRIVATE albums require an
 * explicit access tier. FRIENDS visibility is NOT handled here (caller can
 * still layer a friendship check on top), so it falls back to "no read"
 * unless privacy === 'PUBLIC'.
 */
export async function getAlbumAccess(albumId: string, userId: string | null | undefined): Promise<AlbumAccess> {
  const album = await prisma.photoAlbum.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      userId: true,
      privacy: true,
      eventId: true,
      collaborators: userId ? { where: { userId }, select: { id: true } } : false,
    },
  });

  if (!album) return DENIED;

  if (!userId) {
    // No user — read-only public access
    return {
      exists: true,
      isOwner: false,
      isCollaborator: false,
      isCoPilot: false,
      isEventCoAttendee: false,
      canRead: album.privacy === 'PUBLIC',
      canWrite: false,
      canManage: false,
    };
  }

  const isOwner = album.userId === userId;
  const isCollaborator = !isOwner && (album.collaborators?.length || 0) > 0;

  // Co-pilot check — does an APPROVED RigConnection exist between the album
  // owner and this user?
  let isCoPilot = false;
  if (!isOwner && !isCollaborator) {
    const connection = await prisma.rigConnection.findFirst({
      where: {
        status: 'APPROVED',
        OR: [
          { requesterId: album.userId, receiverId: userId },
          { requesterId: userId, receiverId: album.userId },
        ],
      },
      select: { id: true },
    });
    isCoPilot = !!connection;
  }

  // Event co-attendee check — only meaningful when the album is linked to
  // an event. Both users (album owner and current user) need to be on it.
  let isEventCoAttendee = false;
  if (!isOwner && !isCollaborator && !isCoPilot && album.eventId) {
    const attendance = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: album.eventId, userId } },
      select: { id: true },
    });
    if (attendance) {
      // Confirm the album owner is also on the event (organizer or attendee)
      const ownerOnEvent = await prisma.event.findFirst({
        where: {
          id: album.eventId,
          OR: [
            { organizerId: album.userId },
            { attendees: { some: { userId: album.userId } } },
          ],
        },
        select: { id: true },
      });
      isEventCoAttendee = !!ownerOnEvent;
    }
  }

  const hasExplicitAccess = isOwner || isCollaborator || isCoPilot || isEventCoAttendee;

  return {
    exists: true,
    isOwner,
    isCollaborator,
    isCoPilot,
    isEventCoAttendee,
    // Read access: explicit tier OR public visibility
    canRead: hasExplicitAccess || album.privacy === 'PUBLIC',
    // Write access (upload photos, set cover): any explicit tier
    canWrite: hasExplicitAccess,
    // Manage (add/remove collaborators, delete): owner only
    canManage: isOwner,
  };
}

/**
 * Given a user, return the IDs of all albums they have implicit access to
 * via co-pilot or shared event. Used when listing albums for a profile —
 * we want the profile to show albums the user can collaborate on, not just
 * the ones they explicitly own or were invited to.
 *
 * Returns just the IDs so the caller can do whatever query/include shape
 * they need.
 */
export async function getImplicitlyAccessibleAlbumIds(userId: string): Promise<string[]> {
  const ids = new Set<string>();

  // Albums owned by your co-pilot
  const coPilotConnections = await prisma.rigConnection.findMany({
    where: {
      status: 'APPROVED',
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
    select: { requesterId: true, receiverId: true },
  });
  const coPilotIds = coPilotConnections.map(c => (c.requesterId === userId ? c.receiverId : c.requesterId));
  if (coPilotIds.length > 0) {
    const coPilotAlbums = await prisma.photoAlbum.findMany({
      where: { userId: { in: coPilotIds } },
      select: { id: true },
    });
    for (const a of coPilotAlbums) ids.add(a.id);
  }

  // Albums linked to events you're on
  const myAttendances = await prisma.eventAttendee.findMany({
    where: { userId },
    select: { eventId: true },
  });
  const myOrganizedEvents = await prisma.event.findMany({
    where: { organizerId: userId },
    select: { id: true },
  });
  const myEventIds = Array.from(new Set([
    ...myAttendances.map(a => a.eventId),
    ...myOrganizedEvents.map(e => e.id),
  ]));
  if (myEventIds.length > 0) {
    const eventAlbums = await prisma.photoAlbum.findMany({
      where: { eventId: { in: myEventIds }, userId: { not: userId } },
      select: { id: true },
    });
    for (const a of eventAlbums) ids.add(a.id);
  }

  return Array.from(ids);
}
