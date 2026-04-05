import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';
import { sendWebPush } from '../utils/webPush';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic();

// ══ POST /api/sharing/generate-tagline ══
router.post('/generate-tagline', authenticateToken, async (req: any, res: Response) => {
  try {
    const { stateName, stateNumber, totalNights, season } = req.body;
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 40, temperature: 0.9,
      messages: [{ role: 'user', content: `Generate a single evocative sentence (8-12 words) for an RVer who just visited ${stateName} for the first time. This is state #${stateNumber} of their journey. Make it feel like a personal milestone, not a tourism slogan. Poetic, adventurous, first-person optional. No hashtags. No emojis. Return only the sentence.` }],
    });
    const tagline = (response.content[0] as any)?.text?.trim() || `${stateName} — another pin on the map.`;
    res.json({ tagline });
  } catch { res.json({ tagline: 'Another state, another story.' }); }
});

// ══ GET /api/sharing/visited-states/:userId ══
router.get('/visited-states/:userId', optionalAuth, async (req, res: Response) => {
  try {
    const checkins = await prisma.checkIn.findMany({
      where: { userId: req.params.userId },
      select: { campground: { select: { state: true } } },
    });
    const states = [...new Set(checkins.map(c => c.campground?.state).filter(Boolean))];
    res.json({ states, count: states.length });
  } catch { res.json({ states: [], count: 0 }); }
});

// ══ GET /api/sharing/public-profile/:username ══
router.get('/public-profile/:username', async (req, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ username: req.params.username }, { id: req.params.username }] },
      select: {
        id: true, firstName: true, lastName: true, username: true, profilePicture: true,
        rvType: true, rvMake: true, rvModel: true, rvYear: true, location: true,
        showLiveStatusPublicly: true, _count: { select: { friends: true, checkIns: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get visited states
    const checkins = await prisma.checkIn.findMany({
      where: { userId: user.id },
      select: { campground: { select: { state: true } } },
    });
    const visitedStates = [...new Set(checkins.map(c => c.campground?.state).filter(Boolean))];

    // Current status (only if opted in)
    let currentCampground = null;
    if (user.showLiveStatusPublicly) {
      const active = await prisma.checkIn.findFirst({
        where: { userId: user.id, isActive: true },
        include: { campground: { select: { name: true, state: true } } },
      });
      if (active?.campground) currentCampground = active.campground;
    }

    res.json({
      displayName: `${user.firstName} ${user.lastName}`, username: user.username,
      avatarUrl: user.profilePicture, rvType: user.rvType, rvMake: user.rvMake,
      location: user.location, visitedStates, stateCount: visitedStates.length,
      friendCount: user._count.friends, checkinCount: user._count.checkIns,
      currentCampground,
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ══ POST /api/sharing/record-share ══
router.post('/record-share', authenticateToken, async (req: any, res: Response) => {
  try {
    await (prisma as any).shareEvent.create({ data: { userId: req.userId, shareType: req.body.shareType, platform: req.body.platform } });
    res.json({ success: true });
  } catch { res.json({ success: true }); }
});

export default router;

// ══ PROXIMITY SERVICE — Shared Fire ══
export async function checkSharedFire(userId: string, campgroundId: string) {
  try {
    const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { latitude: true, longitude: true, name: true } });
    if (!campground?.latitude || !campground?.longitude) return;

    // Get mutual friends (accepted friendships)
    const friendships = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] },
      select: { initiatorId: true, receiverId: true },
    });
    const crewIds = friendships.map(f => f.initiatorId === userId ? f.receiverId : f.initiatorId);
    if (crewIds.length === 0) return;

    // Get crew members who are currently checked in
    const activeCheckins = await prisma.checkIn.findMany({
      where: { userId: { in: crewIds }, isActive: true },
      include: {
        campground: { select: { latitude: true, longitude: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const checkin of activeCheckins) {
      if (!checkin.campground?.latitude || !checkin.campground?.longitude) continue;

      // Haversine distance
      const R = 3959;
      const dLat = (checkin.campground.latitude - campground.latitude) * Math.PI / 180;
      const dLon = (checkin.campground.longitude - campground.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(campground.latitude * Math.PI / 180) * Math.cos(checkin.campground.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      if (distance <= 50) {
        // Check throttle — once per pair per 24h
        const recentAlert = await (prisma as any).sharedFireAlert.findFirst({
          where: { userId: checkin.userId, fromUserId: userId, sentAt: { gte: oneDayAgo } },
        });
        if (recentAlert) continue;

        // Get the checking-in user's name
        const checkingInUser = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
        const name = checkingInUser ? `${checkingInUser.firstName} ${checkingInUser.lastName}` : 'A friend';
        const miles = Math.round(distance);

        // Send notification
        await prisma.notification.create({
          data: {
            userId: checkin.userId,
            type: 'SHARED_FIRE',
            content: `🔥 ${name} just checked in ${miles} miles away at ${campground.name}. Headed that way?`,
            link: `/campgrounds/${campgroundId}`,
          },
        });

        // Push notification
        sendWebPush(checkin.userId, {
          title: 'Fire Alert! 🔥',
          body: `${name} just checked in ${miles} miles away at ${campground.name}`,
          url: `/campgrounds/${campgroundId}`,
        }).catch(() => {});

        // Record alert to prevent spam
        await (prisma as any).sharedFireAlert.upsert({
          where: { userId_fromUserId: { userId: checkin.userId, fromUserId: userId } },
          create: { userId: checkin.userId, fromUserId: userId },
          update: { sentAt: new Date() },
        }).catch(() => {});

        console.log(`[SharedFire] 🔥 ${name} → ${checkin.user.firstName} (${miles}mi at ${campground.name})`);
      }
    }
  } catch (e) { console.error('[SharedFire] Error:', e); }
}
