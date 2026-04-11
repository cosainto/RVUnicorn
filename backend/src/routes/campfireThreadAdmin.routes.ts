import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { generateCampfireThread } from '../services/campfireThreadGenerator';
import { publishCampfireThread } from '../services/campfireThreadPublisher';
import { getCharacterForCategory } from '../lib/campfireCharacters';

const router = Router();

// All routes require admin
router.use(authenticateToken, requireAdmin);

// POST /generate — create an AI-generated draft
router.post('/generate', async (req: any, res: Response) => {
  try {
    const { title, category, targetAudience, rigContext, weatherContext, destinationIds = [] } = req.body;
    if (!title?.trim() || !category?.trim()) {
      return res.status(400).json({ error: 'Title and category are required' });
    }

    const generated = await generateCampfireThread({
      title,
      category,
      targetAudience: targetAudience || '',
      rigContext: rigContext || '',
      weatherContext: weatherContext || '',
      destinationIds,
    });

    // Save as DRAFT
    const thread = await (prisma as any).campfireThread.create({
      data: {
        title,
        content: generated.body,
        hookQuestion: generated.hookQuestion,
        hotTake: generated.hotTake,
        character: generated.character,
        category,
        targetAudience,
        rigContext,
        weatherContext,
        status: 'DRAFT',
        seedReplies: generated.seedReplies,
        destinations: {
          create: generated.destinations.map((d, i) => ({
            campgroundId: d.campgroundId || null,
            name: d.name,
            rigRestriction: d.rigRestriction,
            amenitySummary: d.amenitySummary,
            sentiment: d.sentiment,
            highlight: d.highlight,
            order: i,
          })),
        },
      },
      include: {
        destinations: { orderBy: { order: 'asc' } },
        expertTags: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    res.json({ thread });
  } catch (e: any) {
    console.error('[CampfireThreadAdmin] Generate error:', e);
    res.status(500).json({ error: e.message || 'Failed to generate thread' });
  }
});

// POST /:id/schedule
router.post('/:id/schedule', async (req: any, res: Response) => {
  try {
    const { scheduledFor } = req.body;
    if (!scheduledFor) return res.status(400).json({ error: 'scheduledFor is required' });

    const thread = await (prisma as any).campfireThread.update({
      where: { id: req.params.id },
      data: {
        status: 'SCHEDULED',
        scheduledFor: new Date(scheduledFor),
      },
      include: { destinations: true, expertTags: true },
    });

    res.json({ thread });
  } catch (e: any) {
    console.error('[CampfireThreadAdmin] Schedule error:', e);
    res.status(500).json({ error: 'Failed to schedule thread' });
  }
});

// POST /:id/publish-now
router.post('/:id/publish-now', async (req: any, res: Response) => {
  try {
    await publishCampfireThread(req.params.id);
    const thread = await (prisma as any).campfireThread.findUnique({
      where: { id: req.params.id },
      include: { destinations: true, expertTags: true },
    });
    res.json({ thread });
  } catch (e: any) {
    console.error('[CampfireThreadAdmin] Publish error:', e);
    res.status(500).json({ error: e.message || 'Failed to publish thread' });
  }
});

// GET / — list all threads
router.get('/', async (req: any, res: Response) => {
  try {
    const threads = await (prisma as any).campfireThread.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        destinations: { orderBy: { order: 'asc' } },
        expertTags: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    // Fetch engagement stats for published threads
    const withEngagement = await Promise.all(
      threads.map(async (t: any) => {
        if (t.postId) {
          const post = await (prisma as any).boardPost.findUnique({
            where: { id: t.postId },
            select: { commentCount: true, voteScore: true },
          });
          return { ...t, engagement: post ? { comments: post.commentCount, votes: post.voteScore } : null };
        }
        return { ...t, engagement: null };
      })
    );

    res.json({ threads: withEngagement });
  } catch (e) {
    console.error('[CampfireThreadAdmin] List error:', e);
    res.status(500).json({ error: 'Failed to list threads' });
  }
});

// PATCH /:id — edit draft
router.patch('/:id', async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).campfireThread.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Thread not found' });
    if (existing.status === 'PUBLISHED') {
      return res.status(400).json({ error: 'Cannot edit a published thread' });
    }

    const { title, content, hookQuestion, hotTake, targetAudience, rigContext, weatherContext, seedReplies } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (hookQuestion !== undefined) data.hookQuestion = hookQuestion;
    if (hotTake !== undefined) data.hotTake = hotTake;
    if (targetAudience !== undefined) data.targetAudience = targetAudience;
    if (rigContext !== undefined) data.rigContext = rigContext;
    if (weatherContext !== undefined) data.weatherContext = weatherContext;
    if (seedReplies !== undefined) data.seedReplies = seedReplies;

    const thread = await (prisma as any).campfireThread.update({
      where: { id: req.params.id },
      data,
      include: { destinations: true, expertTags: true },
    });

    res.json({ thread });
  } catch (e) {
    console.error('[CampfireThreadAdmin] Update error:', e);
    res.status(500).json({ error: 'Failed to update thread' });
  }
});

// DELETE /:id
router.delete('/:id', async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).campfireThread.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Thread not found' });
    if (existing.status === 'PUBLISHED') {
      return res.status(400).json({ error: 'Cannot delete a published thread' });
    }

    await (prisma as any).campfireThread.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    console.error('[CampfireThreadAdmin] Delete error:', e);
    res.status(500).json({ error: 'Failed to delete thread' });
  }
});

export default router;
