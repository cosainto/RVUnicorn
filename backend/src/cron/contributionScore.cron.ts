import cron from 'node-cron';
import { prisma } from '../prisma';

const CAPS: Record<string, number> = {
  reviews: 150,
  states: 400,
  trips: 300,
  mods: 200,
  engagement: 100,
  trivia: 75,
  checkins: 120,
  followers: 50,
  founding: 50,
};

export function registerContributionScoreCron() {
  // Weekly Sunday 2am CT
  cron.schedule('0 2 * * 0', async () => {
    console.log('[ContributionScore] recalculating...');
    await calculateAllScores();
  });
}

export async function calculateAllScores() {
  try {
    const rigs = await (prisma as any).rig.findMany({
      where: { isPublic: true },
      select: { id: true, ownerId: true, followerCount: true },
    });

    let updated = 0;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    for (const rig of rigs) {
      try {
        const breakdown: Record<string, number> = {};

        // 1. Campground reviews: 15 pts with text, 5 star-only (cap 150)
        const reviews = await (prisma as any).campgroundReview.findMany({
          where: { userId: rig.ownerId },
          select: { review: true },
        });
        const reviewScore = reviews.reduce((sum: number, r: any) => {
          return sum + (r.review && r.review.trim().length > 0 ? 15 : 5);
        }, 0);
        breakdown.reviews = Math.min(reviewScore, CAPS.reviews);

        // 2. Unique states visited: 8 pts/state (cap 400)
        const stateCount = rig.totalStatesCount || 0;
        // Use rig stats if available, else count from stateVisit
        let statesValue = stateCount;
        if (!statesValue) {
          try {
            const states = await (prisma as any).stateVisit.findMany({
              where: { userId: rig.ownerId },
              select: { state: true },
              distinct: ['state'],
            });
            statesValue = states.length;
          } catch { statesValue = 0; }
        }
        breakdown.states = Math.min(statesValue * 8, CAPS.states);

        // 3. Trip logs: 20 pts with photos, 8 without (cap 300)
        const events = await (prisma as any).event.findMany({
          where: { organizerId: rig.ownerId },
          select: { id: true },
        });
        // Check photos for each event
        let tripScore = 0;
        for (const ev of events) {
          const photoCount = await (prisma as any).photo.count({
            where: { eventId: ev.id },
          });
          tripScore += photoCount > 0 ? 20 : 8;
        }
        breakdown.trips = Math.min(tripScore, CAPS.trips);

        // 4. Mod logs: 25 pts with before/after, 10 without (cap 200)
        const mods = await (prisma as any).modLog.findMany({
          where: { rigId: rig.id, isPublic: true },
          select: { beforePhoto: true, afterPhoto: true },
        });
        const modScore = mods.reduce((sum: number, m: any) => {
          return sum + (m.beforePhoto && m.afterPhoto ? 25 : 10);
        }, 0);
        breakdown.mods = Math.min(modScore, CAPS.mods);

        // 5. Community engagement: 2 pts/reply, 1 pt/reaction last 90d (cap 100)
        let engagementScore = 0;
        try {
          const replyCount = await (prisma as any).threadComment.count({
            where: { userId: rig.ownerId, createdAt: { gte: ninetyDaysAgo } },
          });
          const reactionCount = await (prisma as any).activityLike.count({
            where: { userId: rig.ownerId, createdAt: { gte: ninetyDaysAgo } },
          });
          engagementScore = replyCount * 2 + reactionCount;
        } catch {}
        breakdown.engagement = Math.min(engagementScore, CAPS.engagement);

        // 6. Trivia streak: currentStreak * 1.5 (cap 75)
        let triviaScore = 0;
        try {
          const triviaStats = await (prisma as any).triviaPlayerStats.findFirst({
            where: { userId: rig.ownerId },
            select: { currentStreak: true },
          });
          triviaScore = Math.round((triviaStats?.currentStreak || 0) * 1.5);
        } catch {}
        breakdown.trivia = Math.min(triviaScore, CAPS.trivia);

        // 7. Consistent check-ins: 10 pts with photo, 4 without last 12mo (cap 120)
        let checkinScore = 0;
        try {
          const checkins = await (prisma as any).checkIn.findMany({
            where: { userId: rig.ownerId, checkInDate: { gte: oneYearAgo } },
            select: { id: true },
          });
          // Simplified: count check-ins, assume some have photos
          checkinScore = checkins.length * 4;
        } catch {}
        breakdown.checkins = Math.min(checkinScore, CAPS.checkins);

        // 8. Follower growth (dampened): log10(followers+1) * 10 (cap 50)
        const followerScore = Math.round(Math.log10((rig.followerCount || 0) + 1) * 10);
        breakdown.followers = Math.min(followerScore, CAPS.followers);

        // 9. Founding Member bonus: 50 pts flat
        let foundingBonus = 0;
        try {
          const user = await (prisma as any).user.findUnique({
            where: { id: rig.ownerId },
            select: { createdAt: true },
          });
          // Founding = joined before 2025
          if (user && new Date(user.createdAt).getFullYear() < 2025) {
            foundingBonus = 50;
          }
        } catch {}
        breakdown.founding = foundingBonus;

        // Total
        const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

        await (prisma as any).rig.update({
          where: { id: rig.id },
          data: {
            contributionScore: total,
            contributionScoreUpdatedAt: now,
            scoreBreakdown: breakdown,
          },
        });

        updated++;
      } catch (err: any) {
        console.error(`[ContributionScore] Error for rig ${rig.id}:`, err.message);
      }
    }

    console.log(`[ContributionScore] Updated ${updated}/${rigs.length} rigs`);
  } catch (err: any) {
    console.error('[ContributionScore] Fatal error:', err.message);
  }
}
