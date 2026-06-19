/**
 * Feed Source: Friend Check-ins
 * Network tab — friends who checked in at campgrounds.
 */
import { PrismaClient } from '@prisma/client';
import { FeedSource, FeedContext, RawFeedItem, registerSource } from '../feedRegistry';

const prisma = new PrismaClient() as any;

const source: FeedSource = {
  key: 'friend-checkins',
  enabled: true,

  async fetch(ctx: FeedContext): Promise<RawFeedItem[]> {
    if (ctx.friendIds.length === 0) return [];

    const checkins = await prisma.checkIn.findMany({
      where: {
        userId: { in: ctx.friendIds },
        campgroundId: { not: null },
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        userId: true,
        campgroundId: true,
        isActive: true,
        checkInDate: true,
        siteNumber: true,
        createdAt: true,
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        campground: { select: { id: true, name: true, imageUrl: true, state: true } },
      },
    });

    return checkins.map((c: any) => ({
      sourceKey: 'friend-checkins',
      entityType: 'checkin',
      entityId: c.id,
      actorId: c.userId,
      createdAt: new Date(c.createdAt),
      payload: {
        preview: c.isActive
          ? `Checked in at ${c.campground?.name || 'a campground'}`
          : `Visited ${c.campground?.name || 'a campground'}`,
        imageUrl: c.campground?.imageUrl || null,
        authorUsername: c.user?.username,
        authorFirstName: c.user?.firstName,
        authorAvatar: c.user?.profilePicture || null,
        campgroundId: c.campgroundId,
        campgroundName: c.campground?.name,
        campgroundState: c.campground?.state,
        isActive: c.isActive,
        siteNumber: c.siteNumber,
      },
    }));
  },
};

registerSource(source);
