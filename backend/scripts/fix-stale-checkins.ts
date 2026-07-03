/**
 * One-time script to fix stale check-ins.
 *
 * Step 1: Close Deanna's stale check-in (userId: cmm9kukta0006i88masvtz2tp)
 * Step 1b: Close Will's stale check-in if any (userId: cmlpeyk82005s3qause3sws7y)
 * Step 2: Find and close ALL check-ins open > 14 days
 *
 * Run from backend directory:
 *   npx ts-node scripts/fix-stale-checkins.ts
 */

import { PrismaClient } from '@prisma/client';

// Use a single connection to avoid exhausting the pool
const dbUrl = process.env.DATABASE_URL;
const connLimitUrl = dbUrl?.includes('connection_limit=')
  ? dbUrl.replace(/connection_limit=\d+/, 'connection_limit=1')
  : dbUrl + (dbUrl?.includes('?') ? '&' : '?') + 'connection_limit=1';
const prisma = new PrismaClient({ datasources: { db: { url: connLimitUrl } } });

async function main() {
  const now = new Date();

  // ── Step 1: Fix Deanna's check-in ──────────────────────────────────
  console.log('\n── Step 1: Deanna (cmm9kukta0006i88masvtz2tp) ──');
  const deannaCheckIn = await prisma.checkIn.findFirst({
    where: { userId: 'cmm9kukta0006i88masvtz2tp', isActive: true },
    include: { campground: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (deannaCheckIn) {
    console.log(`Found active check-in: ${deannaCheckIn.campground?.name || 'unknown'}, since ${deannaCheckIn.checkInDate}`);
    await prisma.checkIn.update({
      where: { id: deannaCheckIn.id },
      data: { isActive: false, checkOutDate: now },
    });
    console.log('✓ Checked out Deanna');
  } else {
    console.log('No active check-in found for Deanna');
  }

  // ── Step 1b: Fix Will's check-in ──────────────────────────────────
  console.log('\n── Step 1b: Will (cmlpeyk82005s3qause3sws7y) ──');
  const willCheckIn = await prisma.checkIn.findFirst({
    where: { userId: 'cmlpeyk82005s3qause3sws7y', isActive: true },
    include: { campground: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (willCheckIn) {
    const daysOpen = Math.floor((now.getTime() - new Date(willCheckIn.checkInDate).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`Found active check-in: ${willCheckIn.campground?.name || 'unknown'}, since ${willCheckIn.checkInDate} (${daysOpen} days)`);
    if (daysOpen > 14) {
      await prisma.checkIn.update({
        where: { id: willCheckIn.id },
        data: { isActive: false, checkOutDate: now },
      });
      console.log('✓ Checked out Will (stale > 14 days)');
    } else {
      console.log(`Will's check-in is only ${daysOpen} days old — not stale, skipping`);
    }
  } else {
    console.log('No active check-in found for Will');
  }

  // ── Step 2: Find all stale check-ins (> 14 days) ──────────────────
  console.log('\n── Step 2: All stale check-ins (> 14 days) ──');
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const stale = await prisma.checkIn.findMany({
    where: {
      isActive: true,
      checkOutDate: null,
      checkInDate: { lt: fourteenDaysAgo },
    },
    include: {
      user: { select: { email: true, username: true, firstName: true } },
      campground: { select: { name: true } },
    },
    orderBy: { checkInDate: 'asc' },
  });

  console.log(`Found ${stale.length} stale check-in(s):`);
  for (const ci of stale) {
    const days = Math.floor((now.getTime() - new Date(ci.checkInDate).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  ${ci.user?.username || ci.user?.email} at ${ci.campground?.name || 'unknown'} — ${days} days (since ${ci.checkInDate.toISOString().split('T')[0]})`);
  }

  if (stale.length > 0) {
    const result = await prisma.checkIn.updateMany({
      where: {
        isActive: true,
        checkOutDate: null,
        checkInDate: { lt: fourteenDaysAgo },
      },
      data: { isActive: false, checkOutDate: now },
    });
    console.log(`\n✓ Closed ${result.count} stale check-in(s)`);
  }

  console.log('\nDone.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
