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
  | 'RV_SHOWCASE_UPDATED';

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
  metadata?: Record<string, any>;
  isPublic?: boolean;
}

export async function createActivity(params: CreateActivityParams) {
  try {
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
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        isPublic: params.isPublic ?? true,
      },
    });
    return activity;
  } catch (error) {
    console.error('Failed to create activity:', error);
    // Don't throw - activity creation should not break the main action
    return null;
  }
}

// Convenience functions for common activities
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
  createActivity({ userId, type: 'CAMPGROUND_REVIEW', campgroundId, title: campgroundName, content: `${rating} stars` });

export const logPhotoUploaded = (userId: string, albumTitle?: string) =>
  createActivity({ userId, type: 'PHOTO_UPLOADED', title: albumTitle || 'a photo' });

export const logAlbumCreated = (userId: string, title: string) =>
  createActivity({ userId, type: 'ALBUM_CREATED', title });

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
  createActivity({ userId, type: 'RV_SHOWCASE_UPDATED', title: `Updated RV showcase with ${photoCount} photo${photoCount !== 1 ? 's' : ''}` });

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
};
