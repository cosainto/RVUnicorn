import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
const db = prisma as any;

// Geocode an address string to lat/lng using Nominatim (OpenStreetMap)
async function geocodeAddress(parts: { address?: string; city?: string; state?: string; zip?: string }): Promise<{ lat: number; lng: number } | null> {
  const query = [parts.address, parts.city, parts.state, parts.zip].filter(Boolean).join(', ') + ', USA';
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'RVUnicorn/1.0' } });
    const data: any = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (e: any) { console.error('[Place] geocode error:', e.message); }
  return null;
}

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

// Helper: fetch og:image or first real image from a place's website, store URL
async function fetchWebsiteImage(placeId: string) {
  try {
    const place = await db.place.findUnique({ where: { id: placeId }, select: { website: true } });
    if (!place?.website) return;

    const response = await fetch(place.website, {
      headers: { 'User-Agent': 'RVUnicorn/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    const html = await response.text();

    // Try og:image first
    const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogMatch?.[1]) {
      await db.place.update({ where: { id: placeId }, data: { websiteImageUrl: ogMatch[1] } });
      return;
    }

    // Fallback: first <img> that looks like a real image (skip tiny icons)
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      const tag = match[0];
      const src = match[1];
      // Skip data URIs and tiny images
      if (src.startsWith('data:')) continue;
      const widthMatch = tag.match(/width="(\d+)"/i);
      const heightMatch = tag.match(/height="(\d+)"/i);
      if (widthMatch && parseInt(widthMatch[1]) < 100) continue;
      if (heightMatch && parseInt(heightMatch[1]) < 100) continue;
      // Skip common icon patterns
      if (/favicon|icon|logo|sprite|pixel|tracking/i.test(src)) continue;

      // Resolve relative URLs
      let imageUrl = src;
      if (src.startsWith('//')) {
        imageUrl = 'https:' + src;
      } else if (src.startsWith('/')) {
        const urlObj = new URL(place.website);
        imageUrl = urlObj.origin + src;
      }

      await db.place.update({ where: { id: placeId }, data: { websiteImageUrl: imageUrl } });
      return;
    }
  } catch (e: any) {
    // Silent failure — website image is best-effort
  }
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
// GET /nearby?lat=...&lng=...&radius=...
// Places and campgrounds within a radius of a location
// ──────────────────────────────────────────────
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 25;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    // Bounding box filter (1 degree lat ~ 69 miles)
    const latDelta = radius / 69;
    const lngDelta = radius / (69 * Math.cos((lat * Math.PI) / 180));

    // Try to extract userId from auth token if present (optional auth)
    let userId: string | undefined;
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
        userId = decoded.userId;
      }
    } catch { /* no valid auth — that's fine */ }

    // Fetch places in bounding box (gte/lte implicitly excludes nulls)
    const places = await db.place.findMany({
      where: {
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
    });

    // Filter: active places visible to all, private only to creator
    const filteredPlaces = places.filter((p: any) => {
      if (p.status === 'ACTIVE') return true;
      if (userId && p.createdByUserId === userId) return true;
      return false;
    });

    // Fetch campgrounds in same bounding box
    const campgrounds = await db.campground.findMany({
      where: {
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        imageUrl: true,
      },
    });

    // Compute distances, filter by radius, merge, sort
    const placeResults = filteredPlaces
      .map((p: any) => ({
        ...p,
        type: 'place',
        distance: distanceMiles(lat, lng, p.latitude, p.longitude),
      }))
      .filter((p: any) => p.distance <= radius);

    const campgroundResults = campgrounds
      .map((c: any) => ({
        ...c,
        type: 'campground',
        distance: distanceMiles(lat, lng, c.latitude, c.longitude),
      }))
      .filter((c: any) => c.distance <= radius);

    const results = [...placeResults, ...campgroundResults]
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, 30);

    res.json(results);
  } catch (error: any) {
    console.error('Nearby places error:', error);
    res.status(500).json({ error: 'Failed to get nearby places' });
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
      zip,
      latitude,
      longitude,
      website,
      description,
      googlePlaceId,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'name and category are required' });
    }

    // Geocode if lat/lng missing but we have address info
    let lat = latitude ? parseFloat(latitude) : undefined;
    let lng = longitude ? parseFloat(longitude) : undefined;
    if (!lat && !lng && (address || city || state || zip)) {
      const coords = await geocodeAddress({ address, city, state, zip });
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }

    const place = await db.place.create({
      data: {
        name,
        category,
        address,
        city,
        state,
        zip,
        latitude: lat,
        longitude: lng,
        website,
        description,
        googlePlaceId,
        createdByUserId: userId,
        status: 'ACTIVE',
      },
    });

    // Fire-and-forget: fetch website image in background
    if (website) {
      fetchWebsiteImage(place.id).catch(() => {});
    }

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
// POST /backfill-images — Backfill websiteImageUrl for places with websites
// Must be BEFORE /:id to avoid matching as an id param
// ──────────────────────────────────────────────
router.post('/backfill-images', authenticateToken, async (req: Request, res: Response) => {
  try {
    const places = await db.place.findMany({ where: { website: { not: null }, websiteImageUrl: null } });
    let updated = 0;
    for (const p of places) {
      await fetchWebsiteImage(p.id).catch(() => {});
      updated++;
    }
    res.json({ processed: updated });
  } catch (error: any) {
    console.error('Backfill images error:', error);
    res.status(500).json({ error: 'Failed to backfill images' });
  }
});

// ──────────────────────────────────────────────
// GET /review-prompt — Check if user should see a review prompt
// Must be BEFORE /:id to avoid matching as an id param
// ──────────────────────────────────────────────
router.get('/review-prompt', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    // Find check-ins >= 3 hours old with no review and no dismissal
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const checkin = await db.checkIn.findFirst({
      where: {
        userId,
        isActive: true,
        checkInDate: { lte: threeHoursAgo },
        reviewPromptDismissedAt: null,
        campgroundId: { not: null },
      },
      include: { campground: { select: { id: true, name: true, imageUrl: true } } },
      orderBy: { checkInDate: 'desc' },
    });

    if (!checkin || !checkin.campground) return res.json({ prompt: null });

    // Check if user already reviewed this campground
    const existingReview = await db.campgroundReview.findFirst({
      where: { campgroundId: checkin.campgroundId, userId },
    });
    if (existingReview) return res.json({ prompt: null });

    res.json({
      prompt: {
        checkInId: checkin.id,
        campgroundId: checkin.campgroundId,
        campgroundName: checkin.campground.name,
        campgroundImage: checkin.campground.imageUrl,
        checkInDate: checkin.checkInDate,
      },
    });
  } catch (error: any) {
    console.error('Review prompt error:', error);
    res.status(500).json({ error: 'Failed to check review prompt' });
  }
});

// ──────────────────────────────────────────────
// POST /review-prompt/:checkInId/dismiss
// Must be BEFORE /:id to avoid matching as an id param
// ──────────────────────────────────────────────
router.post('/review-prompt/:checkInId/dismiss', authenticateToken, async (req: Request, res: Response) => {
  try {
    await db.checkIn.update({
      where: { id: req.params.checkInId },
      data: { reviewPromptDismissedAt: new Date() },
    });
    res.json({ dismissed: true });
  } catch (error: any) {
    console.error('Dismiss review prompt error:', error);
    res.status(500).json({ error: 'Failed to dismiss review prompt' });
  }
});

// ──────────────────────────────────────────────
// GET /:id — Single place with reviews, photos, and recent community posts
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

    // Fetch reviews for this place
    let reviews: any[] = [];
    try {
      reviews = await db.campgroundReview.findMany({
        where: { placeId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
              username: true,
            },
          },
        },
      });
    } catch {
      // CampgroundReview may not have placeId field yet — gracefully skip
    }

    // Fetch photos for this place
    let photos: any[] = [];
    try {
      photos = await db.photo.findMany({
        where: { placeId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              profilePicture: true,
            },
          },
        },
      });
    } catch {
      // Photo may not have placeId field yet — gracefully skip
    }

    // Compute average rating from reviews
    let averageRating: number | null = null;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
      averageRating = Math.round((sum / reviews.length) * 10) / 10;
    }

    res.json({ ...place, reviews, photos, averageRating, recentPosts });
  } catch (error: any) {
    console.error('Get place error:', error);
    res.status(500).json({ error: 'Failed to get place' });
  }
});

// ──────────────────────────────────────────────
// POST /:id/reviews — Create/update a review for a place (auth required)
// ──────────────────────────────────────────────
router.post('/:id/reviews', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { rating, title, review, visitDate } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating 1-5 required' });
    }

    const place = await db.place.findUnique({ where: { id } });
    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    // Upsert: one review per user per place
    const result = await db.campgroundReview.upsert({
      where: { placeId_userId: { placeId: id, userId } },
      create: { placeId: id, userId, rating, title, review, visitDate: visitDate ? new Date(visitDate) : null },
      update: { rating, title, review, visitDate: visitDate ? new Date(visitDate) : null },
      include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
    });

    res.json(result);
  } catch (error: any) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// ──────────────────────────────────────────────
// POST /wishlist — Add a place to wishlist
// ──────────────────────────────────────────────
router.post('/wishlist', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { placeId, name } = req.body;
    if (!placeId) return res.status(400).json({ error: 'placeId required' });

    const item = await db.placeWishlist.upsert({
      where: { userId_placeId: { userId, placeId } },
      create: { userId, placeId, name: name || '' },
      update: {},
    });
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// DELETE /wishlist/:placeId — Remove from wishlist
router.delete('/wishlist/:placeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    await db.placeWishlist.deleteMany({ where: { userId, placeId: req.params.placeId } });
    res.json({ removed: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

export default router;
