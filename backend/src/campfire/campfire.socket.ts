import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';
import { ensureTriviaWeek } from '../cron/trivia-cron';

const hitchConversations = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

export function registerCampfireSockets(io: Server) {
  const campfire = io.of('/campfire');

  campfire.on('connection', async (socket: Socket) => {
    const { campgroundId, userId } = socket.handshake.query as { campgroundId: string; userId: string };
    if (!campgroundId || !userId) { socket.disconnect(); return; }

    socket.join(campgroundId);

    const checkedIn = await getCheckedInUsers(campgroundId);
    campfire.to(campgroundId).emit('presence:update', checkedIn);
    await maybeActivateRoom(campgroundId, campfire);

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
            const aiData = await res.json() as any;
            const reply = aiData?.content?.[0]?.text?.trim();
            if (reply) {
              history.push({ role: 'assistant', content: reply });
              if (history.length > 20) history.splice(0, 2);
              hitchConversations.set(histKey, history);
              const hitchMsg = await prisma.campfireMessage.create({
                data: { roomId: room.id, userId: userId, content: `🦄 ${reply}`, isHitch: true },
                include: { user: { select: { id: true, username: true, profilePicture: true, firstName: true, lastName: true } } },
              });
              campfire.to(campgroundId).emit('message:new', {
                id: hitchMsg.id, content: hitchMsg.content, createdAt: hitchMsg.createdAt,
                isSystem: false, isHitch: true, user: hitchMsg.user,
              });
            }
          } catch (e) { console.error('[Campfire @Hitch] error:', e); }
        }, 1000);
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
      } catch (e) {
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

async function maybeActivateRoom(campgroundId: string, namespace: any) {
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
    ensureTriviaWeek(campgroundId).catch(e =>
      console.error(`[Campfire] ensureTriviaWeek failed for ${campgroundId}:`, e)
    );
  }
}
