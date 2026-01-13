import express from 'express';
import { logAlbumCreated, logPhotoUploaded } from '../services/activity.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/photos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
});

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
        _count: {
          select: {
            photos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(albums);
  } catch (error) {
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

    // Log activity for friend feed
    await logAlbumCreated(userId, album.id, album.title);

    res.json(album);
  } catch (error) {
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

    // Log activity for friend feed
    await logAlbumCreated(userId, album.id, album.title);

    res.json(album);
  } catch (error) {
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

    // Verify album exists and user owns it
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

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const photo = await prisma.photo.create({
      data: {
        album: {
          connect: { id }
        },
        user: {
          connect: { id: userId }
        },
        imageUrl: `/uploads/photos/${req.file.filename}`,
        caption: caption || '',
      },
    });

    res.json(photo);
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;
