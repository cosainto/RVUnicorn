/**
 * Feed Source Registry — pluggable feed assembly with people-vs-things routing.
 *
 * THE ROUTING RULE:
 *   Network  = PEOPLE you're friends with, and their activity.
 *   Community = THINGS you follow that aren't a personal friendship.
 *   De-dup: an item authored by a friend is Network — even if it's about a
 *   followed rig or campground. No item appears in both tabs.
 */

import { prisma } from '../lib/prisma';

// ─── Types ─────────────────────────────────────────────────

export interface FeedContext {
  userId: string;
  friendIds: string[];
  friendIdSet: Set<string>;
  followedRigIds: string[];
  followedCampgroundIds: string[];
  subscribedThreadIds: string[];
}

export interface RawFeedItem {
  sourceKey: string;
  entityType: string;
  entityId: string;
  actorId: string | null;       // null = system/thing-generated
  createdAt: Date;
  payload: {
    preview: string;
    body?: string;
    imageUrl?: string | null;
    authorUsername?: string;
    authorFirstName?: string;
    authorAvatar?: string | null;
    tags?: string[];
    likeCount?: number;
    commentCount?: number;
    campgroundId?: string | null;
    rigId?: string | null;
    tripKitId?: string | null;
    [key: string]: any;
  };
}

export interface FeedSource {
  key: string;
  enabled: boolean;
  fetch(ctx: FeedContext): Promise<RawFeedItem[]>;
}

// ─── Registry ──────────────────────────────────────────────

const sources: FeedSource[] = [];

export function registerSource(source: FeedSource) {
  const existing = sources.findIndex(s => s.key === source.key);
  if (existing >= 0) sources[existing] = source;
  else sources.push(source);
}

// ─── Context Builder ───────────────────────────────────────

export async function buildFeedContext(userId: string): Promise<FeedContext> {
  const [friendships, rigFollows, campgroundFollows, threadSubs] = await Promise.all([
    prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] },
      select: { initiatorId: true, receiverId: true },
    }),
    prisma.rigFollow.findMany({
      where: { userId },
      select: { rigId: true },
    }),
    prisma.campgroundFollow.findMany({
      where: { userId },
      select: { campgroundId: true },
    }),
    prisma.threadSubscription.findMany({
      where: { userId },
      select: { postId: true },
    }),
  ]);

  const friendIds: string[] = friendships.map((f: any) =>
    f.initiatorId === userId ? f.receiverId : f.initiatorId
  );
  const friendIdSet = new Set<string>(friendIds);

  return {
    userId,
    friendIds,
    friendIdSet,
    followedRigIds: rigFollows.map((r: any) => r.rigId),
    followedCampgroundIds: campgroundFollows.map((c: any) => c.campgroundId),
    subscribedThreadIds: threadSubs.map((t: any) => t.postId),
  };
}

// ─── Feed Assembly ─────────────────────────────────────────

const FEED_LIMIT = 20;

/**
 * Route an item to a tab using the people-vs-things rule.
 * - actorId is a friend → network
 * - actorId is null or not a friend → community
 */
function routeItem(item: RawFeedItem, friendIdSet: Set<string>): 'network' | 'community' {
  if (item.actorId && friendIdSet.has(item.actorId)) return 'network';
  return 'community';
}

/**
 * De-duplicate items by (entityType, entityId).
 * Keeps the newest occurrence.
 */
function dedup(items: RawFeedItem[]): RawFeedItem[] {
  const seen = new Map<string, RawFeedItem>();
  for (const item of items) {
    const key = `${item.entityType}:${item.entityId}`;
    const existing = seen.get(key);
    if (!existing || item.createdAt > existing.createdAt) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

async function fetchAllSources(ctx: FeedContext): Promise<RawFeedItem[]> {
  const enabled = sources.filter(s => s.enabled);
  const results = await Promise.allSettled(
    enabled.map(s =>
      s.fetch(ctx).catch(err => {
        console.error(`[FeedRegistry] source "${s.key}" failed:`, err.message);
        return [] as RawFeedItem[];
      })
    )
  );
  const items: RawFeedItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }
  return items;
}

export async function getNetworkFeed(userId: string, ctx?: FeedContext) {
  const feedCtx = ctx || await buildFeedContext(userId);
  if (feedCtx.friendIds.length === 0) {
    return { items: [], newestAt: null };
  }

  const allItems = await fetchAllSources(feedCtx);
  const networkItems = allItems.filter(i => routeItem(i, feedCtx.friendIdSet) === 'network');
  const deduped = dedup(networkItems);
  deduped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const page = deduped.slice(0, FEED_LIMIT);

  return {
    items: page,
    newestAt: page[0]?.createdAt || null,
  };
}

export async function getCommunityFeed(userId: string, ctx?: FeedContext) {
  const feedCtx = ctx || await buildFeedContext(userId);
  const allItems = await fetchAllSources(feedCtx);
  const communityItems = allItems.filter(i => routeItem(i, feedCtx.friendIdSet) === 'community');
  const deduped = dedup(communityItems);
  deduped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const page = deduped.slice(0, FEED_LIMIT);

  return {
    items: page,
    newestAt: page[0]?.createdAt || null,
  };
}

/**
 * Get both feeds in a single pass (more efficient — fetches sources once).
 */
export async function getBothFeeds(userId: string) {
  const ctx = await buildFeedContext(userId);
  const allItems = await fetchAllSources(ctx);

  const networkRaw: RawFeedItem[] = [];
  const communityRaw: RawFeedItem[] = [];

  for (const item of allItems) {
    if (routeItem(item, ctx.friendIdSet) === 'network') networkRaw.push(item);
    else communityRaw.push(item);
  }

  const networkDeduped = dedup(networkRaw);
  networkDeduped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const communityDeduped = dedup(communityRaw);
  communityDeduped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    network: {
      items: networkDeduped.slice(0, FEED_LIMIT),
      newestAt: networkDeduped[0]?.createdAt || null,
    },
    community: {
      items: communityDeduped.slice(0, FEED_LIMIT),
      newestAt: communityDeduped[0]?.createdAt || null,
    },
    ctx,
  };
}
