import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();
const db = prisma as any;

// Calculate snooze expiration date
function getSnoozeExpiration(duration: string): Date | null {
  const now = new Date();
  switch (duration) {
    case '7_DAYS':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '30_DAYS':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case '120_DAYS':
      return new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
    case 'FOREVER':
      return null; // null means forever
    default:
      return null;
  }
}

// POST /api/mute/user - Mute/snooze a user
router.post('/user', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { mutedUserId, duration } = req.body;

    if (!mutedUserId) {
      return res.status(400).json({ error: 'mutedUserId is required' });
    }

    const snoozeUntil = getSnoozeExpiration(duration || 'FOREVER');

    const mute = await db.mutedEntity.upsert({
      where: {
        userId_mutedUserId: { userId, mutedUserId }
      },
      create: {
        userId,
        mutedUserId,
        snoozeDuration: duration || 'FOREVER',
        snoozeUntil,
      },
      update: {
        snoozeDuration: duration || 'FOREVER',
        snoozeUntil,
      },
    });

    res.json({ message: 'User muted', mute });
  } catch (error: any) {
    console.error('Mute user error:', error);
    res.status(500).json({ error: 'Failed to mute user' });
  }
});

// POST /api/mute/event - Mute/snooze an event
router.post('/event', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { mutedEventId, duration } = req.body;

    if (!mutedEventId) {
      return res.status(400).json({ error: 'mutedEventId is required' });
    }

    const snoozeUntil = getSnoozeExpiration(duration || 'FOREVER');

    const mute = await db.mutedEntity.upsert({
      where: {
        userId_mutedEventId: { userId, mutedEventId }
      },
      create: {
        userId,
        mutedEventId,
        snoozeDuration: duration || 'FOREVER',
        snoozeUntil,
      },
      update: {
        snoozeDuration: duration || 'FOREVER',
        snoozeUntil,
      },
    });

    res.json({ message: 'Event muted', mute });
  } catch (error: any) {
    console.error('Mute event error:', error);
    res.status(500).json({ error: 'Failed to mute event' });
  }
});

// POST /api/mute/activity - Dismiss a specific activity from feed
router.post('/activity', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { activityId } = req.body;

    if (!activityId) {
      return res.status(400).json({ error: 'activityId is required' });
    }

    const mute = await db.mutedEntity.create({
      data: {
        userId,
        mutedActivityId: activityId,
        snoozeDuration: 'FOREVER',
        snoozeUntil: null,
      },
    });

    res.json({ message: 'Activity dismissed', mute });
  } catch (error: any) {
    console.error('Dismiss activity error:', error);
    res.status(500).json({ error: 'Failed to dismiss activity' });
  }
});

// GET /api/mute/list - Get all muted entities for settings page
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const mutes = await db.mutedEntity.findMany({
      where: { userId },
      include: {
        mutedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        },
        mutedCampground: {
          select: {
            id: true,
            name: true,
          }
        },
        mutedEvent: {
          select: {
            id: true,
            title: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter out expired snoozes for display (but they still exist in DB)
    const now = new Date();
    const activeMutes = mutes.map((mute: any) => ({
      ...mute,
      isExpired: mute.snoozeUntil && mute.snoozeUntil < now,
    }));

    res.json(activeMutes);
  } catch (error: any) {
    console.error('Get mutes error:', error);
    res.status(500).json({ error: 'Failed to get muted list' });
  }
});

// DELETE /api/mute/:id - Unmute/remove ignore
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const mute = await db.mutedEntity.findFirst({
      where: { id, userId }
    });

    if (!mute) {
      return res.status(404).json({ error: 'Mute not found' });
    }

    await db.mutedEntity.delete({
      where: { id }
    });

    res.json({ message: 'Unmuted successfully' });
  } catch (error: any) {
    console.error('Unmute error:', error);
    res.status(500).json({ error: 'Failed to unmute' });
  }
});

// DELETE /api/mute/user/:mutedUserId - Unmute a specific user
router.delete('/user/:mutedUserId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { mutedUserId } = req.params;

    await db.mutedEntity.deleteMany({
      where: { userId, mutedUserId }
    });

    res.json({ message: 'User unmuted' });
  } catch (error: any) {
    console.error('Unmute user error:', error);
    res.status(500).json({ error: 'Failed to unmute user' });
  }
});

// DELETE /api/mute/event/:mutedEventId - Unmute a specific event
router.delete('/event/:mutedEventId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { mutedEventId } = req.params;

    await db.mutedEntity.deleteMany({
      where: { userId, mutedEventId }
    });

    res.json({ message: 'Event unmuted' });
  } catch (error: any) {
    console.error('Unmute event error:', error);
    res.status(500).json({ error: 'Failed to unmute event' });
  }
});

export default router;

// POST /api/mute/campground/:campgroundId - Mute a campground
router.post('/campground/:campgroundId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId } = req.params;
    const { duration } = req.body;

    const snoozeUntil = duration ? getSnoozeExpiration(duration) : null;

    const mute = await db.mutedEntity.upsert({
      where: {
        userId_mutedCampgroundId: { userId, mutedCampgroundId: campgroundId }
      },
      create: {
        userId,
        mutedCampgroundId: campgroundId,
        snoozeDuration: duration || 'FOREVER',
        snoozeUntil,
      },
      update: {
        snoozeDuration: duration || 'FOREVER',
        snoozeUntil,
      },
    });

    res.json({ message: 'Campground muted', mute, isMuted: true });
  } catch (error: any) {
    console.error('Mute campground error:', error);
    res.status(500).json({ error: 'Failed to mute campground' });
  }
});

// DELETE /api/mute/campground/:campgroundId - Unmute a campground
router.delete('/campground/:campgroundId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId } = req.params;

    await db.mutedEntity.deleteMany({
      where: {
        userId,
        mutedCampgroundId: campgroundId,
      },
    });

    res.json({ message: 'Campground unmuted', isMuted: false });
  } catch (error: any) {
    console.error('Unmute campground error:', error);
    res.status(500).json({ error: 'Failed to unmute campground' });
  }
});

// GET /api/mute/check/campground/:campgroundId - Check if campground is muted
router.get('/check/campground/:campgroundId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId } = req.params;

    const mute = await db.mutedEntity.findUnique({
      where: {
        userId_mutedCampgroundId: { userId, mutedCampgroundId: campgroundId }
      },
    });

    res.json({ isMuted: !!mute });
  } catch (error: any) {
    console.error('Check mute error:', error);
    res.status(500).json({ error: 'Failed to check mute status' });
  }
});
