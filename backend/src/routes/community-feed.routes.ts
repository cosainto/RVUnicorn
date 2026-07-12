import { Router, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { buildForYouFeed, buildFollowingFeed, buildTrendingFeed, getHotStrip } from '../services/feedEngine';

const router = Router();
import { prisma } from '../lib/prisma';

// ─── FEED ───────────────────────────────────────────────────

router.get('/feed', authenticateToken, async (req: any, res: Response) => {
  try {
    const tab = (req.query.tab as string) || 'FOR_YOU';
    const cursor = req.query.cursor as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    let items: any[];
    if (tab === 'FOLLOWING') {
      items = await buildFollowingFeed(req.userId, cursor, limit);
    } else if (tab === 'TRENDING') {
      items = await buildTrendingFeed(cursor, limit);
    } else {
      items = await buildForYouFeed(req.userId, cursor, limit);
    }

    const nextCursor = items.length === limit ? items[items.length - 1]?.createdAt : null;
    res.json({ items, nextCursor });
  } catch (e: any) {
    console.error('[CommunityFeed] Error:', e);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

router.get('/feed/hot-strip', authenticateToken, async (req: any, res: Response) => {
  try {
    const items = await getHotStrip();
    res.json(items);
  } catch (e: any) {
    res.json([]);
  }
});

router.get('/feed/active-threads', authenticateToken, async (req: any, res: Response) => {
  try {
    const subs = await prisma.threadSubscription.findMany({
      where: { userId: req.userId },
      include: { post: { select: { id: true, content: true, commentCount: true, updatedAt: true } } },
      orderBy: { subscribedAt: 'desc' },
      take: 10,
    });

    const active = subs
      .filter((s: any) => {
        if (!s.lastReadAt) return s.post.commentCount > 0;
        return new Date(s.post.updatedAt) > new Date(s.lastReadAt);
      })
      .slice(0, 5)
      .map((s: any) => ({
        postId: s.post.id,
        preview: s.post.content?.slice(0, 80),
        newReplies: s.post.commentCount,
        lastActivity: s.post.updatedAt,
      }));

    res.json(active);
  } catch (e: any) {
    res.json([]);
  }
});

// ─── POSTS CRUD ─────────────────────────────────────────────

router.post('/posts', authenticateToken, async (req: any, res: Response) => {
  try {
    const { content, postType, photoUrls, campgroundId, tripId, stopId, tags, rigId, pollOptions, pollExpiry } = req.body;
    if (!content && !photoUrls?.length) return res.status(400).json({ error: 'Content or photos required' });

    const post = await prisma.feedPost.create({
      data: {
        authorId: req.userId,
        rigId: rigId || null,
        content: content || '',
        postType: postType || 'GENERAL',
        photoUrls: photoUrls || [],
        campgroundId: campgroundId || null,
        tripId: tripId || null,
        stopId: stopId || null,
        tags: tags || [],
      },
    });

    // Create poll if POLL type
    if (postType === 'POLL' && pollOptions?.length >= 2) {
      const expiresAt = pollExpiry ? new Date(Date.now() + parseInt(pollExpiry) * 3600000) : null;
      await prisma.feedPoll.create({
        data: {
          postId: post.id,
          options: pollOptions.map((text: string) => ({ text })),
          expiresAt,
        },
      });
    }

    // Auto-subscribe author to thread
    await prisma.threadSubscription.create({
      data: { postId: post.id, userId: req.userId },
    }).catch(() => {});

    res.status(201).json(post);
  } catch (e: any) {
    console.error('[Post] Create error:', e);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.get('/posts/:id', optionalAuth, async (req: any, res: Response) => {
  try {
    const post = await prisma.feedPost.findUnique({
      where: { id: req.params.id },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
        poll: { include: { userVotes: true } },
        _count: { select: { beenTheres: true, likes: true, comments: true } },
      },
    });
    if (!post || post.isHidden) return res.status(404).json({ error: 'Not found' });

    const author = await prisma.user.findUnique({
      where: { id: post.authorId },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true, rvType: true },
    });

    // Enrich comments with author data
    const commentAuthorIds = [...new Set(post.comments.map((c: any) => c.userId))];
    const commentAuthors = await prisma.user.findMany({
      where: { id: { in: commentAuthorIds } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true },
    });
    const commentAuthorMap = new Map(commentAuthors.map((a: any) => [a.id, a]));

    const enrichedComments = post.comments.map((c: any) => ({
      ...c,
      author: commentAuthorMap.get(c.userId) || null,
    }));

    // Check if current user liked / been-there / subscribed
    let userLiked = false;
    let userBeenThere = false;
    let userSubscribed = false;
    let userPollVote: number | null = null;
    if (req.userId) {
      const [like, bt, sub, vote] = await Promise.all([
        prisma.feedPostLike.findUnique({ where: { postId_userId: { postId: post.id, userId: req.userId } } }),
        prisma.beenThere.findUnique({ where: { postId_userId: { postId: post.id, userId: req.userId } } }),
        prisma.threadSubscription.findUnique({ where: { postId_userId: { postId: post.id, userId: req.userId } } }),
        post.poll ? prisma.feedPollVote.findUnique({ where: { pollId_userId: { pollId: post.poll.id, userId: req.userId } } }) : null,
      ]);
      userLiked = !!like;
      userBeenThere = !!bt;
      userSubscribed = !!sub;
      userPollVote = vote?.optionIndex ?? null;
    }

    // Update lastReadAt for thread subscription
    if (req.userId) {
      await prisma.threadSubscription.updateMany({
        where: { postId: post.id, userId: req.userId },
        data: { lastReadAt: new Date() },
      }).catch(() => {});
    }

    res.json({
      ...post,
      author,
      comments: enrichedComments,
      beenThereCount: post._count.beenTheres,
      userLiked,
      userBeenThere,
      userSubscribed,
      userPollVote,
    });
  } catch (e: any) {
    console.error('[Post] Get error:', e);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

router.put('/posts/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const post = await prisma.feedPost.findUnique({ where: { id: req.params.id } });
    if (!post || post.authorId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const updated = await prisma.feedPost.update({
      where: { id: req.params.id },
      data: { content: req.body.content, photoUrls: req.body.photoUrls || post.photoUrls },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update post' });
  }
});

router.delete('/posts/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const post = await prisma.feedPost.findUnique({ where: { id: req.params.id } });
    if (!post || post.authorId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.feedPost.update({ where: { id: req.params.id }, data: { isHidden: true } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ─── LIKES ──────────────────────────────────────────────────

router.post('/posts/:id/like', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.feedPostLike.findUnique({
      where: { postId_userId: { postId: req.params.id, userId: req.userId } },
    });

    if (existing) {
      await prisma.feedPostLike.delete({ where: { id: existing.id } });
      await prisma.feedPost.update({ where: { id: req.params.id }, data: { likeCount: { decrement: 1 } } });
      res.json({ liked: false });
    } else {
      await prisma.feedPostLike.create({ data: { postId: req.params.id, userId: req.userId } });
      await prisma.feedPost.update({ where: { id: req.params.id }, data: { likeCount: { increment: 1 } } });
      // Notify post author
      const post = await prisma.feedPost.findUnique({ where: { id: req.params.id }, select: { authorId: true } });
      if (post && post.authorId !== req.userId) {
        await prisma.feedActivity.create({
          data: { actorId: req.userId, targetUserId: post.authorId, postId: req.params.id, activityType: 'LIKE' },
        }).catch(() => {});
      }
      res.json({ liked: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

router.post('/posts/:id/comments/:commentId/like', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.feedPostCommentLike.findUnique({
      where: { commentId_userId: { commentId: req.params.commentId, userId: req.userId } },
    });
    if (existing) {
      await prisma.feedPostCommentLike.delete({ where: { id: existing.id } });
      await prisma.feedPostComment.update({ where: { id: req.params.commentId }, data: { likeCount: { decrement: 1 } } });
      res.json({ liked: false });
    } else {
      await prisma.feedPostCommentLike.create({ data: { commentId: req.params.commentId, userId: req.userId } });
      await prisma.feedPostComment.update({ where: { id: req.params.commentId }, data: { likeCount: { increment: 1 } } });
      res.json({ liked: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to toggle comment like' });
  }
});

// ─── COMMENTS ───────────────────────────────────────────────

router.get('/posts/:id/comments', optionalAuth, async (req: any, res: Response) => {
  try {
    const comments = await prisma.feedPostComment.findMany({
      where: { postId: req.params.id },
      orderBy: { createdAt: 'asc' },
      take: parseInt(req.query.limit as string) || 50,
    });
    const authorIds = [...new Set(comments.map((c: any) => c.userId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true },
    });
    const authorMap = new Map(authors.map((a: any) => [a.id, a]));
    res.json(comments.map((c: any) => ({ ...c, author: authorMap.get(c.userId) || null })));
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

router.post('/posts/:id/comments', authenticateToken, async (req: any, res: Response) => {
  try {
    const { content, parentCommentId } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const comment = await prisma.feedPostComment.create({
      data: { postId: req.params.id, userId: req.userId, content, parentCommentId: parentCommentId || null },
    });

    // Update comment count
    await prisma.feedPost.update({ where: { id: req.params.id }, data: { commentCount: { increment: 1 } } });

    // Auto-subscribe commenter
    await prisma.threadSubscription.upsert({
      where: { postId_userId: { postId: req.params.id, userId: req.userId } },
      create: { postId: req.params.id, userId: req.userId },
      update: { lastReadAt: new Date() },
    }).catch(() => {});

    // Notify post author + thread subscribers
    const post = await prisma.feedPost.findUnique({ where: { id: req.params.id }, select: { authorId: true } });
    const subs = await prisma.threadSubscription.findMany({
      where: { postId: req.params.id, userId: { not: req.userId } },
      select: { userId: true },
    });

    const notifyIds = new Set<string>();
    if (post && post.authorId !== req.userId) notifyIds.add(post.authorId);
    subs.forEach((s: any) => notifyIds.add(s.userId));

    for (const targetUserId of notifyIds) {
      await prisma.feedActivity.create({
        data: { actorId: req.userId, targetUserId, postId: req.params.id, commentId: comment.id, activityType: parentCommentId ? 'THREAD_REPLY' : 'COMMENT' },
      }).catch(() => {});
    }

    // Get author for response
    const author = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true },
    });

    res.status(201).json({ ...comment, author });
  } catch (e: any) {
    console.error('[Comment] Create error:', e);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.delete('/posts/:id/comments/:commentId', authenticateToken, async (req: any, res: Response) => {
  try {
    const comment = await prisma.feedPostComment.findUnique({ where: { id: req.params.commentId } });
    if (!comment || comment.userId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.feedPostComment.delete({ where: { id: req.params.commentId } });
    await prisma.feedPost.update({ where: { id: req.params.id }, data: { commentCount: { decrement: 1 } } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ─── THREAD SUBSCRIPTIONS ───────────────────────────────────

router.post('/posts/:id/subscribe', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.threadSubscription.findUnique({
      where: { postId_userId: { postId: req.params.id, userId: req.userId } },
    });
    if (existing) {
      await prisma.threadSubscription.delete({ where: { id: existing.id } });
      res.json({ subscribed: false });
    } else {
      await prisma.threadSubscription.create({ data: { postId: req.params.id, userId: req.userId } });
      res.json({ subscribed: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to toggle subscription' });
  }
});

// ─── POLLS ──────────────────────────────────────────────────

router.post('/posts/:id/poll/vote', authenticateToken, async (req: any, res: Response) => {
  try {
    const { optionIndex } = req.body;
    const poll = await prisma.feedPoll.findUnique({ where: { postId: req.params.id } });
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) return res.status(400).json({ error: 'Poll expired' });

    await prisma.feedPollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId: req.userId } },
      create: { pollId: poll.id, userId: req.userId, optionIndex },
      update: { optionIndex },
    });

    // Recount votes
    const votes = await prisma.feedPollVote.groupBy({
      by: ['optionIndex'],
      where: { pollId: poll.id },
      _count: true,
    });
    const voteCounts: Record<string, number> = {};
    votes.forEach((v: any) => { voteCounts[String(v.optionIndex)] = v._count; });

    await prisma.feedPoll.update({ where: { id: poll.id }, data: { votes: voteCounts } });

    // Notify poll creator
    const post = await prisma.feedPost.findUnique({ where: { id: req.params.id }, select: { authorId: true } });
    if (post && post.authorId !== req.userId) {
      const recentNotif = await prisma.feedActivity.findFirst({
        where: { targetUserId: post.authorId, postId: req.params.id, activityType: 'POLL_VOTE', createdAt: { gte: new Date(Date.now() - 3600000) } },
      });
      if (!recentNotif) {
        await prisma.feedActivity.create({
          data: { actorId: req.userId, targetUserId: post.authorId, postId: req.params.id, activityType: 'POLL_VOTE' },
        }).catch(() => {});
      }
    }

    res.json({ voted: true, optionIndex, voteCounts });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// ─── BEEN THERE ─────────────────────────────────────────────

router.post('/posts/:id/been-there', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await prisma.beenThere.findUnique({
      where: { postId_userId: { postId: req.params.id, userId: req.userId } },
    });
    if (existing) {
      await prisma.beenThere.delete({ where: { id: existing.id } });
      res.json({ beenThere: false });
    } else {
      const post = await prisma.feedPost.findUnique({ where: { id: req.params.id }, select: { campgroundId: true, authorId: true } });
      await prisma.beenThere.create({
        data: { postId: req.params.id, userId: req.userId, campgroundId: post?.campgroundId || null },
      });
      if (post && post.authorId !== req.userId) {
        await prisma.feedActivity.create({
          data: { actorId: req.userId, targetUserId: post.authorId, postId: req.params.id, activityType: 'BEEN_THERE' },
        }).catch(() => {});
      }
      res.json({ beenThere: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to toggle been there' });
  }
});

// ─── ACTIVITY / NOTIFICATIONS ───────────────────────────────

router.get('/activity', authenticateToken, async (req: any, res: Response) => {
  try {
    const activities = await prisma.feedActivity.findMany({
      where: { targetUserId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // Enrich with actor data
    const actorIds = [...new Set(activities.map((a: any) => a.actorId))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, firstName: true, username: true, profilePicture: true },
    });
    const actorMap = new Map(actors.map((a: any) => [a.id, a]));

    const enriched = activities.map((a: any) => ({ ...a, actor: actorMap.get(a.actorId) || null }));

    // Mark as read
    await prisma.feedActivity.updateMany({
      where: { targetUserId: req.userId, isRead: false },
      data: { isRead: true },
    });

    res.json(enriched);
  } catch (e: any) {
    res.json([]);
  }
});

router.get('/activity/count', authenticateToken, async (req: any, res: Response) => {
  try {
    const count = await prisma.feedActivity.count({
      where: { targetUserId: req.userId, isRead: false },
    });
    res.json({ count });
  } catch (e: any) {
    res.json({ count: 0 });
  }
});

// ─── SUGGESTIONS ────────────────────────────────────────────

router.get('/suggestions/people', authenticateToken, async (req: any, res: Response) => {
  try {
    const suggestions = await prisma.userSuggestion.findMany({
      where: { userId: req.userId, dismissed: false },
      orderBy: { score: 'desc' },
      take: 10,
    });

    const userIds = suggestions.map((s: any) => s.suggestedUserId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true, rvType: true },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    res.json(suggestions.map((s: any) => ({
      ...s,
      user: userMap.get(s.suggestedUserId) || null,
    })));
  } catch (e: any) {
    res.json([]);
  }
});

router.post('/suggestions/:suggestedUserId/dismiss', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.userSuggestion.updateMany({
      where: { userId: req.userId, suggestedUserId: req.params.suggestedUserId },
      data: { dismissed: true },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to dismiss' });
  }
});

// ─── MODERATION ─────────────────────────────────────────────

router.post('/posts/:id/report', authenticateToken, async (req: any, res: Response) => {
  try {
    console.log(`[Moderation] Post ${req.params.id} reported by ${req.userId}: ${req.body.reason || 'No reason'}`);
    res.json({ reported: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to report' });
  }
});

export default router;
