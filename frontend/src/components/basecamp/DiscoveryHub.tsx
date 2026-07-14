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
      <div style={{ marginBottom: 20 }}>
        <SectionHeader icon="✨" title="Dream Campgrounds" subtitle="Your adventure bucket list" />
        {dreamTrips.length > 0 ? (
          <ScrollRow>
            {dreamTrips.map((trip: any, i: number) => {
              const firstStopName = trip.stops?.[0]?.campground?.name || trip.stops?.[0]?.place?.name || trip.stops?.[0]?.name || '';
              const subtitle = trip.stopCount > 1 ? `${firstStopName} + ${trip.stopCount - 1} more` : firstStopName;
              const rot = rotations[(i + 5) % rotations.length];
              return (
                <Link key={trip.id} to={`/road-trips/${trip.id}`} className="sticker block flex-shrink-0" style={{
                  width: 220, overflow: 'hidden', background: CN.navy,
                  textDecoration: 'none', transform: `rotate(${rot}deg)`,
                }}>
                  <div style={{ height: 110, overflow: 'hidden', position: 'relative' }}>
                    {trip.coverImage ? (
                      <img src={trip.coverImage} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${CN.navy} 0%, #2D1B4E 60%, ${CN.deep} 100%)`, position: 'relative' }}>
                        {/* Genie mascot — bottom-right, subtle */}
                        <img src="/images/genie-full-v2.png" alt="" style={{
                          position: 'absolute', bottom: 4, right: 4,
                          width: 48, height: 48, objectFit: 'contain', opacity: 0.4,
                        }} />
                      </div>
                    )}
                    <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'rgba(201,168,76,0.9)', color: CN.deep }}>
                      ✨ {trip.stopCount} stop{trip.stopCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: CN.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trip.title}</h4>
                    {subtitle && (
                      <p style={{ fontSize: 10, color: CN.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {subtitle}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </ScrollRow>
        ) : wishlist.length > 0 ? (
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
          <SectionHeader icon="🍳" title="Camp Kitchen" subtitle="Recipes made for the campfire" />

          {/* Featured recipe card */}
          <Link to={`/recipes/${campKitchen.featured.id}`} style={{
            display: 'flex', gap: 12, margin: '0 4px', padding: 12,
            border: `3px solid ${CN.cream}`, borderRadius: 16,
            boxShadow: `4px 4px 0px ${CN.deep}`, background: CN.navy,
            textDecoration: 'none', transform: 'rotate(0.5deg)',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'rotate(0deg) scale(1.02)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'rotate(0.5deg)'; }}>
            {campKitchen.featured.imageUrl ? (
              <img src={campKitchen.featured.imageUrl} alt="" loading="lazy"
                style={{ width: 90, height: 90, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              /* Themed no-image variant: category-specific icon on gradient */
              <div style={{
                width: 90, height: 90, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${CN.navy} 0%, #2D1B4E 100%)`,
                border: `2px solid ${CN.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 32 }}>
                  {(campKitchen.featured.category || '').includes('Dutch') ? '🏺' :
                   (campKitchen.featured.category || '').includes('Blackstone') ? '🥩' :
                   (campKitchen.featured.category || '').includes('Kids') ? '🧒' : '🔥'}
                </span>
                <span style={{ fontSize: 8, color: CN.muted, marginTop: 2 }}>{campKitchen.featured.category || 'Campfire'}</span>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: CN.cream, marginBottom: 4, lineHeight: 1.3 }}>
                {campKitchen.featured.title}
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                {campKitchen.featured.cookTime && (
                  <span style={{ fontSize: 11, color: CN.muted }}>⏱ {campKitchen.featured.cookTime} min</span>
                )}
                {campKitchen.featured.difficulty && (
                  <span style={{ fontSize: 11, color: CN.muted }}>· {campKitchen.featured.difficulty}</span>
                )}
              </div>
              <CBadge color="orange">🔥 Perfect for campfires</CBadge>
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
