import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, MapPin, Play, Loader2 } from 'lucide-react';
import api from '../../services/api';
import CampsiteSocialProofInline from './CampsiteSocialProofInline';

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

        // ── MILESTONE CARD (celebratory gold) ──
        if (isMilestone) {
          const milestoneEmoji = title.includes('mile') || title.includes('Mile') ? '🚐' : title.includes('state') || title.includes('State') || title.includes('Entered') ? '🗺️' : title.includes('campground') || title.includes('Campground') ? '🏕️' : title.includes('park') || title.includes('Park') ? '🌲' : '🏆';
          return (
            <div key={item.id} className="rounded-2xl text-center shadow-lg overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8A020, #D4881A)', animation: 'shimmer 3s ease-in-out infinite' }}>
              <style>{`@keyframes shimmer { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.08); } }`}</style>
              <div className="py-8 px-6">
                <span className="text-5xl block mb-3">{milestoneEmoji}</span>
                <h4 className="text-xl font-bold text-white drop-shadow-md">{title}</h4>
                {item.previewText && (() => { try { const d = JSON.parse(item.previewText); return d.hitchLine ? <p className="text-sm text-white/80 mt-2 italic">{d.hitchLine}</p> : <p className="text-sm text-white/70 mt-2">{item.previewText}</p>; } catch { return <p className="text-sm text-white/70 mt-2">{item.previewText}</p>; } })()}
                <p className="text-[10px] text-white/50 mt-3">{timeAgo(item.occurredAt)}</p>
              </div>
            </div>
          );
        }

        // ── CHECK-IN CARD ──
        if (isCheckIn) {
          let checkinData: any = {};
          try { checkinData = JSON.parse(item.previewText || '{}'); } catch { checkinData = { state: item.previewText }; }
          const campgroundName = (title || '').replace('Checked into ', '');
          const location = checkinData.location || checkinData.city || checkinData.state || '';
          const hitchLine = checkinData.hitchLine || 'Another adventure begins! \u{1F525}';
          const hasPhoto = !!item.previewImageUrl;

          // ── OVERNIGHT STOP CARD — dark navy, moon emoji ──
          const isOvernightStop = campgroundName.startsWith('\u{1F319}') || (!checkinData.campgroundId && checkinData.overnightStopId);
          if (isOvernightStop) {
            const cleanName = campgroundName.replace('\u{1F319} ', '');
            return (
              <div key={item.id} className="rounded-2xl shadow-lg overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.2)' }}>
                <div className="p-5 text-center">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {ownerAvatar ? <img src={ownerAvatar} alt="" className="w-7 h-7 rounded-full object-cover border border-white/20" /> : null}
                      <span className="text-xs text-white/60">{rigName} <span className="text-white/40">overnighted</span></span>
                    </div>
                    <span className="text-[10px] text-white/30">{timeAgo(item.occurredAt)}</span>
                  </div>
                  <span className="text-5xl block mb-3">{'\u{1F319}'}</span>
                  <h4 className="text-lg font-bold text-white mb-1">{cleanName}</h4>
                  {location && <p className="text-sm text-white/50">{location}</p>}
                  {checkinData.state && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full mt-2" style={{ background: 'rgba(232,168,56,0.1)', color: '#E8A838' }}>{checkinData.state}</span>}
                </div>
                <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-3 text-[11px] text-white/40 mb-2">
                    <span>{'\u{1F4C5}'} {new Date(item.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-5 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition"><Heart className="w-4 h-4" />Like</button>
                    <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-blue-400 transition"><MessageCircle className="w-4 h-4" />Comment</button>
                    <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition ml-auto"><Share2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={item.id} className="rounded-2xl shadow-lg overflow-hidden" style={{ background: '#162236' }}>
              {/* Hero image with overlay */}
              <div className="relative" style={{ height: '220px' }}>
                {hasPhoto ? (
                  <img src={item.previewImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #1a4a3a, #0F1C35, #1B2E50)' }} />
                )}
                {/* Dark gradient overlay */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.15) 100%)' }} />

                {/* Top row: avatar + rig name + timestamp */}
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-3">
                  <div className="flex items-center gap-2">
                    {ownerAvatar ? <img src={ownerAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" /> : <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs text-white">{ownerName?.[0] || '🚐'}</div>}
                    <span className="text-xs text-white/80 font-semibold">{rigName} <span className="text-white/50 font-normal">just arrived 🎉</span></span>
                  </div>
                  <span className="text-[10px] text-white/40">{timeAgo(item.occurredAt)}</span>
                </div>

                {/* Center: campground name */}
                <div className="absolute bottom-14 left-0 right-0 text-center px-6">
                  <span className="text-3xl block mb-1">📍</span>
                  <h4 className="text-xl font-bold text-white drop-shadow-lg leading-tight">{campgroundName}</h4>
                  {location && <p className="text-sm text-white/60 mt-1">{location}</p>}
                </div>

                {/* Bottom: Hitch one-liner */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2">
                  <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_32,h_32,c_fill/v1775261116/rvunicorn/characters/hitch.png" alt="Hitch" className="w-7 h-7 rounded-full flex-shrink-0" />
                  <span className="text-[11px] text-white/70 italic bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">{hitchLine}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-3 text-[11px] text-white/40 mb-2">
                  <span>{'\u{1F4C5}'} {new Date(item.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  {checkinData.state && <span>{'\u{1F5FA}\uFE0F'} {checkinData.state}</span>}
                </div>
                {/* Social proof for this campground */}
                {checkinData.campgroundId && <CampsiteSocialProofInline campgroundId={checkinData.campgroundId} compact />}
                {/* Actions */}
                <div className="flex items-center gap-5 pt-2 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition"><Heart className="w-4 h-4" />Like</button>
                  <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-blue-400 transition"><MessageCircle className="w-4 h-4" />Comment</button>
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
