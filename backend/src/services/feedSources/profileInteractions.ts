/**
 * Feed Source: Profile Interactions
 * Network tab — friend activity like new friendships, profile updates, wall posts.
 */
import { FeedSource, FeedContext, RawFeedItem, registerSource } from '../feedRegistry';

import { prisma } from '../../lib/prisma';

const PROFILE_ACTIVITY_TYPES = [
  'FRIEND_ADDED',
  'WALL_POST',
  'WALL_COMMENT',
  'BADGE_EARNED',
  'STATE_VISITED',
  'RV_SHOWCASE_UPDATED',
];

const source: FeedSource = {
  key: 'profile-interactions',
  enabled: true,

  async fetch(ctx: FeedContext): Promise<RawFeedItem[]> {
    if (ctx.friendIds.length === 0) return [];

    const activities = await prisma.activity.findMany({
      where: {
        userId: { in: ctx.friendIds },
        type: { in: PROFILE_ACTIVITY_TYPES },
        isPublic: true,
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
      },
    });

    return activities.map((a: any) => ({
      sourceKey: 'profile-interactions',
      entityType: 'activity',
      entityId: a.id,
      actorId: a.userId,
      createdAt: new Date(a.createdAt),
      payload: {
        preview: a.title || formatActivityType(a.type),
        body: a.content?.slice(0, 150),
        authorUsername: a.user?.username,
        authorFirstName: a.user?.firstName,
        authorAvatar: a.user?.profilePicture || null,
        activityType: a.type,
      },
    }));
  },
};

function formatActivityType(type: string): string {
  const labels: Record<string, string> = {
    FRIEND_ADDED: 'Made a new camping buddy',
    WALL_POST: 'Posted on a profile',
    WALL_COMMENT: 'Commented on a profile post',
    BADGE_EARNED: 'Earned a new badge',
    STATE_VISITED: 'Visited a new state',
    RV_SHOWCASE_UPDATED: 'Updated their rig showcase',
  };
  return labels[type] || 'Had some activity';
}

registerSource(source);
