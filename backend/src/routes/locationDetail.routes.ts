import { Router, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// ─── Helper: get location record by type + id ───────────────

async function getLocation(type: string, id: string): Promise<any> {
  if (type === 'campground') {
    return prisma.campground.findUnique({ where: { id }, include: { reviews: { take: 0 }, _count: { select: { reviews: true, checkIns: true, followers: true } } } });
  }
  if (type === 'overnight-stop') {
    return prisma.overnightStop.findUnique({ where: { id }, include: { _count: { select: { reviews: true, visits: true } } } });
  }
  // Fallback: try campground by customSlug
  const bySlug = await prisma.campground.findFirst({ where: { customSlug: id } });
  if (bySlug) return bySlug;
  return null;
}

function mapLocationType(type: string): string {
  if (type === 'campground') return 'CAMPGROUND';
  if (type === 'overnight-stop') return 'OVERNIGHT_STOP';
  return type.toUpperCase().replace(/-/g, '_');
}

// ─── MASTER DETAIL ENDPOINT ─────────────────────────────────

router.get('/:type/:id', optionalAuth, async (req: any, res: Response) => {
  try {
    const { type, id } = req.params;
    const userId = req.userId || null;
    const locationType = mapLocationType(type);

    const location = await getLocation(type, id);
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const locationId = location.id;

    // Parallel fetch all data
    const [reviews, tips, activityFeed, savedCount, recentVisitors, locationReviewStats] = await Promise.all([
      // Reviews (top 10 by helpful)
      prisma.locationReview.findMany({
        where: { locationId, locationType },
        orderBy: { helpfulCount: 'desc' },
        take: 10,
      }),
      // Tips
      prisma.locationTip.findMany({
        where: { locationId, locationType },
        orderBy: { helpfulCount: 'desc' },
        take: 20,
      }),
      // Activity feed
      prisma.locationActivityItem.findMany({
        where: { locationId, locationType },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Saved count
      prisma.locationSaveToTrip.count({ where: { locationId } }),
      // Recent visitors (from check-ins for campgrounds, visits for overnight)
      type === 'campground'
        ? prisma.checkIn.findMany({
            where: { campgroundId: locationId },
            orderBy: { checkInDate: 'desc' },
            take: 12,
            include: { user: { select: { id: true, username: true, firstName: true, profilePicture: true } } },
          })
        : prisma.overnightStopVisit.findMany({
            where: { overnightStopId: locationId, isPublic: true },
            orderBy: { date: 'desc' },
            take: 12,
          }),
      // Avg rating from LocationReview
      prisma.locationReview.aggregate({
        where: { locationId, locationType },
        _avg: { overallRating: true, cleanlinessRating: true, safetyRating: true, noiseRating: true, internetRating: true, scenicRating: true },
        _count: true,
      }),
    ]);

    // Enrich reviews with author data
    const reviewAuthorIds = [...new Set(reviews.map((r: any) => r.userId))];
    const reviewAuthors = await prisma.user.findMany({
      where: { id: { in: reviewAuthorIds } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvType: true, rvMake: true, rvModel: true },
    });
    const authorMap = new Map(reviewAuthors.map((a: any) => [a.id, a]));
    const enrichedReviews = reviews.map((r: any) => ({ ...r, author: authorMap.get(r.userId) || null }));

    // Enrich tips with author
    const tipAuthorIds = [...new Set(tips.map((t: any) => t.userId))];
    const tipAuthors = await prisma.user.findMany({
      where: { id: { in: tipAuthorIds } },
      select: { id: true, firstName: true, username: true, profilePicture: true },
    });
    const tipAuthorMap = new Map(tipAuthors.map((a: any) => [a.id, a]));
    const enrichedTips = tips.map((t: any) => ({ ...t, author: tipAuthorMap.get(t.userId) || null }));

    // Enrich activity with actor data
    const actorIds = [...new Set(activityFeed.map((a: any) => a.userId))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, firstName: true, username: true, profilePicture: true },
    });
    const actorMap = new Map(actors.map((a: any) => [a.id, a]));
    const enrichedActivity = activityFeed.map((a: any) => ({ ...a, actor: actorMap.get(a.userId) || null }));

    // Recent visitors enriched
    const visitorUsers = recentVisitors.map((v: any) => ({
      userId: v.user?.id || v.userId,
      username: v.user?.username,
      avatarUrl: v.user?.profilePicture,
      firstName: v.user?.firstName,
      visitedAt: v.checkInDate || v.date,
    }));

    // Friends who stayed (if logged in)
    let friendsWhoStayed: any[] = [];
    if (userId) {
      const friendships = await prisma.friendship.findMany({
        where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] },
        select: { initiatorId: true, receiverId: true },
      });
      const friendIds = friendships.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId);

      if (friendIds.length > 0 && type === 'campground') {
        const friendCheckins = await prisma.checkIn.findMany({
          where: { campgroundId: locationId, userId: { in: friendIds } },
          include: { user: { select: { id: true, username: true, firstName: true, profilePicture: true } } },
          take: 10,
        });
        const seen = new Set<string>();
        friendsWhoStayed = friendCheckins.filter((c: any) => { if (seen.has(c.userId)) return false; seen.add(c.userId); return true; })
          .map((c: any) => ({ userId: c.user.id, username: c.user.username, avatarUrl: c.user.profilePicture, firstName: c.user.firstName }));
      }
    }

    // Current user's review + save status
    let currentUserReview = null;
    let isSavedByCurrentUser = false;
    if (userId) {
      [currentUserReview, isSavedByCurrentUser] = await Promise.all([
        prisma.locationReview.findFirst({ where: { locationId, locationType, userId } }),
        prisma.locationSaveToTrip.findFirst({ where: { locationId, userId } }).then((r: any) => !!r),
      ]);
    }

    // Community stats
    const communityStats = {
      totalReviews: locationReviewStats._count || 0,
      avgRating: locationReviewStats._avg?.overallRating ? Math.round(locationReviewStats._avg.overallRating * 10) / 10 : null,
      avgCleanliness: locationReviewStats._avg?.cleanlinessRating ? Math.round(locationReviewStats._avg.cleanlinessRating * 10) / 10 : null,
      avgSafety: locationReviewStats._avg?.safetyRating ? Math.round(locationReviewStats._avg.safetyRating * 10) / 10 : null,
      avgNoise: locationReviewStats._avg?.noiseRating ? Math.round(locationReviewStats._avg.noiseRating * 10) / 10 : null,
      avgInternet: locationReviewStats._avg?.internetRating ? Math.round(locationReviewStats._avg.internetRating * 10) / 10 : null,
      avgScenic: locationReviewStats._avg?.scenicRating ? Math.round(locationReviewStats._avg.scenicRating * 10) / 10 : null,
      totalNightsLogged: location.totalNightsLogged || location.visitCount || 0,
      uniqueVisitorCount: location.uniqueVisitorCount || location._count?.checkIns || location._count?.visits || 0,
      wouldStayAgainPct: reviews.length > 0 ? Math.round((reviews.filter((r: any) => r.wouldStayAgain).length / reviews.length) * 100) : null,
    };

    // RV friendliness (for campgrounds)
    const rvFriendliness = type === 'campground' ? {
      isBigRigFriendly: location.isBigRigFriendly,
      maxRigLength: location.maxRvLength,
      hasPullThrough: location.hasPullThrough,
      hasDumpStation: location.hasDumpStation,
      hasPotableWater: location.hasWaterHookup,
      hasElectric: location.hasElectricHookup,
      hasFullHookups: location.hasFullHookups,
      maxAmpService: location.maxAmpService,
      cellSignalStrength: location.cellSignalStrength,
      starlinkScore: location.starlinkScore,
      isPetFriendly: location.isPetFriendly,
      hasWifi: location.hasWifi,
      hasShowers: location.hasShowers,
      hasPool: location.hasPool,
      hasLaundry: location.hasLaundry,
    } : type === 'overnight-stop' ? {
      isRVFriendly: location.isRVFriendly,
      maxRigLength: location.maxRigLength,
      hasShowers: location.hasShowers,
      hasElectric: location.hasElectric,
      hasDump: location.hasDump,
      isWellLit: location.isWellLit,
      isPetFriendly: location.isPetFriendly,
      isTightLot: location.isTightLot,
    } : null;

    // Nearby services (for campgrounds)
    const nearbyServices = type === 'campground' ? {
      distanceToGas: location.distanceToGasMiles,
      distanceToGrocery: location.distanceToGroceryMiles,
      distanceToPropane: location.distanceToPropanemiles,
      distanceToRVRepair: location.distanceToRVRepairMiles,
      distanceToHospital: location.distanceToHospitalMiles,
      distanceToHighway: location.distanceToHighwayMiles,
    } : null;

    // Trust score
    const recentReview = reviews.length > 0 ? new Date(reviews[0].createdAt) > new Date(Date.now() - 30 * 86400000) : false;
    const trustScore = {
      isVerified: location.isVerified || location.verificationStatus === 'VERIFIED',
      recentlyReviewed: recentReview,
      safetyScore: communityStats.avgSafety,
      totalReviews: communityStats.totalReviews,
    };

    res.json({
      location,
      locationType,
      rvFriendliness,
      nearbyServices,
      communityStats,
      recentVisitors: visitorUsers,
      reviews: enrichedReviews,
      tips: enrichedTips,
      activityFeed: enrichedActivity,
      savedCount,
      friendsWhoStayed,
      isSavedByCurrentUser,
      currentUserReview,
      trustScore,
    });
  } catch (e: any) {
    console.error('[LocationDetail] Error:', e);
    res.status(500).json({ error: 'Failed to load location details' });
  }
});

// ─── REVIEWS ────────────────────────────────────────────────

router.get('/:type/:id/reviews', optionalAuth, async (req: any, res: Response) => {
  try {
    const locationType = mapLocationType(req.params.type);
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = parseInt(req.query.skip as string) || 0;

    const reviews = await prisma.locationReview.findMany({
      where: { locationId: req.params.id, locationType },
      orderBy: { helpfulCount: 'desc' },
      take: limit,
      skip,
    });

    const authorIds = [...new Set(reviews.map((r: any) => r.userId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvType: true, rvMake: true },
    });
    const authorMap = new Map(authors.map((a: any) => [a.id, a]));

    const total = await prisma.locationReview.count({ where: { locationId: req.params.id, locationType } });

    res.json({
      reviews: reviews.map((r: any) => ({ ...r, author: authorMap.get(r.userId) || null })),
      total,
      hasMore: skip + reviews.length < total,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

router.post('/:type/:id/reviews', authenticateToken, async (req: any, res: Response) => {
  try {
    const locationType = mapLocationType(req.params.type);
    const { overallRating, cleanlinessRating, safetyRating, noiseRating, internetRating, familyRating, petRating, accessRating, scenicRating, body, photoUrls, videoUrls, tips, wouldStayAgain } = req.body;

    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ error: 'Overall rating (1-5) required' });
    }

    const review = await prisma.locationReview.create({
      data: {
        locationId: req.params.id, locationType, userId: req.userId,
        overallRating, cleanlinessRating, safetyRating, noiseRating, internetRating,
        familyRating, petRating, accessRating, scenicRating,
        body: body || null, photoUrls: photoUrls || [], videoUrls: videoUrls || [],
        tips: tips || [], wouldStayAgain: wouldStayAgain ?? null,
      },
    });

    // Log activity
    await prisma.locationActivityItem.create({
      data: { locationId: req.params.id, locationType, userId: req.userId, activityType: 'REVIEW' },
    }).catch(() => {});

    res.status(201).json(review);
  } catch (e: any) {
    console.error('[Review] Create error:', e);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

router.put('/:type/:id/reviews/:reviewId', authenticateToken, async (req: any, res: Response) => {
  try {
    const review = await prisma.locationReview.findUnique({ where: { id: req.params.reviewId } });
    if (!review || review.userId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const updated = await prisma.locationReview.update({
      where: { id: req.params.reviewId },
      data: {
        overallRating: req.body.overallRating || review.overallRating,
        cleanlinessRating: req.body.cleanlinessRating, safetyRating: req.body.safetyRating,
        noiseRating: req.body.noiseRating, internetRating: req.body.internetRating,
        body: req.body.body ?? review.body, photoUrls: req.body.photoUrls || review.photoUrls,
        tips: req.body.tips || review.tips, wouldStayAgain: req.body.wouldStayAgain ?? review.wouldStayAgain,
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update review' });
  }
});

router.post('/:type/:id/reviews/:reviewId/helpful', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.locationReviewHelpful.findUnique({
      where: { reviewId_userId: { reviewId: req.params.reviewId, userId: req.userId } },
    });
    if (existing) {
      await prisma.locationReviewHelpful.delete({ where: { id: existing.id } });
      await prisma.locationReview.update({ where: { id: req.params.reviewId }, data: { helpfulCount: { decrement: 1 } } });
      res.json({ helpful: false });
    } else {
      await prisma.locationReviewHelpful.create({ data: { reviewId: req.params.reviewId, userId: req.userId } });
      await prisma.locationReview.update({ where: { id: req.params.reviewId }, data: { helpfulCount: { increment: 1 } } });
      res.json({ helpful: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to toggle helpful' });
  }
});

// ─── TIPS ───────────────────────────────────────────────────

router.post('/:type/:id/tips', authenticateToken, async (req: any, res: Response) => {
  try {
    const { content, category } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const tip = await prisma.locationTip.create({
      data: {
        locationId: req.params.id, locationType: mapLocationType(req.params.type),
        userId: req.userId, content, category: category || 'GENERAL',
      },
    });
    res.status(201).json(tip);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to add tip' });
  }
});

router.post('/:type/:id/tips/:tipId/helpful', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.locationTip.update({ where: { id: req.params.tipId }, data: { helpfulCount: { increment: 1 } } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── SAVE TO TRIP ───────────────────────────────────────────

router.post('/:type/:id/save', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.locationSaveToTrip.findUnique({
      where: { locationId_userId: { locationId: req.params.id, userId: req.userId } },
    });
    if (existing) {
      await prisma.locationSaveToTrip.delete({ where: { id: existing.id } });
      res.json({ saved: false });
    } else {
      await prisma.locationSaveToTrip.create({
        data: {
          locationId: req.params.id, locationType: mapLocationType(req.params.type),
          userId: req.userId, tripId: req.body.tripId || null, plannedDate: req.body.plannedDate ? new Date(req.body.plannedDate) : null,
        },
      });

      // Log planned stay activity
      await prisma.locationActivityItem.create({
        data: { locationId: req.params.id, locationType: mapLocationType(req.params.type), userId: req.userId, activityType: 'PLANNED_STAY' },
      }).catch(() => {});

      res.json({ saved: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// ─── ACTIVITY ───────────────────────────────────────────────

router.get('/:type/:id/activity', optionalAuth, async (req: any, res: Response) => {
  try {
    const items = await prisma.locationActivityItem.findMany({
      where: { locationId: req.params.id, locationType: mapLocationType(req.params.type) },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const actorIds = [...new Set(items.map((a: any) => a.userId))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, firstName: true, username: true, profilePicture: true },
    });
    const actorMap = new Map(actors.map((a: any) => [a.id, a]));
    res.json(items.map((a: any) => ({ ...a, actor: actorMap.get(a.userId) || null })));
  } catch (e: any) {
    res.json([]);
  }
});

router.post('/:type/:id/activity', authenticateToken, async (req: any, res: Response) => {
  try {
    const item = await prisma.locationActivityItem.create({
      data: {
        locationId: req.params.id, locationType: mapLocationType(req.params.type),
        userId: req.userId, activityType: req.body.activityType, metadata: req.body.metadata || null,
      },
    });
    res.status(201).json(item);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// ─── REPORT ─────────────────────────────────────────────────

router.post('/:type/:id/report', authenticateToken, async (req: any, res: Response) => {
  console.log(`[LocationReport] ${req.params.type}/${req.params.id} reported by ${req.userId}: ${req.body.reason || 'No reason'}`);
  res.json({ reported: true });
});

export default router;
