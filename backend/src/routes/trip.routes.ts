import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { logEventCreated, logEventJoined } from '../services/activity.service';
import { logTripCreated } from '../services/activity.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logRsvpUpdated } from '../services/activity.service';
import { prisma } from '../lib/prisma';
import { triggerTipPromptsForTrip } from './campfire-tips.routes';
import { buildEventInviteEmail, inviteResend, INVITE_SITE_URL } from './invite.routes';
import { generateHitchTipsForEvent } from '../services/hitch-tips.service';
import { recordCampgroundVisit, fanOutVisitsToAttendees } from '../services/visit-stats.service';
import { autoInviteRigCopilots, userCanEditTrip } from '../utils/tripAccess';

const router = Router();
const db = prisma as any;

// Local alias — the canonical implementation lives in
// services/visit-stats.service.ts so every event creation path can
// use the same write helper. Kept under the old name to minimize the
// diff in this file.
const createStateVisitForUser = recordCampgroundVisit;

// GET /api/events - Get all events
router.get('/', async (req, res) => {
  try {
    const events = await req.query.userId
      ? await db.event.findMany({
          where: { organizerId: req.query.userId as string },
          include: {
            organizer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
            campground: {
              select: {
                id: true,
                name: true,
                location: true,
                state: true,
                latitude: true,
                longitude: true,
              },
            },
            _count: {
              select: {
                attendees: true,
                meals: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
        })
      : await db.event.findMany({
          include: {
            organizer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
            campground: {
              select: {
                id: true,
                name: true,
                location: true,
                state: true,
                latitude: true,
                longitude: true,
              },
            },
            _count: {
              select: {
                attendees: true,
                meals: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
        });

    res.json(events);
  } catch (error: any) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/my - Get events I'm involved in (organized or attending)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    // Get events where user is organizer OR actively attending
    const events = await db.event.findMany({
      where: {
        OR: [
          { organizerId: userId },
          {
            attendees: {
              some: {
                userId: userId,
                status: { in: ['going', 'GOING', 'maybe', 'MAYBE', 'ATTENDING', 'attending'] },
              },
            },
          },
        ],
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            householdId: true,
            rvYear: true,
            rvMake: true,
            rvModel: true,
            rvPhotoUrl: true,
            rvShowcase: { select: { photos: true } },
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            latitude: true,
            longitude: true,
            imageUrl: true,
          },
        },
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendees: true,
            meals: true,
          },
        },
        tripPlans: {
          // The user-specific TripPlan (if any) for this event — has the
          // distance and duration we display on the rig page card.
          where: { userId },
          select: { id: true, distanceMiles: true, actualMiles: true, durationMinutes: true },
          take: 1,
        },
        roadTrip: {
          select: {
            id: true,
            title: true,
            color: true,
            font: true,
            stops: {
              orderBy: [{ stopNumber: 'asc' }, { startDate: 'asc' }],
              select: {
                id: true,
                title: true,
                stopNumber: true,
                startDate: true,
                endDate: true,
                campground: { select: { id: true, name: true, city: true, state: true } },
              },
            },
            _count: { select: { stops: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Also get StateVisits (trips from Travel Map)
    const stateVisits = await db.stateVisit.findMany({
      where: { userId },
      include: {
        campsite: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Convert StateVisits to event-like format and merge
    const stateVisitEvents = stateVisits.map((sv: any) => ({
      id: sv.id,
      title: sv.campsite?.name || `Trip to ${sv.state}`,
      name: sv.campsite?.name || `Trip to ${sv.state}`,
      startDate: sv.startDate,
      endDate: sv.endDate,
      location: sv.campsite?.location || sv.state,
      isWishlist: false,
      isStateVisit: true,
      campground: sv.campsite,
      organizerId: userId,
    }));

    // Add myAttendee to each event so frontend can get siteNumber + attendeeId
    const eventsWithMyAttendee = events.map((event: any) => ({
      ...event,
      myAttendee: event.attendees.find((a: any) => a.userId === userId) || null,
    }));

    // Combine and sort by start date
    const allTrips = [...eventsWithMyAttendee, ...stateVisitEvents].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    res.json(allTrips);
  } catch (error: any) {
    console.error('Get my events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/upcoming - Get user's upcoming events (for countdown)
router.get('/upcoming', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();

    // Find future events where user is organizer OR an attendee with "going" status
    const upcomingEvents = await db.event.findMany({
      where: {
        startDate: { gte: now },
        isWishlist: false, // Exclude wishlist events
        OR: [
          { organizerId: userId },
          {
            attendees: {
              some: {
                userId: userId,
                status: 'going',
              },
            },
          },
        ],
      },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
          },
        },
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        _count: {
          select: { attendees: true },
        },
      },
      orderBy: { startDate: 'asc' },
      take: 5,
    });

    res.json(upcomingEvents);
  } catch (error: any) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// GET /api/events/:id - Get single event
router.get('/my-events', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const events = await db.event.findMany({
      where: {
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId, status: 'GOING' } } }
        ]
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        bannerImage: true,
        campground: { select: { id: true, name: true, imageUrl: true, location: true, state: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 20,
    });
    res.json(events);
  } catch (error: any) {
    console.error('Get my events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Discover — MUST be before /:id so Express doesn't match "discover" as an event ID
router.get('/discover', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { rvType: true, homeState: true, campingStyles: true, campingInterests: true },
    });

    const campgroundSelect = {
      id: true, name: true, location: true, state: true, city: true, imageUrl: true,
      googleRating: true, googleReviewCount: true, maxRvLength: true,
      isBigRigFriendly: true, isPetFriendly: true, hasFullHookups: true,
    };

    // 1. Campgrounds matching user profile
    const profileWhere: any = {};
    if (user?.rvType === 'CLASS_A' || user?.rvType === 'FIFTH_WHEEL') {
      profileWhere.isBigRigFriendly = true;
    }
    if (user?.homeState) {
      profileWhere.state = user.homeState;
    }

    const forYou = await db.campground.findMany({
      where: { ...profileWhere, imageUrl: { not: null } },
      select: campgroundSelect,
      orderBy: { googleRating: 'desc' },
      take: 8,
    });

    // 2. Popular campgrounds — most check-ins
    const popularCampgrounds = await db.checkIn.groupBy({
      by: ['campgroundId'],
      where: { campgroundId: { not: null } },
      _count: { campgroundId: true },
      orderBy: { _count: { campgroundId: 'desc' } },
      take: 8,
    });
    const popularIds = popularCampgrounds.map((c: any) => c.campgroundId).filter(Boolean) as string[];
    const popular = popularIds.length > 0 ? await db.campground.findMany({
      where: { id: { in: popularIds }, imageUrl: { not: null } },
      select: campgroundSelect,
    }) : [];

    // 3. Upcoming public events from other users (events people can join)
    const now = new Date();
    const upcomingEvents = await db.event.findMany({
      where: {
        privacy: 'PUBLIC',
        isWishlist: false,
        organizerId: { not: userId },
        startDate: { gte: now },
      },
      include: {
        organizer: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvType: true } },
        campground: { select: campgroundSelect },
        _count: { select: { attendees: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 10,
    });

    // 4. Past public trips from other users (inspiration)
    const pastTrips = await db.event.findMany({
      where: {
        privacy: 'PUBLIC',
        isWishlist: false,
        organizerId: { not: userId },
        startDate: { lt: now },
      },
      include: {
        organizer: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvType: true } },
        campground: { select: campgroundSelect },
        _count: { select: { attendees: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 12,
    });

    // 5. Random campgrounds for exploration
    const totalCampgrounds = await db.campground.count({ where: { imageUrl: { not: null } } });
    const randomSkip = Math.max(0, Math.floor(Math.random() * Math.max(0, totalCampgrounds - 6)));
    const randomCampgrounds = await db.campground.findMany({
      where: { imageUrl: { not: null } },
      select: campgroundSelect,
      skip: randomSkip,
      take: 6,
    });

    const campgroundToCard = (cg: any, section: string) => ({
      id: `discover-${section}-${cg.id}`,
      title: cg.name,
      location: [cg.city, cg.state].filter(Boolean).join(', ') || cg.location,
      campground: cg,
      campgroundId: cg.id,
      isDiscover: true,
      discoverSection: section,
      startDate: null,
      endDate: null,
      _count: { attendees: cg.googleReviewCount || 0 },
    });

    const results = [
      ...upcomingEvents.map((t: any) => ({ ...t, isDiscover: true, discoverSection: 'Upcoming Events' })),
      ...forYou.map((cg: any) => campgroundToCard(cg, 'For You')),
      ...pastTrips.map((t: any) => ({ ...t, isDiscover: true, discoverSection: 'Past Trips from the Community' })),
      ...popular.map((cg: any) => campgroundToCard(cg, 'Popular with RVers')),
      ...randomCampgrounds.map((cg: any) => campgroundToCard(cg, 'Explore')),
    ];

    res.json(results);
  } catch (error: any) {
    console.error('Discover events error:', error);
    res.status(500).json({ error: 'Failed to fetch discover content' });
  }
});

// POST /api/trips/admin/create-wi-trip — one-time: create Jellystone WI retrospective trip
router.post('/admin/create-wi-trip', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    if (userId !== 'cmlpeyk82005s3qause3sws7y' && userId !== 'cmm9kukta0006i88masvtz2tp') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const deannaId = 'cmm9kukta0006i88masvtz2tp';
    const willId = 'cmlpeyk82005s3qause3sws7y';

    // Check if already created
    const existing = await db.event.findFirst({
      where: { organizerId: deannaId, campgroundId: 'cmlp0wjpr0c5tnalscyuh7agw', startDate: new Date('2025-04-15') },
    });
    if (existing) return res.json({ message: 'Already exists', tripId: existing.id });

    const trip = await db.event.create({
      data: {
        organizerId: deannaId,
        title: 'Seasonal Stay at Jellystone Caledonia',
        description: 'Seasonal spot - great location, tons of fun!',
        startDate: new Date('2025-04-15'),
        endDate: new Date('2025-10-10'),
        location: 'Caledonia, WI',
        campgroundId: 'cmlp0wjpr0c5tnalscyuh7agw',
        privacy: 'PUBLIC',
        isWishlist: false,
        destinationType: 'CAMPGROUND',
      },
    });

    await db.eventAttendee.create({ data: { eventId: trip.id, userId: deannaId, status: 'ATTENDING' } }).catch(() => {});
    await db.eventAttendee.create({ data: { eventId: trip.id, userId: willId, status: 'ATTENDING' } }).catch(() => {});

    // Link state visit
    await db.stateVisit.updateMany({
      where: { id: 'cmm9lieq7001gi88mts73abrs' },
      data: { eventId: trip.id },
    });

    res.json({ created: true, tripId: trip.id });
  } catch (error: any) {
    console.error('Create WI trip error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trips/household-unconfirmed — trips from partner user hasn't confirmed
router.get('/household-unconfirmed', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const user = await db.user.findUnique({ where: { id: userId }, select: { householdId: true } });
    if (!user?.householdId) return res.json({ trips: [] });

    const partners = await db.user.findMany({
      where: { householdId: user.householdId, id: { not: userId } },
      select: { id: true, firstName: true },
    });
    if (partners.length === 0) return res.json({ trips: [] });

    const partnerIds = partners.map((p: any) => p.id);

    // Past trips from partner where this user has no attendee record
    const partnerTrips = await db.event.findMany({
      where: {
        organizerId: { in: partnerIds },
        isWishlist: false,
        endDate: { lt: new Date() },
        NOT: { attendees: { some: { userId } } },
      },
      select: {
        id: true, title: true, startDate: true, endDate: true, location: true,
        campground: { select: { name: true } },
        organizer: { select: { firstName: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 10,
    });

    res.json({ trips: partnerTrips, partnerName: partners[0]?.firstName });
  } catch (error: any) {
    console.error('Household unconfirmed error:', error);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// POST /api/trips/detect-site-location — AI-powered site detection on campsite map
router.post('/detect-site-location', authenticateToken, async (req: any, res) => {
  try {
    const { tripId, siteNumber, mapUrl } = req.body;
    if (!siteNumber || !mapUrl) return res.status(400).json({ error: 'siteNumber and mapUrl required' });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: mapUrl } },
          { type: 'text', text: `This is a campground/RV park map. Locate site number "${siteNumber}" on this map. Return ONLY a JSON object: { "found": boolean, "x": number (0-100, percentage from left edge), "y": number (0-100, percentage from top edge), "confidence": number (0-1), "notes": "brief description" }. If you cannot find the site, set found to false. Be precise with coordinates.` },
        ],
      }],
    });

    // Parse response
    const text = (response.content[0] as any).text || '';
    let result;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { found: false };
    } catch { result = { found: false, notes: 'Could not parse AI response' }; }

    // Save to trip if found with decent confidence
    if (tripId && result.found && result.confidence > 0.5) {
      await db.event.update({
        where: { id: tripId },
        data: { siteMapPinX: result.x, siteMapPinY: result.y, siteMapPinSetBy: 'AI' },
      }).catch(() => {});
    }

    res.json({
      found: result.found,
      x: result.x,
      y: result.y,
      confidence: result.confidence,
      notes: result.notes,
      message: result.found ? `Site ${siteNumber} located!` : `Could not find Site ${siteNumber} on this map`,
    });
  } catch (error: any) {
    console.error('Site detection error:', error);
    res.status(500).json({ error: 'Site detection failed' });
  }
});

// GET /api/trips/check-overlap — detect conflicting trips before creation
// Must be defined BEFORE /:id to avoid being caught by the param route
router.get('/check-overlap', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { startDate, endDate, campgroundId } = req.query;
    if (!startDate) return res.json({ hasConflict: false, conflictingTrips: [], householdDuplicate: null });

    const propStart = new Date(startDate as string);
    const propEnd = endDate ? new Date(endDate as string) : propStart;

    // Find the user's household members
    const user = await db.user.findUnique({ where: { id: userId }, select: { householdId: true } });
    const householdUserIds: string[] = [userId];
    if (user?.householdId) {
      const partners = await db.user.findMany({
        where: { householdId: user.householdId, id: { not: userId } },
        select: { id: true, firstName: true },
      });
      householdUserIds.push(...partners.map((p: any) => p.id));
    }

    // Find overlapping trips for user + household (as organizer or attendee)
    const attendeeEventIds = await db.eventAttendee.findMany({
      where: { userId: { in: householdUserIds }, status: { in: ['ATTENDING', 'GOING', 'going'] } },
      select: { eventId: true, userId: true },
    });
    const attendeeEventIdSet = new Set(attendeeEventIds.map((a: any) => a.eventId));

    const overlapping = await db.event.findMany({
      where: {
        isWishlist: false,
        startDate: { lte: propEnd },
        endDate: { gte: propStart },
        OR: [
          { organizerId: { in: householdUserIds } },
          { id: { in: [...attendeeEventIdSet] } },
        ],
      },
      select: {
        id: true, title: true, startDate: true, endDate: true, location: true,
        campgroundId: true, organizerId: true,
        organizer: { select: { id: true, firstName: true } },
      },
    });

    const conflictingTrips = overlapping.map((trip: any) => {
      const overlapStart = new Date(Math.max(propStart.getTime(), new Date(trip.startDate).getTime()));
      const overlapEnd = new Date(Math.min(propEnd.getTime(), new Date(trip.endDate).getTime()));
      const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const isHousehold = trip.organizerId !== userId;
      return {
        id: trip.id,
        title: trip.title,
        startDate: trip.startDate,
        endDate: trip.endDate,
        location: trip.location,
        overlapDays,
        isHousehold,
        organizerName: trip.organizer?.firstName || 'Your co-pilot',
        message: isHousehold
          ? `${trip.organizer?.firstName || 'Your co-pilot'} already has a trip: ${trip.title}`
          : `You already have a trip: ${trip.title}`,
      };
    }).filter((t: any) => t.overlapDays > 1); // Allow 1-day overlap (relocation day)

    // Check for household duplicate: same campground + similar dates
    let householdDuplicate = null;
    if (campgroundId && user?.householdId) {
      const partnerTrip = overlapping.find((t: any) =>
        t.organizerId !== userId && t.campgroundId === campgroundId
      );
      if (partnerTrip) {
        householdDuplicate = {
          id: partnerTrip.id,
          title: partnerTrip.title,
          startDate: partnerTrip.startDate,
          endDate: partnerTrip.endDate,
          organizerName: (partnerTrip as any).organizer?.firstName || 'Your co-pilot',
        };
      }
    }

    res.json({
      hasConflict: conflictingTrips.length > 0,
      conflictingTrips,
      householdDuplicate,
    });
  } catch (error: any) {
    console.error('Check overlap error:', error);
    res.status(500).json({ error: 'Failed to check overlap' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            householdId: true,
            rvYear: true,
            rvMake: true,
            rvModel: true,
            rvPhotoUrl: true,
            rvShowcase: { select: { photos: true } },
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            city: true,
            state: true,
            zipCode: true,
            latitude: true,
            longitude: true,
            phone: true,
            imageUrl: true,
            googleRating: true,
            hasElectricHookup: true,
            hasFullHookups: true,
            hasWaterHookup: true,
            campgroundMapUrl: true,
          },
        },
        attendees: {
          select: {
            id: true,
            userId: true,
            status: true,
            siteNumber: true,
            confirmationNumber: true,
            siteVisibility: true,
            notes: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
                rvType: true,
                rvMake: true,
                rvModel: true,
                rvYear: true,
                rvMpg: true,
                rvPhotoUrl: true,
                rvShowcase: { select: { photos: true } },
                householdId: true,
              },
            },
          },
        },
        meals: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { scheduledAt: 'asc' },
        },
        _count: {
          select: {
            attendees: true,
            meals: true,
          },
        },
        roadTrip: {
          select: {
            id: true,
            title: true,
            color: true,
            font: true,
            stops: {
              orderBy: [{ stopNumber: 'asc' }, { startDate: 'asc' }],
              select: {
                id: true,
                title: true,
                stopNumber: true,
                startDate: true,
                endDate: true,
                campground: { select: { id: true, name: true, city: true, state: true } },
              },
            },
            _count: { select: { stops: true } },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Log activity for friend feed (only for non-private events)
    res.json(event);
  } catch (error: any) {
    console.error('Get event error:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch event', detail: String(error?.message || error) });
  }
});

// POST /api/events - Create event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, startDate, endDate, location, campgroundId, privacy, bannerImage, destinationType, overnightSpotId } = req.body;

    // Auto-use campground image if no banner provided
    let resolvedBanner = bannerImage || null;
    if (!resolvedBanner && campgroundId) {
      const cg = await db.campground.findUnique({ where: { id: campgroundId }, select: { imageUrl: true } });
      resolvedBanner = cg?.imageUrl || null;
    }

    const event = await db.event.create({
      data: {
        organizerId: userId,
        title,
        description,
        bannerImage: resolvedBanner,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        campgroundId: destinationType === 'CAMPGROUND' ? (campgroundId || null) : null,
        overnightSpotId: destinationType === 'OVERNIGHT_SPOT' ? (overnightSpotId || null) : null,
        destinationType: destinationType || 'CAMPGROUND',
        privacy: privacy || 'PUBLIC',
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            householdId: true,
            rvYear: true,
            rvMake: true,
            rvModel: true,
            rvPhotoUrl: true,
            rvShowcase: { select: { photos: true } },
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
          },
        },
      },
    });

    // Auto-add organizer as HOST
    await db.eventAttendee.upsert({
      where: { eventId_userId: { eventId: event.id, userId } },
      create: { eventId: event.id, userId, status: 'ATTENDING', role: 'HOST' },
      update: { status: 'ATTENDING', role: 'HOST' },
    }).catch(() => {});

    // Auto-invite rig co-pilots and household partners as CO_HOST
    autoInviteRigCopilots(event.id, userId).catch(() => {});

    // Auto-handle household partner (legacy — kept for non-rig users)
    const organizer = await db.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });
    if (organizer?.householdId) {
      const partner = await db.user.findFirst({
        where: { householdId: organizer.householdId, id: { not: userId } },
        select: { id: true },
      });
      if (partner) {
        const isFuture = new Date(startDate) >= new Date();
        await db.eventAttendee.upsert({
          where: { eventId_userId: { eventId: event.id, userId: partner.id } },
          create: { eventId: event.id, userId: partner.id, status: isFuture ? 'ATTENDING' : 'PENDING' },
          update: {},
        }).catch(() => {});
        if (!isFuture) {
          await db.notification.create({
            data: {
              userId: partner.id,
              type: 'TRIP_INVITE',
              content: 'Your travel partner added a trip — are you going?',
              link: `/trips/${event.id}`,
              senderId: userId,
            },
          }).catch(() => {});
        }
      }
    }

    // Auto-create StateVisit for organizer + all attendees + household
    if (event.campground) {
      await fanOutVisitsToAttendees(event.id);
    }

    // Trigger Campfire Tip prompts for friends who visited this campground
    if (event.campgroundId && new Date(startDate) >= new Date()) {
      triggerTipPromptsForTrip(event.id, userId, event.campgroundId).catch(() => {});
    }

    // Generate Hitch's initial campfire tips for this trip (fire-and-forget).
    // Only for trips with a campground that haven't already started — past
    // trips don't need anticipatory tips.
    if (event.campgroundId && new Date(startDate) >= new Date()) {
      generateHitchTipsForEvent(event.id, 'INITIAL').catch(() => {});
    }

    // Log activity for friend feed (only for non-private events)
    if (event.privacy !== 'PRIVATE') {
      await logEventCreated(userId, event.id, event.title, event.campgroundId || undefined);

      // Auto-create completed check-in for past trips with a campground
      if (event.campgroundId && new Date(startDate) < new Date()) {
        const existing = await db.checkIn.findFirst({
          where: {
            userId,
            campgroundId: event.campgroundId,
            checkInDate: {
              gte: new Date(new Date(startDate).getTime() - 86400000),
              lte: new Date(new Date(startDate).getTime() + 86400000),
            },
          },
        });
        if (!existing) {
          await db.checkIn.create({
            data: {
              userId,
              campgroundId: event.campgroundId,
              checkInDate: new Date(startDate),
              checkOutDate: endDate ? new Date(endDate) : new Date(startDate),
              isActive: false,
              notes: 'Auto-created from past trip: ' + event.title,
            },
          });
        }
      }
    }


    // Send Hitch welcome message on first trip creation
    try {
      const tripCount = await db.event.count({ where: { organizerId: userId } });
      if (tripCount === 1) {
        const conversation = await db.hitchConversation.create({
          data: {
            userId,
            title: 'Welcome to Trip Planning!',
            summary: 'Hitch congratulated user on planning their first trip.',
          }
        });

        const hitchWelcome = [
          "🎉 Congrats on planning your first trip, " + (event.organizer?.firstName || 'fellow adventurer') + "! I'm Hitch, your RVUnicorn trail guide — and I'm pumped to help you make this one unforgettable.",
          "",
          "Here's everything you can do with your trip **" + event.title + "**:",
          "",
          "**📋 Trip Checklist** — Create tasks and assign them to trip members so nothing gets forgotten. Who's bringing the firewood? Who's on s'mores duty? Sorted.",
          "",
          "**👥 Invite Your Crew** — Add friends to your trip so everyone stays on the same page. They'll get notified and can RSVP right inside RVUnicorn.",
          "",
          "**🏕️ Link a Campground** — Connect your trip to a campground from our database so your crew knows exactly where you're headed and can explore reviews and photos.",
          "",
          "**📸 Trip Album** — Every trip gets its own photo album. Document the journey and share the memories with your RVUnicorn community.",
          "",
          "**🍽️ Meal Planning** — Plan your camp meals day by day. Add recipes, assign cooks, and show up to the campsite ready to eat well.",
          "",
          "**💬 Trip Comments** — Keep the conversation going with your crew right inside the trip. No more scattered group texts.",
          "",
          "**🗺️ Activities & Attractions** — Add must-see stops, hikes, and activities to your trip itinerary so everyone knows the plan.",
          "",
          "**📦 Packing Lists** — Build shared packing lists so your whole crew is packed and ready. No more 'I thought YOU brought the camp chairs.'",
          "",
          "Ready to build out your trip? Ask me anything — I can suggest campgrounds, help you plan a route, recommend gear, or just help you get excited for the road ahead. 🚐✨",
        ].join("\n");

        await db.hitchMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: hitchWelcome,
          }
        });
      }
    } catch (hitchErr) {
      console.error('Hitch welcome message error (non-fatal):', hitchErr);
    }

    res.json(event);
  } catch (error: any) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/events/:id - Update event

// PUT /api/trips/:id/my-site — save user's campsite details for this event
router.put('/:id/my-site', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user?.id || req.userId;
    const { id: eventId } = req.params;
    const { siteNumber, confirmationNumber, notes, siteVisibility } = req.body;

    // Upsert attendee record with site details
    const attendee = await db.eventAttendee.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: {
        eventId,
        userId,
        status: 'ATTENDING',
        siteNumber: siteNumber || null,
        confirmationNumber: confirmationNumber || null,
        notes: notes || null,
        siteVisibility: siteVisibility || 'PRIVATE',
      },
      update: {
        siteNumber: siteNumber || null,
        confirmationNumber: confirmationNumber || null,
        notes: notes || null,
        siteVisibility: siteVisibility || 'PRIVATE',
      },
    });
    res.json({ attendee, message: 'Campsite details saved' });
  } catch (e: any) {
    console.error('[Trip] my-site error:', e?.message);
    res.status(500).json({ error: 'Failed to save campsite details' });
  }
});



// PUT /api/trips/:id/my-site — save user's campsite details for this event
router.put('/:id/my-site', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).user?.id || req.userId;
    const { id: eventId } = req.params;
    const { siteNumber, confirmationNumber, notes, siteVisibility } = req.body;

    // Upsert attendee record with site details
    const attendee = await db.eventAttendee.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: {
        eventId,
        userId,
        status: 'ATTENDING',
        siteNumber: siteNumber || null,
        confirmationNumber: confirmationNumber || null,
        notes: notes || null,
        siteVisibility: siteVisibility || 'PRIVATE',
      },
      update: {
        siteNumber: siteNumber || null,
        confirmationNumber: confirmationNumber || null,
        notes: notes || null,
        siteVisibility: siteVisibility || 'PRIVATE',
      },
    });
    res.json({ attendee, message: 'Campsite details saved' });
  } catch (e: any) {
    console.error('[Trip] my-site error:', e?.message);
    res.status(500).json({ error: 'Failed to save campsite details' });
  }
});


router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { title, description, startDate, endDate, location, campgroundId, notifyAttendees, isWishlist, privacy, bannerImage, campsiteMapUrl, siteMapPinX, siteMapPinY, siteMapPinSetBy, siteMapPinConfirmed } = req.body;

    const event = await db.event.findUnique({
      where: { id },
      include: { attendees: true },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Allow organizer or household partner to edit
    let canEdit = event.organizerId === userId;
    if (!canEdit) {
      const organizer = await db.user.findUnique({ where: { id: event.organizerId }, select: { householdId: true } });
      const editor = await db.user.findUnique({ where: { id: userId }, select: { householdId: true } });
      if (organizer?.householdId && organizer.householdId === editor?.householdId) canEdit = true;
    }
    if (!canEdit) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    const updatedEvent = await db.event.update({
      where: { id },
      data: {
        title: title || undefined,
        description: description !== undefined ? description : undefined,
        bannerImage: bannerImage !== undefined ? bannerImage : undefined,
        startDate: startDate === null ? null : startDate ? new Date(startDate) : undefined,
        endDate: endDate === null ? null : endDate ? new Date(endDate) : undefined,
        location: location !== undefined ? location : undefined,
        campgroundId: campgroundId !== undefined ? campgroundId : undefined,
        isWishlist: isWishlist !== undefined ? isWishlist : undefined,
        privacy: privacy !== undefined ? privacy : undefined,
        campsiteMapUrl: campsiteMapUrl !== undefined ? campsiteMapUrl : undefined,
        siteMapPinX: siteMapPinX !== undefined ? siteMapPinX : undefined,
        siteMapPinY: siteMapPinY !== undefined ? siteMapPinY : undefined,
        siteMapPinSetBy: siteMapPinSetBy !== undefined ? siteMapPinSetBy : undefined,
        siteMapPinConfirmed: siteMapPinConfirmed !== undefined ? siteMapPinConfirmed : undefined,
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            householdId: true,
            rvYear: true,
            rvMake: true,
            rvModel: true,
            rvPhotoUrl: true,
            rvShowcase: { select: { photos: true } },
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
          },
        },
        attendees: true,
      },
    });

    // Handle privacy changes for activity feed
    if (privacy === 'PRIVATE') {
      // Delete activity records so it doesn't show in feeds
      await db.activity.deleteMany({
        where: { eventId: id }
      });
    } else if (privacy === 'PUBLIC' || privacy === 'FRIENDS') {
      // If changing to PUBLIC or FRIENDS, create activity if it doesn't exist
      const existingActivity = await db.activity.findFirst({
        where: { eventId: id, type: 'EVENT_CREATED' }
      });
      if (!existingActivity) {
        await db.activity.create({
          data: {
            userId,
            type: 'EVENT_CREATED',
            eventId: id,
            title: updatedEvent.title,
            isPublic: true,
            campgroundId: updatedEvent.campgroundId,
          }
        });
      }
    }

    // Update or create StateVisit for organizer + all attendees + household
    if (updatedEvent.campground) {
      await fanOutVisitsToAttendees(updatedEvent.id);
    }

    if (notifyAttendees) {
      const notificationData = updatedEvent.attendees
        .filter((a: any) => a.userId !== userId)
        .map((a: any) => ({
          userId: a.userId,
          type: "EVENT_UPDATED",
          content: updatedEvent.organizer.firstName + " updated the event " + updatedEvent.title,
          link: "/trips/" + updatedEvent.id,
        }));
      if (notificationData.length > 0) {
        await db.notification.createMany({ data: notificationData });
      }
    }

    res.json(updatedEvent);
  } catch (error: any) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/events/:id - Delete event
// PUT /api/events/:id/transfer-organizer — transfer event ownership
router.put('/:id/transfer-organizer', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { newOrganizerId } = req.body;

    if (!newOrganizerId) return res.status(400).json({ error: 'newOrganizerId is required' });

    const event = await db.event.findUnique({
      where: { id },
      include: { attendees: { select: { userId: true } } },
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.organizerId !== userId) return res.status(403).json({ error: 'Only the organizer can transfer ownership' });

    // New organizer must be an attendee
    const isAttendee = event.attendees.some((a: any) => a.userId === newOrganizerId);
    if (!isAttendee) return res.status(400).json({ error: 'New organizer must be an attendee of this event' });

    await db.event.update({
      where: { id },
      data: { organizerId: newOrganizerId },
    });

    // Notify new organizer
    await (prisma as any).notification.create({
      data: {
        userId: newOrganizerId,
        type: 'EVENT_ORGANIZER_TRANSFER',
        content: `You are now the organizer of "${event.title}"`,
        link: `/trips/${id}`,
      },
    }).catch(() => {});

    res.json({ message: 'Organizer transferred successfully' });
  } catch (error: any) {
    console.error('Transfer organizer error:', error);
    res.status(500).json({ error: 'Failed to transfer organizer' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        organizer: { select: {
          id: true, firstName: true, lastName: true, username: true,
          profilePicture: true, householdId: true,
          rvYear: true, rvMake: true, rvModel: true, rvPhotoUrl: true,
          rvShowcase: { select: { photos: true } },
        }},
        group: { select: { id: true, name: true } },
        attendees: { select: { userId: true } },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    // Notify attendees about event deletion (except organizer)
    const notificationData = event.attendees
      .filter((a: any) => a.userId !== userId)
      .map((a: any) => ({
        userId: a.userId,
        type: 'EVENT_DELETED',
        content: `${event.organizer.firstName} cancelled the event "${event.title}"${event.group ? ` in ${event.group.name}` : ''}`,
        link: event.group ? `/groups/${event.group.id}` : '/trips',
      }));

    if (notificationData.length > 0) {
      await db.notification.createMany({
        data: notificationData,
      });
    }

    // Delete all associated records before deleting event
    await db.stateVisit.deleteMany({ where: { eventId: id } });
    await db.eventActivity.deleteMany({ where: { eventId: id } });
    await db.eventMeal.deleteMany({ where: { eventId: id } });
    await db.eventAttendee.deleteMany({ where: { eventId: id } });
    await db.tripPlan.deleteMany({ where: { eventId: id } });

    await db.event.delete({
      where: { id }
    });

    res.json({ message: 'Event deleted' });
  } catch (error: any) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// POST /api/trips/:id/household-confirm — Household partner confirms they were on this trip
router.post('/:id/household-confirm', authenticateToken, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { confirmed } = req.body; // true = was on trip, false = wasn't

    const event = await db.event.findUnique({ where: { id }, select: { id: true, organizerId: true } });
    if (!event) return res.status(404).json({ error: 'Trip not found' });

    // Verify household relationship
    const user = await db.user.findUnique({ where: { id: userId }, select: { householdId: true } });
    const organizer = await db.user.findUnique({ where: { id: event.organizerId }, select: { householdId: true } });
    if (!user?.householdId || user.householdId !== organizer?.householdId) {
      return res.status(403).json({ error: 'Not in the same household' });
    }

    if (confirmed) {
      await db.eventAttendee.upsert({
        where: { eventId_userId: { eventId: id, userId } },
        create: { eventId: id, userId, status: 'ATTENDING' },
        update: { status: 'ATTENDING' },
      });
    } else {
      await db.eventAttendee.upsert({
        where: { eventId_userId: { eventId: id, userId } },
        create: { eventId: id, userId, status: 'NOT_GOING' },
        update: { status: 'NOT_GOING' },
      });
    }

    res.json({ confirmed, status: confirmed ? 'ATTENDING' : 'NOT_GOING' });
  } catch (error: any) {
    console.error('Household confirm error:', error);
    res.status(500).json({ error: 'Failed to confirm' });
  }
});

// GET /api/trips/household-unconfirmed — Get trips from household partner that user hasn't confirmed
// GET /api/events/:id/attendees - Get event attendees
router.get('/:id/attendees', async (req, res) => {
  try {
    const { id } = req.params;

    // Optional auth — extract userId from token if present, but don't block unauthenticated
    let requesterId: string | null = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-to-something-secure') as any;
        requesterId = decoded.userId || decoded.id || null;
      } catch { /* invalid/expired token — treat as unauthenticated */ }
    }

    const attendees = await db.eventAttendee.findMany({
      where: { eventId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            householdId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!requesterId) {
      // Unauthenticated — strip all campsite details
      const stripped = attendees.map((a: any) => ({
        ...a,
        siteNumber: null,
        notes: null,
        user: { ...a.user, householdId: undefined },
      }));
      return res.json(stripped);
    }

    // Get requester's accepted friend IDs (both directions)
    const friendships = await db.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ initiatorId: requesterId }, { receiverId: requesterId }],
      },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIds = new Set(
      friendships.map((f: any) => f.initiatorId === requesterId ? f.receiverId : f.initiatorId)
    );

    // Get requester's householdId
    const requester = await db.user.findUnique({
      where: { id: requesterId },
      select: { householdId: true },
    });
    const requesterHouseholdId = requester?.householdId ?? null;

    // Apply visibility rules per attendee
    const result = attendees.map((a: any) => {
      const attendeeUserId = a.userId;
      const attendeeHouseholdId = (a.user as any).householdId ?? null;
      const visibility = a.siteVisibility || 'PRIVATE';

      let canSeeCampsite = false;

      if (attendeeUserId === requesterId) {
        // Always see your own
        canSeeCampsite = true;
      } else if (visibility === 'EVENT') {
        // Any event attendee can see
        canSeeCampsite = true;
      } else if (visibility === 'FRIENDS') {
        // Friends or same household
        const sameHousehold =
          requesterHouseholdId &&
          attendeeHouseholdId &&
          requesterHouseholdId === attendeeHouseholdId;
        canSeeCampsite = friendIds.has(attendeeUserId) || !!sameHousehold;
      }
      // PRIVATE: only self (handled above)

      const { householdId: _hid, ...userWithoutHousehold } = a.user as any;

      return {
        ...a,
        user: userWithoutHousehold,
        siteNumber: canSeeCampsite ? a.siteNumber : null,
        notes: canSeeCampsite ? a.notes : null,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Get attendees error:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// POST /api/events/:id/attendees - Add attendee(s) to event
//
// Permission: event organizer OR anyone who's already on the trip
// (any EventAttendee row, regardless of RSVP status). The previous
// organizer-only gate broke real-world camping where attendees need
// to bring along friends without bothering the trip creator.
router.post('/:id/attendees', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds array is required' });
    }

    const event = await db.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== userId) {
      const myAttendance = await db.eventAttendee.findUnique({
        where: { eventId_userId: { eventId: id, userId } },
        select: { id: true },
      });
      if (!myAttendance) {
        return res.status(403).json({ error: 'You need to be on this trip to invite others' });
      }
    }

    const attendees = [];
    for (const invitedUserId of userIds) {
      const existing = await db.eventAttendee.findUnique({
        where: {
          eventId_userId: {
            eventId: id,
            userId: invitedUserId,
          },
        },
      });

      if (!existing) {
        const isPastTrip = event.endDate ? new Date(event.endDate) < new Date() : new Date(event.startDate) < new Date();
        const attendeeStatus = isPastTrip ? 'going' : 'invited';

        const attendee = await db.eventAttendee.create({
          data: {
            eventId: id,
            userId: invitedUserId,
            status: attendeeStatus,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                profilePicture: true,
              },
            },
          },
        });
        attendees.push(attendee);

        // Create StateVisit for the new attendee so their map reflects this trip
        fanOutVisitsToAttendees(id).catch(() => {});

        // Look up the inviter so the notification can name them
        const inviter = await db.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        });
        const inviterName = inviter
          ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || 'Someone'
          : 'Someone';

        await db.notification.create({
          data: {
            userId: invitedUserId,
            type: 'EVENT_INVITE',
            // category: 'EVENT' so it lands in the new Trips tab in the bell
            category: 'EVENT',
            content: isPastTrip
              ? `${inviterName} tagged you in "${event.title}"`
              : `${inviterName} invited you to "${event.title}"`,
            // /trips/:id is the actual frontend route — /events/:id 404s
            link: `/trips/${id}`,
            actorId: userId,
            actorName: inviterName,
            read: false,
          },
        });
      }
    }

    res.json(attendees);
  } catch (error: any) {
    console.error('Add attendees error:', error);
    res.status(500).json({ error: 'Failed to add attendees' });
  }
});

// PUT /api/events/:id/attendees/:attendeeId - Update attendee status
router.put('/:id/attendees/:attendeeId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id, attendeeId } = req.params;
    const { status, siteNumber } = req.body;

    const attendee = await db.eventAttendee.findUnique({
      where: { id: attendeeId },
    });

    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    if (attendee.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (siteNumber !== undefined) updateData.siteNumber = siteNumber;

    const updated = await db.eventAttendee.update({
      where: { id: attendeeId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
          },
        },
      },
    });

    // If status is "going", auto-create StateVisit for this attendee
    if (status === 'going') {
      const event = await db.event.findUnique({
        where: { id },
        include: {
          campground: {
            select: {
              id: true,
              name: true,
              state: true,
            },
          },
        },
      });

      if (event?.campground) {
        await createStateVisitForUser(userId, event, event.campground);
      }
    }

    // If status changed FROM "going" to something else, optionally remove StateVisit
    if (status !== 'going' && attendee.status === 'going') {
      await db.stateVisit.deleteMany({
        where: {
          userId,
          eventId: id,
        },
      });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Update attendee error:', error);
    res.status(500).json({ error: 'Failed to update attendee' });
  }
});

// DELETE /api/events/:id/attendees/:attendeeId - Remove attendee
router.delete('/:id/attendees/:attendeeId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id, attendeeId } = req.params;

    const event = await db.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const attendee = await db.eventAttendee.findUnique({
      where: { id: attendeeId },
    });

    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    if (event.organizerId !== userId && attendee.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Remove their StateVisit for this event
    await db.stateVisit.deleteMany({
      where: {
        userId: attendee.userId,
        eventId: id,
      },
    });

    await db.eventAttendee.delete({
      where: { id: attendeeId },
    });

    res.json({ message: 'Attendee removed' });
  } catch (error: any) {
    console.error('Remove attendee error:', error);
    res.status(500).json({ error: 'Failed to remove attendee' });
  }
});

// POST /api/events/:id/meals - Add meal to event
router.post('/:id/meals', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { recipeId, mealType, scheduledAt, notes } = req.body;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        attendees: {
          where: { userId, status: { in: ["GOING", "going"] } }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const isOrganizer = event.organizerId === userId;
    const isGoingAttendee = event.attendees && event.attendees.length > 0;

    if (!isOrganizer && !isGoingAttendee) {
      return res.status(403).json({ error: 'Only the organizer or attending members can add meals' });
    }

    const meal = await db.eventMeal.create({
      data: {
        eventId: id,
        recipeId: recipeId || null,
        mealType,
        scheduledAt: new Date(scheduledAt),
        notes,
      },
      include: {
        recipe: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
          },
        },
      },
    });

    res.json(meal);
  } catch (error: any) {
    console.error('Add meal error:', error);
    res.status(500).json({ error: 'Failed to add meal' });
  }
});

// DELETE /api/events/:id/meals/:mealId - Remove meal from event
router.delete('/:id/meals/:mealId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id, mealId } = req.params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        attendees: {
          where: { userId, status: { in: ["GOING", "going"] } }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const isOrganizer = event.organizerId === userId;
    const isGoingAttendee = event.attendees && event.attendees.length > 0;

    if (!isOrganizer && !isGoingAttendee) {
      return res.status(403).json({ error: 'Only the organizer or attending members can remove meals' });
    }

    await db.eventMeal.delete({
      where: { id: mealId },
    });

    res.json({ message: 'Meal removed' });
  } catch (error: any) {
    console.error('Remove meal error:', error);
    res.status(500).json({ error: 'Failed to remove meal' });
  }
});

// POST /api/events/:id/copy - Copy an event to your own events
router.post('/:id/copy', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { startDate, endDate, isWishlist, copyMealPlan } = req.body;

    // Get the original event
    const originalEvent = await db.event.findUnique({
      where: { id },
      include: {
        campground: true,
        meals: copyMealPlan ? {
          include: {
            recipe: true,
          }
        } : false,
      },
    });

    if (!originalEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Determine dates
    let eventStartDate: Date;
    let eventEndDate: Date;

    if (isWishlist) {
      // For wishlist, use a far future placeholder date
      eventStartDate = new Date('2099-01-01');
      eventEndDate = new Date('2099-01-01');
    } else {
      if (!startDate) {
        return res.status(400).json({ error: 'Start date is required for non-wishlist events' });
      }
      eventStartDate = new Date(startDate);
      eventEndDate = endDate ? new Date(endDate) : eventStartDate;
    }

    // Create the copied event
    const copiedEvent = await db.event.create({
      data: {
        title: originalEvent.title,
        description: originalEvent.description,
        location: originalEvent.location,
        campgroundId: originalEvent.campgroundId,
        organizerId: userId,
        startDate: eventStartDate,
        endDate: eventEndDate,
        isWishlist: isWishlist || false,
      },
    });

    // Copy meals if requested
    if (copyMealPlan && originalEvent.meals && originalEvent.meals.length > 0) {
      for (const meal of originalEvent.meals) {
        await db.eventMeal.create({
          data: {
            eventId: copiedEvent.id,
            mealType: meal.mealType,
            scheduledAt: meal.scheduledAt,
            recipeId: meal.recipeId,
            notes: meal.notes,
          },
        });
      }
    }

    // Add organizer as attendee
    await db.eventAttendee.create({
      data: {
        eventId: copiedEvent.id,
        userId: userId,
        status: 'going',
      },
    });

    res.json(copiedEvent);
  } catch (error: any) {
    console.error('Copy event error:', error);
    res.status(500).json({ error: 'Failed to copy event' });
  }
});


// Discover public events from everyone
// Get events from friends (PUBLIC or FRIENDS privacy)
router.get('/friends-events', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get friend IDs
    const friendships = await db.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { initiatorId: userId },
          { receiverId: userId },
        ],
      },
      select: {
        initiatorId: true,
        receiverId: true,
      },
    });

    const friendIds = friendships.map((f: any) => 
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    if (friendIds.length === 0) {
      return res.json([]);
    }

    const events = await db.event.findMany({
      where: {
        organizerId: { in: friendIds },
        isWishlist: false,
        privacy: { in: ['PUBLIC', 'FRIENDS'] },
        startDate: {
          gte: today,
        },
      },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            householdId: true,
            rvYear: true,
            rvMake: true,
            rvModel: true,
            rvPhotoUrl: true,
            rvShowcase: { select: { photos: true } },
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            imageUrl: true,
          },
        },
        _count: {
          select: {
            attendees: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
      take: 50,
    });

    res.json(events);
  } catch (error: any) {
    console.error('Friends events error:', error);
    res.status(500).json({ error: 'Failed to fetch friends events' });
  }
});

// GET /api/trips/my-events - Get user's events for linking


// GET /api/events/:id/albums - Get albums linked to a trip
router.get('/:id/albums', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const albums = await db.photoAlbum.findMany({
      where: { eventId: id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        photos: { take: 4, orderBy: { createdAt: 'desc' } },
        _count: { select: { photos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(albums);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// POST /api/events/:id/albums - Create a new album linked to this trip
router.post('/:id/albums', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { title, description, privacy } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    const event = await db.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const album = await db.photoAlbum.create({
      data: { userId, eventId: id, title, description, privacy: privacy || 'PUBLIC' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        _count: { select: { photos: true } },
      },
    });
    res.status(201).json(album);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// POST /api/events/:id/albums/link - Link an existing album to this trip
router.post('/:id/albums/link', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { albumId } = req.body;

    const album = await db.photoAlbum.findUnique({ where: { id: albumId } });
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.userId !== userId) return res.status(403).json({ error: 'Not your album' });

    const updated = await db.photoAlbum.update({
      where: { id: albumId },
      data: { eventId: id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        _count: { select: { photos: true } },
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to link album' });
  }
});

// DELETE /api/events/:id/albums/:albumId/unlink - Unlink album from trip
router.delete('/:id/albums/:albumId/unlink', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { albumId } = req.params;

    const album = await db.photoAlbum.findUnique({ where: { id: albumId } });
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.userId !== userId) return res.status(403).json({ error: 'Not your album' });

    await db.photoAlbum.update({ where: { id: albumId }, data: { eventId: null } });
    res.json({ message: 'Album unlinked' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to unlink album' });
  }
});

// GET /api/trips/active-route/:userId - Get active trip route for profile map
router.get('/active-route/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

    const activeEvent = await db.event.findFirst({
      where: {
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId } } },
        ],
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      include: {
        tripPlans: {
          include: {
            pitStops: { orderBy: { orderIndex: 'asc' } },
          },
        },
        campground: { select: { name: true, state: true, latitude: true, longitude: true } },
      },
    });

    if (!activeEvent) return res.json({ route: null });

    const allStops: any[] = [];

    for (const plan of (activeEvent as any).tripPlans) {
      if (plan.startLatitude && plan.startLongitude) {
        allStops.push({ id: 'start-' + plan.id, name: plan.startLocation || 'Start', latitude: plan.startLatitude, longitude: plan.startLongitude, order: 0 });
      }
      for (const stop of plan.pitStops) {
        if (stop.latitude && stop.longitude) {
          allStops.push({ id: stop.id, name: stop.name, latitude: stop.latitude, longitude: stop.longitude, order: stop.orderIndex + 1 });
        }
      }
      if (plan.endLatitude && plan.endLongitude) {
        allStops.push({ id: 'end-' + plan.id, name: plan.endLocation || 'Destination', latitude: plan.endLatitude, longitude: plan.endLongitude, order: 999 });
      }
    }

    // Fallback to campground
    if (allStops.length === 0 && (activeEvent as any).campground?.latitude) {
      const cg = (activeEvent as any).campground;
      allStops.push({ id: 'cg', name: cg.name, latitude: cg.latitude, longitude: cg.longitude, order: 999 });
    }

    allStops.sort((a, b) => a.order - b.order);

    if (allStops.length === 0) return res.json({ route: null });

    const totalDays = Math.max(1, Math.ceil((activeEvent.endDate.getTime() - activeEvent.startDate.getTime()) / 86400000));
    const dayNumber = Math.floor((todayEnd.getTime() - activeEvent.startDate.getTime()) / 86400000) + 1;
    const progress = Math.min(Math.max(dayNumber / totalDays, 0), 1);
    const currentIdx = Math.min(Math.floor(progress * (allStops.length - 1)), allStops.length - 1);
    const currentPosition = allStops[currentIdx];
    const completedCoords = allStops.slice(0, currentIdx + 1).map(s => [s.longitude, s.latitude] as [number, number]);
    const upcomingCoords = allStops.slice(currentIdx).map(s => [s.longitude, s.latitude] as [number, number]);

    res.json({
      route: {
        eventId: activeEvent.id,
        eventName: activeEvent.title,
        startDate: activeEvent.startDate,
        endDate: activeEvent.endDate,
        dayNumber, totalDays, allStops,
        completedCoords,
        upcomingCoords,
        currentPosition: { latitude: currentPosition.latitude, longitude: currentPosition.longitude, name: currentPosition.name },
      }
    });
  } catch (e: any) {
    console.error('active-route error:', e?.message, e?.stack);
    res.status(500).json({ error: e?.message || 'Failed' });
  }
});


// POST /api/events/:id/duplicate - Duplicate a trip
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { copyAttendees = false } = req.body;

    const source = await db.event.findUnique({
      where: { id },
      include: {
        tripPackItems: true,
        supplyItems: true,
        attendees: { where: { status: { in: ['ATTENDING', 'going'] } } },
      },
    });

    if (!source) return res.status(404).json({ error: 'Trip not found' });
    if (source.organizerId !== userId) return res.status(403).json({ error: 'Only the organizer can duplicate this trip' });

    // Create new event — clear dates, keep everything else
    const newEvent = await db.event.create({
      data: {
        title: source.title + ' (Copy)',
        description: source.description,
        location: source.location,
        campgroundId: source.campgroundId,
        organizerId: userId,
        startDate: source.startDate,
        endDate: source.endDate,
        privacy: source.privacy,
        tags: source.tags,
        destinationType: source.destinationType,
        bannerImage: source.bannerImage,
      },
    });

    // Always add organizer as attendee
    await db.eventAttendee.create({
      data: { eventId: newEvent.id, userId, status: 'ATTENDING' },
    });

    // Optionally copy attendees
    if (copyAttendees && source.attendees.length > 0) {
      const otherAttendees = source.attendees.filter((a: any) => a.userId !== userId);
      if (otherAttendees.length > 0) {
        await db.eventAttendee.createMany({
          data: otherAttendees.map((a: any) => ({
            eventId: newEvent.id,
            userId: a.userId,
            status: 'PENDING',
          })),
          skipDuplicates: true,
        });
      }
    }

    // Copy pack list items
    if (source.tripPackItems.length > 0) {
      await db.tripPackItem.createMany({
        data: source.tripPackItems.map((item: any) => ({
          eventId: newEvent.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          isRequired: item.isRequired,
          addedById: userId,
        })),
      });
    }

    // Copy supply items
    if (source.supplyItems.length > 0) {
      await (prisma as any).supplyItem.createMany({
        data: source.supplyItems.map((item: any) => ({
          eventId: newEvent.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          addedById: userId,
        })),
      });
    }

    res.json({ event: newEvent, message: 'Trip duplicated successfully' });
  } catch (error: any) {
    console.error('Duplicate trip error:', error);
    res.status(500).json({ error: 'Failed to duplicate trip' });
  }
});

// ── Presence System ─────────────────────────────────────────────

// PATCH /api/events/:id/rsvp-presence — update presence fields
router.patch('/:id/rsvp-presence', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { siteNumber, loopArea, siteVisibility, isOpenToVisitors, campfireActive, digitalFlag, hasDogs } = req.body;
    if (digitalFlag && digitalFlag.length > 60) return res.status(400).json({ error: 'Digital flag max 60 chars' });

    const attendee = await db.eventAttendee.update({
      where: { eventId_userId: { eventId: req.params.id, userId } },
      data: {
        siteNumber: siteNumber !== undefined ? siteNumber : undefined,
        loopArea: loopArea !== undefined ? loopArea : undefined,
        siteVisibility: siteVisibility || undefined,
        isOpenToVisitors: isOpenToVisitors !== undefined ? isOpenToVisitors : undefined,
        campfireActive: campfireActive !== undefined ? campfireActive : undefined,
        digitalFlag: digitalFlag !== undefined ? digitalFlag : undefined,
        hasDogs: hasDogs !== undefined ? hasDogs : undefined,
        presenceUpdatedAt: new Date(),
      },
    });
    res.json({ attendee });
  } catch {
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

// PATCH /api/events/:id/arrival-status — update arrival status + notifications
router.patch('/:id/arrival-status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { status } = req.body;
    if (!['NOT_ARRIVED', 'CHECKED_IN', 'CAMPFIRE_ACTIVE'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const attendee = await db.eventAttendee.update({
      where: { eventId_userId: { eventId: req.params.id, userId } },
      data: {
        arrivalStatus: status,
        campfireActive: status === 'CAMPFIRE_ACTIVE',
        presenceUpdatedAt: new Date(),
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    // Notify friends at this event
    if (status === 'CHECKED_IN' || status === 'CAMPFIRE_ACTIVE') {
      try {
        const friendships = await db.friendship.findMany({
          where: { OR: [{ initiatorId: userId }, { receiverId: userId }], status: 'accepted' },
          select: { initiatorId: true, receiverId: true },
        });
        const friendIds = new Set(friendships.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId));

        const others = await db.eventAttendee.findMany({
          where: { eventId: req.params.id, userId: { not: userId }, arrivalStatus: { in: ['CHECKED_IN', 'CAMPFIRE_ACTIVE'] } },
          select: { userId: true },
        });

        const toNotify = others.filter((o: any) => friendIds.has(o.userId)).slice(0, 10);
        const siteInfo = attendee.siteNumber ? ` — Site ${attendee.siteNumber}` : '';
        const loopInfo = attendee.loopArea ? `, ${attendee.loopArea}` : '';
        const flagInfo = attendee.digitalFlag ? ` "${attendee.digitalFlag}"` : '';

        const notifType = status === 'CAMPFIRE_ACTIVE' ? 'CAMPFIRE_STARTED' : 'CAMPGROUND_ARRIVAL';
        const title = status === 'CAMPFIRE_ACTIVE'
          ? `${attendee.user.firstName} started a campfire 🔥`
          : `${attendee.user.firstName} just arrived!`;
        const body = status === 'CAMPFIRE_ACTIVE'
          ? `${attendee.user.firstName} has a campfire going${siteInfo}${loopInfo}!${flagInfo}`
          : `${attendee.user.firstName} checked in${siteInfo}${loopInfo} 🏕️`;

        for (const target of toNotify) {
          await db.notification.create({
            data: { userId: target.userId, type: notifType, title, content: body, link: `/trips/${req.params.id}`, category: 'SOCIAL', actorId: userId },
          }).catch(() => {});
        }
      } catch {}
    }

    res.json({ attendee });
  } catch {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET /api/events/:id/campground-map — attendees with presence data
router.get('/:id/campground-map', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const event = await db.event.findUnique({
      where: { id: req.params.id },
      select: { campgroundId: true, campground: { select: { id: true, name: true } } },
    });

    const attendees = await db.eventAttendee.findMany({
      where: { eventId: req.params.id, status: { in: ['ATTENDING', 'CHECKED_IN'] } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, rvType: true, rvMake: true, rvModel: true, rvYear: true, rvLength: true } },
      },
    });

    // Get viewer's rig for twin matching
    const viewer = await db.user.findUnique({ where: { id: userId }, select: { rvMake: true, rvModel: true } });

    // Get friends
    const friendships = await db.friendship.findMany({
      where: { OR: [{ initiatorId: userId }, { receiverId: userId }], status: 'accepted' },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIds = new Set(friendships.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId));

    // Get map image
    let mapImageUrl: string | null = null;
    if (event?.campgroundId) {
      const kit = await db.welcomeKit.findUnique({ where: { campgroundId: event.campgroundId }, select: { mapImageUrl: true } });
      mapImageUrl = kit?.mapImageUrl || null;
    }

    // Filter by visibility
    const visible = attendees.filter((a: any) => {
      if (a.userId === userId) return true;
      if (a.siteVisibility === 'HIDDEN') return false;
      if (a.siteVisibility === 'FRIENDS') return friendIds.has(a.userId);
      return true; // ATTENDEES
    });

    // Build response with rig twin and friend flags
    const enriched = visible.map((a: any) => ({
      ...a,
      isRigTwin: !!(viewer?.rvMake && a.user.rvMake && viewer.rvMake.toLowerCase() === a.user.rvMake.toLowerCase() && viewer.rvModel && a.user.rvModel && viewer.rvModel.toLowerCase() === a.user.rvModel.toLowerCase()),
      isFriend: friendIds.has(a.userId),
    }));

    // Group by loop
    const loopMap = new Map<string | null, any[]>();
    for (const a of enriched) {
      const key = a.loopArea || null;
      if (!loopMap.has(key)) loopMap.set(key, []);
      loopMap.get(key)!.push(a);
    }
    const loops = [...loopMap.entries()].map(([loopArea, att]) => ({ loopArea, attendees: att, count: att.length }));

    res.json({
      loops,
      totalVisible: enriched.length,
      viewerIsHidden: attendees.find((a: any) => a.userId === userId)?.siteVisibility === 'HIDDEN',
      mapImageUrl,
    });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/events/:eventId/invite — unified internal+external invite
// Body: { usernames?: string[], emails?: string[], message?: string }
// ─────────────────────────────────────────────────────────────
router.post('/:eventId/invite', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { eventId } = req.params;
    const usernames: string[] = Array.isArray(req.body.usernames) ? req.body.usernames : [];
    const emails: string[] = Array.isArray(req.body.emails) ? req.body.emails : [];
    const message: string | undefined = typeof req.body.message === 'string' ? req.body.message.trim() || undefined : undefined;

    if (usernames.length === 0 && emails.length === 0) {
      return res.status(400).json({ error: 'Provide at least one username or email' });
    }

    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        campground: { select: { name: true, location: true, state: true } },
        organizer: { select: { firstName: true, lastName: true, username: true } },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const sender = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, username: true },
    });
    if (!sender) return res.status(404).json({ error: 'User not found' });
    const senderName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.username;

    // Build event facts shared by both notification + email
    const eventLocation = event.locationName
      || (event.campground ? `${event.campground.name}${event.campground.location ? ', ' + event.campground.location : ''}${event.campground.state ? ', ' + event.campground.state : ''}` : (event.location || 'Location TBD'));

    const startD = new Date(event.startDate);
    const endD = event.endDate ? new Date(event.endDate) : null;
    const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const eventDateLabel = endD && endD.toDateString() !== startD.toDateString()
      ? `${startD.toLocaleDateString('en-US', dateOpts)} – ${endD.toLocaleDateString('en-US', dateOpts)}`
      : startD.toLocaleDateString('en-US', dateOpts);

    const internalResults: { username: string; status: 'invited' | 'already' | 'not_found' }[] = [];
    const externalResults: { email: string; status: 'sent' | 'already' | 'failed'; error?: string }[] = [];

    // ── Internal invites (RVUnicorn members) ────────────────
    for (const rawUsername of usernames) {
      const username = String(rawUsername).trim().replace(/^@/, '');
      if (!username) continue;

      const target = await db.user.findUnique({ where: { username }, select: { id: true, firstName: true } });
      if (!target) {
        internalResults.push({ username, status: 'not_found' });
        continue;
      }
      if (target.id === userId) continue;

      const existing = await db.eventAttendee.findUnique({
        where: { eventId_userId: { eventId, userId: target.id } },
      });
      if (existing) {
        internalResults.push({ username, status: 'already' });
        continue;
      }

      await db.eventAttendee.create({
        data: { eventId, userId: target.id, status: 'INVITED' },
      });

      // In-app notification
      try {
        await db.notification.create({
          data: {
            userId: target.id,
            type: 'EVENT_INVITE',
            category: 'EVENT',
            content: `${senderName} invited you to "${event.title}" — ${eventDateLabel} at ${eventLocation}`,
            link: `/trips/${event.id}`,
            actorId: userId,
            actorName: senderName,
            metadata: { eventId, message: message || null },
          },
        });
      } catch (e: any) {
        console.error('Notification create failed', e);
      }

      internalResults.push({ username, status: 'invited' });
    }

    // ── External invites (email) ───────────────────────────
    for (const rawEmail of emails) {
      const email = String(rawEmail).trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

      const existing = await db.invite.findFirst({
        where: { senderId: userId, email, eventId, status: 'pending' },
      });
      if (existing) {
        externalResults.push({ email, status: 'already' });
        continue;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await db.invite.create({
        data: { senderId: userId, email, token, expiresAt, eventId, personalMessage: message || null },
      });

      const inviteUrl = `${INVITE_SITE_URL}/join?token=${token}&event=${eventId}&ref=${sender.username}`;
      const html = buildEventInviteEmail({
        senderName,
        eventTitle: event.title,
        eventLocation,
        eventDateLabel,
        inviteUrl,
        personalMessage: message,
        eventBanner: event.bannerImage,
      });

      try {
        await inviteResend.emails.send({
          from: 'Hitch at RVUnicorn <hitch@updates.rvunicorn.com>',
          to: email,
          subject: `${senderName} invited you to "${event.title}" 🏕️`,
          html,
        });
        externalResults.push({ email, status: 'sent' });
      } catch (err: any) {
        console.error('Event invite email failed', err?.message);
        externalResults.push({ email, status: 'failed', error: err?.message });
      }
    }

    res.json({
      internal: internalResults,
      external: externalResults,
      summary: {
        invited: internalResults.filter(r => r.status === 'invited').length,
        emailed: externalResults.filter(r => r.status === 'sent').length,
        notFound: internalResults.filter(r => r.status === 'not_found').length,
        alreadyInvited: internalResults.filter(r => r.status === 'already').length + externalResults.filter(r => r.status === 'already').length,
      },
    });
  } catch (error: any) {
    console.error('Unified event invite error:', error);
    res.status(500).json({ error: 'Failed to send invites' });
  }
});

// POST /:id/stops — add a stop to a trip (auto-creates a TripDay if needed)
router.post('/:id/stops', authenticateToken, async (req: any, res: Response) => {
  try {
    const eventId = req.params.id;
    const userId = req.userId;

    // Verify the event exists and user is the organizer
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, organizerId: true, startDate: true } });
    if (!event) return res.status(404).json({ error: 'Trip not found' });
    if (event.organizerId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const { stopType, name, address, city, state, notes, arrivalDate, departureDate, durationMins } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Stop name is required' });

    // Find or create a TripDay for this stop
    let tripDay = await prisma.tripDay.findFirst({
      where: { tripId: eventId },
      orderBy: { dayNumber: 'desc' },
    });

    if (!tripDay) {
      tripDay = await prisma.tripDay.create({
        data: {
          tripId: eventId,
          dayNumber: 1,
          date: event.startDate || new Date(),
          type: 'TRAVEL',
        },
      });
    }

    // Count existing stops for order
    const stopCount = await prisma.tripStop.count({ where: { tripDayId: tripDay.id } });

    const stop = await prisma.tripStop.create({
      data: {
        tripDayId: tripDay.id,
        order: stopCount,
        type: stopType || 'OTHER',
        customName: name.trim(),
        address: address || [city, state].filter(Boolean).join(', ') || null,
        notes: notes || null,
        durationMins: durationMins || null,
      },
    });

    res.status(201).json(stop);
  } catch (error: any) {
    console.error('[Trip] add stop error:', error.message);
    res.status(500).json({ error: 'Failed to add stop' });
  }
});

export default router;
