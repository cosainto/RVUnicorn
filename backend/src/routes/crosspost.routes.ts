import express from "express";
import { authenticateToken } from "../middleware/auth.middleware";

const router = express.Router();
import { prisma } from '../lib/prisma';

// ============================================
// CROSS-POST: Share to Album + Basecamp
// ============================================

// Cross-post a new photo (upload to album AND share to basecamp)
router.post("/photo", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      imageUrl,
      caption,
      albumId,
      visibility = "PUBLIC",
      basecampMessage,
      shareToBasecamp = true,
      mentions = []
    } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }

    // 1. Create the photo
    const photo = await prisma.photo.create({
      data: {
        userId,
        imageUrl,
        caption,
        albumId: albumId || null,
        visibility,
        mentions,
        publishedAt: new Date()
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        },
        album: { select: { id: true, title: true } }
      }
    });

    let activity = null;

    // 2. Create basecamp activity if requested
    if (shareToBasecamp) {
      activity = await prisma.activity.create({
        data: {
          userId,
          type: "PHOTO_UPLOAD",
          content: basecampMessage || caption || "shared a photo",
          isPublic: visibility === "PUBLIC",
          metadata: {
            photoId: photo.id,
            imageUrl: photo.imageUrl,
            albumId: photo.albumId,
            albumTitle: photo.album?.title,
            crossPosted: true
          }
        }
      });
    }

    // 3. Create notifications for mentions
    if (mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: { username: { in: mentions } },
        select: { id: true }
      });

      await prisma.notification.createMany({
        data: mentionedUsers.map((u: any) => ({
          userId: u.id,
          type: "PHOTO_MENTION",
          content: `mentioned you in a photo`,
          link: `/photos/${photo.id}`
        }))
      });
    }

    res.status(201).json({
      photo,
      activity,
      crossPosted: shareToBasecamp
    });
  } catch (error: any) {
    console.error("Error cross-posting photo:", error);
    res.status(500).json({ error: "Failed to cross-post photo" });
  }
});

// Cross-post a new video
router.post("/video", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      videoUrl,
      thumbnailUrl,
      title,
      description,
      albumId,
      duration,
      visibility = "PUBLIC",
      basecampMessage,
      shareToBasecamp = true,
      mentions = []
    } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: "videoUrl is required" });
    }

    // 1. Create the video
    const video = await prisma.video.create({
      data: {
        userId,
        videoUrl,
        thumbnailUrl,
        title: title || "Untitled Video",
        description,
        albumId: albumId || null,
        duration: duration ? parseInt(duration) : null,
        visibility,
        mentions,
        publishedAt: new Date()
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        },
        album: { select: { id: true, title: true } }
      }
    });

    let activity = null;

    // 2. Create basecamp activity if requested
    if (shareToBasecamp) {
      activity = await prisma.activity.create({
        data: {
          userId,
          type: "VIDEO_UPLOAD",
          content: basecampMessage || title || "shared a video",
          isPublic: visibility === "PUBLIC",
          metadata: {
            videoId: video.id,
            videoUrl: video.videoUrl,
            thumbnailUrl: video.thumbnailUrl,
            title: video.title,
            duration: video.duration,
            albumId: video.albumId,
            albumTitle: video.album?.title,
            crossPosted: true
          }
        }
      });
    }

    // 3. Create notifications for mentions
    if (mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: { username: { in: mentions } },
        select: { id: true }
      });

      await prisma.notification.createMany({
        data: mentionedUsers.map((u: any) => ({
          userId: u.id,
          type: "VIDEO_MENTION",
          content: `mentioned you in a video`,
          link: `/videos/${video.id}`
        }))
      });
    }

    res.status(201).json({
      video,
      activity,
      crossPosted: shareToBasecamp
    });
  } catch (error: any) {
    console.error("Error cross-posting video:", error);
    res.status(500).json({ error: "Failed to cross-post video" });
  }
});

// Share an EXISTING photo to basecamp
router.post("/photo/:photoId/share", authenticateToken, async (req: any, res) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).user.id;
    const { message, visibility = "PUBLIC" } = req.body;

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
        album: { select: { id: true, title: true } }
      }
    });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Check if user can share (owner or public photo)
    if (photo.userId !== userId && photo.visibility !== "PUBLIC") {
      return res.status(403).json({ error: "Cannot share this photo" });
    }

    // Create share activity
    const activity = await prisma.activity.create({
      data: {
        userId,
        type: "PHOTO_SHARE",
        content: message || `shared a photo${photo.album ? ` from ${photo.album.title}` : ''}`,
        isPublic: visibility === "PUBLIC",
        metadata: {
          photoId: photo.id,
          imageUrl: photo.imageUrl,
          caption: photo.caption,
          originalOwnerId: photo.userId,
          originalOwnerName: `${photo.user.firstName} ${photo.user.lastName}`,
          albumTitle: photo.album?.title
        }
      }
    });

    // Notify original owner if sharing someone else's photo
    if (photo.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: photo.userId,
          type: "PHOTO_SHARED",
          content: `shared your photo to basecamp`,
          link: `/photos/${photo.id}`
        }
      });
    }

    res.json({
      activity,
      message: "Photo shared to basecamp"
    });
  } catch (error: any) {
    console.error("Error sharing photo:", error);
    res.status(500).json({ error: "Failed to share photo" });
  }
});

// Share an EXISTING video to basecamp
router.post("/video/:videoId/share", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = (req as any).user.id;
    const { message, visibility = "PUBLIC" } = req.body;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
        album: { select: { id: true, title: true } }
      }
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (video.userId !== userId && video.visibility !== "PUBLIC") {
      return res.status(403).json({ error: "Cannot share this video" });
    }

    const activity = await prisma.activity.create({
      data: {
        userId,
        type: "VIDEO_SHARE",
        content: message || `shared a video: ${video.title}`,
        isPublic: visibility === "PUBLIC",
        metadata: {
          videoId: video.id,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          title: video.title,
          duration: video.duration,
          originalOwnerId: video.userId,
          originalOwnerName: `${video.user.firstName} ${video.user.lastName}`,
          albumTitle: video.album?.title
        }
      }
    });

    if (video.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: video.userId,
          type: "VIDEO_SHARED",
          content: `shared your video to basecamp`,
          link: `/videos/${video.id}`
        }
      });
    }

    res.json({
      activity,
      message: "Video shared to basecamp"
    });
  } catch (error: any) {
    console.error("Error sharing video:", error);
    res.status(500).json({ error: "Failed to share video" });
  }
});

// Share multiple photos as a collection to basecamp
router.post("/collection", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { photoIds, title, message, visibility = "PUBLIC" } = req.body;

    if (!photoIds || photoIds.length === 0) {
      return res.status(400).json({ error: "At least one photo is required" });
    }

    if (photoIds.length > 10) {
      return res.status(400).json({ error: "Maximum 10 photos per collection share" });
    }

    // Verify all photos exist and user can share them
    const photos = await prisma.photo.findMany({
      where: {
        id: { in: photoIds },
        OR: [
          { userId },
          { visibility: "PUBLIC" }
        ]
      },
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        userId: true
      }
    });

    if (photos.length !== photoIds.length) {
      return res.status(400).json({ error: "Some photos not found or not accessible" });
    }

    const activity = await prisma.activity.create({
      data: {
        userId,
        type: "PHOTO_COLLECTION_SHARE",
        content: message || title || `shared ${photos.length} photos`,
        isPublic: visibility === "PUBLIC",
        metadata: {
          title,
          photoCount: photos.length,
          photos: photos.map((p: any) => ({
            id: p.id,
            imageUrl: p.imageUrl,
            caption: p.caption
          })),
          previewImages: photos.slice(0, 4).map((p: any) => p.imageUrl)
        }
      }
    });

    res.json({
      activity,
      message: `${photos.length} photos shared to basecamp`
    });
  } catch (error: any) {
    console.error("Error sharing collection:", error);
    res.status(500).json({ error: "Failed to share collection" });
  }
});

export default router;
