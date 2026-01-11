// badge.service.ts
import { prisma } from '../index';

export enum BadgeTrigger {
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  GROUP_JOINED = 'GROUP_JOINED',
  DAYS_CAMPED = 'DAYS_CAMPED',
  WEEKEND_STAYS = 'WEEKEND_STAYS',
  FRIENDS_COUNT = 'FRIENDS_COUNT',
  RECIPES_SHARED = 'RECIPES_SHARED',
  STATES_VISITED = 'STATES_VISITED',
  REVIEWS_WRITTEN = 'REVIEWS_WRITTEN',
  POSTS_CREATED = 'POSTS_CREATED',
  TRIPS_CREATED = 'TRIPS_CREATED',
  GEAR_ITEMS = 'GEAR_ITEMS',
}

interface BadgeAwardResult {
  awarded: boolean;
  badge?: any;
  alreadyHad?: boolean;
}

export async function awardBadge(userId: string, badgeSlug: string): Promise<BadgeAwardResult> {
  try {
    const badge = await prisma.badge.findUnique({
      where: { slug: badgeSlug }
    });

    if (!badge || !badge.isActive) {
      console.log(`Badge ${badgeSlug} not found or inactive`);
      return { awarded: false };
    }

    const existing = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id
        }
      }
    });

    if (existing) {
      return { awarded: false, alreadyHad: true, badge };
    }

    const userBadge = await prisma.userBadge.create({
      data: {
        userId,
        badgeId: badge.id
      },
      include: {
        badge: true
      }
    });

     await prisma.notification.create({
      data: {
        userId,
        type: 'BADGE_EARNED',
        content: `🏆 You earned the "${badge.name}" badge!`,
        link: `/badges`
      }
    });

    // Create a post announcing the badge
    try {
      await prisma.post.create({
        data: {
          userId,
          content: `🏆 Just earned the "${badge.name}" badge! ${badge.description || ''}`,
          imageUrl: badge.imageUrl,
        }
      });
    } catch (postError) {
      console.error('Failed to create badge post:', postError);
    }

    console.log(`Badge "${badge.name}" awarded to user ${userId}`);
    return { awarded: true, badge: userBadge.badge };
  } catch (error) {
    console.error('Award badge error:', error);
    return { awarded: false };
  }
}

export async function checkAndAwardBadges(userId: string, triggerType: BadgeTrigger): Promise<BadgeAwardResult[]> {
  const results: BadgeAwardResult[] = [];

  try {
    const badges = await prisma.badge.findMany({
      where: {
        triggerType,
        isActive: true
      }
    });

    for (const badge of badges) {
      const shouldAward = await checkBadgeRequirement(userId, badge);
      
      if (shouldAward) {
        const result = await awardBadge(userId, badge.slug);
        results.push(result);
      }
    }

    return results;
  } catch (error) {
    console.error('Check and award badges error:', error);
    return results;
  }
}

async function checkBadgeRequirement(userId: string, badge: any): Promise<boolean> {
  const triggerValue = badge.triggerValue || 1;

  switch (badge.triggerType) {
    case BadgeTrigger.ACCOUNT_CREATED:
      return true;

    case BadgeTrigger.GROUP_JOINED:
      const groupCount = await prisma.groupMember.count({
        where: { userId, status: 'ACTIVE' }
      });
      return groupCount >= triggerValue;

    case BadgeTrigger.DAYS_CAMPED:
      const stays = await prisma.stay.findMany({
        where: { userId },
        select: { startDate: true, endDate: true }
      });
      
      let totalDays = 0;
      for (const stay of stays) {
        const start = new Date(stay.startDate);
        const end = new Date(stay.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        totalDays += days;
      }
      return totalDays >= triggerValue;

    case BadgeTrigger.WEEKEND_STAYS:
      const allStays = await prisma.stay.findMany({
        where: { userId },
        select: { startDate: true, endDate: true }
      });
      
      let weekendStays = 0;
      for (const stay of allStays) {
        if (includesWeekend(new Date(stay.startDate), new Date(stay.endDate))) {
          weekendStays++;
        }
      }
      return weekendStays >= triggerValue;

    case BadgeTrigger.FRIENDS_COUNT:
      const friendCount = await prisma.friendship.count({
        where: {
          OR: [
            { initiatorId: userId, status: 'ACCEPTED' },
            { receiverId: userId, status: 'ACCEPTED' }
          ]
        }
      });
      return friendCount >= triggerValue;

    case BadgeTrigger.RECIPES_SHARED:
      const recipeCount = await prisma.recipe.count({
        where: { userId, privacy: 'PUBLIC' }
      });
      return recipeCount >= triggerValue;

    case BadgeTrigger.STATES_VISITED:
      const statesCount = await prisma.stateVisit.groupBy({
        by: ['state'],
        where: { userId }
      });
      return statesCount.length >= triggerValue;

    case BadgeTrigger.REVIEWS_WRITTEN:
      const reviewCount = await prisma.campgroundReview.count({
        where: { userId }
      });
      return reviewCount >= triggerValue;

    case BadgeTrigger.POSTS_CREATED:
      const postCount = await prisma.post.count({
        where: { userId }
      });
      return postCount >= triggerValue;

    case BadgeTrigger.TRIPS_CREATED:
      const tripCount = await prisma.event.count({
        where: { organizerId: userId }
      });
      return tripCount >= triggerValue;

    case BadgeTrigger.GEAR_ITEMS:
      const gearCount = await prisma.gearItem.count({
        where: { userId }
      });
      return gearCount >= triggerValue;

    default:
      return false;
  }
}

function includesWeekend(startDate: Date, endDate: Date): boolean {
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day === 0 || day === 5 || day === 6) {
      return true;
    }
    current.setDate(current.getDate() + 1);
  }
  return false;
}

export async function getBadgeProgress(userId: string, badgeSlug: string): Promise<{ current: number; required: number; percentage: number }> {
  const badge = await prisma.badge.findUnique({
    where: { slug: badgeSlug }
  });

  if (!badge) {
    return { current: 0, required: 0, percentage: 0 };
  }

  const required = badge.triggerValue || 1;
  let current = 0;

  switch (badge.triggerType) {
    case BadgeTrigger.DAYS_CAMPED:
      const stays = await prisma.stay.findMany({
        where: { userId },
        select: { startDate: true, endDate: true }
      });
      for (const stay of stays) {
        const start = new Date(stay.startDate);
        const end = new Date(stay.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        current += days;
      }
      break;

    case BadgeTrigger.WEEKEND_STAYS:
      const allStays = await prisma.stay.findMany({
        where: { userId },
        select: { startDate: true, endDate: true }
      });
      for (const stay of allStays) {
        if (includesWeekend(new Date(stay.startDate), new Date(stay.endDate))) {
          current++;
        }
      }
      break;

    case BadgeTrigger.FRIENDS_COUNT:
      current = await prisma.friendship.count({
        where: {
          OR: [
            { initiatorId: userId, status: 'ACCEPTED' },
            { receiverId: userId, status: 'ACCEPTED' }
          ]
        }
      });
      break;

    case BadgeTrigger.STATES_VISITED:
      const states = await prisma.stateVisit.groupBy({
        by: ['state'],
        where: { userId }
      });
      current = states.length;
      break;
  }

  const percentage = Math.min(100, Math.round((current / required) * 100));
  return { current, required, percentage };
}

export async function getUserBadges(userId: string) {
  const allBadges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
  });

  const earnedBadges = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true }
  });

  const earnedBadgeIds = new Set(earnedBadges.map(ub => ub.badgeId));

  return {
    earned: earnedBadges.map(ub => ({
      ...ub.badge,
      earnedAt: ub.earnedAt
    })),
    available: allBadges.filter(b => !earnedBadgeIds.has(b.id)),
    total: allBadges.length,
    earnedCount: earnedBadges.length
  };
}

export async function checkAllBadgesForUser(userId: string): Promise<BadgeAwardResult[]> {
  const allResults: BadgeAwardResult[] = [];

  for (const trigger of Object.values(BadgeTrigger)) {
    const results = await checkAndAwardBadges(userId, trigger as BadgeTrigger);
    allResults.push(...results);
  }

  return allResults.filter(r => r.awarded);
}

export default {
  awardBadge,
  checkAndAwardBadges,
  checkAllBadgesForUser,
  getBadgeProgress,
  getUserBadges,
  BadgeTrigger
};
