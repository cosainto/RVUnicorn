import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// GET /api/top-friends - Get user's ranked top 8 friends
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;

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

    res.json(topFriends.map((tf: any) => ({
      ...tf.friend,
      rank: tf.rank,
    })));
  } catch (error: any) {
    console.error('Get top friends error:', error);
    res.status(500).json({ error: 'Failed to get top friends' });
  }
});

// PUT /api/top-friends - Update all rankings at once
router.put('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
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
    await prisma.$transaction(async (tx: any) => {
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

    res.json(topFriends.map((tf: any) => ({
      ...tf.friend,
      rank: tf.rank,
    })));
  } catch (error: any) {
    console.error('Update top friends error:', error);
    res.status(500).json({ error: 'Failed to update top friends' });
  }
});

// POST /api/top-friends/:friendId - Add a friend to top 8
router.post('/:friendId', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { friendId } = req.params;
    const { rank } = req.body;

    // Prevent adding yourself as a friend
    if (friendId === userId) {
      return res.status(400).json({ error: 'You cannot add yourself as a top friend' });
    }

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
  } catch (error: any) {
    console.error('Add top friend error:', error);
    res.status(500).json({ error: 'Failed to add top friend' });
  }
});

// DELETE /api/top-friends/:friendId - Remove from top 8
router.delete('/:friendId', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { friendId } = req.params;

    await prisma.topFriend.deleteMany({
      where: { userId, friendId },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Remove top friend error:', error);
    res.status(500).json({ error: 'Failed to remove top friend' });
  }
});

// GET /api/top-friends/profile-grid/:userId - Get 8-slot grid for any user's profile
// Public endpoint — no auth required (uses optionalAuth for viewer context)
router.get('/profile-grid/:userId', async (req: any, res) => {
  try {
    const { userId } = req.params;
    const items: any[] = [];
    const usedFriendIds = new Set<string>();

    // Tier 1: User's manually selected Top 8 friends
    const top8 = await prisma.topFriend.findMany({
      where: { userId },
      orderBy: { rank: 'asc' },
      include: {
        friend: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
      },
    });

    for (const tf of top8) {
      if (items.length >= 8) break;
      items.push({
        type: 'friend',
        id: tf.friend.id,
        name: `${tf.friend.firstName} ${tf.friend.lastName}`,
        image: tf.friend.profilePicture || null,
        url: `/profile/${tf.friend.username}`,
        rank: tf.rank,
      });
      usedFriendIds.add(tf.friend.id);
    }

    // Tier 2: Fill remaining with other connected friends (random)
    if (items.length < 8) {
      const remaining = 8 - items.length;
      const friendships = await prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ initiatorId: userId }, { receiverId: userId }],
        },
        include: {
          initiator: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          receiver: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        },
        take: remaining + 10, // fetch extra to filter dupes
      });

      // Shuffle for randomness
      const shuffled = friendships.sort(() => Math.random() - 0.5);
      for (const f of shuffled) {
        if (items.length >= 8) break;
        const friend = f.initiatorId === userId ? f.receiver : f.initiator;
        if (usedFriendIds.has(friend.id)) continue;
        items.push({
          type: 'friend',
          id: friend.id,
          name: `${friend.firstName} ${friend.lastName}`,
          image: friend.profilePicture || null,
          url: `/profile/${friend.username}`,
        });
        usedFriendIds.add(friend.id);
      }
    }

    // Tier 3: Fill remaining with visited campsites
    if (items.length < 8) {
      const remaining = 8 - items.length;
      const checkins = await prisma.checkIn.findMany({
        where: { userId, campgroundId: { not: null } },
        distinct: ['campgroundId'],
        orderBy: { checkInDate: 'desc' },
        take: remaining,
        include: {
          campground: { select: { id: true, name: true, imageUrl: true, customSlug: true } },
        },
      });
      for (const c of checkins) {
        if (items.length >= 8 || !c.campground) break;
        items.push({
          type: 'campsite',
          id: c.campground.id,
          name: c.campground.name,
          image: c.campground.imageUrl || null,
          url: `/campgrounds/${c.campground.customSlug || c.campground.id}`,
        });
      }
    }

    // Tier 4: Fill remaining with random campsite recommendations
    if (items.length < 8) {
      const remaining = 8 - items.length;
      const usedCampIds = new Set(items.filter(i => i.type === 'campsite').map(i => i.id));
      const randomCamps = await prisma.campground.findMany({
        where: {
          imageUrl: { not: null },
          id: { notIn: Array.from(usedCampIds) },
        },
        select: { id: true, name: true, imageUrl: true, customSlug: true },
        take: remaining + 5,
      });
      const shuffled = randomCamps.sort(() => Math.random() - 0.5);
      for (const cg of shuffled) {
        if (items.length >= 8) break;
        items.push({
          type: 'campsite',
          id: cg.id,
          name: cg.name,
          image: cg.imageUrl || null,
          url: `/campgrounds/${cg.customSlug || cg.id}`,
        });
      }
    }

    res.json(items.slice(0, 8));
  } catch (error: any) {
    console.error('Profile grid error:', error);
    res.status(500).json({ error: 'Failed to load profile grid' });
  }
});

export default router;
