/**
 * Email Frequency Control System
 *
 * Hard limits:
 *   - Max 1 email per user per day (non-digest)
 *   - Max 2 emails per user per week
 *   - Max 2 marketing/promotional emails per month
 *
 * Priority tiers:
 *   CRITICAL — always sends, bypasses all limits
 *   HIGH     — max 1/day, respects daily cap
 *   MEDIUM   — never sent individually, queued for daily digest
 *   LOW      — never sent individually, queued for weekly digest
 */
import { prisma } from '../prisma';

// ─── Priority tiers ─────────────────────────────────────────

export type EmailPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// Map every email type to its priority tier
export const EMAIL_PRIORITY: Record<string, EmailPriority> = {
  // CRITICAL — always send, bypass all limits
  PASSWORD_RESET:    'CRITICAL',
  EMAIL_CHANGE:      'CRITICAL',
  ACCOUNT_DELETED:   'CRITICAL',
  SMS_CONFIRMED:     'CRITICAL',

  // HIGH — max 1/day, respects daily cap
  PRE_TRIP_7DAY:     'HIGH',
  PRE_TRIP_48HR:     'HIGH',
  FRIEND_REQUEST:    'HIGH',
  MENTION:           'HIGH',
  EVENT_INVITE:      'HIGH',
  ACTIVITY_INVITE:   'HIGH',
  FRIEND_TRIP_OVERLAP: 'HIGH',

  // MEDIUM — batch into daily digest
  NEW_FOLLOWER:      'MEDIUM',
  LIKE:              'MEDIUM',
  SCRAPBOOK_COMMENT: 'MEDIUM',
  COMMENT_ADDED:     'MEDIUM',
  COMMUNITY_REPLY:   'MEDIUM',
  BADGE_EARNED:      'MEDIUM',
  REVIEW_PUBLISHED:  'MEDIUM',
  REVIEW_RESPONSE:   'MEDIUM',
  REVIEW_HELPFUL:    'MEDIUM',
  SCRAPBOOK_VIEWED:  'MEDIUM',
  TRIP_CREATED:      'MEDIUM',
  POST_TRIP:         'MEDIUM',
  WELCOME:           'MEDIUM',
  PROFILE_NUDGE:     'MEDIUM',
  FIRST_CONNECTION:  'MEDIUM',
  THIRTY_DAY_CHECKIN:'MEDIUM',
  FIRST_CHECKIN:     'MEDIUM',
  BADGE_CLOSE:       'MEDIUM',
  TRIP_ANNIVERSARY:  'MEDIUM',
  SCRAPBOOK_PDF:     'MEDIUM',
  FIRST_CONTENT:     'MEDIUM',
  TRIP_KIT_SAVED:    'MEDIUM',
  TRIP_KIT_USED:     'MEDIUM',
  NOTE_ADDED:        'MEDIUM',
  CHECKLIST_ASSIGNED:'MEDIUM',
  CHECKLIST_COMPLETED:'MEDIUM',
  CAMPGROUND_ADDED:  'MEDIUM',
  RSVP_CHANGE:       'MEDIUM',
  EVENT_UPDATE:       'MEDIUM',
  OWNER_NEW_REVIEW:  'MEDIUM',
  OWNER_NEW_FOLLOWER:'MEDIUM',
  OWNER_ARRIVING:    'MEDIUM',
  OWNER_BROADCAST:   'MEDIUM',

  // LOW — weekly digest only
  WEEKLY_DIGEST:     'LOW',
  INACTIVITY:        'LOW',
  FEATURE_DISCOVERY: 'LOW',
  OWNER_WEEKLY:      'LOW',
  OWNER_POTENTIAL:   'LOW',
  OWNER_LOW_ENGAGE:  'LOW',
  OWNER_POST_EVENT:  'LOW',
  CREATOR_WEEKLY:    'LOW',
  ACTIVITY_DIGEST:   'LOW',
  // Drip campaign emails
  DRIP_WELCOME:      'LOW',
  DRIP_COMMUNITY:    'LOW',
  DRIP_SOCIAL:       'LOW',
  DRIP_TRIVIA:       'LOW',
  DRIP_FIRST_TRIP:   'LOW',
  // Social proof notifications
  CAMPGROUND_ALSO_FAVORITED: 'LOW',
  RIG_PHOTOS_AT_FAVORITE:    'MEDIUM',
};

// ─── Frequency limits ───────────────────────────────────────

const MAX_EMAILS_PER_DAY = 1;
const MAX_EMAILS_PER_WEEK = 2;
const MAX_MARKETING_PER_MONTH = 2;

const MARKETING_TYPES = new Set([
  'WEEKLY_DIGEST', 'INACTIVITY', 'FEATURE_DISCOVERY',
  'OWNER_POTENTIAL', 'OWNER_LOW_ENGAGE', 'OWNER_POST_EVENT',
  'DRIP_WELCOME', 'DRIP_COMMUNITY', 'DRIP_SOCIAL', 'DRIP_TRIVIA', 'DRIP_FIRST_TRIP',
]);

// ─── Helper: count emails in time window ────────────────────

async function countEmailsSince(userId: string, since: Date, excludeDigest = false): Promise<number> {
  return prisma.emailLog.count({
    where: {
      userId,
      sentAt: { gte: since },
      ...(excludeDigest ? { wasDigest: false } : {}),
    },
  });
}

async function countMarketingSince(userId: string, since: Date): Promise<number> {
  return prisma.emailLog.count({
    where: {
      userId,
      sentAt: { gte: since },
      type: { in: Array.from(MARKETING_TYPES) },
    },
  });
}

// ─── canSendEmail ───────────────────────────────────────────

export interface ThrottleResult {
  canSend: boolean;
  reason: string;
  queueForDigest: boolean;
  digestType?: 'DAILY' | 'WEEKLY';
  priority: EmailPriority;
}

export async function canSendEmail(
  userId: string,
  emailType: string,
): Promise<ThrottleResult> {
  const priority = EMAIL_PRIORITY[emailType] || 'MEDIUM';

  // CRITICAL always sends
  if (priority === 'CRITICAL') {
    return { canSend: true, reason: 'Critical email — bypasses all limits', queueForDigest: false, priority };
  }

  // MEDIUM and LOW never send individually — always queue
  if (priority === 'MEDIUM') {
    return { canSend: false, reason: 'Medium priority — queued for daily digest', queueForDigest: true, digestType: 'DAILY', priority };
  }
  if (priority === 'LOW') {
    return { canSend: false, reason: 'Low priority — queued for weekly digest', queueForDigest: true, digestType: 'WEEKLY', priority };
  }

  // HIGH — check daily and weekly caps
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const [sentToday, sentThisWeek] = await Promise.all([
    countEmailsSince(userId, todayStart, true),
    countEmailsSince(userId, weekStart, true),
  ]);

  if (sentToday >= MAX_EMAILS_PER_DAY) {
    return { canSend: false, reason: `Daily limit reached (${sentToday}/${MAX_EMAILS_PER_DAY})`, queueForDigest: true, digestType: 'DAILY', priority };
  }

  if (sentThisWeek >= MAX_EMAILS_PER_WEEK) {
    return { canSend: false, reason: `Weekly limit reached (${sentThisWeek}/${MAX_EMAILS_PER_WEEK})`, queueForDigest: true, digestType: 'DAILY', priority };
  }

  // Marketing sub-limit
  if (MARKETING_TYPES.has(emailType)) {
    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 30);
    const marketingCount = await countMarketingSince(userId, monthStart);
    if (marketingCount >= MAX_MARKETING_PER_MONTH) {
      return { canSend: false, reason: `Monthly marketing limit reached (${marketingCount}/${MAX_MARKETING_PER_MONTH})`, queueForDigest: true, digestType: 'WEEKLY', priority };
    }
  }

  return { canSend: true, reason: 'Within limits', queueForDigest: false, priority };
}

// ─── queueForDigest ─────────────────────────────────────────

export async function queueForDigest(
  userId: string,
  digestType: 'DAILY' | 'WEEKLY',
  contentType: string,
  contentData: Record<string, any>,
): Promise<void> {
  await prisma.emailDigestQueue.create({
    data: {
      userId,
      digestType,
      contentType,
      contentData,
    },
  });
  console.log(`[EmailThrottle] Queued ${contentType} for ${digestType} digest for user ${userId}`);
}

// ─── getPendingDigestItems ──────────────────────────────────

export async function getPendingDigestItems(
  userId: string,
  digestType: 'DAILY' | 'WEEKLY',
) {
  return prisma.emailDigestQueue.findMany({
    where: {
      userId,
      digestType,
      includedInDigestAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });
}

// ─── markDigestItemsSent ────────────────────────────────────

export async function markDigestItemsSent(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  await prisma.emailDigestQueue.updateMany({
    where: { id: { in: itemIds } },
    data: { includedInDigestAt: new Date() },
  });
}
