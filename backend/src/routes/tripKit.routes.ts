import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// POST /api/trip-kits — create
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isCreator: true } });
    if (!user?.isCreator) return res.status(403).json({ error: 'Creator account required' });

    const { title, description, price = 0, coverImageUrl, stops = [], campgroundIds = [], contentIds = [], rigType, tags = [], estimatedDays } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const kit = await (prisma as any).tripKit.create({
      data: {
        creatorId: req.userId,
        title: title.trim(),
        description: description?.trim() || null,
        price,
        coverImageUrl,
        rigType,
        tags,
        estimatedDays,
        status: 'DRAFT',
        stops: {
          create: stops.map((s: any, i: number) => ({
            name: s.name,
            lat: s.lat || null,
            lon: s.lon || null,
            notes: s.notes || null,
            order: i,
            campgroundId: s.campgroundId || null,
          })),
        },
        campgrounds: {
          create: campgroundIds.map((cgId: string, i: number) => ({
            campgroundId: cgId,
            order: i,
          })),
        },
        contentPieces: {
          create: contentIds.map((cId: string) => ({ contentId: cId })),
        },
      },
      include: {
        stops: { orderBy: { order: 'asc' } },
        campgrounds: { include: { campground: { select: { id: true, name: true, state: true, imageUrl: true } } }, orderBy: { order: 'asc' } },
        contentPieces: { include: { content: { select: { id: true, title: true, thumbnailUrl: true } } } },
        _count: { select: { saves: true, purchases: true } },
      },
    });

    res.json({ kit });
  } catch (e: any) {
    console.error('[TripKit] Create error:', e);
    res.status(500).json({ error: 'Failed to create trip kit' });
  }
});

// GET /api/trip-kits/:id
router.get('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const kit = await (prisma as any).tripKit.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, creatorDisplayName: true, creatorHandle: true } },
        stops: { orderBy: { order: 'asc' }, include: { campground: { select: { id: true, name: true, state: true, city: true, latitude: true, longitude: true, imageUrl: true, maxRvLength: true } } } },
        campgrounds: { orderBy: { order: 'asc' }, include: { campground: { select: { id: true, name: true, state: true, city: true, imageUrl: true } } } },
        contentPieces: { include: { content: { select: { id: true, title: true, thumbnailUrl: true, contentType: true, viewCount: true } } } },
        _count: { select: { saves: true, purchases: true } },
      },
    });

    if (!kit) return res.status(404).json({ error: 'Trip kit not found' });
    if (kit.status !== 'PUBLISHED' && kit.creatorId !== req.userId) {
      return res.status(404).json({ error: 'Trip kit not found' });
    }

    // Check if user has saved this kit
    const saved = await (prisma as any).tripKitSave.findUnique({
      where: { tripKitId_userId: { tripKitId: kit.id, userId: req.userId } },
    });

    res.json({ kit: { ...kit, userHasSaved: !!saved } });
  } catch (e: any) {
    console.error('[TripKit] Get error:', e);
    res.status(500).json({ error: 'Failed to load trip kit' });
  }
});

// GET /api/trip-kits/creator/:creatorId — list published kits
router.get('/creator/:creatorId', async (req: any, res: Response) => {
  try {
    const kits = await (prisma as any).tripKit.findMany({
      where: { creatorId: req.params.creatorId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      include: {
        stops: { orderBy: { order: 'asc' }, take: 3 },
        _count: { select: { saves: true, purchases: true, stops: true } },
      },
    });
    res.json({ kits });
  } catch (e: any) {
    console.error('[TripKit] List error:', e);
    res.status(500).json({ error: 'Failed to list trip kits' });
  }
});

// PATCH /api/trip-kits/:id
router.patch('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).tripKit.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.creatorId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const { title, description, price, coverImageUrl, rigType, tags, estimatedDays, status } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price;
    if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl;
    if (rigType !== undefined) data.rigType = rigType;
    if (tags !== undefined) data.tags = tags;
    if (estimatedDays !== undefined) data.estimatedDays = estimatedDays;
    if (status !== undefined) {
      data.status = status;
      if (status === 'PUBLISHED' && !existing.publishedAt) data.publishedAt = new Date();
    }

    const kit = await (prisma as any).tripKit.update({ where: { id: req.params.id }, data });
    res.json({ kit });
  } catch (e: any) {
    console.error('[TripKit] Update error:', e);
    res.status(500).json({ error: 'Failed to update trip kit' });
  }
});

// DELETE /api/trip-kits/:id
router.delete('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).tripKit.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.creatorId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    await (prisma as any).tripKit.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[TripKit] Delete error:', e);
    res.status(500).json({ error: 'Failed to delete trip kit' });
  }
});

// POST /api/trip-kits/:id/save — toggle
router.post('/:id/save', authenticateToken, async (req: any, res: Response) => {
  try {
    const existing = await (prisma as any).tripKitSave.findUnique({
      where: { tripKitId_userId: { tripKitId: req.params.id, userId: req.userId } },
    });
    if (existing) {
      await (prisma as any).tripKitSave.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }
    await (prisma as any).tripKitSave.create({ data: { tripKitId: req.params.id, userId: req.userId } });
    res.json({ saved: true });
  } catch (e: any) {
    console.error('[TripKit] Save error:', e);
    res.status(500).json({ error: 'Failed to toggle save' });
  }
});

// POST /api/trip-kits/:id/use — create trip from kit
router.post('/:id/use', authenticateToken, async (req: any, res: Response) => {
  try {
    const kit = await (prisma as any).tripKit.findUnique({
      where: { id: req.params.id },
      include: {
        stops: { orderBy: { order: 'asc' }, include: { campground: true } },
        campgrounds: { orderBy: { order: 'asc' } },
      },
    });
    if (!kit || kit.status !== 'PUBLISHED') return res.status(404).json({ error: 'Trip kit not found' });

    // Create a new Event (trip) from the kit
    const firstCampground = kit.campgrounds[0]?.campgroundId || kit.stops[0]?.campgroundId;
    const trip = await prisma.event.create({
      data: {
        title: kit.title,
        description: `Trip from creator kit: ${kit.title}`,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default 1 week from now
        endDate: new Date(Date.now() + (7 + (kit.estimatedDays || 3)) * 24 * 60 * 60 * 1000),
        organizerId: req.userId,
        campgroundId: firstCampground || null,
        location: kit.stops[0]?.name || '',
      },
    });

    // Track the purchase/usage
    await (prisma as any).tripKitPurchase.create({
      data: { tripKitId: kit.id, userId: req.userId, pricePaid: 0 },
    });

    res.json({ tripId: trip.id, eventId: trip.id });
  } catch (e: any) {
    console.error('[TripKit] Use error:', e);
    res.status(500).json({ error: 'Failed to create trip from kit' });
  }
});

export default router;
