import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/users/search - Search for users
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = q.trim().toLowerCase();

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
          { username: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      },
      take: 10,
    });

    res.json(users);
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// GET /api/users/:username - Get user by username
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
        bio: true,
        location: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/:id - Update user profile
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { firstName, lastName, bio, location } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        bio,
        location,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
        bio: true,
        location: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/users/nearby — users from the same state
router.get('/nearby', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { state, limit = '5' } = req.query;
    if (!state) return res.json({ users: [] });
    const users = await prisma.user.findMany({
      where: { homeState: { equals: String(state), mode: 'insensitive' }, id: { not: userId } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, homeState: true, rvType: true, rvMake: true },
      take: parseInt(String(limit)),
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users });
  } catch { res.json({ users: [] }); }
});

// GET /api/users/same-rig — users with the same RV make
router.get('/same-rig', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { make, limit = '5' } = req.query;
    if (!make) return res.json({ users: [], total: 0 });
    const where = { rvMake: { equals: String(make), mode: 'insensitive' as const }, id: { not: userId } };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvType: true, rvMake: true, rvModel: true },
        take: parseInt(String(limit)),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, total });
  } catch { res.json({ users: [], total: 0 }); }
});

// GET /api/users/same-destination — users who visited the same states
router.get('/same-destination', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { states, limit = '5' } = req.query;
    if (!states) return res.json({ users: [] });
    const stateList = String(states).split(',').map(s => s.trim().toUpperCase());
    const visits = await prisma.stateVisit.findMany({
      where: { state: { in: stateList }, userId: { not: userId } },
      select: { userId: true },
      distinct: ['userId'],
      take: parseInt(String(limit)),
    });
    if (visits.length === 0) return res.json({ users: [] });
    const users = await prisma.user.findMany({
      where: { id: { in: visits.map(v => v.userId) } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, homeState: true, rvType: true },
    });
    res.json({ users });
  } catch { res.json({ users: [] }); }
});

export default router;
