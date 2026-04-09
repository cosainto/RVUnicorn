import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { FRONTEND_URL } from '../utils/frontendUrl';

const router = Router();
const prisma = new PrismaClient();

// GET /api/itinerary - Get all trips for current user (optionally filtered by eventId)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.query;
    const trips = await prisma.trip.findMany({
      where: { userId, ...(eventId ? { eventId: eventId as string } : {}) },
      include: {
        days: {
          include: { stops: { include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true } } }, orderBy: { order: 'asc' } } },
          orderBy: { dayNumber: 'asc' }
        }
      },
      orderBy: { startDate: 'asc' }
    });
    res.json(trips);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// GET /api/itinerary/recommendations?lat=&lng=&type=&mealPref=
router.get('/recommendations', authenticateToken, async (req: any, res) => {
  try {
    const { lat, lng, type, mealPref, fuelType } = req.query;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
    const radiusM = 16093; // 10 miles

    // Haversine helper
    const dist = (lat2: number, lng2: number) => {
      const R = 3959;
      const dLat = (lat2 - latitude) * Math.PI / 180;
      const dLng = (lng2 - longitude) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(latitude*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 10) / 10;
    };

    if (type === 'FUEL' || type === 'OVERNIGHT' || type === 'WALMART') {
      // Query our own FreeOvernightSpot DB
      const categories = type === 'FUEL'
        ? ['fuel'] 
        : type === 'WALMART'
        ? ['retail']
        : ['retail', 'parking', 'rv_dealer'];

      const chains = type === 'FUEL'
        ? ['Pilot', "Love's", 'Flying J', 'TA Travel Center', 'Petro', 'Kwik Trip', 'Sheetz', 'Wawa', 'Casey\'s', 'Maverik', 'Sapp Bros']
        : type === 'WALMART'
        ? ['Walmart']
        : ['Walmart', 'Cracker Barrel', 'Camping World', 'Costco', "Sam's Club", 'Cabela\'s', "Bass Pro", 'Home Depot', 'Lowe\'s'];

      const spots = await prisma.freeOvernightSpot.findMany({
        where: {
          chain: { in: chains },
          latitude: { gte: latitude - 0.5, lte: latitude + 0.5 },
          longitude: { gte: longitude - 0.5, lte: longitude + 0.5 },
        },
        select: { id: true, name: true, chain: true, address: true, city: true, state: true, latitude: true, longitude: true, rating: true, hasFuel: true, hasFood: true, hasDump: true, hasWater: true },
        take: 50,
      });

      const nearby = spots
        .map(s => ({ ...s, distanceMiles: dist(s.latitude, s.longitude) }))
        .filter(s => s.distanceMiles <= 10)
        .sort((a, b) => a.distanceMiles - b.distanceMiles)
        .slice(0, 5);

      // Fetch gas prices from GasBuddy-style API
      let regularPrice: number | null = null;
      let dieselPrice: number | null = null;
      try {
        const priceRes = await fetch(`https://www.fueleconomy.gov/ws/rest/fuelprices`, { headers: { Accept: 'application/json' } });
        if (priceRes.ok) {
          const priceData = await priceRes.json() as any;
          regularPrice = parseFloat(priceData.regular) || null;
          dieselPrice = parseFloat(priceData.diesel) || null;
        }
      } catch(e) {}

      const fuelResults = nearby.map(s => ({
          id: s.id,
          name: `${s.chain}${s.city ? ' - ' + s.city + (s.state ? ', ' + s.state : '') : ''}`,
          address: s.address,
          latitude: s.latitude,
          longitude: s.longitude,
          distanceMiles: s.distanceMiles,
          rating: s.rating,
          gasPrice: fuelType === 'diesel' ? dieselPrice : regularPrice,
          fuelType: fuelType || 'gas',
          tags: [
            s.hasFuel && '⛽ Fuel',
            s.hasFood && '🍔 Food',
            s.hasDump && '🚰 Dump',
            s.hasWater && '💧 Water',
          ].filter(Boolean),
          source: 'rvunicorn',
        }));

      // If our DB has results, return them
      if (fuelResults.length > 0) return res.json(fuelResults);

      // Fallback: Google Places for gas stations
      try {
        const keyword = type === 'WALMART' ? 'walmart' : 'gas station truck stop fuel';
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radiusM}&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_KEY}`;
        const response = await fetch(url);
        const gData = await response.json() as any;
        const googleResults = (gData.results || []).slice(0, 5).map((p: any) => ({
          id: p.place_id,
          name: p.name,
          address: p.vicinity,
          latitude: p.geometry.location.lat,
          longitude: p.geometry.location.lng,
          distanceMiles: dist(p.geometry.location.lat, p.geometry.location.lng),
          rating: p.rating,
          isOpen: p.opening_hours?.open_now,
          tags: ['⛽ Fuel', p.opening_hours?.open_now ? '🟢 Open now' : ''].filter(Boolean),
          source: 'google',
        }));
        return res.json(googleResults);
      } catch(e) { return res.json([]); }
    }

    if (type === 'FOOD') {
      const keyword = mealPref === 'fast'
        ? 'fast food restaurant'
        : mealPref === 'sitdown'
        ? 'diner restaurant family'
        : 'restaurant';

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radiusM}&type=restaurant&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_KEY}`;
      const response = await fetch(url);
      const data = await response.json() as any;

      const results = (data.results || []).slice(0, 5).map((p: any) => ({
        id: p.place_id,
        name: p.name,
        address: p.vicinity,
        latitude: p.geometry.location.lat,
        longitude: p.geometry.location.lng,
        distanceMiles: dist(p.geometry.location.lat, p.geometry.location.lng),
        rating: p.rating,
        priceLevel: p.price_level,
        isOpen: p.opening_hours?.open_now,
        openingHours: p.opening_hours?.weekday_text || null,
        tags: [
          p.price_level <= 1 && '💲 Budget',
          p.price_level === 2 && '💲💲 Moderate',
          p.price_level >= 3 && '💲💲💲 Upscale',
          p.opening_hours?.open_now && '🟢 Open now',
        ].filter(Boolean),
        source: 'google',
      }));

      return res.json(results);
    }

    if (type === 'ATTRACTION') {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radiusM}&type=tourist_attraction&key=${GOOGLE_KEY}`;
      const response = await fetch(url);
      const data = await response.json() as any;

      const results = (data.results || []).slice(0, 5).map((p: any) => ({
        id: p.place_id,
        name: p.name,
        address: p.vicinity,
        latitude: p.geometry.location.lat,
        longitude: p.geometry.location.lng,
        distanceMiles: dist(p.geometry.location.lat, p.geometry.location.lng),
        rating: p.rating,
        isOpen: p.opening_hours?.open_now,
        openingHours: p.opening_hours?.weekday_text || null,
        tags: [
          p.opening_hours?.open_now && '🟢 Open now',
          ...(p.types?.slice(0,2).map((t: string) => t.replace(/_/g,' ')) || [])
        ].filter(Boolean),
        source: 'google',
      }));

      return res.json(results);
    }

    res.json([]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// GET /api/itinerary/:id - Get single trip
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.id, userId },
      include: {
        days: {
          include: { stops: { include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true } } }, orderBy: { order: 'asc' } } },
          orderBy: { dayNumber: 'asc' }
        }
      }
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

// POST /api/itinerary - Create trip
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, startDate, endDate, status, visibility } = req.body;
    const trip = await prisma.trip.create({
      data: { userId, title, description, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, status: status || 'PLANNING', visibility: visibility || 'PRIVATE' },
      include: { days: true }
    });
    res.json(trip);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// PUT /api/itinerary/:id - Update trip
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, startDate, endDate, status, visibility, coverImage } = req.body;
    const trip = await prisma.trip.updateMany({
      where: { id: req.params.id, userId },
      data: { title, description, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, status, visibility, coverImage }
    });
    res.json(trip);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

// DELETE /api/itinerary/:id - Delete trip
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    await prisma.trip.deleteMany({ where: { id: req.params.id, userId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// POST /api/itinerary/:id/days - Add a day
router.post('/:id/days', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { date, dayNumber, type, notes } = req.body;
    const day = await prisma.tripDay.create({
      data: { tripId: req.params.id, date: date ? new Date(date) : null, dayNumber, type: type || 'TRAVEL', notes },
      include: { stops: true }
    });
    res.json(day);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add day' });
  }
});

// PUT /api/itinerary/:id/days/:dayId - Update a day
router.put('/:id/days/:dayId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { date, dayNumber, type, notes } = req.body;
    const day = await prisma.tripDay.update({
      where: { id: req.params.dayId },
      data: { date: date ? new Date(date) : null, dayNumber, type, notes },
      include: { stops: { orderBy: { order: 'asc' } } }
    });
    res.json(day);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update day' });
  }
});

// DELETE /api/itinerary/:id/days/:dayId - Delete a day
router.delete('/:id/days/:dayId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    await prisma.tripDay.delete({ where: { id: req.params.dayId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete day' });
  }
});

// POST /api/itinerary/:id/days/:dayId/stops - Add a stop
router.post('/:id/days/:dayId/stops', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { order, type, campgroundId, customName, address, latitude, longitude, notes, siteNumber, durationMins, cost, confirmed } = req.body;
    const stop = await prisma.tripStop.create({
      data: { tripDayId: req.params.dayId, order: order || 0, type, campgroundId, customName, address, latitude, longitude, notes, siteNumber, durationMins, cost, confirmed: confirmed || false },
      include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true } } }
    });
    res.json(stop);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add stop' });
  }
});

// PUT /api/itinerary/:id/days/:dayId/stops/:stopId - Update a stop
router.put('/:id/days/:dayId/stops/:stopId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const { order, type, campgroundId, customName, address, latitude, longitude, notes, siteNumber, durationMins, cost, confirmed } = req.body;
    const stop = await prisma.tripStop.update({
      where: { id: req.params.stopId },
      data: { order, type, campgroundId, customName, address, latitude, longitude, notes, siteNumber, durationMins, cost, confirmed },
      include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true } } }
    });
    res.json(stop);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update stop' });
  }
});

// DELETE /api/itinerary/:id/days/:dayId/stops/:stopId - Delete a stop
router.delete('/:id/days/:dayId/stops/:stopId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, userId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    await prisma.tripStop.delete({ where: { id: req.params.stopId } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete stop' });
  }
});

// POST /api/itinerary/:id/activate - Set trip as active (on the road)
router.post('/:id/activate', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    // Deactivate any other active trips first
    await prisma.trip.updateMany({ where: { userId, status: 'IN_PROGRESS' }, data: { status: 'PLANNING' } });
    const trip = await prisma.trip.update({
      where: { id: req.params.id, userId },
      data: { status: 'IN_PROGRESS' }
    });
    res.json(trip);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/itinerary/:id/complete - Mark trip complete
router.post('/:id/complete', authenticateToken, async (req: any, res) => {
  try {
    const trip = await prisma.trip.update({
      where: { id: req.params.id, userId: req.userId },
      data: { status: 'COMPLETED' }
    });
    res.json(trip);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/itinerary/:id/days/:dayId/stops/:stopId/skip - Skip a stop and optionally get replacement
router.post('/:id/days/:dayId/stops/:stopId/skip', authenticateToken, async (req: any, res) => {
  try {
    const { reason } = req.body;
    await prisma.tripStop.update({
      where: { id: req.params.stopId },
      data: { notes: reason ? `SKIPPED: ${reason}` : 'SKIPPED', confirmed: false }
    });
    // Mark with a skipped flag via type prefix workaround
    const stop = await prisma.tripStop.findUnique({ where: { id: req.params.stopId } });
    res.json({ ...stop, skipped: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

// POST /api/itinerary/:id/members - Invite a travel companion by username
router.post('/:id/members', authenticateToken, async (req: any, res) => {
  try {
    const { username, role } = req.body;
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id, userId: req.userId } });
    if (!trip) return res.status(403).json({ error: 'Not your trip' });
    const invitee = await prisma.user.findFirst({ where: { username } });
    if (!invitee) return res.status(404).json({ error: 'User not found' });
    const member = await prisma.tripMember.upsert({
      where: { tripId_userId: { tripId: req.params.id, userId: invitee.id } },
      update: { role: role || 'VIEWER' },
      create: { tripId: req.params.id, userId: invitee.id, role: role || 'VIEWER' },
      include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profileImage: true } } }
    });
    res.json(member);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/itinerary/:id/members/:userId - Remove a companion
router.delete('/:id/members/:userId', authenticateToken, async (req: any, res) => {
  try {
    await prisma.tripMember.deleteMany({ where: { tripId: req.params.id, userId: req.params.userId } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/itinerary/:id/share - Generate share token
router.post('/:id/share', authenticateToken, async (req: any, res) => {
  try {
    const { crypto } = await import('node:crypto');
    const token = crypto.randomBytes(16).toString('hex');
    const trip = await prisma.trip.update({
      where: { id: req.params.id, userId: req.userId },
      data: { shareToken: token, visibility: 'SHARED' }
    });
    res.json({ shareToken: trip.shareToken, url: `${FRONTEND_URL}/trip/shared/${trip.shareToken}` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/itinerary/:id/share - Revoke share token
router.delete('/:id/share', authenticateToken, async (req: any, res) => {
  try {
    await prisma.trip.update({
      where: { id: req.params.id, userId: req.userId },
      data: { shareToken: null, visibility: 'PRIVATE' }
    });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/itinerary/shared/:token - Public view of shared trip
router.get('/shared/:token', async (req, res) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { shareToken: req.params.token },
      include: {
        user: { select: { username: true, firstName: true, lastName: true, profileImage: true } },
        days: { include: { stops: { include: { campground: { select: { id: true, name: true, location: true, state: true, latitude: true, longitude: true } } }, orderBy: { order: 'asc' } } }, orderBy: { dayNumber: 'asc' } },
        members: { include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profileImage: true } } } }
      }
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found or no longer shared' });
    res.json(trip);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
