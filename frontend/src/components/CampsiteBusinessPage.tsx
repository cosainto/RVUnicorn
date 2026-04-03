import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Globe,
  Clock,
  Wifi,
  Zap,
  Droplet,
  Tent,
  Car,
  ChevronRight,
  Calendar,
  ShoppingCart,
  Award,
  Star,
  MessageSquare,
  Heart,
  Users,
  Mail,
  Sparkles,
} from 'lucide-react';
import api from '../services/api';

interface Campground {
  id: string;
  name: string;
  slug: string;
  description: string;
  location: string;
  state: string;
  latitude: number;
  longitude: number;
  phoneNumber?: string;
  website?: string;
  email?: string;
  imageUrl?: string;
  amenities: string[];
  followers: number;
  checkIns: number;
  reviews: number;
  rating: number;
}

interface Stats {
  followers: number;
  checkIns: number;
  reviews: number;
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'events', label: 'Events' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'news', label: 'News' },
  { id: 'rentals', label: 'Rentals' },
  { id: 'store', label: 'Store' },
  { id: 'stickers', label: 'Stickers' },
];

const AMENITY_ICONS: { [key: string]: any } = {
  'WiFi': Wifi,
  'Electric Hookups': Zap,
  'Water Hookups': Droplet,
  'RV Sites': Car,
  'Tent Sites': Tent,
};

export default function CampsiteBusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const [campground, setCampground] = useState<Campground | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    followers: 0,
    checkIns: 0,
    reviews: 0,
  });
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (slug) {
      loadCampground();
    }
  }, [slug]);

  useEffect(() => {
    if (campground) {
      loadStats();
      checkFollowStatus();
    }
  }, [campground]);

  const loadCampground = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/campgrounds/slug/${slug}`);
      setCampground(data);
    } catch (error) {
      console.error('Load campground error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!campground) return;

    try {
      const followersRes = await api.get(`/campgrounds/${campground.id}/followers`);
      const checkInsRes = await api.get(`/stays/campground/${campground.id}/count`);
      const reviewsCount = 0;

      setStats({
        followers: followersRes.data.count || 0,
        checkIns: checkInsRes.data.count || 0,
        reviews: reviewsCount,
      });

      setCampground({
        ...campground,
        followers: followersRes.data.count || 0,
        checkIns: checkInsRes.data.count || 0,
        reviews: reviewsCount,
      });
    } catch (error) {
      console.error('Load stats error:', error);
      setStats({
        followers: 0,
        checkIns: 0,
        reviews: 0,
      });
    }
  };

  const checkFollowStatus = async () => {
    if (!campground) return;

    try {
      const { data } = await api.get(`/campgrounds/${campground.id}/is-favorited`);
      setIsFollowing(data.isFavorited);
    } catch (error) {
      console.error('Check follow status error:', error);
    }
  };

  const handleFollow = async () => {
    if (!campground) return;

    try {
      if (isFollowing) {
        await api.delete(`/campgrounds/${campground.id}/favorite`);
        setIsFollowing(false);
        setCampground({ ...campground, followers: campground.followers - 1 });
        setStats({ ...stats, followers: stats.followers - 1 });
      } else {
        await api.post(`/campgrounds/${campground.id}/favorite`);
        setIsFollowing(true);
        setCampground({ ...campground, followers: campground.followers + 1 });
        setStats({ ...stats, followers: stats.followers + 1 });
      }
    } catch (error) {
      console.error('Follow error:', error);
      alert('Failed to update follow status');
    }
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F8F6F2' }}>
        <div className="max-w-6xl mx-auto px-4 py-24 text-center">
          <div
            className="animate-spin rounded-full h-10 w-10 border-2 mx-auto"
            style={{ borderColor: '#E8622A', borderTopColor: 'transparent' }}
          />
          <p className="mt-4 text-gray-500 text-sm">Loading campground...</p>
        </div>
      </div>
    );
  }

  /* ─── Not Found ─── */
  if (!campground) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F8F6F2' }}>
        <div className="max-w-6xl mx-auto px-4 py-24 text-center">
          <Tent className="w-16 h-16 mx-auto mb-4" style={{ color: '#1B2B4B' }} />
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#1B2B4B' }}>
            Campground not found
          </h2>
          <p className="text-gray-600 mb-6">
            The campground you're looking for doesn't exist or may have moved.
          </p>
          <Link
            to="/campgrounds"
            className="inline-block px-6 py-3 rounded-xl font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#E8622A' }}
          >
            Browse Campgrounds
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Render Tab Content ─── */
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* About */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold mb-3" style={{ color: '#1B2B4B' }}>
                About
              </h3>
              {campground.description ? (
                <p className="text-gray-700 leading-relaxed">{campground.description}</p>
              ) : (
                <p className="text-gray-400 italic">
                  No description yet — check back soon for more about {campground.name}.
                </p>
              )}
            </div>

            {/* Recent Check-ins */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold mb-3" style={{ color: '#1B2B4B' }}>
                Recent Check-ins
              </h3>
              {stats.checkIns > 0 ? (
                <div className="flex items-center gap-1">
                  {/* Avatar stack placeholder */}
                  {[...Array(Math.min(stats.checkIns, 5))].map((_, i) => (
                    <div
                      key={i}
                      className="w-9 h-9 rounded-full border-2 border-white -ml-2 first:ml-0 flex items-center justify-center text-xs font-semibold text-white"
                      style={{ backgroundColor: ['#1B2B4B', '#E8622A', '#C9A84C', '#5B7553', '#7B6BA4'][i % 5] }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                  {stats.checkIns > 5 && (
                    <span className="ml-2 text-sm text-gray-500">+{stats.checkIns - 5} more</span>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 italic">
                  No check-ins yet — be the first to check in at {campground.name}!
                </p>
              )}
            </div>
          </div>
        );

      case 'events':
        return (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Tent className="w-14 h-14 mx-auto mb-4" style={{ color: '#C9A84C' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1B2B4B' }}>
              No upcoming events
            </h3>
            <p className="text-gray-500">
              Follow {campground.name} to be notified when new events are posted.
            </p>
          </div>
        );

      case 'reviews':
        return (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Star className="w-14 h-14 mx-auto mb-4" style={{ color: '#C9A84C' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1B2B4B' }}>
              Be the first to review
            </h3>
            <p className="text-gray-500">
              Share your experience at {campground.name} and help fellow campers.
            </p>
          </div>
        );

      case 'news':
        return (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <MessageSquare className="w-14 h-14 mx-auto mb-4" style={{ color: '#C9A84C' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1B2B4B' }}>
              No updates yet
            </h3>
            <p className="text-gray-500">
              Follow to get updates when {campground.name} posts.
            </p>
          </div>
        );

      case 'rentals':
        return (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Tent className="w-14 h-14 mx-auto mb-4 text-gray-300" />
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-3 text-white"
              style={{ backgroundColor: '#C9A84C' }}
            >
              Coming Soon
            </span>
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1B2B4B' }}>
              Gear &amp; Equipment Rentals
            </h3>
            <p className="text-gray-500">
              Rent camping gear, kayaks, bikes, and more directly from {campground.name}.
            </p>
          </div>
        );

      case 'store':
        return (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <ShoppingCart className="w-14 h-14 mx-auto mb-4 text-gray-300" />
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-3 text-white"
              style={{ backgroundColor: '#C9A84C' }}
            >
              Coming Soon
            </span>
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1B2B4B' }}>
              Camp Store
            </h3>
            <p className="text-gray-500">
              Merch, firewood bundles, and essentials from {campground.name}.
            </p>
          </div>
        );

      case 'stickers':
        return (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Award className="w-14 h-14 mx-auto mb-4 text-gray-300" />
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-3 text-white"
              style={{ backgroundColor: '#C9A84C' }}
            >
              Coming Soon
            </span>
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1B2B4B' }}>
              Digital Stickers
            </h3>
            <p className="text-gray-500">
              Collect unique digital stickers by checking in and joining events.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  /* ─── Main Render ─── */
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F6F2' }}>
      {/* ── HERO ── */}
      <div className="relative w-full" style={{ height: 320 }}>
        {/* Background */}
        {campground.imageUrl ? (
          <img
            src={campground.imageUrl}
            alt={campground.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #1B2B4B 0%, #E8622A 100%)',
            }}
          />
        )}

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Follow button — top right */}
        <button
          onClick={handleFollow}
          className="absolute top-6 right-6 flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition hover:opacity-90 shadow-lg"
          style={{
            backgroundColor: '#C9A84C',
            color: '#fff',
          }}
        >
          <Heart
            className="w-4 h-4"
            fill={isFollowing ? '#fff' : 'none'}
            stroke="#fff"
          />
          {isFollowing ? 'Following' : 'Follow'}
        </button>

        {/* Name + location */}
        <div className="absolute bottom-16 left-0 right-0 px-6 max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight drop-shadow-md">
            {campground.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 text-white/90">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">
              {campground.location}, {campground.state}
            </span>
          </div>
        </div>

        {/* Floating stat pills */}
        <div className="absolute -bottom-5 left-0 right-0 px-6 max-w-6xl mx-auto flex gap-3">
          <div className="flex items-center gap-1.5 bg-white rounded-full px-4 py-2 shadow-md text-sm font-semibold"
            style={{ color: '#1B2B4B' }}
          >
            <Star className="w-4 h-4" style={{ color: '#C9A84C' }} fill="#C9A84C" />
            {campground.rating > 0 ? campground.rating.toFixed(1) : '--'}
          </div>
          <div
            className="flex items-center gap-1.5 bg-white rounded-full px-4 py-2 shadow-md text-sm font-semibold"
            style={{ color: '#1B2B4B' }}
          >
            <Tent className="w-4 h-4" style={{ color: '#E8622A' }} />
            {stats.checkIns} Check-in{stats.checkIns !== 1 ? 's' : ''}
          </div>
          <div
            className="flex items-center gap-1.5 bg-white rounded-full px-4 py-2 shadow-md text-sm font-semibold"
            style={{ color: '#1B2B4B' }}
          >
            <Users className="w-4 h-4" style={{ color: '#C9A84C' }} />
            {stats.followers} Follower{stats.followers !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* ── TWO-COLUMN LAYOUT ── */}
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-16 flex gap-8">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="hidden lg:block w-[280px] shrink-0 sticky top-24 self-start space-y-5">
          {/* Contact Card */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#1B2B4B' }}>
              Contact
            </h3>
            {campground.phoneNumber && (
              <a
                href={`tel:${campground.phoneNumber}`}
                className="flex items-center gap-3 text-gray-700 hover:text-[#E8622A] transition text-sm"
              >
                <Phone className="w-4 h-4 shrink-0" style={{ color: '#E8622A' }} />
                {campground.phoneNumber}
              </a>
            )}
            {campground.website && (
              <a
                href={campground.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-gray-700 hover:text-[#E8622A] transition text-sm"
              >
                <Globe className="w-4 h-4 shrink-0" style={{ color: '#E8622A' }} />
                <span className="truncate">Website</span>
              </a>
            )}
            {campground.email && (
              <a
                href={`mailto:${campground.email}`}
                className="flex items-center gap-3 text-gray-700 hover:text-[#E8622A] transition text-sm"
              >
                <Mail className="w-4 h-4 shrink-0" style={{ color: '#E8622A' }} />
                <span className="truncate">{campground.email}</span>
              </a>
            )}
            {!campground.phoneNumber && !campground.website && !campground.email && (
              <p className="text-gray-400 text-sm italic">No contact info listed yet.</p>
            )}
          </div>

          {/* Amenities Card */}
          {campground.amenities && campground.amenities.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#1B2B4B' }}>
                Amenities
              </h3>
              <ul className="space-y-2.5">
                {campground.amenities.map((amenity, idx) => {
                  const Icon = AMENITY_ICONS[amenity] || Tent;
                  return (
                    <li key={idx} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <Icon className="w-4 h-4 shrink-0" style={{ color: '#1B2B4B' }} />
                      {amenity}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Book a Site CTA */}
          <button
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition hover:opacity-90 shadow-sm"
            style={{ backgroundColor: '#E8622A' }}
          >
            Book a Site
          </button>

          {/* Hitch Preview Card */}
          <div
            className="rounded-xl p-4 cursor-pointer transition hover:opacity-90"
            style={{ backgroundColor: '#7B6BA4' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-white text-xs font-bold uppercase tracking-wide">Hitch AI</span>
            </div>
            <p className="text-white/90 text-sm">
              Ask Hitch about {campground.name}{' '}
              <ChevronRight className="inline w-4 h-4 -mt-0.5" />
            </p>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 min-w-0">
          {/* Pill-style Tab Row */}
          <div className="flex flex-wrap gap-2 mb-6">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition"
                  style={{
                    backgroundColor: isActive ? '#1B2B4B' : '#F8F6F2',
                    color: isActive ? '#fff' : '#1B2B4B',
                    border: isActive ? 'none' : '1px solid #e5e2dc',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
}
