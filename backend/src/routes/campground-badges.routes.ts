import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// Local alias — uses the real auth middleware that populates req.user
const requireAuth = authenticateToken;

// Helper: check if user is campground owner
const isCampgroundOwner = async (userId: string, campgroundId: string) => {
  const cg = await prisma.campground.findUnique({
    where: { id: campgroundId },
    select: { claimedById: true },
  });
  return cg?.claimedById === userId;
};

// Helper: get campground tier
const getCampgroundTier = async (campgroundId: string) => {
  const cg = await prisma.campground.findUnique({
    where: { id: campgroundId },
    select: { tier: true },
  });
  return cg?.tier || 'FREE';
};

// Helper: count existing badges for a campground
const getBadgeCount = async (campgroundId: string) => {
  return prisma.campgroundBadge.count({
    where: { campgroundId, status: { not: 'REJECTED' } },
  });
};

// Helper: tier badge limits
const TIER_LIMITS: Record<string, { maxBadges: number; canLimitedEdition: boolean; canCustomCriteria: boolean }> = {
  FREE: { maxBadges: 1, canLimitedEdition: false, canCustomCriteria: false },
  CLASS_C: { maxBadges: 1, canLimitedEdition: false, canCustomCriteria: false },
  CLASS_B: { maxBadges: 3, canLimitedEdition: false, canCustomCriteria: true },
  CLASS_A: { maxBadges: 3, canLimitedEdition: true, canCustomCriteria: true },
};

// ═══════════════════════════════════════════════════════════════
// OWNER ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// GET /api/campground-badges/:campgroundId - Get all badges for a campground
router.get('/:campgroundId', async (req: Request, res: Response) => {
  try {
    const badges = await prisma.campgroundBadge.findMany({
      where: { 
        campgroundId: req.params.campgroundId,
        OR: [
          { status: 'APPROVED' },
          // Show pending/rejected only to owner
          ...((req as any).userId ? [{ createdById: (req as any).userId }] : []),
        ],
      },
      include: {
        _count: { select: { awards: true } },
        campground: { select: { name: true, tier: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ badges });
  } catch (error: any) {
    console.error('Get campground badges error:', error);
    res.status(500).json({ error: 'Failed to get badges' });
  }
});

// GET /api/campground-badges/:campgroundId/my-awards - Get user's awards for this campground
router.get('/:campgroundId/my-awards', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.json({ awards: [] });
    }
    const awards = await prisma.campgroundBadgeAward.findMany({
      where: {
        userId,
        campgroundBadge: { campgroundId: req.params.campgroundId },
      },
      include: {
        campgroundBadge: true,
      },
    });
    res.json({ awards });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get awards' });
  }
});

// POST /api/campground-badges/:campgroundId - Create a badge (owner only)
router.post('/:campgroundId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId } = req.params;

    // Verify ownership
    if (!(await isCampgroundOwner(userId, campgroundId))) {
      return res.status(403).json({ error: 'Only campground owners can create badges' });
    }

    const tier = await getCampgroundTier(campgroundId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.FREE;
    const currentCount = await getBadgeCount(campgroundId);

    // Check badge limit
    if (currentCount >= limits.maxBadges) {
      return res.status(400).json({ 
        error: `Your ${tier} tier allows up to ${limits.maxBadges} badge(s). Upgrade to create more.` 
      });
    }

    const { name, description, imageUrl, iconEmoji, backgroundColor, borderColor, badgeType, triggerValue, isLimitedEdition, maxIssues, expiresAt } = req.body;

    // Validate limited edition
    if (isLimitedEdition) {
      if (!limits.canLimitedEdition) {
        return res.status(400).json({ error: 'Limited edition badges require Class A tier' });
      }
      if (!maxIssues || maxIssues < 100 || maxIssues > 5000) {
        return res.status(400).json({ error: 'Limited edition badges must have 100-5,000 max issues' });
      }
      if (!expiresAt) {
        return res.status(400).json({ error: 'Limited edition badges must have an expiration date' });
      }
    }

    // Validate custom criteria
    if (badgeType !== 'CHECK_IN' && !limits.canCustomCriteria) {
      return res.status(400).json({ error: 'Custom badge criteria requires Class B or higher tier' });
    }

    const badge = await prisma.campgroundBadge.create({
      data: {
        campgroundId,
        createdById: userId,
        name,
        description,
        imageUrl: imageUrl || null,
        iconEmoji: iconEmoji || '🏕️',
        backgroundColor: backgroundColor || '#10b981',
        borderColor: borderColor || '#059669',
        badgeType: badgeType || 'CHECK_IN',
        triggerValue: triggerValue || 1,
        isLimitedEdition: isLimitedEdition || false,
        maxIssues: isLimitedEdition ? maxIssues : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        requiredTier: tier as any,
        status: 'PENDING_REVIEW',
      },
    });

    // TODO: Send email notification to will@kindletribe.com
    // For now, log it
    console.log(`🏅 NEW BADGE PENDING REVIEW: "${name}" for campground ${campgroundId} by user ${userId}`);

    res.status(201).json({ badge, message: 'Badge created and submitted for review!' });
  } catch (error: any) {
    console.error('Create campground badge error:', error);
    res.status(500).json({ error: 'Failed to create badge' });
  }
});

// PATCH /api/campground-badges/:campgroundId/:badgeId - Update badge (owner, only if pending)
router.patch('/:campgroundId/:badgeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, badgeId } = req.params;

    if (!(await isCampgroundOwner(userId, campgroundId))) {
      return res.status(403).json({ error: 'Only campground owners can edit badges' });
    }

    const existing = await prisma.campgroundBadge.findUnique({ where: { id: badgeId } });
    if (!existing || existing.campgroundId !== campgroundId) {
      return res.status(404).json({ error: 'Badge not found' });
    }
    if (existing.status === 'APPROVED') {
      return res.status(400).json({ error: 'Cannot edit an approved badge. Contact support.' });
    }

    const { name, description, imageUrl, iconEmoji, backgroundColor, borderColor } = req.body;

    const badge = await prisma.campgroundBadge.update({
      where: { id: badgeId },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(iconEmoji && { iconEmoji }),
        ...(backgroundColor && { backgroundColor }),
        ...(borderColor && { borderColor }),
        status: 'PENDING_REVIEW', // Re-submit for review
      },
    });

    res.json({ badge });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update badge' });
  }
});

// DELETE /api/campground-badges/:campgroundId/:badgeId - Delete badge (owner)
router.delete('/:campgroundId/:badgeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, badgeId } = req.params;

    if (!(await isCampgroundOwner(userId, campgroundId))) {
      return res.status(403).json({ error: 'Only campground owners can delete badges' });
    }

    await prisma.campgroundBadge.delete({ where: { id: badgeId } });
    res.json({ message: 'Badge deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete badge' });
  }
});

// POST /api/campground-badges/:campgroundId/:badgeId/manual-award - Owner manually awards (CUSTOM type)
router.post('/:campgroundId/:badgeId/manual-award', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, badgeId } = req.params;
    const { targetUserIds } = req.body;

    if (!(await isCampgroundOwner(userId, campgroundId))) {
      return res.status(403).json({ error: 'Only campground owners can award badges' });
    }

    const badge = await prisma.campgroundBadge.findUnique({ where: { id: badgeId } });
    if (!badge || badge.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Badge must be approved before awarding' });
    }
    if (badge.badgeType !== 'CUSTOM') {
      return res.status(400).json({ error: 'Only CUSTOM type badges can be manually awarded' });
    }

    // Check limited edition limits
    if (badge.isLimitedEdition) {
      if (badge.expiresAt && new Date() > badge.expiresAt) {
        return res.status(400).json({ error: 'This limited edition badge has expired' });
      }
      const remaining = (badge.maxIssues || 0) - badge.issuedCount;
      if (remaining < targetUserIds.length) {
        return res.status(400).json({ error: `Only ${remaining} badges remaining` });
      }
    }

    const awards = [];
    for (const targetUserId of targetUserIds) {
      try {
        const award = await prisma.campgroundBadgeAward.create({
          data: { campgroundBadgeId: badgeId, userId: targetUserId },
        });
        awards.push(award);
      } catch (e: any) {
        // Skip duplicates
      }
    }

    // Update issued count
    if (badge.isLimitedEdition) {
      await prisma.campgroundBadge.update({
        where: { id: badgeId },
        data: { issuedCount: { increment: awards.length } },
      });
    }

    // Send Hitch message to each awarded user
    const cg = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true } });
    for (const award of awards) {
      const remaining = badge.isLimitedEdition && badge.maxIssues
        ? badge.maxIssues - badge.issuedCount
        : null;
      await sendCampgroundBadgeHitchMessage(award.userId, badge.name, badge.iconEmoji, cg?.name || 'the campground', badge.isLimitedEdition, remaining);
    }

    res.json({ awarded: awards.length, message: `Awarded badge to ${awards.length} user(s)` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to award badge' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (for will@kindletribe.com)
// ═══════════════════════════════════════════════════════════════

// GET /api/campground-badges/admin/pending - Get all pending badges
router.get('/admin/pending', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Check if admin (you can expand this check)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (user?.email !== 'will@rvunicorn.com' && user?.email !== 'will@kindletribe.com' && user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const pending = await prisma.campgroundBadge.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: {
        campground: { select: { id: true, name: true, state: true, tier: true, imageUrl: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true, username: true } },
        _count: { select: { awards: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ pending });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get pending badges' });
  }
});

// POST /api/campground-badges/admin/:badgeId/approve - Approve a badge
router.post('/admin/:badgeId/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (user?.email !== 'will@rvunicorn.com' && user?.email !== 'will@kindletribe.com' && user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const badge = await prisma.campgroundBadge.update({
      where: { id: req.params.badgeId },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: userId },
      include: { campground: { select: { name: true } }, createdBy: { select: { email: true } } },
    });

    // TODO: Send approval notification email to badge creator
    console.log(`✅ BADGE APPROVED: "${badge.name}" for ${badge.campground.name}`);

    res.json({ badge, message: 'Badge approved!' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve badge' });
  }
});

// POST /api/campground-badges/admin/:badgeId/reject - Reject a badge
router.post('/admin/:badgeId/reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (user?.email !== 'will@rvunicorn.com' && user?.email !== 'will@kindletribe.com' && user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { reason } = req.body;

    const badge = await prisma.campgroundBadge.update({
      where: { id: req.params.badgeId },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: userId, rejectionReason: reason || 'Does not meet guidelines' },
    });

    console.log(`❌ BADGE REJECTED: "${badge.name}" - Reason: ${reason}`);

    res.json({ badge, message: 'Badge rejected' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject badge' });
  }
});

// GET /api/campground-badges/admin/stats - Badge system stats
router.get('/admin/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (user?.email !== 'will@rvunicorn.com' && user?.email !== 'will@kindletribe.com' && user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [total, pending, approved, rejected, totalAwards, limitedEdition] = await Promise.all([
      prisma.campgroundBadge.count(),
      prisma.campgroundBadge.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.campgroundBadge.count({ where: { status: 'APPROVED' } }),
      prisma.campgroundBadge.count({ where: { status: 'REJECTED' } }),
      prisma.campgroundBadgeAward.count(),
      prisma.campgroundBadge.count({ where: { isLimitedEdition: true } }),
    ]);

    res.json({ total, pending, approved, rejected, totalAwards, limitedEdition });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTO-AWARD ON CHECK-IN
// ═══════════════════════════════════════════════════════════════


// Helper: send Hitch message when campground badge is awarded
async function sendCampgroundBadgeHitchMessage(userId: string, badgeName: string, badgeEmoji: string | null, campgroundName: string, isLimitedEdition: boolean, remaining: number | null) {
  try {
    const limitedMsg = isLimitedEdition && remaining !== null
      ? `\n\n&#x1F525; **This is a limited edition badge** — only ${remaining} more can ever be issued at ${campgroundName}. That makes yours extra special.`
      : '';

    const msg = [
      `&#x1F3C5; **You just earned the "${badgeName}" badge** ${badgeEmoji || ''} from **${campgroundName}**!`,
      '',
      'Campgrounds on RVUnicorn can create their own exclusive badges to reward their most loyal visitors. These are separate from your RVUnicorn achievement badges and show up on your profile as proof of your adventures at specific campgrounds.' + limitedMsg,
      '',
      'Campground badges can be earned by:',
      '- Checking in at a campground',
      '- Staying multiple nights',
      '- Coming back as a repeat visitor',
      '- Attending a campground event',
      '- Being personally awarded by the campground owner',
      '',
      'Want to see all your badges — both from RVUnicorn and from campgrounds you have visited? [View Your Badge Collection](https://www.rvunicorn.com/badges) &#x1F3C6;',
    ].join('\n');

    let conversation = await prisma.hitchConversation.findFirst({
      where: { userId, title: 'Your Badges & Achievements' }
    });
    if (!conversation) {
      conversation = await prisma.hitchConversation.create({
        data: { userId, title: 'Your Badges & Achievements', summary: 'Hitch celebrates badge milestones.' }
      });
    }
    await prisma.hitchMessage.create({
      data: { conversationId: conversation.id, role: 'assistant', content: msg }
    });
  } catch (e: any) {
    console.error('Campground badge Hitch message error (non-fatal):', e);
  }
}

// POST /api/campground-badges/auto-award/:campgroundId/:userId - Check and auto-award badges
router.post('/auto-award/:campgroundId/:userId', async (req: Request, res: Response) => {
  try {
    const { campgroundId, userId } = req.params;

    // Get all approved badges for this campground
    const badges = await prisma.campgroundBadge.findMany({
      where: { campgroundId, status: 'APPROVED', isActive: true },
    });

    const awarded: string[] = [];

    for (const badge of badges) {
      // Skip expired limited editions
      if (badge.isLimitedEdition) {
        if (badge.expiresAt && new Date() > badge.expiresAt) continue;
        if (badge.maxIssues && badge.issuedCount >= badge.maxIssues) continue;
      }

      // Check if already awarded
      const existing = await prisma.campgroundBadgeAward.findUnique({
        where: { campgroundBadgeId_userId: { campgroundBadgeId: badge.id, userId } },
      });
      if (existing) continue;

      let shouldAward = false;

      switch (badge.badgeType) {
        case 'CHECK_IN':
          // Award on any check-in
          shouldAward = true;
          break;

        case 'REPEAT_VISITOR': {
          const checkInCount = await prisma.checkIn.count({
            where: { userId, campgroundId },
          });
          shouldAward = checkInCount >= badge.triggerValue;
          break;
        }

        case 'NIGHTS_STAYED': {
          const checkIns = await prisma.checkIn.findMany({
            where: { userId, campgroundId, checkOutDate: { not: null } },
            select: { checkInDate: true, checkOutDate: true },
          });
          const totalNights = checkIns.reduce((sum: any, ci: any) => {
            if (!ci.checkOutDate) return sum;
            const diff = Math.ceil((ci.checkOutDate.getTime() - ci.checkInDate.getTime()) / (1000 * 60 * 60 * 24));
            return sum + Math.max(diff, 1);
          }, 0);
          shouldAward = totalNights >= badge.triggerValue;
          break;
        }

        case 'EVENT_ATTENDED': {
          const attendedCount = await prisma.eventRSVP.count({
            where: {
              userId,
              status: 'GOING',
              event: { campgroundId },
            },
          });
          shouldAward = attendedCount >= badge.triggerValue;
          break;
        }

        case 'CUSTOM':
          // Only manually awarded
          break;
      }

      if (shouldAward) {
        try {
          await prisma.campgroundBadgeAward.create({
            data: { campgroundBadgeId: badge.id, userId },
          });

          if (badge.isLimitedEdition) {
            await prisma.campgroundBadge.update({
              where: { id: badge.id },
              data: { issuedCount: { increment: 1 } },
            });
          }

          awarded.push(badge.name);
          console.log(`🏅 Badge awarded: "${badge.name}" to user ${userId}`);

          // Get campground name for Hitch message
          const cg = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true } });
          const remaining = badge.isLimitedEdition && badge.maxIssues
            ? badge.maxIssues - (badge.issuedCount + 1)
            : null;
          await sendCampgroundBadgeHitchMessage(userId, badge.name, badge.iconEmoji, cg?.name || 'the campground', badge.isLimitedEdition, remaining);
        } catch (e: any) {
          // Duplicate - skip
        }
      }
    }

    res.json({ awarded, count: awarded.length });
  } catch (error: any) {
    console.error('Auto-award error:', error);
    res.status(500).json({ error: 'Failed to auto-award' });
  }
});

// GET /api/campground-badges/user/:userId - Get all campground badges a user has earned
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const awards = await prisma.campgroundBadgeAward.findMany({
      where: { userId: req.params.userId },
      include: {
        campgroundBadge: {
          include: {
            campground: { select: { id: true, name: true, state: true, imageUrl: true } },
          },
        },
      },
      orderBy: { awardedAt: 'desc' },
    });

    res.json({ awards });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get user awards' });
  }
});

// GET /api/campground-badges/:campgroundId/tier-info - Get tier limits for owner
router.get('/:campgroundId/tier-info', requireAuth, async (req: Request, res: Response) => {
  try {
    const tier = await getCampgroundTier(req.params.campgroundId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.FREE;
    const currentCount = await getBadgeCount(req.params.campgroundId);

    res.json({
      tier,
      ...limits,
      currentBadgeCount: currentCount,
      remainingBadges: limits.maxBadges - currentCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get tier info' });
  }
});

export default router;
