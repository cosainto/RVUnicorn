// security-emails.ts
// Add this file to: ~/Downloads/kindletribe-mvp/backend/src/services/security-emails.ts

import { sendEmail } from './email-sms.service';

const APP_NAME = 'RVUnicorn';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Common email header/footer
const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .alert-box { padding: 20px; margin: 20px 0; border-radius: 8px; }
    .alert-warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .alert-danger { background: #fee2e2; border-left: 4px solid #dc2626; }
    .alert-success { background: #d1fae5; border-left: 4px solid #10b981; }
    .alert-info { background: #dbeafe; border-left: 4px solid #3b82f6; }
    .btn { display: inline-block; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 15px; font-weight: bold; }
    .btn-primary { background: #1e3a5f; color: white; }
    .btn-danger { background: #dc2626; color: white; }
    .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; font-size: 14px; }
    .details-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .details-label { font-weight: bold; width: 120px; color: #6b7280; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
    .footer a { color: #1e3a5f; }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p>This is an automated security notification from ${APP_NAME}</p>
      <p>If you didn't make this change, please <a href="${APP_URL}/settings/activity">review your account activity</a> immediately.</p>
      <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// Password Changed Notification
export const sendPasswordChangedEmail = async (params: {
  email: string;
  firstName: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}) => {
  const deviceInfo = parseUserAgent(params.userAgent);
  
  const html = emailWrapper(`
    <div class="header">
      <h1>🔐 Password Changed</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>
      <p>Your ${APP_NAME} password was successfully changed.</p>
      
      <div class="alert-box alert-success">
        <strong>✓ Password Updated</strong>
        <p style="margin: 10px 0 0 0;">Your account password has been changed.</p>
      </div>

      <div class="details">
        <div class="details-row">
          <span class="details-label">Time:</span>
          <span>${params.timestamp.toLocaleString()}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Device:</span>
          <span>${deviceInfo}</span>
        </div>
        ${params.ipAddress ? `
        <div class="details-row">
          <span class="details-label">IP Address:</span>
          <span>${params.ipAddress}</span>
        </div>
        ` : ''}
      </div>

      <div class="alert-box alert-warning">
        <strong>⚠️ Wasn't you?</strong>
        <p style="margin: 10px 0 0 0;">If you didn't change your password, your account may be compromised. Please reset your password immediately and review your account activity.</p>
      </div>

      <a href="${APP_URL}/settings/activity" class="btn btn-primary">Review Account Activity</a>
    </div>
  `);

  await sendEmail({
    to: params.email,
    subject: `🔐 Your ${APP_NAME} password was changed`,
    html,
    text: `Hi ${params.firstName},\n\nYour ${APP_NAME} password was changed on ${params.timestamp.toLocaleString()}.\n\nIf you didn't make this change, please reset your password immediately.\n\n${APP_NAME}`
  });
};

// New Login from New Device/Location
export const sendNewLoginEmail = async (params: {
  email: string;
  firstName: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  location?: string;
}) => {
  const deviceInfo = parseUserAgent(params.userAgent);
  
  const html = emailWrapper(`
    <div class="header">
      <h1>🔔 New Login Detected</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>
      <p>We noticed a new login to your ${APP_NAME} account.</p>
      
      <div class="alert-box alert-info">
        <strong>New Sign-in</strong>
        <p style="margin: 10px 0 0 0;">Your account was accessed from a new device or location.</p>
      </div>

      <div class="details">
        <div class="details-row">
          <span class="details-label">Time:</span>
          <span>${params.timestamp.toLocaleString()}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Device:</span>
          <span>${deviceInfo}</span>
        </div>
        ${params.ipAddress ? `
        <div class="details-row">
          <span class="details-label">IP Address:</span>
          <span>${params.ipAddress}</span>
        </div>
        ` : ''}
        ${params.location ? `
        <div class="details-row">
          <span class="details-label">Location:</span>
          <span>${params.location}</span>
        </div>
        ` : ''}
      </div>

      <p>If this was you, no action is needed.</p>

      <div class="alert-box alert-warning">
        <strong>⚠️ Wasn't you?</strong>
        <p style="margin: 10px 0 0 0;">If you don't recognize this activity, please change your password immediately.</p>
      </div>

      <a href="${APP_URL}/settings/activity" class="btn btn-primary">Review Account Activity</a>
    </div>
  `);

  await sendEmail({
    to: params.email,
    subject: `🔔 New login to your ${APP_NAME} account`,
    html,
    text: `Hi ${params.firstName},\n\nWe noticed a new login to your ${APP_NAME} account on ${params.timestamp.toLocaleString()}.\n\nDevice: ${deviceInfo}\n\nIf this wasn't you, please change your password immediately.\n\n${APP_NAME}`
  });
};

// Account Deletion Requested
export const sendDeletionRequestedEmail = async (params: {
  email: string;
  firstName: string;
  scheduledDate: Date;
  ipAddress?: string;
  timestamp: Date;
}) => {
  const html = emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
      <h1>⚠️ Account Deletion Requested</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>
      <p>We received a request to delete your ${APP_NAME} account.</p>
      
      <div class="alert-box alert-danger">
        <strong>Account Scheduled for Deletion</strong>
        <p style="margin: 10px 0 0 0;">Your account and all associated data will be permanently deleted on:</p>
        <p style="font-size: 20px; font-weight: bold; margin: 10px 0;">${params.scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div class="details">
        <div class="details-row">
          <span class="details-label">Requested:</span>
          <span>${params.timestamp.toLocaleString()}</span>
        </div>
        ${params.ipAddress ? `
        <div class="details-row">
          <span class="details-label">IP Address:</span>
          <span>${params.ipAddress}</span>
        </div>
        ` : ''}
      </div>

      <h3>What will be deleted:</h3>
      <ul>
        <li>Your profile and all personal information</li>
        <li>All posts, comments, and reactions</li>
        <li>Photos and albums</li>
        <li>Recipes and saved recipes</li>
        <li>Trip plans and travel history</li>
        <li>Friend connections</li>
      </ul>

      <div class="alert-box alert-warning">
        <strong>Changed your mind?</strong>
        <p style="margin: 10px 0 0 0;">You can cancel this request anytime before the deletion date by logging in and visiting your account settings.</p>
      </div>

      <a href="${APP_URL}/settings/delete-account" class="btn btn-primary">Cancel Deletion Request</a>
    </div>
  `);

  await sendEmail({
    to: params.email,
    subject: `⚠️ Your ${APP_NAME} account is scheduled for deletion`,
    html,
    text: `Hi ${params.firstName},\n\nYour ${APP_NAME} account is scheduled for deletion on ${params.scheduledDate.toLocaleDateString()}.\n\nIf you didn't request this, please log in immediately to cancel the deletion.\n\n${APP_NAME}`
  });
};

// Account Deletion Cancelled
export const sendDeletionCancelledEmail = async (params: {
  email: string;
  firstName: string;
  timestamp: Date;
}) => {
  const html = emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
      <h1>✓ Deletion Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>
      <p>Good news! Your ${APP_NAME} account deletion has been cancelled.</p>
      
      <div class="alert-box alert-success">
        <strong>✓ Your account is safe</strong>
        <p style="margin: 10px 0 0 0;">Your account and all your data will remain intact. Welcome back!</p>
      </div>

      <p>If you didn't cancel this deletion request, please review your account security immediately.</p>

      <a href="${APP_URL}/basecamp" class="btn btn-primary">Go to ${APP_NAME}</a>
    </div>
  `);

  await sendEmail({
    to: params.email,
    subject: `✓ Your ${APP_NAME} account deletion was cancelled`,
    html,
    text: `Hi ${params.firstName},\n\nYour ${APP_NAME} account deletion has been cancelled. Your account and all data will remain intact.\n\nWelcome back!\n\n${APP_NAME}`
  });
};

// User Blocked Notification (optional - some apps don't notify)
export const sendUserBlockedEmail = async (params: {
  email: string;
  firstName: string;
  blockedUsername: string;
  timestamp: Date;
}) => {
  const html = emailWrapper(`
    <div class="header">
      <h1>🚫 User Blocked</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>
      <p>You have successfully blocked <strong>@${params.blockedUsername}</strong>.</p>
      
      <div class="alert-box alert-info">
        <strong>What this means:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>They can no longer see your profile</li>
          <li>They can't send you messages or friend requests</li>
          <li>Their posts won't appear in your feed</li>
          <li>Any existing friendship has been removed</li>
        </ul>
      </div>

      <p>You can manage your blocked users list anytime in your settings.</p>

      <a href="${APP_URL}/settings/blocked" class="btn btn-primary">Manage Blocked Users</a>
    </div>
  `);

  await sendEmail({
    to: params.email,
    subject: `You blocked @${params.blockedUsername} on ${APP_NAME}`,
    html,
    text: `Hi ${params.firstName},\n\nYou have blocked @${params.blockedUsername} on ${APP_NAME}.\n\nThey can no longer see your profile, send you messages, or interact with you.\n\nManage blocked users: ${APP_URL}/settings/blocked\n\n${APP_NAME}`
  });
};

// Privacy Settings Changed
export const sendPrivacyChangedEmail = async (params: {
  email: string;
  firstName: string;
  changes: string[];
  ipAddress?: string;
  timestamp: Date;
}) => {
  const html = emailWrapper(`
    <div class="header">
      <h1>🔒 Privacy Settings Updated</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>
      <p>Your ${APP_NAME} privacy settings have been updated.</p>
      
      <div class="alert-box alert-info">
        <strong>Changes made:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          ${params.changes.map(change => `<li>${change}</li>`).join('')}
        </ul>
      </div>

      <div class="details">
        <div class="details-row">
          <span class="details-label">Time:</span>
          <span>${params.timestamp.toLocaleString()}</span>
        </div>
        ${params.ipAddress ? `
        <div class="details-row">
          <span class="details-label">IP Address:</span>
          <span>${params.ipAddress}</span>
        </div>
        ` : ''}
      </div>

      <p>If you didn't make these changes, please review your account security.</p>

      <a href="${APP_URL}/settings/privacy" class="btn btn-primary">Review Privacy Settings</a>
    </div>
  `);

  await sendEmail({
    to: params.email,
    subject: `🔒 Your ${APP_NAME} privacy settings were updated`,
    html,
    text: `Hi ${params.firstName},\n\nYour ${APP_NAME} privacy settings were updated.\n\nChanges:\n${params.changes.map(c => `- ${c}`).join('\n')}\n\nIf you didn't make these changes, please review your account security.\n\n${APP_NAME}`
  });
};

// Failed Login Attempts Warning
export const sendFailedLoginWarningEmail = async (params: {
  email: string;
  firstName: string;
  attemptCount: number;
  ipAddress?: string;
  timestamp: Date;
}) => {
  const html = emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
      <h1>⚠️ Failed Login Attempts</h1>
    </div>
    <div class="content">
      <p>Hi ${params.firstName},</p>
      <p>We detected multiple failed login attempts on your ${APP_NAME} account.</p>
      
      <div class="alert-box alert-warning">
        <strong>Security Alert</strong>
        <p style="margin: 10px 0 0 0;">There have been <strong>${params.attemptCount} failed login attempts</strong> on your account.</p>
      </div>

      <div class="details">
        <div class="details-row">
          <span class="details-label">Time:</span>
          <span>${params.timestamp.toLocaleString()}</span>
        </div>
        ${params.ipAddress ? `
        <div class="details-row">
          <span class="details-label">IP Address:</span>
          <span>${params.ipAddress}</span>
        </div>
        ` : ''}
      </div>

      <p>If this was you trying to log in, please reset your password if you've forgotten it.</p>
      <p>If this wasn't you, someone may be trying to access your account. We recommend:</p>
      <ul>
        <li>Changing your password to something strong and unique</li>
        <li>Reviewing your recent account activity</li>
        <li>Enabling two-factor authentication if available</li>
      </ul>

      <a href="${APP_URL}/settings/activity" class="btn btn-danger">Review Account Activity</a>
    </div>
  `);

  await sendEmail({
    to: params.email,
    subject: `⚠️ Failed login attempts on your ${APP_NAME} account`,
    html,
    text: `Hi ${params.firstName},\n\nWe detected ${params.attemptCount} failed login attempts on your ${APP_NAME} account.\n\nIf this wasn't you, please change your password immediately.\n\n${APP_NAME}`
  });
};

// Helper function to parse user agent
function parseUserAgent(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';
  
  // Simple parsing - could be enhanced with a library like 'ua-parser-js'
  let device = 'Unknown device';
  let browser = '';
  let os = '';

  // Detect OS
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  // Detect Browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';

  if (os && browser) {
    device = `${browser} on ${os}`;
  } else if (os) {
    device = os;
  } else if (browser) {
    device = browser;
  }

  return device;
}

export default {
  sendPasswordChangedEmail,
  sendNewLoginEmail,
  sendDeletionRequestedEmail,
  sendDeletionCancelledEmail,
  sendUserBlockedEmail,
  sendPrivacyChangedEmail,
  sendFailedLoginWarningEmail
};
