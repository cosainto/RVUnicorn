import { Server, Socket } from 'socket.io';
import { prisma } from '../prisma';

const ROOM = 'road:global';

const activeDrivers = new Map<string, {
  userId: string; firstName: string; profilePicture: string | null;
  campgroundId?: string; campgroundName?: string; tripComplete?: boolean;
}>();

const reviewSessions = new Map<string, {
  campgroundId: string; campgroundName: string;
  stage: 'asked_rating' | 'asked_review' | 'asked_rig' | 'done';
  rating?: number; review?: string;
}>();

let lastChimeAt = 0;

const CHARACTERS = [
  { name: 'Hitch', emoji: '🦄', profilePicture: null,
    personality: "You are Hitch, RVUnicorn's friendly unicorn AI co-pilot. Be warm, encouraging, helpful. Under 120 chars." },
  { name: 'Wallet', emoji: '💰', profilePicture: null,
    personality: "You are Wallet, the chaos gremlin of RVUnicorn. Be mischievous, funny, unpredictable. Under 120 chars." },
  { name: 'Walter', emoji: '🔭', profilePicture: null,
    personality: "You are Walter, RVUnicorn's stargazing enthusiast. Be calm, wise, nature-focused. Under 120 chars." },
  { name: 'Ranger Rick', emoji: '🤠', profilePicture: null,
    personality: "You are Ranger Rick, a seasoned RV road veteran. Be folksy, practical, share road wisdom. Under 120 chars." },
];

async function generateChimeIn(character: typeof CHARACTERS[0], context: { driverCount: number; recentMessages: string[] }): Promise<string> {
  try {
    const pst = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const hour = new Date(pst).getHours();
    const driverCtx = context.driverCount > 1 ? `There are ${context.driverCount} RVers on the road.` : 'An RVer just hit the road.';
    const recentCtx = context.recentMessages.length > 0
      ? `Recent chat: "${context.recentMessages.slice(-2).join(' | ')}". Respond naturally or start new topic.`
      : 'Chat is quiet. Start an engaging conversation.';
    const prompt = `${character.personality} It is ${hour}:00 PST. ${driverCtx} ${recentCtx}\n\nGenerate ONE message under 120 chars for an RV road chat. Topics: road tips, jokes, safety, weather, truck stops, campgrounds. No hashtags, no quotes around response.`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json() as any;
    return data?.content?.[0]?.text?.trim() || '';
  } catch { return ''; }
}

function parseRating(content: string): number | null {
  const m = content.match(/\b([1-5])\b/);
  if (m) return parseInt(m[1]);
  if (/five|5.?star/i.test(content)) return 5;
  if (/four|4.?star/i.test(content)) return 4;
  if (/three|3.?star/i.test(content)) return 3;
  if (/two|2.?star/i.test(content)) return 2;
  if (/one|1.?star/i.test(content)) return 1;
  return null;
}

function parseRigFriendly(content: string): string {
  if (/\byes\b|easy|fine|no.?problem|great/i.test(content)) return 'yes';
  if (/\bno\b|couldn.t|difficult|impossible/i.test(content)) return 'no';
  if (/tight|squeeze|careful|barely/i.test(content)) return 'tight';
  return 'unknown';
}

function isChimeWindow(): boolean {
  const pst = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const d = new Date(pst);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins >= 390 && mins <= 720;
}

function scheduleChimeIn(roadChat: any, recentMessages: string[]) {
  const delay = (Math.floor(Math.random() * 12) + 8) * 60 * 1000;
  setTimeout(async () => {
    if (!isChimeWindow() || activeDrivers.size === 0 || Date.now() - lastChimeAt < 8 * 60 * 1000) {
      scheduleChimeIn(roadChat, recentMessages); return;
    }
    const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    const msg = await generateChimeIn(char, { driverCount: activeDrivers.size, recentMessages });
    if (!msg) { scheduleChimeIn(roadChat, recentMessages); return; }
    lastChimeAt = Date.now();
    roadChat.to(ROOM).emit('message:new', {
      id: `chime-${Date.now()}`, content: `${char.emoji} ${msg}`, isSystem: false,
      isCharacter: true, characterName: char.name, createdAt: new Date().toISOString(),
      user: { id: `char-${char.name}`, firstName: char.name, profilePicture: null },
    });
    scheduleChimeIn(roadChat, recentMessages);
  }, delay);
}

const REVIEW_QUESTIONS: Record<string, string[]> = {
  asked_rating: [
    '🦄 Hope the drive home is smooth! How would you rate your stay — 1 to 5 stars? ⭐',
    '🦄 Heading home? Quick question — how many stars for your campground? (1-5)',
  ],
  asked_review: [
    '🦄 Nice! Anything other RVers should know before they go?',
    '🦄 What stood out most about the stay?',
  ],
  asked_rig: [
    '🦄 Last one — big rig friendly? (Yes / No / Tight fit)',
    '🦄 Was it easy to maneuver a large RV there? Yes, No, or Tight fit?',
  ],
};

function reviewQ(stage: string): string {
  const opts = REVIEW_QUESTIONS[stage] || REVIEW_QUESTIONS['asked_rating'];
  return opts[Math.floor(Math.random() * opts.length)];
}

export function registerRoadChatSockets(io: Server) {
  const roadChat = io.of('/road-chat');
  const recentMessages: string[] = [];
  scheduleChimeIn(roadChat, recentMessages);

  roadChat.on('connection', async (socket: Socket) => {
    const { userId, campgroundId, campgroundName, tripComplete } =
      socket.handshake.query as { userId: string; campgroundId?: string; campgroundName?: string; tripComplete?: string };
    if (!userId) { socket.disconnect(); return; }

    let user: { id: string; firstName: string; lastName: string; profilePicture: string | null; username: string } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true },
      });
    } catch { socket.disconnect(); return; }
    if (!user) { socket.disconnect(); return; }

    socket.join(ROOM);
    activeDrivers.set(socket.id, {
      userId: user.id, firstName: user.firstName, profilePicture: user.profilePicture,
      campgroundId: campgroundId || undefined, campgroundName: campgroundName || undefined,
      tripComplete: tripComplete === 'true',
    });

    roadChat.to(ROOM).emit('drivers:update', { count: activeDrivers.size });
    roadChat.to(ROOM).emit('message:new', {
      id: `sys-${Date.now()}`, content: `🚐 ${user.firstName} joined the road`, isSystem: true,
      createdAt: new Date().toISOString(), user: { id: user.id, firstName: user.firstName, profilePicture: user.profilePicture },
    });

    // Contextual greeting after 2s
    setTimeout(async () => {
      if (!user) return;
      let greeting = '';
      if (tripComplete === 'true' && campgroundId && campgroundName) {
        greeting = reviewQ('asked_rating').replace('your campground', campgroundName);
        reviewSessions.set(socket.id, { campgroundId, campgroundName, stage: 'asked_rating' });
      } else if (campgroundName) {
        greeting = `🦄 Hey ${user.firstName}! Heading to ${campgroundName}? Safe travels — break every 2hrs! 🛡️`;
      } else {
        greeting = `🦄 Hey ${user.firstName}! You've got ${activeDrivers.size} fellow RVers on the road with you!`;
      }
      socket.emit('message:new', {
        id: `greet-${Date.now()}`, content: greeting, isSystem: false,
        isCharacter: true, characterName: 'Hitch', createdAt: new Date().toISOString(),
        user: { id: 'char-Hitch', firstName: 'Hitch', profilePicture: null },
      });
    }, 2000);

    socket.on('message:send', async (data: { content: string }) => {
      if (!data.content?.trim() || !user) return;
      const text = data.content.trim().slice(0, 300);
      roadChat.to(ROOM).emit('message:new', {
        id: `msg-${Date.now()}-${user.id}`, content: text, isSystem: false,
        createdAt: new Date().toISOString(), user: { id: user.id, firstName: user.firstName, profilePicture: user.profilePicture },
      });
      recentMessages.push(`${user.firstName}: ${text}`);
      if (recentMessages.length > 20) recentMessages.shift();

      // @Hitch mention in Road Chat
      if (/@hitch/i.test(text)) {
        setTimeout(async () => {
          try {
            const question = text.replace(/@hitch/gi, '').trim();
            const driverCtx = activeDrivers.size > 1 ? `There are ${activeDrivers.size} RVers on the road right now.` : '';
            const prompt = `You are Hitch, the RVUnicorn unicorn AI co-pilot. ${user!.firstName} asked while driving: "${question}"
${driverCtx}
Reply in 1-2 friendly sentences. Be helpful, RV-specific, and safety-conscious. Under 200 chars.`;
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
            });
            const aiData = await res.json() as any;
            const reply = aiData?.content?.[0]?.text?.trim();
            if (reply) {
              roadChat.to(ROOM).emit('message:new', {
                id: `hitch-reply-${Date.now()}`, content: `🦄 ${reply}`,
                isSystem: false, isCharacter: true, characterName: 'Hitch',
                createdAt: new Date().toISOString(),
                user: { id: 'char-Hitch', firstName: 'Hitch', profilePicture: null },
              });
            }
          } catch (e) { console.error('[RoadChat @Hitch] error:', e); }
        }, 1000);
      }

      const rs = reviewSessions.get(socket.id);
      if (rs && rs.stage !== 'done') {
        setTimeout(async () => {
          if (!user) return;
          if (rs.stage === 'asked_rating') {
            const rating = parseRating(text);
            if (rating) {
              rs.rating = rating; rs.stage = 'asked_review';
              socket.emit('message:new', { id: `rv-${Date.now()}`, content: reviewQ('asked_review'), isSystem: false, isCharacter: true, characterName: 'Hitch', createdAt: new Date().toISOString(), user: { id: 'char-Hitch', firstName: 'Hitch', profilePicture: null } });
            } else {
              socket.emit('message:new', { id: `rv-${Date.now()}`, content: `🦄 Just a number 1-5! How many stars for ${rs.campgroundName}? ⭐`, isSystem: false, isCharacter: true, characterName: 'Hitch', createdAt: new Date().toISOString(), user: { id: 'char-Hitch', firstName: 'Hitch', profilePicture: null } });
            }
          } else if (rs.stage === 'asked_review') {
            rs.review = text; rs.stage = 'asked_rig';
            socket.emit('message:new', { id: `rv-${Date.now()}`, content: reviewQ('asked_rig'), isSystem: false, isCharacter: true, characterName: 'Hitch', createdAt: new Date().toISOString(), user: { id: 'char-Hitch', firstName: 'Hitch', profilePicture: null } });
          } else if (rs.stage === 'asked_rig') {
            rs.stage = 'done';
            const rigFriendly = parseRigFriendly(text);
            try {
              await (prisma.campgroundReview as any).upsert({
                where: { campgroundId_userId: { campgroundId: rs.campgroundId, userId: user!.id } },
                update: { rating: rs.rating || 4, review: rs.review || null, bigRigFriendly: rigFriendly, visitDate: new Date() },
                create: { campgroundId: rs.campgroundId, userId: user!.id, rating: rs.rating || 4, review: rs.review || null, bigRigFriendly: rigFriendly, visitDate: new Date() },
              });
              socket.emit('message:new', { id: `rv-${Date.now()}`, content: `🦄 Thanks ${user!.firstName}! Review of ${rs.campgroundName} saved — fellow RVers will love it! 🏠`, isSystem: false, isCharacter: true, characterName: 'Hitch', createdAt: new Date().toISOString(), user: { id: 'char-Hitch', firstName: 'Hitch', profilePicture: null } });
              reviewSessions.delete(socket.id);
            } catch (e) { console.error('[RoadChat] Review save error:', e); }
          }
        }, 1500);
      }
    });

    socket.on('disconnect', () => {
      activeDrivers.delete(socket.id);
      reviewSessions.delete(socket.id);
      roadChat.to(ROOM).emit('drivers:update', { count: activeDrivers.size });
      if (user) {
        roadChat.to(ROOM).emit('message:new', {
          id: `sys-${Date.now()}`, content: `🏕️ ${user.firstName} pulled over`, isSystem: true,
          createdAt: new Date().toISOString(), user: { id: user.id, firstName: user.firstName, profilePicture: user.profilePicture },
        });
      }
    });
  });
}
