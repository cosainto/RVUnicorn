import { useState, useEffect, useRef } from 'react';
import { Send, Loader, Star, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Props {
  campgroundId: string;
  campgroundName: string;
  campground: any;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: any[];
}

const QUICK_QUESTIONS = [
  'Is this campground good for my RV?',
  'What do reviewers say about this place?',
  'Is it good for families with kids?',
  'How is the cell service and WiFi?',
  'What are the best sites to book?',
  'Is this pet friendly?',
  'How far in advance should I book?',
  'What is nearby to do and see?',
];

export default function HitchCampgroundChat({ campgroundId, campgroundName, campground }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      api.get('/hitch/user-context').then(r => setUserContext(r.data)).catch(() => {});
    }
    // Set initial greeting
    setMessages([{
      role: 'assistant',
      content: `Hey! I'm Hitch 🦄 Ask me anything about **${campgroundName}** — reviews, RV compatibility, nearby attractions, best sites, or anything else you want to know before booking!`
    }]);
  }, [campgroundId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput('');

    const newMessages: Message[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data } = await api.post('/hitch/campground-chat', {
        message: msg,
        campgroundId,
        campgroundName,
        campground: {
          description: campground.description,
          state: campground.state,
          city: campground.city,
          maxRvLength: campground.maxRvLength,
          hasElectricHookup: campground.hasElectricHookup,
          hasWaterHookup: campground.hasWaterHookup,
          hasSewerHookup: campground.hasSewerHookup,
          hasWifi: campground.hasWifi,
          isPetFriendly: campground.isPetFriendly,
          isBigRigFriendly: campground.isBigRigFriendly,
          pricePerNight: campground.pricePerNight,
          googleRating: campground.googleRating,
          googleReviewCount: campground.googleReviewCount,
        },
        history: newMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        userContext,
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        suggestions: data.suggestions || [],
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I had trouble with that one. Try again! 🦄"
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl p-5 mb-4 flex items-center gap-4">
        <img src="/hitch.png" alt="Hitch" className="w-14 h-14 rounded-full border-2 border-white/30 object-cover" />
        <div>
          <h3 className="font-bold text-white text-lg">Ask Hitch about {campgroundName}</h3>
          <p className="text-white/70 text-sm">AI-powered answers based on campground data and community reviews</p>
        </div>
      </div>

      {/* Campground quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {campground.googleRating && (
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
              <Star className="w-4 h-4 fill-amber-400" />
              <span className="font-bold">{campground.googleRating}</span>
            </div>
            <p className="text-xs text-gray-400">{campground.googleReviewCount} reviews</p>
          </div>
        )}
        {campground.maxRvLength && (
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="font-bold text-gray-800">{campground.maxRvLength}ft</p>
            <p className="text-xs text-gray-400">Max RV Length</p>
          </div>
        )}
        {campground.pricePerNight && (
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="font-bold text-gray-800">${campground.pricePerNight}</p>
            <p className="text-xs text-gray-400">Per Night</p>
          </div>
        )}
      </div>

      {/* Chat messages */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' && (
                <img src="/hitch.png" alt="Hitch" className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" />
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <img src="/hitch.png" alt="Hitch" className="w-7 h-7 rounded-full object-cover shrink-0" />
              <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Hitch is thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick questions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">Common questions:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  className="text-xs bg-primary-50 text-primary-700 border border-primary-200 px-3 py-1.5 rounded-full hover:bg-primary-100 transition">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={`Ask anything about ${campgroundName}...`}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-400" />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
              className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 text-center mt-3">
        Hitch answers are based on campground data and community reviews. Always verify with the campground directly.
      </p>
    </div>
  );
}
