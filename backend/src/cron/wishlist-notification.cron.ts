import cron from 'node-cron';
import { prisma } from '../prisma';

export function registerWishlistNotificationCron() {
  // Daily at 8 AM Central (13:00 UTC)
  cron.schedule('0 13 * * *', async () => {
    console.log('[WishlistNotif] Running daily wishlist notification check...');
    try {
      await checkWishlistNotifications();
    } catch (err: any) {
      console.error('[WishlistNotif] Cron error:', err.message);
    }
  });
}

async function checkWishlistNotifications() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get all wishlisted campgrounds with their users
  const wishlists = await (prisma as any).campgroundWishlist.findMany({
    select: {
      id: true,
      userId: true,
      campgroundId: true,
    },
  });

  if (wishlists.length === 0) return;

  // Group wishlists by campgroundId for efficient batch queries
  const campgroundIds = [...new Set(wishlists.map((w: any) => w.campgroundId))] as string[];
  const userIds = [...new Set(wishlists.map((w: any) => w.userId))] as string[];

  // Get notification prefs for all users with wishlists
  const prefs = await (prisma as any).campgroundWishlistNotificationPref.findMany({
    where: { userId: { in: userIds } },
  });
  const prefMap: Record<string, any> = {};
  for (const pref of prefs) {
    prefMap[`${pref.userId}:${pref.campgroundId}`] = pref;
  }

  // Batch: find new reviews in last 24h for wishlisted campgrounds
  const newReviews = await (prisma as any).locationReview.findMany({
    where: {
      locationId: { in: campgroundIds },
      locationType: 'CAMPGROUND',
      createdAt: { gte: yesterday },
    },
    select: { locationId: true, userId: true, overallRating: true },
  });
  const reviewsByCampground: Record<string, any[]> = {};
  for (const r of newReviews) {
    if (!reviewsByCampground[r.locationId]) reviewsByCampground[r.locationId] = [];
    reviewsByCampground[r.locationId].push(r);
  }

  // Batch: find friend visits in last 24h (RigCampsiteVisit or check-ins)
  const recentVisits = await (prisma as any).rigCampsiteVisit.findMany({
    where: {
      campgroundId: { in: campgroundIds },
      createdAt: { gte: yesterday },
      isPrivate: false,
    },
    select: {
      campgroundId: true,
      userId: true,
      user: { select: { id: true, username: true, firstName: true } },
    },
  });
  const visitsByCampground: Record<string, any[]> = {};
  for (const v of recentVisits) {
    if (!visitsByCampground[v.campgroundId]) visitsByCampground[v.campgroundId] = [];
    visitsByCampground[v.campgroundId].push(v);
  }

  // Get follow relationships for all wishlist users (to determine "friends")
  const followRelations = await (prisma as any).creatorFollow.findMany({
    where: { followerId: { in: userIds } },
    select: { followerId: true, creatorId: true },
  });
  const followMap: Record<string, Set<string>> = {};
  for (const f of followRelations) {
    if (!followMap[f.followerId]) followMap[f.followerId] = new Set();
    followMap[f.followerId].add(f.creatorId);
  }

  // Get campground names for digest items
  const campgrounds = await (prisma as any).campground.findMany({
    where: { id: { in: campgroundIds } },
    select: { id: true, name: true },
  });
  const campgroundNameMap: Record<string, string> = {};
  for (const c of campgrounds) campgroundNameMap[c.id] = c.name;

  let digestItemsCreated = 0;
  let feedActivitiesCreated = 0;

  // Process each wishlist entry
  for (const wishlist of wishlists) {
    const key = `${wishlist.userId}:${wishlist.campgroundId}`;
    const pref = prefMap[key] || { notifyNewReviews: true, notifyFriendVisit: true };
    const campName = campgroundNameMap[wishlist.campgroundId] || 'A campground';
    const userFollows = followMap[wishlist.userId] || new Set();

    // Check for new reviews
    const campReviews = reviewsByCampground[wishlist.campgroundId] || [];
    if (pref.notifyNewReviews && campReviews.length > 0) {
      try {
        await (prisma as any).emailDigestQueue.create({
          data: {
            userId: wishlist.userId,
            digestType: 'DAILY',
            contentType: 'WISHLIST_NEW_REVIEWS',
            contentData: {
              campgroundId: wishlist.campgroundId,
              campgroundName: campName,
              reviewCount: campReviews.length,
            },
          },
        });
        digestItemsCreated++;
      } catch {}
    }

    // Check for friend visits
    const campVisits = visitsByCampground[wishlist.campgroundId] || [];
    const friendVisits = campVisits.filter((v: any) => userFollows.has(v.userId));

    if (pref.notifyFriendVisit && friendVisits.length > 0) {
      for (const visit of friendVisits) {
        // Create in-app FeedActivity (instant, no email)
        try {
          await (prisma as any).feedActivity.create({
            data: {
              actorId: visit.userId,
              targetUserId: wishlist.userId,
              activityType: 'WISHLIST_FRIEND_VISIT',
              postId: null,
              isRead: false,
            },
          });
          feedActivitiesCreated++;
        } catch {}

        // Queue digest item for daily email
        try {
          await (prisma as any).emailDigestQueue.create({
            data: {
              userId: wishlist.userId,
              digestType: 'DAILY',
              contentType: 'WISHLIST_FRIEND_VISIT',
              contentData: {
                campgroundId: wishlist.campgroundId,
                campgroundName: campName,
                friendUsername: visit.user?.username,
                friendFirstName: visit.user?.firstName,
              },
            },
          });
          digestItemsCreated++;
        } catch {}
      }
    }
  }

  console.log(`[WishlistNotif] Done. ${digestItemsCreated} digest items, ${feedActivitiesCreated} feed activities created.`);
}
