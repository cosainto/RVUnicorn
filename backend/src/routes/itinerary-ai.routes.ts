import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/suggest', authenticateToken, async (req, res) => {
  try {
    const { startLocation, destination, nights, rvType, avoidHighways, hoursPerDay, milesPerDay, departureTime, arrivalDate } = req.body;

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

    const drivingLimit = hoursPerDay ? `${hoursPerDay} hours per day max driving` : milesPerDay ? `${milesPerDay} miles per day max driving` : '6 hours per day max driving';
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
AVOID HIGHWAYS: ${avoidHighways ? 'yes, prefer scenic routes' : 'no preference'}

AVAILABLE CAMPGROUNDS IN OUR DATABASE (format: id|name|location|lat,lng|amenities):
${campgroundList}

CRITICAL PLANNING RULES:
1. RVs average 55-60 mph on highways, 45 mph on scenic routes
2. Add 20-30% extra time for RV stops, weight stations, slower speeds
3. Include a GAS STOP every 200-250 miles (most RVs get 8-12 mpg with 50-100 gal tanks)
4. Include a FOOD stop for trips over 4 hours
5. Space overnight stops based on the driving limit - do NOT exceed it
6. Calculate recommended DEPARTURE DATE based on arrival date and number of driving days needed
7. For overnight stops, STRONGLY PREFER campgrounds from our database (use exact id)
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
          "campgroundId": "exact id from database or null"
        }
      ]
    }
  ]
}

Stop types: OVERNIGHT, FUEL, FOOD, ATTRACTION, WAYPOINT, BOONDOCK, WALMART, DUMP, REST
Last day type should be ARRIVAL if destination is specific.`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
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
    const { title, description, startDate, suggestion } = req.body;

    const trip = await prisma.trip.create({
      data: {
        userId,
        title: title || suggestion.title,
        description: description || suggestion.description,
        startDate: suggestion.recommendedDepartureDate ? new Date(suggestion.recommendedDepartureDate) : startDate ? new Date(startDate) : null,
        status: 'PLANNING',
        visibility: 'PRIVATE'
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
