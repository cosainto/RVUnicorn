import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { sendWebPush } from '../utils/webPush';
import { notificationService } from '../services/notification.service';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = new PrismaClient() as any;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════
// ACTION CARDS
// ═══════════════════════════════════════════════════════════

// GET /api/actionable/:campgroundId — list action cards for a campground
router.get('/:campgroundId', optionalAuth, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const { activityType, difficulty, season, limit = '10' } = req.query;
    const userId = req.userId;

    const where: any = {
      campgroundId,
      status: 'ACTIVE',
      OR: [
        { creatorConfirmed: true },
        { sourceType: 'HITCH_EXTRACTED', hitchConfidence: { gte: 0.75 } },
      ],
    };
    if (activityType) where.activityType = activityType;
    if (difficulty) where.difficulty = difficulty;
    if (season) where.bestSeason = { has: season };

    const actionables = await prisma.actionableContent.findMany({
      where,
      orderBy: { utilityScore: 'desc' },
      take: parseInt(limit as string),
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true },
        },
        completions: {
          take: 3,
          orderBy: { completedAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, profilePicture: true } },
          },
        },
        instances: {
          where: { status: { in: ['OPEN', 'HAPPENING_NOW'] } },
          include: {
            _count: { select: { participants: true } },
            organizer: { select: { id: true, firstName: true, profilePicture: true } },
          },
        },
      },
    });

    // Check if user saved each
    let savedSet = new Set<string>();
    if (userId) {
      const saves = await prisma.activitySave.findMany({
        where: { userId, actionableId: { in: actionables.map((a: any) => a.id) } },
        select: { actionableId: true },
      });
      savedSet = new Set(saves.map((s: any) => s.actionableId));
    }

    const results = actionables.map((a: any) => ({
      ...a,
      userSaved: savedSet.has(a.id),
      recentCompletions: a.completions,
      activeInstances: a.instances,
    }));

    res.json(results);
  } catch (err: any) {
    console.error('[DoThisHere] GET /:campgroundId', err);
    res.status(500).json({ error: 'Failed to load activities' });
  }
});

// GET /api/actionable/campground/:campgroundId/live-feed
router.get('/campground/:campgroundId/live-feed', optionalAuth, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.params;
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const oneDayAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [completions, instances, checkinCount] = await Promise.all([
      // Recent completions at this campground
      prisma.activityCompletion.findMany({
        where: {
          completedAt: { gte: twoDaysAgo },
          actionable: { campgroundId },
        },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, firstName: true, profilePicture: true } },
          actionable: { select: { title: true, activityType: true, campgroundId: true } },
        },
      }),
      // Open instances scheduled in next 24hrs
      prisma.activityInstance.findMany({
        where: {
          campgroundId,
          status: { in: ['OPEN', 'HAPPENING_NOW'] },
          OR: [
            { scheduledTime: { lte: oneDayAhead } },
            { scheduledTime: null },
          ],
        },
        orderBy: { scheduledTime: 'asc' },
        take: 10,
        include: {
          actionable: { select: { title: true, activityType: true } },
          organizer: { select: { id: true, firstName: true, profilePicture: true } },
          _count: { select: { participants: true } },
        },
      }),
      // Active check-in count
      prisma.checkIn.count({
        where: {
          campgroundId,
          createdAt: { gte: twoDaysAgo },
        },
      }),
    ]);

    const feed: any[] = [];

    completions.forEach((c: any) => {
      feed.push({
        type: 'COMPLETION',
        id: c.id,
        timestamp: c.completedAt,
        user: c.user,
        activity: c.actionable,
        note: c.note,
        photoUrls: c.photoUrls,
      });
    });

    instances.forEach((i: any) => {
      feed.push({
        type: 'PLAN',
        id: i.id,
        timestamp: i.scheduledTime || i.createdAt,
        activity: i.actionable,
        organizer: i.organizer,
        participantCount: i._count.participants,
        status: i.status,
        scheduledTime: i.scheduledTime,
      });
    });

    // Sort by timestamp desc, limit 20
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      items: feed.slice(0, 20),
      checkedInCount: checkinCount,
    });
  } catch (err: any) {
    console.error('[DoThisHere] live-feed', err);
    res.status(500).json({ error: 'Failed to load live feed' });
  }
});

// POST /api/actionable — create action card (creator only)
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const {
      campgroundId, activityType, title, description,
      durationMinutes, difficulty, whatToBring,
      bestTimeOfDay, bestSeason, kidsOk, dogsOk, contentId,
    } = req.body;

    if (!campgroundId || !activityType || !title) {
      return res.status(400).json({ error: 'campgroundId, activityType, and title required' });
    }

    const actionable = await prisma.actionableContent.create({
      data: {
        campgroundId,
        creatorId: userId,
        contentId: contentId || null,
        activityType,
        title,
        description,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
        difficulty: difficulty || 'ANY',
        whatToBring: whatToBring || [],
        bestTimeOfDay: bestTimeOfDay || 'ANY',
        bestSeason: bestSeason || [],
        kidsOk: kidsOk ?? true,
        dogsOk: dogsOk ?? true,
        sourceType: 'CREATOR',
        creatorConfirmed: true,
      },
    });

    res.json(actionable);
  } catch (err: any) {
    console.error('[DoThisHere] POST /', err);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// PATCH /api/actionable/:id/confirm — creator confirms Hitch extraction
router.patch('/:id/confirm', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const existing = await prisma.actionableContent.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.creatorId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const updated = await prisma.actionableContent.update({
      where: { id },
      data: {
        ...req.body,
        creatorConfirmed: true,
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error('[DoThisHere] PATCH confirm', err);
    res.status(500).json({ error: 'Failed to confirm' });
  }
});

// PATCH /api/actionable/:id — update action card
router.patch('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const existing = await prisma.actionableContent.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.creatorId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const updated = await prisma.actionableContent.update({
      where: { id },
      data: req.body,
    });

    res.json(updated);
  } catch (err: any) {
    console.error('[DoThisHere] PATCH /:id', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// DELETE /api/actionable/:id — archive action card
router.delete('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const existing = await prisma.actionableContent.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.creatorId !== userId) return res.status(403).json({ error: 'Not authorized' });

    await prisma.actionableContent.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    res.json({ archived: true });
  } catch (err: any) {
    console.error('[DoThisHere] DELETE', err);
    res.status(500).json({ error: 'Failed to archive' });
  }
});

// ═══════════════════════════════════════════════════════════
// SAVES
// ═══════════════════════════════════════════════════════════

// POST /api/actionable/:id/save — toggle save
router.post('/:id/save', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { tripId } = req.body;

    const existing = await prisma.activitySave.findUnique({
      where: { actionableId_userId: { actionableId: id, userId } },
    });

    if (existing) {
      await prisma.activitySave.delete({ where: { id: existing.id } });
      await prisma.actionableContent.update({
        where: { id },
        data: { saveCount: { decrement: 1 } },
      });
      return res.json({ saved: false });
    }

    await prisma.activitySave.create({
      data: { actionableId: id, userId, tripId: tripId || null },
    });
    await prisma.actionableContent.update({
      where: { id },
      data: { saveCount: { increment: 1 } },
    });

    // Check for matching instances to nudge user
    const actionable = await prisma.actionableContent.findUnique({
      where: { id },
      select: { title: true, campgroundId: true },
    });
    if (actionable) {
      const openInstances = await prisma.activityInstance.findMany({
        where: {
          actionableId: id,
          campgroundId: actionable.campgroundId,
          status: 'OPEN',
        },
        take: 1,
      });
      if (openInstances.length > 0) {
        await sendWebPush(userId, {
          title: 'Others are planning this!',
          body: `People are organizing "${actionable.title}" — want to join?`,
          url: `/activities/${openInstances[0].id}`,
        });
      }
    }

    res.json({ saved: true });
  } catch (err: any) {
    console.error('[DoThisHere] save', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// ═══════════════════════════════════════════════════════════
// COMPLETIONS
// ═══════════════════════════════════════════════════════════

// POST /api/actionable/:id/complete
router.post('/:id/complete', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { note, photoUrls, instanceId } = req.body;

    const actionable = await prisma.actionableContent.findUnique({
      where: { id },
      include: { campground: { select: { name: true } } },
    });
    if (!actionable) return res.status(404).json({ error: 'Not found' });

    const completion = await prisma.activityCompletion.create({
      data: {
        actionableId: id,
        userId,
        instanceId: instanceId || null,
        note: note || null,
        photoUrls: photoUrls || [],
      },
    });

    await prisma.actionableContent.update({
      where: { id },
      data: { completionCount: { increment: 1 } },
    });

    // Post to activity feed
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (user) {
      await prisma.activity.create({
        data: {
          userId,
          type: 'ACTIVITY_COMPLETED',
          content: `${user.firstName} completed "${actionable.title}" at ${actionable.campground?.name || 'a campground'}`,
          campgroundId: actionable.campgroundId,
          metadata: JSON.stringify({ actionableId: id, activityType: actionable.activityType }),
        },
      }).catch(() => {});
    }

    res.json(completion);
  } catch (err: any) {
    console.error('[DoThisHere] complete', err);
    res.status(500).json({ error: 'Failed to complete' });
  }
});

// ═══════════════════════════════════════════════════════════
// ACTIVITY INSTANCES
// ═══════════════════════════════════════════════════════════

// POST /api/actionable/:id/instances — create an activity instance
router.post('/:id/instances', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { scheduledTime, note, maxParticipants, isOpenInvite } = req.body;

    const actionable = await prisma.actionableContent.findUnique({
      where: { id },
      select: { campgroundId: true, title: true },
    });
    if (!actionable) return res.status(404).json({ error: 'Activity not found' });

    const instance = await prisma.activityInstance.create({
      data: {
        actionableId: id,
        campgroundId: actionable.campgroundId,
        organizerId: userId,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        note: note || null,
        maxParticipants: maxParticipants || null,
        isOpenInvite: isOpenInvite ?? true,
      },
    });

    // Auto-add organizer as participant
    await prisma.activityParticipant.create({
      data: { instanceId: instance.id, userId, status: 'JOINED' },
    });

    await prisma.actionableContent.update({
      where: { id },
      data: { joinCount: { increment: 1 } },
    });

    // Notify users who saved this activity and are nearby
    const savers = await prisma.activitySave.findMany({
      where: { actionableId: id, userId: { not: userId } },
      select: { userId: true },
    });

    const organizer = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });

    for (const saver of savers) {
      await sendWebPush(saver.userId, {
        title: `${organizer?.firstName || 'Someone'} is organizing "${actionable.title}"`,
        body: 'You saved this activity — want to join?',
        url: `/activities/${instance.id}`,
      }).catch(() => {});
    }

    res.json(instance);
  } catch (err: any) {
    console.error('[DoThisHere] create instance', err);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

// GET /api/actionable/instances/:instanceId
router.get('/instances/:instanceId', optionalAuth, async (req: any, res: Response) => {
  try {
    const { instanceId } = req.params;
    const userId = req.userId;

    const instance = await prisma.activityInstance.findUnique({
      where: { id: instanceId },
      include: {
        actionable: {
          include: {
            campground: { select: { id: true, name: true, location: true, latitude: true, longitude: true } },
          },
        },
        organizer: { select: { id: true, firstName: true, lastName: true, profilePicture: true, rvType: true } },
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, rvType: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: { select: { id: true, firstName: true, profilePicture: true } },
          },
        },
      },
    });

    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    let userStatus = 'NOT_JOINED';
    if (userId) {
      const participant = instance.participants.find((p: any) => p.userId === userId);
      if (participant) userStatus = participant.status;
    }

    res.json({ ...instance, userStatus, messages: instance.messages.reverse() });
  } catch (err: any) {
    console.error('[DoThisHere] GET instance', err);
    res.status(500).json({ error: 'Failed to load instance' });
  }
});

// POST /api/actionable/instances/:instanceId/join
router.post('/instances/:instanceId/join', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { instanceId } = req.params;
    const { status = 'JOINED' } = req.body;

    const instance = await prisma.activityInstance.findUnique({
      where: { id: instanceId },
      include: { actionable: { select: { title: true } } },
    });
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    await prisma.activityParticipant.upsert({
      where: { instanceId_userId: { instanceId, userId } },
      create: { instanceId, userId, status },
      update: { status },
    });

    if (status === 'JOINED') {
      await prisma.actionableContent.update({
        where: { id: instance.actionableId },
        data: { joinCount: { increment: 1 } },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true },
      });

      // Notify organizer
      await sendWebPush(instance.organizerId, {
        title: `${user?.firstName || 'Someone'} joined your activity`,
        body: instance.actionable.title,
        url: `/activities/${instanceId}`,
      }).catch(() => {});
    }

    const count = await prisma.activityParticipant.count({
      where: { instanceId, status: 'JOINED' },
    });

    res.json({ joined: status === 'JOINED', participantCount: count });
  } catch (err: any) {
    console.error('[DoThisHere] join', err);
    res.status(500).json({ error: 'Failed to join' });
  }
});

// POST /api/actionable/instances/:instanceId/messages
router.post('/instances/:instanceId/messages', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { instanceId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Message content required' });

    // Verify participant
    const participant = await prisma.activityParticipant.findUnique({
      where: { instanceId_userId: { instanceId, userId } },
    });
    if (!participant) return res.status(403).json({ error: 'Must be a participant' });

    const message = await prisma.activityMessage.create({
      data: { instanceId, userId, content: content.trim() },
      include: {
        user: { select: { id: true, firstName: true, profilePicture: true } },
      },
    });

    // Push to other participants
    const others = await prisma.activityParticipant.findMany({
      where: { instanceId, userId: { not: userId }, status: 'JOINED' },
      select: { userId: true },
    });
    for (const other of others) {
      await sendWebPush(other.userId, {
        title: `${message.user.firstName}: ${content.trim().slice(0, 60)}`,
        body: 'Activity group chat',
        url: `/activities/${instanceId}`,
      }).catch(() => {});
    }

    res.json(message);
  } catch (err: any) {
    console.error('[DoThisHere] message', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PATCH /api/actionable/instances/:instanceId — update instance (organizer only)
router.patch('/instances/:instanceId', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { instanceId } = req.params;
    const { scheduledTime, note, status, maxParticipants } = req.body;

    const instance = await prisma.activityInstance.findUnique({ where: { id: instanceId } });
    if (!instance) return res.status(404).json({ error: 'Not found' });
    if (instance.organizerId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const data: any = {};
    if (scheduledTime !== undefined) data.scheduledTime = scheduledTime ? new Date(scheduledTime) : null;
    if (note !== undefined) data.note = note;
    if (status !== undefined) data.status = status;
    if (maxParticipants !== undefined) data.maxParticipants = maxParticipants;

    const updated = await prisma.activityInstance.update({
      where: { id: instanceId },
      data,
    });

    // Notify participants of status changes
    if (status === 'HAPPENING_NOW' || status === 'CANCELLED') {
      const participants = await prisma.activityParticipant.findMany({
        where: { instanceId, userId: { not: userId } },
        select: { userId: true },
      });
      const actionable = await prisma.actionableContent.findUnique({
        where: { id: instance.actionableId },
        select: { title: true },
      });
      const msg = status === 'HAPPENING_NOW'
        ? `"${actionable?.title}" is happening now!`
        : `"${actionable?.title}" has been cancelled.`;
      for (const p of participants) {
        await sendWebPush(p.userId, {
          title: msg,
          body: '',
          url: `/activities/${instanceId}`,
        }).catch(() => {});
      }
    }

    res.json(updated);
  } catch (err: any) {
    console.error('[DoThisHere] PATCH instance', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ═══════════════════════════════════════════════════════════
// CONTEXT-AWARE "DO THIS NOW"
// ═══════════════════════════════════════════════════════════

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'MORNING';
  if (hour >= 12 && hour < 17) return 'AFTERNOON';
  if (hour >= 17 && hour < 21) return 'EVENING';
  return 'NIGHT';
}

function getCurrentSeason(): string {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'SPRING';
  if (month >= 5 && month <= 7) return 'SUMMER';
  if (month >= 8 && month <= 10) return 'FALL';
  return 'WINTER';
}

// GET /api/actionable/do-this-now
router.get('/do-this-now', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    // Find user's current check-in or upcoming trip
    const checkIn = await prisma.checkIn.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { campgroundId: true },
    });

    let campgroundId = checkIn?.campgroundId;

    if (!campgroundId) {
      // Check for upcoming trip in next 3 days
      const threeDaysOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const upcomingEvent = await prisma.eventAttendee.findFirst({
        where: {
          userId,
          event: {
            startDate: { lte: threeDaysOut },
            endDate: { gte: new Date() },
            campgroundId: { not: null },
          },
        },
        include: { event: { select: { campgroundId: true } } },
      });
      campgroundId = upcomingEvent?.event?.campgroundId || null;
    }

    if (!campgroundId) {
      return res.json([]);
    }

    const timeOfDay = getTimeOfDay();
    const season = getCurrentSeason();

    const activities = await prisma.actionableContent.findMany({
      where: {
        campgroundId,
        status: 'ACTIVE',
        OR: [
          { creatorConfirmed: true },
          { sourceType: 'HITCH_EXTRACTED', hitchConfidence: { gte: 0.75 } },
        ],
        bestTimeOfDay: { in: [timeOfDay, 'ANY'] },
      },
      orderBy: { utilityScore: 'desc' },
      take: 5,
      include: {
        creator: { select: { id: true, firstName: true, profilePicture: true } },
        instances: {
          where: {
            status: { in: ['OPEN', 'HAPPENING_NOW'] },
            scheduledTime: {
              gte: new Date(),
              lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          },
          take: 1,
          include: { _count: { select: { participants: true } } },
        },
      },
    });

    // Get friends who did these activities
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ initiatorId: userId }, { receiverId: userId }],
        status: 'ACCEPTED',
      },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIds = friendships.map((f: any) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    const results = await Promise.all(
      activities.map(async (a: any) => {
        const friendCompletions = await prisma.activityCompletion.findMany({
          where: { actionableId: a.id, userId: { in: friendIds } },
          take: 3,
          include: { user: { select: { id: true, firstName: true, profilePicture: true } } },
        });

        // Generate Hitch reason
        let hitchReason = '';
        try {
          const campground = await prisma.campground.findUnique({
            where: { id: campgroundId! },
            select: { name: true },
          });
          const resp = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 50,
            system: 'You are Hitch on RVUnicorn. Give a short, enthusiastic 1-sentence reason why this activity is perfect RIGHT NOW based on the context. Be specific. Max 15 words. No quotes.',
            messages: [{
              role: 'user',
              content: `Activity: ${a.title}. Context: ${timeOfDay}, ${season}, ${campground?.name || 'campground'}`,
            }],
          });
          hitchReason = (resp.content[0] as any).text?.trim() || '';
        } catch {
          // Non-critical — skip Hitch reason
        }

        return {
          actionable: a,
          hitchReason,
          activeInstance: a.instances[0] || null,
          friendsWhoDidThis: friendCompletions.map((c: any) => c.user),
        };
      })
    );

    res.json(results);
  } catch (err: any) {
    console.error('[DoThisHere] do-this-now', err);
    res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

// ═══════════════════════════════════════════════════════════
// CREATOR CONFIRMATION QUEUE
// ═══════════════════════════════════════════════════════════

// GET /api/actionable/creator/pending
router.get('/creator/pending', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    const pending = await prisma.actionableContent.findMany({
      where: {
        creatorId: userId,
        creatorConfirmed: false,
        sourceType: 'HITCH_EXTRACTED',
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        campground: { select: { id: true, name: true } },
      },
    });

    res.json(pending);
  } catch (err: any) {
    console.error('[DoThisHere] pending', err);
    res.status(500).json({ error: 'Failed to load pending' });
  }
});

// ═══════════════════════════════════════════════════════════
// EVENT PLAYBOOKS
// ═══════════════════════════════════════════════════════════

// POST /api/actionable/events/:eventId/playbook — create/update playbook
router.post('/events/:eventId/playbook', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { eventId } = req.params;
    const { whatToExpect, packingList, hitchWelcome } = req.body;

    // Verify organizer
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true, campgroundId: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.organizerId !== userId) return res.status(403).json({ error: 'Not authorized' });
    if (!event.campgroundId) return res.status(400).json({ error: 'Event must have a campground' });

    const playbook = await prisma.eventPlaybook.upsert({
      where: { eventId },
      create: {
        eventId,
        campgroundId: event.campgroundId,
        creatorId: userId,
        whatToExpect: whatToExpect || null,
        packingList: packingList || [],
        hitchWelcome: hitchWelcome || null,
      },
      update: {
        whatToExpect: whatToExpect !== undefined ? whatToExpect : undefined,
        packingList: packingList !== undefined ? packingList : undefined,
        hitchWelcome: hitchWelcome !== undefined ? hitchWelcome : undefined,
      },
      include: { content: { orderBy: { sortOrder: 'asc' } } },
    });

    res.json(playbook);
  } catch (err: any) {
    console.error('[DoThisHere] playbook create', err);
    res.status(500).json({ error: 'Failed to save playbook' });
  }
});

// POST /api/actionable/events/:eventId/playbook/content — add playbook item
router.post('/events/:eventId/playbook/content', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { eventId } = req.params;
    const { phase, contentId, actionableId, title, description, sortOrder } = req.body;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });
    if (!event || event.organizerId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const playbook = await prisma.eventPlaybook.findUnique({ where: { eventId } });
    if (!playbook) return res.status(404).json({ error: 'Create playbook first' });

    const item = await prisma.eventPlaybookContent.create({
      data: {
        playbookId: playbook.id,
        phase,
        contentId: contentId || null,
        actionableId: actionableId || null,
        title,
        description: description || null,
        sortOrder: sortOrder || 0,
      },
    });

    res.json(item);
  } catch (err: any) {
    console.error('[DoThisHere] playbook content', err);
    res.status(500).json({ error: 'Failed to add content' });
  }
});

// DELETE /api/actionable/events/:eventId/playbook/content/:contentItemId
router.delete('/events/:eventId/playbook/content/:contentItemId', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { eventId, contentItemId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });
    if (!event || event.organizerId !== userId) return res.status(403).json({ error: 'Not authorized' });

    await prisma.eventPlaybookContent.delete({ where: { id: contentItemId } });
    res.json({ deleted: true });
  } catch (err: any) {
    console.error('[DoThisHere] delete playbook content', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// GET /api/actionable/events/:eventId/playbook
router.get('/events/:eventId/playbook', optionalAuth, async (req: any, res: Response) => {
  try {
    const { eventId } = req.params;

    const playbook = await prisma.eventPlaybook.findUnique({
      where: { eventId },
      include: {
        content: {
          orderBy: { sortOrder: 'asc' },
        },
        creator: { select: { id: true, firstName: true, profilePicture: true } },
      },
    });

    if (!playbook) return res.status(404).json({ error: 'Playbook not found' });

    // Group content by phase
    const before = playbook.content.filter((c: any) => c.phase === 'BEFORE');
    const during = playbook.content.filter((c: any) => c.phase === 'DURING');
    const after = playbook.content.filter((c: any) => c.phase === 'AFTER');

    res.json({ ...playbook, beforeContent: before, duringContent: during, afterContent: after });
  } catch (err: any) {
    console.error('[DoThisHere] GET playbook', err);
    res.status(500).json({ error: 'Failed to load playbook' });
  }
});

// GET /api/actionable/events/:eventId/playbook/live-feed
router.get('/events/:eventId/playbook/live-feed', optionalAuth, async (req: any, res: Response) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { campgroundId: true, isLive: true },
    });
    if (!event?.campgroundId) return res.json({ items: [] });

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const [completions, activeInstances, checkInCount] = await Promise.all([
      prisma.activityCompletion.findMany({
        where: {
          completedAt: { gte: twoHoursAgo },
          actionable: { campgroundId: event.campgroundId },
        },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, firstName: true, profilePicture: true } },
          actionable: { select: { title: true, activityType: true } },
        },
      }),
      prisma.activityInstance.findMany({
        where: {
          campgroundId: event.campgroundId,
          status: 'HAPPENING_NOW',
        },
        take: 5,
        include: {
          actionable: { select: { title: true, activityType: true } },
          _count: { select: { participants: true } },
        },
      }),
      prisma.eventCheckIn.count({
        where: { eventId },
      }),
    ]);

    const items: any[] = [];
    completions.forEach((c: any) => items.push({ type: 'COMPLETION', ...c }));
    activeInstances.forEach((i: any) => items.push({ type: 'ACTIVE_INSTANCE', ...i }));

    res.json({ items, attendeeCheckIns: checkInCount });
  } catch (err: any) {
    console.error('[DoThisHere] playbook live-feed', err);
    res.status(500).json({ error: 'Failed to load live feed' });
  }
});

export default router;
