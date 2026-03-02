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
  STAYS_COUNT = 'STAYS_COUNT',
  PHOTOS_UPLOADED = 'PHOTOS_UPLOADED',
  ALBUMS_CREATED = 'ALBUMS_CREATED',
  TOP8_ADDED = 'TOP8_ADDED',
  RV_REGISTERED = 'RV_REGISTERED',
  MAINTENANCE_LOGGED = 'MAINTENANCE_LOGGED',
  FOUNDING_MEMBER = 'FOUNDING_MEMBER',
  UPVOTES_RECEIVED = 'UPVOTES_RECEIVED',
  POPULAR_RECIPES = 'POPULAR_RECIPES',
  LOCATION_BASED = 'LOCATION_BASED',
  REGION_BASED = 'REGION_BASED',
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

    try {
      await prisma.thread.create({
        data: {
          title: `🏆 Just earned the "${badge.name}" badge!`,
          content: badge.description || '',
          slug: `badge-${badge.slug}-${userId.slice(-6)}-${Date.now()}`,
          authorId: userId,
          imageUrl: badge.imageUrl,
        }
      });
    } catch (postError) {
      console.error('Failed to create badge thread:', postError);
    }

    // Send Hitch message celebrating the badge
    try {
      const badgeDescriptions: Record<string, string> = {
        'rvunicorn-member': 'You joined the RVUnicorn community — welcome to the herd!',
        'first-trip': 'You planned your first trip. The adventure begins!',
        'road-warrior': 'You have been on multiple trips and are racking up the miles.',
        'campfire-chef': 'You shared your first camp recipe with the community.',
        'social-butterfly': 'You made your first friend connection on RVUnicorn.',
        'explorer': 'You discovered and checked in at a campground.',
        'photographer': 'You uploaded photos to your first album.',
        'trail-blazer': 'You visited campgrounds across multiple states.',
        'top-rated': 'Your campground reviews are helping fellow RVers.',
        'community-voice': 'You have been an active voice in the RVUnicorn community.',
      };

      const reason = badgeDescriptions[badge.slug] || badge.description || 'You met all the requirements for this achievement.';

      const hitchMsg = [
        '&#x1F3C6; **You just earned the "' + badge.name + '" badge!** ' + (badge.icon || '') ,
        '',
        reason,
        '',
        'Badges are how RVUnicorn recognizes your adventures, contributions, and milestones. Each one tells a story about your journey in the camping community.',
        '',
        '**Did you know?** Campgrounds on RVUnicorn can also award their own exclusive badges to visitors — so next time you check in at a campground, keep an eye out for special campground badges you can earn just by being there.',
        '',
        'Want to see all the badges you can earn and track your progress? Check out your badge collection here: [View All Badges](https://www.rvunicorn.com/badges)',
        '',
        'Keep exploring, connecting, and sharing — there are plenty more badges waiting for you out on the road. &#x1F690;&#x2728;',
      ].join('\n');

      // Find or create a Hitch conversation for badge celebrations
      let conversation = await prisma.hitchConversation.findFirst({
        where: { userId, title: 'Your Badges & Achievements' }
      });

      if (!conversation) {
        conversation = await prisma.hitchConversation.create({
          data: {
            userId,
            title: 'Your Badges & Achievements',
            summary: 'Hitch celebrates badge milestones with the user.',
          }
        });
      }

      await prisma.hitchMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: hitchMsg,
        }
      });
    } catch (hitchErr) {
      console.error('Hitch badge message error (non-fatal):', hitchErr);
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

  try {
    switch (badge.triggerType) {
      case BadgeTrigger.ACCOUNT_CREATED:
        return true;

      case BadgeTrigger.GROUP_JOINED: {
        const groupCount = await prisma.groupMember.count({
          where: { userId, status: 'ACTIVE' }
        });
        return groupCount >= triggerValue;
      }

      case BadgeTrigger.STAYS_COUNT: {
        const stayCount = await prisma.stay.count({ where: { userId } });
        return stayCount >= triggerValue;
      }

      case BadgeTrigger.DAYS_CAMPED: {
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
      }

      case BadgeTrigger.WEEKEND_STAYS: {
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
      }

      case BadgeTrigger.FRIENDS_COUNT: {
        const friendCount = await prisma.friendship.count({
          where: {
            OR: [
              { initiatorId: userId, status: 'ACCEPTED' },
              { receiverId: userId, status: 'ACCEPTED' }
            ]
          }
        });
        return friendCount >= triggerValue;
      }

      case BadgeTrigger.RECIPES_SHARED: {
        const recipeCount = await prisma.recipe.count({
          where: { userId, privacy: 'PUBLIC' }
        });
        return recipeCount >= triggerValue;
      }

      case BadgeTrigger.STATES_VISITED: {
        const statesCount = await prisma.stateVisit.groupBy({
          by: ['state'],
          where: { userId }
        });
        return statesCount.length >= triggerValue;
      }

      case BadgeTrigger.REVIEWS_WRITTEN: {
        const reviewCount = await prisma.campgroundReview.count({
          where: { userId }
        });
        return reviewCount >= triggerValue;
      }

      case BadgeTrigger.POSTS_CREATED: {
        const postCount = await prisma.post.count({ where: { userId } });
        return postCount >= triggerValue;
      }

      case BadgeTrigger.TRIPS_CREATED: {
        const tripCount = await prisma.event.count({
          where: { organizerId: userId }
        });
        return tripCount >= triggerValue;
      }

      case BadgeTrigger.GEAR_ITEMS: {
        const gearCount = await prisma.gearItem.count({ where: { userId } });
        return gearCount >= triggerValue;
      }

      case BadgeTrigger.PHOTOS_UPLOADED: {
        const photoCount = await prisma.photo.count({ where: { userId } });
        return photoCount >= triggerValue;
      }

      case BadgeTrigger.ALBUMS_CREATED: {
        const albumCount = await prisma.album.count({ where: { userId } });
        return albumCount >= triggerValue;
      }

      case BadgeTrigger.TOP8_ADDED: {
        const top8Count = await prisma.topFriend.count({ where: { friendId: userId } });
        return top8Count >= triggerValue;
      }

      case BadgeTrigger.RV_REGISTERED: {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { rvType: true, rvYear: true, rvMake: true }
        });
        return !!(user?.rvType || user?.rvYear || user?.rvMake);
      }

      case BadgeTrigger.MAINTENANCE_LOGGED: {
        const maintCount = await prisma.maintenanceLog.count({ where: { userId } });
        return maintCount >= triggerValue;
      }

      case BadgeTrigger.FOUNDING_MEMBER: {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { createdAt: true }
        });
        if (!user) return false;
        const cutoff = new Date('2026-03-01');
        return user.createdAt < cutoff;
      }

      case BadgeTrigger.UPVOTES_RECEIVED: {
        const upvoteCount = await prisma.vote.count({
          where: { post: { userId }, value: 1 }
        });
        return upvoteCount >= triggerValue;
      }

      case BadgeTrigger.POPULAR_RECIPES: {
        const popularRecipes = await prisma.recipe.findMany({
          where: { userId, privacy: 'PUBLIC' },
          include: { _count: { select: { likes: true } } }
        });
        const qualifyingCount = popularRecipes.filter(r => r._count.likes >= 10).length;
        return qualifyingCount >= triggerValue;
      }

      case BadgeTrigger.LOCATION_BASED: {
        const badgeCampgrounds = await prisma.badgeCampground.findMany({
          where: { badgeId: badge.id },
          select: { campgroundId: true }
        });
        const campgroundIds = badgeCampgrounds.map(bc => bc.campgroundId);
        if (campgroundIds.length === 0) return false;

        const staysAtQualifying = await prisma.stay.findMany({
          where: {
            userId,
            campgroundId: { in: campgroundIds }
          },
          distinct: ['campgroundId']
        });
        return staysAtQualifying.length >= triggerValue;
      }

      case BadgeTrigger.REGION_BASED: {
        if (!badge.regionStates) return false;
        const requiredStates = badge.regionStates.split(',').map((s: string) => s.trim());

        const userStays = await prisma.stay.findMany({
          where: { userId },
          include: { campground: { select: { state: true } } }
        });

        const stayedStates = new Set(
          userStays.map(s => s.campground?.state).filter(Boolean)
        );

        const stateVisits = await prisma.stateVisit.findMany({
          where: { userId },
          select: { state: true }
        });
        stateVisits.forEach(sv => stayedStates.add(sv.state));

        const coveredStates = requiredStates.filter((state: string) => stayedStates.has(state));
        return coveredStates.length >= triggerValue;
      }

      default:
        console.log(`Unknown trigger type: ${badge.triggerType}`);
        return false;
    }
  } catch (error) {
    console.error(`Error checking badge requirement for ${badge.triggerType}:`, error);
    return false;
  }
}

function includesWeekend(startDate: Date, endDate: Date): boolean {
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day === 0 || day === 5 || day === 6) return true;
    current.setDate(current.getDate() + 1);
  }
  return false;
}

export async function getBadgesForCampground(campgroundId: string) {
  const locationBadges = await prisma.badgeCampground.findMany({
    where: { campgroundId },
    include: {
      badge: {
        select: { id: true, slug: true, name: true, imageUrl: true, description: true, triggerValue: true }
      }
    }
  });

  const campground = await prisma.campground.findUnique({
    where: { id: campgroundId },
    select: { state: true }
  });

  const regionBadges = campground?.state
    ? await prisma.badge.findMany({
        where: {
          triggerType: 'REGION_BASED',
          isActive: true,
          regionStates: { contains: campground.state }
        },
        select: { id: true, slug: true, name: true, imageUrl: true, description: true, triggerValue: true }
      })
    : [];

  return {
    locationBadges: locationBadges.map(lb => lb.badge),
    regionBadges,
    totalBadges: locationBadges.length + regionBadges.length
  };
}

export async function getLocationBadgeProgress(userId: string, badgeSlug: string) {
  const badge = await prisma.badge.findUnique({
    where: { slug: badgeSlug },
    include: {
      campgrounds: {
        include: {
          campground: { select: { id: true, name: true, state: true } }
        }
      }
    }
  });

  if (!badge) return null;

  if (badge.triggerType === 'LOCATION_BASED') {
    const campgrounds = badge.campgrounds.map(bc => bc.campground);
    const campgroundIds = campgrounds.map(c => c.id);

    const userStays = await prisma.stay.findMany({
      where: { userId, campgroundId: { in: campgroundIds } },
      distinct: ['campgroundId'],
      select: { campgroundId: true }
    });

    const visitedIds = new Set(userStays.map(s => s.campgroundId));

    return {
      badge: { slug: badge.slug, name: badge.name, imageUrl: badge.imageUrl },
      required: badge.triggerValue || 1,
      current: visitedIds.size,
      percentage: Math.min(100, Math.round((visitedIds.size / (badge.triggerValue || 1)) * 100)),
      campgrounds: campgrounds.map(c => ({ ...c, visited: visitedIds.has(c.id) }))
    };
  }

  if (badge.triggerType === 'REGION_BASED' && badge.regionStates) {
    const requiredStates = badge.regionStates.split(',').map((s: string) => s.trim());

    const userStays = await prisma.stay.findMany({
      where: { userId },
      include: { campground: { select: { state: true } } }
    });

    const stayedStates = new Set(
      userStays.map(s => s.campground?.state).filter(Boolean)
    );

    const stateVisits = await prisma.stateVisit.findMany({
      where: { userId },
      select: { state: true }
    });
    stateVisits.forEach(sv => stayedStates.add(sv.state));

    return {
      badge: { slug: badge.slug, name: badge.name, imageUrl: badge.imageUrl },
      required: badge.triggerValue || requiredStates.length,
      current: requiredStates.filter((s: string) => stayedStates.has(s)).length,
      percentage: Math.min(100, Math.round(
        (requiredStates.filter((s: string) => stayedStates.has(s)).length / (badge.triggerValue || requiredStates.length)) * 100
      )),
      states: requiredStates.map((state: string) => ({ state, visited: stayedStates.has(state) }))
    };
  }

  return null;
}

export async function getBadgeProgress(userId: string, badgeSlug: string): Promise<{ current: number; required: number; percentage: number }> {
  const badge = await prisma.badge.findUnique({ where: { slug: badgeSlug } });
  if (!badge) return { current: 0, required: 0, percentage: 0 };

  if (badge.triggerType === 'LOCATION_BASED' || badge.triggerType === 'REGION_BASED') {
    const progress = await getLocationBadgeProgress(userId, badgeSlug);
    if (progress) return { current: progress.current, required: progress.required, percentage: progress.percentage };
    return { current: 0, required: badge.triggerValue || 1, percentage: 0 };
  }

  const required = badge.triggerValue || 1;
  let current = 0;

  try {
    switch (badge.triggerType) {
      case BadgeTrigger.STAYS_COUNT:
        current = await prisma.stay.count({ where: { userId } }); break;
      case BadgeTrigger.DAYS_CAMPED: {
        const stays = await prisma.stay.findMany({ where: { userId }, select: { startDate: true, endDate: true } });
        for (const stay of stays) {
          const start = new Date(stay.startDate);
          const end = new Date(stay.endDate);
          current += Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
        break;
      }
      case BadgeTrigger.WEEKEND_STAYS: {
        const allStays = await prisma.stay.findMany({ where: { userId }, select: { startDate: true, endDate: true } });
        for (const stay of allStays) {
          if (includesWeekend(new Date(stay.startDate), new Date(stay.endDate))) current++;
        }
        break;
      }
      case BadgeTrigger.FRIENDS_COUNT:
        current = await prisma.friendship.count({
          where: { OR: [{ initiatorId: userId, status: 'ACCEPTED' }, { receiverId: userId, status: 'ACCEPTED' }] }
        }); break;
      case BadgeTrigger.STATES_VISITED: {
        const states = await prisma.stateVisit.groupBy({ by: ['state'], where: { userId } });
        current = states.length; break;
      }
      case BadgeTrigger.POSTS_CREATED:
        current = await prisma.post.count({ where: { userId } }); break;
      case BadgeTrigger.RECIPES_SHARED:
        current = await prisma.recipe.count({ where: { userId, privacy: 'PUBLIC' } }); break;
      case BadgeTrigger.REVIEWS_WRITTEN:
        current = await prisma.campgroundReview.count({ where: { userId } }); break;
      case BadgeTrigger.TRIPS_CREATED:
        current = await prisma.event.count({ where: { organizerId: userId } }); break;
      case BadgeTrigger.PHOTOS_UPLOADED:
        current = await prisma.photo.count({ where: { userId } }); break;
      case BadgeTrigger.ALBUMS_CREATED:
        current = await prisma.album.count({ where: { userId } }); break;
      case BadgeTrigger.TOP8_ADDED:
        current = await prisma.topFriend.count({ where: { friendId: userId } }); break;
      case BadgeTrigger.MAINTENANCE_LOGGED:
        current = await prisma.maintenanceLog.count({ where: { userId } }); break;
      case BadgeTrigger.UPVOTES_RECEIVED:
        current = await prisma.vote.count({ where: { post: { userId }, value: 1 } }); break;
      case BadgeTrigger.POPULAR_RECIPES: {
        const popRecipes = await prisma.recipe.findMany({
          where: { userId, privacy: 'PUBLIC' },
          include: { _count: { select: { likes: true } } }
        });
        current = popRecipes.filter(r => r._count.likes >= 10).length;
        break;
      }
      case BadgeTrigger.GROUP_JOINED:
        current = await prisma.groupMember.count({ where: { userId, status: 'ACTIVE' } }); break;
      case BadgeTrigger.GEAR_ITEMS:
        current = await prisma.gearItem.count({ where: { userId } }); break;
    }
  } catch (error) {
    console.error(`Error getting progress for ${badge.triggerType}:`, error);
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
    earned: earnedBadges.map(ub => ({ ...ub.badge, earnedAt: ub.earnedAt })),
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
  getBadgesForCampground,
  getLocationBadgeProgress,
  BadgeTrigger
};
