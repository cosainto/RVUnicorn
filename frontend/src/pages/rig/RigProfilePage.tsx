import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Heart, Share2, Edit, MapPin, Moon, Route, Map, Star, Wrench, Users, Truck, ChevronDown, ExternalLink, Youtube, Instagram, Globe } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGate } from '../../hooks/useGate';
import GateModal from '../../components/public/GateModal';
import AlbumPhotoGrid from '../../components/AlbumPhotoGrid';
import RigActivityFeed from '../../components/rig/RigActivityFeed';
import RigJourneyTab from '../../components/rig/RigJourneyTab';
import RigMomentsTab from '../../components/rig/RigMomentsTab';
import RigCommunityTab from '../../components/rig/RigCommunityTab';
import RigFeedV2 from '../../components/rig/RigFeedV2';
import RigTripMode from '../../components/rig/RigTripMode';
import { PhotosTab, VideosTab, CampsitesTab, RecsTab, ModsTab, GearTab, MaintenanceTab, ResourcesTab, AchievementsTab, CommunityHubTab } from '../../components/rig/RigHubTabs';
import RigTimelineTab from '../../components/rig/RigTimelineTab';
import RigRecipesTab from '../../components/rig/RigRecipesTab';
import RigShowcase from '../../components/rig/RigShowcase';
import RigFollowersTab from '../../components/rig/RigFollowersTab';
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
  const { user } = useAuth();
  const { requireAuth, gateModalProps } = useGate();
  const [rig, setRig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');
  const [mods, setMods] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [showAllSpecs, setShowAllSpecs] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get(`/rigs/${slug}`)
      .then(r => {
        setRig(r.data);
        setFollowing(!!r.data?.isFollowing);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, user?.id]);

  // Load tab data on tab change
  useEffect(() => {
    if (!rig?.id) return;
    if (activeTab === 'trips' && trips.length === 0) {
      api.get(`/rigs/${rig.id}/trips`).then(r => setTrips(r.data || [])).catch(() => {});
    }
    if (activeTab === 'mods' && mods.length === 0) {
      api.get(`/rigs/${rig.id}/mods`).then(r => setMods(r.data || [])).catch(() => {});
    }
    if (activeTab === 'posts' && posts.length === 0) {
      api.get(`/rigs/${rig.id}/posts`).then(r => setPosts(r.data || [])).catch(() => {});
    }
    if (activeTab === 'overview' && events.length === 0) {
      api.get(`/rigs/${rig.id}/events`).then(r => setEvents(r.data || [])).catch(() => {});
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
    { id: 'timeline', label: '📖 Timeline' },
    { id: 'feed', label: '🗺️ Trips' },
    { id: 'photos', label: '📸 Photos' },
    { id: 'videos', label: '🎥 Videos' },
    { id: 'recipes', label: '🍳 Recipes' },
    { id: 'mods-hub', label: '🧰 Mods' },
    { id: 'campsites', label: '\u{1F3D5}\uFE0F Places Stayed' },
    { id: 'journal', label: '📖 Journal' },
    { id: 'maps', label: '🗺️ Maps' },
    { id: 'recs', label: '⭐ Recs' },
    { id: 'gear', label: '📦 Gear' },
    { id: 'maintenance', label: '🛠 Maintenance' },
    { id: 'achievements', label: '🏆 Achievements' },
    { id: 'followers', label: `👥 Followers (${rig.followerCount || 0})` },
    { id: 'community-hub', label: '🌐 Community' },
    { id: 'overview', label: 'ℹ️ About' },
  ];

  return (
    <>
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

            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
              <>
                {/* Module A: Rig Story */}
                {rig.creatorBio && (
                  <div className="rounded-2xl p-5" style={{ background: '#F5F0E8', borderLeft: `3px solid ${CN.gold}` }}>
                    <p className="text-xs font-bold mb-2" style={{ color: CN.gold }}>🔥 Rig Chronicles</p>
                    <p className="text-sm leading-relaxed" style={{ fontFamily: "'Playfair Display', serif", color: '#1A2B45' }}>{rig.creatorBio}</p>
                  </div>
                )}

                {/* Module B: Specs */}
                <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <h3 className="text-sm font-bold mb-4" style={{ color: CN.cream }}>Specs</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                    {[
                      ['Class', rig.rigClass?.replace('_', ' ')],
                      ['Length', rig.lengthFeet ? `${rig.lengthFeet} ft` : null],
                      ['Slideouts', rig.slideoutCount],
                      ['Fuel', rig.fuelType],
                      ['Chassis', rig.chassisMake],
                      ['Roof', rig.roofType],
                      ['Engine', rig.engineSize],
                      ['Fresh Water', rig.freshWaterGal ? `${rig.freshWaterGal} gal` : null],
                      ['Gray Water', rig.grayWaterGal ? `${rig.grayWaterGal} gal` : null],
                      ['Black Water', rig.blackWaterGal ? `${rig.blackWaterGal} gal` : null],
                      ['Tires', rig.tireSizeFront],
                    ].map(([label, val]) => (
                      <div key={label as string} className="flex justify-between py-1" style={{ borderBottom: `1px solid ${CN.border}30` }}>
                        <span className="text-xs" style={{ color: CN.muted }}>{label}</span>
                        <span className="text-xs font-semibold" style={{ color: CN.cream }}>{val || '—'}</span>
                      </div>
                    ))}
                  </div>
                  {!showAllSpecs ? (
                    <button onClick={() => setShowAllSpecs(true)} className="text-xs mt-3 flex items-center gap-1" style={{ color: CN.gold }}>
                      <ChevronDown className="w-3 h-3" /> More specs
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-2">
                      {[
                        ['GVWR', rig.grossWeight ? `${rig.grossWeight.toLocaleString()} lbs` : null],
                        ['Towing', rig.towingCapacity ? `${rig.towingCapacity.toLocaleString()} lbs` : null],
                        ['Purchase Date', rig.purchaseDate ? new Date(rig.purchaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null],
                        ['Odometer', rig.currentOdometer ? `${rig.currentOdometer.toLocaleString()} mi` : null],
                      ].map(([label, val]) => (
                        <div key={label as string} className="flex justify-between py-1" style={{ borderBottom: `1px solid ${CN.border}30` }}>
                          <span className="text-xs" style={{ color: CN.muted }}>{label}</span>
                          <span className="text-xs font-semibold" style={{ color: CN.cream }}>{val || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {isOwner && (
                    <Link to={`/rig/${slug}/edit`} className="text-xs mt-3 inline-block" style={{ color: CN.gold }}>Edit Specs →</Link>
                  )}
                </div>

                {/* Module G: Road Stats Snapshot */}
                <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: CN.cream }}>Road Stats</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Avg MPG', value: rig.avgMPG ? `${rig.avgMPG.toFixed(1)}` : '—', icon: '⛽' },
                      { label: 'Total Fuel', value: rig.totalFuelCost ? `$${Math.round(rig.totalFuelCost).toLocaleString()}` : '—', icon: '💰' },
                      { label: 'Total Miles', value: rig.totalMilesDriven ? `${Math.round(rig.totalMilesDriven).toLocaleString()}` : '—', icon: '🛣️' },
                      { label: 'Trips', value: rig.totalTripCount || 0, icon: '🗺️' },
                      { label: 'Nights', value: rig.totalNightsCamped || 0, icon: '🌙' },
                      { label: 'States', value: rig.totalStatesCount || 0, icon: '🏕️' },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: CN.cardAlt }}>
                        <span className="text-sm">{s.icon}</span>
                        <p className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif", color: CN.gold }}>{s.value}</p>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: CN.muted }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <Link to={`/rig/${slug}/stats`} className="text-xs mt-3 inline-block" style={{ color: CN.gold }}>See full stats →</Link>
                </div>

                {/* Module: Activity Feed */}
                <RigActivityFeed rigId={rig.id} rigName={rig.rigName} isOwner={isOwner} cn={CN} />

                {/* Module H: Pilots & Crew */}
                <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: CN.cream }}>The Crew</h3>
                  <div className="space-y-3">
                    <Link to={`/profile/${owner.username}`} className="flex items-center gap-3 p-3 rounded-xl transition hover:brightness-110" style={{ background: CN.cardAlt }}>
                      {owner.profilePicture ? <img src={owner.profilePicture} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: CN.gold, color: CN.bg }}>{owner.firstName?.[0]}</div>}
                      <div>
                        <p className="text-sm font-bold" style={{ color: CN.cream }}>{owner.firstName} {owner.lastName}</p>
                        <p className="text-[11px]" style={{ color: CN.muted }}>Owner</p>
                      </div>
                    </Link>
                    {rig.pilots?.filter((p: any) => p.userId !== rig.ownerId).map((p: any) => (
                      <Link key={p.userId} to={`/profile/${p.user?.username || p.userId}`} className="flex items-center gap-3 p-3 rounded-xl transition hover:brightness-110" style={{ background: CN.cardAlt }}>
                        {p.user?.profilePicture ? <img src={p.user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: CN.gold, color: CN.bg }}>{p.user?.firstName?.[0]}</div>}
                        <div>
                          <p className="text-sm font-semibold" style={{ color: CN.cream }}>{p.user?.firstName} {p.user?.lastName}</p>
                          <p className="text-[11px]" style={{ color: CN.muted }}>{p.role}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Module: Upcoming Events */}
                {events.filter((e: any) => new Date(e.startTime) > new Date()).length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <h3 className="text-sm font-bold mb-3" style={{ color: CN.cream }}>Upcoming Events</h3>
                    <div className="space-y-3">
                      {events
                        .filter((e: any) => new Date(e.startTime) > new Date())
                        .slice(0, 3)
                        .map((e: any) => (
                          <div key={e.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: CN.cardAlt }}>
                            <div className="text-center flex-shrink-0 w-10">
                              <p className="text-xs font-bold" style={{ color: CN.gold }}>
                                {new Date(e.startTime).toLocaleDateString('en-US', { month: 'short' })}
                              </p>
                              <p className="text-lg font-bold" style={{ color: CN.cream }}>
                                {new Date(e.startTime).getDate()}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold" style={{ color: CN.cream }}>{e.title}</p>
                              <p className="text-[11px]" style={{ color: CN.muted }}>
                                {e.type} {e.campground ? `· ${e.campground.name}` : ''}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px]" style={{ color: CN.muted }}>{e.rsvpCount} RSVP{e.rsvpCount !== 1 ? 's' : ''}</span>
                                {user && !isOwner && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const { data } = await api.post(`/rigs/${rig.id}/events/${e.id}/rsvp`);
                                        setEvents(evts => evts.map(ev => ev.id === e.id ? {
                                          ...ev,
                                          userHasRsvped: data.rsvped,
                                          rsvpCount: ev.rsvpCount + (data.rsvped ? 1 : -1),
                                        } : ev));
                                      } catch {}
                                    }}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition"
                                    style={{
                                      background: e.userHasRsvped ? CN.gold : 'transparent',
                                      color: e.userHasRsvped ? CN.bg : CN.gold,
                                      border: `1px solid ${CN.gold}`,
                                    }}
                                  >
                                    {e.userHasRsvped ? 'Going' : 'RSVP'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Module I: Creator Links */}
                {rig.isCreatorEnabled && (rig.youtubeUrl || rig.instagramUrl || rig.tiktokUrl || rig.websiteUrl) && (
                  <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <h3 className="text-sm font-bold mb-3" style={{ color: CN.cream }}>Follow {rigTitle} Everywhere</h3>
                    <div className="flex gap-3">
                      {rig.youtubeUrl && <a href={rig.youtubeUrl} target="_blank" rel="noopener" className="w-10 h-10 rounded-full flex items-center justify-center transition hover:brightness-110" style={{ border: `1px solid ${CN.gold}`, color: CN.gold }}><Youtube className="w-5 h-5" /></a>}
                      {rig.instagramUrl && <a href={rig.instagramUrl} target="_blank" rel="noopener" className="w-10 h-10 rounded-full flex items-center justify-center transition hover:brightness-110" style={{ border: `1px solid ${CN.gold}`, color: CN.gold }}><Instagram className="w-5 h-5" /></a>}
                      {rig.tiktokUrl && <a href={rig.tiktokUrl} target="_blank" rel="noopener" className="w-10 h-10 rounded-full flex items-center justify-center transition hover:brightness-110" style={{ border: `1px solid ${CN.gold}`, color: CN.gold }}><ExternalLink className="w-5 h-5" /></a>}
                      {rig.websiteUrl && <a href={rig.websiteUrl} target="_blank" rel="noopener" className="w-10 h-10 rounded-full flex items-center justify-center transition hover:brightness-110" style={{ border: `1px solid ${CN.gold}`, color: CN.gold }}><Globe className="w-5 h-5" /></a>}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ═══ TRIPS TAB ═══ */}
            {activeTab === 'trips' && (
              <div>
                {trips.length === 0 ? (
                  <p className="text-center py-16" style={{ color: CN.muted }}>No trips recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trips.map((t: any) => (
                      <Link key={t.id} to={`/trips/${t.id}`} className="rounded-2xl overflow-hidden transition hover:brightness-110" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                        <div className="relative">
                          <AlbumPhotoGrid
                            photos={t.coverPhotos || (t.coverImage ? [t.coverImage] : [])}
                            totalPhotoCount={t.totalPhotoCount || (t.coverImage ? 1 : 0)}
                            campgroundName={t.campgroundName}
                            campgroundPhoto={t.campgroundImageUrl}
                          />
                          {t.nightsCount > 0 && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold z-10" style={{ background: `${CN.gold}30`, color: CN.gold }}>🌙 {t.nightsCount} nights</span>}
                        </div>
                        <div className="p-4">
                          <p className="text-sm font-bold mb-1" style={{ color: CN.cream }}>{t.title || t.campgroundName || 'Trip'}</p>
                          <p className="text-[11px]" style={{ color: CN.muted }}>
                            {t.startDate && new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {t.campgroundState && ` · ${t.campgroundState}`}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ MODS TAB ═══ */}
            {activeTab === 'mods' && (
              <div>
                {(isOwner || isPilot) && (
                  <Link to={`/rig/${slug}/edit`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold mb-4 transition hover:brightness-110" style={{ background: CN.gold, color: CN.bg }}>
                    <Wrench className="w-3 h-3" /> Log a Mod
                  </Link>
                )}
                {mods.length === 0 ? (
                  <p className="text-center py-16" style={{ color: CN.muted }}>No mods logged yet.</p>
                ) : (
                  <div className="space-y-4">
                    {mods.map((m: any) => (
                      <div key={m.id} className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                        {(m.beforePhoto || m.afterPhoto || m.photos?.length > 0) && (
                          <div className="flex h-40">
                            {m.beforePhoto && <img src={m.beforePhoto} alt="Before" className="w-1/2 h-full object-cover" />}
                            {m.afterPhoto && <img src={m.afterPhoto} alt="After" className="w-1/2 h-full object-cover" />}
                            {!m.beforePhoto && !m.afterPhoto && m.photos?.[0] && <img src={m.photos[0]} alt="" className="w-full h-full object-cover" />}
                          </div>
                        )}
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold" style={{ color: CN.cream }}>{m.title}</p>
                            {m.category && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${CN.gold}20`, color: CN.gold }}>{m.category}</span>}
                          </div>
                          {m.description && <p className="text-xs leading-relaxed mb-2" style={{ color: CN.muted }}>{m.description}</p>}
                          <div className="flex items-center gap-3 text-[11px]" style={{ color: CN.muted }}>
                            {m.modDate && <span>{new Date(m.modDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                            {m.cost && isOwner && <span>${m.cost.toLocaleString()}</span>}
                            {m.productLink && <a href={m.productLink} target="_blank" rel="noopener" className="flex items-center gap-0.5" style={{ color: CN.gold }}>View product <ExternalLink className="w-3 h-3" /></a>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ POSTS TAB ═══ */}
            {activeTab === 'posts' && (
              <div>
                {posts.length === 0 ? (
                  <p className="text-center py-16" style={{ color: CN.muted }}>No posts yet.</p>
                ) : (
                  <div className="space-y-4">
                    {posts.map((p: any) => (
                      <div key={p.id} className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{
                            background: p.postType === 'trip_recap' ? '#22c55e20' : p.postType === 'mod_update' ? `${CN.orange}20` : `${CN.gold}20`,
                            color: p.postType === 'trip_recap' ? '#22c55e' : p.postType === 'mod_update' ? CN.orange : CN.gold,
                          }}>{p.postType?.replace('_', ' ')}</span>
                          <span className="text-[10px]" style={{ color: CN.muted }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        {p.title && <h4 className="text-sm font-bold mb-1" style={{ color: CN.cream }}>{p.title}</h4>}
                        {p.body && <p className="text-xs leading-relaxed" style={{ color: CN.muted }}>{p.body.length > 200 ? p.body.slice(0, 200) + '...' : p.body}</p>}
                        {p.photos?.length > 0 && (
                          <div className="flex gap-2 mt-3 overflow-x-auto">
                            {p.photos.slice(0, 4).map((photo: string, i: number) => (
                              <img key={i} src={photo} alt="" className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ CAMPGROUNDS TAB ═══ */}
            {activeTab === 'campgrounds' && (
              <div className="text-center py-16">
                <p style={{ color: CN.muted }}>Campgrounds this rig has visited</p>
                <Link to={`/profile/${owner.username}/campgrounds`} className="text-xs mt-2 inline-block" style={{ color: CN.gold }}>
                  View {owner.firstName}'s campgrounds →
                </Link>
              </div>
            )}

            {/* ═══ STATS TAB ═══ */}
            {activeTab === 'stats' && (
              <div className="text-center py-16">
                <p style={{ color: CN.muted }}>Detailed stats coming soon</p>
                <p className="text-xs mt-2" style={{ color: CN.muted }}>Miles over time, MPG trends, seasonal analysis</p>
              </div>
            )}

            {/* ═══ JOURNEY TAB ═══ */}
            {activeTab === 'journey' && rig && (
              <RigJourneyTab slug={slug!} rigId={rig.id} isOwner={isOwner} />
            )}

            {/* ═══ MOMENTS TAB ═══ */}
            {activeTab === 'moments' && (
              <RigMomentsTab slug={slug!} isOwner={isOwner} />
            )}

            {/* ═══ FEED / TRIP MODE TAB ═══ */}
            {activeTab === 'feed' && rig && (
              <RigTripMode slug={slug!} isOwner={isOwner} rigName={rigTitle} />
            )}

            {/* ═══ TIMELINE TAB ═══ */}
            {activeTab === 'timeline' && <RigTimelineTab slug={slug!} isOwner={isOwner} rigName={rigTitle} ownerAvatar={owner.profilePicture} ownerName={owner.firstName} />}

            {/* ═══ RECIPES TAB ═══ */}
            {activeTab === 'recipes' && <RigRecipesTab slug={slug!} isOwner={isOwner} />}

            {/* ═══ JOURNAL TAB ═══ */}
            {activeTab === 'journal' && rig && (
              <div>
                {/* Renders journal entries — reuses stories endpoint for now */}
                <RigTimelineTab slug={slug!} isOwner={isOwner} />
              </div>
            )}

            {/* ═══ MAPS TAB ═══ */}
            {activeTab === 'maps' && (
              <div className="text-center py-12">
                <span className="text-4xl block mb-2">🗺️</span>
                <p className="text-sm text-white/40">Interactive route map coming soon</p>
                <p className="text-xs text-white/25 mt-1">Showing all states visited, campgrounds, and routes</p>
              </div>
            )}

            {/* ═══ TRAVEL HUB TABS ═══ */}
            {activeTab === 'photos' && <PhotosTab slug={slug!} isOwner={isOwner} />}
            {activeTab === 'videos' && <VideosTab slug={slug!} isOwner={isOwner} />}
            {activeTab === 'campsites' && <CampsitesTab slug={slug!} isOwner={isOwner} />}
            {activeTab === 'recs' && <RecsTab slug={slug!} isOwner={isOwner} />}
            {activeTab === 'mods-hub' && <ModsTab slug={slug!} isOwner={isOwner} />}
            {activeTab === 'gear' && <GearTab slug={slug!} isOwner={isOwner} />}
            {activeTab === 'maintenance' && <MaintenanceTab slug={slug!} isOwner={isOwner} />}
            {activeTab === 'resources' && <ResourcesTab slug={slug!} isOwner={isOwner} />}
            {activeTab === 'achievements' && <AchievementsTab slug={slug!} isOwner={isOwner} />}
            {activeTab === 'followers' && rig && <RigFollowersTab rigId={rig.id} rigName={rigTitle} />}
            {activeTab === 'community-hub' && rig && <CommunityHubTab slug={slug!} isOwner={isOwner} rigName={rigTitle} />}

          </div>
        </div>
      </div>

      <GateModal {...gateModalProps} />
    </>
  );
}
