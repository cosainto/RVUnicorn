import nodemailer from 'nodemailer';
import twilio from 'twilio';

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Twilio client (only if enabled)
const twilioClient = process.env.ENABLE_SMS_NOTIFICATIONS === 'true' && process.env.TWILIO_ACCOUNT_SID
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SMSOptions {
  to: string;
  message: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    console.log('Email notifications disabled. Would have sent:', options.subject);
    return;
  }

  try {
    await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM || 'KindleTribe <noreply@kindletribe.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    console.log(`Email sent to ${options.to}: ${options.subject}`);
  } catch (error) {
    console.error('Send email error:', error);
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
    '<p>We're seriously excited you're here.</p>' +
    '<p>RVUnicorn was created by a husband-and-wife team who love camping, road trips, and the people you meet along the way. After years of traveling the country, swapping stories at campgrounds, and planning the next trip before the current one ended, we realized something was missing&hellip;</p>' +
    '<p>A place where campers and RVers could actually <strong>engage with each other</strong>, share real experiences, and feel like part of a community &mdash; not just users on a map.</p>' +
    '<p><strong>That's why we built RVUnicorn.</strong></p>' +

    '<div class="box" style="margin:24px 0">' +
    '<p style="font-size:15px;font-weight:700;color:#92400e;margin:0 0 12px">&#x1F3D5; What you can do as a member</p>' +
    '<p style="margin:6px 0">&#x1F91D; <strong>Engage with each other</strong> &mdash; comment, react, and connect with people who share your interests</p>' +
    '<p style="margin:6px 0">&#x1F4A1; <strong>Share ideas &amp; get ideas</strong> &mdash; campgrounds, routes, tips, tricks, and must-see spots</p>' +
    '<p style="margin:6px 0">&#x1F5FA; <strong>Discover and track campgrounds</strong> you've visited, loved, or want to visit</p>' +
    '<p style="margin:6px 0">&#x1F690; <strong>Manage your rig</strong> &mdash; keep track of your setup, preferences, and camping style</p>' +
    '<p style="margin:6px 0">&#x1F4CD; <strong>See who's nearby</strong> and what others are doing at campsites around the country</p>' +
    '<p style="margin:6px 0">&#x1F3C6; <strong>Earn badges and pins</strong> for trips, milestones, and adventures</p>' +
    '<p style="margin:6px 0">&#x1F5E3; <strong>Be part of the conversation</strong> &mdash; whether you're planning a trip or sitting at a campsite right now</p>' +
    '<p style="margin:6px 0">&#x2B50; <strong>Favorite, wishlist, or mute</strong> campgrounds based on what works for you</p>' +
    '</div>' +

    '<p>Whether you're a weekend camper, a full-timer, or just getting started &mdash; <strong>you belong here.</strong></p>' +
    '<p>This isn't just another camping site. It's a growing community where stories, experiences, and connections matter as much as the destination.</p>' +

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
    "We're seriously excited you're here.",
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
export const newMessageEmail = (params: {
  recipientName: string;
  senderName: string;
  senderUsername: string;
  preview: string;
}) => ({
  subject: `💬 New message from ${params.senderName} on RVUnicorn`,
  html: baseTemplate(`
    <p>Hey ${params.recipientName}! 👋</p>
    <p><strong>${params.senderName}</strong> sent you a message on RVUnicorn:</p>
    <div class="highlight-box">
      <p>"${params.preview.length > 200 ? params.preview.slice(0, 200) + '...' : params.preview}"</p>
    </div>
    <p>
      <a href="https://www.rvunicorn.com/messages" class="btn">View Message →</a>
    </p>
  `),
  text: `Hey ${params.recipientName}! ${params.senderName} sent you a message on RVUnicorn:

"${params.preview}"

Reply at: https://www.rvunicorn.com/messages`
});

// ─── Notification Email ───────────────────────────────────────────────────────
export const notificationEmail = (params: {
  recipientName: string;
  title: string;
  content: string;
  link?: string;
  emoji?: string;
}) => ({
  subject: `${params.emoji || '🔔'} ${params.title} — RVUnicorn`,
  html: baseTemplate(`
    <p>Hey ${params.recipientName}! 👋</p>
    <p>${params.content}</p>
    ${params.link ? `<p><a href="https://www.rvunicorn.com${params.link}" class="btn">View on RVUnicorn →</a></p>` : ''}
  `),
  text: `${params.title}

${params.content}

${params.link ? 'View at: https://www.rvunicorn.com' + params.link : ''}`
});

// ─── Friend Request Email ─────────────────────────────────────────────────────
export const friendRequestEmail = (params: {
  recipientName: string;
  senderName: string;
  senderUsername: string;
}) => ({
  subject: `🤝 ${params.senderName} wants to connect on RVUnicorn`,
  html: baseTemplate(`
    <p>Hey ${params.recipientName}! 👋</p>
    <p><strong>${params.senderName}</strong> (@${params.senderUsername}) sent you a friend request on RVUnicorn!</p>
    <p>Connect with fellow RVers to share trips, tips, and adventures.</p>
    <p>
      <a href="https://www.rvunicorn.com/friends" class="btn">View Friend Request →</a>
    </p>
  `),
  text: `${params.senderName} sent you a friend request on RVUnicorn!

View it at: https://www.rvunicorn.com/friends`
});

// ─── Mention Email ────────────────────────────────────────────────────────────
export const mentionEmail = (params: {
  recipientName: string;
  mentionedBy: string;
  context: string;
  link?: string;
}) => ({
  subject: `📣 ${params.mentionedBy} mentioned you on RVUnicorn`,
  html: baseTemplate(`
    <p>Hey ${params.recipientName}! 👋</p>
    <p><strong>${params.mentionedBy}</strong> mentioned you:</p>
    <div class="highlight-box">
      <p>"${params.context}"</p>
    </div>
    ${params.link ? `<p><a href="https://www.rvunicorn.com${params.link}" class="btn">See the Post →</a></p>` : ''}
  `),
  text: `${params.mentionedBy} mentioned you on RVUnicorn:

"${params.context}"

${params.link ? 'View at: https://www.rvunicorn.com' + params.link : ''}`
});

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
