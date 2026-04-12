const EMAIL_TYPE_FRIENDLY_NAMES: Record<string, string> = {
  WELCOME: 'welcome emails',
  PROFILE_NUDGE: 'onboarding emails',
  FIRST_CONNECTION: 'onboarding emails',
  FEATURE_DISCOVERY: 'onboarding emails',
  THIRTY_DAY_CHECKIN: 'onboarding emails',
  TRIP_CREATED: 'trip confirmation emails',
  PRE_TRIP_7DAY: 'pre-departure briefings',
  PRE_TRIP_48HR: 'pre-departure briefings',
  POST_TRIP: 'post-trip emails',
  FIRST_CHECKIN: 'onboarding emails',
  NEW_FOLLOWER: 'follower notifications',
  FRIEND_TRIP_OVERLAP: 'friend trip overlap alerts',
  COMMUNITY_REPLY: 'community reply notifications',
  WEEKLY_DIGEST: 'weekly digest emails',
  SCRAPBOOK_VIEWED: 'scrapbook notifications',
  SCRAPBOOK_COMMENT: 'scrapbook comment notifications',
  TRIP_ANNIVERSARY: 'trip anniversary emails',
  SCRAPBOOK_PDF: 'scrapbook export notifications',
  REVIEW_PUBLISHED: 'review notifications',
  REVIEW_RESPONSE: 'review response notifications',
  REVIEW_HELPFUL: 'review notifications',
  BADGE_EARNED: 'badge notifications',
  BADGE_CLOSE: 'badge nudge emails',
  CREATOR_WEEKLY: 'creator digest emails',
  TRIP_KIT_SAVED: 'trip kit notifications',
  TRIP_KIT_USED: 'trip kit notifications',
  FIRST_CONTENT: 'creator notifications',
  ACTIVITY_INVITE: 'activity invite emails',
  ACTIVITY_DIGEST: 'activity digest emails',
  OWNER_WEEKLY: 'campground owner digest',
  OWNER_NEW_REVIEW: 'campground review notifications',
  OWNER_NEW_FOLLOWER: 'campground follower notifications',
  OWNER_ARRIVING: 'guest arrival notifications',
  OWNER_LOW_ENGAGE: 'engagement alerts',
  OWNER_POST_EVENT: 'post-event summaries',
  OWNER_BROADCAST: 'broadcast confirmations',
  OWNER_POTENTIAL: 'campground insights',
};

interface BaseTemplateProps {
  previewText?: string;
  body: string;
  emailType?: string;
  unsubscribeToken?: string;
  showUnsubscribe?: boolean;
}

export function baseTemplate({
  previewText,
  body,
  emailType,
  unsubscribeToken,
  showUnsubscribe = true,
}: BaseTemplateProps): string {
  const friendlyName = EMAIL_TYPE_FRIENDLY_NAMES[emailType || ''] || 'these emails';
  const APP = 'https://www.rvunicorn.com';

  const unsubSection = showUnsubscribe && unsubscribeToken
    ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="font-size:12px;color:rgba(200,192,176,0.5);margin:0;">
          Don't want ${friendlyName}?
          <a href="${APP}/unsubscribe/${unsubscribeToken}?type=${emailType || ''}" style="color:rgba(232,168,56,0.7);font-size:12px;">Unsubscribe</a>
          &nbsp;or&nbsp;
          <a href="${APP}/unsubscribe/${unsubscribeToken}" style="color:rgba(232,168,56,0.7);font-size:12px;">Unsubscribe from all</a>
        </p>
      </div>`
    : '';

  const previewHidden = previewText
    ? `<div style="display:none;font-size:1px;color:#0A1628;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<style>
body{margin:0;padding:0;background:#0A1628;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
*{box-sizing:border-box;}
</style>
</head>
<body style="margin:0;padding:0;background:#0A1628;">
${previewHidden}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1628;">
<tr><td align="center" style="padding:20px 8px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0F1C35;border-radius:16px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid rgba(232,168,56,0.2);">
<a href="${APP}" style="color:#E8A838;font-size:22px;font-weight:700;letter-spacing:-0.5px;text-decoration:none;">
<span style="margin-right:6px;">&#x1F984;</span>RVUnicorn</a>
</td></tr>

<!-- Body -->
<tr><td style="padding:40px;">
${body}

<!-- Hitch signature -->
<table cellpadding="0" cellspacing="0" style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);width:100%;">
<tr>
<td width="56" style="vertical-align:top;">
<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#E8A838,#D4621A);text-align:center;line-height:44px;font-size:22px;">&#x1F3AF;</div>
</td>
<td style="vertical-align:middle;">
<div style="color:#E8A838;font-weight:600;font-size:14px;">Hitch</div>
<div style="color:#C8C0B0;font-size:12px;">Your RVUnicorn Co-Pilot</div>
</td>
</tr>
</table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:32px 40px;border-top:1px solid rgba(255,255,255,0.08);background:#0A1628;">
<p style="font-size:13px;color:rgba(200,192,176,0.6);margin:0 0 4px;">
You're receiving this because you're a member of <a href="${APP}" style="color:rgba(232,168,56,0.7);font-size:13px;">RVUnicorn</a> — the social platform for RV travelers.</p>
<p style="font-size:13px;margin:8px 0;">
<a href="${APP}" style="color:rgba(232,168,56,0.7);font-size:13px;">Visit RVUnicorn</a> &nbsp;&middot;&nbsp;
<a href="${APP}/settings" style="color:rgba(232,168,56,0.7);font-size:13px;">Notification Settings</a> &nbsp;&middot;&nbsp;
<a href="${APP}/privacy" style="color:rgba(232,168,56,0.7);font-size:13px;">Privacy Policy</a>
</p>
${unsubSection}
<p style="margin-top:16px;font-size:11px;color:rgba(200,192,176,0.4);">
RVUnicorn &middot; Elmhurst, IL &middot; <a href="mailto:hello@rvunicorn.com" style="color:rgba(200,192,176,0.4);font-size:11px;">hello@rvunicorn.com</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// Reusable HTML helpers for templates
export const btn = (href: string, label: string, secondary = false) =>
  secondary
    ? `<a href="${href}" style="display:inline-block;color:#E8A838!important;border:1.5px solid #E8A838;padding:12px 24px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;margin:8px 4px;">${label}</a>`
    : `<a href="${href}" style="display:inline-block;background:#E8A838;color:#0F1C35!important;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;margin:8px 4px;letter-spacing:0.2px;">${label}</a>`;

export const card = (content: string, borderAmber = false) =>
  `<div style="background:#1a2d4a;border-radius:12px;padding:20px;margin:16px 0;${borderAmber ? 'border-left:3px solid #E8A838;' : ''}">${content}</div>`;

export const stat = (value: string, label: string) =>
  `<td style="background:#1a2d4a;border-radius:10px;padding:16px;text-align:center;">
    <span style="color:#E8A838;font-size:24px;font-weight:700;display:block;">${value}</span>
    <span style="color:#C8C0B0;font-size:12px;margin-top:4px;display:block;">${label}</span>
  </td>`;

export const statsRow = (stats: Array<{ value: string; label: string }>) =>
  `<table width="100%" cellpadding="4" cellspacing="0" style="margin:20px 0;">
    <tr>${stats.map(s => stat(s.value, s.label)).join('')}</tr>
  </table>`;

export const h1 = (text: string) =>
  `<h1 style="color:#F5F0E8;font-size:26px;font-weight:700;line-height:1.3;margin:0 0 16px;">${text}</h1>`;

export const h2 = (text: string) =>
  `<h2 style="color:#F5F0E8;font-size:20px;font-weight:600;margin:24px 0 12px;">${text}</h2>`;

export const p = (text: string, highlight = false) =>
  `<p style="color:${highlight ? '#F5F0E8' : '#C8C0B0'};font-size:16px;line-height:1.6;margin:0 0 16px;">${text}</p>`;

export const amber = (text: string) => `<span style="color:#E8A838;">${text}</span>`;

export const divider = () =>
  `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">`;
