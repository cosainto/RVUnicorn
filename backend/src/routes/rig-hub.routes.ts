import { Router, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { queueForDigest } from '../services/emailThrottle';

const router = Router();
import { prisma } from '../lib/prisma';

// Helper: get rig + check owner
async function getRig(slug: string) {
  return prisma.rig.findUnique({ where: { slug }, select: { id: true, ownerId: true, slug: true } });
}

// ═══ VIDEOS ═══
router.get('/:slug/videos', async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const where: any = { rigId: rig.id };
    if (req.query.type) where.videoType = req.query.type;
    if (req.query.tripId) where.tripId = req.query.tripId;
    const videos = await prisma.rigVideo.findMany({ where, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } } });
    res.json(videos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/videos', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const video = await prisma.rigVideo.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } });
    res.status(201).json(video);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/videos/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const v = await prisma.rigVideo.update({ where: { id: req.params.id }, data: req.body }); res.json(v); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:slug/videos/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigVideo.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/videos/:id/view', async (req: any, res) => {
  try { await prisma.rigVideo.update({ where: { id: req.params.id }, data: { views: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ CAMPSITE VISITS ═══
router.get('/:slug/campsites', async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const where: any = { rigId: rig.id, isPrivate: false };
    if (req.query.favorite === 'true') where.isFavorite = true;
    const visits = await prisma.rigCampsiteVisit.findMany({ where, orderBy: { visitedAt: 'desc' } });
    res.json(visits);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/campsites', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const visit = await prisma.rigCampsiteVisit.create({ data: { rigId: rig.id, userId: req.userId, ...req.body, visitedAt: req.body.visitedAt ? new Date(req.body.visitedAt) : new Date() } });

    // If visit has photos and a campgroundId, notify users who favorited the campground
    if (req.body.campgroundId && req.body.photoUrls?.length > 0) {
      try {
        const [rigData, campground] = await Promise.all([
          prisma.rig.findUnique({ where: { id: rig.id }, select: { rigName: true } }),
          prisma.campground.findUnique({ where: { id: req.body.campgroundId }, select: { name: true } }),
        ]);
        if (rigData && campground) {
          const followers = await prisma.campgroundFollow.findMany({
            where: { campgroundId: req.body.campgroundId, userId: { not: req.userId } },
            select: { userId: true },
            take: 100,
          });
          for (const f of followers) {
            queueForDigest(f.userId, 'DAILY', 'RIG_PHOTOS_AT_FAVORITE', {
              rigName: rigData.rigName || 'A rig',
              campgroundName: campground.name,
              campgroundId: req.body.campgroundId,
              photoCount: req.body.photoUrls.length,
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[SocialProof] Rig photo digest error (non-fatal):', e);
      }
    }

    res.status(201).json(visit);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/campsites/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const v = await prisma.rigCampsiteVisit.update({ where: { id: req.params.id }, data: req.body }); res.json(v); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:slug/campsites/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigCampsiteVisit.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/campsites/:id/favorite', authenticateToken, async (req: any, res) => {
  try { const v = await prisma.rigCampsiteVisit.findUnique({ where: { id: req.params.id } }); const updated = await prisma.rigCampsiteVisit.update({ where: { id: req.params.id }, data: { isFavorite: !v?.isFavorite } }); res.json(updated); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /rigs/:slug/favorite-campgrounds — aggregated from all rig users (owner + co-pilots)
router.get('/:slug/favorite-campgrounds', async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    // Get all user IDs associated with this rig
    const [pilots, coPilots] = await Promise.all([
      prisma.rigPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
      prisma.rigCoPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
    ]);
    const rigUserIds = [rig.ownerId, ...pilots.map((p: any) => p.userId), ...coPilots.map((c: any) => c.userId)];
    const uniqueUserIds = [...new Set(rigUserIds)];

    // Get favorite campsite visits from all rig users
    const visits = await prisma.rigCampsiteVisit.findMany({
      where: { rigId: rig.id, isPrivate: false },
      orderBy: { visitedAt: 'desc' },
    });

    // Also get CampgroundReview entries from all rig users
    const reviews = await prisma.campgroundReview.findMany({
      where: { userId: { in: uniqueUserIds } },
      include: {
        campground: { select: { id: true, name: true, city: true, state: true, imageUrl: true, googleRating: true, slug: true } },
        user: { select: { id: true, firstName: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate by campground
    const campMap = new Map<string, any>();

    for (const v of visits) {
      const key = v.campgroundId;
      if (!campMap.has(key)) {
        campMap.set(key, {
          campgroundId: key,
          campgroundName: key,
          visits: [],
          totalVisits: 0,
          isFavorite: false,
          highestRating: 0,
          reviewSnippet: null,
          reviewerName: null,
          siteNumbers: [],
        });
      }
      const entry = campMap.get(key);
      entry.totalVisits++;
      if (v.isFavorite) entry.isFavorite = true;
      if (v.rating && v.rating > entry.highestRating) entry.highestRating = v.rating;
      if (v.review && !entry.reviewSnippet) { entry.reviewSnippet = v.review; }
      if (v.siteNumber && !entry.siteNumbers.includes(v.siteNumber)) entry.siteNumbers.push(v.siteNumber);
    }

    // Merge in review data for campground details
    for (const r of reviews) {
      if (!r.campground) continue;
      const key = r.campgroundId;
      if (!campMap.has(key)) {
        campMap.set(key, {
          campgroundId: key,
          campgroundName: r.campground.name,
          campground: r.campground,
          visits: [],
          totalVisits: 0,
          isFavorite: false,
          highestRating: r.rating,
          reviewSnippet: r.review,
          reviewerName: r.user.firstName,
          reviewerAvatar: r.user.profilePicture,
          siteNumbers: [],
        });
      }
      const entry = campMap.get(key);
      if (!entry.campground) entry.campground = r.campground;
      if (entry.campgroundName === key && r.campground.name) entry.campgroundName = r.campground.name;
      if (r.rating > entry.highestRating) entry.highestRating = r.rating;
      if (!entry.reviewSnippet && r.review) {
        entry.reviewSnippet = r.review;
        entry.reviewerName = r.user.firstName;
        entry.reviewerAvatar = r.user.profilePicture;
      }
    }

    // Sort: favorites first, then by visit count, then by rating
    const results = Array.from(campMap.values())
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        if (a.totalVisits !== b.totalVisits) return b.totalVisits - a.totalVisits;
        return b.highestRating - a.highestRating;
      });

    res.json(results);
  } catch (e: any) {
    console.error('[RigHub] favorite-campgrounds error:', e.message);
    res.status(500).json({ error: 'Failed to fetch favorite campgrounds' });
  }
});

// GET /rigs/:slug/reviews — all campground reviews from rig users
router.get('/:slug/reviews', async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10;

    // Get all user IDs
    const [pilots, coPilots] = await Promise.all([
      prisma.rigPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
      prisma.rigCoPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
    ]);
    const uniqueUserIds = [...new Set([rig.ownerId, ...pilots.map((p: any) => p.userId), ...coPilots.map((c: any) => c.userId)])];

    const where = { userId: { in: uniqueUserIds } };

    const [reviews, total] = await Promise.all([
      prisma.campgroundReview.findMany({
        where,
        include: {
          campground: { select: { id: true, name: true, city: true, state: true, imageUrl: true, slug: true, googleRating: true } },
          user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.campgroundReview.count({ where }),
    ]);

    // Compute stats
    const allRatings = await prisma.campgroundReview.findMany({
      where,
      select: { rating: true, campgroundId: true },
    });
    const avgRating = allRatings.length > 0
      ? Math.round((allRatings.reduce((s: number, r: any) => s + r.rating, 0) / allRatings.length) * 10) / 10
      : 0;
    const uniqueCampgrounds = new Set(allRatings.map((r: any) => r.campgroundId)).size;

    res.json({
      reviews,
      total,
      avgRating,
      uniqueCampgrounds,
      page,
      hasMore: page * limit < total,
    });
  } catch (e: any) {
    console.error('[RigHub] reviews error:', e.message);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ═══ RECOMMENDATIONS ═══
router.get('/:slug/recommendations', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const where: any = { rigId: rig.id, isPublic: true }; if (req.query.type) where.type = req.query.type; const recs = await prisma.rigRecommendation.findMany({ where, orderBy: { saves: 'desc' }, include: { user: { select: { id: true, firstName: true, profilePicture: true } } } }); res.json(recs); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/recommendations', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const rec = await prisma.rigRecommendation.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } }); res.status(201).json(rec); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/recommendations/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const r = await prisma.rigRecommendation.update({ where: { id: req.params.id }, data: req.body }); res.json(r); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:slug/recommendations/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigRecommendation.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/recommendations/:id/save', authenticateToken, async (req: any, res) => {
  try { await prisma.rigRecommendation.update({ where: { id: req.params.id }, data: { saves: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ MODS ═══
router.get('/:slug/mods-hub', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const where: any = { rigId: rig.id }; if (req.query.category) where.category = req.query.category; const mods = await prisma.rigMod.findMany({ where, orderBy: { likes: 'desc' }, include: { user: { select: { id: true, firstName: true, profilePicture: true } } } }); res.json(mods); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/mods-hub', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const mod = await prisma.rigMod.create({ data: { rigId: rig.id, userId: req.userId, ...req.body, installDate: req.body.installDate ? new Date(req.body.installDate) : null } }); res.status(201).json(mod); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/mods-hub/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const m = await prisma.rigMod.update({ where: { id: req.params.id }, data: req.body }); res.json(m); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:slug/mods-hub/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigMod.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/mods-hub/:id/like', authenticateToken, async (req: any, res) => {
  try { await prisma.rigMod.update({ where: { id: req.params.id }, data: { likes: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/mods-hub/:id/save', authenticateToken, async (req: any, res) => {
  try { await prisma.rigMod.update({ where: { id: req.params.id }, data: { saves: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ GEAR ═══
router.get('/:slug/gear', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const where: any = { rigId: rig.id, isPublic: true }; if (req.query.category) where.category = req.query.category; const gear = await prisma.rigGearItem.findMany({ where, orderBy: { createdAt: 'desc' } }); res.json(gear); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/gear', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const item = await prisma.rigGearItem.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } }); res.status(201).json(item); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/gear/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const g = await prisma.rigGearItem.update({ where: { id: req.params.id }, data: req.body }); res.json(g); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:slug/gear/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigGearItem.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ MAINTENANCE ═══
router.get('/:slug/maintenance', optionalAuth, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const isOwner = req.userId === rig.ownerId;
    const where: any = { rigId: rig.id };
    if (!isOwner) where.visibility = 'PUBLIC';
    const logs = await prisma.rigMaintenanceLog.findMany({ where, orderBy: { serviceDate: 'desc' } });
    res.json(logs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/maintenance', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const log = await prisma.rigMaintenanceLog.create({ data: { rigId: rig.id, userId: req.userId, ...req.body, serviceDate: req.body.serviceDate ? new Date(req.body.serviceDate) : new Date(), nextServiceDate: req.body.nextServiceDate ? new Date(req.body.nextServiceDate) : null } }); res.status(201).json(log); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/maintenance/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const l = await prisma.rigMaintenanceLog.update({ where: { id: req.params.id }, data: req.body }); res.json(l); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:slug/maintenance/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigMaintenanceLog.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ RESOURCES ═══
router.get('/:slug/resources', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const resources = await prisma.rigResource.findMany({ where: { rigId: rig.id, isPublic: true }, orderBy: { createdAt: 'desc' } }); res.json(resources); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/resources', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const r = await prisma.rigResource.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } }); res.status(201).json(r); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:slug/resources/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigResource.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/resources/:id/download', async (req: any, res) => {
  try { const r = await prisma.rigResource.update({ where: { id: req.params.id }, data: { downloads: { increment: 1 } } }); res.json({ fileUrl: r.fileUrl }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ ACHIEVEMENTS ═══
router.get('/:slug/achievements', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const achievements = await prisma.rigAchievement.findMany({ where: { rigId: rig.id }, orderBy: { earnedAt: 'desc' } }); res.json(achievements); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/achievements/check', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, statesVisited: true, totalMiles: true, totalNights: true, totalMilesDriven: true, totalNightsCamped: true, totalStatesCount: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const miles = rig.totalMilesDriven || rig.totalMiles || 0;
    const nights = rig.totalNightsCamped || rig.totalNights || 0;
    const states = rig.totalStatesCount || rig.statesVisited?.length || 0;
    const campsiteCount = await prisma.rigCampsiteVisit.count({ where: { rigId: rig.id } });

    const checks = [
      { type: 'STATES_10', cond: states >= 10, title: '10 States Visited', desc: 'Explored 10 different states' },
      { type: 'STATES_25', cond: states >= 25, title: '25 States Visited', desc: 'Halfway across America' },
      { type: 'STATES_48', cond: states >= 48, title: '48 States Visited', desc: 'Continental completionist' },
      { type: 'MILES_1000', cond: miles >= 1000, title: '1,000 Miles', desc: 'First thousand on the odometer' },
      { type: 'MILES_5000', cond: miles >= 5000, title: '5,000 Miles', desc: 'Serious road warrior' },
      { type: 'MILES_10000', cond: miles >= 10000, title: '10,000 Miles', desc: 'Legend of the highway' },
      { type: 'CAMPGROUNDS_10', cond: campsiteCount >= 10, title: '10 Campgrounds', desc: 'Campground connoisseur' },
      { type: 'CAMPGROUNDS_50', cond: campsiteCount >= 50, title: '50 Campgrounds', desc: 'Campground explorer' },
      { type: 'NIGHTS_30', cond: nights >= 30, title: '30 Nights Camped', desc: 'A month under the stars' },
      { type: 'NIGHTS_100', cond: nights >= 100, title: '100 Nights Camped', desc: 'Century of campfires' },
      { type: 'NIGHTS_365', cond: nights >= 365, title: '365 Nights Camped', desc: 'A full year on the road' },
    ];
    const earned: string[] = [];
    for (const c of checks) {
      if (!c.cond) continue;
      const existing = await prisma.rigAchievement.findUnique({ where: { rigId_achievementType: { rigId: rig.id, achievementType: c.type } } });
      if (!existing) {
        await prisma.rigAchievement.create({ data: { rigId: rig.id, achievementType: c.type, title: c.title, description: c.desc, earnedAt: new Date() } });
        earned.push(c.title);
      }
    }
    res.json({ earned, total: checks.filter(c => c.cond).length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ COMMUNITY CONTRIBUTIONS ═══
router.get('/:slug/contributions', optionalAuth, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const isOwner = req.userId === rig.ownerId;
    const where: any = { rigId: rig.id };
    if (!isOwner) where.isApproved = true;
    const contributions = await prisma.rigCommunityContribution.findMany({ where, orderBy: { createdAt: 'desc' }, include: { contributor: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } } } });
    res.json(contributions);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/contributions', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const c = await prisma.rigCommunityContribution.create({ data: { rigId: rig.id, contributorId: req.userId, ...req.body } }); res.status(201).json(c); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/contributions/:id/approve', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const c = await prisma.rigCommunityContribution.update({ where: { id: req.params.id }, data: { isApproved: true } }); res.json(c); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete('/:slug/contributions/:id', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigCommunityContribution.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ RIG POSTS (photos from all rig users — owner + co-pilots) ═══

router.get('/:slug/posts', async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    // Get all user IDs associated with this rig
    const [pilots, coPilots] = await Promise.all([
      prisma.rigPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
      prisma.rigCoPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
    ]);
    const rigUserIds = [...new Set([rig.ownerId, ...pilots.map((p: any) => p.userId), ...coPilots.map((c: any) => c.userId)])];

    const posts = await prisma.rigPost.findMany({
      where: {
        photos: { isEmpty: false },
        AND: [
          { OR: [{ rigId: rig.id }, { userId: { in: rigUserIds } }] },
          { NOT: { visibility: { in: ['PRIVATE', 'FRIENDS_ONLY'] } } },
        ],
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json(posts);
  } catch (e: any) {
    console.error('[RigHub] posts error:', e.message);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// ═══ RIG SHOWCASE ═══

router.get('/:slug/showcase', async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    // Get all rig user IDs (owner + co-pilots)
    const [pilots, coPilots] = await Promise.all([
      prisma.rigPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
      prisma.rigCoPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
    ]);
    const rigUserIds = [...new Set([rig.ownerId, ...pilots.map((p: any) => p.userId), ...coPilots.map((c: any) => c.userId)])];

    // Get RigPost photos (rig showcase + travel)
    const rigPosts = await prisma.rigPost.findMany({
      where: {
        photos: { isEmpty: false },
        AND: [
          { OR: [{ rigId: rig.id }, { userId: { in: rigUserIds } }] },
          { NOT: { visibility: { in: ['PRIVATE', 'FRIENDS_ONLY'] } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, photos: true, photoCategory: true, title: true, createdAt: true, isRigPhoto: true },
      take: 50,
    });

    // Also get photos from user albums
    let albumPhotoUrls: string[] = [];
    try {
      const albums = await prisma.photoAlbum.findMany({
        where: { userId: { in: rigUserIds }, NOT: { privacy: 'PRIVATE' } },
        select: { photos: { select: { imageUrl: true }, take: 20 } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      albumPhotoUrls = albums.flatMap((a: any) => a.photos.map((p: any) => p.imageUrl));
    } catch (e: any) { console.error('[Showcase] album query error:', e.message); }

    // If RigPost photos are sparse, add album photos as synthetic entries
    if (rigPosts.length === 0 && albumPhotoUrls.length > 0) {
      rigPosts.push({
        id: 'album-showcase',
        photos: albumPhotoUrls.slice(0, 30),
        photoCategory: 'TRAVEL',
        title: 'Trip Photos',
        createdAt: new Date(),
        isRigPhoto: false,
      } as any);
    }

    res.json(rigPosts);
  } catch (e: any) { console.error('[Showcase] error:', e.message); res.status(500).json({ error: e.message }); }
});

router.post('/:slug/photos/categorize', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { updates } = req.body; // [{ id, photoCategory }]
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates array required' });
    const rigCategories = ['RIG_EXTERIOR', 'RIG_INTERIOR', 'RIG_FLOORPLAN', 'RIG_DETAIL', 'RIG_SETUP'];
    let updated = 0;
    for (const u of updates) {
      const isRigPhoto = rigCategories.includes(u.photoCategory);
      await prisma.rigPost.update({
        where: { id: u.id },
        data: { photoCategory: u.photoCategory, isRigPhoto },
      });
      // Remove from timeline if rig photo
      if (isRigPhoto) {
        await prisma.rigTimelineItem.deleteMany({ where: { rigId: rig.id, refId: u.id } }).catch(() => {});
      }
      updated++;
    }
    res.json({ updated });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
