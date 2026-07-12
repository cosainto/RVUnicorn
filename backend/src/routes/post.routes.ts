import { Router, Request, Response } from 'express';
import { parseMentions } from './mention.routes';
import { parseAndCreateHashtags } from './social.routes';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// Get all posts
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { userId, limit = '20', offset = '0' } = req.query;
    const currentUserId = (req as any).userId;

    const where: any = {};
    
    if (userId) {
      where.userId = userId as string;
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        },
        likes: currentUserId ? {
          where: { userId: currentUserId }
        } : false
      }
    });

    const formattedPosts = posts.map((post: any) => ({
      ...post,
      isLiked: currentUserId ? post.likes && (post.likes as any[]).length > 0 : false,
      likes: undefined
    }));

    res.json(formattedPosts);
  } catch (error: any) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// Get single post
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = (req as any).userId;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        },
        comments: {
          orderBy: { createdAt: 'asc' },
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
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        },
        likes: currentUserId ? {
          where: { userId: currentUserId }
        } : false
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const formattedPost = {
      ...post,
      isLiked: currentUserId ? post.likes && (post.likes as any[]).length > 0 : false,
      likes: undefined
    };

    res.json(formattedPost);
  } catch (error: any) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

// Get posts for user's feed (from friends)
router.get('/feed/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { limit = '20', offset = '0' } = req.query;

    // Get friend IDs
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId, status: 'accepted' },
          { friendId: userId, status: 'accepted' }
        ]
      }
    });

    const friendIds = friendships.map((f: any) => 
      f.userId === userId ? f.friendId : f.userId
    );

    // Get posts from friends and self
    const posts = await prisma.post.findMany({
      where: {
        userId: { in: [...friendIds, userId] }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        },
        likes: {
          where: { userId }
        }
      }
    });

    const formattedPosts = posts.map((post: any) => ({
      ...post,
      isLiked: post.likes && post.likes.length > 0,
      likes: undefined
    }));

    res.json(formattedPosts);
  } catch (error: any) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Failed to get feed' });
  }
});

// Create post
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { content, imageUrl } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const post = await prisma.post.create({
      data: {
        userId,
        content,
        imageUrl: imageUrl || null
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      }
    });

    // Parse mentions from content
    await parseMentions(content, userId, post.id);

    // Parse hashtags from content
    await parseAndCreateHashtags(content, post.id);

    res.status(201).json({ ...post, isLiked: false });
  } catch (error: any) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update post
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { content, imageUrl } = req.body;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        content: content || post.content,
        imageUrl: imageUrl !== undefined ? imageUrl : post.imageUrl
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      }
    });

    res.json(updatedPost);
  } catch (error: any) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.post.delete({ where: { id } });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Like/unlike post
router.post('/:id/like', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const existing = await prisma.like.findFirst({
      where: { postId: id, userId }
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      res.json({ liked: false });
    } else {
      await prisma.like.create({
        data: { postId: id, userId }
      });

      // Create notification for post owner (if not self-like)
      const post = await prisma.post.findUnique({
        where: { id },
        include: { user: { select: { id: true } } }
      });
      if (post && post.userId !== userId) {
        const liker = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true }
        });
        await prisma.notification.create({
          data: {
            userId: post.userId,
            type: "POST_LIKE",
            content: (liker?.firstName || "") + " " + (liker?.lastName || "") + " liked your post",
            link: "/post/" + id
          }
        });
      }

      res.json({ liked: true });
    }
  } catch (error: any) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// Add comment to post
router.post('/:id/comments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { content, imageUrl } = req.body;

    if (!content && !imageUrl) {
      return res.status(400).json({ error: 'Content or image is required' });
    }

    // First check if the post exists
    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post) {
      console.error('Post not found for comment:', id);
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content || '',
        imageUrl: imageUrl || null,
        postId: id,
        userId
      },
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
      }
    });

    // Create notification for post owner (if not self-comment)
    if (post.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          type: "POST_COMMENT",
          content: comment.user.firstName + " " + comment.user.lastName + " commented on your post",
          link: "/post/" + id
        }
      });
    }

    res.status(201).json(comment);
  } catch (error: any) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete comment
router.delete('/comments/:commentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).userId;

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.comment.delete({ where: { id: commentId } });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
