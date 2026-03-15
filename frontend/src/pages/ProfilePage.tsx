import { useState, useEffect } from 'react';
import DraggableBanner from '../components/DraggableBanner';
import CurrentlyAtBadge from '../components/CurrentlyAtBadge';
import CommunityTrustBadge from '../components/CommunityTrustBadge';
import HitchProfileSummary from '../components/HitchProfileSummary';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  User as UserIcon,
  MapPin,
  Link as LinkIcon,
  Calendar,
  Edit,
  Camera,
  Tent,
  Users,
  Star,
  X,
  Map,
  ChefHat,
  Backpack,
  UserPlus,
  UserCheck,
  Award,
  Video,
  BadgeCheck,
  Play
, Calendar } from 'lucide-react';
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



interface Profile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  coverPhoto?: string;
  bio?: string;
  location?: string;
  website?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  redditUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  blueskyUrl?: string;
  createdAt: string;
  rvType?: string;
  rvMake?: string;
  rvModel?: string;
  rvYear?: number;
  status?: string;
  statusEmoji?: string;
  statusType?: 'CUSTOM' | 'AUTO_CAMPING' | 'AUTO_HOME';
  currentCampsite?: string;
  _count?: {
    posts: number;
    friends: number;
  };
  isCreator?: boolean;
  creatorVerified?: boolean;
  creatorBio?: string;
  creatorSpecialties?: string[];
}


interface UserGroup {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  slug?: string;
  _count?: { members: number; };
  memberCount?: number;
}
interface ProfilePageProps {
  user: UserType | null;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<'NONE' | 'PENDING' | 'ACCEPTED'>('NONE');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileBadges, setProfileBadges] = useState<any[]>([]);
  const [displayedBadges, setDisplayedBadges] = useState<any[]>([]);
  const [badgePositions, setBadgePositions] = useState<{[key: string]: {x: number, y: number}}>({});
  const [draggingBadge, setDraggingBadge] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Save badge positions when they change
  const saveBadgePositions = async (positions: {[key: string]: {x: number, y: number}}) => {
    console.log('[Badge] Saving positions:', positions);
    try {
      const res = await api.put('/privacy/badge-position', { positions });
      console.log('[Badge] Save response:', res.data);
    } catch (err) {
      console.error('Failed to save badge positions:', err);
    }
  };
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
  
  // Data states
  const [albums, setAlbums] = useState<any[]>([]);
  const [favoriteCampgrounds, setFavoriteCampgrounds] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [rvShowcase, setRVShowcase] = useState<any>(null);
  const [coOwnedRVs, setCoOwnedRVs] = useState<any[]>([]);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [creatorContent, setCreatorContent] = useState<any[]>([]);
  const [creatorStats, setCreatorStats] = useState<any>(null);
  
  // Loading states
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  
  const [showRVShowcaseEdit, setShowRVShowcaseEdit] = useState(false);


const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    location: '',
    zipCode: '',
    website: '',
    profilePicture: '',
    coverPhoto: '',
    bannerPosition: '50% 50%',
  });
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState('');

  const lookupZipCode = async (zip: string) => {
    if (zip.length !== 5 || !/^\d+$/.test(zip)) {
      setZipError('');
      return;
    }
    
    try {
      setZipLoading(true);
      setZipError('');
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!response.ok) {
        setZipError('Invalid zip code');
        return;
      }
      const data = await response.json();
      const city = data.places[0]['place name'];
      const state = data.places[0]['state abbreviation'];
      setEditForm(prev => ({ ...prev, location: `${city}, ${state}` }));
    } catch (error) {
      setZipError('Could not lookup zip code');
    } finally {
      setZipLoading(false);
    }
  };


  const [albumForm, setAlbumForm] = useState({
    title: '',
    description: '',
    privacy: 'FRIENDS',
  });

  const isOwnProfile = user?.username === username || user?.id === username;
  const profileUsername = username || '';

  useEffect(() => {
    loadProfile();
    // loadAlbums called after profile loads
    loadFavoriteCampgrounds();
    loadRVShowcase();
    loadUserGroups();
    loadPendingClaims();
    loadCreatorContent();
  }, [username]);

  const loadCreatorContent = async () => {
    if (!username) return;
    try {
      // First get the profile to check if they're a creator
      const { data: profileData } = await api.get(`/profile/${username}`);
      if (profileData.isCreator) {
        const { data: contentData } = await api.get(`/creators/content/${profileData.id}`);
        setCreatorContent(Array.isArray(contentData) ? contentData.slice(0, 4) : []);
        
        // Try to get creator stats
        try {
          const { data: stats } = await api.get(`/creators/profile/${username}`);
          setCreatorStats(stats);
        } catch (e) {
          // Stats optional
        }
      }
    } catch (error) {
      console.error('Error loading creator content:', error);
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/profile/${username}`);
      setProfile(data);
      loadAlbums(data.id);
      setEditForm({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        bio: data.bio || '',
        location: data.location || '',
        website: data.website || '',
        profilePicture: data.profilePicture || '',
        coverPhoto: data.coverPhoto || '',
        bannerPosition: data.bannerPosition || '50% 50%',
      });
      if (user && !isOwnProfile && data.id) {
        checkFriendshipStatus(data.id);
      }
      // Load user badges
      try {
        // Extract co-owned RV data from profile
        if (data.rvCoOwnedBy && data.rvCoOwnedBy.length > 0) {
          setCoOwnedRVs(data.rvCoOwnedBy.map((c: any) => c.owner));
        }
        const badgeRes = await api.get(`/badges/user/${data.id}`);
        setProfileBadges(badgeRes.data?.badges || []);
        setDisplayedBadges((badgeRes.data?.badges || []).slice(0, 5));
        
        // Load badge positions
        const posRes = await api.get(`/privacy/badge-position/${data.id}`);
        if (posRes.data && posRes.data.positions) {
          setBadgePositions(posRes.data.positions);
        }
      } catch (err) {
        console.error('Failed to load badges:', err);
      }
    } catch (error) {
      console.error('Load profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlbums = async (profileId?: string) => {
    try {
      setLoadingAlbums(true);
      const { data } = await api.get(`/media-albums?userId=${profileId}`);
      setAlbums(data.slice(0, 6));
    } catch (error) {
      console.error('Load albums error:', error);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const loadFavoriteCampgrounds = async () => {
    try {
      setLoadingFavorites(true);
      const { data } = await api.get('/campgrounds/favorites/my');
      setFavoriteCampgrounds(data);
    } catch (error) {
      console.error('Load favorite campgrounds error:', error);
    } finally {
      setLoadingFavorites(false);
    }
  };

  const loadRVShowcase = async () => {
    try {
      const { data } = await api.get(`/rv-showcase/${username}`);
      setRVShowcase(data);
    } catch (error: any) {
      if (error.response?.status !== 404 && error.response?.status !== 403) {
        console.error('Load RV showcase error:', error);
      }
    }
  };

  const loadUserGroups = async () => {
    try {
      const { data } = await api.get(`/groups/my`);
      setUserGroups(data.groups || data || []);
    } catch (error) {
      console.error("Load user groups error:", error);
    }
  };

  const loadPendingClaims = async () => {
    if (user?.username !== "will") return;
    try {
      const { data } = await api.get("/campgrounds?verificationStatus=PENDING");
      setPendingClaims(data.campgrounds || data || []);
    } catch (error) {
      console.error("Load pending claims error:", error);
    }
  };

  const handleApproveClaim = async (campgroundId: string) => {
    try {
      await api.post(`/business/approve-claim/${campgroundId}`);
      alert("✅ Claim approved!");
      loadPendingClaims();
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to approve claim");
    }
  };

  const checkFriendshipStatus = async (profileId: string) => {
    try {
      const { data } = await api.get(`/friends/status/${profileId}`);
      setFriendshipStatus(data.status.toUpperCase());
      setFriendshipId(data.friendshipId);
      setIsInitiator(data.isInitiator);
    } catch (error) {
      console.error('Check friendship status error:', error);
    }
  };

  const handleFriendAction = async () => {
    try {
      if (!profile) return;

      if (friendshipStatus === 'NONE') {
        await api.post('/friends/request', { friendId: profile.id });
        alert('Friend request sent! 🎉');
        await checkFriendshipStatus(profile.id);
      } else if (friendshipStatus === 'PENDING' && !isInitiator) {
        if (friendshipId) {
          await api.put(`/friends/accept/${friendshipId}`);
          alert('Friend request accepted! 🎉');
          await checkFriendshipStatus(profile.id);
          await loadProfile();
        }
      } else if (friendshipStatus === 'ACCEPTED' || (friendshipStatus === 'PENDING' && isInitiator)) {
        if (friendshipId) {
          const confirmMessage = friendshipStatus === 'ACCEPTED' 
            ? 'Remove this friend?' 
            : 'Cancel friend request?';
          if (confirm(confirmMessage)) {
            await api.delete(`/friends/${friendshipId}`);
            alert(friendshipStatus === 'ACCEPTED' ? 'Friend removed' : 'Request canceled');
            await checkFriendshipStatus(profile.id);
            await loadProfile();
          }
        }
      }
    } catch (error) {
      console.error('Friend action error:', error);
      alert('Failed to perform action');
    }
  };

  const getFriendButtonText = () => {
    if (friendshipStatus === 'NONE') return 'Add Friend';
    if (friendshipStatus === 'PENDING' && isInitiator) return 'Request Pending';
    if (friendshipStatus === 'PENDING' && !isInitiator) return 'Accept Request';
    if (friendshipStatus === 'ACCEPTED') return 'Friends';
    return 'Add Friend';
  };

  const getFriendButtonIcon = () => {
    if (friendshipStatus === 'ACCEPTED') return <UserCheck className="w-4 h-4" />;
    return <UserPlus className="w-4 h-4" />;
  };

  const handleUpdateProfile = async () => {
    try {
      await api.put(`/profile/${username}`, editForm);
      setShowEditModal(false);
      await loadProfile();
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Update profile error:', error);
      alert('Failed to update profile');
    }
  };

  const handleCreateAlbum = async () => {
    try {
      const { data: newAlbum } = await api.post("/media-albums", albumForm);
      setShowCreateAlbumModal(false);
      setAlbumForm({ title: '', description: '', privacy: 'FRIENDS' });
      loadAlbums(profile?.id)
      navigate(`/albums/${newAlbum.id}`);
    } catch (error) {
      console.error('Create album error:', error);
      alert('Failed to create album');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-600">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover Image */}
      <div 
        className="badge-container h-48 sm:h-64 md:h-80 bg-gradient-to-br from-green-400 to-blue-500 relative"
      >
        {profile.coverPhoto && (
          <DraggableBanner
            imageUrl={profile.coverPhoto}
            altText="Cover"
            position={profile.bannerPosition || '50% 50%'}
            canEdit={isOwnProfile}
            onPositionChange={async (pos) => {
              try {
                await api.put('/profile', { bannerPosition: pos });
                setProfile(prev => prev ? { ...prev, bannerPosition: pos } : prev);
              } catch {}
            }}
            className="w-full h-full"
          />
        )}
        {isOwnProfile && (
          <ProfilePhotoUpload
            currentPhoto={profile.coverPhoto}
            type="cover"
            onUploadSuccess={loadProfile}
          />
        )}
        {/* Profile Badges Display */}
        {displayedBadges.map((badge, index) => (
          <div
            key={badge.id}
            className="absolute group z-10 select-none"
            style={{ 
              bottom: badgePositions[badge.id]?.y ?? (12 + index * 10),
              right: badgePositions[badge.id]?.x ?? (12 + index * 100),
              cursor: isOwnProfile ? (draggingBadge === badge.id ? 'grabbing' : 'grab') : 'default'
            }}
            onMouseDown={(e) => {
              console.log('[Badge] MouseDown on badge', badge.id, 'isOwnProfile:', isOwnProfile);
              if (!isOwnProfile) return;
              e.preventDefault();
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              setDraggingBadge(badge.id);
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const parent = document.querySelector('.badge-container');
                console.log('[Badge] MouseMove, parent found:', !!parent);
                if (!parent) return;
                const parentRect = parent.getBoundingClientRect();
                const newX = Math.max(10, Math.min(parentRect.width - 100, parentRect.right - moveEvent.clientX - 40));
                const newY = Math.max(10, Math.min(parentRect.height - 100, parentRect.bottom - moveEvent.clientY - 40));
                setBadgePositions(prev => ({ ...prev, [badge.id]: { x: newX, y: newY } }));
              };
              
              const handleMouseUp = () => {
                setDraggingBadge(null);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                // Save after drag ends
                setBadgePositions(prev => {
                  saveBadgePositions(prev);
                  return prev;
                });
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
            title={badge.name}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white hover:scale-110 transition-transform">
              <img
                src={badge.imageUrl}
                alt={badge.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
              {badge.name}
            </div>
          </div>
        ))}
      </div>

      {/* Profile Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-white rounded-b-lg shadow-lg -mt-16 mb-6">
          <div className="px-4 sm:px-6 py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
              {/* Profile Picture */}
              <div className="relative -mt-20 sm:-mt-24">
                {isOwnProfile ? (
                  <ProfilePhotoUpload
                    currentPhoto={profile.profilePicture}
                    type="profile"
                    onUploadSuccess={loadProfile}
                  />
                ) : (
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white bg-gray-200 overflow-hidden shadow-xl">
                    {profile.profilePicture ? (
                      <img
                        src={`${profile.profilePicture}`}
                        alt={profile.firstName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600">
                        <UserIcon className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate flex items-center gap-2">
                  {profile.firstName} {profile.lastName}
                  {profile.isCreator && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-full">
                      <Video className="w-3 h-3" />
                      Creator
                      {profile.creatorVerified && <BadgeCheck className="w-3 h-3" />}
                    </span>
                  )}
                </h1>
                <p className="text-gray-600">@{profile.username}</p>
              <div className="mt-2 space-y-2">
                <CurrentlyAtBadge userId={profile.id} isOwnProfile={isOwnProfile} />
                <CommunityTrustBadge userId={profile.id} />
              </div>
                
                {/* Creator Page Link */}
                {profile.isCreator && (
                  <Link
                    to={`/creators/${profile.username}`}
                    className="inline-flex items-center gap-1 mt-2 text-sm text-purple-600 hover:text-purple-800 font-medium"
                  >
                    <Play className="w-4 h-4" />
                    View Creator Page
                  </Link>
                )}

                {/* User Status */}
                <div className="mt-3">
                  <UserStatus 
                    profile={{
                      id: profile.id,
                      username: profile.username,
                      status: profile.status,
                      statusEmoji: profile.statusEmoji,
                      statusType: profile.statusType,
                      currentCampsite: profile.currentCampsite,
                    }}
                    isOwnProfile={isOwnProfile}
                    onUpdate={loadProfile}
                  />
                </div>

                {/* RV Info */}
                {(profile.rvMake || profile.rvType) && (
                  <div className="flex items-center gap-2 mt-2 text-gray-700">
                    <Tent className="w-4 h-4" />
                    <span className="text-sm">
                      {profile.rvYear && `${profile.rvYear} `}
                      {profile.rvMake} {profile.rvModel}
                      {profile.rvType && ` - ${profile.rvType}`}
                    </span>
                  </div>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-4 sm:gap-6 mt-4 text-sm">
                  <div>
                    <span className="font-bold text-gray-900">{profile._count?.posts || 0}</span>
                    <span className="text-gray-600 ml-1">Posts</span>
                  </div>
                  <Link to={`/profile/${username}/friends`}>
                    <span className="font-bold text-gray-900">{profile._count?.friends || 0}</span>
                    <span className="text-gray-600 ml-1">Friends</span>
                  </Link>
                </div>

                {profile.bio && (
                  <p className="text-gray-700 mt-4 whitespace-pre-wrap">{profile.bio}</p>
                )}
                {username && <div className="mt-4"><HitchProfileSummary username={username} /></div>}


                {/* Location & Website */}
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                  {profile.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{profile.location}</span>
                    </div>
                  )}

                  {profile.website && (
                  <a  
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
                    >
                      <LinkIcon className="w-4 h-4" />
                      <span>Website</span>
                    </a>
                  )}

                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              {/* Social Links Icons */}
              {(profile.showSocialOnProfile !== false && (profile.website || profile.facebookUrl || profile.instagramUrl || profile.twitterUrl || profile.youtubeUrl || profile.tiktokUrl || profile.blueskyUrl || profile.redditUrl)) && (
                <div className="flex items-center gap-3 mb-3">
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-600 transition">
                      <LinkIcon className="w-5 h-5" />
                    </a>
                  )}
                  {profile.facebookUrl && (
                    <a href={profile.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-600 transition">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                  )}
                  {profile.instagramUrl && (
                    <a href={profile.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-pink-600 transition">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </a>
                  )}
                  {profile.twitterUrl && (
                    <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-400 transition">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                  )}
                  {profile.youtubeUrl && (
                    <a href={profile.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-600 transition">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    </a>
                  )}
                  {profile.tiktokUrl && (
                    <a href={profile.tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-black transition">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                    </a>
                  )}
                  {profile.blueskyUrl && (
                    <a href={profile.blueskyUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-500 transition">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>
                    </a>
                  )}
                  {profile.redditUrl && (
                    <a href={profile.redditUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-orange-600 transition">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                    </a>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 w-full sm:w-auto items-center">
              {/* Block/Actions Menu - only show for other users */}
              {!isOwnProfile && profile && (
               <UserActionsMenu 
                userId={profile.id}
                username={profile.username}
                onBlock={() => navigate('/basecamp')}
                />
               )}


                {/* Recipe Box Icon */}
                <Link
                  to={`/profile/${username}/recipes`}
                  className="btn btn-secondary p-2 flex items-center justify-center"
                  title="Recipe Box"
                >
                  <ChefHat className="w-5 h-5" />
                </Link>

                {/* Gear List Icon */}
                <Link
                  to={`/profile/${username}/gear`}
                  className="btn btn-secondary p-2 flex items-center justify-center"
                  title="Gear List"
                >
                  <Backpack className="w-5 h-5" />
                </Link>

                {isOwnProfile ? (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="btn btn-secondary flex-1 sm:flex-initial flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Profile
                  </button>
                ) : (
                  <button
                    onClick={handleFriendAction}
                    className={`btn flex-1 sm:flex-initial flex items-center justify-center gap-2 ${
                      friendshipStatus === 'ACCEPTED' ? 'btn-secondary' : 'btn-primary'
                    }`}
                  >
                    {getFriendButtonIcon()}
                    {getFriendButtonText()}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>



        {/* Admin: Pending Claims (only for will) */}
        {user?.username === "will" && pendingClaims.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2">
              <span>⏳</span> Pending Campground Claims ({pendingClaims.length})
            </h3>
            <div className="space-y-3">
              {pendingClaims.map((claim: any) => (
                <div key={claim.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{claim.name}</p>
                    <p className="text-sm text-gray-600">{claim.location}, {claim.state}</p>
                    <p className="text-xs text-gray-500 mt-1">Email: {claim.businessEmail || "N/A"} | Phone: {claim.businessPhone || "N/A"}</p>
                  </div>
                  <button onClick={() => handleApproveClaim(claim.id)} className="btn btn-sm bg-green-600 hover:bg-green-700 text-white">Approve</button>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Creator Content Section */}
        {profile.isCreator && creatorContent.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Creator Content</h2>
                  <p className="text-sm text-gray-600">
                    {creatorStats?._count?.creatorContent || creatorContent.length} pieces of content
                    {creatorStats?._count?.creatorFollowers > 0 && ` • ${creatorStats._count.creatorFollowers} followers`}
                  </p>
                </div>
              </div>
              <Link
                to={`/creators/${profile.username}`}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all flex items-center gap-2"
              >
                View All
                <Play className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {creatorContent.map((item: any) => (
                <Link
                  key={item.id}
                  to={`/creators/${profile.username}`}
                  className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <div className="aspect-video bg-gray-100 relative">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                        <Video className="w-8 h-8 text-purple-400" />
                      </div>
                    )}
                    {item.contentType === 'VIDEO' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-10 h-10 text-white" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                        {item.contentType}
                      </span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.viewCount || 0} views</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ROW 1: Top 8 | Photo Albums | Groups */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Top 8 Friends */}
      <Top8Friends username={username} />

          {/* Photo Albums */}
                    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Camera className="w-5 h-5 mr-2 text-pink-600" />
                        Photo Albums
                      </h2>
                      {loadingAlbums ? (
                        <div className="text-center py-8">
                          <p className="text-gray-600 text-sm">Loading...</p>
                        </div>
                      ) : albums.length > 0 ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {albums.slice(0, 4).map((album) => (
                              <Link
                                key={album.id}
                                to={`/media-albums/${album.id}`}
                                className="aspect-square bg-gray-100 rounded overflow-hidden hover:opacity-90 transition"
                              >
                                {album.previewMedia && album.previewMedia[0] ? (
                                  <img
                                    src={album.previewMedia[0].thumbnailUrl || album.previewMedia[0].url}
                                    alt={album.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Camera className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                              </Link>
                            ))}
                          </div>
                          <Link
                            to={`/media-albums?userId=${profile?.id}`}
                            className="text-sm text-primary-600 hover:text-primary-700 block text-center"
                          >
                            View all albums →
                          </Link>
                        </div>
                      ) : (
                        <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                          <img 
                            src="/images/add_photoalbum_badge.jpeg" 
                            alt="Add photo albums" 
                            className="w-full h-full object-cover"
                          />
                          {isOwnProfile && (
                            <button
                              onClick={() => setShowCreateAlbumModal(true)}
                              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition"
                            >
                              <span className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                Add Photos
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

          {/* Groups */}
                      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 flex-1">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500" />
                            Groups
                          </h2>
                          <Link to="/groups" className="text-blue-500 hover:text-blue-600 text-sm">
                            All Groups
                          </Link>
                        </div>
                        {userGroups.length === 0 ? (
                          <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                            <img 
                              src="/images/Find_Your_Herd_Default_Poppy.png" 
                              alt="Find your herd" 
                              className="w-full h-full object-cover"
                            />
                            <Link
                              to="/groups"
                              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition"
                            >
                              <span className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                Find Your Herd
                              </span>
                            </Link>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {userGroups.slice(0, 4).map((group) => (
                              <Link
                                key={group.id}
                                to={`/groups/${group.slug || group.id}`}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors group"
                              >
                                {group.imageUrl ? (
                                  <img
                                    src={group.imageUrl.startsWith("http") ? group.imageUrl : `${group.imageUrl}`}
                                    alt={group.name}
                                    className="w-10 h-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-500" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-800 text-sm truncate group-hover:text-blue-600">
                                    {group.name}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {group._count?.members || group.memberCount || 0} members
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
        </div>

        {/* ROW 2: Followed Campsites | Following Creators | Calendar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Followed Campgrounds */}
                      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
                          <Star className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-yellow-500" />
                          Followed Campsites
                        </h2>
                        {loadingFavorites ? (
                          <div className="text-center py-8">
                            <p className="text-gray-600">Loading...</p>
                          </div>
                        ) : favoriteCampgrounds.length > 0 ? (
                          <div className="space-y-2">
                            {favoriteCampgrounds.slice(0, 5).map((campground) => (
                              <Link
                                key={campground.id}
                                to={`/campgrounds/${campground.id}`}
                                className="border border-gray-200 rounded-lg p-3 hover:shadow-lg transition group block"
                              >
                                <div className="flex items-start gap-3">
                                  {(campground.imageUrl || campground.photos?.[0]?.imageUrl) ? (
                                    <img
                                      src={campground.imageUrl || campground.photos[0].imageUrl}
                                      alt={campground.name}
                                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center flex-shrink-0">
                                      <MapPin className="w-5 h-5 text-green-600" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm text-gray-900 group-hover:text-primary-600 truncate">
                                      {campground.name}
                                    </h3>
                                    <p className="text-xs text-gray-600 truncate">
                                      {campground.location}, {campground.state}
                                    </p>
                                  </div>
                                </div>
                              </Link>
                            ))}
                            {favoriteCampgrounds.length > 5 && (
                              <Link
                                to="/campgrounds"
                                className="text-sm text-primary-600 hover:text-primary-700 block text-center pt-2"
                              >
                                View all {favoriteCampgrounds.length} campgrounds →
                              </Link>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-600">
                            <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-sm">No followed campgrounds yet</p>
                            {isOwnProfile && (
                              <Link to="/campgrounds" className="btn btn-primary mt-3 inline-block text-sm">
                                Browse Campgrounds
                              </Link>
                            )}
                          </div>
                        )}
                      </div>

          {/* Following Creators */}
                      {profile && (
                        <FollowingSection
                          userId={profile.id}
                          isOwnProfile={isOwnProfile}
                          className="flex-1"
                        />
                      )}
          
                      {/* Creator Followers */}
                      {profile?.isCreator && (
                        <FollowersSection
                          creatorId={profile.id}
                          isOwnProfile={isOwnProfile}
                          className="flex-1"
                        />
                      )}
          {/* Calendar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <TripCalendarWidget compact={true} userId={profile?.id} />
          </div>
        </div>

        {/* ROW 3: Travel Map (full width) */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center">
                <Map className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-primary-600" />
                Travel Map
              </h2>
              <Link to={`/map/${username}`} className="text-sm text-primary-600 hover:text-primary-700">
                View Full Map →
              </Link>
            </div>
            {profile && (
              <TravelMap userId={profile.id} isOwnProfile={isOwnProfile} />
            )}
          </div>
        </div>

        {/* SOCIAL FEED / ACTIVITY WALL */}
        <div className="mb-6">
          <SocialFeed username={username || ''} isOwnProfile={isOwnProfile} />
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 sm:p-6 rounded-t-lg sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold">Edit Profile</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={4}
                  className="input w-full"
                  placeholder="Tell us about yourself..."
                />
              </div>


<div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zip Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editForm.zipCode}
                    onChange={(e) => {
                      const zip = e.target.value.replace(/\D/g, '').slice(0, 5);
                      setEditForm({ ...editForm, zipCode: zip });
                      if (zip.length === 5) {
                        lookupZipCode(zip);
                      }
                    }}
                    className="input w-24"
                    placeholder="12345"
                    maxLength={5}
                  />
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="input flex-1"
                    placeholder="City, State"
                    readOnly={zipLoading}
                  />
                </div>
                {zipLoading && <p className="text-sm text-gray-500 mt-1">Looking up zip code...</p>}
                {zipError && <p className="text-sm text-red-500 mt-1">{zipError}</p>}
              </div>


               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  className="input w-full"
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={handleUpdateProfile} className="btn btn-primary flex-1">
                  Save Changes
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Album Modal */}
      {showCreateAlbumModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Create Album</h2>
                <button
                  onClick={() => setShowCreateAlbumModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Album Title
                </label>
                <input
                  type="text"
                  value={albumForm.title}
                  onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })}
                  className="input w-full"
                  placeholder="Summer 2024 Adventures"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={albumForm.description}
                  onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value })}
                  rows={3}
                  className="input w-full"
                  placeholder="Describe your album..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Privacy
                </label>
                <select
                  value={albumForm.privacy}
                  onChange={(e) => setAlbumForm({ ...albumForm, privacy: e.target.value })}
                  className="input w-full"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="FRIENDS">Friends Only</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={handleCreateAlbum} className="btn btn-primary flex-1">
                  Create Album
                </button>
                <button
                  onClick={() => setShowCreateAlbumModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RV Showcase Edit Modal */}
      {showRVShowcaseEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 sm:p-6 rounded-t-lg sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold">Edit RV Showcase</h2>
                <button
                  onClick={() => setShowRVShowcaseEdit(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <RVShowcaseEdit
                onSaved={() => {
                  setShowRVShowcaseEdit(false);
                  loadRVShowcase();
    loadUserGroups();
    loadPendingClaims();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
