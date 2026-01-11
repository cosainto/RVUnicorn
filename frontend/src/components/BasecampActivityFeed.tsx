import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Activity {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  entityName: string;
  message: string;
  icon: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profileImage?: string;
  };
}

interface Props {
  maxItems?: number;
  showHeader?: boolean;
}

export default function BasecampActivityFeed({ maxItems = 10, showHeader = true }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActivities = useCallback(async () => {
    try {
      const { data } = await api.get('/basecamp-activity', { params: { limit: maxItems } });
      setActivities(data.activities || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [maxItems]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const markAsRead = async (activityId: string) => {
    try {
      await api.put(`/basecamp-activity/${activityId}/read`);
      setActivities(prev => prev.map(a => (a.id === activityId ? { ...a, isRead: true } : a)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/basecamp-activity/read-all');
      setActivities(prev => prev.map(a => ({ ...a, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteActivity = async (activityId: string) => {
    try {
      await api.delete(`/basecamp-activity/${activityId}`);
      setActivities(prev => prev.filter(a => a.id !== activityId));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    loadActivities();
  };

  const handleVolunteer = async (activityId: string, packItemId: string, willBring: boolean) => {
    try {
      await api.put(`/trip-packing/${packItemId}/volunteer`, { willBring });
      await markAsRead(activityId);
      await loadActivities();
    } catch (error) {
      console.error('Failed to volunteer:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Activity
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={refresh} disabled={refreshing} className="p-1.5 text-gray-400 hover:text-gray-600" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-700">Mark all read</button>
            )}
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map(activity => (
            <div key={activity.id} className={`p-3 rounded-lg border transition ${activity.isRead ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{activity.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{formatTime(activity.createdAt)}</span>
                    {activity.link && (
                      <Link to={activity.link} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(activity.type === 'PACK_ITEM_NEEDS_VOLUNTEER' || activity.type === 'PACK_ITEM_ASSIGNMENT_REQUEST') && !activity.isRead && (
                    <div className="flex gap-1 mr-2">
                      <button
                        onClick={() => handleVolunteer(activity.id, (activity.metadata as any)?.packItemId, true)}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Yes, I'll bring it
                      </button>
                      <button
                        onClick={() => handleVolunteer(activity.id, (activity.metadata as any)?.packItemId, false)}
                        className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        No
                      </button>
                    </div>
                  )}
                  {!activity.isRead && activity.type !== 'PACK_ITEM_NEEDS_VOLUNTEER' && (
                    <button onClick={() => markAsRead(activity.id)} className="p-1 text-gray-400 hover:text-green-600" title="Mark as read">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deleteActivity(activity.id)} className="p-1 text-gray-400 hover:text-red-500" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
