import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/events/:eventId/comments - Get event comments
router.get('/:eventId/comments', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const comments = await prisma.eventComment.findMany({
      where: { eventId },
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
      orderBy: { createdAt: 'desc' },
    });

    res.json(comments);
  } catch (error) {
    console.error('Get event comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/events/:eventId/comments - Create event comment
router.post('/:eventId/comments', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;
    const { content, mentions } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify user is an attendee
    const attendee = await prisma.eventAttendee.findFirst({
      where: { eventId, userId },
    });

    if (!attendee) {
      return res.status(403).json({ error: 'Only attendees can comment' });
    }

    // Get event details for notifications
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendees: { select: { userId: true } },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get commenter info
    const commenter = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const comment = await prisma.eventComment.create({
      data: {
        eventId,
        userId,
        content: content.trim(),
        mentions: mentions || [],
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

    // Notify mentioned users
    if (mentions && mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: { username: { in: mentions } },
        select: { id: true },
      });

      const mentionNotifications = mentionedUsers
        .filter((u) => u.id !== userId)
        .map((u) => ({
          userId: u.id,
          type: 'EVENT_MENTION',
          content: `${commenter?.firstName} mentioned you in "${event.title}"`,
          link: `/trips/${eventId}`,
        }));

      if (mentionNotifications.length > 0) {
        await prisma.notification.createMany({ data: mentionNotifications });
      }
    }

    // Notify all other attendees about the new comment
    const otherAttendees = event.attendees.filter(
      (a) => a.userId !== userId && !mentions?.includes(a.userId)
    );

    const commentNotifications = otherAttendees.map((a) => ({
      userId: a.userId,
      type: 'EVENT_COMMENT',
      content: `${commenter?.firstName} commented on "${event.title}"`,
      link: `/trips/${eventId}`,
    }));

    if (commentNotifications.length > 0) {
      await prisma.notification.createMany({ data: commentNotifications });
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create event comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// DELETE /api/events/:eventId/comments/:commentId - Delete comment
router.delete('/:eventId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).userId;

    const comment = await prisma.eventComment.findUnique({
      where: { id: commentId },
      include: { event: true },
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only comment author or event organizer can delete
    if (comment.userId !== userId && comment.event.organizerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await prisma.eventComment.delete({ where: { id: commentId } });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete event comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
