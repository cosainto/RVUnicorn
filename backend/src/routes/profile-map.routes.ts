// profile-map.routes.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const STATE_CODES: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC',
};

// Get all states a user has visited
router.get('/users/:userId/states-visited', async (req, res) => {
  try {
    const userId = req.params.userId;

    const [stays, checkIns] = await Promise.all([
      prisma.stay.findMany({
        where: { userId },
        include: { campground: { select: { id: true, name: true, state: true } } },
      }),
      prisma.checkIn.findMany({
        where: { userId },
        include: { campground: { select: { id: true, name: true, state: true } } },
      }),
    ]);

    const stateMap: Record<string, {
      stateName: string;
      stateCode: string;
      visitCount: number;
      firstVisit: Date;
      lastVisit: Date;
      campgrounds: Map<string, { id: string; name: string; visitCount: number }>;
    }> = {};

    stays.forEach(stay => {
      const stateName = stay.campground?.state;
      if (!stateName) return;
      const code = STATE_CODES[stateName] || stateName;
      
      if (!stateMap[code]) {
        stateMap[code] = {
          stateName,
          stateCode: code,
          visitCount: 0,
          firstVisit: stay.startDate,
          lastVisit: stay.startDate,
          campgrounds: new Map(),
        };
      }

      const entry = stateMap[code];
      entry.visitCount++;
      if (stay.startDate < entry.firstVisit) entry.firstVisit = stay.startDate;
      if (stay.startDate > entry.lastVisit) entry.lastVisit = stay.startDate;

      if (stay.campground) {
        const cgEntry = entry.campgrounds.get(stay.campground.id);
        if (cgEntry) {
          cgEntry.visitCount++;
        } else {
          entry.campgrounds.set(stay.campground.id, {
            id: stay.campground.id,
            name: stay.campground.name,
            visitCount: 1,
          });
        }
      }
    });

    checkIns.forEach(checkIn => {
      const stateName = checkIn.campground?.state;
      if (!stateName) return;
      const code = STATE_CODES[stateName] || stateName;
      
      if (!stateMap[code]) {
        stateMap[code] = {
          stateName,
          stateCode: code,
          visitCount: 0,
          firstVisit: checkIn.checkInDate,
          lastVisit: checkIn.checkInDate,
          campgrounds: new Map(),
        };
      }

      const entry = stateMap[code];
      entry.visitCount++;
      if (checkIn.checkInDate < entry.firstVisit) entry.firstVisit = checkIn.checkInDate;
      if (checkIn.checkInDate > entry.lastVisit) entry.lastVisit = checkIn.checkInDate;

      if (checkIn.campground) {
        const cgEntry = entry.campgrounds.get(checkIn.campground.id);
        if (cgEntry) {
          cgEntry.visitCount++;
        } else {
          entry.campgrounds.set(checkIn.campground.id, {
            id: checkIn.campground.id,
            name: checkIn.campground.name,
            visitCount: 1,
          });
        }
      }
    });

    const states = Object.values(stateMap).map(entry => ({
      state: entry.stateName,
      stateCode: entry.stateCode,
      visitCount: entry.visitCount,
      firstVisit: entry.firstVisit.toISOString(),
      lastVisit: entry.lastVisit.toISOString(),
      campgrounds: Array.from(entry.campgrounds.values()).sort((a, b) => b.visitCount - a.visitCount),
    }));

    res.json({ states });
  } catch (error) {
    console.error('Get states visited error:', error);
    res.status(500).json({ error: 'Failed to fetch states visited' });
  }
});

// Get user's trip paths for map
router.get('/users/:userId/trip-paths', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit as string || '50');

    const trips = await prisma.trip.findMany({
      where: { userId },
      include: {
        stays: {
          include: {
            campground: { select: { name: true, state: true, latitude: true, longitude: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
      take: limit,
    });

    const tripPaths = trips.map(trip => {
      const firstStay = trip.stays[0];
      return {
        id: trip.id,
        name: trip.name,
        startDate: trip.startDate.toISOString(),
        destination: firstStay?.campground ? {
          lat: firstStay.campground.latitude,
          lng: firstStay.campground.longitude,
        } : null,
        campground: firstStay?.campground ? {
          name: firstStay.campground.name,
          state: firstStay.campground.state,
        } : null,
      };
    });

    res.json({ trips: tripPaths });
  } catch (error) {
    console.error('Get trip paths error:', error);
    res.status(500).json({ error: 'Failed to fetch trip paths' });
  }
});

// Get travel stats
router.get('/users/:userId/travel-stats', async (req, res) => {
  try {
    const userId = req.params.userId;

    const [stays, checkIns, trips] = await Promise.all([
      prisma.stay.findMany({ where: { userId }, include: { campground: { select: { state: true } } } }),
      prisma.checkIn.findMany({ where: { userId }, include: { campground: { select: { state: true } } } }),
      prisma.trip.count({ where: { userId } }),
    ]);

    const visitedStates = new Set<string>();
    stays.forEach(s => s.campground?.state && visitedStates.add(STATE_CODES[s.campground.state] || s.campground.state));
    checkIns.forEach(c => c.campground?.state && visitedStates.add(STATE_CODES[c.campground.state] || c.campground.state));

    const visitedCampgrounds = new Set<string>();
    stays.forEach(s => s.campgroundId && visitedCampgrounds.add(s.campgroundId));
    checkIns.forEach(c => c.campgroundId && visitedCampgrounds.add(c.campgroundId));

    let totalNights = 0;
    stays.forEach(stay => {
      const nights = Math.ceil((new Date(stay.endDate).getTime() - new Date(stay.startDate).getTime()) / (1000 * 60 * 60 * 24));
      totalNights += Math.max(0, nights);
    });

    const stateCounts: Record<string, number> = {};
    [...stays, ...checkIns].forEach(item => {
      const st = (item as any).campground?.state;
      if (st) stateCounts[STATE_CODES[st] || st] = (stateCounts[STATE_CODES[st] || st] || 0) + 1;
    });
    const mostVisited = Object.entries(stateCounts).sort(([, a], [, b]) => b - a)[0];

    res.json({
      statesVisited: visitedStates.size,
      campgroundsVisited: visitedCampgrounds.size,
      totalTrips: trips,
      totalCheckIns: checkIns.length,
      totalStays: stays.length,
      totalNights,
      usProgress: Math.round((visitedStates.size / 50) * 100),
      mostVisitedState: mostVisited ? { code: mostVisited[0], visits: mostVisited[1] } : null,
    });
  } catch (error) {
    console.error('Get travel stats error:', error);
    res.status(500).json({ error: 'Failed to fetch travel stats' });
  }
});

// Mark state as visited manually
router.post('/users/:userId/states-visited', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { state, startDate, notes } = req.body;

    const visit = await prisma.stateVisit.create({
      data: {
        userId,
        state,
        startDate: startDate ? new Date(startDate) : new Date(),
        notes,
        visibility: 'PRIVATE',
      },
    });

    res.json(visit);
  } catch (error) {
    console.error('Mark state visited error:', error);
    res.status(500).json({ error: 'Failed to mark state as visited' });
  }
});

// Remove manual state visit
router.delete('/users/:userId/states-visited/:state', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { state } = req.params;

    await prisma.stateVisit.deleteMany({
      where: { userId, state, visibility: 'PRIVATE' },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove state visit error:', error);
    res.status(500).json({ error: 'Failed to remove state visit' });
  }
});

export default router;
