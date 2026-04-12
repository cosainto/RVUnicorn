import { h1, p, btn, card, amber } from '../baseTemplate';

export function activityInvite(data: {
  firstName: string; organizerName: string; activityTitle: string;
  activityEmoji: string; campgroundName: string;
  scheduledTime?: string; note?: string; participantCount: number;
  instanceId: string;
}) {
  return {
    subject: `${data.organizerName} is organizing ${data.activityTitle} at ${data.campgroundName} \u{1F97E}`,
    previewText: "You saved this activity \u2014 now someone's actually doing it.",
    bodyHtml: [
      h1("Someone's doing the thing you saved! \u{1F64C}"),
      p(`Remember when you saved <strong style="color:#F5F0E8;">${data.activityTitle}</strong>? <strong style="color:#F5F0E8;">${data.organizerName}</strong> is making it happen.`),
      card([
        `<p style="color:#F5F0E8;margin:0 0 8px;">${data.activityEmoji} <strong>${data.activityTitle}</strong></p>`,
        data.scheduledTime ? `<p style="color:#C8C0B0;margin:0 0 4px;">\u{1F4C5} ${data.scheduledTime}</p>` : '',
        `<p style="color:#C8C0B0;margin:0 0 4px;">\u{1F4CD} ${data.campgroundName}</p>`,
        data.note ? `<p style="color:#C8C0B0;margin:0 0 4px;">\u{1F4AC} "${data.note}"</p>` : '',
        `<p style="color:#C8C0B0;margin:0;">\u{1F465} ${data.participantCount} people already joined</p>`,
      ].join('\n'), true),
      p("This is the exact kind of thing RVUnicorn is for. Real people, real campgrounds, real adventures."),
      btn(`https://www.rvunicorn.com/activities/${data.instanceId}`, 'Join Them \u2192'),
      btn(`https://www.rvunicorn.com/activities/${data.instanceId}`, "See Who's Going", true),
    ].join('\n'),
  };
}

export function creatorWeekly(data: {
  firstName: string; views: number; saves: number; newFollowers: number;
  topContentTitle?: string; topContentUrl?: string;
  hitchSuggestion?: string;
}) {
  return {
    subject: `Your creator week: ${data.views} views, ${data.saves} saves \u{1F4CA}`,
    previewText: `${data.newFollowers} new followers this week.`,
    bodyHtml: [
      h1(`Your creator week in review \u{1F4CA}`),
      p(`Hey ${data.firstName}, here's how your content performed this week.`),
      `<table width="100%" cellpadding="4" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td style="background:#1a2d4a;border-radius:10px;padding:16px;text-align:center;">
            <span style="color:#E8A838;font-size:24px;font-weight:700;display:block;">${data.views}</span>
            <span style="color:#C8C0B0;font-size:12px;display:block;">Views</span>
          </td>
          <td style="background:#1a2d4a;border-radius:10px;padding:16px;text-align:center;">
            <span style="color:#E8A838;font-size:24px;font-weight:700;display:block;">${data.saves}</span>
            <span style="color:#C8C0B0;font-size:12px;display:block;">Saves</span>
          </td>
          <td style="background:#1a2d4a;border-radius:10px;padding:16px;text-align:center;">
            <span style="color:#E8A838;font-size:24px;font-weight:700;display:block;">+${data.newFollowers}</span>
            <span style="color:#C8C0B0;font-size:12px;display:block;">Followers</span>
          </td>
        </tr>
      </table>`,
      data.topContentTitle
        ? card(`<p style="color:#F5F0E8;margin:0 0 4px;">\u{1F525} Top performing: <strong>${data.topContentTitle}</strong></p>
                ${data.topContentUrl ? `<a href="${data.topContentUrl}" style="color:#E8A838;font-size:14px;">View stats \u2192</a>` : ''}`, true)
        : '',
      data.hitchSuggestion
        ? card(`<p style="color:#E8A838;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">\u{1F3AF} Hitch Suggests</p>
                <p style="color:#F5F0E8;margin:0;">${data.hitchSuggestion}</p>`, true)
        : '',
      btn('https://www.rvunicorn.com/creator/dashboard', 'Open Creator Dashboard \u2192'),
    ].join('\n'),
  };
}

export function tripKitUsed(data: {
  firstName: string; userName: string; tripTitle: string; kitTitle: string;
}) {
  return {
    subject: `${data.userName} used your trip kit "${data.kitTitle}" \u{1F5FA}\uFE0F`,
    previewText: `They created "${data.tripTitle}" from your kit.`,
    bodyHtml: [
      h1("Your trip kit is inspiring adventures! \u{1F389}"),
      p(`<strong style="color:#F5F0E8;">${data.userName}</strong> just created a trip called <strong style="color:#F5F0E8;">"${data.tripTitle}"</strong> using your trip kit ${amber(`"${data.kitTitle}"`)}.`),
      p("Every time someone uses your kit, you're helping a fellow RVer have a better trip. That's what this community is all about."),
      btn('https://www.rvunicorn.com/creator/dashboard', 'View My Kit Stats \u2192'),
    ].join('\n'),
  };
}
