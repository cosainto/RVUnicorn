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
      mealType: meal.mealType,
      menuItems: meal.recipe ? [meal.recipe.title] : [],
      ingredients: meal.recipe?.ingredients || [],
      notes: meal.notes,
      recipe: meal.recipe,
      cook: meal.cook,
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
    const { eventId, date, mealType, menuItems, recipeId, notes, assignedTo } = req.body;

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
        mealType,
        recipeId: recipeId || null,
        notes: menuItems ? (Array.isArray(menuItems) ? menuItems.join(', ') : menuItems) : notes,
        cookId: assignedTo || null,
      },
      include: {
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
      mealType: meal.mealType,
      menuItems: meal.recipe ? [meal.recipe.title] : (meal.notes ? meal.notes.split(', ') : []),
      ingredients: meal.recipe?.ingredients || [],
      notes: meal.notes,
      recipe: meal.recipe,
      cook: meal.cook,
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
    const { date, mealType, menuItems, recipeId, notes, assignedTo } = req.body;

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
        mealType: mealType || undefined,
        recipeId: recipeId !== undefined ? recipeId : undefined,
        notes: menuItems ? (Array.isArray(menuItems) ? menuItems.join(', ') : menuItems) : (notes !== undefined ? notes : undefined),
        cookId: assignedTo !== undefined ? (assignedTo || null) : undefined,
      },
      include: {
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
