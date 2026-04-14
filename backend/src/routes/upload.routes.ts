import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
const db = prisma as any;
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper to upload to Cloudinary
const uploadToCloudinary = (buffer: Buffer, folder: string = 'rvunicorn'): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// POST /api/upload - Upload single image (legacy endpoint)
router.post('/', authenticateToken, upload.single('image'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'File must be an image' });
    }

    const result = await uploadToCloudinary(req.file.buffer);

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/upload/image - Upload image (also creates Photo record if eventId/albumId provided)
router.post('/image', authenticateToken, upload.single('image'), async (req: any, res) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const { eventId, albumId, caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'File must be an image' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer);
    const imageUrl = result.secure_url;

    // If eventId or albumId provided, create a Photo record to link it
    if (eventId || albumId) {
      // Verify event participation if eventId provided
      if (eventId) {
        const event = await db.event.findUnique({
          where: { id: eventId },
          include: { attendees: true },
        });

        if (!event) {
          return res.status(404).json({ error: 'Event not found' });
        }

        const isParticipant =
          event.organizerId === userId || event.attendees.some((a: any) => a.userId === userId);

        if (!isParticipant) {
          return res.status(403).json({ error: 'Only event participants can upload photos' });
        }
      }

      // Verify album ownership if albumId provided
      if (albumId) {
        const album = await db.photoAlbum.findUnique({
          where: { id: albumId },
        });

        if (!album || album.userId !== userId) {
          return res.status(403).json({ error: 'Album not found or access denied' });
        }
      }

      // Create Photo record linked to event/album
      const photo = await db.photo.create({
        data: {
          userId,
          imageUrl,
          caption: caption || null,
          eventId: eventId || null,
          albumId: albumId || null,
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
            },
          },
          album: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return res.json({
        url: imageUrl,
        imageUrl,
        publicId: result.public_id,
        photo,
      });
    }

    // Simple upload without Photo record
    res.json({
      url: imageUrl,
      imageUrl,
      publicId: result.public_id,
    });
  } catch (error: any) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/upload/multiple - Upload multiple images
router.post('/multiple', authenticateToken, upload.array('images', 10), async (req: any, res) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const { eventId, albumId } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Upload all to Cloudinary
    const uploadPromises = req.files.map((file: any) => uploadToCloudinary(file.buffer));
    const results = await Promise.all(uploadPromises);

    const images = results.map((result: any) => ({
      url: result.secure_url,
      publicId: result.public_id,
    }));

    // If eventId or albumId, create Photo records
    if (eventId || albumId) {
      const photos = await Promise.all(
        images.map((img) =>
          db.photo.create({
            data: {
              userId,
              imageUrl: img.url,
              eventId: eventId || null,
              albumId: albumId || null,
            },
          })
        )
      );

      return res.json({
        images,
        photos,
        count: photos.length,
      });
    }

    res.json({ images });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/upload/event/:eventId - Upload photo directly to an event
router.post('/event/:eventId', authenticateToken, upload.single('image'), async (req: any, res) => {
  try {
    const userId = req.userId || (req as any).user?.id;
    const { eventId } = req.params;
    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify event exists and user is participant
    const event = await db.event.findUnique({
      where: { id: eventId },
      include: { attendees: true },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const isParticipant =
      event.organizerId === userId || event.attendees.some((a: any) => a.userId === userId);

    if (!isParticipant) {
      return res.status(403).json({ error: 'Only event participants can upload photos' });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, `kindletribe/events/${eventId}`);

    // Create Photo record
    const photo = await db.photo.create({
      data: {
        userId,
        imageUrl: result.secure_url,
        caption: caption || null,
        eventId,
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
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.json({
      url: result.secure_url,
      imageUrl: result.secure_url,
      publicId: result.public_id,
      photo,
    });
  } catch (error: any) {
    console.error('Event photo upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
