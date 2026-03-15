import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGE = "Hey there, welcome to RVUnicorn! 🦄 I'm Hitch, your personal camping companion. I'd love to get to know you so I can give you the best recommendations. First — what kind of RV are you rolling in? (Class A, Class B, Class C, Fifth Wheel, Travel Trailer, or something else?)";

export default function HitchOnboarding({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_MESSAGE }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});

  const send = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data } = await api.post("/hitch/onboarding-chat", {
        message: msg,
        history: newMessages.slice(-6),
        step,
        collectedData,
      });

      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      if (data.collectedData) setCollectedData(prev => ({ ...prev, ...data.collectedData }));
      if (data.step !== undefined) setStep(data.step);
      if (data.complete) {
        setTimeout(() => onComplete(), 1500);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I had a hiccup! Let's keep going — what were you saying?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/hitch.png" alt="Hitch" className="w-10 h-10 rounded-full border-2 border-white/30" />
            <div>
              <p className="font-bold text-white">Meet Hitch</p>
              <p className="text-white/70 text-xs">Setting up your camping profile</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {[0,1,2,3].map(i => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </div>

        <div className="h-72 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "assistant" && (
                <img src="/hitch.png" alt="Hitch" className="w-6 h-6 rounded-full object-cover shrink-0 mt-1" />
              )}
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-primary-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <img src="/hitch.png" alt="Hitch" className="w-6 h-6 rounded-full object-cover shrink-0" />
              <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm text-gray-400">typing...</div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Type your answer..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 transition">
              Send
            </button>
          </div>
          <button onClick={onComplete} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-2 transition">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
