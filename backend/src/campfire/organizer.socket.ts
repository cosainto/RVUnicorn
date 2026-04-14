import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';

/**
 * /organizer namespace — real-time activity feed for campground owners.
 *
 * Organizer connects with { campgroundId, userId } query params.
 * Joins a room keyed by campgroundId.
 * Receives: activity:new events pushed from check-in routes, campfire chat, etc.
 */

// In-memory store for emitting events from other parts of the app
let organizerNamespace: any = null;

export function getOrganizerNamespace() {
  return organizerNamespace;
}

export function emitOrganizerActivity(campgroundId: string, activity: {
  type: 'CHECKIN' | 'CHECKOUT' | 'CHAT_MESSAGE' | 'CHAT_SPIKE' | 'FAQ_QUESTION' | 'HITCH_RESPONSE' | 'BROADCAST_SENT' | 'EVENT_RSVP';
  title: string;
  subtitle?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  actionLabel?: string;
  actionType?: string;
  actionPayload?: any;
  timestamp?: string;
}) {
  if (!organizerNamespace) return;
  organizerNamespace.to(campgroundId).emit('activity:new', {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...activity,
    timestamp: activity.timestamp || new Date().toISOString(),
  });
}

export function registerOrganizerSockets(io: Server) {
  const organizer = io.of('/organizer');
  organizerNamespace = organizer;

  organizer.on('connection', async (socket: Socket) => {
    const campgroundId = socket.handshake.query.campgroundId as string;
    const userId = socket.handshake.query.userId as string;

    if (!campgroundId || !userId) {
      socket.disconnect();
      return;
    }

    // Verify ownership
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { claimedById: true },
    });
    const isAdmin = await (prisma as any).campgroundAdmin.findFirst({
      where: { campgroundId, userId },
    });

    if (campground?.claimedById !== userId && !isAdmin) {
      socket.disconnect();
      return;
    }

    socket.join(campgroundId);

    // Send recent activity snapshot on connect
    try {
      const snapshot = await buildActivitySnapshot(campgroundId);
      socket.emit('activity:snapshot', snapshot);
    } catch (e: any) {
      console.error('[OrganizerSocket] Snapshot error:', e);
    }

    socket.on('disconnect', () => {
      // Cleanup if needed
    });
  });

  console.log('[OrganizerSocket] Registered /organizer namespace');
}

async function buildActivitySnapshot(campgroundId: string) {
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const activities: any[] = [];

  // Recent check-ins (last 6 hours)
  const recentCheckIns = await prisma.checkIn.findMany({
    where: { campgroundId, createdAt: { gte: sixHoursAgo } },
    include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  for (const ci of recentCheckIns) {
    activities.push({
      id: `ci_${ci.id}`,
      type: 'CHECKIN',
      title: `${ci.user.firstName} ${ci.user.lastName || ''} checked in`,
      subtitle: ci.siteNumber ? `Site ${ci.siteNumber}` : undefined,
      userId: ci.user.id,
      userName: ci.user.firstName,
      userAvatar: ci.user.profilePicture,
      actionLabel: 'Welcome',
      actionType: 'SEND_WELCOME',
      actionPayload: { userId: ci.user.id, userName: ci.user.firstName },
      timestamp: ci.createdAt.toISOString(),
    });
  }

  // Recent campfire messages (last 6 hours, non-system)
  const campfireRoom = await (prisma as any).campfireRoom.findFirst({ where: { campgroundId } });
  if (campfireRoom) {
    const recentMessages = await (prisma as any).campfireMessage.findMany({
      where: { roomId: campfireRoom.id, createdAt: { gte: sixHoursAgo }, isSystem: false, isHitch: false },
      include: { user: { select: { id: true, firstName: true, profilePicture: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    for (const msg of recentMessages) {
      const isQuestion = /\?$|^(what|where|when|how|is|are|can|do)\b/i.test(msg.content.trim());
      activities.push({
        id: `msg_${msg.id}`,
        type: isQuestion ? 'FAQ_QUESTION' : 'CHAT_MESSAGE',
        title: isQuestion
          ? `${msg.user?.firstName || 'Guest'} asked a question`
          : `${msg.user?.firstName || 'Guest'} posted in campfire`,
        subtitle: msg.content.slice(0, 80) + (msg.content.length > 80 ? '...' : ''),
        userId: msg.user?.id,
        userName: msg.user?.firstName,
        userAvatar: msg.user?.profilePicture,
        actionLabel: isQuestion ? 'Answer' : undefined,
        actionType: isQuestion ? 'ANSWER_QUESTION' : undefined,
        timestamp: msg.createdAt.toISOString(),
      });
    }

    // Hitch auto-responses
    const hitchMessages = await (prisma as any).campfireMessage.findMany({
      where: { roomId: campfireRoom.id, createdAt: { gte: sixHoursAgo }, isHitch: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const msg of hitchMessages) {
      activities.push({
        id: `hitch_${msg.id}`,
        type: 'HITCH_RESPONSE',
        title: 'Hitch auto-answered a question',
        subtitle: msg.content.replace(/^🦄\s*/, '').slice(0, 80),
        timestamp: msg.createdAt.toISOString(),
      });
    }
  }

  // Sort by timestamp desc
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return activities.slice(0, 20);
}
