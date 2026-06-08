import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';
import { ensureTriviaWeek } from '../cron/trivia-cron';
import { updateTriviaTitle } from '../services/trivia-titles.service';
import { emitOrganizerActivity } from './organizer.socket';

const hitchConversations = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
// Track recently auto-responded messages to avoid duplicate responses
const recentAutoResponses = new Set<string>();
// Track last proactive Hitch message per campground to avoid spam
const lastProactiveHitch = new Map<string, number>();
// Track active proactive timers per campground
const proactiveTimers = new Map<string, ReturnType<typeof setTimeout>>();

const PERSONALITY_PROMPTS: Record<string, string> = {
  TRAIL_GUIDE: 'Knowledgeable, practical, speaks like a veteran park ranger.',
  PARTY_STARTER: 'Energetic and social, encourages guests to meet each other.',
  OLD_TIMER: 'Warm, storytelling, unhurried, makes guests feel at home.',
};

const QUESTION_PATTERN = /\?$|^(what|where|when|how|is|are|can|do|does|will|would|could|should)\b/i;

export function registerCampfireSockets(io: Server) {
  const campfire = io.of('/campfire');

  campfire.on('connection', async (socket: Socket) => {
    const { campgroundId, userId } = socket.handshake.query as { campgroundId: string; userId: string };
    if (!campgroundId || !userId) { socket.disconnect(); return; }

    socket.join(campgroundId);

    const checkedIn = await getCheckedInUsers(campgroundId);
    campfire.to(campgroundId).emit('presence:update', checkedIn);
    await maybeActivateRoom(campgroundId, campfire, io);

    // Trigger proactive Hitch when a new user connects and 2+ are checked in
    if (checkedIn.length >= 2) {
      scheduleProactiveHitch(campgroundId, campfire);
    }

    // Ensure trivia week exists for this campground (no-op if already created)
    // Pass io so first question fires immediately if a new week is created
    ensureTriviaWeek(campgroundId, io).catch(e =>
      console.error(`[Campfire] ensureTriviaWeek failed for ${campgroundId}:`, e)
    );

    socket.on('message:send', async (data: { content: string }) => {
      if (!data.content?.trim()) return;
      const room = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
      if (!room?.isActive) return;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, profilePicture: true, firstName: true, lastName: true },
      });
      if (!user) return;
      const msg = await prisma.campfireMessage.create({
        data: { roomId: room.id, userId, content: data.content.trim() },
        include: { user: { select: { id: true, username: true, profilePicture: true, firstName: true, lastName: true } } },
      });
      campfire.to(campgroundId).emit('message:new', {
        id: msg.id, content: msg.content, createdAt: msg.createdAt,
        isSystem: false, isHitch: false, user: msg.user,
      });

      // Emit to organizer pulse feed
      const isQuestion = /\?$|^(what|where|when|how|is|are|can|do)\b/i.test(data.content.trim());
      emitOrganizerActivity(campgroundId, {
        type: isQuestion ? 'FAQ_QUESTION' : 'CHAT_MESSAGE',
        title: isQuestion
          ? `${user.firstName} asked a question`
          : `${user.firstName} posted in campfire`,
        subtitle: data.content.slice(0, 80),
        userId: user.id,
        userName: user.firstName,
        userAvatar: user.profilePicture || undefined,
        actionLabel: isQuestion ? 'Answer' : undefined,
        actionType: isQuestion ? 'ANSWER_QUESTION' : undefined,
      });

      // @Hitch mention — conversational AI with memory
      if (/@hitch/i.test(data.content)) {
        setTimeout(async () => {
          try {
            const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true, state: true } });
            const question = data.content.replace(/@hitch/gi, '').trim();
            if (!question) return;
            const histKey = `campfire:${userId}`;
            const history = hitchConversations.get(histKey) || [];
            const ctxNote = `${user.firstName} at ${campground?.name || 'a campground'}${campground?.state ? ', ' + campground.state : ''}`;
            history.push({ role: 'user' as const, content: `[${ctxNote}]: ${question}` });
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300,
                system: 'You are Hitch, the friendly unicorn AI co-pilot for RVUnicorn, a social platform for RV enthusiasts. Help RVers with: campground tips, route planning, driving safety, RV maintenance, campfire recipes, outdoor activities, weather, road conditions, and community questions. Personality: warm, encouraging, occasionally playful. Rules: keep responses to 1-3 sentences. Always be appropriate and family-friendly. If asked about anything unrelated to RV life, travel, outdoors, or community, gently redirect. Never discuss politics, violence, adult content, or anything harmful. Remember conversation context for follow-up questions.',
                messages: history.slice(-10) }),
            });
            const aiData: any = await res.json() as any;
            const reply = aiData?.content?.[0]?.text?.trim();
            if (reply) {
              history.push({ role: 'assistant', content: reply });
              if (history.length > 20) history.splice(0, 2);
              hitchConversations.set(histKey, history);
              const hitchMsg = await prisma.campfireMessage.create({
                data: { roomId: room.id, userId: userId, content: `🦄 ${reply}`, isHitch: true, replyToId: msg.id },
                include: { user: { select: { id: true, username: true, profilePicture: true, firstName: true, lastName: true } } },
              });
              campfire.to(campgroundId).emit('message:new', {
                id: hitchMsg.id, content: hitchMsg.content, createdAt: hitchMsg.createdAt,
                isSystem: false, isHitch: true, user: hitchMsg.user,
                replyToId: msg.id, replyToContent: data.content.slice(0, 80), replyToUser: user.firstName,
              });
            }
          } catch (e: any) { console.error('[Campfire @Hitch] error:', e); }
        }, 1000);
      }

      // @Walter mention — stargazing/veteran persona
      if (/@walter/i.test(data.content)) {
        setTimeout(async () => {
          try {
            const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true, state: true } });
            const question = data.content.replace(/@walter/gi, '').trim();
            if (!question) return;
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300,
                system: `You are Walter 🎭, a gruff veteran RV stargazing guide at ${campground?.name || 'the campground'}${campground?.state ? ', ' + campground.state : ''}. You're sarcastic and curmudgeonly but secretly love sharing knowledge about the night sky, constellations, and campground life. Keep responses to 1-3 sentences. Be funny and dry. Family-friendly.`,
                messages: [{ role: 'user', content: `${user.firstName} says: ${question}` }] }),
            });
            const aiData: any = await res.json() as any;
            const reply = aiData?.content?.[0]?.text?.trim();
            if (reply) {
              const walterMsg = await prisma.campfireMessage.create({
                data: { roomId: room.id, userId: null, content: `🎭 ${reply}`, isSystem: true, isHitch: false, replyToId: msg.id },
              });
              campfire.to(campgroundId).emit('message:new', {
                id: walterMsg.id, content: walterMsg.content, createdAt: walterMsg.createdAt,
                isSystem: true, isHitch: false,
                replyToId: msg.id, replyToContent: data.content.slice(0, 80), replyToUser: user.firstName,
              });
            }
          } catch (e: any) { console.error('[Campfire @Walter] error:', e); }
        }, 1500);
      }

      // @Scout mention — adventure trailblazer persona
      if (/@scout/i.test(data.content)) {
        setTimeout(async () => {
          try {
            const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true, state: true } });
            const question = data.content.replace(/@scout/gi, '').trim();
            if (!question) return;
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300,
                system: `You are Scout 🏔️, an adventure trailblazer at ${campground?.name || 'the campground'}${campground?.state ? ', ' + campground.state : ''}. High energy, loves trails, hidden gems, and outdoor adventures. Keep responses to 1-3 sentences. Enthusiastic and helpful. Family-friendly.`,
                messages: [{ role: 'user', content: `${user.firstName} says: ${question}` }] }),
            });
            const aiData: any = await res.json() as any;
            const reply = aiData?.content?.[0]?.text?.trim();
            if (reply) {
              const scoutMsg = await prisma.campfireMessage.create({
                data: { roomId: room.id, userId: null, content: `🏔️ ${reply}`, isSystem: true, isHitch: false, replyToId: msg.id },
              });
              campfire.to(campgroundId).emit('message:new', {
                id: scoutMsg.id, content: scoutMsg.content, createdAt: scoutMsg.createdAt,
                isSystem: true, isHitch: false,
                replyToId: msg.id, replyToContent: data.content.slice(0, 80), replyToUser: user.firstName,
              });
            }
          } catch (e: any) { console.error('[Campfire @Scout] error:', e); }
        }, 1500);
      }

      // FAQ auto-response — if message looks like a question and no character was mentioned
      if (!/@(hitch|walter|scout)/i.test(data.content) && QUESTION_PATTERN.test(data.content.trim())) {
        setTimeout(async () => {
          try {
            // Check if HitchCampgroundConfig exists with autoRespond enabled
            const config = await (prisma as any).hitchCampgroundConfig.findUnique({ where: { campgroundId } });
            if (!config?.autoRespond) return;

            // Check quiet hours
            if (config.quietHoursStart != null && config.quietHoursEnd != null) {
              const hour = new Date().getHours();
              const start = config.quietHoursStart;
              const end = config.quietHoursEnd;
              // Handle wrap-around (e.g. 22 to 8)
              if (start > end ? (hour >= start || hour < end) : (hour >= start && hour < end)) return;
            }

            // Deduplicate — don't respond to same message twice
            if (recentAutoResponses.has(msg.id)) return;
            recentAutoResponses.add(msg.id);
            setTimeout(() => recentAutoResponses.delete(msg.id), 60000);

            const campground = await prisma.campground.findUnique({
              where: { id: campgroundId },
              select: { name: true, city: true, state: true, amenities: true },
            });
            if (!campground) return;

            const personalityDesc = PERSONALITY_PROMPTS[config.personality] || PERSONALITY_PROMPTS.TRAIL_GUIDE;
            const faqSection = config.faqContent ? `\n\nFAQ KNOWLEDGE BASE:\n${config.faqContent}` : '\nNo FAQ uploaded';

            const systemPrompt = `You are Hitch, an AI campground guide for ${campground.name}${campground.city ? ', ' + campground.city : ''}${campground.state ? ', ' + campground.state : ''}.
Your personality is: ${personalityDesc}

CAMPGROUND INFO:
${campground.name}
Amenities: ${(campground.amenities || []).join(', ') || 'Not listed'}
${faqSection}

Answer the guest's question briefly and helpfully.
If you don't know the answer, say so and suggest they ask the campground office directly.
Keep responses under 100 words.
Stay in character.`;

            const question = data.content.trim();
            const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 200,
                system: systemPrompt,
                messages: [{ role: 'user', content: `${user.firstName} asks: ${question}` }],
              }),
            });
            const aiData: any = await aiRes.json() as any;
            const reply = aiData?.content?.[0]?.text?.trim();
            if (reply) {
              const autoMsg = await prisma.campfireMessage.create({
                data: { roomId: room.id, userId: userId, content: `🦄 ${reply}`, isHitch: true, replyToId: msg.id },
                include: { user: { select: { id: true, username: true, profilePicture: true, firstName: true, lastName: true } } },
              });
              campfire.to(campgroundId).emit('message:new', {
                id: autoMsg.id, content: autoMsg.content, createdAt: autoMsg.createdAt,
                isSystem: false, isHitch: true, user: autoMsg.user,
                replyToId: msg.id, replyToContent: data.content.slice(0, 80), replyToUser: user.firstName,
              });
            }
          } catch (e: any) { console.error('[Campfire FAQ AutoResponse] error:', e); }
        }, 2000);
      }
    });


    // Handle trivia answers
    socket.on('trivia:answer', async (data: { questionId: string; answer: string; answeredAt: string }) => {
      if (!data.questionId || !data.answer) return;
      try {
        const question = await prisma.triviaQuestion.findUnique({ where: { id: data.questionId } });
        if (!question || !question.askedAt) return;

        const responseTime = Math.floor((new Date(data.answeredAt).getTime() - new Date(question.askedAt).getTime()) / 1000);
        const isCorrect = question.answer === data.answer;
        const speedBonus = isCorrect ? (responseTime < 30 ? 5 : responseTime < 90 ? 2 : 0) : 0;

        // Comeback mechanic: double points on Q9 and Q10
        const isLastTwo = question.questionNum >= 9;
        const basePoints = isCorrect ? 10 + speedBonus : 0;
        const points = isLastTwo ? basePoints * 2 : basePoints;
        const isComeback = isLastTwo && isCorrect && points > 0;

        await prisma.triviaAnswer.upsert({
          where: { questionId_userId: { questionId: data.questionId, userId } },
          update: { answer: data.answer, isCorrect, responseTime, points },
          create: { questionId: data.questionId, userId, answer: data.answer, isCorrect, responseTime, points },
        });

        // Update leaderboard
        const week = await prisma.triviaWeek.findUnique({ where: { id: question.weekId } });
        if (week) {
          await prisma.triviaLeaderboard.upsert({
            where: { weekId_userId: { weekId: week.id, userId } },
            update: {
              totalPoints: { increment: points },
              correctAnswers: { increment: isCorrect ? 1 : 0 },
              gamesPlayed: { increment: 1 },
            },
            create: { weekId: week.id, userId, totalPoints: points, correctAnswers: isCorrect ? 1 : 0, gamesPlayed: 1 },
          });
        }

        // Tell the user their result privately
        socket.emit('trivia:answer:result', { questionId: data.questionId, isCorrect, points, correctAnswer: question.answer, isComeback, isLastTwo });

        // Update player title
        const newTitle = await updateTriviaTitle(userId);
        if (newTitle) {
          socket.emit('trivia:title:updated', { title: newTitle });
        }
      } catch (e: any) {
        console.error('[Campfire] Answer error:', e);
      }
    });

    socket.on('disconnect', async () => {
      const checkedIn = await getCheckedInUsers(campgroundId);
      campfire.to(campgroundId).emit('presence:update', checkedIn);
    });
  });
}

async function getCheckedInUsers(campgroundId: string) {
  const checkIns = await prisma.checkIn.findMany({
    where: { campgroundId, isActive: true },
    include: { user: { select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true } } },
    take: 50,
  });
  return checkIns.map((c: any) => c.user);
}

async function maybeActivateRoom(campgroundId: string, namespace: any, io?: any) {
  const count = await prisma.checkIn.count({ where: { campgroundId, isActive: true } });
  const existing = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
  if (count >= 1 && !existing?.isActive) {
    const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true } });
    const room = await prisma.campfireRoom.upsert({
      where: { campgroundId },
      update: { isActive: true, activatedAt: new Date(), closedAt: null },
      create: { campgroundId, isActive: true, activatedAt: new Date() },
    });
    await prisma.campfireMessage.createMany({
      data: [
        { roomId: room.id, isSystem: true, content: `🔥 Campfire Chat is live at ${campground?.name || 'this campground'}! Trivia: 7:30 AM, 12:25 PM & 5:30 PM CT.` },
        { roomId: room.id, isHitch: true, content: `Hey campers! 🦄 Pull up a chair — the fire's going! Trivia: 7:30 AM, 12:25 PM & 5:30 PM CT. Chat away!` },
      ],
    });
    namespace.to(campgroundId).emit('room:activated', { message: '🔥 Campfire is live! Trivia at 5:30 PM.' });

    // Generate trivia week on-demand if none exists (mid-week check-in)
    ensureTriviaWeek(campgroundId, io).catch(e =>
      console.error(`[Campfire] ensureTriviaWeek failed for ${campgroundId}:`, e)
    );
  }

  // Schedule proactive Hitch engagement when 2+ campers are checked in
  if (count >= 2) {
    scheduleProactiveHitch(campgroundId, namespace);
  }
}

// ─── Proactive Hitch Engagement ──────────────────────────────────────────────
// Hitch acts as campground host: calls out campers by name, sparks group conversations

function scheduleProactiveHitch(campgroundId: string, namespace: any) {
  // Don't schedule if one is already pending
  if (proactiveTimers.has(campgroundId)) return;

  // Check cooldown — no proactive message if one was sent in last 10 minutes
  const lastSent = lastProactiveHitch.get(campgroundId) || 0;
  const cooldownMs = 10 * 60 * 1000; // 10 minutes
  const elapsed = Date.now() - lastSent;
  const delay = elapsed < cooldownMs ? cooldownMs - elapsed + 30000 : 30000; // 30s after check-in, or after cooldown

  const timer = setTimeout(async () => {
    proactiveTimers.delete(campgroundId);
    try {
      await sendProactiveHitch(campgroundId, namespace);
    } catch (e) {
      console.error('[Campfire ProactiveHitch] error:', e);
    }
  }, delay);

  proactiveTimers.set(campgroundId, timer);
}

async function sendProactiveHitch(campgroundId: string, namespace: any) {
  // Verify conditions still hold
  const room = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
  if (!room?.isActive) return;

  const checkedInUsers = await prisma.checkIn.findMany({
    where: { campgroundId, isActive: true },
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true, username: true,
          homeCity: true, homeState: true,
        },
      },
    },
    take: 20,
  });

  if (checkedInUsers.length < 2) return;

  // Check if there's been a recent message (< 10 min) — don't interrupt active conversation
  const recentMsg = await prisma.campfireMessage.findFirst({
    where: { roomId: room.id, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
  });
  // If last message was from a human (not Hitch), the chat is active — skip
  if (recentMsg && !recentMsg.isHitch && !recentMsg.isSystem) return;

  // Get recent messages for context (avoid repeating topics)
  const recentMessages = await prisma.campfireMessage.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { content: true, isHitch: true },
  });

  const campground = await prisma.campground.findUnique({
    where: { id: campgroundId },
    select: { name: true, city: true, state: true },
  });

  // Get RV info for checked-in users
  const userIds = checkedInUsers.map(c => c.user.id);
  const rvProfiles = await prisma.rVProfile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, year: true, make: true, model: true, type: true, nickname: true },
  });
  const rvMap = new Map(rvProfiles.map(r => [r.userId, r]));

  const camperList = checkedInUsers.map(c => {
    const rv = rvMap.get(c.user.id);
    const rvDesc = rv ? `${rv.year || ''} ${rv.make || ''} ${rv.model || ''} (${rv.type || 'RV'})`.trim() : '';
    const home = [c.user.homeCity, c.user.homeState].filter(Boolean).join(', ');
    return `- ${c.user.firstName}${home ? ` from ${home}` : ''}${rvDesc ? `, drives a ${rvDesc}` : ''}`;
  }).join('\n');

  const recentContext = recentMessages.reverse().map(m =>
    `${m.isHitch ? 'Hitch' : 'Camper'}: ${m.content.slice(0, 100)}`
  ).join('\n');

  const timeOfDay = (() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  })();

  const systemPrompt = `You are Hitch 🦄, the campfire host at ${campground?.name || 'this campground'}${campground?.state ? ' in ' + campground.state : ''}. It's ${timeOfDay}. You're facilitating conversation among campers currently checked in. Your job is to spark engaging group discussion.

Currently checked in:
${camperList}

${recentContext ? `Recent campfire messages:\n${recentContext}` : 'The campfire has been quiet.'}

Generate ONE message that does one of these (pick the most natural fit):
- Call out a specific camper by first name and ask them a fun question about their rig, travels, or where they're heading next
- Ask the whole group a fun "would you rather" or "what's your favorite..." camping question
- Share a relevant tip for the area and ask if anyone's tried it
- Welcome someone by name and ask where they're coming from or where they're heading
- Connect two campers who might have something in common (same rig type, same home state, similar rigs, etc.)
- Suggest a group activity appropriate for the time of day (morning hike, sunset viewing, evening s'mores, etc.)

Rules:
- 1-2 sentences max. Warm, conversational, like a friendly camp host.
- USE camper first names — this is personal.
- Family-friendly. No politics, no controversy.
- Do NOT repeat a topic from the recent messages.
- Do NOT start with "Hey campers" — vary your opener.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate a campfire conversation starter.' }],
      }),
    });
    const aiData: any = await res.json() as any;
    const message = aiData?.content?.[0]?.text?.trim();
    if (message) {
      const hitchMsg = await prisma.campfireMessage.create({
        data: { roomId: room.id, userId: null, content: `🦄 ${message}`, isHitch: true },
      });
      namespace.to(campgroundId).emit('message:new', {
        id: hitchMsg.id, content: hitchMsg.content, createdAt: hitchMsg.createdAt,
        isSystem: false, isHitch: true,
      });
      lastProactiveHitch.set(campgroundId, Date.now());
    }
  } catch (e) {
    console.error('[Campfire ProactiveHitch] AI call failed:', e);
  }
}
