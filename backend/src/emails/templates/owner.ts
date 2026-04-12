import { h1, h2, p, btn, card, amber, statsRow, divider } from '../baseTemplate';

export function ownerWeeklyDigest(data: {
  firstName: string; campgroundName: string; campgroundId: string;
  checkinCount: number; newFollowers: number; pageViews: number; reviews: number;
  hitchSuggestion: string; hitchActionUrl: string; hitchActionLabel: string;
  latestReview?: { content: string; authorName: string; rating: number };
}) {
  return {
    subject: `${data.campgroundName} \u2014 your week in review \u{1F4CA}`,
    previewText: `${data.checkinCount} check-ins, ${data.newFollowers} new followers, ${data.reviews} reviews.`,
    bodyHtml: [
      h1(`Here's how ${data.campgroundName} did this week \u{1F3D5}\uFE0F`),
      p(`Hey ${data.firstName}, here's everything that happened at your campground.`),
      statsRow([
        { value: String(data.checkinCount), label: 'Check-ins' },
        { value: String(data.newFollowers), label: 'New Followers' },
        { value: String(data.pageViews), label: 'Page Views' },
        { value: String(data.reviews), label: 'New Reviews' },
      ]),
      card([
        `<p style="color:#E8A838;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">\u{1F3AF} Hitch Suggests</p>`,
        `<p style="color:#F5F0E8;margin:0 0 12px;">${data.hitchSuggestion}</p>`,
        `<a href="${data.hitchActionUrl}" style="color:#E8A838;font-size:14px;">${data.hitchActionLabel} \u2192</a>`,
      ].join('\n'), true),
      data.latestReview ? [
        h2("\u2B50 Latest Guest Review"),
        card([
          `<p style="color:#C8C0B0;font-style:italic;margin:0 0 8px;">"${data.latestReview.content.slice(0, 300)}"</p>`,
          `<p style="font-size:13px;color:#C8C0B0;margin:0;">\u2014 ${data.latestReview.authorName} \u00B7 ${'&#x2B50;'.repeat(data.latestReview.rating)}</p>`,
        ].join('\n')),
      ].join('\n') : '',
      btn('https://www.rvunicorn.com/organizer', 'Open My Dashboard \u2192'),
    ].join('\n'),
  };
}

export function ownerPotentialEnergy(data: {
  firstName: string; campgroundName: string; pageViews: number;
}) {
  return {
    subject: `${data.pageViews} RVers checked out ${data.campgroundName} this week \u{1F440}`,
    previewText: "You can't see who they are \u2014 yet.",
    bodyHtml: [
      h1("People are looking at your campground \u{1F440}"),
      p(`${data.campgroundName} got <strong style="color:#F5F0E8;">${data.pageViews} profile views</strong> this week. Real RVers, actively planning trips.`),
      `<div style="background:#1a2d4a;border-radius:12px;padding:28px;margin:16px 0;text-align:center;filter:blur(4px);user-select:none;">
        <p style="font-size:18px;color:#F5F0E8;margin:0;">
          \u{1F690} Miller Family \u00B7 Class A \u00B7 Texas<br>
          \u{1F464} @adventuremom \u00B7 Solo traveler<br>
          \u{1F68C} The Rodriguez Crew \u00B7 5th wheel
        </p>
      </div>`,
      `<p style="font-size:13px;color:#C8C0B0;text-align:center;margin-top:-8px;">\u2191 Upgrade to Base Camp to see exactly who's looking</p>`,
      p("Right now they're browsing. With Base Camp, you can reach out, post updates they'll see, and turn browsers into bookings."),
      btn('https://www.rvunicorn.com/business/upgrade', "See Who's Looking \u2192"),
    ].join('\n'),
  };
}

export function ownerNewReview(data: {
  firstName: string; campgroundName: string; campgroundId: string;
  reviewerName: string; rating: number; content: string;
}) {
  return {
    subject: `New ${data.rating}-star review for ${data.campgroundName} \u2B50`,
    previewText: `${data.reviewerName}: "${data.content.slice(0, 60)}..."`,
    bodyHtml: [
      h1(`New review for ${data.campgroundName} \u2B50`),
      p(`<strong style="color:#F5F0E8;">${data.reviewerName}</strong> left a ${data.rating}-star review:`),
      card(`<p style="color:#C8C0B0;font-style:italic;margin:0 0 8px;">"${data.content.slice(0, 400)}"</p>
            <p style="color:#C8C0B0;font-size:13px;margin:0;">${'&#x2B50;'.repeat(data.rating)}</p>`),
      p("Responding to reviews builds trust and shows you care."),
      btn(`https://www.rvunicorn.com/business/${data.campgroundId}`, 'Respond to Review \u2192'),
    ].join('\n'),
  };
}

export function ownerGuestArriving(data: {
  firstName: string; campgroundName: string;
  guestCount: number; guestNames: string[];
}) {
  return {
    subject: `${data.guestCount} RVUnicorn member${data.guestCount > 1 ? 's' : ''} arriving at ${data.campgroundName} today`,
    previewText: data.guestNames.slice(0, 3).join(', '),
    bodyHtml: [
      h1(`Guests arriving today! \u{1F690}`),
      p(`${data.guestCount} RVUnicorn member${data.guestCount > 1 ? 's have' : ' has'} ${data.campgroundName} on their trip today:`),
      ...data.guestNames.slice(0, 5).map(name =>
        card(`<p style="color:#F5F0E8;margin:0;">\u{1F44B} ${name}</p>`)
      ),
      data.guestCount > 5
        ? p(`...and ${data.guestCount - 5} more`)
        : '',
      btn('https://www.rvunicorn.com/organizer', 'Open Dashboard \u2192'),
    ].join('\n'),
  };
}
