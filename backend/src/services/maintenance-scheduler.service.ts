import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
// import { sendEmail, sendSMS, maintenanceReminderEmail, maintenanceReminderSMS, maintenanceOverdueEmail } from './email.service';

const prisma = new PrismaClient() as any;

// Stub functions until email.service is implemented
const sendEmail: any = async (_opts: any) => {};
const sendSMS: any = async (_opts: any) => {};
const maintenanceReminderEmail: any = (_opts: any) => ({ subject: '', html: '', text: '' });
const maintenanceReminderSMS: any = (_opts: any) => '';
const maintenanceOverdueEmail: any = (_opts: any) => ({ subject: '', html: '', text: '' });




// Check for upcoming and overdue reminders
const checkMaintenanceReminders = async () => {
  try {
    console.log('Checking maintenance reminders...');

    const today = new Date();
    const reminderDays = parseInt(process.env.MAINTENANCE_REMINDER_DAYS || '7');
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + reminderDays);

    // Find upcoming reminders (due within reminder days)
    const upcomingReminders = await prisma.maintenanceReminder.findMany({
      where: {
        isActive: true,
        nextDueDate: {
          gte: today,
          lte: futureDate,
        },
        OR: [
          { lastNotified: null },
          {
            lastNotified: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Not notified in last 24 hours
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Find overdue reminders
    const overdueReminders = await prisma.maintenanceReminder.findMany({
      where: {
        isActive: true,
        nextDueDate: {
          lt: today,
        },
        OR: [
          { lastNotified: null },
          {
            lastNotified: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Not notified in last 24 hours
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    console.log(`Found ${upcomingReminders.length} upcoming reminders and ${overdueReminders.length} overdue reminders`);

    // Send notifications for upcoming reminders
    for (const reminder of upcomingReminders) {
      const userName = `${reminder.user.firstName} ${reminder.user.lastName}`;

      // Send email
      if (reminder.user.email) {
        const emailContent = maintenanceReminderEmail({
          userName,
          reminderTitle: reminder.title,
          category: reminder.category,
          dueDate: reminder.nextDueDate?.toISOString(),
          dueMileage: reminder.nextDueMileage || undefined,
          description: reminder.description || undefined,
        });

        await sendEmail({
          to: reminder.user.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
      }

      // Send SMS if enabled and user has phone
      if (reminder.user.phone) {
        const smsContent = maintenanceReminderSMS({
          reminderTitle: reminder.title,
          dueDate: reminder.nextDueDate?.toISOString(),
          dueMileage: reminder.nextDueMileage || undefined,
        });

        await sendSMS({
          to: reminder.user.phone,
          message: smsContent,
        });
      }

      // Update last notified timestamp
      await prisma.maintenanceReminder.update({
        where: { id: reminder.id },
        data: { lastNotified: new Date() },
      });
    }

    // Send notifications for overdue reminders
    for (const reminder of overdueReminders) {
      const userName = `${reminder.user.firstName} ${reminder.user.lastName}`;

      // Send email
      if (reminder.user.email) {
        const emailContent = maintenanceOverdueEmail({
          userName,
          reminderTitle: reminder.title,
          category: reminder.category,
          dueDate: reminder.nextDueDate?.toISOString(),
          dueMileage: reminder.nextDueMileage || undefined,
        });

        await sendEmail({
          to: reminder.user.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
      }

      // Send SMS if enabled and user has phone
      if (reminder.user.phone) {
        const smsContent = `⚠️ OVERDUE: ${reminder.title} maintenance is overdue. Check KindleTribe for details.`;

        await sendSMS({
          to: reminder.user.phone,
          message: smsContent,
        });
      }

      // Update last notified timestamp
      await prisma.maintenanceReminder.update({
        where: { id: reminder.id },
        data: { lastNotified: new Date() },
      });
    }

    console.log('Maintenance reminder check completed');
  } catch (error: any) {
    console.error('Check maintenance reminders error:', error);
  }
};

// Start the scheduler
export const startMaintenanceScheduler = () => {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running scheduled maintenance reminder check...');
    await checkMaintenanceReminders();
  });

  // Also run every 6 hours as a backup
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running backup maintenance reminder check...');
    await checkMaintenanceReminders();
  });

  console.log('✅ Maintenance reminder scheduler started');
  console.log('📅 Daily check: 9:00 AM');
  console.log('🔄 Backup check: Every 6 hours');

  // Run once on startup (for testing)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 Running initial check (development mode)...');
    setTimeout(() => checkMaintenanceReminders(), 5000);
  }
};

// Export for manual testing
export const testMaintenanceReminders = checkMaintenanceReminders;
