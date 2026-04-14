import { Router, Request, Response } from 'express';
// @ts-ignore
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// POST /api/drive-sessions — save a completed drive session
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      totalDriveSeconds = 0,
      totalStopSeconds = 0,
      breakCount = 0,
      longestStretchSecs = 0,
      fatigueScoreAtEnd = 0,
      grade = 'B',
      alertnessChecks = [],
      eventId,
    } = req.body;

    const session = await prisma.driveSession.create({
      data: {
        userId,
        endTime: new Date(),
        totalDriveSeconds,
        totalStopSeconds,
        breakCount,
        longestStretchSecs,
        fatigueScoreAtEnd,
        grade,
        alertnessChecks,
        eventId: eventId || null,
      },
    });

    res.json({ session });
  } catch (err: any) {
    console.error('drive-sessions POST error:', err);
    res.status(500).json({ error: 'Failed to save drive session' });
  }
});

// GET /api/drive-sessions — fetch current user's drive history (last 10)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const sessions = await prisma.driveSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        totalDriveSeconds: true,
        totalStopSeconds: true,
        breakCount: true,
        longestStretchSecs: true,
        fatigueScoreAtEnd: true,
        grade: true,
        createdAt: true,
      },
    });
    res.json({ sessions });
  } catch (err: any) {
    console.error('drive-sessions GET error:', err);
    res.status(500).json({ error: 'Failed to fetch drive sessions' });
  }
});

export default router;
