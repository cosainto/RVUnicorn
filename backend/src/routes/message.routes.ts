import { Router, Response } from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { sendEmail, newMessageEmail } from '../services/email-sms.service';

const router = Router();
const prisma = new PrismaClient() as any;

// Hydrate participantIds into compact user summaries so the UI can render
// "Reply All to Stefanie, Mark, +2" without doing N round trips.
async function hydrateParticipants(ids: string[]) {
  if (!ids || ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
  });
  // Preserve original order
  const map = new Map(users.map((u: any) => [u.id, u]));
  return ids.map(id => map.get(id)).filter(Boolean);
}

async function attachParticipants<T extends { participantIds: string[] }>(messages: T[]) {
  // Collect every unique id across the batch in one query
  const allIds = Array.from(new Set(messages.flatMap(m => m.participantIds || [])));
  if (allIds.length === 0) return messages.map(m => ({ ...m, participants: [] }));
  const users = await prisma.user.findMany({
    where: { id: { in: allIds } },
    select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
  });
  const map = new Map(users.map((u: any) => [u.id, u]));
  return messages.map(m => ({
    ...m,
    participants: (m.participantIds || []).map(id => map.get(id)).filter(Boolean),
  }));
}

// GET /api/messages/unread-count - Get unread message count (must be before /:messageId)
router.get('/unread-count', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user?.id;
    const count = await prisma.message.count({
      where: {
        recipientId: userId,
        isRead: false
      }
    });
    res.json({ count });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// GET /api/messages - Get user's messages (inbox)
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { recipientId: (req as any).user.id },
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

    res.json(await attachParticipants(messages));
  } catch (error: any) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messages/sent - Get sent messages
router.get('/sent', authenticateToken, async (req: any, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { senderId: (req as any).user.id },
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

    res.json(await attachParticipants(messages));
  } catch (error: any) {
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

    if (message.recipientId !== (req as any).user.id && message.senderId !== (req as any).user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (message.recipientId === (req as any).user.id && !message.isRead) {
      await prisma.message.update({
        where: { id: messageId },
        data: { isRead: true },
      });
    }

    const participants = await hydrateParticipants(message.participantIds || []);
    res.json({ ...message, participants });
  } catch (error: any) {
    console.error('Get message error:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// POST /api/messages - Send a message (supports CC + reply threading)
//
// Body: { recipientId, subject?, content, ccUserIds?: string[], inReplyToId?: string }
//
// Behavior: creates one Message row per recipient (primary + each CC), all
// sharing the same threadId and participantIds. This makes "Reply All"
// possible — every recipient sees who else was on the original message.
router.post(
  '/',
  authenticateToken,
  [
    body('recipientId').notEmpty(),
    body('subject').optional().trim().isLength({ max: 200 }),
    body('content').trim().notEmpty(),
    body('ccUserIds').optional().isArray(),
    body('inReplyToId').optional().isString(),
  ],
  async (req: any, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const senderId: string = (req as any).user.id;
      const { recipientId, subject, content, inReplyToId } = req.body;
      const rawCc: string[] = Array.isArray(req.body.ccUserIds) ? req.body.ccUserIds : [];

      // Dedupe CC: drop sender, drop primary recipient, drop dupes
      const ccUserIds = Array.from(new Set(rawCc)).filter(id => id && id !== senderId && id !== recipientId);

      // Verify primary recipient exists
      const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      // Verify CC recipients exist (drop any that don't, don't fail the whole send)
      const validCcUsers = ccUserIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: ccUserIds } }, select: { id: true } })
        : [];
      const validCcIds = validCcUsers.map((u: any) => u.id);

      // If this is a reply, inherit the parent's threadId so the chain stays linked
      let threadId: string;
      if (inReplyToId) {
        const parent = await prisma.message.findUnique({
          where: { id: inReplyToId },
          select: { threadId: true },
        });
        threadId = parent?.threadId || crypto.randomUUID();
      } else {
        threadId = crypto.randomUUID();
      }

      // Everyone who is on this message — used for Reply All on the receiver side
      const participantIds = Array.from(new Set([senderId, recipientId, ...validCcIds]));

      const allRecipientIds = [recipientId, ...validCcIds];

      // Fan out — one row per recipient, all sharing thread + participants
      const created = await prisma.$transaction(
        allRecipientIds.map(rId =>
          prisma.message.create({
            data: {
              senderId,
              recipientId: rId,
              subject,
              content,
              threadId,
              inReplyToId: inReplyToId || null,
              participantIds,
            },
            include: {
              sender: {
                select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
              },
              recipient: {
                select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
              },
            },
          })
        )
      );

      // Notifications (one per recipient) — fire-and-forget so a notification
      // failure can't take down the whole send
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true },
      });
      const senderName = `${sender?.firstName || 'Someone'} ${sender?.lastName || ''}`.trim();

      Promise.all(
        created.map((m: any) =>
          prisma.notification.create({
            data: {
              userId: m.recipientId,
              type: 'MESSAGE',
              category: 'MESSAGE',
              content: `${senderName} sent you a message${allRecipientIds.length > 1 ? ` (and ${allRecipientIds.length - 1} other${allRecipientIds.length === 2 ? '' : 's'})` : ''}`,
              link: `/messages/${m.id}`,
            },
          })
        )
      ).catch(err => console.error('Message notification fan-out error:', err));

      // Email notifications for opted-in recipients (non-fatal)
      try {
        const recipientsFull = await prisma.user.findMany({
          where: { id: { in: allRecipientIds }, emailOnMessage: true },
          select: { id: true, email: true, firstName: true },
        });
        for (const r of recipientsFull) {
          const emailContent = newMessageEmail({
            recipientName: r.firstName || 'there',
            senderName,
            senderUsername: (req as any).user.username || '',
            preview: content,
          });
          sendEmail({ to: r.email, ...emailContent }).catch((e: any) => console.error('Message email error:', e));
        }
      } catch (emailErr) {
        console.error('Message email error (non-fatal):', emailErr);
      }

      // Return the primary message (the one to the main recipient) with hydrated participants
      const primary = created[0];
      const participants = await hydrateParticipants(participantIds);
      res.status(201).json({ ...primary, participants, threadId });
    } catch (error: any) {
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

    if (message.recipientId !== (req as any).user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    res.json({ message: 'Message deleted' });
  } catch (error: any) {
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

    if (message.recipientId !== (req as any).user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

export default router;
