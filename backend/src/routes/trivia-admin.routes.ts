import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { kickoffNewWeek, askNextQuestion, forceAskNextQuestion, postTriviaWarning, postDailyLeaderboard } from '../cron/trivia-cron';
import { prisma } from '../prisma';

const router = Router();

const ADMIN_IDS = [
  'cmlpeyk82005s3qause3sws7y',
  'cmm9kukta0006i88masvtz2tp',
];

function isAdmin(req: any) {
  return ADMIN_IDS.includes((req as any).userId);
}

router.post('/kickoff', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  // Run in background — Anthropic call takes too long for HTTP timeout
  res.json({ success: true, message: 'Trivia kickoff started in background — check status in 60 seconds' });
  kickoffNewWeek().then(() => {
    console.log('[TriviaAdmin] Kickoff completed successfully');
  }).catch(e => {
    console.error('[TriviaAdmin] Kickoff FAILED:', e?.message || e);
    console.error('[TriviaAdmin] Stack:', e?.stack);
  });
});

router.post('/ask', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const io = req.app.locals.io;
    await forceAskNextQuestion(io);
    res.json({ success: true, message: 'Question posted' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/warn', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    await postTriviaWarning();
    res.json({ success: true, message: 'Warning posted' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/leaderboard', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const io = req.app.locals.io;
    await postDailyLeaderboard(io);
    res.json({ success: true, message: 'Leaderboard posted' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/status/:campgroundId', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const { campgroundId } = req.params;
    const room = await prisma.campfireRoom.findFirst({ where: { campgroundId } });
    const week = await prisma.triviaWeek.findFirst({
      where: { campgroundId, isActive: true },
      include: {
        questions: { orderBy: { dayOfWeek: 'asc' }, take: 5 },
        leaderboard: {
          orderBy: { totalPoints: 'desc' },
          take: 5,
          include: { user: { select: { firstName: true, username: true } } },
        },
      },
    });
    res.json({ room, week, hasActiveWeek: !!week, questionCount: week?.questions?.length || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
