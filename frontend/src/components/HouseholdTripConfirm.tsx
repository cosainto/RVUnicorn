import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, MapPin, Calendar } from 'lucide-react';
import api from '../services/api';

const C = { card: '#1B2B4B', cardLight: '#243352', border: '#2A3F5F', gold: '#C9A84C', cream: '#F5F0E8', muted: '#94A3B8', green: '#1D9E75', red: '#EF4444' };

interface UnconfirmedTrip {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  campground?: { name: string };
  organizer?: { firstName: string };
}

export default function HouseholdTripConfirm() {
  const [trips, setTrips] = useState<UnconfirmedTrip[]>([]);
  const [partnerName, setPartnerName] = useState('');
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    api.get('/trips/household-unconfirmed')
      .then(r => {
        setTrips(r.data.trips || []);
        setPartnerName(r.data.partnerName || 'Your co-pilot');
      })
      .catch(() => {});
  }, []);

  const handleConfirm = async (tripId: string, confirmed: boolean) => {
    setResponding(tripId);
    try {
      await api.post(`/trips/${tripId}/household-confirm`, { confirmed });
      setTrips(prev => prev.filter(t => t.id !== tripId));
    } catch (err) {
      console.error('Confirm error:', err);
    } finally {
      setResponding(null);
    }
  };

  if (trips.length === 0) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-4">
      <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">👥</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: C.cream }}>Were you on these trips?</p>
            <p className="text-xs" style={{ color: C.muted }}>{partnerName} went on {trips.length} trip{trips.length !== 1 ? 's' : ''} — confirm if you were there too</p>
          </div>
        </div>

        <div className="space-y-2">
          {trips.map(trip => (
            <div key={trip.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: C.cardLight }}>
              <div className="flex-1 min-w-0">
                <Link to={`/trips/${trip.id}`} className="text-sm font-semibold hover:underline" style={{ color: C.cream }}>
                  {trip.title}
                </Link>
                <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: C.muted }}>
                  {trip.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {(trip.campground?.name || trip.location) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {trip.campground?.name || trip.location}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleConfirm(trip.id, true)}
                  disabled={responding === trip.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'rgba(29,158,117,0.15)', color: C.green, border: `1px solid rgba(29,158,117,0.3)` }}
                >
                  <CheckCircle className="w-3.5 h-3.5" /> I was there
                </button>
                <button
                  onClick={() => handleConfirm(trip.id, false)}
                  disabled={responding === trip.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
                  style={{ color: C.muted }}
                >
                  <XCircle className="w-3.5 h-3.5" /> No
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
