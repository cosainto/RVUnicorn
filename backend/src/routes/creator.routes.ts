// ============================================
// CREATOR PAGES - Backend Routes
// Save as: backend/src/routes/creator.routes.ts
// ============================================

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { extractActivityFromContent } from '../services/hitchActivityExtractor';

const router = express.Router();
import { prisma } from '../lib/prisma';

// ===========================================
// CREATOR PROFILE ROUTES
// ===========================================

// Enable/disable creator mode
router.post('/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { enable, bio, specialties } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isCreator: enable,
        creatorEnabledAt: enable ? new Date() : null,
        creatorBio: bio || null,
        creatorSpecialties: specialties || [],
      },
      select: {
        id: true,
        isCreator: true,
        creatorEnabledAt: true,
        creatorBio: true,
        creatorSpecialties: true,
      },
    });

    // Create CreatorStats if enabling
    if (enable) {
      await prisma.creatorStats.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
    }

    res.json(user);
  } catch (error: any) {
    console.error('Error toggling creator mode:', error);
    res.status(500).json({ error: 'Failed to toggle creator mode' });
  }
});

// Get creator profile
router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = (req as any).user?.id;

    let creator = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { id: username }],
        isCreator: true,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        coverPhoto: true,
        creatorCoverImage: true,
        creatorBio: true,
        creatorSpecialties: true,
        creatorVerified: true,
        creatorFeatured: true,
        creatorDisplayName: true,
        creatorHandle: true,
        creatorTipJarUrl: true,
        creatorTipJarType: true,
        creatorMerchUrl: true,
        creatorMerchLabel: true,
        creatorThemeColor: true,
        creatorPinnedContentIds: true,
        // @ts-ignore duplicate property
        creatorHandle: true,
        creatorEnabledAt: true,
        rvType: true,
        rvMake: true,
        rvModel: true,
        rvYear: true,
        location: true,
        website: true,
        youtubeUrl: true,
        instagramUrl: true,
        showSocialOnCreator: true,
        tiktokUrl: true,
        creatorStats: {
          select: {
            totalViews: true,
            totalLikes: true,
            followerCount: true,
          },
        },
        _count: {
          select: {
            creatorContent: { where: { status: 'PUBLISHED' } },
            creatorFollowers: true,
          },
        },
      },
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Check if current user follows this creator
    let isFollowing = false;
    if (currentUserId && currentUserId !== creator.id) {
      const follow = await prisma.creatorFollow.findUnique({
        where: {
          creatorId_followerId: {
            creatorId: creator.id,
            followerId: currentUserId,
          },
        },
      });
      isFollowing = !!follow;
    }

    res.json({
      ...creator,
      followerCount: creator._count.creatorFollowers,
      contentCount: creator._count.creatorContent,
      isFollowing,
    });
  } catch (error: any) {
    console.error('Error fetching creator profile:', error);
    res.status(500).json({ error: 'Failed to fetch creator profile' });
  }

// Check if creator handle is available
router.get('/check-handle/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    const currentUserId = (req as any).user?.id;

    const existing = await prisma.user.findFirst({
      where: {
        creatorHandle: handle,
        NOT: currentUserId ? { id: currentUserId } : undefined,
      },
    });

    res.json({ available: !existing });
  } catch (error: any) {
    console.error('Error checking handle:', error);
    res.status(500).json({ error: 'Failed to check handle' });
  }
});
});

// Update creator profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { bio, specialties, coverImage, displayName, creatorHandle } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        creatorBio: bio,
        creatorSpecialties: specialties,
        creatorCoverImage: coverImage,
        creatorDisplayName: displayName,
        creatorHandle: creatorHandle,
        // @ts-ignore duplicate property
        creatorHandle: creatorHandle,
      },
    });

    res.json(user);
  } catch (error: any) {
    console.error('Error updating creator profile:', error);
    res.status(500).json({ error: 'Failed to update creator profile' });
  }
});

// ===========================================
// CREATOR CONTENT ROUTES
// ===========================================

// Create content
router.post('/content', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      contentType,
      title,
      description,
      body,
      thumbnailUrl,
      videoUrl,
      embedUrl,
      embedPlatform,
      category,
      tags,
      campgroundId,
      eventId,
      tripId,
      isSponsored,
      sponsorName,
      affiliateLinks,
      status,
      photos,
      gearItems,
      taggedUsers,
      taggedCampgrounds,
      collaboratorIds,
      linkedRecipeId,
    } = req.body;

    // Verify user is a creator
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isCreator: true },
    });

    if (!user?.isCreator) {
      return res.status(403).json({ error: 'Must be a creator to post content' });
    }

    const content = await prisma.creatorContent.create({
      data: {
        creatorId: userId,
        contentType,
        title,
        description,
        body,
        thumbnailUrl,
        videoUrl,
        embedUrl,
        embedPlatform,
        category,
        tags: tags || [],
        campgroundId: campgroundId && campgroundId.length > 0 ? campgroundId : null,
        eventId: eventId && eventId.length > 0 ? eventId : null,
        tripId: tripId && tripId.length > 0 ? tripId : null,
        recipeId: linkedRecipeId && linkedRecipeId.length > 0 ? linkedRecipeId : null,
        isSponsored: isSponsored || false,
        sponsorName,
        affiliateLinks,
        status: status || 'DRAFT',
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        // Create related records
        photos: photos?.length ? {
          create: photos.map((p: any, i: number) => ({
            imageUrl: p.imageUrl,
            caption: p.caption,
            sortOrder: i,
          })),
        } : undefined,
        gearItems: gearItems?.length ? {
          create: gearItems.map((g: any) => ({
            gearItemId: g.gearItemId,
            name: g.name,
            description: g.description,
            imageUrl: g.imageUrl,
            affiliateUrl: g.affiliateUrl,
          })),
        } : undefined,
        taggedUsers: taggedUsers?.length ? {
          create: taggedUsers.map((u: any) => ({
            tagType: 'USER',
            userId: u.id,
          })),
        } : undefined,
        collaborators: collaboratorIds?.length ? {
          create: collaboratorIds.map((id: string) => ({
            collaboratorId: id,
          })),
        } : undefined,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            creatorVerified: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        photos: true,
        gearItems: true,
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
            saves: true,
          },
        },
      },
    });

    // Create tags for campgrounds
    if (taggedCampgrounds?.length) {
      await prisma.creatorContentTag.createMany({
        data: taggedCampgrounds.map((c: any) => ({
          contentId: content.id,
          tagType: 'CAMPGROUND',
          campgroundId: c.id,
        })),
      });
    }

    // Create notification for tagged users
    if (taggedUsers?.length) {
      await prisma.notification.createMany({
        data: taggedUsers.map((u: any) => ({
          userId: u.id,
          type: 'TAGGED_IN_CONTENT',
          title: 'Tagged in creator content',
          message: `${user} tagged you in their post: ${title || 'Untitled'}`,
          link: `/creators/${userId}/content/${content.id}`,
        })),
      });
    }

    // Create activity for creator profile feed and followers basecamp feed
    if (status === "PUBLISHED") {
      const creator = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, firstName: true, lastName: true },
      });

      // Create activity for creator profile
      await prisma.activity.create({
        data: {
          userId,
          type: "CREATOR_VIDEO_UPLOAD",
          metadata: JSON.stringify({
            contentId: content.id,
            contentType,
            title: title || "Untitled",
            thumbnailUrl,
          }),
        },
      });

      // Get all followers of this creator
      const followers = await prisma.creatorFollow.findMany({
        where: { creatorId: userId },
        select: { followerId: true },
      });

      // Get all friends of this user
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { initiatorId: userId, status: "ACCEPTED" },
            { receiverId: userId, status: "ACCEPTED" },
          ],
        },
        select: { initiatorId: true, receiverId: true },
      });

      const friendIds = friendships.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId);
      const followerIds = followers.map((f: any) => f.followerId);
      const allRecipientIds = [...new Set([...friendIds, ...followerIds])];
      console.log("Friend IDs found:", friendIds);
      console.log("Follower IDs found:", followerIds);
      console.log("All recipient IDs:", allRecipientIds);

      // Create basecamp activity for each recipient
      if (allRecipientIds.length > 0) {
        await prisma.basecampActivity.createMany({
          data: allRecipientIds.map(recipientId => ({
            userId: recipientId,
            actorId: userId,
            type: "CREATOR_VIDEO_UPLOAD",
            entityType: "CREATOR_CONTENT",
            entityId: content.id,
            entityName: title || "Untitled",
            metadata: {
              contentType,
              thumbnailUrl,
              creatorUsername: creator?.username,
              creatorName: creator?.firstName || creator?.username,
            },
          })),
        });
      }

      // Async Hitch activity extraction — don't block the response
      if (campgroundId) {
        extractActivityFromContent(content.id).catch((err) =>
          console.error('[HitchExtractor] async extraction failed:', err)
        );
      }
    }

    res.status(201).json(content);

  } catch (error: any) {
    console.error('Error creating content:', error?.message || error);
    console.error('Full error:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Failed to create content', details: error?.message });
  }
});

// Get creator's content
router.get('/content/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { category, status, limit = '20', cursor } = req.query;
    const currentUserId = (req as any).user?.id;

    const isOwner = currentUserId === creatorId;

    const content = await prisma.creatorContent.findMany({
      where: {
        creatorId,
        ...(category ? { category: category as string } : {}),
        // Only show published content to non-owners
        status: isOwner && status ? status as string : isOwner ? undefined : 'PUBLISHED',
      },
      take: parseInt(limit as string),
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      orderBy: { publishedAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            creatorVerified: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            state: true,
          },
        },
        photos: {
          take: 4,
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
            saves: true,
          },
        },
      },
    });

    // Check if current user has liked/saved each item
    if (currentUserId) {
      const contentIds = content.map((c: any) => c.id);
      
      const [likes, saves] = await Promise.all([
        prisma.creatorContentLike.findMany({
          where: { userId: currentUserId, contentId: { in: contentIds } },
          select: { contentId: true },
        }),
        prisma.creatorSave.findMany({
          where: { userId: currentUserId, contentId: { in: contentIds } },
          select: { contentId: true },
        }),
      ]);

      const likedIds = new Set(likes.map((l: any) => l.contentId));
      const savedIds = new Set(saves.map((s: any) => s.contentId));

      return res.json(
        content.map((c: any) => ({
          ...c,
          isLiked: likedIds.has(c.id),
          isSaved: savedIds.has(c.id),
        }))
      );
    }

    res.json(content);
  } catch (error: any) {
    console.error('Error fetching creator content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});


// Get related content for a video
router.get("/content/:contentId/related", async (req, res) => {
  try {
    const { contentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 6;

    const original = await prisma.creatorContent.findUnique({
      where: { id: contentId },
      select: { creatorId: true, category: true, tags: true, campgroundId: true },
    });

    if (!original) {
      return res.status(404).json({ error: "Content not found" });
    }

    const relatedContent = await prisma.creatorContent.findMany({
      where: {
        id: { not: contentId },
        status: "PUBLISHED",
        OR: [
          { category: original.category },
          { campgroundId: original.campgroundId },
          { tags: { hasSome: original.tags } },
          { creatorId: original.creatorId },
        ],
      },
      take: limit,
      orderBy: [{ likeCount: "desc" }, { viewCount: "desc" }],
      include: {
        creator: {
          select: { id: true, username: true, firstName: true, profilePicture: true, creatorVerified: true },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    res.json(relatedContent);
  } catch (error: any) {
    console.error("Error fetching related content:", error);
    res.status(500).json({ error: "Failed to fetch related content" });
  }
});

// Get single content item
router.get('/content/:creatorId/:contentId', async (req, res) => {
  try {
    const { creatorId, contentId } = req.params;
    const currentUserId = (req as any).user?.id;

    const content = await prisma.creatorContent.findFirst({
      where: {
        id: contentId,
        creatorId,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            creatorBio: true,
            creatorVerified: true,
            creatorFeatured: true,
            _count: {
              select: { creatorFollowers: true },
            },
          },
        },
        campground: true,
        photos: { orderBy: { sortOrder: 'asc' } },
        gearItems: true,
        taggedUsers: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
            },
          },
        },
        collaborators: {
          include: {
            collaborator: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
            },
          },
        },
        comments: {
          where: { parentId: null },
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
            },
            replies: {
              take: 3,
              orderBy: { createdAt: 'asc' },
              include: {
                user: {
                  select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
            saves: true,
          },
        },
      },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Check if non-owner is trying to view non-published content
    if (content.status !== 'PUBLISHED' && currentUserId !== creatorId) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Increment view count
    await prisma.creatorContent.update({
      where: { id: contentId },
      data: { viewCount: { increment: 1 } },
    });

    // Check current user's interaction status
    let isLiked = false;
    let isSaved = false;
    let isFollowing = false;

    if (currentUserId) {
      const [like, save, follow] = await Promise.all([
        prisma.creatorContentLike.findUnique({
          where: { contentId_userId: { contentId, userId: currentUserId } },
        }),
        prisma.creatorSave.findUnique({
          where: { contentId_userId: { contentId, userId: currentUserId } },
        }),
        prisma.creatorFollow.findUnique({
          where: {
            creatorId_followerId: { creatorId, followerId: currentUserId },
          },
        }),
      ]);

      isLiked = !!like;
      isSaved = !!save;
      isFollowing = !!follow;
    }

    res.json({
      ...content,
      isLiked,
      isSaved,
      isFollowing,
    });
  } catch (error: any) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Update content
router.put('/content/:contentId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { contentId } = req.params;

    // Verify ownership
    const existing = await prisma.creatorContent.findFirst({
      where: { id: contentId, creatorId: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const {
      title,
      description,
      body,
      thumbnailUrl,
      category,
      tags,
      isSponsored,
      sponsorName,
      affiliateLinks,
      status,
      linkedRecipeId,
    } = req.body;

    const content = await prisma.creatorContent.update({
      where: { id: contentId },
      data: {
        title,
        description,
        body,
        thumbnailUrl,
        category,
        tags,
        recipeId: linkedRecipeId !== undefined ? (linkedRecipeId || null) : undefined,
        isSponsored,
        sponsorName,
        affiliateLinks,
        status,
        publishedAt: status === 'PUBLISHED' && !existing.publishedAt ? new Date() : undefined,
      },
    });

    // Trigger Hitch extraction if newly published with a campground
    if (status === 'PUBLISHED' && !existing.publishedAt && content.campgroundId) {
      extractActivityFromContent(content.id).catch((err) =>
        console.error('[HitchExtractor] async extraction failed:', err)
      );
    }

    res.json(content);
  } catch (error: any) {
    console.error('Error updating content:', error);
    res.status(500).json({ error: 'Failed to update content' });
  }
});

// Delete content
router.delete('/content/:contentId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { contentId } = req.params;

    const content = await prisma.creatorContent.findFirst({
      where: { id: contentId, creatorId: userId },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    await prisma.creatorContent.delete({ where: { id: contentId } });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting content:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

// ===========================================
// ENGAGEMENT ROUTES
// ===========================================

// Follow/unfollow creator (also syncs to RigFollow if creator has a rig)
router.post('/follow/:creatorId', authenticateToken, async (req, res) => {
  try {
    const followerId = (req as any).user.id;
    const { creatorId } = req.params;

    if (followerId === creatorId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if creator exists
    const creator = await prisma.user.findFirst({
      where: { id: creatorId, isCreator: true },
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Toggle follow
    const existing = await prisma.creatorFollow.findUnique({
      where: {
        creatorId_followerId: { creatorId, followerId },
      },
    });

    // Find creator's canonical rig for sync
    const { resolveUserRigId } = require('../services/rigResolver');
    const creatorRig = await resolveUserRigId(creatorId);

    if (existing) {
      await prisma.creatorFollow.delete({ where: { id: existing.id } });

      // Update follower count
      await prisma.creatorStats.update({
        where: { userId: creatorId },
        data: { followerCount: { decrement: 1 } },
      });

      // Sync: also remove RigFollow if exists
      if (creatorRig) {
        try {
          const rigFollow = await prisma.rigFollow.findUnique({
            where: { rigId_userId: { rigId: creatorRig.id, userId: followerId } },
          });
          if (rigFollow) {
            await prisma.rigFollow.delete({ where: { id: rigFollow.id } });
            await prisma.rig.update({
              where: { id: creatorRig.id },
              data: { followerCount: { decrement: 1 } },
            });
          }
        } catch (e: any) { console.error('[Creator] sync rig unfollow:', e.message); }
      }

      return res.json({ isFollowing: false });
    }

    await prisma.creatorFollow.create({
      data: { creatorId, followerId },
    });

    // Update follower count
    await prisma.creatorStats.upsert({
      where: { userId: creatorId },
      create: { userId: creatorId, followerCount: 1 },
      update: { followerCount: { increment: 1 } },
    });

    // Sync: also create RigFollow if creator has a rig
    if (creatorRig) {
      try {
        const rigFollowExists = await prisma.rigFollow.findUnique({
          where: { rigId_userId: { rigId: creatorRig.id, userId: followerId } },
        });
        if (!rigFollowExists) {
          await prisma.rigFollow.create({
            data: { rigId: creatorRig.id, userId: followerId },
          });
          await prisma.rig.update({
            where: { id: creatorRig.id },
            data: { followerCount: { increment: 1 } },
          });
        }
      } catch (e: any) { console.error('[Creator] sync rig follow:', e.message); }
    }

    // Notify creator
    const follower = await prisma.user.findUnique({
      where: { id: followerId },
      select: { username: true, firstName: true, lastName: true },
    });

    await prisma.notification.create({
      data: {
        userId: creatorId,
        type: 'NEW_FOLLOWER',
        content: `${follower?.firstName || follower?.username} started following your creator page`,
        link: `/profile/${follower?.username}`,
      },
    });
    res.json({ isFollowing: true });
  } catch (error: any) {
    console.error('Error toggling follow:', error);
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});


// Increment view count
router.post('/content/:contentId/view', async (req, res) => {
  try {
    const { contentId } = req.params;
    await prisma.creatorContent.update({
      where: { id: contentId },
      data: { viewCount: { increment: 1 } },
    });

    // Also update creator stats
    const content = await prisma.creatorContent.findUnique({
      where: { id: contentId },
      select: { creatorId: true },
    });
    if (content) {
      await prisma.creatorStats.upsert({
        where: { userId: content.creatorId },
        update: { totalViews: { increment: 1 }, viewsThisWeek: { increment: 1 } },
        create: { userId: content.creatorId, totalViews: 1, totalLikes: 0, followerCount: 0, viewsThisWeek: 1 },
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error incrementing view:', error);
    res.status(500).json({ error: 'Failed to increment view' });
  }
});

// Like/unlike content
router.post('/content/:contentId/like', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { contentId } = req.params;

    const existing = await prisma.creatorContentLike.findUnique({
      where: { contentId_userId: { contentId, userId } },
    });

    if (existing) {
      await prisma.creatorContentLike.delete({ where: { id: existing.id } });
      await prisma.creatorContent.update({
        where: { id: contentId },
        data: { likeCount: { decrement: 1 } },
      });
      // Update creator stats
      const unlikedContent = await prisma.creatorContent.findUnique({ where: { id: contentId }, select: { creatorId: true } });
      if (unlikedContent) {
        await prisma.creatorStats.updateMany({ where: { userId: unlikedContent.creatorId, totalLikes: { gt: 0 } }, data: { totalLikes: { decrement: 1 } } });
      }
      return res.json({ isLiked: false });
    }

    await prisma.creatorContentLike.create({
      data: { contentId, userId },
    });

    await prisma.creatorContent.update({
      where: { id: contentId },
      data: { likeCount: { increment: 1 } },
    });

    // Update creator stats
    const likedContent = await prisma.creatorContent.findUnique({ where: { id: contentId }, select: { creatorId: true } });
    if (likedContent) {
      await prisma.creatorStats.upsert({
        where: { userId: likedContent.creatorId },
        update: { totalLikes: { increment: 1 } },
        create: { userId: likedContent.creatorId, totalViews: 0, totalLikes: 1, followerCount: 0 },
      });
    }

    // Notify creator
    const content = await prisma.creatorContent.findUnique({
      where: { id: contentId },
      select: { creatorId: true, title: true },
    });

    if (content && content.creatorId !== userId) {
      const liker = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, firstName: true, lastName: true },
      });

      await prisma.notification.create({
        data: {
          userId: content.creatorId,
          type: 'CONTENT_LIKED',
          content: `${liker?.firstName || liker?.username} liked "${content.title || 'your post'}"`,
          link: `/creator/content/${contentId}`,
        },
      });
    }

    res.json({ isLiked: true });
  } catch (error: any) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Share content to feed
router.post('/content/:contentId/share', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { contentId } = req.params;

    // Get content details
    const content = await prisma.creatorContent.findUnique({
      where: { id: contentId },
      select: { id: true, title: true, thumbnailUrl: true, contentType: true, creatorId: true, creator: { select: { username: true, firstName: true } } },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Get user who is sharing
    const sharer = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, firstName: true, lastName: true },
    });

    // Create activity on sharer profile
    await prisma.activity.create({
      data: {
        userId,
        type: 'SHARED_CREATOR_VIDEO',
        metadata: JSON.stringify({
          contentId: content.id,
          contentType: content.contentType,
          title: content.title || 'Untitled',
          thumbnailUrl: content.thumbnailUrl,
          originalCreatorUsername: content.creator.username,
          originalCreatorName: content.creator.firstName,
        }),
      },
    });

    // Get all friends of sharer
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { initiatorId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
      select: { initiatorId: true, receiverId: true },
    });

    const friendIds = friendships.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId);

    // Create basecamp activity for each friend
    if (friendIds.length > 0) {
      await prisma.basecampActivity.createMany({
        data: friendIds.map((friendId: any) => ({
          userId: friendId,
          actorId: userId,
          type: 'SHARED_CREATOR_VIDEO',
          entityType: 'CREATOR_CONTENT',
          entityId: content.id,
          entityName: content.title || 'Untitled',
          metadata: {
            contentType: content.contentType,
            thumbnailUrl: content.thumbnailUrl,
            sharerUsername: sharer?.username,
            sharerName: sharer?.firstName,
            originalCreatorUsername: content.creator.username,
            originalCreatorName: content.creator.firstName,
          },
        })),
      });
    }

    // Update repost count
    await prisma.creatorContent.update({
      where: { id: contentId },
      data: { repostCount: { increment: 1 } },
    });

    res.json({ shared: true, message: 'Video shared to your feed!' });
  } catch (error: any) {
    console.error('Error sharing content:', error);
    res.status(500).json({ error: 'Failed to share content' });
  }
});

// Save/unsave content
router.post('/content/:contentId/save', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { contentId } = req.params;

    const existing = await prisma.creatorSave.findUnique({
      where: { contentId_userId: { contentId, userId } },
    });

    if (existing) {
      await prisma.creatorSave.delete({ where: { id: existing.id } });
      await prisma.creatorContent.update({
        where: { id: contentId },
        data: { saveCount: { decrement: 1 } },
      });
      return res.json({ isSaved: false });
    }

    await prisma.creatorSave.create({
      data: { contentId, userId },
    });

    await prisma.creatorContent.update({
      where: { id: contentId },
      data: { saveCount: { increment: 1 } },
    });

    res.json({ isSaved: true });
  } catch (error: any) {
    console.error('Error toggling save:', error);
    res.status(500).json({ error: 'Failed to toggle save' });
  }
});

// Comment on content
router.post('/content/:contentId/comment', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { contentId } = req.params;
    const { body, parentId } = req.body;

    const content = await prisma.creatorContent.findUnique({
      where: { id: contentId },
      select: { creatorId: true },
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const comment = await prisma.creatorContentComment.create({
      data: {
        contentId,
        userId,
        body,
        parentId,
        isCreatorReply: userId === content.creatorId,
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
      },
    });

    // Update comment count
    await prisma.creatorContent.update({
      where: { id: contentId },
      data: { commentCount: { increment: 1 } },
    });

    // Notify creator (if not self-comment)
    if (content.creatorId !== userId) {
      const commenter = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, firstName: true, lastName: true },
      });

      await prisma.notification.create({
        data: {
          userId: content.creatorId,
          type: 'NEW_COMMENT',
          title: 'New comment on your content',
          message: `${commenter?.name || commenter?.username} commented: "${body.substring(0, 50)}..."`,
          link: `/creator/content/${contentId}`,
        },
      });
    }

    res.status(201).json(comment);
  } catch (error: any) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// ===========================================
// DISCOVERY ROUTES


// Get creator leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { sortBy = 'contributionScore', limit = '50' } = req.query;

    // If sorting by contributionScore, query rigs directly
    if (sortBy === 'contributionScore') {
      const rigs = await prisma.rig.findMany({
        where: { isPublic: true, contributionScore: { not: null, gt: 0 } },
        orderBy: { contributionScore: 'desc' },
        take: parseInt(limit as string),
        select: {
          id: true,
          slug: true,
          rigName: true,
          heroPhoto: true,
          contributionScore: true,
          scoreBreakdown: true,
          followerCount: true,
          totalTripCount: true,
          owner: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
              creatorBio: true,
              creatorVerified: true,
              creatorHandle: true,
              creatorDisplayName: true,
              creatorStats: {
                select: {
                  totalViews: true,
                  totalLikes: true,
                  followerCount: true,
                  viewsThisWeek: true,
                  followersThisWeek: true,
                },
              },
              _count: {
                select: {
                  creatorContent: { where: { status: 'PUBLISHED' } },
                },
              },
            },
          },
        },
      });

      const enrichedRigs = rigs.map((rig: any) => ({
        ...rig.owner,
        rig: {
          id: rig.id,
          slug: rig.slug,
          rigName: rig.rigName,
          heroPhoto: rig.heroPhoto,
          contributionScore: rig.contributionScore,
          scoreBreakdown: rig.scoreBreakdown,
          followerCount: rig.followerCount,
          totalTripCount: rig.totalTripCount,
        },
        lastPostDate: null,
        isInactive: false,
        heatLevel: 0,
      }));

      return res.json(enrichedRigs);
    }

    let orderBy: any = {};
    if (sortBy === 'views') orderBy = { creatorStats: { totalViews: 'desc' } };
    else if (sortBy === 'likes') orderBy = { creatorStats: { totalLikes: 'desc' } };
    else if (sortBy === 'followers') orderBy = { creatorStats: { followerCount: 'desc' } };
    else if (sortBy === 'content') orderBy = { creatorContent: { _count: 'desc' } };

    const creators = await prisma.user.findMany({
      where: { isCreator: true },
      take: parseInt(limit as string),
      orderBy,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        creatorBio: true,
        creatorVerified: true,
        creatorHandle: true,
        creatorDisplayName: true,
        creatorStats: {
          select: {
            totalViews: true,
            totalLikes: true,
            followerCount: true,
            viewsThisWeek: true,
            followersThisWeek: true,
          },
        },
        _count: {
          select: {
            creatorContent: { where: { status: 'PUBLISHED' } },
          },
        },
        creatorContent: {
          where: { status: 'PUBLISHED' },
          orderBy: { publishedAt: 'desc' },
          take: 1,
          select: { publishedAt: true },
        },
        ownedRigs: {
          where: { isPublic: true },
          take: 1,
          select: {
            id: true,
            slug: true,
            rigName: true,
            heroPhoto: true,
            contributionScore: true,
            scoreBreakdown: true,
          },
        },
      },
    });

    // Calculate status indicators
    const now = new Date();
    const fiftyDaysAgo = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);


    const enrichedCreators = creators.map((creator: any) => {
      const lastPost = creator.creatorContent[0]?.publishedAt;
      const isInactive = !lastPost || new Date(lastPost) < fiftyDaysAgo;
      
      // Calculate heat level based on weekly engagement
      const viewsThisWeek = creator.creatorStats?.viewsThisWeek || 0;
      const followersThisWeek = creator.creatorStats?.followersThisWeek || 0;
      const totalViews = creator.creatorStats?.totalViews || 1;
      const engagementRate = (viewsThisWeek + followersThisWeek * 10) / Math.max(totalViews, 1) * 100;
      
      let heatLevel = 0; // 0=none, 1=heating up, 2=boomshakalaka, 3=slam-a-jamma, 4=is it the shoes, 5=whoomp there it is, 6=from downtown, 7=nail in coffin
      if (engagementRate > 5) heatLevel = 1;
      if (engagementRate > 15) heatLevel = 2;
      if (engagementRate > 30) heatLevel = 3;
      if (engagementRate > 50) heatLevel = 4;
      if (engagementRate > 75) heatLevel = 5;
      if (engagementRate > 100) heatLevel = 6;
      if (engagementRate > 150) heatLevel = 7;
      
      const rig = creator.ownedRigs?.[0] || null;

      return {
        ...creator,
        ownedRigs: undefined,
        rig: rig ? {
          id: rig.id,
          slug: rig.slug,
          rigName: rig.rigName,
          heroPhoto: rig.heroPhoto,
          contributionScore: rig.contributionScore,
          scoreBreakdown: rig.scoreBreakdown,
        } : null,
        lastPostDate: lastPost,
        isInactive,
        heatLevel,
      };
    });
    res.json(enrichedCreators);
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ===========================================

// Get trending creators
router.get('/discover/trending', async (req, res) => {
  try {
    const { limit = '10' } = req.query;

    const creators = await prisma.user.findMany({
      where: { isCreator: true },
      take: parseInt(limit as string),
      orderBy: [
        { creatorFeatured: 'desc' },
        { creatorStats: { followerCount: 'desc' } },
      ],
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        creatorBio: true,
        creatorSpecialties: true,
        creatorVerified: true,
        creatorFeatured: true,
        creatorStats: {
          select: {
            followerCount: true,
            totalViews: true,
          },
        },
      },
    });

    res.json(creators);
  } catch (error: any) {
    console.error('Error fetching trending creators:', error);
    res.status(500).json({ error: 'Failed to fetch trending creators' });
  }
});

// Get trending content
router.get('/discover/content', async (req, res) => {
  try {
    const { category, limit = '20', cursor } = req.query;

    const content = await prisma.creatorContent.findMany({
      where: {
        status: 'PUBLISHED',
        ...(category ? { category: category as string } : {}),
      },
      take: parseInt(limit as string),
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      orderBy: [
        { likeCount: 'desc' },
        { viewCount: 'desc' },
        { publishedAt: 'desc' },
      ],
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            creatorVerified: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            state: true,
          },
        },
        photos: {
          take: 1,
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    res.json(content);
  } catch (error: any) {
    console.error('Error fetching discover content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Get content by campground
router.get('/discover/campground/:campgroundId', async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const { limit = '10' } = req.query;

    const content = await prisma.creatorContent.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { campgroundId },
          {
            taggedUsers: {
              some: { tagType: 'CAMPGROUND', campgroundId },
            },
          },
        ],
      },
      take: parseInt(limit as string),
      orderBy: { publishedAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            creatorVerified: true,
          },
        },
        photos: {
          take: 1,
        },
        _count: {
          select: { likes: true, comments: true },
        },
      },
    });

    res.json(content);
  } catch (error: any) {
    console.error('Error fetching campground content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// ===========================================
// CREATOR STATS/ANALYTICS
// ===========================================

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    console.log("Stats requested for userId:", userId);
    // Get or create stats

    // Calculate actual totals from content
    const contentTotals = await prisma.creatorContent.aggregate({
      where: { creatorId: userId, status: 'PUBLISHED' },
      _sum: { viewCount: true, likeCount: true, commentCount: true, saveCount: true },
    });

    // Update and get stats
    const stats = await prisma.creatorStats.upsert({
      where: { userId },
      create: {
        userId,
        totalViews: contentTotals._sum.viewCount || 0,
        totalLikes: contentTotals._sum.likeCount || 0,
        totalComments: contentTotals._sum.commentCount || 0,
        totalSaves: contentTotals._sum.saveCount || 0,
      },
      update: {
        totalViews: contentTotals._sum.viewCount || 0,
        totalLikes: contentTotals._sum.likeCount || 0,
        totalComments: contentTotals._sum.commentCount || 0,
        totalSaves: contentTotals._sum.saveCount || 0,
      },
    });
    // Get recent content performance
    const recentContent = await prisma.creatorContent.findMany({
      where: { creatorId: userId, status: 'PUBLISHED' },
      take: 10,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        contentType: true,
        thumbnailUrl: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        publishedAt: true,
      },
    });

    // Get follower growth (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newFollowers = await prisma.creatorFollow.count({
      where: {
        creatorId: userId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Calculate views this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentLikes = await prisma.creatorContentLike.count({
      where: {
        content: { creatorId: userId },
        createdAt: { gte: oneWeekAgo },
      },
    });

    res.json({
      ...stats,
      recentContent,
      newFollowersLast30Days: newFollowers,
      likesThisWeek: recentLikes,
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});


// GET /api/creators/content/by-recipe/:recipeId - Get creator content linked to a recipe
router.get('/content/by-recipe/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const content = await prisma.creatorContent.findMany({
      where: { recipeId, status: 'PUBLISHED' },
      orderBy: { viewCount: 'desc' },
      take: 5,
      include: {
        creator: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true, creatorVerified: true },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });
    res.json(content);
  } catch (error: any) {
    console.error('Error fetching content by recipe:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

export default router;

// ============================================
// CREATOR PAGE COLLABORATORS
// ============================================

// Get collaborators for a creator page
router.get('/page-collaborators/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const userId = (req as any).userId;

    // Check if user is the owner or a collaborator
    const isOwner = creatorId === userId;
    const isCollaborator = await prisma.creatorPageCollaborator.findFirst({
      where: { creatorId, collaboratorId: userId },
    });

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'Not authorized to view collaborators' });
    }

    const collaborators = await prisma.creatorPageCollaborator.findMany({
      where: { creatorId },
      include: {
        collaborator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(collaborators);
  } catch (error: any) {
    console.error('Error fetching collaborators:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// Add a collaborator to a creator page
router.post('/page-collaborators', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { collaboratorUsername, canPost, canEdit, canDelete, canManageCollaborators } = req.body;

    // Find the collaborator by username
    const collaborator = await prisma.user.findUnique({
      where: { username: collaboratorUsername },
    });

    if (!collaborator) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (collaborator.id === userId) {
      return res.status(400).json({ error: 'Cannot add yourself as a collaborator' });
    }

    // Check if user is the owner or has permission to manage collaborators
    const existingCollab = await prisma.creatorPageCollaborator.findFirst({
      where: { userId: userId, collaboratorId: collaborator.id },
    });

    if (existingCollab) {
      return res.status(400).json({ error: 'User is already a collaborator' });
    }

    const newCollaborator = await prisma.creatorPageCollaborator.create({
      data: {
        creatorId: userId,
        collaboratorId: collaborator.id,
        canPost: canPost ?? true,
        canEdit: canEdit ?? true,
        canDelete: canDelete ?? false,
        canManageCollaborators: canManageCollaborators ?? false,
      },
      include: {
        collaborator: {
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

    res.status(201).json(newCollaborator);
  } catch (error: any) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

// Update collaborator permissions
router.put('/page-collaborators/:collaboratorId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { collaboratorId } = req.params;
    const { canPost, canEdit, canDelete, canManageCollaborators } = req.body;

    // Verify ownership
    const collab = await prisma.creatorPageCollaborator.findFirst({
      where: { userId: userId, collaboratorId },
    });

    if (!collab) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }

    const updated = await prisma.creatorPageCollaborator.update({
      where: { id: collab.id },
      data: {
        canPost: canPost ?? collab.canPost,
        canEdit: canEdit ?? collab.canEdit,
        canDelete: canDelete ?? collab.canDelete,
        canManageCollaborators: canManageCollaborators ?? collab.canManageCollaborators,
      },
      include: {
        collaborator: {
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

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating collaborator:', error);
    res.status(500).json({ error: 'Failed to update collaborator' });
  }
});

// Remove a collaborator
router.delete('/page-collaborators/:collaboratorId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { collaboratorId } = req.params;

    // Check if user is owner or the collaborator removing themselves
    const collab = await prisma.creatorPageCollaborator.findFirst({
      where: {
        OR: [
          { creatorId: userId, collaboratorId },
          { creatorId: collaboratorId, collaboratorId: userId }, // Collaborator leaving
        ],
      },
    });

    if (!collab) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }

    await prisma.creatorPageCollaborator.delete({
      where: { id: collab.id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// Search users to add as collaborators
router.get('/search-users', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    const userId = (req as any).userId;

    if (!q || (q as string).length < 2) {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { username: { contains: q as string, mode: 'insensitive' } },
              { firstName: { contains: q as string, mode: 'insensitive' } },
              { lastName: { contains: q as string, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        isCreator: true,
      },
      take: 10,
    });

    res.json(users);
  } catch (error: any) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Check if user can manage a creator page (is owner or collaborator)
router.get('/can-manage/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const userId = (req as any).userId;

    if (creatorId === userId) {
      return res.json({ canManage: true, isOwner: true, permissions: { canPost: true, canEdit: true, canDelete: true, canManageCollaborators: true } });
    }

    const collab = await prisma.creatorPageCollaborator.findFirst({
      where: { creatorId, collaboratorId: userId },
    });

    if (collab) {
      return res.json({
        canManage: true,
        isOwner: false,
        permissions: {
          canPost: collab.canPost,
          canEdit: collab.canEdit,
          canDelete: collab.canDelete,
          canManageCollaborators: collab.canManageCollaborators,
        },
      });
    }

    res.json({ canManage: false, isOwner: false, permissions: null });
  } catch (error: any) {
    console.error('Error checking permissions:', error);
    res.status(500).json({ error: 'Failed to check permissions' });
  }
});
