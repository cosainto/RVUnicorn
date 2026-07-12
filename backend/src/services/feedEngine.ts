/**
 * Feed Scoring Engine — builds personalized, following, and trending feeds.
 *
 * For You feed mixes 4 signals:
 *   50% FOLLOWING — posts from users/rigs followed
 *   20% FRIEND_ACTIVITY — posts friends engaged with
 *   20% RELEVANCE — rig match, state/campground overlap
 *   10% TRENDING — high comment velocity
 */

import { prisma } from '../lib/prisma';

// Simple in-memory cache with TTL
const feedCache = new Map<string, { data: any; expires: number }>();
function getCached(key: string): any | null {
  const entry = feedCache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data;
  feedCache.delete(key);
  return null;
}
function setCache(key: string, data: any, ttlMs: number) {
  feedCache.set(key, { data, expires: Date.now() + ttlMs });
}

// ─── Helpers ────────────────────────────────────────────────

async function getFollowedUserIds(userId: string): Promise<string[]> {
  const [friendships, rigFollows] = await Promise.all([
    prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] },
      select: { initiatorId: true, receiverId: true },
    }),
    prisma.rigFollow.findMany({
      where: { userId },
      include: { rig: { select: { ownerId: true } } },
    }),
  ]);

  const ids = new Set<string>();
  friendships.forEach((f: any) => {
    ids.add(f.initiatorId === userId ? f.receiverId : f.initiatorId);
  });
  rigFollows.forEach((f: any) => {
    if (f.rig?.ownerId) ids.add(f.rig.ownerId);
  });
  return Array.from(ids);
}

function hoursOld(date: Date): number {
  return Math.max(1, (Date.now() - new Date(date).getTime()) / 3600000);
}

function recencyBonus(createdAt: Date): number {
  const hours = hoursOld(createdAt);
  if (hours < 6) return 50;
  if (hours < 24) return 30;
  if (hours < 72) return 10;
  return 0;
}

interface ScoredPost {
  post: any;
  score: number;
  signal: 'FOLLOWING' | 'FRIEND_ACTIVITY' | 'RELEVANCE' | 'TRENDING';
  reason?: string;
  friendActivity?: { actorNames: string[]; action: string };
}

// ─── FOR YOU FEED ───────────────────────────────────────────

export async function buildForYouFeed(userId: string, cursor?: string, limit = 20): Promise<any[]> {
  const cacheKey = `foryou:${userId}:${cursor || '0'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const followedIds = await getFollowedUserIds(userId);
  const cutoff = new Date(Date.now() - 7 * 86400000); // 7 days
  const cursorDate = cursor ? new Date(cursor) : new Date();

  // Fetch user profile for relevance scoring
  const userProfile = await prisma.user.findUnique({
    where: { id: userId },
    select: { rvMake: true, rvModel: true, rvType: true, homeState: true },
  });

  const userStates = await prisma.stateVisit.findMany({
    where: { userId },
    select: { state: true },
  }).then((v: any[]) => new Set(v.map(s => s.state)));

  const userCampgrounds = await prisma.campgroundFollow.findMany({
    where: { userId },
    select: { campgroundId: true },
  }).then((f: any[]) => new Set(f.map(c => c.campgroundId)));

  // SIGNAL 1: FOLLOWING (50%)
  const followingPosts = followedIds.length > 0 ? await prisma.feedPost.findMany({
    where: {
      authorId: { in: followedIds },
      isPublic: true, isHidden: false,
      createdAt: { gte: cutoff, lt: cursorDate },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  }) : [];

  const followingScored: ScoredPost[] = followingPosts.map((p: any) => ({
    post: p,
    score: 100 + (p.commentCount * 3) + (p.likeCount * 1) + recencyBonus(p.createdAt),
    signal: 'FOLLOWING' as const,
  }));

  // SIGNAL 2: FRIEND ACTIVITY (20%)
  let friendActivityScored: ScoredPost[] = [];
  if (followedIds.length > 0) {
    // Posts that friends liked or commented on recently
    const friendLikes = await prisma.feedPostLike.findMany({
      where: { userId: { in: followedIds }, createdAt: { gte: new Date(Date.now() - 86400000) } },
      select: { postId: true, userId: true },
      take: 50,
    });
    const friendComments = await prisma.feedPostComment.findMany({
      where: { userId: { in: followedIds }, createdAt: { gte: new Date(Date.now() - 86400000) } },
      select: { postId: true, userId: true },
      take: 50,
    });

    // Group by postId
    const engagedPostIds = new Map<string, { actorIds: Set<string>; action: string }>();
    friendLikes.forEach((l: any) => {
      const e = engagedPostIds.get(l.postId) || { actorIds: new Set(), action: 'liked' };
      e.actorIds.add(l.userId);
      engagedPostIds.set(l.postId, e);
    });
    friendComments.forEach((c: any) => {
      const e = engagedPostIds.get(c.postId) || { actorIds: new Set(), action: 'commented' };
      e.actorIds.add(c.userId);
      e.action = 'commented'; // comment > like
      engagedPostIds.set(c.postId, e);
    });

    // Exclude posts user already follows author of
    const followedSet = new Set(followedIds);
    const candidatePostIds = Array.from(engagedPostIds.keys());
    if (candidatePostIds.length > 0) {
      const posts = await prisma.feedPost.findMany({
        where: { id: { in: candidatePostIds }, isPublic: true, isHidden: false, authorId: { notIn: [userId, ...followedIds] } },
      });

      // Get actor names
      const allActorIds = new Set<string>();
      engagedPostIds.forEach(e => e.actorIds.forEach(id => allActorIds.add(id)));
      const actors = await prisma.user.findMany({
        where: { id: { in: Array.from(allActorIds) } },
        select: { id: true, firstName: true },
      });
      const actorNameMap = new Map(actors.map((a: any) => [a.id, a.firstName]));

      friendActivityScored = posts.map((p: any) => {
        const engagement = engagedPostIds.get(p.id)!;
        const actorNames = Array.from(engagement.actorIds).map(id => actorNameMap.get(id) || 'Someone').slice(0, 2);
        return {
          post: p,
          score: 80 + engagement.actorIds.size * 10 + recencyBonus(p.createdAt),
          signal: 'FRIEND_ACTIVITY' as const,
          reason: `${actorNames.join(' and ')} ${engagement.action}`,
          friendActivity: { actorNames, action: engagement.action },
        };
      });
    }
  }

  // SIGNAL 3: RELEVANCE (20%)
  const relevancePosts = await prisma.feedPost.findMany({
    where: {
      authorId: { not: userId, notIn: followedIds },
      isPublic: true, isHidden: false,
      createdAt: { gte: cutoff, lt: cursorDate },
      OR: [
        { campgroundId: { in: Array.from(userCampgrounds).slice(0, 50) } },
        { tags: { hasSome: Array.from(userStates).slice(0, 10) } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  }).catch(() => []);

  // Score relevance posts against user profile
  const relevanceScored: ScoredPost[] = [];
  for (const p of relevancePosts) {
    let score = 50;
    let reason = '';

    // Check author's rig match
    if (userProfile?.rvMake) {
      const author = await prisma.user.findUnique({
        where: { id: p.authorId },
        select: { rvMake: true, rvModel: true, rvType: true },
      });
      if (author?.rvMake === userProfile.rvMake && author?.rvModel === userProfile.rvModel) {
        score += 40;
        reason = `Same rig as you`;
      } else if (author?.rvType === userProfile.rvType) {
        score += 20;
        reason = `Fellow ${userProfile.rvType?.replace('_', ' ')} owner`;
      }
    }

    if (p.campgroundId && userCampgrounds.has(p.campgroundId)) {
      score += 25;
      reason = reason || 'From a campground you love';
    }

    const stateOverlap = (p.tags || []).filter((t: string) => userStates.has(t));
    if (stateOverlap.length > 0) {
      score += Math.min(15, stateOverlap.length * 5);
      reason = reason || `You visited ${stateOverlap[0]}`;
    }

    score += recencyBonus(p.createdAt);

    relevanceScored.push({ post: p, score, signal: 'RELEVANCE', reason });
  }

  // SIGNAL 4: TRENDING (10%)
  const trendingPosts = await prisma.feedPost.findMany({
    where: {
      isPublic: true, isHidden: false,
      createdAt: { gte: new Date(Date.now() - 48 * 3600000) },
      commentCount: { gte: 3 },
    },
    orderBy: { commentCount: 'desc' },
    take: 10,
  });

  const trendingScored: ScoredPost[] = trendingPosts.map((p: any) => ({
    post: p,
    score: (p.commentCount / hoursOld(p.createdAt)) * 100,
    signal: 'TRENDING' as const,
    reason: `${p.commentCount} comments`,
  }));

  // Mix by approximate ratio: 50/20/20/10
  const all = [
    ...followingScored,
    ...friendActivityScored,
    ...relevanceScored,
    ...trendingScored,
  ];

  // Deduplicate by postId, keep highest score
  const deduped = new Map<string, ScoredPost>();
  all.forEach(item => {
    const existing = deduped.get(item.post.id);
    if (!existing || item.score > existing.score) {
      deduped.set(item.post.id, item);
    }
  });

  const sorted = Array.from(deduped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Enrich with author data
  const authorIds = [...new Set(sorted.map(s => s.post.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true, rvType: true },
  });
  const authorMap = new Map(authors.map((a: any) => [a.id, a]));

  const result = sorted.map(s => ({
    ...s.post,
    author: authorMap.get(s.post.authorId) || null,
    _signal: s.signal,
    _reason: s.reason,
    _score: s.score,
    _friendActivity: s.friendActivity,
  }));

  setCache(cacheKey, result, 15 * 60 * 1000); // 15 min cache
  return result;
}

// ─── FOLLOWING FEED ─────────────────────────────────────────

export async function buildFollowingFeed(userId: string, cursor?: string, limit = 20): Promise<any[]> {
  const followedIds = await getFollowedUserIds(userId);
  if (followedIds.length === 0) return [];

  const cursorDate = cursor ? new Date(cursor) : new Date();

  const posts = await prisma.feedPost.findMany({
    where: {
      authorId: { in: followedIds },
      isPublic: true, isHidden: false,
      createdAt: { lt: cursorDate },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const authorIds = [...new Set(posts.map((p: any) => p.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true },
  });
  const authorMap = new Map(authors.map((a: any) => [a.id, a]));

  return posts.map((p: any) => ({
    ...p,
    author: authorMap.get(p.authorId) || null,
    _signal: 'FOLLOWING',
  }));
}

// ─── TRENDING FEED ──────────────────────────────────────────

export async function buildTrendingFeed(cursor?: string, limit = 20): Promise<any[]> {
  const posts = await prisma.feedPost.findMany({
    where: {
      isPublic: true, isHidden: false,
      createdAt: { gte: new Date(Date.now() - 48 * 3600000) },
      commentCount: { gte: 1 },
    },
    orderBy: { commentCount: 'desc' },
    take: limit * 2, // fetch extra to sort by velocity
  });

  const scored = posts.map((p: any) => ({
    ...p,
    _velocity: p.commentCount / hoursOld(p.createdAt),
    _signal: 'TRENDING',
    _reason: `${p.commentCount} comments`,
  }));

  scored.sort((a: any, b: any) => b._velocity - a._velocity);
  const top = scored.slice(0, limit);

  const authorIds = [...new Set(top.map((p: any) => p.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true },
  });
  const authorMap = new Map(authors.map((a: any) => [a.id, a]));

  return top.map((p: any) => ({ ...p, author: authorMap.get(p.authorId) || null }));
}

// ─── HOT STRIP ──────────────────────────────────────────────

export async function getHotStrip(): Promise<any[]> {
  const cached = getCached('hot-strip');
  if (cached) return cached;

  const posts = await prisma.feedPost.findMany({
    where: {
      isPublic: true, isHidden: false,
      createdAt: { gte: new Date(Date.now() - 24 * 3600000) },
      commentCount: { gte: 2 },
    },
    orderBy: { commentCount: 'desc' },
    take: 5,
  });

  const authorIds = [...new Set(posts.map((p: any) => p.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, firstName: true, username: true, profilePicture: true },
  });
  const authorMap = new Map(authors.map((a: any) => [a.id, a]));

  const result = posts.map((p: any) => ({ ...p, author: authorMap.get(p.authorId) || null }));
  setCache('hot-strip', result, 10 * 60 * 1000); // 10 min cache
  return result;
}
