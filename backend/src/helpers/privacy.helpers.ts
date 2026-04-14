// privacy.helpers.ts
// Add this file to: ~/Downloads/kindletribe-mvp/backend/src/helpers/privacy.helpers.ts

import { prisma } from '../index';
const db = prisma as any;

/**
 * Check if two users are friends (accepted friendship)
 */
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const friendship = await db.friendship.findFirst({
    where: {
      OR: [
        { initiatorId: userId1, receiverId: userId2, status: 'ACCEPTED' },
        { initiatorId: userId2, receiverId: userId1, status: 'ACCEPTED' }
      ]
    }
  });
  return !!friendship;
}

/**
 * Check if a user is blocked (either direction)
 */
export async function isBlocked(userId1: string, userId2: string): Promise<boolean> {
  const block = await db.blockedUser.findFirst({
    where: {
      OR: [
        { userId: userId1, blockedUserId: userId2 },
        { userId: userId2, blockedUserId: userId1 }
      ]
    }
  });
  return !!block;
}

/**
 * Check if viewer can see target user's content based on privacy setting
 * @param viewerId - The user viewing the content (can be null for anonymous)
 * @param targetUserId - The user who owns the content
 * @param privacySetting - 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
 */
export async function canViewContent(
  viewerId: string | null,
  targetUserId: string,
  privacySetting: string
): Promise<boolean> {
  // Owner can always see their own content
  if (viewerId === targetUserId) return true;
  
  // Public content is visible to everyone
  if (privacySetting === 'PUBLIC') return true;
  
  // Private content is only visible to owner
  if (privacySetting === 'PRIVATE') return false;
  
  // FRIENDS - check if they're friends
  if (privacySetting === 'FRIENDS' && viewerId) {
    return await areFriends(viewerId, targetUserId);
  }
  
  return false;
}

/**
 * Get user's privacy settings
 */
export async function getUserPrivacySettings(userId: string) {
  let preferences = await db.userPreferences.findUnique({
    where: { userId }
  });

  // Return defaults if no preferences exist
  if (!preferences) {
    return {
      profileVisibility: 'PUBLIC',
      friendRequestSetting: 'EVERYONE',
      showOnlineStatus: true,
      showLastActive: true,
      allowTagging: true,
      allowWallPosts: true,
      showTravelMap: 'FRIENDS',
      showRecipes: 'PUBLIC',
      showGear: 'FRIENDS',
      showRVDetails: 'FRIENDS'
    };
  }

  return preferences;
}

/**
 * Check if viewer can send friend request to target
 */
export async function canSendFriendRequest(
  viewerId: string,
  targetUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Can't friend yourself
  if (viewerId === targetUserId) {
    return { allowed: false, reason: 'Cannot send friend request to yourself' };
  }

  // Check if blocked
  if (await isBlocked(viewerId, targetUserId)) {
    return { allowed: false, reason: 'Cannot send friend request' };
  }

  // Check target's privacy settings
  const targetSettings = await getUserPrivacySettings(targetUserId);
  
  if (targetSettings.friendRequestSetting === 'NONE') {
    return { allowed: false, reason: 'This user is not accepting friend requests' };
  }

  if (targetSettings.friendRequestSetting === 'FRIENDS_OF_FRIENDS') {
    // Check if they share a mutual friend
    const viewerFriends = await db.friendship.findMany({
      where: {
        OR: [
          { initiatorId: viewerId, status: 'ACCEPTED' },
          { receiverId: viewerId, status: 'ACCEPTED' }
        ]
      },
      select: {
        initiatorId: true,
        receiverId: true
      }
    });

    const viewerFriendIds = viewerFriends.map((f: any) => 
      f.initiatorId === viewerId ? f.receiverId : f.initiatorId
    );

    const targetFriends = await db.friendship.findMany({
      where: {
        OR: [
          { initiatorId: targetUserId, status: 'ACCEPTED' },
          { receiverId: targetUserId, status: 'ACCEPTED' }
        ]
      },
      select: {
        initiatorId: true,
        receiverId: true
      }
    });

    const targetFriendIds = targetFriends.map((f: any) => 
      f.initiatorId === targetUserId ? f.receiverId : f.initiatorId
    );

    const hasMutualFriend = viewerFriendIds.some((id: any) => targetFriendIds.includes(id));
    
    if (!hasMutualFriend) {
      return { allowed: false, reason: 'This user only accepts friend requests from friends of friends' };
    }
  }

  return { allowed: true };
}

/**
 * Filter profile data based on privacy settings
 */
export async function filterProfileForViewer(
  profile: any,
  viewerId: string | null,
  preferences: any
): Promise<any> {
  const isOwn = viewerId === profile.id;
  const isFriend = viewerId ? await areFriends(viewerId, profile.id) : false;

  // Check if blocked
  if (viewerId && await isBlocked(viewerId, profile.id)) {
    return null; // Return null to indicate profile should not be shown
  }

  // Check profile visibility
  if (!isOwn) {
    if (preferences.profileVisibility === 'PRIVATE') {
      return {
        id: profile.id,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        profilePicture: profile.profilePicture,
        _private: true
      };
    }

    if (preferences.profileVisibility === 'FRIENDS' && !isFriend) {
      return {
        id: profile.id,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        profilePicture: profile.profilePicture,
        _friendsOnly: true
      };
    }
  }

  // Full profile with selective field hiding
  const filteredProfile = { ...profile };

  // Hide RV details if needed
  if (!isOwn && !await canViewContent(viewerId, profile.id, preferences.showRVDetails)) {
    delete filteredProfile.rvType;
    delete filteredProfile.rvMake;
    delete filteredProfile.rvModel;
    delete filteredProfile.rvYear;
    delete filteredProfile.rvLength;
    delete filteredProfile.rvSleeps;
    delete filteredProfile.rvSlideouts;
    delete filteredProfile.rvWeight;
    delete filteredProfile.rvDescription;
    delete filteredProfile.rvFeatures;
  }

  return filteredProfile;
}
