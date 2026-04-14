import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { logPhotoUploaded } from '../services/activity.service';
import { prisma } from '../index';
const db = prisma as any;

const router = Router({ mergeParams: true });

// GET /api/events/:eventId/album - Get or create event's shared album
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Check if event exists
    const event = await db.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Find or create album for this event
    let album = await db.album.findFirst({
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
      album = await db.album.create({
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
  } catch (error: any) {
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
    let album = await db.album.findFirst({
      where: { eventId },
    });

    if (!album) {
      const event = await db.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      album = await db.album.create({
        data: {
          userId: event.userId,
          eventId,
          title: `${event.title} - Photos`,
          description: 'Shared photos from this event',
          privacy: 'PUBLIC',
        },
      });
    }

    // Fetch full event details to determine privacy + structured caption
    const fullEvent = await db.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        privacy: true,
        startDate: true,
        campgroundId: true,
        campground: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    // Build structured caption for non-private events
    let structuredCaption = caption || '';
    if (fullEvent && fullEvent.privacy !== 'PRIVATE') {
      const parts: string[] = [];
      if (fullEvent.title) parts.push(fullEvent.title);
      if (fullEvent.campground?.name) parts.push(fullEvent.campground.name);
      if (fullEvent.startDate) {
        const d = new Date(fullEvent.startDate);
        parts.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      }
      if (parts.length > 0) structuredCaption = parts.join(' · ');
    }

    // Create photo — set eventId so it surfaces in the user's profile gallery
    const photo = await db.photo.create({
      data: {
        albumId: album.id,
        userId,
        imageUrl,
        caption: structuredCaption || caption || '',
        ...(fullEvent && fullEvent.privacy !== 'PRIVATE' ? { eventId: fullEvent.id } : {}),
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

    // Tag the photo with the campground so the frontend can render a link
    if (fullEvent?.campground?.id && fullEvent.privacy !== 'PRIVATE') {
      try {
        await db.photoCampgroundTag.create({
          data: {
            photoId: photo.id,
            campgroundId: fullEvent.campground.id,
          },
        });
      } catch (_e) {
        // Tag may already exist — non-fatal
      }
    }

    res.json(photo);

    // ── Activity log + friend notifications (non-blocking) ──────────────────
    if (fullEvent && fullEvent.privacy !== 'PRIVATE') {
      const albumTitle = fullEvent.title
        + (fullEvent.campground ? ' · ' + fullEvent.campground.name : '');

      logPhotoUploaded(userId, album.id, albumTitle, photo.id, fullEvent.campground || null).catch(() => {});

      // Friends see this via the basecamp activity wall — no separate notification needed
    }
    // ────────────────────────────────────────────────────────────────────────

  } catch (error: any) {
    console.error('Add photo error:', error);
    res.status(500).json({ error: 'Failed to add photo' });
  }
});

export default router;
