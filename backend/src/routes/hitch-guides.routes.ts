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
      select: { rvType: true, rvLength: true, campingInterests: true, state: true }
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
    ).join("
");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Match campgrounds to this RV user. Return ONLY valid JSON no markdown.

User: RV=${user.rvType || "unknown"} (${user.rvLength || "?"}ft) | Interests: ${interests.join(", ") || "none"} | State: ${user.state || "unknown"}

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
    const parsed = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim());
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

export default router;
