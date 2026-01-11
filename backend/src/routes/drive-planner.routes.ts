import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const HERE_API_KEY = process.env.HERE_API_KEY;
const HERE_ROUTING_URL = 'https://router.hereapi.com/v8/routes';
const HERE_GEOCODE_URL = 'https://geocode.search.hereapi.com/v1/geocode';
const HERE_AUTOCOMPLETE_URL = 'https://autocomplete.search.hereapi.com/v1/autocomplete';

// Geocode an address to coordinates
router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const response = await fetch(
      `${HERE_GEOCODE_URL}?q=${encodeURIComponent(q as string)}&in=countryCode:USA&apiKey=${HERE_API_KEY}`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Geocode error:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// Autocomplete for address search
router.get('/autocomplete', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const response = await fetch(
      `${HERE_AUTOCOMPLETE_URL}?q=${encodeURIComponent(q as string)}&in=countryCode:USA&limit=5&apiKey=${HERE_API_KEY}`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ error: 'Failed to get autocomplete suggestions' });
  }
});

// Calculate route between two points
router.post('/route', async (req: Request, res: Response) => {
  try {
    const { origin, destination, waypoints, transportMode = 'truck' } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    // Build waypoints string
    let waypointParams = '';
    if (waypoints && waypoints.length > 0) {
      waypoints.forEach((wp: { lat: number; lng: number }, index: number) => {
        waypointParams += `&via=${wp.lat},${wp.lng}`;
      });
    }

    // HERE Routing API - using truck mode for RV-friendly routing
    const url = `${HERE_ROUTING_URL}?` +
      `transportMode=${transportMode}` +
      `&origin=${origin.lat},${origin.lng}` +
      `&destination=${destination.lat},${destination.lng}` +
      waypointParams +
      `&return=polyline,summary,actions,instructions` +
      `&spans=names` +
      `&truck[height]=400` + // 4 meters / 13 feet (typical RV height)
      `&truck[width]=250` +  // 2.5 meters / 8 feet
      `&truck[length]=1200` + // 12 meters / 40 feet (large RV)
      `&truck[grossWeight]=10000` + // 10 tons
      `&apiKey=${HERE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json() as any;
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const section = route.sections[0];
      
      res.json({
        route: {
          polyline: section.polyline,
          summary: {
            distance: section.summary.length, // meters
            duration: section.summary.duration, // seconds
            baseDuration: section.summary.baseDuration,
          },
          actions: section.actions,
          instructions: section.turnByTurnActions,
        },
        raw: data,
      });
    } else {
      res.status(400).json({ error: 'No route found', details: data });
    }
  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
});

// Find stops along a route (within X miles of the route polyline)
router.post('/stops-along-route', async (req: Request, res: Response) => {
  try {
    const { routePoints, maxDistance = 10 } = req.body; // maxDistance in miles
    
    if (!routePoints || !Array.isArray(routePoints) || routePoints.length < 2) {
      return res.status(400).json({ error: 'Route points array is required' });
    }

    // Get bounding box of the route with buffer
    const lats = routePoints.map((p: { lat: number; lng: number }) => p.lat);
    const lngs = routePoints.map((p: { lat: number; lng: number }) => p.lng);
    
    const buffer = maxDistance / 69; // Approximate degrees for miles
    const minLat = Math.min(...lats) - buffer;
    const maxLat = Math.max(...lats) + buffer;
    const minLng = Math.min(...lngs) - buffer;
    const maxLng = Math.max(...lngs) + buffer;

    // Get gas stations in bounding box
    const gasStations = await prisma.gasStation.findMany({
      where: {
        latitude: { gte: minLat, lte: maxLat },
        longitude: { gte: minLng, lte: maxLng },
      },
      take: 500,
    });

    // Get rest stops in bounding box
    const restStops = await prisma.restStop.findMany({
      where: {
        latitude: { gte: minLat, lte: maxLat },
        longitude: { gte: minLng, lte: maxLng },
      },
      take: 200,
    });

    // Filter to only include stops actually near the route
    // Using simplified distance check to nearest route point
    const maxDistanceKm = maxDistance * 1.60934;
    
    const nearbyGasStations = gasStations.filter(station => {
      return routePoints.some((point: { lat: number; lng: number }) => {
        const dist = haversineDistance(
          station.latitude,
          station.longitude,
          point.lat,
          point.lng
        );
        return dist <= maxDistanceKm;
      });
    });

    const nearbyRestStops = restStops.filter(stop => {
      return routePoints.some((point: { lat: number; lng: number }) => {
        const dist = haversineDistance(
          stop.latitude,
          stop.longitude,
          point.lat,
          point.lng
        );
        return dist <= maxDistanceKm;
      });
    });

    res.json({
      gasStations: nearbyGasStations,
      restStops: nearbyRestStops,
      counts: {
        gasStations: nearbyGasStations.length,
        restStops: nearbyRestStops.length,
      },
    });
  } catch (error) {
    console.error('Find stops along route error:', error);
    res.status(500).json({ error: 'Failed to find stops along route' });
  }
});

// Get estimated fuel cost for a route
router.post('/fuel-estimate', async (req: Request, res: Response) => {
  try {
    const { distanceMeters, mpg = 10, states } = req.body; // Default 10 mpg for RV
    
    if (!distanceMeters) {
      return res.status(400).json({ error: 'Distance is required' });
    }

    const distanceMiles = distanceMeters / 1609.34;
    const gallonsNeeded = distanceMiles / mpg;

    // Get average diesel price across route states
    let avgPrice = 3.50; // Default
    
    if (states && states.length > 0) {
      const prices = await prisma.stateGasPrice.findMany({
        where: { stateCode: { in: states } },
      });
      
      if (prices.length > 0) {
        avgPrice = prices.reduce((sum, p) => sum + p.dieselPrice, 0) / prices.length;
      }
    }

    const estimatedCost = gallonsNeeded * avgPrice;

    res.json({
      distanceMiles: Math.round(distanceMiles),
      gallonsNeeded: Math.round(gallonsNeeded * 10) / 10,
      avgPricePerGallon: Math.round(avgPrice * 100) / 100,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      mpgUsed: mpg,
    });
  } catch (error) {
    console.error('Fuel estimate error:', error);
    res.status(500).json({ error: 'Failed to estimate fuel cost' });
  }
});

// Haversine distance formula (returns km)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export default router;
