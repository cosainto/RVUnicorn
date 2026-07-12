import { Router, Request, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';
import { sendWebPush } from '../utils/webPush';

const router = Router();
import { prisma } from '../lib/prisma';
const anthropic = new Anthropic();

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

function getSeason(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

async function callHaiku(prompt: string, maxTokens = 150): Promise<string> {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, temperature: 0.8,
    messages: [{ role: 'user', content: prompt }],
  });
  return (res.content[0] as any)?.text?.trim() || '';
}

// ══ POST /api/community/generate-nudge ══
router.post('/generate-nudge', authenticateToken, async (req: any, res: Response) => {
  try {
    const { trigger, campgroundName, campgroundState, nightsStayed, tripName, route, totalNights, totalMiles } = req.body;

    let prompt = '';
    if (trigger === 'checkout') {
      prompt = `You are Hitch, RVUnicorn's AI camp guide. A user just checked out of ${campgroundName} in ${campgroundState} after ${nightsStayed || 'a few'} nights. Write a warm, encouraging 2-sentence nudge asking them to share their experience in the community. Be specific to the campground and stay length. End with a question that teases what their post could answer for other RVers. Family friendly, campfire tone, under 50 words. Return only the nudge text.`;
    } else if (trigger === 'trip_complete') {
      prompt = `You are Hitch, RVUnicorn's AI camp guide. A user just completed a road trip: ${route || tripName}, ${totalNights} nights, ${totalMiles || 'many'} miles. Write a warm 2-sentence nudge encouraging them to share their trip report. End with what other RVers would want to know. Under 50 words. Return only the text.`;
    }

    const nudge = await callHaiku(prompt);
    res.json({ nudge });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/community/generate-draft ══
router.post('/generate-draft', authenticateToken, async (req: any, res: Response) => {
  try {
    const { trigger, campgroundName, campgroundState, nightsStayed, amenities, userRigClass, tripName, route, totalNights, totalMiles, campgroundsVisited, userIdea, boardName, userTravelStyle } = req.body;

    let prompt = '';
    let title = '';

    if (trigger === 'checkout') {
      title = `${campgroundName} — ${nightsStayed || 'a few'} nights, here's what I found`;
      prompt = `Write a community post draft for an RVer who just stayed at ${campgroundName} in ${campgroundState || 'the area'} for ${nightsStayed || 'a few'} nights in a ${userRigClass || 'RV'}. ${amenities?.length ? `Amenities: ${amenities.join(', ')}.` : ''} Write in first person as the user, not as Hitch. Include: overall impression, hookup/site quality, one tip for others, one thing to watch out for. Format with line breaks. Keep it genuine, 80-120 words. Leave [BRACKETS] for details the user should fill in.`;
    } else if (trigger === 'trip_complete') {
      title = `${route || tripName} in a ${userRigClass || 'RV'} — Trip Report`;
      prompt = `Write a community post draft for an RVer who just completed a road trip: ${route || tripName}, ${totalNights || 'several'} nights, ${totalMiles || 'many'} miles in a ${userRigClass || 'RV'}. ${campgroundsVisited?.length ? `Campgrounds: ${campgroundsVisited.join(', ')}.` : ''} Write in first person. Include: route highlights, rig-specific tips, one surprise moment, advice for others. 120-150 words. Leave [BRACKETS] for personal details.`;
    } else if (trigger === 'assist') {
      title = '';
      prompt = `You are helping an RVer write a community post. Their idea: '${userIdea}'. Board: ${boardName || 'General'}. Their rig: ${userRigClass || 'unknown'}. ${userTravelStyle?.length ? `Style: ${userTravelStyle.join(', ')}.` : ''} Write a well-formed post with a clear question or story. First person, genuine voice, 80-100 words. Include a specific question at the end to invite replies. Leave [BRACKETS] where personal details should be added. Return just the post body, no title.`;
    }

    const body = await callHaiku(prompt, 250);
    res.json({ title, body });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ GET /api/community/for-you ══
router.get('/for-you', optionalAuth, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    // Get recent posts from all boards (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const posts = await (prisma as any).boardPost.findMany({
      where: { createdAt: { gte: weekAgo } },
      include: {
        board: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (!userId) {
      // Not logged in — return most engaged posts
      const sorted = posts.sort((a: any, b: any) => (b._count?.comments || 0) - (a._count?.comments || 0));
      return res.json({ posts: sorted.slice(0, 5), personalized: false });
    }

    // Get user context for scoring
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        rvType: true, rvMake: true, rvModel: true, location: true,
        homeState: true, campingStyles: true, campingInterests: true,
        hasPets: true, petTypes: true, travelPartyType: true,
      },
    });
    const userState = user?.homeState || user?.location?.split(',').pop()?.trim() || '';
    const userRig = user?.rvType || '';
    const rigLabel = userRig ? userRig.replace(/_/g, ' ') : '';
    const rigMake = user?.rvMake?.toLowerCase() || '';
    const campingStyles = (user?.campingStyles || []).map((s: string) => s.toLowerCase());
    const campingInterests = (user?.campingInterests || []).map((s: string) => s.toLowerCase());
    const hasPets = user?.hasPets;
    const isSolo = user?.travelPartyType === 'SOLO';
    const isFamily = user?.travelPartyType === 'FAMILY';

    // Score posts — higher score = more relevant
    const scored = posts.map((post: any) => {
      let score = (post._count?.comments || 0) * 0.5; // base engagement
      const text = `${post.title} ${post.body}`.toLowerCase();
      let matchReason = '';

      // State match
      if (userState && text.includes(userState.toLowerCase())) {
        score += 5; matchReason = `Near ${userState}`;
      }

      // RV type match (Class A, Fifth Wheel, etc.)
      if (rigLabel && text.includes(rigLabel.toLowerCase())) {
        score += 4; matchReason = matchReason || `For ${rigLabel} owners`;
      }
      if (userRig === 'CLASS_A' && (text.includes('class a') || text.includes('motorhome') || text.includes('diesel pusher'))) {
        score += 3; matchReason = matchReason || 'For Class A owners';
      }
      if (userRig === 'FIFTH_WHEEL' && (text.includes('fifth wheel') || text.includes('5th wheel'))) {
        score += 3; matchReason = matchReason || 'For Fifth Wheel owners';
      }
      if (userRig === 'TRAVEL_TRAILER' && text.includes('travel trailer')) {
        score += 3; matchReason = matchReason || 'For Travel Trailer owners';
      }

      // RV make match
      if (rigMake && text.includes(rigMake)) {
        score += 4; matchReason = matchReason || `About ${user?.rvMake}`;
      }

      // Camping style matches (boondocking, full-time, weekend, etc.)
      for (const style of campingStyles) {
        if (text.includes(style)) { score += 3; matchReason = matchReason || `Matches your style: ${style}`; break; }
      }

      // Interest matches
      for (const interest of campingInterests) {
        if (text.includes(interest)) { score += 2; matchReason = matchReason || `Your interest: ${interest}`; break; }
      }

      // Pet match
      if (hasPets && (text.includes('pet') || text.includes('dog') || text.includes('cat'))) {
        score += 2; matchReason = matchReason || 'Pet-friendly discussion';
      }

      // Solo/family match
      if (isSolo && text.includes('solo')) { score += 2; matchReason = matchReason || 'Solo RVer topic'; }
      if (isFamily && (text.includes('family') || text.includes('kid'))) { score += 2; matchReason = matchReason || 'Family camping'; }

      // Boondocking / off-grid
      if (campingStyles.includes('boondocking') && (text.includes('boondock') || text.includes('dry camp') || text.includes('off grid') || text.includes('blm'))) {
        score += 3; matchReason = matchReason || 'Boondocking discussion';
      }

      return { ...post, _score: score, _matchReason: matchReason || `${post._count?.comments || 0} replies` };
    });

    scored.sort((a: any, b: any) => b._score - a._score);
    const limit = parseInt(req.query.limit as string) || 5;
    res.json({ posts: scored.slice(0, limit), personalized: true });
  } catch (e: any) { res.json({ posts: [], personalized: false }); }
});

// ══ GET /api/community/posts/:id/summary ══
router.get('/posts/:id/summary', async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;

    // Check cache
    const cached = await (prisma as any).communityPostSummary.findUnique({ where: { postId } }).catch(() => null);

    // Get comment count
    const commentCount = await (prisma as any).boardComment.count({ where: { postId } }).catch(() => 0);

    if (commentCount < 15) return res.json({ summary: null, reason: 'Not enough comments' });

    // Use cache if fresh (less than 10 new comments since generation)
    if (cached && (commentCount - cached.commentCount) < 10) {
      return res.json({ summary: cached.summary, commentCount: cached.commentCount, generatedAt: cached.generatedAt });
    }

    // Generate new summary
    const comments = await (prisma as any).boardComment.findMany({
      where: { postId },
      select: { content: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const commentText = comments.map((c: any) => c.content).join('\n---\n');
    const summary = await callHaiku(
      `Summarize this RV community discussion thread in 2-3 sentences. Focus on the consensus advice, key disagreements, and most useful tips shared. Write as a neutral summary, not as Hitch. Start with 'Campers generally...' or 'The thread covers...'\n\nComments:\n${commentText.slice(0, 3000)}`,
      120
    );

    // Upsert cache
    await (prisma as any).communityPostSummary.upsert({
      where: { postId },
      create: { postId, summary, commentCount },
      update: { summary, commentCount, generatedAt: new Date() },
    }).catch(() => {});

    res.json({ summary, commentCount, generatedAt: new Date() });
  } catch (e: any) { res.json({ summary: null }); }
});

export default router;

// ══ CRON FUNCTIONS (exported for registration) ══

export async function weeklyPromptCron() {
  try {
    console.log('[Community AI] Running weekly prompt...');

    // Find most active board
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const boards = await (prisma as any).board.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true } });

    let bestBoard = boards[0];
    let bestCount = 0;
    for (const board of boards) {
      const count = await (prisma as any).boardPost.count({ where: { boardId: board.id, createdAt: { gte: weekAgo } } });
      if (count > bestCount) { bestCount = count; bestBoard = board; }
    }

    if (!bestBoard) return;

    const season = getSeason();
    const question = await callHaiku(
      `You are Hitch, RVUnicorn's campfire host. Generate one engaging community discussion question for RV enthusiasts. Current season: ${season}. Make it specific, answerable from personal experience, and likely to generate debate or tips. Do not start with 'Hey' or 'Hi'. Under 30 words. No hashtags. Return only the question.`,
      60
    );

    // Get system user
    let systemUser = await prisma.user.findFirst({ where: { username: 'rvunicorn-system' } });
    if (!systemUser) return;

    // Post to board
    await (prisma as any).boardPost.create({
      data: {
        boardId: bestBoard.id,
        authorId: systemUser.id,
        title: question,
        body: `🔥 Hitch dropped this question for the community. What do you think?`,
        postType: 'DISCUSSION',
      },
    });

    console.log(`[Community AI] Posted weekly prompt to ${bestBoard.name}: "${question}"`);
  } catch (e: any) { console.error('[Community AI] Weekly prompt error:', e); }
}

export async function boardRevivalCron() {
  try {
    // Time-of-day guard: only post between 9AM-7PM CT (14:00-00:00 UTC)
    const hourUTC = new Date().getUTCHours();
    if (hourUTC < 14 || hourUTC >= 24) {
      console.log('[Community AI] Board revival skipped — outside peak hours (9AM-7PM CT)');
      return;
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
    const oneMonthAgo = new Date(Date.now() - 30 * 86400000);

    const boards = await (prisma as any).board.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true } });

    let systemUser = await prisma.user.findFirst({ where: { username: 'rvunicorn-system' } });
    if (!systemUser) return;

    for (const board of boards) {
      // Check if board is truly dead (60+ days no posts) — let it rest
      const anyRecentPost = await (prisma as any).boardPost.findFirst({ where: { boardId: board.id, createdAt: { gte: sixtyDaysAgo } } });
      if (!anyRecentPost) {
        console.log(`[Community AI] ${board.name} dead 60+ days — skipping, letting it rest`);
        continue;
      }

      // Check if dormant (no posts in 14 days)
      const recentPost = await (prisma as any).boardPost.findFirst({ where: { boardId: board.id, createdAt: { gte: fourteenDaysAgo } } });
      if (recentPost) continue;

      // Check if already revived this month (not this week)
      const recentRevival = await (prisma as any).boardRevival.findFirst({ where: { boardId: board.id, postedAt: { gte: oneMonthAgo } } });
      if (recentRevival) continue;

      // Generate revival prompt
      const question = await callHaiku(
        `You are Hitch, RVUnicorn's campfire host. The ${board.name} community board has been quiet for a couple weeks. Write a 1-2 sentence conversation starter question specific to this board's topic to get people talking again. Warm, curious tone. Under 25 words. Return only the question.`,
        50
      );

      await (prisma as any).boardPost.create({
        data: { boardId: board.id, authorId: systemUser.id, title: question, body: '', postType: 'DISCUSSION' },
      });

      await (prisma as any).boardRevival.create({ data: { boardId: board.id } });
      console.log(`[Community AI] Revived ${board.name}: "${question}"`);
    }
  } catch (e: any) { console.error('[Community AI] Board revival error:', e); }
}
