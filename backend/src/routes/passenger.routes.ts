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

export default router;
