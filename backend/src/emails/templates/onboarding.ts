import { h1, h2, p, btn, card, amber, divider } from '../baseTemplate';

export function welcome(data: { firstName: string }) {
  return {
    subject: `Welcome to RVUnicorn, ${data.firstName}! \u{1F984}`,
    previewText: "Your adventure starts here \u2014 here's how to get rolling.",
    bodyHtml: [
      h1(`Hey ${data.firstName}, welcome to the campfire! \u{1F525}`),
      p(`You just joined the RV community that actually goes places together. I'm Hitch \u2014 your AI co-pilot, campground guide, and occasional wise-cracker.`, true),
      p("Here's what's waiting for you:"),
      card(`<p style="color:#F5F0E8;margin:0;">\u{1F5FA}\uFE0F <strong>Travel Map</strong> \u2014 Pin every state you've explored and show off your route history.</p>`, true),
      card(`<p style="color:#F5F0E8;margin:0;">\u{1F690} <strong>Rig Profile</strong> \u2014 Tell me about your rig and I'll give you smarter trip advice (including whether your 42ft bus actually fits at that campground).</p>`, true),
      card(`<p style="color:#F5F0E8;margin:0;">\u{1F916} <strong>Hitch AI</strong> \u2014 Ask me anything. Routes, campgrounds, weather, what to pack. I've been down every road.</p>`, true),
      p("The best first move? Complete your profile \u2014 it takes 3 minutes and unlocks everything."),
      btn('https://www.rvunicorn.com/profile/edit', 'Complete My Profile \u2192'),
      p("See you at the campfire,"),
    ].join('\n'),
  };
}

export function profileNudge(data: {
  firstName: string;
  missingFields: Array<{ icon: string; label: string; reason: string }>;
}) {
  return {
    subject: `Your rig deserves better than a blank profile, ${data.firstName}`,
    previewText: '3 minutes to unlock everything RVUnicorn has for you.',
    bodyHtml: [
      h1("Your adventure profile is still half-empty \u{1F690}"),
      p(`Hey ${data.firstName} \u2014 I've been waiting to give you personalized trip advice, but I need a little more to go on.`),
      p("Here's what's missing:"),
      ...data.missingFields.map(f =>
        card(`<p style="color:#F5F0E8;margin:0;">${f.icon} <strong>${f.label}</strong> \u2014 ${f.reason}</p>`)
      ),
      p(`Without your RV details, I'm basically giving you the same advice I'd give someone in a tent. ${amber("You're better than a tent.")}`),
      btn('https://www.rvunicorn.com/profile/edit', 'Finish My Profile \u2192'),
    ].join('\n'),
  };
}

export function firstConnection(data: { firstName: string }) {
  return {
    subject: `Day 5 tip: Find your people, ${data.firstName} \u{1F91D}`,
    previewText: 'RVUnicorn is better with friends. Here\'s how to find yours.',
    bodyHtml: [
      h1("The best trips happen with the right people \u{1F91D}"),
      p(`Hey ${data.firstName} \u2014 you've been here a few days now. Time to find your people.`),
      card(`<p style="color:#F5F0E8;margin:0;">\u{1F50D} <strong>Search by campground</strong> \u2014 Find others who camp where you camp.</p>`, true),
      card(`<p style="color:#F5F0E8;margin:0;">\u{1F4CD} <strong>Check in at a campground</strong> \u2014 See who else is there right now.</p>`, true),
      card(`<p style="color:#F5F0E8;margin:0;">\u{1F4AC} <strong>Join a community board</strong> \u2014 Jump into conversations with other RVers.</p>`, true),
      btn('https://www.rvunicorn.com/community', 'Explore the Community \u2192'),
    ].join('\n'),
  };
}

export function thirtyDayCheckin(data: { firstName: string; tripsCount: number; statesCount: number; badgesCount: number }) {
  return {
    subject: `30 days in \u2014 here's your RVUnicorn story so far, ${data.firstName}`,
    previewText: `${data.tripsCount} trips, ${data.statesCount} states, ${data.badgesCount} badges.`,
    bodyHtml: [
      h1("One month in \u2014 let's check the odometer \u{1F4CA}"),
      p(`Hey ${data.firstName} \u2014 you've been an RVUnicorn member for 30 days. Here's what you've done:`),
      `<table width="100%" cellpadding="4" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td style="background:#1a2d4a;border-radius:10px;padding:16px;text-align:center;">
            <span style="color:#E8A838;font-size:24px;font-weight:700;display:block;">${data.tripsCount}</span>
            <span style="color:#C8C0B0;font-size:12px;display:block;">Trips</span>
          </td>
          <td style="background:#1a2d4a;border-radius:10px;padding:16px;text-align:center;">
            <span style="color:#E8A838;font-size:24px;font-weight:700;display:block;">${data.statesCount}</span>
            <span style="color:#C8C0B0;font-size:12px;display:block;">States</span>
          </td>
          <td style="background:#1a2d4a;border-radius:10px;padding:16px;text-align:center;">
            <span style="color:#E8A838;font-size:24px;font-weight:700;display:block;">${data.badgesCount}</span>
            <span style="color:#C8C0B0;font-size:12px;display:block;">Badges</span>
          </td>
        </tr>
      </table>`,
      p("The roads are still out there. What's next?"),
      btn('https://www.rvunicorn.com/basecamp', 'Back to Basecamp \u2192'),
    ].join('\n'),
  };
}
