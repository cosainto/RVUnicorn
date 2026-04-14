import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

const STARTER_TEMPLATES = [
  {
    name: 'Weekend Camping Trip',
    description: 'Essential items for a 2-3 day camping trip',
    items: [
      { name: 'Tent', category: 'Sleeping', quantity: 1 },
      { name: 'Sleeping Bag', category: 'Sleeping', quantity: 1 },
      { name: 'Sleeping Pad', category: 'Sleeping', quantity: 1 },
      { name: 'Camp Stove', category: 'Kitchen', quantity: 1 },
      { name: 'Cooler', category: 'Kitchen', quantity: 1 },
      { name: 'Flashlight', category: 'Safety', quantity: 1 },
      { name: 'First Aid Kit', category: 'Safety', quantity: 1 },
      { name: 'Camp Chairs', category: 'Recreation', quantity: 2 }
    ]
  },
  {
    name: 'RV Trip Essentials',
    description: 'Must-haves for RV camping',
    items: [
      { name: 'Water Hose', category: 'General', quantity: 1 },
      { name: 'Sewer Hose', category: 'General', quantity: 1 },
      { name: 'Leveling Blocks', category: 'General', quantity: 1 },
      { name: 'Power Cord', category: 'Electronics', quantity: 1 },
      { name: 'Surge Protector', category: 'Electronics', quantity: 1 },
      { name: 'Wheel Chocks', category: 'Safety', quantity: 2 }
    ]
  },
  {
    name: 'Cooking Supplies',
    description: 'Everything for camp cooking',
    items: [
      { name: 'Camp Stove', category: 'Kitchen', quantity: 1 },
      { name: 'Propane', category: 'Kitchen', quantity: 2 },
      { name: 'Cast Iron Skillet', category: 'Kitchen', quantity: 1 },
      { name: 'Cooking Utensils', category: 'Kitchen', quantity: 1 },
      { name: 'Cooler', category: 'Kitchen', quantity: 1 },
      { name: 'Dish Soap', category: 'Kitchen', quantity: 1 }
    ]
  },
  {
    name: 'Safety & First Aid',
    description: 'Safety essentials',
    items: [
      { name: 'First Aid Kit', category: 'Safety', quantity: 1 },
      { name: 'Fire Extinguisher', category: 'Safety', quantity: 1 },
      { name: 'Flashlights', category: 'Safety', quantity: 2 },
      { name: 'Extra Batteries', category: 'Safety', quantity: 1 },
      { name: 'Sunscreen', category: 'Safety', quantity: 1 },
      { name: 'Bug Spray', category: 'Safety', quantity: 1 }
    ]
  }
];

// GET /api/pack-templates
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;

    const myTemplates = await prisma.packingListTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    const publicTemplates = await prisma.packingListTemplate.findMany({
      where: { privacy: 'PUBLIC', userId: { not: userId } },
      include: { user: { select: { firstName: true, lastName: true, username: true } } },
      orderBy: { copiedCount: 'desc' },
      take: 20
    });

    res.json({ myTemplates, publicTemplates, starterTemplates: STARTER_TEMPLATES });
  } catch (error: any) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/pack-templates
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, description, privacy, items } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items required' });

    const template = await prisma.packingListTemplate.create({
      data: {
        userId,
        name: name.trim(),
        description: description?.trim() || null,
        privacy: privacy || 'PRIVATE',
        items: items.map((i: any) => ({ name: i.name, category: i.category || 'General', quantity: i.quantity || 1 }))
      }
    });

    res.status(201).json(template);
  } catch (error: any) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// POST /api/pack-templates/from-trip
router.post('/from-trip', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { tripId, eventId, name, description, privacy } = req.body;

    if (!tripId && !eventId) return res.status(400).json({ error: 'tripId or eventId required' });

    const items = await prisma.tripPackItem.findMany({
      where: tripId ? { tripId } : { eventId },
      include: { inventoryItem: true }
    });

    if (items.length === 0) return res.status(400).json({ error: 'No items to save' });

    const template = await prisma.packingListTemplate.create({
      data: {
        userId,
        name: name?.trim() || 'Saved Packing List',
        description: description?.trim() || null,
        privacy: privacy || 'PRIVATE',
        items: items.map((i: any) => ({
          name: i.inventoryItem?.name || i.customName || 'Item',
          category: i.inventoryItem?.category || i.customCategory || 'General',
          quantity: i.quantity
        }))
      }
    });

    res.status(201).json(template);
  } catch (error: any) {
    console.error('Create from trip error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// POST /api/pack-templates/:id/apply
router.post('/:id/apply', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { tripId, eventId, useInventory } = req.body;

    if (!tripId && !eventId) return res.status(400).json({ error: 'tripId or eventId required' });

    const template = await prisma.packingListTemplate.findFirst({
      where: { id, OR: [{ userId }, { privacy: 'PUBLIC' }, { privacy: 'FRIENDS' }] }
    });

    if (!template) return res.status(404).json({ error: 'Template not found' });

    const templateItems = template.items as any[];
    let itemsToCreate: any[] = [];

    if (useInventory) {
      const inventory = await prisma.inventoryItem.findMany({ where: { userId } });
      const invMap = new Map(inventory.map((i: any) => [i.name.toLowerCase(), i]));

      itemsToCreate = templateItems.map(item => {
        const matched = invMap.get(item.name.toLowerCase());
        return {
          tripId: tripId || null, eventId: eventId || null,
          // @ts-ignore
          inventoryItemId: matched?.id || null,
          customName: matched ? null : item.name,
          customCategory: matched ? null : item.category,
          quantity: item.quantity || 1, createdById: userId
        };
      });
    } else {
      itemsToCreate = templateItems.map(item => ({
        tripId: tripId || null, eventId: eventId || null,
        customName: item.name, customCategory: item.category,
        quantity: item.quantity || 1, createdById: userId
      }));
    }

    const created = await prisma.tripPackItem.createMany({ data: itemsToCreate });

    if (template.userId !== userId) {
      await prisma.packingListTemplate.update({ where: { id }, data: { copiedCount: { increment: 1 } } });
    }

    res.json({ created: created.count });
  } catch (error: any) {
    console.error('Apply template error:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

// POST /api/pack-templates/starter/:index/apply
router.post('/starter/:index/apply', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const index = parseInt(req.params.index);
    const { tripId, eventId, useInventory } = req.body;

    if (isNaN(index) || index < 0 || index >= STARTER_TEMPLATES.length) {
      return res.status(400).json({ error: 'Invalid template index' });
    }

    if (!tripId && !eventId) return res.status(400).json({ error: 'tripId or eventId required' });

    const template = STARTER_TEMPLATES[index];
    let itemsToCreate: any[] = [];

    if (useInventory) {
      const inventory = await prisma.inventoryItem.findMany({ where: { userId } });
      const invMap = new Map(inventory.map((i: any) => [i.name.toLowerCase(), i]));

      itemsToCreate = template.items.map(item => {
        const matched = invMap.get(item.name.toLowerCase());
        return {
          tripId: tripId || null, eventId: eventId || null,
          // @ts-ignore
          inventoryItemId: matched?.id || null,
          customName: matched ? null : item.name,
          customCategory: matched ? null : item.category,
          quantity: item.quantity || 1, createdById: userId
        };
      });
    } else {
      itemsToCreate = template.items.map(item => ({
        tripId: tripId || null, eventId: eventId || null,
        customName: item.name, customCategory: item.category,
        quantity: item.quantity || 1, createdById: userId
      }));
    }

    const created = await prisma.tripPackItem.createMany({ data: itemsToCreate });
    res.json({ created: created.count });
  } catch (error: any) {
    console.error('Apply starter error:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

// DELETE /api/pack-templates/:id
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const existing = await prisma.packingListTemplate.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await prisma.packingListTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
