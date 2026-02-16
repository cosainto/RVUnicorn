import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════
// RV DATABASE LOOKUP
// ═══════════════════════════════════════════════════════════════

// GET /api/rv/types — all RV types
router.get('/types', async (_req, res) => {
  try {
    const types = await prisma.rVType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch RV types' });
  }
});

// GET /api/rv/makes — all makes, optionally filtered by type
router.get('/makes', async (req, res) => {
  try {
    const { type, q } = req.query;
    let makes = await prisma.rVMake.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { models: true } } },
    });

    if (type) {
      makes = makes.filter(m => m.types.includes(type as string));
    }
    if (q) {
      const query = (q as string).toLowerCase();
      makes = makes.filter(m => m.name.toLowerCase().includes(query));
    }

    res.json(makes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch RV makes' });
  }
});

// GET /api/rv/makes/:makeId/models — models for a make
router.get('/makes/:makeId/models', async (req, res) => {
  try {
    const { makeId } = req.params;
    const { type } = req.query;

    const where: any = { makeId };
    if (type) where.type = type as string;

    const models = await prisma.rVModel.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { make: { select: { name: true } } },
    });
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// GET /api/rv/search — search makes and models
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ makes: [], models: [] });

    const query = (q as string).toLowerCase();

    const [makes, models] = await Promise.all([
      prisma.rVMake.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        take: 10,
        orderBy: { name: 'asc' },
      }),
      prisma.rVModel.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { make: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        take: 20,
        include: { make: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({ makes, models });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search' });
  }
});

// GET /api/rv/models/:modelId — full model details
router.get('/models/:modelId', async (req, res) => {
  try {
    const model = await prisma.rVModel.findUnique({
      where: { id: req.params.modelId },
      include: { make: true },
    });
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json(model);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTOFILL — apply model specs to user profile
// ═══════════════════════════════════════════════════════════════

// POST /api/rv/autofill — apply a model's specs to the current user
router.post('/autofill', authenticateToken, async (req: any, res) => {
  try {
    const { modelId, skipFields = [] } = req.body;

    const model = await prisma.rVModel.findUnique({
      where: { id: modelId },
      include: { make: true },
    });
    if (!model) return res.status(404).json({ error: 'Model not found' });

    const updateData: any = {};
    if (!skipFields.includes('rvMake')) updateData.rvMake = model.make.name;
    if (!skipFields.includes('rvModel')) updateData.rvModel = model.name;
    if (!skipFields.includes('rvType')) updateData.rvType = model.type;
    if (!skipFields.includes('rvLength')) updateData.rvLength = model.lengthFt;
    if (!skipFields.includes('rvHeight')) updateData.rvHeight = model.heightFt;
    if (!skipFields.includes('rvWeight')) updateData.rvWeight = model.weightLbs;
    if (!skipFields.includes('rvSleeps')) updateData.rvSleeps = model.sleeps;
    if (!skipFields.includes('rvSlideouts')) updateData.rvSlideouts = model.slideouts;
    if (!skipFields.includes('rvMpg')) updateData.rvMpg = model.mpg;
    if (!skipFields.includes('rvTankGallons')) updateData.rvTankGallons = model.tankGallons;
    if (!skipFields.includes('rvFeatures') && model.features.length > 0) {
      updateData.rvFeatures = model.features;
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: {
        id: true, rvMake: true, rvModel: true, rvType: true, rvYear: true,
        rvLength: true, rvHeight: true, rvWeight: true, rvSleeps: true,
        rvSlideouts: true, rvMpg: true, rvTankGallons: true, rvFeatures: true,
      },
    });

    res.json({ user, appliedModel: model.name });
  } catch (error) {
    console.error('Autofill error:', error);
    res.status(500).json({ error: 'Failed to autofill' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CO-TRAVELER / SHARED VEHICLE LINKING
// ═══════════════════════════════════════════════════════════════

// POST /api/rv/link/search — search for a user to link with
router.post('/link/search', authenticateToken, async (req: any, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.json([]);

    const users = await prisma.user.findMany({
      where: {
        id: { not: req.userId },
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true, username: true, firstName: true, lastName: true,
        profilePicture: true, rvMake: true, rvModel: true, rvType: true,
      },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// POST /api/rv/link/request — request to share a vehicle
router.post('/link/request', authenticateToken, async (req: any, res) => {
  try {
    const { targetUserId, message } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
    if (targetUserId === req.userId) return res.status(400).json({ error: 'Cannot link with yourself' });

    // Check if link already exists
    const existing = await prisma.sharedVehicle.findFirst({
      where: {
        OR: [
          { ownerId: req.userId, partnerId: targetUserId },
          { ownerId: targetUserId, partnerId: req.userId },
        ],
      },
    });
    if (existing) return res.status(400).json({ error: 'Vehicle link already exists', link: existing });

    // Create shared vehicle link
    const link = await prisma.sharedVehicle.create({
      data: {
        ownerId: req.userId,
        partnerId: targetUserId,
        status: 'PENDING',
        message,
      },
      include: {
        owner: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true, rvMake: true, rvModel: true } },
        partner: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
    });

    // Auto-send friend request if not already friends
    const existingFriend = await prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: req.userId, receiverId: targetUserId },
          { initiatorId: targetUserId, receiverId: req.userId },
        ],
      },
    });

    if (!existingFriend) {
      await prisma.friendship.create({
        data: {
          initiatorId: req.userId,
          receiverId: targetUserId,
          status: 'PENDING',
        },
      }).catch(() => {}); // Ignore if already exists
    }

    // Notify the target user
    const sender = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true },
    });
    const senderName = sender?.firstName ? `${sender.firstName} ${sender.lastName || ''}`.trim() : sender?.username || 'Someone';

    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'VEHICLE_LINK_REQUEST',
        content: `wants to link their ${sender?.rvMake || ''} ${sender?.rvModel || ''} with your account`,
        link: '/settings/vehicle',
        category: 'FRIEND',
        actorId: req.userId,
        actorName: senderName,
        actorAvatar: sender?.profilePicture,
        metadata: { sharedVehicleId: link.id },
      },
    });

    res.status(201).json(link);
  } catch (error) {
    console.error('Link request error:', error);
    res.status(500).json({ error: 'Failed to create link request' });
  }
});

// PUT /api/rv/link/:linkId/respond — accept or decline
router.put('/link/:linkId/respond', authenticateToken, async (req: any, res) => {
  try {
    const { linkId } = req.params;
    const { action } = req.body; // 'accept' or 'decline'

    const link = await prisma.sharedVehicle.findUnique({ where: { id: linkId } });
    if (!link) return res.status(404).json({ error: 'Link not found' });
    if (link.partnerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    if (action === 'accept') {
      // Clone RV data from owner to partner
      const owner = await prisma.user.findUnique({
        where: { id: link.ownerId },
        select: {
          rvMake: true, rvModel: true, rvType: true, rvYear: true,
          rvLength: true, rvHeight: true, rvWeight: true, rvSleeps: true,
          rvSlideouts: true, rvMpg: true, rvTankGallons: true, rvFeatures: true,
          rvDescription: true,
        },
      });

      if (owner) {
        // Clone RV specs to partner (only fill empty fields)
        const partner = await prisma.user.findUnique({ where: { id: req.userId } });
        const cloneData: any = {};
        if (!partner?.rvMake && owner.rvMake) cloneData.rvMake = owner.rvMake;
        if (!partner?.rvModel && owner.rvModel) cloneData.rvModel = owner.rvModel;
        if (!partner?.rvType && owner.rvType) cloneData.rvType = owner.rvType;
        if (!partner?.rvYear && owner.rvYear) cloneData.rvYear = owner.rvYear;
        if (!partner?.rvLength && owner.rvLength) cloneData.rvLength = owner.rvLength;
        if (!partner?.rvHeight && owner.rvHeight) cloneData.rvHeight = owner.rvHeight;
        if (!partner?.rvWeight && owner.rvWeight) cloneData.rvWeight = owner.rvWeight;
        if (!partner?.rvSleeps && owner.rvSleeps) cloneData.rvSleeps = owner.rvSleeps;
        if (!partner?.rvSlideouts && owner.rvSlideouts) cloneData.rvSlideouts = owner.rvSlideouts;
        if (!partner?.rvMpg && owner.rvMpg) cloneData.rvMpg = owner.rvMpg;
        if (!partner?.rvTankGallons && owner.rvTankGallons) cloneData.rvTankGallons = owner.rvTankGallons;
        if ((!partner?.rvFeatures || partner.rvFeatures.length === 0) && owner.rvFeatures.length > 0) {
          cloneData.rvFeatures = owner.rvFeatures;
        }

        if (Object.keys(cloneData).length > 0) {
          await prisma.user.update({ where: { id: req.userId }, data: cloneData });
        }
      }

      // Accept the link
      const updated = await prisma.sharedVehicle.update({
        where: { id: linkId },
        data: { status: 'ACTIVE' },
      });

      // Also accept friend request if pending
      await prisma.friendship.updateMany({
        where: {
          OR: [
            { initiatorId: link.ownerId, receiverId: req.userId, status: 'PENDING' },
            { initiatorId: req.userId, receiverId: link.ownerId, status: 'PENDING' },
          ],
        },
        data: { status: 'ACCEPTED' },
      });

      // Notify owner
      const partner = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { firstName: true, username: true, profilePicture: true },
      });
      await prisma.notification.create({
        data: {
          userId: link.ownerId,
          type: 'VEHICLE_LINK_ACCEPTED',
          content: 'accepted your shared vehicle request!',
          link: '/settings/vehicle',
          category: 'FRIEND',
          actorId: req.userId,
          actorName: partner?.firstName || partner?.username || 'Someone',
          actorAvatar: partner?.profilePicture,
        },
      });

      res.json(updated);
    } else {
      await prisma.sharedVehicle.update({
        where: { id: linkId },
        data: { status: 'DECLINED' },
      });
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Link respond error:', error);
    res.status(500).json({ error: 'Failed to respond to link' });
  }
});

// DELETE /api/rv/link/:linkId — remove shared vehicle link
router.delete('/link/:linkId', authenticateToken, async (req: any, res) => {
  try {
    const { linkId } = req.params;
    const link = await prisma.sharedVehicle.findUnique({ where: { id: linkId } });
    if (!link) return res.status(404).json({ error: 'Not found' });
    if (link.ownerId !== req.userId && link.partnerId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.sharedVehicle.delete({ where: { id: linkId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// GET /api/rv/link/mine — get my shared vehicle links
router.get('/link/mine', authenticateToken, async (req: any, res) => {
  try {
    const links = await prisma.sharedVehicle.findMany({
      where: {
        OR: [
          { ownerId: req.userId },
          { partnerId: req.userId },
        ],
      },
      include: {
        owner: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true, rvMake: true, rvModel: true } },
        partner: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true, rvMake: true, rvModel: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// ═══════════════════════════════════════════════════════════════
// INVITE LINK — generate shareable invite
// ═══════════════════════════════════════════════════════════════

// POST /api/rv/link/invite — generate invite code
router.post('/link/invite', authenticateToken, async (req: any, res) => {
  try {
    const code = crypto.randomBytes(6).toString('hex'); // 12-char code

    await prisma.vehicleInvite.create({
      data: {
        code,
        creatorId: req.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const inviteUrl = `${req.headers.origin || 'https://www.rvunicorn.com'}/join-vehicle/${code}`;
    res.json({ code, url: inviteUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate invite' });
  }
});

// POST /api/rv/link/invite/redeem — redeem an invite code
router.post('/link/invite/redeem', authenticateToken, async (req: any, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });

    const invite = await prisma.vehicleInvite.findUnique({
      where: { code },
      include: {
        creator: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true, rvMake: true, rvModel: true } },
      },
    });

    if (!invite) return res.status(404).json({ error: 'Invalid invite code' });
    if (invite.usedAt) return res.status(400).json({ error: 'Invite already used' });
    if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Invite expired' });
    if (invite.creatorId === req.userId) return res.status(400).json({ error: 'Cannot use your own invite' });

    // Mark invite as used
    await prisma.vehicleInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedById: req.userId },
    });

    // Create shared vehicle link (auto-accepted via invite)
    const link = await prisma.sharedVehicle.create({
      data: {
        ownerId: invite.creatorId,
        partnerId: req.userId,
        status: 'ACTIVE',
        message: 'Joined via invite link',
      },
    });

    // Clone RV data
    const owner = await prisma.user.findUnique({
      where: { id: invite.creatorId },
      select: { rvMake: true, rvModel: true, rvType: true, rvYear: true, rvLength: true, rvHeight: true, rvWeight: true, rvSleeps: true, rvSlideouts: true, rvMpg: true, rvTankGallons: true, rvFeatures: true },
    });
    if (owner) {
      const cloneData: any = {};
      for (const key of ['rvMake', 'rvModel', 'rvType', 'rvYear', 'rvLength', 'rvHeight', 'rvWeight', 'rvSleeps', 'rvSlideouts', 'rvMpg', 'rvTankGallons'] as const) {
        if (owner[key]) cloneData[key] = owner[key];
      }
      if (owner.rvFeatures.length > 0) cloneData.rvFeatures = owner.rvFeatures;
      if (Object.keys(cloneData).length > 0) {
        await prisma.user.update({ where: { id: req.userId }, data: cloneData });
      }
    }

    // Auto friend request
    const existingFriend = await prisma.friendship.findFirst({
      where: { OR: [{ initiatorId: req.userId, receiverId: invite.creatorId }, { initiatorId: invite.creatorId, receiverId: req.userId }] },
    });
    if (!existingFriend) {
      await prisma.friendship.create({ data: { initiatorId: req.userId, receiverId: invite.creatorId, status: 'ACCEPTED' } }).catch(() => {});
    }

    res.json({ link, creator: invite.creator });
  } catch (error) {
    console.error('Redeem invite error:', error);
    res.status(500).json({ error: 'Failed to redeem invite' });
  }
});

// GET /api/rv/link/invite/:code — get invite info (for preview page)
router.get('/link/invite/:code', async (req, res) => {
  try {
    const invite = await prisma.vehicleInvite.findUnique({
      where: { code: req.params.code },
      include: {
        creator: { select: { username: true, firstName: true, lastName: true, profilePicture: true, rvMake: true, rvModel: true, rvType: true } },
      },
    });

    if (!invite) return res.status(404).json({ error: 'Invalid invite' });
    if (invite.usedAt) return res.status(400).json({ error: 'Already used' });
    if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Expired' });

    res.json({ creator: invite.creator, expiresAt: invite.expiresAt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get invite info' });
  }
});

export default router;
