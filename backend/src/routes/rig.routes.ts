import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { optionalAuth } from '../middleware/auth.middleware';
import QRCode from 'qrcode';
import { uploadBufferToCloudinary } from '../utils/cloudinary';

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
  // Find user's canonical rig (owned or co-pilot)
  const { resolveUserRigId } = require('../services/rigResolver');
  const rig = await resolveUserRigId(userId);

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
    const forceCreate = req.body?.forceCreate === true;

    // Guard: don't create a duplicate if the user already has a rig (owned or co-pilot)
    const [existingOwned, existingPilot, existingCoPilot] = await Promise.all([
      prisma.rig.findFirst({ where: { ownerId: userId }, select: { id: true, slug: true, rigName: true } }),
      prisma.rigPilot.findFirst({ where: { userId }, select: { rig: { select: { id: true, slug: true, rigName: true } } } }),
      prisma.rigCoPilot.findFirst({ where: { userId }, select: { rig: { select: { id: true, slug: true, rigName: true } } } }),
    ]);

    // Already owns a rig — block (unless admin/forceCreate)
    if (existingOwned && !forceCreate) {
      return res.json({
        ...existingOwned,
        alreadyExists: true,
        message: 'You already have a rig page. Go to your existing rig page or contact support if you need multiple rig pages.',
      });
    }

    // Is a co-pilot on someone else's rig — offer choice
    const coPilotRig = existingPilot?.rig || existingCoPilot?.rig;
    if (coPilotRig && !forceCreate) {
      return res.json({
        alreadyCoPilot: true,
        existingRig: coPilotRig,
        message: `You are already a co-pilot on ${coPilotRig.rigName || 'a rig'}. Would you like to use that rig page instead of creating a new one?`,
      });
    }

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

// ============== TRIPS WITHOUT PHOTOS ==============

router.get('/trips-without-photos', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get last 10 trips (events) for this user, most recent first
    const trips = await prisma.event.findMany({
      where: {
        OR: [{ organizerId: userId }, { attendees: { some: { userId, status: { in: ['going', 'GOING'] } } } }],
        isWishlist: false,
      },
      orderBy: { startDate: 'desc' },
      take: 10,
      select: {
        id: true, title: true, startDate: true, endDate: true,
        campground: { select: { name: true } },
      },
    });

    const results: any[] = [];
    for (const trip of trips) {
      // Count photos for this trip
      const postPhotos = await prisma.rigPost.count({
        where: { tripId: trip.id, photos: { isEmpty: false } },
      }).catch(() => 0);
      const stopPhotos = await prisma.rigTripStop.count({
        where: { tripId: trip.id, coverImageUrl: { not: null } },
      }).catch(() => 0);

      if (postPhotos === 0 && stopPhotos === 0) {
        const endDate = trip.endDate || trip.startDate;
        const daysAgo = Math.floor((Date.now() - new Date(endDate).getTime()) / 86400000);
        const stopCount = await prisma.rigTripStop.count({ where: { tripId: trip.id } }).catch(() => 0);

        results.push({
          tripId: trip.id,
          tripName: trip.title,
          campgroundName: trip.campground?.name || null,
          startDate: trip.startDate,
          endDate: trip.endDate,
          daysAgo: Math.max(0, daysAgo),
          stopCount,
          isWithin30Days: daysAgo <= 30,
          hasPhotos: false,
        });
      }
      if (results.length >= 7) break;
    }

    res.json(results);
  } catch (error: any) {
    console.error('[TripsWithoutPhotos] Error:', error);
    res.json([]);
  }
});

// ============== TRIP PHOTO COUNT ==============

router.get('/trip/:tripId/photo-count', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { tripId } = req.params;
    // Count posts with photos linked to this trip
    const posts = await prisma.rigPost.findMany({
      where: { tripId, photos: { isEmpty: false } },
      select: { photos: true },
    }).catch(() => []);
    const postPhotoCount = posts.reduce((sum: number, p: any) => sum + (p.photos?.length || 0), 0);

    // Count trip stop photos
    const stops = await prisma.rigTripStop.findMany({
      where: { tripId, coverImageUrl: { not: null } },
      select: { id: true },
    }).catch(() => []);

    const count = postPhotoCount + stops.length;
    res.json({ count, hasPhotos: count > 0 });
  } catch (error: any) {
    res.json({ count: 0, hasPhotos: false });
  }
});

// ============== USER'S OWN RIGS ==============

router.get('/user/:userId/owned', optionalAuth, async (req: Request, res: Response) => {
  try {
    const rigs = await prisma.rig.findMany({
      where: { ownerId: req.params.userId, isPublic: true },
      select: { id: true, slug: true, rigName: true, heroPhoto: true, year: true, make: true, model: true, rigClass: true, rigEmoji: true },
      take: 5,
    });
    res.json(rigs);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get user rigs' });
  }
});

// ============== RIGS USER FOLLOWS ==============

router.get('/user/:userId/following', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      prisma.rigFollow.findMany({
        where: { userId },
        include: {
          rig: {
            select: {
              id: true,
              slug: true,
              rigName: true,
              heroPhoto: true,
              year: true,
              make: true,
              model: true,
              rigClass: true,
              followerCount: true,
              totalTripCount: true,
              totalStatesCount: true,
              owner: { select: safeUserSelect },
            },
          },
        },
        orderBy: { followedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.rigFollow.count({ where: { userId } }),
    ]);

    res.json({
      rigs: follows.map((f: any) => ({ ...f.rig, followedAt: f.followedAt })),
      total,
      page,
      hasMore: skip + follows.length < total,
    });
  } catch (error: any) {
    console.error('[Rig] get user following rigs error:', error.message);
    res.status(500).json({ error: 'Failed to get following rigs' });
  }
});

// POST /rigs/:slug/view — record a page view (fire-and-forget from frontend)
router.post('/:slug/view', authenticateToken, async (req: any, res) => {
  try {
    const viewerId = req.userId;

    // Find rig by slug or id
    const rig = await prisma.rig.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
      select: { id: true, ownerId: true },
    });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    // Don't record own views
    if (rig.ownerId === viewerId) return res.json({ ok: true });

    // Rate limit: max 1 view per user per rig per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.rigPageView.findFirst({
      where: { rigId: rig.id, viewerId, createdAt: { gte: oneHourAgo } },
    });
    if (recent) return res.json({ ok: true });

    await prisma.rigPageView.create({
      data: { rigId: rig.id, viewerId },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Record rig view error:', error);
    res.json({ ok: true }); // Don't fail the frontend
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

    // De-duplicate pilots by person (same firstName+lastName = same person, multiple accounts)
    const seenNames = new Set<string>();
    const dedupedPilots = (rig.pilots || []).filter((p: any) => {
      const name = `${p.user?.firstName || ''}:${p.user?.lastName || ''}`.toLowerCase();
      if (seenNames.has(name)) return false;
      seenNames.add(name);
      return true;
    });

    // Check if the requesting user follows this rig
    let isFollowing = false;
    if (userId) {
      const follow = await prisma.rigFollow.findUnique({
        where: { rigId_userId: { rigId: rig.id, userId } },
      });
      isFollowing = !!follow;
    }

    res.json({ ...rig, pilots: dedupedPilots, isFollowing });
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

    // Support both rigId (CUID) and slug
    let rig: any = null;
    if (rigId.startsWith('c') && rigId.length > 20) {
      rig = await prisma.rig.findUnique({ where: { id: rigId }, select: { id: true, ownerId: true } });
    }
    if (!rig) {
      rig = await prisma.rig.findUnique({ where: { slug: rigId }, select: { id: true, ownerId: true } });
    }
    if (!rig) {
      return res.json([]); // graceful empty for missing rig
    }

    // Get all user IDs associated with this rig (owner + co-pilots)
    const [pilots, coPilots] = await Promise.all([
      prisma.rigPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
      prisma.rigCoPilot.findMany({ where: { rigId: rig.id }, select: { userId: true } }),
    ]);
    const rigUserIds = [...new Set([rig.ownerId, ...pilots.map((p: any) => p.userId), ...coPilots.map((c: any) => c.userId)])];

    // Query 1: RigPost photos (direct rig uploads + trip posts)
    const posts = await prisma.rigPost.findMany({
      where: {
        photos: { isEmpty: false },
        OR: [
          { rigId: rig.id },
          { userId: { in: rigUserIds }, tripId: { not: null } },
          { userId: { in: rigUserIds }, rigId: null, tripId: null },
        ],
        visibility: { in: ['PUBLIC', 'BOTH', null] },
      },
      include: { author: { select: safeUserSelect } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Query 2: Photo table (trip album photos uploaded via /photos endpoint)
    // Include ALL photos from rig users — older photos won't have surfaces field
    const eventPhotos = await prisma.photo.findMany({
      where: {
        userId: { in: rigUserIds },
        isPrivate: false,
        NOT: { visibility: 'PRIVATE' },
      },
      select: { id: true, imageUrl: true, caption: true, createdAt: true, eventId: true, userId: true,
        user: { select: safeUserSelect },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    // Convert Photo records into the same shape as RigPost for the frontend
    // Group by eventId (or 'standalone' for photos without a trip)
    const eventPhotoMap = new Map<string, any[]>();
    for (const p of eventPhotos) {
      const key = p.eventId || `standalone-${p.userId}`;
      if (!eventPhotoMap.has(key)) eventPhotoMap.set(key, []);
      eventPhotoMap.get(key)!.push(p);
    }

    const syntheticPosts = Array.from(eventPhotoMap.entries()).map(([eventId, photos]) => ({
      id: `event-${eventId}`,
      rigId: rig.id,
      userId: photos[0].userId,
      photos: photos.map((p: any) => p.imageUrl),
      isRigPhoto: false,
      photoCategory: 'TRAVEL',
      createdAt: photos[0].createdAt,
      author: photos[0].user,
      _source: 'trip_album',
    }));

    // Merge and deduplicate (avoid showing same photo twice)
    const existingPhotoUrls = new Set(posts.flatMap((p: any) => p.photos || []));
    const dedupedSynthetic = syntheticPosts.map(sp => ({
      ...sp,
      photos: sp.photos.filter((url: string) => !existingPhotoUrls.has(url)),
    })).filter(sp => sp.photos.length > 0);

    const allPosts = [...posts, ...dedupedSynthetic].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(allPosts);
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

    const { title, body, photos, postType, tripId, isPublic, visibility } = req.body;

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
        visibility: visibility || 'PUBLIC',
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

// ============== ENTITY FOLLOW (rig ↔ campsite) ==============

// POST /:slug/follow-campground/:campgroundId — rig follows a campsite
router.post('/:slug/follow-campground/:campgroundId', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const { authorized } = await isOwnerOrEditor(rig.id, req.userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const campgroundId = req.params.campgroundId;
    const existing = await prisma.entityFollow.findUnique({
      where: { followerType_followerId_targetType_targetId: { followerType: 'RIG', followerId: rig.id, targetType: 'CAMPGROUND', targetId: campgroundId } },
    });

    if (existing) {
      await prisma.entityFollow.delete({ where: { id: existing.id } });
      return res.json({ following: false });
    }

    await prisma.entityFollow.create({
      data: { followerType: 'RIG', followerId: rig.id, targetType: 'CAMPGROUND', targetId: campgroundId },
    });
    res.json({ following: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /campground/:campgroundId/follow-rig/:rigId — campsite follows a rig (claimed only)
router.post('/campground/:campgroundId/follow-rig/:rigId', authenticateToken, async (req: any, res) => {
  try {
    const { campgroundId, rigId } = req.params;

    // Verify campground is claimed by this user
    const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { claimedById: true } });
    if (!campground?.claimedById) return res.status(403).json({ error: 'Campground must be claimed to follow rigs' });
    if (campground.claimedById !== req.userId) {
      const admin = await prisma.campgroundAdmin.findUnique({ where: { userId_campgroundId: { userId: req.userId, campgroundId } } });
      if (!admin) return res.status(403).json({ error: 'Not a manager of this campground' });
    }

    const existing = await prisma.entityFollow.findUnique({
      where: { followerType_followerId_targetType_targetId: { followerType: 'CAMPGROUND', followerId: campgroundId, targetType: 'RIG', targetId: rigId } },
    });

    if (existing) {
      await prisma.entityFollow.delete({ where: { id: existing.id } });
      return res.json({ following: false });
    }

    await prisma.entityFollow.create({
      data: { followerType: 'CAMPGROUND', followerId: campgroundId, targetType: 'RIG', targetId: rigId, managerId: req.userId },
    });
    res.json({ following: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /:slug/following-campgrounds — campgrounds this rig follows
router.get('/:slug/following-campgrounds', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    const follows = await prisma.entityFollow.findMany({
      where: { followerType: 'RIG', followerId: rig.id, targetType: 'CAMPGROUND' },
      orderBy: { createdAt: 'desc' },
    });

    const campgroundIds = follows.map((f: any) => f.targetId);
    const campgrounds = campgroundIds.length > 0 ? await prisma.campground.findMany({
      where: { id: { in: campgroundIds } },
      select: { id: true, name: true, imageUrl: true, city: true, state: true },
    }) : [];

    res.json(campgrounds);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /campground/:campgroundId/following-rigs — rigs this campsite follows (claimed campgrounds only)
router.get('/campground/:campgroundId/following-rigs', async (req: any, res) => {
  try {
    const follows = await prisma.entityFollow.findMany({
      where: { followerType: 'CAMPGROUND', followerId: req.params.campgroundId, targetType: 'RIG' },
      orderBy: { createdAt: 'desc' },
    });

    const rigIds = follows.map((f: any) => f.targetId);
    const rigs = rigIds.length > 0 ? await prisma.rig.findMany({
      where: { id: { in: rigIds }, isPublic: true },
      select: { id: true, slug: true, rigName: true, heroPhoto: true, followerCount: true },
    }) : [];

    res.json(rigs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============== PAGE FEEDBACK (open — any logged-in user) ==============

// POST /feedback — leave feedback on a rig or campsite page
router.post('/feedback', authenticateToken, async (req: any, res) => {
  try {
    const { pageType, pageId, content, rating } = req.body;
    if (!['RIG', 'CAMPGROUND'].includes(pageType)) return res.status(400).json({ error: 'pageType must be RIG or CAMPGROUND' });
    if (!pageId || !content?.trim()) return res.status(400).json({ error: 'pageId and content required' });

    const feedback = await prisma.pageFeedback.create({
      data: { userId: req.userId, pageType, pageId, content: content.trim(), rating: rating ? Math.min(5, Math.max(1, parseInt(rating))) : null },
    });
    res.status(201).json(feedback);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /feedback/:pageType/:pageId — get feedback for a page
router.get('/feedback/:pageType/:pageId', async (req: any, res) => {
  try {
    const { pageType, pageId } = req.params;
    const feedback = await prisma.pageFeedback.findMany({
      where: { pageType, pageId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Enrich with user data
    const userIds = [...new Set(feedback.map((f: any) => f.userId))];
    const users = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
    }) : [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    res.json(feedback.map((f: any) => ({ ...f, user: userMap.get(f.userId) || null })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============== PERSONAL PLACES ==============

// POST /personal-places — create a saved personal place (private by default)
router.post('/personal-places', authenticateToken, async (req: any, res) => {
  try {
    const { name, address, city, state, lat, lng, placeType, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const place = await prisma.personalPlace.create({
      data: {
        userId: req.userId,
        name: name.trim(),
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        placeType: placeType || 'CUSTOM',
        notes: notes?.trim() || null,
        isPrivate: true,
      },
    });
    res.status(201).json(place);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /personal-places — list user's saved personal places
router.get('/personal-places', authenticateToken, async (req: any, res) => {
  try {
    const places = await prisma.personalPlace.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(places);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /personal-places/:id — delete a personal place
router.delete('/personal-places/:id', authenticateToken, async (req: any, res) => {
  try {
    const place = await prisma.personalPlace.findUnique({ where: { id: req.params.id } });
    if (!place || place.userId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.personalPlace.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============== ROUTE-AWARE STOP RECOMMENDATIONS ==============

const HERE_API_KEY_ROUTE = process.env.HERE_API_KEY || '15BglBtc7-1HzjsdvTvzscQGOYwrpZPvJWZRqkyOrLE';

// Decode HERE flexible polyline (simplified — returns array of [lat, lng])
function decodeFlexPolyline(encoded: string): [number, number][] {
  // HERE uses flexible polyline encoding; this is a simplified decoder
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  try {
    // Skip header byte
    const header = encoded.charCodeAt(index++) - 63;
    const precision = Math.pow(10, -(header & 0x0F));
    const thirdDim = (header >> 4) & 0x07;

    while (index < encoded.length) {
      let shift = 0, result = 0, byte;
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1F) << shift; shift += 5; } while (byte >= 0x20);
      lat += (result & 1 ? ~(result >> 1) : result >> 1);

      shift = 0; result = 0;
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1F) << shift; shift += 5; } while (byte >= 0x20);
      lng += (result & 1 ? ~(result >> 1) : result >> 1);

      if (thirdDim) { // skip altitude if present
        shift = 0; result = 0;
        do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1F) << shift; shift += 5; } while (byte >= 0x20);
      }

      points.push([lat * precision, lng * precision]);
    }
  } catch { /* fallback: return what we have */ }
  return points;
}

// POST /route-stops — get route-aware stop recommendations
router.post('/route-stops', authenticateToken, async (req: any, res) => {
  try {
    const { originLat, originLng, destLat, destLng, maxDriveHours = 8 } = req.body;
    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ error: 'Origin and destination coordinates required' });
    }

    // 1. Get route with polyline from HERE
    const routeUrl = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${originLat},${originLng}&destination=${destLat},${destLng}&return=summary,polyline&apikey=${HERE_API_KEY_ROUTE}`;
    const routeRes = await fetch(routeUrl);
    const routeData = await routeRes.json() as any;

    const sections = routeData?.routes?.[0]?.sections || [];
    if (sections.length === 0) return res.json({ waypoints: [], totalMiles: 0, totalHours: 0 });

    const totalMeters = sections.reduce((s: number, sec: any) => s + (sec.summary?.length || 0), 0);
    const totalSeconds = sections.reduce((s: number, sec: any) => s + (sec.summary?.duration || 0), 0);
    const totalMiles = Math.round(totalMeters / 1609.344);
    const totalHours = Math.round(totalSeconds / 3600 * 10) / 10;

    // 2. Decode polyline and find waypoints at maxDriveHours intervals
    const allPoints: [number, number][] = [];
    for (const sec of sections) {
      if (sec.polyline) {
        const pts = decodeFlexPolyline(sec.polyline);
        allPoints.push(...pts);
      }
    }

    const maxDriveSeconds = maxDriveHours * 3600;
    const waypoints: { lat: number; lng: number; hoursFromStart: number; milesFromStart: number }[] = [];

    if (allPoints.length > 2 && totalSeconds > maxDriveSeconds) {
      // Interpolate points at each maxDriveHours interval
      const segmentCount = Math.floor(totalSeconds / maxDriveSeconds);
      for (let i = 1; i <= segmentCount; i++) {
        const targetFraction = (i * maxDriveSeconds) / totalSeconds;
        const pointIndex = Math.min(Math.floor(targetFraction * allPoints.length), allPoints.length - 1);
        const pt = allPoints[pointIndex];
        if (pt) {
          waypoints.push({
            lat: pt[0],
            lng: pt[1],
            hoursFromStart: Math.round(i * maxDriveHours * 10) / 10,
            milesFromStart: Math.round(targetFraction * totalMiles),
          });
        }
      }
    }

    // 3. For each waypoint, find nearby campgrounds + overnight stops
    const recommendations: any[] = [];
    for (const wp of waypoints) {
      const nearby: any[] = [];

      // Search campgrounds near waypoint (within ~30 miles)
      const campgrounds = await prisma.campground.findMany({
        where: {
          latitude: { gte: wp.lat - 0.5, lte: wp.lat + 0.5 },
          longitude: { gte: wp.lng - 0.5, lte: wp.lng + 0.5 },
        },
        select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true, tier: true },
        take: 5,
      });

      for (const cg of campgrounds) {
        if (!cg.latitude || !cg.longitude) continue;
        const dLat = (cg.latitude - wp.lat) * 69;
        const dLng = (cg.longitude - wp.lng) * 69 * Math.cos(wp.lat * Math.PI / 180);
        const miles = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10;
        if (miles <= 30) {
          nearby.push({ type: 'CAMPGROUND', id: cg.id, name: cg.name, city: cg.city, state: cg.state, lat: cg.latitude, lng: cg.longitude, imageUrl: cg.imageUrl, distanceMiles: miles });
        }
      }

      // Search overnight stops near waypoint
      const overnightStops = await prisma.overnightStop.findMany({
        where: {
          latitude: { gte: wp.lat - 0.3, lte: wp.lat + 0.3 },
          longitude: { gte: wp.lng - 0.3, lte: wp.lng + 0.3 },
          isRVFriendly: true,
        },
        select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, stopType: true, chain: true },
        take: 5,
      }).catch(() => []);

      for (const os of overnightStops) {
        if (!os.latitude || !os.longitude) continue;
        const dLat = (os.latitude - wp.lat) * 69;
        const dLng = (os.longitude - wp.lng) * 69 * Math.cos(wp.lat * Math.PI / 180);
        const miles = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10;
        if (miles <= 20) {
          nearby.push({ type: 'OVERNIGHT', id: os.id, name: os.name, city: os.city, state: os.state, lat: os.latitude, lng: os.longitude, chain: os.chain, distanceMiles: miles });
        }
      }

      nearby.sort((a, b) => a.distanceMiles - b.distanceMiles);

      recommendations.push({
        waypoint: wp,
        stops: nearby.slice(0, 8),
        noOptionsFound: nearby.length === 0,
      });
    }

    res.json({
      totalMiles,
      totalHours,
      maxDriveHours,
      waypointCount: waypoints.length,
      recommendations,
    });
  } catch (e: any) {
    console.error('[RouteStops] error:', e.message);
    res.status(500).json({ error: 'Failed to compute route stops' });
  }
});

// ============== TOWN/ZIP STOP SEARCH ==============

// POST /search-stops — geocode a town/ZIP and find nearby real stops
router.post('/search-stops', authenticateToken, async (req: any, res) => {
  try {
    const { query, radius = 30 } = req.body; // query = town name or ZIP
    if (!query?.trim()) return res.status(400).json({ error: 'Search query required' });

    // 1. Geocode via HERE
    const geoUrl = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(query.trim())}&limit=1&apikey=${HERE_API_KEY_ROUTE}`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json() as any;
    const position = geoData?.items?.[0]?.position;
    if (!position) return res.json({ location: null, stops: [], message: 'Location not found' });

    const { lat, lng } = position;
    const locationName = geoData.items[0].address?.label || query;

    // 2. Search campgrounds nearby
    const degRadius = radius / 69; // rough miles-to-degrees
    const campgrounds = await prisma.campground.findMany({
      where: {
        latitude: { gte: lat - degRadius, lte: lat + degRadius },
        longitude: { gte: lng - degRadius, lte: lng + degRadius },
      },
      select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true, tier: true },
      take: 10,
    });

    // 3. Search overnight stops nearby
    const overnightStops = await prisma.overnightStop.findMany({
      where: {
        latitude: { gte: lat - degRadius * 0.7, lte: lat + degRadius * 0.7 },
        longitude: { gte: lng - degRadius * 0.7, lte: lng + degRadius * 0.7 },
      },
      select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, stopType: true, chain: true, isRVFriendly: true },
      take: 10,
    }).catch(() => []);

    // 4. Calculate distances and categorize
    const stops: any[] = [];
    for (const cg of campgrounds) {
      if (!cg.latitude || !cg.longitude) continue;
      const dLat = (cg.latitude - lat) * 69;
      const dLng = (cg.longitude - lng) * 69 * Math.cos(lat * Math.PI / 180);
      const miles = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10;
      if (miles <= radius) stops.push({ category: 'CAMPGROUND', id: cg.id, name: cg.name, city: cg.city, state: cg.state, lat: cg.latitude, lng: cg.longitude, imageUrl: cg.imageUrl, distanceMiles: miles });
    }
    for (const os of overnightStops) {
      if (!os.latitude || !os.longitude) continue;
      const dLat = (os.latitude - lat) * 69;
      const dLng = (os.longitude - lng) * 69 * Math.cos(lat * Math.PI / 180);
      const miles = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10;
      if (miles <= radius) stops.push({ category: 'OVERNIGHT', id: os.id, name: os.name, city: os.city, state: os.state, lat: os.latitude, lng: os.longitude, chain: os.chain, isRVFriendly: os.isRVFriendly, distanceMiles: miles });
    }

    stops.sort((a, b) => a.distanceMiles - b.distanceMiles);

    res.json({
      location: { lat, lng, name: locationName },
      stops: stops.slice(0, 15),
      noOptionsFound: stops.length === 0,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============== TRIP INVITES ==============

// POST /:slug/trips/:tripId/invite — invite a friend to a trip
router.post('/:slug/trips/:tripId/invite', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const { authorized } = await isOwnerOrEditor(rig.id, req.userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const { userId, accessLevel = 'JOINER' } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!['VIEWER', 'JOINER'].includes(accessLevel)) return res.status(400).json({ error: 'accessLevel must be VIEWER or JOINER' });

    // Verify invitee is a friend
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { initiatorId: req.userId, receiverId: userId },
          { initiatorId: userId, receiverId: req.userId },
        ],
      },
    });
    if (!friendship) return res.status(400).json({ error: 'Can only invite friends' });

    const member = await prisma.rigTripMember.upsert({
      where: { tripId_userId: { tripId: req.params.tripId, userId } },
      create: {
        tripId: req.params.tripId,
        userId,
        inviterId: req.userId,
        role: 'CREW',
        accessLevel,
        status: 'PENDING',
      },
      update: { accessLevel, status: 'PENDING', inviterId: req.userId },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
    });

    res.json(member);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /:slug/trips/:tripId/invite/:memberId — accept/decline/change level/revoke
router.patch('/:slug/trips/:tripId/invite/:memberId', authenticateToken, async (req: any, res) => {
  try {
    const member = await prisma.rigTripMember.findUnique({ where: { id: req.params.memberId } });
    if (!member) return res.status(404).json({ error: 'Invite not found' });

    const { action, accessLevel } = req.body; // action: accept | decline | change_level | revoke

    if (action === 'accept' && member.userId === req.userId) {
      await prisma.rigTripMember.update({ where: { id: member.id }, data: { status: 'ACCEPTED', joinedAt: new Date() } });
      return res.json({ ok: true, status: 'ACCEPTED' });
    }

    if (action === 'decline' && member.userId === req.userId) {
      await prisma.rigTripMember.update({ where: { id: member.id }, data: { status: 'DECLINED' } });
      return res.json({ ok: true, status: 'DECLINED' });
    }

    // Owner actions: change level or revoke
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const { authorized } = await isOwnerOrEditor(rig.id, req.userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    if (action === 'change_level' && ['VIEWER', 'JOINER'].includes(accessLevel)) {
      await prisma.rigTripMember.update({ where: { id: member.id }, data: { accessLevel } });
      return res.json({ ok: true, accessLevel });
    }

    if (action === 'revoke') {
      await prisma.rigTripMember.delete({ where: { id: member.id } });
      return res.json({ ok: true, revoked: true });
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /:slug/trips/:tripId/members — list trip members with access levels
router.get('/:slug/trips/:tripId/members', optionalAuth, async (req: any, res) => {
  try {
    const members = await prisma.rigTripMember.findMany({
      where: { tripId: req.params.tripId },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(members);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============== CAMP SESSION ==============

// GET /:slug/session/active — get the active Camp Session for this rig
router.get('/:slug/session/active', optionalAuth, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, activeTripId: true } });
    if (!rig || !rig.activeTripId) return res.json({ session: null });

    const session = await prisma.rigTrip.findUnique({
      where: { id: rig.activeTripId },
      select: {
        id: true, name: true, campgroundId: true, sessionType: true, status: true, visibility: true,
        startDate: true, endDate: true, coverImageUrl: true, totalNights: true,
        statesVisited: true,
      },
    });

    if (!session || session.status !== 'ACTIVE' || session.sessionType !== 'CAMP') {
      return res.json({ session: null });
    }

    // Gate: private sessions only visible to owner/co-pilot
    if (session.visibility === 'PRIVATE') {
      const viewerId = req.userId || null;
      const isOwnerOrPilot = viewerId === rig.ownerId || (viewerId && await prisma.rigPilot.findUnique({ where: { rigId_userId: { rigId: rig.id, userId: viewerId } } }));
      if (!isOwnerOrPilot) return res.json({ session: null });
    }

    // Get campground details
    const campground = session.campgroundId
      ? await prisma.campground.findUnique({ where: { id: session.campgroundId }, select: { id: true, name: true, imageUrl: true, city: true, state: true } })
      : null;

    // Get attached posts count
    const postCount = await prisma.rigPost.count({ where: { tripId: session.id } });

    // Get days at camp
    const daysAtCamp = session.startDate ? Math.max(1, Math.ceil((Date.now() - new Date(session.startDate).getTime()) / 86400000)) : 1;

    res.json({
      session: {
        ...session,
        campground,
        postCount,
        daysAtCamp,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /:slug/session/:sessionId/posts — get posts attached to a session
router.get('/:slug/session/:sessionId/posts', optionalAuth, async (req: any, res) => {
  try {
    const posts = await prisma.rigPost.findMany({
      where: { tripId: req.params.sessionId, OR: [{ visibility: 'PUBLIC' }, { visibility: 'BOTH' }, { visibility: null }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, body: true, photos: true, postType: true, createdAt: true,
        author: { select: { id: true, firstName: true, profilePicture: true } },
      },
    });
    res.json(posts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============== CAMPGROUND PHOTOS CHECK ==============

// GET /photos-at-campground/:campgroundId/:userId — check if user has visible photos at a campground
router.get('/photos-at-campground/:campgroundId/:userId', optionalAuth, async (req: any, res) => {
  try {
    const { campgroundId, userId } = req.params;
    const viewerId = (req as any).userId || null;

    // Find rig posts by this user with photos that reference this campground (via check-in timeline)
    // Also check RigPost photos where the post was made during a stay at this campground
    const { publicVisibilityFilter, canViewRigContent } = require('../services/rigVisibility');

    // Find the user's rig
    const rig = await prisma.rig.findFirst({ where: { ownerId: userId }, select: { id: true, ownerId: true } });
    if (!rig) {
      // Check if user is a pilot on any rig
      const pilot = await prisma.rigPilot.findFirst({ where: { userId }, select: { rigId: true, rig: { select: { id: true, ownerId: true } } } });
      if (!pilot) return res.json({ hasPhotos: false, count: 0 });
    }

    const rigId = rig?.id;
    if (!rigId) return res.json({ hasPhotos: false, count: 0 });

    // Find posts with photos at this campground
    // Photos are linked to campgrounds via check-in tripId or directly
    const posts = await prisma.rigPost.findMany({
      where: {
        rigId,
        NOT: { photos: { equals: [] } },
        ...publicVisibilityFilter,
      },
      select: { id: true, photos: true, visibility: true, tripId: true },
      take: 10,
    });

    // Filter by visibility for the viewer
    let visibleCount = 0;
    for (const post of posts) {
      const canView = await canViewRigContent(post.visibility, viewerId, rig?.ownerId || userId, rigId);
      if (canView) visibleCount += post.photos.length;
    }

    res.json({ hasPhotos: visibleCount > 0, count: visibleCount, rigSlug: rig ? await prisma.rig.findUnique({ where: { id: rigId }, select: { slug: true } }).then((r: any) => r?.slug) : null });
  } catch (e: any) { res.json({ hasPhotos: false, count: 0 }); }
});

// ============== MILEAGE ==============

// POST /:slug/mileage/sync — recompute mileage from check-ins via HERE
router.post('/:slug/mileage/sync', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const isOwner = rig.ownerId === req.userId;
    const isPilot = !isOwner && await prisma.rigPilot.findUnique({ where: { rigId_userId: { rigId: rig.id, userId: req.userId } } });
    if (!isOwner && !isPilot) return res.status(403).json({ error: 'Not authorized' });

    const { rollupRigMileage } = require('../services/rigMileage');
    const result = await rollupRigMileage(rig.id);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /:slug/mileage/correct — set a sticky correction baseline
router.post('/:slug/mileage/correct', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const isOwner = rig.ownerId === req.userId;
    const isPilot = !isOwner && await prisma.rigPilot.findUnique({ where: { rigId_userId: { rigId: rig.id, userId: req.userId } } });
    if (!isOwner && !isPilot) return res.status(403).json({ error: 'Not authorized' });

    const { correctedMiles } = req.body;
    if (typeof correctedMiles !== 'number' || correctedMiles < 0) {
      return res.status(400).json({ error: 'correctedMiles must be a non-negative number' });
    }

    await prisma.rig.update({
      where: { id: rig.id },
      data: {
        milesBaseline: correctedMiles,
        milesBaselineAt: new Date(),
        milesEstimated: false,
        totalMilesDriven: correctedMiles,
        totalMilesAllTime: correctedMiles,
      },
    });

    res.json({ ok: true, milesBaseline: correctedMiles, milesEstimated: false });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============== VISIBILITY ==============

router.patch('/:rigId/posts/:postId/visibility', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rigId, postId } = req.params;
    const userId = (req as any).userId;
    const { authorized } = await isOwnerOrEditor(rigId, userId);
    if (!authorized) return res.status(403).json({ error: 'Not authorized' });

    const { visibility } = req.body;
    if (!['PUBLIC', 'FRIENDS_ONLY', 'BOTH'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility. Use PUBLIC, FRIENDS_ONLY, or BOTH' });
    }

    const post = await prisma.rigPost.update({
      where: { id: postId },
      data: {
        visibility,
        isPublic: visibility !== 'FRIENDS_ONLY',
      },
    });

    // Re-sync timeline: if pulled to FRIENDS_ONLY, remove from public timeline
    if (visibility === 'FRIENDS_ONLY') {
      await prisma.rigTimelineItem.deleteMany({ where: { rigId, refId: postId } }).catch(() => {});
    } else {
      // Re-add to timeline if promoting to PUBLIC/BOTH
      const { syncTimelineItem } = require('../services/rigTimeline');
      await syncTimelineItem('PHOTO_ALBUM', postId, rigId, {
        title: post.title || 'Photos',
        previewImageUrl: post.photos?.[0],
        previewText: post.body?.slice(0, 100),
        tripId: post.tripId,
        stopId: post.stopId,
        occurredAt: post.createdAt,
      });
    }

    res.json({ ok: true, visibility: post.visibility });
  } catch (error: any) {
    console.error('[Rig] update post visibility error:', error.message);
    res.status(500).json({ error: 'Failed to update visibility' });
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      prisma.rigFollow.findMany({
        where: { rigId },
        include: { user: { select: safeUserSelect } },
        orderBy: { followedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.rigFollow.count({ where: { rigId } }),
    ]);

    res.json({ followers, total, page, hasMore: skip + followers.length < total });
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

    const { userId: pilotUserId, role, canEdit, acknowledgeDuplicate } = req.body;
    if (!pilotUserId) return res.status(400).json({ error: 'userId is required' });

    // Check if invited user has their own rig — warn about duplicate
    if (!acknowledgeDuplicate) {
      const pilotOwnRig = await prisma.rig.findFirst({
        where: { ownerId: pilotUserId, id: { not: rigId } },
        select: { id: true, slug: true, rigName: true },
      });
      if (pilotOwnRig) {
        const pilotUser = await prisma.user.findUnique({
          where: { id: pilotUserId },
          select: { firstName: true, username: true },
        });
        return res.json({
          duplicateWarning: true,
          pilotUser,
          pilotOwnRig,
          message: `${pilotUser?.firstName || 'This user'} already has their own rig page (${pilotOwnRig.rigName || pilotOwnRig.slug}). Adding them as a co-pilot will create a duplicate. You can merge their rig into yours later.`,
        });
      }
    }

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

    const { resolveUserRigId } = require('../services/rigResolver');
    for (const cf of creatorFollows) {
      // Find the canonical rig for the creator being followed
      const rig = await resolveUserRigId(cf.creatorId);

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
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    // Owner or any pilot can trigger sync
    const isOwner = rig.ownerId === req.userId;
    const isPilot = !isOwner && await prisma.rigPilot.findUnique({ where: { rigId_userId: { rigId: rig.id, userId: req.userId } } });
    if (!isOwner && !isPilot) return res.status(403).json({ error: 'Not authorized' });

    const { rollupRigStats } = require('../services/rigStatsRollup');
    const stats = await rollupRigStats(rig.id);
    res.json(stats);
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
    const { name, description, startDate, tripMode, tripType, visibility } = req.body;
    if (!name) return res.status(400).json({ error: 'Trip name required' });
    const trip = await prisma.rigTrip.create({
      data: {
        rigId: rig.id, name, description,
        startDate: startDate ? new Date(startDate) : new Date(),
        status: 'ACTIVE',
        tripMode: tripMode || 'ONE_WAY',
        tripType: tripType || 'UNCLASSIFIED',
        visibility: visibility || 'PRIVATE',
        members: { create: { userId: req.userId, role: 'DRIVER', accessLevel: 'JOINER', status: 'ACCEPTED' } },
      },
    });
    await prisma.rig.update({ where: { id: rig.id }, data: { activeTripId: trip.id } });
    res.status(201).json(trip);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug/trips', optionalAuth, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const viewerId = req.userId || null;
    const isOwnerOrPilot = viewerId === rig.ownerId || (viewerId && await prisma.rigPilot.findUnique({ where: { rigId_userId: { rigId: rig.id, userId: viewerId } } }));
    const where: any = { rigId: rig.id };
    if (!isOwnerOrPilot) where.visibility = { not: 'PRIVATE' }; // non-owners can't see private trips
    const trips = await prisma.rigTrip.findMany({
      where, orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: { _count: { select: { stops: true, routes: true, members: true } } },
    });
    const { scrubTripLocation } = require('../services/rigVisibility');
    res.json(trips.map((t: any) => scrubTripLocation(t, !!isOwnerOrPilot)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug/trips/active', optionalAuth, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, activeTripId: true } });
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
    if (!trip) return res.json(null);
    // Private active trip: only show to owner/co-pilot
    const viewerId = req.userId || null;
    const isOwnerOrPilot = viewerId === rig.ownerId || (viewerId && await prisma.rigPilot.findUnique({ where: { rigId_userId: { rigId: rig.id, userId: viewerId } } }));
    if (trip.visibility === 'PRIVATE' && !isOwnerOrPilot) return res.json(null);
    const { scrubTripLocation } = require('../services/rigVisibility');
    res.json(scrubTripLocation(trip, !!isOwnerOrPilot));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:slug/trips/:tripId', optionalAuth, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
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
    const viewerId = req.userId || null;
    const isOwnerOrPilot = rig && (viewerId === rig.ownerId || (viewerId && await prisma.rigPilot.findUnique({ where: { rigId_userId: { rigId: rig.id, userId: viewerId } } })));
    if (trip.visibility === 'PRIVATE' && !isOwnerOrPilot) return res.status(404).json({ error: 'Trip not found' });
    const { scrubTripLocation } = require('../services/rigVisibility');
    res.json(scrubTripLocation(trip, !!isOwnerOrPilot));
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

    // Generate Hitch one-liner (non-blocking)
    setImmediate(async () => {
      const ARRIVAL_LINES = [
        'Another adventure begins! 🔥', 'The campfire is calling! 🏕️', 'New stop, new memories! 🗺️',
        'Welcome to your next chapter! ✨', 'The open road delivered again! 🚐', 'Time to set up camp! ⛺',
        'Home is wherever you park it! 🏠', 'Let the campfire stories begin! 🔥',
        'Wheels down, adventure up! 🛞', 'Found our spot for the night! 🌙',
        'Parked and ready to explore! 🧭', 'Another pin on the map! 📍',
        'The view from here is worth the drive! 🌄', 'Settling in under the stars! ⭐',
        'Road dust settling, campfire rising! 🔥', 'New neighbors, new stories! 👋',
        'The journey continues! 🛣️', 'Made it — let the good times roll! 🎉',
        'Camp mode: activated! 🏕️', 'This is what it is all about! 🌲',
        'Another beautiful stop on the road! 🚐', 'Unplugged and loving it! 🔌',
        'Set up and ready for sunset! 🌅', 'Rolling into a new adventure! 🗺️',
      ];
      // Use stop count to rotate through the pool (no randomness = no back-to-back repeats)
      const stopCount = await prisma.rigTripStop.count({ where: { tripId: req.params.tripId } }).catch(() => 0);
      let hitchLine = ARRIVAL_LINES[stopCount % ARRIVAL_LINES.length];
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        const anthropic = new Anthropic.default();
        const resp = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 30,
          messages: [{ role: 'user', content: `You are Hitch, a fun campfire guide. Generate ONE short punchy celebratory arrival message (max 8 words) for an RV arriving at ${name}${state ? ' in ' + state : ''}. Campfire-warm tone. No hashtags. Just the message.` }] });
        hitchLine = (resp.content[0] as any)?.text?.trim() || hitchLine;
      } catch {}
      await prisma.rigTripStop.update({ where: { id: stop.id }, data: { hitchOneLiner: hitchLine } }).catch(() => {});
    });

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

// ============== QR CODE RIG STICKER SYSTEM ==============

// POST /rigs/:slug/qr-code — generate QR code for rig
router.post('/:slug/qr-code', authenticateToken, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, rigName: true, rigEmoji: true, slug: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    if (rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    // Check for existing active QR code
    const existing = await prisma.rigQRCode.findFirst({ where: { rigId: rig.id, isActive: true } });
    if (existing) return res.json({ qrCodeUrl: existing.qrCodeUrl, cardImageUrl: existing.cardImageUrl, downloadUrl: existing.cardImageUrl });

    // Generate QR code PNG buffer (min 300x300 for scanability)
    const qrUrl = `https://www.rvunicorn.com/rig/${rig.slug}?scan=true`;
    const qrPngBuffer = await QRCode.toBuffer(qrUrl, { width: 400, margin: 2, color: { dark: '#1B2B4B', light: '#FFFFFF' }, errorCorrectionLevel: 'H' });

    // Upload QR code PNG to Cloudinary
    const qrCodeUrl = await uploadBufferToCloudinary(qrPngBuffer, 'rig-qr-codes');

    // Create database record (card is rendered client-side)
    await prisma.rigQRCode.create({
      data: {
        rigId: rig.id,
        userId: req.userId,
        qrCodeUrl,
      }
    });

    res.json({ qrCodeUrl, rigName: rig.rigName, rigEmoji: rig.rigEmoji });
  } catch (e: any) {
    console.error('[QR] generate error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /rigs/:slug/qr-code — get existing QR code (or create if none)
router.get('/:slug/qr-code', authenticateToken, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, rigName: true, rigEmoji: true, slug: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    if (rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    let qrCode = await prisma.rigQRCode.findFirst({ where: { rigId: rig.id, isActive: true } });

    if (!qrCode) {
      // Auto-generate
      const qrUrl = `https://www.rvunicorn.com/rig/${rig.slug}?scan=true`;
      const qrPngBuffer = await QRCode.toBuffer(qrUrl, { width: 400, margin: 2, color: { dark: '#1B2B4B', light: '#FFFFFF' }, errorCorrectionLevel: 'H' });
      const qrCodeUrl = await uploadBufferToCloudinary(qrPngBuffer, 'rig-qr-codes');

      qrCode = await prisma.rigQRCode.create({
        data: { rigId: rig.id, userId: req.userId, qrCodeUrl }
      });
    }

    res.json({
      qrCodeUrl: qrCode.qrCodeUrl,
      scanCount: qrCode.scanCount,
      privacyMode: qrCode.privacyMode,
      privacyExpiresAt: qrCode.privacyExpiresAt,
      rigName: rig.rigName,
      rigEmoji: rig.rigEmoji,
    });
  } catch (e: any) {
    console.error('[QR] get error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /rigs/:slug/qr-code/privacy — toggle privacy mode
router.post('/:slug/qr-code/privacy', authenticateToken, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    if (rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { enabled, expiresInHours } = req.body;
    const qrCode = await prisma.rigQRCode.findFirst({ where: { rigId: rig.id, isActive: true } });
    if (!qrCode) return res.status(404).json({ error: 'No QR code found — generate one first' });

    const privacyExpiresAt = enabled && expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;

    const updated = await prisma.rigQRCode.update({
      where: { id: qrCode.id },
      data: { privacyMode: !!enabled, privacyExpiresAt },
    });

    res.json({ privacyMode: updated.privacyMode, privacyExpiresAt: updated.privacyExpiresAt });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /rigs/:slug/qr-code/scan — log a scan
router.post('/:slug/qr-code/scan', optionalAuth, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true, rigName: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    const qrCode = await prisma.rigQRCode.findFirst({ where: { rigId: rig.id, isActive: true } });
    if (!qrCode) return res.status(404).json({ error: 'No QR code for this rig' });

    // Check privacy mode
    if (qrCode.privacyMode) {
      // Check if privacy has expired
      if (qrCode.privacyExpiresAt && new Date() > new Date(qrCode.privacyExpiresAt)) {
        await prisma.rigQRCode.update({ where: { id: qrCode.id }, data: { privacyMode: false, privacyExpiresAt: null } });
      } else {
        return res.json({ privacyMode: true, message: 'This rig is currently in private mode.' });
      }
    }

    const { lat, lng } = req.body;
    const scannedByUserId = req.userId || null;

    // Find nearby campground (within ~1 mile ≈ 0.0145 degrees)
    let campgroundId: string | null = null;
    if (lat && lng) {
      const nearby = await prisma.campground.findFirst({
        where: {
          latitude: { gte: lat - 0.0145, lte: lat + 0.0145 },
          longitude: { gte: lng - 0.0145, lte: lng + 0.0145 },
        },
        select: { id: true },
      });
      campgroundId = nearby?.id || null;
    }

    // Increment scan count
    await prisma.rigQRCode.update({ where: { id: qrCode.id }, data: { scanCount: { increment: 1 } } });

    // Create scan record
    const scan = await prisma.rigQRScan.create({
      data: {
        qrCodeId: qrCode.id,
        rigId: rig.id,
        scannedByUserId,
        scannerLat: lat || null,
        scannerLng: lng || null,
        campgroundId,
      }
    });

    // Check if this is a new unique scanner
    let isFirstScan = false;
    if (scannedByUserId) {
      const previousScans = await prisma.rigQRScan.count({
        where: { rigId: rig.id, scannedByUserId, id: { not: scan.id } }
      });
      isFirstScan = previousScans === 0;

      // Award 'Rig Discoverer' badge to scanner if first time scanning ANY rig
      if (isFirstScan) {
        const existingBadge = await prisma.userBadge.findFirst({
          where: { userId: scannedByUserId, badgeName: 'Rig Discoverer' }
        });
        if (!existingBadge) {
          try {
            await prisma.userBadge.create({
              data: { userId: scannedByUserId, badgeName: 'Rig Discoverer', badgeEmoji: '🔍', badgeDescription: 'Discovered a rig by scanning their QR code', earnedAt: new Date() }
            });
          } catch { /* badge table might differ — non-critical */ }
        }
      }

      // Notify rig owner
      try {
        await prisma.notification.create({
          data: {
            userId: rig.ownerId,
            type: 'QR_SCAN',
            title: 'Someone just discovered your rig via QR scan! 👀',
            body: isFirstScan ? 'A new visitor scanned your QR code!' : 'Your QR code was scanned again!',
            data: JSON.stringify({ rigId: rig.id, scannerId: scannedByUserId, campgroundId }),
          }
        });
      } catch { /* notification model might differ — non-critical */ }

      // Award 'QR Pioneer' badge to rig owner on first-ever scan
      const totalScans = await prisma.rigQRScan.count({ where: { rigId: rig.id } });
      if (totalScans === 1) {
        try {
          await prisma.userBadge.create({
            data: { userId: rig.ownerId, badgeName: 'QR Pioneer', badgeEmoji: '🏷️', badgeDescription: 'Your rig QR code was scanned for the first time', earnedAt: new Date() }
          });
        } catch { /* non-critical */ }
      }
    }

    res.json({ success: true, isFirstScan, campgroundId, rigName: rig.rigName });
  } catch (e: any) {
    console.error('[QR] scan error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /rigs/:slug/qr-code/scans — scan analytics for rig owner
router.get('/:slug/qr-code/scans', authenticateToken, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    if (rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const qrCode = await prisma.rigQRCode.findFirst({ where: { rigId: rig.id, isActive: true } });
    if (!qrCode) return res.json({ totalScans: 0, uniqueScanners: 0, scansByCampground: [], followerConversionRate: 0 });

    // Total scans
    const totalScans = qrCode.scanCount;

    // Unique scanners
    const uniqueScannersResult = await prisma.rigQRScan.groupBy({
      by: ['scannedByUserId'],
      where: { rigId: rig.id, scannedByUserId: { not: null } },
    });
    const uniqueScanners = uniqueScannersResult.length;

    // Scans by campground
    const scansByCampground = await prisma.rigQRScan.groupBy({
      by: ['campgroundId'],
      where: { rigId: rig.id, campgroundId: { not: null } },
      _count: true,
    });

    // Campground names
    const campgroundIds = scansByCampground.map((s: any) => s.campgroundId).filter(Boolean);
    const campgrounds = campgroundIds.length > 0
      ? await prisma.campground.findMany({ where: { id: { in: campgroundIds } }, select: { id: true, name: true } })
      : [];
    const campMap = Object.fromEntries(campgrounds.map((c: any) => [c.id, c.name]));

    // Follower conversion: scanners who also follow this rig
    const scannerIds = uniqueScannersResult.map((s: any) => s.scannedByUserId).filter(Boolean);
    let followCount = 0;
    if (scannerIds.length > 0) {
      followCount = await prisma.rigFollow.count({
        where: { rigId: rig.id, userId: { in: scannerIds } },
      });
    }
    const followerConversionRate = uniqueScanners > 0 ? Math.round((followCount / uniqueScanners) * 100) : 0;

    res.json({
      totalScans,
      uniqueScanners,
      scansByCampground: scansByCampground.map((s: any) => ({
        campgroundId: s.campgroundId,
        campgroundName: campMap[s.campgroundId] || 'Unknown',
        count: s._count,
      })),
      followerConversionRate,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============== MAP WITH ALBUM PHOTOS ==============

// GET /rigs/:slug/map-with-albums — route map data with photo overlays
router.get('/:slug/map-with-albums', async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    // Get all trips with stops and routes
    const trips = await prisma.rigTrip.findMany({
      where: { rigId: rig.id },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        stops: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            tripId: true,
            campgroundId: true,
            name: true,
            lat: true,
            lng: true,
            order: true,
            arrivedAt: true,
            departedAt: true,
            nightsStayed: true,
            coverImageUrl: true,
            photoCount: true,
            stopType: true,
          },
        },
        routes: {
          select: {
            fromStopId: true,
            toStopId: true,
            polyline: true,
            distanceMiles: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Get all journeys for color coding
    const journeys = await prisma.rigJourney.findMany({
      where: { rigId: rig.id },
      select: { id: true, name: true, segments: { select: { id: true, name: true, fromLocation: true, toLocation: true, order: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Build stop map for route lat/lng resolution
    const allStops: any[] = [];
    const stopMap: Record<string, any> = {};
    for (const trip of trips) {
      for (const stop of trip.stops) {
        allStops.push(stop);
        stopMap[stop.id] = stop;
      }
    }

    // Get album photos for stops — find RigPosts with photos associated with each stop
    const stopIds = allStops.map(s => s.id);
    const postsWithPhotos = stopIds.length > 0
      ? await prisma.rigPost.findMany({
          where: {
            rigId: rig.id,
            stopId: { in: stopIds },
            photos: { isEmpty: false },
          },
          select: {
            stopId: true,
            photos: true,
            likeCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // Also check RigMomentBundle photos for stops
    const bundlesWithPhotos = stopIds.length > 0
      ? await prisma.rigMomentBundle.findMany({
          where: {
            rigId: rig.id,
            stopId: { in: stopIds },
            photoUrls: { isEmpty: false },
          },
          select: {
            stopId: true,
            photoUrls: true,
            featuredMediaUrl: true,
            bundledAt: true,
          },
        })
      : [];

    // Group photos by stopId and pick best cover photo
    const photosByStop: Record<string, { coverPhotoUrl: string; topPhotoUrl: string; topPhotoLikes: number; photoCount: number; allPhotos: string[] }> = {};

    for (const post of postsWithPhotos) {
      if (!post.stopId) continue;
      if (!photosByStop[post.stopId]) {
        photosByStop[post.stopId] = { coverPhotoUrl: '', topPhotoUrl: '', topPhotoLikes: 0, photoCount: 0, allPhotos: [] };
      }
      const entry = photosByStop[post.stopId];
      const photos = Array.isArray(post.photos) ? post.photos : [];
      entry.allPhotos.push(...photos);
      entry.photoCount += photos.length;

      // Track top liked photo
      const likeCount = post.likeCount || 0;
      if (likeCount > entry.topPhotoLikes && photos.length > 0) {
        entry.topPhotoLikes = likeCount;
        entry.topPhotoUrl = photos[0];
      }
    }

    // Merge bundle photos
    for (const bundle of bundlesWithPhotos) {
      if (!bundle.stopId) continue;
      if (!photosByStop[bundle.stopId]) {
        photosByStop[bundle.stopId] = { coverPhotoUrl: '', topPhotoUrl: '', topPhotoLikes: 0, photoCount: 0, allPhotos: [] };
      }
      const entry = photosByStop[bundle.stopId];
      const photos = Array.isArray(bundle.photoUrls) ? bundle.photoUrls : [];
      entry.allPhotos.push(...photos);
      entry.photoCount += photos.length;
      if (!entry.coverPhotoUrl && bundle.featuredMediaUrl) {
        entry.coverPhotoUrl = bundle.featuredMediaUrl;
      }
    }

    // Set cover photo (most recent as fallback, stop's own coverImageUrl as last resort)
    for (const stopId of Object.keys(photosByStop)) {
      const entry = photosByStop[stopId];
      if (!entry.coverPhotoUrl && entry.allPhotos.length > 0) {
        entry.coverPhotoUrl = entry.allPhotos[0]; // Most recent (posts ordered desc)
      }
      if (!entry.topPhotoUrl && entry.allPhotos.length > 0) {
        entry.topPhotoUrl = entry.allPhotos[0];
      }
    }

    // Build response stops with album data
    const stopsWithAlbums = allStops.map(stop => {
      const album = photosByStop[stop.id];
      const fallbackCover = stop.coverImageUrl || null;
      return {
        ...stop,
        albumData: album ? {
          photoCount: album.photoCount,
          coverPhotoUrl: album.coverPhotoUrl || fallbackCover,
          topPhotoUrl: album.topPhotoUrl || fallbackCover,
          topPhotoLikes: album.topPhotoLikes,
          allPhotos: album.allPhotos.slice(0, 5), // First 5 for preview strip
        } : (fallbackCover ? {
          photoCount: stop.photoCount || 0,
          coverPhotoUrl: fallbackCover,
          topPhotoUrl: fallbackCover,
          topPhotoLikes: 0,
          allPhotos: [fallbackCover],
        } : null),
      };
    });

    // Build routes with lat/lng from stops
    const routes = [];
    for (const trip of trips) {
      for (const route of trip.routes) {
        const fromStop = stopMap[route.fromStopId];
        const toStop = stopMap[route.toStopId];
        if (fromStop?.lat && fromStop?.lng && toStop?.lat && toStop?.lng) {
          routes.push({
            fromLat: fromStop.lat,
            fromLng: fromStop.lng,
            toLat: toStop.lat,
            toLng: toStop.lng,
            polyline: route.polyline,
            tripId: trip.id,
            tripName: trip.name,
            distanceMiles: route.distanceMiles,
          });
        }
      }
    }

    res.json({
      stops: stopsWithAlbums,
      routes,
      journeys,
    });
  } catch (e: any) {
    console.error('[Map] map-with-albums error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ============== JOURNEY SEGMENT HIERARCHY ==============

// POST /rigs/:slug/journeys — create a Journey
router.post('/:slug/journeys', authenticateToken, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { name, description, startDate, endDate, status, coverImageUrl } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Journey name is required' });

    const journey = await prisma.rigJourney.create({
      data: {
        rigId: rig.id,
        userId: req.userId,
        name: name.trim(),
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'PLANNED',
        coverImageUrl: coverImageUrl || null,
      },
      include: { segments: { orderBy: { order: 'asc' } } },
    });

    res.json(journey);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /rigs/:slug/journeys — list all journeys
router.get('/:slug/journeys', async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });

    const journeys = await prisma.rigJourney.findMany({
      where: { rigId: rig.id },
      include: { segments: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(journeys);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /rigs/:slug/journeys/:journeyId — edit journey
router.put('/:slug/journeys/:journeyId', authenticateToken, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { name, description, startDate, endDate, status, coverImageUrl, totalMiles, totalNights, statesVisited } = req.body;

    const journey = await prisma.rigJourney.update({
      where: { id: req.params.journeyId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(status !== undefined && { status }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
        ...(totalMiles !== undefined && { totalMiles }),
        ...(totalNights !== undefined && { totalNights }),
        ...(statesVisited !== undefined && { statesVisited }),
      },
      include: { segments: { orderBy: { order: 'asc' } } },
    });

    res.json(journey);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /rigs/:slug/journeys/:journeyId/segments — add a segment
router.post('/:slug/journeys/:journeyId/segments', authenticateToken, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { name, fromLocation, toLocation, startDate, endDate, order, distanceMiles, stops } = req.body;
    if (!name?.trim() || !fromLocation?.trim() || !toLocation?.trim()) {
      return res.status(400).json({ error: 'Name, fromLocation, and toLocation are required' });
    }

    // Auto-calculate order if not provided
    let segmentOrder = order;
    if (segmentOrder === undefined || segmentOrder === null) {
      const lastSegment = await prisma.rigJourneySegment.findFirst({
        where: { journeyId: req.params.journeyId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      segmentOrder = (lastSegment?.order ?? -1) + 1;
    }

    const segment = await prisma.rigJourneySegment.create({
      data: {
        journeyId: req.params.journeyId,
        rigId: rig.id,
        name: name.trim(),
        fromLocation: fromLocation.trim(),
        toLocation: toLocation.trim(),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        order: segmentOrder,
        distanceMiles: distanceMiles || null,
        stops: stops || null,
      },
    });

    res.json(segment);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /rigs/:slug/journeys/:journeyId/segments/:segmentId — edit segment
router.put('/:slug/journeys/:journeyId/segments/:segmentId', authenticateToken, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { name, fromLocation, toLocation, startDate, endDate, order, distanceMiles, stops } = req.body;

    const segment = await prisma.rigJourneySegment.update({
      where: { id: req.params.segmentId },
      data: {
        ...(name !== undefined && { name }),
        ...(fromLocation !== undefined && { fromLocation }),
        ...(toLocation !== undefined && { toLocation }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(order !== undefined && { order }),
        ...(distanceMiles !== undefined && { distanceMiles }),
        ...(stops !== undefined && { stops }),
      },
    });

    res.json(segment);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /rigs/:slug/journeys/:journeyId/segments/:segmentId — delete segment
router.delete('/:slug/journeys/:journeyId/segments/:segmentId', authenticateToken, async (req: any, res: Response) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, ownerId: true } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    await prisma.rigJourneySegment.delete({ where: { id: req.params.segmentId } });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── FUEL PROFILE ROUTES ──
import { detectManufacturerSpecs, autoPopulateFuelProfile, estimateCurrentFuelPct, calculateFuelStopPositions } from '../services/fuelProfileService';

// GET /rigs/:slug/fuel-profile
router.get('/:slug/fuel-profile', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const specs = await detectManufacturerSpecs(rig.make, rig.model, rig.year);
    res.json({
      fuelType: rig.fuelType, tankCapacityGallons: rig.tankCapacityGallons, auxTankGallons: rig.auxTankGallons,
      averageMpg: rig.avgMPG, towingMpg: rig.towingMpg, fuelProfileConfirmed: rig.fuelProfileConfirmed,
      fuelProfileUpdatedAt: rig.fuelProfileUpdatedAt, fillUpPreferencePct: rig.fillUpPreferencePct,
      reserveWarningPct: rig.reserveWarningPct, rangeAnxiety: rig.rangeAnxiety,
      manufacturerSpecs: specs || null,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /rigs/:slug/fuel-profile
router.put('/:slug/fuel-profile', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { fuelType, tankCapacityGallons, auxTankGallons, averageMpg, towingMpg, fillUpPreferencePct, reserveWarningPct, rangeAnxiety } = req.body;
    const updated = await prisma.rig.update({
      where: { id: rig.id },
      data: {
        ...(fuelType !== undefined && { fuelType }),
        ...(tankCapacityGallons !== undefined && { tankCapacityGallons: parseFloat(tankCapacityGallons) || null }),
        ...(auxTankGallons !== undefined && { auxTankGallons: parseFloat(auxTankGallons) || null }),
        ...(averageMpg !== undefined && { avgMPG: parseFloat(averageMpg) || null }),
        ...(towingMpg !== undefined && { towingMpg: parseFloat(towingMpg) || null }),
        ...(fillUpPreferencePct !== undefined && { fillUpPreferencePct: parseInt(fillUpPreferencePct) }),
        ...(reserveWarningPct !== undefined && { reserveWarningPct: parseInt(reserveWarningPct) }),
        ...(rangeAnxiety !== undefined && { rangeAnxiety }),
        fuelProfileConfirmed: true,
        fuelProfileUpdatedAt: new Date(),
      },
    });
    res.json({ success: true, fuelProfileConfirmed: true, fuelProfileUpdatedAt: updated.fuelProfileUpdatedAt });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /rigs/:slug/fuel-profile/detect
router.post('/:slug/fuel-profile/detect', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const result = await autoPopulateFuelProfile(rig.id);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /rigs/:slug/fuel-profile/confirm
router.post('/:slug/fuel-profile/confirm', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { fuelType, tankCapacityGallons, averageMpg } = req.body;
    await prisma.rig.update({
      where: { id: rig.id },
      data: {
        ...(fuelType && { fuelType }),
        ...(tankCapacityGallons && { tankCapacityGallons: parseFloat(tankCapacityGallons) }),
        ...(averageMpg && { avgMPG: parseFloat(averageMpg) }),
        fuelProfileConfirmed: true,
        fuelProfileUpdatedAt: new Date(),
      },
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /manufacturer-specs/lookup
router.get('/manufacturer-specs/lookup', async (req: any, res) => {
  try {
    const { make, model, year } = req.query;
    const specs = await detectManufacturerSpecs(make, model, year ? parseInt(year) : null);
    res.json(specs || { found: false });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── TRIP FUEL ROUTES ──

// GET /rigs/:slug/trips/:tripPlanId/fuel-status
router.get('/:slug/trips/:tripPlanId/fuel-status', authenticateToken, async (req: any, res) => {
  try {
    const status = await estimateCurrentFuelPct(req.params.tripPlanId);
    if (!status) return res.json({ available: false });
    res.json({ available: true, ...status });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /rigs/:slug/trips/:tripPlanId/fuel-recommendations
router.get('/:slug/trips/:tripPlanId/fuel-recommendations', authenticateToken, async (req: any, res) => {
  try {
    const recommendations = await calculateFuelStopPositions(req.params.tripPlanId);
    res.json({ recommendations });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /rigs/:slug/fuel-stops — log a fuel stop
router.post('/:slug/fuel-stops', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug } });
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { tripId, stationName, address, city, state, lat, lng, gallonsAdded, pricePerGallon, totalCost, fuelPctBefore, fuelPctAfter, overnightStopId } = req.body;
    const fuelStop = await prisma.rigFuelStop.create({
      data: {
        rigId: rig.id, userId: req.userId, tripId: tripId || null,
        stationName, address, city, state, lat, lng,
        gallonsAdded: gallonsAdded ? parseFloat(gallonsAdded) : null,
        pricePerGallon: pricePerGallon ? parseFloat(pricePerGallon) : null,
        totalCost: totalCost ? parseFloat(totalCost) : null,
        fuelPctBefore: fuelPctBefore ? parseFloat(fuelPctBefore) : null,
        fuelPctAfter: fuelPctAfter ? parseFloat(fuelPctAfter) : null,
        overnightStopId: overnightStopId || null,
      },
    });
    res.json(fuelStop);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /rigs/:slug/fuel-stops — fuel stop history
router.get('/:slug/fuel-stops', authenticateToken, async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const stops = await prisma.rigFuelStop.findMany({
      where: { rigId: rig.id },
      orderBy: { loggedAt: 'desc' },
      take: 50,
    });
    const totals = await prisma.rigFuelStop.aggregate({
      where: { rigId: rig.id },
      _sum: { gallonsAdded: true, totalCost: true },
      _count: true,
    });
    res.json({
      stops,
      totalGallons: totals._sum.gallonsAdded || 0,
      totalCost: totals._sum.totalCost || 0,
      totalStops: totals._count,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export { getFollowersForUser };
export default router;
