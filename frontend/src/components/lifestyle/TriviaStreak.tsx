import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import api from '../../services/api';

interface Props { user: any; cn: Record<string, string>; }

export default function TriviaStreak({ user, cn }: Props) {
  const [streak, setStreak] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/campfire-phase4/streak/${user?.id}`)
      .then(r => setStreak(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
        <div className="h-6 w-24 rounded lifestyle-shimmer mb-3" />
        <div className="h-10 w-16 rounded lifestyle-shimmer mb-2" />
        <div className="h-4 w-full rounded lifestyle-shimmer" />
      </div>
    );
  }

  const current = streak?.currentStreak || 0;
  const todayCompleted = streak?.lastPlayedAt && new Date(streak.lastPlayedAt).toDateString() === new Date().toDateString();

  return (
    <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-5 h-5" style={{ color: cn.orange }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cn.muted }}>Trivia Streak</span>
      </div>

      <p className="text-4xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: cn.gold }}>
        {current}
      </p>
      <p className="text-sm mb-4" style={{ color: cn.cream }}>
        {current > 0 ? `${current}-day streak` : 'No streak yet'}
      </p>

      {todayCompleted ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: cn.success }}>
          <span>✓</span> Come back tomorrow to keep your streak
        </div>
      ) : (
        <Link
          to="/basecamp"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition hover:brightness-110"
          style={{
            background: cn.gold,
            color: cn.bg,
            animation: 'gold-pulse 2s ease-in-out infinite',
          }}
        >
          {current > 0 ? 'Play Today\'s Trivia' : 'Start your streak today →'}
        </Link>
      )}

      {streak?.longestStreak > 0 && streak.longestStreak > current && (
        <p className="text-[10px] mt-3" style={{ color: cn.muted }}>
          Best: {streak.longestStreak}-day streak
        </p>
      )}
    </div>
  );
}
