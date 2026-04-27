import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// Safe user fields to include in public responses
const safeUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  profilePicture: true,
};

// ============== HELPERS ==============

/** Check if the authenticated user is the rig owner or a pilot with canEdit */
async function isOwnerOrEditor(rigId: string, userId: string): Promise<{ authorized: boolean; isOwner: boolean }> {
  const rig = await prisma.rig.findUnique({ where: { id: rigId }, select: { ownerId: true } });
  if (!rig) return { authorized: false, isOwner: false };
  if (rig.ownerId === userId) return { authorized: true, isOwner: true };
  const pilot = await prisma.rigPilot.findUnique({
    where: { rigId_userId: { rigId, userId } },
  });
  if (pilot?.canEdit) return { authorized: true, isOwner: false };
  return { authorized: false, isOwner: false };
}

/** Check if user is the rig owner */
async function isOwner(rigId: string, userId: string): Promise<boolean> {
  const rig = await prisma.rig.findUnique({ where: { id: rigId }, select: { ownerId: true } });
  return rig?.ownerId === userId;
}

// ============== MIGRATE FROM USER ==============

router.post('/migrate-from-user', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        rvMake: true,
        rvModel: true,
        rvYear: true,
        rvType: true,
        rvLength: true,
        rvWeight: true,
        rvSlideouts: true,
        rvMpg: true,
        rvPhotoUrl: true,
        rvDescription: true,
        rvOdometer: true,
        rvFreshWaterGal: true,
        rvGreyWaterGal: true,
        rvBlackWaterGal: true,
        rvFuelType: true,
        rvGvwr: true,
        youtubeUrl: true,
        instagramUrl: true,
        tiktokUrl: true,
        website: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Auto-generate slug
    const rawSlug = `${user.firstName || 'my'}s-${user.rvMake || 'rig'}-${user.rvModel || 'rv'}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Ensure slug uniqueness
    let slug = rawSlug;
    let counter = 1;
    while (await prisma.rig.findUnique({ where: { slug } })) {
      slug = `${rawSlug}-${counter}`;
      counter++;
    }

    const rig = await prisma.rig.create({
      data: {
        slug,
        ownerId: userId,
        rigName: user.rvMake && user.rvModel ? `${user.rvYear || ''} ${user.rvMake} ${user.rvModel}`.trim() : null,
        heroPhoto: user.rvPhotoUrl,
        year: user.rvYear,
        make: user.rvMake,
        model: user.rvModel,
        rigClass: user.rvType,
        lengthFeet: user.rvLength ? Number(user.rvLength) : null,
        grossWeight: user.rvGvwr,
        slideoutCount: user.rvSlideouts,
        avgMPG: user.rvMpg,
        currentOdometer: user.rvOdometer,
        freshWaterGal: user.rvFreshWaterGal ? Math.round(user.rvFreshWaterGal) : null,
        grayWaterGal: user.rvGreyWaterGal ? Math.round(user.rvGreyWaterGal) : null,
        blackWaterGal: user.rvBlackWaterGal ? Math.round(user.rvBlackWaterGal) : null,
        fuelType: user.rvFuelType,
        creatorBio: user.rvDescription,
        youtubeUrl: user.youtubeUrl,
        instagramUrl: user.instagramUrl,
        tiktokUrl: user.tiktokUrl,
        websiteUrl: user.website,
      },
    });

    res.status(201).json(rig);
  } catch (error: any) {
    console.error('[Rig] migrate-from-user error:', error.message);
    res.status(500).json({ error: 'Failed to migrate rig data' });
  }
});

// ============== PUBLIC RIG PROFILE ==============

router.get('/:slug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const userId = (req as any).userId;

    const rig = await prisma.rig.findUnique({
      where: { slug },
      include: {
        owner: { select: safeUserSelect },
        pilots: {
          include: { user: { select: safeUserSelect } },
        },
        modLogs: {
          where: { isPublic: true },
          orderBy: { modDate: 'desc' },
          take: 3,
        },
        _count: {
          select: {
            posts: true,
            modLogs: true,
            fuelLogs: true,
            followers: true,
          },
        },
      },
    });

    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    if (!rig.isPublic && rig.ownerId !== userId) {
      return res.status(404).json({ error: 'Rig not found' });
    }

    res.json(rig);
  } catch (error: any) {
    console.error('[Rig] get profile error:', error.message);
    res.status(500).json({ error: 'Failed to get rig profile' });
  }
});

// ============== EDIT DATA ==============

router.get('/:rigId/edit', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const rig = await prisma.rig.findUnique({ where: { id: rigId } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    res.json(rig);
  } catch (error: any) {
    console.error('[Rig] get edit data error:', error.message);
    res.status(500).json({ error: 'Failed to get rig edit data' });
  }
});

// ============== UPDATE RIG ==============

router.put('/:rigId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    // Strip fields that should not be directly updated
    const { id, ownerId, createdAt, updatedAt, slug, ...updateData } = req.body;

    const rig = await prisma.rig.update({
      where: { id: rigId },
      data: updateData,
    });

    res.json(rig);
  } catch (error: any) {
    console.error('[Rig] update error:', error.message);
    res.status(500).json({ error: 'Failed to update rig' });
  }
});

// ============== TRIPS ==============

router.get('/:rigId/trips', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const rig = await prisma.rig.findUnique({ where: { id: rigId }, select: { ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    const events = await prisma.event.findMany({
      where: { organizerId: rig.ownerId },
      include: {
        campground: {
          select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    // Also get check-in visits
    const checkIns = await prisma.checkIn.findMany({
      where: { userId: rig.ownerId },
      include: {
        campground: {
          select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true },
        },
      },
      orderBy: { checkInDate: 'desc' },
    });

    res.json({ events, checkIns });
  } catch (error: any) {
    console.error('[Rig] get trips error:', error.message);
    res.status(500).json({ error: 'Failed to get trips' });
  }
});

// ============== CAMPGROUNDS ==============

router.get('/:rigId/campgrounds', async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const rig = await prisma.rig.findUnique({ where: { id: rigId }, select: { ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    const checkIns = await prisma.checkIn.findMany({
      where: { userId: rig.ownerId },
      select: { campgroundId: true },
      distinct: ['campgroundId'],
    });

    const campgroundIds = checkIns.map((c: any) => c.campgroundId).filter(Boolean);
    if (campgroundIds.length === 0) return res.json([]);

    const campgrounds = await prisma.campground.findMany({
      where: { id: { in: campgroundIds } },
      select: {
        id: true,
        name: true,
        location: true,
        state: true,
        imageUrl: true,
        latitude: true,
        longitude: true,
        googleRating: true,
        customSlug: true,
      },
    });

    res.json(campgrounds);
  } catch (error: any) {
    console.error('[Rig] get campgrounds error:', error.message);
    res.status(500).json({ error: 'Failed to get campgrounds' });
  }
});

// ============== MOD LOGS ==============

router.get('/:rigId/mods', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const ownerCheck = userId ? await isOwner(rigId, userId) : false;

    const mods = await prisma.modLog.findMany({
      where: {
        rigId,
        ...(ownerCheck ? {} : { isPublic: true }),
      },
      orderBy: { modDate: 'desc' },
    });

    res.json(mods);
  } catch (error: any) {
    console.error('[Rig] get mods error:', error.message);
    res.status(500).json({ error: 'Failed to get mod logs' });
  }
});

router.post('/:rigId/mods', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const { title, description, cost, modDate, photos, category, beforePhoto, afterPhoto, productLink, isPublic } = req.body;

    const mod = await prisma.modLog.create({
      data: {
        rigId,
        title,
        description,
        cost,
        modDate: modDate ? new Date(modDate) : null,
        photos: photos || [],
        category,
        beforePhoto,
        afterPhoto,
        productLink,
        isPublic: isPublic !== false,
      },
    });

    res.status(201).json(mod);
  } catch (error: any) {
    console.error('[Rig] create mod error:', error.message);
    res.status(500).json({ error: 'Failed to create mod log' });
  }
});

router.put('/:rigId/mods/:modId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId, modId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const { id, rigId: _rigId, createdAt, ...updateData } = req.body;
    if (updateData.modDate) updateData.modDate = new Date(updateData.modDate);

    const mod = await prisma.modLog.update({
      where: { id: modId },
      data: updateData,
    });

    res.json(mod);
  } catch (error: any) {
    console.error('[Rig] update mod error:', error.message);
    res.status(500).json({ error: 'Failed to update mod log' });
  }
});

router.delete('/:rigId/mods/:modId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId, modId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    await prisma.modLog.delete({ where: { id: modId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Rig] delete mod error:', error.message);
    res.status(500).json({ error: 'Failed to delete mod log' });
  }
});

// ============== RIG POSTS ==============

router.get('/:rigId/posts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;

    const posts = await prisma.rigPost.findMany({
      where: { rigId, isPublic: true },
      include: { author: { select: safeUserSelect } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(posts);
  } catch (error: any) {
    console.error('[Rig] get posts error:', error.message);
    res.status(500).json({ error: 'Failed to get rig posts' });
  }
});

router.post('/:rigId/posts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const { title, body, photos, postType, tripId, isPublic } = req.body;

    const post = await prisma.rigPost.create({
      data: {
        rigId,
        userId,
        title,
        body,
        photos: photos || [],
        postType: postType || 'road_report',
        tripId,
        isPublic: isPublic !== false,
      },
      include: { author: { select: safeUserSelect } },
    });

    res.status(201).json(post);
  } catch (error: any) {
    console.error('[Rig] create post error:', error.message);
    res.status(500).json({ error: 'Failed to create rig post' });
  }
});

// ============== STATS ==============

router.get('/:rigId/stats', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;

    const rig = await prisma.rig.findUnique({
      where: { id: rigId },
      select: {
        ownerId: true,
        totalMilesDriven: true,
        totalNightsCamped: true,
        totalTripCount: true,
        totalStatesCount: true,
        avgMPG: true,
        totalFuelCost: true,
        followerCount: true,
      },
    });

    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    const stats: any = {
      totalMilesDriven: rig.totalMilesDriven,
      totalNightsCamped: rig.totalNightsCamped,
      totalTripCount: rig.totalTripCount,
      totalStatesCount: rig.totalStatesCount,
      avgMPG: rig.avgMPG,
      followerCount: rig.followerCount,
    };

    // Only expose fuel cost to the owner
    if (userId === rig.ownerId) {
      stats.totalFuelCost = rig.totalFuelCost;
    }

    res.json(stats);
  } catch (error: any) {
    console.error('[Rig] get stats error:', error.message);
    res.status(500).json({ error: 'Failed to get rig stats' });
  }
});

// ============== FUEL LOGS ==============

router.post('/:rigId/fuel-logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const { gallons, pricePerGal, totalCost, odometer, location } = req.body;

    const fuelLog = await prisma.fuelLog.create({
      data: {
        rigId,
        gallons,
        pricePerGal,
        totalCost,
        odometer,
        location,
      },
    });

    // Recalculate avgMPG from all fuel logs with odometer readings
    const allLogs = await prisma.fuelLog.findMany({
      where: { rigId, odometer: { not: null } },
      orderBy: { loggedAt: 'asc' },
    });

    if (allLogs.length >= 2) {
      const first = allLogs[0];
      const last = allLogs[allLogs.length - 1];
      const totalMiles = last.odometer - first.odometer;
      // Sum all gallons except the first fill (baseline)
      const totalGallons = allLogs.slice(1).reduce((sum: number, log: any) => sum + log.gallons, 0);
      const avgMPG = totalGallons > 0 ? totalMiles / totalGallons : null;
      const totalFuelCost = allLogs.reduce((sum: number, log: any) => sum + log.totalCost, 0);

      await prisma.rig.update({
        where: { id: rigId },
        data: { avgMPG, totalFuelCost, currentOdometer: last.odometer },
      });
    }

    res.status(201).json(fuelLog);
  } catch (error: any) {
    console.error('[Rig] create fuel log error:', error.message);
    res.status(500).json({ error: 'Failed to create fuel log' });
  }
});

router.get('/:rigId/fuel-logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const ownerCheck = await isOwner(rigId, userId);
    if (!ownerCheck) return res.status(403).json({ error: 'Not authorized' });

    const logs = await prisma.fuelLog.findMany({
      where: { rigId },
      orderBy: { loggedAt: 'desc' },
    });

    res.json(logs);
  } catch (error: any) {
    console.error('[Rig] get fuel logs error:', error.message);
    res.status(500).json({ error: 'Failed to get fuel logs' });
  }
});

// ============== FOLLOW / UNFOLLOW ==============

router.post('/:rigId/follow', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;

    const existing = await prisma.rigFollow.findUnique({
      where: { rigId_userId: { rigId, userId } },
    });

    if (existing) {
      // Unfollow
      await prisma.rigFollow.delete({ where: { id: existing.id } });
      const rig = await prisma.rig.update({
        where: { id: rigId },
        data: { followerCount: { decrement: 1 } },
        select: { followerCount: true },
      });
      return res.json({ following: false, followerCount: rig.followerCount });
    }

    // Follow
    await prisma.rigFollow.create({ data: { rigId, userId } });
    const rig = await prisma.rig.update({
      where: { id: rigId },
      data: { followerCount: { increment: 1 } },
      select: { followerCount: true },
    });

    res.json({ following: true, followerCount: rig.followerCount });
  } catch (error: any) {
    console.error('[Rig] follow toggle error:', error.message);
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

router.get('/:rigId/followers', async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;

    const followers = await prisma.rigFollow.findMany({
      where: { rigId },
      include: { user: { select: safeUserSelect } },
      orderBy: { followedAt: 'desc' },
    });

    res.json(followers);
  } catch (error: any) {
    console.error('[Rig] get followers error:', error.message);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

// ============== PILOTS ==============

router.post('/:rigId/pilots', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const ownerCheck = await isOwner(rigId, userId);
    if (!ownerCheck) return res.status(403).json({ error: 'Only the rig owner can invite pilots' });

    const { userId: pilotUserId, role, canEdit } = req.body;
    if (!pilotUserId) return res.status(400).json({ error: 'userId is required' });

    const pilot = await prisma.rigPilot.create({
      data: {
        rigId,
        userId: pilotUserId,
        role: role || 'co-pilot',
        canEdit: canEdit || false,
      },
      include: { user: { select: safeUserSelect } },
    });

    res.status(201).json(pilot);
  } catch (error: any) {
    console.error('[Rig] add pilot error:', error.message);
    res.status(500).json({ error: 'Failed to add pilot' });
  }
});

router.delete('/:rigId/pilots/:pilotUserId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId, pilotUserId } = req.params;
    const userId = (req as any).userId;
    const ownerCheck = await isOwner(rigId, userId);
    if (!ownerCheck) return res.status(403).json({ error: 'Only the rig owner can remove pilots' });

    await prisma.rigPilot.delete({
      where: { rigId_userId: { rigId, userId: pilotUserId } },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Rig] remove pilot error:', error.message);
    res.status(500).json({ error: 'Failed to remove pilot' });
  }
});

// ============== DOCUMENTS ==============

router.post('/:rigId/documents', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const { name, fileUrl, expiresAt, isPrivate } = req.body;

    const doc = await prisma.rigDocument.create({
      data: {
        rigId,
        name,
        fileUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isPrivate: isPrivate !== false,
      },
    });

    res.status(201).json(doc);
  } catch (error: any) {
    console.error('[Rig] create document error:', error.message);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

router.get('/:rigId/documents', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const docs = await prisma.rigDocument.findMany({
      where: { rigId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(docs);
  } catch (error: any) {
    console.error('[Rig] get documents error:', error.message);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

router.delete('/:rigId/documents/:docId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId, docId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    await prisma.rigDocument.delete({ where: { id: docId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Rig] delete document error:', error.message);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
