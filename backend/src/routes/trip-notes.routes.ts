import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import { notificationService } from '../services/notification.service';

const router = Router({ mergeParams: true });
import { prisma } from '../lib/prisma';

// GET /api/events/:eventId/notes - Get event notes
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const { eventId } = req.params;

    const notes = await prisma.eventNote.findMany({
      where: { eventId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(notes);
  } catch (error: any) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to get notes' });
  }
});

// POST /api/events/:eventId/notes - Add note
router.post(
  '/',
  authenticateToken,
  [body('content').trim().notEmpty()],
  async (req: any, res: any) => {
    try {
      const { eventId } = req.params;
      const { content } = req.body;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          campground: { select: { name: true } },
          invites: { select: { inviteeId: true } },
        },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const note = await prisma.eventNote.create({
        data: {
          eventId,
          authorId: (req as any).user.id,
          content,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Get current user info
      const currentUser = await prisma.user.findUnique({
        where: { id: (req as any).user.id },
        select: { firstName: true, lastName: true },
      });

      // Notify all attendees (except the note author)
      const notifyIds = [
        event.creatorId,
        ...event.invites.map((i: any) => i.inviteeId),
      ].filter(id => id !== (req as any).user.id);

      if (notifyIds.length > 0) {
        const notePreview = content.length > 100 ? content.substring(0, 100) + '...' : content;
        await notificationService.notifyNoteAdded({
          userIds: notifyIds,
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.startDate,
          campgroundName: event.campground?.name,
          notePreview,
          addedBy: {
            id: (req as any).user.id,
            name: `${currentUser?.firstName} ${currentUser?.lastName}`,
          },
        });
      }

      res.status(201).json(note);
    } catch (error: any) {
      console.error('Add note error:', error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  }
);

export default router;
