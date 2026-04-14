import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// GET /api/creators/following/:userId - Get who a user follows
router.get('/following/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = (req as any).userId;

    const following = await prisma.creatorFollow.findMany({
      where: { followerId: userId },
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            creatorBio: true,
            creatorSpecialties: true,
            creatorVerified: true,
            creatorStats: {
              select: {
                followerCount: true,
                totalViews: true,
              },
            },
            _count: {
              select: { creatorContent: { where: { status: 'PUBLISHED' } } },
            },
          },
        },
      },
    });

    const total = await prisma.creatorFollow.count({
      where: { followerId: userId },
    });

    let creators = following.map((f: any) => ({
      ...f.creator,
      isFollowing: currentUserId === userId ? true : false,
    }));

    if (currentUserId && currentUserId !== userId) {
      const creatorIds = following.map((f: any) => f.creatorId);
      const myFollows = await prisma.creatorFollow.findMany({
        where: {
          followerId: currentUserId,
          creatorId: { in: creatorIds },
        },
        select: { creatorId: true },
      });
      const myFollowingIds = new Set(myFollows.map((f: any) => f.creatorId));

      creators = following.map((f: any) => ({
        ...f.creator,
        isFollowing: myFollowingIds.has(f.creator.id),
      }));
    }

    res.json({
      creators,
      total,
      hasMore: skip + following.length < total,
      page,
    });
  } catch (error: any) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// GET /api/creators/:creatorId/followers - Get creator's followers
router.get('/:creatorId/followers', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const followers = await prisma.creatorFollow.findMany({
      where: { creatorId },
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            isCreator: true,
            creatorVerified: true,
          },
        },
      },
    });

    const total = await prisma.creatorFollow.count({
      where: { creatorId },
    });

    res.json({
      followers: followers.map((f: any) => f.follower),
      total,
      hasMore: skip + followers.length < total,
      page,
    });
  } catch (error: any) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// GET /api/creators/:creatorId/similar - Get similar creators
router.get('/:creatorId/similar', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const limit = parseInt(req.query.limit as string) || 6;
    const currentUserId = (req as any).userId;

    const original = await prisma.user.findUnique({
      where: { id: creatorId },
      select: {
        creatorSpecialties: true,
        location: true,
      },
    });

    if (!original) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const similarCreators = await prisma.user.findMany({
      where: {
        id: { not: creatorId },
        isCreator: true,
        OR: [
          { creatorSpecialties: { hasSome: original.creatorSpecialties || [] } },
        ],
      },
      take: limit,
      orderBy: [
        { creatorFeatured: 'desc' },
      ],
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        creatorBio: true,
        creatorSpecialties: true,
        creatorVerified: true,
        creatorFeatured: true,
        creatorStats: {
          select: {
            followerCount: true,
            totalViews: true,
          },
        },
        _count: {
          select: { creatorContent: { where: { status: 'PUBLISHED' } } },
        },
      },
    });

    if (currentUserId) {
      const creatorIds = similarCreators.map((c: any) => c.id);
      const follows = await prisma.creatorFollow.findMany({
        where: {
          followerId: currentUserId,
          creatorId: { in: creatorIds },
        },
        select: { creatorId: true },
      });
      const followingIds = new Set(follows.map((f: any) => f.creatorId));

      return res.json(
        similarCreators.map((c: any) => ({
          ...c,
          isFollowing: followingIds.has(c.id),
        }))
      );
    }

    res.json(similarCreators);
  } catch (error: any) {
    console.error('Error fetching similar creators:', error);
    res.status(500).json({ error: 'Failed to fetch similar creators' });
  }
});

// GET /api/creators/content/:contentId/related - Get related content
router.get('/content/:contentId/related', async (req, res) => {
  try {
    const { contentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 6;

    const original = await prisma.creatorContent.findUnique({
      where: { id: contentId },
      select: {
        creatorId: true,
        category: true,
        tags: true,
        campgroundId: true,
        contentType: true,
      },
    });

    if (!original) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const relatedContent = await prisma.creatorContent.findMany({
      where: {
        id: { not: contentId },
        status: 'PUBLISHED',
        OR: [
          { category: original.category },
          { campgroundId: original.campgroundId },
          { tags: { hasSome: original.tags } },
          { creatorId: original.creatorId },
        ],
      },
      take: limit,
      orderBy: [
        { likeCount: 'desc' },
        { viewCount: 'desc' },
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
          },
        },
        campground: {
          select: { id: true, name: true, state: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    res.json(relatedContent);
  } catch (error: any) {
    console.error('Error fetching related content:', error);
    res.status(500).json({ error: 'Failed to fetch related content' });
  }
});

export default router;
