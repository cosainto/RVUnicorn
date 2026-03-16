import NavigationButtons from '../components/NavigationButtons';
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Phone, Globe, Mail, Calendar, Bookmark, Users, ChevronLeft, Navigation, Leaf,
  Heart, Star, Camera, Award, Megaphone, Clock, X, Check, Plus, Upload, Map, Trash2, MessageSquare, Settings, Bell, BellOff, ExternalLink, UserPlus, MapPinned, Edit
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import LocationEventsCalendar from '../components/LocationEventsCalendar';
import DraggableBanner from '../components/DraggableBanner'; // keep
import CheckInButton from '../components/CheckInButton';
import HitchCampgroundChat from '../components/HitchCampgroundChat';
import CampgroundVibeCard from '../components/CampgroundVibeCard';
import CampersLikeYou from '../components/CampersLikeYou';
import HitchRigCheck from '../components/HitchRigCheck';
import CampgroundSecrets from '../components/CampgroundSecrets';
import RigStressScore from '../components/RigStressScore';
import AskTheCampfire from '../components/AskTheCampfire';
import RoastMode from '../components/RoastMode';
import SmartReviewForm from '../components/SmartReviewForm';
import CampgroundReportLeaderboard from '../components/CampgroundReportLeaderboard';
import PredictiveSiteSelector from '../components/PredictiveSiteSelector';
import RVHerdHereNow from '../components/RVHerdHereNow';
import CampgroundCommunity from '../components/CampgroundCommunity';
import CampfireChannel from '../components/CampfireChannel';
import CampgroundWeather from '../components/CampgroundWeather';
import { getCampspotUrl } from '../utils/campspot';
import CampspotBookButton from '../components/CampspotBookButton';
import ThingsToDoSection from '../components/ThingsToDoSection';
import CampgroundBadgeDisplay from "../components/CampgroundBadgeDisplay";
import CampgroundBadgeCreator from "../components/CampgroundBadgeCreator";
import HarvestHostsTab from '../components/HarvestHostsTab';

const ActionButton = ({ as = "button", href, onClick, icon, children, variant = "tertiary", ...rest }: any) => {
  const base = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const variants: Record<string, string> = {
    primary: "text-white hover:opacity-90",
    secondary: "bg-white/20 text-white backdrop-blur-sm hover:bg-white/30",
    tertiary: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    ghost: "bg-transparent hover:bg-black/5 text-white",
  };
  const cls = `${base} ${variants[variant]}`;
  if (as === "a") return <a className={cls} href={href} {...rest}>{icon}{children}</a>;
  return <button className={cls} onClick={onClick} {...rest}>{icon}{children}</button>;
};



const stripHtml = (html: string | null) => html?.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&") || "";

// Get booking URL - prioritize Campspot, fallback to bookingUrl
const getBookingUrl = (campground: { campspotSlug?: string; bookingUrl?: string }) => {
  if (campground.campspotSlug) {
    return getCampspotUrl(campground.campspotSlug);
  }
  return campground.bookingUrl || null;
};

const getBookingLabel = (campground: { campspotSlug?: string; bookingUrl?: string }) => {
  if (campground.campspotSlug) return 'Book on Campspot';
  if (campground.bookingUrl) return 'Book Now';
  return null;
};






interface Campground {
  id: string;
  name: string;
  description: string;
  location: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  amenities: string[];
  imageUrl: string | null;
  checkIns?: CheckIn[];
  stickers?: Sticker[];
  _count?: { followers: number; checkIns: number; stickers: number };
  verificationStatus?: string;
  claimedById?: string;
  claimedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  admins?: {
    id: string;
    role: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      profilePicture?: string;
    };
  }[];
  tier?: string;
  hashtag?: string;
  theme?: string;
  accentColor?: string;
  businessEmail?: string;
  businessPhone?: string;
  bookingUrl?: string;
  campspotSlug?: string;
  websiteUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  campgroundMapUrl?: string;
}

interface CheckIn {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  siteNumber: string | null;
  user: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null };
}

interface Sticker {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  imageUrl: string | null;
  _count?: { userStickers: number };
}

interface Review {
  id: string;
  rating: number;
  title: string | null;
  review: string | null;
  visitDate: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null };
}

interface Photo {
  id: string;
  imageUrl: string;
  caption: string | null;
  status: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null };
}

interface CampEvent {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  location: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  isPinned: boolean;
  priority: 'LOW' | 'NORMAL' | 'IMPORTANT' | 'URGENT';
  scheduledAt: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
}

interface CampThread {
  id: string;
  title: string;
  content: string | null;
  imageUrl?: string;
  slug: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null };
  _count: { posts: number };
}

const AMENITY_LABELS: Record<string, string> = {
  WIFI: '📶 WiFi', SHOWERS: '🚿 Showers', RESTROOMS: '🚻 Restrooms',
  ELECTRIC_HOOKUPS: '⚡ Electric', WATER_HOOKUPS: '💧 Water', SEWER_HOOKUPS: '🚰 Sewer',
  DUMP_STATION: '♻️ Dump Station', LAUNDRY: '👕 Laundry', CAMP_STORE: '🏪 Camp Store',
  RESTAURANT: '🍽️ Restaurant', PLAYGROUND: '🎪 Playground', POOL: '🏊 Pool',
  BEACH: '🏖️ Beach', BOAT_LAUNCH: '⛵ Boat Launch', FISHING: '🎣 Fishing',
  TRAILS: '🥾 Trails', CAMPING: '⛺ Camping',
};

const PUBLIC_TABS = ['overview', 'map', 'photos', 'reviews'];

const ALL_TABS = [
  { id: 'overview', label: 'Overview', icon: MapPin },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'amenities', label: 'Amenities', icon: Check },
  { id: 'campfire', label: '🔥 Campfire', icon: null },
  { id: 'threads', label: 'Threads', icon: MessageSquare },
  { id: 'news', label: 'News', icon: Megaphone },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'stickers', label: 'Stickers', icon: Award },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'vibe', label: '✨ Vibe', icon: null },
  { id: 'ask-hitch', label: '🦄 Ask Hitch', icon: null },
];

export default function CampgroundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userInterests = (user as any)?.campingInterests || [];

  const [campground, setCampground] = useState<Campground | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isFavorited, setIsFavorited] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const isSiteAdmin = ['wroberts82@yahoo.com'].includes(user?.email?.toLowerCase() || '');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<Photo[]>([]);
  const [events, setEvents] = useState<CampEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [featuredAnnouncements, setFeaturedAnnouncements] = useState<Announcement[]>([]);
  const [campgroundMapUrl, setCampgroundMapUrl] = useState<string | null>(null);
  const [threads, setThreads] = useState<CampThread[]>([]);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [claimData, setClaimData] = useState({ businessEmail: "", businessPhone: "" });
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [uploadingMap, setUploadingMap] = useState(false);

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [herdRefresh, setHerdRefresh] = useState(0);
  const [bannerPosition, setBannerPosition] = useState('50% 50%');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);

  const [checkInData, setCheckInData] = useState({ checkInDate: new Date().toISOString().split('T')[0], checkOutDate: '', siteNumber: '' });
  const [inWishlist, setInWishlist] = useState(false);
  const [campgroundBadges, setCampgroundBadges] = useState<{locationBadges: any[]; regionBadges: any[]; totalBadges: number}>({ locationBadges: [], regionBadges: [], totalBadges: 0 });
  const [reviewData, setReviewData] = useState({ rating: 0, title: '', review: '', visitDate: '' });
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [announcementData, setAnnouncementData] = useState({ title: '', content: '', isPinned: false, priority: 'NORMAL' as const, scheduledAt: '' });
  const [eventData, setEventData] = useState({ title: '', description: '', startDate: '', endDate: '', location: '' });

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); if (id) { loadCampground();
    // Check wishlist status
    if (user) {
      api.get(`/wishlist/check/${id}`).then(res => setInWishlist(res.data.inWishlist)).catch(() => {});
    } if (user) { checkIfFavorited(); checkIfAdmin();
    loadFeaturedAnnouncements(); checkIfMuted(); } } }, [id, user]);
  useEffect(() => { if (campground) loadTabData(); }, [campground, activeTab]);

  const loadCampground = async () => {
    try { setLoading(true); const { data } = await api.get(`/campgrounds/${id}`); setCampground(data);
        setBannerPosition(data.bannerPosition || '50% 50%');
      try { const badgeRes = await api.get(`/badges/campground/${id}`); setCampgroundBadges(badgeRes.data); } catch {} }
    catch { setCampground(null); } finally { setLoading(false); }
  };

  const loadTabData = async () => {
    if (!campground) return;
    try {
      if (activeTab === 'reviews') { const r = await api.get(`/campground-features/${campground.id}/reviews`); setReviews(r.data.reviews); setAvgRating(r.data.averageRating); }
      if (activeTab === 'photos') { const p = await api.get(`/campground-features/${campground.id}/photos`); setPhotos(p.data); if (isAdmin) { try { const pp = await api.get(`/campground-features/${campground.id}/photos/pending`); setPendingPhotos(pp.data); } catch {} } }
      if (activeTab === 'events') { const e = await api.get(`/campground-features/${campground.id}/events`); setEvents(e.data); }
      if (activeTab === 'news') { const n = await api.get(`/campground-features/${campground.id}/announcements`); setAnnouncements(n.data); }
      if (activeTab === 'map') { const m = await api.get(`/campground-features/${campground.id}/map`); setCampgroundMapUrl(m.data.mapUrl); }
      if (activeTab === 'threads') { const t = await api.get(`/threads?campgroundId=${campground.id}`); setThreads(t.data); }
    } catch {}
  };

  const checkIfFavorited = async () => { try { const { data } = await api.get(`/campgrounds/${id}/is-favorited`); setIsFavorited(data.isFavorited); } catch {} };
  const checkIfAdmin = async () => { try { const { data } = await api.get(`/campground-features/${id}/is-admin`); setIsAdmin(data.isAdmin); } catch {} };
  const loadFeaturedAnnouncements = async () => { 
    if (!id) return; 
    try { 
      const { data } = await api.get(`/campground-features/${id}/announcements/featured`); 
      setFeaturedAnnouncements(data); 
    } catch {} 
  };
  const checkIfMuted = async () => { if (!id || !user) return; try { const { data } = await api.get(`/mute/check/campground/${id}`); setIsMuted(data.isMuted); } catch {} };
  const toggleMute = async () => { if (!id || !user) return; try { if (isMuted) { await api.delete(`/mute/campground/${id}`); setIsMuted(false); } else { await api.post(`/mute/campground/${id}`); setIsMuted(true); } } catch (e: any) { alert(e.response?.data?.error || "Failed"); } };
  const handleToggleFavorite = async () => { if (!user) return; try { if (isFavorited) { await api.delete(`/campgrounds/${id}/favorite`); setIsFavorited(false); } else { await api.post(`/campgrounds/${id}/favorite`); setIsFavorited(true); } } catch {} };

  const toggleWishlist = async () => {
    if (!user || !campground) return;
    try {
      const { data } = await api.post(`/wishlist/${campground.id}/toggle`);
      setInWishlist(data.inWishlist);
    } catch (e) {
      console.error('Toggle wishlist error:', e);
    }
  };

  const handleCheckIn = async () => {
    if (!user || !campground) return;
    try { await api.post('/checkins', { campgroundId: campground.id, checkInDate: checkInData.checkInDate, checkOutDate: checkInData.checkOutDate || null, siteNumber: checkInData.siteNumber || null }); alert('✅ Checked in!'); setShowCheckInModal(false); loadCampground(); } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
  };

  const handleSubmitReview = async () => {
    if (!user || !campground || reviewData.rating === 0) return;
    try { await api.post(`/campground-features/${campground.id}/reviews`, reviewData); alert('✅ Review submitted!'); setShowReviewModal(false); setReviewData({ rating: 0, title: '', review: '', visitDate: '' }); loadTabData(); } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
  };

  const handleSubmitPhoto = async () => {
    if (!user || !campground || !photoFile) return;
    try { const fd = new FormData(); fd.append('photo', photoFile); fd.append('caption', photoCaption); await api.post(`/campground-features/${campground.id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); alert('✅ Photo submitted!'); setShowPhotoModal(false); setPhotoFile(null); setPhotoCaption(''); } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
  };

  const handleReviewPhoto = async (photoId: string, status: string) => { if (!campground) return; try { await api.put(`/campground-features/${campground.id}/photos/${photoId}/review`, { status }); loadTabData(); } catch {} };
  const handleSubmitAnnouncement = async () => { if (!user || !campground) return; try { await api.post(`/campground-features/${campground.id}/announcements`, announcementData); alert('✅ Posted!'); setShowAnnouncementModal(false); setAnnouncementData({ title: '', content: '', isPinned: false, priority: 'NORMAL', scheduledAt: '' }); loadTabData(); } catch (e: any) { alert(e.response?.data?.error || 'Failed'); } };
  const handleClaimSubmit = async () => {
    if (!user || !campground) return;
    setClaimSubmitting(true);
    try {
      await api.post(`/business/claim/${campground.id}`, claimData);
      alert("✅ Claim request submitted! You will be notified when it is approved.");
      setShowClaimModal(false);
      setCampground({ ...campground, verificationStatus: "PENDING", claimedById: user.id });
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to submit claim");
    } finally {
      setClaimSubmitting(false);
    }
  };
  const handleSubmitEvent = async () => { if (!user || !campground) return; try { await api.post(`/campground-features/${campground.id}/events`, eventData); alert('✅ Event created!'); setShowEventModal(false); setEventData({ title: '', description: '', startDate: '', endDate: '', location: '' }); loadTabData(); } catch (e: any) { alert(e.response?.data?.error || 'Failed'); } };

  const handleUploadMap = async () => {
    if (!user || !campground || !mapFile) return;
    try { setUploadingMap(true); const fd = new FormData(); fd.append('map', mapFile); const { data } = await api.post(`/campground-features/${campground.id}/map`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setCampgroundMapUrl(data.mapUrl); setMapFile(null); alert('✅ Map uploaded!'); } catch (e: any) { alert(e.response?.data?.error || 'Failed'); } finally { setUploadingMap(false); }
  };

  const handleDeleteCampground = async () => {
    if (!user || !campground || !isSiteAdmin) return;
    if (!confirm(`Are you sure you want to DELETE "${campground.name}"? This cannot be undone!`)) return;
    try {
      await api.delete(`/campgrounds/${campground.id}`);
      alert("✅ Campground deleted!");
      navigate("/campgrounds");
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to delete campground");
    }
  };

  const handleOpenEdit = () => {
    if (!campground) return;
    setEditForm({
      name: campground.name || '', description: campground.description || '',
      location: campground.location || '', state: campground.state || '',
      city: (campground as any).city || '', zipCode: (campground as any).zipCode || '',
      latitude: campground.latitude ?? '', longitude: campground.longitude ?? '',
      phone: campground.phone || '', websiteUrl: campground.websiteUrl || '',
      businessEmail: campground.businessEmail || '', businessPhone: campground.businessPhone || '',
      bookingUrl: campground.bookingUrl || '', campspotSlug: campground.campspotSlug || '',
      imageUrl: campground.imageUrl || '', facebookUrl: campground.facebookUrl || '',
      instagramUrl: campground.instagramUrl || '', twitterUrl: campground.twitterUrl || '',
      youtubeUrl: campground.youtubeUrl || '', tiktokUrl: campground.tiktokUrl || '',
      hasWifi: (campground as any).hasWifi ?? false,
      hasShowers: (campground as any).hasShowers ?? false,
      hasRestrooms: (campground as any).hasRestrooms ?? false,
      hasElectricHookup: (campground as any).hasElectricHookup ?? false,
      hasWaterHookup: (campground as any).hasWaterHookup ?? false,
      hasSewerHookup: (campground as any).hasSewerHookup ?? false,
      hasDumpStation: (campground as any).hasDumpStation ?? false,
      hasLaundry: (campground as any).hasLaundry ?? false,
      hasStore: (campground as any).hasStore ?? false,
      hasPool: (campground as any).hasPool ?? false,
      hasPullThrough: (campground as any).hasPullThrough ?? false,
      hasBackIn: (campground as any).hasBackIn ?? false,
      isBigRigFriendly: (campground as any).isBigRigFriendly ?? false,
      isPetFriendly: (campground as any).isPetFriendly ?? false,
      isWaterfront: (campground as any).isWaterfront ?? false,
      maxAmpService: (campground as any).maxAmpService ?? '',
      maxRvLength: (campground as any).maxRvLength ?? '',
      pricePerNight: (campground as any).pricePerNight ?? '',
      seasonStart: (campground as any).seasonStart || '',
      seasonEnd: (campground as any).seasonEnd || '',
      minRvYear: (campground as any).minRvYear ?? '',
    });
    setShowEditModal(true);
  };

  const handleUploadEditPhoto = async (file: File) => {
    if (!campground) return;
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const { data } = await api.post(`/campground-features/${campground.id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditForm((f: any) => ({ ...f, imageUrl: data.imageUrl }));
    } catch (e: any) { alert(e.response?.data?.error || 'Upload failed'); }
  };

  const handleUploadEditMap = async (file: File) => {
    if (!campground) return;
    try {
      const fd = new FormData();
      fd.append('map', file);
      const { data } = await api.post(`/campground-features/${campground.id}/map`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCampgroundMapUrl(data.mapUrl);
      alert('✅ Map uploaded!');
    } catch (e: any) { alert(e.response?.data?.error || 'Upload failed'); }
  };

  const handleSaveEdit = async () => {
    if (!campground) return;
    try {
      setEditSaving(true);
      const { data } = await api.put(`/campgrounds/${campground.id}/admin-edit`, editForm);
      setCampground({ ...campground, ...data });
      setShowEditModal(false);
      alert('✅ Campground updated!');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteMap = async () => {
    if (!user || !campground || !confirm('Delete this map?')) return;
    try { await api.delete(`/campground-features/${campground.id}/map`); setCampgroundMapUrl(null); alert('✅ Map deleted!'); } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
  };

  const renderSmores = (count: number, interactive = false, onClick?: (r: number) => void) => (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => <button key={i} onClick={() => interactive && onClick?.(i)} disabled={!interactive} className={`text-2xl ${interactive ? 'cursor-pointer hover:scale-110 transition' : ''} ${i <= count ? '' : 'opacity-30'}`}>🔥</button>)}
    </div>
  );

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });


  const getTripUrl = () => {
    if (!campground) return '/trips';
    return `/trips?createFromWishlist=true&campgroundId=${campground.id}&campgroundName=${encodeURIComponent(campground.name)}`;
  };

  const BadgeIcons = () => {
    if (campgroundBadges.totalBadges === 0) return null;
    const allBadges = [...campgroundBadges.locationBadges, ...campgroundBadges.regionBadges];
    return (
      <span className="inline-flex items-center gap-2 ml-3 align-middle">
        {allBadges.map(b => (
          <Link key={b.slug} to="/badges" className="relative group inline-flex items-center">
            <span className="relative">
              <img src={b.imageUrl} alt={b.name} className="w-10 h-10 rounded-full border-2 border-yellow-400 shadow-md group-hover:scale-110 transition-transform cursor-pointer" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-[8px] font-bold text-yellow-900">★</span>
            </span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
              🏆 Stay here to earn: {b.name}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></span>
            </span>
          </Link>
        ))}
      </span>
    );
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" /><p className="text-gray-600">Loading...</p></div></div>;
  if (!campground) return <div className="flex items-center justify-center min-h-screen"><div className="text-center"><p className="text-gray-600">Campground not found</p><button onClick={() => navigate('/campgrounds')} className="btn btn-primary mt-4">Back</button></div></div>;

  // Theme configuration
  const theme = campground.theme || 'classic';
  const accentColor = campground.accentColor || '#16a34a';

  // Modern theme: Full-width hero, floating action bar, card grid layout
  // Rustic theme: Warm wood tones, stacked sections, nature-inspired
  
  const isModern = theme === 'modern';
  const isRustic = theme === 'rustic';
  const isCoastal = theme === 'coastal';
  const isAdventure = theme === 'adventure';
  const isMinimal = theme === 'minimal';
  const isMagazine = theme === 'magazine';
  const isRetro = theme === 'retro';
  const isNeon = theme === 'neon';
  
  const themeStyles = {
    container: isModern ? '' : isRustic ? 'bg-amber-50' : isCoastal ? '' : isAdventure ? '' : isMinimal ? '' : isMagazine ? '' : isRetro ? '' : isNeon ? '' : 'max-w-7xl mx-auto px-4 py-8',
    header: isModern ? 'relative' : isRustic ? 'bg-amber-100 border-b-4 border-amber-700' : 'bg-white rounded-lg shadow-lg overflow-hidden mb-6',
    heroHeight: isModern ? 'h-[70vh] min-h-[500px]' : isRustic ? 'h-64 md:h-80' : isMinimal ? 'h-64 md:h-72' : 'h-72 md:h-96',
    card: isModern ? 'bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow' : isRustic ? 'bg-amber-50 border-2 border-amber-300 rounded-lg p-5' : isNeon ? 'bg-gray-900 border border-purple-500/30 rounded-lg p-6' : 'bg-white rounded-lg shadow p-6',
    tabs: isModern ? 'bg-white/90 backdrop-blur-lg shadow-lg sticky top-0 z-20' : isRustic ? 'bg-amber-200 border-b-2 border-amber-400' : isMagazine ? 'bg-gray-100 border-b border-gray-300' : isRetro ? 'bg-amber-100 border-b-2 border-amber-600' : isNeon ? 'bg-gray-900 border-b border-purple-500/30' : 'border-b border-gray-200',
    tabActive: isModern ? 'bg-gray-900 text-white rounded-full' : isRustic ? 'bg-amber-700 text-white rounded-md' : '',
    contentBg: isModern ? 'bg-gray-50' : isRustic ? 'bg-amber-50' : isNeon ? 'bg-gray-950' : 'bg-white',
    fontStyle: isRustic ? 'font-serif' : isRetro ? 'font-serif' : '',
  };

  const currentTheme = themeStyles;

  return (
    <div className={themeStyles.container + ' ' + themeStyles.fontStyle} style={{ '--accent-color': accentColor } as React.CSSProperties}>
      
      {/* MODERN THEME: Full-bleed hero with overlay content */}
      {isModern && (
        <div className="relative">
          {/* Full-width hero */}
          <div className={themeStyles.heroHeight + " w-full relative"}>
            {campground.imageUrl
              ? <DraggableBanner
                  imageUrl={campground.imageUrl}
                  altText={campground.name}
                  position={bannerPosition}
                  canEdit={isAdmin}
                  onPositionChange={async (pos) => {
                    setBannerPosition(pos);
                    try { await api.patch(`/campgrounds/${campground.id}/banner-position`, { bannerPosition: pos }); } catch {}
                  }}
                  className="w-full h-full"
                />
              : <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center"><MapPin className="w-32 h-32 text-white/30" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            {/* Back button */}
            <button onClick={() => navigate('/campgrounds')} className="absolute top-6 left-6 flex items-center text-white/80 hover:text-white bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full transition"><ChevronLeft className="w-5 h-5" /><span>Back</span></button>
            
            {/* Favorite button */}
            {user && <div className="absolute top-6 right-6 flex gap-2">
              <button onClick={handleToggleFavorite} className={`p-3 rounded-full backdrop-blur-sm transition ${isFavorited ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`} title={isFavorited ? "Unfavorite" : "Favorite"}><Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} /></button>
              <button onClick={toggleWishlist} className={`p-3 rounded-full backdrop-blur-sm transition ${inWishlist ? 'bg-purple-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`} title={inWishlist ? "On Wishlist" : "Add to Wishlist"}><span className="text-xl">🧞</span></button>
              <button onClick={toggleMute} className={`p-3 rounded-full backdrop-blur-sm transition ${isMuted ? 'bg-gray-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-6 h-6" /> : <Bell className="w-6 h-6" />}</button>
            </div>}
            
            {/* Hero content overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
              <div className="max-w-6xl mx-auto">
                <div className="flex flex-wrap gap-2 mb-4">
                  {isAdmin && <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">⭐ Admin</span>}
                  {campground.verificationStatus === "VERIFIED" && <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"><Check className="w-4 h-4" />Verified</span>}
                </div>
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-3">{campground.name}<BadgeIcons /></h1>
                <div className="flex items-center text-white/80 text-lg mb-4"><MapPin className="w-5 h-5 mr-2" /><span>{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</span></div>
                <div className="flex flex-wrap items-center gap-6 text-white/70">
                  {avgRating > 0 && <div className="flex items-center gap-2">{renderSmores(Math.round(avgRating))}<span>({reviews.length})</span></div>}
                  {campground._count && <><span className="flex items-center gap-1"><Heart className="w-4 h-4" />{campground._count.followers}</span><span className="flex items-center gap-1"><Users className="w-4 h-4" />{campground._count.checkIns}</span></>}
                </div>
              </div>
            </div>
          </div>
          
          {/* Floating action bar */}
          <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-10 mb-8">
            <div className="bg-white rounded-2xl shadow-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {campground.businessPhone && <a href={`tel:${campground.businessPhone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition backdrop-blur-sm"><Phone className="w-3.5 h-3.5" />Call</a>}
                {campground.websiteUrl && <a href={campground.websiteUrl} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition backdrop-blur-sm"><Globe className="w-3.5 h-3.5" />Website</a>}
                {campground.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${campground.latitude},${campground.longitude}`} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition backdrop-blur-sm"><Navigation className="w-3.5 h-3.5" />Directions</a>}
                {campground.storeUrl && <a href={campground.storeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 transition backdrop-blur-sm"><ShoppingBag className="w-3.5 h-3.5" />Store</a>}
                <div className="w-px bg-white/20 mx-1 self-stretch" />
                <a href={`https://thedyrt.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 transition">🏕️ Dyrt</a>
                <a href={`https://www.hipcamp.com/en-US/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 transition">🌿 Hipcamp</a>
                <a href={`https://www.campspot.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 transition">⛺ Campspot</a>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {user && <>
                  <button onClick={() => setShowCheckInModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white transition-all duration-200 shadow-sm hover:shadow-md hover:brightness-110" style={{ backgroundColor: accentColor }}>
                    <Calendar className="w-4 h-4" />I'm Here! 📍
                  </button>
                  <button onClick={() => navigate(getTripUrl())} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white/15 text-white border border-white/25 hover:bg-white/25 transition backdrop-blur-sm">
                    <MapPinned className="w-4 h-4" />Plan a Trip
                  </button>
                </>}
                {<CampspotBookButton campgroundId={campground.id} campspotSlug={campground.name} variant="modern" />}
                {!campground.campspotSlug && campground.bookingUrl && <a href={campground.bookingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow-emerald-500/30 hover:shadow-md transition-all duration-200"><Calendar className="w-4 h-4" />Book Now<ExternalLink className="w-3 h-3 opacity-60" /></a>}
                {user && <button onClick={toggleMute} className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition ${isMuted ? 'bg-white/20 text-white/50' : 'bg-white/15 text-white border border-white/25 hover:bg-white/25'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</button>}
                {campground?.latitude && campground?.longitude && (
                    <NavigationButtons lat={campground.latitude!} lng={campground.longitude!} name={campground.name} compact />
                )}
                {isAdmin && <Link to={`/business/${campground.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white/15 text-white border border-white/25 hover:bg-white/25 transition backdrop-blur-sm"><Settings className="w-4 h-4" />Manage</Link>}
              </div>
            </div>

          {/* Managed by indicator */}
          {(campground.claimedBy || (campground.admins && campground.admins.length > 0)) && (
            <div className="max-w-6xl mx-auto px-4 mb-6">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="font-medium">Managed by:</span>
                <div className="flex items-center gap-2">
                  {campground.claimedBy && (
                    <Link to={`/profile/${campground.claimedBy.username}`} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 transition">
                      {campground.claimedBy.profilePicture ? (
                        <img src={campground.claimedBy.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs">{campground.claimedBy.firstName?.[0]}</div>
                      )}
                      <span>{campground.claimedBy.firstName} {campground.claimedBy.lastName}</span>
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Owner</span>
                    </Link>
                  )}
                  {campground.admins?.filter(a => a.user.id !== campground.claimedBy?.id).slice(0, 3).map(admin => (
                    <Link key={admin.id} to={`/profile/${admin.user.username}`} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 transition">
                      {admin.user.profilePicture ? (
                        <img src={admin.user.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">{admin.user.firstName?.[0]}</div>
                      )}
                      <span>{admin.user.firstName}</span>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{admin.role}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* RUSTIC THEME: Warm, nature-inspired layout */}
      {isRustic && (
        <div>
          {/* Wood-textured header bar */}
          <div className="bg-amber-800 text-amber-100 py-4 px-6">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <button onClick={() => navigate('/campgrounds')} className="flex items-center hover:text-white"><ChevronLeft className="w-5 h-5" /><span>Back to Campgrounds</span></button>
              <div className="flex gap-3">
                {isAdmin && <span className="bg-amber-600 px-3 py-1 rounded text-sm">⭐ Admin</span>}
                {isAdmin && <Link to={`/business/${campground.id}`} className="bg-amber-600 hover:bg-amber-500 px-4 py-1 rounded flex items-center gap-2"><Settings className="w-4 h-4" />Manage</Link>}
              </div>
            </div>
          </div>
          
          {/* Hero with rustic frame */}
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="border-4 border-amber-700 rounded-lg overflow-hidden shadow-lg">
              <div className={themeStyles.heroHeight + " relative"}>
                {campground.imageUrl ? <img src={campground.imageUrl.startsWith("http") ? campground.imageUrl : `${campground.imageUrl}`} alt={campground.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-amber-200 flex items-center justify-center"><MapPin className="w-24 h-24 text-amber-600" /></div>}
                {user && <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={handleToggleFavorite} className={`p-3 rounded-full shadow-lg transition ${isFavorited ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`} title={isFavorited ? "Unfavorite" : "Favorite"}><Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} /></button>
              <button onClick={toggleWishlist} className={`p-3 rounded-full shadow-lg transition ${inWishlist ? 'bg-purple-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`} title={inWishlist ? "On Wishlist" : "Add to Wishlist"}><span className="text-xl">🧞</span></button>
              <button onClick={toggleMute} className={`p-3 rounded-full shadow-lg transition ${isMuted ? 'bg-gray-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-6 h-6" /> : <Bell className="w-6 h-6" />}</button>
            </div>}
              </div>
            </div>
            
            {/* Campground info card */}
            <div className="bg-amber-100 border-2 border-amber-400 rounded-lg p-6 -mt-6 mx-4 relative z-10 shadow-md">
              <h1 className="text-3xl md:text-4xl font-bold text-amber-900 mb-2 font-serif">{campground.name}<BadgeIcons /></h1>
              <div className="flex items-center text-amber-700 text-lg mb-3"><MapPin className="w-5 h-5 mr-2" /><span>{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</span></div>
              
              <div className="flex flex-wrap gap-4 mb-4">
                {avgRating > 0 && <div className="flex items-center gap-2">{renderSmores(Math.round(avgRating))}<span className="text-amber-700">({reviews.length} reviews)</span></div>}
                {campground._count && <><span className="flex items-center gap-1 text-amber-600"><Heart className="w-4 h-4" />{campground._count.followers} followers</span><span className="flex items-center gap-1 text-amber-600"><Users className="w-4 h-4" />{campground._count.checkIns} check-ins</span></>}
              </div>
              
              <div className="flex flex-wrap gap-3 pt-4 border-t border-amber-300">
                {user && <><ActionButton variant="primary" onClick={() => setShowCheckInModal(true)} icon={<Calendar className="w-4 h-4" />} style={{ backgroundColor: accentColor }}>Check In</ActionButton><ActionButton variant="primary" onClick={() => navigate(getTripUrl())} icon={<MapPinned className="w-4 h-4" />} style={{ backgroundColor: '#b45309' }}>Plan a Trip</ActionButton></>}{<CampspotBookButton campgroundId={campground.id} campspotSlug={campground.name} variant="rustic" />}
                {!campground.campspotSlug && campground.bookingUrl && <a href={campground.bookingUrl} target="_blank" rel="noopener noreferrer" className="px-5 py-2 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 flex items-center gap-2">Book Now<ExternalLink className="w-3 h-3" /></a>}

                {getBookingUrl(campground) && <a href={getBookingUrl(campground)!} target="_blank" rel="noopener noreferrer" className="px-5 py-2 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 flex items-center gap-2">{getBookingLabel(campground)}<ExternalLink className="w-3 h-3"/></a>}
                {user && <button onClick={toggleMute} className={`px-4 py-2 rounded-lg font-medium transition ${isMuted ? 'bg-amber-300 text-amber-800' : 'bg-amber-200 text-amber-800 hover:bg-amber-300'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</button>}
                {campground?.latitude && campground?.longitude && (
                  <NavigationButtons
                    lat={campground.latitude}
                    lng={campground.longitude}
                    name={campground.name}
                  />
                )}
                {campground.businessPhone && <a href={`tel:${campground.businessPhone}`} className="px-4 py-2 bg-amber-200 text-amber-800 rounded-lg hover:bg-amber-300 flex items-center gap-2"><Phone className="w-4 h-4" />Call</a>}
                {campground.websiteUrlUrl && <a href={campground.websiteUrlUrl} target="_blank" className="px-4 py-2 bg-amber-200 text-amber-800 rounded-lg hover:bg-amber-300 flex items-center gap-2"><Globe className="w-4 h-4" />Website</a>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COASTAL THEME: Beach vibes, ocean blues */}
      {isCoastal && (
        <div className="relative">
          {/* Wave-decorated hero */}
          <div className={themeStyles.heroHeight + " w-full relative overflow-hidden"}>
            {campground.imageUrl ? <img src={campground.imageUrl.startsWith("http") ? campground.imageUrl : `${campground.imageUrl}`} alt={campground.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center"><MapPin className="w-32 h-32 text-white/30" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-sky-900/60 via-sky-600/20 to-transparent" />
            
            {/* Back button */}
            <button onClick={() => navigate('/campgrounds')} className="absolute top-6 left-6 flex items-center text-white/90 hover:text-white bg-sky-900/30 backdrop-blur-sm px-4 py-2 rounded-full transition"><ChevronLeft className="w-5 h-5" /><span>Back</span></button>
            
            {/* Favorite & Admin buttons */}
            <div className="absolute top-6 right-6 flex gap-2">
              {isAdmin && <span className="bg-sky-500 text-white px-3 py-2 rounded-full text-sm font-medium">⭐ Admin</span>}
              {user && <div className="flex gap-2">
              <button onClick={handleToggleFavorite} className={`p-3 rounded-full backdrop-blur-sm transition ${isFavorited ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`} title={isFavorited ? "Unfavorite" : "Favorite"}><Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} /></button>
              <button onClick={toggleWishlist} className={`p-3 rounded-full backdrop-blur-sm transition ${inWishlist ? 'bg-purple-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`} title={inWishlist ? "On Wishlist" : "Add to Wishlist"}><span className="text-xl">🧞</span></button>
              <button onClick={toggleMute} className={`p-3 rounded-full backdrop-blur-sm transition ${isMuted ? 'bg-gray-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-6 h-6" /> : <Bell className="w-6 h-6" />}</button>
            </div>}
            </div>
            
            {/* Wave decoration at bottom */}
            <div className="absolute bottom-0 left-0 right-0">
              <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-16 text-sky-50 fill-current">
                <path d="M0,60 C300,120 400,0 600,60 C800,120 900,0 1200,60 L1200,120 L0,120 Z" />
              </svg>
            </div>
            
            {/* Hero content */}
            <div className="absolute bottom-20 left-0 right-0 px-8">
              <div className="max-w-5xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg">{campground.name}<BadgeIcons /></h1>
                <div className="flex items-center text-white/90 text-lg"><MapPin className="w-5 h-5 mr-2" /><span>{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</span></div>
              </div>
            </div>
          </div>
          
          {/* Info cards */}
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-sky-100">
                <div className="flex items-center gap-3 mb-2">
                  {avgRating > 0 ? renderSmores(Math.round(avgRating)) : <span className="text-sky-600">No reviews yet</span>}
                </div>
                <p className="text-sky-700 text-sm">{reviews.length} reviews</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-sky-100">
                <div className="flex items-center gap-2 text-sky-800 font-medium"><Heart className="w-5 h-5 text-sky-500" />{campground._count?.followers || 0} Followers</div>
                <p className="text-sky-700 text-sm mt-1">{campground._count?.checkIns || 0} check-ins</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-sky-100 flex flex-wrap gap-2">
                {user && <><ActionButton variant="primary" onClick={() => setShowCheckInModal(true)} icon={<Calendar className="w-4 h-4" />} style={{ backgroundColor: '#0ea5e9' }}>Check In</ActionButton><ActionButton variant="primary" onClick={() => navigate(getTripUrl())} icon={<MapPinned className="w-4 h-4" />} style={{ backgroundColor: '#0369a1' }}>Plan a Trip</ActionButton></>}
                {<CampspotBookButton campgroundId={campground.id} campspotSlug={campground.name} variant="coastal" />}
                {!campground.campspotSlug && campground.bookingUrl && <a href={campground.bookingUrl} target="_blank" rel="noopener noreferrer" className="flex-1 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-medium hover:bg-green-600 transition flex items-center justify-center gap-1">Book Now<ExternalLink className="w-3 h-3" /></a>}
                {user && <button onClick={toggleMute} className={`px-3 py-2 rounded-full text-sm font-medium transition ${isMuted ? 'bg-sky-200 text-sky-700' : 'bg-sky-100 text-sky-600 hover:bg-sky-200'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</button>}
                {isAdmin && <Link to={`/business/${campground.id}`} className="px-4 py-2 bg-sky-700 text-white rounded-full text-sm font-medium hover:bg-sky-800 transition"><Settings className="w-4 h-4 inline mr-1" />Manage</Link>}
              </div>
            </div>
            
            {/* Quick actions */}
            <div className="flex flex-wrap gap-3 mb-8">
              {campground.businessPhone && <a href={`tel:${campground.businessPhone}`} className="flex items-center gap-2 px-5 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow border border-sky-200 text-sky-700 hover:bg-sky-50 transition"><Phone className="w-4 h-4" />Call</a>}
              {campground.websiteUrlUrl && <a href={campground.websiteUrlUrl} target="_blank" className="flex items-center gap-2 px-5 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow border border-sky-200 text-sky-700 hover:bg-sky-50 transition"><Globe className="w-4 h-4" />Website</a>}
              {campground.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${campground.latitude},${campground.longitude}`} target="_blank" className="flex items-center gap-2 px-5 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow border border-sky-200 text-sky-700 hover:bg-sky-50 transition"><Navigation className="w-4 h-4" />Directions</a>}
              {campground.storeUrl && <a href={campground.storeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow border border-sky-200 text-sky-700 hover:bg-sky-50 transition" title="Camp Store"><ShoppingBag className="w-4 h-4" />Store</a>}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-sky-100"><span className="text-xs text-sky-400 mr-1">Also check:</span><a href={`https://thedyrt.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1 bg-white/80 rounded-full text-xs border border-sky-200 text-sky-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition">🏕️ The Dyrt</a><a href={`https://www.hipcamp.com/en-US/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1 bg-white/80 rounded-full text-xs border border-sky-200 text-sky-600 hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition">🌿 Hipcamp</a><a href={`https://www.campspot.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1 bg-white/80 rounded-full text-xs border border-sky-200 text-sky-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition">⛺ Campspot</a></div>
          </div>
        </div>
      )}

      {/* ADVENTURE THEME: Bold, rugged outdoor feel */}
      {isAdventure && (
        <div className="bg-gray-900">
          {/* Gradient accent bar */}
          <div className="h-1 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500" />
          
          {/* Hero */}
          <div className={themeStyles.heroHeight + " w-full relative"}>
            {campground.imageUrl ? <img src={campground.imageUrl.startsWith("http") ? campground.imageUrl : `${campground.imageUrl}`} alt={campground.name} className="w-full h-full object-cover" style={{ filter: 'contrast(1.1) saturate(1.1)' }} /> : <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center"><MapPin className="w-32 h-32 text-orange-500/30" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
            
            {/* Back button */}
            <button onClick={() => navigate('/campgrounds')} className="absolute top-6 left-6 flex items-center text-white/80 hover:text-orange-400 transition"><ChevronLeft className="w-5 h-5" /><span className="font-bold tracking-wide">BACK</span></button>
            
            {/* Top right buttons */}
            <div className="absolute top-6 right-6 flex gap-2">
              {isAdmin && <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-2 rounded text-sm font-bold tracking-wide">⭐ ADMIN</span>}
              {user && <div className="flex gap-2">
              <button onClick={handleToggleFavorite} className={`p-3 rounded transition ${isFavorited ? 'bg-red-500 text-white' : 'bg-gray-800/80 text-white hover:bg-orange-500'}`} title={isFavorited ? "Unfavorite" : "Favorite"}><Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} /></button>
              <button onClick={toggleWishlist} className={`p-3 rounded transition ${inWishlist ? 'bg-purple-500 text-white' : 'bg-gray-800/80 text-white hover:bg-purple-500'}`} title={inWishlist ? "On Wishlist" : "Add to Wishlist"}><span className="text-xl">🧞</span></button>
              <button onClick={toggleMute} className={`p-3 rounded transition ${isMuted ? 'bg-gray-600 text-white' : 'bg-gray-800/80 text-white hover:bg-gray-600'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-6 h-6" /> : <Bell className="w-6 h-6" />}</button>
            </div>}
            </div>
            
            {/* Hero content */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="max-w-5xl mx-auto">
                <div className="inline-block bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1 rounded text-sm font-bold tracking-wider mb-4">CAMPGROUND</div>
                <h1 className="text-4xl md:text-6xl font-black text-white mb-3 tracking-tight">{campground.name}<BadgeIcons /></h1>
                <div className="flex items-center text-gray-300 text-lg"><MapPin className="w-5 h-5 mr-2 text-orange-500" /><span>{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</span></div>
              </div>
            </div>
          </div>
          
          {/* Stats bar */}
          <div className="bg-gray-800 border-y border-orange-500/30">
            <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-6">
                {avgRating > 0 && <div className="flex items-center gap-2">{renderSmores(Math.round(avgRating))}<span className="text-gray-400">({reviews.length})</span></div>}
                {campground._count && <><span className="flex items-center gap-2 text-gray-300"><Heart className="w-5 h-5 text-orange-500" />{campground._count.followers}</span><span className="flex items-center gap-2 text-gray-300"><Users className="w-5 h-5 text-orange-500" />{campground._count.checkIns}</span></>}
              </div>
              <div className="flex gap-3">
                {user && <><button onClick={() => setShowCheckInModal(true)} className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded hover:from-orange-600 hover:to-red-600 transition">I'M HERE! 📍</button></>}
                {<CampspotBookButton campgroundId={campground.id} campspotSlug={campground.name} variant="adventure" />}
                {!campground.campspotSlug && campground.bookingUrl && <a href={campground.bookingUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 transition flex items-center gap-2">Book Now<ExternalLink className="w-3 h-3" /></a>}
                {user && <button onClick={toggleMute} className={`px-4 py-2 rounded font-bold transition ${isMuted ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-300 hover:text-orange-400'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}</button>}
                {isAdmin && <Link to={`/business/${campground.id}`} className="px-6 py-2 bg-gray-700 text-white font-bold rounded hover:bg-gray-600 transition"><Settings className="w-4 h-4 inline mr-2" />MANAGE</Link>}
              </div>
            </div>
          </div>
          
          {/* Quick actions */}
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex flex-wrap gap-3">
              {campground.businessPhone && <a href={`tel:${campground.businessPhone}`} className="flex items-center gap-2 px-5 py-2 bg-gray-800 text-gray-300 rounded border border-gray-700 hover:border-orange-500 hover:text-orange-400 transition"><Phone className="w-4 h-4" />Call</a>}
              {campground.websiteUrlUrl && <a href={campground.websiteUrlUrl} target="_blank" className="flex items-center gap-2 px-5 py-2 bg-gray-800 text-gray-300 rounded border border-gray-700 hover:border-orange-500 hover:text-orange-400 transition"><Globe className="w-4 h-4" />Website</a>}
              {campground.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${campground.latitude},${campground.longitude}`} target="_blank" className="flex items-center gap-2 px-5 py-2 bg-gray-800 text-gray-300 rounded border border-gray-700 hover:border-orange-500 hover:text-orange-400 transition"><Navigation className="w-4 h-4" />Directions</a>}
              {campground.storeUrl && <a href={campground.storeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2 bg-gray-800 text-gray-300 rounded border border-gray-700 hover:border-orange-500 hover:text-orange-400 transition" title="Camp Store"><ShoppingBag className="w-4 h-4" />Store</a>}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-700"><span className="text-xs text-gray-500 mr-1">Also check:</span><a href={`https://thedyrt.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 py-1.5 bg-gray-800 text-gray-300 rounded border border-gray-700 text-xs hover:border-orange-500 hover:text-orange-400 transition">🏕️ The Dyrt</a><a href={`https://www.hipcamp.com/en-US/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 py-1.5 bg-gray-800 text-gray-300 rounded border border-gray-700 text-xs hover:border-green-500 hover:text-green-400 transition">🌿 Hipcamp</a><a href={`https://www.campspot.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 py-1.5 bg-gray-800 text-gray-300 rounded border border-gray-700 text-xs hover:border-blue-500 hover:text-blue-400 transition">⛺ Campspot</a></div>
          </div>
        </div>
      )}

      {/* MINIMAL THEME: Clean, zen-like simplicity */}
      {isMinimal && (
        <div className="bg-white">
          {/* Simple nav */}
          <div className="border-b border-gray-100 px-8 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <button onClick={() => navigate('/campgrounds')} className="text-gray-400 hover:text-gray-900 transition font-light">← Back</button>
              <div className="flex gap-4">
                {isAdmin && <span className="text-gray-400 text-sm">Admin</span>}
                {isAdmin && <Link to={`/business/${campground.id}`} className="text-gray-400 hover:text-gray-900 text-sm">Manage →</Link>}
              </div>
            </div>
          </div>
          
          {/* Compact hero */}
          <div className={themeStyles.heroHeight + " w-full relative"}>
            {campground.imageUrl ? <img src={campground.imageUrl.startsWith("http") ? campground.imageUrl : `${campground.imageUrl}`} alt={campground.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-100 flex items-center justify-center"><MapPin className="w-16 h-16 text-gray-300" /></div>}
            {user && <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={handleToggleFavorite} className={`p-2 transition ${isFavorited ? 'text-red-500' : 'text-white/70 hover:text-white'}`} title={isFavorited ? "Unfavorite" : "Favorite"}><Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} /></button>
              <button onClick={toggleWishlist} className={`p-2 transition ${inWishlist ? 'text-purple-500' : 'text-white/70 hover:text-white'}`} title={inWishlist ? "On Wishlist" : "Add to Wishlist"}><span>🧞</span></button>
              <button onClick={toggleMute} className={`p-2 transition ${isMuted ? 'text-gray-500' : 'text-white/70 hover:text-white'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}</button>
            </div>}
          </div>
          
          {/* Content */}
          <div className="max-w-4xl mx-auto px-8 py-6">
            <h1 className="text-3xl md:text-4xl font-light text-gray-900 tracking-wide mb-2">{campground.name}<BadgeIcons /></h1>
            <p className="text-gray-400 font-light mb-8">{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</p>
            
            <div className="flex flex-wrap items-center gap-8 mb-6 pb-6 border-b border-gray-100">
              {avgRating > 0 && <div className="flex items-center gap-2">{renderSmores(Math.round(avgRating))}<span className="text-gray-400 font-light">{reviews.length} reviews</span></div>}
              {campground._count && <><span className="text-gray-400 font-light">{campground._count.followers} followers</span><span className="text-gray-400 font-light">{campground._count.checkIns} check-ins</span></>}
            </div>
            
            {/* Minimal actions */}
            <div className="flex flex-wrap gap-4 mb-4">
              {user && <><ActionButton variant="primary" onClick={() => setShowCheckInModal(true)} icon={<Calendar className="w-4 h-4" />} style={{ backgroundColor: '#111827' }}>Check In</ActionButton><ActionButton variant="primary" onClick={() => navigate(getTripUrl())} icon={<MapPinned className="w-4 h-4" />} style={{ backgroundColor: '#374151' }}>Plan a Trip</ActionButton></>}
              {<CampspotBookButton campgroundId={campground.id} campspotSlug={campground.name} variant="minimal" />}
              {!campground.campspotSlug && campground.bookingUrl && <a href={campground.bookingUrl} target="_blank" rel="noopener noreferrer" className="px-8 py-3 bg-green-700 text-white font-light tracking-wide hover:bg-green-800 transition flex items-center gap-2">Book Now<ExternalLink className="w-3 h-3" /></a>}
              {user && <button onClick={toggleMute} className={`px-4 py-3 border font-light transition ${isMuted ? 'border-gray-900 bg-gray-100 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-900 hover:text-gray-900'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}</button>}
              {campground.businessPhone && <a href={`tel:${campground.businessPhone}`} className="px-6 py-3 border border-gray-200 text-gray-600 font-light hover:border-gray-900 hover:text-gray-900 transition">Call</a>}
              {campground.websiteUrlUrl && <a href={campground.websiteUrlUrl} target="_blank" className="px-6 py-3 border border-gray-200 text-gray-600 font-light hover:border-gray-900 hover:text-gray-900 transition">Website</a>}
              {campground.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${campground.latitude},${campground.longitude}`} target="_blank" className="px-6 py-3 border border-gray-200 text-gray-600 font-light hover:border-gray-900 hover:text-gray-900 transition">Directions</a>}
              {campground.storeUrl && <a href={campground.storeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-600 font-light hover:border-gray-900 hover:text-gray-900 transition" title="Camp Store"><ShoppingBag className="w-4 h-4" />Store</a>}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100"><span className="text-xs text-gray-400 tracking-wide uppercase mr-2">Also check</span><a href={`https://thedyrt.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="text-xs px-4 py-2 border border-gray-200 text-gray-500 font-light hover:border-gray-900 hover:text-gray-900 transition">🏕️ The Dyrt</a><a href={`https://www.hipcamp.com/en-US/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="text-xs px-4 py-2 border border-gray-200 text-gray-500 font-light hover:border-gray-900 hover:text-gray-900 transition">🌿 Hipcamp</a><a href={`https://www.campspot.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="text-xs px-4 py-2 border border-gray-200 text-gray-500 font-light hover:border-gray-900 hover:text-gray-900 transition">⛺ Campspot</a></div>
          </div>
        </div>
      )}

      {/* MAGAZINE THEME: Editorial storytelling layout */}
      {isMagazine && (
        <div className="bg-white">
          {/* Split hero - image left, content right */}
          <div className="flex flex-col lg:flex-row min-h-[70vh]">
            {/* Large image section */}
            <div className="lg:w-1/2 h-64 lg:h-auto relative">
              {campground.imageUrl ? (
                <img src={campground.imageUrl.startsWith("http") ? campground.imageUrl : `${campground.imageUrl}`} alt={campground.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center"><MapPin className="w-24 h-24 text-gray-700" /></div>
              )}
              {user && <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={handleToggleFavorite} className={`p-3 rounded-full transition ${isFavorited ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-600 hover:text-red-500'}`} title={isFavorited ? "Unfavorite" : "Favorite"}><Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} /></button>
              <button onClick={toggleWishlist} className={`p-3 rounded-full transition ${inWishlist ? 'bg-purple-500 text-white' : 'bg-white/90 text-gray-600 hover:text-purple-500'}`} title={inWishlist ? "On Wishlist" : "Add to Wishlist"}><span className="text-xl">🧞</span></button>
              <button onClick={toggleMute} className={`p-3 rounded-full transition ${isMuted ? 'bg-gray-500 text-white' : 'bg-white/90 text-gray-600 hover:text-gray-700'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-6 h-6" /> : <Bell className="w-6 h-6" />}</button>
            </div>}
            </div>
            
            {/* Content section */}
            <div className="lg:w-1/2 bg-gray-900 text-white p-8 lg:p-12 flex flex-col justify-center">
              <button onClick={() => navigate('/campgrounds')} className="text-gray-400 hover:text-white mb-8 self-start text-sm tracking-widest uppercase">← All Campgrounds</button>
              
              <div className="mb-6">
                {isAdmin && <span className="inline-block bg-yellow-500 text-black px-3 py-1 text-xs font-bold tracking-widest uppercase mb-4">Admin</span>}
                {campground.verificationStatus === "VERIFIED" && <span className="inline-block bg-green-500 text-white px-3 py-1 text-xs font-bold tracking-widest uppercase mb-4 ml-2">Verified</span>}
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-black mb-4 leading-tight">{campground.name}<BadgeIcons /></h1>
              <p className="text-xl text-gray-400 mb-8 font-light">{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</p>
              
              {/* Pull quote style stats */}
              <div className="border-l-4 border-white pl-6 mb-8">
                <div className="flex flex-wrap gap-6 text-lg">
                  {avgRating > 0 && <div className="flex items-center gap-2">{renderSmores(Math.round(avgRating))}<span className="text-gray-400">{reviews.length} reviews</span></div>}
                  {campground._count && <span className="text-gray-400">{campground._count.followers} followers · {campground._count.checkIns} check-ins</span>}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex flex-wrap gap-4">
                {user && <><ActionButton variant="tertiary" onClick={() => setShowCheckInModal(true)} icon={<Calendar className="w-4 h-4" />}>Check In</ActionButton><ActionButton variant="primary" onClick={() => navigate(getTripUrl())} icon={<MapPinned className="w-4 h-4" />} style={{ backgroundColor: '#1f2937' }}>Plan a Trip</ActionButton></>}
                {<CampspotBookButton campgroundId={campground.id} campspotSlug={campground.name} variant="magazine" />}
                {!campground.campspotSlug && campground.bookingUrl && <a href={campground.bookingUrl} target="_blank" rel="noopener noreferrer" className="px-8 py-4 bg-green-500 text-white font-bold hover:bg-green-600 transition flex items-center gap-2">Book Now<ExternalLink className="w-3 h-3" /></a>}
                {user && <button onClick={toggleMute} className={`px-4 py-4 border font-bold transition ${isMuted ? 'border-white bg-white/20 text-white' : 'border-gray-600 text-white hover:border-white'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}</button>}
                {campground.businessPhone && <a href={`tel:${campground.businessPhone}`} className="px-6 py-4 border border-gray-600 text-white hover:border-white transition">Call</a>}
                {campground.websiteUrlUrl && <a href={campground.websiteUrlUrl} target="_blank" className="px-6 py-4 border border-gray-600 text-white hover:border-white transition">Website</a>}
                {isAdmin && <Link to={`/business/${campground.id}`} className="px-6 py-4 border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition">Manage</Link>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RETRO THEME: Vintage badge-style nostalgic layout */}
      {isRetro && (
        <div className="bg-amber-50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d97706\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
          {/* Decorative top banner */}
          <div className="bg-amber-900 text-amber-100 py-2 text-center">
            <span className="tracking-[0.3em] text-xs font-bold uppercase">★ Welcome to Your Adventure ★</span>
          </div>
          
          {/* Navigation */}
          <div className="max-w-5xl mx-auto px-4 py-4">
            <button onClick={() => navigate('/campgrounds')} className="text-amber-800 hover:text-amber-900 flex items-center gap-2 font-medium"><ChevronLeft className="w-5 h-5" />Back to Campgrounds</button>
          </div>
          
          {/* Badge-style header */}
          <div className="max-w-5xl mx-auto px-4 pb-8">
            <div className="relative">
              {/* Circular badge overlay */}
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                <div className="w-32 h-32 rounded-full bg-amber-800 border-8 border-double border-amber-600 flex items-center justify-center shadow-xl">
                  <div className="text-center text-amber-100">
                    <div className="text-2xl font-black">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
                    <div className="text-xs tracking-wider">RATING</div>
                  </div>
                </div>
              </div>
              
              {/* Main card */}
              <div className="bg-white border-4 border-amber-800 rounded-lg overflow-hidden shadow-2xl pt-20">
                {/* Image with vintage frame */}
                <div className="relative mx-6 mt-4 border-8 border-amber-200 shadow-inner">
                  <div className="h-64 md:h-80">
                    {campground.imageUrl ? (
                      <img src={campground.imageUrl.startsWith("http") ? campground.imageUrl : `${campground.imageUrl}`} alt={campground.name} className="w-full h-full object-cover sepia-[0.2]" />
                    ) : (
                      <div className="w-full h-full bg-amber-100 flex items-center justify-center"><MapPin className="w-24 h-24 text-amber-400" /></div>
                    )}
                  </div>
                  {user && <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={handleToggleFavorite} className={`p-3 rounded-full shadow-lg transition ${isFavorited ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`} title={isFavorited ? "Unfavorite" : "Favorite"}><Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} /></button>
              <button onClick={toggleWishlist} className={`p-3 rounded-full shadow-lg transition ${inWishlist ? 'bg-purple-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`} title={inWishlist ? "On Wishlist" : "Add to Wishlist"}><span className="text-xl">🧞</span></button>
              <button onClick={toggleMute} className={`p-3 rounded-full shadow-lg transition ${isMuted ? 'bg-gray-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-6 h-6" /> : <Bell className="w-6 h-6" />}</button>
            </div>}
                </div>
                
                {/* Content */}
                <div className="p-6 text-center">
                  <div className="flex justify-center gap-2 mb-4">
                    {isAdmin && <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-bold">⭐ ADMIN</span>}
                    {campground.verificationStatus === "VERIFIED" && <span className="bg-green-700 text-white px-3 py-1 rounded-full text-xs font-bold">✓ VERIFIED</span>}
                  </div>
                  
                  <h1 className="text-3xl md:text-5xl font-black text-amber-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>{campground.name}<BadgeIcons /></h1>
                  <div className="flex items-center justify-center text-amber-700 text-lg mb-4"><MapPin className="w-5 h-5 mr-2" />{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</div>
                  
                  {/* Decorative divider */}
                  <div className="flex items-center justify-center gap-4 my-6">
                    <div className="h-px bg-amber-300 w-16"></div>
                    <span className="text-amber-600 text-2xl">✦</span>
                    <div className="h-px bg-amber-300 w-16"></div>
                  </div>
                  
                  {/* Stats in stamp style */}
                  <div className="flex flex-wrap justify-center gap-4 mb-6">
                    {campground._count && (
                      <>
                        <div className="border-2 border-dashed border-amber-400 rounded-lg px-4 py-2 bg-amber-50">
                          <div className="text-2xl font-black text-amber-800">{campground._count.followers}</div>
                          <div className="text-xs text-amber-600 uppercase tracking-wider">Followers</div>
                        </div>
                        <div className="border-2 border-dashed border-amber-400 rounded-lg px-4 py-2 bg-amber-50">
                          <div className="text-2xl font-black text-amber-800">{campground._count.checkIns}</div>
                          <div className="text-xs text-amber-600 uppercase tracking-wider">Check-ins</div>
                        </div>
                        <div className="border-2 border-dashed border-amber-400 rounded-lg px-4 py-2 bg-amber-50">
                          <div className="text-2xl font-black text-amber-800">{reviews.length}</div>
                          <div className="text-xs text-amber-600 uppercase tracking-wider">Reviews</div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-wrap justify-center gap-3">
                    {user && <><ActionButton variant="primary" onClick={() => setShowCheckInModal(true)} icon={<Calendar className="w-4 h-4" />} style={{ backgroundColor: '#92400e' }}>Check In</ActionButton><ActionButton variant="primary" onClick={() => navigate(getTripUrl())} icon={<MapPinned className="w-4 h-4" />} style={{ backgroundColor: '#d97706' }}>Plan a Trip</ActionButton></>}
                    {<CampspotBookButton campgroundId={campground.id} campspotSlug={campground.name} variant="retro" />}
                    {!campground.campspotSlug && campground.bookingUrl && <a href={campground.bookingUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-green-700 text-white font-bold rounded hover:bg-green-800 transition shadow-lg flex items-center gap-2">Book Now<ExternalLink className="w-3 h-3" /></a>}
                    {user && <button onClick={toggleMute} className={`px-4 py-3 rounded font-medium transition border border-amber-300 ${isMuted ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-4 h-4 inline" /> : <Bell className="w-4 h-4 inline" />}</button>}
                    {campground.businessPhone && <a href={`tel:${campground.businessPhone}`} className="px-5 py-3 bg-amber-100 text-amber-800 font-medium rounded hover:bg-amber-200 transition border border-amber-300"><Phone className="w-4 h-4 inline mr-2" />Call</a>}
                    {campground.websiteUrlUrl && <a href={campground.websiteUrlUrl} target="_blank" className="px-5 py-3 bg-amber-100 text-amber-800 font-medium rounded hover:bg-amber-200 transition border border-amber-300"><Globe className="w-4 h-4 inline mr-2" />Website</a>}
                    {campground.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${campground.latitude},${campground.longitude}`} target="_blank" className="px-5 py-3 bg-amber-100 text-amber-800 font-medium rounded hover:bg-amber-200 transition border border-amber-300"><Navigation className="w-4 h-4 inline mr-2" />Directions</a>}
                    {campground.storeUrl && <a href={campground.storeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 bg-amber-100 text-amber-800 font-medium rounded hover:bg-amber-200 transition border border-amber-300" title="Camp Store"><ShoppingBag className="w-4 h-4" />Store</a>}
                    {isAdmin && <Link to={`/business/${campground.id}`} className="px-5 py-3 bg-amber-600 text-white font-medium rounded hover:bg-amber-700 transition"><Settings className="w-4 h-4 inline mr-2" />Manage</Link>}
                  </div>
                    <div className="w-full flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-amber-200"><span className="text-xs text-amber-600 mr-1">Also check:</span><a href={`https://thedyrt.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 py-2 bg-amber-100 text-amber-800 text-xs rounded hover:bg-amber-200 transition border border-amber-300">🏕️ The Dyrt</a><a href={`https://www.hipcamp.com/en-US/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 py-2 bg-amber-100 text-amber-800 text-xs rounded hover:bg-amber-200 transition border border-amber-300">🌿 Hipcamp</a></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEON THEME: Futuristic cyberpunk with glowing accents */}
      {isNeon && (
        <div className="bg-gray-950">
          {/* Animated gradient top bar */}
          <div className="h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-pulse"></div>
          
          {/* Hero with glow effects */}
          <div className="relative h-[60vh] min-h-[400px] overflow-hidden">
            {campground.imageUrl ? (
              <img src={campground.imageUrl.startsWith("http") ? campground.imageUrl : `${campground.imageUrl}`} alt={campground.name} className="w-full h-full object-cover opacity-60" style={{ filter: 'saturate(1.3) contrast(1.1)' }} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-900 to-gray-950 flex items-center justify-center"><MapPin className="w-32 h-32 text-purple-500/30" /></div>
            )}
            
            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/50 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 to-cyan-900/30"></div>
            
            {/* Grid pattern overlay */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
            
            {/* Back button */}
            <button onClick={() => navigate('/campgrounds')} className="absolute top-6 left-6 flex items-center text-cyan-400 hover:text-cyan-300 transition"><ChevronLeft className="w-5 h-5" /><span className="tracking-wider text-sm">BACK</span></button>
            
            {/* Top right controls */}
            <div className="absolute top-6 right-6 flex gap-3">
              {isAdmin && <span className="px-3 py-1 bg-pink-500/20 border border-pink-500 text-pink-400 text-xs font-bold tracking-wider rounded">ADMIN</span>}
              {user && <div className="flex gap-2">
              <button onClick={handleToggleFavorite} className={`p-3 rounded border transition ${isFavorited ? 'bg-red-500 border-red-500 text-white' : 'bg-gray-900/50 border-cyan-500/50 text-cyan-400 hover:border-cyan-400'}`} title={isFavorited ? "Unfavorite" : "Favorite"}><Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} /></button>
              <button onClick={toggleWishlist} className={`p-3 rounded border transition ${inWishlist ? 'bg-purple-500 border-purple-500 text-white' : 'bg-gray-900/50 border-cyan-500/50 text-cyan-400 hover:border-cyan-400'}`} title={inWishlist ? "On Wishlist" : "Add to Wishlist"}><span>🧞</span></button>
              <button onClick={toggleMute} className={`p-3 rounded border transition ${isMuted ? 'bg-gray-500 border-gray-500 text-white' : 'bg-gray-900/50 border-cyan-500/50 text-cyan-400 hover:border-cyan-400'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}</button>
            </div>}
            </div>
            
            {/* Hero content */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="max-w-5xl mx-auto">
                {campground.verificationStatus === "VERIFIED" && <span className="inline-block px-3 py-1 bg-green-500/20 border border-green-500 text-green-400 text-xs font-bold tracking-wider rounded mb-4">VERIFIED</span>}
                <h1 className="text-4xl md:text-6xl font-black mb-3 bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">{campground.name}<BadgeIcons /></h1>
                <div className="flex items-center text-gray-400 text-lg"><MapPin className="w-5 h-5 mr-2 text-cyan-500" />{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</div>
              </div>
            </div>
          </div>
          
          {/* Stats bar with glow */}
          <div className="border-y border-purple-500/30 bg-gray-900/50 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-6">
                {avgRating > 0 && <div className="flex items-center gap-2">{renderSmores(Math.round(avgRating))}<span className="text-purple-400">({reviews.length})</span></div>}
                {campground._count && (
                  <>
                    <div className="flex items-center gap-2"><Heart className="w-5 h-5 text-pink-500" /><span className="text-gray-300">{campground._count.followers}</span></div>
                    <div className="flex items-center gap-2"><Users className="w-5 h-5 text-cyan-500" /><span className="text-gray-300">{campground._count.checkIns}</span></div>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                {user && <><button onClick={() => setShowCheckInModal(true)} className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold rounded hover:from-pink-600 hover:to-purple-600 transition shadow-lg shadow-pink-500/25">I'M HERE! 📍</button></>}
                {<CampspotBookButton campgroundId={campground.id} campspotSlug={campground.name} variant="neon" />}
                {!campground.campspotSlug && campground.bookingUrl && <a href={campground.bookingUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-green-500 text-white font-bold rounded hover:bg-green-600 transition shadow-lg shadow-green-500/25 flex items-center gap-2">Book Now<ExternalLink className="w-3 h-3" /></a>}
                {user && <button onClick={toggleMute} className={`px-4 py-2 rounded border font-bold transition ${isMuted ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-gray-800 border-cyan-500/50 text-cyan-400 hover:border-cyan-400'}`} title={isMuted ? "Unmute" : "Mute"}>{isMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}</button>}
                {isAdmin && <Link to={`/business/${campground.id}`} className="px-6 py-2 bg-gray-800 text-cyan-400 border border-cyan-500/50 rounded hover:border-cyan-400 transition"><Settings className="w-4 h-4 inline mr-2" />MANAGE</Link>}
              </div>
            </div>
          </div>
          
          {/* Quick actions with neon borders */}
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex flex-wrap gap-3">
              {campground.businessPhone && <a href={`tel:${campground.businessPhone}`} className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-gray-300 rounded border border-pink-500/30 hover:border-pink-500 hover:text-pink-400 transition"><Phone className="w-4 h-4" />Call</a>}
              {campground.websiteUrlUrl && <a href={campground.websiteUrlUrl} target="_blank" className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-gray-300 rounded border border-purple-500/30 hover:border-purple-500 hover:text-purple-400 transition"><Globe className="w-4 h-4" />Website</a>}
              {campground.latitude && <a href={`https://www.google.com/maps/dir/?api=1&destination=${campground.latitude},${campground.longitude}`} target="_blank" className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-gray-300 rounded border border-cyan-500/30 hover:border-cyan-500 hover:text-cyan-400 transition"><Navigation className="w-4 h-4" />Directions</a>}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-purple-500/20"><span className="text-xs text-purple-400 mr-1">Also check:</span><a href={`https://thedyrt.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 py-1.5 bg-gray-900 text-gray-300 rounded border border-pink-500/30 text-xs hover:border-pink-500 hover:text-pink-400 transition">🏕️ The Dyrt</a><a href={`https://www.hipcamp.com/en-US/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 py-1.5 bg-gray-900 text-gray-300 rounded border border-cyan-500/30 text-xs hover:border-cyan-500 hover:text-cyan-400 transition">🌿 Hipcamp</a></div>
          </div>
        </div>
      )}

      {/* CLASSIC THEME: Original layout */}
      {!isModern && !isRustic && !isCoastal && !isAdventure && !isMinimal && !isMagazine && !isRetro && !isNeon && (
        <>
          <button onClick={() => navigate('/campgrounds')} className="flex items-center text-gray-600 hover:text-gray-900 mb-6"><ChevronLeft className="w-5 h-5" /><span>Back to Campgrounds</span></button>

          {/* Header */}
          <div className={themeStyles.header}>
            <div className={"h-72 md:h-96 bg-gradient-to-br from-green-400 to-blue-500 relative"}>
          {campground.imageUrl ? <img src={campground.imageUrl.startsWith("http") ? campground.imageUrl : `${campground.imageUrl}`} alt={campground.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-32 h-32 text-white/50" /></div>}
          {isAdmin && <div className="absolute top-4 left-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">⭐ Admin</div>}
          {campground.verificationStatus === "VERIFIED" && <div className="absolute top-16 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"><Check className="w-4 h-4" />Verified Business</div>}
          {isAdmin && <Link to={`/business/${campground.id}`} className="absolute top-16 right-4 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg shadow-lg transition flex items-center gap-2"><Settings className="w-5 h-5" />Manage Business</Link>}         
          {isSiteAdmin && <button onClick={handleOpenEdit} className="absolute top-28 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition flex items-center gap-2"><Edit className="w-5 h-5" />Edit Campground</button>}
          {isSiteAdmin && <button onClick={handleDeleteCampground} className="absolute top-40 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg transition flex items-center gap-2"><Trash2 className="w-5 h-5" />Delete Campground</button>}
          {campground.verificationStatus === "PENDING" && <div className="absolute top-16 left-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">⏳ Claim Pending</div>}
          {user && (!campground.verificationStatus || campground.verificationStatus === "UNCLAIMED") && <button onClick={() => setShowClaimModal(true)} className="absolute bottom-4 left-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition flex items-center gap-2"><Award className="w-5 h-5" />Own this campground? Claim it</button>}
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{campground.name}<BadgeIcons /></h1>
              <div className="flex items-center text-gray-600 text-lg mb-2"><MapPin className="w-5 h-5 mr-2" /><span>{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</span></div>
              {avgRating > 0 && <div className="flex items-center gap-2 mb-2">{renderSmores(Math.round(avgRating))}<span className="text-gray-600">({reviews.length} reviews)</span></div>}
              {campground._count && <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-2"><span className="flex items-center gap-1"><Heart className="w-4 h-4" />{campground._count.followers} followers</span><span className="flex items-center gap-1"><Users className="w-4 h-4" />{campground._count.checkIns} check-ins</span></div>}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                {campground.businessPhone && <a href={`tel:${campground.businessPhone}`} className="flex items-center gap-1 hover:text-primary-600"><Phone className="w-4 h-4" />{campground.businessPhone}</a>}
                {campground.businessEmail && <a href={`mailto:${campground.businessEmail}`} className="flex items-center gap-1 hover:text-primary-600"><Mail className="w-4 h-4" />{campground.businessEmail}</a>}
                {campground.websiteUrl && <a href={campground.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary-600"><Globe className="w-4 h-4" />Website</a>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {user && <><ActionButton variant={isFavorited ? "primary" : "tertiary"} onClick={handleToggleFavorite} icon={<Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />} style={isFavorited ? { backgroundColor: '#dc2626' } : {}}>{isFavorited ? "Favorited" : "Favorite"}</ActionButton><ActionButton variant={inWishlist ? "primary" : "tertiary"} onClick={toggleWishlist} icon={<span>🧞</span>} style={inWishlist ? { backgroundColor: '#7c3aed' } : {}}>{inWishlist ? "Wishlisted" : "Wishlist"}</ActionButton><ActionButton variant="primary" onClick={() => setShowCheckInModal(true)} icon={<Calendar className="w-4 h-4" />} style={{ backgroundColor: accentColor }}>Check In</ActionButton><ActionButton variant="primary" onClick={() => navigate(getTripUrl())} icon={<MapPinned className="w-4 h-4" />} style={{ backgroundColor: '#16a34a' }}>Plan a Trip</ActionButton><ActionButton variant="ghost" onClick={toggleMute} icon={isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />} className="text-gray-600" /></>}
              {<CampspotBookButton campgroundId={campground.id} campspotSlug={campground.name} variant="classic" />}
              {!campground.campspotSlug && campground.bookingUrl && <a href={campground.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn flex items-center gap-2 bg-green-600 text-white hover:bg-green-700">Book Now<ExternalLink className="w-4 h-4" /></a>}

            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
            {campground.latitude && campground.longitude && <NavigationButtons lat={campground.latitude!} lng={campground.longitude!} name={campground.name} />}
          </div>
            <p className="text-sm text-gray-500 italic">Don't just take our word for it — see what others are saying:</p>
            <div className="flex gap-3">
              <a href={`https://thedyrt.com/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-orange-400 hover:text-orange-600 text-sm text-gray-600 transition">
                <span className="text-base">🏕️</span> The Dyrt
              </a>
              <a href={`https://www.hipcamp.com/en-US/search?q=${encodeURIComponent(campground.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-green-500 hover:text-green-600 text-sm text-gray-600 transition">
                <span className="text-base">🌿</span> Hipcamp
              </a>
            </div>
          </div>
        </div>
      </div>


          {/* Managed by indicator */}
          {(campground.claimedBy || (campground.admins && campground.admins.length > 0)) && (
            <div className="mt-6 flex items-center gap-3 text-sm text-gray-600">
              <span className="font-medium">Managed by:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {campground.claimedBy && (
                  <Link to={`/profile/${campground.claimedBy.username}`} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 transition">
                    {campground.claimedBy.profilePicture ? (
                      <img src={campground.claimedBy.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs">{campground.claimedBy.firstName?.[0]}</div>
                    )}
                    <span>{campground.claimedBy.firstName} {campground.claimedBy.lastName}</span>
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Owner</span>
                  </Link>
                )}
                {campground.admins?.filter(a => a.user.id !== campground.claimedBy?.id).slice(0, 3).map(admin => (
                  <Link key={admin.id} to={`/profile/${admin.user.username}`} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 transition">
                    {admin.user.profilePicture ? (
                      <img src={admin.user.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">{admin.user.firstName?.[0]}</div>
                    )}
                    <span>{admin.user.firstName}</span>
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{admin.role}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Featured Announcements Banner - Class B+ */}
      {featuredAnnouncements.length > 0 && (campground.tier === 'CLASS_B' || campground.tier === 'CLASS_A') && (
        <div className={`${
          isAdventure ? 'bg-gray-800' : 
          isNeon ? 'bg-gray-900' : 
          isMagazine ? 'bg-gray-900' :
          isRetro ? 'bg-amber-100 border-4 border-amber-700' :
          isRustic ? 'bg-amber-100' :
          isCoastal ? 'bg-sky-100' :
          isMinimal ? 'bg-gray-50 border-y border-gray-200' :
          isModern ? 'bg-white shadow-lg' :
          'bg-gradient-to-r from-yellow-50 to-orange-50 border-y border-yellow-200'
        } py-4`}>
          <div className={`${
            isModern ? 'max-w-6xl' : 
            isMinimal ? 'max-w-4xl' : 
            isMagazine ? 'max-w-6xl' :
            'max-w-5xl'
          } mx-auto px-4`}>
            {featuredAnnouncements.map((announcement, idx) => {
              const isUrgent = announcement.priority === 'URGENT';
              const isImportant = announcement.priority === 'IMPORTANT';
              
              return (
                <div 
                  key={announcement.id} 
                  className={`${idx > 0 ? 'mt-3' : ''} rounded-lg p-4 ${
                    isUrgent 
                      ? (isAdventure || isNeon ? 'bg-red-900/50 border border-red-500' : 'bg-red-100 border-2 border-red-500') 
                      : isImportant 
                        ? (isAdventure || isNeon ? 'bg-orange-900/50 border border-orange-500' : 'bg-orange-100 border-2 border-orange-400')
                        : announcement.isPinned
                          ? (isAdventure || isNeon ? 'bg-yellow-900/30 border border-yellow-500/50' : 'bg-yellow-50 border-2 border-yellow-400')
                          : (isAdventure || isNeon ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200')
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 p-2 rounded-full ${
                      isUrgent 
                        ? 'bg-red-500 text-white' 
                        : isImportant 
                          ? 'bg-orange-500 text-white'
                          : announcement.isPinned
                            ? 'bg-yellow-500 text-white'
                            : (isAdventure || isNeon ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')
                    }`}>
                      {isUrgent ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      ) : isImportant ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {isUrgent && <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500 text-white">🚨 URGENT</span>}
                        {isImportant && !isUrgent && <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-500 text-white">⚠️ IMPORTANT</span>}
                        {announcement.isPinned && !isUrgent && !isImportant && <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-500 text-yellow-900">📌 PINNED</span>}
                        <h4 className={`font-bold text-lg ${isAdventure || isNeon ? 'text-white' : isUrgent ? 'text-red-900' : isImportant ? 'text-orange-900' : 'text-gray-900'}`}>{announcement.title}</h4>
                      </div>
                      <p className={`${isAdventure || isNeon ? 'text-gray-300' : isUrgent ? 'text-red-800' : isImportant ? 'text-orange-800' : 'text-gray-600'} line-clamp-2`}>{announcement.content}</p>
                      <p className={`text-xs mt-2 ${isAdventure || isNeon ? 'text-gray-500' : 'text-gray-400'}`}>
                        Posted {new Date(announcement.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {/* Image thumbnail if exists */}
                    {announcement.imageUrl && (
                      <div className="flex-shrink-0 hidden sm:block">
                        <img 
                          src={announcement.imageUrl.startsWith('http') ? announcement.imageUrl : `${announcement.imageUrl}`} 
                          alt="" 
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs - Theme-aware */}
      <div className={
        isModern ? "max-w-6xl mx-auto px-4" : 
        isRustic ? "max-w-5xl mx-auto px-4" : 
        isCoastal ? "max-w-5xl mx-auto px-4" : 
        isAdventure ? "max-w-5xl mx-auto px-4 bg-gray-900" : 
        isMinimal ? "max-w-4xl mx-auto px-8" : 
        isMagazine ? "max-w-6xl mx-auto px-4 lg:px-8 bg-white -mt-1" :
        isRetro ? "max-w-5xl mx-auto px-4 pb-8 bg-amber-50" :
        isNeon ? "max-w-5xl mx-auto px-4 bg-gray-950" :
        ""
      }>
        <div className={
          isModern ? "bg-white rounded-2xl shadow-xl overflow-hidden" : 
          isRustic ? "bg-amber-100 border-2 border-amber-400 rounded-lg overflow-hidden" : 
          isCoastal ? "bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-sky-100 overflow-hidden" : 
          isAdventure ? "bg-gray-800 border border-gray-700 rounded-lg overflow-hidden" : 
          isMinimal ? "border-b border-gray-100" : 
          isMagazine ? "bg-white border-l-4 border-gray-900 shadow-xl overflow-hidden" :
          isRetro ? "bg-white border-4 border-amber-800 rounded-lg overflow-hidden shadow-xl" :
          isNeon ? "bg-gray-900 border border-purple-500/30 rounded-lg overflow-hidden shadow-xl shadow-purple-500/10" :
          "bg-white rounded-lg shadow-lg overflow-hidden"
        }>
          {/* Weather Section - Above Tabs */}
          {campground.latitude && campground.longitude && (
            <div className="p-4 border-b border-gray-200">
              <CampgroundWeather latitude={campground.latitude} longitude={campground.longitude} />
              <CampgroundBadgeDisplay campgroundId={campground.id} userId={user?.id} />
            </div>
          )}
          
          <div className={themeStyles.tabs + " overflow-x-auto"}>
            <div className="flex">{ALL_TABS.map(tab => { 
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const TabIcon = tab.icon;
              const isLocked = !user && !PUBLIC_TABS.includes(tab.id);
              return (
                <button 
                  key={tab.id} 
                  onClick={() => {
                    if (!user && !PUBLIC_TABS.includes(tab.id)) {
                      navigate('/login', { state: { from: `/campgrounds/${id}` } });
                      return;
                    }
                    setActiveTab(tab.id);
                  }} 
                  className={`flex items-center gap-2 px-4 md:px-6 py-4 font-medium whitespace-nowrap transition ` + 
                    (isModern 
                      ? (isActive ? 'bg-gray-900 text-white rounded-full m-1' : 'text-gray-600 hover:bg-gray-100 rounded-full m-1') 
                      : isRustic 
                        ? (isActive ? 'bg-amber-700 text-white' : 'text-amber-800 hover:bg-amber-200') 
                        : isCoastal
                          ? (isActive ? 'bg-sky-500 text-white rounded-full m-1' : 'text-sky-700 hover:bg-sky-50 rounded-full m-1')
                          : isAdventure
                            ? (isActive ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' : 'text-gray-400 hover:text-orange-400')
                            : isMinimal
                              ? (isActive ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent')
                              : isMagazine
                                ? (isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')
                                : isRetro
                                  ? (isActive ? 'bg-amber-800 text-white rounded' : 'text-amber-800 hover:bg-amber-100')
                                  : isNeon
                                    ? (isActive ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded' : 'text-purple-400 hover:text-pink-400')
                                    : (isActive ? 'border-b-2' : 'border-b-2 border-transparent text-gray-600 hover:text-gray-900')
                    )
                  }
                  style={!isModern && !isRustic && !isCoastal && !isAdventure && !isMinimal && !isMagazine && !isRetro && !isNeon && isActive ? { borderColor: accentColor, color: accentColor } : {}}
                >
                  {Icon && <Icon className="w-5 h-5" />}
                  <span className="hidden sm:inline">{tab.label}</span>
                    {isLocked && <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 ml-1 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                </button>
              ); 
            })}</div>
          </div>
        </div>

        <div className={
          isModern ? 'p-8' : 
          isRustic ? 'p-6 bg-amber-50' : 
          isCoastal ? 'p-6' : 
          isAdventure ? 'p-6 bg-gray-900 text-white' : 
          isMinimal ? 'py-8' : 
          isMagazine ? 'p-8 bg-gray-50' :
          isRetro ? 'p-6 bg-amber-50' :
          isNeon ? 'p-6 bg-gray-950 text-gray-200' :
          'p-6'
        }>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {campground.description && <div><h3 className="text-xl font-bold mb-3">About</h3><div className={(isAdventure || isNeon) ? "text-gray-300 prose max-w-none prose-invert" : "text-gray-700 prose max-w-none"} dangerouslySetInnerHTML={{ __html: campground.description }} /></div>}
              {campground.latitude && campground.longitude && (
                <div>
                  <h3 className="text-xl font-bold mb-3">Location</h3>
                  <div className={`rounded-lg overflow-hidden border ${isAdventure ? "border-gray-700" : isNeon ? "border-purple-500/30" : "border-gray-200"}`}>
                    <iframe src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10000!2d${campground.longitude}!3d${campground.latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zM!5e0!3m2!1sen!2sus!4v1600000000000!5m2!1sen!2sus`} width="100%" height="300" style={{ border: 0 }} allowFullScreen loading="lazy" title={`Map of ${campground.name}`} />
                    <div className={`p-4 flex flex-col sm:flex-row gap-3 items-center justify-between ${isAdventure ? "bg-gray-800" : isNeon ? "bg-gray-900" : "bg-white"}`}>
                      <div className={(isAdventure || isNeon) ? "text-gray-300 text-sm" : "text-gray-600 text-sm"}><span className="font-medium">{(() => {
                  const loc = campground.location || '';
                  const city = (campground as any).city || '';
                  const zip = (campground as any).zipCode || '';
                  const state = campground.state || '';
                  const cleanLoc = loc.replace(/,?\s*[A-Z]{2}$/, '').trim();
                  // Build: "Street, City, State Zip"
                  let line = cleanLoc;
                  if (city && city !== cleanLoc) line += (line ? ', ' : '') + city;
                  if (state) line += (line ? ', ' : '') + state;
                  if (zip) line += ' ' + zip;
                  return line.trim();
                })()}</span><span className={(isAdventure || isNeon) ? "text-gray-500 ml-2" : "text-gray-400 ml-2"}>({campground.latitude.toFixed(4)}, {campground.longitude.toFixed(4)})</span></div>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${campground.latitude},${campground.longitude}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex items-center gap-2"><Navigation className="w-4 h-4" />Get Driving Directions</a>
                    </div>
                  </div>
                </div>
              )}
              {campground.checkIns && campground.checkIns.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-3 flex items-center gap-2"><Users className="w-5 h-5" />Currently Checked In ({campground.checkIns.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {campground.checkIns.map(ci => (
                      <div key={ci.id} className={`border rounded-lg p-4 flex items-center gap-3 ${isAdventure ? "border-gray-700 bg-gray-800" : isNeon ? "border-purple-500/30 bg-gray-900" : ""}`}>
                        {ci.user.profilePicture ? <img src={`${ci.user.profilePicture}`} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center"><span className="text-primary-600 font-bold">{ci.user.firstName[0]}{ci.user.lastName[0]}</span></div>}
                        <div><Link to={`/profile/${ci.user.username}`} className="font-semibold hover:text-primary-600">{ci.user.firstName} {ci.user.lastName}</Link>{ci.siteNumber && <p className={(isAdventure || isNeon) ? "text-sm text-gray-400" : "text-sm text-gray-600"}>Site {ci.siteNumber}</p>}<p className={isAdventure ? "text-xs text-gray-500" : "text-xs text-gray-500"}>{formatDate(ci.checkInDate)}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Things to Do Nearby */}
              <ThingsToDoSection campgroundId={campground.id} campgroundName={campground.name} isAdmin={isAdmin} userInterests={userInterests} />
              {isAdmin && <CampgroundBadgeCreator campgroundId={campground.id} />}
              
              {/* Community - Followers & Campers */}
              <CampgroundCommunity campgroundId={campground.id} campgroundName={campground.name} />
            </div>
          )}


          {/* Map Tab */}
          {activeTab === 'map' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Campground Map</h3>
                {isAdmin && campgroundMapUrl && <button onClick={handleDeleteMap} className="btn btn-sm bg-red-500 text-white hover:bg-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4" />Delete Map</button>}
              </div>
              {(campgroundMapUrl || campground.campgroundMapUrl) ? (
                <div>
                  <div className={`rounded-lg overflow-hidden border ${isAdventure ? "border-gray-700" : isNeon ? "border-purple-500/30" : "border-gray-200"}`}>
                    {(() => {
                      const mapUrl = campgroundMapUrl || campground.campgroundMapUrl || '';
                      const lower = mapUrl.toLowerCase();
                      const isImage = lower.includes('cloudinary') && (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp'));
                      const isPdf = lower.endsWith('.pdf');
                      
                      if (isImage) {
                        return <img src={mapUrl} alt={`${campground.name} Map`} className="w-full h-auto cursor-pointer" onClick={() => window.open(mapUrl, '_blank')} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                      } else if (isPdf) {
                        return (
                          <div className="p-8 text-center bg-gray-50">
                            <Map className="w-16 h-16 mx-auto mb-4 text-primary-500" />
                            <p className="text-gray-700 mb-4">This campground has a PDF site map available</p>
                            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" />View PDF Map</a>
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-8 text-center bg-gray-50">
                            <Map className="w-16 h-16 mx-auto mb-4 text-primary-500" />
                            <p className="text-gray-700 mb-4">This campground has a site map available on their website</p>
                            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" />View Map on Website</a>
                          </div>
                        );
                      }
                    })()}
                  </div>
                  {campground.campgroundMapUrl && !campgroundMapUrl && (
                    <p className={`text-sm mt-2 ${isAdventure || isNeon ? 'text-gray-500' : 'text-gray-400'}`}>
                      <a href={campground.campgroundMapUrl} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />View original source</a>
                    </p>
                  )}
                </div>
              ) : (
                <div className={`text-center py-12 rounded-lg border-2 border-dashed ${isAdventure ? "bg-gray-800 border-gray-600" : isNeon ? "bg-gray-900 border-purple-500/30" : "bg-gray-50 border-gray-300"}`}>
                  <Map className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className={(isAdventure || isNeon) ? "text-gray-400 mb-2" : "text-gray-500 mb-2"}>No campground map has been provided yet</p>
                  {!isAdmin && <p className={(isAdventure || isNeon) ? "text-sm text-gray-500" : "text-sm text-gray-400"}>Check back later for a map of the campground layout</p>}
                </div>
              )}
              {isAdmin && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">⭐ Admin: Upload Campground Map</h4>
                  <p className="text-sm text-yellow-700 mb-4">Upload a map image showing the campground layout, site locations, amenities, etc.</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="file" accept="image/*" onChange={(e) => setMapFile(e.target.files?.[0] || null)} className="input flex-1" />
                    <button onClick={handleUploadMap} disabled={!mapFile || uploadingMap} className="btn btn-primary disabled:opacity-50 flex items-center gap-2"><Upload className="w-4 h-4" />{uploadingMap ? 'Uploading...' : 'Upload Map'}</button>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Amenities Tab */}
          {activeTab === 'amenities' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold mb-3">Amenities & Features</h3>
              {campground.amenities?.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {campground.amenities.map(a => (
                    <div key={a} className={`flex items-center gap-2 rounded-lg p-3 ${isAdventure ? "bg-gray-800 text-white" : isNeon ? "bg-gray-900 text-purple-300 border border-purple-500/30" : "bg-gray-50"}`}>
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="capitalize">{a.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-12 rounded-lg border-2 border-dashed ${isAdventure ? "bg-gray-800 border-gray-600" : isNeon ? "bg-gray-900 border-purple-500/30" : "bg-gray-50 border-gray-300"}`}>
                  <Check className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className={(isAdventure || isNeon) ? "text-gray-400" : "text-gray-500"}>No amenities listed yet</p>
                </div>
              )}
            </div>
          )}

          {/* Threads Tab */}
          {activeTab === 'threads' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Community Threads</h3>
                {user && (
                  <Link to={`/feed?campground=${campground.id}`} className="btn btn-primary btn-sm">
                    <Plus className="w-4 h-4 mr-1" />Start Thread
                  </Link>
                )}
              </div>
              {threads.length > 0 ? (
                threads.map(t => (
                  <Link key={t.id} to={`/threads/${t.id}`} className="block border rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex items-start gap-3">
                      {t.author.profilePicture ? (
                        <img src={`${t.author.profilePicture}`} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-bold text-sm">{t.author.firstName[0]}{t.author.lastName[0]}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-bold text-lg text-gray-900 hover:text-primary-600">{t.title}</h4>
                        {t.content && <p className="text-gray-600 mt-1 line-clamp-2">{t.content}</p>}
                        {t.imageUrl && (
                          <div className="mt-1 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                            <img src={t.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover border-2 border-amber-300" />
                            <span className="text-xs font-semibold text-amber-700">Badge</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>{t.author.firstName} {t.author.lastName}</span>
                          <span>{formatDate(t.createdAt)}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" />{t._count.posts} replies</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No threads yet</p>
                  <p className="text-sm mt-2">Be the first to start a discussion about this campground!</p>
                </div>
              )}
            </div>
          )}

          {/* News Tab */}
          {activeTab === 'news' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">News & Announcements</h3>{isAdmin && <button onClick={() => setShowAnnouncementModal(true)} className="btn btn-primary btn-sm"><Plus className="w-4 h-4 mr-1" />Post</button>}</div>
              {announcements.length > 0 ? announcements.map(a => {
                const priorityStyles: Record<string, { border: string; bg: string; badge: string; badgeBg: string }> = {
                  URGENT: { border: 'border-red-500 border-2', bg: 'bg-red-50', badge: '🚨 URGENT', badgeBg: 'bg-red-500 text-white' },
                  IMPORTANT: { border: 'border-orange-400 border-2', bg: 'bg-orange-50', badge: '⚠️ Important', badgeBg: 'bg-orange-500 text-white' },
                  NORMAL: { border: 'border-gray-200', bg: '', badge: '', badgeBg: '' },
                  LOW: { border: 'border-gray-200', bg: 'bg-gray-50', badge: '', badgeBg: '' },
                };
                const style = priorityStyles[a.priority] || priorityStyles.NORMAL;
                return (
                  <div key={a.id} className={`border rounded-lg p-4 mb-3 ${a.isPinned ? "border-yellow-400 bg-yellow-50" : `${style.border} ${style.bg}`}`}>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {a.isPinned && <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full">📌 Pinned</span>}
                      {style.badge && <span className={`text-xs px-2 py-1 rounded-full ${style.badgeBg}`}>{style.badge}</span>}
                    </div>
                    <h4 className="font-bold text-lg mb-2">{a.title}</h4>
                    <p className="text-gray-700 mb-3">{a.content}</p>
                    {a.imageUrl && <img src={a.imageUrl.startsWith('http') ? a.imageUrl : `${a.imageUrl}`} alt="" className="w-full rounded-lg mb-3 max-h-64 object-cover" />}
                    <p className="text-sm text-gray-500">Posted by {a.author.firstName} {a.author.lastName} • {formatDate(a.createdAt)}</p>
                  </div>
                );
              }) : <div className="text-center py-12 text-gray-500"><Megaphone className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>No announcements yet</p></div>}
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <>
            <LocationEventsCalendar
              locationId={campground.id}
              locationType="campground"
              canManage={isAdmin || isOwner || false}
              locationName={campground.name}
            />
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Upcoming Events</h3>{isAdmin && <button onClick={() => setShowEventModal(true)} className="btn btn-primary btn-sm"><Plus className="w-4 h-4 mr-1" />Create</button>}</div>
              {events.length > 0 ? events.map(e => (
                <div key={e.id} className="border rounded-lg p-4 flex gap-4">
                  <div className="bg-primary-100 text-primary-600 rounded-lg p-3 text-center min-w-[80px]"><p className="text-2xl font-bold">{new Date(e.startDate).getDate()}</p><p className="text-sm">{new Date(e.startDate).toLocaleDateString('en-US', { month: 'short' })}</p></div>
                  <div className="flex-1"><h4 className="font-bold text-lg">{e.title}</h4>{e.description && <p className="text-gray-600 mt-1">{e.description}</p>}<div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500"><span className="flex items-center gap-1"><Clock className="w-4 h-4" />{new Date(e.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>{e.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{e.location}</span>}</div></div>
                </div>
              )) : <div className="text-center py-12 text-gray-500"><Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>No upcoming events</p></div>}
            </div>
            </>
          )}

          {/* Photos Tab */}
          {activeTab === 'photos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Photos</h3>{user && <button onClick={() => setShowPhotoModal(true)} className="btn btn-primary btn-sm"><Upload className="w-4 h-4 mr-1" />Submit</button>}</div>
              {isAdmin && pendingPhotos.length > 0 && (
                <div className="mb-6"><h4 className="font-bold mb-3 text-yellow-600">⏳ Pending ({pendingPhotos.length})</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{pendingPhotos.map(p => (<div key={p.id} className="border-2 border-yellow-400 rounded-lg overflow-hidden"><img src={`${p.imageUrl}`} alt="" className="w-full h-32 object-cover" /><div className="p-2 bg-yellow-50"><p className="text-xs text-gray-600 truncate">{p.user.firstName}</p><div className="flex gap-1 mt-2"><button onClick={() => handleReviewPhoto(p.id, 'APPROVED')} className="flex-1 btn btn-sm bg-green-500 text-white hover:bg-green-600"><Check className="w-3 h-3" /></button><button onClick={() => handleReviewPhoto(p.id, 'REJECTED')} className="flex-1 btn btn-sm bg-red-500 text-white hover:bg-red-600"><X className="w-3 h-3" /></button></div></div></div>))}</div></div>
              )}
              {photos.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{photos.map(p => (<div key={p.id} className="rounded-lg overflow-hidden group relative"><img src={`${p.imageUrl}`} alt={p.caption || ''} className="w-full h-48 object-cover" /><div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition">{p.caption && <p className="text-white text-sm">{p.caption}</p>}<p className="text-white/70 text-xs">by {p.user.firstName}</p></div></div>))}</div> : <div className="text-center py-12 text-gray-500"><Camera className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>No photos yet</p></div>}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4"><div><h3 className="text-xl font-bold">Reviews</h3>{avgRating > 0 && <div className="flex items-center gap-2 mt-1">{renderSmores(Math.round(avgRating))}<span className="text-gray-600">{avgRating.toFixed(1)} avg ({reviews.length})</span></div>}</div>{user && <button onClick={() => setShowReviewModal(true)} className="btn btn-primary btn-sm"><Star className="w-4 h-4 mr-1" />Campground Report</button>}</div>
              {reviews.length > 0 ? reviews.map(r => (
                <div key={r.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    {r.user.profilePicture ? <img src={`${r.user.profilePicture}`} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center"><span className="text-primary-600 font-bold text-sm">{r.user.firstName[0]}{r.user.lastName[0]}</span></div>}
                    <div className="flex-1"><div className="flex items-center justify-between"><Link to={`/profile/${r.user.username}`} className="font-semibold hover:text-primary-600">{r.user.firstName} {r.user.lastName}</Link>{renderSmores(r.rating)}</div>{r.title && <h4 className="font-medium mt-1">{r.title}</h4>}{r.review && <p className="text-gray-700 mt-2">{r.review}</p>}<p className="text-sm text-gray-500 mt-2">{formatDate(r.createdAt)}{r.visitDate && ` • Visited ${formatDate(r.visitDate)}`}</p></div>
                  </div>
                </div>
              )) : <div className="text-center py-12 text-gray-500"><Star className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>No reviews yet — be the first!</p></div>}
              <CampgroundReportLeaderboard campgroundId={campground?.id} compact />
              {showReviewModal && campground && (
                <div className="mt-6 border rounded-2xl p-5 bg-gray-50">
                  <h4 className="font-bold text-gray-900 mb-4">📋 Submit Campground Report</h4>
                  <SmartReviewForm
                    campgroundId={campground.id}
                    campgroundName={campground.name}
                    onSubmitted={() => { setShowReviewModal(false); loadTabData(); }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Stickers Tab */}
          {activeTab === 'campfire' && campground && (
            <CampfireChannel
              campgroundId={campground.id}
              campgroundName={campground.name}
              isAdmin={isAdmin}
            />
          )}
          {activeTab === 'vibe' && campground && (
            <div className="space-y-4">
              <RigStressScore campgroundId={campground.id} />
              <PredictiveSiteSelector campgroundId={campground.id} campgroundName={campground.name} />
              <CampgroundSecrets campgroundId={campground.id} />
              <AskTheCampfire campgroundId={campground.id} campgroundName={campground.name} />
              <RoastMode campgroundId={campground.id} campgroundName={campground.name} />
              <CampgroundVibeCard campgroundId={campground.id} campgroundName={campground.name} isAdmin={isAdmin} />
              <HitchRigCheck campgroundId={campground.id} campgroundName={campground.name} />
              <CampersLikeYou />
            </div>
          )}
          {activeTab === 'ask-hitch' && campground && (
            <HitchCampgroundChat
              campgroundId={campground.id}
              campgroundName={campground.name}
              campground={campground}
            />
          )}
          {activeTab === 'stickers' && (
            <div>
              <h3 className="text-xl font-bold mb-4">Collectible Stickers</h3>
              {campground.stickers && campground.stickers.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{campground.stickers.map(s => (<div key={s.id} className="border rounded-lg p-4 text-center hover:shadow-md transition"><div className="text-4xl mb-2">{s.emoji || '🏕️'}</div><p className="font-semibold">{s.name}</p>{s.description && <p className="text-sm text-gray-500 mt-1">{s.description}</p>}<p className="text-xs text-gray-400 mt-2">{s._count?.userStickers || 0} earned</p></div>))}</div> : <div className="text-center py-12 text-gray-500"><Award className="w-16 h-16 mx-auto mb-4 text-gray-300" /><p>No stickers available</p></div>}
            </div>
          )}
        </div>
        </div>

      {/* Check-In Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Check In</h3><button onClick={() => setShowCheckInModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date *</label><input type="date" value={checkInData.checkInDate} onChange={e => setCheckInData({ ...checkInData, checkInDate: e.target.value })} className="input w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Check-out Date</label><input type="date" value={checkInData.checkOutDate} onChange={e => setCheckInData({ ...checkInData, checkOutDate: e.target.value })} className="input w-full" min={checkInData.checkInDate} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Site Number</label><input type="text" placeholder="e.g., A-15" value={checkInData.siteNumber} onChange={e => setCheckInData({ ...checkInData, siteNumber: e.target.value })} className="input w-full" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setShowCheckInModal(false)} className="btn btn-secondary flex-1">Cancel</button><button onClick={handleCheckIn} className="btn btn-primary flex-1">I'm Here! 📍</button></div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Write a Review</h3><button onClick={() => setShowReviewModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Rating *</label>{renderSmores(reviewData.rating, true, r => setReviewData({ ...reviewData, rating: r }))}</div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><input type="text" placeholder="Summarize your experience" value={reviewData.title} onChange={e => setReviewData({ ...reviewData, title: e.target.value })} className="input w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Review</label><textarea placeholder="Share your experience..." value={reviewData.review} onChange={e => setReviewData({ ...reviewData, review: e.target.value })} className="input w-full" rows={4} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label><input type="date" value={reviewData.visitDate} onChange={e => setReviewData({ ...reviewData, visitDate: e.target.value })} className="input w-full" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setShowReviewModal(false)} className="btn btn-secondary flex-1">Cancel</button><button onClick={handleSubmitReview} disabled={reviewData.rating === 0} className="btn btn-primary flex-1 disabled:opacity-50">Submit</button></div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Submit a Photo</h3><button onClick={() => setShowPhotoModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Photo *</label><input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="input w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Caption</label><input type="text" placeholder="Add a caption..." value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} className="input w-full" /></div>
              <p className="text-sm text-gray-500">📸 Your photo will be reviewed before being published.</p>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setShowPhotoModal(false)} className="btn btn-secondary flex-1">Cancel</button><button onClick={handleSubmitPhoto} disabled={!photoFile} className="btn btn-primary flex-1 disabled:opacity-50">Submit</button></div>
          </div>
        </div>
      )}

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Post Announcement</h3><button onClick={() => setShowAnnouncementModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input type="text" placeholder="Announcement title" value={announcementData.title} onChange={e => setAnnouncementData({ ...announcementData, title: e.target.value })} className="input w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Content *</label><textarea placeholder="Write your announcement..." value={announcementData.content} onChange={e => setAnnouncementData({ ...announcementData, content: e.target.value })} className="input w-full" rows={4} /></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="isPinned" checked={announcementData.isPinned} onChange={e => setAnnouncementData({ ...announcementData, isPinned: e.target.checked })} /><label htmlFor="isPinned" className="text-sm text-gray-700">📌 Pin this</label></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Priority</label><select value={announcementData.priority} onChange={e => setAnnouncementData({ ...announcementData, priority: e.target.value as any })} className="input w-full"><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="IMPORTANT">⚠️ Important</option><option value="URGENT">🚨 Urgent</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label><input type="datetime-local" value={announcementData.scheduledAt} onChange={e => setAnnouncementData({ ...announcementData, scheduledAt: e.target.value })} className="input w-full" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setShowAnnouncementModal(false)} className="btn btn-secondary flex-1">Cancel</button><button onClick={handleSubmitAnnouncement} disabled={!announcementData.title || !announcementData.content} className="btn btn-primary flex-1 disabled:opacity-50">Post</button></div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Create Event</h3><button onClick={() => setShowEventModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input type="text" placeholder="Event title" value={eventData.title} onChange={e => setEventData({ ...eventData, title: e.target.value })} className="input w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea placeholder="Event details..." value={eventData.description} onChange={e => setEventData({ ...eventData, description: e.target.value })} className="input w-full" rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Start *</label><input type="datetime-local" value={eventData.startDate} onChange={e => setEventData({ ...eventData, startDate: e.target.value })} className="input w-full" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">End</label><input type="datetime-local" value={eventData.endDate} onChange={e => setEventData({ ...eventData, endDate: e.target.value })} className="input w-full" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label><input type="text" placeholder="e.g., Main Pavilion" value={eventData.location} onChange={e => setEventData({ ...eventData, location: e.target.value })} className="input w-full" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setShowEventModal(false)} className="btn btn-secondary flex-1">Cancel</button><button onClick={handleSubmitEvent} disabled={!eventData.title || !eventData.startDate} className="btn btn-primary flex-1 disabled:opacity-50">Create</button></div>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Claim This Campground</h3><button onClick={() => setShowClaimModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button></div>
            <p className="text-gray-600 mb-4">Submit a claim request to manage this campground's business page. Your request will be reviewed by our team.</p>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Email *</label><input type="email" placeholder="your@business.com" value={claimData.businessEmail} onChange={e => setClaimData({ ...claimData, businessEmail: e.target.value })} className="input w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Phone</label><input type="tel" placeholder="(555) 123-4567" value={claimData.businessPhone} onChange={e => setClaimData({ ...claimData, businessPhone: e.target.value })} className="input w-full" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setShowClaimModal(false)} className="btn btn-secondary flex-1">Cancel</button><button onClick={handleClaimSubmit} disabled={!claimData.businessEmail || claimSubmitting} className="btn btn-primary flex-1 disabled:opacity-50">{claimSubmitting ? "Submitting..." : "Submit Claim"}</button></div>
          </div>
        </div>
      )}

      {/* SITE ADMIN EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">✏️ Edit Campground</h2>
              <button onClick={() => setShowEditModal(false)}><X className="w-6 h-6 text-gray-500 hover:text-gray-900" /></button>
            </div>
            <div className="p-6 space-y-6">
              <section>
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Basic Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[['name','Name'],['location','Location'],['city','City'],['state','State'],['zipCode','Zip Code'],['latitude','Latitude'],['longitude','Longitude']].map(([k,label]) => (
                    <div key={k}><label className="block text-xs text-gray-500 mb-1">{label}</label><input className="w-full border rounded-lg px-3 py-2 text-sm" value={editForm[k] || ''} onChange={e => setEditForm({...editForm, [k]: e.target.value})} /></div>
                  ))}
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Main Photo</label>
                    <div className="flex gap-2 items-center flex-wrap">
                      {editForm.imageUrl && <img src={editForm.imageUrl} alt="" className="w-16 h-16 object-cover rounded" />}
                      <label className="cursor-pointer px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Upload Photo
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUploadEditPhoto(e.target.files[0])} />
                      </label>
                      <span className="text-xs text-gray-400">or paste URL:</span>
                      <input className="flex-1 border rounded-lg px-3 py-2 text-sm min-w-0" value={editForm.imageUrl || ''} onChange={e => setEditForm({...editForm, imageUrl: e.target.value})} placeholder="https://..." />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Campground Map</label>
                    <label className="cursor-pointer px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2 w-fit">
                      <Map className="w-4 h-4" /> Upload Map Image
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUploadEditMap(e.target.files[0])} />
                    </label>
                    {campgroundMapUrl && <p className="text-xs text-green-600 mt-1">✅ Map saved</p>}
                  </div>
                  <div className="md:col-span-2"><label className="block text-xs text-gray-500 mb-1">Description</label><textarea rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} /></div>
                </div>
              </section>
              <section>
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Contact & Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[['phone','Phone'],['businessPhone','Business Phone'],['businessEmail','Business Email'],['websiteUrl','Website URL'],['bookingUrl','Booking URL'],['campspotSlug','Campspot Slug'],['facebookUrl','Facebook'],['instagramUrl','Instagram'],['twitterUrl','Twitter'],['youtubeUrl','YouTube'],['tiktokUrl','TikTok']].map(([k,label]) => (
                    <div key={k}><label className="block text-xs text-gray-500 mb-1">{label}</label><input className="w-full border rounded-lg px-3 py-2 text-sm" value={editForm[k] || ''} onChange={e => setEditForm({...editForm, [k]: e.target.value})} /></div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">RV Specs</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[['maxAmpService','Max Amps'],['maxRvLength','Max RV Length (ft)'],['minRvYear','Min RV Year'],['pricePerNight','Price/Night ($)'],['seasonStart','Season Start'],['seasonEnd','Season End']].map(([k,label]) => (
                    <div key={k}><label className="block text-xs text-gray-500 mb-1">{label}</label><input className="w-full border rounded-lg px-3 py-2 text-sm" value={editForm[k] || ''} onChange={e => setEditForm({...editForm, [k]: e.target.value})} /></div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Amenities</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {([['hasWifi','📶 WiFi'],['hasShowers','🚿 Showers'],['hasRestrooms','🚻 Restrooms'],['hasElectricHookup','⚡ Electric Hookup'],['hasWaterHookup','💧 Water Hookup'],['hasSewerHookup','🚰 Sewer Hookup'],['hasDumpStation','♻️ Dump Station'],['hasLaundry','👕 Laundry'],['hasStore','🏪 Camp Store'],['hasPool','🏊 Pool'],['hasPullThrough','🚛 Pull-Through'],['hasBackIn','↩️ Back-In'],['isBigRigFriendly','🚌 Big Rig Friendly'],['isPetFriendly','🐾 Pet Friendly'],['isWaterfront','🌊 Waterfront']] as [string,string][]).map(([k,label]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!editForm[k]} onChange={e => setEditForm({...editForm, [k]: e.target.checked})} className="w-4 h-4 rounded" /><span className="text-sm">{label}</span></label>
                  ))}
                </div>
              </section>
            </div>
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">{editSaving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Sun Mar  1 11:38:04 CST 2026
