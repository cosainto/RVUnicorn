import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Get trip plan for an event (for current user)
router.get('/event/:eventId/my-trip', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { eventId_userId: { eventId, userId } },
      include: {
        ridingWith: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
        },
        pitStops: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    res.json(tripPlan);
  } catch (error) {
    console.error('Get trip plan error:', error);
    res.status(500).json({ error: 'Failed to get trip plan' });
  }
});

// Get all trip plans for an event
router.get('/event/:eventId/all-trips', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const tripPlans = await prisma.tripPlan.findMany({
      where: { eventId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, location: true }
        },
        ridingWith: {
          select: { id: true, firstName: true, lastName: true, username: true }
        },
        pitStops: {
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(tripPlans);
  } catch (error) {
    console.error('Get all trip plans error:', error);
    res.status(500).json({ error: 'Failed to get trip plans' });
  }
});

// Create or update trip plan
router.post('/event/:eventId/plan', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;
    const { 
      startLocation, 
      useHometown, 
      isDriving, 
      ridingWithId,
      routePreference,
      avoidTolls,
      avoidHighways,
      arrivalDate
    } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        location: true,
        homeAddress: true,
        homeCity: true,
        homeState: true,
        homeZipCode: true
      }
    });

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        campground: {
          select: { name: true, location: true, state: true, latitude: true, longitude: true }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Build home location from new fields, fall back to legacy location field
    let homeLocation = '';
    if (user?.homeCity && user?.homeState) {
      homeLocation = user.homeAddress 
        ? `${user.homeAddress}, ${user.homeCity}, ${user.homeState}`
        : `${user.homeCity}, ${user.homeState}`;
      if (user.homeZipCode) homeLocation += ` ${user.homeZipCode}`;
    } else if (user?.location) {
      homeLocation = user.location;
    }
    
    const finalStartLocation = useHometown ? (homeLocation || startLocation) : startLocation;
    const endLocation = event.campground 
      ? `${event.campground.name}, ${event.campground.location}, ${event.campground.state}`
      : event.location || '';

    // Default arrival date to event start date at 2pm if not provided
    let finalArrivalDate: Date | null = null;
    if (arrivalDate) {
      finalArrivalDate = new Date(arrivalDate);
    } else if (event.startDate) {
      const defaultArrival = new Date(event.startDate);
      defaultArrival.setHours(14, 0, 0, 0);
      finalArrivalDate = defaultArrival;
    }

    let distanceMiles: number | null = null;
    let durationMinutes: number | null = null;

    if (event.campground?.latitude && event.campground?.longitude && finalStartLocation) {
      const routeData = await calculateRoute(
        finalStartLocation,
        { lat: event.campground.latitude, lng: event.campground.longitude }
      );
      distanceMiles = routeData.distanceMiles;
      durationMinutes = routeData.durationMinutes;
    }

    const tripPlan = await prisma.tripPlan.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: {
        startLocation: finalStartLocation || '',
        useHometown: useHometown ?? true,
        endLocation,
        endLatitude: event.campground?.latitude,
        endLongitude: event.campground?.longitude,
        distanceMiles,
        durationMinutes,
        isDriving: isDriving ?? true,
        ridingWithId: isDriving ? null : ridingWithId,
        routePreference: routePreference || 'FASTEST',
        avoidTolls: avoidTolls ?? false,
        avoidHighways: avoidHighways ?? false,
        arrivalDate: finalArrivalDate,
      },
      create: {
        eventId,
        userId,
        startLocation: finalStartLocation || '',
        useHometown: useHometown ?? true,
        endLocation,
        endLatitude: event.campground?.latitude,
        endLongitude: event.campground?.longitude,
        distanceMiles,
        durationMinutes,
        isDriving: isDriving ?? true,
        ridingWithId: isDriving ? null : ridingWithId,
        routePreference: routePreference || 'FASTEST',
        avoidTolls: avoidTolls ?? false,
        avoidHighways: avoidHighways ?? false,
        arrivalDate: finalArrivalDate,
      },
      include: {
        ridingWith: {
          select: { id: true, firstName: true, lastName: true, username: true }
        },
        pitStops: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    // Notify the person you are riding with
    if (ridingWithId && !isDriving) {
      const rider = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true }
      });
      await prisma.notification.create({
        data: {
          userId: ridingWithId,
          type: "TRIP_RIDING_WITH",
          content: (rider?.firstName || "") + " " + (rider?.lastName || "") + " wants to ride with you to " + event.title,
          link: "/events/" + eventId
        }
      });
    }

    res.json(tripPlan);
  } catch (error: any) {
    console.error('Create trip plan error:', error?.message, error?.code, JSON.stringify(error?.meta));
    res.status(500).json({ error: 'Failed to create trip plan', detail: error?.message });
  }
});

// Add a pit stop
router.post('/trip/:tripId/pit-stop', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tripId } = req.params;
    const userId = (req as any).userId;
    const { name, location, stopType, notes, estimatedDuration } = req.body;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { id: tripId },
      include: { pitStops: true }
    });

    if (!tripPlan || tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const orderIndex = tripPlan.pitStops.length;

    const pitStop = await prisma.pitStop.create({
      data: {
        tripPlanId: tripId,
        name,
        location,
        stopType,
        notes,
        estimatedDuration,
        orderIndex,
      }
    });

    res.json(pitStop);
  } catch (error) {
    console.error('Add pit stop error:', error);
    res.status(500).json({ error: 'Failed to add pit stop' });
  }
});

// Update a pit stop
router.put('/pit-stop/:pitStopId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pitStopId } = req.params;
    const userId = (req as any).userId;
    const { name, location, stopType, notes, estimatedDuration, orderIndex } = req.body;

    const pitStop = await prisma.pitStop.findUnique({
      where: { id: pitStopId },
      include: { tripPlan: true }
    });

    if (!pitStop || pitStop.tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.pitStop.update({
      where: { id: pitStopId },
      data: { name, location, stopType, notes, estimatedDuration, orderIndex }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update pit stop error:', error);
    res.status(500).json({ error: 'Failed to update pit stop' });
  }
});

// Delete a pit stop
router.delete('/pit-stop/:pitStopId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pitStopId } = req.params;
    const userId = (req as any).userId;

    const pitStop = await prisma.pitStop.findUnique({
      where: { id: pitStopId },
      include: { tripPlan: true }
    });

    if (!pitStop || pitStop.tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.pitStop.delete({ where: { id: pitStopId } });

    // Reorder remaining pit stops
    const remainingStops = await prisma.pitStop.findMany({
      where: { tripPlanId: pitStop.tripPlanId },
      orderBy: { orderIndex: 'asc' }
    });

    for (let i = 0; i < remainingStops.length; i++) {
      await prisma.pitStop.update({
        where: { id: remainingStops[i].id },
        data: { orderIndex: i }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete pit stop error:', error);
    res.status(500).json({ error: 'Failed to delete pit stop' });
  }
});

// Mark trip as completed and log miles
router.post('/trip/:tripId/complete', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tripId } = req.params;
    const userId = (req as any).userId;
    const { actualMiles } = req.body;

    const tripPlan = await prisma.tripPlan.findUnique({
      where: { id: tripId },
      include: { event: true }
    });

    if (!tripPlan || tripPlan.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedTrip = await prisma.tripPlan.update({
      where: { id: tripId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        actualMiles: actualMiles || tripPlan.distanceMiles,
      }
    });

    const milesToLog = actualMiles || tripPlan.distanceMiles;
    if (milesToLog) {
      await prisma.userMileageLog.create({
        data: {
          userId,
          tripPlanId: tripId,
          miles: milesToLog * 2,
          description: `Trip to ${tripPlan.event.title}`,
          tripDate: tripPlan.event.startDate,
        }
      });
    }

    res.json(updatedTrip);
  } catch (error) {
    console.error('Complete trip error:', error);
    res.status(500).json({ error: 'Failed to complete trip' });
  }
});


// POST /api/trip-planner/process-auto-mileage
// Called on page load - auto-logs departure and return miles when trip dates pass
router.post('/process-auto-mileage', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();
    const logged = [];

    // Get all planned/active trips for this user
    const tripPlans = await prisma.tripPlan.findMany({
      where: { userId, status: { not: 'CANCELLED' } },
      include: {
        event: { select: { id: true, title: true, startDate: true, endDate: true } },
        mileageLogs: { select: { id: true, description: true } },
      },
    });

    for (const trip of tripPlans) {
      if (!trip.distanceMiles || !trip.event.startDate) continue;
      const oneWay = trip.distanceMiles;

      const startDate = new Date(trip.event.startDate);
      const endDate = trip.event.endDate ? new Date(trip.event.endDate) : new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);

      // Log departure miles 1 day after startDate
      const departureLogDay = new Date(startDate);
      departureLogDay.setDate(departureLogDay.getDate() + 1);
      departureLogDay.setHours(0, 0, 0, 0);

      const departureKey = `Departed to ${trip.event.title}`;
      const alreadyLoggedDeparture = trip.mileageLogs.some(l => l.description === departureKey);

      if (!alreadyLoggedDeparture && now >= departureLogDay) {
        await prisma.userMileageLog.create({
          data: {
            userId,
            tripPlanId: trip.id,
            miles: oneWay,
            description: departureKey,
            tripDate: departureLogDay,
          },
        });
        logged.push({ type: 'departure', trip: trip.event.title, miles: oneWay });
      }

      // Log return miles 1 day after endDate
      const returnLogDay = new Date(endDate);
      returnLogDay.setDate(returnLogDay.getDate() + 1);
      returnLogDay.setHours(12, 0, 0, 0);

      const returnKey = `Returned from ${trip.event.title}`;
      const alreadyLoggedReturn = trip.mileageLogs.some(l => l.description === returnKey);

      if (!alreadyLoggedReturn && now >= returnLogDay) {
        await prisma.userMileageLog.create({
          data: {
            userId,
            tripPlanId: trip.id,
            miles: oneWay,
            description: returnKey,
            tripDate: returnLogDay,
          },
        });

        // Mark trip as completed if not already
        if (trip.status === 'PLANNED') {
          await prisma.tripPlan.update({
            where: { id: trip.id },
            data: { status: 'COMPLETED', completedAt: returnLogDay, actualMiles: oneWay * 2 },
          });
        }

        logged.push({ type: 'return', trip: trip.event.title, miles: oneWay });
      }
    }

    res.json({ processed: logged.length, logged });
  } catch (error) {
    console.error('Auto mileage error:', error);
    res.status(500).json({ error: 'Failed to process auto mileage' });
  }
});

// Get user's mileage stats
router.get('/my-mileage', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const logs = await prisma.userMileageLog.findMany({
      where: { userId },
      orderBy: { tripDate: 'desc' },
      include: {
        tripPlan: {
          include: {
            event: { select: { id: true, title: true } }
          }
        }
      }
    });

    const totalMiles = logs.reduce((sum, log) => sum + log.miles, 0);
    const thisYear = logs
      .filter(l => new Date(l.tripDate).getFullYear() === new Date().getFullYear())
      .reduce((sum, log) => sum + log.miles, 0);

    res.json({
      totalMiles,
      thisYearMiles: thisYear,
      tripCount: logs.length,
      logs
    });
  } catch (error) {
    console.error('Get mileage error:', error);
    res.status(500).json({ error: 'Failed to get mileage' });
  }
});

async function calculateRoute(
  origin: string,
  destination: { lat: number; lng: number }
): Promise<{ distanceMiles: number | null; durationMinutes: number | null }> {
  try {
    const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
    const geoResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(origin)}&key=${GOOGLE_KEY}`
    );

    if (!geoResponse.ok) return { distanceMiles: null, durationMinutes: null };

    const geoData = await geoResponse.json();
    if (!geoData.results?.length) return { distanceMiles: null, durationMinutes: null };

    const originLat = geoData.results[0].geometry.location.lat;
    const originLng = geoData.results[0].geometry.location.lng;

    const R = 3959;
    const dLat = (destination.lat - originLat) * Math.PI / 180;
    const dLon = (destination.lng - originLng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(originLat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const straightLineDistance = R * c;

    const roadDistance = Math.round(straightLineDistance * 1.3);
    const duration = Math.round((roadDistance / 50) * 60);

    return { distanceMiles: roadDistance, durationMinutes: duration };
  } catch (error) {
    console.error('Route calculation error:', error);
    return { distanceMiles: null, durationMinutes: null };
  }
}

export default router;
