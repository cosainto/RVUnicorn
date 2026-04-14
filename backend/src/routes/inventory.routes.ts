import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

const DEFAULT_CATEGORIES = [
  'Kitchen', 'Sleeping', 'Clothing', 'Safety', 'Recreation', 'Hygiene', 'Electronics', 'General'
];

// GET /api/inventory - Get all inventory items
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    
    const items = await prisma.inventoryItem.findMany({
      where: { userId },
      include: {
        tripPackItems: {
          where: {
            OR: [
              { trip: { event: { endDate: { gte: new Date() } } } },
              { event: { endDate: { gte: new Date() } } }
            ]
          },
          include: {
            trip: { include: { event: { select: { id: true, title: true, startDate: true, endDate: true } } } },
            event: { select: { id: true, title: true, startDate: true, endDate: true } }
          }
        }
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    const grouped = items.reduce((acc: any, item: any) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push({
        ...item,
        assignedTrips: item.tripPackItems.map((tpi: any) => ({
          tripPackItemId: tpi.id,
          tripId: tpi.tripId,
          eventId: tpi.eventId,
          eventTitle: tpi.trip?.event?.title || tpi.event?.title,
          startDate: tpi.trip?.event?.startDate || tpi.event?.startDate,
          endDate: tpi.trip?.event?.endDate || tpi.event?.endDate,
          isPacked: tpi.isPacked
        }))
      });
      return acc;
    }, {});

    res.json({
      items,
      grouped,
      categories: DEFAULT_CATEGORIES,
      stats: {
        total: items.length,
        assigned: items.filter((i: any) => i.tripPackItems.length > 0).length,
        available: items.filter((i: any) => i.tripPackItems.length === 0).length
      }
    });
  } catch (error: any) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// GET /api/inventory/categories
router.get('/categories', authenticateToken, async (req, res) => {
  res.json(DEFAULT_CATEGORIES);
});

// POST /api/inventory - Add new item
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, category, quantity, notes, imageUrl } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        userId,
        name: name.trim(),
        category: category || 'General',
        quantity: quantity || 1,
        notes: notes?.trim() || null,
        imageUrl: imageUrl || null
      }
    });

    res.status(201).json(item);
  } catch (error: any) {
    console.error('Create inventory item error:', error);
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

// PUT /api/inventory/:id - Update item
router.put('/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { name, category, quantity, notes, imageUrl } = req.body;

    const existing = await prisma.inventoryItem.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        category: category || existing.category,
        quantity: quantity ?? existing.quantity,
        notes: notes !== undefined ? notes?.trim() || null : existing.notes,
        imageUrl: imageUrl !== undefined ? imageUrl || null : existing.imageUrl
      }
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const existing = await prisma.inventoryItem.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    await prisma.inventoryItem.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

export default router;
