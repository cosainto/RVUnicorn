import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, MapPin, Play, Loader2 } from 'lucide-react';
import api from '../../services/api';

const ACTION_LABELS: Record<string, string> = {
  PHOTO_ALBUM: 'shared photos',
  VIDEO: 'posted a video',
  STORY: 'wrote a story',
  RECIPE: 'added a recipe',
  MOD: 'logged a mod',
  MAINTENANCE: 'logged maintenance',
  CHECKIN: 'checked in',
  MILESTONE: 'hit a milestone',
  JOURNAL: 'wrote a journal entry',
  MEMORY: 'added a memory',
  CAMPGROUND_REVIEW: 'reviewed a campground',
  CHECKLIST: 'shared a checklist',
};

const METHOD_EMOJI: Record<string, string> = { CAMPFIRE: '🔥 Campfire', DUTCH_OVEN: '🏺 Dutch Oven', GRILL: '🥩 Grill', SKILLET: '🍳 Skillet', NO_COOK: '🥗 No Cook' };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function smartTitle(item: any): string {
  if (item.title && item.title !== 'Photos' && item.title !== 'Rig Photo') return item.title;
  if (item.previewText && item.previewText.length > 5) return item.previewText.slice(0, 60);
  if (item.itemType === 'CHECKIN') return item.title || 'Campground check-in';
  if (item.itemType === 'MILESTONE') return item.title || 'Milestone reached';
  return '';
}

interface Props {
  slug: string;
  isOwner: boolean;
  rigName?: string;
  ownerAvatar?: string;
  ownerName?: string;
  onCreateClick?: () => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-md animate-pulse" style={{ background: '#162236' }}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-9 h-9 rounded-full bg-white/10" />
        <div className="flex-1"><div className="h-3 w-32 rounded bg-white/10 mb-1" /><div className="h-2 w-20 rounded bg-white/5" /></div>
      </div>
      <div className="px-4 pb-2"><div className="w-full h-64 rounded-xl bg-white/5" /></div>
      <div className="px-4 pb-4"><div className="h-3 w-48 rounded bg-white/10 mb-2" /><div className="h-2 w-32 rounded bg-white/5" /></div>
    </div>
  );
}

export default function RigTimelineTab({ slug, isOwner, rigName, ownerAvatar, ownerName, onCreateClick }: Props) {
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

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 space-y-4 py-4">
      <SkeletonCard /><SkeletonCard /><SkeletonCard />
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 text-center py-16">
        <span className="text-5xl block mb-4">📖</span>
        <h3 className="font-bold text-white text-xl">Start Your Rig Story</h3>
        <p className="text-sm text-white/40 mt-2 mb-8">Add your first photo, recipe, or memory</p>
        {isOwner && (
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            {[{ emoji: '📸', label: 'Add Photos' }, { emoji: '✍️', label: 'Write a Story' }, { emoji: '🍳', label: 'Add a Recipe' }, { emoji: '🔧', label: 'Log a Mod' }].map(a => (
              <button key={a.label} onClick={onCreateClick} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <span className="text-lg">{a.emoji}</span>{a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-4 py-2">
      {items.map(item => {
        const isMilestone = item.itemType === 'MILESTONE';
        const isCheckIn = item.itemType === 'CHECKIN';
        const title = smartTitle(item);

        // ── MILESTONE CARD ──
        if (isMilestone) {
          return (
            <div key={item.id} className="rounded-2xl p-5 text-center shadow-md" style={{ background: 'linear-gradient(135deg, rgba(232,168,56,0.2), rgba(212,98,26,0.15))', border: '1px solid rgba(232,168,56,0.3)' }}>
              <span className="text-4xl block mb-2">🏆</span>
              <h4 className="text-lg font-bold" style={{ color: '#E8A838' }}>{title}</h4>
              {item.previewText && <p className="text-xs text-white/50 mt-1">{item.previewText}</p>}
              <p className="text-[10px] text-white/25 mt-2">{timeAgo(item.occurredAt)}</p>
            </div>
          );
        }

        // ── CHECK-IN CARD (compact, no big image) ──
        if (isCheckIn) {
          return (
            <div key={item.id} className="rounded-2xl shadow-md overflow-hidden" style={{ background: '#162236', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  {ownerAvatar ? <img src={ownerAvatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-sm" style={{ color: '#E8A838' }}>{ownerName?.[0] || '🚐'}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{rigName || 'Rig'} <span className="text-white/40 font-normal">checked in</span></p>
                    <p className="text-[10px] text-white/30">{timeAgo(item.occurredAt)}</p>
                  </div>
                </div>
                {/* Check-in content */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.2)' }}>
                  <MapPin className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-white">{title}</h4>
                    {item.previewText && <p className="text-[11px] text-white/40">{item.previewText}</p>}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-5 mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition"><Heart className="w-4 h-4" />Like</button>
                  <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition"><MessageCircle className="w-4 h-4" />Comment</button>
                  <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition ml-auto"><Share2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          );
        }

        // ── STANDARD CARD (photo, video, recipe, mod, story, journal, etc.) ──
        const isVideo = item.itemType === 'VIDEO';
        const isRecipe = item.itemType === 'RECIPE';
        const isMod = item.itemType === 'MOD';
        const actionLabel = ACTION_LABELS[item.itemType] || 'shared something';

        return (
          <div key={item.id} className="rounded-2xl shadow-md overflow-hidden" style={{ background: '#162236', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              {ownerAvatar ? <img src={ownerAvatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-sm" style={{ color: '#E8A838' }}>{ownerName?.[0] || '🚐'}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white"><span className="font-semibold">{rigName || 'Rig'}</span> <span className="text-white/40">{actionLabel}</span></p>
                <p className="text-[10px] text-white/30">{timeAgo(item.occurredAt)}</p>
              </div>
            </div>

            {/* Image */}
            {item.previewImageUrl && (
              <div className="px-4 py-2 relative">
                <img src={item.previewImageUrl} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: '400px' }} />
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <Play className="w-6 h-6 text-white ml-1" fill="white" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="px-4 pb-2">
              {title && <h4 className="text-sm font-bold text-white mt-1">{title}</h4>}

              {/* Recipe badge */}
              {isRecipe && item.previewText && (
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                  {METHOD_EMOJI[item.previewText] || `🍽️ ${item.previewText}`}
                </span>
              )}

              {/* Mod/story preview text */}
              {!isRecipe && item.previewText && (
                <p className="text-xs text-white/50 mt-1 line-clamp-2">{item.previewText}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-5 px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition"><Heart className="w-4 h-4" />Like</button>
              <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-blue-400 transition"><MessageCircle className="w-4 h-4" />Comment</button>
              <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition ml-auto"><Share2 className="w-4 h-4" /></button>
            </div>
          </div>
        );
      })}

      {/* Load more */}
      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore} className="w-full py-4 text-center text-xs text-white/30 hover:text-white/50 transition">
          {loadingMore ? (
            <div className="space-y-4"><SkeletonCard /></div>
          ) : 'Load more'}
        </button>
      )}
    </div>
  );
}
