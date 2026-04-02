import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── GET /api/campfire-tips/:campgroundId — all tips for a campground ──
router.get('/:campgroundId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sort = 'helpful', limit = '20' } = req.query;
    const orderBy: any = sort === 'recent' ? { createdAt: 'desc' } : { helpfulCount: 'desc' };

    const tips = await prisma.campfireTip.findMany({
      where: { campgroundId: req.params.campgroundId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        reactions: { select: { userId: true, type: true } },
        _count: { select: { reactions: true } },
      },
      orderBy,
      take: parseInt(String(limit)),
    });

    res.json({ tips });
  } catch {
    res.status(500).json({ error: 'Failed to fetch tips' });
  }
});

// ── GET /api/campfire-tips/trip/:tripId — tips for a specific trip ──
router.get('/trip/:tripId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const tips = await prisma.campfireTip.findMany({
      where: { tripId: req.params.tripId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        campground: { select: { id: true, name: true } },
        reactions: { select: { userId: true, type: true } },
      },
      orderBy: { helpfulCount: 'desc' },
    });
    res.json({ tips });
  } catch {
    res.status(500).json({ error: 'Failed to fetch tips' });
  }
});

// ── POST /api/campfire-tips — create a tip ──
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const authorId = req.userId || req.user?.id;
    const { campgroundId, tripId, recipientId, title, content, category } = req.body;
    if (!campgroundId || !content?.trim()) return res.status(400).json({ error: 'campgroundId and content required' });

    // Count author's visits to this campground
    const visitCount = await prisma.checkIn.count({ where: { userId: authorId, campgroundId } });
    const lastVisit = await prisma.checkIn.findFirst({
      where: { userId: authorId, campgroundId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const tip = await prisma.campfireTip.create({
      data: {
        campgroundId, authorId, tripId: tripId || null, recipientId: recipientId || null,
        title: title?.trim() || null, content: content.trim(), category: category || null,
        authorVisitCount: visitCount, lastVisitedAt: lastVisit?.createdAt || null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        campground: { select: { id: true, name: true } },
      },
    });

    // Notify recipient if this is a directed tip
    if (recipientId) {
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'CAMPFIRE_TIP',
          content: `${tip.author.firstName} shared a tip for ${tip.campground.name}`,
          link: tripId ? `/trips/${tripId}` : `/campgrounds/${campgroundId}`,
          category: 'SOCIAL',
          actorId: authorId,
          actorName: `${tip.author.firstName} ${tip.author.lastName}`,
          actorAvatar: tip.author.profilePicture,
          metadata: { tipId: tip.id, campgroundName: tip.campground.name },
        },
      });
    }

    res.json({ tip });
  } catch {
    res.status(500).json({ error: 'Failed to create tip' });
  }
});

// ── POST /api/campfire-tips/:tipId/react — react to a tip ──
router.post('/:tipId/react', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const { type } = req.body; // HELPFUL, SAVE, APPRECIATE
    if (!['HELPFUL', 'SAVE', 'APPRECIATE'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const tip = await prisma.campfireTip.findUnique({ where: { id: req.params.tipId } });
    if (!tip) return res.status(404).json({ error: 'Tip not found' });

    const existing = await prisma.campfireTipReaction.findUnique({
      where: { tipId_userId_type: { tipId: tip.id, userId, type } },
    });

    if (existing) {
      await prisma.campfireTipReaction.delete({ where: { id: existing.id } });
      if (type === 'HELPFUL') await prisma.campfireTip.update({ where: { id: tip.id }, data: { helpfulCount: { decrement: 1 } } });
      if (type === 'SAVE') await prisma.campfireTip.update({ where: { id: tip.id }, data: { savedCount: { decrement: 1 } } });
      return res.json({ removed: true });
    }

    await prisma.campfireTipReaction.create({ data: { tipId: tip.id, userId, type } });
    if (type === 'HELPFUL') await prisma.campfireTip.update({ where: { id: tip.id }, data: { helpfulCount: { increment: 1 } } });
    if (type === 'SAVE') await prisma.campfireTip.update({ where: { id: tip.id }, data: { savedCount: { increment: 1 } } });

    // Notify tip author
    if (tip.authorId !== userId) {
      const reactor = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
      await prisma.notification.create({
        data: {
          userId: tip.authorId,
          type: 'TIP_REACTION',
          content: `${reactor?.firstName || 'Someone'} found your tip ${type === 'HELPFUL' ? 'helpful 🙌' : type === 'SAVE' ? 'worth saving 💾' : 'appreciative ❤️'}`,
          link: `/campgrounds/${tip.campgroundId}`,
          category: 'SOCIAL',
          actorId: userId,
        },
      });
    }

    res.json({ added: true });
  } catch {
    res.status(500).json({ error: 'Failed to react' });
  }
});

// ── POST /api/campfire-tips/smart-prompt — generate pre-filled tip for a friend's trip ──
router.post('/smart-prompt', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const { campgroundId, recipientFirstName } = req.body;

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true, state: true, city: true },
    });
    if (!campground) return res.status(404).json({ error: 'Campground not found' });

    // Get author's visit history
    const visits = await prisma.checkIn.findMany({
      where: { userId, campgroundId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    const existingReviews = await prisma.campgroundReview.findFirst({
      where: { userId, campgroundId },
      select: { review: true, bestSiteNumber: true, cellService: true, noise: true },
    });

    const prompt = `You are Hitch, the friendly RV travel guide. A camper named ${recipientFirstName || 'a friend'} is heading to ${campground.name} in ${campground.city || ''}, ${campground.state || ''}.

Their friend (who visited ${visits.length} time${visits.length !== 1 ? 's' : ''}) wants to share a tip.${existingReviews?.review ? ` Their previous review said: "${existingReviews.review.slice(0, 200)}"` : ''}${existingReviews?.bestSiteNumber ? ` Best site: ${existingReviews.bestSiteNumber}` : ''}

Generate 3 pre-filled tip suggestions as JSON. Each should be a short, helpful, specific tip. Return ONLY JSON:
[{"title":"Watch out for...","content":"..."},{"title":"Best part was...","content":"..."},{"title":"Pro tip:","content":"..."}]`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    const suggestions = match ? JSON.parse(match[0]) : [];

    res.json({ suggestions, campground, visitCount: visits.length });
  } catch {
    res.status(500).json({ error: 'Failed to generate prompt' });
  }
});

// ── GET /api/campfire-tips/user/:userId/stats — contributor stats ──
router.get('/user/:userId/stats', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const [tipCount, helpfulTotal, campgrounds] = await Promise.all([
      prisma.campfireTip.count({ where: { authorId: userId } }),
      prisma.campfireTip.aggregate({ where: { authorId: userId }, _sum: { helpfulCount: true } }),
      prisma.campfireTip.findMany({
        where: { authorId: userId },
        select: { campgroundId: true },
        distinct: ['campgroundId'],
      }),
    ]);

    res.json({
      tipCount,
      helpfulScore: helpfulTotal._sum.helpfulCount || 0,
      campgroundsHelped: campgrounds.length,
      badges: [
        tipCount >= 1 && 'First Tip',
        tipCount >= 10 && 'Trail Guide',
        (helpfulTotal._sum.helpfulCount || 0) >= 20 && 'Most Helpful',
      ].filter(Boolean),
    });
  } catch {
    res.json({ tipCount: 0, helpfulScore: 0, campgroundsHelped: 0, badges: [] });
  }
});

// ── POST /api/campfire-tips/match-trip — find relevant tip-givers for a trip ──
router.post('/match-trip', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const { campgroundId } = req.body;
    if (!campgroundId) return res.status(400).json({ error: 'campgroundId required' });

    // Find friends who visited this campground
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ initiatorId: userId }, { receiverId: userId }],
        status: 'accepted',
      },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIds = friendships.map(f => f.initiatorId === userId ? f.receiverId : f.initiatorId);

    const visitors = await prisma.checkIn.findMany({
      where: { campgroundId, userId: { in: friendIds } },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
      distinct: ['userId'],
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    res.json({ matches: visitors.map(v => ({ ...v.user, lastVisit: v.createdAt })) });
  } catch {
    res.json({ matches: [] });
  }
});

export default router;
