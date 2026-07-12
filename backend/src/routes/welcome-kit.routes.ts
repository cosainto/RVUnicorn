import { Router, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const uploadToCloudinary = (buffer: Buffer, folder: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => { if (error) reject(error); else resolve(result); }
    );
    stream.end(buffer);
  });
};

// ── Owner: GET kit for editing ──
router.get('/:campgroundId', authenticateToken, async (req: any, res: Response) => {
  try {
    const kit = await prisma.welcomeKit.findUnique({
      where: { campgroundId: req.params.campgroundId },
      include: {
        sections: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    res.json({ kit });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Owner: Upsert essentials ──
router.put('/:campgroundId', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { wifiName, wifiPassword, gateCode, checkoutTime, quietHoursStart, quietHoursEnd, officePhone, emergencyPhone, maintenancePhone, welcomeMessage, welcomeVideoUrl, mapImageUrl } = req.body;

    const kit = await prisma.welcomeKit.upsert({
      where: { campgroundId },
      create: { campgroundId, wifiName, wifiPassword, gateCode, checkoutTime, quietHoursStart, quietHoursEnd, officePhone, emergencyPhone, maintenancePhone, welcomeMessage, welcomeVideoUrl, mapImageUrl },
      update: { wifiName, wifiPassword, gateCode, checkoutTime, quietHoursStart, quietHoursEnd, officePhone, emergencyPhone, maintenancePhone, welcomeMessage, welcomeVideoUrl, mapImageUrl },
    });
    res.json({ kit });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Publish / Unpublish ──
router.post('/:campgroundId/publish', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.welcomeKit.update({ where: { campgroundId: req.params.campgroundId }, data: { isPublished: true } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:campgroundId/unpublish', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.welcomeKit.update({ where: { campgroundId: req.params.campgroundId }, data: { isPublished: false } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Sections CRUD ──
router.post('/:campgroundId/sections', authenticateToken, async (req: any, res: Response) => {
  try {
    const kit = await prisma.welcomeKit.findUnique({ where: { campgroundId: req.params.campgroundId } });
    if (!kit) return res.status(404).json({ error: 'Kit not found' });
    const { type, title, content, icon, sortOrder } = req.body;
    const section = await prisma.welcomeKitSection.create({
      data: { kitId: kit.id, type, title, content, icon, sortOrder: sortOrder || 0 },
      include: { items: true },
    });
    res.json({ section });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:campgroundId/sections/:sectionId', authenticateToken, async (req: any, res: Response) => {
  try {
    const section = await prisma.welcomeKitSection.update({ where: { id: req.params.sectionId }, data: req.body });
    res.json({ section });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:campgroundId/sections/:sectionId', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.welcomeKitSection.update({ where: { id: req.params.sectionId }, data: { isActive: false } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.patch('/:campgroundId/sections/reorder', authenticateToken, async (req: any, res: Response) => {
  try {
    const { sections } = req.body;
    for (const s of sections) {
      await prisma.welcomeKitSection.update({ where: { id: s.id }, data: { sortOrder: s.sortOrder } });
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Section Items CRUD ──
router.post('/:campgroundId/sections/:sectionId/items', authenticateToken, async (req: any, res: Response) => {
  try {
    const item = await prisma.welcomeKitSectionItem.create({ data: { sectionId: req.params.sectionId, ...req.body } });
    res.json({ item });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:campgroundId/sections/:sectionId/items/:itemId', authenticateToken, async (req: any, res: Response) => {
  try {
    const item = await prisma.welcomeKitSectionItem.update({ where: { id: req.params.itemId }, data: req.body });
    res.json({ item });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:campgroundId/sections/:sectionId/items/:itemId', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.welcomeKitSectionItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── File uploads ──
router.post('/:campgroundId/upload-map', authenticateToken, upload.single('file'), async (req: any, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const result = await uploadToCloudinary(req.file.buffer, `rvunicorn/welcome-kits/${req.params.campgroundId}`);
    await prisma.welcomeKit.update({ where: { campgroundId: req.params.campgroundId }, data: { mapImageUrl: result.secure_url } });
    res.json({ url: result.secure_url });
  } catch { res.status(500).json({ error: 'Upload failed' }); }
});

router.post('/:campgroundId/sections/:sectionId/upload-document', authenticateToken, upload.single('file'), async (req: any, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const result = await uploadToCloudinary(req.file.buffer, `rvunicorn/welcome-kits/${req.params.campgroundId}`);
    const fileType = req.file.mimetype.includes('pdf') ? 'pdf' : 'image';
    await prisma.welcomeKitSection.update({ where: { id: req.params.sectionId }, data: { fileUrl: result.secure_url, fileType } });
    res.json({ url: result.secure_url, fileType });
  } catch { res.status(500).json({ error: 'Upload failed' }); }
});

// ── Guest: Published kit for checked-in user ──
router.get('/:campgroundId/guest', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const checkIn = await prisma.checkIn.findFirst({ where: { userId, campgroundId: req.params.campgroundId, isActive: true } });
    if (!checkIn) return res.status(403).json({ error: 'Must be checked in' });

    const kit = await prisma.welcomeKit.findUnique({
      where: { campgroundId: req.params.campgroundId },
      include: {
        sections: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sortOrder: 'asc' } } } },
        campground: { select: { name: true, imageUrl: true } },
      },
    });
    if (!kit?.isPublished) return res.json({ kit: null });

    res.json({ kit, checkIn: { checkInDate: checkIn.checkInDate, checkOutDate: checkIn.checkOutDate } });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
