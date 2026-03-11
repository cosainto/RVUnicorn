import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { MapPin, Calendar, Navigation, ExternalLink, AlertCircle } from 'lucide-react';

const STOP_TYPES: Record<string, {icon: string; label: string; color: string}> = {
  OVERNIGHT: { icon: '🏕️', label: 'Overnight', color: 'bg-green-100 text-green-700' },
  FUEL:      { icon: '⛽', label: 'Fuel', color: 'bg-yellow-100 text-yellow-700' },
  FOOD:      { icon: '🍔', label: 'Food', color: 'bg-orange-100 text-orange-700' },
  ATTRACTION:{ icon: '⭐', label: 'Attraction', color: 'bg-purple-100 text-purple-700' },
  WAYPOINT:  { icon: '📍', label: 'Waypoint', color: 'bg-blue-100 text-blue-700' },
  BOONDOCK:  { icon: '🌲', label: 'Boondock', color: 'bg-emerald-100 text-emerald-700' },
  WALMART:   { icon: '🛒', label: 'Walmart', color: 'bg-blue-100 text-blue-800' },
  REST:      { icon: '😴', label: 'Rest', color: 'bg-indigo-100 text-indigo-700' },
};
const DAY_TYPES: Record<string, string> = { TRAVEL:'🚗 Travel Day', STAY:'🏕️ Stay Day', REST:'😴 Rest Day', ARRIVAL:'🎉 Arrival', DEPARTURE:'👋 Departure' };

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}); }

export default function SharedTripPage() {
  const { token } = useParams<{ token: string }>();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/itinerary/shared/${token}`)
      .then(({ data }) => setTrip(data))
      .catch(() => setError('This trip is no longer shared or the link is invalid.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 mb-4">{error}</p>
        <Link to="/" className="text-primary-600 hover:text-primary-700 text-sm">← Back to RVUnicorn</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <img src="/hitch.png" alt="RVUnicorn" className="w-8 h-8 rounded-full" />
            <Link to="/" className="text-sm text-primary-600 font-semibold hover:text-primary-700">RVUnicorn</Link>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-400">Shared Trip</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{trip.title}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {trip.user && (
              <div className="flex items-center gap-1.5">
                {trip.user.profileImage
                  ? <img src={trip.user.profileImage} className="w-5 h-5 rounded-full object-cover" />
                  : <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center text-xs text-primary-600 font-bold">{trip.user.firstName?.[0]}</div>}
                <span className="text-sm text-gray-600">{trip.user.firstName} {trip.user.lastName}</span>
              </div>
            )}
            {trip.startDate && (
              <span className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-lg flex items-center gap-1">
                <Calendar className="w-3 h-3"/> Departs {fmtDate(trip.startDate)}
              </span>
            )}
            <span className="text-xs text-gray-400">{trip.days?.length} days · {trip.days?.reduce((a: number, d: any) => a + d.stops.length, 0)} stops</span>
          </div>
          {trip.members?.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-xs text-gray-400">Traveling with:</span>
              {trip.members.map((m: any) => (
                <div key={m.userId} className="flex items-center gap-1">
                  {m.user?.profileImage
                    ? <img src={m.user.profileImage} className="w-5 h-5 rounded-full object-cover" />
                    : <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-bold">{m.user?.firstName?.[0]}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Days */}
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {trip.days?.map((day: any) => (
          <div key={day.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">{day.dayNumber}</span>
              <span className="text-sm font-semibold text-gray-700">{DAY_TYPES[day.type] || day.type}</span>
              {day.date && <span className="text-xs text-gray-400">{fmtDate(day.date)}</span>}
              {day.notes && <span className="text-xs text-gray-400 italic truncate flex-1">— {day.notes}</span>}
            </div>
            <div className="p-3 space-y-1.5">
              {day.stops.length === 0 && <p className="text-xs text-gray-400 py-2 text-center">No stops planned for this day</p>}
              {day.stops.map((stop: any) => {
                const st = STOP_TYPES[stop.type] || STOP_TYPES.WAYPOINT;
                const name = stop.campground?.name || stop.customName;
                const lat = stop.campground?.latitude || stop.latitude;
                const lng = stop.campground?.longitude || stop.longitude;
                return (
                  <div key={stop.id} className={`flex items-start gap-2 p-2.5 rounded-xl border ${stop.confirmed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${st.color}`}>{st.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{name || 'Unnamed stop'}</p>
                      {stop.address && <p className="text-xs text-gray-400 truncate">{stop.address}</p>}
                      {stop.notes && !stop.notes.startsWith('SKIPPED') && <p className="text-xs text-gray-400 italic mt-0.5 line-clamp-1">{stop.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {stop.confirmed && <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">✓</span>}
                      {stop.type === 'OVERNIGHT' && lat && lng && (
                        <a href={`https://www.rvparky.com/?lat=${lat}&lng=${lng}&zoom=10`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                          <ExternalLink className="w-2.5 h-2.5"/> RVParky
                        </a>
                      )}
                      {lat && lng && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-gray-200">
                          <Navigation className="w-2.5 h-2.5"/>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="text-center py-6">
          <p className="text-xs text-gray-400 mb-2">Plan your own RV trips on</p>
          <Link to="/" className="text-primary-600 font-semibold hover:text-primary-700">🦄 RVUnicorn</Link>
        </div>
      </div>
    </div>
  );
}
