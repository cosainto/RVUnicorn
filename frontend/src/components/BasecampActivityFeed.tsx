import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Trash2, ExternalLink, RefreshCw, ThumbsUp, ThumbsDown, Heart, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ActivityMuteMenu from './ActivityMuteMenu';

interface FeedItem {
  id: string;
  type: string;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  content?: string;
  title?: string;
  targetName?: string;
  targetLink?: string;
  targetUser?: { id: string; firstName: string; lastName: string; username: string };
  secondaryUser?: { id: string; firstName: string; lastName: string; username: string; profileLink: string };
  createdAt: string;
  activityType: string;
  activityIcon: string;
  activityLabel: string;
  activityColor?: string;
  campground?: { id: string; name: string; state?: string };
  imageUrl?: string;
  isFriendActivity?: boolean;
  hasMutualFriendInteraction?: boolean;
  isPackingActivity?: boolean;
  isMealAssignment?: boolean;
  isFriendRequest?: boolean;
  canRespond?: boolean;
  isRead?: boolean;
  metadata?: any;
  replyContent?: string;
  reaction?: string | null;
  userHasLiked?: boolean;
  sourceLikeCount?: number;
}

interface Props {
  maxItems?: number;
  showHeader?: boolean;
}

export default function BasecampActivityFeed({ maxItems = 10, showHeader = true }: Props) {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const { data } = await api.get('/basecamp/campground-feed', { 
        params: { 
          limit: maxItems,
          showFollowed: false,
          showStrangerActivity: true,
          showPublicEvents: true
        } 
      });
      setFeedItems(data.feedItems || []);
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [maxItems]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const refresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const handleVolunteer = async (packItemId: string, willBring: boolean) => {
    try {
      await api.put(`/trip-packing/${packItemId}/volunteer`, { willBring });
      await loadFeed();
    } catch (error) {
      console.error('Failed to volunteer:', error);
    }
  };

  const handleFriendRequest = async (friendshipId: string, accept: boolean) => {
    try {
      if (accept) {
        await api.put(`/friends/accept/${friendshipId}`);
      } else {
        await api.delete(`/friends/${friendshipId}`);
      }
      await loadFeed();
    } catch (error) {
      console.error('Failed to handle friend request:', error);
    }
  };


  const handleMealAssignment = async (mealId: string, status: 'ACCEPTED' | 'DECLINED' | 'UNDECIDED') => {
    try {
      await api.put(`/event-meals/${mealId}/cook-response`, { status });
      await loadFeed();
    } catch (error) {
      console.error('Failed to respond to meal assignment:', error);
    }
  };

  const handleReaction = async (activityId: string, reaction: string | null) => {
    try {
      // Extract the real ID (remove prefix like 'packing-')
      const realId = activityId.replace(/^(activity-|post-|photo-|album-|trip-|event-created-|recipe-created-|packing-)/g, '');
      await api.post(`/basecamp/activity/${realId}/react`, { reaction });

      // Update local state
      setFeedItems(items => items.map(item => 
        item.id === activityId ? { ...item, reaction } : item
      ));
    } catch (error) {
      console.error('Failed to react:', error);
    }
  };

  const handleDismiss = async (activityId: string) => {
    try {
      const realId = activityId.replace(/^(activity-|post-|photo-|album-|trip-|event-created-|recipe-created-|packing-)/g, '');
      await api.delete(`/basecamp/activity/${realId}`);
      setFeedItems(items => items.filter(item => item.id !== activityId));
    } catch (error) {
      console.error('Failed to dismiss:', error);
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
            Discovery Feed
          </h3>
          <button onClick={refresh} disabled={refreshing} className="p-1.5 text-gray-400 hover:text-gray-600" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {feedItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No recent activity from friends</p>
          <p className="text-xs mt-1">When your friends create events, share recipes, or upload photos, you'll see it here!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedItems.map(item => (
            <div key={item.id} className={`p-3 rounded-lg border transition ${!item.isRead ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
              {/* Friend Request */}
              {item.isFriendRequest && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👋</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <Link to={`/profile/${item.actor?.username}`} className="font-semibold hover:underline">
                        {item.actor?.firstName} {item.actor?.lastName}
                      </Link>
                      {' '}wants to be your camping buddy!
                    </p>
                    <span className="text-xs text-gray-500">{formatTime(item.createdAt)}</span>
                  </div>
                  {item.canRespond && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFriendRequest(item.metadata?.friendshipId, true)}
                        className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleFriendRequest(item.metadata?.friendshipId, false)}
                        className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Packing Activity */}
              {item.isPackingActivity && (
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.activityIcon}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{item.content || item.activityLabel}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{formatTime(item.createdAt)}</span>
                      {item.targetLink && (
                        <Link to={item.targetLink} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                  {item.canRespond && (item.type === 'PACK_ITEM_NEEDS_VOLUNTEER' || item.type === 'PACK_ITEM_ASSIGNMENT_REQUEST') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVolunteer(item.metadata?.packItemId, true)}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        I'll bring it
                      </button>
                      <button
                        onClick={() => handleVolunteer(item.metadata?.packItemId, false)}
                        className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Can't
                      </button>
                    </div>
                  )}
                </div>
              )}


              {/* Meal Assignment */}
              {item.isMealAssignment && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👨‍🍳</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{item.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{formatTime(item.createdAt)}</span>
                      {item.targetLink && (
                        <Link to={item.targetLink} className="text-xs text-blue-600 hover:underline">View Event</Link>
                      )}
                    </div>
                  </div>
                  {item.canRespond && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMealAssignment(item.metadata?.mealId, 'ACCEPTED')}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleMealAssignment(item.metadata?.mealId, 'DECLINED')}
                        className="px-2 py-1 text-xs bg-red-400 text-white rounded hover:bg-red-500"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleMealAssignment(item.metadata?.mealId, 'UNDECIDED')}
                        className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Maybe
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Regular Activity */}
              {!item.isFriendRequest && !item.isPackingActivity && !item.isMealAssignment && (
                <div className="flex items-start gap-3">
                  <Link to={`/profile/${item.actor?.username}`} className="flex-shrink-0">
                    {item.actor?.profilePicture ? (
                      <img src={item.actor.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-sm">
                        {item.actor?.firstName?.[0]}{item.actor?.lastName?.[0]}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <Link to={`/profile/${item.actor?.username}`} className="font-semibold hover:underline">
                        {item.actor?.firstName} {item.actor?.lastName}
                      </Link>
                      {' '}
                      <span className={item.activityColor || ''}>{item.activityIcon} {(item.type === 'RECIPE_SHARED' || item.type === 'RECIPE_SHARE_TAG') ? item.content : item.activityLabel}</span>
                      {' '}
                      {item.hasMutualFriendInteraction && item.secondaryUser ? (
                        <>
                          <Link to={item.secondaryUser.profileLink} className="font-semibold hover:underline">
                            {item.secondaryUser.firstName}'s
                          </Link>
                          {' '}wall
                        </>
                      ) : item.targetLink ? (
                        <Link to={item.targetLink} className="font-medium text-blue-600 hover:underline">
                          {item.targetName}
                        </Link>
                      ) : (
                        <span className="font-medium">{item.targetName}</span>
                      )}
                    </p>
                    {/* Show comment preview for recipe/thread comments */}
                    {(item.replyContent || item.metadata?.commentPreview) && (
                      <p className="text-sm text-gray-600 mt-1 italic">"{item.replyContent || item.metadata?.commentPreview}"</p>
                    )}

                    {/* Show tagged users for recipe shares */}
                    {item.type === 'RECIPE_SHARED' && (() => {
                      const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
                      return meta?.taggedUsers && meta.taggedUsers.length > 0 ? (
                        <p className="text-xs text-gray-500 mt-1">
                          Tagged: {meta.taggedUsers.map((u: string) => '@' + u).join(', ')}
                        </p>
                      ) : null;
                    })()}

                    {/* Show photo for PHOTO_UPLOADED */}
                    {item.type === 'PHOTO_UPLOADED' && item.imageUrl && (
                      <Link 
                        to={item.targetLink || '#'} 
                        className="block mt-2 rounded-lg overflow-hidden max-w-xs hover:opacity-90 transition"
                      >
                        <img 
                          src={item.imageUrl} 
                          alt="Uploaded photo" 
                          className="w-full h-auto max-h-48 object-cover rounded-lg border border-gray-200"
                        />
                      </Link>
                    )}

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{formatTime(item.createdAt)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleReaction(item.id, item.reaction === 'like' ? null : 'like')}
                          className={`p-1 rounded transition ${item.reaction === 'like' || item.userHasLiked ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-blue-500'}`}
                          title="Like"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReaction(item.id, item.reaction === 'love' ? null : 'love')}
                          className={`p-1 rounded transition ${item.reaction === 'love' ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500'}`}
                          title="Love"
                        >
                          <Heart className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReaction(item.id, item.reaction === 'dislike' ? null : 'dislike')}
                          className={`p-1 rounded transition ${item.reaction === 'dislike' ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-orange-500'}`}
                          title="Dislike"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDismiss(item.id)}
                          className="p-1 rounded text-gray-400 hover:text-gray-600 transition"
                          title="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <ActivityMuteMenu
                          activityId={item.id}
                          actorId={item.actor?.id}
                          actorName={item.actor?.firstName}
                          eventId={item.type.includes('EVENT') ? item.targetLink?.split('/').pop() : undefined}
                          eventTitle={item.type.includes('EVENT') ? item.targetName : undefined}
                          onDismiss={loadFeed}
                        />
                      </div>
                    </div>
                    {item.imageUrl && (
                      <div className="mt-2">
                        {item.targetLink ? (
                          <Link to={item.targetLink}>
                            <img src={item.imageUrl?.startsWith("/") ? `http://localhost:3001${item.imageUrl}` : item.imageUrl} alt="" className="w-full max-w-xs h-32 object-cover rounded-lg border border-gray-200 hover:opacity-90" />
                          </Link>
                        ) : (
                          <img src={item.imageUrl?.startsWith("/") ? `http://localhost:3001${item.imageUrl}` : item.imageUrl} alt="" className="w-full max-w-xs h-32 object-cover rounded-lg border border-gray-200" />
                        )}
                      </div>
                    )}
                    {item.campground && (
                      <Link to={`/campgrounds/${item.campground.id}`} className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
                        🏕️ {item.campground.name}
                        {item.campground.state && <span className="text-gray-500 text-xs">{item.campground.state}</span>}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
