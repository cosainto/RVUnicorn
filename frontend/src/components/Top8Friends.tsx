import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, GripVertical, Plus, X, UserPlus } from 'lucide-react';
import api from '../services/api';

interface Friend {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  rank?: number;
}

interface Top8FriendsProps {
  username?: string;
}

export default function Top8Friends({ username }: Top8FriendsProps) {
  const [topFriends, setTopFriends] = useState<Friend[]>([]);
  const [allFriends, setAllFriends] = useState<Friend[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const loadTopFriends = useCallback(async () => {
    try {
      const { data } = await api.get('/top-friends');
      if (data && data.length > 0) { setTopFriends(data); } else if (username) { const fallback = await api.get(`/profile/${username}/friends`); setTopFriends((fallback.data.friends || fallback.data || []).slice(0, 8)); }
    } catch (error) {
      console.error('Failed to load top friends:', error);
      // Fallback to regular friends if top-friends endpoint fails
      if (username) {
        try {
          const { data } = await api.get(`/profile/${username}/friends`);
          setTopFriends((data.friends || data || []).slice(0, 8));
        } catch (e) {
          console.error('Failed to load friends fallback:', e);
        }
      }
    }
  }, [username]);

  const loadAllFriends = useCallback(async () => {
    if (!username) return;
    try {
      const { data } = await api.get(`/profile/${username}/friends`);
      setAllFriends(data.friends || data || []);
    } catch (error) {
      console.error('Failed to load all friends:', error);
    }
  }, [username]);

  useEffect(() => {
    loadTopFriends();
  }, [loadTopFriends]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newFriends = [...topFriends];
    const [draggedFriend] = newFriends.splice(draggedIndex, 1);
    newFriends.splice(targetIndex, 0, draggedFriend);
    
    setTopFriends(newFriends);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Save new rankings
    try {
      const rankings = newFriends.map((friend, index) => ({
        friendId: friend.id,
        rank: index + 1,
      }));
      await api.put('/top-friends', { rankings });
    } catch (error) {
      console.error('Failed to save rankings:', error);
      loadTopFriends(); // Reload on error
    }
  };

  const handleAddFriend = async (friend: Friend) => {
    if (topFriends.length >= 8) {
      alert('You can only have 8 top friends!');
      return;
    }
    
    if (topFriends.find(f => f.id === friend.id)) {
      alert('Friend is already in your Top 8!');
      return;
    }

    try {
      await api.post(`/top-friends/${friend.id}`);
      loadTopFriends();
      setShowAddModal(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add friend');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      await api.delete(`/top-friends/${friendId}`);
      loadTopFriends();
    } catch (error) {
      console.error('Failed to remove friend:', error);
    }
  };

  const availableFriends = allFriends.filter(
    f => !topFriends.find(tf => tf.id === f.id)
  );

  return (
    <div className="bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 rounded-lg shadow-md p-1">
      <div className="bg-white rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            Top 8 Friends
          </h3>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    loadAllFriends();
                    setShowAddModal(true);
                  }}
                  className="text-green-500 hover:text-green-600 text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-pink-500 hover:text-pink-600 text-sm"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-purple-500 hover:text-purple-600 text-sm"
                >
                  Edit
                </button>
                <Link to="/friends" className="text-pink-500 hover:text-pink-600 text-sm">
                  All Friends
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[...Array(8)].map((_, index) => {
            const friend = topFriends[index];
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={index}
                className={`relative transition-all duration-200 ${
                  isDragging ? 'opacity-50 scale-95' : ''
                } ${isDragOver ? 'ring-2 ring-pink-400 rounded-lg' : ''}`}
                draggable={isEditing && !!friend}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(index)}
              >
                {friend ? (
                  <div className="block group">
                    {isEditing && (
                      <div className="absolute -top-2 -right-2 z-10 flex gap-1">
                        <button
                          onClick={() => handleRemoveFriend(friend.id)}
                          className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition shadow-md"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <Link to={`/profile/${friend.username}`}>
                      <div className="relative">
                        {friend.profilePicture ? (
                          <img
                            src={friend.profilePicture.startsWith('http') ? friend.profilePicture : `${friend.profilePicture}`}
                            alt={friend.firstName}
                            className={`w-full aspect-square rounded-lg object-cover transition-all ${
                              isEditing ? 'cursor-grab active:cursor-grabbing' : 'group-hover:ring-2 ring-pink-400'
                            }`}
                          />
                        ) : (
                          <div className={`w-full aspect-square rounded-lg bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center transition-all ${
                            isEditing ? 'cursor-grab active:cursor-grabbing' : 'group-hover:ring-2 ring-pink-400'
                          }`}>
                            <span className="text-lg font-bold text-purple-400">
                              {friend.firstName[0]}
                            </span>
                          </div>
                        )}
                        <span className="absolute -top-1 -left-1 w-5 h-5 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow">
                          {index + 1}
                        </span>
                        {isEditing && (
                          <div className="absolute bottom-1 right-1 bg-white/80 rounded p-0.5">
                            <GripVertical className="w-3 h-3 text-gray-500" />
                          </div>
                        )}
                      </div>
                    </Link>
                    <p className="text-xs text-center mt-1 truncate text-gray-600">
                      {friend.firstName}
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      if (isEditing) {
                        loadAllFriends();
                        setShowAddModal(true);
                      }
                    }}
                    className={`w-full aspect-square rounded-lg bg-gray-100 flex items-center justify-center ${
                      isEditing ? 'cursor-pointer hover:bg-gray-200 transition' : ''
                    }`}
                  >
                    {isEditing ? (
                      <Plus className="text-gray-400 w-6 h-6" />
                    ) : (
                      <span className="text-gray-300 text-lg">?</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isEditing && (
          <p className="text-xs text-center text-gray-400 mt-3">
            Drag friends to reorder • Click + to add • Click × to remove
          </p>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Add to Top 8
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-white hover:bg-white/20 p-1 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4 max-h-96 overflow-y-auto">
              {availableFriends.length > 0 ? (
                <div className="space-y-2">
                  {availableFriends.map(friend => (
                    <div
                      key={friend.id}
                      onClick={() => handleAddFriend(friend)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition border"
                    >
                      {friend.profilePicture ? (
                        <img
                          src={friend.profilePicture.startsWith('http') ? friend.profilePicture : `${friend.profilePicture}`}
                          alt={friend.firstName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                          <span className="font-bold text-purple-400">
                            {friend.firstName[0]}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {friend.firstName} {friend.lastName}
                        </p>
                        <p className="text-sm text-gray-500">@{friend.username}</p>
                      </div>
                      <Plus className="w-5 h-5 text-pink-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>All your friends are already in your Top 8!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
