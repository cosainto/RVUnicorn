import cron from 'node-cron';
import { prisma } from '../prisma';
import { publishCampfireThread } from '../services/campfireThreadPublisher';

async function publishNextScheduledThread() {
  try {
    const thread = await (prisma as any).campfireThread.findFirst({
      where: {
        status: 'SCHEDULED',
        scheduledFor: { lte: new Date() },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    if (thread) {
      await publishCampfireThread(thread.id);
      console.log(`[CampfireThreadCron] Published scheduled thread: ${thread.title}`);
    }
  } catch (e: any) {
    console.error('[CampfireThreadCron] Error publishing scheduled thread:', e);
  }
}

export function registerCampfireThreadCrons() {
  // Saturday 9:00 AM Central — Discovery/Inspiration thread
  cron.schedule('0 9 * * 6', () => {
    publishNextScheduledThread();
  }, { timezone: 'America/Chicago' });

  // Tuesday 9:00 AM Central — Utility/Controversy thread
  cron.schedule('0 9 * * 2', () => {
    publishNextScheduledThread();
  }, { timezone: 'America/Chicago' });

  console.log('[CampfireThreadCron] Registered Saturday + Tuesday publishing crons');
}
