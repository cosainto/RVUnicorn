import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Megaphone, Calendar, Camera, Star, Award,
  BarChart3, Palette, Settings, Users, Eye, Heart, MapPin,
  ChevronLeft, Check, X, Clock, Bell, Shield, Plus, Trash2, Send, Image,
  Zap, TrendingUp, Compass, Lock, Sparkles, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import CampgroundMessaging from '../components/CampgroundMessaging';
import { uploadAndGetUrl } from '../utils/uploadMedia';

interface DashboardData {
  campground: any;
  stats: {
    followers: number;
    reviews: number;
    avgRating: number;
    photos: number;
    checkIns: number;
    threads: number;
    events: number;
    stickers: number;
  };
  recentActivity: { reviews: any[] };
  pendingItems: { photos: any[] };
  admins: any[];
}

// Tier labels keyed by BOTH the legacy CampgroundTier enum AND the Stripe-side
// tier names, so the page renders correctly regardless of which field we read.
// Stripe-side names are the primary source (set by the webhook + the
// stripeSub.tier String column); legacy enum entries exist as a fallback.
const TIER_LABELS: Record<string, { name: string; color: string; icon: string }> = {
  // Stripe-side tier names (primary)
  TRAILHEAD: { name: 'Trailhead', color: 'bg-gray-500', icon: '🏔️' },
  BASECAMP:  { name: 'Base Camp', color: 'bg-blue-500', icon: '🏕️' },
  SUMMIT:    { name: 'Summit', color: 'bg-amber-500', icon: '👑' },
  FOUNDING:  { name: 'Founding Partner', color: 'bg-orange-600', icon: '🦄' },
  // Legacy CampgroundTier enum fallback (kept for backwards compatibility)
  FREE:    { name: 'Trailhead', color: 'bg-gray-500', icon: '🏔️' },
  CLASS_C: { name: 'Base Camp', color: 'bg-blue-500', icon: '🏕️' },
  CLASS_B: { name: 'Base Camp', color: 'bg-blue-500', icon: '🏕️' },
  CLASS_A: { name: 'Summit', color: 'bg-amber-500', icon: '👑' },
};

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, tier: 'FREE' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, tier: 'FREE' },
  { id: 'events', label: 'Events', icon: Calendar, tier: 'FREE' },
  { id: 'photos', label: 'Photos', icon: Camera, tier: 'FREE' },
  { id: 'reviews', label: 'Reviews', icon: Star, tier: 'FREE' },
  { id: 'checkins', label: 'Check-ins', icon: Users, tier: 'FREE' },
  { id: 'threads', label: 'Threads', icon: MessageSquare, tier: 'FREE' },
  { id: 'messaging', label: 'Message Campers', icon: Send, tier: 'FREE' },
  { id: 'stickers', label: 'Stickers', icon: Award, tier: 'CLASS_B' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, tier: 'CLASS_A' },
  { id: 'branding', label: 'Branding', icon: Palette, tier: 'CLASS_B' },
  { id: 'settings', label: 'Settings', icon: Settings, tier: 'FREE' },
];

const tierLevel = (tier: string): number => {
  const levels: Record<string, number> = { FREE: 0, CLASS_C: 1, CLASS_B: 2, CLASS_A: 3 };
  return levels[tier] || 0;
};

/* ─── Sidebar nav group definitions ─── */
const SIDEBAR_GROUPS = [
  {
    label: 'COMMAND',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'announcements', label: 'Announcements', icon: Megaphone },
      { id: 'missionmode', label: 'Mission Mode', icon: Compass, link: true },
    ],
  },
  {
    label: 'ENGAGE',
    items: [
      { id: 'events', label: 'Events', icon: Calendar },
      { id: 'threads', label: 'Threads', icon: MessageSquare },
      { id: 'messaging', label: 'Message Campers', icon: Send },
      { id: 'photos', label: 'Photos', icon: Camera },
    ],
  },
  {
    label: 'MANAGE',
    items: [
      { id: 'reviews', label: 'Reviews', icon: Star },
      { id: 'checkins', label: 'Check-ins', icon: Users },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'GROW',
    items: [
      { id: 'stickers', label: 'Stickers', icon: Award, pro: true },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, pro: true },
      { id: 'branding', label: 'Branding', icon: Palette, pro: true },
      { id: 'hitch', label: 'Hitch Config', icon: Zap, pro: true },
      { id: 'trivia', label: 'Trivia', icon: Sparkles, pro: true },
    ],
  },
];

export default function BusinessBasecampPage() {
  const { campgroundId } = useParams<{ campgroundId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stripe subscription state — drives the sidebar buttons.
  const [stripeSub, setStripeSub] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);

  const refreshSubscription = async () => {
    if (!campgroundId) return;
    try {
      const { data } = await api.get(`/stripe/subscription/${campgroundId}`);
      setStripeSub(data.subscription || null);
    } catch { setStripeSub(null); }
  };

  useEffect(() => { refreshSubscription(); }, [campgroundId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCustomerPortal = async () => {
    if (!campgroundId) return;
    setPortalLoading(true);
    try {
      const { data } = await api.post('/stripe/create-portal', { campgroundId });
      if (data.url) window.location.href = data.url;
      else alert('Could not open billing portal');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const pauseForSeason = async () => {
    if (!campgroundId) return;
    if (!confirm('Pause your subscription for the season? You will not be billed while paused. Stripe will automatically resume billing in 6 months — or you can resume manually any time before then.')) return;
    setPauseLoading(true);
    try {
      await api.post('/stripe/pause', { campgroundId });
      await refreshSubscription();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to pause subscription');
    } finally {
      setPauseLoading(false);
    }
  };

  const resumeNow = async () => {
    if (!campgroundId) return;
    setPauseLoading(true);
    try {
      await api.post('/stripe/resume', { campgroundId });
      await refreshSubscription();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to resume subscription');
    } finally {
      setPauseLoading(false);
    }
  };

  // Trust the Stripe subscription as the source of truth for tier — the legacy
  // campground.tier enum (FREE/CLASS_C/CLASS_B/CLASS_A) doesn't know about the
  // Stripe-side names (BASECAMP/SUMMIT/FOUNDING) and can drift out of sync.
  const isPaused = stripeSub?.status === 'PAUSED';
  const isCancelling = stripeSub?.status === 'CANCELLING';
  const hasPaidStripeSub =
    stripeSub &&
    stripeSub.tier &&
    stripeSub.tier !== 'TRAILHEAD' &&
    stripeSub.status !== 'CANCELLED';
  const resumesAtLabel = stripeSub?.pauseResumesAt
    ? new Date(stripeSub.pauseResumesAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const cancelsAtLabel = stripeSub?.currentPeriodEnd
    ? new Date(stripeSub.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  // Pending plan change (Stripe defaults downgrades to "schedule at end of period").
  // The backend's GET /api/stripe/subscription enriches the response with this.
  const pendingChange = stripeSub?.pendingChange as { tier: string; effectiveAt: string } | null | undefined;
  const pendingChangeLabel = pendingChange?.effectiveAt
    ? new Date(pendingChange.effectiveAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const pendingChangeTierName = pendingChange ? (TIER_LABELS[pendingChange.tier]?.name || pendingChange.tier) : null;

  // 30-day Summit trial promo: every paid signup gets Summit-level access for
  // the first month regardless of which plan they picked. After the trial,
  // they drop to whatever they're paying for.
  const isInTrial = !!stripeSub?.isInTrial;
  const trialDaysRemaining = stripeSub?.trialDaysRemaining || 0;
  const paidTierName = stripeSub?.tier && TIER_LABELS[stripeSub.tier]
    ? TIER_LABELS[stripeSub.tier].name
    : null;
  const trialEndsAtLabel = stripeSub?.trialEndDate
    ? new Date(stripeSub.trialEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Tab-specific data
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);

  // Forms
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', isPinned: false, priority: 'NORMAL' as const, scheduledAt: '' });
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', description: '', startDate: '', endDate: '', location: '' });

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    businessEmail: '', businessPhone: '', bookingUrl: '', websiteUrl: '', description: '',
    hashtag: '', facebookUrl: '', instagramUrl: '', twitterUrl: '', youtubeUrl: '', tiktokUrl: '',
    theme: 'classic', accentColor: '#16a34a'
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Pro teaser dismiss
  const [proTeaserDismissed, setProTeaserDismissed] = useState(() => {
    try { return localStorage.getItem('proTeaserDismissed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    loadDashboard();
  }, [campgroundId]);

  useEffect(() => {
    if (data) {
      loadTabData();
    }
  }, [activeTab, data]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const { data: dashData } = await api.get(`/business/${campgroundId}/dashboard`);
      setData(dashData);
      setSettingsForm({
        businessEmail: dashData.campground.businessEmail || '',
        businessPhone: dashData.campground.businessPhone || '',
        bookingUrl: dashData.campground.bookingUrl || '',
        websiteUrl: dashData.campground.websiteUrl || '',
        description: dashData.campground.description || '',
        hashtag: dashData.campground.hashtag || '',
        facebookUrl: dashData.campground.facebookUrl || '',
        instagramUrl: dashData.campground.instagramUrl || '',
        twitterUrl: dashData.campground.twitterUrl || '',
        youtubeUrl: dashData.campground.youtubeUrl || '',
        tiktokUrl: dashData.campground.tiktokUrl || '',
        theme: dashData.campground.theme || 'classic',
        accentColor: dashData.campground.accentColor || '#16a34a'
      });
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    if (!campgroundId) return;
    try {
      switch (activeTab) {
        case 'announcements':
          const annRes = await api.get(`/campground-features/${campgroundId}/announcements`);
          setAnnouncements(annRes.data || []);
          break;
        case 'events':
          const evtRes = await api.get(`/campground-features/${campgroundId}/events`);
          setEvents(evtRes.data || []);
          break;
        case 'photos':
          const photoRes = await api.get(`/campground-features/${campgroundId}/photos`);
          setPhotos(photoRes.data || []);
          try {
            const pendingRes = await api.get(`/campground-features/${campgroundId}/photos/pending`);
            setPendingPhotos(pendingRes.data || []);
          } catch { setPendingPhotos([]); }
          break;
        case 'reviews':
          const revRes = await api.get(`/campground-features/${campgroundId}/reviews`);
          setReviews(revRes.data || []);
          break;
        case 'checkins':
          const ciRes = await api.get(`/campgrounds/${campgroundId}`);
          setCheckIns(ciRes.data.checkIns || []);
          break;
      }
    } catch (err) {
      console.error('Load tab data error:', err);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.content) return;
    try {
      await api.post(`/campground-features/${campgroundId}/announcements`, announcementForm);
      setShowAnnouncementForm(false);
      setAnnouncementForm({ title: '', content: '', isPinned: false });
      loadTabData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create announcement');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/campground-features/${campgroundId}/announcements/${id}`);
      loadTabData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title || !eventForm.startDate) return;
    try {
      await api.post(`/campground-features/${campgroundId}/events`, eventForm);
      setShowEventForm(false);
      setEventForm({ title: '', description: '', startDate: '', endDate: '', location: '' });
      loadTabData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create event');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await api.delete(`/campground-features/${campgroundId}/events/${id}`);
      loadTabData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleReviewPhoto = async (photoId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.put(`/campground-features/${campgroundId}/photos/${photoId}/review`, { status });
      loadTabData();
      loadDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to review photo');
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadAndGetUrl(photoFile, `rvunicorn/campgrounds/${campgroundId}`);
      await api.post(`/campground-features/${campgroundId}/photos`, {
        imageUrl: url,
        caption: photoCaption || undefined,
      });
      setPhotoFile(null);
      setPhotoCaption("");
      loadTabData();
      loadDashboard();
      alert("Photo uploaded!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;
    try {
      await api.delete(`/campground-features/${campgroundId}/photos/${photoId}`);
      loadTabData();
      loadDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete photo");
    }
  };

  const handleSetBanner = async (photoId: string) => {
    try {
      await api.put(`/campground-features/${campgroundId}/photos/${photoId}/set-banner`);
      loadDashboard();
      alert("Banner updated!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to set banner");
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put(`/business/${campgroundId}/settings`, settingsForm);
      alert('Settings saved!');
      loadDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const dismissProTeaser = () => {
    setProTeaserDismissed(true);
    try { localStorage.setItem('proTeaserDismissed', 'true'); } catch {}
  };

  /* ─── Loading / Error states ─── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#F8F6F2' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#C9A84C' }} />
          <p className="text-gray-600 font-medium">Loading command center...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#F8F6F2' }}>
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: '#1B2B4B' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1B2B4B' }}>Access Denied</h2>
          <p className="text-gray-600 mb-4">{error || 'You do not have access to this dashboard.'}</p>
          <button
            onClick={() => navigate('/campgrounds')}
            className="px-5 py-2.5 rounded-lg text-white font-medium transition hover:opacity-90"
            style={{ background: '#E8622A' }}
          >
            Back to Campgrounds
          </button>
        </div>
      </div>
    );
  }

  const { campground, stats, recentActivity, pendingItems, admins } = data;
  const tier = campground.tier || 'FREE';
  // Display name comes from the Stripe-side tier when available (Trailhead /
  // Base Camp / Summit / Founding Partner). Falls back to the legacy enum so
  // older campground rows that haven't been touched by the Stripe webhook
  // still render correctly. During the 30-day trial promo every paid plan
  // displays as Summit (the effectiveTier the backend computed).
  const displayTierKey = stripeSub?.effectiveTier && stripeSub.effectiveTier !== 'TRAILHEAD'
    ? stripeSub.effectiveTier
    : (stripeSub?.tier && stripeSub.tier !== 'TRAILHEAD' ? stripeSub.tier : tier);
  const tierInfo = TIER_LABELS[displayTierKey] || TIER_LABELS.FREE;
  const canAccess = (requiredTier: string) => tierLevel(tier) >= tierLevel(requiredTier);

  /* ─── Helpers ─── */
  const todaysEvents = events.filter((e: any) => {
    const d = new Date(e.startDate);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const isProTab = (id: string) => ['stickers', 'analytics', 'branding', 'hitch', 'trivia'].includes(id);

  /* ─── Pro feature teaser page ─── */
  const renderProTeaser = (icon: React.ReactNode, title: string, description: string, bullets: string[]) => (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: '#1B2B4B' }}>
          {icon}
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#1B2B4B' }}>{title}</h2>
        <p className="text-gray-500 mb-6">{description}</p>
        <ul className="text-left space-y-3 mb-8">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#C9A84C' }} />
              <span className="text-gray-700">{b}</span>
            </li>
          ))}
        </ul>
        <Link
          to={`/business/${campgroundId}/upgrade`}
          className="px-6 py-3 rounded-xl text-white font-semibold transition hover:opacity-90 shadow-lg"
          style={{ background: '#E8622A' }}
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );

  /* ─── Section header helper ─── */
  const SectionHeader = ({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) => (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1B2B4B' }}>
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#1B2B4B' }}>{title}</h2>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );

  /* ─── Card wrapper ─── */
  const Card = ({ children, className = '', ...props }: any) => (
    <div className={`bg-white rounded-xl shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );

  /* ─── Gold accent button ─── */
  const GoldButton = ({ children, onClick, className = '', ...props }: any) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-white font-medium text-sm transition hover:opacity-90 flex items-center gap-2 ${className}`}
      style={{ background: '#C9A84C' }}
      {...props}
    >
      {children}
    </button>
  );

  const CTAButton = ({ children, onClick, className = '', disabled = false, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-white font-medium text-sm transition hover:opacity-90 disabled:opacity-50 ${className}`}
      style={{ background: '#E8622A' }}
      {...props}
    >
      {children}
    </button>
  );

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-screen" style={{ background: '#F8F6F2' }}>

      {/* ─── SIDEBAR ─── */}
      <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: '#1B2B4B' }}>

        {/* Campground identity */}
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <h1 className="text-white font-bold text-lg leading-tight truncate">{campground.name}</h1>
          <span
            className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}
          >
            {tierInfo.icon} {tierInfo.name}
          </span>
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold tracking-widest text-white/40 uppercase px-2 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isPro = (item as any).pro;
                  const isLink = (item as any).link;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isLink && item.id === 'missionmode') {
                          navigate(`/organizer`);
                        } else {
                          setActiveTab(item.id);
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors"
                      style={{
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                        background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                        borderLeft: isActive ? '3px solid #C9A84C' : '3px solid transparent',
                      }}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {isPro && (
                        <span className="ml-auto text-[10px] font-medium whitespace-nowrap" style={{ color: '#C9A84C' }}>
                          Unlock with Pro
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Upgrade / Manage / Pause card */}
        <div className="p-3">
          <div
            className="rounded-xl p-4"
            style={{ border: '1.5px solid #C9A84C', background: 'rgba(201,168,76,0.06)' }}
          >
            {!hasPaidStripeSub ? (
              <>
                <p className="text-white font-bold text-sm mb-1">🦄 Go Pro</p>
                <p className="text-white/60 text-xs mb-3 leading-relaxed">
                  Unlock Hitch, analytics, branding & more
                </p>
                <Link
                  to={`/business/${campgroundId}/upgrade`}
                  className="block text-center w-full py-2 rounded-lg text-white text-sm font-semibold transition hover:opacity-90"
                  style={{ background: '#E8622A' }}
                >
                  Upgrade Now
                </Link>
              </>
            ) : isCancelling ? (
              <>
                <p className="text-white font-bold text-sm mb-1">⌛ Cancelling Soon</p>
                <p className="text-white/60 text-xs mb-3 leading-relaxed">
                  {cancelsAtLabel ? <>Your {tierInfo.name} subscription ends <span className="font-semibold text-white/80">{cancelsAtLabel}</span>. You still have full access until then.</> : 'Your subscription will end at period close.'}
                </p>
                <button
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="block text-center w-full py-2 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#10B981' }}
                >
                  {portalLoading ? 'Opening…' : '↺ Renew Subscription'}
                </button>
                <p className="text-white/40 text-[10px] text-center mt-2">Click to reactivate in the Stripe portal</p>
              </>
            ) : isPaused ? (
              <>
                <p className="text-white font-bold text-sm mb-1">🌙 Paused for the Season</p>
                <p className="text-white/60 text-xs mb-3 leading-relaxed">
                  {resumesAtLabel ? <>Auto-resumes <span className="font-semibold text-white/80">{resumesAtLabel}</span>. Resume sooner any time.</> : 'You can resume any time.'}
                </p>
                <button
                  onClick={resumeNow}
                  disabled={pauseLoading}
                  className="block text-center w-full py-2 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 mb-2"
                  style={{ background: '#10B981' }}
                >
                  {pauseLoading ? 'Resuming…' : '▶ Resume Now'}
                </button>
                <button
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="block text-center w-full py-1.5 rounded-lg text-white/70 text-xs font-medium transition hover:text-white disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  {portalLoading ? 'Opening…' : 'Manage Billing'}
                </button>
              </>
            ) : (
              <>
                <p className="text-white font-bold text-sm mb-1">
                  {tierInfo.icon} {tierInfo.name}
                  {isInTrial && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#10B981', color: 'white' }}>TRIAL</span>}
                </p>
                {isInTrial ? (
                  <p className="text-white/60 text-xs mb-3 leading-relaxed">
                    🎁 <span className="font-semibold text-emerald-300">{trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'}</span> of free Summit access remaining.
                    {paidTierName && paidTierName !== 'Summit' && (
                      <> After {trialEndsAtLabel}, you'll switch to <span className="font-semibold text-white/80">{paidTierName}</span> at your normal rate.</>
                    )}
                  </p>
                ) : pendingChange ? (
                  <p className="text-white/60 text-xs mb-3 leading-relaxed">
                    Switching to <span className="font-semibold text-amber-300">{pendingChangeTierName}</span> on <span className="font-semibold text-white/80">{pendingChangeLabel}</span>. You keep {tierInfo.name} access until then.
                  </p>
                ) : (
                  <p className="text-white/60 text-xs mb-3 leading-relaxed">
                    Manage billing or pause for the season
                  </p>
                )}
                <button
                  onClick={openCustomerPortal}
                  disabled={portalLoading}
                  className="block text-center w-full py-2 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 mb-2"
                  style={{ background: '#0EA5E9' }}
                >
                  {portalLoading ? 'Opening…' : 'Manage Subscription'}
                </button>
                <button
                  onClick={pauseForSeason}
                  disabled={pauseLoading}
                  className="block text-center w-full py-1.5 rounded-lg text-white/80 text-xs font-semibold transition hover:text-white disabled:opacity-50 mb-2"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  {pauseLoading ? 'Pausing…' : '🌙 Pause for the Season'}
                </button>
                <Link
                  to={`/business/${campgroundId}/upgrade`}
                  className="block text-center w-full py-1.5 rounded-lg text-white/50 text-[10px] font-medium transition hover:text-white/80"
                  style={{ background: 'transparent' }}
                >
                  🦄 Want Founding Partner? View all plans
                </Link>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* TOP BAR */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/basecamp" className="text-sm font-medium hover:underline" style={{ color: '#1B2B4B' }}>
              <span className="flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Personal Basecamp</span>
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-300" />
            <span className="font-semibold truncate" style={{ color: '#1B2B4B' }}>{campground.name}</span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
              style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C' }}
            >
              {tierInfo.icon} {tierInfo.name}
            </span>
          </div>
          <GoldButton onClick={() => { setActiveTab('events'); setShowEventForm(true); }}>
            <Plus className="w-4 h-4" /> New Event
          </GoldButton>
        </header>

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-6">

          {/* ═══ DASHBOARD TAB ═══ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">

              {/* Pulse Strip — 4 stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Followers', value: stats.followers, icon: <Eye className="w-5 h-5" style={{ color: '#1B2B4B' }} /> },
                  { label: 'Check-ins', value: stats.checkIns, icon: <Heart className="w-5 h-5" style={{ color: '#1B2B4B' }} /> },
                  {
                    label: 'Rating',
                    value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-',
                    icon: <Star className="w-5 h-5" style={{ color: '#C9A84C' }} />,
                    extra: stats.avgRating > 0 ? (
                      <span className="text-xs text-gray-400 ml-1">
                        {'★'.repeat(Math.round(stats.avgRating))}{'☆'.repeat(5 - Math.round(stats.avgRating))}
                        {' '}({stats.reviews})
                      </span>
                    ) : null,
                  },
                  { label: 'Photos', value: stats.photos, icon: <Camera className="w-5 h-5" style={{ color: '#1B2B4B' }} /> },
                ].map((s, i) => (
                  <Card key={i} className="p-4" style={{ borderLeft: '4px solid #C9A84C' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#F8F6F2' }}>
                        {s.icon}
                      </div>
                      <div>
                        <div className="flex items-baseline">
                          <p className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{s.value}</p>
                          {s.extra}
                        </div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* LEFT column (60%) */}
                <div className="lg:col-span-3 space-y-6">

                  {/* Today's Agenda */}
                  <Card>
                    <div className="px-5 py-3 rounded-t-xl" style={{ background: '#1B2B4B' }}>
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Today's Agenda
                      </h3>
                    </div>
                    <div className="p-5">
                      {todaysEvents.length > 0 ? (
                        <div className="space-y-3">
                          {todaysEvents.map((evt: any) => (
                            <div key={evt.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#F8F6F2' }}>
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#C9A84C' }}>
                                <Calendar className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate" style={{ color: '#1B2B4B' }}>{evt.title}</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(evt.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {evt.location && ` — ${evt.location}`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-center py-6">Nothing scheduled for today</p>
                      )}
                    </div>
                  </Card>

                  {/* Recent Activity / Needs Attention */}
                  <Card>
                    <div className="px-5 py-3 border-b border-gray-100">
                      <h3 className="font-semibold flex items-center gap-2" style={{ color: '#1B2B4B' }}>
                        <Bell className="w-4 h-4" style={{ color: '#C9A84C' }} /> Recent Activity
                      </h3>
                    </div>
                    <div className="p-5">
                      {pendingItems.photos.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-2">Pending Approval</p>
                          {pendingItems.photos.slice(0, 5).map((photo: any) => (
                            <div key={photo.id} className="flex items-center justify-between p-3 rounded-lg mb-2" style={{ background: '#FFFBEB' }}>
                              <div className="flex items-center gap-3">
                                <img src={`${photo.imageUrl}`} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                <div>
                                  <p className="text-sm font-medium" style={{ color: '#1B2B4B' }}>Photo from {photo.user.firstName}</p>
                                  <p className="text-xs text-gray-400">Pending approval</p>
                                </div>
                              </div>
                              <div className="flex gap-1.5">
                                <button onClick={() => handleReviewPhoto(photo.id, 'APPROVED')} className="p-1.5 rounded-lg text-white transition hover:opacity-90" style={{ background: '#16a34a' }}><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleReviewPhoto(photo.id, 'REJECTED')} className="p-1.5 bg-red-500 rounded-lg text-white transition hover:opacity-90"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                          {pendingItems.photos.length > 5 && (
                            <button onClick={() => setActiveTab('photos')} className="text-xs font-medium" style={{ color: '#C9A84C' }}>
                              View all {pendingItems.photos.length} pending...
                            </button>
                          )}
                        </div>
                      )}
                      {recentActivity.reviews.length > 0 ? (
                        <div className="space-y-3">
                          {recentActivity.reviews.slice(0, 4).map((review: any) => (
                            <div key={review.id} className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1B2B4B' }}>
                                {review.user?.firstName?.[0] || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm"><span className="font-medium">{review.user.firstName}</span> left a review</p>
                                <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                              </div>
                              <span className="text-amber-500 text-xs flex-shrink-0">{'🔥'.repeat(review.rating)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        pendingItems.photos.length === 0 && (
                          <p className="text-gray-400 text-center py-4">All caught up! No recent activity.</p>
                        )
                      )}
                    </div>
                  </Card>
                </div>

                {/* RIGHT column (40%) */}
                <div className="lg:col-span-2 space-y-6">

                  {/* Recent Reviews */}
                  <Card>
                    <div className="px-5 py-3 border-b border-gray-100">
                      <h3 className="font-semibold flex items-center gap-2" style={{ color: '#1B2B4B' }}>
                        <Star className="w-4 h-4" style={{ color: '#C9A84C' }} /> Recent Reviews
                      </h3>
                    </div>
                    <div className="p-5">
                      {recentActivity.reviews.length > 0 ? (
                        <div className="space-y-4">
                          {recentActivity.reviews.slice(0, 3).map((review: any) => (
                            <div key={review.id} className="pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium" style={{ color: '#1B2B4B' }}>{review.user.firstName} {review.user.lastName}</p>
                                <span className="text-amber-500 text-xs">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                              </div>
                              {review.review && <p className="text-sm text-gray-500 line-clamp-2">{review.review}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-center py-4 text-sm">No reviews yet</p>
                      )}
                      {recentActivity.reviews.length > 3 && (
                        <button onClick={() => setActiveTab('reviews')} className="text-xs font-medium mt-3 block" style={{ color: '#C9A84C' }}>
                          View all reviews
                        </button>
                      )}
                    </div>
                  </Card>

                  {/* Team */}
                  <Card>
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2" style={{ color: '#1B2B4B' }}>
                        <Users className="w-4 h-4" style={{ color: '#C9A84C' }} /> Team
                      </h3>
                      {tier === 'CLASS_A' && (
                        <button className="text-xs font-medium" style={{ color: '#C9A84C' }}>+ Invite</button>
                      )}
                    </div>
                    <div className="p-5 space-y-3">
                      {admins.map((admin: any) => (
                        <div key={admin.id} className="flex items-center gap-3">
                          {admin.user.profilePicture ? (
                            <img src={`${admin.user.profilePicture}`} className="w-9 h-9 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1B2B4B' }}>
                              {admin.user.firstName[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#1B2B4B' }}>{admin.user.firstName} {admin.user.lastName}</p>
                            <p className="text-xs text-gray-400 truncate">{admin.user.email}</p>
                          </div>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                            style={{
                              background: admin.role === 'OWNER' ? 'rgba(201,168,76,0.15)' : 'rgba(27,43,75,0.08)',
                              color: admin.role === 'OWNER' ? '#C9A84C' : '#1B2B4B',
                            }}
                          >
                            {admin.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <div className="px-5 py-3 border-b border-gray-100">
                      <h3 className="font-semibold flex items-center gap-2" style={{ color: '#1B2B4B' }}>
                        <Zap className="w-4 h-4" style={{ color: '#C9A84C' }} /> Quick Actions
                      </h3>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-2">
                      {[
                        { label: 'Post Announcement', icon: <Megaphone className="w-4 h-4" />, tab: 'announcements', fn: () => { setActiveTab('announcements'); setShowAnnouncementForm(true); } },
                        { label: 'Create Event', icon: <Calendar className="w-4 h-4" />, tab: 'events', fn: () => { setActiveTab('events'); setShowEventForm(true); } },
                        { label: 'Upload Photos', icon: <Camera className="w-4 h-4" />, tab: 'photos', fn: () => setActiveTab('photos') },
                        { label: 'Message Campers', icon: <Send className="w-4 h-4" />, tab: 'messaging', fn: () => setActiveTab('messaging') },
                      ].map((action, i) => (
                        <button
                          key={i}
                          onClick={action.fn}
                          className="flex items-center gap-2 p-3 rounded-lg text-left text-sm font-medium transition hover:opacity-80"
                          style={{ background: '#F8F6F2', color: '#1B2B4B' }}
                        >
                          {action.icon}
                          <span className="truncate">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>

              {/* Pro Teaser Banner (dismissible) */}
              {!proTeaserDismissed && tier === 'FREE' && (
                <div
                  className="relative rounded-xl p-6 flex items-center justify-between overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #E8622A 0%, #C9A84C 100%)' }}
                >
                  <div className="relative z-10">
                    <h3 className="text-white font-bold text-lg mb-1">Ready to grow your campground?</h3>
                    <p className="text-white/80 text-sm">Unlock Hitch connections, analytics, branding, and more with a Pro plan.</p>
                  </div>
                  <div className="relative z-10 flex items-center gap-3">
                    <button
                      className="px-5 py-2.5 rounded-lg font-semibold text-sm transition hover:opacity-90"
                      style={{ background: '#1B2B4B', color: '#fff' }}
                    >
                      Explore Plans
                    </button>
                    <button onClick={dismissProTeaser} className="text-white/60 hover:text-white transition p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ ANNOUNCEMENTS TAB ═══ */}
          {activeTab === 'announcements' && (
            <div className="space-y-6">
              <SectionHeader
                icon={<Megaphone className="w-5 h-5 text-white" />}
                title="Announcements"
                description="Share news and updates with your followers"
                action={
                  <GoldButton onClick={() => setShowAnnouncementForm(true)}>
                    <Plus className="w-4 h-4" /> New Announcement
                  </GoldButton>
                }
              />

              {showAnnouncementForm && (
                <Card className="p-6">
                  <h3 className="font-bold mb-4" style={{ color: '#1B2B4B' }}>Create Announcement</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Title *</label>
                      <input
                        type="text"
                        value={announcementForm.title}
                        onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                        placeholder="Announcement title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Content *</label>
                      <textarea
                        value={announcementForm.content}
                        onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                        rows={4}
                        placeholder="Write your announcement..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="isPinned" checked={announcementForm.isPinned} onChange={e => setAnnouncementForm({ ...announcementForm, isPinned: e.target.checked })} className="rounded" />
                      <label htmlFor="isPinned" className="text-sm text-gray-600">Pin this announcement</label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Priority</label>
                      <select
                        value={announcementForm.priority}
                        onChange={e => setAnnouncementForm({ ...announcementForm, priority: e.target.value as any })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                      >
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="IMPORTANT">Important</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Schedule (optional)</label>
                      <input
                        type="datetime-local"
                        value={announcementForm.scheduledAt}
                        onChange={e => setAnnouncementForm({ ...announcementForm, scheduledAt: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setShowAnnouncementForm(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
                      <CTAButton onClick={handleCreateAnnouncement} disabled={!announcementForm.title || !announcementForm.content}>
                        Post Announcement
                      </CTAButton>
                    </div>
                  </div>
                </Card>
              )}

              <div className="space-y-3">
                {announcements.length > 0 ? announcements.map((ann: any) => (
                  <Card key={ann.id} className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {ann.isPinned && <span className="text-amber-500 text-sm">📌</span>}
                          <h4 className="font-bold" style={{ color: '#1B2B4B' }}>{ann.title}</h4>
                          {ann.priority === 'URGENT' && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Urgent</span>}
                          {ann.priority === 'IMPORTANT' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Important</span>}
                        </div>
                        <p className="text-gray-600 text-sm mb-2">{ann.content}</p>
                        <p className="text-xs text-gray-400">{new Date(ann.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => handleDeleteAnnouncement(ann.id)} className="text-gray-300 hover:text-red-500 transition ml-3"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </Card>
                )) : (
                  <Card className="p-12 text-center">
                    <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium text-gray-500 mb-1">No announcements yet</p>
                    <p className="text-sm text-gray-400">Create one to share news with your followers!</p>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ═══ EVENTS TAB ═══ */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              <SectionHeader
                icon={<Calendar className="w-5 h-5 text-white" />}
                title="Events"
                description="Organize activities and attract visitors"
                action={
                  <GoldButton onClick={() => setShowEventForm(true)}>
                    <Plus className="w-4 h-4" /> New Event
                  </GoldButton>
                }
              />

              {showEventForm && (
                <Card className="p-6">
                  <h3 className="font-bold mb-4" style={{ color: '#1B2B4B' }}>Create Event</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Title *</label>
                      <input
                        type="text"
                        value={eventForm.title}
                        onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                        placeholder="Event title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                      <textarea
                        value={eventForm.description}
                        onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                        rows={3}
                        placeholder="Event details..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Start Date/Time *</label>
                        <input
                          type="datetime-local"
                          value={eventForm.startDate}
                          onChange={e => setEventForm({ ...eventForm, startDate: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">End Date/Time</label>
                        <input
                          type="datetime-local"
                          value={eventForm.endDate}
                          onChange={e => setEventForm({ ...eventForm, endDate: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Location</label>
                      <input
                        type="text"
                        value={eventForm.location}
                        onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                        placeholder="e.g., Main Pavilion"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setShowEventForm(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
                      <CTAButton onClick={handleCreateEvent} disabled={!eventForm.title || !eventForm.startDate}>
                        Create Event
                      </CTAButton>
                    </div>
                  </div>
                </Card>
              )}

              <div className="space-y-3">
                {events.length > 0 ? events.map((evt: any) => (
                  <Card key={evt.id} className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold mb-1" style={{ color: '#1B2B4B' }}>{evt.title}</h4>
                        {evt.description && <p className="text-gray-600 text-sm mb-2">{evt.description}</p>}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(evt.startDate).toLocaleDateString()} {new Date(evt.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {evt.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{evt.location}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteEvent(evt.id)} className="text-gray-300 hover:text-red-500 transition ml-3"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </Card>
                )) : (
                  <Card className="p-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium text-gray-500 mb-1">No events yet</p>
                    <p className="text-sm text-gray-400">Create one to attract visitors!</p>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ═══ PHOTOS TAB ═══ */}
          {activeTab === 'photos' && (
            <div className="space-y-6">
              <SectionHeader
                icon={<Camera className="w-5 h-5 text-white" />}
                title="Photo Management"
                description={`${photos.length} / ${tier === 'CLASS_A' ? '∞' : tier === 'CLASS_B' ? '100' : tier === 'CLASS_C' ? '50' : '4'} photos`}
              />

              {/* Upload Form */}
              <Card className="p-5">
                <h3 className="font-semibold mb-3" style={{ color: '#1B2B4B' }}>Upload Photo</h3>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:text-white hover:file:opacity-90 file:cursor-pointer"
                    style={{ ['--tw-file-bg' as any]: '#1B2B4B' }}
                  />
                  <input
                    type="text"
                    placeholder="Caption (optional)"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                  />
                  <CTAButton onClick={handleUploadPhoto} disabled={!photoFile || uploadingPhoto}>
                    {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                  </CTAButton>
                </div>
              </Card>

              {/* Pending Photos */}
              {pendingPhotos.length > 0 && (
                <Card className="p-5" style={{ borderLeft: '4px solid #C9A84C' }}>
                  <h3 className="font-semibold mb-3" style={{ color: '#C9A84C' }}>Pending Approval ({pendingPhotos.length})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {pendingPhotos.map((photo: any) => (
                      <div key={photo.id} className="rounded-xl overflow-hidden bg-gray-50">
                        <img src={`${photo.imageUrl}`} alt="" className="w-full h-32 object-cover" />
                        <div className="p-2">
                          <p className="text-xs text-gray-600 truncate mb-2">{photo.user.firstName} {photo.user.lastName}</p>
                          <div className="flex gap-1">
                            <button onClick={() => handleReviewPhoto(photo.id, 'APPROVED')} className="flex-1 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: '#16a34a' }}><Check className="w-3 h-3 mx-auto" /></button>
                            <button onClick={() => handleReviewPhoto(photo.id, 'REJECTED')} className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium"><X className="w-3 h-3 mx-auto" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Approved Photos */}
              <div>
                <h3 className="font-semibold mb-3" style={{ color: '#1B2B4B' }}>Approved Photos ({photos.length})</h3>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {photos.map((photo: any) => (
                      <Card key={photo.id} className="overflow-hidden relative group">
                        <img src={`${photo.imageUrl}`} alt="" className="w-full h-32 object-cover" />
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleSetBanner(photo.id)} className="p-1.5 rounded-lg text-white" style={{ background: '#1B2B4B' }} title="Set as banner"><Image className="w-3 h-3" /></button>
                          <button onClick={() => handleDeletePhoto(photo.id)} className="bg-red-500 text-white p-1.5 rounded-lg" title="Delete photo"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        {data?.campground?.imageUrl === photo.imageUrl && (
                          <div className="absolute top-2 left-2 text-white text-xs px-2 py-1 rounded-lg font-medium" style={{ background: '#C9A84C' }}>Banner</div>
                        )}
                        <div className="p-2">
                          <p className="text-xs text-gray-600 truncate">{photo.user?.firstName} {photo.user?.lastName}</p>
                          {photo.caption && <p className="text-xs text-gray-400 truncate">{photo.caption}</p>}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Camera className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium text-gray-500 mb-1">No approved photos yet</p>
                    <p className="text-sm text-gray-400">Upload photos to showcase your campground</p>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ═══ REVIEWS TAB ═══ */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <SectionHeader
                icon={<Star className="w-5 h-5 text-white" />}
                title={`Reviews (${reviews.length})`}
                description={stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)} average rating` : 'No ratings yet'}
              />

              <div className="space-y-3">
                {reviews.length > 0 ? reviews.map((review: any) => (
                  <Card key={review.id} className="p-5">
                    <div className="flex items-start gap-4">
                      {review.user?.profilePicture ? (
                        <img src={`${review.user.profilePicture}`} className="w-10 h-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#1B2B4B' }}>
                          {review.user?.firstName?.[0] || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium" style={{ color: '#1B2B4B' }}>{review.user?.firstName} {review.user?.lastName}</p>
                          <span className="text-amber-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                        </div>
                        {review.title && <p className="font-medium text-gray-800 mb-1">{review.title}</p>}
                        {review.review && <p className="text-gray-600 text-sm">{review.review}</p>}
                        <p className="text-xs text-gray-400 mt-2">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </Card>
                )) : (
                  <Card className="p-12 text-center">
                    <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium text-gray-500 mb-1">No reviews yet</p>
                    <p className="text-sm text-gray-400">Reviews will appear here as campers leave feedback</p>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ═══ CHECK-INS TAB ═══ */}
          {activeTab === 'checkins' && (
            <div className="space-y-6">
              <SectionHeader
                icon={<Users className="w-5 h-5 text-white" />}
                title={`Check-ins (${checkIns.length})`}
                description="Campers currently or recently at your campground"
              />

              <div className="space-y-3">
                {checkIns.length > 0 ? checkIns.map((ci: any) => (
                  <Card key={ci.id} className="p-5">
                    <div className="flex items-center gap-4">
                      {ci.user?.profilePicture ? (
                        <img src={`${ci.user.profilePicture}`} className="w-10 h-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#1B2B4B' }}>
                          {ci.user?.firstName?.[0] || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium" style={{ color: '#1B2B4B' }}>{ci.user?.firstName} {ci.user?.lastName}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(ci.checkInDate).toLocaleDateString()} - {ci.checkOutDate ? new Date(ci.checkOutDate).toLocaleDateString() : 'Present'}
                          {ci.siteNumber && <span className="ml-2">Site {ci.siteNumber}</span>}
                        </p>
                      </div>
                      {!ci.checkOutDate && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>Active</span>
                      )}
                    </div>
                  </Card>
                )) : (
                  <Card className="p-12 text-center">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium text-gray-500 mb-1">No check-ins yet</p>
                    <p className="text-sm text-gray-400">Campers who check in will appear here</p>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ═══ THREADS TAB ═══ */}
          {activeTab === 'threads' && (
            <div className="space-y-6">
              <SectionHeader
                icon={<MessageSquare className="w-5 h-5 text-white" />}
                title="Community Threads"
                description="View and moderate community discussions"
              />
              <Card className="p-12 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-medium text-gray-500 mb-1">Community Threads</p>
                <p className="text-sm text-gray-400 mb-4">View and moderate community discussions on your campground page.</p>
                <Link
                  to={`/campgrounds/${campgroundId}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium text-sm transition hover:opacity-90"
                  style={{ background: '#1B2B4B' }}
                >
                  Go to Campground Page
                </Link>
              </Card>
            </div>
          )}

          {/* ═══ MESSAGING TAB ═══ */}
          {activeTab === 'messaging' && (
            <div className="space-y-6">
              <SectionHeader
                icon={<Send className="w-5 h-5 text-white" />}
                title="Message Campers"
                description="Send direct messages to your followers and guests"
              />
              <CampgroundMessaging
                campgroundId={campgroundId!}
                campgroundName={data?.campground?.name || 'Campground'}
              />
            </div>
          )}

          {/* ═══ SETTINGS TAB ═══ */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <SectionHeader
                icon={<Settings className="w-5 h-5 text-white" />}
                title="Business Settings"
                description="Manage your campground profile and contact information"
              />

              <Card className="p-6">
                <div className="space-y-5 max-w-xl">
                  <h3 className="font-semibold border-b border-gray-100 pb-3" style={{ color: '#1B2B4B' }}>Contact Information</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Business Email</label>
                    <input type="email" value={settingsForm.businessEmail} onChange={e => setSettingsForm({ ...settingsForm, businessEmail: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition" placeholder="contact@campground.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Business Phone</label>
                    <input type="tel" value={settingsForm.businessPhone} onChange={e => setSettingsForm({ ...settingsForm, businessPhone: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition" placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Booking URL</label>
                    <input type="url" value={settingsForm.bookingUrl} onChange={e => setSettingsForm({ ...settingsForm, bookingUrl: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Website</label>
                    <input type="url" value={settingsForm.websiteUrl} onChange={e => setSettingsForm({ ...settingsForm, websiteUrl: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                    <textarea value={settingsForm.description} onChange={e => setSettingsForm({ ...settingsForm, description: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition" rows={4} placeholder="Describe your campground..." />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="space-y-5 max-w-xl">
                  <h3 className="font-semibold border-b border-gray-100 pb-3" style={{ color: '#1B2B4B' }}>Campground Hashtag</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Hashtag</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-lg font-bold">#</span>
                      <input type="text" value={settingsForm.hashtag} onChange={e => setSettingsForm({ ...settingsForm, hashtag: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition" placeholder="YourCampground" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Users can mention your campground with #{settingsForm.hashtag || 'YourHashtag'}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="space-y-5 max-w-xl">
                  <h3 className="font-semibold border-b border-gray-100 pb-3" style={{ color: '#1B2B4B' }}>Social Media Links</h3>
                  {[
                    { label: 'Facebook', key: 'facebookUrl', placeholder: 'https://facebook.com/...' },
                    { label: 'Instagram', key: 'instagramUrl', placeholder: 'https://instagram.com/...' },
                    { label: 'X / Twitter', key: 'twitterUrl', placeholder: 'https://x.com/...' },
                    { label: 'YouTube', key: 'youtubeUrl', placeholder: 'https://youtube.com/...' },
                    { label: 'TikTok', key: 'tiktokUrl', placeholder: 'https://tiktok.com/@...' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-600 mb-1">{field.label}</label>
                      <input
                        type="url"
                        value={(settingsForm as any)[field.key]}
                        onChange={e => setSettingsForm({ ...settingsForm, [field.key]: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition"
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <CTAButton onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </CTAButton>
            </div>
          )}

          {/* ═══ PRO FEATURE TEASERS ═══ */}
          {activeTab === 'stickers' && !canAccess('CLASS_B') && renderProTeaser(
            <Award className="w-10 h-10 text-white" />,
            'Digital Stickers',
            'Create custom stickers for visitors to collect when they check in.',
            [
              'Design unique sticker sets for your campground',
              'Gamify the visitor experience with collectibles',
              'Boost engagement and encourage return visits',
            ]
          )}

          {activeTab === 'analytics' && !canAccess('CLASS_A') && renderProTeaser(
            <BarChart3 className="w-10 h-10 text-white" />,
            'Analytics Dashboard',
            'See page views, visitor trends, and engagement metrics at a glance.',
            [
              'Track page views and visitor trends over time',
              'Understand where your visitors are coming from',
              'Measure engagement across reviews, photos, and events',
            ]
          )}

          {activeTab === 'branding' && !canAccess('CLASS_B') && renderProTeaser(
            <Palette className="w-10 h-10 text-white" />,
            'Custom Branding',
            'Customize colors, themes, and layout to match your campground identity.',
            [
              'Choose from 9 unique page themes',
              'Set a custom accent color for your listing',
              'Stand out from the crowd with a branded experience',
            ]
          )}

          {activeTab === 'hitch' && renderProTeaser(
            <Zap className="w-10 h-10 text-white" />,
            'Hitch Configuration',
            'Connect with nearby campgrounds and create trail networks.',
            [
              'Set up cross-promotions with neighboring campgrounds',
              'Create curated road trip routes',
              'Share visitors and grow together',
            ]
          )}

          {activeTab === 'trivia' && renderProTeaser(
            <Sparkles className="w-10 h-10 text-white" />,
            'Campground Trivia',
            'Engage guests with fun trivia games about your area.',
            [
              'Create custom trivia questions about your campground',
              'Local wildlife, history, and nature quizzes',
              'Reward top scorers with digital badges',
            ]
          )}

          {/* ═══ BRANDING TAB (when accessible) ═══ */}
          {activeTab === 'branding' && canAccess('CLASS_B') && (
            <div className="space-y-6">
              <SectionHeader
                icon={<Palette className="w-5 h-5 text-white" />}
                title="Branding & Theme"
                description="Customize the look and feel of your campground page"
              />

              {/* Theme Selection */}
              <Card className="p-6">
                <h3 className="font-semibold mb-2" style={{ color: '#1B2B4B' }}>Page Theme</h3>
                <p className="text-gray-500 text-sm mb-4">Choose a layout style for your campground page</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'classic', name: 'Classic', desc: 'Traditional layout with tabs', preview: 'bg-green-600' },
                    { id: 'modern', name: 'Modern', desc: 'Full-width hero, card-based', preview: 'bg-gradient-to-r from-blue-600 to-purple-600' },
                    { id: 'rustic', name: 'Rustic', desc: 'Warm, nature-inspired feel', preview: 'bg-amber-800' },
                    { id: 'coastal', name: 'Coastal', desc: 'Beach vibes, ocean blues', preview: 'bg-gradient-to-b from-sky-200 to-blue-400' },
                    { id: 'adventure', name: 'Adventure', desc: 'Bold, rugged outdoor feel', preview: 'bg-gray-900' },
                    { id: 'minimal', name: 'Minimal', desc: 'Clean, zen-like simplicity', preview: 'bg-white border' },
                    { id: 'magazine', name: 'Magazine', desc: 'Editorial, storytelling layout', preview: 'bg-gray-800' },
                    { id: 'retro', name: 'Retro', desc: 'Vintage badge, nostalgic feel', preview: 'bg-amber-100 border-4 border-double border-amber-800' },
                    { id: 'neon', name: 'Neon', desc: 'Futuristic, glowing accents', preview: 'bg-gray-950' },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setSettingsForm({ ...settingsForm, theme: theme.id })}
                      className={`text-left rounded-xl border-2 p-4 transition ${
                        settingsForm.theme === theme.id ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`${theme.preview} rounded-lg h-20 mb-3`} />
                      <h4 className="font-bold" style={{ color: '#1B2B4B' }}>{theme.name}</h4>
                      <p className="text-sm text-gray-500">{theme.desc}</p>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Accent Color */}
              <Card className="p-6">
                <h3 className="font-semibold mb-2" style={{ color: '#1B2B4B' }}>Accent Color</h3>
                <p className="text-gray-500 text-sm mb-4">Choose a primary color for buttons and highlights</p>
                <div className="flex flex-wrap gap-3">
                  {['#16a34a', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#0d9488', '#dc2626'].map(color => (
                    <button
                      key={color}
                      onClick={() => setSettingsForm({ ...settingsForm, accentColor: color })}
                      className={`w-12 h-12 rounded-full border-4 transition ${settingsForm.accentColor === color ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="flex items-center gap-2 ml-4">
                    <label className="text-sm text-gray-600">Custom:</label>
                    <input
                      type="color"
                      value={settingsForm.accentColor}
                      onChange={e => setSettingsForm({ ...settingsForm, accentColor: e.target.value })}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </Card>

              {/* Preview */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4" style={{ color: '#1B2B4B' }}>Preview</h3>
                <div className="border-2 rounded-xl p-5" style={{ borderColor: settingsForm.accentColor }}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl" style={{ backgroundColor: settingsForm.accentColor }} />
                    <div>
                      <h4 className="font-bold text-lg" style={{ color: '#1B2B4B' }}>{data?.campground?.name || 'Your Campground'}</h4>
                      <p className="text-gray-500 text-sm">{settingsForm.theme.charAt(0).toUpperCase() + settingsForm.theme.slice(1)} Theme</p>
                    </div>
                  </div>
                  <button className="px-5 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: settingsForm.accentColor }}>
                    Sample Button
                  </button>
                </div>
              </Card>

              <CTAButton onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Branding'}
              </CTAButton>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
