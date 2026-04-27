import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import { recalculateCampgroundRatings } from '../services/campgroundRatingService';

const SITE_ADMIN_IDS = ['cmlpeyk82005s3qause3sws7y', 'cmm9kukta0006i88masvtz2tp'];

const router = Router();
const prisma = new PrismaClient() as any;

// File upload setup - memory storage for Cloudinary
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============== USER RATINGS (must be before /:campgroundId catch-all) ==============

// Get all ratings by a specific user (public profile data)
router.get('/user/:userId/ratings', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const ratings = await prisma.campgroundReview.findMany({
      where: { userId },
      select: {
        campgroundId: true,
        rating: true,
        title: true,
        review: true,
        visitDate: true,
        createdAt: true,
        noise: true,
        levelness: true,
        cellService: true,
        bigRigFriendly: true,
        wouldReturn: true,
      },
    });
    res.json(ratings);
  } catch (error: any) {
    console.error('Get user ratings error:', error);
    res.status(500).json({ error: 'Failed to get user ratings' });
  }
});

// ============== REVIEWS ==============

// Get reviews for a campground
router.get('/:campgroundId/reviews', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const reviews = await prisma.campgroundReview.findMany({
      where: { campgroundId },
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
      orderBy: { createdAt: 'desc' },
    });

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: any, r: any) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({ reviews, averageRating: avgRating, totalReviews: reviews.length });
  } catch (error: any) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// Create a review. Accepts the basic rating + free-text fields plus the
// rich category fields the schema already supports (noise, levelness,
// cellService, etc.). The post-trip survey modal in the Echo banner
// posts the rich fields here so we can hand structured insight back to
// campsite operators — that's the whole point of the 24h Hitch prompt.
router.post('/:campgroundId/reviews', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;
    const {
      rating,
      title,
      review,
      visitDate,
      // Rich category fields — all optional
      accessDifficulty,
      levelness,
      noise,
      cellService,
      bigRigFriendly,
      petFriendly,
      bestSiteNumber,
      wouldReturn,
    } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Only persist string fields when they're actually strings — keeps
    // bad client payloads from blowing up the prisma call.
    const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const richFields = {
      accessDifficulty: str(accessDifficulty),
      levelness: str(levelness),
      noise: str(noise),
      cellService: str(cellService),
      bigRigFriendly: str(bigRigFriendly),
      petFriendly: str(petFriendly),
      bestSiteNumber: str(bestSiteNumber),
      wouldReturn: str(wouldReturn),
    };

    // Check if user already reviewed
    const existing = await prisma.campgroundReview.findUnique({
      where: { campgroundId_userId: { campgroundId, userId } },
    });

    if (existing) {
      // Update existing review
      const updated = await prisma.campgroundReview.update({
        where: { id: existing.id },
        data: {
          rating,
          title,
          review,
          visitDate: visitDate ? new Date(visitDate) : null,
          ...richFields,
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
          },
        },
      });
      await recalculateCampgroundRatings(campgroundId);
      return res.json(updated);
    }

    const newReview = await prisma.campgroundReview.create({
      data: {
        campgroundId,
        userId,
        rating,
        title,
        review,
        visitDate: visitDate ? new Date(visitDate) : null,
        ...richFields,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
      },
    });

    await recalculateCampgroundRatings(campgroundId);
    res.status(201).json(newReview);
  } catch (error: any) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Delete a review
router.delete('/:campgroundId/reviews/:reviewId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).userId;

    const review = await prisma.campgroundReview.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.campgroundReview.delete({ where: { id: reviewId } });
    await recalculateCampgroundRatings(req.params.campgroundId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ============== PHOTOS ==============

// Get approved photos for a campground
router.get('/:campgroundId/photos', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const photos = await prisma.campgroundPhoto.findMany({
      where: { campgroundId, status: 'APPROVED' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(photos);
  } catch (error: any) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

// Get pending photos (for admins)
router.get('/:campgroundId/photos/pending', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;

    // Check if user is admin
    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const photos = await prisma.campgroundPhoto.findMany({
      where: { campgroundId, status: 'PENDING' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(photos);
  } catch (error: any) {
    console.error('Get pending photos error:', error);
    res.status(500).json({ error: 'Failed to get pending photos' });
  }
});

// Submit a photo
router.post('/:campgroundId/photos', authenticateToken, upload.single('photo'), async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;
    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required' });
    }

    // Check if user is admin
    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });

    // Get campground tier
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { tier: true }
    });

    const tier = campground?.tier || 'FREE';

    // Photo limits by tier (for admin/official photos)
    const photoLimits: Record<string, number> = {
      FREE: 4,
      CLASS_C: 50,
      CLASS_B: 100,
      CLASS_A: 999999 // Unlimited
    };

    // If admin uploading, check tier limits for official photos
    if (isAdmin) {
      const currentPhotoCount = await prisma.campgroundPhoto.count({
        where: {
          campgroundId,
          status: 'APPROVED'
        }
      });

      const limit = photoLimits[tier] || 4;
      if (currentPhotoCount >= limit) {
        return res.status(403).json({
          error: `Photo limit reached. ${tier === 'FREE' ? 'Free tier allows 4 photos. Upgrade for more.' : `Your tier allows ${limit} photos.`}`,
          limit,
          used: currentPhotoCount
        });
      }
    }

    // Auto-approve if uploaded by admin, otherwise pending
    const status = isAdmin ? 'APPROVED' : 'PENDING';

    // Upload to Cloudinary
    const imageUrl = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/campground-photos');

    const photo = await prisma.campgroundPhoto.create({
      data: {
        campgroundId,
        userId,
        imageUrl,
        caption,
        status,
        reviewedBy: isAdmin ? userId : null,
        reviewedAt: isAdmin ? new Date() : null,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
      },
    });

    res.status(201).json(photo);
  } catch (error: any) {
    console.error('Submit photo error:', error);
    res.status(500).json({ error: 'Failed to submit photo' });
  }
});

// Approve/Reject a photo (admin only)
router.put('/:campgroundId/photos/:photoId/review', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId, photoId } = req.params;
    const userId = (req as any).userId;
    const { status } = req.body; // APPROVED or REJECTED

    // Check if user is admin
    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const photo = await prisma.campgroundPhoto.update({
      where: { id: photoId },
      data: { status, reviewedBy: userId, reviewedAt: new Date() },
    });

    res.json(photo);
  } catch (error: any) {
    console.error('Review photo error:', error);
    res.status(500).json({ error: 'Failed to review photo' });
  }
});

// Delete a photo (admin only)
router.delete('/:campgroundId/photos/:photoId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId, photoId } = req.params;
    const userId = (req as any).userId;

    // Check if user is admin
    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.campgroundPhoto.delete({
      where: { id: photoId },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// Set a photo as the campground banner
router.put('/:campgroundId/photos/:photoId/set-banner', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId, photoId } = req.params;
    const userId = (req as any).userId;

    // Check if user is admin
    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get the photo
    const photo = await prisma.campgroundPhoto.findUnique({
      where: { id: photoId },
    });
    if (!photo || photo.campgroundId !== campgroundId) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Update campground with the photo URL as banner
    const campground = await prisma.campground.update({
      where: { id: campgroundId },
      data: { imageUrl: photo.imageUrl },
    });

    res.json({ success: true, imageUrl: campground.imageUrl });
  } catch (error: any) {
    console.error('Set banner error:', error);
    res.status(500).json({ error: 'Failed to set banner' });
  }
});

// ============== EVENTS ==============

// Get events for a campground
router.get('/:campgroundId/events', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const events = await prisma.campgroundEvent.findMany({
      where: { 
        campgroundId,
        startDate: { gte: new Date() }, // Only future events
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });
    res.json(events);
  } catch (error: any) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Create an event (admin only)
router.post('/:campgroundId/events', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;
    const { title, description, imageUrl, startDate, endDate, location, isRecurring } = req.body;

    // Check if user is admin
    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const event = await prisma.campgroundEvent.create({
      data: {
        campgroundId,
        createdById: userId,
        title,
        description,
        imageUrl,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location,
        isRecurring: isRecurring || false,
      },
    });

    res.status(201).json(event);
  } catch (error: any) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Delete an event (admin only)
router.delete('/:campgroundId/events/:eventId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId, eventId } = req.params;
    const userId = (req as any).userId;

    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.campgroundEvent.delete({ where: { id: eventId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ============== ANNOUNCEMENTS ==============

// Get announcements for a campground
router.get('/:campgroundId/announcements', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { includeScheduled } = req.query; // For admin view
    const now = new Date();

    const whereClause: any = { 
      campgroundId,
      // Only show published announcements (unless admin requesting all)
      ...(includeScheduled !== 'true' && {
        isPublished: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      })
    };

    const announcements = await prisma.campgroundAnnouncement.findMany({
      where: whereClause,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { priority: 'desc' }, // URGENT > IMPORTANT > NORMAL > LOW
        { createdAt: 'desc' }
      ],
    });

    // Increment view count for published announcements
    if (includeScheduled !== 'true' && announcements.length > 0) {
      await prisma.campgroundAnnouncement.updateMany({
        where: { id: { in: announcements.map((a: any) => a.id) } },
        data: { viewCount: { increment: 1 } }
      });
    }

    res.json(announcements);
  } catch (error: any) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Failed to get announcements' });
  }
});

// Get featured announcements (pinned or urgent/important) - for banner display
router.get('/:campgroundId/announcements/featured', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const now = new Date();

    // Check if campground is Class B or Class A
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { tier: true }
    });

    // Only return featured announcements for Class B+ campgrounds
    if (!campground || (campground.tier !== 'CLASS_B' && campground.tier !== 'CLASS_A')) {
      return res.json([]);
    }

    const featuredAnnouncements = await prisma.campgroundAnnouncement.findMany({
      where: {
        campgroundId,
        isPublished: true,
        OR: [
          { isPinned: true },
          { priority: 'URGENT' },
          { priority: 'IMPORTANT' }
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } }
            ]
          }
        ]
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
      },
      orderBy: [
        { priority: 'desc' }, // URGENT first, then IMPORTANT
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 3, // Limit to 3 featured announcements max
    });

    res.json(featuredAnnouncements);
  } catch (error: any) {
    console.error('Get featured announcements error:', error);
    res.status(500).json({ error: 'Failed to get featured announcements' });
  }
});

// Create an announcement (admin only)
router.post('/:campgroundId/announcements', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;
    const { title, content, imageUrl, isPinned, priority, scheduledAt, expiresAt } = req.body;

    // Check if user is admin
    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get campground with tier info
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, name: true, tier: true, location: true, city: true, state: true }
    });

    const tier = campground?.tier || 'FREE';
    const tierLevel: Record<string, number> = { FREE: 0, CLASS_C: 1, CLASS_B: 2, CLASS_A: 3 };

    // Tier-based feature validation
    const canPin = tierLevel[tier] >= 1; // Class C+
    const canSetPriority = tierLevel[tier] >= 1; // Class C+
    const canSchedule = tierLevel[tier] >= 2; // Class B+

    // Validate tier restrictions
    if (isPinned && !canPin) {
      return res.status(403).json({ 
        error: 'Pinning announcements requires Class C or higher.',
        requiredTier: 'CLASS_C'
      });
    }

    if (priority && priority !== 'NORMAL' && !canSetPriority) {
      return res.status(403).json({ 
        error: 'Priority levels require Class C or higher.',
        requiredTier: 'CLASS_C'
      });
    }

    if (scheduledAt && !canSchedule) {
      return res.status(403).json({ 
        error: 'Scheduled announcements require Class B or higher.',
        requiredTier: 'CLASS_B'
      });
    }

    // Check tier limits (FREE = 3/week)
    if (tier === 'FREE') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const recentCount = await prisma.campgroundAnnouncement.count({
        where: {
          campgroundId,
          createdAt: { gte: oneWeekAgo }
        }
      });
      
      if (recentCount >= 3) {
        return res.status(403).json({ 
          error: 'Free tier limited to 3 announcements per week. Upgrade for unlimited.',
          limit: 3,
          used: recentCount
        });
      }
    }

    // Determine if publishing now or scheduling
    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
    const publishedAt = isScheduled ? null : new Date();
    const isPublished = !isScheduled;

    const announcement = await prisma.campgroundAnnouncement.create({
      data: {
        campgroundId,
        authorId: userId,
        title,
        content,
        imageUrl,
        isPinned: canPin ? (isPinned || false) : false,
        priority: canSetPriority ? (priority || 'NORMAL') : 'NORMAL',
        scheduledAt: canSchedule && scheduledAt ? new Date(scheduledAt) : null,
        publishedAt,
        isPublished,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
      },
    });

    // Only create activities if publishing immediately
    if (isPublished) {
      // Get followers
      const followers = await prisma.campgroundFollow.findMany({
        where: { campgroundId },
        select: { userId: true }
      });

      // Get currently checked-in users
      const now = new Date();
      const checkedInUsers = await prisma.checkIn.findMany({
        where: {
          campgroundId,
          checkInDate: { lte: now },
          OR: [
            { checkOutDate: null },
            { checkOutDate: { gte: now } }
          ]
        },
        select: { userId: true }
      });

      // Combine unique user IDs (followers + checked-in)
      const allUserIds = new Set([
        ...followers.map((f: any) => f.userId),
        ...checkedInUsers.map((c: any) => c.userId)
      ]);

      // Create activity for each user
      const activityPromises = Array.from(allUserIds).map(targetUserId =>
        prisma.activity.create({
          data: {
            userId: userId,
            type: 'CAMPGROUND_ANNOUNCEMENT',
            campgroundId,
            targetUserId,
            title: title,
            content: content,
            isPublic: true
          }
        })
      );

      await Promise.all(activityPromises);

      // Create notifications for IMPORTANT and URGENT announcements
      const priorityValue = canSetPriority ? (priority || "NORMAL") : "NORMAL";
      if (priorityValue === "IMPORTANT" || priorityValue === "URGENT") {
        // Get users who have muted this campground
        const mutedUsers = await prisma.mutedEntity.findMany({
          where: { mutedCampgroundId: campgroundId },
          select: { userId: true }
        });
        const mutedUserIds = new Set(mutedUsers.map((m: any) => m.userId));

        // Filter out muted users
        const notifyUserIds = Array.from(allUserIds).filter(id => !mutedUserIds.has(id));

        const priorityEmoji = priorityValue === "URGENT" ? "🚨" : "⚠️";
        const notificationPromises = notifyUserIds.map(targetUserId =>
          prisma.notification.create({
            data: {
              userId: targetUserId,
              type: "CAMPGROUND_ANNOUNCEMENT",
              content: priorityEmoji + " " + priorityValue + " announcement from " + campground?.name + ": " + title,
              link: "/campgrounds/" + campgroundId + "?tab=news",
            }
          })
        );
        await Promise.all(notificationPromises);
      }
    }

    res.status(201).json({
      ...announcement,
      tierFeatures: {
        canPin,
        canSetPriority,
        canSchedule,
        currentTier: tier
      }
    });
  } catch (error: any) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});



// Delete an announcement (admin only)
router.delete('/:campgroundId/announcements/:announcementId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId, announcementId } = req.params;
    const userId = (req as any).userId;

    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.campgroundAnnouncement.delete({ where: { id: announcementId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// ============== CHECK IF USER IS ADMIN ==============

router.get('/:campgroundId/is-admin', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;

    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });

    res.json({ isAdmin: !!isAdmin });
  } catch (error: any) {
    console.error('Check admin error:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});


// ============== CAMPGROUND MAP ==============

// Get campground map
router.get('/:campgroundId/map', async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { campgroundMapUrl: true },
    });
    res.json({ mapUrl: campground?.campgroundMapUrl || null });
  } catch (error: any) {
    console.error('Get map error:', error);
    res.status(500).json({ error: 'Failed to get map' });
  }
});

// Upload campground map (admin only)
router.post('/:campgroundId/map', authenticateToken, upload.single('map'), async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;

    // Check if user is admin or site admin
    const isSiteAdmin = SITE_ADMIN_IDS.includes(userId);
    const isAdmin = isSiteAdmin || await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Map image is required' });
    }

    // Upload to Cloudinary
    const mapUrl = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/campground-maps');

    await prisma.campground.update({
      where: { id: campgroundId },
      data: { campgroundMapUrl: mapUrl },
    });

    res.json({ mapUrl });
  } catch (error: any) {
    console.error('Upload map error:', error);
    res.status(500).json({ error: 'Failed to upload map' });
  }
});

// Delete campground map (admin only)
router.delete('/:campgroundId/map', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;

    // Check if user is admin
    const isAdmin = await prisma.campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.campground.update({
      where: { id: campgroundId },
      data: { campgroundMapUrl: null },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete map error:', error);
    res.status(500).json({ error: 'Failed to delete map' });
  }
});


// ══ CAMPGROUND RULES ══
router.get('/:campgroundId/rules', async (req: Request, res: Response) => {
  try {
    const rules = await prisma.campgroundRules.findUnique({ where: { campgroundId: req.params.campgroundId } });
    if (!rules) return res.json({ rules: null });
    res.json({ rules });
  } catch { res.json({ rules: null }); }
});

// ══ TEACH HITCH — Add a custom rule/fact to the campground's knowledge base ══
// Used by the Organizer Dashboard's Hitch brain tab. Appends to additionalRules
// which Hitch reads in its companion chat context alongside the structured rules.
router.post('/:campgroundId/rules/teach', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { fact } = req.body;
    if (!fact || typeof fact !== 'string' || !fact.trim()) {
      return res.status(400).json({ error: 'Fact is required' });
    }

    const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { claimedById: true } });
    if (!campground || campground.claimedById !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const existing = await prisma.campgroundRules.findUnique({ where: { campgroundId } });
    if (existing) {
      const updated = await prisma.campgroundRules.update({
        where: { campgroundId },
        data: { additionalRules: { push: fact.trim() } },
      });
      res.json({ rules: updated });
    } else {
      const created = await (prisma.campgroundRules as any).create({
        data: { campgroundId, additionalRules: [fact.trim()] },
      });
      res.json({ rules: created });
    }
  } catch (e: any) {
    console.error('[TeachHitch] Error:', e.message);
    res.status(500).json({ error: 'Failed to teach Hitch' });
  }
});

// ══ REMOVE HITCH FACT — Remove a custom rule from additionalRules ══
router.delete('/:campgroundId/rules/teach', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { fact } = req.body;
    if (!fact) return res.status(400).json({ error: 'Fact is required' });

    const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { claimedById: true } });
    if (!campground || campground.claimedById !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const existing = await prisma.campgroundRules.findUnique({ where: { campgroundId } });
    if (!existing) return res.json({ rules: null });

    const updated = await prisma.campgroundRules.update({
      where: { campgroundId },
      data: { additionalRules: { set: existing.additionalRules.filter((r: string) => r !== fact) } },
    });
    res.json({ rules: updated });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to remove fact' });
  }
});

// ══ HITCH ROUTE SUGGESTIONS — suggest campground stops near a destination ══
router.get('/suggest-stops', authenticateToken, async (req: any, res: Response) => {
  try {
    const { destLat, destLng, originLat, originLng, rvType, maxResults } = req.query;
    if (!destLat || !destLng) return res.json({ stops: [] });

    const lat = parseFloat(destLat as string);
    const lng = parseFloat(destLng as string);
    const oLat = originLat ? parseFloat(originLat as string) : null;
    const oLng = originLng ? parseFloat(originLng as string) : null;
    const limit = Math.min(parseInt(maxResults as string) || 5, 10);

    // Find campgrounds near the destination (within ~50 miles)
    const nearDest = await prisma.campground.findMany({
      where: {
        latitude: { gte: lat - 0.7, lte: lat + 0.7 },
        longitude: { gte: lng - 0.7, lte: lng + 0.7 },
      },
      select: {
        id: true, name: true, location: true, state: true, latitude: true, longitude: true,
        imageUrl: true, customSlug: true, googleRating: true, amenities: true,
        isBigRigFriendly: true, hasPullThrough: true, hasFullHookups: true, isPetFriendly: true,
      },
      take: 50,
    });

    // Calculate distance and sort
    const withDistance = nearDest.map((cg: any) => {
      const dLat = ((cg.latitude || 0) - lat) * Math.PI / 180;
      const dLng = ((cg.longitude || 0) - lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180) * Math.cos((cg.latitude||0)*Math.PI/180) * Math.sin(dLng/2)**2;
      const miles = 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return { ...cg, distanceMiles: Math.round(miles * 10) / 10 };
    }).sort((a: any, b: any) => a.distanceMiles - b.distanceMiles);

    // If we have origin, also find midpoint stops
    let midpointStops: any[] = [];
    if (oLat && oLng) {
      const midLat = (oLat + lat) / 2;
      const midLng = (oLng + lng) / 2;
      const nearMid = await prisma.campground.findMany({
        where: {
          latitude: { gte: midLat - 0.5, lte: midLat + 0.5 },
          longitude: { gte: midLng - 0.5, lte: midLng + 0.5 },
        },
        select: {
          id: true, name: true, location: true, state: true, latitude: true, longitude: true,
          imageUrl: true, customSlug: true, googleRating: true,
          isBigRigFriendly: true, hasPullThrough: true, hasFullHookups: true,
        },
        take: 20,
      });
      midpointStops = nearMid.slice(0, 3).map((cg: any) => ({ ...cg, suggestion: 'midpoint', label: 'Good halfway stop' }));
    }

    // Build Hitch-style suggestions
    const suggestions = withDistance.slice(0, limit).map((cg: any) => {
      let hitchTip = '';
      if (cg.googleRating && cg.googleRating >= 4.5) hitchTip = `Highly rated — ${cg.googleRating}/5 stars!`;
      else if (cg.isBigRigFriendly) hitchTip = 'Big rig friendly — Diesel approves.';
      else if (cg.isPetFriendly) hitchTip = 'Pet friendly — Luna recommends.';
      else if (cg.hasFullHookups) hitchTip = 'Full hookups available.';
      else hitchTip = `${cg.distanceMiles} miles from your destination.`;
      return { ...cg, hitchTip, suggestion: 'nearby' };
    });

    res.json({ stops: [...midpointStops, ...suggestions] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

export default router;
