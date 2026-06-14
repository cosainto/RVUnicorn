import cron from 'node-cron';
import { prisma } from '../prisma';
import { Resend } from 'resend';
import { baseTemplate, btn, h1, h2, p, card, divider, amber } from '../emails/baseTemplate';
import { getOrCreateUnsubToken } from '../services/emailService';
import { getPendingDigestItems, markDigestItemsSent } from '../services/emailThrottle';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Hitch at RVUnicorn <hitch@updates.rvunicorn.com>';
const APP_URL = 'https://www.rvunicorn.com';

// ─── Content type → friendly label & emoji ──────────────────

const CONTENT_LABELS: Record<string, { emoji: string; label: string }> = {
  NEW_FOLLOWER:       { emoji: '\u{1F44B}', label: 'New Followers' },
  LIKE:               { emoji: '\u2764\uFE0F', label: 'Likes' },
  SCRAPBOOK_COMMENT:  { emoji: '\u{1F4AC}', label: 'Scrapbook Comments' },
  COMMENT_ADDED:      { emoji: '\u{1F4AC}', label: 'Comments' },
  COMMUNITY_REPLY:    { emoji: '\u{1F4AC}', label: 'Community Replies' },
  BADGE_EARNED:       { emoji: '\u{1F3C5}', label: 'Badges Earned' },
  REVIEW_PUBLISHED:   { emoji: '\u2B50', label: 'Reviews Published' },
  REVIEW_RESPONSE:    { emoji: '\u{1F4DD}', label: 'Review Responses' },
  REVIEW_HELPFUL:     { emoji: '\u{1F44D}', label: 'Helpful Review Votes' },
  SCRAPBOOK_VIEWED:   { emoji: '\u{1F440}', label: 'Scrapbook Views' },
  TRIP_CREATED:       { emoji: '\u{1F5FA}\uFE0F', label: 'Trips Created' },
  POST_TRIP:          { emoji: '\u{1F3D5}\uFE0F', label: 'Trip Recaps' },
  WELCOME:            { emoji: '\u{1F44B}', label: 'Welcome' },
  PROFILE_NUDGE:      { emoji: '\u{1F4CB}', label: 'Profile Tips' },
  FIRST_CONNECTION:   { emoji: '\u{1F91D}', label: 'Connection Tips' },
  THIRTY_DAY_CHECKIN: { emoji: '\u{1F389}', label: '30-Day Milestone' },
  BADGE_CLOSE:        { emoji: '\u{1F3AF}', label: 'Badges Almost Earned' },
  NOTE_ADDED:         { emoji: '\u{1F4CC}', label: 'Notes Added' },
  CHECKLIST_ASSIGNED: { emoji: '\u2705', label: 'Tasks Assigned' },
  CHECKLIST_COMPLETED:{ emoji: '\u{1F389}', label: 'Tasks Completed' },
  CAMPGROUND_ADDED:   { emoji: '\u{1F3D5}\uFE0F', label: 'Campgrounds Added' },
  EVENT_UPDATE:       { emoji: '\u{1F4DD}', label: 'Event Updates' },
  RSVP_CHANGE:        { emoji: '\u2705', label: 'RSVP Changes' },
  OWNER_NEW_REVIEW:   { emoji: '\u2B50', label: 'New Campground Reviews' },
  OWNER_NEW_FOLLOWER: { emoji: '\u{1F44B}', label: 'New Campground Followers' },
  OWNER_ARRIVING:     { emoji: '\u{1F697}', label: 'Guest Arrivals' },
  OWNER_BROADCAST:    { emoji: '\u{1F4E2}', label: 'Broadcast Confirmations' },
  // LOW tier
  WEEKLY_DIGEST:      { emoji: '\u{1F4F0}', label: 'Community Highlights' },
  INACTIVITY:         { emoji: '\u{1F44B}', label: 'We Miss You' },
  FEATURE_DISCOVERY:  { emoji: '\u2728', label: 'New Features' },
  OWNER_WEEKLY:       { emoji: '\u{1F4CA}', label: 'Owner Weekly Stats' },
  OWNER_POTENTIAL:    { emoji: '\u{1F4A1}', label: 'Growth Opportunities' },
  OWNER_LOW_ENGAGE:   { emoji: '\u{1F4C9}', label: 'Engagement Alerts' },
  CREATOR_WEEKLY:     { emoji: '\u{1F3A8}', label: 'Creator Stats' },
  DRIP_WELCOME:       { emoji: '\u{1F44B}', label: 'Getting Started' },
  DRIP_COMMUNITY:     { emoji: '\u{1F4AC}', label: 'Community Tips' },
  DRIP_SOCIAL:        { emoji: '\u{1F465}', label: 'Social Tips' },
  DRIP_TRIVIA:        { emoji: '\u{1F3AF}', label: 'Trivia Reminder' },
  DRIP_FIRST_TRIP:    { emoji: '\u{1F5FA}\uFE0F', label: 'Trip Planning Tips' },
  CAMPGROUND_ALSO_FAVORITED: { emoji: '\u2764\uFE0F', label: 'Also Favorited' },
  RIG_PHOTOS_AT_FAVORITE:    { emoji: '\u{1F4F8}', label: 'New Photos at Your Favorites' },
};

// ─── Build digest section for a group of items ──────────────

function buildDigestSection(
  contentType: string,
  items: Array<{ contentData: any }>,
): string {
  const meta = CONTENT_LABELS[contentType] || { emoji: '\u{1F514}', label: contentType };
  const count = items.length;

  let details = '';

  if (contentType === 'NEW_FOLLOWER' && items.some(i => i.contentData?.followerName)) {
    const names = items.map(i => i.contentData.followerName).filter(Boolean).slice(0, 3);
    const extra = count > 3 ? ` and ${count - 3} more` : '';
    details = `<p style="color:#C8C0B0;font-size:14px;margin:4px 0 0;">${names.join(', ')}${extra}</p>`;
  } else if (contentType === 'BADGE_EARNED' && items.some(i => i.contentData?.badgeName)) {
    const badges = items.map(i => `${i.contentData.badgeEmoji || ''} ${i.contentData.badgeName}`).filter(Boolean).slice(0, 5);
    details = `<p style="color:#C8C0B0;font-size:14px;margin:4px 0 0;">${badges.join(', ')}</p>`;
  } else if (contentType === 'SCRAPBOOK_COMMENT' && items.some(i => i.contentData?.commenterName)) {
    const uniqueNames: string[] = [];
    items.forEach(i => { if (i.contentData?.commenterName && uniqueNames.indexOf(i.contentData.commenterName) === -1) uniqueNames.push(i.contentData.commenterName); });
    details = `<p style="color:#C8C0B0;font-size:14px;margin:4px 0 0;">From ${uniqueNames.slice(0, 3).join(', ')}</p>`;
  } else if (contentType === 'CAMPGROUND_ALSO_FAVORITED' && items.some(i => i.contentData?.username)) {
    const names = items.map(i => i.contentData.username).filter(Boolean).slice(0, 3);
    const campName = items[0]?.contentData?.campgroundName || 'a campground';
    details = `<p style="color:#C8C0B0;font-size:14px;margin:4px 0 0;">${names.join(', ')} also favorited ${campName}</p>`;
  } else if (contentType === 'RIG_PHOTOS_AT_FAVORITE' && items.some(i => i.contentData?.rigName)) {
    const rigs = items.map(i => `${i.contentData.rigName} at ${i.contentData.campgroundName}`).filter(Boolean).slice(0, 3);
    details = `<p style="color:#C8C0B0;font-size:14px;margin:4px 0 0;">${rigs.join(', ')}</p>`;
  } else if (items[0]?.contentData?.title) {
    details = `<p style="color:#C8C0B0;font-size:14px;margin:4px 0 0;">${items[0].contentData.title}</p>`;
  }

  return `<div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:18px;">${meta.emoji}</span>
      <span style="color:#F5F0E8;font-size:15px;font-weight:600;">${count} ${meta.label}</span>
    </div>
    ${details}
  </div>`;
}

// ─── Send daily digests ─────────────────────────────────────

export async function sendDailyDigests() {
  console.log('[EmailDigest] Running daily digest...');

  // Find all users with pending DAILY digest items
  const usersWithItems = await prisma.emailDigestQueue.groupBy({
    by: ['userId'],
    where: {
      digestType: 'DAILY',
      includedInDigestAt: null,
    },
  });

  let sent = 0;
  for (const { userId } of usersWithItems) {
    try {
      const items = await getPendingDigestItems(userId, 'DAILY');
      if (items.length === 0) continue;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      if (!user?.email) continue;

      // Check preference: global kill switch
      const prefs = await prisma.emailPreference.findUnique({ where: { userId } });
      if (prefs && !prefs.allEmails) continue;

      // Group items by content type
      const grouped = new Map<string, Array<{ contentData: any }>>();
      for (const item of items) {
        const group = grouped.get(item.contentType) || [];
        group.push({ contentData: item.contentData as any });
        grouped.set(item.contentType, group);
      }

      // Build digest body
      let sectionsHtml = '';
      Array.from(grouped.entries()).forEach(([contentType, groupItems]) => {
        sectionsHtml += buildDigestSection(contentType, groupItems);
      });

      const totalItems = items.length;
      const bodyHtml = `
        ${h1(`Your RVUnicorn update \u26FA`)}
        ${p(`Hey ${user.firstName || 'friend'} \u2014 here's what happened since your last update:`)}
        <div style="background:#1a2d4a;border-radius:12px;padding:20px;margin:16px 0;">
          ${sectionsHtml}
        </div>
        ${p(`${amber(String(totalItems))} things happened while you were away. Tap below to catch up!`)}
        <div style="text-align:center;margin:24px 0;">
          ${btn(`${APP_URL}/basecamp`, 'Open RVUnicorn')}
        </div>
      `;

      const unsubToken = await getOrCreateUnsubToken(userId);
      const finalHtml = baseTemplate({
        previewText: `${totalItems} updates from RVUnicorn`,
        body: bodyHtml,
        emailType: 'DAILY_DIGEST',
        unsubscribeToken: unsubToken,
        showUnsubscribe: true,
      });

      const result: any = await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: 'Your RVUnicorn update \u26FA',
        html: finalHtml,
        tags: [{ name: 'type', value: 'DAILY_DIGEST' }],
      });

      if (result?.error) {
        console.error(`[EmailDigest] Failed daily digest for ${user.email}:`, result.error);
        continue;
      }

      // Log the digest email
      await prisma.emailLog.create({
        data: {
          userId,
          type: 'DAILY_DIGEST',
          priority: 'MEDIUM',
          resendId: result?.data?.id || null,
          subject: 'Your RVUnicorn update \u26FA',
          wasDigest: true,
        },
      });

      // Mark items as included
      await markDigestItemsSent(items.map(i => i.id));
      sent++;
    } catch (err: any) {
      console.error(`[EmailDigest] Error processing daily digest for user ${userId}:`, err);
    }
  }

  console.log(`[EmailDigest] Daily digest complete: ${sent} digests sent to ${usersWithItems.length} eligible users`);
}

// ─── Send weekly digests ────────────────────────────────────

export async function sendWeeklyDigests() {
  console.log('[EmailDigest] Running weekly digest...');

  // Find all users with pending WEEKLY digest items
  const usersWithItems = await prisma.emailDigestQueue.groupBy({
    by: ['userId'],
    where: {
      digestType: 'WEEKLY',
      includedInDigestAt: null,
    },
  });

  let sent = 0;
  for (const { userId } of usersWithItems) {
    try {
      const items = await getPendingDigestItems(userId, 'WEEKLY');
      if (items.length === 0) continue;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      if (!user?.email) continue;

      const prefs = await prisma.emailPreference.findUnique({ where: { userId } });
      if (prefs && !prefs.allEmails) continue;
      if (prefs && prefs.weeklyDigest === false) continue;

      // Check monthly marketing limit
      const monthStart = new Date();
      monthStart.setDate(monthStart.getDate() - 30);
      const marketingCount = await prisma.emailLog.count({
        where: { userId, sentAt: { gte: monthStart }, type: { in: ['WEEKLY_DIGEST_ROLLUP', 'DAILY_DIGEST'] } },
      });
      if (marketingCount >= 2) continue;

      // Group items by content type
      const grouped = new Map<string, Array<{ contentData: any }>>();
      for (const item of items) {
        const group = grouped.get(item.contentType) || [];
        group.push({ contentData: item.contentData as any });
        grouped.set(item.contentType, group);
      }

      let sectionsHtml = '';
      Array.from(grouped.entries()).forEach(([contentType, groupItems]) => {
        sectionsHtml += buildDigestSection(contentType, groupItems);
      });

      const totalItems = items.length;
      const bodyHtml = `
        ${h1(`Your weekly RVUnicorn roundup \u{1F3D5}\uFE0F`)}
        ${p(`Hey ${user.firstName || 'friend'} \u2014 here's your weekly summary of what's been happening in the RVUnicorn community:`)}
        <div style="background:#1a2d4a;border-radius:12px;padding:20px;margin:16px 0;">
          ${sectionsHtml}
        </div>
        ${p(`${amber(String(totalItems))} things happened this week. Come see what's new!`)}
        <div style="text-align:center;margin:24px 0;">
          ${btn(`${APP_URL}/basecamp`, 'Explore RVUnicorn')}
        </div>
      `;

      const unsubToken = await getOrCreateUnsubToken(userId);
      const finalHtml = baseTemplate({
        previewText: `Your weekly RVUnicorn roundup - ${totalItems} updates`,
        body: bodyHtml,
        emailType: 'WEEKLY_DIGEST',
        unsubscribeToken: unsubToken,
        showUnsubscribe: true,
      });

      const result: any = await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: 'Your weekly RVUnicorn roundup \u{1F3D5}\uFE0F',
        html: finalHtml,
        tags: [{ name: 'type', value: 'WEEKLY_DIGEST_ROLLUP' }],
      });

      if (result?.error) {
        console.error(`[EmailDigest] Failed weekly digest for ${user.email}:`, result.error);
        continue;
      }

      await prisma.emailLog.create({
        data: {
          userId,
          type: 'WEEKLY_DIGEST_ROLLUP',
          priority: 'LOW',
          resendId: result?.data?.id || null,
          subject: 'Your weekly RVUnicorn roundup \u{1F3D5}\uFE0F',
          wasDigest: true,
        },
      });

      await markDigestItemsSent(items.map(i => i.id));
      sent++;
    } catch (err: any) {
      console.error(`[EmailDigest] Error processing weekly digest for user ${userId}:`, err);
    }
  }

  console.log(`[EmailDigest] Weekly digest complete: ${sent} digests sent to ${usersWithItems.length} eligible users`);
}

// ─── Register crons ─────────────────────────────────────────

export function registerEmailDigestCrons() {
  // Daily digest at 9 AM CT
  cron.schedule('0 9 * * *', async () => {
    console.log('[EmailDigest] Daily digest cron firing...');
    try {
      await sendDailyDigests();
    } catch (err: any) {
      console.error('[EmailDigest] Daily digest cron failed:', err);
    }
  }, { timezone: 'America/Chicago' });

  // Weekly digest every Monday at 10 AM CT
  cron.schedule('0 10 * * 1', async () => {
    console.log('[EmailDigest] Weekly digest cron firing...');
    try {
      await sendWeeklyDigests();
    } catch (err: any) {
      console.error('[EmailDigest] Weekly digest cron failed:', err);
    }
  }, { timezone: 'America/Chicago' });

  console.log('[EmailDigest] Digest crons registered (daily 9AM CT, weekly Mon 10AM CT)');
}
