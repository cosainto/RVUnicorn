import { prisma } from '../prisma';

export const TRIVIA_TITLES = [
  { title: "🏕️ Rookie RVer",        slug: 'rookie',     check: async (userId: string) => {
    const count = await prisma.triviaAnswer.count({ where: { userId } });
    return count >= 1;
  }},
  { title: "🔥 Campfire Regular",    slug: 'regular',    check: async (userId: string) => {
    const days = await prisma.triviaAnswer.findMany({
      where: { userId },
      select: { createdAt: true },
      distinct: ['createdAt'],
    });
    const uniqueDays = new Set(days.map(d => d.createdAt.toISOString().split('T')[0]));
    return uniqueDays.size >= 10;
  }},
  { title: "🎯 Trivia Trailblazer",  slug: 'trailblazer', check: async (userId: string) => {
    // Won 3 daily sessions (most points in a day)
    const weeks = await prisma.triviaWeek.findMany({
      where: { isActive: false },
      include: {
        leaderboard: { orderBy: { totalPoints: 'desc' }, take: 1 },
      },
    });
    const dailyWins = weeks.filter(w => w.leaderboard[0]?.userId === userId).length;
    return dailyWins >= 3;
  }},
  { title: "🏆 Campfire Contender",  slug: 'contender',  check: async (userId: string) => {
    const wins = await prisma.triviaWeek.count({ where: { winnerId: userId } });
    return wins >= 1;
  }},
  { title: "🦄 Hitch's Inner Circle", slug: 'inner_circle', check: async (userId: string) => {
    const wins = await prisma.triviaWeek.count({ where: { winnerId: userId } });
    return wins >= 3;
  }},
];

export async function updateTriviaTitle(userId: string): Promise<string | null> {
  try {
    let highestTitle: string | null = null;

    // Check from highest to lowest — assign highest earned
    for (const tier of [...TRIVIA_TITLES].reverse()) {
      const earned = await tier.check(userId);
      if (earned) {
        highestTitle = tier.title;
        break;
      }
    }

    if (highestTitle) {
      await prisma.user.update({
        where: { id: userId },
        data: { triviaTitle: highestTitle },
      });
    }

    return highestTitle;
  } catch (e: any) {
    console.error('[TriviaTitle] Error:', e);
    return null;
  }
}
