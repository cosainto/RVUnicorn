#!/usr/bin/env python3
"""
RVUnicorn - Master Build Script Phase 4-9
Features:
  1. Push notifications for guide unlocks
  2. Campground Report leaderboard
  3. Hitch profile page summary
  4. Trip AI co-pilot (rig stress + fuel + weather warnings)
  5. Predictive campsite selection
  6. AI trip recap generator
  7. Onboarding AI flow
  8. Weekly camping digest email

Run from project root: python3 build_phase4.py
"""
import os, re

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
        print(f'  WARN [{label}] not found in {path.replace(ROOT+"/", "")}')
        return False
    with open(path, 'w') as f:
        f.write(content.replace(old, new, 1))
    print(f'  OK [{label}]')
    return True

def append_route(path, new_route):
    with open(path, 'r') as f:
        content = f.read()
    content = content.replace('export default router;', new_route + '\nexport default router;')
    with open(path, 'w') as f:
        f.write(content)

print('\nRVUnicorn Phase 4-9 Master Build\n')

# =============================================================
# FEATURE 1: Guide Unlock Push Notifications
# =============================================================
print('Feature 1: Guide Unlock Notifications')

# Backend: check and fire notification when unlock threshold crossed
append_route(f'{BACKEND}/routes/guide-unlocks.routes.ts', '''
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
''')
print('  OK guide unlock notification route added')

# Frontend: hook to check unlocks after key actions
write(f'{FRONTEND}/hooks/useUnlockCheck.ts', '''import { useCallback } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// Call this after submitting a review, checkin, wishlist, follow, or updating RV profile
// It will fire a notification if a new guide was just unlocked
export function useUnlockCheck() {
  const { user } = useAuth();

  const checkUnlocks = useCallback(async () => {
    if (!user) return [];
    try {
      const { data } = await api.post("/guide-unlocks/check-and-notify");
      if (data.unlocked?.length > 0) {
        // Small delay then show a toast-style celebration
        setTimeout(() => {
          const guideNames: Record<string, string> = {
            diesel: "Diesel Dave 🚛", walter: "Walter 🎭", luna: "Luna 🌙",
            scout: "Scout 🏔️", rose: "Rose Merlot 🍷", holden_hannah: "Holden & Hannah 🏕️",
          };
          data.unlocked.forEach((id: string) => {
            if (guideNames[id]) {
              // Dispatch a custom event that the notification system can listen to
              window.dispatchEvent(new CustomEvent("guide-unlocked", {
                detail: { guideId: id, name: guideNames[id] }
              }));
            }
          });
        }, 500);
      }
      return data.unlocked || [];
    } catch {
      return [];
    }
  }, [user]);

  return { checkUnlocks };
}
''')
print('  OK useUnlockCheck hook written')

# Frontend: GuideUnlockToast component
write(f'{FRONTEND}/components/GuideUnlockToast.tsx', '''import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { GUIDES, getGuide } from "../config/hitchGuides";

interface UnlockEvent {
  guideId: string;
  name: string;
}

export default function GuideUnlockToast() {
  const [toasts, setToasts] = useState<(UnlockEvent & { id: number })[]>([]);
  let counter = 0;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as UnlockEvent;
      const id = ++counter;
      setToasts(prev => [...prev, { ...detail, id }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    };
    window.addEventListener("guide-unlocked", handler);
    return () => window.removeEventListener("guide-unlocked", handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {toasts.map(toast => {
        const guide = getGuide(toast.guideId);
        return (
          <div key={toast.id}
            className={`flex items-center gap-3 bg-gradient-to-r ${guide.bgGradient} text-white rounded-2xl shadow-2xl px-4 py-3 w-72 animate-slide-in`}>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              {guide.avatarUrl
                ? <img src={guide.avatarUrl} className="w-full h-full rounded-full object-cover" alt={guide.name} />
                : <span className="text-xl">{guide.emoji}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Guide Unlocked!</p>
              <p className="text-xs text-white/80 truncate">{toast.name} is ready to chat</p>
            </div>
            <div className="flex items-center gap-1">
              <Link to="/hitch" className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg font-semibold transition">
                Chat
              </Link>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-white/70 hover:text-white p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
''')
print('  OK GuideUnlockToast component written')

# =============================================================
# FEATURE 2: Campground Report Leaderboard
# =============================================================
print('Feature 2: Campground Report Leaderboard')

write(f'{FRONTEND}/components/CampgroundReportLeaderboard.tsx', '''import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trophy, Star } from "lucide-react";
import api from "../services/api";

interface LeaderEntry {
  userId: string;
  username: string;
  firstName: string;
  profilePicture: string | null;
  reportCount: number;
  rank: number;
}

export default function CampgroundReportLeaderboard({ campgroundId, compact = false }: { campgroundId?: string; compact?: boolean }) {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/hitch/report-leaderboard${campgroundId ? "?campgroundId=" + campgroundId : ""}`)
      .then(r => setLeaders(r.data.leaders || []))
      .catch(() => setLeaders([]))
      .finally(() => setLoading(false));
  }, [campgroundId]);

  const RANK_CONFIG = [
    { icon: "🥇", color: "text-amber-500" },
    { icon: "🥈", color: "text-gray-400" },
    { icon: "🥉", color: "text-amber-700" },
  ];

  if (loading) return <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />;
  if (leaders.length === 0) return null;

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 ${compact ? "p-3" : "p-5"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className={`font-bold text-gray-900 ${compact ? "text-sm" : "text-base"}`}>
          {campgroundId ? "Top Contributors" : "Report Leaderboard"}
        </h3>
      </div>
      <div className="space-y-2">
        {leaders.slice(0, compact ? 3 : 10).map((entry, i) => {
          const rank = RANK_CONFIG[i] || { icon: `${i+1}`, color: "text-gray-500" };
          return (
            <div key={entry.userId} className="flex items-center gap-2.5">
              <span className={`text-lg w-6 text-center shrink-0 ${rank.color}`}>{rank.icon}</span>
              {entry.profilePicture
                ? <img src={entry.profilePicture} className="w-7 h-7 rounded-full object-cover shrink-0" alt={entry.firstName} />
                : <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600 shrink-0">{entry.firstName[0]}</div>
              }
              <Link to={`/profile/${entry.username}`} className="flex-1 text-sm font-medium text-gray-800 hover:text-primary-600 transition truncate">
                {entry.firstName}
              </Link>
              <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                {entry.reportCount} report{entry.reportCount !== 1 ? "s" : ""}
              </div>
            </div>
          );
        })}
      </div>
      {!compact && (
        <p className="text-xs text-gray-400 mt-3 text-center">Submit Campground Reports to climb the ranks</p>
      )}
    </div>
  );
}
''')
print('  OK CampgroundReportLeaderboard component written')

# Backend: leaderboard route
hitch_guides_path = f'{BACKEND}/routes/hitch-guides.routes.ts'
with open(hitch_guides_path, 'r') as f:
    gc = f.read()

leaderboard_route = '''
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
'''

if 'report-leaderboard' not in gc:
    gc = gc.replace('export default router;', leaderboard_route + '\nexport default router;')
    with open(hitch_guides_path, 'w') as f:
        f.write(gc)
    print('  OK report-leaderboard route added')
else:
    print('  INFO already exists')

# =============================================================
# FEATURE 3: Hitch Profile Summary
# =============================================================
print('Feature 3: Hitch Profile Summary')

write(f'{FRONTEND}/components/HitchProfileSummary.tsx', '''import { useState, useEffect } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import api from "../services/api";

export default function HitchProfileSummary({ username }: { username: string }) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get(`/hitch/profile-summary/${username}`)
      .then(r => setSummary(r.data.summary || ""))
      .catch(() => setSummary(""))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return (
    <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-2xl p-4 border border-primary-100">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🦄</span>
        <div className="h-4 bg-primary-200 rounded w-32 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-primary-100 rounded animate-pulse" />
        <div className="h-3 bg-primary-100 rounded w-4/5 animate-pulse" />
      </div>
    </div>
  );

  if (!summary) return null;

  const preview = summary.length > 180 ? summary.substring(0, 180) + "..." : summary;

  return (
    <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-2xl p-4 border border-primary-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🦄</span>
          <span className="text-sm font-bold text-primary-700">Hitch says...</span>
        </div>
        <button onClick={() => {
          setLoading(true);
          api.get(`/hitch/profile-summary/${username}?refresh=1`)
            .then(r => setSummary(r.data.summary || ""))
            .catch(() => {})
            .finally(() => setLoading(false));
        }} className="text-primary-400 hover:text-primary-600 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">
        {expanded ? summary : preview}
      </p>
      {summary.length > 180 && (
        <button onClick={() => setExpanded(e => !e)}
          className="text-xs text-primary-600 font-semibold mt-1 hover:text-primary-800 transition">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
''')
print('  OK HitchProfileSummary component written')

with open(hitch_guides_path, 'r') as f:
    gc = f.read()

profile_summary_route = '''
// GET /api/hitch/profile-summary/:username
router.get('/profile-summary/:username', async (req: any, res) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        firstName: true, state: true, campingInterests: true,
        rvType: true, rvLength: true, rvMake: true,
        createdAt: true,
        _count: { select: { checkIns: true, events: true, campgroundReviews: true } }
      }
    });

    if (!user) return res.status(404).json({ error: 'Not found' });

    const stateVisits = await prisma.stateVisit.findMany({
      where: { userId: (await prisma.user.findUnique({ where: { username }, select: { id: true } }))?.id || '' },
      select: { state: true },
    }).catch(() => []);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `Write a warm, enthusiastic 2-3 sentence summary of this RVUnicorn member's camping journey. Write in second person ("You've..."). Be specific and personal.

Name: ${user.firstName}
Home: ${user.state || 'unknown'}
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
'''

if 'profile-summary' not in gc:
    gc = gc.replace('export default router;', profile_summary_route + '\nexport default router;')
    with open(hitch_guides_path, 'w') as f:
        f.write(gc)
    print('  OK profile-summary route added')
else:
    print('  INFO already exists')

# =============================================================
# FEATURE 4: Trip AI Co-Pilot component
# =============================================================
print('Feature 4: Trip AI Co-Pilot')

write(f'{FRONTEND}/components/TripCopilot.tsx', '''import { useState, useEffect } from "react";
import { AlertTriangle, Fuel, Cloud, ChevronDown, ChevronUp, Loader } from "lucide-react";
import api from "../services/api";

interface CopilotWarning {
  type: "rig" | "fuel" | "weather" | "tip";
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
}

interface TripCopilotProps {
  tripId: string;
  origin: string;
  destination: string;
  campgroundId?: string;
}

const SEVERITY_CONFIG = {
  info:    { bg: "bg-blue-50",   border: "border-blue-200",   icon: "ℹ️",  text: "text-blue-800"   },
  warning: { bg: "bg-amber-50",  border: "border-amber-200",  icon: "⚠️",  text: "text-amber-800"  },
  danger:  { bg: "bg-red-50",    border: "border-red-200",    icon: "🚨",  text: "text-red-800"    },
};

export default function TripCopilot({ tripId, origin, destination, campgroundId }: TripCopilotProps) {
  const [warnings, setWarnings] = useState<CopilotWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!origin || !destination) { setLoading(false); return; }
    api.post("/hitch/trip-copilot", { tripId, origin, destination, campgroundId })
      .then(r => setWarnings(r.data.warnings || []))
      .catch(() => setWarnings([]))
      .finally(() => setLoading(false));
  }, [tripId, origin, destination]);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
      <Loader className="w-4 h-4 animate-spin text-primary-500" />
      Hitch is analyzing your trip...
    </div>
  );

  if (warnings.length === 0) return null;

  const dangerCount = warnings.filter(w => w.severity === "danger").length;
  const warnCount = warnings.filter(w => w.severity === "warning").length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦄</span>
          <div className="text-left">
            <p className="font-bold text-gray-900 text-sm">Hitch Co-Pilot</p>
            <p className="text-xs text-gray-500">
              {dangerCount > 0 ? `${dangerCount} issue${dangerCount > 1 ? "s" : ""} found` :
               warnCount > 0 ? `${warnCount} thing${warnCount > 1 ? "s" : ""} to know` :
               `${warnings.length} tip${warnings.length > 1 ? "s" : ""} for your trip`}
            </p>
          </div>
          {dangerCount > 0 && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{dangerCount} alert</span>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {warnings.map((w, i) => {
            const cfg = SEVERITY_CONFIG[w.severity];
            return (
              <div key={i} className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0 mt-0.5">{cfg.icon}</span>
                  <div>
                    <p className={`text-sm font-bold ${cfg.text}`}>{w.title}</p>
                    <p className={`text-xs mt-0.5 leading-relaxed ${cfg.text} opacity-80`}>{w.detail}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
''')
print('  OK TripCopilot component written')

with open(hitch_guides_path, 'r') as f:
    gc = f.read()

copilot_route = '''
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
'''

if 'trip-copilot' not in gc:
    gc = gc.replace('export default router;', copilot_route + '\nexport default router;')
    with open(hitch_guides_path, 'w') as f:
        f.write(gc)
    print('  OK trip-copilot route added')
else:
    print('  INFO already exists')

# =============================================================
# FEATURE 5: Predictive Campsite Selection
# =============================================================
print('Feature 5: Predictive Campsite Selection')

write(f'{FRONTEND}/components/PredictiveSiteSelector.tsx', '''import { useState } from "react";
import { MapPin, Send } from "lucide-react";
import api from "../services/api";

interface SitePrediction {
  siteNumbers: string[];
  reason: string;
  tips: string[];
  avoidSites: string[];
  avoidReason: string | null;
}

export default function PredictiveSiteSelector({ campgroundId, campgroundName }: { campgroundId: string; campgroundName: string }) {
  const [prediction, setPrediction] = useState<SitePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);

  const getSuggestion = async () => {
    setLoading(true);
    setAsked(true);
    try {
      const { data } = await api.get(`/hitch/site-prediction/${campgroundId}`);
      setPrediction(data);
    } catch {
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  };

  if (!asked) return (
    <button onClick={getSuggestion}
      className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl text-sm font-semibold text-primary-700 transition">
      <MapPin className="w-4 h-4" /> Which site should I book?
    </button>
  );

  if (loading) return (
    <div className="bg-primary-50 rounded-xl p-3 text-sm text-primary-600 flex items-center gap-2 animate-pulse">
      <span>🦄</span> Analyzing community reports for best sites...
    </div>
  );

  if (!prediction) return null;

  return (
    <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🦄</span>
        <p className="font-bold text-primary-800 text-sm">Hitch recommends</p>
      </div>

      {prediction.siteNumbers.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-600 mb-1.5">Best sites to request</p>
          <div className="flex flex-wrap gap-1.5">
            {prediction.siteNumbers.map((s, i) => (
              <span key={i} className="bg-primary-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-700 leading-relaxed">{prediction.reason}</p>

      {prediction.tips?.length > 0 && (
        <div className="space-y-1">
          {prediction.tips.map((tip, i) => (
            <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
              <span className="shrink-0">💡</span>{tip}
            </p>
          ))}
        </div>
      )}

      {prediction.avoidSites?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <p className="text-xs font-bold text-amber-700 mb-1">Sites to avoid</p>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {prediction.avoidSites.map((s, i) => (
              <span key={i} className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
          {prediction.avoidReason && <p className="text-xs text-amber-700">{prediction.avoidReason}</p>}
        </div>
      )}

      <p className="text-xs text-gray-400">Based on community Campground Reports</p>
    </div>
  );
}
''')
print('  OK PredictiveSiteSelector component written')

with open(hitch_guides_path, 'r') as f:
    gc = f.read()

site_pred_route = '''
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
'''

if 'site-prediction' not in gc:
    gc = gc.replace('export default router;', site_pred_route + '\nexport default router;')
    with open(hitch_guides_path, 'w') as f:
        f.write(gc)
    print('  OK site-prediction route added')
else:
    print('  INFO already exists')

# =============================================================
# FEATURE 6: AI Trip Recap Generator
# =============================================================
print('Feature 6: AI Trip Recap Generator')

write(f'{FRONTEND}/components/AITripRecap.tsx', '''import { useState } from "react";
import { Sparkles, Share2, Copy, Check } from "lucide-react";
import api from "../services/api";

interface AITripRecapProps {
  tripId: string;
  tripTitle: string;
  campgroundName?: string;
  startDate: string;
  endDate: string;
  attendeeCount?: number;
  checkInCount?: number;
  photoCount?: number;
  activities?: string[];
}

export default function AITripRecap({ tripId, tripTitle, campgroundName, startDate, endDate, attendeeCount, checkInCount, photoCount, activities }: AITripRecapProps) {
  const [recap, setRecap] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateRecap = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/hitch/trip-recap", {
        tripId, tripTitle, campgroundName, startDate, endDate,
        attendeeCount, checkInCount, photoCount, activities,
      });
      setRecap(data.recap || "");
      setGenerated(true);
    } catch {
      setRecap("Could not generate recap. Try again!");
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  };

  const copyRecap = () => {
    navigator.clipboard.writeText(recap);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareRecap = () => {
    navigator.share?.({ text: recap, title: tripTitle }) || copyRecap();
  };

  if (!generated) return (
    <button onClick={generateRecap} disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
      {loading
        ? <><span className="animate-spin">🦄</span> Generating recap...</>
        : <><Sparkles className="w-4 h-4" /> Generate Trip Recap</>
      }
    </button>
  );

  return (
    <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl border border-primary-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🦄</span>
          <p className="font-bold text-primary-800 text-sm">Your Trip Recap</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copyRecap} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition font-medium">
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
          <button onClick={shareRecap} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition font-medium">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{recap}</p>
      <button onClick={() => { setGenerated(false); setRecap(""); }}
        className="text-xs text-primary-500 hover:text-primary-700 transition">
        Regenerate
      </button>
    </div>
  );
}
''')
print('  OK AITripRecap component written')

with open(hitch_guides_path, 'r') as f:
    gc = f.read()

recap_route = '''
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
'''

if 'trip-recap' not in gc:
    gc = gc.replace('export default router;', recap_route + '\nexport default router;')
    with open(hitch_guides_path, 'w') as f:
        f.write(gc)
    print('  OK trip-recap route added')
else:
    print('  INFO already exists')

# =============================================================
# FEATURE 7: Onboarding AI Flow
# =============================================================
print('Feature 7: Onboarding AI Flow')

write(f'{FRONTEND}/components/HitchOnboarding.tsx', '''import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGE = "Hey there, welcome to RVUnicorn! 🦄 I\'m Hitch, your personal camping companion. I\'d love to get to know you so I can give you the best recommendations. First — what kind of RV are you rolling in? (Class A, Class B, Class C, Fifth Wheel, Travel Trailer, or something else?)";

export default function HitchOnboarding({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_MESSAGE }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});

  const send = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data } = await api.post("/hitch/onboarding-chat", {
        message: msg,
        history: newMessages.slice(-6),
        step,
        collectedData,
      });

      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      if (data.collectedData) setCollectedData(prev => ({ ...prev, ...data.collectedData }));
      if (data.step !== undefined) setStep(data.step);
      if (data.complete) {
        setTimeout(() => onComplete(), 1500);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I had a hiccup! Let\'s keep going — what were you saying?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/hitch.png" alt="Hitch" className="w-10 h-10 rounded-full border-2 border-white/30" />
            <div>
              <p className="font-bold text-white">Meet Hitch</p>
              <p className="text-white/70 text-xs">Setting up your camping profile</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {[0,1,2,3].map(i => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </div>

        <div className="h-72 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "assistant" && (
                <img src="/hitch.png" alt="Hitch" className="w-6 h-6 rounded-full object-cover shrink-0 mt-1" />
              )}
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-primary-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <img src="/hitch.png" alt="Hitch" className="w-6 h-6 rounded-full object-cover shrink-0" />
              <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm text-gray-400">typing...</div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Type your answer..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 transition">
              Send
            </button>
          </div>
          <button onClick={onComplete} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-2 transition">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
''')
print('  OK HitchOnboarding component written')

with open(hitch_guides_path, 'r') as f:
    gc = f.read()

onboarding_route = '''
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
'''

if 'onboarding-chat' not in gc:
    gc = gc.replace('export default router;', onboarding_route + '\nexport default router;')
    with open(hitch_guides_path, 'w') as f:
        f.write(gc)
    print('  OK onboarding-chat route added')
else:
    print('  INFO already exists')

# =============================================================
# FEATURE 8: Weekly Digest Email
# =============================================================
print('Feature 8: Weekly Camping Digest Email')

with open(hitch_guides_path, 'r') as f:
    gc = f.read()

digest_route = '''
// POST /api/hitch/weekly-digest/:userId
// Call this from a cron job (e.g. Railway cron or external scheduler) every Monday
router.post('/weekly-digest/:userId', async (req: any, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true, email: true, state: true,
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
Home state: ${user.state || 'unknown'}

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
    console.error('Weekly digest error:', e?.message);
    res.status(500).json({ error: 'Failed' });
  }
});
'''

if 'weekly-digest' not in gc:
    gc = gc.replace('export default router;', digest_route + '\nexport default router;')
    with open(hitch_guides_path, 'w') as f:
        f.write(gc)
    print('  OK weekly-digest route added')
else:
    print('  INFO already exists')

# =============================================================
# Wire GuideUnlockToast into App.tsx
# =============================================================
print('Frontend: Wiring GuideUnlockToast into App.tsx')
app_path = f'{FRONTEND}/App.tsx'
with open(app_path, 'r') as f:
    app = f.read()

if 'GuideUnlockToast' not in app:
    app = app.replace(
        "import Navbar from './components/Navbar';",
        "import Navbar from './components/Navbar';\nimport GuideUnlockToast from './components/GuideUnlockToast';",
        1
    )
    app = app.replace(
        "{user && <Navbar />}",
        "{user && <Navbar />}\n      <GuideUnlockToast />",
        1
    )
    with open(app_path, 'w') as f:
        f.write(app)
    print('  OK GuideUnlockToast wired into App.tsx')
else:
    print('  INFO already wired')

print('\n' + '='*55)
print('Phase 4-9 complete! Summary of what was built:\n')
print('1. Guide Unlock Notifications - toast + notification record')
print('2. Campground Report Leaderboard - top contributors')
print('3. Hitch Profile Summary - personalized journey recap')
print('4. Trip Co-Pilot - weather/rig/fuel warnings on trip plans')
print('5. Predictive Site Selector - best sites from community data')
print('6. AI Trip Recap - shareable post-trip story generator')
print('7. Hitch Onboarding Flow - profile setup via conversation')
print('8. Weekly Digest Email - personalized Monday email via Resend')
print()
print('New components to wire into pages:')
print('  CampgroundReportLeaderboard -> CampgroundDetailPage (reviews tab)')
print('  HitchProfileSummary         -> ProfilePage (near top)')
print('  TripCopilot                 -> TripDetailPage')
print('  PredictiveSiteSelector      -> CampgroundDetailPage (vibe tab)')
print('  AITripRecap                 -> TripDetailPage (after trip ends)')
print('  HitchOnboarding             -> trigger on first login in App.tsx')
print()
print('Weekly digest: call POST /api/hitch/weekly-digest/:userId from a cron job')
print()
print('Run:\ngit add -A && git commit -m "feat: Phase 4-9 - unlocks, leaderboard, copilot, recap, onboarding, digest" && git push')
