import { useState, useEffect } from 'react';
import { MapPin, LogOut } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  locationId: string;
  locationType: 'campground' | 'host' | 'spot';
  locationName: string;
  onCheckIn?: () => void;
}

export default function CheckInButton({ locationId, locationType, locationName, onCheckIn }: Props) {
  const { user } = useAuth();
  const [activeCheckIn, setActiveCheckIn] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [siteNumber, setSiteNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (user) fetchActiveCheckIn();
  }, [user]);

  const fetchActiveCheckIn = async () => {
    try {
      const { data } = await api.get('/checkins/active');
      setActiveCheckIn(data);
    } catch {}
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
      const { data } = await api.post('/checkins', payload);
      setActiveCheckIn(data);
      setShowModal(false);
      setSiteNumber(''); setNotes('');
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

  if (!user) return null;

  return (
    <>
      {isCheckedInHere ? (
        <button onClick={handleCheckOut} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-red-500 transition group">
          <MapPin className="w-4 h-4" />
          <span className="group-hover:hidden">✅ Checked In</span>
          <span className="hidden group-hover:inline">Check Out</span>
        </button>
      ) : (
        <button onClick={() => setShowModal(true)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition">
          <MapPin className="w-4 h-4" />
          Check In Here
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900 text-lg mb-1">🏕️ Check In</h3>
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
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCheckIn} disabled={loading}
                className="flex-1 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
                {loading ? 'Checking in...' : '🏕️ Check In!'}
              </button>
              <button onClick={() => setShowModal(false)}
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
