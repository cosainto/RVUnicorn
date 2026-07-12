import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

const BUSINESS_CATEGORIES = ['restaurant', 'gas_station', 'grocery', 'outdoor_gear', 'activities', 'brewery', 'coffee', 'laundry', 'repair', 'entertainment', 'other'];

// ══ GET /api/local-business/near/:campgroundId ══
router.get('/near/:campgroundId', async (req, res: Response) => {
  try {
    const campground = await prisma.campground.findUnique({
      where: { id: req.params.campgroundId },
      select: { latitude: true, longitude: true },
    });
    if (!campground?.latitude || !campground?.longitude) return res.json({ businesses: [] });

    // Find linked businesses
    const linked = await (prisma as any).localBusinessCampground.findMany({
      where: { campgroundId: req.params.campgroundId },
      include: { business: true },
    });

    if (linked.length > 0) {
      return res.json({ businesses: linked.map((l: any) => ({ ...l.business, distanceMiles: l.distanceMiles })) });
    }

    // Find nearby businesses by lat/lng (0.3 degrees ≈ ~20 miles)
    const nearby = await (prisma as any).localBusiness.findMany({
      where: {
        isActive: true,
        latitude: { gte: campground.latitude - 0.3, lte: campground.latitude + 0.3 },
        longitude: { gte: campground.longitude - 0.3, lte: campground.longitude + 0.3 },
      },
      take: 12,
    });

    // Calculate distances
    const withDistance = nearby.map((b: any) => {
      const R = 3959;
      const dLat = (b.latitude - campground.latitude!) * Math.PI / 180;
      const dLon = (b.longitude - campground.longitude!) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(campground.latitude! * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return { ...b, distanceMiles: Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10 };
    }).sort((a: any, b: any) => a.distanceMiles - b.distanceMiles);

    res.json({ businesses: withDistance });
  } catch { res.json({ businesses: [] }); }
});

// ══ GET /api/local-business/categories ══
router.get('/categories', (_req, res: Response) => {
  res.json({ categories: BUSINESS_CATEGORIES });
});

// ══ POST /api/local-business — create listing ══
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const { name, description, category, address, city, state, latitude, longitude, phone, website, imageUrl, hoursOfOperation, priceRange, campgroundIds } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'Name and category required' });

    const business = await (prisma as any).localBusiness.create({
      data: { name, description, category, address, city, state, latitude, longitude, phone, website, imageUrl, hoursOfOperation, priceRange, ownerId: req.userId },
    });

    // Link to campgrounds
    if (campgroundIds?.length > 0) {
      for (const cgId of campgroundIds) {
        await (prisma as any).localBusinessCampground.create({
          data: { businessId: business.id, campgroundId: cgId },
        }).catch(() => {});
      }
    }

    res.json({ business });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ GET /api/local-business/:id ══
router.get('/:id', async (req, res: Response) => {
  try {
    const business = await (prisma as any).localBusiness.findUnique({
      where: { id: req.params.id },
      include: { campgroundLinks: { include: { } } },
    });
    res.json({ business });
  } catch { res.status(404).json({ error: 'Not found' }); }
});

// ══ PUT /api/local-business/:id ══
router.put('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const business = await (prisma as any).localBusiness.findUnique({ where: { id: req.params.id } });
    if (!business || business.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const updated = await (prisma as any).localBusiness.update({ where: { id: req.params.id }, data: req.body });
    res.json({ business: updated });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
