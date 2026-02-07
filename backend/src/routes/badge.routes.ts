// badge.routes.ts
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';
import { 
  getUserBadges, 
  checkAllBadgesForUser, 
  getBadgeProgress,
  awardBadge
} from '../services/badge.service';

const router = Router();



// GET /api/badges - Get all available badges
router.get('/', async (req: Request, res: Response) => {
  try {
    const badges = await prisma.badge.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        _count: {
          select: { userBadges: true }
        }
      }
    });

    const badgesWithStats = badges.map(badge => ({
      ...badge,
      earnedByCount: badge._count.userBadges
    }));

    res.json(badgesWithStats);
  } catch (error) {
    console.error('Get all badges error:', error);
    res.status(500).json({ error: 'Failed to get badges' });
  }
});

// GET /api/badges/my - Get current user's badges
router.get('/my', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const badges = await getUserBadges(userId);
    res.json(badges);
  } catch (error) {
    console.error('Get my badges error:', error);
    res.status(500).json({ error: 'Failed to get badges' });
  }
});

// GET /api/badges/user/:userId - Get a user's badges
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const earnedBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' }
    });

    res.json({
      badges: earnedBadges.map(ub => ({
        ...ub.badge,
        earnedAt: ub.earnedAt
      })),
      count: earnedBadges.length
    });
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ error: 'Failed to get user badges' });
  }
});

// GET /api/badges/progress/:badgeSlug - Get progress toward a badge
router.get('/progress/:badgeSlug', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { badgeSlug } = req.params;

    const progress = await getBadgeProgress(userId, badgeSlug);
    res.json(progress);
  } catch (error) {
    console.error('Get badge progress error:', error);
    res.status(500).json({ error: 'Failed to get badge progress' });
  }
});

// POST /api/badges/check - Manually check and award all badges
router.post('/check', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const awarded = await checkAllBadgesForUser(userId);

    res.json({
      message: awarded.length > 0 ? 'New badges earned!' : 'No new badges earned',
      newBadges: awarded.filter(r => r.awarded).map(r => r.badge)
    });
  } catch (error) {
    console.error('Check badges error:', error);
    res.status(500).json({ error: 'Failed to check badges' });
  }
});

// GET /api/badges/leaderboard - Get users with most badges
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await prisma.userBadge.groupBy({
      by: ['userId'],
      _count: { badgeId: true },
      orderBy: { _count: { badgeId: 'desc' } },
      take: parseInt(limit as string)
    });

    const userIds = leaderboard.map(l => l.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true
      }
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    const results = leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: userMap.get(entry.userId),
      badgeCount: entry._count.badgeId
    }));

    res.json(results);
  } catch (error) {
    console.error('Get badge leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// GET /api/badges/:badgeSlug - Get single badge details
router.get('/:badgeSlug', async (req: Request, res: Response) => {
  try {
    const { badgeSlug } = req.params;

    const badge = await prisma.badge.findUnique({
      where: { slug: badgeSlug },
      include: {
        userBadges: {
          take: 10,
          orderBy: { earnedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true
              }
            }
          }
        },
        _count: {
          select: { userBadges: true }
        }
      }
    });

    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    res.json({
      ...badge,
      earnedByCount: badge._count.userBadges,
      recentEarners: badge.userBadges.map(ub => ({
        user: ub.user,
        earnedAt: ub.earnedAt
      }))
    });
  } catch (error) {
    console.error('Get badge details error:', error);
    res.status(500).json({ error: 'Failed to get badge details' });
  }
});

// POST /api/badges/seed - Seed default badges (run once)
router.post('/seed', async (req, res) => {
  try {
    const badges = [
      { slug: 'rvunicorn-member', name: 'RVUnicorn Member', description: 'Joined the RVUnicorn community', imageUrl: '/images/Logo_RVUnicorn.png', category: 'GENERAL', requirement: 'Create an account', triggerType: 'ACCOUNT_CREATED', triggerValue: 1, sortOrder: 1 },
      { slug: 'welcome-to-club', name: 'Welcome to the Club', description: 'Joined your first RV group', imageUrl: '/images/Welcome_to_the_Club.png', category: 'SOCIAL', requirement: 'Join a group', triggerType: 'GROUP_JOINED', triggerValue: 1, sortOrder: 10 },
      { slug: 'weekend-warrior', name: 'Weekend Warrior', description: 'Spent 10 weekends at campgrounds', imageUrl: '/images/Weekendwarriorbadge.png', category: 'CAMPING', requirement: '10 weekend stays', triggerType: 'WEEKEND_STAYS', triggerValue: 10, sortOrder: 20 },
      { slug: 'true-camper', name: 'True Camper', description: 'Camped for over 90 days total', imageUrl: '/images/TruecamperBadge.png', category: 'CAMPING', requirement: '90+ days camped', triggerType: 'DAYS_CAMPED', triggerValue: 90, sortOrder: 21 },
      { slug: 'social-butterfly', name: 'Social Butterfly', description: 'Made 25 friends in the community', imageUrl: '/images/social-butterfly.png', category: 'SOCIAL', requirement: 'Have 25 friends', triggerType: 'FRIENDS_COUNT', triggerValue: 25, sortOrder: 11 },
    ];

    for (const badge of badges) {
      await prisma.badge.upsert({
        where: { slug: badge.slug },
        update: badge,
        create: badge,
      });
    }

    res.json({ success: true, message: 'Badges seeded!' });
  } catch (error) {
    console.error('Seed badges error:', error);
    res.status(500).json({ error: 'Failed to seed badges' });
  }
});

// POST /api/badges/award - Admin award badge to user
router.post('/award', authenticateToken, async (req: any, res) => {
  try {
    const { userId, badgeSlug } = req.body;
    
    if (!userId || !badgeSlug) {
      return res.status(400).json({ error: 'userId and badgeSlug required' });
    }

    const result = await awardBadge(userId, badgeSlug);
    res.json(result);
  } catch (error) {
    console.error('Award badge error:', error);
    res.status(500).json({ error: 'Failed to award badge' });
  }
});

export default router;

// Add these routes to badge.routes.ts BEFORE the export

// GET /api/badges/campground/:campgroundId - Get badges a campground contributes to
router.get('/campground/:campgroundId', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { getBadgesForCampground } = require('../services/badge.service');
    const badges = await getBadgesForCampground(campgroundId);
    res.json(badges);
  } catch (error) {
    console.error('Get campground badges error:', error);
    res.status(500).json({ error: 'Failed to get campground badges' });
  }
});

// GET /api/badges/location-progress/:badgeSlug - Get user's progress on a location/region badge
router.get('/location-progress/:badgeSlug', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { badgeSlug } = req.params;
    const { getLocationBadgeProgress } = require('../services/badge.service');
    const progress = await getLocationBadgeProgress(userId, badgeSlug);
    
    if (!progress) {
      return res.status(404).json({ error: 'Badge not found or not a location badge' });
    }
    
    res.json(progress);
  } catch (error) {
    console.error('Get location badge progress error:', error);
    res.status(500).json({ error: 'Failed to get badge progress' });
  }
});
