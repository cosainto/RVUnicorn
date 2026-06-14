import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import api from '../../services/api';

interface Props {
  campgroundId: string;
  compact?: boolean; // true = single line for timeline cards
}

export default function CampsiteSocialProofInline({ campgroundId, compact = false }: Props) {
  const [data, setData] = useState<{
    totalFavorites: number;
    totalRigVisitors: number;
    avatars: { userId: string; username: string; avatarUrl: string | null; firstName: string | null }[];
  } | null>(null);

  useEffect(() => {
    if (!campgroundId) return;
    let cancelled = false;
    api.get(`/campgrounds/${campgroundId}/social-proof`).then(r => {
      if (cancelled) return;
      const d = r.data;
      if (d.totalFavorites > 0 || d.totalRigVisitors > 0) {
        setData({
          totalFavorites: d.totalFavorites,
          totalRigVisitors: d.totalRigVisitors,
          avatars: d.favoritedBy.slice(0, 3),
        });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [campgroundId]);

  if (!data) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <Heart className="w-3 h-3 text-red-400" fill="#f87171" />
        <div className="flex -space-x-1">
          {data.avatars.map(a => (
            a.avatarUrl ? (
              <img key={a.userId} src={a.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover border border-gray-800" />
            ) : (
              <div key={a.userId} className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[7px] font-bold text-amber-400 border border-gray-800">
                {a.firstName?.[0] || '?'}
              </div>
            )
          ))}
        </div>
        <span className="text-[10px] text-white/40">
          {data.totalFavorites} favorited
          {data.totalRigVisitors > 0 ? ` · ${data.totalRigVisitors} rigs visited` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2">
        <Heart className="w-3.5 h-3.5 text-red-400" fill="#f87171" />
        <div className="flex -space-x-1.5">
          {data.avatars.map(a => (
            <Link key={a.userId} to={`/profile/${a.username}`}>
              {a.avatarUrl ? (
                <img src={a.avatarUrl} alt={a.username} className="w-5 h-5 rounded-full object-cover border border-gray-800" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[8px] font-bold text-amber-400 border border-gray-800">
                  {a.firstName?.[0] || '?'}
                </div>
              )}
            </Link>
          ))}
        </div>
        <span className="text-[10px] text-white/40">
          {data.totalFavorites} {data.totalFavorites === 1 ? 'camper' : 'campers'} favorited
          {data.totalRigVisitors > 1 ? ` · ${data.totalRigVisitors} rigs have stayed here` : ''}
        </span>
      </div>
    </div>
  );
}
