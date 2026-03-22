import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const boards = await (prisma as any).board.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    res.json({ boards });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch boards' }); }
});

router.get('/posts/all', async (req: Request, res: Response) => {
  try {
    const { sort = 'hot', limit = '20', cursor } = req.query;
    const take = Math.min(Number(limit), 50);
    const orderBy: any = sort === 'new' ? { createdAt: 'desc' } : sort === 'top' ? { voteScore: 'desc' } : [{ voteScore: 'desc' }, { createdAt: 'desc' }];
    const posts = await (prisma as any).boardPost.findMany({
      orderBy, take, ...(cursor ? { skip: 1, cursor: { id: String(cursor) } } : {}),
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        board: { select: { id: true, name: true, slug: true, icon: true, color: true } },
        _count: { select: { comments: true, votes: true } },
      },
    });
    res.json({ posts, nextCursor: posts.length === take ? posts[posts.length - 1].id : null });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch posts' }); }
});

router.get('/post/:postId', async (req: Request, res: Response) => {
  try {
    const post = await (prisma as any).boardPost.findUnique({
      where: { id: req.params.postId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        board: { select: { id: true, name: true, slug: true, icon: true, color: true } },
        comments: {
          where: { parentId: null }, orderBy: { voteScore: 'desc' },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
            replies: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } } },
          },
        },
        _count: { select: { comments: true, votes: true } },
      },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ post });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch post' }); }
});

router.delete('/post/:postId', authenticateToken, async (req: any, res: Response) => {
  try {
    const post = await (prisma as any).boardPost.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await (prisma as any).boardPost.delete({ where: { id: req.params.postId } });
    await (prisma as any).board.update({ where: { id: post.boardId }, data: { postCount: { decrement: 1 } } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete post' }); }
});

router.post('/post/:postId/vote', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { value } = req.body;
    if (![1, -1].includes(value)) return res.status(400).json({ error: 'Value must be 1 or -1' });
    const existing = await (prisma as any).boardVote.findUnique({ where: { userId_postId: { userId, postId: req.params.postId } } });
    let delta = 0;
    if (existing) {
      if (existing.value === value) { await (prisma as any).boardVote.delete({ where: { id: existing.id } }); delta = -value; }
      else { await (prisma as any).boardVote.update({ where: { id: existing.id }, data: { value } }); delta = value * 2; }
    } else { await (prisma as any).boardVote.create({ data: { userId, postId: req.params.postId, value } }); delta = value; }
    const updated = await (prisma as any).boardPost.update({ where: { id: req.params.postId }, data: { voteScore: { increment: delta } } });
    res.json({ voteScore: updated.voteScore });
  } catch (e) { res.status(500).json({ error: 'Failed to vote' }); }
});

router.post('/post/:postId/comments', authenticateToken, async (req: any, res: Response) => {
  try {
    const { body, parentId } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Body required' });
    const comment = await (prisma as any).boardComment.create({
      data: { postId: req.params.postId, authorId: req.userId, body: body.trim(), parentId: parentId || null },
      include: { author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
    });
    await (prisma as any).boardPost.update({ where: { id: req.params.postId }, data: { commentCount: { increment: 1 } } });
    res.json({ comment });
  } catch (e) { res.status(500).json({ error: 'Failed to create comment' }); }
});

router.post('/comment/:commentId/vote', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { value } = req.body;
    if (![1, -1].includes(value)) return res.status(400).json({ error: 'Value must be 1 or -1' });
    const existing = await (prisma as any).boardVote.findUnique({ where: { userId_commentId: { userId, commentId: req.params.commentId } } });
    let delta = 0;
    if (existing) {
      if (existing.value === value) { await (prisma as any).boardVote.delete({ where: { id: existing.id } }); delta = -value; }
      else { await (prisma as any).boardVote.update({ where: { id: existing.id }, data: { value } }); delta = value * 2; }
    } else { await (prisma as any).boardVote.create({ data: { userId, commentId: req.params.commentId, value } }); delta = value; }
    const updated = await (prisma as any).boardComment.update({ where: { id: req.params.commentId }, data: { voteScore: { increment: delta } } });
    res.json({ voteScore: updated.voteScore });
  } catch (e) { res.status(500).json({ error: 'Failed to vote on comment' }); }
});

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const board = await (prisma as any).board.findUnique({ where: { slug: req.params.slug } });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    res.json({ board });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch board' }); }
});

router.get('/:slug/posts', async (req: Request, res: Response) => {
  try {
    const { sort = 'hot', limit = '20', cursor } = req.query;
    const board = await (prisma as any).board.findUnique({ where: { slug: req.params.slug } });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const take = Math.min(Number(limit), 50);
    const orderBy: any = sort === 'new' ? { createdAt: 'desc' } : sort === 'top' ? { voteScore: 'desc' } : [{ isPinned: 'desc' }, { voteScore: 'desc' }, { createdAt: 'desc' }];
    const posts = await (prisma as any).boardPost.findMany({
      where: { boardId: board.id }, orderBy, take, ...(cursor ? { skip: 1, cursor: { id: String(cursor) } } : {}),
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        _count: { select: { comments: true, votes: true } },
      },
    });
    res.json({ posts, nextCursor: posts.length === take ? posts[posts.length - 1].id : null });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch posts' }); }
});

router.post('/:slug/posts', authenticateToken, async (req: any, res: Response) => {
  try {
    const { title, body, postType = 'DISCUSSION', imageUrl, tags = [] } = req.body;
    if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Title and body required' });
    const board = await (prisma as any).board.findUnique({ where: { slug: req.params.slug } });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const post = await (prisma as any).boardPost.create({
      data: { boardId: board.id, authorId: req.userId, title: title.trim(), body: body.trim(), postType, imageUrl, tags },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        board: { select: { id: true, name: true, slug: true, icon: true } },
      },
    });
    await (prisma as any).board.update({ where: { id: board.id }, data: { postCount: { increment: 1 } } });
    res.json({ post });
  } catch (e) { res.status(500).json({ error: 'Failed to create post' }); }
});

export default router;
