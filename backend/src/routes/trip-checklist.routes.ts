import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { notificationService } from '../services/notification.service';

const router = Router({ mergeParams: true });
import { prisma } from '../lib/prisma';

// GET /api/events/:eventId/checklist - Get checklist items
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const { eventId } = req.params;

    const items = await prisma.checklistItem.findMany({
      where: { eventId },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(items);
  } catch (error: any) {
    console.error('Get checklist error:', error);
    res.status(500).json({ error: 'Failed to get checklist' });
  }
});

// POST /api/events/:eventId/checklist - Add checklist item
router.post(
  '/',
  authenticateToken,
  [body('title').trim().notEmpty()],
  async (req: any, res: any) => {
    try {
      const { eventId } = req.params;
      const { title, assignedToId, dueDate } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          campground: { select: { name: true } },
        },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const item = await prisma.checklistItem.create({
        data: {
          eventId,
          title,
          assignedToId: assignedToId || null,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // If assigned to someone, notify them
      if (assignedToId) {
        const currentUser = await prisma.user.findUnique({
          where: { id: (req as any).user.id },
          select: { firstName: true, lastName: true },
        });

        await notificationService.notifyChecklistAssigned({
          userId: assignedToId,
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.startDate,
          campgroundName: event.campground?.name,
          itemTitle: title,
          dueDate: dueDate ? new Date(dueDate).toLocaleDateString() : undefined,
          assignedBy: {
            id: (req as any).user.id,
            name: `${currentUser?.firstName} ${currentUser?.lastName}`,
          },
        });
      }

      res.status(201).json(item);
    } catch (error: any) {
      console.error('Add checklist item error:', error);
      res.status(500).json({ error: 'Failed to add checklist item' });
    }
  }
);

// PUT /api/events/:eventId/checklist/:itemId - Update checklist item
router.put(
  '/:itemId',
  authenticateToken,
  async (req: any, res) => {
    try {
      const { eventId, itemId } = req.params;
      const { completed } = req.body;

      const item = await prisma.checklistItem.findUnique({
        where: { id: itemId },
        include: {
          event: {
            include: {
              campground: { select: { name: true } },
              invites: { select: { inviteeId: true } },
            },
          },
        },
      });

      if (!item || item.eventId !== eventId) {
        return res.status(404).json({ error: 'Checklist item not found' });
      }

      const updated = await prisma.checklistItem.update({
        where: { id: itemId },
        data: { completed },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // If marked as completed, notify attendees
      if (completed && !item.completed) {
        const currentUser = await prisma.user.findUnique({
          where: { id: (req as any).user.id },
          select: { firstName: true, lastName: true },
        });

        const notifyIds = [
          item.event.creatorId,
          ...item.event.invites.map((i: any) => i.inviteeId),
        ].filter(id => id !== (req as any).user.id);

        if (notifyIds.length > 0) {
          await notificationService.notifyChecklistCompleted({
            userIds: notifyIds,
            eventId: item.event.id,
            eventTitle: item.event.title,
            eventDate: item.event.startDate,
            campgroundName: item.event.campground?.name,
            itemTitle: item.title,
            completedBy: {
              id: (req as any).user.id,
              name: `${currentUser?.firstName} ${currentUser?.lastName}`,
            },
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Update checklist item error:', error);
      res.status(500).json({ error: 'Failed to update checklist item' });
    }
  }
);

export default router;
