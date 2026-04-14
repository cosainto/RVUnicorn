import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// GET /api/basecamp/creator-feed - Get videos from followed creators
router.get('/creator-feed', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const contentType = req.query.type as string;

    // Get creators this user follows
    const followedCreators = await prisma.creatorFollow.findMany({
      where: { followerId: userId },
      select: { creatorId: true },
    });

    const followedCreatorIds = followedCreators.map((f: any) => f.creatorId);

    if (followedCreatorIds.length === 0) {
      // Return trending content instead
      const trendingContent = await prisma.creatorContent.findMany({
        where: {
          status: 'PUBLISHED',
          ...(contentType ? { contentType } : { contentType: { in: ['VIDEO', 'SHORT'] } }),
        },
        take: limit,
        skip,
        orderBy: [
          { viewCount: 'desc' },
          { likeCount: 'desc' },
          { publishedAt: 'desc' },
        ],
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
              creatorVerified: true,
              creatorSpecialties: true,
            },
          },
          campground: {
            select: {
              id: true,
              name: true,
              state: true,
            },
          },
          photos: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              saves: true,
            },
          },
        },
      });

      const contentIds = trendingContent.map((c: any) => c.id);
      const [likes, saves] = await Promise.all([
        prisma.creatorContentLike.findMany({
          where: { userId, contentId: { in: contentIds } },
          select: { contentId: true },
        }),
        prisma.creatorSave.findMany({
          where: { userId, contentId: { in: contentIds } },
          select: { contentId: true },
        }),
      ]);

      const likedIds = new Set(likes.map((l: any) => l.contentId));
      const savedIds = new Set(saves.map((s: any) => s.contentId));

      return res.json({
        content: trendingContent.map((c: any) => ({
          ...c,
          isLiked: likedIds.has(c.id),
          isSaved: savedIds.has(c.id),
        })),
        source: 'trending',
        hasMore: trendingContent.length === limit,
        page,
      });
    }

    // Get content from followed creators
    const content = await prisma.creatorContent.findMany({
      where: {
        creatorId: { in: followedCreatorIds },
        status: 'PUBLISHED',
        ...(contentType ? { contentType } : { contentType: { in: ['VIDEO', 'SHORT'] } }),
      },
      take: limit,
      skip,
      orderBy: { publishedAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            creatorVerified: true,
            creatorSpecialties: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            state: true,
          },
        },
        photos: {
          take: 1,
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            saves: true,
          },
        },
      },
    });

    const contentIds = content.map((c: any) => c.id);
    const [likes, saves] = await Promise.all([
      prisma.creatorContentLike.findMany({
        where: { userId, contentId: { in: contentIds } },
        select: { contentId: true },
      }),
      prisma.creatorSave.findMany({
        where: { userId, contentId: { in: contentIds } },
        select: { contentId: true },
      }),
    ]);

    const likedIds = new Set(likes.map((l: any) => l.contentId));
    const savedIds = new Set(saves.map((s: any) => s.contentId));

    res.json({
      content: content.map((c: any) => ({
        ...c,
        isLiked: likedIds.has(c.id),
        isSaved: savedIds.has(c.id),
      })),
      source: 'following',
      hasMore: content.length === limit,
      page,
    });
  } catch (error: any) {
    console.error('Get creator feed error:', error);
    res.status(500).json({ error: 'Failed to get creator feed' });
  }
});

export default router;
