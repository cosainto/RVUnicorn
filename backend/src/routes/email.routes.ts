import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// ─── Email Preferences ─────────────────────────────────────

// GET /api/email-preferences — get user's email preferences
router.get('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    let prefs = await prisma.emailPreference.findUnique({ where: { userId } });
    if (!prefs) {
      prefs = await prisma.emailPreference.create({ data: { userId } });
    }

    res.json(prefs);
  } catch (err: any) {
    console.error('[EmailPrefs] GET', err);
    res.status(500).json({ error: 'Failed to load preferences' });
  }
});

// PATCH /api/email-preferences — update preferences
router.patch('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const updates = req.body;

    // Whitelist allowed fields
    const allowed = [
      'onboardingEmails', 'tripConfirmation', 'tripPreDeparture', 'tripPostReturn',
      'newFollower', 'friendTripOverlap', 'communityReplies', 'weeklyDigest',
      'scrapbookViewed', 'scrapbookComments', 'tripAnniversary', 'scrapbookExport',
      'reviewPublished', 'reviewResponse', 'reviewHelpful',
      'badgeEarned', 'badgeClose',
      'creatorWeeklyDigest', 'tripKitSaved', 'tripKitUsed', 'firstContentPublished',
      'activityInvite', 'activityDigest',
      'ownerWeeklyDigest', 'ownerNewReview', 'ownerNewFollower', 'ownerGuestArriving',
      'ownerLowEngagement', 'ownerPostEvent', 'ownerBroadcastConfirm', 'ownerPotentialEnergy',
      'allEmails', 'maxEmailsPerDay', 'digestFrequency',
    ];

    const filtered: any = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    const prefs = await prisma.emailPreference.upsert({
      where: { userId },
      create: { userId, ...filtered },
      update: filtered,
    });

    res.json(prefs);
  } catch (err: any) {
    console.error('[EmailPrefs] PATCH', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ─── Unsubscribe ────────────────────────────────────────────

// GET /api/unsubscribe/:token — validate token and redirect to settings
router.get('/unsubscribe/:token', async (req: any, res: Response) => {
  try {
    const { token } = req.params;
    const { type } = req.query;

    const record = await prisma.emailUnsubscribeToken.findUnique({
      where: { token },
    });
    if (!record) {
      return res.status(404).json({ error: 'Invalid or expired unsubscribe link' });
    }

    // Redirect to frontend settings with params
    const base = process.env.APP_URL || 'https://www.rvunicorn.com';
    if (type) {
      return res.redirect(`${base}/settings?unsub=${type}&token=${token}`);
    }
    return res.redirect(`${base}/settings?unsub=all&token=${token}`);
  } catch (err: any) {
    console.error('[Unsubscribe] GET', err);
    res.status(500).json({ error: 'Failed to process unsubscribe' });
  }
});

// POST /api/unsubscribe/:token — process unsubscribe
router.post('/unsubscribe/:token', async (req: any, res: Response) => {
  try {
    const { token } = req.params;
    const { type } = req.body;

    const record = await prisma.emailUnsubscribeToken.findUnique({
      where: { token },
      select: { userId: true, id: true },
    });
    if (!record) {
      return res.status(404).json({ error: 'Invalid or expired unsubscribe link' });
    }

    // Mark token as used
    await prisma.emailUnsubscribeToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    // Type → preference field mapping
    const TYPE_TO_FIELD: Record<string, string> = {
      WELCOME: 'onboardingEmails', PROFILE_NUDGE: 'onboardingEmails',
      TRIP_CREATED: 'tripConfirmation', PRE_TRIP_7DAY: 'tripPreDeparture',
      PRE_TRIP_48HR: 'tripPreDeparture', POST_TRIP: 'tripPostReturn',
      NEW_FOLLOWER: 'newFollower', FRIEND_TRIP_OVERLAP: 'friendTripOverlap',
      COMMUNITY_REPLY: 'communityReplies', WEEKLY_DIGEST: 'weeklyDigest',
      SCRAPBOOK_COMMENT: 'scrapbookComments', TRIP_ANNIVERSARY: 'tripAnniversary',
      BADGE_EARNED: 'badgeEarned', BADGE_CLOSE: 'badgeClose',
      CREATOR_WEEKLY: 'creatorWeeklyDigest', ACTIVITY_INVITE: 'activityInvite',
      OWNER_WEEKLY: 'ownerWeeklyDigest', OWNER_NEW_REVIEW: 'ownerNewReview',
      OWNER_POTENTIAL: 'ownerPotentialEnergy',
    };

    if (type && TYPE_TO_FIELD[type]) {
      // Unsubscribe from specific type
      await prisma.emailPreference.upsert({
        where: { userId: record.userId },
        create: { userId: record.userId, [TYPE_TO_FIELD[type]]: false },
        update: { [TYPE_TO_FIELD[type]]: false },
      });
    } else {
      // Unsubscribe from all
      await prisma.emailPreference.upsert({
        where: { userId: record.userId },
        create: { userId: record.userId, allEmails: false },
        update: { allEmails: false },
      });
    }

    res.json({ success: true, type: type || 'all' });
  } catch (err: any) {
    console.error('[Unsubscribe] POST', err);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

export default router;
