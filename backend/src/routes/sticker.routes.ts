import { Router } from 'express';
import { logStickerEarned } from '../services/activity.service';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

// Configure multer for sticker artwork uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/stickers/';
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('image/');
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware to check if user is campground admin
const isCampgroundAdmin = async (req: any, res: any, next: any) => {
  try {
    const { campgroundId } = req.params;
    const userId = req.userId || req.user?.id;

    const admin = await prisma.campgroundAdmin.findUnique({
      where: {
        userId_campgroundId: {
          campgroundId,
          userId
        }
      }
    });

    if (!admin) {
      return res.status(403).json({ error: 'Not authorized - must be campground admin' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// ============================================
// STATIC ROUTES - MUST COME BEFORE PARAMETERIZED ROUTES
// ============================================

// GET /api/stickers/my-stickers - Get current user's earned stickers
router.get('/my-stickers', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId || req.user?.id;
    
    const userStickers = await prisma.userSticker.findMany({
      where: { userId },
      include: {
        sticker: {
          include: {
            campground: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: { earnedAt: 'desc' }
    });

    // Transform to expected format
    const transformed = userStickers.map(us => ({
      id: us.id,
      earnedAt: us.earnedAt,
      sticker: {
        id: us.sticker.id,
        name: us.sticker.name,
        description: us.sticker.description,
        imageUrl: us.sticker.imageUrl,
        emoji: us.sticker.emoji,
        campground: us.sticker.campground
      }
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get my stickers error:', error);
    res.status(500).json({ error: 'Failed to get stickers' });
  }
});

// GET /api/stickers/requests/user - Get user's sticker requests
router.get('/requests/user', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId || req.user?.id;
    
    const requests = await prisma.stickerRequest.findMany({
      where: { userId },
      include: {
        sticker: {
          include: {
            campground: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Get user requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

// GET /api/stickers/requests/campground/:campgroundId - Get all requests for a campground (admin only)
router.get('/requests/campground/:campgroundId', authenticateToken, isCampgroundAdmin, async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const { status } = req.query;

    const whereClause: any = { 
      sticker: { campgroundId }
    };
    if (status) {
      whereClause.status = status;
    }

    const requests = await prisma.stickerRequest.findMany({
      where: whereClause,
      include: {
        sticker: true,
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

    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

// PUT /api/stickers/requests/:requestId - Approve or decline request (admin only)
router.put('/requests/:requestId', authenticateToken, async (req: any, res) => {
  try {
    const { requestId } = req.params;
    const { status, reviewNote } = req.body;
    const userId = req.userId || req.user?.id;

    if (!['approved', 'declined', 'APPROVED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const normalizedStatus = status.toLowerCase();

    const request = await prisma.stickerRequest.findUnique({
      where: { id: requestId },
      include: {
        sticker: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check admin
    const admin = await prisma.campgroundAdmin.findUnique({
      where: {
        userId_campgroundId: {
          campgroundId: request.sticker.campgroundId,
          userId
        }
      }
    });

    if (!admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update request
    const updated = await prisma.stickerRequest.update({
      where: { id: requestId },
      data: {
        status: normalizedStatus,
      }
    });

    // If approved, create user sticker
    if (normalizedStatus === 'approved') {
      await prisma.userSticker.create({
        data: {
          stickerId: request.stickerId,
          userId: request.userId,
        }
      });

      // Create notification for user
      await prisma.notification.create({
        data: {
          userId: request.userId,
          type: 'STICKER_AWARDED',
          content: `Congratulations! You've been awarded the "${request.sticker.name}" sticker! 🎖️`,
        }
      });
    } else {
      // Notify user of decline
      await prisma.notification.create({
        data: {
          userId: request.userId,
          type: 'STICKER_DECLINED',
          content: `Your request for the "${request.sticker.name}" sticker was declined${reviewNote ? `: ${reviewNote}` : '.'}`,
        }
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Review request error:', error);
    res.status(500).json({ error: 'Failed to review request' });
  }
});

// GET /api/stickers/awards/user/:username - Get user's sticker board (public)
router.get('/awards/user/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userStickers = await prisma.userSticker.findMany({
      where: { userId: user.id },
      include: {
        sticker: {
          include: {
            campground: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: { earnedAt: 'desc' }
    });

    res.json(userStickers);
  } catch (error) {
    console.error('Get awards error:', error);
    res.status(500).json({ error: 'Failed to get awards' });
  }
});

// POST /api/stickers/campground/:campgroundId - Create sticker (admin only)
router.post(
  '/campground/:campgroundId',
  authenticateToken,
  isCampgroundAdmin,
  upload.single('artwork'),
  [
    body('name').trim().notEmpty(),
    body('description').optional().trim(),
    body('criteria').optional().trim(),
  ],
  async (req: any, res) => {
    try {
      const { campgroundId } = req.params;
      const { name, description, criteria, emoji, isLimited, maxQuantity } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const sticker = await prisma.sticker.create({
        data: {
          campgroundId,
          name,
          description,
          criteria,
          emoji,
          imageUrl: req.file ? `/uploads/stickers/${req.file.filename}` : null,
          isLimited: isLimited === 'true',
          maxQuantity: maxQuantity ? parseInt(maxQuantity) : null,
        }
      });

      res.json(sticker);
    } catch (error) {
      console.error('Create sticker error:', error);
      res.status(500).json({ error: 'Failed to create sticker' });
    }
  }
);

// GET /api/stickers/campground/:campgroundId - Get all stickers for a campground
router.get('/campground/:campgroundId', async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const { activeOnly } = req.query;

    const whereClause: any = { campgroundId };
    if (activeOnly === 'true') {
      whereClause.isActive = true;
    }

    const stickers = await prisma.sticker.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            userStickers: true,
            stickerRequests: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(stickers);
  } catch (error) {
    console.error('Get stickers error:', error);
    res.status(500).json({ error: 'Failed to get stickers' });
  }
});

// ============================================
// PARAMETERIZED ROUTES - MUST COME AFTER STATIC ROUTES
// ============================================

// GET /api/stickers/:stickerId - Get single sticker details
router.get('/:stickerId', async (req, res) => {
  try {
    const { stickerId } = req.params;

    const sticker = await prisma.sticker.findUnique({
      where: { id: stickerId },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
          }
        },
        userStickers: {
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
          orderBy: { earnedAt: 'desc' },
          take: 20
        },
        _count: {
          select: {
            userStickers: true,
            stickerRequests: true
          }
        }
      }
    });

    if (!sticker) {
      return res.status(404).json({ error: 'Sticker not found' });
    }

    res.json(sticker);
  } catch (error) {
    console.error('Get sticker error:', error);
    res.status(500).json({ error: 'Failed to get sticker' });
  }
});

// PUT /api/stickers/:stickerId - Update sticker (admin only)
router.put('/:stickerId', authenticateToken, async (req: any, res) => {
  try {
    const { stickerId } = req.params;
    const { name, description, criteria, emoji, isLimited, maxQuantity, isActive } = req.body;
    const userId = req.userId || req.user?.id;

    const sticker = await prisma.sticker.findUnique({
      where: { id: stickerId }
    });

    if (!sticker) {
      return res.status(404).json({ error: 'Sticker not found' });
    }

    // Check admin
    const admin = await prisma.campgroundAdmin.findUnique({
      where: {
        userId_campgroundId: {
          campgroundId: sticker.campgroundId,
          userId
        }
      }
    });

    if (!admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.sticker.update({
      where: { id: stickerId },
      data: {
        name,
        description,
        criteria,
        emoji,
        isLimited,
        maxQuantity,
        isActive,
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update sticker error:', error);
    res.status(500).json({ error: 'Failed to update sticker' });
  }
});

// POST /api/stickers/:stickerId/request - Request a sticker
router.post(
  '/:stickerId/request',
  authenticateToken,
  [
    body('evidence').optional().trim(),
  ],
  async (req: any, res) => {
    try {
      const { stickerId } = req.params;
      const { evidence } = req.body;
      const userId = req.userId || req.user?.id;

      const sticker = await prisma.sticker.findUnique({
        where: { id: stickerId },
        include: {
          _count: {
            select: { userStickers: true }
          }
        }
      });

      if (!sticker) {
        return res.status(404).json({ error: 'Sticker not found' });
      }

      if (!sticker.isActive) {
        return res.status(400).json({ error: 'This sticker is no longer active' });
      }

      // Check if user already has this sticker
      const existingSticker = await prisma.userSticker.findUnique({
        where: {
          userId_stickerId: {
            stickerId,
            userId
          }
        }
      });

      if (existingSticker) {
        return res.status(400).json({ error: 'You already have this sticker' });
      }

      // Check if there's already a pending request
      const pendingRequest = await prisma.stickerRequest.findFirst({
        where: {
          stickerId,
          userId,
          status: 'pending'
        }
      });

      if (pendingRequest) {
        return res.status(400).json({ error: 'You already have a pending request for this sticker' });
      }

      // Check if sticker is limited and at capacity
      if (sticker.isLimited && sticker.maxQuantity && sticker._count.userStickers >= sticker.maxQuantity) {
        return res.status(400).json({ error: 'This sticker has reached its maximum number of earners' });
      }

      const request = await prisma.stickerRequest.create({
        data: {
          stickerId,
          userId,
          evidence,
        },
        include: {
          sticker: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            }
          }
        }
      });

      // Notify campground admins
      const admins = await prisma.campgroundAdmin.findMany({
        where: { campgroundId: sticker.campgroundId },
        select: { userId: true }
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });

      await Promise.all(
        admins.map(admin =>
          prisma.notification.create({
            data: {
              userId: admin.userId,
              type: 'STICKER_REQUEST',
              content: `${user?.firstName || 'Someone'} requested the "${sticker.name}" sticker`,
            }
          })
        )
      );

      res.json(request);
    } catch (error) {
      console.error('Request sticker error:', error);
      res.status(500).json({ error: 'Failed to request sticker' });
    }
  }
);

// DELETE /api/stickers/:stickerId - Delete sticker (admin only)
router.delete('/:stickerId', authenticateToken, async (req: any, res) => {
  try {
    const { stickerId } = req.params;
    const userId = req.userId || req.user?.id;

    const sticker = await prisma.sticker.findUnique({
      where: { id: stickerId }
    });

    if (!sticker) {
      return res.status(404).json({ error: 'Sticker not found' });
    }

    // Check admin
    const admin = await prisma.campgroundAdmin.findUnique({
      where: {
        userId_campgroundId: {
          campgroundId: sticker.campgroundId,
          userId
        }
      }
    });

    if (!admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.sticker.delete({
      where: { id: stickerId }
    });

    res.json({ message: 'Sticker deleted' });
  } catch (error) {
    console.error('Delete sticker error:', error);
    res.status(500).json({ error: 'Failed to delete sticker' });
  }
});

export default router;
