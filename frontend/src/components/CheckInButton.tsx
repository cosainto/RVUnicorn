import { useState, useEffect } from 'react';
import { MapPin, UserPlus, X, Search } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  locationId: string;
  locationType: 'campground' | 'host' | 'spot';
  locationName: string;
  onCheckIn?: () => void;
}

interface Friend {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
}

function FriendPicker({ friends, selectedFriends, friendSearch, loadingFriends, onSearchChange, onToggle }: {
  friends: Friend[];
  selectedFriends: Friend[];
  friendSearch: string;
  loadingFriends: boolean;
  onSearchChange: (v: string) => void;
  onToggle: (f: Friend) => void;
}) {
  const filtered = friends.filter(f =>
    !friendSearch || `${f.firstName} ${f.lastName} ${f.username}`.toLowerCase().includes(friendSearch.toLowerCase())
  );

  return (
    <>
      {selectedFriends.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedFriends.map(f => (
            <span key={f.id} className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 text-xs font-medium px-2 py-1 rounded-full">
              {f.firstName} {f.lastName}
              <button onClick={() => onToggle(f)} className="hover:text-primary-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={friendSearch}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search friends..."
            className="w-full text-sm pl-9 pr-4 py-2 border-b border-gray-100"
          />
        </div>
        <div className="max-h-40 overflow-y-auto">
          {loadingFriends ? (
            <p className="text-xs text-gray-400 p-3 text-center">Loading friends...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-400 p-3 text-center">No friends found</p>
          ) : (
            filtered.map(f => {
              const isSelected = selectedFriends.some(sf => sf.id === f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => onToggle(f)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition ${isSelected ? 'bg-primary-50' : ''}`}
                >
                  {f.profilePicture ? (
                    <img src={f.profilePicture} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                      {f.firstName?.[0]}
                    </div>
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
    </>
  );
}

export default function CheckInButton({ locationId, locationType, locationName, onCheckIn }: Props) {
  const { user } = useAuth();
  const [activeCheckIn, setActiveCheckIn] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [siteNumber, setSiteNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Friend picker state (shared between check-in modal and invite modal)
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (user) fetchActiveCheckIn();
  }, [user]);

  const fetchActiveCheckIn = async () => {
    try {
      const { data } = await api.get('/checkins/active');
      setActiveCheckIn(data);
    } catch {}
  };

  const fetchFriends = async () => {
    if (friends.length > 0) return;
    setLoadingFriends(true);
    try {
      const { data } = await api.get('/friends');
      setFriends(data);
    } catch {}
    finally { setLoadingFriends(false); }
  };

  const isCheckedInHere = activeCheckIn && (
    (locationType === 'campground' && activeCheckIn.campgroundId === locationId) ||
    (locationType === 'host' && activeCheckIn.harvestHostId === locationId) ||
    (locationType === 'spot' && activeCheckIn.overnightSpotId === locationId)
  );

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const payload: any = { siteNumber, notes };
      if (locationType === 'campground') payload.campgroundId = locationId;
      else if (locationType === 'host') payload.harvestHostId = locationId;
      else payload.overnightSpotId = locationId;
      if (selectedFriends.length > 0) {
        payload.inviteeIds = selectedFriends.map(f => f.id);
      }
      const { data } = await api.post('/checkins', payload);
      setActiveCheckIn(data);
      setShowModal(false);
      setSiteNumber(''); setNotes('');
      resetFriendPicker();
      onCheckIn?.();
    } catch { alert('Failed to check in'); }
    finally { setLoading(false); }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      await api.delete('/checkins/active');
      setActiveCheckIn(null);
      onCheckIn?.();
    } catch { alert('Failed to check out'); }
    finally { setLoading(false); }
  };

  const handleInviteFriends = async () => {
    if (selectedFriends.length === 0) return;
    setLoading(true);
    try {
      await api.post('/checkins/invite-friends', {
        inviteeIds: selectedFriends.map(f => f.id),
      });
      setShowInviteModal(false);
      resetFriendPicker();
    } catch { alert('Failed to invite friends'); }
    finally { setLoading(false); }
  };

  const toggleFriend = (friend: Friend) => {
    setSelectedFriends(prev =>
      prev.find(f => f.id === friend.id)
        ? prev.filter(f => f.id !== friend.id)
        : [...prev, friend]
    );
  };

  const resetFriendPicker = () => {
    setSelectedFriends([]);
    setShowFriendPicker(false);
    setFriendSearch('');
  };

  if (!user) return null;

  return (
    <>
      {isCheckedInHere ? (
        <div className="flex items-center gap-2">
          <button onClick={handleCheckOut} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-red-500 transition group">
            <MapPin className="w-4 h-4" />
            <span className="group-hover:hidden">Checked In</span>
            <span className="hidden group-hover:inline">Check Out</span>
          </button>
          <button
            onClick={() => { setShowInviteModal(true); fetchFriends(); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 text-sm font-semibold rounded-xl hover:bg-primary-100 transition border border-primary-200"
          >
            <UserPlus className="w-4 h-4" />
            Invite Friends
          </button>
        </div>
      ) : (
        <button onClick={() => setShowModal(true)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition">
          <MapPin className="w-4 h-4" />
          Check In Here
        </button>
      )}

      {/* Check-in modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg mb-1">Check In</h3>
            <p className="text-sm text-gray-500 mb-4">You're checking in at <strong>{locationName}</strong></p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Site / Spot Number (optional)</label>
                <input value={siteNumber} onChange={e => setSiteNumber(e.target.value)}
                  placeholder="e.g. Site 42, Row B" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Note for the herd (optional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Great sunset views from here!" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
              </div>

              {/* Check in friends section */}
              <div>
                <button
                  type="button"
                  onClick={() => { setShowFriendPicker(!showFriendPicker); if (!showFriendPicker) fetchFriends(); }}
                  className="flex items-center gap-2 text-sm text-primary-600 font-medium hover:text-primary-700 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  Check in friends too
                </button>

                {showFriendPicker && (
                  <FriendPicker
                    friends={friends}
                    selectedFriends={selectedFriends}
                    friendSearch={friendSearch}
                    loadingFriends={loadingFriends}
                    onSearchChange={setFriendSearch}
                    onToggle={toggleFriend}
                  />
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCheckIn} disabled={loading}
                className="flex-1 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
                {loading ? 'Checking in...' : selectedFriends.length > 0 ? `Check In (${selectedFriends.length + 1})` : 'Check In!'}
              </button>
              <button onClick={() => { setShowModal(false); resetFriendPicker(); }}
                className="px-4 border border-gray-200 text-gray-600 font-semibold rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite friends modal (when already checked in) */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-lg mb-1">Invite Friends</h3>
            <p className="text-sm text-gray-500 mb-4">Check in friends at <strong>{locationName}</strong></p>

            <FriendPicker
              friends={friends}
              selectedFriends={selectedFriends}
              friendSearch={friendSearch}
              loadingFriends={loadingFriends}
              onSearchChange={setFriendSearch}
              onToggle={toggleFriend}
            />

            <div className="flex gap-3 mt-4">
              <button onClick={handleInviteFriends} disabled={loading || selectedFriends.length === 0}
                className="flex-1 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
                {loading ? 'Sending...' : selectedFriends.length > 0 ? `Invite ${selectedFriends.length} Friend${selectedFriends.length > 1 ? 's' : ''}` : 'Select Friends'}
              </button>
              <button onClick={() => { setShowInviteModal(false); resetFriendPicker(); }}
                className="px-4 border border-gray-200 text-gray-600 font-semibold rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
