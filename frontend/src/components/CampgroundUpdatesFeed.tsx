import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Tent, Filter, MapPin, Star, MessageCircle, Camera, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

interface FeedItem {
  id: string;
  type: string;
  actor: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
  };
  content: string | null;
  title: string | null;
  targetName: string;
  targetLink: string;
  createdAt: string;
  activityType: string;
  activityIcon: string;
  activityLabel: string;
  activityColor: string;
  campground?: {
    id: string;
    name: string;
    location: string;
    state: string;
    imageUrl?: string;
  };
  isCampgroundActivity: boolean;
  isFollowedCampground?: boolean;
  isDiscovery?: boolean;
}

interface CampgroundUpdatesFeedProps {
  maxItems?: number;
}

export default function CampgroundUpdatesFeed({ maxItems = 10 }: CampgroundUpdatesFeedProps) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  const [showFollowed, setShowFollowed] = useState(true);
  const [showStrangerActivity, setShowStrangerActivity] = useState(true);
  const [showPublicEvents, setShowPublicEvents] = useState(true);

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: maxItems.toString(),
        showFollowed: showFollowed.toString(),
        showStrangerActivity: showStrangerActivity.toString(),
        showPublicEvents: showPublicEvents.toString(),
      });
      const { data } = await api.get('/basecamp/campground-official-feed?limit=' + maxItems);
      setFeedItems(data.feedItems || []);
    } catch (error) {
      console.error('Failed to load campground feed:', error);
    } finally {
      setLoading(false);
    }
  }, [maxItems, showFollowed, showStrangerActivity, showPublicEvents]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    return date.toLocaleDateString();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'CAMPGROUND_ANNOUNCEMENT': return <Tent className="w-4 h-4 text-amber-600" />;
      case 'CHECK_IN': return <MapPin className="w-4 h-4 text-blue-600" />;
      case 'CAMPGROUND_REVIEW': return <Star className="w-4 h-4 text-yellow-600" />;
      case 'THREAD_POST':
      case 'THREAD_CREATED': return <MessageCircle className="w-4 h-4 text-purple-600" />;
      case 'PHOTO_UPLOADED': return <Camera className="w-4 h-4 text-pink-600" />;
      case 'EVENT_CREATED': return <Calendar className="w-4 h-4 text-indigo-600" />;
      default: return <Tent className="w-4 h-4 text-green-600" />;
    }
  };

  const activeFilterCount = [showFollowed, showStrangerActivity, showPublicEvents].filter(Boolean).length;
  const toggleFilters = () => setShowFilters(!showFilters);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Tent className="w-5 h-5 text-green-600" />
          Campground Updates
        </h3>
        <button
          onClick={toggleFilters}
          className={'flex items-center gap-1 px-2 py-1 text-sm rounded-lg transition ' + (showFilters ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100')}
        >
          <Filter className="w-4 h-4" />
          {activeFilterCount < 3 && <span className="text-xs">({activeFilterCount})</span>}
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
          <p className="text-xs font-medium text-gray-600 mb-2">Show updates from:</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showFollowed}
              onChange={(e) => setShowFollowed(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">🏕️ Followed Campgrounds</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showStrangerActivity}
              onChange={(e) => setShowStrangerActivity(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">🌍 Discover: Public Campground Activity</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPublicEvents}
              onChange={(e) => setShowPublicEvents(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">📅 Public Trip Events</span>
          </label>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : feedItems.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-2">
            {activeFilterCount === 0 
              ? 'Enable at least one filter to see updates.'
              : 'No updates yet. Follow campgrounds to see their activity here!'}
          </p>
          <Link to="/campgrounds" className="text-sm text-primary-600 hover:text-primary-700">
            Browse Campgrounds →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {feedItems.map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition">
              {item.campground?.imageUrl ? (
                <Link to={item.targetLink || '#'} className="flex-shrink-0">
                  <img src={item.campground.imageUrl} alt={item.campground.name} className="w-10 h-10 rounded-lg object-cover" />
                </Link>
              ) : item.actor?.profilePicture ? (
                <Link to={'/profile/' + item.actor.username} className="flex-shrink-0">
                  <img src={item.actor.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                </Link>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {item.actor?.firstName?.[0]}{item.actor?.lastName?.[0]}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <Link to={'/profile/' + item.actor?.username} className="font-semibold hover:underline">
                    {item.actor?.firstName} {item.actor?.lastName}
                  </Link>
                  {' '}
                  <span className="text-gray-600 inline-flex items-center gap-1">
                    {getIcon(item.type)}
                    {item.activityLabel}
                  </span>
                  {' '}
                  {item.targetLink ? (
                    <Link to={item.targetLink} className="font-medium text-primary-600 hover:underline">
                      {item.targetName}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.targetName}</span>
                  )}
                </p>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{formatTime(item.createdAt)}</span>
                  {item.isFollowedCampground && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Following</span>
                  )}
                  {item.isDiscovery && (
                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Discover</span>
                  )}
                  {item.type === 'EVENT_CREATED' && (
                    <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">Trip</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {feedItems.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <Link to="/campgrounds" className="text-sm text-primary-600 hover:text-primary-700">
            Discover More Campgrounds →
          </Link>
        </div>
      )}
    </div>
  );
}
