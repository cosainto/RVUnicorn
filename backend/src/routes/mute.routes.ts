import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/mute - Get all muted entities for current user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const mutedEntities = await prisma.mutedEntity.findMany({
      where: { userId },
      include: {
        mutedUser: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        },
        mutedCampground: {
          select: { id: true, name: true, location: true }
        }
      }
    });

    res.json(mutedEntities);
  } catch (error) {
    console.error('Get muted entities error:', error);
    res.status(500).json({ error: 'Failed to get muted entities' });
  }
});

// POST /api/mute/user/:userId - Mute a user
router.post('/user/:targetUserId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { targetUserId } = req.params;

    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Cannot mute yourself' });
    }

    const existing = await prisma.mutedEntity.findFirst({
      where: { userId, mutedUserId: targetUserId }
    });

    if (existing) {
      return res.status(400).json({ error: 'User already muted' });
    }

    const muted = await prisma.mutedEntity.create({
      data: {
        userId,
        mutedUserId: targetUserId
      },
      include: {
        mutedUser: {
          select: { id: true, username: true, firstName: true, lastName: true }
        }
      }
    });

    res.status(201).json(muted);
  } catch (error) {
    console.error('Mute user error:', error);
    res.status(500).json({ error: 'Failed to mute user' });
  }
});

// DELETE /api/mute/user/:userId - Unmute a user
router.delete('/user/:targetUserId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { targetUserId } = req.params;

    await prisma.mutedEntity.deleteMany({
      where: { userId, mutedUserId: targetUserId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unmute user error:', error);
    res.status(500).json({ error: 'Failed to unmute user' });
  }
});

// POST /api/mute/campground/:campgroundId - Mute a campground
router.post('/campground/:campgroundId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId } = req.params;

    const existing = await prisma.mutedEntity.findFirst({
      where: { userId, mutedCampgroundId: campgroundId }
    });

    if (existing) {
      return res.status(400).json({ error: 'Campground already muted' });
    }

    const muted = await prisma.mutedEntity.create({
      data: {
        userId,
        mutedCampgroundId: campgroundId
      },
      include: {
        mutedCampground: {
          select: { id: true, name: true, location: true }
        }
      }
    });

    res.status(201).json(muted);
  } catch (error) {
    console.error('Mute campground error:', error);
    res.status(500).json({ error: 'Failed to mute campground' });
  }
});

// DELETE /api/mute/campground/:campgroundId - Unmute a campground
router.delete('/campground/:campgroundId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId } = req.params;

    await prisma.mutedEntity.deleteMany({
      where: { userId, mutedCampgroundId: campgroundId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unmute campground error:', error);
    res.status(500).json({ error: 'Failed to unmute campground' });
  }
});

// GET /api/mute/check/user/:userId - Check if user is muted
router.get('/check/user/:targetUserId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { targetUserId } = req.params;

    const muted = await prisma.mutedEntity.findFirst({
      where: { userId, mutedUserId: targetUserId }
    });

    res.json({ isMuted: !!muted });
  } catch (error) {
    console.error('Check muted user error:', error);
    res.status(500).json({ error: 'Failed to check muted status' });
  }
});

// GET /api/mute/check/campground/:campgroundId - Check if campground is muted
router.get('/check/campground/:campgroundId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId } = req.params;

    const muted = await prisma.mutedEntity.findFirst({
      where: { userId, mutedCampgroundId: campgroundId }
    });

    res.json({ isMuted: !!muted });
  } catch (error) {
    console.error('Check muted campground error:', error);
    res.status(500).json({ error: 'Failed to check muted status' });
  }
});

export default router;
