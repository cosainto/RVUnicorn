import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();

// ==================== REACTIONS ====================

const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'campy', 'fire'];

// Add reaction to post
router.post('/posts/:postId/reactions', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { type } = req.body;
    const userId = (req as any).userId;

    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    // Check if user already has this reaction
    const existing = await prisma.reaction.findUnique({
      where: { userId_postId_type: { userId, postId, type } }
    });

    if (existing) {
      // Remove reaction (toggle off)
      await prisma.reaction.delete({ where: { id: existing.id } });
      return res.json({ removed: true, type });
    }

    // Add reaction
    const reaction = await prisma.reaction.create({
      data: { userId, postId, type }
    });

    res.json(reaction);
  } catch (error: any) {
    console.error('Add post reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Get reactions for post
router.get('/posts/:postId/reactions', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;

    const reactions = await prisma.reaction.findMany({
      where: { postId },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    // Group by type
    const grouped = REACTION_TYPES.reduce((acc, type) => {
      acc[type] = reactions.filter(r => r.type === type);
      return acc;
    }, {} as Record<string, typeof reactions>);

    const summary = REACTION_TYPES.reduce((acc, type) => {
      acc[type] = grouped[type].length;
      return acc;
    }, {} as Record<string, number>);

    res.json({ reactions, summary, total: reactions.length });
  } catch (error: any) {
    console.error('Get post reactions error:', error);
    res.status(500).json({ error: 'Failed to get reactions' });
  }
});

// Add reaction to comment
router.post('/comments/:commentId/reactions', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { type } = req.body;
    const userId = (req as any).userId;

    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const existing = await prisma.reaction.findUnique({
      where: { userId_commentId_type: { userId, commentId, type } }
    });

    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      return res.json({ removed: true, type });
    }

    const reaction = await prisma.reaction.create({
      data: { userId, commentId, type }
    });

    res.json(reaction);
  } catch (error: any) {
    console.error('Add comment reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Get reactions for comment
router.get('/comments/:commentId/reactions', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    const reactions = await prisma.reaction.findMany({
      where: { commentId },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    const summary = REACTION_TYPES.reduce((acc, type) => {
      acc[type] = reactions.filter(r => r.type === type).length;
      return acc;
    }, {} as Record<string, number>);

    res.json({ reactions, summary, total: reactions.length });
  } catch (error: any) {
    console.error('Get comment reactions error:', error);
    res.status(500).json({ error: 'Failed to get reactions' });
  }
});

// ==================== THREADED REPLIES ====================

// Add reply to comment
router.post('/comments/:commentId/replies', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = (req as any).userId;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const reply = await prisma.commentReply.create({
      data: {
        content: content.trim(),
        userId,
        commentId
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    // Notify comment author if not self-reply
    if (comment.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: comment.userId,
          type: 'COMMENT_REPLY',
          content: 'replied to your comment',
          link: `/posts/${comment.postId}`
        }
      });
    }

    res.status(201).json(reply);
  } catch (error: any) {
    console.error('Add reply error:', error);
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

// Get replies for comment
router.get('/comments/:commentId/replies', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    const replies = await prisma.commentReply.findMany({
      where: { commentId },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(replies);
  } catch (error: any) {
    console.error('Get replies error:', error);
    res.status(500).json({ error: 'Failed to get replies' });
  }
});

// Edit reply
router.put('/replies/:replyId', authenticateToken, async (req, res) => {
  try {
    const { replyId } = req.params;
    const { content } = req.body;
    const userId = (req as any).userId;

    const reply = await prisma.commentReply.findUnique({ where: { id: replyId } });

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    if (reply.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Save edit history
    const editHistory = (reply.editHistory as any[]) || [];
    editHistory.push({ content: reply.content, editedAt: new Date().toISOString() });

    const updated = await prisma.commentReply.update({
      where: { id: replyId },
      data: { content: content.trim(), editHistory },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Edit reply error:', error);
    res.status(500).json({ error: 'Failed to edit reply' });
  }
});

// Delete reply
router.delete('/replies/:replyId', authenticateToken, async (req, res) => {
  try {
    const { replyId } = req.params;
    const userId = (req as any).userId;

    const reply = await prisma.commentReply.findUnique({ where: { id: replyId } });

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    if (reply.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.commentReply.delete({ where: { id: replyId } });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete reply error:', error);
    res.status(500).json({ error: 'Failed to delete reply' });
  }
});

// ==================== EDIT COMMENTS ====================

// Edit comment with history
router.put('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = (req as any).userId;

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Save edit history
    const editHistory = (comment.editHistory as any[]) || [];
    editHistory.push({ content: comment.content, editedAt: new Date().toISOString() });

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { content: content.trim(), editHistory },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Edit comment error:', error);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

// Get comment edit history
router.get('/comments/:commentId/history', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { editHistory: true, content: true, updatedAt: true }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({
      current: { content: comment.content, editedAt: comment.updatedAt },
      history: comment.editHistory || []
    });
  } catch (error: any) {
    console.error('Get comment history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ==================== PINNED COMMENTS ====================

// Pin a comment
router.post('/posts/:postId/pin-comment', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { commentId } = req.body;
    const userId = (req as any).userId;

    // Verify post ownership
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: 'Only post author can pin comments' });
    }

    // Verify comment exists and belongs to post
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });

    if (!comment || comment.postId !== postId) {
      return res.status(404).json({ error: 'Comment not found on this post' });
    }

    // Remove any existing pinned comment for this post
    await prisma.pinnedComment.deleteMany({ where: { postId } });

    // Pin the new comment
    const pinned = await prisma.pinnedComment.create({
      data: { postId, commentId, pinnedBy: userId },
      include: {
        comment: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
            }
          }
        }
      }
    });

    res.json(pinned);
  } catch (error: any) {
    console.error('Pin comment error:', error);
    res.status(500).json({ error: 'Failed to pin comment' });
  }
});

// Unpin comment
router.delete('/posts/:postId/pin-comment', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).userId;

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: 'Only post author can unpin comments' });
    }

    await prisma.pinnedComment.deleteMany({ where: { postId } });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Unpin comment error:', error);
    res.status(500).json({ error: 'Failed to unpin comment' });
  }
});

// ==================== HASHTAGS ====================

// Parse and create hashtags from post content
export async function parseAndCreateHashtags(content: string, postId: string) {
  const hashtagRegex = /#(\w+)/g;
  const matches = content.match(hashtagRegex);

  if (!matches) return [];

  const tags = [...new Set(matches.map(m => m.substring(1).toLowerCase()))];

  for (const tag of tags) {
    // Create or get hashtag
    let hashtag = await prisma.hashtag.findUnique({ where: { tag } });

    if (!hashtag) {
      hashtag = await prisma.hashtag.create({ data: { tag } });
    }

    // Link to post
    await prisma.postHashtag.upsert({
      where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
      update: {},
      create: { postId, hashtagId: hashtag.id }
    });

    // Update post count
    const count = await prisma.postHashtag.count({ where: { hashtagId: hashtag.id } });
    await prisma.hashtag.update({ where: { id: hashtag.id }, data: { postCount: count } });
  }

  return tags;
}

// Get trending hashtags
router.get('/hashtags/trending', authenticateToken, async (req, res) => {
  try {
    const hashtags = await prisma.hashtag.findMany({
      orderBy: { postCount: 'desc' },
      take: 20
    });

    res.json(hashtags);
  } catch (error: any) {
    console.error('Get trending hashtags error:', error);
    res.status(500).json({ error: 'Failed to get hashtags' });
  }
});

// Search hashtags
router.get('/hashtags/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || String(q).length < 1) {
      return res.json([]);
    }

    const hashtags = await prisma.hashtag.findMany({
      where: { tag: { contains: String(q).toLowerCase(), mode: 'insensitive' } },
      orderBy: { postCount: 'desc' },
      take: 10
    });

    res.json(hashtags);
  } catch (error: any) {
    console.error('Search hashtags error:', error);
    res.status(500).json({ error: 'Failed to search hashtags' });
  }
});

// Get posts by hashtag
router.get('/hashtags/:tag/posts', authenticateToken, async (req, res) => {
  try {
    const { tag } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const hashtag = await prisma.hashtag.findUnique({ where: { tag: tag.toLowerCase() } });

    if (!hashtag) {
      return res.json({ posts: [], total: 0 });
    }

    const [posts, total] = await Promise.all([
      prisma.postHashtag.findMany({
        where: { hashtagId: hashtag.id },
        include: {
          post: {
            include: {
              user: {
                select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
              },
              _count: { select: { comments: true, reactions: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.postHashtag.count({ where: { hashtagId: hashtag.id } })
    ]);

    res.json({
      hashtag,
      posts: posts.map(p => p.post),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error: any) {
    console.error('Get hashtag posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// ==================== RICH MEDIA COMMENTS ====================

// Add comment with image
router.post('/posts/:postId/comments', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, imageUrl } = req.body;
    const userId = (req as any).userId;

    if (!content?.trim() && !imageUrl) {
      return res.status(400).json({ error: 'Content or image is required' });
    }

    const comment = await prisma.comment.create({
      data: {
        postId,
        userId,
        content: content?.trim() || '',
        imageUrl
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    // Notify post author
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (post && post.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          type: 'COMMENT',
          content: 'commented on your post',
          link: `/posts/${postId}`
        }
      });
    }

    res.status(201).json(comment);
  } catch (error: any) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
