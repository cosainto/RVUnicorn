import { Router, Request, Response } from 'express';
import { PrismaClient, ThingType, ThingStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// Auth middleware
const authenticateToken = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };
    (req as any).userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Optional auth
const optionalAuth = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };
      (req as any).userId = decoded.userId;
    } catch {}
  }
  next();
};

// Google Places helpers
interface PlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{ photo_reference: string }>;
  opening_hours?: { open_now?: boolean };
  price_level?: number;
}

const placesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60;

async function searchGooglePlaces(lat: number, lng: number, radius: number = 48280, type?: string): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) { console.warn('GOOGLE_PLACES_API_KEY not set'); return []; }

  const cacheKey = `places:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}:${type || 'all'}`;
  const cached = placesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', radius.toString());
    url.searchParams.set('key', apiKey);
    if (type) url.searchParams.set('type', type);

    const response = await fetch(url.toString());
    const data = await response.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') { console.error('Google Places API error:', data.status); return []; }
    placesCache.set(cacheKey, { data: data.results, timestamp: Date.now() });
    return data.results;
  } catch (error) { console.error('Google Places fetch error:', error); return []; }
}

function getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
}

function mapPlaceTypeToThingType(types: string[]): ThingType {
  if (types.some(t => ['hiking_area', 'natural_feature', 'park'].includes(t))) return 'TRAIL';
  if (types.some(t => ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway', 'food'].includes(t))) return 'FOOD';
  if (types.some(t => ['tourist_attraction', 'museum', 'zoo', 'aquarium', 'amusement_park'].includes(t))) return 'ATTRACTION';
  if (types.some(t => ['travel_agency', 'rv_park', 'campground'].includes(t))) return 'TOUR';
  return 'OTHER';
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// GET recommendations from Google Places
router.get('/campgrounds/:id/recommendations', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id: campgroundId } = req.params;
    const { radius = '30' } = req.query;
    const userId = (req as any).userId;

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, name: true, latitude: true, longitude: true }
    });

    if (!campground || !campground.latitude || !campground.longitude) {
      return res.status(404).json({ error: 'Campground not found or missing coordinates' });
    }

    const radiusMiles = parseInt(radius as string) || 30;
    const radiusMeters = radiusMiles * 1609.34;
    const searchTypes = ['tourist_attraction', 'park', 'restaurant', 'museum', 'natural_feature'];
    const allResults: PlaceResult[] = [];

    for (const type of searchTypes) {
      const results = await searchGooglePlaces(campground.latitude, campground.longitude, radiusMeters, type);
      allResults.push(...results);
    }

    const uniquePlaces = Array.from(new Map(allResults.map(p => [p.place_id, p])).values());
    const existingThings = await prisma.thingToDo.findMany({
      where: { placeId: { in: uniquePlaces.map(p => p.place_id) } },
      select: { placeId: true, id: true }
    });
    const existingMap = new Map(existingThings.map(t => [t.placeId, t.id]));

    let userSaves = new Set<string>();
    if (userId) {
      const saves = await prisma.thingToDoSave.findMany({ where: { userId }, select: { thingToDoId: true } });
      userSaves = new Set(saves.map(s => s.thingToDoId));
    }

    const recommendations = uniquePlaces.map(place => {
      const distance = calculateDistance(campground.latitude!, campground.longitude!, place.geometry.location.lat, place.geometry.location.lng);
      const existingId = existingMap.get(place.place_id);
      return {
        placeId: place.place_id,
        sourceUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        sourceName: 'Google Places',
        title: place.name,
        address: place.vicinity || place.formatted_address,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        distance: Math.round(distance * 10) / 10,
        type: mapPlaceTypeToThingType(place.types),
        googleTypes: place.types,
        rating: place.rating,
        reviewCount: place.user_ratings_total,
        priceLevel: place.price_level,
        isOpen: place.opening_hours?.open_now,
        imageUrl: place.photos?.[0]?.photo_reference ? getPhotoUrl(place.photos[0].photo_reference) : null,
        existingId,
        isSaved: existingId ? userSaves.has(existingId) : false
      };
    });

    recommendations.sort((a, b) => {
      const scoreA = (a.rating || 0) * Math.log10((a.reviewCount || 1) + 1);
      const scoreB = (b.rating || 0) * Math.log10((b.reviewCount || 1) + 1);
      return scoreB - scoreA;
    });

    res.json({ campground: { id: campground.id, name: campground.name, lat: campground.latitude, lng: campground.longitude }, recommendations: recommendations.slice(0, 20), total: recommendations.length });
  } catch (error) { console.error('Get recommendations error:', error); res.status(500).json({ error: 'Failed to get recommendations' }); }
});

// POST save a thing
router.post('/save', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, placeId, sourceUrl, sourceName = 'Google Places', title, description, type = 'OTHER', lat, lng, address, imageUrl, tags = [], note, startAt, endAt } = req.body;

    if (!sourceUrl || !title) return res.status(400).json({ error: 'sourceUrl and title are required' });

    let thingToDo = await prisma.thingToDo.findUnique({ where: { sourceUrl } });

    if (!thingToDo) {
      thingToDo = await prisma.thingToDo.create({
        data: { type: type as ThingType, title, description, lat, lng, address, sourceUrl, sourceName, placeId, imageUrl, tags, startAt: startAt ? new Date(startAt) : null, endAt: endAt ? new Date(endAt) : null, createdByUserId: userId, status: 'ACTIVE' }
      });
    }

    if (campgroundId) {
      const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { latitude: true, longitude: true } });
      if (campground?.latitude && campground?.longitude && lat && lng) {
        const distance = calculateDistance(campground.latitude, campground.longitude, lat, lng);
        await prisma.campgroundThingToDo.upsert({
          where: { campgroundId_thingToDoId: { campgroundId, thingToDoId: thingToDo.id } },
          create: { campgroundId, thingToDoId: thingToDo.id, distanceMiles: distance },
          update: { distanceMiles: distance }
        });
      }
    }

    const save = await prisma.thingToDoSave.upsert({
      where: { userId_thingToDoId: { userId, thingToDoId: thingToDo.id } },
      create: { userId, thingToDoId: thingToDo.id, note },
      update: { note }
    });

    res.json({ thingToDo, save, message: 'Saved successfully!' });
  } catch (error) { console.error('Save thing error:', error); res.status(500).json({ error: 'Failed to save' }); }
});

// GET saved things for a campground
router.get('/campgrounds/:id/things-to-do', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id: campgroundId } = req.params;
    const { type, limit = '20', sortBy = 'relevance' } = req.query;
    const userId = (req as any).userId;

    const where: any = { campgroundId, thingToDo: { status: 'ACTIVE' } };
    if (type) where.thingToDo.type = type;

    const items = await prisma.campgroundThingToDo.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: sortBy === 'distance' ? { distanceMiles: 'asc' } : sortBy === 'newest' ? { createdAt: 'desc' } : { relevanceScore: 'desc' },
      include: { thingToDo: { include: { createdBy: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } }, _count: { select: { saves: true, votes: true } } } } }
    });

    let userSaves = new Set<string>();
    if (userId) {
      const saves = await prisma.thingToDoSave.findMany({ where: { userId, thingToDoId: { in: items.map(i => i.thingToDoId) } }, select: { thingToDoId: true } });
      userSaves = new Set(saves.map(s => s.thingToDoId));
    }

    const response = items.map(item => ({
      id: item.thingToDo.id, type: item.thingToDo.type, title: item.thingToDo.title, description: item.thingToDo.description,
      lat: item.thingToDo.lat, lng: item.thingToDo.lng, address: item.thingToDo.address, sourceUrl: item.thingToDo.sourceUrl,
      sourceName: item.thingToDo.sourceName, imageUrl: item.thingToDo.imageUrl, tags: item.thingToDo.tags,
      startAt: item.thingToDo.startAt, endAt: item.thingToDo.endAt, priceMin: item.thingToDo.priceMin, priceMax: item.thingToDo.priceMax,
      distanceMiles: item.distanceMiles, relevanceScore: item.relevanceScore, pinned: item.pinned,
      saveCount: item.thingToDo._count.saves, addedBy: item.thingToDo.createdBy, isSaved: userSaves.has(item.thingToDoId)
    }));

    res.json(response);
  } catch (error) { console.error('Get things error:', error); res.status(500).json({ error: 'Failed to get things to do' }); }
});

// GET user's saved things
router.get('/my-saves', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, limit = '50' } = req.query;
    const where: any = { userId };
    if (type) where.thingToDo = { type };

    const saves = await prisma.thingToDoSave.findMany({
      where, take: parseInt(limit as string), orderBy: { createdAt: 'desc' },
      include: { thingToDo: { include: { campgrounds: { include: { campground: { select: { id: true, name: true, state: true } } }, take: 3 } } } }
    });

    res.json(saves.map(s => ({
      id: s.id, note: s.note, savedAt: s.createdAt,
      thing: { id: s.thingToDo.id, type: s.thingToDo.type, title: s.thingToDo.title, description: s.thingToDo.description,
        address: s.thingToDo.address, sourceUrl: s.thingToDo.sourceUrl, imageUrl: s.thingToDo.imageUrl, tags: s.thingToDo.tags,
        startAt: s.thingToDo.startAt, endAt: s.thingToDo.endAt,
        nearbyCampgrounds: s.thingToDo.campgrounds.map(c => ({ id: c.campground.id, name: c.campground.name, state: c.campground.state, distance: c.distanceMiles }))
      }
    })));
  } catch (error) { console.error('Get my saves error:', error); res.status(500).json({ error: 'Failed to get saves' }); }
});

// DELETE unsave
router.delete('/save/:thingId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { thingId } = req.params;
    await prisma.thingToDoSave.delete({ where: { userId_thingToDoId: { userId, thingToDoId: thingId } } });
    res.json({ message: 'Unsaved successfully' });
  } catch (error) { console.error('Delete save error:', error); res.status(500).json({ error: 'Failed to unsave' }); }
});

// POST vote
router.post('/:id/vote', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { value } = req.body;
    if (value !== 1 && value !== -1) return res.status(400).json({ error: 'Value must be 1 or -1' });

    await prisma.thingToDoVote.upsert({
      where: { userId_thingToDoId: { userId, thingToDoId: id } },
      create: { userId, thingToDoId: id, value },
      update: { value }
    });

    const votes = await prisma.thingToDoVote.aggregate({ where: { thingToDoId: id }, _sum: { value: true } });
    const newScore = Math.max(0, Math.min(100, 50 + (votes._sum.value || 0) * 5));
    await prisma.thingToDo.update({ where: { id }, data: { qualityScore: newScore } });

    res.json({ newScore });
  } catch (error) { console.error('Vote error:', error); res.status(500).json({ error: 'Failed to vote' }); }
});

export default router;
