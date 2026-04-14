import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Owner: POST /api/last-minute — create deal ──
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const ownerId = req.userId || (req as any).user?.id;
    const { campgroundId, title, description, availableFrom, availableTo, sitesAvailable, originalPrice, discountPrice, maxRigLength, requiresHookups, allowsPets } = req.body;
    if (!campgroundId || !title || !availableFrom || !availableTo) return res.status(400).json({ error: 'Missing required fields' });

    const pct = originalPrice && discountPrice ? Math.round((1 - discountPrice / originalPrice) * 100) : null;

    const deal = await prisma.lastMinuteDeal.create({
      data: {
        campgroundId, ownerId, title: title.trim(), description: description?.trim() || null,
        availableFrom: new Date(availableFrom), availableTo: new Date(availableTo),
        sitesAvailable: sitesAvailable || 1,
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        discountPrice: discountPrice ? parseFloat(discountPrice) : null,
        discountPercent: pct,
        maxRigLength: maxRigLength ? parseFloat(maxRigLength) : null,
        requiresHookups: requiresHookups || false,
        allowsPets: allowsPets !== false,
        expiresAt: new Date(availableFrom),
      },
      include: { campground: { select: { id: true, name: true, latitude: true, longitude: true, imageUrl: true } } },
    });

    // Async notification push
    pushDealNotifications(deal).catch(() => {});

    res.json({ deal });
  } catch {
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// ── Owner: GET /api/last-minute/my-deals ──
router.get('/my-deals', authenticateToken, async (req: any, res: Response) => {
  try {
    const ownerId = req.userId || (req as any).user?.id;
    const deals = await prisma.lastMinuteDeal.findMany({
      where: { ownerId },
      include: { campground: { select: { id: true, name: true, imageUrl: true } }, _count: { select: { views: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ deals });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Owner: PATCH /api/last-minute/:id ──
router.patch('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const ownerId = req.userId || (req as any).user?.id;
    const deal = await prisma.lastMinuteDeal.findUnique({ where: { id: req.params.id } });
    if (!deal || deal.ownerId !== ownerId) return res.status(403).json({ error: 'Not authorized' });
    const updated = await prisma.lastMinuteDeal.update({ where: { id: deal.id }, data: req.body });
    res.json({ deal: updated });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Owner: DELETE /api/last-minute/:id ──
router.delete('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const ownerId = req.userId || (req as any).user?.id;
    const deal = await prisma.lastMinuteDeal.findUnique({ where: { id: req.params.id } });
    if (!deal || deal.ownerId !== ownerId) return res.status(403).json({ error: 'Not authorized' });
    await prisma.lastMinuteDeal.update({ where: { id: deal.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Public: GET /api/last-minute/nearby ──
router.get('/nearby', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { lat, lon, radiusMiles } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const userLat = parseFloat(String(lat));
    const userLon = parseFloat(String(lon));

    // Dynamic radius
    let radius = radiusMiles ? parseFloat(String(radiusMiles)) : 150;
    if (!radiusMiles && userId) {
      try {
        const checkIns = await prisma.checkIn.findMany({
          where: { userId },
          include: { campground: { select: { latitude: true, longitude: true } } },
          take: 20,
        });
        if (checkIns.length > 0) {
          const distances = checkIns.filter((c: any) => c.campground?.latitude && c.campground?.longitude)
            .map((c: any) => haversine(userLat, userLon, c.campground!.latitude!, c.campground!.longitude!));
          const avg = distances.length > 0 ? distances.reduce((a: any, b: any) => a + b, 0) / distances.length : 150;
          radius = avg > 200 ? 200 : avg > 100 ? 150 : 75;
        }
      } catch {}
    }

    const now = new Date();
    const deals = await prisma.lastMinuteDeal.findMany({
      where: { isActive: true, expiresAt: { gt: now }, availableTo: { gt: now } },
      include: {
        campground: { select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true, amenities: true, hasFullHookups: true } },
      },
    });

    // Filter by distance + rig match
    let userRig: any = null;
    if (userId) {
      userRig = await prisma.user.findUnique({ where: { id: userId }, select: { rvLength: true, hasPets: true } });
    }

    const filtered = deals
      .filter((d: any) => d.campground.latitude && d.campground.longitude)
      .map((d: any) => ({
        ...d,
        distance: Math.round(haversine(userLat, userLon, d.campground.latitude!, d.campground.longitude!)),
      }))
      .filter((d: any) => d.distance <= radius)
      .filter((d: any) => !d.maxRigLength || !userRig?.rvLength || userRig.rvLength <= d.maxRigLength)
      .filter((d: any) => d.allowsPets || !userRig?.hasPets)
      .sort((a: any, b: any) => (b.discountPercent || 0) - (a.discountPercent || 0) || a.distance - b.distance);

    res.json({ deals: filtered, radius });
  } catch {
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// ── Public: GET /api/last-minute/feed ──
router.get('/feed', optionalAuth, async (req: Request, res: Response) => {
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const deals = await prisma.lastMinuteDeal.findMany({
      where: { isActive: true, createdAt: { gte: cutoff }, availableTo: { gt: new Date() } },
      include: { campground: { select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json({ deals });
  } catch { res.json({ deals: [] }); }
});

// ── Public: GET /api/last-minute/:id ──
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const deal = await prisma.lastMinuteDeal.update({
      where: { id: req.params.id },
      data: { viewCount: { increment: 1 } },
      include: { campground: { select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true, amenities: true } } },
    });
    res.json({ deal });
  } catch { res.status(404).json({ error: 'Deal not found' }); }
});

// ── POST /api/last-minute/:id/view ──
router.post('/:id/view', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    await prisma.lastMinuteDealView.upsert({
      where: { dealId_userId: { dealId: req.params.id, userId } },
      create: { dealId: req.params.id, userId },
      update: {},
    });
    res.json({ success: true });
  } catch { res.json({ success: true }); }
});

// ── Notification push ──
async function pushDealNotifications(deal: any) {
  try {
    const campground = deal.campground || await prisma.campground.findUnique({
      where: { id: deal.campgroundId },
      select: { name: true, latitude: true, longitude: true },
    });
    if (!campground?.latitude || !campground?.longitude) return;

    const userIds = new Set<string>();
    const body = `${deal.sitesAvailable} site${deal.sitesAvailable > 1 ? 's' : ''} open at ${campground.name} ${deal.discountPercent ? `— ${deal.discountPercent}% off` : ''}`;

    // Priority 1: Users with upcoming trips near this campground
    const upcoming = await prisma.event.findMany({
      where: {
        startDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        campground: { latitude: { not: null } },
      },
      include: { campground: { select: { latitude: true, longitude: true } }, organizer: { select: { id: true } } },
      take: 100,
    });
    for (const trip of upcoming) {
      if (trip.campground?.latitude && haversine(campground.latitude, campground.longitude, trip.campground.latitude, trip.campground.longitude!) < 100) {
        userIds.add(trip.organizer.id);
      }
    }

    // Priority 2: Previous visitors
    const visitors = await prisma.checkIn.findMany({
      where: { campgroundId: deal.campgroundId },
      select: { userId: true },
      distinct: ['userId'],
      take: 100,
    });
    visitors.forEach((v: any) => userIds.add(v.userId));

    // Priority 3: Users who favorited
    const favs = await prisma.campgroundFollow.findMany({
      where: { campgroundId: deal.campgroundId },
      select: { userId: true },
      take: 100,
    });
    favs.forEach((f: any) => userIds.add(f.userId));

    // Remove the owner
    userIds.delete(deal.ownerId);

    // Cap at 500
    const targets = [...userIds].slice(0, 500);

    // Create notifications
    for (const userId of targets) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'LAST_MINUTE_DEAL',
          title: '🔥 Last-minute availability near you',
          content: body,
          link: `/campgrounds/${deal.campgroundId}?deal=${deal.id}`,
          category: 'DEALS',
          metadata: { dealId: deal.id, campgroundName: campground.name },
        },
      }).catch(() => {});
    }

    await prisma.lastMinuteDeal.update({
      where: { id: deal.id },
      data: { notifiedCount: targets.length },
    });
  } catch {}
}

// Exported: weather-triggered deal suggestion
export async function suggestWeatherDeals() {
  try {
    const owners = await prisma.campground.findMany({
      where: { claimedById: { not: null }, latitude: { not: null } },
      select: { id: true, name: true, claimedById: true, latitude: true, longitude: true },
      take: 50,
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const cg of owners) {
      if (!cg.claimedById) continue;

      // Check if already prompted this week
      const recentPrompt = await prisma.notification.findFirst({
        where: { userId: cg.claimedById, type: 'WEATHER_DEAL_PROMPT', createdAt: { gte: weekAgo } },
      });
      if (recentPrompt) continue;

      // Check if already has active deal
      const activeDeal = await prisma.lastMinuteDeal.findFirst({
        where: { campgroundId: cg.id, isActive: true, availableTo: { gt: now } },
      });
      if (activeDeal) continue;

      // Simple weekend check — suggest for upcoming weekend
      const dayOfWeek = now.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        await prisma.notification.create({
          data: {
            userId: cg.claimedById,
            type: 'WEATHER_DEAL_PROMPT',
            title: '☀️ Great camping weather this weekend',
            content: `Perfect conditions coming to ${cg.name} — want to blast a last-minute special to nearby travelers?`,
            link: `/campgrounds/${cg.id}?createDeal=true`,
            category: 'OWNER',
          },
        }).catch(() => {});
      }
    }
  } catch {}
}

export default router;
