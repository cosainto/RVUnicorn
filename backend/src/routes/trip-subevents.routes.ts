import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
import { prisma } from '../lib/prisma';

// GET /api/events/:eventId/subevents - Get all sub-events for an event
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const { eventId } = req.params;

    const subEvents = await prisma.eventSubevent.findMany({
      where: { eventId },
      include: {
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(subEvents);
  } catch (error: any) {
    console.error('Get sub-events error:', error);
    res.status(500).json({ error: 'Failed to get sub-events' });
  }
});

// POST /api/events/:eventId/subevents - Create a sub-event
router.post(
  '/',
  authenticateToken,
  [
    body('title').trim().notEmpty(),
    body('date').isISO8601(),
    body('activityType').isIn(['HIKE', 'SWIM', 'GAME', 'ENTERTAINMENT', 'CRAFT', 'RANGER_TALK', 'OTHER']),
  ],
  async (req: any, res: any) => {
    try {
      const { eventId } = req.params;
      const { title, description, date, startTime, endTime, activityType, hostId, location } = req.body;
      const userId = (req as any).userId;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          campground: { select: { name: true } },
          attendees: { select: { userId: true } },
        },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const subEvent = await prisma.eventSubevent.create({
        data: {
          eventId,
          userId,
          title,
          description,
          date: new Date(date),
          startTime,
          endTime,
          activityType,
          hostId: hostId || null,
          location,
          createdById: userId,
        },
        include: {
          host: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          attendees: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
      });

      // Get current user info
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });

      // Notify all attendees
      const notifyIds = [
        event.userId,
        ...event.attendees.map((a: any) => a.userId),
      ].filter((id): id is string => !!id && id !== userId);

      if (notifyIds.length > 0) {
        const dateLabel = new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        
        await Promise.all(notifyIds.map(notifyUserId =>
          prisma.notification.create({
            data: {
              userId: notifyUserId,
              type: 'SUBEVENT_ADDED',
              content: `${currentUser?.firstName} ${currentUser?.lastName} added "${title}" on ${dateLabel} to ${event.title}`,
              link: `/events/${eventId}`,
              read: false,
            },
          })
        ));
      }

      res.status(201).json(subEvent);
    } catch (error: any) {
      console.error('Create sub-event error:', error);
      res.status(500).json({ error: 'Failed to create sub-event' });
    }
  }
);

// PUT /api/events/:eventId/subevents/:subEventId - Update a sub-event
router.put(
  '/:subEventId',
  authenticateToken,
  async (req: any, res) => {
    try {
      const { eventId, subEventId } = req.params;
      const { title, description, date, startTime, endTime, hostId, location, activityType } = req.body;

      const subEvent = await prisma.eventSubevent.findUnique({
        where: { id: subEventId },
      });

      if (!subEvent || subEvent.eventId !== eventId) {
        return res.status(404).json({ error: 'Sub-event not found' });
      }

      const updated = await prisma.eventSubevent.update({
        where: { id: subEventId },
        data: {
          title: title !== undefined ? title : undefined,
          description: description !== undefined ? description : undefined,
          date: date ? new Date(date) : undefined,
          startTime: startTime !== undefined ? startTime : undefined,
          endTime: endTime !== undefined ? endTime : undefined,
          hostId: hostId !== undefined ? hostId : undefined,
          location: location !== undefined ? location : undefined,
          activityType: activityType !== undefined ? activityType : undefined,
        },
        include: {
          host: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          attendees: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Update sub-event error:', error);
      res.status(500).json({ error: 'Failed to update sub-event' });
    }
  }
);

// DELETE /api/events/:eventId/subevents/:subEventId - Delete a sub-event
router.delete('/:subEventId', authenticateToken, async (req: any, res) => {
  try {
    const { eventId, subEventId } = req.params;

    const subEvent = await prisma.eventSubevent.findUnique({
      where: { id: subEventId },
    });

    if (!subEvent || subEvent.eventId !== eventId) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }

    await prisma.eventSubevent.delete({
      where: { id: subEventId },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete sub-event error:', error);
    res.status(500).json({ error: 'Failed to delete sub-event' });
  }
});

// POST /api/events/:eventId/subevents/:subEventId/rsvp - RSVP to sub-event
router.post(
  '/:subEventId/rsvp',
  authenticateToken,
  [body('status').isIn(['INTERESTED', 'ATTENDING', 'MAYBE', 'NOT_ATTENDING'])],
  async (req: any, res: any) => {
    try {
      const { eventId, subEventId } = req.params;
      const { status } = req.body;
      const userId = (req as any).userId;

      const subEvent = await prisma.eventSubevent.findUnique({
        where: { id: subEventId },
        include: {
          event: {
            include: {
              campground: { select: { name: true } },
            },
          },
        },
      });

      if (!subEvent || subEvent.eventId !== eventId) {
        return res.status(404).json({ error: 'Sub-event not found' });
      }

      // Check if already exists
      const existing = await prisma.subeventAttendee.findUnique({
        where: {
          subeventId_userId: {
            subeventId: subEventId,
            userId,
          },
        },
      });

      let attendee;
      if (existing) {
        attendee = await prisma.subeventAttendee.update({
          where: { id: existing.id },
          data: { status },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        });
      } else {
        attendee = await prisma.subeventAttendee.create({
          data: {
            subeventId: subEventId,
            userId,
            status,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        });
      }

      res.json(attendee);
    } catch (error: any) {
      console.error('RSVP sub-event error:', error);
      res.status(500).json({ error: 'Failed to RSVP' });
    }
  }
);

export default router;
