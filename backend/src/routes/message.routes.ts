import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/messages/unread-count - Get unread message count (must be before /:messageId)
router.get('/unread-count', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const count = await prisma.message.count({
      where: {
        recipientId: userId,
        isRead: false
      }
    });
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// GET /api/messages - Get user's messages (inbox)
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { recipientId: req.user.id },
      include: {
        sender: {
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

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messages/sent - Get sent messages
router.get('/sent', authenticateToken, async (req: any, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { senderId: req.user.id },
      include: {
        recipient: {
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

    res.json(messages);
  } catch (error) {
    console.error('Get sent messages error:', error);
    res.status(500).json({ error: 'Failed to fetch sent messages' });
  }
});

// GET /api/messages/:messageId - Get single message
router.get('/:messageId', authenticateToken, async (req: any, res) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        recipient: {
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

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.recipientId !== req.user.id && message.senderId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (message.recipientId === req.user.id && !message.isRead) {
      await prisma.message.update({
        where: { id: messageId },
        data: { isRead: true },
      });
    }

    res.json(message);
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// POST /api/messages - Send a message
router.post(
  '/',
  authenticateToken,
  [
    body('recipientId').notEmpty(),
    body('subject').optional().trim().isLength({ max: 200 }),
    body('content').trim().notEmpty(),
  ],
  async (req: any, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { recipientId, subject, content } = req.body;

      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
      });

      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      const message = await prisma.message.create({
        data: {
          senderId: req.user.id,
          recipientId,
          subject,
          content,
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true,
            },
          },
          recipient: {
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

      const sender = await prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true } });
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'MESSAGE',
          
          content: `${sender?.firstName || "Someone"} ${sender?.lastName || ""} sent you a message`,
          link: `/messages/${message.id}`,
        },
      });

      res.status(201).json(message);
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// DELETE /api/messages/:messageId - Delete a message
router.delete('/:messageId', authenticateToken, async (req: any, res) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.recipientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// PUT /api/messages/:messageId/read - Mark message as read
router.put('/:messageId/read', authenticateToken, async (req: any, res) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.recipientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

export default router;
