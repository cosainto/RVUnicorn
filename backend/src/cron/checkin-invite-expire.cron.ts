import { prisma } from '../prisma';
import { sendWebPush } from '../utils/webPush';

/**
 * Auto-accept expired check-in invites.
 *
 * Runs every 15 minutes. Finds PENDING CheckInInvite records whose
 * expiresAt has passed (120 min after creation) and converts them
 * into real CheckIn records for the invitee, marking the invite
 * as AUTO_ACCEPTED. The invitee receives a notification.
 */
export async function runCheckInInviteExpireCron() {
  const now = new Date();
  let processed = 0;

  try {
    const expired = await prisma.checkInInvite.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      include: {
        inviter: { select: { id: true, firstName: true, lastName: true } },
        checkIn: {
          include: {
            campground: { select: { id: true, name: true } },
          },
        },
      },
    });

    for (const invite of expired) {
      try {
        // Check out invitee from any active check-in
        await prisma.checkIn.updateMany({
          where: { userId: invite.inviteeId, isActive: true },
          data: { isActive: false, checkOutDate: now },
        });

        // Create check-in for invitee
        await prisma.checkIn.create({
          data: {
            userId: invite.inviteeId,
            campgroundId: invite.campgroundId,
            harvestHostId: invite.harvestHostId,
            overnightSpotId: invite.overnightSpotId,
            siteNumber: invite.siteNumber,
            notes: invite.notes,
            checkInDate: now,
            isActive: true,
          },
        });

        // Mark invite as auto-accepted
        await prisma.checkInInvite.update({
          where: { id: invite.id },
          data: { status: 'AUTO_ACCEPTED', respondedAt: now },
        });

        // Notify invitee
        const inviterName = `${invite.inviter.firstName} ${invite.inviter.lastName || ''}`.trim();
        const locationName = invite.checkIn?.campground?.name || 'a location';
        const campgroundId = invite.campgroundId;

        await prisma.notification.create({
          data: {
            userId: invite.inviteeId,
            type: 'CHECKIN_AUTO',
            content: `You were checked in at ${locationName} by ${inviterName}`,
            link: campgroundId ? `/campgrounds/${campgroundId}` : '/dashboard',
            actorId: invite.inviterId,
            actorName: inviterName,
          },
        });

        sendWebPush(invite.inviteeId, {
          title: 'Checked In',
          body: `You were checked in at ${locationName} by ${inviterName}`,
          icon: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png',
          url: campgroundId ? `/campgrounds/${campgroundId}` : '/dashboard',
        }).catch(() => {});

        processed++;
      } catch (err) {
        console.error(`[CheckInInviteExpire] Failed for invite ${invite.id}:`, err);
      }
    }

    if (processed > 0) {
      console.log(`[CheckInInviteExpire] Auto-accepted ${processed} expired invite(s)`);
    }
  } catch (e) {
    console.error('[CheckInInviteExpire] cron error:', e);
  }
}
