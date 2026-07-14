/**
 * DiscoveryHub — Basecamp sections 1-2: hero band + trending nearby cards.
 * Uses shared cartoon primitives (full intensity for cards, subtle for containers).
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Star } from 'lucide-react';
import api from '../../services/api';
import { CBadge, CN, SquiggleUnderline } from '../ui/CartoonPrimitives';

/* ── Category emoji + labels ──────────────────────────────────── */
const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  CAMPGROUND: { emoji: '🏕', label: 'Campground' },
  OVERNIGHT_STOP: { emoji: '🛏', label: 'Overnight Stop' },
  RESTAURANT: { emoji: '🍽', label: 'Restaurant' },
  HIKING_TRAIL: { emoji: '🥾', label: 'Trail' },
  ATTRACTION: { emoji: '🎡', label: 'Attraction' },
  SCENIC_OVERLOOK: { emoji: '🌄', label: 'Overlook' },
  MUSEUM: { emoji: '🏛', label: 'Museum' },
  VISITOR_CENTER: { emoji: 'ℹ️', label: 'Visitor Center' },
  OUTFITTER: { emoji: '🎒', label: 'Outfitter' },
  CAMP_STORE: { emoji: '🏪', label: 'Camp Store' },
  RV_SERVICE: { emoji: '🔧', label: 'RV Service' },
  LANDMARK: { emoji: '📍', label: 'Landmark' },
  OTHER: { emoji: '📌', label: 'Place' },
};

interface DiscoveryItem {
  id: string;
  name: string;
  type: 'campground' | 'place';
  category?: string;
  imageUrl?: string | null;
  city?: string | null;
  state?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  distance?: number;
}

/* ── No-photo card background ─────────────────────────────────── */
function NoPhotoHero({ category }: { category?: string }) {
  const meta = CATEGORY_META[category || 'CAMPGROUND'] || CATEGORY_META.CAMPGROUND;
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${CN.navy} 0%, ${CN.navyLight} 50%, ${CN.deep} 100%)` }}>
      <span style={{ fontSize: 48, opacity: 0.6 }}>{meta.emoji}</span>
    </div>
  );
}

/* ── Discovery Card (sticker style — full intensity) ──────────── */
function DiscoveryCard({ item, rotation = 0 }: { item: DiscoveryItem; rotation?: number }) {
  const meta = CATEGORY_META[item.category || (item.type === 'campground' ? 'CAMPGROUND' : 'OTHER')];
  const link = item.type === 'campground' ? `/campgrounds/${item.id}` : `/place/${item.id}`;
  const location = [item.city, item.state].filter(Boolean).join(', ');

  return (
    <Link to={link} className="block flex-shrink-0 group" style={{
      width: 280,
      border: `3px solid ${CN.cream}`,
      borderRadius: 20,
      boxShadow: `5px 5px 0px ${CN.deep}`,
      transform: `rotate(${rotation}deg)`,
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
      overflow: 'hidden',
      background: CN.navy,
      textDecoration: 'none',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'rotate(0deg) scale(1.03)'; e.currentTarget.style.boxShadow = `6px 6px 0px ${CN.deep}`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = `rotate(${rotation}deg)`; e.currentTarget.style.boxShadow = `5px 5px 0px ${CN.deep}`; }}>

      {/* Image / no-photo variant */}
      <div style={{ width: '100%', height: 160, overflow: 'hidden', position: 'relative' }}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <NoPhotoHero category={item.category || (item.type === 'campground' ? 'CAMPGROUND' : undefined)} />
        )}
        {/* Category badge */}
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
          <CBadge color={item.type === 'campground' ? 'gold' : 'orange'}>
            {meta.emoji} {meta.label}
          </CBadge>
        </div>
        {/* Distance badge */}
        {item.distance != null && (
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
              background: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)',
            }}>
              {item.distance} mi
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: CN.cream, lineHeight: 1.3, marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </h3>
        {location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <MapPin style={{ width: 12, height: 12, color: CN.muted, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: CN.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
          </div>
        )}

        {/* Rating + review count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {item.rating ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Star style={{ width: 13, height: 13, color: CN.gold, fill: CN.gold }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: CN.gold }}>{item.rating}</span>
              {item.reviewCount ? (
                <span style={{ fontSize: 10, color: CN.muted }}>({item.reviewCount})</span>
              ) : null}
            </div>
          ) : (
            <span style={{ fontSize: 10, color: CN.muted }}>No reviews yet</span>
          )}

          {/* Save / Add to trip actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); }}
              style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${CN.border}`, borderRadius: 6, padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Save to wishlist">
              <Heart style={{ width: 12, height: 12, color: CN.muted }} />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Main DiscoveryHub Component ──────────────────────────────── */
export default function DiscoveryHub() {
  const [trending, setTrending] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/basecamp/v2/discovery')
      .then(res => {
        setTrending(res.data?.trending || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Rotations for sticker cards
  const rotations = [-1.5, 1, -0.5, 1.5, -1, 0.8, -1.2, 0.5, -0.8, 1.2];

  // Don't render if no data
  if (!loading && trending.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      {/* ── SECTION 1: Discovery Hero Band ── */}
      <div style={{ marginBottom: 16, paddingLeft: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: CN.cream, marginBottom: 2 }}>
          Discover Your Next Adventure
        </h2>
        <SquiggleUnderline width={140} color={CN.gold} />
        <p style={{ fontSize: 12, color: CN.muted, marginTop: 6 }}>
          Picked for you from your travels and wishlist
        </p>
      </div>

      {/* ── SECTION 2: Trending Near You ── */}
      <div style={{ marginBottom: 8, paddingLeft: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: CN.gold, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          🔥 Trending Near You
        </h3>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 12, paddingLeft: 4 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ width: 280, height: 240, flexShrink: 0, background: CN.navyLight, borderRadius: 20, border: `3px solid ${CN.border}` }} className="animate-pulse" />
          ))}
        </div>
      ) : (
        <div ref={scrollRef} style={{
          display: 'flex', gap: 16, overflowX: 'auto', overflowY: 'hidden',
          paddingBottom: 16, paddingLeft: 4, paddingRight: 16, paddingTop: 8,
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}>
          <style>{`div[style*="scroll-snap-type"]::-webkit-scrollbar { display: none; }`}</style>
          {trending.map((item, i) => (
            <div key={item.id} style={{ scrollSnapAlign: 'start' }}>
              <DiscoveryCard item={item} rotation={rotations[i % rotations.length]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
