import { Link } from 'react-router-dom';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface DreamingData {
  myWishlist: { campgroundId: string; name: string; state: string; imageUrl: string | null; savedAt: string; rating: number | null }[];
  friendsWishlist: { campgroundId: string; name: string; state: string; imageUrl: string | null; friendName: string; friendAvatar: string | null }[];
  rigRecommendations: { campgroundId: string; name: string; state: string; imageUrl: string | null; recommendedBy: string; rigClass: string }[];
  nearTrip: { campgroundId: string; name: string; state: string; imageUrl: string | null; distanceFromRoute: number }[];
}

interface Props {
  data: DreamingData | null;
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
      {[0, 1, 2].map(i => <div key={i} style={{ minWidth: 180, height: 200, borderRadius: 12, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
    </div>
  );
}

function WishlistCard({ campgroundId, name, state, imageUrl, rating, overlay, actions }: {
  campgroundId: string; name: string; state: string; imageUrl: string | null; rating?: number | null;
  overlay?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 180, maxWidth: 180, flexShrink: 0 }}>
      <Link to={`/campgrounds/${campgroundId}`} style={{ textDecoration: 'none' }}>
        <div style={{ width: 180, borderRadius: 12, overflow: 'hidden', background: CN.card, border: `1px solid ${CN.border}` }}>
          <div style={{ height: 110, background: CN.cardAlt, position: 'relative' }}>
            {imageUrl ? (
              <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CN.muted, fontSize: 28 }}>{'\u26FA'}</div>
            )}
            {rating != null && rating > 0 && (
              <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>
                {'\u2B50'} {rating.toFixed(1)}
              </div>
            )}
            {overlay}
          </div>
          <div style={{ padding: '8px 10px' }}>
            <div style={{ color: CN.cream, fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ color: CN.muted, fontSize: 11, marginTop: 2 }}>{state}</div>
          </div>
        </div>
      </Link>
      {/* Planning actions */}
      {actions && <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>{actions}</div>}
    </div>
  );
}

function ActionBtn({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 6, fontSize: 9, fontWeight: 600, textDecoration: 'none', background: CN.cardAlt, color: CN.gold, border: `1px solid ${CN.border}` }}>
      {label}
    </Link>
  );
}

function ScrollRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: CN.muted, fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>{children}</div>
    </div>
  );
}

export default function DreamingSection({ data }: Props) {
  if (data === null) {
    return (
      <div style={{ background: CN.card, borderRadius: 16, padding: 16 }}>
        <div style={{ color: CN.cream, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{'\u{1F4AD}'} Saved Places</div>
        <SkeletonRow />
        <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
      </div>
    );
  }

  const myWishlist = data.myWishlist || [];
  const friendsWishlist = data.friendsWishlist || [];
  const rigRecommendations = data.rigRecommendations || [];
  const nearTrip = data.nearTrip || [];
  const allEmpty = !myWishlist.length && !friendsWishlist.length && !rigRecommendations.length && !nearTrip.length;

  if (allEmpty) {
    return (
      <div style={{ background: CN.card, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>{'\u{1F4AD}'}</span>
        <span style={{ fontSize: 12, color: CN.muted }}>Save campgrounds to build your dream list</span>
        <Link to="/campgrounds" style={{ fontSize: 12, color: CN.gold, textDecoration: 'none', fontWeight: 600, marginLeft: 'auto', whiteSpace: 'nowrap' }}>Explore &rarr;</Link>
      </div>
    );
  }

  return (
    <div style={{ background: CN.card, borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: CN.cream, fontSize: 16, fontWeight: 700 }}>{'\u{1F4AD}'} Saved Places</div>
        <Link to="/wishlists" style={{ color: CN.gold, fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>See all &rarr;</Link>
      </div>

      {myWishlist.length > 0 && (
        <ScrollRow label={`\u2764\uFE0F Places you saved (${myWishlist.length})`}>
          {myWishlist.map(c => (
            <WishlistCard key={c.campgroundId} {...c}
              actions={<>
                <ActionBtn to={`/trips/new?dest=${c.campgroundId}`} label="Plan Trip" />
                <ActionBtn to={`/campgrounds/${c.campgroundId}`} label="Details" />
              </>}
            />
          ))}
        </ScrollRow>
      )}

      {friendsWishlist.length > 0 && (
        <ScrollRow label="Friends' picks">
          {friendsWishlist.map(c => (
            <WishlistCard key={c.campgroundId} campgroundId={c.campgroundId} name={c.name} state={c.state} imageUrl={c.imageUrl}
              overlay={
                <div style={{ position: 'absolute', bottom: 6, left: 6, width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${CN.card}` }}>
                  {c.friendAvatar ? <img src={c.friendAvatar} alt={c.friendName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: CN.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: CN.bg }}>{c.friendName?.[0]}</div>}
                </div>
              }
            />
          ))}
        </ScrollRow>
      )}

      {rigRecommendations.length > 0 && (
        <ScrollRow label={'\u{1F690} Recommended for your rig'}>
          {rigRecommendations.map(c => <WishlistCard key={c.campgroundId} campgroundId={c.campgroundId} name={c.name} state={c.state} imageUrl={c.imageUrl} />)}
        </ScrollRow>
      )}

      {nearTrip.length > 0 && (
        <ScrollRow label={'\u{1F4CD} Along your route'}>
          {nearTrip.map(c => <WishlistCard key={c.campgroundId} campgroundId={c.campgroundId} name={c.name} state={c.state} imageUrl={c.imageUrl} />)}
        </ScrollRow>
      )}
    </div>
  );
}
