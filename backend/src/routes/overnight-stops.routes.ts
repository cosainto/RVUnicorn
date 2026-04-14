import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// GET /api/overnight-stops?lat=&lng=&radius=&type=
router.get('/', optionalAuth, async (req: any, res) => {
  try {
    const { lat, lng, radius = 25, type, state } = req.query;
    let stops: any[] = [];

    if (lat && lng) {
      const latN = parseFloat(lat as string);
      const lngN = parseFloat(lng as string);
      const r = parseFloat(radius as string) / 69; // degrees approx
      stops = await prisma.overnightStop.findMany({
        where: {
          latitude: { gte: latN - r, lte: latN + r },
          longitude: { gte: lngN - r, lte: lngN + r },
          ...(type ? { stopType: type as string } : {}),
        },
        include: {
          reviews: { select: { rating: true, safetyRating: true } },
          updates: { orderBy: { createdAt: 'desc' }, take: 3, include: { user: { select: { firstName: true, username: true } } } },
          _count: { select: { reviews: true } },
        },
        take: 30,
      });
    } else if (state) {
      stops = await prisma.overnightStop.findMany({
        where: { state: state as string, ...(type ? { stopType: type as string } : {}) },
        include: {
          reviews: { select: { rating: true, safetyRating: true } },
          updates: { orderBy: { createdAt: 'desc' }, take: 3, include: { user: { select: { firstName: true, username: true } } } },
          _count: { select: { reviews: true } },
        },
        take: 50,
      });
    }

    // Compute average ratings
    const enriched = stops.map(s => ({
      ...s,
      avgRating: s.reviews.length ? s.reviews.reduce((a: number, r: any) => a + r.rating, 0) / s.reviews.length : null,
      avgSafetyRating: s.reviews.length ? s.reviews.reduce((a: number, r: any) => a + r.safetyRating, 0) / s.reviews.length : null,
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('Overnight stops error:', error);
    res.status(500).json({ error: 'Failed to fetch overnight stops' });
  }
});

// GET /api/overnight-stops/:id
router.get('/:id', optionalAuth, async (req: any, res) => {
  try {
    const stop = await prisma.overnightStop.findUnique({
      where: { id: req.params.id },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
        },
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } },
        },
        _count: { select: { reviews: true } },
      },
    });
    if (!stop) return res.status(404).json({ error: 'Not found' });

    const avgRating = stop.reviews.length ? stop.reviews.reduce((a: any, r: any) => a + r.rating, 0) / stop.reviews.length : null;
    const avgSafetyRating = stop.reviews.length ? stop.reviews.reduce((a: any, r: any) => a + r.safetyRating, 0) / stop.reviews.length : null;

    res.json({ ...stop, avgRating, avgSafetyRating });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch stop' });
  }
});

// POST /api/overnight-stops — create a new stop (any logged in user)
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { name, address, city, state, latitude, longitude, stopType, website, phone, notes, maxNights, requiresPermission } = req.body;
    if (!name || !address || !latitude || !longitude || !stopType) {
      return res.status(400).json({ error: 'name, address, lat, lng, stopType required' });
    }
    const stop = await prisma.overnightStop.create({
      data: { name, address, city, state, latitude: parseFloat(latitude), longitude: parseFloat(longitude), stopType, website, phone, notes, maxNights: maxNights ? parseInt(maxNights) : null, requiresPermission: requiresPermission ?? false },
    });
    res.status(201).json(stop);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create stop' });
  }
});

// POST /api/overnight-stops/:id/reviews
router.post('/:id/reviews', authenticateToken, async (req: any, res) => {
  try {
    const { rating, safetyRating, noiseLevel, content, visitDate, wouldReturn } = req.body;
    if (!rating || !safetyRating) return res.status(400).json({ error: 'rating and safetyRating required' });
    const review = await prisma.overnightStopReview.upsert({
      where: { stopId_userId: { stopId: req.params.id, userId: req.userId } },
      update: { rating: parseInt(rating), safetyRating: parseInt(safetyRating), noiseLevel, content, visitDate: visitDate ? new Date(visitDate) : null, wouldReturn: wouldReturn ?? true },
      create: { stopId: req.params.id, userId: req.userId, rating: parseInt(rating), safetyRating: parseInt(safetyRating), noiseLevel, content, visitDate: visitDate ? new Date(visitDate) : null, wouldReturn: wouldReturn ?? true },
      include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } },
    });
    res.json(review);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// POST /api/overnight-stops/:id/updates
router.post('/:id/updates', authenticateToken, async (req: any, res) => {
  try {
    const { content, updateType } = req.body;
    if (!content || !updateType) return res.status(400).json({ error: 'content and updateType required' });
    const update = await prisma.overnightStopUpdate.create({
      data: { stopId: req.params.id, userId: req.userId, content, updateType },
      include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } },
    });
    res.json(update);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to post update' });
  }
});


// GET /api/overnight-stops/:id/travelers — who else is stopping here
router.get('/:id/travelers', optionalAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const stop = await prisma.overnightStop.findUnique({
      where: { id },
      select: { latitude: true, longitude: true }
    });
    if (!stop) return res.status(404).json({ error: 'Not found' });

    // Find pit stops linked directly OR by proximity (within ~0.3 miles)
    const latDelta = 0.005; // ~0.3 miles
    const lngDelta = 0.005;
    const pitStops = await prisma.pitStop.findMany({
      where: {
        stopType: 'OVERNIGHT',
        OR: [
          { overnightStopId: id },
          {
            latitude: { gte: stop.latitude - latDelta, lte: stop.latitude + latDelta },
            longitude: { gte: stop.longitude - lngDelta, lte: stop.longitude + lngDelta },
          }
        ]
      },
      include: {
        tripPlan: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
            event: { select: { id: true, title: true, startDate: true, endDate: true } }
          }
        }
      },
      orderBy: { estimatedArrival: 'asc' }
    });

    // Deduplicate by userId
    const seen = new Set<string>();
    const travelers = pitStops
      .filter((ps: any) => {
        const uid = ps.tripPlan?.user?.id;
        if (!uid || seen.has(uid)) return false;
        seen.add(uid);
        return true;
      })
      .map((ps: any) => ({
        user: ps.tripPlan.user,
        estimatedArrival: ps.estimatedArrival,
        tripTitle: ps.tripPlan.event?.title,
      }));

    res.json({ count: travelers.length, travelers });
  } catch (error: any) {
    console.error('Travelers error:', error);
    res.status(500).json({ error: 'Failed to fetch travelers' });
  }
});

export default router;
