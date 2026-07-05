import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient() as any;

/**
 * Check if a user can view a trip (owner OR participant)
 */
export async function userCanViewTrip(userId: string, tripId: string): Promise<boolean> {
  const trip = await prisma.event.findFirst({
    where: {
      id: tripId,
      OR: [
        { organizerId: userId },
        { attendees: { some: { userId, status: { in: ['ATTENDING', 'attending', 'GOING', 'going', 'PENDING', 'pending'] } } } },
      ],
    },
    select: { id: true },
  });
  return !!trip;
}

/**
 * Check if a user can edit a trip (organizer, HOST role, CO_HOST role, or household partner)
 */
export async function userCanEditTrip(userId: string, tripId: string): Promise<boolean> {
  const trip = await prisma.event.findUnique({
    where: { id: tripId },
    select: { organizerId: true, attendees: { where: { userId }, select: { role: true } } },
  });
  if (!trip) return false;

  // Organizer can always edit
  if (trip.organizerId === userId) return true;

  // HOST or CO_HOST role
  const attendee = trip.attendees[0];
  if (attendee?.role === 'HOST' || attendee?.role === 'CO_HOST') return true;

  // Household partner of organizer
  const organizer = await prisma.user.findUnique({ where: { id: trip.organizerId }, select: { householdId: true } });
  const editor = await prisma.user.findUnique({ where: { id: userId }, select: { householdId: true } });
  if (organizer?.householdId && organizer.householdId === editor?.householdId) return true;

  return false;
}

/**
 * Auto-invite rig co-pilots to a newly created trip
 */
export async function autoInviteRigCopilots(tripId: string, hostUserId: string): Promise<number> {
  // Find the host's rig
  const rig = await prisma.rig.findFirst({
    where: { ownerId: hostUserId },
    select: { id: true },
  });
  if (!rig) return 0;

  // Find co-pilots
  const copilots = await prisma.rigCoPilot.findMany({
    where: { rigId: rig.id, userId: { not: hostUserId } },
    select: { userId: true },
  });

  // Also find household partners
  const host = await prisma.user.findUnique({ where: { id: hostUserId }, select: { householdId: true } });
  const householdPartners = host?.householdId
    ? await prisma.user.findMany({
        where: { householdId: host.householdId, id: { not: hostUserId } },
        select: { id: true },
      })
    : [];

  const inviteIds = new Set([
    ...copilots.map((c: any) => c.userId),
    ...householdPartners.map((p: any) => p.id),
  ]);

  let invited = 0;
  for (const userId of inviteIds) {
    await prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId: tripId, userId } },
      create: { eventId: tripId, userId, status: 'ATTENDING', role: 'CO_HOST' },
      update: {},
    }).catch(() => {});
    invited++;
  }

  if (invited > 0) {
    await prisma.event.update({
      where: { id: tripId },
      data: { isShared: true, rigId: rig.id },
    }).catch(() => {});
  }

  return invited;
}
