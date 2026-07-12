/**
 * Dry-run script: merge duplicate StateVisit records per user+campground.
 *
 * When a check-in auto-creates a per-day StateVisit that falls inside
 * an existing trip's date range at the same campground, this script
 * merges the duplicate into the surviving record.
 *
 * Usage:
 *   DRY_RUN=1 npx ts-node --transpile-only src/scripts/merge-duplicate-state-visits.ts
 *   DRY_RUN=0 npx ts-node --transpile-only src/scripts/merge-duplicate-state-visits.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN !== '0';

async function main() {
  console.log(`\n=== STATE VISIT DEDUP — ${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'} ===\n`);

  // Get all users who have StateVisits
  const users = await prisma.stateVisit.findMany({
    select: { userId: true },
    distinct: ['userId'],
  });

  let totalMerged = 0;
  let totalDeleted = 0;

  for (const { userId } of users) {
    // Get all visits for this user, grouped by campground
    const visits = await prisma.stateVisit.findMany({
      where: { userId, campsiteId: { not: null } },
      orderBy: { startDate: 'asc' },
      include: {
        campsite: { select: { name: true } },
      },
    });

    // Group by campground
    const byCampground = new Map<string, typeof visits>();
    for (const v of visits) {
      const key = v.campsiteId!;
      const list = byCampground.get(key) || [];
      list.push(v);
      byCampground.set(key, list);
    }

    for (const [campsiteId, group] of byCampground) {
      if (group.length <= 1) continue;

      // Merge overlapping/adjacent visits (within 3 days)
      const merged: typeof visits = [];
      for (const visit of group) {
        const vStart = new Date(visit.startDate).getTime();
        const vEnd = new Date(visit.endDate || visit.startDate).getTime();

        // Find an existing merged record that overlaps
        const match = merged.find(m => {
          const mStart = new Date(m.startDate).getTime();
          const mEnd = new Date(m.endDate || m.startDate).getTime();
          // Overlap or within 3 days
          return vStart <= mEnd + 3 * 86400000 && vEnd >= mStart - 3 * 86400000;
        });

        if (match) {
          // Extend the survivor's date range
          const matchStart = new Date(match.startDate).getTime();
          const matchEnd = new Date(match.endDate || match.startDate).getTime();
          if (vStart < matchStart) match.startDate = visit.startDate;
          if (vEnd > matchEnd) match.endDate = visit.endDate || visit.startDate;
          // Prefer event-linked record as survivor
          if (!match.eventId && visit.eventId) {
            match.eventId = visit.eventId;
            match.notes = visit.notes;
          }
          // Merge photoUrls
          if (visit.photoUrls?.length) {
            match.photoUrls = [...new Set([...(match.photoUrls || []), ...visit.photoUrls])];
          }
        } else {
          merged.push({ ...visit });
        }
      }

      // Identify which records to keep vs delete
      const toDelete = group.filter(v => !merged.find(m => m.id === v.id));

      if (toDelete.length === 0) continue;

      const campName = group[0].campsite?.name || campsiteId;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
      const userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || userId;

      console.log(`\n${userName} @ ${campName}:`);
      console.log(`  ${group.length} records → ${merged.length} after merge`);

      for (const survivor of merged) {
        const original = group.find(g => g.id === survivor.id);
        const startChanged = original && original.startDate.getTime() !== new Date(survivor.startDate).getTime();
        const endChanged = original && (original.endDate?.getTime() || 0) !== new Date(survivor.endDate || survivor.startDate).getTime();
        if (startChanged || endChanged) {
          const startStr = new Date(survivor.startDate).toISOString().split('T')[0];
          const endStr = survivor.endDate ? new Date(survivor.endDate).toISOString().split('T')[0] : startStr;
          console.log(`  KEEP ${survivor.id} → extend to ${startStr} – ${endStr}`);
        } else {
          console.log(`  KEEP ${survivor.id} (unchanged)`);
        }
      }

      for (const del of toDelete) {
        const startStr = new Date(del.startDate).toISOString().split('T')[0];
        const endStr = del.endDate ? new Date(del.endDate).toISOString().split('T')[0] : startStr;
        console.log(`  DELETE ${del.id} (${startStr} – ${endStr}) notes: "${del.notes?.slice(0, 60) || ''}"`);
      }

      if (!DRY_RUN) {
        // Update survivors with extended date ranges
        for (const survivor of merged) {
          await prisma.stateVisit.update({
            where: { id: survivor.id },
            data: {
              startDate: survivor.startDate,
              endDate: survivor.endDate,
              eventId: survivor.eventId,
              photoUrls: survivor.photoUrls,
            },
          });
        }

        // Re-link any albums from deleted records to survivors
        for (const del of toDelete) {
          const albums = await prisma.stateVisitAlbum.findMany({ where: { stateVisitId: del.id } });
          if (albums.length > 0) {
            const survivorId = merged[0].id;
            for (const album of albums) {
              await prisma.stateVisitAlbum.upsert({
                where: { stateVisitId_albumId: { stateVisitId: survivorId, albumId: album.albumId } },
                create: { stateVisitId: survivorId, albumId: album.albumId },
                update: {},
              }).catch(() => {});
            }
            await prisma.stateVisitAlbum.deleteMany({ where: { stateVisitId: del.id } });
          }

          // Re-link attendees
          const attendees = await prisma.stateVisitAttendee.findMany({ where: { stateVisitId: del.id } });
          if (attendees.length > 0) {
            const survivorId = merged[0].id;
            for (const att of attendees) {
              await prisma.stateVisitAttendee.upsert({
                where: { stateVisitId_attendeeId: { stateVisitId: survivorId, attendeeId: att.attendeeId } },
                create: { stateVisitId: survivorId, attendeeId: att.attendeeId },
                update: {},
              }).catch(() => {});
            }
            await prisma.stateVisitAttendee.deleteMany({ where: { stateVisitId: del.id } });
          }
        }

        // Delete duplicates
        await prisma.stateVisit.deleteMany({
          where: { id: { in: toDelete.map(d => d.id) } },
        });
      }

      totalMerged += merged.length;
      totalDeleted += toDelete.length;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Surviving records: ${totalMerged}`);
  console.log(`${DRY_RUN ? 'Would delete' : 'Deleted'}: ${totalDeleted}`);
  if (DRY_RUN) console.log(`\nRe-run with DRY_RUN=0 to execute.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
