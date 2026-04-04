import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

interface Message { role: "user" | "assistant"; content: string; }

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

const CREW = [
  { id: 'diesel', name: 'Diesel Dave', role: 'Big Rig Expert', img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261021/rvunicorn/characters/diesel.png', intro: "I'll make sure every campground can handle your rig." },
  { id: 'luna', name: 'Luna', role: 'Family & Pets', img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261086/rvunicorn/characters/luna.webp', intro: "I've got kid-friendly activities and pet policies covered." },
  { id: 'scout', name: 'Scout', role: 'Adventure Guide', img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261023/rvunicorn/characters/scout.png', intro: "Trails, hidden gems, and the best boondocking spots — that's my lane." },
  { id: 'rose', name: 'Rosé', role: 'Glamping Guru', img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261022/rvunicorn/characters/rose.png', intro: "Wineries, scenic views, and the finer side of camping life." },
  { id: 'walter', name: 'Walter', role: 'Honest Reviews', img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261024/rvunicorn/characters/walter.png', intro: "I tell it like it is. No sugarcoating. You'll thank me later." },
];

const INITIAL_MESSAGE = "Hey there, welcome to RVUnicorn! 🦄 I'm Hitch, your personal camping companion. I'd love to get to know you so I can give you the best recommendations. First — what kind of RV are you rolling in? (Class A, Class B, Class C, Fifth Wheel, Travel Trailer, or something else?)";

export default function HitchOnboarding({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: INITIAL_MESSAGE }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});
  const [showCrew, setShowCrew] = useState(false);

  const send = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const { data } = await api.post("/hitch/onboarding-chat", { message: msg, history: newMessages.slice(-6), step, collectedData });
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      if (data.collectedData) setCollectedData(prev => ({ ...prev, ...data.collectedData }));
      if (data.step !== undefined) setStep(data.step);
      if (data.complete) { setTimeout(() => setShowCrew(true), 1500); }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I had a hiccup! Let's keep going — what were you saying?" }]);
    } finally { setLoading(false); }
  };

  if (showCrew) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.18)' }}>
          <div className="p-6 text-center" style={{ borderBottom: '1px solid rgba(232,168,56,0.1)' }}>
            <img src={HITCH_IMG} alt="Hitch" className="w-14 h-14 rounded-full mx-auto mb-3 border-2" style={{ borderColor: '#E8A838' }} />
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display',serif", color: '#FDF6E9' }}>Meet Your Crew</h2>
            <p className="text-[13px] mt-1" style={{ color: 'rgba(245,240,232,0.5)' }}>These guides are here to help along the way</p>
          </div>
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {CREW.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#1B2E50' }}>
                <img src={c.img} alt={c.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold" style={{ color: '#F5F0E8' }}>{c.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,168,56,0.1)', color: '#E8A838' }}>{c.role}</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(245,240,232,0.5)' }}>{c.intro}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4">
            <button onClick={onComplete} className="w-full py-3 rounded-xl text-sm font-bold transition hover:brightness-110" style={{ background: '#E8622A', color: 'white' }}>
              Let's Go! 🏕️
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.18)' }}>
        <div className="px-6 py-4" style={{ background: '#1B2E50', borderBottom: '1px solid rgba(232,168,56,0.1)' }}>
          <div className="flex items-center gap-3">
            <img src={HITCH_IMG} alt="Hitch" className="w-10 h-10 rounded-full border-2 object-cover" style={{ borderColor: '#E8A838' }} />
            <div>
              <p className="font-bold text-[14px]" style={{ color: '#F5F0E8' }}>Meet Hitch</p>
              <p className="text-[11px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Setting up your camping profile</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {[0,1,2,3].map(i => (
              <div key={i} className="h-1 flex-1 rounded-full transition-all" style={{ background: i <= step ? '#E8A838' : 'rgba(232,168,56,0.15)' }} />
            ))}
          </div>
        </div>

        <div className="h-72 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "assistant" && <img src={HITCH_IMG} alt="Hitch" className="w-6 h-6 rounded-full object-cover shrink-0 mt-1" />}
              <div className="max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed"
                style={m.role === "user"
                  ? { background: '#E8622A', color: 'white', borderTopRightRadius: '4px' }
                  : { background: '#1B2E50', color: 'rgba(245,240,232,0.8)', borderTopLeftRadius: '4px' }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <img src={HITCH_IMG} alt="Hitch" className="w-6 h-6 rounded-full object-cover shrink-0" />
              <div className="rounded-2xl px-3 py-2 text-[13px]" style={{ background: '#1B2E50', color: 'rgba(245,240,232,0.3)' }}>typing...</div>
            </div>
          )}
        </div>

        <div className="p-4" style={{ borderTop: '1px solid rgba(232,168,56,0.08)' }}>
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Type your answer..."
              className="flex-1 rounded-xl px-3 py-2 text-[13px] focus:outline-none" style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.12)', color: '#F5F0E8' }} />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-40 transition hover:brightness-110" style={{ background: '#E8622A', color: 'white' }}>
              Send
            </button>
          </div>
          <button onClick={onComplete} className="w-full text-center text-[11px] mt-2 transition" style={{ color: 'rgba(245,240,232,0.3)' }}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
