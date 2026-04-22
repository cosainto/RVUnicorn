import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import { buildCorridorAnalysis, saveCorridorAnalysis } from '../services/routeCorridorService';
import { computeEnhancedScores } from '../services/enhancedScoringService';
import {
  startLiveSession,
  pingLiveSession,
  getSmartSuggestions,
  activateSaveMe,
  endLiveSession,
  dismissAlert,
} from '../services/liveCoPilotService';

const router = Router();

const DIESEL_FALLBACK = 3.95;
const GAS_FALLBACK = 3.45;

// ── CORRIDOR ANALYSIS ──────────────────────────────────────────

router.post('/corridor-analysis', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { startLat, startLon, destLat, destLon, campgroundId, eventId } = req.body;

    if (!startLat || !startLon || !destLat || !destLon) {
      return res.status(400).json({ error: 'Start and destination coordinates required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rvMpg: true, rvLength: true, rvHeight: true, rvWeight: true, rvFuelType: true },
    });

    // Build corridor
    const corridor = await buildCorridorAnalysis(startLat, startLon, destLat, destLon);

    // Rig fit check
    let rigFit: { fits: boolean; maxLength: number | null; userLength: number | null } | null = null;
    if (campgroundId && user?.rvLength) {
      const cg = await prisma.campground.findUnique({
        where: { id: campgroundId },
        select: { maxRvLength: true },
      });
      if (cg?.maxRvLength) {
        rigFit = { fits: user.rvLength <= cg.maxRvLength, maxLength: cg.maxRvLength, userLength: user.rvLength };
      }
    }

    // User drive history for battery limit
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

    // Enhanced scoring
    const scoring = computeEnhancedScores(corridor, {
      rigFit,
      batteryLimitHours: batteryLimit,
      userMpg: user?.rvMpg,
      userRvLength: user?.rvLength,
      userRvFuelType: user?.rvFuelType,
    });

    // Fuel estimate
    let fuelEstimate: number | null = null;
    let fuelGallons: number | null = null;
    let fuelPricePerGallon: number | null = null;
    if (corridor.totalMiles && user?.rvMpg) {
      fuelGallons = Math.round((corridor.totalMiles / user.rvMpg) * 10) / 10;
      fuelPricePerGallon = user.rvFuelType === 'diesel' ? DIESEL_FALLBACK : GAS_FALLBACK;

      // Try EIA for live price
      if (process.env.EIA_API_KEY) {
        try {
          const eiaUrl = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${process.env.EIA_API_KEY}&frequency=weekly&data[0]=value&facets[product][]=${user.rvFuelType === 'diesel' ? 'EPD2D' : 'EMM_EPMR_PTE_NUS_DPG'}&sort[0][column]=period&sort[0][direction]=desc&length=1`;
          const eiaRes = await fetch(eiaUrl);
          if (eiaRes.ok) {
            const eiaData: any = await eiaRes.json();
            const price = eiaData?.response?.data?.[0]?.value;
            if (price) fuelPricePerGallon = parseFloat(price);
          }
        } catch {}
      }

      fuelEstimate = Math.round(fuelGallons * fuelPricePerGallon);
    }

    // Destination weather (from last segment)
    const lastSeg = corridor.segments[corridor.segments.length - 1];
    const destWeather = lastSeg?.weather;

    // Save corridor analysis
    const saved = await saveCorridorAnalysis(
      userId,
      corridor,
      {
        overall: scoring.overall,
        safety: scoring.subScores.safety,
        comfort: scoring.subScores.comfort,
        convenience: scoring.subScores.convenience,
        flexibility: scoring.subScores.flexibility,
      },
      scoring.status,
      { eventId, headline: scoring.headline, flags: scoring.flags, passedChecks: scoring.passedChecks },
    );

    res.json({
      corridorId: saved.id,
      score: scoring.overall,
      subScores: scoring.subScores,
      status: scoring.status,
      headline: scoring.headline,
      subheadline: scoring.subheadline,
      flags: scoring.flags,
      passedChecks: scoring.passedChecks,
      metrics: {
        driveMiles: corridor.totalMiles,
        driveHours: corridor.totalHours,
        fuelEstimate,
        fuelGallons,
        fuelPricePerGallon,
        weatherTemp: destWeather?.temp ?? null,
        weatherCondition: destWeather?.condition ?? null,
        windSpeed: destWeather?.windSpeed ?? null,
        batteryLimitHours: batteryLimit,
      },
      corridor: {
        segments: corridor.segments.map(s => ({
          index: s.index,
          startMile: s.startMile,
          endMile: s.endMile,
          midLat: s.midLat,
          midLon: s.midLon,
          riskLevel: s.riskLevel,
          riskFactors: s.riskFactors,
          weather: s.weather,
          fuelStopCount: s.fuelStops.length,
          restStopCount: s.restStops.length,
          overnightCount: s.overnightStops.length + s.campgrounds.length,
        })),
        riskZones: corridor.riskZones,
        fuelGaps: corridor.fuelGaps,
        stopClusters: corridor.stopClusters.map(c => ({
          mile: c.mile,
          lat: c.lat,
          lon: c.lon,
          stopCount: c.stops.length,
          types: [...new Set(c.stops.map(s => s.type))],
        })),
      },
    });
  } catch (e: any) {
    console.error('[RouteCoPilot] Corridor analysis error:', e);
    res.status(500).json({ error: 'Failed to run corridor analysis' });
  }
});

// ── LIVE MODE: START ───────────────────────────────────────────

router.post('/live/start', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { startLat, startLon, destLat, destLon, eventId, corridorId } = req.body;

    if (!startLat || !startLon || !destLat || !destLon) {
      return res.status(400).json({ error: 'Start and destination coordinates required' });
    }

    const session = await startLiveSession(userId, startLat, startLon, destLat, destLon, { eventId, corridorId });

    // If no corridor exists, build one
    let corridor;
    if (corridorId) {
      const saved = await (prisma as any).routeCorridorAnalysis.findUnique({ where: { id: corridorId } });
      if (saved) {
        corridor = { segments: saved.segments, totalMiles: saved.totalMiles, totalHours: saved.totalHours, routePolyline: saved.routePolyline, riskZones: [], fuelGaps: [], stopClusters: [] };
      }
    }
    if (!corridor) {
      corridor = await buildCorridorAnalysis(startLat, startLon, destLat, destLon);
    }

    res.json({
      sessionId: session.id,
      status: session.status,
      corridor: {
        totalMiles: corridor.totalMiles,
        totalHours: corridor.totalHours,
        segmentCount: corridor.segments.length,
        segments: corridor.segments.map((s: any) => ({
          index: s.index,
          startMile: s.startMile,
          endMile: s.endMile,
          riskLevel: s.riskLevel,
          weather: s.weather,
        })),
      },
    });
  } catch (e: any) {
    console.error('[RouteCoPilot] Live start error:', e);
    res.status(500).json({ error: 'Failed to start live session' });
  }
});

// ── LIVE MODE: PING ────────────────────────────────────────────

router.post('/live/:sessionId/ping', authenticateToken, async (req: any, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { lat, lon, speedMph, heading, fatigueScore } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'GPS coordinates required' });
    }

    // Load the corridor for this session
    const session = await (prisma as any).liveCoPilotSession.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    let corridor;
    if (session.corridorId) {
      const saved = await (prisma as any).routeCorridorAnalysis.findUnique({ where: { id: session.corridorId } });
      if (saved) {
        corridor = {
          segments: saved.segments,
          totalMiles: saved.totalMiles,
          totalHours: saved.totalHours,
          routePolyline: saved.routePolyline,
          riskZones: [],
          fuelGaps: [],
          stopClusters: [],
        };
      }
    }
    if (!corridor) {
      corridor = await buildCorridorAnalysis(session.originLat, session.originLon, session.destLat, session.destLon);
    }

    // Get user battery limit
    const recentDrives = await (prisma as any).driveSession.findMany({
      where: { userId: req.userId },
      orderBy: { startTime: 'desc' },
      take: 5,
      select: { totalDriveSeconds: true },
    });
    const avgDrive = recentDrives.length > 0
      ? recentDrives.reduce((s: number, d: any) => s + d.totalDriveSeconds / 3600, 0) / recentDrives.length
      : 5;
    const batteryLimit = Math.max(3, Math.min(8, Math.round(avgDrive)));

    const result = await pingLiveSession(
      sessionId,
      lat,
      lon,
      speedMph || 0,
      heading || 0,
      corridor,
      { fatigueScore, batteryLimitHours: batteryLimit },
    );

    res.json(result);
  } catch (e: any) {
    console.error('[RouteCoPilot] Ping error:', e);
    res.status(500).json({ error: 'Failed to process ping' });
  }
});

// ── LIVE MODE: GET SESSION ─────────────────────────────────────

router.get('/live/:sessionId', authenticateToken, async (req: any, res: Response) => {
  try {
    const session = await (prisma as any).liveCoPilotSession.findUnique({
      where: { id: req.params.sessionId },
      include: { alerts: { where: { dismissed: false }, orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json(session);
  } catch (e: any) {
    console.error('[RouteCoPilot] Get session error:', e);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// ── LIVE MODE: DISMISS ALERT ───────────────────────────────────

router.post('/live/:sessionId/dismiss-alert/:alertId', authenticateToken, async (req: any, res: Response) => {
  try {
    await dismissAlert(req.params.alertId);
    res.json({ success: true });
  } catch (e: any) {
    console.error('[RouteCoPilot] Dismiss alert error:', e);
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

// ── LIVE MODE: SMART SUGGESTIONS ───────────────────────────────

router.get('/live/:sessionId/suggestions', authenticateToken, async (req: any, res: Response) => {
  try {
    const session = await (prisma as any).liveCoPilotSession.findUnique({ where: { id: req.params.sessionId } });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Load corridor
    let corridor;
    if (session.corridorId) {
      const saved = await (prisma as any).routeCorridorAnalysis.findUnique({ where: { id: session.corridorId } });
      if (saved) {
        corridor = {
          segments: saved.segments,
          totalMiles: saved.totalMiles,
          totalHours: saved.totalHours,
          routePolyline: saved.routePolyline,
          riskZones: [],
          fuelGaps: [],
          stopClusters: [],
        };
      }
    }
    if (!corridor) {
      corridor = await buildCorridorAnalysis(session.originLat, session.originLon, session.destLat, session.destLon);
    }

    const types = req.query.types ? (req.query.types as string).split(',') : undefined;
    const maxDetour = req.query.maxDetourMiles ? parseFloat(req.query.maxDetourMiles) : 10;

    const suggestions = await getSmartSuggestions(
      session.currentLat || session.originLat,
      session.currentLon || session.originLon,
      0,
      corridor,
      session.currentSegment || 0,
      maxDetour,
      types,
    );

    res.json({ suggestions });
  } catch (e: any) {
    console.error('[RouteCoPilot] Suggestions error:', e);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// ── LIVE MODE: SAVE ME ─────────────────────────────────────────

router.post('/live/:sessionId/save-me', authenticateToken, async (req: any, res: Response) => {
  try {
    const { lat, lon } = req.body;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'GPS coordinates required' });
    }

    const result = await activateSaveMe(req.params.sessionId, lat, lon);
    res.json(result);
  } catch (e: any) {
    console.error('[RouteCoPilot] Save Me error:', e);
    res.status(500).json({ error: 'Failed to activate Save Me' });
  }
});

// ── LIVE MODE: END ─────────────────────────────────────────────

router.post('/live/:sessionId/end', authenticateToken, async (req: any, res: Response) => {
  try {
    const session = await endLiveSession(req.params.sessionId, req.userId);
    res.json({ success: true, milesDriven: session.milesDriven });
  } catch (e: any) {
    console.error('[RouteCoPilot] End session error:', e);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

export default router;
