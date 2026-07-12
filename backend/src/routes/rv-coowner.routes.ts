import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// Get my co-owners
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const coOwners = await prisma.rVCoOwner.findMany({
      where: { ownerId: userId },
      include: { coOwner: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } } }
    });
    res.json(coOwners);
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

// Get RVs I co-own (someone shared their RV with me)
router.get('/shared-with-me', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const shared = await prisma.rVCoOwner.findMany({
      where: { coOwnerId: userId },
      include: {
        owner: {
          select: {
            id: true, firstName: true, lastName: true, profilePicture: true, username: true,
            rvMake: true, rvModel: true, rvYear: true, rvType: true, rvLength: true,
            rvDescription: true, rvFeatures: true, rvFloorplan: true, rvSleeps: true,
            rvSlideouts: true, rvMpg: true, rvHeight: true, rvWidth: true, rvWeight: true,
            rvGvwr: true, rvHitchWeight: true, rvAxles: true, rvAwningFt: true,
            rvAirconditioners: true, rvFuelGal: true, rvFreshWaterGal: true,
            rvGreyWaterGal: true, rvBlackWaterGal: true, rvLpGasGal: true,
            rvShorepower: true, rvGeneratorWatts: true, rvBatteryAh: true, rvSolarWatts: true,
            rvOdometer: true, rvShowcase: true,
          }
        }
      }
    });
    res.json(shared);
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

// Add co-owner
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { coOwnerId } = req.body;
  if (!coOwnerId) return res.status(400).json({ error: 'coOwnerId required' });
  if (coOwnerId === userId) return res.status(400).json({ error: 'Cannot add yourself' });
  try {
    const coOwner = await prisma.rVCoOwner.create({
      data: { ownerId: userId, coOwnerId },
      include: { coOwner: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } } }
    });
    // Notify the co-owner
    await prisma.notification.create({
      data: {
        userId: coOwnerId,
        type: 'RV_CO_OWNER',
        content: `added you as a co-owner of their RV`,
        actorId: userId,
        read: false,
      }
    }).catch(() => {});
    res.json(coOwner);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Already a co-owner' });
    res.status(500).json({ error: 'Failed' });
  }
});

// Remove co-owner
router.delete('/:coOwnerId', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { coOwnerId } = req.params;
  try {
    await prisma.rVCoOwner.deleteMany({ where: { ownerId: userId, coOwnerId } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
