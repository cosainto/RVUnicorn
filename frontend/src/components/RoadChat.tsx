import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const SOCKET_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface RoadMessage {
  id: string; content: string; isSystem: boolean;
  isCharacter?: boolean; characterName?: string;
  createdAt: string;
  user: { id: string; firstName: string; profilePicture: string | null };
}

interface RoadChatProps {
  campgroundId?: string; campgroundName?: string; tripComplete?: boolean;
}

const CHAR_COLORS: Record<string, string> = {
  Hitch: 'bg-purple-950 border border-purple-700 text-purple-100',
  Wallet: 'bg-amber-950 border border-amber-700 text-amber-100',
  Walter: 'bg-indigo-950 border border-indigo-700 text-indigo-100',
  'Ranger Rick': 'bg-green-950 border border-green-700 text-green-100',
};

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday) return time;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + time;
}

export default function RoadChat({ campgroundId, campgroundName, tripComplete }: RoadChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<RoadMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [driverCount, setDriverCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const socket = io(`${SOCKET_URL}/road-chat`, {
      query: { userId: user.id, token: localStorage.getItem('token') || '', campgroundId: campgroundId || '', campgroundName: campgroundName || '', tripComplete: tripComplete ? 'true' : 'false' },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('message:new', (msg: RoadMessage) => setMessages(prev => [...prev.slice(-99), msg]));
    socket.on('drivers:update', ({ count }: { count: number }) => setDriverCount(count));
    return () => { socket.disconnect(); };
  }, [user?.id, campgroundId, tripComplete]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit('message:send', { content: input.trim() });
    setInput('');
  }, [input]);

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span>🚐</span>
          <p className="text-sm font-bold text-white">Road Chat</p>
          {tripComplete && campgroundName && (
            <span className="text-xs bg-amber-800 text-amber-200 px-2 py-0.5 rounded-full">Leaving {campgroundName}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          {driverCount > 0 && <span className="text-xs text-gray-400">{driverCount} on road</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {messages.length === 0 && <p className="text-xs text-gray-600 text-center py-8 italic">Connecting to the road... 🛣️</p>}
        {messages.map(msg => {
          if (msg.isSystem) return <p key={msg.id} className="text-xs text-gray-600 text-center italic">{msg.content}</p>;
          if (msg.isCharacter) {
            const cls = CHAR_COLORS[msg.characterName || ''] || CHAR_COLORS['Hitch'];
            return (
              <div key={msg.id} className="flex justify-start">
                <div className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 ${cls}`}>
                  <p className="text-[10px] font-bold mb-1 opacity-70">{msg.user.firstName}</p>
                  <p className="text-sm leading-snug">{msg.content}</p>
                  <p className="text-[10px] opacity-50 mt-1">{formatMsgTime(msg.createdAt)}</p>
                </div>
              </div>
            );
          }
          const isMe = msg.user.id === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-300">
                  {msg.user.profilePicture ? <img src={msg.user.profilePicture} alt="" className="w-full h-full object-cover" /> : msg.user.firstName[0]}
                </div>
              )}
              <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <p className="text-[10px] text-gray-500 px-1">{msg.user.firstName}</p>}
                <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'}`}>
                  {msg.content}
                </div>
                <p className="text-[10px] text-gray-600 px-1">{formatMsgTime(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={tripComplete ? `Tell Hitch about ${campgroundName || 'your stay'}...` : 'Chat · @Hitch to ask AI...'}
            maxLength={300}
            className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-600"
          />
          <button onClick={sendMessage} disabled={!input.trim() || !connected}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-bold transition">
            →
          </button>
        </div>
      </div>
    </div>
  );
}
