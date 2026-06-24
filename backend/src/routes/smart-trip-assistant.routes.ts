import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// ── Haversine helper ──────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Fetch current average diesel price ────────────────────────────────
async function fetchDieselPrice(): Promise<number> {
  const FALLBACK = 3.65;
  try {
    const url = 'https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=DEMO_KEY&frequency=weekly&data[0]=value&facets[product][]=DSL&sort[0][column]=period&sort[0][direction]=desc&length=1';
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return FALLBACK;
    const data: any = await res.json();
    const val = data?.response?.data?.[0]?.value;
    return val && !isNaN(Number(val)) ? Number(val) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

// ── Build waypoints list from a TripPlan ──────────────────────────────
interface Waypoint {
  name: string;
  lat: number | null;
  lng: number | null;
  type: string;
  id?: string;
}

async function buildWaypoints(tripPlan: any): Promise<Waypoint[]> {
  const waypoints: Waypoint[] = [];

  // Start
  if (tripPlan.startLocation) {
    let lat = tripPlan.startLatitude;
    let lng = tripPlan.startLongitude;
    // Geocode if missing
    if (!lat || !lng) {
      console.log('[SmartTrip] Geocoding start:', tripPlan.startLocation);
      const coords = await geocodeAddress(tripPlan.startLocation);
      lat = coords?.lat ?? null;
      lng = coords?.lng ?? null;
      console.log('[SmartTrip] Start coords:', lat, lng);
    }
    waypoints.push({ name: tripPlan.startLocation, lat, lng, type: 'HOME' });
  }

  // Pit stops
  const pitStops = tripPlan.pitStops || [];
  for (const stop of pitStops) {
    waypoints.push({
      name: stop.name,
      lat: stop.latitude ?? stop.campground?.latitude ?? null,
      lng: stop.longitude ?? stop.campground?.longitude ?? null,
      type: stop.stopType,
      id: stop.id,
    });
  }

  // Destination — geocode if coordinates missing
  let destLat = tripPlan.endLatitude;
  let destLng = tripPlan.endLongitude;
  if ((!destLat || !destLng) && tripPlan.endLocation) {
    console.log('[SmartTrip] Geocoding destination:', tripPlan.endLocation);
    const coords = await geocodeAddress(tripPlan.endLocation);
    destLat = coords?.lat ?? null;
    destLng = coords?.lng ?? null;
    console.log('[SmartTrip] Destination coords:', destLat, destLng);
  }
  // Also try event campground coordinates as fallback
  if ((!destLat || !destLng) && tripPlan.event?.campground) {
    destLat = tripPlan.event.campground.latitude;
    destLng = tripPlan.event.campground.longitude;
    console.log('[SmartTrip] Using event campground coords:', destLat, destLng);
  }
  if (destLat && destLng) {
    waypoints.push({
      name: tripPlan.endLocation || 'Destination',
      lat: destLat,
      lng: destLng,
      type: 'FINAL_DESTINATION',
    });
  }

  console.log('[SmartTrip] Built', waypoints.length, 'waypoints, coords present:',
    waypoints.map(w => `${w.name.substring(0, 20)}: ${!!w.lat}`).join(', '));

  return waypoints;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_KEY) return null;
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_KEY}`
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

// ── Calculate legs between waypoints ──────────────────────────────────
interface LegInfo {
  legIndex: number;
  fromName: string;
  toName: string;
  distanceMiles: number;
  durationMinutes: number;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  midLat: number;
  midLng: number;
}

function calculateLegs(waypoints: Waypoint[]): LegInfo[] {
  const legs: LegInfo[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    if (from.lat && from.lng && to.lat && to.lng) {
      const straightLine = haversine(from.lat, from.lng, to.lat, to.lng);
      const roadMiles = Math.round(straightLine * 1.3);
      const durationMins = Math.round((roadMiles / 55) * 60); // 55 mph avg for RV
      legs.push({
        legIndex: i,
        fromName: from.name,
        toName: to.name,
        distanceMiles: roadMiles,
        durationMinutes: durationMins,
        fromLat: from.lat,
        fromLng: from.lng,
        toLat: to.lat,
        toLng: to.lng,
        midLat: (from.lat + to.lat) / 2,
        midLng: (from.lng + to.lng) / 2,
      });
    }
  }
  return legs;
}

// ═══════════════════════════════════════════════════════════════════════
// POST /smart-trip/:tripPlanId/calculate-summary
// ═══════════════════════════════════════════════════════════════════════
router.post('/:tripPlanId/calculate-summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tripPlanId } = req.params;
    const userId = (req as any).userId;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { id: tripPlanId },
      include: {
        pitStops: { orderBy: { orderIndex: 'asc' }, include: { campground: { select: { latitude: true, longitude: true } } } },
        event: { include: { campground: { select: { latitude: true, longitude: true, name: true, location: true, state: true } } } },
        user: { select: { rvMpg: true, rvFuelGal: true, rvFuelType: true, rvType: true } },
      },
    });

    if (!tripPlan || tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const waypoints = await buildWaypoints(tripPlan);
    const legs = calculateLegs(waypoints);

    console.log('[SmartTrip] calculate-summary: waypoints:', waypoints.length, 'legs:', legs.length);
    if (legs.length === 0) {
      console.log('[SmartTrip] WARNING: 0 legs computed. Waypoints:', JSON.stringify(waypoints.map(w => ({ name: w.name, lat: w.lat, lng: w.lng }))));
    }

    const totalMiles = legs.reduce((s, l) => s + l.distanceMiles, 0);
    const totalMinutes = legs.reduce((s, l) => s + l.durationMinutes, 0);

    // MPG: user profile > default 10
    const userMpg = tripPlan.user?.rvMpg || 10;
    const mpg = userMpg;
    const mpgSource = tripPlan.user?.rvMpg ? 'profile' : 'default';

    const fuelGallons = Math.ceil(totalMiles / mpg);

    // Diesel price
    const dieselPrice = await fetchDieselPrice();
    const fuelCost = Math.round(fuelGallons * dieselPrice * 100) / 100;

    // Drive days (default 8hr/day)
    const hoursPerDay = 8;
    const totalHours = totalMinutes / 60;
    const driveDays = Math.ceil(totalHours / hoursPerDay);

    // Tank capacity for fuel intelligence
    const tankGallons = tripPlan.user?.rvFuelGal || 75;
    const maxRange = Math.floor(tankGallons * mpg);

    // Per-leg breakdown
    const legBreakdown = legs.map(l => ({
      legIndex: l.legIndex,
      from: l.fromName,
      to: l.toName,
      distanceMiles: l.distanceMiles,
      durationMinutes: l.durationMinutes,
      fuelGallons: Math.ceil(l.distanceMiles / mpg),
      exceedsRange: l.distanceMiles > maxRange * 0.8,
    }));

    const summaryData = {
      totalMiles,
      totalMinutes,
      totalHours: Math.round(totalHours * 10) / 10,
      fuelGallons,
      fuelCost,
      dieselPrice,
      driveDays,
      hoursPerDay,
      mpg,
      mpgSource,
      tankGallons,
      maxRange,
      tollEstimate: 'N/A — toll data coming soon',
      legs: legBreakdown,
      calculatedAt: new Date().toISOString(),
    };

    // Cache on trip record
    await prisma.tripPlan.update({
      where: { id: tripPlanId },
      data: { summaryData },
    });

    res.json(summaryData);
  } catch (error: any) {
    console.error('Calculate summary error:', error);
    res.status(500).json({ error: 'Failed to calculate trip summary' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /smart-trip/:tripPlanId/summary
// ═══════════════════════════════════════════════════════════════════════
router.get('/:tripPlanId/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tripPlanId } = req.params;
    const userId = (req as any).userId;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { id: tripPlanId },
      select: { userId: true, summaryData: true },
    });

    if (!tripPlan || tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(tripPlan.summaryData || null);
  } catch (error: any) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to get trip summary' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /smart-trip/:tripPlanId/leg-suggestions
// ═══════════════════════════════════════════════════════════════════════
router.post('/:tripPlanId/leg-suggestions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tripPlanId } = req.params;
    const userId = (req as any).userId;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { id: tripPlanId },
      include: {
        pitStops: { orderBy: { orderIndex: 'asc' }, include: { campground: { select: { latitude: true, longitude: true } } } },
        event: { include: { campground: { select: { latitude: true, longitude: true, name: true, location: true, state: true } } } },
        user: { select: { rvMpg: true, rvFuelGal: true } },
        legDismissals: true,
      },
    });

    if (!tripPlan || tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const waypoints = await buildWaypoints(tripPlan);
    const legs = calculateLegs(waypoints);

    const mpg = tripPlan.user?.rvMpg || 10;
    const tankGallons = tripPlan.user?.rvFuelGal || 75;
    const maxRange = tankGallons * mpg;
    const hoursPerDay = 8;
    const dismissals = (tripPlan.legDismissals || []) as any[];

    let cumulativeDriveMinutes = 0;
    let milesSinceLastFuel = 0;
    let lastSuggestionType = '';

    const suggestions: any[] = [];

    for (const leg of legs) {
      cumulativeDriveMinutes += leg.durationMinutes;
      milesSinceLastFuel += leg.distanceMiles;

      // Determine suggestion type based on rules
      let suggestionType = 'ATTRACTION';
      let reason = '';

      const cumulativeHours = cumulativeDriveMinutes / 60;

      // Priority: fuel warning if leg exceeds 80% range
      if (leg.distanceMiles > maxRange * 0.8) {
        suggestionType = 'FUEL_WARNING';
        reason = `This leg is ${leg.distanceMiles} miles. Your range is ~${Math.floor(maxRange)} miles.`;
      }
      // Rule: overnight if cumulative > daily limit
      else if (cumulativeHours > hoursPerDay) {
        if (lastSuggestionType !== 'OVERNIGHT') {
          suggestionType = 'OVERNIGHT';
          reason = `${Math.round(cumulativeHours)}h of driving today — time to rest`;
        }
      }
      // Rule: fuel if > 250 miles since last fuel AND previous wasn't fuel (Rule 4)
      else if ((milesSinceLastFuel > 250 || leg.distanceMiles > 250) && lastSuggestionType !== 'FUEL') {
        suggestionType = 'FUEL';
        reason = `${milesSinceLastFuel} miles since last fuel stop`;
      }
      // Rule: food suggestion based on time of day
      else if (leg.durationMinutes > 240 && lastSuggestionType !== 'FOOD') {
        suggestionType = 'FOOD';
        reason = 'Long leg — consider a meal stop';
      }

      // Find specific suggestion from database
      let suggestion: any = null;
      const searchRadius = suggestionType === 'OVERNIGHT' ? 20 : suggestionType === 'FUEL' ? 10 : 15;

      try {
        if (suggestionType === 'FUEL' || suggestionType === 'FUEL_WARNING') {
          const fuelStops = await prisma.overnightStop.findMany({
            where: {
              latitude: { gte: leg.midLat - 0.15, lte: leg.midLat + 0.15 },
              longitude: { gte: leg.midLng - 0.15, lte: leg.midLng + 0.15 },
              stopType: { in: ['FUEL_CENTER', 'GAS_STATION', 'TRUCK_STOP'] },
            },
            orderBy: { visitCount: 'desc' },
            take: 1,
          });
          if (fuelStops.length > 0) {
            const s = fuelStops[0];
            suggestion = {
              id: s.id,
              name: s.name,
              address: `${s.city || ''}, ${s.state || ''}`.trim(),
              lat: s.latitude,
              lng: s.longitude,
              rating: null,
              overnightStopId: s.id,
              badges: [s.isRVFriendly && 'RV-Friendly', s.hasDump && 'Dump Station'].filter(Boolean),
            };
          }
        } else if (suggestionType === 'OVERNIGHT') {
          // Try campgrounds first, then overnight stops
          const campgrounds = await prisma.campground.findMany({
            where: {
              latitude: { gte: leg.midLat - 0.2, lte: leg.midLat + 0.2 },
              longitude: { gte: leg.midLng - 0.2, lte: leg.midLng + 0.2 },
            },
            orderBy: { averageRating: 'desc' },
            take: 1,
            select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, averageRating: true },
          });
          if (campgrounds.length > 0) {
            const c = campgrounds[0];
            suggestion = {
              id: c.id,
              name: c.name,
              address: `${c.city || ''}, ${c.state || ''}`.trim(),
              lat: c.latitude,
              lng: c.longitude,
              rating: c.averageRating,
              campgroundId: c.id,
            };
          } else {
            const overnightStops = await prisma.overnightStop.findMany({
              where: {
                latitude: { gte: leg.midLat - 0.2, lte: leg.midLat + 0.2 },
                longitude: { gte: leg.midLng - 0.2, lte: leg.midLng + 0.2 },
              },
              take: 1,
            });
            if (overnightStops.length > 0) {
              const s = overnightStops[0];
              suggestion = {
                id: s.id,
                name: s.name,
                address: `${s.city || ''}, ${s.state || ''}`.trim(),
                lat: s.latitude,
                lng: s.longitude,
                overnightStopId: s.id,
              };
            }
          }
        } else if (suggestionType === 'FOOD') {
          const foodSpots = await prisma.nearbyExperience.findMany({
            where: {
              latitude: { gte: leg.midLat - 0.1, lte: leg.midLat + 0.1 },
              longitude: { gte: leg.midLng - 0.1, lte: leg.midLng + 0.1 },
              category: { in: ['RESTAURANT', 'FOOD'] },
            },
            take: 1,
          });
          if (foodSpots.length > 0) {
            const f = foodSpots[0];
            suggestion = {
              id: f.id,
              name: f.name,
              address: f.address,
              lat: f.latitude,
              lng: f.longitude,
              experienceId: f.id,
            };
          }
        } else {
          // ATTRACTION
          const attractions = await prisma.nearbyExperience.findMany({
            where: {
              latitude: { gte: leg.midLat - 0.15, lte: leg.midLat + 0.15 },
              longitude: { gte: leg.midLng - 0.15, lte: leg.midLng + 0.15 },
            },
            take: 1,
          });
          if (attractions.length > 0) {
            const a = attractions[0];
            suggestion = {
              id: a.id,
              name: a.name,
              address: a.address,
              lat: a.latitude,
              lng: a.longitude,
              experienceId: a.id,
            };
          }
        }
      } catch (e) {
        // DB query failed — continue without suggestion
      }

      // Check if dismissed
      const isDismissed = dismissals.some(
        (d: any) => d.legIndex === leg.legIndex && suggestion && d.suggestionId === suggestion.id
      );

      // Count dismissals for this leg
      const legDismissalCount = dismissals.filter((d: any) => d.legIndex === leg.legIndex).length;

      suggestions.push({
        legIndex: leg.legIndex,
        fromName: leg.fromName,
        toName: leg.toName,
        distanceMiles: leg.distanceMiles,
        durationMinutes: leg.durationMinutes,
        suggestionType,
        reason,
        suggestion: isDismissed ? null : suggestion,
        isDismissed,
        allDismissed: legDismissalCount >= 2,
        exceedsRange: leg.distanceMiles > maxRange * 0.8,
        maxRange: Math.floor(maxRange),
      });

      // Update tracking
      if (suggestionType === 'FUEL' || suggestionType === 'FUEL_WARNING') {
        milesSinceLastFuel = 0;
      }
      if (suggestionType === 'OVERNIGHT') {
        cumulativeDriveMinutes = 0;
      }
      lastSuggestionType = suggestionType;
    }

    // Cache on trip record
    await prisma.tripPlan.update({
      where: { id: tripPlanId },
      data: { legSuggestions: suggestions },
    });

    res.json(suggestions);
  } catch (error: any) {
    console.error('Leg suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate leg suggestions' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /smart-trip/:tripPlanId/dismiss-suggestion
// ═══════════════════════════════════════════════════════════════════════
router.post('/:tripPlanId/dismiss-suggestion', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tripPlanId } = req.params;
    const userId = (req as any).userId;
    const { legIndex, suggestionId } = req.body;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { id: tripPlanId },
      select: { userId: true },
    });

    if (!tripPlan || tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.tripLegDismissal.upsert({
      where: { tripPlanId_legIndex_suggestionId: { tripPlanId, legIndex, suggestionId } },
      create: { tripPlanId, legIndex, suggestionId },
      update: { dismissedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Dismiss suggestion error:', error);
    res.status(500).json({ error: 'Failed to dismiss suggestion' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /smart-trip/:tripPlanId/add-suggestion
// Add a suggested stop to the trip at the correct position
// ═══════════════════════════════════════════════════════════════════════
router.post('/:tripPlanId/add-suggestion', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tripPlanId } = req.params;
    const userId = (req as any).userId;
    const { legIndex, name, address, latitude, longitude, stopType, campgroundId, overnightStopId, experienceId } = req.body;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { id: tripPlanId },
      include: { pitStops: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!tripPlan || tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Insert at legIndex position (after the origin node of that leg)
    const insertAt = legIndex;

    // Shift existing pit stops
    await Promise.all(
      tripPlan.pitStops
        .filter((s: any) => s.orderIndex >= insertAt)
        .map((s: any) => prisma.pitStop.update({ where: { id: s.id }, data: { orderIndex: s.orderIndex + 1 } }))
    );

    // Map suggestion type to PitStop stopType
    const pitStopType = stopType === 'FUEL_WARNING' ? 'GAS' :
      stopType === 'FUEL' ? 'GAS' :
      stopType === 'OVERNIGHT' ? 'CAMPGROUND' :
      stopType === 'FOOD' ? 'FOOD' :
      'OTHER';

    const pitStop = await prisma.pitStop.create({
      data: {
        tripPlanId,
        name,
        location: address || '',
        latitude: latitude || null,
        longitude: longitude || null,
        stopType: campgroundId ? 'CAMPGROUND' : pitStopType,
        campgroundId: campgroundId || null,
        overnightStopId: overnightStopId || null,
        orderIndex: insertAt,
        notes: experienceId ? `experienceId:${experienceId}` : null,
      } as any,
    });

    // Invalidate cached summaryData and legSuggestions
    await prisma.tripPlan.update({
      where: { id: tripPlanId },
      data: { summaryData: null, legSuggestions: null },
    });

    res.json(pitStop);
  } catch (error: any) {
    console.error('Add suggestion error:', error);
    res.status(500).json({ error: 'Failed to add suggestion to trip' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /smart-trip/:tripPlanId/stops-by-category
// ═══════════════════════════════════════════════════════════════════════
router.get('/:tripPlanId/stops-by-category', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tripPlanId } = req.params;
    const userId = (req as any).userId;
    const category = (req.query.category as string || '').toUpperCase();
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = 8;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { id: tripPlanId },
      include: {
        pitStops: { orderBy: { orderIndex: 'asc' }, include: { campground: { select: { latitude: true, longitude: true } } } },
        event: { include: { campground: { select: { latitude: true, longitude: true, name: true, location: true, state: true } } } },
      },
    });

    if (!tripPlan || tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const waypoints = await buildWaypoints(tripPlan);
    const legs = calculateLegs(waypoints);

    // Build corridor points from all waypoints and midpoints
    const corridorPoints = waypoints
      .filter(w => w.lat && w.lng)
      .map(w => ({ lat: w.lat!, lng: w.lng! }));
    for (const leg of legs) {
      corridorPoints.push({ lat: leg.midLat, lng: leg.midLng });
    }

    let results: any[] = [];

    if (category === 'GAS') {
      // Query OvernightStop fuel centers along corridor
      for (const point of corridorPoints) {
        const stops = await prisma.overnightStop.findMany({
          where: {
            latitude: { gte: point.lat - 0.2, lte: point.lat + 0.2 },
            longitude: { gte: point.lng - 0.2, lte: point.lng + 0.2 },
            stopType: { in: ['FUEL_CENTER', 'GAS_STATION', 'TRUCK_STOP'] },
          },
          take: 4,
          orderBy: { visitCount: 'desc' },
        });
        results.push(...stops.map((s: any) => ({
          id: s.id,
          name: s.name,
          city: s.city,
          state: s.state,
          lat: s.latitude,
          lng: s.longitude,
          type: 'GAS',
          badges: [s.isRVFriendly && 'RV-Friendly', s.hasDump && 'Pull-Through'].filter(Boolean),
          visitCount: s.visitCount,
          overnightStopId: s.id,
        })));
      }
    } else if (category === 'FOOD') {
      for (const point of corridorPoints) {
        const spots = await prisma.nearbyExperience.findMany({
          where: {
            latitude: { gte: point.lat - 0.1, lte: point.lat + 0.1 },
            longitude: { gte: point.lng - 0.1, lte: point.lng + 0.1 },
            category: { in: ['RESTAURANT', 'FOOD', 'MARKET'] },
          },
          take: 4,
        });
        results.push(...spots.map((s: any) => ({
          id: s.id,
          name: s.name,
          city: s.address,
          type: 'FOOD',
          lat: s.latitude,
          lng: s.longitude,
          category: s.category,
          experienceId: s.id,
        })));
      }
    } else if (category === 'RELAX') {
      for (const point of corridorPoints) {
        const spots = await prisma.nearbyExperience.findMany({
          where: {
            latitude: { gte: point.lat - 0.15, lte: point.lat + 0.15 },
            longitude: { gte: point.lng - 0.15, lte: point.lng + 0.15 },
            category: { in: ['TRAIL', 'SCENIC_VIEW', 'PLAYGROUND', 'FISHING_SPOT'] },
          },
          take: 4,
        });
        results.push(...spots.map((s: any) => ({
          id: s.id,
          name: s.name,
          city: s.address,
          type: 'RELAX',
          lat: s.latitude,
          lng: s.longitude,
          category: s.category,
          experienceId: s.id,
        })));
      }
    } else if (category === 'OVERNIGHT') {
      // Campgrounds + overnight stops
      for (const point of corridorPoints) {
        const campgrounds = await prisma.campground.findMany({
          where: {
            latitude: { gte: point.lat - 0.2, lte: point.lat + 0.2 },
            longitude: { gte: point.lng - 0.2, lte: point.lng + 0.2 },
          },
          take: 3,
          orderBy: { averageRating: 'desc' },
          select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, averageRating: true },
        });
        results.push(...campgrounds.map((c: any) => ({
          id: c.id,
          name: c.name,
          city: c.city,
          state: c.state,
          type: 'CAMPGROUND',
          lat: c.latitude,
          lng: c.longitude,
          rating: c.averageRating,
          campgroundId: c.id,
        })));

        const oStops = await prisma.overnightStop.findMany({
          where: {
            latitude: { gte: point.lat - 0.2, lte: point.lat + 0.2 },
            longitude: { gte: point.lng - 0.2, lte: point.lng + 0.2 },
            stopType: { notIn: ['FUEL_CENTER', 'GAS_STATION', 'TRUCK_STOP'] },
          },
          take: 3,
        });
        results.push(...oStops.map((s: any) => ({
          id: s.id,
          name: s.name,
          city: s.city,
          state: s.state,
          type: s.stopType || 'OVERNIGHT',
          lat: s.latitude,
          lng: s.longitude,
          badges: [s.isRVFriendly && 'RV-Friendly'].filter(Boolean),
          overnightStopId: s.id,
        })));
      }
    } else if (category === 'ATTRACTIONS') {
      for (const point of corridorPoints) {
        const spots = await prisma.nearbyExperience.findMany({
          where: {
            latitude: { gte: point.lat - 0.15, lte: point.lat + 0.15 },
            longitude: { gte: point.lng - 0.15, lte: point.lng + 0.15 },
          },
          take: 4,
        });
        results.push(...spots.map((s: any) => ({
          id: s.id,
          name: s.name,
          city: s.address,
          type: 'ATTRACTION',
          lat: s.latitude,
          lng: s.longitude,
          category: s.category,
          experienceId: s.id,
        })));
      }
    }

    // Deduplicate by id
    const seen = new Set();
    results = results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    // Calculate distance from route for each result
    for (const r of results) {
      if (r.lat && r.lng && corridorPoints.length > 0) {
        let minDist = Infinity;
        for (const p of corridorPoints) {
          const d = haversine(r.lat, r.lng, p.lat, p.lng);
          if (d < minDist) minDist = d;
        }
        r.distanceFromRoute = Math.round(minDist);
      }
    }

    // Sort by distance from route
    results.sort((a, b) => (a.distanceFromRoute || 999) - (b.distanceFromRoute || 999));

    // Paginate
    const total = results.length;
    results = results.slice(offset, offset + limit);

    res.json({ results, total, hasMore: offset + limit < total });
  } catch (error: any) {
    console.error('Stops by category error:', error);
    res.status(500).json({ error: 'Failed to find stops' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /smart-trip/:tripPlanId/campground-recommendations
// ═══════════════════════════════════════════════════════════════════════
router.get('/:tripPlanId/campground-recommendations', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tripPlanId } = req.params;
    const userId = (req as any).userId;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { id: tripPlanId },
      include: {
        pitStops: { orderBy: { orderIndex: 'asc' }, include: { campground: { select: { latitude: true, longitude: true } } } },
        event: { include: { campground: { select: { latitude: true, longitude: true, name: true, location: true, state: true } } } },
        user: { select: { rvType: true } },
      },
    });

    if (!tripPlan || tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const waypoints = await buildWaypoints(tripPlan);
    const legs = calculateLegs(waypoints);

    if (waypoints.length < 2 || !waypoints[0].lat || !waypoints[waypoints.length - 1].lat) {
      return res.json({ recommendations: [], totalMiles: 0, totalHours: 0, message: 'Route coordinates unavailable' });
    }

    const origin = waypoints[0];
    const dest = waypoints[waypoints.length - 1];
    const totalMiles = legs.reduce((s, l) => s + l.distanceMiles, 0);
    const totalHours = Math.round((legs.reduce((s, l) => s + l.durationMinutes, 0) / 60) * 10) / 10;

    // Existing campground IDs in trip — exclude them
    const existingCampgroundIds = new Set(
      (tripPlan.pitStops || [])
        .filter((s: any) => s.campgroundId)
        .map((s: any) => s.campgroundId)
    );

    // Build corridor search points between 4-12 hours of driving from origin
    // For a ~15h trip, 4-12h puts us at ~25-80% of the route
    const corridorPoints: { lat: number; lng: number; driveHours: number; driveMiles: number }[] = [];
    let cumulativeMiles = 0;
    let cumulativeMinutes = 0;

    // Sample points along the route at intervals
    for (const leg of legs) {
      const steps = 4;
      for (let s = 0; s <= steps; s++) {
        const frac = s / steps;
        const pointMiles = cumulativeMiles + leg.distanceMiles * frac;
        const pointMinutes = cumulativeMinutes + leg.durationMinutes * frac;
        const pointHours = pointMinutes / 60;

        if (pointHours >= 4 && pointHours <= 12) {
          const lat = leg.fromLat + (leg.toLat - leg.fromLat) * frac;
          const lng = leg.fromLng + (leg.toLng - leg.fromLng) * frac;
          corridorPoints.push({ lat, lng, driveHours: Math.round(pointHours * 10) / 10, driveMiles: Math.round(pointMiles) });
        }
      }
      cumulativeMiles += leg.distanceMiles;
      cumulativeMinutes += leg.durationMinutes;
    }

    // If total drive < 4h, expand window to 2-totalHours
    if (corridorPoints.length === 0) {
      const midLat = (origin.lat! + dest.lat!) / 2;
      const midLng = (origin.lng! + dest.lng!) / 2;
      corridorPoints.push({ lat: midLat, lng: midLng, driveHours: totalHours / 2, driveMiles: totalMiles / 2 });
    }

    // Search campgrounds near corridor points
    let allCampgrounds: any[] = [];
    const seenIds = new Set<string>();

    for (const point of corridorPoints) {
      const campgrounds = await prisma.campground.findMany({
        where: {
          latitude: { gte: point.lat - 0.25, lte: point.lat + 0.25 },
          longitude: { gte: point.lng - 0.25, lte: point.lng + 0.25 },
          averageRating: { gte: 3.5 },
        },
        select: {
          id: true, name: true, city: true, state: true,
          latitude: true, longitude: true,
          averageRating: true, ratingCount: true, googleRating: true, googleReviewCount: true,
          hasElectricHookup: true, hasWaterHookup: true, hasSewerHookup: true,
          hasPullThrough: true, isBigRigFriendly: true, isPetFriendly: true,
          imageUrl: true,
        },
        take: 5,
        orderBy: { averageRating: 'desc' },
      });

      for (const cg of campgrounds) {
        if (seenIds.has(cg.id) || existingCampgroundIds.has(cg.id)) continue;
        seenIds.add(cg.id);

        const distFromRoute = cg.latitude && cg.longitude
          ? Math.round(haversine(point.lat, point.lng, cg.latitude, cg.longitude))
          : null;

        if (distFromRoute !== null && distFromRoute > 30) continue; // Skip if > 30mi from route

        const rating = cg.averageRating > 0 ? cg.averageRating : cg.googleRating || 0;
        const reviewCount = (cg.ratingCount || 0) + (cg.googleReviewCount || 0);

        const amenities: string[] = [];
        if (cg.hasElectricHookup) amenities.push('Electric');
        if (cg.hasWaterHookup) amenities.push('Water');
        if (cg.hasSewerHookup) amenities.push('Sewer');
        if (cg.hasPullThrough) amenities.push('Pull-through');
        if (cg.isBigRigFriendly) amenities.push('Big Rig');
        if (cg.isPetFriendly) amenities.push('Pet Friendly');

        allCampgrounds.push({
          campgroundId: cg.id,
          name: cg.name,
          city: cg.city,
          state: cg.state,
          latitude: cg.latitude,
          longitude: cg.longitude,
          rating: Math.round(rating * 10) / 10,
          reviewCount,
          driveHoursFromOrigin: point.driveHours,
          driveMilesFromOrigin: point.driveMiles,
          distanceFromRoute: distFromRoute,
          amenities,
          imageUrl: cg.imageUrl,
        });
      }
    }

    // Sort: rating desc, then distance from route
    allCampgrounds.sort((a, b) => b.rating - a.rating || (a.distanceFromRoute || 99) - (b.distanceFromRoute || 99));

    // Limit to 8
    const recommendations = allCampgrounds.slice(0, 8);

    let message = '';
    if (recommendations.length < 3) {
      message = 'Limited options on this route — showing nearest available campgrounds.';
    }

    res.json({
      recommendations,
      totalMiles,
      totalHours,
      originName: origin.name,
      destName: dest.name,
      message,
    });
  } catch (error: any) {
    console.error('Campground recommendations error:', error);
    res.status(500).json({ error: 'Failed to get campground recommendations' });
  }
});

export default router;
