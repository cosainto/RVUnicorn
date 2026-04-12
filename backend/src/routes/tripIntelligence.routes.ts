import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import { generateConfidenceReport } from '../services/tripConfidenceService';

const router = Router();

const HERE_API_KEY = process.env.HERE_API_KEY;
const HERE_ROUTING_URL = 'https://router.hereapi.com/v8/routes';
const HERE_GEOCODE_URL = 'https://geocode.search.hereapi.com/v1/geocode';

const DIESEL_FALLBACK = 3.95;
const GAS_FALLBACK = 3.45;

// ── SESSION ─────────────────────────────────────────────────

router.get('/session', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    const [session, user, activeCheckIn] = await Promise.all([
      (prisma as any).tripIntelligenceSession.findUnique({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { homeLatitude: true, homeLongitude: true, homeCity: true, homeState: true },
      }),
      prisma.checkIn.findFirst({
        where: { userId, isActive: true },
        include: {
          campground: { select: { id: true, name: true, latitude: true, longitude: true, city: true, state: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Upcoming trips (events user organized with future startDate)
    const now = new Date();
    const upcomingTrips = await (prisma as any).event.findMany({
      where: {
        organizerId: userId,
        startDate: { gte: now },
      },
      orderBy: { startDate: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        startDate: true,
        campground: { select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, maxRvLength: true, imageUrl: true } },
      },
    });

    res.json({
      session,
      upcomingTrips: upcomingTrips.map((t: any) => ({
        id: t.id,
        title: t.title,
        departureDate: t.startDate,
        primaryCampground: t.campground,
      })),
      currentCheckIn: activeCheckIn?.campground ? {
        campgroundName: activeCheckIn.campground.name,
        lat: activeCheckIn.campground.latitude,
        lon: activeCheckIn.campground.longitude,
        city: activeCheckIn.campground.city,
        state: activeCheckIn.campground.state,
      } : null,
      homeLocation: user?.homeLatitude && user?.homeLongitude ? {
        label: [user.homeCity, user.homeState].filter(Boolean).join(', ') || 'Home',
        lat: user.homeLatitude,
        lon: user.homeLongitude,
      } : null,
    });
  } catch (e: any) {
    console.error('[TripIntelligence] Session error:', e);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

router.put('/session', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { quickStartLabel, quickStartLat, quickStartLon, quickDestLabel, quickDestLat, quickDestLon, quickDestCampgroundId, mode, activeTripId } = req.body;

    const data: any = {};
    if (quickStartLabel !== undefined) data.quickStartLabel = quickStartLabel;
    if (quickStartLat !== undefined) data.quickStartLat = quickStartLat;
    if (quickStartLon !== undefined) data.quickStartLon = quickStartLon;
    if (quickDestLabel !== undefined) data.quickDestLabel = quickDestLabel;
    if (quickDestLat !== undefined) data.quickDestLat = quickDestLat;
    if (quickDestLon !== undefined) data.quickDestLon = quickDestLon;
    if (quickDestCampgroundId !== undefined) data.quickDestCampgroundId = quickDestCampgroundId;
    if (mode !== undefined) data.mode = mode;
    if (activeTripId !== undefined) data.activeTripId = activeTripId;

    const session = await (prisma as any).tripIntelligenceSession.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    res.json({ session });
  } catch (e: any) {
    console.error('[TripIntelligence] Session update error:', e);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// ── QUICK CHECK ─────────────────────────────────────────────

router.post('/quick-check', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { startLat, startLon, startLabel, destLat, destLon, destLabel, campgroundId } = req.body;

    if (!startLat || !startLon || !destLat || !destLon) {
      return res.status(400).json({ error: 'Start and destination coordinates required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rvMpg: true, rvLength: true, rvHeight: true, rvFuelType: true },
    });

    // 1. Route calculation via HERE
    let driveMiles: number | null = null;
    let driveHours: number | null = null;

    if (HERE_API_KEY) {
      try {
        const url = `${HERE_ROUTING_URL}?transportMode=truck&origin=${startLat},${startLon}&destination=${destLat},${destLon}&return=summary&truck[height]=400&truck[width]=250&truck[length]=1200&truck[grossWeight]=10000&apiKey=${HERE_API_KEY}`;
        const routeRes = await fetch(url);
        const routeData = await routeRes.json() as any;
        if (routeData.routes?.[0]?.sections?.[0]?.summary) {
          const summary = routeData.routes[0].sections[0].summary;
          driveMiles = Math.round(summary.length / 1609.34); // meters to miles
          driveHours = Math.round((summary.duration / 3600) * 10) / 10; // seconds to hours
        }
      } catch (e) {
        console.error('[TripIntelligence] HERE routing error:', e);
      }
    }

    // Fallback: Haversine
    if (!driveMiles) {
      const R = 3958.8;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(destLat - startLat);
      const dLon = toRad(destLon - startLon);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.sin(dLon / 2) ** 2;
      driveMiles = Math.round(2 * R * Math.asin(Math.sqrt(a)) * 1.3);
      driveHours = Math.round((driveMiles / 50) * 10) / 10;
    }

    // 2. Weather at destination
    let weather: any = { departureDay: null, arrivalDay: null };
    try {
      const pointRes = await fetch(`https://api.weather.gov/points/${destLat},${destLon}`, { headers: { 'User-Agent': 'rvunicorn.com' } });
      if (pointRes.ok) {
        const pointData = await pointRes.json();
        const forecastUrl = pointData.properties?.forecast;
        if (forecastUrl) {
          const fcRes = await fetch(forecastUrl, { headers: { 'User-Agent': 'rvunicorn.com' } });
          if (fcRes.ok) {
            const fcData = await fcRes.json();
            const periods = fcData.properties?.periods || [];
            if (periods[0]) {
              const windMatch = (periods[0].windSpeed || '').match(/(\d+)/);
              weather.departureDay = {
                temp: periods[0].temperature,
                condition: periods[0].shortForecast,
                windSpeed: windMatch ? parseInt(windMatch[1]) : null,
              };
            }
            if (periods[1]) {
              const windMatch = (periods[1].windSpeed || '').match(/(\d+)/);
              weather.arrivalDay = {
                temp: periods[1].temperature,
                condition: periods[1].shortForecast,
                windSpeed: windMatch ? parseInt(windMatch[1]) : null,
              };
            }
          }
        }
      }
    } catch {}

    // 3. Rig fit check
    let rigFit: { fits: boolean; maxLength: number | null } | null = null;
    if (campgroundId && user?.rvLength) {
      const cg = await prisma.campground.findUnique({
        where: { id: campgroundId },
        select: { maxRvLength: true },
      });
      if (cg?.maxRvLength) {
        rigFit = { fits: user.rvLength <= cg.maxRvLength, maxLength: cg.maxRvLength };
      }
    }

    // 4. Fuel estimate
    let fuelEstimate: number | null = null;
    let fuelGallons: number | null = null;
    let fuelPricePerGallon: number | null = null;
    if (driveMiles && user?.rvMpg) {
      fuelGallons = Math.round((driveMiles / user.rvMpg) * 10) / 10;
      fuelPricePerGallon = user.rvFuelType === 'diesel' ? DIESEL_FALLBACK : GAS_FALLBACK;
      fuelEstimate = Math.round(fuelGallons * fuelPricePerGallon);
    }

    // 5. Simplified confidence score
    let score = 100;
    const flags: any[] = [];
    const passedChecks: string[] = [];

    // Rig mismatch
    if (rigFit && !rigFit.fits) {
      score -= 40;
      flags.push({ id: 'rig_size', type: 'blocker', severity: 'critical', label: `Your ${user?.rvLength}ft rig exceeds ${rigFit.maxLength}ft limit`, detail: 'This campground cannot accommodate your rig', action: 'Find another campground', deduction: 40 });
    } else if (rigFit?.fits) {
      passedChecks.push(`Rig fits (max ${rigFit.maxLength}ft · yours is ${user?.rvLength}ft)`);
    }

    // Wind
    const windSpeed = weather.departureDay?.windSpeed || weather.arrivalDay?.windSpeed;
    if (windSpeed && windSpeed > 30) {
      score -= 25;
      flags.push({ id: 'wind_high', type: 'warning', severity: 'high', label: `Wind gusts ${windSpeed}mph at destination`, detail: 'High-profile rigs are at risk above 30mph', action: 'Check forecast', deduction: 25 });
    } else if (windSpeed && windSpeed > 20) {
      score -= 10;
      flags.push({ id: 'wind_mod', type: 'warning', severity: 'medium', label: `Wind ${windSpeed}mph at destination`, detail: 'Drive with caution', action: 'Monitor conditions', deduction: 10 });
    } else {
      passedChecks.push('No high-wind advisories');
    }

    // Fatigue
    const recentDrives = await (prisma as any).driveSession.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
      take: 5,
      select: { totalDriveSeconds: true },
    });
    const avgDrive = recentDrives.length > 0
      ? recentDrives.reduce((s: number, d: any) => s + d.totalDriveSeconds / 3600, 0) / recentDrives.length
      : 5;
    const batteryLimit = Math.max(3, Math.min(8, Math.round(avgDrive)));

    if (driveHours && driveHours > batteryLimit) {
      score -= 20;
      flags.push({ id: 'fatigue', type: 'warning', severity: 'high', label: `${driveHours}hr drive exceeds your ${batteryLimit}hr limit`, detail: 'Consider adding rest stops', action: 'Add stops', deduction: 20 });
    } else if (driveHours) {
      passedChecks.push(`Drive time ${driveHours}hrs (within ${batteryLimit}hr limit)`);
    }

    // Missing MPG
    if (!user?.rvMpg) {
      score -= 5;
      flags.push({ id: 'no_mpg', type: 'info', severity: 'low', label: 'Add MPG for fuel estimates', action: 'Update RV profile', actionUrl: '/my-rv', deduction: 5 });
    }

    score = Math.max(0, Math.min(100, score));
    const status = flags.some((f: any) => f.type === 'blocker') ? 'NO_GO' : score >= 80 ? 'GO' : score >= 50 ? 'CAUTION' : 'NO_GO';
    const headline = status === 'GO' ? "You're good to go" : status === 'CAUTION' ? 'Check these first' : 'Issues to resolve';

    res.json({
      driveMiles,
      driveHours,
      fuelEstimate,
      fuelGallons,
      fuelPricePerGallon,
      weather,
      score,
      status,
      headline,
      flags,
      passedChecks,
      rigFit,
    });
  } catch (e: any) {
    console.error('[TripIntelligence] Quick check error:', e);
    res.status(500).json({ error: 'Failed to run quick check' });
  }
});

// ── DESTINATION SEARCH ──────────────────────────────────────

router.get('/destination-search', authenticateToken, async (req: any, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) return res.json({ results: [] });

    const userRvLength = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { rvLength: true },
    });

    // Search campgrounds first
    const campgrounds = await prisma.campground.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { state: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 8,
      select: {
        id: true, name: true, city: true, state: true,
        latitude: true, longitude: true,
        maxRvLength: true, imageUrl: true,
      },
    });

    const results: any[] = campgrounds.map((cg) => ({
      type: 'CAMPGROUND',
      id: cg.id,
      name: cg.name,
      city: cg.city,
      state: cg.state,
      lat: cg.latitude,
      lon: cg.longitude,
      maxRvLength: cg.maxRvLength,
      heroPhotoUrl: cg.imageUrl,
      rigFits: userRvLength?.rvLength && cg.maxRvLength
        ? userRvLength.rvLength <= cg.maxRvLength
        : null,
    }));

    // If few campground results, add HERE geocoding fallback
    if (results.length < 3 && HERE_API_KEY) {
      try {
        const geoRes = await fetch(
          `${HERE_GEOCODE_URL}?q=${encodeURIComponent(q)}&in=countryCode:USA&limit=${8 - results.length}&apiKey=${HERE_API_KEY}`
        );
        const geoData = await geoRes.json() as any;
        for (const item of (geoData.items || [])) {
          if (!item.position) continue;
          results.push({
            type: 'LOCATION',
            id: `loc_${item.id || Math.random().toString(36).slice(2)}`,
            name: item.title || item.address?.label || q,
            city: item.address?.city,
            state: item.address?.stateCode,
            lat: item.position.lat,
            lon: item.position.lng,
            maxRvLength: null,
            heroPhotoUrl: null,
            rigFits: null,
          });
        }
      } catch {}
    }

    res.json({ results: results.slice(0, 8) });
  } catch (e: any) {
    console.error('[TripIntelligence] Search error:', e);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
