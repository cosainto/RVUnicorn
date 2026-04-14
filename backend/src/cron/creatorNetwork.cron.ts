import cron from 'node-cron';
import { prisma } from '../prisma';
import { generateCreatorInsights } from '../services/creatorInsightService';

export function registerCreatorNetworkCrons() {
  // Monday 8am Central — generate creator insights
  cron.schedule('0 8 * * 1', async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const activeCreators = await prisma.user.findMany({
        where: {
          isCreator: true,
          creatorContent: { some: { publishedAt: { gte: thirtyDaysAgo } } },
        },
        select: { id: true },
      });

      console.log(`[CreatorInsightCron] Processing ${activeCreators.length} active creators`);

      for (const creator of activeCreators) {
        try {
          await generateCreatorInsights(creator.id);
        } catch (e: any) {
          console.error(`[CreatorInsightCron] Failed for ${creator.id}:`, e);
        }
      }
    } catch (e: any) {
      console.error('[CreatorInsightCron] Error:', e);
    }
  }, { timezone: 'America/Chicago' });

  // Every hour — expire stale creator presence (>5 days)
  cron.schedule('0 * * * *', async () => {
    try {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const { count } = await (prisma as any).creatorPresence.updateMany({
        where: { isActive: true, startedAt: { lte: fiveDaysAgo } },
        data: { isActive: false, endedAt: new Date() },
      });
      if (count > 0) console.log(`[CreatorPresenceCron] Expired ${count} stale presences`);
    } catch (e: any) {
      console.error('[CreatorPresenceCron] Error:', e);
    }
  }, { timezone: 'America/Chicago' });

  console.log('[CreatorNetworkCrons] Registered Monday insights + hourly presence cleanup');
}
