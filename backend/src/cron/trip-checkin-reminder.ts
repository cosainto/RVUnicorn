import { prisma } from '../prisma';
import { pushNotification } from '../routes/notification.routes';

export async function runTripCheckinReminder() {
  console.log('[TripCheckinReminder] Running...');

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  try {
    // Find all trips starting today that have a campground attached
    const trips = await prisma.event.findMany({
      where: {
        startDate: { gte: todayStart, lte: todayEnd },
        campgroundId: { not: null },
      },
      include: {
        campground: { select: { id: true, name: true, city: true, state: true } },
        attendees: {
          include: {
            user: { select: { id: true, firstName: true } },
          },
        },
      },
    });

    console.log(`[TripCheckinReminder] Found ${trips.length} trips starting today`);

    for (const trip of trips) {
      if (!trip.campground) continue;

      for (const attendee of trip.attendees) {
        try {
          // Check if already checked in at this campground today
          const alreadyCheckedIn = await prisma.checkIn.findFirst({
            where: {
              userId: attendee.user.id,
              campgroundId: trip.campground.id,
              isActive: true,
            },
          });

          if (alreadyCheckedIn) continue;

          // Create notification in DB
          const notification = await prisma.notification.create({
            data: {
              userId: attendee.user.id,
              type: 'TRIP_CHECKIN_REMINDER',
              category: 'TRIP',
              content: `You're supposed to be at ${trip.campground.name} today! Don't forget to check in 🏕️`,
              link: `/campgrounds/${trip.campground.id}`,
              actorName: 'RVUnicorn',
              actorAvatar: '/hitch.png',
              metadata: {
                campgroundId: trip.campground.id,
                campgroundName: trip.campground.name,
                tripId: trip.id,
                tripTitle: trip.title,
              },
            },
          });

          // Push live via SSE
          pushNotification(attendee.user.id, notification);
          console.log(`[TripCheckinReminder] Notified ${attendee.user.firstName} for ${trip.campground.name}`);
        } catch (e) {
          console.error(`[TripCheckinReminder] Failed for user ${attendee.user.id}:`, e);
        }
      }
    }
  } catch (e) {
    console.error('[TripCheckinReminder] Error:', e);
  }
}
