import express from "express";
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { authenticateToken } from "../middleware/auth.middleware";

const router = express.Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Toggle AI monitoring on/off ───────────────────────────────────────────────
router.post("/toggle", authenticateToken, async (req: any, res) => {
  const { rvId, enabled } = req.body;
  const userId = req.user.id;

  try {
    const rv = await prisma.rV.findFirst({ where: { id: userId } });
    if (!rv) return res.status(404).json({ error: "RV not found" });

    const updated = await prisma.rV.update({
      where: { id: rvId },
      data: { aiMaintenanceEnabled: enabled },
    });

    res.json({ success: true, aiMaintenanceEnabled: updated.aiMaintenanceEnabled });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Update current odometer ───────────────────────────────────────────────────
router.post("/odometer", authenticateToken, async (req: any, res) => {
  const { rvId, mileage } = req.body;
  const userId = req.user.id;

  try {
    const rv = await prisma.rV.findFirst({ where: { id: userId } });
    if (!rv) return res.status(404).json({ error: "RV not found" });

    await prisma.rV.update({
      where: { id: rvId },
      data: { currentOdometer: mileage },
    });

    // Trigger AI analysis immediately after odometer update
    await runAIAnalysis(rvId, userId);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get recommendations for a specific RV ────────────────────────────────────
router.get("/recommendations/:rvId", authenticateToken, async (req: any, res) => {
  const { rvId } = req.params;
  const userId = req.user.id;

  try {
    const recommendations = await prisma.maintenanceRecommendation.findMany({
      where: { userId, status: "pending" },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    });

    res.json(recommendations);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Dismiss a recommendation ──────────────────────────────────────────────────
router.post("/recommendations/:id/dismiss", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    await prisma.maintenanceRecommendation.update({
      where: { id, userId },
      data: { status: "dismissed" },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Convert recommendation to scheduled maintenance ───────────────────────────
router.post("/recommendations/:id/schedule", authenticateToken, async (req: any, res) => {
  const { id } = req.params;
  const { scheduledDate } = req.body;
  const userId = req.user.id;

  try {
    const rec = await prisma.maintenanceRecommendation.findFirst({ where: { id, userId } });
    if (!rec) return res.status(404).json({ error: "Recommendation not found" });

    // Mark recommendation as scheduled
    await prisma.maintenanceRecommendation.update({
      where: { id },
      data: { status: "scheduled" },
    });

    // Create actual maintenance record
    await (prisma as any).rVMaintenance.create({
      data: {
        rvId: rec.rvId,
        userId,
        serviceType: rec.serviceType,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        notes: `Scheduled from Hitch AI recommendation: ${rec.aiReason}`,
        status: "scheduled",
      },
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Manual trigger: run AI analysis now ──────────────────────────────────────
router.post("/analyze/:rvId", authenticateToken, async (req: any, res) => {
  const { rvId } = req.params;
  const userId = req.user.id;

  try {
    const count = await runAIAnalysis(rvId, userId);
    res.json({ success: true, recommendationsGenerated: count });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CORE AI ANALYSIS FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
export async function runAIAnalysis(rvId: string, userId: string): Promise<number> {
  // Fetch RV with full details and maintenance history
  const rv = await (prisma as any).rV.findFirst({
    where: { id: userId },
    include: {
      maintenanceRecords: {
        orderBy: { completedDate: "desc" },
        take: 20,
      },
    },
  });

  if (!rv) throw new Error("RV not found");

  // Build maintenance history summary
  const historyLines = (rv.maintenanceRecords || []).map((r: any) => {
    const date = r.completedDate ? new Date(r.completedDate).toLocaleDateString() : "scheduled";
    const miles = r.mileageAtService ? ` at ${r.mileageAtService} miles` : "";
    return `- ${r.serviceType}${miles} on ${date}`;
  }).join("\n") || "- No maintenance history on record";

  const currentMiles = rv.currentOdometer || 0;
  const rvAge = rv.year ? new Date().getFullYear() - rv.year : null;

  const prompt = `You are Hitch, RVUnicorn's AI maintenance assistant. Analyze this RV and return maintenance recommendations as JSON only.

RV Details:
- Year: ${rv.year || "Unknown"}
- Make: ${rv.make || "Unknown"}
- Model: ${rv.model || "Unknown"}
- Type: ${rv.type || "Unknown"}
- Current Odometer: ${currentMiles} miles
- Engine Type: ${rv.engineType || "Unknown"}
- Age: ${rvAge ? rvAge + " years" : "Unknown"}

Maintenance History:
${historyLines}

Return ONLY a JSON array of recommendations (no markdown, no explanation):
[
  {
    "serviceType": "Oil Change",
    "urgency": "high",
    "recommendedMileage": 75000,
    "recommendedDaysFromNow": 30,
    "reason": "Last oil change was 4,800 miles ago. Standard interval is 5,000-7,500 miles."
  }
]

Urgency levels: "low" (informational), "normal" (due within 3 months), "high" (due within 1 month), "critical" (overdue)

Check for these service types as applicable:
Oil Change, Tire Rotation, Tire Inspection, Brake Inspection, Air Filter, Fuel Filter,
Generator Service, Battery Check, Roof Inspection, Slide-Out Lubrication, Awning Inspection,
Propane System Check, Water Heater Flush, Fresh Water Tank Sanitize, Winterization,
Dewinterization, Wheel Bearing Repack, Transmission Service, Coolant Flush,
Spark Plugs, Chassis Lubrication, Leveling System Check, Sewer System Inspection

Only include services that are actually due or coming up soon based on the data. Return empty array [] if nothing is due.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let recommendations: any[] = [];
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    recommendations = JSON.parse(cleaned);
    if (!Array.isArray(recommendations)) recommendations = [];
  } catch {
    console.error("Failed to parse AI maintenance response:", text);
    return 0;
  }

  if (recommendations.length === 0) return 0;

  // Clear old pending recommendations for this RV
  await prisma.maintenanceRecommendation.deleteMany({
    where: { userId, status: "pending" },
  });

  // Save new recommendations
  let saved = 0;
  for (const rec of recommendations) {
    try {
      const recommendedDate = rec.recommendedDaysFromNow
        ? new Date(Date.now() + rec.recommendedDaysFromNow * 86400000)
        : null;

      await prisma.maintenanceRecommendation.create({
        data: {
          userId,
          serviceType: rec.serviceType || "General Service",
          urgency: rec.urgency || "normal",
          recommendedDate,
          recommendedMileage: rec.recommendedMileage || null,
          aiReason: rec.reason || "",
          status: "pending",
        },
      });
      saved++;

      // Fire notification for high/critical urgency
      if (rec.urgency === "high" || rec.urgency === "critical") {
        await createMaintenanceNotification(userId, rv, rec);
      }
    } catch (e) {
      console.error("Failed to save recommendation:", e);
    }
  }

  return saved;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION HELPER
// ─────────────────────────────────────────────────────────────────────────────
async function createMaintenanceNotification(userId: string, rv: any, rec: any) {
  try {
    await (prisma as any).notification.create({
      data: {
        userId,
        type: "MAINTENANCE_REMINDER",
        title: `${rec.urgency === "critical" ? "🚨" : "🔧"} Maintenance Due: ${rec.serviceType}`,
        message: `Hitch thinks your ${rv.year || ""} ${rv.make || ""} ${rv.model || ""} needs a ${rec.serviceType}. ${rec.reason}`,
        data: JSON.stringify({ rvId: rv.id, serviceType: rec.serviceType, urgency: rec.urgency }),
      },
    });
  } catch (e) {
    console.error("Failed to create maintenance notification:", e);
  }
}

export default router;
