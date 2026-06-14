import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient() as any;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ─── Helper: get today as date-only ─────────────────────────
function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── DAILY BRIEFING ─────────────────────────────────────────

router.post('/daily-briefing', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const today = todayDate();

    // Check cache
    const cached = await prisma.userDailyBriefing.findFirst({
      where: { userId, generatedDate: today },
    });
    if (cached) {
      return res.json({ briefingText: cached.briefingText, actionSuggestions: cached.actionSuggestions });
    }

    // Gather context — separate co-pilots from friends
    const [user, nextTrip, lastCheckIn, maintenanceItems, streak] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, rvType: true, rvMake: true, rvModel: true, homeState: true } }),
      prisma.event.findFirst({
        where: { OR: [{ organizerId: userId }, { attendees: { some: { userId, status: { in: ['going', 'GOING'] } } } }], startDate: { gte: new Date() }, isWishlist: false },
        orderBy: { startDate: 'asc' },
        select: { id: true, title: true, startDate: true, campground: { select: { name: true } } },
      }),
      prisma.checkIn.findFirst({
        where: { userId },
        orderBy: { checkInDate: 'desc' },
        select: { campground: { select: { name: true } } },
      }),
      prisma.maintenanceReminder?.findMany({ where: { userId, nextDueDate: { lte: new Date() } }, take: 2, select: { title: true } }).catch(() => []),
      prisma.userStreak.findUnique({ where: { userId } }),
    ]);

    // Fetch co-pilots (travel partners on the same rig — NOT friends)
    let coPilotNames: string[] = [];
    try {
      const userRigs = await prisma.rig.findMany({ where: { ownerId: userId }, select: { id: true } });
      if (userRigs.length > 0) {
        const pilots = await prisma.rigPilot.findMany({
          where: { rigId: { in: userRigs.map((r: any) => r.id) }, userId: { not: userId } },
          include: { user: { select: { firstName: true, id: true } } },
        });
        coPilotNames = pilots.map((p: any) => p.user.firstName).filter(Boolean);
      }
    } catch {}

    // Fetch friend activity (EXCLUDING co-pilots)
    const coPilotUserIds = new Set<string>();
    try {
      const userRigs = await prisma.rig.findMany({ where: { ownerId: userId }, select: { id: true } });
      if (userRigs.length > 0) {
        const pilots = await prisma.rigPilot.findMany({
          where: { rigId: { in: userRigs.map((r: any) => r.id) } },
          select: { userId: true },
        });
        pilots.forEach((p: any) => coPilotUserIds.add(p.userId));
      }
    } catch {}
    coPilotUserIds.add(userId); // exclude self too

    const friendActivity = await prisma.activity.findMany({
      where: { userId: { notIn: Array.from(coPilotUserIds) }, type: 'CHECK_IN', isPublic: true, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { user: { select: { firstName: true } }, title: true },
    });

    const firstName = user?.firstName || 'friend';
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const dayOfWeek = dayNames[now.getDay()];
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Build context string — clearly separate co-pilots from friends
    let context = `User: ${firstName}.`;
    if (coPilotNames.length > 0) {
      context += ` Co-pilots (travel WITH ${firstName} on their rig, NOT friends): ${coPilotNames.join(', ')}.`;
    }
    if (nextTrip) {
      const daysAway = Math.ceil((new Date(nextTrip.startDate).getTime() - Date.now()) / 86400000);
      context += ` Next trip: "${nextTrip.title}" ${daysAway} days away${nextTrip.campground?.name ? ` at ${nextTrip.campground.name}` : ''}.`;
    } else {
      context += ' No upcoming trips planned.';
    }
    if (lastCheckIn?.campground?.name) context += ` Last stayed at ${lastCheckIn.campground.name} (shared experience with co-pilots if any).`;
    if (friendActivity.length > 0) {
      const friendNames = friendActivity.map((a: any) => `${a.user?.firstName} checked into ${a.title}`).join('; ');
      context += ` Friend activity (separate people, NOT co-pilots): ${friendNames}.`;
    }
    if (maintenanceItems?.length > 0) context += ` Overdue maintenance: ${maintenanceItems.map((m: any) => m.title).join(', ')}.`;
    if (streak) context += ` Login streak: ${streak.currentStreak} days.`;
    context += ` Today is ${dayOfWeek}, ${dateStr}.`;

    // Generate briefing with Haiku
    let briefingText = `Happy ${dayOfWeek}, ${firstName}! `;
    const actions: any[] = [];

    if (ANTHROPIC_API_KEY) {
      try {
        console.log('[Briefing] Co-pilots found:', coPilotNames);
        console.log('[Briefing] Context:', context);

        const systemPrompt = coPilotNames.length > 0
          ? `You are Hitch, a warm campfire guide for RVUnicorn. CRITICAL RULE: The following people are co-pilots who travel ON THE SAME RIG as ${firstName}. They are family or travel partners. NEVER refer to them as "friend" or "friends": ${coPilotNames.join(', ')}. Instead say "your co-pilot ${coPilotNames[0]}" or "you and ${coPilotNames[0]}". If they visited the same campground, it was a SHARED trip — say "you and ${coPilotNames[0]} just wrapped up at [place] together". The word "friend" must ONLY be used for people who are NOT co-pilots.`
          : 'You are Hitch, a warm campfire guide for RVUnicorn.';

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 150,
            system: systemPrompt,
            messages: [{ role: 'user', content: `Write a 2-3 sentence personalized morning briefing for ${firstName}. Context: ${context}. Mention their upcoming trip if they have one, or one thing a real friend (NOT a co-pilot) is doing. Add one action item for their rig or trip prep. End with a question or suggestion. Keep it conversational, warm, under 60 words. No hashtags or emojis.` }],
          }),
        });
        const aiData: any = await aiRes.json();
        if (aiData.content?.[0]?.text) {
          briefingText = aiData.content[0].text;
        }
      } catch (e) {
        console.error('[Briefing] AI generation failed, using fallback:', e);
      }
    }

    // Fallback briefing if AI failed
    if (briefingText.startsWith(`Happy ${dayOfWeek}`)) {
      if (nextTrip) {
        const daysAway = Math.ceil((new Date(nextTrip.startDate).getTime() - Date.now()) / 86400000);
        briefingText += `Your trip "${nextTrip.title}" is ${daysAway} days away. `;
      }
      if (friendActivity.length > 0) {
        briefingText += `${friendActivity[0]?.user?.firstName || 'A friend'} just checked in somewhere new. `;
      }
      briefingText += 'What are you working on today?';
    }

    // Generate action suggestions
    if (nextTrip) {
      actions.push({ label: 'View my trip', action: 'navigate', path: `/trips/${nextTrip.id}` });
    } else {
      actions.push({ label: 'Plan a trip', action: 'navigate', path: '/events-v2/create' });
    }
    if (maintenanceItems?.length > 0) {
      actions.push({ label: 'Check maintenance', action: 'navigate', path: '/maintenance' });
    } else {
      actions.push({ label: 'Log service', action: 'navigate', path: '/maintenance' });
    }
    if (friendActivity.length > 0) {
      actions.push({ label: 'See friend activity', action: 'navigate', path: '/community' });
    }

    // Cache
    await prisma.userDailyBriefing.create({
      data: { userId, briefingText, actionSuggestions: actions, generatedDate: today },
    }).catch(() => {});

    res.json({ briefingText, actionSuggestions: actions });
  } catch (e: any) {
    console.error('[Briefing] Error:', e);
    res.status(500).json({ error: 'Failed to generate briefing' });
  }
});

// ─── ACTION ITEMS ───────────────────────────────────────────

router.get('/action-items', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const items: any[] = [];

    // 1. Unreviewed campground visit in last 30 days
    const recentCheckIn = await prisma.checkIn.findFirst({
      where: { userId, checkInDate: { gte: new Date(Date.now() - 30 * 86400000) }, campgroundId: { not: null } },
      orderBy: { checkInDate: 'desc' },
      select: { campgroundId: true, campground: { select: { name: true } } },
    });
    if (recentCheckIn?.campground) {
      const hasReview = await prisma.campgroundReview?.findFirst({
        where: { userId, campgroundId: recentCheckIn.campgroundId },
      }).catch(() => null);
      if (!hasReview) {
        items.push({ emoji: '\u2B50', label: `Rate your stay at ${recentCheckIn.campground.name}`, action: 'navigate', path: `/campgrounds/${recentCheckIn.campgroundId}` });
      }
    }

    // 2. No upcoming trip
    const hasTrip = await prisma.event.findFirst({
      where: { OR: [{ organizerId: userId }, { attendees: { some: { userId } } }], startDate: { gte: new Date() }, isWishlist: false },
    });
    if (!hasTrip) {
      items.push({ emoji: '\u{1F5FA}\uFE0F', label: 'Plan your next route', action: 'navigate', path: '/events-v2/create' });
    }

    // 3. Maintenance
    const overdue = await prisma.maintenanceReminder?.findFirst({
      where: { userId, nextDueDate: { lte: new Date() } },
    }).catch(() => null);
    if (overdue) {
      items.push({ emoji: '\u{1F527}', label: 'Overdue maintenance item', action: 'navigate', path: '/maintenance' });
    } else {
      items.push({ emoji: '\u{1F527}', label: 'Log a maintenance item', action: 'navigate', path: '/maintenance' });
    }

    // 4. Rig photos
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { rvPhotoUrl: true } });
    if (!user?.rvPhotoUrl) {
      items.push({ emoji: '\u{1F4F8}', label: 'Add photos to your rig', action: 'navigate', path: '/my-rv' });
    }

    // 5. Incomplete rig profile
    const profile = await prisma.user.findUnique({ where: { id: userId }, select: { rvType: true, rvMake: true } });
    if (!profile?.rvType || !profile?.rvMake) {
      items.push({ emoji: '\u{1F690}', label: 'Complete your rig profile', action: 'navigate', path: '/my-rv' });
    }

    // 6. Community engagement
    items.push({ emoji: '\u{1F4AC}', label: 'Join the community discussion', action: 'navigate', path: '/community' });

    // 7. Explore campgrounds
    items.push({ emoji: '\u{1F3D5}\uFE0F', label: 'Explore nearby campgrounds', action: 'navigate', path: '/campgrounds' });

    // 8. Daily streak
    items.push({ emoji: '\u{1F525}', label: 'Claim your daily streak', action: 'streak' });

    res.json(items.slice(0, 6));
  } catch (e: any) {
    console.error('[ActionItems] Error:', e);
    res.status(500).json({ error: 'Failed to get action items' });
  }
});

// ─── SOCIAL PULSE ───────────────────────────────────────────

router.get('/social-pulse', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    // Get friend IDs
    const friendships = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIds = friendships.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId);

    // Friends checked in
    const checkedIn = await prisma.checkIn.findMany({
      where: { userId: { in: friendIds }, isActive: true, campgroundId: { not: null } },
      include: {
        user: { select: { id: true, username: true, firstName: true, profilePicture: true } },
        campground: { select: { id: true, name: true } },
      },
      take: 5,
    });

    // Recent friend posts (last 24hr)
    const recentPosts = await prisma.activity.findMany({
      where: { userId: { in: friendIds }, isPublic: true, createdAt: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, type: true, title: true, createdAt: true, user: { select: { id: true, username: true, firstName: true, profilePicture: true } } },
    });

    const items = [
      ...checkedIn.map((c: any) => ({
        type: 'CHECKED_IN', userId: c.user.id, username: c.user.username, avatarUrl: c.user.profilePicture,
        firstName: c.user.firstName, campgroundName: c.campground?.name, campgroundId: c.campground?.id,
        time: c.checkInDate,
      })),
      ...recentPosts.map((p: any) => ({
        type: 'RECENT_POST', userId: p.user.id, username: p.user.username, avatarUrl: p.user.profilePicture,
        firstName: p.user.firstName, postType: p.type, title: p.title, time: p.createdAt,
        navigateTo: `/profile/${p.user.username}`,
      })),
    ].slice(0, 10);

    res.json(items);
  } catch (e: any) {
    console.error('[SocialPulse] Error:', e);
    res.json([]);
  }
});

// ─── DAILY CAMPFIRE QUESTION ────────────────────────────────

router.get('/daily-question', authenticateToken, async (req: any, res: Response) => {
  try {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const questionDay = dayOfYear % 30; // Rotate through 30 questions

    let question = await prisma.dailyCampfireQuestion.findFirst({ where: { dayOfYear: questionDay } });
    if (!question) {
      // Seed this question on-demand
      const questions = [
        'What is the most underrated campground in the US?',
        'Best campfire meal you have ever cooked on the road?',
        'Worst weather you have camped through and survived?',
        'What state has surprised you most as an RV destination?',
        'Favorite rest stop or overnight parking spot ever?',
        'What upgrade transformed your RV the most?',
        'Best wildlife encounter while camping?',
        'What campground would you return to every year?',
        'Best advice you would give a new RVer?',
        'Most beautiful sunrise or sunset from your campsite?',
        'What is your go-to quick campground setup routine?',
        'Favorite national park to camp in and why?',
        'Best free camping spot you have ever found?',
        'What is the one thing you always forget to pack?',
        'Most interesting person you have met while camping?',
        'Best campground activity for kids?',
        'What is your favorite driving snack on long hauls?',
        'Scariest moment in your RV?',
        'Best campground shower you have ever used?',
        'What is your must-have campground amenity?',
        'Longest distance you have driven in one day?',
        'Best dog-friendly campground you have visited?',
        'What was your first RV and do you miss it?',
        'Best thing about full-time RV living?',
        'Hardest part about RV life nobody talks about?',
        'What is your favorite campfire drink?',
        'Most remote place you have ever camped?',
        'Best RV modification under $100?',
        'What is on your camping bucket list?',
        'If you could only camp in one state forever which one?',
      ];
      question = await prisma.dailyCampfireQuestion.create({
        data: { question: questions[questionDay], dayOfYear: questionDay },
      });
    }

    const answers = (question.answers || []) as any[];
    const userAnswer = answers.find((a: any) => a.userId === req.userId);
    const topAnswers = answers.sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 3);

    res.json({
      id: question.id,
      question: question.question,
      totalAnswers: answers.length,
      userAnswer: userAnswer || null,
      topAnswers,
    });
  } catch (e: any) {
    console.error('[DailyQuestion] Error:', e);
    res.status(500).json({ error: 'Failed to get daily question' });
  }
});

router.post('/daily-question/answer', authenticateToken, async (req: any, res: Response) => {
  try {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const questionDay = dayOfYear % 30;

    const question = await prisma.dailyCampfireQuestion.findFirst({ where: { dayOfYear: questionDay } });
    if (!question) return res.status(404).json({ error: 'No question today' });

    const answers = (question.answers || []) as any[];
    const existing = answers.findIndex((a: any) => a.userId === req.userId);

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { firstName: true, username: true, profilePicture: true } });

    const newAnswer = {
      userId: req.userId,
      username: user?.username,
      firstName: user?.firstName,
      avatarUrl: user?.profilePicture,
      text: req.body.answer,
      upvotes: 0,
      createdAt: new Date().toISOString(),
    };

    if (existing >= 0) {
      answers[existing] = { ...answers[existing], text: req.body.answer };
    } else {
      answers.push(newAnswer);
    }

    await prisma.dailyCampfireQuestion.update({
      where: { id: question.id },
      data: { answers },
    });

    res.json({ success: true, totalAnswers: answers.length });
  } catch (e: any) {
    console.error('[DailyQuestion] Answer error:', e);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// ─── STATE OF THE DAY ───────────────────────────────────────

router.get('/state-of-day', authenticateToken, async (req: any, res: Response) => {
  try {
    const states = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];
    const stateCodes: Record<string,string> = { Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY' };

    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const stateIdx = dayOfYear % states.length;
    const stateName = states[stateIdx];
    const stateCode = stateCodes[stateName] || '';

    const [campgroundCount, topCampgrounds] = await Promise.all([
      prisma.campground.count({ where: { state: stateCode } }),
      prisma.campground.findMany({
        where: { state: stateCode },
        orderBy: { googleRating: 'desc' },
        take: 3,
        select: { id: true, name: true, googleRating: true, imageUrl: true },
      }),
    ]);

    res.json({
      state: stateCode,
      stateName,
      campgroundCount,
      topCampgrounds,
    });
  } catch (e: any) {
    console.error('[StateOfDay] Error:', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── LOGIN STREAK ───────────────────────────────────────────

router.post('/streak', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const today = todayDate();

    let streak = await prisma.userStreak.findUnique({ where: { userId } });
    if (!streak) {
      streak = await prisma.userStreak.create({ data: { userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today } });
      return res.json(streak);
    }

    const lastActive = new Date(streak.lastActiveDate);
    lastActive.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / 86400000);

    if (diffDays === 0) {
      return res.json(streak); // Already checked in today
    } else if (diffDays === 1) {
      // Consecutive day
      const newStreak = streak.currentStreak + 1;
      streak = await prisma.userStreak.update({
        where: { userId },
        data: { currentStreak: newStreak, longestStreak: Math.max(newStreak, streak.longestStreak), lastActiveDate: today },
      });
    } else {
      // Streak broken
      streak = await prisma.userStreak.update({
        where: { userId },
        data: { currentStreak: 1, lastActiveDate: today },
      });
    }

    res.json(streak);
  } catch (e: any) {
    console.error('[Streak] Error:', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── FULL DASHBOARD (single endpoint) ──────────────────────

router.get('/dashboard', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const today = todayDate();

    // Parallel fetch everything
    const [briefingData, user, streak, statesCount, campgroundsCount, badgeCount] = await Promise.all([
      prisma.userDailyBriefing.findFirst({ where: { userId, generatedDate: today } }),
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, rvType: true, homeState: true } }),
      prisma.userStreak.findUnique({ where: { userId } }),
      prisma.stateVisit.groupBy({ by: ['state'], where: { userId } }).then((r: any[]) => r.length),
      prisma.checkIn.count({ where: { userId, campgroundId: { not: null } } }),
      prisma.userBadge.count({ where: { userId } }),
    ]);

    // Update streak on dashboard load
    if (streak) {
      const lastActive = new Date(streak.lastActiveDate);
      lastActive.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / 86400000);
      if (diffDays === 1) {
        await prisma.userStreak.update({
          where: { userId },
          data: { currentStreak: streak.currentStreak + 1, longestStreak: Math.max(streak.currentStreak + 1, streak.longestStreak), lastActiveDate: today },
        });
      } else if (diffDays > 1) {
        await prisma.userStreak.update({ where: { userId }, data: { currentStreak: 1, lastActiveDate: today } });
      }
    } else {
      await prisma.userStreak.create({ data: { userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today } });
    }

    const updatedStreak = await prisma.userStreak.findUnique({ where: { userId } });

    res.json({
      briefing: briefingData ? { briefingText: briefingData.briefingText, actionSuggestions: briefingData.actionSuggestions } : null,
      progress: {
        statesVisited: statesCount,
        campgroundsVisited: campgroundsCount,
        badgeCount,
        currentStreak: updatedStreak?.currentStreak || 1,
        longestStreak: updatedStreak?.longestStreak || 1,
      },
      firstName: user?.firstName || 'friend',
      rvType: user?.rvType,
    });
  } catch (e: any) {
    console.error('[Dashboard] Error:', e);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
