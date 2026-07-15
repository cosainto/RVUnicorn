import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HERE_API_KEY = process.env.HERE_API_KEY || '15BglBtc7-1HzjsdvTvzscQGOYwrpZPvJWZRqkyOrLE';
const REALISTIC_DAILY_MILES = 400; // Max comfortable RV driving per day
const CHECKIN_HOUR = 15; // 3 PM typical campground check-in

const router = Router();
import { prisma } from '../lib/prisma';

// In-memory drive time cache — keyed by "lat,lng->lat,lng"
// Survives for the lifetime of the backend process (cleared on restart)
const driveTimeCache = new Map<string, any>();

async function getDriveTime(originLat: number, originLng: number, destLat: number, destLng: number, departureDate?: string, arrivalDate?: string) {
  const cacheKey = `${Number(originLat).toFixed(4)},${Number(originLng).toFixed(4)}->${Number(destLat).toFixed(4)},${Number(destLng).toFixed(4)}`;
  if (driveTimeCache.has(cacheKey)) return driveTimeCache.get(cacheKey);

  const params = new URLSearchParams({
    apiKey: HERE_API_KEY,
    origin: `${Number(originLat)},${Number(originLng)}`,
    destination: `${Number(destLat)},${Number(destLng)}`,
    transportMode: 'car',
    return: 'summary',
  });

  const response = await axios.get(`https://router.hereapi.com/v8/routes?${params}`);
  const route = response.data.routes?.[0];
  if (!route) return null;

  const section = route.sections[0];
  const distanceMeters = section.summary.length;
  const durationSeconds = section.summary.duration;
  const distanceMiles = Math.round(distanceMeters / 1609.34);
  const durationHours = Math.floor(durationSeconds / 3600);
  const durationMins = Math.round((durationSeconds % 3600) / 60);
  const durationText = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;

  let conflict = null;
  let needsOvernightStop = false;
  let overnightRecommendations: any[] = [];

  if (distanceMiles > REALISTIC_DAILY_MILES) {
    needsOvernightStop = true;
    const daysNeeded = Math.ceil(distanceMiles / REALISTIC_DAILY_MILES);
    conflict = `⚠️ ${distanceMiles} miles is too far for a single travel day. Most RVers are comfortable with up to ${REALISTIC_DAILY_MILES} miles/day. This leg would take ~${daysNeeded} days.`;
    try {
      const midLat = (originLat + destLat) / 2;
      const midLng = (originLng + destLng) / 2;
      const nearby = await prisma.campground.findMany({
        where: { latitude: { gte: midLat - 2, lte: midLat + 2 }, longitude: { gte: midLng - 2, lte: midLng + 2 } },
        select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true },
        take: 3,
      });
      overnightRecommendations = nearby;
    } catch {}
  }

  const result = {
    distanceMiles,
    durationSeconds,
    durationHours,
    durationMins,
    durationText,
    distanceText: `${distanceMiles} miles`,
    conflict,
    needsOvernightStop,
    overnightRecommendations,
  };

  driveTimeCache.set(cacheKey, result);
  return result;
}

const STOP_INCLUDE = {
  campground: { select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true } },
  place: { select: { id: true, name: true, category: true, city: true, state: true, latitude: true, longitude: true, websiteImageUrl: true } },
  attendees: { select: { userId: true, status: true, user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } } },
  _count: { select: { subevents: true, meals: true, tripPackItems: true } },
};

// GET /api/road-trips — list user's road trips
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const roadTrips = await prisma.roadTrip.findMany({
      where: { userId },
      include: {
        stops: {
          orderBy: { startDate: 'asc' },
          include: STOP_INCLUDE,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(roadTrips);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch road trips', detail: e?.message });
  }
});

// GET /api/road-trips/:id — get one road trip with all stops + pre-calculated drive times
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const roadTrip = await prisma.roadTrip.findFirst({
      where: { id: req.params.id, userId },
      include: {
        stops: {
          orderBy: [{ stopNumber: 'asc' }, { startDate: 'asc' }],
          include: STOP_INCLUDE,
        },
      },
    });
    if (!roadTrip) return res.status(404).json({ error: 'Road trip not found' });

    // Pre-calculate all drive times in parallel and attach to response
    const stops = roadTrip.stops;
    const [user, rvShowcase] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { rvMpg: true, rvModel: true, rvYear: true, rvType: true, rvFuelType: true, rvPhotoUrl: true, homeCity: true, homeState: true, location: true } }),
      prisma.rVShowcase.findUnique({ where: { userId }, select: { photos: true } }).catch(() => null),
    ]);
    const rvPhoto = (user as any)?.rvPhotoUrl || (rvShowcase?.photos?.[0]) || null;

    // Fetch real fuel prices from fueleconomy.gov
    let gasolinePrice = 3.50;
    let dieselPrice = 3.90;
    try {
      const fuelRes = await axios.get('https://www.fueleconomy.gov/ws/rest/fuelprices', { headers: { Accept: 'application/json' }, timeout: 3000 });
      if (fuelRes.data?.regular) gasolinePrice = parseFloat(fuelRes.data.regular) || 3.50;
      if (fuelRes.data?.diesel) dieselPrice = parseFloat(fuelRes.data.diesel) || 3.90;
    } catch (e: any) { /* use defaults */ }

    const fuelType = (user as any)?.rvFuelType || 'gas';
    const fuelPrice = fuelType === 'diesel' ? dieselPrice : gasolinePrice;
    const mpg = user?.rvMpg || 10;
    const avgGasPrice = fuelPrice;

    const driveInfos: Record<string, any> = {};
    // Helper: resolve lat/lng for a stop (campground relation OR name lookup OR location string)
    const resolveCoords = async (stop: any): Promise<{ lat: number; lng: number } | null> => {
      // 1. Direct campground relation with coords
      if (stop.campground?.latitude && stop.campground?.longitude) {
        return { lat: Number(stop.campground.latitude), lng: Number(stop.campground.longitude) };
      }
      // 2. campgroundId exists but wasn't included — look it up
      if (stop.campgroundId) {
        const cg = await prisma.campground.findUnique({
          where: { id: stop.campgroundId },
          select: { latitude: true, longitude: true },
        });
        if (cg?.latitude && cg?.longitude) return { lat: Number(cg.latitude), lng: Number(cg.longitude) };
      }
      // 3. No campgroundId — search by stop title (handles stops created from campground name)
      if (stop.title) {
        const cg = await prisma.campground.findFirst({
          where: { name: { contains: stop.title.split(' ').slice(0, 3).join(' '), mode: 'insensitive' } },
          select: { latitude: true, longitude: true },
        });
        if (cg?.latitude && cg?.longitude) return { lat: Number(cg.latitude), lng: Number(cg.longitude) };
      }
      // 4. Try location field (e.g. "City, ST")
      if (stop.location) {
        try {
          const geoParams = new URLSearchParams({ apiKey: HERE_API_KEY, q: stop.location, limit: '1' });
          const geoRes = await axios.get(`https://geocode.search.hereapi.com/v1/geocode?${geoParams}`);
          const pos = geoRes.data?.items?.[0]?.position;
          if (pos) return { lat: pos.lat, lng: pos.lng };
        } catch {}
      }
      return null;
    };

    // Resolve user home coords for bookend legs
    const resolveHomeCoords = async (): Promise<{ lat: number; lng: number } | null> => {
      const homeStr = (user as any)?.homeCity && (user as any)?.homeState
        ? `${(user as any).homeCity}, ${(user as any).homeState}`
        : (user as any)?.location || null;
      if (!homeStr) return null;
      try {
        const geoParams = new URLSearchParams({ apiKey: HERE_API_KEY, q: homeStr, limit: '1' });
        const geoRes = await axios.get(`https://geocode.search.hereapi.com/v1/geocode?${geoParams}`);
        const pos = geoRes.data?.items?.[0]?.position;
        if (pos) return { lat: pos.lat, lng: pos.lng };
      } catch {}
      return null;
    };

    if (stops.length >= 1) {
      const addLeg = async (key: string, originCoords: any, destCoords: any, depDate?: any, arrDate?: any) => {
        if (!originCoords || !destCoords) return;
        try {
          const info = await getDriveTime(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng, depDate, arrDate);
          if (info) {
            const gallons = info.distanceMiles / mpg;
            const estimatedGasCost = Math.round(gallons * avgGasPrice * 100) / 100;
            driveInfos[key] = {
              ...info,
              estimatedGasCost,
              gasCostText: `$${estimatedGasCost.toFixed(2)} est. ${fuelType === 'diesel' ? 'diesel' : 'fuel'} (${mpg} MPG @ $${avgGasPrice.toFixed(2)}/gal)`,
            };
          }
        } catch (driveErr: any) {
        }
      };

      const [homeCoords, ...stopCoords] = await Promise.all([
        resolveHomeCoords(),
        ...stops.map((s: any) => resolveCoords(s)),
      ]);

      const legPromises: Promise<void>[] = [];

      // Home → Stop 1
      if (homeCoords && stopCoords[0]) {
        legPromises.push(addLeg('__home_to_first__', homeCoords, stopCoords[0], undefined, stops[0]?.startDate));
      }
      // Stop N-1 → Stop N
      for (let idx = 1; idx < stops.length; idx++) {
        if (stopCoords[idx - 1] && stopCoords[idx]) {
          legPromises.push(addLeg(stops[idx].id, stopCoords[idx - 1], stopCoords[idx], stops[idx - 1].endDate, stops[idx].startDate));
        }
      }
      // Last Stop → Home
      const lastIdx = stops.length - 1;
      if (homeCoords && stopCoords[lastIdx]) {
        legPromises.push(addLeg('__last_to_home__', stopCoords[lastIdx], homeCoords, stops[lastIdx]?.endDate, undefined));
      }

      await Promise.all(legPromises);
    }

    const homeStr = (user as any)?.homeCity && (user as any)?.homeState
      ? `${(user as any).homeCity}, ${(user as any).homeState}`
      : (user as any)?.location || '';

    res.json({
      ...roadTrip,
      driveInfos,
      homeLocation: homeStr,
      rvProfile: {
        rvModel: (user as any)?.rvModel || null,
        rvYear: (user as any)?.rvYear || null,
        rvType: (user as any)?.rvType || null,
        rvFuelType: (user as any)?.rvFuelType || 'gas',
        rvMpg: user?.rvMpg || null,
        rvPhotoUrl: rvPhoto,
      },
      fuelPrices: { gasoline: gasolinePrice, diesel: dieselPrice, used: fuelPrice },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch road trip' });
  }
});

// POST /api/road-trips — create a road trip
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { title, description, color, font, privacy } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const roadTrip = await prisma.roadTrip.create({
      data: { userId, title: title.trim(), description, color: color || '#f97316', font: font || 'playfair', privacy: privacy || 'PUBLIC' },
    });
    res.status(201).json(roadTrip);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create road trip' });
  }
});

// POST /api/road-trips/create-from-intelligence — create a road trip with first stop from Trip Intelligence data
router.post('/create-from-intelligence', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { startLabel, destLabel, destLat, destLon, destCampgroundId } = req.body;

    if (!destLabel) return res.status(400).json({ error: 'Destination is required' });

    const title = `${startLabel || 'Home'} → ${destLabel}`;

    // Create the road trip
    const roadTrip = await prisma.roadTrip.create({
      data: { userId, title, privacy: 'PUBLIC' },
    });

    // Create an Event as the first stop
    let campgroundId = destCampgroundId || null;

    // If we have a campgroundId, verify it exists
    if (campgroundId) {
      const cg = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { id: true } });
      if (!cg) campgroundId = null;
    }

    const event = await prisma.event.create({
      data: {
        organizerId: userId,
        title: destLabel,
        location: destLabel,
        campgroundId,
        isPublic: true,
        roadTripId: roadTrip.id,
        stopNumber: 1,
        startDate: new Date(Date.now() + 7 * 86400000), // default 1 week out
        endDate: new Date(Date.now() + 8 * 86400000),
      },
    });

    res.status(201).json({ roadTripId: roadTrip.id, eventId: event.id });
  } catch (e: any) {
    console.error('[RoadTrips] create-from-intelligence error:', e);
    res.status(500).json({ error: 'Failed to create road trip' });
  }
});

// PUT /api/road-trips/update-rv — update user's rvMpg and/or rvFuelType
router.put('/update-rv', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { rvMpg, rvFuelType, tripOnly } = req.body;
    if (tripOnly) {
      return res.json({ saved: false, rvMpg, rvFuelType });
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(rvMpg ? { rvMpg: parseFloat(rvMpg) } : {}),
        ...(rvFuelType ? { rvFuelType } : {}),
      },
      select: { rvMpg: true, rvFuelType: true },
    });
    res.json({ saved: true, ...updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/road-trips/:id — update road trip details
router.put('/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { title, description, color, font, privacy } = req.body;
    const existing = await prisma.roadTrip.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Road trip not found' });
    const updated = await prisma.roadTrip.update({
      where: { id: req.params.id },
      data: { title, description, color, font, privacy },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update road trip' });
  }
});

// DELETE /api/road-trips/:id — delete road trip (unlinks stops, doesn't delete events)
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const existing = await prisma.roadTrip.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Road trip not found' });
    // Unlink all stops first
    await prisma.event.updateMany({ where: { roadTripId: req.params.id }, data: { roadTripId: null, stopNumber: null } });
    await prisma.roadTrip.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete road trip' });
  }
});

// POST /api/road-trips/:id/stops — add an existing event as a stop
router.post('/:id/stops', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { eventId, stopNumber } = req.body;
    const roadTrip = await prisma.roadTrip.findFirst({ where: { id: req.params.id, userId } });
    if (!roadTrip) return res.status(404).json({ error: 'Road trip not found' });

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId: userId },
      include: { campground: { select: { name: true, city: true, state: true, location: true } } }
    });
    if (!event) return res.status(404).json({ error: 'Event not found or access denied' });

    // Auto-assign stop number if not provided
    let stop = stopNumber;
    if (!stop) {
      const count = await prisma.event.count({ where: { roadTripId: req.params.id } });
      stop = count + 1;
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: { roadTripId: req.params.id, stopNumber: stop },
      include: STOP_INCLUDE,
    });

    // Auto-inject TripPlan if there's a previous stop with a campground
    if (stop > 1) {
      try {
        const prevStop = await prisma.event.findFirst({
          where: { roadTripId: req.params.id, stopNumber: stop - 1 },
          include: { campground: { select: { name: true, city: true, state: true, location: true } } }
        });

        if (prevStop?.campground && event.campground) {
          const startLocation = `${prevStop.campground.name}, ${prevStop.campground.city || ''}, ${prevStop.campground.state || ''}`.replace(/,\s*,/, ',').trim();
          const endLocation = `${event.campground.name}, ${event.campground.city || ''}, ${event.campground.state || ''}`.replace(/,\s*,/, ',').trim();

          // Only create if TripPlan doesn't already exist for this event+user
          const existingPlan = await prisma.tripPlan.findFirst({ where: { eventId, userId } });
          if (!existingPlan) {
            await prisma.tripPlan.create({
              data: {
                eventId,
                userId,
                startLocation,
                endLocation,
                useHometown: false,
                isDriving: true,
                status: 'PLANNED',
                arrivalDate: event.startDate || null,
              }
            });
          }
        }
      } catch (planErr) {
      }
    }

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to add stop' });
  }
});

// DELETE /api/road-trips/:id/stops/:eventId — remove a stop from road trip
router.delete('/:id/stops/:eventId', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const roadTrip = await prisma.roadTrip.findFirst({ where: { id: req.params.id, userId } });
    if (!roadTrip) return res.status(404).json({ error: 'Road trip not found' });
    await prisma.event.update({
      where: { id: req.params.eventId },
      data: { roadTripId: null, stopNumber: null },
    });
    // Renumber remaining stops in order
    const remaining = await prisma.event.findMany({
      where: { roadTripId: req.params.id },
      orderBy: [{ stopNumber: 'asc' }, { startDate: 'asc' }],
      select: { id: true },
    });
    await Promise.all(
      remaining.map((e: any, i: number) =>
        prisma.event.update({ where: { id: e.id }, data: { stopNumber: i + 1 } })
      )
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to remove stop' });
  }
});

// PUT /api/road-trips/:id/stops/reorder — reorder stops
router.put('/:id/stops/reorder', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { stopOrder } = req.body; // [{ eventId, stopNumber }]
    const roadTrip = await prisma.roadTrip.findFirst({ where: { id: req.params.id, userId } });
    if (!roadTrip) return res.status(404).json({ error: 'Road trip not found' });
    await Promise.all(stopOrder.map(({ eventId, stopNumber }: any) =>
      prisma.event.update({ where: { id: eventId }, data: { stopNumber } })
    ));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to reorder stops' });
  }
});

// POST /api/road-trips/drive-time — calculate drive time + conflict check between two stops
router.post('/drive-time', authenticateToken, async (req: any, res) => {
  try {
    const { origin, destination, departureDate, arrivalDate } = req.body;
    if (!origin || !destination) return res.status(400).json({ error: 'origin and destination required' });

    const params = new URLSearchParams({
      apiKey: HERE_API_KEY,
      origin,
      destination,
      transportMode: 'car',
      return: 'summary',
    });

    const response = await axios.get(`https://router.hereapi.com/v8/routes?${params}`);
    const route = response.data.routes?.[0];
    if (!route) return res.status(500).json({ error: 'No route found' });

    const section = route.sections[0];
    const distanceMeters = section.summary.length;
    const durationSeconds = section.summary.duration;
    const distanceMiles = Math.round(distanceMeters / 1609.34);
    const durationHours = Math.floor(durationSeconds / 3600);
    const durationMins = Math.round((durationSeconds % 3600) / 60);
    const hrs = durationHours;
    const mins = durationMins;
    const durationText = hrs > 0 ? (hrs + 'h ' + mins + 'm') : (mins + 'm');

    // Conflict detection
    let conflict = null;
    let needsOvernightStop = false;
    let overnightRecommendations: any[] = [];

    if (distanceMiles > REALISTIC_DAILY_MILES) {
      needsOvernightStop = true;
      const daysNeeded = Math.ceil(distanceMiles / REALISTIC_DAILY_MILES);
      conflict = '⚠️ ' + distanceMiles + ' miles is too far for a single travel day. Most RVers are comfortable with up to ' + REALISTIC_DAILY_MILES + ' miles/day. This leg would take ~' + daysNeeded + ' days.';

      // Find campgrounds roughly halfway along the route for overnight stop suggestions
      try {
        const midLat = (parseFloat(origin.split(',')[0]) + parseFloat(destination.split(',')[0])) / 2;
        const midLng = (parseFloat(origin.split(',')[1]) + parseFloat(destination.split(',')[1])) / 2;
        const nearby = await prisma.campground.findMany({
          where: {
            latitude: { gte: midLat - 2, lte: midLat + 2 },
            longitude: { gte: midLng - 2, lte: midLng + 2 },
          },
          select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true },
          take: 3,
        });
        overnightRecommendations = nearby;
      } catch {}
    } else if (departureDate && arrivalDate) {
      // Check if check-in time is feasible
      const depDate = new Date(departureDate);
      const arrDate = new Date(arrivalDate);
      const daysDiff = Math.ceil((arrDate.getTime() - depDate.getTime()) / 86400000);

      if (daysDiff === 0 && durationHours >= CHECKIN_HOUR) {
        conflict = '⚠️ Departing on the same day you check in — the ' + durationText + ' drive may make it tight to arrive before check-in time (typically 3 PM).';
      }
    }

    // Gas cost estimate using user's MPG + national average price fallback
    let estimatedGasCost = null;
    let gasCostText = null;
    try {
      const user = await prisma.user.findUnique({ where: { id: (req as any).user.id }, select: { rvMpg: true } });
      const mpg = user?.rvMpg || 10; // Default RV MPG if not set
      const avgGasPrice = 3.50; // National average fallback ($/gal)
      const gallonsNeeded = distanceMiles / mpg;
      estimatedGasCost = Math.round(gallonsNeeded * avgGasPrice * 100) / 100;
      gasCostText = '$' + estimatedGasCost.toFixed(2) + ' est. fuel (' + mpg + ' MPG @ $' + avgGasPrice.toFixed(2) + '/gal)';
    } catch {}

    res.json({
      distanceMiles,
      durationSeconds,
      durationHours,
      durationMins,
      durationText,
      distanceText: distanceMiles + ' miles',
      conflict,
      needsOvernightStop,
      overnightRecommendations,
      estimatedGasCost,
      gasCostText,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Could not calculate drive time' });
  }
});

// POST /api/road-trips/:id/generate-plans -- auto-plans all legs with Hitch AI
router.post('/:id/generate-plans', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { hitchPrefs = {} } = req.body;
    const roadTrip = await prisma.roadTrip.findFirst({
      where: { id: req.params.id, userId },
      include: {
        stops: {
          orderBy: [{ stopNumber: 'asc' }, { startDate: 'asc' }],
          include: { campground: { select: { name: true, city: true, state: true, latitude: true, longitude: true, location: true } } },
        },
      },
    });
    if (!roadTrip) return res.status(404).json({ error: 'Road trip not found' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { homeCity: true, homeState: true, homeAddress: true, location: true, rvType: true },
    });

    let homeLocation = '';
    if (user?.homeCity && user?.homeState) {
      homeLocation = user.homeCity + ', ' + user.homeState;
    } else if (user?.location) {
      homeLocation = user.location;
    }

    const results: any[] = [];
    const milesPerDay = hitchPrefs.milesPerDay || 300;
    const departureTime = hitchPrefs.departureTime || '8:00 AM';
    const rvType = hitchPrefs.rvType || user?.rvType || 'Class A Motorhome';
    const mealPref = hitchPrefs.mealPref || 'balanced';
    const stopFrequency = hitchPrefs.stopFrequency || 'few';
    const avoidHighways = hitchPrefs.avoidHighways || false;

    // Sort stops by stopNumber to ensure correct leg order
    const sortedStops = [...roadTrip.stops].sort((a, b) => (a.stopNumber || 0) - (b.stopNumber || 0));
    for (let i = 0; i < sortedStops.length; i++) {
      const stop = sortedStops[i];
      const prevStop = i === 0 ? null : sortedStops[i - 1];

      const startLocation = i === 0
        ? homeLocation
        : prevStop?.campground
          ? (prevStop.campground.name + ', ' + (prevStop.campground.city || '') + ', ' + (prevStop.campground.state || ''))
          : '';

      const destination = stop.campground
        ? (stop.campground.name + ', ' + (stop.campground.city || '') + ', ' + (stop.campground.state || ''))
        : stop.location || '';

      if (!startLocation || !destination) {
        results.push({ stopId: stop.id, status: 'skipped', reason: 'Missing location' });
        continue;
      }

      // Calculate nights (days between this stop and next, or 1)
      let nights = 1;
      if (stop.startDate && stop.endDate) {
        nights = Math.max(1, Math.ceil((new Date(stop.endDate).getTime() - new Date(stop.startDate).getTime()) / 86400000));
      }

      try {
        // Step 1: Generate AI itinerary for this leg directly via Claude
        const drivingLimit = milesPerDay + ' miles per day max driving';
        const mealStyle = mealPref === 'fast' ? 'fast food / drive-thrus preferred'
          : mealPref === 'sitdown' ? 'sit-down meals preferred'
          : 'balanced mix of fast food and sit-down';
        const snackFreq = stopFrequency === 'none' ? 'no snack/rest stops'
          : stopFrequency === 'frequent' ? 'frequent stops every 1-2 hours'
          : 'a few stops roughly every 3-4 hours';

        const prompt = `You are an expert RV trip planner. Plan a realistic RV road trip itinerary.

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
1. The trip starts at: "${startLocation}" - this is the EXACT starting point, do not change it
2. The trip ends at: "${destination}" - this is the EXACT final destination, do not change it  
3. The LAST overnight stop in the LAST day MUST be at "${destination}"
4. Do NOT invent or substitute any other start or end location
5. All intermediate stops must make geographic sense between ${startLocation} and ${destination}

TRIP DETAILS:
START: ${startLocation}
FINAL DESTINATION: ${destination}
RV TYPE: ${rvType}
DRIVING LIMIT: ${drivingLimit}
DEPARTURE TIME: ${departureTime}
AVOID HIGHWAYS: ${avoidHighways ? 'yes' : 'no'}
MEAL PREFERENCE: ${mealStyle}
REST STOPS: ${snackFreq}

Return ONLY valid JSON with this structure:
{
  "title": "Trip title",
  "description": "One sentence",
  "recommendedDepartureDate": "YYYY-MM-DD or null",
  "totalMiles": 450,
  "totalDrivingDays": 2,
  "days": [
    {
      "dayNumber": 1,
      "type": "TRAVEL",
      "notes": "Drive notes with mileage",
      "stops": [
        { "type": "FUEL", "customName": "Stop name", "address": "City, ST", "notes": "Optional note", "durationMins": 20 },
        { "type": "OVERNIGHT", "customName": "Campground name", "address": "City, ST", "notes": "Overnight stop" }
      ]
    }
  ]
}
Stop types: FUEL, FOOD, OVERNIGHT, REST, ATTRACTION, WAYPOINT, WALMART`;

        const aiMsg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        });

        const aiText = aiMsg.content[0].type === 'text' ? aiMsg.content[0].text : '{}';
        const cleanText = aiText.replace(/```json|```/g, '').trim();
        const suggestion = JSON.parse(cleanText);

        // Step 2: Save TripPlan with route data
        let distanceMiles = suggestion.totalMiles || null;
        const arrivalDate = stop.startDate ? new Date(stop.startDate) : null;
        if (arrivalDate) arrivalDate.setHours(14, 0, 0, 0);

        await prisma.tripPlan.upsert({
          where: { eventId_userId: { eventId: stop.id, userId } },
          create: { eventId: stop.id, userId, startLocation, endLocation: destination, useHometown: false, isDriving: true, status: 'PLANNED', arrivalDate, distanceMiles },
          update: { startLocation, endLocation: destination, useHometown: false, arrivalDate, distanceMiles }
        });

        // Step 3: Save itinerary (Trip + TripDays)
        // Delete existing itinerary for this event if any
        const existingTrips = await prisma.trip.findMany({ where: { userId, startDate: stop.startDate ? new Date(stop.startDate) : undefined } });

        // Delete any existing trip for this event to avoid duplicates
        await prisma.trip.deleteMany({ where: { userId, eventId: stop.id } });

        const trip = await prisma.trip.create({
          data: {
            userId,
            eventId: stop.id,
            title: suggestion.title || (startLocation + ' to ' + destination),
            description: suggestion.description || '',
            startDate: stop.startDate ? new Date(stop.startDate) : null,
            status: 'PLANNING',
          }
        });

        for (const day of (suggestion.days || [])) {
          const tripDay = await prisma.tripDay.create({
            data: {
              tripId: trip.id,
              dayNumber: day.dayNumber,
              type: day.type || 'TRAVEL',
              notes: day.notes || '',
              date: suggestion.recommendedDepartureDate
                ? new Date(new Date(suggestion.recommendedDepartureDate).getTime() + (day.dayNumber - 1) * 86400000)
                : null,
            }
          });

          for (let si = 0; si < (day.stops || []).length; si++) {
            const s = day.stops[si];
            await prisma.tripStop.create({
              data: {
                tripDayId: tripDay.id,
                order: si,
                type: s.type || 'WAYPOINT',
                campgroundId: s.campgroundId || null,
                customName: s.customName || s.name || null,
                address: s.address || null,
                latitude: s.latitude ? parseFloat(s.latitude) : null,
                longitude: s.longitude ? parseFloat(s.longitude) : null,
                notes: s.notes || null,
                durationMins: s.durationMins || null,
              }
            });
          }
        }

        results.push({ stopId: stop.id, stopTitle: stop.title, status: 'planned', startLocation, destination, totalMiles: suggestion.totalMiles });
      } catch (legErr: any) {
        results.push({ stopId: stop.id, status: 'error', reason: legErr.message });
      }
    }

    const plannedCount = results.filter(r => r.status === 'planned').length;
    res.json({
      success: true,
      results,
      message: 'Routes planned for ' + plannedCount + '/' + sortedStops.length + ' legs.'
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to generate trip plans' });
  }
});


// GET /api/road-trips/:id/map-route — returns route + new states for TravelMap
router.get('/:id/map-route', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const roadTrip = await prisma.roadTrip.findFirst({
      where: { id: req.params.id, userId },
      include: {
        stops: {
          orderBy: [{ stopNumber: 'asc' }, { startDate: 'asc' }],
          include: {
            campground: { select: { name: true, city: true, state: true, latitude: true, longitude: true } },
          },
        },
      },
    });
    if (!roadTrip) return res.status(404).json({ error: 'Road trip not found' });

    // Resolve coords for every stop
    const resolveStopCoords = async (stop: any): Promise<{ lat: number; lng: number; name: string; state?: string } | null> => {
      if (stop.campground?.latitude && stop.campground?.longitude) {
        return { lat: Number(stop.campground.latitude), lng: Number(stop.campground.longitude), name: stop.campground.name, state: stop.campground.state };
      }
      if (stop.campgroundId) {
        const cg = await prisma.campground.findUnique({ where: { id: stop.campgroundId }, select: { latitude: true, longitude: true, name: true, state: true } });
        if (cg?.latitude) return { lat: Number(cg.latitude), lng: Number(cg.longitude), name: cg.name, state: cg.state ?? undefined };
      }
      if (stop.title) {
        const cg = await prisma.campground.findFirst({
          where: { name: { contains: stop.title.split(' ').slice(0, 3).join(' '), mode: 'insensitive' } },
          select: { latitude: true, longitude: true, name: true, state: true },
        });
        if (cg?.latitude) return { lat: Number(cg.latitude), lng: Number(cg.longitude), name: cg.name, state: cg.state ?? undefined };
      }
      return null;
    };

    // Resolve home coords
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { homeCity: true, homeState: true, location: true } });
    let homeCoords: { lat: number; lng: number; name: string } | null = null;
    const homeStr = (user as any)?.homeCity && (user as any)?.homeState
      ? `${(user as any).homeCity}, ${(user as any).homeState}`
      : (user as any)?.location || null;
    if (homeStr) {
      try {
        const geoParams = new URLSearchParams({ apiKey: HERE_API_KEY, q: homeStr, limit: '1' });
        const geoRes = await axios.get(`https://geocode.search.hereapi.com/v1/geocode?${geoParams}`);
        const pos = geoRes.data?.items?.[0]?.position;
        if (pos) homeCoords = { lat: pos.lat, lng: pos.lng, name: homeStr };
      } catch {}
    }

    const resolvedStops = await Promise.all(roadTrip.stops.map(resolveStopCoords));

    // Build ordered coordinate list: Home → Stop1 → Stop2 → ... → Home
    const allPoints: { lat: number; lng: number; name: string }[] = [];
    if (homeCoords) allPoints.push(homeCoords);
    resolvedStops.forEach(s => { if (s) allPoints.push(s); });
    if (homeCoords && resolvedStops.some(s => s)) allPoints.push({ ...homeCoords, name: 'Home (Return)' });

    if (allPoints.length < 2) return res.json({ route: null, newStates: [] });

    // Split into completed (past stops) vs upcoming (future stops)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let splitIdx = 1; // default: only home is "completed"
    roadTrip.stops.forEach((stop: any, i: any) => {
      if (stop.endDate && new Date(stop.endDate) < today) {
        splitIdx = i + 2; // +2 because home is index 0
      }
    });
    splitIdx = Math.min(Math.max(splitIdx, 1), allPoints.length);

    const completedCoords = allPoints.slice(0, splitIdx).map(p => [p.lng, p.lat] as [number, number]);
    const upcomingCoords = allPoints.slice(splitIdx - 1).map(p => [p.lng, p.lat] as [number, number]);
    const currentPosition = allPoints[splitIdx - 1];

    // Gather states in this trip
    const tripStates = [...new Set(resolvedStops.filter(Boolean).map(s => s!.state).filter(Boolean))];

    // Get user's already-visited states
    const visitedStateVisits = await prisma.stateVisit.findMany({
      where: { userId, startDate: { lte: today } },
      select: { state: true },
    });
    const visitedStates = new Set(visitedStateVisits.map((v: any) => v.state));
    const newStates = tripStates.filter(s => !visitedStates.has(s));

    res.json({
      route: {
        eventName: roadTrip.title,
        allStops: allPoints.map((p, i) => ({ id: String(i), name: p.name, latitude: p.lat, longitude: p.lng, order: i })),
        completedCoords,
        upcomingCoords,
        currentPosition: { latitude: currentPosition.lat, longitude: currentPosition.lng, name: currentPosition.name },
      },
      newStates,
      tripStates,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to build map route' });
  }
});


// GET /api/road-trips/:id/map-route — returns route + new states for TravelMap
router.get('/:id/map-route', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const roadTrip = await prisma.roadTrip.findFirst({
      where: { id: req.params.id, userId },
      include: {
        stops: {
          orderBy: [{ stopNumber: 'asc' }, { startDate: 'asc' }],
          include: {
            campground: { select: { name: true, city: true, state: true, latitude: true, longitude: true } },
          },
        },
      },
    });
    if (!roadTrip) return res.status(404).json({ error: 'Road trip not found' });

    // Resolve coords for every stop
    const resolveStopCoords = async (stop: any): Promise<{ lat: number; lng: number; name: string; state?: string } | null> => {
      if (stop.campground?.latitude && stop.campground?.longitude) {
        return { lat: Number(stop.campground.latitude), lng: Number(stop.campground.longitude), name: stop.campground.name, state: stop.campground.state };
      }
      if (stop.campgroundId) {
        const cg = await prisma.campground.findUnique({ where: { id: stop.campgroundId }, select: { latitude: true, longitude: true, name: true, state: true } });
        if (cg?.latitude) return { lat: Number(cg.latitude), lng: Number(cg.longitude), name: cg.name, state: cg.state ?? undefined };
      }
      if (stop.title) {
        const cg = await prisma.campground.findFirst({
          where: { name: { contains: stop.title.split(' ').slice(0, 3).join(' '), mode: 'insensitive' } },
          select: { latitude: true, longitude: true, name: true, state: true },
        });
        if (cg?.latitude) return { lat: Number(cg.latitude), lng: Number(cg.longitude), name: cg.name, state: cg.state ?? undefined };
      }
      return null;
    };

    // Resolve home coords
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { homeCity: true, homeState: true, location: true } });
    let homeCoords: { lat: number; lng: number; name: string } | null = null;
    const homeStr = (user as any)?.homeCity && (user as any)?.homeState
      ? `${(user as any).homeCity}, ${(user as any).homeState}`
      : (user as any)?.location || null;
    if (homeStr) {
      try {
        const geoParams = new URLSearchParams({ apiKey: HERE_API_KEY, q: homeStr, limit: '1' });
        const geoRes = await axios.get(`https://geocode.search.hereapi.com/v1/geocode?${geoParams}`);
        const pos = geoRes.data?.items?.[0]?.position;
        if (pos) homeCoords = { lat: pos.lat, lng: pos.lng, name: homeStr };
      } catch {}
    }

    const resolvedStops = await Promise.all(roadTrip.stops.map(resolveStopCoords));

    // Build ordered coordinate list: Home → Stop1 → Stop2 → ... → Home
    const allPoints: { lat: number; lng: number; name: string }[] = [];
    if (homeCoords) allPoints.push(homeCoords);
    resolvedStops.forEach(s => { if (s) allPoints.push(s); });
    if (homeCoords && resolvedStops.some(s => s)) allPoints.push({ ...homeCoords, name: 'Home (Return)' });

    if (allPoints.length < 2) return res.json({ route: null, newStates: [] });

    // Split into completed (past stops) vs upcoming (future stops)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let splitIdx = 1; // default: only home is "completed"
    roadTrip.stops.forEach((stop: any, i: any) => {
      if (stop.endDate && new Date(stop.endDate) < today) {
        splitIdx = i + 2; // +2 because home is index 0
      }
    });
    splitIdx = Math.min(Math.max(splitIdx, 1), allPoints.length);

    const completedCoords = allPoints.slice(0, splitIdx).map(p => [p.lng, p.lat] as [number, number]);
    const upcomingCoords = allPoints.slice(splitIdx - 1).map(p => [p.lng, p.lat] as [number, number]);
    const currentPosition = allPoints[splitIdx - 1];

    // Gather states in this trip
    const tripStates = [...new Set(resolvedStops.filter(Boolean).map(s => s!.state).filter(Boolean))];

    // Get user's already-visited states
    const visitedStateVisits = await prisma.stateVisit.findMany({
      where: { userId, startDate: { lte: today } },
      select: { state: true },
    });
    const visitedStates = new Set(visitedStateVisits.map((v: any) => v.state));
    const newStates = tripStates.filter(s => !visitedStates.has(s));

    res.json({
      route: {
        eventName: roadTrip.title,
        allStops: allPoints.map((p, i) => ({ id: String(i), name: p.name, latitude: p.lat, longitude: p.lng, order: i })),
        completedCoords,
        upcomingCoords,
        currentPosition: { latitude: currentPosition.lat, longitude: currentPosition.lng, name: currentPosition.name },
      },
      newStates,
      tripStates,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to build map route' });
  }
});

export default router;
