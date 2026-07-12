import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
import { prisma } from '../lib/prisma';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/suggest', authenticateToken, async (req, res) => {
  try {
    const { startLocation, destination, nights, rvType, avoidHighways, hoursPerDay, milesPerDay, departureTime, arrivalDate, mealPref, stopFrequency, wantSightseeing, rvFuelType, rvMpg, rvTankGallons, rvLength, hoursBeforeBreak } = req.body;

    if (!startLocation || !nights) {
      return res.status(400).json({ error: 'startLocation and nights are required' });
    }

    const campgrounds = await prisma.campground.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, name: true, location: true, state: true, city: true, latitude: true, longitude: true, hasFullHookups: true, hasElectricHookup: true, hasDumpStation: true },
      take: 300,
      orderBy: { createdAt: 'desc' }
    });

    const campgroundList = campgrounds.map((c: any) =>
      `${c.id}|${c.name}|${c.city || c.location}, ${c.state}|${c.latitude},${c.longitude}|${[c.hasFullHookups && 'full hookups', c.hasElectricHookup && 'electric', c.hasDumpStation && 'dump station'].filter(Boolean).join(', ')}`
    ).join('\n');

    const overnightSpots = await prisma.freeOvernightSpot.findMany({
      where: { allowsRvs: true },
      select: { id: true, name: true, chain: true, category: true, city: true, state: true, latitude: true, longitude: true, hasFuel: true, hasFood: true, hasShowers: true, is24Hours: true },
      take: 500,
      orderBy: { rating: 'desc' }
    });

    const overnightSpotList = overnightSpots.map((s: any) =>
      `${s.id}|${s.name}|${s.chain}|${s.city}, ${s.state}|${s.latitude},${s.longitude}|${[s.hasFuel && 'fuel', s.hasFood && 'food', s.hasShowers && 'showers', s.is24Hours && '24hr'].filter(Boolean).join(', ')}`
    ).join('\n');

    // ── Smart driving day calculation ───────────────────────────
    const maxHoursPerDay = hoursPerDay || 8;
    const maxMilesPerDay = milesPerDay || (maxHoursPerDay * 55);
    let estimatedTotalMiles: number | null = null;
    let estimatedDriveHours: number | null = null;
    let minimumDrivingDays = 1;

    // Estimate actual route distance via HERE Maps
    const HERE_API_KEY = process.env.HERE_API_KEY;
    if (HERE_API_KEY && startLocation && destination) {
      try {
        const startGeo = await fetch(`https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(startLocation)}&in=countryCode:USA&limit=1&apiKey=${HERE_API_KEY}`);
        const startData: any = await startGeo.json() as any;
        const startPos = startData.items?.[0]?.position;

        const destGeo = await fetch(`https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(destination)}&in=countryCode:USA&limit=1&apiKey=${HERE_API_KEY}`);
        const destData: any = await destGeo.json() as any;
        const destPos = destData.items?.[0]?.position;

        if (startPos && destPos) {
          const routeUrl = `https://router.hereapi.com/v8/routes?transportMode=truck&origin=${startPos.lat},${startPos.lng}&destination=${destPos.lat},${destPos.lng}&return=summary&truck[height]=400&truck[width]=250&truck[length]=1200&truck[grossWeight]=10000&apiKey=${HERE_API_KEY}`;
          const routeRes = await fetch(routeUrl);
          const routeData: any = await routeRes.json() as any;
          if (routeData.routes?.[0]?.sections?.[0]?.summary) {
            const summary = routeData.routes[0].sections[0].summary;
            estimatedTotalMiles = Math.round(summary.length / 1609.34);
            estimatedDriveHours = Math.round((summary.duration / 3600) * 10) / 10;
          }
        }
      } catch (e: any) {
        console.log('[ItineraryAI] Route estimation failed, using fallback');
      }
    }

    // Calculate minimum driving days
    if (estimatedDriveHours) {
      minimumDrivingDays = Math.ceil(estimatedDriveHours / maxHoursPerDay);
    } else if (estimatedTotalMiles) {
      minimumDrivingDays = Math.ceil(estimatedTotalMiles / maxMilesPerDay);
    }

    // Enforce realistic nights
    const minimumNights = minimumDrivingDays <= 1 ? 0 : minimumDrivingDays - 1;
    let effectiveNights = nights;
    let nightsOverrideNote = '';

    if (estimatedDriveHours && estimatedDriveHours <= 3) {
      // Short trip — no road overnights needed
      effectiveNights = Math.max(nights, 0);
      if (nights > 0 && estimatedDriveHours <= 2) {
        nightsOverrideNote = `NOTE: This is only a ~${estimatedDriveHours}hr drive (~${estimatedTotalMiles} miles). User requested ${nights} night(s) — they likely want to STAY at the destination. Plan as a single-day drive with overnight(s) at the destination campground.`;
      }
    } else if (effectiveNights < minimumNights) {
      effectiveNights = minimumNights;
      nightsOverrideNote = `NOTE: User requested ${nights} night(s), but the drive is ~${estimatedTotalMiles} miles / ~${estimatedDriveHours}hrs. That requires at least ${minimumDrivingDays} driving day(s) and ${minimumNights} road overnight(s). Plan ${effectiveNights} nights of travel.`;
    }

    const distanceContext = estimatedTotalMiles
      ? `ESTIMATED ROUTE: ~${estimatedTotalMiles} miles, ~${estimatedDriveHours} hours total driving\nMINIMUM DRIVING DAYS: ${minimumDrivingDays} (at ${maxHoursPerDay}hrs/day max)`
      : '';

    const drivingLimit = hoursPerDay ? `${hoursPerDay} hours per day max` : milesPerDay ? `${milesPerDay} miles per day max` : '8 hours per day max';
    const mealStyle = mealPref === 'fast' ? 'fast food / drive-thrus preferred'
      : mealPref === 'sitdown' ? 'sit-down meals preferred'
      : 'balanced mix of fast food and sit-down';
    const snackFreq = stopFrequency === 'none' ? 'no extra stops'
      : stopFrequency === 'frequent' ? 'frequent stops every 1-2 hours'
      : 'stops every 3-4 hours';
    const sightseeingPref = wantSightseeing ? 'YES - include attractions' : 'NO - efficient travel only';
    const avoidHwyStr = avoidHighways ? 'yes, prefer scenic routes' : 'no preference';
    const breakInterval = hoursBeforeBreak ? `The user wants to stop for a break every ${hoursBeforeBreak} hours of driving. Suggest rest stops, fuel stops, or points of interest at those intervals along the route.` : '';
    const arrivalInfo = arrivalDate ? `Must arrive by: ${new Date(arrivalDate).toDateString()}` : '';
    const departureTimeInfo = departureTime ? `Departure time: ${departureTime}` : 'Departure time: 8:00 AM';
    const fuelNote = rvFuelType === 'diesel'
      ? 'DIESEL RV - only recommend diesel truck stops (Pilot, Flying J, Love\'s, TA).'
      : 'GASOLINE RV - any fuel stop works.';

    const prompt = `You are an expert RV trip planner. Plan a realistic RV road trip.

START: ${startLocation}
DESTINATION: ${destination || 'flexible / scenic route'}
NIGHTS: ${effectiveNights}
RV TYPE: ${rvType || 'Class A Motorhome'}
DRIVING LIMIT: ${drivingLimit}
${departureTimeInfo}
${arrivalInfo}
${distanceContext}
${nightsOverrideNote}
AVOID HIGHWAYS: ${avoidHwyStr}
${breakInterval}
MEALS: ${mealStyle}
REST STOPS: ${snackFreq}
SIGHTSEEING: ${sightseeingPref}
FUEL: ${fuelNote}
RV SPECS: ${rvMpg ? `${rvMpg} MPG` : 'MPG unknown (assume 8-10)'}${rvTankGallons ? `, ${rvTankGallons} gallon tank (range ~${Math.round(rvTankGallons * (rvMpg || 8))} miles per fill)` : ''}${rvLength ? `, ${rvLength}ft length` : ''}

CAMPGROUNDS IN OUR DB (id|name|location|lat,lng|amenities):
${campgroundList}

FREE OVERNIGHT SPOTS IN OUR DB (id|name|chain|location|lat,lng|amenities):
${overnightSpotList}

CRITICAL RULES — YOU MUST FOLLOW ALL:
1. NEVER exceed ${maxHoursPerDay} hours of driving in a single day. Hard maximum.
2. If total drive > ${maxHoursPerDay} hours: MUST split across multiple days with overnights.
3. Under 3 hours total: NO road overnights. Drive straight through, 1 fuel stop max.
4. 3-${maxHoursPerDay} hours total: One driving day, no road overnights needed.
5. Over ${maxHoursPerDay} hours total: MUST have overnight stops. Max ~${Math.round(maxHoursPerDay * 55)} miles/day.
6. RVs average 55 mph highways, 45 mph scenic. Add 20-30% for RV overhead.
7. GAS STOP every ${rvTankGallons && rvMpg ? `${Math.round(rvTankGallons * rvMpg * 0.7)} miles (this RV has a ${rvTankGallons}-gallon tank at ${rvMpg} MPG — stop at 70% tank)` : '200-250 miles'}.
8. FOOD stop for driving days > 4 hours.
9. OVERNIGHT stops: prefer campgrounds from our DB (use campgroundId).
10. FUEL/REST stops: use free overnight spots from our DB (use freeOvernightSpotId).
11. Each day notes: include "~X miles, ~Y hours driving".
12. Departure date: work backwards from arrival date minus driving days.

Respond ONLY with valid JSON:
{
  "title": "Trip title",
  "description": "One sentence description",
  "recommendedDepartureDate": "YYYY-MM-DD or null",
  "recommendedDepartureTime": "8:00 AM",
  "totalDrivingDays": 3,
  "totalMiles": 1200,
  "notes": "Brief planning notes",
  "days": [
    {
      "dayNumber": 1,
      "type": "TRAVEL",
      "estimatedMiles": 280,
      "estimatedDriveHours": 5.5,
      "notes": "~280 miles, ~5.5 hours driving. Day summary.",
      "stops": [
        {
          "order": 0,
          "type": "FUEL",
          "customName": "Stop name",
          "address": "City, State",
          "latitude": 00.0000,
          "longitude": -00.0000,
          "notes": "Tip for this stop",
          "campgroundId": null,
          "freeOvernightSpotId": null
        }
      ]
    }
  ]
}

Stop types: OVERNIGHT, FUEL, FOOD, ATTRACTION, WAYPOINT, BOONDOCK, WALMART, DUMP, REST
Last day type should be ARRIVAL if destination is specific.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = (message.content[0] as any).text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI did not return valid JSON' });

    const itinerary = JSON.parse(jsonMatch[0]);

    // Include the distance estimation in the response for frontend context
    if (estimatedTotalMiles) {
      itinerary._routeEstimate = { totalMiles: estimatedTotalMiles, totalHours: estimatedDriveHours, minimumDrivingDays, effectiveNights, userRequestedNights: nights };
    }

    res.json(itinerary);
  } catch (e: any) {
    console.error('Itinerary AI error:', e?.message);
    res.status(500).json({ error: 'Failed to generate itinerary' });
  }
});

router.post('/create-from-suggestion', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, startDate, suggestion, eventId } = req.body;

    const trip = await prisma.trip.create({
      data: {
        userId,
        title: title || suggestion.title,
        description: description || suggestion.description,
        startDate: suggestion.recommendedDepartureDate ? new Date(suggestion.recommendedDepartureDate) : startDate ? new Date(startDate) : null,
        status: 'PLANNING',
        visibility: 'PRIVATE',
        ...(eventId ? { eventId } : {}),
      }
    });

    for (const day of suggestion.days) {
      const tripDay = await prisma.tripDay.create({
        data: {
          tripId: trip.id,
          dayNumber: day.dayNumber,
          type: day.type || 'TRAVEL',
          notes: day.notes,
          date: suggestion.recommendedDepartureDate
            ? new Date(new Date(suggestion.recommendedDepartureDate).getTime() + (day.dayNumber - 1) * 86400000)
            : null
        }
      });

      for (const stop of (day.stops || [])) {
        await prisma.tripStop.create({
          data: {
            tripDayId: tripDay.id,
            order: stop.order || 0,
            type: stop.type || 'WAYPOINT',
            campgroundId: stop.campgroundId || null,
            customName: stop.customName || null,
            address: stop.address || null,
            latitude: stop.latitude || null,
            longitude: stop.longitude || null,
            notes: stop.notes || null,
            confirmed: false
          }
        });
      }
    }

    const fullTrip = await prisma.trip.findUnique({
      where: { id: trip.id },
      include: {
        days: {
          include: {
            stops: {
              include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true, bookingUrl: true, websiteUrl: true, customSlug: true } } },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { dayNumber: 'asc' }
        }
      }
    });

    res.json(fullTrip);
  } catch (e: any) {
    console.error('Create from suggestion error:', e?.message);
    res.status(500).json({ error: 'Failed to create trip from suggestion' });
  }
});

export default router;
