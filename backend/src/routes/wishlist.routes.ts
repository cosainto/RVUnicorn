import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';
import crypto from 'crypto';

const router = Router();

// GET /api/wishlist - Get user's campground wishlist
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    console.log('Getting wishlist for user:', userId);

    const wishlist = await prisma.campgroundWishlist.findMany({
      where: { userId }
    });
    
    console.log('Found wishlist items:', wishlist.length);

    // Get campground details separately
    const results = [];
    for (const item of wishlist) {
      const campground = await prisma.campground.findUnique({
        where: { id: item.campgroundId }
      });
      results.push({ ...item, campground });
    }

    res.json(results);
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ error: 'Failed to get wishlist' });
  }
});

// GET /api/wishlist/check/:campgroundId - Check if campground is in wishlist
router.get('/check/:campgroundId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campgroundId } = req.params;

    const item = await prisma.campgroundWishlist.findUnique({
      where: {
        userId_campgroundId: { userId, campgroundId }
      }
    });

    res.json({ inWishlist: !!item, item });
  } catch (error) {
    console.error('Check wishlist error:', error);
    res.status(500).json({ error: 'Failed to check wishlist' });
  }
});

// POST /api/wishlist/:campgroundId - Add campground to wishlist
router.post('/:campgroundId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campgroundId } = req.params;
    const { notes, priority } = req.body;

    // Check if campground exists
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId }
    });

    if (!campground) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    // Check if already in wishlist
    const existing = await prisma.campgroundWishlist.findUnique({
      where: {
        userId_campgroundId: { userId, campgroundId }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Already in wishlist' });
    }

    const item = await prisma.campgroundWishlist.create({
      data: {
        id: crypto.randomBytes(12).toString('hex'),
        userId,
        campgroundId,
        notes: notes || null,
        priority: priority || 0
      },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true
          }
        }
      }
    });

    res.json(item);
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// PUT /api/wishlist/:campgroundId - Update wishlist item (notes, priority)
router.put('/:campgroundId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campgroundId } = req.params;
    const { notes, priority } = req.body;

    const item = await prisma.campgroundWishlist.update({
      where: {
        userId_campgroundId: { userId, campgroundId }
      },
      data: {
        notes: notes !== undefined ? notes : undefined,
        priority: priority !== undefined ? priority : undefined
      }
    });

    res.json(item);
  } catch (error) {
    console.error('Update wishlist error:', error);
    res.status(500).json({ error: 'Failed to update wishlist item' });
  }
});

// DELETE /api/wishlist/:campgroundId - Remove from wishlist
router.delete('/:campgroundId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campgroundId } = req.params;

    await prisma.campgroundWishlist.delete({
      where: {
        userId_campgroundId: { userId, campgroundId }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

// POST /api/wishlist/:campgroundId/toggle - Toggle wishlist status
router.post('/:campgroundId/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campgroundId } = req.params;

    const existing = await prisma.campgroundWishlist.findUnique({
      where: {
        userId_campgroundId: { userId, campgroundId }
      }
    });

    if (existing) {
      // Remove from wishlist
      await prisma.campgroundWishlist.delete({
        where: { id: existing.id }
      });
      res.json({ inWishlist: false });
    } else {
      // Add to wishlist
      await prisma.campgroundWishlist.create({
        data: {
          id: crypto.randomBytes(12).toString('hex'),
          userId,
          campgroundId
        }
      });
      res.json({ inWishlist: true });
    }
  } catch (error) {
    console.error('Toggle wishlist error:', error);
    res.status(500).json({ error: 'Failed to toggle wishlist' });
  }
});

export default router;
