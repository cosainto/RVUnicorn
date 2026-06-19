/**
 * Feed Source: Friend Photos
 * Network tab — public photos posted by friends.
 */
import { PrismaClient } from '@prisma/client';
import { FeedSource, FeedContext, RawFeedItem, registerSource } from '../feedRegistry';

const prisma = new PrismaClient() as any;

const source: FeedSource = {
  key: 'friend-photos',
  enabled: true,

  async fetch(ctx: FeedContext): Promise<RawFeedItem[]> {
    if (ctx.friendIds.length === 0) return [];

    const photos = await prisma.photo.findMany({
      where: {
        userId: { in: ctx.friendIds },
        visibility: 'PUBLIC',
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        imageUrl: true,
        caption: true,
        createdAt: true,
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        _count: { select: { likes: true, photoComments: true } },
      },
    });

    return photos.map((p: any) => ({
      sourceKey: 'friend-photos',
      entityType: 'photo',
      entityId: p.id,
      actorId: p.userId,
      createdAt: new Date(p.createdAt),
      payload: {
        preview: p.caption || 'Shared a photo',
        imageUrl: p.imageUrl,
        authorUsername: p.user?.username,
        authorFirstName: p.user?.firstName,
        authorAvatar: p.user?.profilePicture || null,
        likeCount: p._count?.likes || 0,
        commentCount: p._count?.photoComments || 0,
      },
    }));
  },
};

registerSource(source);
