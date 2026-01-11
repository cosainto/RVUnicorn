import { Router, Request, Response } from 'express';
import { logFriendAdded } from '../services/activity.service';
import { logFriendAdded } from '../services/activity.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

// GET /api/friends - Get user's friends
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const friendships = await prisma.friendship.findMany({
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
    const friends = friendships.map(f => ({
      ...(f.initiatorId === userId ? f.receiver : f.initiator),
      friendshipId: f.id
    }));

    res.json(friends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// GET /api/friends/requests - Get pending friend requests (received)
router.get('/requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const requests = await prisma.friendship.findMany({
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
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// GET /api/friends/sent-requests - Get sent friend requests
router.get('/sent-requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const sentRequests = await prisma.friendship.findMany({
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
  } catch (error) {
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
    const existing = await prisma.friendship.findFirst({
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

    const friendship = await prisma.friendship.create({
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
    await prisma.notification.create({
      data: {
        userId: friendId,
        type: 'FRIEND_REQUEST',
        content: `${friendship.initiator.firstName} ${friendship.initiator.lastName} sent you a friend request`,
        link: `/friends`,
        read: false
      }
    });

    // Create BasecampActivity for friend request (shows in Basecamp feed with Accept/Decline)
    await prisma.basecampActivity.create({
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
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// PUT /api/friends/accept/:friendshipId - Accept friend request
router.put('/accept/:friendshipId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { friendshipId } = req.params;

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (friendship.receiverId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.friendship.update({
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
    await prisma.notification.create({
      data: {
        userId: updated.initiatorId,
        type: 'FRIEND_ACCEPT',
        content: `${updated.receiver.firstName} ${updated.receiver.lastName} accepted your friend request`,
        link: `/profile/${updated.receiver.username}`,
        read: false
      }
    });

    // Create profile Activity for both users
    // Activity for the person who accepted (receiver)
    await prisma.activity.create({
      data: {
        userId: updated.receiverId,
        type: 'NEW_CAMPING_BUDDY',
        targetUserId: updated.initiatorId,
        content: '', // Content handled by frontend
        isPublic: true
      }
    });
    
    // Activity for the person who sent the request (initiator)
    await prisma.activity.create({
      data: {
        userId: updated.initiatorId,
        type: 'NEW_CAMPING_BUDDY',
        targetUserId: updated.receiverId,
        content: '', // Content handled by frontend
        isPublic: true
      }
    });
    
    // Create BasecampActivity so it shows in the basecamp feed for both users
    await prisma.basecampActivity.create({
      data: {
        userId: updated.initiatorId,
        actorId: updated.receiverId,
        type: 'NEW_CAMPING_BUDDY',
        entityType: 'USER',
        entityId: updated.receiverId,
        entityName: `${updated.receiver.firstName} ${updated.receiver.lastName}`,
        metadata: {}
      }
    });
    
    await prisma.basecampActivity.create({
      data: {
        userId: updated.receiverId,
        actorId: updated.initiatorId,
        type: 'NEW_CAMPING_BUDDY',
        entityType: 'USER',
        entityId: updated.initiatorId,
        entityName: `${updated.initiator.firstName} ${updated.initiator.lastName}`,
        metadata: {}
      }
    });

    // Delete the BasecampActivity for this friend request
    await prisma.basecampActivity.deleteMany({
      where: {
        userId: userId,
        type: 'FRIEND_REQUEST',
        actorId: updated.initiatorId
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// DELETE /api/friends/:friendshipId - Remove friend or reject request
router.delete('/:friendshipId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { friendshipId } = req.params;

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    if (friendship.initiatorId !== userId && friendship.receiverId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.friendship.delete({
      where: { id: friendshipId }
    });

    res.json({ message: 'Friendship removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// GET /api/friends/status/:userId - Check friendship status with another user
router.get('/status/:targetUserId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { targetUserId } = req.params;

    const friendship = await prisma.friendship.findFirst({
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
  } catch (error) {
    console.error('Get friendship status error:', error);
    res.status(500).json({ error: 'Failed to get friendship status' });
  }
});

export default router;
