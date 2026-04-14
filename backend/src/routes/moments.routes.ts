import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.middleware";

const router = express.Router();
const prisma = new PrismaClient() as any;

// Moment types
const MOMENT_TYPES = {
  AUTO_TIME: 'AUTO_TIME',       // Weekend Trip, Week of Dec 15, etc.
  AUTO_LOCATION: 'AUTO_LOCATION', // Based on campground
  AUTO_EVENT: 'AUTO_EVENT',     // Event participation
  AUTO_SEASON: 'AUTO_SEASON',   // Summer 2025, etc.
  MANUAL: 'MANUAL'              // User created
};

// ============================================
// AUTO-GENERATION LOGIC
// ============================================

// Generate moments for a user (called periodically or on demand)
router.post("/generate", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    
    const results = {
      timeBased: 0,
      eventBased: 0,
      locationBased: 0
    };

    // 1. Generate time-based moments (weekend trips, seasonal groupings)
    results.timeBased = await generateTimeMoments(userId);

    // 2. Generate event-based moments
    results.eventBased = await generateEventMoments(userId);

    // 3. Generate location-based moments (campground visits)
    results.locationBased = await generateLocationMoments(userId);

    res.json({
      message: "Moments generated successfully",
      created: results
    });
  } catch (error: any) {
    console.error("Error generating moments:", error);
    res.status(500).json({ error: "Failed to generate moments" });
  }
});

// Generate time-based moments (clusters of photos/videos within time windows)
async function generateTimeMoments(userId: string): Promise<number> {
  let created = 0;

  // Get all user photos sorted by date
  const photos = await prisma.photo.findMany({
    where: { userId, publishedAt: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, imageUrl: true }
  });

  if (photos.length < 3) return 0;

  // Group photos into clusters (photos within 48 hours of each other)
  const clusters: Array<{ photos: typeof photos; start: Date; end: Date }> = [];
  let currentCluster: typeof photos = [];
  let clusterStart: Date | null = null;
  let lastDate: Date | null = null;

  for (const photo of photos) {
    const photoDate = new Date(photo.createdAt);
    
    if (!lastDate || (photoDate.getTime() - lastDate.getTime()) <= 48 * 60 * 60 * 1000) {
      // Within 48 hours - add to current cluster
      if (!clusterStart) clusterStart = photoDate;
      currentCluster.push(photo);
    } else {
      // Gap > 48 hours - save current cluster if it has 3+ photos
      if (currentCluster.length >= 3 && clusterStart) {
        clusters.push({
          photos: [...currentCluster],
          start: clusterStart,
          end: lastDate
        });
      }
      // Start new cluster
      currentCluster = [photo];
      clusterStart = photoDate;
    }
    lastDate = photoDate;
  }

  // Don't forget the last cluster
  if (currentCluster.length >= 3 && clusterStart && lastDate) {
    clusters.push({
      photos: [...currentCluster],
      start: clusterStart,
      end: lastDate
    });
  }

  // Create moments for each cluster
  for (const cluster of clusters) {
    const title = generateTimeTitle(cluster.start, cluster.end);
    
    // Check if moment already exists for this time range
    const existing = await prisma.photoMoment.findFirst({
      where: {
        userId,
        type: MOMENT_TYPES.AUTO_TIME,
        startDate: { gte: new Date(cluster.start.getTime() - 24 * 60 * 60 * 1000) },
        endDate: { lte: new Date(cluster.end.getTime() + 24 * 60 * 60 * 1000) }
      }
    });

    if (!existing) {
      const moment = await prisma.photoMoment.create({
        data: {
          userId,
          title,
          type: MOMENT_TYPES.AUTO_TIME,
          startDate: cluster.start,
          endDate: cluster.end,
          coverUrl: cluster.photos[0].imageUrl,
          photoCount: cluster.photos.length
        }
      });

      // Link photos to moment
      await prisma.momentPhoto.createMany({
        data: cluster.photos.map((photo: any, index: any) => ({
          momentId: moment.id,
          photoId: photo.id,
          order: index
        })),
        skipDuplicates: true
      });

      created++;
    }
  }

  return created;
}

// Generate title based on date range
function generateTimeTitle(start: Date, end: Date): string {
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const startDay = start.getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  // Check if it's a weekend (Friday-Sunday)
  if (daysDiff <= 3 && (startDay === 5 || startDay === 6 || startDay === 0)) {
    return `Weekend Trip - ${monthNames[start.getMonth()]} ${start.getDate()}`;
  }
  
  // Check season
  const month = start.getMonth();
  let season = "";
  if (month >= 2 && month <= 4) season = "Spring";
  else if (month >= 5 && month <= 7) season = "Summer";
  else if (month >= 8 && month <= 10) season = "Fall";
  else season = "Winter";

  // Short trip (1-3 days)
  if (daysDiff <= 3) {
    return `${monthNames[start.getMonth()]} ${start.getDate()} Trip`;
  }
  
  // Longer trip
  if (daysDiff <= 7) {
    return `${monthNames[start.getMonth()]} Adventure`;
  }
  
  // Season-based for longer periods
  return `${season} ${start.getFullYear()}`;
}

// Generate event-based moments
async function generateEventMoments(userId: string): Promise<number> {
  let created = 0;

  // Get events the user participated in
  const attendances = await prisma.eventAttendee.findMany({
    where: { userId },
    include: {
      event: {
        select: { id: true, title: true, startDate: true, endDate: true }
      }
    }
  });

  for (const attendance of attendances) {
    const event = attendance.event;
    if (!event.startDate) continue;

    // Get photos taken during the event
    const eventPhotos = await prisma.photo.findMany({
      where: {
        userId,
        publishedAt: { not: null },
        createdAt: {
          gte: event.startDate,
          lte: event.endDate || new Date(event.startDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      select: { id: true, imageUrl: true }
    });

    if (eventPhotos.length < 2) continue;

    // Check if moment already exists
    const existing = await prisma.photoMoment.findFirst({
      where: {
        userId,
        type: MOMENT_TYPES.AUTO_EVENT,
        title: { contains: event.title }
      }
    });

    if (!existing) {
      const moment = await prisma.photoMoment.create({
        data: {
          userId,
          title: event.title,
          type: MOMENT_TYPES.AUTO_EVENT,
          startDate: event.startDate,
          endDate: event.endDate || event.startDate,
          coverUrl: eventPhotos[0].imageUrl,
          photoCount: eventPhotos.length
        }
      });

      await prisma.momentPhoto.createMany({
        data: eventPhotos.map((photo: any, index: any) => ({
          momentId: moment.id,
          photoId: photo.id,
          order: index
        })),
        skipDuplicates: true
      });

      created++;
    }
  }

  return created;
}

// Generate location-based moments (campground visits)
async function generateLocationMoments(userId: string): Promise<number> {
  let created = 0;

  // Get photos with campground tags
  const taggedPhotos = await prisma.photoCampgroundTag.findMany({
    where: { photo: { userId } },
    include: {
      photo: { select: { id: true, createdAt: true, imageUrl: true } },
      campground: { select: { id: true, name: true } }
    },
    orderBy: { photo: { createdAt: "asc" } }
  });

  // Group by campground
  const byCampground: Record<string, { 
    campground: { id: string; name: string };
    photos: Array<{ id: string; createdAt: Date; imageUrl: string }>;
  }> = {};

  for (const tag of taggedPhotos) {
    const cgId = tag.campground.id;
    if (!byCampground[cgId]) {
      byCampground[cgId] = {
        campground: tag.campground,
        photos: []
      };
    }
    byCampground[cgId].photos.push(tag.photo);
  }

  // Create moments for campgrounds with 3+ photos
  for (const [cgId, data] of Object.entries(byCampground)) {
    if (data.photos.length < 3) continue;

    const existing = await prisma.photoMoment.findFirst({
      where: {
        userId,
        type: MOMENT_TYPES.AUTO_LOCATION,
        title: { contains: data.campground.name }
      }
    });

    if (!existing) {
      const sortedPhotos = data.photos.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const moment = await prisma.photoMoment.create({
        data: {
          userId,
          title: `${data.campground.name}`,
          type: MOMENT_TYPES.AUTO_LOCATION,
          startDate: sortedPhotos[0].createdAt,
          endDate: sortedPhotos[sortedPhotos.length - 1].createdAt,
          coverUrl: sortedPhotos[0].imageUrl,
          photoCount: sortedPhotos.length
        }
      });

      await prisma.momentPhoto.createMany({
        data: sortedPhotos.map((photo, index) => ({
          momentId: moment.id,
          photoId: photo.id,
          order: index
        })),
        skipDuplicates: true
      });

      created++;
    }
  }

  return created;
}

// ============================================
// CRUD OPERATIONS
// ============================================

// Get all moments for a user
router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { includeHidden = false } = req.query;

    const moments = await prisma.photoMoment.findMany({
      where: {
        userId,
        ...(includeHidden !== "true" && { isHidden: false })
      },
      include: {
        photos: {
          include: {
            photo: {
              select: { id: true, imageUrl: true, caption: true }
            }
          },
          orderBy: { order: "asc" },
          take: 4 // Preview images
        }
      },
      orderBy: { startDate: "desc" }
    });

    const formattedMoments = moments.map((m: any) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      startDate: m.startDate,
      endDate: m.endDate,
      coverUrl: m.coverUrl,
      photoCount: m.photoCount,
      isHidden: m.isHidden,
      previewPhotos: m.photos.map((p: any) => p.photo.imageUrl)
    }));

    res.json(formattedMoments);
  } catch (error: any) {
    console.error("Error fetching moments:", error);
    res.status(500).json({ error: "Failed to fetch moments" });
  }
});

// Get single moment with all photos
router.get("/:momentId", authenticateToken, async (req: any, res) => {
  try {
    const { momentId } = req.params;
    const userId = (req as any).user.id;

    const moment = await prisma.photoMoment.findUnique({
      where: { id: momentId },
      include: {
        photos: {
          include: {
            photo: {
              include: {
                user: {
                  select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true }
                },
                reactions: true,
                userTags: {
                  include: {
                    user: { select: { id: true, username: true, firstName: true, lastName: true } }
                  }
                }
              }
            }
          },
          orderBy: { order: "asc" }
        }
      }
    });

    if (!moment) {
      return res.status(404).json({ error: "Moment not found" });
    }

    if (moment.userId !== userId) {
      return res.status(403).json({ error: "You can only view your own moments" });
    }

    res.json({
      ...moment,
      photos: moment.photos.map((p: any) => ({
        ...p.photo,
        order: p.order,
        reactionCount: p.photo.reactions.length
      }))
    });
  } catch (error: any) {
    console.error("Error fetching moment:", error);
    res.status(500).json({ error: "Failed to fetch moment" });
  }
});

// Create manual moment
router.post("/", authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user.id;
    const { title, photoIds, coverUrl } = req.body;

    if (!title || !photoIds || photoIds.length < 2) {
      return res.status(400).json({ error: "Title and at least 2 photos required" });
    }

    // Verify photos belong to user
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, userId },
      select: { id: true, createdAt: true, imageUrl: true }
    });

    if (photos.length !== photoIds.length) {
      return res.status(400).json({ error: "Some photos not found or don't belong to you" });
    }

    const sortedPhotos = photos.sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const moment = await prisma.photoMoment.create({
      data: {
        userId,
        title,
        type: MOMENT_TYPES.MANUAL,
        startDate: sortedPhotos[0].createdAt,
        endDate: sortedPhotos[sortedPhotos.length - 1].createdAt,
        coverUrl: coverUrl || sortedPhotos[0].imageUrl,
        photoCount: sortedPhotos.length
      }
    });

    await prisma.momentPhoto.createMany({
      data: sortedPhotos.map((photo: any, index: any) => ({
        momentId: moment.id,
        photoId: photo.id,
        order: index
      }))
    });

    res.status(201).json(moment);
  } catch (error: any) {
    console.error("Error creating moment:", error);
    res.status(500).json({ error: "Failed to create moment" });
  }
});

// Update moment (title, cover, hidden status)
router.patch("/:momentId", authenticateToken, async (req: any, res) => {
  try {
    const { momentId } = req.params;
    const userId = (req as any).user.id;
    const { title, coverUrl, isHidden } = req.body;

    const moment = await prisma.photoMoment.findUnique({
      where: { id: momentId }
    });

    if (!moment) {
      return res.status(404).json({ error: "Moment not found" });
    }

    if (moment.userId !== userId) {
      return res.status(403).json({ error: "You can only edit your own moments" });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (coverUrl !== undefined) updateData.coverUrl = coverUrl;
    if (isHidden !== undefined) updateData.isHidden = isHidden;

    const updated = await prisma.photoMoment.update({
      where: { id: momentId },
      data: updateData
    });

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating moment:", error);
    res.status(500).json({ error: "Failed to update moment" });
  }
});

// Add photos to moment
router.post("/:momentId/photos", authenticateToken, async (req: any, res) => {
  try {
    const { momentId } = req.params;
    const userId = (req as any).user.id;
    const { photoIds } = req.body;

    const moment = await prisma.photoMoment.findUnique({
      where: { id: momentId }
    });

    if (!moment || moment.userId !== userId) {
      return res.status(403).json({ error: "Cannot modify this moment" });
    }

    // Get current max order
    const maxOrder = await prisma.momentPhoto.findFirst({
      where: { momentId },
      orderBy: { order: "desc" },
      select: { order: true }
    });

    let nextOrder = (maxOrder?.order || 0) + 1;

    // Verify and add photos
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, userId }
    });

    await prisma.momentPhoto.createMany({
      data: photos.map((photo: any) => ({
        momentId,
        photoId: photo.id,
        order: nextOrder++
      })),
      skipDuplicates: true
    });

    // Update photo count
    const count = await prisma.momentPhoto.count({ where: { momentId } });
    await prisma.photoMoment.update({
      where: { id: momentId },
      data: { photoCount: count }
    });

    res.json({ added: photos.length, totalPhotos: count });
  } catch (error: any) {
    console.error("Error adding photos to moment:", error);
    res.status(500).json({ error: "Failed to add photos" });
  }
});

// Remove photo from moment
router.delete("/:momentId/photos/:photoId", authenticateToken, async (req: any, res) => {
  try {
    const { momentId, photoId } = req.params;
    const userId = (req as any).user.id;

    const moment = await prisma.photoMoment.findUnique({
      where: { id: momentId }
    });

    if (!moment || moment.userId !== userId) {
      return res.status(403).json({ error: "Cannot modify this moment" });
    }

    await prisma.momentPhoto.deleteMany({
      where: { momentId, photoId }
    });

    // Update photo count
    const count = await prisma.momentPhoto.count({ where: { momentId } });
    await prisma.photoMoment.update({
      where: { id: momentId },
      data: { photoCount: count }
    });

    // Delete moment if no photos left
    if (count === 0) {
      await prisma.photoMoment.delete({ where: { id: momentId } });
      return res.json({ removed: true, momentDeleted: true });
    }

    res.json({ removed: true, remainingPhotos: count });
  } catch (error: any) {
    console.error("Error removing photo from moment:", error);
    res.status(500).json({ error: "Failed to remove photo" });
  }
});

// Delete moment
router.delete("/:momentId", authenticateToken, async (req: any, res) => {
  try {
    const { momentId } = req.params;
    const userId = (req as any).user.id;

    const moment = await prisma.photoMoment.findUnique({
      where: { id: momentId }
    });

    if (!moment) {
      return res.status(404).json({ error: "Moment not found" });
    }

    if (moment.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own moments" });
    }

    // Delete associated MomentPhotos first (cascade should handle this, but being explicit)
    await prisma.momentPhoto.deleteMany({ where: { momentId } });
    await prisma.photoMoment.delete({ where: { id: momentId } });

    res.json({ message: "Moment deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting moment:", error);
    res.status(500).json({ error: "Failed to delete moment" });
  }
});

// Reorder photos in moment
router.patch("/:momentId/reorder", authenticateToken, async (req: any, res) => {
  try {
    const { momentId } = req.params;
    const userId = (req as any).user.id;
    const { photoIds } = req.body; // Array of photo IDs in new order

    const moment = await prisma.photoMoment.findUnique({
      where: { id: momentId }
    });

    if (!moment || moment.userId !== userId) {
      return res.status(403).json({ error: "Cannot modify this moment" });
    }

    // Update order for each photo
    for (let i = 0; i < photoIds.length; i++) {
      await prisma.momentPhoto.updateMany({
        where: { momentId, photoId: photoIds[i] },
        data: { order: i }
      });
    }

    res.json({ reordered: true });
  } catch (error: any) {
    console.error("Error reordering photos:", error);
    res.status(500).json({ error: "Failed to reorder photos" });
  }
});

export default router;
