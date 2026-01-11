import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for profile uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/profiles';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// POST /api/profile-upload/picture - Upload profile picture
router.post('/picture', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = `/uploads/profiles/${req.file.filename}`;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: imageUrl },
      select: { id: true, profilePicture: true }
    });

    res.json({ success: true, imageUrl, user: updatedUser });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// POST /api/profile-upload/cover - Upload cover photo
router.post('/cover', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = `/uploads/profiles/${req.file.filename}`;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { coverPhoto: imageUrl },
      select: { id: true, coverPhoto: true }
    });

    res.json({ success: true, imageUrl, user: updatedUser });
  } catch (error) {
    console.error('Upload cover photo error:', error);
    res.status(500).json({ error: 'Failed to upload cover photo' });
  }
});

export default router;
