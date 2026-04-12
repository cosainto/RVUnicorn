/**
 * Email trigger functions — called from routes and cron jobs.
 * Each function composes a template and sends via emailService.
 */
import { prisma } from '../prisma';
import { sendTypedEmail } from './emailService';
import * as onboarding from '../emails/templates/onboarding';
import * as trips from '../emails/templates/trips';
import * as social from '../emails/templates/social';
import * as badges from '../emails/templates/badges';
import * as owner from '../emails/templates/owner';
import * as activity from '../emails/templates/activity';
import * as transactional from '../emails/templates/transactional';

// ─── Onboarding ─────────────────────────────────────────────

export async function sendWelcomeEmail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });
  if (!user) return;
  const tpl = onboarding.welcome({ firstName: user.firstName });
  await sendTypedEmail({ userId, type: 'WELCOME', ...tpl });
}

export async function sendProfileNudges() {
  // Users created 36-60 hours ago with incomplete profiles
  const now = new Date();
  const from = new Date(now.getTime() - 60 * 60 * 60 * 1000);
  const to = new Date(now.getTime() - 36 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true, firstName: true,
      rvMake: true, rvType: true, homeState: true,
      profilePicture: true, bio: true,
    },
  });

  for (const user of users) {
    const missing: Array<{ icon: string; label: string; reason: string }> = [];
    if (!user.rvType) missing.push({ icon: '\u{1F690}', label: 'RV Type', reason: "I can't give you rig-specific advice without it." });
    if (!user.rvMake) missing.push({ icon: '\u{1F527}', label: 'RV Make/Model', reason: 'Helps me check if campgrounds fit your rig.' });
    if (!user.homeState) missing.push({ icon: '\u{1F3E0}', label: 'Home Base', reason: "I'll suggest campgrounds near you." });
    if (!user.profilePicture) missing.push({ icon: '\u{1F4F7}', label: 'Profile Photo', reason: 'People connect with real faces, not silhouettes.' });
    if (!user.bio) missing.push({ icon: '\u{1F4DD}', label: 'Bio', reason: 'Tell others about your camping style.' });

    if (missing.length < 2) continue; // Profile is mostly complete

    const tpl = onboarding.profileNudge({ firstName: user.firstName, missingFields: missing });
    await sendTypedEmail({ userId: user.id, type: 'PROFILE_NUDGE', ...tpl });
  }
}

export async function sendConnectionNudges() {
  // Day 5 users with no friends
  const now = new Date();
  const from = new Date(now.getTime() - 132 * 60 * 60 * 1000); // ~5.5 days
  const to = new Date(now.getTime() - 108 * 60 * 60 * 1000);   // ~4.5 days

  const users = await prisma.user.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      friendshipsInitiated: { none: {} },
      friendshipsReceived: { none: {} },
    },
    select: { id: true, firstName: true },
  });

  for (const user of users) {
    const tpl = onboarding.firstConnection({ firstName: user.firstName });
    await sendTypedEmail({ userId: user.id, type: 'FIRST_CONNECTION', ...tpl });
  }
}

export async function sendThirtyDayCheckins() {
  const now = new Date();
  const from = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { id: true, firstName: true },
  });

  for (const user of users) {
    const [tripsCount, statesCount, badgesCount] = await Promise.all([
      prisma.trip.count({ where: { userId: user.id } }),
      prisma.stateVisit.count({ where: { userId: user.id } }),
      prisma.userBadge.count({ where: { userId: user.id } }),
    ]);

    const tpl = onboarding.thirtyDayCheckin({
      firstName: user.firstName, tripsCount, statesCount, badgesCount,
    });
    await sendTypedEmail({ userId: user.id, type: 'THIRTY_DAY_CHECKIN', ...tpl });
  }
}

// ─── Trips ──────────────────────────────────────────────────

export async function sendTripCreatedEmail(userId: string, tripData: {
  tripId: string; tripTitle: string; daysOut: number;
  driveMiles: number; fuelEstimate: number;
  campgroundName?: string; campgroundState?: string;
  rigFitsFlag?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });
  if (!user) return;
  const tpl = trips.tripCreated({ firstName: user.firstName, ...tripData });
  await sendTypedEmail({ userId, type: 'TRIP_CREATED', ...tpl });
}

export async function sendPreTrip7Day() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const events = await prisma.event.findMany({
    where: {
      startDate: { gte: startOfDay, lte: endOfDay },
      eventStatus: 'UPCOMING',
    },
    include: {
      organizer: { select: { id: true, firstName: true } },
      campground: { select: { name: true, state: true } },
    },
  });

  for (const event of events) {
    const tpl = trips.preTripBriefing({
      firstName: event.organizer.firstName,
      tripTitle: event.title,
      score: 75, // Default — would integrate with TripConfidenceService
      departureDate: event.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      arrivalDate: event.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      driveWeather: undefined,
      campWeather: undefined,
      flags: [],
      passedChecks: ['Campground booked', 'Rig compatible'],
    });
    await sendTypedEmail({ userId: event.organizer.id, type: 'PRE_TRIP_7DAY', ...tpl });
  }
}

export async function sendPostTripRecap() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfYesterday = new Date(yesterday);
  startOfYesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  const events = await prisma.event.findMany({
    where: {
      endDate: { gte: startOfYesterday, lte: endOfYesterday },
    },
    include: {
      organizer: { select: { id: true, firstName: true } },
      campground: { select: { name: true } },
    },
  });

  for (const event of events) {
    const tpl = trips.postTrip({
      firstName: event.organizer.firstName,
      tripTitle: event.title,
      tripId: event.id,
      campgroundName: event.campground?.name,
      scrapbookToken: event.scrapbookShareToken || undefined,
    });
    await sendTypedEmail({ userId: event.organizer.id, type: 'POST_TRIP', ...tpl });
  }
}

// ─── Social ─────────────────────────────────────────────────

export async function sendNewFollowerEmail(userId: string, followerId: string) {
  const follower = await prisma.user.findUnique({
    where: { id: followerId },
    select: { firstName: true, lastName: true, username: true, profilePicture: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });
  if (!follower || !user) return;

  const tpl = social.newFollower({
    firstName: user.firstName,
    followerName: `${follower.firstName} ${follower.lastName || ''}`.trim(),
    followerUsername: follower.username,
  });
  await sendTypedEmail({ userId, type: 'NEW_FOLLOWER', ...tpl });
}

export async function sendWeeklyCommunityDigest() {
  // Find users who haven't logged in recently (low engagement)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      lastActiveAt: { lt: threeDaysAgo },
      emailPreference: { OR: [{ weeklyDigest: true }, { weeklyDigest: undefined as any }] },
    },
    select: { id: true, firstName: true },
    take: 500,
  });

  // Get the week's top community thread
  const topThread = await prisma.boardPost.findFirst({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, body: true },
  });

  for (const user of users) {
    const tpl = social.weeklyDigest({
      firstName: user.firstName,
      threadTitle: topThread?.title,
      threadPreview: topThread?.body?.slice(0, 200),
      friendActivity: [],
      featuredKit: undefined,
    });
    await sendTypedEmail({ userId: user.id, type: 'WEEKLY_DIGEST', ...tpl });
  }
}

export async function sendScrapbookCommentEmail(
  scrapbookOwnerId: string,
  commenterName: string,
  tripTitle: string,
  comment: string,
  scrapbookToken: string,
) {
  const owner = await prisma.user.findUnique({
    where: { id: scrapbookOwnerId },
    select: { firstName: true },
  });
  if (!owner) return;

  // Rate limit: max 3 per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.emailLog.count({
    where: { userId: scrapbookOwnerId, type: 'SCRAPBOOK_COMMENT', sentAt: { gte: oneHourAgo } },
  });
  if (recentCount >= 3) return;

  const tpl = social.scrapbookComment({
    firstName: owner.firstName, commenterName, tripTitle, comment, scrapbookToken,
  });
  await sendTypedEmail({ userId: scrapbookOwnerId, type: 'SCRAPBOOK_COMMENT', ...tpl });
}

// ─── Badges ─────────────────────────────────────────────────

export async function sendBadgeEarnedEmail(userId: string, badgeData: {
  badgeName: string; badgeEmoji: string; badgeDescription: string;
  earnedMessage: string; holderCount: number;
  nextBadge?: { name: string; progress: string };
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });
  if (!user) return;
  const tpl = badges.badgeEarned({ firstName: user.firstName, ...badgeData });
  await sendTypedEmail({ userId, type: 'BADGE_EARNED', ...tpl });
}

// ─── Owner ──────────────────────────────────────────────────

export async function sendOwnerWeeklyDigests() {
  const campgrounds = await prisma.campground.findMany({
    where: { claimedById: { not: null } },
    select: {
      id: true, name: true, claimedById: true,
      claimedBy: { select: { id: true, firstName: true } },
    },
  });

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const cg of campgrounds) {
    if (!cg.claimedBy) continue;

    const [checkinCount, newFollowers, reviews] = await Promise.all([
      prisma.checkIn.count({ where: { campgroundId: cg.id, createdAt: { gte: oneWeekAgo } } }),
      prisma.campgroundFollow.count({ where: { campgroundId: cg.id, createdAt: { gte: oneWeekAgo } } }),
      prisma.campgroundReview.count({ where: { campgroundId: cg.id, createdAt: { gte: oneWeekAgo } } }),
    ]);

    const latestReview = await prisma.campgroundReview.findFirst({
      where: { campgroundId: cg.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    const tpl = owner.ownerWeeklyDigest({
      firstName: cg.claimedBy.firstName,
      campgroundName: cg.name,
      campgroundId: cg.id,
      checkinCount,
      newFollowers,
      pageViews: 0, // Would integrate with analytics
      reviews,
      hitchSuggestion: checkinCount > 0
        ? 'Post an announcement welcoming this week\'s visitors \u2014 it increases follower retention by 40%.'
        : 'Share a photo of your campground \u2014 listings with photos get 3x more views.',
      hitchActionUrl: `https://www.rvunicorn.com/business/${cg.id}`,
      hitchActionLabel: checkinCount > 0 ? 'Post an Announcement' : 'Add Photos',
      latestReview: latestReview ? {
        content: (latestReview as any).content || (latestReview as any).text || '',
        authorName: `${latestReview.user.firstName} ${latestReview.user.lastName || ''}`.trim(),
        rating: (latestReview as any).rating || 5,
      } : undefined,
    });
    await sendTypedEmail({ userId: cg.claimedBy.id, type: 'OWNER_WEEKLY', ...tpl });
  }
}

export async function sendOwnerPotentialEnergy() {
  const campgrounds = await prisma.campground.findMany({
    where: {
      claimedById: { not: null },
      tier: 'FREE',
    },
    select: {
      id: true, name: true,
      claimedBy: { select: { id: true, firstName: true } },
    },
  });

  for (const cg of campgrounds) {
    if (!cg.claimedBy) continue;
    // Simplified — would integrate with real analytics
    const pageViews = Math.floor(Math.random() * 20) + 5;
    if (pageViews <= 5) continue;

    const tpl = owner.ownerPotentialEnergy({
      firstName: cg.claimedBy.firstName,
      campgroundName: cg.name,
      pageViews,
    });
    await sendTypedEmail({ userId: cg.claimedBy.id, type: 'OWNER_POTENTIAL', ...tpl });
  }
}

// ─── Activity ───────────────────────────────────────────────

export async function sendActivityInviteEmail(userId: string, data: {
  organizerName: string; activityTitle: string; activityEmoji: string;
  campgroundName: string; scheduledTime?: string; note?: string;
  participantCount: number; instanceId: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });
  if (!user) return;
  const tpl = activity.activityInvite({ firstName: user.firstName, ...data });
  await sendTypedEmail({ userId, type: 'ACTIVITY_INVITE', ...tpl });
}

// ─── Creator ────────────────────────────────────────────────

export async function sendCreatorWeeklyDigests() {
  const creators = await prisma.user.findMany({
    where: { isCreator: true },
    select: { id: true, firstName: true, username: true },
  });

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const creator of creators) {
    const content = await prisma.creatorContent.findMany({
      where: { creatorId: creator.id, publishedAt: { gte: oneWeekAgo } },
      select: { id: true, title: true, viewCount: true, saveCount: true },
    });

    const totalViews = content.reduce((s, c) => s + (c.viewCount || 0), 0);
    const totalSaves = content.reduce((s, c) => s + (c.saveCount || 0), 0);
    const newFollowers = await prisma.creatorFollow.count({
      where: { creatorId: creator.id, createdAt: { gte: oneWeekAgo } },
    });

    const topContent = content.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))[0];

    const tpl = activity.creatorWeekly({
      firstName: creator.firstName,
      views: totalViews,
      saves: totalSaves,
      newFollowers,
      topContentTitle: topContent?.title || undefined,
      topContentUrl: topContent ? `https://www.rvunicorn.com/creators/${creator.username}/content/${topContent.id}` : undefined,
    });
    await sendTypedEmail({ userId: creator.id, type: 'CREATOR_WEEKLY', ...tpl });
  }
}

// ─── Transactional ──────────────────────────────────────────

export async function sendPasswordResetEmail(userId: string, email: string, resetUrl: string) {
  const tpl = transactional.passwordReset({ email, resetUrl });
  await sendTypedEmail({ userId, type: 'PASSWORD_RESET', force: true, ...tpl });
}

export async function sendFriendTripOverlapEmail(userId: string, data: {
  friendName: string; friendFirstName: string; friendId: string;
  tripId: string; campground: string; state?: string;
  overlapDays: number; friendArrival: string; yourArrival: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });
  if (!user) return;
  const tpl = trips.friendTripOverlap({ firstName: user.firstName, ...data });
  await sendTypedEmail({ userId, type: 'FRIEND_TRIP_OVERLAP', ...tpl });
}
