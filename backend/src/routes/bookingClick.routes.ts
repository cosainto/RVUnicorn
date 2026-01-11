import express from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();


// Track a booking click
router.post('/track', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { campgroundId } = req.body;

    if (!campgroundId) {
      return res.status(400).json({ error: 'campgroundId is required' });
    }

    const recentClick = await prisma.bookingClick.findFirst({
      where: {
        userId,
        campgroundId,
        clickedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        responded: false
      }
    });

    if (recentClick) {
      return res.json({ message: 'Click already tracked', clickId: recentClick.id });
    }

    const click = await prisma.bookingClick.create({
      data: { userId, campgroundId }
    });

    res.json({ message: 'Click tracked', clickId: click.id });
  } catch (error) {
    console.error('Error tracking booking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// Get pending follow-ups (clicks from 1+ hour ago)
router.get('/pending-followups', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const pendingFollowUps = await prisma.bookingClick.findMany({
      where: {
        userId,
        responded: false,
        clickedAt: { lte: oneHourAgo }
      },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            imageUrl: true,
            campspotSlug: true
          }
        }
      },
      orderBy: { clickedAt: 'desc' }
    });

    res.json(pendingFollowUps);
  } catch (error) {
    console.error('Error fetching pending follow-ups:', error);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

// Respond to a follow-up
router.post('/:clickId/respond', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { clickId } = req.params;
    const { didBook } = req.body;

    const click = await prisma.bookingClick.findFirst({
      where: { id: clickId, userId }
    });

    if (!click) {
      return res.status(404).json({ error: 'Click not found' });
    }

    const updatedClick = await prisma.bookingClick.update({
      where: { id: clickId },
      data: {
        responded: true,
        didBook,
        followUpSentAt: new Date()
      },
      include: {
        campground: {
          select: { id: true, name: true, location: true, state: true }
        }
      }
    });

    res.json(updatedClick);
  } catch (error) {
    console.error('Error responding to follow-up:', error);
    res.status(500).json({ error: 'Failed to respond' });
  }
});

// Link event to booking click
router.post('/:clickId/link-event', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { clickId } = req.params;
    const { eventId } = req.body;

    const click = await prisma.bookingClick.findFirst({
      where: { id: clickId, userId }
    });

    if (!click) {
      return res.status(404).json({ error: 'Click not found' });
    }

    const updatedClick = await prisma.bookingClick.update({
      where: { id: clickId },
      data: { createdEventId: eventId }
    });

    res.json(updatedClick);
  } catch (error) {
    console.error('Error linking event:', error);
    res.status(500).json({ error: 'Failed to link event' });
  }
});

export default router;
