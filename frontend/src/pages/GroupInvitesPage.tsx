import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Check, X, ArrowLeft } from 'lucide-react';
import api from '../services/api';

interface GroupInvite {
  id: string;
  status: string;
  createdAt: string;
  group: {
    id: string;
    name: string;
    slug: string;
    coverPhoto?: string;
  };
  inviter: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

export default function GroupInvitesPage() {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    try {
      const { data } = await api.get('/groups/invites/my');
      setInvites(data);
    } catch (error) {
      console.error('Load invites error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (inviteId: string) => {
    try {
      setProcessing(inviteId);
      const { data } = await api.post('/groups/invites/' + inviteId + '/accept');
      alert('Joined group! 🎉');
      navigate('/groups/' + data.group.slug);
    } catch (error: any) {
      console.error('Accept invite error:', error);
      alert(error.response?.data?.error || 'Failed to accept invite');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (inviteId: string) => {
    if (!confirm('Decline this invite?')) return;
    
    try {
      setProcessing(inviteId);
      await api.post('/groups/invites/' + inviteId + '/decline');
      setInvites(invites.filter(i => i.id !== inviteId));
    } catch (error: any) {
      console.error('Decline invite error:', error);
      alert(error.response?.data?.error || 'Failed to decline invite');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <button
          onClick={() => navigate('/groups')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Groups
        </button>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Group Invites</h1>

          {invites.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No pending invites</p>
              <Link to="/groups" className="text-primary-600 hover:underline mt-2 inline-block">
                Browse groups
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="border border-gray-200 rounded-lg p-4 flex items-center gap-4"
                >
                  {/* Group Image */}
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg overflow-hidden flex-shrink-0">
                    {invite.group.coverPhoto ? (
                      <img
                        src={invite.group.coverPhoto.startsWith('http') ? invite.group.coverPhoto : '' + invite.group.coverPhoto}
                        alt={invite.group.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Invite Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={'/groups/' + invite.group.slug}
                      className="font-semibold text-gray-900 hover:text-primary-600 block truncate"
                    >
                      {invite.group.name}
                    </Link>
                    <p className="text-sm text-gray-600">
                      Invited by{' '}
                      <Link
                        to={'/profile/' + invite.inviter.username}
                        className="text-primary-600 hover:underline"
                      >
                        {invite.inviter.firstName} {invite.inviter.lastName}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(invite.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDecline(invite.id)}
                      disabled={processing === invite.id}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Decline"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleAccept(invite.id)}
                      disabled={processing === invite.id}
                      className="p-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition"
                      title="Accept"
                    >
                      {processing === invite.id ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
