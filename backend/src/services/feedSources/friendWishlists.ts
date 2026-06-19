/**
 * Feed Source: Friend Wishlist Adds
 * Network tab — friends who added campgrounds to their wishlist.
 */
import { PrismaClient } from '@prisma/client';
import { FeedSource, FeedContext, RawFeedItem, registerSource } from '../feedRegistry';

const prisma = new PrismaClient() as any;

const source: FeedSource = {
  key: 'friend-wishlists',
  enabled: true,

  async fetch(ctx: FeedContext): Promise<RawFeedItem[]> {
    if (ctx.friendIds.length === 0) return [];

    const wishlists = await prisma.campgroundWishlist.findMany({
      where: {
        userId: { in: ctx.friendIds },
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        campgroundId: true,
        createdAt: true,
        campground: { select: { id: true, name: true, imageUrl: true, state: true } },
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
      },
    });

    return wishlists.map((w: any) => ({
      sourceKey: 'friend-wishlists',
      entityType: 'wishlist-add',
      entityId: w.id,
      actorId: w.userId,
      createdAt: new Date(w.createdAt),
      payload: {
        preview: `Added ${w.campground?.name || 'a campground'} to their wishlist`,
        imageUrl: w.campground?.imageUrl || null,
        authorUsername: w.user?.username,
        authorFirstName: w.user?.firstName,
        authorAvatar: w.user?.profilePicture || null,
        campgroundId: w.campgroundId,
        campgroundName: w.campground?.name,
        campgroundState: w.campground?.state,
      },
    }));
  },
};

registerSource(source);
