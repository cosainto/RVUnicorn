import { prisma } from '../prisma';
import { CorridorAnalysis, RouteSegment, NearbyStop } from './routeCorridorService';

// ── Types ──────────────────────────────────────────────────────

export interface LiveAlert {
  id: string;
  type: 'WIND' | 'FATIGUE' | 'FUEL_LOW' | 'OVERNIGHT' | 'WEATHER' | 'SAVE_ME';
  urgency: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  actionLabel?: string;
  actionPayload?: any;
  distanceAhead?: number;
}

export interface SmartSuggestion {
  type: 'FUEL' | 'FOOD' | 'OVERNIGHT' | 'REST';
  name: string;
  distanceFromRoute: number;
  lat: number;
  lon: number;
  reason: string;
  phone?: string | null;
  id: string;
}

export interface LivePingResult {
  sessionId: string;
  status: string;
  currentSegmentIndex: number;
  currentSegment: RouteSegment | null;
  nextSegment: RouteSegment | null;
  milesRemaining: number;
  etaHours: number;
  alerts: LiveAlert[];
  milesDriven: number;
}

export interface SaveMeResult {
  stops: {
    id: string;
    name: string;
    type: string;
    lat: number;
    lon: number;
    distanceMiles: number;
    phone?: string | null;
    hasRVParking?: boolean;
  }[];
}

// ── Haversine ──────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── Start Live Session ─────────────────────────────────────────

export async function startLiveSession(
  userId: string,
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  opts?: { eventId?: string; corridorId?: string },
) {
  // End any existing active sessions
  await (prisma as any).liveCoPilotSession.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: { status: 'COMPLETED', endedAt: new Date() },
  });

  const session = await (prisma as any).liveCoPilotSession.create({
    data: {
      userId,
      eventId: opts?.eventId ?? null,
      corridorId: opts?.corridorId ?? null,
      originLat,
      originLon,
      destLat,
      destLon,
      currentLat: originLat,
      currentLon: originLon,
      status: 'ACTIVE',
    },
  });

  // Update TripIntelligenceSession
  await (prisma as any).tripIntelligenceSession.upsert({
    where: { userId },
    update: { liveCoPilotSessionId: session.id },
    create: { userId, liveCoPilotSessionId: session.id },
  });

  return session;
}

// ── Ping Live Session ──────────────────────────────────────────

export async function pingLiveSession(
  sessionId: string,
  currentLat: number,
  currentLon: number,
  speedMph: number,
  heading: number,
  corridor: CorridorAnalysis,
  opts?: { fatigueScore?: number; batteryLimitHours?: number; userMpg?: number; fuelLevel?: number },
): Promise<LivePingResult> {
  const session = await (prisma as any).liveCoPilotSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error('Session not found');

  // Determine current segment based on proximity
  let currentSegmentIndex = 0;
  let closestDist = Infinity;
  for (let i = 0; i < corridor.segments.length; i++) {
    const seg = corridor.segments[i];
    const dist = haversine(currentLat, currentLon, seg.midLat, seg.midLon);
    if (dist < closestDist) {
      closestDist = dist;
      currentSegmentIndex = i;
    }
  }

  const currentSegment = corridor.segments[currentSegmentIndex] || null;
  const nextSegment = corridor.segments[currentSegmentIndex + 1] || null;

  // Calculate miles driven from origin
  const milesDriven = haversine(session.originLat, session.originLon, currentLat, currentLon);
  const milesRemaining = Math.max(0, corridor.totalMiles - milesDriven);
  const avgSpeed = speedMph > 0 ? speedMph : 55;
  const etaHours = Math.round((milesRemaining / avgSpeed) * 10) / 10;

  // Generate alerts for current + next segments
  const alerts = generateLiveAlerts(
    currentSegment,
    nextSegment,
    corridor,
    currentSegmentIndex,
    milesDriven,
    etaHours,
    opts,
  );

  // Update session in DB
  await (prisma as any).liveCoPilotSession.update({
    where: { id: sessionId },
    data: {
      currentLat,
      currentLon,
      currentSegment: currentSegmentIndex,
      milesDriven: Math.round(milesDriven),
      lastPingAt: new Date(),
    },
  });

  // Save any new CRITICAL/WARNING alerts
  for (const alert of alerts.filter(a => a.urgency !== 'INFO')) {
    await (prisma as any).coPilotAlert.create({
      data: {
        sessionId,
        type: alert.type,
        urgency: alert.urgency,
        title: alert.title,
        body: alert.body,
        actionLabel: alert.actionLabel ?? null,
        actionPayload: alert.actionPayload ?? null,
      },
    }).catch(() => {}); // Don't fail ping if alert save fails
  }

  return {
    sessionId,
    status: session.status,
    currentSegmentIndex,
    currentSegment,
    nextSegment,
    milesRemaining: Math.round(milesRemaining),
    etaHours,
    alerts,
    milesDriven: Math.round(milesDriven),
  };
}

// ── Generate Live Alerts ───────────────────────────────────────

function generateLiveAlerts(
  currentSegment: RouteSegment | null,
  nextSegment: RouteSegment | null,
  corridor: CorridorAnalysis,
  currentIdx: number,
  milesDriven: number,
  etaHours: number,
  opts?: { fatigueScore?: number; batteryLimitHours?: number; userMpg?: number; fuelLevel?: number },
): LiveAlert[] {
  const alerts: LiveAlert[] = [];

  // 1. Wind alert — check current and next segment
  const checkWindAlert = (seg: RouteSegment, label: string) => {
    if (seg.weather?.windSpeed && seg.weather.windSpeed > 30) {
      alerts.push({
        id: `wind_${seg.index}`,
        type: 'WIND',
        urgency: 'CRITICAL',
        title: `High wind ahead — ${seg.weather.windSpeed}mph`,
        body: `${label} (mile ${seg.startMile}-${seg.endMile}). Consider pulling over if towing or driving a high-profile rig.`,
        distanceAhead: Math.max(0, seg.startMile - Math.round(milesDriven)),
      });
    } else if (seg.weather?.windSpeed && seg.weather.windSpeed > 25) {
      alerts.push({
        id: `wind_${seg.index}`,
        type: 'WIND',
        urgency: 'WARNING',
        title: `Wind advisory — ${seg.weather.windSpeed}mph`,
        body: `${label} (mile ${seg.startMile}-${seg.endMile}). Reduce speed and grip the wheel.`,
        distanceAhead: Math.max(0, seg.startMile - Math.round(milesDriven)),
      });
    }
  };

  if (currentSegment) checkWindAlert(currentSegment, 'Current segment');
  if (nextSegment) checkWindAlert(nextSegment, 'Ahead');

  // 2. Weather alert — severe weather in upcoming segments
  const lookAhead = corridor.segments.slice(currentIdx, currentIdx + 3);
  for (const seg of lookAhead) {
    if (seg.weather?.condition) {
      const cond = seg.weather.condition.toLowerCase();
      if (cond.includes('tornado') || cond.includes('severe')) {
        alerts.push({
          id: `weather_${seg.index}`,
          type: 'WEATHER',
          urgency: 'CRITICAL',
          title: 'Severe weather warning ahead',
          body: `${seg.weather.condition} near mile ${seg.startMile}. Seek shelter immediately if conditions deteriorate.`,
          distanceAhead: Math.max(0, seg.startMile - Math.round(milesDriven)),
        });
      } else if (cond.includes('thunder')) {
        alerts.push({
          id: `weather_${seg.index}`,
          type: 'WEATHER',
          urgency: 'WARNING',
          title: 'Thunderstorms ahead',
          body: `${seg.weather.condition} near mile ${seg.startMile}. Reduce speed and turn on headlights.`,
          distanceAhead: Math.max(0, seg.startMile - Math.round(milesDriven)),
        });
      }
    }
  }

  // 3. Fatigue alert
  if (opts?.fatigueScore !== undefined) {
    if (opts.fatigueScore <= 30) {
      alerts.push({
        id: 'fatigue_critical',
        type: 'FATIGUE',
        urgency: 'CRITICAL',
        title: 'Fatigue level critical',
        body: 'Your fatigue score is very high. Find a safe place to stop and rest.',
        actionLabel: 'Find rest stop',
      });
    } else if (opts.fatigueScore <= 50) {
      alerts.push({
        id: 'fatigue_warning',
        type: 'FATIGUE',
        urgency: 'WARNING',
        title: 'Getting tired?',
        body: 'Consider a break soon. Next rest area may be a good stopping point.',
        actionLabel: 'View rest stops',
      });
    }
  }

  // Battery limit approach
  if (opts?.batteryLimitHours) {
    // Estimate driving hours so far (rough: milesDriven / 55mph average)
    const estDrivingHours = milesDriven / 55;
    const remaining = opts.batteryLimitHours - estDrivingHours;
    if (remaining <= 0.5 && remaining > 0) {
      alerts.push({
        id: 'battery_limit',
        type: 'FATIGUE',
        urgency: 'WARNING',
        title: 'Approaching your drive limit',
        body: `You're near your ${opts.batteryLimitHours}hr comfort limit. Plan a stop soon.`,
        actionLabel: 'Find a stop',
      });
    } else if (remaining <= 0) {
      alerts.push({
        id: 'battery_exceeded',
        type: 'FATIGUE',
        urgency: 'CRITICAL',
        title: 'Drive limit exceeded',
        body: `You've passed your ${opts.batteryLimitHours}hr comfort limit. Stop when safe.`,
        actionLabel: 'Find nearest stop',
      });
    }
  }

  // 4. Fuel alert — check for fuel gaps ahead
  for (const gap of corridor.fuelGaps) {
    const milesUntilGap = gap.startMile - Math.round(milesDriven);
    if (milesUntilGap > 0 && milesUntilGap < 30) {
      alerts.push({
        id: `fuel_gap_${gap.startMile}`,
        type: 'FUEL_LOW',
        urgency: 'WARNING',
        title: 'Fuel gap ahead',
        body: `${Math.round(gap.gapMiles)}mi stretch with no fuel stations starts in ${Math.round(milesUntilGap)}mi. Fill up now!`,
        distanceAhead: milesUntilGap,
        actionLabel: 'Find fuel',
      });
    }
  }

  // 5. Overnight alert — if ETA > sunset + 1hr (approximate: after 9pm)
  const now = new Date();
  const etaTime = new Date(now.getTime() + etaHours * 3600 * 1000);
  if (etaTime.getHours() >= 21 && etaHours > 1) {
    const overnightAhead = corridor.segments.slice(currentIdx).some(s => s.overnightStops.length > 0 || s.campgrounds.length > 0);
    if (!overnightAhead) {
      alerts.push({
        id: 'overnight_needed',
        type: 'OVERNIGHT',
        urgency: 'WARNING',
        title: 'Late arrival — consider stopping',
        body: `ETA is ${etaTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} and no overnight stops ahead.`,
        actionLabel: 'Find overnight',
      });
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return alerts.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

// ── Smart Suggestions ──────────────────────────────────────────

export async function getSmartSuggestions(
  currentLat: number,
  currentLon: number,
  heading: number,
  corridor: CorridorAnalysis,
  currentSegmentIndex: number,
  maxDetourMiles: number = 10,
  types?: string[],
): Promise<SmartSuggestion[]> {
  const suggestions: SmartSuggestion[] = [];

  // Look at current + next 2 segments for stops
  const relevantSegments = corridor.segments.slice(
    currentSegmentIndex,
    Math.min(currentSegmentIndex + 3, corridor.segments.length)
  );

  for (const seg of relevantSegments) {
    // Fuel suggestions
    if (!types || types.includes('FUEL')) {
      for (const stop of seg.fuelStops) {
        if (stop.distanceFromRoute <= maxDetourMiles) {
          const isBestBeforeGap = corridor.fuelGaps.some(g => g.startMile > seg.startMile && g.startMile - seg.endMile < 40);
          suggestions.push({
            type: 'FUEL',
            name: stop.name,
            distanceFromRoute: stop.distanceFromRoute,
            lat: stop.lat,
            lon: stop.lon,
            reason: isBestBeforeGap ? 'Best fuel before long gap' : 'Fuel available',
            phone: stop.phone,
            id: stop.id,
          });
        }
      }
    }

    // Rest suggestions
    if (!types || types.includes('REST')) {
      for (const stop of seg.restStops) {
        if (stop.distanceFromRoute <= maxDetourMiles) {
          suggestions.push({
            type: 'REST',
            name: stop.name,
            distanceFromRoute: stop.distanceFromRoute,
            lat: stop.lat,
            lon: stop.lon,
            reason: stop.hasRVParking ? 'Rest stop with RV parking' : 'Rest area',
            phone: stop.phone,
            id: stop.id,
          });
        }
      }
    }

    // Overnight suggestions
    if (!types || types.includes('OVERNIGHT')) {
      for (const stop of [...seg.overnightStops, ...seg.campgrounds]) {
        if (stop.distanceFromRoute <= maxDetourMiles) {
          suggestions.push({
            type: 'OVERNIGHT',
            name: stop.name,
            distanceFromRoute: stop.distanceFromRoute,
            lat: stop.lat,
            lon: stop.lon,
            reason: stop.type === 'CAMPGROUND' ? 'Campground near route' : 'Overnight parking available',
            phone: stop.phone,
            id: stop.id,
          });
        }
      }
    }
  }

  // Sort by distance from current position
  suggestions.sort((a, b) => {
    const distA = haversine(currentLat, currentLon, a.lat, a.lon);
    const distB = haversine(currentLat, currentLon, b.lat, b.lon);
    return distA - distB;
  });

  // Deduplicate by id and limit
  const seen = new Set<string>();
  return suggestions.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  }).slice(0, 15);
}

// ── Save Me Mode ───────────────────────────────────────────────

export async function activateSaveMe(
  sessionId: string,
  currentLat: number,
  currentLon: number,
): Promise<SaveMeResult> {
  // Update session status
  await (prisma as any).liveCoPilotSession.update({
    where: { id: sessionId },
    data: { status: 'SAVE_ME' },
  });

  // Fast bounding box query — ~20 miles in each direction
  const BOX = 0.3; // ~20 miles at mid-latitudes
  const minLat = currentLat - BOX;
  const maxLat = currentLat + BOX;
  const minLon = currentLon - BOX;
  const maxLon = currentLon + BOX;

  const [gasStations, restStops, overnightStops, campgrounds] = await Promise.all([
    (prisma as any).gasStation.findMany({
      where: { latitude: { gte: minLat, lte: maxLat }, longitude: { gte: minLon, lte: maxLon } },
      take: 20,
      select: { id: true, name: true, latitude: true, longitude: true, phone: true, hasRVParking: true, hasDiesel: true },
    }),
    (prisma as any).restStop.findMany({
      where: { latitude: { gte: minLat, lte: maxLat }, longitude: { gte: minLon, lte: maxLon } },
      take: 20,
      select: { id: true, name: true, latitude: true, longitude: true, hasRVParking: true },
    }),
    (prisma as any).overnightStop.findMany({
      where: { latitude: { gte: minLat, lte: maxLat }, longitude: { gte: minLon, lte: maxLon }, allowsRvs: true },
      take: 20,
      select: { id: true, name: true, latitude: true, longitude: true, phone: true },
    }),
    prisma.campground.findMany({
      where: { latitude: { gte: minLat, lte: maxLat }, longitude: { gte: minLon, lte: maxLon } },
      take: 10,
      select: { id: true, name: true, latitude: true, longitude: true, phone: true },
    }),
  ]);

  // Combine, calculate distance, sort by distance
  const allStops = [
    ...gasStations.map((s: any) => ({ ...s, type: 'FUEL', hasRVParking: s.hasRVParking })),
    ...restStops.map((s: any) => ({ ...s, type: 'REST', hasRVParking: s.hasRVParking })),
    ...overnightStops.map((s: any) => ({ ...s, type: 'OVERNIGHT' })),
    ...campgrounds.map((s: any) => ({ ...s, type: 'CAMPGROUND' })),
  ].map((s: any) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    lat: s.latitude,
    lon: s.longitude,
    distanceMiles: Math.round(haversine(currentLat, currentLon, s.latitude, s.longitude) * 10) / 10,
    phone: s.phone ?? null,
    hasRVParking: s.hasRVParking ?? undefined,
  }));

  // Sort by: 1. distance (closest first)
  allStops.sort((a: any, b: any) => a.distanceMiles - b.distanceMiles);

  // Save alert
  await (prisma as any).coPilotAlert.create({
    data: {
      sessionId,
      type: 'SAVE_ME',
      urgency: 'CRITICAL',
      title: 'Save Me activated',
      body: `Finding nearest safe stops at ${new Date().toLocaleTimeString()}`,
    },
  }).catch(() => {});

  return { stops: allStops.slice(0, 5) };
}

// ── End Live Session ───────────────────────────────────────────

export async function endLiveSession(sessionId: string, userId: string) {
  const session = await (prisma as any).liveCoPilotSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
    },
  });

  // Clear from TripIntelligenceSession
  await (prisma as any).tripIntelligenceSession.updateMany({
    where: { userId, liveCoPilotSessionId: sessionId },
    data: { liveCoPilotSessionId: null, saveMeActive: false },
  });

  // Save as DriveSession for fatigue history
  if (session.startedAt && session.milesDriven > 0) {
    const durationSecs = Math.round((new Date().getTime() - new Date(session.startedAt).getTime()) / 1000);
    await (prisma as any).driveSession.create({
      data: {
        userId,
        startTime: session.startedAt,
        endTime: new Date(),
        totalDriveSeconds: durationSecs,
        eventId: session.eventId,
        grade: 'B', // Can be enhanced later
      },
    }).catch(() => {});
  }

  return session;
}

// ── Dismiss Alert ──────────────────────────────────────────────

export async function dismissAlert(alertId: string) {
  return (prisma as any).coPilotAlert.update({
    where: { id: alertId },
    data: { dismissed: true },
  });
}
