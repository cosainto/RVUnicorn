import { Router, Request, Response } from 'express';
import { logCheckIn } from '../services/activity.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

// GET /api/checkins - Get user's check-ins
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { active } = req.query;
    const now = new Date();

    let whereClause: any = { userId };

    if (active === 'true') {
      whereClause.isActive = true;
      whereClause.checkOutDate = { gte: now };
    }

    const checkIns = await prisma.checkIn.findMany({
      where: whereClause,
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            imageUrl: true,
          }
        }
      },
      orderBy: { checkInDate: 'desc' }
    });

    res.json(checkIns);
  } catch (error) {
    console.error('Get check-ins error:', error);
    res.status(500).json({ error: 'Failed to get check-ins' });
  }
});

// GET /api/checkins/campground/:campgroundId - Get current check-ins at campground
router.get('/campground/:campgroundId', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const now = new Date();

    const checkIns = await prisma.checkIn.findMany({
      where: {
        campgroundId,
        isActive: true,
        checkInDate: { lte: now },
        OR: [
          { checkOutDate: { gte: now } },
          { checkOutDate: null }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      },
      orderBy: { checkInDate: 'desc' }
    });

    res.json(checkIns);
  } catch (error) {
    console.error('Get campground check-ins error:', error);
    res.status(500).json({ error: 'Failed to get campground check-ins' });
  }
});

// GET /api/checkins/user/:userId - Get check-ins for a specific user
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const checkIns = await prisma.checkIn.findMany({
      where: { userId },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            imageUrl: true,
          }
        }
      },
      orderBy: { checkInDate: 'desc' }
    });

    res.json(checkIns);
  } catch (error) {
    console.error('Get user check-ins error:', error);
    res.status(500).json({ error: 'Failed to get check-ins' });
  }
});

// GET /api/checkins/my/active - Get current user's active check-in
router.get('/my/active', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();

    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId,
        isActive: true,
        checkInDate: { lte: now },
        OR: [
          { checkOutDate: { gte: now } },
          { checkOutDate: null }
        ]
      },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
          }
        }
      }
    });

    res.json(activeCheckIn);
  } catch (error) {
    console.error('Get active check-in error:', error);
    res.status(500).json({ error: 'Failed to get active check-in' });
  }
});

// POST /api/checkins - Create check-in
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, checkInDate, checkOutDate, siteNumber, notes } = req.body;

    if (!campgroundId || !checkInDate) {
      return res.status(400).json({ error: 'campgroundId and checkInDate are required' });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = checkOutDate ? new Date(checkOutDate) : null;

    if (checkOut && checkOut <= checkIn) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date' });
    }

    // Check for existing active check-in at this campground
    const existing = await prisma.checkIn.findFirst({
      where: {
        userId,
        campgroundId,
        isActive: true,
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'You already have an active check-in at this campground' });
    }

    const checkInRecord = await prisma.checkIn.create({
      data: {
        userId,
        campgroundId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        siteNumber,
        notes,
        isActive: true,
      },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            imageUrl: true,
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          }
        }
      }
    });

    // Auto-create StateVisit for this check-in
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
    });

    if (campground?.state) {
      await prisma.stateVisit.create({
        data: {
          userId,
          state: campground.state,
          startDate: checkIn,
          endDate: checkOut,
          campsiteId: campgroundId,
          notes: `Checked in at ${campground.name}`,
          visibility: 'PUBLIC',
        },
      }).catch(() => {}); // Ignore if already exists
    }

    // Auto-complete trip plans for this campground
    try {
      const userEvents = await prisma.event.findMany({
        where: {
          OR: [
            { organizerId: userId },
            { attendees: { some: { userId } } }
          ],
          campgroundId,
        },
        select: { id: true }
      });

      if (userEvents.length > 0) {
        const eventIds = userEvents.map(e => e.id);
        await prisma.tripPlan.updateMany({
          where: {
            userId,
            eventId: { in: eventIds },
            status: 'PLANNED',
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          }
        });
      }
    } catch (e) { console.error('Auto-complete trip error:', e); }

    // Notify friends about check-in
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { initiatorId: userId },
          { receiverId: userId }
        ]
      },
      select: { initiatorId: true, receiverId: true }
    });

    const friendIds = friendships.map(f => f.initiatorId === userId ? f.receiverId : f.initiatorId);
    
    if (friendIds.length > 0 && checkInRecord.campground) {
      const notificationPromises = friendIds.map(friendId =>
        prisma.notification.create({
          data: {
            userId: friendId,
            type: "FRIEND_CHECKIN",
            content: checkInRecord.user.firstName + " " + checkInRecord.user.lastName + " checked in at " + checkInRecord.campground!.name,
            link: "/campgrounds/" + campgroundId
          }
        })
      );
      await Promise.all(notificationPromises);
    }

    res.json(checkInRecord);
  } catch (error) {
    console.error('Create check-in error:', error);
    res.status(500).json({ error: 'Failed to create check-in' });
  }
});

// PUT /api/checkins/:id - Update check-in
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { checkInDate, checkOutDate, siteNumber, notes, isActive } = req.body;

    const checkIn = await prisma.checkIn.findUnique({
      where: { id }
    });

    if (!checkIn) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    if (checkIn.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedCheckIn = await prisma.checkIn.update({
      where: { id },
      data: {
        checkInDate: checkInDate ? new Date(checkInDate) : undefined,
        checkOutDate: checkOutDate ? new Date(checkOutDate) : undefined,
        siteNumber: siteNumber !== undefined ? siteNumber : undefined,
        notes: notes !== undefined ? notes : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            imageUrl: true,
          }
        }
      }
    });

    res.json(updatedCheckIn);
  } catch (error) {
    console.error('Update check-in error:', error);
    res.status(500).json({ error: 'Failed to update check-in' });
  }
});

// POST /api/checkins/:id/checkout - Check out
router.post('/:id/checkout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const checkIn = await prisma.checkIn.findUnique({
      where: { id }
    });

    if (!checkIn) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    if (checkIn.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.checkIn.update({
      where: { id },
      data: {
        isActive: false,
        checkOutDate: new Date(),
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// DELETE /api/checkins/:id - Delete check-in
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const checkIn = await prisma.checkIn.findUnique({
      where: { id }
    });

    if (!checkIn) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    if (checkIn.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.checkIn.delete({
      where: { id }
    });

    res.json({ message: 'Check-in deleted' });
  } catch (error) {
    console.error('Delete check-in error:', error);
    res.status(500).json({ error: 'Failed to delete check-in' });
  }
});

export default router;
