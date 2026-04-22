import { prisma } from '../prisma';

// ── Types ──────────────────────────────────────────────────────

export interface RouteSegment {
  index: number;
  startMile: number;
  endMile: number;
  midLat: number;
  midLon: number;
  weather: SegmentWeather | null;
  fuelStops: NearbyStop[];
  restStops: NearbyStop[];
  overnightStops: NearbyStop[];
  campgrounds: NearbyStop[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
}

export interface SegmentWeather {
  temp: number | null;
  condition: string | null;
  windSpeed: number | null;
  windDirection: string | null;
}

export interface NearbyStop {
  id: string;
  name: string;
  type: 'FUEL' | 'REST' | 'OVERNIGHT' | 'CAMPGROUND' | 'HARVEST_HOST';
  lat: number;
  lon: number;
  distanceFromRoute: number; // miles
  phone?: string | null;
  hasRVParking?: boolean;
  hasDiesel?: boolean;
}

export interface CorridorAnalysis {
  segments: RouteSegment[];
  totalMiles: number;
  totalHours: number;
  routePolyline: string | null;
  riskZones: RiskZone[];
  fuelGaps: FuelGap[];
  stopClusters: StopCluster[];
}

export interface RiskZone {
  startMile: number;
  endMile: number;
  level: 'MEDIUM' | 'HIGH';
  reasons: string[];
}

export interface FuelGap {
  startMile: number;
  endMile: number;
  gapMiles: number;
}

export interface StopCluster {
  mile: number;
  lat: number;
  lon: number;
  stops: NearbyStop[];
}

// ── HERE Polyline Decoder ──────────────────────────────────────
// Decodes HERE flexible polyline encoding into lat/lon pairs

function decodeFlexiblePolyline(encoded: string): { lat: number; lon: number }[] {
  const DECODING_TABLE: number[] = [];
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('').forEach((c, i) => {
    DECODING_TABLE[c.charCodeAt(0)] = i;
  });

  let idx = 0;
  // Read header
  let version = 0;
  let shift = 0;
  let byte: number;
  do {
    byte = DECODING_TABLE[encoded.charCodeAt(idx++)];
    version |= (byte & 0x1F) << shift;
    shift += 5;
  } while (byte >= 32);

  // Read precision
  shift = 0;
  let headerValue = 0;
  do {
    byte = DECODING_TABLE[encoded.charCodeAt(idx++)];
    headerValue |= (byte & 0x1F) << shift;
    shift += 5;
  } while (byte >= 32);

  const precision = headerValue & 0xF;
  const thirdDim = (headerValue >> 4) & 0x7;
  const thirdDimPrecision = (headerValue >> 7) & 0xF;
  const multiplier = Math.pow(10, precision);
  const thirdMultiplier = Math.pow(10, thirdDimPrecision);
  const dimensions = thirdDim ? 3 : 2;

  const points: { lat: number; lon: number }[] = [];
  let lastLat = 0, lastLon = 0, lastZ = 0;

  while (idx < encoded.length) {
    const values: number[] = [];
    for (let d = 0; d < dimensions; d++) {
      let result = 0;
      shift = 0;
      do {
        byte = DECODING_TABLE[encoded.charCodeAt(idx++)];
        result |= (byte & 0x1F) << shift;
        shift += 5;
      } while (byte >= 32);
      // Zigzag decode
      result = (result & 1) ? ~(result >> 1) : (result >> 1);
      values.push(result);
    }
    lastLat += values[0];
    lastLon += values[1];
    if (dimensions === 3) lastZ += values[2];
    points.push({ lat: lastLat / multiplier, lon: lastLon / multiplier });
  }

  return points;
}

// ── Haversine Distance ─────────────────────────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── Segment Route ──────────────────────────────────────────────
// Takes decoded polyline points and total miles, produces segments

function segmentRoute(
  points: { lat: number; lon: number }[],
  totalMiles: number,
  segmentMiles: number = 40 // default ~40 mile segments
): { startMile: number; endMile: number; midLat: number; midLon: number }[] {
  if (points.length < 2) return [];

  // Calculate cumulative distances along the polyline
  const cumDist: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineDistance(
      points[i - 1].lat, points[i - 1].lon,
      points[i].lat, points[i].lon
    ));
  }
  const polylineLength = cumDist[cumDist.length - 1];
  const scale = totalMiles / (polylineLength || 1);

  const segments: { startMile: number; endMile: number; midLat: number; midLon: number }[] = [];
  let startMile = 0;

  while (startMile < totalMiles) {
    const endMile = Math.min(startMile + segmentMiles, totalMiles);
    const midMile = (startMile + endMile) / 2;
    const targetDist = midMile / scale;

    // Find closest polyline point to midMile
    let closestIdx = 0;
    for (let i = 1; i < cumDist.length; i++) {
      if (Math.abs(cumDist[i] - targetDist) < Math.abs(cumDist[closestIdx] - targetDist)) {
        closestIdx = i;
      }
    }

    segments.push({
      startMile: Math.round(startMile),
      endMile: Math.round(endMile),
      midLat: points[closestIdx].lat,
      midLon: points[closestIdx].lon,
    });

    startMile = endMile;
  }

  return segments;
}

// ── Fetch Weather at a Point ───────────────────────────────────

async function fetchWeatherAtPoint(lat: number, lon: number): Promise<SegmentWeather | null> {
  try {
    const pointRes = await fetch(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: { 'User-Agent': 'rvunicorn.com' } }
    );
    if (!pointRes.ok) return null;
    const pointData: any = await pointRes.json();
    const forecastUrl = pointData.properties?.forecast;
    if (!forecastUrl) return null;

    const fcRes = await fetch(forecastUrl, { headers: { 'User-Agent': 'rvunicorn.com' } });
    if (!fcRes.ok) return null;
    const fcData: any = await fcRes.json();
    const period = fcData.properties?.periods?.[0];
    if (!period) return null;

    const windMatch = (period.windSpeed || '').match(/(\d+)/);
    return {
      temp: period.temperature ?? null,
      condition: period.shortForecast ?? null,
      windSpeed: windMatch ? parseInt(windMatch[1]) : null,
      windDirection: period.windDirection ?? null,
    };
  } catch {
    return null;
  }
}

// ── Query Nearby Stops ─────────────────────────────────────────
// Uses a bounding box query for speed, then calculates haversine distances

const CORRIDOR_RADIUS_DEG = 0.15; // ~10 miles at mid-latitudes

async function queryNearbyStops(lat: number, lon: number): Promise<{
  fuel: NearbyStop[];
  rest: NearbyStop[];
  overnight: NearbyStop[];
  campgrounds: NearbyStop[];
}> {
  const minLat = lat - CORRIDOR_RADIUS_DEG;
  const maxLat = lat + CORRIDOR_RADIUS_DEG;
  const minLon = lon - CORRIDOR_RADIUS_DEG;
  const maxLon = lon + CORRIDOR_RADIUS_DEG;

  const [gasStations, restStops, overnightStops, campgrounds] = await Promise.all([
    (prisma as any).gasStation.findMany({
      where: { latitude: { gte: minLat, lte: maxLat }, longitude: { gte: minLon, lte: maxLon } },
      take: 10,
      select: { id: true, name: true, latitude: true, longitude: true, phone: true, hasRVParking: true, hasDiesel: true },
    }),
    (prisma as any).restStop.findMany({
      where: { latitude: { gte: minLat, lte: maxLat }, longitude: { gte: minLon, lte: maxLon } },
      take: 10,
      select: { id: true, name: true, latitude: true, longitude: true, hasRVParking: true },
    }),
    (prisma as any).overnightStop.findMany({
      where: { latitude: { gte: minLat, lte: maxLat }, longitude: { gte: minLon, lte: maxLon }, allowsRvs: true },
      take: 10,
      select: { id: true, name: true, latitude: true, longitude: true, phone: true },
    }),
    prisma.campground.findMany({
      where: { latitude: { gte: minLat, lte: maxLat }, longitude: { gte: minLon, lte: maxLon } },
      take: 5,
      select: { id: true, name: true, latitude: true, longitude: true, phone: true },
    }),
  ]);

  const toNearbyStop = (item: any, type: NearbyStop['type']): NearbyStop => ({
    id: item.id,
    name: item.name,
    type,
    lat: item.latitude,
    lon: item.longitude,
    distanceFromRoute: Math.round(haversineDistance(lat, lon, item.latitude, item.longitude) * 10) / 10,
    phone: item.phone ?? null,
    hasRVParking: item.hasRVParking ?? undefined,
    hasDiesel: item.hasDiesel ?? undefined,
  });

  return {
    fuel: gasStations.map((s: any) => toNearbyStop(s, 'FUEL')),
    rest: restStops.map((s: any) => toNearbyStop(s, 'REST')),
    overnight: overnightStops.map((s: any) => toNearbyStop(s, 'OVERNIGHT')),
    campgrounds: campgrounds.map((s: any) => toNearbyStop(s, 'CAMPGROUND')),
  };
}

// ── Main: Build Corridor Analysis ──────────────────────────────

const HERE_API_KEY = process.env.HERE_API_KEY;
const HERE_ROUTING_URL = 'https://router.hereapi.com/v8/routes';

export async function buildCorridorAnalysis(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
): Promise<CorridorAnalysis> {
  let totalMiles = 0;
  let totalHours = 0;
  let routePolyline: string | null = null;
  let polylinePoints: { lat: number; lon: number }[] = [];

  // 1. Get truck route from HERE with polyline
  if (HERE_API_KEY) {
    try {
      const url = `${HERE_ROUTING_URL}?transportMode=truck&origin=${originLat},${originLon}&destination=${destLat},${destLon}&return=summary,polyline&truck[height]=400&truck[width]=250&truck[length]=1200&truck[grossWeight]=10000&apiKey=${HERE_API_KEY}`;
      const res = await fetch(url);
      const data: any = await res.json();
      const section = data.routes?.[0]?.sections?.[0];
      if (section?.summary) {
        totalMiles = Math.round(section.summary.length / 1609.34);
        totalHours = Math.round((section.summary.duration / 3600) * 10) / 10;
      }
      if (section?.polyline) {
        routePolyline = section.polyline;
        polylinePoints = decodeFlexiblePolyline(section.polyline);
      }
    } catch (e: any) {
      console.error('[RouteCorridor] HERE routing error:', e.message);
    }
  }

  // Fallback if HERE fails
  if (!totalMiles) {
    totalMiles = Math.round(haversineDistance(originLat, originLon, destLat, destLon) * 1.3);
    totalHours = Math.round((totalMiles / 50) * 10) / 10;
    // Generate simple straight-line points
    const steps = Math.max(2, Math.ceil(totalMiles / 40));
    polylinePoints = Array.from({ length: steps + 1 }, (_, i) => ({
      lat: originLat + (destLat - originLat) * (i / steps),
      lon: originLon + (destLon - originLon) * (i / steps),
    }));
  }

  // 2. Segment the route
  const rawSegments = segmentRoute(polylinePoints, totalMiles);

  // 3. Evaluate each segment (concurrency-limited weather fetches)
  const CONCURRENCY = 3;
  const segments: RouteSegment[] = [];

  for (let i = 0; i < rawSegments.length; i += CONCURRENCY) {
    const batch = rawSegments.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (seg, batchIdx) => {
        const idx = i + batchIdx;
        const [weather, stops] = await Promise.all([
          fetchWeatherAtPoint(seg.midLat, seg.midLon),
          queryNearbyStops(seg.midLat, seg.midLon),
        ]);

        // Determine risk level
        const riskFactors: string[] = [];
        if (weather?.windSpeed && weather.windSpeed > 30) {
          riskFactors.push(`High wind ${weather.windSpeed}mph near mile ${seg.startMile}-${seg.endMile}`);
        } else if (weather?.windSpeed && weather.windSpeed > 20) {
          riskFactors.push(`Moderate wind ${weather.windSpeed}mph`);
        }
        if (weather?.condition) {
          const cond = weather.condition.toLowerCase();
          if (cond.includes('tornado') || cond.includes('severe')) {
            riskFactors.push(`Severe weather: ${weather.condition}`);
          } else if (cond.includes('thunder')) {
            riskFactors.push(`Thunderstorms: ${weather.condition}`);
          }
        }
        if (weather?.temp !== null && weather?.temp !== undefined && weather.temp < 28) {
          riskFactors.push(`Freezing temps (${weather.temp}°F)`);
        }
        if (stops.fuel.length === 0) {
          riskFactors.push('No fuel stops in this segment');
        }

        const riskLevel = riskFactors.some(r => r.includes('High wind') || r.includes('Severe') || r.includes('Freezing'))
          ? 'HIGH'
          : riskFactors.length > 0
          ? 'MEDIUM'
          : 'LOW';

        return {
          index: idx,
          startMile: seg.startMile,
          endMile: seg.endMile,
          midLat: seg.midLat,
          midLon: seg.midLon,
          weather,
          fuelStops: stops.fuel,
          restStops: stops.rest,
          overnightStops: stops.overnight,
          campgrounds: stops.campgrounds,
          riskLevel,
          riskFactors,
        } satisfies RouteSegment;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        segments.push(result.value);
      }
    }
  }

  // Sort segments by index
  segments.sort((a, b) => a.index - b.index);

  // 4. Derive risk zones (consecutive MEDIUM/HIGH segments)
  const riskZones: RiskZone[] = [];
  let currentZone: RiskZone | null = null;
  for (const seg of segments) {
    if (seg.riskLevel !== 'LOW') {
      if (currentZone) {
        currentZone.endMile = seg.endMile;
        currentZone.reasons.push(...seg.riskFactors);
        if (seg.riskLevel === 'HIGH') currentZone.level = 'HIGH';
      } else {
        currentZone = {
          startMile: seg.startMile,
          endMile: seg.endMile,
          level: seg.riskLevel as 'MEDIUM' | 'HIGH',
          reasons: [...seg.riskFactors],
        };
      }
    } else {
      if (currentZone) {
        currentZone.reasons = [...new Set(currentZone.reasons)];
        riskZones.push(currentZone);
        currentZone = null;
      }
    }
  }
  if (currentZone) {
    currentZone.reasons = [...new Set(currentZone.reasons)];
    riskZones.push(currentZone);
  }

  // 5. Detect fuel gaps (segments with no fuel stops that span > 60 miles)
  const fuelGaps: FuelGap[] = [];
  let gapStart: number | null = null;
  for (const seg of segments) {
    if (seg.fuelStops.length === 0) {
      if (gapStart === null) gapStart = seg.startMile;
    } else {
      if (gapStart !== null) {
        const gapMiles = seg.startMile - gapStart;
        if (gapMiles > 60) {
          fuelGaps.push({ startMile: gapStart, endMile: seg.startMile, gapMiles });
        }
        gapStart = null;
      }
    }
  }
  if (gapStart !== null) {
    const gapMiles = totalMiles - gapStart;
    if (gapMiles > 60) {
      fuelGaps.push({ startMile: gapStart, endMile: totalMiles, gapMiles });
    }
  }

  // 6. Build stop clusters (group stops at each segment midpoint)
  const stopClusters: StopCluster[] = segments
    .filter(s => s.fuelStops.length + s.restStops.length + s.overnightStops.length > 0)
    .map(s => ({
      mile: Math.round((s.startMile + s.endMile) / 2),
      lat: s.midLat,
      lon: s.midLon,
      stops: [...s.fuelStops, ...s.restStops, ...s.overnightStops, ...s.campgrounds],
    }));

  return {
    segments,
    totalMiles,
    totalHours,
    routePolyline,
    riskZones,
    fuelGaps,
    stopClusters,
  };
}

// ── Save Corridor to DB ────────────────────────────────────────

export async function saveCorridorAnalysis(
  userId: string,
  analysis: CorridorAnalysis,
  scores: { overall: number; safety: number; comfort: number; convenience: number; flexibility: number },
  status: string,
  opts?: { eventId?: string; sessionId?: string; headline?: string; flags?: any[]; passedChecks?: string[] },
) {
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

  return (prisma as any).routeCorridorAnalysis.create({
    data: {
      userId,
      eventId: opts?.eventId ?? null,
      sessionId: opts?.sessionId ?? null,
      originLat: analysis.segments[0]?.midLat ?? 0,
      originLon: analysis.segments[0]?.midLon ?? 0,
      destLat: analysis.segments[analysis.segments.length - 1]?.midLat ?? 0,
      destLon: analysis.segments[analysis.segments.length - 1]?.midLon ?? 0,
      totalMiles: analysis.totalMiles,
      totalHours: analysis.totalHours,
      segments: analysis.segments,
      overallScore: scores.overall,
      safetyScore: scores.safety,
      comfortScore: scores.comfort,
      convenienceScore: scores.convenience,
      flexibilityScore: scores.flexibility,
      status,
      headline: opts?.headline ?? null,
      flags: opts?.flags ?? [],
      passedChecks: opts?.passedChecks ?? [],
      routePolyline: analysis.routePolyline,
      expiresAt,
    },
  });
}
