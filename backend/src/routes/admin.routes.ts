import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_IDS = ['cmlpeyk82005s3qause3sws7y', 'cmm9kukta0006i88masvtz2tp'];

function requireWill(req: any, res: Response, next: any) {
  if (!ADMIN_IDS.includes((req as any).userId)) {
    return res.status(403).json({ error: 'Not authorized' });
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

// ===== HOST LISTINGS ADMIN =====

// GET /api/admin/hosts - List all host submissions
router.get('/hosts', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING' } = req.query;
    const hosts = await (prisma as any).harvestHost.findMany({
      where: { status: status as string },
      orderBy: { createdAt: 'desc' },
      include: {
        reviews: { select: { id: true } },
      }
    });
    res.json(hosts);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch hosts' }); }
});

// PUT /api/admin/hosts/:id/approve
router.put('/hosts/:id/approve', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    const host = await (prisma as any).harvestHost.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', isVerified: true }
    });
    // Notify the host owner if claimed
    if (host.claimedByUserId) {
      await prisma.notification.create({
        data: {
          userId: host.claimedByUserId,
          type: 'SYSTEM',
          content: `🎉 Your host listing "${host.name}" has been approved and is now live!`,
          link: `/hosts/${host.id}`,
        }
      });
      // Award RV Host badge
      const badge = await prisma.badge.findUnique({ where: { slug: 'rv-host' } });
      if (badge) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: host.claimedByUserId, badgeId: badge.id } },
          create: { userId: host.claimedByUserId, badgeId: badge.id },
          update: {}
        });
      }
    }
    res.json(host);
  } catch (e) { res.status(500).json({ error: 'Failed to approve' }); }
});

// PUT /api/admin/hosts/:id/reject
router.put('/hosts/:id/reject', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const host = await (prisma as any).harvestHost.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' }
    });
    if (host.claimedByUserId) {
      await prisma.notification.create({
        data: {
          userId: host.claimedByUserId,
          type: 'SYSTEM',
          content: `Your host listing "${host.name}" needs some updates before going live. ${reason || ''}`,
          link: `/hosts/${host.id}/edit`,
        }
      });
    }
    res.json(host);
  } catch (e) { res.status(500).json({ error: 'Failed to reject' }); }
});

// ===== HOST LISTINGS ADMIN =====

// GET /api/admin/hosts - List all host submissions
router.get('/hosts', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING' } = req.query;
    const hosts = await (prisma as any).harvestHost.findMany({
      where: { status: status as string },
      orderBy: { createdAt: 'desc' },
      include: {
        reviews: { select: { id: true } },
      }
    });
    res.json(hosts);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch hosts' }); }
});

// PUT /api/admin/hosts/:id/approve
router.put('/hosts/:id/approve', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    const host = await (prisma as any).harvestHost.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', isVerified: true }
    });
    // Notify the host owner if claimed
    if (host.claimedByUserId) {
      await prisma.notification.create({
        data: {
          userId: host.claimedByUserId,
          type: 'SYSTEM',
          content: `🎉 Your host listing "${host.name}" has been approved and is now live!`,
          link: `/hosts/${host.id}`,
        }
      });
      // Award RV Host badge
      const badge = await prisma.badge.findUnique({ where: { slug: 'rv-host' } });
      if (badge) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: host.claimedByUserId, badgeId: badge.id } },
          create: { userId: host.claimedByUserId, badgeId: badge.id },
          update: {}
        });
      }
    }
    res.json(host);
  } catch (e) { res.status(500).json({ error: 'Failed to approve' }); }
});

// PUT /api/admin/hosts/:id/reject
router.put('/hosts/:id/reject', authenticateToken, requireWill, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const host = await (prisma as any).harvestHost.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' }
    });
    if (host.claimedByUserId) {
      await prisma.notification.create({
        data: {
          userId: host.claimedByUserId,
          type: 'SYSTEM',
          content: `Your host listing "${host.name}" needs some updates before going live. ${reason || ''}`,
          link: `/hosts/${host.id}/edit`,
        }
      });
    }
    res.json(host);
  } catch (e) { res.status(500).json({ error: 'Failed to reject' }); }
});
