import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { prisma } from '../prisma';
import { logRVShowcaseUpdated } from '../services/activity.service';

const router = Router();


// GET /api/rv-showcase/:username - Get user's RV showcase
router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = (req as any).userId;

    // Find user by username or id
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

    // Get showcase
    const showcase = await prisma.rVShowcase.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            rvType: true,
            rvYear: true,
            rvMake: true,
            rvModel: true,
          },
        },
      },
    });

    if (!showcase) {
      return res.status(404).json({ error: 'No RV showcase found' });
    }

    // Check privacy
    if (showcase.privacy === 'PRIVATE' && showcase.userId !== currentUserId) {
      return res.status(403).json({ error: 'This showcase is private' });
    }

    res.json(showcase);
  } catch (error) {
    console.error('Get RV showcase error:', error);
    res.status(500).json({ error: 'Failed to get RV showcase' });
  }
});

// GET /api/rv-showcase/user/:userId - Get RV showcase by user ID
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = (req as any).userId;

    const showcase = await prisma.rVShowcase.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            rvType: true,
            rvYear: true,
            rvMake: true,
            rvModel: true,
          },
        },
      },
    });

    if (!showcase) {
      return res.status(404).json({ error: 'No RV showcase found' });
    }

    // Check privacy
    if (showcase.privacy === 'PRIVATE' && showcase.userId !== currentUserId) {
      return res.status(403).json({ error: 'This showcase is private' });
    }

    res.json(showcase);
  } catch (error) {
    console.error('Get RV showcase error:', error);
    res.status(500).json({ error: 'Failed to get RV showcase' });
  }
});

// POST /api/rv-showcase - Create or update RV showcase
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, privacy, photos, videoUrl, rvType, rvYear, rvMake, rvModel } = req.body;

    // Validate photos (max 6)
    if (photos && photos.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 photos allowed' });
    }

    // Update user's RV details if provided
    if (rvType !== undefined || rvYear !== undefined || rvMake !== undefined || rvModel !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          rvType: rvType !== undefined ? rvType : undefined,
          rvYear: rvYear !== undefined ? (rvYear ? parseInt(rvYear) : null) : undefined,
          rvMake: rvMake !== undefined ? rvMake : undefined,
          rvModel: rvModel !== undefined ? rvModel : undefined,
        },
      });
    }

    // Check if showcase exists
    const existing = await prisma.rVShowcase.findUnique({
      where: { userId },
    });

    let showcase;
    if (existing) {
      // Update existing
      showcase = await prisma.rVShowcase.update({
        where: { userId },
        data: {
          title: title !== undefined ? title : undefined,
          description: description !== undefined ? description : undefined,
          privacy: privacy || undefined,
          photos: photos || undefined,
          videoUrl: videoUrl !== undefined ? videoUrl : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true,
              rvType: true,
              rvYear: true,
              rvMake: true,
              rvModel: true,
            },
          },
        },
      });
    } else {
      // Create new
      showcase = await prisma.rVShowcase.create({
        data: {
          userId,
          title,
          description,
          privacy: privacy || 'PUBLIC',
          photos: photos || [],
          videoUrl,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true,
              rvType: true,
              rvYear: true,
              rvMake: true,
              rvModel: true,
            },
          },
        },
      });
    }


    // Log activity if photos were added
    if (photos && photos.length > 0) {
      await logRVShowcaseUpdated(userId, photos.length);
    }

    res.json(showcase);
  } catch (error) {
    console.error('Save RV showcase error:', error);
    res.status(500).json({ error: 'Failed to save RV showcase' });
  }
});

// DELETE /api/rv-showcase - Delete RV showcase
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const showcase = await prisma.rVShowcase.findUnique({
      where: { userId },
    });

    if (!showcase) {
      return res.status(404).json({ error: 'No showcase found' });
    }

    await prisma.rVShowcase.delete({
      where: { userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete RV showcase error:', error);
    res.status(500).json({ error: 'Failed to delete RV showcase' });
  }
});


// PUT /api/rv-showcase/:id/set-main - Set a photo as the main (first) photo
router.put('/:id/set-main', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { photoIndex } = req.body;

    const showcase = await prisma.rVShowcase.findUnique({
      where: { id },
    });

    if (!showcase) {
      return res.status(404).json({ error: 'Showcase not found' });
    }

    if (showcase.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const photos = showcase.photos as string[];
    if (photoIndex < 0 || photoIndex >= photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    // Move the selected photo to the front
    const selectedPhoto = photos[photoIndex];
    const newPhotos = [selectedPhoto, ...photos.filter((_, i) => i !== photoIndex)];

    const updated = await prisma.rVShowcase.update({
      where: { id },
      data: { photos: newPhotos },
    });

    res.json(updated);
  } catch (error) {
    console.error('Set main photo error:', error);
    res.status(500).json({ error: 'Failed to set main photo' });
  }
});

// DELETE /api/rv-showcase/:id/photo/:photoIndex - Delete a specific photo
router.delete('/:id/photo/:photoIndex', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id, photoIndex } = req.params;
    const index = parseInt(photoIndex);

    const showcase = await prisma.rVShowcase.findUnique({
      where: { id },
    });

    if (!showcase) {
      return res.status(404).json({ error: 'Showcase not found' });
    }

    if (showcase.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const photos = showcase.photos as string[];
    if (index < 0 || index >= photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    // Remove the photo at the specified index
    const newPhotos = photos.filter((_, i) => i !== index);

    const updated = await prisma.rVShowcase.update({
      where: { id },
      data: { photos: newPhotos },
    });

    res.json(updated);
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;
