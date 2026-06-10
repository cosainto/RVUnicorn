import { useState, useEffect } from 'react';
import { Star, Camera, Loader2, MapPin } from 'lucide-react';
import api from '../../services/api';

const MOMENT_BADGES: Record<string, { emoji: string; color: string }> = {
  ARRIVAL: { emoji: '📍', color: 'bg-green-500/20 text-green-400' },
  SCENIC: { emoji: '📸', color: 'bg-blue-500/20 text-blue-400' },
  WILDLIFE: { emoji: '🦌', color: 'bg-emerald-500/20 text-emerald-400' },
  BREAKDOWN: { emoji: '🔧', color: 'bg-red-500/20 text-red-400' },
  UNEXPECTED: { emoji: '✨', color: 'bg-purple-500/20 text-purple-400' },
  CAMPSITE: { emoji: '🏕️', color: 'bg-amber-500/20 text-amber-400' },
  MILESTONE: { emoji: '🏆', color: 'bg-yellow-500/20 text-yellow-400' },
  WEATHER: { emoji: '🌤️', color: 'bg-sky-500/20 text-sky-400' },
};

interface Props { slug: string; isOwner: boolean; }

export default function RigMomentsTab({ slug, isOwner }: Props) {
  const [moments, setMoments] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [slug]);

  const load = async () => {
    try {
      const { data } = await api.get(`/rigs/${slug}/moments`);
      setMoments(data);
    } catch {}
    setLoading(false);
  };

  const toggleFeature = async (id: string) => {
    try {
      await api.post(`/rigs/${slug}/moments/${id}/feature`);
      load();
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;

  const featured = moments.filter(m => m.isFeatured);
  const rest = moments.filter(m => !m.isFeatured);
  const display = showAll ? moments : featured.length > 0 ? featured : moments.slice(0, 6);

  return (
    <div>
      {featured.length > 0 && !showAll && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#E8A838' }}>Featured Moments</h3>
          <button onClick={() => setShowAll(true)} className="text-xs text-white/40 hover:text-white/60">All Moments ({moments.length})</button>
        </div>
      )}
      {showAll && (
        <button onClick={() => setShowAll(false)} className="text-xs text-amber-400 mb-3">← Back to Featured</button>
      )}

      {display.length === 0 ? (
        <div className="text-center py-12">
          <Camera className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">No moments captured yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {display.map(m => {
            const badge = MOMENT_BADGES[m.momentType] || MOMENT_BADGES.SCENIC;
            return (
              <div key={m.id} className="rounded-xl overflow-hidden group relative" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {m.photoUrls?.[0] ? (
                  <img src={m.photoUrls[0]} alt="" className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 flex items-center justify-center" style={{ background: 'rgba(232,168,56,0.1)' }}>
                    <span className="text-3xl">{badge.emoji}</span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.color}`}>
                    {badge.emoji} {m.momentType}
                  </span>
                </div>
                {m.isFeatured && (
                  <div className="absolute top-2 right-2">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  </div>
                )}
                <div className="p-2.5">
                  <h4 className="text-xs font-semibold text-white truncate">{m.title}</h4>
                  {m.body && <p className="text-[10px] text-white/40 line-clamp-2 mt-0.5">{m.body}</p>}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-white/25">{new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    {isOwner && (
                      <button onClick={() => toggleFeature(m.id)} className="text-[9px] text-amber-400 hover:text-amber-300">
                        {m.isFeatured ? 'Unfeature' : 'Feature'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
