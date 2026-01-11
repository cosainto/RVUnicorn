import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/photos/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|heic/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('image/');

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ============================================
// STATIC ROUTES - MUST COME BEFORE /:id
// ============================================

// GET /api/photos/my - Get current user's photos
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { albumId, eventId, limit = 50, offset = 0 } = req.query;

    const where: any = { userId };
    if (albumId) where.albumId = albumId;
    if (eventId) where.eventId = eventId;

    const photos = await prisma.photo.findMany({
      where,
      include: {
        album: {
          select: {
            id: true,
            title: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.photo.count({ where });

    res.json({ photos, total });
  } catch (error) {
    console.error('Get my photos error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// GET /api/photos/event/:eventId - Get all photos for an event (collaborative gallery)
router.get('/event/:eventId', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const currentUserId = (req as any).userId;

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendees: true,
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get all photos tagged with this event
    const photos = await prisma.photo.findMany({
      where: { eventId },
      include: {
        user: {
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

    // Group photos by user for display
    const photosByUser = photos.reduce((acc: any, photo) => {
      const userId = photo.userId;
      if (!acc[userId]) {
        acc[userId] = {
          user: photo.user,
          photos: [],
        };
      }
      acc[userId].photos.push(photo);
      return acc;
    }, {});

    res.json({
      photos,
      photosByUser: Object.values(photosByUser),
      total: photos.length,
      isAttendee: event.attendees.some((a) => a.userId === currentUserId) || event.organizerId === currentUserId,
    });
  } catch (error) {
    console.error('Get event photos error:', error);
    res.status(500).json({ error: 'Failed to fetch event photos' });
  }
});

// GET /api/photos/album/:albumId - Get all photos in an album
router.get('/album/:albumId', optionalAuth, async (req, res) => {
  try {
    const { albumId } = req.params;
    const currentUserId = (req as any).userId;

    const album = await prisma.photoAlbum.findUnique({
      where: { id: albumId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    // Check privacy
    if (album.privacy === 'PRIVATE' && album.userId !== currentUserId) {
      return res.status(403).json({ error: 'This album is private' });
    }

    const photos = await prisma.photo.findMany({
      where: { albumId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ album, photos });
  } catch (error) {
    console.error('Get album photos error:', error);
    res.status(500).json({ error: 'Failed to fetch album photos' });
  }
});

// GET /api/photos/user/:username - Get public photos for a user
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { limit = 20 } = req.query;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get photos from public albums only
    const photos = await prisma.photo.findMany({
      where: {
        userId: user.id,
        OR: [
          { album: { privacy: 'PUBLIC' } },
          { albumId: null }, // Photos not in albums
        ],
      },
      include: {
        album: {
          select: {
            id: true,
            title: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    res.json(photos);
  } catch (error) {
    console.error('Get user photos error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST /api/photos - Upload a photo
router.post('/', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { caption, albumId, eventId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Photo file is required' });
    }

    // If albumId provided, verify ownership
    if (albumId) {
      const album = await prisma.photoAlbum.findUnique({
        where: { id: albumId },
      });

      if (!album || album.userId !== userId) {
        return res.status(403).json({ error: 'Album not found or access denied' });
      }
    }

    // If eventId provided, verify user is attendee or organizer
    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { attendees: true },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const isParticipant =
        event.organizerId === userId || event.attendees.some((a) => a.userId === userId);

      if (!isParticipant) {
        return res.status(403).json({ error: 'Only event participants can upload photos' });
      }
    }

    const photo = await prisma.photo.create({
      data: {
        userId,
        imageUrl: `/uploads/photos/${req.file.filename}`,
        caption,
        albumId: albumId || null,
        eventId: eventId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        album: {
          select: {
            id: true,
            title: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Create activity for the feed
    try {
      await prisma.activity.create({
        data: {
          userId,
          type: 'PHOTO_UPLOADED',
          targetType: eventId ? 'EVENT' : albumId ? 'ALBUM' : 'PHOTO',
          targetId: eventId || albumId || photo.id,
        },
      });
    } catch (e) {
      // Activity creation is optional
    }

    res.status(201).json(photo);
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// POST /api/photos/bulk - Upload multiple photos
router.post('/bulk', authenticateToken, upload.array('photos', 20), async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { albumId, eventId, captions } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required' });
    }

    // Parse captions if provided as JSON string
    let captionsArray: string[] = [];
    if (captions) {
      try {
        captionsArray = JSON.parse(captions);
      } catch (e) {
        captionsArray = [];
      }
    }

    // Verify permissions (same as single upload)
    if (albumId) {
      const album = await prisma.photoAlbum.findUnique({ where: { id: albumId } });
      if (!album || album.userId !== userId) {
        return res.status(403).json({ error: 'Album not found or access denied' });
      }
    }

    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { attendees: true },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const isParticipant =
        event.organizerId === userId || event.attendees.some((a) => a.userId === userId);

      if (!isParticipant) {
        return res.status(403).json({ error: 'Only event participants can upload photos' });
      }
    }

    // Create all photos
    const photos = await Promise.all(
      files.map((file, index) =>
        prisma.photo.create({
          data: {
            userId,
            imageUrl: `/uploads/photos/${file.filename}`,
            caption: captionsArray[index] || null,
            albumId: albumId || null,
            eventId: eventId || null,
          },
        })
      )
    );

    res.status(201).json({ photos, count: photos.length });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// ============================================
// PARAMETERIZED ROUTES - MUST COME AFTER STATIC
// ============================================

// GET /api/photos/:id - Get single photo
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = (req as any).userId;

    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        album: {
          select: {
            id: true,
            title: true,
            privacy: true,
            userId: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Check privacy
    if (photo.album?.privacy === 'PRIVATE' && photo.album.userId !== currentUserId) {
      return res.status(403).json({ error: 'This photo is private' });
    }

    res.json(photo);
  } catch (error) {
    console.error('Get photo error:', error);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// PUT /api/photos/:id - Update photo (caption, album, event)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { caption, albumId, eventId } = req.body;

    const photo = await prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (photo.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // If changing eventId, verify permissions
    if (eventId && eventId !== photo.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { attendees: true },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const isParticipant =
        event.organizerId === userId || event.attendees.some((a) => a.userId === userId);

      if (!isParticipant) {
        return res.status(403).json({ error: 'You must be an event participant to tag this photo' });
      }
    }

    const updated = await prisma.photo.update({
      where: { id },
      data: {
        caption: caption !== undefined ? caption : undefined,
        albumId: albumId !== undefined ? albumId : undefined,
        eventId: eventId !== undefined ? eventId : undefined,
      },
      include: {
        album: {
          select: {
            id: true,
            title: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update photo error:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// DELETE /api/photos/:id - Delete a photo
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const photo = await prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (photo.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete the actual file
    const filePath = path.join(process.cwd(), photo.imageUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.photo.delete({
      where: { id },
    });

    res.json({ message: 'Photo deleted' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;
