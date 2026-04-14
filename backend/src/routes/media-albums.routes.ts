import express from "express";
import { PrismaClient, Visibility, MediaType, VideoStatus, TagStatus } from "@prisma/client";
import { authenticateToken, optionalAuth } from "../middleware/auth.middleware";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
const { randomUUID } = require('crypto');
const createId = () => randomUUID().replace(/-/g, '').slice(0, 25);

const router = express.Router();
const prisma = new PrismaClient() as any;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const imageTypes = /jpeg|jpg|png|gif|webp/;
    const videoTypes = /mp4|mov|webm|avi/;
    const ext = file.originalname.toLowerCase().split('.').pop() || '';
    const isImage = imageTypes.test(ext) || file.mimetype.startsWith('image/');
    const isVideo = videoTypes.test(ext) || file.mimetype.startsWith('video/');
    if (isImage || isVideo) return cb(null, true);
    cb(new Error('Only image and video files are allowed'));
  },
});

const getUserId = (req: any): string | null => (req as any).user?.userId || (req as any).user?.id || req.userId || null;
const isVideo = (mimetype: string, filename: string): boolean => 
  mimetype.startsWith('video/') || /\.(mp4|mov|webm|avi)$/i.test(filename);

async function canViewMedia(media: { uploaderId: string; visibility: Visibility }, viewerId?: string | null): Promise<boolean> {
  if (media.visibility === 'PUBLIC') return true;
  if (!viewerId) return false;
  if (media.uploaderId === viewerId) return true;
  if (media.visibility === 'FRIENDS_ONLY') {
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { initiatorId: media.uploaderId, receiverId: viewerId },
          { initiatorId: viewerId, receiverId: media.uploaderId },
        ],
      },
    });
    return !!friendship;
  }
  return false;
}

// GET /api/media-albums - List albums
router.get('/', optionalAuth, async (req, res) => {
  try {
    const viewerId = getUserId(req);
    const { userId, featured, discovery } = req.query;
    const where: any = {};
    if (userId) where.userId = userId as string;
    if (featured === 'true') where.featured = true;
    if (discovery === 'true') {
      where.discoveryEnabled = true;
      where.defaultVisibility = 'PUBLIC';
    }

    const albums = await prisma.album.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get media counts and previews
    const albumsWithData = await Promise.all(albums.map(async (album: any) => {
      const mediaCount = await prisma.media.count({ where: { albumId: album.id } });
      const previewMedia = await prisma.media.findMany({
        where: { albumId: album.id },
        take: 4,
        orderBy: { createdAt: 'desc' },
        select: { id: true, url: true, thumbnailUrl: true, type: true },
      });
      const user = await prisma.user.findUnique({
        where: { id: album.userId },
        select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
      });
      return { ...album, user, mediaCount, previewMedia };
    }));

    res.json(albumsWithData);
  } catch (error: any) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// GET /api/media-albums/:id - Get single album
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = getUserId(req);

    const album = await prisma.album.findUnique({ where: { id } });
    if (!album) return res.status(404).json({ error: 'Album not found' });

    const user = await prisma.user.findUnique({
      where: { id: album.userId },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
    });

    const media = await prisma.media.findMany({
      where: { albumId: id, OR: [{ processingStatus: null }, { processingStatus: 'READY' }] },
      orderBy: { createdAt: 'desc' },
    });

    const mediaCount = await prisma.media.count({ where: { albumId: id } });

    res.json({ ...album, user, media, mediaCount });
  } catch (error: any) {
    console.error('Error fetching album:', error);
    res.status(500).json({ error: 'Failed to fetch album' });
  }
});

// POST /api/media-albums - Create album
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { title, description, defaultVisibility, discoveryEnabled } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const album = await prisma.album.create({
      data: {
        id: createId(),
        userId,
        title: title.trim(),
        description: description?.trim() || null,
        defaultVisibility: defaultVisibility || 'FRIENDS_ONLY',
        discoveryEnabled: discoveryEnabled || false,
        updatedAt: new Date(),
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
    });

    // Create activity for feed
    await prisma.activity.create({
      data: {
        id: createId(),
        userId,
        type: 'ALBUM_CREATED',
        albumId: album.id,
        title: album.title,
        content: album.description,
        isPublic: album.defaultVisibility === 'PUBLIC',
      },
    });

    res.status(201).json({ ...album, user });
  } catch (error: any) {
    console.error('Error creating album:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// PATCH /api/media-albums/:id - Update album
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const { title, description, defaultVisibility, discoveryEnabled, featured } = req.body;

    const album = await prisma.album.findUnique({ where: { id } });
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const updated = await prisma.album.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(defaultVisibility && { defaultVisibility }),
        ...(discoveryEnabled !== undefined && { discoveryEnabled }),
        ...(featured !== undefined && { featured }),
        updatedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating album:', error);
    res.status(500).json({ error: 'Failed to update album' });
  }
});

// DELETE /api/media-albums/:id - Delete album
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const album = await prisma.album.findUnique({ where: { id } });
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const albumMedia = await prisma.media.findMany({ where: { albumId: id } });

    for (const media of albumMedia) {
      try {
        await cloudinary.uploader.destroy(media.cloudinaryId, {
          resource_type: media.type === 'VIDEO' ? 'video' : 'image',
        });
      } catch (e: any) {
        console.error('Failed to delete from Cloudinary:', e);
      }
    }

    await prisma.album.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting album:', error);
    res.status(500).json({ error: 'Failed to delete album' });
  }
});

// POST /api/media-albums/:albumId/media - Upload media
router.post('/:albumId/media', authenticateToken, upload.array('files', 50), async (req, res) => {
  try {
    const { albumId } = req.params;
    const userId = getUserId(req);
    const files = req.files as Express.Multer.File[];
    const { visibility, captions } = req.body;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const album = await prisma.album.findUnique({ where: { id: albumId } });
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.userId !== userId) return res.status(403).json({ error: 'Not authorized' });
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files provided' });

    const parsedCaptions = captions ? JSON.parse(captions) : [];
    const createdMedia = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideoFile = isVideo(file.mimetype, file.originalname);

      const uploadOptions: any = {
        folder: `rvunicorn/albums/${albumId}`,
        resource_type: isVideoFile ? 'video' : 'image',
      };

      if (isVideoFile) {
        uploadOptions.eager = [
          { streaming_profile: 'hd', format: 'm3u8' },
          { width: 1280, height: 720, crop: 'limit', format: 'mp4' },
          { width: 640, height: 360, crop: 'limit', format: 'mp4' },
          { width: 480, height: 270, crop: 'fill', format: 'jpg', start_offset: '2' },
        ];
        uploadOptions.eager_async = true;
      }

      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
        uploadStream.end(file.buffer);
      });

      const media = await prisma.media.create({
        data: {
          id: createId(),
          albumId,
          uploaderId: userId,
          type: isVideoFile ? 'VIDEO' : 'PHOTO',
          cloudinaryId: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          visibility: visibility || album.defaultVisibility,
          caption: parsedCaptions[i] || null,
          duration: isVideoFile ? Math.round(result.duration || 0) : null,
          thumbnailUrl: isVideoFile ? result.eager?.[3]?.secure_url : null,
          processingStatus: isVideoFile ? 'PROCESSING' : null,
          updatedAt: new Date(),
        },
      });

      createdMedia.push(media);
    }

    if (!album.coverMediaId && createdMedia.length > 0) {
      const firstImage = createdMedia.find(m => m.type === 'PHOTO');
      if (firstImage) {
        await prisma.album.update({
          where: { id: albumId },
          data: { coverMediaId: firstImage.id },
        });
      }
    }

    // Create activity for feed
    const photoCount = createdMedia.filter(m => m.type === 'PHOTO').length;
    const videoCount = createdMedia.filter(m => m.type === 'VIDEO').length;
    let content = '';
    if (photoCount > 0 && videoCount > 0) {
      content = `Added ${photoCount} photo${photoCount > 1 ? 's' : ''} and ${videoCount} video${videoCount > 1 ? 's' : ''}`;
    } else if (photoCount > 0) {
      content = `Added ${photoCount} photo${photoCount > 1 ? 's' : ''}`;
    } else {
      content = `Added ${videoCount} video${videoCount > 1 ? 's' : ''}`;
    }

    await prisma.activity.create({
      data: {
        id: createId(),
        userId,
        type: 'PHOTO_UPLOADED',
        albumId,
        title: album.title,
        content,
        isPublic: album.defaultVisibility === 'PUBLIC',
        metadata: JSON.stringify({
          mediaIds: createdMedia.map(m => m.id),
          previewUrl: createdMedia[0]?.thumbnailUrl || createdMedia[0]?.url,
        }),
      },
    });

    res.status(201).json({ uploaded: createdMedia.length, media: createdMedia });
  } catch (error: any) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// DELETE /api/media-albums/:albumId/media/:mediaId - Delete media
router.delete('/:albumId/media/:mediaId', authenticateToken, async (req, res) => {
  try {
    const { albumId, mediaId } = req.params;
    const userId = getUserId(req);

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const album = await prisma.album.findUnique({ where: { id: media.albumId } });
    if (!album || album.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    try {
      await cloudinary.uploader.destroy(media.cloudinaryId, {
        resource_type: media.type === 'VIDEO' ? 'video' : 'image',
      });
    } catch (e: any) {
      console.error('Failed to delete from Cloudinary:', e);
    }

    await prisma.media.delete({ where: { id: mediaId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// GET /api/media-albums/media/:mediaId/tags - Get tags for media
router.get('/media/:mediaId/tags', optionalAuth, async (req, res) => {
  try {
    const { mediaId } = req.params;

    const tags = await prisma.mediaTag.findMany({
      where: { mediaId },
      orderBy: { createdAt: 'desc' },
    });

    // Get user info for each tag
    const userIds = [...new Set([...tags.map((t: any) => t.taggedUserId), ...tags.map((t: any) => t.taggedById)])];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
    });
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

    const tagsWithUsers = tags.map((t: any) => ({
      ...t,
      taggedUser: userMap[t.taggedUserId],
      taggedBy: userMap[t.taggedById],
    }));

    res.json(tagsWithUsers);
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/media-albums/media/:mediaId/tags - Tag user
router.post('/media/:mediaId/tags', authenticateToken, async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = getUserId(req);
    const { taggedUserId, positionX, positionY } = req.body;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!taggedUserId) return res.status(400).json({ error: 'taggedUserId is required' });

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const album = await prisma.album.findUnique({ where: { id: media.albumId } });
    if (!album) return res.status(404).json({ error: 'Album not found' });
    
    // Allow owner or friends to tag
    let canTag = album.userId === userId;
    if (!canTag) {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { initiatorId: userId, receiverId: album.userId },
            { initiatorId: album.userId, receiverId: userId },
          ],
        },
      });
      canTag = !!friendship;
    }
    if (!canTag) return res.status(403).json({ error: 'Only album owner or friends can tag' });

    const taggedUser = await prisma.user.findUnique({
      where: { id: taggedUserId },
      select: { allowTagsFrom: true, tagApprovalMode: true },
    });
    if (!taggedUser) return res.status(404).json({ error: 'User not found' });

    const blocked = await prisma.blockedTagger.findUnique({
      where: { blockedById_blockedUserId: { blockedById: taggedUserId, blockedUserId: userId } },
    });
    if (blocked) return res.status(403).json({ error: 'You cannot tag this user' });

    if (taggedUser.allowTagsFrom === 'NO_ONE') return res.status(403).json({ error: 'User has disabled tagging' });

    if (taggedUser.allowTagsFrom === 'FRIENDS_ONLY') {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { initiatorId: userId, receiverId: taggedUserId },
            { initiatorId: taggedUserId, receiverId: userId },
          ],
        },
      });
      if (!friendship) return res.status(403).json({ error: 'User only allows tags from friends' });
    }

    const status = taggedUser.tagApprovalMode === 'AUTO_APPROVE' ? 'APPROVED' : 'PENDING';

    const tag = await prisma.mediaTag.create({
      data: {
        id: createId(),
        mediaId,
        taggedById: userId,
        taggedUserId,
        status,
        positionX: positionX || null,
        positionY: positionY || null,
      },
    });

    // Create notification for tagged user
    if (taggedUserId !== userId) {
      try {
        await prisma.basecampActivity.create({
          data: {
            id: createId(),
            userId: taggedUserId,
            actorId: userId,
            type: 'PHOTO_TAG',
            entityType: 'media',
            entityId: mediaId,
            entityName: album.title || 'a photo',
            metadata: {
              albumId: album.id,
              mediaId,
              tagId: tag.id,
              status,
              imageUrl: media.thumbnailUrl || media.url,
              albumTitle: album.title,
            },
          },
        });
      } catch (notifError) {
        console.log('Failed to create tag notification:', notifError);
      }
    }

    res.status(201).json(tag);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'User is already tagged' });
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// DELETE /api/media-albums/media/:mediaId/tags/:tagId - Remove tag
router.delete('/media/:mediaId/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { mediaId, tagId } = req.params;
    const userId = getUserId(req);

    const tag = await prisma.mediaTag.findUnique({ where: { id: tagId } });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });

    const media = await prisma.media.findUnique({ where: { id: tag.mediaId } });
    const album = media ? await prisma.album.findUnique({ where: { id: media.albumId } }) : null;

    const canRemove = (album && album.userId === userId) || tag.taggedById === userId || tag.taggedUserId === userId;
    if (!canRemove) return res.status(403).json({ error: 'Not authorized' });

    await prisma.mediaTag.delete({ where: { id: tagId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// PATCH /api/media-albums/media/:mediaId/tags/:tagId - Approve/reject tag
router.patch('/media/:mediaId/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { tagId } = req.params;
    const userId = getUserId(req);
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const tag = await prisma.mediaTag.findUnique({ where: { id: tagId } });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    if (tag.taggedUserId !== userId) return res.status(403).json({ error: 'Only tagged user can respond' });

    const updated = await prisma.mediaTag.update({
      where: { id: tagId },
      data: { status, respondedAt: new Date() },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// POST /api/media-albums/media/:mediaId/reactions - Add reaction
router.post('/media/:mediaId/reactions', authenticateToken, async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = getUserId(req);
    const { type } = req.body;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!['LIKE', 'LOVE', 'THUMBS_UP', 'THUMBS_DOWN'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return res.status(404).json({ error: 'Media not found' });
    if (!(await canViewMedia(media, userId))) return res.status(403).json({ error: 'Access denied' });

    const reaction = await prisma.mediaReaction.upsert({
      where: { mediaId_userId_type: { mediaId, userId, type } },
      create: { id: createId(), mediaId, userId, type },
      update: {},
    });

    res.status(201).json(reaction);
  } catch (error: any) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// DELETE /api/media-albums/media/:mediaId/reactions/:type - Remove reaction
router.delete('/media/:mediaId/reactions/:type', authenticateToken, async (req, res) => {
  try {
    const { mediaId, type } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await prisma.mediaReaction.deleteMany({ where: { mediaId, userId, type: type as any } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// GET /api/media-albums/media/:mediaId/comments - Get comments
router.get('/media/:mediaId/comments', optionalAuth, async (req, res) => {
  try {
    const { mediaId } = req.params;
    const viewerId = getUserId(req);

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return res.status(404).json({ error: 'Media not found' });
    if (!(await canViewMedia(media, viewerId))) return res.status(403).json({ error: 'Access denied' });

    const comments = await prisma.mediaComment.findMany({
      where: { mediaId, parentId: null },
      orderBy: { createdAt: 'desc' },
    });

    // Get users for comments
    const userIds = [...new Set(comments.map((c: any) => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
    });
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

    const commentsWithUsers = comments.map((c: any) => ({ ...c, user: userMap[c.userId] }));
    res.json(commentsWithUsers);
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/media-albums/media/:mediaId/comments - Add comment
router.post('/media/:mediaId/comments', authenticateToken, async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = getUserId(req);
    const { content, parentId, imageUrl } = req.body;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!content?.trim() && !imageUrl) return res.status(400).json({ error: 'Content or image is required' });

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return res.status(404).json({ error: 'Media not found' });
    if (!(await canViewMedia(media, userId))) return res.status(403).json({ error: 'Access denied' });

    const comment = await prisma.mediaComment.create({
      data: {
        id: createId(),
        mediaId,
        userId,
        content: content?.trim() || '',
        imageUrl: imageUrl || null,
        parentId: parentId || null,
        updatedAt: new Date(),
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
    });

    res.status(201).json({ ...comment, user });
  } catch (error: any) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// DELETE /api/media-albums/media/:mediaId/comments/:commentId - Delete comment
router.delete('/media/:mediaId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = getUserId(req);

    const comment = await prisma.mediaComment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const media = await prisma.media.findUnique({ where: { id: comment.mediaId } });
    const album = media ? await prisma.album.findUnique({ where: { id: media.albumId } }) : null;

    if (comment.userId !== userId && (!album || album.userId !== userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.mediaComment.delete({ where: { id: commentId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// POST /api/media-albums/media/:mediaId/impressions - Log impression
router.post('/media/:mediaId/impressions', optionalAuth, async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = getUserId(req);
    const { source } = req.body;

    await prisma.mediaImpression.create({
      data: {
        id: createId(),
        mediaId,
        userId: userId || null,
        source: source || 'FEED',
      },
    });

    res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('Error logging impression:', error);
    res.status(500).json({ error: 'Failed to log impression' });
  }
});

// POST /api/media-albums/media/:mediaId/reports - Report media
router.post('/media/:mediaId/reports', authenticateToken, async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = getUserId(req);
    const { reason, description } = req.body;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!['INAPPROPRIATE', 'SPAM', 'HARASSMENT', 'COPYRIGHT', 'OTHER'].includes(reason)) {
      return res.status(400).json({ error: 'Invalid reason' });
    }

    const report = await prisma.mediaReport.create({
      data: {
        id: createId(),
        mediaId,
        reporterId: userId,
        reason,
        description: description || null,
      },
    });

    res.status(201).json(report);
  } catch (error: any) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// POST /api/media-albums/webhooks/cloudinary - Cloudinary webhook
router.post('/webhooks/cloudinary', async (req, res) => {
  try {
    const { notification_type, public_id, eager } = req.body;

    if (notification_type === 'eager') {
      const media = await prisma.media.findFirst({ where: { cloudinaryId: public_id } });

      if (media && media.type === 'VIDEO') {
        const hlsVersion = eager?.find((e: any) => e.format === 'm3u8');
        const hdVersion = eager?.find((e: any) => e.format === 'mp4' && e.width === 1280);
        const sdVersion = eager?.find((e: any) => e.format === 'mp4' && e.width === 640);
        const thumbnail = eager?.find((e: any) => e.format === 'jpg');

        await prisma.media.update({
          where: { id: media.id },
          data: {
            hlsUrl: hlsVersion?.secure_url || null,
            mp4UrlHd: hdVersion?.secure_url || null,
            mp4UrlSd: sdVersion?.secure_url || null,
            thumbnailUrl: thumbnail?.secure_url || media.thumbnailUrl,
            processingStatus: 'READY',
          },
        });
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    console.error('Cloudinary webhook error:', error);
    res.sendStatus(500);
  }
});

export default router;
