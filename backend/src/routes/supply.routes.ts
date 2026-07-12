import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

const include = {
  createdBy: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
  claimedBy: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
};

// GET /api/supply/:eventId
router.get('/:eventId', authenticateToken, async (req: any, res: Response) => {
  try {
    const items = await prisma.supplyItem.findMany({
      where: { eventId: req.params.eventId },
      include,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch supply list' });
  }
});

// POST /api/supply/:eventId
router.post('/:eventId', authenticateToken, async (req: any, res: Response) => {
  try {
    const { title, quantity, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const item = await prisma.supplyItem.create({
      data: {
        eventId: req.params.eventId,
        title,
        quantity: quantity || null,
        priority: priority || 'NORMAL',
        createdById: req.userId,
      },
      include,
    });
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create supply item' });
  }
});

// PATCH /api/supply/:eventId/:itemId/claim — claim or unclaim
router.patch('/:eventId/:itemId/claim', authenticateToken, async (req: any, res: Response) => {
  try {
    const item = await prisma.supplyItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Toggle: if already claimed by this user, unclaim; else claim
    const alreadyClaimed = item.claimedById === req.userId;
    const updated = await prisma.supplyItem.update({
      where: { id: req.params.itemId },
      data: { claimedById: alreadyClaimed ? null : req.userId },
      include,
    });

    // Notify event attendees if claiming (not unclaiming)
    if (!alreadyClaimed) {
      const event = await prisma.event.findUnique({
        where: { id: req.params.eventId },
        include: { attendees: { select: { userId: true } } },
      });
      const claimer = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { firstName: true, lastName: true },
      });
      if (event && claimer) {
        const name = `${claimer.firstName} ${claimer.lastName}`.trim();
        const notifyIds = event.attendees
          .map((a: any) => a.userId)
          .filter((id: any) => id !== req.userId);
        await Promise.all(notifyIds.map((userId: any) =>
          prisma.notification.create({
            data: {
              userId,
              type: 'SUPPLY_CLAIMED',
              content: `${name} is bringing ${item.title}`,
              link: `/trips/${req.params.eventId}`,
            },
          }).catch(() => {})
        ));
      }
    }

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update supply item' });
  }
});

// DELETE /api/supply/:eventId/:itemId
router.delete('/:eventId/:itemId', authenticateToken, async (req: any, res: Response) => {
  try {
    const item = await prisma.supplyItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.createdById !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.supplyItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete supply item' });
  }
});

export default router;
