// ============================================
// CREATOR DASHBOARD - Enhanced Analytics & Management
// ============================================

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  FilePlus,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  Users,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Settings,
  UserPlus,
  X,
  Search,
  ShieldCheck,
  Calendar,
  Clock,
  Zap,
  Award,
  ArrowUpRight,
  ArrowRight,
  Flame,
  Play,
  FileText,
  Image,
  ExternalLink,
  Star,
  Globe,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  MoreVertical,
  ChevronDown,
  Share2,
  Copy,
  Coffee,
  ShoppingBag,
  Palette,
  BarChart3 as PollIcon,
  List,
  Clock as StoryIcon,
  Megaphone,
  Trophy,
  Pin,
  Plus,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface CreatorStats {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalReposts: number;
  totalSaves: number;
  followerCount: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  followersThisWeek: number;
  followersThisMonth: number;
  newFollowersLast30Days: number;
  recentContent: ContentItem[];
}

interface ContentItem {
  id: string;
  title?: string;
  contentType: string;
  thumbnailUrl?: string;
  status: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  saveCount?: number;
  publishedAt?: string;
  createdAt: string;
  category?: string;
}

interface Collaborator {
  id: string;
  collaboratorId: string;
  canPost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageCollaborators: boolean;
  collaborator: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

function formatCount(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  VIDEO: <Play className="w-4 h-4" />,
  SHORT: <Play className="w-4 h-4" />,
  BLOG: <FileText className="w-4 h-4" />,
  PHOTO_GALLERY: <Image className="w-4 h-4" />,
  EMBED: <ExternalLink className="w-4 h-4" />,
  GUIDE: <FileText className="w-4 h-4" />,
};

import CreatorActivityQueue from '../components/activity/CreatorActivityQueue';

export default function CreatorDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'audience' | 'collaborators' | 'settings'>('overview');
  const [contentFilter, setContentFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [loading, setLoading] = useState(true);

  // Collaborator state
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [showAddCollaborator, setShowAddCollaborator] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [addingCollaborator, setAddingCollaborator] = useState(false);

  useEffect(() => {
    if (user !== undefined && user !== null && user.isCreator === false) {
      navigate('/basecamp');
      return;
    }
    fetchStats();
    fetchAllContent();
    fetchCollaborators();
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/creators/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllContent = async () => {
    try {
      const response = await api.get(`/creators/content/${user?.id}`);
      setAllContent(response.data);
    } catch (error) {
      console.error('Error fetching content:', error);
    }
  };

  const fetchCollaborators = async () => {
    try {
      const response = await api.get(`/creators/page-collaborators/${user?.id}`);
      setCollaborators(response.data);
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    }
  };

  const searchUsers = async (query: string) => {
    setUserSearch(query);
    if (query.length < 2) { setUserResults([]); return; }
    try {
      const response = await api.get(`/creators/search-users?q=${encodeURIComponent(query)}`);
      setUserResults(response.data);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const addCollaborator = async (collaboratorUsername: string) => {
    setAddingCollaborator(true);
    try {
      await api.post('/creators/page-collaborators', { collaboratorUsername, canPost: true, canEdit: true, canDelete: false, canManageCollaborators: false });
      fetchCollaborators();
      setShowAddCollaborator(false);
      setUserSearch('');
      setUserResults([]);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add collaborator');
    } finally {
      setAddingCollaborator(false);
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    if (!confirm('Remove this collaborator?')) return;
    try {
      await api.delete(`/creators/page-collaborators/${collaboratorId}`);
      fetchCollaborators();
    } catch (error) {
      console.error('Error removing collaborator:', error);
    }
  };

  const updateCollaboratorPermissions = async (collaboratorId: string, permissions: any) => {
    try {
      await api.put(`/creators/page-collaborators/${collaboratorId}`, permissions);
      fetchCollaborators();
    } catch (error) {
      console.error('Error updating permissions:', error);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Delete this content?')) return;
    try {
      await api.delete(`/creators/content/${contentId}`);
      setAllContent(allContent.filter(c => c.id !== contentId));
    } catch (error) {
      console.error('Error deleting content:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredContent = allContent.filter(c => {
    if (contentFilter === 'published') return c.status === 'PUBLISHED';
    if (contentFilter === 'draft') return c.status === 'DRAFT';
    return true;
  });

  const publishedCount = allContent.filter(c => c.status === 'PUBLISHED').length;
  const draftCount = allContent.filter(c => c.status === 'DRAFT').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== HEADER ===== */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rig Content Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage your rig's content, track analytics, and grow your audience</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/creators/${user?.username}`} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition text-sm font-medium">
                View Page
              </Link>
              <Link to="/creator/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition text-sm font-medium shadow-md">
                <FilePlus className="w-4 h-4" /> Create Content
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 -mb-px">
            <nav className="flex gap-1">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'content', label: 'Content', icon: FilePlus, badge: draftCount > 0 ? `${draftCount} drafts` : undefined },
                { id: 'audience', label: 'Audience', icon: Users },
                { id: 'collaborators', label: 'Team', icon: UserPlus },
                { id: 'settings', label: 'Settings', icon: Settings },
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
                  {tab.icon && <tab.icon className="w-4 h-4" />}
                  {tab.label}
                  {tab.badge && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full">{tab.badge}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* ===== CONTENT AREA ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Hitch-extracted activity confirmation queue */}
        {activeTab === 'overview' && <CreatorActivityQueue />}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <OverviewTab stats={stats} allContent={allContent} user={user} />
        )}

        {/* CONTENT TAB */}
        {activeTab === 'content' && (
          <ContentTab content={filteredContent} filter={contentFilter} onFilterChange={setContentFilter} onDelete={handleDeleteContent} allContent={allContent} />
        )}

        {/* AUDIENCE TAB */}
        {activeTab === 'audience' && stats && (
          <AudienceTab stats={stats} creatorId={user?.id || ''} />
        )}

        {/* COLLABORATORS TAB */}
        {activeTab === 'collaborators' && (
          <CollaboratorsTab
            collaborators={collaborators}
            showAdd={showAddCollaborator}
            setShowAdd={setShowAddCollaborator}
            userSearch={userSearch}
            searchUsers={searchUsers}
            userResults={userResults}
            addCollaborator={addCollaborator}
            addingCollaborator={addingCollaborator}
            removeCollaborator={removeCollaborator}
            updatePermissions={updateCollaboratorPermissions}
          />
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

// ===== OVERVIEW TAB =====
function OverviewTab({ stats, allContent, user }: { stats: CreatorStats; allContent: ContentItem[]; user: any }) {
  const [sortBy, setSortBy] = useState<'views' | 'likes' | 'date'>('views');
  const [searchTerm, setSearchTerm] = useState('');

  const sortedContent = [...stats.recentContent]
    .filter(item => !searchTerm || item.title?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'views') return b.viewCount - a.viewCount;
      if (sortBy === 'likes') return b.likeCount - a.likeCount;
      return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
    });

  const engagementRate = stats.totalViews > 0
    ? (((stats.totalLikes + stats.totalComments + stats.totalSaves) / stats.totalViews) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Views', value: stats.totalViews, icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50', trend: stats.viewsThisWeek, trendLabel: 'this week' },
          { label: 'Followers', value: stats.followerCount, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50', trend: stats.newFollowersLast30Days, trendLabel: '30d' },
          { label: 'Likes', value: stats.totalLikes, icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Comments', value: stats.totalComments, icon: MessageCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Saves', value: stats.totalSaves, icon: Bookmark, color: 'text-purple-500', bg: 'bg-purple-50' },
          { label: 'Engagement', value: engagementRate, icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50', suffix: '%' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              {stat.trend !== undefined && stat.trend > 0 && (
                <span className="flex items-center text-emerald-600 text-xs font-medium">
                  <TrendingUp className="w-3 h-3 mr-0.5" />+{stat.trend}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{typeof stat.value === 'number' ? formatCount(stat.value) : stat.value}{stat.suffix || ''}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link to="/creator/new" className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white hover:shadow-lg transition group">
          <FilePlus className="w-8 h-8 mb-3 opacity-80 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-lg">Create New Content</p>
          <p className="text-white/80 text-sm mt-1">Share a video, blog, or photo gallery</p>
        </Link>
        <Link to={`/creators/${user?.username}`} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-200 transition group">
          <Globe className="w-8 h-8 mb-3 text-amber-500 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-lg text-gray-900">View Rig Profile</p>
          <p className="text-gray-500 text-sm mt-1">See how your page looks to visitors</p>
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <Share2 className="w-8 h-8 mb-3 text-blue-500" />
          <p className="font-bold text-lg text-gray-900">Share Your Page</p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-xs bg-gray-50 px-2 py-1.5 rounded-lg text-gray-600 truncate">rvunicorn.com/creators/{user?.username}</code>
            <button
              onClick={() => navigator.clipboard.writeText(`https://www.rvunicorn.com/creators/${user?.username}`)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition"
            >
              <Copy className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Top Performing Content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-gray-900">Top Content</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 w-48"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value="views">By Views</option>
                <option value="likes">By Likes</option>
                <option value="date">By Date</option>
              </select>
            </div>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {sortedContent.slice(0, 10).map((item, index) => (
            <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition">
              <span className={`text-lg font-bold w-6 text-center ${index < 3 ? 'text-amber-500' : 'text-gray-300'}`}>
                {index + 1}
              </span>
              <div className="w-14 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    {CONTENT_TYPE_ICONS[item.contentType] || <FileText className="w-5 h-5" />}
                  </div>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <Link to={`/creator/edit/${item.id}`} className="font-medium text-gray-900 hover:text-amber-600 transition truncate block text-sm">
                  {item.title || 'Untitled'}
                </Link>
                <p className="text-xs text-gray-400">{item.contentType.replace('_', ' ')} {item.publishedAt ? `• ${timeAgo(item.publishedAt)}` : ''}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{formatCount(item.viewCount)}</span>
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{item.likeCount}</span>
                <span className="flex items-center gap-1 hidden sm:flex"><MessageCircle className="w-3.5 h-3.5" />{item.commentCount}</span>
              </div>
            </div>
          ))}
          {sortedContent.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No content yet. Create your first post!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== AUDIENCE TAB =====
function AudienceTab({ stats, creatorId }: { stats: CreatorStats; creatorId: string }) {
  const [recentFollowers, setRecentFollowers] = useState<any[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(true);

  useEffect(() => {
    loadRecentFollowers();
  }, [creatorId]);

  const loadRecentFollowers = async () => {
    try {
      const { data } = await api.get(`/creators/${creatorId}/followers?limit=10`);
      setRecentFollowers(data.followers || []);
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const weeklyGrowthRate = stats.followerCount > 0
    ? ((stats.followersThisWeek / stats.followerCount) * 100).toFixed(1)
    : '0';

  const monthlyGrowthRate = stats.followerCount > 0
    ? ((stats.newFollowersLast30Days / stats.followerCount) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Audience Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><Users className="w-4 h-4 text-emerald-500" /></div>
            <span className="text-sm text-gray-500">Total Followers</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCount(stats.followerCount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="w-4 h-4 text-blue-500" /></div>
            <span className="text-sm text-gray-500">This Week</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">+{stats.followersThisWeek || 0}</p>
          <p className="text-xs text-emerald-600 mt-1">{weeklyGrowthRate}% growth</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-purple-50 rounded-lg"><Calendar className="w-4 h-4 text-purple-500" /></div>
            <span className="text-sm text-gray-500">Last 30 Days</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">+{stats.newFollowersLast30Days || 0}</p>
          <p className="text-xs text-emerald-600 mt-1">{monthlyGrowthRate}% growth</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Eye className="w-4 h-4 text-amber-500" /></div>
            <span className="text-sm text-gray-500">Views/Follower</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {stats.followerCount > 0 ? (stats.totalViews / stats.followerCount).toFixed(1) : '0'}
          </p>
        </div>
      </div>

      {/* Recent Followers */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-500" /> Recent Followers
          </h2>
        </div>
        {loadingFollowers ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : recentFollowers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">No followers yet</p>
            <p className="text-gray-400 text-sm">Share your content to grow your audience!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentFollowers.map((follower) => (
              <Link key={follower.id} to={`/profile/${follower.username}`} className="flex items-center gap-3 p-4 hover:bg-gray-50/50 transition">
                {follower.profilePicture ? (
                  <img src={follower.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm">
                    {(follower.firstName?.[0] || follower.username[0]).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {follower.firstName && follower.lastName ? `${follower.firstName} ${follower.lastName}` : follower.username}
                  </p>
                  <p className="text-xs text-gray-500">@{follower.username}</p>
                </div>
                {follower.isCreator && (
                  <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium">Creator</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Content Performance Insights */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-500" /> Content Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-1">Avg. Views per Post</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.recentContent.length > 0 ? formatCount(Math.round(stats.totalViews / stats.recentContent.length)) : '0'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-1">Avg. Likes per Post</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.recentContent.length > 0 ? Math.round(stats.totalLikes / stats.recentContent.length) : '0'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-1">Avg. Comments per Post</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.recentContent.length > 0 ? Math.round(stats.totalComments / stats.recentContent.length) : '0'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== CONTENT TAB =====
function ContentTab({ content, filter, onFilterChange, onDelete, allContent }: {
  content: ContentItem[];
  filter: 'all' | 'published' | 'draft';
  onFilterChange: (f: 'all' | 'published' | 'draft') => void;
  onDelete: (id: string) => void;
  allContent: ContentItem[];
}) {
  const publishedCount = allContent.filter(c => c.status === 'PUBLISHED').length;
  const draftCount = allContent.filter(c => c.status === 'DRAFT').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          {([
            { id: 'all', label: 'All', count: allContent.length },
            { id: 'published', label: 'Published', count: publishedCount },
            { id: 'draft', label: 'Drafts', count: draftCount },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
                filter === f.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-amber-200'
              }`}
            >
              {f.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === f.id ? 'bg-white/20' : 'bg-gray-100'}`}>{f.count}</span>
            </button>
          ))}
        </div>
        <Link to="/creator/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition text-sm font-medium shadow-md">
          <FilePlus className="w-4 h-4" /> New Content
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {content.length === 0 ? (
          <div className="p-16 text-center">
            <FilePlus className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">No content yet</h3>
            <p className="text-gray-500 mt-1 text-sm">Create your first piece of content to get started</p>
            <Link to="/creator/new" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium">
              <FilePlus className="w-4 h-4" /> Create Content
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {content.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      {CONTENT_TYPE_ICONS[item.contentType] || <FileText className="w-5 h-5" />}
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{item.title || 'Untitled'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{item.contentType.replace('_', ' ')}</span>
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                      item.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {item.status}
                    </span>
                    {item.publishedAt && <span className="text-xs text-gray-400">{timeAgo(item.publishedAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0 hidden sm:flex">
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{formatCount(item.viewCount)}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{item.likeCount}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link to={`/creator/edit/${item.id}`} className="p-2 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition">
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== COLLABORATORS TAB =====
function CollaboratorsTab({ collaborators, showAdd, setShowAdd, userSearch, searchUsers, userResults, addCollaborator, addingCollaborator, removeCollaborator, updatePermissions }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Page Collaborators</h2>
          <p className="text-sm text-gray-500">Invite others to help manage your rig profile</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition">
          <UserPlus className="w-4 h-4" /> Add Collaborator
        </button>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Add Collaborator</h3>
              <button onClick={() => { setShowAdd(false); searchUsers(''); }} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => searchUsers(e.target.value)}
                placeholder="Search by username or name..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>
            {userResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-xl max-h-60 overflow-auto divide-y divide-gray-50">
                {userResults.map((u: any) => (
                  <button key={u.id} onClick={() => addCollaborator(u.username)} disabled={addingCollaborator}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition">
                    {u.profilePicture ? (
                      <img src={u.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">{u.firstName?.[0]}{u.lastName?.[0]}</div>
                    )}
                    <div className="text-left flex-1">
                      <p className="font-medium text-gray-900 text-sm">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-gray-500">@{u.username}</p>
                    </div>
                    {u.isCreator && <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">Creator</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {collaborators.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No collaborators yet</p>
            <p className="text-gray-400 text-sm mt-1">Add collaborators to help manage your rig profile</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {collaborators.map((collab: Collaborator) => (
              <div key={collab.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  {collab.collaborator.profilePicture ? (
                    <img src={collab.collaborator.profilePicture} alt="" className="w-11 h-11 rounded-full object-cover" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
                      {collab.collaborator.firstName?.[0]}{collab.collaborator.lastName?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{collab.collaborator.firstName} {collab.collaborator.lastName}</p>
                    <p className="text-xs text-gray-500">@{collab.collaborator.username}</p>
                  </div>
                  <button onClick={() => removeCollaborator(collab.collaboratorId)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 ml-14">
                  {[
                    { key: 'canPost', label: 'Post', checked: collab.canPost, color: 'emerald' },
                    { key: 'canEdit', label: 'Edit', checked: collab.canEdit, color: 'blue' },
                    { key: 'canDelete', label: 'Delete', checked: collab.canDelete, color: 'orange' },
                    { key: 'canManageCollaborators', label: 'Admin', checked: collab.canManageCollaborators, color: 'purple' },
                  ].map((perm) => (
                    <label key={perm.key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer text-xs font-medium transition ${
                      perm.checked ? `bg-${perm.color}-50 text-${perm.color}-700` : 'bg-gray-50 text-gray-400'
                    }`}>
                      <input
                        type="checkbox"
                        checked={perm.checked}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePermissions(collab.collaboratorId, { [perm.key]: e.target.checked })}
                        className="w-3.5 h-3.5 rounded"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== SETTINGS TAB =====
function SettingsTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [creatorHandle, setCreatorHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/creators/profile/${user?.username}`);
        setBio(data.creatorBio || '');
        setDisplayName(data.creatorDisplayName || '');
        setSpecialties(data.creatorSpecialties || []);
        setCreatorHandle(data.creatorHandle || '');
      } catch (error) {
        console.error('Error loading creator profile:', error);
      } finally {
        setLoading(false);
      }
    };
    if (user?.username) load();
  }, [user?.username]);

  const availableSpecialties = [
    'Full-Time RV', 'Weekend Warrior', 'Gear Reviews', 'Campground Reviews',
    'Travel Vlogs', 'RV Tips & Hacks', 'Boondocking', 'Family Camping', 'Solo Travel', 'Budget Camping',
    'Van Life', 'Truck Camping', 'Off-Grid', 'National Parks', 'Photography',
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/creators/profile', { bio, specialties, displayName, creatorHandle });
      setMessage('Settings saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialty = (s: string) => {
    if (specialties.includes(s)) setSpecialties(specialties.filter(x => x !== s));
    else if (specialties.length < 5) setSpecialties([...specialties, s]);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-900">Creator Settings</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 text-sm"
            placeholder="Your creator display name"
          />
          <p className="mt-1 text-xs text-gray-400">Shown on your rig profile instead of your real name.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Creator Handle</label>
          <div className="flex items-center">
            <span className="px-3 py-2.5 bg-gray-50 border border-r-0 border-gray-200 rounded-l-xl text-gray-400 text-sm">@</span>
            <input
              type="text"
              value={creatorHandle}
              onChange={(e) => setCreatorHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-r-xl focus:ring-2 focus:ring-amber-500 text-sm"
              placeholder="YourCreatorHandle"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Creator Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 text-sm"
            placeholder="Tell your followers about yourself..."
          />
          <p className="mt-1 text-xs text-gray-400">{bio.length}/500 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Specialties (up to 5)</label>
          <div className="flex flex-wrap gap-2">
            {availableSpecialties.map((s) => (
              <button
                key={s}
                onClick={() => toggleSpecialty(s)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
                  specialties.includes(s) ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          {message && (
            <div className={`flex items-center gap-1.5 text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-emerald-600'}`}>
              {message.includes('Failed') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {message}
            </div>
          )}
          <button onClick={handleSave} disabled={saving} className="ml-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium text-sm hover:shadow-lg transition disabled:opacity-50 shadow-md">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Monetization Settings */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Coffee className="w-5 h-5 text-amber-500" /> Monetization
        </h2>
        <MonetizationSettings />
      </div>

      {/* Theme Settings */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-500" /> Page Theme
        </h2>
        <ThemeSettings />
      </div>

      <div className="bg-white rounded-xl border border-red-100 shadow-sm p-6">
        <h3 className="text-sm font-bold text-red-600 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">Disabling creator mode will hide your page. You can re-enable anytime.</p>
        <button className="px-4 py-2 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition text-sm font-medium">
          Disable Creator Mode
        </button>
      </div>
    </div>
  );
}

// ===== MONETIZATION SETTINGS =====
function MonetizationSettings() {
  const [tipJarUrl, setTipJarUrl] = useState('');
  const [tipJarType, setTipJarType] = useState('');
  const [merchUrl, setMerchUrl] = useState('');
  const [merchLabel, setMerchLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/auth/me');
        setTipJarUrl(data.creatorTipJarUrl || '');
        setTipJarType(data.creatorTipJarType || '');
        setMerchUrl(data.creatorMerchUrl || '');
        setMerchLabel(data.creatorMerchLabel || '');
      } catch (e) {}
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/creator-features/monetization', { tipJarUrl, tipJarType, merchUrl, merchLabel });
      setMessage('Saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tip Jar Type</label>
        <select value={tipJarType} onChange={(e) => setTipJarType(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500">
          <option value="">None</option>
          <option value="buymeacoffee">Buy Me a Coffee</option>
          <option value="venmo">Venmo</option>
          <option value="paypal">PayPal</option>
          <option value="cashapp">Cash App</option>
          <option value="other">Other</option>
        </select>
      </div>
      {tipJarType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tip Jar URL</label>
          <input type="url" value={tipJarUrl} onChange={(e) => setTipJarUrl(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
            placeholder="https://buymeacoffee.com/yourname" />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Merch Store URL</label>
        <input type="url" value={merchUrl} onChange={(e) => setMerchUrl(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
          placeholder="https://your-store.com" />
      </div>
      {merchUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Merch Button Label</label>
          <input type="text" value={merchLabel} onChange={(e) => setMerchLabel(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
            placeholder="Shop My Gear" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Monetization'}
        </button>
        {message && <span className={"text-sm " + (message.includes('Failed') ? "text-red-600" : "text-emerald-600")}>{message}</span>}
      </div>
    </div>
  );
}

// ===== THEME SETTINGS =====
function ThemeSettings() {
  const [themeColor, setThemeColor] = useState('#f59e0b');
  const [saving, setSaving] = useState(false);

  const presets = [
    { color: '#f59e0b', label: 'Amber' },
    { color: '#ef4444', label: 'Red' },
    { color: '#3b82f6', label: 'Blue' },
    { color: '#10b981', label: 'Emerald' },
    { color: '#8b5cf6', label: 'Purple' },
    { color: '#ec4899', label: 'Pink' },
    { color: '#f97316', label: 'Orange' },
    { color: '#14b8a6', label: 'Teal' },
    { color: '#1e293b', label: 'Slate' },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/auth/me');
        setThemeColor(data.creatorThemeColor || '#f59e0b');
      } catch (e) {}
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/creator-features/theme', { themeColor });
    } catch (e) {}
    setSaving(false);
  };

  return (

    <div className="space-y-4">
      <p className="text-sm text-gray-500">Choose a color theme for your rig profile</p>
      <div className="flex flex-wrap gap-3">
        {presets.map(p => (
          <button key={p.color} onClick={() => setThemeColor(p.color)}
            className={"w-10 h-10 rounded-xl transition-all " + (themeColor === p.color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105")}
            style={{ backgroundColor: p.color }} title={p.label} />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-500">Custom:</label>
        <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
        <span className="text-sm text-gray-400 font-mono">{themeColor}</span>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Theme'}
      </button>
    </div>
  );
}
