import { h1, h2, p, btn, card, amber, divider } from '../baseTemplate';

export function newFollower(data: {
  firstName: string; followerName: string; followerUsername: string;
  followerAvatar?: string;
}) {
  return {
    subject: `${data.followerName} started following you on RVUnicorn`,
    previewText: `@${data.followerUsername} is now following your adventures.`,
    bodyHtml: [
      h1(`New follower! \u{1F44B}`),
      p(`<strong style="color:#F5F0E8;">${data.followerName}</strong> (@${data.followerUsername}) is now following your adventures on RVUnicorn.`),
      p("They'll see your trips, check-ins, and activity in their feed."),
      btn(`https://www.rvunicorn.com/profile/${data.followerUsername}`, 'View Their Profile \u2192'),
    ].join('\n'),
  };
}

export function communityReply(data: {
  firstName: string; replierName: string; threadTitle: string;
  replyPreview: string; threadUrl: string;
}) {
  return {
    subject: `${data.replierName} replied to "${data.threadTitle}"`,
    previewText: data.replyPreview.slice(0, 100),
    bodyHtml: [
      h1("Someone jumped into your conversation \u{1F4AC}"),
      p(`<strong style="color:#F5F0E8;">${data.replierName}</strong> replied to your post in <strong style="color:#F5F0E8;">"${data.threadTitle}"</strong>:`),
      card(`<p style="color:#C8C0B0;font-style:italic;margin:0;">"${data.replyPreview.slice(0, 300)}"</p>`),
      btn(data.threadUrl, 'View the Thread \u2192'),
    ].join('\n'),
  };
}

export function weeklyDigest(data: {
  firstName: string;
  characterName?: string; threadTitle?: string; threadPreview?: string;
  boardSlug?: string; postId?: string;
  friendActivity: Array<{ emoji: string; name: string; action: string; url: string; linkLabel: string }>;
  featuredKit?: { title: string; description: string; stops: number; days: number; creatorName: string; creatorUsername: string; creatorUrl: string };
}) {
  return {
    subject: "What's crackling at RVUnicorn this week \u{1F525}",
    previewText: `${data.threadTitle || 'New discussions'}, fresh creator content, and more.`,
    bodyHtml: [
      h1(`Hey ${data.firstName}, here's your weekly campfire \u2615`),
      p("Grab your coffee. Here's what happened this week while you were out there living your best RV life."),

      // Thread of the week
      data.threadTitle ? [
        h2("\u{1F525} This Week's Big Discussion"),
        card([
          data.characterName ? `<p style="color:#E8A838;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">${data.characterName} started this one</p>` : '',
          `<p style="color:#F5F0E8;font-weight:600;margin:0 0 8px;">${data.threadTitle}</p>`,
          `<p style="color:#C8C0B0;margin:0 0 12px;">${data.threadPreview || ''}</p>`,
          data.boardSlug && data.postId
            ? `<a href="https://www.rvunicorn.com/community/${data.boardSlug}/${data.postId}" style="color:#E8A838;font-size:14px;">Join the conversation \u2192</a>`
            : '',
        ].join('\n'), true),
      ].join('\n') : '',

      // Friend activity
      data.friendActivity.length > 0 ? [
        h2("\u{1F465} What Your People Are Up To"),
        ...data.friendActivity.map(f =>
          card(`<p style="color:#C8C0B0;margin:0 0 8px;">${f.emoji} <strong style="color:#F5F0E8;">${f.name}</strong> ${f.action}</p>
                <a href="${f.url}" style="color:#E8A838;font-size:14px;">${f.linkLabel} \u2192</a>`)
        ),
      ].join('\n') : '',

      // Featured kit
      data.featuredKit ? [
        h2("\u{1F5FA}\uFE0F Trip Kit of the Week"),
        card([
          `<p style="color:#F5F0E8;font-weight:600;margin:0 0 8px;">${data.featuredKit.title}</p>`,
          `<p style="color:#C8C0B0;margin:0 0 8px;">${data.featuredKit.description}</p>`,
          `<p style="color:#C8C0B0;font-size:13px;margin:0 0 12px;">${data.featuredKit.stops} stops \u00B7 ${data.featuredKit.days} days \u00B7 by <a href="${data.featuredKit.creatorUrl}" style="color:#E8A838;">${data.featuredKit.creatorName}</a></p>`,
          `<a href="https://www.rvunicorn.com/creators/${data.featuredKit.creatorUsername}" style="color:#E8A838;font-size:14px;">Use This Trip \u2192</a>`,
        ].join('\n')),
      ].join('\n') : '',

      btn('https://www.rvunicorn.com/community', 'See Everything \u2192'),
    ].join('\n'),
  };
}

export function scrapbookComment(data: {
  firstName: string; commenterName: string; tripTitle: string;
  comment: string; scrapbookToken: string;
}) {
  return {
    subject: `${data.commenterName} commented on your ${data.tripTitle} scrapbook`,
    previewText: data.comment.slice(0, 80),
    bodyHtml: [
      h1("New comment on your scrapbook \u{1F4AC}"),
      p(`<strong style="color:#F5F0E8;">${data.commenterName}</strong> left a comment on your <strong style="color:#F5F0E8;">${data.tripTitle}</strong> scrapbook:`),
      card(`<p style="color:#C8C0B0;font-style:italic;margin:0;">"${data.comment.slice(0, 300)}"</p>`),
      btn(`https://www.rvunicorn.com/s/${data.scrapbookToken}`, 'View Scrapbook \u2192'),
    ].join('\n'),
  };
}
