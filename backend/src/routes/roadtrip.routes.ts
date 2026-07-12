import { Router, Request, Response } from 'express';
// @ts-ignore
import { authenticateToken } from '../middleware/auth';

const router = Router();
import { prisma } from '../lib/prisma';

// ============================================
// GAS PRICES BY STATE
// ============================================

// GET /api/roadtrip/gas-prices - Get all state gas prices
router.get('/gas-prices', async (req: Request, res: Response) => {
  try {
    const prices = await prisma.stateGasPrice.findMany({
      orderBy: { stateCode: 'asc' },
    });
    res.json(prices);
  } catch (error: any) {
    console.error('Get gas prices error:', error);
    res.status(500).json({ error: 'Failed to fetch gas prices' });
  }
});

// GET /api/roadtrip/gas-prices/:stateCode - Get gas price for specific state
router.get('/gas-prices/:stateCode', async (req: Request, res: Response) => {
  try {
    const { stateCode } = req.params;
    const price = await prisma.stateGasPrice.findUnique({
      where: { stateCode: stateCode.toUpperCase() },
    });
    
    if (!price) {
      return res.status(404).json({ error: 'State not found' });
    }
    
    res.json(price);
  } catch (error: any) {
    console.error('Get state gas price error:', error);
    res.status(500).json({ error: 'Failed to fetch gas price' });
  }
});

// ============================================
// GAS STATIONS
// ============================================

// GET /api/roadtrip/gas-stations - Get gas stations with filters
router.get('/gas-stations', async (req: Request, res: Response) => {
  try {
    const { 
      state, 
      interstate, 
      brand,
      hasRVParking,
      hasDumpStation,
      hasPropane,
      limit = '5000',
      // Bounding box for map view
      minLat,
      maxLat,
      minLng,
      maxLng,
    } = req.query;

    const where: any = {};

    if (state) {
      where.state = (state as string).toUpperCase();
    }

    if (interstate) {
      where.interstate = interstate as string;
    }

    if (brand) {
      where.brand = brand as string;
    }

    if (hasRVParking === 'true') {
      where.hasRVParking = true;
    }

    if (hasDumpStation === 'true') {
      where.hasDumpStation = true;
    }

    if (hasPropane === 'true') {
      where.hasPropane = true;
    }

    // Bounding box filter for map view
    if (minLat && maxLat && minLng && maxLng) {
      where.latitude = {
        gte: parseFloat(minLat as string),
        lte: parseFloat(maxLat as string),
      };
      where.longitude = {
        gte: parseFloat(minLng as string),
        lte: parseFloat(maxLng as string),
      };
    }

    const stations = await prisma.gasStation.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: { name: 'asc' },
    });

    res.json(stations);
  } catch (error: any) {
    console.error('Get gas stations error:', error);
    res.status(500).json({ error: 'Failed to fetch gas stations' });
  }
});

// GET /api/roadtrip/gas-stations/nearby - Get nearby gas stations
router.get('/gas-stations/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = '50' } = req.query; // radius in miles

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusMiles = parseFloat(radius as string);

    // Rough bounding box (1 degree ≈ 69 miles)
    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / (69 * Math.cos(latitude * Math.PI / 180));

    const stations = await prisma.gasStation.findMany({
      where: {
        latitude: {
          gte: latitude - latDelta,
          lte: latitude + latDelta,
        },
        longitude: {
          gte: longitude - lngDelta,
          lte: longitude + lngDelta,
        },
      },
      take: 5000,
    });

    // Calculate actual distance and sort
    const withDistance = stations.map((station: any) => ({
      ...station,
      distance: calculateDistance(latitude, longitude, station.latitude, station.longitude),
    })).filter((s: any) => s.distance <= radiusMiles)
      .sort((a: any, b: any) => a.distance - b.distance);

    res.json(withDistance);
  } catch (error: any) {
    console.error('Get nearby gas stations error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby gas stations' });
  }
});

// GET /api/roadtrip/gas-stations/by-interstate/:interstate
router.get('/gas-stations/by-interstate/:interstate', async (req: Request, res: Response) => {
  try {
    const { interstate } = req.params;
    
    const stations = await prisma.gasStation.findMany({
      where: { 
        interstate: interstate.toUpperCase().replace('I-', 'I-'),
      },
      orderBy: { exitNumber: 'asc' },
    });

    res.json(stations);
  } catch (error: any) {
    console.error('Get stations by interstate error:', error);
    res.status(500).json({ error: 'Failed to fetch gas stations' });
  }
});

// ============================================
// REST STOPS
// ============================================

// GET /api/roadtrip/rest-stops - Get rest stops with filters
router.get('/rest-stops', async (req: Request, res: Response) => {
  try {
    const { 
      state, 
      interstate,
      hasRVParking,
      hasDumpStation,
      hasPetArea,
      limit = '5000',
      minLat,
      maxLat,
      minLng,
      maxLng,
    } = req.query;

    const where: any = {};

    if (state) {
      where.state = (state as string).toUpperCase();
    }

    if (interstate) {
      where.interstate = interstate as string;
    }

    if (hasRVParking === 'true') {
      where.hasRVParking = true;
    }

    if (hasDumpStation === 'true') {
      where.hasDumpStation = true;
    }

    if (hasPetArea === 'true') {
      where.hasPetArea = true;
    }

    // Bounding box filter
    if (minLat && maxLat && minLng && maxLng) {
      where.latitude = {
        gte: parseFloat(minLat as string),
        lte: parseFloat(maxLat as string),
      };
      where.longitude = {
        gte: parseFloat(minLng as string),
        lte: parseFloat(maxLng as string),
      };
    }

    const restStops = await prisma.restStop.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: { name: 'asc' },
    });

    res.json(restStops);
  } catch (error: any) {
    console.error('Get rest stops error:', error);
    res.status(500).json({ error: 'Failed to fetch rest stops' });
  }
});

// GET /api/roadtrip/rest-stops/by-interstate/:interstate
router.get('/rest-stops/by-interstate/:interstate', async (req: Request, res: Response) => {
  try {
    const { interstate } = req.params;
    
    const stops = await prisma.restStop.findMany({
      where: { 
        interstate: interstate.toUpperCase().replace('I-', 'I-'),
      },
      orderBy: { mileMarker: 'asc' },
    });

    res.json(stops);
  } catch (error: any) {
    console.error('Get rest stops by interstate error:', error);
    res.status(500).json({ error: 'Failed to fetch rest stops' });
  }
});

// ============================================
// INTERSTATES
// ============================================

// GET /api/roadtrip/interstates - Get list of major interstates
router.get('/interstates', async (req: Request, res: Response) => {
  try {
    const interstates = await prisma.interstate.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(interstates);
  } catch (error: any) {
    console.error('Get interstates error:', error);
    res.status(500).json({ error: 'Failed to fetch interstates' });
  }
});

// ============================================
// COMBINED ROUTE DATA
// ============================================

// GET /api/roadtrip/route-resources - Get gas stations and rest stops along a route
router.get('/route-resources', async (req: Request, res: Response) => {
  try {
    const { interstate, states } = req.query;

    if (!interstate && !states) {
      return res.status(400).json({ error: 'interstate or states required' });
    }

    const where: any = {};
    
    if (interstate) {
      where.interstate = interstate as string;
    }
    
    if (states) {
      where.state = { in: (states as string).split(',').map(s => s.trim().toUpperCase()) };
    }

    const [gasStations, restStops] = await Promise.all([
      prisma.gasStation.findMany({ where, take: 2000 }),
      prisma.restStop.findMany({ where, take: 2000 }),
    ]);

    res.json({
      gasStations,
      restStops,
      counts: {
        gasStations: gasStations.length,
        restStops: restStops.length,
      },
    });
  } catch (error: any) {
    console.error('Get route resources error:', error);
    res.status(500).json({ error: 'Failed to fetch route resources' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
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
