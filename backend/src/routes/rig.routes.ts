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

export { getFollowersForUser };
export default router;
