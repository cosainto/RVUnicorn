import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
import { prisma } from '../lib/prisma';
const anthropic = new Anthropic();

const REGIONS: Record<string, string[]> = {
  west: ['CA','OR','WA','AK','HI','NV','AZ','UT','ID','MT','WY','CO','NM'],
  midwest: ['IL','IN','OH','MI','WI','MN','IA','MO','ND','SD','NE','KS'],
  south: ['TX','OK','AR','LA','MS','AL','GA','FL','SC','NC','TN','KY','WV','VA'],
  northeast: ['ME','NH','VT','MA','RI','CT','NY','NJ','PA','MD','DE'],
};

// ══ GET /api/onboarding/photos ══
router.get('/photos', async (_req, res: Response) => {
  try {
    const campgrounds = await prisma.campground.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true, state: true },
      take: 200,
    });

    const shuffle = (arr: any[]) => arr.sort(() => Math.random() - 0.5);
    const byRegion: Record<string, string[]> = { west: [], midwest: [], south: [], northeast: [], all: [] };

    for (const cg of shuffle(campgrounds)) {
      if (!cg.imageUrl) continue;
      byRegion.all.push(cg.imageUrl);
      for (const [region, states] of Object.entries(REGIONS)) {
        if (cg.state && states.includes(cg.state)) {
          byRegion[region].push(cg.imageUrl);
          break;
        }
      }
    }

    // Limit each to 5
    for (const key of Object.keys(byRegion)) byRegion[key] = byRegion[key].slice(0, 5);

    res.json(byRegion);
  } catch { res.json({ west: [], midwest: [], south: [], northeast: [], all: [] }); }
});

// ══ PATCH /api/onboarding/progress ══
router.patch('/progress', authenticateToken, async (req: any, res: Response) => {
  try {
    const { camperType, region, rigType } = req.body;
    const data: any = {};
    if (camperType) data.onboardingCamperType = camperType;
    if (region) data.onboardingRegion = region;
    if (rigType) data.onboardingRigType = rigType;

    await prisma.user.update({ where: { id: req.userId }, data });
    await prisma.onboardingEvent.create({ data: { userId: req.userId, event: 'onboarding_progress', metadata: req.body } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ PATCH /api/onboarding/complete ══
router.patch('/complete', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.user.update({ where: { id: req.userId }, data: { onboardingCompletedAt: new Date(), onboardingCompleted: true } });
    await prisma.onboardingEvent.create({ data: { userId: req.userId, event: 'onboarding_completed', metadata: req.body } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ PATCH /api/onboarding/skip ══
router.patch('/skip', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.user.update({ where: { id: req.userId }, data: { onboardingSkippedAt: new Date() } });
    await prisma.onboardingEvent.create({ data: { userId: req.userId, event: 'onboarding_skipped', metadata: req.body } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ GET /api/onboarding/nudge-status ══
router.get('/nudge-status', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { nudgeCardDismissedAt: true, nudgeRigCompleted: true, nudgeHomeBaseCompleted: true, nudgeCheckinCompleted: true, rvMake: true, rvModel: true, location: true },
    });
    if (!user) return res.json({ dismissed: true });

    const checkinCount = await prisma.checkIn.count({ where: { userId: req.userId } });

    // Auto-verify from DB
    const rigCompleted = !!(user.rvMake || user.rvModel);
    const homeBaseCompleted = !!user.location;
    const checkinCompleted = checkinCount > 0;

    // Update if DB state differs
    if (rigCompleted !== user.nudgeRigCompleted || homeBaseCompleted !== user.nudgeHomeBaseCompleted || checkinCompleted !== user.nudgeCheckinCompleted) {
      await prisma.user.update({ where: { id: req.userId }, data: { nudgeRigCompleted: rigCompleted, nudgeHomeBaseCompleted: homeBaseCompleted, nudgeCheckinCompleted: checkinCompleted } });
    }

    const completedCount = [rigCompleted, homeBaseCompleted, checkinCompleted].filter(Boolean).length;

    res.json({
      dismissed: !!user.nudgeCardDismissedAt || completedCount === 3,
      rigCompleted, homeBaseCompleted, checkinCompleted, completedCount,
    });
  } catch { res.json({ dismissed: true }); }
});

// ══ PATCH /api/onboarding/nudge-progress ══
router.patch('/nudge-progress', authenticateToken, async (req: any, res: Response) => {
  try {
    const { item } = req.body;
    const data: any = {};
    if (item === 'rig') data.nudgeRigCompleted = true;
    if (item === 'homebase') data.nudgeHomeBaseCompleted = true;
    if (item === 'checkin') data.nudgeCheckinCompleted = true;
    await prisma.user.update({ where: { id: req.userId }, data });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ══ PATCH /api/onboarding/nudge-dismiss ══
router.patch('/nudge-dismiss', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.user.update({ where: { id: req.userId }, data: { nudgeCardDismissedAt: new Date() } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ══ POST /api/onboarding/hitch-greeting ══
router.post('/hitch-greeting', authenticateToken, async (req: any, res: Response) => {
  try {
    const { camperType, rigType, region, displayName } = req.body;
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 80, temperature: 0.8,
      messages: [{ role: 'user', content: `You are Hitch, a warm experienced RV community guide. Write a welcome message (2 sentences max) for a new RVUnicorn user named ${displayName || 'friend'}. Camper type: ${camperType || 'unknown'}. Rig type: ${rigType || 'unknown'}. Preferred region: ${region || 'anywhere'}. Rules: Warm, specific, not generic. Reference their rig type or region naturally if available. Do NOT say 'Welcome to RVUnicorn'. Sound like a fellow traveler. End with an open invitation to explore. Max 2 sentences. Return only the message.` }],
    });
    const message = (response.content[0] as any)?.text?.trim() || 'Good to have you around the campfire. Pull up a chair and explore — this community is yours now.';
    res.json({ message });
  } catch { res.json({ message: 'Good to have you around the campfire. The road ahead is wide open — let\'s find your next stop.' }); }
});

export default router;
