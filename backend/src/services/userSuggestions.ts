/**
 * People Suggestion Engine — scores potential follows by shared attributes.
 *
 * Scoring signals:
 *   Same rig make+model: +50 (strongest)
 *   Same rig class: +20
 *   Mutual follows: count * 20 (up to +60)
 *   Same states visited: overlap * 10 (up to +40)
 *   Same campgrounds visited: overlap * 15 (up to +45)
 *   Both follow same rigs: +15
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

export async function generateSuggestions(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rvMake: true, rvModel: true, rvType: true },
    });
    if (!user) return;

    // Get existing follows to exclude
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ initiatorId: userId }, { receiverId: userId }], status: 'ACCEPTED' },
      select: { initiatorId: true, receiverId: true },
    });
    const followedIds = new Set<string>();
    followedIds.add(userId);
    friendships.forEach((f: any) => {
      followedIds.add(f.initiatorId === userId ? f.receiverId : f.initiatorId);
    });

    // Get dismissed suggestions
    const dismissed = await prisma.userSuggestion.findMany({
      where: { userId, dismissed: true },
      select: { suggestedUserId: true },
    });
    dismissed.forEach((d: any) => followedIds.add(d.suggestedUserId));

    // Get user's states and campgrounds
    const userStates = await prisma.stateVisit.findMany({
      where: { userId },
      select: { state: true },
    }).then((v: any[]) => new Set(v.map(s => s.state)));

    const userCampgrounds = await prisma.campgroundFollow.findMany({
      where: { userId },
      select: { campgroundId: true },
    }).then((f: any[]) => new Set(f.map(c => c.campgroundId)));

    // Get rigs user follows
    const rigFollows = await prisma.rigFollow.findMany({
      where: { userId },
      select: { rigId: true },
    }).then((f: any[]) => new Set(f.map(r => r.rigId)));

    // Find candidate users — same rig, same class, or active recently
    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(followedIds) },
        lastActiveAt: { gte: new Date(Date.now() - 90 * 86400000) }, // Active in last 90 days
      },
      select: { id: true, rvMake: true, rvModel: true, rvType: true },
      take: 200,
    });

    const scored: Array<{ suggestedUserId: string; reason: string; score: number }> = [];

    for (const candidate of candidates) {
      let score = 0;
      let reason = '';

      // Same rig make + model (+50)
      if (user.rvMake && candidate.rvMake === user.rvMake && candidate.rvModel === user.rvModel) {
        score += 50;
        reason = `Fellow ${user.rvMake} ${user.rvModel} owner`;
      }
      // Same rig class (+20)
      else if (user.rvType && candidate.rvType === user.rvType) {
        score += 20;
        reason = `Fellow ${user.rvType.replace('_', ' ')} owner`;
      }

      // Mutual follows (+20 each, cap +60)
      const mutuals = await prisma.friendship.count({
        where: {
          status: 'ACCEPTED',
          OR: [
            { initiatorId: candidate.id, receiverId: { in: Array.from(followedIds).slice(0, 50) } },
            { receiverId: candidate.id, initiatorId: { in: Array.from(followedIds).slice(0, 50) } },
          ],
        },
      });
      if (mutuals > 0) {
        score += Math.min(60, mutuals * 20);
        reason = reason || `${mutuals} mutual follow${mutuals > 1 ? 's' : ''}`;
      }

      // State overlap (+10 each, cap +40)
      if (userStates.size > 0) {
        const candidateStates = await prisma.stateVisit.findMany({
          where: { userId: candidate.id },
          select: { state: true },
        });
        const overlap = candidateStates.filter((s: any) => userStates.has(s.state)).length;
        if (overlap > 0) {
          score += Math.min(40, overlap * 10);
          const sampleState = candidateStates.find((s: any) => userStates.has(s.state))?.state;
          reason = reason || `Both visited ${sampleState}`;
        }
      }

      // Campground overlap (+15 each, cap +45)
      if (userCampgrounds.size > 0) {
        const candidateCampgrounds = await prisma.campgroundFollow.findMany({
          where: { userId: candidate.id, campgroundId: { in: Array.from(userCampgrounds).slice(0, 30) } },
          select: { campgroundId: true },
        });
        if (candidateCampgrounds.length > 0) {
          score += Math.min(45, candidateCampgrounds.length * 15);
          reason = reason || 'Stayed at the same campground';
        }
      }

      // Both follow same rigs (+15)
      if (rigFollows.size > 0) {
        const sharedRigs = await prisma.rigFollow.count({
          where: { userId: candidate.id, rigId: { in: Array.from(rigFollows).slice(0, 20) } },
        });
        if (sharedRigs > 0) {
          score += 15;
          reason = reason || 'Follows the same rigs';
        }
      }

      if (score >= 15) {
        scored.push({ suggestedUserId: candidate.id, reason, score });
      }
    }

    // Sort by score and keep top 20
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 20);

    // Upsert suggestions
    for (const s of top) {
      await prisma.userSuggestion.upsert({
        where: { userId_suggestedUserId: { userId, suggestedUserId: s.suggestedUserId } },
        create: { userId, suggestedUserId: s.suggestedUserId, reason: s.reason, score: s.score },
        update: { reason: s.reason, score: s.score },
      }).catch(() => {});
    }

    console.log(`[Suggestions] Generated ${top.length} suggestions for user ${userId}`);
  } catch (e) {
    console.error('[Suggestions] Error:', e);
  }
}
