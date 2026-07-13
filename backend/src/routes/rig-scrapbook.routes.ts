import { Router, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { syncTimelineItem, buildTimeline } from '../services/rigTimeline';

const router = Router();
import { prisma } from '../lib/prisma';

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

    // Deduplicate check-ins: merge all check-ins at the SAME campground whose dates
    // are adjacent or overlapping into ONE card per stay (not one card per day).
    const checkinsByCampground = new Map<string, any[]>();
    for (const c of (userCheckins || []).filter((c: any) => c.campground && c.campgroundId)) {
      const key = c.campgroundId as string;
      const list = checkinsByCampground.get(key) || [];
      list.push(c);
      checkinsByCampground.set(key, list);
    }

    const mergedCheckins: any[] = [];
    for (const [campgroundId, group] of checkinsByCampground) {
      // Sort by check-in date ascending
      group.sort((a: any, b: any) => new Date(a.checkInDate || a.createdAt).getTime() - new Date(b.checkInDate || b.createdAt).getTime());

      // Merge adjacent stays (within 3 days)
      const stays: any[] = [];
      for (const c of group) {
        const ciDate = new Date(c.checkInDate || c.createdAt).getTime();
        const coDate = c.checkOutDate ? new Date(c.checkOutDate).getTime() : ciDate;
        const last = stays[stays.length - 1];

        if (last && ciDate <= last._endDate + 3 * 86400000) {
          // Merge into existing stay: extend end date
          if (coDate > last._endDate) last._endDate = coDate;
          if (c.checkOutDate && (!last.checkOutDate || new Date(c.checkOutDate) > new Date(last.checkOutDate))) {
            last.checkOutDate = c.checkOutDate;
          }
          // Add attendee
          if (c.user && !last._attendees.some((a: any) => a.id === c.user.id)) {
            last._attendees.push(c.user);
          }
          // Keep the earliest tripId
          if (!last.tripId && c.tripId) last.tripId = c.tripId;
        } else {
          // New stay
          stays.push({
            ...c,
            _startDate: ciDate,
            _endDate: coDate,
            _attendees: [c.user],
          });
        }
      }

      mergedCheckins.push(...stays);
    }

    const checkinItems = mergedCheckins.map((c: any) => {
      const startDate = new Date(c._startDate);
      const endDate = new Date(c._endDate);
      const nights = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
      const dateRange = startDate.getTime() === endDate.getTime()
        ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      return {
        id: `checkin-${c.id}`,
        rigId: rig.id,
        itemType: 'CHECKIN',
        refId: c.id,
        refType: 'CheckIn',
        title: c.campground?.name || 'Campground',
        previewImageUrl: c.campground?.imageUrl,
        // Read city/state from the campground record (source of truth), not a snapshot
        previewText: JSON.stringify({
          campgroundId: c.campgroundId,
          city: c.campground?.city,
          state: c.campground?.state,
          checkOutDate: c.checkOutDate,
          tripId: c.tripId,
          nights,
          dateRange,
        }),
        tripId: c.tripId || null,
        stopId: null,
        occurredAt: c.checkInDate || c.createdAt,
        createdAt: c.createdAt,
        _user: c.user,
        _attendees: c._attendees,
        _source: 'copilot_checkin',
      };
    });

    // Reviews by rig crew → feed cards
    let reviewItems: any[] = [];
    try {
      const reviews = await prisma.campgroundReview.findMany({
        where: { userId: { in: rigUserIds } },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } },
          campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true } },
          place: { select: { id: true, name: true, category: true, city: true, state: true, address: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      reviewItems = reviews.map((r: any) => {
        const target = r.place || r.campground;
        const targetName = target?.name || 'a place';
        const location = [target?.city, target?.state].filter(Boolean).join(', ');
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        return {
          id: `review-${r.id}`,
          rigId: rig.id,
          itemType: 'REVIEW',
          refId: r.id,
          refType: 'CampgroundReview',
          title: `${r.user?.firstName || 'Someone'} rated ${targetName} ${stars}`,
          previewImageUrl: target?.imageUrl || null,
          previewText: JSON.stringify({
            rating: r.rating,
            review: r.review?.slice(0, 200),
            campgroundId: r.campgroundId,
            placeId: r.placeId,
            targetName,
            location,
          }),
          tripId: null,
          stopId: null,
          occurredAt: r.createdAt,
          createdAt: r.createdAt,
          _user: r.user,
          _source: 'copilot_review',
        };
      });
    } catch (e: any) { console.error('[RigTimeline] review fetch error:', e.message); }

    // Merge and deduplicate: prefer the merged checkin items over per-day timeline items
    // Build a set of campground IDs covered by our merged checkin items
    const mergedCampgroundIds = new Set<string>();
    for (const ci of checkinItems) {
      try {
        const d = JSON.parse(ci.previewText || '{}');
        if (d.campgroundId) mergedCampgroundIds.add(d.campgroundId);
      } catch {}
    }

    // Filter out existing timeline CHECKIN items that are now covered by merged cards
    const filteredItems = items.filter((item: any) => {
      if (item.itemType !== 'CHECKIN') return true;
      // Check if this timeline CHECKIN is at a campground we already merged
      try {
        const d = JSON.parse(item.previewText || '{}');
        if (d.campgroundId && mergedCampgroundIds.has(d.campgroundId)) return false;
      } catch {}
      // Also check by title match
      const title = (item.title || '').toLowerCase();
      for (const ci of checkinItems) {
        if ((ci.title || '').toLowerCase() === title.replace('checked in at ', '').replace('checked into ', '')) return false;
      }
      return true;
    });

    const existingRefs = new Set(filteredItems.map((i: any) => `${i.refId}-${i.refType}`));
    const extraItems = [...albumItems, ...checkinItems, ...reviewItems].filter((i: any) => {
      if (existingRefs.has(`${i.refId}-${i.refType}`)) return false;
      return true;
    });

    const allItems = [...filteredItems, ...extraItems].sort(
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

        // Parse tripId/eventId and checkout date from previewText
        let tripId: string | null = null;
        let checkOutDate: Date | null = null;
        try {
          const d = JSON.parse(item.previewText || '{}');
          tripId = d.tripId || null;
          if (d.checkOutDate) checkOutDate = new Date(d.checkOutDate);
        } catch {}

        // Also check the Event linked to this campground for this user
        let eventIds: string[] = [];
        if (tripId) eventIds.push(tripId);
        try {
          const events = await prisma.event.findMany({
            where: { campgroundId, OR: [{ organizerId: { in: rigUserIds } }, { attendees: { some: { userId: { in: rigUserIds } } } }] },
            select: { id: true },
          });
          for (const e of events) { if (!eventIds.includes(e.id)) eventIds.push(e.id); }
        } catch {}

        const stayDate = new Date(item.occurredAt);
        const stayStart = new Date(stayDate.getTime() - 24 * 60 * 60 * 1000);
        const stayEnd = checkOutDate
          ? new Date(checkOutDate.getTime() + 3 * 24 * 60 * 60 * 1000)
          : new Date(stayDate.getTime() + 14 * 24 * 60 * 60 * 1000);

        // Get photos from: trip/event linkage (most reliable), StateVisit, date-range fallback, albums
        const [tripPhotos, stateVisitPhotos, datePhotos, albumPhotos] = await Promise.all([
          // Photos linked to the trip event (works regardless of upload date)
          eventIds.length > 0 ? prisma.photo.findMany({
            where: { eventId: { in: eventIds }, isPrivate: false, NOT: { visibility: 'PRIVATE' } },
            select: { imageUrl: true },
            orderBy: { createdAt: 'desc' },
            take: 12,
          }).catch(() => []) : Promise.resolve([]),
          prisma.stateVisit.findMany({
            where: { userId: { in: rigUserIds }, campsiteId: campgroundId, photoUrls: { isEmpty: false } },
            select: { photoUrls: true },
            take: 5,
          }).catch(() => []),
          // Date-range fallback (catches photos uploaded during the stay)
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
        // Add trip-linked photos first (most reliable — works regardless of upload date)
        for (const p of tripPhotos) { if (!seen.has(p.imageUrl)) { seen.add(p.imageUrl); stayPhotos.push(p.imageUrl); } }
        // Add stateVisit photos
        for (const sv of stateVisitPhotos) {
          for (const url of (sv.photoUrls || [])) { if (!seen.has(url)) { seen.add(url); stayPhotos.push(url); } }
        }
        // Add date-range photos
        for (const p of datePhotos) { if (!seen.has(p.imageUrl)) { seen.add(p.imageUrl); stayPhotos.push(p.imageUrl); } }
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
