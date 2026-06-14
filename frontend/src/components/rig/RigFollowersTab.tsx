import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Loader2 } from 'lucide-react';
import api from '../../services/api';

const CN = { bg: '#0F1C35', body: '#1E2D42', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface Follower {
  id: string;
  userId: string;
  followedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface RigFollowersTabProps {
  rigId: string;
  rigName: string;
}

export default function RigFollowersTab({ rigId, rigName }: RigFollowersTabProps) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadFollowers(1);
  }, [rigId]);

  const loadFollowers = async (p: number) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/rigs/${rigId}/followers?page=${p}&limit=20`);
      if (p === 1) {
        setFollowers(data.followers || []);
      } else {
        setFollowers(prev => [...prev, ...(data.followers || [])]);
      }
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
      setPage(p);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (loading && followers.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: CN.gold }} />
      </div>
    );
  }

  if (followers.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="w-12 h-12 mx-auto mb-3" style={{ color: CN.border }} />
        <p className="text-sm mb-1" style={{ color: CN.muted }}>No followers yet</p>
        <p className="text-xs" style={{ color: CN.muted }}>Be the first to follow {rigName}!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{ color: CN.cream }}>
          {total} Follower{total !== 1 ? 's' : ''}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {followers.map((f) => (
          <Link
            key={f.id}
            to={`/profile/${f.user.username}`}
            className="flex items-center gap-3 p-3 rounded-xl transition hover:brightness-110"
            style={{ background: CN.card, border: `1px solid ${CN.border}` }}
          >
            {f.user.profilePicture ? (
              <img src={f.user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: CN.gold }}>
                {f.user.firstName?.[0] || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: CN.cream }}>
                {f.user.firstName} {f.user.lastName}
              </p>
              <p className="text-[11px] truncate" style={{ color: CN.muted }}>
                @{f.user.username}
              </p>
            </div>
            <span className="text-[10px]" style={{ color: CN.muted }}>
              {new Date(f.followedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          </Link>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => loadFollowers(page + 1)}
          disabled={loading}
          className="w-full mt-4 py-2 rounded-xl text-xs font-semibold transition hover:brightness-110"
          style={{ background: CN.card, border: `1px solid ${CN.border}`, color: CN.gold }}
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
