import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth.middleware';
import { Request, Response } from 'express';

const router = Router();

// Middleware to check if user is a moderator for a campground
async function isModerator(userId: string, campgroundId: string): Promise<boolean> {
  const moderator = await prisma.campgroundModerator.findFirst({
    where: {
      userId,
      campgroundId,
      isActive: true,
    },
  });
  return !!moderator;
}

// Assign a moderator to a campground (campground admin only)
router.post('/campgrounds/:campgroundId/moderators', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { userId: moderatorUserId } = req.body;
    const adminUserId = (req as any).userId;

    if (!moderatorUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if requester is campground admin
    const admin = await prisma.campsiteAdmin.findFirst({
      where: {
        campgroundId,
        userId: adminUserId,
      },
    });

    if (!admin) {
      return res.status(403).json({ error: 'Only campground admins can assign moderators' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: moderatorUserId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a moderator
    const existing = await prisma.campgroundModerator.findUnique({
      where: {
        campgroundId_userId: {
          campgroundId,
          userId: moderatorUserId,
        },
      },
    });

    if (existing) {
      if (existing.isActive) {
        return res.status(400).json({ error: 'User is already a moderator' });
      }
      // Reactivate
      const reactivated = await prisma.campgroundModerator.update({
        where: { id: existing.id },
        data: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });
      return res.json(reactivated);
    }

    // Create new moderator
    const moderator = await prisma.campgroundModerator.create({
      data: {
        campgroundId,
        userId: moderatorUserId,
        assignedBy: adminUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicture: true,
          },
        },
      },
    });

    res.status(201).json(moderator);
  } catch (error) {
    console.error('Error assigning moderator:', error);
    res.status(500).json({ error: 'Failed to assign moderator' });
  }
});

// Remove a moderator (campground admin only)
router.delete('/campgrounds/:campgroundId/moderators/:moderatorId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId, moderatorId } = req.params;
    const adminUserId = (req as any).userId;

    // Check if requester is campground admin
    const admin = await prisma.campsiteAdmin.findFirst({
      where: {
        campgroundId,
        userId: adminUserId,
      },
    });

    if (!admin) {
      return res.status(403).json({ error: 'Only campground admins can remove moderators' });
    }

    // Deactivate moderator
    await prisma.campgroundModerator.update({
      where: { id: moderatorId },
      data: { isActive: false },
    });

    res.json({ message: 'Moderator removed successfully' });
  } catch (error) {
    console.error('Error removing moderator:', error);
    res.status(500).json({ error: 'Failed to remove moderator' });
  }
});

// Get moderators for a campground
router.get('/campgrounds/:campgroundId/moderators', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;

    const moderators = await prisma.campgroundModerator.findMany({
      where: {
        campgroundId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json(moderators);
  } catch (error) {
    console.error('Error fetching moderators:', error);
    res.status(500).json({ error: 'Failed to fetch moderators' });
  }
});

// Pin/Unpin thread (moderator only)
router.patch('/threads/:threadId/pin', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { isPinned } = req.body;
    const userId = (req as any).userId;

    if (typeof isPinned !== 'boolean') {
      return res.status(400).json({ error: 'isPinned must be a boolean' });
    }

    const thread = await prisma.communityThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Check if user is moderator
    const isMod = await isModerator(userId, thread.campgroundId);
    if (!isMod) {
      return res.status(403).json({ error: 'Only moderators can pin threads' });
    }

    const updatedThread = await prisma.communityThread.update({
      where: { id: threadId },
      data: { isPinned },
    });

    // Log moderation action
    await prisma.moderationAction.create({
      data: {
        threadId,
        action: isPinned ? 'PIN_THREAD' : 'UNPIN_THREAD',
        moderatorId: userId,
      },
    });

    res.json(updatedThread);
  } catch (error) {
    console.error('Error pinning thread:', error);
    res.status(500).json({ error: 'Failed to pin thread' });
  }
});

// Lock/Unlock thread (moderator only)
router.patch('/threads/:threadId/lock', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { isLocked, reason } = req.body;
    const userId = (req as any).userId;

    if (typeof isLocked !== 'boolean') {
      return res.status(400).json({ error: 'isLocked must be a boolean' });
    }

    const thread = await prisma.communityThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Check if user is moderator
    const isMod = await isModerator(userId, thread.campgroundId);
    if (!isMod) {
      return res.status(403).json({ error: 'Only moderators can lock threads' });
    }

    const updatedThread = await prisma.communityThread.update({
      where: { id: threadId },
      data: { isLocked },
    });

    // Log moderation action
    await prisma.moderationAction.create({
      data: {
        threadId,
        action: isLocked ? 'LOCK_THREAD' : 'UNLOCK_THREAD',
        reason,
        moderatorId: userId,
      },
    });

    res.json(updatedThread);
  } catch (error) {
    console.error('Error locking thread:', error);
    res.status(500).json({ error: 'Failed to lock thread' });
  }
});

// Delete thread (moderator only)
router.delete('/threads/:threadId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).userId;

    const thread = await prisma.communityThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Check if user is moderator
    const isMod = await isModerator(userId, thread.campgroundId);
    if (!isMod) {
      return res.status(403).json({ error: 'Only moderators can delete threads' });
    }

    // Log moderation action before deletion
    await prisma.moderationAction.create({
      data: {
        threadId,
        action: 'DELETE_THREAD',
        reason,
        moderatorId: userId,
      },
    });

    await prisma.communityThread.delete({
      where: { id: threadId },
    });

    res.json({ message: 'Thread deleted successfully' });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({ error: 'Failed to delete thread' });
  }
});

// Delete reply (moderator only)
router.delete('/replies/:replyId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { replyId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).userId;

    const reply = await prisma.communityReply.findUnique({
      where: { id: replyId },
      include: {
        thread: true,
      },
    });

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    // Check if user is moderator
    const isMod = await isModerator(userId, reply.thread.campgroundId);
    if (!isMod) {
      return res.status(403).json({ error: 'Only moderators can delete replies' });
    }

    // Log moderation action before deletion
    await prisma.moderationAction.create({
      data: {
        replyId,
        action: 'DELETE_REPLY',
        reason,
        moderatorId: userId,
      },
    });

    await prisma.communityReply.delete({
      where: { id: replyId },
    });

    res.json({ message: 'Reply deleted successfully' });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
});

// Get moderation logs for a campground (moderators only)
router.get('/campgrounds/:campgroundId/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { page = '1', limit = '50' } = req.query;
    const userId = (req as any).userId;

    // Check if user is moderator
    const isMod = await isModerator(userId, campgroundId);
    if (!isMod) {
      return res.status(403).json({ error: 'Only moderators can view moderation logs' });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get thread IDs for this campground
    const threads = await prisma.communityThread.findMany({
      where: { campgroundId },
      select: { id: true },
    });

    const threadIds = threads.map(t => t.id);

    const [logs, total] = await Promise.all([
      prisma.moderationAction.findMany({
        where: {
          OR: [
            { threadId: { in: threadIds } },
            { replyId: { not: null } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.moderationAction.count({
        where: {
          OR: [
            { threadId: { in: threadIds } },
            { replyId: { not: null } },
          ],
        },
      }),
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error fetching moderation logs:', error);
    res.status(500).json({ error: 'Failed to fetch moderation logs' });
  }
});

export default router;
