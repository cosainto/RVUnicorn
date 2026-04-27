import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// GET /api/mods/marketplace — aggregated mod data across all public rigs
router.get('/marketplace', optionalAuth, async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const rigClass = req.query.rigClass as string | undefined;
    const sort = (req.query.sort as string) || 'popular';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 24;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { isPublic: true };
    if (category && category !== 'All') where.category = category;

    // If rigClass filter, get rigIds first
    let rigIdFilter: string[] | undefined;
    if (rigClass && rigClass !== 'All') {
      const rigs = await prisma.rig.findMany({
        where: { rigClass, isPublic: true },
        select: { id: true },
      });
      rigIdFilter = rigs.map((r: any) => r.id);
      where.rigId = { in: rigIdFilter };
    }

    // Get all matching mods
    const mods = await prisma.modLog.findMany({
      where,
      include: {
        rig: {
          select: { id: true, slug: true, rigName: true, heroPhoto: true, rigClass: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by title+category for aggregation
    const grouped = new Map<string, {
      title: string;
      category: string;
      description: string | null;
      photos: string[];
      beforePhoto: string | null;
      afterPhoto: string | null;
      productLink: string | null;
      costs: number[];
      rigs: { id: string; slug: string; rigName: string | null; heroPhoto: string | null }[];
      modLogIds: string[];
      latestDate: Date;
    }>();

    for (const mod of mods) {
      const key = (mod.title || '').toLowerCase().trim() + '|' + (mod.category || '').toLowerCase().trim();
      const existing = grouped.get(key);

      if (existing) {
        if (mod.cost != null) existing.costs.push(mod.cost);
        if (!existing.rigs.find((r: any) => r.id === mod.rig.id)) {
          existing.rigs.push(mod.rig);
        }
        existing.modLogIds.push(mod.id);
        if (mod.photos?.length && existing.photos.length < 5) {
          existing.photos.push(...mod.photos.slice(0, 5 - existing.photos.length));
        }
        if (!existing.beforePhoto && mod.beforePhoto) existing.beforePhoto = mod.beforePhoto;
        if (!existing.afterPhoto && mod.afterPhoto) existing.afterPhoto = mod.afterPhoto;
        if (!existing.productLink && mod.productLink) existing.productLink = mod.productLink;
        if (new Date(mod.createdAt) > existing.latestDate) existing.latestDate = new Date(mod.createdAt);
      } else {
        grouped.set(key, {
          title: mod.title,
          category: mod.category || 'Other',
          description: mod.description,
          photos: mod.photos?.slice(0, 5) || [],
          beforePhoto: mod.beforePhoto,
          afterPhoto: mod.afterPhoto,
          productLink: mod.productLink,
          costs: mod.cost != null ? [mod.cost] : [],
          rigs: [mod.rig],
          modLogIds: [mod.id],
          latestDate: new Date(mod.createdAt),
        });
      }
    }

    // Convert to array and compute stats
    let results = Array.from(grouped.values()).map(g => ({
      title: g.title,
      category: g.category,
      description: g.description,
      photos: g.photos,
      beforePhoto: g.beforePhoto,
      afterPhoto: g.afterPhoto,
      productLink: g.productLink,
      adoptionCount: g.rigs.length,
      avgCost: g.costs.length > 0 ? Math.round(g.costs.reduce((a, b) => a + b, 0) / g.costs.length) : null,
      rigs: g.rigs.slice(0, 5),
      modLogIds: g.modLogIds,
      latestDate: g.latestDate,
    }));

    // Sort
    if (sort === 'popular') {
      results.sort((a, b) => b.adoptionCount - a.adoptionCount);
    } else if (sort === 'recent') {
      results.sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime());
    } else if (sort === 'cost') {
      results.sort((a, b) => (a.avgCost || 9999) - (b.avgCost || 9999));
    }

    const total = results.length;
    results = results.slice(skip, skip + limit);

    res.json({
      mods: results,
      total,
      page,
      hasMore: skip + limit < total,
    });
  } catch (error: any) {
    console.error('[Mods] marketplace error:', error.message);
    res.status(500).json({ error: 'Failed to load marketplace' });
  }
});

// GET /api/mods/stats — aggregate mod stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [totalMods, modsWithCategories] = await Promise.all([
      prisma.modLog.count({ where: { isPublic: true } }),
      prisma.modLog.findMany({
        where: { isPublic: true },
        select: { rigId: true, category: true },
        distinct: ['rigId'],
      }),
    ]);

    const uniqueRigIds = new Set(modsWithCategories.map((m: any) => m.rigId));
    const uniqueCategories = new Set(modsWithCategories.map((m: any) => m.category).filter(Boolean));

    res.json({
      totalMods,
      totalRigs: uniqueRigIds.size,
      totalCategories: uniqueCategories.size,
    });
  } catch (error: any) {
    console.error('[Mods] stats error:', error.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// POST /api/mods/affiliate-click — log affiliate click
router.post('/affiliate-click', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || null;
    const { modLogId, rigId, productUrl } = req.body;

    if (!modLogId || !productUrl) {
      return res.status(400).json({ error: 'modLogId and productUrl required' });
    }

    await prisma.modAffiliateClick.create({
      data: {
        userId,
        modLogId,
        rigId: rigId || '',
        productUrl,
      },
    });

    res.json({ logged: true });
  } catch (error: any) {
    console.error('[Mods] affiliate click error:', error.message);
    res.status(500).json({ error: 'Failed to log click' });
  }
});

export default router;
