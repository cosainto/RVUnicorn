import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();
const prisma = new PrismaClient();
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
    console.error("Campfire posts error:", e?.message);
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
    console.error("Create post error:", e?.message);
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
    console.error("Pulse error:", e?.message);
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
    res.json({
      isActive: room?.isActive ?? false,
      checkedInCount: checkIns.length,
      checkedInUsers: checkIns.map((c: any) => c.user),
      needsMore: Math.max(0, 3 - checkIns.length),
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch room status' });
  }
});

// GET /api/campfire/:campgroundId/room/messages
router.get('/:campgroundId/room/messages', authenticateToken, async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const room = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
    if (!room) return res.json({ messages: [] });
    const messages = await prisma.campfireMessage.findMany({
      where: { roomId: room.id },
      include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    res.json({ messages });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});


// GET /api/campfire/:campgroundId/active-question
// Returns the most recently asked question if still within time limit
router.get('/:campgroundId/active-question', async (req: Request, res: Response) => {
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

    // Find most recently asked question that is still within time window (30s)
    const cutoff = new Date(Date.now() - 60000);
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
        category: question.category,
        timeLimit: 30,
        askedAt: question.askedAt,
      }
    });
  } catch (error) {
    console.error('Active question error:', error);
    res.status(500).json({ error: 'Failed to get active question' });
  }
});



// POST /api/campfire/:campgroundId/answer
router.post('/:campgroundId/answer', authenticateToken, async (req: Request, res: Response) => {
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

    res.json({ isCorrect, points, correctAnswer: question.answer, speedBonus });
  } catch (error) {
    console.error('Answer error:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});


// GET /api/campfire/:campgroundId/question-results/:questionId
// Returns who got it right/wrong for post-question trash talk
router.get('/:campgroundId/question-results/:questionId', async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Question results error:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});


// POST /api/campfire/:campgroundId/chat-message (internal - posts Hitch message to chat)
router.post('/:campgroundId/chat-message', authenticateToken, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ error: 'Failed to post message' });
  }
});

export default router;