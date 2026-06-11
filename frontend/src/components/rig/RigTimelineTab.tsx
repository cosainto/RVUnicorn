import { useState, useEffect, useCallback } from 'react';
import { Camera, Film, BookOpen, UtensilsCrossed, Wrench, MapPin, Trophy, Settings, FileText, Clock, Heart, Loader2, Plus } from 'lucide-react';
import api from '../../services/api';

const ITEM_RENDERERS: Record<string, { emoji: string; label: string; color: string }> = {
  PHOTO_ALBUM: { emoji: '📸', label: 'Photos', color: 'text-blue-400' },
  VIDEO: { emoji: '🎥', label: 'Video', color: 'text-purple-400' },
  STORY: { emoji: '✍️', label: 'Story', color: 'text-emerald-400' },
  RECIPE: { emoji: '🍳', label: 'Recipe', color: 'text-orange-400' },
  MOD: { emoji: '🔧', label: 'Mod', color: 'text-amber-400' },
  MAINTENANCE: { emoji: '🛠', label: 'Service', color: 'text-gray-400' },
  CHECKIN: { emoji: '📍', label: 'Check-in', color: 'text-green-400' },
  MILESTONE: { emoji: '🏆', label: 'Milestone', color: 'text-yellow-400' },
  JOURNAL: { emoji: '📖', label: 'Journal', color: 'text-indigo-400' },
  MEMORY: { emoji: '💭', label: 'Memory', color: 'text-pink-400' },
  CAMPGROUND_REVIEW: { emoji: '⭐', label: 'Review', color: 'text-yellow-400' },
  CHECKLIST: { emoji: '📋', label: 'Checklist', color: 'text-teal-400' },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props { slug: string; isOwner: boolean; onCreateClick?: () => void; }

export default function RigTimelineTab({ slug, isOwner, onCreateClick }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => { loadInitial(); }, [slug]);

  const loadInitial = async () => {
    try {
      const { data } = await api.get(`/rigs/${slug}/timeline?limit=20`);
      setItems(data.items || []);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {}
    setLoading(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get(`/rigs/${slug}/timeline?limit=20&cursor=${cursor}`);
      setItems(prev => [...prev, ...(data.items || [])]);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {}
    setLoadingMore(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;

  // Empty state
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl block mb-3">📖</span>
        <h3 className="font-bold text-white text-lg">Start Your Rig Story</h3>
        <p className="text-xs text-white/40 mt-1 mb-6">Add your first photo, recipe, or memory</p>
        {isOwner && (
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
            {[{ emoji: '📸', label: 'Add Photos' }, { emoji: '✍️', label: 'Write a Story' }, { emoji: '🍳', label: 'Add a Recipe' }, { emoji: '🔧', label: 'Log a Mod' }].map(a => (
              <button key={a.label} onClick={onCreateClick} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white transition" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span>{a.emoji}</span>{a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const renderer = ITEM_RENDERERS[item.itemType] || { emoji: '📌', label: item.itemType, color: 'text-white/40' };
        return (
          <div key={item.id} className="rounded-xl overflow-hidden" style={{ background: item.itemType === 'MILESTONE' ? 'rgba(232,168,56,0.1)' : 'rgba(255,255,255,0.05)', border: item.itemType === 'MILESTONE' ? '1px solid rgba(232,168,56,0.2)' : '1px solid rgba(255,255,255,0.08)' }}>
            {item.previewImageUrl && (
              <img src={item.previewImageUrl} alt="" className="w-full h-40 object-cover" />
            )}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm ${renderer.color}`}>{renderer.emoji}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${renderer.color}`}>{renderer.label}</span>
                <span className="text-[10px] text-white/25 ml-auto">{timeAgo(item.occurredAt)}</span>
              </div>
              {item.title && <h4 className="text-sm font-semibold text-white">{item.title}</h4>}
              {item.previewText && <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{item.previewText}</p>}
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore} className="w-full py-3 text-center text-xs text-white/30 hover:text-white/50 transition">
          {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Load more'}
        </button>
      )}
    </div>
  );
}
