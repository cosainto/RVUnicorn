import { Request, Response, NextFunction } from 'express';

import { prisma } from '../lib/prisma';
const TIER_LEVELS: Record<string, number> = { TRAILHEAD: 0, FREE: 0, BASECAMP: 1, SUMMIT: 2, FOUNDING: 2 };

export function requireTier(minimumTier: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campgroundId = req.params.campgroundId || req.params.id || (req.body as any)?.campgroundId;
      if (!campgroundId) return next(); // No campground context — allow

      const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { tier: true } });
      const currentTier = campground?.tier || 'FREE';
      const currentLevel = TIER_LEVELS[currentTier] ?? 0;
      const requiredLevel = TIER_LEVELS[minimumTier] ?? 0;

      if (currentLevel >= requiredLevel) return next();

      res.status(403).json({
        error: 'TIER_REQUIRED',
        required: minimumTier,
        current: currentTier,
        upgradeUrl: `/business/${campgroundId}/upgrade`,
      });
    } catch { next(); }
  };
}
