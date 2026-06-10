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

// ============== FOLLOW HELPERS ==============

/**
 * Get follower userIds for a user — prefers RigFollow, falls back to CreatorFollow.
 * Used by notification code to avoid duplicate notifications.
 */
async function getFollowersForUser(userId: string): Promise<string[]> {
  // Find user's rig
  const rig = await prisma.rig.findFirst({ where: { ownerId: userId }, select: { id: true } });

  if (rig) {
    const rigFollows = await prisma.rigFollow.findMany({
      where: { rigId: rig.id },
      select: { userId: true },
    });
    return rigFollows.map((f: any) => f.userId);
  }

  // Fallback to CreatorFollow
  const creatorFollows = await prisma.creatorFollow.findMany({
    where: { creatorId: userId },
    select: { followerId: true },
  });
  return creatorFollows.map((f: any) => f.followerId);
}

/**
 * Sync a rig follow action to CreatorFollow so both tables stay consistent.
 * Prevents duplicate notifications by keeping a single source of truth.
 */
async function syncCreatorFollow(rigOwnerId: string, followerId: string, action: 'follow' | 'unfollow') {
  try {
    if (action === 'follow') {
      const exists = await prisma.creatorFollow.findUnique({
        where: { creatorId_followerId: { creatorId: rigOwnerId, followerId } },
      });
      if (!exists) {
        await prisma.creatorFollow.create({
          data: { creatorId: rigOwnerId, followerId, migrated: true },
        });
        await prisma.creatorStats.upsert({
          where: { userId: rigOwnerId },
          create: { userId: rigOwnerId, followerCount: 1 },
          update: { followerCount: { increment: 1 } },
        });
      }
    } else {
      const exists = await prisma.creatorFollow.findUnique({
        where: { creatorId_followerId: { creatorId: rigOwnerId, followerId } },
      });
      if (exists) {
        await prisma.creatorFollow.delete({ where: { id: exists.id } });
        await prisma.creatorStats.updateMany({
          where: { userId: rigOwnerId, followerCount: { gt: 0 } },
          data: { followerCount: { decrement: 1 } },
        });
      }
    }
  } catch (err: any) {
    console.error('[Rig] sync creator follow error:', err.message);
  }
}

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

    const rig = await prisma.rig.findUnique({
      where: { id: rigId },
      select: { ownerId: true, rigName: true, slug: true, heroPhoto: true },
    });

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

    // Create BasecampActivity for RigFollow followers + pilots
    if (isPublic !== false && rig) {
      try {
        const [followers, pilots] = await Promise.all([
          prisma.rigFollow.findMany({ where: { rigId }, select: { userId: true } }),
          prisma.rigPilot.findMany({ where: { rigId }, select: { userId: true } }),
        ]);
        const recipientIds = [...new Set([
          ...followers.map((f: any) => f.userId),
          ...pilots.map((p: any) => p.userId),
          rig.ownerId,
        ])].filter((id: string) => id !== userId); // Don't notify the author

        if (recipientIds.length > 0) {
          await prisma.basecampActivity.createMany({
            data: recipientIds.map((recipientId: string) => ({
              userId: recipientId,
              actorId: userId,
              type: 'RIG_POST',
              entityType: 'RigPost',
              entityId: post.id,
              entityName: title || 'Rig Post',
              metadata: {
                postType: postType || 'road_report',
                title,
                photoCount: (photos || []).length,
                tripId,
                rigName: rig.rigName,
                rigSlug: rig.slug,
                rigPhoto: rig.heroPhoto,
                rigId,
              },
            })),
          });
        }
      } catch (err: any) {
        console.error('[Rig] create basecamp activity error:', err.message);
      }
    }

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

      // Check milestones after odometer update
      checkMilestones(rigId);
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

    const rigData = await prisma.rig.findUnique({ where: { id: rigId }, select: { ownerId: true } });
    if (!rigData) return res.status(404).json({ error: 'Rig not found' });

    const existing = await prisma.rigFollow.findUnique({
      where: { rigId_userId: { rigId, userId } },
    });

    if (existing) {
      // Unfollow — remove both RigFollow and CreatorFollow
      await prisma.rigFollow.delete({ where: { id: existing.id } });
      const rig = await prisma.rig.update({
        where: { id: rigId },
        data: { followerCount: { decrement: 1 } },
        select: { followerCount: true },
      });
      await syncCreatorFollow(rigData.ownerId, userId, 'unfollow');
      return res.json({ following: false, followerCount: rig.followerCount });
    }

    // Follow — create both RigFollow and CreatorFollow
    await prisma.rigFollow.create({ data: { rigId, userId } });
    const rig = await prisma.rig.update({
      where: { id: rigId },
      data: { followerCount: { increment: 1 } },
      select: { followerCount: true },
    });
    await syncCreatorFollow(rigData.ownerId, userId, 'follow');

    // Notify rig owner
    const follower = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, firstName: true },
    });
    await prisma.notification.create({
      data: {
        userId: rigData.ownerId,
        type: 'NEW_FOLLOWER',
        content: `${follower?.firstName || follower?.username} started following your rig`,
        link: `/rig/${rigId}`,
      },
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

// ============== ACTIVITY FEED ==============

const MILESTONE_THRESHOLDS: Record<string, number[]> = {
  states: [5, 10, 15, 20, 25, 30, 40, 50],
  nights: [10, 25, 50, 100, 200, 365],
  trips: [5, 10, 25, 50, 100],
  miles: [1000, 5000, 10000, 25000, 50000],
};

async function checkMilestones(rigId: string) {
  try {
    const rig = await prisma.rig.findUnique({
      where: { id: rigId },
      select: { totalStatesCount: true, totalNightsCamped: true, totalTripCount: true, totalMilesDriven: true },
    });
    if (!rig) return;

    const checks: { type: string; value: number }[] = [
      { type: 'states', value: rig.totalStatesCount || 0 },
      { type: 'nights', value: rig.totalNightsCamped || 0 },
      { type: 'trips', value: rig.totalTripCount || 0 },
      { type: 'miles', value: Math.round(rig.totalMilesDriven || 0) },
    ];

    for (const check of checks) {
      const thresholds = MILESTONE_THRESHOLDS[check.type] || [];
      for (const threshold of thresholds) {
        if (check.value >= threshold) {
          await prisma.rigMilestone.upsert({
            where: { rigId_milestoneType_value: { rigId, milestoneType: check.type, value: threshold } },
            create: { rigId, milestoneType: check.type, value: threshold },
            update: {},
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[Rig] milestone check error:', err.message);
  }
}

router.get('/:rigId/activity', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const rig = await prisma.rig.findUnique({
      where: { id: rigId },
      select: { ownerId: true, rigName: true },
    });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    const activities: any[] = [];

    // Mods added to this rig
    const recentMods = await prisma.modLog.findMany({
      where: { rigId, isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, title: true, category: true, createdAt: true },
    });
    for (const mod of recentMods) {
      activities.push({
        type: 'mod_added',
        icon: '🔧',
        description: `${mod.title} added`,
        timestamp: mod.createdAt,
      });
    }

    // Recent rig posts (trip completed, etc.)
    const recentPosts = await prisma.rigPost.findMany({
      where: { rigId, isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, title: true, postType: true, createdAt: true },
    });
    for (const post of recentPosts) {
      const typeLabel = post.postType === 'trip_recap' ? 'Trip completed' :
                        post.postType === 'mod_update' ? 'Mod update posted' :
                        post.postType === 'tip' ? 'Road tip shared' : 'Road report posted';
      activities.push({
        type: post.postType === 'trip_recap' ? 'trip_completed' : 'post',
        icon: post.postType === 'trip_recap' ? '🗺' : '📝',
        description: post.title || typeLabel,
        timestamp: post.createdAt,
      });
    }

    // Pilots joined
    const pilots = await prisma.rigPilot.findMany({
      where: { rigId },
      orderBy: { addedAt: 'desc' },
      take: 2,
      include: { user: { select: { firstName: true } } },
    });
    for (const pilot of pilots) {
      activities.push({
        type: 'pilot_joined',
        icon: '🤝',
        description: `${pilot.user?.firstName || 'Someone'} joined as ${pilot.role}`,
        timestamp: pilot.addedAt,
      });
    }

    // Milestones
    const milestones = await prisma.rigMilestone.findMany({
      where: { rigId },
      orderBy: { achievedAt: 'desc' },
      take: 3,
    });
    for (const m of milestones) {
      const label = m.milestoneType === 'states' ? `${m.value} states visited!` :
                    m.milestoneType === 'nights' ? `${m.value} nights camped!` :
                    m.milestoneType === 'trips' ? `${m.value} trips completed!` :
                    `${m.value.toLocaleString()} miles driven!`;
      activities.push({
        type: 'milestone',
        icon: '📍',
        description: label,
        timestamp: m.achievedAt,
      });
    }

    // Campground ratings by owner
    try {
      const ratings = await prisma.campgroundReview.findMany({
        where: { userId: rig.ownerId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { campground: { select: { name: true } } },
      });
      for (const r of ratings) {
        activities.push({
          type: 'campground_rated',
          icon: '⭐',
          description: `Rated ${r.campground?.name || 'a campground'}`,
          timestamp: r.createdAt,
        });
      }
    } catch {}

    // Check-ins at rig's visited campgrounds by other users
    try {
      // Get rig owner's visited campground IDs
      const ownerCheckins = await prisma.checkIn.findMany({
        where: { userId: rig.ownerId },
        select: { campgroundId: true },
        distinct: ['campgroundId'],
      });
      const campIds = ownerCheckins.map((c: any) => c.campgroundId).filter(Boolean);

      if (campIds.length > 0) {
        const otherCheckins = await prisma.checkIn.findMany({
          where: {
            campgroundId: { in: campIds },
            userId: { not: rig.ownerId },
            isActive: true,
          },
          orderBy: { checkInDate: 'desc' },
          take: 3,
          include: {
            user: { select: { firstName: true } },
            campground: { select: { name: true } },
          },
        });
        for (const ci of otherCheckins) {
          activities.push({
            type: 'campground_checkin',
            icon: '🏕',
            description: `${ci.user?.firstName || 'Someone'} checked in at ${ci.campground?.name || 'a campground'}`,
            timestamp: ci.checkInDate,
          });
        }
      }
    } catch {}

    // Sort by timestamp descending and return top 10
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(activities.slice(0, 10));
  } catch (error: any) {
    console.error('[Rig] activity feed error:', error.message);
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

// ============== EVENTS (surfaced from CreatorEvent) ==============
// TODO: Full event system merge deferred — CreatorEvent and Event are fundamentally
// different (social meetups vs trip plans). For now, we link and surface.

router.get('/:rigId/events', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const rig = await prisma.rig.findUnique({ where: { id: rigId }, select: { ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    const userId = (req as any).userId;

    // Get events where rigId matches OR creator is the rig owner
    const events = await prisma.creatorEvent.findMany({
      where: {
        OR: [
          { rigId },
          { creatorId: rig.ownerId },
        ],
        status: { not: 'CANCELLED' },
      },
      include: {
        campground: { select: { id: true, name: true, state: true } },
        rsvps: { select: { userId: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const enriched = events.map((e: any) => ({
      ...e,
      rsvpCount: e.rsvps.length,
      userHasRsvped: userId ? e.rsvps.some((r: any) => r.userId === userId) : false,
      rsvps: undefined,
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('[Rig] get events error:', error.message);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

router.post('/:rigId/events', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId } = req.params;
    const userId = (req as any).userId;
    const owner = await isOwner(rigId, userId);
    if (!owner) return res.status(403).json({ error: 'Only rig owner can create events' });

    const { title, description, type, campgroundId, startTime, endTime, maxAttendees } = req.body;
    if (!title?.trim() || !type || !startTime) {
      return res.status(400).json({ error: 'Title, type, and startTime are required' });
    }

    const event = await prisma.creatorEvent.create({
      data: {
        creatorId: userId,
        rigId,
        title: title.trim(),
        description: description?.trim() || null,
        type,
        campgroundId: campgroundId || null,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        maxAttendees: maxAttendees || null,
        status: 'UPCOMING',
      },
    });

    res.status(201).json(event);
  } catch (error: any) {
    console.error('[Rig] create event error:', error.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.post('/:rigId/events/:eventId/rsvp', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;

    const existing = await prisma.creatorEventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing) {
      await prisma.creatorEventRsvp.delete({ where: { id: existing.id } });
      return res.json({ rsvped: false });
    }

    // Check max attendees
    const event = await prisma.creatorEvent.findUnique({
      where: { id: eventId },
      include: { _count: { select: { rsvps: true } } },
    });
    if (event?.maxAttendees && event._count.rsvps >= event.maxAttendees) {
      return res.status(400).json({ error: 'Event is full' });
    }

    await prisma.creatorEventRsvp.create({
      data: { eventId, userId },
    });

    res.json({ rsvped: true });
  } catch (error: any) {
    console.error('[Rig] event rsvp error:', error.message);
    res.status(500).json({ error: 'Failed to toggle RSVP' });
  }
});

// ============== MIGRATE CREATOR FOLLOWS TO RIG ==============

router.post('/admin/migrate-follows', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    // Simple admin check — only allow the site owner
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email?.includes('kindletribe') && !user?.email?.includes('rvunicorn')) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const creatorFollows = await prisma.creatorFollow.findMany({
      where: { migrated: false },
    });

    let migrated = 0;
    let skipped = 0;

    for (const cf of creatorFollows) {
      // Find the rig owned by the creator being followed
      const rig = await prisma.rig.findFirst({
        where: { ownerId: cf.creatorId },
        select: { id: true },
      });

      if (!rig) {
        skipped++;
        continue;
      }

      // Check if RigFollow already exists
      const existing = await prisma.rigFollow.findUnique({
        where: { rigId_userId: { rigId: rig.id, userId: cf.followerId } },
      });

      if (!existing) {
        await prisma.rigFollow.create({
          data: {
            rigId: rig.id,
            userId: cf.followerId,
            sourceCreatorFollowId: cf.id,
            followedAt: cf.createdAt,
          },
        });
        // Update rig follower count
        await prisma.rig.update({
          where: { id: rig.id },
          data: { followerCount: { increment: 1 } },
        });
        migrated++;
      } else {
        skipped++;
      }

      // Mark as migrated
      await prisma.creatorFollow.update({
        where: { id: cf.id },
        data: { migrated: true },
      });
    }

    res.json({ migrated, skipped, total: creatorFollows.length });
  } catch (error: any) {
    console.error('[Rig] migrate follows error:', error.message);
    res.status(500).json({ error: 'Failed to migrate follows' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// JOURNEY EPISODES
// ═══════════════════════════════════════════════════════════════════════

router.get('/:slug/episodes', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const episodes = await prisma.journeyEpisode.findMany({
      where: { rigId: rig.id },
      include: { _count: { select: { posts: true, moments: true } } },
      orderBy: { order: 'asc' },
    });
    res.json(episodes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/episodes', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { title, subtitle, startDate, endDate, startLocation, endLocation, coverImageUrl, episodeType, order } = req.body;
    const episode = await prisma.journeyEpisode.create({
      data: { rigId: rig.id, title, subtitle, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, startLocation, endLocation, coverImageUrl, episodeType: episodeType || 'STAY', order: order || 0 },
    });
    res.status(201).json(episode);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:slug/episodes/:id', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { title, subtitle, startDate, endDate, startLocation, endLocation, coverImageUrl, episodeType, order } = req.body;
    const episode = await prisma.journeyEpisode.update({
      where: { id: req.params.id },
      data: { ...(title && { title }), ...(subtitle !== undefined && { subtitle }), ...(startDate && { startDate: new Date(startDate) }), ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }), ...(startLocation !== undefined && { startLocation }), ...(endLocation !== undefined && { endLocation }), ...(coverImageUrl !== undefined && { coverImageUrl }), ...(episodeType && { episodeType }), ...(order !== undefined && { order }) },
    });
    res.json(episode);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:slug/episodes/:id', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.journeyEpisode.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/episodes/auto-generate', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, rigName: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const posts = await prisma.rigPost.findMany({ where: { rigId: rig.id, episodeId: null }, orderBy: { createdAt: 'asc' }, take: 50, select: { id: true, title: true, body: true, createdAt: true, postType: true } });
    if (posts.length === 0) return res.json({ episodes: [] });

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic.default();
    const postSummary = posts.map((p: any) => `${p.createdAt.toISOString().split('T')[0]} | ${p.postType} | ${p.title || p.body?.slice(0, 60) || 'no content'}`).join('\n');
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 500,
      messages: [{ role: 'user', content: `Group these RV travel posts into journey episodes. Each episode should cover a logical travel segment (a stay, a travel day, a discovery). Return JSON array: [{title, startDate, endDate, episodeType: TRAVEL|STAY|INCIDENT|DISCOVERY|OTHER}]\n\nPosts:\n${postSummary}` }],
    });
    const text = (response.content[0] as any)?.text || '[]';
    const match = text.match(/\[[\s\S]*\]/);
    const episodes = match ? JSON.parse(match[0]) : [];
    res.json({ episodes, postCount: posts.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// MOMENTS
// ═══════════════════════════════════════════════════════════════════════

router.get('/:slug/moments', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const where: any = { rigId: rig.id };
    if (req.query.featured === 'true') where.isFeatured = true;
    const moments = await prisma.rigMoment.findMany({
      where, include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(moments);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/moments', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { momentType, title, body, photoUrls, lat, lng, campgroundId, episodeId } = req.body;
    const moment = await prisma.rigMoment.create({
      data: { rigId: rig.id, userId: req.userId, momentType: momentType || 'SCENIC', title, body, photoUrls: photoUrls || [], lat, lng, campgroundId, episodeId },
    });
    res.status(201).json(moment);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/moments/:id/feature', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const m = await prisma.rigMoment.findUnique({ where: { id: req.params.id }, select: { isFeatured: true } });
    const updated = await prisma.rigMoment.update({ where: { id: req.params.id }, data: { isFeatured: !m?.isFeatured } });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// QUESTIONS & ANSWERS
// ═══════════════════════════════════════════════════════════════════════

router.get('/:slug/questions', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const questions = await prisma.rigQuestion.findMany({
      where: { rigId: rig.id },
      include: { asker: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } } },
      orderBy: [{ answeredAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    res.json(questions);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/questions', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const q = await prisma.rigQuestion.create({
      data: { rigId: rig.id, askerId: req.userId, question: req.body.question },
      include: { asker: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
    });
    res.status(201).json(q);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/questions/:id/answer', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const q = await prisma.rigQuestion.update({
      where: { id: req.params.id }, data: { answer: req.body.answer, answeredAt: new Date() },
    });
    res.json(q);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════

router.get('/:slug/suggestions', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const suggestions = await prisma.rigSuggestion.findMany({
      where: { rigId: rig.id },
      include: { suggester: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
      orderBy: { upvotes: 'desc' },
    });
    res.json(suggestions);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/suggestions', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const { type, content, campgroundId } = req.body;
    const s = await prisma.rigSuggestion.create({
      data: { rigId: rig.id, suggesterId: req.userId, type: type || 'NEXT_STOP', content, campgroundId },
      include: { suggester: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
    });
    res.status(201).json(s);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/suggestions/:id/upvote', authenticateToken, async (req: any, res) => {
  try {
    const s = await prisma.rigSuggestion.update({ where: { id: req.params.id }, data: { upvotes: { increment: 1 } } });
    res.json(s);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// POLLS
// ═══════════════════════════════════════════════════════════════════════

router.get('/:slug/polls', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const polls = await prisma.rigPoll.findMany({
      where: { rigId: rig.id },
      include: { creator: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(polls);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/polls', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { question, options, expiresAt } = req.body;
    const poll = await prisma.rigPoll.create({
      data: { rigId: rig.id, creatorId: req.userId, question, options, expiresAt: expiresAt ? new Date(expiresAt) : null },
    });
    res.status(201).json(poll);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/polls/:id/vote', authenticateToken, async (req: any, res) => {
  try {
    const { optionIndex } = req.body;
    const poll = await prisma.rigPoll.findUnique({ where: { id: req.params.id } });
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) return res.status(400).json({ error: 'Poll expired' });
    const votes = (poll.votes as any) || {};
    votes[req.userId] = optionIndex;
    const updated = await prisma.rigPoll.update({ where: { id: req.params.id }, data: { votes } });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// GUEST MOMENTS
// ═══════════════════════════════════════════════════════════════════════

router.get('/:slug/guest-moments', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const moments = await prisma.rigGuestMoment.findMany({
      where: { rigId: rig.id },
      include: { author: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(moments);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/guest-moments', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const { content, photoUrls, metAt, siteNumber } = req.body;
    const gm = await prisma.rigGuestMoment.create({
      data: { rigId: rig.id, authorId: req.userId, content, photoUrls: photoUrls || [], metAt, siteNumber },
      include: { author: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
    });
    res.status(201).json(gm);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// FOLLOW PREFERENCES
// ═══════════════════════════════════════════════════════════════════════

router.put('/:slug/follow-preference', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const pref = await prisma.rigFollowPreference.upsert({
      where: { rigId_userId: { rigId: rig.id, userId: req.userId } },
      create: { rigId: rig.id, userId: req.userId, mode: req.body.mode || 'FULL' },
      update: { mode: req.body.mode || 'FULL' },
    });
    res.json(pref);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// LIVE STATUS
// ═══════════════════════════════════════════════════════════════════════

router.post('/:slug/live', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { currentCampgroundId, onTheRoadEta } = req.body;
    const updated = await prisma.rig.update({
      where: { id: rig.id },
      data: { isLiveNow: true, currentCampgroundId, onTheRoadEta: onTheRoadEta ? new Date(onTheRoadEta) : null, lastLocationUpdate: new Date() },
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:slug/live', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.rig.update({ where: { id: rig.id }, data: { isLiveNow: false, currentCampgroundId: null, onTheRoadEta: null } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// TRIP RECAP & STATS SYNC
// ═══════════════════════════════════════════════════════════════════════

router.post('/:slug/sync-stats', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const episodes = await prisma.journeyEpisode.findMany({ where: { rigId: rig.id }, select: { startDate: true, endDate: true, startLocation: true, endLocation: true } });
    const moments = await prisma.rigMoment.findMany({ where: { rigId: rig.id }, select: { lat: true, lng: true } });
    const statesSet = new Set<string>();
    let totalNights = 0;
    for (const ep of episodes) {
      if (ep.endDate && ep.startDate) {
        totalNights += Math.ceil((new Date(ep.endDate).getTime() - new Date(ep.startDate).getTime()) / 86400000);
      }
      if (ep.startLocation) statesSet.add(ep.startLocation.split(',').pop()?.trim() || '');
      if (ep.endLocation) statesSet.add(ep.endLocation.split(',').pop()?.trim() || '');
    }
    statesSet.delete('');
    await prisma.rig.update({
      where: { id: rig.id },
      data: { totalNights, statesVisited: Array.from(statesSet), totalMiles: rig.totalMilesDriven || 0 },
    });
    res.json({ totalNights, statesVisited: Array.from(statesSet) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/recap', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, rigName: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { startDate, endDate } = req.body;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 14 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();

    const [episodes, moments, posts] = await Promise.all([
      prisma.journeyEpisode.findMany({ where: { rigId: rig.id, startDate: { gte: start, lte: end } }, orderBy: { order: 'asc' } }),
      prisma.rigMoment.findMany({ where: { rigId: rig.id, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'asc' } }),
      prisma.rigPost.findMany({ where: { rigId: rig.id, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'asc' }, take: 30 }),
    ]);

    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    const topMoments = moments.filter((m: any) => m.isFeatured).slice(0, 5);
    const mapPoints = moments.filter((m: any) => m.lat && m.lng).map((m: any) => ({ lat: m.lat, lng: m.lng, title: m.title }));

    // Generate narrative
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic.default();
    const summary = episodes.map((e: any) => `${e.episodeType}: ${e.title} (${e.startLocation || '?'} → ${e.endLocation || '?'})`).join('\n');
    const momentSummary = moments.slice(0, 10).map((m: any) => `${m.momentType}: ${m.title}`).join(', ');
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `Write a short, warm ${days}-day trip recap for an RV named "${rig.rigName || 'our rig'}". Episodes:\n${summary}\nHighlight moments: ${momentSummary}\n\nWrite 3-4 sentences, celebratory tone. Include fun stats if natural.` }],
    });
    const narrative = (response.content[0] as any)?.text || '';

    res.json({ narrative, days, episodeCount: episodes.length, momentCount: moments.length, postCount: posts.length, topMoments, mapPoints, stats: { statesVisited: [...new Set(episodes.flatMap((e: any) => [e.startLocation, e.endLocation].filter(Boolean)))].length } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// RIG FEED V2 — STOPS, ROUTES, BUNDLES, STRUCTURED FEED
// ═══════════════════════════════════════════════════════════════════════

import { bundleMoments, autoAssignToStops, generateInsightCards } from '../services/rigFeedNormalizer';

// GET /rigs/:slug/feed/v2 — structured feed
router.get('/:slug/feed/v2', optionalAuth, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, rigName: true, isLiveNow: true, currentCampgroundId: true, lastLocationUpdate: true, onTheRoadEta: true, totalMiles: true, totalNights: true, statesVisited: true, followerCount: true, totalMilesDriven: true, totalStatesCount: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    const [stops, routes, insights, bundles] = await Promise.all([
      prisma.rigStop.findMany({ where: { rigId: rig.id }, orderBy: { order: 'asc' } }),
      prisma.rigRouteSegment.findMany({ where: { rigId: rig.id }, orderBy: { startedAt: 'asc' } }),
      prisma.rigInsightCard.findMany({ where: { rigId: rig.id }, orderBy: { generatedAt: 'desc' } }),
      prisma.rigMomentBundle.findMany({ where: { rigId: rig.id }, orderBy: { bundledAt: 'desc' }, take: 20 }),
    ]);

    // Resolve contributor avatars for stops
    const allContributorIds = [...new Set(stops.flatMap((s: any) => s.contributorIds || []))];
    const contributorUsers = allContributorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: allContributorIds } }, select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } })
      : [];
    const contributorMap = new Map(contributorUsers.map((u: any) => [u.id, u]));

    // Build interleaved feed items
    const feedItems: any[] = [];
    for (const stop of stops) {
      const stopBundles = bundles.filter(b => b.stopId === stop.id);
      const contributors = ((stop as any).contributorIds || []).map((id: string) => contributorMap.get(id)).filter(Boolean);
      feedItems.push({ type: 'STOP', data: { ...stop, bundles: stopBundles, contributors }, occurredAt: stop.arrivedAt });
    }
    for (const route of routes) {
      feedItems.push({ type: 'ROUTE', data: route, occurredAt: route.startedAt });
    }
    for (const insight of insights) {
      feedItems.push({ type: 'INSIGHT', data: insight, occurredAt: insight.generatedAt });
    }
    feedItems.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    // Insert insight cards after every 3rd stop
    const currentStop = stops.find(s => !s.departedAt) || stops[stops.length - 1] || null;
    const journeyStrip = stops.map(s => ({ id: s.id, name: s.name, status: !s.departedAt ? 'CURRENT' : 'VISITED', order: s.order }));

    const totalMiles = routes.reduce((s, r: any) => s + (r.distanceMiles || 0), 0) + (rig.totalMilesDriven || rig.totalMiles || 0);
    const daysOnRoad = stops.length > 0 ? Math.ceil((Date.now() - new Date(stops[0].arrivedAt).getTime()) / 86400000) : 0;

    res.json({
      currentStop,
      journeyStrip,
      feedItems,
      stats: { totalMiles: Math.round(totalMiles), daysOnRoad, statesCount: rig.totalStatesCount || rig.statesVisited?.length || 0, followersCount: rig.followerCount },
      liveStatus: { isLive: rig.isLiveNow, currentCampground: rig.currentCampgroundId, lastUpdated: rig.lastLocationUpdate, eta: rig.onTheRoadEta },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Stops CRUD
router.get('/:slug/stops', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const stops = await prisma.rigStop.findMany({ where: { rigId: rig.id }, orderBy: { order: 'asc' } });
    res.json(stops);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/stops', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { name, lat, lng, campgroundId, tripId, arrivedAt, departedAt, milesFromLastStop, order } = req.body;
    const stop = await prisma.rigStop.create({
      data: { rigId: rig.id, name, lat, lng, campgroundId, tripId, arrivedAt: arrivedAt ? new Date(arrivedAt) : new Date(), departedAt: departedAt ? new Date(departedAt) : null, milesFromLastStop, order: order || 0, contributorIds: [req.userId] },
    });
    res.status(201).json(stop);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:slug/stops/:id', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const stop = await prisma.rigStop.update({ where: { id: req.params.id }, data: req.body });
    res.json(stop);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug/stops/:id', async (req: any, res) => {
  try {
    const stop = await prisma.rigStop.findUnique({ where: { id: req.params.id } });
    if (!stop) return res.status(404).json({ error: 'Stop not found' });
    const bundles = await prisma.rigMomentBundle.findMany({ where: { stopId: stop.id }, orderBy: { bundledAt: 'desc' } });
    const posts = await prisma.rigPost.findMany({
      where: { stopId: stop.id },
      include: { author: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ...stop, bundles, posts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Route segments
router.post('/:slug/routes', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { fromStopId, toStopId, fromLabel, toLabel, distanceMiles, durationMinutes, roadType, fuelStops, highlight, routePolyline, startedAt, endedAt, tripId } = req.body;
    const route = await prisma.rigRouteSegment.create({
      data: { rigId: rig.id, fromStopId, toStopId, fromLabel, toLabel, distanceMiles, durationMinutes, roadType: roadType || 'MIXED', fuelStops: fuelStops || 0, highlight, routePolyline, startedAt: startedAt ? new Date(startedAt) : new Date(), endedAt: endedAt ? new Date(endedAt) : null, tripId },
    });
    res.status(201).json(route);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug/routes', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const routes = await prisma.rigRouteSegment.findMany({ where: { rigId: rig.id }, orderBy: { startedAt: 'asc' } });
    res.json(routes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Bundles
router.get('/:slug/stops/:stopId/bundles', async (req: any, res) => {
  try {
    const bundles = await prisma.rigMomentBundle.findMany({ where: { stopId: req.params.stopId }, orderBy: { bundledAt: 'desc' } });
    res.json(bundles);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Normalize trigger
router.post('/:slug/normalize', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const [bundleResult, assignResult] = await Promise.all([
      bundleMoments(rig.id),
      autoAssignToStops(rig.id),
    ]);
    const insightResult = await generateInsightCards(rig.id);
    res.json({ ...bundleResult, ...assignResult, ...insightResult });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Insight cards
router.get('/:slug/insights', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const cards = await prisma.rigInsightCard.findMany({ where: { rigId: rig.id }, orderBy: { generatedAt: 'desc' } });
    res.json(cards);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Smart upload
router.post('/:slug/posts/smart', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { title, body, photos, postType, tripId, confirm } = req.body;

    // Calculate mediaHash
    const mediaHash = photos?.[0] ? require('crypto').createHash('md5').update(photos[0]).digest('hex') : null;

    // Check for duplicate
    if (mediaHash) {
      const dup = await prisma.rigPost.findFirst({ where: { rigId: rig.id, mediaHash } });
      if (dup && !confirm) {
        return res.json({ duplicate: true, existingPostId: dup.id, message: 'Looks like you already posted this photo' });
      }
    }

    // Find nearby stop
    let suggestedStopId = null;
    const recentStop = await prisma.rigStop.findFirst({ where: { rigId: rig.id, departedAt: null }, orderBy: { arrivedAt: 'desc' } });
    if (recentStop) suggestedStopId = recentStop.id;

    if (!confirm && suggestedStopId) {
      const stop = await prisma.rigStop.findUnique({ where: { id: suggestedStopId }, select: { name: true } });
      return res.json({ suggestedStopId, suggestedStopName: stop?.name, message: `This looks like it belongs to: ${stop?.name}` });
    }

    // Create post
    const post = await prisma.rigPost.create({
      data: { rigId: rig.id, userId: req.userId, title, body, photos: photos || [], postType: postType || 'road_report', tripId, mediaHash, stopId: suggestedStopId, activityType: 'PHOTO_MOMENT' },
      include: { author: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
    });

    // Background: normalize
    setImmediate(() => {
      bundleMoments(rig.id).catch(() => {});
      autoAssignToStops(rig.id).catch(() => {});
    });

    res.status(201).json(post);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Admin: normalize all rigs (Phase 12 backfill)
router.post('/admin/normalize-all', authenticateToken, async (req: any, res) => {
  try {
    const rigs = await prisma.rig.findMany({ select: { id: true } });
    let processed = 0;
    for (const rig of rigs) {
      await bundleMoments(rig.id).catch(() => {});
      await autoAssignToStops(rig.id).catch(() => {});
      await generateInsightCards(rig.id).catch(() => {});
      processed++;
    }
    res.json({ processed });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// RIG TRIP MODE V2
// ═══════════════════════════════════════════════════════════════════════

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Trip management
router.post('/:slug/trips', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, activeTripId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    if (rig.activeTripId) return res.status(400).json({ error: 'A trip is already active. Complete it first.' });
    const { name, description, startDate } = req.body;
    if (!name) return res.status(400).json({ error: 'Trip name required' });
    const trip = await prisma.rigTrip.create({
      data: { rigId: rig.id, name, description, startDate: startDate ? new Date(startDate) : new Date(), status: 'ACTIVE',
        members: { create: { userId: req.userId, role: 'DRIVER' } } },
    });
    await prisma.rig.update({ where: { id: rig.id }, data: { activeTripId: trip.id } });
    res.status(201).json(trip);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug/trips', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const trips = await prisma.rigTrip.findMany({
      where: { rigId: rig.id }, orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: { _count: { select: { stops: true, routes: true, members: true } } },
    });
    res.json(trips);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug/trips/active', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, activeTripId: true } });
    if (!rig || !rig.activeTripId) return res.json(null);
    const trip = await prisma.rigTrip.findUnique({
      where: { id: rig.activeTripId },
      include: {
        stops: { orderBy: { order: 'asc' } },
        routes: { orderBy: { drivenAt: 'asc' } },
        milestones: { orderBy: { occurredAt: 'desc' } },
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } } } },
      },
    });
    res.json(trip);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug/trips/:tripId', async (req: any, res) => {
  try {
    const trip = await prisma.rigTrip.findUnique({
      where: { id: req.params.tripId },
      include: {
        stops: { orderBy: { order: 'asc' } },
        routes: { orderBy: { drivenAt: 'asc' } },
        milestones: { orderBy: { occurredAt: 'desc' } },
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } } } },
        _count: { select: { stops: true, routes: true } },
      },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:slug/trips/:tripId', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { name, description, coverImageUrl } = req.body;
    const trip = await prisma.rigTrip.update({
      where: { id: req.params.tripId },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(coverImageUrl !== undefined && { coverImageUrl }) },
    });
    res.json(trip);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/trips/:tripId/complete', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.rigTrip.update({ where: { id: req.params.tripId }, data: { status: 'COMPLETED', endDate: new Date() } });
    await prisma.rig.update({ where: { id: rig.id }, data: { activeTripId: null } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Stops
router.post('/:slug/trips/:tripId/stops', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { name, campgroundId, lat, lng, arrivedAt, city, state } = req.body;
    if (!name) return res.status(400).json({ error: 'Stop name required' });

    // Get previous stop for distance calc + order
    const lastStop = await prisma.rigTripStop.findFirst({
      where: { tripId: req.params.tripId }, orderBy: { order: 'desc' },
      select: { id: true, order: true, lat: true, lng: true, name: true },
    });
    const order = (lastStop?.order ?? -1) + 1;
    const miles = lastStop?.lat && lastStop?.lng && lat && lng ? haversineDistance(lastStop.lat, lastStop.lng, lat, lng) : null;

    // Unset all isCurrentStop
    await prisma.rigTripStop.updateMany({ where: { tripId: req.params.tripId }, data: { isCurrentStop: false } });

    const stop = await prisma.rigTripStop.create({
      data: { tripId: req.params.tripId, rigId: rig.id, name, campgroundId, lat, lng, city, state,
        arrivedAt: arrivedAt ? new Date(arrivedAt) : new Date(), order, isCurrentStop: true,
        milesFromPreviousStop: miles ? Math.round(miles * 10) / 10 : null },
    });

    // Auto-create route from last stop
    if (lastStop && miles) {
      await prisma.rigTripRoute.create({
        data: { tripId: req.params.tripId, fromStopId: lastStop.id, toStopId: stop.id,
          distanceMiles: Math.round(miles * 10) / 10, drivenAt: new Date(),
          durationMinutes: Math.round(miles / 0.5) }, // 30mph estimate
      }).catch(() => {});
    }

    res.status(201).json(stop);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:slug/trips/:tripId/stops/:stopId', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const stop = await prisma.rigTripStop.update({ where: { id: req.params.stopId }, data: req.body });
    res.json(stop);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/trips/:tripId/stops/:stopId/checkout', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const stop = await prisma.rigTripStop.findUnique({ where: { id: req.params.stopId } });
    if (!stop) return res.status(404).json({ error: 'Stop not found' });

    const nights = Math.max(1, Math.ceil((Date.now() - new Date(stop.arrivedAt).getTime()) / 86400000));
    await prisma.rigTripStop.update({
      where: { id: req.params.stopId },
      data: { departedAt: new Date(), nightsStayed: nights, isCurrentStop: false },
    });

    // Sync trip stats
    const allStops = await prisma.rigTripStop.findMany({ where: { tripId: req.params.tripId }, select: { nightsStayed: true, state: true, campgroundId: true } });
    const allRoutes = await prisma.rigTripRoute.findMany({ where: { tripId: req.params.tripId }, select: { distanceMiles: true } });
    const totalMiles = allRoutes.reduce((s: number, r: any) => s + (r.distanceMiles || 0), 0);
    const totalNights = allStops.reduce((s: number, st: any) => s + (st.nightsStayed || 0), 0);
    const states = [...new Set(allStops.map((s: any) => s.state).filter(Boolean))];
    const campgrounds = allStops.filter((s: any) => s.campgroundId).length;
    await prisma.rigTrip.update({
      where: { id: req.params.tripId },
      data: { totalMiles: Math.round(totalMiles * 10) / 10, totalNights, statesVisited: states, campgroundCount: campgrounds },
    });

    // Check milestones
    const milestoneChecks = [
      { threshold: 100, type: 'MILES_100', title: '100 miles on this trip!' },
      { threshold: 500, type: 'MILES_500', title: '500 miles driven!' },
      { threshold: 1000, type: 'MILES_1000', title: '1,000 miles on the road!' },
    ];
    const newMilestones: string[] = [];
    for (const mc of milestoneChecks) {
      if (totalMiles >= mc.threshold) {
        const existing = await prisma.rigTripMilestone.findFirst({ where: { tripId: req.params.tripId, milestoneType: mc.type } });
        if (!existing) {
          await prisma.rigTripMilestone.create({
            data: { tripId: req.params.tripId, rigId: rig.id, milestoneType: mc.type, title: mc.title, value: String(mc.threshold), occurredAt: new Date(), stopId: req.params.stopId },
          });
          newMilestones.push(mc.title);
        }
      }
    }
    // New state milestone
    if (stop.state) {
      const prevStops = await prisma.rigTripStop.findMany({ where: { tripId: req.params.tripId, id: { not: stop.id } }, select: { state: true } });
      const prevStates = new Set(prevStops.map((s: any) => s.state).filter(Boolean));
      if (!prevStates.has(stop.state)) {
        const existing = await prisma.rigTripMilestone.findFirst({ where: { tripId: req.params.tripId, milestoneType: 'NEW_STATE', value: stop.state } });
        if (!existing) {
          await prisma.rigTripMilestone.create({
            data: { tripId: req.params.tripId, rigId: rig.id, milestoneType: 'NEW_STATE', title: `Entered ${stop.state}!`, value: stop.state, occurredAt: new Date(), stopId: req.params.stopId },
          });
          newMilestones.push(`Entered ${stop.state}!`);
        }
      }
    }

    res.json({ success: true, nightsStayed: nights, newMilestones });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug/trips/:tripId/stops/:stopId', async (req: any, res) => {
  try {
    const stop = await prisma.rigTripStop.findUnique({ where: { id: req.params.stopId } });
    if (!stop) return res.status(404).json({ error: 'Stop not found' });
    const posts = await prisma.rigPost.findMany({
      where: { rigId: stop.rigId, stopId: stop.id },
      include: { author: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ...stop, posts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Map data
router.get('/:slug/trips/:tripId/map', async (req: any, res) => {
  try {
    const [stops, routes] = await Promise.all([
      prisma.rigTripStop.findMany({ where: { tripId: req.params.tripId }, orderBy: { order: 'asc' }, select: { id: true, lat: true, lng: true, name: true, order: true, isCurrentStop: true, photoCount: true, state: true } }),
      prisma.rigTripRoute.findMany({ where: { tripId: req.params.tripId }, orderBy: { drivenAt: 'asc' }, select: { fromStopId: true, toStopId: true, distanceMiles: true, polyline: true } }),
    ]);
    const current = stops.find((s: any) => s.isCurrentStop);
    res.json({ stops, routes, currentLocation: current ? { lat: current.lat, lng: current.lng, name: current.name } : null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Playback
router.get('/:slug/trips/:tripId/playback', async (req: any, res) => {
  try {
    const [stops, routes, milestones] = await Promise.all([
      prisma.rigTripStop.findMany({ where: { tripId: req.params.tripId }, orderBy: { order: 'asc' } }),
      prisma.rigTripRoute.findMany({ where: { tripId: req.params.tripId }, orderBy: { drivenAt: 'asc' } }),
      prisma.rigTripMilestone.findMany({ where: { tripId: req.params.tripId }, orderBy: { occurredAt: 'asc' } }),
    ]);
    const items: any[] = [];
    for (const s of stops) items.push({ type: 'STOP', data: s, timestamp: s.arrivedAt });
    for (const r of routes) items.push({ type: 'ROUTE', data: r, timestamp: r.drivenAt });
    for (const m of milestones) items.push({ type: 'MILESTONE', data: m, timestamp: m.occurredAt });
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Milestones
router.get('/:slug/trips/:tripId/milestones', async (req: any, res) => {
  try {
    const milestones = await prisma.rigTripMilestone.findMany({ where: { tripId: req.params.tripId }, orderBy: { occurredAt: 'desc' } });
    res.json(milestones);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Trip recap
router.post('/:slug/trips/:tripId/recap', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, rigName: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const trip = await prisma.rigTrip.findUnique({
      where: { id: req.params.tripId },
      include: { stops: { orderBy: { order: 'asc' } }, milestones: true },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic.default();
    const stopList = trip.stops.map((s: any) => `${s.name} (${s.city || ''}, ${s.state || ''}) - ${s.nightsStayed} nights`).join('\n');
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      messages: [{ role: 'user', content: `Write a warm 3-4 paragraph trip recap for "${trip.name}" by RV "${rig.rigName || 'our rig'}". Stats: ${Math.round(trip.totalMiles)} miles, ${trip.totalNights} nights, ${trip.statesVisited.length} states. Stops:\n${stopList}\nWrite in first person from the travelers' perspective. Celebratory tone.` }],
    });
    const narrative = (response.content[0] as any)?.text || '';
    const topStops = trip.stops.sort((a: any, b: any) => b.photoCount - a.photoCount).slice(0, 5);
    res.json({ narrative, topStops, stats: { totalMiles: trip.totalMiles, totalNights: trip.totalNights, statesVisited: trip.statesVisited, campgroundCount: trip.campgroundCount } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Normalize posts to stops
router.post('/:slug/trips/:tripId/normalize', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const posts = await prisma.rigPost.findMany({ where: { rigId: rig.id, tripId: req.params.tripId, stopId: null }, orderBy: { createdAt: 'asc' } });
    const stops = await prisma.rigTripStop.findMany({ where: { tripId: req.params.tripId }, orderBy: { order: 'asc' } });
    let assigned = 0;
    for (const post of posts) {
      const postTime = new Date(post.createdAt).getTime();
      for (const stop of stops) {
        const arrived = new Date(stop.arrivedAt).getTime();
        const departed = stop.departedAt ? new Date(stop.departedAt).getTime() : Date.now();
        if (postTime >= arrived && postTime <= departed) {
          await prisma.rigPost.update({ where: { id: post.id }, data: { stopId: stop.id } });
          await prisma.rigTripStop.update({ where: { id: stop.id }, data: { photoCount: { increment: post.photos.length } } });
          assigned++;
          break;
        }
      }
    }
    res.json({ assigned, total: posts.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export { getFollowersForUser };
export default router;
