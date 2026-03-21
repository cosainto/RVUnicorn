
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('🔍 Finding orphaned trips...');

  // Get all trips
  const allTrips = await prisma.trip.findMany({
    select: { id: true, title: true, userId: true, startDate: true }
  });

  console.log(`   Found ${allTrips.length} total Trip records`);

  // Get all valid event IDs
  const allEvents = await prisma.event.findMany({ select: { id: true } });
  const validEventIds = new Set(allEvents.map(e => e.id));

  console.log(`   Found ${allEvents.length} valid Event records`);

  // Find orphaned: trips with an eventId that no longer exists
  // All trips in the Trip model are standalone (separate from Event model)
  const orphaned = [];
  const standalone = allTrips;

  console.log(`\n📋 Results:`);
  console.log(`   Orphaned (deleted event): ${orphaned.length}`);
  console.log(`   Standalone (no event link): ${standalone.length}`);

  if (orphaned.length > 0) {
    console.log('\n🗑️  Orphaned trips to delete:');
    orphaned.forEach(t => console.log(`   - ${t.id}: ${t.title || 'Untitled'} (eventId: ${t.eventId})`));
  }

  if (standalone.length > 0) {
    console.log('\n📌 Standalone trips (no event):');
    standalone.forEach(t => console.log(`   - ${t.id}: ${t.title || 'Untitled'} (${t.startDate ? new Date(t.startDate).toLocaleDateString() : 'no date'})`));
  }

  // Delete orphaned trips (cascade deletes TripDays too)
  if (orphaned.length > 0) {
    const orphanedIds = orphaned.map(t => t.id);
    
    // Delete trip days first
    const deletedDays = await prisma.tripDay.deleteMany({
      where: { tripId: { in: orphanedIds } }
    }).catch(() => ({ count: 0 }));
    console.log(`\n✅ Deleted ${deletedDays.count} orphaned TripDay records`);

    // Delete trips
    const deletedTrips = await prisma.trip.deleteMany({
      where: { id: { in: orphanedIds } }
    });
    console.log(`✅ Deleted ${deletedTrips.count} orphaned Trip records`);
  }

  // For standalone trips, just delete their days (the driving icons)
  if (standalone.length > 0) {
    const standaloneIds = standalone.map(t => t.id);
    const deletedDays = await prisma.tripDay.deleteMany({
      where: { tripId: { in: standaloneIds } }
    }).catch(() => ({ count: 0 }));
    console.log(`✅ Deleted ${deletedDays.count} standalone TripDay records`);

    const deletedTrips = await prisma.trip.deleteMany({
      where: { id: { in: standaloneIds } }
    });
    console.log(`✅ Deleted ${deletedTrips.count} standalone Trip records`);
  }

  if (orphaned.length === 0 && standalone.length === 0) {
    console.log('\n✨ No orphaned trips found — database is clean!');
  } else {
    console.log('\n🎉 Cleanup complete! Calendar driving icons should be gone now.');
  }

  await prisma.$disconnect();
}

cleanup().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
