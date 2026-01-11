import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/notifications - Get user's notifications
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// GET /api/notifications/unread - Get unread count
router.get('/unread', authenticateToken, async (req: any, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.userId,
        read: false,
      },
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// POST /api/notifications - Create notification (for testing)
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const {
      type,
      title,
      content,
      link,
      eventId,
      eventTitle,
      eventDate,
      campgroundName,
      actorName,
    } = req.body;

    const notification = await prisma.notification.create({
      data: {
        userId: req.userId,
        type,
        title,
        content,
        link,
        eventId,
        eventTitle,
        eventDate: eventDate ? new Date(eventDate) : null,
        campgroundName,
        actorName,
      },
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// PUT /api/notifications/:notificationId/read - Mark as read
router.put('/:notificationId/read', authenticateToken, async (req: any, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', authenticateToken, async (req: any, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.userId,
        read: false,
      },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /api/notifications/:notificationId - Delete notification
router.delete('/:notificationId', authenticateToken, async (req: any, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
