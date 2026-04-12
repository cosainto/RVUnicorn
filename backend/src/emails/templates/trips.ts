import { h1, h2, p, btn, card, amber, statsRow, divider } from '../baseTemplate';

export function tripCreated(data: {
  firstName: string; tripTitle: string; tripId: string;
  daysOut: number; driveMiles: number; fuelEstimate: number;
  campgroundName?: string; campgroundState?: string;
  rigFitsFlag?: string;
}) {
  return {
    subject: `Trip saved: ${data.tripTitle} \u{1F5FA}\uFE0F`,
    previewText: `${data.driveMiles} miles, ~$${data.fuelEstimate} in fuel, ${data.daysOut} days to go.`,
    bodyHtml: [
      h1(`${data.tripTitle} is locked in! \u{1F389}`),
      p("I've saved your trip and I'll keep an eye on weather, road conditions, and campground alerts as you get closer to departure."),
      statsRow([
        { value: String(data.daysOut), label: 'Days Away' },
        { value: `${data.driveMiles}mi`, label: 'Est. Drive' },
        { value: `$${data.fuelEstimate}`, label: 'Fuel Cost' },
      ]),
      data.campgroundName
        ? p(`Your destination: <strong style="color:#F5F0E8;">${data.campgroundName}, ${data.campgroundState || ''}</strong>`)
        : '',
      data.rigFitsFlag
        ? card(`<p style="color:#F5F0E8;margin:0;">\u26A0\uFE0F <strong>Heads up:</strong> ${data.rigFitsFlag}</p>`, true)
        : '',
      btn(`https://www.rvunicorn.com/road-trips/${data.tripId}`, 'View My Trip \u2192'),
      btn(`https://www.rvunicorn.com/road-trips/${data.tripId}`, 'Add Stops', true),
    ].join('\n'),
  };
}

export function preTripBriefing(data: {
  firstName: string; tripTitle: string; score: number;
  departureDate: string; arrivalDate: string;
  driveWeather?: string; campWeather?: string;
  fuelEstimate?: number; fuelGallons?: number; pricePerGallon?: number;
  flags: Array<{ label: string; detail: string; severityColor: string; action?: string; actionUrl?: string }>;
  passedChecks: string[];
}) {
  const scoreColor = data.score >= 80 ? '#22c55e' : data.score >= 60 ? '#E8A838' : '#ef4444';
  const statusLabel = data.score >= 80 ? 'Looking Great' : data.score >= 60 ? 'A Few Things to Check' : 'Needs Attention';

  return {
    subject: `${data.tripTitle} is in 7 days \u2014 your full road intel \u{1F9ED}`,
    previewText: `Confidence score: ${data.score}/100. ${data.flags.length} things to check.`,
    bodyHtml: [
      h1(`T-minus 7 days, ${data.firstName} \u{1F690}`),
      p(`I've been tracking ${data.tripTitle} and here's everything you need to know before you leave.`),
      // Confidence score
      card(`<div style="text-align:center;padding:8px;">
        <span style="font-size:48px;font-weight:800;color:${scoreColor};">${data.score}</span>
        <span style="color:#C8C0B0;font-size:16px;">/100</span>
        <p style="margin:8px 0 0;font-size:18px;color:${scoreColor};font-weight:600;">${statusLabel}</p>
      </div>`),
      divider(),
      // Weather
      data.driveWeather ? [
        h2('\u{1F321}\uFE0F Weather'),
        card(`<p style="color:#C8C0B0;margin:0 0 8px;">Drive day (${data.departureDate}): <strong style="color:#F5F0E8;">${data.driveWeather}</strong></p>
              <p style="color:#C8C0B0;margin:0;">At camp (${data.arrivalDate}): <strong style="color:#F5F0E8;">${data.campWeather || 'Checking...'}</strong></p>`),
      ].join('\n') : '',
      // Fuel
      data.fuelEstimate ? [
        h2('\u26FD Fuel'),
        card(`<p style="color:#C8C0B0;margin:0;">Estimated cost: <strong style="color:#F5F0E8;">$${data.fuelEstimate}</strong> (~${data.fuelGallons} gallons at $${data.pricePerGallon}/gal)</p>`),
      ].join('\n') : '',
      // Flags
      data.flags.length > 0 ? [
        h2('\u26A0\uFE0F Check These'),
        ...data.flags.map(f =>
          `<div style="background:#1a2d4a;border-radius:12px;padding:20px;margin:16px 0;border-left:3px solid ${f.severityColor};">
            <p style="color:#F5F0E8;font-weight:600;margin:0 0 4px;">${f.label}</p>
            <p style="color:#C8C0B0;margin:0 0 8px;font-size:14px;">${f.detail}</p>
            ${f.actionUrl ? `<a href="${f.actionUrl}" style="color:#E8A838;font-size:14px;">${f.action || 'Fix this'} \u2192</a>` : ''}
          </div>`
        ),
      ].join('\n') : '',
      // Passed
      data.passedChecks.length > 0 ? [
        h2('\u2705 All Clear'),
        ...data.passedChecks.map(c => `<p style="color:#C8C0B0;margin:0 0 8px;">\u2705 ${c}</p>`),
      ].join('\n') : '',
      btn('https://www.rvunicorn.com/basecamp', 'Open Full Trip Intel \u2192'),
    ].join('\n'),
  };
}

export function postTrip(data: {
  firstName: string; tripTitle: string; tripId: string;
  campgroundName?: string; scrapbookToken?: string;
}) {
  return {
    subject: `How was ${data.tripTitle}? \u{1F4F8}`,
    previewText: 'Share your memories before they fade.',
    bodyHtml: [
      h1(`Welcome back, ${data.firstName}! \u{1F3E0}`),
      p(`${data.tripTitle} is in the books. ${data.campgroundName ? `How was ${amber(data.campgroundName)}?` : "How was the trip?"}`),
      p("Before the memories fade, take 2 minutes to:"),
      card(`<p style="color:#F5F0E8;margin:0;">\u{1F4F8} <strong>Upload your best photos</strong> to your trip scrapbook</p>`, true),
      card(`<p style="color:#F5F0E8;margin:0;">\u2B50 <strong>Leave a review</strong> for the campground \u2014 future travelers will thank you</p>`, true),
      card(`<p style="color:#F5F0E8;margin:0;">\u{1F5FA}\uFE0F <strong>Update your travel map</strong> with the states you visited</p>`, true),
      data.scrapbookToken
        ? btn(`https://www.rvunicorn.com/s/${data.scrapbookToken}`, 'Open My Scrapbook \u2192')
        : btn(`https://www.rvunicorn.com/road-trips/${data.tripId}`, 'View My Trip \u2192'),
    ].join('\n'),
  };
}

export function tripAnniversary(data: {
  firstName: string; tripTitle: string; campgroundName: string; state?: string;
  scrapbookToken?: string; photos: Array<{ url: string }>;
  caption?: string; rigNickname?: string;
}) {
  return {
    subject: `One year ago today, you were at ${data.campgroundName} \u{1F4F8}`,
    previewText: `Your ${data.tripTitle} scrapbook is waiting for you.`,
    bodyHtml: [
      h1("One year ago today... \u{1F305}"),
      p(`You were rolling into <strong style="color:#F5F0E8;">${data.campgroundName}${data.state ? `, ${data.state}` : ''}</strong> in ${data.rigNickname || 'your rig'}. I still remember it.`, true),
      data.photos.length > 0
        ? `<table width="100%" cellpadding="4" style="margin:16px 0;">
            <tr>${data.photos.slice(0, 3).map(ph =>
              `<td width="33%" style="vertical-align:top;">
                <a href="https://www.rvunicorn.com/s/${data.scrapbookToken || ''}">
                  <img src="${ph.url}" width="100%" style="border-radius:8px;display:block;" alt="Trip memory">
                </a>
              </td>`
            ).join('')}</tr>
          </table>`
        : '',
      data.caption ? card(`<p style="font-style:italic;color:#F5F0E8;margin:0;">"${data.caption}"</p>`, true) : '',
      p(`The roads are still out there, ${amber(data.firstName)}. Where are you heading next?`),
      data.scrapbookToken
        ? btn(`https://www.rvunicorn.com/s/${data.scrapbookToken}`, 'Relive the Trip \u2192')
        : '',
      btn('https://www.rvunicorn.com/road-trips/new', 'Plan Something New', true),
    ].join('\n'),
  };
}

export function friendTripOverlap(data: {
  firstName: string; friendName: string; friendFirstName: string;
  friendId: string; tripId: string;
  campground: string; state?: string;
  overlapDays: number; friendArrival: string; yourArrival: string;
}) {
  return {
    subject: `${data.friendName} is heading to ${data.campground} around the same time \u{1F919}`,
    previewText: "Your paths might cross. Want to make it official?",
    bodyHtml: [
      h1("Looks like your paths might cross! \u{1F6E3}\uFE0F"),
      p(`<strong style="color:#F5F0E8;">${data.friendName}</strong> just planned a trip to <strong style="color:#F5F0E8;">${data.campground}${data.state ? `, ${data.state}` : ''}</strong> \u2014 and so did you.`),
      statsRow([
        { value: String(data.overlapDays), label: 'Days Overlap' },
        { value: data.friendArrival, label: 'Their Arrival' },
        { value: data.yourArrival, label: 'Your Arrival' },
      ]),
      p(`This doesn't happen by accident \u2014 ${amber("this is the magic of RVUnicorn.")}`),
      btn(`https://www.rvunicorn.com/messages/${data.friendId}`, `Message ${data.friendFirstName} \u2192`),
      btn(`https://www.rvunicorn.com/road-trips/${data.tripId}`, 'View My Trip', true),
    ].join('\n'),
  };
}
