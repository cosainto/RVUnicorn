import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/harvest-hosts?lat=&lng=&radius=&type=&state=
router.get('/', optionalAuth, async (req: any, res) => {
  try {
    const { lat, lng, radius = 50, type, state } = req.query;
    let hosts: any[] = [];

    if (lat && lng) {
      const latN = parseFloat(lat as string);
      const lngN = parseFloat(lng as string);
      const r = parseFloat(radius as string) / 69;
      hosts = await prisma.harvestHost.findMany({
        where: {
          latitude: { gte: latN - r, lte: latN + r },
          longitude: { gte: lngN - r, lte: lngN + r },
          ...(type ? { hostType: type as string } : {}),
        },
        include: {
          reviews: { select: { rating: true } },
          _count: { select: { reviews: true } },
        },
        take: 30,
      });
    } else {
      hosts = await prisma.harvestHost.findMany({
        where: {
          ...(state ? { state: state as string } : {}),
          ...(type ? { hostType: type as string } : {}),
        },
        include: {
          reviews: { select: { rating: true } },
          _count: { select: { reviews: true } },
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    }

    const enriched = hosts.map(h => ({
      ...h,
      avgRating: h.reviews.length ? h.reviews.reduce((a: number, r: any) => a + r.rating, 0) / h.reviews.length : null,
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch harvest hosts' });
  }
});

// GET /api/harvest-hosts/:id
router.get('/:id', optionalAuth, async (req: any, res) => {
  try {
    const host = await prisma.harvestHost.findUnique({
      where: { id: req.params.id },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
        },
        _count: { select: { reviews: true } },
      },
    });
    if (!host) return res.status(404).json({ error: 'Not found' });
    const avgRating = host.reviews.length ? host.reviews.reduce((a, r) => a + r.rating, 0) / host.reviews.length : null;
    res.json({ ...host, avgRating });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch host' });
  }
});

// POST /api/harvest-hosts — submit a new host
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { name, hostType, description, address, city, state, latitude, longitude, website, phone, imageUrl, amenities, maxRvLength, maxRvs, hookups, requiresMembership } = req.body;
    if (!name || !hostType || !address || !latitude || !longitude) {
      return res.status(400).json({ error: 'name, hostType, address, lat, lng required' });
    }
    const host = await prisma.harvestHost.create({
      data: {
        name, hostType, description, address, city, state,
        latitude: parseFloat(latitude), longitude: parseFloat(longitude),
        website, phone, imageUrl,
        amenities: amenities || [],
        maxRvLength: maxRvLength ? parseInt(maxRvLength) : null,
        maxRvs: maxRvs ? parseInt(maxRvs) : null,
        hookups: hookups ?? false,
        requiresMembership: requiresMembership ?? true,
      },
    });
    res.status(201).json(host);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create harvest host' });
  }
});

// POST /api/harvest-hosts/:id/reviews
// Helper: award badge if not already earned
async function awardBadgeIfEarned(userId: string, slug: string) {
  try {
    const badge = await prisma.badge.findUnique({ where: { slug } });
    if (!badge) return;
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      create: { userId, badgeId: badge.id },
      update: {}
    });
    await prisma.notification.create({
      data: {
        userId,
        type: 'BADGE_EARNED',
        content: `🏅 You earned the "${badge.name}" badge!`,
        link: '/profile',
      }
    }).catch(() => null);
  } catch {}
}

router.post('/:id/reviews', authenticateToken, async (req: any, res) => {
  try {
    const { rating, content, visitDate } = req.body;
    if (!rating) return res.status(400).json({ error: 'rating required' });
    const review = await prisma.harvestHostReview.upsert({
      where: { hostId_userId: { hostId: req.params.id, userId: req.userId } },
      update: { rating: parseInt(rating), content, visitDate: visitDate ? new Date(visitDate) : null },
      create: { hostId: req.params.id, userId: req.userId, rating: parseInt(rating), content, visitDate: visitDate ? new Date(visitDate) : null },
      include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } },
    });
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

export default router;

// POST /api/harvest-hosts/scrape - Accept URL submission for review
router.post('/scrape', authenticateToken, async (req: any, res) => {
  try {
    const { url, networkType } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const userId = req.user?.id;

    // Store submission for admin review
    await (prisma as any).harvestHostSubmission?.create?.({
      data: { url, networkType: networkType || 'HARVEST_HOSTS', submittedById: userId, status: 'PENDING' }
    }).catch(() => null); // If model doesn't exist yet, fail silently

    // Notify Will for review
    await prisma.notification.create({
      data: {
        userId: 'cmlpeyk82005s3qause3sws7y',
        type: 'SYSTEM',
        content: `New RV host listing submitted: ${url} (${networkType})`,
        link: '/admin',
      }
    }).catch(() => null);

    res.json({ success: true, message: 'Submitted for review' });
  } catch (error) {
    console.error('Scrape submission error:', error);
    res.status(500).json({ error: 'Failed to submit' });
  }
});

// POST /api/harvest-hosts/:id/claim
router.post('/:id/claim', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const host = await (prisma as any).harvestHost.findUnique({ where: { id } });
    if (!host) return res.status(404).json({ error: 'Not found' });
    if (host.claimedByUserId) return res.status(400).json({ error: 'Already claimed' });
    const updated = await (prisma as any).harvestHost.update({
      where: { id },
      data: { claimedByUserId: userId }
    });
    // Notify admin
    await prisma.notification.create({
      data: {
        userId: 'cmlpeyk82005s3qause3sws7y',
        type: 'SYSTEM',
        content: `New host claim: "${host.name}" claimed by user ${userId}`,
        link: '/admin',
      }
    }).catch(() => null);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to claim' });
  }
});

// PUT /api/harvest-hosts/:id - Update host (owner or admin only)
router.put('/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const host = await (prisma as any).harvestHost.findUnique({ where: { id } });
    if (!host) return res.status(404).json({ error: 'Not found' });
    const isAdmin = ['cmlpeyk82005s3qause3sws7y', 'cmm9kukta0006i88masvtz2tp'].includes(userId);
    if (host.claimedByUserId !== userId && !isAdmin) return res.status(403).json({ error: 'Not authorized' });
    const updated = await (prisma as any).harvestHost.update({ where: { id }, data: req.body });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update' });
  }
});
