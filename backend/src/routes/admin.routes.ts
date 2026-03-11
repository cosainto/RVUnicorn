import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();
const prisma = new PrismaClient();

const WILL_ID = 'cmlpeyk82005s3qause3sws7y';
const ADMIN_IDS = ['cmlpeyk82005s3qause3sws7y', 'cmm9kukta0006i88masvtz2tp'];

function requireWill(req: any, res: Response, next: any) {
  const ADMIN_IDS = ['cmlpeyk82005s3qause3sws7y', 'cmm9kukta0006i88masvtz2tp'];
  if (!ADMIN_IDS.includes(req.user?.id)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  next();
});
  }
  next();
}

// POST /api/admin/campgrounds - Create a new campground
router.post('/campgrounds', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    const {
      name, description, location, city, state, zipCode,
      latitude, longitude, imageUrl, websiteUrl, bookingUrl,
      businessEmail, businessPhone,
      hasElectricHookup, hasWaterHookup, hasSewerHookup, hasFullHookups,
      hasPullThrough, hasBackIn, hasRestrooms, hasShowers, hasLaundry,
      hasPool, hasDumpStation, hasCableTV, hasPropane, hasWifi,
      amenities,
    } = req.body;

    if (!name || !location) {
      return res.status(400).json({ error: 'Name and location are required' });
    }

    const campground = await prisma.campground.create({
      data: {
        name,
        description,
        location,
        city,
        state,
        zipCode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        imageUrl,
        websiteUrl,
        bookingUrl,
        businessEmail,
        businessPhone,
        hasElectricHookup: hasElectricHookup || false,
        hasWaterHookup: hasWaterHookup || false,
        hasSewerHookup: hasSewerHookup || false,
        hasFullHookups: hasFullHookups || false,
        hasPullThrough: hasPullThrough || false,
        hasBackIn: hasBackIn || false,
        hasRestrooms: hasRestrooms || false,
        hasShowers: hasShowers || false,
        hasLaundry: hasLaundry || false,
        hasPool: hasPool || false,
        hasDumpStation: hasDumpStation || false,
        hasCableTV: hasCableTV || false,
        hasPropane: hasPropane || false,
        hasWifi: hasWifi || false,
        amenities: amenities || [],
        verificationStatus: 'UNCLAIMED',
      },
    });

    res.status(201).json(campground);
  } catch (error) {
    console.error('Create campground error:', error);
    res.status(500).json({ error: 'Failed to create campground' });
  }
});

// GET /api/admin/campgrounds - List all (for Will's dashboard)
router.get('/campgrounds', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    const { search, page = '1' } = req.query;
    const skip = (parseInt(page as string) - 1) * 50;

    const where = search ? {
      OR: [
        { name: { contains: search as string, mode: 'insensitive' as any } },
        { state: { contains: search as string, mode: 'insensitive' as any } },
        { city: { contains: search as string, mode: 'insensitive' as any } },
      ]
    } : {};

    const [campgrounds, total] = await Promise.all([
      prisma.campground.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip,
        select: { id: true, name: true, city: true, state: true, verificationStatus: true, createdAt: true, imageUrl: true },
      }),
      prisma.campground.count({ where }),
    ]);

    res.json({ campgrounds, total, pages: Math.ceil(total / 50) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch campgrounds' });
  }
});

// PUT /api/admin/campgrounds/:id - Edit a campground
router.put('/campgrounds/:id', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (data.latitude) data.latitude = parseFloat(data.latitude);
    if (data.longitude) data.longitude = parseFloat(data.longitude);

    const campground = await prisma.campground.update({
      where: { id },
      data,
    });
    res.json(campground);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update campground' });
  }
});

// DELETE /api/admin/campgrounds/:id
router.delete('/campgrounds/:id', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    await prisma.campground.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete campground' });
  }
});

export default router;
