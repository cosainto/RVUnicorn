import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import { generateConfidenceReport, saveConfidenceSnapshot } from '../services/tripConfidenceService';
import { emitConfidenceEvents } from '../services/confidenceEventEmitter';
import { sendWebPush } from '../utils/webPush';

const router = Router();

// GET /api/trip-confidence/:eventId
router.get('/:eventId', authenticateToken, async (req: any, res: Response) => {
  try {
    const { eventId } = req.params;

    // Support custom start location override via query params
    const startLat = parseFloat(req.query.startLat as string);
    const startLon = parseFloat(req.query.startLon as string);
    const startOverride = !isNaN(startLat) && !isNaN(startLon)
      ? { lat: startLat, lon: startLon, label: req.query.startLabel as string }
      : undefined;

    // Check for fresh cached snapshot (< 6 hours old), skip if custom start
    const cached = !startOverride ? await (prisma as any).tripConfidenceSnapshot.findFirst({
      where: {
        eventId,
        userId: req.userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { generatedAt: 'desc' },
    }) : null;

    if (cached) {
      return res.json({
        score: cached.score,
        status: cached.status,
        headline: cached.headline,
        subheadline: cached.subheadline,
        flags: cached.flags,
        passedChecks: cached.passedChecks,
        metrics: cached.metrics,
        breakPlan: cached.breakPlan,
        householdStatus: cached.householdStatus,
        generatedAt: cached.generatedAt,
        cached: true,
      });
    }

    // Generate fresh report
    const report = await generateConfidenceReport(eventId, req.userId, startOverride);

    // Save snapshot
    await saveConfidenceSnapshot(eventId, req.userId, report);

    // Emit events for organizer dashboard
    const event = await (prisma as any).event.findUnique({
      where: { id: eventId },
      select: { campgroundId: true },
    });
    if (event?.campgroundId) {
      await emitConfidenceEvents(report, eventId, event.campgroundId, req.userId).catch(() => {});
    }

    res.json({ ...report, cached: false });
  } catch (e: any) {
    console.error('[TripConfidence] Error:', e);
    res.status(500).json({ error: e.message || 'Failed to generate confidence report' });
  }
});

// POST /api/trip-confidence/:eventId/refresh
router.post('/:eventId/refresh', authenticateToken, async (req: any, res: Response) => {
  try {
    const { eventId } = req.params;
    const startLat = parseFloat(req.body.startLat);
    const startLon = parseFloat(req.body.startLon);
    const startOverride = !isNaN(startLat) && !isNaN(startLon)
      ? { lat: startLat, lon: startLon, label: req.body.startLabel }
      : undefined;
    const report = await generateConfidenceReport(eventId, req.userId, startOverride);
    await saveConfidenceSnapshot(eventId, req.userId, report);

    const event = await (prisma as any).event.findUnique({
      where: { id: eventId },
      select: { campgroundId: true },
    });
    if (event?.campgroundId) {
      await emitConfidenceEvents(report, eventId, event.campgroundId, req.userId).catch(() => {});
    }

    res.json(report);
  } catch (e: any) {
    console.error('[TripConfidence] Refresh error:', e);
    res.status(500).json({ error: e.message || 'Failed to refresh confidence report' });
  }
});

// POST /api/trip-confidence/:eventId/household-review
router.post('/:eventId/household-review', authenticateToken, async (req: any, res: Response) => {
  try {
    const { eventId } = req.params;

    // Find the latest snapshot
    const snapshot = await (prisma as any).tripConfidenceSnapshot.findFirst({
      where: { eventId },
      orderBy: { generatedAt: 'desc' },
    });

    if (!snapshot) return res.status(404).json({ error: 'No confidence snapshot found' });

    // Update household status
    const householdStatus = (snapshot.householdStatus || []) as any[];
    const memberIdx = householdStatus.findIndex((h: any) => h.userId === req.userId);
    if (memberIdx >= 0) {
      householdStatus[memberIdx].hasReviewed = true;
      await (prisma as any).tripConfidenceSnapshot.update({
        where: { id: snapshot.id },
        data: { householdStatus },
      });
    }

    // Notify trip owner
    if (snapshot.userId !== req.userId) {
      const reviewer = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { firstName: true },
      });
      await sendWebPush(snapshot.userId, {
        title: `${reviewer?.firstName || 'Co-pilot'} reviewed your trip plan`,
        body: 'Your trip plan has been reviewed ✅',
        url: '/basecamp',
      });
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error('[TripConfidence] Household review error:', e);
    res.status(500).json({ error: 'Failed to record review' });
  }
});

// GET /api/trip-confidence/:eventId/break-plan
router.get('/:eventId/break-plan', authenticateToken, async (req: any, res: Response) => {
  try {
    const { eventId } = req.params;
    const report = await generateConfidenceReport(eventId, req.userId);
    res.json({ breakPlan: report.breakPlan });
  } catch (e: any) {
    console.error('[TripConfidence] Break plan error:', e);
    res.status(500).json({ error: 'Failed to generate break plan' });
  }
});

// GET /api/trip-confidence/:eventId/v2  — V2 corridor-based report
router.get('/:eventId/v2', authenticateToken, async (req: any, res: Response) => {
  try {
    const { eventId } = req.params;
    const startLat = parseFloat(req.query.startLat as string);
    const startLon = parseFloat(req.query.startLon as string);
    const startOverride = !isNaN(startLat) && !isNaN(startLon)
      ? { lat: startLat, lon: startLon, label: req.query.startLabel as string }
      : undefined;

    const report = await generateConfidenceReport(eventId, req.userId, startOverride, true);
    await saveConfidenceSnapshot(eventId, req.userId, report);

    const event = await (prisma as any).event.findUnique({
      where: { id: eventId },
      select: { campgroundId: true },
    });
    if (event?.campgroundId) {
      await emitConfidenceEvents(report, eventId, event.campgroundId, req.userId).catch(() => {});
    }

    res.json(report);
  } catch (e: any) {
    console.error('[TripConfidence] V2 error:', e);
    res.status(500).json({ error: e.message || 'Failed to generate V2 report' });
  }
});

// GET /api/trip-confidence/:eventId/corridor — corridor segment data for map
router.get('/:eventId/corridor', authenticateToken, async (req: any, res: Response) => {
  try {
    const { eventId } = req.params;
    const corridor = await (prisma as any).routeCorridorAnalysis.findFirst({
      where: { eventId, userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!corridor) return res.status(404).json({ error: 'No corridor analysis found. Generate a V2 report first.' });
    res.json({
      segments: corridor.segments,
      totalMiles: corridor.totalMiles,
      totalHours: corridor.totalHours,
      overallScore: corridor.overallScore,
      safetyScore: corridor.safetyScore,
      comfortScore: corridor.comfortScore,
      convenienceScore: corridor.convenienceScore,
      flexibilityScore: corridor.flexibilityScore,
      status: corridor.status,
      routePolyline: corridor.routePolyline,
    });
  } catch (e: any) {
    console.error('[TripConfidence] Corridor error:', e);
    res.status(500).json({ error: 'Failed to load corridor' });
  }
});

export default router;
