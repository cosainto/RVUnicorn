import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/calendar?month=1-12&year=YYYY
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const month  = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year   = parseInt(req.query.year  as string) || new Date().getFullYear();
    const start  = new Date(year, month - 1, 1);
    const end    = new Date(year, month,     1);

    const events = await prisma.event.findMany({
      where: {
        OR: [{ organizerId: userId }, { attendees: { some: { userId } } }],
        startDate: { lt: end }, endDate: { gte: start },
      },
      include: {
        campground: { select: { id: true, name: true, location: true } },
        organizer:  { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        attendees: { include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } } },
      },
    });

    const trips = await prisma.trip.findMany({
      where: { userId, startDate: { lt: end }, endDate: { gte: start } },
      include: { stays: { include: { campground: { select: { id: true, name: true, location: true } } } } },
    });

    // Fetch AI itinerary travel days
    const aiTrips = await (prisma as any).trip.findMany({
      where: {
        userId,
        days: { some: { date: { gte: start, lt: end } } }
      },
      include: {
        days: {
          where: { date: { gte: start, lt: end } },
          orderBy: { dayNumber: 'asc' }
        }
      }
    });

    const items = [
      ...events.map(e => ({
        id: e.id, type: 'EVENT', title: e.title,
        startDate: e.startDate, endDate: e.endDate,
        campground: e.campground, location: (e as any).location,
        isOrganizer: e.organizerId === userId,
        myAttendee: e.attendees.find(a => a.userId === userId) || null,
        attendees: e.attendees, color: '#f59e0b',
      })),
      ...trips.flatMap(t => (t.stays as any[]).map((s: any) => ({
        id: s.id, tripId: t.id, type: 'STAY', title: t.name,
        startDate: s.startDate ?? t.startDate, endDate: s.endDate ?? t.endDate,
        campground: s.campground, isOrganizer: true,
        myAttendee: { confirmationNumber: s.confirmationNumber, siteNumber: s.siteNumber, userId },
        attendees: [], color: '#34d399',
      }))),
      ...aiTrips.flatMap((t: any) => t.days.map((d: any) => ({
        id: d.id, tripId: t.id, type: 'TRAVEL_DAY',
        title: t.title || 'Road Trip',
        dayType: d.type || 'TRAVEL',
        dayNumber: d.dayNumber,
        startDate: d.date, endDate: d.date,
        campground: null, isOrganizer: true,
        myAttendee: null, attendees: [], color: '#8b5cf6',
        notes: d.notes,
      }))),
    ];
    res.json({ items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch calendar' }); }
});

// PATCH /api/calendar/events/:eventId/reservation
router.patch('/events/:eventId/reservation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { eventId } = req.params;
    const { confirmationNumber, siteNumber, notes, targetUserId } = req.body;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Not found' });
    const affectedId = (event.organizerId === userId && targetUserId) ? targetUserId : userId;
    const updated = await prisma.eventAttendee.update({
      where: { eventId_userId: { eventId, userId: affectedId } },
      data: {
        ...(confirmationNumber !== undefined && { confirmationNumber }),
        ...(siteNumber         !== undefined && { siteNumber }),
        ...(notes              !== undefined && { notes }),
      },
    });
    res.json({ attendee: updated });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

// PATCH /api/calendar/stays/:stayId/reservation
router.patch('/stays/:stayId/reservation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { stayId } = req.params;
    const { confirmationNumber, siteNumber } = req.body;
    const stay = await (prisma as any).stay.findFirst({ where: { id: stayId, trip: { userId } } });
    if (!stay) return res.status(403).json({ error: 'Not authorised' });
    const updated = await (prisma as any).stay.update({
      where: { id: stayId },
      data: {
        ...(confirmationNumber !== undefined && { confirmationNumber }),
        ...(siteNumber !== undefined && { siteNumber }),
      },
    });
    res.json({ stay: updated });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

// POST /api/calendar/events/:eventId/attendees  (tag a friend)
router.post('/events/:eventId/attendees', authenticateToken, async (req: Request, res: Response) => {
  try {
    const inviterId = (req as any).user.id;
    const { eventId } = req.params;
    const { userId } = req.body;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Not found' });
    const isAttendee = await prisma.eventAttendee.findUnique({ where: { eventId_userId: { eventId, userId: inviterId } } });
    if (event.organizerId !== inviterId && !isAttendee) return res.status(403).json({ error: 'Not authorised' });
    const attendee = await prisma.eventAttendee.upsert({
      where:  { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: 'INVITED' },
      update: {},
      include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } },
    });
    await prisma.notification.create({
      data: { userId, type: 'EVENT_INVITE', content: `You were added to "${event.title}"`, link: `/trips/${eventId}`, category: 'SOCIAL' },
    });
    res.json({ attendee });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

export default router;
