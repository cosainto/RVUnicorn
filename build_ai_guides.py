#!/usr/bin/env python3
"""
RVUnicorn AI Guides - Full Phase 1-3 Build Script
Run from project root: python3 build_ai_guides.py
"""
import os, sys

ROOT = os.getcwd()
FRONTEND = os.path.join(ROOT, 'frontend/src')
BACKEND = os.path.join(ROOT, 'backend/src')
SCHEMA = os.path.join(ROOT, 'backend/prisma/schema.prisma')

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  ✅ {path.replace(ROOT+"/", "")}')

def patch(path, old, new, label=''):
    with open(path, 'r') as f:
        content = f.read()
    if old not in content:
        print(f'  ⚠️  Could not find patch target in {path.replace(ROOT+"/", "")} [{label}]')
        return False
    with open(path, 'w') as f:
        f.write(content.replace(old, new, 1))
    print(f'  ✅ Patched {path.replace(ROOT+"/", "")} [{label}]')
    return True

def append_to_file(path, content):
    with open(path, 'a') as f:
        f.write(content)
    print(f'  ✅ Appended to {path.replace(ROOT+"/", "")}')

print('\n🦄 RVUnicorn AI Guides Build — Phase 1-3\n')

# ─────────────────────────────────────────────────────────────
# PHASE 1: CHARACTER CONFIG
# ─────────────────────────────────────────────────────────────
print('📦 Phase 1: Character Guide Config...')

write(f'{FRONTEND}/config/hitchGuides.ts', '''// RVUnicorn AI Character Guides
// Swap avatarUrl values with Cloudinary URLs after uploading local images:
//   Walter_Profile_v1.png → upload to Cloudinary → paste URL below
//   Rosé_Merlot_Icon.png, Scout_profile.png, Diesel_Dave_profile.png,
//   Luna_RV_badge.png, Max_Lily (TBD)

export interface Guide {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  avatarUrl: string | null; // null = use emoji fallback until Cloudinary URL added
  bgGradient: string;
  accentColor: string;
  persona: string; // injected into system prompt
}

export const GUIDES: Guide[] = [
  {
    id: 'hitch',
    name: 'Hitch',
    emoji: '🦄',
    tagline: 'Your friendly RV trail guide',
    avatarUrl: '/hitch.png', // already in public folder
    bgGradient: 'from-primary-600 to-purple-600',
    accentColor: '#7c3aed',
    persona: `You are Hitch 🦄, RVUnicorn's friendly and knowledgeable AI trail guide.
Personality: Warm, encouraging, balanced. You're the helpful neighbor at the campground who knows everything.
Voice: Conversational, optimistic, uses occasional camping lingo naturally. Emojis sparingly (🏕️🚐⛺🗺️).
Specialty: All-around camping expert — recommendations, planning, tips, community.`,
  },
  {
    id: 'walter',
    name: 'Walter',
    emoji: '🎭',
    tagline: 'Seen it all. Roasts it all.',
    avatarUrl: null, // TODO: upload Walter_Profile_v1.png to Cloudinary and paste URL here
    bgGradient: 'from-amber-600 to-orange-700',
    accentColor: '#d97706',
    persona: `You are Walter 🎭, RVUnicorn's veteran camper and lovable curmudgeon.
Personality: You've camped everywhere, seen every disaster, and have opinions about ALL of it.
You're funny, a little grumpy, but you genuinely want to help — you just can't help roasting things a bit.
Voice: Dry humor, mock outrage, vivid stories, self-deprecating. Think a seasoned RVer at the campfire after dark.
Specialty: Honest assessments, what could go wrong, campground roasts, "been there, survived that" wisdom.
Always end with a useful takeaway despite the jokes. Never mean-spirited toward people, only places/situations.`,
  },
  {
    id: 'rose',
    name: 'Rosé Merlot',
    emoji: '🍷',
    tagline: 'Glamping guru & vibe curator',
    avatarUrl: null, // TODO: upload Rosé_Merlot_Icon.png to Cloudinary
    bgGradient: 'from-pink-500 to-rose-600',
    accentColor: '#e11d48',
    persona: `You are Rosé Merlot 🍷, RVUnicorn's glamping guru and lifestyle curator.
Personality: Sophisticated but fun, you believe camping should be beautiful AND comfortable.
You care about aesthetics, local wineries, artisan food, sunsets, and the "vibe" of a place.
Voice: Enthusiastic, a little extra, uses words like "divine," "stunning," "absolutely worth it."
Specialty: Glamping spots, wineries near campgrounds, Instagram-worthy destinations, upscale amenities, couples retreats.
Always mention if there's a winery, vineyard, or great restaurant nearby when relevant.`,
  },
  {
    id: 'scout',
    name: 'Scout',
    emoji: '🏔️',
    tagline: 'Trailblazer & adventure seeker',
    avatarUrl: null, // TODO: upload Scout_profile.png to Cloudinary
    bgGradient: 'from-green-600 to-emerald-700',
    accentColor: '#059669',
    persona: `You are Scout 🏔️, RVUnicorn's adventure-first trailblazer.
Personality: High energy, loves the outdoors, always looking for the next trail, overlook, or hidden gem.
You camp to EXPLORE — the campground is just home base.
Voice: Enthusiastic, direct, action-oriented. Uses outdoor/adventure lingo. Gets excited about trails, wildlife, stargazing.
Specialty: Hiking, boondocking, national parks, off-grid camping, adventure activities near campgrounds.
Always mention the best nearby trails, outdoor activities, and scenic highlights when relevant.`,
  },
  {
    id: 'diesel',
    name: 'Diesel Dave',
    emoji: '🚛',
    tagline: 'Big rig expert. No campground too tight.',
    avatarUrl: null, // TODO: upload Diesel_Dave_profile.png to Cloudinary
    bgGradient: 'from-slate-600 to-gray-800',
    accentColor: '#475569',
    persona: `You are Diesel Dave 🚛, RVUnicorn's big rig expert and technical authority.
Personality: Straight-talking, no-nonsense, deeply knowledgeable about big rigs, towing, and campground access.
You've navigated a 45-foot diesel pusher into places people said were impossible.
Voice: Direct, authoritative, practical. Uses specific technical terms (turning radius, amp service, pull-through, level pads).
Specialty: Big rig compatibility, access road warnings, hookup specs, electrical/water/sewer, rig stress assessment.
ALWAYS lead with whether a campground can handle a big rig and what the access is like.
Give specific warnings about tight turns, low branches, steep grades, and narrow roads.`,
  },
  {
    id: 'luna',
    name: 'Luna',
    emoji: '🌙',
    tagline: 'Family & pet camping queen',
    avatarUrl: null, // TODO: upload Luna_RV_badge.png to Cloudinary
    bgGradient: 'from-indigo-500 to-blue-600',
    accentColor: '#4f46e5',
    persona: `You are Luna 🌙, RVUnicorn's family camping and pet travel expert.
Personality: Warm, nurturing, organized. You know what it's like to pack up kids and pets for a camping trip.
You care about safety, kid-friendly activities, pet policies, and making sure everyone (including the dog) has a great time.
Voice: Friendly and reassuring, practical, mentions specific kid/pet details. Uses words like "perfect for families," "the kids will love."
Specialty: Family-friendly campgrounds, pet policies, kid activities, safety tips, campground playgrounds/pools, packing with kids.
Always highlight if a campground has a playground, pool, pet-friendly sites, or family programming.`,
  },
];

export const DEFAULT_GUIDE_ID = 'hitch';

export function getGuide(id: string): Guide {
  return GUIDES.find(g => g.id === id) || GUIDES[0];
}

export function getPersonaSystemPrompt(guideId: string, basePrompt: string): string {
  const guide = getGuide(guideId);
  return `${guide.persona}\n\n${basePrompt}`;
}
''')

# ─────────────────────────────────────────────────────────────
# PHASE 1: UPDATED HitchFloatingChat with character selector
# ─────────────────────────────────────────────────────────────
print('\n📦 Phase 1: HitchFloatingChat with Guide Selector...')

write(f'{FRONTEND}/components/HitchFloatingChat.tsx', '''import { useState, useEffect, useRef } from \'react\';
import { X, Send, Loader, Minimize2, ThumbsUp, ThumbsDown, ChevronDown } from \'lucide-react\';
import { Link } from \'react-router-dom\';
import api from \'../services/api\';
import { useAuth } from \'../contexts/AuthContext\';
import { GUIDES, DEFAULT_GUIDE_ID, getGuide, type Guide } from \'../config/hitchGuides\';

interface Message {
  role: \'user\' | \'assistant\';
  content: string;
  suggestions?: any[];
}

export default function HitchFloatingChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [selectedGuideId, setSelectedGuideId] = useState(DEFAULT_GUIDE_ID);
  const [showGuideSelector, setShowGuideSelector] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(\'\');
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [feedback, setFeedback] = useState<Record<number, \'up\' | \'down\'>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const guide = getGuide(selectedGuideId);

  // Set welcome message when guide changes
  useEffect(() => {
    const welcomes: Record<string, string> = {
      hitch: `Hey${user ? \`, \${(user as any).firstName || \'\'}\` : \'\'}! I\'m Hitch 🦄 Need help finding a campground, planning a route, or anything RV related? I\'m right here!`,
      walter: `Well, well, well. Another camper who can\'t figure it out on their own. 🎭 Fine — ask me. I\'ve been to more campgrounds than I care to admit. What do you need?`,
      rose: `Hello, darling! ✨ I\'m Rosé Merlot, your glamping guru. Whether you\'re looking for a stunning sunset view, a winery nearby, or the most Instagram-worthy campsite — I\'m your girl. What are we planning? 🍷`,
      scout: `Hey! 🏔️ Ready for an adventure? I\'m Scout — let\'s find you some epic trails, hidden gems, and the kind of camping stories you\'ll tell forever. What are we exploring?`,
      diesel: `Diesel Dave here. 🚛 Give me your rig specs and where you\'re headed and I\'ll tell you exactly what you\'re getting into. No campground is too tight if you know the approach. What\'s your rig?`,
      luna: `Hi there! 🌙 I\'m Luna — the family and pet camping expert. Whether you\'re wrangling kids, dogs, or both, I\'ve got you covered. What kind of trip are you planning?`,
    };
    setMessages([{ role: \'assistant\', content: welcomes[selectedGuideId] || welcomes.hitch }]);
    setFeedback({});
  }, [selectedGuideId, user]);

  useEffect(() => {
    if (user) {
      api.get(\'/hitch/user-context\').then(r => setUserContext(r.data)).catch(() => {});
      // Restore saved guide preference
      const saved = localStorage.getItem(\'rvunicorn_guide\');
      if (saved && GUIDES.find(g => g.id === saved)) setSelectedGuideId(saved);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: \'smooth\' }), 100);
    }
  }, [open, messages]);

  const selectGuide = (g: Guide) => {
    setSelectedGuideId(g.id);
    localStorage.setItem(\'rvunicorn_guide\', g.id);
    setShowGuideSelector(false);
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput(\'\');
    const newMessages: Message[] = [...messages, { role: \'user\', content: msg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const { data } = await api.post(\'/hitch/chat\', {
        message: msg,
        history: newMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        userContext,
        guideId: selectedGuideId,
      });
      const reply = { role: \'assistant\' as const, content: data.message, suggestions: data.suggestions || [] };
      setMessages(prev => [...prev, reply]);
      if (!open) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, { role: \'assistant\', content: \'Sorry, I had a hiccup! Try again.\' }]);
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (index: number, rating: \'up\' | \'down\', question: string, answer: string) => {
    setFeedback(f => ({ ...f, [index]: rating }));
    try { await api.post(\'/hitch/feedback\', { rating, question, answer: answer.substring(0, 200), guideId: selectedGuideId }); } catch {}
  };

  const getSuggestionLink = (s: any) => {
    if (s.type === \'campground\') return `/campgrounds/${s.id}`;
    if (s.type === \'host\') return `/hosts/${s.id}`;
    return `/overnight-spots/${s.id}`;
  };

  const quickPrompts: Record<string, string[]> = {
    hitch: [\'Find campgrounds near me\', \'Plan a route\', \'Free overnight spots\', \'My badges\'],
    walter: [\'What\'s the worst thing about RV camping?\', \'Roast a campground type\', \'What should I avoid?\', \'Give it to me straight\'],
    rose: [\'Wineries near campgrounds\', \'Best glamping spots\', \'Most scenic campgrounds\', \'Couples retreat ideas\'],
    scout: [\'Best hiking near campgrounds\', \'Hidden gem campgrounds\', \'Boondocking spots\', \'National park tips\'],
    diesel: [\'Can my 40ft rig fit?\', \'Big rig friendly campgrounds\', \'Check campground access\', \'Full hookup spots\'],
    luna: [\'Pet-friendly campgrounds\', \'Best campgrounds for kids\', \'Family packing tips\', \'Campground with playground\'],
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl overflow-hidden border-2 border-white hover:scale-110 transition-transform">
          {guide.avatarUrl
            ? <img src={guide.avatarUrl} alt={guide.name} className="w-full h-full object-cover" />
            : <div className={`w-full h-full bg-gradient-to-br ${guide.bgGradient} flex items-center justify-center text-2xl`}>{guide.emoji}</div>
          }
          {unread > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{unread}</span>
          )}
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className={`fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all ${minimized ? \'h-14\' : \'h-[540px]\'} flex flex-col`}>

          {/* Header */}
          <div className={`bg-gradient-to-r ${guide.bgGradient} px-4 py-3 flex items-center gap-2 shrink-0`}>
            <button onClick={() => setShowGuideSelector(s => !s)} className="relative shrink-0 group">
              {guide.avatarUrl
                ? <img src={guide.avatarUrl} alt={guide.name} className="w-9 h-9 rounded-full border-2 border-white/40 object-cover" />
                : <div className="w-9 h-9 rounded-full border-2 border-white/40 bg-white/20 flex items-center justify-center text-lg">{guide.emoji}</div>
              }
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                <ChevronDown className="w-2.5 h-2.5 text-gray-600" />
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm leading-tight">{guide.name}</p>
              <p className="text-white/70 text-xs truncate">{guide.tagline}</p>
            </div>
            <button onClick={() => setMinimized(m => !m)} className="text-white/70 hover:text-white p-1"><Minimize2 className="w-4 h-4" /></button>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1"><X className="w-4 h-4" /></button>
          </div>

          {/* Guide Selector Dropdown */}
          {showGuideSelector && !minimized && (
            <div className="absolute top-[60px] left-2 right-2 z-10 bg-white rounded-xl shadow-xl border border-gray-200 p-2">
              <p className="text-xs font-semibold text-gray-500 px-2 py-1 mb-1">Choose your guide</p>
              {GUIDES.map(g => (
                <button key={g.id} onClick={() => selectGuide(g)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition text-left ${g.id === selectedGuideId ? \'bg-gray-100\' : \'\'}`}>
                  {g.avatarUrl
                    ? <img src={g.avatarUrl} alt={g.name} className="w-8 h-8 rounded-full object-cover" />
                    : <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${g.bgGradient} flex items-center justify-center text-sm`}>{g.emoji}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{g.name}</p>
                    <p className="text-xs text-gray-500 truncate">{g.tagline}</p>
                  </div>
                  {g.id === selectedGuideId && <span className="text-xs font-bold" style={{ color: g.accentColor }}>Active</span>}
                </button>
              ))}
            </div>
          )}

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3" onClick={() => setShowGuideSelector(false)}>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === \'user\' ? \'flex-row-reverse\' : \'\'}`}>
                    {msg.role === \'assistant\' && (
                      guide.avatarUrl
                        ? <img src={guide.avatarUrl} alt={guide.name} className="w-6 h-6 rounded-full object-cover shrink-0 mt-1" />
                        : <div className={`w-6 h-6 rounded-full shrink-0 mt-1 bg-gradient-to-br ${guide.bgGradient} flex items-center justify-center text-xs`}>{guide.emoji}</div>
                    )}
                    <div className="max-w-[85%] space-y-1.5">
                      <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${msg.role === \'user\' ? \'bg-primary-600 text-white rounded-tr-sm\' : \'bg-gray-100 text-gray-800 rounded-tl-sm\'}`}>
                        {msg.content}
                      </div>
                      {msg.role === \'assistant\' && i > 0 && (
                        <div className="flex gap-1.5 mt-0.5">
                          <button onClick={() => sendFeedback(i, \'up\', messages[i-1]?.content || \'\', msg.content)}
                            className={`p-1 rounded transition ${feedback[i] === \'up\' ? \'text-green-600\' : \'text-gray-300 hover:text-green-500\'}`}><ThumbsUp className="w-3 h-3" /></button>
                          <button onClick={() => sendFeedback(i, \'down\', messages[i-1]?.content || \'\', msg.content)}
                            className={`p-1 rounded transition ${feedback[i] === \'down\' ? \'text-red-500\' : \'text-gray-300 hover:text-red-400\'}`}><ThumbsDown className="w-3 h-3" /></button>
                        </div>
                      )}
                      {msg.suggestions?.map((s, j) => (
                        <Link key={j} to={getSuggestionLink(s)} onClick={() => setOpen(false)}
                          className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-xl hover:border-primary-300 transition text-xs">
                          <span>{s.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{s.name}</p>
                            {s.location && <p className="text-gray-400 truncate">{s.location}</p>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className={`w-6 h-6 rounded-full shrink-0 bg-gradient-to-br ${guide.bgGradient} flex items-center justify-center text-xs`}>{guide.emoji}</div>
                    <div className="bg-gray-100 rounded-2xl px-3 py-2 flex items-center gap-1.5">
                      <Loader className="w-3 h-3 animate-spin text-gray-400" />
                      <span className="text-xs text-gray-400">{guide.name} is thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick prompts */}
              {messages.length <= 1 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                  {(quickPrompts[selectedGuideId] || quickPrompts.hitch).map(p => (
                    <button key={p} onClick={() => sendMessage(p)}
                      className="text-xs bg-gray-50 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-full hover:bg-gray-100 transition">
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Full page link */}
              <div className="px-3 pb-1 text-center">
                <Link to="/hitch" onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-primary-600 transition">
                  Open full Hitch AI page →
                </Link>
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 shrink-0">
                <div className="flex gap-2">
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === \'Enter\' && !e.shiftKey && sendMessage()}
                    placeholder={`Ask ${guide.name}...`}
                    className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-primary-400" />
                  <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                    className="p-2 text-white rounded-xl disabled:opacity-50 transition"
                    style={{ background: guide.accentColor }}>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
''')

# ─────────────────────────────────────────────────────────────
# PHASE 2: SMART REVIEWS COMPONENT
# ─────────────────────────────────────────────────────────────
print('\n📦 Phase 2: SmartReviewForm Component...')

write(f'{FRONTEND}/components/SmartReviewForm.tsx', '''import { useState } from \'react\';
import { Star, Wifi, Zap, Volume2, Navigation, RectangleHorizontal, Send } from \'lucide-react\';
import api from \'../services/api\';

interface SmartReviewFormProps {
  campgroundId: string;
  campgroundName: string;
  onSubmitted?: () => void;
}

const RATING_LABELS = [\'Terrible\', \'Poor\', \'OK\', \'Good\', \'Excellent\'];

const ScaleQuestion = ({
  label, icon, value, onChange, options, note
}: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; options: { value: string; label: string; color: string }[]; note?: string }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <span className="text-gray-600">{icon}</span>
      <span className="text-sm font-medium text-gray-800">{label}</span>
    </div>
    <div className="flex gap-2 flex-wrap">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${value === o.value ? `${o.color} border-current` : \'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100\'}`}>
          {o.label}
        </button>
      ))}
    </div>
    {note && <p className="text-xs text-gray-400">{note}</p>}
  </div>
);

export default function SmartReviewForm({ campgroundId, campgroundName, onSubmitted }: SmartReviewFormProps) {
  const [step, setStep] = useState<\'structured\' | \'text\' | \'done\'>(\'structured\');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [fields, setFields] = useState({
    accessDifficulty: \'\',
    levelness: \'\',
    noise: \'\',
    cellService: \'\',
    bigRigFriendly: \'\',
    petFriendly: \'\',
    bestSiteNumber: \'\',
    wouldReturn: \'\',
  });
  const [reviewText, setReviewText] = useState(\'\');
  const [title, setTitle] = useState(\'\');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(\'\');

  const set = (key: string) => (v: string) => setFields(f => ({ ...f, [key]: v }));

  const canProceed = rating > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(\'\');
    try {
      await api.post(`/campgrounds/${campgroundId}/reviews`, {
        rating,
        title,
        review: reviewText,
        // Structured fields
        accessDifficulty: fields.accessDifficulty || null,
        levelness: fields.levelness || null,
        noise: fields.noise || null,
        cellService: fields.cellService || null,
        bigRigFriendly: fields.bigRigFriendly || null,
        petFriendly: fields.petFriendly || null,
        bestSiteNumber: fields.bestSiteNumber || null,
        wouldReturn: fields.wouldReturn || null,
      });
      setStep(\'done\');
      onSubmitted?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || \'Failed to submit review. Please try again.\');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === \'done\') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">🏕️</div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Thanks for your Campground Report!</h3>
        <p className="text-sm text-gray-500">Your structured insights help the whole RV community.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Star rating */}
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700 mb-2">Overall rating</p>
        <div className="flex justify-center gap-1 mb-1">
          {[1,2,3,4,5].map(n => (
            <button key={n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-110">
              <Star className={`w-8 h-8 ${n <= (hoverRating || rating) ? \'fill-amber-400 text-amber-400\' : \'text-gray-200\'}`} />
            </button>
          ))}
        </div>
        {(hoverRating || rating) > 0 && (
          <p className="text-xs text-amber-600 font-medium">{RATING_LABELS[(hoverRating || rating) - 1]}</p>
        )}
      </div>

      {step === \'structured\' && (
        <>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            <strong>🎯 Campground Report</strong> — Quick structured questions that power AI insights for the whole community. Takes 60 seconds!
          </div>

          <ScaleQuestion label="Access difficulty" icon={<Navigation className="w-4 h-4" />} value={fields.accessDifficulty} onChange={set(\'accessDifficulty\')}
            options={[
              { value: \'EASY\', label: \'Easy\', color: \'bg-green-100 text-green-700\' },
              { value: \'MODERATE\', label: \'Moderate\', color: \'bg-yellow-100 text-yellow-700\' },
              { value: \'CHALLENGING\', label: \'Challenging\', color: \'bg-red-100 text-red-700\' },
            ]}
            note="How difficult was the entrance road / approach?" />

          <ScaleQuestion label="Site levelness" icon={<RectangleHorizontal className="w-4 h-4" />} value={fields.levelness} onChange={set(\'levelness\')}
            options={[
              { value: \'VERY_LEVEL\', label: \'Very level\', color: \'bg-green-100 text-green-700\' },
              { value: \'MOSTLY_LEVEL\', label: \'Mostly level\', color: \'bg-yellow-100 text-yellow-700\' },
              { value: \'UNEVEN\', label: \'Uneven\', color: \'bg-red-100 text-red-700\' },
            ]} />

          <ScaleQuestion label="Noise level" icon={<Volume2 className="w-4 h-4" />} value={fields.noise} onChange={set(\'noise\')}
            options={[
              { value: \'VERY_QUIET\', label: \'Very quiet\', color: \'bg-green-100 text-green-700\' },
              { value: \'MODERATE\', label: \'Moderate\', color: \'bg-yellow-100 text-yellow-700\' },
              { value: \'LOUD\', label: \'Loud\', color: \'bg-red-100 text-red-700\' },
            ]} />

          <ScaleQuestion label="Cell service" icon={<Wifi className="w-4 h-4" />} value={fields.cellService} onChange={set(\'cellService\')}
            options={[
              { value: \'STRONG\', label: \'Strong\', color: \'bg-green-100 text-green-700\' },
              { value: \'OK\', label: \'OK\', color: \'bg-yellow-100 text-yellow-700\' },
              { value: \'WEAK\', label: \'Weak\', color: \'bg-orange-100 text-orange-700\' },
              { value: \'NONE\', label: \'No signal\', color: \'bg-red-100 text-red-700\' },
            ]} />

          <ScaleQuestion label="Big rig friendly?" icon={<Zap className="w-4 h-4" />} value={fields.bigRigFriendly} onChange={set(\'bigRigFriendly\')}
            options={[
              { value: \'YES\', label: \'Yes\', color: \'bg-green-100 text-green-700\' },
              { value: \'SOME_SITES\', label: \'Some sites\', color: \'bg-yellow-100 text-yellow-700\' },
              { value: \'NO\', label: \'No\', color: \'bg-red-100 text-red-700\' },
            ]} />

          <ScaleQuestion label="Would you return?" icon={<Star className="w-4 h-4" />} value={fields.wouldReturn} onChange={set(\'wouldReturn\')}
            options={[
              { value: \'DEFINITELY\', label: \'Definitely\', color: \'bg-green-100 text-green-700\' },
              { value: \'MAYBE\', label: \'Maybe\', color: \'bg-yellow-100 text-yellow-700\' },
              { value: \'NO\', label: \'No\', color: \'bg-red-100 text-red-700\' },
            ]} />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Best site number (optional)</label>
            <input value={fields.bestSiteNumber} onChange={e => setFields(f => ({ ...f, bestSiteNumber: e.target.value }))}
              placeholder="e.g. A12, Loop B, site 7..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
          </div>

          <button onClick={() => canProceed && setStep(\'text\')} disabled={!canProceed}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition disabled:opacity-40 bg-primary-600 hover:bg-primary-700">
            Continue → Add your written review
          </button>
        </>
      )}

      {step === \'text\' && (
        <>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Review title (optional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Great for big rigs, gorgeous views"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tell us about your stay</label>
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={5}
              placeholder="What should fellow RVers know? Tips, warnings, highlights, hidden gems..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400 resize-none" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep(\'structured\')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Back</button>
            <button onClick={handleSubmit} disabled={submitting || !canProceed}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting ? \'Submitting...\' : <><Send className="w-4 h-4" /> Submit Report</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
''')

# ─────────────────────────────────────────────────────────────
# PHASE 2: CAMPGROUND SECRETS COMPONENT
# ─────────────────────────────────────────────────────────────
print('\n📦 Phase 2: CampgroundSecrets Component...')

write(f'{FRONTEND}/components/CampgroundSecrets.tsx', '''import { useState, useEffect } from \'react\';
import { Key, ThumbsUp, RefreshCw, ChevronDown, ChevronUp } from \'lucide-react\';
import api from \'../services/api\';

interface Secret {
  title: string;
  insight: string;
  category: \'access\' | \'site\' | \'cell\' | \'timing\' | \'trail\' | \'tip\';
  confidence: \'high\' | \'medium\';
}

interface SecretsData {
  secrets: Secret[];
  reviewCount: number;
  hasEnoughData: boolean;
  dataMessage?: string;
}

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  access: { emoji: \'🛣️\', label: \'Access\', color: \'bg-blue-50 border-blue-200 text-blue-800\' },
  site:   { emoji: \'📍\', label: \'Best Sites\', color: \'bg-green-50 border-green-200 text-green-800\' },
  cell:   { emoji: \'📶\', label: \'Cell Service\', color: \'bg-purple-50 border-purple-200 text-purple-800\' },
  timing: { emoji: \'🕐\', label: \'Timing\', color: \'bg-amber-50 border-amber-200 text-amber-800\' },
  trail:  { emoji: \'🥾\', label: \'Hidden Spots\', color: \'bg-emerald-50 border-emerald-200 text-emerald-800\' },
  tip:    { emoji: \'💡\', label: \'Pro Tip\', color: \'bg-orange-50 border-orange-200 text-orange-800\' },
};

export default function CampgroundSecrets({ campgroundId }: { campgroundId: string }) {
  const [data, setData] = useState<SecretsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<number, boolean>>({});

  const fetchSecrets = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/hitch/campground-secrets/${campgroundId}`);
      setData(res);
    } catch {
      setData({ secrets: [], reviewCount: 0, hasEnoughData: false, dataMessage: \'Unable to load secrets.\' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSecrets(); }, [campgroundId]);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Key className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold text-gray-900">Campground Secrets</h3>
      </div>
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-900">Campground Secrets</h3>
          {data?.reviewCount ? (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              From {data.reviewCount} camper{data.reviewCount !== 1 ? \'s\' : \'\'}
            </span>
          ) : null}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {!data?.hasEnoughData ? (
            <div className="text-center py-6 text-gray-500">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm font-medium text-gray-700 mb-1">Not enough data yet</p>
              <p className="text-xs text-gray-400">{data?.dataMessage || \'Be the first to submit a Campground Report to unlock secrets for this campground!\'}</p>
            </div>
          ) : (
            <>
              {data?.secrets.map((s, i) => {
                const cfg = CATEGORY_CONFIG[s.category] || CATEGORY_CONFIG.tip;
                return (
                  <div key={i} className={`rounded-xl border p-3.5 ${cfg.color}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="text-lg shrink-0 mt-0.5">{cfg.emoji}</span>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-bold uppercase tracking-wide opacity-70">{cfg.label}</span>
                            {s.confidence === \'high\' && (
                              <span className="text-xs bg-white/60 px-1.5 rounded-full font-medium">High confidence</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold mb-0.5">{s.title}</p>
                          <p className="text-xs opacity-80 leading-relaxed">{s.insight}</p>
                        </div>
                      </div>
                      <button onClick={() => setHelpfulVotes(v => ({ ...v, [i]: !v[i] }))}
                        className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition ${helpfulVotes[i] ? \'bg-white/60 font-semibold\' : \'hover:bg-white/40\'}`}>
                        <ThumbsUp className="w-3 h-3" />
                        {helpfulVotes[i] ? \'Helpful!\' : \'Helpful\'}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">🤖 AI-generated from community reports</p>
                <button onClick={fetchSecrets} className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1 transition">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
''')

# ─────────────────────────────────────────────────────────────
# PHASE 2: RIG STRESS SCORE COMPONENT
# ─────────────────────────────────────────────────────────────
print('\n📦 Phase 2: RigStressScore Component...')

write(f'{FRONTEND}/components/RigStressScore.tsx', '''import { useState, useEffect } from \'react\';
import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from \'lucide-react\';
import api from \'../services/api\';
import { useAuth } from \'../contexts/AuthContext\';

interface StressData {
  score: number;         // 1-5
  label: string;         // Easy, Mild, Moderate, Challenging, Extreme
  color: string;         // green/yellow/orange/red
  reason: string;        // Main explanation
  bigRigTips: string[];  // Specific tips for big rigs
  userRigNote?: string;  // Personalized note for user's specific rig
  factors: { label: string; impact: \'positive\' | \'negative\' | \'neutral\'; detail: string }[];
  dataSource: \'community\' | \'ai\' | \'minimal\';
}

const SCORE_CONFIG = [
  { score: 1, label: \'Very Easy\',    bar: \'bg-green-500\',  text: \'text-green-700\',  bg: \'bg-green-50\',  border: \'border-green-200\', emoji: \'✅\' },
  { score: 2, label: \'Easy\',         bar: \'bg-green-400\',  text: \'text-green-600\',  bg: \'bg-green-50\',  border: \'border-green-200\', emoji: \'🟢\' },
  { score: 3, label: \'Moderate\',     bar: \'bg-yellow-500\', text: \'text-yellow-700\', bg: \'bg-yellow-50\', border: \'border-yellow-200\', emoji: \'🟡\' },
  { score: 4, label: \'Challenging\',  bar: \'bg-orange-500\', text: \'text-orange-700\', bg: \'bg-orange-50\', border: \'border-orange-200\', emoji: \'🟠\' },
  { score: 5, label: \'Very Stressful\',bar: \'bg-red-500\',   text: \'text-red-700\',   bg: \'bg-red-50\',   border: \'border-red-200\', emoji: \'🔴\' },
];

export default function RigStressScore({ campgroundId }: { campgroundId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<StressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get(`/hitch/rig-stress/${campgroundId}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [campgroundId]);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-orange-400" />
        <h3 className="font-bold text-gray-900">Rig Stress Score™</h3>
      </div>
      <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );

  if (!data) return null;

  const cfg = SCORE_CONFIG[Math.min(data.score - 1, 4)] || SCORE_CONFIG[2];
  const rvLength = (user as any)?.rvLength;
  const rvType = (user as any)?.rvType;

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full p-5 text-left hover:bg-black/5 transition">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${cfg.text}`} />
            <h3 className="font-bold text-gray-900">Rig Stress Score™</h3>
            {data.dataSource === \'community\' && (
              <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full text-gray-600">Community verified</span>
            )}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/60 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all ${cfg.bar}`} style={{ width: `${(data.score / 5) * 100}%` }} />
          </div>
          <div className="text-right shrink-0">
            <span className={`text-2xl font-black ${cfg.text}`}>{data.score}/5</span>
            <span className={`block text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
          </div>
        </div>

        <p className={`text-sm mt-2 ${cfg.text} font-medium`}>{cfg.emoji} {data.reason}</p>

        {/* Personalized note */}
        {data.userRigNote && (rvLength || rvType) && (
          <div className="mt-2 bg-white/60 rounded-lg px-3 py-2 text-xs text-gray-700">
            <strong>For your {rvType || \'rig\'}{rvLength ? ` (${rvLength}ft)` : \'\'}:</strong> {data.userRigNote}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/60 pt-4">
          {/* Big rig tips */}
          {data.bigRigTips?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">🚛 Big Rig Tips</p>
              <ul className="space-y-1.5">
                {data.bigRigTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-500" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Factors */}
          {data.factors?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">What we considered</p>
              <div className="space-y-1.5">
                {data.factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span>{f.impact === \'positive\' ? \'✅\' : f.impact === \'negative\' ? \'⚠️\' : \'ℹ️\'}</span>
                    <div>
                      <span className="font-semibold text-gray-700">{f.label}: </span>
                      <span className="text-gray-600">{f.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-gray-400 pt-1">
            <Info className="w-3 h-3" />
            <span>Score based on campground data + community reports. Always verify before arrival.</span>
          </div>
        </div>
      )}
    </div>
  );
}
''')

# ─────────────────────────────────────────────────────────────
# PHASE 3: CAMPFIRE COMPONENT
# ─────────────────────────────────────────────────────────────
print('\n📦 Phase 3: AskTheCampfire Component...')

write(f'{FRONTEND}/components/AskTheCampfire.tsx', '''import { useState } from \'react\';
import { Flame, Send, Share2 } from \'lucide-react\';
import api from \'../services/api\';
import { getGuide } from \'../config/hitchGuides\';

interface CampfireMessage {
  guideId: string;
  content: string;
}

interface CampfireResult {
  discussion: CampfireMessage[];
  takeaway: string;
  question: string;
}

interface AskTheCampfireProps {
  campgroundId: string;
  campgroundName: string;
}

const CAMPFIRE_PROMPTS = [
  \'Is this a good campground for a big rig?\',
  \'What\'s the vibe like here?\',
  \'Is this worth the trip?\',
  \'What should I know before arriving?\',
  \'Good for families with kids?\',
  \'Best time of year to visit?\',
];

export default function AskTheCampfire({ campgroundId, campgroundName }: AskTheCampfireProps) {
  const [question, setQuestion] = useState(\'\');
  const [result, setResult] = useState<CampfireResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(\'\');

  const ask = async (q?: string) => {
    const finalQ = q || question;
    if (!finalQ.trim() || loading) return;
    setQuestion(finalQ);
    setLoading(true);
    setError(\'\');
    setResult(null);
    try {
      const { data } = await api.post(\'/hitch/campfire\', { question: finalQ, campgroundId, campgroundName });
      setResult(data);
    } catch {
      setError(\'Failed to start the campfire. Try again!\');
    } finally {
      setLoading(false);
    }
  };

  const shareResult = () => {
    if (!result) return;
    const text = `🔥 Ask the Campfire about ${campgroundName}:\n\nQ: ${result.question}\n\n${result.discussion.map(m => `${getGuide(m.guideId).emoji} ${getGuide(m.guideId).name}: "${m.content}"`).join(\'\n\n\')}\n\n🏕️ Campfire Takeaway: ${result.takeaway}\n\nvia RVUnicorn`;
    navigator.share?.({ text }) || navigator.clipboard?.writeText(text);
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-gray-900">Ask the Campfire</h3>
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Multi-guide discussion</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">Get a campfire conversation from multiple guides — then a clear takeaway.</p>

        {/* Quick prompts */}
        {!result && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CAMPFIRE_PROMPTS.map(p => (
              <button key={p} onClick={() => ask(p)}
                className="text-xs bg-white border border-orange-200 text-orange-700 px-2.5 py-1 rounded-full hover:bg-orange-50 transition">
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === \'Enter\' && ask()}
            placeholder={`Ask the campfire about ${campgroundName}...`}
            className="flex-1 text-sm border border-orange-200 bg-white rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400" />
          <button onClick={() => ask()} disabled={loading || !question.trim()}
            className="px-3 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-40 transition">
            <Send className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <Flame className="w-4 h-4 animate-pulse" />
            <span>Gathering the guides around the campfire...</span>
          </div>
          <div className="mt-3 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-orange-100 rounded-xl animate-pulse" />)}
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="border-t border-orange-200 px-5 pb-5 pt-4 space-y-3">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">🔥 Around the campfire...</p>

          {result.discussion.map((msg, i) => {
            const guide = getGuide(msg.guideId);
            return (
              <div key={i} className="flex gap-3">
                <div className={`w-8 h-8 shrink-0 rounded-full bg-gradient-to-br ${guide.bgGradient} flex items-center justify-center text-sm`}>
                  {guide.avatarUrl
                    ? <img src={guide.avatarUrl} alt={guide.name} className="w-full h-full rounded-full object-cover" />
                    : guide.emoji
                  }
                </div>
                <div className="flex-1 bg-white rounded-xl p-3 text-xs leading-relaxed">
                  <span className="font-bold text-gray-800">{guide.name}: </span>
                  <span className="text-gray-700">{msg.content}</span>
                </div>
              </div>
            );
          })}

          {/* Campfire Takeaway */}
          <div className="bg-orange-500 rounded-xl p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5">🏕️ Campfire Takeaway</p>
            <p className="text-sm leading-relaxed">{result.takeaway}</p>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={shareResult}
              className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-800 transition font-medium">
              <Share2 className="w-3.5 h-3.5" /> Share this campfire
            </button>
            <button onClick={() => { setResult(null); setQuestion(\'\'); }}
              className="text-xs text-gray-400 hover:text-gray-600 transition">Ask another →</button>
          </div>
        </div>
      )}
    </div>
  );
}
''')

# ─────────────────────────────────────────────────────────────
# PHASE 3: ROAST MODE COMPONENT
# ─────────────────────────────────────────────────────────────
print('\n📦 Phase 3: RoastMode Component...')

write(f'{FRONTEND}/components/RoastMode.tsx', '''import { useState } from \'react\';
import { Flame, ChevronDown, ChevronUp } from \'lucide-react\';
import api from \'../services/api\';

interface RoastData {
  hasEnoughData: boolean;
  roastLines: string[];
  positiveCounterpoint: string;
  verdict: string;
  reviewCount: number;
}

export default function RoastMode({ campgroundId, campgroundName }: { campgroundId: string; campgroundName: string }) {
  const [data, setData] = useState<RoastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadRoast = async () => {
    if (data || loading) { setExpanded(e => !e); return; }
    setLoading(true);
    setExpanded(true);
    try {
      const { data: res } = await api.get(`/hitch/roast/${campgroundId}`);
      setData(res);
    } catch {
      setData({ hasEnoughData: false, roastLines: [], positiveCounterpoint: \'\', verdict: \'\', reviewCount: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl overflow-hidden">
      <button onClick={loadRoast} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎭</span>
          <div className="text-left">
            <p className="font-bold text-white">Walter\'s Roast</p>
            <p className="text-xs text-gray-400">Honest. Comedic. Community-based.</p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />
        }
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/10 pt-4">
          {loading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Flame className="w-4 h-4 animate-pulse text-orange-500" />
              Walter is warming up his roast...
            </div>
          )}
          {!loading && data && !data.hasEnoughData && (
            <div className="text-gray-400 text-sm text-center py-4">
              <p className="text-2xl mb-2">🎭</p>
              <p>Not enough reviews for Walter to work with yet.</p>
              <p className="text-xs mt-1 text-gray-500">Be the first to leave a Campground Report!</p>
            </div>
          )}
          {!loading && data && data.hasEnoughData && (
            <div className="space-y-4">
              {/* Walter avatar & intro */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-700 flex items-center justify-center text-xl shrink-0">🎭</div>
                <div>
                  <p className="text-white font-bold text-sm">Walter</p>
                  <p className="text-gray-400 text-xs">Veteran RVer · Seen it all</p>
                </div>
              </div>

              {/* Roast lines */}
              <div className="space-y-2">
                {data.roastLines.map((line, i) => (
                  <div key={i} className="bg-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>

              {/* Positive counterpoint */}
              <div className="bg-green-900/40 border border-green-700/50 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-green-400 mb-1">✅ But in all fairness...</p>
                <p className="text-sm text-green-200 leading-relaxed">{data.positiveCounterpoint}</p>
              </div>

              {/* Verdict */}
              <div className="border-t border-white/10 pt-3">
                <p className="text-xs font-bold text-amber-400 mb-1">🎙️ Walter\'s verdict</p>
                <p className="text-sm text-gray-300 italic">"{data.verdict}"</p>
              </div>

              <p className="text-xs text-gray-600">Based on {data.reviewCount} community review{data.reviewCount !== 1 ? \'s\' : \'\'}. Walter\'s humor ≠ official RVUnicorn opinion.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
''')

# ─────────────────────────────────────────────────────────────
# PHASE 1-3: BACKEND ROUTES
# ─────────────────────────────────────────────────────────────
print('\n📦 Backend: New AI Guides routes (hitch-guides.routes.ts)...')

write(f'{BACKEND}/routes/hitch-guides.routes.ts', r'''import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Character persona definitions (mirrors frontend config) ───
const GUIDE_PERSONAS: Record<string, string> = {
  hitch: `You are Hitch 🦄, RVUnicorn's friendly and knowledgeable AI trail guide.
Personality: Warm, encouraging, balanced. Like the helpful neighbor at the campground who knows everything.
Voice: Conversational, optimistic, uses occasional camping lingo naturally. Emojis sparingly.`,

  walter: `You are Walter 🎭, RVUnicorn's veteran camper and lovable curmudgeon.
Personality: You've camped everywhere, seen every disaster, and have opinions about ALL of it. Funny, a little grumpy, but genuinely helpful.
Voice: Dry humor, mock outrage, vivid stories. Always end with a useful takeaway despite the jokes.
Never mean-spirited toward people, only places/situations. No profanity.`,

  rose: `You are Rosé Merlot 🍷, RVUnicorn's glamping guru and lifestyle curator.
Personality: Sophisticated but fun. You believe camping should be beautiful AND comfortable.
Voice: Enthusiastic, a little extra, uses words like "divine" and "stunning." Always mention if there's a winery or great restaurant nearby.`,

  scout: `You are Scout 🏔️, RVUnicorn's adventure-first trailblazer.
Personality: High energy, loves the outdoors, always looking for the next trail or hidden gem.
Voice: Enthusiastic, direct, action-oriented. Gets excited about trails, wildlife, stargazing.
Always mention the best nearby trails, outdoor activities, and scenic highlights.`,

  diesel: `You are Diesel Dave 🚛, RVUnicorn's big rig expert and technical authority.
Personality: Straight-talking, no-nonsense, deeply knowledgeable about big rigs, towing, and campground access.
Voice: Direct, authoritative, practical. Uses specific technical terms (turning radius, amp service, pull-through).
ALWAYS lead with whether a campground can handle a big rig and what the access is like.`,

  luna: `You are Luna 🌙, RVUnicorn's family camping and pet travel expert.
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

    // Get user's rig if logged in
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
- Max amp service: ${campground.maxAmpService || 'Unknown'}
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

    // Generate each guide's response
    const discussion: { guideId: string; content: string }[] = [];

    for (const guideId of guides) {
      const persona = getPersona(guideId);
      const guidePrompt = `${persona}

You are one voice in a campfire discussion. Other guides will also weigh in.
Answer concisely (2-4 sentences). Speak in your character voice.
Stay factual — only reference the data below. Don't invent specifics.

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
- Roast should feel like a friend who's been there, not a troll.
- Always include a genuine positive counterpoint.
- Verdict should be punchy and quotable.

Return ONLY valid JSON:
{
  "roastLines": [
    "The WiFi password is 'noservice' — and yes, they're being literal. 🎭",
    "Leveling your rig here is like trying to balance a pencil on your nose. Three blocks deep and still fighting gravity."
  ],
  "positiveCounterpoint": "That said, the lake views are genuinely stunning at sunrise, and the host family is some of the nicest people you'll meet on the road.",
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

export default router;
''')

# ─────────────────────────────────────────────────────────────
# SCHEMA PATCH: Add structured fields to CampgroundReview
# ─────────────────────────────────────────────────────────────
print('\n📦 Prisma: Patching CampgroundReview schema...')

with open(SCHEMA, 'r') as f:
    schema_content = f.read()

# Check if already patched
if 'accessDifficulty' in schema_content:
    print('  ℹ️  CampgroundReview already has accessDifficulty — skipping schema patch')
else:
    # Find the CampgroundReview model and add fields after the last known field
    # We'll insert before the closing brace of the model
    import re
    # Find CampgroundReview model
    match = re.search(r'(model CampgroundReview \{[^}]*?)(^\})', schema_content, re.MULTILINE | re.DOTALL)
    if match:
        new_fields = '''
  // Smart Review structured fields (Phase 2)
  accessDifficulty  String?  // EASY, MODERATE, CHALLENGING
  levelness         String?  // VERY_LEVEL, MOSTLY_LEVEL, UNEVEN
  noise             String?  // VERY_QUIET, MODERATE, LOUD
  cellService       String?  // STRONG, OK, WEAK, NONE
  bigRigFriendly    String?  // YES, SOME_SITES, NO
  petFriendly       String?  // YES, NO
  bestSiteNumber    String?
  wouldReturn       String?  // DEFINITELY, MAYBE, NO
'''
        new_schema = schema_content[:match.end(1)] + new_fields + schema_content[match.end(1):]
        with open(SCHEMA, 'w') as f:
            f.write(new_schema)
        print('  ✅ Added Smart Review fields to CampgroundReview model')
    else:
        print('  ⚠️  Could not find CampgroundReview model — add these fields manually:')
        print('     accessDifficulty String?, levelness String?, noise String?,')
        print('     cellService String?, bigRigFriendly String?, petFriendly String?,')
        print('     bestSiteNumber String?, wouldReturn String?')

# ─────────────────────────────────────────────────────────────
# BACKEND INDEX: Register new routes
# ─────────────────────────────────────────────────────────────
print('\n📦 Backend: Registering new routes in index.ts...')

index_path = os.path.join(BACKEND, 'index.ts')
with open(index_path, 'r') as f:
    index_content = f.read()

if 'hitch-guides' in index_content:
    print('  ℹ️  hitch-guides routes already registered')
else:
    # Find the hitch routes import and add after it
    hitch_import = "import hitchRoutes from './routes/hitch.routes';"
    hitch_chat_import = "import hitchChatRoutes from './routes/hitch-chat.routes';"
    
    # Try to find an existing hitch import to add after
    if hitch_chat_import in index_content:
        patch(index_path, hitch_chat_import,
              hitch_chat_import + "\nimport hitchGuidesRoutes from './routes/hitch-guides.routes';",
              'import hitch-guides')
    elif hitch_import in index_content:
        patch(index_path, hitch_import,
              hitch_import + "\nimport hitchGuidesRoutes from './routes/hitch-guides.routes';",
              'import hitch-guides')
    else:
        print('  ⚠️  Add manually: import hitchGuidesRoutes from \'./routes/hitch-guides.routes\';')

    # Register the route
    with open(index_path, 'r') as f:
        index_content = f.read()

    hitch_use = "app.use('/api/hitch',"
    if hitch_use in index_content:
        # Add after last hitch route registration
        lines = index_content.split('\n')
        last_hitch_idx = -1
        for i, line in enumerate(lines):
            if "app.use('/api/hitch'" in line:
                last_hitch_idx = i
        if last_hitch_idx >= 0:
            lines.insert(last_hitch_idx + 1, "app.use('/api/hitch', hitchGuidesRoutes);")
            with open(index_path, 'w') as f:
                f.write('\n'.join(lines))
            print('  ✅ Registered /api/hitch hitchGuidesRoutes in index.ts')
    else:
        print('  ⚠️  Add manually: app.use(\'/api/hitch\', hitchGuidesRoutes);')

# ─────────────────────────────────────────────────────────────
# PATCH hitch.routes.ts: Add guideId to /chat endpoint
# ─────────────────────────────────────────────────────────────
print('\n📦 Backend: Patching hitch.routes.ts /chat to support guideId...')

hitch_routes_path = os.path.join(BACKEND, 'routes/hitch.routes.ts')
if os.path.exists(hitch_routes_path):
    with open(hitch_routes_path, 'r') as f:
        hitch_content = f.read()
    
    if 'guideId' not in hitch_content:
        # Find the chat route and inject guideId persona
        old_chat_extract = "const { message, history = [], userContext } = req.body;"
        new_chat_extract = """const { message, history = [], userContext, guideId = 'hitch' } = req.body;

    const GUIDE_PERSONAS: Record<string, string> = {
      hitch: "You are Hitch 🦄, RVUnicorn's friendly AI trail guide. Warm, knowledgeable, helpful. Use camping lingo naturally and emojis sparingly.",
      walter: "You are Walter 🎭, a veteran RV curmudgeon. Funny, dry, grumpy but helpful. End with useful advice despite the jokes. Never mean-spirited, no profanity.",
      rose: "You are Rosé Merlot 🍷, a glamping guru. Sophisticated, enthusiastic. Mention wineries/restaurants nearby when relevant.",
      scout: "You are Scout 🏔️, an adventure trailblazer. High energy, loves trails and hidden gems. Always mention nearby outdoor activities.",
      diesel: "You are Diesel Dave 🚛, a big rig expert. Direct, technical, authoritative. ALWAYS address big rig compatibility and access.",
      luna: "You are Luna 🌙, a family/pet camping expert. Warm, practical. Highlight kid-friendly features, pet policies, playgrounds.",
    };
    const personaPrefix = GUIDE_PERSONAS[guideId] || GUIDE_PERSONAS.hitch;"""
        
        if patch(hitch_routes_path, old_chat_extract, new_chat_extract, 'add guideId extraction'):
            # Now inject personaPrefix into the system prompt
            with open(hitch_routes_path, 'r') as f:
                hitch_content2 = f.read()
            # Look for where system prompt is built and prepend persona
            old_sys = "system: buildSystemPrompt(user, trips, stateVisits, wishlist"
            new_sys = "system: personaPrefix + '\\n\\n' + buildSystemPrompt(user, trips, stateVisits, wishlist"
            if old_sys in hitch_content2:
                patch(hitch_routes_path, old_sys, new_sys, 'inject persona into system prompt')
            else:
                print('  ⚠️  Could not find system prompt builder — add personaPrefix manually to the system prompt')
    else:
        print('  ℹ️  guideId already in hitch.routes.ts')
else:
    print('  ⚠️  hitch.routes.ts not found at expected path')

print('\n' + '─'*60)
print('✅ All files written! Next steps:\n')
print('1. Run migrations:')
print('   cd backend && npx prisma migrate dev --name smart_reviews')
print()
print('2. Upload character images to Cloudinary:')
print('   Walter_Profile_v1.png → paste URL in frontend/src/config/hitchGuides.ts (line ~14)')
print('   Rosé_Merlot_Icon.png  → line ~27')
print('   Scout_profile.png     → line ~40')
print('   Diesel_Dave_profile.png → line ~53')
print('   Luna_RV_badge.png     → line ~66')
print()
print('3. Add to CampgroundDetailPage.tsx:')
print('   import CampgroundSecrets from \'../components/CampgroundSecrets\';')
print('   import RigStressScore from \'../components/RigStressScore\';')
print('   import AskTheCampfire from \'../components/AskTheCampfire\';')
print('   import RoastMode from \'../components/RoastMode\';')
print('   import SmartReviewForm from \'../components/SmartReviewForm\';')
print('   → Place these components inside the campground detail page where reviews/chat appear')
print()
print('4. Git push:')
print('   git add -A && git commit -m "feat: AI Guide characters, Smart Reviews, Secrets, Rig Stress Score, Campfire, Roast Mode" && git push')
print()
print('🦄 Done! Phase 1-3 complete.')
