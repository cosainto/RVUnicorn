import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// POST /api/checkins - Check in to a location
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, harvestHostId, overnightSpotId, siteNumber, notes } = req.body;

    if (!campgroundId && !harvestHostId && !overnightSpotId) {
      return res.status(400).json({ error: 'Must provide a location to check in to' });
    }

    // Check out of any active check-ins first
    await prisma.checkIn.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, checkOutDate: new Date() }
    });

    // Create new check-in
    const checkIn = await prisma.checkIn.create({
      data: {
        userId,
        campgroundId: campgroundId || null,
        harvestHostId: harvestHostId || null,
        overnightSpotId: overnightSpotId || null,
        checkInDate: new Date(),
        siteNumber: siteNumber || null,
        notes: notes || null,
        isActive: true,
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        campground: { select: { id: true, name: true, imageUrl: true } },
      }
    });

    // Award campground first stay badge
    if (campgroundId) {
      const slug = 'campground-first-stay';
      const badge = await prisma.badge.findUnique({ where: { slug } }).catch(() => null);
      if (badge) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId, badgeId: badge.id } },
          create: { userId, badgeId: badge.id },
          update: {}
        }).catch(() => null);
        await prisma.notification.create({
          data: {
            userId,
            type: 'BADGE_EARNED',
            content: `🏕️ You earned the "First Campground Stay" badge!`,
            link: '/profile',
          }
        }).catch(() => null);
      }
    }

    // Award first night badge for host check-ins
    if (harvestHostId) {
      const host = await (prisma as any).harvestHost.findUnique({ where: { id: harvestHostId }, select: { hostType: true } });
      const slugs = ['first-night-host'];
      if (host?.hostType === 'BREWERY') slugs.push('brew-hopper');
      if (host?.hostType === 'WINERY') slugs.push('vineyard-voyager');
      for (const slug of slugs) {
        const badge = await prisma.badge.findUnique({ where: { slug } }).catch(() => null);
        if (badge) {
          await prisma.userBadge.upsert({
            where: { userId_badgeId: { userId, badgeId: badge.id } },
            create: { userId, badgeId: badge.id },
            update: {}
          }).catch(() => null);
        }
      }
    }

    res.json(checkIn);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/checkins/active - Check out
router.delete('/active', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    await prisma.checkIn.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, checkOutDate: new Date() }
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/checkins/active - Get my active check-in
router.get('/active', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const checkIn = await prisma.checkIn.findFirst({
      where: { userId, isActive: true },
      include: {
        campground: { select: { id: true, name: true, imageUrl: true, latitude: true, longitude: true } },
        harvestHost: { select: { id: true, name: true, hostType: true, imageUrl: true } },
        overnightSpot: { select: { id: true, name: true, category: true } },
      }
    });
    // Auto-create StateVisit if campground has a state
    if (checkIn.campground?.state) {
      const campState = checkIn.campground.state;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await prisma.stateVisit.findFirst({
        where: { userId, state: campState, startDate: { gte: today } },
      }).catch(() => null);
      if (!existing) {
        await prisma.stateVisit.create({
          data: {
            userId,
            state: campState,
            startDate: today,
            notes: `Auto-created from check-in at ${checkIn.campground.name}`,
          },
        }).catch(() => {});
      }
    }

    res.json({ checkIn });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/checkins/herd/:type/:id - Get who's checked in at a location (RV Herd Here Now)
router.get('/herd/:type/:id', async (req: any, res) => {
  try {
    const { type, id } = req.params;
    const where: any = { isActive: true };
    if (type === 'campground') where.campgroundId = id;
    else if (type === 'host') where.harvestHostId = id;
    else if (type === 'spot') where.overnightSpotId = id;

    const checkIns = await prisma.checkIn.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } }
      },
      orderBy: { checkInDate: 'desc' },
      take: 20,
    });
    res.json(checkIns);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});



// GET /api/checkins/user/:userId/active - Get another user's active check-in (public)
router.get('/user/:userId/active', async (req: any, res) => {
  try {
    const checkIn = await prisma.checkIn.findFirst({
      where: { userId: req.params.userId, isActive: true },
      include: {
        campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true } },
        harvestHost: { select: { id: true, name: true, hostType: true, imageUrl: true } },
        overnightSpot: { select: { id: true, name: true, category: true, city: true, state: true } },
      }
    });
    res.json(checkIn);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/checkins/stargazing/toggle
router.post('/stargazing/toggle', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stargazingEnabled: true } });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { stargazingEnabled: !user?.stargazingEnabled },
      select: { stargazingEnabled: true },
    });
    res.json({ stargazingEnabled: updated.stargazingEnabled });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;

