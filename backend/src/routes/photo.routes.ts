import express from "express";
import { authenticateToken } from "../middleware/auth.middleware";
import { getAlbumAccess } from "../services/album-access.service";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();
import { prisma } from '../lib/prisma';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB — Cloudinary compresses automatically
});

// Reaction types
const REACTION_TYPES = ["LIKE", "FIRE", "LAUGH", "CLAP", "HEART"];

// Report reasons
const REPORT_REASONS = ["INAPPROPRIATE", "SPAM", "HARASSMENT", "COPYRIGHT", "OTHER"];

// Helper: Parse mentions from caption
function parseMentions(caption: string): string[] {
  if (!caption) return [];
  const mentionRegex = /@(\w+)/g;
  const matches = caption.match(mentionRegex) || [];
  return matches.map(m => m.slice(1)); // Remove @ symbol
}

// Helper: Check visibility permissions
async function canViewPhoto(
  photo: { userId: string; visibility: string; scheduledFor?: Date | null; publishedAt?: Date | null },
  viewerId?: string
): Promise<boolean> {
  // Check if photo is scheduled but not yet published
  if (photo.scheduledFor && !photo.publishedAt) {
    // Only owner can see scheduled photos
    return photo.userId === viewerId;
  }
  
  if (photo.visibility === "PUBLIC") return true;
  if (!viewerId) return false;
  if (photo.userId === viewerId) return true;

  if (photo.visibility === "FRIENDS") {
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { initiatorId: photo.userId, receiverId: viewerId },
          { initiatorId: viewerId, receiverId: photo.userId },
        ],
      },
    });
    return !!friendship;
  }

  return false;
}

// Helper: Check if user can tag another user
async function canTagUser(taggerId: string, targetId: string): Promise<boolean> {
  // Check if target has blocked tagger from tagging them
  const blocked = await prisma.tagBlockedUser.findUnique({
    where: {
      blockerId_blockedId: { blockerId: targetId, blockedId: taggerId }
    }
  });
  return !blocked;
}

// ============================================
// PHOTO CRUD OPERATIONS
// ============================================

// Upload photo with visibility, mentions, scheduled publishing
router.post("/", authenticateToken, upload.single("image"), async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      albumId,
      eventId,
      caption,
      visibility = "PUBLIC",
      allowDownload = true,
      scheduledFor,
      surfaces: surfacesRaw,
      sharedWithIds: sharedWithIdsRaw,
    } = req.body;

    // Parse surfaces (comes as JSON string or comma-separated from form data)
    let surfaces: string[] = ['PROFILE', 'RIG', 'TRIP', 'CAMPGROUND'];
    if (surfacesRaw) {
      try { surfaces = typeof surfacesRaw === 'string' ? JSON.parse(surfacesRaw) : surfacesRaw; } catch { surfaces = surfacesRaw.split(','); }
    }

    // Parse sharedWithIds for SELECT_PEOPLE visibility
    let sharedWithIds: string[] = [];
    if (sharedWithIdsRaw) {
      try { sharedWithIds = typeof sharedWithIdsRaw === 'string' ? JSON.parse(sharedWithIdsRaw) : sharedWithIdsRaw; } catch { sharedWithIds = sharedWithIdsRaw.split(','); }
    }

    // Accept either a pre-uploaded URL or a multer file
    let uploadedImageUrl: string;
    if (req.body.imageUrl) {
      uploadedImageUrl = req.body.imageUrl;
    } else if (req.file) {
      // Legacy multer path — upload to Cloudinary with auto-compression
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: eventId ? `rvunicorn/events/${eventId}` : "rvunicorn/photos",
            resource_type: 'image',
            transformation: [
              { width: 2048, height: 2048, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      uploadedImageUrl = result.secure_url;
    } else {
      return res.status(400).json({ error: "Image required" });
    }

    // Parse mentions from caption
    const mentionUsernames = parseMentions(caption);
    let mentionUserIds: string[] = [];
    
    if (mentionUsernames.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: { username: { in: mentionUsernames } },
        select: { id: true }
      });
      mentionUserIds = mentionedUsers.map((u: any) => u.id);
    }

    // Determine if published now or scheduled
    const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();
    
    const photo = await prisma.photo.create({
      data: {
        userId,
        albumId: albumId || null,
        eventId: eventId || null,
        imageUrl: uploadedImageUrl,
        caption: caption || null,
        visibility,
        surfaces,
        sharedWithIds,
        isPrivate: visibility === 'PRIVATE',
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
        album: { select: { id: true, title: true } },
      },
    });

    // Create activity and notifications for published photos
    if (!isScheduled && visibility === "PUBLIC") {
      await prisma.activity.create({
        data: {
          userId,
          type: "PHOTO_UPLOAD",
          photoId: photo.id,
          albumId: albumId || null,
          isPublic: true,
        },
      });

      // Notify mentioned users
      if (mentionUserIds.length > 0) {
        await prisma.notification.createMany({
          data: mentionUserIds.map(mentionedUserId => ({
            userId: mentionedUserId,
            type: "PHOTO_MENTION",
            content: `mentioned you in a photo`,
            link: `/photos/${photo.id}`,
          })),
        });
      }
    }

    // Auto-tag to campground if user has an active check-in and CAMPGROUND surface is on
    if (surfaces.includes('CAMPGROUND')) {
      try {
        const activeCheckIn = await prisma.checkIn.findFirst({
          where: { userId, isActive: true },
          select: { campgroundId: true },
        });
        if (activeCheckIn?.campgroundId) {
          await prisma.photoCampgroundTag.create({
            data: { photoId: photo.id, campgroundId: activeCheckIn.campgroundId, taggedBy: userId },
          }).catch(() => {}); // ignore duplicate
        }
      } catch { /* non-critical */ }
    }

    res.status(201).json(photo);
  } catch (error: any) {
    console.error("Error uploading photo:", error);
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

// Get single photo with all details
router.get("/:photoId", authenticateToken, async (req: any, res) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).user?.id;

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
        album: { select: { id: true, title: true, privacy: true } },
        reactions: {
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } }
          }
        },
        userTags: {
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          },
        },
        campgroundTags: {
          include: {
            campground: { select: { id: true, name: true } },
          },
        },
        saves: { select: { userId: true } },
      },
    });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    if (!(await canViewPhoto(photo, userId))) {
      return res.status(403).json({ error: "You don't have permission to view this photo" });
    }

    // Increment view count
    if (photo.userId !== userId) {
      await prisma.photo.update({
        where: { id: photoId },
        data: { viewCount: { increment: 1 } }
      });
    }

    // Get reaction counts by type
    const reactionCounts: Record<string, number> = {};
    const userReactions: string[] = [];
    
    photo.reactions.forEach((r: any) => {
      reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
      if (r.userId === userId) {
        userReactions.push(r.type);
      }
    });

    res.json({
      ...photo,
      reactionCounts,
      userReactions,
      totalReactions: photo.reactions.length,
      isSaved: photo.saves.some((s: any) => s.userId === userId),
      saveCount: photo.saves.length,
      viewCount: photo.viewCount + (photo.userId !== userId ? 1 : 0),
    });
  } catch (error: any) {
    console.error("Error fetching photo:", error);
    res.status(500).json({ error: "Failed to fetch photo" });
  }
});

// Update photo
router.patch("/:photoId", authenticateToken, async (req: any, res) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).user.id;
    const { caption, visibility, allowDownload, isPinned, placeId } = req.body;

    const photo = await prisma.photo.findUnique({ where: { id: photoId } });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    if (photo.userId !== userId) {
      return res.status(403).json({ error: "You can only edit your own photos" });
    }

    const updateData: any = {};
    
    if (caption !== undefined) {
      updateData.caption = caption;
      // Re-parse mentions
      const mentionUsernames = parseMentions(caption);
      if (mentionUsernames.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: { username: { in: mentionUsernames } },
          select: { id: true }
        });
        updateData.mentions = mentionedUsers.map((u: any) => u.id);
      } else {
        updateData.mentions = [];
      }
    }
    
    if (visibility !== undefined) updateData.visibility = visibility;
    if (allowDownload !== undefined) updateData.allowDownload = allowDownload;
    if (placeId !== undefined) updateData.placeId = placeId;
    
    // Handle pinning - only one photo can be pinned at a time
    if (isPinned === true) {
      // Unpin all other photos first
      await prisma.photo.updateMany({
        where: { userId, isPinned: true },
        data: { isPinned: false }
      });
      updateData.isPinned = true;
    } else if (isPinned === false) {
      updateData.isPinned = false;
    }

    const updatedPhoto = await prisma.photo.update({
      where: { id: photoId },
      data: updateData,
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
        reactions: true,
      },
    });

    res.json(updatedPhoto);
  } catch (error: any) {
    console.error("Error updating photo:", error);
    res.status(500).json({ error: "Failed to update photo" });
  }
});

// Delete photo
router.delete("/:photoId", authenticateToken, async (req: any, res) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).user.id;

    const photo = await prisma.photo.findUnique({ where: { id: photoId } });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    if (photo.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own photos" });
    }

    // Delete from Cloudinary
    const urlParts = photo.imageUrl.split("/");
    const publicId = `rvunicorn/photos/${urlParts[urlParts.length - 1].split(".")[0]}`;
    await cloudinary.uploader.destroy(publicId).catch(console.error);

    await prisma.photo.delete({ where: { id: photoId } });

    res.json({ message: "Photo deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// ============================================
// REACTIONS (Multiple Types)
// ============================================

// Add/toggle reaction
router.post("/:photoId/react", authenticateToken, async (req: any, res) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).user.id;
    const { type } = req.body;

    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid reaction type. Must be one of: ${REACTION_TYPES.join(", ")}` });
    }

    const photo = await prisma.photo.findUnique({ where: { id: photoId } });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    if (!(await canViewPhoto(photo, userId))) {
      return res.status(403).json({ error: "You don't have permission to react to this photo" });
    }

    // Check for existing reaction of this type
    const existingReaction = await prisma.photoReaction.findUnique({
      where: { photoId_userId_type: { photoId, userId, type } },
    });

    if (existingReaction) {
      // Remove reaction
      await prisma.photoReaction.delete({ where: { id: existingReaction.id } });
      
      const counts = await getReactionCounts(photoId);
      return res.json({ added: false, type, ...counts });
    }

    // Add reaction
    await prisma.photoReaction.create({
      data: { photoId, userId, type },
    });

    // Notify photo owner
    if (photo.userId !== userId) {
      const reactionEmojis: Record<string, string> = {
        LIKE: "❤️",
        FIRE: "🔥",
        LAUGH: "😂",
        CLAP: "👏",
        HEART: "💖"
      };
      
      await prisma.notification.create({
        data: {
          userId: photo.userId,
          type: "PHOTO_REACTION",
          content: `reacted ${reactionEmojis[type]} to your photo`,
          link: `/photos/${photoId}`,
        },
      });
    }

    const counts = await getReactionCounts(photoId);
    res.json({ added: true, type, ...counts });
  } catch (error: any) {
    console.error("Error reacting to photo:", error);
    res.status(500).json({ error: "Failed to react to photo" });
  }
});

// Get reaction counts helper
async function getReactionCounts(photoId: string) {
  const reactions = await prisma.photoReaction.findMany({
    where: { photoId },
  });
  
  const reactionCounts: Record<string, number> = {};
  reactions.forEach((r: any) => {
    reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
  });
  
  return { reactionCounts, totalReactions: reactions.length };
}

// Get reactions for a photo
router.get("/:photoId/reactions", authenticateToken, async (req: any, res) => {
  try {
    const { photoId } = req.params;
    const { type } = req.query;

    const where: any = { photoId };
    if (type && REACTION_TYPES.includes(type as string)) {
      where.type = type;
    }

    const reactions = await prisma.photoReaction.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(reactions);
  } catch (error: any) {
    console.error("Error fetching reactions:", error);
    res.status(500).json({ error: "Failed to fetch reactions" });
  }
});

// ============================================
// TAGGING PEOPLE
// ============================================

// Add tag to photo
router.post("/:photoId/tag", authenticateToken, async (req: any, res) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).user.id;
    const { taggedUserId, xPosition, yPosition } = req.body;

    const photo = await prisma.photo.findUnique({ where: { id: photoId } });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Only owner can add tags
    if (photo.userId !== userId) {
      return res.status(403).json({ error: "Only the photo owner can add tags" });
    }

    // Check if can tag this user
    if (!(await canTagUser(userId, taggedUserId))) {
      return res.status(403).json({ error: "This user has blocked you from tagging them" });
    }

    // Check for existing tag
    const existingTag = await prisma.photoTag.findUnique({
      where: { photoId_userId: { photoId, userId: taggedUserId } }
    });

    if (existingTag) {
      // Update position
      const updatedTag = await prisma.photoTag.update({
        where: { id: existingTag.id },
        data: { xPosition, yPosition },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } }
        }
      });
      return res.json(updatedTag);
    }

    // Create new tag
    const tag = await prisma.photoTag.create({
      data: {
        photoId,
        userId: taggedUserId,
        xPosition,
        yPosition
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } }
      }
    });

    // Notify tagged user
    await prisma.notification.create({
      data: {
        userId: taggedUserId,
        type: "PHOTO_TAG",
        content: `tagged you in a photo`,
        link: `/photos/${photoId}`,
      },
    });

    res.status(201).json(tag);
  } catch (error: any) {
    console.error("Error tagging user:", error);
    res.status(500).json({ error: "Failed to tag user" });
  }
});

// Remove tag from photo
router.delete("/:photoId/tag/:taggedUserId", authenticateToken, async (req: any, res) => {
  try {
    const { photoId, taggedUserId } = req.params;
    const userId = (req as any).user.id;

    const photo = await prisma.photo.findUnique({ where: { id: photoId } });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Owner or tagged user can remove tag
    if (photo.userId !== userId && taggedUserId !== userId) {
      return res.status(403).json({ error: "You can only remove your own tags or tags on your photos" });
    }

    await prisma.photoTag.deleteMany({
      where: { photoId, userId: taggedUserId }
    });

    res.json({ message: "Tag removed successfully" });
  } catch (error: any) {
    console.error("Error removing tag:", error);
    res.status(500).json({ error: "Failed to remove tag" });
  }
});

// Block user from tagging you
router.post("/block-tagging/:blockedUserId", authenticateToken, async (req: any, res) => {
  try {
    const { blockedUserId } = req.params;
    const blockerId = (req as any).user.id;

    if (blockerId === blockedUserId) {
      return res.status(400).json({ error: "Cannot block yourself" });
    }

    await prisma.tagBlockedUser.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: blockedUserId } },
      create: { blockerId, blockedId: blockedUserId },
      update: {}
    });

    res.json({ message: "User blocked from tagging you" });
  } catch (error: any) {
    console.error("Error blocking user:", error);
    res.status(500).json({ error: "Failed to block user" });
  }
});

// Unblock user from tagging
router.delete("/block-tagging/:blockedUserId", authenticateToken, async (req: any, res) => {
  try {
    const { blockedUserId } = req.params;
    const blockerId = (req as any).user.id;

    await prisma.tagBlockedUser.deleteMany({
      where: { blockerId, blockedId: blockedUserId }
    });

    res.json({ message: "User unblocked" });
  } catch (error: any) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ error: "Failed to unblock user" });
  }
});

// ============================================
// SAVE / BOOKMARK
// ============================================

// Save photo
router.post("/:photoId/save", authenticateToken, async (req: any, res) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).user.id;

    const photo = await prisma.photo.findUnique({ where: { id: photoId } });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    if (!(await canViewPhoto(photo, userId))) {
      return res.status(403).json({ error: "You don't have permission to save this photo" });
    }

    const existingSave = await prisma.photoSave.findUnique({
      where: { photoId_userId: { photoId, userId } }
    });

    if (existingSave) {
      // Unsave
      await prisma.photoSave.delete({ where: { id: existingSave.id } });
      const saveCount = await prisma.photoSave.count({ where: { photoId } });
      return res.json({ saved: false, saveCount });
    }

    // Save
    await prisma.photoSave.create({
      data: { photoId, userId }
    });

    const saveCount = await prisma.photoSave.count({ where: { photoId } });
    res.json({ saved: true, saveCount });
  } catch (error: any) {
    console.error("Error saving photo:", error);
    res.status(500).json({ error: "Failed to save photo" });
  }
});

// Get saved photos
router.get("/saved/mine", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { limit = 20, cursor } = req.query;

    const saves = await prisma.photoSave.findMany({
      where: { userId },
      include: {
        photo: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
            },
            reactions: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
    });

    // Filter out photos user can no longer view
    const visiblePhotos = [];
    for (const save of saves) {
      if (await canViewPhoto(save.photo, userId)) {
        visiblePhotos.push({
          ...save.photo,
          savedAt: save.createdAt,
          reactionCounts: save.photo.reactions.reduce((acc: any, r: any) => {
            acc[r.type] = (acc[r.type] || 0) + 1;
            return acc;
          }, {}),
          totalReactions: save.photo.reactions.length
        });
      }
    }

    res.json({
      photos: visiblePhotos,
      nextCursor: saves.length === parseInt(limit as string) ? saves[saves.length - 1].id : null,
    });
  } catch (error: any) {
    console.error("Error fetching saved photos:", error);
    res.status(500).json({ error: "Failed to fetch saved photos" });
  }
});

// ============================================
// REPORTING
// ============================================

// Report photo
router.post("/:photoId/report", authenticateToken, async (req: any, res) => {
  try {
    const { photoId } = req.params;
    const reporterId = (req as any).user.id;
    const { reason, details } = req.body;

    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ error: `Invalid reason. Must be one of: ${REPORT_REASONS.join(", ")}` });
    }

    const photo = await prisma.photo.findUnique({ where: { id: photoId } });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Check for existing report
    const existingReport = await prisma.photoReport.findFirst({
      where: { photoId, reporterId, status: "PENDING" }
    });

    if (existingReport) {
      return res.status(400).json({ error: "You have already reported this photo" });
    }

    await prisma.photoReport.create({
      data: {
        photoId,
        reporterId,
        reason,
        details
      }
    });

    res.json({ message: "Report submitted. Thank you for helping keep our community safe." });
  } catch (error: any) {
    console.error("Error reporting photo:", error);
    res.status(500).json({ error: "Failed to report photo" });
  }
});

// ============================================
// FEEDS
// ============================================

// Get photo feed (with reactions)
router.get("/feed/recent", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { limit = 20, cursor } = req.query;

    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ initiatorId: userId }, { receiverId: userId }],
      },
    });

    const friendIds = friendships.map((f: any) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    const photos = await prisma.photo.findMany({
      where: {
        publishedAt: { not: null }, // Only published photos
        OR: [
          { visibility: "PUBLIC" },
          { userId: { in: friendIds }, visibility: "FRIENDS" },
          { userId },
        ],
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
        album: { select: { id: true, title: true } },
        reactions: true,
        userTags: {
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true } },
          },
        },
        saves: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
    });

    const photosWithDetails = photos.map((photo: any) => {
      const reactionCounts: Record<string, number> = {};
      const userReactions: string[] = [];

      photo.reactions.forEach((r: any) => {
        reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
        if (r.userId === userId) {
          userReactions.push(r.type);
        }
      });

      return {
        ...photo,
        reactionCounts,
        userReactions,
        totalReactions: photo.reactions.length,
        isSaved: photo.saves.length > 0,
      };
    });

    res.json({
      photos: photosWithDetails,
      nextCursor: photos.length === parseInt(limit as string) ? photos[photos.length - 1].id : null,
    });
  } catch (error: any) {
    console.error("Error fetching photo feed:", error);
    res.status(500).json({ error: "Failed to fetch photo feed" });
  }
});

// Get user's pinned photo
router.get("/user/:userId/pinned", authenticateToken, async (req: any, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const viewerId = (req as any).user?.id;

    const pinnedPhoto = await prisma.photo.findFirst({
      where: { userId: targetUserId, isPinned: true },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
        reactions: true,
      },
    });

    if (!pinnedPhoto) {
      return res.json(null);
    }

    if (!(await canViewPhoto(pinnedPhoto, viewerId))) {
      return res.json(null);
    }

    res.json(pinnedPhoto);
  } catch (error: any) {
    console.error("Error fetching pinned photo:", error);
    res.status(500).json({ error: "Failed to fetch pinned photo" });
  }
});

// Get album photos with visibility filtering
router.get("/album/:albumId", authenticateToken, async (req: any, res) => {
  try {
    const { albumId } = req.params;
    const userId = (req as any).user?.id;

    const album = await prisma.photoAlbum.findUnique({
      where: { id: albumId },
      include: {
        photos: {
          where: { publishedAt: { not: null } }, // Only published
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
            },
            reactions: true,
            userTags: {
              include: {
                user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
              },
            },
            campgroundTags: {
              include: {
                campground: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        user: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });

    if (!album) {
      return res.status(404).json({ error: "Album not found" });
    }

    const isOwner = album.userId === userId;
    if (!isOwner) {
      if (album.privacy === "PRIVATE") {
        return res.status(403).json({ error: "This album is private" });
      }
      if (album.privacy === "FRIENDS") {
        const friendship = await prisma.friendship.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { initiatorId: album.userId, receiverId: userId },
              { initiatorId: userId, receiverId: album.userId },
            ],
          },
        });
        if (!friendship) {
          return res.status(403).json({ error: "This album is for friends only" });
        }
      }
    }

    const visiblePhotos = [];
    for (const photo of album.photos) {
      if (await canViewPhoto(photo, userId)) {
        const reactionCounts: Record<string, number> = {};
        photo.reactions.forEach((r: any) => {
          reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
        });

        visiblePhotos.push({
          ...photo,
          reactionCounts,
          totalReactions: photo.reactions.length,
          userReactions: photo.reactions.filter((r: any) => r.userId === userId).map((r: any) => r.type),
        });
      }
    }

    res.json({
      ...album,
      photos: visiblePhotos,
      photoCount: visiblePhotos.length,
    });
  } catch (error: any) {
    console.error("Error fetching album photos:", error);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

// ============================================
// ALBUM COVER
// ============================================

// Set album cover — owner or any collaborator may set it
router.patch("/album/:albumId/cover", authenticateToken, async (req: any, res) => {
  try {
    const { albumId } = req.params;
    const userId = req.userId;
    const { photoId, coverPhotoUrl } = req.body;

    // Owner / collaborator / co-pilot / event co-attendee can all set the cover
    const access = await getAlbumAccess(albumId, userId);
    if (!access.exists) return res.status(404).json({ error: "Album not found" });
    if (!access.canWrite) {
      return res.status(403).json({ error: "Only the album owner, collaborators, co-pilot, or trip mates can change the cover" });
    }

    const updateData: any = {};

    if (photoId) {
      const photo = await prisma.photo.findFirst({ where: { id: photoId, albumId } });
      if (!photo) {
        return res.status(400).json({ error: "Photo not found in this album" });
      }
      updateData.coverPhotoId = photoId;
      updateData.coverPhotoUrl = photo.imageUrl;
    } else if (coverPhotoUrl) {
      updateData.coverPhotoUrl = coverPhotoUrl;
    } else {
      return res.status(400).json({ error: "photoId or coverPhotoUrl required" });
    }

    const updatedAlbum = await prisma.photoAlbum.update({
      where: { id: albumId },
      data: updateData,
    });

    res.json(updatedAlbum);
  } catch (error: any) {
    console.error("Error setting album cover:", error);
    res.status(500).json({ error: "Failed to set album cover" });
  }
});

// Bulk update visibility
router.patch("/bulk/visibility", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { photoIds, visibility } = req.body;

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: "photoIds must be a non-empty array" });
    }

    if (!["PUBLIC", "FRIENDS", "PRIVATE"].includes(visibility)) {
      return res.status(400).json({ error: "Invalid visibility value" });
    }

    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds } },
    });

    const notOwned = photos.filter((p: any) => p.userId !== userId);
    if (notOwned.length > 0) {
      return res.status(403).json({ error: "You can only update your own photos" });
    }

    await prisma.photo.updateMany({
      where: { id: { in: photoIds }, userId },
      data: { visibility },
    });

    res.json({ message: `Updated ${photoIds.length} photos to ${visibility}` });
  } catch (error: any) {
    console.error("Error bulk updating photos:", error);
    res.status(500).json({ error: "Failed to update photos" });
  }
});


// GET /api/photos/event/:eventId - Get all photos for an event
router.get('/event/:eventId', async (req: any, res) => {
  try {
    const { eventId } = req.params;
    const photos = await prisma.photo.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        album: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ photos, photosByUser: [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
