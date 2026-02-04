import { Router, Request, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { prisma } from '../index';

const router = Router();

// Admin email that can delete/edit campgrounds
const ADMIN_EMAIL = 'wroberts82@yahoo.com';

// Middleware to check if user is admin
const isAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    
    if (!user || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

// Get all campgrounds
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, offset, page, state, search } = req.query;
    
    const where: any = {};
    
    if (state) {
      where.state = state;
    }
    
    if (req.query.verificationStatus) {
      where.verificationStatus = req.query.verificationStatus;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { location: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const campgrounds = await prisma.campground.findMany({
      where,
      take: limit ? parseInt(limit as string) : 50,
      skip: page ? (parseInt(page as string) - 1) * (limit ? parseInt(limit as string) : 50) : (offset ? parseInt(offset as string) : 0),
      orderBy: { name: 'asc' },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        _count: {
          select: {
            reviews: true,
            followers: true,
            checkIns: true,
          }
        }
      }
    });

    const total = await prisma.campground.count({ where });

    res.json({
      campgrounds,
      total,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0, totalPages: Math.ceil(total / (limit ? parseInt(limit as string) : 50)),
    });
  } catch (error) {
    console.error('Get campgrounds error:', error);
    res.status(500).json({ error: 'Failed to get campgrounds' });
  }
});

// Get user's favorite campgrounds (MUST come before /:id routes)

// GET /api/campgrounds/following - Get campgrounds the user follows
router.get("/following", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const now = new Date();
    
    // Get followed campgrounds
    const follows = await prisma.campgroundFollow.findMany({
      where: { userId },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        campground: {
          select: { id: true, name: true, location: true, imageUrl: true, state: true }
        }
      }
    });
    
    // Get campgrounds user is currently checked in at
    const activeCheckIns = await prisma.checkIn.findMany({
      where: {
        userId,
        isActive: true,
        checkInDate: { lte: now },
        OR: [
          { checkOutDate: null },
          { checkOutDate: { gte: now } }
        ]
      },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        campground: {
          select: { id: true, name: true, location: true, imageUrl: true, state: true }
        }
      }
    });
    
    // Get campgrounds from past stays/visits
    const stays = await prisma.stay.findMany({
      where: { userId },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        campground: {
          select: { id: true, name: true, location: true, imageUrl: true, state: true }
        }
      },
      orderBy: { startDate: "desc" }
    });
    
    // Combine and deduplicate
    const campgroundMap = new Map();
    activeCheckIns.forEach(c => campgroundMap.set(c.campground.id, { ...c.campground, source: "checked-in" }));
    follows.forEach(f => {
      if (!campgroundMap.has(f.campground.id)) {
        campgroundMap.set(f.campground.id, { ...f.campground, source: "following" });
      }
    });
    stays.forEach(s => {
      if (!campgroundMap.has(s.campground.id)) {
        campgroundMap.set(s.campground.id, { ...s.campground, source: "visited" });
      }
    });
    
    res.json(Array.from(campgroundMap.values()));
  } catch (error) {
    console.error("Get followed campgrounds error:", error);
    res.status(500).json({ error: "Failed to get followed campgrounds" });
  }
});

router.get('/favorites/my', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const favorites = await prisma.campgroundFollow.findMany({
      where: { userId },
      include: {
        campground: {
          include: {
            photos: { take: 1 },
            _count: { select: { followers: true, checkIns: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(favorites.map(f => f.campground));
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Favorite/Follow a campground
router.post('/:id/favorite', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const existing = await prisma.campgroundFollow.findUnique({
      where: {
        userId_campgroundId: {
          userId,
          campgroundId: id,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already following this campground' });
    }

    const follow = await prisma.campgroundFollow.create({
      data: {
        userId,
        campgroundId: id,
      },
    });

    res.json(follow);
  } catch (error) {
    console.error('Favorite campground error:', error);
    res.status(500).json({ error: 'Failed to favorite campground' });
  }
});

// Unfavorite/Unfollow a campground
router.delete('/:id/favorite', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    await prisma.campgroundFollow.deleteMany({
      where: {
        userId,
        campgroundId: id,
      },
    });

    res.json({ message: 'Unfollowed' });
  } catch (error) {
    console.error('Unfavorite campground error:', error);
    res.status(500).json({ error: 'Failed to unfavorite campground' });
  }
});

// Check if campground is favorited
router.get('/:id/is-favorited', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const follow = await prisma.campgroundFollow.findUnique({
      where: {
        userId_campgroundId: {
          userId,
          campgroundId: id,
        },
      },
    });

    res.json({ isFavorited: !!follow });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ error: 'Failed to check favorite status' });
  }
});

// Get campground followers list
router.get('/:id/followers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const followers = await prisma.campgroundFollow.findMany({
      where: { campgroundId: id },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: 'desc' },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            currentCampsite: true,
          }
        }
      }
    });

    const total = await prisma.campgroundFollow.count({
      where: { campgroundId: id }
    });

    res.json({
      followers: followers.map(f => f.user),
      total,
      hasMore: parseInt(offset as string) + followers.length < total
    });
  } catch (error) {
    console.error('Get campground followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

// UPDATE campground (ADMIN ONLY) - Must come before /:id GET route
router.put('/:id', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if campground exists
    const existing = await prisma.campground.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    const campground = await prisma.campground.update({
      where: { id },
      data: updateData
    });

    res.json(campground);
  } catch (error) {
    console.error('Update campground error:', error);
    res.status(500).json({ error: 'Failed to update campground' });
  }
});

// DELETE campground (ADMIN ONLY) - Must come before /:id GET route
router.delete('/:id', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if campground exists
    const existing = await prisma.campground.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    // Handle relations that don't have onDelete: Cascade
    // Nullify optional campground references
    await prisma.event.updateMany({ 
      where: { campgroundId: id },
      data: { campgroundId: null }
    });
    
    await prisma.activity.updateMany({ 
      where: { campgroundId: id },
      data: { campgroundId: null }
    });
    
    await prisma.creatorContent.updateMany({ 
      where: { campgroundId: id },
      data: { campgroundId: null }
    });
    
    await prisma.creatorContentTag.updateMany({ 
      where: { campgroundId: id },
      data: { campgroundId: null }
    });
    
    // Nullify stateVisit campsite reference
    await prisma.stateVisit.updateMany({ 
      where: { campsiteId: id },
      data: { campsiteId: null }
    });

    // Delete muted entities (uses entityId not campgroundId)
    // MutedEntity has onDelete: Cascade, handled automatically
    // await prisma.mutedEntity.deleteMany({ 
    //       where: { entityId: id, entityType: 'CAMPGROUND' } 
    //     });
    //     
    // Delete sticker-related records before deleting stickers
    const stickers = await prisma.sticker.findMany({ 
      where: { campgroundId: id }, 
      select: { id: true } 
    });
    const stickerIds = stickers.map(s => s.id);
    
    if (stickerIds.length > 0) {
      await prisma.userSticker.deleteMany({ where: { stickerId: { in: stickerIds } } });
      await prisma.stickerRequest.deleteMany({ where: { stickerId: { in: stickerIds } } });
    }

    // Delete the campground - Prisma cascade will handle the rest
    await prisma.campground.delete({
      where: { id }
    });

    res.json({ message: 'Campground deleted successfully' });
  } catch (error: any) {
    console.error('Delete campground error:', error);
    res.status(500).json({ error: 'Failed to delete campground', details: error.message });
  }
});

// Get campground by ID (MUST come last among GET routes)

// Get campground by ID (MUST come last among GET routes)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campground = await prisma.campground.findUnique({
      where: { id },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        checkIns: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { checkInDate: 'desc' },
        },
        stickers: {
          where: { isActive: true },
          include: {
            _count: {
              select: { userStickers: true },
            },
          },
        },
        _count: {
          select: {
            followers: true,
            checkIns: true,
            stickers: true,
          },
        },
      },
    });

    if (!campground) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    res.json(campground);
  } catch (error) {
    console.error('Get campground error:', error);
    res.status(500).json({ error: 'Failed to get campground' });
  }
});
// Get who's camping at this campground (current and upcoming)
router.get('/:id/campers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Collect unique campers
    const camperMap = new Map();

    // Get events at this campground (current and upcoming within 2 weeks)
    const events = await prisma.event.findMany({
      where: {
        campgroundId: id,
        endDate: { gte: now },
        startDate: { lte: twoWeeksFromNow },
        isWishlist: false,
      },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            showCampingStatus: true,
          }
        },
        attendees: {
          where: { status: 'GOING' },
          include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
                showCampingStatus: true,
              }
            }
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    // Add event organizers and attendees
    events.forEach(event => {
      if (event.organizer.showCampingStatus !== false) {
        const isCurrentlyHere = new Date(event.startDate) <= now && new Date(event.endDate) >= now;
        camperMap.set(event.organizer.id, {
          user: {
            id: event.organizer.id,
            firstName: event.organizer.firstName,
            lastName: event.organizer.lastName,
            username: event.organizer.username,
            profilePicture: event.organizer.profilePicture,
          },
          startDate: event.startDate,
          endDate: event.endDate,
          isCurrentlyHere,
          tripTitle: event.title,
        });
      }
      
      event.attendees.forEach(attendee => {
        if (attendee.user.showCampingStatus !== false && !camperMap.has(attendee.user.id)) {
          const isCurrentlyHere = new Date(event.startDate) <= now && new Date(event.endDate) >= now;
          camperMap.set(attendee.user.id, {
            user: {
              id: attendee.user.id,
              firstName: attendee.user.firstName,
              lastName: attendee.user.lastName,
              username: attendee.user.username,
              profilePicture: attendee.user.profilePicture,
            },
            startDate: event.startDate,
            endDate: event.endDate,
            isCurrentlyHere,
            tripTitle: event.title,
          });
        }
      });
    });

    // Get stays at this campground (current and upcoming within 2 weeks)
    const stays = await prisma.stay.findMany({
      where: {
        campgroundId: id,
        endDate: { gte: now },
        startDate: { lte: twoWeeksFromNow },
      },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            showCampingStatus: true,
          }
        },
        trip: {
          select: { name: true }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    // Add stay users
    stays.forEach(stay => {
      if (stay.user.showCampingStatus !== false && !camperMap.has(stay.user.id)) {
        const isCurrentlyHere = new Date(stay.startDate) <= now && new Date(stay.endDate) >= now;
        camperMap.set(stay.user.id, {
          user: {
            id: stay.user.id,
            firstName: stay.user.firstName,
            lastName: stay.user.lastName,
            username: stay.user.username,
            profilePicture: stay.user.profilePicture,
          },
          startDate: stay.startDate,
          endDate: stay.endDate,
          isCurrentlyHere,
          tripTitle: stay.trip?.name || 'Camping Trip',
        });
      }
    });

    // Get state visits at this campground (current and upcoming within 2 weeks)
    const stateVisits = await prisma.stateVisit.findMany({
      where: {
        campsiteId: id,
        OR: [
          { endDate: { gte: now } },
          { endDate: null, startDate: { lte: twoWeeksFromNow } }
        ],
        startDate: { lte: twoWeeksFromNow },
      },
      include: {
        claimedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            showCampingStatus: true,
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    // Add state visit users
    stateVisits.forEach(visit => {
      if (visit.user.showCampingStatus !== false && !camperMap.has(visit.user.id)) {
        const endDate = visit.endDate || new Date(new Date(visit.startDate).getTime() + 24 * 60 * 60 * 1000);
        const isCurrentlyHere = new Date(visit.startDate) <= now && endDate >= now;
        camperMap.set(visit.user.id, {
          user: {
            id: visit.user.id,
            firstName: visit.user.firstName,
            lastName: visit.user.lastName,
            username: visit.user.username,
            profilePicture: visit.user.profilePicture,
          },
          startDate: visit.startDate,
          endDate: endDate,
          isCurrentlyHere,
          tripTitle: visit.notes || 'State Visit',
        });
      }
    });

    const campers = Array.from(camperMap.values());
    
    // Sort: currently here first, then by start date
    campers.sort((a, b) => {
      if (a.isCurrentlyHere && !b.isCurrentlyHere) return -1;
      if (!a.isCurrentlyHere && b.isCurrentlyHere) return 1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    res.json({
      currentCampers: campers.filter(c => c.isCurrentlyHere),
      upcomingCampers: campers.filter(c => !c.isCurrentlyHere),
    });
  } catch (error) {
    console.error('Get campground campers error:', error);
    res.status(500).json({ error: 'Failed to get campers' });
  }
});

export default router;

