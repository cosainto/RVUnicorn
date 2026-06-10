import { useState, useEffect } from 'react';
import { Star, Loader2, Plus, ChevronDown, ChevronUp, Car, Tent, Wrench, Sparkles, MapPin } from 'lucide-react';
import api from '../../services/api';

const EPISODE_ICONS: Record<string, string> = { TRAVEL: '🚗', STAY: '🏕️', INCIDENT: '🔧', DISCOVERY: '⭐', OTHER: '📍' };

interface Props { slug: string; rigId: string; isOwner: boolean; }

export default function RigJourneyTab({ slug, rigId, isOwner }: Props) {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { load(); }, [slug]);

  const load = async () => {
    try {
      const { data } = await api.get(`/rigs/${slug}/episodes`);
      setEpisodes(data);
    } catch {}
    setLoading(false);
  };

  const expandEpisode = async (ep: any) => {
    if (expandedId === ep.id) { setExpandedId(null); return; }
    setExpandedId(ep.id);
    try {
      const { data } = await api.get(`/rigs/${rigId}/posts?episodeId=${ep.id}`);
      setExpandedPosts(data || []);
    } catch { setExpandedPosts([]); }
  };

  const autoGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/rigs/${slug}/episodes/auto-generate`);
      if (data.episodes?.length > 0) {
        for (const ep of data.episodes) {
          await api.post(`/rigs/${slug}/episodes`, ep);
        }
        load();
      }
    } catch {}
    setGenerating(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;

  return (
    <div className="space-y-3">
      {isOwner && (
        <div className="flex gap-2 mb-4">
          <button onClick={autoGenerate} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs font-semibold rounded-lg hover:bg-amber-500/30 transition disabled:opacity-50">
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Auto-Generate Episodes
          </button>
        </div>
      )}

      {episodes.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">No journey episodes yet</p>
          {isOwner && <p className="text-xs text-white/25 mt-1">Create posts first, then auto-generate episodes</p>}
        </div>
      ) : (
        episodes.map(ep => (
          <div key={ep.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => expandEpisode(ep)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition">
              {ep.coverImageUrl ? (
                <img src={ep.coverImageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'rgba(232,168,56,0.15)' }}>
                  {EPISODE_ICONS[ep.episodeType] || '📍'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(232,168,56,0.15)', color: '#E8A838' }}>
                    {ep.episodeType}
                  </span>
                </div>
                <h4 className="font-semibold text-sm text-white mt-0.5 truncate">{ep.title}</h4>
                {ep.subtitle && <p className="text-xs text-white/40 truncate">{ep.subtitle}</p>}
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/30">
                  <span>{new Date(ep.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  {ep.startLocation && <span>· {ep.startLocation}</span>}
                  <span>· {ep._count?.posts || 0} posts · {ep._count?.moments || 0} moments</span>
                </div>
              </div>
              {expandedId === ep.id ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
            </button>
            {expandedId === ep.id && (
              <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                {expandedPosts.length === 0 ? (
                  <p className="text-xs text-white/30 text-center py-4">No posts in this episode</p>
                ) : (
                  expandedPosts.map((p: any) => (
                    <div key={p.id} className="bg-white/5 rounded-lg p-3">
                      {p.photos?.[0] && <img src={p.photos[0]} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />}
                      {p.title && <h5 className="text-sm font-semibold text-white">{p.title}</h5>}
                      {p.body && <p className="text-xs text-white/50 line-clamp-3 mt-1">{p.body}</p>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
