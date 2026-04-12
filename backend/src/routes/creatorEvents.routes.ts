import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import { sendWebPush } from '../utils/webPush';

const router = Router();

// POST /api/creator-events
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isCreator: true } });
    if (!user?.isCreator) return res.status(403).json({ error: 'Creator account required' });

    const { title, description, type, campgroundId, startTime, endTime, maxAttendees, contentId } = req.body;
    if (!title?.trim() || !type || !startTime) {
      return res.status(400).json({ error: 'Title, type, and startTime are required' });
    }

    const event = await (prisma as any).creatorEvent.create({
      data: {
        creatorId: req.userId,
        title: title.trim(),
        description: description?.trim() || null,
        type,
        campgroundId: campgroundId || null,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        maxAttendees: maxAttendees || null,
        contentId: contentId || null,
        status: 'UPCOMING',
      },
      include: {
        campground: { select: { id: true, name: true, city: true, state: true } },
        _count: { select: { rsvps: true } },
      },
    });

    res.json({ event });
  } catch (e) {
    console.error('[CreatorEvent] Create error:', e);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// GET /api/creator-events/:id
router.get('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await (prisma as any).creatorEvent.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, firstName: true, username: true, profilePicture: true, creatorDisplayName: true } },
        campground: { select: { id: true, name: true, city: true, state: true } },
        _count: { select: { rsvps: true } },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const rsvped = await (prisma as any).creatorEventRsvp.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: req.userId } },
    });

    res.json({ event: { ...event, userHasRsvped: !!rsvped } });
  } catch (e) {
    console.error('[CreatorEvent] Get error:', e);
    res.status(500).json({ error: 'Failed to load event' });
  }
});

// GET /api/creator-events/creator/:creatorId
router.get('/creator/:creatorId', async (req: any, res: Response) => {
  try {
    const status = req.query.status as string || 'UPCOMING';
    const where: any = { creatorId: req.params.creatorId };
    if (status === 'UPCOMING') {
      where.status = { in: ['UPCOMING', 'LIVE'] };
      where.startTime = { gte: new Date() };
    } else if (status === 'PAST') {
      where.OR = [{ status: 'PAST' }, { startTime: { lt: new Date() } }];
    }

    const events = await (prisma as any).creatorEvent.findMany({
      where,
      orderBy: { startTime: status === 'UPCOMING' ? 'asc' : 'desc' },
      take: 20,
      include: {
        campground: { select: { id: true, name: true, city: true, state: true } },
        _count: { select: { rsvps: true } },
      },
    });
    res.json({ events });
  } catch (e) {
    console.error('[CreatorEvent] List error:', e);
    res.status(500).json({ error: 'Failed to list events' });
  }
});

// POST /api/creator-events/:id/rsvp — toggle
router.post('/:id/rsvp', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).creatorEventRsvp.findUnique({
      where: { eventId_userId: { eventId: req.params.id, userId: req.userId } },
    });

    if (existing) {
      await (prisma as any).creatorEventRsvp.delete({ where: { id: existing.id } });
      const count = await (prisma as any).creatorEventRsvp.count({ where: { eventId: req.params.id } });
      return res.json({ rsvped: false, rsvpCount: count });
    }

    // Check max attendees
    const event = await (prisma as any).creatorEvent.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.maxAttendees) {
      const currentCount = await (prisma as any).creatorEventRsvp.count({ where: { eventId: req.params.id } });
      if (currentCount >= event.maxAttendees) return res.status(400).json({ error: 'Event is full' });
    }

    await (prisma as any).creatorEventRsvp.create({ data: { eventId: req.params.id, userId: req.userId } });

    // Notify creator
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { firstName: true } });
    await sendWebPush(event.creatorId, {
      title: `${user?.firstName || 'Someone'} RSVPed to ${event.title}`,
      body: 'You have a new RSVP!',
      url: `/creator/dashboard`,
    }).catch(() => {});

    const count = await (prisma as any).creatorEventRsvp.count({ where: { eventId: req.params.id } });
    res.json({ rsvped: true, rsvpCount: count });
  } catch (e) {
    console.error('[CreatorEvent] RSVP error:', e);
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});

// PATCH /api/creator-events/:id
router.patch('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).creatorEvent.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.creatorId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { title, description, type, startTime, endTime, maxAttendees, status } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (type !== undefined) data.type = type;
    if (startTime !== undefined) data.startTime = new Date(startTime);
    if (endTime !== undefined) data.endTime = new Date(endTime);
    if (maxAttendees !== undefined) data.maxAttendees = maxAttendees;
    if (status !== undefined) data.status = status;

    const event = await (prisma as any).creatorEvent.update({ where: { id: req.params.id }, data });

    // If cancelled, notify RSVPs
    if (status === 'CANCELLED') {
      const rsvps = await (prisma as any).creatorEventRsvp.findMany({ where: { eventId: req.params.id }, select: { userId: true } });
      for (const r of rsvps) {
        await sendWebPush(r.userId, {
          title: `Event cancelled: ${event.title}`,
          body: 'The creator has cancelled this event.',
        }).catch(() => {});
      }
    }

    res.json({ event });
  } catch (e) {
    console.error('[CreatorEvent] Update error:', e);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/creator-events/:id
router.delete('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).creatorEvent.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.creatorId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await (prisma as any).creatorEvent.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    res.json({ success: true });
  } catch (e) {
    console.error('[CreatorEvent] Delete error:', e);
    res.status(500).json({ error: 'Failed to cancel event' });
  }
});

// ── CREATOR PRESENCE ────────────────────────────────────────

// POST /api/creator-events/presence
router.post('/presence', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isCreator: true } });
    if (!user?.isCreator) return res.status(403).json({ error: 'Creator account required' });

    const { campgroundId, type = 'CHECKED_IN', note } = req.body;
    if (!campgroundId) return res.status(400).json({ error: 'campgroundId is required' });

    // End any existing active presence
    await (prisma as any).creatorPresence.updateMany({
      where: { creatorId: req.userId, isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });

    const presence = await (prisma as any).creatorPresence.create({
      data: { creatorId: req.userId, campgroundId, type, note: note || null, isActive: true },
      include: { campground: { select: { id: true, name: true, city: true, state: true } } },
    });

    res.json({ presence });
  } catch (e) {
    console.error('[CreatorPresence] Create error:', e);
    res.status(500).json({ error: 'Failed to set presence' });
  }
});

// DELETE /api/creator-events/presence/:id
router.delete('/presence/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).creatorPresence.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.creatorId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await (prisma as any).creatorPresence.update({
      where: { id: req.params.id },
      data: { isActive: false, endedAt: new Date() },
    });
    res.json({ success: true });
  } catch (e) {
    console.error('[CreatorPresence] End error:', e);
    res.status(500).json({ error: 'Failed to end presence' });
  }
});

// GET /api/creator-events/campground-presence/:campgroundId
router.get('/campground-presence/:campgroundId', async (req: any, res: Response) => {
  try {
    const presences = await (prisma as any).creatorPresence.findMany({
      where: { campgroundId: req.params.campgroundId, isActive: true },
      include: {
        creator: {
          select: {
            id: true, firstName: true, username: true, profilePicture: true,
            creatorDisplayName: true, creatorHandle: true,
          },
        },
      },
    });

    // Enrich with follower count and recent content
    const enriched = await Promise.all(
      presences.map(async (p: any) => {
        const [followerCount, recentContent] = await Promise.all([
          (prisma as any).creatorFollow.count({ where: { creatorId: p.creatorId } }),
          (prisma as any).creatorContent.findMany({
            where: { creatorId: p.creatorId, status: 'PUBLISHED' },
            orderBy: { publishedAt: 'desc' },
            take: 2,
            select: { id: true, title: true, thumbnailUrl: true, contentType: true },
          }),
        ]);
        return { ...p, creator: { ...p.creator, followerCount }, recentContent };
      })
    );

    res.json({ presences: enriched });
  } catch (e) {
    console.error('[CreatorPresence] Campground error:', e);
    res.status(500).json({ error: 'Failed to load creator presence' });
  }
});

// ── INTENT-BASED DISCOVERY ──────────────────────────────────

// GET /api/creator-events/discover-for-trip/:eventId
router.get('/discover-for-trip/:eventId', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: { campgroundId: true, campground: { select: { state: true } } },
    });
    if (!event) return res.json({ creators: [] });

    const campgroundIds = event.campgroundId ? [event.campgroundId] : [];
    const states = event.campground?.state ? [event.campground.state] : [];

    // Find creators with content tagged to these campgrounds or states
    const relevantContent = await (prisma as any).creatorContent.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          ...(campgroundIds.length > 0 ? [{ campgroundId: { in: campgroundIds } }] : []),
          ...(states.length > 0 ? [{ campground: { state: { in: states } } }] : []),
        ],
      },
      select: { creatorId: true, id: true, title: true, thumbnailUrl: true },
    });

    // Group by creator
    const creatorMap: Record<string, { contentIds: string[]; content: any[] }> = {};
    for (const c of relevantContent) {
      if (!creatorMap[c.creatorId]) creatorMap[c.creatorId] = { contentIds: [], content: [] };
      creatorMap[c.creatorId].contentIds.push(c.id);
      if (creatorMap[c.creatorId].content.length < 2) {
        creatorMap[c.creatorId].content.push({ id: c.id, title: c.title, thumbnailUrl: c.thumbnailUrl });
      }
    }

    const creatorIds = Object.keys(creatorMap);
    if (creatorIds.length === 0) return res.json({ creators: [] });

    // Fetch creator info
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds.slice(0, 8) } },
      select: {
        id: true, firstName: true, username: true, profilePicture: true,
        creatorDisplayName: true, creatorHandle: true,
      },
    });

    // Check if they have trip kits for these campgrounds
    const tripKits = await (prisma as any).tripKit.findMany({
      where: {
        creatorId: { in: creatorIds },
        status: 'PUBLISHED',
        campgrounds: { some: { campgroundId: { in: campgroundIds } } },
      },
      select: { creatorId: true },
    });
    const creatorsWithKits = new Set(tripKits.map((tk: any) => tk.creatorId));

    const result = creators.map((c) => ({
      ...c,
      relevantContentCount: creatorMap[c.id]?.contentIds.length || 0,
      relevantContent: creatorMap[c.id]?.content || [],
      hasTripKit: creatorsWithKits.has(c.id),
    }));

    // Sort by relevance
    result.sort((a, b) => b.relevantContentCount - a.relevantContentCount);

    res.json({ creators: result.slice(0, 8) });
  } catch (e) {
    console.error('[CreatorDiscovery] For-trip error:', e);
    res.status(500).json({ error: 'Failed to discover creators' });
  }
});

// ── CREATOR INSIGHTS ────────────────────────────────────────

// GET /api/creator-events/insights
router.get('/insights', authenticateToken, async (req: any, res: Response) => {
  try {
    const insights = await (prisma as any).creatorInsightAction.findMany({
      where: { creatorId: req.userId, dismissed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ insights });
  } catch (e) {
    console.error('[CreatorInsights] Error:', e);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

// PATCH /api/creator-events/insights/:id/dismiss
router.patch('/insights/:id/dismiss', authenticateToken, async (req: any, res: Response) => {
  try {
    await (prisma as any).creatorInsightAction.update({
      where: { id: req.params.id },
      data: { dismissed: true },
    });
    res.json({ success: true });
  } catch (e) {
    console.error('[CreatorInsights] Dismiss error:', e);
    res.status(500).json({ error: 'Failed to dismiss insight' });
  }
});

// ── CAMPGROUND CREATOR CONTENT ──────────────────────────────

// GET /api/creator-events/campground-content/:campgroundId
router.get('/campground-content/:campgroundId', async (req: any, res: Response) => {
  try {
    const content = await (prisma as any).creatorContent.findMany({
      where: { campgroundId: req.params.campgroundId, status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { viewCount: 'desc' }],
      take: 10,
      include: {
        creator: { select: { id: true, firstName: true, username: true, profilePicture: true, creatorDisplayName: true } },
      },
    });
    res.json({ content });
  } catch (e) {
    console.error('[CreatorContent] Campground error:', e);
    res.status(500).json({ error: 'Failed to load content' });
  }
});

export default router;
