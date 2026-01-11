import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, UserCheck, UserX, Search } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Friend {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  friendshipId?: string;
}

interface FriendRequest {
  id: string;
  initiator?: Friend;
  receiver?: Friend;
}

interface SearchResult {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadFriends();
    loadRequests();
    loadSentRequests();
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      handleSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data);
    } catch (error) {
      console.error('Load friends error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const { data } = await api.get('/friends/requests');
      setRequests(data);
    } catch (error) {
      console.error('Load requests error:', error);
    }
  };

  const loadSentRequests = async () => {
    try {
      const { data } = await api.get('/friends/sent-requests');
      setSentRequests(data);
    } catch (error) {
      console.error('Load sent requests error:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    try {
      setSearching(true);
      const term = searchTerm.trim();
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(term)}`);
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    try {
      await api.post('/friends/request', { friendId });
      alert('Friend request sent! 🎉');
      setSearchResults(searchResults.filter(r => r.id !== friendId));
      await loadSentRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to send friend request');
    }
  };

  const acceptRequest = async (friendshipId: string) => {
    try {
      await api.put(`/friends/accept/${friendshipId}`);
      await loadFriends();
      await loadRequests();
      alert('Friend request accepted! 🎉');
    } catch (error) {
      console.error('Accept request error:', error);
      alert('Failed to accept request');
    }
  };

  const rejectRequest = async (friendshipId: string) => {
    try {
      await api.delete(`/friends/${friendshipId}`);
      await loadRequests();
      alert('Friend request rejected');
    } catch (error) {
      console.error('Reject request error:', error);
      alert('Failed to reject request');
    }
  };

  const cancelRequest = async (friendshipId: string) => {
    try {
      await api.delete(`/friends/${friendshipId}`);
      await loadSentRequests();
      alert('Friend request canceled');
    } catch (error) {
      console.error('Cancel request error:', error);
      alert('Failed to cancel request');
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!confirm('Remove this friend?')) return;

    try {
      await api.delete(`/friends/${friendshipId}`);
      await loadFriends();
      alert('Friend removed');
    } catch (error) {
      console.error('Remove friend error:', error);
      alert('Failed to remove friend');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-600">Loading friends...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Friends</h1>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for users..."
            className="input flex-1"
          />
        </div>

        {searching && (
          <p className="text-gray-600 text-sm">Searching...</p>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Search Results</h3>
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <Link
                  to={`/profile/${result.username}`}
                  className="flex items-center gap-3 flex-1"
                >
                  {result.profilePicture ? (
                    <img
                      src={`http://127.0.0.1:3001${result.profilePicture}`}
                      alt={result.firstName}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {result.firstName} {result.lastName}
                    </p>
                    <p className="text-sm text-gray-600">@{result.username}</p>
                  </div>
                </Link>
                <button
                  onClick={() => sendFriendRequest(result.id)}
                  className="btn btn-primary btn-sm flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Friend
                </button>
              </div>
            ))}
          </div>
        )}

        {searchTerm && !searching && searchResults.length === 0 && (
          <p className="text-gray-600 text-sm">No users found</p>
        )}
      </div>

      {/* Friend Requests (Received) */}
      {requests.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Friend Requests</h2>
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <Link
                  to={`/profile/${request.initiator?.username}`}
                  className="flex items-center gap-3"
                >
                  {request.initiator?.profilePicture ? (
                    <img
                      src={`http://127.0.0.1:3001${request.initiator.profilePicture}`}
                      alt={request.initiator.firstName}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {request.initiator?.firstName} {request.initiator?.lastName}
                    </p>
                    <p className="text-sm text-gray-600">@{request.initiator?.username}</p>
                  </div>
                </Link>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptRequest(request.id)}
                    className="btn btn-primary btn-sm flex items-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => rejectRequest(request.id)}
                    className="btn btn-secondary btn-sm flex items-center gap-2"
                  >
                    <UserX className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Friend Requests */}
      {sentRequests.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Sent Requests</h2>
          <div className="space-y-3">
            {sentRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <Link
                  to={`/profile/${request.receiver?.username}`}
                  className="flex items-center gap-3"
                >
                  {request.receiver?.profilePicture ? (
                    <img
                      src={`http://127.0.0.1:3001${request.receiver.profilePicture}`}
                      alt={request.receiver.firstName}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {request.receiver?.firstName} {request.receiver?.lastName}
                    </p>
                    <p className="text-sm text-gray-600">@{request.receiver?.username}</p>
                  </div>
                </Link>
                <button
                  onClick={() => cancelRequest(request.id)}
                  className="btn btn-secondary btn-sm flex items-center gap-2"
                >
                  <UserX className="w-4 h-4" />
                  Cancel Request
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          My Friends ({friends.length})
        </h2>

        {friends.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No friends yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Search for users above to add friends!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <Link
                  to={`/profile/${friend.username}`}
                  className="flex items-center gap-3 mb-3"
                >
                  {friend.profilePicture ? (
                    <img
                      src={`http://127.0.0.1:3001${friend.profilePicture}`}
                      alt={friend.firstName}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {friend.firstName} {friend.lastName}
                    </p>
                    <p className="text-sm text-gray-600">@{friend.username}</p>
                  </div>
                </Link>

                <button
                  onClick={() => removeFriend(friend.friendshipId!)}
                  className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                >
                  <UserX className="w-4 h-4" />
                  Remove Friend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
