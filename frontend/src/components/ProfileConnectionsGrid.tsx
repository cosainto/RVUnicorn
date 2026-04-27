import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Tent } from 'lucide-react';
import api from '../services/api';

interface GridItem {
  type: 'friend' | 'campsite';
  id: string;
  name: string;
  image: string | null;
  url: string;
  rank?: number;
}

interface Props {
  userId: string;
  isOwnProfile?: boolean;
}

export default function ProfileConnectionsGrid({ userId, isOwnProfile }: Props) {
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    api.get(`/top-friends/profile-grid/${userId}`)
      .then(r => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-4 rounded-2xl p-4" style={{ background: '#162236', border: '1px solid #243552' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-32 rounded animate-pulse" style={{ background: '#243552' }} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: '#243552' }} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-2xl p-5 text-center" style={{ background: '#162236', border: '1px solid #243552' }}>
        <Users className="w-6 h-6 mx-auto mb-2" style={{ color: '#E8A838', opacity: 0.5 }} />
        <p className="text-xs" style={{ color: '#8B9BB4' }}>
          {isOwnProfile
            ? 'Start connecting with travelers to build your Top 8.'
            : 'No connections to show yet.'}
        </p>
        {isOwnProfile && (
          <Link to="/friends" className="inline-block mt-2 text-xs font-semibold" style={{ color: '#E8A838' }}>
            Find Friends →
          </Link>
        )}
      </div>
    );
  }

  const friendCount = items.filter(i => i.type === 'friend').length;

  return (
    <div className="mt-4 rounded-2xl p-4" style={{ background: '#162236', border: '1px solid #243552' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#E8A838' }}>
          Top Connections
        </span>
        {friendCount > 0 && (
          <span className="text-[10px]" style={{ color: '#8B9BB4' }}>
            {friendCount} friend{friendCount !== 1 ? 's' : ''}{items.length > friendCount ? ` · ${items.length - friendCount} campsite${items.length - friendCount !== 1 ? 's' : ''}` : ''}
          </span>
        )}
      </div>

      {/* 4x2 Grid */}
      <div className="grid grid-cols-4 gap-2">
        {items.map((item, i) => (
          <Link
            key={`${item.type}-${item.id}`}
            to={item.url}
            className="group relative aspect-square rounded-xl overflow-hidden transition-transform duration-200 hover:scale-105"
            style={{ background: '#1A2B45' }}
          >
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1A2B45, #243756)' }}>
                {item.type === 'friend' ? (
                  <span className="text-lg font-bold" style={{ color: '#E8A838' }}>
                    {item.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                ) : (
                  <Tent className="w-5 h-5" style={{ color: '#8B9BB4' }} />
                )}
              </div>
            )}

            {/* Overlay on hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-1.5"
              style={{ background: 'linear-gradient(to top, rgba(15,28,53,0.9) 0%, transparent 60%)' }}
            >
              <p className="text-[9px] font-semibold leading-tight truncate w-full" style={{ color: '#F5F0E8' }}>
                {item.name}
              </p>
            </div>

            {/* Type indicator badge */}
            {item.type === 'campsite' && (
              <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(15,28,53,0.7)' }}>
                <Tent className="w-2.5 h-2.5" style={{ color: '#E8A838' }} />
              </div>
            )}

            {/* Rank badge for Top 8 */}
            {item.rank && (
              <div
                className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ background: '#E8A838', color: '#0F1C35' }}
              >
                {item.rank}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
