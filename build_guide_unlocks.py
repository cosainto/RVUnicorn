#!/usr/bin/env python3
"""
RVUnicorn Guide Unlocks + Random Chime-In System
Run from project root: python3 build_guide_unlocks.py
"""
import os

ROOT = os.getcwd()
FRONTEND = os.path.join(ROOT, 'frontend/src')
BACKEND = os.path.join(ROOT, 'backend/src')

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  OK {path.replace(ROOT+"/", "")}')

def patch(path, old, new, label=''):
    with open(path, 'r') as f:
        content = f.read()
    if old not in content:
        print(f'  WARN Could not patch [{label}] in {path.replace(ROOT+"/", "")}')
        return False
    with open(path, 'w') as f:
        f.write(content.replace(old, new, 1))
    print(f'  OK Patched [{label}]')
    return True

print('\n RVUnicorn Guide Unlocks + Chime-In\n')

# BACKEND: guide-unlocks.routes.ts
print('Backend: guide-unlocks.routes.ts')
write(f'{BACKEND}/routes/guide-unlocks.routes.ts', '''import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth";

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
    prisma.wishlist.count({ where: { userId } }).catch(() => 0),
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
          select: { rvType: true, rvLength: true, campingInterests: true, state: true }
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

export default router;
''')

# FRONTEND: useGuideUnlocks hook
print('Frontend: useGuideUnlocks hook')
write(f'{FRONTEND}/hooks/useGuideUnlocks.ts', '''import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export interface UnlockCondition {
  label: string;
  met: boolean;
  current: number;
  required: number;
}

export interface GuideUnlock {
  unlocked: boolean;
  conditions: UnlockCondition[];
}

export type UnlockMap = Record<string, GuideUnlock>;

export function useGuideUnlocks() {
  const { user } = useAuth();
  const [unlocks, setUnlocks] = useState<UnlockMap>({ hitch: { unlocked: true, conditions: [] } });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.get("/guide-unlocks")
      .then(r => setUnlocks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const isUnlocked = (guideId: string) => {
    if (guideId === "hitch") return true;
    return unlocks[guideId]?.unlocked ?? false;
  };

  const getProgress = (guideId: string): UnlockCondition[] => {
    return unlocks[guideId]?.conditions ?? [];
  };

  return { unlocks, loading, isUnlocked, getProgress };
}
''')

# FRONTEND: GuideUnlockPanel component
print('Frontend: GuideUnlockPanel component')
write(f'{FRONTEND}/components/GuideUnlockPanel.tsx', '''import { Lock, CheckCircle, ChevronRight } from "lucide-react";
import { GUIDES } from "../config/hitchGuides";
import { useGuideUnlocks } from "../hooks/useGuideUnlocks";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";

export default function GuideUnlockPanel() {
  const { user } = useAuth();
  const { isUnlocked, getProgress } = useGuideUnlocks();

  if (!user) return (
    <div className="text-center py-8">
      <p className="text-gray-500 text-sm">Sign in to see your guide unlocks.</p>
    </div>
  );

  const unlocked = GUIDES.filter(g => isUnlocked(g.id));
  const locked   = GUIDES.filter(g => !isUnlocked(g.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Your AI Guides</h2>
        <p className="text-sm text-gray-500">Unlock guides by being an active member of the RVUnicorn community.</p>
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Unlocked ({unlocked.length})</p>
          <div className="grid grid-cols-2 gap-2">
            {unlocked.map(g => (
              <div key={g.id} className="flex items-center gap-2 bg-white border border-green-200 rounded-xl px-3 py-2.5">
                {g.avatarUrl
                  ? <img src={g.avatarUrl} className="w-8 h-8 rounded-full object-cover" alt={g.name} />
                  : <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${g.bgGradient} flex items-center justify-center text-sm`}>{g.emoji}</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{g.name}</p>
                  <p className="text-xs text-green-600 font-medium">Unlocked</p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Locked ({locked.length})</p>
          <div className="space-y-3">
            {locked.map(g => {
              const conditions = getProgress(g.id);
              const metCount = conditions.filter(c => c.met).length;
              const pct = conditions.length > 0 ? Math.round((metCount / conditions.length) * 100) : 0;
              return (
                <div key={g.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative shrink-0">
                      {g.avatarUrl
                        ? <img src={g.avatarUrl} className="w-12 h-12 rounded-full object-cover opacity-40 grayscale" alt={g.name} />
                        : <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl opacity-40">{g.emoji}</div>
                      }
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-gray-500" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{g.name}</p>
                      <p className="text-xs text-gray-500 mb-1">{g.tagline}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-primary-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-400">{pct}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {conditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {c.met
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        }
                        <span className={`text-xs ${c.met ? "text-green-700 line-through" : "text-gray-600"}`}>
                          {c.label}{!c.met && c.required > 1 ? ` (${c.current}/${c.required})` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            <strong>Pro tip:</strong> Submit Campground Reports after your stays — they count toward unlocking Walter, Diesel Dave, Luna, and more.
            <Link to="/campgrounds" className="block mt-1 text-amber-700 font-semibold underline">Browse campgrounds to get started</Link>
          </div>
        </div>
      )}
    </div>
  );
}
''')

# FRONTEND: Patch HitchFloatingChat
print('Frontend: Patching HitchFloatingChat...')
chat_path = f'{FRONTEND}/components/HitchFloatingChat.tsx'
with open(chat_path, 'r') as f:
    chat = f.read()

# 1. Add imports
old_imp = 'import { GUIDES, DEFAULT_GUIDE_ID, getGuide, type Guide } from "../config/hitchGuides";'
new_imp = '''import { GUIDES, DEFAULT_GUIDE_ID, getGuide, type Guide } from "../config/hitchGuides";
import { useGuideUnlocks } from "../hooks/useGuideUnlocks";
import { Lock } from "lucide-react";'''
chat = chat.replace(old_imp, new_imp, 1)

# 2. Add hook after guide const
old_g = '  const guide = getGuide(selectedGuideId);'
new_g = '  const guide = getGuide(selectedGuideId);\n  const { isUnlocked, getProgress } = useGuideUnlocks();'
chat = chat.replace(old_g, new_g, 1)

# 3. Chime-in state
old_fb = '  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});'
new_fb = '  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});\n  const [chimeIns, setChimeIns] = useState<Record<number, any>>({});'
chat = chat.replace(old_fb, new_fb, 1)

# 4. Chime-in fetch after reply
old_reply = '      const reply = { role: "assistant" as const, content: data.message, suggestions: data.suggestions || [] };\n      setMessages(prev => [...prev, reply]);\n      if (!open) setUnread(n => n + 1);'
new_reply = '''      const reply = { role: "assistant" as const, content: data.message, suggestions: data.suggestions || [] };
      setMessages(prev => [...prev, reply]);
      if (!open) setUnread(n => n + 1);
      try {
        const chimeRes = await api.post("/guide-unlocks/chime-in", {
          message: msg,
          hitchResponse: data.message,
          userId: (user as any)?.id,
        });
        if (chimeRes.data?.chimeIn) {
          setChimeIns(prev => ({ ...prev, [newMessages.length]: chimeRes.data.chimeIn }));
        }
      } catch {}'''
chat = chat.replace(old_reply, new_reply, 1)

# 5. Lock-aware guide selector button
old_sel = '                <button key={g.id}\n                  onClick={() => { if (g.id === "hitch" || isUnlocked(g.id)) { selectGuide(g); } }}'
if old_sel not in chat:
    old_sel2 = '                <button key={g.id} onClick={() => selectGuide(g)}'
    new_sel2 = '                <button key={g.id} onClick={() => { if (g.id === "hitch" || isUnlocked(g.id)) selectGuide(g); }}'
    chat = chat.replace(old_sel2, new_sel2, 1)
    print('  OK guide selector made lock-aware')

# 6. Lock badge next to active badge
old_active = '                  {g.id === selectedGuideId && <span className="text-xs font-bold" style={{ color: g.accentColor }}>Active</span>}'
new_active = '''                  {g.id === selectedGuideId && <span className="text-xs font-bold" style={{ color: g.accentColor }}>Active</span>}
                  {g.id !== "hitch" && !isUnlocked(g.id) && (
                    <div className="flex items-center gap-0.5 ml-auto">
                      <Lock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">{getProgress(g.id).filter(c => c.met).length}/{getProgress(g.id).length}</span>
                    </div>
                  )}'''
chat = chat.replace(old_active, new_active, 1)

# 7. Chime-in bubbles after each assistant message — inject before suggestions map
old_sugg = '                      {msg.suggestions?.map((s, j) => ('
new_sugg = '''                      {msg.role === "assistant" && chimeIns[i - 1] && (() => {
                        const chime = chimeIns[i - 1];
                        const cg = getGuide(chime.guideId);
                        return (
                          <div className={`mt-2 rounded-xl border p-2.5 text-xs leading-relaxed ${chime.unlocked ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200"}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              {cg.avatarUrl
                                ? <img src={cg.avatarUrl} className={`w-5 h-5 rounded-full object-cover ${!chime.unlocked ? "grayscale opacity-50" : ""}`} alt={cg.name} />
                                : <span>{cg.emoji}</span>
                              }
                              <span className="font-bold text-gray-700">{cg.name}</span>
                              {!chime.unlocked && <Lock className="w-3 h-3 text-gray-400" />}
                            </div>
                            {chime.unlocked ? (
                              <p className="text-gray-700">{chime.content}</p>
                            ) : (
                              <div className="relative">
                                <p className="text-gray-300 blur-sm select-none pointer-events-none">{chime.content}</p>
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                  <Lock className="w-3.5 h-3.5 text-gray-500" />
                                  <p className="text-xs text-gray-600 font-semibold">Unlock {cg.name}</p>
                                  {chime.lockProgress && (
                                    <p className="text-xs text-gray-400">{chime.lockProgress.filter((c: any) => c.met).length}/{chime.lockProgress.length} done</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {msg.suggestions?.map((s, j) => ('''
chat = chat.replace(old_sugg, new_sugg, 1)

with open(chat_path, 'w') as f:
    f.write(chat)
print('  OK HitchFloatingChat patched')

# BACKEND index.ts: register guide-unlocks
print('Backend: registering guide-unlocks')
index_path = f'{BACKEND}/index.ts'
with open(index_path, 'r') as f:
    idx = f.read()

if 'guide-unlocks' not in idx:
    idx = idx.replace(
        "import hitchGuidesRoutes from './routes/hitch-guides.routes';",
        "import hitchGuidesRoutes from './routes/hitch-guides.routes';\nimport guideUnlocksRoutes from './routes/guide-unlocks.routes';",
        1
    )
    lines = idx.split('\n')
    for i, line in enumerate(lines):
        if "app.use('/api/hitch', hitchGuidesRoutes);" in line:
            lines.insert(i + 1, "app.use('/api/guide-unlocks', guideUnlocksRoutes);")
            break
    idx = '\n'.join(lines)
    with open(index_path, 'w') as f:
        f.write(idx)
    print('  OK guide-unlocks registered')
else:
    print('  INFO already registered')

# HitchAIPage: add My Guides tab
print('Frontend: adding My Guides tab to HitchAIPage')
hitch_page = f'{FRONTEND}/pages/HitchAIPage.tsx'
with open(hitch_page, 'r') as f:
    hp = f.read()

if 'GuideUnlockPanel' not in hp:
    hp = hp.replace(
        "import { useState } from 'react';",
        "import { useState } from 'react';\nimport GuideUnlockPanel from '../components/GuideUnlockPanel';",
        1
    )
    hp = hp.replace(
        "  { id: 'foryou', label: 'For You' },",
        "  { id: 'foryou', label: 'For You' },\n  { id: 'guides', label: 'My Guides' },",
        1
    )
    hp = hp.replace(
        "{activeTab === 'foryou' && <CampersLikeYou />}",
        "{activeTab === 'foryou' && <CampersLikeYou />}\n      {activeTab === 'guides' && <GuideUnlockPanel />}",
        1
    )
    with open(hitch_page, 'w') as f:
        f.write(hp)
    print('  OK My Guides tab added')
else:
    print('  INFO already added')

print('\n' + '-'*50)
print('Done! Run:\n')
print('cd ~/Downloads/kindletribe-mvp && git add -A && git commit -m "feat: guide unlock system + chime-in" && git push')
