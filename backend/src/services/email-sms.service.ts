import { Resend } from 'resend';
import twilio from 'twilio';

// Resend email client
const resend = new Resend(process.env.RESEND_API_KEY);

// Twilio client (only if enabled)
const twilioClient = process.env.ENABLE_SMS_NOTIFICATIONS === 'true' && process.env.TWILIO_ACCOUNT_SID
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * Override the From address for this specific send. Useful when the
   * default EMAIL_FROM env var is not a verified Resend sender for the
   * domain the app uses (e.g. password resets need to go from a
   * known-good verified address).
   */
  from?: string;
  /**
   * If true, send the email even when ENABLE_EMAIL_NOTIFICATIONS is off.
   * Used for security-critical mail like password resets and account
   * verification, which should never be gated by the user's notification
   * preferences env flag.
   */
  bypassPreferences?: boolean;
}

interface SMSOptions {
  to: string;
  message: string;
}

// Hardcoded verified-sender fallback used when EMAIL_FROM is unset OR when
// sendEmail is called with an explicit `from` that should be respected. The
// `updates.rvunicorn.com` subdomain is the one that's actually verified in
// Resend (it's what the invite emails use successfully).
const VERIFIED_SENDER_FALLBACK = 'RVUnicorn <hitch@updates.rvunicorn.com>';

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!options.bypassPreferences && process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    console.log('Email notifications disabled. Would have sent:', options.subject);
    return;
  }

  const fromAddress = options.from || process.env.EMAIL_FROM || VERIFIED_SENDER_FALLBACK;

  try {
    const result: any = await resend.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    // Resend returns { data, error } — if error is set, throw so the
    // caller can log a real failure instead of seeing a silent success.
    if (result?.error) {
      console.error('Resend rejected email:', { to: options.to, from: fromAddress, error: result.error });
      throw new Error(result.error.message || JSON.stringify(result.error));
    }
    console.log(`Email sent to ${options.to}: ${options.subject}`);
  } catch (error: any) {
    console.error('Send email error:', { to: options.to, from: fromAddress, message: error?.message, error });
    // Don't throw - just log the error so app continues
  }
};

export const sendSMS = async (options: SMSOptions): Promise<void> => {
  if (process.env.ENABLE_SMS_NOTIFICATIONS !== 'true') {
    console.log('SMS notifications disabled. Would have sent:', options.message);
    return;
  }

  if (!twilioClient) {
    console.log('Twilio not configured. Skipping SMS.');
    return;
  }

  try {
    await twilioClient.messages.create({
      body: options.message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: options.to,
    });
    console.log(`SMS sent to ${options.to}`);
  } catch (error) {
    console.error('Send SMS error:', error);
    // Don't throw - just log the error so app continues
  }
};

// ─── RVUnicorn base HTML template ──────────────────────────────────────────
const baseHtml = (body: string) => [
  '<!DOCTYPE html><html><head><meta charset="utf-8">',
  '<style>',
  'body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}',
  '.w{max-width:600px;margin:0 auto;padding:32px 16px}',
  '.card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}',
  '.hdr{background:linear-gradient(135deg,#1a1f2e,#1e2535);padding:32px;text-align:center}',
  '.hdr h1{color:#f59e0b;font-size:22px;font-weight:800;margin:12px 0 0}',
  '.bd{padding:32px}.bd p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}',
  '.box{background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:16px 20px;margin:20px 0}',
  '.box p{margin:0;color:#92400e;font-size:14px}',
  '.btn{display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff!important;',
  'text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;margin:8px 0}',
  '.ft{padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center}',
  '.ft p{color:#94a3b8;font-size:12px;margin:4px 0}.ft a{color:#64748b}',
  '</style></head><body><div class="w"><div class="card">',
  '<div class="hdr"><div style="font-size:32px">&#x1F984;</div><h1>RVUnicorn</h1></div>',
  '<div class="bd">', body, '</div>',
  '<div class="ft">',
  '<p>You are receiving this because you have email notifications enabled.</p>',
  '<p><a href="https://www.rvunicorn.com/settings">Manage notification preferences</a></p>',
  '<p style="margin-top:12px;color:#cbd5e1">&copy; RVUnicorn &middot; Your camping community</p>',
  '</div></div></div></body></html>'
].join('');

export const newMessageEmail = (params: {
  recipientName: string; senderName: string; senderUsername: string; preview: string;
}) => ({
  subject: 'New message from ' + params.senderName + ' on RVUnicorn',
  html: baseHtml(
    '<p>Hey ' + params.recipientName + '!</p>' +
    '<p><strong>' + params.senderName + '</strong> sent you a message on RVUnicorn:</p>' +
    '<div class="box"><p>&ldquo;' + params.preview.slice(0, 200) + (params.preview.length > 200 ? '...' : '') + '&rdquo;</p></div>' +
    '<p><a href="https://www.rvunicorn.com/messages" class="btn">View Message &rarr;</a></p>'
  ),
  text: 'Hey ' + params.recipientName + '! ' + params.senderName + ' sent you a message:\n\n"' + params.preview + '"\n\nReply at: https://www.rvunicorn.com/messages'
});

export const notificationEmail = (params: {
  recipientName: string; title: string; content: string; link?: string; emoji?: string;
}) => ({
  subject: (params.emoji || '') + ' ' + params.title + ' - RVUnicorn',
  html: baseHtml(
    '<p>Hey ' + params.recipientName + '!</p>' +
    '<p>' + params.content + '</p>' +
    (params.link ? '<p><a href="https://www.rvunicorn.com' + params.link + '" class="btn">View on RVUnicorn &rarr;</a></p>' : '')
  ),
  text: params.title + '\n\n' + params.content + (params.link ? '\n\nView at: https://www.rvunicorn.com' + params.link : '')
});

export const friendRequestEmail = (params: {
  recipientName: string; senderName: string; senderUsername: string;
}) => ({
  subject: params.senderName + ' wants to connect on RVUnicorn',
  html: baseHtml(
    '<p>Hey ' + params.recipientName + '!</p>' +
    '<p><strong>' + params.senderName + '</strong> (@' + params.senderUsername + ') sent you a friend request!</p>' +
    '<p>Connect with fellow RVers to share trips, tips, and adventures.</p>' +
    '<p><a href="https://www.rvunicorn.com/friends" class="btn">View Friend Request &rarr;</a></p>'
  ),
  text: params.senderName + ' sent you a friend request on RVUnicorn!\n\nView it at: https://www.rvunicorn.com/friends'
});

export const mentionEmail = (params: {
  recipientName: string; mentionedBy: string; context: string; link?: string;
}) => ({
  subject: params.mentionedBy + ' mentioned you on RVUnicorn',
  html: baseHtml(
    '<p>Hey ' + params.recipientName + '!</p>' +
    '<p><strong>' + params.mentionedBy + '</strong> mentioned you:</p>' +
    '<div class="box"><p>&ldquo;' + params.context + '&rdquo;</p></div>' +
    (params.link ? '<p><a href="https://www.rvunicorn.com' + params.link + '" class="btn">See the Post &rarr;</a></p>' : '')
  ),
  text: params.mentionedBy + ' mentioned you on RVUnicorn:\n\n"' + params.context + '"' + (params.link ? '\n\nView at: https://www.rvunicorn.com' + params.link : '')
});


// ─── Welcome Email ────────────────────────────────────────────────────────────
export const welcomeEmail = (params: { firstName: string }) => ({
  subject: 'Welcome to RVUnicorn! 🎉🦄',
  html: baseHtml(
    '<p style="font-size:18px;font-weight:700;color:#1a1f2e;margin:0 0 16px">Hey ' + params.firstName + ', welcome to the herd! 🦄</p>' +
    '<p>We are seriously excited you are here.</p>' +
    '<p>RVUnicorn was created by a husband-and-wife team who love camping, road trips, and the people you meet along the way. After years of traveling the country, swapping stories at campgrounds, and planning the next trip before the current one ended, we realized something was missing&hellip;</p>' +
    '<p>A place where campers and RVers could actually <strong>engage with each other</strong>, share real experiences, and feel like part of a community &mdash; not just users on a map.</p>' +
    '<p><strong>That is why we built RVUnicorn.</strong></p>' +

    '<div class="box" style="margin:24px 0">' +
    '<p style="font-size:15px;font-weight:700;color:#92400e;margin:0 0 12px">&#x1F3D5; What you can do as a member</p>' +
    '<p style="margin:6px 0">&#x1F91D; <strong>Engage with each other</strong> &mdash; comment, react, and connect with people who share your interests</p>' +
    '<p style="margin:6px 0">&#x1F4A1; <strong>Share ideas &amp; get ideas</strong> &mdash; campgrounds, routes, tips, tricks, and must-see spots</p>' +
    '<p style="margin:6px 0">&#x1F5FA; <strong>Discover and track campgrounds</strong> you have visited, loved, or want to visit</p>' +
    '<p style="margin:6px 0">&#x1F690; <strong>Manage your rig</strong> &mdash; keep track of your setup, preferences, and camping style</p>' +
    '<p style="margin:6px 0">&#x1F4CD; <strong>See who is nearby</strong> and what others are doing at campsites around the country</p>' +
    '<p style="margin:6px 0">&#x1F3C6; <strong>Earn badges and pins</strong> for trips, milestones, and adventures</p>' +
    '<p style="margin:6px 0">&#x1F5E3; <strong>Be part of the conversation</strong> &mdash; whether you are planning a trip or sitting at a campsite right now</p>' +
    '<p style="margin:6px 0">&#x2B50; <strong>Favorite, wishlist, or mute</strong> campgrounds based on what works for you</p>' +
    '</div>' +

    '<p>Whether you are a weekend camper, a full-timer, or just getting started &mdash; <strong>you belong here.</strong></p>' +
    '<p>This is not just another camping site. It is a growing community where stories, experiences, and connections matter as much as the destination.</p>' +

    '<p style="text-align:center;margin:28px 0 8px">' +
    '<a href="https://www.rvunicorn.com/basecamp" class="btn" style="margin-right:8px">Explore RVUnicorn &rarr;</a>' +
    '</p>' +
    '<p style="text-align:center;margin:0 0 8px">' +
    '<a href="https://www.rvunicorn.com/my-rv" style="display:inline-block;color:#d97706;font-weight:600;font-size:14px;text-decoration:underline;margin:4px 8px">Add Your Rig</a>' +
    '<a href="https://www.rvunicorn.com/campgrounds" style="display:inline-block;color:#d97706;font-weight:600;font-size:14px;text-decoration:underline;margin:4px 8px">Discover Campgrounds</a>' +
    '<a href="https://www.rvunicorn.com/profile" style="display:inline-block;color:#d97706;font-weight:600;font-size:14px;text-decoration:underline;margin:4px 8px">Complete Your Profile</a>' +
    '</p>' +

    '<p style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:20px">Jump in, explore, and say hello. Find your herd. Share your journey. Go the distance.</p>' +
    '<p style="margin:0">See you out there,<br><strong>Will &amp; Deanna</strong><br><span style="color:#94a3b8;font-size:13px">Founders, RVUnicorn &#x1F984;</span></p>' +
    '<p style="margin-top:16px;font-size:13px;color:#6b7280"><em>P.S. This is just the beginning &mdash; new features, badges, and ways to connect are always rolling in &#x1F690;&#x2728;</em></p>'
  ),
  text: [
    "Hey " + params.firstName + ", welcome to RVUnicorn!",
    "",
    "We are seriously excited you are here.",
    "",
    "RVUnicorn is a community-first platform for people who love camping and RV life.",
    "",
    "What you can do:",
    "- Engage with other campers",
    "- Share ideas and get inspiration",
    "- Discover and track campgrounds",
    "- Manage your rig",
    "- Earn badges for trips and milestones",
    "- Be part of the conversation while camping or planning",
    "",
    "Get started: https://www.rvunicorn.com/basecamp",
    "Add your rig: https://www.rvunicorn.com/my-rv",
    "",
    "See you out there,",
    "Will & Deanna",
    "Founders, RVUnicorn"
  ].join("\n")
});


// ─── Campground Owner Welcome Email ─────────────────────────────────────────
export const campgroundWelcomeEmail = (params: {
  ownerName: string;
  campgroundName: string;
  campgroundId: string;
}) => ({
  subject: 'Welcome to RVUnicorn! Your campground is now verified 🏕️🦄',
  html: baseHtml(
    '<p style="font-size:18px;font-weight:700;color:#1a1f2e;margin:0 0 8px">Congratulations, ' + params.ownerName + '!</p>' +
    '<p style="margin:0 0 20px;color:#6b7280">Your campground <strong>' + params.campgroundName + '</strong> is now verified on RVUnicorn.</p>' +

    '<div class="box" style="margin:0 0 24px">' +
    '<p style="font-weight:700;color:#92400e;margin:0 0 8px">&#x1F91D; Welcome to the Community</p>' +
    '<p style="margin:0;font-size:14px">RVUnicorn is a community-first platform connecting thousands of campers and RV enthusiasts. As a verified campground, you are now part of a growing network of destinations that real campers discover, review, and share every day.</p>' +
    '</div>' +

    '<p style="font-weight:700;color:#1a1f2e;font-size:16px;margin:0 0 12px">&#x1F3D5; Your Campground Dashboard</p>' +
    '<p style="margin:0 0 16px;font-size:14px;color:#374151">Log in and visit your campground dashboard to get started. Here is everything you can do:</p>' +

    '<div style="background:#f8fafc;border-radius:12px;padding:20px;margin:0 0 24px">' +
    '<p style="margin:0 0 10px;font-size:14px">&#x1F4F8; <strong>Add Photos &amp; Media</strong> &mdash; showcase your best sites, amenities, and scenery to attract more campers</p>' +
    '<p style="margin:0 0 10px;font-size:14px">&#x1F4E3; <strong>Post Announcements</strong> &mdash; let your followers know about openings, events, or updates in real time</p>' +
    '<p style="margin:0 0 10px;font-size:14px">&#x1F4C5; <strong>Create Events</strong> &mdash; host rallies, themed weekends, or community gatherings and promote them to the RVUnicorn community</p>' +
    '<p style="margin:0 0 10px;font-size:14px">&#x1F3E0; <strong>Manage Rentals</strong> &mdash; list cabins, glamping tents, or gear rentals directly on your campground page</p>' +
    '<p style="margin:0 0 10px;font-size:14px">&#x2B50; <strong>Collect Reviews</strong> &mdash; campers can rate and review your campground, building trust and visibility</p>' +
    '<p style="margin:0 0 10px;font-size:14px">&#x1F4CA; <strong>View Analytics</strong> &mdash; see how many people are viewing, following, and checking in at your campground</p>' +
    '<p style="margin:0;font-size:14px">&#x1F465; <strong>Manage Your Team</strong> &mdash; add staff members as admins to help manage your campground profile</p>' +
    '</div>' +

    '<p style="font-weight:700;color:#1a1f2e;font-size:16px;margin:0 0 12px">&#x1F3C6; Your Campground Badges</p>' +
    '<p style="margin:0 0 16px;font-size:14px;color:#374151">RVUnicorn rewards campgrounds that engage with the community. Badges appear on your campground profile and build credibility with campers:</p>' +
    '<div style="background:#f8fafc;border-radius:12px;padding:20px;margin:0 0 24px">' +
    '<p style="margin:0 0 8px;font-size:14px">&#x2705; <strong>Verified Campground</strong> &mdash; you already have this one!</p>' +
    '<p style="margin:0 0 8px;font-size:14px">&#x1F4F8; <strong>Photo Ready</strong> &mdash; add 10+ photos to your campground profile</p>' +
    '<p style="margin:0 0 8px;font-size:14px">&#x1F31F; <strong>Top Rated</strong> &mdash; maintain a 4.5+ star average from camper reviews</p>' +
    '<p style="margin:0 0 8px;font-size:14px">&#x1F465; <strong>Community Favorite</strong> &mdash; reach 50+ followers on your campground page</p>' +
    '<p style="margin:0 0 8px;font-size:14px">&#x1F4C5; <strong>Event Host</strong> &mdash; create and host your first community event</p>' +
    '<p style="margin:0;font-size:14px">&#x1F4E3; <strong>Active Voice</strong> &mdash; post 5+ announcements to keep campers informed</p>' +
    '</div>' +

    '<p style="font-weight:700;color:#1a1f2e;font-size:16px;margin:0 0 12px">&#x1F680; Upgrade Your Listing</p>' +
    '<p style="margin:0 0 16px;font-size:14px;color:#374151">Take your campground profile to the next level with our upgrade options:</p>' +
    '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:0 0 24px">' +
    '<p style="margin:0 0 12px;font-size:14px">&#x2B50; <strong>Featured Listing</strong> &mdash; appear at the top of search results and on the RVUnicorn homepage for maximum visibility</p>' +
    '<p style="margin:0 0 12px;font-size:14px">&#x1F4F0; <strong>Sponsored Posts</strong> &mdash; promote your announcements and events to campers beyond your followers</p>' +
    '<p style="margin:0 0 12px;font-size:14px">&#x1F3A8; <strong>Custom Branding</strong> &mdash; add your logo, brand colors, and a custom banner to make your page stand out</p>' +
    '<p style="margin:0;font-size:14px">&#x1F4CA; <strong>Advanced Analytics</strong> &mdash; get detailed insights on visitor demographics, peak interest times, and camper behavior</p>' +
    '</div>' +

    '<p style="text-align:center;margin:28px 0 8px">' +
    '<a href="https://www.rvunicorn.com/campgrounds/' + params.campgroundId + '/dashboard" class="btn">Go to Your Dashboard &rarr;</a>' +
    '</p>' +
    '<p style="text-align:center;margin:8px 0 0">' +
    '<a href="https://www.rvunicorn.com/campgrounds/' + params.campgroundId + '" style="color:#d97706;font-weight:600;font-size:14px">View Your Public Page</a>' +
    '</p>' +

    '<p style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:20px;font-size:14px;color:#374151">Have questions or need help getting set up? Reply to this email or reach out to us at <a href="mailto:will@rvunicorn.com" style="color:#d97706">will@rvunicorn.com</a> &mdash; we are happy to help.</p>' +
    '<p style="margin:0;font-size:14px">See you out there,<br><strong>Will &amp; Deanna</strong><br><span style="color:#94a3b8;font-size:13px">Founders, RVUnicorn &#x1F984;</span></p>'
  ),
  text: [
    "Congratulations " + params.ownerName + "!",
    "",
    params.campgroundName + " is now verified on RVUnicorn.",
    "",
    "Visit your dashboard to get started:",
    "https://www.rvunicorn.com/campgrounds/" + params.campgroundId + "/dashboard",
    "",
    "WHAT YOU CAN DO:",
    "- Add photos and media",
    "- Post announcements",
    "- Create events",
    "- Manage rentals",
    "- View analytics",
    "- Manage your team",
    "",
    "BADGES TO EARN:",
    "- Verified Campground (you have this!)",
    "- Photo Ready (add 10+ photos)",
    "- Top Rated (4.5+ star average)",
    "- Community Favorite (50+ followers)",
    "- Event Host (create an event)",
    "- Active Voice (post 5+ announcements)",
    "",
    "Questions? Email will@rvunicorn.com",
    "",
    "Will & Deanna",
    "Founders, RVUnicorn"
  ].join("\n")
});

// Maintenance reminder email templates
export const maintenanceReminderEmail = (params: {
  userName: string;
  reminderTitle: string;
  category: string;
  dueDate?: string;
  dueMileage?: number;
  description?: string;
}) => {
  const dueDateText = params.dueDate 
    ? `on ${new Date(params.dueDate).toLocaleDateString()}`
    : params.dueMileage 
    ? `at ${params.dueMileage.toLocaleString()} miles`
    : 'soon';

  return {
    subject: `🔧 RV Maintenance Reminder: ${params.reminderTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .reminder-box { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .category { display: inline-block; background: #667eea; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; margin-bottom: 10px; }
          .due-date { font-size: 18px; font-weight: bold; color: #dc2626; margin: 15px 0; }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔧 RV Maintenance Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${params.userName},</p>
            <p>This is a friendly reminder about upcoming RV maintenance:</p>
            
            <div class="reminder-box">
              <div class="category">${params.category}</div>
              <h2 style="margin: 10px 0;">${params.reminderTitle}</h2>
              ${params.description ? `<p>${params.description}</p>` : ''}
              <div class="due-date">📅 Due ${dueDateText}</div>
            </div>

            <p>Don't forget to log this service in your maintenance tracker after completion!</p>
            
            <a href="http://localhost:5173/profile" class="btn">View Maintenance Tracker</a>
          </div>
          <div class="footer">
            <p>This is an automated reminder from KindleTribe</p>
            <p>You can manage your reminders in your profile settings</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${params.userName},\n\nThis is a reminder about upcoming RV maintenance:\n\n${params.reminderTitle}\nCategory: ${params.category}\nDue: ${dueDateText}\n\n${params.description || ''}\n\nLog this service at: http://localhost:5173/profile\n\nKindleTribe`
  };
};


// ─── RV Unicorn branded base template ───────────────────────────────────────
const baseTemplate = (body: string) =>
  `<!DOCTYPE html>
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1f2e 0%, #1e2535 100%); padding: 32px; text-align: center; }
    .header img { height: 48px; width: auto; }
    .header h1 { color: #f59e0b; font-size: 22px; font-weight: 800; margin: 12px 0 0; letter-spacing: -0.02em; }
    .body { padding: 32px; }
    .body p { color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .highlight-box { background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .highlight-box p { margin: 0; color: #92400e; font-size: 14px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 8px 0; }
    .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
    .footer a { color: #64748b; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div style="font-size: 32px;">🦄</div>
        <h1>RVUnicorn</h1>
      </div>
      <div class="body">
        ' + body + '
      </div>
      <div class="footer">
        <p>You're receiving this because you have email notifications enabled.</p>
        <p><a href="https://www.rvunicorn.com/settings">Manage notification preferences</a></p>
        <p style="margin-top:12px; color: #cbd5e1;">© RVUnicorn · Your camping community</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ─── New Message Email ────────────────────────────────────────────────────────
export const maintenanceReminderSMS = (params: {
  reminderTitle: string;
  dueDate?: string;
  dueMileage?: number;
}) => {
  const dueDateText = params.dueDate 
    ? new Date(params.dueDate).toLocaleDateString()
    : params.dueMileage 
    ? `${params.dueMileage.toLocaleString()} mi`
    : 'soon';

  return `🔧 RV Maintenance Reminder: ${params.reminderTitle} is due ${dueDateText}. Check KindleTribe for details.`;
};

// Maintenance overdue email
export const maintenanceOverdueEmail = (params: {
  userName: string;
  reminderTitle: string;
  category: string;
  dueDate?: string;
  dueMileage?: number;
}) => {
  const dueDateText = params.dueDate 
    ? new Date(params.dueDate).toLocaleDateString()
    : params.dueMileage 
    ? `${params.dueMileage.toLocaleString()} miles`
    : '';

  return {
    subject: `⚠️ OVERDUE: RV Maintenance - ${params.reminderTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .category { display: inline-block; background: #dc2626; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; margin-bottom: 10px; }
          .overdue { font-size: 20px; font-weight: bold; color: #dc2626; margin: 15px 0; }
          .btn { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ OVERDUE Maintenance</h1>
          </div>
          <div class="content">
            <p>Hi ${params.userName},</p>
            <p><strong>This RV maintenance is overdue and needs attention:</strong></p>
            
            <div class="warning-box">
              <div class="category">${params.category}</div>
              <h2 style="margin: 10px 0;">${params.reminderTitle}</h2>
              <div class="overdue">⚠️ Was due: ${dueDateText}</div>
            </div>

            <p>Please schedule this service as soon as possible to keep your RV in top condition!</p>
            
            <a href="http://localhost:5173/profile" class="btn">View Maintenance Tracker</a>
          </div>
          <div class="footer">
            <p>This is an automated reminder from KindleTribe</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `⚠️ OVERDUE MAINTENANCE\n\nHi ${params.userName},\n\n${params.reminderTitle} (${params.category}) was due ${dueDateText}.\n\nPlease schedule this service ASAP!\n\nView tracker: http://localhost:5173/profile\n\nKindleTribe`
  };
};
