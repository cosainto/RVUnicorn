import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;
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

// Helper: recompute stats for a user after feedback
async function recomputeStats(userId: string) {
  const sellerFeedback = await prisma.campMarketFeedback.findMany({
    where: { revieweeId: userId, role: 'SELLER' },
    select: { rating: true },
  });
  const buyerFeedback = await prisma.campMarketFeedback.findMany({
    where: { revieweeId: userId, role: 'BUYER' },
    select: { rating: true },
  });
  const avgSeller = sellerFeedback.length ? sellerFeedback.reduce((s: any, f: any) => s + f.rating, 0) / sellerFeedback.length : 0;
  const avgBuyer = buyerFeedback.length ? buyerFeedback.reduce((s: any, f: any) => s + f.rating, 0) / buyerFeedback.length : 0;

  await prisma.campMarketStats.upsert({
    where: { userId },
    create: {
      userId,
      totalSales: sellerFeedback.length,
      totalPurchases: buyerFeedback.length,
      avgSellerRating: Math.round(avgSeller * 10) / 10,
      avgBuyerRating: Math.round(avgBuyer * 10) / 10,
      totalFeedbackCount: sellerFeedback.length + buyerFeedback.length,
    },
    update: {
      totalSales: sellerFeedback.length,
      totalPurchases: buyerFeedback.length,
      avgSellerRating: Math.round(avgSeller * 10) / 10,
      avgBuyerRating: Math.round(avgBuyer * 10) / 10,
      totalFeedbackCount: sellerFeedback.length + buyerFeedback.length,
    },
  });
}

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
        _count: { select: { interests: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ listings });
  } catch (e: any) {
    console.error('Camp market fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// POST /api/camp-market/:campgroundId — create listing
router.post('/:campgroundId', authenticateToken, upload.single('image'), async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const { campgroundId } = req.params;
    const { title, description, price, siteNumber } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const checkIn = await prisma.checkIn.findFirst({
      where: { userId, campgroundId, isActive: true },
    });
    if (!checkIn) return res.status(403).json({ error: 'Must be checked in to post a listing' });

    let imageUrl: string | null = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }

    const parsedPrice = price && price !== '' ? parseFloat(price) : null;
    const expiresAt = checkIn.checkOutDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const listing = await prisma.campMarketListing.create({
      data: {
        userId, campgroundId,
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
        _count: { select: { interests: true } },
      },
    });

    res.json({ listing });
  } catch (e: any) {
    console.error('Camp market create error:', e);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// DELETE /api/camp-market/listing/:id — soft-delete listing
router.delete('/listing/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const listing = await prisma.campMarketListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    await prisma.campMarketListing.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (e: any) {
    console.error('Camp market delete error:', e);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// PUT /api/camp-market/listing/:id — edit listing details
router.put('/listing/:id', authenticateToken, upload.single('image'), async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const listing = await prisma.campMarketListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const { title, description, price, siteNumber, isFree } = req.body;
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (price !== undefined) updateData.price = price ? parseFloat(price) : null;
    if (siteNumber !== undefined) updateData.siteNumber = siteNumber || null;
    if (isFree !== undefined) updateData.isFree = isFree === 'true' || isFree === true;

    // Handle new image upload
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      updateData.imageUrl = result.secure_url;
    }

    const updated = await prisma.campMarketListing.update({
      where: { id: req.params.id },
      data: updateData,
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
    });
    res.json(updated);
  } catch (e: any) {
    console.error('Camp market edit error:', e);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// POST /api/camp-market/listing/:id/renew — repost/renew an expired or inactive listing
router.post('/listing/:id/renew', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const listing = await prisma.campMarketListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    // Check user is currently checked in somewhere
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: { userId, isActive: true },
      select: { campgroundId: true, checkOutDate: true },
    });
    if (!activeCheckIn?.campgroundId) {
      return res.status(400).json({ error: 'You must be checked in to renew a listing' });
    }

    // Renew: reactivate at current campground with new expiry
    const expiresAt = activeCheckIn.checkOutDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const renewed = await prisma.campMarketListing.update({
      where: { id: req.params.id },
      data: {
        isActive: true,
        campgroundId: activeCheckIn.campgroundId,
        expiresAt,
        completedBuyerId: null, // reset sold status
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
    });
    res.json(renewed);
  } catch (e: any) {
    console.error('Camp market renew error:', e);
    res.status(500).json({ error: 'Failed to renew listing' });
  }
});

// POST /api/camp-market/listing/:id/interest — express interest + create record
router.post('/listing/:id/interest', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const listing = await prisma.campMarketListing.findUnique({
      where: { id: req.params.id },
    });
    if (!listing || !listing.isActive) return res.status(404).json({ error: 'Listing not found' });

    // Create interest record (deduplicate)
    await prisma.campMarketInterest.upsert({
      where: { listingId_buyerId: { listingId: listing.id, buyerId: userId } },
      create: { listingId: listing.id, buyerId: userId },
      update: {},
    });

    // Post campfire message
    const buyer = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    const room = await prisma.campfireRoom.findUnique({ where: { campgroundId: listing.campgroundId } });
    if (room) {
      await prisma.campfireMessage.create({
        data: {
          roomId: room.id, userId, isSystem: true,
          content: `🛒 ${buyer?.firstName || 'Someone'} is interested in "${listing.title}"${listing.siteNumber ? ` at site ${listing.siteNumber}` : ''}! Check your messages.`,
        },
      });
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error('Camp market interest error:', e);
    res.status(500).json({ error: 'Failed to express interest' });
  }
});

// GET /api/camp-market/listing/:id/interests — seller sees interested buyers
router.get('/listing/:id/interests', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const listing = await prisma.campMarketListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.userId !== userId) return res.status(403).json({ error: 'Only seller can view interests' });

    const interests = await prisma.campMarketInterest.findMany({
      where: { listingId: listing.id },
      include: { buyer: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ interests, completedBuyerId: listing.completedBuyerId });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});

// POST /api/camp-market/listing/:id/complete — mark listing as sold to a buyer
router.post('/listing/:id/complete', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const { buyerId } = req.body;
    if (!buyerId) return res.status(400).json({ error: 'buyerId required' });

    const listing = await prisma.campMarketListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.userId !== userId) return res.status(403).json({ error: 'Only seller can complete' });

    await prisma.campMarketListing.update({
      where: { id: listing.id },
      data: { completedBuyerId: buyerId, isActive: false },
    });

    // Send basecamp activity to both parties
    const seller = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { firstName: true } });
    const feedbackDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Notify buyer
    await prisma.basecampActivity.create({
      data: {
        userId: buyerId, actorId: userId,
        type: 'CAMP_MARKET_FEEDBACK_REQUEST', entityType: 'CAMP_MARKET', entityId: listing.id,
        entityName: listing.title,
        metadata: { sellerId: userId, sellerName: seller?.firstName, feedbackDeadline: feedbackDeadline.toISOString() },
      },
    });
    // Notify seller
    await prisma.basecampActivity.create({
      data: {
        userId, actorId: buyerId,
        type: 'CAMP_MARKET_FEEDBACK_REQUEST', entityType: 'CAMP_MARKET', entityId: listing.id,
        entityName: listing.title,
        metadata: { buyerId, buyerName: buyer?.firstName, feedbackDeadline: feedbackDeadline.toISOString() },
      },
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error('Camp market complete error:', e);
    res.status(500).json({ error: 'Failed to complete listing' });
  }
});

// POST /api/camp-market/listing/:id/feedback — submit feedback
router.post('/listing/:id/feedback', authenticateToken, async (req: any, res: Response) => {
  try {
    const reviewerId = req.userId || (req as any).user?.id;
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const listing = await prisma.campMarketListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (!listing.completedBuyerId) return res.status(400).json({ error: 'Listing not marked as completed' });

    // Check feedback window (7 days after expiry)
    const feedbackDeadline = new Date(listing.expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() > feedbackDeadline) return res.status(400).json({ error: 'Feedback window has closed' });

    // Determine role and reviewee
    const isSeller = listing.userId === reviewerId;
    const isBuyer = listing.completedBuyerId === reviewerId;
    if (!isSeller && !isBuyer) return res.status(403).json({ error: 'Not a party to this transaction' });

    const role = isSeller ? 'BUYER' : 'SELLER'; // reviewing the other party's role
    const revieweeId = isSeller ? listing.completedBuyerId : listing.userId;

    // Check for existing feedback
    const existing = await prisma.campMarketFeedback.findUnique({
      where: { listingId_reviewerId: { listingId: listing.id, reviewerId } },
    });
    if (existing) return res.status(400).json({ error: 'Already submitted feedback for this listing' });

    await prisma.campMarketFeedback.create({
      data: {
        listingId: listing.id, reviewerId, revieweeId,
        role, rating,
        comment: comment?.trim()?.slice(0, 200) || null,
        expiresAt: feedbackDeadline,
      },
    });

    // Recompute stats
    await recomputeStats(revieweeId);

    res.json({ success: true });
  } catch (e: any) {
    console.error('Camp market feedback error:', e);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /api/camp-market/user/:userId/stats — reputation stats
router.get('/user/:userId/stats', async (req: Request, res: Response) => {
  try {
    const stats = await prisma.campMarketStats.findUnique({ where: { userId: req.params.userId } });
    res.json(stats || { totalSales: 0, totalPurchases: 0, avgSellerRating: 0, avgBuyerRating: 0, totalFeedbackCount: 0 });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/camp-market/user/:userId/feedback — feedback history
router.get('/user/:userId/feedback', async (req: Request, res: Response) => {
  try {
    const { role, limit = '10', offset = '0' } = req.query;
    const where: any = { revieweeId: req.params.userId };
    if (role === 'SELLER' || role === 'BUYER') where.role = role;

    const feedback = await prisma.campMarketFeedback.findMany({
      where,
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });
    const total = await prisma.campMarketFeedback.count({ where });
    res.json({ feedback, total });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET /api/camp-market/pending-feedback — listings needing feedback from this user
router.get('/pending-feedback/me', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const now = new Date();

    // Listings where user is seller or completed buyer, within feedback window, no feedback yet
    const completedListings = await prisma.campMarketListing.findMany({
      where: {
        completedBuyerId: { not: null },
        expiresAt: { gt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        OR: [{ userId }, { completedBuyerId: userId }],
      },
      include: {
        user: { select: { id: true, firstName: true, profilePicture: true } },
        feedback: { where: { reviewerId: userId }, select: { id: true } },
      },
    });

    const pending = completedListings.filter((l: any) => {
      const deadline = new Date(l.expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      return deadline > now && l.feedback.length === 0;
    }).map((l: any) => ({
      listingId: l.id,
      title: l.title,
      otherParty: l.userId === userId
        ? { id: l.completedBuyerId!, role: 'buyer' }
        : { id: l.userId, firstName: l.user.firstName, profilePicture: l.user.profilePicture, role: 'seller' },
      deadline: new Date(l.expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    }));

    res.json({ pending });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch pending feedback' });
  }
});

export default router;
