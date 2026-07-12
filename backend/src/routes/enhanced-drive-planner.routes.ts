// enhanced-drive-planner.routes.ts
// Backend routes for Drive Planner with Google + HERE integration

import { Router } from 'express';
import axios from 'axios';

const router = Router();
import { prisma } from '../lib/prisma';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const HERE_API_KEY = process.env.HERE_API_KEY;

// ============================================
// GOOGLE DIRECTIONS API
// ============================================

// Get route using Google Directions API
router.get('/route/google', async (req, res) => {
  try {
    const { origin, destination, waypoints, avoidTolls, avoidHighways, departureTime } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination required' });
    }

    const params = new URLSearchParams({
      origin: origin as string,
      destination: destination as string,
      mode: 'driving',
      departure_time: departureTime as string || 'now',
      traffic_model: 'best_guess',
      key: GOOGLE_MAPS_API_KEY!,
    });

    if (waypoints) {
      params.append('waypoints', `optimize:true|${waypoints}`);
    }

    const avoid: string[] = [];
    if (avoidTolls === 'true') avoid.push('tolls');
    if (avoidHighways === 'true') avoid.push('highways');
    if (avoid.length > 0) {
      params.append('avoid', avoid.join('|'));
    }

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`
    );

    if (response.data.status !== 'OK') {
      return res.status(400).json({ 
        error: 'Route not found', 
        details: response.data.status 
      });
    }

    const route = response.data.routes[0];
    const legs = route.legs;

    // Calculate totals
    let totalDistance = 0;
    let totalDuration = 0;
    let totalDurationInTraffic = 0;

    legs.forEach((leg: any) => {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
      totalDurationInTraffic += leg.duration_in_traffic?.value || leg.duration.value;
    });

    res.json({
      distance: totalDistance, // meters
      duration: totalDuration, // seconds
      durationInTraffic: totalDurationInTraffic,
      polyline: route.overview_polyline.points,
      bounds: route.bounds,
      waypointOrder: route.waypoint_order,
      legs: legs.map((leg: any) => ({
        distance: leg.distance.text,
        distanceValue: leg.distance.value,
        duration: leg.duration.text,
        durationValue: leg.duration.value,
        durationInTraffic: leg.duration_in_traffic?.text,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        startLocation: leg.start_location,
        endLocation: leg.end_location,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions,
          distance: step.distance.text,
          duration: step.duration.text,
          maneuver: step.maneuver,
        })),
      })),
    });
  } catch (error: any) {
    console.error('Google Directions error:', error.message);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
});

// ============================================
// HERE MAPS API (RV-OPTIMIZED ROUTING)
// ============================================

// Get RV-optimized route using HERE Maps
router.get('/route/here', async (req, res) => {
  try {
    const {
      origin,
      destination,
      waypoints,
      vehicleHeight,
      vehicleWeight,
      vehicleLength,
      vehicleWidth,
      avoidTolls,
      avoidHighways,
    } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination required' });
    }

    // Build HERE routing request
    const params = new URLSearchParams({
      apiKey: HERE_API_KEY!,
      origin: origin as string,
      destination: destination as string,
      transportMode: 'truck', // Use truck mode for RV routing
      return: 'polyline,summary,actions,instructions',
    });

    // Add vehicle dimensions for RV routing
    if (vehicleHeight) {
      params.append('truck[height]', String(parseFloat(vehicleHeight as string) * 30.48)); // ft to cm
    }
    if (vehicleWeight) {
      params.append('truck[grossWeight]', String(parseFloat(vehicleWeight as string) * 0.453592)); // lbs to kg
    }
    if (vehicleLength) {
      params.append('truck[length]', String(parseFloat(vehicleLength as string) * 30.48));
    }
    if (vehicleWidth) {
      params.append('truck[width]', String(parseFloat(vehicleWidth as string) * 30.48));
    }

    // Avoid options
    const avoid: string[] = [];
    if (avoidTolls === 'true') avoid.push('tollRoad');
    if (avoidHighways === 'true') avoid.push('controlledAccessHighway');
    if (avoid.length > 0) {
      params.append('avoid[features]', avoid.join(','));
    }

    // Add waypoints
    if (waypoints) {
      const waypointList = (waypoints as string).split('|');
      waypointList.forEach((wp, index) => {
        params.append(`via`, wp);
      });
    }

    const response = await axios.get(
      `https://router.hereapi.com/v8/routes?${params}`
    );

    if (!response.data.routes || response.data.routes.length === 0) {
      return res.status(400).json({ error: 'No route found' });
    }

    const route = response.data.routes[0];
    const section = route.sections[0];

    res.json({
      distance: section.summary.length, // meters
      duration: section.summary.duration, // seconds
      polyline: section.polyline,
      sections: route.sections.map((sec: any) => ({
        distance: sec.summary.length,
        duration: sec.summary.duration,
        polyline: sec.polyline,
        departure: sec.departure,
        arrival: sec.arrival,
        actions: sec.actions?.map((action: any) => ({
          instruction: action.instruction,
          duration: action.duration,
          length: action.length,
          direction: action.direction,
        })),
      })),
      notices: route.notices?.map((notice: any) => ({
        code: notice.code,
        title: notice.title,
        severity: notice.severity,
      })),
    });
  } catch (error: any) {
    console.error('HERE routing error:', error.message);
    res.status(500).json({ error: 'Failed to calculate RV route' });
  }
});

// ============================================
// GEOCODING
// ============================================

// Reverse geocode coordinates to address
router.get('/geocode/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      res.json({ address: response.data.results[0].formatted_address });
    } else {
      res.json({ address: null });
    }
  } catch (error: any) {
    res.json({ address: null });
  }
});

// ============================================
// THINGS TO DO ALONG ROUTE
// ============================================

// Find places along a route
router.get('/places-along-route', async (req, res) => {
  try {
    const { lat, lng, radius, types } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Location required' });
    }

    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: (radius as string) || '16000', // default 10 miles
      key: GOOGLE_MAPS_API_KEY!,
    });

    if (types) {
      params.append('type', (types as string).split(',')[0]); // Use first type
    }

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`
    );

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      return res.status(400).json({ error: response.data.status });
    }

    const places = response.data.results.map((place: any) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      rating: place.rating,
      totalRatings: place.user_ratings_total,
      types: place.types,
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      },
      photos: place.photos?.slice(0, 3).map((photo: any) => 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
      ),
      priceLevel: place.price_level,
      isOpen: place.opening_hours?.open_now,
    }));

    res.json({ places });
  } catch (error: any) {
    console.error('Places search error:', error.message);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

// ============================================
// TRUCK STOPS & REST AREAS
// ============================================

// Get truck stops within bounding box
router.get('/truck-stops', async (req, res) => {
  try {
    const { minLat, maxLat, minLng, maxLng } = req.query;

    const truckStops = await prisma.truckStop.findMany({
      where: {
        latitude: {
          gte: parseFloat(minLat as string),
          lte: parseFloat(maxLat as string),
        },
        longitude: {
          gte: parseFloat(minLng as string),
          lte: parseFloat(maxLng as string),
        },
      },
      take: 100,
    });

    res.json({ truckStops });
  } catch (error: any) {
    console.error('Truck stops error:', error);
    res.status(500).json({ error: 'Failed to fetch truck stops' });
  }
});

// Get rest areas within bounding box
router.get('/rest-areas', async (req, res) => {
  try {
    const { minLat, maxLat, minLng, maxLng } = req.query;

    const restAreas = await prisma.restArea.findMany({
      where: {
        latitude: {
          gte: parseFloat(minLat as string),
          lte: parseFloat(maxLat as string),
        },
        longitude: {
          gte: parseFloat(minLng as string),
          lte: parseFloat(maxLng as string),
        },
      },
      take: 100,
    });

    res.json({ restAreas });
  } catch (error: any) {
    console.error('Rest areas error:', error);
    res.status(500).json({ error: 'Failed to fetch rest areas' });
  }
});

// ============================================
// TRIP SAVING
// ============================================

// Save a planned route as a trip
router.post('/trips/from-route', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      name,
      origin,
      destination,
      originCoords,
      destCoords,
      waypoints,
      routeInfo,
      campgroundId,
    } = req.body;

    // Create the trip
    const trip = await prisma.trip.create({
      data: {
        name,
        userId,
        campgroundId: campgroundId ? parseInt(campgroundId) : null,
        startDate: new Date(), // User can edit this later
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
        routeData: JSON.stringify({
          origin,
          destination,
          originCoords,
          destCoords,
          waypoints,
          routeInfo,
        }),
      },
    });

    // Create waypoint stops
    if (waypoints && waypoints.length > 0) {
      await prisma.tripStop.createMany({
        data: waypoints.map((wp: any, index: number) => ({
          tripId: trip.id,
          name: wp.name,
          latitude: wp.location.lat,
          longitude: wp.location.lng,
          stopOrder: index + 1,
          duration: wp.duration,
          type: wp.type,
        })),
      });
    }

    res.json(trip);
  } catch (error: any) {
    console.error('Save trip error:', error);
    res.status(500).json({ error: 'Failed to save trip' });
  }
});

// Get saved trip with route data
router.get('/trips/:id/route', async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        campground: true,
        stops: {
          orderBy: { stopOrder: 'asc' },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const routeData = trip.routeData ? JSON.parse(trip.routeData as string) : null;

    res.json({
      ...trip,
      routeData,
    });
  } catch (error: any) {
    console.error('Get trip route error:', error);
    res.status(500).json({ error: 'Failed to fetch trip route' });
  }
});

// ============================================
// USER FAVORITES FOR BASECAMP MAP
// ============================================

// Get user's favorited campgrounds
router.get('/users/:userId/favorites', async (req, res) => {
  try {
    const userId = req.params.userId;

    const favorites = await prisma.campgroundFollow.findMany({
      where: { userId },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            location: true,
            state: true,
            imageUrl: true,
          },
        },
      },
    });

    res.json({
      favorites: favorites.map((f: any) => f.campground),
    });
  } catch (error: any) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Get user's upcoming trips
router.get('/users/:userId/trips', async (req, res) => {
  try {
    const userId = req.params.userId;
    const upcoming = req.query.upcoming === 'true';

    const whereClause: any = { userId };
    if (upcoming) {
      whereClause.startDate = { gte: new Date() };
    }

    const trips = await prisma.trip.findMany({
      where: whereClause,
      include: {
        stays: {
          include: {
            campground: {
              select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
                location: true,
                state: true,
              },
            },
          },
        },
      },
      orderBy: { startDate: 'asc' },
      take: 20,
    });
    
    // Transform to include campground from first stay
    const transformedTrips = trips.map((trip: any) => ({
      ...trip,
      campground: trip.stays[0]?.campground || null,
    }));

    res.json({ trips: transformedTrips });
  } catch (error: any) {
    console.error('Get trips error:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Get friends' recent check-ins
router.get('/users/:userId/friends/checkins', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { initiatorId: userId, status: "ACCEPTED" },
          { receiverId: userId, status: "ACCEPTED" },
        ],
      },
      select: {
        initiatorId: true,
        receiverId: true,
      },
    });

    const friendIds = friendships.map((f: any) => 
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    if (friendIds.length === 0) {
      return res.json({ checkIns: [] });
    }

    // Get recent check-ins from friends (active or within last 30 days)
    const checkIns = await prisma.checkIn.findMany({
      where: {
        userId: { in: friendIds },
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            location: true,
            state: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({ checkIns });
  } catch (error: any) {
    console.error('Get friend check-ins error:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

export default router;
