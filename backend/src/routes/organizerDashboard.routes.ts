import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import { sendWebPush } from '../utils/webPush';
import { pushNotification } from './notification.routes';
import Anthropic from '@anthropic-ai/sdk';
import multer from 'multer';
import { generateSuggestedActions } from '../services/hitchDetectionEngine';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Verify campground ownership
async function verifyCampgroundOwner(userId: string, campgroundId: string): Promise<boolean> {
  const campground = await prisma.campground.findUnique({
    where: { id: campgroundId },
    select: { claimedById: true },
  });
  if (campground?.claimedById === userId) return true;

  // Check CampgroundAdmin table
  const admin = await (prisma as any).campgroundAdmin.findFirst({
    where: { campgroundId, userId },
  });
  return !!admin;
}

// ── TODAY LAYER ────────────────────────────────────────────────

router.get('/:campgroundId/today', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, name: true },
    });
    if (!campground) return res.status(404).json({ error: 'Campground not found' });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Checked in now — active check-ins at this campground
    const activeCheckIns = await prisma.checkIn.findMany({
      where: { campgroundId },
      include: { user: { select: { id: true, firstName: true, profilePicture: true, rvType: true, rvMake: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const checkedInNow = activeCheckIns.length;

    // Arriving today — trips with startDate = today at this campground
    const arrivingToday = await (prisma as any).event.findMany({
      where: {
        campgroundId,
        startDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        attendees: {
          take: 5,
          include: {
            user: { select: { id: true, firstName: true, profilePicture: true, rvType: true, rvMake: true } },
          },
        },
      },
    });
    const arrivingTodayCount = arrivingToday.reduce((sum: number, e: any) => sum + (e.attendees?.length || 0), 0);
    const arrivingTodayList = arrivingToday.flatMap((e: any) =>
      (e.attendees || []).slice(0, 5).map((a: any) => ({
        userId: a.user?.id,
        displayName: a.user?.firstName || 'Guest',
        avatarUrl: a.user?.profilePicture,
        rvType: a.user?.rvType,
        rvNickname: a.user?.rvMake,
      }))
    ).slice(0, 5);

    // Campfire activity (last 24h)
    const campfireRoom = await (prisma as any).campfireRoom.findFirst({ where: { campgroundId } });
    let campfireActivity = { messageCount24h: 0, activeUsers: 0, lastMessageAt: null as Date | null };
    if (campfireRoom) {
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const messages = await (prisma as any).campfireMessage.findMany({
        where: { roomId: campfireRoom.id, createdAt: { gte: dayAgo } },
        select: { userId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      const uniqueUsers = new Set(messages.map((m: any) => m.userId));
      campfireActivity = {
        messageCount24h: messages.length,
        activeUsers: uniqueUsers.size,
        lastMessageAt: messages[0]?.createdAt || null,
      };
    }

    // Live event
    const liveEvent = await (prisma as any).event.findFirst({
      where: {
        campgroundId,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { id: true, title: true, _count: { select: { attendees: true } } },
    });

    // Hitch suggestion — lightweight AI call
    let hitchSuggestion = '';
    try {
      const context = `Campground "${campground.name}" right now: ${checkedInNow} campers checked in, ${arrivingTodayCount} arriving today, campfire chat had ${campfireActivity.messageCount24h} messages in last 24h with ${campfireActivity.activeUsers} active users${liveEvent ? `, live event "${liveEvent.title}" with ${liveEvent._count?.attendees || 0} attendees` : ', no live event'}.`;

      const aiRes = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `You are Hitch, an AI campground assistant. Based on this context, suggest ONE specific action the campground organizer could take right now, in 1 sentence. Be practical and specific.\n\n${context}`,
        }],
      });
      hitchSuggestion = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '';
    } catch {
      hitchSuggestion = 'Check in with your guests — a quick welcome message goes a long way!';
    }

    res.json({
      checkedInNow,
      arrivingToday: arrivingTodayCount,
      arrivingTodayList,
      campfireActivity,
      liveEvent: liveEvent ? { id: liveEvent.id, title: liveEvent.title, attendeeCount: liveEvent._count?.attendees || 0 } : null,
      hitchSuggestion,
    });
  } catch (e: any) {
    console.error('[OrganizerDashboard] Today error:', e);
    res.status(500).json({ error: 'Failed to load today data' });
  }
});

// ── BROADCASTS ────────────────────────────────────────────────

router.get('/:campgroundId/broadcasts', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const broadcasts = await (prisma as any).organizerBroadcast.findMany({
      where: { campgroundId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ broadcasts });
  } catch (e) {
    console.error('[OrganizerDashboard] Broadcasts list error:', e);
    res.status(500).json({ error: 'Failed to load broadcasts' });
  }
});

router.post('/:campgroundId/broadcasts', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { message, type = 'GENERAL', audience = 'ALL_CHECKED_IN', eventId, scheduledFor } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true },
    });
    if (!campground) return res.status(404).json({ error: 'Campground not found' });

    if (scheduledFor) {
      // Scheduled broadcast — save for later
      const broadcast = await (prisma as any).organizerBroadcast.create({
        data: {
          campgroundId,
          authorId: req.userId,
          message: message.trim(),
          type,
          audience,
          eventId: eventId || null,
          scheduledFor: new Date(scheduledFor),
          status: 'SCHEDULED',
        },
      });
      return res.json({ broadcast });
    }

    // Immediate send — find recipients
    const recipientIds = await getRecipientIds(campgroundId, audience, eventId);

    // Send push notifications
    const title = `${campground.name} 📢`;
    await Promise.allSettled(
      recipientIds.map(async (userId) => {
        await sendWebPush(userId, { title, body: message.trim(), url: `/campgrounds/${campgroundId}` });
        await prisma.notification.create({
          data: {
            userId,
            type: 'BROADCAST',
            content: message.trim(),
            link: `/campgrounds/${campgroundId}`,
            category: 'CAMPGROUND',
            actorName: campground.name,
          },
        });
        pushNotification(userId, {
          type: 'BROADCAST',
          content: message.trim(),
          link: `/campgrounds/${campgroundId}`,
          actorName: campground.name,
        });
      })
    );

    const broadcast = await (prisma as any).organizerBroadcast.create({
      data: {
        campgroundId,
        authorId: req.userId,
        message: message.trim(),
        type,
        audience,
        eventId: eventId || null,
        status: 'SENT',
        sentAt: new Date(),
        recipientCount: recipientIds.length,
      },
    });

    console.log(`[Broadcast] ${campground.name}: "${message.trim().slice(0, 50)}..." → ${recipientIds.length} recipients`);
    res.json({ broadcast });
  } catch (e: any) {
    console.error('[OrganizerDashboard] Broadcast send error:', e);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

router.delete('/:campgroundId/broadcasts/:broadcastId', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId, broadcastId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const broadcast = await (prisma as any).organizerBroadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
    if (broadcast.status !== 'SCHEDULED') return res.status(400).json({ error: 'Can only cancel scheduled broadcasts' });

    await (prisma as any).organizerBroadcast.delete({ where: { id: broadcastId } });
    res.json({ success: true });
  } catch (e) {
    console.error('[OrganizerDashboard] Broadcast delete error:', e);
    res.status(500).json({ error: 'Failed to cancel broadcast' });
  }
});

// ── HITCH CONFIG ────────────────────────────────────────────

router.get('/:campgroundId/hitch-config', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let config = await (prisma as any).hitchCampgroundConfig.findUnique({ where: { campgroundId } });
    if (!config) {
      config = {
        personality: 'TRAIL_GUIDE',
        welcomeMessage: '',
        autoRespond: true,
        quietHoursStart: null,
        quietHoursEnd: null,
        faqIndexedAt: null,
        faqContent: null,
      };
    }

    res.json({ config });
  } catch (e) {
    console.error('[OrganizerDashboard] Hitch config error:', e);
    res.status(500).json({ error: 'Failed to load hitch config' });
  }
});

router.put('/:campgroundId/hitch-config', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { personality, welcomeMessage, autoRespond, quietHoursStart, quietHoursEnd } = req.body;

    const config = await (prisma as any).hitchCampgroundConfig.upsert({
      where: { campgroundId },
      update: {
        ...(personality !== undefined && { personality }),
        ...(welcomeMessage !== undefined && { welcomeMessage }),
        ...(autoRespond !== undefined && { autoRespond }),
        ...(quietHoursStart !== undefined && { quietHoursStart }),
        ...(quietHoursEnd !== undefined && { quietHoursEnd }),
      },
      create: {
        campgroundId,
        personality: personality || 'TRAIL_GUIDE',
        welcomeMessage: welcomeMessage || '',
        autoRespond: autoRespond !== false,
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
      },
    });

    res.json({ config });
  } catch (e) {
    console.error('[OrganizerDashboard] Hitch config update error:', e);
    res.status(500).json({ error: 'Failed to update hitch config' });
  }
});

router.post('/:campgroundId/hitch-config/upload-faq', authenticateToken, upload.single('file'), async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = req.file.originalname.split('.').pop()?.toLowerCase();
    let textContent = '';

    if (ext === 'pdf') {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(req.file.buffer);
      textContent = result.text;
    } else if (ext === 'txt' || ext === 'md') {
      textContent = req.file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Only .pdf, .txt, and .md files are accepted' });
    }

    const config = await (prisma as any).hitchCampgroundConfig.upsert({
      where: { campgroundId },
      update: {
        faqContent: textContent,
        faqIndexedAt: new Date(),
      },
      create: {
        campgroundId,
        faqContent: textContent,
        faqIndexedAt: new Date(),
      },
    });

    res.json({
      success: true,
      preview: textContent.slice(0, 500),
      totalChars: textContent.length,
      faqIndexedAt: config.faqIndexedAt,
    });
  } catch (e) {
    console.error('[OrganizerDashboard] FAQ upload error:', e);
    res.status(500).json({ error: 'Failed to process FAQ upload' });
  }
});

// ── ANALYTICS ────────────────────────────────────────────────

router.get('/:campgroundId/analytics', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // All-time stats
    const totalEvents = await (prisma as any).event.count({ where: { campgroundId } });
    const allAttendees = await (prisma as any).eventAttendee.findMany({
      where: { event: { campgroundId } },
      select: { userId: true },
    });
    const totalAttendees = allAttendees.length;
    const uniqueAttendeeIds = [...new Set(allAttendees.map((a: any) => a.userId))];

    const totalBroadcastsSent = await (prisma as any).organizerBroadcast.count({
      where: { campgroundId, status: 'SENT' },
    });

    // Unique visitors (check-ins)
    const allCheckIns = await prisma.checkIn.findMany({
      where: { campgroundId },
      select: { userId: true },
    });
    const uniqueVisitors = new Set(allCheckIns.map((c) => c.userId)).size;

    // Repeat visitor rate
    const visitCounts: Record<string, number> = {};
    allCheckIns.forEach((c) => {
      visitCounts[c.userId] = (visitCounts[c.userId] || 0) + 1;
    });
    const totalUniqueVisitors = Object.keys(visitCounts).length;
    const repeatVisitors = Object.values(visitCounts).filter((c) => c >= 2).length;
    const repeatVisitorRate = totalUniqueVisitors > 0 ? Math.round((repeatVisitors / totalUniqueVisitors) * 100) : 0;

    // Recent events with engagement
    const recentEvents = await (prisma as any).event.findMany({
      where: { campgroundId },
      orderBy: { startDate: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        _count: { select: { attendees: true } },
      },
    });

    const recentEventsWithEngagement = await Promise.all(
      recentEvents.map(async (e: any) => {
        // Campfire messages on event day
        const campfireRoom = await (prisma as any).campfireRoom.findFirst({ where: { campgroundId } });
        let campfireMessages = 0;
        if (campfireRoom) {
          campfireMessages = await (prisma as any).campfireMessage.count({
            where: {
              roomId: campfireRoom.id,
              createdAt: { gte: new Date(e.startDate), lte: new Date(e.endDate || e.startDate) },
            },
          });
        }

        // Attendees who checked in again after event
        const attendeeIds = (await (prisma as any).eventAttendee.findMany({
          where: { eventId: e.id },
          select: { userId: true },
        })).map((a: any) => a.userId);

        let returnedSince = 0;
        if (attendeeIds.length > 0 && e.endDate) {
          returnedSince = await prisma.checkIn.count({
            where: {
              campgroundId,
              userId: { in: attendeeIds },
              createdAt: { gt: new Date(e.endDate) },
            },
          });
        }

        return {
          id: e.id,
          title: e.title,
          date: e.startDate,
          attendeeCount: e._count?.attendees || 0,
          campfireMessages,
          returnedSince,
        };
      })
    );

    // Top broadcasts
    const topBroadcasts = await (prisma as any).organizerBroadcast.findMany({
      where: { campgroundId, status: 'SENT' },
      orderBy: { recipientCount: 'desc' },
      take: 3,
      select: { message: true, recipientCount: true, type: true, sentAt: true },
    });

    res.json({
      allTime: {
        totalEvents,
        totalAttendees,
        totalBroadcastsSent,
        uniqueVisitors,
        repeatVisitorRate,
      },
      recentEvents: recentEventsWithEngagement,
      topBroadcasts: topBroadcasts.map((b: any) => ({
        message: b.message.slice(0, 60),
        recipientCount: b.recipientCount,
        type: b.type,
        sentAt: b.sentAt,
      })),
    });
  } catch (e) {
    console.error('[OrganizerDashboard] Analytics error:', e);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ── SUGGESTED ACTIONS (Hitch Detection Engine) ────────────

router.get('/:campgroundId/suggested-actions', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const actions = await generateSuggestedActions(campgroundId);
    res.json({ actions });
  } catch (e: any) {
    console.error('[OrganizerDashboard] Suggested actions error:', e);
    res.status(500).json({ error: 'Failed to generate suggested actions' });
  }
});

// ── AI BROADCAST ASSIST ──────────────────────────────────

router.post('/:campgroundId/broadcast-assist', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    if (!(await verifyCampgroundOwner(req.userId, campgroundId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { message, action } = req.body;
    if (!message?.trim() || !action) {
      return res.status(400).json({ error: 'Message and action are required' });
    }

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true },
    });

    const prompts: Record<string, string> = {
      shorten: `Shorten this campground broadcast to under 80 characters while keeping the core message. Campground: "${campground?.name}". Message: "${message}". Return ONLY the shortened message, nothing else.`,
      engaging: `Rewrite this campground broadcast to be more engaging and fun, while keeping it under 160 characters. Add personality. Campground: "${campground?.name}". Message: "${message}". Return ONLY the rewritten message, nothing else.`,
      push: `Optimize this message for a mobile push notification — make it punchy, under 60 characters, with an emoji. Campground: "${campground?.name}". Message: "${message}". Return ONLY the optimized message, nothing else.`,
    };

    const prompt = prompts[action];
    if (!prompt) return res.status(400).json({ error: 'Invalid action. Use: shorten, engaging, or push' });

    const aiRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const result = aiRes.content[0].type === 'text' ? aiRes.content[0].text.trim() : '';
    res.json({ message: result });
  } catch (e) {
    console.error('[OrganizerDashboard] Broadcast assist error:', e);
    res.status(500).json({ error: 'Failed to process AI assist' });
  }
});

// ── HELPERS ────────────────────────────────────────────────

async function getRecipientIds(campgroundId: string, audience: string, eventId?: string): Promise<string[]> {
  switch (audience) {
    case 'ALL_CHECKED_IN': {
      const checkIns = await prisma.checkIn.findMany({
        where: { campgroundId },
        select: { userId: true },
      });
      return Array.from(new Set(checkIns.map((c) => c.userId)));
    }
    case 'ARRIVING_TODAY': {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const events = await (prisma as any).event.findMany({
        where: { campgroundId, startDate: { gte: todayStart, lt: todayEnd } },
        include: { attendees: { select: { userId: true } } },
      });
      const ids = events.flatMap((e: any) => e.attendees.map((a: any) => a.userId));
      return Array.from(new Set(ids));
    }
    case 'EVENT_ATTENDEES': {
      if (!eventId) return [];
      const attendees = await (prisma as any).eventAttendee.findMany({
        where: { eventId },
        select: { userId: true },
      });
      return attendees.map((a: any) => a.userId);
    }
    default:
      return [];
  }
}

// Export for use by broadcast cron
export { getRecipientIds };

export default router;
