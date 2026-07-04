/**
 * Create retrospective trip for Deanna's seasonal stay at Jellystone Caledonia, WI
 * April 15 – October 10, 2025
 *
 * Run: npx ts-node scripts/create-wi-trip.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const deannaId = 'cmm9kukta0006i88masvtz2tp';
  const willId = 'cmlpeyk82005s3qause3sws7y';
  const campgroundId = 'cmlp0wjpr0c5tnalscyuh7agw';
  const visitId = 'cmm9lieq7001gi88mts73abrs';

  // Create the trip (Event)
  const trip = await prisma.event.create({
    data: {
      organizerId: deannaId,
      title: 'Seasonal Stay at Jellystone Caledonia',
      description: 'Seasonal spot - great location, tons of fun!',
      startDate: new Date('2025-04-15'),
      endDate: new Date('2025-10-10'),
      location: 'Caledonia, WI',
      campgroundId,
      privacy: 'PUBLIC',
      isWishlist: false,
      destinationType: 'CAMPGROUND',
    },
  });
  console.log('Created trip:', trip.id, trip.title);

  // Add Deanna as attendee
  await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId: trip.id, userId: deannaId } },
    create: { eventId: trip.id, userId: deannaId, status: 'ATTENDING' },
    update: {},
  });

  // Add Will as attendee
  await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId: trip.id, userId: willId } },
    create: { eventId: trip.id, userId: willId, status: 'ATTENDING' },
    update: {},
  });

  // Link Deanna's WI state visit
  await prisma.stateVisit.update({
    where: { id: visitId },
    data: { eventId: trip.id },
  });

  console.log('✓ Trip created and linked to WI state visit');
  console.log('  Trip ID:', trip.id);
  console.log('  Dates: Apr 15, 2025 – Oct 10, 2025');
  console.log('  Campground: Jellystone Caledonia');
  console.log('  Attendees: Deanna + Will');
}

main().catch(console.error).finally(() => prisma.$disconnect());
