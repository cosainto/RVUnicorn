import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Helper to check tier access
const tierLevel = (tier: string): number => {
  const levels: Record<string, number> = { FREE: 0, CLASS_C: 1, CLASS_B: 2, CLASS_A: 3 };
  return levels[tier] || 0;
};

// Check if user is admin/owner of campground
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  const userId = (req as any).userId;
  const { campgroundId } = req.params;
  
  const admin = await prisma.campgroundAdmin.findUnique({
    where: { userId_campgroundId: { userId, campgroundId } }
  });
  
  if (!admin) {
    return res.status(403).json({ error: 'Not authorized - admin access required' });
  }
  
  (req as any).adminRole = admin.role;
  next();
};

const requireOwner = async (req: Request, res: Response, next: Function) => {
  const userId = (req as any).userId;
  const { campgroundId } = req.params;
  
  const admin = await prisma.campgroundAdmin.findUnique({
    where: { userId_campgroundId: { userId, campgroundId } }
  });
  
  if (!admin || admin.role !== 'OWNER') {
    return res.status(403).json({ error: 'Not authorized - owner access required' });
  }
  next();
};

// POST /api/business/claim/:campgroundId
router.post('/claim/:campgroundId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId } = req.params;
    const { businessEmail, businessPhone, verificationDocs } = req.body;

    const campground = await prisma.campground.findUnique({ where: { id: campgroundId } });
    if (!campground) return res.status(404).json({ error: 'Campground not found' });
    if (campground.verificationStatus !== 'UNCLAIMED') {
      return res.status(400).json({ error: 'Campground already claimed or pending' });
    }

    const updated = await prisma.campground.update({
      where: { id: campgroundId },
      data: {
        claimedById: userId,
        claimedAt: new Date(),
        verificationStatus: 'PENDING',
        businessEmail,
        businessPhone,
        verificationDocs: verificationDocs || []
      }
    });

    res.json({ message: 'Claim request submitted', campground: updated });
  } catch (error) {
    console.error('Claim campground error:', error);
    res.status(500).json({ error: 'Failed to submit claim' });
  }
});

// POST /api/business/approve-claim/:campgroundId
router.post('/approve-claim/:campgroundId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email !== 'will@kindletribe.com') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const campground = await prisma.campground.findUnique({ where: { id: campgroundId } });
    if (!campground || !campground.claimedById) {
      return res.status(400).json({ error: 'No pending claim' });
    }

    await prisma.campground.update({
      where: { id: campgroundId },
      data: { verificationStatus: 'VERIFIED' }
    });

    await prisma.campgroundAdmin.upsert({
      where: { userId_campgroundId: { userId: campground.claimedById, campgroundId } },
      create: { userId: campground.claimedById, campgroundId, role: 'OWNER' },
      update: { role: 'OWNER' }
    });

    res.json({ message: 'Claim approved' });
  } catch (error) {
    console.error('Approve claim error:', error);
    res.status(500).json({ error: 'Failed to approve claim' });
  }
});

// GET /api/business/my
router.get('/my', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const adminRoles = await prisma.campgroundAdmin.findMany({
      where: { userId },
      include: {
        campground: {
          include: { _count: { select: { followers: true, reviews: true } } }
        }
      }
    });

    res.json(adminRoles.map(a => ({ ...a.campground, role: a.role })));
  } catch (error) {
    console.error('My businesses error:', error);
    res.status(500).json({ error: 'Failed to get businesses' });
  }
});

// GET /api/business/:campgroundId/dashboard
router.get('/:campgroundId/dashboard', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      include: {
        _count: {
          select: { followers: true, reviews: true, photos: true, checkIns: true, threads: true, announcements: true, campgroundEvents: true, stickers: true }
        },
        admins: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profilePicture: true } } }
        }
      }
    });

    if (!campground) return res.status(404).json({ error: 'Campground not found' });

    const reviews = await prisma.campgroundReview.findMany({ where: { campgroundId }, select: { rating: true } });
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    const recentReviews = await prisma.campgroundReview.findMany({
      where: { campgroundId }, take: 5, orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true, profilePicture: true } } }
    });

    const pendingPhotos = await prisma.campgroundPhoto.findMany({
      where: { campgroundId, status: 'PENDING' },
      include: { user: { select: { firstName: true, lastName: true, profilePicture: true } } }
    });

    res.json({
      campground,
      stats: {
        followers: campground._count.followers,
        reviews: campground._count.reviews,
        avgRating: Math.round(avgRating * 10) / 10,
        photos: campground._count.photos,
        checkIns: campground._count.checkIns,
        threads: campground._count.threads,
        events: campground._count.campgroundEvents,
        stickers: campground._count.stickers
      },
      recentActivity: { reviews: recentReviews },
      pendingItems: { photos: pendingPhotos },
      admins: campground.admins
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// GET /api/business/:campgroundId/admins
router.get('/:campgroundId/admins', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const admins = await prisma.campgroundAdmin.findMany({
      where: { campgroundId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profilePicture: true } } }
    });
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Failed to get admins' });
  }
});

// POST /api/business/:campgroundId/admins
router.post('/:campgroundId/admins', authenticateToken, requireOwner, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { email, role } = req.body;
    const addedById = (req as any).userId;

    const campground = await prisma.campground.findUnique({ where: { id: campgroundId } });
    if (campground?.tier !== 'CLASS_A') {
      const existingAdmins = await prisma.campgroundAdmin.count({ where: { campgroundId } });
      if (existingAdmins >= 1) return res.status(403).json({ error: 'Upgrade to Class A for multiple admins' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const admin = await prisma.campgroundAdmin.create({
      data: { campgroundId, userId: user.id, role: role || 'MODERATOR', addedById },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profilePicture: true } } }
    });
    res.json(admin);
  } catch (error) {
    console.error('Add admin error:', error);
    res.status(500).json({ error: 'Failed to add admin' });
  }
});

// DELETE /api/business/:campgroundId/admins/:userId
router.delete('/:campgroundId/admins/:adminUserId', authenticateToken, requireOwner, async (req: Request, res: Response) => {
  try {
    const { campgroundId, adminUserId } = req.params;
    await prisma.campgroundAdmin.delete({ where: { userId_campgroundId: { userId: adminUserId, campgroundId } } });
    res.json({ message: 'Admin removed' });
  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ error: 'Failed to remove admin' });
  }
});

// PUT /api/business/:campgroundId/branding
router.put('/:campgroundId/branding', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const campground = await prisma.campground.findUnique({ where: { id: campgroundId } });
    if (tierLevel(campground?.tier || 'FREE') < tierLevel('CLASS_B')) {
      return res.status(403).json({ error: 'Upgrade to Class B for branding' });
    }
    const { accentColor, headerLayout, theme } = req.body;
    const updated = await prisma.campground.update({ where: { id: campgroundId }, data: { accentColor, headerLayout, theme } });
    res.json(updated);
  } catch (error) {
    console.error('Update branding error:', error);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// GET /api/business/:campgroundId/analytics
router.get('/:campgroundId/analytics', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const campground = await prisma.campground.findUnique({ where: { id: campgroundId } });
    if (campground?.tier !== 'CLASS_A') return res.status(403).json({ error: 'Upgrade to Class A for analytics' });

    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const analytics = await prisma.campgroundAnalytics.groupBy({
      by: ['eventType'],
      where: { campgroundId, date: { gte: startDate } },
      _count: true
    });

    res.json({ summary: analytics });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// POST /api/business/:campgroundId/track
router.post('/:campgroundId/track', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { eventType, source, metadata } = req.body;
    const userId = (req as any).userId || null;
    await prisma.campgroundAnalytics.create({ data: { campgroundId, eventType, userId, source, metadata } });
    res.json({ success: true });
  } catch (error) {
    console.error('Track error:', error);
    res.status(500).json({ error: 'Failed to track' });
  }
});

// PUT /api/business/:campgroundId/settings
router.put('/:campgroundId/settings', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { 
      businessEmail, businessPhone, bookingUrl, websiteUrl, description,
      hashtag, facebookUrl, instagramUrl, twitterUrl, youtubeUrl, tiktokUrl,
      theme, accentColor
    } = req.body;

    // If hashtag is provided, check for uniqueness
    if (hashtag) {
      const existing = await prisma.campground.findFirst({
        where: { 
          hashtag: { equals: hashtag, mode: 'insensitive' },
          NOT: { id: campgroundId }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'This hashtag is already taken' });
      }
    }

    const updated = await prisma.campground.update({
      where: { id: campgroundId },
      data: { 
        businessEmail, businessPhone, bookingUrl, websiteUrl, description,
        hashtag: hashtag || null,
        facebookUrl: facebookUrl || null,
        instagramUrl: instagramUrl || null,
        twitterUrl: twitterUrl || null,
        youtubeUrl: youtubeUrl || null,
        tiktokUrl: tiktokUrl || null,
        theme: theme || null,
        accentColor: accentColor || null
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
