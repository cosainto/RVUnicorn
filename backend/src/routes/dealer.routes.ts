import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// ══ GET /api/dealers — list all active dealers ══
router.get('/', async (_req, res: Response) => {
  try {
    const { state, page = '1' } = _req.query;
    const take = 20;
    const skip = (parseInt(page as string) - 1) * take;
    const where: any = { isActive: true };
    if (state) where.state = state;

    const [dealers, total] = await Promise.all([
      (prisma as any).dealerProfile.findMany({ where, take, skip, orderBy: { createdAt: 'desc' }, include: { listings: { where: { isActive: true }, take: 4, orderBy: { createdAt: 'desc' } } } }),
      (prisma as any).dealerProfile.count({ where }),
    ]);
    res.json({ dealers, total, page: parseInt(page as string), pages: Math.ceil(total / take) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ GET /api/dealers/my-profile — get current user's dealer profile ══
router.get('/my-profile', authenticateToken, async (req: any, res: Response) => {
  try {
    const profile = await (prisma as any).dealerProfile.findUnique({
      where: { userId: req.userId },
      include: { listings: { orderBy: { createdAt: 'desc' } } },
    });
    res.json({ profile });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/dealers/profile — create dealer profile ══
router.post('/profile', authenticateToken, async (req: any, res: Response) => {
  try {
    const { dealerName, description, address, city, state, phone, website, logoUrl, bannerUrl } = req.body;
    if (!dealerName) return res.status(400).json({ error: 'Dealer name required' });

    const existing = await (prisma as any).dealerProfile.findUnique({ where: { userId: req.userId } });
    if (existing) return res.status(400).json({ error: 'Profile already exists' });

    const profile = await (prisma as any).dealerProfile.create({
      data: { userId: req.userId, dealerName, description, address, city, state, phone, website, logoUrl, bannerUrl },
    });
    res.json({ profile });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ PUT /api/dealers/profile — update dealer profile ══
router.put('/profile', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).dealerProfile.findUnique({ where: { userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'No dealer profile found' });

    const { dealerName, description, address, city, state, phone, website, logoUrl, bannerUrl } = req.body;
    const profile = await (prisma as any).dealerProfile.update({
      where: { userId: req.userId },
      data: { dealerName, description, address, city, state, phone, website, logoUrl, bannerUrl },
    });
    res.json({ profile });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ GET /api/dealers/:id — public dealer page ══
router.get('/:id', async (req, res: Response) => {
  try {
    const profile = await (prisma as any).dealerProfile.findUnique({
      where: { id: req.params.id },
      include: {
        listings: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
        user: { select: { firstName: true, lastName: true, profilePicture: true } },
      },
    });
    if (!profile || !profile.isActive) return res.status(404).json({ error: 'Dealer not found' });
    res.json({ dealer: profile });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/dealers/listings — create a listing ══
router.post('/listings', authenticateToken, async (req: any, res: Response) => {
  try {
    const dealer = await (prisma as any).dealerProfile.findUnique({ where: { userId: req.userId } });
    if (!dealer) return res.status(403).json({ error: 'Create a dealer profile first' });

    const { title, description, videoUrl, thumbnailUrl, imageUrls, rigClass, make, model, year, price, mileage, condition, features } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const listing = await (prisma as any).dealerListing.create({
      data: { dealerId: dealer.id, title, description, videoUrl, thumbnailUrl, imageUrls: imageUrls || [], rigClass, make, model, year, price, mileage, condition, features: features || [] },
    });
    res.json({ listing });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ PUT /api/dealers/listings/:listingId ══
router.put('/listings/:listingId', authenticateToken, async (req: any, res: Response) => {
  try {
    const dealer = await (prisma as any).dealerProfile.findUnique({ where: { userId: req.userId } });
    if (!dealer) return res.status(403).json({ error: 'Not authorized' });

    const listing = await (prisma as any).dealerListing.findUnique({ where: { id: req.params.listingId } });
    if (!listing || listing.dealerId !== dealer.id) return res.status(403).json({ error: 'Not authorized' });

    const updated = await (prisma as any).dealerListing.update({ where: { id: req.params.listingId }, data: req.body });
    res.json({ listing: updated });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ DELETE /api/dealers/listings/:listingId ══
router.delete('/listings/:listingId', authenticateToken, async (req: any, res: Response) => {
  try {
    const dealer = await (prisma as any).dealerProfile.findUnique({ where: { userId: req.userId } });
    if (!dealer) return res.status(403).json({ error: 'Not authorized' });

    const listing = await (prisma as any).dealerListing.findUnique({ where: { id: req.params.listingId } });
    if (!listing || listing.dealerId !== dealer.id) return res.status(403).json({ error: 'Not authorized' });

    await (prisma as any).dealerListing.update({ where: { id: req.params.listingId }, data: { isActive: false } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/dealers/listings/:listingId/view — track view ══
router.post('/listings/:listingId/view', async (req, res: Response) => {
  try {
    await (prisma as any).dealerListing.update({ where: { id: req.params.listingId }, data: { viewCount: { increment: 1 } } });
    res.json({ success: true });
  } catch { res.json({ success: false }); }
});

// ══ POST /api/dealers/listings/:listingId/inquiry — track inquiry ══
router.post('/listings/:listingId/inquiry', authenticateToken, async (req: any, res: Response) => {
  try {
    await (prisma as any).dealerListing.update({ where: { id: req.params.listingId }, data: { inquiryCount: { increment: 1 } } });
    res.json({ success: true });
  } catch { res.json({ success: false }); }
});

export default router;
