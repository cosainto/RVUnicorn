import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const uploadToCloudinary = (buffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'rvunicorn/camp-market', resource_type: 'image' },
      (error, result) => { if (error) reject(error); else resolve(result); }
    );
    stream.end(buffer);
  });
};

// GET /api/camp-market/:campgroundId — active listings at this campground
router.get('/:campgroundId', async (req: Request, res: Response) => {
  try {
    const listings = await prisma.campMarketListing.findMany({
      where: {
        campgroundId: req.params.campgroundId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ listings });
  } catch (e) {
    console.error('Camp market fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// POST /api/camp-market/:campgroundId — create listing
router.post('/:campgroundId', authenticateToken, upload.single('image'), async (req: any, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const { campgroundId } = req.params;
    const { title, description, price, siteNumber } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    // Find user's active check-in at this campground
    const checkIn = await prisma.checkIn.findFirst({
      where: { userId, campgroundId, isActive: true },
    });
    if (!checkIn) return res.status(403).json({ error: 'Must be checked in to post a listing' });

    // Upload image if provided
    let imageUrl: string | null = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }

    const parsedPrice = price && price !== '' ? parseFloat(price) : null;
    const expiresAt = checkIn.checkOutDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const listing = await prisma.campMarketListing.create({
      data: {
        userId,
        campgroundId,
        title: title.trim(),
        description: description?.trim() || null,
        price: parsedPrice,
        isFree: parsedPrice === null || parsedPrice === 0,
        imageUrl,
        siteNumber: siteNumber?.trim() || null,
        expiresAt,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
      },
    });

    res.json({ listing });
  } catch (e) {
    console.error('Camp market create error:', e);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// DELETE /api/camp-market/listing/:id — soft-delete listing
router.delete('/listing/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const listing = await prisma.campMarketListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    await prisma.campMarketListing.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (e) {
    console.error('Camp market delete error:', e);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// POST /api/camp-market/listing/:id/interest — express interest via campfire message
router.post('/listing/:id/interest', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const listing = await prisma.campMarketListing.findUnique({
      where: { id: req.params.id },
      include: { campground: { select: { id: true, name: true } } },
    });
    if (!listing || !listing.isActive) return res.status(404).json({ error: 'Listing not found' });

    const buyer = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });

    const room = await prisma.campfireRoom.findUnique({ where: { campgroundId: listing.campgroundId } });
    if (room) {
      await prisma.campfireMessage.create({
        data: {
          roomId: room.id,
          userId,
          content: `🛒 ${buyer?.firstName || 'Someone'} is interested in "${listing.title}"${listing.siteNumber ? ` at site ${listing.siteNumber}` : ''}! Check your messages.`,
          isSystem: true,
        },
      });
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Camp market interest error:', e);
    res.status(500).json({ error: 'Failed to express interest' });
  }
});

export default router;
