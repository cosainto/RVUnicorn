import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient() as any;

// ─── SESSION ────────────────────────────────────────────────

router.post('/session/start', authenticateToken, async (req: any, res: Response) => {
  try {
    const { role, rigId, tripId, direction, lat, lng } = req.body;

    // End any existing active session
    await prisma.passengerSession.updateMany({
      where: { userId: req.userId, endedAt: null },
      data: { endedAt: new Date() },
    });

    const session = await prisma.passengerSession.create({
      data: {
        userId: req.userId,
        rigId: rigId || null,
        tripId: tripId || null,
        role: role || 'PASSENGER',
        direction: direction || 'OUTBOUND',
        currentLat: lat || null,
        currentLng: lng || null,
        lastLocationUpdate: lat ? new Date() : null,
      },
    });

    // Assign 3 initial missions for passengers
    if (role !== 'DRIVER') {
      const MISSION_POOL = [
        { missionType: 'STATE_SIGN', title: 'State Line Scout', description: 'Snap a photo when you cross into a new state!', hitchPrompt: 'Classic road trip moment — grab that state sign photo!', points: 15 },
        { missionType: 'SCENIC_PHOTO', title: 'Best Shot of the Drive', description: 'Find the most beautiful view from your window', hitchPrompt: 'Every drive has a hero shot — find yours!', points: 10 },
        { missionType: 'FUEL_LOG', title: 'Fuel Tracker', description: 'Log your next fuel stop with price per gallon', hitchPrompt: 'Help other RVers know the best fuel prices on this route', points: 10 },
      ];
      await prisma.roadMission.createMany({
        data: MISSION_POOL.map(m => ({ sessionId: session.id, userId: req.userId, ...m })),
      });
    }

    res.status(201).json(session);
  } catch (e: any) {
    console.error('[Passenger] Start session error:', e);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

router.get('/session/active', authenticateToken, async (req: any, res: Response) => {
  try {
    const session = await prisma.passengerSession.findFirst({
      where: { userId: req.userId, endedAt: null },
      include: { roadStops: { orderBy: { loggedAt: 'desc' }, take: 10 }, roadMissions: true },
    });
    res.json(session);
  } catch (e: any) {
    res.json(null);
  }
});

router.post('/session/end', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.passengerSession.updateMany({
      where: { userId: req.userId, endedAt: null },
      data: { endedAt: new Date() },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to end session' });
  }
});

router.post('/session/location', authenticateToken, async (req: any, res: Response) => {
  try {
    const { lat, lng } = req.body;
    await prisma.passengerSession.updateMany({
      where: { userId: req.userId, endedAt: null },
      data: { currentLat: lat, currentLng: lng, lastLocationUpdate: new Date() },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.json({ success: false });
  }
});

// ─── ROAD STOPS ─────────────────────────────────────────────

router.post('/stops', authenticateToken, async (req: any, res: Response) => {
  try {
    const session = await prisma.passengerSession.findFirst({ where: { userId: req.userId, endedAt: null } });
    if (!session) return res.status(400).json({ error: 'No active session' });

    const stop = await prisma.roadStop.create({
      data: {
        sessionId: session.id,
        tripId: session.tripId || null,
        userId: req.userId,
        stopType: req.body.stopType || 'OTHER',
        name: req.body.name || null,
        lat: req.body.lat || null,
        lng: req.body.lng || null,
        notes: req.body.notes || null,
        photoUrls: req.body.photoUrls || [],
        fuelPrice: req.body.fuelPrice ? parseFloat(req.body.fuelPrice) : null,
        fuelGallons: req.body.fuelGallons ? parseFloat(req.body.fuelGallons) : null,
        restaurantRating: req.body.restaurantRating || null,
        isOvernightStop: req.body.isOvernightStop || false,
        overnightStopId: req.body.overnightStopId || null,
        duration: req.body.duration || null,
        loggedAt: new Date(),
      },
    });

    // Update session location
    if (req.body.lat && req.body.lng) {
      await prisma.passengerSession.update({
        where: { id: session.id },
        data: { currentLat: req.body.lat, currentLng: req.body.lng, lastLocationUpdate: new Date() },
      });
    }

    // Award points
    const pointsMap: Record<string, number> = { FUEL: 5, FOOD: 5, SCENIC: 8, REST_AREA: 3, OVERNIGHT: 5, BORDER_CROSS: 15, OTHER: 3 };
    const pts = pointsMap[req.body.stopType] || 3;
    await prisma.coPilotPoints.upsert({
      where: { userId: req.userId },
      create: { userId: req.userId, points: pts },
      update: { points: { increment: pts } },
    });
    await prisma.coPilotPointLog.create({ data: { userId: req.userId, points: pts, reason: `Logged ${req.body.stopType} stop`, refId: stop.id } });

    res.status(201).json(stop);
  } catch (e: any) {
    console.error('[Passenger] Stop log error:', e);
    res.status(500).json({ error: 'Failed to log stop' });
  }
});

router.get('/stops', authenticateToken, async (req: any, res: Response) => {
  try {
    const session = await prisma.passengerSession.findFirst({ where: { userId: req.userId, endedAt: null } });
    if (!session) return res.json([]);
    const stops = await prisma.roadStop.findMany({ where: { sessionId: session.id }, orderBy: { loggedAt: 'desc' } });
    res.json(stops);
  } catch (e: any) {
    res.json([]);
  }
});

// ─── MISSIONS ───────────────────────────────────────────────

router.get('/missions', authenticateToken, async (req: any, res: Response) => {
  try {
    const session = await prisma.passengerSession.findFirst({ where: { userId: req.userId, endedAt: null } });
    if (!session) return res.json([]);
    const missions = await prisma.roadMission.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: 'asc' } });
    res.json(missions);
  } catch (e: any) {
    res.json([]);
  }
});

router.post('/missions/:missionId/complete', authenticateToken, async (req: any, res: Response) => {
  try {
    const mission = await prisma.roadMission.update({
      where: { id: req.params.missionId },
      data: { completedAt: new Date(), photoUrl: req.body.photoUrl || null },
    });

    // Award points
    await prisma.coPilotPoints.upsert({
      where: { userId: req.userId },
      create: { userId: req.userId, points: mission.points },
      update: { points: { increment: mission.points } },
    });
    await prisma.coPilotPointLog.create({ data: { userId: req.userId, points: mission.points, reason: `Mission: ${mission.title}`, refId: mission.id } });

    // Check if all 3 completed — assign new batch
    const session = await prisma.passengerSession.findFirst({ where: { userId: req.userId, endedAt: null } });
    if (session) {
      const remaining = await prisma.roadMission.count({ where: { sessionId: session.id, completedAt: null } });
      if (remaining === 0) {
        const EXTRA_MISSIONS = [
          { missionType: 'AIRSTREAM_SPOT', title: 'Airstream Spotter', description: 'Classic Airstreams are road royalty — spot one!', hitchPrompt: 'Keep your eyes peeled for that silver bullet!', points: 20 },
          { missionType: 'WILDLIFE', title: 'Wildlife Watch', description: 'Spot an animal from the road', hitchPrompt: 'Nature is everywhere — what can you find?', points: 20 },
          { missionType: 'LOCAL_DINER', title: 'Local Diner Hunter', description: 'Find a non-chain restaurant near your route', hitchPrompt: 'The best food is always local!', points: 25 },
        ];
        await prisma.roadMission.createMany({
          data: EXTRA_MISSIONS.map(m => ({ sessionId: session.id, userId: req.userId, ...m })),
        });
      }
    }

    res.json(mission);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to complete mission' });
  }
});

// ─── DEBRIEF ────────────────────────────────────────────────

router.post('/debrief/start', authenticateToken, async (req: any, res: Response) => {
  try {
    const { tripId } = req.body;
    const debrief = await prisma.tripDebrief.create({
      data: { tripId, userId: req.userId, sessionId: req.body.sessionId || null },
    });
    res.status(201).json(debrief);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to start debrief' });
  }
});

router.post('/debrief/:debriefId/answer', authenticateToken, async (req: any, res: Response) => {
  try {
    const { questionType, refId, refType, answer } = req.body;
    const dbAnswer = await prisma.tripDebriefAnswer.create({
      data: { debriefId: req.params.debriefId, questionType, refId, refType, answer },
    });

    // Update debrief progress
    await prisma.tripDebrief.update({
      where: { id: req.params.debriefId },
      data: { currentStopIndex: { increment: 1 } },
    });

    // Award points for debrief answers
    await prisma.coPilotPoints.upsert({
      where: { userId: req.userId },
      create: { userId: req.userId, points: 5 },
      update: { points: { increment: 5 } },
    });

    res.json(dbAnswer);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to save answer' });
  }
});

router.post('/debrief/:debriefId/complete', authenticateToken, async (req: any, res: Response) => {
  try {
    const debrief = await prisma.tripDebrief.update({
      where: { id: req.params.debriefId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Bonus points for completing full debrief
    await prisma.coPilotPoints.upsert({
      where: { userId: req.userId },
      create: { userId: req.userId, points: 50 },
      update: { points: { increment: 50 } },
    });
    await prisma.coPilotPointLog.create({ data: { userId: req.userId, points: 50, reason: 'Completed trip debrief', refId: debrief.id } });

    res.json(debrief);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to complete debrief' });
  }
});

// ─── POINTS ─────────────────────────────────────────────────

router.get('/points', authenticateToken, async (req: any, res: Response) => {
  try {
    const points = await prisma.coPilotPoints.findUnique({ where: { userId: req.userId } });
    const badges = await prisma.coPilotBadge.findMany({ where: { userId: req.userId } });
    const recentLog = await prisma.coPilotPointLog.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' }, take: 10 });
    res.json({ points: points?.points || 0, badges, recentLog });
  } catch (e: any) {
    res.json({ points: 0, badges: [], recentLog: [] });
  }
});

// ─── TRAVELER FEED ──────────────────────────────────────────

router.get('/traveler-feed', authenticateToken, async (req: any, res: Response) => {
  try {
    // Find other active sessions
    const activeSessions = await prisma.passengerSession.findMany({
      where: { endedAt: null, userId: { not: req.userId } },
      take: 10,
      orderBy: { lastLocationUpdate: 'desc' },
    });

    const userIds = activeSessions.map((s: any) => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, username: true, profilePicture: true },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    const items = activeSessions.map((s: any) => ({
      type: 'ACTIVE_SESSION',
      user: userMap.get(s.userId),
      direction: s.direction,
      lastUpdate: s.lastLocationUpdate,
    }));

    // Recent road stops from other users
    const recentStops = await prisma.roadStop.findMany({
      where: { userId: { not: req.userId }, createdAt: { gte: new Date(Date.now() - 6 * 3600000) } },
      orderBy: { loggedAt: 'desc' },
      take: 5,
    });
    const stopUserIds = recentStops.map((s: any) => s.userId);
    const stopUsers = await prisma.user.findMany({ where: { id: { in: stopUserIds } }, select: { id: true, firstName: true, username: true, profilePicture: true } });
    const stopUserMap = new Map(stopUsers.map((u: any) => [u.id, u]));

    recentStops.forEach((s: any) => {
      items.push({ type: 'ROAD_STOP', user: stopUserMap.get(s.userId), stopType: s.stopType, name: s.name, loggedAt: s.loggedAt });
    });

    res.json(items.slice(0, 10));
  } catch (e: any) {
    res.json([]);
  }
});

// ─── DIRECTION DETECTION (Phase 9) ──────────────────────────

router.post('/session/check-direction', authenticateToken, async (req: any, res: Response) => {
  try {
    const session = await prisma.passengerSession.findFirst({ where: { userId: req.userId, endedAt: null } });
    if (!session || !session.currentLat || !session.currentLng) return res.json({ direction: session?.direction || 'OUTBOUND' });

    // Get user's home location
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { homeLatitude: true, homeLongitude: true } });
    if (!user?.homeLatitude) return res.json({ direction: session.direction });

    // Get trip destination
    let destLat: number | null = null, destLng: number | null = null;
    if (session.tripId) {
      const trip = await prisma.event.findUnique({ where: { id: session.tripId }, include: { campground: { select: { latitude: true, longitude: true } } } });
      destLat = trip?.campground?.latitude || null;
      destLng = trip?.campground?.longitude || null;
    }

    const distToHome = Math.sqrt((session.currentLat - user.homeLatitude) ** 2 + (session.currentLng - (user.homeLongitude || 0)) ** 2) * 69;
    const distToDest = destLat && destLng ? Math.sqrt((session.currentLat - destLat) ** 2 + (session.currentLng - destLng) ** 2) * 69 : 9999;

    const newDirection = distToHome < distToDest ? 'INBOUND' : 'OUTBOUND';
    if (newDirection !== session.direction) {
      await prisma.passengerSession.update({ where: { id: session.id }, data: { direction: newDirection } });
    }

    res.json({ direction: newDirection, distToHome: Math.round(distToHome), distToDest: Math.round(distToDest), changed: newDirection !== session.direction });
  } catch (e: any) {
    res.json({ direction: 'OUTBOUND' });
  }
});

// ─── TRIP RECAP (Phase 12) ──────────────────────────────────

router.post('/trip-recap/:tripId', authenticateToken, async (req: any, res: Response) => {
  try {
    const { tripId } = req.params;

    // Gather all road stops for this trip
    const stops = await prisma.roadStop.findMany({
      where: { tripId },
      orderBy: { loggedAt: 'asc' },
    });

    // Build day-by-day story
    const dayMap = new Map<string, any[]>();
    stops.forEach((s: any) => {
      const day = new Date(s.loggedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const arr = dayMap.get(day) || [];
      arr.push(s);
      dayMap.set(day, arr);
    });

    const STOP_EMOJI: Record<string, string> = { FUEL: '\u26FD', FOOD: '\u{1F354}', SCENIC: '\u{1F4F8}', REST_AREA: '\u{1F6BB}', OVERNIGHT: '\u{1F319}', BORDER_CROSS: '\u{1F5FA}\uFE0F', OTHER: '\u{1F690}' };

    const story: any[] = [];
    let dayNum = 0;
    Array.from(dayMap.entries()).forEach(([day, dayStops]) => {
      dayNum++;
      const entries = dayStops.map((s: any) => ({
        emoji: STOP_EMOJI[s.stopType] || '\u{1F4CD}',
        name: s.name || s.stopType,
        time: new Date(s.loggedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        details: s.fuelPrice ? `$${s.fuelPrice}/gal` : s.restaurantRating === 1 ? '\u{1F44D} Worth it' : s.restaurantRating === -1 ? '\u{1F44E} Skip' : null,
      }));
      story.push({ dayNum, date: day, entries });
    });

    // Calculate totals
    const totalFuelCost = stops.filter((s: any) => s.fuelPrice && s.fuelGallons).reduce((sum: number, s: any) => sum + (s.fuelPrice * s.fuelGallons), 0);
    const fuelStops = stops.filter((s: any) => s.stopType === 'FUEL').length;

    // Generate narrative with Haiku
    let narrative = '';
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
    if (ANTHROPIC_API_KEY && stops.length > 0) {
      try {
        const trip = await prisma.event.findUnique({ where: { id: tripId }, select: { title: true, campground: { select: { name: true } } } });
        const { resolveUserRig } = require('../services/rigResolver');
        const rig = await resolveUserRig(req.userId, { rigName: true, id: true, slug: true, heroPhoto: true, coverPhotoUrl: true, followerCount: true, totalMilesAllTime: true });
        const statesCrossed = [...new Set(stops.filter((s: any) => s.stopType === 'BORDER_CROSS').map((s: any) => s.name))];
        const context = `Rig: ${rig?.rigName || 'their rig'}. Trip: ${trip?.title || 'road trip'} to ${trip?.campground?.name || 'destination'}. ${stops.length} stops logged. ${fuelStops} fuel stops. ${statesCrossed.length > 0 ? 'States crossed: ' + statesCrossed.join(', ') + '.' : ''} Total fuel: $${totalFuelCost.toFixed(0)}.`;

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 100,
            messages: [{ role: 'user', content: `Write a fun 2-sentence trip recap summary for an RV road trip. Context: ${context}. Keep it warm, celebratory, under 40 words. No hashtags or emojis.` }],
          }),
        });
        const aiData: any = await aiRes.json();
        if (aiData.content?.[0]?.text) narrative = aiData.content[0].text;
      } catch {}
    }

    // Save recap
    await prisma.rigTrip.updateMany({
      where: { id: tripId },
      data: { tripRecapGenerated: true, totalFuelCost: totalFuelCost || undefined },
    }).catch(() => {});

    res.json({ story, narrative, totalFuelCost: Math.round(totalFuelCost * 100) / 100, fuelStops, totalStops: stops.length });
  } catch (e: any) {
    console.error('[TripRecap] Error:', e);
    res.status(500).json({ error: 'Failed to generate recap' });
  }
});

// ─── MILESTONES (Phase 13) ──────────────────────────────────

router.get('/milestones', authenticateToken, async (req: any, res: Response) => {
  try {
    const session = await prisma.passengerSession.findFirst({ where: { userId: req.userId, endedAt: null } });
    if (!session) return res.json([]);

    const stops = await prisma.roadStop.findMany({ where: { sessionId: session.id }, orderBy: { loggedAt: 'asc' } });
    const milestones: any[] = [];

    // Count border crossings as state milestones
    const borderStops = stops.filter((s: any) => s.stopType === 'BORDER_CROSS');
    borderStops.forEach((s: any) => {
      milestones.push({ type: 'STATE_CROSS', message: `Just crossed into ${s.name}! \u{1F5FA}\uFE0F`, time: s.loggedAt });
    });

    // Points milestones
    const points = await prisma.coPilotPoints.findUnique({ where: { userId: req.userId } });
    const pts = points?.points || 0;
    if (pts >= 100 && pts < 200) milestones.push({ type: 'POINTS', message: `100 CoPilot points earned! \u{1F3C6}` });
    if (pts >= 250) milestones.push({ type: 'POINTS', message: `250 CoPilot points — Road Warrior status! \u{1F525}` });

    // Stop count milestones
    if (stops.length >= 5) milestones.push({ type: 'STOPS', message: `${stops.length} stops logged on this trip \u{1F4CB}` });
    if (stops.length >= 10) milestones.push({ type: 'STOPS', message: `10 stops! You're documenting everything \u{1F4F8}` });

    res.json(milestones.slice(-5)); // Last 5 milestones
  } catch (e: any) {
    res.json([]);
  }
});

// ─── BADGE CHECK (Phase 11) ─────────────────────────────────

router.post('/check-badges', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const awarded: string[] = [];

    const [sessionCount, fuelStopCount, missionCount, debriefCount, pointsRec, photoStopCount] = await Promise.all([
      prisma.passengerSession.count({ where: { userId, endedAt: { not: null } } }),
      prisma.roadStop.count({ where: { userId, stopType: 'FUEL' } }),
      prisma.roadMission.count({ where: { userId, completedAt: { not: null } } }),
      prisma.tripDebrief.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.coPilotPoints.findUnique({ where: { userId } }),
      prisma.roadStop.count({ where: { userId, stopType: 'SCENIC' } }),
    ]);

    const checks: Array<{ type: string; condition: boolean }> = [
      { type: 'ROUTE_MASTER', condition: sessionCount >= 10 },
      { type: 'FUEL_SAVER', condition: fuelStopCount >= 5 },
      { type: 'MISSION_MASTER', condition: missionCount >= 25 },
      { type: 'MEMORY_KEEPER', condition: debriefCount >= 3 },
      { type: 'ROAD_WARRIOR', condition: (pointsRec?.points || 0) >= 1000 },
      { type: 'TRIP_HISTORIAN', condition: photoStopCount >= 20 },
    ];

    for (const { type, condition } of checks) {
      if (condition) {
        const existing = await prisma.coPilotBadge.findUnique({ where: { userId_badgeType: { userId, badgeType: type } } });
        if (!existing) {
          await prisma.coPilotBadge.create({ data: { userId, badgeType: type } });
          awarded.push(type);
        }
      }
    }

    res.json({ awarded, total: await prisma.coPilotBadge.count({ where: { userId } }) });
  } catch (e: any) {
    res.json({ awarded: [], total: 0 });
  }
});

// ─── LIVE JOURNEY (Phase 14) ────────────────────────────────

router.get('/live/:userId', async (req: any, res: Response) => {
  try {
    const session = await prisma.passengerSession.findFirst({
      where: { userId: req.params.userId, endedAt: null },
    });
    if (!session) return res.json(null);

    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { firstName: true, username: true, profilePicture: true },
    });

    const rig = session.rigId ? await prisma.rig.findUnique({
      where: { id: session.rigId },
      select: { rigName: true, slug: true, rigEmoji: true, heroPhoto: true },
    }) : null;

    const lastStop = await prisma.roadStop.findFirst({
      where: { sessionId: session.id },
      orderBy: { loggedAt: 'desc' },
    });

    // Get trip destination
    let destination = null;
    if (session.tripId) {
      const trip = await prisma.event.findUnique({
        where: { id: session.tripId },
        select: { title: true, campground: { select: { name: true } } },
      });
      destination = trip?.campground?.name || trip?.title;
    }

    res.json({
      isLive: true,
      direction: session.direction,
      role: session.role,
      currentLat: session.currentLat,
      currentLng: session.currentLng,
      lastLocationUpdate: session.lastLocationUpdate,
      activatedAt: session.activatedAt,
      destination,
      user,
      rig,
      lastStop: lastStop ? { type: lastStop.stopType, name: lastStop.name, loggedAt: lastStop.loggedAt } : null,
    });
  } catch (e: any) {
    res.json(null);
  }
});

export default router;
