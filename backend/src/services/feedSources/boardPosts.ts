/**
 * Feed Source: Board Posts (existing content)
 * Routed by actor — friend's posts go to Network, others to Community.
 * This preserves the existing boardPost content that was in both tabs.
 */
import { FeedSource, FeedContext, RawFeedItem, registerSource } from '../feedRegistry';

import { prisma } from '../../lib/prisma';

const source: FeedSource = {
  key: 'board-posts',
  enabled: true,

  async fetch(ctx: FeedContext): Promise<RawFeedItem[]> {
    const posts = await prisma.boardPost.findMany({
      where: {
        isPublic: true,
        author: { isSystem: false },
        isCharacterPost: false,
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        voteScore: true,
        postType: true,
        imageUrl: true,
        tags: true,
        author: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        _count: { select: { comments: true } },
      },
    });

    return posts.map((p: any) => ({
      sourceKey: 'board-posts',
      entityType: 'board-post',
      entityId: p.id,
      actorId: p.author?.id || null,
      createdAt: new Date(p.createdAt),
      payload: {
        preview: p.title || 'Discussion post',
        body: p.body?.slice(0, 150),
        imageUrl: p.imageUrl || null,
        authorUsername: p.author?.username,
        authorFirstName: p.author?.firstName,
        authorAvatar: p.author?.profilePicture || null,
        tags: p.tags || [],
        likeCount: p.voteScore || 0,
        commentCount: p._count?.comments || 0,
        postType: p.postType,
      },
    }));
  },
};

registerSource(source);
