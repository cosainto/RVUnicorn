import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { queueForDigest } from '../services/emailThrottle';

const router = Router();
const prisma = new PrismaClient() as any;

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

// ═══ RIG SHOWCASE ═══

router.get('/:slug/showcase', async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const where: any = { rigId: rig.id, isRigPhoto: true };
    if (req.query.category) where.photoCategory = req.query.category;
    const photos = await prisma.rigPost.findMany({
      where, orderBy: { createdAt: 'desc' },
      select: { id: true, photos: true, photoCategory: true, title: true, createdAt: true },
    });
    res.json(photos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
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
