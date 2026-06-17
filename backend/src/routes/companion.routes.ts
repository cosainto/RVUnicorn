import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = new PrismaClient() as any;
const anthropic = new Anthropic();

// Context cache (10 min TTL)
const contextCache = new Map<string, { data: any; expires: number }>();

const CHARACTERS = ['HITCH', 'WALLET', 'WALTER', 'SCOUT', 'HOLDEN', 'HANNAH'] as const;
const CHARACTER_IMAGES: Record<string, string> = {
  HITCH: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png',
  WALLET: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218458/rvunicorn/guides/wallet_guide.png',
  WALTER: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261024/rvunicorn/characters/walter.png',
  SCOUT: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261023/rvunicorn/characters/scout.png',
  HOLDEN: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1781042437/rvunicorn/characters/holden.jpg',
  HANNAH: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1781042437/rvunicorn/characters/hannah.jpg',
};

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function getSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

// ══ GET /api/chat/companion-context/:userId/:campgroundId ══
router.get('/companion-context/:userId/:campgroundId', authenticateToken, async (req: any, res: Response) => {
  try {
    const { userId, campgroundId } = req.params;
    const cacheKey = `${userId}:${campgroundId}`;

    // Check cache
    const cached = contextCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return res.json(cached.data);

    const [user, campground, activeCheckin] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, rvMake: true, rvModel: true, rvYear: true, rvType: true } }),
      prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true, location: true, city: true, state: true, amenities: true } }),
      prisma.checkIn.findFirst({ where: { userId, campgroundId, isActive: true }, select: { checkInDate: true, checkOutDate: true } }),
    ]);

    // Get active trip if any
    let tripName = null;
    try {
      const attendee = await prisma.eventAttendee.findFirst({ where: { userId, status: 'ATTENDING' }, include: { event: { select: { title: true } } }, orderBy: { createdAt: 'desc' } });
      if (attendee?.event) tripName = attendee.event.title;
    } catch {}

    const context = {
      displayName: user?.firstName || 'friend',
      rvNickname: null as string | null, // RVShowcase title
      rvYear: user?.rvYear || null,
      rvMake: user?.rvMake || null,
      rvModel: user?.rvModel || null,
      rvType: user?.rvType || null,
      campgroundName: campground?.name || 'this campground',
      campgroundCity: campground?.city || campground?.location || '',
      campgroundState: campground?.state || '',
      campgroundType: null,
      timeOfDay: getTimeOfDay(),
      season: getSeason(),
      weatherDescription: null,
      tripName,
      checkInDate: activeCheckin?.checkInDate?.toISOString() || null,
      checkOutDate: activeCheckin?.checkOutDate?.toISOString() || null,
      nearbyAttractions: null,
      campgroundRules: null as string | null,
    };

    // Get campground rules
    try {
      const rules = await (prisma as any).campgroundRules.findUnique({ where: { campgroundId } });
      if (rules) {
        const rulesParts: string[] = [];
        if (rules.checkInTime) rulesParts.push(`Check-in: ${rules.checkInTime}`);
        if (rules.checkOutTime) rulesParts.push(`Check-out: ${rules.checkOutTime}`);
        if (rules.quietHoursStart) rulesParts.push(`Quiet hours: ${rules.quietHoursStart}-${rules.quietHoursEnd || 'morning'}`);
        if (rules.petPolicy) rulesParts.push(`Pets: ${rules.petPolicy}`);
        if (rules.firePolicy) rulesParts.push(`Fires: ${rules.firePolicy}`);
        if (rules.generatorHours) rulesParts.push(`Generators: ${rules.generatorHours}`);
        if (rules.speedLimit) rulesParts.push(`Speed limit: ${rules.speedLimit}`);
        if (rules.maxVehicles) rulesParts.push(`Max vehicles: ${rules.maxVehicles}`);
        if (rules.additionalRules?.length) rulesParts.push(...rules.additionalRules.slice(0, 3));
        context.campgroundRules = rulesParts.join('. ');
      }
    } catch {}

    // Get active jobs at this campground
    try {
      const activeJob = await prisma.jobPosting.findFirst({ where: { campgroundId, isActive: true }, select: { title: true, jobType: true, siteIncluded: true, compensation: true } });
      if (activeJob) {
        (context as any).activeJob = `${activeJob.title} (${activeJob.jobType}${activeJob.siteIncluded ? ', site included' : ''}${activeJob.compensation ? `, ${activeJob.compensation}` : ''})`;
      }
    } catch {}

    // Try to get RV nickname
    try {
      const showcase = await prisma.rVShowcase.findUnique({ where: { userId }, select: { title: true } });
      if (showcase?.title) context.rvNickname = showcase.title;
    } catch {}

    contextCache.set(cacheKey, { data: context, expires: Date.now() + 10 * 60 * 1000 });
    res.json(context);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/chat/companion-opener ══
router.post('/companion-opener', authenticateToken, async (req: any, res: Response) => {
  try {
    const { userId, campgroundId, character } = req.body;

    // Check if companions enabled
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { campfireCompanionsEnabled: true } });
    if (!user?.campfireCompanionsEnabled) return res.json({ enabled: false });

    // Fetch context
    const ctxRes = await fetch(`${req.protocol}://${req.get('host')}/api/chat/companion-context/${userId}/${campgroundId}`, { headers: { Authorization: req.headers.authorization } });
    const ctx: any = await ctxRes.json();

    const prompts: Record<string, string> = {
      HITCH: `You are Hitch, a warm experienced RV traveler. Write ONE opening message (max 2 sentences) for someone who just entered a quiet campground chat at ${ctx.campgroundName} in ${ctx.campgroundState}. It is ${ctx.timeOfDay} in ${ctx.season}. The user's RV nickname is ${ctx.rvNickname || 'unknown'}. Rules: Calm, warm, understated. Reference the campground or setting naturally if it fits. Optional: end with a light question — but only if it feels completely natural. Do NOT offer help. Do NOT say 'I'm here if you need me'. Sound like a fellow camper, not a guide. Return only the message.`,
      WALLET: `You are Wallet, a funny self-aware deal-hunter who loves RV life. Write ONE opening message (max 2 sentences) for someone in a quiet chat at ${ctx.campgroundName}. It is ${ctx.timeOfDay}. Rules: Lightly funny, not trying too hard. Can reference the campground, season, or RV life. Optional: one casual question if natural. Do NOT pitch deals in the opener. Sound like a campsite neighbor. Return only the message.`,
      WALTER: `You are Walter, a gentle astronomy and nature enthusiast. Write ONE opening message (max 2 sentences) for someone in a quiet chat at ${ctx.campgroundName} in ${ctx.campgroundState}. It is ${ctx.timeOfDay} in ${ctx.season}. Rules: Quiet, observational, slightly wonder-struck. Reference the sky, nature, or season if natural. Optional: one gentle question. Do NOT lecture. Sound like someone sitting by a fire looking up. Return only the message.`,
      SCOUT: `You are Scout, an outdoorsy adventure lover. Write ONE opening message (max 2 sentences) for someone in a quiet chat at ${ctx.campgroundName}. It is ${ctx.timeOfDay} in ${ctx.season}. Rules: Energetic but not overwhelming. Can reference activities or trails near the campground. Optional: one casual question. Do NOT use 'epic' or 'crushing it'. Sound like a fellow camper who just got back from a trail. Return only the message.`,
      HOLDEN: `You are Holden, one of RVUnicorn's Junior Rangers — a fun adventurous kid at ${ctx.campgroundName}. It is ${ctx.timeOfDay} in ${ctx.season}. Write ONE opening message (max 2 sentences) about something exciting kids can do at the campground. Rules: Sound like an excited 10-year-old who loves outdoor activities, sports, and electronics/gadgets. Mention playgrounds, scavenger hunts, fishing, wildlife, outdoor games, or cool tech. Family-friendly. Return only the message.`,
      HANNAH: `You are Hannah, one of RVUnicorn's Junior Rangers — a fun cheerful encouraging 9-year-old at ${ctx.campgroundName}. It is ${ctx.timeOfDay} in ${ctx.season}. Write ONE opening message (max 2 sentences) suggesting something fun for families. Rules: Sound like a bright, warm 9-year-old who loves art and nature. A bit of a tattle-tale but only because she wants everyone to do the right thing. Mention family activities, art, nature, nearby attractions, or events. Family-friendly. Return only the message.`,
    };

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompts[character] || prompts.HITCH }],
    });

    const message = (response.content[0] as any)?.text?.trim() || '';

    // Create session
    await prisma.companionSession.create({
      data: { userId, campgroundId, character, messageCount: 1 },
    });

    res.json({ character, message, image: CHARACTER_IMAGES[character], enabled: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/chat/companion-reply ══
router.post('/companion-reply', authenticateToken, async (req: any, res: Response) => {
  try {
    const { userId, campgroundId, character, conversationHistory, userMessage } = req.body;

    const ctxRes = await fetch(`${req.protocol}://${req.get('host')}/api/chat/companion-context/${userId}/${campgroundId}`, { headers: { Authorization: req.headers.authorization } });
    const ctx: any = await ctxRes.json();

    const systemPrompts: Record<string, string> = {
      HITCH: `You are Hitch, a warm experienced RV traveler chatting with ${ctx.displayName} in a campground chat at ${ctx.campgroundName}. Context: Their RV: ${ctx.rvYear || ''} ${ctx.rvMake || ''} ${ctx.rvModel || ''} '${ctx.rvNickname || ''}'. Time: ${ctx.timeOfDay}, Season: ${ctx.season}. Weather: ${ctx.weatherDescription || 'unknown'}.${ctx.campgroundRules ? ` Campground rules: ${ctx.campgroundRules}.` : ''}${(ctx as any).activeJob ? ` Active job here: ${(ctx as any).activeJob}.` : ''} Rules for you: Max 2-3 sentences. MAX ONE question per reply. React to what they said first. If user asks about jobs, work, workamping, camp host, or earning money, mention the active job if one exists. Reference campground rules ONLY when asked. Sound like a fellow camper around a fire.`,
      WALLET: `You are Wallet, a funny self-aware deal-hunter chatting with ${ctx.displayName} at ${ctx.campgroundName}. Context: ${ctx.timeOfDay}, ${ctx.season}, RV: ${ctx.rvType || 'unknown'}.${ctx.campgroundRules ? ` Campground rules: ${ctx.campgroundRules}.` : ''} Rules for you: Max 2-3 sentences. ONE question max. Be genuinely funny. React to what they said. Reference campground rules only when asked. Sound like a campsite neighbor.`,
      WALTER: `You are Walter, a gentle nature and astronomy enthusiast chatting with ${ctx.displayName} at ${ctx.campgroundName} in ${ctx.campgroundState}. Context: ${ctx.timeOfDay}, ${ctx.season}, ${ctx.weatherDescription || ''}.${ctx.campgroundRules ? ` Campground rules: ${ctx.campgroundRules}.` : ''} Rules for you: Max 2-3 sentences. ONE question max. Reference nature or sky when it fits. Know the campground rules if asked. Sound like someone sitting by a fire.`,
      SCOUT: `You are Scout, an adventure lover chatting with ${ctx.displayName} at ${ctx.campgroundName}. Context: ${ctx.timeOfDay}, ${ctx.season}.${ctx.campgroundRules ? ` Campground rules: ${ctx.campgroundRules}.` : ''} Rules for you: Max 2-3 sentences. ONE question max. Match their energy. Know campground rules if asked. Sound like a fellow camper.`,
      HOLDEN: `You are Holden, one of RVUnicorn's Junior Rangers — a fun adventurous kid chatting with ${ctx.displayName} at ${ctx.campgroundName}. Context: ${ctx.timeOfDay}, ${ctx.season}.${ctx.campgroundRules ? ` Campground rules: ${ctx.campgroundRules}.` : ''} Rules for you: Max 2-3 sentences. Sound like an excited 10-year-old who loves outdoor adventures, sports, and electronics/gadgets. Focus on scavenger hunts, fishing, wildlife, playground fun, games, and cool tech. Family-friendly only.`,
      HANNAH: `You are Hannah, one of RVUnicorn's Junior Rangers — a fun cheerful encouraging 9-year-old chatting with ${ctx.displayName} at ${ctx.campgroundName}. Context: ${ctx.timeOfDay}, ${ctx.season}.${ctx.campgroundRules ? ` Campground rules: ${ctx.campgroundRules}.` : ''} Rules for you: Max 2-3 sentences. Sound like a bright, warm 9-year-old who loves art and nature. A bit of a tattle-tale but only because she wants everyone to do the right thing and have a good time. Focus on art, nature, family activities, events, and nearby attractions. Family-friendly only.`,
    };

    const messages = (conversationHistory || []).slice(-10).map((m: any) => ({ role: m.role, content: m.content }));
    messages.push({ role: 'user', content: userMessage });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      temperature: 0.8,
      system: systemPrompts[character] || systemPrompts.HITCH,
      messages,
    });

    const reply = (response.content[0] as any)?.text?.trim() || '';

    // Update session message count
    await prisma.companionSession.updateMany({
      where: { userId, campgroundId, character },
      data: { messageCount: { increment: 1 } },
    }).catch(() => {});

    // Fire and forget: extract insight
    extractInsight(userId, campgroundId, userMessage).catch(() => {});

    res.json({ character, message: reply, image: CHARACTER_IMAGES[character] });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ Insight extraction (fire and forget) ══
async function extractInsight(userId: string, campgroundId: string, userMessage: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{ role: 'user', content: `Extract from this camping chat message. Return JSON only, no other text, null for anything not clearly present:\n{"sentiment":"positive"|"neutral"|"negative"|null,"mentionedIssue":string|null,"mentionedHighlight":string|null}\nMessage: ${userMessage}` }],
    });
    const text = (response.content[0] as any)?.text?.trim() || '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    const inserts: { campgroundId: string; userId: string; insightType: string; value: string }[] = [];
    if (parsed.sentiment) inserts.push({ campgroundId, userId, insightType: 'sentiment', value: parsed.sentiment });
    if (parsed.mentionedIssue) inserts.push({ campgroundId, userId, insightType: 'issue', value: parsed.mentionedIssue });
    if (parsed.mentionedHighlight) inserts.push({ campgroundId, userId, insightType: 'highlight', value: parsed.mentionedHighlight });

    for (const ins of inserts) {
      await prisma.campgroundInsight.create({ data: { ...ins, source: 'COMPANION_CHAT' } });
    }
  } catch {}
}

// ══ POST /api/chat/extract-insight (explicit endpoint) ══
router.post('/extract-insight', authenticateToken, async (req: any, res: Response) => {
  const { userId, campgroundId, userMessage } = req.body;
  extractInsight(userId, campgroundId, userMessage).catch(() => {});
  res.json({ queued: true }); // Always return immediately
});

// ══ GET /api/chat/companion-settings ══
router.get('/companion-settings', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { campfireCompanionsEnabled: true } });
    res.json({ enabled: user?.campfireCompanionsEnabled ?? true });
  } catch { res.json({ enabled: true }); }
});

// ══ PUT /api/chat/companion-settings ══
router.put('/companion-settings', authenticateToken, async (req: any, res: Response) => {
  try {
    const { enabled } = req.body;
    await prisma.user.update({ where: { id: req.userId }, data: { campfireCompanionsEnabled: !!enabled } });
    res.json({ enabled: !!enabled });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
