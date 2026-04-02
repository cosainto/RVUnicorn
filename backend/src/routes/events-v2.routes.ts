import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { computeEventLifecycle, computePresenceStatus } from '../helpers/event-status';

const router = Router();
const prisma = new PrismaClient();

// ── Events CRUD ─────────────────────────────────────────────────

// POST /api/events-v2 — create event
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const organizerId = req.userId;
    const { title, description, eventType, campgroundId, locationName, latitude, longitude, startDate, endDate, isPublic, maxAttendees, bannerImage } = req.body;
    if (!title || !startDate || !endDate) return res.status(400).json({ error: 'title, startDate, endDate required' });

    const event = await prisma.event.create({
      data: {
        title, description, organizerId,
        eventType: eventType || 'OTHER',
        eventStatus: 'UPCOMING',
        campgroundId: campgroundId || null,
        locationName: locationName || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isPublic: isPublic !== false,
        maxAttendees: maxAttendees || null,
        bannerImage: bannerImage || null,
        location: locationName || null,
      },
      include: { organizer: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } }, campground: { select: { id: true, name: true, imageUrl: true } } },
    });

    // Auto-add organizer as CONFIRMED attendee
    await prisma.eventAttendee.create({
      data: { eventId: event.id, userId: organizerId, status: 'ATTENDING', participationMode: 'FULL' },
    }).catch(() => {});

    res.json({ event });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// GET /api/events-v2 — list events
router.get('/', async (req, res) => {
  try {
    const { campgroundId, upcoming, lat, lng, radius, eventType, limit = '20' } = req.query;
    const where: any = { isPublic: true };
    if (campgroundId) where.campgroundId = String(campgroundId);
    if (eventType) where.eventType = String(eventType);
    if (upcoming === 'true') where.startDate = { gte: new Date() };

    const events = await prisma.event.findMany({
      where,
      include: {
        organizer: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        campground: { select: { id: true, name: true, city: true, state: true, imageUrl: true } },
        _count: { select: { attendees: true } },
      },
      orderBy: { startDate: 'asc' },
      take: parseInt(String(limit)),
    });

    const enriched = events.map(e => ({
      ...e,
      lifecycle: computeEventLifecycle(e),
    }));
    res.json({ events: enriched });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/events-v2/:id — single event with full data
router.get('/:id', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        organizer: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        campground: { select: { id: true, name: true, city: true, state: true, imageUrl: true, latitude: true, longitude: true } },
        attendees: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvType: true, rvMake: true, rvModel: true } } } },
        scheduleItems: { orderBy: { startTime: 'asc' } },
        announcements: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, firstName: true, profilePicture: true } } } },
        meals: { include: { dishes: { include: { user: { select: { id: true, firstName: true } } } }, cook: { select: { id: true, firstName: true } }, host: { select: { id: true, firstName: true } } } },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const lifecycle = computeEventLifecycle(event);

    // Fetch active check-ins at this campground to derive HERE_NOW
    const activeCheckInUserIds = new Set<string>();
    if (event.campgroundId && lifecycle === 'LIVE') {
      const checkIns = await prisma.checkIn.findMany({
        where: { campgroundId: event.campgroundId, isActive: true },
        select: { userId: true },
      });
      checkIns.forEach(c => activeCheckInUserIds.add(c.userId));
    }
    // Also check EventCheckIn records
    const eventCheckIns = await prisma.eventCheckIn.findMany({
      where: { eventId: event.id },
      select: { userId: true },
    });
    eventCheckIns.forEach(c => activeCheckInUserIds.add(c.userId));

    const attendeesWithPresence = (event.attendees || []).map((a: any) => ({
      ...a,
      presenceStatus: computePresenceStatus(a, lifecycle, activeCheckInUserIds.has(a.userId)),
    }));

    res.json({
      event: {
        ...event,
        lifecycle,
        attendees: attendeesWithPresence,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /api/events-v2/:id — update (organizer only)
router.put('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const updated = await prisma.event.update({ where: { id: event.id }, data: req.body });
    res.json({ event: updated });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE /api/events-v2/:id — cancel
router.delete('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.event.update({ where: { id: event.id }, data: { eventStatus: 'CANCELLED' } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Attendance ──────────────────────────────────────────────────

router.post('/:id/join', authenticateToken, async (req: any, res: Response) => {
  try {
    const { participationMode, siteNumber } = req.body;
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, select: { maxAttendees: true, _count: { select: { attendees: true } } } });
    if (event?.maxAttendees && event._count.attendees >= event.maxAttendees) return res.status(400).json({ error: 'Event is full' });

    const attendee = await prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId: req.params.id, userId: req.userId } },
      create: { eventId: req.params.id, userId: req.userId, status: 'ATTENDING', participationMode: participationMode || 'FULL', siteNumber },
      update: { status: 'ATTENDING', participationMode: participationMode || undefined },
    });
    res.json({ attendee });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.put('/:id/attendance', authenticateToken, async (req: any, res: Response) => {
  try {
    const { participationMode, status, siteNumber, socialBattery } = req.body;
    const data: any = {};
    if (participationMode) data.participationMode = participationMode;
    if (status) data.status = status;
    if (siteNumber !== undefined) data.siteNumber = siteNumber;
    if (socialBattery !== undefined) data.socialBattery = socialBattery;

    const attendee = await prisma.eventAttendee.update({
      where: { eventId_userId: { eventId: req.params.id, userId: req.userId } },
      data,
    });
    res.json({ attendee });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/:id/attendees', async (req, res) => {
  try {
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId: req.params.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvType: true, rvMake: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ attendees });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Schedule ────────────────────────────────────────────────────

router.post('/:id/schedule', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Organizer only' });
    const { title, description, startTime, endTime, location, isOptional } = req.body;
    const item = await prisma.eventScheduleItem.create({
      data: { eventId: event.id, title, description, startTime: new Date(startTime), endTime: endTime ? new Date(endTime) : null, location, isOptional },
    });
    res.json({ item });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.put('/:id/schedule/:itemId', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Organizer only' });
    const item = await prisma.eventScheduleItem.update({ where: { id: req.params.itemId }, data: req.body });
    res.json({ item });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/:id/schedule/:itemId', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Organizer only' });
    await prisma.eventScheduleItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Announcements ───────────────────────────────────────────────

router.post('/:id/announcements', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Organizer only' });
    const { title, body } = req.body;
    const announcement = await prisma.eventAnnouncement.create({
      data: { eventId: event.id, authorId: req.userId, title, body },
      include: { author: { select: { id: true, firstName: true, profilePicture: true } } },
    });
    res.json({ announcement });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/:id/announcements', async (req, res) => {
  try {
    const announcements = await prisma.eventAnnouncement.findMany({
      where: { eventId: req.params.id },
      include: { author: { select: { id: true, firstName: true, profilePicture: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ announcements });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.put('/:id/announcements/:announcementId', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Organizer only' });
    const updated = await prisma.eventAnnouncement.update({ where: { id: req.params.announcementId }, data: req.body });
    res.json({ announcement: updated });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/:id/announcements/:announcementId', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Organizer only' });
    await prisma.eventAnnouncement.delete({ where: { id: req.params.announcementId } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Meals ───────────────────────────────────────────────────────

router.post('/:id/meals', authenticateToken, async (req: any, res: Response) => {
  try {
    const { mealType, title, description, scheduledAt, scheduledTime, location, servings, visibility } = req.body;
    if (mealType === 'OFFICIAL') {
      const event = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Organizer only for official meals' });
    }
    const meal = await prisma.eventMeal.create({
      data: {
        eventId: req.params.id, mealType: mealType || 'COMMUNITY',
        title, description, scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        scheduledTime, location, servings, visibility: visibility || 'ATTENDEES',
        hostId: req.userId,
      },
    });
    res.json({ meal });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/:id/meals', async (req, res) => {
  try {
    const meals = await prisma.eventMeal.findMany({
      where: { eventId: req.params.id },
      include: {
        dishes: { include: { user: { select: { id: true, firstName: true } } } },
        host: { select: { id: true, firstName: true, profilePicture: true } },
        cook: { select: { id: true, firstName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json({ meals });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/:id/meals/:mealId/dishes', authenticateToken, async (req: any, res: Response) => {
  try {
    const { dishName, servings, allergens, recipeId } = req.body;
    const dish = await prisma.eventDish.create({
      data: { mealId: req.params.mealId, userId: req.userId, dishName, servings, allergens: allergens || [], recipeId, eventId: req.params.id },
    });
    res.json({ dish });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/:id/meals/:mealId/dishes/:dishId', authenticateToken, async (req: any, res: Response) => {
  try {
    const dish = await prisma.eventDish.findUnique({ where: { id: req.params.dishId } });
    if (!dish || dish.userId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.eventDish.delete({ where: { id: dish.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Social Plans ────────────────────────────────────────────────

router.post('/social-plans', authenticateToken, async (req: any, res: Response) => {
  try {
    const { eventId, campgroundId, title, description, scheduledFor, visibility, inviteeIds } = req.body;
    const plan = await prisma.userSocialPlan.create({
      data: { userId: req.userId, eventId, campgroundId, title, description, scheduledFor: scheduledFor ? new Date(scheduledFor) : null, visibility: visibility || 'FRIENDS', inviteeIds: inviteeIds || [] },
    });
    res.json({ plan });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/social-plans', authenticateToken, async (req: any, res: Response) => {
  try {
    const plans = await prisma.userSocialPlan.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } });
    res.json({ plans });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/:id/social-plans', authenticateToken, async (req: any, res: Response) => {
  try {
    const plans = await prisma.userSocialPlan.findMany({
      where: { eventId: req.params.id, visibility: { in: ['PUBLIC', 'ATTENDEES'] } },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
      orderBy: { scheduledFor: 'asc' },
    });
    res.json({ plans });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.put('/social-plans/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const plan = await prisma.userSocialPlan.findUnique({ where: { id: req.params.id } });
    if (!plan || plan.userId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const updated = await prisma.userSocialPlan.update({ where: { id: plan.id }, data: req.body });
    res.json({ plan: updated });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/social-plans/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const plan = await prisma.userSocialPlan.findUnique({ where: { id: req.params.id } });
    if (!plan || plan.userId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.userSocialPlan.delete({ where: { id: plan.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
