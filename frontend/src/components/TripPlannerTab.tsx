import { useState, useEffect } from 'react';
import api from '../services/api';
import { Navigation, Plus, Trash2, Check, X, Loader, Edit2, ExternalLink, AlertCircle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface PitStop { id: string; name: string; stopType: string; location?: string; estimatedDuration?: number; notes?: string; }
interface TripPlan {
  id: string; startLocation: string; endLocation: string; distanceMiles?: number;
  durationMinutes?: number; arrivalDate?: string; status: string; isDriving: boolean;
  useHometown: boolean; routePreference: string; endLatitude?: number; endLongitude?: number;
  pitStops?: PitStop[];
}
interface TripStop { id: string; order: number; type: string; campgroundId?: string; customName?: string; address?: string; notes?: string; confirmed: boolean; latitude?: number; longitude?: number; campground?: { id: string; name: string; location: string; state: string; }; }
interface TripDay { id: string; dayNumber: number; date?: string; type: string; notes?: string; stops: TripStop[]; }
interface Trip { id: string; title: string; startDate?: string; days: TripDay[]; }

const STOP_TYPES = [
  { value: 'OVERNIGHT', label: 'Overnight', icon: '🏕️', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'FUEL', label: 'Fuel', icon: '⛽', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'FOOD', label: 'Food', icon: '🍔', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'ATTRACTION', label: 'Attraction', icon: '⭐', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'WAYPOINT', label: 'Waypoint', icon: '📍', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'BOONDOCK', label: 'Boondock', icon: '🌲', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'WALMART', label: 'Walmart', icon: '🛒', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'DUMP', label: 'Dump Station', icon: '🚰', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'REST', label: 'Rest Area', icon: '😴', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
];

const DAY_TYPES = [
  { value: 'TRAVEL', label: 'Travel Day', icon: '🚗' },
  { value: 'STAY', label: 'Stay Day', icon: '🏕️' },
  { value: 'REST', label: 'Rest Day', icon: '😴' },
  { value: 'ARRIVAL', label: 'Arrival', icon: '🎉' },
  { value: 'DEPARTURE', label: 'Departure', icon: '👋' },
];

function getStop(type: string) { return STOP_TYPES.find(t => t.value === type) || STOP_TYPES[4]; }
function getDay(type: string) { return DAY_TYPES.find(t => t.value === type) || DAY_TYPES[0]; }
function fmtDuration(mins: number) { const h = Math.floor(mins/60); const m = mins%60; return m > 0 ? `${h}h ${m}m` : `${h}h`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}); }
function rvParkyUrl(lat?: number|null, lng?: number|null, name?: string) {
  if (lat && lng) return `https://www.rvparky.com/?lat=${lat}&lng=${lng}&zoom=10`;
  return `https://www.rvparky.com/search?q=${encodeURIComponent(name||'')}`;
}

const RV_TYPES = ['Class A Motorhome','Class B Van','Class C Motorhome','Fifth Wheel','Travel Trailer','Pop-Up Camper','Truck Camper'];
const DEP_TIMES = ['6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM'];

export default function TripPlannerTab({ eventId, eventTitle, homeLocation, campground, arrivalDate, tripPlan, tripLoading, onEditTrip, onReload }: {
  eventId: string; eventTitle?: string; homeLocation?: string; arrivalDate?: string;
  campground?: { id: string; name: string; location?: string; state?: string; latitude?: number; longitude?: number } | null;
  tripPlan?: TripPlan | null; tripLoading?: boolean; onEditTrip: () => void; onReload: () => void;
}) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingItinerary, setLoadingItinerary] = useState(true);
  const [showHitch, setShowHitch] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [editingFrom, setEditingFrom] = useState(false);
  const [editFromValue, setEditFromValue] = useState('');

  const campDest = campground ? `${campground.name}, ${campground.location||''}, ${campground.state||''}`.replace(/,\s*,/g,',').trim().replace(/,\s*$/,'') : '';

  const [aiForm, setAiForm] = useState({
    startLocation: homeLocation||'', destination: campDest, nights: 3,
    rvType: 'Class A Motorhome', avoidHighways: false,
    drivingLimitType: 'hours' as 'hours'|'miles', hoursPerDay: 6, milesPerDay: 300,
    departureTime: '8:00 AM', arrivalDate: arrivalDate||'',
  });

  useEffect(() => { if (homeLocation) setAiForm(f=>({...f,startLocation:homeLocation})); }, [homeLocation]);
  useEffect(() => { if (campground) setAiForm(f=>({...f,destination:campDest})); }, [campground]);
  useEffect(() => { if (arrivalDate) setAiForm(f=>({...f,arrivalDate})); }, [arrivalDate]);

  useEffect(() => {
    api.get('/itinerary').then(({data}) => { if (data.length>0) setTrip(data[0]); }).catch(()=>{}).finally(()=>setLoadingItinerary(false));
  }, []);

  const generateAI = async () => {
    setAiLoading(true); setAiError('');
    try {
      const { data: suggestion } = await api.post('/itinerary-ai/suggest', {
        ...aiForm,
        hoursPerDay: aiForm.drivingLimitType==='hours' ? aiForm.hoursPerDay : null,
        milesPerDay: aiForm.drivingLimitType==='miles' ? aiForm.milesPerDay : null,
      });
      const { data: newTrip } = await api.post('/itinerary-ai/create-from-suggestion', {
        title: eventTitle ? `Itinerary for ${eventTitle}` : suggestion.title, suggestion,
      });
      setTrip(newTrip);
      setShowHitch(false);
    } catch (e) { setAiError('Failed to generate. Try again.'); }
    setAiLoading(false);
  };

  const addDay = async () => {
    if (!trip) return;
    try {
      const { data } = await api.post(`/itinerary/${trip.id}/days`, { dayNumber: trip.days.length+1, type: 'TRAVEL' });
      setTrip(t => t ? {...t, days:[...t.days,data]} : t);
    } catch(e) {}
  };

  const deleteDay = async (dayId: string) => {
    if (!trip) return;
    try {
      await api.delete(`/itinerary/${trip.id}/days/${dayId}`);
      setTrip(t => t ? {...t, days:t.days.filter(d=>d.id!==dayId).map((d,i)=>({...d,dayNumber:i+1}))} : t);
    } catch(e) {}
  };

  const addStop = async (dayId: string, type: string) => {
    if (!trip) return;
    try {
      const day = trip.days.find(d=>d.id===dayId);
      const { data } = await api.post(`/itinerary/${trip.id}/days/${dayId}/stops`, { type, order: day?.stops.length||0, confirmed: false });
      setTrip(t => t ? {...t, days:t.days.map(d=>d.id===dayId?{...d,stops:[...d.stops,data]}:d)} : t);
    } catch(e) {}
  };

  const deleteStop = async (dayId: string, stopId: string) => {
    if (!trip) return;
    try {
      await api.delete(`/itinerary/${trip.id}/days/${dayId}/stops/${stopId}`);
      setTrip(t => t ? {...t, days:t.days.map(d=>d.id===dayId?{...d,stops:d.stops.filter(s=>s.id!==stopId)}:d)} : t);
    } catch(e) {}
  };

  const toggleConfirmed = async (dayId: string, stop: TripStop) => {
    if (!trip) return;
    try {
      const { data } = await api.put(`/itinerary/${trip.id}/days/${dayId}/stops/${stop.id}`, {...stop, confirmed:!stop.confirmed});
      setTrip(t => t ? {...t, days:t.days.map(d=>d.id===dayId?{...d,stops:d.stops.map(s=>s.id===stop.id?data:s)}:d)} : t);
    } catch(e) {}
  };

  const saveFrom = async () => {
    if (!tripPlan || !editFromValue.trim()) return;
    try {
      await api.put(`/trip-planner/event/${eventId}/from`, { startLocation: editFromValue.trim() });
      setEditingFrom(false);
      onReload();
    } catch(e) {}
  };

  if (tripLoading) return <div className="flex justify-center py-12"><Loader className="w-6 h-6 animate-spin text-primary-400" /></div>;

  return (
    <div className="space-y-4">

      {/* ── Route Summary ────────────────────────────────────────── */}
      {tripPlan ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Route bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100 flex-wrap">
            {/* From */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-gray-400 flex-shrink-0">From</span>
              {editingFrom ? (
                <div className="flex items-center gap-1">
                  <input autoFocus value={editFromValue} onChange={e=>setEditFromValue(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')saveFrom();if(e.key==='Escape')setEditingFrom(false);}}
                    className="border border-primary-300 rounded-lg px-2 py-1 text-sm w-44 focus:outline-none focus:border-primary-500" />
                  <button onClick={saveFrom} className="text-primary-600 hover:text-primary-700 p-1"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={()=>setEditingFrom(false)} className="text-gray-400 p-1"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button onClick={()=>{setEditFromValue(tripPlan.startLocation||'');setEditingFrom(true);}}
                  className="text-sm font-semibold text-gray-800 hover:text-primary-600 flex items-center gap-1 group">
                  {tripPlan.startLocation||'Set start'}
                  <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-primary-400" />
                </button>
              )}
            </div>

            <span className="text-gray-300 text-lg">→</span>

            {/* To */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-xs text-gray-400 flex-shrink-0">To</span>
              <span className="text-sm font-semibold text-gray-800 truncate">{tripPlan.endLocation||campDest||'Destination'}</span>
            </div>

            {/* Distance */}
            {tripPlan.distanceMiles && (
              <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                <span className="text-sm font-bold text-primary-600">{tripPlan.distanceMiles} mi</span>
                {tripPlan.durationMinutes && <span className="text-xs text-gray-400">{fmtDuration(tripPlan.durationMinutes)}</span>}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {tripPlan.arrivalDate && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                  🗓 {fmtDate(tripPlan.arrivalDate)}
                </span>
              )}
              {tripPlan.endLatitude && tripPlan.endLongitude && (
                <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(tripPlan.startLocation)}&destination=${tripPlan.endLatitude},${tripPlan.endLongitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg hover:bg-primary-600">
                  <Navigation className="w-3.5 h-3.5" /> Maps
                </a>
              )}
              <button onClick={onEditTrip} className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          </div>

          {/* Hitch AI banner */}
          <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors ${showHitch ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
            onClick={() => setShowHitch(v=>!v)}>
            <img src="/hitch.png" alt="Hitch" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">Ask Hitch to plan my route</p>
              <p className="text-xs text-gray-400">AI-powered day-by-day itinerary with overnight stops</p>
            </div>
            <div className={`relative w-10 h-5 rounded-full transition-colors ${showHitch ? 'bg-primary-500' : 'bg-gray-200'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showHitch ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Hitch AI form */}
          {showHitch && (
            <div className="p-4 bg-primary-50 border-b border-primary-100 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Starting From</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary-400"
                    value={aiForm.startLocation} onChange={e=>setAiForm(f=>({...f,startLocation:e.target.value}))} placeholder="City, State" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Destination</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary-400"
                    value={aiForm.destination} onChange={e=>setAiForm(f=>({...f,destination:e.target.value}))} placeholder="Campground or City, State" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Nights 🌙</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={1} max={21} value={aiForm.nights} className="flex-1 accent-primary-500"
                      onChange={e=>setAiForm(f=>({...f,nights:parseInt(e.target.value)}))} />
                    <span className="text-sm font-bold text-primary-600 w-8">{aiForm.nights}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Drive limit / day</label>
                  <div className="flex gap-1">
                    <button onClick={()=>setAiForm(f=>({...f,drivingLimitType:'hours'}))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${aiForm.drivingLimitType==='hours'?'bg-primary-500 text-white border-primary-500':'bg-white text-gray-500 border-gray-200'}`}>
                      ⏰ {aiForm.hoursPerDay}h
                    </button>
                    <button onClick={()=>setAiForm(f=>({...f,drivingLimitType:'miles'}))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${aiForm.drivingLimitType==='miles'?'bg-primary-500 text-white border-primary-500':'bg-white text-gray-500 border-gray-200'}`}>
                      📏 {aiForm.milesPerDay}mi
                    </button>
                  </div>
                  {aiForm.drivingLimitType==='hours' ? (
                    <input type="range" min={2} max={12} value={aiForm.hoursPerDay} className="w-full accent-primary-500 mt-1"
                      onChange={e=>setAiForm(f=>({...f,hoursPerDay:parseInt(e.target.value)}))} />
                  ) : (
                    <input type="range" min={50} max={600} step={25} value={aiForm.milesPerDay} className="w-full accent-primary-500 mt-1"
                      onChange={e=>setAiForm(f=>({...f,milesPerDay:parseInt(e.target.value)}))} />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Depart each morning</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                    value={aiForm.departureTime} onChange={e=>setAiForm(f=>({...f,departureTime:e.target.value}))}>
                    {DEP_TIMES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                  value={aiForm.rvType} onChange={e=>setAiForm(f=>({...f,rvType:e.target.value}))}>
                  {RV_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={aiForm.avoidHighways} className="accent-primary-500"
                    onChange={e=>setAiForm(f=>({...f,avoidHighways:e.target.checked}))} /> Scenic routes
                </label>
                <div className="ml-auto">
                  {aiError && <p className="text-xs text-red-500 mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{aiError}</p>}
                  <button onClick={generateAI} disabled={aiLoading||!aiForm.startLocation}
                    className="bg-primary-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2">
                    {aiLoading ? <><Loader className="w-4 h-4 animate-spin"/>Planning... (15-20s)</> : <><img src="/hitch.png" className="w-4 h-4 rounded-full"/>Generate Itinerary</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pit stops */}
          {tripPlan.pitStops && tripPlan.pitStops.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pit Stops</p>
              <div className="space-y-1.5">
                {tripPlan.pitStops.map((stop: PitStop) => (
                  <div key={stop.id} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                    <span>{stop.stopType === 'FUEL' ? '⛽' : stop.stopType === 'FOOD' ? '🍔' : stop.stopType === 'REST' ? '😴' : '📍'}</span>
                    <span className="font-medium flex-1">{stop.name}</span>
                    {stop.location && <span className="text-xs text-gray-400">{stop.location}</span>}
                    {stop.estimatedDuration && <span className="text-xs text-gray-400">{stop.estimatedDuration}min</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No trip yet */
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <img src="/hitch.png" alt="Hitch" className="w-16 h-16 rounded-full object-cover mx-auto mb-3" />
          <h3 className="font-bold text-gray-800 mb-1">Plan your drive to {eventTitle || 'this event'}</h3>
          <p className="text-sm text-gray-400 mb-4">Hitch will plan your route, overnight stops, fuel stops, and more</p>
          <button onClick={onEditTrip} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600">
            Get Started
          </button>
        </div>
      )}

      {/* ── Day-by-Day Itinerary ──────────────────────────────────── */}
      {(trip || loadingItinerary) && (
        <div className="space-y-2">
          {loadingItinerary ? (
            <div className="flex justify-center py-4"><Loader className="w-5 h-5 animate-spin text-primary-300" /></div>
          ) : trip && (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-gray-700">📅 {trip.title}</p>
                {trip.startDate && <span className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">Departs {fmtDate(trip.startDate)}</span>}
              </div>

              {trip.days.map(day => {
                const dt = getDay(day.type);
                return (
                  <div key={day.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{day.dayNumber}</span>
                      <span className="text-sm font-semibold text-gray-700">{dt.icon} {dt.label}</span>
                      {day.date && <span className="text-xs text-gray-400">{fmtDate(day.date)}</span>}
                      {day.notes && <span className="text-xs text-gray-400 italic truncate flex-1">— {day.notes}</span>}
                      <button onClick={()=>deleteDay(day.id)} className="ml-auto p-1 text-gray-300 hover:text-red-400 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {day.stops.map(stop => {
                        const st = getStop(stop.type);
                        const lat = stop.campground?.latitude || stop.latitude;
                        const lng = stop.campground?.longitude || stop.longitude;
                        const name = stop.campground?.name || stop.customName;
                        return (
                          <div key={stop.id} className={`flex items-start gap-2 p-2.5 rounded-xl border transition-all ${stop.confirmed?'bg-green-50 border-green-200':'bg-white border-gray-100'}`}>
                            <button onClick={()=>toggleConfirmed(day.id,stop)}
                              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${stop.confirmed?'bg-green-500 border-green-500':'border-gray-300 hover:border-green-400'}`}>
                              {stop.confirmed && <Check className="w-2.5 h-2.5 text-white" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${st.color}`}>{st.icon} {st.label}</span>
                                {stop.campgroundId && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">✓ RVUnicorn</span>}
                              </div>
                              <p className="text-sm font-medium text-gray-700 truncate mt-0.5">{name||'Unnamed stop'}</p>
                              {stop.address && <p className="text-xs text-gray-400 truncate">{stop.address}</p>}
                              {stop.notes && <p className="text-xs text-gray-400 italic mt-0.5 line-clamp-2">{stop.notes}</p>}
                              {stop.type==='OVERNIGHT' && (
                                <a href={rvParkyUrl(lat,lng,name)} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition-all">
                                  <ExternalLink className="w-2.5 h-2.5"/> RV Parks nearby
                                </a>
                              )}
                            </div>
                            <button onClick={()=>deleteStop(day.id,stop.id)} className="p-1 text-gray-300 hover:text-red-400 rounded-lg flex-shrink-0">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {STOP_TYPES.slice(0,5).map(st=>(
                          <button key={st.value} onClick={()=>addStop(day.id,st.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium border hover:ring-1 hover:ring-primary-300 transition-all ${st.color}`}>
                            {st.icon} {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button onClick={addDay}
                className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4"/> Add Day
              </button>
            </>
          )}
        </div>
      )}

      {!trip && !loadingItinerary && tripPlan && (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-sm text-gray-400 mb-3">No day-by-day itinerary yet</p>
          <button onClick={()=>setShowHitch(true)}
            className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600">
            <img src="/hitch.png" className="w-4 h-4 rounded-full"/> Ask Hitch to plan it
          </button>
        </div>
      )}
    </div>
  );
}
