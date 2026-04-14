import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

const RIG_FIELDS = {
  rvType: true, rvMake: true, rvModel: true, rvYear: true,
  rvLength: true, rvHeight: true, rvWeight: true, rvSleeps: true,
  rvSlideouts: true, rvMpg: true, rvDescription: true, rvFeatures: true,
};

// POST /api/rig-connection/request — send co-pilot request
router.post('/request', authenticateToken, async (req: any, res: Response) => {
  try {
    const requesterId = req.userId || (req as any).user?.id;
    const { username, email } = req.body;
    if (!username && !email) return res.status(400).json({ error: 'username or email required' });

    const receiver = await prisma.user.findFirst({
      where: username
        ? { username: { equals: username, mode: 'insensitive' } }
        : { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, firstName: true, lastName: true, username: true },
    });
    if (!receiver) return res.status(404).json({ error: 'User not found' });
    if (receiver.id === requesterId) return res.status(400).json({ error: 'Cannot connect with yourself' });

    // Check existing
    const existing = await prisma.rigConnection.findFirst({
      where: {
        OR: [
          { requesterId, receiverId: receiver.id },
          { requesterId: receiver.id, receiverId: requesterId },
        ],
      },
    });
    if (existing?.status === 'APPROVED') return res.json({ connection: existing, alreadyConnected: true });
    if (existing?.status === 'PENDING') return res.json({ connection: existing, alreadyPending: true });

    const connection = await prisma.rigConnection.create({
      data: { requesterId, receiverId: receiver.id },
      include: {
        receiver: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
      },
    });

    // Send notification
    const requester = await prisma.user.findUnique({ where: { id: requesterId }, select: { firstName: true, rvMake: true, rvModel: true } });
    await prisma.notification.create({
      data: {
        userId: receiver.id,
        type: 'RIG_CONNECTION_REQUEST',
        title: 'Co-Pilot Request',
        message: `${requester?.firstName || 'Someone'} wants to link to your ${requester?.rvMake ? `${requester.rvMake} ${requester.rvModel || ''}` : 'rig'} as a co-pilot`,
        data: { connectionId: connection.id, requesterId },
      } as any,
    });

    res.json({ connection });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// POST /api/rig-connection/:id/approve — approve request
router.post('/:id/approve', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const connection = await prisma.rigConnection.findUnique({ where: { id: req.params.id } });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    if (connection.receiverId !== userId) return res.status(403).json({ error: 'Only receiver can approve' });
    if (connection.status !== 'PENDING') return res.status(400).json({ error: 'Connection is not pending' });

    // Snapshot rig data from requester
    const requester = await prisma.user.findUnique({
      where: { id: connection.requesterId },
      select: RIG_FIELDS,
    });

    // Sync rig data to receiver if they don't have any
    const receiver = await prisma.user.findUnique({
      where: { id: userId },
      select: { rvType: true },
    });
    if (!receiver?.rvType && requester?.rvType) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          rvType: requester.rvType, rvMake: requester.rvMake, rvModel: requester.rvModel,
          rvYear: requester.rvYear, rvLength: requester.rvLength, rvHeight: requester.rvHeight,
          rvWeight: requester.rvWeight, rvSleeps: requester.rvSleeps, rvSlideouts: requester.rvSlideouts,
          rvMpg: requester.rvMpg,
        },
      });
    }

    const updated = await prisma.rigConnection.update({
      where: { id: connection.id },
      data: { status: 'APPROVED', rigData: requester || undefined },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
      },
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        userId: connection.requesterId,
        type: 'RIG_CONNECTION_APPROVED',
        title: 'Co-Pilot Approved!',
        message: `${updated.receiver.firstName} approved your co-pilot request! Your rigs are now linked.`,
        data: { connectionId: connection.id },
      } as any,
    });

    res.json({ connection: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// POST /api/rig-connection/:id/decline
router.post('/:id/decline', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const connection = await prisma.rigConnection.findUnique({ where: { id: req.params.id } });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    if (connection.receiverId !== userId) return res.status(403).json({ error: 'Only receiver can decline' });

    await prisma.rigConnection.update({
      where: { id: connection.id },
      data: { status: 'DECLINED' },
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to decline' });
  }
});

// GET /api/rig-connection/pending — pending for this user
router.get('/pending', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const connections = await prisma.rigConnection.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        status: 'PENDING',
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ connections });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch pending' });
  }
});

// GET /api/rig-connection/co-pilot — get approved co-pilot for this user
router.get('/co-pilot', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const connection = await prisma.rigConnection.findFirst({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        status: 'APPROVED',
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
      },
    });
    if (!connection) return res.json({ coPilot: null });
    const coPilot = connection.requesterId === userId ? connection.receiver : connection.requester;
    res.json({ coPilot, connectionId: connection.id });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch co-pilot' });
  }
});

// GET /api/rig-connection/co-pilot/:userId — get co-pilot for any user (public)
router.get('/co-pilot/:userId', async (req, res) => {
  try {
    const connection = await prisma.rigConnection.findFirst({
      where: {
        OR: [{ requesterId: req.params.userId }, { receiverId: req.params.userId }],
        status: 'APPROVED',
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
      },
    });
    if (!connection) return res.json({ coPilot: null });
    const coPilot = connection.requesterId === req.params.userId ? connection.receiver : connection.requester;
    res.json({ coPilot });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
