import express from 'express';
import { logAlbumCreated, logPhotoUploaded } from '../services/activity.service';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import path from 'path';
import fs from 'fs';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { getAlbumAccess } from '../services/album-access.service';

const router = express.Router();
import { prisma } from '../lib/prisma';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype); if (ok) { cb(null, true); } else { cb(new Error('Images only')); } } });

// GET /api/photo-albums - Get all albums (with optional userId filter)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.query;

    const albums = await prisma.photoAlbum.findMany({
      where: userId ? { userId: userId as string } : undefined,
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
        photos: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            imageUrl: true,
          },
        },
        albumComments: {
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
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            photos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(albums);
  } catch (error: any) {
    console.error('Get albums error:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// GET /api/photo-albums/:id - Get album by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const album = await prisma.photoAlbum.findUnique({
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
        photos: {
          orderBy: { createdAt: 'asc' },
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
        },
        albumComments: {
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
          orderBy: { createdAt: "desc" },
        },
        collaborators: {
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
          orderBy: { addedAt: 'asc' },
        },
        _count: {
          select: {
            photos: true,
          },
        },
      },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }


    res.json({ ...album, comments: album.albumComments });
  } catch (error: any) {
    console.error('Get album error:', error);
    res.status(500).json({ error: 'Failed to fetch album' });
  }
});

// POST /api/photo-albums - Create new album
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;
    const userId = (req as any).userId;

    const album = await prisma.photoAlbum.create({
      data: {
        userId,
        title,
        description,
      },
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
    });


    res.json(album);
  } catch (error: any) {
    console.error('Create album error:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// POST /api/photo-albums/:id/photos - Upload photos to album
router.post('/:id/photos', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { caption } = req.body;

    // Owner / collaborator / co-pilot / event co-attendee can all upload —
    // see services/album-access.service.ts
    const access = await getAlbumAccess(id, userId);
    if (!access.exists) return res.status(404).json({ error: 'Album not found' });
    if (!access.canWrite) return res.status(403).json({ error: 'Not authorized' });

    // Accept either a pre-uploaded URL or a multer file
    let imageUrl: string;
    if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    } else if (req.file) {
      // Legacy multer path — upload to Cloudinary
      imageUrl = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/albums');
    } else {
      return res.status(400).json({ error: 'Image required' });
    }

    const photo = await prisma.photo.create({
      data: {
        album: {
          connect: { id }
        },
        user: {
          connect: { id: userId }
        },
        imageUrl,
        caption: caption || '',
      },
    });

    res.json(photo);
  } catch (error: any) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// PUT /api/photo-albums/:id - Update album
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { title, description } = req.body;

    const album = await prisma.photoAlbum.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    if (album.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.photoAlbum.update({
      where: { id },
      data: {
        title,
        description,
      },
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
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update album error:', error);
    res.status(500).json({ error: 'Failed to update album' });
  }
});

// DELETE /api/photo-albums/:id - Delete album
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const album = await prisma.photoAlbum.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    if (album.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.photoAlbum.delete({
      where: { id },
    });

    res.json({ message: 'Album deleted' });
  } catch (error: any) {
    console.error('Delete album error:', error);
    res.status(500).json({ error: 'Failed to delete album' });
  }
});

// DELETE /api/photo-albums/photos/:photoId - Delete photo
router.delete('/photos/:photoId', authenticateToken, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).userId;

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: {
        album: {
          select: { userId: true },
        },
      },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (photo.album?.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete file from filesystem
    const filePath = path.join(process.cwd(), photo.imageUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.photo.delete({
      where: { id: photoId },
    });

    res.json({ message: 'Photo deleted' });
  } catch (error: any) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});


// POST /api/photo-albums/photos/:photoId/link-event - Link a single photo to an event
router.post('/photos/:photoId/link-event', authenticateToken, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).userId;
    const { eventId } = req.body;

    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo || photo.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.photo.update({
      where: { id: photoId },
      data: { eventId: eventId || null },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Link photo to event error:', error);
    res.status(500).json({ error: 'Failed to link photo' });
  }
});

// POST /api/photo-albums/:id/link-event - Link all photos in an album to an event
router.post('/:id/link-event', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { eventId } = req.body;

    const album = await prisma.photoAlbum.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!album || album.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await prisma.photo.updateMany({
      where: { albumId: id, userId },
      data: { eventId: eventId || null },
    });

    res.json({ linked: result.count, eventId });
  } catch (error: any) {
    console.error('Link album to event error:', error);
    res.status(500).json({ error: 'Failed to link album' });
  }
});

// POST /api/photo-albums/photos/bulk-link-event - Link selected photos to an event
router.post('/photos/bulk-link-event', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { photoIds, eventId } = req.body;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: 'No photos selected' });
    }

    const result = await prisma.photo.updateMany({
      where: { id: { in: photoIds }, userId },
      data: { eventId: eventId || null },
    });

    res.json({ linked: result.count, eventId });
  } catch (error: any) {
    console.error('Bulk link photos error:', error);
    res.status(500).json({ error: 'Failed to link photos' });
  }
});


// GET /api/photo-albums/photos/event/:eventId - Get all photos for an event
router.get('/photos/event/:eventId', optionalAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const photos = await prisma.photo.findMany({
      where: { eventId, visibility: 'PUBLIC' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        album: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ photos, photosByUser: [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
