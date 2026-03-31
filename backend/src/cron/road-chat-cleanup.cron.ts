import { prisma } from '../prisma';

export async function runRoadChatCleanup() {
  try {
    const result = await prisma.roadChatLog.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      console.log(`[RoadChatCleanup] Deleted ${result.count} expired road chat log entries`);
    }
  } catch (e) {
    console.error('[RoadChatCleanup] Error:', e);
  }
}
