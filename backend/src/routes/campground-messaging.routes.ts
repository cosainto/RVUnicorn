import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Middleware to check if user is campground admin
const requireCampgroundAdmin = async (req: any, res: Response, next: Function) => {
  const userId = req.user?.id || req.userId;
  const { campgroundId } = req.params;

  const admin = await prisma.campgroundAdmin.findUnique({
    where: { userId_campgroundId: { userId, campgroundId } }
  });

  if (!admin) {
    return res.status(403).json({ error: 'Not authorized - campground admin access required' });
  }

  req.adminRole = admin.role;
  next();
};

// GET /api/campground-messaging/:campgroundId/recipients
// Get list of campers who can be messaged (checked-in and/or upcoming)
router.get('/:campgroundId/recipients', authenticateToken, requireCampgroundAdmin, async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const { 
      includeCheckedIn = 'true', 
      includeUpcoming = 'true',
      upcomingDays = '30',
      upcomingStart,
      upcomingEnd 
    } = req.query;

    const now = new Date();
    const results: any = {
      checkedIn: [],
      upcoming: [],
      counts: { checkedIn: 0, upcoming: 0, total: 0 }
    };

    // Get currently checked-in campers
    if (includeCheckedIn === 'true') {
      const checkedIn = await prisma.checkIn.findMany({
        where: {
          campgroundId,
          isActive: true,
          checkInDate: { lte: now },
          OR: [
            { checkOutDate: null },
            { checkOutDate: { gte: now } }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true,
              email: true
            }
          }
        },
        orderBy: { checkInDate: 'desc' }
      });

      results.checkedIn = checkedIn.map(c => ({
        id: c.id,
        type: 'checkin',
        user: c.user,
        siteNumber: c.siteNumber,
        checkInDate: c.checkInDate,
        checkOutDate: c.checkOutDate
      }));
      results.counts.checkedIn = checkedIn.length;
    }

    // Get upcoming campers (from Stay model)
    if (includeUpcoming === 'true') {
      let startDate = now;
      let endDate = new Date();
      
      if (upcomingStart && upcomingEnd) {
        startDate = new Date(upcomingStart as string);
        endDate = new Date(upcomingEnd as string);
      } else {
        endDate.setDate(endDate.getDate() + parseInt(upcomingDays as string));
      }

      const upcoming = await prisma.stay.findMany({
        where: {
          campgroundId,
          startDate: { 
            gt: now,
            lte: endDate 
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true,
              email: true
            }
          }
        },
        orderBy: { startDate: 'asc' }
      });

      // Also check Events at this campground
      const upcomingEvents = await prisma.event.findMany({
        where: {
          campgroundId,
          startDate: {
            gt: now,
            lte: endDate
          }
        },
        include: {
          attendees: {
            where: { status: 'GOING' },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                  profilePicture: true,
                  email: true
                }
              }
            }
          }
        }
      });

      // Combine stays and event attendees, deduplicate by user
      const userMap = new Map();

      upcoming.forEach(s => {
        if (!userMap.has(s.user.id)) {
          userMap.set(s.user.id, {
            id: s.id,
            type: 'stay',
            user: s.user,
            startDate: s.startDate,
            endDate: s.endDate,
            source: 'booking'
          });
        }
      });

      upcomingEvents.forEach(event => {
        event.attendees.forEach(attendee => {
          if (!userMap.has(attendee.user.id)) {
            userMap.set(attendee.user.id, {
              id: attendee.id,
              type: 'event',
              user: attendee.user,
              startDate: event.startDate,
              endDate: event.endDate,
              eventName: event.title,
              source: 'event'
            });
          }
        });
      });

      results.upcoming = Array.from(userMap.values()).sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
      results.counts.upcoming = results.upcoming.length;
    }

    // Remove duplicates between checked-in and upcoming
    const checkedInUserIds = new Set(results.checkedIn.map((c: any) => c.user.id));
    results.upcoming = results.upcoming.filter((u: any) => !checkedInUserIds.has(u.user.id));
    results.counts.upcoming = results.upcoming.length;
    
    results.counts.total = results.counts.checkedIn + results.counts.upcoming;

    res.json(results);
  } catch (error) {
    console.error('Get recipients error:', error);
    res.status(500).json({ error: 'Failed to get recipients' });
  }
});

// POST /api/campground-messaging/:campgroundId/send
// Send message to selected campers
router.post('/:campgroundId/send', authenticateToken, requireCampgroundAdmin, async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const userId = req.user?.id || req.userId;
    const { 
      recipientIds,      // Array of user IDs to message
      subject,
      content,
      sendToAll,         // If true, send to all eligible
      includeCheckedIn,  // Include checked-in when sendToAll
      includeUpcoming,   // Include upcoming when sendToAll
      upcomingDays       // Days ahead for upcoming filter
    } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Get campground info for the message
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, name: true }
    });

    if (!campground) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    let targetUserIds: string[] = [];

    if (sendToAll) {
      // Get all eligible recipients
      const now = new Date();

      if (includeCheckedIn) {
        const checkedIn = await prisma.checkIn.findMany({
          where: {
            campgroundId,
            isActive: true,
            checkInDate: { lte: now },
            OR: [
              { checkOutDate: null },
              { checkOutDate: { gte: now } }
            ]
          },
          select: { userId: true }
        });
        targetUserIds.push(...checkedIn.map(c => c.userId));
      }

      if (includeUpcoming) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (upcomingDays || 30));

        const upcoming = await prisma.stay.findMany({
          where: {
            campgroundId,
            startDate: { gt: now, lte: endDate }
          },
          select: { userId: true }
        });
        targetUserIds.push(...upcoming.map(s => s.userId));

        // Also get event attendees
        const events = await prisma.event.findMany({
          where: {
            campgroundId,
            startDate: { gt: now, lte: endDate }
          },
          include: {
            attendees: {
              where: { status: 'GOING' },
              select: { userId: true }
            }
          }
        });
        events.forEach(e => {
          targetUserIds.push(...e.attendees.map(a => a.userId));
        });
      }

      // Deduplicate
      targetUserIds = [...new Set(targetUserIds)];
    } else {
      targetUserIds = recipientIds || [];
    }

    if (targetUserIds.length === 0) {
      return res.status(400).json({ error: 'No recipients selected' });
    }

    // Create messages for each recipient
    const messages = await Promise.all(
      targetUserIds.map(recipientId =>
        prisma.message.create({
          data: {
            senderId: userId,
            recipientId,
            subject: subject || `Message from ${campground.name}`,
            content: `[From ${campground.name}]\n\n${content}`,
          }
        })
      )
    );

    // Create notifications for each recipient
    await Promise.all(
      targetUserIds.map(recipientId =>
        prisma.notification.create({
          data: {
            userId: recipientId,
            type: 'CAMPGROUND_MESSAGE',
            content: `${campground.name} sent you a message`,
            link: '/messages'
          }
        })
      )
    );

    res.json({
      success: true,
      messagesSent: messages.length,
      recipientCount: targetUserIds.length
    });
  } catch (error) {
    console.error('Send campground message error:', error);
    res.status(500).json({ error: 'Failed to send messages' });
  }
});

// GET /api/campground-messaging/:campgroundId/sent
// Get history of messages sent by this campground
router.get('/:campgroundId/sent', authenticateToken, requireCampgroundAdmin, async (req: any, res) => {
  try {
    const { campgroundId } = req.params;

    // Get all admins for this campground
    const admins = await prisma.campgroundAdmin.findMany({
      where: { campgroundId },
      select: { userId: true }
    });
    const adminIds = admins.map(a => a.userId);

    // Get campground name for filtering
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true }
    });

    if (!campground) {
      return res.status(404).json({ error: 'Campground not found' });
    }

    // Get messages sent by admins that contain campground prefix
    const messages = await prisma.message.findMany({
      where: {
        senderId: { in: adminIds },
        content: { startsWith: `[From ${campground.name}]` }
      },
      include: {
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(messages);
  } catch (error) {
    console.error('Get sent messages error:', error);
    res.status(500).json({ error: 'Failed to get sent messages' });
  }
});

export default router;
