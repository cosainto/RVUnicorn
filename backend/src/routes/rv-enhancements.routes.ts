import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import multer from 'multer';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/rv-enhancements
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const enhancements = await prisma.rvEnhancement.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(enhancements);
  } catch (error) {
    console.error('Fetch enhancements error:', error);
    res.status(500).json({ error: 'Failed to fetch enhancements' });
  }
});

// GET /api/rv-enhancements/user/:userId
router.get('/user/:userId', optionalAuth, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const isOwner = req.userId === userId;
    const enhancements = await prisma.rvEnhancement.findMany({
      where: { userId, ...(isOwner ? {} : { isPublic: true }) },
      orderBy: { createdAt: 'desc' },
    });
    res.json(enhancements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch enhancements' });
  }
});

// POST /api/rv-enhancements
router.post('/', authenticateToken, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req: any, res) => {
  try {
    const { title, description, category, purchaseUrl, cost, isPublic, videoUrl } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    let imageUrl: string | undefined;
    let finalVideoUrl: string | undefined = videoUrl || undefined;

    if (files?.image?.[0]) imageUrl = await uploadBufferToCloudinary(files.image[0].buffer, 'rv-enhancements/images');
    if (files?.video?.[0]) finalVideoUrl = await uploadBufferToCloudinary(files.video[0].buffer, 'rv-enhancements/videos');

    const enhancement = await prisma.rvEnhancement.create({
      data: {
        userId: req.userId,
        title: title.trim(),
        description: description?.trim() || null,
        category: category || null,
        purchaseUrl: purchaseUrl?.trim() || null,
        cost: cost ? parseFloat(cost) : null,
        imageUrl: imageUrl || null,
        videoUrl: finalVideoUrl || null,
        isPublic: isPublic !== 'false' && isPublic !== false,
      },
    });
    res.status(201).json(enhancement);
  } catch (error) {
    console.error('Create enhancement error:', error);
    res.status(500).json({ error: 'Failed to create enhancement' });
  }
});

// PATCH /api/rv-enhancements/:id
router.patch('/:id', authenticateToken, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req: any, res) => {
  try {
    const existing = await prisma.rvEnhancement.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    let { imageUrl, videoUrl } = existing;
    const { title, description, category, purchaseUrl, cost, isPublic } = req.body;
    if (req.body.videoUrl !== undefined) videoUrl = req.body.videoUrl?.trim() || null;
    if (files?.image?.[0]) imageUrl = await uploadBufferToCloudinary(files.image[0].buffer, 'rv-enhancements/images');
    if (files?.video?.[0]) videoUrl = await uploadBufferToCloudinary(files.video[0].buffer, 'rv-enhancements/videos');

    const updated = await prisma.rvEnhancement.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(category !== undefined && { category: category || null }),
        ...(purchaseUrl !== undefined && { purchaseUrl: purchaseUrl?.trim() || null }),
        ...(cost !== undefined && { cost: cost ? parseFloat(cost) : null }),
        ...(isPublic !== undefined && { isPublic: isPublic !== 'false' && isPublic !== false }),
        imageUrl,
        videoUrl,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update enhancement' });
  }
});

// DELETE /api/rv-enhancements/:id
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const existing = await prisma.rvEnhancement.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.rvEnhancement.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete enhancement' });
  }
});

export default router;
