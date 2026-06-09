import { useState } from 'react';
import { UserPlus, X, Search } from 'lucide-react';
import api from '../services/api';

interface Friend {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
}

interface Props {
  locationName: string;
  onClose: () => void;
}

export default function InviteFriendsCheckIn({ locationName, onClose }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useState(() => {
    api.get('/friends').then(({ data }) => setFriends(data)).catch(() => {}).finally(() => setLoadingFriends(false));
  });

  const toggleFriend = (friend: Friend) => {
    setSelectedFriends(prev =>
      prev.find(f => f.id === friend.id)
        ? prev.filter(f => f.id !== friend.id)
        : [...prev, friend]
    );
  };

  const handleSend = async () => {
    if (selectedFriends.length === 0) return;
    setSending(true);
    try {
      await api.post('/checkins/invite-friends', {
        inviteeIds: selectedFriends.map(f => f.id),
      });
      setSent(true);
    } catch {
      alert('Failed to invite friends');
    }
    setSending(false);
  };

  const filtered = friends.filter(f =>
    !friendSearch || `${f.firstName} ${f.lastName} ${f.username}`.toLowerCase().includes(friendSearch.toLowerCase())
  );

  if (sent) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
          <div className="text-3xl mb-2">🎉</div>
          <h3 className="font-bold text-gray-900">Invites Sent!</h3>
          <p className="text-sm text-gray-500 mt-1">
            {selectedFriends.length} friend{selectedFriends.length > 1 ? 's' : ''} invited to check in at {locationName}. They have 2 hours to accept.
          </p>
          <button onClick={onClose} className="mt-4 px-6 py-2 bg-primary-600 text-white font-semibold rounded-xl">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-600" />Invite Friends
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Check in friends at <strong>{locationName}</strong></p>

        {selectedFriends.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedFriends.map(f => (
              <span key={f.id} className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 text-xs font-medium px-2 py-1 rounded-full">
                {f.firstName} {f.lastName}
                <button onClick={() => toggleFriend(f)} className="hover:text-primary-900"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={friendSearch} onChange={e => setFriendSearch(e.target.value)} placeholder="Search friends..."
              className="w-full text-sm pl-9 pr-4 py-2 border-b border-gray-100" />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loadingFriends ? (
              <p className="text-xs text-gray-400 p-3 text-center">Loading friends...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 p-3 text-center">No friends found</p>
            ) : (
              filtered.map(f => {
                const isSelected = selectedFriends.some(sf => sf.id === f.id);
                return (
                  <button key={f.id} onClick={() => toggleFriend(f)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition ${isSelected ? 'bg-primary-50' : ''}`}>
                    {f.profilePicture ? (
                      <img src={f.profilePicture} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{f.firstName?.[0]}</div>
                    )}
                    <span className="text-sm text-gray-800 flex-1">{f.firstName} {f.lastName}</span>
                    {isSelected && <span className="text-primary-600 text-xs font-semibold">Selected</span>}
                  </button>
                );
              })
            )}
          </div>
          <p className="text-[11px] text-gray-400 px-3 py-1.5 border-t border-gray-100">
            They'll have 2 hours to accept before auto check-in
          </p>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={handleSend} disabled={sending || selectedFriends.length === 0}
            className="flex-1 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
            {sending ? 'Sending...' : selectedFriends.length > 0 ? `Invite ${selectedFriends.length} Friend${selectedFriends.length > 1 ? 's' : ''}` : 'Select Friends'}
          </button>
          <button onClick={onClose} className="px-4 border border-gray-200 text-gray-600 font-semibold rounded-xl">Cancel</button>
        </div>
      </div>
    </div>
  );
}
