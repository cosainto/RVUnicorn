import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

// GET /api/pack-list/:eventId - Get event pack list
router.get('/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Check if user is event attendee
    const attendee = await prisma.eventAttendee.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: req.user!.id
        }
      }
    });

    if (!attendee) {
      return res.status(403).json({ error: 'Not authorized - must be event attendee' });
    }

    const packItems = await prisma.eventPackItem.findMany({
      where: { eventId },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          }
        },
        linkedGear: {
          select: {
            id: true,
            name: true,
            category: true,
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(packItems);
  } catch (error) {
    console.error('Get pack list error:', error);
    res.status(500).json({ error: 'Failed to get pack list' });
  }
});

// POST /api/pack-list - Add item to event pack list
router.post(
  '/',
  authenticateToken,
  [
    body('eventId').notEmpty(),
    body('name').trim().notEmpty(),
    body('quantity').optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { eventId, name, quantity, notes, neededBy, linkedGearId } = req.body;

      // Check if user is event attendee
      const attendee = await prisma.eventAttendee.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId: req.user!.id
          }
        }
      });

      if (!attendee) {
        return res.status(403).json({ error: 'Not authorized - must be event attendee' });
      }

      const packItem = await prisma.eventPackItem.create({
        data: {
          eventId,
          name,
          quantity: quantity || 1,
          notes,
          neededBy: neededBy ? new Date(neededBy) : null,
          linkedGearId,
          createdById: req.user!.id,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true,
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            }
          }
        }
      });

      res.json(packItem);
    } catch (error) {
      console.error('Add pack item error:', error);
      res.status(500).json({ error: 'Failed to add pack item' });
    }
  }
);

// PUT /api/pack-list/:id - Update pack item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, notes, neededBy, status, assignedToId, linkedGearId } = req.body;

    const packItem = await prisma.eventPackItem.findUnique({
      where: { id },
      include: {
        event: {
          include: {
            attendees: true
          }
        }
      }
    });

    if (!packItem) {
      return res.status(404).json({ error: 'Pack item not found' });
    }

    // Check if user is event attendee
    const isAttendee = packItem.event.attendees.some(a => a.userId === req.user!.id);
    if (!isAttendee) {
      return res.status(403).json({ error: 'Not authorized - must be event attendee' });
    }

    const updatedItem = await prisma.eventPackItem.update({
      where: { id },
      data: {
        name,
        quantity,
        notes,
        neededBy: neededBy ? new Date(neededBy) : undefined,
        status,
        assignedToId,
        linkedGearId,
      },
      include: {
        assignedTo: {
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

    res.json(updatedItem);
  } catch (error) {
    console.error('Update pack item error:', error);
    res.status(500).json({ error: 'Failed to update pack item' });
  }
});

// DELETE /api/pack-list/:id - Delete pack item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const packItem = await prisma.eventPackItem.findUnique({
      where: { id },
      include: {
        event: true
      }
    });

    if (!packItem) {
      return res.status(404).json({ error: 'Pack item not found' });
    }

    // Only event creator can delete items
    if (packItem.event.createdById !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized - only event organizer can delete items' });
    }

    await prisma.eventPackItem.delete({
      where: { id }
    });

    res.json({ message: 'Pack item deleted' });
  } catch (error) {
    console.error('Delete pack item error:', error);
    res.status(500).json({ error: 'Failed to delete pack item' });
  }
});

// POST /api/pack-list/:id/assign - Assign item to attendee
router.post('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    const packItem = await prisma.eventPackItem.findUnique({
      where: { id },
      include: {
        event: {
          include: {
            attendees: true
          }
        }
      }
    });

    if (!packItem) {
      return res.status(404).json({ error: 'Pack item not found' });
    }

    // Check if user is event attendee
    const isAttendee = packItem.event.attendees.some(a => a.userId === req.user!.id);
    if (!isAttendee) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if assignee is event attendee
    const assigneeIsAttendee = packItem.event.attendees.some(a => a.userId === assignedToId);
    if (!assigneeIsAttendee) {
      return res.status(400).json({ error: 'Assignee must be event attendee' });
    }

    const updatedItem = await prisma.eventPackItem.update({
      where: { id },
      data: {
        assignedToId,
        status: 'ASSIGNED',
      },
      include: {
        assignedTo: {
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

    // Create notification for assignee
    if (assignedToId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          type: 'PACK_ASSIGNMENT',
          content: `You've been assigned to bring "${packItem.name}" for ${packItem.event.title}`,
        }
      });
    }

    res.json(updatedItem);
  } catch (error) {
    console.error('Assign pack item error:', error);
    res.status(500).json({ error: 'Failed to assign pack item' });
  }
});

// POST /api/pack-list/:id/mark-packed - Mark item as packed
router.post('/:id/mark-packed', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const packItem = await prisma.eventPackItem.findUnique({
      where: { id },
      include: {
        event: {
          include: {
            attendees: true
          }
        }
      }
    });

    if (!packItem) {
      return res.status(404).json({ error: 'Pack item not found' });
    }

    // Only assigned person or event organizer can mark as packed
    const isAssignee = packItem.assignedToId === req.user!.id;
    const isOrganizer = packItem.event.createdById === req.user!.id;
    
    if (!isAssignee && !isOrganizer) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedItem = await prisma.eventPackItem.update({
      where: { id },
      data: {
        status: 'PACKED',
      },
      include: {
        assignedTo: {
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

    res.json(updatedItem);
  } catch (error) {
    console.error('Mark packed error:', error);
    res.status(500).json({ error: 'Failed to mark as packed' });
  }
});

// POST /api/pack-list/:id/cant-bring - Mark that assignee can't bring item
router.post('/:id/cant-bring', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const packItem = await prisma.eventPackItem.findUnique({
      where: { id },
      include: {
        event: true
      }
    });

    if (!packItem) {
      return res.status(404).json({ error: 'Pack item not found' });
    }

    // Only assigned person can mark can't bring
    if (packItem.assignedToId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedItem = await prisma.eventPackItem.update({
      where: { id },
      data: {
        status: 'OPEN',
        assignedToId: null,
        notes: reason ? `${packItem.notes || ''}\n[Can't bring: ${reason}]` : packItem.notes,
      }
    });

    // Notify event organizer
    await prisma.notification.create({
      data: {
        userId: packItem.event.createdById,
        type: 'PACK_CANT_BRING',
        content: `${req.user!.firstName} can't bring "${packItem.name}" for ${packItem.event.title}`,
      }
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Mark cant bring error:', error);
    res.status(500).json({ error: 'Failed to mark cant bring' });
  }
});

export default router;
