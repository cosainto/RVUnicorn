import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Loader, Navigation, Clock, Fuel } from 'lucide-react';
import api from '../services/api';

const RV_TYPES = ['Class A', 'Class B', 'Class C', 'Travel Trailer', 'Fifth Wheel', 'Toy Hauler'];

export default function HitchRoutePlanner() {
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState<any>(null);
  const [form, setForm] = useState({
    origin: '',
    destination: '',
    rvLength: 35,
    rvType: 'Class C',
    maxDriveHours: 6,
    interests: [] as string[],
  });

  const INTERESTS = ['Wineries', 'Breweries', 'Hiking', 'Fishing', 'National Parks', 'Beaches', 'Mountains', 'Family Activities'];

  const plan = async () => {
    if (!form.origin || !form.destination) return;
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/route-suggestions', form);
      setRoute(data);
    } catch { alert('Failed to plan route. Try again!'); }
    finally { setLoading(false); }
  };

  const toggleInterest = (i: string) => {
    setForm(f => ({
      ...f,
      interests: f.interests.includes(i) ? f.interests.filter(x => x !== i) : [...f.interests, i]
    }));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <img src="/hitch.png" className="w-10 h-10 rounded-full object-cover" alt="Hitch" />
        <div>
          <h3 className="font-bold text-gray-900">Route Planner</h3>
          <p className="text-xs text-gray-500">Hitch plans your full route with overnight stops</p>
        </div>
      </div>

      {!route ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Starting From</label>
              <input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                placeholder="Chicago, IL" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Going To</label>
              <input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                placeholder="Nashville, TN" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">RV Type</label>
              <select value={form.rvType} onChange={e => setForm(f => ({ ...f, rvType: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white">
                {RV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Max Hours/Day</label>
              <select value={form.maxDriveHours} onChange={e => setForm(f => ({ ...f, maxDriveHours: parseInt(e.target.value) }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white">
                {[4,5,6,7,8].map(h => <option key={h} value={h}>{h} hours</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Interests along the way</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(i => (
                <button key={i} onClick={() => toggleInterest(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${form.interests.includes(i) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <button onClick={plan} disabled={loading || !form.origin || !form.destination}
            className="w-full py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {loading ? <><Loader className="w-4 h-4 animate-spin" /> Planning your route...</> : <><Navigation className="w-4 h-4" /> Plan My Route</>}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Route summary */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-5 h-5" />
              <span className="font-bold">{form.origin} → {form.destination}</span>
            </div>
            <div className="flex gap-4 text-sm text-white/80">
              <span>📅 {route.totalDays} days</span>
              <span>🛣️ ~{route.totalMiles} miles</span>
              <span>🛑 {route.stops?.length} stops</span>
            </div>
          </div>

          {/* Stops */}
          <div className="space-y-4">
            {route.stops?.map((stop: any, i: number) => (
              <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800">Day {stop.day} — {stop.city}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{stop.drivingHours}h drive</span>
                      <span>~{stop.drivingMiles} miles</span>
                    </div>
                  </div>
                  <span className="text-2xl">🏕️</span>
                </div>

                <div className="p-4">
                  {stop.suggestion && (
                    <p className="text-xs text-gray-600 mb-3 italic">💡 {stop.suggestion}</p>
                  )}

                  {stop.campgrounds?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Nearby Campgrounds</p>
                      <div className="space-y-2">
                        {stop.campgrounds.map((cg: any) => (
                          <Link key={cg.id} to={`/campgrounds/${cg.id}`}
                            className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-100 hover:border-green-300 transition text-xs">
                            {cg.imageUrl && <img src={cg.imageUrl} className="w-10 h-10 rounded-lg object-cover shrink-0" alt={cg.name} />}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{cg.name}</p>
                              <p className="text-gray-400">{cg.city} · {cg.googleRating ? `${cg.googleRating}★` : ''} {cg.pricePerNight ? `· $${cg.pricePerNight}/night` : ''}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {stop.freeSpots?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Free Overnight Spots</p>
                      <div className="space-y-1">
                        {stop.freeSpots.map((spot: any) => (
                          <Link key={spot.id} to={`/overnight-spots/${spot.id}`}
                            className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100 hover:border-blue-300 transition text-xs">
                            <span>🅿️</span>
                            <div>
                              <p className="font-semibold text-gray-800">{spot.name}</p>
                              <p className="text-gray-400">{spot.category} · {spot.city}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {route.tips?.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <p className="text-xs font-bold text-amber-700 mb-2">🦄 Hitch's Route Tips</p>
              {route.tips.map((tip: string, i: number) => (
                <p key={i} className="text-xs text-amber-800">• {tip}</p>
              ))}
            </div>
          )}

          <button onClick={() => setRoute(null)}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition border border-gray-200 rounded-xl">
            ← Plan a Different Route
          </button>
        </div>
      )}
    </div>
  );
}
