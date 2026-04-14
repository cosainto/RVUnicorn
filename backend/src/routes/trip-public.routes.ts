import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient() as any;

function generateSlug(ownerLastName: string, tripTitle: string): string {
  const year = new Date().getFullYear();
  return `${ownerLastName}-${tripTitle}-${year}`.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

// ══ GET /api/trips/:slug/public — public trip view ══
router.get('/:slug/public', optionalAuth, async (req: any, res: Response) => {
  try {
    const { slug } = req.params;
    const trip = await prisma.event.findFirst({
      where: { OR: [{ tripSlug: slug }, { id: slug }] },
      include: {
        organizer: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        campground: { select: { id: true, name: true, location: true, city: true, state: true, imageUrl: true, customSlug: true, amenities: true, latitude: true, longitude: true } },
        attendees: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } } },
        meals: { include: { dishes: true } },
      },
    });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (!trip.isPublic && !trip.tripSlug) return res.status(404).json({ error: 'This trip is private' });

    // Increment view count
    await prisma.event.update({ where: { id: trip.id }, data: { publicViewCount: { increment: 1 } } }).catch(() => {});

    // Log view event
    await prisma.tripViewEvent.create({
      data: { tripId: trip.id, viewerUserId: req.userId || null, referrer: req.headers.referer || null, userAgent: req.headers['user-agent'] || null },
    }).catch(() => {});

    // Get road trip stops if part of a road trip
    let stops: any[] = [];
    if (trip.roadTripId) {
      stops = await prisma.event.findMany({
        where: { roadTripId: trip.roadTripId },
        include: { campground: { select: { id: true, name: true, location: true, city: true, state: true, imageUrl: true, customSlug: true, amenities: true, latitude: true, longitude: true } } },
        orderBy: { stopNumber: 'asc' },
      });
    } else if (trip.campground) {
      stops = [trip];
    }

    // Get photos from trip campgrounds
    const campgroundIds = stops.map((s: any) => s.campgroundId).filter(Boolean);
    let photos: any[] = [];
    if (campgroundIds.length > 0) {
      photos = await prisma.campgroundPhoto.findMany({
        where: { campgroundId: { in: campgroundIds }, status: 'APPROVED' },
        select: { id: true, imageUrl: true, campgroundId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 12,
      });
    }

    // Active check-in for ghost mode
    let currentBasecamp = null;
    if (trip.ghostModeEnabled) {
      const activeCheckin = await prisma.checkIn.findFirst({
        where: { userId: trip.organizerId, isActive: true },
        include: { campground: { select: { name: true, city: true, state: true } } },
      });
      if (activeCheckin?.campground) {
        currentBasecamp = { campgroundName: activeCheckin.campground.name, city: activeCheckin.campground.city, state: activeCheckin.campground.state };
      }
    }

    // Determine trip status
    const now = new Date();
    const isActive = now >= trip.startDate && now <= trip.endDate;
    const isCompleted = now > trip.endDate;

    // Stats
    const statesVisited = [...new Set(stops.map((s: any) => s.campground?.state).filter(Boolean))];

    res.json({
      trip: { id: trip.id, name: trip.title, slug: trip.tripSlug, description: trip.description, startDate: trip.startDate, endDate: trip.endDate, isActive, isCompleted, ghostModeEnabled: trip.ghostModeEnabled, viewCount: trip.publicViewCount },
      owner: { displayName: `${trip.organizer.firstName} ${trip.organizer.lastName}`, avatarUrl: trip.organizer.profilePicture, username: trip.organizer.username },
      stops: stops.map((s: any, i: number) => ({
        number: i + 1, total: stops.length,
        campground: s.campground, dates: { start: s.startDate, end: s.endDate },
        status: now > s.endDate ? 'visited' : (now >= s.startDate && now <= s.endDate ? 'current' : 'upcoming'),
        photos: photos.filter(p => p.campgroundId === s.campgroundId).slice(0, 3),
      })),
      photos,
      recipes: trip.meals?.filter((m: any) => m.title).map((m: any) => ({ name: m.title, campground: trip.campground?.name })) || [],
      crew: trip.attendees?.map((a: any) => ({ displayName: `${a.user.firstName} ${a.user.lastName}`, avatarUrl: a.user.profilePicture, username: a.user.username })) || [],
      currentBasecamp,
      stats: { nightsCamped: stops.length > 0 ? Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000) : 0, stopsCount: stops.length, statesVisited: statesVisited.length, stateNames: statesVisited, photoCount: photos.length, recipeCount: trip.meals?.length || 0 },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/trips/:id/share — make trip public ══
router.post('/:id/share', authenticateToken, async (req: any, res: Response) => {
  try {
    const trip = await prisma.event.findUnique({ where: { id: req.params.id }, include: { organizer: { select: { lastName: true } } } });
    if (!trip || trip.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const slug = trip.tripSlug || generateSlug(trip.organizer.lastName, trip.title);
    const shareToken = trip.shareToken || crypto.randomUUID();

    await prisma.event.update({
      where: { id: trip.id },
      data: { isPublic: true, tripSlug: slug, shareToken, sharedAt: new Date() },
    });

    res.json({ shareUrl: `https://www.rvunicorn.com/trips/${slug}/view`, slug, shareToken });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ PATCH /api/trips/:id/ghost-mode ══
router.patch('/:id/ghost-mode', authenticateToken, async (req: any, res: Response) => {
  try {
    const trip = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!trip || trip.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.event.update({ where: { id: trip.id }, data: { ghostModeEnabled: !!req.body.enabled } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ══ POST /api/trips/:id/unshare ══
router.post('/:id/unshare', authenticateToken, async (req: any, res: Response) => {
  try {
    const trip = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!trip || trip.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.event.update({ where: { id: trip.id }, data: { isPublic: false } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
