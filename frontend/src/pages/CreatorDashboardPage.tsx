// ============================================
// CREATOR DASHBOARD - Analytics & Management
// Save as: frontend/src/pages/CreatorDashboardPage.tsx
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
  Shield,
  ShieldCheck,
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
  publishedAt?: string;
  createdAt: string;
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

export default function CreatorDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'collaborators' | 'settings'>('overview');
  const [contentFilter, setContentFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [loading, setLoading] = useState(true);
  
  // Collaborator state
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [showAddCollaborator, setShowAddCollaborator] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [addingCollaborator, setAddingCollaborator] = useState(false);

  useEffect(() => {
    if (user && !user.isCreator) {
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
    if (query.length < 2) {
      setUserResults([]);
      return;
    }
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
      await api.post('/creators/page-collaborators', {
        collaboratorUsername,
        canPost: true,
        canEdit: true,
        canDelete: false,
        canManageCollaborators: false,
      });
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
    if (!confirm('Are you sure you want to remove this collaborator?')) return;
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
    if (!confirm('Are you sure you want to delete this content?')) return;
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const filteredContent = allContent.filter(c => {
    if (contentFilter === 'published') return c.status === 'PUBLISHED';
    if (contentFilter === 'draft') return c.status === 'DRAFT';
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Creator Dashboard</h1>
              <p className="text-gray-500">Manage your content and track performance</p>
            </div>
            <div className="flex gap-3">
              <Link
                to={`/creators/${user?.username}`}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                View My Page
              </Link>
              <Link
                to="/creator/new"
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <FilePlus className="w-5 h-5" />
                Create Content
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="flex gap-8">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'content', label: 'Content', icon: FilePlus },
                { id: 'collaborators', label: 'Collaborators', icon: Users },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && stats && (
          <OverviewTab stats={stats} />
        )}

        {activeTab === 'content' && (
          <ContentTab
            content={filteredContent}
            filter={contentFilter}
            onFilterChange={setContentFilter}
            onDelete={handleDeleteContent}
          />
        )}

        {activeTab === 'collaborators' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Page Collaborators</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Invite others to help manage your creator page
                </p>
              </div>
              <button
                onClick={() => setShowAddCollaborator(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <UserPlus className="w-5 h-5" />
                Add Collaborator
              </button>
            </div>

            {/* Add Collaborator Modal */}
            {showAddCollaborator && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Add Collaborator</h3>
                    <button
                      onClick={() => {
                        setShowAddCollaborator(false);
                        setUserSearch('');
                        setUserResults([]);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => searchUsers(e.target.value)}
                      placeholder="Search by username or name..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {userResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-auto">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => addCollaborator(u.username)}
                          disabled={addingCollaborator}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-0"
                        >
                          {u.profilePicture ? (
                            <img
                              src={`http://127.0.0.1:3001${u.profilePicture}`}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-primary-600 font-medium">
                                {u.firstName?.[0]}{u.lastName?.[0]}
                              </span>
                            </div>
                          )}
                          <div className="text-left">
                            <p className="font-medium text-gray-900">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-sm text-gray-500">@{u.username}</p>
                          </div>
                          {u.isCreator && (
                            <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              Creator
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Collaborators List */}
            {collaborators.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No collaborators yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add collaborators to help manage your creator page
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {collaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {collab.collaborator.profilePicture ? (
                        <img
                          src={`http://127.0.0.1:3001${collab.collaborator.profilePicture}`}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-medium text-lg">
                            {collab.collaborator.firstName?.[0]}{collab.collaborator.lastName?.[0]}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {collab.collaborator.firstName} {collab.collaborator.lastName}
                        </p>
                        <p className="text-sm text-gray-500">@{collab.collaborator.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Permission toggles */}
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={collab.canPost}
                            onChange={(e) => updateCollaboratorPermissions(collab.collaboratorId, { canPost: e.target.checked })}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Can Post</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={collab.canEdit}
                            onChange={(e) => updateCollaboratorPermissions(collab.collaboratorId, { canEdit: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Can Edit</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={collab.canDelete}
                            onChange={(e) => updateCollaboratorPermissions(collab.collaboratorId, { canDelete: e.target.checked })}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">Can Delete</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={collab.canManageCollaborators}
                            onChange={(e) => updateCollaboratorPermissions(collab.collaboratorId, { canManageCollaborators: e.target.checked })}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Admin
                          </span>
                        </label>
                      </div>

                      <button
                        onClick={() => removeCollaborator(collab.collaboratorId)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove collaborator"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsTab />
        )}
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ stats }: { stats: CreatorStats }) {
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<'views' | 'likes' | 'date'>('views');
  const [searchTerm, setSearchTerm] = useState('');

  const sortedContent = [...stats.recentContent]
    .filter(item => !searchTerm || item.title?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'views') return b.viewCount - a.viewCount;
      if (sortBy === 'likes') return b.likeCount - a.likeCount;
      return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
    });

  const displayedContent = showAll ? sortedContent : sortedContent.slice(0, 10);

  // Calculate averages for trending indicators
  const avgViews = stats.recentContent.length > 0 ? stats.totalViews / stats.recentContent.length : 0;
  const avgLikes = stats.recentContent.length > 0 ? stats.totalLikes / stats.recentContent.length : 0;

  const getTrendIndicator = (value: number, avg: number) => {
    if (avg === 0) return { direction: 'neutral', percent: 0 };
    const percent = Math.round(((value - avg) / avg) * 100);
    return {
      direction: percent > 10 ? 'up' : percent < -10 ? 'down' : 'neutral',
      percent: Math.abs(percent)
    };
  };

  const statCards = [
    { label: 'Total Views', value: stats.totalViews, icon: Eye, trend: stats.viewsThisWeek, trendLabel: 'this week' },
    { label: 'Total Likes', value: stats.totalLikes, icon: Heart, color: 'text-red-500' },
    { label: 'Comments', value: stats.totalComments, icon: MessageCircle, color: 'text-blue-500' },
    { label: 'Saves', value: stats.totalSaves, icon: Bookmark, color: 'text-purple-500' },
    { label: 'Followers', value: stats.followerCount, icon: Users, trend: stats.newFollowersLast30Days, trendLabel: 'last 30 days', color: 'text-green-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <stat.icon className={`w-8 h-8 ${stat.color || 'text-gray-400'}`} />
              {stat.trend !== undefined && stat.trend > 0 && (
                <div className="flex items-center text-green-600 text-sm">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +{stat.trend}
                </div>
              )}
            </div>
            <p className="mt-4 text-3xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Top Performing Content */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Top Performing Content</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search videos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'views' | 'likes' | 'date')}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="views">Sort by Views</option>
              <option value="likes">Sort by Likes</option>
              <option value="date">Sort by Date</option>
            </select>
          </div>
        </div>
        <div className="space-y-4">
          {displayedContent.map((item, index) => (
            <div key={item.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg">
              <span className="text-2xl font-bold text-gray-300 w-8">#{index + 1}</span>
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt="" className="w-16 h-12 object-cover rounded" />
              ) : (
                <div className="w-16 h-12 bg-gray-100 rounded flex items-center justify-center">
                  <FilePlus className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div className="flex-grow">
                <Link to={`/creator/edit/${item.id}`} className="font-medium text-gray-900 hover:text-primary-600">
                  {item.title || 'Untitled'}
                </Link>
                <p className="text-sm text-gray-500">{item.contentType}</p>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />{item.viewCount.toLocaleString()}
                  {(() => {
                    const trend = getTrendIndicator(item.viewCount, avgViews);
                    if (trend.direction === 'up') return <span className="ml-1 text-green-500 text-xs flex items-center"><TrendingUp className="w-3 h-3" />+{trend.percent}%</span>;
                    if (trend.direction === 'down') return <span className="ml-1 text-red-500 text-xs flex items-center"><TrendingDown className="w-3 h-3" />-{trend.percent}%</span>;
                    return null;
                  })()}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />{item.likeCount}
                  {(() => {
                    const trend = getTrendIndicator(item.likeCount, avgLikes);
                    if (trend.direction === 'up') return <span className="ml-1 text-green-500 text-xs flex items-center"><TrendingUp className="w-3 h-3" />+{trend.percent}%</span>;
                    if (trend.direction === 'down') return <span className="ml-1 text-red-500 text-xs flex items-center"><TrendingDown className="w-3 h-3" />-{trend.percent}%</span>;
                    return null;
                  })()}
                </span>
                <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" />{item.commentCount}</span>
              </div>
            </div>
          ))}
        </div>
        {sortedContent.length > 10 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-4 w-full py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {showAll ? 'Show Less' : `View All ${sortedContent.length} Videos`}
          </button>
        )}
      </div>
    </div>
  );
}

// Content Tab Component
function ContentTab({ content, filter, onFilterChange, onDelete }: {
  content: ContentItem[];
  filter: 'all' | 'published' | 'draft';
  onFilterChange: (f: 'all' | 'published' | 'draft') => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'published', 'draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <Link
          to="/creator/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <FilePlus className="w-5 h-5" />
          New Content
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {content.length === 0 ? (
          <div className="p-12 text-center">
            <FilePlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No content yet</h3>
            <p className="text-gray-500 mt-1">Create your first piece of content to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Content</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Performance</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {content.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-8 bg-gray-100 rounded" />
                      )}
                      <span className="font-medium text-gray-900">{item.title || 'Untitled'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.contentType.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      item.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{item.viewCount}</span>
                      <span className="flex items-center gap-1"><Heart className="w-4 h-4" />{item.likeCount}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link to={`/creator/edit/${item.id}`} className="p-2 text-gray-400 hover:text-primary-600">
                        <Edit className="w-5 h-5" />
                      </Link>
                      <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Settings Tab Component
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
    const loadCreatorProfile = async () => {
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
    if (user?.username) loadCreatorProfile();
  }, [user?.username]);
  const availableSpecialties = [
    'Full-Time RV', 'Weekend Warrior', 'Gear Reviews', 'Campground Reviews',
    'Travel Vlogs', 'RV Tips & Hacks', 'Boondocking', 'Family Camping', 'Solo Travel', 'Budget Camping',
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
    if (specialties.includes(s)) {
      setSpecialties(specialties.filter(x => x !== s));
    } else if (specialties.length < 5) {
      setSpecialties([...specialties, s]);
    }
  };


  if (loading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading settings...</p>
      </div>
    );
  }
    return (
    <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Creator Settings</h2>


        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Your creator display name (leave empty to use your real name)"
          />
          <p className="mt-1 text-xs text-gray-500">This name will be shown on your creator page instead of your real name.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Creator Handle</label>
          <div className="flex items-center">
            <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500">@</span>
            <input
              type="text"
              value={creatorHandle}
              onChange={(e) => setCreatorHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-primary-500"
              placeholder="YourCreatorHandle"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Leave empty to use your profile handle (@{user?.username}). Or enter a custom handle.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Creator Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Tell your followers about yourself..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Specialties (select up to 5)</label>
          <div className="flex flex-wrap gap-2">
            {availableSpecialties.map((s) => (
              <button
                key={s}
                onClick={() => toggleSpecialty(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  specialties.includes(s) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          {message && <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="pt-6 border-t">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Disable Creator Mode</h3>
          <p className="text-sm text-gray-500 mb-4">
            Disabling creator mode will hide your creator page. You can re-enable it at any time.
          </p>
          <button className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50">
            Disable Creator Mode
          </button>
        </div>
      </div>
    </div>
  );
}
