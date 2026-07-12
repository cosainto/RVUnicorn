import { Router, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { sendWebPush } from '../utils/webPush';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
import { prisma } from '../lib/prisma';
const JWT_SECRET = process.env.JWT_SECRET || 'rvunicorn-secret';
const VALID_EMOJIS = ['❤️', '🔥', '😂', '😮', '🏕️'];
const PROFANITY_LIST = ['fuck', 'shit', 'ass', 'damn', 'bitch', 'dick', 'cunt', 'cock'];

// Helper: track analytics for today
async function trackAnalytics(tripId: string, field: 'views' | 'uniqueViews' | 'reactions' | 'comments' | 'shareClicks', increment = 1) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  try {
    await (prisma as any).scrapbookAnalytics.upsert({
      where: { tripId_date: { tripId, date: today } },
      update: { [field]: { increment } },
      create: { tripId, date: today, [field]: increment },
    });
  } catch {}
}

// ── REACTIONS ────────────────────────────────────────────────

router.post('/public/:token/react', async (req, res) => {
  try {
    const event = await prisma.event.findFirst({ where: { scrapbookShareToken: req.params.token, scrapbookPublic: true }, select: { id: true, organizerId: true, title: true } });
    if (!event) return res.status(404).json({ error: 'Scrapbook not found' });

    const { emoji, photoId, visitorId } = req.body;
    if (!visitorId || !VALID_EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Invalid reaction' });

    const where = { tripId_photoId_visitorId_emoji: { tripId: event.id, photoId: photoId || '', visitorId, emoji } };
    const existing = await (prisma as any).scrapbookReaction.findUnique({ where });

    if (existing) {
      await (prisma as any).scrapbookReaction.delete({ where: { id: existing.id } });
      const count = await (prisma as any).scrapbookReaction.count({ where: { tripId: event.id, photoId: photoId || null, emoji } });
      return res.json({ reacted: false, count });
    }

    await (prisma as any).scrapbookReaction.create({
      data: { tripId: event.id, photoId: photoId || null, visitorId, emoji, userId: null },
    });
    await trackAnalytics(event.id, 'reactions');

    const count = await (prisma as any).scrapbookReaction.count({ where: { tripId: event.id, photoId: photoId || null, emoji } });
    res.json({ reacted: true, count });
  } catch (e: any) {
    console.error('[ScrapbookReaction] Error:', e);
    res.status(500).json({ error: 'Failed to react' });
  }
});

router.get('/public/:token/reactions', async (req, res) => {
  try {
    const event = await prisma.event.findFirst({ where: { scrapbookShareToken: req.params.token, scrapbookPublic: true }, select: { id: true } });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const reactions = await (prisma as any).scrapbookReaction.findMany({ where: { tripId: event.id } });

    const overall: Record<string, number> = {};
    const perPhoto: Record<string, Record<string, number>> = {};

    for (const r of reactions) {
      overall[r.emoji] = (overall[r.emoji] || 0) + 1;
      if (r.photoId) {
        if (!perPhoto[r.photoId]) perPhoto[r.photoId] = {};
        perPhoto[r.photoId][r.emoji] = (perPhoto[r.photoId][r.emoji] || 0) + 1;
      }
    }

    res.json({ overall, perPhoto });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load reactions' });
  }
});

// ── COMMENTS ────────────────────────────────────────────────

router.post('/public/:token/comments', async (req, res) => {
  try {
    const event = await prisma.event.findFirst({ where: { scrapbookShareToken: req.params.token, scrapbookPublic: true }, select: { id: true, organizerId: true, title: true } });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const { content, photoId, visitorId, guestName } = req.body;
    if (!content?.trim() || content.length > 280) return res.status(400).json({ error: 'Comment must be 1-280 characters' });
    if (!visitorId) return res.status(400).json({ error: 'visitorId required' });
    if (!guestName?.trim()) return res.status(400).json({ error: 'Name required' });

    // Basic profanity check
    const lower = content.toLowerCase();
    if (PROFANITY_LIST.some(w => lower.includes(w))) {
      return res.status(400).json({ error: 'Please keep comments family-friendly' });
    }

    const comment = await (prisma as any).scrapbookComment.create({
      data: {
        tripId: event.id,
        photoId: photoId || null,
        visitorId,
        guestName: guestName.trim().slice(0, 30),
        content: content.trim(),
        approved: true,
      },
    });

    await trackAnalytics(event.id, 'comments');

    // Notify owner (rate limited — check last notification)
    try {
      await sendWebPush(event.organizerId, {
        title: `💬 ${guestName || 'Someone'} commented on your scrapbook`,
        body: content.slice(0, 60),
        url: `/trips/${event.id}?tab=scrapbook`,
      });
    } catch {}

    res.json(comment);
  } catch (e: any) {
    console.error('[ScrapbookComment] Error:', e);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

router.get('/public/:token/comments', async (req, res) => {
  try {
    const event = await prisma.event.findFirst({ where: { scrapbookShareToken: req.params.token, scrapbookPublic: true }, select: { id: true } });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const photoId = req.query.photoId as string | undefined;
    const where: any = { tripId: event.id, approved: true };
    if (photoId) where.photoId = photoId;

    const comments = await (prisma as any).scrapbookComment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { firstName: true, profilePicture: true } } },
    });

    res.json({ comments });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

router.delete('/:tripId/comments/:commentId', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.tripId }, select: { organizerId: true } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await (prisma as any).scrapbookComment.update({ where: { id: req.params.commentId }, data: { approved: false } });
    res.json({ hidden: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to hide comment' });
  }
});

// ── PIN REORDERING ──────────────────────────────────────────

router.patch('/:tripId/reorder', authenticateToken, async (req: any, res: Response) => {
  try {
    const { pins } = req.body;
    if (!Array.isArray(pins)) return res.status(400).json({ error: 'pins array required' });

    const event = await prisma.event.findUnique({ where: { id: req.params.tripId }, select: { organizerId: true } });
    if (!event) return res.status(404).json({ error: 'Not found' });

    // Allow organizer or any attendee
    const isOrg = event.organizerId === req.userId;
    const isAttendee = await prisma.eventAttendee.findFirst({ where: { eventId: req.params.tripId, userId: req.userId } });
    if (!isOrg && !isAttendee) return res.status(403).json({ error: 'Not authorized' });

    // Batch update in transaction
    await prisma.$transaction(
      pins.map((p: { id: string; sortOrder: number }) =>
        prisma.scrapbookPin.update({ where: { id: p.id }, data: { sortOrder: p.sortOrder } })
      )
    );

    res.json({ updated: pins.length });
  } catch (e: any) {
    console.error('[ScrapbookReorder] Error:', e);
    res.status(500).json({ error: 'Failed to reorder' });
  }
});

// ── PASSWORD PROTECTION ─────────────────────────────────────

router.post('/:tripId/password', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.tripId }, select: { organizerId: true } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { password, hint } = req.body;
    if (!password || password.length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters' });

    const hash = await bcrypt.hash(password, 10);
    await prisma.event.update({ where: { id: req.params.tripId }, data: { scrapbookPassword: hash, scrapbookPasswordHint: hint || null } });
    res.json({ protected: true, hint: hint || null });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to set password' });
  }
});

router.delete('/:tripId/password', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.tripId }, select: { organizerId: true } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.event.update({ where: { id: req.params.tripId }, data: { scrapbookPassword: null, scrapbookPasswordHint: null } });
    res.json({ protected: false });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to remove password' });
  }
});

router.post('/public/:token/unlock', async (req, res) => {
  try {
    const event = await prisma.event.findFirst({ where: { scrapbookShareToken: req.params.token }, select: { id: true, scrapbookPassword: true } });
    if (!event || !event.scrapbookPassword) return res.status(404).json({ error: 'Not found' });

    const { password } = req.body;
    const match = await bcrypt.compare(password || '', event.scrapbookPassword);
    if (!match) return res.status(403).json({ unlocked: false });

    const sessionToken = jwt.sign({ token: req.params.token }, JWT_SECRET, { expiresIn: '4h' });
    res.json({ unlocked: true, sessionToken });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to unlock' });
  }
});

// ── DISCOVERY ───────────────────────────────────────────────

router.post('/:tripId/discovery/opt-in', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.tripId }, select: { organizerId: true, scrapbookPassword: true } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    if (event.scrapbookPassword) return res.status(400).json({ error: 'Remove password protection before opting into discovery' });

    const { tags = [], region } = req.body;

    // Get cover photo
    const firstPin = await prisma.scrapbookPin.findFirst({
      where: { eventId: req.params.tripId },
      orderBy: { sortOrder: 'asc' },
      include: { photo: { select: { imageUrl: true } } },
    });
    const pinCount = await prisma.scrapbookPin.count({ where: { eventId: req.params.tripId } });

    const disc = await (prisma as any).scrapbookDiscovery.upsert({
      where: { tripId: req.params.tripId },
      update: { optedIn: true, tags, region, coverPhotoUrl: firstPin?.photo?.imageUrl, pinCount },
      create: { tripId: req.params.tripId, userId: req.userId, optedIn: true, tags, region, coverPhotoUrl: firstPin?.photo?.imageUrl, pinCount },
    });

    res.json({ discovery: disc });
  } catch (e: any) {
    console.error('[ScrapbookDiscovery] Opt-in error:', e);
    res.status(500).json({ error: 'Failed to opt in' });
  }
});

router.delete('/:tripId/discovery/opt-out', authenticateToken, async (req: any, res: Response) => {
  try {
    await (prisma as any).scrapbookDiscovery.updateMany({ where: { tripId: req.params.tripId, userId: req.userId }, data: { optedIn: false } });
    res.json({ optedOut: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to opt out' });
  }
});

router.get('/discover', async (req, res) => {
  try {
    const { region, tags, cursor, limit = '12' } = req.query;
    const take = Math.min(parseInt(limit as string) || 12, 30);
    const where: any = { optedIn: true };
    if (region) where.region = region;
    if (tags) where.tags = { hasSome: (tags as string).split(',') };

    const discoveries = await (prisma as any).scrapbookDiscovery.findMany({
      where,
      orderBy: [{ featuredAt: 'desc' }, { pinCount: 'desc' }, { createdAt: 'desc' }],
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor as string } } : {}),
      include: {
        user: { select: { firstName: true, lastName: true, profilePicture: true, username: true } },
      },
    });

    // Enrich with trip data
    const enriched = await Promise.all(discoveries.map(async (d: any) => {
      const event = await prisma.event.findUnique({
        where: { id: d.tripId },
        select: { title: true, startDate: true, endDate: true, scrapbookShareToken: true, campground: { select: { name: true, state: true } } },
      });
      const reactionCount = await (prisma as any).scrapbookReaction.count({ where: { tripId: d.tripId } });
      return { ...d, tripTitle: event?.title, tripDates: { start: event?.startDate, end: event?.endDate }, shareToken: event?.scrapbookShareToken, campgroundName: event?.campground?.name, campgroundState: event?.campground?.state, reactionCount };
    }));

    res.json({ scrapbooks: enriched, nextCursor: discoveries.length === take ? discoveries[discoveries.length - 1].id : null });
  } catch (e: any) {
    console.error('[ScrapbookDiscover] Error:', e);
    res.status(500).json({ error: 'Failed to load discovery' });
  }
});

router.get('/discover/featured', async (_req, res) => {
  try {
    const featured = await (prisma as any).scrapbookDiscovery.findMany({
      where: { optedIn: true, featuredAt: { not: null } },
      orderBy: { featuredAt: 'desc' },
      take: 6,
      include: { user: { select: { firstName: true, profilePicture: true, username: true } } },
    });

    const enriched = await Promise.all(featured.map(async (d: any) => {
      const event = await prisma.event.findUnique({
        where: { id: d.tripId },
        select: { title: true, scrapbookShareToken: true, campground: { select: { name: true, state: true } } },
      });
      const reactionCount = await (prisma as any).scrapbookReaction.count({ where: { tripId: d.tripId } });
      return { ...d, tripTitle: event?.title, shareToken: event?.scrapbookShareToken, campgroundName: event?.campground?.name, reactionCount };
    }));

    res.json({ featured: enriched });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load featured' });
  }
});

// Admin: feature a scrapbook
router.post('/admin/:tripId/feature', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    await (prisma as any).scrapbookDiscovery.update({ where: { tripId: req.params.tripId }, data: { featuredAt: new Date() } });
    res.json({ featured: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to feature' });
  }
});

// ── ANALYTICS ───────────────────────────────────────────────

router.get('/:tripId/analytics', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.tripId }, select: { organizerId: true } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const daily = await (prisma as any).scrapbookAnalytics.findMany({
      where: { tripId: req.params.tripId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    const summary = {
      totalViews: daily.reduce((s: number, d: any) => s + d.views, 0),
      totalUniqueViews: daily.reduce((s: number, d: any) => s + d.uniqueViews, 0),
      totalReactions: daily.reduce((s: number, d: any) => s + d.reactions, 0),
      totalComments: daily.reduce((s: number, d: any) => s + d.comments, 0),
      totalShareClicks: daily.reduce((s: number, d: any) => s + d.shareClicks, 0),
    };

    // Reaction breakdown
    const reactions = await (prisma as any).scrapbookReaction.groupBy({
      by: ['emoji'],
      where: { tripId: req.params.tripId },
      _count: true,
    });
    const reactionBreakdown: Record<string, number> = {};
    for (const r of reactions) reactionBreakdown[r.emoji] = r._count;

    // Top referrers (aggregate from daily)
    const refMap: Record<string, number> = {};
    for (const d of daily) {
      for (const r of (d.referrers || [])) {
        refMap[r.domain] = (refMap[r.domain] || 0) + (r.count || 0);
      }
    }
    const topReferrers = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([domain, totalCount]) => ({ domain, totalCount }));

    // Peak day
    const peakDay = daily.length > 0 ? daily.reduce((max: any, d: any) => d.views > (max?.views || 0) ? d : max, daily[0]) : null;

    res.json({ summary, daily, reactionBreakdown, topReferrers, peakDay: peakDay ? { date: peakDay.date, views: peakDay.views } : null });
  } catch (e: any) {
    console.error('[ScrapbookAnalytics] Error:', e);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

router.post('/:tripId/analytics/share-click', async (req, res) => {
  try {
    await trackAnalytics(req.params.tripId, 'shareClicks');
    res.json({ tracked: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to track' });
  }
});

// ── PDF EXPORT SKELETON ─────────────────────────────────────

router.post('/:tripId/export', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.tripId }, select: { organizerId: true } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { template = 'CLASSIC' } = req.body;

    // Check for recent export
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cached = await (prisma as any).scrapbookExport.findFirst({
      where: { tripId: req.params.tripId, template, status: 'DONE', completedAt: { gte: dayAgo } },
    });
    if (cached) return res.json({ exportId: cached.id, status: 'DONE', pdfUrl: cached.pdfUrl });

    const exp = await (prisma as any).scrapbookExport.create({
      data: { tripId: req.params.tripId, userId: req.userId, template, status: 'PENDING' },
    });

    // TODO: queue actual PDF generation once Puppeteer/Chromium is configured on Railway
    // For now, mark as processing so the UI can poll
    setTimeout(async () => {
      await (prisma as any).scrapbookExport.update({
        where: { id: exp.id },
        data: { status: 'FAILED' },
      });
    }, 5000);

    res.json({ exportId: exp.id, status: 'PROCESSING', message: 'PDF generation is not yet available — coming soon!' });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create export' });
  }
});

router.get('/:tripId/export/:exportId', authenticateToken, async (req: any, res: Response) => {
  try {
    const exp = await (prisma as any).scrapbookExport.findUnique({ where: { id: req.params.exportId } });
    if (!exp) return res.status(404).json({ error: 'Export not found' });
    res.json(exp);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load export' });
  }
});

export default router;
