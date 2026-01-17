import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Helper function to geocode address
async function geocodeAddress(city: string, state: string, zipCode?: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const query = zipCode 
      ? \`\${city}, \${state} \${zipCode}, USA\`
      : \`\${city}, \${state}, USA\`;
    const url = \`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(query)}&limit=1\`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'RVUnicorn/1.0' }
    });
    const data = await response.json();
    
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// GET /api/profile/:username - Get user profile by username
router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = (req as any).userId;

    const profile = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: currentUserId ? true : false,
        profilePicture: true,
        coverPhoto: true,
        bio: true,
        location: true,
        website: true,
        facebookUrl: true,
        instagramUrl: true,
        tiktokUrl: true,
        redditUrl: true,
        youtubeUrl: true,
        twitterUrl: true,
        blueskyUrl: true,
        rvType: true,
        rvYear: true,
        showSocialOnProfile: true,
        showSocialOnCreator: true,
        rvMake: true,
        rvModel: true,
        rvLength: true,
        rvSleeps: true,
        rvSlideouts: true,
        rvWeight: true,
        rvDescription: true,
        rvFeatures: true,
        homeCity: true,
        homeState: true,
        homeZipCode: true,
        travelPartyType: true,
        travelPartySize: true,
        hasPets: true,
        petTypes: true,
        status: true,
        statusEmoji: true,
        statusType: true,
        currentCampsite: true,
        createdAt: true,
        isCreator: true,
        creatorVerified: true,
        creatorBio: true,
        creatorSpecialties: true,
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate total accepted friends
    const acceptedFriendships = await prisma.friendship.count({
      where: {
        OR: [
          { initiatorId: profile.id, status: 'ACCEPTED' },
          { receiverId: profile.id, status: 'ACCEPTED' }
        ]
      }
    });

    // Format the profile with friends count
    const formattedProfile = {
      ...profile,
      _count: {
        posts: profile._count.posts,
        friends: acceptedFriendships,
      },
    };

    res.json(formattedProfile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/profile/:username - Update user profile
router.put('/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const userId = (req as any).userId;
    const { 
      firstName, 
      lastName, 
      bio, 
      location, 
      website, 
      facebookUrl, 
      instagramUrl, 
      tiktokUrl, 
      redditUrl, 
      youtubeUrl,
      twitterUrl,
      blueskyUrl,
      profilePicture, 
      coverPhoto,
      rvType,
      rvYear,
      rvMake,
      rvModel,
      rvLength,
      rvSleeps,
      rvSlideouts,
      rvWeight,
      rvDescription,
      rvFeatures,
      showCampingStatus,
      homeCity,
      homeState,
      homeZipCode,
      travelPartyType,
      travelPartySize,
      hasPets,
      petTypes,
    } = req.body;

    // Verify the user is updating their own profile
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user || user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Geocode if homeCity or homeState changed
    let homeLatitude = undefined;
    let homeLongitude = undefined;
    if (homeCity !== undefined || homeState !== undefined) {
      const coords = await geocodeAddress(
        homeCity || '',
        homeState || '',
        homeZipCode
      );
      if (coords) {
        homeLatitude = coords.lat;
        homeLongitude = coords.lon;
      }
    }

    const updatedProfile = await prisma.user.update({
      where: { username },
      data: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        bio: bio !== undefined ? bio : undefined,
        location: location !== undefined ? location : undefined,
        website: website !== undefined ? website : undefined,
        facebookUrl: facebookUrl !== undefined ? facebookUrl : undefined,
        instagramUrl: instagramUrl !== undefined ? instagramUrl : undefined,
        tiktokUrl: tiktokUrl !== undefined ? tiktokUrl : undefined,
        redditUrl: redditUrl !== undefined ? redditUrl : undefined,
        youtubeUrl: youtubeUrl !== undefined ? youtubeUrl : undefined,
        twitterUrl: twitterUrl !== undefined ? twitterUrl : undefined,
        blueskyUrl: blueskyUrl !== undefined ? blueskyUrl : undefined,
        profilePicture: profilePicture !== undefined ? profilePicture : undefined,
        coverPhoto: coverPhoto !== undefined ? coverPhoto : undefined,
        rvType: rvType !== undefined ? rvType : undefined,
        rvYear: rvYear !== undefined ? rvYear : undefined,
        rvMake: rvMake !== undefined ? rvMake : undefined,
        rvModel: rvModel !== undefined ? rvModel : undefined,
        rvLength: rvLength !== undefined ? rvLength : undefined,
        rvSleeps: rvSleeps !== undefined ? rvSleeps : undefined,
        rvSlideouts: rvSlideouts !== undefined ? rvSlideouts : undefined,
        rvWeight: rvWeight !== undefined ? rvWeight : undefined,
        homeCity: homeCity !== undefined ? homeCity : undefined,
        homeState: homeState !== undefined ? homeState : undefined,
        homeZipCode: homeZipCode !== undefined ? homeZipCode : undefined,
        homeLatitude: homeLatitude !== undefined ? homeLatitude : undefined,
        homeLongitude: homeLongitude !== undefined ? homeLongitude : undefined,
        travelPartyType: travelPartyType !== undefined ? travelPartyType : undefined,
        travelPartySize: travelPartySize !== undefined ? travelPartySize : undefined,
        hasPets: hasPets !== undefined ? hasPets : undefined,
        petTypes: petTypes !== undefined ? petTypes : undefined,
        rvDescription: rvDescription !== undefined ? rvDescription : undefined,
        rvFeatures: rvFeatures !== undefined ? rvFeatures : undefined,
        showCampingStatus: showCampingStatus !== undefined ? showCampingStatus : undefined,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        coverPhoto: true,
        bio: true,
        location: true,
        website: true,
        facebookUrl: true,
        instagramUrl: true,
        tiktokUrl: true,
        redditUrl: true,
        youtubeUrl: true,
        twitterUrl: true,
        blueskyUrl: true,
        rvType: true,
        rvYear: true,
        rvMake: true,
        rvModel: true,
        rvLength: true,
        rvSleeps: true,
        rvSlideouts: true,
        rvWeight: true,
        rvDescription: true,
        rvFeatures: true,
        createdAt: true,
      },
    });

    res.json(updatedProfile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/profile/:userId/friend-request - Send friend request
router.post('/:userId/friend-request', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const initiatorId = (req as any).userId;

    if (userId === initiatorId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId, receiverId: userId },
          { initiatorId: userId, receiverId: initiatorId }
        ]
      }
    });

    if (existingFriendship) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    // Create friend request
    await prisma.friendship.create({
      data: {
        initiatorId,
        receiverId: userId,
        status: 'PENDING'
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: userId,
        type: 'FRIEND_REQUEST',
        content: 'sent you a friend request',
        link: `/friends/requests`,
      }
    });

    res.json({ success: true, message: 'Friend request sent' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// PUT /api/profile/:friendshipId/accept-friend - Accept friend request
router.put('/:friendshipId/accept-friend', authenticateToken, async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = (req as any).userId;

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (friendship.receiverId !== userId) {
      return res.status(403).json({ error: 'Not authorized to accept this request' });
    }

    // Update status to ACCEPTED
    await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' }
    });

    // Create notification for initiator
    await prisma.notification.create({
      data: {
        userId: friendship.initiatorId,
        type: 'FRIEND_ACCEPT',
        content: 'accepted your friend request',
        link: `/profile/${userId}`,
      }
    });

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// DELETE /api/profile/:friendshipId/reject-friend - Reject/Remove friend
router.delete('/:friendshipId/reject-friend', authenticateToken, async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = (req as any).userId;

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    // Only the receiver (for pending) or either party (for accepted) can delete
    if (friendship.receiverId !== userId && friendship.initiatorId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.friendship.delete({
      where: { id: friendshipId }
    });

    res.json({ success: true, message: 'Friendship removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// GET /api/profile/:userId/friendship-status - Check friendship status with another user
router.get('/:userId/friendship-status', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = (req as any).userId;

    if (userId === currentUserId) {
      return res.json({ status: 'SELF' });
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: currentUserId, receiverId: userId },
          { initiatorId: userId, receiverId: currentUserId }
        ]
      }
    });

    if (!friendship) {
      return res.json({ status: 'NONE', friendshipId: null });
    }

    res.json({ 
      status: friendship.status,
      friendshipId: friendship.id,
      isInitiator: friendship.initiatorId === currentUserId
    });
  } catch (error) {
    console.error('Check friendship status error:', error);
    res.status(500).json({ error: 'Failed to check friendship status' });
  }
});

// GET /api/profile/:username/states - Get user's visited states
router.get('/:username/states', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stateVisits = await prisma.stateVisit.findMany({
      where: { userId: user.id },
      select: { state: true },
      distinct: ['state'],
    });

    const states = stateVisits.map((visit) => visit.state);

    res.json({ states });
  } catch (error) {
    console.error('Get visited states error:', error);
    res.status(500).json({ error: 'Failed to get visited states' });
  }
});

// GET /api/profile/:username/stats - Get comprehensive camping statistics
router.get('/:username/stats', async (req, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, location: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get campgrounds visited (unique stays)
    const uniqueStays = await prisma.stay.findMany({
      where: { userId: user.id },
      distinct: ['campgroundId'],
      select: { campgroundId: true },
    });

    // Get total days camped
    const totalDays = await prisma.stay.count({
      where: { userId: user.id },
    });

    // Get future trips
    const futureTrips = await prisma.trip.count({
      where: {
        userId: user.id,
        startDate: { gte: new Date() },
      },
    });

    // Get unique people camped with
    const campedWith = await prisma.stateVisitAttendee.findMany({
      where: {
        stateVisit: {
          userId: user.id,
        },
      },
      distinct: ['attendeeId'],
      select: { attendeeId: true },
    });

    // Get meals cooked (from events)
    const mealsCooked = await prisma.event.count({
      where: {
        organizerId: user.id,
      },
    });

    // Get campsite reviews (using posts or comments)
    const reviews = await prisma.post.count({
      where: {
        userId: user.id,
      },
    });

    // Calculate miles traveled (simplified)
    const milesTraveled = 0;

    res.json({
      campgroundsVisited: uniqueStays.length,
      totalDaysCamped: totalDays,
      milesTraveled,
      futureTripsPlanned: futureTrips,
      peopleCampedWith: campedWith.length,
      mealsCooked,
      campsiteReviews: reviews,
    });
  } catch (error) {
    console.error('Get profile stats error:', error);
    res.status(500).json({ error: 'Failed to get profile stats' });
  }
});

// GET /api/profile/:username/friends - Get user's friends
router.get('/:username/friends', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get accepted friendships
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { initiatorId: user.id, status: 'ACCEPTED' },
          { receiverId: user.id, status: 'ACCEPTED' },
        ],
      },
      include: {
        initiator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        receiver: {
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

    // Extract friend data
    const friends = friendships.map((friendship) => {
      return friendship.initiatorId === user.id
        ? friendship.receiver
        : friendship.initiator;
    });

    res.json({ friends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

// GET /api/profile/:username/feed - Get user's activity feed
router.get('/:username/feed', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's posts and interactions
    const posts = await prisma.post.findMany({
      where: { userId: user.id },
      take: limit,
      orderBy: { createdAt: 'desc' },
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
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    res.json({ posts });
  } catch (error) {
    console.error('Get user feed error:', error);
    res.status(500).json({ error: 'Failed to get user feed' });
  }
});

// GET /api/profile/:username/gear - Get user's gear list
router.get('/:username/gear', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const gear = await prisma.gearItem.findMany({
      where: { userId: user.id },
      orderBy: { category: 'asc' },
    });

    res.json({ gear });
  } catch (error) {
    console.error('Get gear error:', error);
    res.status(500).json({ error: 'Failed to get gear' });
  }
});

// POST /api/profile/:username/wall-post - Post to someone's wall
router.post('/:username/wall-post', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const { content, imageUrl } = req.body;
    const userId = (req as any).userId;

    if ((!content || !content.trim()) && !imageUrl) {
      return res.status(400).json({ error: 'Content or image is required' });
    }

    // Get the profile owner
    const profileOwner = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!profileOwner) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create the wall post
    // If posting on someone else's wall, set wallOwnerId
    // If posting on own wall, wallOwnerId is null
    const isOwnWall = profileOwner.id === userId;
    
    const post = await prisma.post.create({
      data: {
        content: content?.trim() || '',
        imageUrl: imageUrl || null,
        userId,
        wallOwnerId: isOwnWall ? null : profileOwner.id,
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

    // Create a notification for the profile owner (only if posting on someone else's wall)
    if (!isOwnWall) {
      await prisma.notification.create({
        data: {
          userId: profileOwner.id,
          type: 'WALL_POST',
          content: 'posted on your wall',
          link: `/profile/${username}`,
        },
      });
    }

    res.json(post);
  } catch (error) {
    console.error('Wall post error:', error);
    res.status(500).json({ error: 'Failed to create wall post' });
  }
});

// PUT /api/profile/:username/status - Update user status
router.put('/:username/status', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const userId = (req as any).userId;
    const { status, statusEmoji, statusType } = req.body;

    // Verify the user is updating their own status
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user || user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update status
    const updatedUser = await prisma.user.update({
      where: { username },
      data: {
        status: status || null,
        statusEmoji: statusEmoji || null,
        statusType: statusType || null,
      },
      select: {
        id: true,
        username: true,
        status: true,
        statusEmoji: true,
        statusType: true,
      },
    });

    // Create activity for status update
    if (status) {
      try {
        await prisma.activity.create({
          data: {
            userId,
            type: 'STATUS_UPDATE',
            content: `${statusEmoji || ''} ${status}`.trim(),
            isPublic: true,
          },
        });
      } catch (e) {
        console.error('Failed to create status activity:', e);
      }
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /api/profile/:username/status/auto - Enable automatic status updates
router.post('/:username/status/auto', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const userId = (req as any).userId;

    // Verify the user is updating their own status
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user || user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check for active camping events
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activeEvent = await prisma.eventAttendee.findFirst({
      where: {
        userId: user.id,
        status: 'ATTENDING',
        event: {
          startDate: { lte: tomorrow },
          endDate: { gte: today },
        },
      },
      include: {
        event: {
          include: {
            campground: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    let newStatus = 'Home';
    let newEmoji = '🏠';
    let newType = 'AUTO_HOME';
    let currentCampsite = null;

    if (activeEvent) {
      newStatus = 'Camping';
      newEmoji = '🏕️';
      newType = 'AUTO_CAMPING';
      currentCampsite = activeEvent.event.campground?.name || null;
    }

    // Update status
    const updatedUser = await prisma.user.update({
      where: { username },
      data: {
        status: newStatus,
        statusEmoji: newEmoji,
        statusType: newType,
        currentCampsite: currentCampsite,
      },
      select: {
        id: true,
        username: true,
        status: true,
        statusEmoji: true,
        statusType: true,
        currentCampsite: true,
      },
    });

    // Create activity for status update
    if (status) {
      try {
        await prisma.activity.create({
          data: {
            userId,
            type: 'STATUS_UPDATE',
            content: `${statusEmoji || ''} ${status}`.trim(),
            isPublic: true,
          },
        });
      } catch (e) {
        console.error('Failed to create status activity:', e);
      }
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Enable auto status error:', error);
    res.status(500).json({ error: 'Failed to enable automatic status' });
  }
});

// GET /api/profile/:username/activity-feed - Get comprehensive activity feed
router.get('/:username/activity-feed', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = (req as any).userId;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isOwnProfile = currentUserId === user.id;

    // Get posts ON the user's wall (their own posts + posts others made on their wall)
    const posts = await prisma.post.findMany({
      where: {
        OR: [
          // Posts by the user on their own wall (wallOwnerId is null)
          { userId: user.id, wallOwnerId: null },
          // Posts by others on this user's wall
          { wallOwnerId: user.id },
        ],
      },
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
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
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    // Get muted entities for current user (only if viewing own profile)
    let mutedCampgroundIds: string[] = [];
    if (isOwnProfile && currentUserId) {
      const mutedEntities = await prisma.mutedEntity.findMany({
        where: { userId: currentUserId },
        select: { mutedCampgroundId: true }
      });
      mutedCampgroundIds = mutedEntities.filter(m => m.mutedCampgroundId).map(m => m.mutedCampgroundId as string);
    }

    // Get activities from the Activity model
    let activities: any[] = [];
    try {
      activities = await prisma.activity.findMany({
        where: {
          OR: [
            { userId: user.id },
            { targetUserId: user.id, ...(mutedCampgroundIds.length > 0 ? { campgroundId: { notIn: mutedCampgroundIds } } : {}) },
          ],
          ...(isOwnProfile ? {} : { isPublic: true })
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
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
          thread: {
            select: { id: true, title: true }
          },
          event: {
            select: { id: true, title: true }
          },
          recipe: {
            select: { id: true, title: true }
          },
          campground: {
            select: { id: true, name: true, location: true, state: true }
          },
          targetUser: {
            select: { id: true, firstName: true, lastName: true, username: true }
          }
        },
      });
    } catch (error) {
      // Activity model might not exist yet, that's okay
      console.log('Activity model not available yet');
    }

    // Activity type configuration
    const ACTIVITY_CONFIG: Record<string, { label: string; icon: string; feedType: string }> = {
      THREAD_CREATED: { label: 'started a discussion', icon: '💬', feedType: 'THREAD' },
      THREAD_POST: { label: 'replied to a discussion', icon: '💭', feedType: 'THREAD' },
      EVENT_CREATED: { label: 'created an event', icon: '📅', feedType: 'EVENT' },
      EVENT_JOINED: { label: 'is going to an event', icon: '✅', feedType: 'EVENT' },
      RECIPE_CREATED: { label: 'shared a recipe', icon: '🍳', feedType: 'RECIPE' },
      MEAL_PLAN_CREATED: { label: 'planned a meal', icon: '🍽️', feedType: 'MEAL' },
      PROFILE_UPDATE: { label: 'updated their profile', icon: '✏️', feedType: 'PROFILE' },
      WALL_POST: { label: 'posted on', icon: '📝', feedType: 'WALL' },
      CHECK_IN: { label: 'checked in at', icon: '📍', feedType: 'CHECKIN' },
      CAMPGROUND_REVIEW: { label: 'reviewed', icon: '⭐', feedType: 'REVIEW' },
      PHOTO_UPLOADED: { label: 'added a photo', icon: '📷', feedType: 'PHOTO' },
      FRIEND_ADDED: { label: 'became friends with', icon: '🤝', feedType: 'FRIEND' },
      GEAR_ADDED: { label: 'added gear to their kit', icon: '🎒', feedType: 'GEAR' },
      CAMPGROUND_ANNOUNCEMENT: { label: 'announced at', icon: '📢', feedType: 'CAMPGROUND_ANNOUNCEMENT' },
      PACKING_FOR_TRIP: { label: 'is packing for a camping trip! 🎒', icon: '🎒', feedType: 'PACKING' },
      CREATOR_VIDEO_UPLOAD: { label: 'uploaded a new video', icon: '🎬', feedType: 'CREATOR_VIDEO_UPLOAD' },
      CREATOR_VIDEO_UPLOAD: { label: 'uploaded a new video', icon: '🎬', feedType: 'CREATOR_VIDEO_UPLOAD' },
      SHARED_CREATOR_VIDEO: { label: 'shared a video', icon: '🔄', feedType: 'SHARED_CREATOR_VIDEO' },
      NEW_CAMPING_BUDDY: { label: '', icon: '🏕️', feedType: 'FRIEND' },
    };     

    // Transform posts into feed items
    const postItems = posts.map((post) => ({
      id: post.id,
      type: 'POST',
      actor: post.user,
      content: post.content,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      _count: post._count,
      canDelete: isOwnProfile || currentUserId === post.userId,
    }));

    // Transform activities into feed items
    const activityItems = activities.map((activity) => {
      const config = ACTIVITY_CONFIG[activity.type] || { label: 'did something', icon: '📌', feedType: 'OTHER' };
      
      // Determine target name and link
      let targetName = '';
      let targetLink = '';
      
      if (activity.thread) {
        targetName = activity.thread.title;
        targetLink = `/threads/${activity.thread.id}`;
      } else if (activity.event) {
        targetName = activity.event.title;
        targetLink = `/events/${activity.event.id}`;
      } else if (activity.recipe) {
        targetName = activity.recipe.title;
        targetLink = `/recipes/${activity.recipe.id}`;
      } else if (activity.campground) {
        targetName = activity.campground.name;
        targetLink = `/campgrounds/${activity.campground.id}`;
      } else if (activity.targetUser) {
        targetName = `${activity.targetUser.firstName}'s wall`;
        targetLink = `/profile/${activity.targetUser.username}`;
      } else if (activity.title) {
      } else if (activity.type === "CREATOR_VIDEO_UPLOAD" && activity.metadata) {
        try {
          const meta = typeof activity.metadata === "string" ? JSON.parse(activity.metadata) : activity.metadata;
          targetName = meta.title || "Untitled";
          targetLink = `/creators/${activity.user.username}/content/${meta.contentId}`;
        } catch (e) {
          targetName = "a video";
        }
      } else if (activity.type === "SHARED_CREATOR_VIDEO" && activity.metadata) {
        try {
          const meta = typeof activity.metadata === "string" ? JSON.parse(activity.metadata) : activity.metadata;
          targetName = meta.title || "Untitled";
          targetLink = `/creators/${meta.originalCreatorUsername || activity.user.username}/content/${meta.contentId}`;
        } catch (e) {
          targetName = "a video";
        }
        targetName = activity.title;
      }

      return {
        id: `activity-${activity.id}`,
        type: config.feedType,
        actor: activity.user,
        content: activity.content || null,
        title: activity.title,
        targetName,
        targetLink,
        createdAt: activity.createdAt,
        _count: { likes: 0, comments: 0 },
        canDelete: isOwnProfile,
        activityType: activity.type,
        activityIcon: config.icon,
        activityLabel: config.label,
        campground: activity.campground,
        metadata: activity.metadata,
      };
    });

    // Merge and sort all items by date
    const allItems = [...postItems, ...activityItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const hasMore = allItems.length >= limit;

    res.json({
      feedItems: allItems.slice(0, limit),
      hasMore,
      page,
    });
  } catch (error) {
    console.error('Get activity feed error:', error);
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

// GET /api/profile/:username/recipes - Get user's saved recipes (Recipe Box)
router.get('/:username/recipes', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = (req as any).userId;

    // Get user
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only show saved recipes if viewing own profile
    if (currentUserId !== user.id) {
      return res.json({ recipes: [] });
    }

    // Get user's saved recipes from SavedRecipe table
    const savedRecipes = await prisma.savedRecipe.findMany({
      where: { userId: user.id },
      include: {
        recipe: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              }
            },
            _count: {
              select: {
                ratings: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform to match expected format
    const transformedRecipes = savedRecipes.map(savedRecipe => ({
      ...savedRecipe.recipe,
      author: savedRecipe.recipe.user,
      isFavorite: savedRecipe.favorite,
      favorite: savedRecipe.favorite,
      savedRecipeId: savedRecipe.id,
    }));

    res.json({ recipes: transformedRecipes });
  } catch (error) {
    console.error('Get user recipes error:', error);
    res.status(500).json({ error: 'Failed to get user recipes' });
  }
});

export default router;

// GET /api/profile/suggested-tags - Get suggested tags based on user's RV profile and packing list
router.get('/suggested-tags', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        rvMake: true,
        rvModel: true,
        rvType: true,
        rvFeatures: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's pack items
    const packItems = await prisma.personalPackItem.findMany({
      where: { userId },
      select: { name: true, category: true },
      take: 100,
    });

    const suggestedTags: string[] = [];

    // Add RV type
    if (user.rvType) {
      suggestedTags.push(user.rvType);
    }

    // Map RV makes to tags
    const rvMakeTags: { [key: string]: string } = {
      'Airstream': 'Airstream',
      'Winnebago': 'Winnebago',
      'Jayco': 'Jayco',
      'Forest River': 'Forest River',
      'Thor': 'Thor Motor Coach',
      'Thor Motor Coach': 'Thor Motor Coach',
      'Grand Design': 'Grand Design RV',
      'Coachmen': 'Coachmen',
      'Keystone': 'Keystone RV',
      'Newmar': 'Newmar',
      'Tiffin': 'Tiffin',
      'Entegra': 'Entegra Coach',
      'Fleetwood': 'Fleetwood RV',
      'Heartland': 'Heartland RV',
      'Lance': 'Lance Campers',
      'Oliver': 'Oliver Travel Trailers',
      'nuCamp': 'nuCamp',
      'Storyteller': 'Storyteller Overland',
      'EarthRoamer': 'EarthRoamer',
    };

    if (user.rvMake) {
      for (const [key, tag] of Object.entries(rvMakeTags)) {
        if (user.rvMake.toLowerCase().includes(key.toLowerCase())) {
          suggestedTags.push(tag);
          break;
        }
      }
    }

    // Add features as tags if they match known tags
    const featureTags = ['Solar', 'Lithium', 'Off-Grid', 'Pet Friendly', 'Full-Time RV'];
    if (user.rvFeatures) {
      user.rvFeatures.forEach((feature: string) => {
        featureTags.forEach(tag => {
          if (feature.toLowerCase().includes(tag.toLowerCase())) {
            suggestedTags.push(tag);
          }
        });
      });
    }

    // Brand tags to look for in pack items
    const brandTags: { [key: string]: string } = {
      'yeti': 'YETI',
      'rtic': 'RTIC',
      'coleman': 'Coleman',
      'rei': 'REI Co-op',
      'blackstone': 'Blackstone',
      'camp chef': 'Camp Chef',
      'traeger': 'Traeger',
      'weber': 'Weber',
      'jackery': 'Jackery',
      'goal zero': 'Goal Zero',
      'ecoflow': 'EcoFlow',
      'bluetti': 'Bluetti',
      'renogy': 'Renogy',
      'dometic': 'Dometic',
      'camco': 'Camco',
      'big agnes': 'Big Agnes',
      'kelty': 'Kelty',
      'helinox': 'Helinox',
      'jetboil': 'Jetboil',
      'msr': 'MSR',
      'nemo': 'Nemo Equipment',
      'therm-a-rest': 'Therm-a-Rest',
      'patagonia': 'Patagonia',
      'columbia': 'Columbia',
      'north face': 'The North Face',
      'garmin': 'Garmin',
      'stanley': 'Stanley',
      'hydroflask': 'Hydro Flask',
      'hydro flask': 'Hydro Flask',
    };

    // Check pack items for brand mentions
    packItems.forEach(item => {
      const itemName = item.name.toLowerCase();
      for (const [brand, tag] of Object.entries(brandTags)) {
        if (itemName.includes(brand)) {
          suggestedTags.push(tag);
        }
      }
    });

    // Check categories for activity suggestions
    const categoryTags: { [key: string]: string } = {
      'fishing': 'Fishing',
      'hiking': 'Hiking',
      'cooking': 'Cooking',
      'grilling': 'Blackstone',
      'pets': 'Pet Friendly',
      'pet': 'Pet Friendly',
      'dog': 'Pet Friendly',
      'solar': 'Solar',
      'power': 'Off-Grid',
    };

    packItems.forEach(item => {
      const category = item.category.toLowerCase();
      const itemName = item.name.toLowerCase();
      for (const [key, tag] of Object.entries(categoryTags)) {
        if (category.includes(key) || itemName.includes(key)) {
          suggestedTags.push(tag);
        }
      }
    });

    res.json({ suggestedTags: [...new Set(suggestedTags)] });
  } catch (error) {
    console.error('Get suggested tags error:', error);
    res.status(500).json({ error: 'Failed to get suggested tags' });
  }
});

// GET /api/profile/:userId/home-location - Get user's home location for map
router.get('/:userId/home-location', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get the requesting user if authenticated
    let requestingUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        requestingUserId = (decoded as any).userId;
      } catch (e) {
        // Not authenticated, that's okay
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        homeCity: true,
        homeState: true,
        homeLatitude: true,
        homeLongitude: true,

      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy settings
    const privacy = 'PUBLIC'; // TODO: Add hometownPrivacy field to schema
    
    // If private, only show to self
    if (privacy === 'PRIVATE' && requestingUserId !== userId) {
      return res.json({ visible: false });
    }
    
    // If friends only, check friendship
    if (privacy === 'FRIENDS' && requestingUserId !== userId) {
      if (!requestingUserId) {
        return res.json({ visible: false });
      }
      
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: requestingUserId, addresseeId: userId, status: 'ACCEPTED' },
            { requesterId: userId, addresseeId: requestingUserId, status: 'ACCEPTED' },
          ]
        }
      });
      
      if (!friendship) {
        return res.json({ visible: false });
      }
    }

    // Return home location if coordinates exist
    if (user.homeLatitude && user.homeLongitude) {
      res.json({
        visible: true,
        homeCity: user.homeCity,
        homeState: user.homeState,
        homeLatitude: user.homeLatitude,
        homeLongitude: user.homeLongitude,
      });
    } else {
      res.json({ visible: false });
    }
  } catch (error) {
    console.error('Get home location error:', error);
    res.status(500).json({ error: 'Failed to get home location' });
  }
});
