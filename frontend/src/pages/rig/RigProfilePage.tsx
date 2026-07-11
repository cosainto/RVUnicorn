import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Heart, Edit, Truck, MapPin } from 'lucide-react';
import RigPostComposer from '../../components/rig/RigPostComposer';
import { useAuth } from '../../contexts/AuthContext';
import { useGate } from '../../hooks/useGate';
import GateModal from '../../components/public/GateModal';
import RigTripMode from '../../components/rig/RigTripMode';
import { PhotosTab, VideosTab, CampsitesTab, ModsTab, GearTab, MaintenanceTab } from '../../components/rig/RigHubTabs';
import RigTimelineTab from '../../components/rig/RigTimelineTab';
import RigShowcase from '../../components/rig/RigShowcase';
import RigFeedbackSection from '../../components/rig/RigFeedbackSection';
import RigFuelProfile from '../../components/rig/RigFuelProfile';
import RigFuelHistory from '../../components/rig/RigFuelHistory';
import RigStatesMap from '../../components/rig/RigStatesMap';
import RigFollowersTab from '../../components/rig/RigFollowersTab';
import RigMapWithPhotos from '../../components/rig/RigMapWithPhotos';
import RigCampgroundsTab from '../../components/rig/RigCampgroundsTab';
import RigReviewsTab from '../../components/rig/RigReviewsTab';
import api from '../../services/api';
import { formatRigClass } from '../../utils/formatRigClass';

const CN = { bg: '#0F1C35', body: '#1E2D42', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552', success: '#4CAF82' };

export default function RigProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { requireAuth, gateModalProps } = useGate();
  const [rig, setRig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [mods, setMods] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [heroComposerOpen, setHeroComposerOpen] = useState(false);
  const [heroComposerFormat, setHeroComposerFormat] = useState<string | null>(null);
  const [milesModalOpen, setMilesModalOpen] = useState(false);
  const [editMiles, setEditMiles] = useState('');
  const [editMpg, setEditMpg] = useState('');
  const [milesSaving, setMilesSaving] = useState(false);
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
          api.post(`/rigs/${slug}/view`).catch(() => {});
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
  // Deduplicate consecutive words (fixes "Coachmen Pursuit Pursuit 31bh" → "Coachmen Pursuit 31bh")
  const rigSubtitle = [rig.year, rig.make, rig.model].filter(Boolean).join(' ').replace(/\b(\w+)\s+\1\b/gi, '$1');
  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'trips', label: 'Trips' },
    { id: 'campgrounds', label: 'Campgrounds' },
    { id: 'photos', label: 'Photos' },
    { id: 'videos', label: 'Videos' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'build', label: 'Mods & Gear' },
    { id: 'about', label: 'About' },
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

        {/* ═══ HERO SECTION ═══ */}
        <div className="relative group">
          {/* Cover photo — full width, tall */}
          <div className="relative" style={{ height: 380 }}>
            {rig.heroPhoto ? (
              <img src={rig.heroPhoto} alt={rigTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, #1A2A45, #0F1C35, #1E2D42)` }}>
                <Truck className="w-24 h-24" style={{ color: CN.border, opacity: 0.3 }} />
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,28,53,0.95) 0%, rgba(15,28,53,0.4) 40%, transparent 70%)' }} />

            {/* Action buttons — top right */}
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              {(isOwner || isPilot) && (
                <Link to={`/rig/${slug}/edit`} className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition hover:brightness-125" style={{ background: 'rgba(0,0,0,0.5)', color: CN.cream, backdropFilter: 'blur(8px)' }}>
                  <Edit className="w-3 h-3" /> Edit Rig
                </Link>
              )}
              {!isOwner && !isPilot && (
                <button onClick={handleFollow} className="px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition hover:brightness-110" style={{
                  background: following ? 'transparent' : `linear-gradient(135deg, ${CN.gold}, ${CN.orange})`,
                  color: following ? CN.gold : CN.bg,
                  border: `1.5px solid ${CN.gold}`,
                  backdropFilter: 'blur(8px)',
                }}>
                  <Heart className={`w-3 h-3 ${following ? 'fill-current' : ''}`} />
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Change cover — owner only, hover */}
            {(isOwner || isPilot) && (
              <Link to={`/rig/${slug}/edit`} className="absolute bottom-20 left-4 z-10 px-3 py-1.5 rounded-full text-[10px] font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" style={{ background: 'rgba(0,0,0,0.6)', color: CN.cream, backdropFilter: 'blur(4px)' }}>
                📷 Change Cover
              </Link>
            )}

            {/* Rig identity — overlaid on gradient */}
            <div className="absolute bottom-0 left-0 right-0 z-10">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-5">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-3xl sm:text-4xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                      {rigTitle}
                    </h1>
                    {rig.tagline && <p className="text-sm mb-1" style={{ color: CN.gold }}>{rig.tagline}</p>}
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{rigSubtitle}</p>
                    {rig.owner?.location && (
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        <MapPin className="w-3 h-3" /> {rig.owner.location}
                      </p>
                    )}
                  </div>
                  {rig.rigClass && (
                    <span className="flex-shrink-0 text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(232,168,56,0.2)', color: CN.gold, border: '1px solid rgba(232,168,56,0.35)', backdropFilter: 'blur(4px)' }}>
                      {formatRigClass(rig.rigClass)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats strip — dark bar below hero */}
          <div style={{ background: CN.card, borderBottom: `1px solid ${CN.border}` }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-1 overflow-x-auto py-3" style={{ scrollbarWidth: 'none' }}>
                {[
                  { icon: '🛣', value: rig.totalMilesDriven ? `${rig.milesEstimated !== false ? '~' : ''}${Math.round(rig.totalMilesDriven).toLocaleString()}` : '0', label: 'mi', tab: null, click: (isOwner || isPilot) ? () => { setEditMiles(String(Math.round(rig.totalMilesDriven || 0))); setEditMpg(String(rig.avgMPG || '')); setMilesModalOpen(true); } : undefined },
                  { icon: '🗺', value: rig.totalStatesCount || 0, label: 'states', tab: 'map' },
                  { icon: '🏕', value: rig.totalCampgroundsAllTime || rig._count?.campsites || 0, label: 'camps', tab: 'map' },
                  { icon: '🌙', value: rig.totalNightsCamped || 0, label: 'nights', tab: 'trips' },
                  { icon: '✈️', value: rig.totalTripCount || 0, label: 'trips', tab: 'trips' },
                ].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => s.click ? s.click() : s.tab ? setActiveTab(s.tab) : null}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs whitespace-nowrap transition hover:brightness-125"
                    style={{ background: CN.cardAlt, border: `1px solid ${CN.border}`, cursor: (s.click || s.tab) ? 'pointer' : 'default' }}
                  >
                    <span>{s.icon}</span>
                    <span className="font-bold" style={{ color: CN.cream }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</span>
                    <span style={{ color: CN.muted }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Social row — followers + crew + follow/edit */}
          <div style={{ background: CN.bg }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Follower info */}
                <button onClick={() => setActiveTab('followers')} className="flex items-center gap-2 transition hover:brightness-125" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  {/* Stacked avatars placeholder */}
                  <span className="text-sm font-bold" style={{ color: CN.cream }}>{rig.followerCount || 0}</span>
                  <span className="text-xs" style={{ color: CN.muted }}>follower{(rig.followerCount || 0) !== 1 ? 's' : ''}</span>
                </button>

                <div className="w-px h-4" style={{ background: CN.border }} />

                {/* Crew avatars */}
                <div className="flex items-center gap-1">
                  <Link to={`/profile/${owner.username || owner.id}`} className="flex-shrink-0">
                    {owner.profilePicture ? (
                      <img src={owner.profilePicture} alt="" className="w-7 h-7 rounded-full object-cover border-2" style={{ borderColor: CN.gold }} />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: CN.gold }}>{owner.firstName?.[0]}</div>
                    )}
                  </Link>
                  {rig.pilots?.filter((p: any) => p.userId !== rig.ownerId).slice(0, 3).map((p: any) => (
                    <Link key={p.id} to={`/profile/${p.user?.username || p.userId}`} className="flex-shrink-0 -ml-1">
                      {p.user?.profilePicture ? (
                        <img src={p.user.profilePicture} alt="" className="w-7 h-7 rounded-full object-cover border-2" style={{ borderColor: CN.success }} />
                      ) : (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold -ml-1" style={{ background: 'rgba(76,175,130,0.2)', color: CN.success }}>{p.user?.firstName?.[0]}</div>
                      )}
                    </Link>
                  ))}
                  <span className="text-xs ml-1" style={{ color: CN.muted }}>
                    {owner.firstName}{rig.pilots?.length > 0 ? ` +${rig.pilots.length}` : ''}
                  </span>
                </div>

                <div className="flex-1" />

                {/* Right side actions */}
                {(isOwner || isPilot) && (
                  <div className="flex gap-2">
                    <Link to={`/rig/${slug}/edit`} className="px-3 py-1 rounded-full text-[10px] font-semibold" style={{ color: CN.gold, border: `1px solid ${CN.gold}33` }}>
                      Edit Rig
                    </Link>
                  </div>
                )}
                {!isOwner && !isPilot && (
                  <button onClick={handleFollow} className="px-4 py-1.5 rounded-full text-xs font-bold transition hover:brightness-110 flex items-center gap-1.5" style={{
                    background: following ? 'transparent' : `linear-gradient(135deg, ${CN.gold}, ${CN.orange})`,
                    color: following ? CN.gold : CN.bg,
                    border: `1.5px solid ${CN.gold}`,
                  }}>
                    <Heart className={`w-3 h-3 ${following ? 'fill-current' : ''}`} />
                    {following ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>

              {/* Live Now banner */}
              {rig.isLiveNow && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-3" style={{ background: 'rgba(76,175,130,0.15)', border: '1px solid rgba(76,175,130,0.3)' }}>
                  <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>
                  <span className="text-sm font-semibold text-green-400">LIVE</span>
                  <span className="text-xs text-green-300/70">
                    {rig.currentCampgroundId ? 'Currently at a campground' : rig.onTheRoadEta ? `On the road · ETA ${new Date(rig.onTheRoadEta).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'On the road'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ STICKY TAB BAR ═══ */}
        <div style={{ position: 'sticky', top: 0, zIndex: 40, background: CN.bg, borderBottom: `1px solid ${CN.border}` }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
        </div>

        {/* ═══ TAB CONTENT ═══ */}
        <div style={{ background: CN.body }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
              <>
                {/* Share Your Experience — owner only */}
                {(isOwner || isPilot) && (
                  <div className="rounded-2xl p-4" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: CN.gold }}>Share Your Experience</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {[
                        { id: 'photo', icon: '📸', label: 'Photos' },
                        { id: 'recipe', icon: '🍳', label: 'Cooking' },
                        { id: 'video', icon: '🎥', label: 'Video' },
                        { id: 'blog', icon: '✍️', label: 'Blog' },
                        { id: 'milestone', icon: '🏆', label: 'Milestones' },
                        { id: 'followers', icon: '👥', label: 'Followers', action: 'followers' },
                      ].map(c => (
                        <button key={c.id} onClick={() => {
                          if ((c as any).action === 'followers') setActiveTab('followers');
                          else { setHeroComposerFormat(c.id); setHeroComposerOpen(true); }
                        }}
                          className="flex flex-col items-center py-4 px-2 rounded-xl text-center transition-all duration-150 hover:scale-[1.03]"
                          style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                          <span className="text-xl mb-1">{c.icon}</span>
                          <span className="text-[10px] font-bold" style={{ color: CN.cream }}>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post Composer Modal */}
                <RigPostComposer
                  rigId={rig.id} slug={slug!} isOpen={heroComposerOpen} initialFormat={heroComposerFormat}
                  onClose={() => { setHeroComposerOpen(false); setHeroComposerFormat(null); }}
                  onPublished={() => { setHeroComposerOpen(false); setHeroComposerFormat(null); }}
                />

                {/* Our Story */}
                {(rig.story || isOwner) && (
                  <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: CN.gold }}>Our Story</h3>
                    {rig.story ? (
                      <p className="text-sm leading-relaxed" style={{ color: CN.cream }}>{rig.story}</p>
                    ) : isOwner ? (
                      <p className="text-xs italic" style={{ color: CN.muted }}>Every rig has a story. Share yours — where did you get it, what does it mean to your family?</p>
                    ) : null}
                    {rig.purchaseDate && <p className="text-[10px] mt-2" style={{ color: CN.muted }}>On the road since {new Date(rig.purchaseDate).getFullYear()}</p>}
                  </div>
                )}

                {/* Travel Map */}
                {rig.totalStatesVisited?.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <div className="p-4 pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: CN.gold }}>Travel Map</h3>
                        <button onClick={() => setActiveTab('map')} className="text-[10px] font-semibold" style={{ color: CN.gold }}>View Full Map →</button>
                      </div>
                    </div>
                    <RigStatesMap visitedStates={rig.totalStatesVisited} />
                  </div>
                )}

                {/* Rig Showcase (recent photos) */}
                <RigShowcase slug={slug!} rigName={rigTitle} rigSubtitle={rigSubtitle} isOwner={isOwner} galleryPhotoUrls={rig.galleryPhotoUrls} />

                {/* Vibe Tags */}
                {rig.vibeTags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {rig.vibeTags.map((tag: string) => (
                      <span key={tag} className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(232,168,56,0.12)', color: CN.gold, border: '1px solid rgba(232,168,56,0.25)' }}>
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Timeline feed */}
                <RigTimelineTab slug={slug!} isOwner={isOwner || isPilot} rigName={rigTitle} ownerAvatar={owner.profilePicture} ownerName={owner.firstName} rigId={rig.id} />
                <RigFeedbackSection pageType="RIG" pageId={rig.id} />
              </>
            )}

            {/* ═══ TRIPS TAB ═══ */}
            {activeTab === 'trips' && rig && (
              <RigTripMode slug={slug!} isOwner={isOwner} rigName={rigTitle} />
            )}

            {/* ═══ CAMPGROUNDS TAB ═══ */}
            {activeTab === 'campgrounds' && (
              <RigCampgroundsTab slug={slug!} isOwner={isOwner} />
            )}

            {/* ═══ PHOTOS TAB ═══ */}
            {activeTab === 'photos' && (
              <PhotosTab slug={slug!} isOwner={isOwner} />
            )}

            {/* ═══ VIDEOS TAB ═══ */}
            {activeTab === 'videos' && (
              <VideosTab slug={slug!} isOwner={isOwner} />
            )}

            {/* ═══ REVIEWS TAB ═══ */}
            {activeTab === 'reviews' && (
              <RigReviewsTab slug={slug!} isOwner={isOwner} />
            )}

            {/* ═══ MAP TAB ═══ */}
            {activeTab === 'map' && (
              <>
                {rig.totalStatesVisited?.length > 0 && <RigStatesMap visitedStates={rig.totalStatesVisited} />}
                <RigMapWithPhotos slug={slug!} />
                <CampsitesTab slug={slug!} isOwner={isOwner} />
              </>
            )}

            {/* ═══ MODS & GEAR TAB ═══ */}
            {activeTab === 'build' && (
              <>
                <ModsTab slug={slug!} isOwner={isOwner} />
                <GearTab slug={slug!} isOwner={isOwner} />
                <MaintenanceTab slug={slug!} isOwner={isOwner} />
                <div className="mt-6 space-y-4">
                  <RigFuelProfile slug={slug!} isOwner={isOwner || isPilot} />
                  <RigFuelHistory slug={slug!} />
                </div>
              </>
            )}

            {/* ═══ ABOUT TAB (specs + details) ═══ */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                {/* Rig Overview */}
                <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.gold }}>Rig Overview</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Year', value: rig.year },
                      { label: 'Make', value: rig.make },
                      { label: 'Model', value: rig.model },
                      { label: 'Class', value: formatRigClass(rig.rigClass) },
                      { label: 'Length', value: rig.lengthFeet ? `${rig.lengthFeet} ft` : null },
                      { label: 'Weight', value: rig.grossWeight ? `${rig.grossWeight.toLocaleString()} lbs` : null },
                      { label: 'Slideouts', value: rig.slideoutCount },
                      { label: 'Towing Capacity', value: rig.towingCapacity ? `${rig.towingCapacity.toLocaleString()} lbs` : null },
                    ].filter(s => s.value).map(s => (
                      <div key={s.label}>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CN.muted }}>{s.label}</p>
                        <p className="text-sm font-semibold" style={{ color: CN.cream }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {(isOwner || isPilot) && (
                    <Link to={`/rig/${slug}/edit`} className="inline-block mt-4 text-[10px] font-semibold" style={{ color: CN.gold }}>Edit Specs →</Link>
                  )}
                </div>

                {/* Engine & Performance */}
                {(rig.fuelType || rig.avgMPG || rig.solarWatts || rig.generatorWatts) && (
                  <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.gold }}>Engine & Performance</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[
                        { label: 'Fuel Type', value: rig.fuelType },
                        { label: 'Avg MPG', value: rig.avgMPG },
                        { label: 'Solar', value: rig.solarWatts ? `${rig.solarWatts}W` : null },
                        { label: 'Generator', value: rig.generatorWatts ? `${rig.generatorWatts}W` : null },
                        { label: 'Engine', value: rig.engineSize },
                        { label: 'Chassis', value: rig.chassisMake },
                      ].filter(s => s.value).map(s => (
                        <div key={s.label}>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CN.muted }}>{s.label}</p>
                          <p className="text-sm font-semibold" style={{ color: CN.cream }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tanks & Systems */}
                {(rig.freshWaterGal || rig.grayWaterGal || rig.blackWaterGal) && (
                  <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.gold }}>Tanks & Systems</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Fresh Water', value: rig.freshWaterGal ? `${rig.freshWaterGal} gal` : null },
                        { label: 'Gray Water', value: rig.grayWaterGal ? `${rig.grayWaterGal} gal` : null },
                        { label: 'Black Water', value: rig.blackWaterGal ? `${rig.blackWaterGal} gal` : null },
                      ].filter(s => s.value).map(s => (
                        <div key={s.label}>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CN.muted }}>{s.label}</p>
                          <p className="text-sm font-semibold" style={{ color: CN.cream }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tires */}
                {(rig.tireSizeFront || rig.tireSizeRear) && (
                  <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.gold }}>Tires</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Front', value: rig.tireSizeFront },
                        { label: 'Rear', value: rig.tireSizeRear },
                        { label: 'Installed', value: rig.tireInstallDate ? new Date(rig.tireInstallDate).toLocaleDateString() : null },
                      ].filter(s => s.value).map(s => (
                        <div key={s.label}>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CN.muted }}>{s.label}</p>
                          <p className="text-sm font-semibold" style={{ color: CN.cream }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ownership */}
                {(rig.purchaseDate || rig.currentOdometer) && (
                  <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.gold }}>Ownership</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Purchase Date', value: rig.purchaseDate ? new Date(rig.purchaseDate).toLocaleDateString() : null },
                        { label: 'Odometer', value: rig.currentOdometer ? `${rig.currentOdometer.toLocaleString()} mi` : null },
                      ].filter(s => s.value).map(s => (
                        <div key={s.label}>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CN.muted }}>{s.label}</p>
                          <p className="text-sm font-semibold" style={{ color: CN.cream }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* The Crew */}
                <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CN.gold }}>The Crew</h3>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    <Link to={`/profile/${owner.username || owner.id}`} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl min-w-[100px] transition hover:brightness-110" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                      {owner.profilePicture ? (
                        <img src={owner.profilePicture} alt={owner.firstName} className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: CN.gold }} />
                      ) : (
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: CN.gold }}>{owner.firstName?.[0]}</div>
                      )}
                      <p className="text-xs font-bold" style={{ color: CN.cream }}>{owner.firstName}</p>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `linear-gradient(135deg, ${CN.gold}, ${CN.orange})`, color: CN.bg }}>Owner</span>
                    </Link>
                    {rig.pilots?.filter((p: any) => p.userId !== rig.ownerId).map((p: any) => (
                      <Link key={p.id} to={`/profile/${p.user?.username || p.userId}`} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl min-w-[100px] transition hover:brightness-110" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                        {p.user?.profilePicture ? (
                          <img src={p.user.profilePicture} alt={p.user.firstName} className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: CN.success }} />
                        ) : (
                          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: 'rgba(76,175,130,0.2)', color: CN.success }}>{p.user?.firstName?.[0]}</div>
                        )}
                        <p className="text-xs font-bold" style={{ color: CN.cream }}>{p.user?.firstName}</p>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(76,175,130,0.2)', color: CN.success }}>{p.role === 'COPILOT' ? 'Co-Pilot' : 'Crew'}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ FOLLOWERS ═══ */}
            {activeTab === 'followers' && rig && (
              <>
                <button onClick={() => setActiveTab('overview')} className="text-xs mb-4 flex items-center gap-1" style={{ color: CN.gold }}>
                  &larr; Back to Overview
                </button>
                <RigFollowersTab rigId={rig.id} rigName={rigTitle} />
              </>
            )}

          </div>
        </div>
      </div>

      {/* Miles / MPG Edit Modal */}
      {milesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setMilesModalOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4" style={{ color: CN.cream }}>Edit Miles & MPG</h3>

            {/* Miles */}
            <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: CN.muted }}>Total Miles</label>
            <div className="flex items-center gap-2 mb-3">
              <input type="number" value={editMiles} onChange={e => setEditMiles(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }}
                placeholder="e.g. 12000" />
              <span className="text-xs" style={{ color: CN.muted }}>mi</span>
            </div>
            <p className="text-[9px] mb-4" style={{ color: CN.muted }}>
              {rig.milesEstimated !== false
                ? 'Currently estimated from check-in routes. Setting a value confirms it as your corrected total.'
                : 'This is your confirmed total. Future check-in legs will add on top.'}
            </p>

            {/* MPG */}
            <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: CN.muted }}>Average MPG</label>
            <div className="flex items-center gap-2 mb-3">
              <input type="number" step="0.1" value={editMpg} onChange={e => setEditMpg(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }}
                placeholder="e.g. 8.5" />
              <span className="text-xs" style={{ color: CN.muted }}>mpg</span>
            </div>
            <p className="text-[9px] mb-4" style={{ color: CN.muted }}>
              Fuel logs will override this with a calculated value when available.
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => setMilesModalOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'transparent', border: `1px solid ${CN.border}`, color: CN.muted }}>
                Cancel
              </button>
              <button disabled={milesSaving} onClick={async () => {
                setMilesSaving(true);
                try {
                  const miles = parseFloat(editMiles);
                  const mpg = editMpg ? parseFloat(editMpg) : null;
                  if (!isNaN(miles) && miles >= 0) {
                    await api.post(`/rigs/${slug}/mileage/correct`, { correctedMiles: miles });
                    setRig((r: any) => ({ ...r, totalMilesDriven: miles, milesEstimated: false }));
                  }
                  if (mpg !== null && !isNaN(mpg) && mpg >= 0) {
                    await api.patch('/basecamp/v2/rig-details', { avgMPG: mpg, _source: 'user' });
                    setRig((r: any) => ({ ...r, avgMPG: mpg }));
                  }
                  setMilesModalOpen(false);
                } catch {}
                setMilesSaving(false);
              }}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition hover:brightness-110"
                style={{ background: CN.gold, color: CN.bg, opacity: milesSaving ? 0.6 : 1 }}>
                {milesSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <GateModal {...gateModalProps} />
    </>
  );
}
