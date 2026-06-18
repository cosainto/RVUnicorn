import { Link } from 'react-router-dom';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

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
  coPilots: { userId: string; username: string; avatarUrl: string | null }[];
  pinnedMemories?: { id: string; title: string; photoUrl: string | null; date: string | null }[];
}

const HITCH_AVATAR = 'https://res.cloudinary.com/dy6eetmh7/image/upload/w_48,h_48,c_fill/v1775261116/rvunicorn/characters/hitch.png';

function SkeletonCard() {
  return (
    <div style={{ background: CN.card, borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: 120, height: 14, borderRadius: 4, background: CN.border, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 180, height: 10, borderRadius: 4, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 120, height: 36, borderRadius: 8, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 120, height: 36, borderRadius: 8, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
    </div>
  );
}

function AvatarStack({ avatars, size = 24 }: { avatars: { avatarUrl: string | null; username?: string }[]; size?: number }) {
  return (
    <div style={{ display: 'flex' }}>
      {avatars.slice(0, 4).map((a, i) => (
        <div key={i} style={{ width: size, height: size, borderRadius: '50%', background: CN.cardAlt, border: `2px solid ${CN.card}`, marginLeft: i > 0 ? -8 : 0, overflow: 'hidden', zIndex: avatars.length - i, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, color: CN.muted }}>
          {a.avatarUrl ? <img src={a.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (a.username?.[0]?.toUpperCase() || '?')}
        </div>
      ))}
    </div>
  );
}

function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 0', minWidth: 50 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{value}</div>
      <div style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function HitchNudge({ data }: { data: RigPulseData }) {
  let line: string;
  if (data.hasActiveTrip && data.trip?.destination && data.trip.daysAway != null) {
    line = `Counting down to ${data.trip.destination} \u2014 ${data.trip.daysAway} days! \u{1F525}`;
  } else if (data.lastCheckIn?.daysAgo != null && data.lastCheckIn.daysAgo > 30) {
    line = `It's been a while since your last adventure...`;
  } else {
    line = `When did you last hit the road? Let's plan something \u{1F5FA}`;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${CN.border}` }}>
      <img src={HITCH_AVATAR} alt="Hitch" style={{ width: 24, height: 24, borderRadius: '50%' }} />
      <span style={{ fontSize: 12, color: CN.muted, fontStyle: 'italic' }}>{line}</span>
    </div>
  );
}

function ActiveTripState({ data }: { data: RigPulseData }) {
  const trip = data.trip!;
  return (
    <div style={{ background: CN.card, borderRadius: 16, padding: 16, borderLeft: `3px solid ${CN.orange}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {data.rigPhoto && <img src={data.rigPhoto} alt={data.rigName} style={{ width: 60, height: 60, borderRadius: 12, objectFit: 'cover' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: CN.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.rigEmoji} {data.rigName}</div>
          <div style={{ fontSize: 12, color: CN.muted }}>{trip.name}</div>
          {(data.followerCount ?? 0) > 0 && <div style={{ fontSize: 10, color: CN.gold, marginTop: 2 }}>{data.followerCount} followers</div>}
        </div>
        {data.coPilots?.length > 0 && <AvatarStack avatars={data.coPilots} size={28} />}
      </div>

      {/* Countdown */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: CN.gold, letterSpacing: -1 }}>{trip.daysAway ?? '?'}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: CN.gold, marginLeft: 6 }}>DAYS</span>
        {trip.destination && <div style={{ fontSize: 13, color: CN.cream, marginTop: 2 }}>until {trip.destination}</div>}
      </div>

      {/* Trip stats */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, background: CN.cardAlt, borderRadius: 8, padding: '6px 8px' }}>
        <StatPill value={trip.totalMiles.toLocaleString()} label="Miles" />
        <div style={{ width: 1, background: CN.border, margin: '4px 6px' }} />
        <StatPill value={trip.totalNights} label="Nights" />
        <div style={{ width: 1, background: CN.border, margin: '4px 6px' }} />
        <StatPill value={trip.statesVisited} label="States" />
      </div>

      {/* New followers */}
      {data.newFollowers?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: CN.gold }}>
          <AvatarStack avatars={data.newFollowers} size={18} />
          <span>+{data.newFollowers.length} new follower{data.newFollowers.length > 1 ? 's' : ''} this week</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link to={data.rigSlug ? `/trips/${data.rigSlug}` : '#'} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, background: CN.gold, color: CN.bg, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>View Trip &rarr;</Link>
        <button style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'transparent', border: `1px solid ${CN.gold}`, color: CN.gold, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Invite Co-Pilot</button>
      </div>

      {/* Memory Wall peek */}
      {data.pinnedMemories && data.pinnedMemories.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${CN.border}` }}>
          <div style={{ fontSize: 10, color: CN.muted, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Memory Wall</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {data.pinnedMemories.map(m => (
              <Link key={m.id} to={data.rigSlug ? `/rig/${data.rigSlug}` : '#'} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                  {m.photoUrl ? <img src={m.photoUrl} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{'\u{1F4F8}'}</div>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <HitchNudge data={data} />
    </div>
  );
}

function ContextItem({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: CN.muted, display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}><span>{icon}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span></div>;
}

function IdleState({ data }: { data: RigPulseData }) {
  const items: React.ReactNode[] = [];
  if (data.lastPhoto?.url) {
    const daysAgo = data.lastPhoto.date ? Math.floor((Date.now() - new Date(data.lastPhoto.date).getTime()) / 86400000) : null;
    items.push(
      <div key="photo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ContextItem icon={'\u{1F4F8}'}>Last photo: {data.lastPhoto.tripName || 'Trip'}{daysAgo != null ? ` \u00b7 ${daysAgo}d ago` : ''}</ContextItem>
        <img src={data.lastPhoto.url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
      </div>
    );
  }
  if (data.lastSavedCampground) items.push(<ContextItem key="saved" icon={'\u2764\ufe0f'}>Last saved: {data.lastSavedCampground.name}, {data.lastSavedCampground.state}</ContextItem>);
  if (data.newFollowers?.length > 0) {
    const first = data.newFollowers[0];
    const rest = data.newFollowers.length - 1;
    items.push(
      <div key="followers" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: CN.gold, padding: '3px 0' }}>
        <AvatarStack avatars={data.newFollowers} size={20} />
        <span>+{data.newFollowers.length} new follower{data.newFollowers.length > 1 ? 's' : ''} this week</span>
      </div>
    );
  }

  // All-time stats row
  const hasStats = data.totalMilesAllTime > 0 || (data.totalStatesVisited ?? 0) > 0 || (data.totalCampgroundsAllTime ?? 0) > 0;

  return (
    <div style={{ background: CN.card, borderRadius: 16, padding: 16, borderLeft: '3px solid rgba(232,168,56,0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {data.rigPhoto && <img src={data.rigPhoto} alt={data.rigName} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: CN.cream }}>{data.rigEmoji} {data.rigName}</div>
          <div style={{ fontSize: 12, color: CN.muted }}>Ready for your next adventure?</div>
          {(data.followerCount ?? 0) > 0 && <div style={{ fontSize: 10, color: CN.gold, marginTop: 1 }}>{data.followerCount} followers</div>}
        </div>
      </div>

      {/* All-time stats bar */}
      {hasStats && (
        <div style={{ display: 'flex', gap: 2, marginBottom: 10, background: CN.cardAlt, borderRadius: 8, padding: '6px 8px' }}>
          {data.totalMilesAllTime > 0 && <StatPill value={data.totalMilesAllTime.toLocaleString()} label="Miles" />}
          {data.totalMilesAllTime > 0 && (data.totalStatesVisited ?? 0) > 0 && <div style={{ width: 1, background: CN.border, margin: '4px 6px' }} />}
          {(data.totalStatesVisited ?? 0) > 0 && <StatPill value={data.totalStatesVisited!} label="States" />}
          {(data.totalStatesVisited ?? 0) > 0 && (data.totalCampgroundsAllTime ?? 0) > 0 && <div style={{ width: 1, background: CN.border, margin: '4px 6px' }} />}
          {(data.totalCampgroundsAllTime ?? 0) > 0 && <StatPill value={data.totalCampgroundsAllTime!} label="Camps" />}
          {(data.totalNightsAllTime ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 6px' }} /><StatPill value={data.totalNightsAllTime!} label="Nights" /></>}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>{items.slice(0, 3)}</div>

      {/* Memory Wall peek */}
      {data.pinnedMemories && data.pinnedMemories.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: CN.muted, fontWeight: 600, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Memory Wall</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {data.pinnedMemories.map(m => (
              <Link key={m.id} to={data.rigSlug ? `/rig/${data.rigSlug}` : '#'} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                  {m.photoUrl ? <img src={m.photoUrl} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{'\u{1F4F8}'}</div>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link to="/trips/new" style={{ padding: '8px 18px', borderRadius: 8, background: CN.gold, color: CN.bg, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Plan a Trip &rarr;</Link>
        {data.rigSlug && <Link to={`/rig/${data.rigSlug}`} style={{ fontSize: 12, color: CN.gold, textDecoration: 'none' }}>View Rig Page</Link>}
      </div>
      <HitchNudge data={data} />
    </div>
  );
}

export default function RigPulseCardV2({ data }: { data: RigPulseData | null }) {
  if (!data) return <SkeletonCard />;
  return data.hasActiveTrip && data.trip ? <ActiveTripState data={data} /> : <IdleState data={data} />;
}
