import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import EventPhotoTitle from '../components/EventPhotoTitle';
import DraggableBanner from '../components/DraggableBanner';
import CurrentlyAtBadge from '../components/CurrentlyAtBadge';
import CommunityTrustBadge from '../components/CommunityTrustBadge';
import HitchProfileSummary from '../components/HitchProfileSummary';
import CampMarketProfile from '../components/CampMarketProfile';
import RigCard from '../components/RigCard';
import { CampfireContributorStats } from '../components/CampfireTips';
const CampgroundClaimsQueue = lazy(() => import('../components/admin/CampgroundClaimsQueue'));
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Plus, User as UserIcon, MapPin, Link as LinkIcon, Edit, Camera, Tent, Users,
  Star, X, Map, ChefHat, Backpack, UserPlus, UserCheck, Award, Video, BadgeCheck,
  Play, Calendar
} from 'lucide-react';
import api from '../services/api';
import TripCalendarWidget from '../components/TripCalendarWidget';
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

// ── Interfaces ───────────────────────────────────────────────────────────────
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

// ── InView hook ──────────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ── Animated counter ─────────────────────────────────────────────────────────
function AnimatedStat({ value, label, icon }: { value: number; label: string; icon: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView();
  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setCount(value); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, value]);

  return (
    <div ref={ref} className="text-center">
      <span className="text-2xl mb-1 block">{icon}</span>
      <span className="font-playfair text-3xl md:text-4xl font-bold block" style={{ color: 'var(--gold)' }}>{count.toLocaleString()}</span>
      <span className="text-xs mt-1 block" style={{ color: 'var(--muted)' }}>{label}</span>
    </div>
  );
}

// ── Social icon SVGs (compact) ───────────────────────────────────────────────
const SocialIcon = ({ url, children }: { url: string; children: React.ReactNode }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:opacity-80" style={{ color: 'var(--gold-light)' }}>{children}</a>
);

// ═════════════════════════════════════════════════════════════════════════════
// PROFILE PAGE
// ═════════════════════════════════════════════════════════════════════════════
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

  const saveBadgePositions = async (positions: {[key: string]: {x: number, y: number}}) => {
    try { await api.put('/privacy/badge-position', { positions }); } catch (err) { console.error('Failed to save badge positions:', err); }
  };
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

  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', bio: '', location: '', zipCode: '', website: '',
    profilePicture: '', coverPhoto: '', bannerPosition: '50% 50%',
    rvMpg: '' as string | number, rvFuelType: '',
  });
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState('');

  const lookupZipCode = async (zip: string) => {
    if (zip.length !== 5 || !/^\d+$/.test(zip)) { setZipError(''); return; }
    try {
      setZipLoading(true); setZipError('');
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!response.ok) { setZipError('Invalid zip code'); return; }
      const data = await response.json();
      setEditForm(prev => ({ ...prev, location: `${data.places[0]['place name']}, ${data.places[0]['state abbreviation']}` }));
    } catch { setZipError('Could not lookup zip code'); }
    finally { setZipLoading(false); }
  };

  const [albumForm, setAlbumForm] = useState({ title: '', description: '', privacy: 'FRIENDS' });
  const isOwnProfile = user?.username === username || user?.id === username;
  const profileUsername = username || '';

  // ── Section InView hooks ─────────────────────────────────────────────────
  const rigSection = useInView();
  const mapSection = useInView();
  const contentSection = useInView();

  useEffect(() => {
    loadProfile(); loadFavoriteCampgrounds(); loadRVShowcase(); loadUserGroups();
    loadPendingClaims(); loadCreatorContent();
  }, [username]);

  const loadCreatorContent = async () => {
    if (!username) return;
    try {
      const { data: profileData } = await api.get(`/profile/${username}`);
      if (profileData.isCreator) {
        const { data: contentData } = await api.get(`/creators/content/${profileData.id}`);
        setCreatorContent(Array.isArray(contentData) ? contentData.slice(0, 4) : []);
        try { const { data: stats } = await api.get(`/creators/profile/${username}`); setCreatorStats(stats); } catch {}
      }
    } catch (error) { console.error('Error loading creator content:', error); }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/profile/${username}`);
      setProfile(data); loadAlbums(data.id);
      setEditForm({
        firstName: data.firstName || '', lastName: data.lastName || '', bio: data.bio || '',
        location: data.location || '', website: data.website || '', profilePicture: data.profilePicture || '',
        coverPhoto: data.coverPhoto || '', bannerPosition: data.bannerPosition || '50% 50%',
      });
      if (user && !isOwnProfile && data.id) checkFriendshipStatus(data.id);
      api.get(`/rig-connection/co-pilot/${data.id}`).then(r => { if (r.data?.coPilot) setCoPilot(r.data.coPilot); }).catch(() => {});
      try {
        if (data.rvCoOwnedBy?.length > 0) setCoOwnedRVs(data.rvCoOwnedBy.map((c: any) => c.owner));
        const badgeRes = await api.get(`/badges/user/${data.id}`);
        setProfileBadges(badgeRes.data?.badges || []);
        setDisplayedBadges((badgeRes.data?.badges || []).slice(0, 3));
        const posRes = await api.get(`/privacy/badge-position/${data.id}`);
        if (posRes.data?.positions) setBadgePositions(posRes.data.positions);
      } catch {}
    } catch (error) { console.error('Load profile error:', error); }
    finally { setLoading(false); }
  };

  const loadAlbums = async (profileId?: string) => {
    try { setLoadingAlbums(true); const { data } = await api.get(`/media-albums?userId=${profileId}`); setAlbums(data.slice(0, 6)); }
    catch {} finally { setLoadingAlbums(false); }
  };
  const loadFavoriteCampgrounds = async () => {
    try { setLoadingFavorites(true); const { data } = await api.get('/campgrounds/favorites/my'); setFavoriteCampgrounds(data); }
    catch {} finally { setLoadingFavorites(false); }
  };
  const loadRVShowcase = async () => {
    try { const { data } = await api.get(`/rv-showcase/${username}`); setRVShowcase(data); }
    catch (e: any) { if (e.response?.status !== 404 && e.response?.status !== 403) console.error(e); }
  };
  const loadUserGroups = async () => {
    try { const { data } = await api.get('/groups/my'); setUserGroups(data.groups || data || []); } catch {}
  };
  const loadPendingClaims = async () => {
    if (user?.username !== 'will') return;
    try { const { data } = await api.get('/campgrounds?verificationStatus=PENDING'); setPendingClaims(data.campgrounds || data || []); } catch {}
  };
  const handleApproveClaim = async (campgroundId: string) => {
    try { await api.post(`/business/approve-claim/${campgroundId}`); alert('Claim approved!'); loadPendingClaims(); }
    catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
  };
  const checkFriendshipStatus = async (profileId: string) => {
    try { const { data } = await api.get(`/friends/status/${profileId}`); setFriendshipStatus(data.status.toUpperCase()); setFriendshipId(data.friendshipId); setIsInitiator(data.isInitiator); } catch {}
  };
  const handleFriendAction = async () => {
    try {
      if (!profile) return;
      if (friendshipStatus === 'NONE') { await api.post('/friends/request', { friendId: profile.id }); alert('Friend request sent!'); await checkFriendshipStatus(profile.id); }
      else if (friendshipStatus === 'PENDING' && !isInitiator && friendshipId) { await api.put(`/friends/accept/${friendshipId}`); alert('Friend request accepted!'); await checkFriendshipStatus(profile.id); await loadProfile(); }
      else if ((friendshipStatus === 'ACCEPTED' || (friendshipStatus === 'PENDING' && isInitiator)) && friendshipId) {
        if (confirm(friendshipStatus === 'ACCEPTED' ? 'Remove this friend?' : 'Cancel friend request?')) {
          await api.delete(`/friends/${friendshipId}`); await checkFriendshipStatus(profile.id); await loadProfile();
        }
      }
    } catch { alert('Failed to perform action'); }
  };
  const getFriendButtonText = () => {
    if (friendshipStatus === 'NONE') return 'Add Friend';
    if (friendshipStatus === 'PENDING' && isInitiator) return 'Pending';
    if (friendshipStatus === 'PENDING' && !isInitiator) return 'Accept';
    if (friendshipStatus === 'ACCEPTED') return 'Friends';
    return 'Add Friend';
  };
  const getFriendButtonIcon = () => friendshipStatus === 'ACCEPTED' ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />;
  const handleUpdateProfile = async () => {
    try { await api.put(`/profile/${username}`, editForm); setShowEditModal(false); await loadProfile(); alert('Profile updated!'); }
    catch { alert('Failed to update profile'); }
  };
  const handleCreateAlbum = async () => {
    try { const { data: newAlbum } = await api.post('/media-albums', albumForm); setShowCreateAlbumModal(false); setAlbumForm({ title: '', description: '', privacy: 'FRIENDS' }); loadAlbums(profile?.id); navigate(`/albums/${newAlbum.id}`); }
    catch { alert('Failed to create album'); }
  };

  // ── Loading / Not Found ──────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--navy-deep)' }}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--gold)' }} />
    </div>
  );
  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--navy-deep)', color: 'var(--muted)' }}>
      <p>Profile not found</p>
    </div>
  );

  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Tab pills
  const TABS = [
    { id: 'activity', label: 'Activity' },
    { id: 'photos', label: `Photos${albums.length ? ` (${albums.length})` : ''}` },
    { id: 'community', label: 'Community' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        :root { --navy:#1B2B4B; --navy-deep:#0F1A2E; --gold:#C9A84C; --gold-light:#E8C96A; --campfire:#E8622A; --campfire-glow:rgba(232,98,42,0.15); --ember:#F4A460; --cream:#FDF6E9; --muted:rgba(255,255,255,0.55); --glass:rgba(15,26,46,0.75); --glass-border:rgba(201,168,76,0.2); }
        .font-playfair { font-family: 'Playfair Display', serif; }
        .font-dm { font-family: 'DM Sans', sans-serif; }
        .glass-card { background:var(--glass); backdrop-filter:blur(12px); border:1px solid var(--glass-border); border-radius:16px; }
        .fade-up { opacity:0; transform:translateY(16px); transition:opacity 0.5s ease, transform 0.5s ease; }
        .fade-up.visible { opacity:1; transform:translateY(0); }
        @keyframes kenBurns { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
        @keyframes campfireGlow { 0%,100%{opacity:0.6} 50%{opacity:0.9} }
        .tab-pill { padding:6px 16px; border-radius:9999px; font-size:13px; font-weight:600; transition:all 0.2s; cursor:pointer; white-space:nowrap; }
        .tab-pill.active { background:var(--gold); color:var(--navy-deep); }
        .tab-pill:not(.active) { background:rgba(255,255,255,0.05); color:var(--muted); border:1px solid rgba(255,255,255,0.08); }
        .tab-pill:not(.active):hover { background:rgba(255,255,255,0.08); color:white; }
        .tab-content-enter { animation: tabFade 0.2s ease; }
        @keyframes tabFade { from{opacity:0} to{opacity:1} }
      `}</style>

      <div className="min-h-screen font-dm" style={{ background: 'var(--navy-deep)', color: 'white' }}>
        <Helmet>
          <title>{profile.firstName} {profile.lastName} (@{profile.username}) — RVUnicorn</title>
          <meta name="description" content={`Follow ${profile.firstName}'s RV adventures on RVUnicorn.${profile._count?.posts ? ` ${profile._count.posts} posts.` : ''}${profile._count?.friends ? ` ${profile._count.friends} friends.` : ''}`} />
          <meta property="og:title" content={`${profile.firstName} ${profile.lastName} — RVUnicorn`} />
          {profile.profilePicture && <meta property="og:image" content={profile.profilePicture} />}
        </Helmet>

        {/* ═══ HERO: COVER + IDENTITY ═══ */}
        <section className="relative">
          {/* Cover Photo */}
          <div className="badge-container h-52 sm:h-64 md:h-80 relative overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(232,98,42,0.12) 0%, transparent 60%), linear-gradient(135deg, var(--navy) 0%, var(--navy-deep) 100%)' }}>
            {profile.coverPhoto && (
              <DraggableBanner
                imageUrl={profile.coverPhoto} altText="Cover"
                position={profile.bannerPosition || '50% 50%'} canEdit={isOwnProfile}
                onPositionChange={async (pos) => { try { await api.put('/profile', { bannerPosition: pos }); setProfile(prev => prev ? { ...prev, bannerPosition: pos } : prev); } catch {} }}
                className="w-full h-full" style={{ animation: 'kenBurns 20s ease-in-out infinite' }}
              />
            )}
            {/* Bottom gradient overlay */}
            <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'linear-gradient(to top, var(--navy-deep), transparent)' }} />
            {/* Contextual status overlay */}
            <div className="absolute bottom-4 left-6 z-10 space-y-1">
              {profile.currentCampsite && (
                <p className="text-xs font-medium" style={{ color: 'var(--gold-light)' }}>{'\u{1F4CD}'} Currently at {profile.currentCampsite}</p>
              )}
            </div>
            {isOwnProfile && <ProfilePhotoUpload currentPhoto={profile.coverPhoto} type="cover" onUploadSuccess={loadProfile} />}

            {/* Draggable Badges on Cover */}
            {displayedBadges.map((badge, index) => (
              <div key={badge.id} className="absolute group z-10 select-none"
                style={{ bottom: badgePositions[badge.id]?.y ?? (12 + index * 10), right: badgePositions[badge.id]?.x ?? (12 + index * 100), cursor: isOwnProfile ? (draggingBadge === badge.id ? 'grabbing' : 'grab') : 'default' }}
                title={badge.name}
                onMouseDown={(e) => {
                  if (!isOwnProfile) return; e.preventDefault(); e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top }); setDraggingBadge(badge.id);
                  const handleMouseMove = (me: MouseEvent) => {
                    const parent = document.querySelector('.badge-container'); if (!parent) return;
                    const pr = parent.getBoundingClientRect();
                    setBadgePositions(prev => ({ ...prev, [badge.id]: { x: Math.max(10, Math.min(pr.width - 100, pr.right - me.clientX - 40)), y: Math.max(10, Math.min(pr.height - 100, pr.bottom - me.clientY - 40)) } }));
                  };
                  const handleMouseUp = () => { setDraggingBadge(null); document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); setBadgePositions(prev => { saveBadgePositions(prev); return prev; }); };
                  document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
                }}>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 shadow-xl hover:scale-110 transition-transform" style={{ borderColor: 'var(--gold)', background: 'var(--navy-deep)' }}>
                  <img src={badge.imageUrl} alt={badge.name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20" style={{ background: 'var(--navy)', color: 'var(--cream)' }}>{badge.name}</div>
              </div>
            ))}
          </div>

          {/* ═══ IDENTITY CARD ═══ */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-16 relative z-10">
            <div className="glass-card overflow-hidden" style={{ borderTop: '2px solid var(--gold)' }}>
              <div className="p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row gap-5">
                  {/* LEFT: Avatar + Identity */}
                  <div className="flex flex-col sm:flex-row items-start gap-4 flex-1 min-w-0">
                    <div className="relative -mt-14 sm:-mt-16 flex-shrink-0">
                      {isOwnProfile ? (
                        <ProfilePhotoUpload currentPhoto={profile.profilePicture} type="profile" onUploadSuccess={loadProfile} />
                      ) : (
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 shadow-2xl" style={{ borderColor: 'var(--gold)', background: 'var(--navy)' }}>
                          {profile.profilePicture
                            ? <img src={profile.profilePicture} alt={profile.firstName} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--campfire), var(--gold))' }}><UserIcon className="w-14 h-14 text-white" /></div>}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="font-playfair text-2xl font-bold">{profile.firstName} {profile.lastName}</h1>
                        {(profile as any).triviaTitle && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.25)' }}>{(profile as any).triviaTitle}</span>
                        )}
                        {profile.isCreator && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', color: 'white' }}>
                            <Video className="w-3 h-3" /> Creator {profile.creatorVerified && <BadgeCheck className="w-3 h-3" />}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>@{profile.username}</p>

                      {/* Status */}
                      <div className="mt-2">
                        <UserStatus profile={{ id: profile.id, username: profile.username, status: profile.status, statusEmoji: profile.statusEmoji, statusType: profile.statusType, currentCampsite: profile.currentCampsite }} isOwnProfile={isOwnProfile} onUpdate={loadProfile} />
                      </div>

                      <div className="mt-2 space-y-1">
                        <CurrentlyAtBadge userId={profile.id} isOwnProfile={isOwnProfile} />
                        <CommunityTrustBadge userId={profile.id} />
                      </div>

                      {/* RV Info compact */}
                      {(profile.rvMake || profile.rvType) && (
                        <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--cream)' }}>
                          <Tent className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
                          {profile.rvYear && `${profile.rvYear} `}{profile.rvMake} {profile.rvModel}{profile.rvType && ` · ${profile.rvType}`}
                        </div>
                      )}

                      {/* Action buttons inline */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {isOwnProfile ? (
                          <button onClick={() => setShowEditModal(true)} className="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition hover:brightness-110" style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}>
                            <Edit className="w-3.5 h-3.5" /> Edit Profile
                          </button>
                        ) : (
                          <button onClick={handleFriendAction} className="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition hover:brightness-110"
                            style={{ background: friendshipStatus === 'ACCEPTED' ? 'transparent' : 'var(--campfire)', color: 'white', border: friendshipStatus === 'ACCEPTED' ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                            {getFriendButtonIcon()} {getFriendButtonText()}
                          </button>
                        )}
                        {!isOwnProfile && profile && <UserActionsMenu userId={profile.id} username={profile.username} onBlock={() => navigate('/basecamp')} />}
                        <Link to={`/profile/${username}/recipes`} className="p-2 rounded-lg hover:bg-white/5 transition" style={{ border: '1px solid rgba(255,255,255,0.08)' }} title="Recipes"><ChefHat className="w-4 h-4" style={{ color: 'var(--gold)' }} /></Link>
                        <Link to={`/profile/${username}/gear`} className="p-2 rounded-lg hover:bg-white/5 transition" style={{ border: '1px solid rgba(255,255,255,0.08)' }} title="Gear"><Backpack className="w-4 h-4" style={{ color: 'var(--gold)' }} /></Link>
                        {isOwnProfile && profile.rvMake && <button onClick={() => setShowRigCard(true)} className="p-2 rounded-lg hover:bg-white/5 transition" style={{ border: '1px solid rgba(255,255,255,0.08)' }} title="Rig Card"><Award className="w-4 h-4" style={{ color: 'var(--gold)' }} /></button>}
                        {profile.isCreator && <Link to={`/creators/${profile.username}`} className="p-2 rounded-lg hover:bg-white/5 transition" style={{ border: '1px solid rgba(255,255,255,0.08)' }} title="Creator Page"><Play className="w-4 h-4" style={{ color: '#A78BFA' }} /></Link>}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Camping Stats */}
                  <div className="lg:w-72 flex-shrink-0">
                    <div className="grid grid-cols-2 gap-3">
                      <AnimatedStat icon={'\u{1F3D5}'} value={profile._count?.posts || 0} label="Nights Camped" />
                      <AnimatedStat icon={'\u{1F6E3}'} value={profile._count?.friends || 0} label="Friends" />
                      <AnimatedStat icon={'\u{1F4CD}'} value={favoriteCampgrounds.length} label="Campgrounds" />
                      <AnimatedStat icon={'\u{1F5FA}'} value={albums.length} label="Albums" />
                    </div>
                  </div>
                </div>
              </div>

              {/* About (collapsible) */}
              <div style={{ borderTop: '1px solid var(--glass-border)' }}>
                <button onClick={() => setShowAbout(!showAbout)} className="w-full px-5 py-2.5 flex items-center justify-between text-xs font-medium hover:bg-white/3 transition" style={{ color: 'var(--muted)' }}>
                  <span>About {profile.firstName}</span>
                  <span style={{ transform: showAbout ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>{'\u25BC'}</span>
                </button>
                {showAbout && (
                  <div className="px-5 pb-5 space-y-3 tab-content-enter">
                    {profile.bio && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--cream)' }}>{profile.bio}</p>}
                    <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                      {profile.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.location}</span>}
                      {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white"><LinkIcon className="w-3 h-3" />Website</a>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {joinDate}</span>
                    </div>
                    {coPilot && (
                      <Link to={`/profile/${coPilot.username}`} className="flex items-center gap-2 text-xs hover:opacity-80" style={{ color: 'var(--muted)' }}>
                        Co-pilot: {coPilot.profilePicture ? <img src={coPilot.profilePicture} className="w-4 h-4 rounded-full object-cover" alt="" /> : null}
                        <span className="font-medium" style={{ color: 'var(--cream)' }}>{coPilot.firstName} {coPilot.lastName}</span>
                      </Link>
                    )}
                    {(profile.facebookUrl || profile.instagramUrl || profile.twitterUrl || profile.youtubeUrl || profile.tiktokUrl) && (
                      <div className="flex items-center gap-3">
                        {profile.facebookUrl && <SocialIcon url={profile.facebookUrl}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></SocialIcon>}
                        {profile.instagramUrl && <SocialIcon url={profile.instagramUrl}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.332 0 8.74 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.332 23.986 8.74 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98C23.986 15.668 24 15.259 24 12c0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></SocialIcon>}
                        {profile.twitterUrl && <SocialIcon url={profile.twitterUrl}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></SocialIcon>}
                        {profile.youtubeUrl && <SocialIcon url={profile.youtubeUrl}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></SocialIcon>}
                        {profile.tiktokUrl && <SocialIcon url={profile.tiktokUrl}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></SocialIcon>}
                      </div>
                    )}
                    {username && <HitchProfileSummary username={username} />}
                    {profile?.id && <CampMarketProfile userId={profile.id} />}
                    {profile?.id && <CampfireContributorStats userId={profile.id} />}
                  </div>
                )}
              </div>

              {/* Badges + Social Proof row */}
              <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
                <div className="flex items-center gap-2">
                  {displayedBadges.slice(0, 3).map(b => (
                    <div key={b.id} className="w-8 h-8 rounded-full overflow-hidden border" style={{ borderColor: b.name === 'Founding Member' ? 'var(--gold)' : 'rgba(255,255,255,0.12)' }}>
                      <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" title={b.name} />
                    </div>
                  ))}
                  {profileBadges.length > 3 && <button onClick={() => setShowBadgesModal(true)} className="text-[11px] hover:underline" style={{ color: 'var(--gold-light)' }}>+{profileBadges.length - 3} more</button>}
                </div>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--muted)' }}>
                  <Link to={`/profile/${username}/friends`} className="hover:text-white">{profile._count?.friends || 0} friends</Link>
                  <span>{profile._count?.posts || 0} posts</span>
                  <span>Joined {joinDate}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ MAIN CONTENT ═══ */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-5 pb-10 space-y-5">

          {/* Admin: Pending Claims */}
          {user?.username === 'will' && pendingClaims.length > 0 && (
            <div className="glass-card p-5" style={{ borderColor: 'rgba(232,98,42,0.3)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--campfire)' }}>Pending Claims ({pendingClaims.length})</h3>
              <div className="space-y-2">
                {pendingClaims.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div><p className="font-semibold text-sm">{c.name}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{c.location}, {c.state}</p></div>
                    <button onClick={() => handleApproveClaim(c.id)} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: '#10B981', color: 'white' }}>Approve</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SECTION 3: TRAVEL MAP ═══ */}
          <div className="glass-card p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-playfair text-lg font-bold flex items-center gap-2"><Map className="w-4 h-4" style={{ color: 'var(--gold)' }} /> Where They've Been</h2>
              <Link to={`/map/${username}`} className="text-xs font-medium" style={{ color: 'var(--gold-light)' }}>Full Map →</Link>
            </div>
            <div style={{ maxHeight: '360px', overflow: 'hidden', borderRadius: '12px', background: 'var(--navy)' }}>
              {profile && <TravelMap userId={profile.id} isOwnProfile={isOwnProfile} profilePicture={profile.profilePicture} />}
            </div>
          </div>

          {/* ═══ FOLLOWED CAMPSITES (always visible) ═══ */}
          {favoriteCampgrounds.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Star className="w-4 h-4" style={{ color: 'var(--gold)' }} /> Followed Campsites</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {favoriteCampgrounds.slice(0, 8).map(cg => (
                  <Link key={cg.id} to={`/campgrounds/${cg.id}`} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/5 transition">
                    {(cg.imageUrl || cg.photos?.[0]?.imageUrl) ? <img src={cg.imageUrl || cg.photos[0].imageUrl} alt={cg.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}><MapPin className="w-3.5 h-3.5" style={{ color: '#10B981' }} /></div>}
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{cg.name}</p><p className="text-[10px]" style={{ color: 'var(--muted)' }}>{cg.location}, {cg.state}</p></div>
                  </Link>
                ))}
              </div>
              {favoriteCampgrounds.length > 8 && <Link to="/campgrounds" className="text-xs block text-center mt-2" style={{ color: 'var(--gold-light)' }}>View all {favoriteCampgrounds.length} →</Link>}
            </div>
          )}

          {/* ═══ SECTION 4: RIG SHOWROOM ═══ */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--gold)' }}>THEIR RIG</p>
              {isOwnProfile && <button onClick={() => setShowRVShowcaseEdit(true)} className="text-xs font-medium hover:underline" style={{ color: 'var(--gold-light)' }}>Edit</button>}
            </div>
            {rvShowcase && (rvShowcase.photos?.length > 0 || rvShowcase.videoUrl) ? (
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  {rvShowcase.videoUrl && <div className="aspect-video rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)' }}><video src={rvShowcase.videoUrl} controls className="w-full h-full object-cover" /></div>}
                  {rvShowcase.photos?.length > 0 && (
                    <div className={`grid gap-2 ${rvShowcase.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {rvShowcase.photos.map((photo: string, idx: number) => <img key={idx} src={photo} alt={`RV ${idx + 1}`} className="aspect-square object-cover rounded-xl hover:opacity-90 transition cursor-pointer" />)}
                    </div>
                  )}
                </div>
                <div>
                  {rvShowcase.title && <h3 className="font-playfair text-lg font-bold italic mb-1" style={{ color: 'var(--cream)' }}>{rvShowcase.title}</h3>}
                  {(profile.rvMake || profile.rvType) && <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>{profile.rvYear && `${profile.rvYear} `}{profile.rvMake} {profile.rvModel}</p>}
                  {profile.rvType && <span className="inline-block text-xs px-3 py-1 rounded-full mb-3" style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold-light)', border: '1px solid rgba(201,168,76,0.2)' }}>{profile.rvType}</span>}
                  {rvShowcase.description && <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{rvShowcase.description}</p>}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <span className="text-3xl mb-2 block">{'\u{1F699}'}</span>
                <p className="text-sm mb-1" style={{ color: 'var(--cream)' }}>Add your rig — it's the heart of your profile.</p>
                {isOwnProfile && <button onClick={() => setShowRVShowcaseEdit(true)} className="mt-2 px-5 py-2 rounded-full text-xs font-semibold" style={{ background: 'var(--campfire)', color: 'white' }}>Set Up My Rig</button>}
              </div>
            )}
          </div>

          {/* ═══ SECTION 5: CREATOR CONTENT ═══ */}
          {profile.isCreator && creatorContent.length > 0 && (
            <div className="glass-card p-5" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="p-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}><Video className="w-4 h-4 text-white" /></div><h3 className="text-sm font-bold">Creator Content</h3></div>
                <Link to={`/creators/${profile.username}`} className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1" style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', color: 'white' }}>View All <Play className="w-3 h-3" /></Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {creatorContent.map((item: any) => (
                  <Link key={item.id} to={`/creators/${profile.username}`} className="group rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="aspect-video relative">
                      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}><Video className="w-6 h-6" style={{ color: '#A78BFA' }} /></div>}
                      {item.contentType === 'VIDEO' && <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-8 h-8 text-white" /></div>}
                    </div>
                    <div className="p-2"><p className="text-[11px] font-medium truncate">{item.title}</p></div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SECTION 6: TABBED CONTENT ═══ */}
          <div>
            {/* Tab pills */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveContentTab(tab.id)} className={`tab-pill ${activeContentTab === tab.id ? 'active' : ''}`}>{tab.label}</button>
              ))}
            </div>

            {/* Tab content */}
            <div className="tab-content-enter" key={activeContentTab}>
              {activeContentTab === 'activity' && (
                <SocialFeed username={username || ''} isOwnProfile={isOwnProfile} />
              )}

              {activeContentTab === 'photos' && (
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold flex items-center gap-2"><Camera className="w-4 h-4" style={{ color: 'var(--gold)' }} /> Photo Albums</h3>
                    {isOwnProfile && <button onClick={() => setShowCreateAlbumModal(true)} className="text-xs font-medium" style={{ color: 'var(--campfire)' }}>+ New Album</button>}
                  </div>
                  {albums.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {albums.map(album => (
                        <Link key={album.id} to={`/media-albums/${album.id}`} className="group">
                          <div className="aspect-square rounded-lg overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            {album.previewMedia?.[0] ? <img src={album.previewMedia[0].thumbnailUrl || album.previewMedia[0].url} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center"><Camera className="w-6 h-6" style={{ color: 'var(--muted)' }} /></div>}
                          </div>
                          <p className="text-xs font-medium truncate">{album.title}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8"><Camera className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--muted)' }} /><p className="text-sm" style={{ color: 'var(--muted)' }}>Your adventures, captured. Add your first photo.</p>{isOwnProfile && <button onClick={() => setShowCreateAlbumModal(true)} className="mt-3 px-5 py-2 rounded-full text-xs font-semibold" style={{ background: 'var(--campfire)', color: 'white' }}>Add Photos</button>}</div>
                  )}
                </div>
              )}

              {activeContentTab === 'community' && (
                <div className="space-y-4">
                  {/* Friends */}
                  <div className="glass-card p-5">
                    <Top8Friends username={username} />
                  </div>

                  {/* Groups + Campgrounds side by side */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Groups */}
                    <div className="glass-card p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4" style={{ color: 'var(--gold)' }} /> Groups</h3>
                        <Link to="/groups" className="text-xs" style={{ color: 'var(--gold-light)' }}>All</Link>
                      </div>
                      {userGroups.length > 0 ? (
                        <div className="space-y-2">
                          {userGroups.slice(0, 5).map(g => (
                            <Link key={g.id} to={`/groups/${g.slug || g.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition">
                              {g.imageUrl ? <img src={g.imageUrl} alt={g.name} className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.1)' }}><Users className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} /></div>}
                              <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{g.name}</p><p className="text-[10px]" style={{ color: 'var(--muted)' }}>{g._count?.members || g.memberCount || 0} members</p></div>
                            </Link>
                          ))}
                        </div>
                      ) : <p className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>No groups yet</p>}
                    </div>

                    {/* Followed Campgrounds */}
                    <div className="glass-card p-5">
                      <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Star className="w-4 h-4" style={{ color: 'var(--gold)' }} /> Followed Campsites</h3>
                      {favoriteCampgrounds.length > 0 ? (
                        <div className="space-y-2">
                          {favoriteCampgrounds.slice(0, 5).map(cg => (
                            <Link key={cg.id} to={`/campgrounds/${cg.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition">
                              {(cg.imageUrl || cg.photos?.[0]?.imageUrl) ? <img src={cg.imageUrl || cg.photos[0].imageUrl} alt={cg.name} className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}><MapPin className="w-3.5 h-3.5" style={{ color: '#10B981' }} /></div>}
                              <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{cg.name}</p><p className="text-[10px]" style={{ color: 'var(--muted)' }}>{cg.location}, {cg.state}</p></div>
                            </Link>
                          ))}
                        </div>
                      ) : <p className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>No followed campgrounds</p>}
                    </div>
                  </div>

                  {/* Following / Followers / Calendar */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {profile && <FollowingSection userId={profile.id} isOwnProfile={isOwnProfile} className="flex-1" />}
                    {profile?.isCreator && <FollowersSection creatorId={profile.id} isOwnProfile={isOwnProfile} className="flex-1" />}
                    <div className="glass-card overflow-hidden"><TripCalendarWidget compact={true} userId={profile.id} /></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Admin: Claims Queue */}
          {user && ['cmlpeyk82005s3qause3sws7y', 'cmm9kukta0006i88masvtz2tp'].includes(user.id) && isOwnProfile && (
            <details className="glass-card overflow-hidden">
              <summary className="px-5 py-3 cursor-pointer flex items-center gap-2" style={{ background: 'rgba(232,98,42,0.08)' }}>
                <span className="text-xs">Campground Claims</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-auto" style={{ background: 'rgba(232,98,42,0.2)', color: 'var(--campfire)' }}>Admin</span>
              </summary>
              <div className="p-4"><Suspense fallback={<div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} /></div>}><CampgroundClaimsQueue /></Suspense></div>
            </details>
          )}
        </div>

        {/* ═══ BADGES MODAL ═══ */}
        {showBadgesModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowBadgesModal(false)}>
            <div className="glass-card max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-playfair text-xl font-bold">Achievements ({profileBadges.length})</h2>
                <button onClick={() => setShowBadgesModal(false)} className="p-1 hover:opacity-70"><X className="w-5 h-5" /></button>
              </div>
              {/* Legacy badges first */}
              {profileBadges.filter(b => b.name === 'Founding Member').length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: 'var(--gold)' }}>Legacy Badges</p>
                  <div className="grid grid-cols-4 gap-4">
                    {profileBadges.filter(b => b.name === 'Founding Member').map(b => (
                      <div key={b.id} className="text-center">
                        <div className="w-16 h-16 mx-auto rounded-full overflow-hidden border-2 mb-1" style={{ borderColor: 'var(--gold)' }}><img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" /></div>
                        <p className="text-xs font-medium">{b.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: 'var(--muted)' }}>Achievement Badges</p>
              <div className="grid grid-cols-4 gap-4">
                {profileBadges.filter(b => b.name !== 'Founding Member').map(b => (
                  <div key={b.id} className="text-center">
                    <div className="w-14 h-14 mx-auto rounded-full overflow-hidden border mb-1" style={{ borderColor: 'rgba(255,255,255,0.1)' }}><img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" /></div>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{b.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ EDIT PROFILE MODAL ═══ */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5 flex items-center justify-between sticky top-0 z-10" style={{ background: 'var(--navy)', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
                <h2 className="font-playfair text-xl font-bold">Edit Profile</h2>
                <button onClick={() => setShowEditModal(false)} className="hover:opacity-70"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>First Name</label><input type="text" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} /></div>
                  <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Last Name</label><input type="text" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} /></div>
                </div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Bio</label><textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} rows={4} placeholder="Tell us about yourself..." className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} /></div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Zip Code</label>
                  <div className="flex gap-2">
                    <input type="text" value={editForm.zipCode} onChange={e => { const z = e.target.value.replace(/\D/g, '').slice(0, 5); setEditForm({ ...editForm, zipCode: z }); if (z.length === 5) lookupZipCode(z); }} className="w-24 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} placeholder="12345" maxLength={5} />
                    <input type="text" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} placeholder="City, State" readOnly={zipLoading} />
                  </div>
                  {zipLoading && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Looking up...</p>}
                  {zipError && <p className="text-xs mt-1" style={{ color: 'var(--campfire)' }}>{zipError}</p>}
                </div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Website</label><input type="url" value={editForm.website} onChange={e => setEditForm({ ...editForm, website: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} placeholder="https://yourwebsite.com" /></div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: 'var(--gold)' }}>RV Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Fuel Type</label><select value={editForm.rvFuelType} onChange={e => setEditForm({ ...editForm, rvFuelType: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}><option value="">Select...</option><option value="gas">Gas</option><option value="diesel">Diesel</option></select></div>
                    <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>MPG</label><input type="number" min="1" max="50" step="0.1" value={editForm.rvMpg} onChange={e => setEditForm({ ...editForm, rvMpg: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} placeholder="e.g. 8" /></div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={handleUpdateProfile} className="flex-1 py-2.5 rounded-full text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: 'var(--navy-deep)' }}>Save Changes</button>
                  <button onClick={() => setShowEditModal(false)} className="px-6 py-2.5 rounded-full text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'var(--muted)' }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CREATE ALBUM MODAL ═══ */}
        {showCreateAlbumModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full">
              <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
                <h2 className="font-playfair text-xl font-bold">Create Album</h2>
                <button onClick={() => setShowCreateAlbumModal(false)} className="hover:opacity-70"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Album Title</label><input type="text" value={albumForm.title} onChange={e => setAlbumForm({ ...albumForm, title: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} placeholder="Summer Adventures" /></div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Description</label><textarea value={albumForm.description} onChange={e => setAlbumForm({ ...albumForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} /></div>
                <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Privacy</label><select value={albumForm.privacy} onChange={e => setAlbumForm({ ...albumForm, privacy: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}><option value="PUBLIC">Public</option><option value="FRIENDS">Friends Only</option><option value="PRIVATE">Private</option></select></div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleCreateAlbum} className="flex-1 py-2.5 rounded-full text-sm font-semibold" style={{ background: 'var(--gold)', color: 'var(--navy-deep)' }}>Create</button>
                  <button onClick={() => setShowCreateAlbumModal(false)} className="px-6 py-2.5 rounded-full text-sm" style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'var(--muted)' }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ RV SHOWCASE EDIT MODAL ═══ */}
        {showRVShowcaseEdit && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5 flex items-center justify-between sticky top-0 bg-white z-10" style={{ borderBottom: '1px solid #e5e7eb' }}>
                <h2 className="text-xl font-bold text-gray-900">Edit RV Showcase</h2>
                <button onClick={() => setShowRVShowcaseEdit(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6"><RVShowcaseEdit onSaved={() => { setShowRVShowcaseEdit(false); loadRVShowcase(); loadUserGroups(); loadPendingClaims(); }} /></div>
            </div>
          </div>
        )}

        {/* ═══ RIG CARD MODAL ═══ */}
        {showRigCard && profile && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowRigCard(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex justify-center">
                <RigCard
                  rig={{ firstName: profile.firstName, username: profile.username, rvYear: profile.rvYear, rvMake: profile.rvMake, rvModel: profile.rvModel, rvType: profile.rvType, rvLength: profile.rvLength, rvSleeps: profile.rvSleeps, rvSlideouts: profile.rvSlideouts, homeCity: profile.homeCity, homeState: profile.homeState, profilePicture: profile.profilePicture }}
                  onSkip={() => setShowRigCard(false)}
                  onPostToFeed={async (blob) => {
                    try { const fd = new FormData(); fd.append('image', blob, 'rig-card.png'); fd.append('content', `Check out my rig! ${profile.rvYear || ''} ${profile.rvMake || ''} ${profile.rvModel || ''}`); await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setShowRigCard(false); } catch {}
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
