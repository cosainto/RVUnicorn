import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { X, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

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
interface Props {
  campgroundId: string;
  campgroundName: string;
  isUserCheckedIn?: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || '';
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function CampfireChat({ campgroundId, campgroundName, isUserCheckedIn = true }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<{ isActive: boolean; checkedInCount: number; checkedInUsers: ChatUser[]; needsMore: number } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Trivia state
  const [activeTrivia, setActiveTrivia] = useState<TriviaQuestion | null>(null);
  const [showTriviaModal, setShowTriviaModal] = useState(false);
  const [triviaSelected, setTriviaSelected] = useState<string | null>(null);
  const [triviaResult, setTriviaResult] = useState<{ isCorrect: boolean; points: number; correctAnswer: string } | null>(null);
  const [triviaTimeLeft, setTriviaTimeLeft] = useState(0);
  const triviaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
    const headers: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_URL}/api/campfire/${campgroundId}/room/status`, { headers })
      .then(r => r.json()).then(setStatus).catch(console.error);
    fetch(`${API_URL}/api/campfire/${campgroundId}/room/messages`, { headers })
      .then(r => r.json()).then(d => setMessages(d.messages || [])).catch(console.error);
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => {
      if (!connected) loadMessages();
    }, 10000);
    return () => clearInterval(interval);
  }, [campgroundId, connected]);

  // Handle incoming trivia question
  const handleTriviaQuestion = useCallback((q: TriviaQuestion) => {
    // Don't replace if user is mid-answer on same question
    if (activeTrivia?.questionId === q.questionId) return;
    setActiveTrivia(q);
    setTriviaSelected(null);
    setTriviaResult(null);
    // If modal isn't open, show notification; if it is, update the question
    if (showTriviaModal) {
      startTriviaTimer(q);
    }
  }, [activeTrivia, showTriviaModal]);

  const startTriviaTimer = useCallback((q: TriviaQuestion) => {
    if (triviaTimerRef.current) clearInterval(triviaTimerRef.current);
    const elapsed = Math.floor((Date.now() - new Date(q.askedAt).getTime()) / 1000);
    const remaining = Math.max(0, q.timeLimit - elapsed);
    setTriviaTimeLeft(remaining);
    if (remaining <= 0) return;
    triviaTimerRef.current = setInterval(() => {
      setTriviaTimeLeft(prev => {
        if (prev <= 1) {
          if (triviaTimerRef.current) clearInterval(triviaTimerRef.current);
          return 0;
        }
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
        questionId: activeTrivia.questionId,
        answer,
        answeredAt: new Date().toISOString(),
      });
      if (data.isCorrect !== undefined) {
        setTriviaResult(data);
      }
      // Auto-close modal after showing result
      setTimeout(() => {
        setShowTriviaModal(false);
        setActiveTrivia(null);
        setTriviaSelected(null);
        setTriviaResult(null);
        if (triviaTimerRef.current) clearInterval(triviaTimerRef.current);
      }, 3000);
    } catch (e) {
      console.error('Answer error:', e);
    }
  }, [activeTrivia, triviaSelected, campgroundId]);

  useEffect(() => {
    if (!user?.id) return;
    const socket = io(`${SOCKET_URL}/campfire`, {
      query: { campgroundId, userId: user.id },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('presence:update', (users: ChatUser[]) => {
      setStatus(prev => prev ? { ...prev, checkedInUsers: users, checkedInCount: users.length, needsMore: 0 } : null);
    });
    socket.on('message:new', (msg: ChatMessage) => setMessages(prev => [...prev, msg]));
    // Trivia question arrives via socket — set as active, don't render in chat
    socket.on('trivia:question', handleTriviaQuestion);
    socket.on('trivia:sponsored-question', handleTriviaQuestion);
    socket.on('room:activated', () => setStatus(prev => prev ? { ...prev, isActive: true } : null));
    return () => { socket.disconnect(); };
  }, [campgroundId, user?.id, handleTriviaQuestion]);

  // Poll for active question as fallback
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
          if (elapsed < data.question.timeLimit + 10) {
            setActiveTrivia(data.question);
          }
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [campgroundId, activeTrivia]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (triviaTimerRef.current) clearInterval(triviaTimerRef.current); }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);

  useEffect(() => {
    if (!scrollRef.current || userScrolled.current) return;
    const el = scrollRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(() => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit('message:send', { content: input.trim() });
    setInput('');
  }, [input]);

  if (!status) return <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>;

  const timerPct = activeTrivia ? (triviaTimeLeft / (activeTrivia.timeLimit || 120)) * 100 : 0;

  return (
    <>
      <div className="rounded-xl border border-orange-200 overflow-hidden bg-white flex flex-col" style={{ height: '500px' }}>
        <div className="px-4 py-2 flex items-center justify-between border-b border-orange-100 bg-orange-50/50">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUsers(v => !v)} className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs px-2 py-1 rounded-full transition">
              <span>🏕️</span><span>{status.checkedInCount} here</span>
            </button>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            {!connected && <span className="text-xs text-red-500">Reconnecting...</span>}
          </div>
        </div>

        {showUsers && (
          <div className="border-b border-orange-100 bg-orange-50 px-4 py-2 flex gap-2 flex-wrap">
            {status.checkedInUsers.map(u => (
              <div key={u.id} className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-orange-100 rounded-full px-2 py-1">
                {u.profileImage ? <img src={u.profileImage} className="w-4 h-4 rounded-full object-cover" alt="" /> : <div className="w-4 h-4 rounded-full bg-orange-200 flex items-center justify-center text-[9px]">{(u.firstName || u.username || '?')[0].toUpperCase()}</div>}
                <Link to={`/profile/${u.username || u.id}`} className="hover:underline hover:text-orange-500 transition">{u.firstName || u.username}</Link>
                {u.triviaTitle && <span className="text-[9px] text-orange-400 ml-0.5">{u.triviaTitle}</span>}
              </div>
            ))}
          </div>
        )}

        <div ref={scrollRef} onScroll={() => { if (scrollRef.current) { const el = scrollRef.current; userScrolled.current = el.scrollHeight - el.scrollTop - el.clientHeight > 150; } }} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && <div className="text-center text-gray-400 text-sm mt-8">The fire's just getting started… 🔥</div>}
          {messages.map(msg => {
            if (msg.isSystem) return (
              <div key={msg.id} className="text-center">
                <span className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full">{msg.content}</span>
              </div>
            );
            if (msg.isHitch) return (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">🦄</div>
                <div>
                  <div className="text-xs font-semibold text-purple-700 mb-0.5">Hitch</div>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl rounded-tl-none px-3 py-2 text-sm text-gray-800 max-w-xs">{msg.content}</div>
                </div>
              </div>
            );
            const isMe = msg.user?.id === user?.id;
            const name = msg.user?.firstName || msg.user?.username || 'Camper';
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && (msg.user?.profileImage
                  ? <img src={msg.user.profileImage} className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" alt="" />
                  : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500 flex-shrink-0 mb-0.5">{name[0].toUpperCase()}</div>
                )}
                <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <div className="text-xs text-gray-400 mb-0.5 px-1"><Link to={`/profile/${msg.user?.username || msg.user?.id}`} className="font-semibold hover:underline hover:text-orange-500 transition">{name}</Link></div>}
                  <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-orange-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>{msg.content}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Trivia notification button — pulsing banner above input */}
        {activeTrivia && !showTriviaModal && (
          <button
            onClick={openTriviaModal}
            className="mx-3 mb-1 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl px-3 py-2.5 text-left transition-all shadow-lg animate-pulse"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 text-base">🎯</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-xs">Question {activeTrivia.questionNum} of {activeTrivia.total} is live!</p>
              <p className="text-purple-200 text-[10px]">{activeTrivia.category}</p>
            </div>
            <span className="text-white/80 text-xs font-medium flex-shrink-0">Tap to answer →</span>
          </button>
        )}

        <div className="border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
          <input
            type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Chat with your campsite neighbors… · @Hitch for AI"
            disabled={!connected}
            className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 disabled:text-gray-400"
            maxLength={500}
          />
          <button onClick={send} disabled={!input.trim() || !connected}
            className="w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center disabled:opacity-40 transition flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>

      {/* Trivia Answer Modal — full overlay */}
      {showTriviaModal && activeTrivia && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeTriviaModal}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm">🎯</span>
                  <span className="text-white text-sm font-semibold">Question {activeTrivia.questionNum}/{activeTrivia.total}</span>
                  <span className="text-purple-200 text-xs bg-purple-700/50 px-2 py-0.5 rounded-full">{activeTrivia.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-white font-mono font-bold text-sm px-2 py-0.5 rounded-lg ${triviaTimeLeft <= 10 ? 'bg-red-500 animate-pulse' : 'bg-purple-700/50'}`}>
                    {triviaTimeLeft}s
                  </div>
                  <button onClick={closeTriviaModal} className="text-white/60 hover:text-white transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Timer bar */}
              <div className="h-1.5 bg-purple-800/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${timerPct > 60 ? 'bg-green-500' : timerPct > 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-gray-800 font-medium text-sm leading-relaxed">{activeTrivia.question}</p>
            </div>

            {/* Answer buttons */}
            <div className="px-4 pb-4 grid grid-cols-1 gap-2">
              {(Object.entries(activeTrivia.options) as [string, string][]).map(([key, val]) => {
                const isSelected = triviaSelected === key;
                const isCorrect = triviaResult?.correctAnswer === key;
                const isWrong = isSelected && triviaResult && !triviaResult.isCorrect;

                let cls = 'w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition flex items-center gap-3 ';
                if (!triviaSelected) {
                  cls += 'border-gray-200 bg-gray-50 hover:bg-purple-500 hover:text-white hover:border-purple-500 cursor-pointer';
                } else if (!triviaResult) {
                  cls += isSelected
                    ? 'bg-purple-500 border-purple-600 text-white'
                    : 'border-gray-100 bg-gray-50 text-gray-300';
                } else if (isCorrect) {
                  cls += 'bg-green-500 border-green-600 text-white';
                } else if (isWrong) {
                  cls += 'bg-red-500 border-red-600 text-white';
                } else {
                  cls += 'border-gray-100 bg-gray-50 text-gray-300';
                }

                return (
                  <button
                    key={key}
                    onClick={() => submitTriviaAnswer(key)}
                    disabled={!!triviaSelected || triviaTimeLeft === 0}
                    className={cls}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      !triviaSelected ? 'bg-gray-200 text-gray-600' : isCorrect ? 'bg-white/30 text-white' : isWrong ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>{key}</span>
                    <span className="flex-1">{val}</span>
                    {isCorrect && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                    {isWrong && <XCircle className="w-5 h-5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Result */}
            {triviaResult && (
              <div className={`mx-4 mb-4 px-4 py-3 rounded-xl text-center text-sm font-semibold ${
                triviaResult.isCorrect ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {triviaResult.isCorrect
                  ? `✅ Correct! +${triviaResult.points} points`
                  : `❌ The answer was ${triviaResult.correctAnswer}`}
              </div>
            )}

            {/* Time's up */}
            {triviaTimeLeft === 0 && !triviaSelected && (
              <div className="mx-4 mb-4 px-4 py-3 rounded-xl text-center text-sm text-gray-500 bg-gray-50 border border-gray-200">
                ⏰ Time's up!
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
