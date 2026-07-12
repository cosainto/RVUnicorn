/**
 * Feed Enrichment Engine — batched social-context queries with threshold + silent fallback.
 *
 * Rules:
 *   - Compute enrichment in bulk (no N+1).
 *   - Show enriched version ONLY when count >= MIN_ENRICHMENT_COUNT.
 *   - NEVER render "0 people in your network…" — fall back silently to plain card.
 *   - Enrichment is progressive enhancement, not the default.
 */
import { RawFeedItem } from './feedRegistry';

import { prisma } from '../lib/prisma';

/** Minimum count to show enrichment. Below this, silently fall back to plain card. */
export const MIN_ENRICHMENT_COUNT = 2;

export interface EnrichmentData {
  friendsVisitedCount?: number;
  friendsVisitedAvatars?: string[];
  friendsWishlistedCount?: number;
  travelersCompletedCount?: number;
  rigFollowerCount?: number;
}

export type EnrichmentMap = Map<string, EnrichmentData>;

// ─── In-memory enrichment cache (5-min TTL) ────────────────

const enrichCache = new Map<string, { data: EnrichmentMap; expiresAt: number }>();
const ENRICHMENT_TTL_MS = 5 * 60 * 1000;

function getCachedEnrichment(key: string): EnrichmentMap | null {
  const entry = enrichCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  if (entry) enrichCache.delete(key);
  return null;
}

function setCachedEnrichment(key: string, data: EnrichmentMap) {
  enrichCache.set(key, { data, expiresAt: Date.now() + ENRICHMENT_TTL_MS });
  if (enrichCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of enrichCache) {
      if (now > v.expiresAt) enrichCache.delete(k);
    }
  }
}

// ─── Batch Enrichment Queries ──────────────────────────────

async function batchFriendsVisited(
  campgroundIds: string[],
  friendIds: string[]
): Promise<Map<string, { count: number; avatars: string[] }>> {
  const result = new Map<string, { count: number; avatars: string[] }>();
  if (campgroundIds.length === 0 || friendIds.length === 0) return result;

  const [checkins, visits] = await Promise.all([
    prisma.checkIn.findMany({
      where: { campgroundId: { in: campgroundIds }, userId: { in: friendIds } },
      distinct: ['userId', 'campgroundId'],
      select: {
        campgroundId: true,
        user: { select: { profilePicture: true } },
      },
    }),
    prisma.rigCampsiteVisit
      ? prisma.rigCampsiteVisit.findMany({
          where: { campgroundId: { in: campgroundIds }, userId: { in: friendIds } },
          distinct: ['userId', 'campgroundId'],
          select: {
            campgroundId: true,
            user: { select: { profilePicture: true } },
          },
        }).catch(() => [])
      : [],
  ]);

  for (const row of [...checkins, ...visits]) {
    const cgId = row.campgroundId;
    if (!cgId) continue;
    const entry = result.get(cgId) || { count: 0, avatars: [] };
    entry.count++;
    if (row.user?.profilePicture && entry.avatars.length < 3) {
      entry.avatars.push(row.user.profilePicture);
    }
    result.set(cgId, entry);
  }

  return result;
}

async function batchFriendsWishlisted(
  campgroundIds: string[],
  friendIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (campgroundIds.length === 0 || friendIds.length === 0) return result;

  const wishlists = await prisma.campgroundWishlist.findMany({
    where: { campgroundId: { in: campgroundIds }, userId: { in: friendIds } },
    select: { campgroundId: true },
  });

  for (const w of wishlists) {
    result.set(w.campgroundId, (result.get(w.campgroundId) || 0) + 1);
  }
  return result;
}

async function batchTripKitCompletions(
  tripKitIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (tripKitIds.length === 0) return result;

  const purchases = await prisma.tripKitPurchase.groupBy({
    by: ['tripKitId'],
    where: { tripKitId: { in: tripKitIds } },
    _count: { _all: true },
  });

  for (const p of purchases) {
    result.set(p.tripKitId, p._count._all);
  }
  return result;
}

async function batchRigFollowerCounts(
  rigIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (rigIds.length === 0) return result;

  const counts = await prisma.rigFollow.groupBy({
    by: ['rigId'],
    where: { rigId: { in: rigIds } },
    _count: { _all: true },
  });

  for (const c of counts) {
    result.set(c.rigId, c._count._all);
  }
  return result;
}

// ─── Main Enrichment Function ──────────────────────────────

/**
 * Enrich feed items in bulk. Returns a map of entityId → EnrichmentData.
 * Only includes entries that clear the MIN_ENRICHMENT_COUNT threshold.
 */
export async function enrichFeedItems(
  items: RawFeedItem[],
  friendIds: string[]
): Promise<EnrichmentMap> {
  const cacheKey = items.map(i => i.entityId).sort().join(',').slice(0, 200);
  const cached = getCachedEnrichment(cacheKey);
  if (cached) return cached;

  // Extract unique entity IDs by type
  const campgroundIds = new Set<string>();
  const rigIds = new Set<string>();
  const tripKitIds = new Set<string>();

  for (const item of items) {
    if (item.payload.campgroundId) campgroundIds.add(item.payload.campgroundId);
    if (item.payload.rigId) rigIds.add(item.payload.rigId);
    if (item.payload.tripKitId) tripKitIds.add(item.payload.tripKitId);
  }

  // Run all batch queries in parallel
  const [friendsVisited, friendsWishlisted, tripKitCompletions, rigFollowers] = await Promise.all([
    batchFriendsVisited(Array.from(campgroundIds), friendIds),
    batchFriendsWishlisted(Array.from(campgroundIds), friendIds),
    batchTripKitCompletions(Array.from(tripKitIds)),
    batchRigFollowerCounts(Array.from(rigIds)),
  ]);

  // Build enrichment map, applying threshold
  const enrichments: EnrichmentMap = new Map();

  for (const item of items) {
    const data: EnrichmentData = {};
    let hasEnrichment = false;

    // Friends visited this campground
    if (item.payload.campgroundId) {
      const visited = friendsVisited.get(item.payload.campgroundId);
      if (visited && visited.count >= MIN_ENRICHMENT_COUNT) {
        data.friendsVisitedCount = visited.count;
        data.friendsVisitedAvatars = visited.avatars;
        hasEnrichment = true;
      }

      const wishlistedCount = friendsWishlisted.get(item.payload.campgroundId) || 0;
      if (wishlistedCount >= MIN_ENRICHMENT_COUNT) {
        data.friendsWishlistedCount = wishlistedCount;
        hasEnrichment = true;
      }
    }

    // TripKit completions
    if (item.payload.tripKitId) {
      const completions = tripKitCompletions.get(item.payload.tripKitId) || 0;
      if (completions >= MIN_ENRICHMENT_COUNT) {
        data.travelersCompletedCount = completions;
        hasEnrichment = true;
      }
    }

    // Rig follower count
    if (item.payload.rigId) {
      const followers = rigFollowers.get(item.payload.rigId) || 0;
      if (followers >= MIN_ENRICHMENT_COUNT) {
        data.rigFollowerCount = followers;
        hasEnrichment = true;
      }
    }

    if (hasEnrichment) {
      enrichments.set(item.entityId, data);
    }
  }

  setCachedEnrichment(cacheKey, enrichments);
  return enrichments;
}
