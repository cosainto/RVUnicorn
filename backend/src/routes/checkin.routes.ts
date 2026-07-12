import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { logCheckIn } from '../services/activity.service';
import { sendWebPush } from '../utils/webPush';
import { checkSharedFire } from './sharing.routes';
import { emitOrganizerActivity } from '../campfire/organizer.socket';
import { checkAndRefreshBio } from '../services/campfireBioService';
import { sendSMS } from '../services/email-sms.service';
// Lazy import to avoid circular dependency with index.ts
function getIO() { return require('../index').io; }

const router = Router();
import { prisma } from '../lib/prisma';

// POST /api/checkins - Check in to a location
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, harvestHostId, overnightSpotId, siteNumber, notes,
            checkInDate: rawCheckIn, checkOutDate: rawCheckOut } = req.body;
    const checkInDate  = rawCheckIn  ? new Date(rawCheckIn)  : new Date();
    const checkOutDate = rawCheckOut ? new Date(rawCheckOut) : null;

    if (!campgroundId && !harvestHostId && !overnightSpotId) {
      return res.status(400).json({ error: 'Must provide a location to check in to' });
    }

    // Check if user already has an active check-in at this exact location
    const locationField = campgroundId ? 'campgroundId' : harvestHostId ? 'harvestHostId' : 'overnightSpotId';
    const locationValue = campgroundId || harvestHostId || overnightSpotId;
    const existingAtSameLocation = await prisma.checkIn.findFirst({
      where: { userId, [locationField]: locationValue, isActive: true },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true, location: true, latitude: true, longitude: true } },
      },
    });

    if (existingAtSameLocation) {
      // Already checked in here — update instead of creating duplicate
      const checkIn = await prisma.checkIn.update({
        where: { id: existingAtSameLocation.id },
        data: { updatedAt: new Date(), siteNumber: siteNumber || existingAtSameLocation.siteNumber, notes: notes || existingAtSameLocation.notes },
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
          campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true, location: true, latitude: true, longitude: true } },
        },
      });
      return res.json(checkIn);
    }

    // Check out of any active check-ins at OTHER locations first
    await prisma.checkIn.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, checkOutDate: new Date() }
    });

    // Create new check-in
    const checkIn = await prisma.checkIn.create({
      data: {
        userId,
        campgroundId: campgroundId || null,
        harvestHostId: harvestHostId || null,
        overnightSpotId: overnightSpotId || null,
        checkInDate: checkInDate ? new Date(checkInDate) : new Date(),
        siteNumber: siteNumber || null,
        notes: notes || null,
        isActive: true,
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true, location: true, latitude: true, longitude: true } },
      }
    });

    // Auto-create/join Camp Session on check-in (non-blocking)
    if (campgroundId) {
      setImmediate(async () => {
        try {
          const { resolveUserRigId } = require('../services/rigResolver');
          const rig = await resolveUserRigId(userId);
          if (!rig) return;

          const rigRecord = await prisma.rig.findUnique({ where: { id: rig.id }, select: { activeTripId: true } });

          // Check if there's already an active session at this campground
          if (rigRecord?.activeTripId) {
            const activeTrip = await prisma.rigTrip.findUnique({ where: { id: rigRecord.activeTripId }, select: { campgroundId: true, status: true } });
            if (activeTrip?.campgroundId === campgroundId && activeTrip?.status === 'ACTIVE') return; // already in session here

            // Different campground — complete the old session
            if (activeTrip?.status === 'ACTIVE') {
              await prisma.rigTrip.update({ where: { id: rigRecord.activeTripId }, data: { status: 'COMPLETED', endDate: new Date() } });
            }
          }

          // Create new Camp Session
          const cgName = checkIn.campground?.name || 'Camp';
          const session = await prisma.rigTrip.create({
            data: {
              rigId: rig.id,
              campgroundId,
              sessionType: 'CAMP',
              tripType: 'CAMPING',
              visibility: 'SHARED',
              locationPrecision: 'AREA',
              name: cgName,
              startDate: checkIn.checkInDate,
              status: 'ACTIVE',
              coverImageUrl: checkIn.campground?.imageUrl || null,
              statesVisited: checkIn.campground?.state ? [checkIn.campground.state] : [],
              campgroundCount: 1,
            },
          });
          await prisma.rig.update({ where: { id: rig.id }, data: { activeTripId: session.id } });

          // Link the check-in to the session
          await prisma.checkIn.update({ where: { id: checkIn.id }, data: { tripId: session.id } }).catch(() => {});
        } catch (e: any) { console.error('[CheckIn] Camp Session creation error:', e.message); }
      });
    }

    // Award campground first stay badge — only on first ever campground check-in
    if (campgroundId) {
      const slug = 'campground-first-stay';
      const badge = await prisma.badge.findUnique({ where: { slug } }).catch(() => null);
      if (badge) {
        const alreadyHas = await prisma.userBadge.findUnique({
          where: { userId_badgeId: { userId, badgeId: badge.id } }
        }).catch(() => null);
        if (!alreadyHas) {
          await prisma.userBadge.create({ data: { userId, badgeId: badge.id } }).catch(() => null);
          await prisma.notification.create({
            data: {
              userId,
              type: 'BADGE_EARNED',
              content: `🏕️ You earned the "First Campground Stay" badge!`,
              link: '/profile',
            }
          }).catch(() => null);
        }
      }
    }

    // Award first night badge for host check-ins
    if (harvestHostId) {
      const host = await (prisma as any).harvestHost.findUnique({ where: { id: harvestHostId }, select: { hostType: true } });
      const slugs = ['first-night-host'];
      if (host?.hostType === 'BREWERY') slugs.push('brew-hopper');
      if (host?.hostType === 'WINERY') slugs.push('vineyard-voyager');
      for (const slug of slugs) {
        const badge = await prisma.badge.findUnique({ where: { slug } }).catch(() => null);
        if (badge) {
          await prisma.userBadge.upsert({
            where: { userId_badgeId: { userId, badgeId: badge.id } },
            create: { userId, badgeId: badge.id },
            update: {}
          }).catch(() => null);
        }
      }
    }

    // Log check-in activity to feed (idempotent — won't create duplicates)
    if (campgroundId && checkIn.campground) {
      logCheckIn(userId, checkIn.campground.id, (checkIn.campground as any).name).catch(() => {});
    }

    // Auto-create an Event from this check-in
    try {
      if (campgroundId && checkIn.campground) {
        const cg = checkIn.campground as any;
        const eventLocation = [cg.city, cg.state].filter(Boolean).join(', ') || cg.location || cg.name;
        const descParts: string[] = [];
        if (siteNumber) descParts.push(`Site: ${siteNumber}`);
        if (notes)      descParts.push(notes);
        const eventBanner = cg.bannerImage || cg.imageUrl || null;
        const eventEnd    = checkOutDate || checkInDate;
        const eventData: any = {
          title:       `Staying at ${cg.name}`,
          description: descParts.join('\n') || null,
          startDate:   checkInDate,
          endDate:     eventEnd,
          location:    eventLocation,
          organizerId: userId,
        };
        if (eventBanner)  eventData.bannerImage = eventBanner;
        if (campgroundId) eventData.campgroundId = campgroundId;
        await prisma.event.create({ data: eventData }).catch((err: any) => {
          if (err.message?.includes('campgroundId')) {
            delete eventData.campgroundId;
            return prisma.event.create({ data: eventData });
          }
          throw err;
        });
      }
    } catch (eventErr: any) {
    }

    // Emit to organizer pulse feed
    if (campgroundId) {
      emitOrganizerActivity(campgroundId, {
        type: 'CHECKIN',
        title: `${checkIn.user.firstName} ${checkIn.user.lastName || ''} checked in`,
        subtitle: siteNumber ? `Site ${siteNumber}` : undefined,
        userId: checkIn.user.id,
        userName: checkIn.user.firstName,
        userAvatar: checkIn.user.profilePicture || undefined,
        actionLabel: 'Welcome',
        actionType: 'SEND_WELCOME',
        actionPayload: { userId: checkIn.user.id, userName: checkIn.user.firstName },
      });
    }

    // Emit presence:arrived for any live events at this campground
    if (campgroundId) {
      try {
        const now = new Date();
        const liveEvents = await prisma.event.findMany({
          where: { campgroundId, startDate: { lte: now }, endDate: { gte: now } },
          select: { id: true },
        });
        for (const evt of liveEvents) {
          const isAttendee = await prisma.eventAttendee.findFirst({
            where: { eventId: evt.id, userId },
          });
          if (isAttendee) {
            getIO().of('/events').to(evt.id).emit('presence:arrived', {
              userId,
              eventId: evt.id,
              user: checkIn.user,
            });
          }
        }
      } catch {}
    }

    res.json(checkIn);

    // Create check-in invites for friends (non-blocking)
    const { inviteeIds } = req.body;
    if (Array.isArray(inviteeIds) && inviteeIds.length > 0) {
      setImmediate(async () => {
        try {
          const expiresAt = new Date(Date.now() + 120 * 60 * 1000); // 120 minutes
          const inviter = await prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true, profilePicture: true },
          });
          const inviterName = `${inviter?.firstName || ''} ${inviter?.lastName || ''}`.trim();

          // Verify all invitees are accepted friends
          const friendships = await prisma.friendship.findMany({
            where: {
              status: 'ACCEPTED',
              OR: [
                { initiatorId: userId, receiverId: { in: inviteeIds } },
                { receiverId: userId, initiatorId: { in: inviteeIds } },
              ],
            },
            select: { initiatorId: true, receiverId: true },
          });
          const friendIdSet = new Set(friendships.map((f: any) =>
            f.initiatorId === userId ? f.receiverId : f.initiatorId
          ));

          const locationName = checkIn.campground?.name || 'a location';

          for (const inviteeId of inviteeIds) {
            if (!friendIdSet.has(inviteeId)) continue; // skip non-friends
            try {
              await prisma.checkInInvite.create({
                data: {
                  checkInId: checkIn.id,
                  inviterId: userId,
                  inviteeId,
                  campgroundId: campgroundId || null,
                  harvestHostId: harvestHostId || null,
                  overnightSpotId: overnightSpotId || null,
                  siteNumber: siteNumber || null,
                  notes: notes || null,
                  expiresAt,
                },
              });

              // Send notification
              await prisma.notification.create({
                data: {
                  userId: inviteeId,
                  type: 'CHECKIN_INVITE',
                  content: `${inviterName} wants to check you in at ${locationName}`,
                  link: campgroundId ? `/campgrounds/${campgroundId}` : '/dashboard',
                  actorId: userId,
                  actorName: inviterName,
                  actorAvatar: inviter?.profilePicture || null,
                  metadata: { checkInId: checkIn.id },
                },
              });

              // Web push
              sendWebPush(inviteeId, {
                title: 'Check-In Invite',
                body: `${inviterName} wants to check you in at ${locationName}`,
                icon: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png',
                url: campgroundId ? `/campgrounds/${campgroundId}` : '/dashboard',
              }).catch(() => {});
            } catch (inviteErr: any) {
              // Skip duplicates silently (unique constraint)
            }
          }
        } catch (e) {
          console.error('[CheckIn Invite] error:', e);
        }
      });
    }

    // Notify emergency contacts via SMS (non-blocking)
    setImmediate(async () => {
      try {
        const contacts = await prisma.emergencyContact.findMany({
          where: { userId, notifyOnCheckIn: true },
        });
        if (contacts.length === 0) return;
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
        const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
        const locationName = checkIn.campground?.name || 'a campground';
        const city = (checkIn.campground as any)?.city;
        const state = (checkIn.campground as any)?.state;
        const locationLine = [city, state].filter(Boolean).join(', ');
        const siteInfo = siteNumber ? `\nSite: ${siteNumber}` : '';
        const viewLink = campgroundId ? `\nView: https://rvunicorn.com/campgrounds/${campgroundId}` : '';
        for (const contact of contacts) {
          sendSMS({
            to: contact.phoneNumber,
            message: `📍 RVUnicorn Travel Update\n${name} just checked in at ${locationName}${locationLine ? ` in ${locationLine}` : ''}.${siteInfo}${viewLink}\n— Sent via RVUnicorn 🦄`,
          }).catch(e => console.error('[EmergencyContact SMS] error:', e));
        }
      } catch (e) {
        console.error('[EmergencyContact SMS] error:', e);
      }
    });

    // Refresh Campfire Chronicles bio in background
    setImmediate(() => checkAndRefreshBio(userId));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// PATCH /api/checkins/checkout-event — update linked event endDate on early checkout
router.patch('/checkout-event', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { campgroundId, endDate } = req.body;
    if (!campgroundId || !endDate) return res.json({ updated: false });

    const end = new Date(endDate);

    // Find the most recent event for this user at this campground
    const event = await prisma.event.findFirst({
      where: {
        organizerId: userId,
        campgroundId,
        title: { contains: 'Staying at' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (event) {
      await prisma.event.update({
        where: { id: event.id },
        data: { endDate: end },
      });
      return res.json({ updated: true, eventId: event.id });
    }
    res.json({ updated: false });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/checkins/active - Check out
router.delete('/active', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;

    // Find active check-in before deactivating (need campgroundId for market cleanup + SMS)
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: { userId, isActive: true },
      include: { campground: { select: { id: true, name: true } } },
    }) as any;

    await prisma.checkIn.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, checkOutDate: new Date() }
    });

    // Deactivate any Camp Market listings at this campground
    if (activeCheckIn?.campgroundId) {
      try {
        await prisma.campMarketListing.updateMany({
          where: { userId, campgroundId: activeCheckIn.campgroundId, isActive: true },
          data: { isActive: false },
        });
      } catch (e: any) { }

      // Emit presence:departed for any live events at this campground
      try {
        const now = new Date();
        const liveEvents = await prisma.event.findMany({
          where: { campgroundId: activeCheckIn.campgroundId, startDate: { lte: now }, endDate: { gte: now } },
          select: { id: true },
        });
        for (const evt of liveEvents) {
          getIO().of('/events').to(evt.id).emit('presence:departed', { userId, eventId: evt.id });
        }
      } catch {}
    }

    res.json({ success: true });

    // Complete Camp Session + roll up rig stats + mileage after checkout (non-blocking)
    setImmediate(async () => {
      try {
        const { resolveUserRigId } = require('../services/rigResolver');
        const rig = await resolveUserRigId(userId);
        if (rig) {
          // Complete active Camp Session
          const rigRecord = await prisma.rig.findUnique({ where: { id: rig.id }, select: { activeTripId: true } });
          if (rigRecord?.activeTripId) {
            const activeTrip = await prisma.rigTrip.findUnique({ where: { id: rigRecord.activeTripId }, select: { status: true, sessionType: true, startDate: true } });
            if (activeTrip?.status === 'ACTIVE' && activeTrip?.sessionType === 'CAMP') {
              const nights = activeTrip.startDate ? Math.max(1, Math.round((Date.now() - new Date(activeTrip.startDate).getTime()) / 86400000)) : 1;
              await prisma.rigTrip.update({ where: { id: rigRecord.activeTripId }, data: { status: 'COMPLETED', endDate: new Date(), totalNights: nights } });
              await prisma.rig.update({ where: { id: rig.id }, data: { activeTripId: null } });
            }
          }
          const { rollupRigStats } = require('../services/rigStatsRollup');
          await rollupRigStats(rig.id);
          const { rollupRigMileage } = require('../services/rigMileage');
          await rollupRigMileage(rig.id);
        }
      } catch (e: any) { console.error('[CheckOut] rig rollup error:', e.message); }
    });

    // Notify emergency contacts of checkout via SMS (non-blocking)
    if (activeCheckIn?.campground) {
      setImmediate(async () => {
        try {
          const contacts = await prisma.emergencyContact.findMany({
            where: { userId, notifyOnCheckOut: true },
          });
          if (contacts.length === 0) return;
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
          const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
          const locationName = activeCheckIn.campground?.name || 'their campground';
          for (const contact of contacts) {
            sendSMS({
              to: contact.phoneNumber,
              message: `📍 RVUnicorn Travel Update\n${name} checked out of ${locationName}.\n— Sent via RVUnicorn 🦄`,
            }).catch(e => console.error('[EmergencyContact SMS] checkout error:', e));
          }
        } catch (e) {
          console.error('[EmergencyContact SMS] checkout error:', e);
        }
      });
    }

    // Refresh Campfire Chronicles bio in background
    setImmediate(() => checkAndRefreshBio(userId));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/checkins/history - My recent check-ins (used by BasecampPage to
// match my places against friends' upcoming trips)
router.get('/history', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const checkins = await prisma.checkIn.findMany({
      where: { userId },
      orderBy: { checkInDate: 'desc' },
      take: limit,
      select: {
        id: true,
        campgroundId: true,
        checkInDate: true,
        checkOutDate: true,
        siteNumber: true,
        isActive: true,
        campground: { select: { id: true, name: true, state: true, location: true } },
      },
    });
    res.json(checkins);
  } catch (error: any) {
    console.error('Get checkin history error:', error);
    res.status(500).json({ error: 'Failed to fetch checkin history' });
  }
});

// GET /api/checkins/active - Get my active check-in
router.get('/active', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const checkIn = await prisma.checkIn.findFirst({
      where: { userId, isActive: true },
      include: {
        campground: { select: { id: true, name: true, imageUrl: true, latitude: true, longitude: true, state: true, location: true, campgroundMapUrl: true } },
      }
    });
    // Auto-create StateVisit if campground has a state (dedup: extend existing if same campground within 14 days)
    if (checkIn?.campground?.state) {
      const campState = checkIn.campground.state;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fourteenDaysAgo = new Date(today.getTime() - 14 * 86400000);

      // Check for existing visit at same state+campground in last 14 days
      const existing = await prisma.stateVisit.findFirst({
        where: {
          userId,
          state: campState,
          OR: [
            { campsiteId: checkIn.campground.id },
            { startDate: { gte: fourteenDaysAgo } },
          ],
        },
        orderBy: { startDate: 'desc' },
      }).catch(() => null);

      if (existing) {
        // Extend the existing visit's endDate to today
        await prisma.stateVisit.update({
          where: { id: existing.id },
          data: { endDate: today },
        }).catch(() => {});
      } else {
        await prisma.stateVisit.create({
          data: {
            userId,
            state: campState,
            startDate: today,
            campsiteId: checkIn.campground.id,
            notes: `Auto-created from check-in at ${checkIn.campground.name}`,
          },
        }).catch(() => {});
      }
    }

    // Side effects on active check-in retrieval (idempotent — no activity logging here)
    if (checkIn?.campground) {
      try {
        // Shared Fire — notify nearby friends (fire and forget)
        checkSharedFire(userId, checkIn.campground.id).catch(() => {});

        // Notify friends that user checked in (deduplicated — skip if same notification sent in last 6 hours)
        const friendships = await prisma.friendship.findMany({
          where: {
            status: 'ACCEPTED',
            OR: [{ initiatorId: userId }, { receiverId: userId }],
          },
          select: { initiatorId: true, receiverId: true },
        });

        const friendIds = friendships.map((f: any) =>
          f.initiatorId === userId ? f.receiverId : f.initiatorId
        );

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        });

        if (friendIds.length > 0 && user) {
          const checkinMsg = `${user.firstName} ${user.lastName} checked in at ${checkIn.campground!.name} 🏕️`;
          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

          // Filter out friends who already got this exact notification recently
          const recentDupes = await prisma.notification.findMany({
            where: {
              type: 'FRIEND_CHECKIN',
              content: checkinMsg,
              createdAt: { gte: sixHoursAgo },
              userId: { in: friendIds },
            },
            select: { userId: true },
          });
          const alreadyNotified = new Set(recentDupes.map((n: any) => n.userId));
          const newFriendIds = friendIds.filter((id: string) => !alreadyNotified.has(id));

          if (newFriendIds.length > 0) {
            await prisma.notification.createMany({
              data: newFriendIds.map((friendId: string) => ({
                userId: friendId,
                type: 'FRIEND_CHECKIN',
                content: checkinMsg,
                link: `/campgrounds/${checkIn.campground!.id}`,
              })),
            });
            // Push notifications to friends
            for (const friendId of newFriendIds.slice(0, 20)) {
              sendWebPush(friendId, { title: 'Friend Checked In 🏕️', body: checkinMsg, icon: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png', url: `/campgrounds/${checkIn.campground!.id}` }).catch(() => {});
            }
          }
        }
      } catch (activityErr) {
      }
    }

    // Check for new state unlocked
    let newStateUnlocked = null;
    let totalStates = 0;
    if (checkIn?.campground?.state) {
      try {
        const prevCheckins = await prisma.checkIn.findMany({
          where: { userId, id: { not: checkIn.id } },
          select: { campground: { select: { state: true } } },
        });
        const prevStates = new Set(prevCheckins.map((c: any) => c.campground?.state).filter(Boolean));
        totalStates = prevStates.size;
        if (!prevStates.has(checkIn.campground.state)) {
          newStateUnlocked = checkIn.campground.state;
          totalStates += 1;
        }
      } catch {}
    }

    res.json({ checkIn, newStateUnlocked, totalStates });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// GET /api/checkins/tonight/:campgroundId — Tonight at Camp data
router.get('/tonight/:campgroundId', async (req: any, res) => {
  try {
    const { campgroundId } = req.params;

    // How many RVers are currently checked in
    const rverCount = await prisma.checkIn.count({
      where: { campgroundId, isActive: true },
    });

    // Trivia schedule — next trivia at 5:30 PM Central
    const now = new Date();
    const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const hours = central.getHours();
    const mins = central.getMinutes();
    const totalMins = hours * 60 + mins;
    const triviaTime = 17 * 60 + 30;
    let triviaStatus = null;
    const diff = triviaTime - totalMins;
    if (diff > 0 && diff <= 60) triviaStatus = `In ${diff} min`;
    else if (diff <= 0 && diff > -60) triviaStatus = 'LIVE now';
    else if (diff > 60) triviaStatus = '5:30 PM Central';

    // Quiet hours — default 10 PM, override if campground has it set
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true },
    });

    res.json({
      campgroundName: campground?.name || '',
      rverCount,
      triviaStatus,
      quietHoursStart: '10:00 PM',
      quietHoursEnd: '8:00 AM',
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/checkins/herd/:type/:id - Get who's checked in at a location (RV Herd Here Now)
router.get('/herd/:type/:id', async (req: any, res) => {
  try {
    const { type, id } = req.params;
    const where: any = { isActive: true };
    if (type === 'campground') where.campgroundId = id;
    else if (type === 'host') where.harvestHostId = id;
    else if (type === 'spot') where.overnightSpotId = id;

    const checkIns = await prisma.checkIn.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } }
      },
      orderBy: { checkInDate: 'desc' },
      take: 20,
    });
    res.json(checkIns);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});



// GET /api/checkins/user/:userId/active - Get another user's active check-in (public)
router.get('/user/:userId/active', async (req: any, res) => {
  try {
    const checkIn = await prisma.checkIn.findFirst({
      where: { userId: req.params.userId, isActive: true },
      include: {
        campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true } },
        harvestHost: { select: { id: true, name: true, hostType: true, imageUrl: true } },
      }
    });
    res.json(checkIn);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/checkins/stargazing/toggle
router.post('/stargazing/toggle', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stargazingEnabled: true } });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { stargazingEnabled: !user?.stargazingEnabled },
      select: { stargazingEnabled: true },
    });
    res.json({ stargazingEnabled: updated.stargazingEnabled });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});


// GET /api/checkins/nearby-friends
router.get('/nearby-friends', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const friendships = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIds: string[] = friendships.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId);
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { householdId: true } });
    if (me?.householdId) {
      const hm = await prisma.user.findMany({ where: { householdId: me.householdId, id: { not: userId } }, select: { id: true } });
      hm.forEach((m: any) => { if (!friendIds.includes(m.id)) friendIds.push(m.id); });
    }
    if (friendIds.length === 0) return res.json([]);
    const checkins = await prisma.checkIn.findMany({
      where: { userId: { in: friendIds }, isActive: true },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        campground: { select: { id: true, name: true, state: true, latitude: true, longitude: true } },
      },
      orderBy: { checkInDate: 'desc' },
    });
    const myCI = await prisma.checkIn.findFirst({
      where: { userId, isActive: true },
      include: { campground: { select: { latitude: true, longitude: true, id: true } } },
    });
    const result = checkins.map((c: any) => {
      let distanceMiles = null;
      if (myCI?.campground?.latitude && myCI?.campground?.longitude && c.campground?.latitude && c.campground?.longitude) {
        const R = 3958.8;
        const lat1 = myCI.campground.latitude * Math.PI / 180;
        const lat2 = c.campground.latitude * Math.PI / 180;
        const dLat = (c.campground.latitude - myCI.campground.latitude) * Math.PI / 180;
        const dLon = (c.campground.longitude - myCI.campground.longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
        distanceMiles = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      }
      return { ...c, distanceMiles, sameCampground: !!(myCI?.campgroundId && myCI.campgroundId === c.campgroundId) };
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch nearby campers' });
  }
});

// GET /api/checkins/community-map — all active check-ins for the community map
router.get('/community-map', async (req: any, res) => {
  try {
    const checkIns = await prisma.checkIn.findMany({
      where: { isActive: true },
      select: {
        id: true,
        campground: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            state: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            username: true,
            profilePicture: true,
          },
        },
        checkInDate: true,
      },
      orderBy: { checkInDate: 'desc' },
      take: 200,
    });

    // Group by campground to avoid duplicate pins
    const campgroundMap = new Map<string, { campground: any; campers: any[] }>();
    for (const ci of checkIns) {
      if (!ci.campground?.latitude || !ci.campground?.longitude) continue;
      const key = ci.campground.id;
      if (!campgroundMap.has(key)) {
        campgroundMap.set(key, { campground: ci.campground, campers: [] });
      }
      campgroundMap.get(key)!.campers.push({
        id: ci.user.id,
        firstName: ci.user.firstName,
        username: ci.user.username,
        profilePicture: ci.user.profilePicture,
        checkInDate: ci.checkInDate,
      });
    }

    res.json({ pins: Array.from(campgroundMap.values()) });
  } catch (e: any) {
    console.error('[Checkins] Community map error:', e);
    res.status(500).json({ error: 'Failed to load community map' });
  }
});

// GET /api/checkins/invites/pending — Get my pending check-in invites
router.get('/invites/pending', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const invites = await prisma.checkInInvite.findMany({
      where: { inviteeId: userId, status: 'PENDING' },
      include: {
        inviter: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
        checkIn: {
          include: {
            campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invites);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/checkins/invites/:id/respond — Accept or decline a check-in invite
router.post('/invites/:id/respond', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'decline'

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "accept" or "decline"' });
    }

    const invite = await prisma.checkInInvite.findUnique({ where: { id } });
    if (!invite || invite.inviteeId !== userId) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invite already responded to' });
    }

    if (action === 'decline') {
      await prisma.checkInInvite.update({
        where: { id },
        data: { status: 'DECLINED', respondedAt: new Date() },
      });
      return res.json({ success: true, status: 'DECLINED' });
    }

    // Accept: check out existing, create new check-in
    await prisma.checkIn.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, checkOutDate: new Date() },
    });

    const newCheckIn = await prisma.checkIn.create({
      data: {
        userId,
        campgroundId: invite.campgroundId,
        harvestHostId: invite.harvestHostId,
        overnightSpotId: invite.overnightSpotId,
        siteNumber: invite.siteNumber,
        notes: invite.notes,
        checkInDate: new Date(),
        isActive: true,
      },
      include: {
        campground: { select: { id: true, name: true } },
      },
    });

    await prisma.checkInInvite.update({
      where: { id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });

    res.json({ success: true, status: 'ACCEPTED', checkIn: newCheckIn });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/checkins/invite-friends — Invite friends to your current active check-in
router.post('/invite-friends', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { inviteeIds } = req.body;

    if (!Array.isArray(inviteeIds) || inviteeIds.length === 0) {
      return res.status(400).json({ error: 'Must provide at least one friend to invite' });
    }

    const activeCheckIn = await prisma.checkIn.findFirst({
      where: { userId, isActive: true },
      include: {
        campground: { select: { id: true, name: true } },
      },
    });

    if (!activeCheckIn) {
      return res.status(400).json({ error: 'You are not currently checked in' });
    }

    const expiresAt = new Date(Date.now() + 120 * 60 * 1000);
    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, profilePicture: true },
    });
    const inviterName = `${inviter?.firstName || ''} ${inviter?.lastName || ''}`.trim();

    // Verify all invitees are accepted friends
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { initiatorId: userId, receiverId: { in: inviteeIds } },
          { receiverId: userId, initiatorId: { in: inviteeIds } },
        ],
      },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIdSet = new Set(friendships.map((f: any) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    ));

    const locationName = (activeCheckIn as any).campground?.name || 'a location';
    const campgroundId = activeCheckIn.campgroundId;
    let invited = 0;

    for (const inviteeId of inviteeIds) {
      if (!friendIdSet.has(inviteeId)) continue;
      try {
        await prisma.checkInInvite.create({
          data: {
            checkInId: activeCheckIn.id,
            inviterId: userId,
            inviteeId,
            campgroundId: activeCheckIn.campgroundId,
            harvestHostId: activeCheckIn.harvestHostId,
            overnightSpotId: activeCheckIn.overnightSpotId,
            siteNumber: activeCheckIn.siteNumber,
            notes: activeCheckIn.notes,
            expiresAt,
          },
        });

        await prisma.notification.create({
          data: {
            userId: inviteeId,
            type: 'CHECKIN_INVITE',
            content: `${inviterName} wants to check you in at ${locationName}`,
            link: campgroundId ? `/campgrounds/${campgroundId}` : '/dashboard',
            actorId: userId,
            actorName: inviterName,
            actorAvatar: inviter?.profilePicture || null,
            metadata: { checkInId: activeCheckIn.id },
          },
        });

        sendWebPush(inviteeId, {
          title: 'Check-In Invite',
          body: `${inviterName} wants to check you in at ${locationName}`,
          icon: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png',
          url: campgroundId ? `/campgrounds/${campgroundId}` : '/dashboard',
        }).catch(() => {});

        invited++;
      } catch {
        // Skip duplicates silently (unique constraint)
      }
    }

    res.json({ success: true, invited });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Confirm active stay — extends check-in date to suppress auto-checkout nudge
router.post('/confirm-stay', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const active = await prisma.checkIn.findFirst({
      where: { userId, isActive: true },
    });
    if (!active) return res.status(404).json({ error: 'No active check-in' });

    // Bump checkInDate to now so the 7-day nudge timer resets
    await prisma.checkIn.update({
      where: { id: active.id },
      data: { updatedAt: new Date() },
    });

    // Mark any existing nudge notifications as read
    await prisma.notification.updateMany({
      where: {
        userId,
        type: 'STALE_CHECKIN_NUDGE',
        read: false,
        metadata: { path: ['checkInId'], equals: active.id },
      },
      data: { read: true },
    });

    res.json({ confirmed: true });
  } catch (e: any) {
    console.error('[ConfirmStay]', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;

