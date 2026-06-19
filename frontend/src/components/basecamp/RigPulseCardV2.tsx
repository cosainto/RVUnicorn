import { Link } from 'react-router-dom';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface MaintenanceData {
  serviceCount: number;
  totalSpent: number;
  overdueCount: number;
  upcomingCount: number;
  overdue: { id: string; title: string; category: string }[];
  upcoming: { id: string; title: string; category: string; dueDate: string }[];
}

interface RigPulseData {
  hasActiveTrip: boolean;
  trip: { name: string; destination: string | null; daysAway: number | null; totalMiles: number; totalNights: number; statesVisited: number } | null;
  lastCheckIn: { campgroundName: string; date: string; daysAgo: number | null } | null;
  lastPhoto: { url: string | null; tripName: string | null; date: string } | null;
  lastSavedCampground: { name: string; state: string; savedAt: string } | null;
  newFollowers: { userId: string; username: string; avatarUrl: string | null; firstName: string }[];
  totalMilesAllTime: number;
  totalNightsAllTime?: number;
  totalStatesVisited?: number;
  totalCampgroundsAllTime?: number;
  followerCount?: number;
  rigName: string;
  rigEmoji: string;
  rigPhoto: string | null;
  rigSlug: string | null;
  rigClass?: string | null;
  coPilots: { userId: string; username: string; avatarUrl: string | null }[];
  pinnedMemories?: { id: string; title: string; photoUrl: string | null; date: string | null }[];
  maintenance?: MaintenanceData;
}

// Humanize rig class enum
function humanizeClass(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function SkeletonCard() {
  return (
    <div style={{ background: CN.card, borderRadius: 16, padding: 20 }}>
      <div style={{ height: 120, borderRadius: 12, background: CN.border, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 16, width: '60%', borderRadius: 4, background: CN.border, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 12, width: '40%', borderRadius: 4, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
    </div>
  );
}

export default function RigPulseCardV2({ data }: { data: RigPulseData | null }) {
  if (!data) return <SkeletonCard />;

  const hasStats = data.totalMilesAllTime > 0 || (data.totalStatesVisited ?? 0) > 0 || (data.totalCampgroundsAllTime ?? 0) > 0;
  const maint = data.maintenance;
  const rigPageUrl = data.rigSlug ? `/rig/${data.rigSlug}` : '/my-rv';

  return (
    <div style={{ background: CN.card, borderRadius: 16, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${CN.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{data.rigEmoji || '\u{1F690}'}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>My Rig</span>
        </div>
        <Link to={rigPageUrl} style={{ fontSize: 11, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>My Rig &rarr;</Link>
      </div>

      {/* Hero image */}
      {data.rigPhoto ? (
        <img src={data.rigPhoto} alt={data.rigName} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: CN.cardAlt }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 36 }}>{data.rigEmoji || '\u{1F690}'}</span>
            <p style={{ fontSize: 10, color: CN.muted, marginTop: 4 }}>
              <Link to="/my-rv" style={{ color: CN.gold, textDecoration: 'none' }}>Add a photo &rarr;</Link>
            </p>
          </div>
        </div>
      )}

      <div style={{ padding: 16 }}>
        {/* Identity */}
        <h3 style={{ fontSize: 16, fontWeight: 700, color: CN.cream, marginBottom: 2 }}>{data.rigName}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {data.rigClass && <span style={{ fontSize: 11, color: CN.muted }}>{humanizeClass(data.rigClass)}</span>}
          {(data.followerCount ?? 0) > 0 && (
            <Link to={rigPageUrl} style={{ fontSize: 11, color: CN.gold, textDecoration: 'none', fontWeight: 500 }}>
              {data.followerCount} follower{data.followerCount !== 1 ? 's' : ''}
            </Link>
          )}
        </div>

        {/* Active trip banner */}
        {data.hasActiveTrip && data.trip && (
          <div style={{ background: CN.cardAlt, borderRadius: 10, padding: '10px 12px', marginBottom: 12, borderLeft: `3px solid ${CN.orange}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 11, color: CN.muted }}>Active Trip</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: CN.cream }}>{data.trip.name}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: CN.gold }}>{data.trip.daysAway ?? '?'}</span>
                <span style={{ fontSize: 10, color: CN.gold, marginLeft: 3 }}>days</span>
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        {hasStats && (
          <div style={{ display: 'flex', gap: 2, marginBottom: 12, background: CN.cardAlt, borderRadius: 8, padding: '8px 10px' }}>
            {data.totalMilesAllTime > 0 && <div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalMilesAllTime.toLocaleString()}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Miles</p></div>}
            {(data.totalStatesVisited ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalStatesVisited}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>States</p></div></>}
            {(data.totalNightsAllTime ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalNightsAllTime}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Nights</p></div></>}
            {(data.totalCampgroundsAllTime ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalCampgroundsAllTime}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Camps</p></div></>}
          </div>
        )}

        {/* ═══ HEALTH / MAINTENANCE (prominent) ═══ */}
        <div style={{ background: CN.cardAlt, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Rig Health</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: maint?.overdue?.length || maint?.upcoming?.length ? 10 : 0 }}>
            <div style={{ background: CN.card, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: CN.cream }}>{maint?.serviceCount ?? 0}</p>
              <p style={{ fontSize: 9, color: CN.muted }}>Service Records</p>
            </div>
            <div style={{ background: CN.card, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>${(maint?.totalSpent ?? 0).toLocaleString()}</p>
              <p style={{ fontSize: 9, color: CN.muted }}>Total Spent</p>
            </div>
            <div style={{ background: CN.card, borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: (maint?.overdueCount ?? 0) > 0 ? '1px solid rgba(239,68,68,0.3)' : undefined }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: (maint?.overdueCount ?? 0) > 0 ? '#ef4444' : CN.cream }}>{maint?.overdueCount ?? 0}</p>
              <p style={{ fontSize: 9, color: (maint?.overdueCount ?? 0) > 0 ? '#ef4444' : CN.muted }}>Overdue</p>
            </div>
            <div style={{ background: CN.card, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: CN.gold }}>{maint?.upcomingCount ?? 0}</p>
              <p style={{ fontSize: 9, color: CN.muted }}>Upcoming</p>
            </div>
          </div>
          {/* Overdue items */}
          {maint?.overdue && maint.overdue.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              {maint.overdue.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                  <span style={{ color: '#ef4444' }}>{'\u26A0\uFE0F'}</span>
                  <span style={{ color: CN.cream }}>{item.title}</span>
                  <span style={{ fontSize: 9, color: CN.muted }}>({item.category})</span>
                </div>
              ))}
            </div>
          )}
          {/* Upcoming items */}
          {maint?.upcoming && maint.upcoming.length > 0 && (
            <div>
              {maint.upcoming.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                  <span style={{ color: CN.gold }}>{'\u{1F527}'}</span>
                  <span style={{ color: CN.cream }}>{item.title}</span>
                  <span style={{ fontSize: 9, color: CN.muted }}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                </div>
              ))}
            </div>
          )}
          <Link to="/maintenance" style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 11, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>
            Manage Maintenance &rarr;
          </Link>
        </div>

        {/* ═══ FOLLOWERS (tappable) ═══ */}
        {data.newFollowers?.length > 0 && (
          <Link to={rigPageUrl} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: CN.cardAlt, borderRadius: 8, marginBottom: 12, textDecoration: 'none' }}>
            <div style={{ display: 'flex' }}>
              {data.newFollowers.slice(0, 4).map((f, i) => (
                <div key={f.userId} style={{ width: 24, height: 24, borderRadius: '50%', background: CN.border, border: `2px solid ${CN.cardAlt}`, marginLeft: i > 0 ? -8 : 0, overflow: 'hidden', zIndex: 4 - i }}>
                  {f.avatarUrl ? <img src={f.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: CN.gold, fontWeight: 700 }}>{f.firstName?.[0]}</div>}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 11, color: CN.gold, fontWeight: 600 }}>+{data.newFollowers.length} new follower{data.newFollowers.length > 1 ? 's' : ''} this week</span>
          </Link>
        )}

        {/* ═══ MEMORY WALL PEEK ═══ */}
        {data.pinnedMemories && data.pinnedMemories.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Memory Wall</p>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {data.pinnedMemories.map(m => (
                <Link key={m.id} to={rigPageUrl} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                    {m.photoUrl ? <img src={m.photoUrl} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\u{1F4F8}'}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/trips/new" style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 8, background: CN.gold, color: CN.bg, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>Plan a Trip</Link>
          <Link to={rigPageUrl} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 8, background: 'transparent', border: `1px solid ${CN.gold}`, color: CN.gold, fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>My Rig</Link>
        </div>
      </div>
    </div>
  );
}
