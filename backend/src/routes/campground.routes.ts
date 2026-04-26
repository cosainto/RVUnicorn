import { Router, Request, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import {
  submitPriceReport,
  getPriceStats,
  shouldPromptForPriceReport,
} from '../services/campground-pricing.service';

const router = Router();
const db = prisma as any;

// Admin email that can delete/edit campgrounds
const ADMIN_EMAILS = ['wroberts82@yahoo.com', 'deanna@rvunicorn.com'];

// Middleware to check if user is admin
const isAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = (req as any).userId;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    
    if (!user || !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error: any) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

// Get all campgrounds
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, offset, page, state, search } = req.query;
    
    const where: any = {};
    
    if (state) {
      where.state = state;
    }
    
    if (req.query.verificationStatus) {
      where.verificationStatus = req.query.verificationStatus;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { location: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Randomize default order when no search/filters applied
    const isDefaultBrowse = !search && !state && !req.query.verificationStatus;
    const takeCount = limit ? parseInt(limit as string) : 50;
    const pageNum = page ? parseInt(page as string) : 1;

    let skipCount = (pageNum - 1) * takeCount;
    if (isDefaultBrowse && pageNum === 1) {
      // Random offset for first page to show different campgrounds each visit
      const total = await db.campground.count({ where });
      skipCount = Math.floor(Math.random() * Math.max(0, total - takeCount));
    }

    const campgrounds = await db.campground.findMany({
      where,
      take: takeCount,
      skip: skipCount,
      orderBy: isDefaultBrowse ? [
        { googleRating: 'desc' },
      ] : [
        { followers: { _count: 'desc' } },
        { reviews: { _count: 'desc' } },
        { name: 'asc' },
      ],
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        _count: {
          select: {
            reviews: true,
            followers: true,
            checkIns: true,
          }
        }
      }
    });

    const total = await db.campground.count({ where });

    res.json({
      campgrounds,
      total,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0, totalPages: Math.ceil(total / (limit ? parseInt(limit as string) : 50)),
    });
  } catch (error: any) {
    console.error('Get campgrounds error:', error);
    res.status(500).json({ error: 'Failed to get campgrounds' });
  }
});

// Get user's favorite campgrounds (MUST come before /:id routes)

// GET /api/campgrounds/following - Get campgrounds the user follows
router.get("/following", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user?.id || req.userId;
    const now = new Date();
    
    // claimedBy and admins are relations on Campground — not on Follow/CheckIn/Stay.
    // Earlier versions of this endpoint hoisted them to the top level which makes
    // Prisma throw at runtime. Result-shaping below only reads `.campground`, so
    // we just include the campground summary on each query.
    const campgroundSelect = { id: true, name: true, location: true, city: true, imageUrl: true, state: true };

    const follows = await db.campgroundFollow.findMany({
      where: { userId },
      include: { campground: { select: campgroundSelect } },
    });

    const activeCheckIns = await db.checkIn.findMany({
      where: {
        userId,
        isActive: true,
        checkInDate: { lte: now },
        OR: [
          { checkOutDate: null },
          { checkOutDate: { gte: now } },
        ],
      },
      include: { campground: { select: campgroundSelect } },
    });

    const stays = await db.stay.findMany({
      where: { userId },
      include: { campground: { select: campgroundSelect } },
      orderBy: { startDate: 'desc' },
    });
    
    // Combine and deduplicate. Skip rows whose campground is null (e.g. a
    // HarvestHost-only check-in) — they have no campgroundId to key on.
    const campgroundMap = new Map();
    activeCheckIns.forEach((c: any) => {
      if (c.campground) campgroundMap.set(c.campground.id, { ...c.campground, source: 'checked-in' });
    });
    follows.forEach((f: any) => {
      if (f.campground && !campgroundMap.has(f.campground.id)) {
        campgroundMap.set(f.campground.id, { ...f.campground, source: 'following' });
      }
    });
    stays.forEach((s: any) => {
      if (s.campground && !campgroundMap.has(s.campground.id)) {
        campgroundMap.set(s.campground.id, { ...s.campground, source: 'visited' });
      }
    });
    
    res.json(Array.from(campgroundMap.values()));
  } catch (error: any) {
    console.error("Get followed campgrounds error:", error);
    res.status(500).json({ error: "Failed to get followed campgrounds" });
  }
});

router.get('/favorites/my', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const favorites = await db.campgroundFollow.findMany({
      where: { userId },
      include: {
        campground: {
          include: {
            photos: { take: 1 },
            _count: { select: { followers: true, checkIns: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Deduplicate by campground id
    const seen = new Set();
    const unique = favorites.filter((f: any) => {
      if (seen.has(f.campground.id)) return false;
      seen.add(f.campground.id);
      return true;
    });
    res.json(unique.map((f: any) => f.campground));
  } catch (error: any) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Favorite/Follow a campground
router.post('/:id/favorite', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const existing = await db.campgroundFollow.findUnique({
      where: {
        userId_campgroundId: {
          userId,
          campgroundId: id,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already following this campground' });
    }

    const follow = await db.campgroundFollow.create({
      data: {
        userId,
        campgroundId: id,
      },
    });

    res.json(follow);
  } catch (error: any) {
    console.error('Favorite campground error:', error);
    res.status(500).json({ error: 'Failed to favorite campground' });
  }
});

// Unfavorite/Unfollow a campground
router.delete('/:id/favorite', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    await db.campgroundFollow.deleteMany({
      where: {
        userId,
        campgroundId: id,
      },
    });

    res.json({ message: 'Unfollowed' });
  } catch (error: any) {
    console.error('Unfavorite campground error:', error);
    res.status(500).json({ error: 'Failed to unfavorite campground' });
  }
});

// Check if campground is favorited
router.get('/:id/is-favorited', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const follow = await db.campgroundFollow.findUnique({
      where: {
        userId_campgroundId: {
          userId,
          campgroundId: id,
        },
      },
    });

    res.json({ isFavorited: !!follow });
  } catch (error: any) {
    console.error('Check favorite error:', error);
    res.status(500).json({ error: 'Failed to check favorite status' });
  }
});

// Get campground followers list
router.get('/:id/followers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const followers = await db.campgroundFollow.findMany({
      where: { campgroundId: id },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            currentCampsite: true,
          }
        }
      }
    });

    const total = await db.campgroundFollow.count({
      where: { campgroundId: id }
    });

    res.json({
      followers: followers.map((f: any) => f.user),
      total,
      hasMore: parseInt(offset as string) + followers.length < total
    });
  } catch (error: any) {
    console.error('Get campground followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

// UPDATE campground (ADMIN ONLY) - Must come before /:id GET route
router.put('/:id', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if campground exists
    const existing = await db.campground.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    const campground = await db.campground.update({
      where: { id },
      data: updateData
    });

    res.json(campground);
  } catch (error: any) {
    console.error('Update campground error:', error);
    res.status(500).json({ error: 'Failed to update campground' });
  }
});

// DELETE campground (ADMIN ONLY) - Must come before /:id GET route
router.delete('/:id', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if campground exists
    const existing = await db.campground.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    // Handle relations that don't have onDelete: Cascade
    // Nullify optional campground references
    await db.event.updateMany({ 
      where: { campgroundId: id },
      data: { campgroundId: null }
    });
    
    await db.activity.updateMany({ 
      where: { campgroundId: id },
      data: { campgroundId: null }
    });
    
    await db.creatorContent.updateMany({ 
      where: { campgroundId: id },
      data: { campgroundId: null }
    });
    
    await db.creatorContentTag.updateMany({ 
      where: { campgroundId: id },
      data: { campgroundId: null }
    });
    
    // Nullify stateVisit campsite reference
    await db.stateVisit.updateMany({ 
      where: { campsiteId: id },
      data: { campsiteId: null }
    });

    // Delete muted entities (uses entityId not campgroundId)
    // MutedEntity has onDelete: Cascade, handled automatically
    // await db.mutedEntity.deleteMany({ 
    //       where: { entityId: id, entityType: 'CAMPGROUND' } 
    //     });
    //     
    // Delete sticker-related records before deleting stickers
    const stickers = await db.sticker.findMany({ 
      where: { campgroundId: id }, 
      select: { id: true } 
    });
    const stickerIds = stickers.map((s: any) => s.id);
    
    if (stickerIds.length > 0) {
      await db.userSticker.deleteMany({ where: { stickerId: { in: stickerIds } } });
      await db.stickerRequest.deleteMany({ where: { stickerId: { in: stickerIds } } });
    }

    // Delete the campground - Prisma cascade will handle the rest
    await db.campground.delete({
      where: { id }
    });

    res.json({ message: 'Campground deleted successfully' });
  } catch (error: any) {
    console.error('Delete campground error:', error);
    res.status(500).json({ error: 'Failed to delete campground', details: error.message });
  }
});

// GET /api/campgrounds/weekend-near-me — Lifestyle Mode nearby weekend campgrounds
router.get('/weekend-near-me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat(req.query.radius as string) || 320;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query params are required' });
    }

    // Haversine distance via raw SQL — returns campgrounds within radius sorted by distance
    const campgrounds: any[] = await db.$queryRawUnsafe(`
      SELECT id, name, state, latitude, longitude, "imageUrl",
        "hasFullHookups", "hasWifi", "isPetFriendly", "isWaterfront", "hasPool", "hasShowers", "hasPullThrough",
        ( 6371 * acos(
            LEAST(1.0, cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2))
            + sin(radians($1)) * sin(radians(latitude)))
        )) AS distance_km
      FROM "Campground"
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      HAVING ( 6371 * acos(
            LEAST(1.0, cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2))
            + sin(radians($1)) * sin(radians(latitude)))
      )) <= $3
      ORDER BY distance_km ASC
      LIMIT 3
    `, lat, lng, radiusKm).catch(async () => {
      // Fallback: some Postgres versions don't support HAVING without GROUP BY on non-aggregated queries.
      // Use a subquery approach instead.
      return db.$queryRawUnsafe(`
        SELECT * FROM (
          SELECT id, name, state, latitude, longitude, "imageUrl",
            "hasFullHookups", "hasWifi", "isPetFriendly", "isWaterfront", "hasPool", "hasShowers", "hasPullThrough",
            ( 6371 * acos(
                LEAST(1.0, cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2))
                + sin(radians($1)) * sin(radians(latitude)))
            )) AS distance_km
          FROM "Campground"
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ) sub
        WHERE distance_km <= $3
        ORDER BY distance_km ASC
        LIMIT 3
      `, lat, lng, radiusKm);
    });

    const results = campgrounds.map((c: any) => {
      const distKm = parseFloat(c.distance_km);
      const driveTimeMinutes = Math.round(distKm / 80 * 60);

      const amenities: string[] = [];
      if (c.hasFullHookups) amenities.push('Full Hookups');
      if (c.hasWifi) amenities.push('WiFi');
      if (c.isPetFriendly) amenities.push('Pet-Friendly');
      if (c.isWaterfront) amenities.push('Waterfront');
      if (c.hasPool) amenities.push('Pool');
      if (c.hasShowers) amenities.push('Showers');
      if (c.hasPullThrough) amenities.push('Pull-Through');

      return {
        id: c.id,
        name: c.name,
        state: c.state,
        latitude: c.latitude,
        longitude: c.longitude,
        driveTimeMinutes,
        amenitiesSummary: amenities.join(', ') || 'No amenities listed',
        matchScore: null,
        photos: c.imageUrl,
      };
    });

    res.json({ campgrounds: results });
  } catch (error: any) {
    console.error('Weekend near me error:', error);
    res.status(500).json({ error: 'Failed to find nearby campgrounds' });
  }
});

// GET /api/campgrounds/trending-visited — Lifestyle Mode trending places user has been
router.get('/trending-visited', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Get all campground IDs the user has checked into
    const userCheckIns = await db.checkIn.findMany({
      where: { userId, campgroundId: { not: null } },
      select: { campgroundId: true, checkInDate: true },
      orderBy: { checkInDate: 'desc' },
    });

    if (userCheckIns.length === 0) {
      return res.json([]);
    }

    const campgroundIds = [...new Set(userCheckIns.map((c: any) => c.campgroundId))];

    // Build a map of user's last visit date per campground
    const lastVisitMap = new Map<string, Date>();
    for (const ci of userCheckIns) {
      if (!lastVisitMap.has(ci.campgroundId)) {
        lastVisitMap.set(ci.campgroundId, ci.checkInDate);
      }
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Count recent check-ins at those campgrounds
    const recentCheckIns = await db.checkIn.groupBy({
      by: ['campgroundId'],
      where: {
        campgroundId: { in: campgroundIds },
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { id: true },
    });

    // Count recent photos at those campgrounds
    const recentPhotos = await db.campgroundPhoto.groupBy({
      by: ['campgroundId'],
      where: {
        campgroundId: { in: campgroundIds },
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { id: true },
    }).catch(() => []);

    // Merge activity counts
    const activityMap = new Map<string, number>();
    for (const ci of recentCheckIns) {
      activityMap.set(ci.campgroundId, (activityMap.get(ci.campgroundId) || 0) + ci._count.id);
    }
    for (const p of recentPhotos) {
      activityMap.set(p.campgroundId, (activityMap.get(p.campgroundId) || 0) + p._count.id);
    }

    // Sort by activity count, take top 3
    const sorted = [...activityMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (sorted.length === 0) {
      return res.json([]);
    }

    const topIds = sorted.map(([id]) => id);
    const campgrounds = await db.campground.findMany({
      where: { id: { in: topIds } },
      select: { id: true, name: true, state: true },
    });

    // Get one recent photo per campground
    const recentPhotoUrls = new Map<string, string>();
    for (const cId of topIds) {
      const photo = await db.campgroundPhoto.findFirst({
        where: { campgroundId: cId, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        select: { imageUrl: true },
      }).catch(() => null);
      if (photo?.imageUrl) recentPhotoUrls.set(cId, photo.imageUrl);
    }

    const campMap = new Map<string, any>(campgrounds.map((c: any) => [c.id, c]));

    const results = sorted.map(([campgroundId, count]) => {
      const camp: any = campMap.get(campgroundId);
      return {
        campgroundId,
        name: camp?.name || 'Unknown',
        state: camp?.state || null,
        recentActivityCount: count,
        lastVisitedAt: lastVisitMap.get(campgroundId) || null,
        recentPhotoUrl: recentPhotoUrls.get(campgroundId) || null,
      };
    });

    res.json(results);
  } catch (error: any) {
    console.error('Trending visited error:', error);
    res.status(500).json({ error: 'Failed to get trending visited campgrounds' });
  }
});

// Get campground by ID (MUST come last among GET routes)

// Get campground by ID (MUST come last among GET routes)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campground = await db.campground.findUnique({
      where: { id },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        checkIns: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { checkInDate: 'desc' },
        },
        stickers: {
          where: { isActive: true },
          include: {
            _count: {
              select: { userStickers: true },
            },
          },
        },
        _count: {
          select: {
            followers: true,
            checkIns: true,
            stickers: true,
          },
        },
      },
    });

    if (!campground) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    res.json(campground);
  } catch (error: any) {
    console.error('Get campground error:', error);
    res.status(500).json({ error: 'Failed to get campground' });
  }
});
// Get who's camping at this campground (current and upcoming)
router.get('/:id/campers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Collect unique campers
    const camperMap = new Map();

    // Get events at this campground (current and upcoming within 2 weeks)
    const events = await db.event.findMany({
      where: {
        campgroundId: id,
        endDate: { gte: now },
        startDate: { lte: twoWeeksFromNow },
        isWishlist: false,
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            showCampingStatus: true,
          }
        },
        attendees: {
          where: { status: 'GOING' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
                showCampingStatus: true,
              }
            }
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    // Add event organizers and attendees
    events.forEach((event: any) => {
      if (event.organizer.showCampingStatus !== false) {
        const isCurrentlyHere = new Date(event.startDate) <= now && new Date(event.endDate) >= now;
        camperMap.set(event.organizer.id, {
          user: {
            id: event.organizer.id,
            firstName: event.organizer.firstName,
            lastName: event.organizer.lastName,
            username: event.organizer.username,
            profilePicture: event.organizer.profilePicture,
          },
          startDate: event.startDate,
          endDate: event.endDate,
          isCurrentlyHere,
          tripTitle: event.title,
        });
      }
      
      event.attendees.forEach((attendee: any) => {
        if (attendee.user.showCampingStatus !== false && !camperMap.has(attendee.user.id)) {
          const isCurrentlyHere = new Date(event.startDate) <= now && new Date(event.endDate) >= now;
          camperMap.set(attendee.user.id, {
            user: {
              id: attendee.user.id,
              firstName: attendee.user.firstName,
              lastName: attendee.user.lastName,
              username: attendee.user.username,
              profilePicture: attendee.user.profilePicture,
            },
            startDate: event.startDate,
            endDate: event.endDate,
            isCurrentlyHere,
            tripTitle: event.title,
          });
        }
      });
    });

    // Get stays at this campground (current and upcoming within 2 weeks)
    const stays = await db.stay.findMany({
      where: {
        campgroundId: id,
        endDate: { gte: now },
        startDate: { lte: twoWeeksFromNow },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            showCampingStatus: true,
          }
        },
        trip: {
          select: { title: true }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    // Add stay users
    stays.forEach((stay: any) => {
      if (stay.user.showCampingStatus !== false && !camperMap.has(stay.user.id)) {
        const isCurrentlyHere = new Date(stay.startDate) <= now && new Date(stay.endDate) >= now;
        camperMap.set(stay.user.id, {
          user: {
            id: stay.user.id,
            firstName: stay.user.firstName,
            lastName: stay.user.lastName,
            username: stay.user.username,
            profilePicture: stay.user.profilePicture,
          },
          startDate: stay.startDate,
          endDate: stay.endDate,
          isCurrentlyHere,
          tripTitle: stay.trip?.title || 'Camping Trip',
        });
      }
    });

    // Get state visits at this campground (current and upcoming within 2 weeks)
    const stateVisits = await db.stateVisit.findMany({
      where: {
        campsiteId: id,
        OR: [
          { endDate: { gte: now } },
          { endDate: null, startDate: { lte: twoWeeksFromNow } }
        ],
        startDate: { lte: twoWeeksFromNow },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            showCampingStatus: true,
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    // Add state visit users
    stateVisits.forEach((visit: any) => {
      if (visit.user.showCampingStatus !== false && !camperMap.has(visit.user.id)) {
        const endDate = visit.endDate || new Date(new Date(visit.startDate).getTime() + 24 * 60 * 60 * 1000);
        const isCurrentlyHere = new Date(visit.startDate) <= now && endDate >= now;
        camperMap.set(visit.user.id, {
          user: {
            id: visit.user.id,
            firstName: visit.user.firstName,
            lastName: visit.user.lastName,
            username: visit.user.username,
            profilePicture: visit.user.profilePicture,
          },
          startDate: visit.startDate,
          endDate: endDate,
          isCurrentlyHere,
          tripTitle: visit.notes || 'State Visit',
        });
      }
    });

    const campers = Array.from(camperMap.values());
    
    // Sort: currently here first, then by start date
    campers.sort((a, b) => {
      if (a.isCurrentlyHere && !b.isCurrentlyHere) return -1;
      if (!a.isCurrentlyHere && b.isCurrentlyHere) return 1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    res.json({
      currentCampers: campers.filter(c => c.isCurrentlyHere),
      upcomingCampers: campers.filter(c => !c.isCurrentlyHere),
    });
  } catch (error: any) {
    console.error('Get campground campers error:', error);
    res.status(500).json({ error: 'Failed to get campers' });
  }
});

// GET /api/campgrounds/:id/regulars — top 5 most frequent visitors
router.get('/:id/regulars', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const checkIns = await db.checkIn.groupBy({
      by: ['userId'],
      where: { campgroundId: id },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    });
    if (checkIns.length === 0) return res.json({ regulars: [], total: 0 });
    const users = await db.user.findMany({
      where: { id: { in: checkIns.map((c: any) => c.userId) } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
    });
    const total = await db.checkIn.groupBy({ by: ['userId'], where: { campgroundId: id }, _count: { userId: true } });
    res.json({ regulars: users, total: total.length });
  } catch { res.json({ regulars: [], total: 0 }); }
});

export default router;


// SITE ADMIN EDIT - Will only
const SITE_ADMIN_IDS = ['cmlpeyk82005s3qause3sws7y', 'cmm9kukta0006i88masvtz2tp'];

router.put('/:id/admin-edit', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!SITE_ADMIN_IDS.includes(userId)) return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const {
      name, description, location, state, city, zipCode, latitude, longitude,
      phone, websiteUrl, businessEmail, businessPhone,
      bookingUrl, campspotSlug, facebookUrl, instagramUrl,
      twitterUrl, youtubeUrl, tiktokUrl, imageUrl,
      hasWifi, hasShowers, hasRestrooms, hasElectricHookup,
      hasWaterHookup, hasSewerHookup, hasDumpStation, hasLaundry,
      hasStore, hasPool, hasPullThrough, hasBackIn, isBigRigFriendly,
      isPetFriendly, isWaterfront, maxAmpService, maxRvLength,
      pricePerNight, seasonStart, seasonEnd, minRvYear,
    } = req.body;

    const campground = await db.campground.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(state !== undefined && { state }),
        ...(city !== undefined && { city }),
        ...(zipCode !== undefined && { zipCode }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(phone !== undefined && { phone }),
        ...(websiteUrl !== undefined && { websiteUrl }),
        ...(businessEmail !== undefined && { businessEmail }),
        ...(businessPhone !== undefined && { businessPhone }),
        ...(bookingUrl !== undefined && { bookingUrl }),
        ...(campspotSlug !== undefined && { campspotSlug }),
        ...(facebookUrl !== undefined && { facebookUrl }),
        ...(instagramUrl !== undefined && { instagramUrl }),
        ...(twitterUrl !== undefined && { twitterUrl }),
        ...(youtubeUrl !== undefined && { youtubeUrl }),
        ...(tiktokUrl !== undefined && { tiktokUrl }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(hasWifi !== undefined && { hasWifi }),
        ...(hasShowers !== undefined && { hasShowers }),
        ...(hasRestrooms !== undefined && { hasRestrooms }),
        ...(hasElectricHookup !== undefined && { hasElectricHookup }),
        ...(hasWaterHookup !== undefined && { hasWaterHookup }),
        ...(hasSewerHookup !== undefined && { hasSewerHookup }),
        ...(hasDumpStation !== undefined && { hasDumpStation }),
        ...(hasLaundry !== undefined && { hasLaundry }),
        ...(hasStore !== undefined && { hasStore }),
        ...(hasPool !== undefined && { hasPool }),
        ...(hasPullThrough !== undefined && { hasPullThrough }),
        ...(hasBackIn !== undefined && { hasBackIn }),
        ...(isBigRigFriendly !== undefined && { isBigRigFriendly }),
        ...(isPetFriendly !== undefined && { isPetFriendly }),
        ...(isWaterfront !== undefined && { isWaterfront }),
        ...(maxAmpService !== undefined && { maxAmpService: maxAmpService ? parseInt(maxAmpService) : null }),
        ...(maxRvLength !== undefined && { maxRvLength: maxRvLength ? parseInt(maxRvLength) : null }),
        ...(pricePerNight !== undefined && { pricePerNight: pricePerNight ? parseFloat(pricePerNight) : null }),
        ...(seasonStart !== undefined && { seasonStart }),
        ...(seasonEnd !== undefined && { seasonEnd }),
        ...(minRvYear !== undefined && { minRvYear: minRvYear ? parseInt(minRvYear) : null }),
      }
    });

    res.json(campground);
  } catch (error: any) {
    console.error('Admin edit error:', error);
    res.status(500).json({ error: 'Failed to update campground' });
  }
});

// PATCH /api/campgrounds/:id/banner-position
router.patch('/:id/banner-position', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { bannerPosition } = req.body;
    await db.campground.update({ where: { id }, data: { bannerPosition } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/campgrounds/:id/pulse-feed
// Returns last 20 ambient events for the campfire Pulse feed
router.get('/:id/pulse-feed', async (req: any, res: any) => {
  try {
    const { id: campgroundId } = req.params;
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48h
    const pulseEvents: any[] = [];

    // Recent check-ins
    const checkIns = await db.checkIn.findMany({
      where: { campgroundId, createdAt: { gte: since } },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    for (const c of checkIns) {
      pulseEvents.push({
        type: 'checkin',
        text: `🏕 ${c.user.firstName}${c.user.lastName ? ' ' + c.user.lastName[0] + '.' : ''} just checked in`,
        createdAt: c.createdAt,
        userId: c.user.id,
        userName: c.user.firstName,
      });
    }

    // Recent photos
    const photos = await db.photo.findMany({
      where: { event: { campgroundId }, createdAt: { gte: since } },
      include: { user: { select: { id: true, firstName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []);
    for (const p of photos) {
      pulseEvents.push({
        type: 'photo',
        text: `📸 ${(p as any).user?.firstName || 'Someone'} posted a photo`,
        createdAt: p.createdAt,
        userId: (p as any).user?.id,
        userName: (p as any).user?.firstName,
      });
    }

    // Recent wildlife sightings
    const wildlife = await (prisma as any).wildlifeSighting?.findMany?.({
      where: { campgroundId, createdAt: { gte: since } },
      include: { user: { select: { id: true, firstName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []) || [];
    for (const w of wildlife) {
      pulseEvents.push({
        type: 'wildlife',
        text: `🦅 ${w.species || 'Wildlife'} sighting reported${w.user?.firstName ? ' by ' + w.user.firstName : ''}`,
        createdAt: w.createdAt,
        userId: w.user?.id,
        userName: w.user?.firstName,
      });
    }

    // Recent followers
    const followers = await (prisma as any).campgroundFollow?.findMany?.({
      where: { campgroundId, createdAt: { gte: since } },
      include: { user: { select: { id: true, firstName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []) || [];
    for (const f of followers) {
      pulseEvents.push({
        type: 'follower',
        text: `❤️ ${f.user?.firstName || 'Someone'} started following this campground`,
        createdAt: f.createdAt,
        userId: f.user?.id,
        userName: f.user?.firstName,
      });
    }

    // Sort by time, take 20
    pulseEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ events: pulseEvents.slice(0, 20) });
  } catch (e: any) {
    res.json({ events: [] });
  }
});


// ─────────────────────────────────────────────────────────────────
// Crowdsourced pricing — POST a price report, GET aggregated stats,
// and check whether the current user should be prompted for a report.
// See backend/src/services/campground-pricing.service.ts
// ─────────────────────────────────────────────────────────────────

// POST /api/campgrounds/:id/price-report
router.post("/:id/price-report", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id: campgroundId } = req.params;
    const { pricePaid, siteType, hookupLevel, season, notes } = req.body;

    if (typeof pricePaid !== "number" || pricePaid <= 0 || pricePaid > 1000) {
      return res.status(400).json({ error: "pricePaid must be a number between 0 and 1000" });
    }

    const campground = await db.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true },
    });
    if (!campground) return res.status(404).json({ error: "Campground not found" });

    const report = await submitPriceReport({
      campgroundId,
      userId,
      pricePaid,
      siteType: typeof siteType === "string" ? siteType : undefined,
      hookupLevel: typeof hookupLevel === "string" ? hookupLevel : undefined,
      season: typeof season === "string" ? season : undefined,
      notes: typeof notes === "string" ? notes : undefined,
    });
    res.json({ report });
  } catch (e: any) {
    console.error("Submit price report error:", e?.message);
    res.status(500).json({ error: e?.message || "Failed to submit price report" });
  }
});

// GET /api/campgrounds/:id/price-stats — public, anyone can read
router.get("/:id/price-stats", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stats = await getPriceStats(id);
    res.json(stats);
  } catch (e: any) {
    console.error("Get price stats error:", e?.message);
    res.status(500).json({ error: "Failed to fetch price stats" });
  }
});

// GET /api/campgrounds/:id/price-prompt-eligible — does the current user
// qualify for a "what did you pay?" prompt right now? Used by the frontend
// to decide whether to show the report banner. Uses optionalAuth (NOT
// authenticateToken) so a missing/expired token returns {eligible: false}
// instead of a 401 — a 401 here would be caught by the frontend's global
// axios interceptor and forcibly sign the user out the moment they open
// any campground page, which is exactly what happened after f4eb6258 shipped.
router.get("/:id/price-prompt-eligible", optionalAuth, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.json({ eligible: false });
    const { id: campgroundId } = req.params;
    const eligible = await shouldPromptForPriceReport(userId, campgroundId);
    res.json({ eligible });
  } catch (e: any) {
    console.error("Price prompt eligible error:", e?.message);
    res.json({ eligible: false });
  }
});

