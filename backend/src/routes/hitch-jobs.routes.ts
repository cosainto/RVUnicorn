import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const HITCH_USER_ID = 'hitch-ai-bot-user-rvunicorn';

// POST /api/hitch/jobs/meal-reminder
// Called by a cron job every 15 minutes
// Checks events that: have 3+ attendees, were created 15+ min ago, have no meal plan entries, and haven't been reminded yet
router.post('/meal-reminder', async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find events created 15+ min ago that are upcoming, have 3+ attendees, no meals, no Hitch comment yet
    const events = await (prisma as any).event.findMany({
      where: {
        createdAt: { lte: fifteenMinutesAgo },
        startDate: { gte: new Date() },
        isWishlist: false,
      },
      include: {
        attendees: { where: { status: 'GOING' } },
        meals: true,
        comments: { where: { userId: HITCH_USER_ID } },
      },
    });

    let reminded = 0;

    for (const event of events) {
      const goingCount = event.attendees.length + 1; // +1 for organizer
      const hasMeals = event.meals.length > 0;
      const alreadyReminded = event.comments.length > 0;

      if (goingCount < 3 || hasMeals || alreadyReminded) continue;

      // Build @mentions for all attendees + organizer
      const userIds = [event.organizerId, ...event.attendees.map((a: any) => a.userId)];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { username: true },
      });

      const mentions = users.map(u => `@${u.username}`).join(' ');

      const message = `Hey ${mentions} 👋\n\nOne of the best parts of camping together is sharing meals! 🍳🌭 Use the **Meal Plan** tab to claim your day and add a recipe link so everyone knows what you'll be cooking. And don't forget to invite the crew!`;

      // Post comment as Hitch
      await (prisma as any).eventComment.create({
        data: {
          eventId: event.id,
          userId: HITCH_USER_ID,
          content: message,
        },
      });

      // Notify all attendees
      await prisma.notification.createMany({
        data: userIds.map(uid => ({
          userId: uid,
          type: 'EVENT_COMMENT',
          content: `Hitch has a tip for your trip "${event.title}" 🍳`,
          link: `/trips/${event.id}`,
        })),
        skipDuplicates: true,
      });

      reminded++;
    }

    res.json({ success: true, reminded });
  } catch (error) {
    console.error('Hitch meal reminder error:', error);
    res.status(500).json({ error: 'Failed to run meal reminder' });
  }
});

export default router;
