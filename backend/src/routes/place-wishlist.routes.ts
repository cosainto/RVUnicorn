import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// GET /api/place-wishlist - get user's saved places
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const items = await prisma.placeWishlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/place-wishlist - save a place
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { placeId, name, address, sourceUrl, imageUrl, type, rating, notes } = req.body;
    if (!placeId || !name) return res.status(400).json({ error: 'placeId and name required' });
    const item = await prisma.placeWishlist.upsert({
      where: { userId_placeId: { userId, placeId } },
      update: { name, address, sourceUrl, imageUrl, type, rating, notes },
      create: { userId, placeId, name, address, sourceUrl, imageUrl, type: type || 'ATTRACTION', rating, notes },
    });
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/place-wishlist/:placeId - remove a place
router.delete('/:placeId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { placeId } = req.params;
    await prisma.placeWishlist.deleteMany({ where: { userId, placeId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/place-wishlist/check/:placeId
router.get('/check/:placeId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { placeId } = req.params;
    const item = await prisma.placeWishlist.findUnique({
      where: { userId_placeId: { userId, placeId } },
    });
    res.json({ saved: !!item, id: item?.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
