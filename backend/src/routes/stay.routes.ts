import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// POST /api/stays - Create a new stay
router.post(
  '/',
  authenticateToken,
  [
    body('campgroundId').isUUID(),
    body('checkIn').isISO8601(),
    body('checkOut').isISO8601(),
    body('siteNumber').optional().trim(),
    body('siteType').optional().trim(),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { campgroundId, checkIn, checkOut, siteNumber, siteType } = req.body;

      // Verify campground exists
      const campground = await prisma.campground.findUnique({
        where: { id: campgroundId },
      });

      if (!campground) {
        return res.status(404).json({ error: 'Campground not found' });
      }

      // Validate dates
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      if (checkOutDate <= checkInDate) {
        return res.status(400).json({ error: 'Check-out must be after check-in' });
      }

      if (checkInDate > new Date()) {
        return res.status(400).json({ error: 'Cannot log future stays' });
      }

      // Create stay
      const stay = await prisma.stay.create({
        data: {
          userId: (req as any).user.id,
          campgroundId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          siteNumber,
          siteType,
          status: 'PENDING', // Requires verification
        },
        include: {
          campground: {
            select: {
              name: true,
              slug: true,
              city: true,
              state: true,
            },
          },
        },
      });

      res.status(201).json(stay);
    } catch (error: any) {
      console.error('Create stay error:', error);
      res.status(500).json({ error: 'Failed to create stay' });
    }
  }
);

// PUT /api/stays/:stayId/review - Add or update review
router.put(
  '/:stayId/review',
  authenticateToken,
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('review').optional().trim(),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { stayId } = req.params;
      const { rating, review } = req.body;

      // Verify stay belongs to user
      const stay = await prisma.stay.findUnique({
        where: { id: stayId },
        include: { campground: true },
      });

      if (!stay) {
        return res.status(404).json({ error: 'Stay not found' });
      }

      if (stay.userId !== (req as any).user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (stay.status !== 'VERIFIED') {
        return res.status(400).json({ error: 'Can only review verified stays' });
      }

      // Update stay with review
      const updatedStay = await prisma.stay.update({
        where: { id: stayId },
        data: {
          rating,
          review,
        },
      });

      // Recalculate campground average rating
      const campgroundReviews = await prisma.stay.findMany({
        where: {
          campgroundId: stay.campgroundId,
          status: 'VERIFIED',
          rating: { not: null },
        },
        select: { rating: true },
      });

      if (campgroundReviews.length > 0) {
        const avgRating =
          campgroundReviews.reduce((sum: any, s: any) => sum + (s.rating || 0), 0) /
          campgroundReviews.length;

        await prisma.campground.update({
          where: { id: stay.campgroundId },
          data: {
            averageRating: Math.round(avgRating * 10) / 10,
            totalReviews: campgroundReviews.length,
          },
        });
      }

      res.json(updatedStay);
    } catch (error: any) {
      console.error('Update review error:', error);
      res.status(500).json({ error: 'Failed to update review' });
    }
  }
);

// PUT /api/stays/:stayId/verify - Verify a stay (admin only for MVP)
router.put('/:stayId/verify', authenticateToken, async (req: any, res: any) => {
  try {
    const { stayId } = req.params;

    // For MVP, allow users to auto-verify their own stays
    // In production, this would require campground admin approval
    const stay = await prisma.stay.findUnique({
      where: { id: stayId },
    });

    if (!stay) {
      return res.status(404).json({ error: 'Stay not found' });
    }

    if (stay.userId !== (req as any).user.id && (req as any).user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedStay = await prisma.stay.update({
      where: { id: stayId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: (req as any).user.id,
      },
    });

    // Update user's total stays and states visited
    const userStays = await prisma.stay.findMany({
      where: {
        userId: stay.userId,
        status: 'VERIFIED',
      },
      include: {
        campground: {
          select: { state: true },
        },
      },
    });

    const statesVisited = [...new Set(userStays.map((s: any) => s.campground.state))];

    await prisma.user.update({
      where: { id: stay.userId },
      data: {
        totalStays: userStays.length,
        statesVisited,
      },
    });

    // Update campground total stays
    const campgroundStayCount = await prisma.stay.count({
      where: {
        campgroundId: stay.campgroundId,
        status: 'VERIFIED',
      },
    });

    await prisma.campground.update({
      where: { id: stay.campgroundId },
      data: {
        totalStays: campgroundStayCount,
      },
    });

    res.json(updatedStay);
  } catch (error: any) {
    console.error('Verify stay error:', error);
    res.status(500).json({ error: 'Failed to verify stay' });
  }
});

// GET /api/stays/my - Get current user's stays
router.get('/my', authenticateToken, async (req: any, res: any) => {
  try {
    const stays = await prisma.stay.findMany({
      where: { userId: (req as any).user.id },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            state: true,
            coverImage: true,
          },
        },
      },
      orderBy: {
        checkIn: 'desc',
      },
    });

    res.json(stays);
  } catch (error: any) {
    console.error('Get my stays error:', error);
    res.status(500).json({ error: 'Failed to fetch stays' });
  }
});

export default router;
