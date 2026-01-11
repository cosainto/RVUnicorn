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
  { id: 'overview', label: 'Overview', icon: MapPin },
  { id: 'news', label: 'News', icon: MessageSquare },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'rentals', label: 'Rentals', icon: Tent },
  { id: 'store', label: 'Store', icon: ShoppingCart },
  { id: 'stickers', label: 'Stickers', icon: Award },
  { id: 'reviews', label: 'Reviews', icon: Star },
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
      // Get followers count
      const followersRes = await api.get(`/campgrounds/${campground.id}/followers`);
      
      // Get check-ins count
      const checkInsRes = await api.get(`/stays/campground/${campground.id}/count`);
      
      // Get reviews count (placeholder for now)
      const reviewsCount = 0;
      
      setStats({
        followers: followersRes.data.count || 0,
        checkIns: checkInsRes.data.count || 0,
        reviews: reviewsCount,
      });
      
      // Update campground with follower count
      setCampground({
        ...campground,
        followers: followersRes.data.count || 0,
        checkIns: checkInsRes.data.count || 0,
        reviews: reviewsCount,
      });
    } catch (error) {
      console.error('Load stats error:', error);
      // Set default stats if error
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campground...</p>
        </div>
      </div>
    );
  }

  if (!campground) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Campground not found</h2>
          <p className="text-gray-600 mb-4">The campground you're looking for doesn't exist.</p>
          <Link to="/campgrounds" className="btn btn-primary">
            Browse Campgrounds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="h-64 bg-gradient-to-r from-green-400 to-blue-500 relative">
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-end">
            <div className="p-6 text-white w-full">
              <h1 className="text-4xl font-bold mb-2">{campground.name}</h1>
              <div className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5" />
                <span>{campground.location}, {campground.state}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {campground.phoneNumber && (
                <a href={`tel:${campground.phoneNumber}`} className="flex items-center gap-2 text-gray-700 hover:text-primary-600">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">{campground.phoneNumber}</span>
                </a>
              )}
              {campground.website && (
                <a href={campground.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-700 hover:text-primary-600">
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">Website</span>
                </a>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleFollow}
                className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'} flex items-center gap-2`}
              >
                <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-5 h-5 text-primary-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.followers}</p>
              <p className="text-sm text-gray-600">Followers</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Tent className="w-5 h-5 text-primary-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.checkIns}</p>
              <p className="text-sm text-gray-600">Check-ins</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="w-5 h-5 text-primary-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.reviews}</p>
              <p className="text-sm text-gray-600">Reviews</p>
            </div>
          </div>

          {/* Description */}
          {campground.description && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">About</h2>
              <p className="text-gray-700 leading-relaxed">{campground.description}</p>
            </div>
          )}

          {/* Amenities */}
          {campground.amenities && campground.amenities.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {campground.amenities.map((amenity, idx) => {
                  const Icon = AMENITY_ICONS[amenity] || Tent;
                  return (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <Icon className="w-5 h-5 text-primary-600" />
                      <span className="text-sm text-gray-700">{amenity}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap border-b-2 transition ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Overview</h3>
              <p className="text-gray-600">
                Welcome to {campground.name}! Check out our other tabs for news, events, rentals, store items, and more.
              </p>
            </div>
          )}

          {activeTab === 'news' && (
            <div className="text-center py-12 text-gray-600">
              <MessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p>No news posts yet. Check back soon for updates!</p>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="text-center py-12 text-gray-600">
              <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p>No upcoming events. Stay tuned!</p>
            </div>
          )}

          {activeTab === 'rentals' && (
            <div className="text-center py-12 text-gray-600">
              <Tent className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p>No rentals available at this time.</p>
            </div>
          )}

          {activeTab === 'store' && (
            <div className="text-center py-12 text-gray-600">
              <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p>Store items coming soon!</p>
            </div>
          )}

          {activeTab === 'stickers' && (
            <div className="text-center py-12 text-gray-600">
              <Award className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p>Collect digital stickers by checking in and participating!</p>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="text-center py-12 text-gray-600">
              <Star className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p>No reviews yet. Be the first to leave a s'mores review!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
