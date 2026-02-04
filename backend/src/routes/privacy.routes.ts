// privacy.routes.ts - Updated with email notifications
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';
import { sendUserBlockedEmail, sendPrivacyChangedEmail } from '../services/security-emails';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/privacy - Get user's privacy settings
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    let preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId,
          profileVisibility: 'PUBLIC',
          friendRequestSetting: 'EVERYONE',
          showOnlineStatus: true,
          showLastActive: true,
          allowTagging: true,
          allowWallPosts: true,
          showTravelMap: 'FRIENDS',
          showRecipes: 'PUBLIC',
          showGear: 'FRIENDS',
          showRVDetails: 'FRIENDS'
        }
      });
    }

    res.json(preferences);
  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({ error: 'Failed to get privacy settings' });
  }
});

// PUT /api/privacy - Update privacy settings
router.put('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      profileVisibility,
      friendRequestSetting,
      showOnlineStatus,
      showLastActive,
      allowTagging,
      allowWallPosts,
      showTravelMap,
      showRecipes,
      showGear,
      showRVDetails
    } = req.body;

    // Get current settings to track changes
    const currentSettings = await prisma.userPreferences.findUnique({
      where: { userId }
    });

    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        profileVisibility: profileVisibility || 'PUBLIC',
        friendRequestSetting: friendRequestSetting || 'EVERYONE',
        showOnlineStatus: showOnlineStatus ?? true,
        showLastActive: showLastActive ?? true,
        allowTagging: allowTagging ?? true,
        allowWallPosts: allowWallPosts ?? true,
        showTravelMap: showTravelMap || 'FRIENDS',
        showRecipes: showRecipes || 'PUBLIC',
        showGear: showGear || 'FRIENDS',
        showRVDetails: showRVDetails || 'FRIENDS'
      },
      update: {
        profileVisibility,
        friendRequestSetting,
        showOnlineStatus,
        showLastActive,
        allowTagging,
        allowWallPosts,
        showTravelMap,
        showRecipes,
        showGear,
        showRVDetails
      }
    });

    // Track what changed for the email
    const changes: string[] = [];
    if (currentSettings) {
      if (profileVisibility && currentSettings.profileVisibility !== profileVisibility) {
        changes.push(`Profile visibility changed to ${profileVisibility}`);
      }
      if (friendRequestSetting && currentSettings.friendRequestSetting !== friendRequestSetting) {
        changes.push(`Friend request setting changed to ${friendRequestSetting}`);
      }
      if (showOnlineStatus !== undefined && currentSettings.showOnlineStatus !== showOnlineStatus) {
        changes.push(`Online status ${showOnlineStatus ? 'enabled' : 'disabled'}`);
      }
      if (showLastActive !== undefined && currentSettings.showLastActive !== showLastActive) {
        changes.push(`Last active visibility ${showLastActive ? 'enabled' : 'disabled'}`);
      }
    }

    // Log activity
    await prisma.accountActivityLog.create({
      data: {
        userId,
        action: 'PRIVACY_UPDATED',
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
        details: JSON.stringify({ changes })
      }
    });

    // Send email notification if significant changes were made
    if (changes.length > 0) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await sendPrivacyChangedEmail({
          email: user.email,
          firstName: user.firstName,
          changes,
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
          timestamp: new Date()
        });
      }
    }

    res.json(preferences);
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// GET /api/privacy/blocked - Get blocked users list
router.get('/blocked', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const blockedUsers = await prisma.blockedUser.findMany({
      where: { userId },
      include: {
        blockedUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(blockedUsers);
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Failed to get blocked users' });
  }
});

// POST /api/privacy/block/:userId - Block a user
router.post('/block/:targetUserId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { targetUserId } = req.params;
    const { reason } = req.body;

    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Check if already blocked
    const existingBlock = await prisma.blockedUser.findUnique({
      where: {
        userId_blockedUserId: {
          userId,
          blockedUserId: targetUserId
        }
      }
    });

    if (existingBlock) {
      return res.status(400).json({ error: 'User already blocked' });
    }

    // Get target user info for email
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { username: true }
    });

    // Create block
    const block = await prisma.blockedUser.create({
      data: {
        userId,
        blockedUserId: targetUserId,
        reason
      }
    });

    // Remove any existing friendship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { initiatorId: userId, receiverId: targetUserId },
          { initiatorId: targetUserId, receiverId: userId }
        ]
      }
    });

    // Remove from top friends if present
    await prisma.topFriend.deleteMany({
      where: {
        OR: [
          { userId, friendId: targetUserId },
          { userId: targetUserId, friendId: userId }
        ]
      }
    });

    // Log activity
    await prisma.accountActivityLog.create({
      data: {
        userId,
        action: 'USER_BLOCKED',
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
        details: JSON.stringify({ blockedUserId: targetUserId })
      }
    });

    // Send email notification (optional - can be disabled)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && targetUser) {
      await sendUserBlockedEmail({
        email: user.email,
        firstName: user.firstName,
        blockedUsername: targetUser.username,
        timestamp: new Date()
      });
    }

    res.json({ message: 'User blocked', block });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// DELETE /api/privacy/block/:userId - Unblock a user
router.delete('/block/:targetUserId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { targetUserId } = req.params;

    const block = await prisma.blockedUser.findUnique({
      where: {
        userId_blockedUserId: {
          userId,
          blockedUserId: targetUserId
        }
      }
    });

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    await prisma.blockedUser.delete({
      where: { id: block.id }
    });

    // Log activity
    await prisma.accountActivityLog.create({
      data: {
        userId,
        action: 'USER_UNBLOCKED',
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
        details: JSON.stringify({ unblockedUserId: targetUserId })
      }
    });

    res.json({ message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// GET /api/privacy/is-blocked/:userId - Check if user is blocked (either direction)
router.get('/is-blocked/:targetUserId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { targetUserId } = req.params;

    const block = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { userId, blockedUserId: targetUserId },
          { userId: targetUserId, blockedUserId: userId }
        ]
      }
    });

    res.json({
      isBlocked: !!block,
      blockedByMe: block?.userId === userId,
      blockedByThem: block?.userId === targetUserId
    });
  } catch (error) {
    console.error('Check block status error:', error);
    res.status(500).json({ error: 'Failed to check block status' });
  }
});

// GET /api/privacy/activity-log - Get account activity log
router.get('/activity-log', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { limit = 20, offset = 0 } = req.query;

    const activities = await prisma.accountActivityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await prisma.accountActivityLog.count({
      where: { userId }
    });

    res.json({
      activities,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Failed to get activity log' });
  }
});


// PUT /api/privacy/badge-position - Save badge positions on profile
router.put('/badge-position', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { positions } = req.body;

    await prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        badgePosition: JSON.stringify({ positions })
      },
      update: {
        badgePosition: JSON.stringify({ positions })
      }
    });

    res.json({ success: true, positions });
  } catch (error) {
    console.error('Save badge position error:', error);
    res.status(500).json({ error: 'Failed to save badge position' });
  }
});

// GET /api/privacy/badge-position/:userId - Get badge positions for a user
router.get('/badge-position/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const prefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { badgePosition: true }
    });

    const data = prefs?.badgePosition 
      ? JSON.parse(prefs.badgePosition) 
      : { positions: {} };

    res.json(data);
  } catch (error) {
    console.error('Get badge position error:', error);
    res.status(500).json({ error: 'Failed to get badge position' });
  }
});

export default router;
