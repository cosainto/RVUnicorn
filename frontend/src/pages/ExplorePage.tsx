import { useState, useEffect } from 'react';
import { Heart, MapPin, Calendar, Users, UserPlus, UserMinus, Globe, Eye, Bookmark, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface WishListItem {
  id: string;
  state: string;
  campgroundName: string;
  imageUrl?: string;
  targetDate?: string;
  notes?: string;
  isCompleted: boolean;
  isPublic: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  activities: {
    id: string;
    name: string;
    imageUrl?: string;
  }[];
  _count?: {
    activities: number;
  };
}

interface Following {
  following: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
    _count: {
      wishListItems: number;
    };
  };
}

export default function ExplorePage() {
  const { user } = useAuth();
  const [view, setView] = useState<'explore' | 'following'>('explore');
  const [wishLists, setWishLists] = useState<WishListItem[]>([]);
  const [followingList, setFollowingList] = useState<Following[]>([]);
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<WishListItem | null>(null);
  const [includeActivities, setIncludeActivities] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFollowing();
    if (view === 'explore') {
      loadExplore();
    } else {
      loadFeed();
    }
  }, [view]);

  const loadExplore = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/wishlist/explore');
      setWishLists(data);
    } catch (error) {
      console.error('Load explore error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeed = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/wishlist/feed');
      setWishLists(data);
    } catch (error) {
      console.error('Load feed error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowing = async () => {
    try {
      const { data } = await api.get('/wishlist/following');
      setFollowingList(data);
      setFollowedUsers(new Set(data.map((f: Following) => f.following.id)));
    } catch (error) {
      console.error('Load following error:', error);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      await api.post(`/wishlist/follow/${userId}`);
      setFollowedUsers(prev => new Set([...prev, userId]));
      loadFollowing();
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  const handleUnfollow = async (userId: string) => {
    try {
      await api.delete(`/wishlist/follow/${userId}`);
      setFollowedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      loadFollowing();
      if (view === 'following') {
        loadFeed();
      }
    } catch (error) {
      console.error('Unfollow error:', error);
    }
  };

  const handleOpenSaveModal = (item: WishListItem) => {
    setSelectedDestination(item);
    setIncludeActivities(item.activities.length > 0);
    setShowSaveModal(true);
  };

  const handleSaveDestination = async () => {
    if (!selectedDestination) return;

    try {
      setSaving(true);
      await api.post(`/wishlist/save-destination/${selectedDestination.id}`, {
        includeActivities
      });
      alert(`✅ Saved "${selectedDestination.campgroundName}" to your bucket list!`);
      setShowSaveModal(false);
      setSelectedDestination(null);
    } catch (error) {
      console.error('Save destination error:', error);
      alert('Failed to save destination');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveActivity = async (activityId: string, activityName: string) => {
    try {
      await api.post(`/wishlist/save-activity/${activityId}`);
      alert(`✅ Saved "${activityName}" to your bucket list!`);
    } catch (error) {
      console.error('Save activity error:', error);
      alert('Failed to save activity');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (

    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-3 rounded-xl shadow-lg">
            <Globe className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Explore Bucket Lists</h1>
            <p className="text-gray-600">Discover amazing camping destinations! 🌍</p>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('explore')}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold transition ${
            view === 'explore'
              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
              : 'bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200'
          }`}
        >
          <Globe className="w-5 h-5 inline mr-2" />
          Explore All
        </button>
        <button
          onClick={() => setView('following')}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold transition ${
            view === 'following'
              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
              : 'bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200'
          }`}
        >
          <Users className="w-5 h-5 inline mr-2" />
          Following ({followingList.length})
        </button>
      </div>

      {/* Following List Sidebar */}
      {view === 'following' && followingList.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="font-bold text-lg mb-4">People You Follow</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {followingList.map(({ following }) => (
              <div key={following.id} className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 mx-auto mb-2 flex items-center justify-center">
                  {following.profilePicture ? (
                    <img
                      src={following.profilePicture}
                      alt={following.firstName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-xl font-bold">
                      {following.firstName[0]}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-sm text-gray-900">
                  {following.firstName} {following.lastName}
                </p>
                <p className="text-xs text-gray-500">
                  {following._count.wishListItems} destinations
                </p>
                <button
                  onClick={() => handleUnfollow(following.id)}
                  className="mt-2 text-xs text-red-600 hover:text-red-700"
                >
                  Unfollow
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wish Lists Grid */}
      {wishLists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishLists.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition group"
            >
              {/* Image */}
              <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.campgroundName}
                    className="w-full h-full object-cover group-hover:scale-110 transition"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Heart className="w-16 h-16 text-pink-300" />
                  </div>
                )}
                {item.isCompleted && (
                  <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
                    ✓ Completed
                  </div>
                )}
                
                {/* Save Button Overlay */}
                <button
                  onClick={() => handleOpenSaveModal(item)}
                  className="absolute top-3 left-3 bg-white text-primary-600 px-3 py-2 rounded-full font-semibold shadow-lg hover:bg-primary-600 hover:text-white transition flex items-center gap-1"
                >
                  <Bookmark className="w-4 h-4" />
                  Save
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {/* User Info */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
                      {item.user.profilePicture ? (
                        <img
                          src={item.user.profilePicture}
                          alt={item.user.firstName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-sm font-bold">
                          {item.user.firstName[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.user.firstName} {item.user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">@{item.user.username}</p>
                    </div>
                  </div>
                  {item.user.id !== user?.id && (
                    <button
                      onClick={() =>
                        followedUsers.has(item.user.id)
                          ? handleUnfollow(item.user.id)
                          : handleFollow(item.user.id)
                      }
                      className={`p-2 rounded-full transition ${
                        followedUsers.has(item.user.id)
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                      }`}
                    >
                      {followedUsers.has(item.user.id) ? (
                        <UserMinus className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Destination Info */}
                <h3 className="font-bold text-lg text-gray-900 mb-2">
                  {item.campgroundName}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <MapPin className="w-4 h-4 text-primary-600" />
                  {item.state}
                </div>

                {item.targetDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Calendar className="w-4 h-4 text-primary-600" />
                    Target: {new Date(item.targetDate).toLocaleDateString()}
                  </div>
                )}

                {item.notes && (
                  <p className="text-sm text-gray-600 italic mb-3 line-clamp-2">
                    "{item.notes}"
                  </p>
                )}

                {/* Activities Preview */}
                {item.activities.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      {item._count?.activities || item.activities.length} Activities:
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {item.activities.slice(0, 3).map((activity) => (
                        <div
                          key={activity.id}
                          className="relative h-16 rounded-lg overflow-hidden bg-gray-100 group/activity cursor-pointer"
                          onClick={() => handleSaveActivity(activity.id, activity.name)}
                        >
                          {activity.imageUrl ? (
                            <img
                              src={activity.imageUrl}
                              alt={activity.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Eye className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover/activity:bg-opacity-50 transition flex items-center justify-center opacity-0 group-hover/activity:opacity-100">
                            <Bookmark className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {view === 'following' ? 'No posts from people you follow' : 'No public wish lists yet'}
          </h3>
          <p className="text-gray-600">
            {view === 'following'
              ? 'Follow users to see their bucket lists here!'
              : 'Be the first to share your bucket list!'}
          </p>
        </div>
      )}

      {/* Save Destination Modal */}
      {showSaveModal && selectedDestination && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-6 rounded-t-xl">
              <div className="flex items-center gap-3">
                <Bookmark className="w-8 h-8" />
                <h2 className="text-2xl font-bold">Save to Your Board</h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                {selectedDestination.imageUrl ? (
                  <img
                    src={selectedDestination.imageUrl}
                    alt={selectedDestination.campgroundName}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                    <Heart className="w-10 h-10 text-pink-300" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{selectedDestination.campgroundName}</h3>
                  <p className="text-sm text-gray-600">{selectedDestination.state}</p>
                  {selectedDestination.activities.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedDestination.activities.length} activities
                    </p>
                  )}
                </div>
              </div>

              {selectedDestination.activities.length > 0 && (
                <div className="border-t pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeActivities}
                      onChange={(e) => setIncludeActivities(e.target.checked)}
                      className="w-5 h-5 text-primary-600 rounded"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">Include all activities</p>
                      <p className="text-sm text-gray-600">
                        Save all {selectedDestination.activities.length} activities to your board
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveDestination}
                  disabled={saving}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Save to My Board
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
