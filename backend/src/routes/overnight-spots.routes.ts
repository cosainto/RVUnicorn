import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/overnight-spots/near?lat=&lng=&radius=&categories=&limit=
router.get('/near', authenticateToken, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 50; // miles
    const limit = parseInt(req.query.limit as string) || 20;
    const categories = req.query.categories ? (req.query.categories as string).split(',') : null;

    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat and lng required' });

    // Bounding box first for performance, then haversine filter
    const latDelta = radius / 69;
    const lngDelta = radius / (69 * Math.cos(lat * Math.PI / 180));

    const where: any = {
      latitude: { gte: lat - latDelta, lte: lat + latDelta },
      longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      allowsRvs: true,
    };
    if (categories) where.category = { in: categories };

    const spots = await prisma.freeOvernightSpot.findMany({
      where,
      take: limit * 3, // over-fetch for haversine filter
      orderBy: { rating: 'desc' }
    });

    // Haversine distance filter + sort
    const withDistance = spots.map(s => {
      const R = 3959;
      const dLat = (s.latitude - lat) * Math.PI / 180;
      const dLng = (s.longitude - lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180) * Math.cos(s.latitude*Math.PI/180) * Math.sin(dLng/2)**2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return { ...s, distanceMiles: Math.round(distance * 10) / 10 };
    }).filter(s => s.distanceMiles <= radius)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, limit);

    res.json(withDistance);
  } catch (e: any) {
    console.error('overnight-spots/near error:', e?.message);
    res.status(500).json({ error: 'Failed to fetch spots' });
  }
});

// GET /api/overnight-spots/along-route?points=lat1,lng1|lat2,lng2&radius=&categories=
// Finds spots within radius of any point along a route
router.get('/along-route', authenticateToken, async (req, res) => {
  try {
    const pointsStr = req.query.points as string;
    const radius = parseFloat(req.query.radius as string) || 30;
    const categories = req.query.categories ? (req.query.categories as string).split(',') : null;

    if (!pointsStr) return res.status(400).json({ error: 'points required' });

    const points = pointsStr.split('|').map(p => {
      const [lat, lng] = p.split(',').map(Number);
      return { lat, lng };
    }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

    if (points.length === 0) return res.status(400).json({ error: 'No valid points' });

    // Get bounding box of all points
    const minLat = Math.min(...points.map(p => p.lat)) - radius / 69;
    const maxLat = Math.max(...points.map(p => p.lat)) + radius / 69;
    const midLat = (minLat + maxLat) / 2;
    const lngDelta = radius / (69 * Math.cos(midLat * Math.PI / 180));
    const minLng = Math.min(...points.map(p => p.lng)) - lngDelta;
    const maxLng = Math.max(...points.map(p => p.lng)) + lngDelta;

    const where: any = {
      latitude: { gte: minLat, lte: maxLat },
      longitude: { gte: minLng, lte: maxLng },
      allowsRvs: true,
    };
    if (categories) where.category = { in: categories };

    const spots = await prisma.freeOvernightSpot.findMany({ where, take: 500 });

    // Filter to spots within radius of at least one route point
    const R = 3959;
    const nearby = spots.filter(spot => {
      return points.some(pt => {
        const dLat = (spot.latitude - pt.lat) * Math.PI / 180;
        const dLng = (spot.longitude - pt.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(pt.lat*Math.PI/180) * Math.cos(spot.latitude*Math.PI/180) * Math.sin(dLng/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return dist <= radius;
      });
    });

    res.json(nearby);
  } catch (e: any) {
    console.error('overnight-spots/along-route error:', e?.message);
    res.status(500).json({ error: 'Failed to fetch spots' });
  }
});

// GET /api/overnight-spots/stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const total = await prisma.freeOvernightSpot.count();
    const byCategory = await prisma.freeOvernightSpot.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });
    const byChain = await prisma.freeOvernightSpot.groupBy({
      by: ['chain'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20
    });
    res.json({ total, byCategory, byChain });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;

// GET /api/overnight-spots/search?q=&limit=
router.get('/search', async (req: any, res) => {
  try {
    const { q = '', limit = 10, state } = req.query;
    const spots = await prisma.freeOvernightSpot.findMany({
      where: {
        AND: [
          state ? { state: state as string } : {},
          q ? {
            OR: [
              { name: { contains: q as string, mode: 'insensitive' } },
              { city: { contains: q as string, mode: 'insensitive' } },
              { chain: { contains: q as string, mode: 'insensitive' } },
              { category: { contains: q as string, mode: 'insensitive' } },
            ]
          } : {},
        ]
      },
      take: parseInt(limit as string),
      include: {
        reviews: { select: { rating: true } }
      }
    });
    const spotsWithRating = spots.map((s: any) => ({
      ...s,
      avgRating: s.reviews.length ? (s.reviews.reduce((a: number, r: any) => a + r.rating, 0) / s.reviews.length).toFixed(1) : null,
      reviewCount: s.reviews.length,
    }));
    res.json({ spots: spotsWithRating });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/overnight-spots/:id
router.get('/:id', async (req: any, res) => {
  try {
    const spot = await prisma.freeOvernightSpot.findUnique({
      where: { id: req.params.id },
      include: {
        reviews: {
          include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!spot) return res.status(404).json({ error: 'Not found' });
    const avgRating = spot.reviews.length
      ? (spot.reviews.reduce((a, r) => a + r.rating, 0) / spot.reviews.length).toFixed(1)
      : null;
    res.json({ ...spot, avgRating, reviewCount: spot.reviews.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/overnight-spots/:id/reviews
router.post('/:id/reviews', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { rating, wouldReturn, tags, notes, visitDate } = req.body;

    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });

    const review = await prisma.freeOvernightSpotReview.upsert({
      where: { spotId_userId: { spotId: id, userId } },
      create: { spotId: id, userId, rating, wouldReturn, tags: tags || [], notes, visitDate: visitDate ? new Date(visitDate) : null },
      update: { rating, wouldReturn, tags: tags || [], notes, visitDate: visitDate ? new Date(visitDate) : null },
      include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } }
    });

    // Update spot rating cache
    const allReviews = await prisma.freeOvernightSpotReview.findMany({ where: { spotId: id }, select: { rating: true } });
    const avgRating = allReviews.reduce((a, r) => a + r.rating, 0) / allReviews.length;
    await prisma.freeOvernightSpot.update({
      where: { id },
      data: { rating: avgRating, reviewCount: allReviews.length }
    });

    // Award first night badge
    try {
      const badge = await prisma.badge.findUnique({ where: { slug: 'first-night-host' } });
      if (badge) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId, badgeId: badge.id } },
          create: { userId, badgeId: badge.id },
          update: {}
        });
      }
    } catch {}

    res.json(review);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
