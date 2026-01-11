import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/basecamp/feed - Get aggregated activity feed from user and friends
router.get('/feed', authenticateToken, async (req, res) => {
  console.log('===== BASECAMP FEED ROUTE HIT =====');
  try {
    const userId = (req as any).userId;
    console.log('User ID:', userId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { initiatorId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
      select: {
        initiatorId: true,
        receiverId: true,
      },
    });

    // Extract friend IDs
    const friendIds = friendships.map((f) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    // Include self + friends
    const userIds = [userId, ...friendIds];

    // Get followed campground IDs
    const followedCampgrounds = await prisma.campgroundFollow.findMany({
      where: { userId },
      select: { campgroundId: true },
    });
    const followedCampgroundIds = followedCampgrounds.map((f) => f.campgroundId);

    // Get campground IDs from active trips (user is currently staying there)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeTrips = await prisma.stateVisit.findMany({
      where: {
        userId,
        campsiteId: { not: null },
        startDate: { lte: today },
        OR: [
          { endDate: { gte: today } },
          { endDate: null },
        ],
      },
      select: { campsiteId: true },
    });
    const activeTripCampgroundIds = activeTrips
      .map((t) => t.campsiteId)
      .filter((id): id is string => id !== null);

    // Combine followed and active trip campgrounds (deduplicated)
    const campgroundIds = [...new Set([...followedCampgroundIds, ...activeTripCampgroundIds])];

    // Get muted campgrounds and users
    const mutedEntities = await prisma.mutedEntity.findMany({
      where: { userId },
      select: { mutedCampgroundId: true, mutedUserId: true }
    });
    const mutedCampgroundIds = new Set(mutedEntities.filter(m => m.mutedCampgroundId).map(m => m.mutedCampgroundId));
    const mutedUserIds = new Set(mutedEntities.filter(m => m.mutedUserId).map(m => m.mutedUserId));

    // Filter out muted campgrounds
    const unmutedCampgroundIds = campgroundIds.filter(id => !mutedCampgroundIds.has(id));

    // Collect all activities
    const allActivities: any[] = [];

    // 1. Get activities from Activity model (threads, events, recipes, etc.)
    try {
      const activities = await prisma.activity.findMany({
        where: {
          OR: [
            { userId: { in: userIds }, isPublic: true, userId: { notIn: Array.from(mutedUserIds) as string[] } },
            { campgroundId: { in: unmutedCampgroundIds } },
            { targetUserId: userId, campgroundId: { notIn: Array.from(mutedCampgroundIds) as string[] } },
          ],
        },
        take: limit * 2,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          thread: {
            select: { id: true, title: true },
          },
          event: {
            select: { id: true, title: true },
          },
          recipe: {
            select: { id: true, title: true },
          },
          campground: {
            select: { id: true, name: true, location: true, state: true },
          },
          targetUser: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
        },
      });

      activities.forEach((activity) => {
        let targetName = '';
        let targetLink = '';

        if (activity.thread) {
          targetName = activity.thread.title;
          targetLink = `/threads/${activity.thread.id}`;
        } else if (activity.event) {
          targetName = activity.event.title;
          targetLink = `/events/${activity.event.id}`;
        } else if (activity.recipe) {
          targetName = activity.recipe.title;
          targetLink = `/recipes/${activity.recipe.id}`;
        } else if (activity.campground) {
          targetName = activity.campground.name;
          targetLink = `/campgrounds/${activity.campground.id}`;
        } else if (activity.targetUser) {
          targetName = `${activity.targetUser.firstName}'s wall`;
          targetLink = `/profile/${activity.targetUser.username}`;
        } else if (activity.title) {
          targetName = activity.title;
        }

        allActivities.push({
          id: `activity-${activity.id}`,
          type: activity.type,
          actor: activity.user,
          content: activity.content,
          title: activity.title,
          targetName,
          targetLink,
          createdAt: activity.createdAt,
          activityType: activity.type,
          activityIcon: getActivityIcon(activity.type),
          activityLabel: getActivityLabel(activity.type),
          campground: activity.campground,
          imageUrl: (activity as any).imageUrl,
        });
      });
    } catch (error) {
      console.log('Activity model not available');
    }

    // 2. Get posts from friends
    const posts = await prisma.post.findMany({
      where: {
        userId: { in: userIds },
      },
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });

    posts.forEach((post) => {
      allActivities.push({
        id: `post-${post.id}`,
        type: 'POST',
        actor: post.user,
        content: post.content,
        createdAt: post.createdAt,
        activityType: 'POST',
        activityIcon: '📝',
        activityLabel: 'posted',
        imageUrl: post.imageUrl,
      });
    });

    // 3. Get photo uploads from friends
    try {
      const photos = await prisma.photo.findMany({
        where: {
          userId: { in: userIds },
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          album: {
            select: { id: true, title: true },
          },
        },
      });

      photos.forEach((photo) => {
        allActivities.push({
          id: `photo-${photo.id}`,
          type: 'PHOTO_UPLOADED',
          actor: photo.user,
          title: photo.album?.title || 'a photo',
          targetName: photo.album?.title,
          targetLink: photo.album ? `/albums/${photo.album.id}` : undefined,
          createdAt: photo.createdAt,
          activityType: 'PHOTO_UPLOADED',
          activityIcon: '📷',
          activityLabel: 'added a photo to',
          imageUrl: photo.imageUrl,
        });
      });
    } catch (error) {
      console.log('Photo model not available');
    }

    // 4. Get new albums from friends
    try {
      const albums = await prisma.photoAlbum.findMany({
        where: {
          userId: { in: userIds },
          privacy: { in: ['PUBLIC', 'FRIENDS'] },
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          photos: {
            take: 1,
            select: { imageUrl: true },
          },
        },
      });

      albums.forEach((album) => {
        allActivities.push({
          id: `album-${album.id}`,
          type: 'ALBUM_CREATED',
          actor: album.user,
          title: album.title,
          targetName: album.title,
          targetLink: `/albums/${album.id}`,
          createdAt: album.createdAt,
          activityType: 'ALBUM_CREATED',
          activityIcon: '📁',
          activityLabel: 'created an album',
          imageUrl: album.photos[0]?.imageUrl,
        });
      });
    } catch (error) {
      console.log('PhotoAlbum model not available');
    }

    // 5. Get trip plans from friends
    try {
      const trips = await prisma.tripPlan.findMany({
        where: {
          userId: { in: userIds },
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
        },
      });

      trips.forEach((trip) => {
        allActivities.push({
          id: `trip-${trip.id}`,
          type: 'TRIP_PLANNED',
          actor: trip.user,
          title: trip.name,
          targetName: trip.name,
          targetLink: `/trips/${trip.id}`,
          createdAt: trip.createdAt,
          activityType: 'TRIP_PLANNED',
          activityIcon: '🗺️',
          activityLabel: 'planned a trip',
        });
      });
    } catch (error) {
      console.log('TripPlan model not available');
    }

    // 6. Get packing activities from BasecampActivity
    console.log('Fetching packing activities for userId:', userId);
    try {
      const packingActivities = await prisma.basecampActivity.findMany({
        where: {
          userId,
          type: {
            in: [
              'FRIEND_REQUEST',
              'NEW_CAMPING_BUDDY',
              'PACK_ITEM_ASSIGNED',
              'PACK_ITEM_ASSIGNMENT_REQUEST',
              'PACK_ITEM_CONFIRMED',
              'PACK_ITEM_DECLINED',
              'PACK_ITEM_NEEDS_VOLUNTEER',
              'PACK_ITEM_VOLUNTEERED',
              'PACK_ITEM_VOLUNTEER_DECLINED',
              'PACK_ITEM_PACKED',
              'PACK_LIST_COMPLETE',
              'CREATOR_VIDEO_UPLOAD',
              'SHARED_CREATOR_VIDEO'
            ]
          }
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
        },
      });

      console.log('Found packing activities:', packingActivities.length);
      packingActivities.forEach((activity) => {
        const meta = activity.metadata as any || {};
        const itemName = meta.itemName || 'an item';
        
        let activityLabel = 'packing activity';
        let activityIcon = '📦';
        
        switch (activity.type) {
          case 'FRIEND_REQUEST':
            activityLabel = `${activity.actor?.firstName || 'Someone'} wants to be your camping buddy!`;
            activityIcon = '👋';
            break;
          case 'NEW_CAMPING_BUDDY':
            activityLabel = `You and ${activity.actor?.firstName || 'someone'} are now camping buddies!`;
            activityIcon = '🏕️';
            break;
          case 'PACK_ITEM_ASSIGNMENT_REQUEST':
            activityLabel = `You have been assigned a packing item "${itemName}" by ${activity.actor?.firstName || 'someone'}`;
            activityIcon = '📋';
            break;
          case 'PACK_ITEM_CONFIRMED':
            activityLabel = `${meta.confirmedBy || activity.actor?.firstName || 'Someone'} will bring "${itemName}"`;
            activityIcon = '✅';
            break;
          case 'PACK_ITEM_DECLINED':
            activityLabel = `${meta.declinedBy || activity.actor?.firstName || 'Someone'} can't bring "${itemName}" - needs volunteer!`;
            activityIcon = '❌';
            break;
          case 'PACK_ITEM_NEEDS_VOLUNTEER':
            activityLabel = `"${itemName}" was added to the pack list - you have this in your inventory! Can you bring it?`;
            activityIcon = '🎒';
            break;
          case 'PACK_ITEM_VOLUNTEERED':
            activityLabel = `${meta.volunteerName || activity.actor?.firstName || 'Someone'} volunteered to bring "${itemName}"`;
            activityIcon = '🙋';
            break;
          case 'PACK_ITEM_ASSIGNED':
            activityLabel = `You were assigned "${itemName}"`;
            activityIcon = '📋';
            break;
          case 'PACK_ITEM_PACKED':
            activityLabel = `"${itemName}" was marked as packed`;
            activityIcon = '✓';
            break;
          case 'PACK_LIST_COMPLETE':
            activityLabel = `🎉 Packing complete for ${activity.entityName}!`;
            activityIcon = '🎉';
            break;
          case 'CREATOR_VIDEO_UPLOAD':
            activityLabel = `${activity.actor?.firstName || 'Someone'} uploaded a new video: "${activity.entityName}" - Go check it out! 🎬`;
            activityIcon = '🎬';
            break;
          case 'SHARED_CREATOR_VIDEO':
            const shareMeta = activity.metadata as any;
            activityLabel = `${activity.actor?.firstName || 'Someone'} shared a video: "${activity.entityName}" by ${shareMeta?.originalCreatorName || 'a creator'} 🎬`;
            activityIcon = '🔄';
            break;
            activityIcon = '🎬';
            break;
        }

        allActivities.push({
          id: `packing-${activity.id}`,
          type: activity.type,
          actor: activity.actor,
          content: activityLabel,
          title: activity.entityName,
          targetName: activity.entityName,
          targetLink: activity.entityType === 'EVENT' ? `/events/${activity.entityId}` : (activity.type === 'FRIEND_REQUEST' ? `/profile/${activity.actor?.username}` : ((activity.type === 'CREATOR_VIDEO_UPLOAD' || activity.type === 'SHARED_CREATOR_VIDEO') ? `/creators/${(activity.metadata as any)?.creatorUsername || (activity.metadata as any)?.originalCreatorUsername || activity.actor?.username}/content/${activity.entityId}` : undefined)),
          createdAt: activity.createdAt,
          activityType: activity.type,
          activityIcon,
          activityLabel,
          isPackingActivity: activity.type !== 'FRIEND_REQUEST' && activity.type !== 'NEW_CAMPING_BUDDY',
          isFriendRequest: activity.type === 'FRIEND_REQUEST',
          isCampingBuddy: activity.type === 'NEW_CAMPING_BUDDY',
          packItemId: meta.packItemId,
          friendshipId: meta.friendshipId,
          metadata: meta,
          canRespond: (activity.type === 'PACK_ITEM_ASSIGNMENT_REQUEST' || activity.type === 'PACK_ITEM_NEEDS_VOLUNTEER' || activity.type === 'FRIEND_REQUEST') && activity.userId === userId,
          isRead: activity.isRead,
        });
      });
    } catch (error) {
      console.log('BasecampActivity model error:', error);
    }

    // Sort all activities by date
    allActivities.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Paginate
    const paginatedActivities = allActivities.slice(0, limit);
    const hasMore = allActivities.length > limit;

    res.json({
      feedItems: paginatedActivities,
      hasMore,
      page,
    });
  } catch (error) {
    console.error('Get basecamp feed error:', error);
    res.status(500).json({ error: 'Failed to get basecamp feed' });
  }
});

// Helper functions
function getActivityIcon(type: string): string {
  const icons: Record<string, string> = {
    THREAD_CREATED: '💬',
    THREAD_POST: '💭',
    EVENT_CREATED: '📅',
    EVENT_JOINED: '✅',
    RECIPE_CREATED: '🍳',
    MEAL_PLAN_CREATED: '🍽️',
    PROFILE_UPDATE: '✏️',
    STATUS_UPDATE: '💭',
    WALL_POST: '📝',
    CHECK_IN: '📍',
    CAMPGROUND_REVIEW: '⭐',
    PHOTO_UPLOADED: '📷',
    FRIEND_ADDED: '🤝',
    GEAR_ADDED: '🎒',
    TRIP_PLANNED: '🗺️',
    TRIP_SAVED: '❤️',
    ALBUM_CREATED: '📁',
    CAMPGROUND_UPDATE: '🏕️',
    POST: '📝',
  };
  return icons[type] || '📌';
}

function getActivityLabel(type: string): string {
  const labels: Record<string, string> = {
    THREAD_CREATED: 'started a discussion',
    THREAD_POST: 'replied to a discussion',
    EVENT_CREATED: 'created an event',
    EVENT_JOINED: 'is attending',
    RECIPE_CREATED: 'shared a recipe',
    MEAL_PLAN_CREATED: 'planned a meal',
    PROFILE_UPDATE: 'updated their profile',
    STATUS_UPDATE: 'updated their status',
    WALL_POST: 'posted on',
    CHECK_IN: 'checked in at',
    CAMPGROUND_REVIEW: 'reviewed',
    PHOTO_UPLOADED: 'added a photo',
    FRIEND_ADDED: 'became friends with',
    GEAR_ADDED: 'added gear',
    TRIP_PLANNED: 'planned a trip',
    TRIP_SAVED: 'saved a trip',
    ALBUM_CREATED: 'created an album',
    CAMPGROUND_UPDATE: 'update from',
    CAMPGROUND_ANNOUNCEMENT: 'announced',
    POST: 'posted',   
  };
  return labels[type] || 'did something';
}

// GET /api/trips/upcoming - Get user's next upcoming trip
router.get('/trips/upcoming', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    const upcomingTrips = await prisma.tripPlan.findMany({
      where: {
        userId,
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: 'asc' },
      take: 1,
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    res.json(upcomingTrips);
  } catch (error) {
    console.error('Get upcoming trips error:', error);
    res.json([]);
  }
});



export default router;
