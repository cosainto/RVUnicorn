import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings, Shield, UserX, Eye, EyeOff, Lock, Users, Globe, 
  ChevronDown, ChevronUp, Trash2, Search, AlertTriangle, X
} from 'lucide-react';
import api from '../services/api';

interface BlockedUser {
  id: string;
  reason?: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface SubtabPrivacy {
  subtab: string;
  privacy: string;
}

interface Friend {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture?: string;
}

interface EventSettingsPanelProps {
  eventId: string;
  isOrganizer: boolean;
}

const SUBTABS = [
  { id: 'DETAILS', label: 'Details', icon: '📝' },
  { id: 'MEAL_PLAN', label: 'Meal Plan', icon: '🍽️' },
  { id: 'PACKING_LIST', label: 'Packing List', icon: '🎒' },
  { id: 'DISCUSSIONS', label: 'Discussions', icon: '💬' },
  { id: 'PHOTOS', label: 'Photos', icon: '📷' },
  { id: 'ATTENDEES', label: 'Attendees', icon: '👥' },
];

const PRIVACY_OPTIONS = [
  { value: 'INHERIT', label: 'Use Event Privacy', icon: Globe, color: 'text-gray-500' },
  { value: 'PUBLIC', label: 'Public', icon: Globe, color: 'text-green-600' },
  { value: 'FRIENDS', label: 'Friends Only', icon: Users, color: 'text-blue-600' },
  { value: 'ATTENDEES_ONLY', label: 'Attendees Only', icon: Eye, color: 'text-purple-600' },
  { value: 'PRIVATE', label: 'Only Me', icon: Lock, color: 'text-red-600' },
];

export default function EventSettingsPanel({ eventId, isOrganizer }: EventSettingsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<'privacy' | 'blocked' | null>(null);
  
  // Blocked users state
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [selectedUser, setSelectedUser] = useState<Friend | null>(null);
  
  // Privacy state
  const [subtabPrivacy, setSubtabPrivacy] = useState<SubtabPrivacy[]>([]);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  useEffect(() => {
    if (expanded && isOrganizer) {
      loadBlockedUsers();
      loadSubtabPrivacy();
    }
  }, [expanded, eventId, isOrganizer]);

  const loadBlockedUsers = async () => {
    setBlockedLoading(true);
    try {
      const { data } = await api.get(`/events/${eventId}/blocked-users`);
      setBlockedUsers(data);
    } catch (error) {
      console.error('Load blocked users error:', error);
    } finally {
      setBlockedLoading(false);
    }
  };

  const loadSubtabPrivacy = async () => {
    setPrivacyLoading(true);
    try {
      const { data } = await api.get(`/events/${eventId}/subtab-privacy`);
      setSubtabPrivacy(data);
    } catch (error) {
      console.error('Load subtab privacy error:', error);
    } finally {
      setPrivacyLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data.map((f: any) => f.friend));
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;
    try {
      await api.post(`/events/${eventId}/blocked-users`, {
        blockedUserId: selectedUser.id,
        reason: blockReason || undefined
      });
      await loadBlockedUsers();
      setShowBlockModal(false);
      setSelectedUser(null);
      setBlockReason('');
      setFriendSearch('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to block user');
    }
  };

  const handleUnblockUser = async (userId: string) => {
    if (!confirm('Are you sure you want to unblock this user?')) return;
    try {
      await api.delete(`/events/${eventId}/blocked-users/${userId}`);
      setBlockedUsers(blockedUsers.filter(b => b.user.id !== userId));
    } catch (error) {
      console.error('Unblock error:', error);
    }
  };

  const handlePrivacyChange = async (subtab: string, privacy: string) => {
    try {
      await api.put(`/events/${eventId}/subtab-privacy`, { subtab, privacy });
      setSubtabPrivacy(prev => 
        prev.map(p => p.subtab === subtab ? { ...p, privacy } : p)
      );
    } catch (error) {
      console.error('Update privacy error:', error);
    }
  };

  const getPrivacyForSubtab = (subtab: string) => {
    const found = subtabPrivacy.find(p => p.subtab === subtab);
    return found?.privacy || 'INHERIT';
  };

  const filteredFriends = friends.filter(f => {
    const search = friendSearch.toLowerCase();
    const isAlreadyBlocked = blockedUsers.some(b => b.user.id === f.id);
    return !isAlreadyBlocked && (
      f.username.toLowerCase().includes(search) ||
      f.firstName.toLowerCase().includes(search) ||
      f.lastName.toLowerCase().includes(search)
    );
  });

  if (!isOrganizer) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Advanced Event Settings</h3>
            <p className="text-sm text-gray-500">Privacy controls & blocked users</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-200">
          {/* Section Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveSection(activeSection === 'privacy' ? null : 'privacy')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeSection === 'privacy'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Eye className="w-4 h-4" />
              Subtab Privacy
            </button>
            <button
              onClick={() => {
                setActiveSection(activeSection === 'blocked' ? null : 'blocked');
                if (friends.length === 0) loadFriends();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeSection === 'blocked'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <UserX className="w-4 h-4" />
              Blocked Users ({blockedUsers.length})
            </button>
          </div>

          {/* Privacy Section */}
          {activeSection === 'privacy' && (
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">Control who can see each section</p>
                <p className="text-blue-600">Set visibility for individual tabs. "Use Event Privacy" inherits from the main event setting.</p>
              </div>

              {privacyLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {SUBTABS.map(tab => {
                    const currentPrivacy = getPrivacyForSubtab(tab.id);
                    const currentOption = PRIVACY_OPTIONS.find(o => o.value === currentPrivacy);
                    
                    return (
                      <div key={tab.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{tab.icon}</span>
                          <span className="font-medium text-gray-900">{tab.label}</span>
                        </div>
                        <select
                          value={currentPrivacy}
                          onChange={(e) => handlePrivacyChange(tab.id, e.target.value)}
                          className={`px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${currentOption?.color || ''}`}
                        >
                          {PRIVACY_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Blocked Users Section */}
          {activeSection === 'blocked' && (
            <div className="p-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Blocked users cannot:</p>
                    <ul className="list-disc list-inside text-red-600 space-y-1">
                      <li>View this event or its contents</li>
                      <li>Comment on discussions</li>
                      <li>Be invited as an attendee</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Add Blocked User Button */}
              <button
                onClick={() => setShowBlockModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-red-400 hover:text-red-600 transition-colors"
              >
                <UserX className="w-5 h-5" />
                Block a User
              </button>

              {/* Blocked Users List */}
              {blockedLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No blocked users</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map(blocked => (
                    <div key={blocked.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <Link 
                        to={`/profile/${blocked.user.username}`}
                        className="flex items-center gap-3 hover:opacity-80"
                      >
                        {blocked.user.profilePicture ? (
                          <img
                            src={blocked.user.profilePicture}
                            alt=""
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-600 font-semibold">
                              {blocked.user.firstName[0]}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {blocked.user.firstName} {blocked.user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">@{blocked.user.username}</p>
                        </div>
                      </Link>
                      <button
                        onClick={() => handleUnblockUser(blocked.user.id)}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Block User Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Block User from Event</h3>
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setSelectedUser(null);
                  setBlockReason('');
                  setFriendSearch('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Selected User */}
              {selectedUser && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    {selectedUser.profilePicture ? (
                      <img
                        src={selectedUser.profilePicture}
                        alt=""
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center">
                        <span className="text-red-700 font-semibold">
                          {selectedUser.firstName[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {selectedUser.firstName} {selectedUser.lastName}
                      </p>
                      <p className="text-sm text-gray-500">@{selectedUser.username}</p>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* User List */}
              {!selectedUser && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredFriends.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No users found</p>
                  ) : (
                    filteredFriends.map(friend => (
                      <button
                        key={friend.id}
                        onClick={() => setSelectedUser(friend)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg text-left"
                      >
                        {friend.profilePicture ? (
                          <img
                            src={friend.profilePicture}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-600 text-sm font-semibold">
                              {friend.firstName[0]}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {friend.firstName} {friend.lastName}
                          </p>
                          <p className="text-xs text-gray-500">@{friend.username}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Reason */}
              {selectedUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Why are you blocking this user?"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setSelectedUser(null);
                  setBlockReason('');
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockUser}
                disabled={!selectedUser}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <UserX className="w-4 h-4" />
                Block User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
