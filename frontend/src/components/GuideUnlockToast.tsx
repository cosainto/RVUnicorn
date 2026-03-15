import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { GUIDES, getGuide } from "../config/hitchGuides";

interface UnlockEvent {
  guideId: string;
  name: string;
}

export default function GuideUnlockToast() {
  const [toasts, setToasts] = useState<(UnlockEvent & { id: number })[]>([]);
  let counter = 0;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as UnlockEvent;
      const id = ++counter;
      setToasts(prev => [...prev, { ...detail, id }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    };
    window.addEventListener("guide-unlocked", handler);
    return () => window.removeEventListener("guide-unlocked", handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {toasts.map(toast => {
        const guide = getGuide(toast.guideId);
        return (
          <div key={toast.id}
            className={`flex items-center gap-3 bg-gradient-to-r ${guide.bgGradient} text-white rounded-2xl shadow-2xl px-4 py-3 w-72 animate-slide-in`}>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              {guide.avatarUrl
                ? <img src={guide.avatarUrl} className="w-full h-full rounded-full object-cover" alt={guide.name} />
                : <span className="text-xl">{guide.emoji}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Guide Unlocked!</p>
              <p className="text-xs text-white/80 truncate">{toast.name} is ready to chat</p>
            </div>
            <div className="flex items-center gap-1">
              <Link to="/hitch" className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg font-semibold transition">
                Chat
              </Link>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-white/70 hover:text-white p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
