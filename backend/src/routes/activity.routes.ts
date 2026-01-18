import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// POST /api/activity/:id/like - Like/unlike an activity
router.post('/:id/like', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const activityId = req.params.id;

    // Check if activity exists
    const activity = await prisma.activity.findUnique({
      where: { id: activityId }
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Check if already liked
    const existingLike = await prisma.activityLike.findUnique({
      where: {
        activityId_userId: {
          activityId,
          userId
        }
      }
    });

    if (existingLike) {
      // Unlike
      await prisma.activityLike.delete({
        where: { id: existingLike.id }
      });
      
      const likeCount = await prisma.activityLike.count({
        where: { activityId }
      });
      
      return res.json({ liked: false, likeCount });
    } else {
      // Like
      await prisma.activityLike.create({
        data: {
          activityId,
          userId
        }
      });
      
      const likeCount = await prisma.activityLike.count({
        where: { activityId }
      });
      
      return res.json({ liked: true, likeCount });
    }
  } catch (error) {
    console.error('Activity like error:', error);
    res.status(500).json({ error: 'Failed to like activity' });
  }
});

// GET /api/activity/:id/likes - Get likes for an activity
router.get('/:id/likes', async (req, res) => {
  try {
    const activityId = req.params.id;

    const likes = await prisma.activityLike.findMany({
      where: { activityId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(likes);
  } catch (error) {
    console.error('Get activity likes error:', error);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

export default router;
