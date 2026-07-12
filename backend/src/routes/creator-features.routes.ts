// ============================================
// CREATOR FEATURES ROUTES
// Save as: backend/src/routes/creator-features.routes.ts
// ============================================

import { Router } from 'express';

const router = Router();
import { prisma } from '../lib/prisma';

// Auth middleware helper
const getAuthUserId = (req: any): string | null => {
  return req.userId || null;
};

const requireAuth = (req: any, res: any, next: any) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

// ============================================
// PINNED CONTENT
// ============================================

// POST /api/creator-features/pin/:contentId
router.post('/pin/:contentId', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;
    const { contentId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { creatorPinnedContentIds: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const pinned = user.creatorPinnedContentIds || [];
    if (pinned.length >= 3) return res.status(400).json({ error: 'Max 3 pinned posts' });
    if (pinned.includes(contentId)) return res.status(400).json({ error: 'Already pinned' });
    await prisma.user.update({ where: { id: userId }, data: { creatorPinnedContentIds: [...pinned, contentId] } });
    await prisma.creatorContent.update({ where: { id: contentId }, data: { isPinned: true } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Pin error:', error);
    res.status(500).json({ error: 'Failed to pin' });
  }
});

// DELETE /api/creator-features/pin/:contentId
router.delete('/pin/:contentId', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;
    const { contentId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { creatorPinnedContentIds: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await prisma.user.update({
      where: { id: userId },
      data: { creatorPinnedContentIds: (user.creatorPinnedContentIds || []).filter((id: string) => id !== contentId) },
    });
    await prisma.creatorContent.update({ where: { id: contentId }, data: { isPinned: false } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to unpin' });
  }
});

// ============================================
// CONTENT SERIES / PLAYLISTS
// ============================================

// GET /api/creator-features/series/:creatorId
router.get('/series/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const series = await prisma.creatorSeries.findMany({
      where: { creatorId, isPublished: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { status: 'PUBLISHED' },
          orderBy: { seriesOrder: 'asc' },
          select: { id: true, title: true, thumbnailUrl: true, contentType: true, viewCount: true, likeCount: true, publishedAt: true },
        },
        _count: { select: { items: true } },
      },
    });
    res.json(series);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

// POST /api/creator-features/series
router.post('/series', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;
    const { title, description, coverImage } = req.body;
    const series = await prisma.creatorSeries.create({
      data: { creatorId: userId, title, description, coverImage },
    });
    res.json(series);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create series' });
  }
});

// PUT /api/creator-features/series/:seriesId
router.put('/series/:seriesId', requireAuth, async (req, res) => {
  try {
    const { seriesId } = req.params;
    const { title, description, coverImage, isPublished } = req.body;
    const series = await prisma.creatorSeries.update({
      where: { id: seriesId },
      data: { title, description, coverImage, isPublished },
    });
    res.json(series);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update series' });
  }
});

// DELETE /api/creator-features/series/:seriesId
router.delete('/series/:seriesId', requireAuth, async (req, res) => {
  try {
    const { seriesId } = req.params;
    // Unlink content from series first
    await prisma.creatorContent.updateMany({ where: { seriesId }, data: { seriesId: null, seriesOrder: null } });
    await prisma.creatorSeries.delete({ where: { id: seriesId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete series' });
  }
});

// PUT /api/creator-features/series/:seriesId/add-content
router.put('/series/:seriesId/add-content', requireAuth, async (req, res) => {
  try {
    const { seriesId } = req.params;
    const { contentId } = req.body;
    const count = await prisma.creatorContent.count({ where: { seriesId } });
    await prisma.creatorContent.update({
      where: { id: contentId },
      data: { seriesId, seriesOrder: count },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add to series' });
  }
});

// PUT /api/creator-features/series/:seriesId/remove-content
router.put('/series/:seriesId/remove-content', requireAuth, async (req, res) => {
  try {
    const { contentId } = req.body;
    await prisma.creatorContent.update({
      where: { id: contentId },
      data: { seriesId: null, seriesOrder: null },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove from series' });
  }
});

// ============================================
// POLLS
// ============================================

// GET /api/creator-features/polls/:creatorId
router.get('/polls/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const userId = getAuthUserId(req);
    const polls = await prisma.creatorPoll.findMany({
      where: { creatorId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        votes: userId ? { where: { userId }, select: { optionId: true } } : false,
      },
    });
    res.json(polls);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

// POST /api/creator-features/polls
router.post('/polls', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;
    const { question, description, options, endsAt } = req.body;
    if (!options || options.length < 2) return res.status(400).json({ error: 'Need at least 2 options' });
    const poll = await prisma.creatorPoll.create({
      data: {
        creatorId: userId,
        question,
        description,
        endsAt: endsAt ? new Date(endsAt) : null,
        options: {
          create: options.map((text: string, i: number) => ({ text, sortOrder: i })),
        },
      },
      include: { options: true },
    });
    res.json(poll);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// POST /api/creator-features/polls/:pollId/vote
router.post('/polls/:pollId/vote', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;
    const { pollId } = req.params;
    const { optionId } = req.body;

    // Check if already voted
    const existing = await prisma.creatorPollVote.findUnique({ where: { pollId_userId: { pollId, userId } } });
    if (existing) return res.status(400).json({ error: 'Already voted' });

    // Check poll is active
    const poll = await prisma.creatorPoll.findUnique({ where: { id: pollId } });
    if (!poll?.isActive) return res.status(400).json({ error: 'Poll is closed' });
    if (poll.endsAt && new Date() > poll.endsAt) return res.status(400).json({ error: 'Poll has ended' });

    await prisma.$transaction([
      prisma.creatorPollVote.create({ data: { pollId, optionId, userId } }),
      prisma.creatorPollOption.update({ where: { id: optionId }, data: { voteCount: { increment: 1 } } }),
      prisma.creatorPoll.update({ where: { id: pollId }, data: { totalVotes: { increment: 1 } } }),
    ]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// DELETE /api/creator-features/polls/:pollId
router.delete('/polls/:pollId', requireAuth, async (req, res) => {
  try {
    const { pollId } = req.params;
    await prisma.creatorPoll.delete({ where: { id: pollId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete poll' });
  }
});

// ============================================
// STORIES (24hr ephemeral)
// ============================================

// GET /api/creator-features/stories/:creatorId
router.get('/stories/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const stories = await prisma.creatorStory.findMany({
      where: { creatorId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } },
    });
    res.json(stories);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// POST /api/creator-features/stories
router.post('/stories', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;
    const { imageUrl, text, bgColor, linkUrl, linkLabel } = req.body;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const story = await prisma.creatorStory.create({
      data: { creatorId: userId, imageUrl, text, bgColor, linkUrl, linkLabel, expiresAt },
    });
    res.json(story);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// DELETE /api/creator-features/stories/:storyId
router.delete('/stories/:storyId', requireAuth, async (req, res) => {
  try {
    await prisma.creatorStory.delete({ where: { id: req.params.storyId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// POST /api/creator-features/stories/:storyId/view
router.post('/stories/:storyId/view', async (req, res) => {
  try {
    await prisma.creatorStory.update({ where: { id: req.params.storyId }, data: { viewCount: { increment: 1 } } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ============================================
// SHOUTOUTS
// ============================================

// GET /api/creator-features/shoutouts/:creatorId
router.get('/shoutouts/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const shoutouts = await prisma.creatorShoutout.findMany({
      where: { OR: [{ giverId: creatorId }, { receiverId: creatorId }], isActive: true },
      include: {
        giver: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true, creatorVerified: true, creatorSpecialties: true } },
        receiver: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true, creatorVerified: true, creatorSpecialties: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(shoutouts);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch shoutouts' });
  }
});

// POST /api/creator-features/shoutouts
router.post('/shoutouts', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;
    const { receiverId, message } = req.body;
    if (userId === receiverId) return res.status(400).json({ error: 'Cannot shoutout yourself' });
    const shoutout = await prisma.creatorShoutout.create({
      data: { giverId: userId, receiverId, message },
    });
    res.json(shoutout);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Already gave this creator a shoutout' });
    res.status(500).json({ error: 'Failed to create shoutout' });
  }
});

// DELETE /api/creator-features/shoutouts/:shoutoutId
router.delete('/shoutouts/:shoutoutId', requireAuth, async (req, res) => {
  try {
    await prisma.creatorShoutout.delete({ where: { id: req.params.shoutoutId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete shoutout' });
  }
});

// ============================================
// MILESTONES
// ============================================

// GET /api/creator-features/milestones/:creatorId
router.get('/milestones/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const milestones = await prisma.creatorMilestone.findMany({
      where: { userId: creatorId },
      orderBy: { achievedAt: 'desc' },
    });
    res.json(milestones);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// POST /api/creator-features/check-milestones - auto-check and create milestones
router.post('/check-milestones', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;

    // Get stats
    const [followerCount, contentCount, totalViews, totalLikes] = await Promise.all([
      prisma.creatorFollow.count({ where: { creatorId: userId } }),
      prisma.creatorContent.count({ where: { creatorId: userId, status: 'PUBLISHED' } }),
      prisma.creatorContent.aggregate({ where: { creatorId: userId }, _sum: { viewCount: true } }),
      prisma.creatorContent.aggregate({ where: { creatorId: userId }, _sum: { likeCount: true } }),
    ]);

    const views = totalViews._sum.viewCount || 0;
    const likes = totalLikes._sum.likeCount || 0;

    const milestoneChecks = [
      { type: 'FOLLOWERS', thresholds: [10, 50, 100, 500, 1000, 5000, 10000], value: followerCount },
      { type: 'CONTENT', thresholds: [1, 5, 10, 25, 50, 100], value: contentCount },
      { type: 'VIEWS', thresholds: [100, 500, 1000, 5000, 10000, 50000, 100000], value: views },
      { type: 'LIKES', thresholds: [10, 50, 100, 500, 1000, 5000], value: likes },
    ];

    const newMilestones: any[] = [];
    for (const check of milestoneChecks) {
      for (const threshold of check.thresholds) {
        if (check.value >= threshold) {
          try {
            const m = await prisma.creatorMilestone.create({
              data: { userId, type: check.type, threshold },
            });
            newMilestones.push(m);
          } catch (e: any) {
            // Already exists (unique constraint), skip
          }
        }
      }
    }

    res.json({ newMilestones, stats: { followerCount, contentCount, views, likes } });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to check milestones' });
  }
});

// POST /api/creator-features/milestones/:milestoneId/celebrate
router.post('/milestones/:milestoneId/celebrate', requireAuth, async (req, res) => {
  try {
    await prisma.creatorMilestone.update({ where: { id: req.params.milestoneId }, data: { celebrated: true } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ============================================
// TIP JAR & MERCH SETTINGS
// ============================================

// PUT /api/creator-features/monetization
router.put('/monetization', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;
    const { tipJarUrl, tipJarType, merchUrl, merchLabel } = req.body;
    await prisma.user.update({
      where: { id: userId },
      data: {
        creatorTipJarUrl: tipJarUrl || null,
        creatorTipJarType: tipJarType || null,
        creatorMerchUrl: merchUrl || null,
        creatorMerchLabel: merchLabel || null,
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update monetization settings' });
  }
});

// ============================================
// THEME
// ============================================

// PUT /api/creator-features/theme
router.put('/theme', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req)!;
    const { themeColor } = req.body;
    await prisma.user.update({ where: { id: userId }, data: { creatorThemeColor: themeColor } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// ============================================
// SUGGESTED CREATORS
// ============================================

// GET /api/creator-features/suggested
router.get('/suggested', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const excludeIds: string[] = [];

    if (userId) {
      const following = await prisma.creatorFollow.findMany({ where: { followerId: userId }, select: { creatorId: true } });
      excludeIds.push(userId, ...following.map((f: any) => f.creatorId));
    }

    const creators = await prisma.user.findMany({
      where: {
        isCreator: true,
        id: { notIn: excludeIds.length > 0 ? excludeIds : undefined },
      },
      orderBy: { creatorEnabledAt: 'desc' },
      take: 6,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        creatorBio: true,
        creatorSpecialties: true,
        creatorVerified: true,
        creatorDisplayName: true,
        _count: { select: { creatorFollowers: true, creatorContent: true } },
      },
    });
    res.json(creators);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch suggested creators' });
  }
});

export default router;
