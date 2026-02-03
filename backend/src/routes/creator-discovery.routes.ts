import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const CONTENT_CATEGORIES = [
  { id: 'GEAR_REVIEWS', label: 'Gear Reviews', emoji: '\u{1F527}' },
  { id: 'CAMPGROUND_REVIEWS', label: 'Campground Reviews', emoji: '\u{26FA}' },
  { id: 'TRAVEL_DAYS', label: 'Travel Days', emoji: '\u{1F6E3}\u{FE0F}' },
  { id: 'TIPS_HACKS', label: 'Tips & Hacks', emoji: '\u{1F4A1}' },
  { id: 'FULL_TIME_RV', label: 'Full-Time RV Life', emoji: '\u{1F3E0}' },
  { id: 'WEEKEND_TRIPS', label: 'Weekend Trips', emoji: '\u{1F3D5}\u{FE0F}' },
  { id: 'COOKING', label: 'Camp Cooking', emoji: '\u{1F373}' },
  { id: 'MAINTENANCE', label: 'RV Maintenance', emoji: '\u{1F529}' },
  { id: 'BOONDOCKING', label: 'Boondocking', emoji: '\u{1F332}' },
  { id: 'FAMILY', label: 'Family Camping', emoji: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}' },
  { id: 'PETS', label: 'RVing with Pets', emoji: '\u{1F415}' },
  { id: 'SOLAR_TECH', label: 'Solar & Tech', emoji: '\u{2600}\u{FE0F}' },
];

// GET /api/creators/discovery - Get discovery feed (randomized + personalized)
router.get('/discovery', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { limit = '20', interests } = req.query;
    const take = parseInt(limit as string);

    // Get user's content interests if logged in
    let userInterests: string[] = [];
    if (interests) {
      userInterests = (interests as string).split(',');
    } else if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { contentInterests: true },
      });
      userInterests = user?.contentInterests || [];
    }

    // Get IDs of creators the user already follows
    let followedIds: string[] = [];
    if (userId) {
      const follows = await prisma.creatorFollow.findMany({
        where: { followerId: userId },
        select: { creatorId: true },
      });
      followedIds = follows.map(f => f.creatorId);
    }

    let creators;

    if (userInterests.length > 0) {
      // PERSONALIZED: Find creators who make content in user's interest categories
      // and who the user doesn't already follow
      const relevantContent = await prisma.creatorContent.findMany({
        where: {
          status: 'PUBLISHED',
          category: { in: userInterests },
          ...(followedIds.length > 0 ? { creatorId: { notIn: [...followedIds, ...(userId ? [userId] : [])] } } : {}),
          ...(userId && followedIds.length === 0 ? { creatorId: { not: userId } } : {}),
        },
        select: { creatorId: true },
        distinct: ['creatorId'],
      });

      const creatorIds = relevantContent.map(c => c.creatorId);

      creators = await prisma.user.findMany({
        where: {
          id: { in: creatorIds },
          isCreator: true,
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
          creatorBio: true,
          creatorVerified: true,
          creatorHandle: true,
          creatorDisplayName: true,
          creatorSpecialties: true,
          creatorStats: {
            select: {
              totalViews: true,
              totalLikes: true,
              followerCount: true,
              viewsThisWeek: true,
              followersThisWeek: true,
            },
          },
          _count: {
            select: {
              creatorContent: { where: { status: 'PUBLISHED' } },
            },
          },
          creatorContent: {
            where: { status: 'PUBLISHED' },
            orderBy: { publishedAt: 'desc' },
            take: 1,
            select: { publishedAt: true, category: true },
          },
        },
      });
    } else {
      // NO INTERESTS: Get all creators user doesn't follow, randomized
      const excludeIds = [...followedIds, ...(userId ? [userId] : [])];
      creators = await prisma.user.findMany({
        where: {
          isCreator: true,
          ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
          creatorBio: true,
          creatorVerified: true,
          creatorHandle: true,
          creatorDisplayName: true,
          creatorSpecialties: true,
          creatorStats: {
            select: {
              totalViews: true,
              totalLikes: true,
              followerCount: true,
              viewsThisWeek: true,
              followersThisWeek: true,
            },
          },
          _count: {
            select: {
              creatorContent: { where: { status: 'PUBLISHED' } },
            },
          },
          creatorContent: {
            where: { status: 'PUBLISHED' },
            orderBy: { publishedAt: 'desc' },
            take: 1,
            select: { publishedAt: true, category: true },
          },
        },
      });
    }

    // Shuffle with bias toward newer/less-followed creators (discovery = finding hidden gems)
    const shuffled = creators
      .map(c => {
        const followerCount = c.creatorStats?.followerCount || 0;
        const contentCount = c._count?.creatorContent || 0;
        // Higher score for low-follower creators who actually have content
        const discoveryScore = contentCount > 0
          ? Math.random() * (1 + 1 / Math.max(followerCount, 1) * 100)
          : Math.random() * 0.1;
        return { ...c, discoveryScore };
      })
      .sort((a, b) => b.discoveryScore - a.discoveryScore)
      .slice(0, take);

    // Enrich with heat level / inactive status
    const now = new Date();
    const fiftyDaysAgo = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);

    const enriched = shuffled.map(creator => {
      const lastPost = creator.creatorContent[0]?.publishedAt;
      const isInactive = !lastPost || new Date(lastPost) < fiftyDaysAgo;

      const viewsThisWeek = creator.creatorStats?.viewsThisWeek || 0;
      const followersThisWeek = creator.creatorStats?.followersThisWeek || 0;
      const totalViews = creator.creatorStats?.totalViews || 1;
      const engagementRate = (viewsThisWeek + followersThisWeek * 10) / Math.max(totalViews, 1) * 100;

      let heatLevel = 0;
      if (engagementRate > 5) heatLevel = 1;
      if (engagementRate > 15) heatLevel = 2;
      if (engagementRate > 30) heatLevel = 3;
      if (engagementRate > 50) heatLevel = 4;
      if (engagementRate > 75) heatLevel = 5;
      if (engagementRate > 100) heatLevel = 6;
      if (engagementRate > 150) heatLevel = 7;

      return {
        ...creator,
        lastPostDate: lastPost,
        isInactive,
        heatLevel,
        isDiscovery: true,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching discovery:', error);
    res.status(500).json({ error: 'Failed to fetch discovery creators' });
  }
});

// GET /api/creators/discovery/content - Get discovery content feed
router.get('/discovery/content', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { limit = '10', interests } = req.query;
    const take = parseInt(limit as string);

    let userInterests: string[] = [];
    if (interests) {
      userInterests = (interests as string).split(',');
    } else if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { contentInterests: true },
      });
      userInterests = user?.contentInterests || [];
    }

    // Get followed creator IDs
    let followedIds: string[] = [];
    if (userId) {
      const follows = await prisma.creatorFollow.findMany({
        where: { followerId: userId },
        select: { creatorId: true },
      });
      followedIds = follows.map(f => f.creatorId);
    }

    const excludeIds = [...followedIds, ...(userId ? [userId] : [])];

    // Find content from creators the user DOESN'T follow
    const content = await prisma.creatorContent.findMany({
      where: {
        status: 'PUBLISHED',
        ...(excludeIds.length > 0 ? { creatorId: { notIn: excludeIds } } : {}),
        ...(userInterests.length > 0 ? { category: { in: userInterests } } : {}),
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            creatorVerified: true,
            creatorHandle: true,
            creatorDisplayName: true,
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
        _count: {
          select: {
            likes: true,
            comments: true,
            saves: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: take * 3, // Get extra to shuffle from
    });

    // Shuffle with bias toward less-viewed content (surface hidden gems)
    const shuffled = content
      .map(c => ({
        ...c,
        discoveryScore: Math.random() * (1 + 1 / Math.max(c.viewCount, 1) * 50),
      }))
      .sort((a, b) => b.discoveryScore - a.discoveryScore)
      .slice(0, take);

    // Check likes/saves for current user
    if (userId && shuffled.length > 0) {
      const contentIds = shuffled.map(c => c.id);
      const [likes, saves] = await Promise.all([
        prisma.creatorContentLike.findMany({
          where: { userId, contentId: { in: contentIds } },
          select: { contentId: true },
        }),
        prisma.creatorContentSave.findMany({
          where: { userId, contentId: { in: contentIds } },
          select: { contentId: true },
        }),
      ]);

      const likedSet = new Set(likes.map(l => l.contentId));
      const savedSet = new Set(saves.map(s => s.contentId));

      const enriched = shuffled.map(c => ({
        ...c,
        isLiked: likedSet.has(c.id),
        isSaved: savedSet.has(c.id),
        isDiscovery: true,
      }));

      return res.json(enriched);
    }

    res.json(shuffled.map(c => ({ ...c, isDiscovery: true })));
  } catch (error) {
    console.error('Error fetching discovery content:', error);
    res.status(500).json({ error: 'Failed to fetch discovery content' });
  }
});

// PUT /api/creators/discovery/interests - Save user's content interests
router.put('/discovery/interests', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { interests } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { contentInterests: interests || [] },
      select: { contentInterests: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error saving interests:', error);
    res.status(500).json({ error: 'Failed to save interests' });
  }
});

// GET /api/creators/discovery/interests - Get user's content interests
router.get('/discovery/interests', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { contentInterests: true },
    });

    res.json({ interests: user?.contentInterests || [] });
  } catch (error) {
    console.error('Error fetching interests:', error);
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});

// GET /api/creators/discovery/categories - Get available categories
router.get('/discovery/categories', async (_req, res) => {
  res.json(CONTENT_CATEGORIES);
});

export default router;
