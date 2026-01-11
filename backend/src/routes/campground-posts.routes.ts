import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/campground-posts/my-feed - Get posts from followed campgrounds
router.get('/my-feed', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get campgrounds the user follows
    const follows = await prisma.campgroundFollow.findMany({
      where: { userId },
      select: { campgroundId: true }
    });

    const campgroundIds = follows.map(f => f.campgroundId);

    if (campgroundIds.length === 0) {
      return res.json({ posts: [], total: 0, page, totalPages: 0 });
    }

    // Get posts from followed campgrounds
    const [posts, total] = await Promise.all([
      prisma.campgroundPost.findMany({
        where: { campgroundId: { in: campgroundIds } },
        include: {
          campground: {
            select: { id: true, name: true, location: true, state: true }
          },
          author: {
            select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
          },
          likes: {
            select: { userId: true }
          },
          comments: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
              }
            },
            orderBy: { createdAt: 'asc' }
          },
          _count: {
            select: { likes: true, comments: true }
          }
        },
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.campgroundPost.count({
        where: { campgroundId: { in: campgroundIds } }
      })
    ]);

    // Add isLiked flag for current user
    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: post.likes.some(like => like.userId === userId)
    }));

    res.json({
      posts: postsWithLikeStatus,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get my feed error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// GET /api/campground-posts/campground/:campgroundId - Get posts for a specific campground
router.get('/campground/:campgroundId', async (req: AuthRequest, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.campgroundPost.findMany({
        where: { campgroundId },
        include: {
          campground: {
            select: { id: true, name: true, location: true, state: true }
          },
          author: {
            select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
          },
          likes: {
            select: { userId: true }
          },
          comments: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
              }
            },
            orderBy: { createdAt: 'asc' }
          },
          _count: {
            select: { likes: true, comments: true }
          }
        },
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.campgroundPost.count({ where: { campgroundId } })
    ]);

    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: userId ? post.likes.some(like => like.userId === userId) : false
    }));

    res.json({
      posts: postsWithLikeStatus,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get campground posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST /api/campground-posts - Create a new campground post (admin only)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { campgroundId, title, content, imageUrl } = req.body;

    // Check if user is admin of this campground
    const isAdmin = await prisma.campgroundAdmin.findUnique({
      where: {
        userId_campgroundId: { userId, campgroundId }
      }
    });

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only campground admins can create posts' });
    }

    const post = await prisma.campgroundPost.create({
      data: {
        campgroundId,
        authorId: userId,
        title,
        content,
        imageUrl
      },
      include: {
        campground: {
          select: { id: true, name: true, location: true, state: true }
        },
        author: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
        },
        _count: {
          select: { likes: true, comments: true }
        }
      }
    });

    res.status(201).json(post);
  } catch (error) {
    console.error('Create campground post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// PUT /api/campground-posts/:postId/like - Toggle like on a post
router.put('/:postId/like', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { postId } = req.params;

    const existingLike = await prisma.campgroundPostLike.findUnique({
      where: {
        postId_userId: { postId, userId }
      }
    });

    if (existingLike) {
      await prisma.campgroundPostLike.delete({
        where: { id: existingLike.id }
      });
      res.json({ liked: false });
    } else {
      await prisma.campgroundPostLike.create({
        data: { postId, userId }
      });
      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// POST /api/campground-posts/:postId/comments - Add a comment to a post
router.post('/:postId/comments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { postId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const comment = await prisma.campgroundPostComment.create({
      data: {
        postId,
        userId,
        content: content.trim()
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
        }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// DELETE /api/campground-posts/:postId - Delete a post (admin only)
router.delete('/:postId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { postId } = req.params;

    const post = await prisma.campgroundPost.findUnique({
      where: { id: postId },
      select: { campgroundId: true, authorId: true }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user is the author or an admin
    const isAdmin = await prisma.campgroundAdmin.findUnique({
      where: {
        userId_campgroundId: { userId, campgroundId: post.campgroundId }
      }
    });

    if (post.authorId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    await prisma.campgroundPost.delete({ where: { id: postId } });

    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
