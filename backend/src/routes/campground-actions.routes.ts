import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// GET /api/campground-actions/:campgroundId/status - Get all action statuses
router.get('/:campgroundId/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campgroundId } = req.params;

    const [follow, wishlist, mute] = await Promise.all([
      prisma.campgroundFollow.findUnique({
        where: { userId_campgroundId: { userId, campgroundId } }
      }),
      prisma.campgroundWishlist.findUnique({
        where: { userId_campgroundId: { userId, campgroundId } }
      }),
      prisma.mutedEntity.findFirst({
        where: { userId, mutedCampgroundId: campgroundId }
      })
    ]);

    res.json({
      isFavorite: !!follow,
      inWishlist: !!wishlist,
      isMuted: !!mute
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// POST /api/campground-actions/:campgroundId/favorite/toggle
router.post('/:campgroundId/favorite/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campgroundId } = req.params;

    const existing = await prisma.campgroundFollow.findUnique({
      where: { userId_campgroundId: { userId, campgroundId } }
    });

    if (existing) {
      await prisma.campgroundFollow.delete({ where: { id: existing.id } });
      res.json({ isFavorite: false });
    } else {
      await prisma.campgroundFollow.create({
        data: { userId, campgroundId }
      });
      res.json({ isFavorite: true });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// POST /api/campground-actions/:campgroundId/mute/toggle
router.post('/:campgroundId/mute/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campgroundId } = req.params;

    const existing = await prisma.mutedEntity.findFirst({
      where: { userId, mutedCampgroundId: campgroundId }
    });

    if (existing) {
      await prisma.mutedEntity.delete({ where: { id: existing.id } });
      res.json({ isMuted: false });
    } else {
      await prisma.mutedEntity.create({
        data: { userId, mutedCampgroundId: campgroundId }
      });
      res.json({ isMuted: true });
    }
  } catch (error) {
    console.error('Toggle mute error:', error);
    res.status(500).json({ error: 'Failed to toggle mute' });
  }
});

// GET /api/campground-actions/favorites - Get user's favorite campgrounds
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const favorites = await prisma.campgroundFollow.findMany({
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
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// GET /api/campground-actions/wishlist — get user's wishlisted campgrounds
router.get('/wishlist', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const items = await prisma.campgroundWishlist.findMany({
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
    const userId = req.user.id;
    const items = await prisma.campgroundWishlist.findMany({
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
