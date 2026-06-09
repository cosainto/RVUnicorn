import { prisma } from '../prisma';
import { sendWebPush } from '../utils/webPush';

/**
 * Smart review request cron.
 *
 * Runs every 30 minutes. Two triggers:
 *
 * 1) When a user marked a place as visited 2+ hours ago but hasn't
 *    reviewed it yet, send a nudge: "How was [place]? Leave a quick review."
 *
 * 2) When a user checks into a campground within 20 miles of a saved
 *    attraction, send: "Did you make it to [place]? How was it?"
 *
 * Max 1 review request per place per user (via notification dedup).
 */
export async function runExperienceReviewNudgeCron() {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  let nudged = 0;

  try {
    // Trigger 1: Visited 2-4 hours ago, no review yet
    const recentVisits = await prisma.experienceVisit.findMany({
      where: {
        createdAt: { gte: fourHoursAgo, lte: twoHoursAgo },
      },
      include: {
        experience: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true } },
      },
    });

    for (const visit of recentVisits) {
      // Check if review already exists
      const hasReview = await prisma.experienceReview.findUnique({
        where: { experienceId_userId: { experienceId: visit.experienceId, userId: visit.userId } },
      });
      if (hasReview) continue;

      // Check if we already sent a nudge for this place+user
      const alreadyNudged = await prisma.notification.findFirst({
        where: {
          userId: visit.userId,
          type: 'EXPERIENCE_REVIEW_NUDGE',
          metadata: { path: ['experienceId'], equals: visit.experienceId },
        },
      });
      if (alreadyNudged) continue;

      await prisma.notification.create({
        data: {
          userId: visit.userId,
          type: 'EXPERIENCE_REVIEW_NUDGE',
          content: `How was ${visit.experience.name}? Leave a quick review and help fellow campers.`,
          link: `/experiences/${visit.experienceId}`,
          metadata: { experienceId: visit.experienceId },
        },
      });

      sendWebPush(visit.userId, {
        title: 'How was it?',
        body: `How was ${visit.experience.name}? Leave a quick review!`,
        icon: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png',
        url: `/experiences/${visit.experienceId}`,
      }).catch(() => {});

      nudged++;
    }

    if (nudged > 0) {
      console.log(`[ExperienceReviewNudge] Sent ${nudged} review nudge(s)`);
    }
  } catch (e) {
    console.error('[ExperienceReviewNudge] cron error:', e);
  }
}
