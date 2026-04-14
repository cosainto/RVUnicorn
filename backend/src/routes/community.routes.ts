import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const db = prisma as any;

// Get all threads for a campground
router.get('/campgrounds/:campgroundId/threads', async (req, res) => {
  try {
    const { campgroundId } = req.params;

    const threads = await db.communityThread.findMany({
      where: { campgroundId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicture: true,
          },
        },
        _count: {
          select: { replies: true },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ threads });
  } catch (error: any) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

// Get single thread with replies
router.get('/threads/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = await db.communityThread.findUnique({
      where: { id: threadId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicture: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                name: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json(thread);
  } catch (error: any) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// Create new thread
router.post('/campgrounds/:campgroundId/threads', authenticateToken, async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const { title, content } = req.body;
    const userId = (req as any).userId;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const thread = await db.communityThread.create({
      data: {
        campgroundId,
        authorId: userId,
        title,
        content,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicture: true,
          },
        },
      },
    });

    res.status(201).json(thread);
  } catch (error: any) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

// Reply to thread
router.post('/threads/:threadId/replies', authenticateToken, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { content } = req.body;
    const userId = (req as any).userId;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const thread = await db.communityThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.isLocked) {
      return res.status(403).json({ error: 'This thread is locked' });
    }

    const reply = await db.communityReply.create({
      data: {
        threadId,
        authorId: userId,
        content,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            profilePicture: true,
          },
        },
      },
    });

    res.status(201).json(reply);
  } catch (error: any) {
    console.error('Error creating reply:', error);
    res.status(500).json({ error: 'Failed to create reply' });
  }
});

export default router;
