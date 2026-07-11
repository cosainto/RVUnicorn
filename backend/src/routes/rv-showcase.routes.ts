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

    // Get showcase — first check user's own, then fall back to co-pilot's shared rig
    let showcase = await prisma.rVShowcase.findUnique({
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

    // If user has a showcase but it's for a deleted/empty rig, check if they're a co-pilot
    // on someone else's rig and use that instead
    if (!showcase || (showcase.title === 'Our Bus' && (!showcase.photos || (showcase.photos as string[]).length === 0))) {
      // Check if user is a co-pilot on a rig that has a showcase
      const coPilotRig = await prisma.rigCoPilot.findFirst({
        where: { userId: user.id },
        select: { rig: { select: { ownerId: true, rigName: true, heroPhoto: true, slug: true, year: true, make: true, model: true, rigClass: true } } },
      });
      const pilotRig = !coPilotRig ? await prisma.rigPilot.findFirst({
        where: { userId: user.id },
        select: { rig: { select: { ownerId: true, rigName: true, heroPhoto: true, slug: true, year: true, make: true, model: true, rigClass: true } } },
      }) : null;

      const sharedRig = coPilotRig?.rig || pilotRig?.rig;
      if (sharedRig) {
        // Return a synthetic showcase from the shared rig
        const ownerShowcase = await prisma.rVShowcase.findUnique({
          where: { userId: sharedRig.ownerId },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvType: true, rvYear: true, rvMake: true, rvModel: true },
            },
          },
        });
        if (ownerShowcase) {
          // Use the owner's showcase but keep the rig name from the shared rig
          showcase = {
            ...ownerShowcase,
            title: sharedRig.rigName || ownerShowcase.title,
            rigSlug: sharedRig.slug,
          } as any;
        } else {
          // No owner showcase — build a minimal one from the rig data
          showcase = {
            id: 'synthetic',
            userId: sharedRig.ownerId,
            title: sharedRig.rigName || `${sharedRig.year || ''} ${sharedRig.make || ''} ${sharedRig.model || ''}`.trim(),
            description: null,
            privacy: 'PUBLIC',
            photos: sharedRig.heroPhoto ? [sharedRig.heroPhoto] : [],
            videoUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            rigSlug: sharedRig.slug,
            user: {
              id: user.id,
              rvType: sharedRig.rigClass,
              rvYear: sharedRig.year,
              rvMake: sharedRig.make,
              rvModel: sharedRig.model,
            },
          } as any;
        }
      }
    }

    if (!showcase) {
      return res.status(404).json({ error: 'No RV showcase found' });
    }

    // Check privacy
    if (showcase.privacy === 'PRIVATE' && showcase.userId !== currentUserId) {
      return res.status(403).json({ error: 'This showcase is private' });
    }

    // Get household co-pilots (people who share this rig)
    let coPilots: any[] = [];
    const ownerWithHousehold = await prisma.user.findUnique({
      where: { id: user.id },
      select: { householdId: true },
    });
    if (ownerWithHousehold?.householdId) {
      const members = await prisma.user.findMany({
        where: { householdId: ownerWithHousehold.householdId, id: { not: user.id } },
        select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true },
      });
      coPilots = members;
    }

    res.json({ ...showcase, coPilots });
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// ══ RIGS LIKE THIS — find similar rigs by make/model ══
router.get('/:username/similar-rigs', async (req, res) => {
  try {
    const { username } = req.params;
    let user = await prisma.user.findUnique({ where: { username }, select: { id: true, rvMake: true, rvModel: true, rvType: true } });
    if (!user) user = await prisma.user.findUnique({ where: { id: username }, select: { id: true, rvMake: true, rvModel: true, rvType: true } });
    if (!user || !user.rvMake) return res.json({ rigs: [], total: 0 });

    // Find users with same make, optionally same model
    const similar = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        rvMake: { equals: user.rvMake, mode: 'insensitive' },
        ...(user.rvModel ? { rvModel: { equals: user.rvModel, mode: 'insensitive' } } : {}),
      },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true, rvYear: true, rvType: true },
      take: 8,
    });

    // If too few with same model, expand to same make only
    let results = similar;
    if (similar.length < 4 && user.rvModel) {
      const makeOnly = await prisma.user.findMany({
        where: { id: { notIn: [user.id, ...similar.map(s => s.id)] }, rvMake: { equals: user.rvMake, mode: 'insensitive' } },
        select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true, rvYear: true, rvType: true },
        take: 8 - similar.length,
      });
      results = [...similar, ...makeOnly];
    }

    const total = await prisma.user.count({ where: { rvMake: { equals: user.rvMake, mode: 'insensitive' }, id: { not: user.id } } });
    res.json({ rigs: results.slice(0, 4), total });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ══ RIG QUESTIONS — Q&A threads about a rig ══
router.get('/:username/questions', async (req, res) => {
  try {
    const { username } = req.params;
    let user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) user = await prisma.user.findUnique({ where: { id: username }, select: { id: true } });
    if (!user) return res.json({ questions: [] });

    const showcase = await prisma.rVShowcase.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!showcase) return res.json({ questions: [] });

    // Use threads tagged to this showcase via metadata
    const questions = await prisma.thread.findMany({
      where: { slug: { startsWith: `rig-q-${showcase.id}` } },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ questions });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:username/questions', authenticateToken, async (req: any, res) => {
  try {
    const { username } = req.params;
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: 'Question title required' });

    let user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) user = await prisma.user.findUnique({ where: { id: username }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const showcase = await prisma.rVShowcase.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!showcase) return res.status(404).json({ error: 'No rig found' });

    const slug = `rig-q-${showcase.id}-${Date.now()}`;
    const thread = await prisma.thread.create({
      data: { title, content: content || null, slug, authorId: req.userId },
      include: { author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
    });

    // Notify rig owner
    if (user.id !== req.userId) {
      await prisma.notification.create({
        data: { userId: user.id, type: 'RIG_QUESTION', content: `Someone asked about your rig: "${title}"`, link: `/profile/${username}/rig` },
      }).catch(() => {});
    }

    res.json({ question: thread });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed' }); }
});

// ══ RIG COMPARISON — compare two rigs side by side ══
router.get('/:username/compare', authenticateToken, async (req: any, res) => {
  try {
    const { username } = req.params;
    const viewerId = req.userId;

    const rvFields = { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvMake: true, rvModel: true, rvType: true, rvYear: true, rvLength: true, rvHeight: true, rvWeight: true, rvSleeps: true, rvSlideouts: true, rvMpg: true, rvFuelType: true, rvSolarWatts: true, rvGeneratorWatts: true, rvBatteryAh: true, rvFreshWaterGal: true, rvGreyWaterGal: true, rvBlackWaterGal: true, rvFuelGal: true, rvLpGasGal: true, rvAirconditioners: true, rvAwningFt: true, rvShorepower: true, rvFeatures: true };

    let profileUser = await prisma.user.findUnique({ where: { username }, select: rvFields });
    if (!profileUser) profileUser = await prisma.user.findUnique({ where: { id: username }, select: rvFields });
    if (!profileUser) return res.status(404).json({ error: 'User not found' });

    const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: rvFields });
    if (!viewer?.rvMake) return res.json({ profileRig: profileUser, viewerRig: null, message: 'Add your rig to compare' });

    res.json({ profileRig: profileUser, viewerRig: viewer });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ══ MAINTENANCE LOG PREVIEW (owner only) ══
router.get('/:username/maintenance-preview', authenticateToken, async (req: any, res) => {
  try {
    const { username } = req.params;
    let user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) user = await prisma.user.findUnique({ where: { id: username }, select: { id: true } });
    if (!user) return res.json({ records: [] });

    // Only the rig owner can see maintenance records
    if (user.id !== req.userId) return res.json({ records: [] });

    const records = await prisma.maintenanceRecord.findMany({
      where: { userId: user.id },
      select: { id: true, title: true, category: true, serviceDate: true, mileage: true, cost: true },
      orderBy: { serviceDate: 'desc' },
      take: 5,
    });
    res.json({ records });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
