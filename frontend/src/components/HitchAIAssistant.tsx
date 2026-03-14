import { useState } from 'react';
import { Send, Loader, MapPin, Star } from 'lucide-react';
import api from '../services/api';
import { Link } from 'react-router-dom';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Suggestion[];
}

interface Suggestion {
  type: 'campground' | 'host' | 'overnight_spot';
  id: string;
  name: string;
  location?: string;
  rating?: number;
  icon: string;
}

const QUICK_PROMPTS = [
  "Find wineries near me that allow RV overnight stays",
  "Plan a 3-day route from Chicago to Nashville with overnight stops",
  "What are the best free overnight spots in Colorado?",
  "Find pet-friendly campgrounds in Florida under $40/night",
  "Suggest a scenic route from Texas to California for a 40ft RV",
  "What breweries welcome RV guests near the Rocky Mountains?",
];

export default function HitchAIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey there! I'm Hitch 🦄 — your RV travel AI. I can help you find campgrounds, plan routes, discover overnight spots, and locate unique host properties like wineries and farms that welcome RVers. What adventure are we planning today?",
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

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
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        suggestions: data.suggestions || [],
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I had trouble connecting. Give me a moment and try again! 🦄",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const getSuggestionLink = (s: Suggestion) => {
    if (s.type === 'campground') return `/campgrounds/${s.id}`;
    if (s.type === 'host') return `/hosts/${s.id}`;
    return `/overnight-spots/${s.id}`;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-purple-600 p-4 flex items-center gap-3">
        <img src="/hitch.png" alt="Hitch" className="w-10 h-10 rounded-full object-cover border-2 border-white/50" />
        <div>
          <h3 className="font-bold text-white">Hitch AI</h3>
          <p className="text-xs text-white/70">Your RV travel companion</p>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Online" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <img src="/hitch.png" alt="Hitch" className="w-8 h-8 rounded-full object-cover shrink-0 mt-1" />
            )}
            <div className={`max-w-[80%] space-y-2`}>
              <div className={`rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {/* Suggestions */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="space-y-2">
                  {msg.suggestions.map((s, j) => (
                    <Link key={j} to={getSuggestionLink(s)}
                      className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-primary-300 hover:shadow-sm transition text-sm">
                      <span className="text-2xl">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{s.name}</p>
                        {s.location && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</p>}
                      </div>
                      {s.rating && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold shrink-0">
                          <Star className="w-3 h-3 fill-amber-400" /> {s.rating}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <img src="/hitch.png" alt="Hitch" className="w-8 h-8 rounded-full object-cover shrink-0" />
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-400">Hitch is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400 mb-2 font-medium">Try asking:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => sendMessage(p)}
                className="text-xs bg-primary-50 text-primary-700 border border-primary-200 px-3 py-1.5 rounded-full hover:bg-primary-100 transition">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask Hitch anything about RV travel..."
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-400"
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
