/**
 * Dream Trips — collaborative wishlist trips.
 * A dream trip is a RoadTrip with isDream=true, containing Event stops
 * that reference campgrounds and/or places.
 */
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
const db = prisma as any;

// ──────────────────────────────────────────────
// GET / — List user's dream trips
// ──────────────────────────────────────────────
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const trips = await db.roadTrip.findMany({
      where: { isDream: true, userId },
      include: {
        stops: {
          include: {
            campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true } },
            place: { select: { id: true, name: true, category: true, city: true, state: true, websiteImageUrl: true } },
          },
          orderBy: { stopNumber: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Also include dream trips where user is a contributor (attendee)
    const contributorTrips = await db.roadTrip.findMany({
      where: {
        isDream: true,
        stops: { some: { attendees: { some: { userId } } } },
        userId: { not: userId },
      },
      include: {
        stops: {
          include: {
            campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true } },
            place: { select: { id: true, name: true, category: true, city: true, state: true, websiteImageUrl: true } },
          },
          orderBy: { stopNumber: 'asc' },
        },
        user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const allTrips = [...trips, ...contributorTrips].map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      ownerId: t.userId,
      owner: t.user || null,
      stopCount: t.stops.length,
      coverImage: t.stops[0]?.campground?.imageUrl || t.stops[0]?.place?.websiteImageUrl || null,
      stops: t.stops.map((s: any) => ({
        id: s.id,
        name: s.title,
        campground: s.campground,
        place: s.place,
        stopNumber: s.stopNumber,
      })),
      updatedAt: t.updatedAt,
    }));

    res.json(allTrips);
  } catch (e: any) {
    console.error('[DreamTrips] list error:', e.message);
    res.status(500).json({ error: 'Failed to load dream trips' });
  }
});

// ──────────────────────────────────────────────
// POST /save — Genie click: create a dream trip with one stop
// (or add to existing if a dream trip for this item exists)
// ──────────────────────────────────────────────
router.post('/save', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, placeId, name } = req.body;

    if (!campgroundId && !placeId) {
      return res.status(400).json({ error: 'campgroundId or placeId required' });
    }

    // Check if this item is already a stop in any of the user's dream trips
    const existingStop = await db.event.findFirst({
      where: {
        roadTrip: { isDream: true, userId },
        ...(campgroundId ? { campgroundId } : { placeId }),
      },
      select: { id: true, roadTripId: true },
    });

    if (existingStop) {
      return res.json({ alreadySaved: true, tripId: existingStop.roadTripId, stopId: existingStop.id });
    }

    // Create a new dream trip with this as the first stop
    const tripTitle = `Dream: ${name || 'New Place'}`;
    const farFuture = new Date('2099-01-01'); // Placeholder — dream trips have no real dates
    const trip = await db.roadTrip.create({
      data: {
        userId,
        title: tripTitle,
        isDream: true,
        stops: {
          create: {
            title: name || 'Dream Stop',
            organizerId: userId,
            startDate: farFuture,
            endDate: farFuture,
            isWishlist: true,
            campgroundId: campgroundId || null,
            placeId: placeId || null,
            stopNumber: 0,
          },
        },
      },
      include: {
        stops: { select: { id: true } },
      },
    });

    res.json({ saved: true, tripId: trip.id, stopId: trip.stops[0]?.id });
  } catch (e: any) {
    console.error('[DreamTrips] save error:', e.message);
    res.status(500).json({ error: 'Failed to save dream trip' });
  }
});

// ──────────────────────────────────────────────
// DELETE /unsave — Remove a stop; delete trip if empty + solo
// ──────────────────────────────────────────────
router.delete('/unsave', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, placeId } = req.query;

    if (!campgroundId && !placeId) {
      return res.status(400).json({ error: 'campgroundId or placeId required' });
    }

    // Find the stop
    const stop = await db.event.findFirst({
      where: {
        roadTrip: { isDream: true, userId },
        ...(campgroundId ? { campgroundId: campgroundId as string } : { placeId: placeId as string }),
      },
      select: { id: true, roadTripId: true },
    });

    if (!stop) return res.json({ removed: false });

    // Delete the stop
    await db.event.delete({ where: { id: stop.id } });

    // Check if the trip is now empty
    const remainingStops = await db.event.count({ where: { roadTripId: stop.roadTripId } });
    if (remainingStops === 0) {
      // Check for contributors
      const trip = await db.roadTrip.findUnique({ where: { id: stop.roadTripId }, select: { userId: true, description: true } });
      // Delete if solo and no description/content
      if (trip?.userId === userId && !trip?.description) {
        await db.roadTrip.delete({ where: { id: stop.roadTripId } });
        return res.json({ removed: true, tripDeleted: true });
      }
    }

    res.json({ removed: true });
  } catch (e: any) {
    console.error('[DreamTrips] unsave error:', e.message);
    res.status(500).json({ error: 'Failed to unsave' });
  }
});

// ──────────────────────────────────────────────
// GET /check — Check if an item is saved in any dream trip
// ──────────────────────────────────────────────
router.get('/check', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, placeId } = req.query;

    const stop = await db.event.findFirst({
      where: {
        roadTrip: { isDream: true, userId },
        ...(campgroundId ? { campgroundId: campgroundId as string } : placeId ? { placeId: placeId as string } : {}),
      },
      select: { id: true, roadTripId: true },
    });

    res.json({ saved: !!stop, tripId: stop?.roadTripId || null });
  } catch (e: any) {
    res.json({ saved: false });
  }
});

// ──────────────────────────────────────────────
// GET /stops — All dream trip stops flattened (for wishlist filter/sidebar)
// ──────────────────────────────────────────────
router.get('/stops', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const stops = await db.event.findMany({
      where: {
        roadTrip: { isDream: true, userId },
        isWishlist: true,
      },
      include: {
        campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true, googleRating: true } },
        place: { select: { id: true, name: true, category: true, city: true, state: true, websiteImageUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = stops.map((s: any) => {
      const target = s.campground || s.place;
      return {
        id: target?.id || s.id,
        name: s.title || target?.name || 'Dream Stop',
        type: s.campgroundId ? 'campground' : 'place',
        imageUrl: s.campground?.imageUrl || s.place?.websiteImageUrl || null,
        city: target?.city,
        state: target?.state,
        rating: s.campground?.googleRating || null,
        category: s.place?.category || null,
        tripId: s.roadTripId,
        stopId: s.id,
      };
    });

    res.json(items);
  } catch (e: any) {
    console.error('[DreamTrips] stops error:', e.message);
    res.status(500).json({ error: 'Failed to load stops' });
  }
});

// ──────────────────────────────────────────────
// POST /:id/merge — Merge another dream trip into this one
// ──────────────────────────────────────────────
router.post('/:id/merge', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { sourceId } = req.body;

    if (!sourceId || sourceId === id) return res.status(400).json({ error: 'Invalid source trip' });

    // Verify ownership of both trips
    const [target, source] = await Promise.all([
      db.roadTrip.findUnique({ where: { id }, select: { userId: true, isDream: true } }),
      db.roadTrip.findUnique({ where: { id: sourceId }, select: { userId: true, isDream: true } }),
    ]);

    if (!target?.isDream || target.userId !== userId) return res.status(403).json({ error: 'Not authorized' });
    if (!source?.isDream || source.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    // Move all stops from source to target
    const maxStop = await db.event.findFirst({
      where: { roadTripId: id },
      orderBy: { stopNumber: 'desc' },
      select: { stopNumber: true },
    });
    const nextStop = (maxStop?.stopNumber || 0) + 1;

    const sourceStops = await db.event.findMany({
      where: { roadTripId: sourceId },
      select: { id: true },
      orderBy: { stopNumber: 'asc' },
    });

    for (let i = 0; i < sourceStops.length; i++) {
      await db.event.update({
        where: { id: sourceStops[i].id },
        data: { roadTripId: id, stopNumber: nextStop + i },
      });
    }

    // Delete the now-empty source trip
    await db.roadTrip.delete({ where: { id: sourceId } });

    res.json({ merged: true, stopsMovied: sourceStops.length });
  } catch (e: any) {
    console.error('[DreamTrips] merge error:', e.message);
    res.status(500).json({ error: 'Failed to merge trips' });
  }
});

// ──────────────────────────────────────────────
// POST /:id/promote — Promote dream trip to real planned trip
// ──────────────────────────────────────────────
// GET /:id/promote-info — Get member list for promote confirmation
router.get('/:id/promote-info', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const trip = await db.roadTrip.findUnique({
      where: { id },
      select: { title: true, userId: true, isDream: true, user: { select: { id: true, firstName: true, profilePicture: true } } },
    });
    if (!trip?.isDream) return res.status(400).json({ error: 'Not a dream trip' });

    // Get all contributors (attendees on any stop)
    const stops = await db.event.findMany({
      where: { roadTripId: id },
      include: { attendees: { where: { status: 'ATTENDING' }, include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } } } },
    });
    const memberMap = new Map<string, any>();
    memberMap.set(trip.user.id, trip.user);
    for (const stop of stops) {
      for (const att of stop.attendees) {
        if (att.user && !memberMap.has(att.user.id)) memberMap.set(att.user.id, att.user);
      }
    }

    res.json({ title: trip.title, members: Array.from(memberMap.values()), stopCount: stops.length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load promote info' });
  }
});

// POST /:id/promote — Promote dream trip to real trip (any contributor can do this)
router.post('/:id/promote', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { startDate, endDate, confirmed } = req.body;

    const trip = await db.roadTrip.findUnique({ where: { id }, select: { userId: true, isDream: true, title: true } });
    if (!trip?.isDream) return res.status(400).json({ error: 'Not a dream trip' });

    // Any contributor or owner can promote
    const isOwner = trip.userId === userId;
    const isContributor = !isOwner && await db.event.findFirst({
      where: { roadTripId: id, attendees: { some: { userId, status: 'ATTENDING' } } },
    });
    if (!isOwner && !isContributor) return res.status(403).json({ error: 'Not authorized' });

    // Flip to real trip
    await db.roadTrip.update({
      where: { id },
      data: {
        isDream: false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    // Update stops: clear isWishlist flag, set real dates
    const realStart = startDate ? new Date(startDate) : new Date();
    const realEnd = endDate ? new Date(endDate) : realStart;
    await db.event.updateMany({
      where: { roadTripId: id },
      data: { isWishlist: false, startDate: realStart, endDate: realEnd },
    });

    // Notify other members
    const { createNotification } = require('../utils/createNotification');
    const promoter = await db.user.findUnique({ where: { id: userId }, select: { firstName: true, profilePicture: true } });
    const stops = await db.event.findMany({
      where: { roadTripId: id },
      include: { attendees: { where: { status: 'ATTENDING' }, select: { userId: true } } },
    });
    const notifiedIds = new Set<string>();
    for (const stop of stops) {
      for (const att of stop.attendees) {
        if (att.userId !== userId && !notifiedIds.has(att.userId)) {
          notifiedIds.add(att.userId);
          await createNotification({
            userId: att.userId,
            type: 'DREAM_TRIP_PROMOTED',
            category: 'SYSTEM',
            content: `promoted "${trip.title}" from dream to real trip!`,
            link: `/trips/${stops[0]?.id || id}`,
            actorId: userId,
            actorName: promoter?.firstName || 'Someone',
            actorAvatar: promoter?.profilePicture,
          });
        }
      }
    }
    // Also notify the owner if promoter is a contributor
    if (!isOwner && !notifiedIds.has(trip.userId)) {
      await createNotification({
        userId: trip.userId,
        type: 'DREAM_TRIP_PROMOTED',
        category: 'SYSTEM',
        content: `promoted "${trip.title}" from dream to real trip!`,
        link: `/trips/${stops[0]?.id || id}`,
        actorId: userId,
        actorName: promoter?.firstName || 'Someone',
        actorAvatar: promoter?.profilePicture,
      });
    }

    res.json({ promoted: true });
  } catch (e: any) {
    console.error('[DreamTrips] promote error:', e.message);
    res.status(500).json({ error: 'Failed to promote trip' });
  }
});

// ──────────────────────────────────────────────
// POST /:id/invite — Send an invitation (notification-based)
// ──────────────────────────────────────────────
router.post('/:id/invite', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { inviteeId } = req.body;

    if (!inviteeId) return res.status(400).json({ error: 'inviteeId required' });

    const trip = await db.roadTrip.findUnique({
      where: { id },
      select: { userId: true, isDream: true, title: true },
    });
    if (!trip?.isDream) return res.status(400).json({ error: 'Not a dream trip' });

    // Any contributor or owner can invite
    const isOwner = trip.userId === userId;
    const isContributor = !isOwner && await db.event.findFirst({
      where: { roadTripId: id, attendees: { some: { userId, status: 'ATTENDING' } } },
    });
    if (!isOwner && !isContributor) return res.status(403).json({ error: 'Not authorized' });

    const inviter = await db.user.findUnique({ where: { id: userId }, select: { firstName: true, profilePicture: true } });
    const stopCount = await db.event.count({ where: { roadTripId: id } });

    // Send notification
    const { createNotification } = require('../utils/createNotification');
    await createNotification({
      userId: inviteeId,
      type: 'DREAM_TRIP_INVITE',
      category: 'SYSTEM',
      content: `invited you to dream trip "${trip.title}" (${stopCount} stops)`,
      link: `/dream-trips/${id}/accept`,
      actorId: userId,
      actorName: inviter?.firstName || 'Someone',
      actorAvatar: inviter?.profilePicture,
      metadata: { dreamTripId: id, tripTitle: trip.title },
    });

    res.json({ invited: true, tripTitle: trip.title });
  } catch (e: any) {
    console.error('[DreamTrips] invite error:', e.message);
    res.status(500).json({ error: 'Failed to invite' });
  }
});

// ──────────────────────────────────────────────
// POST /:id/accept — Accept a dream trip invite
// ──────────────────────────────────────────────
router.post('/:id/accept', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const trip = await db.roadTrip.findUnique({ where: { id }, select: { isDream: true, title: true, userId: true } });
    if (!trip?.isDream) return res.status(400).json({ error: 'Not a dream trip' });

    // Add as contributor to all stops
    const stops = await db.event.findMany({ where: { roadTripId: id }, select: { id: true } });
    for (const stop of stops) {
      await db.eventAttendee.upsert({
        where: { eventId_userId: { eventId: stop.id, userId } },
        create: { eventId: stop.id, userId, status: 'ATTENDING', role: 'CONTRIBUTOR' },
        update: { status: 'ATTENDING', role: 'CONTRIBUTOR' },
      });
    }

    res.json({ accepted: true, tripTitle: trip.title, stopCount: stops.length });
  } catch (e: any) {
    console.error('[DreamTrips] accept error:', e.message);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// ──────────────────────────────────────────────
// POST /:id/decline — Decline a dream trip invite (no-op, quiet)
// ──────────────────────────────────────────────
router.post('/:id/decline', authenticateToken, async (_req: Request, res: Response) => {
  res.json({ declined: true });
});

// ──────────────────────────────────────────────
// POST /:id/leave — Leave a dream trip (contributor removes self)
// ──────────────────────────────────────────────
router.post('/:id/leave', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const trip = await db.roadTrip.findUnique({ where: { id }, select: { userId: true, isDream: true, title: true } });
    if (!trip?.isDream) return res.status(400).json({ error: 'Not a dream trip' });
    if (trip.userId === userId) return res.status(400).json({ error: 'Owner cannot leave — delete the trip instead' });

    // Remove from all stops
    const stops = await db.event.findMany({ where: { roadTripId: id }, select: { id: true } });
    for (const stop of stops) {
      await db.eventAttendee.deleteMany({ where: { eventId: stop.id, userId } });
    }

    res.json({ left: true });
  } catch (e: any) {
    console.error('[DreamTrips] leave error:', e.message);
    res.status(500).json({ error: 'Failed to leave trip' });
  }
});

// ──────────────────────────────────────────────
// POST /clone/:roadTripId — Clone a visible trip as a dream trip
// ──────────────────────────────────────────────
router.post('/clone/:roadTripId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { roadTripId } = req.params;

    // Load the source trip with stops
    const source = await db.roadTrip.findUnique({
      where: { id: roadTripId },
      include: {
        stops: {
          select: {
            title: true, location: true, campgroundId: true, placeId: true,
            stopNumber: true, description: true, isWishlist: true,
          },
          orderBy: { stopNumber: 'asc' },
        },
        user: { select: { id: true, firstName: true, username: true } },
      },
    });

    if (!source) return res.status(404).json({ error: 'Trip not found' });

    // Respect privacy: only clone public/shared trips
    if (source.privacy === 'PRIVATE' && source.userId !== userId) {
      return res.status(403).json({ error: 'This trip is private' });
    }

    // Don't clone your own trip
    if (source.userId === userId) {
      return res.status(400).json({ error: 'Cannot clone your own trip' });
    }

    // Create the dream trip clone
    const clone = await db.roadTrip.create({
      data: {
        userId,
        title: `Dream: ${source.title}`,
        description: source.description || null,
        isDream: true,
        color: source.color,
        font: source.font,
      },
    });

    // Copy stops (without dates, participants, photos, check-ins)
    for (const stop of source.stops) {
      const farFuture = new Date('2099-01-01');
      await db.event.create({
        data: {
          title: stop.title,
          organizerId: userId,
          startDate: farFuture,
          endDate: farFuture,
          isWishlist: true,
          location: stop.location,
          campgroundId: stop.campgroundId,
          placeId: stop.placeId,
          stopNumber: stop.stopNumber,
          roadTripId: clone.id,
        },
      });
    }

    // Store attribution (sourceTrip reference in description)
    const attribution = source.user
      ? `Inspired by ${source.user.firstName || source.user.username}'s "${source.title}"`
      : `Inspired by a fellow RVer's "${source.title}"`;
    await db.roadTrip.update({
      where: { id: clone.id },
      data: { description: attribution },
    });

    res.json({
      cloned: true,
      tripId: clone.id,
      title: clone.title,
      stopCount: source.stops.length,
      attribution,
    });
  } catch (e: any) {
    console.error('[DreamTrips] clone error:', e.message);
    res.status(500).json({ error: 'Failed to clone trip' });
  }
});

export default router;
