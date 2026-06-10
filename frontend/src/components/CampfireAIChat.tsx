import { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { CHARACTERS, getCharacter } from '../utils/characters';

interface Props {
  campgroundId: string;
  campgroundName: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  character?: string;
  image?: string;
}

const AI_CHARACTERS = ['hitch', 'scout', 'wallet', 'walter', 'holden', 'hannah'];

export default function CampfireAIChat({ campgroundId, campgroundName }: Props) {
  const { user } = useAuth();
  const [selectedChar, setSelectedChar] = useState('hitch');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const switchCharacter = (charId: string) => {
    if (charId === selectedChar) return;
    const char = getCharacter(charId);
    setSelectedChar(charId);
    setMessages([{ role: 'assistant', content: `Hey! ${char.name} here. What can I help you with?`, character: charId, image: char.image }]);
  };

  const sendMessage = async () => {
    if (!input.trim() || thinking) return;
    const msg = input.trim();
    setInput('');
    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);

    try {
      const { data } = await api.post('/campfire/ai', {
        characterId: selectedChar,
        message: msg,
        campgroundId,
        conversationHistory: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
      });
      const char = getCharacter(selectedChar);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, character: selectedChar, image: char.image }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I got distracted by the campfire! Try again.", character: selectedChar, image: getCharacter(selectedChar).image }]);
    }
    setThinking(false);
  };

  const char = getCharacter(selectedChar);

  return (
    <div className="flex flex-col" style={{ height: '500px', background: 'linear-gradient(180deg, #0F1C35 0%, #1B2E50 100%)' }}>
      {/* Character selector */}
      <div className="px-4 py-2.5 border-b border-[#C9A84C]/20">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {AI_CHARACTERS.map(id => {
            const c = getCharacter(id);
            const active = id === selectedChar;
            return (
              <button key={id} onClick={() => switchCharacter(id)} className="flex flex-col items-center gap-1 flex-shrink-0">
                <img src={c.image} alt={c.name} className={`w-10 h-10 rounded-full object-cover border-2 transition ${active ? 'border-[#C9A84C] shadow-lg shadow-amber-500/20' : 'border-transparent opacity-50 hover:opacity-80'}`} />
                <span className={`text-[9px] font-bold ${active ? 'text-[#C9A84C]' : 'text-white/40'}`}>{c.name}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-white/20 mt-1.5 text-center">Only you can see this conversation</p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <img src={char.image} alt={char.name} className="w-16 h-16 mx-auto rounded-full border-2 border-[#C9A84C]/30 mb-3" />
            <p className="text-sm font-semibold text-[#C9A84C]">{char.name}</p>
            <p className="text-xs text-white/30 mt-1">Ask me anything about camping, trails, or {campgroundName}!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm" style={{ background: 'rgba(232,168,56,0.15)', color: '#F5F0E8' }}>
                  {msg.content}
                </div>
              </div>
            );
          }
          const msgChar = msg.character ? getCharacter(msg.character) : char;
          return (
            <div key={i} className="flex items-start gap-2 max-w-[85%]">
              <img src={msgChar.image} alt={msgChar.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5 border border-[#C9A84C]/30" />
              <div>
                <span className="text-[10px] font-bold text-[#C9A84C] mb-0.5 block">{msgChar.name}</span>
                <div className="bg-[#1B2E50] border border-[#C9A84C]/10 rounded-xl rounded-tl-none px-3 py-2 text-sm leading-relaxed" style={{ color: '#F5F0E8' }}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        {thinking && (
          <div className="flex items-center gap-2">
            <img src={char.image} alt="" className="w-8 h-8 rounded-full object-cover border border-[#C9A84C]/30" />
            <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B2E50]">
              {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              <span className="text-[10px] ml-1.5 text-white/30">{char.name} is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[#C9A84C]/15 px-3 py-2 flex gap-2 items-center">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={`Ask ${char.name} something...`}
          className="flex-1 text-sm bg-white/5 border border-white/10 rounded-full px-4 py-2 text-white/90 placeholder-white/30 focus:outline-none focus:border-[#C9A84C]/40" />
        <button onClick={sendMessage} disabled={!input.trim() || thinking}
          className="p-2 bg-[#C9A84C] text-[#0F1C35] rounded-full disabled:opacity-30 hover:bg-[#E8A838] transition">
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
