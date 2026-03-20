const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
(async () => {
  const userId = 'cmlpeyk82005s3qause3sws7y';
  const today = new Date();
  const event = await prisma.event.findFirst({
    where: {
      OR: [{ organizerId: userId }, { attendees: { some: { userId } } }],
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      tripPlans: {
        include: {
          pitStops: true,
        },
      },
      campground: { select: { name: true, state: true, latitude: true, longitude: true } },
    },
  });
  if (!event) { console.log('No active event found'); }
  else {
    console.log('Event:', event.title);
    console.log('Trip plans:', event.tripPlans.length);
    event.tripPlans.forEach(tp => {
      console.log('Plan - start:', tp.startLocation, 'end:', tp.endLocation);
      console.log('  startLat:', tp.startLatitude, 'startLng:', tp.startLongitude);
      console.log('  endLat:', tp.endLatitude, 'endLng:', tp.endLongitude);
      console.log('  routePolyline:', tp.routePolyline ? 'YES (' + tp.routePolyline.length + ' chars)' : 'NO');
      console.log('  pitStops:', tp.pitStops.length);
      tp.pitStops.forEach(ps => console.log('    PitStop:', ps.name, 'lat:', ps.latitude, 'lng:', ps.longitude));
    });
  }
  await prisma.$disconnect();
})();
