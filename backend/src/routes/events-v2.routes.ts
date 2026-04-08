import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { computeEventLifecycle, computePresenceStatus } from '../helpers/event-status';
import { sendWebPush } from '../utils/webPush';
import { recordCampgroundVisit } from '../services/visit-stats.service';

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
      include: { organizer: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } }, campground: { select: { id: true, name: true, state: true, imageUrl: true } } },
    });

    // Auto-add organizer as CONFIRMED attendee
    await prisma.eventAttendee.create({
      data: { eventId: event.id, userId: organizerId, status: 'ATTENDING', participationMode: 'FULL' },
    }).catch(() => {});

    // Record the visit so the user's travel map and stats reflect this trip
    if (event.campground) {
      await recordCampgroundVisit(organizerId, event, event.campground);
    }

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
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: {
        maxAttendees: true,
        title: true,
        _count: { select: { attendees: { where: { status: { in: ['ATTENDING', 'HERE_NOW'] } } } } },
      },
    });

    // Check if already on waitlist or attending
    const existing = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: req.params.id, userId: req.userId } },
    });

    const isFull = event?.maxAttendees && event._count.attendees >= event.maxAttendees;

    if (isFull && !existing) {
      // Add to waitlist
      const waitlistCount = await prisma.eventAttendee.count({
        where: { eventId: req.params.id, status: 'WAITLIST' },
      });
      const attendee = await prisma.eventAttendee.create({
        data: {
          eventId: req.params.id,
          userId: req.userId,
          status: 'WAITLIST',
          participationMode: participationMode || 'FULL',
          siteNumber,
        },
      });
      return res.json({ attendee, waitlist: true, position: waitlistCount + 1, message: `You're #${waitlistCount + 1} on the waitlist — we'll notify you if a spot opens!` });
    }

    const attendee = await prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId: req.params.id, userId: req.userId } },
      create: { eventId: req.params.id, userId: req.userId, status: 'ATTENDING', participationMode: participationMode || 'FULL', siteNumber },
      update: { status: 'ATTENDING', participationMode: participationMode || undefined },
    });
    res.json({ attendee, waitlist: false });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

// ── Leave Event ────────────────────────────────────────────────
router.delete('/:id/leave', authenticateToken, async (req: any, res: Response) => {
  try {
    const eventId = req.params.id;
    const userId = req.userId;

    const attendee = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!attendee) return res.status(404).json({ error: 'Not attending this event' });

    await prisma.eventAttendee.delete({
      where: { eventId_userId: { eventId, userId } },
    });

    // Auto-promote next person from waitlist if spot opened
    if (attendee.status === 'ATTENDING' || attendee.status === 'HERE_NOW') {
      const nextWaitlisted = await prisma.eventAttendee.findFirst({
        where: { eventId, status: 'WAITLIST' },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, firstName: true } }, event: { select: { title: true } } },
      });

      if (nextWaitlisted) {
        await prisma.eventAttendee.update({
          where: { id: nextWaitlisted.id },
          data: { status: 'ATTENDING' },
        });

        // Notify the promoted user (DB + push)
        const promoMsg = `A spot opened up for ${nextWaitlisted.event.title}! You're in! 🎉`;
        await prisma.notification.create({
          data: { userId: nextWaitlisted.userId, type: 'WAITLIST_PROMOTED', content: promoMsg, link: `/trips/${eventId}` },
        });
        sendWebPush(nextWaitlisted.userId, { title: 'You\'re In! 🎉', body: promoMsg, icon: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png', url: `/trips/${eventId}` }).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

// ── Waitlist Position ──────────────────────────────────────────
router.get('/:id/waitlist-position', authenticateToken, async (req: any, res: Response) => {
  try {
    const waitlisted = await prisma.eventAttendee.findMany({
      where: { eventId: req.params.id, status: 'WAITLIST' },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    const position = waitlisted.findIndex(w => w.userId === req.userId) + 1;
    res.json({ position: position > 0 ? position : null, total: waitlisted.length });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Weather Contingency ────────────────────────────────────────
router.post('/:id/weather-check', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { id: true, organizerId: true, title: true, startDate: true, latitude: true, longitude: true, planBActivated: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.organizerId !== req.userId) return res.status(403).json({ error: 'Only organizer can check weather' });
    if (!event.latitude || !event.longitude) return res.json({ forecast: null, warning: null });

    // Fetch NWS forecast
    try {
      const pointRes = await fetch(`https://api.weather.gov/points/${event.latitude},${event.longitude}`, { headers: { 'User-Agent': 'RVUnicorn/1.0' } });
      if (!pointRes.ok) return res.json({ forecast: null, warning: 'Could not fetch weather data' });
      const pointData = await pointRes.json();
      const forecastUrl = pointData.properties?.forecast;
      if (!forecastUrl) return res.json({ forecast: null, warning: null });

      const forecastRes = await fetch(forecastUrl, { headers: { 'User-Agent': 'RVUnicorn/1.0' } });
      const forecastData = await forecastRes.json();
      const periods = forecastData.properties?.periods || [];

      // Check for rain/severe weather near event date
      const eventDate = new Date(event.startDate);
      const warnings: string[] = [];
      for (const period of periods.slice(0, 10)) {
        const forecast = (period.detailedForecast || '').toLowerCase();
        if (forecast.includes('thunderstorm') || forecast.includes('severe') || forecast.includes('tornado') || forecast.includes('heavy rain') || forecast.includes('flood')) {
          warnings.push(`${period.name}: ${period.shortForecast}`);
        }
      }

      res.json({
        forecast: periods.slice(0, 6).map((p: any) => ({ name: p.name, temp: p.temperature, unit: p.temperatureUnit, short: p.shortForecast, icon: p.icon })),
        warnings: warnings.length > 0 ? warnings : null,
        suggestion: warnings.length > 0 ? `Weather concerns detected for your event. Consider adding a Plan B location.` : null,
      });
    } catch {
      res.json({ forecast: null, warning: 'Weather service unavailable' });
    }
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Activate Plan B ────────────────────────────────────────────
router.post('/:id/activate-plan-b', authenticateToken, async (req: any, res: Response) => {
  try {
    const { planBDescription, planBLocation } = req.body;
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, select: { organizerId: true, title: true } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    await prisma.event.update({
      where: { id: req.params.id },
      data: { planBActivated: true, planBDescription, planBLocation },
    });

    // Notify all attending users
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId: req.params.id, status: { in: ['ATTENDING', 'HERE_NOW'] } },
      select: { userId: true },
    });

    const planBMsg = `Plan B activated for ${event.title}! ${planBDescription || 'Check the event for updated details.'}`;
    if (attendees.length > 0) {
      await prisma.notification.createMany({
        data: attendees.map(a => ({ userId: a.userId, type: 'EVENT_PLAN_B', content: planBMsg, link: `/trips/${req.params.id}` })),
        skipDuplicates: true,
      });
      // Send push to all attendees
      for (const a of attendees) {
        sendWebPush(a.userId, { title: '⚠️ Plan B Activated', body: planBMsg, icon: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png', url: `/trips/${req.params.id}` }).catch(() => {});
      }
    }

    res.json({ success: true });
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

// ── Geo-Fence Location Check ────────────────────────────────────

router.post('/:id/location-check', authenticateToken, async (req: any, res: Response) => {
  try {
    const eventId = req.params.id;
    const userId = req.userId;
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true, startDate: true, endDate: true, campgroundId: true,
        geoFenceRadiusMiles: true, eventStatus: true, hitchSkin: true, title: true,
        campground: { select: { latitude: true, longitude: true } },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const lifecycle = computeEventLifecycle(event);
    const centerLat = event.campground?.latitude;
    const centerLng = event.campground?.longitude;
    if (!centerLat || !centerLng) return res.json({ status: 'NO_LOCATION' });

    // Haversine distance in miles
    const R = 3958.8;
    const dLat = (lat - centerLat) * Math.PI / 180;
    const dLng = (lng - centerLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(centerLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const radius = event.geoFenceRadiusMiles || 0.5;

    const attendee = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!attendee) return res.json({ status: 'NOT_RSVP', distance });

    if (distance <= radius && lifecycle === 'LIVE') {
      // Auto check-in as HERE_NOW
      if (attendee.arrivalStatus !== 'HERE_NOW') {
        await prisma.eventAttendee.update({
          where: { id: attendee.id },
          data: { arrivalStatus: 'HERE_NOW', autoCheckedIn: true, presenceUpdatedAt: new Date() },
        });

        // Emit presence arrived
        const { io } = await import('../index');
        io.of('/events').to(eventId).emit('presence:arrived', { userId, eventId });
      }
      return res.json({ status: 'HERE_NOW', distance, autoCheckedIn: true });
    }

    if (distance <= radius * 2) {
      // Within 2x radius — set as nearby
      if (attendee.arrivalStatus === 'NOT_ARRIVED') {
        await prisma.eventAttendee.update({
          where: { id: attendee.id },
          data: { arrivalStatus: 'NEARBY', presenceUpdatedAt: new Date() },
        });
      }
      return res.json({ status: 'NEARBY', distance });
    }

    return res.json({ status: 'FAR', distance });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Autopilot Config ────────────────────────────────────────────

router.put('/:id/autopilot', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { autopilotMode, hitchSkin, serendipityEnabled, geoFenceRadiusMiles } = req.body;
    const data: any = {};
    if (autopilotMode) data.autopilotMode = autopilotMode;
    if (hitchSkin) data.hitchSkin = hitchSkin;
    if (serendipityEnabled !== undefined) data.serendipityEnabled = serendipityEnabled;
    if (geoFenceRadiusMiles) data.geoFenceRadiusMiles = parseFloat(geoFenceRadiusMiles);
    const updated = await prisma.event.update({ where: { id: event.id }, data });
    res.json({ event: updated });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Plan B Activation ───────────────────────────────────────────

router.post('/:id/plan-b', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { id: true, organizerId: true, title: true, campgroundId: true, hitchSkin: true },
    });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { planBDescription, planBLocation } = req.body;
    await prisma.event.update({
      where: { id: event.id },
      data: { planBActivated: true, planBDescription, planBLocation },
    });

    // Hitch announces Plan B with OLD_TIMER skin
    const { generatePlanBMessage } = await import('../services/hitchEventService');
    const { getEventContext } = await import('../services/autopilotService');
    const ctx = await getEventContext(event);
    const msg = await generatePlanBMessage({ ...ctx, planBLocation });
    if (msg && event.campgroundId) {
      const room = await prisma.campfireRoom.findUnique({ where: { campgroundId: event.campgroundId } });
      if (room) {
        await prisma.campfireMessage.create({ data: { roomId: room.id, isHitch: true, content: msg } });
      }
    }

    // Notify all attendees
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId: event.id },
      select: { userId: true },
    });
    for (const a of attendees) {
      await prisma.notification.create({
        data: {
          userId: a.userId,
          type: 'EVENT_UPDATE',
          content: `⛈️ Plan B activated for "${event.title}"! New location: ${planBLocation || 'TBD'}`,
          link: `/events-v2/${event.id}`,
        },
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Pop-Up Events ───────────────────────────────────────────────

router.get('/:id/popups', authenticateToken, async (req: any, res: Response) => {
  try {
    const popups = await prisma.eventPopUp.findMany({
      where: { eventId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ popups });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/:id/popups', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event || event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const { title, description, scheduledTime } = req.body;
    const popup = await prisma.eventPopUp.create({
      data: {
        eventId: event.id, title, description,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        status: 'LIVE',
      },
    });
    res.json({ popup });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

router.put('/:id/popups/:popupId', authenticateToken, async (req: any, res: Response) => {
  try {
    const { status } = req.body;
    const popup = await prisma.eventPopUp.update({
      where: { id: req.params.popupId },
      data: { status },
    });
    res.json({ popup });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Highlights ──────────────────────────────────────────────────

router.get('/:id/highlights', async (req: any, res: Response) => {
  try {
    const highlights = await prisma.eventHighlight.findMany({
      where: { eventId: req.params.id },
      orderBy: { reactionCount: 'desc' },
      take: 10,
    });
    res.json({ highlights });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Mission Mode Data ───────────────────────────────────────────

router.get('/:id/mission', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        campground: { select: { name: true, latitude: true, longitude: true } },
        attendees: {
          include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, rvType: true } } },
        },
        popUps: { orderBy: { createdAt: 'desc' } },
        highlights: { orderBy: { reactionCount: 'desc' }, take: 10 },
        tripMemory: true,
      },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });
    if (event.organizerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const lifecycle = computeEventLifecycle(event);
    const hereNow = event.attendees.filter((a: any) => a.arrivalStatus === 'HERE_NOW');
    const nearby = event.attendees.filter((a: any) => a.arrivalStatus === 'NEARBY');
    const going = event.attendees.filter((a: any) => a.status === 'ATTENDING' && a.arrivalStatus === 'NOT_ARRIVED');

    res.json({
      event: { ...event, lifecycle },
      heatMap: {
        hereNow: hereNow.length,
        nearby: nearby.length,
        going: going.length,
        hereNowUsers: hereNow.map((a: any) => a.user),
        nearbyUsers: nearby.map((a: any) => a.user),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ══════════════════════════════════════════════════════════════════
// RIG-AWARE CHECKLIST — Hitch suggests items based on rig capabilities
// ══════════════════════════════════════════════════════════════════

router.get('/:id/rig-suggestions', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, startDate: true, endDate: true, locationName: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rvType: true, rvMake: true, rvModel: true, rvFeatures: true, rvSolarWatts: true, rvGeneratorWatts: true, rvFreshWaterGal: true, rvSleeps: true },
    });

    // Get already claimed items for this event
    const claimedItems = await prisma.supplyItem.findMany({
      where: { eventId: req.params.id },
      include: { claimedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Generate suggestions based on rig capabilities
    const suggestions: { item: string; reason: string; category: string }[] = [];
    const features = (user?.rvFeatures || []).map((f: string) => f.toLowerCase());

    if (features.includes('grill') || features.includes('outdoor grill')) {
      suggestions.push({ item: 'Grill & grilling supplies', reason: 'Your rig has a grill — perfect for campfire cookouts!', category: 'cooking' });
    }
    if (features.includes('oven') || features.includes('convection oven')) {
      suggestions.push({ item: 'Baked goods or casserole', reason: 'You have an oven — bring something baked!', category: 'cooking' });
    }
    if ((user?.rvSolarWatts || 0) > 200 || (user?.rvGeneratorWatts || 0) > 2000) {
      suggestions.push({ item: 'Blender or electric cooler', reason: 'Your power setup can handle small appliances', category: 'equipment' });
    }
    if ((user?.rvFreshWaterGal || 0) > 50) {
      suggestions.push({ item: 'Extra water for group cooking', reason: 'Your fresh water tank is large enough to share', category: 'supplies' });
    }
    if ((user?.rvSleeps || 0) > 4) {
      suggestions.push({ item: 'Extra seating or table', reason: 'Your rig sleeps many — you likely have extra chairs', category: 'equipment' });
    }

    // Always suggest basics
    suggestions.push({ item: 'Firewood bundle', reason: 'Every campfire needs fuel', category: 'supplies' });
    suggestions.push({ item: 'Drinks (cooler)', reason: 'Hydration is key', category: 'supplies' });
    suggestions.push({ item: 'Snacks/appetizers', reason: 'Easy to share', category: 'food' });

    res.json({ suggestions, claimedItems });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// Claim a supply item for an event (prevents duplicates)
router.post('/:id/claim-item', authenticateToken, async (req: any, res: Response) => {
  try {
    const { title, category, quantity } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    // Check if already claimed by someone
    const existing = await prisma.supplyItem.findFirst({
      where: { eventId: req.params.id, title: { equals: title, mode: 'insensitive' }, claimedById: { not: null } },
    });
    if (existing) return res.status(409).json({ error: `Already claimed by someone else`, claimedBy: existing.claimedById });

    const item = await prisma.supplyItem.upsert({
      where: { id: 'find-by-title' }, // Will fall through to create
      create: {
        eventId: req.params.id,
        title,
        category: category || 'general',
        quantity: quantity || 1,
        createdById: req.userId,
        claimedById: req.userId,
        priority: 'NORMAL',
      },
      update: { claimedById: req.userId },
    }).catch(async () => {
      // Upsert fallback — just create
      return prisma.supplyItem.create({
        data: {
          eventId: req.params.id,
          title,
          category: category || 'general',
          quantity: quantity || 1,
          createdById: req.userId,
          claimedById: req.userId,
          priority: 'NORMAL',
        },
      });
    });

    res.json({ item, message: `You claimed "${title}"!` });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

// Unclaim a supply item
router.delete('/:id/unclaim-item/:itemId', authenticateToken, async (req: any, res: Response) => {
  try {
    const item = await prisma.supplyItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.claimedById !== req.userId) return res.status(403).json({ error: 'Not your claim' });

    await prisma.supplyItem.update({
      where: { id: req.params.itemId },
      data: { claimedById: null },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ══════════════════════════════════════════════════════════════════
// GEO-FENCE HERE_NOW — Auto check-in when user enters event radius
// ══════════════════════════════════════════════════════════════════

router.post('/:id/proximity-checkin', authenticateToken, async (req: any, res: Response) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: 'Location required' });

    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, title: true, latitude: true, longitude: true,
        geoFenceRadiusMiles: true, startDate: true, endDate: true, isLive: true,
      },
    });
    if (!event || !event.latitude || !event.longitude) return res.json({ inRange: false });

    // Check if event is active (within event window)
    const now = new Date();
    const eventStart = new Date(event.startDate);
    const eventEnd = event.endDate ? new Date(event.endDate) : new Date(eventStart.getTime() + 24 * 60 * 60 * 1000);
    const bufferMs = 2 * 60 * 60 * 1000; // 2 hour buffer before/after
    if (now < new Date(eventStart.getTime() - bufferMs) || now > new Date(eventEnd.getTime() + bufferMs)) {
      return res.json({ inRange: false, reason: 'Event not active' });
    }

    // Haversine distance
    const R = 3959; // Earth radius in miles
    const dLat = (latitude - event.latitude) * Math.PI / 180;
    const dLon = (longitude - event.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(event.latitude * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const radius = event.geoFenceRadiusMiles || 0.5;
    const inRange = distance <= radius;

    if (inRange) {
      // Check if user is an attendee
      const attendee = await prisma.eventAttendee.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: req.userId } },
      });

      if (attendee && attendee.arrivalStatus !== 'HERE_NOW') {
        await prisma.eventAttendee.update({
          where: { id: attendee.id },
          data: { arrivalStatus: 'HERE_NOW', autoCheckedIn: true, presenceUpdatedAt: new Date() },
        });
        // Push welcome notification
        sendWebPush(req.userId, { title: `Welcome to ${event.title}! 🏕️`, body: 'Tap to check in and see who\'s here.', icon: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png', url: `/trips/${event.id}` }).catch(() => {});

        return res.json({
          inRange: true,
          autoCheckedIn: true,
          message: `Welcome to ${event.title}! You're checked in.`,
          distance: Math.round(distance * 100) / 100,
        });
      }
    }

    res.json({ inRange, distance: Math.round(distance * 100) / 100 });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
