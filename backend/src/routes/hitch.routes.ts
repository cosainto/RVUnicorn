import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
import { prisma } from '../lib/prisma';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const authenticateToken = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    (req as any).userId = decoded.userId;
    next();
  });
};

async function buildSystemPrompt(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true, lastName: true, location: true,
      rvMake: true, rvModel: true, rvType: true, rvYear: true,
      rvLength: true, rvHeight: true, rvWeight: true, rvSleeps: true,
      rvSlideouts: true, rvMpg: true, rvTankGallons: true,
      rvDescription: true, rvFeatures: true, hitchPreferences: true,
      currentCampsite: true, bio: true,
      onboardingCamperType: true, onboardingRigType: true, onboardingRegion: true,
      campingInterests: true, homeState: true,
    },
  });

  const recentTrips = await prisma.trip.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5, select: { name: true, destination: true } }).catch(() => []);
  const visitedStates = await prisma.stateVisit.findMany({ where: { userId }, select: { state: true } }).catch(() => []);
  const wishlist = await prisma.campgroundWishlist.findMany({ where: { userId }, include: { campground: { select: { name: true, location: true } } }, take: 10 }).catch(() => []);
  const recentConvos = await prisma.hitchConversation.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 5, select: { title: true, summary: true, updatedAt: true } }).catch(() => []);

  let rvProfile = '';
  if (user?.rvMake || user?.rvModel || user?.rvType) {
    rvProfile = `\n## ${user.firstName}'s RV Profile\n`;
    if (user.rvYear) rvProfile += `- Year: ${user.rvYear}\n`;
    if (user.rvMake) rvProfile += `- Make: ${user.rvMake}\n`;
    if (user.rvModel) rvProfile += `- Model: ${user.rvModel}\n`;
    if (user.rvType) rvProfile += `- Type: ${user.rvType}\n`;
    if (user.rvLength) rvProfile += `- Length: ${user.rvLength} ft\n`;
    if (user.rvHeight) rvProfile += `- Height: ${user.rvHeight} inches\n`;
    if (user.rvWeight) rvProfile += `- Weight: ${user.rvWeight} lbs\n`;
    if (user.rvSleeps) rvProfile += `- Sleeps: ${user.rvSleeps}\n`;
    if (user.rvSlideouts) rvProfile += `- Slideouts: ${user.rvSlideouts}\n`;
    if (user.rvMpg) rvProfile += `- MPG: ${user.rvMpg}\n`;
    if (user.rvTankGallons) rvProfile += `- Tank: ${user.rvTankGallons} gallons\n`;
    if (user.rvFeatures?.length) rvProfile += `- Features: ${user.rvFeatures.join(', ')}\n`;
  }

  let sections = '';
  if (recentTrips.length > 0) sections += `\n## Recent Trips\n${recentTrips.map((t: any) => `- ${t.name}`).join('\n')}\n`;
  if (visitedStates.length > 0) sections += `\n## States Visited: ${visitedStates.map((s: any) => s.state).join(', ')}\n`;
  if (wishlist.length > 0) sections += `\n## Wishlist\n${wishlist.map((w: any) => `- ${w.campground?.name || 'Unknown'}`).join('\n')}\n`;
  if (user?.hitchPreferences?.length) sections += `\n## Learned Preferences\n${user.hitchPreferences.map((p: any) => `- ${p}`).join('\n')}\n`;
  if (recentConvos.length > 0) sections += `\n## Recent Conversations\n${recentConvos.map((c: any) => `- ${c.title || 'Chat'}${c.summary ? `: ${c.summary}` : ''}`).join('\n')}\n`;

  return `You are Hitch \u{1f984}, the friendly AI trail guide for RVUnicorn.

## Personality
- Warm, knowledgeable, like a seasoned RV neighbor
- Concise and helpful. Use emojis sparingly.

## You Can Help With
- Campground recommendations, trip planning, recipes, RV advice, events, community

## About the User
- Name: ${user?.firstName || 'Camper'} ${user?.lastName || ''}
- Location: ${user?.location || user?.homeState || 'Not specified'}
- Current Campsite: ${user?.currentCampsite || 'Not checked in'}
${user?.onboardingCamperType ? `- Camper Style: ${user.onboardingCamperType.replace(/_/g, ' ')}` : ''}
${user?.onboardingRigType ? `- Rig Type: ${user.onboardingRigType.replace(/_/g, ' ')}` : ''}
${user?.onboardingRegion ? `- Favorite Region: ${user.onboardingRegion}` : ''}
${user?.campingInterests?.length ? `- Camping Interests: ${user.campingInterests.join(', ')}` : ''}
${rvProfile}${sections}

## Personalization
Use the user's camper style to tailor your tone and advice:
- "weekend warrior": They camp on weekends — suggest nearby getaways, quick trip ideas, and time-saving tips.
- "full timer": They live on the road — talk like a fellow traveler, discuss long-term stays, mail forwarding, seasonal moves.
- "occasional": Keep it simple and encouraging. Don't assume deep knowledge.
- "first big trip" or "first trip ever": Be extra welcoming and supportive. Offer beginner-friendly tips without being condescending. Celebrate their excitement.
Reference their preferred region naturally when suggesting destinations. If they haven't filled in RV details yet, gently ask about their rig to give better advice — but don't nag.

## Update Instructions
When the user provides info to update (site number, bio, RV details, social URLs, etc.), include this format in your response:
[UPDATE:entityType:entityId:field:value]

Supported:
- [UPDATE:STAY:stayId:siteNumber:42B]
- [UPDATE:TRIP:tripId:description:Weekend getaway]
- [UPDATE:EVENT:eventId:location:Yellowstone]
- [UPDATE:USER:CURRENT_USER:bio:RV enthusiast]
- [UPDATE:USER:CURRENT_USER:rvMake:Thor] [UPDATE:USER:CURRENT_USER:rvModel:Ace] [UPDATE:USER:CURRENT_USER:rvType:Class A] [UPDATE:USER:CURRENT_USER:rvLength:32] [UPDATE:USER:CURRENT_USER:rvYear:2022]
- [UPDATE:USER:CURRENT_USER:instagramUrl:https://instagram.com/user] [UPDATE:USER:CURRENT_USER:youtubeUrl:...] [UPDATE:USER:CURRENT_USER:tiktokUrl:...] [UPDATE:USER:CURRENT_USER:facebookUrl:...] [UPDATE:USER:CURRENT_USER:twitterUrl:...]
- [UPDATE:USER:CURRENT_USER:isCreator:true]
- [UPDATE:MAINTENANCE:CURRENT_USER:newRecord:{"title":"Oil Change","category":"Engine","cost":"89.99","mileage":"45000","serviceDate":"2025-01-15"}]
- [UPDATE:CAMPGROUND:campgroundId:wishlist:add]

Always confirm updates naturally. Multiple updates per response OK.
When user says "stop asking about this", tell them to click "Don't ask again" on the reminder card.`;
}

async function searchCampgrounds(query: string, rvLen?: number | null) {
  const s = query.toLowerCase();
  const stateMatch = s.match(/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i);
  const w: any = {};
  if (stateMatch) w.state = { contains: stateMatch[1], mode: 'insensitive' };
  if (s.includes('full hookup')) w.hasFullHookups = true;
  if (s.includes('wifi')) w.hasWifi = true;
  if (s.includes('pet') || s.includes('dog')) w.isPetFriendly = true;
  if (s.includes('waterfront') || s.includes('lake') || s.includes('beach')) w.isWaterfront = true;
  if (s.includes('big rig')) w.isBigRigFriendly = true;
  if (s.includes('pull through') || s.includes('pull-through')) w.hasPullThrough = true;
  if (s.includes('pool')) w.hasPool = true;
  if (rvLen && rvLen > 30) w.OR = [{ maxRvLength: { gte: rvLen } }, { maxRvLength: null }];

  return prisma.campground.findMany({
    where: w, take: 10, orderBy: [{ googleRating: 'desc' }],
    select: { id:true,name:true,location:true,state:true,description:true,hasFullHookups:true,hasElectricHookup:true,hasWaterHookup:true,hasSewerHookup:true,hasWifi:true,hasPool:true,hasShowers:true,hasPullThrough:true,isPetFriendly:true,isBigRigFriendly:true,isWaterfront:true,maxRvLength:true,maxAmpService:true,pricePerNight:true,googleRating:true,seasonStart:true,seasonEnd:true },
  });
}

async function extractPreferences(userId: string, messages: { role: string; content: string }[]) {
  try {
    if (messages.length < 4) return;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { hitchPreferences: true } });
    const existing = user?.hitchPreferences || [];
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 500,
      system: `Extract camping/RV preferences as a JSON array of short strings. Existing (don't duplicate): ${JSON.stringify(existing)}. Return ONLY [] or ["pref1","pref2"]. No other text.`,
      messages: [{ role: 'user', content: messages.map(m => `${m.role}: ${m.content}`).join('\n\n') }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '[]';
    const newPrefs = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (Array.isArray(newPrefs) && newPrefs.length > 0) {
      await prisma.user.update({ where: { id: userId }, data: { hitchPreferences: [...existing, ...newPrefs].slice(-30) } });
    }
  } catch {}
}

async function summarizeConversation(messages: { role: string; content: string }[]) {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 200,
      system: 'Generate a short title (max 6 words) and brief summary (max 2 sentences). Return ONLY valid JSON: {"title":"...","summary":"..."}',
      messages: [{ role: 'user', content: messages.map(m => `${m.role}: ${m.content}`).join('\n') }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch { return { title: 'Chat with Hitch', summary: '' }; }
}

router.post('/chat', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { messages, conversationId } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Messages required' });

    const systemPrompt = await buildSystemPrompt(userId);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { rvLength: true } });
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const isCampQ = /campground|campsite|camp|rv park|where.*stay|recommend.*park|hookup|boondock/i.test(lastMsg);

    let campCtx = '';
    if (isCampQ) {
      const camps = await searchCampgrounds(lastMsg, user?.rvLength);
      if (camps.length > 0) {
        campCtx = '\n\n## Campgrounds from Database\n' + camps.map((c: any, i: any) => {
          let d = `${i+1}. **${c.name}** - ${c.location}${c.state?`, ${c.state}`:''}`;
          if (c.googleRating) d += ` | ${c.googleRating}/5`;
          if (c.pricePerNight) d += ` | $${c.pricePerNight}/night`;
          if (c.maxRvLength) d += ` | Max ${c.maxRvLength}ft`;
          const a = [];
          if (c.hasFullHookups) a.push('Full Hookups');
          if (c.hasWifi) a.push('WiFi');
          if (c.isPetFriendly) a.push('Pet-Friendly');
          if (c.isWaterfront) a.push('Waterfront');
          if (c.hasPullThrough) a.push('Pull-Through');
          if (a.length) d += `\n   Amenities: ${a.join(', ')}`;
          d += `\n   Link: /campgrounds/${c.id}`;
          return d;
        }).join('\n\n');
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      system: systemPrompt + campCtx,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    let fullResponse = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    const allMsgs = [...messages, { role: 'assistant', content: fullResponse }];
    setImmediate(async () => {
      try {
        let cid = conversationId;
        if (!cid) {
          const c = await prisma.hitchConversation.create({ data: { userId } });
          cid = c.id;
          res.write(`data: ${JSON.stringify({ conversationId: cid })}\n\n`);
        }
        const lastUser = messages[messages.length - 1];
        await prisma.hitchMessage.createMany({ data: [
          { conversationId: cid, role: 'user', content: lastUser.content },
          { conversationId: cid, role: 'assistant', content: fullResponse },
        ]});
        if (allMsgs.length >= 6) await extractPreferences(userId, allMsgs);
        if (allMsgs.length >= 4) {
          const { title, summary } = await summarizeConversation(allMsgs);
          await prisma.hitchConversation.update({ where: { id: cid }, data: { title, summary } });
        }
      } catch (e: any) { console.error('Save error:', e); }
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Hitch error:', error);
    if (res.headersSent) { res.write(`data: ${JSON.stringify({ error: 'Error' })}\n\n`); res.end(); }
    else res.status(500).json({ error: 'Failed' });
  }
});

router.get('/starters', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName:true,rvType:true,location:true,hitchPreferences:true } });
    const starters = ['\u{1f3d5}\ufe0f Find me a campground this weekend','\u{1f5fa}\ufe0f Help me plan a road trip','\u{1f373} Suggest a camping recipe','\u{1f527} RV maintenance tips'];
    if (user?.location) starters.unshift(`\u{1f4cd} Best campgrounds near ${user.location}`);
    if (user?.hitchPreferences?.length) starters.push('\u{1f9e0} What do you remember about me?');
    res.json({ starters: starters.slice(0, 6) });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const conversations = await prisma.hitchConversation.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 20, select: { id:true,title:true,summary:true,createdAt:true,updatedAt:true } });
    res.json({ conversations });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/conversation/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const conv = await prisma.hitchConversation.findFirst({ where: { id: req.params.id, userId }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!conv) return res.status(404).json({ error: 'Not found' });
    res.json({ conversation: conv });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/preferences', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: (req as any).userId }, select: { hitchPreferences: true } });
    res.json({ preferences: user?.hitchPreferences || [] });
  } catch { res.status(500).json({ error: 'Failed' }); }
});


router.post('/drive-debrief', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      grade = 'B',
      driveHours = 0,
      stopMins = 0,
      breakCount = 0,
      longestStretchHours = 0,
      fatigueScore = 0,
      alertnessChecks = [],
      timeOfDay = '',
    } = req.body;

    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });
    const name = user?.firstName || 'driver';

    const gradeDescriptions: Record<string, string> = {
      A: 'outstanding — regular breaks, no late-night driving, fatigue well managed',
      B: 'solid with only minor lapses in break timing',
      C: 'had one long stretch or some late-night driving that added fatigue risk',
      D: 'included unsafe patterns — long stretches without stopping or critically high fatigue',
    };

    const prompt = [
      `You are Hitch, the RVUnicorn co-pilot AI. Give a warm, personal safety debrief to ${name} for their drive.`,
      `Drive stats: ${driveHours} hours total, ${stopMins} min in breaks, ${breakCount} stops, longest stretch ${longestStretchHours}h, fatigue score at exit ${fatigueScore}/100.`,
      `Drive grade: ${grade} — ${gradeDescriptions[grade] || 'unknown'}.`,
      alertnessChecks.length > 0
        ? `Alertness checks: ${JSON.stringify(alertnessChecks.slice(-5))}.`
        : '',
      timeOfDay ? `They drove during: ${timeOfDay}.` : '',
      `Give exactly 3 sentences: (1) acknowledge their grade warmly and specifically, (2) one concrete observation about their break pattern, (3) one specific actionable tip for their next drive.`,
      `Keep it friendly, brief, and personal. Do not use bullet points or headers. Do not repeat the grade letter.`,
    ].filter(Boolean).join(' ');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data: any = await response.json() as any;
    const debrief = data?.content?.[0]?.text || 'Great drive! Remember to keep breaks consistent on your next trip.';

    res.json({ grade, debrief });
  } catch (err: any) {
    console.error('drive-debrief error:', err);
    res.status(500).json({ grade: 'B', debrief: 'Great drive! Remember to rest well before your next trip.' });
  }
});


// GET /api/hitch/daily-drop — Lifestyle Mode daily greeting from Hitch
router.get('/daily-drop', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true, homeCity: true, homeState: true,
        rvYear: true, rvMake: true, rvModel: true,
        dailyDropMessage: true, dailyDropDate: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Return cached if already generated today
    if (user.dailyDropMessage && user.dailyDropDate) {
      const cachedDate = new Date(user.dailyDropDate);
      cachedDate.setHours(0, 0, 0, 0);
      if (cachedDate.getTime() === today.getTime()) {
        return res.json({ message: user.dailyDropMessage, generatedAt: user.dailyDropDate });
      }
    }

    // Gather last trip info
    const lastTrip = await prisma.trip.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { name: true, destination: true, createdAt: true },
    }).catch(() => null);

    const daysSinceLastTrip = lastTrip
      ? Math.floor((Date.now() - new Date(lastTrip.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const month = new Date().getMonth();
    const season = month <= 1 || month === 11 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'fall';

    const rvInfo = [user.rvYear, user.rvMake, user.rvModel].filter(Boolean).join(' ');
    const locationInfo = [user.homeCity, user.homeState].filter(Boolean).join(', ');

    const userPrompt = [
      `First name: ${user.firstName || 'Camper'}.`,
      locationInfo ? `Home: ${locationInfo}.` : '',
      rvInfo ? `RV: ${rvInfo}.` : '',
      lastTrip ? `Last trip: "${lastTrip.name || lastTrip.destination || 'a trip'}" — ${daysSinceLastTrip} days ago.` : 'No trips yet.',
      `Current season: ${season}.`,
    ].filter(Boolean).join(' ');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: 'You are Hitch, the friendly AI co-pilot for RVUnicorn. Write 1-2 sentences. Reference their RV or location when possible. Be friendly, witty, and warm. Never sound corporate.',
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data: any = await response.json() as any;
    const message = data?.content?.[0]?.text || `Hey ${user.firstName || 'there'}! Hope the road is calling you today.`;

    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { dailyDropMessage: message, dailyDropDate: now },
    });

    res.json({ message, generatedAt: now });
  } catch (error: any) {
    console.error('Daily drop error:', error);
    res.status(500).json({ error: 'Failed to generate daily drop' });
  }
});

export default router;