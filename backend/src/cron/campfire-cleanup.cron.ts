import { prisma } from '../prisma';

export async function runCampfireCleanup() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await prisma.campfireMessage.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      console.log(`[CampfireCleanup] Deleted ${result.count} messages older than 24h`);
    }
  } catch (e) {
    console.error('[CampfireCleanup] Error:', e);
  }
}
