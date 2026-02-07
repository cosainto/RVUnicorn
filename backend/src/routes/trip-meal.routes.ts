import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = express.Router();

// GET /api/event-meals/:eventId - Get meal plan for event
router.get('/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const meals = await prisma.eventMeal.findMany({
      where: { eventId },
      include: {
        rsvps: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              }
            }
          }
        },
        cook: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        recipe: {
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            prepTime: true,
            cookTime: true,
            servings: true,
            ingredients: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      },
      orderBy: [{ scheduledAt: 'asc' }, { mealType: 'asc' }]
    });

    // Transform to match frontend expectations
    const transformedMeals = meals.map(meal => ({
      id: meal.id,
      eventId: meal.eventId,
      date: meal.scheduledAt.toISOString().split('T')[0],
      scheduledTime: meal.scheduledTime,
      mealType: meal.mealType,
      menuItems: meal.recipe ? [meal.recipe.title] : [],
      ingredients: meal.recipe?.ingredients || [],
      notes: meal.notes,
      recipe: meal.recipe,
      cook: meal.cook,
      cookStatus: meal.cookStatus,
      rsvps: meal.rsvps,
    }));

    res.json(transformedMeals);
  } catch (error) {
    console.error('Get event meals error:', error);
    res.status(500).json({ error: 'Failed to fetch event meals' });
  }
});

// POST /api/event-meals - Add meal to event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId, date, mealType, menuItems, recipeId, notes, assignedTo, scheduledTime } = req.body;

    if (!eventId || !date || !mealType) {
      return res.status(400).json({ error: 'Event, date, and meal type are required' });
    }

    // Verify event exists and check permissions
    const event = await prisma.event.findUnique({
      where: { id: eventId },
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

    // If menuItems provided but no recipeId, we'll just store the notes
    // The schema requires scheduledAt and mealType
    const meal = await prisma.eventMeal.create({
      data: {
        eventId,
        scheduledAt: new Date(date),
        scheduledTime: scheduledTime || null,
        mealType,
        recipeId: recipeId || null,
        notes: menuItems ? (Array.isArray(menuItems) ? menuItems.join(', ') : menuItems) : notes,
        cookId: assignedTo || null,
      },
      include: {
        rsvps: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              }
            }
          }
        },
        cook: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        recipe: {
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            ingredients: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    // Transform response
    const transformedMeal = {
      id: meal.id,
      eventId: meal.eventId,
      date: meal.scheduledAt.toISOString().split('T')[0],
      scheduledTime: meal.scheduledTime,
      mealType: meal.mealType,
      menuItems: meal.recipe ? [meal.recipe.title] : (meal.notes ? meal.notes.split(', ') : []),
      ingredients: meal.recipe?.ingredients || [],
      notes: meal.notes,
      recipe: meal.recipe,
      cook: meal.cook,
      cookStatus: meal.cookStatus,
      rsvps: meal.rsvps,
    };

    res.json(transformedMeal);
  } catch (error) {
    console.error('Add event meal error:', error);
    res.status(500).json({ error: 'Failed to add meal' });
  }
});

// PUT /api/event-meals/:id - Update meal
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { date, mealType, menuItems, recipeId, notes, assignedTo, scheduledTime } = req.body;

    const meal = await prisma.eventMeal.findUnique({
      where: { id },
      include: { event: true }
    });

    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    // Check permissions
    const event = await prisma.event.findUnique({
      where: { id: meal.eventId },
      include: {
        attendees: {
          where: { userId, status: { in: ["GOING", "going"] } }
        }
      }
    });

    const isOrganizer = event?.organizerId === userId;
    const isGoingAttendee = event?.attendees && event.attendees.length > 0;

    if (!isOrganizer && !isGoingAttendee) {
      return res.status(403).json({ error: 'Only the organizer or attending members can update meals' });
    }

    const updatedMeal = await prisma.eventMeal.update({
      where: { id },
      data: {
        scheduledAt: date ? new Date(date) : undefined,
        scheduledTime: scheduledTime !== undefined ? scheduledTime : undefined,
        mealType: mealType || undefined,
        recipeId: recipeId !== undefined ? recipeId : undefined,
        notes: menuItems ? (Array.isArray(menuItems) ? menuItems.join(', ') : menuItems) : (notes !== undefined ? notes : undefined),
        cookId: assignedTo !== undefined ? (assignedTo || null) : undefined,
      },
      include: {
        rsvps: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              }
            }
          }
        },
        cook: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        recipe: {
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            ingredients: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    // Transform response
    const transformedMeal = {
      id: updatedMeal.id,
      eventId: updatedMeal.eventId,
      date: updatedMeal.scheduledAt.toISOString().split('T')[0],
      mealType: updatedMeal.mealType,
      menuItems: updatedMeal.recipe ? [updatedMeal.recipe.title] : (updatedMeal.notes ? updatedMeal.notes.split(', ') : []),
      ingredients: updatedMeal.recipe?.ingredients || [],
      notes: updatedMeal.notes,
      recipe: updatedMeal.recipe,
    };

    res.json(transformedMeal);
  } catch (error) {
    console.error('Update event meal error:', error);
    res.status(500).json({ error: 'Failed to update meal' });
  }
});

// DELETE /api/event-meals/:id - Delete meal
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const meal = await prisma.eventMeal.findUnique({
      where: { id }
    });

    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    // Check permissions
    const event = await prisma.event.findUnique({
      where: { id: meal.eventId },
      include: {
        attendees: {
          where: { userId, status: { in: ["GOING", "going"] } }
        }
      }
    });

    const isOrganizer = event?.organizerId === userId;
    const isGoingAttendee = event?.attendees && event.attendees.length > 0;

    if (!isOrganizer && !isGoingAttendee) {
      return res.status(403).json({ error: 'Only the organizer or attending members can delete meals' });
    }

    await prisma.eventMeal.delete({
      where: { id }
    });

    res.json({ message: 'Meal deleted' });
  } catch (error) {
    console.error('Delete event meal error:', error);
    res.status(500).json({ error: 'Failed to delete meal' });
  }
});

export default router;

// POST /api/event-meals/:id/rsvp - RSVP to a meal
router.post('/:id/rsvp', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id: mealId } = req.params;
    const { status } = req.body;

    if (!status || !['attending', 'not_attending', 'maybe'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required: attending, not_attending, or maybe' });
    }

    // Check meal exists
    const meal = await prisma.eventMeal.findUnique({
      where: { id: mealId }
    });

    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    // Check user is attending the event
    const event = await prisma.event.findUnique({
      where: { id: meal.eventId },
      include: {
        attendees: {
          where: { userId, status: { in: ["GOING", "going"] } }
        }
      }
    });

    const isOrganizer = event?.organizerId === userId;
    const isGoingAttendee = event?.attendees && event.attendees.length > 0;

    if (!isOrganizer && !isGoingAttendee) {
      return res.status(403).json({ error: 'Only the organizer or attending members can RSVP to meals' });
    }

    // Upsert the RSVP
    const rsvp = await prisma.mealRSVP.upsert({
      where: {
        mealId_userId: {
          mealId,
          userId
        }
      },
      update: { status },
      create: {
        mealId,
        userId,
        status
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true
          }
        }
      }
    });

    res.json(rsvp);
  } catch (error) {
    console.error('Meal RSVP error:', error);
    res.status(500).json({ error: 'Failed to RSVP to meal' });
  }
});


// POST /api/event-meals/:id/assign-cook - Assign a cook to a meal
router.post('/:id/assign-cook', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id: mealId } = req.params;
    const { cookId } = req.body;

    if (!cookId) {
      return res.status(400).json({ error: 'Cook ID is required' });
    }

    // Get meal with event info
    const meal = await prisma.eventMeal.findUnique({
      where: { id: mealId },
      include: {
        event: {
          include: {
            attendees: true
          }
        },
        recipe: {
          select: { id: true, title: true }
        }
      }
    });

    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    // Check permissions - only organizer or going attendees can assign
    const isOrganizer = meal.event.organizerId === userId;
    const isGoingAttendee = meal.event.attendees.some(
      a => a.userId === userId && ['GOING', 'going'].includes(a.status)
    );

    if (!isOrganizer && !isGoingAttendee) {
      return res.status(403).json({ error: 'Not authorized to assign cook' });
    }

    // Verify the cook is an attendee of the event
    const cookIsAttendee = meal.event.attendees.some(
      a => a.userId === cookId && ['GOING', 'going'].includes(a.status)
    ) || meal.event.organizerId === cookId;

    if (!cookIsAttendee) {
      return res.status(400).json({ error: 'Cook must be an attendee of the event' });
    }

    // Update meal with cook assignment
    const updatedMeal = await prisma.eventMeal.update({
      where: { id: mealId },
      data: {
        cookId,
        cookStatus: 'PENDING'
      },
      include: {
        cook: {
          select: { id: true, firstName: true, lastName: true, username: true }
        },
        recipe: {
          select: { id: true, title: true }
        },
        event: {
          select: { id: true, title: true }
        }
      }
    });

    // Get assigner info
    const assigner = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true }
    });

    // Create notification for the cook
    await prisma.notification.create({
      data: {
        userId: cookId,
        type: 'MEAL_ASSIGNMENT',
        content: `${assigner?.firstName} ${assigner?.lastName} has asked you to prepare "${meal.recipe?.title || 'a meal'}" for ${meal.event.title}`,
        link: `/trips/${meal.eventId}`
      }
    });

    // Create activity for Basecamp feed
    await prisma.basecampActivity.create({
      data: {
        userId: cookId,
        actorId: userId,
        type: 'MEAL_ASSIGNMENT_REQUEST',
        entityType: 'EVENT_MEAL',
        entityId: mealId,
        entityName: meal.recipe?.title || 'Meal',
        metadata: JSON.stringify({
          mealId,
          recipeId: meal.recipeId,
          recipeTitle: meal.recipe?.title,
          eventId: meal.eventId,
          eventTitle: meal.event.title,
          mealType: meal.mealType,
          scheduledAt: meal.scheduledAt
        })
      }
    });

    res.json(updatedMeal);
  } catch (error) {
    console.error('Assign cook error:', error);
    res.status(500).json({ error: 'Failed to assign cook' });
  }
});

// PUT /api/event-meals/:id/cook-response - Cook responds to assignment
router.put('/:id/cook-response', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id: mealId } = req.params;
    const { status } = req.body;

    if (!status || !['ACCEPTED', 'DECLINED', 'UNDECIDED'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required: ACCEPTED, DECLINED, or UNDECIDED' });
    }

    // Get meal
    const meal = await prisma.eventMeal.findUnique({
      where: { id: mealId },
      include: {
        event: {
          select: { id: true, title: true, organizerId: true }
        },
        recipe: {
          select: { id: true, title: true }
        }
      }
    });

    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    // Only the assigned cook can respond
    if (meal.cookId !== userId) {
      return res.status(403).json({ error: 'Only the assigned cook can respond' });
    }

    // Update meal status
    const updatedMeal = await prisma.eventMeal.update({
      where: { id: mealId },
      data: { cookStatus: status },
      include: {
        cook: {
          select: { id: true, firstName: true, lastName: true, username: true }
        },
        recipe: {
          select: { id: true, title: true }
        },
        event: {
          select: { id: true, title: true, privacy: true }
        }
      }
    });

    // Get cook info
    const cook = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true }
    });

    // Notify event organizer of response
    await prisma.notification.create({
      data: {
        userId: meal.event.organizerId,
        type: 'MEAL_ASSIGNMENT_RESPONSE',
        content: `${cook?.firstName} ${cook?.lastName} has ${status.toLowerCase()} cooking "${meal.recipe?.title || 'a meal'}" for ${meal.event.title}`,
        link: `/trips/${meal.eventId}`
      }
    });

    // Mark the basecamp activity as read
    await prisma.basecampActivity.updateMany({
      where: {
        userId,
        entityId: mealId,
        type: 'MEAL_ASSIGNMENT_REQUEST'
      },
      data: { isRead: true }
    });

    // If accepted, create activity for profile feed (respects event privacy)
    if (status === 'ACCEPTED' && updatedMeal.event.privacy !== 'PRIVATE') {
      await prisma.activity.create({
        data: {
          userId,
          type: 'MEAL_ACCEPTED',
          eventId: meal.eventId,
          recipeId: meal.recipeId,
          title: `${cook?.firstName} is preparing ${meal.recipe?.title || 'a meal'} for ${meal.event.title}`,
          isPublic: updatedMeal.event.privacy === 'PUBLIC'
        }
      });
    }

    res.json(updatedMeal);
  } catch (error) {
    console.error('Cook response error:', error);
    res.status(500).json({ error: 'Failed to update response' });
  }
});

// GET /api/event-meals/my-assignments - Get user's meal assignments
router.get('/my-assignments', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const assignments = await prisma.eventMeal.findMany({
      where: {
        cookId: userId,
        event: {
          endDate: { gte: new Date() }
        }
      },
      include: {
        recipe: {
          select: { id: true, title: true, imageUrl: true }
        },
        event: {
          select: { id: true, title: true, startDate: true, endDate: true }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});
