import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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

    // Fetch Google Places gas stations along route
    const googleGasStations: any[] = [];
    const seenPlaceIds = new Set<string>();
    
    if (GOOGLE_MAPS_API_KEY) {
      // Sample every 30th point to reduce API calls
      const sampledPoints = routePoints.filter((_: any, i: number) => i % 30 === 0).slice(0, 8);
      
      for (const point of sampledPoints) {
        try {
          const params = new URLSearchParams({
            location: `${point.lat},${point.lng}`,
            radius: (maxDistance * 1609.34).toString(),
            type: 'gas_station',
            key: GOOGLE_MAPS_API_KEY
          });
          
          const response = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`);
          const data = await response.json();
          
          if (data.results) {
            for (const place of data.results) {
              if (!seenPlaceIds.has(place.place_id)) {
                seenPlaceIds.add(place.place_id);
                googleGasStations.push({
                  id: place.place_id,
                  name: place.name,
                  brand: place.name.split(' ')[0],
                  latitude: place.geometry.location.lat,
                  longitude: place.geometry.location.lng,
                  address: place.vicinity,
                  city: '',
                  state: '',
                  rating: place.rating,
                  isOpen: place.opening_hours?.open_now,
                  photo: place.photos?.[0]?.photo_reference
                    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
                    : null,
                  source: 'google',
                  hasRVParking: false,
                  hasShowers: false,
                  hasDumpStation: false,
                  hasPropane: false,
                  hasRestaurant: false,
                });
              }
            }
          }
        } catch (err) {
          console.error('Google gas station fetch error:', err);
        }
      }
    }

    // Combine database + Google gas stations
    const allGasStations = [
      ...nearbyGasStations.map(s => ({ ...s, source: 'database' })),
      ...googleGasStations
    ];

    res.json({
      gasStations: allGasStations,
      restStops: nearbyRestStops,
      counts: {
        gasStations: allGasStations.length,
        restStops: nearbyRestStops.length,
        fromDatabase: nearbyGasStations.length,
        fromGoogle: googleGasStations.length,
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



// POST /api/drive-planner/smart-stops - Get intelligent stop suggestions along a route
router.post('/smart-stops', async (req: Request, res: Response) => {
  try {
    const { 
      polyline,
      totalMiles,
      totalMinutes,
      mpg = 10,
      tankGallons = 50,
      drivingHoursPerDay = 8,
      stopTypes = ['gas', 'overnight', 'food'],
      foodIntervalMiles = 150
    } = req.body;

    if (!polyline || !totalMiles) {
      return res.status(400).json({ error: 'Polyline and totalMiles required' });
    }

    const routePoints = decodePolyline(polyline);
    if (routePoints.length === 0) {
      return res.status(400).json({ error: 'Could not decode polyline' });
    }

    // Calculate stop intervals
    const gasRange = Math.floor(mpg * tankGallons * 0.70); // Stop at 30% remaining
    const avgSpeedMph = totalMiles / (totalMinutes / 60);
    const dailyMiles = avgSpeedMph * drivingHoursPerDay;
    const tripDays = Math.ceil(totalMiles / dailyMiles);

    const gasStopPoints = sampleRoutePoints(routePoints, totalMiles, gasRange);
    const overnightStopPoints = tripDays > 1 ? sampleRoutePoints(routePoints, totalMiles, dailyMiles) : [];
    const foodStopPoints = foodIntervalMiles > 0 ? sampleRoutePoints(routePoints, totalMiles, foodIntervalMiles) : [];

    const allStops: any[] = [];

    // Gas stations
    if (stopTypes.includes('gas')) {
      for (let i = 0; i < gasStopPoints.length; i++) {
        const point = gasStopPoints[i];
        try {
          const stations = await searchNearbyPlaces(point.lat, point.lng, 'gas_station', 8000, 3);
          allStops.push({
            type: 'GAS',
            milesFromStart: point.milesFromStart,
            suggestedStopNumber: i + 1,
            reason: `Refuel (~${Math.round(point.milesFromStart)} mi, every ${gasRange} mi)`,
            places: stations.map(formatPlace)
          });
        } catch (e) { console.error('Gas search error:', e); }
      }
    }

    // Overnight campgrounds + free parking
    if (stopTypes.includes('overnight') && overnightStopPoints.length > 0) {
      for (let i = 0; i < overnightStopPoints.length; i++) {
        const point = overnightStopPoints[i];
        try {
          const campgrounds = await searchNearbyPlaces(point.lat, point.lng, 'campground', 30000, 5, 'rv park campground');
          const walmarts = await searchNearbyPlaces(point.lat, point.lng, 'department_store', 15000, 3, 'walmart supercenter');
          const crackerBarrels = await searchNearbyPlaces(point.lat, point.lng, 'restaurant', 15000, 2, 'cracker barrel');
          const cabelas = await searchNearbyPlaces(point.lat, point.lng, 'store', 15000, 2, 'cabelas bass pro');

          allStops.push({
            type: 'OVERNIGHT',
            milesFromStart: point.milesFromStart,
            day: i + 1,
            reason: `Night ${i + 1} stop (~${Math.round(drivingHoursPerDay)}hrs driving)`,
            campgrounds: campgrounds.map(formatPlace),
            freeParking: [
              ...walmarts.map((s: any) => ({ ...formatPlace(s), parkingType: 'Walmart', note: 'Call ahead - not all locations allow overnight RV parking' })),
              ...crackerBarrels.map((s: any) => ({ ...formatPlace(s), parkingType: 'Cracker Barrel', note: 'Known for allowing overnight RV parking - ask inside' })),
              ...cabelas.map((s: any) => ({ ...formatPlace(s), parkingType: 'Cabelas/Bass Pro', note: 'Most locations welcome overnight RV parking' })),
            ]
          });
        } catch (e) { console.error('Overnight search error:', e); }
      }
    }

    // Food & rest stops
    if (stopTypes.includes('food')) {
      for (let i = 0; i < foodStopPoints.length; i++) {
        const point = foodStopPoints[i];
        try {
          const restaurants = await searchNearbyPlaces(point.lat, point.lng, 'restaurant', 8000, 3);
          const restAreas = await searchNearbyPlaces(point.lat, point.lng, 'parking', 15000, 2, 'rest area rest stop');
          allStops.push({
            type: 'FOOD_REST',
            milesFromStart: point.milesFromStart,
            reason: `Rest/food stop (~${Math.round(point.milesFromStart)} mi)`,
            restaurants: restaurants.slice(0, 3).map(formatPlace),
            restAreas: restAreas.map(formatPlace)
          });
        } catch (e) { console.error('Food search error:', e); }
      }
    }

    // Dump stations
    if (stopTypes.includes('dump')) {
      const dumpPoints = sampleRoutePoints(routePoints, totalMiles, 200);
      for (const point of dumpPoints) {
        try {
          const dumps = await searchNearbyPlaces(point.lat, point.lng, 'point_of_interest', 30000, 3, 'rv dump station sanitary');
          if (dumps.length > 0) {
            allStops.push({
              type: 'DUMP_STATION',
              milesFromStart: point.milesFromStart,
              reason: `Dump station (~${Math.round(point.milesFromStart)} mi)`,
              places: dumps.map(formatPlace)
            });
          }
        } catch (e) { console.error('Dump search error:', e); }
      }
    }


    // Attractions & points of interest along route
    if (stopTypes.includes('attractions')) {
      const attractionPoints = sampleRoutePoints(routePoints, totalMiles, 100);
      for (const point of attractionPoints) {
        try {
          const attractions = await searchNearbyPlaces(point.lat, point.lng, 'tourist_attraction', 15000, 3);
          const parks = await searchNearbyPlaces(point.lat, point.lng, 'park', 15000, 2, 'state park national park');
          const museums = await searchNearbyPlaces(point.lat, point.lng, 'museum', 15000, 2);
          const allAttractions = [...attractions, ...parks, ...museums];
          const seen = new Set<string>();
          const unique = allAttractions.filter((a: any) => {
            if (seen.has(a.place_id)) return false;
            seen.add(a.place_id);
            return true;
          });
          if (unique.length > 0) {
            allStops.push({
              type: 'ATTRACTION',
              milesFromStart: point.milesFromStart,
              reason: `Worth a stop (~${Math.round(point.milesFromStart)} mi)`,
              places: unique.slice(0, 5).map(formatPlace)
            });
          }
        } catch (e) { console.error('Attraction search error:', e); }
      }
    }
    allStops.sort((a: any, b: any) => a.milesFromStart - b.milesFromStart);

    // Look up average gas price from states along route
    let avgGasPrice = 3.50; // fallback
    try {
      const allPrices = await prisma.stateGasPrice.findMany();
      if (allPrices.length > 0) {
        // Get states the route passes through using sample points
        const samplePoints = [routePoints[0], ...gasStopPoints.map(p => ({ lat: p.lat, lng: p.lng })), routePoints[routePoints.length - 1]];
        // Use average of all state prices as approximation (route may cross multiple states)
        const totalRegular = allPrices.reduce((sum: number, p: any) => sum + p.regularPrice, 0);
        avgGasPrice = totalRegular / allPrices.length;
        // If budget priority, find cheapest states; if comfort, use avg
      }
    } catch (e) { console.error('Gas price lookup error:', e); }

    const estimatedGallons = Math.round(totalMiles / mpg);
    const estimatedFuelCost = Math.round(estimatedGallons * avgGasPrice);

    res.json({
      summary: {
        totalMiles: Math.round(totalMiles),
        totalDays: tripDays,
        gasRange,
        gasStopsNeeded: gasStopPoints.length,
        overnightStopsNeeded: overnightStopPoints.length,
        estimatedFuelCost,
        estimatedGallons,
        avgGasPrice: parseFloat(avgGasPrice.toFixed(2)),
      },
      stops: allStops,
    });
  } catch (error) {
    console.error('Smart stops error:', error);
    res.status(500).json({ error: 'Failed to calculate smart stops' });
  }
});

// Helper: Format a Google Places result
function formatPlace(place: any) {
  return {
    name: place.name,
    address: place.vicinity || place.formatted_address || '',
    lat: place.geometry?.location?.lat,
    lng: place.geometry?.location?.lng,
    rating: place.rating,
    totalRatings: place.user_ratings_total,
    isOpen: place.opening_hours?.open_now,
    placeId: place.place_id,
    priceLevel: place.price_level,
    photoRef: place.photos?.[0]?.photo_reference,
  };
}

// Helper: Sample points along a decoded polyline at mile intervals
function sampleRoutePoints(
  routePoints: Array<{lat: number, lng: number}>, 
  totalMiles: number, 
  intervalMiles: number
): Array<{lat: number, lng: number, milesFromStart: number}> {
  const samples: Array<{lat: number, lng: number, milesFromStart: number}> = [];
  let nextStopMiles = intervalMiles;
  let accumulatedMiles = 0;
  
  for (let i = 1; i < routePoints.length; i++) {
    const segmentMiles = haversineDistance(
      routePoints[i-1].lat, routePoints[i-1].lng,
      routePoints[i].lat, routePoints[i].lng
    );
    accumulatedMiles += segmentMiles;
    
    if (accumulatedMiles >= nextStopMiles && nextStopMiles < totalMiles - 30) {
      samples.push({
        lat: routePoints[i].lat,
        lng: routePoints[i].lng,
        milesFromStart: Math.round(accumulatedMiles)
      });
      nextStopMiles += intervalMiles;
    }
  }
  return samples;
}


// Helper: Search Google Places nearby
async function searchNearbyPlaces(
  lat: number, lng: number, type: string, 
  radius: number = 8000, maxResults: number = 5, keyword?: string
): Promise<any[]> {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: radius.toString(),
    type,
    key: GOOGLE_MAPS_API_KEY || ''
  });
  if (keyword) params.append('keyword', keyword);
  try {
    const response = await fetch(`${GOOGLE_PLACES_URL}?${params}`);
    const data = await response.json();
    return (data.results || []).slice(0, maxResults);
  } catch (e) {
    console.error('Places search error:', e);
    return [];
  }
}


export default router;

// ============================================
// GOOGLE MAPS INTEGRATION
// ============================================

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const GOOGLE_PLACES_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

// Google Directions API - Get route with traffic
router.post('/google-route', async (req: Request, res: Response) => {
  try {
    const { origin, destination, waypoints, avoidTolls, avoidHighways } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    const params = new URLSearchParams({
      origin: typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`,
      destination: typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`,
      key: GOOGLE_MAPS_API_KEY || '',
      departure_time: 'now',
      traffic_model: 'best_guess',
      units: 'imperial'
    });

    if (waypoints && waypoints.length > 0) {
      const waypointStr = waypoints.map((wp: any) => 
        typeof wp === 'string' ? wp : `${wp.lat},${wp.lng}`
      ).join('|');
      params.append('waypoints', waypointStr);
    }

    const avoid: string[] = [];
    if (avoidTolls) avoid.push('tolls');
    if (avoidHighways) avoid.push('highways');
    if (avoid.length > 0) params.append('avoid', avoid.join('|'));

    const response = await fetch(`${GOOGLE_DIRECTIONS_URL}?${params}`);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Directions error:', data.status, data.error_message);
      return res.status(400).json({ error: data.error_message || 'Failed to get directions' });
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Decode polyline to get route points
    const routePoints = decodePolyline(route.overview_polyline.points);

    res.json({
      success: true,
      provider: 'google',
      distance: {
        text: leg.distance.text,
        meters: leg.distance.value,
        miles: (leg.distance.value / 1609.34).toFixed(1)
      },
      duration: {
        text: leg.duration.text,
        seconds: leg.duration.value,
        minutes: Math.round(leg.duration.value / 60)
      },
      durationInTraffic: leg.duration_in_traffic ? {
        text: leg.duration_in_traffic.text,
        seconds: leg.duration_in_traffic.value,
        minutes: Math.round(leg.duration_in_traffic.value / 60)
      } : null,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      startLocation: leg.start_location,
      endLocation: leg.end_location,
      routePoints,
      bounds: route.bounds,
      polyline: route.overview_polyline.points,
      steps: leg.steps.map((step: any) => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
        distance: step.distance.text,
        duration: step.duration.text,
        maneuver: step.maneuver
      }))
    });
  } catch (error) {
    console.error('Google route error:', error);
    res.status(500).json({ error: 'Failed to get route' });
  }
});

// Decode Google polyline
function decodePolyline(encoded: string): Array<{lat: number, lng: number}> {
  const points: Array<{lat: number, lng: number}> = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Find attractions along route using Things to Do system
router.post('/attractions-along-route', async (req: Request, res: Response) => {
  try {
    const { routePoints, maxDistanceMiles = 10, types } = req.body;

    if (!routePoints || routePoints.length < 2) {
      return res.status(400).json({ error: 'Route points are required' });
    }

    // Sample route points (every 20th point to reduce API calls)
    const sampledPoints = routePoints.filter((_: any, i: number) => i % 20 === 0);
    
    // Search for places near each sampled point
    const allPlaces: any[] = [];
    const seenPlaceIds = new Set<string>();
    const searchTypes = types || ['tourist_attraction', 'park', 'restaurant', 'gas_station'];

    for (const point of sampledPoints.slice(0, 10)) { // Limit to 10 search points
      for (const type of searchTypes) {
        try {
          const params = new URLSearchParams({
            location: `${point.lat},${point.lng}`,
            radius: (maxDistanceMiles * 1609.34).toString(), // Convert to meters
            type,
            key: GOOGLE_MAPS_API_KEY || ''
          });

          const response = await fetch(`${GOOGLE_PLACES_URL}?${params}`);
          const data = await response.json();

          if (data.results) {
            for (const place of data.results) {
              if (!seenPlaceIds.has(place.place_id)) {
                seenPlaceIds.add(place.place_id);
                
                // Calculate distance from route
                const minDist = Math.min(...routePoints.map((rp: any) => 
                  haversineDistance(rp.lat, rp.lng, place.geometry.location.lat, place.geometry.location.lng)
                ));

                if (minDist <= maxDistanceMiles) {
                  allPlaces.push({
                    placeId: place.place_id,
                    name: place.name,
                    address: place.vicinity,
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng,
                    types: place.types,
                    rating: place.rating,
                    reviewCount: place.user_ratings_total,
                    priceLevel: place.price_level,
                    isOpen: place.opening_hours?.open_now,
                    photo: place.photos?.[0]?.photo_reference 
                      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
                      : null,
                    distanceFromRoute: Math.round(minDist * 10) / 10,
                    sourceUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error('Place search error:', err);
        }
      }
    }

    // Sort by distance from route
    allPlaces.sort((a, b) => a.distanceFromRoute - b.distanceFromRoute);

    // Categorize
    const categorized = {
      attractions: allPlaces.filter(p => 
        p.types.some((t: string) => ['tourist_attraction', 'museum', 'park', 'amusement_park', 'zoo', 'aquarium'].includes(t))
      ).slice(0, 15),
      restaurants: allPlaces.filter(p => 
        p.types.some((t: string) => ['restaurant', 'cafe', 'bakery', 'meal_takeaway'].includes(t))
      ).slice(0, 15),
      gasStations: allPlaces.filter(p => 
        p.types.includes('gas_station')
      ).slice(0, 10),
      hotels: allPlaces.filter(p => 
        p.types.some((t: string) => ['lodging', 'rv_park', 'campground'].includes(t))
      ).slice(0, 10)
    };

    res.json({
      total: allPlaces.length,
      ...categorized
    });
  } catch (error) {
    console.error('Attractions along route error:', error);
    res.status(500).json({ error: 'Failed to find attractions' });
  }
});

// Save attraction as waypoint to trip
router.post('/add-waypoint', async (req: Request, res: Response) => {
  try {
    const { tripId, placeId, name, lat, lng, address, type, estimatedStopMinutes = 30 } = req.body;

    if (!tripId || !name || !lat || !lng) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if SavedTrip has waypoints field, if not we'll store in notes
    const trip = await prisma.savedTrip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get existing waypoints from trip data or initialize
    const existingWaypoints = (trip as any).waypoints || [];
    const newWaypoint = {
      id: `wp_${Date.now()}`,
      placeId,
      name,
      lat,
      lng,
      address,
      type,
      estimatedStopMinutes,
      addedAt: new Date().toISOString()
    };

    // Update trip with new waypoint
    const updated = await prisma.savedTrip.update({
      where: { id: tripId },
      data: {
        notes: JSON.stringify([...existingWaypoints, newWaypoint])
      }
    });

    res.json({ success: true, waypoint: newWaypoint, trip: updated });
  } catch (error) {
    console.error('Add waypoint error:', error);
    res.status(500).json({ error: 'Failed to add waypoint' });
  }
});

// Get route with waypoints and recalculate time
router.post('/route-with-waypoints', async (req: Request, res: Response) => {
  try {
    const { origin, destination, waypoints, provider = 'google' } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination required' });
    }

    if (provider === 'google') {
      const params = new URLSearchParams({
        origin: typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`,
        destination: typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`,
        key: GOOGLE_MAPS_API_KEY || '',
        departure_time: 'now',
        units: 'imperial'
      });

      if (waypoints && waypoints.length > 0) {
        const waypointStr = waypoints.map((wp: any) => `${wp.lat},${wp.lng}`).join('|');
        params.append('waypoints', waypointStr);
      }

      const response = await fetch(`${GOOGLE_DIRECTIONS_URL}?${params}`);
      const data = await response.json();

      if (data.status !== 'OK') {
        return res.status(400).json({ error: 'Failed to calculate route' });
      }

      const route = data.routes[0];
      let totalDistance = 0;
      let totalDuration = 0;
      const legs = route.legs.map((leg: any, i: number) => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
        return {
          from: leg.start_address,
          to: leg.end_address,
          distance: leg.distance.text,
          duration: leg.duration.text,
          waypointIndex: i
        };
      });

      // Add estimated stop times
      const stopTime = waypoints ? waypoints.reduce((sum: number, wp: any) => sum + (wp.estimatedStopMinutes || 30), 0) : 0;

      res.json({
        totalDistance: {
          text: `${(totalDistance / 1609.34).toFixed(1)} mi`,
          miles: (totalDistance / 1609.34).toFixed(1)
        },
        totalDrivingTime: {
          text: `${Math.round(totalDuration / 60)} min`,
          minutes: Math.round(totalDuration / 60)
        },
        totalStopTime: {
          text: `${stopTime} min`,
          minutes: stopTime
        },
        totalTripTime: {
          text: `${Math.round((totalDuration / 60) + stopTime)} min`,
          minutes: Math.round(totalDuration / 60) + stopTime
        },
        legs,
        polyline: route.overview_polyline.points,
        routePoints: decodePolyline(route.overview_polyline.points)
      });
    } else {
      // Use HERE Maps
      // ... existing HERE implementation
      res.status(400).json({ error: 'HERE waypoints not implemented yet' });
    }
  } catch (error) {
    console.error('Route with waypoints error:', error);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
});
