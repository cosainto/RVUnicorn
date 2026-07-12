import express from "express";
import { authenticateToken } from "../middleware/auth.middleware";

const router = express.Router();
import { prisma } from '../lib/prisma';

// Create comment on photo or album
router.post("/", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { photoId, albumId, content } = req.body;

    if (!content || (!photoId && !albumId)) {
      return res.status(400).json({ error: "Content and photoId or albumId required" });
    }

    const comment = await prisma.photoComment.create({
      data: {
        userId,
        photoId: photoId || null,
        albumId: albumId || null,
        content
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    // Notify photo/album owner
    let ownerId = null;
    if (photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: photoId }, select: { userId: true } });
      ownerId = photo?.userId;
    } else if (albumId) {
      const album = await prisma.photoAlbum.findUnique({ where: { id: albumId }, select: { userId: true } });
      ownerId = album?.userId;
    }

    if (ownerId && ownerId !== userId) {
      await prisma.notification.create({
        data: {
          userId: ownerId,
          type: "PHOTO_COMMENT",
          content: "commented on your photo",
          link: photoId ? `/photos/${photoId}` : `/albums/${albumId}`
        }
      });
    }

    res.status(201).json(comment);
  } catch (error: any) {
    console.error("Create comment error:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// Get comments for photo or album
router.get("/", async (req, res) => {
  try {
    const { photoId, albumId } = req.query;

    const comments = await prisma.photoComment.findMany({
      where: {
        ...(photoId && { photoId: photoId as string }),
        ...(albumId && { albumId: albumId as string })
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(comments);
  } catch (error: any) {
    console.error("Get comments error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// Delete comment
router.delete("/:commentId", authenticateToken, async (req: any, res) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.id;

    const comment = await prisma.photoComment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: "Cannot delete this comment" });
    }

    await prisma.photoComment.delete({ where: { id: commentId } });

    res.json({ message: "Comment deleted" });
  } catch (error: any) {
    console.error("Delete comment error:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
