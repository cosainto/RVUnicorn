import { useState, useEffect } from 'react';
import { 
  UserX, Loader2, AlertTriangle, Search, 
  Shield, Trash2, User as UserIcon
} from 'lucide-react';
import api from '../services/api';

interface BlockedUser {
  id: string;
  createdAt: string;
  reason?: string;
  blockedUser: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

export default function BlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      const { data } = await api.get('/privacy/blocked');
      setBlockedUsers(data);
    } catch (err) {
      console.error('Error fetching blocked users:', err);
      setError('Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedUserId: string, username: string) => {
    if (!confirm(`Are you sure you want to unblock @${username}?`)) return;

    setUnblocking(blockedUserId);
    try {
      await api.delete(`/privacy/block/${blockedUserId}`);
      setBlockedUsers(blockedUsers.filter(bu => bu.blockedUser.id !== blockedUserId));
    } catch (err) {
      console.error('Error unblocking user:', err);
      setError('Failed to unblock user');
    } finally {
      setUnblocking(null);
    }
  };

  const filteredUsers = blockedUsers.filter(bu => {
    const searchLower = searchTerm.toLowerCase();
    return (
      bu.blockedUser.username.toLowerCase().includes(searchLower) ||
      bu.blockedUser.firstName.toLowerCase().includes(searchLower) ||
      bu.blockedUser.lastName.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <UserX className="w-8 h-8 text-red-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blocked Users</h1>
          <p className="text-gray-600">Manage users you've blocked</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">What happens when you block someone?</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>They can't see your profile or posts</li>
              <li>They can't send you friend requests or messages</li>
              <li>They can't tag you in photos or posts</li>
              <li>Any existing friendship is automatically removed</li>
              <li>They won't be notified that you blocked them</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Search */}
      {blockedUsers.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search blocked users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      )}

      {/* Blocked Users List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <UserX className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            {blockedUsers.length === 0 ? (
              <p>You haven't blocked anyone yet</p>
            ) : (
              <p>No blocked users match your search</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredUsers.map((bu) => (
              <li key={bu.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {bu.blockedUser.profilePicture ? (
                    <img
                      src={bu.blockedUser.profilePicture}
                      alt={bu.blockedUser.username}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {bu.blockedUser.firstName} {bu.blockedUser.lastName}
                    </p>
                    <p className="text-sm text-gray-500">@{bu.blockedUser.username}</p>
                    <p className="text-xs text-gray-400">
                      Blocked {new Date(bu.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(bu.blockedUser.id, bu.blockedUser.username)}
                  disabled={unblocking === bu.blockedUser.id}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {unblocking === bu.blockedUser.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {blockedUsers.length > 0 && (
        <p className="mt-4 text-sm text-gray-500 text-center">
          {blockedUsers.length} user{blockedUsers.length !== 1 ? 's' : ''} blocked
        </p>
      )}
    </div>
  );
}
