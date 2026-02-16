#!/usr/bin/env python3
"""
RVUnicorn Campground Custom Badge System
==========================================
Run from: ~/Downloads/kindletribe-mvp/

Creates:
  1. Schema: CampgroundBadge + CampgroundBadgeAward models
  2. Backend: campground-badges.routes.ts (CRUD, approval, auto-award)
  3. Frontend: CampgroundBadgeCreator.tsx (owner dashboard)
  4. Frontend: CampgroundBadgeDisplay.tsx (public display on campground page)
  5. Frontend: AdminBadgeApproval.tsx (admin panel for will@kindletribe.com)
  6. Auto-award hook on check-in
"""

import os, sys, shutil
from datetime import datetime

PROJECT = os.getcwd()
SCHEMA = os.path.join(PROJECT, "frontend", "..", "backend", "prisma", "schema.prisma")
SCHEMA = os.path.join(PROJECT, "backend", "prisma", "schema.prisma")
ROUTES_DIR = os.path.join(PROJECT, "backend", "src", "routes")
COMPONENTS_DIR = os.path.join(PROJECT, "frontend", "src", "components")
PAGES_DIR = os.path.join(PROJECT, "frontend", "src", "pages")
BACKUP = os.path.join(PROJECT, "backups", f"cg-badges-{datetime.now().strftime('%Y%m%d-%H%M%S')}")

class C:
    G = '\033[92m'; Y = '\033[93m'; R = '\033[91m'; B = '\033[94m'; BOLD = '\033[1m'; E = '\033[0m'

def log(msg, c=C.G): print(f"{c}{C.BOLD}▸{C.E} {msg}")
def header(msg): print(f"\n{C.B}{C.BOLD}{'═'*60}\n  {msg}\n{'═'*60}{C.E}\n")

def main():
    header("🏅 Campground Custom Badge System")

    os.makedirs(BACKUP, exist_ok=True)
    shutil.copy2(SCHEMA, os.path.join(BACKUP, "schema.prisma"))
    log("Backed up schema")

    # ═══════════════════════════════════════════════════════════════
    # 1. SCHEMA
    # ═══════════════════════════════════════════════════════════════
    header("1️⃣  Adding Schema Models")

    schema_addition = '''

// ═══════════════════════════════════════════════════════════════
// Campground Custom Badges
// ═══════════════════════════════════════════════════════════════

model CampgroundBadge {
  id               String                  @id @default(cuid())
  campgroundId     String
  createdById      String
  name             String
  description      String
  imageUrl         String?
  iconEmoji        String?
  backgroundColor  String                  @default("#10b981")
  borderColor      String                  @default("#059669")
  
  // Badge type & criteria
  badgeType        CampgroundBadgeType      @default(CHECK_IN)
  triggerValue     Int                      @default(1)          // e.g. 1 check-in, 3 nights, 5 visits
  
  // Limited edition (Class A only)
  isLimitedEdition Boolean                  @default(false)
  maxIssues        Int?                                          // 100-5000
  issuedCount      Int                      @default(0)
  expiresAt        DateTime?
  
  // Approval workflow
  status           CampgroundBadgeStatus    @default(PENDING_REVIEW)
  reviewedAt       DateTime?
  reviewedBy       String?
  rejectionReason  String?
  
  // Tier requirement
  requiredTier     CampgroundTier           @default(FREE)
  
  isActive         Boolean                  @default(true)
  sortOrder        Int                      @default(0)
  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt

  campground       Campground               @relation("CampgroundCustomBadges", fields: [campgroundId], references: [id], onDelete: Cascade)
  createdBy        User                     @relation("CreatedCampgroundBadges", fields: [createdById], references: [id])
  awards           CampgroundBadgeAward[]

  @@index([campgroundId])
  @@index([status])
  @@index([createdById])
}

model CampgroundBadgeAward {
  id                String           @id @default(cuid())
  campgroundBadgeId String
  userId            String
  awardedAt         DateTime         @default(now())
  isNotified        Boolean          @default(false)
  
  campgroundBadge   CampgroundBadge  @relation(fields: [campgroundBadgeId], references: [id], onDelete: Cascade)
  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([campgroundBadgeId, userId])
  @@index([userId])
  @@index([campgroundBadgeId])
}

enum CampgroundBadgeType {
  CHECK_IN           // Auto-award on check-in
  NIGHTS_STAYED      // Stayed X+ nights total at this campground
  REPEAT_VISITOR     // Checked in X+ separate times
  EVENT_ATTENDED     // Attended an event at this campground
  CUSTOM             // Owner manually awards
}

enum CampgroundBadgeStatus {
  PENDING_REVIEW
  APPROVED
  REJECTED
}
'''

    with open(SCHEMA, 'r') as f:
        schema = f.read()

    # Add relation fields to Campground model
    if 'CampgroundCustomBadges' not in schema:
        schema = schema.replace(
            '  claimedBy              User?                    @relation("ClaimedCampgrounds", fields: [claimedById], references: [id])',
            '  claimedBy              User?                    @relation("ClaimedCampgrounds", fields: [claimedById], references: [id])\n  customBadges           CampgroundBadge[]        @relation("CampgroundCustomBadges")'
        )
        log("Added customBadges relation to Campground")

    # Add relation fields to User model - find a good spot
    if 'CreatedCampgroundBadges' not in schema:
        # Add after ClaimedCampgrounds relation or another user relation
        if 'ClaimedCampgrounds' in schema:
            schema = schema.replace(
                '@relation("ClaimedCampgrounds")',
                '@relation("ClaimedCampgrounds")\n  createdCampgroundBadges CampgroundBadge[]       @relation("CreatedCampgroundBadges")\n  campgroundBadgeAwards  CampgroundBadgeAward[]'
            )
        log("Added badge relations to User model")

    # Add the models at the end
    if 'CampgroundBadge' not in schema or 'model CampgroundBadge' not in schema:
        schema += schema_addition
        log("Added CampgroundBadge + CampgroundBadgeAward models")

    with open(SCHEMA, 'w') as f:
        f.write(schema)
    log("✓ Schema updated")

    # ═══════════════════════════════════════════════════════════════
    # 2. BACKEND ROUTES
    # ═══════════════════════════════════════════════════════════════
    header("2️⃣  Creating Backend Routes")

    routes_code = '''import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Middleware to verify authenticated user
const requireAuth = (req: Request, res: Response, next: any) => {
  if (!(req as any).user?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

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
          ...(((req as any).user?.userId) ? [{ createdById: (req as any).user.userId }] : []),
        ],
      },
      include: {
        _count: { select: { awards: true } },
        campground: { select: { name: true, tier: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ badges });
  } catch (error) {
    console.error('Get campground badges error:', error);
    res.status(500).json({ error: 'Failed to get badges' });
  }
});

// GET /api/campground-badges/:campgroundId/my-awards - Get user's awards for this campground
router.get('/:campgroundId/my-awards', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to get awards' });
  }
});

// POST /api/campground-badges/:campgroundId - Create a badge (owner only)
router.post('/:campgroundId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
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
  } catch (error) {
    console.error('Create campground badge error:', error);
    res.status(500).json({ error: 'Failed to create badge' });
  }
});

// PATCH /api/campground-badges/:campgroundId/:badgeId - Update badge (owner, only if pending)
router.patch('/:campgroundId/:badgeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to update badge' });
  }
});

// DELETE /api/campground-badges/:campgroundId/:badgeId - Delete badge (owner)
router.delete('/:campgroundId/:badgeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { campgroundId, badgeId } = req.params;

    if (!(await isCampgroundOwner(userId, campgroundId))) {
      return res.status(403).json({ error: 'Only campground owners can delete badges' });
    }

    await prisma.campgroundBadge.delete({ where: { id: badgeId } });
    res.json({ message: 'Badge deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete badge' });
  }
});

// POST /api/campground-badges/:campgroundId/:badgeId/manual-award - Owner manually awards (CUSTOM type)
router.post('/:campgroundId/:badgeId/manual-award', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
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
      } catch (e) {
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

    res.json({ awarded: awards.length, message: `Awarded badge to ${awards.length} user(s)` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to award badge' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (for will@kindletribe.com)
// ═══════════════════════════════════════════════════════════════

// GET /api/campground-badges/admin/pending - Get all pending badges
router.get('/admin/pending', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    // Check if admin (you can expand this check)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (user?.email !== 'will@kindletribe.com' && user?.role !== 'ADMIN') {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to get pending badges' });
  }
});

// POST /api/campground-badges/admin/:badgeId/approve - Approve a badge
router.post('/admin/:badgeId/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (user?.email !== 'will@kindletribe.com' && user?.role !== 'ADMIN') {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve badge' });
  }
});

// POST /api/campground-badges/admin/:badgeId/reject - Reject a badge
router.post('/admin/:badgeId/reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (user?.email !== 'will@kindletribe.com' && user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { reason } = req.body;

    const badge = await prisma.campgroundBadge.update({
      where: { id: req.params.badgeId },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: userId, rejectionReason: reason || 'Does not meet guidelines' },
    });

    console.log(`❌ BADGE REJECTED: "${badge.name}" - Reason: ${reason}`);

    res.json({ badge, message: 'Badge rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject badge' });
  }
});

// GET /api/campground-badges/admin/stats - Badge system stats
router.get('/admin/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (user?.email !== 'will@kindletribe.com' && user?.role !== 'ADMIN') {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTO-AWARD ON CHECK-IN
// ═══════════════════════════════════════════════════════════════

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
          const totalNights = checkIns.reduce((sum, ci) => {
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
        } catch (e) {
          // Duplicate - skip
        }
      }
    }

    res.json({ awarded, count: awarded.length });
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tier info' });
  }
});

export default router;
'''

    routes_path = os.path.join(ROUTES_DIR, "campground-badges.routes.ts")
    with open(routes_path, 'w') as f:
        f.write(routes_code)
    log("✓ Created campground-badges.routes.ts")

    # ═══════════════════════════════════════════════════════════════
    # 3. REGISTER ROUTES IN INDEX
    # ═══════════════════════════════════════════════════════════════
    header("3️⃣  Registering Routes")

    index_path = os.path.join(PROJECT, "backend", "src", "index.ts")
    with open(index_path, 'r') as f:
        index_content = f.read()

    if 'campground-badges' not in index_content:
        # Add import
        import_line = "import campgroundBadgesRoutes from './routes/campground-badges.routes';"
        if import_line not in index_content:
            # Find last import
            last_import = index_content.rfind("import ")
            end_of_line = index_content.index('\n', last_import)
            index_content = index_content[:end_of_line+1] + import_line + '\n' + index_content[end_of_line+1:]

        # Add route registration
        route_line = "app.use('/api/campground-badges', campgroundBadgesRoutes);"
        if route_line not in index_content:
            # Find a good place - after other app.use routes
            insert_point = index_content.rfind("app.use('/api/")
            end_of_line = index_content.index('\n', insert_point)
            index_content = index_content[:end_of_line+1] + route_line + '\n' + index_content[end_of_line+1:]

        with open(index_path, 'w') as f:
            f.write(index_content)
        log("✓ Registered routes in index.ts")
    else:
        log("Routes already registered")

    # ═══════════════════════════════════════════════════════════════
    # 4. HOOK INTO CHECK-IN ROUTE
    # ═══════════════════════════════════════════════════════════════
    header("4️⃣  Hooking into Check-In Flow")

    # Find the check-in route file
    checkin_files = []
    for fname in os.listdir(ROUTES_DIR):
        fpath = os.path.join(ROUTES_DIR, fname)
        if os.path.isfile(fpath):
            with open(fpath, 'r') as f:
                content = f.read()
            if 'checkIn' in content and 'create' in content and 'campgroundId' in content:
                checkin_files.append((fname, content))

    for fname, content in checkin_files:
        if 'auto-award' not in content and 'campground-badges' not in content:
            # Find check-in create success and add auto-award call
            if 'isActive: true' in content and 'checkInDate' in content:
                # Add a fetch call after check-in creation
                hook = '''
    // Auto-award campground badges on check-in
    try {
      const fetch = (await import('node-fetch')).default;
      fetch(`http://localhost:${process.env.PORT || 3001}/api/campground-badges/auto-award/${checkIn.campgroundId}/${checkIn.userId}`, { method: 'POST' }).catch(() => {});
    } catch (e) { /* badge auto-award is non-critical */ }
'''
                # Find after res.json or res.status(201) in check-in create
                if "res.status(201).json" in content or "res.json({ checkIn" in content or "res.json(checkIn" in content:
                    # Insert before the res.json line
                    for pattern in ["res.status(201).json", "res.json({ checkIn", "res.json(checkIn"]:
                        if pattern in content:
                            idx = content.index(pattern)
                            content = content[:idx] + hook + '\n    ' + content[idx:]
                            break

                    fpath = os.path.join(ROUTES_DIR, fname)
                    shutil.copy2(fpath, os.path.join(BACKUP, fname))
                    with open(fpath, 'w') as f:
                        f.write(content)
                    log(f"✓ Hooked auto-award into {fname}")
                    break
    else:
        log("⚠ Could not auto-hook check-in. Manual integration needed.", C.Y)
        log("  Add after check-in creation: fetch(`/api/campground-badges/auto-award/${campgroundId}/${userId}`, {method:'POST'})")

    # ═══════════════════════════════════════════════════════════════
    # 5. FRONTEND - Badge Creator (Owner Dashboard)
    # ═══════════════════════════════════════════════════════════════
    header("5️⃣  Creating Frontend Components")

    creator_component = '''import { useState, useEffect } from 'react';
import { Award, Plus, Trash2, Edit, Clock, CheckCircle, XCircle, Star, Lock, Sparkles, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface CampgroundBadge {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  iconEmoji: string;
  backgroundColor: string;
  borderColor: string;
  badgeType: string;
  triggerValue: number;
  isLimitedEdition: boolean;
  maxIssues?: number;
  issuedCount: number;
  expiresAt?: string;
  status: string;
  rejectionReason?: string;
  _count: { awards: number };
}

interface TierInfo {
  tier: string;
  maxBadges: number;
  canLimitedEdition: boolean;
  canCustomCriteria: boolean;
  currentBadgeCount: number;
  remainingBadges: number;
}

const BADGE_TYPES = [
  { value: 'CHECK_IN', label: 'Check-In', desc: 'Auto-awarded when a camper checks in', icon: '📍' },
  { value: 'REPEAT_VISITOR', label: 'Repeat Visitor', desc: 'Awarded after X check-ins', icon: '🔁' },
  { value: 'NIGHTS_STAYED', label: 'Nights Stayed', desc: 'Awarded after X nights total', icon: '🌙' },
  { value: 'EVENT_ATTENDED', label: 'Event Attended', desc: 'Awarded for attending events', icon: '🎪' },
  { value: 'CUSTOM', label: 'Manual Award', desc: 'You award this to specific campers', icon: '🎁' },
];

const EMOJI_OPTIONS = ['🏕️', '⛺', '🔥', '🌲', '🏔️', '🌅', '🐻', '🦌', '🎣', '🚐', '⭐', '💎', '🏆', '🎯', '🌟', '🦅', '🐺', '🌊', '🌙', '🍃'];
const COLOR_OPTIONS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function CampgroundBadgeCreator({ campgroundId }: { campgroundId: string }) {
  const [badges, setBadges] = useState<CampgroundBadge[]>([]);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconEmoji, setIconEmoji] = useState('🏕️');
  const [backgroundColor, setBackgroundColor] = useState('#10b981');
  const [badgeType, setBadgeType] = useState('CHECK_IN');
  const [triggerValue, setTriggerValue] = useState(1);
  const [isLimitedEdition, setIsLimitedEdition] = useState(false);
  const [maxIssues, setMaxIssues] = useState(500);
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, [campgroundId]);

  const loadData = async () => {
    try {
      const [badgeRes, tierRes] = await Promise.all([
        api.get(`/campground-badges/${campgroundId}`),
        api.get(`/campground-badges/${campgroundId}/tier-info`),
      ]);
      setBadges(badgeRes.data.badges || []);
      setTierInfo(tierRes.data);
    } catch (e) {
      console.error('Load badges error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/campground-badges/${campgroundId}`, {
        name, description, iconEmoji, backgroundColor, borderColor: backgroundColor,
        badgeType, triggerValue,
        isLimitedEdition, maxIssues: isLimitedEdition ? maxIssues : null,
        expiresAt: isLimitedEdition ? expiresAt : null,
      });
      setShowCreator(false);
      setName(''); setDescription('');
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to create badge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (badgeId: string) => {
    if (!confirm('Delete this badge? This cannot be undone.')) return;
    try {
      await api.delete(`/campground-badges/${campgroundId}/${badgeId}`);
      loadData();
    } catch (e) { alert('Failed to delete badge'); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" />Live</span>;
      case 'PENDING_REVIEW': return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pending Review</span>;
      case 'REJECTED': return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Rejected</span>;
      default: return null;
    }
  };

  if (loading) return <div className="animate-pulse bg-gray-100 rounded-lg h-32" />;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Custom Badges
            </h3>
            {tierInfo && (
              <p className="text-sm text-gray-500 mt-1">
                {tierInfo.currentBadgeCount}/{tierInfo.maxBadges} badges created
                {tierInfo.remainingBadges > 0 && <span className="text-green-600 ml-1">({tierInfo.remainingBadges} remaining)</span>}
              </p>
            )}
          </div>
          {tierInfo && tierInfo.remainingBadges > 0 && (
            <button
              onClick={() => setShowCreator(!showCreator)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-amber-400 hover:to-orange-500 transition"
            >
              <Plus className="w-4 h-4" />
              Create Badge
            </button>
          )}
        </div>
      </div>

      {/* Badge Creator Form */}
      {showCreator && (
        <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-b border-amber-100">
          <h4 className="font-semibold text-gray-900 mb-4">Design Your Badge</h4>

          {/* Preview */}
          <div className="flex justify-center mb-6">
            <div className="text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl border-4 shadow-lg mx-auto"
                style={{ backgroundColor, borderColor: backgroundColor, boxShadow: `0 0 20px ${backgroundColor}40` }}
              >
                {iconEmoji}
              </div>
              <p className="mt-2 font-bold text-gray-900 text-sm">{name || 'Badge Name'}</p>
              <p className="text-xs text-gray-500">{description || 'Description'}</p>
              {isLimitedEdition && <p className="text-xs text-amber-600 font-medium mt-1">⭐ Limited Edition</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Badge Name</label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="e.g. Explorer Badge"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={120} rows={2} placeholder="What does this badge represent?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>

            {/* Emoji Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => setIconEmoji(e)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition ${iconEmoji === e ? 'bg-amber-200 ring-2 ring-amber-400' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} onClick={() => setBackgroundColor(c)}
                    className={`w-8 h-8 rounded-full transition ${backgroundColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            {/* Badge Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Award Criteria</label>
              <div className="space-y-2">
                {BADGE_TYPES.map(bt => {
                  const disabled = bt.value !== 'CHECK_IN' && !tierInfo?.canCustomCriteria;
                  return (
                    <button key={bt.value} onClick={() => !disabled && setBadgeType(bt.value)} disabled={disabled}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                        badgeType === bt.value ? 'border-amber-400 bg-amber-50' : disabled ? 'border-gray-100 bg-gray-50 opacity-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className="text-xl">{bt.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{bt.label}</p>
                        <p className="text-xs text-gray-500">{bt.desc}</p>
                      </div>
                      {disabled && <Lock className="w-4 h-4 text-gray-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trigger Value (for non-CHECK_IN types) */}
            {badgeType !== 'CHECK_IN' && badgeType !== 'CUSTOM' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {badgeType === 'REPEAT_VISITOR' ? 'Number of visits required' :
                   badgeType === 'NIGHTS_STAYED' ? 'Number of nights required' :
                   'Number of events required'}
                </label>
                <input type="number" min={1} max={100} value={triggerValue} onChange={e => setTriggerValue(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            )}

            {/* Limited Edition */}
            {tierInfo?.canLimitedEdition && (
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={isLimitedEdition} onChange={e => setIsLimitedEdition(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-1"><Sparkles className="w-4 h-4 text-amber-500" /> Limited Edition</p>
                    <p className="text-xs text-gray-500">Only a set number of campers can earn this badge</p>
                  </div>
                </label>

                {isLimitedEdition && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Max Issues (100-5,000)</label>
                      <input type="number" min={100} max={5000} step={50} value={maxIssues} onChange={e => setMaxIssues(parseInt(e.target.value) || 100)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Expires</label>
                      <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmit} disabled={submitting || !name.trim() || !description.trim()}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white py-2.5 rounded-lg font-medium hover:from-amber-400 hover:to-orange-500 transition disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
              <button onClick={() => setShowCreator(false)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Badges are reviewed before going live. You'll be notified when approved.
            </p>
          </div>
        </div>
      )}

      {/* Existing Badges */}
      {badges.length > 0 ? (
        <div className="p-6 space-y-4">
          {badges.map(badge => (
            <div key={badge.id} className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl border-3 flex-shrink-0"
                style={{ backgroundColor: badge.backgroundColor, borderColor: badge.borderColor }}>
                {badge.iconEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{badge.name}</p>
                  {getStatusBadge(badge.status)}
                  {badge.isLimitedEdition && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">⭐ Limited</span>}
                </div>
                <p className="text-sm text-gray-500 truncate">{badge.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{badge._count.awards} awarded</span>
                  {badge.isLimitedEdition && badge.maxIssues && (
                    <span>{badge.maxIssues - badge.issuedCount} remaining</span>
                  )}
                  {badge.isLimitedEdition && badge.expiresAt && (
                    <span>Expires {new Date(badge.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
                {badge.status === 'REJECTED' && badge.rejectionReason && (
                  <p className="text-xs text-red-500 mt-1">Reason: {badge.rejectionReason}</p>
                )}
              </div>
              <button onClick={() => handleDelete(badge.id)} className="text-gray-300 hover:text-red-500 transition p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">No custom badges yet</p>
          <p className="text-sm text-gray-400">Create a badge to reward campers who visit your campground!</p>
        </div>
      )}
    </div>
  );
}
'''

    with open(os.path.join(COMPONENTS_DIR, "CampgroundBadgeCreator.tsx"), 'w') as f:
        f.write(creator_component)
    log("✓ Created CampgroundBadgeCreator.tsx")

    # ═══════════════════════════════════════════════════════════════
    # 6. FRONTEND - Badge Display (Public, on campground page)
    # ═══════════════════════════════════════════════════════════════

    display_component = '''import { useState, useEffect } from 'react';
import { Award, Sparkles, Lock } from 'lucide-react';
import api from '../services/api';

interface BadgeAward {
  id: string;
  awardedAt: string;
  campgroundBadge: {
    id: string;
    name: string;
    description: string;
    iconEmoji: string;
    backgroundColor: string;
    isLimitedEdition: boolean;
    maxIssues?: number;
    issuedCount: number;
    expiresAt?: string;
  };
}

export default function CampgroundBadgeDisplay({ campgroundId, userId }: { campgroundId: string; userId?: string }) {
  const [badges, setBadges] = useState<any[]>([]);
  const [myAwards, setMyAwards] = useState<BadgeAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [badgeRes, awardRes] = await Promise.all([
          api.get(`/campground-badges/${campgroundId}`),
          userId ? api.get(`/campground-badges/${campgroundId}/my-awards`).catch(() => ({ data: { awards: [] } })) : Promise.resolve({ data: { awards: [] } }),
        ]);
        setBadges((badgeRes.data.badges || []).filter((b: any) => b.status === 'APPROVED'));
        setMyAwards(awardRes.data.awards || []);
      } catch (e) {
        console.error('Load badges error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [campgroundId, userId]);

  if (loading || badges.length === 0) return null;

  const hasEarned = (badgeId: string) => myAwards.some(a => a.campgroundBadge.id === badgeId);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
        <Award className="w-5 h-5 text-amber-500" />
        Campground Badges
        <span className="text-xs text-gray-400 font-normal">({badges.length})</span>
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {badges.map(badge => {
          const earned = hasEarned(badge.id);
          const soldOut = badge.isLimitedEdition && badge.maxIssues && badge.issuedCount >= badge.maxIssues;
          const expired = badge.isLimitedEdition && badge.expiresAt && new Date() > new Date(badge.expiresAt);

          return (
            <div key={badge.id} className={`text-center p-4 rounded-xl border transition ${
              earned ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50' : 'border-gray-100 bg-gray-50'
            }`}>
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto border-4 shadow-md transition ${
                  earned ? '' : 'grayscale opacity-50'
                }`}
                style={earned ? { backgroundColor: badge.backgroundColor, borderColor: badge.backgroundColor, boxShadow: `0 0 15px ${badge.backgroundColor}30` } : { backgroundColor: '#e5e7eb', borderColor: '#d1d5db' }}
              >
                {earned ? badge.iconEmoji : <Lock className="w-6 h-6 text-gray-400" />}
              </div>
              <p className={`mt-2 text-sm font-semibold ${earned ? 'text-gray-900' : 'text-gray-400'}`}>{badge.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{badge.description}</p>
              {badge.isLimitedEdition && (
                <div className="mt-2">
                  {soldOut ? (
                    <span className="text-[10px] text-red-500 font-medium">Sold Out</span>
                  ) : expired ? (
                    <span className="text-[10px] text-gray-400 font-medium">Expired</span>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-medium flex items-center justify-center gap-0.5">
                      <Sparkles className="w-3 h-3" />
                      {(badge.maxIssues || 0) - badge.issuedCount} of {badge.maxIssues} left
                    </span>
                  )}
                </div>
              )}
              {earned && (
                <p className="text-[10px] text-green-600 font-medium mt-1">✓ Earned</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
'''

    with open(os.path.join(COMPONENTS_DIR, "CampgroundBadgeDisplay.tsx"), 'w') as f:
        f.write(display_component)
    log("✓ Created CampgroundBadgeDisplay.tsx")

    # ═══════════════════════════════════════════════════════════════
    # 7. FRONTEND - Admin Approval Panel
    # ═══════════════════════════════════════════════════════════════

    admin_component = '''import { useState, useEffect } from 'react';
import { Award, CheckCircle, XCircle, Clock, AlertTriangle, ExternalLink, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface PendingBadge {
  id: string;
  name: string;
  description: string;
  iconEmoji: string;
  backgroundColor: string;
  badgeType: string;
  triggerValue: number;
  isLimitedEdition: boolean;
  maxIssues?: number;
  expiresAt?: string;
  createdAt: string;
  campground: { id: string; name: string; state: string; tier: string; imageUrl?: string };
  createdBy: { id: string; firstName: string; lastName: string; email: string; username: string };
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalAwards: number;
  limitedEdition: number;
}

export default function AdminBadgeApproval() {
  const [pending, setPending] = useState<PendingBadge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [pendingRes, statsRes] = await Promise.all([
        api.get('/campground-badges/admin/pending'),
        api.get('/campground-badges/admin/stats'),
      ]);
      setPending(pendingRes.data.pending || []);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Load admin data error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (badgeId: string) => {
    try {
      await api.post(`/campground-badges/admin/${badgeId}/approve`);
      loadData();
    } catch (e) { alert('Failed to approve'); }
  };

  const handleReject = async (badgeId: string) => {
    try {
      await api.post(`/campground-badges/admin/${badgeId}/reject`, { reason: rejectReason });
      setRejectingId(null);
      setRejectReason('');
      loadData();
    } catch (e) { alert('Failed to reject'); }
  };

  const getBadgeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CHECK_IN: '📍 Check-In', REPEAT_VISITOR: '🔁 Repeat Visitor',
      NIGHTS_STAYED: '🌙 Nights Stayed', EVENT_ATTENDED: '🎪 Event',
      CUSTOM: '🎁 Manual',
    };
    return labels[type] || type;
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-6">
        <Award className="w-7 h-7 text-amber-500" />
        Badge Approval Dashboard
      </h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'bg-gray-100 text-gray-700' },
            { label: 'Pending', value: stats.pending, color: 'bg-amber-100 text-amber-700' },
            { label: 'Approved', value: stats.approved, color: 'bg-green-100 text-green-700' },
            { label: 'Rejected', value: stats.rejected, color: 'bg-red-100 text-red-700' },
            { label: 'Awards Given', value: stats.totalAwards, color: 'bg-blue-100 text-blue-700' },
            { label: 'Limited Ed.', value: stats.limitedEdition, color: 'bg-purple-100 text-purple-700' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pending Queue */}
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-amber-500" />
        Pending Review ({pending.length})
      </h2>

      {pending.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-green-700 font-medium">All caught up! No badges pending review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(badge => (
            <div key={badge.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Badge Preview */}
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl border-4 flex-shrink-0 shadow-lg"
                    style={{ backgroundColor: badge.backgroundColor, borderColor: badge.backgroundColor }}>
                    {badge.iconEmoji}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{badge.name}</h3>
                      {badge.isLimitedEdition && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">⭐ Limited ({badge.maxIssues})</span>}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{badge.description}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{getBadgeTypeLabel(badge.badgeType)}</span>
                      {badge.triggerValue > 1 && <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Requires: {badge.triggerValue}</span>}
                      <span className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">Tier: {badge.campground.tier}</span>
                    </div>

                    {/* Campground & Creator Info */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <Link to={`/campgrounds/${badge.campground.id}`} className="hover:text-blue-600 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> {badge.campground.name}, {badge.campground.state}
                      </Link>
                      <span>•</span>
                      <Link to={`/profile/${badge.createdBy.username}`} className="hover:text-blue-600">
                        by {badge.createdBy.firstName} {badge.createdBy.lastName}
                      </Link>
                      <span>•</span>
                      <span>{new Date(badge.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-gray-50 px-5 py-3 flex items-center gap-3">
                <button onClick={() => handleApprove(badge.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                {rejectingId === badge.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" autoFocus />
                    <button onClick={() => handleReject(badge.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Reject</button>
                    <button onClick={() => setRejectingId(null)} className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setRejectingId(badge.id)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'''

    with open(os.path.join(COMPONENTS_DIR, "AdminBadgeApproval.tsx"), 'w') as f:
        f.write(admin_component)
    log("✓ Created AdminBadgeApproval.tsx")

    # ═══════════════════════════════════════════════════════════════
    # DONE
    # ═══════════════════════════════════════════════════════════════
    header("✅ Campground Custom Badge System Complete!")

    print(f"""
{C.G}{C.BOLD}Created:{C.E}

  Schema:
    • CampgroundBadge model (type, tier gating, limited edition, approval)
    • CampgroundBadgeAward model (unique per user+badge)
    • CampgroundBadgeType enum (CHECK_IN, NIGHTS_STAYED, REPEAT_VISITOR, EVENT_ATTENDED, CUSTOM)
    • CampgroundBadgeStatus enum (PENDING_REVIEW, APPROVED, REJECTED)

  Backend ({os.path.relpath(ROUTES_DIR, PROJECT)}/campground-badges.routes.ts):
    • GET    /:campgroundId           - List badges
    • GET    /:campgroundId/my-awards - User's earned badges
    • GET    /:campgroundId/tier-info - Tier limits
    • POST   /:campgroundId           - Create badge (owner)
    • PATCH  /:campgroundId/:badgeId  - Update badge (owner, pending only)
    • DELETE /:campgroundId/:badgeId  - Delete badge (owner)
    • POST   /:campgroundId/:badgeId/manual-award - Manual award (CUSTOM type)
    • GET    /admin/pending           - Pending queue (admin)
    • POST   /admin/:badgeId/approve  - Approve (admin)
    • POST   /admin/:badgeId/reject   - Reject (admin)
    • GET    /admin/stats             - System stats (admin)
    • POST   /auto-award/:cg/:user   - Auto-award on check-in
    • GET    /user/:userId            - User's all campground badges

  Frontend:
    • CampgroundBadgeCreator.tsx  - Owner badge designer + manager
    • CampgroundBadgeDisplay.tsx  - Public badge showcase on campground page
    • AdminBadgeApproval.tsx      - Admin review dashboard

  Tier Limits:
    FREE/Class C:  1 badge,  check-in only
    Class B:       3 badges, custom criteria
    Class A:       3 badges, custom criteria + limited editions (100-5,000)

{C.Y}Next Steps:{C.E}
  1. cd backend && npx prisma db push
  2. Add to campground detail page:
     import CampgroundBadgeDisplay from '../components/CampgroundBadgeDisplay';
     <CampgroundBadgeDisplay campgroundId={{id}} userId={{userId}} />
  3. Add to owner dashboard:
     import CampgroundBadgeCreator from '../components/CampgroundBadgeCreator';
     <CampgroundBadgeCreator campgroundId={{id}} />
  4. Add admin route in App.tsx:
     import AdminBadgeApproval from '../components/AdminBadgeApproval';
     <Route path="/admin/badges" element={{<AdminBadgeApproval />}} />
  5. cd frontend && npm run dev
""")

if __name__ == "__main__":
    main()
