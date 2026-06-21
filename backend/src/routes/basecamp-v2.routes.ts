import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';
import '../services/feedSources';  // register all feed sources on startup
import { getBothFeeds, RawFeedItem } from '../services/feedRegistry';
import { enrichFeedItems, EnrichmentData } from '../services/feedEnrichment';

const router = Router();
const prisma = new PrismaClient() as any;

// ─── In-memory cache (userId → { data, expiresAt }) ───
const dashboardCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(userId: string): any | null {
  const entry = dashboardCache.get(userId);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  if (entry) dashboardCache.delete(userId);
  return null;
}

function setCache(userId: string, data: any) {
  dashboardCache.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  // Prune old entries every 100 sets
  if (dashboardCache.size > 500) {
    const now = Date.now();
    for (const [key, val] of dashboardCache) {
      if (now > val.expiresAt) dashboardCache.delete(key);
    }
  }
}

// ─── Discover card type selection ───
function selectDiscoverCardType(hasActiveTrip: boolean, tripStartsWithin3Days: boolean): string {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const month = new Date().getMonth(); // 0-indexed

  if (hour >= 5 && hour < 10) return 'MORNING_RECIPES';
  if (day === 5 || day === 6) return 'WEEKEND_PLACES';
  if (hasActiveTrip && tripStartsWithin3Days) return 'TRAVEL_STOPS';
  if (month >= 9 || month <= 1) return 'OFFSEASON_DREAMS'; // Oct-Feb
  // Rotate between TRENDING_LOCAL and FRIEND_WISHLIST
  return new Date().getDate() % 2 === 0 ? 'TRENDING_LOCAL' : 'FRIEND_WISHLIST';
}

// ─── Camp Kitchen context label ───
function getCampKitchenContext(hasActiveTrip: boolean, isCheckedIn: boolean, tripStartsSoon: boolean): string {
  const day = new Date().getDay();
  if (tripStartsSoon) return 'Easy meals for travel day';
  if (isCheckedIn) return 'Popular at campgrounds this week';
  if (day === 5 || day === 6 || day === 0) return 'Weekend campfire favorites';
  return 'What campers are making this week';
}

router.get('/dashboard', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    // Check cache
    const cached = getCached(userId);
    if (cached) return res.json(cached);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ─── Parallel data fetches (each wrapped in catch for resilience) ───
    const safe = (p: Promise<any>, fallback: any = null) => p.catch((e: any) => { console.error('[BasecampV2] query failed:', e.message); return fallback; });

    // Rig select shape — reused for owned + co-pilot queries
    const rigSelect = {
      id: true, rigName: true, rigEmoji: true, heroPhoto: true, rigClass: true,
      totalMiles: true, totalNights: true, statesVisited: true, activeTripId: true,
      totalMilesAllTime: true, totalStatesVisited: true, totalCampgroundsAllTime: true,
      totalNightsAllTime: true, followerCount: true, slug: true,
      // Owner dashboard fields
      year: true, make: true, model: true, lengthFeet: true, grossWeight: true,
      fuelType: true, towingCapacity: true, slideoutCount: true,
      freshWaterGal: true, grayWaterGal: true, blackWaterGal: true,
      tireSizeFront: true, tireSizeRear: true, tireInstallDate: true,
      purchaseDate: true, purchasePrice: true, currentOdometer: true,
      avgMPG: true, solarWatts: true, generatorWatts: true,
      coverPhotoUrl: true, galleryPhotoUrls: true,
      pilots: { select: { user: { select: { id: true, username: true, profilePicture: true } } }, take: 5 },
      rigMemories: { where: { isPinned: true }, orderBy: { order: 'asc' } as any, take: 4, select: { id: true, title: true, photoUrls: true, date: true } },
      posts: { orderBy: { createdAt: 'desc' } as any, take: 4, select: { id: true, photos: true, postType: true, createdAt: true } },
      _count: { select: { posts: true, followers: true } },
    };

    const [
      ownedRigs,
      coPilotRigs,
      coPilotRigs2,
      followedRigIds,
      followedUserIds,
      activeCheckIn,
      userWithPrefs,
    ] = await Promise.all([
      // All rigs the user owns (may include stubs)
      safe(prisma.rig.findMany({
        where: { ownerId: userId },
        select: rigSelect,
      }), []),
      // Rigs via RigPilot (co-pilot)
      safe(prisma.rigPilot.findMany({
        where: { userId },
        select: { rig: { select: rigSelect } },
      }), []),
      // Rigs via RigCoPilot
      safe(prisma.rigCoPilot.findMany({
        where: { userId },
        select: { rig: { select: rigSelect } },
      }), []),
      safe(prisma.rigFollow.findMany({
        where: { userId },
        select: { rigId: true, rig: { select: { id: true, ownerId: true, rigName: true, rigEmoji: true, slug: true, heroPhoto: true, owner: { select: { id: true, username: true, profilePicture: true } } } } },
        take: 100,
      }), []),
      safe(prisma.creatorFollow.findMany({
        where: { followerId: userId },
        select: { creatorId: true },
        take: 200,
      }), []),
      safe(prisma.checkIn.findFirst({
        where: { userId, isActive: true },
        select: { campground: { select: { id: true, name: true } }, checkInDate: true },
      })),
      safe(prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, firstName: true, homeLatitude: true, homeLongitude: true, hasPets: true, rvType: true,
          // Fallback RV fields from signup (used when Rig fields are empty)
          rvMake: true, rvModel: true, rvYear: true, rvLength: true, rvWeight: true,
          rvFuelType: true, rvSlideouts: true, rvMpg: true, rvGvwr: true, rvOdometer: true,
          rvFreshWaterGal: true, rvGreyWaterGal: true, rvBlackWaterGal: true,
          rvSolarWatts: true, rvGeneratorWatts: true,
        },
      })),
    ]);

    // ─── Resolve the user's canonical rig (owned OR co-pilot) ───
    // Gather all candidate rigs, de-dup by id, pick the best one (most content).
    const candidateRigs: any[] = [
      ...ownedRigs,
      ...coPilotRigs.map((cp: any) => cp.rig),
      ...coPilotRigs2.map((cp: any) => cp.rig),
    ];
    const candidateRigMap = new Map<string, any>();
    for (const r of candidateRigs) {
      if (r?.id && !candidateRigMap.has(r.id)) candidateRigMap.set(r.id, r);
    }
    const uniqueRigs = Array.from(candidateRigMap.values());
    // Score: prefer rigs with a name, cover photo, followers, and content
    function rigScore(r: any): number {
      let s = 0;
      if (r.rigName) s += 100;
      if (r.heroPhoto || r.coverPhotoUrl) s += 50;
      if (r.followerCount) s += r.followerCount;
      if (r.totalMilesAllTime) s += 10;
      if (r.posts?.length) s += r.posts.length * 5;
      return s;
    }
    uniqueRigs.sort((a, b) => rigScore(b) - rigScore(a));
    const userRig = uniqueRigs[0] || null;

    const rigId = userRig?.id;
    const followedRigs = followedRigIds.map((f: any) => f.rig);
    const followedRigIdList = followedRigs.map((r: any) => r.id);
    const friendIds = followedUserIds.map((f: any) => f.creatorId);

    // ─── Second wave of parallel queries ───
    const [
      activeTrip,
      lastCheckIn,
      lastPhotoPost,
      lastSavedCampground,
      newFollowers,
      recentTimeline,
      recentPosts,
      recentStops,
      wishlistItems,
      friendWishlists,
      recipes,
      followedRigRecipes,
      communityFeed,
      maintenanceRecords,
      maintenanceReminders,
    ] = await Promise.all([
      safe(rigId && userRig?.activeTripId
        ? prisma.rigTrip.findUnique({
            where: { id: userRig.activeTripId },
            select: { id: true, name: true, totalMiles: true, totalNights: true, statesVisited: true, startDate: true, endDate: true, status: true,
              stops: { orderBy: { order: 'desc' }, take: 1, select: { name: true, state: true } } },
          })
        : rigId
          ? prisma.rigTrip.findFirst({
              where: { rigId, status: 'ACTIVE' },
              select: { id: true, name: true, totalMiles: true, totalNights: true, statesVisited: true, startDate: true, endDate: true, status: true,
                stops: { orderBy: { order: 'desc' }, take: 1, select: { name: true, state: true } } },
            })
          : Promise.resolve(null)),
      safe(prisma.checkIn.findFirst({
        where: { userId },
        orderBy: { checkInDate: 'desc' },
        select: { campground: { select: { name: true } }, checkInDate: true },
      })),
      safe(rigId ? prisma.rigPost.findFirst({
        where: { rigId, NOT: { photos: { equals: [] } } },
        orderBy: { createdAt: 'desc' },
        select: { photos: true, createdAt: true, tripId: true },
      }) : Promise.resolve(null)),
      safe(prisma.campgroundWishlist.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { campground: { select: { name: true, state: true } }, createdAt: true },
      })),
      safe(rigId ? prisma.rigFollow.findMany({
        where: { rigId, followedAt: { gte: oneWeekAgo } },
        orderBy: { followedAt: 'desc' },
        take: 3,
        select: { user: { select: { id: true, username: true, profilePicture: true, firstName: true } } },
      }) : Promise.resolve([]), []),
      safe(followedRigIdList.length > 0 ? prisma.rigTimelineItem.findMany({
        where: { rigId: { in: followedRigIdList }, occurredAt: { gte: yesterday } },
        orderBy: { occurredAt: 'desc' },
        take: 20,
        select: { id: true, rigId: true, itemType: true, title: true, previewImageUrl: true, previewText: true, occurredAt: true, refId: true, refType: true },
      }) : Promise.resolve([]), []),
      safe(followedRigIdList.length > 0 ? prisma.rigPost.findMany({
        where: { rigId: { in: followedRigIdList }, createdAt: { gte: yesterday }, NOT: { photos: { equals: [] } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, rigId: true, photos: true, createdAt: true, title: true, body: true, stopId: true },
      }) : Promise.resolve([]), []),
      safe(followedRigIdList.length > 0 ? prisma.rigTripStop.findMany({
        where: { rigId: { in: followedRigIdList }, arrivedAt: { gte: yesterday } },
        orderBy: { arrivedAt: 'desc' },
        take: 10,
        select: { id: true, rigId: true, name: true, state: true, arrivedAt: true, coverImageUrl: true, campgroundId: true, tripId: true },
      }) : Promise.resolve([]), []),
      safe(prisma.campgroundWishlist.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { campgroundId: true, createdAt: true, campground: { select: { id: true, name: true, state: true, imageUrl: true, googleRating: true } } },
      }), []),
      safe(friendIds.length > 0 ? prisma.campgroundWishlist.findMany({
        where: { userId: { in: friendIds.slice(0, 50) } },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { campgroundId: true, campground: { select: { id: true, name: true, state: true, imageUrl: true } },
          user: { select: { firstName: true, profilePicture: true } } },
      }) : Promise.resolve([]), []),
      safe(prisma.recipe.findMany({
        where: { privacy: 'PUBLIC' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, title: true, imageUrl: true, category: true, difficulty: true, userId: true,
          user: { select: { username: true } } },
      }), []),
      safe(friendIds.length > 0 ? prisma.recipe.findMany({
        where: { userId: { in: friendIds.slice(0, 50) }, privacy: 'PUBLIC' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, title: true, imageUrl: true, category: true,
          user: { select: { username: true } } },
      }) : Promise.resolve([]), []),
      safe(prisma.boardPost.findMany({
        where: {
          author: { isSystem: false },
          isCharacterPost: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 16,
        select: {
          id: true, title: true, body: true, createdAt: true, voteScore: true,
          author: { select: { username: true, profilePicture: true } },
          _count: { select: { comments: true } },
        },
      }), []),
      // Maintenance records + reminders for rig health
      safe(prisma.maintenanceRecord.findMany({
        where: { userId },
        orderBy: { serviceDate: 'desc' },
        take: 50,
        select: { id: true, title: true, category: true, cost: true, serviceDate: true, status: true, receiptImage: true },
      }), []),
      safe(prisma.maintenanceReminder.findMany({
        where: { userId, isActive: true },
        select: { id: true, title: true, nextDueDate: true, nextDueMileage: true, category: true },
      }), []),
    ]);

    // ─── Build rig lookup map ───
    const rigMap: Record<string, any> = {};
    for (const r of followedRigs) rigMap[r.id] = r;

    // ─── Build rigPulse ───
    const tripDestination = activeTrip?.stops?.[0]?.name || activeTrip?.name || null;
    const daysAway = activeTrip?.startDate
      ? Math.max(0, Math.ceil((new Date(activeTrip.startDate).getTime() - now.getTime()) / 86400000))
      : null;
    const lastCheckInDaysAgo = lastCheckIn?.checkInDate
      ? Math.floor((now.getTime() - new Date(lastCheckIn.checkInDate).getTime()) / 86400000)
      : null;

    const rigPulse = {
      hasActiveTrip: !!activeTrip,
      trip: activeTrip ? {
        name: activeTrip.name,
        destination: tripDestination,
        daysAway,
        totalMiles: activeTrip.totalMiles,
        totalNights: activeTrip.totalNights,
        statesVisited: activeTrip.statesVisited?.length || 0,
      } : null,
      lastCheckIn: lastCheckIn ? {
        campgroundName: lastCheckIn.campground?.name || 'Unknown',
        date: lastCheckIn.checkInDate,
        daysAgo: lastCheckInDaysAgo,
      } : null,
      lastPhoto: lastPhotoPost ? {
        url: lastPhotoPost.photos?.[0] || null,
        tripName: null,
        date: lastPhotoPost.createdAt,
      } : null,
      lastSavedCampground: lastSavedCampground ? {
        name: lastSavedCampground.campground?.name,
        state: lastSavedCampground.campground?.state,
        savedAt: lastSavedCampground.createdAt,
      } : null,
      newFollowers: newFollowers.map((f: any) => ({
        userId: f.user.id,
        username: f.user.username,
        avatarUrl: f.user.profilePicture,
        firstName: f.user.firstName,
      })),
      totalMilesAllTime: userRig?.totalMilesAllTime || 0,
      totalNightsAllTime: userRig?.totalNightsAllTime || 0,
      totalStatesVisited: userRig?.totalStatesVisited?.length || 0,
      totalCampgroundsAllTime: userRig?.totalCampgroundsAllTime || 0,
      followerCount: userRig?.followerCount || userRig?._count?.followers || 0,
      postCount: userRig?._count?.posts || 0,
      rigName: userRig?.rigName || null,
      rigSpec: [userRig?.year, userRig?.make || userWithPrefs?.rvMake, userRig?.model || userWithPrefs?.rvModel].filter(Boolean).join(' ') || null,
      rigEmoji: userRig?.rigEmoji || '',
      rigPhoto: userRig?.heroPhoto || null,
      rigSlug: userRig?.slug || null,
      coPilots: (userRig?.pilots || []).map((p: any) => ({
        userId: p.user.id,
        username: p.user.username,
        avatarUrl: p.user.profilePicture,
      })),
      pinnedMemories: (userRig?.rigMemories || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        photoUrl: m.photoUrls?.[0] || null,
        date: m.date,
      })),
      rigClass: userRig?.rigClass || userWithPrefs?.rvType || null,
      coverPhoto: userRig?.coverPhotoUrl || userRig?.heroPhoto || null,
      recentPhotos: (userRig?.posts || [])
        .filter((p: any) => p.photos?.length > 0)
        .flatMap((p: any) => p.photos)
        .slice(0, 6),
      // Owner dashboard detail fields (Rig fields with User signup fallbacks)
      ownerDetails: {
        year: userRig?.year || userWithPrefs?.rvYear || null,
        make: userRig?.make || userWithPrefs?.rvMake || null,
        model: userRig?.model || userWithPrefs?.rvModel || null,
        lengthFeet: userRig?.lengthFeet || (userWithPrefs?.rvLength ? Number(userWithPrefs.rvLength) : null),
        grossWeight: userRig?.grossWeight || userWithPrefs?.rvGvwr || userWithPrefs?.rvWeight || null,
        fuelType: userRig?.fuelType || userWithPrefs?.rvFuelType || null,
        towingCapacity: userRig?.towingCapacity || null,
        slideoutCount: userRig?.slideoutCount || userWithPrefs?.rvSlideouts || null,
        freshWaterGal: userRig?.freshWaterGal || (userWithPrefs?.rvFreshWaterGal ? Math.round(userWithPrefs.rvFreshWaterGal) : null),
        grayWaterGal: userRig?.grayWaterGal || (userWithPrefs?.rvGreyWaterGal ? Math.round(userWithPrefs.rvGreyWaterGal) : null),
        blackWaterGal: userRig?.blackWaterGal || (userWithPrefs?.rvBlackWaterGal ? Math.round(userWithPrefs.rvBlackWaterGal) : null),
        tireSizeFront: userRig?.tireSizeFront || null,
        tireSizeRear: userRig?.tireSizeRear || null,
        tireInstallDate: userRig?.tireInstallDate || null,
        purchaseDate: userRig?.purchaseDate || null,
        purchasePrice: userRig?.purchasePrice || null,
        currentOdometer: userRig?.currentOdometer || userWithPrefs?.rvOdometer || null,
        avgMPG: userRig?.avgMPG || userWithPrefs?.rvMpg || null,
        solarWatts: userRig?.solarWatts || userWithPrefs?.rvSolarWatts || null,
        generatorWatts: userRig?.generatorWatts || userWithPrefs?.rvGeneratorWatts || null,
      },
      maintenance: {
        serviceCount: maintenanceRecords.length,
        totalSpent: maintenanceRecords.reduce((sum: number, r: any) => sum + (r.cost || 0), 0),
        overdueCount: maintenanceReminders.filter((r: any) => r.nextDueDate && new Date(r.nextDueDate) < new Date()).length,
        upcomingCount: maintenanceReminders.filter((r: any) => r.nextDueDate && new Date(r.nextDueDate) >= new Date()).length,
        overdue: maintenanceReminders.filter((r: any) => r.nextDueDate && new Date(r.nextDueDate) < new Date()).slice(0, 2).map((r: any) => ({ id: r.id, title: r.title, category: r.category })),
        upcoming: maintenanceReminders.filter((r: any) => r.nextDueDate && new Date(r.nextDueDate) >= new Date()).slice(0, 2).map((r: any) => ({ id: r.id, title: r.title, category: r.category, dueDate: r.nextDueDate })),
        recentRecords: maintenanceRecords.slice(0, 5).map((r: any) => ({ id: r.id, title: r.title, category: r.category, cost: r.cost, serviceDate: r.serviceDate, hasReceipt: !!r.receiptImage })),
      },
    };

    // ─── Build rvCircle ───
    const circleItems: any[] = [];

    // From timeline items
    for (const item of recentTimeline) {
      const rig = rigMap[item.rigId];
      if (!rig) continue;
      circleItems.push({
        type: item.itemType || 'RIG_UPDATE',
        actorRigName: rig.rigName || 'A rig',
        actorRigSlug: rig.slug,
        actorOwnerAvatar: rig.owner?.profilePicture || null,
        description: item.title || item.previewText || 'updated their rig',
        previewImageUrl: item.previewImageUrl,
        location: null,
        distanceMiles: null,
        occurredAt: item.occurredAt,
        navigateTo: `/rig/${rig.slug}`,
      });
    }

    // From photo posts
    for (const post of recentPosts) {
      const rig = rigMap[post.rigId];
      if (!rig) continue;
      const photoCount = Array.isArray(post.photos) ? post.photos.length : 0;
      const location = null; // stopId exists but no relation — would need separate lookup
      circleItems.push({
        type: 'PHOTO_UPLOAD',
        actorRigName: rig.rigName || 'A rig',
        actorRigSlug: rig.slug,
        actorOwnerAvatar: rig.owner?.profilePicture || null,
        description: `uploaded ${photoCount} photo${photoCount !== 1 ? 's' : ''}${location ? ' from ' + location : ''}`,
        previewImageUrl: post.photos?.[0] || null,
        location,
        distanceMiles: null,
        occurredAt: post.createdAt,
        navigateTo: `/rig/${rig.slug}?tab=photos`,
      });
    }

    // From trip stop checkins
    for (const stop of recentStops) {
      const rig = rigMap[stop.rigId];
      if (!rig) continue;
      circleItems.push({
        type: 'CHECKIN',
        actorRigName: rig.rigName || 'A rig',
        actorRigSlug: rig.slug,
        actorOwnerAvatar: rig.owner?.profilePicture || null,
        description: `checked into ${stop.name}${stop.state ? ', ' + stop.state : ''}`,
        previewImageUrl: stop.coverImageUrl || null,
        location: `${stop.name}${stop.state ? ', ' + stop.state : ''}`,
        distanceMiles: null,
        occurredAt: stop.arrivedAt,
        navigateTo: stop.campgroundId ? `/campgrounds/${stop.campgroundId}` : `/rig/${rig.slug}`,
      });
    }

    // Sort, deduplicate (rigId+type within 6hr), take 8
    circleItems.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    const seen = new Set<string>();
    const dedupedCircle = circleItems.filter(item => {
      const key = `${item.actorRigSlug}:${item.type}`;
      const hourBucket = Math.floor(new Date(item.occurredAt).getTime() / (6 * 3600 * 1000));
      const dedupKey = `${key}:${hourBucket}`;
      if (seen.has(dedupKey)) return false;
      seen.add(dedupKey);
      return true;
    }).slice(0, 8);

    const rvCircle = {
      items: dedupedCircle,
      nearbyRigs: [], // Would require live location — placeholder for now
    };

    // ─── Build discover ───
    const tripStartsSoon = activeTrip?.startDate
      ? (new Date(activeTrip.startDate).getTime() - now.getTime()) < 3 * 24 * 60 * 60 * 1000
      : false;
    const cardType = selectDiscoverCardType(!!activeTrip, tripStartsSoon);

    const discoverTitles: Record<string, { title: string; subtitle: string }> = {
      MORNING_RECIPES: { title: '☀️ Good morning — campfire breakfast ideas', subtitle: 'Start the day right, wherever you are' },
      WEEKEND_PLACES: { title: '🗓️ Weekend inspiration', subtitle: 'Places your friends want to explore' },
      TRAVEL_STOPS: { title: '🛣️ Stops worth seeing on your route', subtitle: 'Fellow RVers recommend these on the way' },
      OFFSEASON_DREAMS: { title: '🌵 Dream destinations for winter camping', subtitle: 'Where RVers escape the cold' },
      TRENDING_LOCAL: { title: '🔥 Trending near you', subtitle: 'What fellow RVers are exploring' },
      FRIEND_WISHLIST: { title: '❤️ On your friends\' wishlists', subtitle: 'Places your network wants to visit' },
    };

    let discoverItems: any[] = [];
    if (cardType === 'MORNING_RECIPES') {
      discoverItems = recipes.slice(0, 5).map((r: any) => ({
        id: r.id, name: r.title, imageUrl: r.imageUrl, type: 'recipe',
      }));
    } else if (cardType === 'FRIEND_WISHLIST' && friendWishlists.length > 0) {
      discoverItems = friendWishlists.slice(0, 5).map((w: any) => ({
        id: w.campground.id, name: w.campground.name, imageUrl: w.campground.imageUrl, type: 'campground',
        friendCount: 1,
      }));
    } else {
      // Default: trending campgrounds
      const trending = await prisma.campground.findMany({
        where: { googleRating: { gte: 4.0 } },
        orderBy: { googleRating: 'desc' },
        take: 5,
        select: { id: true, name: true, imageUrl: true, state: true, googleRating: true },
      });
      discoverItems = trending.map((c: any) => ({
        id: c.id, name: c.name, imageUrl: c.imageUrl, type: 'campground', rating: c.googleRating,
      }));
    }

    const discover = {
      cardType,
      ...discoverTitles[cardType],
      items: discoverItems,
      reason: `Selected based on ${cardType === 'MORNING_RECIPES' ? 'time of day' : cardType === 'WEEKEND_PLACES' ? 'weekend timing' : 'your interests'}`,
    };

    // ─── Build dreaming ───
    const dreaming = {
      myWishlist: wishlistItems.map((w: any) => ({
        campgroundId: w.campground.id,
        name: w.campground.name,
        state: w.campground.state,
        imageUrl: w.campground.imageUrl,
        savedAt: w.createdAt,
        rating: w.campground.googleRating,
      })),
      friendsWishlist: friendWishlists.map((w: any) => ({
        campgroundId: w.campground.id,
        name: w.campground.name,
        state: w.campground.state,
        imageUrl: w.campground.imageUrl,
        friendName: w.user.firstName,
        friendAvatar: w.user.profilePicture,
      })),
      rigRecommendations: [], // Would need rig-similarity matching — placeholder
      nearTrip: [], // Would need route analysis — placeholder
    };

    // ─── Build campKitchen ───
    const campKitchen = {
      contextLabel: getCampKitchenContext(!!activeTrip, !!activeCheckIn, tripStartsSoon),
      recipes: recipes.map((r: any) => ({
        id: r.id,
        title: r.title,
        imageUrl: r.imageUrl,
        cookingMethod: r.category || 'campfire',
        authorRigName: null,
        authorRigSlug: null,
        likes: 0,
      })),
      fromRigsFollowed: followedRigRecipes.map((r: any) => ({
        id: r.id,
        title: r.title,
        imageUrl: r.imageUrl,
        authorRigName: r.user?.username || null,
        authorRigSlug: null,
      })),
    };

    // ─── Build communityFeed ───
    const topPost = communityFeed[0] || null;
    const communityFeedData = {
      topItem: topPost ? {
        postId: topPost.id,
        type: 'BOARD_POST',
        authorUsername: topPost.author?.username,
        authorAvatar: topPost.author?.profilePicture,
        preview: topPost.title,
        imageUrl: null,
        likeCount: topPost.voteScore || 0,
        commentCount: topPost._count?.comments || 0,
      } : null,
      recentItems: communityFeed.slice(1, 16).map((p: any) => ({
        postId: p.id,
        type: 'BOARD_POST',
        authorUsername: p.author?.username,
        authorAvatar: p.author?.profilePicture,
        preview: p.title,
        body: p.body?.slice(0, 120),
        likeCount: p.voteScore || 0,
        commentCount: p._count?.comments || 0,
        createdAt: p.createdAt,
      })),
    };

    const result = {
      rigPulse,
      rvCircle,
      discover,
      dreaming,
      campKitchen,
      communityFeed: communityFeedData,
    };

    setCache(userId, result);
    res.json(result);
  } catch (e: any) {
    console.error('[BasecampV2] dashboard error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// RIG DETAILS — inline editing from Basecamp card
// ══════════════════════════════════════════════════════════════════════

// Allowed rig fields that can be updated from the Basecamp card
const EDITABLE_RIG_FIELDS = new Set([
  'year', 'make', 'model', 'rigClass', 'lengthFeet', 'grossWeight',
  'fuelType', 'towingCapacity', 'slideoutCount', 'solarWatts', 'generatorWatts',
  'freshWaterGal', 'grayWaterGal', 'blackWaterGal',
  'tireSizeFront', 'tireSizeRear',
  'purchaseDate', 'currentOdometer', 'avgMPG',
]);

router.patch('/rig-details', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    // Resolve the user's canonical rig
    const { resolveUserRigId } = require('../services/rigResolver');
    const rig = await resolveUserRigId(userId);
    if (!rig) return res.status(404).json({ error: 'No rig found' });

    // Check authorization (owner or editor)
    const rigRecord = await prisma.rig.findUnique({ where: { id: rig.id }, select: { ownerId: true } });
    if (!rigRecord) return res.status(404).json({ error: 'Rig not found' });

    const isOwner = rigRecord.ownerId === userId;
    let isEditor = false;
    if (!isOwner) {
      const pilot = await prisma.rigPilot.findUnique({ where: { rigId_userId: { rigId: rig.id, userId } } });
      isEditor = !!pilot; // co-pilots can edit rig details
    }
    if (!isOwner && !isEditor) return res.status(403).json({ error: 'Not authorized' });

    // Filter to only allowed fields and sanitize types
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (!EDITABLE_RIG_FIELDS.has(key)) continue;
      if (value === '' || value === null) { updates[key] = null; continue; }

      // Type coercion
      if (['year', 'grossWeight', 'towingCapacity', 'slideoutCount', 'solarWatts', 'generatorWatts', 'freshWaterGal', 'grayWaterGal', 'blackWaterGal', 'currentOdometer'].includes(key)) {
        updates[key] = parseInt(String(value), 10) || null;
      } else if (['lengthFeet', 'avgMPG'].includes(key)) {
        updates[key] = parseFloat(String(value)) || null;
      } else if (key === 'purchaseDate') {
        updates[key] = value ? new Date(String(value)) : null;
      } else {
        updates[key] = String(value);
      }
    }

    if (Object.keys(updates).length === 0) return res.json({ ok: true, updated: {} });

    // Read current specs metadata
    const currentRig = await prisma.rig.findUnique({ where: { id: rig.id }, select: { specs: true } });
    const specsMetadata: Record<string, any> = (currentRig?.specs as any) || {};

    // Determine source from request (defaults to "user")
    const source = req.body._source || 'user';
    const verifiedByUser = source === 'user';

    // Update per-field metadata
    for (const key of Object.keys(updates)) {
      specsMetadata[key] = {
        source,
        confidence: req.body._confidence?.[key] || (source === 'user' ? null : 'medium'),
        verifiedByUser,
        updatedAt: new Date().toISOString(),
      };
    }

    const updated = await prisma.rig.update({
      where: { id: rig.id },
      data: { ...updates, specs: specsMetadata },
      select: { id: true, specs: true, ...Object.fromEntries(Object.keys(updates).map(k => [k, true])) },
    });

    // Invalidate dashboard cache for this user
    dashboardCache.delete(userId);

    res.json({ ok: true, updated });
  } catch (e: any) {
    console.error('[BasecampV2] rig-details update error:', e);
    res.status(500).json({ error: 'Failed to update rig details' });
  }
});

// ══════════════════════════════════════════════════════════════════════
// FEED TAB ENDPOINTS — Network vs Community feeds + unseen tracking
// ══════════════════════════════════════════════════════════════════════

// ─── Serialize RawFeedItem → API response shape ───
function serializeFeedItem(item: RawFeedItem, enrichment?: EnrichmentData) {
  return {
    postId: item.entityId,
    type: item.entityType,
    sourceKey: item.sourceKey,
    authorId: item.actorId,
    authorUsername: item.payload.authorUsername,
    authorFirstName: item.payload.authorFirstName,
    authorAvatar: item.payload.authorAvatar || null,
    preview: item.payload.preview,
    body: item.payload.body,
    imageUrl: item.payload.imageUrl || null,
    tags: item.payload.tags || [],
    likeCount: item.payload.likeCount || 0,
    commentCount: item.payload.commentCount || 0,
    createdAt: item.createdAt,
    // Source-specific fields for link resolution
    campgroundId: item.payload.campgroundId || null,
    campgroundName: item.payload.campgroundName || null,
    campgroundState: item.payload.campgroundState || null,
    rigId: item.payload.rigId || null,
    rigSlug: item.payload.rigSlug || null,
    rigName: item.payload.rigName || null,
    tripKitId: item.payload.tripKitId || null,
    isActive: item.payload.isActive ?? null,
    isTrending: item.payload.isTrending || false,
    isSubscribed: item.payload.isSubscribed || false,
    // Enrichment (only present when threshold is met)
    enrichment: enrichment || null,
  };
}

// GET /network-feed — people you're friends with, and their activity
router.get('/network-feed', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { network, ctx } = await getBothFeeds(userId);
    const enrichments = await enrichFeedItems(network.items, ctx.friendIds);

    const items = network.items.map(item =>
      serializeFeedItem(item, enrichments.get(item.entityId))
    );

    res.json({ items, newestAt: network.newestAt });
  } catch (e: any) {
    console.error('[BasecampV2] network-feed error:', e);
    res.json({ items: [], newestAt: null });
  }
});

// GET /community-feed — things you follow that aren't a personal friendship
router.get('/community-feed', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { community, ctx } = await getBothFeeds(userId);
    const enrichments = await enrichFeedItems(community.items, ctx.friendIds);

    const items = community.items.map(item =>
      serializeFeedItem(item, enrichments.get(item.entityId))
    );

    res.json({ items, newestAt: community.newestAt });
  } catch (e: any) {
    console.error('[BasecampV2] community-feed error:', e);
    res.json({ items: [], newestAt: null });
  }
});

// GET /feed-tab-state — returns lastSeenAt + newestAt per tab for badge logic
router.get('/feed-tab-state', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const [tabs, { network, community }] = await Promise.all([
      prisma.userFeedTab.findMany({ where: { userId } }),
      getBothFeeds(userId),
    ]);
    const networkSeen = tabs.find((t: any) => t.tab === 'network')?.lastSeenAt || null;
    const communitySeen = tabs.find((t: any) => t.tab === 'community')?.lastSeenAt || null;

    res.json({
      network: { lastSeenAt: networkSeen, newestAt: network.newestAt },
      community: { lastSeenAt: communitySeen, newestAt: community.newestAt },
    });
  } catch (e: any) {
    res.json({ network: { lastSeenAt: null, newestAt: null }, community: { lastSeenAt: null, newestAt: null } });
  }
});

// POST /feed-tab-seen — mark a tab as seen
router.post('/feed-tab-seen', authenticateToken, async (req: any, res: Response) => {
  try {
    const { tab } = req.body;
    if (!['network', 'community'].includes(tab)) return res.status(400).json({ error: 'Invalid tab' });
    await prisma.userFeedTab.upsert({
      where: { userId_tab: { userId: req.userId, tab } },
      update: { lastSeenAt: new Date() },
      create: { userId: req.userId, tab, lastSeenAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.json({ ok: false });
  }
});

export default router;
