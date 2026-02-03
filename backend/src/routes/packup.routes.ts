import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

// Common RV storage locations
const COMMON_STORAGE_LOCATIONS = [
  'Under-bed storage',
  'Overhead cabinet',
  'Kitchen cabinet',
  'Bathroom cabinet',
  'Rear cargo bay',
  'Front storage',
  'Side compartment',
  'Closet',
  'Pantry',
  'Refrigerator',
  'Freezer',
  'Under dinette',
  'Pass-through storage',
  'Basement storage',
  'Roof storage',
  'Tow vehicle',
  'Backpack',
  'Cooler',
  'Tote bin',
  'Other'
];

// GET /api/packup/locations - Get common storage locations
router.get('/locations', (req, res) => {
  res.json(COMMON_STORAGE_LOCATIONS);
});

// GET /api/packup/event/:eventId - Get pack-up list for an event
router.get('/event/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.id;

    // Get the event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        organizerId: true,
        campground: {
          select: { id: true, name: true }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get pack items for this event (user's items or assigned to user)
    const packItems = await prisma.tripPackItem.findMany({
      where: {
        eventId,
        OR: [
          { createdById: userId },
          { assignedToId: userId }
        ]
      },
      include: {
        inventoryItem: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, profilePicture: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: [
        { packUpStatus: 'asc' }, // NOT_STARTED first
        { customCategory: 'asc' },
        { customName: 'asc' }
      ]
    });

    // Get user's gear items that were linked
    const gearItemIds = packItems
      .filter(item => item.gearItemId)
      .map(item => item.gearItemId);

    const gearItems = await prisma.gearItem.findMany({
      where: { id: { in: gearItemIds as string[] } },
      select: {
        id: true,
        name: true,
        storageLocation: true,
        storageNotes: true
      }
    });

    // Create a map of gear items for easy lookup
    const gearMap = new Map(gearItems.map(g => [g.id, g]));

    // Enhance pack items with gear info
    const enhancedItems = packItems.map(item => ({
      ...item,
      gearItem: item.gearItemId ? gearMap.get(item.gearItemId) : null,
      defaultLocation: item.gearItemId ? gearMap.get(item.gearItemId)?.storageLocation : null
    }));

    // Calculate stats
    const stats = {
      total: packItems.length,
      packed: packItems.filter(i => i.packUpStatus === 'PACKED').length,
      leftBehind: packItems.filter(i => i.leftBehind).length,
      notStarted: packItems.filter(i => i.packUpStatus === 'NOT_STARTED' || !i.packUpStatus).length
    };

    res.json({
      event,
      items: enhancedItems,
      stats,
      storageLocations: COMMON_STORAGE_LOCATIONS
    });
  } catch (error) {
    console.error('Get pack-up list error:', error);
    res.status(500).json({ error: 'Failed to get pack-up list' });
  }
});

// GET /api/packup/trip/:tripId - Get pack-up list for a trip plan
router.get('/trip/:tripId', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user!.id;

    // Get the trip
    const trip = await prisma.tripPlan.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        userId: true
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get pack items for this trip
    const packItems = await prisma.tripPackItem.findMany({
      where: { tripId },
      include: {
        inventoryItem: true
      },
      orderBy: [
        { packUpStatus: 'asc' },
        { customCategory: 'asc' },
        { customName: 'asc' }
      ]
    });

    // Get linked gear items
    const gearItemIds = packItems
      .filter(item => item.gearItemId)
      .map(item => item.gearItemId);

    const gearItems = await prisma.gearItem.findMany({
      where: { id: { in: gearItemIds as string[] } },
      select: {
        id: true,
        name: true,
        storageLocation: true,
        storageNotes: true
      }
    });

    const gearMap = new Map(gearItems.map(g => [g.id, g]));

    const enhancedItems = packItems.map(item => ({
      ...item,
      gearItem: item.gearItemId ? gearMap.get(item.gearItemId) : null,
      defaultLocation: item.gearItemId ? gearMap.get(item.gearItemId)?.storageLocation : null
    }));

    const stats = {
      total: packItems.length,
      packed: packItems.filter(i => i.packUpStatus === 'PACKED').length,
      leftBehind: packItems.filter(i => i.leftBehind).length,
      notStarted: packItems.filter(i => i.packUpStatus === 'NOT_STARTED' || !i.packUpStatus).length
    };

    res.json({
      trip,
      items: enhancedItems,
      stats,
      storageLocations: COMMON_STORAGE_LOCATIONS
    });
  } catch (error) {
    console.error('Get pack-up list error:', error);
    res.status(500).json({ error: 'Failed to get pack-up list' });
  }
});

// PUT /api/packup/item/:itemId - Update pack-up status for an item
router.put('/item/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { packUpStatus, packedToLocation, packUpNote, leftBehind, saveAsDefault } = req.body;
    const userId = req.user!.id;

    const item = await prisma.tripPackItem.findUnique({
      where: { id: itemId },
      include: {
        event: { select: { organizerId: true } },
        trip: { select: { userId: true } }
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check authorization
    const isOwner = item.createdById === userId || 
                    item.assignedToId === userId ||
                    item.event?.organizerId === userId ||
                    item.trip?.userId === userId;

    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update the pack item
    const updated = await prisma.tripPackItem.update({
      where: { id: itemId },
      data: {
        packUpStatus: packUpStatus || item.packUpStatus,
        packedToLocation: packedToLocation !== undefined ? packedToLocation : item.packedToLocation,
        packUpNote: packUpNote !== undefined ? packUpNote : item.packUpNote,
        leftBehind: leftBehind !== undefined ? leftBehind : item.leftBehind,
        packedUpAt: packUpStatus === 'PACKED' ? new Date() : item.packedUpAt,
        packedUpById: packUpStatus === 'PACKED' ? userId : item.packedUpById
      }
    });

    // If saving as default and item is linked to gear, update the gear item
    if (saveAsDefault && item.gearItemId && packedToLocation) {
      await prisma.gearItem.update({
        where: { id: item.gearItemId },
        data: {
          storageLocation: packedToLocation,
          lastUsedAt: new Date(),
          lastUsedEventId: item.eventId,
          lastUsedTripId: item.tripId
        }
      });
    }

    // If marking as packed and linked to gear, update lastUsedAt
    if (packUpStatus === 'PACKED' && item.gearItemId) {
      await prisma.gearItem.update({
        where: { id: item.gearItemId },
        data: {
          lastUsedAt: new Date(),
          lastUsedEventId: item.eventId,
          lastUsedTripId: item.tripId
        }
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Update pack-up item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// POST /api/packup/item/:itemId/location - Quick update just the location
router.post('/item/:itemId/location', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { location, saveAsDefault } = req.body;
    const userId = req.user!.id;

    const item = await prisma.tripPackItem.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Update location
    await prisma.tripPackItem.update({
      where: { id: itemId },
      data: { packedToLocation: location }
    });

    // Save as default if requested
    if (saveAsDefault && item.gearItemId) {
      await prisma.gearItem.update({
        where: { id: item.gearItemId },
        data: { storageLocation: location }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// POST /api/packup/event/:eventId/complete - Mark pack-up as complete
router.post('/event/:eventId/complete', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.id;

    // Get the event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get all pack items
    const packItems = await prisma.tripPackItem.findMany({
      where: {
        eventId,
        OR: [
          { createdById: userId },
          { assignedToId: userId }
        ]
      }
    });

    // Update all items that haven't been packed to PACKED status
    const notPacked = packItems.filter(i => i.packUpStatus !== 'PACKED' && !i.leftBehind);

    for (const item of notPacked) {
      await prisma.tripPackItem.update({
        where: { id: item.id },
        data: {
          packUpStatus: 'PACKED',
          packedUpAt: new Date(),
          packedUpById: userId
        }
      });

      // Update gear item lastUsedAt
      if (item.gearItemId) {
        await prisma.gearItem.update({
          where: { id: item.gearItemId },
          data: {
            lastUsedAt: new Date(),
            lastUsedEventId: eventId
          }
        });
      }
    }

    // Get items left behind for the response
    const leftBehindItems = packItems.filter(i => i.leftBehind);

    res.json({
      success: true,
      packedCount: packItems.length - leftBehindItems.length,
      leftBehindCount: leftBehindItems.length,
      leftBehindItems: leftBehindItems.map(i => i.customName || i.inventoryItem?.name)
    });
  } catch (error) {
    console.error('Complete pack-up error:', error);
    res.status(500).json({ error: 'Failed to complete pack-up' });
  }
});

// POST /api/packup/event/:eventId/reset - Reset pack-up status (start over)
router.post('/event/:eventId/reset', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user!.id;

    await prisma.tripPackItem.updateMany({
      where: {
        eventId,
        OR: [
          { createdById: userId },
          { assignedToId: userId }
        ]
      },
      data: {
        packUpStatus: 'NOT_STARTED',
        packedToLocation: null,
        packUpNote: null,
        packedUpAt: null,
        packedUpById: null,
        leftBehind: false
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Reset pack-up error:', error);
    res.status(500).json({ error: 'Failed to reset pack-up' });
  }
});

// GET /api/packup/gear/:gearId/history - Get storage history for a gear item
router.get('/gear/:gearId/history', authenticateToken, async (req, res) => {
  try {
    const { gearId } = req.params;
    const userId = req.user!.id;

    const gearItem = await prisma.gearItem.findUnique({
      where: { id: gearId }
    });

    if (!gearItem || gearItem.userId !== userId) {
      return res.status(404).json({ error: 'Gear item not found' });
    }

    // Get past pack-up records with locations
    const packHistory = await prisma.tripPackItem.findMany({
      where: {
        gearItemId: gearId,
        packedToLocation: { not: null }
      },
      select: {
        id: true,
        packedToLocation: true,
        packedUpAt: true,
        event: {
          select: { id: true, title: true, startDate: true }
        },
        trip: {
          select: { id: true, title: true, startDate: true }
        }
      },
      orderBy: { packedUpAt: 'desc' },
      take: 10
    });

    res.json({
      gearItem: {
        id: gearItem.id,
        name: gearItem.name,
        currentLocation: gearItem.storageLocation,
        storageNotes: gearItem.storageNotes
      },
      history: packHistory
    });
  } catch (error) {
    console.error('Get gear history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

export default router;
