import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();
const prisma = new PrismaClient() as any;

// Trivia sessions in Central Time (hours, minutes)
const TRIVIA_SESSIONS = [
  { h: 7, m: 30, label: 'Morning' },
  { h: 12, m: 25, label: 'Lunchtime' },
  { h: 17, m: 30, label: 'Campfire' },
];

function getNextTriviaSession(): { startsAt: string; label: string; isActive: boolean } | null {
  const now = new Date();
  const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const centralMins = central.getHours() * 60 + central.getMinutes();

  for (const s of TRIVIA_SESSIONS) {
    const startMin = s.h * 60 + s.m;
    const endMin = startMin + 30;
    // Currently in this session
    if (centralMins >= startMin && centralMins < endMin) {
      const startsAt = new Date(now);
      startsAt.setHours(startsAt.getHours() - (centralMins - startMin)); // approx
      return { startsAt: startsAt.toISOString(), label: s.label, isActive: true };
    }
    // This session is upcoming today
    if (centralMins < startMin) {
      const diff = (startMin - centralMins) * 60 * 1000;
      return { startsAt: new Date(now.getTime() + diff).toISOString(), label: s.label, isActive: false };
    }
  }
  // All sessions passed — next is tomorrow morning
  const tomorrowMorning = TRIVIA_SESSIONS[0];
  const minsUntilMidnight = (24 * 60) - centralMins;
  const minsFromMidnight = tomorrowMorning.h * 60 + tomorrowMorning.m;
  const diff = (minsUntilMidnight + minsFromMidnight) * 60 * 1000;
  return { startsAt: new Date(now.getTime() + diff).toISOString(), label: tomorrowMorning.label, isActive: false };
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const optionalAuth = (req: any, res: any, next: any) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return authenticateToken(req, res, next);
  }
  next();
};

// GET /api/campfire/:campgroundId/posts
router.get("/:campgroundId/posts", optionalAuth, async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const posts = await prisma.campgroundPost.findMany({
      where: { campgroundId },
      include: {
        author: { select: { id: true, firstName: true, username: true, profilePicture: true, rvType: true } },
        likes: { select: { userId: true } },
        comments: {
          include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    // Add rsvp counts (use likes table as RSVP proxy for now since we reuse the schema)
    const postsWithRsvp = posts.map((p: any) => ({
      ...p,
      metadata: p.title ? (() => { try { return JSON.parse(p.title); } catch { return {}; } })() : {},
      postType: p.imageUrl || "chat", // imageUrl column stores postType
      rsvps: [],
      _count: { likes: p._count.likes, comments: p._count.comments, rsvps: 0 },
    }));

    res.json({ posts: postsWithRsvp });
  } catch (e: any) {
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/campfire/:campgroundId/posts
router.post("/:campgroundId/posts", authenticateToken, async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const { postType = "chat", content, metadata = {} } = req.body;
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const post = await prisma.campgroundPost.create({
      data: {
        campgroundId,
        authorId: userId,
        content,
        title: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        imageUrl: postType, // repurpose imageUrl to store postType
        isPinned: false,
      },
      include: {
        author: { select: { id: true, firstName: true, username: true, profilePicture: true } },
        likes: { select: { userId: true } },
        comments: { include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    res.json({
      post: {
        ...post,
        postType,
        metadata,
        rsvps: [],
        _count: { likes: 0, comments: 0, rsvps: 0 },
      }
    });

    // Async: check if this is a question and schedule Hitch fallback
    if (postType === "question") {
      setTimeout(async () => {
        try {
          const freshPost = await prisma.campgroundPost.findUnique({
            where: { id: post.id },
            include: { comments: { take: 1 } },
          });
          // If no comments after 10 min, have Hitch answer
          if (freshPost && freshPost.comments.length === 0) {
            const campground = await prisma.campground.findUnique({
              where: { id: campgroundId },
              select: { name: true, city: true, state: true },
            });
            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 200,
              messages: [{
                role: "user",
                content: `You are Hitch, RVUnicorn's AI campground guide. Answer this question posted at ${campground?.name}: "${content}". Be helpful and concise (2-3 sentences). If you don't have specific info, give general RV camping guidance.`,
              }],
            });
            const answer = response.content[0].type === "text" ? response.content[0].text : "";
            if (answer) {
              await prisma.campgroundPost.create({
                data: {
                  campgroundId,
                  authorId: userId, // post as the question author (Hitch impersonation via content)
                  content: `🦄 Hitch says: ${answer}`,
                  imageUrl: "hitch_pulse",
                  isPinned: false,
                },
              });
            }
          }
        } catch {}
      }, 10 * 60 * 1000); // 10 minutes
    }
  } catch (e: any) {
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/campfire/:campgroundId/posts/:postId/like
router.post("/:campgroundId/posts/:postId/like", authenticateToken, async (req: any, res) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).userId;
    const existing = await prisma.campgroundPostLike.findUnique({ where: { postId_userId: { postId, userId } } });
    if (existing) {
      await prisma.campgroundPostLike.delete({ where: { postId_userId: { postId, userId } } });
      res.json({ liked: false });
    } else {
      await prisma.campgroundPostLike.create({ data: { postId, userId } });
      res.json({ liked: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/campfire/:campgroundId/posts/:postId/comments
router.post("/:campgroundId/posts/:postId/comments", authenticateToken, async (req: any, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = (req as any).userId;
    const comment = await prisma.campgroundPostComment.create({
      data: { postId, userId, content },
      include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } },
    });
    res.json({ comment });
  } catch (e: any) {
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/campfire/:campgroundId/posts/:postId/rsvp
router.post("/:campgroundId/posts/:postId/rsvp", authenticateToken, async (req: any, res) => {
  try {
    // Use likes table as a simple RSVP proxy for now
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /api/campfire/:campgroundId/posts/:postId
router.delete("/:campgroundId/posts/:postId", authenticateToken, async (req: any, res) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).userId;
    const post = await prisma.campgroundPost.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Not found" });
    if (post.authorId !== userId) return res.status(403).json({ error: "Forbidden" });
    await prisma.campgroundPost.delete({ where: { id: postId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/campfire/:campgroundId/pulse
router.get("/:campgroundId/pulse", async (req: any, res) => {
  try {
    const { campgroundId } = req.params;

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true, city: true, state: true },
    });
    if (!campground) return res.status(404).json({ error: "Not found" });

    // Get current check-ins
    const checkIns = await prisma.checkIn.findMany({
      where: { campgroundId, isActive: true },
      include: { user: { select: { firstName: true, campingInterests: true, rvType: true } } },
      take: 20,
    }).catch(() => []);

    if (checkIns.length === 0) return res.json({ pulse: "", camperCount: 0 });

    // Get recent posts (last 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentPosts = await prisma.campgroundPost.findMany({
      where: { campgroundId, createdAt: { gte: sixHoursAgo } },
      select: { content: true, imageUrl: true },
      take: 10,
    }).catch(() => []);

    const camperCount = checkIns.length;
    const activities = recentPosts.map((p: any) => p.imageUrl).filter(Boolean);
    const interests = checkIns.flatMap((c: any) => c.user.campingInterests as string[] || []).slice(0, 10);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Write a short, lively Hitch Pulse for ${campground.name} tonight. Like a campground vibe check — warm, fun, specific. Max 2 sentences.

${camperCount} campers checked in right now.
Recent activity types: ${activities.join(", ") || "general camping"}
Camper interests: ${interests.join(", ") || "general camping"}
${recentPosts.length > 0 ? `Recent posts: ${recentPosts.slice(0,3).map((p: any) => p.content?.substring(0,50)).join(" | ")}` : ""}

Write the pulse now (2 sentences max, fun and warm):`,
      }],
    });

    const pulse = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    res.json({ pulse, camperCount });
  } catch (e: any) {
    res.json({ pulse: "", camperCount: 0 });
  }
});


// ── Live Campfire Chat Routes ─────────────────────────────────────────────────

// GET /api/campfire/:campgroundId/room/status
router.get('/:campgroundId/room/status', authenticateToken, async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const [room, checkIns] = await Promise.all([
      prisma.campfireRoom.findUnique({ where: { campgroundId } }),
      prisma.checkIn.findMany({
        where: { campgroundId, isActive: true },
        include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } },
        take: 50,
      }),
    ]);
    // Deduplicate by userId — in case of multiple active check-in records
    const seen = new Set<string>();
    const uniqueUsers = checkIns
      .filter((c: any) => { if (seen.has(c.user.id)) return false; seen.add(c.user.id); return true; })
      .map((c: any) => c.user);

    res.json({
      isActive: room?.isActive ?? false,
      checkedInCount: uniqueUsers.length,
      checkedInUsers: uniqueUsers,
      needsMore: Math.max(0, 3 - uniqueUsers.length),
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch room status' });
  }
});

// GET /api/campfire/:campgroundId/room/messages
router.get('/:campgroundId/room/messages', authenticateToken, async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const userId = req.userId;
    const room = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
    if (!room) return res.json({ messages: [] });

    // Only show messages from after the user's check-in time
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: { userId, campgroundId, isActive: true },
      select: { checkInDate: true },
    });

    // Show messages from last 24 hours only (or since check-in, whichever is more recent)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cutoff = activeCheckIn?.checkInDate && activeCheckIn.checkInDate > twentyFourHoursAgo
      ? activeCheckIn.checkInDate : twentyFourHoursAgo;

    const messages = await prisma.campfireMessage.findMany({
      where: {
        roomId: room.id,
        createdAt: { gte: cutoff },
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
        replyTo: { select: { id: true, content: true, user: { select: { firstName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    // Map replyTo data to flat fields for frontend
    const mapped = messages.map((m: any) => ({
      ...m,
      replyToId: m.replyToId || null,
      replyToContent: m.replyTo?.content?.slice(0, 80) || null,
      replyToUser: m.replyTo?.user?.firstName || null,
      replyTo: undefined,
    }));
    res.json({ messages: mapped });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});


// GET /api/campfire/:campgroundId/active-question
// Returns the most recently asked question if still within time limit
router.get('/:campgroundId/active-question', async (req: any, res: any) => {
  try {
    const { campgroundId } = req.params;

    const room = await (prisma as any).campfireRoom.findFirst({
      where: { campgroundId, isActive: true },
    });
    if (!room) return res.json({ question: null });

    const week = await (prisma as any).triviaWeek.findFirst({
      where: { campgroundId, isActive: true },
    });
    if (!week) return res.json({ question: null });

    // Find most recently asked question that is still within answer window (10s + buffer)
    const cutoff = new Date(Date.now() - 15000); // 15s window
    const question = await (prisma as any).triviaQuestion.findFirst({
      where: {
        weekId: week.id,
        askedAt: { gte: cutoff },
      },
      orderBy: { askedAt: 'desc' },
    });

    if (!question) return res.json({ question: null });

    res.json({
      question: {
        questionId: question.id,
        questionNum: question.questionNum,
        total: 10,
        question: question.question,
        options: {
          A: question.optionA,
          B: question.optionB,
          C: question.optionC,
          D: question.optionD,
        },
        hostCharacter: week.hostCharacter,
        category: question.category,
        timeLimit: 120,
        askedAt: question.askedAt,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get active question' });
  }
});



// GET /api/campfire/:campgroundId/current-trivia
// Returns the latest asked question the user hasn't answered yet (no time cutoff)
router.get('/:campgroundId/current-trivia', authenticateToken, async (req: any, res: any) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;

    const week = await (prisma as any).triviaWeek.findFirst({
      where: { campgroundId, isActive: true },
    });
    if (!week) return res.json({ question: null, stats: null });

    const dayOfWeek = new Date().getDay();

    // Find asked questions today that user hasn't answered
    const asked = await (prisma as any).triviaQuestion.findMany({
      where: { weekId: week.id, dayOfWeek, askedAt: { not: null } },
      orderBy: { questionNum: 'desc' },
    });

    // Find the latest one the user hasn't answered
    let currentQ = null;
    for (const q of asked) {
      const answered = await (prisma as any).triviaAnswer.findFirst({
        where: { questionId: q.id, userId },
      });
      if (!answered) { currentQ = q; break; }
    }

    // Stats for today
    const totalAsked = asked.length;
    const userAnswers = await (prisma as any).triviaAnswer.findMany({
      where: {
        userId,
        question: { weekId: week.id, dayOfWeek },
      },
    });
    const correctCount = userAnswers.filter((a: any) => a.isCorrect).length;

    // Leaderboard position
    const leaderboard = await (prisma as any).triviaLeaderboard.findFirst({
      where: { weekId: week.id, userId },
    });

    res.json({
      question: currentQ ? {
        questionId: currentQ.id,
        questionNum: currentQ.questionNum,
        total: 10,
        question: currentQ.question,
        options: { A: currentQ.optionA, B: currentQ.optionB, C: currentQ.optionC, D: currentQ.optionD },
        hostCharacter: week.hostCharacter,
        category: currentQ.category,
        askedAt: currentQ.askedAt,
      } : null,
      stats: {
        totalAsked,
        answered: userAnswers.length,
        correct: correctCount,
        points: leaderboard?.totalPoints || 0,
        theme: week.theme,
        hostCharacter: week.hostCharacter,
      },
      nextSession: getNextTriviaSession(),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get trivia' });
  }
});

// POST /api/campfire/:campgroundId/answer
router.post('/:campgroundId/answer', authenticateToken, async (req: any, res: any) => {
  try {
    const { campgroundId } = req.params;
    const userId = (req as any).userId;
    const { questionId, answer, answeredAt } = req.body;

    const question = await (prisma as any).triviaQuestion.findUnique({
      where: { id: questionId },
      include: { week: true },
    });

    if (!question) return res.status(404).json({ error: 'Question not found' });
    if (!question.askedAt) return res.status(400).json({ error: 'Question not active' });

    // Check if already answered
    const existing = await (prisma as any).triviaAnswer.findFirst({
      where: { userId, questionId },
    });
    if (existing) return res.json({ isCorrect: existing.isCorrect, points: existing.pointsAwarded, correctAnswer: question.answer, alreadyAnswered: true });

    const isCorrect = answer === question.answer;
    const responseTime = Math.floor((new Date(answeredAt).getTime() - new Date(question.askedAt).getTime()) / 1000);
    const speedBonus = isCorrect ? Math.max(0, 10 - Math.floor(responseTime / 3)) : 0;
    const basePoints = isCorrect ? 50 : 0;
    const isDoublePoints = question.questionNum >= 9;
    const points = isDoublePoints ? (basePoints + speedBonus) * 2 : basePoints + speedBonus;

    // Save answer
    await (prisma as any).triviaAnswer.create({
      data: { userId, questionId, answer, isCorrect, responseTime, points: points },
    });

    // Update leaderboard
    const week = question.week;
    if (week) {
      await (prisma as any).triviaLeaderboard.upsert({
        where: { weekId_userId: { weekId: week.id, userId } },
        create: { weekId: week.id, userId, totalPoints: points, correctAnswers: isCorrect ? 1 : 0, gamesPlayed: 1 },
        update: {
          totalPoints: { increment: points },
          correctAnswers: { increment: isCorrect ? 1 : 0 },
          gamesPlayed: { increment: 1 },
        },
      });
    }

    // Update streak (once per calendar day)
    let streak = { currentStreak: 1, longestStreak: 1 };
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const existing_streak = await (prisma as any).triviaStreak.findUnique({ where: { userId } });
      if (existing_streak) {
        const lastPlayed = existing_streak.lastPlayedAt ? new Date(existing_streak.lastPlayedAt) : null;
        const lastPlayedDay = lastPlayed ? new Date(lastPlayed.getFullYear(), lastPlayed.getMonth(), lastPlayed.getDate()) : null;

        if (lastPlayedDay && lastPlayedDay.getTime() === today.getTime()) {
          // Already played today — no streak change
          streak = { currentStreak: existing_streak.currentStreak, longestStreak: existing_streak.longestStreak };
        } else if (lastPlayedDay && lastPlayedDay.getTime() === yesterday.getTime()) {
          // Consecutive day — extend streak
          const newCurrent = existing_streak.currentStreak + 1;
          const newLongest = Math.max(existing_streak.longestStreak, newCurrent);
          await (prisma as any).triviaStreak.update({
            where: { userId },
            data: { currentStreak: newCurrent, longestStreak: newLongest, lastPlayedAt: new Date() },
          });
          streak = { currentStreak: newCurrent, longestStreak: newLongest };
        } else {
          // Streak broken — reset to 1
          await (prisma as any).triviaStreak.update({
            where: { userId },
            data: { currentStreak: 1, longestStreak: Math.max(existing_streak.longestStreak, 1), lastPlayedAt: new Date() },
          });
          streak = { currentStreak: 1, longestStreak: Math.max(existing_streak.longestStreak, 1) };
        }
      } else {
        await (prisma as any).triviaStreak.create({
          data: { userId, currentStreak: 1, longestStreak: 1, lastPlayedAt: new Date() },
        });
      }
    } catch (e: any) { }

    res.json({ isCorrect, points, correctAnswer: question.answer, speedBonus, streak });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});


// GET /api/campfire/:campgroundId/question-results/:questionId
// Returns who got it right/wrong for post-question trash talk
router.get('/:campgroundId/question-results/:questionId', async (req: any, res: any) => {
  try {
    const { questionId } = req.params;

    const answers = await (prisma as any).triviaAnswer.findMany({
      where: { questionId },
      include: {
        user: { select: { id: true, firstName: true, username: true } },
      },
      orderBy: { responseTime: 'asc' },
    });

    const correct = answers.filter((a: any) => a.isCorrect);
    const wrong = answers.filter((a: any) => !a.isCorrect);
    const question = await (prisma as any).triviaQuestion.findUnique({
      where: { id: questionId },
      select: { answer: true, optionA: true, optionB: true, optionC: true, optionD: true },
    });

    res.json({ correct, wrong, correctAnswer: question?.answer, total: answers.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get results' });
  }
});


// POST /api/campfire/:campgroundId/chat-message (internal - posts Hitch message to chat)
router.post('/:campgroundId/chat-message', authenticateToken, async (req: any, res: any) => {
  try {
    const { campgroundId } = req.params;
    const { content } = req.body;

    const room = await (prisma as any).campfireRoom.findFirst({
      where: { campgroundId, isActive: true },
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const message = await (prisma as any).campfireMessage.create({
      data: { roomId: room.id, isHitch: true, content },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } },
      },
    });

    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to post message' });
  }
});


// GET /api/campfire/:campgroundId/daily-vibe
// AI-generated daily Hitch Pulse — like a chatty neighbor with camp gossip
// Cached per campground per 3 hours to keep it fresh through the day
const vibeCache: Record<string, { message: string; cachedAt: number }> = {};
const VIBE_TTL = 3 * 60 * 60 * 1000; // 3 hours

router.get('/:campgroundId/daily-vibe', async (req: any, res: any) => {
  try {
    const { campgroundId } = req.params;

    // Check cache — refresh every 3 hours
    const cached = vibeCache[campgroundId];
    if (cached && Date.now() - cached.cachedAt < VIBE_TTL) {
      return res.json({ message: cached.message });
    }

    const campground = await (prisma as any).campground.findUnique({
      where: { id: campgroundId },
      select: { name: true, city: true, state: true },
    });
    if (!campground) return res.json({ message: null });

    const now = new Date();
    const hour = now.getHours();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayOfWeek = dayNames[now.getDay()];
    const timeOfDay = hour < 6 ? 'early morning' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    const month = now.getMonth();
    const season = month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'fall' : 'winter';

    // Gather real context for Hitch to riff on
    const context: string[] = [];

    // Who's checked in?
    const checkedInCount = await (prisma as any).checkIn.count({
      where: { campgroundId, isActive: true },
    });
    if (checkedInCount > 0) context.push(`${checkedInCount} camper${checkedInCount > 1 ? 's' : ''} currently checked in`);

    // Trivia info
    const triviaWeek = await (prisma as any).triviaWeek?.findFirst?.({
      where: { campgroundId, isActive: true },
      include: {
        leaderboard: { orderBy: { totalPoints: 'desc' }, take: 1, include: { user: { select: { firstName: true } } } },
      },
    }).catch(() => null);
    if (triviaWeek) {
      context.push(`Trivia theme this week: "${triviaWeek.theme}"`);
      if (triviaWeek.leaderboard?.[0]) {
        context.push(`Current trivia leader: ${triviaWeek.leaderboard[0].user?.firstName} with ${triviaWeek.leaderboard[0].totalPoints} pts`);
      }
      context.push('Trivia sessions at 7:30 AM, 12:25 PM & 5:30 PM CT');
    }

    // Recent check-in names
    const recentCheckins = await (prisma as any).checkIn.findMany({
      where: { campgroundId, isActive: true },
      include: { user: { select: { firstName: true } } },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    const names = recentCheckins.map((c: any) => c.user?.firstName).filter(Boolean);
    if (names.length > 0) context.push(`Recent arrivals: ${names.join(', ')}`);

    // Any upcoming events at this campground?
    const upcomingEvent = await (prisma as any).event.findFirst({
      where: { campgroundId, startDate: { gte: now }, eventStatus: { not: 'CANCELLED' } },
      select: { title: true, startDate: true },
      orderBy: { startDate: 'asc' },
    }).catch(() => null);
    if (upcomingEvent) {
      const eventDate = new Date(upcomingEvent.startDate);
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / 86400000);
      context.push(`Upcoming event: "${upcomingEvent.title}" in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`);
    }

    // Pick a random conversation style to keep it varied
    const styles = [
      'neighborly gossip — share a fun observation or campground tidbit',
      'trivia hype — tease the next trivia session or congratulate the current leader',
      'campfire wisdom — share a quick camping tip relevant to the season and location',
      'community cheerleader — welcome new arrivals or celebrate who\'s here',
      'weather chat — comment on the season and what it means for camping today',
      'random fun fact — share something interesting about the area or camping in general',
      'gentle nudge — remind folks about an upcoming event or trivia session',
      'nostalgic storyteller — quick one-liner about a campfire memory or tradition',
    ];
    const style = styles[Math.floor(Math.random() * styles.length)];

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic.default();

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `You are Hitch, the friendly RV Unicorn campfire host at ${campground.name} in ${campground.city}, ${campground.state}. You're like the neighbor at the campground who always wants to chat — warm, curious, a little nosy, always knows what's going on.

It's ${dayOfWeek} ${timeOfDay} in ${season}.

Here's what you know right now:
${context.length > 0 ? context.map(c => `- ${c}`).join('\n') : '- Quiet day at camp so far'}

Your vibe for this message: ${style}

Write 1-2 short sentences (under 160 characters). Sound like a real camp neighbor, not a bot. Be specific, personal, and fun. Reference actual context above when possible. No hashtags. Emojis are fine but don't start with one.`,
      }],
    });

    const message = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    if (message) vibeCache[campgroundId] = { message, cachedAt: Date.now() };

    res.json({ message });
  } catch (error: any) {
    res.json({ message: null });
  }
});


// POST /api/campfire/:campgroundId/recipe-of-night (admin — post tonight's recipe to chat)
router.post('/:campgroundId/recipe-of-night', authenticateToken, async (req: any, res: any) => {
  try {
    const { campgroundId } = req.params;

    const room = await (prisma as any).campfireRoom.findFirst({
      where: { campgroundId, isActive: true },
    });
    if (!room) return res.status(404).json({ error: 'No active campfire room' });

    const campground = await (prisma as any).campground.findUnique({
      where: { id: campgroundId },
      select: { name: true, state: true },
    });

    const now = new Date();
    const season = [11,0,1].includes(now.getMonth()) ? 'winter' : [2,3,4].includes(now.getMonth()) ? 'spring' : [5,6,7].includes(now.getMonth()) ? 'summer' : 'fall';

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic.default();

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are Hitch, the friendly RV Unicorn campfire host at ${campground?.name || 'camp'} in ${season}.
Write a SHORT campfire recipe post for tonight. Format it exactly like this (keep it under 200 words):

🍳 Tonight's Campfire Recipe: [Recipe Name]

[1-2 sentence fun intro]

Ingredients:
• [item]
• [item]
• [item]
• [item]

Steps:
1. [step]
2. [step]
3. [step]

[Fun closing line with a campfire emoji]

Make it a real, delicious camp recipe. Keep it simple — one pot, foil packet, or cast iron. Be warm and friendly.`
      }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    if (!content) return res.status(500).json({ error: 'Failed to generate recipe' });

    const message = await (prisma as any).campfireMessage.create({
      data: { roomId: room.id, isHitch: true, content },
    });

    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to post recipe' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP CHAT ROUTES
// ═══════════════════════════════════════════════════════════════════════

// POST /campfire/groups — create a new group
router.post('/groups', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { campgroundId, name, memberIds } = req.body;
    if (!campgroundId) return res.status(400).json({ error: 'campgroundId required' });

    const group = await prisma.campfireGroup.create({
      data: {
        campgroundId,
        name: name || null,
        createdByUserId: userId,
        members: {
          create: [
            { userId },
            ...(memberIds || []).filter((id: string) => id !== userId).map((id: string) => ({ userId: id })),
          ],
        },
      },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } } },
      },
    });
    res.status(201).json(group);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /campfire/groups?campgroundId= — get user's groups at campground
router.get('/groups', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { campgroundId } = req.query;
    if (!campgroundId) return res.status(400).json({ error: 'campgroundId required' });

    const groups = await prisma.campfireGroup.findMany({
      where: {
        campgroundId: campgroundId as string,
        members: { some: { userId } },
      },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(groups);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /campfire/groups/:groupId/members — invite a user
router.post('/groups/:groupId/members', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;
    const { userId: inviteeId, username } = req.body;

    // Verify requester is a member
    const isMember = await prisma.campfireGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

    let targetId = inviteeId;
    if (!targetId && username) {
      const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      targetId = user.id;
    }
    if (!targetId) return res.status(400).json({ error: 'userId or username required' });

    const member = await prisma.campfireGroupMember.create({
      data: { groupId, userId: targetId },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
    });
    res.status(201).json(member);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Already a member' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /campfire/groups/:groupId/members/:userId — remove member
router.delete('/groups/:groupId/members/:targetUserId', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { groupId, targetUserId } = req.params;

    // Allow self-leave or creator-remove
    if (targetUserId !== userId) {
      const group = await prisma.campfireGroup.findUnique({ where: { id: groupId }, select: { createdByUserId: true } });
      if (group?.createdByUserId !== userId) return res.status(403).json({ error: 'Only the group creator can remove members' });
    }

    await prisma.campfireGroupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /campfire/groups/:groupId/messages — fetch group message history
router.get('/groups/:groupId/messages', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;

    const isMember = await prisma.campfireGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    const messages = await prisma.campfireGroupMessage.findMany({
      where: { groupId },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    res.json(messages);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /campfire/groups/:groupId/messages — send a group message
router.post('/groups/:groupId/messages', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { groupId } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message content required' });

    const isMember = await prisma.campfireGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    const message = await prisma.campfireGroupMessage.create({
      data: { groupId, userId, content: content.trim() },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
    });

    // Update group's updatedAt
    await prisma.campfireGroup.update({ where: { id: groupId }, data: { updatedAt: new Date() } });

    res.status(201).json(message);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// AI CAMPFIRE ROUTES
// ═══════════════════════════════════════════════════════════════════════

const AI_RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();

// POST /campfire/ai — send a message to an AI character
router.post('/ai', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { characterId, message, campgroundId, conversationHistory } = req.body;
    if (!characterId || !message?.trim()) return res.status(400).json({ error: 'characterId and message required' });

    // Rate limit: 30/hour
    const now = Date.now();
    const limit = AI_RATE_LIMIT.get(userId);
    if (limit && limit.resetAt > now && limit.count >= 30) {
      return res.status(429).json({ error: 'Rate limit exceeded. Max 30 AI messages per hour.' });
    }
    if (!limit || limit.resetAt <= now) {
      AI_RATE_LIMIT.set(userId, { count: 1, resetAt: now + 3600000 });
    } else {
      limit.count++;
    }

    // Get campground context
    const campground = campgroundId
      ? await prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true, state: true, location: true } })
      : null;

    const CHARACTER_PROMPTS: Record<string, string> = {
      HITCH: `You are Hitch, a warm experienced RV traveler and mentor. Helpful, knowledgeable, encouraging.`,
      WALLET: `You are Wallet, a funny deal-hunter who loves saving money on the road. Witty and practical.`,
      WALTER: `You are Walter, a gentle astronomy and nature enthusiast. Quiet, observational, wonder-struck.`,
      SCOUT: `You are Scout, an adventure-loving trailblazer. High energy, loves hidden gems and outdoor activities.`,
      HOLDEN: `You are Holden, a Junior Ranger kid who loves outdoor adventures, scavenger hunts, fishing, wildlife, and playgrounds. Enthusiastic 10-year-old voice.`,
      HANNAH: `You are Hannah, a Junior Ranger kid who loves family trip planning, educational activities, museums, dining, and attractions. Smart curious 10-year-old voice.`,
    };

    const charPrompt = CHARACTER_PROMPTS[characterId.toUpperCase()] || CHARACTER_PROMPTS.HITCH;
    const contextLine = campground ? ` You are at ${campground.name}${campground.state ? ', ' + campground.state : ''}.` : '';
    const systemPrompt = `${charPrompt}${contextLine} Keep responses to 2-4 sentences. Family-friendly. Be conversational and natural.`;

    const messages = (conversationHistory || []).slice(-10).map((m: any) => ({ role: m.role, content: m.content }));
    messages.push({ role: 'user', content: message.trim() });

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages,
    });

    const reply = (response.content[0] as any)?.text?.trim() || 'Sorry, I got distracted by the campfire!';

    // Upsert session for context tracking
    const sessionKey = `${userId}-${campgroundId || 'global'}-${characterId}`;
    await prisma.aICampfireSession.upsert({
      where: { id: sessionKey },
      create: {
        id: sessionKey,
        userId,
        campgroundId: campgroundId || '',
        characterId: characterId.toUpperCase(),
        messages: [...messages, { role: 'assistant', content: reply }].slice(-20),
      },
      update: {
        messages: [...messages, { role: 'assistant', content: reply }].slice(-20),
        updatedAt: new Date(),
      },
    }).catch(() => {}); // Non-critical

    const CHARACTER_IMAGES: Record<string, string> = {
      HITCH: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png',
      WALLET: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218458/rvunicorn/guides/wallet_guide.png',
      WALTER: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261024/rvunicorn/characters/walter.png',
      SCOUT: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261023/rvunicorn/characters/scout.png',
      HOLDEN: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1781042437/rvunicorn/characters/holden.jpg',
      HANNAH: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1781042437/rvunicorn/characters/hannah.jpg',
    };

    res.json({
      reply,
      character: characterId.toUpperCase(),
      image: CHARACTER_IMAGES[characterId.toUpperCase()] || CHARACTER_IMAGES.HITCH,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;