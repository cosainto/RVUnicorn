import { PrismaClient } from "@prisma/client";
import { runAIAnalysis } from "../routes/ai-maintenance";

const prisma = new PrismaClient();

export async function runMaintenanceCron() {
  try {
    // Find all RVs with AI monitoring enabled
    const users = await prisma.user.findMany({
      where: { aiMaintenanceEnabled: true },
      select: { id: true, rvMake: true, rvModel: true, rvYear: true },
    });

    console.log(`[MaintenanceCron] Checking ${users.length} users with AI maintenance enabled...`);

    let totalRecommendations = 0;
    for (const user of users) {
      try {
        const count = await runAIAnalysis(user.id, user.id);
        totalRecommendations += count;
        console.log(`[MaintenanceCron] ${user.rvYear || ''} ${user.rvMake || ''} ${user.rvModel || ''}: ${count} recommendations`);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`[MaintenanceCron] Failed for user ${user.id}:`, e);
      }
    }

    console.log(`[MaintenanceCron] Done. ${totalRecommendations} total recommendations generated.`);
  } catch (e) {
    console.error("[MaintenanceCron] Cron job failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  runMaintenanceCron().then(() => process.exit(0));
}
