import { Resend } from 'resend';
import { nanoid } from 'nanoid';
import { prisma } from '../prisma';
import { baseTemplate } from '../emails/baseTemplate';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Hitch at RVUnicorn <hitch@updates.rvunicorn.com>';
const APP_URL = process.env.APP_URL || 'https://www.rvunicorn.com';

// ─── Type → Preference field mapping ────────────────────────

const TYPE_TO_PREF: Record<string, string | null> = {
  WELCOME:              'onboardingEmails',
  PROFILE_NUDGE:        'onboardingEmails',
  FIRST_CONNECTION:     'onboardingEmails',
  FEATURE_DISCOVERY:    'onboardingEmails',
  THIRTY_DAY_CHECKIN:   'onboardingEmails',
  INACTIVITY:           'onboardingEmails',
  TRIP_CREATED:         'tripConfirmation',
  PRE_TRIP_7DAY:        'tripPreDeparture',
  PRE_TRIP_48HR:        'tripPreDeparture',
  POST_TRIP:            'tripPostReturn',
  FIRST_CHECKIN:        'onboardingEmails',
  NEW_FOLLOWER:         'newFollower',
  FRIEND_TRIP_OVERLAP:  'friendTripOverlap',
  COMMUNITY_REPLY:      'communityReplies',
  WEEKLY_DIGEST:        'weeklyDigest',
  SCRAPBOOK_VIEWED:     'scrapbookViewed',
  SCRAPBOOK_COMMENT:    'scrapbookComments',
  TRIP_ANNIVERSARY:     'tripAnniversary',
  SCRAPBOOK_PDF:        'scrapbookExport',
  REVIEW_PUBLISHED:     'reviewPublished',
  REVIEW_RESPONSE:      'reviewResponse',
  REVIEW_HELPFUL:       'reviewHelpful',
  BADGE_EARNED:         'badgeEarned',
  BADGE_CLOSE:          'badgeClose',
  CREATOR_WEEKLY:       'creatorWeeklyDigest',
  TRIP_KIT_SAVED:       'tripKitSaved',
  TRIP_KIT_USED:        'tripKitUsed',
  FIRST_CONTENT:        'firstContentPublished',
  ACTIVITY_INVITE:      'activityInvite',
  ACTIVITY_DIGEST:      'activityDigest',
  OWNER_WEEKLY:         'ownerWeeklyDigest',
  OWNER_NEW_REVIEW:     'ownerNewReview',
  OWNER_NEW_FOLLOWER:   'ownerNewFollower',
  OWNER_ARRIVING:       'ownerGuestArriving',
  OWNER_LOW_ENGAGE:     'ownerLowEngagement',
  OWNER_POST_EVENT:     'ownerPostEvent',
  OWNER_BROADCAST:      'ownerBroadcastConfirm',
  OWNER_POTENTIAL:      'ownerPotentialEnergy',
  // Transactional — always force: true, no preference check
  PASSWORD_RESET:       null,
  EMAIL_CHANGE:         null,
  ACCOUNT_DELETED:      null,
  SMS_CONFIRMED:        null,
};

// ─── Unsubscribe token helper ───────────────────────────────

async function getOrCreateUnsubToken(userId: string): Promise<string> {
  const existing = await prisma.emailUnsubscribeToken.findFirst({
    where: { userId, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing.token;

  const token = nanoid(20);
  await prisma.emailUnsubscribeToken.create({
    data: { userId, token },
  });
  return token;
}

// ─── Preference check ───────────────────────────────────────

async function canSendEmail(userId: string, type: string): Promise<boolean> {
  const prefField = TYPE_TO_PREF[type];
  // Transactional emails (null mapping) always send
  if (prefField === null) return true;
  // Unknown type — send by default
  if (prefField === undefined) return true;

  let prefs = await prisma.emailPreference.findUnique({ where: { userId } });
  if (!prefs) {
    // Create default preferences
    prefs = await prisma.emailPreference.create({ data: { userId } });
  }

  // Global kill switch
  if (!prefs.allEmails) return false;

  // Check specific preference
  const allowed = (prefs as any)[prefField];
  if (allowed === false) return false;

  return true;
}

// ─── Rate limit check ───────────────────────────────────────

async function isRateLimited(userId: string): Promise<boolean> {
  let prefs = await prisma.emailPreference.findUnique({
    where: { userId },
    select: { maxEmailsPerDay: true },
  });
  const maxPerDay = prefs?.maxEmailsPerDay ?? 2;
  if (maxPerDay <= 0) return false; // unlimited

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sentToday = await prisma.emailLog.count({
    where: { userId, sentAt: { gte: todayStart } },
  });

  return sentToday >= maxPerDay;
}

// ─── Core send function ─────────────────────────────────────

interface SendEmailOptions {
  userId: string;
  type: string;
  subject: string;
  bodyHtml: string;
  previewText?: string;
  force?: boolean; // true = transactional, skip preference & rate checks
}

export async function sendTypedEmail({
  userId,
  type,
  subject,
  bodyHtml,
  previewText,
  force = false,
}: SendEmailOptions): Promise<boolean> {
  try {
    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    if (!user?.email) {
      console.log(`[EmailService] No email for user ${userId}, skipping`);
      return false;
    }

    // Preference check (skip for transactional)
    if (!force) {
      const allowed = await canSendEmail(userId, type);
      if (!allowed) {
        console.log(`[EmailService] User ${userId} opted out of ${type}`);
        return false;
      }

      // Rate limit check
      const limited = await isRateLimited(userId);
      if (limited) {
        console.log(`[EmailService] Rate limited for user ${userId}`);
        return false;
      }
    }

    // Get unsubscribe token
    const unsubToken = force ? undefined : await getOrCreateUnsubToken(userId);

    // Wrap in base template
    const finalHtml = baseTemplate({
      previewText,
      body: bodyHtml,
      emailType: type,
      unsubscribeToken: unsubToken,
      showUnsubscribe: !force,
    });

    // Send via Resend
    const result: any = await resend.emails.send({
      from: FROM,
      to: user.email,
      subject,
      html: finalHtml,
      tags: [{ name: 'type', value: type }],
    });

    const resendId = result?.data?.id || null;

    if (result?.error) {
      console.error(`[EmailService] Resend rejected ${type} to ${user.email}:`, result.error);
      return false;
    }

    // Log
    await prisma.emailLog.create({
      data: {
        userId,
        type,
        resendId,
        subject,
      },
    });

    console.log(`[EmailService] Sent ${type} to ${user.email}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send ${type} to user ${userId}:`, err);
    return false;
  }
}

// ─── Convenience exports ────────────────────────────────────

export { getOrCreateUnsubToken, canSendEmail, TYPE_TO_PREF };
