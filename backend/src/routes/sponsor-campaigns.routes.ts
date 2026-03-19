import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const WILL_ID = 'cmlpeyk82005s3qause3sws7y';
const isAdmin = (req: any) => req.user?.id === WILL_ID;

// ── Campaign CRUD ─────────────────────────────────────────────

router.get('/', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const campaigns = await prisma.sponsorCampaign.findMany({
      include: {
        questions: { select: { id: true, isActive: true, status: true } },
        _count: { select: { impressions: true, answers: true, rewardGrants: true, discountCodes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ campaigns });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const { internalName, brandName, brandLogoUrl, brandLandingUrl, packageType, startDate, endDate, maxImpressions, maxRewardGrants, selectionWeight, exclusivityType, internalNotes } = req.body;
    const campaign = await prisma.sponsorCampaign.create({
      data: {
        internalName, brandName,
        brandLogoUrl: brandLogoUrl || null,
        brandLandingUrl: brandLandingUrl || null,
        packageType: packageType || 'weekly',
        status: 'draft',
        isActive: false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        maxImpressions: maxImpressions ? parseInt(maxImpressions) : null,
        maxRewardGrants: maxRewardGrants ? parseInt(maxRewardGrants) : null,
        selectionWeight: selectionWeight ? parseInt(selectionWeight) : 1,
        exclusivityType: exclusivityType || null,
        internalNotes: internalNotes || null,
        createdById: req.user.id,
      },
    });
    res.json({ campaign });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:id', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const data: any = {};
    const fields = ['internalName','brandName','brandLogoUrl','brandLandingUrl','packageType','status','isActive','maxImpressions','maxRewardGrants','selectionWeight','exclusivityType','internalNotes'];
    fields.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (req.body.startDate !== undefined) data.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
    if (req.body.endDate !== undefined) data.endDate = req.body.endDate ? new Date(req.body.endDate) : null;
    if (req.body.status === 'approved') data.approvedById = req.user.id;
    const campaign = await prisma.sponsorCampaign.update({ where: { id: req.params.id }, data });
    res.json({ campaign });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:id', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    await prisma.sponsorCampaign.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

// ── Campaign Questions ────────────────────────────────────────

router.get('/:id/questions', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const questions = await prisma.sponsoredQuestion.findMany({
      where: { campaignId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ questions });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/questions', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const campaign = await prisma.sponsorCampaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const { question, optionA, optionB, optionC, optionD, answer, rewardType, rewardValue, priority, internalNotes } = req.body;
    const q = await prisma.sponsoredQuestion.create({
      data: {
        campaignId: req.params.id,
        brandName: campaign.brandName,
        brandLogo: campaign.brandLogoUrl || null,
        question, optionA, optionB, optionC, optionD, answer,
        rewardType: rewardType || 'points',
        rewardValue: rewardValue || null,
        isActive: false,
        status: 'pending',
        priority: priority ? parseInt(priority) : 1,
        internalNotes: internalNotes || null,
      },
    });
    res.json({ question: q });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/questions/:id/approve', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const q = await prisma.sponsoredQuestion.update({
      where: { id: req.params.id },
      data: { status: 'approved', isActive: true },
    });
    res.json({ question: q });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/questions/:id/reject', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const q = await prisma.sponsoredQuestion.update({
      where: { id: req.params.id },
      data: { status: 'rejected', isActive: false },
    });
    res.json({ question: q });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

// ── Discount Code Pool ────────────────────────────────────────

router.get('/:id/codes', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const codes = await prisma.discountCodePool.findMany({
      where: { campaignId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    const available = codes.filter(c => c.status === 'available').length;
    const assigned = codes.filter(c => c.status === 'assigned').length;
    const redeemed = codes.filter(c => c.status === 'redeemed').length;
    res.json({ codes, stats: { total: codes.length, available, assigned, redeemed } });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/codes', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const { codes } = req.body; // array of code strings
    if (!Array.isArray(codes) || codes.length === 0) return res.status(400).json({ error: 'Provide array of codes' });
    const created = await prisma.discountCodePool.createMany({
      data: codes.map((code: string) => ({ campaignId: req.params.id, code: code.trim().toUpperCase() })),
      skipDuplicates: true,
    });
    res.json({ created: created.count });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

// ── Analytics ─────────────────────────────────────────────────

router.get('/:id/analytics', authenticateToken, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  try {
    const campaignId = req.params.id;
    const [impressions, answers, rewards, codes, questions] = await Promise.all([
      prisma.sponsoredQuestionImpression.count({ where: { campaignId } }),
      prisma.sponsoredQuestionAnswer.findMany({ where: { campaignId } }),
      prisma.sponsoredRewardGrant.count({ where: { campaignId } }),
      prisma.discountCodePool.groupBy({ by: ['status'], where: { campaignId }, _count: true }),
      prisma.sponsoredQuestion.findMany({
        where: { campaignId },
        include: {
          _count: { select: { impressions: true, answers: true } },
        },
      }),
    ]);

    const totalAnswers = answers.length;
    const correctAnswers = answers.filter(a => a.isCorrect).length;
    const uniquePlayers = new Set(answers.map(a => a.playerId)).size;

    // Daily impressions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyImpressions = await prisma.sponsoredQuestionImpression.groupBy({
      by: ['servedAt'],
      where: { campaignId, servedAt: { gte: thirtyDaysAgo } },
      _count: true,
    });

    res.json({
      summary: {
        totalImpressions: impressions,
        totalAnswers,
        correctAnswers,
        answerRate: totalAnswers > 0 ? Math.round((totalAnswers / impressions) * 100) : 0,
        correctRate: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
        totalRewards: rewards,
        uniquePlayers,
      },
      codeStats: codes,
      questionBreakdown: questions.map(q => ({
        id: q.id,
        question: q.question.substring(0, 60) + '...',
        impressions: q._count.impressions,
        answers: q._count.answers,
        status: q.status,
        isActive: q.isActive,
      })),
      dailyImpressions,
    });
  } catch (e: any) { res.status(500).json({ error: 'Failed' }); }
});

// ── Runtime: Get eligible sponsored question for Q5 ──────────

router.get('/runtime/next', async (req, res) => {
  try {
    const now = new Date();
    const campaigns = await prisma.sponsorCampaign.findMany({
      where: {
        isActive: true,
        status: 'approved',
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      include: {
        questions: {
          where: { isActive: true, status: 'approved' },
          orderBy: { priority: 'desc' },
        },
        _count: { select: { impressions: true, rewardGrants: true } },
      },
      orderBy: { selectionWeight: 'desc' },
    });

    // Filter by impression/reward caps
    const eligible = campaigns.filter(c => {
      if (c.maxImpressions && c._count.impressions >= c.maxImpressions) return false;
      if (c.maxRewardGrants && c._count.rewardGrants >= c.maxRewardGrants) return false;
      return c.questions.length > 0;
    });

    if (eligible.length === 0) return res.json({ question: null });

    // Weighted random selection
    const totalWeight = eligible.reduce((s, c) => s + c.selectionWeight, 0);
    let rand = Math.random() * totalWeight;
    let selected = eligible[0];
    for (const c of eligible) {
      rand -= c.selectionWeight;
      if (rand <= 0) { selected = c; break; }
    }

    const question = selected.questions[0];
    res.json({
      question: {
        ...question,
        campaignId: selected.id,
        brandName: selected.brandName,
        brandLogoUrl: selected.brandLogoUrl,
        brandLandingUrl: selected.brandLandingUrl,
      },
    });
  } catch (e: any) {
    console.error('Sponsored runtime error:', e?.message);
    res.json({ question: null }); // fail safe
  }
});

// ── Runtime: Log answer + grant reward ───────────────────────

router.post('/runtime/answer', authenticateToken, async (req: any, res) => {
  try {
    const { campaignId, sponsoredQuestionId, selectedAnswer, answeredAt, responseTimeMs } = req.body;
    const userId = req.user.id;

    const question = await prisma.sponsoredQuestion.findUnique({ where: { id: sponsoredQuestionId } });
    if (!question) return res.status(404).json({ error: 'Not found' });

    const isCorrect = question.answer === selectedAnswer;

    // Log answer
    await prisma.sponsoredQuestionAnswer.create({
      data: { campaignId, sponsoredQuestionId, playerId: userId, selectedAnswer, isCorrect, answeredAt: new Date(answeredAt), responseTimeMs: responseTimeMs || null },
    });

    let reward: any = null;

    if (isCorrect) {
      // Check reward caps
      const campaign = await prisma.sponsorCampaign.findUnique({
        where: { id: campaignId },
        include: { _count: { select: { rewardGrants: true } } },
      });

      const underCap = !campaign?.maxRewardGrants || campaign._count.rewardGrants < campaign.maxRewardGrants;

      if (underCap) {
        let codeId: string | null = null;
        let rewardValue = question.rewardValue;

        // Assign unique code if reward type is discount
        if (question.rewardType === 'discount') {
          const code = await prisma.discountCodePool.findFirst({
            where: { campaignId, status: 'available' },
          });
          if (code) {
            await prisma.discountCodePool.update({
              where: { id: code.id },
              data: { status: 'assigned', assignedToId: userId, assignedAt: new Date() },
            });
            codeId = code.id;
            rewardValue = code.code;
          }
        }

        await prisma.sponsoredRewardGrant.create({
          data: { campaignId, sponsoredQuestionId, playerId: userId, rewardType: question.rewardType, rewardValue, codeId, status: 'granted' },
        });

        reward = { type: question.rewardType, value: rewardValue };
      }
    }

    res.json({ isCorrect, correctAnswer: question.answer, reward });
  } catch (e: any) {
    console.error('Sponsored answer error:', e?.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Runtime: Log impression ───────────────────────────────────

router.post('/runtime/impression', authenticateToken, async (req: any, res) => {
  try {
    const { campaignId, sponsoredQuestionId, campgroundId } = req.body;
    await prisma.sponsoredQuestionImpression.create({
      data: { campaignId, sponsoredQuestionId, campgroundId: campgroundId || null, playerId: req.user.id },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.json({ success: false }); // fail safe
  }
});

export default router;
