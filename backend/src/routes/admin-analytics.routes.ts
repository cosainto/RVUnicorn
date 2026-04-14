import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// Cache with 5 min TTL
const cache = new Map<string, { data: any; expires: number }>();
function cached(key: string, ttlMs: number, fn: () => Promise<any>) {
  return async () => {
    const c = cache.get(key);
    if (c && c.expires > Date.now()) return c.data;
    const data = await fn();
    cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  };
}

function getDateRange(range: string): { start: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  let days = 30;
  if (range === '7d') days = 7;
  else if (range === '90d') days = 90;
  else if (range === 'all') days = 3650;
  const start = new Date(now.getTime() - days * 86400000);
  const prevStart = new Date(start.getTime() - days * 86400000);
  return { start, prevStart, prevEnd: start };
}

// All routes require auth + admin
router.use(authenticateToken);
router.use(requireAdmin as any);

// ══ SUMMARY ══
router.get('/summary', async (req, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const { start, prevStart, prevEnd } = getDateRange(range);

    const [totalUsers, newSignups, prevSignups, activeUsers, totalCheckins, prevCheckins, tripsCreated, prevTrips, postsCreated, prevPosts, weekSignups] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: start } } }),
      prisma.user.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
      prisma.checkIn.count({ where: { createdAt: { gte: start } } }),
      prisma.checkIn.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
      prisma.event.count({ where: { createdAt: { gte: start } } }),
      prisma.event.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
      prisma.post.count({ where: { createdAt: { gte: start } } }),
      prisma.post.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    ]);

    res.json({
      totalUsers, newSignups, prevSignups, activeUsers, totalCheckins, prevCheckins,
      tripsCreated, prevTrips, postsCreated, prevPosts, weekSignups,
      activePercent: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ USER GROWTH ══
router.get('/user-growth', async (req, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const { start } = getDateRange(range);

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalBefore = await prisma.user.count({ where: { createdAt: { lt: start } } });

    // Group by day
    const byDay: Record<string, number> = {};
    users.forEach((u: any) => {
      const day = u.createdAt.toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });

    let cumulative = totalBefore;
    const data = Object.entries(byDay).sort().map(([date, count]) => {
      cumulative += count;
      return { date, newUsers: count, total: cumulative };
    });

    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ DAU ══
router.get('/dau', async (req, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const { start } = getDateRange(range);

    const users = await prisma.user.findMany({
      where: { lastActiveAt: { gte: start } },
      select: { lastActiveAt: true },
    });

    const byDay: Record<string, Set<string>> = {};
    users.forEach((u: any) => {
      if (!u.lastActiveAt) return;
      const day = u.lastActiveAt.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = new Set();
      byDay[day].add(day); // Simplified — count per day
    });

    // Better: group by day using createdAt of activities
    const activities = await prisma.activity.findMany({
      where: { createdAt: { gte: start } },
      select: { userId: true, createdAt: true },
    });

    const dauByDay: Record<string, Set<string>> = {};
    activities.forEach((a: any) => {
      const day = a.createdAt.toISOString().split('T')[0];
      if (!dauByDay[day]) dauByDay[day] = new Set();
      dauByDay[day].add(a.userId);
    });

    const data = Object.entries(dauByDay).sort().map(([date, users]) => ({
      date, count: users.size,
    }));

    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ CHECK-INS ══
router.get('/checkins', async (req, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const { start } = getDateRange(range);

    const checkins = await prisma.checkIn.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, campgroundId: true },
    });

    // Daily counts
    const byDay: Record<string, number> = {};
    const byCampground: Record<string, number> = {};
    checkins.forEach((c: any) => {
      const day = c.createdAt.toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
      if (c.campgroundId) byCampground[c.campgroundId] = (byCampground[c.campgroundId] || 0) + 1;
    });

    // Top 10 campgrounds
    const topIds = Object.entries(byCampground).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const campgrounds = await prisma.campground.findMany({
      where: { id: { in: topIds.map(t => t[0]) } },
      select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(campgrounds.map((c: any) => [c.id, c.name]));

    res.json({
      daily: Object.entries(byDay).sort().map(([date, count]) => ({ date, count })),
      topCampgrounds: topIds.map(([id, count]) => ({ name: nameMap[id] || id, count })),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ COMMUNITY ══
router.get('/community', async (req, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const { start } = getDateRange(range);

    const [posts, recipes, threads] = await Promise.all([
      prisma.post.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
      prisma.recipe.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
      prisma.thread.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    ]);

    const byDay: Record<string, { posts: number; recipes: number; threads: number }> = {};
    const addToDay = (items: any[], key: string) => {
      items.forEach(i => {
        const day = i.createdAt.toISOString().split('T')[0];
        if (!byDay[day]) byDay[day] = { posts: 0, recipes: 0, threads: 0 };
        (byDay[day] as any)[key]++;
      });
    };
    addToDay(posts, 'posts');
    addToDay(recipes, 'recipes');
    addToDay(threads, 'threads');

    res.json({ data: Object.entries(byDay).sort().map(([date, counts]) => ({ date, ...counts })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ SIGNUPS BY STATE ══
router.get('/signups-by-state', async (req, res: Response) => {
  try {
    const range = (req.query.range as string) || '30d';
    const { start } = getDateRange(range);

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: start }, location: { not: null } },
      select: { location: true },
    });

    const byState: Record<string, number> = {};
    users.forEach((u: any) => {
      const state = u.location?.split(',').pop()?.trim() || 'Unknown';
      byState[state] = (byState[state] || 0) + 1;
    });

    const data = Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([state, count]) => ({ state, count }));
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ RECENT USERS ══
router.get('/recent-users', async (req, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const search = (req.query.search as string) || '';
    const sort = (req.query.sort as string) || 'createdAt';
    const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

    const where: any = search ? {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ],
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, firstName: true, lastName: true, username: true, email: true,
          profilePicture: true, createdAt: true, location: true, rvType: true,
          _count: { select: { checkIns: true, organizedEvents: true } as any },
        },
        orderBy: { [sort]: order } as any,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ RETENTION ══
router.get('/retention', async (req, res: Response) => {
  try {
    // Get users who signed up at least 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const oneDayAgo = new Date(Date.now() - 86400000);

    const allUsers = await prisma.user.count();
    const [d1, d7, d30] = await Promise.all([
      // Day 1: signed up > 1 day ago AND has activity after signup day
      prisma.user.count({
        where: {
          createdAt: { lt: oneDayAgo },
          lastActiveAt: { not: null },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { lt: sevenDaysAgo },
          lastActiveAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { lt: thirtyDaysAgo },
          lastActiveAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const oldEnoughD1 = await prisma.user.count({ where: { createdAt: { lt: oneDayAgo } } });
    const oldEnoughD7 = await prisma.user.count({ where: { createdAt: { lt: sevenDaysAgo } } });
    const oldEnoughD30 = await prisma.user.count({ where: { createdAt: { lt: thirtyDaysAgo } } });

    res.json({
      day1: oldEnoughD1 > 0 ? Math.round((d1 / oldEnoughD1) * 100) : 0,
      day7: oldEnoughD7 > 0 ? Math.round((d7 / oldEnoughD7) * 100) : 0,
      day30: oldEnoughD30 > 0 ? Math.round((d30 / oldEnoughD30) * 100) : 0,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
