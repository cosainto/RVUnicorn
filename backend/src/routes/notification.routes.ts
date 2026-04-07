import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// SSE: Real-time notification stream
const clients = new Map<string, Set<any>>();

router.get('/stream', (req: any, res) => {
  // SSE connections can't set Authorization headers — accept token as query param
  if (!req.headers.authorization && (req.query as any).token) {
    req.headers.authorization = `Bearer ${(req.query as any).token}`;
  }
  // Verify token inline
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).end(); return; }
  try {
    const jwt = require('jsonwebtoken');
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
  } catch { res.status(401).end(); return; }
  const userId = req.userId;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const heartbeat = setInterval(() => res.write('event: ping\ndata: {}\n\n'), 30000);
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.get(userId)?.delete(res);
    if (clients.get(userId)?.size === 0) clients.delete(userId);
  });

  res.write('event: connected\ndata: {"status":"connected"}\n\n');
});

export function pushNotification(userId: string, notification: any) {
  const userClients = clients.get(userId);
  if (userClients) {
    const data = JSON.stringify(notification);
    userClients.forEach((client) => client.write(`event: notification\ndata: ${data}\n\n`));
  }
}

// GET /api/notifications — with category filter + pagination
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const { category, read, limit = '50', offset = '0' } = req.query;
    const where: any = { userId: req.userId };
    if (category && category !== 'all') where.category = category;
    if (read === 'true') where.read = true;
    if (read === 'false') where.read = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({ notifications, total });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// GET /api/notifications/unread — counts per category
router.get('/unread', authenticateToken, async (req: any, res) => {
  try {
    const [total, messages, friends, campground, system, events] = await Promise.all([
      prisma.notification.count({ where: { userId: req.userId, read: false } }),
      prisma.notification.count({ where: { userId: req.userId, read: false, category: 'MESSAGE' } }),
      prisma.notification.count({ where: { userId: req.userId, read: false, category: 'FRIEND' } }),
      prisma.notification.count({ where: { userId: req.userId, read: false, category: 'CAMPGROUND' } }),
      prisma.notification.count({ where: { userId: req.userId, read: false, category: 'SYSTEM' } }),
      prisma.notification.count({ where: { userId: req.userId, read: false, category: 'EVENT' } }),
    ]);
    res.json({ count: total, messages, friends, campground, system, events });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// POST /api/notifications
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { type, content, link, category = 'SYSTEM', actorId, actorName, actorAvatar, metadata } = req.body;
    const notification = await prisma.notification.create({
      data: { userId: req.userId, type, content, link, category, actorId, actorName, actorAvatar, metadata: metadata || {} },
    });
    pushNotification(req.userId, notification);
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// PUT /api/notifications/:notificationId/read
router.put('/:notificationId/read', authenticateToken, async (req: any, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) return res.status(404).json({ error: 'Not found' });
    if (notification.userId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const updated = await prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticateToken, async (req: any, res) => {
  try {
    const { category } = req.body || {};
    const where: any = { userId: req.userId, read: false };
    if (category && category !== 'all') where.category = category;
    await prisma.notification.updateMany({ where, data: { read: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /api/notifications/:notificationId
router.delete('/:notificationId', authenticateToken, async (req: any, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) return res.status(404).json({ error: 'Not found' });
    if (notification.userId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.notification.delete({ where: { id: notificationId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// POST /api/notifications/bulk-delete
router.post('/bulk-delete', authenticateToken, async (req: any, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    await prisma.notification.deleteMany({ where: { id: { in: ids }, userId: req.userId } });
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// POST /api/notifications/quick-reply
router.post('/quick-reply', authenticateToken, async (req: any, res) => {
  try {
    const { notificationId, recipientId, content } = req.body;
    if (!recipientId || !content) return res.status(400).json({ error: 'recipientId and content required' });

    const message = await prisma.message.create({
      data: { senderId: req.userId, recipientId, content },
    });

    if (notificationId) {
      await prisma.notification.update({ where: { id: notificationId }, data: { read: true } }).catch(() => {});
    }

    const sender = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { username: true, firstName: true, lastName: true, profilePicture: true },
    });
    const senderName = sender?.firstName ? `${sender.firstName} ${sender.lastName || ''}`.trim() : sender?.username || 'Someone';

    const newNotif = await prisma.notification.create({
      data: {
        userId: recipientId, type: 'NEW_MESSAGE', content: `${senderName} sent you a message`,
        link: '/messages', category: 'MESSAGE', actorId: req.userId, actorName: senderName,
        actorAvatar: sender?.profilePicture, metadata: { messageId: message.id, preview: content.substring(0, 100) },
      },
    });
    pushNotification(recipientId, newNotif);

    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

export default router;
