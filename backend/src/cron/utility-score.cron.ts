import cron from 'node-cron';
import { prisma } from '../prisma';

export function registerUtilityScoreCron() {
  // Daily at 2am CT — recalculate utility scores
  cron.schedule('0 2 * * *', async () => {
    console.log('[UtilityScore] recalculating...');
    try {
      const activities = await prisma.actionableContent.findMany({
        where: { status: 'ACTIVE' },
        include: {
          _count: {
            select: {
              saves: true,
              completions: true,
              instances: true,
            },
          },
        },
      });

      let updated = 0;
      for (const activity of activities) {
        const ageInDays = Math.max(
          1,
          (Date.now() - activity.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        const rawScore =
          activity._count.saves * 2 +
          activity.joinCount * 3 +
          activity._count.completions * 4;

        const utilityScore = rawScore / Math.sqrt(ageInDays);

        await prisma.actionableContent.update({
          where: { id: activity.id },
          data: { utilityScore },
        });
        updated++;
      }

      console.log(`[UtilityScore] updated ${updated} activities`);
    } catch (err) {
      console.error('[UtilityScore] cron failed:', err);
    }
  }, { timezone: 'America/Chicago' });
}
