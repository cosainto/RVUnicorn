import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router({ mergeParams: true });

// GET /api/events/:eventId/album - Get or create event's shared album
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Find or create album for this event
    let album = await prisma.album.findFirst({
      where: { eventId },
      include: {
        photos: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
            likes: {
              select: {
                id: true,
                userId: true,
              },
            },
            _count: {
              select: {
                likes: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            photos: true,
          },
        },
      },
    });

    // Create album if it doesn't exist
    if (!album) {
      album = await prisma.album.create({
        data: {
          userId: event.userId,
          eventId,
          title: `${event.title} - Photos`,
          description: 'Shared photos from this event',
          privacy: 'PUBLIC',
        },
        include: {
          photos: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePicture: true,
                },
              },
              likes: true,
              _count: {
                select: {
                  likes: true,
                },
              },
            },
          },
          _count: {
            select: {
              photos: true,
            },
          },
        },
      });
    }

    res.json(album);
  } catch (error) {
    console.error('Get event album error:', error);
    res.status(500).json({ error: 'Failed to get event album' });
  }
});

// POST /api/events/:eventId/album/photos - Add photo to event album
router.post('/photos', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req as any).userId;
    const { imageUrl, caption } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Get or create album
    let album = await prisma.album.findFirst({
      where: { eventId },
    });

    if (!album) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      album = await prisma.album.create({
        data: {
          userId: event.userId,
          eventId,
          title: `${event.title} - Photos`,
          description: 'Shared photos from this event',
          privacy: 'PUBLIC',
        },
      });
    }

    // Create photo
    const photo = await prisma.photo.create({
      data: {
        albumId: album.id,
        userId,
        imageUrl,
        caption,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });

    res.json(photo);
  } catch (error) {
    console.error('Add photo error:', error);
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

export default router;
