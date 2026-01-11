import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
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

// Configure multer for gear image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/gear/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('image/');
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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
          imageUrl: req.file ? `/uploads/gear/${req.file.filename}` : null,
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
      updateData.imageUrl = `/uploads/gear/${req.file.filename}`;
      
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

export default router;
