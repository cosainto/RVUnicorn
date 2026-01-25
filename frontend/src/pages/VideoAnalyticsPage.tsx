import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  PlayCircle,
  Eye,
  Heart,
  Bookmark,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart2,
  PieChart,
  Monitor,
  Smartphone,
  Tablet
} from 'lucide-react';

interface VideoAnalytics {
  video: {
    id: string;
    title: string;
    duration: number;
    thumbnailUrl: string;
    createdAt: string;
    visibility: string;
  };
  overview: {
    totalViews: number;
    uniqueViewers: number;
    totalWatchTimeMinutes: number;
    avgWatchTimeSeconds: number;
    avgCompletionRate: string;
    totalReactions: number;
    totalSaves: number;
  };
  watchBehavior: {
    completionDistribution: {
      '0-25%': number;
      '25-50%': number;
      '50-75%': number;
      '75-100%': number;
    };
    dropOffAnalysis: {
      points: Record<string, number>;
      biggestDropOff: { second: number; count: number };
      insight: string | null;
    };
    rewatchRate: string;
  };
  audience: {
    followerViews: number;
    nonFollowerViews: number;
    followerCompletionRate: string;
    nonFollowerCompletionRate: string;
    insight: string | null;
  };
  discovery: {
    sources: Record<string, number>;
    topSource: string;
    devices: Record<string, number>;
  };
  engagement: {
    reactions: Record<string, number>;
    totalReactions: number;
    saves: number;
    taggedUsers: number;
    engagementRate: string;
  };
  trends: {
    dailyViews: Record<string, number>;
    peakDay: string | null;
  };
}

export const VideoAnalyticsPage: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [analytics, setAnalytics] = useState<VideoAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, [videoId]);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/analytics/video/${videoId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!res.ok) {
        throw new Error('Failed to load analytics');
      }

      setAnalytics(await res.json());
    } catch (err: any) {
      setError(err.message);
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

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Unable to load analytics'}</p>
          <Link to="/analytics" className="text-blue-500 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const { video, overview, watchBehavior, audience, discovery, engagement, trends } = analytics;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link 
            to="/analytics" 
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </Link>
          
          <div className="flex items-start gap-4">
            <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              {video.thumbnailUrl ? (
                <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PlayCircle size={32} className="text-gray-400" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{video.title}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(video.createdAt).toLocaleDateString()} • {video.duration}s • {video.visibility}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard icon={Eye} label="Views" value={overview.totalViews} />
          <StatCard icon={Users} label="Unique Viewers" value={overview.uniqueViewers} />
          <StatCard icon={Clock} label="Watch Time" value={`${overview.totalWatchTimeMinutes}m`} />
          <StatCard icon={PlayCircle} label="Avg. Duration" value={`${overview.avgWatchTimeSeconds}s`} />
          <StatCard icon={Heart} label="Reactions" value={overview.totalReactions} />
          <StatCard icon={Bookmark} label="Saves" value={overview.totalSaves} />
        </div>

        {/* Completion Rate - Hero Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Average Completion Rate</h2>
          
          <div className="flex items-center gap-8">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke={parseFloat(overview.avgCompletionRate) >= 70 ? '#22c55e' : parseFloat(overview.avgCompletionRate) >= 50 ? '#eab308' : '#ef4444'}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${parseFloat(overview.avgCompletionRate) * 3.52} 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{overview.avgCompletionRate}%</span>
              </div>
            </div>

            <div className="flex-1">
              <div className={`flex items-center gap-2 mb-2 ${
                parseFloat(overview.avgCompletionRate) >= 70 ? 'text-green-600' : 
                parseFloat(overview.avgCompletionRate) >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {parseFloat(overview.avgCompletionRate) >= 70 ? (
                  <>
                    <CheckCircle size={20} />
                    <span className="font-medium">Excellent retention!</span>
                  </>
                ) : parseFloat(overview.avgCompletionRate) >= 50 ? (
                  <>
                    <TrendingUp size={20} />
                    <span className="font-medium">Good retention</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={20} />
                    <span className="font-medium">Room for improvement</span>
                  </>
                )}
              </div>
              
              <p className="text-sm text-gray-600">
                {parseFloat(overview.avgCompletionRate) >= 70 
                  ? "Most viewers watch your video through to the end. Keep up the great content!"
                  : parseFloat(overview.avgCompletionRate) >= 50
                    ? "Viewers are engaged but some drop off. Consider a stronger hook or shorter format."
                    : "Many viewers leave early. Try hooking them in the first 3 seconds."}
              </p>
            </div>
          </div>
        </div>

        {/* Drop-off Analysis - THE KEY INSIGHT */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Where Viewers Drop Off</h2>
          <p className="text-sm text-gray-500 mb-4">Understand exactly when viewers stop watching</p>

          {/* Drop-off Timeline */}
          <div className="relative mb-6">
            <div className="h-24 bg-gray-50 rounded-lg relative overflow-hidden">
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(pct => (
                <div 
                  key={pct}
                  className="absolute top-0 bottom-0 border-l border-gray-200"
                  style={{ left: `${pct}%` }}
                />
              ))}
              
              {/* Drop-off bars */}
              {Object.entries(watchBehavior.dropOffAnalysis.points).map(([second, count]) => {
                const position = video.duration > 0 ? (parseInt(second) / video.duration) * 100 : 0;
                const maxDropoff = Math.max(...Object.values(watchBehavior.dropOffAnalysis.points));
                const height = maxDropoff > 0 ? (count / maxDropoff) * 100 : 0;
                const isMax = parseInt(second) === watchBehavior.dropOffAnalysis.biggestDropOff.second;
                
                return (
                  <div
                    key={second}
                    className={`absolute bottom-0 w-2 rounded-t ${isMax ? 'bg-red-500' : 'bg-blue-400'}`}
                    style={{ 
                      left: `${position}%`, 
                      height: `${height}%`,
                      transform: 'translateX(-50%)'
                    }}
                    title={`${count} viewers stopped at ${second}s`}
                  />
                );
              })}
            </div>
            
            {/* Time labels */}
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>0s</span>
              <span>{Math.round(video.duration * 0.25)}s</span>
              <span>{Math.round(video.duration * 0.5)}s</span>
              <span>{Math.round(video.duration * 0.75)}s</span>
              <span>{video.duration}s</span>
            </div>
          </div>

          {/* Drop-off Insight */}
          {watchBehavior.dropOffAnalysis.insight && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Biggest Drop-off Point</p>
                  <p className="text-sm text-red-700 mt-1">{watchBehavior.dropOffAnalysis.insight}</p>
                  <p className="text-sm text-red-600 mt-2">
                    💡 Tip: Review what happens at this timestamp. Is there a slow moment? 
                    Consider adding a visual hook or cutting content here.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rewatch Rate */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              <span className="font-medium text-green-800">Rewatch Rate: {watchBehavior.rewatchRate}%</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              {parseFloat(watchBehavior.rewatchRate) > 10 
                ? "High rewatch rate! Viewers find your content worth watching again."
                : "Consider adding moments that make viewers want to rewatch."}
            </p>
          </div>
        </div>

        {/* Completion Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Completion Distribution</h2>
          <p className="text-sm text-gray-500 mb-4">How much of your video do viewers watch?</p>

          <div className="space-y-4">
            {Object.entries(watchBehavior.completionDistribution).map(([range, count]) => {
              const total = Object.values(watchBehavior.completionDistribution).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const colors = {
                '0-25%': 'bg-red-400',
                '25-50%': 'bg-orange-400',
                '50-75%': 'bg-yellow-400',
                '75-100%': 'bg-green-400'
              };
              
              return (
                <div key={range} className="flex items-center gap-4">
                  <span className="w-20 text-sm text-gray-600">{range}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                    <div 
                      className={`${colors[range as keyof typeof colors]} h-6 rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium">
                      {count} viewers ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audience Comparison */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Follower vs Non-Follower</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{audience.followerViews}</p>
                <p className="text-sm text-gray-600">Follower Views</p>
                <p className="text-xs text-blue-600 mt-1">{audience.followerCompletionRate}% completion</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{audience.nonFollowerViews}</p>
                <p className="text-sm text-gray-600">Non-Follower Views</p>
                <p className="text-xs text-green-600 mt-1">{audience.nonFollowerCompletionRate}% completion</p>
              </div>
            </div>

            {audience.insight && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                💡 {audience.insight}
              </div>
            )}
          </div>

          {/* Source & Device Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">How Viewers Found This</h2>
            
            <div className="space-y-3 mb-6">
              {Object.entries(discovery.sources).map(([source, count]) => {
                const total = Object.values(discovery.sources).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={source} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-20">{formatSource(source)}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm text-gray-500 w-12 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>

            <h3 className="text-sm font-medium text-gray-900 mb-3">Devices</h3>
            <div className="flex gap-4">
              {Object.entries(discovery.devices).map(([device, count]) => {
                const icons = { MOBILE: Smartphone, DESKTOP: Monitor, TABLET: Tablet };
                const Icon = icons[device as keyof typeof icons] || Monitor;
                return (
                  <div key={device} className="flex items-center gap-2 text-sm text-gray-600">
                    <Icon size={16} />
                    <span>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Engagement Breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Breakdown</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(engagement.reactions).map(([type, count]) => {
              const emojis: Record<string, string> = {
                LIKE: '👍', HEART: '❤️', FIRE: '🔥', LAUGH: '😂', CLAP: '👏'
              };
              return (
                <div key={type} className="text-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-2xl">{emojis[type] || '👍'}</span>
                  <p className="text-xl font-bold text-gray-900 mt-1">{count}</p>
                  <p className="text-xs text-gray-500">{type.toLowerCase()}</p>
                </div>
              );
            })}
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <Bookmark size={24} className="mx-auto text-amber-600" />
              <p className="text-xl font-bold text-gray-900 mt-1">{engagement.saves}</p>
              <p className="text-xs text-gray-500">saves</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Engagement Rate: {engagement.engagementRate}%</strong>
              <span className="ml-2 text-blue-600">
                ({engagement.totalReactions + engagement.saves} interactions / {overview.totalViews} views)
              </span>
            </p>
          </div>
        </div>

        {/* Daily Views Trend */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Views Over Time</h2>
          
          <div className="h-48 flex items-end gap-1">
            {Object.entries(trends.dailyViews).map(([date, views]) => {
              const maxViews = Math.max(...Object.values(trends.dailyViews));
              const height = maxViews > 0 ? (views / maxViews) * 100 : 0;
              const isPeak = date === trends.peakDay;
              
              return (
                <div key={date} className="flex-1 flex flex-col items-center">
                  <div 
                    className={`w-full rounded-t transition-all ${isPeak ? 'bg-green-500' : 'bg-blue-400'}`}
                    style={{ height: `${height}%`, minHeight: views > 0 ? '4px' : '0' }}
                    title={`${date}: ${views} views`}
                  />
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{Object.keys(trends.dailyViews)[0]}</span>
            <span>{Object.keys(trends.dailyViews).slice(-1)[0]}</span>
          </div>

          {trends.peakDay && (
            <p className="text-sm text-gray-600 mt-4">
              📈 Peak day: <strong>{trends.peakDay}</strong> with {trends.dailyViews[trends.peakDay]} views
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number | string;
}> = ({ icon: Icon, label, value }) => (
  <div className="bg-white rounded-lg shadow-sm p-4 text-center">
    <Icon size={20} className="mx-auto text-gray-400 mb-2" />
    <p className="text-xl font-bold text-gray-900">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
);

// Helper
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

export default VideoAnalyticsPage;
