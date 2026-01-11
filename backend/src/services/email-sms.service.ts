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
