import { useState, useEffect } from 'react';
import { MapPin, Check, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Invite {
  id: string;
  inviter: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
  };
  checkIn: {
    campground?: { id: string; name: string; imageUrl: string | null; city: string | null; state: string | null } | null;
  };
  expiresAt: string;
}

export default function CheckInInviteBanner() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchInvites();
  }, [user]);

  const fetchInvites = async () => {
    try {
      const { data } = await api.get('/checkins/invites/pending');
      setInvites(data);
    } catch {}
  };

  const respond = async (inviteId: string, action: 'accept' | 'decline') => {
    setResponding(inviteId);
    try {
      await api.post(`/checkins/invites/${inviteId}/respond`, { action });
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch {
      alert(`Failed to ${action} invite`);
    } finally {
      setResponding(null);
    }
  };

  if (!user || invites.length === 0) return null;

  return (
    <div className="space-y-2">
      {invites.map(invite => {
        const inviterName = `${invite.inviter.firstName} ${invite.inviter.lastName || ''}`.trim();
        const locationName = invite.checkIn?.campground?.name || 'a location';
        const locationDetail = [invite.checkIn?.campground?.city, invite.checkIn?.campground?.state].filter(Boolean).join(', ');
        const isResponding = responding === invite.id;

        return (
          <div key={invite.id} className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex items-start gap-3">
            {invite.inviter.profilePicture ? (
              <img src={invite.inviter.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-200 flex items-center justify-center text-sm font-bold text-primary-700 flex-shrink-0">
                {invite.inviter.firstName?.[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">
                <strong>{inviterName}</strong> wants to check you in at <strong>{locationName}</strong>
              </p>
              {locationDetail && <p className="text-xs text-gray-500 mt-0.5">{locationDetail}</p>}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => respond(invite.id, 'accept')}
                  disabled={isResponding}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  Accept
                </button>
                <button
                  onClick={() => respond(invite.id, 'decline')}
                  disabled={isResponding}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  Decline
                </button>
              </div>
            </div>
            <MapPin className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
          </div>
        );
      })}
    </div>
  );
}
