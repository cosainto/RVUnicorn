/**
 * DiscoveryHub — Basecamp discovery sections 1-6.
 * Uses shared cartoon primitives (full intensity for cards, subtle for containers).
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, X } from 'lucide-react';
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
      paddingBottom: 14, paddingLeft: 0, paddingRight: 16, paddingTop: 6,
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
    <div style={{ marginBottom: 8, paddingLeft: 0 }}>
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
    <div style={{ display: 'flex', gap: 14, overflowX: 'hidden', paddingLeft: 0, paddingBottom: 14 }}>
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
  const [undoToast, setUndoToast] = useState<{ name: string; itemId: string; itemType: 'campground' | 'place'; itemName: string } | null>(null);
  const [kitchenTab, setKitchenTab] = useState<'my' | 'explore'>(() => {
    try { return (localStorage.getItem('rvu-kitchen-tab') as 'my' | 'explore') || 'explore'; } catch { return 'explore'; }
  });
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const handleRemoveStop = useCallback(async (stopId: string, itemId: string, itemType: 'campground' | 'place', itemName: string) => {
    // Optimistic removal
    setRemovedIds(prev => new Set(prev).add(stopId));
    setUndoToast({ name: itemName, itemId, itemType, itemName });

    // Auto-dismiss after 6s
    const timer = setTimeout(() => setUndoToast(null), 6000);

    try {
      await api.delete(`/dream-trips/unsave?${itemType === 'campground' ? 'campgroundId' : 'placeId'}=${itemId}`);
    } catch {
      // Rollback on failure
      setRemovedIds(prev => { const next = new Set(prev); next.delete(stopId); return next; });
      setUndoToast(null);
      clearTimeout(timer);
    }
  }, []);

  const handleUndo = useCallback(async () => {
    if (!undoToast) return;
    const { itemId, itemType, itemName } = undoToast;
    setUndoToast(null);
    try {
      await api.post('/dream-trips/save', {
        ...(itemType === 'campground' ? { campgroundId: itemId } : { placeId: itemId }),
        name: itemName,
      });
      // Remove from removedIds to show it again
      setRemovedIds(prev => { const next = new Set(prev); next.delete(itemId); return next; });
      // Reload data
      Promise.all([
        api.get('/dream-trips/stops').catch(() => ({ data: [] })),
        api.get('/dream-trips').catch(() => ({ data: [] })),
      ]).then(([stopsRes, tripsRes]) => {
        setData((d: any) => ({ ...d, wishlist: stopsRes.data || [], dreamTrips: tripsRes.data || [] }));
      });
    } catch {}
  }, [undoToast]);

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

  // Default kitchen tab: My Recipes if user has saved recipes, otherwise Explore
  useEffect(() => {
    if (campKitchen?.savedCount > 0 && !localStorage.getItem('rvu-kitchen-tab')) {
      setKitchenTab('my');
    }
  }, [campKitchen?.savedCount]);

  // Nothing to show at all
  if (!loading && trending.length === 0 && !becauseYouVisited && wishlist.length === 0 && !seasonal) return null;

  return (
    <div style={{ marginTop: 20 }}>
      {/* ═══════════════════════════════════════════════════════════
          SECTION 1: Discovery Hero Band
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 16, paddingLeft: 0 }}>
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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 0 }}>
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
          const visibleStops = allStops.filter((s: any) => !removedIds.has(s.id) && !removedIds.has(s.campground?.id || s.place?.id || s.id));
          const totalCount = visibleStops.length;

          const now = Date.now();
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

          return (
            <div style={{
              margin: 0,
              border: `3px solid ${CN.cream}`, borderRadius: 16,
              boxShadow: `4px 4px 0px ${CN.deep}`,
              background: `linear-gradient(135deg, ${CN.navy} 0%, rgba(45,27,78,0.06) 100%)`,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: CN.cream, flex: 1 }}>
                  ✨ My Wishlist
                  <span style={{ fontSize: 11, fontWeight: 500, color: CN.muted, marginLeft: 6 }}>
                    {totalCount} place{totalCount !== 1 ? 's' : ''}
                  </span>
                </h4>
              </div>

              {/* Body: flex row = [tiles] + [spacer with genie] */}
              {totalCount > 0 && (
                <div style={{ display: 'flex', padding: '0 12px 12px' }}>
                  {/* Tile row — scrolls horizontally, content-width */}
                  <div style={{
                    display: 'flex', gap: 10, flexShrink: 0,
                    overflowX: 'auto', scrollbarWidth: 'none',
                    WebkitOverflowScrolling: 'touch',
                  }}>
                  {allStops.filter((s: any) => !removedIds.has(s.id) && !removedIds.has(s.campground?.id || s.place?.id || s.id)).slice(0, 5).map((stop: any, i: number) => {
                    const target = stop.campground || stop.place;
                    const img = target?.imageUrl || target?.websiteImageUrl;
                    const name = target?.name || stop.name || 'Place';
                    const location = [target?.city, target?.state].filter(Boolean).join(', ');
                    const rating = target?.googleRating;
                    const tripFirstStop = stop._tripStops?.[0];
                    const href = tripFirstStop?.id ? `/trips/${tripFirstStop.id}` : '/trips?filter=dream';
                    const isNew = stop.createdAt && (now - new Date(stop.createdAt).getTime()) < sevenDaysMs;
                    // Infer category: explicit > campground > name-based guess > OTHER
                    let category = target?.category || (stop.campgroundId ? 'CAMPGROUND' : '');
                    if (!category) {
                      const lc = name.toLowerCase();
                      if (/restaurant|grill|café|cafe|diner|bistro|tavern|inn.*restaurant/i.test(lc)) category = 'RESTAURANT';
                      else if (/inn|lodge|hotel|motel|hostel/i.test(lc)) category = 'OVERNIGHT_STOP';
                      else if (/trail|hike|path/i.test(lc)) category = 'HIKING_TRAIL';
                      else if (/museum/i.test(lc)) category = 'MUSEUM';
                      else if (/overlook|viewpoint|vista/i.test(lc)) category = 'SCENIC_OVERLOOK';
                      else category = 'ATTRACTION';
                    }
                    const catMeta = CATEGORY_META[category] || CATEGORY_META.OTHER;

                    return (
                      <Link key={i} to={href} className="group" style={{
                        flexShrink: 0, width: 130, textDecoration: 'none',
                        transition: 'transform 0.2s ease',
                      }}>
                        {/* Image tile */}
                        <div style={{
                          width: 130, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative',
                          border: `2px solid ${CN.border}`,
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03) translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                          {img ? (
                            <img src={img} alt={name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${CN.deep}, #2D1B4E)`,
                              border: `1px solid ${CN.border}`, borderRadius: 8,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                              <span style={{ fontSize: 24 }}>{catMeta.emoji}</span>
                              <span style={{ fontSize: 8, color: CN.muted }}>{catMeta.label}</span>
                            </div>
                          )}
                          {/* New badge */}
                          {isNew && (
                            <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 8, fontWeight: 700,
                              padding: '1px 5px', borderRadius: 4, background: CN.gold, color: CN.deep }}>New</span>
                          )}
                          {/* Remove button — visible on hover (desktop) or always (mobile) */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const itemId = stop.campgroundId || stop.placeId || stop.id;
                              const itemType = stop.campgroundId ? 'campground' as const : 'place' as const;
                              handleRemoveStop(stop.id, itemId, itemType, name);
                            }}
                            aria-label={`Remove ${name} from wishlist`}
                            className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            style={{
                              position: 'absolute', top: 3, right: 3,
                              width: 20, height: 20, borderRadius: '50%',
                              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                              border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', padding: 0,
                            }}>
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                        {/* Info below tile */}
                        <p style={{ fontSize: 11, fontWeight: 600, color: CN.cream, marginTop: 4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                          {location && <span style={{ fontSize: 9, color: CN.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{location}</span>}
                          {rating && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: CN.gold, flexShrink: 0 }}>
                              <Star style={{ width: 9, height: 9, display: 'inline', verticalAlign: 'middle', fill: CN.gold, color: CN.gold }} /> {rating}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                  {/* +N more tile */}
                  {totalCount > 5 && (
                    <Link to="/trips?filter=dream" style={{
                      flexShrink: 0, width: 130, height: 90, borderRadius: 10,
                      background: CN.navyLight, border: `2px solid ${CN.border}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      textDecoration: 'none', gap: 4,
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: CN.muted }}>+{totalCount - 5}</span>
                      <span style={{ fontSize: 9, color: CN.muted }}>more places</span>
                    </Link>
                  )}
                  </div>

                  {/* Spacer with centered genie — fills remaining width */}
                  <div className="hidden lg:flex" style={{
                    flex: 1, minWidth: 0,
                    alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none', overflow: 'hidden',
                  }}>
                    <img src="/images/genie-full-v2.png" alt="" className="genie-float-anim"
                      style={{
                        width: 160, height: 160, objectFit: 'contain', opacity: 0.15,
                        animation: 'genie-float 3.5s ease-in-out infinite',
                        flexShrink: 0,
                      }} />
                  </div>
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
            margin: 0, padding: 20, textAlign: 'center',
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
          SECTION 5: Camp Kitchen — tabbed gallery card
          ═══════════════════════════════════════════════════════════ */}
      {campKitchen && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 0 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: CN.gold, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              🍳 Camp Kitchen
            </h3>
            <Link to="/recipes" style={{ fontSize: 10, fontWeight: 700, color: CN.gold, textDecoration: 'none' }}>Browse all →</Link>
          </div>

          <div style={{
            margin: 0,
            border: `3px solid ${CN.cream}`, borderRadius: 16,
            boxShadow: `4px 4px 0px ${CN.deep}`,
            background: `linear-gradient(135deg, ${CN.navy} 0%, rgba(232,98,42,0.04) 100%)`,
            overflow: 'hidden',
          }}>
            {/* Header + tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 4, background: CN.deep, borderRadius: 8, padding: 2 }}>
                {[
                  { id: 'my', label: 'My Recipes' },
                  { id: 'explore', label: 'Explore' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => {
                    setKitchenTab(tab.id as 'my' | 'explore');
                    try { localStorage.setItem('rvu-kitchen-tab', tab.id); } catch {}
                  }}
                    style={{
                      fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: kitchenTab === tab.id ? CN.navy : 'transparent',
                      color: kitchenTab === tab.id ? CN.gold : CN.muted,
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
            </div>

            {/* Tile gallery */}
            <div style={{ display: 'flex', padding: '0 12px 12px' }}>
              <div style={{
                display: 'flex', gap: 10, flexShrink: 0,
                overflowX: 'auto', scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
              }}>
                {kitchenTab === 'explore' ? (
                  <>
                    {/* Featured Recipe of the Day — first tile, badged */}
                    {campKitchen.featured && (
                      <Link to={`/recipes/${campKitchen.featured.id}`} className="group" style={{ flexShrink: 0, width: 130, textDecoration: 'none' }}>
                        <div style={{
                          width: 130, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative',
                          border: `2px solid ${CN.orange}`,
                          transition: 'transform 0.2s ease',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03) translateY(-2px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                          {campKitchen.featured.imageUrl ? (
                            <img src={campKitchen.featured.imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${CN.deep}, #2D1B4E)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 28 }}>🍳</span>
                            </div>
                          )}
                          <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: CN.orange, color: 'white' }}>⭐ Today</span>
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: CN.cream, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campKitchen.featured.title}</p>
                        <span style={{ fontSize: 9, color: CN.muted }}>{campKitchen.featured.cookTime > 0 ? `⏱ ${campKitchen.featured.cookTime} min` : '⏱ No cook'}</span>
                      </Link>
                    )}
                    {/* Random editorial picks */}
                    {(campKitchen.explore || []).map((r: any) => (
                      <Link key={r.id} to={`/recipes/${r.id}`} className="group" style={{ flexShrink: 0, width: 130, textDecoration: 'none' }}>
                        <div style={{ width: 130, height: 90, borderRadius: 10, overflow: 'hidden', border: `2px solid ${CN.border}`, transition: 'transform 0.2s ease' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03) translateY(-2px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                          {r.imageUrl ? (
                            <img src={r.imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${CN.deep}, #1a1235)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 24 }}>{r.category?.includes('Dutch') ? '🏺' : r.category?.includes('Blackstone') ? '🥩' : r.category?.includes('Kids') ? '🧒' : '🔥'}</span>
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: CN.cream, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                        <span style={{ fontSize: 9, color: CN.muted }}>{r.cookTime > 0 ? `⏱ ${r.cookTime} min` : '⏱ No cook'}</span>
                      </Link>
                    ))}
                  </>
                ) : (
                  <>
                    {/* My saved recipes */}
                    {(campKitchen.saved || []).length > 0 ? (
                      <>
                        {(campKitchen.saved || []).slice(0, 5).map((r: any) => (
                          <Link key={r.id} to={`/recipes/${r.id}`} className="group" style={{ flexShrink: 0, width: 130, textDecoration: 'none' }}>
                            <div style={{ width: 130, height: 90, borderRadius: 10, overflow: 'hidden', border: `2px solid ${CN.border}`, transition: 'transform 0.2s ease' }}
                              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03) translateY(-2px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                              {r.imageUrl ? (
                                <img src={r.imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${CN.deep}, #1a1235)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: 24 }}>🍳</span>
                                </div>
                              )}
                            </div>
                            <p style={{ fontSize: 11, fontWeight: 600, color: CN.cream, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                            <span style={{ fontSize: 9, color: CN.muted }}>{r.cookTime > 0 ? `⏱ ${r.cookTime} min` : '⏱ No cook'}</span>
                          </Link>
                        ))}
                        {(campKitchen.saved || []).length > 5 && (
                          <Link to="/recipes?tab=saved" style={{ flexShrink: 0, width: 130, height: 90, borderRadius: 10, background: CN.navyLight, border: `2px solid ${CN.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', gap: 4 }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: CN.muted }}>+{(campKitchen.saved || []).length - 5}</span>
                            <span style={{ fontSize: 9, color: CN.muted }}>more saved</span>
                          </Link>
                        )}
                      </>
                    ) : (
                      <div style={{ padding: '12px 16px', textAlign: 'center', flex: 1 }}>
                        <p className="text-xs" style={{ color: CN.muted }}>Save recipes you want to cook — tap the bookmark on any recipe</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Watermark spacer */}
              <div className="hidden lg:flex" style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', overflow: 'hidden' }}>
                <img src="/images/hitch-bbq-v1.png" alt="" style={{ width: 160, height: 160, objectFit: 'contain', opacity: 0.15, flexShrink: 0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            </div>

            {/* Category chips */}
            <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {KITCHEN_CATEGORIES.map((cat, i) => (
                <Link key={i} to="/recipes" style={{
                  flexShrink: 0, padding: '4px 12px', borderRadius: 16,
                  border: `1px solid ${CN.border}`, background: CN.navyLight,
                  fontSize: 10, fontWeight: 600, color: CN.cream, textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                  {cat.label}
                </Link>
              ))}
            </div>
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

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 cartoon-card flex items-center gap-3 px-4 py-3 shadow-xl"
          style={{ background: CN.navy, border: `2px solid ${CN.border}`, maxWidth: 400 }}>
          <p className="text-sm" style={{ color: CN.cream }}>
            Removed <span className="font-semibold">{undoToast.name}</span> from your wishlist
          </p>
          <button onClick={handleUndo}
            className="text-xs font-bold px-3 py-1 rounded-lg flex-shrink-0"
            style={{ background: CN.gold, color: CN.deep }}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
