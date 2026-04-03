import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../prisma';
import { generateHitchMessage, type HitchSkin, type HitchEventContext } from './hitchEventService';
import { computeEventLifecycle } from '../helpers/event-status';

// Lazy import to avoid circular dependency with index.ts
function getIO() {
  return require('../index').io;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ─────────────────────────────────────────────────────

async function getEventContext(event: any): Promise<HitchEventContext> {
  const hereNow = await prisma.eventAttendee.count({
    where: { eventId: event.id, arrivalStatus: 'HERE_NOW' },
  });
  const nearby = await prisma.eventAttendee.count({
    where: { eventId: event.id, status: { in: ['GOING', 'INTERESTED'] }, arrivalStatus: { not: 'HERE_NOW' } },
  });
  const leaderboard = await (prisma as any).triviaLeaderboard?.findMany?.({
    where: { weekId: undefined }, // Will be populated per-event if trivia runs
    orderBy: { totalPoints: 'desc' },
    take: 3,
    include: { user: { select: { firstName: true } } },
  }).catch(() => []);
  const top3 = (leaderboard || []).map((l: any) => l.user?.firstName).filter(Boolean);

  return {
    eventName: event.title,
    hereNowCount: hereNow,
    nearbyCount: nearby,
    leaderboardTop3: top3,
  };
}

async function postHitchToEvent(eventId: string, campgroundId: string | null, message: string) {
  if (!campgroundId) return;
  const room = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
  if (!room) return;
  await prisma.campfireMessage.create({
    data: { roomId: room.id, isHitch: true, content: message },
  });
  getIO().of('/campfire').to(campgroundId).emit('message:new', {
    id: `hitch-${Date.now()}`,
    content: message,
    createdAt: new Date().toISOString(),
    isSystem: false,
    isHitch: true,
  });
}

// ── Pre-Event: What to Bring list from rig profiles ─────────────

async function generateWhatToBring(event: any) {
  const attendees = await prisma.eventAttendee.findMany({
    where: { eventId: event.id, status: 'ATTENDING' },
    include: {
      user: {
        select: {
          firstName: true, rvType: true, rvMake: true, rvModel: true,
          rvLength: true, rvYear: true,
        },
      },
    },
  });

  const rigSummary = attendees.map(a => {
    const u = a.user as any;
    return `${u.firstName}: ${u.rvType || 'unknown'} ${u.rvMake || ''} ${u.rvModel || ''}`.trim();
  }).join('\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are helping plan an RV camping event called "${event.title}". Here are the attendees and their rigs:\n${rigSummary}\n\nGenerate a "What to Bring" checklist (8-12 items) that's smart about what these rigs can do. If someone has a Class A with a full kitchen, suggest they bring a dish. If someone has a truck camper, suggest portable items. Format as a bulleted list. Keep it fun and practical.`,
      }],
    });
    return response.content[0].type === 'text' ? response.content[0].text.trim() : null;
  } catch {
    return null;
  }
}

// ── Serendipity Check ───────────────────────────────────────────

const SERENDIPITY_ATTRIBUTES = [
  'hasEBike', 'hasKayak', 'hasFishingGear', 'hasBikes', 'hasGrill',
  'hasDogs', 'hasKids', 'hasGenerator', 'hasSolarPanels',
];

async function serendipityCheck(event: any) {
  if (!event.serendipityEnabled) return;

  const nearbyAttendees = await prisma.eventAttendee.findMany({
    where: {
      eventId: event.id,
      arrivalStatus: { in: ['HERE_NOW', 'NOT_ARRIVED'] },
      status: { in: ['GOING', 'INTERESTED', 'ATTENDING'] },
    },
    include: {
      user: {
        select: {
          id: true, firstName: true,
          rvType: true, hasDogs: true,
        },
      },
    },
  });

  // Check RV profiles for shared attributes
  const userProfiles = await Promise.all(
    nearbyAttendees.map(async (a) => {
      const rv = await (prisma as any).rvShowcase?.findFirst?.({
        where: { userId: a.userId },
      }).catch(() => null);
      return { userId: a.userId, firstName: a.user.firstName, rv, hasDogs: a.hasDogs };
    })
  );

  // Group by shared attributes
  const groups: Record<string, string[]> = {};
  for (const p of userProfiles) {
    if (p.hasDogs) (groups['dogFriendly'] ??= []).push(p.firstName || 'Camper');
    if (p.rv?.hasEBike) (groups['hasEBike'] ??= []).push(p.firstName || 'Camper');
    if (p.rv?.hasKayak) (groups['hasKayak'] ??= []).push(p.firstName || 'Camper');
    if (p.rv?.hasBikes) (groups['hasBikes'] ??= []).push(p.firstName || 'Camper');
    if (p.rv?.hasFishingGear) (groups['hasFishingGear'] ??= []).push(p.firstName || 'Camper');
  }

  // Check existing pop-ups to avoid duplicates
  const existingPopUps = await prisma.eventPopUp.findMany({
    where: { eventId: event.id },
    select: { triggeredBy: true },
  });
  const existingTriggers = new Set(existingPopUps.map(p => p.triggeredBy));

  const ACTIVITY_LABELS: Record<string, string> = {
    hasEBike: 'e-bike ride',
    hasKayak: 'kayak outing',
    hasBikes: 'group bike ride',
    hasFishingGear: 'fishing trip',
    dogFriendly: 'dog walk',
  };

  for (const [attr, names] of Object.entries(groups)) {
    if (names.length < 3) continue;
    if (existingTriggers.has(attr)) continue;

    const activity = ACTIVITY_LABELS[attr] || `${attr} activity`;

    // Create suggested pop-up
    await prisma.eventPopUp.create({
      data: {
        eventId: event.id,
        title: `Group ${activity.charAt(0).toUpperCase() + activity.slice(1)}`,
        description: `${names.length} campers nearby have ${attr === 'dogFriendly' ? 'dogs' : attr.replace('has', '').toLowerCase()}. Suggest a group ${activity}?`,
        createdByHitch: true,
        triggeredBy: attr,
        status: event.autopilotMode === 'FULLY_GUIDED' && names.length >= 5 ? 'APPROVED' : 'SUGGESTED',
      },
    });

    // In FULLY_GUIDED with high confidence, message host privately
    if (event.autopilotMode === 'FULLY_GUIDED' && names.length >= 5) {
      const msg = await generateHitchMessage(
        event.hitchSkin as HitchSkin,
        'POPUP_EVENT_CREATED',
        { ...await getEventContext(event), popUpTitle: `Group ${activity}` },
      );
      if (msg) {
        await postHitchToEvent(event.id, event.campgroundId, msg);
      }
    }
  }
}

// ── Live Event Monitor ──────────────────────────────────────────

async function monitorLiveEvent(event: any) {
  const ctx = await getEventContext(event);

  // If nearbyNotIn > hereNow and FULLY_GUIDED, auto-suggest hype blast
  if (ctx.nearbyCount > ctx.hereNowCount && event.autopilotMode === 'FULLY_GUIDED') {
    const existingBlast = await prisma.eventPopUp.findFirst({
      where: { eventId: event.id, triggeredBy: 'HYPE_BLAST', status: { not: 'DISMISSED' } },
    });
    if (!existingBlast) {
      const msg = await generateHitchMessage(event.hitchSkin as HitchSkin, 'HYPE_BLAST', ctx);
      if (msg) {
        await postHitchToEvent(event.id, event.campgroundId, msg);
      }
    }
  }
}

// ── Trip Memory Transition ──────────────────────────────────────

export async function checkEventMemoryTransitions() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: {
      isTripMemory: false,
      isLive: false,
      endDate: { lt: cutoff },
      eventStatus: { not: 'CANCELLED' },
    },
    include: {
      attendees: { include: { user: { select: { id: true, firstName: true } } } },
      highlights: { orderBy: { reactionCount: 'desc' }, take: 5 },
    },
    take: 50,
  });

  for (const event of events) {
    if (computeEventLifecycle(event) !== 'ENDED') continue;

    try {
      // Calculate connections — users who chatted but don't follow each other
      const attendeeIds = event.attendees.map(a => a.userId);
      let newConnections = 0;

      // Generate "Next Time" suggestions from highlights
      const highlightText = event.highlights.map(h => h.messageSnippet).join('\n');
      let suggestions: string[] = [];
      if (highlightText.length > 20) {
        try {
          const res = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{
              role: 'user',
              content: `These are the top chat highlights from an RV camping event "${event.title}":\n${highlightText}\n\nBased on recurring themes, generate 3-5 actionable suggestions for next time. Format as a JSON array of strings. Example: ["Add a bug spray station","Lasagna was a hit — add to bring list"]`,
            }],
          });
          const text = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]';
          suggestions = JSON.parse(text.replace(/```json|```/g, '').trim());
        } catch {}
      }

      // Create trip memory record
      await prisma.tripMemoryRecord.create({
        data: {
          eventId: event.id,
          totalAttended: event.attendees.length,
          newConnections,
          popUpEventsCreated: await prisma.eventPopUp.count({ where: { eventId: event.id, status: { not: 'DISMISSED' } } }),
          hitchMessagesSent: 0,
          nextTimeSuggestions: suggestions,
        },
      });

      // Flip the flag
      await prisma.event.update({
        where: { id: event.id },
        data: { isTripMemory: true },
      });

      // Notify attendees
      for (const attendee of event.attendees) {
        await prisma.notification.create({
          data: {
            userId: attendee.userId,
            type: 'TRIP_MEMORY',
            content: `📸 Your "${event.title}" memory is ready!`,
            link: `/events-v2/${event.id}`,
          },
        }).catch(() => {});
      }

      console.log(`[Autopilot] Trip memory created for event ${event.id}`);
    } catch (e) {
      console.error(`[Autopilot] Memory transition failed for ${event.id}:`, e);
    }
  }
}

// ── Main Cron Runner (5-min interval during live events) ────────

export async function runAutopilotCycle() {
  const now = new Date();
  const liveEvents = await prisma.event.findMany({
    where: {
      startDate: { lte: now },
      endDate: { gte: now },
      eventStatus: { not: 'CANCELLED' },
      autopilotMode: { not: 'MANUAL' },
    },
  });

  // Mark events as live
  for (const event of liveEvents) {
    if (!event.isLive) {
      await prisma.event.update({ where: { id: event.id }, data: { isLive: true } });

      // Fire EVENT_START Hitch message
      const ctx = await getEventContext(event);
      const msg = await generateHitchMessage(event.hitchSkin as HitchSkin, 'EVENT_START', ctx);
      if (msg) await postHitchToEvent(event.id, event.campgroundId, msg);
    }

    await monitorLiveEvent(event);
  }

  // Run serendipity every cycle (it self-deduplicates)
  for (const event of liveEvents) {
    if (event.serendipityEnabled) {
      await serendipityCheck(event);
    }
  }

  // Mark ended events
  const justEnded = await prisma.event.findMany({
    where: {
      isLive: true,
      endDate: { lt: now },
    },
  });
  for (const event of justEnded) {
    await prisma.event.update({ where: { id: event.id }, data: { isLive: false } });
    const ctx = await getEventContext(event);
    const msg = await generateHitchMessage(event.hitchSkin as HitchSkin, 'EVENT_WRAP_UP', ctx);
    if (msg) await postHitchToEvent(event.id, event.campgroundId, msg);
  }
}

// Export generateWhatToBring for pre-event use
export { generateWhatToBring, serendipityCheck, getEventContext };
