import { Router, Request, Response } from 'express';
// @ts-ignore
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

// POST /api/push/subscribe
router.post('/subscribe', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[Push] Subscribe error:', e);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

export default router;
