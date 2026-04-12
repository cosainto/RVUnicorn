import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { sendWebPush } from '../utils/webPush';
import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET /api/scrapbook/:eventId - Get all pinned photos for a trip
router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const pins = await prisma.scrapbookPin.findMany({
      where: { eventId },
      include: {
        photo: {
          select: {
            id: true,
            imageUrl: true,
            caption: true,
            createdAt: true,
            user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          },
        },
        pinnedBy: { select: { id: true, username: true, firstName: true, profilePicture: true } },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(pins);
  } catch (error) {
    console.error('Get scrapbook error:', error);
    res.status(500).json({ error: 'Failed to fetch scrapbook' });
  }
});

// GET /api/scrapbook/:eventId/photos - Get all event photos available to pin
router.get('/:eventId/photos', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const photos = await prisma.photo.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        scrapbookPins: { where: { eventId }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(photos);
  } catch (error) {
    console.error('Get event photos error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST /api/scrapbook/:eventId/pin - Pin a photo to the scrapbook
router.post('/:eventId/pin', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    const { photoId, caption } = req.body;

    if (!photoId) return res.status(400).json({ error: 'photoId is required' });

    // Verify user is an attendee or organizer
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const isAttendee = event.organizerId === userId || await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!isAttendee) return res.status(403).json({ error: 'Must be a trip attendee to pin photos' });

    // Enforce 15-pin limit
    const pinCount = await prisma.scrapbookPin.count({ where: { eventId } });
    if (pinCount >= 15) return res.status(400).json({ error: 'Scrapbook is full — remove a pin to add another (max 15)' });

    // Get current max position
    const maxPos = await prisma.scrapbookPin.aggregate({
      where: { eventId },
      _max: { position: true },
    });

    const pin = await prisma.scrapbookPin.create({
      data: {
        eventId,
        photoId,
        pinnedById: userId,
        caption: caption || null,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        photo: {
          select: {
            id: true,
            imageUrl: true,
            caption: true,
            createdAt: true,
            user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          },
        },
        pinnedBy: { select: { id: true, username: true, firstName: true, profilePicture: true } },
      },
    });

    res.json(pin);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Photo already pinned' });
    console.error('Pin photo error:', error);
    res.status(500).json({ error: 'Failed to pin photo' });
  }
});

// DELETE /api/scrapbook/:eventId/pin/:photoId - Unpin a photo
router.delete('/:eventId/pin/:photoId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId, photoId } = req.params;

    const pin = await prisma.scrapbookPin.findUnique({
      where: { eventId_photoId: { eventId, photoId } },
    });
    if (!pin) return res.status(404).json({ error: 'Pin not found' });

    // Only the pinner or organizer can unpin
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
    if (pin.pinnedById !== userId && event?.organizerId !== userId) {
      return res.status(403).json({ error: 'Cannot unpin someone else\'s photo' });
    }

    await prisma.scrapbookPin.delete({ where: { eventId_photoId: { eventId, photoId } } });
    res.json({ message: 'Photo unpinned' });
  } catch (error) {
    console.error('Unpin photo error:', error);
    res.status(500).json({ error: 'Failed to unpin photo' });
  }
});

// PATCH /api/scrapbook/:eventId/pin/:photoId - Update caption
router.patch('/:eventId/pin/:photoId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId, photoId } = req.params;
    const { caption } = req.body;

    const pin = await prisma.scrapbookPin.findUnique({
      where: { eventId_photoId: { eventId, photoId } },
    });
    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    if (pin.pinnedById !== userId) return res.status(403).json({ error: 'Not your pin' });

    const updated = await prisma.scrapbookPin.update({
      where: { eventId_photoId: { eventId, photoId } },
      data: { caption },
    });
    res.json(updated);
  } catch (error) {
    console.error('Update pin error:', error);
    res.status(500).json({ error: 'Failed to update pin' });
  }
});

// ── MOMENT TAGS ─────────────────────────────────────────────

// PATCH /api/scrapbook/:eventId/pin/:photoId/tag
router.patch('/:eventId/pin/:photoId/tag', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId, photoId } = req.params;
    const { momentTag } = req.body;

    const pin = await prisma.scrapbookPin.findUnique({ where: { eventId_photoId: { eventId, photoId } } });
    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    if (pin.pinnedById !== userId) {
      const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
      if (event?.organizerId !== userId) return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.scrapbookPin.update({
      where: { eventId_photoId: { eventId, photoId } },
      data: { momentTag: momentTag || null },
    });
    res.json(updated);
  } catch (e) {
    console.error('Update moment tag error:', e);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// ── PUBLIC SHARING ──────────────────────────────────────────

// POST /api/scrapbook/:eventId/share
router.post('/:eventId/share', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true, scrapbookShareToken: true } });
    if (!event || event.organizerId !== userId) return res.status(403).json({ error: 'Not authorized' });

    if (event.scrapbookShareToken) {
      return res.json({ shareUrl: `https://www.rvunicorn.com/s/${event.scrapbookShareToken}` });
    }

    const token = nanoid(10);
    await prisma.event.update({ where: { id: eventId }, data: { scrapbookPublic: true, scrapbookShareToken: token } });
    res.json({ shareUrl: `https://www.rvunicorn.com/s/${token}` });
  } catch (e) {
    console.error('Share scrapbook error:', e);
    res.status(500).json({ error: 'Failed to share' });
  }
});

// DELETE /api/scrapbook/:eventId/share
router.delete('/:eventId/share', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
    if (!event || event.organizerId !== userId) return res.status(403).json({ error: 'Not authorized' });

    await prisma.event.update({ where: { id: eventId }, data: { scrapbookPublic: false, scrapbookShareToken: null } });
    res.json({ success: true });
  } catch (e) {
    console.error('Unshare scrapbook error:', e);
    res.status(500).json({ error: 'Failed to unshare' });
  }
});

// GET /api/scrapbook/public/:token — NO AUTH (with password check)
router.get('/public/:token', async (req, res) => {
  try {
    const event = await prisma.event.findFirst({
      where: { scrapbookShareToken: req.params.token, scrapbookPublic: true },
      select: {
        id: true, title: true, startDate: true, endDate: true,
        scrapbookPassword: true, scrapbookPasswordHint: true,
        organizer: { select: { firstName: true, lastName: true, profilePicture: true, rvMake: true, rvYear: true } },
        campground: { select: { name: true, state: true } },
        scrapbookPins: {
          include: {
            photo: { select: { id: true, imageUrl: true, caption: true } },
            pinnedBy: { select: { firstName: true, profilePicture: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Scrapbook not found' });

    // Password check
    if (event.scrapbookPassword) {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        try {
          const jwt = require('jsonwebtoken');
          jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'rvunicorn-secret');
        } catch {
          return res.status(401).json({ passwordRequired: true, hint: event.scrapbookPasswordHint });
        }
      } else {
        return res.status(401).json({ passwordRequired: true, hint: event.scrapbookPasswordHint });
      }
    }

    // Track analytics view
    const today = new Date(); today.setHours(0, 0, 0, 0);
    try {
      await (prisma as any).scrapbookAnalytics.upsert({
        where: { tripId_date: { tripId: event.id, date: today } },
        update: { views: { increment: 1 } },
        create: { tripId: event.id, date: today, views: 1 },
      });
    } catch {}

    res.json({
      tripTitle: event.title,
      tripDates: { start: event.startDate, end: event.endDate },
      ownerName: `${event.organizer.firstName} ${event.organizer.lastName || ''}`.trim(),
      ownerAvatarUrl: event.organizer.profilePicture,
      rigMake: event.organizer.rvMake,
      rigYear: event.organizer.rvYear,
      campgroundName: event.campground?.name,
      campgroundState: event.campground?.state,
      pins: event.scrapbookPins.map((p: any) => ({
        photoId: p.photo.id,
        photoUrl: p.photo.imageUrl,
        caption: p.caption || p.photo.caption,
        momentTag: p.momentTag,
        mediaType: p.mediaType || 'PHOTO',
        videoUrl: p.videoUrl,
        videoDuration: p.videoDuration,
        videoThumbUrl: p.videoThumbUrl,
        pinnedByName: p.pinnedBy.firstName,
        pinnedByAvatar: p.pinnedBy.profilePicture,
      })),
      totalPins: event.scrapbookPins.length,
    });
  } catch (e) {
    console.error('Public scrapbook error:', e);
    res.status(500).json({ error: 'Failed to load scrapbook' });
  }
});

// ── HITCH PIN SUGGESTIONS ───────────────────────────────────

router.post('/:eventId/suggest', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;

    // Check for cached recent suggestions
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cached = await (prisma as any).scrapbookSuggestion.findMany({
      where: { eventId, userId, createdAt: { gte: dayAgo } },
    });
    if (cached.length > 0) {
      const photos = await prisma.photo.findMany({
        where: { id: { in: cached.map((s: any) => s.photoId) } },
        select: { id: true, imageUrl: true, caption: true },
      });
      const photoMap = Object.fromEntries(photos.map(p => [p.id, p]));
      return res.json({
        suggestions: cached.map((s: any) => ({ ...s, photo: photoMap[s.photoId] })),
      });
    }

    // Fetch all event photos
    const photos = await prisma.photo.findMany({
      where: { eventId },
      include: {
        likes: { select: { id: true } },
        scrapbookPins: { where: { eventId }, select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    // Exclude already-pinned photos
    const unpinned = photos.filter(p => p.scrapbookPins.length === 0);
    if (unpinned.length === 0) return res.json({ suggestions: [] });

    // Score photos
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, startDate: true, endDate: true, campground: { select: { name: true } } },
    });
    const tripStart = event?.startDate ? new Date(event.startDate).getTime() : 0;
    const tripEnd = event?.endDate ? new Date(event.endDate).getTime() : Date.now();
    const tripDuration = tripEnd - tripStart || 1;

    const scored = unpinned.map(p => {
      let score = 0;
      // Engagement
      score += Math.min(3, (p.likes?.length || 0));
      // Time distribution (divide into thirds)
      const photoTime = new Date(p.createdAt).getTime();
      const third = Math.floor(((photoTime - tripStart) / tripDuration) * 3);
      score += 1; // base presence
      return { ...p, score, third };
    });

    // Ensure time distribution
    const byThird: Record<number, typeof scored> = { 0: [], 1: [], 2: [] };
    scored.forEach(p => { const t = Math.min(2, Math.max(0, p.third)); byThird[t].push(p); });
    for (const t of [0, 1, 2]) byThird[t].sort((a, b) => b.score - a.score);

    // Select up to 8: 2-3 from each third
    const selected: typeof scored = [];
    for (const t of [0, 1, 2]) {
      const take = t === 1 ? 3 : 2;
      selected.push(...byThird[t].slice(0, take));
    }
    // Fill remaining from highest scored
    if (selected.length < 8) {
      const remaining = scored.filter(p => !selected.find(s => s.id === p.id)).sort((a, b) => b.score - a.score);
      selected.push(...remaining.slice(0, 8 - selected.length));
    }
    const final = selected.slice(0, 8);

    // Ask Hitch for reasons
    let reasons: Record<string, string> = {};
    try {
      const photoData = final.map(p => ({ photoId: p.id, uploadedAt: p.createdAt, campgroundName: event?.campground?.name, likeCount: p.likes?.length || 0 }));
      const aiRes = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'You are Hitch, a warm RV travel mentor. Write a short reason (max 8 words) why each photo is worth pinning. Be concrete. Return ONLY JSON: [{"photoId":"...","reason":"..."}]',
        messages: [{ role: 'user', content: `Trip: ${event?.title}. Photos: ${JSON.stringify(photoData)}` }],
      });
      const text = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        for (const r of parsed) reasons[r.photoId] = r.reason;
      }
    } catch {}

    // Save suggestions
    const suggestions = [];
    for (const p of final) {
      const suggestion = await (prisma as any).scrapbookSuggestion.create({
        data: { eventId, userId, photoId: p.id, reason: reasons[p.id] || 'Great shot from your trip' },
      });
      suggestions.push({ ...suggestion, photo: { id: p.id, imageUrl: p.imageUrl, caption: p.caption } });
    }

    res.json({ suggestions });
  } catch (e) {
    console.error('Suggest pins error:', e);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// POST /api/scrapbook/:eventId/suggest/:photoId/accept
router.post('/:eventId/suggest/:photoId/accept', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId, photoId } = req.params;

    // Check pin limit
    const pinCount = await prisma.scrapbookPin.count({ where: { eventId } });
    if (pinCount >= 15) return res.status(400).json({ error: 'Scrapbook is full — remove a pin to add another (max 15)' });

    // Pin the photo
    const maxPos = await prisma.scrapbookPin.aggregate({ where: { eventId }, _max: { position: true } });
    const pin = await prisma.scrapbookPin.create({
      data: { eventId, photoId, pinnedById: userId, position: (maxPos._max.position ?? -1) + 1 },
      include: {
        photo: { select: { id: true, imageUrl: true, caption: true, createdAt: true, user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } } },
        pinnedBy: { select: { id: true, username: true, firstName: true, profilePicture: true } },
      },
    });

    // Mark suggestion accepted
    await (prisma as any).scrapbookSuggestion.updateMany({
      where: { eventId, userId, photoId },
      data: { accepted: true },
    });

    res.json(pin);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Already pinned' });
    console.error('Accept suggestion error:', e);
    res.status(500).json({ error: 'Failed to accept suggestion' });
  }
});

// POST /api/scrapbook/:eventId/suggest/:photoId/dismiss
router.post('/:eventId/suggest/:photoId/dismiss', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId, photoId } = req.params;
    await (prisma as any).scrapbookSuggestion.updateMany({
      where: { eventId, userId, photoId },
      data: { accepted: false },
    });
    res.json({ dismissed: true });
  } catch (e) {
    console.error('Dismiss suggestion error:', e);
    res.status(500).json({ error: 'Failed to dismiss' });
  }
});

// POST /api/scrapbook/:eventId/suggest/accept-all
router.post('/:eventId/suggest/accept-all', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;

    const pending = await (prisma as any).scrapbookSuggestion.findMany({
      where: { eventId, userId, accepted: null },
    });

    let pinned = 0;
    let skipped = 0;
    for (const s of pending) {
      const pinCount = await prisma.scrapbookPin.count({ where: { eventId } });
      if (pinCount >= 15) { skipped++; continue; }

      try {
        const maxPos = await prisma.scrapbookPin.aggregate({ where: { eventId }, _max: { position: true } });
        await prisma.scrapbookPin.create({
          data: { eventId, photoId: s.photoId, pinnedById: userId, position: (maxPos._max.position ?? -1) + 1 },
        });
        await (prisma as any).scrapbookSuggestion.update({ where: { id: s.id }, data: { accepted: true } });
        pinned++;
      } catch { skipped++; }
    }

    res.json({ pinned, skipped });
  } catch (e) {
    console.error('Accept all error:', e);
    res.status(500).json({ error: 'Failed to accept all' });
  }
});

// ── PIN LIMIT ENFORCEMENT ───────────────────────────────────
// Update the existing pin endpoint to enforce the 15-pin limit
// (This is handled by checking count before creating — already
// enforced in the suggest/accept endpoints above. The original
// POST /:eventId/pin should also enforce it.)

export default router;
