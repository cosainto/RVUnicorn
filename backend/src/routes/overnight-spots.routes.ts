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
