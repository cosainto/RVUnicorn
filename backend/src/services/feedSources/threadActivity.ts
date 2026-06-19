/**
 * Feed Source: Thread Activity
 * Community tab — activity in subscribed threads + trending community threads.
 */
import { PrismaClient } from '@prisma/client';
import { FeedSource, FeedContext, RawFeedItem, registerSource } from '../feedRegistry';

const prisma = new PrismaClient() as any;

const source: FeedSource = {
  key: 'thread-activity',
  enabled: true,

  async fetch(ctx: FeedContext): Promise<RawFeedItem[]> {
    const [subscribedPosts, trendingPosts] = await Promise.all([
      // Posts the user is subscribed to with recent activity
      ctx.subscribedThreadIds.length > 0
        ? prisma.feedPost.findMany({
            where: {
              id: { in: ctx.subscribedThreadIds },
              isPublic: true,
              isHidden: false,
              updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: {
              id: true,
              authorId: true,
              content: true,
              postType: true,
              photoUrls: true,
              tags: true,
              likeCount: true,
              commentCount: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : [],

      // Trending community threads (high engagement in last 3 days)
      prisma.feedPost.findMany({
        where: {
          isPublic: true,
          isHidden: false,
          authorId: { not: ctx.userId },
          createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
          commentCount: { gte: 3 },
        },
        orderBy: { commentCount: 'desc' },
        take: 10,
        select: {
          id: true,
          authorId: true,
          content: true,
          postType: true,
          photoUrls: true,
          tags: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
        },
      }),
    ]);

    const subscribedItems: RawFeedItem[] = subscribedPosts.map((p: any) => ({
      sourceKey: 'thread-activity',
      entityType: 'thread',
      entityId: p.id,
      actorId: p.authorId,
      createdAt: new Date(p.updatedAt || p.createdAt),
      payload: {
        preview: p.content?.slice(0, 80) || 'Thread activity',
        body: p.content?.slice(0, 150),
        imageUrl: p.photoUrls?.[0] || null,
        tags: p.tags || [],
        likeCount: p.likeCount || 0,
        commentCount: p.commentCount || 0,
        postType: p.postType,
        isSubscribed: true,
      },
    }));

    const trendingItems: RawFeedItem[] = trendingPosts.map((p: any) => ({
      sourceKey: 'thread-activity',
      entityType: 'thread',
      entityId: p.id,
      actorId: p.authorId,
      createdAt: new Date(p.createdAt),
      payload: {
        preview: p.content?.slice(0, 80) || 'Trending discussion',
        body: p.content?.slice(0, 150),
        imageUrl: p.photoUrls?.[0] || null,
        tags: p.tags || [],
        likeCount: p.likeCount || 0,
        commentCount: p.commentCount || 0,
        postType: p.postType,
        isTrending: true,
      },
    }));

    // Merge, de-dup by entityId (subscribed takes priority)
    const seen = new Set(subscribedItems.map(i => i.entityId));
    const uniqueTrending = trendingItems.filter(i => !seen.has(i.entityId));

    return [...subscribedItems, ...uniqueTrending];
  },
};

registerSource(source);
