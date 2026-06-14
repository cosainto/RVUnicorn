import { Resend } from 'resend';
import { nanoid } from 'nanoid';
import { prisma } from '../prisma';
import { baseTemplate } from '../emails/baseTemplate';
import {
  canSendEmail as throttleCheck,
  queueForDigest,
  EMAIL_PRIORITY,
  type EmailPriority,
} from './emailThrottle';

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

async function checkEmailPreference(userId: string, type: string): Promise<boolean> {
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

// ─── Core send function ─────────────────────────────────────

interface SendEmailOptions {
  userId: string;
  type: string;
  subject: string;
  bodyHtml: string;
  previewText?: string;
  force?: boolean; // true = transactional (CRITICAL), skip preference & throttle checks
  /** Content data to store if this email gets queued for digest */
  digestContent?: Record<string, any>;
}

export async function sendTypedEmail({
  userId,
  type,
  subject,
  bodyHtml,
  previewText,
  force = false,
  digestContent,
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
      const allowed = await checkEmailPreference(userId, type);
      if (!allowed) {
        console.log(`[EmailService] User ${userId} opted out of ${type}`);
        return false;
      }
    }

    // Throttle check — replaces old rate limiting
    const throttle = await throttleCheck(userId, type);

    if (!throttle.canSend) {
      if (throttle.queueForDigest && throttle.digestType) {
        // Queue for digest instead of sending
        await queueForDigest(userId, throttle.digestType, type, digestContent || {
          subject,
          previewText: previewText || subject,
          bodyHtml: bodyHtml.slice(0, 500), // Store truncated preview
        });
        console.log(`[EmailService] Throttled ${type} for user ${userId}: ${throttle.reason}`);
      } else {
        console.log(`[EmailService] Blocked ${type} for user ${userId}: ${throttle.reason}`);
      }
      return false;
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

    // Log with priority
    await prisma.emailLog.create({
      data: {
        userId,
        type,
        priority: throttle.priority,
        resendId,
        subject,
      },
    });

    console.log(`[EmailService] Sent ${type} (${throttle.priority}) to ${user.email}: ${subject}`);
    return true;
  } catch (err: any) {
    console.error(`[EmailService] Failed to send ${type} to user ${userId}:`, err);
    return false;
  }
}

// ─── Convenience exports ────────────────────────────────────

export { getOrCreateUnsubToken, checkEmailPreference, TYPE_TO_PREF };
