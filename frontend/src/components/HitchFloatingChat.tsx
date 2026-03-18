import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader, Minimize2, ThumbsUp, ThumbsDown, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { GUIDES, DEFAULT_GUIDE_ID, getGuide, type Guide } from '../config/hitchGuides';
import { useGuideUnlocks } from '../hooks/useGuideUnlocks';
import { Lock } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: any[];
  tripCreated?: { id: string; title: string } | null;
}

export default function HitchFloatingChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [selectedGuideId, setSelectedGuideId] = useState(DEFAULT_GUIDE_ID);
  const [showGuideSelector, setShowGuideSelector] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const unreadDisplay = Math.min(unread, 9);
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down'>>({});
  const [chimeIns, setChimeIns] = useState<Record<number, any>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const guide = getGuide(selectedGuideId);
  const { isUnlocked, getProgress } = useGuideUnlocks();

  // Set welcome message when guide changes
  useEffect(() => {
    const welcomes: Record<string, string> = {
      hitch: `Hey${user ? ', ' + ((user as any).firstName || '') : ''}! I'm Hitch 🦄 Need help finding a campground, planning a route, or anything RV related? I'm right here!`,
      walter: `Well, well, well. Another camper who can't figure it out on their own. 🎭 Fine — ask me. I've been to more campgrounds than I care to admit. What do you need?`,
      rose: `Hello, darling! ✨ I'm Rosé Merlot, your glamping guru. Whether you're looking for a stunning sunset view, a winery nearby, or the most Instagram-worthy campsite — I'm your girl. What are we planning? 🍷`,
      scout: `Hey! 🏔️ Ready for an adventure? I'm Scout — let's find you some epic trails, hidden gems, and the kind of camping stories you'll tell forever. What are we exploring?`,
      diesel: `Diesel Dave here. 🚛 Give me your rig specs and where you're headed and I'll tell you exactly what you're getting into. No campground is too tight if you know the approach. What's your rig?`,
      luna: `Hi there! 🌙 I'm Luna — the family and pet camping expert. Whether you're wrangling kids, dogs, or both, I've got you covered. What kind of trip are you planning?`,
    };
    setMessages([{ role: 'assistant', content: welcomes[selectedGuideId] || welcomes.hitch }]);
    setFeedback({});
  }, [selectedGuideId, user]);

  useEffect(() => {
    if (user) {
      api.get('/hitch/user-context').then(r => setUserContext(r.data)).catch(() => {});
      // Restore saved guide preference
      const saved = localStorage.getItem('rvunicorn_guide');
      if (saved && GUIDES.find(g => g.id === saved)) setSelectedGuideId(saved);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [open, messages]);

  const selectGuide = (g: Guide) => {
    setSelectedGuideId(g.id);
    localStorage.setItem('rvunicorn_guide', g.id);
    setShowGuideSelector(false);
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/chat', {
        message: msg,
        history: newMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        userContext,
        guideId: selectedGuideId,
      });
      const reply = { role: 'assistant' as const, content: data.message, suggestions: data.suggestions || [] };
      setMessages(prev => {
        const updated = [...prev, reply];
        // Trigger chime-in check after reply lands
        setTimeout(async () => {
          try {
            const chimeRes = await api.post('/guide-unlocks/chime-in', {
              guideId: selectedGuideId,
              lastMessage: data.message,
            });
            if (chimeRes.data?.chimeIn) {
              setChimeIns(c => ({ ...c, [updated.length - 1]: chimeRes.data.chimeIn }));
            }
          } catch {}
        }, 800);
        return updated;
      });
      if (!open) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had a hiccup! Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (index: number, rating: 'up' | 'down', question: string, answer: string) => {
    setFeedback(f => ({ ...f, [index]: rating }));
    try { await api.post('/hitch/feedback', { rating, question, answer: answer.substring(0, 200), guideId: selectedGuideId }); } catch {}
  };

  const getSuggestionLink = (s: any) => {
    if (s.type === 'campground') return `/campgrounds/${s.id}`;
    if (s.type === 'host') return `/hosts/${s.id}`;
    return `/overnight-spots/${s.id}`;
  };

  const quickPrompts: Record<string, string[]> = {
    hitch: ['Find campgrounds near me', 'Plan a route', 'Free overnight spots', 'My badges'],
    walter: ["What's the worst thing about RV camping?", "Roast a campground type", "What should I avoid?", "Give it to me straight"],
    rose: ['Wineries near campgrounds', 'Best glamping spots', 'Most scenic campgrounds', 'Couples retreat ideas'],
    scout: ['Best hiking near campgrounds', 'Hidden gem campgrounds', 'Boondocking spots', 'National park tips'],
    diesel: ['Can my 40ft rig fit?', 'Big rig friendly campgrounds', 'Check campground access', 'Full hookup spots'],
    luna: ['Pet-friendly campgrounds', 'Best campgrounds for kids', 'Family packing tips', 'Campground with playground'],
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
        <div className={`fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all ${minimized ? 'h-14' : 'h-[540px]'} flex flex-col`}>

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
                <button key={g.id} onClick={() => { if (g.id === "hitch" || isUnlocked(g.id)) selectGuide(g); }}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition text-left ${g.id === selectedGuideId ? 'bg-gray-100' : ''}`}>
                  {g.avatarUrl
                    ? <img src={g.avatarUrl} alt={g.name} className="w-8 h-8 rounded-full object-cover" />
                    : <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${g.bgGradient} flex items-center justify-center text-sm`}>{g.emoji}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{g.name}</p>
                    <p className="text-xs text-gray-500 truncate">{g.tagline}</p>
                  </div>
                  {g.id === selectedGuideId && <span className="text-xs font-bold" style={{ color: g.accentColor }}>Active</span>}
                  {g.id !== "hitch" && !isUnlocked(g.id) && (
                    <div className="flex items-center gap-0.5 ml-auto">
                      <Lock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">{getProgress(g.id).filter(c => c.met).length}/{getProgress(g.id).length}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3" onClick={() => setShowGuideSelector(false)}>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'assistant' && (
                      guide.avatarUrl
                        ? <img src={guide.avatarUrl} alt={guide.name} className="w-6 h-6 rounded-full object-cover shrink-0 mt-1" />
                        : <div className={`w-6 h-6 rounded-full shrink-0 mt-1 bg-gradient-to-br ${guide.bgGradient} flex items-center justify-center text-xs`}>{guide.emoji}</div>
                    )}
                    <div className="max-w-[85%] space-y-1.5">
                      <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && i > 0 && (
                        <div className="flex gap-1.5 mt-0.5">
                          <button onClick={() => sendFeedback(i, 'up', messages[i-1]?.content || '', msg.content)}
                              className={`p-1 rounded transition ${feedback[i] === 'up' ? 'text-green-600' : 'text-gray-300 hover:text-green-500'}`}><ThumbsUp className="w-3 h-3" /></button>
                          <button onClick={() => sendFeedback(i, 'down', messages[i-1]?.content || '', msg.content)}
                              className={`p-1 rounded transition ${feedback[i] === 'down' ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}><ThumbsDown className="w-3 h-3" /></button>
                        </div>
                      )}
                      {msg.role === "assistant" && chimeIns[i - 1] && (() => {
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
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
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
