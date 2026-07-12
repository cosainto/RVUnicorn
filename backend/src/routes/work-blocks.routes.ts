import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// GET /api/events/:eventId/work-blocks
router.get('/:eventId/work-blocks', authenticateToken, async (req: any, res) => {
  try {
    const { eventId } = req.params;
    const blocks = await prisma.workBlock.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } }
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    });
    res.json(blocks);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/events/:eventId/work-blocks
router.post('/:eventId/work-blocks', authenticateToken, async (req: any, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;
    const { date, startTime, endTime, note } = req.body;
    if (!date || !startTime || !endTime) return res.status(400).json({ error: 'date, startTime, endTime required' });
    const block = await prisma.workBlock.create({
      data: { eventId, userId, date, startTime, endTime, note: note || null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } }
      }
    });
    res.json(block);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/events/:eventId/work-blocks/:id
router.delete('/:eventId/work-blocks/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const block = await prisma.workBlock.findUnique({ where: { id } });
    if (!block) return res.status(404).json({ error: 'Not found' });
    if (block.userId !== userId) return res.status(403).json({ error: 'Not yours' });
    await prisma.workBlock.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
