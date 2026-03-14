import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const HITCH_USER_ID = 'hitch-ai-bot-user-rvunicorn';

// POST /api/hitch/jobs/meal-reminder
// Called by a cron job every 15 minutes
// Checks events that: have 3+ attendees, were created 15+ min ago, have no meal plan entries, and haven't been reminded yet
router.post('/meal-reminder', async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find events created 15+ min ago that are upcoming, have 3+ attendees, no meals, no Hitch comment yet
    const events = await (prisma as any).event.findMany({
      where: {
        createdAt: { lte: fifteenMinutesAgo },
        startDate: { gte: new Date() },
        isWishlist: false,
      },
      include: {
        attendees: true,
        meals: true,
        comments: { where: { userId: HITCH_USER_ID } },
        organizer: { select: { username: true } },
      },
    });

    let reminded = 0;

    for (const event of events) {
      // Count organizer as attending unless they explicitly set not going
      const organizerGoing = !event.attendees.some((a: any) => a.userId === event.organizerId && a.status === 'NOT_GOING');
      const goingCount = event.attendees.filter((a: any) => a.status === 'GOING').length + (organizerGoing ? 1 : 0);
      const hasMeals = event.meals.length > 0;
      const alreadyReminded = event.comments.length > 0;

      if (goingCount < 2 || hasMeals || alreadyReminded) continue;

      // Build @mentions for all attendees + organizer
      const goingAttendeeIds = event.attendees.filter((a: any) => a.status === 'GOING').map((a: any) => a.userId);
      const userIds = [...new Set([event.organizerId, ...goingAttendeeIds])];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { username: true },
      });

      const mentions = users.map(u => `@${u.username}`).join(' ');

      const message = `Hey ${mentions} 👋\n\nOne of the best parts of camping together is sharing meals! 🍳🌭 Use the **Meal Plan** tab to claim your day and add a recipe link so everyone knows what you'll be cooking. And don't forget to invite the crew!`;

      // Post comment as Hitch
      await prisma.eventComment.create({
        data: {
          eventId: event.id,
          userId: HITCH_USER_ID,
          content: message,
        },
      });

      // Get muted users
      const mutedUsers = await prisma.eventCommentMute.findMany({
        where: { eventId: event.id },
        select: { userId: true }
      });
      const mutedUserIds = new Set(mutedUsers.map((m: any) => m.userId));

      // Notify all attendees + organizer (except muted)
      const notifyIds = userIds.filter(uid => !mutedUserIds.has(uid));

      await prisma.notification.createMany({
        data: notifyIds.map(uid => ({
          userId: uid,
          type: 'EVENT_COMMENT',
          content: `Hitch has a meal planning tip for your trip "${event.title}" 🍳`,
          link: `/trips/${event.id}`,
        })),
        skipDuplicates: true,
      });

      // Also create basecamp activity for each user
      for (const notifyUserId of notifyIds) {
        await prisma.basecampActivity.create({
          data: {
            userId: notifyUserId,
            actorId: HITCH_USER_ID,
            type: 'EVENT_COMMENT',
            entityType: 'EVENT',
            entityId: event.id,
            entityName: event.title,
            metadata: {
              commentPreview: message.substring(0, 100),
              commenterName: 'Hitch AI',
              canMute: true
            }
          }
        });
      }

      reminded++;
    }

    res.json({ success: true, reminded });
  } catch (error) {
    console.error('Hitch meal reminder error:', error);
    res.status(500).json({ error: 'Failed to run meal reminder' });
  }
});

export default router;

// POST /api/hitch/jobs/pack-reminder
// Fires if event starts within 7 days, has 2+ attendees, and pack list is empty
router.post('/pack-reminder', async (req, res) => {
  try {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const events = await (prisma as any).event.findMany({
      where: {
        createdAt: { lte: oneDayAgo },
        startDate: { gte: new Date(), lte: sevenDaysFromNow },
        isWishlist: false,
      },
      include: {
        attendees: true,
        comments: { where: { userId: HITCH_USER_ID, content: { contains: 'pack' } } },
      }
    });

    let reminded = 0;
    for (const event of events) {
      const goingCount = event.attendees.filter((a: any) => a.status === 'GOING').length + 1;
      if (goingCount < 2 || event.comments.length > 0) continue;

      // Check if pack list is empty
      const packItems = await (prisma as any).tripPackItem.count({ where: { eventId: event.id } });
      if (packItems > 0) continue;

      const userIds = [event.organizerId, ...event.attendees.filter((a: any) => a.status === 'GOING').map((a: any) => a.userId)];
      const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { username: true } });
      const mentions = users.map(u => `@${u.username}`).join(' ');

      const message = `Hey ${mentions} 👋\n\nYour trip is coming up soon and the pack list is still empty! 🎒 Head to the **Pack List** tab and add what you're bringing — it's the easiest way to make sure nobody forgets the bug spray (or the s'mores). Trust me on this one. 🔥`;

      await prisma.eventComment.create({
        data: { eventId: event.id, userId: HITCH_USER_ID, content: message }
      });

      const mutedUsers = await prisma.eventCommentMute.findMany({ where: { eventId: event.id }, select: { userId: true } });
      const mutedIds = new Set(mutedUsers.map((m: any) => m.userId));
      const notifyIds = userIds.filter(uid => !mutedIds.has(uid));

      await prisma.notification.createMany({
        data: notifyIds.map(uid => ({
          userId: uid,
          type: 'EVENT_COMMENT',
          content: `Hitch has a packing tip for your trip! 🎒`,
          link: `/trips/${event.id}`,
        })),
        skipDuplicates: true,
      });

      reminded++;
    }

    res.json({ success: true, reminded });
  } catch (error) {
    console.error('Hitch pack reminder error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/hitch/jobs/schedule-reminder
// Fires if event starts within 5 days, has 2+ attendees, and schedule is empty
router.post('/schedule-reminder', async (req, res) => {
  try {
    const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const events = await (prisma as any).event.findMany({
      where: {
        createdAt: { lte: oneDayAgo },
        startDate: { gte: new Date(), lte: fiveDaysFromNow },
        isWishlist: false,
      },
      include: {
        attendees: true,
        comments: { where: { userId: HITCH_USER_ID, content: { contains: 'schedule' } } },
      }
    });

    let reminded = 0;
    for (const event of events) {
      const goingCount = event.attendees.filter((a: any) => a.status === 'GOING').length + 1;
      if (goingCount < 2 || event.comments.length > 0) continue;

      const subevents = await (prisma as any).eventSubevent?.count?.({ where: { eventId: event.id } }).catch(() => 0) || 0;
      const activities = await (prisma as any).eventActivity?.count?.({ where: { eventId: event.id } }).catch(() => 0) || 0;
      if (subevents + activities > 0) continue;

      const userIds = [event.organizerId, ...event.attendees.filter((a: any) => a.status === 'GOING').map((a: any) => a.userId)];
      const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { username: true } });
      const mentions = users.map(u => `@${u.username}`).join(' ');

      const message = `Hey ${mentions} 👋\n\nTrip's almost here and the schedule is wide open! 📅 Jump into the **Schedule** tab and add some activities — hikes, meals, fire time, whatever you're planning. Your crew will thank you when nobody's standing around asking "so what are we doing today?" 😄`;

      await prisma.eventComment.create({
        data: { eventId: event.id, userId: HITCH_USER_ID, content: message }
      });

      const mutedUsers = await prisma.eventCommentMute.findMany({ where: { eventId: event.id }, select: { userId: true } });
      const mutedIds = new Set(mutedUsers.map((m: any) => m.userId));
      const notifyIds = userIds.filter(uid => !mutedIds.has(uid));

      await prisma.notification.createMany({
        data: notifyIds.map(uid => ({
          userId: uid,
          type: 'EVENT_COMMENT',
          content: `Hitch wants to help plan your schedule! 📅`,
          link: `/trips/${event.id}`,
        })),
        skipDuplicates: true,
      });

      reminded++;
    }

    res.json({ success: true, reminded });
  } catch (error) {
    console.error('Hitch schedule reminder error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/hitch/jobs/daily-digest
// Send personalized daily digest to active users
router.post('/daily-digest', async (req, res) => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get users who have been active in the last 30 days
    const activeUsers = await prisma.user.findMany({
      where: {
        updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        firstName: true,
        username: true,
        campingInterests: true,
        state: true,
        events: {
          where: { startDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
          select: { title: true, startDate: true },
          take: 1,
        },
        userBadges: { select: { id: true }, take: 1 },
      },
      take: 100,
    });

    let digested = 0;

    for (const user of activeUsers) {
      // Check if already sent today
      const alreadySent = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: 'HITCH_DIGEST',
          createdAt: { gte: yesterday },
        }
      });
      if (alreadySent) continue;

      // Build personalized digest message
      const parts: string[] = [];

      if (user.events.length > 0) {
        const trip = user.events[0];
        const daysUntil = Math.ceil((new Date(trip.startDate!).getTime() - Date.now()) / 86400000);
        parts.push(`🏕️ Your trip "${trip.title}" is in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}!`);
      }

      // Find new campgrounds in their state
      if (user.state) {
        const newCampground = await prisma.campground.findFirst({
          where: { state: { contains: user.state, mode: 'insensitive' } },
          orderBy: { createdAt: 'desc' },
          select: { name: true, id: true },
        });
        if (newCampground) {
          parts.push(`🗺️ Check out ${newCampground.name} near you!`);
        }
      }

      // Check for friends' new trips
      const friendTrip = await prisma.event.findFirst({
        where: {
          privacy: 'PUBLIC',
          organizerId: { not: user.id },
          createdAt: { gte: yesterday },
          startDate: { gte: new Date() },
        },
        select: { title: true, organizer: { select: { username: true } } },
        orderBy: { attendees: { _count: 'desc' } },
      });
      if (friendTrip) {
        parts.push(`👥 @${friendTrip.organizer.username} just planned "${friendTrip.title}" — check it out!`);
      }

      if (parts.length === 0) continue;

      const message = `Good morning, ${user.firstName || user.username}! 🦄

${parts.join('
')}

Have an amazing day on the road!`;

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'HITCH_DIGEST',
          content: message,
          link: '/basecamp',
        }
      });

      digested++;
    }

    res.json({ success: true, digested });
  } catch (error) {
    console.error('Daily digest error:', error);
    res.status(500).json({ error: 'Failed to send digest' });
  }
});
