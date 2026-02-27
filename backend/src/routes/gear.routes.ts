import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

const GEAR_CATEGORIES = [
  'Kitchen',
  'Sleep',
  'Shelter',
  'Tools',
  'Fun',
  'Safety',
  'Other'
];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype); if (ok) { cb(null, true); } else { cb(new Error('Images only')); } } });

// GET /api/gear - Get user's gear items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, visibility, borrowable, forSale } = req.query;

    let whereClause: any = {
      userId: req.user!.id
    };

    if (category) {
      whereClause.category = category;
    }

    if (visibility) {
      whereClause.visibility = visibility;
    }

    if (borrowable === 'true') {
      whereClause.borrowable = true;
    }

    if (forSale === 'true') {
      whereClause.forSale = true;
    }

    const gearItems = await prisma.gearItem.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    res.json(gearItems);
  } catch (error) {
    console.error('Get gear items error:', error);
    res.status(500).json({ error: 'Failed to get gear items' });
  }
});

// GET /api/gear/marketplace - Get items for sale
router.get('/marketplace', authenticateToken, async (req, res) => {
  try {
    const { category, visibility } = req.query;

    let whereClause: any = {
      forSale: true,
      userId: { not: req.user!.id } // Don't show user's own items
    };

    if (category) {
      whereClause.category = category;
    }

    if (visibility) {
      whereClause.visibility = visibility;
    } else {
      // By default, show CAMPGROUND visibility items (marketplace items)
      whereClause.visibility = 'CAMPGROUND';
    }

    const gearItems = await prisma.gearItem.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(gearItems);
  } catch (error) {
    console.error('Get marketplace items error:', error);
    res.status(500).json({ error: 'Failed to get marketplace items' });
  }
});

// GET /api/gear/:id - Get single gear item
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const gearItem = await prisma.gearItem.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      }
    });

    if (!gearItem) {
      return res.status(404).json({ error: 'Gear item not found' });
    }

    // Check if user has permission to view
    if (gearItem.userId !== req.user!.id && gearItem.visibility === 'PRIVATE') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(gearItem);
  } catch (error) {
    console.error('Get gear item error:', error);
    res.status(500).json({ error: 'Failed to get gear item' });
  }
});

// POST /api/gear - Create gear item
router.post(
  '/',
  authenticateToken,
  upload.single('image'),
  [
    body('name').trim().notEmpty(),
    body('category').isIn(GEAR_CATEGORIES),
    body('quantity').optional().isInt({ min: 1 }),
    body('visibility').optional().isIn(['PRIVATE', 'EVENT', 'CAMPGROUND']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, category, quantity, notes, visibility, borrowable, rulesText, forSale, price, saleDescription } = req.body;

      const gearItem = await prisma.gearItem.create({
        data: {
          userId: req.user!.id,
          name,
          category,
          quantity: quantity ? parseInt(quantity) : 1,
          notes,
          visibility: visibility || 'PRIVATE',
          borrowable: borrowable === 'true',
          rulesText,
          imageUrl: req.file ? await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/gear') : null,
          forSale: forSale === 'true',
          price: price ? parseFloat(price) : null,
          saleDescription,
        }
      });

      res.json(gearItem);
    } catch (error) {
      console.error('Create gear item error:', error);
      res.status(500).json({ error: 'Failed to create gear item' });
    }
  }
);

// PUT /api/gear/:id - Update gear item
router.put('/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, quantity, notes, visibility, borrowable, rulesText, forSale, price, saleDescription } = req.body;

    const gearItem = await prisma.gearItem.findUnique({
      where: { id }
    });

    if (!gearItem) {
      return res.status(404).json({ error: 'Gear item not found' });
    }

    if (gearItem.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updateData: any = {
      name,
      category,
      quantity: quantity ? parseInt(quantity) : undefined,
      notes,
      visibility,
      borrowable: borrowable === 'true',
      rulesText,
      forSale: forSale === 'true',
      price: price ? parseFloat(price) : null,
      saleDescription,
    };

    // Add image if uploaded
    if (req.file) {
      updateData.imageUrl = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/gear');
      
      // Delete old image if exists
      if (gearItem.imageUrl) {
        const oldImagePath = path.join(__dirname, '../../', gearItem.imageUrl);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    const updatedItem = await prisma.gearItem.update({
      where: { id },
      data: updateData
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Update gear item error:', error);
    res.status(500).json({ error: 'Failed to update gear item' });
  }
});

// DELETE /api/gear/:id - Delete gear item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const gearItem = await prisma.gearItem.findUnique({
      where: { id }
    });

    if (!gearItem) {
      return res.status(404).json({ error: 'Gear item not found' });
    }

    if (gearItem.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete image if exists
    if (gearItem.imageUrl) {
      const imagePath = path.join(__dirname, '../../', gearItem.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await prisma.gearItem.delete({
      where: { id }
    });

    res.json({ message: 'Gear item deleted' });
  } catch (error) {
    console.error('Delete gear item error:', error);
    res.status(500).json({ error: 'Failed to delete gear item' });
  }
});

// GET /api/gear/nearby/:campgroundId - Get borrowable gear at campground
router.get('/nearby/:campgroundId', authenticateToken, async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const now = new Date();

    // Find users currently checked into this campground
    const checkIns = await prisma.campgroundCheckIn.findMany({
      where: {
        campgroundId,
        checkInDate: { lte: now },
        checkOutDate: { gte: now },
        userId: { not: req.user!.id } // Exclude current user
      },
      select: {
        userId: true,
        siteNumber: true,
      }
    });

    const userIds = checkIns.map(c => c.userId);

    // Get borrowable gear from these users
    const gearItems = await prisma.gearItem.findMany({
      where: {
        userId: { in: userIds },
        visibility: 'CAMPGROUND',
        borrowable: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add site number to each item
    const itemsWithSite = gearItems.map(item => {
      const checkIn = checkIns.find(c => c.userId === item.userId);
      return {
        ...item,
        siteNumber: checkIn?.siteNumber,
      };
    });

    res.json(itemsWithSite);
  } catch (error) {
    console.error('Get nearby gear error:', error);
    res.status(500).json({ error: 'Failed to get nearby gear' });
  }
});


// GET /api/gear/:id/history - Get usage history for a gear item
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const gearItem = await prisma.gearItem.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true }
        }
      }
    });

    if (!gearItem) {
      return res.status(404).json({ error: 'Gear item not found' });
    }

    if (gearItem.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Find all TripPackItems that reference this gear item
    const usageHistory = await prisma.tripPackItem.findMany({
      where: {
        gearItemId: id,
        isPacked: true
      },
      include: {
        trip: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true
          }
        },
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            campground: {
              select: {
                id: true,
                name: true,
                state: true
              }
            }
          }
        }
      },
      orderBy: { packedAt: 'desc' }
    });

    res.json({
      gearItem,
      usageHistory: usageHistory.map(item => ({
        id: item.id,
        packedAt: item.packedAt,
        trip: item.trip,
        event: item.event,
        tripName: item.trip?.title || item.event?.title || 'Unknown Trip',
        campground: item.event?.campground?.name || null,
        state: item.event?.campground?.state || null,
        date: item.trip?.startDate || item.event?.startDate
      }))
    });
  } catch (error) {
    console.error('Get gear history error:', error);
    res.status(500).json({ error: 'Failed to get gear history' });
  }
});

// GET /api/gear/upcoming-trips - Get user's upcoming trips for "Add to Trip" feature
router.get('/trips/upcoming', authenticateToken, async (req, res) => {
  try {
    const now = new Date();

    // Get upcoming events
    const events = await prisma.event.findMany({
      where: {
        organizerId: req.user!.id,
        startDate: { gte: now }
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        campground: {
          select: {
            id: true,
            name: true,
            state: true
          }
        }
      },
      orderBy: { startDate: 'asc' },
      take: 20
    });

    // Get upcoming trip plans
    const trips = await prisma.tripPlan.findMany({
      where: {
        userId: req.user!.id,
        startDate: { gte: now }
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true
      },
      orderBy: { startDate: 'asc' },
      take: 20
    });

    res.json({ events, trips });
  } catch (error) {
    console.error('Get upcoming trips error:', error);
    res.status(500).json({ error: 'Failed to get upcoming trips' });
  }
});

// POST /api/gear/:id/add-to-trip - Add gear item to a trip's pack list
router.post('/:id/add-to-trip', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tripId, eventId, quantity = 1 } = req.body;

    if (!tripId && !eventId) {
      return res.status(400).json({ error: 'Must specify tripId or eventId' });
    }

    const gearItem = await prisma.gearItem.findUnique({
      where: { id }
    });

    if (!gearItem) {
      return res.status(404).json({ error: 'Gear item not found' });
    }

    if (gearItem.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if already added to this trip
    const existing = await prisma.tripPackItem.findFirst({
      where: {
        gearItemId: id,
        ...(tripId ? { tripId } : {}),
        ...(eventId ? { eventId } : {})
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Item already added to this trip' });
    }

    // Create the pack item
    const packItem = await prisma.tripPackItem.create({
      data: {
        gearItemId: id,
        tripId: tripId || null,
        eventId: eventId || null,
        customName: gearItem.name,
        customCategory: gearItem.category,
        quantity,
        isPacked: false,
        createdById: req.user!.id
      },
      include: {
        trip: { select: { title: true } },
        event: { select: { title: true } }
      }
    });

    res.json({
      message: 'Added to pack list',
      packItem,
      tripName: packItem.trip?.title || packItem.event?.title
    });
  } catch (error) {
    console.error('Add to trip error:', error);
    res.status(500).json({ error: 'Failed to add to trip' });
  }
});

// POST /api/gear/:id/mark-used - Mark gear as used (updates lastUsedAt)
router.post('/:id/mark-used', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tripId, eventId } = req.body;

    const gearItem = await prisma.gearItem.findUnique({
      where: { id }
    });

    if (!gearItem) {
      return res.status(404).json({ error: 'Gear item not found' });
    }

    if (gearItem.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.gearItem.update({
      where: { id },
      data: {
        lastUsedAt: new Date(),
        lastUsedTripId: tripId || null,
        lastUsedEventId: eventId || null
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Mark used error:', error);
    res.status(500).json({ error: 'Failed to mark as used' });
  }
});

// GET /api/gear/stats - Get gear statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const totalItems = await prisma.gearItem.count({
      where: { userId: req.user!.id }
    });

    const byCategory = await prisma.gearItem.groupBy({
      by: ['category'],
      where: { userId: req.user!.id },
      _count: { id: true }
    });

    const borrowable = await prisma.gearItem.count({
      where: { userId: req.user!.id, borrowable: true }
    });

    const forSale = await prisma.gearItem.count({
      where: { userId: req.user!.id, forSale: true }
    });

    // Items not used in 6+ months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const notRecentlyUsed = await prisma.gearItem.count({
      where: {
        userId: req.user!.id,
        OR: [
          { lastUsedAt: null },
          { lastUsedAt: { lt: sixMonthsAgo } }
        ]
      }
    });

    res.json({
      totalItems,
      byCategory: byCategory.map(c => ({ category: c.category, count: c._count.id })),
      borrowable,
      forSale,
      notRecentlyUsed
    });
  } catch (error) {
    console.error('Get gear stats error:', error);
    res.status(500).json({ error: 'Failed to get gear stats' });
  }
});

export default router;
