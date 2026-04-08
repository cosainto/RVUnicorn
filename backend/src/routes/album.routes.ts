import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import path from 'path';
import fs from 'fs';
import { getAlbumAccess, getImplicitlyAccessibleAlbumIds } from '../services/album-access.service';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype); if (ok) { cb(null, true); } else { cb(new Error('Images only')); } } });

// Helper to get user ID from request
const getUserId = (req: any): string => {
  return req.user?.userId || req.userId;
};

// Create album
router.post('/', authenticateToken, upload.array('photos', 100), async (req, res) => {
  try {
    const { title, description, privacy } = req.body;
    const files = req.files as Express.Multer.File[];
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required' });
    }

    // Create album
    const album = await prisma.photoAlbum.create({
      data: {
        title,
        description,
        privacy: privacy || 'PUBLIC',
        userId: userId,
      },
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
    });

    // Create photos
    const photoPromises = files.map(async (file) => {
      const url = await uploadBufferToCloudinary(file.buffer, 'rvunicorn/photos');
      return prisma.photo.create({
        data: {
          albumId: album.id,
          userId: userId,
          imageUrl: url,
          caption: '',
        },
      });
    });

    await Promise.all(photoPromises);

    const albumWithPhotos = await prisma.photoAlbum.findUnique({
      where: { id: album.id },
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
        photos: true,
        _count: {
          select: {
            photos: true,
          },
        },
      },
    });

    res.json(albumWithPhotos);
  } catch (error) {
    console.error('Create album error:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// Get all albums (with privacy filtering)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = getUserId(req);

    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { initiatorId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
    });

    const friendIds = friendships.map((f) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    const albums = await prisma.photoAlbum.findMany({
      where: {
        OR: [
          { privacy: 'PUBLIC' },
          { userId: userId },
          {
            AND: [
              { privacy: 'FRIENDS' },
              { userId: { in: friendIds } },
            ],
          },
        ],
      },
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
        photos: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            photos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(albums);
  } catch (error) {
    console.error('Get albums error:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// Get user's albums
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId: profileUserId } = req.params;
    const currentUserId = getUserId(req);
    const isOwnProfile = profileUserId === currentUserId;

    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { initiatorId: currentUserId, status: 'ACCEPTED' },
          { receiverId: currentUserId, status: 'ACCEPTED' },
        ],
      },
    });

    const friendIds = friendships.map((f) =>
      f.initiatorId === currentUserId ? f.receiverId : f.initiatorId
    );

    const isFriend = friendIds.includes(profileUserId);

    let privacyFilter: any = { privacy: 'PUBLIC' };

    if (isOwnProfile) {
      privacyFilter = {};
    } else if (isFriend) {
      privacyFilter = { privacy: { in: ['PUBLIC', 'FRIENDS'] } };
    }

    // Albums where the profile user is the owner
    const ownedAlbums = await prisma.photoAlbum.findMany({
      where: {
        userId: profileUserId,
        ...privacyFilter,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
        photos: { take: 1, orderBy: { createdAt: 'asc' } },
        _count: { select: { photos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Albums where the profile user is an explicit collaborator
    const explicitlySharedAlbums = await prisma.photoAlbum.findMany({
      where: {
        collaborators: { some: { userId: profileUserId } },
        ...privacyFilter,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
        photos: { take: 1, orderBy: { createdAt: 'asc' } },
        _count: { select: { photos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Albums the profile user has IMPLICIT access to — owned by their
    // co-pilot, or linked to an event they're attending. These count as
    // "shared with them" too.
    const implicitIds = await getImplicitlyAccessibleAlbumIds(profileUserId);
    const implicitlySharedAlbums = implicitIds.length > 0
      ? await prisma.photoAlbum.findMany({
          where: {
            id: { in: implicitIds },
            ...privacyFilter,
          },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
            },
            photos: { take: 1, orderBy: { createdAt: 'asc' } },
            _count: { select: { photos: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // Dedupe — an album might appear in both explicit and implicit lists
    const sharedAlbums = [...explicitlySharedAlbums, ...implicitlySharedAlbums];
    const seenSharedIds = new Set<string>();
    const uniqueShared = sharedAlbums.filter(a => {
      if (seenSharedIds.has(a.id)) return false;
      seenSharedIds.add(a.id);
      return true;
    });

    // Tag shared albums so the client can show "Shared by X"
    const tagged = [
      ...ownedAlbums.map(a => ({ ...a, isShared: false })),
      ...uniqueShared.map(a => ({ ...a, isShared: true })),
    ];

    // Sort combined list by createdAt desc
    tagged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(tagged);
  } catch (error) {
    console.error('Get user albums error:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// Get single album
router.get('/:albumId', authenticateToken, async (req, res) => {
  try {
    const { albumId } = req.params;
    const userId = getUserId(req);

    const album = await prisma.photoAlbum.findUnique({
      where: { id: albumId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
        photos: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        collaborators: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
            },
          },
        },
        _count: { select: { photos: true } },
      },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    // Owner / explicit collaborator / co-pilot / event co-attendee → full read+write
    const access = await getAlbumAccess(albumId, userId);

    if (!access.canRead) {
      // Fall back to FRIENDS visibility — the access service handles
      // PUBLIC and explicit access tiers, but FRIENDS still needs a
      // friendship lookup which depends on the friendship table.
      if (album.privacy === 'FRIENDS') {
        const friendship = await prisma.friendship.findFirst({
          where: {
            status: 'ACCEPTED',
            OR: [
              { initiatorId: userId, receiverId: album.userId },
              { initiatorId: album.userId, receiverId: userId },
            ],
          },
        });
        if (!friendship) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({
      ...album,
      isCollaborator: access.isCollaborator,
      isOwner: access.isOwner,
      // Surface the new access tiers so the UI can show "You're collaborating
      // because you're [name]'s co-pilot" or "...because you're both on the trip"
      isCoPilot: access.isCoPilot,
      isEventCoAttendee: access.isEventCoAttendee,
      canWrite: access.canWrite,
      canManage: access.canManage,
    });
  } catch (error) {
    console.error('Get album error:', error);
    res.status(500).json({ error: 'Failed to fetch album' });
  }
});

// Update album
router.put('/:albumId', authenticateToken, async (req, res) => {
  try {
    const { albumId } = req.params;
    const { title, description, privacy } = req.body;
    const userId = getUserId(req);

    const album = await prisma.photoAlbum.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    if (album.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedAlbum = await prisma.photoAlbum.update({
      where: { id: albumId },
      data: {
        title,
        description,
        privacy,
      },
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
        photos: true,
        _count: {
          select: {
            photos: true,
          },
        },
      },
    });

    res.json(updatedAlbum);
  } catch (error) {
    console.error('Update album error:', error);
    res.status(500).json({ error: 'Failed to update album' });
  }
});

// Delete album
router.delete('/:albumId', authenticateToken, async (req, res) => {
  try {
    const { albumId } = req.params;
    const userId = getUserId(req);

    const album = await prisma.photoAlbum.findUnique({
      where: { id: albumId },
      include: { photos: true },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    if (album.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete photo files
    album.photos.forEach((photo) => {
      const filepath = path.join(__dirname, '../..', photo.imageUrl);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });

    await prisma.photoAlbum.delete({
      where: { id: albumId },
    });

    res.json({ message: 'Album deleted' });
  } catch (error) {
    console.error('Delete album error:', error);
    res.status(500).json({ error: 'Failed to delete album' });
  }
});

// ── Collaborators ─────────────────────────────────────────────

// List collaborators on an album
router.get('/:albumId/collaborators', authenticateToken, async (req, res) => {
  try {
    const { albumId } = req.params;
    const collaborators = await prisma.photoAlbumCollaborator.findMany({
      where: { albumId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
        },
      },
      orderBy: { addedAt: 'asc' },
    });
    res.json(collaborators);
  } catch (error) {
    console.error('List collaborators error:', error);
    res.status(500).json({ error: 'Failed to list collaborators' });
  }
});

// Add a collaborator (owner only) — accepts { username } or { userId }
router.post('/:albumId/collaborators', authenticateToken, async (req, res) => {
  try {
    const { albumId } = req.params;
    const { username, userId: targetUserId } = req.body;
    const userId = getUserId(req);

    const album = await prisma.photoAlbum.findUnique({ where: { id: albumId } });
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.userId !== userId) {
      return res.status(403).json({ error: 'Only the album owner can add collaborators' });
    }

    let collaboratorUserId = targetUserId as string | undefined;
    if (!collaboratorUserId && username) {
      const u = await prisma.user.findUnique({ where: { username } });
      if (!u) return res.status(404).json({ error: `No user found with username "${username}"` });
      collaboratorUserId = u.id;
    }
    if (!collaboratorUserId) {
      return res.status(400).json({ error: 'username or userId required' });
    }
    if (collaboratorUserId === album.userId) {
      return res.status(400).json({ error: "You're already the owner of this album" });
    }

    try {
      const collab = await prisma.photoAlbumCollaborator.create({
        data: { albumId, userId: collaboratorUserId },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
          },
        },
      });
      res.json(collab);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return res.status(409).json({ error: 'That user is already a collaborator' });
      }
      throw e;
    }
  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

// Remove a collaborator — owner can remove anyone, collaborator can remove themselves
router.delete('/:albumId/collaborators/:collaboratorUserId', authenticateToken, async (req, res) => {
  try {
    const { albumId, collaboratorUserId } = req.params;
    const userId = getUserId(req);

    const album = await prisma.photoAlbum.findUnique({ where: { id: albumId } });
    if (!album) return res.status(404).json({ error: 'Album not found' });

    const isOwner = album.userId === userId;
    const isSelf = collaboratorUserId === userId;
    if (!isOwner && !isSelf) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.photoAlbumCollaborator.deleteMany({
      where: { albumId, userId: collaboratorUserId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// Add photos to album — owner or collaborator
router.post('/:albumId/photos', authenticateToken, upload.array('photos', 100), async (req, res) => {
  try {
    const { albumId } = req.params;
    const files = req.files as Express.Multer.File[];
    const userId = getUserId(req);

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required' });
    }

    // Owner, explicit collaborator, the owner's co-pilot, or a co-attendee
    // on the linked event can all upload — see services/album-access.service.ts
    const access = await getAlbumAccess(albumId, userId);
    if (!access.exists) return res.status(404).json({ error: 'Album not found' });
    if (!access.canWrite) return res.status(403).json({ error: 'Not authorized' });

    const photoPromises = files.map(async (file) => {
      const url = await uploadBufferToCloudinary(file.buffer, 'rvunicorn/photos');
      return prisma.photo.create({
        data: {
          albumId,
          userId: userId,
          imageUrl: url,
          caption: '',
        },
      });
    });

    const photos = await Promise.all(photoPromises);

    res.json(photos);
  } catch (error) {
    console.error('Add photos error:', error);
    res.status(500).json({ error: 'Failed to add photos' });
  }
});

// Update photo caption
router.put('/photos/:photoId', authenticateToken, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { caption } = req.body;
    const userId = getUserId(req);

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { album: true },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (photo.album?.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedPhoto = await prisma.photo.update({
      where: { id: photoId },
      data: { caption },
    });

    res.json(updatedPhoto);
  } catch (error) {
    console.error('Update photo error:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// Delete photo
router.delete('/photos/:photoId', authenticateToken, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = getUserId(req);

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { album: true },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (photo.album?.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete file
    const filepath = path.join(__dirname, '../..', photo.imageUrl);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    await prisma.photo.delete({
      where: { id: photoId },
    });

    res.json({ message: 'Photo deleted' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;
