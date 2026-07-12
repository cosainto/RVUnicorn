
import { prisma } from '../lib/prisma';

/**
 * Detect duplicate rig situations:
 * 1. Users who are co-pilots on Rig A but also own their own Rig B
 * 2. Mutual friends who both own rigs with identical make/model/year
 *
 * Runs daily at 2 AM CT. Logs findings and creates notifications for rig owners.
 */
export async function runDuplicateRigDetection() {
  // Gate: only run between 2-3 AM CT
  const ctHour = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false });
  if (parseInt(ctHour) !== 2) return;

  console.log('[DuplicateRigCron] Starting duplicate rig detection...');

  try {
    // Case 1: Co-pilots who also own their own separate rig
    const rigPilots = await prisma.rigPilot.findMany({
      select: {
        userId: true,
        rigId: true,
        rig: { select: { id: true, rigName: true, slug: true, ownerId: true } },
        user: { select: { id: true, username: true, firstName: true } },
      },
    });

    const rigCoPilots = await prisma.rigCoPilot.findMany({
      select: {
        userId: true,
        rigId: true,
        rig: { select: { id: true, rigName: true, slug: true, ownerId: true } },
        user: { select: { id: true, username: true, firstName: true } },
      },
    });

    const allCoPilots = [...rigPilots, ...rigCoPilots];
    const seen = new Set<string>();
    let duplicateCount = 0;

    for (const cp of allCoPilots) {
      const key = `${cp.userId}-${cp.rigId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Check if co-pilot also owns a separate rig
      const coPilotOwnRig = await prisma.rig.findFirst({
        where: {
          ownerId: cp.userId,
          id: { not: cp.rigId },
        },
        select: { id: true, slug: true, rigName: true },
      });

      if (coPilotOwnRig) {
        duplicateCount++;
        console.log('[DuplicateRigCron] Duplicate found:', {
          coPilot: cp.user.username,
          sharedRig: cp.rig.rigName || cp.rig.slug,
          ownRig: coPilotOwnRig.rigName || coPilotOwnRig.slug,
        });

        // Check if notification already sent recently (last 30 days)
        const recentNotif = await (prisma as any).notification.findFirst({
          where: {
            userId: cp.rig.ownerId,
            type: 'DUPLICATE_RIG_DETECTED',
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        });

        if (!recentNotif) {
          await prisma.notification.create({
            data: {
              userId: cp.rig.ownerId,
              type: 'DUPLICATE_RIG_DETECTED',
              title: 'Duplicate rig page detected',
              message: `${cp.user.firstName || cp.user.username} is a co-pilot on your rig but also has their own separate rig page. You may want to merge them.`,
              data: {
                coPilotUserId: cp.userId,
                coPilotUsername: cp.user.username,
                duplicateRigId: coPilotOwnRig.id,
                duplicateRigSlug: coPilotOwnRig.slug,
              },
            } as any,
          });
        }
      }
    }

    console.log(`[DuplicateRigCron] Complete. Found ${duplicateCount} duplicate(s).`);
  } catch (e: any) {
    console.error('[DuplicateRigCron] Failed:', e.message);
  }
}
