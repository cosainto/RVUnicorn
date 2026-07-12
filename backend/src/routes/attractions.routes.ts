import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// GET /api/attractions
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const attractions = await prisma.attraction.findMany({
      where: { userId },
      orderBy: [{ state: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(attractions);
  } catch (error: any) {
    console.error('Get attractions error:', error);
    res.status(500).json({ error: 'Failed to get attractions' });
  }
});

// POST /api/attractions
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { name, type, state, city, address, imageUrl, description, website } = req.body;
    if (!name || !state) {
      return res.status(400).json({ error: 'Name and state are required' });
    }
    const attraction = await prisma.attraction.create({
      data: { userId, name, type: type || 'other', state, city, address, imageUrl, description, website, isVisited: false },
    });
    res.status(201).json(attraction);
  } catch (error: any) {
    console.error('Create attraction error:', error);
    res.status(500).json({ error: 'Failed to create attraction' });
  }
});

// PUT /api/attractions/:id
router.put('/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { name, type, state, city, address, imageUrl, description, website, isVisited, rating } = req.body;
    const existing = await prisma.attraction.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Attraction not found' });
    }
    const attraction = await prisma.attraction.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(state !== undefined && { state }),
        ...(city !== undefined && { city }),
        ...(address !== undefined && { address }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(description !== undefined && { description }),
        ...(website !== undefined && { website }),
        ...(isVisited !== undefined && { isVisited }),
        ...(rating !== undefined && { rating }),
      },
    });
    res.json(attraction);
  } catch (error: any) {
    console.error('Update attraction error:', error);
    res.status(500).json({ error: 'Failed to update attraction' });
  }
});

// DELETE /api/attractions/:id
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const existing = await prisma.attraction.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Attraction not found' });
    }
    await prisma.attraction.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete attraction error:', error);
    res.status(500).json({ error: 'Failed to delete attraction' });
  }
});

export default router;
