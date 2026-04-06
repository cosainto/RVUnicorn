import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { X, CheckCircle, XCircle, Flame } from 'lucide-react';
import api from '../services/api';
import { getCharacter } from '../utils/characters';

interface ChatUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  triviaTitle?: string;
}
interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  isSystem: boolean;
  isHitch: boolean;
  isPulse?: boolean;
  user?: ChatUser;
}
interface TriviaQuestion {
  questionId: string;
  questionNum: number;
  total: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  category: string;
  timeLimit: number;
  askedAt: string;
}
interface PulseEvent {
  type: string;
  text: string;
  createdAt: string;
  userId?: string;
  userName?: string;
}
interface Props {
  campgroundId: string;
  campgroundName: string;
  isUserCheckedIn?: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || '';
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PLACEHOLDERS = [
  '🔥 Say something to the campfire...',
  'Ask a fellow camper...',
  'Type @Hitch to get his attention...',
  'Share what\'s happening at your site...',
];

export default function CampfireChat({ campgroundId, campgroundName, isUserCheckedIn = true }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<{ isActive: boolean; checkedInCount: number; checkedInUsers: ChatUser[]; needsMore: number } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pulseEvents, setPulseEvents] = useState<PulseEvent[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showMentionHint, setShowMentionHint] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // Companion system
  const [companionMsgs, setCompanionMsgs] = useState<{ role: 'user' | 'assistant'; content: string; character?: string; image?: string }[]>([]);
  const [companionChar, setCompanionChar] = useState<string | null>(null);
  const [companionImage, setCompanionImage] = useState<string | null>(null);
  const [companionThinking, setCompanionThinking] = useState(false);
  const [companionActive, setCompanionActive] = useState(false);
  const [isLurkMode, setIsLurkMode] = useState(false);
  const [isQuietMode, setIsQuietMode] = useState(false);
  const [openerSent, setOpenerSent] = useState(false);
  const [userResponded, setUserResponded] = useState(false);
  const lurkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const companionHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Trivia state (preserved from original)
  const [activeTrivia, setActiveTrivia] = useState<TriviaQuestion | null>(null);
  const [showTriviaModal, setShowTriviaModal] = useState(false);
  const [triviaSelected, setTriviaSelected] = useState<string | null>(null);
  const [triviaResult, setTriviaResult] = useState<{ isCorrect: boolean; points: number; correctAnswer: string } | null>(null);
  const [triviaTimeLeft, setTriviaTimeLeft] = useState(0);
  const triviaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Weather + time
  const [weather, setWeather] = useState<{ temp?: number; condition?: string; sunset?: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));

  useEffect(() => {
    api.get(`/weather/${campgroundId}`).then(r => {
      const w = r.data;
      setWeather({ temp: w.temperature ?? w.temp, condition: w.condition || w.description, sunset: w.sunset });
    }).catch(() => {});
  }, [campgroundId]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })), 60000);
    return () => clearInterval(t);
  }, []);

  // Rotating placeholder
  useEffect(() => {
    const interval = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 10000);
    return () => clearInterval(interval);
  }, []);

  // @mention detection
  useEffect(() => {
    setShowMentionHint(input.endsWith('@'));
  }, [input]);

  const loadMessages = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
    const headers: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_URL}/api/campfire/${campgroundId}/room/status`, { headers })
      .then(r => r.json()).then(setStatus).catch(console.error);
    fetch(`${API_URL}/api/campfire/${campgroundId}/room/messages`, { headers })
      .then(r => r.json()).then(d => setMessages(d.messages || [])).catch(console.error);
  };

  // Load pulse feed
  const loadPulse = () => {
    fetch(`${API_URL}/api/campgrounds/${campgroundId}/pulse-feed`)
      .then(r => r.json())
      .then(d => setPulseEvents(d.events || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadMessages();
    loadPulse();
    const msgInterval = setInterval(() => { if (!connected) loadMessages(); }, 10000);
    const pulseInterval = setInterval(loadPulse, 60000);
    return () => { clearInterval(msgInterval); clearInterval(pulseInterval); };
  }, [campgroundId, connected]);

  // Companion trigger — activate when chat is quiet
  useEffect(() => {
    if (!user || !campgroundId || openerSent || isLurkMode) return;
    const activeCount = status?.checkedInCount || 0;
    if (activeCount >= 3) { setIsQuietMode(true); return; }
    if (isQuietMode) setIsQuietMode(false);

    const timer = setTimeout(async () => {
      try {
        const chars = ['HITCH', 'WALLET', 'WALTER', 'SCOUT'];
        const char = chars[Math.floor(Math.random() * chars.length)];
        setCompanionThinking(true);
        const { data } = await api.post('/chat/companion-opener', { userId: user.id, campgroundId, character: char });
        if (!data.enabled) { setCompanionThinking(false); return; }
        setCompanionChar(data.character);
        setCompanionImage(data.image);
        setCompanionMsgs([{ role: 'assistant', content: data.message, character: data.character, image: data.image }]);
        companionHistoryRef.current = [{ role: 'assistant', content: data.message }];
        setCompanionActive(true);
        setCompanionThinking(false);
        setOpenerSent(true);
        // Lurk timer — 15s without response
        lurkTimerRef.current = setTimeout(() => { if (!userResponded) setIsLurkMode(true); }, 15000);
      } catch { setCompanionThinking(false); }
    }, 8000);
    return () => clearTimeout(timer);
  }, [user?.id, campgroundId, status?.checkedInCount, openerSent, isLurkMode]);

  // Send message to companion
  const sendToCompanion = async (msg: string) => {
    if (isLurkMode || isQuietMode || !companionChar) return;
    if (lurkTimerRef.current) { clearTimeout(lurkTimerRef.current); lurkTimerRef.current = null; }
    setUserResponded(true);

    let targetChar = companionChar;
    const mention = msg.match(/@(Hitch|Wallet|Walter|Scout)/i);
    if (mention) targetChar = mention[1].toUpperCase();

    setCompanionMsgs(prev => [...prev, { role: 'user', content: msg }]);
    companionHistoryRef.current.push({ role: 'user', content: msg });
    setCompanionThinking(true);

    try {
      const { data } = await api.post('/chat/companion-reply', {
        userId: user!.id, campgroundId, character: targetChar,
        conversationHistory: companionHistoryRef.current.slice(-10), userMessage: msg,
      });
      companionHistoryRef.current.push({ role: 'assistant', content: data.message });
      setCompanionMsgs(prev => [...prev, { role: 'assistant', content: data.message, character: data.character, image: data.image }]);
    } catch {}
    setCompanionThinking(false);
  };

  // All trivia handlers (preserved)
  const handleTriviaQuestion = useCallback((q: TriviaQuestion) => {
    if (activeTrivia?.questionId === q.questionId) return;
    setActiveTrivia(q);
    setTriviaSelected(null);
    setTriviaResult(null);
    if (showTriviaModal) startTriviaTimer(q);
    // Inject trivia pulse into feed
    const triviaMsg: ChatMessage = {
      id: `trivia-pulse-${q.questionId}`,
      content: `🎯 Question ${q.questionNum} of ${q.total} is live — tap the banner to answer!`,
      createdAt: q.askedAt || new Date().toISOString(),
      isSystem: false, isHitch: false, isPulse: true,
    };
    setMessages(prev => [...prev, triviaMsg]);
  }, [activeTrivia, showTriviaModal]);

  const startTriviaTimer = useCallback((q: TriviaQuestion) => {
    if (triviaTimerRef.current) clearInterval(triviaTimerRef.current);
    const elapsed = Math.floor((Date.now() - new Date(q.askedAt).getTime()) / 1000);
    const remaining = Math.max(0, q.timeLimit - elapsed);
    setTriviaTimeLeft(remaining);
    if (remaining <= 0) return;
    triviaTimerRef.current = setInterval(() => {
      setTriviaTimeLeft(prev => {
        if (prev <= 1) { if (triviaTimerRef.current) clearInterval(triviaTimerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const openTriviaModal = useCallback(() => {
    if (!activeTrivia) return;
    setShowTriviaModal(true);
    setTriviaSelected(null);
    setTriviaResult(null);
    startTriviaTimer(activeTrivia);
  }, [activeTrivia, startTriviaTimer]);

  const closeTriviaModal = useCallback(() => {
    setShowTriviaModal(false);
    if (triviaTimerRef.current) clearInterval(triviaTimerRef.current);
  }, []);

  const submitTriviaAnswer = useCallback(async (answer: string) => {
    if (!activeTrivia || triviaSelected) return;
    setTriviaSelected(answer);
    try {
      const { data } = await api.post(`/campfire/${campgroundId}/answer`, {
        questionId: activeTrivia.questionId, answer, answeredAt: new Date().toISOString(),
      });
      if (data.isCorrect !== undefined) setTriviaResult(data);
      setTimeout(() => {
        setShowTriviaModal(false); setActiveTrivia(null); setTriviaSelected(null); setTriviaResult(null);
        if (triviaTimerRef.current) clearInterval(triviaTimerRef.current);
      }, 3000);
    } catch (e) { console.error('Answer error:', e); }
  }, [activeTrivia, triviaSelected, campgroundId]);

  // Socket connection (preserved)
  useEffect(() => {
    if (!user?.id) return;
    const socket = io(`${SOCKET_URL}/campfire`, {
      query: { campgroundId, userId: user.id },
      withCredentials: true, transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('presence:update', (users: ChatUser[]) => {
      setStatus(prev => prev ? { ...prev, checkedInUsers: users, checkedInCount: users.length, needsMore: 0 } : null);
    });
    socket.on('message:new', (msg: ChatMessage) => setMessages(prev => [...prev, msg]));
    socket.on('trivia:question', handleTriviaQuestion);
    socket.on('trivia:sponsored-question', handleTriviaQuestion);
    socket.on('room:activated', () => setStatus(prev => prev ? { ...prev, isActive: true } : null));
    return () => { socket.disconnect(); };
  }, [campgroundId, user?.id, handleTriviaQuestion]);

  // Trivia poll fallback (preserved)
  useEffect(() => {
    if (!campgroundId) return;
    const poll = async () => {
      if (activeTrivia) return;
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
        const res = await fetch(`${API_URL}/api/campfire/${campgroundId}/active-question`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.question) {
          const elapsed = Math.floor((Date.now() - new Date(data.question.askedAt).getTime()) / 1000);
          if (elapsed < data.question.timeLimit + 5) setActiveTrivia(data.question);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [campgroundId, activeTrivia]);

  useEffect(() => () => { if (triviaTimerRef.current) clearInterval(triviaTimerRef.current); }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);

  useEffect(() => {
    if (!scrollRef.current || userScrolled.current) return;
    const el = scrollRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(() => {
    if (!input.trim()) return;
    const msg = input.trim();

    // Check if this is directed at a companion (@Hitch, @Wallet, etc.)
    const isCompanionMsg = /^@(Hitch|Wallet|Walter|Scout)\b/i.test(msg) || (companionActive && !isLurkMode && !isQuietMode && messages.length < 3);

    if (isCompanionMsg && companionActive) {
      sendToCompanion(msg);
    }

    // Also send to regular chat if socket is connected
    if (socketRef.current) {
      socketRef.current.emit('message:send', { content: msg });
    }

    setInput('');
    setShowMentionHint(false);
    setShowMentionDropdown(false);
  }, [input, companionActive, isLurkMode, isQuietMode, messages.length]);

  const insertMention = (name: string) => {
    setInput(prev => prev.replace(/@$/, `@${name} `));
    setShowMentionHint(false);
  };

  if (!status) return <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>;

  // Merge pulse events into feed
  const pulseMessages: ChatMessage[] = pulseEvents.map(p => ({
    id: `pulse-${p.type}-${p.createdAt}`,
    content: p.text,
    createdAt: p.createdAt,
    isSystem: false, isHitch: false, isPulse: true,
  }));

  // Combine and sort all feed items
  const allMessages = [...messages, ...pulseMessages]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Group consecutive messages from same user
  const shouldShowName = (msg: ChatMessage, idx: number) => {
    if (msg.isSystem || msg.isHitch || msg.isPulse || !msg.user) return false;
    if (idx === 0) return true;
    const prev = allMessages[idx - 1];
    return prev.user?.id !== msg.user.id || prev.isSystem || prev.isHitch || prev.isPulse;
  };

  const timerPct = activeTrivia ? (triviaTimeLeft / (activeTrivia.timeLimit || 10)) * 100 : 0;

  return (
    <>
      <div className="rounded-xl border border-orange-200 overflow-hidden bg-[#FFF8F0] flex flex-col" style={{ height: '500px' }}>
        {/* Pulse Header */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-orange-100 bg-gradient-to-r from-[#1B2B4B] to-[#2d4a7a]">
          <div className="flex items-center gap-2">
            <span className="text-base">🔥</span>
            <span className="text-white font-bold text-sm">Campfire</span>
            <span className="text-white/40 text-sm">·</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              <button onClick={() => setShowUsers(v => !v)} className="text-white/70 hover:text-white text-xs transition">
                {status.checkedInCount} campers here now
              </button>
            </div>
          </div>
          {!connected && <span className="text-[10px] text-red-300">Reconnecting...</span>}
        </div>

        {/* Time + Weather bar */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-orange-100 bg-gradient-to-r from-sky-50 to-orange-50">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>{'\u{1F552}'} {currentTime}</span>
          </div>
          {weather && (
            <div className="flex items-center gap-3 text-xs text-gray-600">
              {weather.temp != null && <span>{weather.temp}°F {weather.condition || ''}</span>}
              {weather.sunset && <span>{'\u{1F305}'} Sunset {weather.sunset}</span>}
            </div>
          )}
        </div>

        {/* Checked-in users dropdown */}
        {showUsers && (
          <div className="border-b border-orange-100 bg-white px-4 py-2 flex gap-2 flex-wrap">
            {status.checkedInUsers.map(u => (
              <Link key={u.id} to={`/profile/${u.username || u.id}`} className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-full px-2 py-1 hover:bg-orange-50 transition">
                {u.profileImage ? <img src={u.profileImage} className="w-4 h-4 rounded-full object-cover" alt="" /> : <div className="w-4 h-4 rounded-full bg-orange-200 flex items-center justify-center text-[9px]">{(u.firstName || u.username || '?')[0].toUpperCase()}</div>}
                <span>{u.firstName || u.username}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Feed */}
        <div ref={scrollRef} onScroll={() => { if (scrollRef.current) { const el = scrollRef.current; userScrolled.current = el.scrollHeight - el.scrollTop - el.clientHeight > 150; } }} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {allMessages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🔥</div>
              <p className="text-sm font-semibold text-gray-700">The fire's just getting started.</p>
              <p className="text-xs text-gray-400 mt-1">Be the first to say something — or just wait for Hitch to get warmed up.</p>
            </div>
          )}

          {allMessages.map((msg, idx) => {
            // LAYER 1 — Ambient Pulse
            if (msg.isPulse || msg.isSystem) return (
              <div key={msg.id} className="flex justify-center py-0.5">
                <span className="text-[11px] bg-[#1B2B4B]/8 text-gray-500 px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );

            // LAYER 2 — Character Messages (Hitch, Walter, Wallet, etc.)
            if (msg.isHitch) {
              // Detect character from message content or default to Hitch
              const charNames = ['walter', 'wallet', 'rose', 'rosé', 'diesel', 'scout', 'luna', 'ranger rick', 'pebble'];
              const contentLower = msg.content.toLowerCase();
              let charKey = 'hitch';
              // Check if message starts with a character attribution like "— Walter" or is from a known character
              for (const cn of charNames) {
                if (contentLower.startsWith(cn) || contentLower.includes(`— ${cn}`) || contentLower.includes(`- ${cn}`)) {
                  charKey = cn;
                  break;
                }
              }
              const character = getCharacter(charKey);
              return (
                <div key={msg.id} className="flex items-start gap-2 max-w-[85%]">
                  <img src={character.image} alt={character.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5 shadow-md border border-[#C9A84C]/30" />
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-[#C9A84C] mb-0.5">{character.name}</div>
                    <div className="bg-[#1B2B4B] text-white rounded-xl rounded-tl-none px-3 py-2 text-sm leading-relaxed border-l-[3px] border-[#C9A84C]"
                      style={{ boxShadow: '0 2px 12px rgba(232, 98, 42, 0.15)' }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            }

            // LAYER 3 — Camper Chat
            const isMe = msg.user?.id === user?.id;
            const name = msg.user?.firstName || msg.user?.username || 'Camper';
            const showName = shouldShowName(msg, idx);

            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && showName && (msg.user?.profileImage
                  ? <img src={msg.user.profileImage} className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" alt="" />
                  : <div className="w-6 h-6 rounded-full bg-orange-200 flex items-center justify-center text-[10px] text-orange-700 font-bold flex-shrink-0 mb-0.5">{name[0].toUpperCase()}</div>
                )}
                {!isMe && !showName && <div className="w-6 flex-shrink-0" />}
                <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && showName && (
                    <div className="text-[10px] text-gray-400 mb-0.5 px-1">
                      <Link to={`/profile/${msg.user?.username || msg.user?.id}`} className="font-semibold hover:underline hover:text-orange-500 transition">{name}</Link>
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-xl text-sm ${
                    isMe
                      ? 'bg-[#E8622A] text-white rounded-br-none'
                      : 'bg-white text-gray-800 rounded-bl-none border border-orange-100'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
          {/* Companion messages */}
          {companionMsgs.map((cm, i) => (
            <div key={`companion-${i}`} className={cm.role === 'user' ? 'flex justify-end' : 'flex items-start gap-2 max-w-[70%]'} style={{ animation: 'fadeIn 0.3s ease' }}>
              {cm.role === 'assistant' && cm.image && <img src={cm.image} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />}
              {cm.role === 'assistant' ? (
                <div>
                  {cm.character && <span className="text-[10px] font-bold block mb-0.5" style={{ color: { HITCH: '#E8A838', WALLET: '#2ECC71', WALTER: '#7B68EE', SCOUT: '#D4621A' }[cm.character] || '#E8A838' }}>{cm.character.charAt(0) + cm.character.slice(1).toLowerCase()}</span>}
                  <div className="rounded-xl rounded-tl-none px-3 py-2 text-[13px] leading-relaxed" style={{ background: '#1B2E50', color: '#F5F0E8' }}>{cm.content}</div>
                </div>
              ) : (
                <div className="max-w-[70%] rounded-2xl rounded-br-sm px-3 py-2 text-[13px]" style={{ background: 'rgba(232,168,56,0.15)', color: '#F5F0E8' }}>{cm.content}</div>
              )}
            </div>
          ))}
          {companionThinking && companionChar && (
            <div className="flex items-center gap-2">
              {companionImage && <img src={companionImage} alt="" className="w-7 h-7 rounded-full object-cover" />}
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl" style={{ background: '#1B2E50' }}>
                {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: { HITCH: '#E8A838', WALLET: '#2ECC71', WALTER: '#7B68EE', SCOUT: '#D4621A' }[companionChar] || '#E8A838', animationDelay: `${i * 0.15}s` }} />)}
                <span className="text-[10px] ml-1.5" style={{ color: 'rgba(245,240,232,0.4)' }}>{companionChar.charAt(0) + companionChar.slice(1).toLowerCase()} is thinking...</span>
              </div>
            </div>
          )}
          {isQuietMode && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg text-[11px]" style={{ background: 'rgba(232,168,56,0.08)', color: 'rgba(232,168,56,0.7)', border: '1px solid rgba(232,168,56,0.15)' }}>
              <span>Campfire's picking up — companions are stepping back {'\u{1F525}'}</span>
              <button onClick={() => setIsQuietMode(false)} className="ml-2 hover:opacity-70">✕</button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Trivia notification banner */}
        {activeTrivia && !showTriviaModal && (
          <button onClick={openTriviaModal}
            className="mx-3 mb-1 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl px-3 py-2.5 text-left transition-all shadow-lg animate-pulse">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 text-base">🎯</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-xs">Question {activeTrivia.questionNum} of {activeTrivia.total} is live!</p>
              <p className="text-purple-200 text-[10px]">{activeTrivia.category}</p>
            </div>
            <span className="text-white/80 text-xs font-medium flex-shrink-0">Tap to answer →</span>
          </button>
        )}

        {/* @mention hint chips */}
        {showMentionHint && (
          <div className="px-3 pb-1 flex gap-1.5 flex-wrap">
            {['Hitch', 'Wallet', 'Walter', 'Ranger Rick'].map(name => (
              <button key={name} onClick={() => insertMention(name)}
                className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium hover:bg-purple-200 transition">
                @{name}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-orange-200 px-3 py-2 flex gap-2 items-center bg-white relative">
          {/* @Mention dropdown */}
          {showMentionDropdown && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl overflow-hidden z-10" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.2)' }}>
              {[
                { name: 'Hitch', desc: 'Mentor & Trail Guide', color: '#E8A838', img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png' },
                { name: 'Wallet', desc: 'Deal Hunter', color: '#2ECC71', img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218458/rvunicorn/guides/wallet_guide.png' },
                { name: 'Walter', desc: 'Nature & Stars', color: '#7B68EE', img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261024/rvunicorn/characters/walter.png' },
                { name: 'Scout', desc: 'Adventure Guide', color: '#D4621A', img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261023/rvunicorn/characters/scout.png' },
              ].filter(c => !mentionQuery || c.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
              .map(c => (
                <button key={c.name} onClick={() => { setInput(prev => prev.replace(/@\w*$/, `@${c.name} `)); setShowMentionDropdown(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#1B2E50] transition">
                  <img src={c.img} alt={c.name} className="w-6 h-6 rounded-full object-cover" />
                  <span className="text-[12px] font-bold" style={{ color: c.color }}>{c.name}</span>
                  <span className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{c.desc}</span>
                </button>
              ))}
            </div>
          )}
          <input
            type="text" value={input}
            onChange={e => {
              setInput(e.target.value);
              const val = e.target.value;
              const atMatch = val.match(/@(\w*)$/);
              if (atMatch) { setShowMentionDropdown(true); setMentionQuery(atMatch[1]); }
              else { setShowMentionDropdown(false); }
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === 'Escape') setShowMentionDropdown(false); }}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            disabled={!connected}
            className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 disabled:text-gray-400 bg-[#FFF8F0]"
            maxLength={500}
          />
          <button onClick={send} disabled={!input.trim() || !connected}
            className="w-9 h-9 rounded-full bg-[#E8622A] hover:bg-[#d4571f] text-white flex items-center justify-center disabled:opacity-40 transition flex-shrink-0">
            <Flame className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Trivia Answer Modal (preserved) */}
      {showTriviaModal && activeTrivia && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeTriviaModal}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm">🎯</span>
                  <span className="text-white text-sm font-semibold">Question {activeTrivia.questionNum}/{activeTrivia.total}</span>
                  <span className="text-purple-200 text-xs bg-purple-700/50 px-2 py-0.5 rounded-full">{activeTrivia.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-white font-mono font-bold text-sm px-2 py-0.5 rounded-lg ${triviaTimeLeft <= 10 ? 'bg-red-500 animate-pulse' : 'bg-purple-700/50'}`}>{triviaTimeLeft}s</div>
                  <button onClick={closeTriviaModal} className="text-white/60 hover:text-white transition"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="h-1.5 bg-purple-800/50 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${timerPct > 60 ? 'bg-green-500' : timerPct > 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${timerPct}%` }} />
              </div>
            </div>
            <div className="px-4 pt-4 pb-2">
              <p className="text-gray-800 font-medium text-sm leading-relaxed">{activeTrivia.question}</p>
            </div>
            <div className="px-4 pb-4 grid grid-cols-1 gap-2">
              {(Object.entries(activeTrivia.options) as [string, string][]).map(([key, val]) => {
                const isSelected = triviaSelected === key;
                const isCorrect = triviaResult?.correctAnswer === key;
                const isWrong = isSelected && triviaResult && !triviaResult.isCorrect;
                let cls = 'w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition flex items-center gap-3 ';
                if (!triviaSelected) cls += 'border-gray-200 bg-gray-50 hover:bg-purple-500 hover:text-white hover:border-purple-500 cursor-pointer';
                else if (!triviaResult) cls += isSelected ? 'bg-purple-500 border-purple-600 text-white' : 'border-gray-100 bg-gray-50 text-gray-300';
                else if (isCorrect) cls += 'bg-green-500 border-green-600 text-white';
                else if (isWrong) cls += 'bg-red-500 border-red-600 text-white';
                else cls += 'border-gray-100 bg-gray-50 text-gray-300';
                return (
                  <button key={key} onClick={() => submitTriviaAnswer(key)} disabled={!!triviaSelected || triviaTimeLeft === 0} className={cls}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${!triviaSelected ? 'bg-gray-200 text-gray-600' : isCorrect ? 'bg-white/30 text-white' : isWrong ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-400'}`}>{key}</span>
                    <span className="flex-1">{val}</span>
                    {isCorrect && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                    {isWrong && <XCircle className="w-5 h-5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            {triviaResult && (
              <div className={`mx-4 mb-4 px-4 py-3 rounded-xl text-center text-sm font-semibold ${triviaResult.isCorrect ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {triviaResult.isCorrect ? `✅ Correct! +${triviaResult.points} points` : `❌ The answer was ${triviaResult.correctAnswer}`}
              </div>
            )}
            {triviaTimeLeft === 0 && !triviaSelected && (
              <div className="mx-4 mb-4 px-4 py-3 rounded-xl text-center text-sm text-gray-500 bg-gray-50 border border-gray-200">⏰ Time's up!</div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </>
  );
}
