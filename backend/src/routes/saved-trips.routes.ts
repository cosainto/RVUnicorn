import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// Get user's saved trips
router.get('/my-trips', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const trips = await prisma.savedTrip.findMany({
      where: { userId },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            state: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(trips);
  } catch (error: any) {
    console.error('Get my trips error:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Get a single trip by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const trip = await prisma.savedTrip.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Check visibility
    const isOwner = userId === trip.userId;
    if (!isOwner) {
      if (trip.visibility === 'PRIVATE') {
        return res.status(403).json({ error: 'This trip is private' });
      }
      if (trip.visibility === 'FRIENDS') {
        // Check if friends
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId: trip.userId, friendId: userId, status: 'ACCEPTED' },
              { userId: userId, friendId: trip.userId, status: 'ACCEPTED' },
            ],
          },
        });
        if (!friendship) {
          return res.status(403).json({ error: 'This trip is only visible to friends' });
        }
      }
      
      // Increment view count for non-owners
      await prisma.savedTrip.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    }

    res.json(trip);
  } catch (error: any) {
    console.error('Get trip error:', error);
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

// Create a new saved trip
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const {
      name,
      description,
      originAddress,
      originLat,
      originLng,
      destinationAddress,
      destinationLat,
      destinationLng,
      campgroundId,
      distanceMeters,
      durationSeconds,
      polyline,
      plannedStops,
      estimatedFuelGallons,
      estimatedFuelCost,
      mpgUsed,
      plannedStartDate,
      plannedEndDate,
      eventId,
      visibility,
    } = req.body;

    // Validate eventId if provided
    let validEventId = null;
    if (eventId) {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (event) {
        validEventId = eventId;
      }
    }

    if (!name || !originAddress || !destinationAddress) {
      return res.status(400).json({ error: 'Name, origin, and destination are required' });
    }

    const trip = await prisma.savedTrip.create({
      data: {
        userId,
        name,
        description,
        originAddress,
        originLat,
        originLng,
        destinationAddress,
        destinationLat,
        destinationLng,
        campgroundId: campgroundId || null,
        distanceMeters,
        durationSeconds,
        polyline,
        plannedStops: plannedStops || [],
        estimatedFuelGallons,
        estimatedFuelCost,
        mpgUsed,
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        eventId: validEventId,
        visibility: visibility || 'PRIVATE',
      },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(trip);
  } catch (error: any) {
    console.error('Create trip error:', error);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// Update a saved trip
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Verify ownership
    const existing = await prisma.savedTrip.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this trip' });
    }

    const {
      name,
      description,
      plannedStops,
      plannedStartDate,
      plannedEndDate,
      eventId,
      visibility,
    } = req.body;

    const trip = await prisma.savedTrip.update({
      where: { id },
      data: {
        name,
        description,
        plannedStops,
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        // @ts-ignore - validEventId may not exist
        eventId: validEventId,
        visibility,
      },
    });

    res.json(trip);
  } catch (error: any) {
    console.error('Update trip error:', error);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

// Delete a saved trip
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Verify ownership
    const existing = await prisma.savedTrip.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this trip' });
    }

    await prisma.savedTrip.delete({ where: { id } });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete trip error:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// Copy someone else's trip
router.post('/:id/copy', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const original = await prisma.savedTrip.findUnique({
      where: { id },
    });

    if (!original) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Check visibility
    if (original.visibility === 'PRIVATE' && original.userId !== userId) {
      return res.status(403).json({ error: 'Cannot copy a private trip' });
    }

    // Create copy
    const copy = await prisma.savedTrip.create({
      data: {
        userId,
        name: `${original.name} (Copy)`,
        description: original.description,
        originAddress: original.originAddress,
        originLat: original.originLat,
        originLng: original.originLng,
        destinationAddress: original.destinationAddress,
        destinationLat: original.destinationLat,
        destinationLng: original.destinationLng,
        campgroundId: original.campgroundId,
        distanceMeters: original.distanceMeters,
        durationSeconds: original.durationSeconds,
        polyline: original.polyline,
        plannedStops: original.plannedStops as any,
        estimatedFuelGallons: original.estimatedFuelGallons,
        estimatedFuelCost: original.estimatedFuelCost,
        mpgUsed: original.mpgUsed,
        visibility: 'PRIVATE',
      },
    });

    // Increment copy count on original
    await prisma.savedTrip.update({
      where: { id },
      data: { copyCount: { increment: 1 } },
    });

    res.status(201).json(copy);
  } catch (error: any) {
    console.error('Copy trip error:', error);
    res.status(500).json({ error: 'Failed to copy trip' });
  }
});

// Add comment to a trip
router.post('/:id/comments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const comment = await prisma.savedTripComment.create({
      data: {
        tripId: id,
        userId,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });

    res.status(201).json(comment);
  } catch (error: any) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get public/popular trips (for discovery)
router.get('/discover/popular', async (req: Request, res: Response) => {
  try {
    const trips = await prisma.savedTrip.findMany({
      where: { visibility: 'PUBLIC' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            state: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: [
        { copyCount: 'desc' },
        { viewCount: 'desc' },
      ],
      take: 20,
    });

    res.json(trips);
  } catch (error: any) {
    console.error('Get popular trips error:', error);
    res.status(500).json({ error: 'Failed to fetch popular trips' });
  }
});

// Get trips to a specific campground
router.get('/to-campground/:campgroundId', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;

    const trips = await prisma.savedTrip.findMany({
      where: {
        campgroundId,
        visibility: 'PUBLIC',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: { copyCount: 'desc' },
      take: 10,
    });

    res.json(trips);
  } catch (error: any) {
    console.error('Get campground trips error:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// ══ Share a trip (generate shareToken) ══
router.post('/:id/share', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const trip = await prisma.savedTrip.findUnique({ where: { id } });
    if (!trip || trip.userId !== userId) return res.status(404).json({ error: 'Trip not found' });

    // If already has a token, return it
    if (trip.shareToken) {
      return res.json({ shareToken: trip.shareToken, url: `https://www.rvunicorn.com/route/${trip.shareToken}` });
    }

    // Generate a short token
    const token = id.slice(0, 8) + Math.random().toString(36).slice(2, 6);
    await prisma.savedTrip.update({
      where: { id },
      data: { shareToken: token, visibility: 'PUBLIC' },
    });

    res.json({ shareToken: token, url: `https://www.rvunicorn.com/route/${token}` });
  } catch (error: any) {
    console.error('Share trip error:', error);
    res.status(500).json({ error: 'Failed to share trip' });
  }
});

// ══ Public trip view by shareToken ══
router.get('/public/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const trip = await prisma.savedTrip.findFirst({
      where: { shareToken: token },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        campground: { select: { id: true, name: true, state: true, imageUrl: true, latitude: true, longitude: true } },
      },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Increment view count
    await prisma.savedTrip.update({ where: { id: trip.id }, data: { viewCount: { increment: 1 } } });

    const hours = Math.floor(trip.durationSeconds / 3600);
    const mins = Math.round((trip.durationSeconds % 3600) / 60);
    const miles = Math.round(trip.distanceMeters * 0.000621371);

    res.json({
      id: trip.id,
      name: trip.name,
      description: trip.description,
      originAddress: trip.originAddress,
      destinationAddress: trip.destinationAddress,
      originLat: trip.originLat,
      originLng: trip.originLng,
      destinationLat: trip.destinationLat,
      destinationLng: trip.destinationLng,
      distanceMiles: miles,
      driveTime: `${hours}h ${mins}m`,
      estimatedFuelCost: trip.estimatedFuelCost,
      polyline: trip.polyline,
      plannedStops: trip.plannedStops,
      campground: trip.campground,
      owner: trip.user,
      viewCount: trip.viewCount,
      createdAt: trip.createdAt,
    });
  } catch (error: any) {
    console.error('Public trip view error:', error);
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

export default router;
