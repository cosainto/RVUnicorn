/**
 * RigTimelineTab — the Pulse Feed. One canonical story stream with
 * differentiated per-type cards and a "Share Your Experience" composer bar.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Play } from 'lucide-react';
import api from '../../services/api';
import CampsiteSocialProofInline from './CampsiteSocialProofInline';
import CampSessionCard from './CampSessionCard';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

const ACTION_LABELS: Record<string, string> = {
  PHOTO_ALBUM: 'shared photos', VIDEO: 'posted a video', STORY: 'wrote a story',
  RECIPE: 'added a recipe', MOD: 'logged a mod', MAINTENANCE: 'logged maintenance',
  CHECKIN: 'checked in', MILESTONE: 'hit a milestone', JOURNAL: 'wrote a journal entry',
  MEMORY: 'added a memory', CAMPGROUND_REVIEW: 'reviewed a campground', CHECKLIST: 'shared a checklist',
};

const TYPE_ACCENTS: Record<string, { bg: string; border: string; icon: string }> = {
  RECIPE: { bg: 'rgba(212,98,26,0.1)', border: 'rgba(212,98,26,0.25)', icon: '🍳' },
  MOD: { bg: 'rgba(232,168,56,0.1)', border: 'rgba(232,168,56,0.25)', icon: '🛠' },
  MAINTENANCE: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: '⚙️' },
  VIDEO: { bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)', icon: '🎥' },
  STORY: { bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.25)', icon: '✍️' },
  JOURNAL: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)', icon: '📖' },
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
  if (item.previewText && item.previewText.length > 5 && !item.previewText.startsWith('{')) return item.previewText.slice(0, 80);
  if (item.itemType === 'CHECKIN') return item.title || 'Campground check-in';
  if (item.itemType === 'MILESTONE') return item.title || 'Milestone reached';
  return '';
}

// ── ACTION BAR (shared across cards) ──
function ActionBar() {
  return (
    <div className="flex items-center gap-5 px-4 pb-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition"><Heart className="w-4 h-4" />Like</button>
      <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-blue-400 transition"><MessageCircle className="w-4 h-4" />Comment</button>
      <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition ml-auto"><Share2 className="w-4 h-4" /></button>
    </div>
  );
}

// ── POST HEADER ──
function PostHeader({ item, rigName, ownerAvatar, ownerName, actionLabel }: { item: any; rigName?: string; ownerAvatar?: string; ownerName?: string; actionLabel: string }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-2">
      {ownerAvatar ? <img src={ownerAvatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm" style={{ background: `${CN.gold}30`, color: CN.gold }}>{ownerName?.[0] || '🚐'}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: CN.cream }}><span className="font-semibold">{rigName || 'Rig'}</span> <span style={{ color: CN.muted }}>{actionLabel}</span></p>
        <p className="text-[10px]" style={{ color: CN.muted }}>{timeAgo(item.occurredAt)}</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse" style={{ background: CN.card }}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-9 h-9 rounded-full" style={{ background: CN.border }} />
        <div className="flex-1"><div className="h-3 w-32 rounded mb-1" style={{ background: CN.border }} /><div className="h-2 w-20 rounded" style={{ background: CN.border }} /></div>
      </div>
      <div className="px-4 pb-2"><div className="w-full h-48 rounded-xl" style={{ background: CN.border }} /></div>
      <div className="px-4 pb-4"><div className="h-3 w-48 rounded mb-2" style={{ background: CN.border }} /></div>
    </div>
  );
}

interface Props {
  slug: string;
  isOwner: boolean;
  rigName?: string;
  ownerAvatar?: string;
  ownerName?: string;
  rigId?: string;
}

export default function RigTimelineTab({ slug, isOwner, rigName, ownerAvatar, ownerName, rigId }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);

  useEffect(() => { loadInitial(); loadSession(); }, [slug]);

  const loadSession = async () => {
    try {
      const { data } = await api.get(`/rigs/${slug}/session/active`);
      setActiveSession(data.session || null);
    } catch {}
  };

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
    <div className="max-w-2xl mx-auto space-y-4">
      <SkeletonCard /><SkeletonCard /><SkeletonCard />
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📖</span>
          <h3 className="font-bold text-xl" style={{ color: CN.cream }}>Start Your Rig Story</h3>
          <p className="text-sm mt-2 mb-6" style={{ color: CN.muted }}>Share your first photo, recipe, or campfire moment using the cards above</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Active Camp Session — pinned at top */}
      {activeSession && rigId && (
        <CampSessionCard session={activeSession} rigId={rigId} slug={slug} isOwner={isOwner} ownerAvatar={ownerAvatar} rigName={rigName} />
      )}

      {items.map(item => {
        const title = smartTitle(item);
        const actionLabel = ACTION_LABELS[item.itemType] || 'shared something';
        const accent = TYPE_ACCENTS[item.itemType];

        // ── MILESTONE CARD (celebratory gold) ──
        if (item.itemType === 'MILESTONE') {
          const emoji = title.match(/mile/i) ? '🚐' : title.match(/state|entered/i) ? '🗺️' : title.match(/camp/i) ? '🏕️' : title.match(/park/i) ? '🌲' : '🏆';
          return (
            <div key={item.id} className="rounded-2xl text-center shadow-lg overflow-hidden" style={{ background: `linear-gradient(135deg, ${CN.gold}, ${CN.orange})` }}>
              <div className="py-8 px-6">
                <span className="text-5xl block mb-3">{emoji}</span>
                <h4 className="text-xl font-bold text-white drop-shadow-md">{title}</h4>
                <p className="text-[10px] text-white/50 mt-3">{timeAgo(item.occurredAt)}</p>
              </div>
            </div>
          );
        }

        // ── CHECK-IN CARD ──
        if (item.itemType === 'CHECKIN') {
          let d: any = {};
          try { d = JSON.parse(item.previewText || '{}'); } catch { d = { state: item.previewText }; }
          const campName = (title || '').replace('Checked into ', '');
          const location = d.location || d.city || d.state || '';
          const hitchLine = d.hitchLine || 'Another adventure begins!';
          const hasPhoto = !!item.previewImageUrl;
          const nights = d.nights || null;
          const dateRange = d.dateRange || null;

          const bannerContent = (
            <div className="relative" style={{ height: 220, cursor: d.campgroundId ? 'pointer' : 'default' }}>
              {hasPhoto ? (
                <img src={item.previewImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #1a4a3a, #0F1C35, #1B2E50)' }} />
              )}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)' }} />
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-3">
                <div className="flex items-center gap-2">
                  {ownerAvatar ? <img src={ownerAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" /> : null}
                  <span className="text-xs text-white/80 font-semibold">{rigName} <span className="text-white/50 font-normal">checked in</span></span>
                </div>
                <span className="text-[10px] text-white/40">{timeAgo(item.occurredAt)}</span>
              </div>
              <div className="absolute bottom-12 left-0 right-0 text-center px-6">
                <span className="text-2xl block mb-1">📍</span>
                <h4 className="text-xl font-bold text-white drop-shadow-lg leading-tight">{campName}</h4>
                {location && <p className="text-sm text-white/60 mt-1">{location}</p>}
                {(nights || dateRange) && (
                  <p className="text-xs text-white/50 mt-1">
                    {dateRange && <span>{dateRange}</span>}
                    {nights && nights > 1 && <span>{dateRange ? ' · ' : ''}{nights} nights</span>}
                  </p>
                )}
              </div>
              <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2">
                <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_32,h_32,c_fill/v1775261116/rvunicorn/characters/hitch.png" alt="Hitch" className="w-6 h-6 rounded-full flex-shrink-0" />
                <span className="text-[10px] text-white/70 italic bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">{hitchLine}</span>
              </div>
            </div>
          );

          const stayPhotos: string[] = (item as any)._stayPhotos || [];
          const stayPhotoCount: number = (item as any)._stayPhotoCount || 0;

          return (
            <div key={item.id} className="rounded-2xl shadow-lg overflow-hidden" style={{ background: CN.card }}>
              {d.campgroundId ? (
                <Link to={`/campgrounds/${d.campgroundId}`} className="block transition hover:brightness-110">{bannerContent}</Link>
              ) : bannerContent}

              {/* Stay photos grid */}
              {stayPhotos.length > 0 && (
                <div className="px-3 pt-3">
                  <div className="grid gap-1 rounded-xl overflow-hidden" style={{ gridTemplateColumns: stayPhotos.length === 1 ? '1fr' : stayPhotos.length === 2 ? '1fr 1fr' : stayPhotos.length === 3 ? '1fr 1fr 1fr' : 'repeat(4, 1fr)' }}>
                    {stayPhotos.slice(0, 4).map((url: string, i: number) => (
                      <div key={i} className="relative" style={{ aspectRatio: stayPhotos.length === 1 ? '16/9' : '1' }}>
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {i === 3 && stayPhotoCount > 4 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">+{stayPhotoCount - 4}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] mt-1.5 mb-0.5" style={{ color: CN.muted }}>
                    📸 {stayPhotoCount} photo{stayPhotoCount !== 1 ? 's' : ''} from this stay
                  </p>
                </div>
              )}

              <div className="px-4 py-2">
                <div className="flex items-center gap-3 text-[10px] mb-1" style={{ color: CN.muted }}>
                  <span>📅 {new Date(item.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  {d.state && <span>🗺️ {d.state}</span>}
                  {d.campgroundId && (
                    <Link to={`/campgrounds/${d.campgroundId}`} className="ml-auto font-semibold" style={{ color: CN.gold, textDecoration: 'none' }}>View Campground →</Link>
                  )}
                </div>
                {d.campgroundId && <CampsiteSocialProofInline campgroundId={d.campgroundId} compact />}
              </div>
              <ActionBar />
            </div>
          );
        }

        // ── RECIPE CARD ──
        if (item.itemType === 'RECIPE') {
          return (
            <div key={item.id} className="rounded-2xl shadow-md overflow-hidden" style={{ background: CN.card, border: `1px solid ${accent?.border || CN.border}` }}>
              <PostHeader item={item} rigName={rigName} ownerAvatar={ownerAvatar} ownerName={ownerName} actionLabel={actionLabel} />
              {item.previewImageUrl && <div className="px-4 py-1"><img src={item.previewImageUrl} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 300 }} /></div>}
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">🍳</span>
                  {title && <h4 className="text-sm font-bold" style={{ color: CN.cream }}>{title}</h4>}
                </div>
                {item.previewText && <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${CN.orange}20`, color: CN.orange }}>{METHOD_EMOJI[item.previewText] || item.previewText}</span>}
              </div>
              <ActionBar />
            </div>
          );
        }

        // ── MOD CARD (before/after emphasis) ──
        if (item.itemType === 'MOD') {
          return (
            <div key={item.id} className="rounded-2xl shadow-md overflow-hidden" style={{ background: CN.card, border: `1px solid ${accent?.border || CN.border}` }}>
              <PostHeader item={item} rigName={rigName} ownerAvatar={ownerAvatar} ownerName={ownerName} actionLabel={actionLabel} />
              {item.previewImageUrl && (
                <div className="px-4 py-1">
                  <div className="rounded-xl overflow-hidden relative">
                    <img src={item.previewImageUrl} alt="" className="w-full object-cover" style={{ maxHeight: 300 }} />
                    <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', color: CN.gold }}>🛠 Upgrade</span>
                  </div>
                </div>
              )}
              <div className="px-4 pb-2">
                {title && <h4 className="text-sm font-bold mt-1" style={{ color: CN.cream }}>{title}</h4>}
                {item.previewText && <p className="text-xs mt-1 line-clamp-2" style={{ color: CN.muted }}>{item.previewText}</p>}
              </div>
              <ActionBar />
            </div>
          );
        }

        // ── VIDEO CARD ──
        if (item.itemType === 'VIDEO') {
          return (
            <div key={item.id} className="rounded-2xl shadow-md overflow-hidden" style={{ background: CN.card, border: `1px solid ${accent?.border || CN.border}` }}>
              <PostHeader item={item} rigName={rigName} ownerAvatar={ownerAvatar} ownerName={ownerName} actionLabel={actionLabel} />
              {item.previewImageUrl && (
                <div className="px-4 py-1 relative">
                  <img src={item.previewImageUrl} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 350 }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm"><Play className="w-7 h-7 text-white ml-1" fill="white" /></div>
                  </div>
                </div>
              )}
              <div className="px-4 pb-2">
                {title && <h4 className="text-sm font-bold mt-1" style={{ color: CN.cream }}>{title}</h4>}
              </div>
              <ActionBar />
            </div>
          );
        }

        // ── STORY / JOURNAL / BLOG CARD ──
        if (item.itemType === 'STORY' || item.itemType === 'JOURNAL') {
          return (
            <div key={item.id} className="rounded-2xl shadow-md overflow-hidden" style={{ background: CN.card, border: `1px solid ${accent?.border || CN.border}` }}>
              {item.previewImageUrl && <img src={item.previewImageUrl} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  {ownerAvatar ? <img src={ownerAvatar} alt="" className="w-7 h-7 rounded-full object-cover" /> : null}
                  <span className="text-xs" style={{ color: CN.muted }}>{rigName} {actionLabel} · {timeAgo(item.occurredAt)}</span>
                </div>
                {title && <h4 className="text-base font-bold mb-1" style={{ color: CN.cream, fontFamily: "'Playfair Display', serif" }}>{title}</h4>}
                {item.previewText && <p className="text-xs line-clamp-3" style={{ color: CN.muted }}>{item.previewText}</p>}
                <span className="text-[10px] font-semibold mt-2 inline-block" style={{ color: CN.gold }}>Read more →</span>
              </div>
              <ActionBar />
            </div>
          );
        }

        // ── MAINTENANCE CARD ──
        if (item.itemType === 'MAINTENANCE') {
          return (
            <div key={item.id} className="rounded-2xl shadow-md overflow-hidden" style={{ background: CN.card, border: `1px solid ${accent?.border || CN.border}` }}>
              <PostHeader item={item} rigName={rigName} ownerAvatar={ownerAvatar} ownerName={ownerName} actionLabel={actionLabel} />
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚙️</span>
                  {title && <h4 className="text-sm font-bold" style={{ color: CN.cream }}>{title}</h4>}
                </div>
                {item.previewText && <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{item.previewText}</span>}
              </div>
              <ActionBar />
            </div>
          );
        }

        // ── PHOTO ALBUM CARD (with grid) ──
        const feedPhotos: string[] = (item as any)._photos || (item as any)._stayPhotos || [];
        const feedPhotoCount: number = (item as any)._photoCount || (item as any)._stayPhotoCount || feedPhotos.length;
        const hasPhotoGrid = feedPhotos.length > 0;

        return (
          <div key={item.id} className="rounded-2xl shadow-md overflow-hidden" style={{ background: CN.card, border: `1px solid rgba(255,255,255,0.08)` }}>
            <PostHeader item={item} rigName={rigName} ownerAvatar={ownerAvatar} ownerName={ownerName} actionLabel={actionLabel} />

            {/* Photo grid */}
            {hasPhotoGrid ? (
              <div className="px-3 pt-1 pb-2">
                {title && <h4 className="text-sm font-bold mb-2 px-1" style={{ color: CN.cream }}>{title}</h4>}
                <div
                  className="grid gap-1 rounded-xl overflow-hidden"
                  style={{ gridTemplateColumns: feedPhotos.length === 1 ? '1fr' : feedPhotos.length === 2 ? '1fr 1fr' : feedPhotos.length === 3 ? '2fr 1fr' : '1fr 1fr' }}
                >
                  {feedPhotos.slice(0, feedPhotos.length === 3 ? 3 : 4).map((url: string, i: number) => (
                    <div
                      key={i}
                      className="relative overflow-hidden"
                      style={{
                        aspectRatio: feedPhotos.length === 1 ? '16/9' : (feedPhotos.length === 3 && i === 0) ? '1' : '1',
                        gridRow: (feedPhotos.length === 3 && i === 0) ? 'span 2' : undefined,
                      }}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {i === (feedPhotos.length >= 4 ? 3 : -1) && feedPhotoCount > 4 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-bold text-xl">+{feedPhotoCount - 4}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] mt-1.5 px-1" style={{ color: CN.muted }}>
                  📸 {feedPhotoCount} photo{feedPhotoCount !== 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <>
                {item.previewImageUrl && (
                  <div className="px-4 py-1">
                    <img src={item.previewImageUrl} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 400 }} />
                  </div>
                )}
                <div className="px-4 pb-2">
                  {title && <h4 className="text-sm font-bold mt-1" style={{ color: CN.cream }}>{title}</h4>}
                  {item.previewText && !item.previewText.startsWith('{') && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: CN.muted }}>{item.previewText}</p>
                  )}
                </div>
              </>
            )}
            <ActionBar />
          </div>
        );
      })}

      {/* Load more */}
      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore} className="w-full py-4 text-center text-xs transition" style={{ color: CN.muted }}>
          {loadingMore ? <SkeletonCard /> : 'Load more'}
        </button>
      )}

    </div>
  );
}
