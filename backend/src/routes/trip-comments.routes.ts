import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/events/:eventId/comments - Get event comments
router.get('/:eventId/comments', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;

    // Check if user is blocked from this event
    const isBlocked = await prisma.eventBlockedUser.findUnique({
      where: {
        eventId_userId: { eventId, userId }
      }
    });

    if (isBlocked) {
      return res.status(403).json({ error: 'You do not have access to this event' });
    }

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

// GET /api/events/:eventId/mute-status - Check if user has muted event notifications
router.get('/:eventId/mute-status', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;

    const muted = await prisma.eventCommentMute.findUnique({
      where: {
        userId_eventId: { userId, eventId }
      }
    });

    res.json({ muted: !!muted });
  } catch (error) {
    console.error('Check mute status error:', error);
    res.status(500).json({ error: 'Failed to check mute status' });
  }
});

// POST /api/events/:eventId/mute-comments - Mute event comment notifications
router.post('/:eventId/mute-comments', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;

    const existing = await prisma.eventCommentMute.findUnique({
      where: {
        userId_eventId: { userId, eventId }
      }
    });

    if (existing) {
      return res.json({ message: 'Already muted', muted: true });
    }

    await prisma.eventCommentMute.create({
      data: { userId, eventId }
    });

    res.json({ message: 'Event notifications muted', muted: true });
  } catch (error) {
    console.error('Mute event error:', error);
    res.status(500).json({ error: 'Failed to mute event' });
  }
});

// DELETE /api/events/:eventId/mute-comments - Unmute event comment notifications
router.delete('/:eventId/mute-comments', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;

    await prisma.eventCommentMute.deleteMany({
      where: { userId, eventId }
    });

    res.json({ message: 'Event notifications unmuted', muted: false });
  } catch (error) {
    console.error('Unmute event error:', error);
    res.status(500).json({ error: 'Failed to unmute event' });
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

    // Check if user is blocked from this event
    const isBlocked = await prisma.eventBlockedUser.findUnique({
      where: {
        eventId_userId: { eventId, userId }
      }
    });

    if (isBlocked) {
      return res.status(403).json({ error: 'You do not have access to this event' });
    }

    // Get event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendees: { 
          select: { userId: true, status: true },
          where: { status: { in: ['going', 'GOING', 'invited', 'INVITED'] } }
        },
        organizer: {
          select: { id: true, firstName: true, lastName: true, username: true }
        }
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // For PUBLIC events, anyone can comment
    // For FRIENDS/PRIVATE events, verify user is an attendee or organizer
    if (event.privacy !== 'PUBLIC') {
      const isAttendee = event.attendees.some(a => a.userId === userId);
      const isOrganizer = event.organizerId === userId;
      
      if (!isAttendee && !isOrganizer) {
        return res.status(403).json({ error: 'Only attendees can comment on this event' });
      }
    }

    // Get commenter info
    const commenter = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, username: true },
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

    const commenterName = commenter?.firstName && commenter?.lastName
      ? `${commenter.firstName} ${commenter.lastName}`
      : commenter?.username || 'Someone';

    // === NOTIFICATION LOGIC FOR PUBLIC EVENTS ===
    if (event.privacy === 'PUBLIC') {
      // Get users who have muted this event
      const mutedUsers = await prisma.eventCommentMute.findMany({
        where: { eventId },
        select: { userId: true }
      });
      const mutedUserIds = new Set(mutedUsers.map(m => m.userId));

      // 1. Get previous commenters
      const previousCommenters = await prisma.eventComment.findMany({
        where: {
          eventId,
          userId: { not: userId }
        },
        select: { userId: true },
        distinct: ['userId']
      });

      // 2. Get attendees (going or invited)
      const attendeeIds = event.attendees.map(a => a.userId);

      // 3. Get tagged/mentioned users from this comment
      let mentionedUserIds: string[] = [];
      if (mentions && mentions.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: { username: { in: mentions } },
          select: { id: true }
        });
        mentionedUserIds = mentionedUsers.map(u => u.id);
      }

      // Combine all users to notify (unique)
      const allUsersToNotify = new Set<string>([
        ...previousCommenters.map(c => c.userId),
        ...attendeeIds,
        ...mentionedUserIds,
        event.organizerId // Always notify organizer
      ]);

      // Remove: current user, muted users
      allUsersToNotify.delete(userId);
      mutedUserIds.forEach(id => allUsersToNotify.delete(id));

      // Create Basecamp activity notifications
      for (const notifyUserId of allUsersToNotify) {
        await prisma.basecampActivity.create({
          data: {
            userId: notifyUserId,
            actorId: userId,
            type: 'EVENT_COMMENT',
            entityType: 'EVENT',
            entityId: eventId,
            entityName: event.title,
            metadata: {
              commentPreview: content.trim().substring(0, 100),
              commenterName,
              canMute: true
            }
          }
        });
      }

      // Also create standard notifications for mentioned users
      if (mentionedUserIds.length > 0) {
        const mentionNotifications = mentionedUserIds
          .filter(id => id !== userId && !mutedUserIds.has(id))
          .map(id => ({
            userId: id,
            type: 'EVENT_MENTION',
            content: `${commenterName} mentioned you in "${event.title}"`,
            link: `/trips/${eventId}`,
          }));

        if (mentionNotifications.length > 0) {
          await prisma.notification.createMany({ data: mentionNotifications });
        }
      }
    } else {
      // For non-PUBLIC events, use existing notification logic
      const otherAttendees = event.attendees.filter(
        (a) => a.userId !== userId
      );

      // Get muted users
      const mutedUsers = await prisma.eventCommentMute.findMany({
        where: { eventId },
        select: { userId: true }
      });
      const mutedUserIds = new Set(mutedUsers.map(m => m.userId));

      const commentNotifications = otherAttendees
        .filter(a => !mutedUserIds.has(a.userId))
        .map((a) => ({
          userId: a.userId,
          type: 'EVENT_COMMENT',
          content: `${commenterName} commented on "${event.title}"`,
          link: `/trips/${eventId}`,
        }));

      // Notify organizer if not the commenter and not muted
      if (event.organizerId !== userId && !mutedUserIds.has(event.organizerId)) {
        commentNotifications.push({
          userId: event.organizerId,
          type: 'EVENT_COMMENT',
          content: `${commenterName} commented on "${event.title}"`,
          link: `/trips/${eventId}`,
        });
      }

      if (commentNotifications.length > 0) {
        await prisma.notification.createMany({ data: commentNotifications });
      }

      // Handle mentions
      if (mentions && mentions.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: { username: { in: mentions } },
          select: { id: true },
        });

        const mentionNotifications = mentionedUsers
          .filter((u) => u.id !== userId && !mutedUserIds.has(u.id))
          .map((u) => ({
            userId: u.id,
            type: 'EVENT_MENTION',
            content: `${commenterName} mentioned you in "${event.title}"`,
            link: `/trips/${eventId}`,
          }));

        if (mentionNotifications.length > 0) {
          await prisma.notification.createMany({ data: mentionNotifications });
        }
      }
    }

    // === PROFILE FEED ACTIVITY (only for non-PRIVATE events) ===
    if (event.privacy !== 'PRIVATE') {
      await prisma.activity.create({
        data: {
          userId,
          type: 'EVENT_COMMENTED',
          eventId,
          title: event.title,
          content: content.trim().substring(0, 100),
          isPublic: event.privacy === 'PUBLIC',
          isCreatorContent: false
        }
      });
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
