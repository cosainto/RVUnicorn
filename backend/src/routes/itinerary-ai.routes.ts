import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/suggest', authenticateToken, async (req, res) => {
  try {
    const { startLocation, destination, nights, rvType, avoidHighways, hoursPerDay, milesPerDay, departureTime, arrivalDate, mealPref, stopFrequency, wantSightseeing, rvFuelType } = req.body;

    if (!startLocation || !nights) {
      return res.status(400).json({ error: 'startLocation and nights are required' });
    }

    const campgrounds = await prisma.campground.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, name: true, location: true, state: true, city: true, latitude: true, longitude: true, hasFullHookups: true, hasElectricHookup: true, hasDumpStation: true },
      take: 300,
      orderBy: { createdAt: 'desc' }
    });

    const campgroundList = campgrounds.map(c =>
      `${c.id}|${c.name}|${c.city || c.location}, ${c.state}|${c.latitude},${c.longitude}|${[c.hasFullHookups && 'full hookups', c.hasElectricHookup && 'electric', c.hasDumpStation && 'dump station'].filter(Boolean).join(', ')}`
    ).join('\n');

    // Pull free overnight spots from our database
    const overnightSpots = await prisma.freeOvernightSpot.findMany({
      where: { allowsRvs: true },
      select: { id: true, name: true, chain: true, category: true, city: true, state: true, latitude: true, longitude: true, hasFuel: true, hasFood: true, hasShowers: true, is24Hours: true },
      take: 500,
      orderBy: { rating: 'desc' }
    });

    const overnightSpotList = overnightSpots.map(s =>
      `${s.id}|${s.name}|${s.chain}|${s.city}, ${s.state}|${s.latitude},${s.longitude}|${[s.hasFuel && 'fuel', s.hasFood && 'food', s.hasShowers && 'showers', s.is24Hours && '24hr'].filter(Boolean).join(', ')}`
    ).join('\n');

    const drivingLimit = hoursPerDay ? `${hoursPerDay} hours per day max driving` : milesPerDay ? `${milesPerDay} miles per day max driving` : '8 hours per day max driving';
    const mealStyle = mealPref === 'fast' ? 'fast food / drive-thrus preferred (Chick-fil-A, McDonalds, Wendys, etc) - traveler is in a hurry' 
      : mealPref === 'sitdown' ? 'sit-down meals preferred - recommend local diners, family restaurants, or well-known chains with table service'
      : 'balanced mix - fast food for quick stops, sit-down for dinner or when time allows';
    const snackFreq = stopFrequency === 'none' ? 'no snack/rest stops - driver wants to push through'
      : stopFrequency === 'frequent' ? 'frequent stops every 1-2 hours for snacks, coffee, or rest'
      : 'a few stops - roughly every 3-4 hours for a quick break';
    const fuelNote = rvFuelType === 'diesel'
      ? 'RV runs on DIESEL - only recommend diesel truck stops: Pilot, Flying J, Love\'s, TA Travel Center, Petro, Sapp Bros. Do NOT suggest gas-only stations.'
      : 'RV runs on regular GASOLINE - recommend any fuel stop including Pilot, Love\'s, Kwik Trip, Sheetz, Wawa, Casey\'s, Maverik.';
    const sightseeingPref = wantSightseeing ? 'YES - recommend notable attractions, state parks, landmarks, or scenic viewpoints along the route. Add as ATTRACTION stops.' : 'NO - skip attractions, focus on efficient travel';
    const arrivalInfo = arrivalDate ? `Must arrive by: ${new Date(arrivalDate).toDateString()}` : '';
    const departureTimeInfo = departureTime ? `Preferred daily departure time: ${departureTime}` : 'Preferred daily departure time: 8:00 AM';

    const prompt = `You are an expert RV trip planner. Plan a ${nights}-night RV road trip with realistic driving constraints.

START: ${startLocation}
DESTINATION: ${destination || 'flexible / scenic route'}
NIGHTS: ${nights}
RV TYPE: ${rvType || 'Class A Motorhome'}
DRIVING LIMIT: ${drivingLimit}
${departureTimeInfo}
${arrivalInfo}
AVOID HIGHWAYS: \${avoidHighways ? 'yes, prefer scenic routes' : 'no preference'}
MEAL PREFERENCE: \${mealStyle}
SNACK/REST STOPS: \${snackFreq}
SIGHTSEEING: \${sightseeingPref}

AVAILABLE CAMPGROUNDS IN OUR DATABASE (format: id|name|location|lat,lng|amenities):
${campgroundList}

FREE OVERNIGHT STOPS IN OUR DATABASE (format: id|name|chain|location|lat,lng|amenities):
${overnightSpotList}

CRITICAL PLANNING RULES:
1. RVs average 55-60 mph on highways, 45 mph on scenic routes
2. Add 20-30% extra time for RV stops, weight stations, slower speeds
3. Include a GAS STOP every 200-250 miles (most RVs get 8-12 mpg with 50-100 gal tanks)
4. Include a FOOD stop for trips over 4 hours
5. Space overnight stops based on the driving limit - do NOT exceed it
6. Calculate recommended DEPARTURE DATE based on arrival date and number of driving days needed
7. For OVERNIGHT stops, STRONGLY PREFER campgrounds from our database (use exact campgroundId)
8. For WALMART/REST/FUEL stops, use spots from our FREE OVERNIGHT STOPS database (use freeOvernightSpotId field)
9. Walmart, Flying J, Pilot, Love's, Cracker Barrel are excellent free overnight options - use them for mid-route nights
8. Each day should have realistic mileage noted in the notes field
9. RVParky search links will be auto-generated for overnight stops based on lat/lng

Respond ONLY with valid JSON:
{
  "title": "Trip title",
  "description": "One sentence description",
  "recommendedDepartureDate": "YYYY-MM-DD or null",
  "recommendedDepartureTime": "8:00 AM",
  "totalDrivingDays": 3,
  "totalMiles": 1200,
  "notes": "Brief planning notes about this route",
  "days": [
    {
      "dayNumber": 1,
      "type": "TRAVEL",
      "estimatedMiles": 280,
      "estimatedDriveHours": 5.5,
      "notes": "Day summary with mileage",
      "stops": [
        {
          "order": 0,
          "type": "FUEL",
          "customName": "Stop name",
          "address": "City, State",
          "latitude": 00.0000,
          "longitude": -00.0000,
          "notes": "Tip for this stop",
          "campgroundId": null
        },
        {
          "order": 1,
          "type": "OVERNIGHT",
          "customName": "Campground name",
          "address": "City, State",
          "latitude": 00.0000,
          "longitude": -00.0000,
          "notes": "Why this is a great overnight stop",
          "campgroundId": "exact campground id or null",
          "freeOvernightSpotId": "exact free overnight spot id or null"
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
              include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true } } },
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
