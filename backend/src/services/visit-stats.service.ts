import { prisma } from '../prisma';

/**
 * Single source of truth for "where has this user been" data.
 *
 * Background: this app accumulated four parallel tables for visit history:
 *
 *   - Stay        (legacy, no live writer — kept for historical rows)
 *   - CheckIn     (physical check-in/out at a campground)
 *   - StateVisit  (the table the travel map reads — canonical going forward)
 *   - Event       (past, with a campgroundId — implicit visits)
 *
 * Different writers populate different tables, so any reader that picks one
 * table gets incomplete data — that's how Deanna's profile showed 0 nights
 * while her map showed 23 visits.
 *
 * This service does two things:
 *
 *   1) recordCampgroundVisit — the canonical write helper. Every event
 *      creation path should call this so a StateVisit row exists alongside
 *      the Event. Idempotent per (userId, eventId).
 *
 *   2) getMergedVisitWindows / getProfileVisitStats — the canonical read
 *      helper. Pulls visit windows from all four tables, merges overlapping
 *      spans on the same campground (so a single trip recorded in multiple
 *      tables only counts once), and returns the unified result.
 *
 * Schema is left alone — this is a "tighten the convergence" fix, not a
 * data migration.
 */

// ─────────────────────────────────────────────────────────────────
// WRITES
// ─────────────────────────────────────────────────────────────────

interface MinimalEvent {
  id: string;
  title: string;
  startDate: Date | string;
  endDate?: Date | string | null;
}

interface MinimalCampground {
  id: string;
  name: string;
  state?: string | null;
}

/**
 * Record that a user "visited" a campground via an event. Idempotent —
 * safe to call multiple times for the same (userId, eventId). Silently
 * no-ops if the campground has no state (StateVisit requires a state).
 *
 * Every place that creates an Event with a campgroundId should call this
 * after the event is created. The map reads StateVisit, so a visit not
 * recorded here will be invisible on the user's travel map.
 */
export async function recordCampgroundVisit(
  userId: string,
  event: MinimalEvent | null | undefined,
  campground: MinimalCampground | null | undefined,
): Promise<void> {
  if (!event || !campground || !campground.state) return;

  try {
    const existing = await prisma.stateVisit.findFirst({
      where: { userId, eventId: event.id },
      select: { id: true },
    });

    if (existing) return;

    await prisma.stateVisit.create({
      data: {
        userId,
        state: campground.state,
        startDate: new Date(event.startDate),
        endDate: event.endDate ? new Date(event.endDate) : null,
        campsiteId: campground.id,
        eventId: event.id,
        notes: `${event.title} at ${campground.name}`,
        visibility: 'PUBLIC',
      },
    });
  } catch (err: any) {
    // Non-fatal — visit fanout failures shouldn't break event creation
    console.error('[visit-stats] recordCampgroundVisit failed:', err);
  }
}

/**
 * Fan out state visits to ALL attendees of an event.
 * Call this when attendees are added, invited, or RSVP.
 * Creates a StateVisit for each attendee who doesn't already have one
 * for this event, plus household members of the organizer.
 */
export async function fanOutVisitsToAttendees(eventId: string): Promise<void> {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        campground: { select: { id: true, name: true, state: true } },
        attendees: { select: { userId: true } },
        organizer: { select: { id: true, householdId: true } },
      },
    });

    if (!event || !event.campground?.state) return;

    // Collect all user IDs who should have a StateVisit
    const userIds = new Set<string>();
    userIds.add(event.organizerId);
    for (const a of event.attendees) userIds.add(a.userId);

    // Add household members of the organizer
    if (event.organizer.householdId) {
      const householdMembers = await prisma.user.findMany({
        where: { householdId: event.organizer.householdId },
        select: { id: true },
      });
      for (const m of householdMembers) userIds.add(m.id);
    }

    // Create StateVisits for anyone who doesn't have one yet
    for (const userId of userIds) {
      await recordCampgroundVisit(userId, event, event.campground);
    }
  } catch (err: any) {
    console.error('[visit-stats] fanOutVisitsToAttendees failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────────
// READS
// ─────────────────────────────────────────────────────────────────

export interface VisitWindow {
  campgroundId: string;
  start: Date;
  end: Date;
}

export interface ProfileVisitStats {
  campgroundsVisited: number;
  totalTrips: number;
  nightsCamped: number;
}

/**
 * Pull visit windows for a user from ALL four sources, merge overlapping
 * spans on the same campground, and return the unified list. This is what
 * any reader should call when computing "where has this user been."
 *
 * The merge uses a 1-day buffer so adjacent records (e.g. a StateVisit
 * ending day N and a CheckIn starting day N) get treated as one trip
 * rather than two. In-progress visits are capped at "today" so future
 * departures don't inflate counts.
 */
export async function getMergedVisitWindows(userId: string): Promise<Map<string, VisitWindow[]>> {
  const now = new Date();
  const windows: VisitWindow[] = [];

  // Source 1: Stay (legacy historical rows)
  const stayRows = await prisma.stay.findMany({
    where: { userId, startDate: { lte: now } },
    select: { campgroundId: true, startDate: true, endDate: true },
  });
  for (const s of stayRows) {
    if (!s.campgroundId) continue;
    const end = s.endDate ? new Date(s.endDate) : new Date(s.startDate);
    windows.push({
      campgroundId: s.campgroundId,
      start: new Date(s.startDate),
      end: end > now ? now : end,
    });
  }

  // Source 2: CheckIn
  const checkInRows = await prisma.checkIn.findMany({
    where: { userId, campgroundId: { not: null }, checkInDate: { lte: now } },
    select: { campgroundId: true, checkInDate: true, checkOutDate: true },
  });
  for (const c of checkInRows) {
    if (!c.campgroundId) continue;
    const end = c.checkOutDate ? new Date(c.checkOutDate) : new Date(c.checkInDate);
    windows.push({
      campgroundId: c.campgroundId,
      start: new Date(c.checkInDate),
      end: end > now ? now : end,
    });
  }

  // Source 3: StateVisit (canonical map source)
  const stateVisitRows = await prisma.stateVisit.findMany({
    where: { userId, campsiteId: { not: null }, startDate: { lte: now } },
    select: { campsiteId: true, startDate: true, endDate: true },
  });
  for (const sv of stateVisitRows) {
    if (!sv.campsiteId) continue;
    const end = sv.endDate ? new Date(sv.endDate) : new Date(sv.startDate);
    windows.push({
      campgroundId: sv.campsiteId,
      start: new Date(sv.startDate),
      end: end > now ? now : end,
    });
  }

  // Source 4: past Event with a campground (excluding wishlist trips)
  const pastEventRows = await prisma.event.findMany({
    where: {
      OR: [
        { organizerId: userId },
        { attendees: { some: { userId } } },
      ],
      campgroundId: { not: null },
      startDate: { lte: now },
      isWishlist: false,
    },
    select: { campgroundId: true, startDate: true, endDate: true },
  });
  for (const e of pastEventRows) {
    if (!e.campgroundId) continue;
    const end = e.endDate ? new Date(e.endDate) : new Date(e.startDate);
    windows.push({
      campgroundId: e.campgroundId,
      start: new Date(e.startDate),
      end: end > now ? now : end,
    });
  }

  // Merge overlapping windows per campground (1-day buffer)
  const merged = new Map<string, VisitWindow[]>();
  windows.sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const w of windows) {
    const list = merged.get(w.campgroundId) || [];
    const last = list[list.length - 1];
    if (last && w.start.getTime() <= last.end.getTime() + 86400000) {
      last.end = new Date(Math.max(last.end.getTime(), w.end.getTime()));
    } else {
      list.push({ campgroundId: w.campgroundId, start: w.start, end: w.end });
    }
    merged.set(w.campgroundId, list);
  }

  return merged;
}

/**
 * Compute user-facing stats from the merged visit windows. Used by the
 * profile stats endpoint and any other surface that needs nights-camped /
 * trip count / unique campground count.
 *
 * totalTrips counts from three sources (deduplicated):
 *   1. Events the user organized or attended (with a campground)
 *   2. Trip table records (AI-generated itineraries)
 *   3. Merged visit windows as fallback
 *
 * nightsCamped counts from merged visit windows, treating same-day
 * check-ins as 1 night (you showed up and camped).
 */
export async function getProfileVisitStats(userId: string): Promise<ProfileVisitStats> {
  const merged = await getMergedVisitWindows(userId);

  let nightsCamped = 0;
  for (const list of merged.values()) {
    for (const span of list) {
      const ms = span.end.getTime() - span.start.getTime();
      // Same-day check-in still counts as 1 night (you were there)
      const nights = ms <= 0 ? 1 : Math.ceil(ms / 86400000);
      nightsCamped += nights;
    }
  }

  // Count trips from Events (actual trips) — exclude PLANNING-only Trip records
  // Trip table records are AI-generated itineraries, not actual trips taken
  const [eventCount, uniqueCheckInCampgrounds] = await Promise.all([
    prisma.event.count({
      where: {
        OR: [
          { organizerId: userId },
          { attendees: { some: { userId } } },
        ],
        isWishlist: false,
      },
    }),
    // Also count unique campgrounds directly from check-ins (most reliable source)
    prisma.checkIn.findMany({
      where: { userId, campgroundId: { not: null } },
      distinct: ['campgroundId'],
      select: { campgroundId: true },
    }),
  ]);

  // totalTrips = events the user participated in (not AI-generated itineraries)
  const totalTrips = eventCount;

  // campgroundsVisited = unique campgrounds from check-ins OR merged windows (whichever is larger)
  const campgroundsFromCheckins = uniqueCheckInCampgrounds.length;

  return {
    campgroundsVisited: Math.max(merged.size, campgroundsFromCheckins),
    totalTrips,
    nightsCamped,
  };
}
