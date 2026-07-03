import { prisma } from '../prisma';
import { createNotification } from '../utils/createNotification';

/**
 * Auto-checkout stale check-ins.
 *
 * Runs daily (wired in index.ts at hourly cadence — the 3 AM CT gate
 * ensures it only fires once per day). Two passes:
 *
 * 1. **Nudge pass (7 days)** — For check-ins open 7–14 days, send a
 *    one-time "Still here?" notification so the user can confirm or
 *    check out. Deduplicated via metadata.checkInId on notification.
 *
 * 2. **Auto-close pass (14 days)** — For check-ins open > 14 days
 *    (and which received a nudge or were never nudged), silently
 *    close them. This prevents phantom "checked in" banners from
 *    persisting indefinitely.
 */

const SEVEN_DAYS_MS  = 7  * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function runAutoCheckoutCron() {
  const now = new Date();
  const hour = now.getUTCHours(); // 3 AM CT ≈ 8 AM UTC (CDT) or 9 AM UTC (CST)
  if (hour < 8 || hour > 9) return; // only fire in the 3 AM CT window

  let nudged = 0;
  let closed = 0;

  try {
    // ── Pass 1: Nudge users with check-ins open 7–14 days ────────────
    const nudgeCutoff = new Date(now.getTime() - SEVEN_DAYS_MS);
    const closeCutoff = new Date(now.getTime() - FOURTEEN_DAYS_MS);

    const staleNudgeable = await prisma.checkIn.findMany({
      where: {
        isActive: true,
        checkOutDate: null,
        updatedAt: { lte: nudgeCutoff, gt: closeCutoff },
      },
      include: {
        campground: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true } },
      },
      take: 200,
    });

    for (const ci of staleNudgeable) {
      try {
        // Dedupe: skip if we already sent a STALE_CHECKIN_NUDGE for this check-in
        const alreadyNudged = await prisma.notification.findFirst({
          where: {
            userId: ci.userId,
            type: 'STALE_CHECKIN_NUDGE',
            metadata: { path: ['checkInId'], equals: ci.id },
          },
          select: { id: true },
        });
        if (alreadyNudged) continue;

        const locationName = ci.campground?.name || 'your campground';
        await createNotification({
          userId: ci.userId,
          type: 'STALE_CHECKIN_NUDGE',
          category: 'SYSTEM',
          content: `Still at ${locationName}? Tap to confirm your stay or check out.`,
          link: '/basecamp',
          actorName: 'Hitch',
          actorAvatar: '/hitch.png',
          metadata: {
            checkInId: ci.id,
            campgroundId: ci.campground?.id,
            campgroundName: locationName,
          },
        });
        nudged++;
      } catch (e) {
        console.error(`[AutoCheckout] Nudge failed for check-in ${ci.id}:`, e);
      }
    }

    // ── Pass 2: Auto-close check-ins open > 14 days ──────────────────
    // Use updatedAt so that "confirm stay" (which bumps updatedAt)
    // resets the 14-day auto-close timer.
    const result = await prisma.checkIn.updateMany({
      where: {
        isActive: true,
        checkOutDate: null,
        updatedAt: { lte: closeCutoff },
      },
      data: {
        isActive: false,
        checkOutDate: now,
      },
    });
    closed = result.count;

    if (nudged > 0 || closed > 0) {
      console.log(`[AutoCheckout] nudged=${nudged} auto-closed=${closed}`);
    }
  } catch (e) {
    console.error('[AutoCheckout] cron error:', e);
  }
}
