import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// POST /api/feed/hide/:activityId — hide a post
router.post('/hide/:activityId', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    await prisma.hiddenPost.upsert({
      where: { userId_activityId: { userId, activityId: req.params.activityId } },
      create: { userId, activityId: req.params.activityId, reason: 'manual' },
      update: {},
    });
    await prisma.feedSignal.create({ data: { userId, signalType: 'hide' } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to hide' }); }
});

// DELETE /api/feed/hide/:activityId — undo hide
router.delete('/hide/:activityId', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    await prisma.hiddenPost.deleteMany({ where: { userId, activityId: req.params.activityId } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to unhide' }); }
});

// GET /api/feed/hidden — recent hidden posts
router.get('/hidden', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const hidden = await prisma.hiddenPost.findMany({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ hidden });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/feed/preference/:targetUserId — set preference
router.post('/preference/:targetUserId', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const { type } = req.body;
    if (!['see_less', 'mute', 'block'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const expiresAt = type === 'mute' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

    await prisma.feedPreference.upsert({
      where: { userId_targetUserId: { userId, targetUserId: req.params.targetUserId } },
      create: { userId, targetUserId: req.params.targetUserId, type, expiresAt },
      update: { type, expiresAt },
    });
    await prisma.feedSignal.create({ data: { userId, signalType: type, authorId: req.params.targetUserId } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// DELETE /api/feed/preference/:targetUserId — remove preference
router.delete('/preference/:targetUserId', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    await prisma.feedPreference.deleteMany({ where: { userId, targetUserId: req.params.targetUserId } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// GET /api/feed/preferences — list all preferences
router.get('/preferences', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const prefs = await prisma.feedPreference.findMany({
      where: { userId },
      include: { target: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ preferences: prefs });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/feed/content-type-preference — set content type preference
router.post('/content-type-preference', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const { contentType, preference } = req.body;
    if (!['less', 'summary', 'off'].includes(preference)) return res.status(400).json({ error: 'Invalid preference' });

    await prisma.contentTypePreference.upsert({
      where: { userId_contentType: { userId, contentType } },
      create: { userId, contentType, preference },
      update: { preference },
    });
    await prisma.feedSignal.create({ data: { userId, signalType: 'hide_system', contentType } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/feed/signal — log a signal
router.post('/signal', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const { signalType, authorId, contentType } = req.body;
    await prisma.feedSignal.create({ data: { userId, signalType, authorId, contentType } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// Exported: expire mutes (called from cron)
export async function expireFeedMutes() {
  try {
    const expired = await prisma.feedPreference.findMany({
      where: { type: 'mute', expiresAt: { lt: new Date() } },
      include: {
        target: { select: { firstName: true } },
        user: { select: { id: true } },
      },
    });
    for (const pref of expired) {
      await prisma.feedPreference.delete({ where: { id: pref.id } });
      // Soft landing notification
      await prisma.notification.create({
        data: {
          userId: pref.userId,
          type: 'MUTE_EXPIRED',
          content: `Your break from ${pref.target.firstName} has ended`,
          category: 'SYSTEM',
        },
      }).catch(() => {});
    }
  } catch {}
}

export default router;
