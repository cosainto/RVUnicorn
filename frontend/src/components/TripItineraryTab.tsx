import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Plus, Trash2, Check, X, Loader } from 'lucide-react';

const STOP_TYPES = [
  { value: 'OVERNIGHT', label: 'Overnight Stay', icon: '🏕️', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'FUEL', label: 'Fuel Stop', icon: '⛽', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'FOOD', label: 'Food / Restaurant', icon: '🍔', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'ATTRACTION', label: 'Attraction', icon: '⭐', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'WAYPOINT', label: 'Waypoint', icon: '📍', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'BOONDOCK', label: 'Boondocking', icon: '🌲', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'WALMART', label: 'Walmart Overnight', icon: '🛒', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'DUMP', label: 'Dump Station', icon: '🚰', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'REST', label: 'Rest Area', icon: '😴', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
];

const DAY_TYPES = [
  { value: 'TRAVEL', label: 'Travel Day', icon: '🚗' },
  { value: 'STAY', label: 'Stay Day', icon: '🏕️' },
  { value: 'REST', label: 'Rest Day', icon: '😴' },
  { value: 'ARRIVAL', label: 'Arrival Day', icon: '🎉' },
  { value: 'DEPARTURE', label: 'Departure Day', icon: '👋' },
];

function getStopType(type: string) { return STOP_TYPES.find(t => t.value === type) || STOP_TYPES[0]; }
function getDayType(type: string) { return DAY_TYPES.find(t => t.value === type) || DAY_TYPES[0]; }

interface TripStop {
  id: string; order: number; type: string; campgroundId?: string;
  customName?: string; address?: string; notes?: string; siteNumber?: string;
  cost?: number; confirmed: boolean;
  campground?: { id: string; name: string; location: string; state: string };
}
interface TripDay { id: string; dayNumber: number; date?: string; type: string; notes?: string; stops: TripStop[]; }
interface Trip { id: string; title: string; description?: string; startDate?: string; endDate?: string; status: string; days: TripDay[]; }

export default function TripItineraryTab({ eventId, eventTitle, homeLocation, campground }: { 
  eventId: string; 
  eventTitle?: string; 
  homeLocation?: string;
  campground?: { id: string; name: string; location?: string; state?: string; latitude?: number; longitude?: number } | null;
}) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [showAI, setShowAI] = useState(false);
  const campgroundDestination = campground ? `${campground.name}, ${campground.location || ''}, ${campground.state || ''}`.trim().replace(/,\s*$/, '') : '';
  const [aiForm, setAiForm] = useState({ 
    startLocation: homeLocation || '', 
    destination: campgroundDestination, 
    nights: 3, 
    rvType: 'Class A Motorhome', 
    avoidHighways: false 
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/itinerary');
      setAllTrips(data);
      if (data.length > 0) setTrip(data[0]);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (homeLocation) setAiForm(f => ({ ...f, startLocation: homeLocation }));
  }, [homeLocation]);

  useEffect(() => {
    if (campground) {
      const dest = `${campground.name}, ${campground.location || ''}, ${campground.state || ''}`.trim().replace(/,\s*$/, '');
      setAiForm(f => ({ ...f, destination: dest }));
    }
  }, [campground]);

  useEffect(() => {
    if (homeLocation) setAiForm(f => ({ ...f, startLocation: homeLocation }));
  }, [homeLocation]);

  useEffect(() => {
    if (campground) {
      const dest = `${campground.name}, ${campground.location || ''}, ${campground.state || ''}`.trim().replace(/,\s*$/, '');
      setAiForm(f => ({ ...f, destination: dest }));
    }
  }, [campground]);

  const createBlank = async () => {
    try {
      const { data } = await api.post('/itinerary', { title: eventTitle ? `Itinerary for ${eventTitle}` : 'My Trip Itinerary', status: 'PLANNING', visibility: 'PRIVATE' });
      setAllTrips(t => [data, ...t]);
      setTrip(data);
    } catch (e) { console.error(e); }
  };

  const generateAI = async () => {
    setAiLoading(true); setAiError('');
    try {
      const { data: suggestion } = await api.post('/itinerary-ai/suggest', aiForm);
      const { data: newTrip } = await api.post('/itinerary-ai/create-from-suggestion', {
        title: eventTitle ? `Itinerary for ${eventTitle}` : suggestion.title,
        suggestion
      });
      setAllTrips(t => [newTrip, ...t]);
      setTrip(newTrip);
      setShowAI(false);
    } catch (e) { setAiError('Failed to generate. Try again.'); }
    setAiLoading(false);
  };

  const addDay = async () => {
    if (!trip) return;
    try {
      const { data } = await api.post(`/itinerary/${trip.id}/days`, { dayNumber: trip.days.length + 1, type: 'TRAVEL' });
      setTrip(t => t ? { ...t, days: [...t.days, data] } : t);
    } catch (e) { console.error(e); }
  };

  const deleteDay = async (dayId: string) => {
    if (!trip) return;
    try {
      await api.delete(`/itinerary/${trip.id}/days/${dayId}`);
      setTrip(t => t ? { ...t, days: t.days.filter(d => d.id !== dayId).map((d, i) => ({ ...d, dayNumber: i + 1 })) } : t);
    } catch (e) { console.error(e); }
  };

  const addStop = async (dayId: string, type: string) => {
    if (!trip) return;
    try {
      const day = trip.days.find(d => d.id === dayId);
      const { data } = await api.post(`/itinerary/${trip.id}/days/${dayId}/stops`, { type, order: day?.stops.length || 0, confirmed: false });
      setTrip(t => t ? { ...t, days: t.days.map(d => d.id === dayId ? { ...d, stops: [...d.stops, data] } : d) } : t);
    } catch (e) { console.error(e); }
  };

  const deleteStop = async (dayId: string, stopId: string) => {
    if (!trip) return;
    try {
      await api.delete(`/itinerary/${trip.id}/days/${dayId}/stops/${stopId}`);
      setTrip(t => t ? { ...t, days: t.days.map(d => d.id === dayId ? { ...d, stops: d.stops.filter(s => s.id !== stopId) } : d) } : t);
    } catch (e) { console.error(e); }
  };

  const toggleConfirmed = async (dayId: string, stop: TripStop) => {
    if (!trip) return;
    try {
      const { data } = await api.put(`/itinerary/${trip.id}/days/${dayId}/stops/${stop.id}`, { ...stop, confirmed: !stop.confirmed });
      setTrip(t => t ? { ...t, days: t.days.map(d => d.id === dayId ? { ...d, stops: d.stops.map(s => s.id === stop.id ? data : s) } : d) } : t);
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader className="w-6 h-6 animate-spin text-primary-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-gray-800">🗺️ Trip Itinerary</h3>
          <p className="text-sm text-gray-500">Plan your stops, overnight stays, and driving days</p>
        </div>
        <div className="flex gap-2">
          {allTrips.length > 1 && (
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={trip?.id || ''} onChange={e => setTrip(allTrips.find(t => t.id === e.target.value) || null)}>
              {allTrips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          )}
          <button onClick={() => setShowAI(!showAI)}
            className="bg-gradient-to-r from-primary-500 to-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-primary-600 hover:to-blue-600 flex items-center gap-1">
            ✨ AI Plan
          </button>
          <button onClick={createBlank}
            className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Blank
          </button>
        </div>
      </div>

      {showAI && (
        <div className="bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 rounded-2xl p-4 space-y-3">
          <h4 className="font-semibold text-gray-700">✨ AI Itinerary Generator</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="Starting from (City, State) *"
              value={aiForm.startLocation} onChange={e => setAiForm(f => ({ ...f, startLocation: e.target.value }))} />
            <input className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="Destination campground or city"
              value={aiForm.destination} onChange={e => setAiForm(f => ({ ...f, destination: e.target.value }))} />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Nights:</span>
              <input type="range" min={1} max={21} value={aiForm.nights} className="w-32 accent-primary-500"
                onChange={e => setAiForm(f => ({ ...f, nights: parseInt(e.target.value) }))} />
              <span className="text-sm font-bold text-primary-600 w-12">{aiForm.nights} 🌙</span>
            </div>
            <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
              value={aiForm.rvType} onChange={e => setAiForm(f => ({ ...f, rvType: e.target.value }))}>
              {['Class A Motorhome', 'Class B Van', 'Class C Motorhome', 'Fifth Wheel', 'Travel Trailer', 'Pop-Up Camper'].map(t => <option key={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={aiForm.avoidHighways} className="accent-primary-500"
                onChange={e => setAiForm(f => ({ ...f, avoidHighways: e.target.checked }))} />
              Scenic routes
            </label>
          </div>
          {aiError && <p className="text-sm text-red-500">{aiError}</p>}
          <div className="flex gap-2">
            <button onClick={generateAI} disabled={aiLoading || !aiForm.startLocation}
              className="bg-primary-500 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2">
              {aiLoading ? <><Loader className="w-4 h-4 animate-spin" /> Generating...</> : <>✨ Generate Itinerary</>}
            </button>
            <button onClick={() => setShowAI(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-white">Cancel</button>
          </div>
        </div>
      )}

      {!trip && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <div className="text-4xl mb-3">🚐</div>
          <h3 className="font-semibold text-gray-700 mb-1">No itinerary yet</h3>
          <p className="text-sm text-gray-400 mb-4">Use AI to plan your route, or start from scratch</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => setShowAI(true)} className="bg-primary-500 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-primary-600">✨ AI Plan My Route</button>
            <button onClick={createBlank} className="border border-gray-200 text-gray-600 px-5 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">Start Blank</button>
          </div>
        </div>
      )}

      {trip && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">{trip.title} · {trip.days.length} days · {trip.days.reduce((a, d) => a + d.stops.length, 0)} stops</p>
          </div>
          {trip.days.map(day => {
            const dt = getDayType(day.type);
            return (
              <div key={day.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">{day.dayNumber}</div>
                  <span className="text-sm font-semibold text-gray-700">{dt.icon} {dt.label}</span>
                  {day.date && <span className="text-xs text-gray-400">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  {day.notes && <span className="text-xs text-gray-400 italic truncate flex-1">— {day.notes}</span>}
                  <button onClick={() => deleteDay(day.id)} className="ml-auto p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  {day.stops.map(stop => {
                    const st = getStopType(stop.type);
                    return (
                      <div key={stop.id} className={`flex items-start gap-2 p-2.5 rounded-xl border ${stop.confirmed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                        <button onClick={() => toggleConfirmed(day.id, stop)}
                          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${stop.confirmed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                          {stop.confirmed && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${st.color}`}>{st.icon} {st.label}</span>
                            {stop.siteNumber && <span className="text-xs text-gray-400">Site {stop.siteNumber}</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-700 truncate mt-0.5">{stop.campground?.name || stop.customName || 'Unnamed stop'}</p>
                          {stop.address && <p className="text-xs text-gray-400 truncate">{stop.address}</p>}
                          {stop.notes && <p className="text-xs text-gray-400 italic truncate">{stop.notes}</p>}
                        </div>
                        <button onClick={() => deleteStop(day.id, stop.id)} className="p-1 text-gray-300 hover:text-red-400 rounded-lg">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {STOP_TYPES.slice(0, 5).map(st => (
                      <button key={st.value} onClick={() => addStop(day.id, st.value)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium border hover:ring-2 hover:ring-primary-300 transition-all ${st.color}`}>
                        {st.icon} {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <button onClick={addDay}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-all flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Day
          </button>
        </div>
      )}
    </div>
  );
}
