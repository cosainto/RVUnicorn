import { PrismaClient } from "@prisma/client";
import { runAIAnalysis } from "../routes/ai-maintenance";

const prisma = new PrismaClient();

export async function runMaintenanceCron() {
  try {
    // Find all RVs with AI monitoring enabled
    const rvs = await (prisma as any).rV?.findMany?.({
      where: { aiMaintenanceEnabled: true },
      select: { id: true, userId: true, make: true, model: true, year: true },
    });

    console.log(`[MaintenanceCron] Checking ${rvs.length} RVs...`);

    let totalRecommendations = 0;
    for (const rv of rvs) {
      try {
        const count = await runAIAnalysis(rv.id, rv.userId);
        totalRecommendations += count;
        console.log(`[MaintenanceCron] ${rv.year} ${rv.make} ${rv.model}: ${count} recommendations`);
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`[MaintenanceCron] Failed for RV ${rv.id}:`, e);
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
