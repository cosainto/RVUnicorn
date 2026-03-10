import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/itinerary-ai/suggest
// Given start, destination, nights → returns suggested day-by-day itinerary
router.post('/suggest', authenticateToken, async (req, res) => {
  try {
    const { startLocation, destination, nights, rvType, avoidHighways } = req.body;

    if (!startLocation || !nights) {
      return res.status(400).json({ error: 'startLocation and nights are required' });
    }

    // Pull campgrounds from DB as candidates (limit to avoid huge prompt)
    const campgrounds = await prisma.campground.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, name: true, location: true, state: true, city: true, latitude: true, longitude: true, hasFullHookups: true, hasElectricHookup: true, hasDumpStation: true },
      take: 300,
      orderBy: { createdAt: 'desc' }
    });

    const campgroundList = campgrounds.map(c =>
      `${c.id}|${c.name}|${c.city || c.location}, ${c.state}|${c.latitude},${c.longitude}|${[c.hasFullHookups && 'full hookups', c.hasElectricHookup && 'electric', c.hasDumpStation && 'dump station'].filter(Boolean).join(', ')}`
    ).join('\n');

    const prompt = `You are an expert RV trip planner. Plan a ${nights}-night RV road trip.

START: ${startLocation}
DESTINATION: ${destination || 'flexible / scenic route'}
NIGHTS: ${nights}
RV TYPE: ${rvType || 'Class A motorhome'}
AVOID HIGHWAYS: ${avoidHighways ? 'yes, prefer scenic routes' : 'no preference'}

AVAILABLE CAMPGROUNDS IN OUR DATABASE (format: id|name|location|lat,lng|amenities):
${campgroundList}

Create a day-by-day itinerary. For each overnight stop, PREFER campgrounds from our database above (use their exact id). For fuel, food, attractions, and waypoints, use real named locations.

Respond ONLY with valid JSON in this exact format:
{
  "title": "Trip title",
  "description": "One sentence description",
  "days": [
    {
      "dayNumber": 1,
      "type": "TRAVEL",
      "date": null,
      "notes": "Brief day summary",
      "stops": [
        {
          "order": 0,
          "type": "FUEL",
          "customName": "Name of place",
          "address": "City, State",
          "latitude": 00.0000,
          "longitude": -00.0000,
          "notes": "Optional tip",
          "campgroundId": null
        },
        {
          "order": 1,
          "type": "OVERNIGHT",
          "customName": "Campground name",
          "address": "City, State",
          "latitude": 00.0000,
          "longitude": -00.0000,
          "notes": "Why this stop is great",
          "campgroundId": "use exact id from database or null if not in database"
        }
      ]
    }
  ]
}

Stop types: OVERNIGHT, FUEL, FOOD, ATTRACTION, WAYPOINT, BOONDOCK, WALMART, DUMP, REST
- Space driving days 300-400 miles apart max for RVs
- Include 1-3 stops per day (fuel, food, attraction + overnight)
- Last day should be ARRIVAL type if destination is specific
- Be realistic about RV-friendly roads`;

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

// POST /api/itinerary-ai/create-from-suggestion
// Create a full Trip with days and stops from AI suggestion
router.post('/create-from-suggestion', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, startDate, suggestion } = req.body;

    // Create the trip
    const trip = await prisma.trip.create({
      data: { userId, title: title || suggestion.title, description: description || suggestion.description, startDate: startDate ? new Date(startDate) : null, status: 'PLANNING', visibility: 'PRIVATE' }
    });

    // Create days and stops
    for (const day of suggestion.days) {
      const tripDay = await prisma.tripDay.create({
        data: {
          tripId: trip.id,
          dayNumber: day.dayNumber,
          type: day.type || 'TRAVEL',
          notes: day.notes,
          date: startDate && day.dayNumber ? new Date(new Date(startDate).getTime() + (day.dayNumber - 1) * 86400000) : null
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

    // Return full trip with days and stops
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
