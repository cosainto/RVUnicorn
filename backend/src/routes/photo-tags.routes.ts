import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// Get tags for a photo
router.get('/:photoId/tags', async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;

    const userTags = await prisma.photoTag.findMany({
      where: { photoId },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        },
        tagger: {
          select: { id: true, username: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const campgroundTags = await prisma.photoCampgroundTag.findMany({
      where: { photoId },
      include: {
        campground: {
          select: { id: true, name: true, location: true, state: true, imageUrl: true }
        },
        tagger: {
          select: { id: true, username: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ userTags, campgroundTags });
  } catch (error: any) {
    console.error('Get photo tags error:', error);
    res.status(500).json({ error: 'Failed to get photo tags' });
  }
});

// Tag a user in a photo
router.post('/:photoId/tag/user', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const { userId, x, y } = req.body;
    const taggerId = (req as any).user.id;

    // Verify photo exists
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Check if tag already exists
    const existingTag = await prisma.photoTag.findUnique({
      where: { photoId_userId: { photoId, userId } }
    });
    if (existingTag) {
      return res.status(400).json({ error: 'User already tagged in this photo' });
    }

    const tag = await prisma.photoTag.create({
      data: {
        photoId,
        userId,
        taggedBy: taggerId,
        x: x || null,
        y: y || null
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
        }
      }
    });

    // Create notification for the tagged user (if not tagging yourself)
    if (userId !== taggerId) {
      await prisma.notification.create({
        data: {
          userId: userId,
          type: 'PHOTO_TAG',
          content: 'tagged you in a photo',
          link: `/photos/${photoId}`
        }
      });
    }

    res.status(201).json(tag);
  } catch (error: any) {
    console.error('Tag user in photo error:', error);
    res.status(500).json({ error: 'Failed to tag user' });
  }
});

// Tag a campground in a photo
router.post('/:photoId/tag/campground', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const { campgroundId } = req.body;
    const taggerId = (req as any).user.id;

    // Verify photo exists
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Check if tag already exists
    const existingTag = await prisma.photoCampgroundTag.findUnique({
      where: { photoId_campgroundId: { photoId, campgroundId } }
    });
    if (existingTag) {
      return res.status(400).json({ error: 'Campground already tagged in this photo' });
    }

    const tag = await prisma.photoCampgroundTag.create({
      data: {
        photoId,
        campgroundId,
        taggedBy: taggerId
      },
      include: {
        campground: {
          select: { id: true, name: true, location: true, state: true, imageUrl: true }
        }
      }
    });

    res.status(201).json(tag);
  } catch (error: any) {
    console.error('Tag campground in photo error:', error);
    res.status(500).json({ error: 'Failed to tag campground' });
  }
});

// Remove yourself from a photo tag (user can remove their own tag)
router.delete('/:photoId/tag/user/self', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const userId = (req as any).user.id;

    const tag = await prisma.photoTag.findUnique({
      where: { photoId_userId: { photoId, userId } }
    });

    if (!tag) {
      return res.status(404).json({ error: 'You are not tagged in this photo' });
    }

    await prisma.photoTag.delete({
      where: { id: tag.id }
    });

    res.json({ message: 'Tag removed successfully' });
  } catch (error: any) {
    console.error('Remove self tag error:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// Remove a user tag (only photo owner or the tagger can remove)
router.delete('/:photoId/tag/user/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { photoId, userId } = req.params;
    const requesterId = (req as any).user.id;

    // Get the photo and tag
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    const tag = await prisma.photoTag.findUnique({
      where: { photoId_userId: { photoId, userId } }
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Only allow: photo owner, the person who created the tag, or the tagged person
    if (photo.userId !== requesterId && tag.taggedBy !== requesterId && tag.userId !== requesterId) {
      return res.status(403).json({ error: 'Not authorized to remove this tag' });
    }

    await prisma.photoTag.delete({
      where: { id: tag.id }
    });

    res.json({ message: 'Tag removed successfully' });
  } catch (error: any) {
    console.error('Remove user tag error:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// Remove a campground tag (only photo owner or the tagger can remove)
router.delete('/:photoId/tag/campground/:campgroundId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { photoId, campgroundId } = req.params;
    const requesterId = (req as any).user.id;

    // Get the photo and tag
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    const tag = await prisma.photoCampgroundTag.findUnique({
      where: { photoId_campgroundId: { photoId, campgroundId } }
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Only allow: photo owner or the person who created the tag
    if (photo.userId !== requesterId && tag.taggedBy !== requesterId) {
      return res.status(403).json({ error: 'Not authorized to remove this tag' });
    }

    await prisma.photoCampgroundTag.delete({
      where: { id: tag.id }
    });

    res.json({ message: 'Tag removed successfully' });
  } catch (error: any) {
    console.error('Remove campground tag error:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// Get all photos a user is tagged in
router.get('/user/:userId/tagged', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const tags = await prisma.photoTag.findMany({
      where: { userId },
      include: {
        photo: {
          include: {
            user: {
              select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
            },
            album: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tags.map((t: any) => t.photo));
  } catch (error: any) {
    console.error('Get tagged photos error:', error);
    res.status(500).json({ error: 'Failed to get tagged photos' });
  }
});

// Search users for tagging
router.get('/search/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true
      },
      take: 10
    });

    res.json(users);
  } catch (error: any) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Search campgrounds for tagging
router.get('/search/campgrounds', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.json([]);
    }

    const campgrounds = await prisma.campground.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        location: true,
        state: true,
        imageUrl: true
      },
      take: 10
    });

    res.json(campgrounds);
  } catch (error: any) {
    console.error('Search campgrounds error:', error);
    res.status(500).json({ error: 'Failed to search campgrounds' });
  }
});

export default router;
