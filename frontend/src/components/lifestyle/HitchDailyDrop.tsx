import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

interface Props { user: any; cn: Record<string, string>; }

export default function HitchDailyDrop({ user, cn }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    api.get('/hitch/daily-drop')
      .then(r => {
        setMessage(r.data?.message || null);
        setLoading(false);
        setTimeout(() => setFadeIn(true), 100);
      })
      .catch(() => {
        setMessage(null);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: cn.cardAlt, border: `1px solid ${cn.border}`, borderLeft: `3px solid ${cn.gold}` }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full lifestyle-shimmer" />
          <div className="h-4 w-24 rounded lifestyle-shimmer" />
        </div>
        <div className="h-4 w-full rounded lifestyle-shimmer mb-2" />
        <div className="h-4 w-3/4 rounded lifestyle-shimmer" />
      </div>
    );
  }

  if (!message) return null;

  return (
    <div className="rounded-2xl p-5" style={{ background: cn.cardAlt, border: `1px solid ${cn.border}`, borderLeft: `3px solid ${cn.gold}` }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <img src={HITCH_IMG} alt="Hitch" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        <span className="text-xs font-bold" style={{ color: cn.gold }}>Hitch · Today</span>
      </div>

      {/* Message */}
      <p
        className="text-sm leading-relaxed mb-4 transition-all duration-500"
        style={{
          color: cn.cream,
          opacity: fadeIn ? 1 : 0,
          transform: fadeIn ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        {message}
      </p>

      {/* Action chips */}
      <div className="flex gap-2">
        <Link
          to="/hitch"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:brightness-110"
          style={{ border: `1px solid ${cn.gold}`, color: cn.gold }}
        >
          Tell me more
        </Link>
        <button
          onClick={() => {
            api.post('/hitch/daily-drop/feedback', { helpful: false }).catch(() => {});
            setMessage(null);
          }}
          className="px-3 py-1.5 rounded-lg text-xs transition"
          style={{ border: `1px solid ${cn.border}`, color: cn.muted }}
        >
          Not helpful
        </button>
      </div>
    </div>
  );
}
