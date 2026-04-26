import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface Props { user: any; cn: Record<string, string>; }

export default function FriendsOnRoad({ user, cn }: Props) {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/friends/on-the-road')
      .then(r => setFriends(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
        <div className="h-5 w-40 rounded lifestyle-shimmer mb-3" />
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="flex items-center gap-3"><div className="w-8 h-8 rounded-full lifestyle-shimmer" /><div className="h-3 w-32 rounded lifestyle-shimmer" /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10B981' }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cn.muted }}>
          {friends.length > 0 ? `${friends.length} friend${friends.length !== 1 ? 's' : ''} traveling right now` : 'Friends on the Road'}
        </span>
      </div>

      {friends.length > 0 ? (
        <div className="space-y-3 mb-4">
          {friends.slice(0, 3).map((f: any) => (
            <div key={f.userId} className="flex items-center gap-3">
              {f.avatarUrl ? (
                <img src={f.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: cn.gold, color: cn.bg }}>
                  {f.displayName?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: cn.cream }}>{f.displayName}</p>
                <p className="text-[10px] truncate" style={{ color: cn.muted }}>→ {f.campgroundName || 'On the road'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs mb-4" style={{ color: cn.muted }}>
          No friends on the road yet. <Link to="/friends" className="font-semibold" style={{ color: cn.gold }}>Invite someone →</Link>
        </p>
      )}

      {friends.length > 0 && (
        <Link
          to="/travel"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:brightness-110"
          style={{ border: `1px solid ${cn.border}`, color: cn.muted }}
        >
          See the Map →
        </Link>
      )}
    </div>
  );
}
