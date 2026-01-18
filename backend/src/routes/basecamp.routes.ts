import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Activity config
const ACTIVITY_CONFIG: Record<string, { icon: string; label: string; color?: string }> = {
  POST_CREATED: { icon: '📝', label: 'posted' },
  THREAD_CREATED: { icon: '💬', label: 'started a discussion' },
  THREAD_POST: { icon: '💭', label: 'replied to' },
  THREAD_REPLY: { icon: '💬', label: 'replied to your thread', color: 'text-blue-600' },
  THREAD_COMMENT: { icon: '💬', label: 'commented on', color: 'text-blue-600' },
  THREAD_MENTION: { icon: '📣', label: 'mentioned you in', color: 'text-purple-600' },
  NEW_CAMPGROUND_THREAD: { icon: '🏕️', label: 'started a discussion about', color: 'text-green-600' },
  PROFILE_UPDATED: { icon: '✏️', label: 'updated their profile' },
  STATUS_UPDATE: { icon: '💭', label: 'updated their status' },
  POST: { icon: '📝', label: 'posted' },
  EVENT_CREATED: { icon: '📅', label: 'created an event', color: 'text-blue-600' },
  EVENT_JOINED: { icon: '✅', label: 'is going to', color: 'text-green-600' },
  EVENT_UPDATED: { icon: '📝', label: 'updated the event' },
  TRIP_CREATED: { icon: '🗺️', label: 'created a trip' },
  TRIP_JOINED: { icon: '🎒', label: 'joined a trip' },
  TRIP_PLANNED: { icon: '🗺️', label: 'is planning a trip to', color: 'text-indigo-600' },
  TRIP_SAVED: { icon: '❤️', label: 'saved a trip' },
  RECIPE_CREATED: { icon: '🍳', label: 'shared a new recipe', color: 'text-orange-600' },
  RECIPE_SHARED: { icon: '🍳', label: 'shared a recipe' },
  RECIPE_LIKED: { icon: '❤️', label: 'liked', color: 'text-red-500' },
  RECIPE_COMMENTED: { icon: '💬', label: 'commented on' },
  MEAL_PLAN_CREATED: { icon: '🍽️', label: 'planned a meal' },
  PHOTO_UPLOADED: { icon: '📷', label: 'added photos to', color: 'text-purple-600' },
  PHOTO_LIKED: { icon: '❤️', label: 'liked a photo in', color: 'text-red-500' },
  PHOTO_COMMENTED: { icon: '💬', label: 'commented on a photo in' },
  ALBUM_CREATED: { icon: '📁', label: 'created a new album', color: 'text-indigo-600' },
  ALBUM_LIKED: { icon: '❤️', label: 'liked the album', color: 'text-red-500' },
  FRIEND_ADDED: { icon: '🤝', label: 'became camping buddies with', color: 'text-green-600' },
  MUTUAL_FRIEND_ADDED: { icon: '👥', label: 'is now friends with' },
  WALL_POST: { icon: '📝', label: 'posted on' },
  WALL_COMMENT: { icon: '💬', label: 'commented on', color: 'text-blue-600' },
  GROUP_JOINED: { icon: '👥', label: 'joined the group' },
  GROUP_CREATED: { icon: '🏕️', label: 'created a new group' },
  CHECK_IN: { icon: '📍', label: 'checked in at', color: 'text-green-600' },
  CAMPGROUND_REVIEW: { icon: '⭐', label: 'reviewed' },
  CAMPGROUND_FOLLOWED: { icon: '🏕️', label: 'started following', color: 'text-teal-600' },
  CAMPGROUND_UPDATE: { icon: '🏕️', label: 'update from' },
  CAMPGROUND_ANNOUNCEMENT: { icon: '📢', label: 'announced', color: 'text-amber-600' },
  GEAR_ADDED: { icon: '🎒', label: 'added new gear', color: 'text-amber-600' },
  GEAR_REVIEW: { icon: '⭐', label: 'reviewed' },
  RV_SHOWCASE_UPDATED: { icon: '🚐', label: 'updated their RV showcase' },
  RV_UPDATED: { icon: '🚐', label: 'updated their RV profile' },
  STICKER_EARNED: { icon: '🏆', label: 'earned a sticker' },
  BADGE_EARNED: { icon: '🏅', label: 'earned the badge', color: 'text-yellow-600' },
  STATE_VISITED: { icon: '🗺️', label: 'visited' },
  ATTRACTION_ADDED: { icon: '🎢', label: 'added an attraction' },
};

function getActivityIcon(type: string): string {
  return ACTIVITY_CONFIG[type]?.icon || '📌';
}

function getActivityLabel(type: string): string {
  return ACTIVITY_CONFIG[type]?.label || 'did something';
}

function getActivityColor(type: string): string {
  return ACTIVITY_CONFIG[type]?.color || 'text-gray-600';
}

// GET /api/basecamp/feed
router.get('/feed', authenticateToken, async (req, res) => {
  console.log('===== BASECAMP FEED ROUTE HIT =====');
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { initiatorId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
      select: { initiatorId: true, receiverId: true },
    });

    const friendIds = friendships.map((f) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );
    const userIds = [userId, ...friendIds];
    const friendIdSet = new Set(friendIds);

    // Get followed campgrounds
    const followedCampgrounds = await prisma.campgroundFollow.findMany({
      where: { userId },
      select: { campgroundId: true },
    });
    const followedCampgroundIds = followedCampgrounds.map((f) => f.campgroundId);

    // Get active trip campgrounds
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeTrips = await prisma.stateVisit.findMany({
      where: {
        userId,
        campsiteId: { not: null },
        startDate: { lte: today },
        OR: [{ endDate: { gte: today } }, { endDate: null }],
      },
      select: { campsiteId: true },
    });
    const activeTripCampgroundIds = activeTrips
      .map((t) => t.campsiteId)
      .filter((id): id is string => id !== null);

    const campgroundIds = [...new Set([...followedCampgroundIds, ...activeTripCampgroundIds])];

    // Get muted entities
    const now = new Date();
    const mutedEntities = await prisma.mutedEntity.findMany({
      where: {
        userId,
        OR: [
          { snoozeUntil: null },
          { snoozeUntil: { gt: now } }
        ]
      },
      select: { mutedCampgroundId: true, mutedUserId: true, mutedEventId: true, mutedActivityId: true }
    });
    const mutedCampgroundIds = new Set(mutedEntities.filter(m => m.mutedCampgroundId).map(m => m.mutedCampgroundId));
    const mutedUserIds = new Set(mutedEntities.filter(m => m.mutedUserId).map(m => m.mutedUserId));
    const mutedEventIds = new Set(mutedEntities.filter(m => m.mutedEventId).map(m => m.mutedEventId));
    const mutedActivityIds = new Set(mutedEntities.filter(m => m.mutedActivityId).map(m => m.mutedActivityId));

    const unmutedCampgroundIds = campgroundIds.filter(id => !mutedCampgroundIds.has(id));
    const unmutedFriendIds = friendIds.filter(id => !mutedUserIds.has(id));
    const unmutedUserIds = [userId, ...unmutedFriendIds];

    // Get blocked users
    let blockedUserIds = new Set<string>();
    try {
      const blockedRelations = await prisma.blockedUser.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true }
      });
      blockedUserIds = new Set(
        blockedRelations.map(b => b.blockerId === userId ? b.blockedId : b.blockerId)
      );
    } catch (e) {
      console.log('BlockedUser model not available');
    }

    const visibleUserIds = unmutedUserIds.filter(id => !blockedUserIds.has(id));

    const allActivities: any[] = [];

    // 1. Activities from Activity model
    try {
      const activities = await prisma.activity.findMany({
        where: {
          OR: [
            { privacy: "PUBLIC", organizerId: { in: visibleUserIds } },
            { privacy: "FRIENDS", organizerId: { in: visibleUserIds } },
            { privacy: "PRIVATE", organizerId: userId },
          ],
          AND: [
            { isCreatorContent: { not: true } },
            {
              OR: [
                { userId: { in: visibleUserIds }, isPublic: true },
                { campgroundId: { in: unmutedCampgroundIds } },
                { targetUserId: userId },
              ],
            },
          ],
        },
        take: limit * 3,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
          thread: { select: { id: true, title: true } },
          event: { select: { id: true, title: true } },
          recipe: { select: { id: true, title: true } },
          campground: { select: { id: true, name: true, location: true, state: true } },
          targetUser: { select: { id: true, firstName: true, lastName: true, username: true } },
          secondaryUser: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
      });

      activities.forEach((activity) => {
        if (blockedUserIds.has(activity.userId)) return;
        
        let targetName = '';
        let targetLink = '';
        let secondaryUserInfo = null;

        if (activity.thread) {
          targetName = activity.thread.title;
          targetLink = '/threads/' + activity.thread.id;
        } else if (activity.event) {
          targetName = activity.event.title;
          targetLink = '/events/' + activity.event.id;
        } else if (activity.recipe) {
          targetName = activity.recipe.title;
          targetLink = '/recipes/' + activity.recipe.id;
        } else if (activity.campground) {
          targetName = activity.campground.name;
          targetLink = '/campgrounds/' + activity.campground.id;
        } else if (activity.targetUser) {
          targetName = activity.targetUser.firstName + "'s wall";
          targetLink = '/profile/' + activity.targetUser.username;
        } else if (activity.title) {
          targetName = activity.title;
        }

        // Handle mutual friend interactions
        if (activity.type === 'WALL_COMMENT' && activity.targetUser) {
          const isMutualFriend = friendIdSet.has(activity.targetUserId || '');
          if (isMutualFriend) {
            secondaryUserInfo = {
              id: activity.targetUser.id,
              firstName: activity.targetUser.firstName,
              lastName: activity.targetUser.lastName,
              username: activity.targetUser.username,
              profileLink: '/profile/' + activity.targetUser.username,
            };
          }
        }

        // Handle likes on friend content
        if (['RECIPE_LIKED', 'PHOTO_LIKED', 'ALBUM_LIKED'].includes(activity.type) && activity.targetUser) {
          const isMutualFriend = friendIdSet.has(activity.targetUserId || '');
          if (isMutualFriend) {
            secondaryUserInfo = {
              id: activity.targetUser.id,
              firstName: activity.targetUser.firstName,
              lastName: activity.targetUser.lastName,
              username: activity.targetUser.username,
              profileLink: '/profile/' + activity.targetUser.username,
            };
          }
        }

        allActivities.push({
          id: 'activity-' + activity.id,
          type: activity.type,
          actor: activity.user,
          content: activity.content,
          title: activity.title,
          targetName,
          targetLink,
          targetUser: activity.targetUser,
          secondaryUser: secondaryUserInfo,
          createdAt: activity.createdAt,
          activityType: activity.type,
          activityIcon: getActivityIcon(activity.type),
          activityLabel: getActivityLabel(activity.type),
          activityColor: getActivityColor(activity.type),
          campground: activity.campground,
          imageUrl: (activity as any).imageUrl,
          isFriendActivity: friendIdSet.has(activity.userId),
          hasMutualFriendInteraction: !!secondaryUserInfo,
        });
      });
    } catch (error) {
      console.log('Activity model error:', error);
    }

    // 2. Posts from friends
    const posts = await prisma.post.findMany({
      where: { userId: { in: visibleUserIds } },
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
    });

    posts.forEach((post) => {
      if (blockedUserIds.has(post.userId)) return;
      allActivities.push({
        id: 'post-' + post.id,
        type: 'POST',
        actor: post.user,
        content: post.content,
        createdAt: post.createdAt,
        activityType: 'POST',
        activityIcon: '📝',
        activityLabel: 'posted',
        imageUrl: post.imageUrl,
        isFriendActivity: friendIdSet.has(post.userId),
      });
    });

    // 3. Photos from friends
    try {
      const photos = await prisma.photo.findMany({
        where: {
          OR: [
            { privacy: "PUBLIC", organizerId: { in: visibleUserIds } },
            { privacy: "FRIENDS", organizerId: { in: visibleUserIds } },
            { privacy: "PRIVATE", organizerId: userId },
          ],
          userId: { in: visibleUserIds },
          album: { privacy: { in: ['PUBLIC', 'FRIENDS'] } }
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          album: { select: { id: true, title: true, privacy: true } },
        },
      });

      photos.forEach((photo) => {
        if (blockedUserIds.has(photo.userId)) return;
        allActivities.push({
          id: 'photo-' + photo.id,
          type: 'PHOTO_UPLOADED',
          actor: photo.user,
          title: photo.album?.title || 'a photo',
          targetName: photo.album?.title,
          targetLink: photo.album ? '/albums/' + photo.album.id : undefined,
          createdAt: photo.createdAt,
          activityType: 'PHOTO_UPLOADED',
          activityIcon: '📷',
          activityLabel: 'added a photo to',
          activityColor: 'text-purple-600',
          imageUrl: photo.imageUrl,
          isFriendActivity: friendIdSet.has(photo.userId),
        });
      });
    } catch (error) {
      console.log('Photo model not available');
    }

    // 4. Albums from friends
    try {
      const albums = await prisma.photoAlbum.findMany({
        where: {
          OR: [
            { privacy: "PUBLIC", organizerId: { in: visibleUserIds } },
            { privacy: "FRIENDS", organizerId: { in: visibleUserIds } },
            { privacy: "PRIVATE", organizerId: userId },
          ],
          userId: { in: visibleUserIds },
          privacy: { in: ['PUBLIC', 'FRIENDS'] },
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          photos: { take: 1, select: { imageUrl: true } },
        },
      });

      albums.forEach((album) => {
        if (blockedUserIds.has(album.userId)) return;
        allActivities.push({
          id: 'album-' + album.id,
          type: 'ALBUM_CREATED',
          actor: album.user,
          title: album.title,
          targetName: album.title,
          targetLink: '/albums/' + album.id,
          createdAt: album.createdAt,
          activityType: 'ALBUM_CREATED',
          activityIcon: '📁',
          activityLabel: 'created a new album',
          activityColor: 'text-indigo-600',
          imageUrl: album.photos[0]?.imageUrl,
          isFriendActivity: friendIdSet.has(album.userId),
        });
      });
    } catch (error) {
      console.log('PhotoAlbum model not available');
    }

    // 5. Trips from friends
    try {
      const trips = await prisma.tripPlan.findMany({
        where: { userId: { in: visibleUserIds } },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        },
      });

      trips.forEach((trip) => {
        if (blockedUserIds.has(trip.userId)) return;
        allActivities.push({
          id: 'trip-' + trip.id,
          type: 'TRIP_PLANNED',
          actor: trip.user,
          title: trip.name,
          targetName: trip.name,
          targetLink: '/trips/' + trip.id,
          createdAt: trip.createdAt,
          activityType: 'TRIP_PLANNED',
          activityIcon: '🗺️',
          activityLabel: 'is planning a trip',
          activityColor: 'text-indigo-600',
          isFriendActivity: friendIdSet.has(trip.userId),
        });
      });
    } catch (error) {
      console.log('TripPlan model not available');
    }

    // 6. Events from friends
    try {
      const events = await prisma.event.findMany({
        where: {
          OR: [
            { privacy: "PUBLIC", organizerId: { in: visibleUserIds } },
            { privacy: "FRIENDS", organizerId: { in: visibleUserIds } },
            { privacy: "PRIVATE", organizerId: userId },
          ],
          
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          organizer: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        },
      });

      events.forEach((event) => {
        if (blockedUserIds.has(event.organizerId)) return;
        if (mutedEventIds.has(event.id)) return;
        allActivities.push({
          id: 'event-created-' + event.id,
          type: 'EVENT_CREATED',
          actor: event.organizer,
          title: event.title,
          targetName: event.title,
          targetLink: '/events/' + event.id,
          createdAt: event.createdAt,
          activityType: 'EVENT_CREATED',
          activityIcon: '📅',
          activityLabel: 'created an event',
          activityColor: 'text-blue-600',
          isFriendActivity: friendIdSet.has(event.organizerId),
        });
      });
    } catch (error) {
      console.log('Event model error:', error);
    }

    // 7. Recipes from friends
    try {
      const recipes = await prisma.recipe.findMany({
        where: {
          OR: [
            { privacy: "PUBLIC", organizerId: { in: visibleUserIds } },
            { privacy: "FRIENDS", organizerId: { in: visibleUserIds } },
            { privacy: "PRIVATE", organizerId: userId },
          ],
          userId: { in: visibleUserIds },
          privacy: { in: ['PUBLIC', 'FRIENDS'] },
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        },
      });

      recipes.forEach((recipe) => {
        if (blockedUserIds.has(recipe.userId)) return;
        allActivities.push({
          id: 'recipe-created-' + recipe.id,
          type: 'RECIPE_CREATED',
          actor: recipe.user,
          title: recipe.title,
          targetName: recipe.title,
          targetLink: '/recipes/' + recipe.id,
          createdAt: recipe.createdAt,
          activityType: 'RECIPE_CREATED',
          activityIcon: '🍳',
          activityLabel: 'shared a new recipe',
          activityColor: 'text-orange-600',
          imageUrl: recipe.imageUrl,
          isFriendActivity: friendIdSet.has(recipe.userId),
        });
      });
    } catch (error) {
      console.log('Recipe model error:', error);
    }

    // 8. Packing & notification activities
    try {
      const packingActivities = await prisma.basecampActivity.findMany({
        where: {
          userId,
          type: {
            in: [
              'FRIEND_REQUEST', 'NEW_CAMPING_BUDDY', 'PACK_ITEM_ASSIGNED',
              'PACK_ITEM_ASSIGNMENT_REQUEST', 'PACK_ITEM_CONFIRMED', 'PACK_ITEM_DECLINED',
              'PACK_ITEM_NEEDS_VOLUNTEER', 'PACK_ITEM_VOLUNTEERED', 'PACK_ITEM_VOLUNTEER_DECLINED',
              'PACK_ITEM_PACKED', 'PACK_LIST_COMPLETE', 'CREATOR_VIDEO_UPLOAD', 'SHARED_CREATOR_VIDEO', 
              'MEAL_ASSIGNMENT_REQUEST', 'MEAL_ASSIGNMENT_RESPONSE',
              'THREAD_REPLY', 'THREAD_COMMENT', 'THREAD_MENTION', 'NEW_CAMPGROUND_THREAD'
            ]
          }
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        },
      });

      packingActivities.forEach((activity) => {
        const meta = activity.metadata as any || {};
        const itemName = meta.itemName || 'an item';
        
        let activityLabel = 'packing activity';
        let activityIcon = '📦';
        
        switch (activity.type) {
          case 'FRIEND_REQUEST':
            activityLabel = (activity.actor?.firstName || 'Someone') + ' wants to be your camping buddy!';
            activityIcon = '👋';
            break;
          case 'NEW_CAMPING_BUDDY':
            activityLabel = 'You and ' + (activity.actor?.firstName || 'someone') + ' are now camping buddies!';
            activityIcon = '🏕️';
            break;
          case 'PACK_ITEM_ASSIGNMENT_REQUEST':
            activityLabel = 'You have been assigned "' + itemName + '" by ' + (activity.actor?.firstName || 'someone');
            activityIcon = '📋';
            break;
          case 'PACK_ITEM_CONFIRMED':
            activityLabel = (meta.confirmedBy || activity.actor?.firstName || 'Someone') + ' will bring "' + itemName + '"';
            activityIcon = '✅';
            break;
          case 'PACK_ITEM_DECLINED':
            activityLabel = (meta.declinedBy || activity.actor?.firstName || 'Someone') + " can't bring \"" + itemName + '" - needs volunteer!';
            activityIcon = '❌';
            break;
          case 'PACK_ITEM_NEEDS_VOLUNTEER':
            activityLabel = '"' + itemName + '" needs a volunteer - you have this in your inventory!';
            activityIcon = '🎒';
            break;
          case 'PACK_ITEM_VOLUNTEERED':
            activityLabel = (meta.volunteerName || activity.actor?.firstName || 'Someone') + ' volunteered to bring "' + itemName + '"';
            activityIcon = '🙋';
            break;
          case 'PACK_ITEM_ASSIGNED':
            activityLabel = 'You were assigned "' + itemName + '"';
            activityIcon = '📋';
            break;
          case 'PACK_ITEM_PACKED':
            activityLabel = '"' + itemName + '" was marked as packed';
            activityIcon = '✓';
            break;
          case 'PACK_LIST_COMPLETE':
            activityLabel = '🎉 Packing complete for ' + activity.entityName + '!';
            activityIcon = '🎉';
            break;
          case 'CREATOR_VIDEO_UPLOAD':
            activityLabel = (activity.actor?.firstName || 'Someone') + ' uploaded a new video: "' + activity.entityName + '"';
            activityIcon = '🎬';
            break;
          case 'SHARED_CREATOR_VIDEO':
            const shareMeta = activity.metadata as any;
            activityLabel = (activity.actor?.firstName || 'Someone') + ' shared: "' + activity.entityName + '" by ' + (shareMeta?.originalCreatorName || 'a creator');
            activityIcon = '🔄';
            break;
          case 'MEAL_ASSIGNMENT_REQUEST':
            const mealMeta = meta;
            activityLabel = (activity.actor?.firstName || 'Someone') + ' asked you to prepare "' + (mealMeta.recipeTitle || 'a meal') + '" for ' + (mealMeta.eventTitle || 'an event');
            activityIcon = '👨‍🍳';
            break;
          case 'MEAL_ASSIGNMENT_RESPONSE':
            const responseMeta = meta;
            activityLabel = (activity.actor?.firstName || 'Someone') + ' ' + (responseMeta.status || 'responded to') + ' cooking "' + (responseMeta.recipeTitle || 'a meal') + '"';
            activityIcon = responseMeta.status === 'ACCEPTED' ? '✅' : responseMeta.status === 'DECLINED' ? '❌' : '🤔';
            break;
          case 'THREAD_REPLY':
            activityLabel = (activity.actor?.firstName || 'Someone') + ' replied to your thread "' + (activity.entityName || meta.threadTitle || 'a thread') + '"';
            activityIcon = '💬';
            break;
          case 'THREAD_COMMENT':
            activityLabel = (activity.actor?.firstName || 'Someone') + ' commented on "' + (activity.entityName || meta.threadTitle || 'a thread') + '"';
            activityIcon = '💬';
            break;
          case 'THREAD_MENTION':
            activityLabel = (activity.actor?.firstName || 'Someone') + ' mentioned you in "' + (activity.entityName || meta.threadTitle || 'a thread') + '"';
            activityIcon = '📣';
            break;
          case 'NEW_CAMPGROUND_THREAD':
            activityLabel = (activity.actor?.firstName || 'Someone') + ' started a discussion about ' + (meta.campgroundName || 'a campground');
            activityIcon = '🏕️';
            break;
        }

        let targetLink: string | undefined = undefined;
        if (activity.entityType === 'EVENT') {
          targetLink = '/events/' + activity.entityId;
        } else if (activity.type === 'FRIEND_REQUEST') {
          targetLink = '/profile/' + activity.actor?.username;
        } else if (activity.type === 'CREATOR_VIDEO_UPLOAD' || activity.type === 'SHARED_CREATOR_VIDEO') {
          const creatorUsername = (activity.metadata as any)?.creatorUsername || (activity.metadata as any)?.originalCreatorUsername || activity.actor?.username;
          targetLink = '/creators/' + creatorUsername + '/content/' + activity.entityId;
        } else if (activity.type === 'MEAL_ASSIGNMENT_REQUEST' || activity.type === 'MEAL_ASSIGNMENT_RESPONSE') {
          targetLink = '/trips/' + meta.eventId;
        } else if (['THREAD_REPLY', 'THREAD_COMMENT', 'THREAD_MENTION', 'NEW_CAMPGROUND_THREAD'].includes(activity.type)) {
          targetLink = '/threads/' + (activity.entityId || meta.threadId);
        }

        allActivities.push({
          id: 'packing-' + activity.id,
          type: activity.type,
          actor: activity.actor,
          content: activityLabel,
          title: activity.entityName,
          targetName: activity.entityName,
          targetLink,
          createdAt: activity.createdAt,
          activityType: activity.type,
          activityIcon,
          activityLabel,
          isPackingActivity: !['FRIEND_REQUEST', 'NEW_CAMPING_BUDDY', 'MEAL_ASSIGNMENT_REQUEST', 'MEAL_ASSIGNMENT_RESPONSE'].includes(activity.type),
          isFriendRequest: activity.type === 'FRIEND_REQUEST',
          isCampingBuddy: activity.type === 'NEW_CAMPING_BUDDY',
          isMealAssignment: activity.type === 'MEAL_ASSIGNMENT_REQUEST',
          packItemId: meta.packItemId,
          friendshipId: meta.friendshipId,
          metadata: meta,
          canRespond: ['PACK_ITEM_ASSIGNMENT_REQUEST', 'PACK_ITEM_NEEDS_VOLUNTEER', 'FRIEND_REQUEST', 'MEAL_ASSIGNMENT_REQUEST'].includes(activity.type) && activity.userId === userId,
          isRead: activity.isRead,
        });
      });
    } catch (error) {
      console.log('BasecampActivity model error:', error);
    }

    // Sort and deduplicate
    allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Deduplicate
    const seen = new Map<string, any>();
    const deduplicatedActivities = allActivities.filter((activity) => {
      // Skip dismissed activities
      const activityId = activity.id.replace(/^(activity-|post-|photo-|album-|trip-|event-created-|recipe-created-|packing-)/g, "");
      if (mutedActivityIds.has(activityId) || mutedActivityIds.has(activity.id)) return false;

      const key = activity.type + '-' + activity.actor?.id + '-' + (activity.targetLink || activity.title);
      if (!seen.has(key)) {
        seen.set(key, activity);
        return true;
      }
      return false;
    });

    const paginatedActivities = deduplicatedActivities.slice(0, limit);
    const hasMore = deduplicatedActivities.length > limit;

    res.json({ feedItems: paginatedActivities, hasMore, page });
  } catch (error) {
    console.error('Get basecamp feed error:', error);
    res.status(500).json({ error: 'Failed to get basecamp feed' });
  }
});

// GET /api/basecamp/trips/upcoming
router.get('/trips/upcoming', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const upcomingTrips = await prisma.tripPlan.findMany({
      where: { userId, startDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
      take: 1,
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    res.json(upcomingTrips);
  } catch (error) {
    console.error('Get upcoming trips error:', error);
    res.json([]);
  }
});

export default router;
