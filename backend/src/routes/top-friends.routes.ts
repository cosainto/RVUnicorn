import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/top-friends - Get user's ranked top 8 friends
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;

    const topFriends = await prisma.topFriend.findMany({
      where: { userId },
      orderBy: { rank: 'asc' },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });

    res.json(topFriends.map(tf => ({
      ...tf.friend,
      rank: tf.rank,
    })));
  } catch (error) {
    console.error('Get top friends error:', error);
    res.status(500).json({ error: 'Failed to get top friends' });
  }
});

// PUT /api/top-friends - Update all rankings at once
router.put('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { rankings } = req.body; // Array of { friendId, rank }

    if (!rankings || !Array.isArray(rankings)) {
      return res.status(400).json({ error: 'Rankings array is required' });
    }

    // Validate rankings (1-8)
    for (const r of rankings) {
      if (r.rank < 1 || r.rank > 8) {
        return res.status(400).json({ error: 'Rank must be between 1 and 8' });
      }
    }

    // Delete existing rankings and insert new ones in a transaction
    await prisma.$transaction(async (tx) => {
      // Remove all current top friends for this user
      await tx.topFriend.deleteMany({
        where: { userId },
      });

      // Insert new rankings
      for (const r of rankings) {
        await tx.topFriend.create({
          data: {
            userId,
            friendId: r.friendId,
            rank: r.rank,
          },
        });
      }
    });

    // Return updated list
    const topFriends = await prisma.topFriend.findMany({
      where: { userId },
      orderBy: { rank: 'asc' },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });

    res.json(topFriends.map(tf => ({
      ...tf.friend,
      rank: tf.rank,
    })));
  } catch (error) {
    console.error('Update top friends error:', error);
    res.status(500).json({ error: 'Failed to update top friends' });
  }
});

// POST /api/top-friends/:friendId - Add a friend to top 8
router.post('/:friendId', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const { rank } = req.body;

    // Check if already have 8 top friends
    const count = await prisma.topFriend.count({
      where: { userId },
    });

    if (count >= 8) {
      return res.status(400).json({ error: 'You can only have 8 top friends' });
    }

    // Get the next available rank if not specified
    let useRank = rank;
    if (!useRank) {
      const maxRank = await prisma.topFriend.findFirst({
        where: { userId },
        orderBy: { rank: 'desc' },
        select: { rank: true },
      });
      useRank = (maxRank?.rank || 0) + 1;
    }

    // Check if friend is already in top friends
    const existing = await prisma.topFriend.findUnique({
      where: {
        userId_friendId: { userId, friendId },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Friend is already in your top 8' });
    }

    await prisma.topFriend.create({
      data: {
        userId,
        friendId,
        rank: useRank,
      },
    });

    res.json({ success: true, rank: useRank });
  } catch (error) {
    console.error('Add top friend error:', error);
    res.status(500).json({ error: 'Failed to add top friend' });
  }
});

// DELETE /api/top-friends/:friendId - Remove from top 8
router.delete('/:friendId', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    await prisma.topFriend.deleteMany({
      where: { userId, friendId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove top friend error:', error);
    res.status(500).json({ error: 'Failed to remove top friend' });
  }
});

export default router;
