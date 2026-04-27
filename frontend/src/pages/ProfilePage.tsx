import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import EventPhotoTitle from '../components/EventPhotoTitle';
import DraggableBanner from '../components/DraggableBanner';
import CurrentlyAtBadge from '../components/CurrentlyAtBadge';
import CommunityTrustBadge from '../components/CommunityTrustBadge';
import HitchProfileSummary from '../components/HitchProfileSummary';
import CampMarketProfile from '../components/CampMarketProfile';
import RigCard from '../components/RigCard';
import ProfileConnectionsGrid from '../components/ProfileConnectionsGrid';
const CampgroundClaimsQueue = lazy(() => import('../components/admin/CampgroundClaimsQueue'));
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Plus, User as UserIcon, MapPin, Link as LinkIcon, Edit, Camera, Tent, Users,
  Star, X, Map, ChefHat, Backpack, UserPlus, UserCheck, Award, Video, BadgeCheck,
  Play, Calendar, MoreHorizontal, ChevronDown
} from 'lucide-react';
import api from '../services/api';
import TripCalendarWidget from '../components/TripCalendarWidget';
import CalendarCampgroundCard from '../components/CalendarCampgroundCard';
import { User as UserType } from '../services/auth.service';
import RVShowcaseEdit from '../components/RVShowcaseEdit';
import SocialLinks from '../components/SocialLinks';
import SocialFeed from '../components/SocialFeed';
import UserStatus from '../components/UserStatus';
import TravelMap from '../components/TravelMap';
import Top8Friends from '../components/Top8Friends';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';
import { UserActionsMenu } from '../components/BlockUserButton';
import FollowingSection from '../components/FollowingSection';
import FollowersSection from '../components/FollowersSection';

interface Profile {
  id: string; username: string; firstName: string; lastName: string;
  profilePicture?: string; coverPhoto?: string; bio?: string; location?: string;
  website?: string; facebookUrl?: string; instagramUrl?: string; tiktokUrl?: string;
  redditUrl?: string; youtubeUrl?: string; twitterUrl?: string; blueskyUrl?: string;
  createdAt: string; rvType?: string; rvMake?: string; rvModel?: string; rvYear?: number;
  status?: string; statusEmoji?: string;
  statusType?: 'CUSTOM' | 'AUTO_CAMPING' | 'AUTO_HOME';
  currentCampsite?: string;
  _count?: { posts: number; friends: number };
  isCreator?: boolean; creatorVerified?: boolean; creatorBio?: string;
  creatorSpecialties?: string[];
  [key: string]: any;
}
interface UserGroup {
  id: string; name: string; description?: string; imageUrl?: string; slug?: string;
  _count?: { members: number }; memberCount?: number;
}
interface ProfilePageProps { user: UserType | null; }

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function AnimatedStat({ value, label, icon, href }: { value: number; label: string; icon: string; href?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView();
  useEffect(() => {
    if (!inView) return;
    let current = 0; const increment = value / 30;
    const timer = setInterval(() => { current += increment; if (current >= value) { setCount(value); clearInterval(timer); } else setCount(Math.floor(current)); }, 50);
    return () => clearInterval(timer);
  }, [inView, value]);

  const content = (
    <div ref={ref} className="text-center p-3 rounded-xl transition-all duration-200" style={{
      background: 'rgba(232,168,56,0.12)',
      border: '1px solid rgba(232,168,56,0.3)',
      cursor: href ? 'pointer' : 'default',
    }}
    onMouseEnter={(e) => { if (href) { (e.currentTarget as HTMLElement).style.borderColor = '#E8A838'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; } }}
    onMouseLeave={(e) => { if (href) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,168,56,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; } }}
    >
      <span className="text-xl block mb-0.5">{icon}</span>
      <span className="font-playfair text-3xl lg:text-[44px] font-bold block" style={{ color: '#E8A838' }}>{count.toLocaleString()}</span>
      <span className="text-[11px] font-semibold uppercase block mt-1" style={{ color: '#8B9BB4', letterSpacing: '0.08em' }}>{label}</span>
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}

const SI = ({ url, children }: { url: string; children: React.ReactNode }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition" style={{ color: 'var(--muted)' }}>{children}</a>
);

export default function ProfilePage({ user }: ProfilePageProps) {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [coPilot, setCoPilot] = useState<any>(null);
  const [showRigCard, setShowRigCard] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<'NONE' | 'PENDING' | 'ACCEPTED'>('NONE');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileBadges, setProfileBadges] = useState<any[]>([]);
  const [displayedBadges, setDisplayedBadges] = useState<any[]>([]);
  const [badgePositions, setBadgePositions] = useState<{[key: string]: {x: number, y: number}}>({});
  const [draggingBadge, setDraggingBadge] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState('activity');
  const [showAbout, setShowAbout] = useState(true);
  const saveBadgePositions = async (positions: {[key: string]: {x: number, y: number}}) => { try { await api.put('/privacy/badge-position', { positions }); } catch {} };
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
  const [albums, setAlbums] = useState<any[]>([]);
  const [favoriteCampgrounds, setFavoriteCampgrounds] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [rvShowcase, setRVShowcase] = useState<any>(null);
  const [coOwnedRVs, setCoOwnedRVs] = useState<any[]>([]);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [creatorContent, setCreatorContent] = useState<any[]>([]);
  const [creatorStats, setCreatorStats] = useState<any>(null);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [showRVShowcaseEdit, setShowRVShowcaseEdit] = useState(false);
  const [showToolbox, setShowToolbox] = useState(false);
  const [userTrips, setUserTrips] = useState<any[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  // Real per-profile stats from /api/profile/:username/stats. The previous
  // counts were computed locally from /trips/my which always returns the
  // VIEWING user's trips, so visitors saw their own numbers attributed to
  // whoever they were viewing (root cause of "304 nights on a brand-new
  // account"). This state holds the right person's numbers.
  const [profileStats, setProfileStats] = useState<{ nightsCamped: number; totalTrips: number; campgroundsVisited: number } | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', bio: '', location: '', zipCode: '', website: '', profilePicture: '', coverPhoto: '', bannerPosition: '50% 50%', rvMpg: '' as string | number, rvFuelType: '' });
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState('');
  const lookupZipCode = async (zip: string) => { if (zip.length !== 5 || !/^\d+$/.test(zip)) { setZipError(''); return; } try { setZipLoading(true); setZipError(''); const r = await fetch(`https://api.zippopotam.us/us/${zip}`); if (!r.ok) { setZipError('Invalid zip'); return; } const d = await r.json(); setEditForm(p => ({ ...p, location: `${d.places[0]['place name']}, ${d.places[0]['state abbreviation']}` })); } catch { setZipError('Lookup failed'); } finally { setZipLoading(false); } };
  const [albumForm, setAlbumForm] = useState({ title: '', description: '', privacy: 'FRIENDS' });
  const isOwnProfile = user?.username === username || user?.id === username;
  const rigSection = useInView(); const mapSection = useInView();

  useEffect(() => { loadProfile(); loadFavoriteCampgrounds(); loadRVShowcase(); loadUserGroups(); loadPendingClaims(); loadCreatorContent(); loadTripsAndCheckins(); loadProfileStats(); }, [username]);
  const loadTripsAndCheckins = async () => {
    // /trips/my returns the AUTHENTICATED user's events — only useful when
    // you're looking at your own profile. For someone else's profile, leave
    // userTrips empty so we don't accidentally render the viewer's trips
    // under the viewed user's name. Stats come from /profile/:username/stats.
    if (isOwnProfile) {
      try { const { data } = await api.get('/trips/my'); setUserTrips(Array.isArray(data) ? data : (data.trips || [])); } catch {}
    } else {
      setUserTrips([]);
    }
    try { const { data } = await api.get('/campgrounds/favorites/my'); setRecentCheckins(data.slice(0, 5).map((c: any) => ({ id: c.id, name: c.name, city: c.city || c.location || '', state: c.state || '', photoUrl: c.imageUrl || c.photos?.[0]?.imageUrl, slug: c.customSlug || c.id, visitDate: c.updatedAt || '', planned: false }))); } catch {}
  };
  const loadProfileStats = async () => {
    if (!username) return;
    try {
      const { data } = await api.get(`/profile/${username}/stats`);
      setProfileStats({ nightsCamped: data.nightsCamped || 0, totalTrips: data.totalTrips || 0, campgroundsVisited: data.campgroundsVisited || 0 });
    } catch {}
  };
  const loadCreatorContent = async () => { if (!username) return; try { const { data: p } = await api.get(`/profile/${username}`); if (p.isCreator) { const { data: c } = await api.get(`/creators/content/${p.id}`); setCreatorContent(Array.isArray(c) ? c.slice(0, 4) : []); try { const { data: s } = await api.get(`/creators/profile/${username}`); setCreatorStats(s); } catch {} } } catch {} };
  const loadProfile = async () => { try { setLoading(true); const { data } = await api.get(`/profile/${username}`); setProfile(data); loadAlbums(data.id); setEditForm({ firstName: data.firstName || '', lastName: data.lastName || '', bio: data.bio || '', location: data.location || '', website: data.website || '', profilePicture: data.profilePicture || '', coverPhoto: data.coverPhoto || '', bannerPosition: data.bannerPosition || '50% 50%' }); if (user && !isOwnProfile && data.id) checkFriendshipStatus(data.id); api.get(`/rig-connection/co-pilot/${data.id}`).then(r => { if (r.data?.coPilot) setCoPilot(r.data.coPilot); }).catch(() => {}); try { if (data.rvCoOwnedBy?.length > 0) setCoOwnedRVs(data.rvCoOwnedBy.map((c: any) => c.owner)); const br = await api.get(`/badges/user/${data.id}`); setProfileBadges(br.data?.badges || []); setDisplayedBadges((br.data?.badges || []).slice(0, 3)); const pr = await api.get(`/privacy/badge-position/${data.id}`); if (pr.data?.positions) setBadgePositions(pr.data.positions); } catch {} } catch {} finally { setLoading(false); } };
  const loadAlbums = async (pid?: string) => {
    if (!pid) return;
    try {
      setLoadingAlbums(true);
      // Albums live in TWO different models: media-albums (Album model) and
      // photo-albums (PhotoAlbum model). The /albums create flow writes to
      // PhotoAlbum; the profile-page create flow writes to Album. Pull both
      // and merge so nothing is hidden from the profile based on which
      // surface the user happened to use.
      const [mediaRes, photoRes] = await Promise.allSettled([
        api.get(`/media-albums?userId=${pid}`),
        api.get(`/albums/user/${pid}`),
      ]);

      const media = mediaRes.status === 'fulfilled' ? (mediaRes.value.data || []) : [];
      const photo = photoRes.status === 'fulfilled' ? (photoRes.value.data || []) : [];

      // Normalize both into a common shape the renderer can consume
      const normalized = [
        ...media.map((a: any) => ({
          id: a.id,
          title: a.title,
          createdAt: a.createdAt,
          // detail-page route for media-albums
          link: `/media-albums/${a.id}`,
          previewMedia: a.previewMedia,
          coverImage: a.previewMedia?.[0]?.thumbnailUrl || a.previewMedia?.[0]?.url || null,
        })),
        ...photo.map((a: any) => ({
          id: a.id,
          title: a.title,
          createdAt: a.createdAt,
          // detail-page route for photo-albums (the /albums create flow)
          link: `/albums/${a.id}`,
          previewMedia: a.photos,
          coverImage: a.coverPhotoUrl || a.photos?.[0]?.imageUrl || null,
        })),
      ];

      // Sort by createdAt desc, take 6
      normalized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAlbums(normalized.slice(0, 6));
    } catch {}
    finally { setLoadingAlbums(false); }
  };
  const loadFavoriteCampgrounds = async () => { try { setLoadingFavorites(true); const { data } = await api.get('/campgrounds/favorites/my'); setFavoriteCampgrounds(data); } catch {} finally { setLoadingFavorites(false); } };
  const loadRVShowcase = async () => { try { const { data } = await api.get(`/rv-showcase/${username}`); setRVShowcase(data); } catch {} };
  const loadUserGroups = async () => { try { const { data } = await api.get('/groups/my'); setUserGroups(data.groups || data || []); } catch {} };
  const loadPendingClaims = async () => { if (user?.username !== 'will') return; try { const { data } = await api.get('/campgrounds?verificationStatus=PENDING'); setPendingClaims(data.campgrounds || data || []); } catch {} };
  const handleApproveClaim = async (id: string) => { try { await api.post(`/business/approve-claim/${id}`); loadPendingClaims(); } catch {} };
  const checkFriendshipStatus = async (pid: string) => { try { const { data } = await api.get(`/friends/status/${pid}`); setFriendshipStatus(data.status.toUpperCase()); setFriendshipId(data.friendshipId); setIsInitiator(data.isInitiator); } catch {} };
  const handleFriendAction = async () => { try { if (!profile) return; if (friendshipStatus === 'NONE') { await api.post('/friends/request', { friendId: profile.id }); alert('Friend request sent!'); await checkFriendshipStatus(profile.id); } else if (friendshipStatus === 'PENDING' && !isInitiator && friendshipId) { await api.put(`/friends/accept/${friendshipId}`); await checkFriendshipStatus(profile.id); await loadProfile(); } else if ((friendshipStatus === 'ACCEPTED' || (friendshipStatus === 'PENDING' && isInitiator)) && friendshipId) { if (confirm(friendshipStatus === 'ACCEPTED' ? 'Remove friend?' : 'Cancel request?')) { await api.delete(`/friends/${friendshipId}`); await checkFriendshipStatus(profile.id); await loadProfile(); } } } catch { alert('Failed'); } };
  const getFriendButtonText = () => { if (friendshipStatus === 'NONE') return 'Follow'; if (friendshipStatus === 'PENDING' && isInitiator) return 'Pending'; if (friendshipStatus === 'PENDING' && !isInitiator) return 'Accept'; return 'Friends'; };
  const getFriendButtonIcon = () => friendshipStatus === 'ACCEPTED' ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />;
  const handleUpdateProfile = async () => { try { await api.put(`/profile/${username}`, editForm); setShowEditModal(false); await loadProfile(); } catch { alert('Failed'); } };
  const handleCreateAlbum = async () => { try { const { data: a } = await api.post('/media-albums', albumForm); setShowCreateAlbumModal(false); setAlbumForm({ title: '', description: '', privacy: 'FRIENDS' }); loadAlbums(profile?.id); navigate(`/albums/${a.id}`); } catch {} };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1A2E' }}><div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: '#C9A84C' }} /></div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1A2E', color: 'rgba(255,255,255,0.5)' }}><p>Profile not found</p></div>;

  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const TABS = [
    { id: 'activity', label: 'Activity', show: true },
    { id: 'friends', label: 'Friends', show: (profile._count?.friends || 0) > 0 },
    { id: 'albums', label: `Albums${albums.length ? ` (${albums.length})` : ''}`, show: true },
    { id: 'trips', label: 'Trips', show: userTrips.length > 0 },
    { id: 'groups', label: `Groups${userGroups.length ? ` (${userGroups.length})` : ''}`, show: userGroups.length > 0 },
    { id: 'campgrounds', label: `Campgrounds${favoriteCampgrounds.length ? ` (${favoriteCampgrounds.length})` : ''}`, show: favoriteCampgrounds.length > 0 },
  ].filter(t => t.show);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        :root{--navy:#1B2B4B;--navy-deep:#1A2B45;--navy-body:#22334D;--gold:#E8A838;--gold-light:#E8C96A;--campfire:#E8622A;--campfire-glow:rgba(232,98,42,0.12);--glass-hero:rgba(26,43,69,0.85);--glass-secondary:rgba(26,43,69,0.95);--glass-border:rgba(201,168,76,0.2);--muted:rgba(255,255,255,0.6);--cream:#F5F0E8}
        .font-playfair{font-family:'Playfair Display',serif}.font-dm{font-family:'DM Sans',sans-serif}
        .hero-glass{background:rgba(22,34,54,0.9);backdrop-filter:blur(16px);border:1px solid var(--glass-border);border-radius:20px}
        .support-glass{background:rgba(22,34,54,0.95);backdrop-filter:blur(6px);border:1px solid rgba(201,168,76,0.12);border-radius:16px}
        .flat-card{background:#162236;border:1px solid rgba(255,255,255,0.08);border-radius:14px}
        .tab-pill{padding:7px 18px;border-radius:9999px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s;background:#162236;border:1px solid #243552}
        .tab-pill.active{background:transparent;color:var(--gold);border-color:var(--gold);border-bottom:2px solid var(--gold)}.tab-pill:not(.active){color:#8B9BB4}
        .tab-pill:not(.active):hover{background:rgba(255,255,255,0.04);color:#F5F0E8}
        @keyframes kenBurns{0%{transform:scale(1)}50%{transform:scale(1.06)}100%{transform:scale(1)}}
        @keyframes campfirePulse{0%,100%{opacity:0.5}50%{opacity:0.75}}
        @keyframes tabFade{from{opacity:0}to{opacity:1}}.tab-enter{animation:tabFade 150ms ease}

        /* Campfire Night theme for SocialFeed — cards lighter than page bg for contrast */
        .dark-feed { background: transparent !important; }
        .dark-feed .bg-white { background: #243756 !important; color: rgba(245,240,232,0.85) !important; border: 1px solid rgba(232,168,56,0.1); border-radius: 14px; }
        .dark-feed .bg-gray-50, .dark-feed .bg-gray-100 { background: #2A3F5C !important; }
        .dark-feed .bg-gray-200 { background: #2A3F5C !important; }
        .dark-feed .bg-gray-300 { background: #22334D !important; color: rgba(245,240,232,0.6) !important; }
        .dark-feed .bg-green-50, .dark-feed .bg-blue-50, .dark-feed .bg-orange-50, .dark-feed .bg-indigo-50, .dark-feed .bg-amber-50, .dark-feed .bg-purple-50, .dark-feed .bg-red-50 { background: #2A3F5C !important; }
        .dark-feed .border-gray-100, .dark-feed .border-gray-200, .dark-feed .border-gray-300 { border-color: rgba(232,168,56,0.12) !important; }
        .dark-feed .border-green-200, .dark-feed .border-blue-200, .dark-feed .border-orange-200, .dark-feed .border-indigo-200, .dark-feed .border-amber-300, .dark-feed .border-purple-200 { border-color: rgba(232,168,56,0.18) !important; }
        .dark-feed .text-gray-900 { color: #F5F0E8 !important; }
        .dark-feed .text-gray-800, .dark-feed .text-gray-700 { color: rgba(245,240,232,0.7) !important; }
        .dark-feed .text-gray-600 { color: rgba(245,240,232,0.5) !important; }
        .dark-feed .text-gray-500 { color: rgba(245,240,232,0.4) !important; }
        .dark-feed .text-gray-400 { color: rgba(245,240,232,0.3) !important; }
        .dark-feed .text-gray-300 { color: rgba(245,240,232,0.2) !important; }
        .dark-feed .text-blue-500 { color: #E8A838 !important; }
        .dark-feed .text-red-500 { color: #D4621A !important; }
        .dark-feed .text-orange-500 { color: #D4621A !important; }
        .dark-feed .bg-blue-50 .text-blue-500, .dark-feed .text-primary-600 { color: #E8A838 !important; }
        .dark-feed .hover\\:bg-gray-50:hover, .dark-feed .hover\\:bg-gray-100:hover { background: #2F4565 !important; }
        .dark-feed .hover\\:bg-gray-400:hover { background: #2A3F5C !important; }
        .dark-feed .border-l-4 { border-color: #E8A838 !important; }
        .dark-feed .shadow-lg { box-shadow: 0 8px 30px rgba(0,0,0,0.3) !important; }
        .dark-feed .shadow-md, .dark-feed .shadow-sm { box-shadow: 0 2px 12px rgba(0,0,0,0.25) !important; }
        .dark-feed input, .dark-feed textarea { background: #2A3F5C !important; border-color: rgba(232,168,56,0.18) !important; color: #F5F0E8 !important; }
        .dark-feed .rounded-lg { border-color: rgba(232,168,56,0.1); }
        .dark-feed .bg-gradient-to-br { background: #2A3F5C !important; }
        .dark-feed a.text-primary-600, .dark-feed .hover\\:text-primary-600:hover, .dark-feed .hover\\:text-primary-700:hover { color: #E8A838 !important; }
        .dark-feed .font-semibold.text-primary-600 { color: #E8A838 !important; }
        .dark-feed .btn-primary, .dark-feed .bg-primary-500, .dark-feed .bg-primary-600 { background: #D4621A !important; color: #F5F0E8 !important; }
        .dark-feed .border-2.border-gray-200 { border-color: rgba(27,46,80,0.8) !important; }
      `}</style>

      <div className="min-h-screen font-dm" style={{ background: 'var(--navy-deep)', color: 'white' }}>
        <Helmet>
          <title>{profile.firstName} {profile.lastName} (@{profile.username}) — RVUnicorn</title>
          <meta name="description" content={`${profile.firstName}'s RV adventures on RVUnicorn. ${profile._count?.friends || 0} friends.`} />
          <meta property="og:title" content={`${profile.firstName} ${profile.lastName} — RVUnicorn`} />
          {profile.profilePicture && <meta property="og:image" content={profile.profilePicture} />}
        </Helmet>

        {/* ══ 1. COVER PHOTO ══ */}
        <section className="relative">
          <div className="badge-container relative overflow-hidden" style={{ height: 'clamp(200px, 30vw, 300px)', background: 'radial-gradient(ellipse 80% 60% at 50% 100%, var(--campfire-glow), transparent 60%), linear-gradient(135deg, var(--navy), var(--navy-deep))' }}>
            {(profile.coverPhoto || rvShowcase?.photos?.[0]) ? (
              <DraggableBanner imageUrl={profile.coverPhoto || rvShowcase.photos[0]} altText="Cover" position={profile.bannerPosition || '50% 50%'} canEdit={isOwnProfile && !!profile.coverPhoto}
                onPositionChange={async (pos) => { try { await api.put('/profile', { bannerPosition: pos }); setProfile(p => p ? { ...p, bannerPosition: pos } : p); } catch {} }}
                className="w-full h-full" style={{ animation: 'kenBurns 22s ease-in-out infinite' }} />
            ) : (
              <div className="absolute inset-0" style={{ animation: 'campfirePulse 4s ease-in-out infinite', background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(232,98,42,0.18), transparent 70%)' }} />
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(to top, var(--navy-deep), transparent)' }} />
            {/* Contextual overlay */}
            <div className="absolute bottom-4 left-6 z-10">
              {profile.currentCampsite && <p className="text-[13px] font-medium" style={{ color: 'var(--gold-light)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{'\u{1F4CD}'} Currently at {profile.currentCampsite}</p>}
            </div>
            {isOwnProfile && <ProfilePhotoUpload currentPhoto={profile.coverPhoto} type="cover" onUploadSuccess={loadProfile} />}
            {/* Draggable badges */}
            {displayedBadges.map((b, i) => (
              <div key={b.id} className="absolute group z-20 select-none" style={{ bottom: badgePositions[b.id]?.y ?? (16+i*4), right: badgePositions[b.id]?.x ?? (16+i*56), cursor: isOwnProfile ? (draggingBadge === b.id ? 'grabbing' : 'grab') : 'default' }} title={b.name}
                onMouseDown={(e) => { if (!isOwnProfile) return; e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setDragOffset({ x: e.clientX-r.left, y: e.clientY-r.top }); setDraggingBadge(b.id); const mm = (me: MouseEvent) => { const p = document.querySelector('.badge-container'); if (!p) return; const pr = p.getBoundingClientRect(); setBadgePositions(pv => ({ ...pv, [b.id]: { x: Math.max(10, Math.min(pr.width-80, pr.right-me.clientX-32)), y: Math.max(10, Math.min(pr.height-80, pr.bottom-me.clientY-32)) } })); }; const mu = () => { setDraggingBadge(null); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); setBadgePositions(pv => { saveBadgePositions(pv); return pv; }); }; document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); }}>
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 shadow-lg hover:scale-110 transition-transform" style={{ borderColor: 'var(--gold)', background: 'var(--navy-deep)' }}>
                  <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                </div>
              </div>
            ))}
          </div>

          {/* ══ 2. IDENTITY CARD ══ */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6" style={{ marginTop: '-56px', position: 'relative', zIndex: 10 }}>
            <div className="hero-glass" style={{ borderTop: '2px solid var(--gold)' }}>
              <div className="p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* LEFT 40%: Identity */}
                  <div className="lg:w-[40%] flex flex-col sm:flex-row lg:flex-col items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0" style={{ marginTop: '-48px' }}>
                      {isOwnProfile ? <ProfilePhotoUpload currentPhoto={profile.profilePicture} type="profile" onUploadSuccess={loadProfile} />
                      : <div className="w-24 h-24 rounded-full overflow-hidden shadow-2xl" style={{ border: '3px solid var(--gold)', background: 'var(--navy)' }}>
                          {profile.profilePicture ? <img src={profile.profilePicture} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--campfire), var(--gold))' }}><UserIcon className="w-12 h-12 text-white" /></div>}
                        </div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="font-playfair text-[26px] font-bold leading-tight">{profile.firstName} {profile.lastName}</h1>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {(profile as any).triviaTitle && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.2)' }}>{(profile as any).triviaTitle}</span>}
                        {profile.isCreator && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg,#8B5CF6,#EC4899)', color: 'white' }}><Video className="w-3 h-3 inline mr-0.5" />Creator</span>}
                      </div>
                      <p className="text-[13px] mt-0.5" style={{ color: 'var(--muted)' }}>@{profile.username}</p>

                      {/* Status */}
                      <div className="mt-2"><UserStatus profile={{ id: profile.id, username: profile.username, status: profile.status, statusEmoji: profile.statusEmoji, statusType: profile.statusType, currentCampsite: profile.currentCampsite }} isOwnProfile={isOwnProfile} onUpdate={loadProfile} /></div>

                      {/* Co-pilot */}
                      {coPilot && <Link to={`/profile/${coPilot.username}`} className="flex items-center gap-1.5 mt-2 text-[12px] hover:opacity-80" style={{ color: 'var(--muted)' }}>{'\u{1F9ED}'} Traveling with <span className="font-medium" style={{ color: 'var(--cream)' }}>@{coPilot.username}</span></Link>}

                      <div className="mt-2 space-y-1">
                        <CurrentlyAtBadge userId={profile.id} isOwnProfile={isOwnProfile} />
                        <CommunityTrustBadge userId={profile.id} />
                        {profile.openToWork && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(232,168,56,0.1)', color: '#E8A838', border: '1px solid rgba(232,168,56,0.2)' }}>{'\u{1F527}'} Open to Work</span>}
                      </div>

                      {/* RV line */}
                      {(profile.rvMake || profile.rvType) && <p className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--cream)' }}><Tent className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />{profile.rvYear && `${profile.rvYear} `}{profile.rvMake} {profile.rvModel}{profile.rvType && ` · ${profile.rvType}`}</p>}

                      {/* Action row */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {isOwnProfile ? (
                          <>
                            <button onClick={() => setShowEditModal(true)} className="px-4 py-2 rounded-full text-[12px] font-semibold flex items-center gap-1.5" style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}><Edit className="w-3.5 h-3.5" />Edit Profile</button>
                            <div className="relative">
                              <button onClick={() => setShowToolbox(!showToolbox)} className="p-2 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.1)' }}><MoreHorizontal className="w-4 h-4" style={{ color: 'var(--muted)' }} /></button>
                              {showToolbox && <div className="absolute top-full left-0 mt-1 py-2 rounded-xl z-20 min-w-[160px]" style={{ background: 'var(--glass-secondary)', border: '1px solid var(--glass-border)' }}>
                                <Link to={`/profile/${username}/rig`} className="flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-white/5" style={{ color: 'var(--cream)' }}><Tent className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />My Rig</Link>
                                <Link to={`/profile/${username}/recipes`} className="flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-white/5" style={{ color: 'var(--cream)' }}><ChefHat className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />Recipe Box</Link>
                                <Link to={`/profile/${username}/gear`} className="flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-white/5" style={{ color: 'var(--cream)' }}><Backpack className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />Gear List</Link>
                                {profile.rvMake && <button onClick={() => { setShowRigCard(true); setShowToolbox(false); }} className="flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-white/5 w-full text-left" style={{ color: 'var(--cream)' }}><Award className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />Rig Card</button>}
                                {profile.isCreator && <Link to={`/creators/${profile.username}`} className="flex items-center gap-2 px-4 py-2 text-[12px] hover:bg-white/5" style={{ color: 'var(--cream)' }}><Play className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />Creator Page</Link>}
                              </div>}
                            </div>
                          </>
                        ) : (
                          <>
                            <button onClick={handleFriendAction} className="px-5 py-2 rounded-full text-[12px] font-semibold flex items-center gap-1.5 hover:brightness-110 transition"
                              style={{ background: friendshipStatus === 'ACCEPTED' ? 'transparent' : 'var(--campfire)', color: 'white', border: friendshipStatus === 'ACCEPTED' ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                              {getFriendButtonIcon()} {getFriendButtonText()}
                            </button>
                            <UserActionsMenu userId={profile.id} username={profile.username} onBlock={() => navigate('/basecamp')} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT 60%: Stats + Badges + Actions */}
                  <div className="lg:w-[60%]">
                    <div className="grid grid-cols-2 gap-2">
                      <AnimatedStat icon={'\u{1F3D5}'} value={profileStats?.nightsCamped ?? 0} label="Nights Camped" href={`/profile/${username}/trips`} />
                      <AnimatedStat icon={'\u{1F6E3}'} value={profileStats?.totalTrips ?? userTrips.length} label="Trips" href={`/profile/${username}/trips`} />
                      <AnimatedStat icon={'\u{1F4CD}'} value={profileStats?.campgroundsVisited ?? 0} label="Campgrounds" href={`/profile/${username}/campgrounds`} />
                      <AnimatedStat icon={'\u{1F91D}'} value={profile._count?.friends || 0} label="Friends" href={`/profile/${username}/friends`} />
                    </div>

                    {/* Badges */}
                    {displayedBadges.length > 0 && (
                      <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
                        {displayedBadges.slice(0, 3).map(b => (
                          <div key={b.id} className="relative group">
                            <div className="w-9 h-9 rounded-full overflow-hidden" style={{ border: b.name === 'Founding Member' ? '2px solid var(--gold)' : '1px solid rgba(255,255,255,0.1)' }}>
                              <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-20 text-center" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.2)' }}>
                              <p className="text-[9px] font-bold" style={{ color: '#F5F0E8' }}>{b.name}</p>
                              {b.name === 'Founding Member' && b.badgeNumber && <p className="text-[8px]" style={{ color: '#E8A838' }}>Limited Edition #{b.badgeNumber}/5,000</p>}
                            </div>
                          </div>
                        ))}
                        {profileBadges.length > 3 && <button onClick={() => setShowBadgesModal(true)} className="text-[11px]" style={{ color: 'var(--gold-light)' }}>View all {profileBadges.length} →</button>}
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* About (collapsed) */}
              <div style={{ borderTop: '1px solid var(--glass-border)' }}>
                <button onClick={() => setShowAbout(!showAbout)} className="w-full px-6 py-2.5 flex items-center gap-2 text-[12px] font-medium hover:bg-white/[0.02] transition" style={{ color: 'var(--gold)' }}>
                  About {profile.firstName} <ChevronDown className="w-3.5 h-3.5" style={{ transform: showAbout ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
                </button>
                {showAbout && (
                  <div className="px-6 pb-5 space-y-2.5" style={{ animation: 'tabFade 200ms ease' }}>
                    {profile.bio && <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--cream)' }}>{profile.bio}</p>}
                    <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: 'var(--muted)' }}>
                      {profile.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.location}</span>}
                      {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white"><LinkIcon className="w-3 h-3" />Website</a>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {joinDate}</span>
                    </div>
                    {(profile.facebookUrl || profile.instagramUrl || profile.twitterUrl || profile.youtubeUrl || profile.tiktokUrl) && (
                      <div className="flex items-center gap-3">
                        {profile.facebookUrl && <SI url={profile.facebookUrl}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></SI>}
                        {profile.instagramUrl && <SI url={profile.instagramUrl}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.332 0 8.74 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.332 23.986 8.74 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98C23.986 15.668 24 15.259 24 12c0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></SI>}
                        {profile.twitterUrl && <SI url={profile.twitterUrl}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></SI>}
                        {profile.youtubeUrl && <SI url={profile.youtubeUrl}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></SI>}
                        {profile.tiktokUrl && <SI url={profile.tiktokUrl}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></SI>}
                      </div>
                    )}
                    {username && <HitchProfileSummary username={username} />}
                    {profile?.id && <CampMarketProfile userId={profile.id} />}
                    {profile?.id && <ProfileConnectionsGrid userId={profile.id} isOwnProfile={isOwnProfile} />}
                  </div>
                )}
              </div>

              {/* Social metadata */}
              <div className="px-6 py-2.5 text-[11px] flex items-center gap-3" style={{ borderTop: '1px solid var(--glass-border)', color: 'var(--muted)' }}>
                <Link to={`/profile/${username}/friends`} className="hover:text-white">{profile._count?.friends || 0} friends</Link>
                <span>{profile._count?.posts || 0} posts</span>
                <span>Joined {joinDate}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ══ MAIN CONTENT ══ */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-5 pb-10 space-y-5">

          {/* Admin */}
          {user?.username === 'will' && pendingClaims.length > 0 && (
            <div className="support-glass p-5"><h3 className="text-sm font-bold mb-3" style={{ color: 'var(--campfire)' }}>Pending Claims ({pendingClaims.length})</h3>
              {pendingClaims.map((c: any) => <div key={c.id} className="flex items-center justify-between p-3 rounded-xl mb-2" style={{ background: 'rgba(255,255,255,0.03)' }}><div><p className="font-semibold text-sm">{c.name}</p><p className="text-[11px]" style={{ color: 'var(--muted)' }}>{c.location}, {c.state}</p></div><button onClick={() => handleApproveClaim(c.id)} className="px-3 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#10B981', color: 'white' }}>Approve</button></div>)}
            </div>
          )}

          {/* ══ 3. TRAVEL MAP ══ */}
          <div className="hero-glass p-5 lg:p-6">
            <p className="font-playfair text-[15px] italic text-center mb-4" style={{ color: 'var(--gold)' }}>
              {favoriteCampgrounds.length} campgrounds · {albums.length} albums · on the road
            </p>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-playfair text-lg font-bold flex items-center gap-2"><Map className="w-4 h-4" style={{ color: 'var(--gold)' }} />Where They've Been</h2>
              <Link to={`/map/${username}`} className="text-[12px] font-medium" style={{ color: 'var(--gold-light)' }}>View Full Map →</Link>
            </div>
            <div style={{ borderRadius: '12px', background: 'var(--navy)', overflow: 'hidden' }}>
              {profile && <TravelMap userId={profile.id} isOwnProfile={isOwnProfile} profilePicture={profile.profilePicture} compact={true} />}
            </div>
          </div>

          {/* ══ 4. RIG TEASER (links to /profile/:username/rig) ══ */}
          <div className="support-glass overflow-hidden">
            {rvShowcase && (rvShowcase.photos?.length > 0 || rvShowcase.videoUrl) ? (
              <div className="grid md:grid-cols-[40%_60%]">
                <div className="aspect-[4/3] md:aspect-auto" style={{ background: 'var(--navy)', minHeight: '180px' }}>
                  {rvShowcase.photos?.[0] ? <img src={rvShowcase.photos[0]} alt="RV" className="w-full h-full object-cover" /> : rvShowcase.videoUrl ? <video src={rvShowcase.videoUrl} className="w-full h-full object-cover" muted /> : null}
                </div>
                <div className="p-5 lg:p-6 flex flex-col justify-center">
                  <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>THEIR RIG</p>
                  {rvShowcase.title && <h3 className="font-playfair text-xl font-bold italic mb-1" style={{ color: 'var(--cream)' }}>{rvShowcase.title}</h3>}
                  {(profile.rvMake || profile.rvType) && <p className="text-[13px] mb-2" style={{ color: 'var(--muted)' }}>{profile.rvYear && `${profile.rvYear} `}{profile.rvMake} {profile.rvModel}{profile.rvType && ` · ${profile.rvType}`}</p>}
                  {rvShowcase.photos && rvShowcase.photos.length > 1 && (
                    <div className="flex gap-1.5 mb-3">{rvShowcase.photos.slice(0, 3).map((p: string, i: number) => <img key={i} src={p} alt="" className="w-10 h-10 rounded-lg object-cover" />)}</div>
                  )}
                  <Link to={`/profile/${username}/rig`} className="text-[12px] font-semibold mt-1" style={{ color: 'var(--campfire)' }}>Explore {isOwnProfile ? 'My' : 'Their'} Rig & Memories →</Link>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center" style={{ background: 'var(--campfire-glow)' }}>
                <span className="text-3xl block mb-2">{'\u{1F699}'}</span>
                <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--cream)' }}>{isOwnProfile ? 'Your rig is the heart of your profile.' : "This traveler hasn't added their rig yet."}</p>
                {isOwnProfile && <Link to="/my-rv" className="inline-block mt-2 px-5 py-2 rounded-full text-[12px] font-semibold" style={{ background: 'var(--campfire)', color: 'white' }}>Set Up My Rig</Link>}
              </div>
            )}
          </div>

          {/* Gold shimmer divider between hero and body */}
          <div className="h-px my-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,168,56,0.2), transparent)' }} />

          {/* ══ 5. CALENDAR + CAMPGROUNDS CARD ══ */}
          {profile && (
            <CalendarCampgroundCard
              userId={profile.id}
              username={username}
              trips={userTrips.map((t: any) => ({ id: t.id, startDate: t.startDate, endDate: t.endDate || t.startDate, type: new Date(t.startDate) > new Date() ? 'planned' : 'camping' }))}
              visitedCampgrounds={recentCheckins}
              visitedCount={userTrips.filter((t: any) => new Date(t.startDate) <= new Date()).length}
              plannedCount={userTrips.filter((t: any) => new Date(t.startDate) > new Date()).length}
            />
          )}

          {/* ══ 6. TABBED CONTENT ══ */}
          <div>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {TABS.map(t => <button key={t.id} onClick={() => setActiveContentTab(t.id)} className={`tab-pill ${activeContentTab === t.id ? 'active' : ''}`}>{t.label}</button>)}
            </div>
            <div className="tab-enter" key={activeContentTab}>

              {/* Activity */}
              {activeContentTab === 'activity' && <div className="dark-feed"><SocialFeed username={username || ''} isOwnProfile={isOwnProfile} /></div>}

              {/* Friends */}
              {activeContentTab === 'friends' && (
                <div className="dark-feed"><div className="flat-card p-5"><Top8Friends username={username} /></div>
                  {profile && <div className="flat-card p-5 mt-4"><FollowingSection userId={profile.id} isOwnProfile={isOwnProfile} /></div>}
                  {profile?.isCreator && <div className="flat-card p-5 mt-4"><FollowersSection creatorId={profile.id} isOwnProfile={isOwnProfile} /></div>}
                </div>
              )}

              {/* Albums */}
              {activeContentTab === 'albums' && (
                <div className="flat-card p-5">
                  <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold flex items-center gap-2"><Camera className="w-4 h-4" style={{ color: 'var(--gold)' }} />Photo Albums</h3>{isOwnProfile && <button onClick={() => setShowCreateAlbumModal(true)} className="text-[11px] font-medium" style={{ color: 'var(--campfire)' }}>+ New Album</button>}</div>
                  {albums.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{albums.map(a => <Link key={a.id} to={a.link || `/albums/${a.id}`} className="group"><div className="aspect-square rounded-lg overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>{a.coverImage ? <img src={a.coverImage} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center"><Camera className="w-6 h-6" style={{ color: 'var(--muted)' }} /></div>}</div><p className="text-[11px] font-medium truncate">{a.title}</p></Link>)}</div>
                  : <div className="text-center py-8"><Camera className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--muted)' }} /><p className="text-[13px]" style={{ color: 'var(--muted)' }}>Your adventures, captured. Add your first photo.</p>{isOwnProfile && <button onClick={() => setShowCreateAlbumModal(true)} className="mt-3 px-5 py-2 rounded-full text-[12px] font-semibold" style={{ background: 'var(--campfire)', color: 'white' }}>Add Photos</button>}</div>}
                </div>
              )}

              {/* Trips */}
              {activeContentTab === 'trips' && (
                <div className="flat-card p-5 dark-feed">
                  <TripCalendarWidget compact={false} userId={profile.id} />
                </div>
              )}

              {/* Groups */}
              {activeContentTab === 'groups' && (
                <div className="flat-card p-5">
                  <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4" style={{ color: 'var(--gold)' }} />Groups</h3><Link to="/groups" className="text-[11px]" style={{ color: 'var(--gold-light)' }}>All Groups</Link></div>
                  {userGroups.length > 0 ? <div className="space-y-1.5">{userGroups.map(g => <Link key={g.id} to={`/groups/${g.slug || g.id}`} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/[0.03] transition">{g.imageUrl ? <img src={g.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.08)' }}><Users className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} /></div>}<div className="min-w-0"><p className="text-[12px] font-medium truncate">{g.name}</p><p className="text-[10px]" style={{ color: 'var(--muted)' }}>{g._count?.members || 0} members</p></div></Link>)}</div> : <p className="text-[12px] text-center py-4" style={{ color: 'var(--muted)' }}>No groups yet</p>}
                  {profile.isCreator && creatorContent.length > 0 && (
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><div className="p-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg,#8B5CF6,#EC4899)' }}><Video className="w-3.5 h-3.5 text-white" /></div><h3 className="text-sm font-bold">Creator Content</h3></div><Link to={`/creators/${profile.username}`} className="text-[11px] font-medium" style={{ color: '#A78BFA' }}>View All →</Link></div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{creatorContent.map((it: any) => <Link key={it.id} to={`/creators/${profile.username}`} className="group rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}><div className="aspect-video relative">{it.thumbnailUrl ? <img src={it.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Video className="w-6 h-6" style={{ color: '#A78BFA' }} /></div>}{it.contentType === 'VIDEO' && <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition"><Play className="w-8 h-8 text-white" /></div>}</div><div className="p-2"><p className="text-[11px] font-medium truncate">{it.title}</p></div></Link>)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Campgrounds */}
              {activeContentTab === 'campgrounds' && (
                <div className="flat-card p-5">
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Star className="w-4 h-4" style={{ color: 'var(--gold)' }} />Followed Campsites</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {favoriteCampgrounds.map(c => (
                      <Link key={c.id} to={`/campgrounds/${c.id}`} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/[0.03] transition">
                        {(c.imageUrl || c.photos?.[0]?.imageUrl) ? <img src={c.imageUrl || c.photos[0].imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)' }}><MapPin className="w-3.5 h-3.5" style={{ color: '#10B981' }} /></div>}
                        <div className="min-w-0"><p className="text-[12px] font-medium truncate">{c.name}</p><p className="text-[10px]" style={{ color: 'var(--muted)' }}>{c.location}, {c.state}</p></div>
                      </Link>
                    ))}
                  </div>
                  {profile && <div className="mt-4 pt-4 dark-feed" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}><FollowingSection userId={profile.id} isOwnProfile={isOwnProfile} /></div>}
                </div>
              )}

            </div>
          </div>

          {/* Admin claims queue */}
          {user && ['cmlpeyk82005s3qause3sws7y', 'cmm9kukta0006i88masvtz2tp'].includes(user.id) && isOwnProfile && (
            <details className="flat-card overflow-hidden"><summary className="px-5 py-3 cursor-pointer flex items-center gap-2 text-[12px]" style={{ background: 'rgba(232,98,42,0.05)' }}>Campground Claims <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-auto" style={{ background: 'rgba(232,98,42,0.15)', color: 'var(--campfire)' }}>Admin</span></summary><div className="p-4"><Suspense fallback={<div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} /></div>}><CampgroundClaimsQueue /></Suspense></div></details>
          )}
        </div>

        {/* ══ BADGES MODAL ══ */}
        {showBadgesModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowBadgesModal(false)}>
            <div className="hero-glass max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5"><h2 className="font-playfair text-xl font-bold">Achievements ({profileBadges.length})</h2><button onClick={() => setShowBadgesModal(false)}><X className="w-5 h-5" /></button></div>
              {profileBadges.filter(b => b.name === 'Founding Member').length > 0 && <><p className="text-[11px] font-semibold uppercase mb-3" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>Legacy Badges</p><div className="grid grid-cols-4 gap-4 mb-5">{profileBadges.filter(b => b.name === 'Founding Member').map(b => <div key={b.id} className="text-center"><div className="w-14 h-14 mx-auto rounded-full overflow-hidden mb-2 relative" style={{ border: '2px solid var(--gold)' }}><img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" /><div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[7px] font-bold whitespace-nowrap" style={{ background: 'var(--gold)', color: '#0F1C35' }}>LIMITED</div></div><p className="text-[10px] font-bold" style={{ color: '#F5F0E8' }}>{b.name}</p>{b.badgeNumber && <p className="text-[9px] mt-0.5" style={{ color: 'var(--gold)' }}>#{b.badgeNumber} of 5,000</p>}</div>)}</div></>}
              <p className="text-[11px] font-semibold uppercase mb-3" style={{ color: 'var(--muted)', letterSpacing: '0.1em' }}>Achievement Badges</p>
              <div className="grid grid-cols-4 gap-4">{profileBadges.filter(b => b.name !== 'Founding Member').map(b => <div key={b.id} className="text-center"><div className="w-12 h-12 mx-auto rounded-full overflow-hidden mb-1" style={{ border: '1px solid rgba(255,255,255,0.1)' }}><img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" /></div><p className="text-[10px]" style={{ color: 'var(--muted)' }}>{b.name}</p></div>)}</div>
            </div>
          </div>
        )}

        {/* ══ EDIT PROFILE MODAL ══ */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="hero-glass max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5 flex items-center justify-between sticky top-0 z-10" style={{ background: 'var(--navy)', borderBottom: '1px solid var(--glass-border)' }}><h2 className="font-playfair text-xl font-bold">Edit Profile</h2><button onClick={() => setShowEditModal(false)}><X className="w-5 h-5" /></button></div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>First Name</label><input type="text" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} /></div>
                  <div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Last Name</label><input type="text" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} /></div>
                </div>
                <div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Bio</label><textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} rows={4} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} /></div>
                <div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Zip Code</label><div className="flex gap-2"><input type="text" value={editForm.zipCode} onChange={e => { const z = e.target.value.replace(/\D/g, '').slice(0, 5); setEditForm({ ...editForm, zipCode: z }); if (z.length === 5) lookupZipCode(z); }} className="w-24 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} placeholder="12345" maxLength={5} /><input type="text" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} placeholder="City, State" readOnly={zipLoading} /></div>{zipLoading && <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>Looking up...</p>}{zipError && <p className="text-[11px] mt-1" style={{ color: 'var(--campfire)' }}>{zipError}</p>}</div>
                <div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Website</label><input type="url" value={editForm.website} onChange={e => setEditForm({ ...editForm, website: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} /></div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}><p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--gold)' }}>RV Details</p><div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Fuel Type</label><select value={editForm.rvFuelType} onChange={e => setEditForm({ ...editForm, rvFuelType: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}><option value="">Select</option><option value="gas">Gas</option><option value="diesel">Diesel</option></select></div><div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>MPG</label><input type="number" value={editForm.rvMpg} onChange={e => setEditForm({ ...editForm, rvMpg: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} placeholder="8" /></div></div></div>
                <div className="flex gap-3 pt-3"><button onClick={handleUpdateProfile} className="flex-1 py-2.5 rounded-full text-sm font-semibold" style={{ background: 'var(--gold)', color: 'var(--navy-deep)' }}>Save Changes</button><button onClick={() => setShowEditModal(false)} className="px-6 py-2.5 rounded-full text-sm" style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'var(--muted)' }}>Cancel</button></div>
              </div>
            </div>
          </div>
        )}

        {/* ══ CREATE ALBUM MODAL ══ */}
        {showCreateAlbumModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="hero-glass max-w-md w-full">
              <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--glass-border)' }}><h2 className="font-playfair text-xl font-bold">Create Album</h2><button onClick={() => setShowCreateAlbumModal(false)}><X className="w-5 h-5" /></button></div>
              <div className="p-6 space-y-4">
                <div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Title</label><input type="text" value={albumForm.title} onChange={e => setAlbumForm({ ...albumForm, title: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} /></div>
                <div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Description</label><textarea value={albumForm.description} onChange={e => setAlbumForm({ ...albumForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} /></div>
                <div><label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Privacy</label><select value={albumForm.privacy} onChange={e => setAlbumForm({ ...albumForm, privacy: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}><option value="PUBLIC">Public</option><option value="FRIENDS">Friends</option><option value="PRIVATE">Private</option></select></div>
                <div className="flex gap-3 pt-2"><button onClick={handleCreateAlbum} className="flex-1 py-2.5 rounded-full text-sm font-semibold" style={{ background: 'var(--gold)', color: 'var(--navy-deep)' }}>Create</button><button onClick={() => setShowCreateAlbumModal(false)} className="px-6 py-2.5 rounded-full text-sm" style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'var(--muted)' }}>Cancel</button></div>
              </div>
            </div>
          </div>
        )}

        {/* ══ RV SHOWCASE EDIT ══ */}
        {showRVShowcaseEdit && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"><div className="p-5 flex items-center justify-between sticky top-0 bg-white z-10" style={{ borderBottom: '1px solid #e5e7eb' }}><h2 className="text-xl font-bold text-gray-900">Edit RV Showcase</h2><button onClick={() => setShowRVShowcaseEdit(false)} className="text-gray-500"><X className="w-5 h-5" /></button></div><div className="p-6"><RVShowcaseEdit onSaved={() => { setShowRVShowcaseEdit(false); loadRVShowcase(); loadUserGroups(); loadPendingClaims(); }} /></div></div></div>
        )}

        {/* ══ RIG CARD ══ */}
        {showRigCard && profile && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowRigCard(false)}><div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}><div className="flex justify-center"><RigCard rig={{ firstName: profile.firstName, username: profile.username, rvYear: profile.rvYear, rvMake: profile.rvMake, rvModel: profile.rvModel, rvType: profile.rvType, rvLength: profile.rvLength, rvSleeps: profile.rvSleeps, rvSlideouts: profile.rvSlideouts, homeCity: profile.homeCity, homeState: profile.homeState, profilePicture: profile.profilePicture }} onSkip={() => setShowRigCard(false)} onPostToFeed={async (blob) => { try { const fd = new FormData(); fd.append('image', blob, 'rig-card.png'); fd.append('content', `Check out my rig! ${profile.rvYear || ''} ${profile.rvMake || ''} ${profile.rvModel || ''}`); await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setShowRigCard(false); } catch {} }} /></div></div></div>
        )}

      </div>
    </>
  );
}
