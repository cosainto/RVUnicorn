import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// POST /api/household/invite — send household invite to another user
router.post('/invite', authenticateToken, async (req: any, res) => {
  try {
    const senderId = req.user.id;
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const receiver = await prisma.user.findUnique({
      where: { username },
      select: { id: true, firstName: true, lastName: true, profilePicture: true, householdId: true },
    });
    if (!receiver) return res.status(404).json({ error: 'User not found' });
    if (receiver.id === senderId) return res.status(400).json({ error: 'Cannot invite yourself' });
    if (receiver.householdId) return res.status(400).json({ error: 'That user is already in a household' });

    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { householdId: true },
    });
    if (sender?.householdId) return res.status(400).json({ error: 'You are already in a household' });

    // Check for existing invite
    const existing = await prisma.householdInvite.findFirst({
      where: { senderId, receiverId: receiver.id, status: 'PENDING' },
    });
    if (existing) return res.status(400).json({ error: 'Invite already sent' });

    const invite = await prisma.householdInvite.create({
      data: { senderId, receiverId: receiver.id },
      include: {
        receiver: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } },
      },
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId: receiver.id,
        type: 'HOUSEHOLD_INVITE',
        content: `invited you to join their household 🏕️`,
        link: '/settings/household',
      },
    }).catch(() => {});

    res.json({ invite, message: `Household invite sent to ${receiver.firstName}` });
  } catch (e: any) {
    console.error('[Household] invite error:', e?.message);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// POST /api/household/accept/:inviteId — accept invite, creates household
router.post('/accept/:inviteId', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const invite = await prisma.householdInvite.findUnique({
      where: { id: req.params.inviteId },
      include: {
        sender: { select: { id: true, firstName: true, householdId: true } },
      },
    });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.receiverId !== userId) return res.status(403).json({ error: 'Not your invite' });
    if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Invite already handled' });

    // Create household
    const household = await prisma.household.create({ data: {} });

    // Link both users
    await prisma.user.update({ where: { id: invite.senderId }, data: { householdId: household.id } });
    await prisma.user.update({ where: { id: userId }, data: { householdId: household.id } });

    // Mark invite accepted
    await prisma.householdInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', householdId: household.id },
    });

    res.json({ household, message: 'Household linked! You are now travel companions 🚐' });
  } catch (e: any) {
    console.error('[Household] accept error:', e?.message);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// POST /api/household/decline/:inviteId
router.post('/decline/:inviteId', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const invite = await prisma.householdInvite.findUnique({ where: { id: req.params.inviteId } });
    if (!invite || invite.receiverId !== userId) return res.status(403).json({ error: 'Not your invite' });
    await prisma.householdInvite.update({ where: { id: invite.id }, data: { status: 'DECLINED' } });
    res.json({ message: 'Invite declined' });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to decline invite' });
  }
});

// GET /api/household/my — get current user's household info
router.get('/my', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        householdId: true,
        household: {
          include: {
            members: {
              select: {
                id: true, firstName: true, lastName: true, username: true,
                profilePicture: true, rvModel: true, rvYear: true, rvType: true,
                rvShowcase: { select: { photos: true, title: true } },
              },
            },
          },
        },
        receivedHouseholdInvites: {
          where: { status: 'PENDING' },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
          },
        },
      },
    });
    res.json({
      household: user?.household || null,
      pendingInvites: user?.receivedHouseholdInvites || [],
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get household' });
  }
});

// DELETE /api/household/leave — leave household
router.delete('/leave', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { householdId: true } });
    if (!user?.householdId) return res.status(400).json({ error: 'Not in a household' });
    await prisma.user.update({ where: { id: userId }, data: { householdId: null } });
    // Clean up empty households
    const remaining = await prisma.user.count({ where: { householdId: user.householdId } });
    if (remaining === 0) await prisma.household.delete({ where: { id: user.householdId } }).catch(() => {});
    res.json({ message: 'Left household' });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to leave household' });
  }
});

// POST /api/household/sync-rv — sync agreed RV data to all household members
router.post('/sync-rv', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { rvYear, rvModel, rvType, rvMpg, rvFuelType, rvMake } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { householdId: true } });
    if (!user?.householdId) return res.status(400).json({ error: 'Not in a household' });

    // Update all household members with agreed RV data
    await prisma.user.updateMany({
      where: { householdId: user.householdId },
      data: {
        ...(rvYear !== undefined && { rvYear: parseInt(rvYear) || null }),
        ...(rvModel !== undefined && { rvModel }),
        ...(rvType !== undefined && { rvType }),
        ...(rvMpg !== undefined && { rvMpg: parseFloat(rvMpg) || null }),
        ...(rvFuelType !== undefined && { rvFuelType }),
      },
    });

    res.json({ message: 'RV info synced to all household members ✅' });
  } catch (e: any) {
    console.error('[Household] sync-rv error:', e?.message);
    res.status(500).json({ error: 'Failed to sync RV info' });
  }
});


export default router;
