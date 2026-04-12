import { h1, h2, p, btn, card, amber } from '../baseTemplate';

export function badgeEarned(data: {
  firstName: string; badgeName: string; badgeEmoji: string;
  badgeDescription: string; earnedMessage: string; holderCount: number;
  nextBadge?: { name: string; progress: string };
}) {
  return {
    subject: `You just earned: ${data.badgeName} \u{1F3C6}`,
    previewText: `Only ${data.holderCount} RVUnicorn members have this one.`,
    bodyHtml: [
      h1(`New badge unlocked, ${data.firstName}! \u{1F389}`),
      `<div style="background:#1a2d4a;border-radius:12px;padding:32px;margin:16px 0;text-align:center;">
        <div style="font-size:64px;margin-bottom:16px;">${data.badgeEmoji}</div>
        <h2 style="color:#F5F0E8;margin:0 0 8px;font-size:22px;">${data.badgeName}</h2>
        <p style="margin:0;color:#C8C0B0;">${data.badgeDescription}</p>
      </div>`,
      p(data.earnedMessage),
      p(`Only <strong style="color:#F5F0E8;">${data.holderCount} members</strong> have earned the ${data.badgeName} badge. ${amber("You're in rare company.")}`),
      data.nextBadge
        ? card(`<p style="color:#F5F0E8;margin:0 0 4px;">\u{1F3AF} <strong>Up next: ${data.nextBadge.name}</strong></p>
                <p style="color:#C8C0B0;margin:0 0 8px;">${data.nextBadge.progress}</p>
                <a href="https://www.rvunicorn.com/profile/badges" style="color:#E8A838;font-size:14px;">See Your Badge Collection \u2192</a>`, true)
        : '',
      btn('https://www.rvunicorn.com/profile/badges', 'View All My Badges \u2192'),
    ].join('\n'),
  };
}

export function badgeClose(data: {
  firstName: string; badgeName: string; badgeEmoji: string;
  progress: string; remaining: string;
}) {
  return {
    subject: `You're close to earning ${data.badgeName} ${data.badgeEmoji}`,
    previewText: `${data.remaining} \u2014 keep going!`,
    bodyHtml: [
      h1(`Almost there, ${data.firstName}! ${data.badgeEmoji}`),
      p(`You're ${amber("this close")} to earning the <strong style="color:#F5F0E8;">${data.badgeName}</strong> badge.`),
      card(`<p style="color:#F5F0E8;font-weight:600;margin:0 0 8px;">Progress: ${data.progress}</p>
            <p style="color:#C8C0B0;margin:0;">${data.remaining}</p>`, true),
      btn('https://www.rvunicorn.com/basecamp', 'Keep Going \u2192'),
    ].join('\n'),
  };
}
