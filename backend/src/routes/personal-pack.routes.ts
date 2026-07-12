import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// GET /api/personal-pack - Get user's personal pack list
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { tripId, eventId, unpackedOnly } = req.query;

    const where: any = { userId };
    if (tripId) where.tripId = tripId;
    if (eventId) where.eventId = eventId;
    if (unpackedOnly === 'true') where.isPacked = false;

    const items = await prisma.personalPackItem.findMany({
      where,
      include: {
        trip: {
          select: { id: true, startLocation: true },
        },
        event: {
          select: { id: true, title: true, startDate: true },
        },
      },
      orderBy: [
        { isPacked: 'asc' },
        { category: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Get stats
    const totalItems = items.length;
    const packedItems = items.filter((i: any) => i.isPacked).length;

    res.json({
      items,
      stats: {
        total: totalItems,
        packed: packedItems,
        unpacked: totalItems - packedItems,
        progress: totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0,
      },
    });
  } catch (error: any) {
    console.error('Get personal pack list error:', error);
    res.status(500).json({ error: 'Failed to get pack list' });
  }
});

// POST /api/personal-pack - Add item to pack list
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { name, category, quantity, tripId, eventId, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const item = await prisma.personalPackItem.create({
      data: {
        userId,
        name: name.trim(),
        category: category || 'General',
        quantity: quantity || 1,
        tripId: tripId || null,
        eventId: eventId || null,
        notes: notes || null,
      },
      include: {
        trip: {
          select: { id: true, startLocation: true },
        },
        event: {
          select: { id: true, title: true, startDate: true },
        },
      },
    });

    res.json(item);
  } catch (error: any) {
    console.error('Add pack item error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// PUT /api/personal-pack/:id - Update item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { name, category, quantity, isPacked, tripId, eventId, notes } = req.body;

    // Verify ownership
    const existing = await prisma.personalPackItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = await prisma.personalPackItem.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        category: category !== undefined ? category : undefined,
        quantity: quantity !== undefined ? quantity : undefined,
        isPacked: isPacked !== undefined ? isPacked : undefined,
        tripId: tripId !== undefined ? tripId : undefined,
        eventId: eventId !== undefined ? eventId : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
      include: {
        trip: {
          select: { id: true, startLocation: true },
        },
        event: {
          select: { id: true, title: true, startDate: true },
        },
      },
    });

    res.json(item);
  } catch (error: any) {
    console.error('Update pack item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// POST /api/personal-pack/:id/toggle - Toggle packed status
router.post('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const existing = await prisma.personalPackItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = await prisma.personalPackItem.update({
      where: { id },
      data: { isPacked: !existing.isPacked },
    });

    res.json(item);
  } catch (error: any) {
    console.error('Toggle pack item error:', error);
    res.status(500).json({ error: 'Failed to toggle item' });
  }
});

// DELETE /api/personal-pack/:id - Delete item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const existing = await prisma.personalPackItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await prisma.personalPackItem.delete({ where: { id } });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete pack item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// POST /api/personal-pack/unpack-all - Unpack all items
router.post('/unpack-all', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { tripId, eventId } = req.body;

    const where: any = { userId, isPacked: true };
    if (tripId) where.tripId = tripId;
    if (eventId) where.eventId = eventId;

    await prisma.personalPackItem.updateMany({
      where,
      data: { isPacked: false },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Unpack all error:', error);
    res.status(500).json({ error: 'Failed to unpack all' });
  }
});

// POST /api/personal-pack/pack-all - Pack all items
router.post('/pack-all', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { tripId, eventId } = req.body;

    const where: any = { userId, isPacked: false };
    if (tripId) where.tripId = tripId;
    if (eventId) where.eventId = eventId;

    await prisma.personalPackItem.updateMany({
      where,
      data: { isPacked: true },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Pack all error:', error);
    res.status(500).json({ error: 'Failed to pack all' });
  }
});

// GET /api/personal-pack/categories - Get available categories
router.get('/categories', authenticateToken, async (req, res) => {
  const categories = [
    'General',
    'Clothing',
    'Kitchen',
    'Safety',
    'Electronics',
    'Toiletries',
    'Outdoor Gear',
    'Bedding',
    'Tools',
    'Food',
    'Documents',
    'Entertainment',
    'Pet Supplies',
    'Kids',
    'Other',
  ];
  res.json(categories);
});

export default router;
