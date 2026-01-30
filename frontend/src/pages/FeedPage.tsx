import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, Plus, Search, Star, Filter, TrendingUp, Clock, Eye, Heart, ChevronDown, X, Tent, Tag } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
  feedReason?: 'your_thread' | 'friend' | 'creator' | 'followed_campground' | 'upcoming_trip' | 'mentioned' | 'community';
}

interface ThreadTag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export default function FeedPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<ThreadTag[]>([]);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'feed' | 'new' | 'popular'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>(searchParams.get('tag') || '');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'active'>('recent');

  const [newThread, setNewThread] = useState({
    title: '',
    content: '',
    campgroundId: '',
    tagIds: [] as string[]
  });
  const [campgrounds, setCampgrounds] = useState<Array<{ id: string; name: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [campgroundLocked, setCampgroundLocked] = useState(false);
  const [pendingCampgroundId, setPendingCampgroundId] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
    
    // Check URL params on mount
    const urlParams = new URLSearchParams(window.location.search);
    const campgroundParam = urlParams.get('campground');
    const lockedParam = urlParams.get('locked') === 'true';
    
    if (campgroundParam) {
      setPendingCampgroundId(campgroundParam);
      setCampgroundLocked(lockedParam);
      loadCampgrounds(campgroundParam);
      window.history.replaceState({}, '', '/feed');
    } else {
      loadCampgrounds();
    }
  }, []);

  // Open modal once campgrounds are loaded and we have a pending campground
  useEffect(() => {
    if (pendingCampgroundId && campgrounds.length > 0 && user) {
      const found = campgrounds.find(cg => cg.id === pendingCampgroundId);
      if (found) {
        setNewThread(prev => ({ ...prev, campgroundId: pendingCampgroundId }));
        setShowNewThreadModal(true);
        setPendingCampgroundId(null);
      }
    }
  }, [pendingCampgroundId, campgrounds, user]);

  useEffect(() => {
    if (activeTab === 'new') {
      loadThreads('new');
    } else if (activeTab === 'popular') {
      loadThreads('popular');
    } else if (activeTab === 'favorites') {
      loadFavorites();
    } else if (activeTab === 'feed') {
      loadFeed();
    } else if (activeTab === 'new') {
      loadThreads('new');
    } else if (activeTab === 'popular') {
      loadThreads('popular');
    } else {
      loadThreads();
    }
  }, [activeTab, selectedTag, sortBy, searchQuery]);

  const loadThreads = async (sortOverride?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedTag) params.append('tag', selectedTag);
      if (sortOverride) params.append('sort', sortOverride); else if (sortOverride) params.append('sort', sortOverride); else if (sortBy) params.append('sort', sortBy);
      if (searchQuery) params.append('search', searchQuery);
      
      const { data } = await api.get(`/threads?${params.toString()}`);
      setThreads(data);
    } catch (error) {
      console.error('Load threads error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/threads/favorites');
      setThreads(data);
    } catch (error) {
      console.error('Load favorites error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeed = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/threads/feed');
      // Feed now returns threads with feedReason
      setThreads(data);
    } catch (error) {
      console.error('Load feed error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const { data } = await api.get('/threads/tags/all');
      setTags(data);
    } catch (error) {
      console.error('Load tags error:', error);
    }
  };

  const loadCampgrounds = async (specificId?: string) => {
    try {
      const { data } = await api.get('/campgrounds?limit=100');
      let campgroundList = data.campgrounds || data;
      
      if (specificId && !campgroundList.find((cg: any) => cg.id === specificId)) {
        try {
          const { data: specificCampground } = await api.get(`/campgrounds/${specificId}`);
          if (specificCampground) {
            campgroundList = [specificCampground, ...campgroundList];
          }
        } catch (e) {
          console.log('Could not fetch specific campground');
        }
      }
      
      setCampgrounds(campgroundList);
    } catch (error) {
      console.error('Load campgrounds error:', error);
    }
  };

  const handleCreateThread = async () => {
    if (!newThread.title.trim()) {
      alert('Title is required');
      return;
    }
    
    try {
      setCreating(true);
      const { data } = await api.post('/threads', newThread);
      setShowNewThreadModal(false);
      setNewThread({ title: '', content: '', campgroundId: '', tagIds: [] });
      window.location.href = `/threads/${data.id}`;
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

  const handleFavorite = async (threadId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      alert('Please log in to favorite threads');
      return;
    }

    try {
      const { data } = await api.post(`/threads/${threadId}/favorite`);
      setThreads(threads.map(t => 
        t.id === threadId 
          ? { ...t, isFavorited: data.favorited, _count: { ...t._count, favorites: t._count.favorites + (data.favorited ? 1 : -1) } }
          : t
      ));
    } catch (error) {
      console.error('Favorite error:', error);
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

  const formatDate = (date: string) => {
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
    return d.toLocaleDateString();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-primary-600" />
            Community Feed
          </h1>
          <p className="text-gray-600 mt-1">Discussions, tips, and stories from fellow campers</p>
        </div>
        {user && (
          <button
            onClick={() => setShowNewThreadModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Thread
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('feed')}
          className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'feed'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Heart className="w-4 h-4" />
          My Feed
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 font-medium border-b-2 transition ${
            activeTab === 'all'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          All Threads
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'new'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          New
        </button>
        <button
          onClick={() => setActiveTab('popular')}
          className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'popular'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Popular
        </button>
        {user && (
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'favorites'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Star className="w-4 h-4" />
            Favorited Threads
          </button>
        )}
      </div>

      {/* Search & Filters - Only show for threads tabs */}
      {activeTab !== 'feed' && (
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input pr-10 appearance-none"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                <option value="active">Most Active</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {selectedTag && <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">1</span>}
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-gray-700 mb-2">Filter by Tag:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTag('')}
                  className={`px-3 py-1 rounded-full text-sm transition ${
                    !selectedTag
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTag(selectedTag === tag.slug ? '' : tag.slug)}
                    className={`px-3 py-1 rounded-full text-sm transition flex items-center gap-1 ${
                      selectedTag === tag.slug
                        ? 'font-medium'
                        : 'hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: selectedTag === tag.slug ? tag.color : `${tag.color}20`,
                      color: selectedTag === tag.slug ? 'white' : tag.color
                    }}
                  >
                    <Tag className="w-3 h-3" />
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : activeTab === 'feed' ? (
        // My Feed - Show threads from friends, creators, followed campgrounds, etc.
        threads.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Your feed is empty</h3>
            <p className="text-gray-500 mb-4">
              Follow campgrounds, make friends, and create threads to see activity here!
            </p>
            <button
              onClick={() => setActiveTab('all')}
              className="btn btn-primary"
            >
              Browse All Threads
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map(thread => (
              <Link
                key={thread.id}
                to={`/threads/${thread.id}`}
                className={`block bg-white rounded-lg border hover:border-primary-300 hover:shadow-md transition p-4 ${
                  thread.isPinned ? 'border-l-4 border-l-yellow-400' : ''
                }`}
              >
                {/* Feed Reason Badge */}
                {thread.feedReason && thread.feedReason !== 'community' && (
                  <div className="mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      thread.feedReason === 'your_thread' ? 'bg-primary-100 text-primary-700' :
                      thread.feedReason === 'friend' ? 'bg-blue-100 text-blue-700' :
                      thread.feedReason === 'creator' ? 'bg-purple-100 text-purple-700' :
                      thread.feedReason === 'followed_campground' ? 'bg-green-100 text-green-700' :
                      thread.feedReason === 'upcoming_trip' ? 'bg-orange-100 text-orange-700' :
                      thread.feedReason === 'mentioned' ? 'bg-pink-100 text-pink-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {thread.feedReason === 'your_thread' && '✍️ Your thread'}
                      {thread.feedReason === 'friend' && '👥 From a friend'}
                      {thread.feedReason === 'creator' && '⭐ Creator you follow'}
                      {thread.feedReason === 'followed_campground' && '🏕️ Campground you follow'}
                      {thread.feedReason === 'upcoming_trip' && '📅 Your upcoming trip'}
                      {thread.feedReason === 'mentioned' && '💬 You were mentioned'}
                    </span>
                  </div>
                )}

                <div className="flex gap-4">
                  {/* Author Avatar */}
                  <div className="hidden sm:block">
                    {thread.author.profilePicture ? (
                      <img
                        src={`${thread.author.profilePicture}`}
                        alt=""
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-semibold">
                          {thread.author.firstName[0]}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 hover:text-primary-600 line-clamp-1">
                          {thread.isPinned && <span className="text-yellow-500 mr-1">📌</span>}
                          {thread.isLocked && <span className="text-gray-400 mr-1">🔒</span>}
                          {thread.title}
                        </h3>
                        
                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                          <span>by {thread.author.firstName} {thread.author.lastName}</span>
                          <span>•</span>
                          <span>{formatDate(thread.updatedAt || thread.createdAt)}</span>
                          {thread.campground && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-green-600">
                                <Tent className="w-3 h-3" />
                                {thread.campground.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Favorite Button */}
                      <button
                        onClick={(e) => handleFavorite(thread.id, e)}
                        className={`p-2 rounded-full transition ${
                          thread.isFavorited
                            ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                            : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${thread.isFavorited ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Preview */}
                    {thread.content && (
                      <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                        {thread.content}
                      </p>
                    )}

                    {/* Tags & Stats */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex flex-wrap gap-1">
                        {thread.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 rounded-full text-xs"
                            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          {thread._count.posts}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {thread.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4" />
                          {thread._count.favorites}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : threads.length === 0 ? (
        // Empty state for threads
        <div className="text-center py-12 bg-white rounded-lg border">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No threads yet</h3>
          <p className="text-gray-500 mb-4">
            {activeTab === 'favorites'
              ? "You haven't favorited any threads yet"
              : 'Be the first to start a discussion!'}
          </p>
          {user && activeTab === 'all' && (
            <button
              onClick={() => setShowNewThreadModal(true)}
              className="btn btn-primary"
            >
              Create Thread
            </button>
          )}
        </div>
      ) : (
        // Threads list
        <div className="space-y-3">
          {threads.map(thread => (
            <Link
              key={thread.id}
              to={`/threads/${thread.id}`}
              className={`block bg-white rounded-lg border hover:border-primary-300 hover:shadow-md transition p-4 ${
                thread.isPinned ? 'border-l-4 border-l-yellow-400' : ''
              }`}
            >
              <div className="flex gap-4">
                {/* Author Avatar */}
                <div className="hidden sm:block">
                  {thread.author.profilePicture ? (
                    <img
                      src={`${thread.author.profilePicture}`}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-semibold">
                        {thread.author.firstName[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 hover:text-primary-600 line-clamp-1">
                        {thread.isPinned && <span className="text-yellow-500 mr-1">📌</span>}
                        {thread.isLocked && <span className="text-gray-400 mr-1">🔒</span>}
                        {thread.title}
                      </h3>
                      
                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                        <span>by {thread.author.firstName} {thread.author.lastName}</span>
                        <span>•</span>
                        <span>{formatDate(thread.createdAt)}</span>
                        {thread.campground && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-green-600">
                              <Tent className="w-3 h-3" />
                              {thread.campground.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Favorite Button */}
                    <button
                      onClick={(e) => handleFavorite(thread.id, e)}
                      className={`p-2 rounded-full transition ${
                        thread.isFavorited
                          ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                          : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100'
                      }`}
                    >
                      <Star className={`w-5 h-5 ${thread.isFavorited ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Preview */}
                  {thread.content && (
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                      {thread.content}
                    </p>
                  )}

                  {/* Tags & Stats */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex flex-wrap gap-1">
                      {thread.tags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {thread._count.posts}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {thread.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        {thread._count.favorites}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Thread Modal */}
      {showNewThreadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  New Thread
                </h2>
                <button
                  onClick={() => {
                    setShowNewThreadModal(false);
                    setCampgroundLocked(false);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={newThread.title}
                  onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                  className="input w-full"
                  placeholder="What's on your mind?"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  value={newThread.content}
                  onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
                  className="input w-full"
                  rows={5}
                  placeholder="Share your thoughts, questions, or experiences..."
                />
              </div>

              {/* Link to Campground */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link to Campground {campgroundLocked ? '(locked)' : '(optional)'}
                </label>
                {campgroundLocked ? (
                  <div className="input w-full bg-gray-100 flex items-center gap-2">
                    <Tent className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700">
                      {campgrounds.find(cg => cg.id === newThread.campgroundId)?.name || 'Loading...'}
                    </span>
                  </div>
                ) : (
                  <select
                    value={newThread.campgroundId}
                    onChange={(e) => setNewThread({ ...newThread, campgroundId: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">No campground</option>
                    {campgrounds.map(cg => (
                      <option key={cg.id} value={cg.id}>{cg.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        newThread.tagIds.includes(tag.id)
                          ? 'ring-2 ring-offset-1'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        ringColor: tag.color
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
                {tags.length === 0 && (
                  <p className="text-sm text-gray-500">No tags available yet</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowNewThreadModal(false);
                    setCampgroundLocked(false);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateThread}
                  disabled={creating || !newThread.title.trim()}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Thread'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
