import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Helper function to geocode address
async function geocodeAddress(city: string, state: string, zipCode?: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const query = zipCode 
      ? `${city}, ${state} ${zipCode}, USA`
      : `${city}, ${state}, USA`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
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

    const cleanUsername = username.trim();
    console.log('Profile lookup for:', cleanUsername);
    const profile = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanUsername, mode: 'insensitive' } },
          { username: { equals: cleanUsername + ' ', mode: 'insensitive' } },
          { id: cleanUsername }
        ]
      },
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
        rvCoOwners: { select: { coOwner: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } } } },
        rvCoOwnedBy: { select: { owner: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true, rvMake: true, rvModel: true, rvYear: true, rvType: true, rvLength: true, rvDescription: true, rvFeatures: true, rvShowcase: true } } } },
        rvLength: true,
        rvSleeps: true,
        rvSlideouts: true,
        rvWeight: true,
        rvDescription: true,
        rvFeatures: true,
        campingInterests: true,
        rvMpg: true,
        rvFuelGal: true,
        rvFuelType: true,
        rvFreshWaterGal: true,
        rvGreyWaterGal: true,
        rvBlackWaterGal: true,
        rvLpGasGal: true,
        rvShorepower: true,
        rvGeneratorWatts: true,
        rvBatteryAh: true,
        rvSolarWatts: true,
        rvGvwr: true,
        rvHitchWeight: true,
        rvAxles: true,
        rvAwningFt: true,
        rvAirconditioners: true,
        rvFloorplan: true,
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
      bannerPosition,
      rvType,
      rvYear,
      rvMake,
      rvModel,
      rvLength,
      rvSleeps,
      rvSlideouts,
      rvWeight,
      rvWidth,
      rvHeight,
      rvOdometer,
      licensePlate,
      licensePlateState,
      tagExpiration,
      rvDescription,
      rvFeatures,
      rvMpg,
      rvFuelGal,
      rvFuelType,
      rvFreshWaterGal,
      rvGreyWaterGal,
      rvBlackWaterGal,
      rvLpGasGal,
      rvShorepower,
      rvGeneratorWatts,
      rvBatteryAh,
      rvSolarWatts,
      rvGvwr,
      rvHitchWeight,
      rvAxles,
      rvAwningFt,
      rvAirconditioners,
      rvFloorplan,
      showCampingStatus,
      homeCity,
      homeState,
      homeZipCode,
      travelPartyType,
      travelPartySize,
      hasPets,
      petTypes,
      campingInterests,
    } = req.body;

    // Verify the user is updating their own profile
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      
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
      where: { id: user.id },
      
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
        bannerPosition: bannerPosition !== undefined ? bannerPosition : undefined,
        rvType: rvType !== undefined ? rvType : undefined,
        rvYear: rvYear !== undefined ? (rvYear ? parseInt(rvYear) : null) : undefined,
        rvMake: rvMake !== undefined ? rvMake : undefined,
        rvModel: rvModel !== undefined ? rvModel : undefined,
        rvLength: rvLength !== undefined ? (rvLength ? parseInt(rvLength) : null) : undefined,
        rvSleeps: rvSleeps !== undefined ? (rvSleeps ? parseInt(rvSleeps) : null) : undefined,
        rvSlideouts: rvSlideouts !== undefined ? (rvSlideouts ? parseInt(rvSlideouts) : null) : undefined,
        rvWeight: rvWeight !== undefined ? (rvWeight ? parseInt(rvWeight) : null) : undefined,
        rvWidth: rvWidth !== undefined ? (rvWidth ? parseInt(rvWidth) : null) : undefined,
        rvHeight: rvHeight !== undefined ? (rvHeight ? parseInt(rvHeight) : null) : undefined,
        rvOdometer: rvOdometer !== undefined ? (rvOdometer ? parseInt(rvOdometer) : null) : undefined,
        licensePlate: licensePlate !== undefined ? licensePlate : undefined,
        licensePlateState: licensePlateState !== undefined ? licensePlateState : undefined,
        tagExpiration: tagExpiration !== undefined ? (tagExpiration ? new Date(tagExpiration) : null) : undefined,
        homeCity: homeCity !== undefined ? homeCity : undefined,
        homeState: homeState !== undefined ? homeState : undefined,
        homeZipCode: homeZipCode !== undefined ? homeZipCode : undefined,
        homeLatitude: homeLatitude !== undefined ? homeLatitude : undefined,
        homeLongitude: homeLongitude !== undefined ? homeLongitude : undefined,
        travelPartyType: travelPartyType !== undefined ? travelPartyType : undefined,
        travelPartySize: travelPartySize !== undefined ? travelPartySize : undefined,
        hasPets: hasPets !== undefined ? hasPets : undefined,
        petTypes: petTypes !== undefined ? { set: petTypes } : undefined,
        rvDescription: rvDescription !== undefined ? rvDescription : undefined,
        rvFeatures: rvFeatures !== undefined ? rvFeatures : undefined,
        campingInterests: campingInterests !== undefined ? campingInterests : undefined,
        rvMpg: rvMpg !== undefined ? (rvMpg ? parseFloat(rvMpg) : null) : undefined,
        rvFuelGal: rvFuelGal !== undefined ? (rvFuelGal ? parseFloat(rvFuelGal) : null) : undefined,
        rvFuelType: rvFuelType !== undefined ? rvFuelType : undefined,
        rvFreshWaterGal: rvFreshWaterGal !== undefined ? (rvFreshWaterGal ? parseFloat(rvFreshWaterGal) : null) : undefined,
        rvGreyWaterGal: rvGreyWaterGal !== undefined ? (rvGreyWaterGal ? parseFloat(rvGreyWaterGal) : null) : undefined,
        rvBlackWaterGal: rvBlackWaterGal !== undefined ? (rvBlackWaterGal ? parseFloat(rvBlackWaterGal) : null) : undefined,
        rvLpGasGal: rvLpGasGal !== undefined ? (rvLpGasGal ? parseFloat(rvLpGasGal) : null) : undefined,
        rvShorepower: rvShorepower !== undefined ? rvShorepower : undefined,
        rvGeneratorWatts: rvGeneratorWatts !== undefined ? (rvGeneratorWatts ? parseInt(rvGeneratorWatts) : null) : undefined,
        rvBatteryAh: rvBatteryAh !== undefined ? (rvBatteryAh ? parseInt(rvBatteryAh) : null) : undefined,
        rvSolarWatts: rvSolarWatts !== undefined ? (rvSolarWatts ? parseInt(rvSolarWatts) : null) : undefined,
        rvGvwr: rvGvwr !== undefined ? (rvGvwr ? parseInt(rvGvwr) : null) : undefined,
        rvHitchWeight: rvHitchWeight !== undefined ? (rvHitchWeight ? parseInt(rvHitchWeight) : null) : undefined,
        rvAxles: rvAxles !== undefined ? (rvAxles ? parseInt(rvAxles) : null) : undefined,
        rvAwningFt: rvAwningFt !== undefined ? (rvAwningFt ? parseFloat(rvAwningFt) : null) : undefined,
        rvAirconditioners: rvAirconditioners !== undefined ? (rvAirconditioners ? parseInt(rvAirconditioners) : null) : undefined,
        rvFloorplan: rvFloorplan !== undefined ? rvFloorplan : undefined,
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
        rvMpg: true,
        rvFuelGal: true,
        rvFuelType: true,
        rvFreshWaterGal: true,
        rvGreyWaterGal: true,
        rvBlackWaterGal: true,
        rvLpGasGal: true,
        rvShorepower: true,
        rvGeneratorWatts: true,
        rvBatteryAh: true,
        rvSolarWatts: true,
        rvGvwr: true,
        rvHitchWeight: true,
        rvAxles: true,
        rvAwningFt: true,
        rvAirconditioners: true,
        rvFloorplan: true,
        rvWidth: true,
        rvHeight: true,
        currentOdometer: true,
        aiMaintenanceEnabled: true,
        licensePlate: true,
        licensePlateState: true,
        tagExpiration: true,
        createdAt: true,
      },
    });

    res.json(updatedProfile);
  } catch (error: any) {
    console.error('Update profile error:', error?.message || error);
    res.status(500).json({ error: 'Failed to update profile', details: error?.message });
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

    // Get both users' details for the activity
    const acceptor = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, username: true } });
    const initiator = await prisma.user.findUnique({ where: { id: friendship.initiatorId }, select: { firstName: true, lastName: true, username: true } });
    const acceptorName = acceptor?.firstName ? `${acceptor.firstName} ${acceptor.lastName || ''}`.trim() : acceptor?.username || 'Someone';
    const initiatorName = initiator?.firstName ? `${initiator.firstName} ${initiator.lastName || ''}`.trim() : initiator?.username || 'Someone';

    // Create activity for the acceptor's feed
    await prisma.activity.create({
      data: {
        userId,
        type: 'FRIEND_ADDED',
        targetUserId: friendship.initiatorId,
        title: `${acceptorName} and ${initiatorName} are now friends!`,
        content: `${acceptorName} became camping buddies with ${initiatorName}`,
        isPublic: true,
      }
    });

    // Create activity for the initiator's feed
    await prisma.activity.create({
      data: {
        userId: friendship.initiatorId,
        type: 'FRIEND_ADDED',
        targetUserId: userId,
        title: `${initiatorName} and ${acceptorName} are now friends!`,
        content: `${initiatorName} became camping buddies with ${acceptorName}`,
        isPublic: true,
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

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      
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

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      
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

    let user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: username },
        select: { id: true },
      });
    }

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

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      
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

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      
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
    let profileOwner = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!profileOwner) {
      profileOwner = await prisma.user.findUnique({
        where: { id: username },
        select: { id: true },
      });
    }

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
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      
      select: { id: true },
    });

    if (!user || user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
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
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      
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
    const { username: usernameOrId } = req.params;
    let username = usernameOrId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = (req as any).userId;

    let user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: usernameOrId },
        select: { id: true },
      });
    }

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
          type: { notIn: ['MUTUAL_FRIEND_ADDED', 'NEW_CAMPING_BUDDY', 'FRIEND_REQUEST'] },
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
      RECIPE_SHARED: { label: 'shared a recipe', icon: '🍳', feedType: 'RECIPE' },
      RECIPE_SHARE_TAG: { label: 'shared a recipe with you', icon: '🏷️', feedType: 'RECIPE' },
      RECIPE_LIKED: { label: 'liked a recipe', icon: '❤️', feedType: 'RECIPE' },
      RECIPE_COMMENTED: { label: 'commented on a recipe', icon: '💬', feedType: 'RECIPE' },
      BADGE_EARNED: { label: 'earned a badge', icon: '🏆', feedType: 'BADGE' },
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

      // Extract imageUrl from metadata for photo activities (videoUrl added later)
      let imageUrl = null;
      let mediaIds: string[] = [];
      if (activity.type === 'BADGE_EARNED' && activity.metadata) {
        try {
          const meta = typeof activity.metadata === 'string' ? JSON.parse(activity.metadata) : activity.metadata;
          imageUrl = meta?.badgeImage || null;
          targetName = meta?.badgeName || 'a badge';
          targetLink = '/badges';
        } catch (e) {}
      }
      if (activity.type === 'PHOTO_UPLOADED' && activity.metadata) {
        try {
          const meta = typeof activity.metadata === 'string' ? JSON.parse(activity.metadata) : activity.metadata;
          imageUrl = meta?.previewUrl || null;
          mediaIds = meta?.mediaIds || [];
        } catch (e) {}
      }

      // For PHOTO_UPLOADED with albumId, set targetName and targetLink
      if (activity.type === 'PHOTO_UPLOADED' && activity.albumId) {
        targetName = activity.title || 'an album';
        targetLink = '/media-albums/' + activity.albumId;
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
        activityLabel: activity.albumId ? 'added a photo to' : config.label,
        campground: activity.campground,
        metadata: activity.metadata,
        imageUrl,
        mediaIds,
      };
    });

    // Fetch video URLs for activities that have media
    const mediaIdsToFetch = activityItems
      .filter(item => item.mediaIds && item.mediaIds.length > 0)
      .flatMap(item => item.mediaIds);
    
    let mediaMap: Record<string, { type: string; url: string; thumbnailUrl: string | null; likeCount: number; commentCount: number }> = {};
    if (mediaIdsToFetch.length > 0) {
      const mediaItems = await prisma.media.findMany({
        where: { id: { in: mediaIdsToFetch } },
        select: { 
          id: true, 
          type: true, 
          url: true, 
          thumbnailUrl: true,
          _count: { select: { MediaReaction: true, MediaComment: true } }
        }
      });
      mediaMap = Object.fromEntries(mediaItems.map(m => [m.id, { 
        ...m, 
        likeCount: m._count?.MediaReaction || 0, 
        commentCount: m._count?.MediaComment || 0 
      }]));
    }
    
    // Check which media the user has liked
    let userLikedMediaIds = new Set<string>();
    if (currentUserId && mediaIdsToFetch.length > 0) {
      const userReactions = await prisma.mediaReaction.findMany({
        where: { userId: currentUserId, mediaId: { in: mediaIdsToFetch } },
        select: { mediaId: true }
      });
      userLikedMediaIds = new Set(userReactions.map(r => r.mediaId));
    }

    // Add videoUrl and counts to activity items
    const enrichedActivityItems = activityItems.map(item => {
      let videoUrl = null;
      let mediaId = null;
      let mediaLikeCount = 0;
      let mediaCommentCount = 0;
      let userHasLikedMedia = false;
      if (item.mediaIds && item.mediaIds.length > 0) {
        mediaId = item.mediaIds[0];
        const media = mediaMap[mediaId];
        if (media) {
          mediaLikeCount = media.likeCount || 0;
          mediaCommentCount = media.commentCount || 0;
          userHasLikedMedia = userLikedMediaIds.has(mediaId);
          if (media.type === 'VIDEO') {
            videoUrl = media.url;
            item.imageUrl = media.thumbnailUrl || item.imageUrl;
          } else {
            // For photos, use the Cloudinary URL from Media record
            item.imageUrl = media.url || item.imageUrl;
          }
        }
      }
      return { ...item, videoUrl, mediaId, mediaLikeCount, mediaCommentCount, userHasLikedMedia };
    });

    // Get BasecampActivity items for own profile (thread replies, mentions, etc.)
    let basecampItems: any[] = [];
    if (isOwnProfile && currentUserId) {
      try {
        const basecampActivities = await prisma.basecampActivity.findMany({
          where: {
            userId: user.id,
            type: {
              in: ['THREAD_REPLY', 'THREAD_COMMENT', 'THREAD_MENTION', 'NEW_CAMPGROUND_THREAD', 'RECIPE_COMMENT_THREAD', 'RECIPE_MENTION', 'PHOTO_TAG']
            }
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
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

        basecampItems = basecampActivities.map((activity) => {
          const meta = (activity.metadata as any) || {};
          const isRecipe = ['RECIPE_COMMENT_THREAD', 'RECIPE_MENTION'].includes(activity.type);
          const isThread = ['THREAD_REPLY', 'THREAD_COMMENT', 'THREAD_MENTION', 'NEW_CAMPGROUND_THREAD'].includes(activity.type);
          
          let activityLabel = 'commented on';
          let activityIcon = '💬';
          if (activity.type === 'THREAD_REPLY') activityLabel = 'replied to your thread';
          else if (activity.type === 'THREAD_MENTION') { activityLabel = 'mentioned you in'; activityIcon = '📣'; }
          else if (activity.type === 'RECIPE_COMMENT_THREAD') { activityLabel = 'commented on your recipe'; activityIcon = '🍳'; }
          else if (activity.type === 'RECIPE_MENTION') { activityLabel = 'mentioned you in a comment on'; activityIcon = '📣'; }
          else if (activity.type === 'PHOTO_TAG') { activityLabel = 'tagged you in a photo'; activityIcon = '🏷️'; }
          
          const isPhotoTag = activity.type === 'PHOTO_TAG';
          return {
            id: `basecamp-${activity.id}`,
            type: activity.type,
            actor: activity.actor,
            content: `${activity.actor?.firstName || 'Someone'} ${activityLabel}${isPhotoTag ? '' : ` "${activity.entityName || meta.threadTitle || (isRecipe ? 'a recipe' : 'a thread')}"`}`,
            targetName: isPhotoTag ? 'a photo' : (activity.entityName || meta.threadTitle),
            targetLink: isPhotoTag ? `/media-albums/${meta.albumId}` : (isRecipe ? `/recipes/${activity.entityId}` : `/threads/${activity.entityId || meta.threadId}`),
            imageUrl: meta.imageUrl || null,
            createdAt: activity.createdAt,
            _count: { likes: 0, comments: 0 },
            canDelete: false,
            activityType: activity.type,
            activityIcon,
            activityLabel,
            isBasecampActivity: true,
            reaction: activity.reaction,
            metadata: meta,
            entityType: activity.entityType,
            entityId: activity.entityId,
          };
        });
      } catch (error) {
        console.log('BasecampActivity model not available');
      }
    }

    // Merge and sort all items by date
    const allItems = [...postItems, ...enrichedActivityItems, ...basecampItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const hasMore = allItems.length >= limit;
    const paginatedItems = allItems.slice(0, limit);

    // Enrich basecamp items with source like counts
    const enrichedItems = await Promise.all(paginatedItems.map(async (item: any) => {
      if (!item.isBasecampActivity) return item;
      
      const meta = item.metadata || {};
      let sourceLikeCount = 0;
      let sourceLikers: { id: string; firstName: string; lastName: string; username: string }[] = [];
      let userHasLiked = false;

      try {
        if (['THREAD_REPLY', 'THREAD_COMMENT', 'THREAD_MENTION'].includes(item.type)) {
          const postId = meta.postId || meta.replyId;
          if (postId) {
            const likes = await prisma.threadPostLike.findMany({
              where: { postId },
              include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
              take: 5,
              orderBy: { createdAt: 'desc' }
            });
            sourceLikeCount = await prisma.threadPostLike.count({ where: { postId } });
            sourceLikers = likes.map((l: any) => l.user);
            userHasLiked = currentUserId ? likes.some((l: any) => l.userId === currentUserId) : false;
          }
        }
      } catch (e) {
        // Silently fail
      }

      return {
        ...item,
        sourceLikeCount,
        sourceLikers,
        userHasLiked
      };
    }));

    res.json({
      feedItems: enrichedItems,
      hasMore,
      page,
    });
  } catch (error) {
    console.error('Get activity feed error:', error);
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

// GET /api/profile/:username/recipes - Get user's Recipe Box (uploaded, saved, liked)
router.get('/:username/recipes', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = (req as any).userId;

    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { id: username }] },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isOwnProfile = currentUserId === user.id;

    const recipeInclude = {
      user: {
        select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
      },
      _count: { select: { ratings: true, likes: true } }
    };

    // 1. Uploaded recipes (visible to everyone)
    const uploadedRecipes = await prisma.recipe.findMany({
      where: { userId: user.id },
      include: recipeInclude,
      orderBy: { createdAt: 'desc' }
    });

    const uploadedItems = uploadedRecipes.map(r => ({
      ...r,
      author: r.user,
      source: 'uploaded',
    }));

    // 2. Saved/bookmarked recipes (own profile only)
    let savedItems: any[] = [];
    if (isOwnProfile) {
      const savedRecipes = await prisma.savedRecipe.findMany({
        where: { userId: user.id },
        include: { recipe: { include: recipeInclude } },
        orderBy: { createdAt: 'desc' }
      });

      savedItems = savedRecipes
        .filter(sr => sr.recipe.userId !== user.id)
        .map(sr => ({
          ...sr.recipe,
          author: sr.recipe.user,
          isFavorite: sr.favorite,
          favorite: sr.favorite,
          savedRecipeId: sr.id,
          source: 'saved',
        }));
    }

    // 3. Liked/hearted recipes (own profile only)
    let likedItems: any[] = [];
    if (isOwnProfile) {
      const likedRecipes = await prisma.recipeLike.findMany({
        where: { userId: user.id },
        include: { recipe: { include: recipeInclude } },
        orderBy: { createdAt: 'desc' }
      });

      const uploadedIds = new Set(uploadedItems.map((r: any) => r.id));
      const savedIds = new Set(savedItems.map((r: any) => r.id));

      likedItems = likedRecipes
        .filter(lr => !uploadedIds.has(lr.recipe.id) && !savedIds.has(lr.recipe.id))
        .map(lr => ({
          ...lr.recipe,
          author: lr.recipe.user,
          source: 'liked',
        }));
    }

    res.json({
      recipes: [...uploadedItems, ...savedItems, ...likedItems],
      counts: {
        uploaded: uploadedItems.length,
        saved: savedItems.length,
        liked: likedItems.length,
      },
      profileName: `${user.firstName} ${user.lastName}`,
    });
  } catch (error) {
    console.error('Get user recipes error:', error);
    res.status(500).json({ error: 'Failed to get user recipes' });
  }
});


// PUT /api/profile/social-links - Update social links
router.put('/social-links', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { facebookUrl, instagramUrl, twitterUrl, redditUrl, tiktokUrl, youtubeUrl, blueskyUrl } = req.body;
    const data: any = {};
    if (facebookUrl !== undefined) data.facebookUrl = facebookUrl;
    if (instagramUrl !== undefined) data.instagramUrl = instagramUrl;
    if (twitterUrl !== undefined) data.twitterUrl = twitterUrl;
    if (redditUrl !== undefined) data.redditUrl = redditUrl;
    if (tiktokUrl !== undefined) data.tiktokUrl = tiktokUrl;
    if (youtubeUrl !== undefined) data.youtubeUrl = youtubeUrl;
    if (blueskyUrl !== undefined) data.blueskyUrl = blueskyUrl;
    const user = await prisma.user.update({ where: { id: userId }, data });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update social links error:', error);
    res.status(500).json({ error: 'Failed to update social links' });
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
