import FollowersSection from '../components/FollowersSection';
// ============================================
// CREATOR PAGE - Main Component
// Save as: frontend/src/pages/CreatorPage.tsx
// ============================================

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BadgeCheck,
  Star,
  UserPlus,
  UserMinus,
  Play,
  FileText,
  Image,
  ExternalLink as LinkIcon,
  MapPin,
  Globe,
  ChevronRight,
} from 'lucide-react';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share,
  Eye,
} from 'lucide-react';
import { Heart as HeartSolidIcon, Bookmark as BookmarkSolidIcon } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Creator {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture: string;
  creatorCoverImage?: string;
  coverPhoto?: string;
  creatorBio: string;
  creatorSpecialties: string[];
  creatorVerified: boolean;
  creatorFeatured: boolean;
  location?: string;
  website?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  showSocialOnCreator?: boolean;
  creatorDisplayName?: string;
  creatorHandle?: string;
  tiktokUrl?: string;
  rvType?: string;
  rvMake?: string;
  rvModel?: string;
  rvYear?: number;
  followerCount: number;
  contentCount: number;
  isFollowing: boolean;
  creatorStats?: {
    totalViews: number;
    totalLikes: number;
  };
}

interface ContentItem {
  id: string;
  contentType: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  category?: string;
  publishedAt: string;
  viewCount: number;
  isSponsored: boolean;
  isLiked?: boolean;
  isSaved?: boolean;
  campground?: {
    id: string;
    name: string;
    state: string;
  };
  photos?: { imageUrl: string }[];
  _count: {
    likes: number;
    comments: number;
    reposts: number;
    saves: number;
  };
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Content' },
  { id: 'GEAR_REVIEWS', label: 'Gear Reviews' },
  { id: 'CAMPGROUND_REVIEWS', label: 'Campground Reviews' },
  { id: 'TRAVEL_DAYS', label: 'Travel Days' },
  { id: 'TIPS_HACKS', label: 'Tips & Hacks' },
  { id: 'FULL_TIME_RV', label: 'Full-Time RV Life' },
  { id: 'WEEKEND_TRIPS', label: 'Weekend Trips' },
];

const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  VIDEO: <Play className="w-4 h-4" />,
  SHORT: <Play className="w-4 h-4" />,
  BLOG: <FileText className="w-4 h-4" />,
  PHOTO_GALLERY: <Image className="w-4 h-4" />,
  EMBED: <LinkIcon className="w-4 h-4" />,
};

export default function CreatorPage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'content' | 'about' | 'gear'>('content');
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwner = user?.id === creator?.id;

  useEffect(() => {
    fetchCreator();
  }, [username]);

  useEffect(() => {
    if (creator) {
      fetchContent();
    }
  }, [creator, activeCategory]);

  const fetchCreator = async () => {
    try {
      const response = await api.get(`/creators/profile/${username}`);
      setCreator(response.data);
    } catch (error) {
      console.error('Error fetching creator:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContent = async () => {
    if (!creator) return;
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'ALL') {
        params.append('category', activeCategory);
      }
      const response = await api.get(`/creators/content/${creator.id}?${params}`);
      setContent(response.data);
    } catch (error) {
      console.error('Error fetching content:', error);
    }
  };

  const handleFollow = async () => {
    if (!creator || !user) return;
    setFollowLoading(true);
    try {
      const response = await api.post(`/creators/follow/${creator.id}`);
      setCreator({
        ...creator,
        isFollowing: response.data.isFollowing,
        followerCount: creator.followerCount + (response.data.isFollowing ? 1 : -1),
      });
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLike = async (contentId: string) => {
    try {
      const response = await api.post(`/creators/content/${contentId}/like`);
      setContent(content.map(c => 
        c.id === contentId
          ? {
              ...c,
              isLiked: response.data.isLiked,
              _count: {
                ...c._count,
                likes: c._count.likes + (response.data.isLiked ? 1 : -1),
              },
            }
          : c
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleSave = async (contentId: string) => {
    try {
      const response = await api.post(`/creators/content/${contentId}/save`);
      setContent(content.map(c => 
        c.id === contentId
          ? {
              ...c,
              isSaved: response.data.isSaved,
              _count: {
                ...c._count,
                saves: c._count.saves + (response.data.isSaved ? 1 : -1),
              },
            }
          : c
      ));
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Creator not found</h2>
          <p className="text-gray-600 mt-2">This creator page doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative">
        {/* Cover Image */}
        <div className="h-64 md:h-80 bg-gradient-to-r from-primary-600 to-primary-800 overflow-hidden">
          {(creator.creatorCoverImage || creator.coverPhoto) && (
            <img
              src={creator.creatorCoverImage || creator.coverPhoto}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Profile Info Overlay */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-24 pb-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Profile Photo */}
                <div className="flex-shrink-0">
                  <img
                    src={creator.profilePicture || '/default-avatar.png'}
                    alt={`${creator.firstName} ${creator.lastName}`}
                    className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-grow">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900">
                          {creator.creatorDisplayName || `${creator.firstName} ${creator.lastName}` || creator.username}
                        </h1>
                        {creator.creatorVerified && (
                          <BadgeCheck className="w-6 h-6 text-blue-500" title="Verified Creator" />
                        )}
                        {creator.creatorFeatured && (
                          <Star className="w-6 h-6 text-yellow-500" title="Featured Creator" />
                        )}
                      </div>
                      <p className="text-gray-500">@{creator.creatorHandle || creator.username}</p>
                    </div>

                    {/* Follow Button */}
                    {!isOwner && user && (
                      <button
                        onClick={handleFollow}
                        disabled={followLoading}
                        className={`flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-colors ${
                          creator.isFollowing
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {creator.isFollowing ? (
                          <>
                            <UserMinus className="w-5 h-5" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-5 h-5" />
                            Follow
                          </>
                        )}
                      </button>
                    )}

                    {isOwner && (
                      <Link
                        to="/creator/dashboard"
                        className="px-6 py-2 bg-primary-600 text-white rounded-full font-medium hover:bg-primary-700 transition-colors"
                      >
                        Creator Dashboard
                      </Link>
                    )}
                  </div>

                  {/* Bio */}
                  <p className="mt-3 text-gray-700">{creator.creatorBio}</p>

                  {/* Specialties */}
                  {creator.creatorSpecialties?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {creator.creatorSpecialties.map((specialty) => (
                        <span
                          key={specialty}
                          className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="mt-4 flex items-center gap-6 text-sm">
                    <div>
                      <span className="font-bold text-gray-900">{creator.followerCount.toLocaleString()}</span>
                      <span className="text-gray-500 ml-1">Followers</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-900">{creator.contentCount}</span>
                      <span className="text-gray-500 ml-1">Posts</span>
                    </div>
                    {creator.creatorStats && (
                      <>
                        <div>
                          <span className="font-bold text-gray-900">
                            {creator.creatorStats.totalViews.toLocaleString()}
                          </span>
                          <span className="text-gray-500 ml-1">Views</span>
                        </div>
                        <div>
                          <span className="font-bold text-gray-900">
                            {creator.creatorStats.totalLikes.toLocaleString()}
                          </span>
                          <span className="text-gray-500 ml-1">Likes</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Location & Links */}
                  <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                    {creator.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {creator.location}
                      </div>
                    )}
                    {creator.showSocialOnCreator !== false && creator.website && (
                      <a
                        href={creator.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary-600 hover:underline"
                      >
                        <Globe className="w-4 h-4" />
                        Website
                      </a>
                    )}
                    {creator.youtubeUrl && (
                      <a
                        href={creator.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 hover:underline"
                      >
                        YouTube
                      </a>
                    )}
                    {creator.instagramUrl && (
                      <a
                        href={creator.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-600 hover:underline"
                      >
                        Instagram
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="flex gap-8">
            {[
              { id: 'content', label: 'Content' },
              { id: 'about', label: 'About' },
              { id: 'gear', label: 'Gear & Setup' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
        <div className="flex-1 min-w-0">
        {activeTab === 'content' && (
          <div>
            {/* Category Filter */}
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Content Grid */}
            {content.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No content yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {content.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    creatorUsername={creator.username}
                    onLike={() => handleLike(item.id)}
                    onSave={() => handleSave(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <AboutSection creator={creator} />
        )}

        {activeTab === 'gear' && (
          <GearSection creatorId={creator.id} />
        )}
      </div>
        </div>
        {/* Followers Sidebar */}
        <div className="hidden lg:block w-80 flex-shrink-0">
          {creator && (
            <FollowersSection
              creatorId={creator.id}
              isOwnProfile={false}
            />
          )}
        </div>
    </div>
  );
}

// Content Card Component
function ContentCard({
  item,
  creatorUsername,
  onLike,
  onSave,
}: {
  item: ContentItem;
  creatorUsername: string;
  onLike: () => void;
  onSave: () => void;
}) {
  const thumbnail = item.thumbnailUrl || item.photos?.[0]?.imageUrl;

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <Link to={`/creators/${creatorUsername}/content/${item.id}`}>
        <div className="relative aspect-video bg-gray-100">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={item.title || 'Content'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              {CONTENT_TYPE_ICONS[item.contentType] || <FileText className="w-12 h-12" />}
            </div>
          )}

          {/* Type Badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/60 rounded-full text-white text-xs">
            {CONTENT_TYPE_ICONS[item.contentType]}
            <span>{item.contentType.replace('_', ' ')}</span>
          </div>

          {/* Sponsored Badge */}
          {item.isSponsored && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 rounded-full text-white text-xs font-medium">
              Sponsored
            </div>
          )}

          {/* View Count */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 rounded text-white text-xs">
            <Eye className="w-3 h-3" />
            {item.viewCount.toLocaleString()}
          </div>
        </div>
      </Link>

      {/* Info */}
      <div className="p-4">
        <Link to={`/creators/${creatorUsername}/content/${item.id}`}>
          <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-primary-600">
            {item.title || 'Untitled'}
          </h3>
        </Link>

        {item.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{item.description}</p>
        )}

        {/* Campground Link */}
        {item.campground && (
          <Link
            to={`/campgrounds/${item.campground.id}`}
            className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:underline"
          >
            <MapPin className="w-4 h-4" />
            {item.campground.name}, {item.campground.state}
          </Link>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onLike}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500"
            >
              {item.isLiked ? (
                <HeartSolidIcon className="w-5 h-5 text-red-500" />
              ) : (
                <Heart className="w-5 h-5" />
              )}
              {item._count.likes}
            </button>

            <Link
              to={`/creators/${creatorUsername}/content/${item.id}`}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
            >
              <MessageCircle className="w-5 h-5" />
              {item._count.comments}
            </Link>
          </div>

          <button
            onClick={onSave}
            className="text-gray-500 hover:text-primary-600"
          >
            {item.isSaved ? (
              <BookmarkSolidIcon className="w-5 h-5 text-primary-600" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// About Section Component
function AboutSection({ creator }: { creator: Creator }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">About {`${creator.firstName} ${creator.lastName}` || creator.username}</h2>
      
      {creator.creatorBio && (
        <p className="text-gray-700 mb-6">{creator.creatorBio}</p>
      )}

      {/* RV Info */}
      {(creator.rvType || creator.rvMake) && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">My Rig</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            {creator.rvYear && creator.rvMake && creator.rvModel && (
              <p className="text-lg font-medium">
                {creator.rvYear} {creator.rvMake} {creator.rvModel}
              </p>
            )}
            {creator.rvType && (
              <p className="text-gray-500">{creator.rvType}</p>
            )}
          </div>
        </div>
      )}

      {/* Social Links */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-2">Connect</h3>
        <div className="flex flex-wrap gap-3">
          {creator.showSocialOnCreator !== false && creator.youtubeUrl && (
            <a
              href={creator.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              YouTube
              <ChevronRight className="w-4 h-4" />
            </a>
          )}
          {creator.showSocialOnCreator !== false && creator.instagramUrl && (
            <a
              href={creator.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200"
            >
              Instagram
              <ChevronRight className="w-4 h-4" />
            </a>
          )}
          {creator.showSocialOnCreator !== false && creator.tiktokUrl && (
            <a
              href={creator.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              TikTok
              <ChevronRight className="w-4 h-4" />
            </a>
          )}
          {creator.website && (
            <a
              href={creator.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200"
            >
              Website
              <ChevronRight className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Gear Section Component
function GearSection({ creatorId }: { creatorId: string }) {
  const [gearItems, setGearItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGear();
  }, [creatorId]);

  const fetchGear = async () => {
    try {
      const response = await api.get(`/gear/user/${creatorId}`);
      setGearItems(response.data);
    } catch (error) {
      console.error('Error fetching gear:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (gearItems.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <p className="text-gray-500">No gear listed yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {gearItems.map((item) => (
        <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-32 object-cover rounded-lg mb-3"
            />
          )}
          <h3 className="font-medium text-gray-900">{item.name}</h3>
          {item.category && (
            <span className="text-sm text-gray-500">{item.category}</span>
          )}
          {item.description && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
