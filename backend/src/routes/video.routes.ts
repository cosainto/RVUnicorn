import express from "express";
import { authenticateToken } from "../middleware/auth.middleware";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();
import { prisma } from '../lib/prisma';
const db = prisma as any;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
});

// Reaction types
const REACTION_TYPES = ["LIKE", "FIRE", "LAUGH", "CLAP", "HEART"];

// Report reasons
const REPORT_REASONS = ["INAPPROPRIATE", "SPAM", "HARASSMENT", "COPYRIGHT", "OTHER"];

// Video constraints
const VIDEO_CONSTRAINTS = {
  maxDuration: 120, // 2 minutes in seconds
  maxSize: 100 * 1024 * 1024, // 100MB
  allowedFormats: ['mp4', 'mov', 'avi', 'webm'],
};

// Helper: Check visibility permissions
async function canViewVideo(
  video: { userId: string; visibility: string; scheduledFor?: Date | null; publishedAt?: Date | null },
  viewerId?: string
): Promise<boolean> {
  if (video.scheduledFor && !video.publishedAt) {
    return video.userId === viewerId;
  }
  
  if (video.visibility === "PUBLIC") return true;
  if (!viewerId) return false;
  if (video.userId === viewerId) return true;

  if (video.visibility === "FRIENDS") {
    const friendship = await db.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { initiatorId: video.userId, receiverId: viewerId },
          { initiatorId: viewerId, receiverId: video.userId },
        ],
      },
    });
    return !!friendship;
  }

  return false;
}

// Helper: Parse mentions from caption
function parseMentions(caption: string): string[] {
  if (!caption) return [];
  const mentionRegex = /@(\w+)/g;
  const matches = caption.match(mentionRegex) || [];
  return matches.map(m => m.slice(1));
}

// Helper: Check if user can tag another user
async function canTagUser(taggerId: string, targetId: string): Promise<boolean> {
  const blocked = await db.tagBlockedUser.findUnique({
    where: {
      blockerId_blockedId: { blockerId: targetId, blockedId: taggerId }
    }
  });
  return !blocked;
}

// ============================================
// VIDEO CRUD OPERATIONS
// ============================================

// Upload video (file or URL)
router.post("/", authenticateToken, upload.single("video"), async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      albumId,
      title,
      description,
      videoUrl, // For external URLs (YouTube, etc.)
      thumbnailUrl,
      duration,
      visibility = "PUBLIC",
      allowDownload = true,
      scheduledFor,
    } = req.body;

    let finalVideoUrl = videoUrl;
    let finalThumbnailUrl = thumbnailUrl;

    // If pre-uploaded URL provided, use it directly; otherwise fall back to multer file upload
    if (videoUrl) {
      // Pre-uploaded Cloudinary URL — skip upload
      finalVideoUrl = videoUrl;
      finalThumbnailUrl = thumbnailUrl || videoUrl.replace(/\.[^.]+$/, '.jpg');
    } else if (req.file) {
      // Validate duration if provided
      if (duration && parseInt(duration) > VIDEO_CONSTRAINTS.maxDuration) {
        return res.status(400).json({ 
          error: `Video must be ${VIDEO_CONSTRAINTS.maxDuration} seconds or less` 
        });
      }

      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "rvunicorn/videos",
            resource_type: "video",
            eager: [
              { width: 300, height: 200, crop: "fill", format: "jpg" }, // Thumbnail
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      finalVideoUrl = result.secure_url;
      finalThumbnailUrl = result.eager?.[0]?.secure_url || thumbnailUrl;
    }

    if (!finalVideoUrl) {
      return res.status(400).json({ error: "No video provided" });
    }

    // Parse mentions
    const mentionUsernames = parseMentions(description);
    let mentionUserIds: string[] = [];
    
    if (mentionUsernames.length > 0) {
      const mentionedUsers = await db.user.findMany({
        where: { username: { in: mentionUsernames } },
        select: { id: true }
      });
      mentionUserIds = mentionedUsers.map((u: any) => u.id);
    }

    const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();

    const video = await db.video.create({
      data: {
        userId,
        albumId: albumId || null,
        title: title || "Untitled Video",
        description,
        videoUrl: finalVideoUrl,
        thumbnailUrl: finalThumbnailUrl,
        duration: duration ? parseInt(duration) : null,
        visibility,
        allowDownload: allowDownload === "true" || allowDownload === true,
        mentions: mentionUserIds,
        scheduledFor: isScheduled ? new Date(scheduledFor) : null,
        publishedAt: isScheduled ? null : new Date(),
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
        album: { select: { id: true, title: true } },
      },
    });

    // Create activity and notifications
    if (!isScheduled && visibility === "PUBLIC") {
      await db.activity.create({
        data: {
          userId,
          type: "VIDEO_UPLOAD",
          isPublic: true,
        },
      });

      if (mentionUserIds.length > 0) {
        await db.notification.createMany({
          data: mentionUserIds.map(mentionedUserId => ({
            userId: mentionedUserId,
            type: "VIDEO_MENTION",
            content: `mentioned you in a video`,
            link: `/videos/${video.id}`,
          })),
        });
      }
    }

    res.status(201).json(video);
  } catch (error: any) {
    console.error("Error uploading video:", error);
    res.status(500).json({ error: "Failed to upload video" });
  }
});

// Get single video with all details
router.get("/:videoId", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).userId;

    const video = await db.video.findUnique({
      where: { id: videoId },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
        album: { select: { id: true, title: true } },
        likes: {
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } }
          }
        },
        tags: {
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          },
        },
        saves: { select: { userId: true } },
      },
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (!(await canViewVideo(video, userId))) {
      return res.status(403).json({ error: "You don't have permission to view this video" });
    }

    // Increment view count
    if (video.userId !== userId) {
      await db.video.update({
        where: { id: videoId },
        data: { viewCount: { increment: 1 } }
      });
    }

    // Get reaction counts by type
    const reactionCounts: Record<string, number> = {};
    const userReactions: string[] = [];
    
    video.likes.forEach((r: any) => {
      const type = r.type || 'LIKE';
      reactionCounts[type] = (reactionCounts[type] || 0) + 1;
      if (r.userId === userId) {
        userReactions.push(type);
      }
    });

    res.json({
      ...video,
      reactionCounts,
      userReactions,
      totalReactions: video.likes.length,
      isSaved: video.saves.some((s: any) => s.userId === userId),
      saveCount: video.saves.length,
      viewCount: video.viewCount + (video.userId !== userId ? 1 : 0),
    });
  } catch (error: any) {
    console.error("Error fetching video:", error);
    res.status(500).json({ error: "Failed to fetch video" });
  }
});

// Update video
router.patch("/:videoId", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).user.id;
    const { title, description, visibility, allowDownload, isPinned, thumbnailUrl } = req.body;

    const video = await db.video.findUnique({ where: { id: videoId } });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (video.userId !== userId) {
      return res.status(403).json({ error: "You can only edit your own videos" });
    }

    const updateData: any = {};
    
    if (title !== undefined) updateData.title = title;
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    
    if (description !== undefined) {
      updateData.description = description;
      const mentionUsernames = parseMentions(description);
      if (mentionUsernames.length > 0) {
        const mentionedUsers = await db.user.findMany({
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
    
    // Handle pinning
    if (isPinned === true) {
      await db.video.updateMany({
        where: { userId, isPinned: true },
        data: { isPinned: false }
      });
      updateData.isPinned = true;
    } else if (isPinned === false) {
      updateData.isPinned = false;
    }

    const updatedVideo = await db.video.update({
      where: { id: videoId },
      data: updateData,
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
      },
    });

    res.json(updatedVideo);
  } catch (error: any) {
    console.error("Error updating video:", error);
    res.status(500).json({ error: "Failed to update video" });
  }
});

// Delete video
router.delete("/:videoId", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).user.id;

    const video = await db.video.findUnique({ where: { id: videoId } });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (video.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own videos" });
    }

    // Delete from Cloudinary if it's a Cloudinary URL
    if (video.videoUrl.includes('cloudinary')) {
      const urlParts = video.videoUrl.split("/");
      const publicId = `rvunicorn/videos/${urlParts[urlParts.length - 1].split(".")[0]}`;
      await cloudinary.uploader.destroy(publicId, { resource_type: "video" }).catch(console.error);
    }

    await db.video.delete({ where: { id: videoId } });

    res.json({ message: "Video deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting video:", error);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

// ============================================
// REACTIONS (Multiple Types)
// ============================================

// Add/toggle reaction
router.post("/:videoId/react", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).user.id;
    const { type = "LIKE" } = req.body;

    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid reaction type. Must be one of: ${REACTION_TYPES.join(", ")}` });
    }

    const video = await db.video.findUnique({ where: { id: videoId } });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (!(await canViewVideo(video, userId))) {
      return res.status(403).json({ error: "You don't have permission to react to this video" });
    }

    // Check for existing reaction
    const existingLike = await db.videoLike.findUnique({
      where: { videoId_userId: { videoId, userId } },
    });

    if (existingLike) {
      if (existingLike.type === type) {
        // Remove reaction
        await db.videoLike.delete({ where: { id: existingLike.id } });
        const counts = await getVideoReactionCounts(videoId);
        return res.json({ added: false, type, ...counts });
      } else {
        // Change reaction type
        await db.videoLike.update({
          where: { id: existingLike.id },
          data: { type }
        });
        const counts = await getVideoReactionCounts(videoId);
        return res.json({ added: true, changed: true, type, ...counts });
      }
    }

    // Add reaction
    await db.videoLike.create({
      data: { videoId, userId, type },
    });

    // Notify video owner
    if (video.userId !== userId) {
      const reactionEmojis: Record<string, string> = {
        LIKE: "❤️", FIRE: "🔥", LAUGH: "😂", CLAP: "👏", HEART: "💖"
      };
      
      await db.notification.create({
        data: {
          userId: video.userId,
          type: "VIDEO_REACTION",
          content: `reacted ${reactionEmojis[type]} to your video`,
          link: `/videos/${videoId}`,
        },
      });
    }

    const counts = await getVideoReactionCounts(videoId);
    res.json({ added: true, type, ...counts });
  } catch (error: any) {
    console.error("Error reacting to video:", error);
    res.status(500).json({ error: "Failed to react to video" });
  }
});

async function getVideoReactionCounts(videoId: string) {
  const likes = await db.videoLike.findMany({
    where: { videoId },
  });
  
  const reactionCounts: Record<string, number> = {};
  likes.forEach((l: any) => {
    const type = l.type || 'LIKE';
    reactionCounts[type] = (reactionCounts[type] || 0) + 1;
  });
  
  return { reactionCounts, totalReactions: likes.length };
}

// Get reactions for a video
router.get("/:videoId/reactions", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const { type } = req.query;

    const where: any = { videoId };
    if (type && REACTION_TYPES.includes(type as string)) {
      where.type = type;
    }

    const reactions = await db.videoLike.findMany({
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

// Add tag to video
router.post("/:videoId/tag", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).user.id;
    const { taggedUserId, timestamp } = req.body; // timestamp in seconds for video position

    const video = await db.video.findUnique({ where: { id: videoId } });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (video.userId !== userId) {
      return res.status(403).json({ error: "Only the video owner can add tags" });
    }

    if (!(await canTagUser(userId, taggedUserId))) {
      return res.status(403).json({ error: "This user has blocked you from tagging them" });
    }

    const existingTag = await db.videoTag.findUnique({
      where: { videoId_userId: { videoId, userId: taggedUserId } }
    });

    if (existingTag) {
      const updatedTag = await db.videoTag.update({
        where: { id: existingTag.id },
        data: { timestamp },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } }
        }
      });
      return res.json(updatedTag);
    }

    const tag = await db.videoTag.create({
      data: {
        videoId,
        userId: taggedUserId,
        timestamp: timestamp || null
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } }
      }
    });

    await db.notification.create({
      data: {
        userId: taggedUserId,
        type: "VIDEO_TAG",
        content: `tagged you in a video`,
        link: `/videos/${videoId}`,
      },
    });

    res.status(201).json(tag);
  } catch (error: any) {
    console.error("Error tagging user:", error);
    res.status(500).json({ error: "Failed to tag user" });
  }
});

// Remove tag from video
router.delete("/:videoId/tag/:taggedUserId", authenticateToken, async (req: any, res) => {
  try {
    const { videoId, taggedUserId } = req.params;
    const userId = (req as any).user.id;

    const video = await db.video.findUnique({ where: { id: videoId } });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (video.userId !== userId && taggedUserId !== userId) {
      return res.status(403).json({ error: "You can only remove your own tags or tags on your videos" });
    }

    await db.videoTag.deleteMany({
      where: { videoId, userId: taggedUserId }
    });

    res.json({ message: "Tag removed successfully" });
  } catch (error: any) {
    console.error("Error removing tag:", error);
    res.status(500).json({ error: "Failed to remove tag" });
  }
});

// ============================================
// SAVE / BOOKMARK
// ============================================

// Save video
router.post("/:videoId/save", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).user.id;

    const video = await db.video.findUnique({ where: { id: videoId } });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (!(await canViewVideo(video, userId))) {
      return res.status(403).json({ error: "You don't have permission to save this video" });
    }

    const existingSave = await db.videoSave.findUnique({
      where: { videoId_userId: { videoId, userId } }
    });

    if (existingSave) {
      await db.videoSave.delete({ where: { id: existingSave.id } });
      const saveCount = await db.videoSave.count({ where: { videoId } });
      return res.json({ saved: false, saveCount });
    }

    await db.videoSave.create({
      data: { videoId, userId }
    });

    const saveCount = await db.videoSave.count({ where: { videoId } });
    res.json({ saved: true, saveCount });
  } catch (error: any) {
    console.error("Error saving video:", error);
    res.status(500).json({ error: "Failed to save video" });
  }
});

// Get saved videos
router.get("/saved/mine", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { limit = 20, cursor } = req.query;

    const saves = await db.videoSave.findMany({
      where: { userId },
      include: {
        video: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
            },
            likes: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
    });

    const visibleVideos = [];
    for (const save of saves) {
      if (await canViewVideo(save.video, userId)) {
        const reactionCounts: Record<string, number> = {};
        save.video.likes.forEach((l: any) => {
          const type = l.type || 'LIKE';
          reactionCounts[type] = (reactionCounts[type] || 0) + 1;
        });
        
        visibleVideos.push({
          ...save.video,
          savedAt: save.createdAt,
          reactionCounts,
          totalReactions: save.video.likes.length
        });
      }
    }

    res.json({
      videos: visibleVideos,
      nextCursor: saves.length === parseInt(limit as string) ? saves[saves.length - 1].id : null,
    });
  } catch (error: any) {
    console.error("Error fetching saved videos:", error);
    res.status(500).json({ error: "Failed to fetch saved videos" });
  }
});

// ============================================
// REPORTING
// ============================================

// Report video
router.post("/:videoId/report", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const reporterId = (req as any).user.id;
    const { reason, details } = req.body;

    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ error: `Invalid reason. Must be one of: ${REPORT_REASONS.join(", ")}` });
    }

    const video = await db.video.findUnique({ where: { id: videoId } });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const existingReport = await db.videoReport.findFirst({
      where: { videoId, reporterId, status: "PENDING" }
    });

    if (existingReport) {
      return res.status(400).json({ error: "You have already reported this video" });
    }

    await db.videoReport.create({
      data: {
        videoId,
        reporterId,
        reason,
        details
      }
    });

    res.json({ message: "Report submitted. Thank you for helping keep our community safe." });
  } catch (error: any) {
    console.error("Error reporting video:", error);
    res.status(500).json({ error: "Failed to report video" });
  }
});

// ============================================
// FEEDS
// ============================================

// Get video feed
router.get("/feed/recent", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { limit = 20, cursor } = req.query;

    const friendships = await db.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ initiatorId: userId }, { receiverId: userId }],
      },
    });

    const friendIds = friendships.map((f: any) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    const videos = await db.video.findMany({
      where: {
        publishedAt: { not: null },
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
        likes: true,
        tags: {
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

    const videosWithDetails = videos.map((video: any) => {
      const reactionCounts: Record<string, number> = {};
      const userReactions: string[] = [];
      
      video.likes.forEach((l: any) => {
        const type = l.type || 'LIKE';
        reactionCounts[type] = (reactionCounts[type] || 0) + 1;
        if (l.userId === userId) {
          userReactions.push(type);
        }
      });

      return {
        ...video,
        reactionCounts,
        userReactions,
        totalReactions: video.likes.length,
        isSaved: video.saves.length > 0,
      };
    });

    res.json({
      videos: videosWithDetails,
      nextCursor: videos.length === parseInt(limit as string) ? videos[videos.length - 1].id : null,
    });
  } catch (error: any) {
    console.error("Error fetching video feed:", error);
    res.status(500).json({ error: "Failed to fetch video feed" });
  }
});

// Get user's videos
router.get("/user/:userId", authenticateToken, async (req: any, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const viewerId = (req as any).userId;
    const { limit = 20, cursor } = req.query;

    const isOwner = targetUserId === viewerId;
    const friendIds: string[] = [];

    if (!isOwner && viewerId) {
      const friendships = await db.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [
            { initiatorId: targetUserId, receiverId: viewerId },
            { initiatorId: viewerId, receiverId: targetUserId },
          ],
        },
      });
      friendIds.push(...friendships.map((f: any) => f.initiatorId === viewerId ? f.receiverId : f.initiatorId));
    }

    const isFriend = friendIds.includes(targetUserId);

    const visibilityFilter = isOwner
      ? {}
      : isFriend
        ? { visibility: { in: ["PUBLIC", "FRIENDS"] } }
        : { visibility: "PUBLIC" };

    const videos = await db.video.findMany({
      where: {
        userId: targetUserId,
        publishedAt: { not: null },
        ...visibilityFilter,
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
        likes: true,
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
    });

    const videosWithDetails = videos.map((video: any) => {
      const reactionCounts: Record<string, number> = {};
      video.likes.forEach((l: any) => {
        const type = l.type || 'LIKE';
        reactionCounts[type] = (reactionCounts[type] || 0) + 1;
      });

      return {
        ...video,
        reactionCounts,
        totalReactions: video.likes.length,
        userReactions: video.likes.filter((l: any) => l.userId === viewerId).map((l: any) => l.type || 'LIKE'),
      };
    });

    res.json({
      videos: videosWithDetails,
      nextCursor: videos.length === parseInt(limit as string) ? videos[videos.length - 1].id : null,
    });
  } catch (error: any) {
    console.error("Error fetching user videos:", error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// Get user's pinned video
router.get("/user/:userId/pinned", authenticateToken, async (req: any, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const viewerId = (req as any).userId;

    const pinnedVideo = await db.video.findFirst({
      where: { userId: targetUserId, isPinned: true },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
        },
        likes: true,
      },
    });

    if (!pinnedVideo) {
      return res.json(null);
    }

    if (!(await canViewVideo(pinnedVideo, viewerId))) {
      return res.json(null);
    }

    res.json(pinnedVideo);
  } catch (error: any) {
    console.error("Error fetching pinned video:", error);
    res.status(500).json({ error: "Failed to fetch pinned video" });
  }
});

// Bulk update visibility
router.patch("/bulk/visibility", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { videoIds, visibility } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds must be a non-empty array" });
    }

    if (!["PUBLIC", "FRIENDS", "PRIVATE"].includes(visibility)) {
      return res.status(400).json({ error: "Invalid visibility value" });
    }

    const videos = await db.video.findMany({
      where: { id: { in: videoIds } },
    });

    const notOwned = videos.filter((v: any) => v.userId !== userId);
    if (notOwned.length > 0) {
      return res.status(403).json({ error: "You can only update your own videos" });
    }

    await db.video.updateMany({
      where: { id: { in: videoIds }, userId },
      data: { visibility },
    });

    res.json({ message: `Updated ${videoIds.length} videos to ${visibility}` });
  } catch (error: any) {
    console.error("Error bulk updating videos:", error);
    res.status(500).json({ error: "Failed to update videos" });
  }
});

// Track video completion (for analytics)
router.post("/:videoId/complete", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).user.id;
    const { watchedSeconds, totalDuration } = req.body;

    // Update completion stats (could be stored in a separate analytics table)
    // For now, just acknowledge
    res.json({ 
      recorded: true,
      completionRate: totalDuration ? (watchedSeconds / totalDuration * 100).toFixed(1) : 0
    });
  } catch (error: any) {
    console.error("Error recording completion:", error);
    res.status(500).json({ error: "Failed to record completion" });
  }
});

export default router;
