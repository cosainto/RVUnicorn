import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';
const db = prisma as any;

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
  RECIPE_SHARE_TAG: { icon: '🏷️', label: 'shared a recipe with you' },
  RECIPE_LIKED: { icon: '❤️', label: 'liked', color: 'text-red-500' },
  RECIPE_COMMENTED: { icon: '💬', label: 'commented on' },
  RECIPE_COMMENT_REPLY: { icon: '↩️', label: 'replied to your comment on' },
  RECIPE_COMMENT_THREAD: { icon: '💬', label: 'commented on', color: 'text-blue-600' },
  MEAL_PLAN_CREATED: { icon: '🍽️', label: 'planned a meal' },
  PHOTO_UPLOADED: { icon: '📷', label: 'shared new photos', color: 'text-purple-600' },
  ACTIVITY_ADDED: { icon: '📅', label: 'added an activity to', color: 'text-blue-600' },
  ACTIVITY_COMPLETED: { icon: '✅', label: 'completed', color: 'text-green-600' },
  RSVP_UPDATED: { icon: '🙋', label: 'RSVPd to', color: 'text-indigo-600' },
  PHOTO_LIKED: { icon: '❤️', label: 'liked a photo in', color: 'text-red-500' },
  PHOTO_COMMENTED: { icon: '💬', label: 'commented on a photo in' },
  ALBUM_CREATED: { icon: '📁', label: 'created a new album', color: 'text-indigo-600' },
  PHOTO_TAG: { icon: '🏷️', label: 'tagged you in a photo', color: 'text-purple-600' },
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
  STARGAZING: { icon: '🌟', label: 'is stargazing at', color: 'text-indigo-400' },
};

function getActivityIcon(type: string): string {
  return ACTIVITY_CONFIG[type]?.icon || '📌';
}

function getActivityLabel(type: string): string {
  const label = ACTIVITY_CONFIG[type]?.label;
  if (!label) {
    console.log('Missing activity config for type:', type);
  }
  return label || 'did something';
}

function getActivityColor(type: string): string {
  return ACTIVITY_CONFIG[type]?.color || 'text-gray-600';
}

// GET /api/basecamp/feed
router.get('/feed', authenticateToken, async (req, res) => {
  // Debug log removed
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
      const blockedRelations = await db.blockedUser.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true }
      });
      blockedUserIds = new Set(
        blockedRelations.map((b: any) => b.blockerId === userId ? b.blockedId : b.blockerId)
      );
    } catch (e: any) {
      console.log('BlockedUser model not available');
    }

    const visibleUserIds = unmutedUserIds.filter(id => !blockedUserIds.has(id));

    const allActivities: any[] = [];

    // 1. Activities from Activity model
    try {
      const activities = await prisma.activity.findMany({
        where: {
          type: { notIn: ['FRIEND_ADDED', 'MUTUAL_FRIEND_ADDED', 'NEW_CAMPING_BUDDY', 'FRIEND_REQUEST', 'RECIPE_SHARED', 'RECIPE_SHARE_TAG'] },
          OR: [
            { userId: userId },
            { userId: { in: visibleUserIds }, isPublic: true },
            { campgroundId: { in: unmutedCampgroundIds } },
            { targetUserId: userId },
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

      for (const activity of activities) {
        console.log('Activity type:', activity.type, '| targetUserId:', activity.targetUserId);
        // Skip types already handled by BasecampActivity
        const skipTypes = ['FRIEND_ADDED', 'MUTUAL_FRIEND_ADDED', 'NEW_CAMPING_BUDDY', 'FRIEND_REQUEST'];
        if (skipTypes.includes(activity.type)) {
          continue;
        }
        if (blockedUserIds.has(activity.userId)) {
          return;
        }
        
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
        } else if (activity.albumId) {
          // Handle new Album system
          targetName = activity.title || 'an album';
          targetLink = '/media-albums/' + activity.albumId;
        } else if (activity.title) {
          targetName = activity.title;
        }

        // Fallback: if still no link but we have content, link to the actor's profile
        if (!targetLink && activity.user?.username) {
          targetName = targetName || activity.user.firstName + "'s profile";
          targetLink = '/profile/' + activity.user.username;
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

        // Check if user has liked the recipe comment
        // Debug log removed
        let userHasLiked = false;
        let sourceLikeCount = 0;
        let sourceLoveCount = 0;
        let sourceDislikeCount = 0;
        if ((activity.type === 'RECIPE_COMMENTED' || activity.type === 'RECIPE_COMMENT_REPLY') && activity.recipeId && activity.content) {
          // Debug log removed
          const comment = await prisma.recipeComment.findFirst({
            where: {
              recipeId: activity.recipeId,
              content: activity.content,
            },
            include: {
              _count: { select: { likes: true } },
              likes: { where: { userId }, take: 1 }
            },
            orderBy: { createdAt: 'desc' }
          });
          // Debug log removed
          if (comment) {
            // Debug log removed
          }
          if (comment) {
            // Check if user has liked with separate query
            const userLike = await prisma.recipeCommentLike.findFirst({
              where: { commentId: comment.id, userId }
            });
            userHasLiked = !!userLike;
            sourceLikeCount = comment._count.likes;
          }
        }

        
        // Build activity label - use content as fallback for unrecognized types
        let activityLabel = getActivityLabel(activity.type);
        if ((activity.type === 'RECIPE_SHARED' || activity.type === 'RECIPE_SHARE_TAG') && activity.content) {
          activityLabel = activity.content;
        }
        // If type is unknown and we have content, use that instead of generic fallback
        if (activityLabel === 'did something' && activity.content) {
          activityLabel = activity.content;
        }
        
        // Extract imageUrl, videoUrl, mediaId, and counts from metadata for photo/video activities
        let imageUrl = (activity as any).imageUrl;
        let videoUrl = null;
        let mediaId = null;
        let mediaLikeCount = 0;
        let mediaCommentCount = 0;
        let userHasLikedMedia = false;
        if (activity.type === 'PHOTO_UPLOADED' && activity.metadata) {
          try {
            const meta = typeof activity.metadata === 'string' ? JSON.parse(activity.metadata) : activity.metadata;
            imageUrl = meta?.previewUrl || imageUrl;
            // Check if this is a video upload and get counts
            if (meta?.mediaIds && meta.mediaIds.length > 0) {
              mediaId = meta.mediaIds[0];
              const media = await prisma.media.findFirst({
                where: { id: { in: meta.mediaIds } },
                select: { 
                  id: true, 
                  type: true, 
                  url: true, 
                  thumbnailUrl: true,
                  _count: { select: { MediaReaction: true, MediaComment: true } }
                }
              });
              if (media) {
                mediaLikeCount = media._count?.MediaReaction || 0;
                mediaCommentCount = media._count?.MediaComment || 0;
                if (media.type === 'VIDEO') {
                  videoUrl = media.url;
                  imageUrl = media.thumbnailUrl || imageUrl;
                } else {
                  // For photos, use the Cloudinary URL from Media record
                  imageUrl = media.url || imageUrl;
                }
                // Check if user has liked
                const userReaction = await prisma.mediaReaction.findFirst({
                  where: { mediaId: media.id, userId }
                });
                userHasLikedMedia = !!userReaction;
              }
            }
          } catch (e: any) {}
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
          activityLabel: activityLabel,
          activityColor: getActivityColor(activity.type),
          campground: activity.campground,
          imageUrl,
          videoUrl,
          mediaId,
          mediaLikeCount,
          mediaCommentCount,
          userHasLikedMedia,
          isFriendActivity: friendIdSet.has(activity.userId),
          hasMutualFriendInteraction: !!secondaryUserInfo,
          userHasLiked,
          sourceLikeCount,
        sourceLoveCount,
        sourceDislikeCount,
          isRecipeComment: activity.type === 'RECIPE_COMMENTED',
          isBasecampActivity: activity.type === 'RECIPE_COMMENTED',
        });
      }
    } catch (error: any) {
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
        isBasecampActivity: true,
      });
    });

    // 3. Photos from friends
    try {
      const photos = await db.photo.findMany({
        where: {
          userId: { in: visibleUserIds },
          visibility: { in: ['PUBLIC', 'FRIENDS'] },
          album: { privacy: { in: ['PUBLIC', 'FRIENDS'] } },
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          album: { select: { id: true, title: true, privacy: true } },
          campgroundTags: {
            include: {
              campground: { select: { id: true, name: true, slug: true } },
            },
          },
          event: { select: { id: true, title: true, startDate: true, privacy: true, campgroundId: true, campground: { select: { id: true, name: true, slug: true } } } },
        },
      });

      photos.forEach((photo: any) => {
        if (blockedUserIds.has(photo.userId)) return;
        // Resolve campground from event or campgroundTags
        const photoCampground = photo.event?.campground || photo.campgroundTags?.[0]?.campground || null;
        const campgroundLink = photoCampground
          ? (photoCampground.slug ? `/campground/${photoCampground.slug}` : `/campground/${photoCampground.id}`)
          : null;

        allActivities.push({
          id: 'photo-' + photo.id,
          type: 'PHOTO_UPLOADED',
          actor: photo.user,
          title: photo.album?.title || 'a photo',
          targetName: photo.album?.title || '',
          targetLink: photo.album ? '/albums/' + photo.album.id : undefined,
          createdAt: photo.createdAt,
          activityType: 'PHOTO_UPLOADED',
          activityIcon: '📷',
          activityLabel: (photo.event && photo.event.privacy !== 'PRIVATE')
            ? 'shared trip photos from'
            : photo.album ? 'shared photos in' : 'shared a photo',
          activityColor: 'text-purple-600',
          imageUrl: photo.imageUrl,
          photoId: photo.id,
          campground: photoCampground ? { ...photoCampground, link: campgroundLink } : null,
          isFriendActivity: friendIdSet.has(photo.userId),
          isBasecampActivity: true,
        });
      });
    } catch (error: any) {
      console.log('Photo model not available');
    }

    // 4. Albums from friends
    try {
      const albums = await prisma.photoAlbum.findMany({
        where: {
          userId: { in: visibleUserIds },
          privacy: { in: ['PUBLIC', 'FRIENDS'] },
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          photos: { take: 5, orderBy: { createdAt: 'asc' }, select: { id: true, imageUrl: true } },
          _count: { select: { photos: true } },
        },
      });

      albums.forEach((album: any) => {
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
          albumPreviewPhotos: album.photos.map((p: any) => ({ id: p.id, url: p.imageUrl })),
          albumPhotoCount: album._count?.photos || 0,
          albumTitle: album.title,
          albumId: album.id,
          isFriendActivity: friendIdSet.has(album.userId),
          isBasecampActivity: true,
        });
      });
    } catch (error: any) {
      console.log('PhotoAlbum model not available');
    }

    // 5. Trips from friends
    try {
      const trips = await db.tripPlan.findMany({
        where: { userId: { in: visibleUserIds } },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        },
      });

      trips.forEach((trip: any) => {
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
    } catch (error: any) {
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
    } catch (error: any) {
      console.log('Event model error:', error);
    }

    // 7. Recipes from friends
    try {
      const recipes = await prisma.recipe.findMany({
        where: {
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
    } catch (error: any) {
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
              'THREAD_REPLY', 'THREAD_COMMENT', 'THREAD_MENTION', 'NEW_CAMPGROUND_THREAD',
              'RECIPE_MENTION', 'RECIPE_SHARE_TAG', 'RECIPE_SHARED', 'PHOTO_TAG', 'PHOTO_TAG',
              'RIG_POST'
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
          case 'RECIPE_COMMENT_THREAD':
            activityLabel = (activity.actor?.firstName || 'Someone') + ' commented on "' + (activity.entityName || 'a recipe') + '"';
            activityIcon = '🍳';
            break;
          case 'RECIPE_MENTION':
            activityLabel = (activity.actor?.firstName || 'Someone') + ' mentioned you in a comment on "' + (activity.entityName || 'a recipe') + '"';
            activityIcon = '📣';
            break;
          case 'RECIPE_SHARED':
            const shareMetaSharer = activity.metadata as any;
            const taggedNames = shareMetaSharer?.taggedUserNames?.length > 0 ? ' with ' + shareMetaSharer.taggedUserNames.join(', ') : '';
            const shareMessageSharer = shareMetaSharer?.message ? ': "' + shareMetaSharer.message + '"' : '';
            activityLabel = 'shared "' + (activity.entityName || 'a recipe') + '"' + taggedNames + shareMessageSharer;
            activityIcon = '🍳';
            break;
          case 'RECIPE_SHARE_TAG':
            const shareTagMeta = activity.metadata as any;
            const shareMessage = shareTagMeta?.message ? ': "' + shareTagMeta.message + '"' : '';
            activityLabel = 'shared "' + (activity.entityName || 'a recipe') + '" with you' + shareMessage;
            activityIcon = '🏷️';
            break;
          case 'RECIPE_COMMENTED':
            const commentMeta = activity.metadata as any;
            const mentionsList = commentMeta?.mentions && commentMeta.mentions.length > 0 
              ? ' with ' + commentMeta.mentions.map((m: string) => '@' + m).join(', ')
              : '';
            activityLabel = 'commented on ' + (activity.entityName || 'a recipe') + mentionsList;
            activityIcon = '💬';
            break;
          case 'PHOTO_TAG':
            const photoTagMeta = activity.metadata as any;
            activityLabel = (activity.actor?.firstName || 'Someone') + ' tagged you in a photo';
            activityIcon = '🏷️';
            break;
          case 'RIG_POST':
            const rigPostMeta = activity.metadata as any;
            const rigName = rigPostMeta?.rigName || 'their rig';
            const postTypeLabel = rigPostMeta?.postType === 'trip_recap' ? 'trip recap' :
                                  rigPostMeta?.postType === 'mod_update' ? 'mod update' :
                                  rigPostMeta?.postType === 'tip' ? 'road tip' : 'road report';
            activityLabel = (activity.actor?.firstName || 'Someone') + ' posted a ' + postTypeLabel + ' on ' + rigName;
            activityIcon = '🚐';
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
        } else if (['RECIPE_MENTION', 'RECIPE_SHARE_TAG', 'RECIPE_SHARED'].includes(activity.type)) {
          targetLink = '/recipes/' + activity.entityId;
        } else if (activity.type === 'PHOTO_TAG') {
          const tagMeta = activity.metadata as any;
          targetLink = '/media-albums/' + (tagMeta?.albumId || activity.entityId);
        } else if (activity.type === 'RIG_POST') {
          const rigSlug = (activity.metadata as any)?.rigSlug;
          targetLink = rigSlug ? '/rig/' + rigSlug + '/posts' : undefined;
        }

        allActivities.push({
          id: 'basecamp-' + activity.id,
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
          imageUrl: meta.imageUrl || null,
          isPackingActivity: !['FRIEND_REQUEST', 'NEW_CAMPING_BUDDY', 'MEAL_ASSIGNMENT_REQUEST', 'MEAL_ASSIGNMENT_RESPONSE', 'THREAD_REPLY', 'THREAD_COMMENT', 'THREAD_MENTION', 'NEW_CAMPGROUND_THREAD', 'RECIPE_MENTION', 'RECIPE_SHARE_TAG', 'RECIPE_SHARED', 'PHOTO_TAG', 'PHOTO_TAG', 'RECIPE_SHARED'].includes(activity.type),
          isBasecampActivity: ['FRIEND_REQUEST', 'NEW_CAMPING_BUDDY', 'MEAL_ASSIGNMENT_REQUEST', 'MEAL_ASSIGNMENT_RESPONSE', 'THREAD_REPLY', 'THREAD_COMMENT', 'THREAD_MENTION', 'NEW_CAMPGROUND_THREAD', 'RECIPE_MENTION', 'RECIPE_SHARE_TAG', 'RECIPE_SHARED', 'PHOTO_TAG', 'PHOTO_TAG', 'RECIPE_SHARED', 'RIG_POST'].includes(activity.type),
          reaction: activity.reaction,
          isFriendRequest: activity.type === 'FRIEND_REQUEST',
          isCampingBuddy: activity.type === 'NEW_CAMPING_BUDDY',
          isMealAssignment: activity.type === 'MEAL_ASSIGNMENT_REQUEST',
          packItemId: meta.packItemId,
          friendshipId: meta.friendshipId,
          metadata: meta,
          canRespond: ['PACK_ITEM_ASSIGNMENT_REQUEST', 'PACK_ITEM_NEEDS_VOLUNTEER', 'FRIEND_REQUEST', 'MEAL_ASSIGNMENT_REQUEST'].includes(activity.type) && activity.userId === userId,
          isRead: activity.isRead,
          replyContent: meta.replyContent || meta.commentPreview || null,
        });
      });
    } catch (error: any) {
      console.log('BasecampActivity model error:', error);
    }

    // Sort and deduplicate
    const recipeCommentsBefore = allActivities.filter(a => a.type === 'RECIPE_COMMENTED').length;
    allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Deduplicate
    const seen = new Map<string, any>();
    const deduplicatedActivities = allActivities.filter((activity) => {
      // Skip dismissed activities
      const activityId = activity.id.replace(/^(activity-|post-|photo-|album-|trip-|event-created-|recipe-created-|packing-|basecamp-)/g, "");
      if (mutedActivityIds.has(activityId) || mutedActivityIds.has(activity.id)) return false;

      const key = activity.type + '-' + activity.actor?.id + '-' + (activity.targetLink || activity.title);
      if (!seen.has(key)) {
        seen.set(key, activity);
        return true;
      }
      return false;
    });

    const recipeCommentsAfter = deduplicatedActivities.filter(a => a.type === 'RECIPE_COMMENTED').length;
    const paginatedActivities = deduplicatedActivities.slice(0, limit);
    const recipeCommentsInPage = paginatedActivities.filter(a => a.type === 'RECIPE_COMMENTED').length;
    const hasMore = deduplicatedActivities.length > limit;

    // Enrich activities with source like counts
    const enrichedActivities = await Promise.all(paginatedActivities.map(async (activity) => {
      const meta = activity.metadata || {};
      
      // Check if user has reacted to this Activity item
      let activityReaction = null;
      if (activity.id.startsWith('activity-')) {
        const activityId = activity.id.replace('activity-', '');
        const activityLike = await prisma.activityLike.findUnique({
          where: { activityId_userId: { activityId, userId } }
        });
        if (activityLike) {
          activityReaction = activityLike.reaction;
        }
      }

      const entityType = meta.entityType || (activity.type?.includes('THREAD') ? 'THREAD' : null);
      let sourceLikeCount = 0;
      let sourceLoveCount = 0;
      let sourceDislikeCount = 0;
      let sourceLikers: { id: string; firstName: string; lastName: string; username: string }[] = [];
      let userHasLiked = false;

      try {
        if (entityType === 'THREAD' || ['THREAD_REPLY', 'THREAD_COMMENT', 'THREAD_MENTION'].includes(activity.type)) {
          const postId = meta.postId || meta.replyId;
          if (postId) {
            const likes = await prisma.threadPostLike.findMany({
              where: { postId },
              include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
              take: 5,
              orderBy: { createdAt: 'desc' }
            });
            sourceLikeCount = await prisma.threadPostLike.count({ where: { postId } });
            sourceLikers = likes.map(l => l.user);
            userHasLiked = likes.some(l => l.userId === userId);
          }
        } else if (entityType === 'RECIPE' || ['RECIPE_MENTION', 'RECIPE_COMMENTED'].includes(activity.type)) {
          const commentId = meta.commentId;
          const recipeId = meta.recipeId || activity.recipeId || activity.id.replace('basecamp-', '').replace('activity-', '');
          
          // For RECIPE_COMMENTED from Activity model, find comment by content
          if ((activity.type === 'RECIPE_COMMENTED' || activity.type === 'RECIPE_COMMENT_REPLY') && activity.recipeId && activity.content) {
            try {
              const comment = await prisma.recipeComment.findFirst({
                where: { recipeId: activity.recipeId, content: activity.content },
                include: { 
                  likes: { 
                    include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                  },
                  _count: { select: { likes: true } }
                },
                orderBy: { createdAt: 'desc' }
              });
              if (comment) {
                sourceLikeCount = comment._count.likes;
                sourceLikers = comment.likes.map(l => l.user);
                // Check if user has liked with separate query to avoid take:5 limit
                const userLike = await prisma.recipeCommentLike.findFirst({
                  where: { commentId: comment.id, userId }
                });
                userHasLiked = !!userLike;
              }
            } catch (e: any) { /* comment might not exist */ }
          } else if (commentId) {
            try {
              const likes = await prisma.recipeCommentLike.findMany({
                where: { commentId },
                include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
                take: 5,
                orderBy: { createdAt: 'desc' }
              });
              sourceLikeCount = await prisma.recipeCommentLike.count({ where: { commentId } });
              sourceLikers = likes.map(l => l.user);
              userHasLiked = likes.some(l => l.userId === userId);
            } catch (e: any) { /* comment might not exist */ }
          } else if (recipeId) {
            const likes = await prisma.recipeLike.findMany({
              where: { recipeId },
              include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
              take: 5,
              orderBy: { createdAt: 'desc' }
            });
            sourceLikeCount = await prisma.recipeLike.count({ where: { recipeId } });
            sourceLikers = likes.map(l => l.user);
            userHasLiked = likes.some(l => l.userId === userId);
          }
        } else if (entityType === 'CREATOR_CONTENT' || ['CREATOR_VIDEO_UPLOAD', 'SHARED_CREATOR_VIDEO'].includes(activity.type)) {
          const contentId = meta.contentId || activity.id.replace('basecamp-', '');
          if (contentId) {
            try {
              const likes = await prisma.creatorContentLike.findMany({
                where: { contentId },
                include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
                take: 5,
                orderBy: { createdAt: 'desc' }
              });
              sourceLikeCount = await prisma.creatorContentLike.count({ where: { contentId } });
              sourceLikers = likes.map(l => l.user);
              userHasLiked = likes.some(l => l.userId === userId);
            } catch (e: any) { /* content might not exist */ }
          }
        }
      } catch (e: any) {
        // Silently fail - don't break the feed
      }

      return {
        ...activity,
        sourceLikeCount,
        sourceLoveCount,
        sourceDislikeCount,
        sourceLikers,
        userHasLiked,
        reaction: activityReaction || activity.reaction
      };
    }));

    res.json({ feedItems: enrichedActivities, hasMore, page });
  } catch (error: any) {
    console.error('Get basecamp feed error:', error);
    res.status(500).json({ error: 'Failed to get basecamp feed' });
  }
});

// GET /api/basecamp/trips/upcoming
router.get('/trips/upcoming', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const upcomingTrips = await db.tripPlan.findMany({
      where: { userId, startDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
      take: 1,
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    res.json(upcomingTrips);
  } catch (error: any) {
    console.error('Get upcoming trips error:', error);
    res.json([]);
  }
});

// GET /api/basecamp/campground-feed - Discovery feed: campground updates, public events, inspiration
// Per routing rules: Relationship beats location - friend content goes to Basecamp, not here
// This feed shows: campground updates, public content from STRANGERS, events, discovery content
router.get('/campground-feed', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // User filter preferences
    const showFollowedCampgrounds = req.query.showFollowed !== 'false';
    const showPublicEvents = req.query.showPublicEvents !== 'false';
    const showStrangerActivity = req.query.showStrangerActivity !== 'false';

    // Get followed campgrounds
    const followedCampgrounds = await prisma.campgroundFollow.findMany({
      where: { userId },
      select: { campgroundId: true },
    });
    const followedCampgroundIds = followedCampgrounds.map((f) => f.campgroundId);

    // Get friend IDs (to EXCLUDE from this feed - friends go to Basecamp)
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ initiatorId: userId }, { receiverId: userId }],
      },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIds = friendships.map((f) => 
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );
    // Include self in exclusion list
    const excludedUserIds = [userId, ...friendIds];

    // Build query conditions
    const whereConditions: any[] = [];
    
    // 1. Updates from followed campgrounds (from strangers only - excludes self and friends)
    if (showFollowedCampgrounds && followedCampgroundIds.length > 0) {
      whereConditions.push({
        type: { in: ['CAMPGROUND_ANNOUNCEMENT', 'CAMPGROUND_UPDATE', 'NEW_CAMPGROUND_THREAD'] },
        campgroundId: { in: followedCampgroundIds },
        userId: { notIn: excludedUserIds }, // Exclude self and friends
      });
    }
    
    // 2. Public campground-tagged activity from STRANGERS only
    if (showStrangerActivity) {
      whereConditions.push({
        userId: { notIn: excludedUserIds }, // Exclude self and friends
        campgroundId: { not: null }, // Must have campground tag
        type: { in: ['CHECK_IN', 'CAMPGROUND_REVIEW', 'THREAD_POST', 'THREAD_CREATED', 'PHOTO_UPLOADED'] },
        isPublic: true, // Only public content
      });
    }

    // Get campground activities
    let activities: any[] = [];
    if (whereConditions.length > 0) {
      activities = await prisma.activity.findMany({
        where: { OR: whereConditions },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
          campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } },
        },
      });
    }
    
    // Fetch public events from STRANGERS with campground links
    let publicEventActivities: any[] = [];
    if (showPublicEvents) {
      const publicEvents = await prisma.event.findMany({
        where: { 
          privacy: 'PUBLIC',
          startDate: { gte: new Date() },
          organizerId: { notIn: excludedUserIds }, // Only from strangers
          campgroundId: { not: null }, // Must be linked to a campground
        },
        take: limit,
        orderBy: { startDate: 'asc' }, // Show nearest events first
        include: {
          organizer: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
          campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } },
        },
      });
      
      publicEventActivities = publicEvents.map(event => ({
        id: 'event-' + event.id,
        type: 'EVENT_CREATED',
        user: event.organizer,
        content: null,
        title: event.title,
        campground: event.campground,
        campgroundId: event.campgroundId,
        eventId: event.id,
        createdAt: event.createdAt,
        userId: event.organizerId,
        startDate: event.startDate,
      }));
    }
    
    // Fetch public recipes from STRANGERS
    let publicRecipeActivities: any[] = [];
    if (showStrangerActivity) {
      const publicRecipes = await prisma.recipe.findMany({
        where: { 
          privacy: 'PUBLIC',
          userId: { notIn: excludedUserIds }, // Only from strangers
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
        },
      });
      
      publicRecipeActivities = publicRecipes.map(recipe => ({
        id: 'recipe-' + recipe.id,
        type: 'RECIPE_CREATED',
        user: recipe.user,
        content: recipe.description,
        title: recipe.title,
        campground: null,
        campgroundId: null,
        recipeId: recipe.id,
        createdAt: recipe.createdAt,
        userId: recipe.userId,
      }));
    }

    // Fetch strangers currently checked in at campgrounds
    let activeCheckInActivities: any[] = [];
    if (showStrangerActivity) {
      const activeCheckIns = await prisma.checkIn.findMany({
        where: {
          isActive: true,
          userId: { notIn: excludedUserIds }, // Only strangers
        },
        take: limit,
        orderBy: { checkInDate: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
          campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } },
        },
      });
      
      activeCheckInActivities = activeCheckIns.map(checkIn => ({
        id: 'checkin-' + checkIn.id,
        type: 'ACTIVE_CHECK_IN',
        user: checkIn.user,
        content: checkIn.notes,
        title: null,
        campground: checkIn.campground,
        campgroundId: checkIn.campgroundId,
        createdAt: checkIn.checkInDate,
        userId: checkIn.userId,
        checkOutDate: checkIn.checkOutDate,
        siteNumber: checkIn.siteNumber,
      }));
    }

    // Fetch strangers scheduled at same campgrounds as user's upcoming trips
    let overlappingTripActivities: any[] = [];
    if (showStrangerActivity) {
      // First get the user's upcoming events with campgrounds
      const userUpcomingEvents = await prisma.event.findMany({
        where: {
          OR: [
            { organizerId: userId },
            { attendees: { some: { userId, status: 'ACCEPTED' } } }
          ],
          campgroundId: { not: null },
          startDate: { gte: new Date() },
        },
        select: { campgroundId: true, startDate: true, endDate: true },
      });
      
      if (userUpcomingEvents.length > 0) {
        const userCampgroundIds = userUpcomingEvents.map(e => e.campgroundId).filter(Boolean) as string[];
        
        // Find strangers with overlapping trips at same campgrounds
        const overlappingTrips = await prisma.event.findMany({
          where: {
            campgroundId: { in: userCampgroundIds },
            organizerId: { notIn: excludedUserIds },
            privacy: 'PUBLIC',
            startDate: { gte: new Date() },
          },
          take: limit,
          orderBy: { startDate: 'asc' },
          include: {
            organizer: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
            },
            campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } },
          },
        });
        
        overlappingTripActivities = overlappingTrips.map(event => ({
          id: 'overlap-' + event.id,
          type: 'OVERLAPPING_TRIP',
          user: event.organizer,
          content: null,
          title: event.title,
          campground: event.campground,
          campgroundId: event.campgroundId,
          eventId: event.id,
          createdAt: event.createdAt,
          userId: event.organizerId,
          startDate: event.startDate,
          endDate: event.endDate,
        }));
      }
    }

    // Fetch public albums from strangers (discoveryEnabled)
    let publicAlbumActivities: any[] = [];
    if (showStrangerActivity) {
      const publicAlbums = await prisma.album.findMany({
        where: {
          discoveryEnabled: true,
          userId: { notIn: excludedUserIds },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          User: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
        },
      });
      
      publicAlbumActivities = publicAlbums.map(album => ({
        id: 'album-' + album.id,
        type: 'PUBLIC_ALBUM',
        user: album.User,
        content: album.description,
        title: album.title,
        campground: null,
        campgroundId: null,
        albumId: album.id,
        createdAt: album.createdAt,
        userId: album.userId,
      }));
    }

    // Fetch public videos from strangers
    let publicVideoActivities: any[] = [];
    if (showStrangerActivity) {
      const publicVideos = await prisma.video.findMany({
        where: {
          visibility: 'PUBLIC',
          userId: { notIn: excludedUserIds },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
        },
      });
      
      publicVideoActivities = publicVideos.map(video => ({
        id: 'video-' + video.id,
        type: 'PUBLIC_VIDEO',
        user: video.user,
        content: video.description,
        title: video.title,
        campground: null,
        campgroundId: null,
        videoId: video.id,
        thumbnailUrl: video.thumbnailUrl,
        createdAt: video.createdAt,
        userId: video.userId,
      }));
    }

    // Fetch popular threads from strangers
    let popularThreadActivities: any[] = [];
    if (showStrangerActivity) {
      const popularThreads = await prisma.thread.findMany({
        where: {
          authorId: { notIn: excludedUserIds },
          viewCount: { gte: 5 }, // At least 5 views
        },
        take: limit,
        orderBy: { viewCount: 'desc' },
        include: {
          author: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
          campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } },
        },
      });
      
      popularThreadActivities = popularThreads.map(thread => ({
        id: 'thread-' + thread.id,
        type: 'POPULAR_THREAD',
        user: thread.author,
        content: thread.content,
        title: thread.title,
        campground: thread.campground,
        campgroundId: thread.campgroundId,
        threadId: thread.id,
        threadSlug: thread.slug,
        viewCount: thread.viewCount,
        createdAt: thread.createdAt,
        userId: thread.authorId,
      }));
    }

    // Fetch campground reviews from strangers
    let reviewActivities: any[] = [];
    if (showStrangerActivity) {
      const reviews = await prisma.campgroundReview.findMany({
        where: {
          userId: { notIn: excludedUserIds },
          review: { not: null }, // Has review text
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
          },
          campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } },
        },
      });
      
      reviewActivities = reviews.map(review => ({
        id: 'review-' + review.id,
        type: 'CAMPGROUND_REVIEW_NEW',
        user: review.user,
        content: review.review,
        title: review.title,
        campground: review.campground,
        campgroundId: review.campgroundId,
        rating: review.rating,
        createdAt: review.createdAt,
        userId: review.userId,
      }));
    }

    // Merge and sort all activities — deduplicate check-ins
    const mergedActivities = [...activities, ...publicEventActivities, ...publicRecipeActivities, ...activeCheckInActivities, ...overlappingTripActivities, ...publicAlbumActivities, ...publicVideoActivities, ...popularThreadActivities, ...reviewActivities];

    // Dedup: if a user appears in both CHECK_IN (Activity) and ACTIVE_CHECK_IN (CheckIn table),
    // keep only the ACTIVE_CHECK_IN version to avoid double-showing
    const activeCheckinKeys = new Set(
      activeCheckInActivities.map((a: any) => `${a.userId}:${a.campgroundId}`)
    );
    const allActivities = mergedActivities
      .filter((a: any) => {
        if (a.type === 'CHECK_IN' && a.campgroundId && activeCheckinKeys.has(`${a.userId}:${a.campgroundId}`)) {
          return false; // Skip — already shown as ACTIVE_CHECK_IN
        }
        return true;
      })
      // Also dedup by unique key: userId + type + campgroundId (keep most recent)
      .reduce((acc: any[], item: any) => {
        const key = `${item.userId}:${item.type}:${item.campgroundId || ''}`;
        const existingIdx = acc.findIndex((a: any) => `${a.userId}:${a.type}:${a.campgroundId || ''}` === key);
        if (existingIdx >= 0) {
          // Keep the newer one
          if (new Date(item.createdAt) > new Date(acc[existingIdx].createdAt)) {
            acc[existingIdx] = item;
          }
        } else {
          acc.push(item);
        }
        return acc;
      }, [])
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    const feedItems = allActivities.map((activity) => {
      const isFollowedCampground = followedCampgroundIds.includes(activity.campgroundId || '');
      
      let activityIcon = '🏕️';
      let activityLabel = 'update from';
      let activityColor = 'text-green-600';
      
      if (activity.type === 'CAMPGROUND_ANNOUNCEMENT') {
        activityIcon = '📢';
        activityLabel = 'announced';
        activityColor = 'text-amber-600';
      } else if (activity.type === 'CHECK_IN') {
        activityIcon = '📍';
        activityLabel = 'checked in at';
        activityColor = 'text-blue-600';
      } else if (activity.type === 'CAMPGROUND_REVIEW') {
        activityIcon = '⭐';
        activityLabel = 'reviewed';
        activityColor = 'text-yellow-600';
      } else if (activity.type === 'THREAD_POST' || activity.type === 'THREAD_CREATED') {
        activityIcon = '💬';
        activityLabel = 'posted about';
        activityColor = 'text-purple-600';
      } else if (activity.type === 'PHOTO_UPLOADED') {
        activityIcon = '📷';
        activityLabel = 'shared a photo at';
        activityColor = 'text-pink-600';
      } else if (activity.type === 'EVENT_CREATED') {
        activityIcon = '📅';
        activityLabel = 'is planning a trip to';
        activityColor = 'text-indigo-600';
      } else if (activity.type === 'RECIPE_CREATED') {
        activityIcon = '🍳';
        activityLabel = 'shared a recipe';
        activityColor = 'text-orange-600';
      } else if (activity.type === 'ACTIVE_CHECK_IN') {
        activityIcon = '🏕️';
        activityLabel = 'is currently camping at';
        activityColor = 'text-green-600';
      } else if (activity.type === 'OVERLAPPING_TRIP') {
        activityIcon = '👋';
        activityLabel = 'will be at';
        activityColor = 'text-blue-600';
      } else if (activity.type === 'PUBLIC_ALBUM') {
        activityIcon = '📸';
        activityLabel = 'shared an album';
        activityColor = 'text-pink-600';
      } else if (activity.type === 'PUBLIC_VIDEO') {
        activityIcon = '🎬';
        activityLabel = 'posted a video';
        activityColor = 'text-red-600';
      } else if (activity.type === 'POPULAR_THREAD') {
        activityIcon = '🔥';
        activityLabel = 'started a popular discussion';
        activityColor = 'text-orange-600';
      } else if (activity.type === 'CAMPGROUND_REVIEW_NEW') {
        activityIcon = '⭐';
        activityLabel = 'reviewed';
        activityColor = 'text-yellow-600';
      }
      
      return {
        id: 'campground-' + activity.id,
        type: activity.type,
        actor: activity.user,
        content: activity.content,
        title: activity.title,
        targetName: activity.type === 'EVENT_CREATED' ? (activity.campground?.name || activity.title || 'an event') : activity.type === 'RECIPE_CREATED' ? (activity.title || 'a recipe') : activity.type === 'ACTIVE_CHECK_IN' ? (activity.campground?.name || 'a campground') : activity.type === 'OVERLAPPING_TRIP' ? (activity.campground?.name || 'a campground') : activity.type === 'PUBLIC_ALBUM' ? (activity.title || 'an album') : activity.type === 'PUBLIC_VIDEO' ? (activity.title || 'a video') : activity.type === 'POPULAR_THREAD' ? (activity.title || 'a discussion') : activity.type === 'CAMPGROUND_REVIEW_NEW' ? (activity.campground?.name || 'a campground') : (activity.campground?.name || ''),
        targetLink: activity.type === 'EVENT_CREATED' ? '/events/' + (activity.eventId || activity.id) : activity.type === 'RECIPE_CREATED' ? '/recipes/' + activity.recipeId : activity.type === 'OVERLAPPING_TRIP' ? '/events/' + activity.eventId : activity.type === 'PUBLIC_ALBUM' ? '/media-albums/' + activity.albumId : activity.type === 'PUBLIC_VIDEO' ? '/videos/' + activity.videoId : activity.type === 'POPULAR_THREAD' ? '/threads/' + activity.threadSlug : activity.type === 'CAMPGROUND_REVIEW_NEW' ? '/campgrounds/' + activity.campgroundId : (activity.campground ? '/campgrounds/' + activity.campground.id : undefined),
        createdAt: activity.createdAt,
        activityType: activity.type,
        activityIcon,
        activityLabel,
        activityColor,
        campground: activity.campground,
        isCampgroundActivity: true,
        isFollowedCampground,
        isDiscovery: !isFollowedCampground, // Content for discovery/inspiration
        startDate: activity.startDate, // For events
      };
    });

    res.json({ feedItems, hasMore: allActivities.length === limit });
  } catch (error: any) {
    console.error('Get campground feed error:', error);
    res.status(500).json({ error: 'Failed to get campground feed' });
  }
});

// React to a basecamp activity (like, love, dislike, or remove reaction)
// Syncs reactions to source content so likes appear on the original item
router.post('/activity/:id/react', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    let { id } = req.params;
    const { reaction } = req.body; // 'like', 'love', 'dislike', or null to remove

    const isLike = reaction === 'like';
    let meta: any = {};
    let entityId: string | undefined;
    let entityType: string | undefined;

    // Check if this is an Activity item (activity-xxx) or BasecampActivity (basecamp-xxx)
    if (id.startsWith('activity-')) {
      const activityId = id.replace('activity-', '');
      const activity = await prisma.activity.findFirst({
        where: { id: activityId }
      });

      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      // Save reaction to ActivityLike table
      if (reaction) {
        await prisma.activityLike.upsert({
          where: { activityId_userId: { activityId, userId } },
          update: { reaction },
          create: { activityId, userId, reaction }
        });
      } else {
        await prisma.activityLike.deleteMany({
          where: { activityId, userId }
        });
      }

      // For RECIPE_COMMENTED activities, sync reaction to the recipe comment
      if (activity.type === 'RECIPE_COMMENTED' && activity.recipeId) {
        const comment = await prisma.recipeComment.findFirst({
          where: {
            recipeId: activity.recipeId,
            content: activity.content || undefined,
          },
          orderBy: { createdAt: 'desc' }
        });

        if (comment) {
          if (reaction) {
            // Save/update the reaction
            const saved = await prisma.recipeCommentLike.upsert({
              where: { commentId_userId: { commentId: comment.id, userId } },
              update: { reaction },
              create: { commentId: comment.id, userId, reaction }
            });
          } else {
            // Remove the reaction
            await prisma.recipeCommentLike.deleteMany({
              where: { commentId: comment.id, userId }
            });
          }
        } else {
        }
      }

      return res.json({ success: true, reaction });
    }

    // Handle BasecampActivity items
    const basecampId = id.startsWith('basecamp-') ? id.replace('basecamp-', '') : id;
    const activity = await prisma.basecampActivity.findFirst({
      where: { id: basecampId, userId }
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Update reaction on the basecamp activity
    const updated = await prisma.basecampActivity.update({
      where: { id: basecampId },
      data: { reaction: reaction || null }
    });

    meta = activity.metadata as any || {};
    entityId = activity.entityId;
    entityType = activity.entityType;
    const isDislike = reaction === 'dislike';

    // Sync like/dislike to the source content based on entity type
    try {
      // THREAD content (posts/replies/comments)
      if (entityType === 'THREAD') {
        const postId = meta.postId || meta.replyId || entityId;
        if (postId) {
          if (isLike) {
            await prisma.threadPostLike.upsert({
              where: { postId_userId: { postId, userId } },
              update: {},
              create: { postId, userId }
            });
          } else {
            await prisma.threadPostLike.deleteMany({
              where: { postId, userId }
            });
          }
        }
      }
      
      // RECIPE content (comments or recipe itself)
      else if (entityType === 'RECIPE') {
        const commentId = meta.commentId;
        const recipeId = meta.recipeId || entityId;
        
        // If there's a commentId, sync reaction to the comment
        if (commentId) {
          if (reaction) {
            await prisma.recipeCommentLike.upsert({
              where: { commentId_userId: { commentId, userId } },
              update: { reaction },
              create: { commentId, userId, reaction }
            });
          } else {
            await prisma.recipeCommentLike.deleteMany({
              where: { commentId, userId }
            });
          }
        } else if (recipeId) {
          if (isLike) {
            await prisma.recipeLike.upsert({
              where: { recipeId_userId: { recipeId, userId } },
              update: {},
              create: { recipeId, userId }
            });
          } else {
            await prisma.recipeLike.deleteMany({
              where: { recipeId, userId }
            });
          }
        }
      }
      
      // CREATOR_CONTENT (videos, articles, etc.)
      else if (entityType === 'CREATOR_CONTENT') {
        const contentId = meta.contentId || entityId;
        if (contentId) {
          if (isLike) {
            await prisma.creatorContentLike.upsert({
              where: { contentId_userId: { contentId, userId } },
              update: {},
              create: { contentId, userId }
            });
          } else {
            await prisma.creatorContentLike.deleteMany({
              where: { contentId, userId }
            });
          }
        }
      }
      
      // Regular POST (wall posts)
      else if (entityType === 'POST') {
        const postId = meta.postId || entityId;
        if (postId) {
          if (isLike) {
            await prisma.like.upsert({
              where: { postId_userId: { postId, userId } },
              update: {},
              create: { postId, userId }
            });
          } else {
            await prisma.like.deleteMany({
              where: { postId, userId }
            });
          }
        }
      }
    } catch (syncError) {
      // Log but don't fail - the basecamp reaction was saved
      console.error('Error syncing like to source:', syncError);
    }

    // Fetch updated like count from source
    let sourceLikeCount = 0;
    let sourceLikers: { id: string; firstName: string; lastName: string; username: string }[] = [];
    
    try {
      if (entityType === 'THREAD') {
        const postId = meta.postId || meta.replyId || entityId;
        if (postId) {
          const likes = await prisma.threadPostLike.findMany({
            where: { postId },
            include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
            take: 5,
            orderBy: { createdAt: 'desc' }
          });
          sourceLikeCount = await prisma.threadPostLike.count({ where: { postId } });
          sourceLikers = likes.map(l => l.user);
        }
      } else if (entityType === 'RECIPE') {
        const commentId = meta.commentId;
        const recipeId = meta.recipeId || entityId;
        
        // If there's a commentId, get comment likes; otherwise get recipe likes
        if (commentId) {
          const likes = await prisma.recipeCommentLike.findMany({
            where: { commentId },
            include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
            take: 5,
            orderBy: { createdAt: 'desc' }
          });
          sourceLikeCount = await prisma.recipeCommentLike.count({ where: { commentId } });
          sourceLikers = likes.map(l => l.user);
        } else if (recipeId) {
          const likes = await prisma.recipeLike.findMany({
            where: { recipeId },
            include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
            take: 5,
            orderBy: { createdAt: 'desc' }
          });
          sourceLikeCount = await prisma.recipeLike.count({ where: { recipeId } });
          sourceLikers = likes.map(l => l.user);
        }
      } else if (entityType === 'CREATOR_CONTENT') {
        const contentId = meta.contentId || entityId;
        if (contentId) {
          const likes = await prisma.creatorContentLike.findMany({
            where: { contentId },
            include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
            take: 5,
            orderBy: { createdAt: 'desc' }
          });
          sourceLikeCount = await prisma.creatorContentLike.count({ where: { contentId } });
          sourceLikers = likes.map(l => l.user);
        }
      } else if (entityType === 'POST') {
        const postId = meta.postId || entityId;
        if (postId) {
          const likes = await prisma.like.findMany({
            where: { postId },
            include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
            take: 5,
            orderBy: { createdAt: 'desc' }
          });
          sourceLikeCount = await prisma.like.count({ where: { postId } });
          sourceLikers = likes.map(l => l.user);
        }
      }
    } catch (fetchError) {
      console.error('Error fetching source likes:', fetchError);
    }

    res.json({ 
      success: true, 
      reaction: updated.reaction,
      sourceLikeCount,
      sourceLikers
    });
  } catch (error: any) {
    console.error('React to activity error:', error);
    res.status(500).json({ error: 'Failed to react to activity' });
  }
});

// Dismiss/ignore a basecamp activity
router.delete('/activity/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    // Try BasecampActivity first
    const basecampActivity = await prisma.basecampActivity.findFirst({
      where: { id, userId }
    });

    if (basecampActivity) {
      await prisma.basecampActivity.delete({ where: { id } });
      return res.json({ success: true });
    }

    // Try Activity model (photo uploads, etc.)
    const activity = await prisma.activity.findFirst({
      where: { id, userId }
    });

    if (activity) {
      // If it's a photo upload with media, clean up the media too
      if (activity.type === 'PHOTO_UPLOADED' && activity.metadata) {
        try {
          const meta = typeof activity.metadata === 'string' ? JSON.parse(activity.metadata) : activity.metadata;
          if (meta.mediaId) {
            // Delete associated likes and comments first
            await prisma.mediaComment.deleteMany({ where: { mediaId: meta.mediaId } }).catch(() => {});
            await prisma.mediaReaction.deleteMany({ where: { mediaId: meta.mediaId } }).catch(() => {});
            // Delete the media item
            await prisma.media.delete({ where: { id: meta.mediaId } }).catch(() => {});
          }
        } catch (e: any) {
          console.log('Media cleanup skipped:', e);
        }
      }

      // Delete related notifications
      await db.notification.deleteMany({
        where: { relatedId: id }
      }).catch(() => {});

      // Delete the activity
      await prisma.activity.delete({ where: { id } });
      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Activity not found' });
  } catch (error: any) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});




// Official Campground Updates - content FROM campgrounds (not user activity)
router.get('/campground-official-feed', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const limit = parseInt(req.query.limit as string) || 10;

    // Get followed campgrounds
    const followedCampgrounds = await prisma.campgroundFollow.findMany({
      where: { userId },
      select: { campgroundId: true },
    });
    const followedCampgroundIds = followedCampgrounds.map((f) => f.campgroundId);

    if (followedCampgroundIds.length === 0) {
      return res.json({ feedItems: [], hasMore: false, message: 'Follow campgrounds to see their updates!' });
    }

    // Fetch campground announcements
    const announcements = await prisma.campgroundAnnouncement.findMany({
      where: {
        campgroundId: { in: followedCampgroundIds },
        isPublished: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      },
      take: limit,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } },
        author: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
    });

    const announcementItems = announcements.map(a => ({
      id: 'announcement-' + a.id,
      type: 'CAMPGROUND_ANNOUNCEMENT',
      campground: a.campground,
      campgroundId: a.campgroundId,
      title: a.title,
      content: a.content,
      imageUrl: a.imageUrl,
      isPinned: a.isPinned,
      priority: a.priority,
      createdAt: a.createdAt,
      activityIcon: a.priority === 'URGENT' ? '🚨' : '📢',
      activityLabel: 'announced',
      activityColor: a.priority === 'URGENT' ? 'text-red-600' : 'text-amber-600',
      targetName: a.title,
      targetLink: '/campgrounds/' + a.campgroundId,
    }));

    // Fetch campground events
    const campgroundEvents = await prisma.campgroundEvent.findMany({
      where: {
        campgroundId: { in: followedCampgroundIds },
        startDate: { gte: new Date() },
      },
      take: limit,
      orderBy: { startDate: 'asc' },
      include: {
        campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } },
        createdBy: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
    });

    const eventItems = campgroundEvents.map(e => ({
      id: 'cg-event-' + e.id,
      type: 'CAMPGROUND_EVENT',
      campground: e.campground,
      campgroundId: e.campgroundId,
      title: e.title,
      content: e.description,
      imageUrl: e.imageUrl,
      startDate: e.startDate,
      endDate: e.endDate,
      createdAt: e.createdAt,
      activityIcon: '📅',
      activityLabel: 'is hosting',
      activityColor: 'text-indigo-600',
      targetName: e.title,
      targetLink: '/campgrounds/' + e.campgroundId + '/events/' + e.id,
    }));

    // Fetch campground posts
    const posts = await prisma.campgroundPost.findMany({
      where: {
        campgroundId: { in: followedCampgroundIds },
      },
      take: limit,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } },
        author: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
    });

    const postItems = posts.map(p => ({
      id: 'cg-post-' + p.id,
      type: 'CAMPGROUND_POST',
      campground: p.campground,
      campgroundId: p.campgroundId,
      title: p.title,
      content: p.content,
      imageUrl: p.imageUrl,
      isPinned: p.isPinned,
      createdAt: p.createdAt,
      activityIcon: '📝',
      activityLabel: 'posted',
      activityColor: 'text-blue-600',
      targetName: p.title || 'an update',
      targetLink: '/campgrounds/' + p.campgroundId,
    }));

    // Get check-in counts for followed campgrounds
    const checkInCounts = await prisma.checkIn.groupBy({
      by: ['campgroundId'],
      where: {
        campgroundId: { in: followedCampgroundIds },
        isActive: true,
      },
      _count: { id: true },
    });

    // Get campground details for check-in counts
    const campgroundsWithCheckIns = await prisma.campground.findMany({
      where: {
        id: { in: checkInCounts.filter((c: any) => c._count.id > 0).map((c: any) => c.campgroundId).filter(Boolean) as string[] },
      },
      select: { id: true, name: true, location: true, state: true, imageUrl: true },
    });

    const checkInItems = checkInCounts
      .filter(c => c._count.id > 0)
      .map(c => {
        const campground = campgroundsWithCheckIns.find(cg => cg.id === c.campgroundId);
        return {
          id: 'checkin-count-' + c.campgroundId,
          type: 'CAMPGROUND_CHECKIN_COUNT',
          campground,
          campgroundId: c.campgroundId,
          title: null,
          content: `${c._count.id} camper${c._count.id > 1 ? 's' : ''} currently here`,
          createdAt: new Date(),
          activityIcon: '🏕️',
          activityLabel: `has ${c._count.id} camper${c._count.id > 1 ? 's' : ''} checked in`,
          activityColor: 'text-green-600',
          targetName: campground?.name || 'Campground',
          targetLink: '/campgrounds/' + c.campgroundId,
          checkinCount: c._count.id,
        };
      });

    // Merge and sort all items
    const allItems = [...announcementItems, ...eventItems, ...postItems, ...checkInItems]
      .sort((a: any, b: any) => {
        // Pinned items first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then by date
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limit);

    res.json({ feedItems: allItems, hasMore: allItems.length === limit });
  } catch (error: any) {
    console.error('Get campground official feed error:', error);
    res.status(500).json({ error: 'Failed to get campground updates' });
  }
});

// POST /api/basecamp/admin/trigger-stargazing (admin only)
router.post('/admin/trigger-stargazing', authenticateToken, async (req: any, res) => {
  const WILL_ID = 'cmlpeyk82005s3qause3sws7y';
  if ((req as any).userId !== WILL_ID) return res.status(403).json({ error: 'Admin only' });
  try {
    const { runStargazingCron } = await import('../cron/stargazing-cron');
    await runStargazingCron();
    res.json({ success: true, message: 'Stargazing cron triggered!' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// GET /api/basecamp/social-map — Social map data for Basecamp
// Returns friends' live check-ins, recent albums, and upcoming trips
// ══════════════════════════════════════════════════════════════════════
router.get('/social-map', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    // Get friend IDs
    const friendships = await db.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIds: string[] = friendships.map((f: any) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    if (friendIds.length === 0) {
      return res.json({ liveFriends: [], recentAlbums: [], upcomingFriendTrips: [] });
    }

    // ── 1. Live Friends (currently checked in) ─────────────────────────
    const liveCheckins = await db.checkIn.findMany({
      where: { userId: { in: friendIds }, isActive: true },
      select: {
        id: true,
        checkInDate: true,
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        campground: { select: { id: true, name: true, latitude: true, longitude: true, state: true } },
      },
      orderBy: { checkInDate: 'desc' },
    });

    const liveFriends = liveCheckins
      .filter((c: any) => c.campground?.latitude && c.campground?.longitude)
      .map((c: any) => ({
        userId: c.user.id,
        username: c.user.username,
        firstName: c.user.firstName,
        avatarUrl: c.user.profilePicture,
        campgroundId: c.campground.id,
        campgroundName: c.campground.name,
        latitude: c.campground.latitude,
        longitude: c.campground.longitude,
        state: c.campground.state,
        checkedInAt: c.checkInDate,
      }));

    // ── 2. Recent Albums (friends' albums with geodata) ────────────────
    // Three paths to get album location:
    //   A) StateVisit with lat/lng → StateVisitAlbum → PhotoAlbum
    //   B) PhotoAlbum → Event → Campground with lat/lng
    //   C) PhotoAlbum → Photos → PhotoCampgroundTag → Campground with lat/lng
    const seenAlbumIds = new Set<string>();
    const recentAlbums: any[] = [];

    // Path A: StateVisit albums
    const stateVisitAlbums = await db.stateVisit.findMany({
      where: {
        userId: { in: friendIds },
        visibility: { not: 'PRIVATE' },
        OR: [
          { latitude: { not: null } },
          { campsite: { latitude: { not: null } } },
        ],
        albums: { some: {} },
      },
      select: {
        latitude: true, longitude: true, startDate: true,
        campsite: { select: { id: true, name: true, latitude: true, longitude: true } },
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        albums: {
          select: { album: { select: { id: true, title: true, coverPhotoUrl: true, createdAt: true, privacy: true } } },
          take: 1,
        },
      },
      orderBy: { startDate: 'desc' },
      take: 30,
    });

    for (const sv of stateVisitAlbums) {
      const album = (sv as any).albums[0]?.album;
      if (!album || album.privacy === 'PRIVATE' || seenAlbumIds.has(album.id)) continue;
      const lat = (sv as any).latitude || (sv as any).campsite?.latitude;
      const lng = (sv as any).longitude || (sv as any).campsite?.longitude;
      if (!lat || !lng) continue;
      seenAlbumIds.add(album.id);
      recentAlbums.push({
        albumId: album.id, albumTitle: album.title,
        ownerUsername: (sv as any).user.username, ownerFirstName: (sv as any).user.firstName,
        ownerAvatarUrl: (sv as any).user.profilePicture, coverImageUrl: album.coverPhotoUrl,
        campgroundName: (sv as any).campsite?.name || null, campgroundId: (sv as any).campsite?.id || null,
        latitude: lat, longitude: lng, createdAt: album.createdAt,
      });
    }

    // Path B: Albums linked to Events with campground location
    const eventAlbums = await db.photoAlbum.findMany({
      where: {
        userId: { in: friendIds },
        privacy: { not: 'PRIVATE' },
        eventId: { not: null },
        event: { campground: { latitude: { not: null } } },
      },
      select: {
        id: true, title: true, coverPhotoUrl: true, createdAt: true,
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        event: { select: { campground: { select: { id: true, name: true, latitude: true, longitude: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    for (const a of eventAlbums) {
      if (seenAlbumIds.has((a as any).id)) continue;
      const cg = (a as any).event?.campground;
      if (!cg?.latitude || !cg?.longitude) continue;
      seenAlbumIds.add((a as any).id);
      recentAlbums.push({
        albumId: (a as any).id, albumTitle: (a as any).title,
        ownerUsername: (a as any).user.username, ownerFirstName: (a as any).user.firstName,
        ownerAvatarUrl: (a as any).user.profilePicture, coverImageUrl: (a as any).coverPhotoUrl,
        campgroundName: cg.name, campgroundId: cg.id,
        latitude: cg.latitude, longitude: cg.longitude, createdAt: (a as any).createdAt,
      });
    }

    // Path C: Albums with photos tagged to a campground
    const taggedAlbums = await db.photoAlbum.findMany({
      where: {
        userId: { in: friendIds },
        privacy: { not: 'PRIVATE' },
        photos: { some: { campgroundTags: { some: { campground: { latitude: { not: null } } } } } },
      },
      select: {
        id: true, title: true, coverPhotoUrl: true, createdAt: true,
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        photos: {
          where: { campgroundTags: { some: {} } },
          select: { campgroundTags: { select: { campground: { select: { id: true, name: true, latitude: true, longitude: true } } }, take: 1 } },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    for (const a of taggedAlbums) {
      if (seenAlbumIds.has((a as any).id)) continue;
      const cg = (a as any).photos?.[0]?.campgroundTags?.[0]?.campground;
      if (!cg?.latitude || !cg?.longitude) continue;
      seenAlbumIds.add((a as any).id);
      recentAlbums.push({
        albumId: (a as any).id, albumTitle: (a as any).title,
        ownerUsername: (a as any).user.username, ownerFirstName: (a as any).user.firstName,
        ownerAvatarUrl: (a as any).user.profilePicture, coverImageUrl: (a as any).coverPhotoUrl,
        campgroundName: cg.name, campgroundId: cg.id,
        latitude: cg.latitude, longitude: cg.longitude, createdAt: (a as any).createdAt,
      });
    }

    // Sort all albums newest-first
    recentAlbums.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // ── 3. Upcoming Friend Trips (future, shared) ──────────────────────
    const now = new Date();
    const upcomingTrips = await db.trip.findMany({
      where: {
        userId: { in: friendIds },
        visibility: { not: 'PRIVATE' },
        startDate: { gte: now },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        coverImage: true,
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        stays: {
          select: {
            campground: { select: { id: true, name: true, latitude: true, longitude: true, state: true } },
          },
          take: 1,
        },
        days: {
          select: {
            stops: {
              select: { latitude: true, longitude: true, campgroundId: true, campground: { select: { id: true, name: true, latitude: true, longitude: true } } },
              take: 1,
            },
          },
          take: 1,
        },
      },
      orderBy: { startDate: 'asc' },
      take: 15,
    });

    const upcomingFriendTrips = upcomingTrips
      .map((t: any) => {
        // Try stays first, then trip stops
        const stay = t.stays?.[0];
        const stop = t.days?.[0]?.stops?.[0];
        const campground = stay?.campground || stop?.campground;
        const lat = campground?.latitude || stop?.latitude;
        const lng = campground?.longitude || stop?.longitude;
        if (!lat || !lng) return null;
        return {
          tripId: t.id,
          tripTitle: t.title,
          ownerUsername: t.user.username,
          ownerFirstName: t.user.firstName,
          ownerAvatarUrl: t.user.profilePicture,
          campgroundName: campground?.name || null,
          campgroundId: campground?.id || null,
          latitude: lat,
          longitude: lng,
          departureDate: t.startDate,
        };
      })
      .filter(Boolean);

    res.json({ liveFriends, recentAlbums, upcomingFriendTrips });
  } catch (e: any) {
    console.error('[Basecamp] Social map error:', e);
    res.json({ liveFriends: [], recentAlbums: [], upcomingFriendTrips: [] });
  }
});

export default router;
