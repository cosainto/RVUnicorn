import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Heart, ArrowRight } from 'lucide-react';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActivityRailItem {
  id: string;
  type: 'PHOTO' | 'CHECKIN' | 'REVIEW' | 'MILESTONE' | 'ALBUM';
  actorId: string;
  actorName: string;
  actorAvatarUrl: string;
  actorRigName: string | null;
  previewImageUrl: string;
  campgroundId: string | null;
  campgroundName: string | null;
  campgroundLat: number | null;
  campgroundLng: number | null;
  campgroundState: string | null;
  description: string;
  occurredAt: string;
  timeAgo: string;
  ringColor: string;
  navigateTo: string;
}

interface ActivityRailProps {
  onItemClick: (item: ActivityRailItem) => void;
  selectedItemId: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SCROLL_SPEED = 0.4;
const TYPE_EMOJI: Record<string, string> = {
  PHOTO: '📸',
  CHECKIN: '🏕',
  MILESTONE: '🎯',
  REVIEW: '⭐',
  ALBUM: '📷',
};

// ── Component ──────────────────────────────────────────────────────────────────

// ── Own-content fallback when no friend activity ────────────────────────────
function OwnContentRail({ onItemClick, selectedItemId }: ActivityRailProps) {
  const [wishlistStops, setWishlistStops] = useState<any[]>([]);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/dream-trips/stops').catch(() => ({ data: [] })),
      api.get('/basecamp/v2/discovery').catch(() => ({ data: {} })),
    ]).then(([stopsRes, discoveryRes]) => {
      setWishlistStops(Array.isArray(stopsRes.data) ? stopsRes.data.slice(0, 4) : []);
      // Extract recent visits from becauseYouVisited source campground
      const bvItems = discoveryRes.data?.becauseYouVisited?.items || [];
      setRecentVisits(bvItems.slice(0, 3));
      setLoaded(true);
    });
  }, []);

  // Nothing to show — collapse entirely, map goes full width
  if (loaded && wishlistStops.length === 0 && recentVisits.length === 0) return null;
  if (!loaded) return null;

  return (
    <>
      {/* Desktop vertical sidebar */}
      <div className="hidden md:flex flex-shrink-0 flex-col" style={{
        width: 160, background: 'rgba(15, 28, 53, 0.95)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 8px', overflowY: 'auto',
      }}>
        {wishlistStops.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>⭐ Your Wishlist</p>
            {wishlistStops.map((stop: any) => {
              const img = stop.imageUrl;
              return (
                <button key={stop.id} onClick={() => onItemClick({
                  id: stop.id, type: 'CHECKIN', actorId: '', actorName: '', actorAvatarUrl: '', actorRigName: null,
                  previewImageUrl: img || '', campgroundId: stop.id, campgroundName: stop.name,
                  campgroundLat: null, campgroundLng: null, campgroundState: stop.state,
                  description: stop.name, occurredAt: '', timeAgo: '', ringColor: '#C9A84C',
                  navigateTo: stop.type === 'campground' ? `/campgrounds/${stop.id}` : `/place/${stop.id}`,
                })}
                  className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg transition hover:bg-white/5 text-left"
                  style={{ border: selectedItemId === stop.id ? '1px solid #C9A84C' : '1px solid transparent' }}>
                  {img ? (
                    <img src={img} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#1B2B4B' }}>
                      <span style={{ fontSize: 12 }}>🏕</span>
                    </div>
                  )}
                  <span className="text-[9px] leading-tight truncate" style={{ color: '#F5F0E8' }}>{stop.name}</span>
                </button>
              );
            })}
          </div>
        )}
        {recentVisits.length > 0 && (
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#8B9BB4', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>📍 Recently Visited</p>
            {recentVisits.map((v: any) => (
              <button key={v.id} onClick={() => onItemClick({
                id: v.id, type: 'CHECKIN', actorId: '', actorName: '', actorAvatarUrl: '', actorRigName: null,
                previewImageUrl: v.imageUrl || '', campgroundId: v.id, campgroundName: v.name,
                campgroundLat: null, campgroundLng: null, campgroundState: v.state,
                description: v.name, occurredAt: '', timeAgo: '', ringColor: '#1D9E75',
                navigateTo: `/campgrounds/${v.id}`,
              })}
                className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg transition hover:bg-white/5 text-left"
                style={{ border: selectedItemId === v.id ? '1px solid #1D9E75' : '1px solid transparent' }}>
                {v.imageUrl ? (
                  <img src={v.imageUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#1B2B4B' }}>
                    <span style={{ fontSize: 12 }}>📍</span>
                  </div>
                )}
                <span className="text-[9px] leading-tight truncate" style={{ color: '#F5F0E8' }}>{v.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Mobile: collapsed — no sidebar on mobile for own content */}
    </>
  );
}

export default function ActivityRail({ onItemClick, selectedItemId }: ActivityRailProps) {
  const [items, setItems] = useState<ActivityRailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [hasNetwork, setHasNetwork] = useState(false);

  // Auto-scroll refs
  const railRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const isPausedRef = useRef(false);
  const scrollPosRef = useRef(0);

  // SSE injection queue
  const injectionQueueRef = useRef<ActivityRailItem[]>([]);
  const lastInjectionRef = useRef(0);

  // ── Fetch data ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const fetchRail = async () => {
      try {
        const { data } = await api.get('/map/activity-rail', { params: { limit: 50 } });
        if (!cancelled) {
          setItems(data.items || []);
          setHasData((data.items || []).length > 0);
          setHasNetwork(data.hasNetwork !== false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRail();

    // Re-fetch every 3 minutes
    const interval = setInterval(fetchRail, 3 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── SSE live updates ──────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const es = new EventSource(`${apiUrl}/api/map/activity-rail/stream?token=${token}`);

    es.addEventListener('activity', (e) => {
      try {
        const item: ActivityRailItem = JSON.parse(e.data);
        injectionQueueRef.current.push(item);
      } catch { /* ignore parse errors */ }
    });

    return () => es.close();
  }, []);

  // Process injection queue (one per 15 seconds max)
  useEffect(() => {
    const interval = setInterval(() => {
      if (injectionQueueRef.current.length === 0) return;
      if (Date.now() - lastInjectionRef.current < 15000) return;

      const item = injectionQueueRef.current.shift();
      if (!item) return;
      lastInjectionRef.current = Date.now();

      setItems(prev => {
        // Dedup
        if (prev.some(p => p.id === item.id)) return prev;
        return [{ ...item, _fadeIn: true } as any, ...prev].slice(0, 50);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-scroll animation (vertical, desktop) ────────────────────────────

  useEffect(() => {
    if (!hasData) return;

    const animate = () => {
      if (!isPausedRef.current && railRef.current) {
        scrollPosRef.current += SCROLL_SPEED;
        const totalHeight = railRef.current.scrollHeight / 2; // duplicated list
        if (totalHeight > 0 && scrollPosRef.current >= totalHeight) {
          scrollPosRef.current = 0;
        }
        railRef.current.style.transform = `translateY(-${scrollPosRef.current}px)`;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [hasData]);

  const handleMouseEnter = useCallback(() => { isPausedRef.current = true; }, []);
  const handleMouseLeave = useCallback(() => {
    setTimeout(() => { isPausedRef.current = false; }, 1000);
  }, []);

  // ── Don't render if no network (no friends/follows) ────────────────────────

  if (loading) return null;
  if (!hasData && !hasNetwork) return null; // No friends at all — hide rail entirely

  // Has friends but no recent activity — show "quiet" prompt
  // No friend activity: show user's own map content (wishlist + recent visits)
  if (!hasData) {
    return <OwnContentRail onItemClick={onItemClick} selectedItemId={selectedItemId} />;
  }

  // Duplicate items for seamless loop
  const displayItems = [...items, ...items];

  return (
    <>
      {/* ══ Desktop vertical rail ══ */}
      <div
        className="hidden md:block flex-shrink-0"
        style={{
          width: 120,
          height: '100%',
          background: 'rgba(15, 28, 53, 0.95)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
          position: 'relative',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Gradient fade top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 24,
          background: 'linear-gradient(to bottom, rgba(15,28,53,0.95), transparent)',
          zIndex: 2, pointerEvents: 'none',
        }} />

        {/* Scrolling content */}
        <div ref={railRef} style={{ willChange: 'transform' }}>
          {displayItems.map((item, i) => (
            <RailItem
              key={`${item.id}-${i}`}
              item={item}
              isSelected={selectedItemId === item.id}
              onClick={() => onItemClick(item)}
              layout="vertical"
            />
          ))}
        </div>

        {/* Gradient fade bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
          background: 'linear-gradient(to top, rgba(15,28,53,0.95), transparent)',
          zIndex: 2, pointerEvents: 'none',
        }} />

        {/* Live dot indicator */}
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: '#1D9E75',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>LIVE</span>
        </div>
      </div>

      {/* ══ Mobile horizontal strip ══ */}
      <MobileStrip
        items={items}
        selectedItemId={selectedItemId}
        onItemClick={onItemClick}
      />

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes railPulsePin {
          0%, 100% { transform: translate(-50%, -100%) scale(1); box-shadow: 0 0 0 0 rgba(201,168,76,0.5); }
          50% { transform: translate(-50%, -100%) scale(1.15); box-shadow: 0 0 0 8px rgba(201,168,76,0); }
        }
      `}</style>
    </>
  );
}

// ── Rail Item ──────────────────────────────────────────────────────────────────

function RailItem({ item, isSelected, onClick, layout }: {
  item: ActivityRailItem;
  isSelected: boolean;
  onClick: () => void;
  layout: 'vertical' | 'horizontal';
}) {
  const isVertical = layout === 'vertical';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'column',
        alignItems: 'center',
        padding: isVertical ? '8px 4px' : '6px 8px',
        cursor: 'pointer',
        gap: 4,
        opacity: isSelected ? 1 : 0.85,
        transition: 'opacity 0.2s',
        width: isVertical ? undefined : 72,
        flexShrink: 0,
        animation: (item as any)._fadeIn ? 'fadeIn 0.6s ease-out' : undefined,
      }}
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.opacity = '0.85';
      }}
    >
      {/* Circular photo thumbnail */}
      <div style={{
        width: isVertical ? 52 : 56,
        height: isVertical ? 52 : 56,
        borderRadius: '50%',
        border: `2.5px solid ${isSelected ? '#fff' : item.ringColor}`,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        boxShadow: isSelected ? `0 0 0 2px ${item.ringColor}` : undefined,
      }}>
        <img
          src={item.previewImageUrl || item.actorAvatarUrl || '/default-avatar.png'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
          alt=""
          onError={e => { (e.target as HTMLImageElement).src = item.actorAvatarUrl || '/default-avatar.png'; }}
        />
        {/* Type indicator badge */}
        <div style={{
          position: 'absolute',
          bottom: 1,
          right: 1,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: item.ringColor,
          border: '1.5px solid #0F1C35',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
        }}>
          {TYPE_EMOJI[item.type] || '📸'}
        </div>
      </div>

      {/* Actor name */}
      <span style={{
        fontSize: 9,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 1.2,
        maxWidth: isVertical ? 100 : 64,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {item.actorName.split(' ')[0]}
      </span>

      {/* Time ago */}
      <span style={{
        fontSize: 8,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
      }}>
        {item.timeAgo}
      </span>
    </div>
  );
}

// ── Mobile Horizontal Strip ────────────────────────────────────────────────────

function MobileStrip({ items, selectedItemId, onItemClick }: {
  items: ActivityRailItem[];
  selectedItemId: string | null;
  onItemClick: (item: ActivityRailItem) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const isPausedRef = useRef(false);
  const scrollPosRef = useRef(0);

  const displayItems = [...items, ...items];

  useEffect(() => {
    const animate = () => {
      if (!isPausedRef.current && stripRef.current) {
        scrollPosRef.current += SCROLL_SPEED;
        const totalWidth = stripRef.current.scrollWidth / 2;
        if (totalWidth > 0 && scrollPosRef.current >= totalWidth) {
          scrollPosRef.current = 0;
        }
        stripRef.current.style.transform = `translateX(-${scrollPosRef.current}px)`;
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const handleTouchStart = () => { isPausedRef.current = true; };
  const handleTouchEnd = () => {
    setTimeout(() => { isPausedRef.current = false; }, 2000);
  };

  return (
    <div
      className="md:hidden"
      style={{
        height: 90,
        width: '100%',
        background: 'rgba(15, 28, 53, 0.95)',
        overflow: 'hidden',
        position: 'relative',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Gradient fade left */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 20,
        background: 'linear-gradient(to right, rgba(15,28,53,0.95), transparent)',
        zIndex: 2, pointerEvents: 'none',
      }} />

      {/* Live indicator */}
      <div style={{
        position: 'absolute', top: 4, left: 8, zIndex: 3,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%', background: '#1D9E75',
          animation: 'pulse 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>LIVE</span>
      </div>

      {/* Scrolling content */}
      <div ref={stripRef} style={{
        display: 'flex',
        paddingTop: 6,
        willChange: 'transform',
      }}>
        {displayItems.map((item, i) => (
          <RailItem
            key={`mob-${item.id}-${i}`}
            item={item}
            isSelected={selectedItemId === item.id}
            onClick={() => onItemClick(item)}
            layout="horizontal"
          />
        ))}
      </div>

      {/* Gradient fade right */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: 0, width: 20,
        background: 'linear-gradient(to left, rgba(15,28,53,0.95), transparent)',
        zIndex: 2, pointerEvents: 'none',
      }} />
    </div>
  );
}

// ── Preview Card (exported for use in TravelMap) ───────────────────────────────

export function ActivityPreviewCard({ item, onClose, onNavigate }: {
  item: ActivityRailItem;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const [liked, setLiked] = useState(false);

  return (
    <div
      className="absolute z-30"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 280,
        background: 'rgba(15, 28, 53, 0.97)',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'fadeIn 0.3s ease-out',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Photo */}
      {item.previewImageUrl && (
        <div style={{ width: '100%', height: 160, position: 'relative' }}>
          <img
            src={item.previewImageUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            alt=""
          />
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 8, right: 8,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 14, height: 14, color: '#fff' }} />
          </button>
        </div>
      )}

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        {/* Actor row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <img
            src={item.actorAvatarUrl || '/default-avatar.png'}
            style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
            alt=""
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F0E8' }}>
            {item.actorName}
          </span>
        </div>

        {/* Location */}
        {item.campgroundName && (
          <div style={{ fontSize: 12, color: '#8B9BB4', marginBottom: 4 }}>
            📍 {item.campgroundName}{item.campgroundState ? `, ${item.campgroundState}` : ''}
          </div>
        )}

        {/* Time */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          {item.timeAgo}
        </div>

        {/* Description */}
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.7)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 12,
        }}>
          {item.description}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setLiked(!liked)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '6px 0', borderRadius: 8,
              background: liked ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
              border: 'none', cursor: 'pointer',
              fontSize: 11, color: liked ? '#ef4444' : 'rgba(255,255,255,0.6)',
            }}
          >
            <Heart style={{ width: 12, height: 12, fill: liked ? 'currentColor' : 'none' }} />
            {liked ? 'Liked' : 'Like'}
          </button>
          <button
            onClick={() => onNavigate(item.navigateTo)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '6px 0', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'rgba(255,255,255,0.6)',
            }}
          >
            <ArrowRight style={{ width: 12, height: 12 }} />
            View
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ActivityRailItem };
