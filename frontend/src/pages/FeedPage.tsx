import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import MentionInput from '../components/MentionInput';
import MentionText from '../components/MentionText';
import {
  MessageSquare, Plus, Search, Star, Filter, ChevronDown, ChevronUp,
  Heart, Eye, Clock, TrendingUp, Flame, Zap, X, MapPin, Hash,
  Image as ImageIcon, Link as LinkIcon, BarChart3, Share2, Bookmark,
  Users, Tent, ArrowBigUp, ArrowBigDown, Loader2, AlertCircle,
  Sparkles, MessageCircle
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Thread {
  id: string;
  title: string;
  content?: string;
  slug: string;
  viewCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  campground?: {
    id: string;
    name: string;
    slug?: string;
    location?: string;
    state?: string;
  };
  tags: Array<{
    tag: {
      id: string;
      name: string;
      slug: string;
      color: string;
    };
  }>;
  _count: {
    posts: number;
    favorites: number;
  };
  isFavorited: boolean;
  score: number;
  userVote?: 'UP' | 'DOWN' | null;
  feedReason?: 'your_thread' | 'friend' | 'creator' | 'followed_campground' | 'upcoming_trip' | 'mentioned' | 'community';
  popularityScore?: number;
}

interface ThreadTag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface TrendingHashtag {
  tag: string;
  count: number;
}

interface ActiveCampground {
  id: string;
  name: string;
  slug?: string;
  state?: string;
  threadCount?: number;
}

// ─── Sort Options ───────────────────────────────────────────────────────────

type SortOption = 'hot' | 'new' | 'top' | 'rising';
type TimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

const SORT_OPTIONS: Array<{ key: SortOption; label: string; icon: React.ReactNode }> = [
  { key: 'hot', label: 'Hot', icon: <Flame className="w-4 h-4" /> },
  { key: 'new', label: 'New', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'top', label: 'Top', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'rising', label: 'Rising', icon: <Zap className="w-4 h-4" /> },
];

const TIME_RANGES: Array<{ key: TimeRange; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
];

// ─── Tag Icon Map ───────────────────────────────────────────────────────────

const TAG_ICONS: Record<string, string> = {
  'tips': '💡', 'tips-tricks': '💡', 'question': '❓', 'questions': '❓',
  'trip-report': '🗺️', 'gear-review': '🎒', 'gear': '🎒',
  'rv-maintenance': '🔧', 'maintenance': '🔧', 'campground-review': '⭐',
  'review': '⭐', 'photos': '📸', 'meetup': '🤝', 'meetups': '🤝',
  'news': '📰', 'safety': '🛡️', 'recipes': '🍳', 'stories': '📖',
  'help': '🆘', 'discussion': '💬', 'deals': '💰', 'wildlife': '🦌',
};

// ─── Utility Functions ──────────────────────────────────────────────────────

const formatTimeAgo = (date: string) => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
};

const formatNumber = (n: number) => {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
};

const stripHtml = (html: string) => {
  return html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&') || '';
};

// ─── Vote Button Component ─────────────────────────────────────────────────

function VoteButtons({
  score,
  userVote,
  onVote,
}: {
  score: number;
  userVote: 'UP' | 'DOWN' | null;
  onVote: (type: 'UP' | 'DOWN') => void;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onVote('UP'); }}
        className={`p-1 rounded-md transition-all duration-150 ${
          userVote === 'UP'
            ? 'text-orange-500 bg-orange-50'
            : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
        }`}
        aria-label="Upvote"
      >
        <ArrowBigUp className={`w-6 h-6 ${userVote === 'UP' ? 'fill-current' : ''}`} />
      </button>
      <span className={`text-sm font-bold tabular-nums min-w-[2ch] text-center ${
        userVote === 'UP' ? 'text-orange-500' : userVote === 'DOWN' ? 'text-blue-500' : 'text-gray-700'
      }`}>
        {formatNumber(score)}
      </span>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onVote('DOWN'); }}
        className={`p-1 rounded-md transition-all duration-150 ${
          userVote === 'DOWN'
            ? 'text-blue-500 bg-blue-50'
            : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
        }`}
        aria-label="Downvote"
      >
        <ArrowBigDown className={`w-6 h-6 ${userVote === 'DOWN' ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
}

// ─── Feed Reason Badge ──────────────────────────────────────────────────────

function FeedReasonBadge({ reason }: { reason: string }) {
  const configs: Record<string, { label: string; icon: string; classes: string }> = {
    followed_campground: { label: 'Your Campground', icon: '🏕️', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    upcoming_trip: { label: 'Upcoming Trip', icon: '📅', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    friend: { label: 'Friend', icon: '👥', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
    creator: { label: 'Creator', icon: '⭐', classes: 'bg-purple-50 text-purple-700 border-purple-200' },
    mentioned: { label: 'Mentioned You', icon: '💬', classes: 'bg-pink-50 text-pink-700 border-pink-200' },
    your_thread: { label: 'Your Thread', icon: '✍️', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  };
  const config = configs[reason];
  if (!config || reason === 'community') return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.classes}`}>
      {config.icon} {config.label}
    </span>
  );
}

// ─── Thread Card Component ──────────────────────────────────────────────────

function ThreadCard({
  thread,
  user,
  onVote,
  onFavorite,
}: {
  thread: Thread;
  user: any;
  onVote: (threadId: string, voteType: 'UP' | 'DOWN') => void;
  onFavorite: (threadId: string) => void;
}) {
  const navigate = useNavigate();
  const initials = (thread.author.firstName?.[0] || '') + (thread.author.lastName?.[0] || '');
  const hasCampgroundBanner = thread.campground && thread.feedReason &&
    ['followed_campground', 'upcoming_trip'].includes(thread.feedReason);

  return (
    <div
      className={`group bg-white rounded-xl border transition-all duration-200 hover:border-gray-300 hover:shadow-sm cursor-pointer ${
        thread.isPinned ? 'border-l-4 border-l-amber-400' : 'border-gray-200'
      }`}
      onClick={() => navigate(`/threads/${thread.id}`)}
    >
      {/* Campground Context Banner */}
      {hasCampgroundBanner && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 rounded-t-xl text-xs">
          <Tent className="w-3.5 h-3.5 text-emerald-600" />
          <Link
            to={`/campgrounds/${thread.campground!.slug || thread.campground!.id}`}
            className="font-medium text-emerald-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {thread.campground!.name}
          </Link>
          {thread.campground!.state && (
            <>
              <span className="text-emerald-300">•</span>
              <span className="text-emerald-600">{thread.campground!.state}</span>
            </>
          )}
        </div>
      )}

      <div className="flex">
        {/* Vote Column */}
        <div className="flex-shrink-0 px-2 flex items-start justify-center">
          <VoteButtons
            score={thread.score || 0}
            userVote={thread.userVote || null}
            onVote={(type) => {
              if (user) onVote(thread.id, type);
            }}
          />
        </div>

        {/* Content Column */}
        <div className="flex-1 py-3 pr-4 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {/* Feed reason badge (only non-campground reasons, since campground is shown in banner) */}
            {thread.feedReason && thread.feedReason !== 'community' && !hasCampgroundBanner && (
              <FeedReasonBadge reason={thread.feedReason} />
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Link
                to={`/profile/${thread.author.username}`}
                className="flex items-center gap-1.5 hover:text-gray-800"
                onClick={(e) => e.stopPropagation()}
              >
                {thread.author.profilePicture ? (
                  <img
                    src={thread.author.profilePicture}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">{initials}</span>
                  </div>
                )}
                <span className="font-medium text-gray-700">
                  {thread.author.firstName} {thread.author.lastName}
                </span>
              </Link>
              <span>•</span>
              <span>{formatTimeAgo(thread.createdAt)}</span>
              {/* Campground tag (for threads not using the banner) */}
              {thread.campground && !hasCampgroundBanner && (
                <>
                  <span>•</span>
                  <Link
                    to={`/campgrounds/${thread.campground.slug || thread.campground.id}`}
                    className="text-emerald-600 font-medium hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MapPin className="w-3 h-3" />
                    {thread.campground.name}
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="font-bold text-gray-900 leading-snug mb-1 text-[15px] group-hover:text-primary-700 transition">
            {thread.isPinned && <span className="text-amber-500 mr-1.5">📌</span>}
            {thread.title}
          </h3>

          {/* Tags */}
          {thread.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {thread.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{
                    backgroundColor: tag.color + '15',
                    color: tag.color,
                    border: `1px solid ${tag.color}30`,
                  }}
                >
                  {TAG_ICONS[tag.slug] || '🏷️'} {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Content Preview */}
          {thread.content && (
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-1">
              {stripHtml(thread.content)}
            </p>
          )}

          {/* Image preview */}
          {thread.imageUrl && (
            <div className="mt-2 mb-2">
              <img
                src={thread.imageUrl}
                alt=""
                className="rounded-lg max-h-64 object-cover border border-gray-200"
              />
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center gap-1 mt-2 text-xs">
            <button
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-2.5 py-1.5 rounded-md transition font-medium"
              onClick={(e) => { e.stopPropagation(); navigate(`/threads/${thread.id}`); }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {thread._count.posts} {thread._count.posts === 1 ? 'Reply' : 'Replies'}
            </button>

            {user && (
              <button
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition font-medium ${
                  thread.isFavorited
                    ? 'text-amber-600 bg-amber-50'
                    : 'text-gray-500 hover:text-amber-600 hover:bg-amber-50'
                }`}
                onClick={(e) => { e.stopPropagation(); onFavorite(thread.id); }}
              >
                <Bookmark className={`w-3.5 h-3.5 ${thread.isFavorited ? 'fill-current' : ''}`} />
                {thread.isFavorited ? 'Saved' : 'Save'}
              </button>
            )}

            <button
              className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-md transition font-medium"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText(`${window.location.origin}/threads/${thread.id}`);
              }}
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>

            <span className="flex items-center gap-1 text-gray-400 ml-auto">
              <Eye className="w-3 h-3" />
              {formatNumber(thread.viewCount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Active Trip Banner ─────────────────────────────────────────────────────

function ActiveTripBanner({
  campground,
  threadCount,
  onViewAll,
}: {
  campground: ActiveCampground;
  threadCount: number;
  onViewAll: () => void;
}) {
  return (
    <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-xl p-4 text-white mb-5 shadow-lg relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M30%205L5%2055h50L30%205z%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%2F%3E%3C%2Fsvg%3E')]" />
      <div className="relative flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tent className="w-5 h-5" />
            <span className="text-xs font-medium uppercase tracking-wider opacity-80">Currently Camping At</span>
          </div>
          <h3 className="text-xl font-bold">{campground.name}</h3>
          <p className="text-sm opacity-80 mt-0.5">
            {threadCount} active {threadCount === 1 ? 'discussion' : 'discussions'} at this campground
          </p>
        </div>
        <button
          onClick={onViewAll}
          className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-semibold transition border border-white/20"
        >
          View Campground Threads →
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar: Trending Hashtags ─────────────────────────────────────────────

function TrendingSidebar({ hashtags }: { hashtags: TrendingHashtag[] }) {
  if (!hashtags || hashtags.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Flame className="w-4 h-4" /> Trending in the Community
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {hashtags.slice(0, 7).map((h, i) => (
          <Link
            key={h.tag}
            to={`/feed?tag=${h.tag}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition"
          >
            <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-800">#{h.tag}</span>
              <span className="text-xs text-gray-400 ml-2">{h.count} posts</span>
            </div>
            <TrendingUp className="w-3 h-3 text-emerald-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar: Community Stats ───────────────────────────────────────────────

function CommunitySidebar({ onNewThread }: { onNewThread: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
        🦄 RVUnicorn Community
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center p-2.5 bg-gray-50 rounded-lg">
          <div className="text-lg font-bold text-gray-800">31K+</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Campgrounds</div>
        </div>
        <div className="text-center p-2.5 bg-gray-50 rounded-lg">
          <div className="text-lg font-bold text-gray-800">Active</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Community</div>
        </div>
      </div>
      <button
        onClick={onNewThread}
        className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:shadow-md transition flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Start a Discussion
      </button>
    </div>
  );
}

// ─── Sidebar: Popular Tags ──────────────────────────────────────────────────

function PopularTagsSidebar({ tags, selectedTag, onSelectTag }: {
  tags: ThreadTag[];
  selectedTag: string;
  onSelectTag: (slug: string) => void;
}) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
        <Hash className="w-4 h-4 text-gray-500" /> Browse by Topic
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {selectedTag && (
          <button
            onClick={() => onSelectTag('')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => onSelectTag(tag.slug === selectedTag ? '' : tag.slug)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
              tag.slug === selectedTag ? 'ring-2 ring-offset-1' : 'hover:shadow-sm'
            }`}
            style={{
              backgroundColor: tag.color + '12',
              color: tag.color,
              border: `1px solid ${tag.color}25`,
              ...(tag.slug === selectedTag ? { ringColor: tag.color } : {}),
            }}
          >
            {TAG_ICONS[tag.slug] || '🏷️'} {tag.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FEED PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FeedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── State ──────────────────────────────────────────────────────────────
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tags, setTags] = useState<ThreadTag[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([]);
  const [activeCampground, setActiveCampground] = useState<ActiveCampground | null>(null);

  // Sort & Filter
  const [sortBy, setSortBy] = useState<SortOption>('hot');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [myFeedOnly, setMyFeedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>(searchParams.get('tag') || '');

  // New Thread Modal
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [newThread, setNewThread] = useState({
    title: '',
    content: '',
    campgroundId: '',
    tagIds: [] as string[],
  });
  const [campgrounds, setCampgrounds] = useState<Array<{ id: string; name: string; slug?: string }>>([]);
  const [campgroundSearch, setCampgroundSearch] = useState('');
  const [creating, setCreating] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // ─── Data Loading ───────────────────────────────────────────────────────

  // Load thread tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const { data } = await api.get('/threads/tags/all');
        setTags(data);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    };
    loadTags();
  }, []);

  // Load trending hashtags
  useEffect(() => {
    const loadTrending = async () => {
      try {
        const { data } = await api.get('/social/hashtags/trending');
        setTrendingHashtags(data);
      } catch (err) {
        // Trending not available - that's ok
      }
    };
    loadTrending();
  }, []);

  // Load active campground (from current trip)
  useEffect(() => {
    if (!user) return;
    const loadActiveCampground = async () => {
      try {
        // Try to get current trip campground
        const { data } = await api.get('/trips/active');
        if (data && data.campground) {
          setActiveCampground({
            id: data.campground.id,
            name: data.campground.name,
            slug: data.campground.slug,
            state: data.campground.state,
          });
        }
      } catch (err) {
        // No active trip - that's fine
      }
    };
    loadActiveCampground();
  }, [user]);

  // Load threads
  const loadThreads = useCallback(async (reset = true) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : page;

      if (myFeedOnly && user) {
        // Personalized feed
        const { data } = await api.get('/threads/feed', {
          params: {
            sort: sortBy,
            timeRange: sortBy === 'top' ? timeRange : undefined,
            tag: selectedTag || undefined,
            search: searchQuery || undefined,
            page: currentPage,
            limit: 20,
          },
        });

        if (reset) {
          setThreads(data);
        } else {
          setThreads(prev => [...prev, ...data]);
        }
        setHasMore(data.length === 20);
      } else {
        // All threads
        const { data } = await api.get('/threads', {
          params: {
            sort: sortBy,
            timeRange: sortBy === 'top' ? timeRange : undefined,
            tag: selectedTag || undefined,
            search: searchQuery || undefined,
            page: currentPage,
            limit: 20,
          },
        });

        if (reset) {
          setThreads(data);
        } else {
          setThreads(prev => [...prev, ...data]);
        }
        setHasMore(data.length === 20);
      }
    } catch (err) {
      console.error('Load threads error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sortBy, timeRange, myFeedOnly, selectedTag, searchQuery, page, user]);

  useEffect(() => {
    loadThreads(true);
  }, [sortBy, timeRange, myFeedOnly, selectedTag]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery !== undefined) {
        loadThreads(true);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleVote = async (threadId: string, voteType: 'UP' | 'DOWN') => {
    if (!user) return;
    try {
      const { data } = await api.post(`/threads/${threadId}/vote`, { voteType });
      setThreads(prev => prev.map(t => {
        if (t.id !== threadId) return t;
        let scoreDiff = 0;
        if (t.userVote === voteType) {
          // Removing vote
          scoreDiff = voteType === 'UP' ? -1 : 1;
        } else if (t.userVote) {
          // Changing vote
          scoreDiff = voteType === 'UP' ? 2 : -2;
        } else {
          // New vote
          scoreDiff = voteType === 'UP' ? 1 : -1;
        }
        return {
          ...t,
          score: (t.score || 0) + scoreDiff,
          userVote: data.voteType,
        };
      }));
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  const handleFavorite = async (threadId: string) => {
    if (!user) return;
    try {
      const { data } = await api.post(`/threads/${threadId}/favorite`);
      setThreads(prev => prev.map(t =>
        t.id === threadId
          ? { ...t, isFavorited: data.favorited, _count: { ...t._count, favorites: t._count.favorites + (data.favorited ? 1 : -1) } }
          : t
      ));
    } catch (err) {
      console.error('Favorite error:', err);
    }
  };

  // Search campgrounds for new thread
  const searchCampgrounds = async (query: string) => {
    setCampgroundSearch(query);
    if (query.length < 2) { setCampgrounds([]); return; }
    try {
      const { data } = await api.get('/campgrounds/search', { params: { q: query, limit: 5 } });
      setCampgrounds(Array.isArray(data) ? data : data.campgrounds || []);
    } catch (err) {
      console.error('Campground search error:', err);
    }
  };

  // Create new thread
  const handleCreateThread = async () => {
    if (!newThread.title.trim() || creating) return;
    try {
      setCreating(true);
      const { data } = await api.post('/threads', {
        title: newThread.title,
        content: newThread.content,
        campgroundId: newThread.campgroundId || undefined,
        tagIds: newThread.tagIds,
      });
      setShowNewThreadModal(false);
      setNewThread({ title: '', content: '', campgroundId: '', tagIds: [] });
      navigate(`/threads/${data.id}`);
    } catch (err) {
      console.error('Create thread error:', err);
    } finally {
      setCreating(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setNewThread(prev => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter(id => id !== tagId)
        : [...prev.tagIds, tagId]
    }));
  };

  // ─── Computed ───────────────────────────────────────────────────────────

  const campgroundThreadCount = activeCampground
    ? threads.filter(t => t.campground?.id === activeCampground.id).length
    : 0;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex gap-5">
        {/* ═══ Main Feed Column ═══ */}
        <div className="flex-1 min-w-0">

          {/* Active Trip Banner */}
          {activeCampground && (
            <ActiveTripBanner
              campground={activeCampground}
              threadCount={campgroundThreadCount}
              onViewAll={() => {
                navigate(`/campgrounds/${activeCampground.slug || activeCampground.id}`);
              }}
            />
          )}

          {/* Sort Controls Bar */}
          <div className="bg-white rounded-xl border border-gray-200 px-3 py-2 mb-4 flex items-center gap-1 flex-wrap">
            {/* Sort Options */}
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  sortBy === opt.key
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}

            {/* Time range (for Top sort) */}
            {sortBy === 'top' && (
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-200">
                {TIME_RANGES.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setTimeRange(r.key)}
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      timeRange === r.key
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            {/* Right side controls */}
            <div className="ml-auto flex items-center gap-2">
              {/* My Feed toggle */}
              {user && (
                <button
                  onClick={() => setMyFeedOnly(!myFeedOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                    myFeedOnly
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${myFeedOnly ? 'fill-current' : ''}`} />
                  My Feed
                </button>
              )}

              {/* New Thread Button */}
              {user && (
                <button
                  onClick={() => setShowNewThreadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  New Thread
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search threads, campgrounds, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Active tag filter indicator */}
          {selectedTag && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-primary-50 rounded-lg border border-primary-200">
              <Filter className="w-4 h-4 text-primary-600" />
              <span className="text-sm text-primary-700 font-medium">
                Filtering by: #{selectedTag}
              </span>
              <button
                onClick={() => setSelectedTag('')}
                className="ml-auto text-primary-600 hover:text-primary-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Thread List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {myFeedOnly ? 'Your feed is empty' : 'No threads found'}
              </h3>
              <p className="text-gray-500 mb-4 max-w-md mx-auto">
                {myFeedOnly
                  ? 'Follow campgrounds, make friends, and join discussions to see activity here!'
                  : searchQuery
                    ? `No results for "${searchQuery}". Try different keywords.`
                    : 'Be the first to start a discussion!'}
              </p>
              {myFeedOnly && (
                <button
                  onClick={() => setMyFeedOnly(false)}
                  className="btn btn-primary"
                >
                  Browse All Threads
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {threads.map(thread => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  user={user}
                  onVote={handleVote}
                  onFavorite={handleFavorite}
                />
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && threads.length > 0 && !loading && (
            <div className="text-center py-6">
              <button
                onClick={() => {
                  setPage(p => p + 1);
                  loadThreads(false);
                }}
                disabled={loadingMore}
                className="text-sm text-gray-500 hover:text-primary-600 font-medium transition flex items-center gap-2 mx-auto"
              >
                {loadingMore ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                ) : (
                  'Load more threads...'
                )}
              </button>
            </div>
          )}
        </div>

        {/* ═══ Sidebar ═══ */}
        <div className="w-72 flex-shrink-0 space-y-4 hidden lg:block">
          <CommunitySidebar onNewThread={() => user ? setShowNewThreadModal(true) : navigate('/login')} />
          <TrendingSidebar hashtags={trendingHashtags} />
          <PopularTagsSidebar tags={tags} selectedTag={selectedTag} onSelectTag={setSelectedTag} />
        </div>
      </div>

      {/* ═══ New Thread Modal ═══ */}
      {showNewThreadModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 sm:pt-20 px-4 overflow-y-auto"
          onClick={() => setShowNewThreadModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Start a Discussion</h2>
                <button
                  onClick={() => setShowNewThreadModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Campground Selector */}
              <div className="mb-4">
                {newThread.campgroundId ? (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <Tent className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">
                      Posting to: {campgrounds.find(c => c.id === newThread.campgroundId)?.name || activeCampground?.name || 'Selected Campground'}
                    </span>
                    <button
                      className="ml-auto text-emerald-600 hover:text-emerald-800"
                      onClick={() => setNewThread(prev => ({ ...prev, campgroundId: '' }))}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Link to a campground (optional)..."
                        value={campgroundSearch}
                        onChange={(e) => searchCampgrounds(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    {campgrounds.length > 0 && (
                      <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {campgrounds.map(cg => (
                          <button
                            key={cg.id}
                            onClick={() => {
                              setNewThread(prev => ({ ...prev, campgroundId: cg.id }));
                              setCampgrounds([]);
                              setCampgroundSearch('');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm"
                          >
                            <Tent className="w-4 h-4 text-emerald-600" />
                            <span className="truncate">{cg.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {activeCampground && !campgroundSearch && (
                      <button
                        onClick={() => setNewThread(prev => ({ ...prev, campgroundId: activeCampground.id }))}
                        className="mt-2 flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
                      >
                        <Tent className="w-4 h-4" />
                        Post to your current campground: {activeCampground.name}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Title */}
              <input
                type="text"
                placeholder="An interesting title..."
                value={newThread.title}
                onChange={(e) => setNewThread(prev => ({ ...prev, title: e.target.value }))}
                className="w-full text-lg font-semibold border-none focus:outline-none focus:ring-0 placeholder-gray-300 mb-3"
                maxLength={200}
              />

              {/* Content */}
              <textarea
                placeholder="What's on your mind? Use @mentions and #hashtags..."
                value={newThread.content}
                onChange={(e) => setNewThread(prev => ({ ...prev, content: e.target.value }))}
                rows={6}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none placeholder-gray-400"
              />

              {/* Flair Tags */}
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Add flair:</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        newThread.tagIds.includes(tag.id) ? 'ring-2 ring-offset-1' : 'hover:shadow-sm'
                      }`}
                      style={{
                        backgroundColor: tag.color + '12',
                        color: tag.color,
                        border: `1px solid ${tag.color}30`,
                      }}
                    >
                      {TAG_ICONS[tag.slug] || '🏷️'} {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                Supports @mentions and #hashtags
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowNewThreadModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateThread}
                  disabled={!newThread.title.trim() || creating}
                  className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Posting...</>
                  ) : (
                    'Post Thread'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
