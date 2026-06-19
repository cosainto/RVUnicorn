/**
 * Feed Source: Followed Campground Updates
 * Community tab — posts and announcements from followed campgrounds.
 */
import { PrismaClient } from '@prisma/client';
import { FeedSource, FeedContext, RawFeedItem, registerSource } from '../feedRegistry';

const prisma = new PrismaClient() as any;

const source: FeedSource = {
  key: 'campground-updates',
  enabled: true,

  async fetch(ctx: FeedContext): Promise<RawFeedItem[]> {
    if (ctx.followedCampgroundIds.length === 0) return [];

    const [posts, announcements] = await Promise.all([
      prisma.campgroundPost.findMany({
        where: {
          campgroundId: { in: ctx.followedCampgroundIds },
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          campgroundId: true,
          authorId: true,
          title: true,
          content: true,
          imageUrl: true,
          createdAt: true,
          author: { select: { id: true, username: true, firstName: true, profilePicture: true } },
          campground: { select: { id: true, name: true, imageUrl: true } },
          _count: { select: { comments: true, likes: true } },
        },
      }),
      prisma.campgroundAnnouncement.findMany({
        where: {
          campgroundId: { in: ctx.followedCampgroundIds },
          isPublished: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          campgroundId: true,
          authorId: true,
          title: true,
          content: true,
          imageUrl: true,
          priority: true,
          createdAt: true,
          author: { select: { id: true, username: true, firstName: true, profilePicture: true } },
          campground: { select: { id: true, name: true, imageUrl: true } },
        },
      }),
    ]);

    const postItems: RawFeedItem[] = posts.map((p: any) => ({
      sourceKey: 'campground-updates',
      entityType: 'campground-post',
      entityId: p.id,
      actorId: p.authorId,
      createdAt: new Date(p.createdAt),
      payload: {
        preview: p.title || `Update from ${p.campground?.name || 'a campground'}`,
        body: p.content?.slice(0, 150),
        imageUrl: p.imageUrl || p.campground?.imageUrl || null,
        authorUsername: p.author?.username,
        authorFirstName: p.author?.firstName,
        authorAvatar: p.author?.profilePicture || null,
        campgroundId: p.campgroundId,
        campgroundName: p.campground?.name,
        likeCount: p._count?.likes || 0,
        commentCount: p._count?.comments || 0,
      },
    }));

    const announcementItems: RawFeedItem[] = announcements.map((a: any) => ({
      sourceKey: 'campground-updates',
      entityType: 'campground-announcement',
      entityId: a.id,
      actorId: a.authorId,
      createdAt: new Date(a.createdAt),
      payload: {
        preview: `📢 ${a.campground?.name}: ${a.title}`,
        body: a.content?.slice(0, 150),
        imageUrl: a.imageUrl || a.campground?.imageUrl || null,
        authorUsername: a.author?.username,
        authorFirstName: a.author?.firstName,
        authorAvatar: a.author?.profilePicture || null,
        campgroundId: a.campgroundId,
        campgroundName: a.campground?.name,
        priority: a.priority,
      },
    }));

    return [...postItems, ...announcementItems];
  },
};

registerSource(source);
