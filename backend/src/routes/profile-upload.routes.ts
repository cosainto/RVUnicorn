import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../utils/cloudinary';

const router = Router();
import { prisma } from '../lib/prisma';

// Configure multer to use memory storage for Cloudinary
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// POST /api/profile-upload/picture - Upload profile picture
router.post('/picture', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const userId = (req as any).userId;

    // Accept either a pre-uploaded URL or a multer file
    let imageUrl: string;
    if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    } else if (req.file) {
      // Legacy multer path — upload to Cloudinary
      imageUrl = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/profiles');
    } else {
      return res.status(400).json({ error: 'Image required' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: imageUrl },
      select: { id: true, profilePicture: true }
    });

    res.json({ success: true, imageUrl, user: updatedUser });
  } catch (error: any) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// POST /api/profile-upload/cover - Upload cover photo
router.post('/cover', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const userId = (req as any).userId;

    // Accept either a pre-uploaded URL or a multer file
    let imageUrl: string;
    if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    } else if (req.file) {
      // Legacy multer path — upload to Cloudinary
      imageUrl = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/covers');
    } else {
      return res.status(400).json({ error: 'Image required' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { coverPhoto: imageUrl },
      select: { id: true, coverPhoto: true }
    });

    res.json({ success: true, imageUrl, user: updatedUser });
  } catch (error: any) {
    console.error('Upload cover photo error:', error);
    res.status(500).json({ error: 'Failed to upload cover photo' });
  }
});

export default router;
