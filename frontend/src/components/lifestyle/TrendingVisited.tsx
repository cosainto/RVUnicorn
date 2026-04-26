import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import api from '../../services/api';

interface Props { user: any; cn: Record<string, string>; }

export default function TrendingVisited({ user, cn }: Props) {
  const [campgrounds, setCampgrounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/campgrounds/trending-visited')
      .then(r => setCampgrounds(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
        <div className="h-5 w-48 rounded lifestyle-shimmer mb-3" />
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl lifestyle-shimmer" />)}
        </div>
      </div>
    );
  }

  if (!campgrounds.length) return null;

  return (
    <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
      <div className="flex items-center gap-2 mb-4">
        <Camera className="w-4 h-4" style={{ color: cn.gold }} />
        <h3 className="text-sm font-bold" style={{ fontFamily: "'Playfair Display', serif", color: cn.cream }}>
          Back at Your Campgrounds
        </h3>
      </div>

      <div className="space-y-3">
        {campgrounds.slice(0, 3).map((cg: any) => (
          <Link
            key={cg.campgroundId}
            to={`/campgrounds/${cg.campgroundId}`}
            className="flex items-center gap-3 p-3 rounded-xl transition hover:brightness-110"
            style={{ background: cn.cardAlt, border: `1px solid ${cn.border}` }}
          >
            {cg.recentPhotoUrl ? (
              <img src={cg.recentPhotoUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cn.border }}>
                <Camera className="w-5 h-5" style={{ color: cn.muted }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: cn.cream }}>
                {cg.name}{cg.state ? `, ${cg.state}` : ''}
              </p>
              <p className="text-[10px]" style={{ color: cn.gold }}>
                {cg.recentActivityCount} new {cg.recentActivityCount === 1 ? 'update' : 'updates'} this week
              </p>
              {cg.lastVisitedAt && (
                <p className="text-[10px]" style={{ color: cn.muted }}>
                  You visited {Math.floor((Date.now() - new Date(cg.lastVisitedAt).getTime()) / (30 * 86400000))} months ago
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
