import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { logCheckIn } from '../services/activity.service';

const router = Router();
const prisma = new PrismaClient();

// POST /api/checkins - Check in to a location
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, harvestHostId, overnightSpotId, siteNumber, notes,
            checkInDate: rawCheckIn, checkOutDate: rawCheckOut } = req.body;
    const checkInDate  = rawCheckIn  ? new Date(rawCheckIn)  : new Date();
    const checkOutDate = rawCheckOut ? new Date(rawCheckOut) : null;

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
        checkInDate: checkInDate ? new Date(checkInDate) : new Date(),
        siteNumber: siteNumber || null,
        notes: notes || null,
        isActive: true,
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true, location: true, latitude: true, longitude: true } },
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

    // Auto-create an Event from this check-in
    try {
      if (campgroundId && checkIn.campground) {
        const cg = checkIn.campground as any;
        const eventLocation = [cg.city, cg.state].filter(Boolean).join(', ') || cg.location || cg.name;
        const descParts: string[] = [];
        if (siteNumber) descParts.push(`Site: ${siteNumber}`);
        if (notes)      descParts.push(notes);
        const eventBanner = cg.bannerImage || cg.imageUrl || null;
        const eventEnd    = checkOutDate || checkInDate;
        const eventData: any = {
          title:       `Staying at ${cg.name}`,
          description: descParts.join('\n') || null,
          startDate:   checkInDate,
          endDate:     eventEnd,
          location:    eventLocation,
          organizerId: userId,
        };
        if (eventBanner)  eventData.bannerImage = eventBanner;
        if (campgroundId) eventData.campgroundId = campgroundId;
        await prisma.event.create({ data: eventData }).catch((err: any) => {
          if (err.message?.includes('campgroundId')) {
            delete eventData.campgroundId;
            return prisma.event.create({ data: eventData });
          }
          throw err;
        });
        console.log('[CheckIn] Auto-created event for user ' + userId);
      }
    } catch (eventErr: any) {
      console.error('[CheckIn] Auto-event creation failed:', eventErr.message);
    }

    res.json(checkIn);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// PATCH /api/checkins/checkout-event — update linked event endDate on early checkout
router.patch('/checkout-event', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, endDate } = req.body;
    if (!campgroundId || !endDate) return res.json({ updated: false });

    const end = new Date(endDate);

    // Find the most recent event for this user at this campground
    const event = await prisma.event.findFirst({
      where: {
        organizerId: userId,
        campgroundId,
        title: { contains: 'Staying at' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (event) {
      await prisma.event.update({
        where: { id: event.id },
        data: { endDate: end },
      });
      return res.json({ updated: true, eventId: event.id });
    }
    res.json({ updated: false });
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
        campground: { select: { id: true, name: true, imageUrl: true, latitude: true, longitude: true, state: true, location: true } },
      }
    });
    // Auto-create StateVisit if campground has a state
    if (checkIn?.campground?.state) {
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

    // Log check-in activity to friend feed
    if (checkIn?.campground) {
      try {
        await logCheckIn(userId, checkIn.campground.id, checkIn.campground.name);

        // Notify friends that user checked in
        const friendships = await prisma.friendship.findMany({
          where: {
            status: 'ACCEPTED',
            OR: [{ initiatorId: userId }, { receiverId: userId }],
          },
          select: { initiatorId: true, receiverId: true },
        });

        const friendIds = friendships.map((f: any) =>
          f.initiatorId === userId ? f.receiverId : f.initiatorId
        );

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        });

        if (friendIds.length > 0 && user) {
          await prisma.notification.createMany({
            data: friendIds.map((friendId: string) => ({
              userId: friendId,
              type: 'FRIEND_CHECKIN',
              content: `${user.firstName} ${user.lastName} checked in at ${checkIn.campground!.name} 🏕️`,
              link: `/campgrounds/${checkIn.campground!.id}`,
            })),
            skipDuplicates: true,
          });
        }
      } catch (activityErr) {
        console.error('Check-in activity log error (non-fatal):', activityErr);
      }
    }

    res.json({ checkIn });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// GET /api/checkins/tonight/:campgroundId — Tonight at Camp data
router.get('/tonight/:campgroundId', async (req: any, res) => {
  try {
    const { campgroundId } = req.params;

    // How many RVers are currently checked in
    const rverCount = await prisma.checkIn.count({
      where: { campgroundId, isActive: true },
    });

    // Trivia schedule — next trivia at 5:30 PM Central
    const now = new Date();
    const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const hours = central.getHours();
    const mins = central.getMinutes();
    const totalMins = hours * 60 + mins;
    const triviaTime = 17 * 60 + 30;
    let triviaStatus = null;
    const diff = triviaTime - totalMins;
    if (diff > 0 && diff <= 60) triviaStatus = `In ${diff} min`;
    else if (diff <= 0 && diff > -60) triviaStatus = 'LIVE now';
    else if (diff > 60) triviaStatus = '5:30 PM Central';

    // Quiet hours — default 10 PM, override if campground has it set
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true },
    });

    res.json({
      campgroundName: campground?.name || '',
      rverCount,
      triviaStatus,
      quietHoursStart: '10:00 PM',
      quietHoursEnd: '8:00 AM',
    });
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

