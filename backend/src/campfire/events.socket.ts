import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';
import { computeEventLifecycle, computePresenceStatus } from '../helpers/event-status';

export function registerEventSockets(io: Server) {
  const events = io.of('/events');

  events.on('connection', async (socket: Socket) => {
    const { eventId, userId } = socket.handshake.query as { eventId: string; userId: string };
    if (!eventId) { socket.disconnect(); return; }

    socket.join(eventId);

    // Send current presence snapshot on connect
    try {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { startDate: true, endDate: true, eventStatus: true, campgroundId: true },
      });
      if (!event) return;

      const lifecycle = computeEventLifecycle(event);

      const attendees = await prisma.eventAttendee.findMany({
        where: { eventId },
        include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
      });

      const activeCheckInUserIds = new Set<string>();
      if (event.campgroundId && lifecycle === 'LIVE') {
        const checkIns = await prisma.checkIn.findMany({
          where: { campgroundId: event.campgroundId, isActive: true },
          select: { userId: true },
        });
        checkIns.forEach(c => activeCheckInUserIds.add(c.userId));
      }
      const eventCheckIns = await prisma.eventCheckIn.findMany({
        where: { eventId },
        select: { userId: true },
      });
      eventCheckIns.forEach(c => activeCheckInUserIds.add(c.userId));

      const presence = attendees.map(a => ({
        userId: a.userId,
        presenceStatus: computePresenceStatus(a, lifecycle, activeCheckInUserIds.has(a.userId)),
        user: a.user,
      }));

      socket.emit('presence:snapshot', { lifecycle, presence });
    } catch (e) {
      console.error('[EventSocket] Snapshot error:', e);
    }

    socket.on('disconnect', () => {
      // No-op for now — presence is derived from check-in state, not socket connections
    });
  });
}
