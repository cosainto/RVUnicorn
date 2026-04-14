import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// ============================================
// BLOCKED USERS MANAGEMENT (Event Creator Only)
// ============================================

// GET /api/events/:eventId/blocked-users - Get list of blocked users
router.get('/:eventId/blocked-users', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ error: 'Only the event creator can view blocked users' });
    }

    const blockedUsers = await prisma.eventBlockedUser.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(blockedUsers);
  } catch (error: any) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// POST /api/events/:eventId/blocked-users - Block a user from event
router.post('/:eventId/blocked-users', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;
    const { blockedUserId, reason } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({ error: 'blockedUserId is required' });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true, title: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ error: 'Only the event creator can block users' });
    }

    // Can't block yourself
    if (blockedUserId === userId) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    // Check if already blocked
    const existing = await prisma.eventBlockedUser.findUnique({
      where: {
        eventId_userId: { eventId, userId: blockedUserId }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'User is already blocked' });
    }

    // Block the user
    const blocked = await prisma.eventBlockedUser.create({
      data: {
        eventId,
        userId: blockedUserId,
        blockedBy: userId,
        reason
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      }
    });

    // Remove from attendees if they were attending
    await prisma.eventAttendee.deleteMany({
      where: {
        eventId,
        userId: blockedUserId
      }
    });

    // Optionally notify the blocked user
    await prisma.notification.create({
      data: {
        userId: blockedUserId,
        type: 'EVENT_ACCESS_REMOVED',
        content: `Your access to "${event.title}" has been restricted by the organizer`,
        link: `/trips`
      }
    });

    res.json(blocked);
  } catch (error: any) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// DELETE /api/events/:eventId/blocked-users/:blockedUserId - Unblock a user
router.delete('/:eventId/blocked-users/:blockedUserId', authenticateToken, async (req, res) => {
  try {
    const { eventId, blockedUserId } = req.params;
    const userId = (req as any).userId;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ error: 'Only the event creator can unblock users' });
    }

    await prisma.eventBlockedUser.deleteMany({
      where: {
        eventId,
        userId: blockedUserId
      }
    });

    res.json({ message: 'User unblocked' });
  } catch (error: any) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// ============================================
// SUBTAB PRIVACY SETTINGS
// ============================================

// GET /api/events/:eventId/subtab-privacy - Get subtab privacy settings
router.get('/:eventId/subtab-privacy', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const settings = await prisma.eventSubtabPrivacy.findMany({
      where: { eventId },
      orderBy: { subtab: 'asc' }
    });

    // Return default settings if none exist
    const subtabs = ['DETAILS', 'MEAL_PLAN', 'PACKING_LIST', 'DISCUSSIONS', 'PHOTOS', 'ATTENDEES'];
    const settingsMap: Record<string, string> = {};
    
    for (const s of settings) {
      settingsMap[s.subtab] = s.privacy;
    }

    const result = subtabs.map(subtab => ({
      subtab,
      privacy: settingsMap[subtab] || 'INHERIT'
    }));

    res.json(result);
  } catch (error: any) {
    console.error('Get subtab privacy error:', error);
    res.status(500).json({ error: 'Failed to fetch subtab privacy' });
  }
});

// PUT /api/events/:eventId/subtab-privacy - Update subtab privacy settings
router.put('/:eventId/subtab-privacy', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;
    const { subtab, privacy } = req.body;

    if (!subtab || !privacy) {
      return res.status(400).json({ error: 'subtab and privacy are required' });
    }

    const validSubtabs = ['DETAILS', 'MEAL_PLAN', 'PACKING_LIST', 'DISCUSSIONS', 'PHOTOS', 'ATTENDEES'];
    const validPrivacy = ['INHERIT', 'PUBLIC', 'FRIENDS', 'PRIVATE', 'ATTENDEES_ONLY'];

    if (!validSubtabs.includes(subtab)) {
      return res.status(400).json({ error: 'Invalid subtab' });
    }

    if (!validPrivacy.includes(privacy)) {
      return res.status(400).json({ error: 'Invalid privacy setting' });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendees: {
          where: { userId, status: { in: ['going', 'GOING'] } }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Only organizer or going attendees can update subtab privacy
    const isOrganizer = event.organizerId === userId;
    const isGoingAttendee = event.attendees.length > 0;

    if (!isOrganizer && !isGoingAttendee) {
      return res.status(403).json({ error: 'Only the organizer or attendees can update privacy settings' });
    }

    const setting = await prisma.eventSubtabPrivacy.upsert({
      where: {
        eventId_subtab: { eventId, subtab }
      },
      create: {
        eventId,
        subtab,
        privacy
      },
      update: {
        privacy
      }
    });

    res.json(setting);
  } catch (error: any) {
    console.error('Update subtab privacy error:', error);
    res.status(500).json({ error: 'Failed to update subtab privacy' });
  }
});

// POST /api/events/:eventId/subtab-privacy/bulk - Update multiple subtab privacy settings
router.post('/:eventId/subtab-privacy/bulk', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;
    const { settings } = req.body; // Array of { subtab, privacy }

    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({ error: 'settings array is required' });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ error: 'Only the organizer can bulk update privacy settings' });
    }

    const results = [];
    for (const { subtab, privacy } of settings) {
      const setting = await prisma.eventSubtabPrivacy.upsert({
        where: {
          eventId_subtab: { eventId, subtab }
        },
        create: {
          eventId,
          subtab,
          privacy
        },
        update: {
          privacy
        }
      });
      results.push(setting);
    }

    res.json(results);
  } catch (error: any) {
    console.error('Bulk update subtab privacy error:', error);
    res.status(500).json({ error: 'Failed to update subtab privacy' });
  }
});

export default router;
