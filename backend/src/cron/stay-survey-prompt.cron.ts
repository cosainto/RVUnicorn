import { prisma } from '../prisma';
import { createNotification } from '../utils/createNotification';

/**
 * Hitch's 24h post-trip survey nudge.
 *
 * For each event that ended between 24 and 96 hours ago and has a
 * campground attached, find every attendee who hasn't yet left a
 * CampgroundReview for that campground — and send them a friendly
 * Hitch notification asking how the stay was. Their answers feed the
 * structured insight we hand back to campsite operators.
 *
 * Dedupe rule: never send more than one STAY_SURVEY_PROMPT per
 * (user, event). We check existing notifications via metadata.eventId
 * before queueing a new one. The 24h floor gives users a day of quiet
 * after checkout; the 96h ceiling ensures a missed cron tick doesn't
 * lose the prompt entirely (we have ~3 days of catch-up window).
 *
 * Wired into setInterval in index.ts at hourly cadence, alongside the
 * trip memory transition cron.
 */
export async function runStaySurveyPromptCron() {
  const now = Date.now();
  const windowEnd = new Date(now - 24 * 60 * 60 * 1000); // ended at least 24h ago
  const windowStart = new Date(now - 96 * 60 * 60 * 1000); // ended at most 96h ago

  let prompted = 0;
  let skippedAlreadyReviewed = 0;
  let skippedAlreadyPrompted = 0;

  try {
    const events = await prisma.event.findMany({
      where: {
        campgroundId: { not: null },
        endDate: { gte: windowStart, lt: windowEnd },
        eventStatus: { not: 'CANCELLED' },
      },
      include: {
        campground: { select: { id: true, name: true } },
        attendees: {
          // The codebase has both "GOING" and "going" historically — match
          // the pattern other route files use to filter confirmed attendees.
          where: { status: { in: ['GOING', 'going'] } },
          include: { user: { select: { id: true, firstName: true } } },
        },
      },
      take: 100, // safety cap; this runs hourly so we'll catch up next tick
    });

    for (const event of events) {
      if (!event.campground) continue;

      for (const attendee of event.attendees) {
        try {
          // Skip if the user already reviewed this campground —
          // they've already given us their insight, no nudge needed.
          const existingReview = await prisma.campgroundReview.findUnique({
            where: {
              campgroundId_userId: {
                campgroundId: event.campground.id,
                userId: attendee.user.id,
              },
            },
            select: { id: true },
          });
          if (existingReview) {
            skippedAlreadyReviewed++;
            continue;
          }

          // Dedupe: skip if we already sent a prompt for this event/user.
          // We pattern-match on metadata.eventId since we don't have a
          // dedicated table for "prompts sent."
          const alreadyPrompted = await prisma.notification.findFirst({
            where: {
              userId: attendee.user.id,
              type: 'STAY_SURVEY_PROMPT',
              metadata: { path: ['eventId'], equals: event.id },
            },
            select: { id: true },
          });
          if (alreadyPrompted) {
            skippedAlreadyPrompted++;
            continue;
          }

          await createNotification({
            userId: attendee.user.id,
            type: 'STAY_SURVEY_PROMPT',
            category: 'SYSTEM',
            content: `How was your stay at ${event.campground.name}? Your insight helps the next camper — and the campground.`,
            // Deep-link to the trip page with ?survey=open so the
            // TripDetailPage auto-opens the survey modal on mount.
            link: `/trips/${event.id}?survey=open`,
            actorName: 'Hitch',
            actorAvatar: '/hitch.png',
            metadata: {
              eventId: event.id,
              eventTitle: event.title,
              campgroundId: event.campground.id,
              campgroundName: event.campground.name,
            },
          });
          prompted++;
        } catch (e: any) {
          console.error(
            `[StaySurveyPrompt] Failed for user ${attendee.user.id} on event ${event.id}:`,
            e,
          );
        }
      }
    }

    if (prompted > 0 || skippedAlreadyReviewed > 0 || skippedAlreadyPrompted > 0) {
      console.log(
        `[StaySurveyPrompt] sent=${prompted} skip-already-reviewed=${skippedAlreadyReviewed} skip-already-prompted=${skippedAlreadyPrompted}`,
      );
    }
  } catch (e: any) {
    console.error('[StaySurveyPrompt] Error:', e);
  }
}
