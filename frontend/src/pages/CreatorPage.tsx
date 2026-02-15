import FollowersSection from '../components/FollowersSection';
import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  Award,
  TrendingUp,
  Calendar,
  Share2,
  MoreHorizontal,
  Flame,
  Zap,
  Mountain,
  Tent,
  Truck,
  Copy,
  X,
} from 'lucide-react';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share,
  Eye,
  Coffee,
  ShoppingBag,
  BarChart3,
  List,
  Plus,
  Clock,
  ChevronLeft,
  ChevronDown,
  ThumbsUp,
  Sparkles,
  Trophy,
  Gift,
  Megaphone,
  Pin,
} from 'lucide-react';
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
  facebookUrl?: string;
  twitterUrl?: string;
  blueskyUrl?: string;
  redditUrl?: string;
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
  creatorJoinedAt?: string;
  creatorEnabledAt?: string;
  creatorTipJarUrl?: string;
  creatorTipJarType?: string;
  creatorMerchUrl?: string;
  creatorMerchLabel?: string;
  creatorThemeColor?: string;
  creatorPinnedContentIds?: string[];
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
  isPinned?: boolean;
  campground?: {
    id: string;
    name: string;
    state: string;
  };
  recipe?: {
    id: string;
    title: string;
    imageUrl?: string;
  };
  photos?: { imageUrl: string }[];
  _count: {
    likes: number;
    comments: number;
    reposts: number;
    saves: number;
  };
}

interface PollItem {
  id: string;
  question: string;
  description?: string;
  endsAt?: string;
  totalVotes: number;
  options: { id: string; text: string; voteCount: number }[];
  votes?: { optionId: string }[];
}

interface SeriesItem {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  _count: { items: number };
  items: ContentItem[];
}

interface StoryItem {
  id: string;
  imageUrl?: string;
  text?: string;
  bgColor?: string;
  linkUrl?: string;
  linkLabel?: string;
  viewCount: number;
  expiresAt: string;
  createdAt: string;
}

interface ShoutoutItem {
  id: string;
  message?: string;
  giver: { id: string; username: string; firstName: string; lastName: string; profilePicture?: string; creatorVerified?: boolean };
  receiver: { id: string; username: string; firstName: string; lastName: string; profilePicture?: string; creatorVerified?: boolean };
}

interface MilestoneItem {
  id: string;
  type: string;
  threshold: number;
  achievedAt: string;
  celebrated: boolean;
}

const MILESTONE_LABELS: Record<string, Record<number, string>> = {
  FOLLOWERS: { 10: 'First 10 Followers', 50: '50 Followers', 100: 'Century Club', 500: 'Rising Star', 1000: '1K Followers', 5000: '5K Followers', 10000: '10K Followers' },
  CONTENT: { 1: 'First Post', 5: '5 Posts', 10: 'Content Machine', 25: 'Prolific Creator', 50: '50 Posts', 100: 'Content Legend' },
  VIEWS: { 100: '100 Views', 500: '500 Views', 1000: '1K Views', 5000: '5K Views', 10000: '10K Views', 50000: '50K Views', 100000: '100K Views' },
  LIKES: { 10: 'First 10 Likes', 50: '50 Likes', 100: '100 Likes', 500: '500 Likes', 1000: '1K Likes', 5000: '5K Likes' },
};

const MILESTONE_ICONS: Record<string, string> = {
  FOLLOWERS: '👥', CONTENT: '📝', VIEWS: '👀', LIKES: '❤️',
};

const CATEGORIES = [
  { id: 'ALL', label: 'All', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'GEAR_REVIEWS', label: 'Gear Reviews', icon: <Star className="w-3.5 h-3.5" /> },
  { id: 'CAMPGROUND_REVIEWS', label: 'Campground Reviews', icon: <Tent className="w-3.5 h-3.5" /> },
  { id: 'TRAVEL_DAYS', label: 'Travel Days', icon: <Truck className="w-3.5 h-3.5" /> },
  { id: 'TIPS_HACKS', label: 'Tips & Hacks', icon: <Flame className="w-3.5 h-3.5" /> },
  { id: 'FULL_TIME_RV', label: 'Full-Time Life', icon: <Mountain className="w-3.5 h-3.5" /> },
  { id: 'WEEKEND_TRIPS', label: 'Weekenders', icon: <Calendar className="w-3.5 h-3.5" /> },
];

const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  VIDEO: <Play className="w-4 h-4" />,
  SHORT: <Play className="w-4 h-4" />,
  BLOG: <FileText className="w-4 h-4" />,
  PHOTO_GALLERY: <Image className="w-4 h-4" />,
  EMBED: <LinkIcon className="w-4 h-4" />,
  GUIDE: <FileText className="w-4 h-4" />,
};

function formatCount(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function CreatorPage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [featuredContent, setFeaturedContent] = useState<ContentItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'content' | 'about' | 'gear' | 'collabs' | 'series'>('content');
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [shoutouts, setShoutouts] = useState<ShoutoutItem[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [suggestedCreators, setSuggestedCreators] = useState<any[]>([]);
  const [activeStory, setActiveStory] = useState<number | null>(null);
  const [votingPoll, setVotingPoll] = useState<string | null>(null);

  const isOwner = user?.id === creator?.id;

  useEffect(() => {
    fetchCreator();
  }, [username]);

  useEffect(() => {
    if (creator?.id) {
      fetchExtras(creator.id);
    }
  }, [creator?.id]);

  const fetchExtras = async (creatorId: string) => {
    try {
      const [pollsRes, seriesRes, storiesRes, shoutoutsRes, milestonesRes, suggestedRes] = await Promise.allSettled([
        api.get("/creator-features/polls/" + creatorId),
        api.get("/creator-features/series/" + creatorId),
        api.get("/creator-features/stories/" + creatorId),
        api.get("/creator-features/shoutouts/" + creatorId),
        api.get("/creator-features/milestones/" + creatorId),
        api.get("/creator-features/suggested"),
      ]);
      if (pollsRes.status === 'fulfilled') setPolls(pollsRes.value.data);
      if (seriesRes.status === 'fulfilled') setSeries(seriesRes.value.data);
      if (storiesRes.status === 'fulfilled') setStories(storiesRes.value.data);
      if (shoutoutsRes.status === 'fulfilled') setShoutouts(shoutoutsRes.value.data);
      if (milestonesRes.status === 'fulfilled') setMilestones(milestonesRes.value.data);
      if (suggestedRes.status === 'fulfilled') setSuggestedCreators(suggestedRes.value.data.filter((c: any) => c.id !== creatorId).slice(0, 4));
    } catch (e) {}
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (votingPoll) return;
    setVotingPoll(pollId);
    try {
      await api.post("/creator-features/polls/" + pollId + "/vote", { optionId });
      if (creator?.id) {
        const { data } = await api.get("/creator-features/polls/" + creator.id);
        setPolls(data);
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to vote');
    } finally {
      setVotingPoll(null);
    }
  };

  const handlePinContent = async (contentId: string, isPinned: boolean) => {
    try {
      if (isPinned) {
        await api.delete("/creator-features/pin/" + contentId);
      } else {
        await api.post("/creator-features/pin/" + contentId);
      }
      fetchContent(creator?.id || '');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to pin');
    }
  };

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
      if (activeCategory !== 'ALL') params.append('category', activeCategory);
      const response = await api.get(`/creators/content/${creator.id}?${params}`);
      const items = response.data || [];
      setContent(items);
      // First 3 most viewed as featured
      if (activeCategory === 'ALL' && items.length > 0) {
        const sorted = [...items].sort((a: ContentItem, b: ContentItem) => b.viewCount - a.viewCount);
        setFeaturedContent(sorted.slice(0, 3));
      }
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
          ? { ...c, isLiked: response.data.isLiked, _count: { ...c._count, likes: c._count.likes + (response.data.isLiked ? 1 : -1) } }
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
          ? { ...c, isSaved: response.data.isSaved, _count: { ...c._count, saves: c._count.saves + (response.data.isSaved ? 1 : -1) } }
          : c
      ));
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const creatorUrl = `https://rvunicorn-production.up.railway.app/creators/${creator?.username}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading creator...</p>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Mountain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Creator not found</h2>
          <p className="text-gray-600 mt-2">This creator page doesn't exist.</p>
          <Link to="/creators" className="inline-block mt-4 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition">
            Browse Creators
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== HERO SECTION ===== */}
      <div className="relative">
        {/* Cover Image with Gradient Overlay */}
        <div className="h-56 sm:h-64 md:h-80 relative overflow-hidden">
          {(creator.creatorCoverImage || creator.coverPhoto) ? (
            <img
              src={creator.creatorCoverImage || creator.coverPhoto}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-600 via-orange-500 to-rose-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>

        {/* Profile Card - Overlapping Cover */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="relative -mt-32 sm:-mt-28">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Profile Photo */}
                <div className="flex-shrink-0 -mt-16 sm:-mt-20">
                  <div className="relative">
                    <img
                      src={creator.profilePicture || '/default-avatar.png'}
                      alt={creator.firstName}
                      className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-white shadow-lg object-cover"
                    />
                    {creator.creatorVerified && (
                      <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1.5 shadow-md">
                        <BadgeCheck className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-grow min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                          {creator.creatorDisplayName || `${creator.firstName} ${creator.lastName}` || creator.username}
                        </h1>
                        {creator.creatorFeatured && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-semibold rounded-full">
                            <Star className="w-3 h-3" /> Featured
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm mt-0.5">@{creator.creatorHandle || creator.username}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isOwner && user && (
                        <button
                          onClick={handleFollow}
                          disabled={followLoading}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                            creator.isFollowing
                              ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600'
                              : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02]'
                          }`}
                        >
                          {creator.isFollowing ? <><UserMinus className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                        </button>
                      )}
                      <button
                        onClick={() => setShowShareModal(true)}
                        className="p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition text-gray-600"
                        title="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      {isOwner && (
                        <Link
                          to="/creator/dashboard"
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg transition"
                        >
                          Dashboard
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  {creator.creatorBio && (
                    <p className="mt-3 text-gray-700 text-sm leading-relaxed line-clamp-3">{creator.creatorBio}</p>
                  )}

                  {/* Specialties */}
                  {creator.creatorSpecialties?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {creator.creatorSpecialties.map((s) => (
                        <span key={s} className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium border border-amber-100">{s}</span>
                      ))}
                    </div>
                  )}

                  {/* Stats Row */}
                  <div className="mt-4 flex items-center gap-5 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="font-bold text-gray-900">{formatCount(creator.followerCount)}</span>
                      <span className="text-gray-500">followers</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-bold text-gray-900">{creator.contentCount}</span>
                      <span className="text-gray-500">posts</span>
                    </div>
                    {creator.creatorStats && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-gray-400" />
                          <span className="font-bold text-gray-900">{formatCount(creator.creatorStats.totalViews)}</span>
                          <span className="text-gray-500">views</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Heart className="w-4 h-4 text-gray-400" />
                          <span className="font-bold text-gray-900">{formatCount(creator.creatorStats.totalLikes)}</span>
                          <span className="text-gray-500">likes</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Location & Social Links Row */}
                  <div className="mt-3 flex items-center gap-3 flex-wrap text-sm">
                    {creator.location && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <MapPin className="w-3.5 h-3.5" /> {creator.location}
                      </span>
                    )}
                    {creator.showSocialOnCreator !== false && (
                      <>
                        {creator.youtubeUrl && (
                          <a href={creator.youtubeUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-xs font-medium">
                            YouTube
                          </a>
                        )}
                        {creator.instagramUrl && (
                          <a href={creator.instagramUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 transition text-xs font-medium">
                            Instagram
                          </a>
                        )}
                        {creator.tiktokUrl && (
                          <a href={creator.tiktokUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs font-medium">
                            TikTok
                          </a>
                        )}
                        {creator.facebookUrl && (
                          <a href={creator.facebookUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-xs font-medium">
                            Facebook
                          </a>
                        )}
                        {creator.twitterUrl && (
                          <a href={creator.twitterUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition text-xs font-medium">
                            X
                          </a>
                        )}
                        {creator.website && (
                          <a href={creator.website} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition text-xs font-medium">
                            <Globe className="w-3 h-3" /> Website
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FEATURED CONTENT (Top 3 most viewed) ===== */}
      {featuredContent.length > 0 && activeTab === 'content' && activeCategory === 'ALL' && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-gray-900">Popular Content</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredContent.map((item, i) => (
              <Link
                key={item.id}
                to={`/creators/${creator.username}/content/${item.id}`}
                className="group relative rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:scale-[1.01]"
              >
                <div className="aspect-video bg-gray-200">
                  {(item.thumbnailUrl || item.photos?.[0]?.imageUrl) ? (
                    <img src={item.thumbnailUrl || item.photos![0].imageUrl} alt={item.title || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                      {CONTENT_TYPE_ICONS[item.contentType] || <FileText className="w-10 h-10 text-amber-300" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 bg-white/20 backdrop-blur-sm rounded text-white text-[10px] font-semibold uppercase tracking-wider">
                      {item.contentType.replace('_', ' ')}
                    </span>
                    {isOwner && (
                  <button onClick={(e) => { e.preventDefault(); handlePinContent(item.id, !!item.isPinned); }}
                    className={"absolute top-2 left-2 p-1.5 rounded-full backdrop-blur-sm transition z-10 " + (item.isPinned ? "bg-amber-500 text-white" : "bg-black/30 text-white/70 hover:text-white")}>
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                )}
                {item.isSponsored && (
                      <span className="px-1.5 py-0.5 bg-amber-500/80 rounded text-white text-[10px] font-semibold">Sponsored</span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:underline">{item.title || 'Untitled'}</h3>
                  <div className="flex items-center gap-3 mt-1 text-white/70 text-xs">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatCount(item.viewCount)}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{item._count.likes}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{item._count.comments}</span>
                  </div>
                </div>
                {i === 0 && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow">
                    Most Viewed
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ===== TABS ===== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="flex gap-1">
            {[
              { id: 'content', label: 'Content', icon: <Play className="w-4 h-4" /> },
              { id: 'about', label: 'About', icon: <FileText className="w-4 h-4" /> },
              { id: 'gear', label: 'Gear & Setup', icon: <Star className="w-4 h-4" /> },
              { id: 'collabs', label: 'Collabs', icon: <Users className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-all ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ===== CONTENT AREA ===== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Main Column */}
          <div className="flex-1 min-w-0">
            {activeTab === 'content' && (
              <div>
                {/* Category Pills */}
                <div className="mb-5 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                        activeCategory === cat.id
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                          : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-amber-200'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                {/* Content Grid */}
                {content.length === 0 ? (
                  <div className="text-center py-16">
                    <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No content yet</p>
                    <p className="text-gray-400 text-sm mt-1">Check back soon for new posts!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

            {activeTab === 'about' && <AboutSection creator={creator} />}
            {activeTab === 'gear' && <GearSection creatorId={creator.id} />}
            {activeTab === 'collabs' && <CollabsSection creatorId={creator.id} creatorName={creator.firstName} isOwner={isOwner} />}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-80 flex-shrink-0 space-y-4">
            {/* Tip Jar */}
          {creator.creatorTipJarUrl && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
              <a href={creator.creatorTipJarUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl hover:shadow-md transition group">
                <div className="p-2 bg-amber-100 rounded-lg group-hover:scale-110 transition">
                  <Coffee className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Support this Creator</p>
                  <p className="text-xs text-gray-500">{creator.creatorTipJarType === 'buymeacoffee' ? 'Buy Me a Coffee' : creator.creatorTipJarType === 'venmo' ? 'Venmo' : creator.creatorTipJarType === 'paypal' ? 'PayPal' : 'Send a tip'}</p>
                </div>
              </a>
            </div>
          )}

          {/* Merch */}
          {creator.creatorMerchUrl && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
              <a href={creator.creatorMerchUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:shadow-md transition group">
                <div className="p-2 bg-purple-100 rounded-lg group-hover:scale-110 transition">
                  <ShoppingBag className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{creator.creatorMerchLabel || 'Shop Merch'}</p>
                  <p className="text-xs text-gray-500">Check out the store</p>
                </div>
              </a>
            </div>
          )}

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 mb-3">
                <Trophy className="w-4 h-4 text-amber-500" /> Milestones
              </h3>
              <div className="flex flex-wrap gap-2">
                {milestones.slice(0, 8).map(m => (
                  <div key={m.id} className="px-2.5 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100" title={MILESTONE_LABELS[m.type]?.[m.threshold] || m.type + ' ' + m.threshold}>
                    <span className="text-sm">{MILESTONE_ICONS[m.type] || '🏆'}</span>
                    <span className="text-[10px] font-bold text-amber-700 ml-1">{MILESTONE_LABELS[m.type]?.[m.threshold] || m.threshold}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shoutouts */}
          {shoutouts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 mb-3">
                <Megaphone className="w-4 h-4 text-blue-500" /> Creator Shoutouts
              </h3>
              <div className="space-y-2">
                {shoutouts.slice(0, 4).map(s => {
                  const other = s.giver.id === creator?.id ? s.receiver : s.giver;
                  return (
                    <Link key={s.id} to={"/creators/" + other.username} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition">
                      {other.profilePicture ? (
                        <img src={other.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">
                          {(other.firstName?.[0] || '').toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-xs truncate">{other.firstName} {other.lastName}</p>
                        {s.message && <p className="text-[10px] text-gray-400 truncate">{s.message}</p>}
                      </div>
                      {other.creatorVerified && <BadgeCheck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggested Creators */}
          {suggestedCreators.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 mb-3">
                <Sparkles className="w-4 h-4 text-purple-500" /> Creators You Might Like
              </h3>
              <div className="space-y-2">
                {suggestedCreators.map(sc => (
                  <Link key={sc.id} to={"/creators/" + sc.username} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition">
                    {sc.profilePicture ? (
                      <img src={sc.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm">
                        {(sc.firstName?.[0] || sc.username[0]).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-xs truncate">{sc.creatorDisplayName || sc.firstName + ' ' + sc.lastName}</p>
                      <p className="text-[10px] text-gray-400">{sc._count?.creatorFollowers || 0} followers</p>
                    </div>
                    {sc.creatorVerified && <BadgeCheck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <FollowersSection creatorId={creator.id} isOwnProfile={isOwner} />

            {/* RV Info Card */}
            {(creator.rvType || creator.rvMake) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-amber-500" /> My Rig
                </h3>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-100">
                  {creator.rvYear && creator.rvMake && creator.rvModel ? (
                    <p className="font-bold text-gray-900">{creator.rvYear} {creator.rvMake} {creator.rvModel}</p>
                  ) : null}
                  {creator.rvType && <p className="text-sm text-amber-700 mt-1">{creator.rvType}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== SHARE MODAL ===== */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Share Creator</h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-sm text-gray-800 font-medium">{creator.creatorDisplayName || `${creator.firstName} ${creator.lastName}`}</p>
              <p className="text-xs text-gray-500">@{creator.username} on RVUnicorn</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(creatorUrl)}`} target="_blank" rel="noopener noreferrer" onClick={() => setShowShareModal(false)} className="text-white rounded-xl py-3 flex flex-col items-center gap-1.5 hover:opacity-90" style={{ backgroundColor: '#1877F2' }}>
                <span className="text-lg">f</span><span className="text-[10px] font-medium">Facebook</span>
              </a>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(creatorUrl)}&text=${encodeURIComponent(`Check out ${creator.firstName} on RVUnicorn!`)}`} target="_blank" rel="noopener noreferrer" onClick={() => setShowShareModal(false)} className="bg-black text-white rounded-xl py-3 flex flex-col items-center gap-1.5 hover:opacity-90">
                <span className="text-lg">X</span><span className="text-[10px] font-medium">X / Twitter</span>
              </a>
              <a href={`https://www.reddit.com/submit?url=${encodeURIComponent(creatorUrl)}&title=${encodeURIComponent(`${creator.firstName} on RVUnicorn`)}`} target="_blank" rel="noopener noreferrer" onClick={() => setShowShareModal(false)} className="text-white rounded-xl py-3 flex flex-col items-center gap-1.5 hover:opacity-90" style={{ backgroundColor: '#FF4500' }}>
                <span className="text-lg">r/</span><span className="text-[10px] font-medium">Reddit</span>
              </a>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(creatorUrl); setShowShareModal(false); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm text-gray-700"
            >
              <Copy className="w-4 h-4" /> Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== CONTENT CARD COMPONENT =====
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-amber-100 transition-all group">
      {/* Thumbnail */}
      <Link to={`/creators/${creatorUsername}/content/${item.id}`}>
        <div className="relative aspect-video bg-gray-100 overflow-hidden">
          {thumbnail ? (
            <img src={thumbnail} alt={item.title || 'Content'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-gray-300">
              {CONTENT_TYPE_ICONS[item.contentType] || <FileText className="w-12 h-12" />}
            </div>
          )}
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
            {CONTENT_TYPE_ICONS[item.contentType]}
            <span>{item.contentType.replace('_', ' ')}</span>
          </div>
          {item.isSponsored && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500 rounded-lg text-white text-xs font-semibold shadow">Sponsored</div>
          )}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs">
            <Eye className="w-3 h-3" /> {formatCount(item.viewCount)}
          </div>
        </div>
      </Link>

      <div className="p-4">
        <Link to={`/creators/${creatorUsername}/content/${item.id}`}>
          <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-amber-600 transition">{item.title || 'Untitled'}</h3>
        </Link>
        {item.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{item.description}</p>
        )}
        {item.campground && (
          <Link to={`/campgrounds/${item.campground.id}`} className="mt-2 flex items-center gap-1 text-xs text-amber-600 hover:underline">
            <MapPin className="w-3.5 h-3.5" /> {item.campground.name}, {item.campground.state}
          </Link>
        )}
        {item.recipe && (
          <Link to={`/recipes/${item.recipe.id}`} className="mt-1 flex items-center gap-1 text-xs text-orange-600 hover:underline">
            🍳 {item.recipe.title}
          </Link>
        )}
        <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-50">
          <div className="flex items-center gap-3">
            <button onClick={onLike} className={`flex items-center gap-1 text-sm transition ${item.isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}>
              <Heart className={`w-4 h-4 ${item.isLiked ? 'fill-red-500' : ''}`} /> {item._count.likes}
            </button>
            <Link to={`/creators/${creatorUsername}/content/${item.id}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-amber-600 transition">
              <MessageCircle className="w-4 h-4" /> {item._count.comments}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{timeAgo(item.publishedAt)}</span>
            <button onClick={onSave} className={`transition ${item.isSaved ? 'text-amber-600' : 'text-gray-400 hover:text-amber-600'}`}>
              <Bookmark className={`w-4 h-4 ${item.isSaved ? 'fill-amber-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== ABOUT SECTION =====
function AboutSection({ creator }: { creator: Creator }) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">About {creator.firstName}</h2>
        {creator.creatorBio && <p className="text-gray-700 leading-relaxed">{creator.creatorBio}</p>}

        {(creator.rvType || creator.rvMake) && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-500" /> My Rig
            </h3>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-100">
              {creator.rvYear && creator.rvMake && creator.rvModel && (
                <p className="text-lg font-bold text-gray-900">{creator.rvYear} {creator.rvMake} {creator.rvModel}</p>
              )}
              {creator.rvType && <p className="text-amber-700 mt-1">{creator.rvType}</p>}
            </div>
          </div>
        )}

        {creator.creatorSpecialties?.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> Specialties
            </h3>
            <div className="flex flex-wrap gap-2">
              {creator.creatorSpecialties.map((s) => (
                <span key={s} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium border border-amber-100">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Social Connect Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-amber-500" /> Connect with {creator.firstName}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {creator.showSocialOnCreator !== false && creator.youtubeUrl && (
            <a href={creator.youtubeUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition font-medium text-sm">
              YouTube <ChevronRight className="w-4 h-4 ml-auto" />
            </a>
          )}
          {creator.showSocialOnCreator !== false && creator.instagramUrl && (
            <a href={creator.instagramUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-pink-50 text-pink-700 rounded-xl hover:bg-pink-100 transition font-medium text-sm">
              Instagram <ChevronRight className="w-4 h-4 ml-auto" />
            </a>
          )}
          {creator.showSocialOnCreator !== false && creator.tiktokUrl && (
            <a href={creator.tiktokUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition font-medium text-sm">
              TikTok <ChevronRight className="w-4 h-4 ml-auto" />
            </a>
          )}
          {creator.website && (
            <a href={creator.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition font-medium text-sm">
              <Globe className="w-4 h-4" /> Website <ChevronRight className="w-4 h-4 ml-auto" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== GEAR SECTION =====
function GearSection({ creatorId }: { creatorId: string }) {
  const [gearItems, setGearItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchGear(); }, [creatorId]);

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
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (gearItems.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <Star className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No gear listed yet</p>
        <p className="text-gray-400 text-sm mt-1">This creator hasn't added their gear setup.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {gearItems.map((item) => (
        <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition group">
          {item.imageUrl && (
            <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>
          )}
          <div className="p-4">
            <h3 className="font-semibold text-gray-900">{item.name}</h3>
            {item.category && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">{item.category}</span>
            )}
            {item.description && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{item.description}</p>}
            {item.affiliateUrl && (
              <a href={item.affiliateUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-amber-600 hover:underline font-medium">
                View Product <ChevronRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== COLLABS SECTION =====
function CollabsSection({ creatorId, creatorName, isOwner }: { creatorId: string; creatorName: string; isOwner: boolean }) {
  const [collabs, setCollabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCollabs(); }, [creatorId]);

  const fetchCollabs = async () => {
    try {
      const response = await api.get(`/creators/${creatorId}/collaborations`);
      setCollabs(response.data || []);
    } catch (error) {
      // Endpoint might not exist yet, that's ok
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (collabs.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No collaborations yet</p>
        <p className="text-gray-400 text-sm mt-1">
          {isOwner ? 'Team up with other creators to grow your audience!' : `${creatorName} hasn't posted any collaborations yet.`}
        </p>
        {isOwner && (
          <Link to="/creator/dashboard" className="inline-block mt-4 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium hover:shadow-md transition">
            Manage Collaborators
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {collabs.map((collab) => (
        <div key={collab.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
          <img
            src={collab.collaborator?.profilePicture || '/default-avatar.png'}
            alt={collab.collaborator?.username}
            className="w-14 h-14 rounded-xl object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {collab.collaborator?.firstName} {collab.collaborator?.lastName}
            </p>
            <p className="text-sm text-gray-500">@{collab.collaborator?.username}</p>
            <div className="flex gap-1 mt-1">
              {collab.canPost && <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded">Post</span>}
              {collab.canEdit && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">Edit</span>}
            </div>
          </div>
          <Link to={`/creators/${collab.collaborator?.username}`} className="text-amber-500 hover:text-amber-600">
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      ))}
    </div>
  );
}
