import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../utils/cloudinary';

const db = prisma as any;
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper to check if users are friends
async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const friendship = await db.friendship.findFirst({
    where: {
      OR: [
        { initiatorId: userId1, receiverId: userId2, status: { in: ['accepted', 'ACCEPTED'] } },
        { initiatorId: userId2, receiverId: userId1, status: { in: ['accepted', 'ACCEPTED'] } },
      ],
    },
  });
  return !!friendship;
}

// Get user's travel map
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Optional auth - try to get viewer ID from token
    let viewerId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        viewerId = decoded.userId;
      } catch (e: any) {
        // Token invalid or expired, continue as guest
      }
    }
    
    const isOwnProfile = viewerId === userId;

    let whereClause: any = { userId };

    if (!isOwnProfile) {
      // Check if viewer is a friend
      const isFriend = viewerId ? await areFriends(viewerId, userId) : false;
      
      if (isFriend) {
        whereClause = {
          userId,
          visibility: { in: ['PUBLIC', 'FRIENDS'] },
        };
      } else {
        whereClause = {
          userId,
          visibility: 'PUBLIC',
        };
      }
    }

    const stateVisits = await db.stateVisit.findMany({
      where: whereClause,
      include: {
        campsite: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            latitude: true,
            longitude: true,
          }
        },
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            startDate: true,
            endDate: true,
            location: true,
            organizer: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              }
            },
          }
        },
        attendees: {
          include: {
            attendee: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              }
            }
          }
        },
        albums: {
          include: {
            album: {
              include: {
                photos: {
                  take: 1,
                  select: {
                    imageUrl: true,
                  }
                },
                _count: {
                  select: {
                    photos: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { startDate: 'desc' },
    });

    // Transform for frontend
    const transformedVisits = stateVisits.map((visit: any) => ({
      ...visit,
      attendees: visit.attendees.map((a: any) => ({ id: a.id, user: a.attendee })),
      albums: visit.albums.map((a: any) => a.album)
    }));

    const visitedStates = [...new Set(stateVisits.map((v: any) => v.state))];

    res.json({
      visitedStates,
      stateVisits: transformedVisits,
      flair: [],
      isOwnProfile,
      isFriend: !isOwnProfile && viewerId ? await areFriends(viewerId, userId) : false,
    });
  } catch (error: any) {
    console.error('Get travel map error:', error);
    res.status(500).json({ error: 'Failed to fetch travel map' });
  }
});

// GET /api/travel-map/:userId/state/:stateCode — detailed state visit drill-down
router.get('/:userId/state/:stateCode', async (req: Request, res: Response) => {
  try {
    const { userId, stateCode } = req.params;

    // Optional auth
    let viewerId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET) as any;
        viewerId = decoded.userId;
      } catch {}
    }

    const isOwnProfile = viewerId === userId;

    // Check travel map privacy
    if (!isOwnProfile) {
      const prefs = await db.userPreferences.findUnique({ where: { userId } });
      const travelPrivacy = prefs?.showTravelMap || 'FRIENDS';
      const isFriend = viewerId ? await areFriends(viewerId, userId) : false;

      if (travelPrivacy === 'PRIVATE') {
        return res.status(403).json({ error: 'private', message: "This user's travel map is private" });
      }
      if (travelPrivacy === 'FRIENDS' && !isFriend) {
        return res.status(403).json({ error: 'friends_only', message: "This user's travel map is visible to friends only" });
      }
    }

    // Determine visibility filter
    const isFriend = !isOwnProfile && viewerId ? await areFriends(viewerId, userId) : false;
    let visibilityFilter: any = {};
    if (!isOwnProfile) {
      visibilityFilter = isFriend
        ? { visibility: { in: ['PUBLIC', 'FRIENDS'] } }
        : { visibility: 'PUBLIC' };
    }

    // Album privacy filter
    const albumPrivacyValues = isOwnProfile
      ? undefined
      : isFriend
        ? ['PUBLIC', 'FRIENDS', 'FRIENDS_ONLY']
        : ['PUBLIC'];

    const stateVisits = await db.stateVisit.findMany({
      where: { userId, state: stateCode.toUpperCase(), ...visibilityFilter },
      include: {
        campsite: {
          select: { id: true, name: true, location: true, state: true, imageUrl: true, latitude: true, longitude: true },
        },
        event: {
          select: {
            id: true, title: true, startDate: true, endDate: true, coverImage: true, location: true, privacy: true,
            attendees: {
              select: {
                userId: true,
                status: true,
                user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
              },
            },
            photoAlbums: {
              where: albumPrivacyValues ? { privacy: { in: albumPrivacyValues } } : undefined,
              select: {
                id: true, title: true, coverPhotoUrl: true, privacy: true,
                _count: { select: { photos: true } },
                photos: { take: 1, select: { imageUrl: true } },
              },
            },
          },
        },
        albums: {
          include: {
            album: {
              select: {
                id: true, title: true, coverPhotoUrl: true, privacy: true,
                _count: { select: { photos: true } },
                photos: { take: 1, select: { imageUrl: true } },
              },
            },
          },
        },
        attendees: {
          include: {
            attendee: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    // Filter albums by privacy and transform
    const visits = stateVisits.map((visit: any) => {
      const visitAlbums = visit.albums
        .map((a: any) => a.album)
        .filter((a: any) => !albumPrivacyValues || albumPrivacyValues.includes(a.privacy));
      const eventAlbums = visit.event?.photoAlbums || [];
      // Merge and deduplicate
      const allAlbums = [...visitAlbums];
      for (const ea of eventAlbums) {
        if (!allAlbums.find((a: any) => a.id === ea.id)) allAlbums.push(ea);
      }

      return {
        id: visit.id,
        state: visit.state,
        startDate: visit.startDate,
        endDate: visit.endDate,
        notes: visit.notes,
        visibility: visit.visibility,
        visitType: visit.visitType || 'CAMPING',
        photoUrls: visit.photoUrls || [],
        campsiteId: visit.campsiteId,
        eventId: visit.eventId,
        campsite: visit.campsite,
        event: visit.event ? {
          id: visit.event.id,
          title: visit.event.title,
          startDate: visit.event.startDate,
          endDate: visit.event.endDate,
          coverImage: visit.event.coverImage,
          location: visit.event.location,
        } : null,
        attendees: visit.attendees.map((a: any) => a.attendee),
        albums: allAlbums.map((a: any) => ({
          id: a.id,
          title: a.title,
          coverPhoto: a.coverPhotoUrl || a.photos?.[0]?.imageUrl || null,
          photoCount: a._count?.photos || 0,
        })),
      };
    });

    res.json({ stateCode: stateCode.toUpperCase(), visits, isOwnProfile, isFriend });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch state details' });
  }
});

// Copy a trip to your own travel map
router.post('/visits/:visitId/copy', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { visitId } = req.params;

    // Get the original visit
    const originalVisit = await db.stateVisit.findUnique({
      where: { id: visitId },
      include: {
        campsite: true,
        event: true,
      },
    });

    if (!originalVisit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Check visibility permissions
    if (originalVisit.userId !== userId) {
      const isFriend = await areFriends(userId, originalVisit.userId);
      
      if (originalVisit.visibility === 'PRIVATE') {
        return res.status(403).json({ error: 'This trip is private' });
      }
      if (originalVisit.visibility === 'FRIENDS' && !isFriend) {
        return res.status(403).json({ error: 'This trip is only visible to friends' });
      }
    }

    // Check if user already has this trip
    const existingVisit = await db.stateVisit.findFirst({
      where: {
        userId,
        state: originalVisit.state,
        startDate: originalVisit.startDate,
        campsiteId: originalVisit.campsiteId,
      },
    });

    if (existingVisit) {
      return res.status(400).json({ error: 'You already have this trip saved' });
    }

    // Create copy (without attendees)
    const newVisit = await db.stateVisit.create({
      data: {
        userId,
        state: originalVisit.state,
        startDate: originalVisit.startDate,
        endDate: originalVisit.endDate,
        notes: `Copied trip: ${originalVisit.notes || ''}`.trim(),
        campsiteId: originalVisit.campsiteId,
        eventId: null, // Don't copy event link
        visibility: 'PRIVATE', // Default to private for copied trips
      },
      include: {
        campsite: true,
      },
    });

    res.json(newVisit);
  } catch (error: any) {
    console.error('Copy visit error:', error);
    res.status(500).json({ error: 'Failed to copy trip' });
  }
});

// Add state visit
router.post('/visits', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { state, startDate, endDate, notes, campsiteId, eventId, attendeeIds, albumIds, visibility, photoUrls, linkUrl, latitude, longitude, visitType } = req.body;

    if (!state || !startDate) {
      return res.status(400).json({ error: 'State and start date are required' });
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid start date' });
    }

    let end = null;
    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid end date' });
      }
      if (end < start) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }
    }

    if (eventId) {
      const existing = await db.stateVisit.findFirst({
        where: { userId, eventId },
      });
      if (existing) {
        return res.status(400).json({ error: 'Visit already exists for this event' });
      }
    }

    const visit = await db.stateVisit.create({
      data: {
        userId,
        state,
        startDate: start,
        endDate: end,
        notes,
        campsiteId: campsiteId || null,
        eventId: eventId || null,
        visibility: visibility || 'PUBLIC',
        visitType: visitType || 'CAMPING',
        // Enforce single-day for overnight stops
        ...(visitType === 'OVERNIGHT' ? { endDate: start } : {}),
        photoUrls: photoUrls || [],
        linkUrl: linkUrl || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    if (attendeeIds && Array.isArray(attendeeIds) && attendeeIds.length > 0) {
      await db.stateVisitAttendee.createMany({
        data: attendeeIds.map((friendId: string) => ({
          stateVisitId: visit.id,
          attendeeId: friendId,
        })),
      });
    }

    if (albumIds && Array.isArray(albumIds) && albumIds.length > 0) {
      await db.stateVisitAlbum.createMany({
        data: albumIds.map((albumId: string) => ({
          stateVisitId: visit.id,
          albumId,
        })),
      });
    }

    res.json(visit);
  } catch (error: any) {
    console.error('Add state visit error:', error);
    res.status(500).json({ error: 'Failed to add state visit' });
  }
});

// Upload photos to a visit
router.post('/visits/:visitId/photos', authenticateToken, upload.array('photos', 5), async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { visitId } = req.params;
    const visit = await db.stateVisit.findUnique({ where: { id: visitId } });
    if (!visit || visit.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files' });

    const urls: string[] = [];
    for (const file of files) {
      const url = await uploadBufferToCloudinary(file.buffer, 'rvunicorn/visits');
      urls.push(url);
    }

    const updated = await db.stateVisit.update({
      where: { id: visitId },
      data: { photoUrls: [...(visit.photoUrls || []), ...urls] },
    });

    res.json({ photoUrls: updated.photoUrls });
  } catch (error: any) {
    console.error('Upload visit photos error:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// Update visibility
router.patch('/visits/:visitId/visibility', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { visitId } = req.params;
    const { visibility } = req.body;

    if (!['PUBLIC', 'FRIENDS', 'PRIVATE'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility. Must be PUBLIC, FRIENDS, or PRIVATE' });
    }

    const visit = await db.stateVisit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (visit.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await db.stateVisit.update({
      where: { id: visitId },
      data: { visibility },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Toggle visibility error:', error);
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});

// Update state visit
router.put('/visits/:visitId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { visitId } = req.params;
    const { startDate, endDate, notes, campsiteId, eventId, attendeeIds, albumIds, visibility } = req.body;

    const visit = await db.stateVisit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (visit.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let start = visit.startDate;
    let end = visit.endDate;

    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return res.status(400).json({ error: 'Invalid start date' });
      }
    }

    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid end date' });
      }
      if (end < start) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }
    }

    const updatedVisit = await db.stateVisit.update({
      where: { id: visitId },
      data: {
        startDate: start,
        endDate: end,
        notes,
        campsiteId: campsiteId || null,
        eventId: eventId || null,
        visibility: visibility || visit.visibility,
      },
    });

    if (attendeeIds !== undefined) {
      await db.stateVisitAttendee.deleteMany({
        where: { stateVisitId: visitId },
      });

      if (Array.isArray(attendeeIds) && attendeeIds.length > 0) {
        await db.stateVisitAttendee.createMany({
          data: attendeeIds.map((friendId: string) => ({
            stateVisitId: visitId,
            attendeeId: friendId,
          })),
        });
      }
    }

    if (albumIds !== undefined) {
      await db.stateVisitAlbum.deleteMany({
        where: { stateVisitId: visitId },
      });

      if (Array.isArray(albumIds) && albumIds.length > 0) {
        await db.stateVisitAlbum.createMany({
          data: albumIds.map((albumId: string) => ({
            stateVisitId: visitId,
            albumId,
          })),
        });
      }
    }

    res.json(updatedVisit);
  } catch (error: any) {
    console.error('Update state visit error:', error);
    res.status(500).json({ error: 'Failed to update state visit' });
  }
});

// Delete state visit
router.delete('/visits/:visitId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { visitId } = req.params;

    const visit = await db.stateVisit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (visit.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.stateVisit.delete({
      where: { id: visitId },
    });

    res.json({ message: 'Visit deleted' });
  } catch (error: any) {
    console.error('Delete state visit error:', error);
    res.status(500).json({ error: 'Failed to delete state visit' });
  }
});

export default router;
