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

export default router;
