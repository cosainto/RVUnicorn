import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma as db } from '../lib/prisma';

// GET /api/campground-actions/:campgroundId/status - Get all action statuses
router.get('/:campgroundId/status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const { campgroundId } = req.params;

    const [follow, wishlist, mute] = await Promise.all([
      db.campgroundFollow.findUnique({
        where: { userId_campgroundId: { userId, campgroundId } }
      }),
      db.campgroundWishlist.findUnique({
        where: { userId_campgroundId: { userId, campgroundId } }
      }),
      db.mutedEntity.findFirst({
        where: { userId, mutedCampgroundId: campgroundId }
      })
    ]);

    res.json({
      isFavorite: !!follow,
      inWishlist: !!wishlist,
      isMuted: !!mute
    });
  } catch (error: any) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// POST /api/campground-actions/:campgroundId/favorite/toggle
router.post('/:campgroundId/favorite/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const { campgroundId } = req.params;

    const existing = await db.campgroundFollow.findUnique({
      where: { userId_campgroundId: { userId, campgroundId } }
    });

    if (existing) {
      await db.campgroundFollow.delete({ where: { id: existing.id } });
      res.json({ isFavorite: false });
    } else {
      await db.campgroundFollow.create({
        data: { userId, campgroundId }
      });
      res.json({ isFavorite: true });
    }
  } catch (error: any) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// POST /api/campground-actions/:campgroundId/mute/toggle
router.post('/:campgroundId/mute/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const { campgroundId } = req.params;

    const existing = await db.mutedEntity.findFirst({
      where: { userId, mutedCampgroundId: campgroundId }
    });

    if (existing) {
      await db.mutedEntity.delete({ where: { id: existing.id } });
      res.json({ isMuted: false });
    } else {
      await db.mutedEntity.create({
        data: { userId, mutedCampgroundId: campgroundId }
      });
      res.json({ isMuted: true });
    }
  } catch (error: any) {
    console.error('Toggle mute error:', error);
    res.status(500).json({ error: 'Failed to toggle mute' });
  }
});

// GET /api/campground-actions/favorites - Get user's favorite campgrounds
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user!.id;

    const favorites = await db.campgroundFollow.findMany({
      where: { userId },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            photos: { take: 1 }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(favorites);
  } catch (error: any) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// GET /api/campground-actions/wishlist — get user's wishlisted campgrounds
router.get('/wishlist', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const items = await db.campgroundWishlist.findMany({
      where: { userId },
      include: { campground: { select: { id: true, name: true, city: true, state: true, imageUrl: true, latitude: true, longitude: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/campground-actions/wishlist — get user's wishlisted campgrounds
router.get('/wishlist', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const items = await db.campgroundWishlist.findMany({
      where: { userId },
      include: { campground: { select: { id: true, name: true, city: true, state: true, imageUrl: true, latitude: true, longitude: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
