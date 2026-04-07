import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, UserCheck, UserX, Search, Inbox, Send, Clock } from 'lucide-react';
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

type Tab = 'friends' | 'requests' | 'sent' | 'find';

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    // If you arrive here with ?tab=sent, jump straight to the sent tab.
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as Tab | null;
    if (t && ['friends', 'requests', 'sent', 'find'].includes(t)) return t;
    return 'friends';
  });

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

  const TABS: { key: Tab; label: string; icon: any; count: number; tone: 'gray' | 'red' | 'amber' | 'primary' }[] = [
    { key: 'friends', label: 'Friends', icon: Users, count: friends.length, tone: 'gray' },
    { key: 'requests', label: 'Requests', icon: Inbox, count: requests.length, tone: 'red' },
    { key: 'sent', label: 'Sent', icon: Send, count: sentRequests.length, tone: 'amber' },
    { key: 'find', label: 'Find People', icon: Search, count: 0, tone: 'primary' },
  ];

  const toneClasses = (tone: string, active: boolean) => {
    if (!active) return 'bg-white text-gray-600 hover:text-gray-900 border-gray-200 hover:bg-gray-50';
    if (tone === 'red') return 'bg-red-50 text-red-700 border-red-200';
    if (tone === 'amber') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (tone === 'primary') return 'bg-primary-50 text-primary-700 border-primary-200';
    return 'bg-gray-100 text-gray-900 border-gray-300';
  };

  const badgeClasses = (tone: string) => {
    if (tone === 'red') return 'bg-red-500 text-white';
    if (tone === 'amber') return 'bg-amber-500 text-white';
    if (tone === 'primary') return 'bg-primary-500 text-white';
    return 'bg-gray-300 text-gray-700';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-gray-900">Friends</h1>
        {(requests.length > 0 || sentRequests.length > 0) && (
          <div className="text-sm text-gray-500">
            {requests.length > 0 && <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />{requests.length} need{requests.length === 1 ? 's' : ''} your reply</span>}
            {sentRequests.length > 0 && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" />{sentRequests.length} waiting on a reply</span>}
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">Camping buddies, pending invites, and people to connect with — all in one place.</p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition ${toneClasses(tab.tone, active)}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${badgeClasses(tab.tone)}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No incoming requests</p>
              <p className="text-sm text-gray-500 mt-1">When other campers want to add you, they'll show up here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-red-50/40 border border-red-100 rounded-xl">
                  <Link to={`/profile/${request.initiator?.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {request.initiator?.profilePicture ? (
                      <img src={request.initiator.profilePicture} alt={request.initiator.firstName} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{request.initiator?.firstName} {request.initiator?.lastName}</p>
                      <p className="text-sm text-gray-600 truncate">@{request.initiator?.username}</p>
                    </div>
                  </Link>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => acceptRequest(request.id)} className="btn btn-primary btn-sm flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4" /> Accept
                    </button>
                    <button onClick={() => rejectRequest(request.id)} className="btn btn-secondary btn-sm flex items-center gap-1.5">
                      <UserX className="w-4 h-4" /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {sentRequests.length === 0 ? (
            <div className="text-center py-12">
              <Send className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No pending invites you sent</p>
              <p className="text-sm text-gray-500 mt-1">Use <button onClick={() => setActiveTab('find')} className="text-primary-600 underline">Find People</button> to add a camping buddy.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">These people haven't replied yet. You can cancel a request anytime.</p>
              <div className="space-y-3">
                {sentRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 bg-amber-50/40 border border-amber-100 rounded-xl">
                    <Link to={`/profile/${request.receiver?.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                      {request.receiver?.profilePicture ? (
                        <img src={request.receiver.profilePicture} alt={request.receiver.firstName} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <Users className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{request.receiver?.firstName} {request.receiver?.lastName}</p>
                        <p className="text-sm text-gray-600 truncate">@{request.receiver?.username}</p>
                        <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> Waiting for them to accept</p>
                      </div>
                    </Link>
                    <button onClick={() => cancelRequest(request.id)} className="btn btn-secondary btn-sm flex items-center gap-1.5 flex-shrink-0">
                      <UserX className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'find' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or @username…"
              className="input flex-1"
              autoFocus
            />
          </div>

          {searching && <p className="text-gray-600 text-sm">Searching…</p>}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((result) => (
                <div key={result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <Link to={`/profile/${result.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {result.profilePicture ? (
                      <img src={result.profilePicture} alt={result.firstName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{result.firstName} {result.lastName}</p>
                      <p className="text-sm text-gray-600 truncate">@{result.username}</p>
                    </div>
                  </Link>
                  <button onClick={() => sendFriendRequest(result.id)} className="btn btn-primary btn-sm flex items-center gap-2 flex-shrink-0">
                    <UserPlus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchTerm && !searching && searchResults.length === 0 && (
            <p className="text-gray-600 text-sm">No users found.</p>
          )}

          {!searchTerm && (
            <p className="text-gray-400 text-sm italic">Start typing to find someone.</p>
          )}
        </div>
      )}

      {activeTab === 'friends' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {friends.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No camping buddies yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Use <button onClick={() => setActiveTab('find')} className="text-primary-600 underline">Find People</button> to send your first request.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map((friend) => (
                <div key={friend.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                  <Link to={`/profile/${friend.username}`} className="flex items-center gap-3 mb-3">
                    {friend.profilePicture ? (
                      <img src={friend.profilePicture} alt={friend.firstName} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <Users className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{friend.firstName} {friend.lastName}</p>
                      <p className="text-sm text-gray-600 truncate">@{friend.username}</p>
                    </div>
                  </Link>
                  <button onClick={() => removeFriend(friend.friendshipId!)} className="text-red-600 hover:text-red-700 text-xs flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
