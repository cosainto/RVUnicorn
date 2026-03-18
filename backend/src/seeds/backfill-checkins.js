const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

(async () => {
  const now = new Date();

  const pastTrips = await prisma.event.findMany({
    where: {
      campgroundId: { not: null },
      startDate: { lt: now },
    },
    include: {
      attendees: { include: { user: { select: { id: true, firstName: true } } } },
      campground: { select: { id: true, name: true, state: true } },
    },
  });

  console.log('Found ' + pastTrips.length + ' past trips with campgrounds');
  let created = 0;
  let skipped = 0;

  for (const trip of pastTrips) {
    if (!trip.campgroundId) continue;
    for (const attendee of trip.attendees) {
      const existing = await prisma.checkIn.findFirst({
        where: {
          userId: attendee.user.id,
          campgroundId: trip.campgroundId,
          checkInDate: {
            gte: new Date(trip.startDate.getTime() - 86400000),
            lte: new Date(trip.startDate.getTime() + 86400000),
          },
        },
      });
      if (existing) { skipped++; continue; }
      await prisma.checkIn.create({
        data: {
          userId: attendee.user.id,
          campgroundId: trip.campgroundId,
          checkInDate: trip.startDate,
          checkOutDate: trip.endDate || trip.startDate,
          isActive: false,
          notes: 'Auto-created from past trip: ' + trip.title,
        },
      });
      created++;
      console.log('Created: ' + attendee.user.firstName + ' → ' + trip.campground.name + ' (' + trip.campground.state + ')');
    }
  }

  console.log('Done. Created: ' + created + ' · Skipped: ' + skipped);
  await prisma.$disconnect();
})();
