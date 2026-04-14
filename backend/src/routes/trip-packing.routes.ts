import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';


const router = Router();
const prisma = new PrismaClient() as any;

// Helper to create basecamp activity
async function createBasecampActivity(
  userId: string, actorId: string, type: string,
  entityType: string, entityId: string, entityName: string, metadata?: any
) {
  try {
    await prisma.basecampActivity.create({
      data: { userId, actorId, type, entityType, entityId, entityName, metadata: metadata || {} }
    });
  } catch (error: any) {
    console.error('Failed to create basecamp activity:', error);
  }
}

// Helper to notify event attendees
async function notifyEventAttendees(
  eventId: string, actorId: string, type: string, entityName: string, metadata?: any
) {
  const attendees = await prisma.eventAttendee.findMany({
    where: { eventId, status: 'ATTENDING' },
    select: { userId: true }
  });
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true }
  });

  const userIds = new Set([...attendees.map((a: any) => a.userId), event?.organizerId].filter(Boolean) as string[]);
  userIds.delete(actorId);

  for (const userId of userIds) {
    await createBasecampActivity(userId, actorId, type, 'EVENT', eventId, entityName, metadata);
  }
}

// Helper to check attendee inventories and notify
async function notifyAttendeesWithItem(eventId: string, itemName: string, itemCategory: string, addedById: string, packItemId: string) {
  try {
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId },
      select: { userId: true }
    });
    
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true }
    });
    
    if (!event) return;
    
    for (const attendee of attendees) {
      if (attendee.userId === addedById) continue;
      
      const hasItem = await prisma.inventoryItem.findFirst({
        where: {
          userId: attendee.userId,
          name: { equals: itemName, mode: 'insensitive' }
        }
      });
      
      if (hasItem) {
        await prisma.basecampActivity.create({
          data: {
            userId: attendee.userId,
            actorId: addedById,
            type: 'PACK_ITEM_NEEDS_VOLUNTEER',
            entityType: 'EVENT',
            entityId: eventId,
            entityName: event.title,
            metadata: {
              itemName,
              itemCategory,
              packItemId,
              hasInInventory: true,
              inventoryItemId: hasItem.id
            }
          }
        });
      }
    }
  } catch (error: any) {
    console.error('Failed to notify attendees:', error);
  }
}

// GET /api/trip-pack/event/:eventId - Get packing list for event
router.get('/event/:eventId', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { eventId } = req.params;

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId } } }
        ]
      },
      include: {
        attendees: {
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } }
        }
      }
    });

    if (!event) return res.status(404).json({ error: 'Event not found or access denied' });

    const items = await prisma.tripPackItem.findMany({
      where: { eventId },
      include: {
        inventoryItem: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        packedBy: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ customCategory: 'asc' }, { createdAt: 'asc' }]
    });

    const total = items.length;
    const packed = items.filter((i: any) => i.isPacked).length;

    res.json({
      event,
      attendees: event.attendees.map((a: any) => a.user),
      items: items.map((item: any) => ({
        ...item,
        name: item.inventoryItem?.name || item.customName,
        category: item.inventoryItem?.category || item.customCategory || 'General'
      })),
      stats: { total, packed, unpacked: total - packed, progress: total > 0 ? Math.round((packed / total) * 100) : 0 },
      isComplete: total > 0 && packed === total,
      isOrganizer: event.organizerId === userId
    });
  } catch (error: any) {
    console.error('Get event pack list error:', error);
    res.status(500).json({ error: 'Failed to fetch packing list' });
  }
});

// GET /api/trip-pack/trip/:tripId - Get packing list for trip
router.get('/trip/:tripId', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { tripId } = req.params;

    const trip = await prisma.tripPlan.findFirst({
      where: { id: tripId, userId },
      include: { event: { select: { id: true, title: true, startDate: true, endDate: true } } }
    });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const items = await prisma.tripPackItem.findMany({
      where: { tripId },
      include: {
        inventoryItem: true,
        packedBy: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ isPacked: 'asc' }, { customCategory: 'asc' }, { createdAt: 'asc' }]
    });

    const total = items.length;
    const packed = items.filter((i: any) => i.isPacked).length;

    res.json({
      trip,
      items: items.map((item: any) => ({
        ...item,
        name: item.inventoryItem?.name || item.customName,
        category: item.inventoryItem?.category || item.customCategory || 'General'
      })),
      stats: { total, packed, unpacked: total - packed, progress: total > 0 ? Math.round((packed / total) * 100) : 0 },
      isComplete: total > 0 && packed === total
    });
  } catch (error: any) {
    console.error('Get trip pack list error:', error);
    res.status(500).json({ error: 'Failed to fetch packing list' });
  }
});

// POST /api/trip-pack - Add item to packing list
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { tripId, eventId, inventoryItemId, customName, customCategory, quantity, assignedToId } = req.body;

    if (!tripId && !eventId) return res.status(400).json({ error: 'Either tripId or eventId is required' });
    if (!inventoryItemId && !customName) return res.status(400).json({ error: 'Either inventoryItemId or customName is required' });

    let entityName = '';
    if (eventId) {
      const event = await prisma.event.findFirst({
        where: { id: eventId, OR: [{ organizerId: userId }, { attendees: { some: { userId } } }] }
      });
      if (!event) return res.status(403).json({ error: 'Access denied' });
      entityName = event.title;
    }

    let itemName = customName;
    if (inventoryItemId) {
      const inv = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, userId } });
      if (!inv) return res.status(404).json({ error: 'Inventory item not found' });
      itemName = inv.name;
    }

    const item = await prisma.tripPackItem.create({
      data: {
        tripId: tripId || null,
        eventId: eventId || null,
        inventoryItemId: inventoryItemId || null,
        customName: inventoryItemId ? null : customName?.trim(),
        customCategory: inventoryItemId ? null : (customCategory || 'General'),
        quantity: quantity || 1,
        assignedToId: assignedToId || null,
        assignmentStatus: assignedToId ? 'PENDING' : 'PENDING',
        createdById: userId
      },
      include: { inventoryItem: true, assignedTo: { select: { id: true, firstName: true, lastName: true } } }
    });

    if (assignedToId && assignedToId !== userId && eventId) {
      await prisma.basecampActivity.create({
        data: {
          userId: assignedToId,
          actorId: userId,
          type: 'PACK_ITEM_ASSIGNMENT_REQUEST',
          entityType: 'EVENT',
          entityId: eventId,
          entityName: entityName,
          metadata: { 
            itemName,
            packItemId: item.id,
            canRespond: true
          }
        }
      });
    }

    const responseItem = { ...item, name: item.inventoryItem?.name || item.customName, category: item.inventoryItem?.category || item.customCategory };
    
    // Notify attendees who have this item in their inventory
    if (eventId) {
      const itemName = item.inventoryItem?.name || item.customName || '';
      const itemCategory = item.inventoryItem?.category || item.customCategory || 'General';
      await notifyAttendeesWithItem(eventId, itemName, itemCategory, userId, item.id);
    }
    
    res.status(201).json(responseItem);
  } catch (error: any) {
    console.error('Add pack item error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// PUT /api/trip-pack/:id/toggle - Toggle packed status
router.put('/:id/toggle', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const item = await prisma.tripPackItem.findFirst({
      where: { id },
      include: { inventoryItem: true, event: { select: { id: true, title: true, organizerId: true } }, trip: { include: { event: { select: { title: true } } } } }
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });

    const canToggle = item.createdById === userId || item.assignedToId === userId || item.event?.organizerId === userId || item.trip?.userId === userId;
    if (!canToggle) return res.status(403).json({ error: 'Access denied' });

    const newStatus = !item.isPacked;
    const updated = await prisma.tripPackItem.update({
      where: { id },
      data: { isPacked: newStatus, packedAt: newStatus ? new Date() : null, packedById: newStatus ? userId : null }
    });

    if (item.eventId) {
      const itemName = item.inventoryItem?.name || item.customName;
      await notifyEventAttendees(item.eventId, userId, newStatus ? 'PACK_ITEM_PACKED' : 'PACK_ITEM_UNPACKED', item.event!.title, { itemName });

      const allItems = await prisma.tripPackItem.findMany({ where: { eventId: item.eventId } });
      const allPacked = allItems.every((i: any) => i.id === id ? newStatus : i.isPacked);
      if (allPacked && allItems.length > 0) {
        await notifyEventAttendees(item.eventId, userId, 'PACK_LIST_COMPLETE', item.event!.title, { totalItems: allItems.length });
      }
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Toggle pack item error:', error);
    res.status(500).json({ error: 'Failed to toggle item' });
  }
});

// PUT /api/trip-pack/:id/assign - Assign item to user
router.put('/:id/assign', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { assignedToId } = req.body;

    const item = await prisma.tripPackItem.findFirst({
      where: { id },
      include: { 
        inventoryItem: true, 
        event: { select: { id: true, title: true, organizerId: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    // Allow organizer or any attendee to assign
    const itemName = item.inventoryItem?.name || item.customName;

    const updated = await prisma.tripPackItem.update({
      where: { id },
      data: { 
        assignedToId: assignedToId || null, 
        assignmentStatus: assignedToId ? 'PENDING' : 'PENDING', 
        declinedAt: null, 
        declineReason: null 
      },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } }
    });

    // Notify the assigned person
    if (assignedToId && assignedToId !== userId && item.eventId) {
      await prisma.basecampActivity.create({
        data: {
          userId: assignedToId,
          actorId: userId,
          type: 'PACK_ITEM_ASSIGNMENT_REQUEST',
          entityType: 'EVENT',
          entityId: item.eventId,
          entityName: item.event!.title,
          metadata: { 
            itemName,
            packItemId: id,
            canRespond: true
          }
        }
      });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Assign pack item error:', error);
    res.status(500).json({ error: 'Failed to assign item' });
  }
});

// PUT /api/trip-pack/:id/respond - Accept or decline assignment
router.put('/:id/respond', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { accept, reason } = req.body;

    const item = await prisma.tripPackItem.findFirst({
      where: { id, assignedToId: userId },
      include: { inventoryItem: true, event: { select: { id: true, title: true, organizerId: true } } }
    });

    if (!item) return res.status(404).json({ error: 'Item not found or not assigned to you' });

    const itemName = item.inventoryItem?.name || item.customName;

    if (accept) {
      const updated = await prisma.tripPackItem.update({ where: { id }, data: { assignmentStatus: 'ACCEPTED' } });
      
      // Get user's name for the activity
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true }
      });
      const userName = user ? `${user.firstName} ${user.lastName}` : 'Someone';
      
      // Notify organizer
      if (item.event?.organizerId) {
        await createBasecampActivity(item.event.organizerId, userId, 'PACK_ITEM_ACCEPTED', 'EVENT', item.eventId!, item.event.title, { itemName });
      }
      
      // Create profile activity: "[User] is packing for a camping trip!"
      try {
        await prisma.activity.create({
          data: {
            userId: userId,
            type: 'PACKING_FOR_TRIP',
            eventId: item.eventId,
            title: item.event!.title,
            content: 'is packing for a camping trip! 🎒',
            isPublic: true
          }
        });
        console.log('Created PACKING_FOR_TRIP activity for user:', userId);
      } catch (e: any) {
        console.error('Failed to create profile activity:', e);
      }
      
      res.json(updated);
    } else {
      const updated = await prisma.tripPackItem.update({
        where: { id },
        data: { assignedToId: null, assignmentStatus: 'DECLINED', declinedAt: new Date(), declineReason: reason || null }
      });
      if (item.eventId) {
        await notifyEventAttendees(item.eventId, userId, 'PACK_ITEM_DECLINED', item.event!.title, { itemName, reason });
      }
      res.json(updated);
    }
  } catch (error: any) {
    console.error('Respond to assignment error:', error);
    res.status(500).json({ error: 'Failed to respond' });
  }
});

// DELETE /api/trip-pack/:id
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const item = await prisma.tripPackItem.findFirst({
      where: { id },
      include: { event: { select: { organizerId: true } }, trip: { select: { userId: true } } }
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });

    const canDelete = item.createdById === userId || item.trip?.userId === userId || item.event?.organizerId === userId;
    if (!canDelete) return res.status(403).json({ error: 'Access denied' });

    await prisma.tripPackItem.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete pack item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// POST /api/trip-pack/unpack-all
router.post('/unpack-all', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { tripId, eventId } = req.body;

    if (!tripId && !eventId) return res.status(400).json({ error: 'Either tripId or eventId required' });

    await prisma.tripPackItem.updateMany({
      where: tripId ? { tripId } : { eventId },
      data: { isPacked: false, packedAt: null, packedById: null }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Unpack all error:', error);
    res.status(500).json({ error: 'Failed to unpack all' });
  }
});

// GET /api/trip-pack/my-assignments
router.get('/my-assignments', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;

    const items = await prisma.tripPackItem.findMany({
      where: {
        assignedToId: userId,
        event: { endDate: { gte: new Date() } }
      },
      include: {
        inventoryItem: true,
        event: { select: { id: true, title: true, startDate: true, endDate: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const pending = items.filter((i: any) => i.assignmentStatus === 'PENDING');
    const accepted = items.filter((i: any) => i.assignmentStatus === 'ACCEPTED');

    res.json({
      pending: pending.map((item: any) => ({ ...item, name: item.inventoryItem?.name || item.customName, eventTitle: item.event?.title })),
      accepted: accepted.map((item: any) => ({ ...item, name: item.inventoryItem?.name || item.customName, eventTitle: item.event?.title })),
      stats: { pending: pending.length, accepted: accepted.length, packed: accepted.filter((i: any) => i.isPacked).length }
    });
  } catch (error: any) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// POST /api/trip-packing/import-personal/:eventId
// Copies user's personal pack items into the event packing list (skips dupes)
router.post('/import-personal/:eventId', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { eventId } = req.params;

    // Verify user has access to event
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [{ organizerId: userId }, { attendees: { some: { userId } } }],
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Get personal pack items (not event-specific ones — general items)
    const personalItems = await prisma.personalPackItem.findMany({
      where: { userId, eventId: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    if (personalItems.length === 0) {
      return res.json({ imported: 0, message: 'No personal gear items found. Add items to My Gear first.' });
    }

    // Get existing event pack items to avoid duplicates
    const existing = await prisma.tripPackItem.findMany({
      where: { eventId, createdById: userId },
      select: { customName: true },
    });
    const existingNames = new Set(existing.map((i: any) => i.customName?.toLowerCase().trim()));

    // Import items that don't already exist
    let imported = 0;
    for (const item of personalItems) {
      const nameLower = item.name.toLowerCase().trim();
      if (existingNames.has(nameLower)) continue;
      await prisma.tripPackItem.create({
        data: {
          eventId,
          createdById: userId,
          customName: item.name,
          customCategory: item.category || 'General',
          quantity: item.quantity || 1,
          notes: item.notes || null,
          isPacked: false,
        },
      });
      imported++;
    }

    res.json({
      imported,
      skipped: personalItems.length - imported,
      message: imported > 0
        ? `Imported ${imported} items from your gear list`
        : 'All your gear items are already in this packing list',
    });
  } catch (e: any) {
    console.error('[TripPacking] import-personal error:', e?.message);
    res.status(500).json({ error: 'Failed to import personal items' });
  }
});


export default router;
