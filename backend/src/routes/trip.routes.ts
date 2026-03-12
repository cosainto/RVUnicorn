import { Router, Request, Response } from 'express';
import { logEventCreated, logEventJoined } from '../services/activity.service';
import { logTripCreated } from '../services/activity.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

// Helper function to create StateVisit for a user
async function createStateVisitForUser(userId: string, event: any, campground: any) {
  if (!campground?.state) return;
  
  const existing = await prisma.stateVisit.findFirst({
    where: { userId, eventId: event.id },
  });
  
  if (!existing) {
    await prisma.stateVisit.create({
      data: {
        userId,
        state: campground.state,
        startDate: new Date(event.startDate),
        endDate: event.endDate ? new Date(event.endDate) : null,
        campsiteId: campground.id,
        eventId: event.id,
        notes: `${event.title} at ${campground.name}`,
        visibility: 'PUBLIC',
      },
    }).catch(() => {});
  }
}

// GET /api/events - Get all events
router.get('/', async (req, res) => {
  try {
    const events = await req.query.userId
      ? await prisma.event.findMany({
          where: { organizerId: req.query.userId as string },
          include: {
            organizer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
            campground: {
              select: {
                id: true,
                name: true,
                location: true,
                state: true,
                latitude: true,
                longitude: true,
              },
            },
            _count: {
              select: {
                attendees: true,
                meals: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
        })
      : await prisma.event.findMany({
          include: {
            organizer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
            campground: {
              select: {
                id: true,
                name: true,
                location: true,
                state: true,
                latitude: true,
                longitude: true,
              },
            },
            _count: {
              select: {
                attendees: true,
                meals: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
        });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/my - Get events I'm involved in (organized or attending)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    // Get events where user is organizer OR attendee
    const events = await prisma.event.findMany({
      where: {
        OR: [
          { organizerId: userId },
          {
            attendees: {
              some: {
                userId: userId,
              },
            },
          },
        ],
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendees: true,
            meals: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Also get StateVisits (trips from Travel Map)
    const stateVisits = await prisma.stateVisit.findMany({
      where: { userId },
      include: {
        campsite: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Convert StateVisits to event-like format and merge
    const stateVisitEvents = stateVisits.map(sv => ({
      id: sv.id,
      title: sv.campsite?.name || `Trip to ${sv.state}`,
      name: sv.campsite?.name || `Trip to ${sv.state}`,
      startDate: sv.startDate,
      endDate: sv.endDate,
      location: sv.campsite?.location || sv.state,
      isWishlist: false,
      isStateVisit: true,
      campground: sv.campsite,
      organizerId: userId,
    }));

    // Add myAttendee to each event so frontend can get siteNumber + attendeeId
    const eventsWithMyAttendee = events.map(event => ({
      ...event,
      myAttendee: event.attendees.find((a: any) => a.userId === userId) || null,
    }));

    // Combine and sort by start date
    const allTrips = [...eventsWithMyAttendee, ...stateVisitEvents].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    res.json(allTrips);
  } catch (error) {
    console.error('Get my events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/upcoming - Get user's upcoming events (for countdown)
router.get('/upcoming', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();

    // Find future events where user is organizer OR an attendee with "going" status
    const upcomingEvents = await prisma.event.findMany({
      where: {
        startDate: { gte: now },
        isWishlist: false, // Exclude wishlist events
        OR: [
          { organizerId: userId },
          {
            attendees: {
              some: {
                userId: userId,
                status: 'going',
              },
            },
          },
        ],
      },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
          },
        },
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        _count: {
          select: { attendees: true },
        },
      },
      orderBy: { startDate: 'asc' },
      take: 5,
    });

    res.json(upcomingEvents);
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// GET /api/events/:id - Get single event
router.get('/my-events', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const events = await prisma.event.findMany({
      where: {
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
        campground: { select: { id: true, name: true, imageUrl: true, location: true, state: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 20,
    });
    res.json(events);
  } catch (error) {
    console.error('Get my events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        meals: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { scheduledAt: 'asc' },
        },
        _count: {
          select: {
            attendees: true,
            meals: true,
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Log activity for friend feed (only for non-private events)
    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /api/events - Create event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, startDate, endDate, location, campgroundId, privacy, bannerImage } = req.body;

    const event = await prisma.event.create({
      data: {
        organizerId: userId,
        title,
        description,
        bannerImage: bannerImage || '/images/Event_default.png',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        campgroundId: campgroundId || null,
        privacy: privacy || 'PUBLIC',
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
          },
        },
      },
    });

    // Auto-create StateVisit for organizer
    if (event.campground) {
      await createStateVisitForUser(userId, event, event.campground);
    }

    // Log activity for friend feed (only for non-private events)
    if (event.privacy !== 'PRIVATE') {
      await logEventCreated(userId, event.id, event.title, event.campgroundId || undefined);
    }


    // Send Hitch welcome message on first trip creation
    try {
      const tripCount = await prisma.event.count({ where: { organizerId: userId } });
      if (tripCount === 1) {
        const conversation = await prisma.hitchConversation.create({
          data: {
            userId,
            title: 'Welcome to Trip Planning!',
            summary: 'Hitch congratulated user on planning their first trip.',
          }
        });

        const hitchWelcome = [
          "🎉 Congrats on planning your first trip, " + (event.organizer?.firstName || 'fellow adventurer') + "! I'm Hitch, your RVUnicorn trail guide — and I'm pumped to help you make this one unforgettable.",
          "",
          "Here's everything you can do with your trip **" + event.title + "**:",
          "",
          "**📋 Trip Checklist** — Create tasks and assign them to trip members so nothing gets forgotten. Who's bringing the firewood? Who's on s'mores duty? Sorted.",
          "",
          "**👥 Invite Your Crew** — Add friends to your trip so everyone stays on the same page. They'll get notified and can RSVP right inside RVUnicorn.",
          "",
          "**🏕️ Link a Campground** — Connect your trip to a campground from our database so your crew knows exactly where you're headed and can explore reviews and photos.",
          "",
          "**📸 Trip Album** — Every trip gets its own photo album. Document the journey and share the memories with your RVUnicorn community.",
          "",
          "**🍽️ Meal Planning** — Plan your camp meals day by day. Add recipes, assign cooks, and show up to the campsite ready to eat well.",
          "",
          "**💬 Trip Comments** — Keep the conversation going with your crew right inside the trip. No more scattered group texts.",
          "",
          "**🗺️ Activities & Attractions** — Add must-see stops, hikes, and activities to your trip itinerary so everyone knows the plan.",
          "",
          "**📦 Packing Lists** — Build shared packing lists so your whole crew is packed and ready. No more 'I thought YOU brought the camp chairs.'",
          "",
          "Ready to build out your trip? Ask me anything — I can suggest campgrounds, help you plan a route, recommend gear, or just help you get excited for the road ahead. 🚐✨",
        ].join("\n");

        await prisma.hitchMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: hitchWelcome,
          }
        });
      }
    } catch (hitchErr) {
      console.error('Hitch welcome message error (non-fatal):', hitchErr);
    }

    res.json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { title, description, startDate, endDate, location, campgroundId, notifyAttendees, isWishlist, privacy, bannerImage } = req.body;

    const event = await prisma.event.findUnique({
      where: { id },
      include: { attendees: true },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        title: title || undefined,
        description: description !== undefined ? description : undefined,
        bannerImage: bannerImage !== undefined ? bannerImage : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        location: location !== undefined ? location : undefined,
        campgroundId: campgroundId !== undefined ? campgroundId : undefined,
        isWishlist: isWishlist !== undefined ? isWishlist : undefined,
        privacy: privacy !== undefined ? privacy : undefined,
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
          },
        },
        attendees: true,
      },
    });

    // Handle privacy changes for activity feed
    if (privacy === 'PRIVATE') {
      // Delete activity records so it doesn't show in feeds
      await prisma.activity.deleteMany({
        where: { eventId: id }
      });
    } else if (privacy === 'PUBLIC' || privacy === 'FRIENDS') {
      // If changing to PUBLIC or FRIENDS, create activity if it doesn't exist
      const existingActivity = await prisma.activity.findFirst({
        where: { eventId: id, type: 'EVENT_CREATED' }
      });
      if (!existingActivity) {
        await prisma.activity.create({
          data: {
            userId,
            type: 'EVENT_CREATED',
            eventId: id,
            title: updatedEvent.title,
            isPublic: true,
            campgroundId: updatedEvent.campgroundId,
          }
        });
      }
    }

    // Update or create StateVisit for organizer and all "going" attendees
    if (updatedEvent.campground) {
      // Organizer
      await createStateVisitForUser(userId, updatedEvent, updatedEvent.campground);
      
      // All "going" attendees
      for (const attendee of updatedEvent.attendees) {
        if (attendee.status === 'going') {
          await createStateVisitForUser(attendee.userId, updatedEvent, updatedEvent.campground);
        }
      }
    }

    if (notifyAttendees) {
      const notificationData = updatedEvent.attendees
        .filter((a) => a.userId !== userId)
        .map((a) => ({
          userId: a.userId,
          type: "EVENT_UPDATED",
          content: updatedEvent.organizer.firstName + " updated the event " + updatedEvent.title,
          link: "/trips/" + updatedEvent.id,
        }));
      if (notificationData.length > 0) {
        await prisma.notification.createMany({ data: notificationData });
      }
    }

    res.json(updatedEvent);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: { select: { firstName: true, lastName: true } },
        group: { select: { id: true, name: true } },
        attendees: { select: { userId: true } },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    // Notify attendees about event deletion (except organizer)
    const notificationData = event.attendees
      .filter((a) => a.userId !== userId)
      .map((a) => ({
        userId: a.userId,
        type: 'EVENT_DELETED',
        content: `${event.organizer.firstName} cancelled the event "${event.title}"${event.group ? ` in ${event.group.name}` : ''}`,
        link: event.group ? `/groups/${event.group.id}` : '/trips',
      }));

    if (notificationData.length > 0) {
      await prisma.notification.createMany({
        data: notificationData,
      });
    }

    // Delete associated StateVisits
    await prisma.stateVisit.deleteMany({
      where: { eventId: id },
    });

    await prisma.event.delete({
      where: { id }
    });

    res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// GET /api/events/:id/attendees - Get event attendees
router.get('/:id/attendees', async (req, res) => {
  try {
    const { id } = req.params;

    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(attendees);
  } catch (error) {
    console.error('Get attendees error:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// POST /api/events/:id/attendees - Add attendee(s) to event
router.post('/:id/attendees', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds array is required' });
    }

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ error: 'Only the event organizer can invite attendees' });
    }

    const attendees = [];
    for (const invitedUserId of userIds) {
      const existing = await prisma.eventAttendee.findUnique({
        where: {
          eventId_userId: {
            eventId: id,
            userId: invitedUserId,
          },
        },
      });

      if (!existing) {
        const isPastTrip = event.endDate ? new Date(event.endDate) < new Date() : new Date(event.startDate) < new Date();
        const attendeeStatus = isPastTrip ? 'going' : 'invited';

        const attendee = await prisma.eventAttendee.create({
          data: {
            eventId: id,
            userId: invitedUserId,
            status: attendeeStatus,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        });
        attendees.push(attendee);

        await prisma.notification.create({
          data: {
            userId: invitedUserId,
            type: 'EVENT_INVITE',
            content: isPastTrip
              ? `You were tagged in the trip "${event.title}"`
              : `You've been invited to ${event.title}`,
            link: `/events/${id}`,
            read: false,
          },
        });
      }
    }

    res.json(attendees);
  } catch (error) {
    console.error('Add attendees error:', error);
    res.status(500).json({ error: 'Failed to add attendees' });
  }
});

// PUT /api/events/:id/attendees/:attendeeId - Update attendee status
router.put('/:id/attendees/:attendeeId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id, attendeeId } = req.params;
    const { status, siteNumber } = req.body;

    const attendee = await prisma.eventAttendee.findUnique({
      where: { id: attendeeId },
    });

    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    if (attendee.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (siteNumber !== undefined) updateData.siteNumber = siteNumber;

    const updated = await prisma.eventAttendee.update({
      where: { id: attendeeId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
      },
    });

    // If status is "going", auto-create StateVisit for this attendee
    if (status === 'going') {
      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          campground: {
            select: {
              id: true,
              name: true,
              state: true,
            },
          },
        },
      });

      if (event?.campground) {
        await createStateVisitForUser(userId, event, event.campground);
      }
    }

    // If status changed FROM "going" to something else, optionally remove StateVisit
    if (status !== 'going' && attendee.status === 'going') {
      await prisma.stateVisit.deleteMany({
        where: {
          userId,
          eventId: id,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Update attendee error:', error);
    res.status(500).json({ error: 'Failed to update attendee' });
  }
});

// DELETE /api/events/:id/attendees/:attendeeId - Remove attendee
router.delete('/:id/attendees/:attendeeId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id, attendeeId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const attendee = await prisma.eventAttendee.findUnique({
      where: { id: attendeeId },
    });

    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    if (event.organizerId !== userId && attendee.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Remove their StateVisit for this event
    await prisma.stateVisit.deleteMany({
      where: {
        userId: attendee.userId,
        eventId: id,
      },
    });

    await prisma.eventAttendee.delete({
      where: { id: attendeeId },
    });

    res.json({ message: 'Attendee removed' });
  } catch (error) {
    console.error('Remove attendee error:', error);
    res.status(500).json({ error: 'Failed to remove attendee' });
  }
});

// POST /api/events/:id/meals - Add meal to event
router.post('/:id/meals', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { recipeId, mealType, scheduledAt, notes } = req.body;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        attendees: {
          where: { userId, status: { in: ["GOING", "going"] } }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const isOrganizer = event.organizerId === userId;
    const isGoingAttendee = event.attendees && event.attendees.length > 0;

    if (!isOrganizer && !isGoingAttendee) {
      return res.status(403).json({ error: 'Only the organizer or attending members can add meals' });
    }

    const meal = await prisma.eventMeal.create({
      data: {
        eventId: id,
        recipeId: recipeId || null,
        mealType,
        scheduledAt: new Date(scheduledAt),
        notes,
      },
      include: {
        recipe: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
          },
        },
      },
    });

    res.json(meal);
  } catch (error) {
    console.error('Add meal error:', error);
    res.status(500).json({ error: 'Failed to add meal' });
  }
});

// DELETE /api/events/:id/meals/:mealId - Remove meal from event
router.delete('/:id/meals/:mealId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id, mealId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        attendees: {
          where: { userId, status: { in: ["GOING", "going"] } }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const isOrganizer = event.organizerId === userId;
    const isGoingAttendee = event.attendees && event.attendees.length > 0;

    if (!isOrganizer && !isGoingAttendee) {
      return res.status(403).json({ error: 'Only the organizer or attending members can remove meals' });
    }

    await prisma.eventMeal.delete({
      where: { id: mealId },
    });

    res.json({ message: 'Meal removed' });
  } catch (error) {
    console.error('Remove meal error:', error);
    res.status(500).json({ error: 'Failed to remove meal' });
  }
});

// POST /api/events/:id/copy - Copy an event to your own events
router.post('/:id/copy', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { startDate, endDate, isWishlist, copyMealPlan } = req.body;

    // Get the original event
    const originalEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        campground: true,
        meals: copyMealPlan ? {
          include: {
            recipe: true,
          }
        } : false,
      },
    });

    if (!originalEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Determine dates
    let eventStartDate: Date;
    let eventEndDate: Date;

    if (isWishlist) {
      // For wishlist, use a far future placeholder date
      eventStartDate = new Date('2099-01-01');
      eventEndDate = new Date('2099-01-01');
    } else {
      if (!startDate) {
        return res.status(400).json({ error: 'Start date is required for non-wishlist events' });
      }
      eventStartDate = new Date(startDate);
      eventEndDate = endDate ? new Date(endDate) : eventStartDate;
    }

    // Create the copied event
    const copiedEvent = await prisma.event.create({
      data: {
        title: originalEvent.title,
        description: originalEvent.description,
        location: originalEvent.location,
        campgroundId: originalEvent.campgroundId,
        organizerId: userId,
        startDate: eventStartDate,
        endDate: eventEndDate,
        isWishlist: isWishlist || false,
      },
    });

    // Copy meals if requested
    if (copyMealPlan && originalEvent.meals && originalEvent.meals.length > 0) {
      for (const meal of originalEvent.meals) {
        await prisma.eventMeal.create({
          data: {
            eventId: copiedEvent.id,
            mealType: meal.mealType,
            scheduledAt: meal.scheduledAt,
            recipeId: meal.recipeId,
            notes: meal.notes,
          },
        });
      }
    }

    // Add organizer as attendee
    await prisma.eventAttendee.create({
      data: {
        eventId: copiedEvent.id,
        userId: userId,
        status: 'going',
      },
    });

    res.json(copiedEvent);
  } catch (error) {
    console.error('Copy event error:', error);
    res.status(500).json({ error: 'Failed to copy event' });
  }
});


// Discover public events from everyone
router.get('/discover', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const events = await prisma.event.findMany({
      where: {
        privacy: 'PUBLIC',
        isWishlist: false,
        startDate: {
          gte: today,
        },
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            imageUrl: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
      take: 50,
    });

    res.json(events);
  } catch (error) {
    console.error('Discover events error:', error);
    res.status(500).json({ error: 'Failed to fetch public events' });
  }
});

// Get events from friends (PUBLIC or FRIENDS privacy)
router.get('/friends-events', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get friend IDs
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { initiatorId: userId },
          { receiverId: userId },
        ],
      },
      select: {
        initiatorId: true,
        receiverId: true,
      },
    });

    const friendIds = friendships.map(f => 
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    if (friendIds.length === 0) {
      return res.json([]);
    }

    const events = await prisma.event.findMany({
      where: {
        organizerId: { in: friendIds },
        isWishlist: false,
        privacy: { in: ['PUBLIC', 'FRIENDS'] },
        startDate: {
          gte: today,
        },
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            imageUrl: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
      take: 50,
    });

    res.json(events);
  } catch (error) {
    console.error('Friends events error:', error);
    res.status(500).json({ error: 'Failed to fetch friends events' });
  }
});

// GET /api/trips/my-events - Get user's events for linking


// GET /api/events/:id/albums - Get albums linked to a trip
router.get('/:id/albums', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const albums = await prisma.photoAlbum.findMany({
      where: { eventId: id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        photos: { take: 4, orderBy: { createdAt: 'desc' } },
        _count: { select: { photos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(albums);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// POST /api/events/:id/albums - Create a new album linked to this trip
router.post('/:id/albums', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { title, description, privacy } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const album = await prisma.photoAlbum.create({
      data: { userId, eventId: id, title, description, privacy: privacy || 'PUBLIC' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        _count: { select: { photos: true } },
      },
    });
    res.status(201).json(album);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// POST /api/events/:id/albums/link - Link an existing album to this trip
router.post('/:id/albums/link', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { albumId } = req.body;

    const album = await prisma.photoAlbum.findUnique({ where: { id: albumId } });
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.userId !== userId) return res.status(403).json({ error: 'Not your album' });

    const updated = await prisma.photoAlbum.update({
      where: { id: albumId },
      data: { eventId: id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        _count: { select: { photos: true } },
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to link album' });
  }
});

// DELETE /api/events/:id/albums/:albumId/unlink - Unlink album from trip
router.delete('/:id/albums/:albumId/unlink', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { albumId } = req.params;

    const album = await prisma.photoAlbum.findUnique({ where: { id: albumId } });
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.userId !== userId) return res.status(403).json({ error: 'Not your album' });

    await prisma.photoAlbum.update({ where: { id: albumId }, data: { eventId: null } });
    res.json({ message: 'Album unlinked' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unlink album' });
  }
});

export default router;