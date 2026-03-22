import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Campground Leaderboard ────────────────────────────────────

// GET /api/campfire-phase4/leaderboard/global
// Top campgrounds this week by total trivia points
router.get('/leaderboard/global', async (req, res) => {
  try {
    const { weekId } = req.query;

    let week: any;
    if (weekId) {
      week = await prisma.triviaWeek.findFirst({ where: { id: String(weekId) } });
    } else {
      week = await prisma.triviaWeek.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    }

    if (!week) return res.json({ leaderboard: [], week: null });

    // Aggregate points per campground for this week
    const scores = await prisma.triviaLeaderboard.groupBy({
      by: ['weekId'],
      where: { weekId: week.id },
      _sum: { totalPoints: true },
      _count: { userId: true },
    });

    // Get per-campground breakdown
    const campgroundScores = await prisma.campgroundTriviaScore.findMany({
      where: { weekId: week.id },
      include: {
        campground: { select: { id: true, name: true, city: true, state: true, imageUrl: true } },
      },
      orderBy: { totalPoints: 'desc' },
      take: 20,
    });

    // If no scores yet, compute from leaderboard
    if (campgroundScores.length === 0) {
      const weeks = await prisma.triviaWeek.findMany({
        where: { isActive: true },
        include: {
          campground: { select: { id: true, name: true, city: true, state: true, imageUrl: true } },
          leaderboard: { orderBy: { totalPoints: 'desc' } },
        },
      });

      const computed = weeks
        .map(w => ({
          campgroundId: w.campgroundId,
          campground: w.campground,
          totalPoints: w.leaderboard.reduce((s, l) => s + l.totalPoints, 0),
          playerCount: w.leaderboard.length,
        }))
        .filter(w => w.totalPoints > 0)
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, 20)
        .map((w, i) => ({ ...w, weekRank: i + 1 }));

      return res.json({ leaderboard: computed, week });
    }

    res.json({
      leaderboard: campgroundScores.map((s, i) => ({ ...s, weekRank: i + 1 })),
      week,
    });
  } catch (e: any) {
    console.error('Global leaderboard error:', e?.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/campfire-phase4/leaderboard/:campgroundId
// This campground's rank + nearby competitors
router.get('/leaderboard/:campgroundId', async (req, res) => {
  try {
    const { campgroundId } = req.params;
    const week = await prisma.triviaWeek.findFirst({
      where: { campgroundId, isActive: true },
      include: {
        leaderboard: {
          orderBy: { totalPoints: 'desc' },
          include: { user: { select: { id: true, firstName: true, username: true, profileImage: true } } },
        },
      },
    });

    if (!week) return res.json({ rank: null, totalPoints: 0, playerCount: 0, topPlayers: [] });

    const totalPoints = week.leaderboard.reduce((s, l) => s + l.totalPoints, 0);

    // Count how many campgrounds have more points
    const allWeeks = await prisma.triviaWeek.findMany({
      where: { isActive: true },
      include: { leaderboard: { select: { totalPoints: true } } },
    });

    const campgroundTotals = allWeeks.map(w => ({
      campgroundId: w.campgroundId,
      total: w.leaderboard.reduce((s, l) => s + l.totalPoints, 0),
    })).sort((a, b) => b.total - a.total);

    const rank = campgroundTotals.findIndex(c => c.campgroundId === campgroundId) + 1;
    const totalCampgrounds = campgroundTotals.filter(c => c.total > 0).length;

    res.json({
      rank,
      totalCampgrounds,
      totalPoints,
      playerCount: week.leaderboard.length,
      topPlayers: week.leaderboard.slice(0, 5),
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Streaks ───────────────────────────────────────────────────

// GET /api/campfire-phase4/streak/:userId
router.get('/streak/:userId', authenticateToken, async (req: any, res) => {
  try {
    const streak = await prisma.triviaStreak.findUnique({
      where: { userId: req.params.userId },
    });
    res.json(streak || { currentStreak: 0, longestStreak: 0, lastPlayedAt: null });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Tone Mode ─────────────────────────────────────────────────

// POST /api/campfire-phase4/tone/:campgroundId
router.post('/tone/:campgroundId', authenticateToken, async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const { tone } = req.body; // 'friendly' | 'spicy' | 'master'
    if (!['friendly', 'spicy', 'master'].includes(tone)) {
      return res.status(400).json({ error: 'Invalid tone' });
    }
    // Check user is checked in
    const checkIn = await prisma.checkIn.findFirst({
      where: { userId: req.user.id, campgroundId, isActive: true },
    });
    if (!checkIn) return res.status(403).json({ error: 'Must be checked in to change tone' });

    const room = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Store tone in room (we'll add this field)
    await prisma.$executeRaw`UPDATE "CampfireRoom" SET "toneMode" = ${tone} WHERE "campgroundId" = ${campgroundId}`;

    res.json({ success: true, tone });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Private Trivia Rooms ──────────────────────────────────────

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /api/campfire-phase4/private/create
router.post('/private/create', authenticateToken, async (req: any, res) => {
  try {
    const { topic = 'general' } = req.body;
    const userId = req.user.id;
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    // Generate 10 questions via AI
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Generate 10 G-rated trivia questions about: ${topic === 'general' ? 'mixed topics (camping, food, pop culture, nature, sports)' : topic}.
Return ONLY a JSON array, no markdown:
[{"question":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","answer":"A","category":"..."}]`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const room = await prisma.privateTriviaRoom.create({
      data: {
        code,
        hostId: userId,
        topic,
        expiresAt,
        participants: { create: { userId } },
        questions: {
          create: questions.map((q: any, i: number) => ({
            questionNum: i + 1,
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            answer: q.answer,
            category: q.category || topic,
          })),
        },
      },
      include: { questions: true },
    });

    res.json({ room, code });
  } catch (e: any) {
    console.error('Private room create error:', e?.message);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// POST /api/campfire-phase4/private/join
router.post('/private/join', authenticateToken, async (req: any, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    const room = await prisma.privateTriviaRoom.findUnique({
      where: { code: code.toUpperCase() },
      include: { participants: true, questions: { orderBy: { questionNum: 'asc' } } },
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.isActive) return res.status(400).json({ error: 'Room has ended' });
    if (new Date() > room.expiresAt) return res.status(400).json({ error: 'Room has expired' });

    // Add participant if not already in
    await prisma.privateTriviaParticipant.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      update: {},
      create: { roomId: room.id, userId },
    });

    res.json({ room });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// GET /api/campfire-phase4/private/:code
router.get('/private/:code', authenticateToken, async (req: any, res) => {
  try {
    const room = await prisma.privateTriviaRoom.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: {
        host: { select: { id: true, firstName: true, username: true, profileImage: true } },
        participants: {
          include: { user: { select: { id: true, firstName: true, username: true, profileImage: true } } },
          orderBy: { totalPoints: 'desc' },
        },
        questions: { orderBy: { questionNum: 'asc' } },
      },
    });
    if (!room) return res.status(404).json({ error: 'Not found' });
    res.json({ room });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/campfire-phase4/private/:code/answer
router.post('/private/:code/answer', authenticateToken, async (req: any, res) => {
  try {
    const { questionId, answer, answeredAt } = req.body;
    const userId = req.user.id;

    const room = await prisma.privateTriviaRoom.findUnique({
      where: { code: req.params.code.toUpperCase() },
    });
    if (!room) return res.status(404).json({ error: 'Not found' });

    const question = await prisma.privateTriviaQuestion.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const responseTime = Math.floor((new Date(answeredAt).getTime() - (question.askedAt?.getTime() || Date.now())) / 1000);
    const isCorrect = question.answer === answer;
    const speedBonus = isCorrect ? (responseTime < 30 ? 5 : responseTime < 90 ? 2 : 0) : 0;
    const points = isCorrect ? 10 + speedBonus : 0;

    // Update participant score
    await prisma.privateTriviaParticipant.update({
      where: { roomId_userId: { roomId: room.id, userId } },
      data: { totalPoints: { increment: points } },
    });

    res.json({ isCorrect, points, correctAnswer: question.answer });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/campfire-phase4/private/:code/end
router.post('/private/:code/end', authenticateToken, async (req: any, res) => {
  try {
    const room = await prisma.privateTriviaRoom.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: { participants: { orderBy: { totalPoints: 'desc' }, include: { user: { select: { id: true, firstName: true } } } } },
    });
    if (!room) return res.status(404).json({ error: 'Not found' });
    if (room.hostId !== req.user.id) return res.status(403).json({ error: 'Only host can end' });

    const winner = room.participants[0];
    await prisma.privateTriviaRoom.update({
      where: { id: room.id },
      data: { isActive: false, winnerId: winner?.userId },
    });

    res.json({ winner: winner?.user, participants: room.participants });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Sponsored Questions ───────────────────────────────────────

// GET /api/campfire-phase4/sponsored/next
router.get('/sponsored/next', async (req, res) => {
  try {
    const now = new Date();
    const question = await prisma.sponsoredQuestion.findFirst({
      where: {
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ question });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
