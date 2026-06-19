/**
 * RigPulseCardV2 — Two distinct rig sections on Basecamp:
 *
 * Section 1: Rig Identity / Influencer Hub
 *   Title = rig's actual name (not "My Rig")
 *   Condensed public rig page: cover photo, recent photos, followers, content activity.
 *   Influencer metrics: recent followers (live data), profile views (when accrued).
 *
 * Section 2: Owner's Dashboard ("My Rig Info")
 *   RV details (real values or "add" affordance), ownership stats, quick actions
 *   wired to existing create flows. Maintenance health.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface MaintenanceData {
  serviceCount: number;
  totalSpent: number;
  overdueCount: number;
  upcomingCount: number;
  overdue: { id: string; title: string; category: string }[];
  upcoming: { id: string; title: string; category: string; dueDate: string }[];
}

interface OwnerDetails {
  year: number | null;
  make: string | null;
  model: string | null;
  lengthFeet: number | null;
  grossWeight: number | null;
  fuelType: string | null;
  towingCapacity: number | null;
  slideoutCount: number | null;
  freshWaterGal: number | null;
  grayWaterGal: number | null;
  blackWaterGal: number | null;
  tireSizeFront: string | null;
  tireSizeRear: string | null;
  tireInstallDate: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentOdometer: number | null;
  avgMPG: number | null;
  solarWatts: number | null;
  generatorWatts: number | null;
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
  rigName: string | null;
  rigSpec: string | null;
  rigEmoji: string;
  rigPhoto: string | null;
  rigSlug: string | null;
  rigClass?: string | null;
  coverPhoto?: string | null;
  recentPhotos?: string[];
  coPilots: { userId: string; username: string; avatarUrl: string | null }[];
  pinnedMemories?: { id: string; title: string; photoUrl: string | null; date: string | null }[];
  maintenance?: MaintenanceData;
  ownerDetails?: OwnerDetails;
}

function humanizeClass(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function humanizeFuel(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
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

// ─── DETAIL ROW (shows value or "Add" affordance) ───
function DetailRow({ label, value, editUrl }: { label: string; value: string | number | null | undefined; editUrl?: string }) {
  if (value) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${CN.border}` }}>
        <span style={{ fontSize: 11, color: CN.muted }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: CN.cream }}>{value}</span>
      </div>
    );
  }
  if (editUrl) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${CN.border}` }}>
        <span style={{ fontSize: 11, color: CN.muted }}>{label}</span>
        <Link to={editUrl} style={{ fontSize: 10, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>+ Add</Link>
      </div>
    );
  }
  return null;
}

// ─── QUICK ACTION BUTTON ───
function QuickAction({ label, to }: { label: string; to: string }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8px 10px', borderRadius: 8, background: CN.cardAlt,
      border: `1px solid ${CN.border}`, fontSize: 11, fontWeight: 600,
      color: CN.gold, textDecoration: 'none', whiteSpace: 'nowrap',
    }}>
      {label}
    </Link>
  );
}

export default function RigPulseCardV2({ data }: { data: RigPulseData | null }) {
  if (!data) return <SkeletonCard />;

  const rigPageUrl = data.rigSlug ? `/rig/${data.rigSlug}` : '/my-rv';
  const editUrl = data.rigSlug ? `/rig/${data.rigSlug}/edit` : '/my-rv';
  const hasStats = data.totalMilesAllTime > 0 || (data.totalStatesVisited ?? 0) > 0 || (data.totalCampgroundsAllTime ?? 0) > 0;
  const [rigInfoOpen, setRigInfoOpen] = useState(false);
  const maint = data.maintenance;
  const od = data.ownerDetails;
  const coverImg = data.coverPhoto || data.rigPhoto;
  // User truly has no rig when there's no slug (no rig record found at all)
  const hasNoRig = !data.rigSlug;
  const displayTitle = data.rigName || data.rigSpec || 'My Rig';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — RIG IDENTITY / INFLUENCER HUB
          Title = rig's actual name. Condensed public rig page.
          ════════════════════════════════════════════════════════════════ */}
      <div style={{ background: CN.card, borderRadius: 16, overflow: 'hidden' }}>

        {/* Header — rig name as title, spec as subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${CN.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{data.rigEmoji || '\u{1F690}'}</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: CN.cream, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {hasNoRig ? 'Set Up Your Rig' : displayTitle}
              </p>
              {!hasNoRig && data.rigName && data.rigSpec && (
                <p style={{ fontSize: 10, color: CN.muted, margin: 0 }}>{data.rigSpec}</p>
              )}
            </div>
          </div>
          {!hasNoRig && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Link to={editUrl} style={{ fontSize: 10, color: CN.muted, textDecoration: 'none', fontWeight: 600 }}>Edit</Link>
              <Link to={rigPageUrl} style={{ fontSize: 10, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>View &rarr;</Link>
            </div>
          )}
        </div>

        {/* Cover photo */}
        {coverImg ? (
          <img src={coverImg} alt={displayTitle} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: CN.cardAlt }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 36 }}>{data.rigEmoji || '\u{1F690}'}</span>
              <p style={{ fontSize: 10, color: CN.muted, marginTop: 4 }}>
                <Link to={editUrl} style={{ color: CN.gold, textDecoration: 'none' }}>Add a cover photo &rarr;</Link>
              </p>
            </div>
          </div>
        )}

        <div style={{ padding: 16 }}>
          {/* Identity subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {data.rigClass && <span style={{ fontSize: 11, color: CN.muted }}>{humanizeClass(data.rigClass)}</span>}
            {(data.followerCount ?? 0) > 0 && (
              <Link to={rigPageUrl} style={{ fontSize: 11, color: CN.gold, textDecoration: 'none', fontWeight: 500 }}>
                {data.followerCount} follower{data.followerCount !== 1 ? 's' : ''}
              </Link>
            )}
          </div>

          {/* Recent photos strip */}
          {data.recentPhotos && data.recentPhotos.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Recent Photos</p>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
                {data.recentPhotos.map((url, i) => (
                  <Link key={i} to={rigPageUrl} style={{ textDecoration: 'none', flexShrink: 0 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Memory Wall peek */}
          {data.pinnedMemories && data.pinnedMemories.length > 0 && !data.recentPhotos?.length && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Memory Wall</p>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
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

          {/* Stats row */}
          {hasStats && (
            <div style={{ display: 'flex', gap: 2, marginBottom: 12, background: CN.cardAlt, borderRadius: 8, padding: '8px 10px' }}>
              {data.totalMilesAllTime > 0 && <div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalMilesAllTime.toLocaleString()}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Miles</p></div>}
              {(data.totalStatesVisited ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalStatesVisited}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>States</p></div></>}
              {(data.totalNightsAllTime ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalNightsAllTime}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Nights</p></div></>}
              {(data.totalCampgroundsAllTime ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalCampgroundsAllTime}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Camps</p></div></>}
            </div>
          )}

          {/* New followers (influencer metric — live data) */}
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

          {/* Active trip banner */}
          {data.hasActiveTrip && data.trip && (
            <div style={{ background: CN.cardAlt, borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${CN.orange}` }}>
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

          {/* Empty state — ONLY when user truly has no rig record */}
          {hasNoRig && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p style={{ fontSize: 12, color: CN.cream, fontWeight: 600, marginBottom: 4 }}>Your rig's story starts here</p>
              <p style={{ fontSize: 11, color: CN.muted, marginBottom: 8 }}>Set up your rig profile to track trips, share photos, and connect with other RVers.</p>
              <Link to="/my-rv" style={{ fontSize: 11, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>Set up your rig profile &rarr;</Link>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — OWNER'S DASHBOARD ("My Rig Info")
          Operational data: RV details, maintenance, quick actions.
          ════════════════════════════════════════════════════════════════ */}
      <div style={{ background: CN.card, borderRadius: 16, overflow: 'hidden' }}>

        {/* Header — clickable to expand/collapse */}
        <button
          onClick={() => setRigInfoOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', width: '100%', background: 'none', border: 'none', borderBottom: rigInfoOpen ? `1px solid ${CN.border}` : 'none', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>My Rig Info</span>
          <ChevronDown style={{ width: 16, height: 16, color: CN.muted, transition: 'transform 0.2s', transform: rigInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>

        {rigInfoOpen && <div style={{ padding: 16 }}>
          {/* RV Details */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>RV Details</p>
            <DetailRow label="Year" value={od?.year} editUrl={editUrl} />
            <DetailRow label="Make" value={od?.make} editUrl={editUrl} />
            <DetailRow label="Model" value={od?.model} editUrl={editUrl} />
            <DetailRow label="Class" value={humanizeClass(data.rigClass)} editUrl={editUrl} />
            <DetailRow label="Length" value={od?.lengthFeet ? `${od.lengthFeet} ft` : null} editUrl={editUrl} />
            <DetailRow label="Weight" value={od?.grossWeight ? `${od.grossWeight.toLocaleString()} lbs` : null} editUrl={editUrl} />
            <DetailRow label="Fuel Type" value={od?.fuelType ? humanizeFuel(od.fuelType) : null} editUrl={editUrl} />
            <DetailRow label="Towing Capacity" value={od?.towingCapacity ? `${od.towingCapacity.toLocaleString()} lbs` : null} editUrl={editUrl} />
            <DetailRow label="Slideouts" value={od?.slideoutCount} editUrl={editUrl} />
            <DetailRow label="Solar" value={od?.solarWatts ? `${od.solarWatts}W` : null} editUrl={editUrl} />
            <DetailRow label="Generator" value={od?.generatorWatts ? `${od.generatorWatts}W` : null} editUrl={editUrl} />
          </div>

          {/* Tanks & Tires */}
          {(od?.freshWaterGal || od?.grayWaterGal || od?.blackWaterGal || od?.tireSizeFront || od?.tireSizeRear) && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Tanks & Tires</p>
              <DetailRow label="Fresh Water" value={od?.freshWaterGal ? `${od.freshWaterGal} gal` : null} editUrl={editUrl} />
              <DetailRow label="Gray Water" value={od?.grayWaterGal ? `${od.grayWaterGal} gal` : null} editUrl={editUrl} />
              <DetailRow label="Black Water" value={od?.blackWaterGal ? `${od.blackWaterGal} gal` : null} editUrl={editUrl} />
              <DetailRow label="Tires (Front)" value={od?.tireSizeFront} editUrl={editUrl} />
              <DetailRow label="Tires (Rear)" value={od?.tireSizeRear} editUrl={editUrl} />
            </div>
          )}

          {/* Ownership Info */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Ownership</p>
            <DetailRow label="Purchase Date" value={od?.purchaseDate ? new Date(od.purchaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null} editUrl={editUrl} />
            <DetailRow label="Odometer" value={od?.currentOdometer ? `${od.currentOdometer.toLocaleString()} mi` : null} editUrl={editUrl} />
            <DetailRow label="Avg MPG" value={od?.avgMPG ? od.avgMPG.toFixed(1) : null} />
            {data.totalMilesAllTime > 0 && <DetailRow label="Miles Traveled" value={data.totalMilesAllTime.toLocaleString()} />}
            {(data.totalStatesVisited ?? 0) > 0 && <DetailRow label="States Visited" value={data.totalStatesVisited!} />}
            {(data.totalCampgroundsAllTime ?? 0) > 0 && <DetailRow label="Campgrounds" value={data.totalCampgroundsAllTime!} />}
          </div>

          {/* Rig Health / Maintenance */}
          <div style={{ background: CN.cardAlt, borderRadius: 10, padding: 12, marginBottom: 14 }}>
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
          </div>

          {/* Quick Actions */}
          <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Quick Actions</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <QuickAction label="+ Maintenance" to="/maintenance" />
            <QuickAction label="+ Modification" to={data.rigSlug ? `/rig/${data.rigSlug}/mods` : '/my-rv'} />
            <QuickAction label="+ Fuel Log" to={rigPageUrl} />
            <QuickAction label="+ Document" to={rigPageUrl} />
          </div>
          <Link to="/maintenance" style={{ display: 'block', textAlign: 'center', fontSize: 11, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>
            Manage Maintenance &rarr;
          </Link>
        </div>}
      </div>
    </div>
  );
}
