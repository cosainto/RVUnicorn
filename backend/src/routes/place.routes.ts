import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
const db = prisma as any;

// Helper: compute distance in miles between two lat/lng points (Haversine)
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ──────────────────────────────────────────────
// GET /search?q=...&lat=...&lng=...&near_campground=...
// Public unified search across Places and Campgrounds
// ──────────────────────────────────────────────
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const nearCampgroundId = req.query.near_campground as string | undefined;

    if (!q) {
      return res.json([]);
    }

    // Determine sort origin
    let originLat: number | undefined = lat;
    let originLng: number | undefined = lng;

    if (nearCampgroundId) {
      const campground = await db.campground.findUnique({
        where: { id: nearCampgroundId },
        select: { latitude: true, longitude: true },
      });
      if (campground?.latitude && campground?.longitude) {
        originLat = campground.latitude;
        originLng = campground.longitude;
      }
    }

    // Search Places
    const places = await db.place.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        category: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
      },
      take: 20,
    });

    // Search Campgrounds
    const campgrounds = await db.campground.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
      },
      take: 20,
    });

    // Unify results
    let results: any[] = [
      ...places.map((p: any) => ({ ...p, type: 'place' as const })),
      ...campgrounds.map((c: any) => ({
        ...c,
        category: 'campground',
        type: 'campground' as const,
      })),
    ];

    // Sort by distance if we have an origin
    if (originLat !== undefined && originLng !== undefined) {
      results = results
        .map((r) => ({
          ...r,
          _dist:
            r.latitude && r.longitude
              ? distanceMiles(originLat!, originLng!, r.latitude, r.longitude)
              : Infinity,
        }))
        .sort((a, b) => a._dist - b._dist)
        .map(({ _dist, ...rest }) => rest);
    }

    res.json(results.slice(0, 20));
  } catch (error: any) {
    console.error('Place search error:', error);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

// ──────────────────────────────────────────────
// GET /suggestions?campgroundId=...
// "Things To Do Nearby" — places within ~25 miles
// ──────────────────────────────────────────────
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const campgroundId = req.query.campgroundId as string;
    if (!campgroundId) {
      return res.status(400).json({ error: 'campgroundId is required' });
    }

    const campground = await db.campground.findUnique({
      where: { id: campgroundId },
      select: { latitude: true, longitude: true },
    });

    if (!campground?.latitude || !campground?.longitude) {
      return res.json([]);
    }

    // ~25 miles bounding box (1 degree lat ≈ 69 miles)
    const latDelta = 25 / 69;
    const lngDelta = 25 / (69 * Math.cos((campground.latitude * Math.PI) / 180));

    const places = await db.place.findMany({
      where: {
        status: 'ACTIVE',
        latitude: {
          gte: campground.latitude - latDelta,
          lte: campground.latitude + latDelta,
        },
        longitude: {
          gte: campground.longitude - lngDelta,
          lte: campground.longitude + lngDelta,
        },
      },
      select: {
        id: true,
        name: true,
        category: true,
        address: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        website: true,
        description: true,
      },
    });

    // Sort by actual distance and limit to 10
    const sorted = places
      .map((p: any) => ({
        ...p,
        distance: distanceMiles(
          campground.latitude,
          campground.longitude,
          p.latitude,
          p.longitude,
        ),
      }))
      .filter((p: any) => p.distance <= 25)
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, 10);

    res.json(sorted);
  } catch (error: any) {
    console.error('Place suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// ──────────────────────────────────────────────
// POST / — Create a new Place (auth required)
// ──────────────────────────────────────────────
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      name,
      category,
      address,
      city,
      state,
      latitude,
      longitude,
      website,
      description,
      googlePlaceId,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'name and category are required' });
    }

    const place = await db.place.create({
      data: {
        name,
        category,
        address,
        city,
        state,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        website,
        description,
        googlePlaceId,
        createdByUserId: userId,
        status: 'ACTIVE',
      },
    });

    res.status(201).json(place);
  } catch (error: any) {
    console.error('Create place error:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('googlePlaceId')) {
      return res.status(409).json({ error: 'A place with this Google Place ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create place' });
  }
});

// ──────────────────────────────────────────────
// GET /:id — Single place with recent community posts
// ──────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const place = await db.place.findUnique({
      where: { id },
    });

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    // Fetch recent community posts for this place
    let recentPosts: any[] = [];
    try {
      recentPosts = await db.rigPost.findMany({
        where: { placeId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
      });
    } catch {
      // RigPost may not have placeId field yet — gracefully skip
    }

    res.json({ ...place, recentPosts });
  } catch (error: any) {
    console.error('Get place error:', error);
    res.status(500).json({ error: 'Failed to get place' });
  }
});

export default router;
