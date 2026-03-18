import { useState } from 'react';
import api from '../services/api';

const CATEGORIES = [
  { id: 'fuel', emoji: '⛽', label: 'Fuel Finder', desc: 'Find gas, diesel & propane nearby' },
  { id: 'breakdown', emoji: '🚨', label: 'Breakdown Help', desc: 'Roadside safety & who to call' },
  { id: 'repair', emoji: '🔧', label: 'RV Repair Guide', desc: 'Tires, battery, leveling & more' },
  { id: 'emergency', emoji: '📞', label: 'Emergency Contacts', desc: 'Roadside assistance numbers' },
];

const QUICK_PROMPTS: Record<string, string[]> = {
  fuel: [
    'Where can I find diesel near me?',
    'Is there a propane fill station nearby?',
    'What apps find the cheapest gas for RVs?',
    'How do I find truck stops with RV-friendly diesel lanes?',
  ],
  breakdown: [
    'My RV just broke down on the highway — what do I do first?',
    'How do I safely pull over a large RV?',
    'What should I put in my roadside emergency kit?',
    'My tow vehicle is overheating — what should I do?',
  ],
  repair: [
    'How do I change a tire on my RV?',
    'My RV battery is dead — how do I jump it?',
    'How do I fix a slideout that won\'t retract?',
    'My RV leveling jacks won\'t go down — help!',
  ],
  emergency: [
    'What is Good Sam roadside assistance number?',
    'How do I contact Coach-Net roadside assistance?',
    'What is AAA RV coverage number?',
    'Who do I call for RV roadside help?',
  ],
};

export default function RoadSupport() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user' as const, content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/hitch/road-support', {
        message: text,
        category: activeCategory,
        history: messages.slice(-6),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Having trouble connecting. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category pills */}
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setMessages([]); }}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
              activeCategory === cat.id
                ? 'border-red-400 bg-red-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50'
            }`}
          >
            <span className="text-2xl">{cat.emoji}</span>
            <div>
              <div className="text-sm font-semibold text-gray-800">{cat.label}</div>
              <div className="text-xs text-gray-500">{cat.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick prompts */}
      {activeCategory && messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick questions</p>
          {QUICK_PROMPTS[activeCategory].map((prompt, i) => (
            <button
              key={i}
              onClick={() => sendMessage(prompt)}
              className="w-full text-left text-sm px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition text-gray-700"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-0.5">🚨</div>
              )}
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-none'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-sm mr-2 flex-shrink-0">🚨</div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-2.5">
                <div className="flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      {activeCategory && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }}}
            placeholder="Ask anything about road & RV support…"
            className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center disabled:opacity-40 transition flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      )}

      {/* Emergency banner */}
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-xl">🆘</span>
        <div>
          <div className="text-sm font-semibold text-red-800">In an emergency? Call 911</div>
          <div className="text-xs text-red-600">Good Sam: 1-800-847-2869 · Coach-Net: 1-800-863-3428 · AAA: 1-800-222-4357</div>
        </div>
      </div>
    </div>
  );
}
