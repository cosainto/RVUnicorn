import { Router, Request, Response } from 'express';
import { logFriendAdded } from '../services/activity.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
const db = prisma as any;

// GET /api/friends - Get user's friends
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const friendships = await db.friendship.findMany({
      where: {
        OR: [
          { initiatorId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' }
        ]
      },
      include: {
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      }
    });

    // Map to return the friend with the friendshipId
    const friends = friendships.map((f: any) => ({
      ...(f.initiatorId === userId ? f.receiver : f.initiator),
      friendshipId: f.id
    }));

    res.json(friends);
  } catch (error: any) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// GET /api/friends/requests - Get pending friend requests (received)
router.get('/requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const requests = await db.friendship.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING'
      },
      include: {
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      }
    });

    res.json(requests);
  } catch (error: any) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// GET /api/friends/sent-requests - Get sent friend requests
router.get('/sent-requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const sentRequests = await db.friendship.findMany({
      where: {
        initiatorId: userId,
        status: 'PENDING'
      },
      include: {
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      }
    });

    res.json(sentRequests);
  } catch (error: any) {
    console.error('Get sent requests error:', error);
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
});

// POST /api/friends/request - Send friend request
router.post('/request', authenticateToken, async (req: Request, res: Response) => {
  try {
    const initiatorId = (req as any).userId;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ error: 'Friend ID is required' });
    }

    if (initiatorId === friendId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if friendship already exists
    const existing = await db.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: initiatorId, receiverId: friendId },
          { initiatorId: friendId, receiverId: initiatorId }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Friendship already exists' });
    }

    const friendship = await db.friendship.create({
      data: {
        initiatorId: initiatorId,
        receiverId: friendId,
        status: 'PENDING'
      },
      include: {
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      }
    });

    // Create notification for the friend request recipient
    await db.notification.create({
      data: {
        userId: friendId,
        type: 'FRIEND_REQUEST',
        content: `${friendship.initiator.firstName} ${friendship.initiator.lastName} sent you a friend request`,
        link: `/friends`,
        read: false
      }
    });

    // Create BasecampActivity for friend request (shows in Basecamp feed with Accept/Decline)
    await db.basecampActivity.create({
      data: {
        userId: friendId,
        actorId: initiatorId,
        type: 'FRIEND_REQUEST',
        entityType: 'USER',
        entityId: initiatorId,
        entityName: `${friendship.initiator.firstName} ${friendship.initiator.lastName}`,
        metadata: {
          friendshipId: friendship.id,
          canRespond: true
        }
      }
    });

    res.json(friendship);
  } catch (error: any) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// PUT /api/friends/accept/:friendshipId - Accept friend request
router.put('/accept/:friendshipId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { friendshipId } = req.params;

    const friendship = await db.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (friendship.receiverId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await db.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
      include: {
        initiator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      }
    });

    // Create notification for the person who sent the request
    await db.notification.create({
      data: {
        userId: updated.initiatorId,
        type: 'FRIEND_ACCEPT',
        content: `${updated.receiver.firstName} ${updated.receiver.lastName} accepted your friend request`,
        link: `/profile/${updated.receiver.username}`,
        read: false
      }
    });

    // Clean up the FRIEND_REQUEST BasecampActivity row left over from when
    // the request was first sent — it's no longer relevant now that the
    // request has been accepted.
    await db.basecampActivity.deleteMany({
      where: {
        userId: userId,
        type: 'FRIEND_REQUEST',
        actorId: updated.initiatorId
      }
    });

    // ONE Activity row per friendship — the acceptor is the actor, the
    // initiator is the target. The activity feed query already returns
    // rows where the current user is EITHER userId or targetUserId
    // (profile.routes.ts:1152-1155), so this single row shows up in both
    // users' feeds, rendering as "You became friends with X" for the
    // acceptor and "Stefanie became friends with you" for the initiator.
    //
    // Previously this endpoint created two Activity rows AND two
    // BasecampActivity NEW_CAMPING_BUDDY rows for the same event, which
    // surfaced as 3 duplicate notifications in the basecamp feed.
    await logFriendAdded(updated.receiverId, updated.initiatorId, updated.initiator.firstName + ' ' + updated.initiator.lastName);

    res.json(updated);
  } catch (error: any) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// DELETE /api/friends/:friendshipId - Remove friend or reject request
router.delete('/:friendshipId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { friendshipId } = req.params;

    const friendship = await db.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    if (friendship.initiatorId !== userId && friendship.receiverId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.friendship.delete({
      where: { id: friendshipId }
    });

    res.json({ message: 'Friendship removed' });
  } catch (error: any) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// GET /api/friends/status/:userId - Check friendship status with another user
router.get('/status/:targetUserId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { targetUserId } = req.params;

    const friendship = await db.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: userId, receiverId: targetUserId },
          { initiatorId: targetUserId, receiverId: userId }
        ]
      }
    });

    if (!friendship) {
      return res.json({ status: 'none' });
    }

    res.json({
      status: friendship.status,
      friendshipId: friendship.id,
      isInitiator: friendship.initiatorId === userId
    });
  } catch (error: any) {
    console.error('Get friendship status error:', error);
    res.status(500).json({ error: 'Failed to get friendship status' });
  }
});

// GET /api/friends/on-the-road — Lifestyle Mode friends currently checked in
router.get('/on-the-road', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get all accepted friendships for current user
    const friendships = await db.friendship.findMany({
      where: {
        OR: [
          { initiatorId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
      select: { initiatorId: true, receiverId: true },
    });

    const friendIds = friendships.map((f: any) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    if (friendIds.length === 0) {
      return res.json([]);
    }

    // Find friends with active check-ins
    const activeCheckIns = await db.checkIn.findMany({
      where: {
        userId: { in: friendIds },
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Deduplicate by user (take first / most recent)
    const seen = new Set<string>();
    const results = activeCheckIns
      .filter((ci: any) => {
        if (seen.has(ci.userId)) return false;
        seen.add(ci.userId);
        return true;
      })
      .map((ci: any) => ({
        userId: ci.user.id,
        displayName: [ci.user.firstName, ci.user.lastName].filter(Boolean).join(' '),
        avatarUrl: ci.user.profilePicture,
        campgroundName: ci.campground?.name || null,
        campgroundId: ci.campground?.id || null,
      }));

    res.json(results);
  } catch (error: any) {
    console.error('On the road error:', error);
    res.status(500).json({ error: 'Failed to get friends on the road' });
  }
});

export default router;
