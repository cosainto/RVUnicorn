import { Router, Request, Response } from 'express';
import { logThreadCreated, logThreadPost } from '../services/activity.service';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

const createSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50) + '-' + Date.now().toString(36);
};

// Helper to create activity
const createActivity = async (data: {
  userId: string;
  type: string;
  threadId?: string;
  eventId?: string;
  recipeId?: string;
  campgroundId?: string;
  targetUserId?: string;
  title?: string;
  content?: string;
  isPublic?: boolean;
}) => {
  try {
    console.log('Creating activity:', data);
    const activity = await prisma.activity.create({
      data: {
        userId: data.userId,
        type: data.type,
        threadId: data.threadId || null,
        eventId: data.eventId || null,
        recipeId: data.recipeId || null,
        campgroundId: data.campgroundId || null,
        targetUserId: data.targetUserId || null,
        title: data.title || null,
        content: data.content || null,
        isPublic: data.isPublic !== false
      }
    });
    console.log('Activity created:', activity.id);
  } catch (error) {
    console.error('Create activity error:', error);
  }
};

router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { campgroundId, tag, search, sort = 'recent' } = req.query;
    const userId = (req as any).userId;

    const where: any = {};
    
    if (campgroundId) {
      where.campgroundId = campgroundId as string;
    }
    
    if (tag) {
      where.tags = {
        some: {
          tag: {
            slug: tag as string
          }
        }
      };
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { content: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { viewCount: 'desc' };
    } else if (sort === 'active') {
      orderBy = { updatedAt: 'desc' };
    }

    const threads = await prisma.thread.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        orderBy
      ],
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
        },
        campground: {
          select: { id: true, name: true, location: true, state: true }
        },
        tags: {
          include: {
            tag: true
          }
        },
        _count: {
          select: { posts: true, favorites: true }
        },
        favorites: userId ? {
          where: { userId }
        } : false
      },
      take: 50
    });

    const formattedThreads = threads.map(t => ({
      ...t,
      isFavorited: userId ? t.favorites && t.favorites.length > 0 : false,
      favorites: undefined
    }));

    res.json(formattedThreads);
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ error: 'Failed to get threads' });
  }
});

// COMPREHENSIVE MY FEED - threads from:
// 1. Your own threads
// 2. Friends' threads
// 3. Creators you follow
// 4. Campgrounds you follow
// 5. Campgrounds on upcoming trips
// 6. Threads where you're mentioned
// Excluding ignored threads
router.get('/feed', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get ignored thread IDs
    let ignoredThreadIds: string[] = [];
    try {
      const ignored = await prisma.threadIgnore.findMany({
        where: { userId },
        select: { threadId: true }
      });
      ignoredThreadIds = ignored.map(i => i.threadId);
    } catch (e) {
      // ThreadIgnore model might not exist yet
      console.log('ThreadIgnore model not found, skipping ignore filter');
    }

    // 1. Get friend IDs
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { initiatorId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' }
        ]
      },
      select: { initiatorId: true, receiverId: true }
    });
    const friendIds = friendships.map(f => 
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    // 2. Get creator IDs you follow
    let followedCreatorIds: string[] = [];
    try {
      const creatorFollows = await prisma.creatorFollow.findMany({
        where: { followerId: userId },
        select: { creatorId: true }
      });
      followedCreatorIds = creatorFollows.map(f => f.creatorId);
    } catch (e) {
      console.log('CreatorFollow not found');
    }

    // 3. Get campground IDs you follow
    let followedCampgroundIds: string[] = [];
    try {
      const campgroundFollows = await prisma.campgroundFollow.findMany({
        where: { userId },
        select: { campgroundId: true }
      });
      followedCampgroundIds = campgroundFollows.map(f => f.campgroundId);
    } catch (e) {
      console.log('CampgroundFollow not found');
    }

    // 4. Get campground IDs from upcoming trips
    let tripCampgroundIds: string[] = [];
    try {
      // Check SavedTrip for campgrounds
      const savedTrips = await prisma.savedTrip.findMany({
        where: {
          userId,
          OR: [
            { startDate: { gte: new Date() } },
            { endDate: { gte: new Date() } }
          ]
        },
        select: { campgroundId: true }
      });
      tripCampgroundIds = savedTrips
        .filter(t => t.campgroundId)
        .map(t => t.campgroundId as string);

      // Also check Trip model
      const trips = await prisma.trip.findMany({
        where: {
          organizerId: userId,
          startDate: { gte: new Date() }
        },
        select: { campgroundId: true }
      });
      tripCampgroundIds = [
        ...tripCampgroundIds,
        ...trips.filter(t => t.campgroundId).map(t => t.campgroundId as string)
      ];
    } catch (e) {
      console.log('Trip models not found');
    }

    // 5. Get thread IDs where user is mentioned
    let mentionedThreadIds: string[] = [];
    try {
      const mentions = await prisma.mention.findMany({
        where: { 
          userId,
          threadId: { not: null }
        },
        select: { threadId: true }
      });
      mentionedThreadIds = mentions
        .filter(m => m.threadId)
        .map(m => m.threadId as string);
    } catch (e) {
      console.log('Mention model not found');
    }

    // Combine all campground IDs
    const allCampgroundIds = [...new Set([...followedCampgroundIds, ...tripCampgroundIds])];

    // Combine all user IDs whose threads we want to see
    const allUserIds = [...new Set([userId, ...friendIds, ...followedCreatorIds])];

    // Build the query
    const threads = await prisma.thread.findMany({
      where: {
        AND: [
          // Exclude ignored threads
          ignoredThreadIds.length > 0 ? { id: { notIn: ignoredThreadIds } } : {},
          // Include threads matching any of our criteria
          {
            OR: [
              // Threads by me, friends, or followed creators
              { authorId: { in: allUserIds } },
              // Threads linked to followed/trip campgrounds
              allCampgroundIds.length > 0 ? { campgroundId: { in: allCampgroundIds } } : {},
              // Threads where I'm mentioned
              mentionedThreadIds.length > 0 ? { id: { in: mentionedThreadIds } } : {}
            ].filter(condition => Object.keys(condition).length > 0)
          }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
        },
        campground: {
          select: { id: true, name: true, location: true, state: true }
        },
        tags: {
          include: { tag: true }
        },
        _count: {
          select: { posts: true, favorites: true }
        },
        favorites: {
          where: { userId }
        }
      }
    });

    // Format and add context about WHY each thread is in the feed
    const formattedThreads = threads.map(t => {
      let feedReason = 'community';
      
      if (t.authorId === userId) {
        feedReason = 'your_thread';
      } else if (friendIds.includes(t.authorId)) {
        feedReason = 'friend';
      } else if (followedCreatorIds.includes(t.authorId)) {
        feedReason = 'creator';
      } else if (t.campgroundId && followedCampgroundIds.includes(t.campgroundId)) {
        feedReason = 'followed_campground';
      } else if (t.campgroundId && tripCampgroundIds.includes(t.campgroundId)) {
        feedReason = 'upcoming_trip';
      } else if (mentionedThreadIds.includes(t.id)) {
        feedReason = 'mentioned';
      }

      return {
        ...t,
        isFavorited: t.favorites && t.favorites.length > 0,
        favorites: undefined,
        feedReason
      };
    });

    res.json(formattedThreads);
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Failed to get feed' });
  }
});

// Ignore a thread (hide from My Feed)
router.post('/:id/ignore', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Check if already ignored
    const existing = await prisma.threadIgnore.findUnique({
      where: { threadId_userId: { threadId: id, userId } }
    });

    if (existing) {
      // Un-ignore
      await prisma.threadIgnore.delete({
        where: { id: existing.id }
      });
      res.json({ ignored: false });
    } else {
      // Ignore
      await prisma.threadIgnore.create({
        data: { threadId: id, userId }
      });
      res.json({ ignored: true });
    }
  } catch (error: any) {
    // If ThreadIgnore model doesn't exist yet
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      return res.status(501).json({ error: 'Thread ignore feature not yet enabled. Please run database migrations.' });
    }
    console.error('Ignore thread error:', error);
    res.status(500).json({ error: 'Failed to ignore thread' });
  }
});

// Get user's ignored threads
router.get('/ignored', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const ignored = await prisma.threadIgnore.findMany({
      where: { userId },
      include: {
        thread: {
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
            },
            campground: {
              select: { id: true, name: true }
            },
            _count: {
              select: { posts: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(ignored.map(i => ({ ...i.thread, ignoredAt: i.createdAt })));
  } catch (error: any) {
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      return res.json([]); // Return empty if model doesn't exist
    }
    console.error('Get ignored threads error:', error);
    res.status(500).json({ error: 'Failed to get ignored threads' });
  }
});

router.get('/favorites', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const favorites = await prisma.threadFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        thread: {
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
            },
            campground: {
              select: { id: true, name: true, location: true, state: true }
            },
            tags: {
              include: { tag: true }
            },
            _count: {
              select: { posts: true, favorites: true }
            }
          }
        }
      }
    });

    res.json(favorites.map(f => ({ ...f.thread, isFavorited: true })));
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

router.get('/tags/all', async (req: Request, res: Response) => {
  try {
    const tags = await prisma.threadTag.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(tags);
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    await prisma.thread.update({
      where: { id },
      data: {
        viewCount: { increment: 1 } }
    });

    const thread = await prisma.thread.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
        },
        campground: {
          select: { id: true, name: true, location: true, state: true }
        },
        tags: {
          include: { tag: true }
        },
        _count: {
          select: { posts: true, favorites: true }
        },
        favorites: userId ? {
          where: { userId }
        } : false,
        posts: {
          where: { parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
            },
            _count: {
              select: { likes: true, replies: true }
            },
            likes: userId ? {
              where: { userId }
            } : false,
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
                },
                _count: {
                  select: { likes: true }
                },
                likes: userId ? {
                  where: { userId }
                } : false
              }
            }
          }
        }
      }
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const formattedThread = {
      ...thread,
      isFavorited: userId ? thread.favorites && thread.favorites.length > 0 : false,
      favorites: undefined,
      posts: thread.posts.map(p => ({
        ...p,
        isLiked: userId ? p.likes && p.likes.length > 0 : false,
        likes: undefined,
        replies: p.replies.map(r => ({
          ...r,
          isLiked: userId ? r.likes && r.likes.length > 0 : false,
          likes: undefined
        }))
      }))
    };

    res.json(formattedThread);
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { title, content, campgroundId, tagIds, imageUrl } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const slug = createSlug(title);

    const thread = await prisma.thread.create({
      data: {
        title,
        content,
        slug,
        authorId: userId,
        campgroundId: campgroundId || null,
        tags: tagIds?.length ? {
          create: tagIds.map((tagId: string) => ({
            tagId
          }))
        } : undefined
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
        },
        campground: {
          select: { id: true, name: true, location: true, state: true }
        },
        tags: {
          include: { tag: true }
        }
      }
    });

    // Create activity for thread creation
    await createActivity({
      userId,
      type: 'THREAD_CREATED',
      threadId: thread.id,
      title: thread.title,
      campgroundId: thread.campgroundId || undefined
    });

    res.status(201).json(thread);
  } catch (error) {
    console.error('Create thread error:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

router.post('/:id/posts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { content, parentId, imageUrl } = req.body;

    if (!content && !imageUrl) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const thread = await prisma.thread.findUnique({
      where: { id }
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.isLocked) {
      return res.status(403).json({ error: 'Thread is locked' });
    }

    const post = await prisma.threadPost.create({
      data: {
        imageUrl: imageUrl || null,
        content,
        threadId: id,
        authorId: userId,
        parentId: parentId || null
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true }
        },
        _count: {
          select: { likes: true, replies: true }
        }
      }
    });

    await prisma.thread.update({
      where: { id },
      data: {
        updatedAt: new Date() }
    });

    // Create activity for thread post
    await createActivity({
      userId,
      type: 'THREAD_POST',
      threadId: id,
      title: thread.title,
      content: content.substring(0, 100),
      campgroundId: thread.campgroundId || undefined
    });

    // Notify thread creator if someone else replied
    if (thread.authorId !== userId) {
      const replier = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true }
      });
      await prisma.notification.create({
        data: {
          userId: thread.authorId,
          type: "THREAD_REPLY",
          content: (replier?.firstName || "") + " " + (replier?.lastName || "") + " replied to your thread: " + thread.title,
          link: "/threads/" + id
        }
      });
    }

    // If replying to a specific post, notify that post author too
    if (parentId) {
      const parentPost = await prisma.threadPost.findUnique({
        where: { id: parentId },
        select: { authorId: true }
      });
      if (parentPost && parentPost.authorId !== userId && parentPost.authorId !== thread.authorId) {
        const replier = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true }
        });
        await prisma.notification.create({
          data: {
        userId: parentPost.authorId,
            type: "THREAD_REPLY",
            content: (replier?.firstName || "") + " " + (replier?.lastName || "") + " replied to your comment",
            link: "/threads/" + id
          }
        });
      }
    }

    res.status(201).json({ ...post, isLiked: false });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.post('/posts/:postId/like', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).userId;

    const existing = await prisma.threadPostLike.findUnique({
      where: { postId_userId: { postId, userId } }
    });

    if (existing) {
      await prisma.threadPostLike.delete({
        where: { id: existing.id }
      });
      res.json({ liked: false });
    } else {
      await prisma.threadPostLike.create({
        data: {
        postId, userId }
      });
      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

router.post('/:id/favorite', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const existing = await prisma.threadFavorite.findUnique({
      where: { threadId_userId: { threadId: id, userId } }
    });

    if (existing) {
      await prisma.threadFavorite.delete({
        where: { id: existing.id }
      });
      res.json({ favorited: false });
    } else {
      await prisma.threadFavorite.create({
        data: {
        threadId: id, userId }
      });
      res.json({ favorited: true });
    }
  } catch (error) {
    console.error('Favorite thread error:', error);
    res.status(500).json({ error: 'Failed to favorite thread' });
  }
});

router.post('/tags', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const tag = await prisma.threadTag.create({
      data: {
        name, slug, color: color || '#6B7280' }
    });

    res.status(201).json(tag);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Tag already exists' });
    }
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const thread = await prisma.thread.findUnique({
      where: { id }
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.thread.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete thread error:', error);
    res.status(500).json({ error: 'Failed to delete thread' });
  }
});

router.delete('/posts/:postId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).userId;

    const post = await prisma.threadPost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.threadPost.delete({ where: { id: postId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
