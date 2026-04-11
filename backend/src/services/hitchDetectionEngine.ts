import { prisma } from '../prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface SuggestedAction {
  id: string;
  icon: string;
  title: string;
  description: string;
  actionType: string;     // SEND_BROADCAST | ANSWER_FAQ | POST_PROMPT | SEND_WELCOME | WEATHER_ALERT
  actionPayload?: any;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  prefillMessage?: string;
}

export async function generateSuggestedActions(campgroundId: string): Promise<SuggestedAction[]> {
  const actions: SuggestedAction[] = [];
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const campground = await prisma.campground.findUnique({
    where: { id: campgroundId },
    select: { id: true, name: true },
  });
  if (!campground) return actions;

  // 1. Recent arrivals without welcome
  const recentCheckIns = await prisma.checkIn.findMany({
    where: { campgroundId, createdAt: { gte: oneHourAgo } },
    include: { user: { select: { id: true, firstName: true } } },
  });

  if (recentCheckIns.length > 0) {
    const names = recentCheckIns.slice(0, 3).map(c => c.user.firstName).join(', ');
    const extra = recentCheckIns.length > 3 ? ` +${recentCheckIns.length - 3} more` : '';
    actions.push({
      id: `arrival_${Date.now()}`,
      icon: '🚐',
      title: `${recentCheckIns.length} guest${recentCheckIns.length > 1 ? 's' : ''} arrived recently`,
      description: `${names}${extra} checked in within the last hour`,
      actionType: 'SEND_BROADCAST',
      priority: 'HIGH',
      prefillMessage: `Welcome to ${campground.name}! Glad you made it. Need anything? Drop a message in the campfire chat.`,
      actionPayload: { audience: 'ALL_CHECKED_IN' },
    });
  }

  // 2. Campfire chat analysis — repeated questions, quiet chat, complaints
  const campfireRoom = await (prisma as any).campfireRoom.findFirst({ where: { campgroundId } });
  if (campfireRoom) {
    const recentMessages = await (prisma as any).campfireMessage.findMany({
      where: { roomId: campfireRoom.id, createdAt: { gte: sixHoursAgo }, isSystem: false, isHitch: false },
      select: { content: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Quiet campfire detection
    const lastHourMessages = recentMessages.filter(
      (m: any) => new Date(m.createdAt).getTime() > oneHourAgo.getTime()
    );

    const totalCheckedIn = await prisma.checkIn.count({ where: { campgroundId } });

    if (totalCheckedIn > 3 && lastHourMessages.length < 2) {
      actions.push({
        id: `quiet_${Date.now()}`,
        icon: '🔇',
        title: 'Campfire is quiet',
        description: `${totalCheckedIn} guests on-site but only ${lastHourMessages.length} message${lastHourMessages.length !== 1 ? 's' : ''} in the last hour`,
        actionType: 'POST_PROMPT',
        priority: 'MEDIUM',
        prefillMessage: `What's everyone up to tonight? Any campfire stories to share? 🔥`,
        actionPayload: { audience: 'ALL_CHECKED_IN' },
      });
    }

    // Repeated questions detection
    if (recentMessages.length >= 5) {
      const questions = recentMessages
        .filter((m: any) => m.content.includes('?'))
        .map((m: any) => m.content.toLowerCase());

      // Simple keyword clustering for common topics
      const topicCounts: Record<string, number> = {};
      const topicKeywords: Record<string, string[]> = {
        wifi: ['wifi', 'wi-fi', 'internet', 'password', 'network'],
        bathroom: ['bathroom', 'restroom', 'shower', 'showers', 'toilet'],
        checkout: ['checkout', 'check out', 'check-out', 'leave', 'leaving'],
        pool: ['pool', 'swimming', 'hot tub', 'jacuzzi'],
        laundry: ['laundry', 'washer', 'dryer', 'wash'],
        firewood: ['firewood', 'fire wood', 'wood', 'firepit', 'fire pit'],
        store: ['store', 'shop', 'ice', 'propane'],
        quiet: ['quiet hours', 'noise', 'loud', 'quiet'],
        pets: ['dog', 'pet', 'leash', 'dogs', 'pets'],
      };

      for (const q of questions) {
        for (const [topic, keywords] of Object.entries(topicKeywords)) {
          if (keywords.some(kw => q.includes(kw))) {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
          }
        }
      }

      const hotTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0];
      if (hotTopic && hotTopic[1] >= 2) {
        actions.push({
          id: `repeated_${Date.now()}`,
          icon: '❓',
          title: `Guests keep asking about ${hotTopic[0]}`,
          description: `${hotTopic[1]} questions about ${hotTopic[0]} in the last 6 hours`,
          actionType: 'SEND_BROADCAST',
          priority: 'HIGH',
          prefillMessage: '', // Will be filled by AI below
          actionPayload: { audience: 'ALL_CHECKED_IN', topic: hotTopic[0] },
        });
      }
    }

    // Complaint/frustration detection
    const frustrationKeywords = ['broken', 'doesn\'t work', 'not working', 'terrible', 'awful', 'disgusting', 'dirty', 'filthy', 'rude', 'unacceptable', 'worst'];
    const complaints = recentMessages.filter((m: any) =>
      frustrationKeywords.some(kw => m.content.toLowerCase().includes(kw))
    );

    if (complaints.length >= 2) {
      actions.push({
        id: `complaint_${Date.now()}`,
        icon: '⚠️',
        title: 'Potential guest frustration detected',
        description: `${complaints.length} messages with complaint-like language in the last 6 hours`,
        actionType: 'SEND_BROADCAST',
        priority: 'HIGH',
        prefillMessage: `Hey everyone, if you're having any issues during your stay, please let us know — we want to make sure everything's perfect for you.`,
        actionPayload: { audience: 'ALL_CHECKED_IN' },
      });
    }
  }

  // 3. Upcoming event reminder
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const upcomingEvent = await (prisma as any).event.findFirst({
    where: {
      campgroundId,
      startDate: { gte: now, lte: twoHoursFromNow },
    },
    select: { id: true, title: true, startDate: true, _count: { select: { attendees: true } } },
  });

  if (upcomingEvent) {
    const startTime = new Date(upcomingEvent.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    actions.push({
      id: `event_${Date.now()}`,
      icon: '📅',
      title: `"${upcomingEvent.title}" starts soon`,
      description: `Starting at ${startTime} — ${upcomingEvent._count?.attendees || 0} RSVPs`,
      actionType: 'SEND_BROADCAST',
      priority: 'MEDIUM',
      prefillMessage: `Reminder: ${upcomingEvent.title} starts at ${startTime}! See you there.`,
      actionPayload: { audience: 'ALL_CHECKED_IN' },
    });
  }

  // Generate AI prefill for the repeated-question action if it exists
  const repeatedAction = actions.find(a => a.id.startsWith('repeated_') && !a.prefillMessage);
  if (repeatedAction) {
    try {
      const topic = repeatedAction.actionPayload?.topic || 'common questions';
      const aiRes = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Write a short, friendly campground broadcast (under 120 chars) answering common guest questions about "${topic}" at a campground. Be helpful and direct.`,
        }],
      });
      repeatedAction.prefillMessage = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '';
    } catch {
      repeatedAction.prefillMessage = `Quick heads up about ${repeatedAction.actionPayload?.topic}: if you have questions, just ask in the campfire chat!`;
    }
  }

  // Sort by priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return actions.slice(0, 5);
}
