import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { syncTimelineItem, buildTimeline } from '../services/rigTimeline';

const router = Router();
const prisma = new PrismaClient() as any;

async function getRig(slug: string) {
  return prisma.rig.findUnique({ where: { slug }, select: { id: true, ownerId: true } });
}

// ═══ PULSE FEED (unified timeline) ═══
// Supports filter param: 'media' (photos+videos), 'build' (mods+maintenance), or all
router.get('/:slug/timeline', async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const limit = parseInt(req.query.limit) || 30;
    const filter = req.query.filter as string | undefined;

    const where: any = { rigId: rig.id };
    if (req.query.cursor) where.occurredAt = { lt: new Date(req.query.cursor) };

    // Apply filter for sub-views
    if (filter === 'media') where.itemType = { in: ['PHOTO_ALBUM', 'VIDEO'] };
    else if (filter === 'build') where.itemType = { in: ['MOD', 'MAINTENANCE'] };
    else if (filter === 'trips') where.tripId = { not: null };

    // Get all rig user IDs for co-pilot activity
    const [pilots, coPilots] = await Promise.all([
      prisma.rigPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
      prisma.rigCoPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
    ]);
    const rigUserIds = [...new Set([rig.ownerId, ...pilots.map((p: any) => p.userId), ...coPilots.map((c: any) => c.userId)])];

    const cursorDate = req.query.cursor ? new Date(req.query.cursor) : undefined;

    const [items, activeTrip, upcomingTrip, userAlbums, userCheckins] = await Promise.all([
      prisma.rigTimelineItem.findMany({ where, orderBy: { occurredAt: 'desc' }, take: limit }),
      prisma.rigTrip.findFirst({
        where: { rigId: rig.id, status: 'ACTIVE' },
        select: { id: true, name: true, startDate: true, totalMiles: true, totalNights: true, statesVisited: true, coverImageUrl: true, campgroundCount: true,
          stops: { orderBy: { order: 'desc' }, take: 1, select: { name: true, state: true, isCurrentStop: true } } },
      }),
      prisma.rigTrip.findFirst({
        where: { rigId: rig.id, status: 'ACTIVE', startDate: { gt: new Date() } },
        orderBy: { startDate: 'asc' },
        select: { id: true, name: true, startDate: true, coverImageUrl: true },
      }),
      // Co-pilot photo albums as feed items
      prisma.photoAlbum.findMany({
        where: {
          userId: { in: rigUserIds },
          NOT: { privacy: 'PRIVATE' },
          ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
        },
        select: { id: true, title: true, userId: true, createdAt: true, coverPhotoUrl: true,
          photos: { select: { imageUrl: true }, take: 12, orderBy: { createdAt: 'desc' } },
          _count: { select: { photos: true } },
          user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }).catch(() => []),
      // Recent check-ins by rig users
      prisma.checkIn.findMany({
        where: {
          userId: { in: rigUserIds },
          campgroundId: { not: null },
          ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
        },
        select: { id: true, userId: true, campgroundId: true, checkInDate: true, checkOutDate: true, createdAt: true, notes: true, tripId: true,
          campground: { select: { id: true, name: true, city: true, state: true, imageUrl: true } },
          user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        },
        orderBy: { checkInDate: 'desc' },
        take: 30,
      }).catch(() => []),
    ]);

    // Convert albums + checkins to timeline-compatible items
    const albumItems = (userAlbums || []).filter((a: any) => a._count.photos > 0).map((a: any) => ({
      id: `album-${a.id}`,
      rigId: rig.id,
      itemType: 'PHOTO_ALBUM',
      refId: a.id,
      refType: 'PhotoAlbum',
      title: `${a.user?.firstName || 'Someone'} shared ${a._count.photos} photos: ${a.title}`,
      previewImageUrl: a.photos?.[0]?.imageUrl || a.coverPhotoUrl,
      previewText: null,
      tripId: null,
      stopId: null,
      occurredAt: a.createdAt,
      createdAt: a.createdAt,
      _user: a.user,
      _photoCount: a._count.photos,
      _photos: a.photos?.map((p: any) => p.imageUrl) || [],
      _source: 'copilot_album',
    }));

    // Deduplicate check-ins: same campground + same day = one card
    const checkinsByKey = new Map<string, any>();
    for (const c of (userCheckins || []).filter((c: any) => c.campground)) {
      const dateKey = new Date(c.checkInDate || c.createdAt).toISOString().split('T')[0];
      const key = `${c.campgroundId}_${dateKey}`;
      if (!checkinsByKey.has(key)) {
        checkinsByKey.set(key, { ...c, _attendees: [c.user] });
      } else {
        // Merge: add this user as attendee
        const existing = checkinsByKey.get(key)!;
        if (c.user && !existing._attendees.some((a: any) => a.id === c.user.id)) {
          existing._attendees.push(c.user);
        }
      }
    }

    const checkinItems = Array.from(checkinsByKey.values()).map((c: any) => ({
      id: `checkin-${c.id}`,
      rigId: rig.id,
      itemType: 'CHECKIN',
      refId: c.id,
      refType: 'CheckIn',
      title: `Checked in at ${c.campground?.name}`,
      previewImageUrl: c.campground?.imageUrl,
      previewText: JSON.stringify({ campgroundId: c.campgroundId, city: c.campground?.city, state: c.campground?.state, checkOutDate: c.checkOutDate, tripId: c.tripId }),
      tripId: c.tripId || null,
      stopId: null,
      occurredAt: c.checkInDate || c.createdAt,
      createdAt: c.createdAt,
      _user: c.user,
      _attendees: c._attendees,
      _source: 'copilot_checkin',
    }));

    // Merge and deduplicate
    // First: existing timeline CHECKIN items by date key to avoid duplicates with synthetic ones
    const existingCheckinDates = new Set<string>();
    for (const item of items) {
      if (item.itemType === 'CHECKIN') {
        const dateKey = new Date(item.occurredAt).toISOString().split('T')[0];
        const title = (item.title || '').toLowerCase();
        existingCheckinDates.add(`${dateKey}_${title}`);
      }
    }

    const existingRefs = new Set(items.map((i: any) => `${i.refId}-${i.refType}`));
    const extraItems = [...albumItems, ...checkinItems].filter((i: any) => {
      if (existingRefs.has(`${i.refId}-${i.refType}`)) return false;
      // Also skip if a CHECKIN exists on the same date with same campground name
      if (i.itemType === 'CHECKIN') {
        const dateKey = new Date(i.occurredAt).toISOString().split('T')[0];
        const title = (i.title || '').toLowerCase();
        if (existingCheckinDates.has(`${dateKey}_${title}`)) return false;
      }
      return true;
    });

    const allItems = [...items, ...extraItems].sort(
      (a: any, b: any) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    ).slice(0, limit);

    // Enrich check-in items with photos from the campground stay
    try {
      const checkinItemsToEnrich = allItems.filter((i: any) => i.itemType === 'CHECKIN');
      for (const item of checkinItemsToEnrich) {
        // Parse campgroundId from previewText or refId
        let campgroundId: string | null = null;
        try {
          const d = JSON.parse(item.previewText || '{}');
          campgroundId = d.campgroundId || null;
        } catch {}

        // For synthetic checkins, get campgroundId from the original CheckIn record
        if (!campgroundId && item._source === 'copilot_checkin' && item.refId) {
          try {
            const ci = await prisma.checkIn.findUnique({ where: { id: item.refId }, select: { campgroundId: true } });
            campgroundId = ci?.campgroundId || null;
          } catch {}
        }

        if (!campgroundId) continue;

        const stayDate = new Date(item.occurredAt);
        const stayStart = new Date(stayDate.getTime() - 24 * 60 * 60 * 1000);
        const stayEnd = new Date(stayDate.getTime() + 14 * 24 * 60 * 60 * 1000);

        // Get photos from: StateVisit at this campground + user albums around this date + tagged photos
        const [stateVisitPhotos, userPhotos, albumPhotos] = await Promise.all([
          prisma.stateVisit.findMany({
            where: { userId: { in: rigUserIds }, campsiteId: campgroundId, photoUrls: { isEmpty: false } },
            select: { photoUrls: true },
            take: 5,
          }).catch(() => []),
          prisma.photo.findMany({
            where: {
              userId: { in: rigUserIds },
              createdAt: { gte: stayStart, lte: stayEnd },
              isPrivate: false,
              NOT: { visibility: 'PRIVATE' },
            },
            select: { imageUrl: true },
            orderBy: { createdAt: 'desc' },
            take: 12,
          }).catch(() => []),
          prisma.photoAlbum.findMany({
            where: {
              userId: { in: rigUserIds },
              NOT: { privacy: 'PRIVATE' },
              createdAt: { gte: stayStart, lte: stayEnd },
            },
            select: { photos: { select: { imageUrl: true }, take: 12, orderBy: { createdAt: 'desc' } } },
            take: 3,
          }).catch(() => []),
        ]);

        const stayPhotos: string[] = [];
        const seen = new Set<string>();
        // Add stateVisit photos
        for (const sv of stateVisitPhotos) {
          for (const url of (sv.photoUrls || [])) { if (!seen.has(url)) { seen.add(url); stayPhotos.push(url); } }
        }
        // Add direct photos
        for (const p of userPhotos) { if (!seen.has(p.imageUrl)) { seen.add(p.imageUrl); stayPhotos.push(p.imageUrl); } }
        // Add album photos
        for (const a of albumPhotos) {
          for (const p of (a.photos || [])) { if (!seen.has(p.imageUrl)) { seen.add(p.imageUrl); stayPhotos.push(p.imageUrl); } }
        }

        if (stayPhotos.length > 0) {
          (item as any)._stayPhotos = stayPhotos.slice(0, 12);
          (item as any)._stayPhotoCount = stayPhotos.length;
        }
      }
    } catch (e: any) { console.error('[RigTimeline] photo enrichment error:', e.message); }

    res.json({
      items: allItems,
      nextCursor: allItems.length === limit ? allItems[allItems.length - 1].occurredAt.toISOString() : null,
      activeTrip: activeTrip || null,
      upcomingTrip: upcomingTrip || null,
    });
  } catch (e: any) { console.error('[RigTimeline] error:', e.message); res.status(500).json({ error: e.message }); }
});

router.post('/:slug/timeline/sync', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const result = await buildTimeline(rig.id);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ STORIES ═══
router.get('/:slug/stories', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const stories = await prisma.rigStory.findMany({ where: { rigId: rig.id, isPublished: true }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } } }); res.json(stories); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/stories', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const story = await prisma.rigStory.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } });
    syncTimelineItem('STORY', story.id, rig.id, { title: story.title, previewImageUrl: story.coverImageUrl, previewText: story.body?.slice(0, 100), occurredAt: story.createdAt });
    res.status(201).json(story);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/stories/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigStory.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/stories/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigStory.delete({ where: { id: req.params.id } }); await prisma.rigTimelineItem.deleteMany({ where: { rigId: rig.id, refId: req.params.id } }).catch(() => {}); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.post('/:slug/stories/:id/like', authenticateToken, async (req: any, res) => { try { await prisma.rigStory.update({ where: { id: req.params.id }, data: { likes: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ RECIPES ═══
router.get('/:slug/recipes', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const where: any = { rigId: rig.id }; if (req.query.method) where.cookingMethod = req.query.method; if (req.query.difficulty) where.difficulty = req.query.difficulty; const recipes = await prisma.rigRecipe.findMany({ where, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, firstName: true, profilePicture: true } } } }); res.json(recipes); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/recipes', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const recipe = await prisma.rigRecipe.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } });
    syncTimelineItem('RECIPE', recipe.id, rig.id, { title: recipe.title, previewImageUrl: recipe.photoUrls?.[0], previewText: recipe.description?.slice(0, 100), occurredAt: recipe.createdAt });
    res.status(201).json(recipe);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/recipes/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigRecipe.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/recipes/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigRecipe.delete({ where: { id: req.params.id } }); await prisma.rigTimelineItem.deleteMany({ where: { rigId: rig.id, refId: req.params.id } }).catch(() => {}); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.post('/:slug/recipes/:id/like', authenticateToken, async (req: any, res) => { try { await prisma.rigRecipe.update({ where: { id: req.params.id }, data: { likes: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.post('/:slug/recipes/:id/save', authenticateToken, async (req: any, res) => { try { await prisma.rigRecipe.update({ where: { id: req.params.id }, data: { saves: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ MEMORIES ═══
router.get('/:slug/memories', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const where: any = { rigId: rig.id }; if (req.query.pinned === 'true') where.isPinned = true; const memories = await prisma.rigMemory.findMany({ where, orderBy: [{ isPinned: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }] }); res.json(memories); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/memories', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const memory = await prisma.rigMemory.create({ data: { rigId: rig.id, userId: req.userId, ...req.body, date: req.body.date ? new Date(req.body.date) : null } });
    syncTimelineItem('MEMORY', memory.id, rig.id, { title: memory.title, previewImageUrl: memory.photoUrls?.[0], previewText: memory.description?.slice(0, 100), occurredAt: memory.date || memory.createdAt });
    res.status(201).json(memory);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/memories/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigMemory.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/memories/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigMemory.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.post('/:slug/memories/:id/pin', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const m = await prisma.rigMemory.findUnique({ where: { id: req.params.id } }); res.json(await prisma.rigMemory.update({ where: { id: req.params.id }, data: { isPinned: !m?.isPinned, order: req.body.order || 0 } })); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ JOURNAL ═══
router.get('/:slug/journal', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const entries = await prisma.rigJournalEntry.findMany({ where: { rigId: rig.id, isPublic: true }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, firstName: true, profilePicture: true } } } }); res.json(entries); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/journal', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const entry = await prisma.rigJournalEntry.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } });
    syncTimelineItem('JOURNAL', entry.id, rig.id, { title: entry.title, previewImageUrl: entry.coverImageUrl, previewText: entry.body?.slice(0, 100), occurredAt: entry.createdAt });
    res.status(201).json(entry);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/journal/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigJournalEntry.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/journal/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigJournalEntry.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ CHECKLISTS ═══
router.get('/:slug/checklists', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const lists = await prisma.rigChecklist.findMany({ where: { rigId: rig.id, isPublic: true }, orderBy: { createdAt: 'desc' } }); res.json(lists); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/checklists', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const cl = await prisma.rigChecklist.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } }); res.status(201).json(cl); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/checklists/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigChecklist.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/checklists/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigChecklist.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ CO-PILOTS ═══
router.get('/:slug/copilots', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const copilots = await prisma.rigCoPilot.findMany({ where: { rigId: rig.id }, include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } }, orderBy: { joinedAt: 'asc' } }); res.json(copilots); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/copilots', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    let targetId = req.body.userId;
    if (!targetId && req.body.username) { const u = await prisma.user.findUnique({ where: { username: req.body.username }, select: { id: true } }); targetId = u?.id; }
    if (!targetId) return res.status(400).json({ error: 'User not found' });
    const cp = await prisma.rigCoPilot.create({ data: { rigId: rig.id, userId: targetId, role: req.body.role || 'COPILOT' }, include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } } });
    res.status(201).json(cp);
  } catch (e: any) { if (e.code === 'P2002') return res.status(400).json({ error: 'Already a co-pilot' }); res.status(500).json({ error: e.message }); }
});
router.put('/:slug/copilots/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigCoPilot.update({ where: { id: req.params.id }, data: { role: req.body.role } })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/copilots/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigCoPilot.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ RIG STORY BIO ═══
router.put('/:slug/story', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rig.update({ where: { id: rig.id }, data: { story: req.body.story, storyUpdatedAt: new Date() } })); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ ROUTE MAP DATA ═══
router.get('/:slug/routemap', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, totalStatesVisited: true, totalMilesAllTime: true, totalNightsAllTime: true, totalCampgroundsAllTime: true, totalMilesDriven: true, totalStatesCount: true, totalNightsCamped: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const stops = await prisma.rigTripStop.findMany({ where: { rigId: rig.id, lat: { not: null } }, select: { lat: true, lng: true, name: true, campgroundId: true, state: true }, orderBy: { arrivedAt: 'asc' } });
    const routes = stops.slice(1).map((s: any, i: number) => ({ fromLat: stops[i].lat, fromLng: stops[i].lng, toLat: s.lat, toLng: s.lng }));
    const statesVisited = [...new Set(stops.map((s: any) => s.state).filter(Boolean))];
    res.json({
      statesVisited, routes,
      campgroundsVisited: stops.filter((s: any) => s.campgroundId).map((s: any) => ({ name: s.name, lat: s.lat, lng: s.lng })),
      stats: { totalMiles: rig.totalMilesAllTime || rig.totalMilesDriven || 0, totalNights: rig.totalNightsAllTime || rig.totalNightsCamped || 0, totalStates: statesVisited.length || rig.totalStatesCount || 0, totalCampgrounds: rig.totalCampgroundsAllTime || 0 },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ ADMIN: SYNC ALL TIMELINES ═══
router.post('/admin/sync-timelines', authenticateToken, async (req: any, res) => {
  try {
    const rigs = await prisma.rig.findMany({ select: { id: true } });
    for (const rig of rigs) await buildTimeline(rig.id).catch(() => {});
    res.json({ synced: rigs.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
