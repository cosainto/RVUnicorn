import cron from 'node-cron';
import { prisma } from '../prisma';
import { generateConfidenceReport, saveConfidenceSnapshot } from '../services/tripConfidenceService';
import { emitConfidenceEvents } from '../services/confidenceEventEmitter';
import { sendWebPush } from '../utils/webPush';

export function registerConfidenceCron() {
  // Every morning at 7am Central — refresh confidence for trips departing within 7 days
  cron.schedule('0 7 * * *', async () => {
    try {
      const now = new Date();
      const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Find upcoming events (trips) starting within 7 days
      const upcomingEvents = await (prisma as any).event.findMany({
        where: {
          startDate: { gte: now, lte: sevenDaysOut },
          eventStatus: { in: ['UPCOMING', null] },
        },
        select: {
          id: true,
          title: true,
          organizerId: true,
          campgroundId: true,
        },
      });

      console.log(`[ConfidenceCron] Processing ${upcomingEvents.length} upcoming events`);

      for (const event of upcomingEvents) {
        try {
          const report = await generateConfidenceReport(event.id, event.organizerId);
          await saveConfidenceSnapshot(event.id, event.organizerId, report);

          // Check if score dropped significantly
          const lastSnapshot = await (prisma as any).tripConfidenceSnapshot.findFirst({
            where: { eventId: event.id, userId: event.organizerId },
            orderBy: { generatedAt: 'desc' },
            skip: 1, // skip the one we just created
          });

          if (lastSnapshot && (
            lastSnapshot.score - report.score > 15 ||
            (report.status === 'NO_GO' && lastSnapshot.status !== 'NO_GO')
          )) {
            await sendWebPush(event.organizerId, {
              title: `⚠️ Trip Alert: ${event.title}`,
              body: report.headline,
              url: '/basecamp',
            });
          }

          // Emit events for organizer dashboard
          if (event.campgroundId) {
            await emitConfidenceEvents(report, event.id, event.campgroundId, event.organizerId).catch(() => {});
          }
        } catch (e: any) {
          console.error(`[ConfidenceCron] Failed for event ${event.id}:`, e);
        }
      }
    } catch (e: any) {
      console.error('[ConfidenceCron] Error:', e);
    }
  }, { timezone: 'America/Chicago' });

  console.log('[ConfidenceCron] Registered 7am daily confidence refresh');
}
