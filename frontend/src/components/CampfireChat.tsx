import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

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
interface Props {
  campgroundId: string;
  campgroundName: string;
  isUserCheckedIn?: boolean;
}

const API = import.meta.env.VITE_API_URL || '';
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

  const loadMessages = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
    const headers: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API}/api/campfire/${campgroundId}/room/status`, { headers })
      .then(r => r.json()).then(setStatus).catch(console.error);
    fetch(`${API}/api/campfire/${campgroundId}/room/messages`, { headers })
      .then(r => r.json()).then(d => setMessages(d.messages || [])).catch(console.error);
  };

  useEffect(() => {
    loadMessages();
    // Poll every 10 seconds as fallback when WebSocket misses messages
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [campgroundId]);

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
    socket.on('trivia:question', (q: any) => {
      const triviaMsg: ChatMessage = {
        id: `trivia-${q.questionId}-${Date.now()}`,
        content: `🎯 Question ${q.questionNum}/10 · ${q.category}\n\n${q.question}\n\nA) ${q.options?.A}\nB) ${q.options?.B}\nC) ${q.options?.C}\nD) ${q.options?.D}`,
        createdAt: q.askedAt || new Date().toISOString(),
        isSystem: false,
        isHitch: true,
        user: undefined,
      };
      setMessages(prev => [...prev, triviaMsg]);
    });
    socket.on('room:activated', () => setStatus(prev => prev ? { ...prev, isActive: true } : null));
    return () => { socket.disconnect(); };
  }, [campgroundId, user?.id]);

  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit('message:send', { content: input.trim() });
    setInput('');
  }, [input]);

  if (!status) return <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>;

  // Campfire is open to all — no check-in required to read or chat

  if (false) { // room activates for any checked-in user
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 text-center">
        <div className="text-3xl mb-2">🔥</div>
        <h3 className="font-semibold text-gray-800 mb-1">Campfire Chat</h3>
        <p className="text-sm text-gray-500 mb-3">
          {status.checkedInCount === 0 ? 'Check in to light the campfire.' : `${status.checkedInCount} camper${status.checkedInCount > 1 ? 's' : ''} here — need ${status.needsMore} more to start the fire!`}
        </p>
        <div className="flex justify-center gap-2 mb-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${i < status.checkedInCount ? 'bg-orange-400 text-white' : 'bg-gray-200 text-gray-400'}`}>
              {i < status.checkedInCount ? '🏕️' : '?'}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">Trivia starts at 5:30 PM once the fire is lit</p>
      </div>
    );
  }

  return (
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
              <span>{u.firstName || u.username}</span>
              {u.triviaTitle && <span className="text-[9px] text-orange-400 ml-0.5">{u.triviaTitle}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
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
                {!isMe && <div className="text-xs text-gray-400 mb-0.5 px-1">{name}</div>}
                <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-orange-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>{msg.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Chat with your campsite neighbors…"
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
  );
}
