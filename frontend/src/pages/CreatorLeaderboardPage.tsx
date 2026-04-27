import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Eye,
  Heart,
  Users,
  TrendingUp,
  Crown,
  Medal,
  Award,
  ChevronLeft,
  Star,
  Flame,
  Snowflake,
  Compass,
  Sparkles,
  RefreshCw,
  Check,
  Play,
  FileText,
  Image,
} from 'lucide-react';
import api from '../services/api';

interface Creator {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  creatorBio: string | null;
  creatorVerified: boolean;
  creatorHandle?: string;
  creatorDisplayName?: string;
  creatorSpecialties?: string[];
  creatorStats?: {
    totalViews: number;
    totalLikes: number;
    followerCount: number;
    viewsThisWeek?: number;
    followersThisWeek?: number;
  };
  lastPostDate?: string;
  isInactive?: boolean;
  heatLevel?: number;
  isDiscovery?: boolean;

  _count?: {
    creatorContent: number;
  };
  creatorContent?: {
    publishedAt: string;
    category?: string;
  }[];
}

interface DiscoveryContent {
  id: string;
  contentType: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  category?: string;
  viewCount: number;
  publishedAt?: string;
  isDiscovery?: boolean;
  creator: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
    creatorVerified?: boolean;
    creatorDisplayName?: string;
    creatorHandle?: string;
  };
  campground?: {
    id: string;
    name: string;
    state?: string;
  };
  _count: {
    likes: number;
    comments: number;
    saves: number;
  };
}

interface Category {
  id: string;
  label: string;
  emoji: string;
}

type SortBy = 'contributionScore' | 'views' | 'likes' | 'followers' | 'content' | 'discovery';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'GEAR_REVIEWS', label: 'Gear Reviews', emoji: '\u{1F527}' },
  { id: 'CAMPGROUND_REVIEWS', label: 'Campground Reviews', emoji: '\u{26FA}' },
  { id: 'TRAVEL_DAYS', label: 'Travel Days', emoji: '\u{1F6E3}\u{FE0F}' },
  { id: 'TIPS_HACKS', label: 'Tips & Hacks', emoji: '\u{1F4A1}' },
  { id: 'FULL_TIME_RV', label: 'Full-Time RV Life', emoji: '\u{1F3E0}' },
  { id: 'WEEKEND_TRIPS', label: 'Weekend Trips', emoji: '\u{1F3D5}\u{FE0F}' },
  { id: 'COOKING', label: 'Camp Cooking', emoji: '\u{1F373}' },
  { id: 'MAINTENANCE', label: 'RV Maintenance', emoji: '\u{1F529}' },
  { id: 'BOONDOCKING', label: 'Boondocking', emoji: '\u{1F332}' },
  { id: 'FAMILY', label: 'Family Camping', emoji: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}' },
  { id: 'PETS', label: 'RVing with Pets', emoji: '\u{1F415}' },
  { id: 'SOLAR_TECH', label: 'Solar & Tech', emoji: '\u{2600}\u{FE0F}' },
];

const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  VIDEO: <Play className="w-4 h-4" />,
  SHORT: <Play className="w-4 h-4" />,
  BLOG: <FileText className="w-4 h-4" />,
  PHOTO_GALLERY: <Image className="w-4 h-4" />,
};

const SCORE_COLORS: Record<string, { color: string; label: string }> = {
  reviews: { color: '#4CAF50', label: 'Reviews' },
  states: { color: '#2196F3', label: 'States' },
  trips: { color: '#FF9800', label: 'Trips' },
  mods: { color: '#9C27B0', label: 'Mods' },
  engagement: { color: '#F44336', label: 'Engagement' },
  trivia: { color: '#00BCD4', label: 'Trivia' },
  checkins: { color: '#795548', label: 'Check-ins' },
  followers: { color: '#607D8B', label: 'Followers' },
  founding: { color: '#FFC107', label: 'Founding' },
};

function ScoreBreakdownBar({ breakdown, score }: { breakdown: Record<string, number>; score: number }) {
  if (!breakdown || score === 0) return null;
  const segments = Object.entries(breakdown).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div className="mt-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100" title={`Total: ${Math.round(score)}`}>
        {segments.map(([key, value]) => {
          const config = SCORE_COLORS[key] || { color: '#999', label: key };
          const pct = (value / score) * 100;
          return (
            <div
              key={key}
              className="h-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: config.color }}
              title={`${config.label}: ${value} pts`}
            />
          );
        })}
      </div>
    </div>
  );
}

function HowScoresWork() {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full">
        <Trophy className="w-4 h-4 text-amber-500" />
        How Community Scores Work
        <span className="ml-auto text-gray-400">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="mt-3 text-sm text-gray-600 space-y-2">
          <p>Community Score rewards platform contributions over raw audience size:</p>
          <ul className="space-y-1 ml-4">
            <li><span style={{ color: SCORE_COLORS.reviews.color }}>Reviews</span>: 15 pts/review with text, 5 pts star-only (max 150)</li>
            <li><span style={{ color: SCORE_COLORS.states.color }}>States</span>: 8 pts/state visited (max 400)</li>
            <li><span style={{ color: SCORE_COLORS.trips.color }}>Trips</span>: 20 pts/trip with photos, 8 without (max 300)</li>
            <li><span style={{ color: SCORE_COLORS.mods.color }}>Mods</span>: 25 pts/mod with before/after, 10 without (max 200)</li>
            <li><span style={{ color: SCORE_COLORS.engagement.color }}>Engagement</span>: 2 pts/reply, 1 pt/reaction last 90d (max 100)</li>
            <li><span style={{ color: SCORE_COLORS.trivia.color }}>Trivia</span>: streak x 1.5 (max 75)</li>
            <li><span style={{ color: SCORE_COLORS.checkins.color }}>Check-ins</span>: 10 pts with photo, 4 without last 12mo (max 120)</li>
            <li><span style={{ color: SCORE_COLORS.followers.color }}>Followers</span>: log10(followers+1) x 10 (max 50)</li>
            <li><span style={{ color: SCORE_COLORS.founding.color }}>Founding</span>: 50 pts flat for early members</li>
          </ul>
          <p className="text-xs text-gray-400 mt-2">Scores recalculate every Sunday at 2 AM CT.</p>
        </div>
      )}
    </div>
  );
}

export default function CreatorLeaderboardPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [discoveryContent, setDiscoveryContent] = useState<DiscoveryContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('contributionScore');
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [interestsLoaded, setInterestsLoaded] = useState(false);
  const [interestsDirty, setInterestsDirty] = useState(false);

  useEffect(() => {
    loadUserInterests();
  }, []);

  useEffect(() => {
    if (sortBy === 'discovery') {
      fetchDiscovery();
    } else {
      fetchLeaderboard(sortBy);
    }
  }, [sortBy]);

  const loadUserInterests = async () => {
    try {
      const { data } = await api.get('/creators/discovery/interests');
      setUserInterests(data.interests || []);
    } catch (error) {
      // Not logged in or error
    } finally {
      setInterestsLoaded(true);
    }
  };

  const saveAndRefresh = async (interests: string[]) => {
    try {
      await api.put('/creators/discovery/interests', { interests });
      setUserInterests(interests);
      setInterestsDirty(false);
      // Re-fetch discovery with new interests
      fetchDiscoveryWithInterests(interests);
    } catch (error) {
      console.error('Error saving interests:', error);
    }
  };

  const fetchLeaderboard = async (sort?: string) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/creators/leaderboard?sortBy=${sort || sortBy}&limit=50`);
      setCreators(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscovery = async () => {
    fetchDiscoveryWithInterests(userInterests);
  };

  const fetchDiscoveryWithInterests = async (interests: string[]) => {
    try {
      setLoading(true);
      const interestsParam = interests.length > 0 ? `&interests=${interests.join(',')}` : '';

      const [creatorsRes, contentRes] = await Promise.all([
        api.get(`/creators/discovery?limit=20${interestsParam}`),
        api.get(`/creators/discovery/content?limit=10${interestsParam}`),
      ]);

      setCreators(creatorsRes.data);
      setDiscoveryContent(contentRes.data);
    } catch (error) {
      console.error('Error fetching discovery:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (categoryId: string) => {
    const updated = userInterests.includes(categoryId)
      ? userInterests.filter(i => i !== categoryId)
      : [...userInterests, categoryId];
    setUserInterests(updated);
    setInterestsDirty(true);
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-8 h-8 text-yellow-500" />;
    if (index === 1) return <Medal className="w-7 h-7 text-gray-400" />;
    if (index === 2) return <Award className="w-6 h-6 text-amber-600" />;
    return <span className="text-2xl font-bold text-gray-400 w-8 text-center">#{index + 1}</span>;
  };

  const getRankBg = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300';
    if (index === 1) return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300';
    if (index === 2) return 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300';
    return 'bg-white border-gray-200';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getHeatBadge = (heatLevel?: number, isInactive?: boolean) => {
    if (isInactive) {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
          <Snowflake className="w-3 h-3" /> Ice Cold
        </span>
      );
    }

    const badges: Record<number, { bg: string; text: string; label: string; pulse?: boolean }> = {
      1: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Heating Up' },
      2: { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Boomshakalaka!' },
      3: { bg: 'bg-orange-200', text: 'text-orange-700', label: 'Slam-a-jamma!' },
      4: { bg: 'bg-red-100', text: 'text-red-600', label: 'Is it the shoes?!' },
      5: { bg: 'bg-red-200', text: 'text-red-700', label: "Whoomp, there it is!" },
      6: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'From downtown!', pulse: true },
      7: { bg: 'bg-gradient-to-r from-red-500 to-orange-500', text: 'text-white', label: 'THE NAIL IN THE COFFIN!', pulse: true },
    };

    const badge = badges[heatLevel || 0];
    if (!badge) return null;

    return (
      <span className={`flex items-center gap-1 px-2 py-0.5 ${badge.bg} ${badge.text} rounded-full text-xs font-medium ${badge.pulse ? 'animate-pulse' : ''}`}>
        <Flame className="w-3 h-3" /> {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`text-white ${sortBy === 'discovery' ? 'bg-gradient-to-r from-purple-600 to-indigo-700' : 'bg-gradient-to-r from-primary-600 to-primary-800'}`}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Link to="/basecamp" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4">
            <ChevronLeft className="w-5 h-5" />
            Back to Basecamp
          </Link>
          <div className="flex items-center gap-4">
            {sortBy === 'discovery' ? (
              <Compass className="w-12 h-12 text-yellow-300" />
            ) : (
              <Trophy className="w-12 h-12 text-yellow-400" />
            )}
            <div>
              <h1 className="text-3xl font-bold">
                {sortBy === 'discovery' ? 'Discover Rig Profiles' : 'Top 50 Rig Profiles'}
              </h1>
              <p className="text-white/70">
                {sortBy === 'discovery'
                  ? 'Find rigs and road content tailored to your interests'
                  : 'The most active rig profiles in our RV community'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sort Options */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-gray-600 font-medium">Sort by:</span>
            <button
              onClick={() => setSortBy('contributionScore')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'contributionScore'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Trophy className="w-4 h-4 inline mr-2" />
              Community Score
            </button>
            <button
              onClick={() => setSortBy('discovery')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'discovery'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Compass className="w-4 h-4 inline mr-2" />
              Discovery
            </button>
            <button
              onClick={() => setSortBy('views')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'views' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Most Views
            </button>
            <button
              onClick={() => setSortBy('likes')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'likes' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Heart className="w-4 h-4 inline mr-2" />
              Most Likes
            </button>
            <button
              onClick={() => setSortBy('followers')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'followers' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Most Followers
            </button>
            <button
              onClick={() => setSortBy('content')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'content' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Most Content
            </button>
          </div>
        </div>

        {/* How Scores Work (shown for contribution score mode) */}
        {sortBy === 'contributionScore' && <HowScoresWork />}

        {/* Discovery Section */}
        {sortBy === 'discovery' && (
          <div className="space-y-6">
            {/* Interest Chips */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  <h2 className="font-semibold text-gray-900">Your Interests</h2>
                  {userInterests.length > 0 && (
                    <span className="text-sm text-gray-500">({userInterests.length} selected)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchDiscovery}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Shuffle
                  </button>
                  {interestsDirty && (
                    <button
                      onClick={() => saveAndRefresh(userInterests)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      <Check className="w-4 h-4" />
                      Save & Refresh
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Select topics you're interested in to see personalized rig recommendations. These also personalize your Basecamp feed.
              </p>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_CATEGORIES.map((cat) => {
                  const isSelected = userInterests.includes(cat.id);
                  return (

                    <button
                      key={cat.id}
                      onClick={() => toggleInterest(cat.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      {cat.label}
                      {isSelected && <Check className="w-3.5 h-3.5 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Discovery Content Preview */}
            {discoveryContent.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Play className="w-5 h-5 text-purple-500" />
                  <h2 className="font-semibold text-gray-900">Discover Content</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {discoveryContent.map((item) => (
                    <Link
                      key={item.id}
                      to={`/creators/${item.creator.username}/content/${item.id}`}
                      className="group block rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg hover:border-purple-300 transition"
                    >
                      <div className="relative aspect-video bg-gray-100">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.title || ''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            {CONTENT_TYPE_ICONS[item.contentType] || <FileText className="w-8 h-8" />}
                          </div>
                        )}
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded-full text-white text-[10px]">
                          {CONTENT_TYPE_ICONS[item.contentType]}
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded text-white text-[10px]">
                          <Eye className="w-3 h-3" />
                          {formatNumber(item.viewCount)}
                        </div>
                      </div>
                      <div className="p-2.5">
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-purple-600">
                          {item.title || 'Untitled'}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {item.creator.profilePicture ? (
                            <img src={item.creator.profilePicture} className="w-4 h-4 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center text-[8px] text-purple-700 font-bold">
                              {(item.creator.firstName?.[0] || item.creator.username[0]).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-gray-500 truncate">
                            {item.creator.creatorDisplayName || `${item.creator.firstName || ''} ${item.creator.lastName || ''}`.trim() || item.creator.username}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Discovery Creators Header */}
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-purple-500" />
              <h2 className="font-semibold text-gray-900">Rig Profiles to Discover</h2>
            </div>
          </div>
        )}

        {/* Creator List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">
              {sortBy === 'discovery' ? 'Finding rig profiles for you...' : 'Loading leaderboard...'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {creators.map((creator, index) => (
              <Link
                key={creator.id}
                to={`/creators/${creator.username}`}
                className={`block rounded-xl border-2 p-4 hover:shadow-lg transition ${
                  sortBy === 'discovery'
                    ? 'bg-white border-gray-200 hover:border-purple-300'
                    : getRankBg(index)
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank or Discovery Icon */}
                  <div className="flex-shrink-0 w-12 flex justify-center">
                    {sortBy === 'discovery' ? (
                      <Sparkles className="w-6 h-6 text-purple-400" />
                    ) : (
                      getRankIcon(index)
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {creator.profilePicture ? (
                      <img
                        src={creator.profilePicture}
                        alt={creator.username}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-white shadow">
                        {creator.firstName?.[0] || creator.username[0]}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {creator.creatorDisplayName || `${creator.firstName} ${creator.lastName}`}
                      </h3>
                      {creator.creatorVerified && (
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                      {getHeatBadge(creator.heatLevel, creator.isInactive)}
                    </div>
                    <p className="text-gray-500">@{creator.creatorHandle || creator.username}</p>
                    {creator.creatorBio && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">{creator.creatorBio}</p>
                    )}
                    {/* Specialties in discovery mode */}
                    {sortBy === 'discovery' && creator.creatorSpecialties && creator.creatorSpecialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {creator.creatorSpecialties.slice(0, 3).map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Score breakdown bar in contribution mode */}
                    {sortBy === 'contributionScore' && (creator as any).rig?.scoreBreakdown && (
                      <ScoreBreakdownBar breakdown={(creator as any).rig.scoreBreakdown} score={(creator as any).rig?.contributionScore || 0} />
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 hidden md:flex items-center gap-6 text-sm">
                    {sortBy === 'contributionScore' && (creator as any).rig?.contributionScore ? (
                      <div className="text-center">
                        <p className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                          {Math.round((creator as any).rig.contributionScore)}
                        </p>
                        <p className="text-gray-500 flex items-center gap-1">
                          <Trophy className="w-4 h-4" /> Score
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="text-center">
                          <p className="text-xl font-bold text-gray-900">
                            {formatNumber(creator.creatorStats?.totalViews || 0)}
                          </p>
                          <p className="text-gray-500 flex items-center gap-1">
                            <Eye className="w-4 h-4" /> Views
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-gray-900">
                            {formatNumber(creator.creatorStats?.totalLikes || 0)}
                          </p>
                          <p className="text-gray-500 flex items-center gap-1">
                            <Heart className="w-4 h-4" /> Likes
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-gray-900">
                            {formatNumber(creator.creatorStats?.followerCount || 0)}
                          </p>
                          <p className="text-gray-500 flex items-center gap-1">
                            <Users className="w-4 h-4" /> Followers
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-gray-900">
                            {creator._count?.creatorContent || 0}
                          </p>
                          <p className="text-gray-500">Posts</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}

            {creators.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl">
                {sortBy === 'discovery' ? (
                  <>
                    <Compass className="w-16 h-16 text-gray-300 mx-auto" />
                    <p className="mt-4 text-gray-500">No new rig profiles to discover right now.</p>
                    <p className="text-sm text-gray-400 mt-1">Try selecting different interests above!</p>
                  </>
                ) : (
                  <>
                    <Trophy className="w-16 h-16 text-gray-300 mx-auto" />
                    <p className="mt-4 text-gray-500">No rig profiles found yet. Be the first!</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
