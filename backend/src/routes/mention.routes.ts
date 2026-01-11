import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/mentions/search/users?q=query - Search users for @mention autocomplete
router.get('/search/users', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || String(q).length < 1) {
      return res.json([]);
    }

    const searchTerm = String(q).toLowerCase();

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: searchTerm, mode: 'insensitive' } },
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      },
      take: 10,
    });

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// GET /api/mentions/search/campgrounds?q=query - Search campgrounds for @mention autocomplete
router.get('/search/campgrounds', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || String(q).length < 1) {
      return res.json([]);
    }

    const searchTerm = String(q).toLowerCase();

    const campgrounds = await prisma.campground.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { location: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        customSlug: true,
        state: true,
        location: true,
        imageUrl: true,
      },
      take: 10,
    });

    res.json(campgrounds);
  } catch (error) {
    console.error('Search campgrounds error:', error);
    res.status(500).json({ error: 'Failed to search campgrounds' });
  }
});

// GET /api/mentions/search/all?q=query - Unified search for users AND campgrounds
router.get('/search/all', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || String(q).length < 1) {
      return res.json({ users: [], campgrounds: [] });
    }

    const searchTerm = String(q).toLowerCase();

    // Search users
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: searchTerm, mode: 'insensitive' } },
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      },
      take: 5,
    });

    // Search campgrounds
    const campgrounds = await prisma.campground.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { location: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        customSlug: true,
        state: true,
        location: true,
        imageUrl: true,
      },
      take: 5,
    });

    res.json({ users, campgrounds });
  } catch (error) {
    console.error('Search all error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// Helper function to parse mentions from content
// Supports @username for users and @[Campground Name] for campgrounds
export async function parseMentions(
  content: string,
  createdById: string,
  postId?: string,
  activityId?: string
) {
  const mentions: any[] = [];
  
  // Parse @username mentions (alphanumeric usernames)
  const userMentionRegex = /@(\w+)/g;
  let match;
  
  while ((match = userMentionRegex.exec(content)) !== null) {
    const username = match[1];
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    
    if (user && user.id !== createdById) {
      mentions.push({
        mentionedUserId: user.id,
        createdById,
        postId: postId || null,
        activityId: activityId || null,
      });
      
      // Create notification for mentioned user
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'MENTION',
          content: 'mentioned you in a post',
          link: postId ? `/posts/${postId}` : '/basecamp',
        },
      });
    }
  }
  
  // Parse @[Campground Name] mentions (campground names in brackets)
  const campgroundMentionRegex = /@\[([^\]]+)\]/g;
  
  while ((match = campgroundMentionRegex.exec(content)) !== null) {
    const campgroundName = match[1];
    const campground = await prisma.campground.findFirst({
      where: {
        OR: [
          { name: { equals: campgroundName, mode: 'insensitive' } },
          { name: { contains: campgroundName, mode: 'insensitive' } },
          { customSlug: { equals: campgroundName.toLowerCase().replace(/\s+/g, '-'), mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });
    
    if (campground) {
      // Check if already added
      const alreadyAdded = mentions.some(m => m.mentionedCampgroundId === campground.id);
      if (!alreadyAdded) {
        mentions.push({
          mentionedCampgroundId: campground.id,
          createdById,
          postId: postId || null,
          activityId: activityId || null,
        });

        // Notify campground admins
        const admins = await prisma.campgroundAdmin.findMany({
          where: { campgroundId: campground.id },
          select: { userId: true }
        });

        const mentioner = await prisma.user.findUnique({
          where: { id: createdById },
          select: { firstName: true, lastName: true }
        });

        for (const admin of admins) {
          if (admin.userId !== createdById) {
            await prisma.notification.create({
              data: {
                userId: admin.userId,
                type: 'CAMPGROUND_MENTION',
                content: (mentioner?.firstName || 'Someone') + ' ' + (mentioner?.lastName || '') + ' mentioned ' + campground.name,
                link: postId ? `/posts/${postId}` : '/campgrounds/' + campground.id,
              },
            });
          }
        }
      }
    }
  }
  
  // Create all mentions
  if (mentions.length > 0) {
    await prisma.mention.createMany({
      data: mentions,
      skipDuplicates: true,
    });
  }
  
  return mentions;
}

// GET /api/mentions/my - Get mentions of the current user
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const mentions = await prisma.mention.findMany({
      where: { mentionedUserId: userId },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        post: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
        activity: {
          select: {
            id: true,
            type: true,
            content: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(mentions);
  } catch (error) {
    console.error('Get mentions error:', error);
    res.status(500).json({ error: 'Failed to get mentions' });
  }
});

export default router;
