import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  Heart, 
  Bookmark,
  PlayCircle,
  Clock,
  BarChart3,
  Lightbulb,
  ChevronRight,
  Calendar,
  Percent,
  Video,
  Image,
  Target,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardData {
  period: number;
  followers: {
    total: number;
    gained: number;
    previousPeriod: number;
    growthRate: string;
  };
  content: {
    totalVideos: number;
    totalPhotos: number;
    totalViews: number;
    recentVideos: number;
    recentPhotos: number;
  };
  engagement: {
    total: number;
    reactions: number;
    saves: number;
    engagementRate: string;
  };
  videoInsights: {
    totalWatches: number;
    avgCompletionRate: string;
    totalWatchTimeMinutes: number;
    avgWatchTimeSeconds: number;
  };
  audienceBreakdown: {
    followerViews: number;
    nonFollowerViews: number;
    followerRate: string;
  };
  sourceBreakdown: Record<string, number>;
}

interface TopContent {
  id: string;
  type: 'VIDEO' | 'PHOTO';
  title: string;
  thumbnailUrl: string;
  views: number;
  reactions: number;
  saves: number;
  avgCompletion: number | null;
  engagementRate: number;
}

interface Recommendation {
  type: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action?: string;
}

export const CreatorDashboard: React.FC = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [topContent, setTopContent] = useState<TopContent[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'videos' | 'audience'>('overview');

  useEffect(() => {
    fetchDashboard();
  }, [period]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, contentRes, recsRes] = await Promise.all([
        fetch(`/api/analytics/dashboard?period=${period}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/analytics/top-content?limit=5&metric=engagement`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/analytics/recommendations`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (contentRes.ok) {
        const data = await contentRes.json();
        setTopContent(data.content);
      }
      if (recsRes.ok) {
        const data = await recsRes.json();
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Unable to load dashboard</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Creator Dashboard</h1>
              <p className="text-gray-500 mt-1">Track your content performance and grow your audience</p>
            </div>
            
            {/* Period Selector */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['7d', '30d', '90d'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    period === p 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'videos', label: 'Video Insights', icon: PlayCircle },
              { id: 'audience', label: 'Audience', icon: Users }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <OverviewTab 
            dashboard={dashboard} 
            topContent={topContent}
            recommendations={recommendations}
          />
        )}
        {activeTab === 'videos' && (
          <VideoInsightsTab dashboard={dashboard} />
        )}
        {activeTab === 'audience' && (
          <AudienceTab dashboard={dashboard} />
        )}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  dashboard: DashboardData;
  topContent: TopContent[];
  recommendations: Recommendation[];
}> = ({ dashboard, topContent, recommendations }) => {
  const growthIsPositive = parseFloat(dashboard.followers.growthRate) >= 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Followers"
          value={dashboard.followers.total.toLocaleString()}
          change={`${growthIsPositive ? '+' : ''}${dashboard.followers.gained}`}
          changeLabel="this period"
          trend={growthIsPositive ? 'up' : 'down'}
          icon={Users}
        />
        <MetricCard
          title="Total Views"
          value={dashboard.content.totalViews.toLocaleString()}
          icon={Eye}
        />
        <MetricCard
          title="Engagement Rate"
          value={`${dashboard.engagement.engagementRate}%`}
          subtitle={`${dashboard.engagement.total} interactions`}
          icon={Heart}
        />
        <MetricCard
          title="Content Saved"
          value={dashboard.engagement.saves.toLocaleString()}
          icon={Bookmark}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Content */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Top Performing Content</h2>
            <Link to="/analytics/content" className="text-blue-500 text-sm hover:underline flex items-center">
              View All <ChevronRight size={16} />
            </Link>
          </div>

          <div className="space-y-3">
            {topContent.map((content, index) => (
              <Link 
                key={content.id}
                to={`/analytics/${content.type.toLowerCase()}/${content.id}`}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-bold text-gray-300 w-6">#{index + 1}</span>
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {content.thumbnailUrl ? (
                    <img src={content.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {content.type === 'VIDEO' ? <Video size={24} className="text-gray-400" /> : <Image size={24} className="text-gray-400" />}
                    </div>
                  )}
                  {content.type === 'VIDEO' && (
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                      <PlayCircle size={10} className="inline mr-0.5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{content.title}</p>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Eye size={14} /> {content.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart size={14} /> {content.reactions}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark size={14} /> {content.saves}
                    </span>
                    {content.avgCompletion !== null && (
                      <span className="flex items-center gap-1">
                        <Percent size={14} /> {content.avgCompletion.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">{content.engagementRate.toFixed(1)}%</p>
                  <p className="text-xs text-gray-400">engagement</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={20} className="text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Recommendations</h2>
          </div>

          <div className="space-y-4">
            {recommendations.slice(0, 4).map((rec, index) => (
              <div 
                key={index}
                className={`p-3 rounded-lg border-l-4 ${
                  rec.priority === 'HIGH' 
                    ? 'bg-red-50 border-red-400' 
                    : rec.priority === 'MEDIUM'
                      ? 'bg-amber-50 border-amber-400'
                      : 'bg-green-50 border-green-400'
                }`}
              >
                <p className="font-medium text-gray-900 text-sm">{rec.title}</p>
                <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
                {rec.action && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <Zap size={12} /> {rec.action}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">View Sources</h3>
          <div className="space-y-3">
            {Object.entries(dashboard.sourceBreakdown).map(([source, count]) => {
              const total = Object.values(dashboard.sourceBreakdown).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total * 100) : 0;
              return (
                <div key={source} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-24">{formatSource(source)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-16 text-right">{percentage.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Audience Reach</h3>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <span className="text-2xl font-bold text-blue-600">
                  {dashboard.audienceBreakdown.followerRate}%
                </span>
              </div>
              <p className="text-sm text-gray-600">Followers</p>
              <p className="text-xs text-gray-400">{dashboard.audienceBreakdown.followerViews} views</p>
            </div>
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <span className="text-2xl font-bold text-green-600">
                  {(100 - parseFloat(dashboard.audienceBreakdown.followerRate)).toFixed(0)}%
                </span>
              </div>
              <p className="text-sm text-gray-600">New Viewers</p>
              <p className="text-xs text-gray-400">{dashboard.audienceBreakdown.nonFollowerViews} views</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Video Insights Tab
const VideoInsightsTab: React.FC<{ dashboard: DashboardData }> = ({ dashboard }) => {
  return (
    <div className="space-y-6">
      {/* Video Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Video Views"
          value={dashboard.videoInsights.totalWatches.toLocaleString()}
          icon={PlayCircle}
        />
        <MetricCard
          title="Avg. Completion"
          value={`${dashboard.videoInsights.avgCompletionRate}%`}
          subtitle={dashboard.videoInsights.avgCompletionRate >= '70' ? 'Great retention!' : 'Room to improve'}
          icon={Target}
          highlight={parseFloat(dashboard.videoInsights.avgCompletionRate) >= 70}
        />
        <MetricCard
          title="Total Watch Time"
          value={`${dashboard.videoInsights.totalWatchTimeMinutes} min`}
          icon={Clock}
        />
        <MetricCard
          title="Avg. Watch Duration"
          value={`${dashboard.videoInsights.avgWatchTimeSeconds}s`}
          icon={PlayCircle}
        />
      </div>

      {/* Video Performance Insights */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Performance Tips</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-blue-600" />
              <span className="font-medium text-gray-900">Optimal Length</span>
            </div>
            <p className="text-sm text-gray-600">
              Videos under 60 seconds typically see 25% higher completion rates. 
              Your average completion is {dashboard.videoInsights.avgCompletionRate}%.
            </p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} className="text-green-600" />
              <span className="font-medium text-gray-900">First 3 Seconds</span>
            </div>
            <p className="text-sm text-gray-600">
              Hook viewers immediately. Most drop-offs happen in the first 3 seconds 
              if the content doesn't grab attention.
            </p>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={18} className="text-amber-600" />
              <span className="font-medium text-gray-900">Call to Action</span>
            </div>
            <p className="text-sm text-gray-600">
              Videos with a clear CTA at the end see 40% more follows. 
              Invite viewers to follow for more content.
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Video Analytics Link */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Deep Dive into Video Analytics</h3>
            <p className="text-blue-100">
              See drop-off points, completion curves, and viewer behavior for each video
            </p>
          </div>
          <Link 
            to="/analytics/videos"
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            View All Videos
          </Link>
        </div>
      </div>
    </div>
  );
};

// Audience Tab
const AudienceTab: React.FC<{ dashboard: DashboardData }> = ({ dashboard }) => {
  const [audienceData, setAudienceData] = useState<any>(null);

  useEffect(() => {
    fetchAudience();
  }, []);

  const fetchAudience = async () => {
    try {
      const res = await fetch('/api/analytics/audience', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setAudienceData(await res.json());
    } catch (error) {
      console.error('Error fetching audience:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Follower Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Followers"
          value={dashboard.followers.total.toLocaleString()}
          icon={Users}
        />
        <MetricCard
          title="New This Week"
          value={audienceData?.overview?.newFollowers7d || 0}
          icon={TrendingUp}
        />
        <MetricCard
          title="New This Month"
          value={audienceData?.overview?.newFollowers30d || 0}
          icon={Calendar}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Followers */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Followers</h3>
          <div className="space-y-3">
            {audienceData?.recentFollowers?.slice(0, 8).map((follower: any) => (
              <Link 
                key={follower.id}
                to={`/profile/${follower.username}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
              >
                {follower.profilePicture ? (
                  <img src={follower.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                    {follower.firstName?.[0]}{follower.lastName?.[0]}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{follower.firstName} {follower.lastName}</p>
                  <p className="text-sm text-gray-500">@{follower.username}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(follower.followedAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Engaged Followers */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Engaged Followers</h3>
          <p className="text-sm text-gray-500 mb-4">Your biggest supporters who interact with your content the most</p>
          <div className="space-y-3">
            {audienceData?.topEngagedFollowers?.slice(0, 8).map((follower: any, index: number) => (
              <Link 
                key={follower.id}
                to={`/profile/${follower.username}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm font-bold text-gray-300 w-4">#{index + 1}</span>
                {follower.profilePicture ? (
                  <img src={follower.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                    {follower.firstName?.[0]}{follower.lastName?.[0]}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{follower.firstName} {follower.lastName}</p>
                  <p className="text-sm text-gray-500">@{follower.username}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-blue-600">{follower.engagementCount}</span>
                  <p className="text-xs text-gray-400">interactions</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Viewer Insights */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Viewer Insights (Last 30 Days)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">{audienceData?.viewerInsights?.uniqueViewers30d || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Unique Viewers</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{audienceData?.viewerInsights?.followerViewers || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Follower Views</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{audienceData?.viewerInsights?.nonFollowerViewers || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Discovery Views</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeLabel?: string;
  subtitle?: string;
  trend?: 'up' | 'down';
  icon: React.ElementType;
  highlight?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeLabel,
  subtitle,
  trend,
  icon: Icon,
  highlight
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-6 ${highlight ? 'ring-2 ring-green-500' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{title}</span>
        <Icon size={20} className="text-gray-400" />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {change && (
        <div className="flex items-center gap-1 mt-2">
          {trend === 'up' ? (
            <TrendingUp size={16} className="text-green-500" />
          ) : trend === 'down' ? (
            <TrendingDown size={16} className="text-red-500" />
          ) : null}
          <span className={`text-sm ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
            {change} {changeLabel}
          </span>
        </div>
      )}
      {subtitle && (
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
};

// Helper function
function formatSource(source: string): string {
  const labels: Record<string, string> = {
    FEED: 'Feed',
    PROFILE: 'Profile',
    DIRECT: 'Direct',
    SHARE: 'Shared',
    DISCOVERY: 'Discovery'
  };
  return labels[source] || source;
}

export default CreatorDashboard;
