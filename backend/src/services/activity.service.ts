import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type ActivityType = 
  | 'POST_CREATED'
  | 'RECIPE_CREATED'
  | 'RECIPE_SHARED'
  | 'TRIP_CREATED'
  | 'TRIP_JOINED'
  | 'FRIEND_ADDED'
  | 'CHECK_IN'
  | 'CAMPGROUND_REVIEW'
  | 'PHOTO_UPLOADED'
  | 'ALBUM_CREATED'
  | 'STICKER_EARNED'
  | 'STATE_VISITED'
  | 'THREAD_CREATED'
  | 'THREAD_POST'
  | 'GEAR_ADDED'
  | 'GROUP_JOINED'
  | 'PROFILE_UPDATED'
  | 'WALL_POST'
  | 'ATTRACTION_ADDED'
  | 'RV_SHOWCASE_UPDATED'
  | 'EVENT_CREATED'
  | 'EVENT_JOINED'
  | 'EVENT_UPDATED'
  | 'EVENT_COMMENTED'
  | 'RECIPE_LIKED'
  | 'RECIPE_COMMENTED'
  | 'PHOTO_LIKED'
  | 'PHOTO_COMMENTED'
  | 'ALBUM_LIKED'
  | 'WALL_COMMENT'
  | 'CAMPGROUND_FOLLOWED'
  | 'GROUP_CREATED'
  | 'BADGE_EARNED'
  | 'TRIP_PLANNED'
  | 'GEAR_REVIEW'
  | 'RV_UPDATED'
  | 'MUTUAL_FRIEND_ADDED';

interface CreateActivityParams {
  userId: string;
  type: ActivityType;
  title?: string;
  content?: string;
  threadId?: string;
  eventId?: string;
  recipeId?: string;
  campgroundId?: string;
  targetUserId?: string;
  secondaryUserId?: string;
  albumId?: string;
  photoId?: string;
  metadata?: Record<string, any>;
  isPublic?: boolean;
  isCreatorContent?: boolean;
}

export async function createActivity(params: CreateActivityParams) {
  try {
    let isPublic = params.isPublic ?? true;
    
    if (isPublic && !params.isCreatorContent) {
      const userPrefs = await prisma.userPreferences.findUnique({
        where: { userId: params.userId },
        select: { profileVisibility: true }
      });
      
      if (userPrefs?.profileVisibility === 'PRIVATE') {
        isPublic = false;
      }
    }

    const activity = await prisma.activity.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        threadId: params.threadId,
        eventId: params.eventId,
        recipeId: params.recipeId,
        campgroundId: params.campgroundId,
        targetUserId: params.targetUserId,
        secondaryUserId: params.secondaryUserId,
        albumId: params.albumId,
        photoId: params.photoId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        isPublic,
        isCreatorContent: params.isCreatorContent ?? false,
      },
    });
    return activity;
  } catch (error) {
    console.error('Failed to create activity:', error);
    return null;
  }
}

// Existing convenience functions
export const logRecipeCreated = (userId: string, recipeId: string, title: string) =>
  createActivity({ userId, type: 'RECIPE_CREATED', recipeId, title });

export const logTripCreated = (userId: string, eventId: string, title: string) =>
  createActivity({ userId, type: 'TRIP_CREATED', eventId, title });

export const logTripJoined = (userId: string, eventId: string, title: string) =>
  createActivity({ userId, type: 'TRIP_JOINED', eventId, title });

export const logFriendAdded = (userId: string, friendId: string, friendName: string) =>
  createActivity({ userId, type: 'FRIEND_ADDED', targetUserId: friendId, title: friendName });

export const logCheckIn = (userId: string, campgroundId: string, campgroundName: string) =>
  createActivity({ userId, type: 'CHECK_IN', campgroundId, title: campgroundName });

export const logReview = (userId: string, campgroundId: string, campgroundName: string, rating: number) =>
  createActivity({ userId, type: 'CAMPGROUND_REVIEW', campgroundId, title: campgroundName, content: String(rating) + ' stars' });

export const logPhotoUploaded = (
  userId: string,
  albumId?: string,
  albumTitle?: string,
  photoId?: string,
  campground?: { id: string; name: string; slug?: string | null } | null
) =>
  createActivity({
    userId,
    type: 'PHOTO_UPLOADED',
    albumId,
    photoId,
    title: albumTitle || 'a photo',
    ...(campground ? {
      metadata: JSON.stringify({
        campgroundId: campground.id,
        campgroundName: campground.name,
        campgroundSlug: campground.slug || null,
      }),
    } : {}),
  });

export const logAlbumCreated = (userId: string, albumId: string, title: string) =>
  createActivity({ userId, type: 'ALBUM_CREATED', albumId, title });

export const logStickerEarned = (userId: string, stickerName: string, campgroundId?: string) =>
  createActivity({ userId, type: 'STICKER_EARNED', campgroundId, title: stickerName });

export const logStateVisited = (userId: string, stateName: string) =>
  createActivity({ userId, type: 'STATE_VISITED', title: stateName });

export const logThreadCreated = (userId: string, threadId: string, title: string, campgroundId?: string) =>
  createActivity({ userId, type: 'THREAD_CREATED', threadId, campgroundId, title });

export const logThreadPost = (userId: string, threadId: string, title: string) =>
  createActivity({ userId, type: 'THREAD_POST', threadId, title });

export const logGearAdded = (userId: string, gearName: string) =>
  createActivity({ userId, type: 'GEAR_ADDED', title: gearName });

export const logGroupJoined = (userId: string, groupName: string) =>
  createActivity({ userId, type: 'GROUP_JOINED', title: groupName });

export const logWallPost = (userId: string, targetUserId: string) =>
  createActivity({ userId, type: 'WALL_POST', targetUserId });

export const logAttractionAdded = (userId: string, attractionName: string) =>
  createActivity({ userId, type: 'ATTRACTION_ADDED', title: attractionName });

export const logRVShowcaseUpdated = (userId: string, photoCount: number) =>
  createActivity({ userId, type: 'RV_SHOWCASE_UPDATED', title: 'Updated RV showcase with ' + photoCount + ' photo' + (photoCount !== 1 ? 's' : '') });

// NEW Friend Activity Functions
export const logEventCreated = (userId: string, eventId: string, title: string, campgroundId?: string) =>
  createActivity({ userId, type: 'EVENT_CREATED', eventId, campgroundId, title });

export const logEventJoined = (userId: string, eventId: string, title: string) =>
  createActivity({ userId, type: 'EVENT_JOINED', eventId, title });

export const logEventUpdated = (userId: string, eventId: string, title: string, changes?: string) =>
  createActivity({ userId, type: 'EVENT_UPDATED', eventId, title, content: changes });

export const logRecipeLiked = (
  userId: string, 
  recipeId: string, 
  recipeTitle: string, 
  recipeOwnerId: string,
  recipeOwnerName: string
) =>
  createActivity({ 
    userId, 
    type: 'RECIPE_LIKED', 
    recipeId, 
    targetUserId: recipeOwnerId,
    title: recipeTitle,
    metadata: { ownerName: recipeOwnerName }
  });

export const logRecipeCommented = (
  userId: string, 
  recipeId: string, 
  recipeTitle: string, 
  recipeOwnerId: string,
  commentPreview?: string
) =>
  createActivity({ 
    userId, 
    type: 'RECIPE_COMMENTED', 
    recipeId, 
    targetUserId: recipeOwnerId,
    title: recipeTitle,
    content: commentPreview
  });

export const logPhotoLiked = (
  userId: string, 
  photoId: string, 
  albumId: string,
  albumTitle: string,
  photoOwnerId: string
) =>
  createActivity({ 
    userId, 
    type: 'PHOTO_LIKED', 
    photoId,
    albumId,
    targetUserId: photoOwnerId,
    title: albumTitle
  });

export const logPhotoCommented = (
  userId: string, 
  photoId: string, 
  albumId: string,
  albumTitle: string,
  photoOwnerId: string,
  commentPreview?: string
) =>
  createActivity({ 
    userId, 
    type: 'PHOTO_COMMENTED', 
    photoId,
    albumId,
    targetUserId: photoOwnerId,
    title: albumTitle,
    content: commentPreview
  });

export const logAlbumLiked = (
  userId: string, 
  albumId: string, 
  albumTitle: string, 
  albumOwnerId: string
) =>
  createActivity({ 
    userId, 
    type: 'ALBUM_LIKED', 
    albumId,
    targetUserId: albumOwnerId,
    title: albumTitle
  });

export const logWallComment = (
  userId: string,
  targetUserId: string,
  targetUserName: string
) =>
  createActivity({ 
    userId, 
    type: 'WALL_COMMENT', 
    targetUserId,
    title: targetUserName + "'s wall"
  });

export const logCampgroundFollowed = (
  userId: string, 
  campgroundId: string, 
  campgroundName: string
) =>
  createActivity({ 
    userId, 
    type: 'CAMPGROUND_FOLLOWED', 
    campgroundId, 
    title: campgroundName 
  });

export const logGroupCreated = (userId: string, groupName: string, groupId?: string) =>
  createActivity({ 
    userId, 
    type: 'GROUP_CREATED', 
    title: groupName,
    metadata: { groupId }
  });

export const logBadgeEarned = (userId: string, badgeName: string, badgeIcon?: string) =>
  createActivity({ 
    userId, 
    type: 'BADGE_EARNED', 
    title: badgeName,
    metadata: { icon: badgeIcon }
  });

export const logTripPlanned = (
  userId: string, 
  tripName: string, 
  destination?: string,
  campgroundId?: string,
  tripId?: string
) =>
  createActivity({ 
    userId, 
    type: 'TRIP_PLANNED', 
    campgroundId,
    title: tripName,
    content: destination,
    metadata: { tripId }
  });

export const logGearReview = (
  userId: string, 
  gearName: string, 
  rating: number,
  gearId?: string
) =>
  createActivity({ 
    userId, 
    type: 'GEAR_REVIEW', 
    title: gearName,
    content: String(rating) + ' stars',
    metadata: { gearId, rating }
  });

export const logRVUpdated = (userId: string, updateType: string) =>
  createActivity({ 
    userId, 
    type: 'RV_UPDATED', 
    title: updateType 
  });

export const logMutualFriendAdded = (
  userId: string,
  newFriendId: string,
  newFriendName: string
) =>
  createActivity({ 
    userId, 
    type: 'MUTUAL_FRIEND_ADDED', 
    targetUserId: newFriendId,
    title: newFriendName
  });


export const logEventCommented = (
  userId: string,
  eventId: string,
  eventTitle: string,
  commentPreview?: string
) =>
  createActivity({
    userId,
    type: 'EVENT_COMMENTED',
    eventId,
    title: eventTitle,
    content: commentPreview
  });

export default {
  createActivity,
  logRecipeCreated,
  logTripCreated,
  logTripJoined,
  logFriendAdded,
  logCheckIn,
  logReview,
  logPhotoUploaded,
  logAlbumCreated,
  logStickerEarned,
  logStateVisited,
  logThreadCreated,
  logThreadPost,
  logGearAdded,
  logGroupJoined,
  logWallPost,
  logAttractionAdded,
  logRVShowcaseUpdated,
  logEventCreated,
  logEventJoined,
  logEventUpdated,
  logRecipeLiked,
  logRecipeCommented,
  logPhotoLiked,
  logPhotoCommented,
  logAlbumLiked,
  logWallComment,
  logCampgroundFollowed,
  logGroupCreated,
  logBadgeEarned,
  logTripPlanned,
  logGearReview,
  logRVUpdated,
  logMutualFriendAdded,
  logEventCommented,
};
