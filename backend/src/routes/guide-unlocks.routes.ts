import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function evaluateUnlocks(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { rvType: true, rvLength: true, rvMake: true, campingInterests: true }
  });
  if (!user) return {};

  const [reviewCount, followCount, wishlistCount, tripCount] = await Promise.all([
    prisma.campgroundReview.count({ where: { userId } }).catch(() => 0),
    prisma.campgroundFollow.count({ where: { userId } }).catch(() => 0),
    prisma.campgroundWishlist.count({ where: { userId } }).catch(() => 0),
    prisma.event.count({ where: { organizerId: userId } }).catch(() => 0),
  ]);

  const uniqueCheckIns = await prisma.checkIn.findMany({
    where: { userId, campgroundId: { not: null } },
    select: { campgroundId: true },
    distinct: ["campgroundId"],
  }).catch(() => []);
  const uniqueCamps = uniqueCheckIns.length;

  const hasRvSpecs = !!(user.rvType && user.rvLength && user.rvMake);
  const interests = (user.campingInterests as string[] || []);
  const hasPetInterest = interests.some((i: string) =>
    ["pet","dog","cat","family","kids"].some(k => i.toLowerCase().includes(k))
  );
  const hasInterests = interests.length >= 5;

  return {
    hitch:         { unlocked: true, conditions: [] },
    diesel:        {
      unlocked: hasRvSpecs && reviewCount >= 5,
      conditions: [
        { label: "Complete RV specs (type, length, make)", met: hasRvSpecs, current: hasRvSpecs ? 1 : 0, required: 1 },
        { label: "Submit 5 Campground Reports", met: reviewCount >= 5, current: reviewCount, required: 5 },
      ],
    },
    walter:        {
      unlocked: reviewCount >= 10 && followCount >= 10,
      conditions: [
        { label: "Submit 10 Campground Reports", met: reviewCount >= 10, current: reviewCount, required: 10 },
        { label: "Follow 10 campgrounds", met: followCount >= 10, current: followCount, required: 10 },
      ],
    },
    luna:          {
      unlocked: hasPetInterest && uniqueCamps >= 5 && reviewCount >= 3,
      conditions: [
        { label: "Add pets/family to camping interests", met: hasPetInterest, current: hasPetInterest ? 1 : 0, required: 1 },
        { label: "Check in at 5 different campgrounds", met: uniqueCamps >= 5, current: uniqueCamps, required: 5 },
        { label: "Submit 3 Campground Reports", met: reviewCount >= 3, current: reviewCount, required: 3 },
      ],
    },
    scout:         {
      unlocked: uniqueCamps >= 8 && tripCount >= 3,
      conditions: [
        { label: "Check in at 8 different campgrounds", met: uniqueCamps >= 8, current: uniqueCamps, required: 8 },
        { label: "Plan 3 trips", met: tripCount >= 3, current: tripCount, required: 3 },
      ],
    },
    rose:          {
      unlocked: wishlistCount >= 15 && followCount >= 10 && reviewCount >= 5,
      conditions: [
        { label: "Add 15 campgrounds to wishlist", met: wishlistCount >= 15, current: wishlistCount, required: 15 },
        { label: "Follow 10 campgrounds", met: followCount >= 10, current: followCount, required: 10 },
        { label: "Submit 5 Campground Reports", met: reviewCount >= 5, current: reviewCount, required: 5 },
      ],
    },
    holden_hannah: {
      unlocked: uniqueCamps >= 5 && reviewCount >= 3 && hasInterests,
      conditions: [
        { label: "Check in at 5 campgrounds", met: uniqueCamps >= 5, current: uniqueCamps, required: 5 },
        { label: "Submit 3 Campground Reports", met: reviewCount >= 3, current: reviewCount, required: 3 },
        { label: "Select 5+ camping interests", met: hasInterests, current: interests.length, required: 5 },
      ],
    },
  };
}

// GET /api/guide-unlocks
router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const unlocks = await evaluateUnlocks(req.user?.id);
    res.json(unlocks);
  } catch (e: any) {
    res.status(500).json({ error: "Failed" });
  }
});

const CHIME_PERSONAS: Record<string, string> = {
  walter:        "You are Walter, a funny grumpy veteran RVer. 1-2 sentences max, dry humor, always end with something useful. No profanity.",
  diesel:        "You are Diesel Dave, big rig expert. 1-2 sentences, direct and technical. Lead with a rig or access insight.",
  rose:          "You are Rose Merlot, glamping guru. 1-2 sentences, enthusiastic. Mention aesthetics or a winery if relevant.",
  scout:         "You are Scout, adventure trailblazer. 1-2 sentences, high energy. Mention trails or outdoor activities.",
  luna:          "You are Luna, family and pet expert. 1-2 sentences, warm. Highlight family or pet angle.",
  holden_hannah: "You are Holden and Hannah, Junior Rangers (enthusiastic kids). 1-2 sentences, excited and playful.",
};

const DATA_QUESTIONS: { field: string; check: (u: any) => boolean; guideId: string; question: string }[] = [
  { field: "rvType",    check: u => !u.rvType,   guideId: "diesel",
    question: "Hey quick question from Diesel Dave — what kind of rig are you rolling in? Class A, Class C, fifth wheel? Knowing this helps me flag campgrounds that might be too tight for you." },
  { field: "rvLength",  check: u => !u.rvLength, guideId: "diesel",
    question: "Diesel Dave here — what is your rig length? Even a rough number helps us give you way better access warnings." },
  { field: "state",     check: u => !u.state,    guideId: "scout",
    question: "Scout here! Where are you based? Knowing your home state helps me find the best adventure campgrounds within a solid drive for you." },
  { field: "interests", check: u => !(u.campingInterests?.length >= 3), guideId: "hitch",
    question: "I want to give you better recommendations! What are your top camping interests — hiking, fishing, wine country, boondocking, family fun? Tell me a few and I will remember them." },
];

// POST /api/guide-unlocks/chime-in
router.post("/chime-in", async (req: any, res) => {
  try {
    const { message, hitchResponse, campgroundContext, userId } = req.body;

    // 17% chance
    if (Math.random() > 0.17) return res.json({ chimeIn: null });

    let unlockedGuides: string[] = ["hitch"];
    let lockedGuides: string[] = [];
    let userProfile: any = null;
    let unlockData: any = {};

    if (userId) {
      [unlockData, userProfile] = await Promise.all([
        evaluateUnlocks(userId),
        prisma.user.findUnique({
          where: { id: userId },
          select: { rvType: true, rvLength: true, campingInterests: true }
        }).catch(() => null),
      ]);
      unlockedGuides = Object.entries(unlockData).filter(([,v]: any) => v.unlocked).map(([k]) => k);
      lockedGuides   = Object.entries(unlockData).filter(([,v]: any) => !v.unlocked).map(([k]) => k);
    }

    // 35% chance to ask a data-collecting question
    if (userProfile && Math.random() < 0.35) {
      const missing = DATA_QUESTIONS.find(q => q.check(userProfile));
      if (missing) {
        const guide = unlockedGuides.includes(missing.guideId) ? missing.guideId : "hitch";
        return res.json({
          chimeIn: { guideId: guide, content: missing.question, type: "data_collect", unlocked: true }
        });
      }
    }

    // 60% unlocked guide, 40% locked guide (teaser)
    const useUnlocked = Math.random() < 0.6 || lockedGuides.length === 0;
    const pool = useUnlocked
      ? unlockedGuides.filter(g => g !== "hitch")
      : lockedGuides;
    if (pool.length === 0) return res.json({ chimeIn: null });

    const guideId = pool[Math.floor(Math.random() * pool.length)];
    const isUnlocked = unlockedGuides.includes(guideId);
    const persona = CHIME_PERSONAS[guideId];
    if (!persona) return res.json({ chimeIn: null });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: `${persona}

The user just asked Hitch: "${message}"
Hitch responded: "${(hitchResponse || "").substring(0, 200)}"
${campgroundContext ? "Campground: " + campgroundContext : ""}

Chime in with 1-2 sentences in your character voice. Options: add useful info Hitch missed, make a funny observation, or ask one useful question about the user. Do NOT repeat what Hitch said. Be brief and punchy.`
      }],
    });

    const content = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (!content) return res.json({ chimeIn: null });

    const lockProgress = !isUnlocked && unlockData[guideId]
      ? unlockData[guideId].conditions : null;

    res.json({
      chimeIn: { guideId, content, type: "organic", unlocked: isUnlocked, lockProgress }
    });
  } catch (e: any) {
    console.error("Chime-in error:", e?.message);
    res.json({ chimeIn: null });
  }
});


// POST /api/guide-unlocks/check-and-notify
// Call this after any action that could trigger an unlock (review, checkin, wishlist, follow)
router.post('/check-and-notify', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.json({ unlocked: [] });

    const unlocks = await evaluateUnlocks(userId);

    const GUIDE_NAMES: Record<string, string> = {
      diesel: 'Diesel Dave',
      walter: 'Walter',
      luna: 'Luna',
      scout: 'Scout',
      rose: 'Rose Merlot',
      holden_hannah: 'Holden & Hannah',
    };

    const GUIDE_EMOJIS: Record<string, string> = {
      diesel: '🚛', walter: '🎭', luna: '🌙',
      scout: '🏔️', rose: '🍷', holden_hannah: '🏕️',
    };

    // Check which guides just became unlocked that we havent notified about
    const newlyUnlocked: string[] = [];
    for (const [guideId, data] of Object.entries(unlocks) as any[]) {
      if (guideId === 'hitch' || !data.unlocked) continue;

      // Check if we already sent this notification
      const existing = await prisma.notification.findFirst({
        where: { userId, type: 'GUIDE_UNLOCKED', link: `/hitch?guide=${guideId}` }
      }).catch(() => null);

      if (!existing) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'GUIDE_UNLOCKED',
            content: `${GUIDE_EMOJIS[guideId]} You unlocked ${GUIDE_NAMES[guideId]}! Head to Hitch AI to chat with your new guide.`,
            link: `/hitch?guide=${guideId}`,
          }
        }).catch(() => null);
        newlyUnlocked.push(guideId);
      }
    }

    res.json({ unlocked: newlyUnlocked, unlocks });
  } catch (e: any) {
    res.json({ unlocked: [] });
  }
});

export default router;
