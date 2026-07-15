/**
 * DiscoveryHub — Basecamp discovery sections 1-6.
 * Uses shared cartoon primitives (full intensity for cards, subtle for containers).
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import GenieWishlistButton from '../ui/GenieWishlistButton';
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
function DiscoveryCard({ item, rotation = 0, size = 'large' }: { item: DiscoveryItem; rotation?: number; size?: 'large' | 'medium' }) {
  const meta = CATEGORY_META[item.category || (item.type === 'campground' ? 'CAMPGROUND' : 'OTHER')];
  const link = item.type === 'campground' ? `/campgrounds/${item.id}` : `/place/${item.id}`;
  const location = [item.city, item.state].filter(Boolean).join(', ');
  const w = size === 'large' ? 280 : 220;
  const imgH = size === 'large' ? 160 : 120;

  return (
    <Link to={link} className="block flex-shrink-0 group" style={{
      width: w, border: `3px solid ${CN.cream}`, borderRadius: 20,
      boxShadow: `5px 5px 0px ${CN.deep}`,
      transform: `rotate(${rotation}deg)`,
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
      overflow: 'hidden', background: CN.navy, textDecoration: 'none',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'rotate(0deg) scale(1.03)'; e.currentTarget.style.boxShadow = `6px 6px 0px ${CN.deep}`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = `rotate(${rotation}deg)`; e.currentTarget.style.boxShadow = `5px 5px 0px ${CN.deep}`; }}>
      <div style={{ width: '100%', height: imgH, overflow: 'hidden', position: 'relative' }}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <NoPhotoHero category={item.category || (item.type === 'campground' ? 'CAMPGROUND' : undefined)} />
        )}
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <CBadge color={item.type === 'campground' ? 'gold' : 'orange'}>
            {meta.emoji} {meta.label}
          </CBadge>
        </div>
        {item.distance != null && (
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.6)', color: 'white' }}>
            {item.distance} mi
          </span>
        )}
        {/* Genie wishlist button */}
        <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
          <GenieWishlistButton itemId={item.id} itemType={item.type} itemName={item.name} size="sm" scrim />
        </div>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <h3 style={{ fontSize: size === 'large' ? 14 : 12, fontWeight: 700, color: CN.cream, lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </h3>
        {location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
            <MapPin style={{ width: 11, height: 11, color: CN.muted, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: CN.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
          </div>
        )}
        {item.rating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Star style={{ width: 12, height: 12, color: CN.gold, fill: CN.gold }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: CN.gold }}>{item.rating}</span>
            {item.reviewCount ? <span style={{ fontSize: 9, color: CN.muted }}>({item.reviewCount})</span> : null}
          </div>
        ) : (
          <span style={{ fontSize: 9, color: CN.muted }}>Explore →</span>
        )}
      </div>
    </Link>
  );
}

/* ── Horizontal scroll row (shared) ───────────────────────────── */
function ScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 14, overflowX: 'auto', overflowY: 'hidden',
      paddingBottom: 14, paddingLeft: 4, paddingRight: 16, paddingTop: 6,
      scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
    }}>
      {children}
    </div>
  );
}

/* ── Section header (shared) ──────────────────────────────────── */
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 8, paddingLeft: 4 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: CN.gold, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {icon} {title}
      </h3>
      {subtitle && <p style={{ fontSize: 10, color: CN.muted, marginTop: 2 }}>{subtitle}</p>}
    </div>
  );
}

/* ── Skeleton row ─────────────────────────────────────────────── */
function SkeletonRow({ count = 3, w = 280 }: { count?: number; w?: number }) {
  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'hidden', paddingLeft: 4, paddingBottom: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ width: w, height: 200, flexShrink: 0, background: CN.navyLight, borderRadius: 20, border: `3px solid ${CN.border}` }} className="animate-pulse" />
      ))}
    </div>
  );
}

/* ── Camp Kitchen category chips ──────────────────────────────── */
const KITCHEN_CATEGORIES = [
  { id: 'dutch-oven', label: '🍳 Dutch Oven' },
  { id: 'blackstone', label: '🥩 Blackstone' },
  { id: 'quick-meals', label: '⚡ Quick Meals' },
  { id: 'kids', label: '👶 Kids\' Favorites' },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function DiscoveryHub() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/basecamp/v2/discovery').catch(() => ({ data: {} })),
      api.get('/dream-trips/stops').catch(() => ({ data: [] })),
      api.get('/dream-trips').catch(() => ({ data: [] })),
    ]).then(([discoveryRes, stopsRes, tripsRes]) => {
      const d = discoveryRes.data || {};
      // Replace wishlist with dream trip stops
      d.wishlist = Array.isArray(stopsRes.data) ? stopsRes.data : [];
      d.dreamTrips = Array.isArray(tripsRes.data) ? tripsRes.data : [];
      setData(d);
    }).finally(() => setLoading(false));
  }, []);

  const rotations = [-1.5, 1, -0.5, 1.5, -1, 0.8, -1.2, 0.5, -0.8, 1.2];
  const trending: DiscoveryItem[] = data?.trending || [];
  const becauseYouVisited = data?.becauseYouVisited;
  const wishlist: DiscoveryItem[] = data?.wishlist || [];
  const dreamTrips: any[] = data?.dreamTrips || [];
  const seasonal = data?.seasonal;
  const campKitchen = data?.campKitchen;

  // Nothing to show at all
  if (!loading && trending.length === 0 && !becauseYouVisited && wishlist.length === 0 && !seasonal) return null;

  return (
    <div style={{ marginTop: 20 }}>
      {/* ═══════════════════════════════════════════════════════════
          SECTION 1: Discovery Hero Band
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 16, paddingLeft: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: CN.cream, marginBottom: 2 }}>
          Discover Your Next Adventure
        </h2>
        <SquiggleUnderline width={140} color={CN.gold} />
        <p style={{ fontSize: 12, color: CN.muted, marginTop: 6 }}>
          Picked for you from your travels and wishlist
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2: Trending Near You
          ═══════════════════════════════════════════════════════════ */}
      {(loading || trending.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeader icon="🔥" title="Trending Near You" />
          {loading ? <SkeletonRow /> : (
            <ScrollRow>
              {trending.map((item, i) => (
                <div key={item.id} style={{ scrollSnapAlign: 'start' }}>
                  <DiscoveryCard item={item} rotation={rotations[i % rotations.length]} />
                </div>
              ))}
            </ScrollRow>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3: Because You Visited
          (hidden entirely if no visit history)
          ═══════════════════════════════════════════════════════════ */}
      {becauseYouVisited && becauseYouVisited.items?.length >= 2 && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeader
            icon="💡"
            title={`Because you visited ${becauseYouVisited.basedOn}`}
            subtitle="Similar campgrounds you might love"
          />
          <ScrollRow>
            {becauseYouVisited.items.map((item: DiscoveryItem, i: number) => (
              <div key={item.id} style={{ scrollSnapAlign: 'start' }}>
                <DiscoveryCard item={item} rotation={rotations[(i + 3) % rotations.length]} size="medium" />
              </div>
            ))}
          </ScrollRow>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4: Dream Campgrounds (wishlist)
          ═══════════════════════════════════════════════════════════ */}
        {/* Motion styles — gated on prefers-reduced-motion */}
      <style>{`
        @keyframes genie-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes steam-rise { 0%{opacity:0.6;transform:translateY(0)} 100%{opacity:0;transform:translateY(-12px)} }
        @media (prefers-reduced-motion: reduce) {
          .genie-float-anim, .steam-anim { animation: none !important; }
        }
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 4 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: CN.gold, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              ✨ Dream Campgrounds
            </h3>
            <p style={{ fontSize: 10, color: CN.muted, marginTop: 2 }}>
              {dreamTrips.length > 0
                ? `${wishlist.length} place${wishlist.length !== 1 ? 's are' : ' is'} waiting for your next adventure.`
                : 'Your adventure bucket list'}
            </p>
          </div>
          {dreamTrips.length > 0 && (
            <Link to="/road-trips?filter=dream" style={{ fontSize: 10, fontWeight: 700, color: CN.gold, textDecoration: 'none' }}>View all →</Link>
          )}
        </div>
        {dreamTrips.length > 0 ? ((() => {
          // Aggregate all stops across all dream trips, deduped
          const allStops: any[] = [];
          const seenIds = new Set<string>();
          for (const trip of dreamTrips) {
            for (const stop of (trip.stops || [])) {
              const key = stop.campground?.id || stop.place?.id || stop.id;
              if (!seenIds.has(key)) {
                seenIds.add(key);
                allStops.push({ ...stop, _tripId: trip.id, _tripStops: trip.stops });
              }
            }
          }
          const totalCount = allStops.length;

          return (
            <div style={{
              margin: '0 4px',
              border: `3px solid ${CN.cream}`, borderRadius: 16,
              boxShadow: `4px 4px 0px ${CN.deep}`,
              background: `linear-gradient(135deg, ${CN.navy} 0%, rgba(45,27,78,0.06) 100%)`,
              overflow: 'hidden',
              transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'; e.currentTarget.style.boxShadow = `5px 6px 0px ${CN.deep}`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `4px 4px 0px ${CN.deep}`; }}>
              {/* Header row */}
              <div style={{ display: 'flex', gap: 12, padding: 12 }}>
                {/* Genie tile */}
                <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 12, overflow: 'hidden',
                  background: `linear-gradient(135deg, ${CN.deep} 0%, #2D1B4E 50%, ${CN.navy} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/images/genie-full-v2.png" alt="" className="genie-float-anim"
                    style={{ width: '70%', height: '70%', objectFit: 'contain', animation: 'genie-float 3.5s ease-in-out infinite' }} />
                </div>
                {/* Title + count */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: CN.cream }}>My Wishlist</h4>
                  <p style={{ fontSize: 11, color: CN.muted, marginTop: 2 }}>
                    {totalCount} place{totalCount !== 1 ? 's are' : ' is'} waiting for your next adventure
                  </p>
                </div>
                {/* View all CTA */}
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <Link to="/trips?filter=dream" style={{ fontSize: 11, fontWeight: 700, color: CN.gold, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    View Wishlist →
                  </Link>
                </div>
              </div>

              {/* Thumbnail row */}
              {totalCount > 0 && (
                <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {allStops.slice(0, 6).map((stop: any, i: number) => {
                    const target = stop.campground || stop.place;
                    const img = target?.imageUrl || target?.websiteImageUrl;
                    const name = target?.name || stop.name || 'Place';
                    const tripFirstStop = stop._tripStops?.[0];
                    const href = tripFirstStop?.id ? `/trips/${tripFirstStop.id}` : '/trips?filter=dream';
                    return (
                      <Link key={i} to={href} style={{ flexShrink: 0, textDecoration: 'none', textAlign: 'center', width: 64 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', margin: '0 auto',
                          border: `2px solid ${CN.border}` }}>
                          {img ? (
                            <img src={img} alt={name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${CN.deep}, #2D1B4E)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MapPin style={{ width: 16, height: 16, color: CN.border }} />
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: 9, color: CN.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                      </Link>
                    );
                  })}
                  {totalCount > 6 && (
                    <Link to="/trips?filter=dream" style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 10,
                      background: CN.navyLight, border: `2px solid ${CN.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      textDecoration: 'none', margin: '0 auto' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: CN.muted }}>+{totalCount - 6}</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })()) : wishlist.length > 0 ? (
          /* Fallback: flat wishlist items if no dream trips but old saves exist */
          <ScrollRow>
            {wishlist.map((item, i) => (
              <div key={item.id} style={{ scrollSnapAlign: 'start' }}>
                <DiscoveryCard item={item} rotation={rotations[(i + 5) % rotations.length]} size="medium" />
              </div>
            ))}
          </ScrollRow>
        ) : (
          /* Aspirational empty state — full-intensity sticker card */
          <div style={{
            margin: '0 4px', padding: 20, textAlign: 'center',
            border: `3px solid ${CN.cream}`, borderRadius: 20,
            boxShadow: `5px 5px 0px ${CN.deep}`, background: CN.navy,
            transform: 'rotate(-0.5deg)',
          }}>
            <img src="/images/genie-full-v2.png" alt="Genie mascot" style={{ width: 80, height: 80, objectFit: 'contain', margin: '0 auto 8px', display: 'block' }} />
            <h4 style={{ fontSize: 15, fontWeight: 700, color: CN.cream, marginBottom: 4 }}>
              Make a wish — save campgrounds and experiences you dream of visiting
            </h4>
            <p style={{ fontSize: 11, color: CN.muted, marginBottom: 12 }}>
              Save campgrounds you dream about visiting — we'll help you plan the trip.
            </p>
            <Link to="/campgrounds" style={{
              display: 'inline-block', padding: '8px 20px', borderRadius: 12,
              background: CN.gold, color: CN.deep, fontSize: 12, fontWeight: 700,
              textDecoration: 'none', border: `2px solid ${CN.gold}`,
              boxShadow: '3px 3px 0px rgba(0,0,0,0.2)',
            }}>
              Explore Campgrounds →
            </Link>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 5: Camp Kitchen
          ═══════════════════════════════════════════════════════════ */}
      {campKitchen && campKitchen.featured && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeader icon="🍳" title="Camp Kitchen" subtitle="Tonight's perfect meal after a day on the trail." />

          {/* Featured recipe card */}
          <Link to={`/recipes/${campKitchen.featured.id}`} style={{
            display: 'flex', gap: 12, margin: '0 4px',
            border: `3px solid ${CN.cream}`, borderRadius: 16,
            boxShadow: `4px 4px 0px ${CN.deep}`,
            background: `linear-gradient(135deg, ${CN.navy} 0%, rgba(232,98,42,0.04) 100%)`,
            textDecoration: 'none', overflow: 'hidden',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
            cursor: 'pointer',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'; e.currentTarget.style.boxShadow = `5px 6px 0px ${CN.deep}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `4px 4px 0px ${CN.deep}`; }}>
            {campKitchen.featured.imageUrl ? (
              <img src={campKitchen.featured.imageUrl} alt="" loading="lazy"
                style={{ width: 82, height: 82, borderRadius: '13px 0 0 13px', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              /* SVG illustration variant by recipe category */
              <div style={{
                width: 82, height: 82, borderRadius: '13px 0 0 13px', flexShrink: 0,
                background: `linear-gradient(135deg, ${CN.deep} 0%, #1a1235 50%, ${CN.navy} 100%)`,
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Steam wisps */}
                <div className="steam-anim" style={{ position: 'absolute', top: 8, left: '30%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', animation: 'steam-rise 2.5s ease-in-out infinite' }} />
                <div className="steam-anim" style={{ position: 'absolute', top: 12, left: '55%', width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', animation: 'steam-rise 3s ease-in-out 0.8s infinite' }} />
                {/* Campfire flames SVG */}
                <svg viewBox="0 0 90 90" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  {/* Glow */}
                  <circle cx="45" cy="65" r="20" fill={CN.orange} opacity="0.15" />
                  {/* Flame outer */}
                  <path d="M45 25 C35 40, 28 55, 32 65 C34 72, 40 75, 45 75 C50 75, 56 72, 58 65 C62 55, 55 40, 45 25Z" fill={CN.orange} opacity="0.7" />
                  {/* Flame inner */}
                  <path d="M45 35 C40 45, 36 55, 38 62 C39 67, 42 70, 45 70 C48 70, 51 67, 52 62 C54 55, 50 45, 45 35Z" fill={CN.gold} opacity="0.9" />
                  {/* Flame core */}
                  <path d="M45 45 C43 50, 41 56, 42 60 C43 63, 44 65, 45 65 C46 65, 47 63, 48 60 C49 56, 47 50, 45 45Z" fill="#FFF3CD" opacity="0.8" />
                  {/* Logs */}
                  <rect x="28" y="72" width="34" height="5" rx="2.5" fill="#5C3D2E" />
                  <rect x="30" y="68" width="30" height="5" rx="2.5" fill="#7A5033" transform="rotate(-8 45 70)" />
                </svg>
                {/* Category accent icon */}
                <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 16, opacity: 0.7 }}>
                  {(() => {
                    const cat = (campKitchen.featured.category || '').toLowerCase();
                    if (cat.includes('dutch')) return <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="6" width="12" height="8" rx="2" fill={CN.gold} opacity="0.8"/><rect x="4" y="4" width="8" height="3" rx="1" fill={CN.gold} opacity="0.6"/><rect x="6" y="2" width="4" height="3" rx="1" fill={CN.gold} opacity="0.4"/></svg>;
                    if (cat.includes('blackstone')) return <svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="7" width="14" height="3" rx="1" fill={CN.muted} opacity="0.8"/><rect x="2" y="5" width="3" height="3" rx="1" fill="#CD7F32"/><rect x="7" y="4" width="4" height="4" rx="1" fill="#CD7F32"/></svg>;
                    if (cat.includes('kids')) return <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="6" r="4" fill={CN.gold} opacity="0.7"/><path d="M3 14 C3 10, 6 8, 8 8 C10 8, 13 10, 13 14" fill={CN.gold} opacity="0.5"/></svg>;
                    return <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1 L6 6 L1 6 L5 9 L3.5 14 L8 11 L12.5 14 L11 9 L15 6 L10 6Z" fill={CN.gold} opacity="0.6"/></svg>;
                  })()}
                </div>
              </div>
            )}
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0, padding: '8px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: CN.cream, marginBottom: 3, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {campKitchen.featured.title}
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 4 }}>
                {campKitchen.featured.cookTime && (
                  <span style={{ fontSize: 10, color: CN.muted }}>⏱ {campKitchen.featured.cookTime} min</span>
                )}
                {campKitchen.featured.difficulty && (
                  <span style={{ fontSize: 10, color: CN.muted }}>· {campKitchen.featured.difficulty}</span>
                )}
              </div>
              <CBadge color="orange">🔥 Perfect for campfires</CBadge>
            </div>
            {/* CTA */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 0 0', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: CN.orange, whiteSpace: 'nowrap' }}>
                Cook Tonight →
              </span>
            </div>
          </Link>

          {/* Category chips */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingLeft: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {(campKitchen.categories || KITCHEN_CATEGORIES.map(c => c.label)).map((cat: string, i: number) => (
              <Link key={i} to="/recipes" style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                border: `2px solid ${CN.border}`, background: CN.navyLight,
                fontSize: 11, fontWeight: 600, color: CN.cream, textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}>
                {cat}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* If no camp kitchen data, show a minimal fallback */}
      {(!campKitchen || !campKitchen.featured) && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeader icon="🍳" title="Camp Kitchen" subtitle="Recipes made for the campfire" />
          <div style={{ display: 'flex', gap: 6, paddingLeft: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {KITCHEN_CATEGORIES.map((cat, i) => (
              <Link key={i} to="/recipes" style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                border: `2px solid ${CN.border}`, background: CN.navyLight,
                fontSize: 11, fontWeight: 600, color: CN.cream, textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}>
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 6: Seasonal Discovery
          ═══════════════════════════════════════════════════════════ */}
      {seasonal && seasonal.items?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionHeader icon="🌤" title={seasonal.title} subtitle={seasonal.blurb} />
          <ScrollRow>
            {seasonal.items.map((item: DiscoveryItem, i: number) => (
              <div key={item.id} style={{ scrollSnapAlign: 'start' }}>
                <DiscoveryCard item={item} rotation={rotations[(i + 7) % rotations.length]} size="medium" />
              </div>
            ))}
          </ScrollRow>
        </div>
      )}
    </div>
  );
}
