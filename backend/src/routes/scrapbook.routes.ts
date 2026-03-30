import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/scrapbook/:eventId - Get all pinned photos for a trip
router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const pins = await prisma.scrapbookPin.findMany({
      where: { eventId },
      include: {
        photo: {
          select: {
            id: true,
            imageUrl: true,
            caption: true,
            createdAt: true,
            user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          },
        },
        pinnedBy: { select: { id: true, username: true, firstName: true, profilePicture: true } },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(pins);
  } catch (error) {
    console.error('Get scrapbook error:', error);
    res.status(500).json({ error: 'Failed to fetch scrapbook' });
  }
});

// GET /api/scrapbook/:eventId/photos - Get all event photos available to pin
router.get('/:eventId/photos', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const photos = await prisma.photo.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        scrapbookPins: { where: { eventId }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(photos);
  } catch (error) {
    console.error('Get event photos error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST /api/scrapbook/:eventId/pin - Pin a photo to the scrapbook
router.post('/:eventId/pin', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    const { photoId, caption } = req.body;

    if (!photoId) return res.status(400).json({ error: 'photoId is required' });

    // Verify user is an attendee or organizer
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const isAttendee = event.organizerId === userId || await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!isAttendee) return res.status(403).json({ error: 'Must be a trip attendee to pin photos' });

    // Get current max position
    const maxPos = await prisma.scrapbookPin.aggregate({
      where: { eventId },
      _max: { position: true },
    });

    const pin = await prisma.scrapbookPin.create({
      data: {
        eventId,
        photoId,
        pinnedById: userId,
        caption: caption || null,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        photo: {
          select: {
            id: true,
            imageUrl: true,
            caption: true,
            createdAt: true,
            user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          },
        },
        pinnedBy: { select: { id: true, username: true, firstName: true, profilePicture: true } },
      },
    });

    res.json(pin);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Photo already pinned' });
    console.error('Pin photo error:', error);
    res.status(500).json({ error: 'Failed to pin photo' });
  }
});

// DELETE /api/scrapbook/:eventId/pin/:photoId - Unpin a photo
router.delete('/:eventId/pin/:photoId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId, photoId } = req.params;

    const pin = await prisma.scrapbookPin.findUnique({
      where: { eventId_photoId: { eventId, photoId } },
    });
    if (!pin) return res.status(404).json({ error: 'Pin not found' });

    // Only the pinner or organizer can unpin
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
    if (pin.pinnedById !== userId && event?.organizerId !== userId) {
      return res.status(403).json({ error: 'Cannot unpin someone else\'s photo' });
    }

    await prisma.scrapbookPin.delete({ where: { eventId_photoId: { eventId, photoId } } });
    res.json({ message: 'Photo unpinned' });
  } catch (error) {
    console.error('Unpin photo error:', error);
    res.status(500).json({ error: 'Failed to unpin photo' });
  }
});

// PATCH /api/scrapbook/:eventId/pin/:photoId - Update caption
router.patch('/:eventId/pin/:photoId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId, photoId } = req.params;
    const { caption } = req.body;

    const pin = await prisma.scrapbookPin.findUnique({
      where: { eventId_photoId: { eventId, photoId } },
    });
    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    if (pin.pinnedById !== userId) return res.status(403).json({ error: 'Not your pin' });

    const updated = await prisma.scrapbookPin.update({
      where: { eventId_photoId: { eventId, photoId } },
      data: { caption },
    });
    res.json(updated);
  } catch (error) {
    console.error('Update pin error:', error);
    res.status(500).json({ error: 'Failed to update pin' });
  }
});

export default router;
