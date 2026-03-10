import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Plus, Trash2, Check, X, Loader, ExternalLink, AlertCircle } from 'lucide-react';

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

function getStopType(type: string) { return STOP_TYPES.find(t => t.value === type) || STOP_TYPES[4]; }
function getDayType(type: string) { return DAY_TYPES.find(t => t.value === type) || DAY_TYPES[0]; }

function rvParkyUrl(lat?: number | null, lng?: number | null, name?: string) {
  if (lat && lng) return `https://www.rvparky.com/?lat=${lat}&lng=${lng}&zoom=10`;
  if (name) return `https://www.rvparky.com/search?q=${encodeURIComponent(name)}`;
  return 'https://www.rvparky.com';
}

interface TripStop {
  id: string; order: number; type: string; campgroundId?: string;
  customName?: string; address?: string; notes?: string; siteNumber?: string;
  cost?: number; confirmed: boolean; latitude?: number; longitude?: number;
  campground?: { id: string; name: string; location: string; state: string; latitude?: number; longitude?: number };
}
interface TripDay {
  id: string; dayNumber: number; date?: string; type: string; notes?: string;
  stops: TripStop[];
}
interface Trip {
  id: string; title: string; description?: string; startDate?: string;
  endDate?: string; status: string; days: TripDay[];
}

interface AISuggestion {
  title: string; description: string; recommendedDepartureDate?: string;
  recommendedDepartureTime?: string; totalDrivingDays?: number; totalMiles?: number;
  notes?: string; days: any[];
}

export default function TripItineraryTab({ eventId, eventTitle, homeLocation, campground, arrivalDate }: {
  eventId: string;
  eventTitle?: string;
  homeLocation?: string;
  arrivalDate?: string;
  campground?: { id: string; name: string; location?: string; state?: string; latitude?: number; longitude?: number } | null;
}) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [addingStopToDay, setAddingStopToDay] = useState<string | null>(null);

  const campgroundDestination = campground
    ? `${campground.name}, ${campground.location || ''}, ${campground.state || ''}`.replace(/,\s*,/g, ',').trim().replace(/,\s*$/, '')
    : '';

  const [aiForm, setAiForm] = useState({
    startLocation: homeLocation || '',
    destination: campgroundDestination,
    nights: 3,
    rvType: 'Class A Motorhome',
    avoidHighways: false,
    drivingLimitType: 'hours' as 'hours' | 'miles',
    hoursPerDay: 6,
    milesPerDay: 300,
    departureTime: '8:00 AM',
    arrivalDate: arrivalDate || '',
  });

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
    if (campground) setAiForm(f => ({ ...f, destination: campgroundDestination }));
  }, [campground]);

  useEffect(() => {
    if (arrivalDate) setAiForm(f => ({ ...f, arrivalDate }));
  }, [arrivalDate]);

  const generateAI = async () => {
    setAiLoading(true); setAiError(''); setSuggestion(null);
    try {
      const payload = {
        startLocation: aiForm.startLocation,
        destination: aiForm.destination,
        nights: aiForm.nights,
        rvType: aiForm.rvType,
        avoidHighways: aiForm.avoidHighways,
        hoursPerDay: aiForm.drivingLimitType === 'hours' ? aiForm.hoursPerDay : null,
        milesPerDay: aiForm.drivingLimitType === 'miles' ? aiForm.milesPerDay : null,
        departureTime: aiForm.departureTime,
        arrivalDate: aiForm.arrivalDate || null,
      };
      const { data } = await api.post('/itinerary-ai/suggest', payload);
      setSuggestion(data);
    } catch (e) { setAiError('Failed to generate. Try again.'); }
    setAiLoading(false);
  };

  const saveAISuggestion = async () => {
    if (!suggestion) return;
    setAiLoading(true);
    try {
      const { data: newTrip } = await api.post('/itinerary-ai/create-from-suggestion', {
        title: eventTitle ? `Itinerary for ${eventTitle}` : suggestion.title,
        suggestion,
      });
      setAllTrips(t => [newTrip, ...t]);
      setTrip(newTrip);
      setShowAI(false);
      setSuggestion(null);
    } catch (e) { setAiError('Failed to save. Try again.'); }
    setAiLoading(false);
  };

  const createBlank = async () => {
    try {
      const { data } = await api.post('/itinerary', {
        title: eventTitle ? `Itinerary for ${eventTitle}` : 'My Trip Itinerary',
        status: 'PLANNING', visibility: 'PRIVATE'
      });
      setAllTrips(t => [data, ...t]);
      setTrip(data);
    } catch (e) { console.error(e); }
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
    setAddingStopToDay(dayId);
    try {
      const day = trip.days.find(d => d.id === dayId);
      const { data } = await api.post(`/itinerary/${trip.id}/days/${dayId}/stops`, {
        type, order: day?.stops.length || 0, confirmed: false
      });
      setTrip(t => t ? { ...t, days: t.days.map(d => d.id === dayId ? { ...d, stops: [...d.stops, data] } : d) } : t);
    } catch (e) { console.error(e); }
    setAddingStopToDay(null);
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

  const RV_TYPES = ['Class A Motorhome', 'Class B Van', 'Class C Motorhome', 'Fifth Wheel', 'Travel Trailer', 'Pop-Up Camper', 'Truck Camper'];
  const DEPARTURE_TIMES = ['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM'];

  if (loading) return <div className="flex items-center justify-center py-12"><Loader className="w-6 h-6 animate-spin text-primary-400" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-gray-800">🗺️ Trip Itinerary</h3>
          <p className="text-sm text-gray-500">AI-planned day-by-day route with overnight stops</p>
        </div>
        <div className="flex items-center gap-3">
          {allTrips.length > 1 && (
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={trip?.id || ''} onChange={e => setTrip(allTrips.find(t => t.id === e.target.value) || null)}>
              {allTrips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          )}
          <button onClick={createBlank}
            className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Blank
          </button>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm font-medium text-gray-600">✨ AI Plan</span>
            <div onClick={() => { setShowAI(!showAI); setSuggestion(null); }}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${showAI ? 'bg-primary-500' : 'bg-gray-200'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${showAI ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </label>
        </div>
      </div>

      {/* AI Generator */}
      {showAI && (
        <div className="bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 rounded-2xl p-5 space-y-4">
          <div>
            <h4 className="font-bold text-gray-800 text-base">✨ AI Route Planner</h4>
            <p className="text-xs text-gray-500 mt-0.5">Tell us your driving limits and we'll plan the whole trip</p>
          </div>

          {/* From / To */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Starting From *</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary-400"
                placeholder="City, State"
                value={aiForm.startLocation} onChange={e => setAiForm(f => ({ ...f, startLocation: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Destination</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary-400"
                placeholder="Campground or City, State"
                value={aiForm.destination} onChange={e => setAiForm(f => ({ ...f, destination: e.target.value }))} />
            </div>
          </div>

          {/* Arrival date + nights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Must Arrive By</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary-400"
                value={aiForm.arrivalDate} onChange={e => setAiForm(f => ({ ...f, arrivalDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Number of Nights 🌙</label>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={21} value={aiForm.nights}
                  onChange={e => setAiForm(f => ({ ...f, nights: parseInt(e.target.value) }))}
                  className="flex-1 accent-primary-500" />
                <span className="w-16 text-center font-bold text-primary-600">{aiForm.nights} {aiForm.nights === 1 ? 'night' : 'nights'}</span>
              </div>
            </div>
          </div>

          {/* Driving limits */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">🚐 How far do you want to drive each day?</span>
              <div className="flex gap-1 ml-auto">
                <button onClick={() => setAiForm(f => ({ ...f, drivingLimitType: 'hours' }))}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${aiForm.drivingLimitType === 'hours' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  ⏰ Hours
                </button>
                <button onClick={() => setAiForm(f => ({ ...f, drivingLimitType: 'miles' }))}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${aiForm.drivingLimitType === 'miles' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  📏 Miles
                </button>
              </div>
            </div>

            {aiForm.drivingLimitType === 'hours' ? (
              <div className="flex items-center gap-3">
                <input type="range" min={2} max={12} value={aiForm.hoursPerDay}
                  onChange={e => setAiForm(f => ({ ...f, hoursPerDay: parseInt(e.target.value) }))}
                  className="flex-1 accent-primary-500" />
                <span className="w-24 text-center font-bold text-primary-600 text-sm">{aiForm.hoursPerDay} hrs/day</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <input type="range" min={50} max={600} step={25} value={aiForm.milesPerDay}
                  onChange={e => setAiForm(f => ({ ...f, milesPerDay: parseInt(e.target.value) }))}
                  className="flex-1 accent-primary-500" />
                <span className="w-24 text-center font-bold text-primary-600 text-sm">{aiForm.milesPerDay} mi/day</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-600">Preferred departure time each morning:</span>
              <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm ml-auto"
                value={aiForm.departureTime} onChange={e => setAiForm(f => ({ ...f, departureTime: e.target.value }))}>
                {DEPARTURE_TIMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* RV type + scenic */}
          <div className="flex flex-wrap gap-3 items-center">
            <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white flex-1"
              value={aiForm.rvType} onChange={e => setAiForm(f => ({ ...f, rvType: e.target.value }))}>
              {RV_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={aiForm.avoidHighways} className="accent-primary-500"
                onChange={e => setAiForm(f => ({ ...f, avoidHighways: e.target.checked }))} />
              Prefer scenic routes
            </label>
          </div>

          {aiError && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{aiError}</p>}

          {/* AI Preview */}
          {suggestion && (
            <div className="bg-white rounded-xl border border-green-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h5 className="font-bold text-gray-800">{suggestion.title}</h5>
                  <p className="text-xs text-gray-500 mt-0.5">{suggestion.description}</p>
                </div>
                <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-lg whitespace-nowrap">✓ Ready</span>
              </div>

              {/* Departure recommendation */}
              {suggestion.recommendedDepartureDate && (
                <div className="bg-primary-50 rounded-lg p-3 flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-sm font-semibold text-primary-800">
                      Leave on {new Date(suggestion.recommendedDepartureDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {suggestion.recommendedDepartureTime || '8:00 AM'}
                    </p>
                    <p className="text-xs text-primary-600">{suggestion.totalDrivingDays} driving days · {suggestion.totalMiles?.toLocaleString()} total miles</p>
                  </div>
                </div>
              )}

              {suggestion.notes && (
                <p className="text-xs text-gray-500 italic">{suggestion.notes}</p>
              )}

              {/* Day preview */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {suggestion.days?.map((day: any) => {
                  const dt = getDayType(day.type);
                  return (
                    <div key={day.dayNumber} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{day.dayNumber}</span>
                        <span className="text-sm font-semibold text-gray-700">{dt.icon} {dt.label}</span>
                        {day.estimatedMiles && <span className="text-xs text-gray-400 ml-auto">{day.estimatedMiles} mi · {day.estimatedDriveHours}h</span>}
                      </div>
                      <div className="space-y-1 ml-6">
                        {day.stops?.map((stop: any, i: number) => {
                          const st = getStopType(stop.type);
                          return (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <span className={`px-1.5 py-0.5 rounded border text-xs ${st.color}`}>{st.icon}</span>
                              <span className="truncate">{stop.customName}</span>
                              {stop.campgroundId && <span className="text-green-500 text-xs ml-auto flex-shrink-0">✓ db</span>}
                              {stop.type === 'OVERNIGHT' && (
                                <a href={rvParkyUrl(stop.latitude, stop.longitude, stop.customName)} target="_blank" rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-700 flex-shrink-0" title="Find RV parks nearby on RVParky">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={saveAISuggestion} disabled={aiLoading}
                  className="flex-1 bg-primary-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {aiLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save This Itinerary
                </button>
                <button onClick={generateAI} disabled={aiLoading}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-white">
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {!suggestion && (
            <button onClick={generateAI} disabled={aiLoading || !aiForm.startLocation}
              className="w-full bg-gradient-to-r from-primary-500 to-blue-500 text-white rounded-xl py-3 text-sm font-semibold hover:from-primary-600 hover:to-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
              {aiLoading
                ? <><Loader className="w-4 h-4 animate-spin" /> Planning your route... (15-20 sec)</>
                : <>✨ Generate My AI Itinerary</>}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!trip && !showAI && (
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

      {/* Itinerary days */}
      {trip && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">
              {trip.title} · {trip.days.length} {trip.days.length === 1 ? 'day' : 'days'} · {trip.days.reduce((a, d) => a + d.stops.length, 0)} stops
            </p>
            {trip.startDate && (
              <span className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-lg font-medium">
                📅 Departs {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          {trip.days.map(day => {
            const dt = getDayType(day.type);
            return (
              <div key={day.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{day.dayNumber}</div>
                  <span className="text-sm font-semibold text-gray-700">{dt.icon} {dt.label}</span>
                  {day.date && <span className="text-xs text-gray-400">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
                  {day.notes && <span className="text-xs text-gray-400 italic truncate flex-1">— {day.notes}</span>}
                  <button onClick={() => deleteDay(day.id)} className="ml-auto p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 space-y-2">
                  {day.stops.map(stop => {
                    const st = getStopType(stop.type);
                    const lat = stop.campground?.latitude || stop.latitude;
                    const lng = stop.campground?.longitude || stop.longitude;
                    const name = stop.campground?.name || stop.customName;
                    return (
                      <div key={stop.id} className={`flex items-start gap-2 p-3 rounded-xl border transition-all ${stop.confirmed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                        <button onClick={() => toggleConfirmed(day.id, stop)}
                          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${stop.confirmed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                          {stop.confirmed && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${st.color}`}>{st.icon} {st.label}</span>
                            {stop.campgroundId && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">✓ In RVUnicorn</span>}
                            {stop.siteNumber && <span className="text-xs text-gray-400">Site {stop.siteNumber}</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-700 truncate mt-0.5">{name || 'Unnamed stop'}</p>
                          {stop.address && <p className="text-xs text-gray-400 truncate">{stop.address}</p>}
                          {stop.notes && <p className="text-xs text-gray-400 italic mt-0.5">{stop.notes}</p>}

                          {/* RVParky link for overnight stops */}
                          {stop.type === 'OVERNIGHT' && (
                            <a href={rvParkyUrl(lat, lng, name)} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-all">
                              <ExternalLink className="w-3 h-3" /> Find RV Parks nearby on RVParky
                            </a>
                          )}
                        </div>
                        <button onClick={() => deleteStop(day.id, stop.id)} className="p-1 text-gray-300 hover:text-red-400 rounded-lg flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add stop buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-50">
                    {STOP_TYPES.map(st => (
                      <button key={st.value} onClick={() => addStop(day.id, st.value)}
                        disabled={addingStopToDay === day.id}
                        className={`px-2 py-1 rounded-lg text-xs font-medium border hover:ring-2 hover:ring-primary-300 transition-all disabled:opacity-50 ${st.color}`}>
                        {addingStopToDay === day.id ? '...' : `${st.icon} ${st.label}`}
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
