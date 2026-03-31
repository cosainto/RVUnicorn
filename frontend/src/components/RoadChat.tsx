import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const SOCKET_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface RoadMessage {
  id: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
  user: { id: string; firstName: string; profilePicture: string | null };
}

export default function RoadChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<RoadMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [driverCount, setDriverCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const token = localStorage.getItem('token') || '';

    const socket = io(`${SOCKET_URL}/road-chat`, {
      query: { userId: user.id, token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('message:new', (msg: RoadMessage) => {
      setMessages(prev => [...prev.slice(-99), msg]);
    });
    socket.on('drivers:update', ({ count }: { count: number }) => {
      setDriverCount(count);
    });

    return () => { socket.disconnect(); };
  }, [user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit('message:send', { content: input.trim() });
    setInput('');
  }, [input]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-base">🚐</span>
          <p className="text-sm font-bold text-white">Road Chat</p>
          <span className="text-xs text-gray-500">Global · All drivers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          {driverCount > 0 && (
            <span className="text-xs text-gray-400">{driverCount} on the road</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-8 italic">
            No messages yet — say hi to fellow drivers! 🛣️
          </p>
        )}
        {messages.map(msg => (
          msg.isSystem ? (
            <p key={msg.id} className="text-xs text-gray-600 text-center italic">{msg.content}</p>
          ) : (
            <div key={msg.id} className={`flex gap-2 ${msg.user.id === user?.id ? 'justify-end' : 'justify-start'}`}>
              {msg.user.id !== user?.id && (
                <div className="w-7 h-7 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-300">
                  {msg.user.profilePicture
                    ? <img src={msg.user.profilePicture} alt="" className="w-full h-full object-cover" />
                    : msg.user.firstName[0]
                  }
                </div>
              )}
              <div className={`max-w-[75%] ${msg.user.id === user?.id ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {msg.user.id !== user?.id && (
                  <p className="text-[10px] text-gray-500 px-1">{msg.user.firstName}</p>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm ${
                  msg.user.id === user?.id
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          )
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-800">
        {!connected && (
          <p className="text-xs text-gray-600 text-center mb-2">Connecting...</p>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Say something to fellow drivers..."
            maxLength={300}
            className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-600"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !connected}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-bold transition"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
