import cron from 'node-cron';
import { prisma } from '../prisma';
import { sendWebPush } from '../utils/webPush';
import { pushNotification } from '../routes/notification.routes';

async function sendScheduledBroadcasts() {
  try {
    const due = await (prisma as any).organizerBroadcast.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: { lte: new Date() },
      },
      include: {
        campground: { select: { name: true } },
      },
    });

    for (const broadcast of due) {
      try {
        // Find recipients based on audience
        let recipientIds: string[] = [];
        const campgroundId = broadcast.campgroundId;

        switch (broadcast.audience) {
          case 'ALL_CHECKED_IN': {
            const checkIns = await prisma.checkIn.findMany({
              where: { campgroundId },
              select: { userId: true },
            });
            recipientIds = Array.from(new Set(checkIns.map((c) => c.userId)));
            break;
          }
          case 'ARRIVING_TODAY': {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
            const events = await (prisma as any).event.findMany({
              where: { campgroundId, startDate: { gte: todayStart, lt: todayEnd } },
              include: { attendees: { select: { userId: true } } },
            });
            const ids = events.flatMap((e: any) => e.attendees.map((a: any) => a.userId));
            recipientIds = Array.from(new Set(ids));
            break;
          }
          case 'EVENT_ATTENDEES': {
            if (broadcast.eventId) {
              const attendees = await (prisma as any).eventAttendee.findMany({
                where: { eventId: broadcast.eventId },
                select: { userId: true },
              });
              recipientIds = attendees.map((a: any) => a.userId);
            }
            break;
          }
        }

        // Send notifications
        const title = `${broadcast.campground.name} 📢`;
        await Promise.allSettled(
          recipientIds.map(async (userId: string) => {
            await sendWebPush(userId, { title, body: broadcast.message, url: `/campgrounds/${campgroundId}` });
            await prisma.notification.create({
              data: {
                userId,
                type: 'BROADCAST',
                content: broadcast.message,
                link: `/campgrounds/${campgroundId}`,
                category: 'CAMPGROUND',
                actorName: broadcast.campground.name,
              },
            });
            pushNotification(userId, {
              type: 'BROADCAST',
              content: broadcast.message,
              link: `/campgrounds/${campgroundId}`,
              actorName: broadcast.campground.name,
            });
          })
        );

        // Update broadcast status
        await (prisma as any).organizerBroadcast.update({
          where: { id: broadcast.id },
          data: { status: 'SENT', sentAt: new Date(), recipientCount: recipientIds.length },
        });

        console.log(`[BroadcastCron] Sent "${broadcast.message.slice(0, 40)}..." → ${recipientIds.length} recipients`);
      } catch (e) {
        console.error(`[BroadcastCron] Failed to send broadcast ${broadcast.id}:`, e);
      }
    }
  } catch (e) {
    console.error('[BroadcastCron] Error:', e);
  }
}

export function registerBroadcastCron() {
  // Every 5 minutes: send scheduled broadcasts that are due
  cron.schedule('*/5 * * * *', () => {
    sendScheduledBroadcasts();
  }, { timezone: 'America/Chicago' });

  console.log('[BroadcastCron] Registered 5-minute broadcast scheduler');
}
