import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader, Minimize2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: any[];
}

export default function HitchFloatingChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hey! I'm Hitch 🦄 Need help finding a campground, planning a route, or anything RV related? I'm right here!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down'>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      api.get('/hitch/user-context').then(r => setUserContext(r.data)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [open, messages]);

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
      });
      const reply = { role: 'assistant' as const, content: data.message, suggestions: data.suggestions || [] };
      setMessages(prev => [...prev, reply]);
      if (!open) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I had a hiccup! Try again 🦄" }]);
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (index: number, rating: 'up' | 'down', question: string, answer: string) => {
    setFeedback(f => ({ ...f, [index]: rating }));
    try { await api.post('/hitch/feedback', { rating, question, answer: answer.substring(0, 200) }); } catch {}
  };

  const getSuggestionLink = (s: any) => {
    if (s.type === 'campground') return `/campgrounds/${s.id}`;
    if (s.type === 'host') return `/hosts/${s.id}`;
    return `/overnight-spots/${s.id}`;
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl overflow-hidden border-2 border-white hover:scale-110 transition-transform">
          <img src="/hitch.png" alt="Ask Hitch" className="w-full h-full object-cover" />
          {unread > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className={`fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all ${minimized ? 'h-14' : 'h-[500px]'} flex flex-col`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-3 flex items-center gap-2 shrink-0">
            <img src="/hitch.png" alt="Hitch" className="w-8 h-8 rounded-full border-2 border-white/30 object-cover" />
            <div className="flex-1">
              <p className="font-bold text-white text-sm">Hitch AI</p>
              <p className="text-white/60 text-xs">RVUnicorn Travel Companion</p>
            </div>
            <button onClick={() => setMinimized(m => !m)} className="text-white/70 hover:text-white p-1">
              <Minimize2 className="w-4 h-4" />
            </button>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role === 'assistant' && (
                      <img src="/hitch.png" alt="Hitch" className="w-6 h-6 rounded-full object-cover shrink-0 mt-1" />
                    )}
                    <div className="max-w-[85%] space-y-1.5">
                      <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && i > 0 && (
                        <div className="flex gap-1.5 mt-0.5">
                          <button onClick={() => sendFeedback(i, 'up', messages[i-1]?.content || '', msg.content)}
                            className={`p-1 rounded transition ${feedback[i] === 'up' ? 'text-green-600' : 'text-gray-300 hover:text-green-500'}`}>
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button onClick={() => sendFeedback(i, 'down', messages[i-1]?.content || '', msg.content)}
                            className={`p-1 rounded transition ${feedback[i] === 'down' ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}>
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {msg.suggestions?.map((s, j) => (
                        <Link key={j} to={getSuggestionLink(s)}
                          onClick={() => setOpen(false)}
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
                    <img src="/hitch.png" alt="Hitch" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    <div className="bg-gray-100 rounded-2xl px-3 py-2 flex items-center gap-1.5">
                      <Loader className="w-3 h-3 animate-spin text-gray-400" />
                      <span className="text-xs text-gray-400">thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick prompts for new chats */}
              {messages.length <= 1 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                  {['Find campgrounds near me', 'Plan a route', 'Free overnight spots', 'My badges'].map(p => (
                    <button key={p} onClick={() => sendMessage(p)}
                      className="text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2.5 py-1 rounded-full hover:bg-primary-100 transition">
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Full page link */}
              <div className="px-3 pb-1 text-center">
                <Link to="/hitch" onClick={() => setOpen(false)}
                  className="text-xs text-gray-400 hover:text-primary-600 transition">
                  Open full Hitch AI page →
                </Link>
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 shrink-0">
                <div className="flex gap-2">
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Ask Hitch anything..."
                    className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-primary-400" />
                  <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                    className="p-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
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
