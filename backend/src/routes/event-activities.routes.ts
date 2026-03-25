import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Get activities for an event
router.get('/events/:eventId/activities', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const activities = await prisma.eventActivity.findMany({
      where: { eventId },
      include: {
        thingToDo: true,
        addedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });
    
    res.json(activities);
  } catch (error) {
    console.error('Get event activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Add a thing to do to an event
router.post('/events/:eventId/activities', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).user?.id || req.user?.id;
    const { thingToDoId, title, description, scheduledDate, scheduledTime, duration, notes } = req.body;
    
    // Verify user has access to this event (is organizer or attendee)
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId, status: 'GOING' } } }
        ]
      }
    });
    
    if (!event) {
      return res.status(403).json({ error: 'Not authorized to add activities to this event' });
    }
    
    const activity = await prisma.eventActivity.create({
      data: {
        eventId,
        ...(thingToDoId ? { thingToDoId } : {}),
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTime,
        duration,
        notes,
        addedById: userId,
      },
      include: {
        thingToDo: true,
        addedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      }
    });
    
    res.json(activity);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This activity is already added to the event' });
    }
    console.error('Add event activity error:', error);
    res.status(500).json({ error: 'Failed to add activity' });
  }
});

// Update an event activity (schedule, notes, status)
router.patch('/events/:eventId/activities/:activityId', authenticateToken, async (req, res) => {
  try {
    const { eventId, activityId } = req.params;
    const userId = (req as any).user?.id || req.user?.id;
    const { scheduledDate, scheduledTime, duration, notes, status } = req.body;
    
    // Verify user has access
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId, status: 'GOING' } } }
        ]
      }
    });
    
    if (!event) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const activity = await prisma.eventActivity.update({
      where: { id: activityId },
      data: {
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        scheduledTime,
        duration,
        notes,
        status,
      },
      include: {
        thingToDo: true,
      }
    });
    
    res.json(activity);
  } catch (error) {
    console.error('Update event activity error:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Remove an activity from an event
router.delete('/events/:eventId/activities/:activityId', authenticateToken, async (req, res) => {
  try {
    const { eventId, activityId } = req.params;
    const userId = (req as any).user?.id || req.user?.id;
    
    // Verify user has access
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId, status: 'GOING' } } }
        ]
      }
    });
    
    if (!event) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await prisma.eventActivity.delete({
      where: { id: activityId }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete event activity error:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

// Get user's saved things to do that can be added to events at a campground
router.get('/campgrounds/:campgroundId/things-to-do/saved', authenticateToken, async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).user?.id || req.user?.id;
    
    // Get things to do near this campground that the user has saved
    const saved = await prisma.thingToDoSave.findMany({
      where: { userId },
      include: {
        thingToDo: {
          include: {
            campgrounds: {
              where: { campgroundId }
            }
          }
        }
      }
    });
    
    // Filter to only those associated with this campground
    const filtered = saved.filter(s => s.thingToDo.campgrounds.length > 0);
    
    res.json(filtered.map(s => s.thingToDo));
  } catch (error) {
    console.error('Get saved things error:', error);
    res.status(500).json({ error: 'Failed to fetch saved things' });
  }
});

// Get events at a campground where user can add activities
router.get('/campgrounds/:campgroundId/my-events', authenticateToken, async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).user?.id || req.user?.id;
    
    const events = await prisma.event.findMany({
      where: {
        campgroundId,
        endDate: { gte: new Date() },
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId, status: 'GOING' } } }
        ]
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: 'asc' }
    });
    
    res.json(events);
  } catch (error) {
    console.error('Get my events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});


// POST /api/events/:eventId/schedule-item — add custom item to event schedule
router.post('/events/:eventId/schedule-item', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { eventId } = req.params;
    const { thingToDoId, title, description, scheduledDate, scheduledTime, duration, notes, lat, lng, address } = req.body;

    if (!thingToDoId && !title) {
      return res.status(400).json({ error: 'title or thingToDoId is required' });
    }

    // Verify event access
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId, status: { in: ['GOING', 'going'] } } } }
        ]
      }
    });

    if (!event) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let finalThingToDoId = thingToDoId;

    // If no thingToDoId, create a custom ThingToDo
    if (!thingToDoId && title) {
      const sourceUrl = `rvunicorn://custom/${eventId}/${Date.now()}`;
      const existing = await prisma.thingToDo.findUnique({ where: { sourceUrl } }).catch(() => null);
      if (!existing) {
        const custom = await prisma.thingToDo.create({
          data: {
            title,
            description,
            sourceUrl,
            sourceName: 'RVUnicorn',
            lat: lat || null,
            lng: lng || null,
            address: address || null,
            createdByUserId: userId,
          }
        });
        finalThingToDoId = custom.id;
      } else {
        finalThingToDoId = existing.id;
      }
    }

    const activity = await prisma.eventActivity.create({
      data: {
        eventId,
        thingToDoId: finalThingToDoId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTime,
        duration,
        notes,
        addedById: userId,
      },
      include: { thingToDo: true }
    });

    res.json(activity);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
