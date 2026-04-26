import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient() as any;

// ══ GET /api/public/trips/:tripId — public trip card ══
router.get('/trips/:tripId', async (req: Request, res: Response) => {
  try {
    const { tripId } = req.params;

    const trip = await prisma.event.findFirst({
      where: {
        id: tripId,
        OR: [{ isPublic: true }, { privacy: { not: 'PRIVATE' } }],
      },
      include: {
        organizer: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            rvType: true,
            rvMake: true,
            rvModel: true,
            rvYear: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            state: true,
            location: true,
            imageUrl: true,
            latitude: true,
            longitude: true,
          },
        },
        _count: { select: { attendees: true } },
      },
    });

    if (!trip) return res.status(404).json({ error: 'Trip not found or is private' });

    const photoCount = await prisma.photo.count({ where: { eventId: tripId } });

    res.json({
      id: trip.id,
      title: trip.title,
      description: trip.description,
      startDate: trip.startDate,
      endDate: trip.endDate,
      location: trip.location,
      bannerImage: trip.bannerImage,
      organizer: {
        firstName: trip.organizer.firstName,
        lastName: trip.organizer.lastName,
        username: trip.organizer.username,
        profilePicture: trip.organizer.profilePicture,
        rvType: trip.organizer.rvType,
        rvMake: trip.organizer.rvMake,
        rvModel: trip.organizer.rvModel,
        rvYear: trip.organizer.rvYear,
      },
      campground: trip.campground,
      attendeeCount: trip._count.attendees,
      photoCount,
      createdAt: trip.createdAt,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

// ══ GET /api/public/users/:username — public user profile ══
router.get('/users/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [tripCount, checkInCount, photoCount, statesVisited, badges] = await Promise.all([
      prisma.event.count({ where: { organizerId: user.id, isPublic: true } }),
      prisma.checkIn.count({ where: { userId: user.id } }),
      prisma.photo.count({ where: { userId: user.id } }),
      prisma.stateVisit.findMany({ where: { userId: user.id }, select: { state: true } }),
      prisma.userBadge.findMany({
        where: { userId: user.id },
        take: 3,
        orderBy: { earnedAt: 'desc' },
        include: { badge: { select: { name: true, icon: true } } },
      }),
    ]);

    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      profilePicture: user.profilePicture,
      rvYear: user.rvYear,
      rvMake: user.rvMake,
      rvModel: user.rvModel,
      rvType: user.rvType,
      createdAt: user.createdAt,
      stats: {
        tripCount,
        checkInCount,
        photoCount,
      },
      badges: badges.map((ub: any) => ({
        name: ub.badge.name,
        icon: ub.badge.icon,
        earnedAt: ub.earnedAt,
      })),
      statesVisited: statesVisited.map((sv: any) => sv.state),
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ══ GET /api/public/posts/:postId — public post view ══
router.get('/posts/:postId', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
      },
    });

    if (!post) return res.status(404).json({ error: 'Post not found' });

    const [likeCount, commentCount] = await Promise.all([
      prisma.like.count({ where: { postId } }),
      prisma.comment.count({ where: { postId } }),
    ]);

    res.json({
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      author: {
        firstName: post.user.firstName,
        lastName: post.user.lastName,
        username: post.user.username,
        profilePicture: post.user.profilePicture,
      },
      likeCount,
      commentCount,
      createdAt: post.createdAt,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// ══ GET /api/public/boards/thread/:threadId — public board thread view ══
router.get('/boards/thread/:threadId', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;

    const thread = await prisma.boardPost.findUnique({
      where: { id: threadId },
      include: {
        board: { select: { name: true, slug: true } },
        author: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
      },
    });

    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    res.json({
      id: thread.id,
      title: thread.title,
      boardName: thread.board.name,
      boardSlug: thread.board.slug,
      bodyPreview: thread.body.slice(0, 300),
      replyCount: thread.commentCount,
      voteScore: thread.voteScore,
      authorName: `${thread.author.firstName} ${thread.author.lastName}`,
      authorUsername: thread.author.username,
      authorProfilePicture: thread.author.profilePicture,
      createdAt: thread.createdAt,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

export default router;
