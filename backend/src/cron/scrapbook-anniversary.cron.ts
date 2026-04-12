import cron from 'node-cron';
import { prisma } from '../prisma';
import { sendWebPush } from '../utils/webPush';

export function registerScrapbookAnniversaryCron() {
  // Daily at 8am Central — send "one year ago" anniversary notifications
  cron.schedule('0 8 * * *', async () => {
    try {
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();

      // Find events that started on this calendar date in a prior year
      // and have scrapbook pins
      const anniversaryEvents = await (prisma as any).$queryRaw`
        SELECT e.id, e.title, e."organizerId", e."startDate",
               c.name as "campgroundName",
               (SELECT p."imageUrl" FROM "Photo" p
                JOIN "ScrapbookPin" sp ON sp."photoId" = p.id
                WHERE sp."eventId" = e.id
                ORDER BY sp.position ASC LIMIT 1) as "firstPinUrl"
        FROM "Event" e
        LEFT JOIN "Campground" c ON c.id = e."campgroundId"
        JOIN "ScrapbookPin" sp2 ON sp2."eventId" = e.id
        WHERE EXTRACT(MONTH FROM e."startDate") = ${todayMonth}
          AND EXTRACT(DAY FROM e."startDate") = ${todayDay}
          AND EXTRACT(YEAR FROM e."startDate") < ${today.getFullYear()}
        GROUP BY e.id, c.name
      `;

      console.log(`[AnniversaryCron] Found ${(anniversaryEvents as any[]).length} anniversary trips`);

      for (const event of (anniversaryEvents as any[])) {
        const tripYear = new Date(event.startDate).getFullYear();

        // Check if already notified
        const already = await (prisma as any).tripAnniversary.findFirst({
          where: { eventId: event.id, userId: event.organizerId, tripYear, notifiedAt: { not: null } },
        });
        if (already) continue;

        // Send push
        await sendWebPush(event.organizerId, {
          title: '📸 One year ago today...',
          body: `You were at ${event.campgroundName || 'the campground'} — relive the memories`,
          url: `/trips/${event.id}?tab=scrapbook`,
          icon: event.firstPinUrl || undefined,
        });

        // Mark notified
        await (prisma as any).tripAnniversary.upsert({
          where: { eventId_userId_tripYear: { eventId: event.id, userId: event.organizerId, tripYear } },
          update: { notifiedAt: new Date() },
          create: { eventId: event.id, userId: event.organizerId, tripYear, notifiedAt: new Date() },
        });
      }
    } catch (e) {
      console.error('[AnniversaryCron] Error:', e);
    }
  }, { timezone: 'America/Chicago' });

  console.log('[AnniversaryCron] Registered daily 8am anniversary check');
}
