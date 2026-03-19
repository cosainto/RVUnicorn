import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Character persona definitions (mirrors frontend config) ───
const GUIDE_PERSONAS: Record<string, string> = {
  hitch: `You are Hitch 🦄, RVUnicorn\'s friendly and knowledgeable AI trail guide.
Personality: Warm, encouraging, balanced. Like the helpful neighbor at the campground who knows everything.
Voice: Conversational, optimistic, uses occasional camping lingo naturally. Emojis sparingly.`,

  walter: `You are Walter 🎭, RVUnicorn"s veteran camper and lovable curmudgeon.
Personality: You"ve camped everywhere, seen every disaster, and have opinions about ALL of it. Funny, a little grumpy, but genuinely helpful.
Voice: Dry humor, mock outrage, vivid stories. Always end with a useful takeaway despite the jokes.
Never mean-spirited toward people, only places/situations. No profanity.`,

  rose: `You are Rosé Merlot 🍷, RVUnicorn\'s glamping guru and lifestyle curator.
Personality: Sophisticated but fun. You believe camping should be beautiful AND comfortable.
Voice: Enthusiastic, a little extra, uses words like "divine" and "stunning." Always mention if there"s a winery or great restaurant nearby.`,

  scout: `You are Scout 🏔️, RVUnicorn"s adventure-first trailblazer.
Personality: High energy, loves the outdoors, always looking for the next trail or hidden gem.
Voice: Enthusiastic, direct, action-oriented. Gets excited about trails, wildlife, stargazing.
Always mention the best nearby trails, outdoor activities, and scenic highlights.`,

  diesel: `You are Diesel Dave 🚛, RVUnicorn\'s big rig expert and technical authority.
Personality: Straight-talking, no-nonsense, deeply knowledgeable about big rigs, towing, and campground access.
Voice: Direct, authoritative, practical. Uses specific technical terms (turning radius, amp service, pull-through).
ALWAYS lead with whether a campground can handle a big rig and what the access is like.`,

  holden_hannah: `You are Holden & Hannah 🏕️, RVUnicorn"s Junior Rangers — two adventurous kids who explore every campground like it"s the greatest place on Earth.
Personality: Enthusiastic, curious, fun-loving. You see campgrounds through a kid\'s eyes.
Voice: Energetic and playful. Use words like "SO cool" and "awesome." Kid-friendly language only.
Specialty: Playgrounds, swimming spots, kid activities, fishing, campfire games, family trails.
Always highlight playgrounds, pools, splash pads, and organized kids activities.`,

  luna: `You are Luna 🌙, RVUnicorn"s family camping and pet travel expert.
Personality: Warm, nurturing, organized. Cares about safety, kid-friendly activities, and pet policies.
Voice: Friendly and reassuring, practical. Always highlight if a campground has a playground, pool, or pet-friendly sites.`,
};

function getPersona(guideId: string): string {
  return GUIDE_PERSONAS[guideId] || GUIDE_PERSONAS.hitch;
}

// ─── GET /api/hitch/campground-secrets/:id ───────────────────
router.get('/campground-secrets/:campgroundId', async (req: any, res) => {
  try {
    const { campgroundId } = req.params;

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, name: true, city: true, state: true, maxRvLength: true, isBigRigFriendly: true },
    });
    if (!campground) return res.status(404).json({ error: 'Not found' });

    const reviews = await prisma.campgroundReview.findMany({
      where: { campgroundId },
      select: {
        rating: true, content: true,
        accessDifficulty: true, levelness: true, noise: true,
        cellService: true, bigRigFriendly: true, bestSiteNumber: true,
        wouldReturn: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []) as any[];

    if (reviews.length < 3) {
      return res.json({
        secrets: [],
        reviewCount: reviews.length,
        hasEnoughData: false,
        dataMessage: reviews.length === 0
          ? 'No Campground Reports yet — be the first!'
          : `Only ${reviews.length} report${reviews.length > 1 ? 's' : ''} so far. Need at least 3 to surface secrets.`,
      });
    }

    // Build structured summary for AI
    const structuredSummary = {
      totalReviews: reviews.length,
      accessDifficulty: countField(reviews, 'accessDifficulty'),
      levelness: countField(reviews, 'levelness'),
      noise: countField(reviews, 'noise'),
      cellService: countField(reviews, 'cellService'),
      bigRigFriendly: countField(reviews, 'bigRigFriendly'),
      wouldReturn: countField(reviews, 'wouldReturn'),
      bestSiteNumbers: reviews.map((r: any) => r.bestSiteNumber).filter(Boolean),
    };

    const reviewTexts = reviews
      .map((r: any) => r.content)
      .filter(Boolean)
      .slice(0, 15)
      .join(' | ');

    const prompt = `Extract campground insider secrets for ${campground.name} (${campground.city}, ${campground.state}).
Based on ${reviews.length} community Campground Reports.

Structured Data:
${JSON.stringify(structuredSummary, null, 2)}

Review excerpts: ${reviewTexts.substring(0, 600) || 'None'}

Return ONLY valid JSON:
{
  "secrets": [
    {
      "title": "Enter from the north side",
      "insight": "Campers consistently report the north entrance is much easier to navigate for big rigs — the south entrance has a sharp 90-degree turn.",
      "category": "access",
      "confidence": "high"
    }
  ]
}

category options: access, site, cell, timing, trail, tip
confidence: "high" if mentioned in 3+ reports or structured data clearly shows it, "medium" otherwise.
Generate 3-5 secrets. Only include secrets supported by real data patterns.
NEVER invent facts not supported by the data.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    res.json({
      secrets: parsed.secrets || [],
      reviewCount: reviews.length,
      hasEnoughData: true,
    });
  } catch (e: any) {
    console.error('Secrets error:', e?.message);
    res.status(500).json({ error: 'Failed to generate secrets' });
  }
});

// ─── GET /api/hitch/rig-stress/:id ───────────────────────────
router.get('/rig-stress/:campgroundId', async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const userId = req.user?.id;

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        id: true, name: true, city: true, state: true,
        maxRvLength: true, isBigRigFriendly: true, hasPullThrough: true,
        hasBackIn: true, maxAmpService: true,
        hasElectricHookup: true, hasWaterHookup: true, hasSewerHookup: true,
      },
    });
    if (!campground) return res.status(404).json({ error: 'Not found' });

    // Get community structured data
    const reviews = await prisma.campgroundReview.findMany({
      where: { campgroundId },
      select: { accessDifficulty: true, levelness: true, bigRigFriendly: true },
      take: 50,
    }).catch(() => []) as any[];

    const accessData = countField(reviews, 'accessDifficulty');
    const levelData = countField(reviews, 'levelness');
    const bigRigData = countField(reviews, 'bigRigFriendly');
    const dataSource = reviews.length >= 3 ? 'community' : 'ai';

    // Get user\'s rig if logged in
    let userRig: any = null;
    if (userId) {
      userRig = await prisma.user.findUnique({
        where: { id: userId },
        select: { rvType: true, rvLength: true, rvMake: true, rvModel: true },
      }).catch(() => null);
    }

    const prompt = `Calculate Rig Stress Score for ${campground.name} (${campground.city}, ${campground.state}).

Campground specs:
- Max RV Length: ${campground.maxRvLength || 'Unknown'}ft
- Big Rig Friendly: ${campground.isBigRigFriendly ?? 'Unknown'}
- Pull-through sites: ${campground.hasPullThrough ?? 'Unknown'}
- Back-in sites: ${campground.hasBackIn ?? 'Unknown'}
- Max amp service: ${campground.maxAmpService || 'Unknown'}ft
- Full hookups: Electric=${campground.hasElectricHookup}, Water=${campground.hasWaterHookup}, Sewer=${campground.hasSewerHookup}

Community reports (${reviews.length} total):
- Access difficulty votes: ${JSON.stringify(accessData)}
- Levelness votes: ${JSON.stringify(levelData)}
- Big rig friendly votes: ${JSON.stringify(bigRigData)}

    ${userRig ? `User's rig: ${userRig.rvYear || ''} ${userRig.rvMake || ''} ${userRig.rvType || 'RV'} (${userRig.rvLength || '?'}ft)` : 'User rig: unknown'}

Return ONLY valid JSON:
{
  "score": 3,
  "reason": "Moderate access — some tight turns on the entrance road reported by campers",
  "bigRigTips": [
    "Use the main entrance on Hwy 9, not the back road",
    "Pull-through sites available in Loop A — call ahead to reserve"
  ],
  "userRigNote": "Your 38ft Class A should fit, but call ahead to confirm pull-through availability",
  "factors": [
    { "label": "Max RV length", "impact": "positive", "detail": "Accepts up to 45ft" },
    { "label": "Access road", "impact": "negative", "detail": "Tight turn at entrance per 4 reports" },
    { "label": "Levelness", "impact": "neutral", "detail": "Mostly level per community" }
  ]
}

score: 1=Very Easy, 2=Easy, 3=Moderate, 4=Challenging, 5=Very Stressful
If user rig unknown, make userRigNote null.
Base score on available data; be conservative if data is sparse.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    res.json({ ...parsed, dataSource });
  } catch (e: any) {
    console.error('Rig stress error:', e?.message);
    res.status(500).json({ error: 'Failed to calculate stress score' });
  }
});

// ─── POST /api/hitch/campfire ─────────────────────────────────
router.post('/campfire', async (req: any, res) => {
  try {
    const { question, campgroundId, campgroundName } = req.body;

    // Get campground context
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        name: true, city: true, state: true, maxRvLength: true,
        isBigRigFriendly: true, hasPullThrough: true, isPetFriendly: true,
        hasElectricHookup: true, hasWaterHookup: true, hasPool: true,
        isWaterfront: true, pricePerNight: true, description: true,
      },
    }).catch(() => null);

    const reviews = await prisma.campgroundReview.findMany({
      where: { campgroundId },
      select: {
        rating: true, content: true,
        accessDifficulty: true, cellService: true, bigRigFriendly: true, noise: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []) as any[];

    const reviewSummary = reviews.slice(0, 6)
      .map((r: any) => `${r.rating}★: ${r.content?.substring(0, 80) || 'No comment'}`)
      .join('\n');

    const campgroundContext = campground
      ? `Campground: ${campground.name}, ${campground.city} ${campground.state}
Max RV Length: ${campground.maxRvLength || 'unknown'}ft
Big Rig: ${campground.isBigRigFriendly ?? 'unknown'} | Pull-through: ${campground.hasPullThrough ?? 'unknown'}
Pet Friendly: ${campground.isPetFriendly ?? 'unknown'} | Pool: ${campground.hasPool ?? 'unknown'}
Waterfront: ${campground.isWaterfront ?? 'unknown'} | Price: ${campground.pricePerNight ? '$' + campground.pricePerNight + '/night' : 'unknown'}
Description: ${campground.description?.substring(0, 200) || 'None'}
Reviews (${reviews.length}): ${reviewSummary || 'None yet'}`
      : `Campground: ${campgroundName} (limited data available)`;

    // Select relevant guides based on question content
    const questionLower = question.toLowerCase();
    let guides = ['hitch']; // always include Hitch
    if (questionLower.match(/big rig|rig|class a|fifth wheel|length|access|tight|turn|pull.through/))
      guides.push('diesel');
    if (questionLower.match(/family|kid|child|pet|dog|playground|pool/))
      guides.push('luna');
    if (questionLower.match(/hike|trail|adventure|boondock|outdoor|nature|wildlife/))
      guides.push('scout');
    if (questionLower.match(/wine|glamp|luxury|romantic|couple|vibe|scenic|beautiful/))
      guides.push('rose');
    if (!guides.includes('walter')) guides.push('walter'); // Walter always adds color
    guides = [...new Set(guides)].slice(0, 4); // max 4 guides

    // Generate each guide\'s response
    const discussion: { guideId: string; content: string }[] = [];

    for (const guideId of guides) {
      const persona = getPersona(guideId);
      const guidePrompt = `${persona}

You are one voice in a campfire discussion. Other guides will also weigh in.
Answer concisely (2-4 sentences). Speak in your character voice.
Stay factual — only reference the data below. Don"t invent specifics.

${campgroundContext}

Question: "${question}"

Respond as ${guideId} — 2-4 sentences, in character, grounded in the data above.`;

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          messages: [{ role: 'user', content: guidePrompt }],
        });
        const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
        if (content) discussion.push({ guideId, content });
      } catch {}
    }

    // Generate final takeaway (always Hitch, factual summary)
    const discussionText = discussion.map(d => `${d.guideId}: ${d.content}`).join('\n\n');
    const takeawayPrompt = `Based on this campfire discussion, write a clear 2-3 sentence factual takeaway for the user.
Be balanced, actionable, and honest. This is the most important part.

Question: "${question}"
Discussion:
${discussionText}

Write the takeaway now (2-3 sentences, no character voice, just clear guidance):`;

    const takeawayRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: takeawayPrompt }],
    });
    const takeaway = takeawayRes.content[0].type === 'text' ? takeawayRes.content[0].text.trim() : '';

    res.json({ discussion, takeaway, question });
  } catch (e: any) {
    console.error('Campfire error:', e?.message);
    res.status(500).json({ error: 'Failed to run campfire discussion' });
  }
});

// ─── GET /api/hitch/roast/:id ────────────────────────────────
router.get('/roast/:campgroundId', async (req: any, res) => {
  try {
    const { campgroundId } = req.params;

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true, city: true, state: true },
    });
    if (!campground) return res.status(404).json({ error: 'Not found' });

    const reviews = await prisma.campgroundReview.findMany({
      where: { campgroundId },
      select: {
        rating: true, content: true,
        accessDifficulty: true, noise: true, cellService: true,
        levelness: true, bigRigFriendly: true,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []) as any[];

    if (reviews.length < 3) {
      return res.json({
        hasEnoughData: false,
        roastLines: [],
        positiveCounterpoint: '',
        verdict: '',
        reviewCount: reviews.length,
      });
    }

    const avgRating = reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length;
    const reviewTexts = reviews.map((r: any) => `${r.rating}★: ${r.content || ''}`).filter((t: string) => t.length > 4).slice(0, 15).join('\n');
    const structuredData = {
      access: countField(reviews, 'accessDifficulty'),
      noise: countField(reviews, 'noise'),
      cell: countField(reviews, 'cellService'),
      levelness: countField(reviews, 'levelness'),
    };

    const prompt = `You are Walter 🎭 — a veteran RVer and lovable curmudgeon. Write a comedic-but-grounded campground roast.

Campground: ${campground.name}, ${campground.city} ${campground.state}
Avg rating: ${avgRating.toFixed(1)}/5 (${reviews.length} reviews)
Structured data: ${JSON.stringify(structuredData)}
Reviews: ${reviewTexts.substring(0, 800)}

Rules:
- Ground ALL jokes in actual review patterns. No invented complaints.
- Funny but never mean to people, never profane.
- Roast should feel like a friend who\'s been there, not a troll.
- Always include a genuine positive counterpoint.
- Verdict should be punchy and quotable.

Return ONLY valid JSON:
{
  "roastLines": [
    "The WiFi password is 'noservice' — and yes, they're being literal. 🎭",
    "Leveling your rig here is like trying to balance a pencil on your nose. Three blocks deep and still fighting gravity."
  ],
  "positiveCounterpoint": "That said, the lake views are genuinely stunning at sunrise, and the host family is some of the nicest people you"ll meet on the road.",
  "verdict": "Come for the views, leave with a story about your leveling jacks."
}

roastLines: 2-4 lines, each grounded in a real pattern from reviews.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    res.json({
      hasEnoughData: true,
      roastLines: parsed.roastLines || [],
      positiveCounterpoint: parsed.positiveCounterpoint || '',
      verdict: parsed.verdict || '',
      reviewCount: reviews.length,
    });
  } catch (e: any) {
    console.error('Roast error:', e?.message);
    res.status(500).json({ error: 'Failed to generate roast' });
  }
});

// ─── Helper ───────────────────────────────────────────────────
function countField(arr: any[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const val = item[field];
    if (val) counts[val] = (counts[val] || 0) + 1;
  }
  return counts;
}


router.get('/for-you', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Login required' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rvType: true, rvLength: true, campingInterests: true, homeState: true }
    });
    if (!user) return res.status(404).json({ error: 'Not found' });

    const missingFields: string[] = [];
    if (!user.rvType) missingFields.push('RV type');
    if (!user.rvLength) missingFields.push('RV length');
    if (!(user.campingInterests as string[] || []).length) missingFields.push('camping interests');

    const [wishlisted, checkedIn] = await Promise.all([
      prisma.campgroundWishlist.findMany({ where: { userId }, select: { campgroundId: true } }).catch(() => []),
      prisma.checkIn.findMany({ where: { userId }, select: { campgroundId: true } }).catch(() => []),
    ]);
    const excludeIds = [...wishlisted.map((w: any) => w.campgroundId), ...checkedIn.map((c: any) => c.campgroundId)].filter(Boolean);

    const rvLen = user.rvLength ? parseInt(String(user.rvLength)) : null;
    const interests = (user.campingInterests as string[] || []);
    const wantsPets = interests.some(i => ['pet','dog','cat'].some(k => i.toLowerCase().includes(k)));
    const wantsWaterfront = interests.some(i => ['waterfront','lake','ocean','river','fishing'].some(k => i.toLowerCase().includes(k)));

    const campgrounds = await prisma.campground.findMany({
      where: {
        id: { notIn: excludeIds.length > 0 ? excludeIds : ['__none__'] },
        ...(rvLen ? { OR: [{ maxRvLength: { gte: rvLen - 5 } }, { maxRvLength: null }] } : {}),
        ...(wantsPets ? { isPetFriendly: true } : {}),
        ...(wantsWaterfront ? { isWaterfront: true } : {}),
        googleRating: { gte: 3.8 },
      },
      select: {
        id: true, name: true, city: true, state: true, imageUrl: true,
        googleRating: true, pricePerNight: true, maxRvLength: true,
        isBigRigFriendly: true, hasPullThrough: true, isPetFriendly: true,
        isWaterfront: true, hasPool: true, hasWifi: true,
        hasElectricHookup: true, hasFullHookups: true,
      },
      orderBy: { googleRating: 'desc' },
      take: 30,
    });

    if (campgrounds.length === 0) return res.json({ matches: [], missingFields });

    const campList = campgrounds.slice(0, 15).map((c, i) =>
      `${i}. ${c.name}, ${c.city} ${c.state} | Rating: ${c.googleRating || "N/A"} | MaxRV: ${c.maxRvLength || "?"}ft | BigRig: ${c.isBigRigFriendly} | PullThrough: ${c.hasPullThrough} | Pet: ${c.isPetFriendly} | Waterfront: ${c.isWaterfront} | Pool: ${c.hasPool}`
    ).join("\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Match campgrounds to this RV user. Return ONLY valid JSON no markdown.

User: RV=${user.rvType || "unknown"} (${user.rvLength || "?"}ft) | Interests: ${interests.join(", ") || "none"} | State: ${user.homeState || "unknown"}

Campgrounds:
${campList}

{
  "matches": [
    {
      "index": 0,
      "matchScore": 92,
      "matchTier": "Perfect Match",
      "whyItFits": "Big rig friendly with pull-through sites for your Class A plus waterfront matching your fishing interests",
      "watchOut": "Books up fast in summer",
      "highlights": ["Pull-through", "Pet friendly", "Waterfront"]
    }
  ]
}

matchTier: "Perfect Match" (85-100%), "Great Fit" (65-84%), "Worth Checking Out" (45-64%)
Pick top 8. Be specific about why each fits THIS user. Reference their exact RV size and interests.`
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    let parsed: any = { matches: [] };
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      const jsonMatch = clean.match(/{[\s\S]*}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { matches: [] };
    } catch (parseErr: any) {
      console.error("For-you parse error:", parseErr.message, text.substring(0, 300));
      return res.json({ matches: [], missingFields });
    }
    const matches = (parsed.matches || [])
      .map((m: any) => { const c = campgrounds[m.index]; if (!c) return null; return { ...c, matchScore: m.matchScore, matchTier: m.matchTier, whyItFits: m.whyItFits, watchOut: m.watchOut || null, highlights: m.highlights || [] }; })
      .filter(Boolean)
      .sort((a: any, b: any) => b.matchScore - a.matchScore);

    res.json({ matches, missingFields });
  } catch (e: any) {
    console.error("For-you error:", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});


// GET /api/hitch/report-leaderboard
router.get('/report-leaderboard', async (req: any, res) => {
  try {
    const { campgroundId } = req.query;

    const grouped = await prisma.campgroundReview.groupBy({
      by: ['userId'],
      where: campgroundId ? { campgroundId: String(campgroundId) } : {},
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const userIds = grouped.map((g: any) => g.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, firstName: true, profilePicture: true },
    });

    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

    const leaders = grouped.map((g: any, i: number) => ({
      ...userMap[g.userId],
      userId: g.userId,
      reportCount: g._count.id,
      rank: i + 1,
    })).filter((l: any) => l.username);

    res.json({ leaders });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});


// GET /api/hitch/profile-summary/:username
router.get('/profile-summary/:username', async (req: any, res) => {
  try {
    const { username } = req.params;
    const tone = (req.query.tone as string) || 'campfire';
    const TONE_PROMPTS: Record<string, string> = {
      campfire:  "Write like a seasoned campfire storyteller — warm, vivid, poetic. Make it sound like a story told under the stars.",
      comedian:  "Write like a road trip comedian — funny, self-deprecating, full of wit. Think stand-up comedy meets camping.",
      adventure: "Write like an adventure seeker — bold, energetic, inspiring. Make it sound like the opening of an epic journey.",
      vineyard:  "Write like a sophisticated vineyard voyager — elegant but fun, mention good taste and the finer things on the road.",
      hophead:   "Write like an eternal hoptimist — craft beer lover, laid-back, always finding the local brewery. Pun-friendly.",
      nature:    "Write like a nature whisperer — contemplative, earthy, deeply connected to the outdoors and wildlife.",
    };
    const toneInstruction = TONE_PROMPTS[tone] || TONE_PROMPTS.campfire;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        firstName: true, homeState: true, campingInterests: true,
        rvType: true, rvLength: true, rvMake: true,
        createdAt: true,
        _count: { select: { checkIns: true, events: true, campgroundReviews: true } }
      }
    });

    if (!user) return res.status(404).json({ error: 'Not found' });

    const stateVisits = await prisma.stateVisit.findMany({
      where: { userId: (await prisma.user.findUnique({ where: { username }, select: { id: true } }))?.id || '' },
      select: { homeState: true },
    }).catch(() => []);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `${toneInstruction}
Write a 2-3 sentence bio for this RVUnicorn camper. Use ONLY their first name (not full name). Write in third person. Be specific and personal. Make it feel like a signature bio, not a summary.

Name: ${user.firstName}
Home: ${user.homeState || 'unknown'}
RV: ${user.rvType || 'unknown'} ${user.rvMake || ''} ${user.rvLength ? user.rvLength + 'ft' : ''}
Check-ins: ${user._count.checkIns}
Trips planned: ${user._count.events}
Campground reports: ${user._count.campgroundReviews}
States visited: ${stateVisits.map((s: any) => s.state).join(', ') || 'none yet'}
Camping interests: ${(user.campingInterests as string[] || []).join(', ') || 'not set yet'}
Member since: ${new Date(user.createdAt).getFullYear()}

Write the summary now (2-3 sentences, warm and celebratory, mention specific numbers):`,
      }],
    });

    const summary = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    res.json({ summary });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});


// POST /api/hitch/trip-copilot
router.post('/trip-copilot', async (req: any, res) => {
  try {
    const { origin, destination, campgroundId } = req.body;
    const userId = req.user?.id;

    let userRv: any = null;
    if (userId) {
      userRv = await prisma.user.findUnique({
        where: { id: userId },
        select: { rvType: true, rvLength: true, rvMake: true, rvFuelType: true }
      }).catch(() => null);
    }

    let campInfo = '';
    if (campgroundId) {
      const camp = await prisma.campground.findUnique({
        where: { id: campgroundId },
        select: { name: true, maxRvLength: true, isBigRigFriendly: true, hasPullThrough: true }
      }).catch(() => null);
      if (camp) {
        campInfo = `Destination campground: ${camp.name} | MaxRV: ${camp.maxRvLength || "unknown"}ft | BigRig: ${camp.isBigRigFriendly} | PullThrough: ${camp.hasPullThrough}`;
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `You are an RV trip co-pilot. Analyze this trip and return warnings/tips. Use web search to check current weather and road conditions.

Trip: ${origin} to ${destination}
RV: ${userRv?.rvType || 'unknown'} ${userRv?.rvMake || ''} (${userRv?.rvLength || '?'}ft, ${userRv?.rvFuelType || 'gas'})
${campInfo}
Today: ${new Date().toLocaleDateString()}

Search for current weather at the destination and any road conditions or closures.

Return ONLY valid JSON:
{
  "warnings": [
    {
      "type": "weather",
      "severity": "warning",
      "title": "Rain expected at destination",
      "detail": "70% chance of rain Friday-Saturday. Pack rain gear and consider checking site drainage."
    }
  ]
}

type options: rig, fuel, weather, tip
severity options: info, warning, danger
Generate 2-4 relevant warnings/tips. Include: rig compatibility warning if campground maxRV is close to user rig length, weather from web search, fuel stop suggestion, any relevant tips.`,
      }],
    });

    const textBlocks = response.content.filter((b: any) => b.type === 'text');
    const text = textBlocks.map((b: any) => b.text).join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    res.json({ warnings: parsed.warnings || [] });
  } catch (e: any) {
    console.error('Trip copilot error:', e?.message);
    res.json({ warnings: [] });
  }
});


// GET /api/hitch/site-prediction/:campgroundId
router.get('/site-prediction/:campgroundId', async (req: any, res) => {
  try {
    const { campgroundId } = req.params;
    const userId = req.user?.id;

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true, city: true, state: true, maxRvLength: true }
    });
    if (!campground) return res.status(404).json({ error: 'Not found' });

    let userRvLength = null;
    if (userId) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { rvLength: true } }).catch(() => null);
      userRvLength = u?.rvLength;
    }

    const reviews = await prisma.campgroundReview.findMany({
      where: { campgroundId },
      select: { content: true, bestSiteNumber: true, rating: true, accessDifficulty: true },
      take: 40,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []) as any[];

    const siteMentions = reviews.filter((r: any) => r.bestSiteNumber).map((r: any) => r.bestSiteNumber);
    const reviewTexts = reviews.map((r: any) => r.content).filter(Boolean).slice(0, 15).join(' | ');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Based on community reviews, predict the best campsites at ${campground.name}.

Camper recommended sites: ${siteMentions.join(', ') || 'none mentioned yet'}
User RV length: ${userRvLength || 'unknown'}ft
Review excerpts: ${reviewTexts.substring(0, 600) || 'No reviews yet'}

Return ONLY valid JSON:
{
  "siteNumbers": ["A12", "B7", "Loop C"],
  "reason": "Sites A12 and B7 are mentioned most by campers as having the best views and level pads",
  "tips": ["Call ahead to request a specific site", "Loop C sites have more shade"],
  "avoidSites": ["D1", "D2"],
  "avoidReason": "Near the dump station according to multiple reviews"
}

If not enough data, return empty arrays with a honest reason. Never invent site numbers not mentioned in reviews.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json(parsed);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});


// POST /api/hitch/trip-recap
router.post('/trip-recap', async (req: any, res) => {
  try {
    const { tripId, tripTitle, campgroundName, startDate, endDate, attendeeCount, checkInCount, photoCount, activities } = req.body;

    const nights = startDate && endDate
      ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
      : 1;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Write a fun, shareable social-media-ready trip recap for this RV camping trip. Use "We" voice. Be warm, specific, and capture the spirit of RV life. End with a teaser for the next adventure. Max 200 words.

Trip: ${tripTitle}
Location: ${campgroundName || 'a great campground'}
Duration: ${nights} night${nights !== 1 ? 's' : ''}
People: ${attendeeCount || 'a group'}
Check-ins: ${checkInCount || 0}
Photos: ${photoCount || 0}
Activities: ${(activities || []).join(', ') || 'camping and relaxing'}

Write the recap now:`,
      }],
    });

    const recap = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    res.json({ recap });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});


// POST /api/hitch/onboarding-chat
router.post('/onboarding-chat', async (req: any, res) => {
  try {
    const { message, history, step, collectedData } = req.body;
    const userId = req.user?.id;

    const steps = [
      { field: 'rvType',    question: 'What kind of RV?', nextQ: 'Great! And how long is your rig? (in feet, approximate is fine)' },
      { field: 'rvLength',  question: 'RV length?',       nextQ: 'Perfect. Where are you based out of? (just your home state is fine)' },
      { field: 'state',     question: 'Home state?',      nextQ: 'Almost done! What are your top 3 camping interests? (hiking, fishing, wine country, boondocking, family fun, beachside, etc.)' },
      { field: 'interests', question: 'Camping interests?', nextQ: null },
    ];

    const currentStep = Math.min(step || 0, steps.length - 1);
    const isLastStep = currentStep >= steps.length - 1;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: `You are Hitch, helping a new RVUnicorn member set up their profile through friendly conversation.
Current step: ${currentStep} of ${steps.length - 1}
Currently collecting: ${steps[currentStep]?.field}
Already collected: ${JSON.stringify(collectedData)}

Extract the user's answer from their message and respond warmly.
Next question to ask: ${steps[currentStep + 1] ? steps[currentStep + 1].question : 'none - wrap up warmly'}
If this is the last step, say something like "Perfect! Your profile is all set. Welcome to RVUnicorn!" and set complete=true.

Return ONLY valid JSON:
{
  "message": "your warm response + next question",
  "collectedData": { "${steps[currentStep]?.field}": "extracted value" },
  "step": ${currentStep + 1},
  "complete": ${isLastStep}
}`,
      messages: history.slice(-4).map((m: any) => ({ role: m.role, content: m.content })),
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    // Save collected data to user profile
    if (userId && parsed.collectedData) {
      const updates: any = {};
      if (parsed.collectedData.rvType) updates.rvType = parsed.collectedData.rvType;
      if (parsed.collectedData.rvLength) updates.rvLength = parseInt(String(parsed.collectedData.rvLength)) || null;
      if (parsed.collectedData.state) updates.state = parsed.collectedData.state;
      if (parsed.collectedData.interests) {
        const interests = Array.isArray(parsed.collectedData.interests)
          ? parsed.collectedData.interests
          : String(parsed.collectedData.interests).split(',').map((s: string) => s.trim());
        updates.campingInterests = interests;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({ where: { id: userId }, data: updates }).catch(() => null);
      }
    }

    res.json(parsed);
  } catch (e: any) {
    console.error('Onboarding error:', e?.message);
    res.status(500).json({ message: "Let us keep going! What were you saying?", step: step, complete: false });
  }
});


// POST /api/hitch/weekly-digest/:userId
// Call this from a cron job (e.g. Railway cron or external scheduler) every Monday
router.post('/weekly-digest/:userId', async (req: any, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true, email: true, homeState: true,
        campingInterests: true, rvType: true,
      }
    });
    if (!user || !user.email) return res.status(404).json({ error: 'No email' });

    // Get new campgrounds added this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newCampgrounds = await prisma.campground.findMany({
      where: { createdAt: { gte: oneWeekAgo } },
      select: { name: true, city: true, state: true, googleRating: true },
      take: 5,
      orderBy: { googleRating: 'desc' },
    });

    // Get upcoming trips from friends
    const following = await prisma.friendship.findMany({
      where: { senderId: userId, status: 'ACCEPTED' },
      select: { receiverId: true },
      take: 20,
    }).catch(() => []);
    const friendIds = following.map((f: any) => f.receiverId);

    const friendTrips = friendIds.length > 0 ? await prisma.event.findMany({
      where: { organizerId: { in: friendIds }, startDate: { gte: new Date() }, privacy: { not: 'PRIVATE' } },
      select: { title: true, startDate: true, campground: { select: { name: true } }, organizer: { select: { firstName: true } } },
      take: 3,
      orderBy: { startDate: 'asc' },
    }) : [];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Write a personalized weekly camping digest email for an RVUnicorn member. Warm, enthusiastic, brief. Sign off as Hitch.

Member: ${user.firstName}
RV: ${user.rvType || 'unknown'}
Interests: ${(user.campingInterests as string[] || []).join(', ') || 'general camping'}
Home state: ${user.homeState || 'unknown'}

New campgrounds added this week: ${newCampgrounds.map(c => `${c.name} in ${c.city}, ${c.state} (${c.googleRating || 'N/A'}★)`).join(', ') || 'none'}
Friends with upcoming trips: ${friendTrips.map((t: any) => `${t.organizer.firstName} is going to "${t.title}" at ${t.campground?.name || 'TBD'}`).join(', ') || 'none'}

Write a 3-paragraph email:
1. Personalized greeting mentioning something relevant to their interests
2. Highlight 1-2 new campgrounds or friend activity  
3. Tip or inspiration for their next trip
Sign off warmly as Hitch 🦄`,
      }],
    });

    const emailBody = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    // Send via Resend
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Hitch at RVUnicorn <hitch@updates.rvunicorn.com>',
      to: user.email,
      subject: `🦄 Your weekly camping digest, ${user.firstName}!`,
      text: emailBody,
      html: `<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #7c3aed, #db2777); padding: 20px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🦄 RVUnicorn Weekly</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Your personalized camping digest</p>
        </div>
        <div style="line-height: 1.8; color: #374151; font-size: 16px; white-space: pre-line;">${emailBody}</div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          <a href="https://www.rvunicorn.com" style="color: #7c3aed;">RVUnicorn</a> · 
          <a href="https://www.rvunicorn.com/settings" style="color: #9ca3af;">Unsubscribe</a>
        </div>
      </div>`,
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error('Weekly digest error FULL:', e?.message, e?.stack?.substring(0,300));
    res.status(500).json({ error: 'Failed', detail: e?.message });
  }
});


// POST /api/hitch/send-weekly-digests
// Called by Railway cron job every Monday at 8am
// Railway Cron setup: Add a cron job in Railway dashboard
//   Schedule: 0 8 * * 1  (every Monday 8am UTC)
//   Command: curl -X POST https://your-backend-url/api/hitch/send-weekly-digests -H "X-Cron-Secret: $CRON_SECRET"
router.post('/send-weekly-digests', async (req: any, res) => {
  try {
    // Verify cron secret to prevent unauthorized calls
    const cronSecret = req.headers['x-cron-secret'];
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all users with emails who have been active in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await prisma.user.findMany({
      where: {
        email: { not: '' },
        updatedAt: { gte: thirtyDaysAgo },
      },
      select: { id: true, email: true, firstName: true },
      take: 500, // process in batches
    });

    // Return immediately so cron-job.org doesn't timeout
    res.json({ queued: activeUsers.length, message: 'Processing in background' });

    // Process in background after response sent
    let sent = 0;
    let failed = 0;
    for (const user of activeUsers) {
      try {
        const backendUrl = process.env.BACKEND_URL || 'https://rvunicorn-production.up.railway.app';
        const res2 = await fetch(`${backendUrl}/api/hitch/weekly-digest/${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res2.ok) sent++;
        else failed++;
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch {
        failed++;
      }
    }
    console.log(`Weekly digest complete: ${sent} sent, ${failed} failed, ${activeUsers.length} total`);
  } catch (e: any) {
    console.error('Weekly digest cron error:', e?.message);
    res.status(500).json({ error: 'Failed' });
  }
});



// POST /api/hitch/road-support
router.post('/road-support', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { message, category, history = [] } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { rvType: true, rvLength: true, firstName: true },
    });

    const categoryContext: Record<string, string> = {
      fuel: 'You are helping an RV traveler find fuel (gas, diesel, propane). Recommend apps like GasBuddy, Trucker Path, iOverlander. Give practical tips for RV-specific fueling.',
      breakdown: 'You are helping an RV traveler who may be stranded or broken down. Prioritize safety first. Give calm, step-by-step guidance. Always mention calling roadside assistance if needed.',
      repair: 'You are an experienced RV mechanic helping with on-the-road repairs. Give clear, safe, step-by-step instructions. Always warn when a repair requires a professional.',
      emergency: 'You are providing emergency contact information for RV roadside assistance. Key numbers: Good Sam 1-800-847-2869, Coach-Net 1-800-863-3428, AAA 1-800-222-4357, FMCA 1-800-543-3622.',
    };

    const systemPrompt = `You are Hitch, RVUnicorn's Road & RV Support specialist. 
${categoryContext[category] || 'You help RV travelers with road and vehicle issues.'}
User's RV: ${user?.rvType || 'unknown'} (${user?.rvLength || '?'}ft)
Be concise, practical, and calm. Use bullet points for steps. Keep responses under 200 words.`;

    const historyMessages = history.map((m: any) => ({ role: m.role, content: m.content }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: message }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    res.json({ response: text });
  } catch (e: any) {
    console.error('Road support error:', e?.message);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
