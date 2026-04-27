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

export { getFollowersForUser };
export default router;
