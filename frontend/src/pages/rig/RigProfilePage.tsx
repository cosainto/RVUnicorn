import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Heart, Edit, Truck } from 'lucide-react';
import RigPostComposer from '../../components/rig/RigPostComposer';
import { useAuth } from '../../contexts/AuthContext';
import { useGate } from '../../hooks/useGate';
import GateModal from '../../components/public/GateModal';
import RigTripMode from '../../components/rig/RigTripMode';
import { PhotosTab, VideosTab, CampsitesTab, ModsTab, GearTab, MaintenanceTab } from '../../components/rig/RigHubTabs';
import RigTimelineTab from '../../components/rig/RigTimelineTab';
import RigShowcase from '../../components/rig/RigShowcase';
import RigFollowersTab from '../../components/rig/RigFollowersTab';
import RigMapWithPhotos from '../../components/rig/RigMapWithPhotos';
import api from '../../services/api';

const CN = { bg: '#0F1C35', body: '#1E2D42', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552', success: '#4CAF82' };

function StatPill({ icon, value, label, href }: { icon: string; value: number | string; label: string; href?: string }) {
  const content = (
    <div className="text-center p-3 rounded-xl transition-all duration-200" style={{
      background: 'rgba(232,168,56,0.12)', border: '1px solid rgba(232,168,56,0.3)', cursor: href ? 'pointer' : 'default',
    }}>
      <span className="text-sm block mb-0.5">{icon}</span>
      <span className="text-2xl font-bold block" style={{ fontFamily: "'Playfair Display', serif", color: CN.gold }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider block" style={{ color: CN.muted }}>{label}</span>
    </div>
  );
  return href ? <Link to={href}>{content}</Link> : content;
}

export default function RigProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { requireAuth, gateModalProps } = useGate();
  const [rig, setRig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('pulse');
  const [mods, setMods] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [heroComposerOpen, setHeroComposerOpen] = useState(false);
  const [heroComposerFormat, setHeroComposerFormat] = useState<string | null>(null);
  const [showScanOverlay, setShowScanOverlay] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get(`/rigs/${slug}`)
      .then(r => {
        setRig(r.data);
        setFollowing(!!r.data?.isFollowing);
        // Track profile visit (fires once per page load, skips own profile)
        if (r.data?.ownerId && r.data.ownerId !== user?.id) {
          api.post(`/analytics/profile-visit/${r.data.ownerId}`, { source: 'RIG_PAGE' }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, user?.id]);

  // Scanner overlay when ?scan=true
  useEffect(() => {
    if (searchParams.get('scan') !== 'true' || !rig) return;
    setShowScanOverlay(true);
    // Record the scan
    const recordScan = async () => {
      try {
        const payload: any = {};
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              api.post(`/rigs/${slug}/qr-code/scan`, {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }).catch(() => {});
            },
            () => {
              api.post(`/rigs/${slug}/qr-code/scan`, {}).catch(() => {});
            }
          );
        } else {
          await api.post(`/rigs/${slug}/qr-code/scan`, payload);
        }
      } catch {}
    };
    recordScan();
    // Auto-fade after 5 seconds
    const timer = setTimeout(() => setShowScanOverlay(false), 5000);
    return () => clearTimeout(timer);
  }, [rig, searchParams, slug]);

  // Load tab data on tab change
  useEffect(() => {
    if (!rig?.id) return;
    if (activeTab === 'trips' && trips.length === 0) {
      api.get(`/rigs/${rig.id}/trips`).then(r => setTrips(r.data || [])).catch(() => {});
    }
    if (activeTab === 'build' && mods.length === 0) {
      api.get(`/rigs/${rig.id}/mods`).then(r => setMods(r.data || [])).catch(() => {});
    }
  }, [activeTab, rig?.id]);

  const handleFollow = () => {
    requireAuth('follow_user', { targetName: rig?.rigName || 'this rig' }, async () => {
      try {
        const { data } = await api.post(`/rigs/${rig.id}/follow`);
        setFollowing(data.following);
        setRig((r: any) => ({ ...r, followerCount: data.followerCount }));
      } catch {}
    });
  };

  const isOwner = rig?.ownerId === user?.id;
  const isPilot = rig?.pilots?.some((p: any) => p.userId === user?.id);

  if (loading) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <div className="h-72 animate-pulse" style={{ background: CN.card }} />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="h-8 w-64 rounded animate-pulse mb-4" style={{ background: CN.card }} />
          <div className="h-4 w-96 rounded animate-pulse" style={{ background: CN.card }} />
        </div>
      </div>
    );
  }

  if (!rig) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh', color: CN.cream }} className="flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-bold mb-2">Rig not found</p>
          <Link to="/" className="text-sm" style={{ color: CN.gold }}>Back to RVUnicorn</Link>
        </div>
      </div>
    );
  }

  const owner = rig.owner || {};
  const rigTitle = rig.rigName || `${rig.year || ''} ${rig.make || ''} ${rig.model || ''}`.trim() || 'My Rig';
  const rigSubtitle = [rig.year, rig.make, rig.model].filter(Boolean).join(' ');
  const rigMeta = [rig.rigClass?.replace('_', ' '), rig.lengthFeet ? `${rig.lengthFeet}ft` : null, rig.fuelType].filter(Boolean).join(' · ');

  const TABS = [
    { id: 'pulse', label: 'Pulse' },
    { id: 'trips', label: 'Trips' },
    { id: 'media', label: 'Media' },
    { id: 'build', label: 'Build' },
    { id: 'map', label: 'Map' },
  ];

  return (
    <>
      {/* ═══ SCANNER WELCOME OVERLAY ═══ */}
      {showScanOverlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15,28,53,0.92)',
            backdropFilter: 'blur(20px)',
            cursor: 'pointer',
          }}
          onClick={() => setShowScanOverlay(false)}
        >
          {rig.heroPhoto && (
            <img
              src={rig.heroPhoto}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(30px) brightness(0.3)',
                zIndex: 0,
              }}
            />
          )}
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '2rem' }}>
            <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: CN.gold, fontFamily: "'Playfair Display', serif", marginBottom: '0.5rem' }}>
              You discovered {rigTitle}!
            </p>
            <p style={{ fontSize: '1rem', color: CN.cream, marginBottom: '2rem', opacity: 0.8 }}>
              {rigSubtitle}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFollow();
                  setShowScanOverlay(false);
                }}
                style={{
                  padding: '0.75rem 2rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  background: CN.gold,
                  color: CN.bg,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {following ? 'Following' : 'Follow This Rig'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowScanOverlay(false);
                  setActiveTab('timeline');
                }}
                style={{
                  padding: '0.75rem 2rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  background: 'transparent',
                  color: CN.gold,
                  border: `2px solid ${CN.gold}`,
                  cursor: 'pointer',
                }}
              >
                View Their Journey
              </button>
            </div>
          </div>
        </div>
      )}

      <Helmet>
        <title>{rigTitle} · {rigSubtitle} · RVUnicorn</title>
        <meta name="description" content={`${rigTitle} is a ${rigSubtitle} that has traveled ${rig.totalStatesCount || 0} states and ${rig.totalMilesDriven || 0} miles. Follow ${owner.firstName}'s RV adventures on RVUnicorn.`} />
        <meta property="og:title" content={`${rigTitle} on RVUnicorn`} />
        <meta property="og:description" content={`${rigSubtitle} · ${rig.totalTripCount || 0} trips · ${rig.totalStatesCount || 0} states · ${rig.totalNightsCamped || 0} nights`} />
        {rig.heroPhoto && <meta property="og:image" content={rig.heroPhoto} />}
        <meta property="og:url" content={`https://www.rvunicorn.com/rig/${slug}`} />
        <link rel="canonical" href={`https://www.rvunicorn.com/rig/${slug}`} />
      </Helmet>

      <div style={{ background: CN.bg, minHeight: '100vh', color: CN.cream }}>
        {/* ═══ ZONE 1: HERO ═══ */}
        <div className="relative" style={{ background: CN.bg }}>
          {/* Hero photo */}
          <div className="h-64 sm:h-80 relative">
            {rig.heroPhoto ? (
              <img src={rig.heroPhoto} alt={rigTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${CN.card}, ${CN.body})` }}>
                <Truck className="w-20 h-20" style={{ color: CN.border }} />
              </div>
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0F1C35, transparent 50%)' }} />

            {/* Action buttons (top right) */}
            <div className="absolute top-4 right-4 flex gap-2">
              {(isOwner || isPilot) && (
                <Link to={`/rig/${slug}/edit`} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1" style={{ background: 'rgba(0,0,0,0.5)', color: CN.cream, backdropFilter: 'blur(8px)' }}>
                  <Edit className="w-3 h-3" /> Edit
                </Link>
              )}
              <button onClick={handleFollow} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition" style={{
                background: following ? CN.gold : 'rgba(0,0,0,0.5)', color: following ? CN.bg : CN.cream, backdropFilter: 'blur(8px)',
              }}>
                <Heart className={`w-3 h-3 ${following ? 'fill-current' : ''}`} />
                {following ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>

          {/* Rig identity (overlaid on gradient) */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-20 relative z-10">
            <h1 className="text-3xl sm:text-4xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>{rigTitle}</h1>
            {rig.tagline && <p className="text-sm mb-1" style={{ color: CN.gold }}>{rig.tagline}</p>}
            <p className="text-sm mb-1" style={{ color: CN.muted }}>{rigSubtitle}</p>
            {rigMeta && <p className="text-xs mb-3" style={{ color: CN.muted }}>{rigMeta}</p>}

            {/* Pilot chips */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: CN.muted }}>Piloted by</span>
              <Link to={`/profile/${owner.username || owner.id}`} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition hover:brightness-110" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                {owner.profilePicture ? <img src={owner.profilePicture} alt="" className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full" style={{ background: CN.gold }} />}
                <span style={{ color: CN.cream }}>{owner.firstName}</span>
              </Link>
              {rig.pilots?.filter((p: any) => p.userId !== rig.ownerId).map((p: any) => (
                <Link key={p.userId} to={`/profile/${p.user?.username || p.userId}`} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition hover:brightness-110" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  {p.user?.profilePicture ? <img src={p.user.profilePicture} alt="" className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full" style={{ background: CN.gold }} />}
                  <span style={{ color: CN.cream }}>{p.user?.firstName}</span>
                </Link>
              ))}
            </div>

            {/* Follower count + Follow button + Community Score badge */}
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => setActiveTab('followers')}
                className="flex items-center gap-1.5 transition hover:brightness-125 cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                <span className="text-sm font-bold" style={{ color: CN.cream }}>{rig.followerCount || 0}</span>
                <span className="text-xs" style={{ color: CN.muted }}>Follower{(rig.followerCount || 0) !== 1 ? 's' : ''}</span>
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold" style={{ color: CN.cream }}>{(rig.pilots?.length || 0) + 1}</span>
                <span className="text-xs" style={{ color: CN.muted }}>Contributor{(rig.pilots?.length || 0) !== 0 ? 's' : ''}</span>
              </div>
              {!isOwner && !isPilot && (
                <button onClick={handleFollow} className="px-4 py-1.5 rounded-full text-xs font-bold transition hover:brightness-110" style={{
                  background: following ? 'transparent' : CN.gold,
                  color: following ? CN.gold : CN.bg,
                  border: `1.5px solid ${CN.gold}`,
                }}>
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
              {rig.contributionScore > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-default"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#FFF' }}
                  title={rig.scoreBreakdown ? `Top components: ${Object.entries(rig.scoreBreakdown as Record<string, number>).sort(([,a],[,b]) => b - a).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')}` : undefined}
                >
                  Community Score: {Math.round(rig.contributionScore)}
                </span>
              )}
            </div>

            {/* Live Now banner */}
            {rig.isLiveNow && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3" style={{ background: 'rgba(76,175,130,0.15)', border: '1px solid rgba(76,175,130,0.3)' }}>
                <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>
                <span className="text-sm font-semibold text-green-400">LIVE</span>
                <span className="text-xs text-green-300/70">
                  {rig.currentCampgroundId ? 'Currently at a campground' : rig.onTheRoadEta ? `On the road · ETA ${new Date(rig.onTheRoadEta).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'On the road'}
                </span>
                {rig.lastLocationUpdate && <span className="text-[10px] text-green-300/40 ml-auto">Updated {Math.round((Date.now() - new Date(rig.lastLocationUpdate).getTime()) / 60000)} min ago</span>}
              </div>
            )}

            {/* Vibe tags */}
            {rig.vibeTags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {rig.vibeTags.map((tag: string) => (
                  <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,168,56,0.12)', color: CN.gold, border: '1px solid rgba(232,168,56,0.25)' }}>
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Rig emoji */}
            {rig.rigEmoji && <span className="text-2xl mb-2 block">{rig.rigEmoji}</span>}

            {/* Stat bar */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              <StatPill icon="🌙" value={rig.totalNightsCamped || 0} label="Nights" href={`/rig/${slug}/trips`} />
              <StatPill icon="🗺️" value={rig.totalTripCount || 0} label="Trips" href={`/rig/${slug}/trips`} />
              <StatPill icon="🏕️" value={rig.totalStatesCount || 0} label="States" />
              <StatPill icon="🛣️" value={rig.totalMilesDriven ? `${Math.round(rig.totalMilesDriven).toLocaleString()}` : '0'} label="Miles" href={`/rig/${slug}/stats`} />
            </div>
          </div>
        </div>

        {/* ═══ SHARE YOUR EXPERIENCE — format card grid (owner/pilot only) ═══ */}
        {(isOwner || isPilot) && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5" style={{ background: CN.body }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: CN.gold }}>Share Your Experience</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                { id: 'photo', icon: '📸', label: 'Photos', hint: 'From the road' },
                { id: 'recipe', icon: '🍳', label: 'Cooking', hint: "What's on the stove?" },
                { id: 'campfire_story', icon: '🔥', label: 'Campfire', hint: 'A short moment' },
                { id: 'night_sky', icon: '🌌', label: 'Night Sky', hint: 'Stargazing tonight?' },
                { id: 'video', icon: '🎥', label: 'Vlog', hint: 'A video clip' },
                { id: 'blog', icon: '✍️', label: 'Blog', hint: 'Write a story' },
                { id: 'game_night', icon: '🎲', label: 'Game Night', hint: 'What did you play?' },
                { id: 'mod', icon: '🛠', label: 'Mod', hint: 'Before & after' },
                { id: 'milestone', icon: '🏆', label: 'Milestone', hint: 'An achievement' },
              ].map(c => (
                <button key={c.id} onClick={() => { setHeroComposerFormat(c.id); setHeroComposerOpen(true); }}
                  className="flex flex-col items-start p-3 rounded-xl text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: CN.card, border: `1px solid ${CN.border}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${CN.gold}60`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = CN.border; }}>
                  <span className="text-lg mb-1">{c.icon}</span>
                  <span className="text-[11px] font-bold" style={{ color: CN.cream }}>{c.label}</span>
                  <span className="text-[9px] leading-snug" style={{ color: CN.muted }}>{c.hint}</span>
                </button>
              ))}
            </div>
            <RigPostComposer
              rigId={rig.id}
              slug={slug!}
              isOpen={heroComposerOpen}
              initialFormat={heroComposerFormat}
              onClose={() => { setHeroComposerOpen(false); setHeroComposerFormat(null); }}
              onPublished={() => { setHeroComposerOpen(false); setHeroComposerFormat(null); }}
            />
          </div>
        )}

        {/* ═══ RIG SHOWCASE ═══ */}
        <RigShowcase slug={slug!} rigName={rigTitle} rigSubtitle={rigSubtitle} isOwner={isOwner} galleryPhotoUrls={rig.galleryPhotoUrls} />

        {/* ═══ OUR STORY SECTION ═══ */}
        {(rig.story || isOwner) && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4" style={{ background: CN.body }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: CN.gold }}>Our Story</h3>
            {rig.story ? (
              <p className="text-sm leading-relaxed line-clamp-3" style={{ color: CN.cream }}>{rig.story}</p>
            ) : isOwner ? (
              <p className="text-xs italic" style={{ color: CN.muted }}>Every rig has a story. Share yours — where did you get it, what does it mean to your family, where has it taken you?</p>
            ) : null}
            {rig.purchaseDate && <p className="text-[10px] mt-1" style={{ color: CN.muted }}>Traveling since {new Date(rig.purchaseDate).getFullYear()}</p>}
          </div>
        )}

        {/* ═══ THE CREW ═══ */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6" style={{ background: CN.body }}>
          <h3 className="text-lg font-bold mb-4" style={{ color: CN.cream }}>🚐 The Crew</h3>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
            {/* Owner card */}
            <Link to={`/profile/${owner.username || owner.id}`} className="flex flex-col items-center gap-2 p-4 rounded-2xl min-w-[120px] transition hover:brightness-110" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              {owner.profilePicture ? (
                <img src={owner.profilePicture} alt={owner.firstName} className="w-16 h-16 rounded-full object-cover border-3" style={{ borderColor: CN.gold }} />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: CN.gold }}>{owner.firstName?.[0]}</div>
              )}
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: CN.cream }}>{owner.firstName} {owner.lastName?.[0] ? owner.lastName[0] + '.' : ''}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8A838)', color: '#0F1C35' }}>Owner</span>
              </div>
            </Link>

            {/* Co-pilots */}
            {rig.pilots?.filter((p: any) => p.userId !== rig.ownerId).map((p: any) => (
              <Link key={p.id} to={`/profile/${p.user?.username || p.userId}`} className="flex flex-col items-center gap-2 p-4 rounded-2xl min-w-[120px] transition hover:brightness-110" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                {p.user?.profilePicture ? (
                  <img src={p.user.profilePicture} alt={p.user.firstName} className="w-16 h-16 rounded-full object-cover border-3" style={{ borderColor: '#4CAF82' }} />
                ) : (
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: 'rgba(76,175,130,0.2)', color: '#4CAF82' }}>{p.user?.firstName?.[0] || '?'}</div>
                )}
                <div className="text-center">
                  <p className="text-sm font-bold" style={{ color: CN.cream }}>{p.user?.firstName} {p.user?.lastName?.[0] ? p.user.lastName[0] + '.' : ''}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(76,175,130,0.2)', color: '#4CAF82' }}>{p.role === 'COPILOT' ? 'Co-Pilot' : p.role === 'CREW' ? 'Crew' : p.role || 'Co-Pilot'}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ═══ ZONE 2: BODY ═══ */}
        <div style={{ background: CN.body }}>
          {/* Tab bar */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex gap-1 overflow-x-auto pb-px" style={{ borderBottom: `1px solid ${CN.border}` }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="px-4 py-3 text-sm font-semibold whitespace-nowrap transition"
                  style={{
                    color: activeTab === t.id ? CN.gold : CN.muted,
                    borderBottom: activeTab === t.id ? `2px solid ${CN.gold}` : '2px solid transparent',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

            {/* ═══ PULSE TAB (default — the canonical feed) ═══ */}
            {activeTab === 'pulse' && (
              <RigTimelineTab slug={slug!} isOwner={isOwner || isPilot} rigName={rigTitle} ownerAvatar={owner.profilePicture} ownerName={owner.firstName} rigId={rig.id} />
            )}

            {/* ═══ TRIPS TAB ═══ */}
            {activeTab === 'trips' && rig && (
              <RigTripMode slug={slug!} isOwner={isOwner} rigName={rigTitle} />
            )}

            {/* ═══ MEDIA TAB (photos + videos as filtered views) ═══ */}
            {activeTab === 'media' && (
              <>
                <PhotosTab slug={slug!} isOwner={isOwner} />
                <VideosTab slug={slug!} isOwner={isOwner} />
              </>
            )}

            {/* ═══ BUILD TAB (mods + gear + maintenance) ═══ */}
            {activeTab === 'build' && (
              <>
                <ModsTab slug={slug!} isOwner={isOwner} />
                <GearTab slug={slug!} isOwner={isOwner} />
                <MaintenanceTab slug={slug!} isOwner={isOwner} />
              </>
            )}

            {/* ═══ MAP TAB ═══ */}
            {activeTab === 'map' && (
              <>
                <RigMapWithPhotos slug={slug!} />
                <CampsitesTab slug={slug!} isOwner={isOwner} />
              </>
            )}

            {/* ═══ FOLLOWERS (accessed via header count click, not a visible tab) ═══ */}
            {activeTab === 'followers' && rig && (
              <>
                <button onClick={() => setActiveTab('pulse')} className="text-xs mb-4 flex items-center gap-1" style={{ color: CN.gold }}>
                  &larr; Back to Pulse
                </button>
                <RigFollowersTab rigId={rig.id} rigName={rigTitle} />
              </>
            )}

          </div>
        </div>
      </div>

      <GateModal {...gateModalProps} />
    </>
  );
}
