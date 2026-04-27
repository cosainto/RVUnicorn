// ============================================
// CREATOR TOGGLE FOR BASECAMP PAGE
// Add this section to your BasecampPage.tsx
// ============================================

import React, { useState, useEffect } from 'react';
// Replaced heroicons with lucide-react
import { useNavigate } from 'react-router-dom';
// Replaced heroicons with lucide-react
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Trophy,
  BadgeCheck,
  BarChart3,
  Users,
  Video,
} from 'lucide-react';
import api from '../services/api';

interface CreatorToggleSectionProps {
  isCreator: boolean;
  username: string;
  onToggle: (enabled: boolean) => void;
}

export function CreatorToggleSection({ isCreator, username, onToggle }: CreatorToggleSectionProps) {
  const [stats, setStats] = useState<{ totalViews: number; totalLikes: number; followerCount: number; totalComments: number; contentCount: number } | null>(null);

  useEffect(() => {
    if (isCreator) {
      api.get('/creators/stats').then(res => setStats(res.data)).catch(() => {});
    }
  }, [isCreator]);
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);

  const availableSpecialties = [
    'Full-Time RV',
    'Weekend Warrior',
    'Gear Reviews',
    'Campground Reviews',
    'Travel Vlogs',
    'RV Tips & Hacks',
    'Boondocking',
    'Family Camping',
  ];

  const toggleSpecialty = (s: string) => {
    if (specialties.includes(s)) {
      setSpecialties(specialties.filter(x => x !== s));
    } else if (specialties.length < 5) {
      setSpecialties([...specialties, s]);
    }
  };

  const handleEnable = async () => {
    setEnabling(true);
    try {
      await api.post('/creators/toggle', {
        enable: true,
        bio,
        specialties,
      });
      onToggle(true);
      setShowModal(false);
      navigate('/creator/dashboard');
    } catch (error) {
      console.error('Error enabling creator mode:', error);
      alert('Failed to enable creator mode');
    } finally {
      setEnabling(false);
    }
  };

  if (isCreator) {
    return (
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8" />
            <div>
              <h3 className="text-lg font-semibold">Creator Mode Active</h3>
              <p className="text-primary-100 text-sm">Manage your content and grow your audience</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/creators/leaderboard')}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <Trophy className="w-4 h-4 text-yellow-400" />
              Top Influencers
            </button>
            <button
              onClick={() => navigate(`/creators/${username}`)}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              View My Page
            </button>
            <button
              onClick={() => navigate('/creator/dashboard')}
              className="px-4 py-2 bg-white text-primary-700 rounded-lg hover:bg-primary-50 transition-colors font-medium"
            >
              Dashboard
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{stats?.followerCount?.toLocaleString() || '0'}</p>
              {(stats?.newFollowersLast30Days || 0) > 0 && (
                <span className="flex items-center text-green-300 text-sm"><TrendingUp className="w-4 h-4" />+{stats?.newFollowersLast30Days}</span>
              )}
            </div>
            <p className="text-sm text-primary-200">Followers</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{stats?.totalViews?.toLocaleString() || '0'}</p>
              {(stats?.viewsThisWeek || 0) > 0 && (
                <span className="flex items-center text-green-300 text-sm"><TrendingUp className="w-4 h-4" />+{stats?.viewsThisWeek}</span>
              )}
            </div>
            <p className="text-sm text-primary-200">Total Views</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-2xl font-bold">{stats?.recentContent?.length?.toLocaleString() || '0'}</p>
            <p className="text-sm text-primary-200">Posts</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{stats?.totalLikes?.toLocaleString() || '0'}</p>
              {(stats?.likesThisWeek || 0) > 0 && (
                <span className="flex items-center text-green-300 text-sm"><TrendingUp className="w-4 h-4" />+{stats?.likesThisWeek}</span>
              )}
            </div>
            <p className="text-sm text-primary-200">Engagement</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-dashed border-gray-300">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary-100 rounded-xl">
            <Sparkles className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-grow">
            <h3 className="text-lg font-semibold text-gray-900">Become a Content Creator</h3>
            <p className="text-gray-600 mt-1">
              Share your RV adventures, gear reviews, and camping tips with the community.
              Get your own creator page, analytics, and grow your following.
            </p>

            {/* Benefits */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { icon: BadgeCheck, text: 'Verified creator badge' },
                { icon: BarChart3, text: 'Analytics dashboard' },
                { icon: Users, text: 'Build your audience' },
                { icon: Video, text: 'Share videos & content' },
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <benefit.icon className="w-5 h-5 text-primary-600" />
                  {benefit.text}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Enable Creator Mode
            </button>
          </div>
        </div>
      </div>

      {/* Enable Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Set Up Your Creator Page</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio (What do you create?)
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="I share full-time RV adventures and gear reviews..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specialties (choose up to 5)
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableSpecialties.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSpecialty(s)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        specialties.includes(s)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {enabling ? 'Setting up...' : 'Enable Creator Mode'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ============================================
// DISCOVER CREATORS COMPONENT
// Save as: frontend/src/components/DiscoverCreators.tsx
// ============================================

interface Creator {
  id: string;
  username: string;
  name: string;
  profilePhoto: string;
  creatorBio: string;
  creatorSpecialties: string[];
  creatorVerified: boolean;
  creatorFeatured: boolean;
  creatorStats?: {
    followerCount: number;
    totalViews: number;
  };
}

interface DiscoverCreatorsProps {
  limit?: number;
  showTitle?: boolean;
}

export function DiscoverCreators({ limit = 6, showTitle = true }: DiscoverCreatorsProps) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreators();
  }, []);

  const fetchCreators = async () => {
    try {
      const response = await api.get(`/api/creators/discover/trending?limit=${limit}`);
      setCreators(response.data);
    } catch (error) {
      console.error('Error fetching creators:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (creators.length === 0) {
    return null;
  }

  return (
    <div>
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Discover Rig Profiles</h2>
          <a href="/creators" className="text-sm text-primary-600 hover:underline">
            View all →
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {creators.map((creator) => (
          <a
            key={creator.id}
            href={`/creators/${creator.username}`}
            className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <img
                src={creator.profilePhoto || '/default-avatar.png'}
                alt={creator.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-medium text-gray-900 truncate">{creator.name || creator.username}</p>
                  {creator.creatorVerified && (
                    <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">@{creator.username}</p>
              </div>
            </div>

            {creator.creatorSpecialties?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {creator.creatorSpecialties.slice(0, 2).map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {creator.creatorStats && (
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span>{creator.creatorStats.followerCount.toLocaleString()} followers</span>
                <span>{creator.creatorStats.totalViews.toLocaleString()} views</span>
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}


// ============================================
// CREATOR CONTENT FEED FOR CAMPGROUND PAGES
// Add this to your campground detail page
// ============================================

interface CampgroundCreatorContentProps {
  campgroundId: string;
}

export function CampgroundCreatorContent({ campgroundId }: CampgroundCreatorContentProps) {
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, [campgroundId]);

  const fetchContent = async () => {
    try {
      const response = await api.get(`/api/creators/discover/campground/${campgroundId}`);
      setContent(response.data);
    } catch (error) {
      console.error('Error fetching creator content:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Video className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No creator content for this campground yet</p>
        <p className="text-sm mt-1">Be the first to share your experience!</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Creator Content</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {content.map((item) => (
          <a
            key={item.id}
            href={`/creators/${item.creator.username}/content/${item.id}`}
            className="flex gap-4 bg-white rounded-lg shadow-sm p-3 hover:shadow-md transition-shadow"
          >
            {item.thumbnailUrl || item.photos?.[0]?.imageUrl ? (
              <img
                src={item.thumbnailUrl || item.photos[0].imageUrl}
                alt=""
                className="w-24 h-16 object-cover rounded"
              />
            ) : (
              <div className="w-24 h-16 bg-gray-100 rounded flex items-center justify-center">
                <Video className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div className="flex-grow min-w-0">
              <p className="font-medium text-gray-900 line-clamp-2">{item.title || 'Untitled'}</p>
              <div className="flex items-center gap-2 mt-1">
                <img
                  src={item.creator.profilePhoto || '/default-avatar.png'}
                  alt=""
                  className="w-5 h-5 rounded-full"
                />
                <span className="text-sm text-gray-500">{item.creator.name || item.creator.username}</span>
                {item.creator.creatorVerified && (
                  <BadgeCheck className="w-4 h-4 text-blue-500" />
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
