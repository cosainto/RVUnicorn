import { Router } from 'express';
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

// Middleware to check if user is campsite admin
const isCampsiteAdmin = async (req: any, res: any, next: any) => {
  try {
    const { campgroundId } = req.params;

    const admin = await db.campsiteAdmin.findUnique({
      where: {
        campgroundId_userId: {
          campgroundId,
          userId: (req as any).user!.id
        }
      }
    });

    if (!admin) {
      return res.status(403).json({ error: 'Not authorized - must be campsite admin' });
    }

    next();
  } catch (error: any) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// GET /api/campsite/:campgroundId/stats - Get campsite statistics
router.get('/:campgroundId/stats', async (req, res) => {
  try {
    const { campgroundId } = req.params;

    const campground = await db.campground.findUnique({
      where: { id: campgroundId },
      include: {
        _count: {
          select: {
            followers: true,
            ratings: true,
            announcements: true,
            events: true,
            rentals: true,
            gallery: true,
          }
        }
      }
    }) as any;

    if (!campground) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    // Get average rating
    const ratings = await db.campsiteRating.findMany({
      where: { campgroundId }
    }) as any[];

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum: any, r: any) => sum + r.smores, 0) / ratings.length
      : 0;

    // Get currently checked-in users count
    const now = new Date();
    const checkedInCount = await db.campgroundCheckIn.count({
      where: {
        campgroundId,
        checkInDate: { lte: now },
        checkOutDate: { gte: now }
      }
    });

    res.json({
      ...campground._count,
      averageRating: avgRating,
      checkedInToday: checkedInCount,
    });
  } catch (error: any) {
    console.error('Get campsite stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// POST /api/campsite/:campgroundId/follow - Follow campsite
router.post('/:campgroundId/follow', authenticateToken, async (req, res) => {
  try {
    const { campgroundId } = req.params;

    const existing = await db.campsiteFollow.findUnique({
      where: {
        campgroundId_userId: {
          campgroundId,
          userId: (req as any).user!.id
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Already following' });
    }

    const follow = await db.campsiteFollow.create({
      data: {
        campgroundId,
        userId: (req as any).user!.id,
      }
    });

    res.json(follow);
  } catch (error: any) {
    console.error('Follow campsite error:', error);
    res.status(500).json({ error: 'Failed to follow' });
  }
});

// DELETE /api/campsite/:campgroundId/follow - Unfollow campsite
router.delete('/:campgroundId/follow', authenticateToken, async (req, res) => {
  try {
    const { campgroundId } = req.params;

    await db.campsiteFollow.delete({
      where: {
        campgroundId_userId: {
          campgroundId,
          userId: (req as any).user!.id
        }
      }
    });

    res.json({ message: 'Unfollowed' });
  } catch (error: any) {
    console.error('Unfollow campsite error:', error);
    res.status(500).json({ error: 'Failed to unfollow' });
  }
});

// POST /api/campsite/:campgroundId/rate - Rate campsite
router.post(
  '/:campgroundId/rate',
  authenticateToken,
  [
    body('smores').isInt({ min: 1, max: 5 }),
    body('review').optional().trim(),
  ],
  async (req: any, res: any) => {
    try {
      const { campgroundId } = req.params;
      const { smores, review } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const rating = await db.campsiteRating.upsert({
        where: {
          campgroundId_userId: {
            campgroundId,
            userId: (req as any).user!.id
          }
        },
        create: {
          campgroundId,
          userId: (req as any).user!.id,
          smores,
          review,
        },
        update: {
          smores,
          review,
        }
      });

      res.json(rating);
    } catch (error: any) {
      console.error('Rate campsite error:', error);
      res.status(500).json({ error: 'Failed to rate' });
    }
  }
);

// GET /api/campsite/:campgroundId/ratings - Get campsite ratings
router.get('/:campgroundId/ratings', async (req, res) => {
  try {
    const { campgroundId } = req.params;

    const ratings = await db.campsiteRating.findMany({
      where: { campgroundId },
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

    res.json(ratings);
  } catch (error: any) {
    console.error('Get ratings error:', error);
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

// POST /api/campsite/:campgroundId/announcements - Create announcement (admin only)
router.post(
  '/:campgroundId/announcements',
  authenticateToken,
  isCampsiteAdmin,
  upload.single('image'),
  async (req, res) => {
    try {
      const { campgroundId } = req.params;
      const { title, content, target } = req.body;

      const announcement = await db.campsiteAnnouncement.create({
        data: {
          campgroundId,
          title,
          content,
          imageUrl: req.file ? await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/campsites') : null,
          target: target || 'ALL_FOLLOWERS',
        }
      });

      // Create notifications for followers or checked-in users
      let userIds: string[] = [];

      if (target === 'ALL_FOLLOWERS') {
        const followers = await db.campsiteFollow.findMany({
          where: { campgroundId },
          select: { userId: true }
        });
        userIds = followers.map((f: any) => f.userId);
      } else if (target === 'CHECKED_IN_USERS') {
        const now = new Date();
        const checkIns = await db.campgroundCheckIn.findMany({
          where: {
            campgroundId,
            checkInDate: { lte: now },
            checkOutDate: { gte: now }
          },
          select: { userId: true }
        });
        userIds = checkIns.map((c: any) => c.userId);
      }

      // Create notifications
      const campground = await db.campground.findUnique({
        where: { id: campgroundId }
      }) as any;

      if (userIds.length > 0) {
        await Promise.all(
          userIds.map(userId =>
            db.notification.create({
              data: {
                userId,
                type: 'CAMPSITE_ANNOUNCEMENT',
                content: `${campground?.name} posted: ${title}`,
              }
            })
          )
        );
      }

      res.json(announcement);
    } catch (error: any) {
      console.error('Create announcement error:', error);
      res.status(500).json({ error: 'Failed to create announcement' });
    }
  }
);

// GET /api/campsite/:campgroundId/announcements - Get announcements
router.get('/:campgroundId/announcements', async (req, res) => {
  try {
    const { campgroundId } = req.params;

    const announcements = await db.campsiteAnnouncement.findMany({
      where: { campgroundId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(announcements);
  } catch (error: any) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Failed to get announcements' });
  }
});

// POST /api/campsite/:campgroundId/events - Create event (admin only)
router.post(
  '/:campgroundId/events',
  authenticateToken,
  isCampsiteAdmin,
  upload.single('image'),
  async (req, res) => {
    try {
      const { campgroundId } = req.params;
      const { title, description, startDate, endDate } = req.body;

      const event = await db.campsiteEvent.create({
        data: {
          campgroundId,
          title,
          description,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          imageUrl: req.file ? await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/campsites') : null,
        }
      });

      res.json(event);
    } catch (error: any) {
      console.error('Create event error:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  }
);

// GET /api/campsite/:campgroundId/events - Get events
router.get('/:campgroundId/events', async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const { upcoming } = req.query;

    let whereClause: any = { campgroundId };

    if (upcoming === 'true') {
      whereClause.startDate = { gte: new Date() };
    }

    const events = await db.campsiteEvent.findMany({
      where: whereClause,
      orderBy: { startDate: 'asc' }
    });

    res.json(events);
  } catch (error: any) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// POST /api/campsite/:campgroundId/rentals - Create rental item (admin only)
router.post(
  '/:campgroundId/rentals',
  authenticateToken,
  isCampsiteAdmin,
  upload.single('image'),
  async (req, res) => {
    try {
      const { campgroundId } = req.params;
      const { name, description, pricePerDay, pricePerHour, available } = req.body;

      const rental = await db.campsiteRental.create({
        data: {
          campgroundId,
          name,
          description,
          pricePerDay: pricePerDay ? parseFloat(pricePerDay) : null,
          pricePerHour: pricePerHour ? parseFloat(pricePerHour) : null,
          available: available !== 'false',
          imageUrl: req.file ? await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/campsites') : null,
        }
      });

      res.json(rental);
    } catch (error: any) {
      console.error('Create rental error:', error);
      res.status(500).json({ error: 'Failed to create rental' });
    }
  }
);

// GET /api/campsite/:campgroundId/rentals - Get rentals
router.get('/:campgroundId/rentals', async (req, res) => {
  try {
    const { campgroundId } = req.params;

    const rentals = await db.campsiteRental.findMany({
      where: { campgroundId },
      orderBy: { name: 'asc' }
    });

    res.json(rentals);
  } catch (error: any) {
    console.error('Get rentals error:', error);
    res.status(500).json({ error: 'Failed to get rentals' });
  }
});

// POST /api/campsite/rentals/:rentalId/request - Request rental
router.post(
  '/rentals/:rentalId/request',
  authenticateToken,
  [
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
  ],
  async (req: any, res: any) => {
    try {
      const { rentalId } = req.params;
      const { startDate, endDate, message } = req.body;

      const rental = await db.campsiteRental.findUnique({
        where: { id: rentalId },
        include: { campground: true }
      }) as any;

      if (!rental) {
        return res.status(404).json({ error: 'Rental not found' });
      }

      const request = await db.rentalRequest.create({
        data: {
          rentalId,
          campgroundId: rental.campgroundId,
          userId: (req as any).user!.id,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          message,
        },
        include: {
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

      // Notify campsite admins
      const admins = await db.campsiteAdmin.findMany({
        where: { campgroundId: rental.campgroundId },
        select: { userId: true }
      });

      await Promise.all(
        admins.map((admin: any) =>
          db.notification.create({
            data: {
              userId: admin.userId,
              type: 'RENTAL_REQUEST',
              content: `${(req as any).user!.firstName} requested to rent ${rental.name}`,
            }
          })
        )
      );

      res.json(request);
    } catch (error: any) {
      console.error('Request rental error:', error);
      res.status(500).json({ error: 'Failed to request rental' });
    }
  }
);

// GET /api/campsite/:campgroundId/rental-requests - Get rental requests (admin only)
router.get('/:campgroundId/rental-requests', authenticateToken, isCampsiteAdmin, async (req, res) => {
  try {
    const { campgroundId } = req.params;

    const requests = await db.rentalRequest.findMany({
      where: { campgroundId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        rental: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error: any) {
    console.error('Get rental requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

// PUT /api/campsite/rental-requests/:requestId - Update rental request status (admin only)
router.put('/rental-requests/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    const request = await db.rentalRequest.findUnique({
      where: { id: requestId },
      include: { campground: true, rental: true }
    }) as any;

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check admin
    const admin = await db.campsiteAdmin.findUnique({
      where: {
        campgroundId_userId: {
          campgroundId: request.campgroundId,
          userId: (req as any).user!.id
        }
      }
    });

    if (!admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await db.rentalRequest.update({
      where: { id: requestId },
      data: { status }
    });

    // Notify user
    await db.notification.create({
      data: {
        userId: request.userId,
        type: 'RENTAL_REQUEST_UPDATE',
        content: `Your rental request for ${request.rental.name} was ${status.toLowerCase()}`,
      }
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update rental request error:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// POST /api/campsite/:campgroundId/store - Create store item (admin only)
router.post(
  '/:campgroundId/store',
  authenticateToken,
  isCampsiteAdmin,
  upload.single('image'),
  async (req, res) => {
    try {
      const { campgroundId } = req.params;
      const { name, description, price, inStock } = req.body;

      const item = await db.campsiteStoreItem.create({
        data: {
          campgroundId,
          name,
          description,
          price: parseFloat(price),
          inStock: inStock !== 'false',
          imageUrl: req.file ? await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/campsites') : null,
        }
      });

      res.json(item);
    } catch (error: any) {
      console.error('Create store item error:', error);
      res.status(500).json({ error: 'Failed to create item' });
    }
  }
);

// GET /api/campsite/:campgroundId/store - Get store items
router.get('/:campgroundId/store', async (req, res) => {
  try {
    const { campgroundId } = req.params;

    const items = await db.campsiteStoreItem.findMany({
      where: { campgroundId },
      orderBy: { name: 'asc' }
    });

    res.json(items);
  } catch (error: any) {
    console.error('Get store items error:', error);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// POST /api/campsite/:campgroundId/gallery - Add gallery photo
router.post(
  '/:campgroundId/gallery',
  authenticateToken,
  upload.single('photo'),
  async (req, res) => {
    try {
      const { campgroundId } = req.params;
      const { caption } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No photo uploaded' });
      }

      // Check if user is admin
      const admin = await db.campsiteAdmin.findUnique({
        where: {
          campgroundId_userId: {
            campgroundId,
            userId: (req as any).user!.id
          }
        }
      });

      const cloudinaryUrl = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/campsites');

      const photo = await db.campsiteGalleryPhoto.create({
        data: {
          campgroundId,
          userId: admin ? null : (req as any).user!.id, // null if admin upload
          imageUrl: cloudinaryUrl,
          caption,
          approved: admin ? true : false, // Auto-approve admin uploads
        }
      });

      res.json(photo);
    } catch (error: any) {
      console.error('Add gallery photo error:', error);
      res.status(500).json({ error: 'Failed to add photo' });
    }
  }
);

// GET /api/campsite/:campgroundId/gallery - Get gallery photos
router.get('/:campgroundId/gallery', async (req, res) => {
  try {
    const { campgroundId } = req.params;

    const photos = await db.campsiteGalleryPhoto.findMany({
      where: {
        campgroundId,
        approved: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(photos);
  } catch (error: any) {
    console.error('Get gallery error:', error);
    res.status(500).json({ error: 'Failed to get gallery' });
  }
});

// PUT /api/campsite/:campgroundId - Update campsite info (admin only)
router.put('/:campgroundId', authenticateToken, isCampsiteAdmin, async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const {
      fullDescription,
      nightlyRate,
      phone,
      email,
      website,
      socialLinks,
      hours,
      bathroomSchedule,
      restaurantMenu,
    } = req.body;

    const campground = await db.campground.update({
      where: { id: campgroundId },
      data: {
        fullDescription,
        nightlyRate: nightlyRate ? parseFloat(nightlyRate) : undefined,
        phone,
        email,
        website,
        socialLinks,
        hours,
        bathroomSchedule,
        restaurantMenu,
      }
    });

    res.json(campground);
  } catch (error: any) {
    console.error('Update campground error:', error);
    res.status(500).json({ error: 'Failed to update campground' });
  }
});

export default router;
