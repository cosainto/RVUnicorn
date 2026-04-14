import { Router } from 'express';
import { logStickerEarned } from '../services/activity.service';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
const db = prisma as any;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype); if (ok) { cb(null, true); } else { cb(new Error('Images only')); } } });

// Middleware to check if user is campground admin
const isCampgroundAdmin = async (req: any, res: any, next: any) => {
  try {
    const { campgroundId } = req.params;
    const userId = req.userId || (req as any).user?.id;

    const admin = await db.campgroundAdmin.findUnique({
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
  } catch (error: any) {
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
    const userId = req.userId || (req as any).user?.id;
    
    const userStickers = await db.userSticker.findMany({
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
    const transformed = userStickers.map((us: any) => ({
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
  } catch (error: any) {
    console.error('Get my stickers error:', error);
    res.status(500).json({ error: 'Failed to get stickers' });
  }
});

// GET /api/stickers/requests/user - Get user's sticker requests
router.get('/requests/user', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    
    const requests = await db.stickerRequest.findMany({
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
  } catch (error: any) {
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

    const requests = await db.stickerRequest.findMany({
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
  } catch (error: any) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

// PUT /api/stickers/requests/:requestId - Approve or decline request (admin only)
router.put('/requests/:requestId', authenticateToken, async (req: any, res) => {
  try {
    const { requestId } = req.params;
    const { status, reviewNote } = req.body;
    const userId = req.userId || (req as any).user?.id;

    if (!['approved', 'declined', 'APPROVED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const normalizedStatus = status.toLowerCase();

    const request = await db.stickerRequest.findUnique({
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
    const admin = await db.campgroundAdmin.findUnique({
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
    const updated = await db.stickerRequest.update({
      where: { id: requestId },
      data: {
        status: normalizedStatus,
      }
    });

    // If approved, create user sticker
    if (normalizedStatus === 'approved') {
      await db.userSticker.create({
        data: {
          stickerId: request.stickerId,
          userId: request.userId,
        }
      });

      // Create notification for user
      await db.notification.create({
        data: {
          userId: request.userId,
          type: 'STICKER_AWARDED',
          content: `Congratulations! You've been awarded the "${request.sticker.name}" sticker! 🎖️`,
        }
      });
    } else {
      // Notify user of decline
      await db.notification.create({
        data: {
          userId: request.userId,
          type: 'STICKER_DECLINED',
          content: `Your request for the "${request.sticker.name}" sticker was declined${reviewNote ? `: ${reviewNote}` : '.'}`,
        }
      });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Review request error:', error);
    res.status(500).json({ error: 'Failed to review request' });
  }
});

// GET /api/stickers/awards/user/:username - Get user's sticker board (public)
router.get('/awards/user/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await db.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userStickers = await db.userSticker.findMany({
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
  } catch (error: any) {
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
  async (req: any, res: any) => {
    try {
      const { campgroundId } = req.params;
      const { name, description, criteria, emoji, isLimited, maxQuantity } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const sticker = await db.sticker.create({
        data: {
          campgroundId,
          name,
          description,
          criteria,
          emoji,
          imageUrl: req.file ? await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/stickers') : null,
          isLimited: isLimited === 'true',
          maxQuantity: maxQuantity ? parseInt(maxQuantity) : null,
        }
      });

      res.json(sticker);
    } catch (error: any) {
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

    const stickers = await db.sticker.findMany({
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
  } catch (error: any) {
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

    const sticker = await db.sticker.findUnique({
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
  } catch (error: any) {
    console.error('Get sticker error:', error);
    res.status(500).json({ error: 'Failed to get sticker' });
  }
});

// PUT /api/stickers/:stickerId - Update sticker (admin only)
router.put('/:stickerId', authenticateToken, async (req: any, res) => {
  try {
    const { stickerId } = req.params;
    const { name, description, criteria, emoji, isLimited, maxQuantity, isActive } = req.body;
    const userId = req.userId || (req as any).user?.id;

    const sticker = await db.sticker.findUnique({
      where: { id: stickerId }
    });

    if (!sticker) {
      return res.status(404).json({ error: 'Sticker not found' });
    }

    // Check admin
    const admin = await db.campgroundAdmin.findUnique({
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

    const updated = await db.sticker.update({
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
  } catch (error: any) {
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
  async (req: any, res: any) => {
    try {
      const { stickerId } = req.params;
      const { evidence } = req.body;
      const userId = req.userId || (req as any).user?.id;

      const sticker = await db.sticker.findUnique({
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
      const existingSticker = await db.userSticker.findUnique({
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
      const pendingRequest = await db.stickerRequest.findFirst({
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

      const request = await db.stickerRequest.create({
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
      const admins = await db.campgroundAdmin.findMany({
        where: { campgroundId: sticker.campgroundId },
        select: { userId: true }
      });

      const user = await db.user.findUnique({ where: { id: userId } });

      await Promise.all(
        admins.map((admin: any) =>
          db.notification.create({
            data: {
              userId: admin.userId,
              type: 'STICKER_REQUEST',
              content: `${user?.firstName || 'Someone'} requested the "${sticker.name}" sticker`,
            }
          })
        )
      );

      res.json(request);
    } catch (error: any) {
      console.error('Request sticker error:', error);
      res.status(500).json({ error: 'Failed to request sticker' });
    }
  }
);

// DELETE /api/stickers/:stickerId - Delete sticker (admin only)
router.delete('/:stickerId', authenticateToken, async (req: any, res) => {
  try {
    const { stickerId } = req.params;
    const userId = req.userId || (req as any).user?.id;

    const sticker = await db.sticker.findUnique({
      where: { id: stickerId }
    });

    if (!sticker) {
      return res.status(404).json({ error: 'Sticker not found' });
    }

    // Check admin
    const admin = await db.campgroundAdmin.findUnique({
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

    await db.sticker.delete({
      where: { id: stickerId }
    });

    res.json({ message: 'Sticker deleted' });
  } catch (error: any) {
    console.error('Delete sticker error:', error);
    res.status(500).json({ error: 'Failed to delete sticker' });
  }
});

export default router;
