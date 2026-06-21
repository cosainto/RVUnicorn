/**
 * Feed Source: Followed Rig Updates
 * Community tab — posts and mods from rigs the user follows (where owner is NOT a friend).
 * If the rig owner IS a friend, the routing rule sends it to Network automatically.
 */
import { PrismaClient } from '@prisma/client';
import { FeedSource, FeedContext, RawFeedItem, registerSource } from '../feedRegistry';

const prisma = new PrismaClient() as any;

const source: FeedSource = {
  key: 'rig-updates',
  enabled: true,

  async fetch(ctx: FeedContext): Promise<RawFeedItem[]> {
    if (ctx.followedRigIds.length === 0) return [];

    const [rigPosts, rigMods] = await Promise.all([
      prisma.rigPost.findMany({
        where: {
          rigId: { in: ctx.followedRigIds },
          isPublic: true,
          OR: [{ visibility: 'PUBLIC' }, { visibility: 'BOTH' }, { visibility: null }],
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          rigId: true,
          userId: true,
          title: true,
          body: true,
          photos: true,
          postType: true,
          createdAt: true,
          author: { select: { id: true, username: true, firstName: true, profilePicture: true } },
          rig: { select: { id: true, slug: true, rigName: true, heroPhoto: true } },
        },
      }),
      prisma.rigMod.findMany({
        where: {
          rigId: { in: ctx.followedRigIds },
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          rigId: true,
          userId: true,
          title: true,
          description: true,
          category: true,
          afterPhotoUrls: true,
          likes: true,
          createdAt: true,
          user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
          rig: { select: { id: true, slug: true, rigName: true, heroPhoto: true } },
        },
      }),
    ]);

    const postItems: RawFeedItem[] = rigPosts.map((p: any) => ({
      sourceKey: 'rig-updates',
      entityType: 'rig-post',
      entityId: p.id,
      actorId: p.userId,
      createdAt: new Date(p.createdAt),
      payload: {
        preview: p.title || `New post from ${p.rig?.rigName || 'a rig'}`,
        body: p.body?.slice(0, 150),
        imageUrl: p.photos?.[0] || p.rig?.heroPhoto || null,
        authorUsername: p.author?.username,
        authorFirstName: p.author?.firstName,
        authorAvatar: p.author?.profilePicture || null,
        rigId: p.rigId,
        rigSlug: p.rig?.slug,
        rigName: p.rig?.rigName,
        postType: p.postType,
      },
    }));

    const modItems: RawFeedItem[] = rigMods.map((m: any) => ({
      sourceKey: 'rig-updates',
      entityType: 'rig-mod',
      entityId: m.id,
      actorId: m.userId,
      createdAt: new Date(m.createdAt),
      payload: {
        preview: `${m.rig?.rigName || 'A rig'} added a mod: ${m.title}`,
        body: m.description?.slice(0, 150),
        imageUrl: m.afterPhotoUrls?.[0] || m.rig?.heroPhoto || null,
        authorUsername: m.user?.username,
        authorFirstName: m.user?.firstName,
        authorAvatar: m.user?.profilePicture || null,
        rigId: m.rigId,
        rigSlug: m.rig?.slug,
        rigName: m.rig?.rigName,
        likeCount: m.likes || 0,
        modCategory: m.category,
      },
    }));

    return [...postItems, ...modItems];
  },
};

registerSource(source);
