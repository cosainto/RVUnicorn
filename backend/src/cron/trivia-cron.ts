import cron from 'node-cron';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../prisma';
import { runTripCheckinReminder } from './trip-checkin-reminder';
import { runStargazingCron, runWalletChaosCron } from './stargazing-cron';
import { runWeatherAlertCron } from './weather-alert-cron';
import { runEmailDripCron } from './email-drip';
import { expireFeedMutes } from '../routes/feed-controls.routes';
import { suggestWeatherDeals } from '../routes/last-minute.routes';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CHARACTERS = ['hitch','walter','rose','diesel','scout','luna','wallet'];
const CATEGORIES = ['Camping & RV','Food & Cooking','Nature & Outdoors','General Trivia','Pop Culture (Family)'];

// ── Get week boundaries (Mon 00:00 → Sun 23:59) ──────────────
function getWeekBounds(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun,1=Mon...
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  mon.setHours(0,0,0,0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23,59,59,999);
  return { weekStart: mon, weekEnd: sun };
}

// ── Generate questions for a full week via Anthropic ─────────
async function generateWeekQuestions(theme: string, character: string): Promise<any[]> {
  const prompt = `You are generating trivia questions for a campground chat game hosted by ${character}.
Theme this week: "${theme}"
Generate exactly 70 trivia questions (10 per day, 7 days).
Rules:
- G-rated only, family friendly
- Multiple choice with options A, B, C, D
- Mix categories: ${CATEGORIES.join(', ')}
- Vary difficulty (easy/medium/hard mix)
- Camping/RV questions should be ~30% of total

Return ONLY a JSON array, no markdown, no preamble:
[
  {
    "question": "...",
    "optionA": "...",
    "optionB": "...",
    "optionC": "...",
    "optionD": "...",
    "answer": "A",
    "category": "Camping & RV",
    "dayOfWeek": 1,
    "questionNum": 1
  }
]
dayOfWeek: 1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat,0=Sun
questionNum: 1-10 per day`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── Monday: Create week + generate questions for all active rooms ─
export async function kickoffNewWeek() {
  console.log('[TriviaCron] Starting Monday kickoff...');
  const { weekStart, weekEnd } = getWeekBounds(new Date());
  const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const themes = ['Classic Americana','Great Outdoors','Road Trip USA','Campfire Classics','Family Fun'];
  const theme = themes[Math.floor(Math.random() * themes.length)];

  // Find all active campfire rooms
  const rooms = await prisma.campfireRoom.findMany({ where: { isActive: true } });
  console.log(`[TriviaCron] Creating trivia weeks for ${rooms.length} active rooms`);

  // Generate one question set (reuse across all campgrounds this week)
  let questions: any[] = [];
  try {
    questions = await generateWeekQuestions(theme, character);
    console.log(`[TriviaCron] Generated ${questions.length} questions`);
  } catch (e) {
    console.error('[TriviaCron] Question generation failed:', e);
    return;
  }

  for (const room of rooms) {
    try {
      // Close last week
      await prisma.triviaWeek.updateMany({
        where: { campgroundId: room.campgroundId, isActive: true },
        data: { isActive: false },
      });

      // Create new week
      const week = await prisma.triviaWeek.create({
        data: {
          campgroundId: room.campgroundId,
          weekStart, weekEnd,
          hostCharacter: character,
          theme,
          isActive: true,
        },
      });

      // Schedule questions
      const questionData = questions.map((q: any) => {
        const schedDate = new Date(weekStart);
        const daysFromMon = q.dayOfWeek === 0 ? 6 : q.dayOfWeek - 1;
        schedDate.setDate(weekStart.getDate() + daysFromMon);
        schedDate.setHours(17, 30 + (q.questionNum - 1) * 3, 0, 0); // 5:30, 5:33, 5:36...
        return {
          weekId: week.id,
          dayOfWeek: q.dayOfWeek,
          questionNum: q.questionNum,
          question: q.question,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          answer: q.answer,
          category: q.category,
          scheduledAt: schedDate,
        };
      });

      await prisma.triviaQuestion.createMany({ data: questionData });

      // Post kickoff message to campfire room
      await prisma.campfireMessage.create({
        data: {
          roomId: room.id,
          isHitch: true,
          content: `🎉 New week, new host! I'm ${character} and this week's theme is "${theme}". Trivia runs 3x daily: 7:30 AM, 12:25 PM & 5:30 PM CT. Get ready! 🔥`,
        },
      });

      console.log(`[TriviaCron] Week created for campground ${room.campgroundId}`);
    } catch (e) {
      console.error(`[TriviaCron] Failed for campground ${room.campgroundId}:`, e);
    }
  }
}

// ── On-demand: Ensure a trivia week exists for a newly activated room ─
export async function ensureTriviaWeek(campgroundId: string) {
  const { weekStart, weekEnd } = getWeekBounds(new Date());

  // Already has an active week this period — nothing to do
  const existing = await prisma.triviaWeek.findFirst({
    where: { campgroundId, isActive: true, weekStart: { gte: weekStart } },
  });
  if (existing) return;

  console.log(`[TriviaCron] Creating on-demand trivia week for campground ${campgroundId}`);

  const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const themes = ['Classic Americana','Great Outdoors','Road Trip USA','Campfire Classics','Family Fun'];
  const theme = themes[Math.floor(Math.random() * themes.length)];

  let questions: any[] = [];
  try {
    questions = await generateWeekQuestions(theme, character);
  } catch (e) {
    console.error(`[TriviaCron] On-demand question generation failed for ${campgroundId}:`, e);
    return;
  }

  // Close any stale weeks
  await prisma.triviaWeek.updateMany({
    where: { campgroundId, isActive: true },
    data: { isActive: false },
  });

  const week = await prisma.triviaWeek.create({
    data: { campgroundId, weekStart, weekEnd, hostCharacter: character, theme, isActive: true },
  });

  const questionData = questions.map((q: any) => {
    const schedDate = new Date(weekStart);
    const daysFromMon = q.dayOfWeek === 0 ? 6 : q.dayOfWeek - 1;
    schedDate.setDate(weekStart.getDate() + daysFromMon);
    schedDate.setHours(17, 30 + (q.questionNum - 1) * 3, 0, 0);
    return {
      weekId: week.id,
      dayOfWeek: q.dayOfWeek,
      questionNum: q.questionNum,
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      answer: q.answer,
      category: q.category,
      scheduledAt: schedDate,
    };
  });

  await prisma.triviaQuestion.createMany({ data: questionData });

  const room = await prisma.campfireRoom.findUnique({ where: { campgroundId } });
  if (room) {
    await prisma.campfireMessage.create({
      data: {
        roomId: room.id,
        isHitch: true,
        content: `🎉 Trivia is ready! I'm ${character} and this week's theme is "${theme}". Sessions at 7:30 AM, 12:25 PM & 5:30 PM CT. Let's go! 🔥`,
      },
    });
  }

  console.log(`[TriviaCron] On-demand week created for campground ${campgroundId}`);
}

// ── Daily 5:25 PM: Warning message ───────────────────────────
export async function postTriviaWarning() {
  const rooms = await prisma.campfireRoom.findMany({ where: { isActive: true } });
  for (const room of rooms) {
    const week = await prisma.triviaWeek.findFirst({
      where: { campgroundId: room.campgroundId, isActive: true },
    });
    if (!week) continue;
    await prisma.campfireMessage.create({
      data: {
        roomId: room.id,
        isSystem: true,
        content: `⏰ Trivia starts in 5 minutes! Hosted by ${week.hostCharacter} · Theme: ${week.theme}`,
      },
    });
  }
}

// ── Daily 5:30–6:00 PM: Ask questions ────────────────────────
export async function askNextQuestion(io: any) {
  const now = new Date();
  const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const dayOfWeek = central.getDay();
  const totalMins = central.getHours() * 60 + central.getMinutes();
  const sessions = [{ startH: 7, startM: 30 }, { startH: 12, startM: 25 }, { startH: 17, startM: 30 }];
  const activeSession = sessions.find(s => { const start = s.startH*60+s.startM; return totalMins>=start && totalMins<start+30; });
  if (!activeSession) return;
  const minutesSinceStart = totalMins - (activeSession.startH*60+activeSession.startM);
  const questionNum = Math.floor(minutesSinceStart/3)+1;
  if (questionNum<1||questionNum>10) return;

  // Fetch sponsored question for Q5 (may be null if none active)
  const sponsoredQ = questionNum === 5
    ? await (prisma as any).sponsorQuestion?.findFirst({
        where: { isActive: true },
        include: { campaign: { select: { brandName: true, brandLogoUrl: true, brandLandingUrl: true } } },
      }).catch(() => null)
    : null;

  const rooms = await prisma.campfireRoom.findMany({ where: { isActive: true } });

  for (const room of rooms) {
    const week = await prisma.triviaWeek.findFirst({
      where: { campgroundId: room.campgroundId, isActive: true },
    });
    if (!week) continue;

    // Use sponsored question at Q5 if available
    if (questionNum === 5 && sponsoredQ) {
      await prisma.campfireMessage.create({
        data: {
          roomId: room.id,
          isHitch: true,
          content: `🎁 Bonus Round — this one's worth extra! Powered by ${sponsoredQ.brandName}\n\n${sponsoredQ.question}\n\nA) ${sponsoredQ.optionA}\nB) ${sponsoredQ.optionB}\nC) ${sponsoredQ.optionC}\nD) ${sponsoredQ.optionD}`,
        },
      });
      if (io) {
        io.of('/campfire').to(room.campgroundId).emit('trivia:sponsored-question', {
          questionId: sponsoredQ.id,
          campaignId: sponsoredQ.campaignId,
          questionNum: 5,
          total: 10,
          question: sponsoredQ.question,
          options: { A: sponsoredQ.optionA, B: sponsoredQ.optionB, C: sponsoredQ.optionC, D: sponsoredQ.optionD },
          category: 'Bonus Round',
          brandName: sponsoredQ.brandName,
          brandLogoUrl: sponsoredQ.brandLogoUrl,
          brandLandingUrl: sponsoredQ.brandLandingUrl,
          rewardType: sponsoredQ.rewardType,
          rewardValue: sponsoredQ.rewardValue,
          timeLimit: 120,
          askedAt: new Date().toISOString(),
          isSponsored: true,
        });
      }
      continue;
    }

    const question = await prisma.triviaQuestion.findFirst({
      where: { weekId: week.id, dayOfWeek, questionNum },
    });
    if (!question || question.askedAt) continue;

    // Mark as asked
    await prisma.triviaQuestion.update({
      where: { id: question.id },
      data: { askedAt: now },
    });

    // Post "Tap to play" invite in chat — question text stays in the popup card only
    const invites = [
      `🎯 Trivia time! Think you know your stuff? Tap to play →`,
      `🔥 Q${questionNum} is live — think you've got what it takes? Tap to play →`,
      `⏰ Question ${questionNum} of 10 is up! Tap to play →`,
      `🦄 Hitch has a question for you. Tap to play →`,
      `🤔 Q${questionNum} — campers vs glampers. Tap to play →`,
    ];
    const msg = invites[Math.floor(Math.random() * invites.length)];
    await prisma.campfireMessage.create({
      data: { roomId: room.id, isHitch: true, content: msg },
    });

    // Check for redemption candidates (missed 3+ in a row today)
    if (io && questionNum > 3) {
      try {
        const today = new Date().getDay();
        const recentAnswers = await prisma.triviaAnswer.findMany({
          where: {
            question: { weekId: week.id, dayOfWeek: today },
            isCorrect: false,
          },
          include: { user: { select: { id: true, firstName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        // Find users with 3+ wrong in a row
        const wrongCounts: Record<string, number> = {};
        for (const a of recentAnswers) {
          wrongCounts[a.userId] = (wrongCounts[a.userId] || 0) + 1;
        }
        const redemptionUsers = Object.entries(wrongCounts)
          .filter(([_, count]) => count >= 3)
          .map(([userId]) => userId);

        if (redemptionUsers.length > 0) {
          const hitchMessages = [
            `🎯 Redemption time! This next one is your chance to climb back up the leaderboard!`,
            `💪 Don't give up now — Q${questionNum} could turn this whole thing around!`,
            `🔥 The comeback starts HERE. You've got this!`,
          ];
          const msg = hitchMessages[Math.floor(Math.random() * hitchMessages.length)];
          for (const uid of redemptionUsers) {
            io.of('/campfire').to(room.campgroundId).emit('trivia:redemption', {
              userId: uid,
              message: msg,
              questionNum,
            });
          }
        }
      } catch {}
    }

    // Broadcast via socket
    if (io) {
      io.of('/campfire').to(room.campgroundId).emit('trivia:question', {
        questionId: question.id,
        questionNum,
        total: 10,
        question: question.question,
        options: { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD },
        category: question.category,
        timeLimit: 120, // 2 minutes
        askedAt: now.toISOString(),
      });
    }
  }
}

// ── Daily 6:00 PM: Post daily leaderboard ────────────────────
export async function postDailyLeaderboard(io: any) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const rooms = await prisma.campfireRoom.findMany({ where: { isActive: true } });

  for (const room of rooms) {
    const week = await prisma.triviaWeek.findFirst({
      where: { campgroundId: room.campgroundId, isActive: true },
      include: {
        leaderboard: {
          orderBy: { totalPoints: 'desc' },
          take: 5,
          include: { user: { select: { firstName: true, username: true } } },
        },
      },
    });
    if (!week) continue;

    const board = week.leaderboard;
    if (board.length === 0) {
      await prisma.campfireMessage.create({
        data: { roomId: room.id, isHitch: true, content: `😴 No answers today… either that was too hard, or everyone was distracted by s'mores.` },
      });
      continue;
    }

    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    const lines = board.map((b, i) => `${medals[i]} ${b.user.firstName} — ${b.totalPoints} pts`).join('\n');
    const isSunday = dayOfWeek === 0;

    await prisma.campfireMessage.create({
      data: {
        roomId: room.id,
        isSystem: true,
        content: isSunday
          ? `📊 Final weekly standings:\n${lines}\n\n🏆 Winner announcement at 6:05 PM!`
          : `📊 Today's leaderboard:\n${lines}`,
      },
    });

    if (io) {
      io.of('/campfire').to(room.campgroundId).emit('trivia:leaderboard', {
        board: board.map((b, i) => ({ rank: i+1, name: b.user.firstName, points: b.totalPoints, correct: b.correctAnswers })),
        isFinal: isSunday,
      });
    }
  }
}

// ── Sunday 6:05 PM: Announce winner ──────────────────────────
async function announceWeeklyWinner(io: any) {
  const rooms = await prisma.campfireRoom.findMany({ where: { isActive: true } });

  for (const room of rooms) {
    const week = await prisma.triviaWeek.findFirst({
      where: { campgroundId: room.campgroundId, isActive: true },
      include: {
        leaderboard: {
          orderBy: { totalPoints: 'desc' },
          take: 1,
          include: { user: { select: { id: true, firstName: true, username: true } } },
        },
      },
    });
    if (!week || week.leaderboard.length === 0) continue;

    const winner = week.leaderboard[0];
    const character = week.hostCharacter;

    const proclamations: Record<string, string> = {
      hitch: `🏆 After a week of campfire questions and s'more debates… the Campfire Champion is @${winner.user.firstName}! 🔥 Well played, friend!`,
      walter: `🏆 Alright, I'll admit it… @${winner.user.firstName} actually knew their stuff. Don't let it go to your head. You're the champion. Barely.`,
      rose: `🏆 Darling, it was simply *magnificent*. @${winner.user.firstName} — you are this week's Campfire Champion! Now someone pour the sparkling water. 🥂`,
      diesel: `🏆 That's how you do it! @${winner.user.firstName} pulled through like a fully-loaded rig on a flat highway. CAMPFIRE CHAMPION! 🚛`,
      scout: `🏆 From the trailhead to the finish line — @${winner.user.firstName} crushed it this week! Campfire Champion! Keep exploring! 🌲`,
      luna: `🏆 What a beautiful week of trivia. @${winner.user.firstName}, you're this week's Campfire Champion. The whole campground is proud of you! 🌙`,
      wallet: `🏆 WAIT WAIT WAIT— @${winner.user.firstName} WON?!?! I KNEW IT! I predicted this on day one! Nobody listened to me but I KNEW IT! 🪨💥 CHAMPION!!!`,
      pebble: `🏆 CHAOS. TRIVIA. CHAMPION. @${winner.user.firstName} WON?! THEY ACTUALLY WON! I did NOT see that coming! 🪨🎉`,
    };

    const message = proclamations[character] || proclamations.hitch;

    await prisma.campfireMessage.create({
      data: { roomId: room.id, isHitch: true, content: message },
    });

    await prisma.triviaWeek.update({
      where: { id: week.id },
      data: { winnerId: winner.user.id, announcedAt: new Date() },
    });

    if (io) {
      io.of('/campfire').to(room.campgroundId).emit('trivia:winner', {
        name: winner.user.firstName,
        username: winner.user.username,
        points: winner.totalPoints,
        character,
        message,
      });
    }
  }
}

// ── Register all crons ────────────────────────────────────────

// Force ask next unanswered question regardless of time (admin use)
export async function forceAskNextQuestion(io: any) {
  const rooms = await prisma.campfireRoom.findMany({ where: { isActive: true } });

  for (const room of rooms) {
    const week = await prisma.triviaWeek.findFirst({
      where: { campgroundId: room.campgroundId, isActive: true },
    });
    if (!week) continue;

    // Find next unanswered question in order
    const question = await prisma.triviaQuestion.findFirst({
      where: { weekId: week.id, askedAt: null },
      orderBy: [{ dayOfWeek: 'asc' }, { questionNum: 'asc' }],
    });
    if (!question) {
      console.log(`[TriviaAdmin] No unasked questions for room ${room.campgroundId}`);
      continue;
    }

    const now = new Date();
    await prisma.triviaQuestion.update({
      where: { id: question.id },
      data: { askedAt: now },
    });

    if (io) {
      io.of('/campfire').to(room.campgroundId).emit('trivia:question', {
        questionId: question.id,
        questionNum: question.questionNum,
        total: 10,
        question: question.question,
        options: { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD },
        category: question.category,
        timeLimit: 30,
        askedAt: now.toISOString(),
      });
    }

    console.log(`[TriviaAdmin] Force-asked Q${question.questionNum} for ${room.campgroundId}`);
  }
}


// ── Daily 6:00 PM: Campfire Recipe of the Night ──────────────
export async function postRecipeOfNight() {
  const rooms = await prisma.campfireRoom.findMany({ where: { isActive: true } });
  for (const room of rooms) {
    try {
      const campground = await (prisma as any).campground.findUnique({
        where: { id: room.campgroundId },
        select: { name: true, state: true },
      });

      const now = new Date();
      const season = [11,0,1].includes(now.getMonth()) ? 'winter' : [2,3,4].includes(now.getMonth()) ? 'spring' : [5,6,7].includes(now.getMonth()) ? 'summer' : 'fall';

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are Hitch, the friendly RV Unicorn campfire host at ${campground?.name || 'camp'} in ${season}. Write a SHORT campfire recipe post. Format: 🍳 Tonight's Campfire Recipe: [Name]\n\n[intro]\n\nIngredients:\n• ...\n\nSteps:\n1. ...\n\n[fun closing]. Keep it under 200 words, real and delicious.`,
        }],
      });

      const content = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
      if (!content) continue;

      await prisma.campfireMessage.create({
        data: { roomId: room.id, isHitch: true, content },
      });

      console.log(`[RecipeCron] Posted recipe for ${room.campgroundId}`);
    } catch (e) {
      console.error(`[RecipeCron] Failed for ${room.campgroundId}:`, e);
    }
  }
}


// ── Daily 8:00 AM: Morning Trail Suggestions ─────────────────
export async function postMorningTrails() {
  const rooms = await prisma.campfireRoom.findMany({ where: { isActive: true } });
  for (const room of rooms) {
    try {
      const campground = await (prisma as any).campground.findUnique({
        where: { id: room.campgroundId },
        select: { name: true, state: true, city: true, latitude: true, longitude: true },
      });
      if (!campground?.latitude || !campground?.longitude) continue;

      const now = new Date();
      const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
      const season = [11,0,1].includes(now.getMonth()) ? 'winter' : [2,3,4].includes(now.getMonth()) ? 'spring' : [5,6,7].includes(now.getMonth()) ? 'summer' : 'fall';

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 350,
        messages: [{
          role: 'user',
          content: `You are Hitch, the friendly RV Unicorn campfire host. It's ${dayName} morning in ${season} at ${campground.name} near ${campground.city}, ${campground.state} (coordinates: ${campground.latitude}, ${campground.longitude}).

Write a morning trail/activity suggestions post. Format exactly like this:

🌄 Good morning, campers! Happy ${dayName}!

[1 sentence fun morning greeting]

Here's what's worth lacing up your boots for today:

🥾 [Trail/Activity Name] — [distance or duration] — [brief why it's great today]
🌿 [Trail/Activity Name] — [distance or duration] — [brief why it's great today]  
🏞️ [Trail/Activity Name] — [distance or duration] — [brief why it's great today]

[Closing tip about best time to go or what to bring]

Keep it under 150 words. Suggest real-sounding trails appropriate for the area and season.`,
        }],
      });

      const content = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
      if (!content) continue;

      await prisma.campfireMessage.create({
        data: { roomId: room.id, isHitch: true, content },
      });

      console.log(`[TrailsCron] Posted morning trails for ${room.campgroundId}`);
    } catch (e) {
      console.error(`[TrailsCron] Failed for ${room.campgroundId}:`, e);
    }
  }
}

export function registerTriviaCrons(io: any) {
  // Monday 5:00 AM — generate this week's questions
  cron.schedule('0 5 * * 1', () => kickoffNewWeek(), { timezone: 'America/Chicago' });

  // Daily 5:25 PM — trivia warning
  cron.schedule('25 7 * * *',  () => postTriviaWarning(), { timezone: 'America/Chicago' });
  cron.schedule('20 12 * * *', () => postTriviaWarning(), { timezone: 'America/Chicago' });
  cron.schedule('25 17 * * *', () => postTriviaWarning(), { timezone: 'America/Chicago' });

  // Daily 5:30–5:57 PM every 3 min — ask questions
  cron.schedule('30,33,36,39,42,45,48,51,54,57 7 * * *',  () => askNextQuestion(io), { timezone: 'America/Chicago' });
  cron.schedule('25,28,31,34,37,40,43,46,49,52 12 * * *', () => askNextQuestion(io), { timezone: 'America/Chicago' });
  cron.schedule('30,33,36,39,42,45,48,51,54,57 17 * * *', () => askNextQuestion(io), { timezone: 'America/Chicago' });

  // Daily leaderboards

  cron.schedule('0 8 * * *',  () => postDailyLeaderboard(io), { timezone: 'America/Chicago' });
  cron.schedule('55 12 * * *', () => postDailyLeaderboard(io), { timezone: 'America/Chicago' });
  cron.schedule('0 18 * * *',  () => postDailyLeaderboard(io), { timezone: 'America/Chicago' });

  // Sunday 6:05 PM — weekly winner
  cron.schedule('5 18 * * 0', () => announceWeeklyWinner(io), { timezone: 'America/Chicago' });

  // Daily 9:00 AM — trip check-in reminder
  cron.schedule('0 9 * * *', () => runTripCheckinReminder(), { timezone: 'America/Chicago' });

  // Hourly — NWS severe weather alerts for checked-in campers (SMS)
  cron.schedule('0 * * * *', async () => {
    runWeatherAlertCron().catch(e => console.error('[WeatherAlert] Cron error:', e));
  }, { timezone: 'America/Chicago' });

  // Daily 9:00 PM — stargazing sky report for checked-in campers
  cron.schedule('0 21 * * *', () => runStargazingCron(), { timezone: 'America/Chicago' });

  // Daily noon — Wallet random chaos (2% chance per user)
  cron.schedule('0 12 * * *', () => runWalletChaosCron(), { timezone: 'America/Chicago' });

  // Daily midnight — expire camp market listings + send feedback reminders
  cron.schedule('0 0 * * *', async () => {
    try {
      // Expire active listings past their date
      const { count } = await prisma.campMarketListing.updateMany({
        where: { isActive: true, expiresAt: { lt: new Date() } },
        data: { isActive: false },
      });
      if (count > 0) console.log(`[CampMarket] Expired ${count} listings`);

      // Send feedback reminders for listings that expired in the last 24h with completed buyers
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentlyExpired = await prisma.campMarketListing.findMany({
        where: {
          completedBuyerId: { not: null },
          expiresAt: { gte: yesterday, lt: new Date() },
        },
        include: {
          user: { select: { id: true, firstName: true } },
          interests: { include: { buyer: { select: { id: true, firstName: true } } } },
        },
      });

      for (const listing of recentlyExpired) {
        const feedbackDeadline = new Date(listing.expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        const deadlineStr = feedbackDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        // Notify seller
        await prisma.basecampActivity.create({
          data: {
            userId: listing.userId, actorId: listing.completedBuyerId!,
            type: 'CAMP_MARKET_FEEDBACK_REMINDER', entityType: 'CAMP_MARKET', entityId: listing.id,
            entityName: listing.title,
            metadata: { feedbackDeadline: feedbackDeadline.toISOString(), message: `How did your trade go? Leave feedback before ${deadlineStr}` },
          },
        }).catch(() => {});

        // Notify buyer
        await prisma.basecampActivity.create({
          data: {
            userId: listing.completedBuyerId!, actorId: listing.userId,
            type: 'CAMP_MARKET_FEEDBACK_REMINDER', entityType: 'CAMP_MARKET', entityId: listing.id,
            entityName: listing.title,
            metadata: { feedbackDeadline: feedbackDeadline.toISOString(), message: `How did your trade go? Leave feedback before ${deadlineStr}` },
          },
        }).catch(() => {});
      }

      if (recentlyExpired.length > 0) console.log(`[CampMarket] Sent feedback reminders for ${recentlyExpired.length} listings`);
    } catch (e) { console.error('[CampMarket] Expire cron error:', e); }
  }, { timezone: 'America/Chicago' });

  // Daily 9 AM — suggest weather-triggered deals to campground owners
  cron.schedule('0 9 * * *', () => {
    suggestWeatherDeals().catch(() => {});
  }, { timezone: 'America/Chicago' });

  // Hourly — expire feed mutes
  cron.schedule('30 * * * *', () => {
    expireFeedMutes().catch(() => {});
  }, { timezone: 'America/Chicago' });

  // Hourly — email drip sequence for new users
  cron.schedule('0 * * * *', () => {
    runEmailDripCron().catch(e => console.error('[EmailDrip] Cron error:', e));
  }, { timezone: 'America/Chicago' });

  console.log('[TriviaCron] All trivia crons registered ✅');
}
