import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// ══ GET /api/jobs/campground-active/:campgroundId ══
router.get('/campground-active/:campgroundId', async (req, res: Response) => {
  try {
    const job = await prisma.jobPosting.findFirst({
      where: { campgroundId: req.params.campgroundId, isActive: true },
      include: { campground: { select: { name: true, location: true, state: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ job });
  } catch { res.json({ job: null }); }
});

// ══ GET /api/jobs/route-jobs — jobs along a route ══
router.get('/route-jobs', async (req, res: Response) => {
  try {
    const states = ((req.query.states as string) || '').split(',').filter(Boolean);
    if (states.length === 0) return res.json({ jobs: [] });

    const jobs = await prisma.jobPosting.findMany({
      where: { isActive: true, campground: { state: { in: states } } },
      include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ jobs });
  } catch { res.json({ jobs: [] }); }
});

// ══ GET /api/jobs/search — search with filters ══
router.get('/search', async (req, res: Response) => {
  try {
    const { type, state, workamper } = req.query;
    const where: any = { isActive: true };
    if (type) where.jobType = type;
    if (state) where.campground = { state: state as string };
    if (workamper === 'true') where.siteIncluded = true;

    const jobs = await prisma.jobPosting.findMany({
      where,
      include: { campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ jobs });
  } catch { res.json({ jobs: [] }); }
});

// ══ PATCH /api/jobs/preferences — update user job preferences ══
router.patch('/preferences', authenticateToken, async (req: any, res: Response) => {
  try {
    const { openToWork, jobTypePrefs, jobStatePrefs, jobCompPref, availableFrom } = req.body;
    const data: any = {};
    if (openToWork !== undefined) data.openToWork = !!openToWork;
    if (jobTypePrefs) data.jobTypePrefs = jobTypePrefs;
    if (jobStatePrefs) data.jobStatePrefs = jobStatePrefs;
    if (jobCompPref !== undefined) data.jobCompPref = jobCompPref;
    if (availableFrom !== undefined) data.availableFrom = availableFrom ? new Date(availableFrom) : null;

    await prisma.user.update({ where: { id: req.userId }, data });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ GET /api/jobs/preferences — get user job preferences ══
router.get('/preferences', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { openToWork: true, jobTypePrefs: true, jobStatePrefs: true, jobCompPref: true, availableFrom: true },
    });
    res.json(user || {});
  } catch { res.json({}); }
});

export default router;
