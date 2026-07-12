/**
 * Feed Source: Community TripKits
 * Community tab — recently published TripKit itineraries.
 */
import { FeedSource, FeedContext, RawFeedItem, registerSource } from '../feedRegistry';

import { prisma } from '../../lib/prisma';

const source: FeedSource = {
  key: 'community-tripkits',
  enabled: true,

  async fetch(ctx: FeedContext): Promise<RawFeedItem[]> {
    const tripKits = await prisma.tripKit.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        creatorId: true,
        title: true,
        description: true,
        coverImageUrl: true,
        totalMiles: true,
        estimatedDays: true,
        rigType: true,
        tags: true,
        publishedAt: true,
        createdAt: true,
        creator: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        _count: { select: { purchases: true, saves: true } },
      },
    });

    return tripKits.map((tk: any) => ({
      sourceKey: 'community-tripkits',
      entityType: 'tripkit',
      entityId: tk.id,
      actorId: tk.creatorId,
      createdAt: new Date(tk.publishedAt || tk.createdAt),
      payload: {
        preview: tk.title || 'New TripKit',
        body: tk.description?.slice(0, 150),
        imageUrl: tk.coverImageUrl || null,
        authorUsername: tk.creator?.username,
        authorFirstName: tk.creator?.firstName,
        authorAvatar: tk.creator?.profilePicture || null,
        tripKitId: tk.id,
        totalMiles: tk.totalMiles,
        estimatedDays: tk.estimatedDays,
        rigType: tk.rigType,
        tags: tk.tags || [],
        likeCount: tk._count?.saves || 0,
        commentCount: tk._count?.purchases || 0,
      },
    }));
  },
};

registerSource(source);
