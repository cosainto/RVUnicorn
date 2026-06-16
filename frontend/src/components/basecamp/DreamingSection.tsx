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
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ minWidth: 160, height: 200, borderRadius: 12, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

function CampCard({ campgroundId, name, state, imageUrl, overlay }: { campgroundId: string; name: string; state: string; imageUrl: string | null; overlay?: React.ReactNode }) {
  return (
    <Link to={`/campgrounds/${campgroundId}`} style={{ textDecoration: 'none', minWidth: 160, maxWidth: 160 }}>
      <div style={{ width: 160, height: 200, borderRadius: 12, overflow: 'hidden', background: CN.card, border: `1px solid ${CN.border}`, position: 'relative' }}>
        <div style={{ height: '65%', background: CN.cardAlt, position: 'relative' }}>
          {imageUrl ? (
            <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CN.muted, fontSize: 28 }}>⛺</div>
          )}
          {overlay}
        </div>
        <div style={{ padding: '8px 10px' }}>
          <div style={{ color: CN.cream, fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ color: CN.muted, fontSize: 11, marginTop: 2 }}>{state}</div>
        </div>
      </div>
    </Link>
  );
}

function ScrollRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: CN.muted, fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>{children}</div>
    </div>
  );
}

export default function DreamingSection({ data }: Props) {
  if (data === null) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ color: CN.cream, fontSize: 20, fontWeight: 700 }}>💭 Dreaming</div>
        </div>
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  const { myWishlist, friendsWishlist, rigRecommendations, nearTrip } = data;
  const allEmpty = !myWishlist.length && !friendsWishlist.length && !rigRecommendations.length && !nearTrip.length;
  if (allEmpty) return null;

  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: CN.cream, fontSize: 20, fontWeight: 700 }}>💭 Dreaming</div>
        <Link to="/wishlists" style={{ color: CN.gold, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>See all wishlists →</Link>
      </div>

      {myWishlist.length > 0 && (
        <ScrollRow label="❤️ Places you saved">
          {myWishlist.map((c) => <CampCard key={c.campgroundId} {...c} />)}
        </ScrollRow>
      )}

      {friendsWishlist.length > 0 && (
        <ScrollRow label="Friends' picks">
          {friendsWishlist.map((c) => (
            <CampCard key={c.campgroundId} {...c} overlay={
              <div style={{ position: 'absolute', bottom: 6, left: 6, width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${CN.card}` }}>
                {c.friendAvatar ? <img src={c.friendAvatar} alt={c.friendName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: CN.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: CN.bg }}>{c.friendName[0]}</div>}
              </div>
            } />
          ))}
        </ScrollRow>
      )}

      {rigRecommendations.length > 0 && (
        <ScrollRow label="🚐 Recommended by rigs like yours">
          {rigRecommendations.map((c) => <CampCard key={c.campgroundId} {...c} />)}
        </ScrollRow>
      )}

      {nearTrip.length > 0 && (
        <ScrollRow label="📍 Along your route">
          {nearTrip.map((c) => <CampCard key={c.campgroundId} {...c} />)}
        </ScrollRow>
      )}
    </div>
  );
}
