import { useState, useEffect } from 'react';
import api from '../services/api';
import { Navigation, Plus, Trash2, Check, X, Loader, Edit2, ExternalLink, AlertCircle } from 'lucide-react';
import FuelStopPrice from './FuelStopPrice';
import MultiStopTripPlanner from './MultiStopTripPlanner';

// ── Types ──────────────────────────────────────────────────────────────────
interface PitStop { id: string; name: string; stopType: string; location?: string; estimatedDuration?: number; notes?: string; }
interface TripPlan {
  id: string; startLocation: string; endLocation: string; distanceMiles?: number;
  durationMinutes?: number; arrivalDate?: string; status: string; isDriving: boolean;
  useHometown: boolean; routePreference: string; endLatitude?: number; endLongitude?: number;
  pitStops?: PitStop[];
}
interface TripStop { id: string; order: number; type: string; campgroundId?: string; customName?: string; address?: string; notes?: string; confirmed: boolean; latitude?: number; longitude?: number; campground?: { id: string; name: string; location: string; state: string; latitude?: number; longitude?: number; }; }
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
  tripPlan?: TripPlan | null; tripLoading?: boolean; onEditTrip: () => void; onReload: () => void; rvFuelType?: string;
}) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingItinerary, setLoadingItinerary] = useState(true);
  const [showHitch, setShowHitch] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [nearbyStop, setNearbyStop] = useState<{stop: TripStop; dayId: string; dist: number} | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [amendingStop, setAmendingStop] = useState<{stop: TripStop; dayId: string} | null>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [companions, setCompanions] = useState<any[]>([]);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const [recommendations, setRecommendations] = useState<{stopId: string; items: any[]; loading: boolean} | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [editingFrom, setEditingFrom] = useState(false);
  const [editFromValue, setEditFromValue] = useState('');

  const campDest = campground ? `${campground.name}, ${campground.location||''}, ${campground.state||''}`.replace(/,\s*,/g,',').trim().replace(/,\s*$/,'') : '';

  const [aiForm, setAiForm] = useState({
    startLocation: homeLocation||'', destination: campDest, nights: 3,
    rvType: 'Class A Motorhome', avoidHighways: false,
    drivingLimitType: 'hours' as 'hours'|'miles', hoursPerDay: 8, milesPerDay: 300,
    departureTime: '8:00 AM', arrivalDate: arrivalDate||'', returnDate: '',
    wantSightseeing: false,
    mealPref: 'balanced' as 'fast'|'balanced'|'sitdown',
    stopFrequency: 'few' as 'none'|'few'|'frequent',
  });

  useEffect(() => { if (homeLocation) setAiForm(f=>({...f,startLocation:homeLocation})); }, [homeLocation]);
  useEffect(() => { if (campground) setAiForm(f=>({...f,destination:campDest})); }, [campground]);
  useEffect(() => { if (arrivalDate) setAiForm(f=>({...f,arrivalDate})); }, [arrivalDate]);

  useEffect(() => {
    api.get('/itinerary').then(({data}) => { if (data.length>0) setTrip(data[0]); }).catch(()=>{}).finally(()=>setLoadingItinerary(false));
  }, []);

  // ── GPS Live Mode ────────────────────────────────────────────────────────
  const startLiveMode = () => {
    if (!navigator.geolocation) { alert('GPS not available on this device'); return; }
    setLiveMode(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        // Check proximity to upcoming unconfirmed stops
        if (!trip) return;
        for (const day of trip.days) {
          for (const stop of day.stops) {
            if (stop.confirmed) continue;
            const stopLat = stop.campground?.latitude || stop.latitude;
            const stopLng = stop.campground?.longitude || stop.longitude;
            if (!stopLat || !stopLng) continue;
            const dist = haversine(lat, lng, stopLat, stopLng);
            if (dist < 3) { // within 3 miles
              setNearbyStop({ stop, dayId: day.id, dist: Math.round(dist * 10) / 10 });
              return;
            }
          }
        }
        setNearbyStop(null);
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );
    setWatchId(id);
  };

  const stopLiveMode = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    setLiveMode(false);
    setWatchId(null);
    setNearbyStop(null);
  };

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const skipStop = async (dayId: string, stop: TripStop, reason?: string) => {
    if (!trip) return;
    try {
      await api.post(`/itinerary/${trip.id}/days/${dayId}/stops/${stop.id}/skip`, { reason });
      // Mark locally as skipped
      setTrip(t => t ? {...t, days: t.days.map(d => d.id === dayId ? {...d, stops: d.stops.map(s => s.id === stop.id ? {...s, notes: 'SKIPPED'} : s)} : d)} : t);
      setNearbyStop(null);
      setAmendingStop(null);
    } catch(e) {}
  };

  const activateTrip = async () => {
    if (!trip) return;
    try {
      await api.post(`/itinerary/${trip.id}/activate`);
      setTrip(t => t ? {...t, status: 'IN_PROGRESS'} : t);
      startLiveMode();
    } catch(e) {}
  };

  const fetchRecommendations = async (stop: TripStop, dayId: string) => {
    const lat = stop.campground?.latitude || stop.latitude;
    const lng = stop.campground?.longitude || stop.longitude;
    if (!lat || !lng) return;
    setRecommendations({ stopId: stop.id, items: [], loading: true });
    try {
      const { data } = await api.get('/itinerary/recommendations', {
        params: { lat, lng, type: stop.type, mealPref: aiForm.mealPref, fuelType: rvFuelType || 'gas' }
      });
      setRecommendations({ stopId: stop.id, items: data, loading: false });
    } catch(e) {
      setRecommendations({ stopId: stop.id, items: [], loading: false });
    }
  };

  const replaceStop = async (dayId: string, stop: TripStop, rec: any) => {
    if (!trip) return;
    try {
      const { data } = await api.put(`/itinerary/${trip.id}/days/${dayId}/stops/${stop.id}`, {
        ...stop,
        customName: rec.name,
        address: rec.address,
        latitude: rec.latitude,
        longitude: rec.longitude,
        notes: `Rating: ${rec.rating || 'N/A'} | ${rec.tags?.join(', ') || ''}`,
        confirmed: true,
      });
      setTrip(t => t ? {...t, days: t.days.map(d => d.id === dayId ? {...d, stops: d.stops.map(s => s.id === stop.id ? data : s)} : d)} : t);
      setRecommendations(null);
    } catch(e) {}
  };

  const deleteTrip = async () => {
    if (!trip) return;
    if (!window.confirm('Delete this itinerary and start fresh?')) return;
    try {
      await api.delete(`/itinerary/${trip.id}`);
      setTrip(null);
      setShowHitch(false);
    } catch(e) {}
  };

  const generateShareLink = async () => {
    if (!trip) return;
    try {
      const { data } = await api.post(`/itinerary/${trip.id}/share`);
      setShareUrl(data.url);
    } catch(e) {}
  };

  const revokeShare = async () => {
    if (!trip) return;
    try {
      await api.delete(`/itinerary/${trip.id}/share`);
      setShareUrl('');
    } catch(e) {}
  };

  const inviteCompanion = async () => {
    if (!trip || !inviteUsername.trim()) return;
    setInviteLoading(true); setInviteMsg('');
    try {
      const { data } = await api.post(`/itinerary/${trip.id}/members`, { username: inviteUsername.trim(), role: 'EDITOR' });
      setCompanions(c => [...c.filter(m => m.userId !== data.userId), data]);
      setInviteUsername('');
      setInviteMsg('✓ Added!');
    } catch(e: any) {
      setInviteMsg(e.response?.data?.error || 'User not found');
    }
    setInviteLoading(false);
  };

  const removeCompanion = async (userId: string) => {
    if (!trip) return;
    try {
      await api.delete(`/itinerary/${trip.id}/members/${userId}`);
      setCompanions(c => c.filter(m => m.userId !== userId));
    } catch(e) {}
  };





  const generateAI = async () => {
    setAiLoading(true); setAiError('');
    try {
      const { data: suggestion } = await api.post('/itinerary-ai/suggest', {
        ...aiForm,
        hoursPerDay: aiForm.drivingLimitType==='hours' ? aiForm.hoursPerDay : null,
        milesPerDay: aiForm.drivingLimitType==='miles' ? aiForm.milesPerDay : null,
        wantSightseeing: aiForm.wantSightseeing,
        mealPref: aiForm.mealPref,
        stopFrequency: aiForm.stopFrequency,
        returnDate: aiForm.returnDate || undefined,
        rvFuelType: rvFuelType || 'gas',
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
              {/* Row 1: Nights + Drive limit + Depart time */}
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
                  <div className="flex gap-1 mb-1">
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
                    <input type="range" min={2} max={16} value={aiForm.hoursPerDay} className="w-full accent-primary-500"
                      onChange={e=>setAiForm(f=>({...f,hoursPerDay:parseInt(e.target.value)}))} />
                  ) : (
                    <input type="range" min={50} max={800} step={25} value={aiForm.milesPerDay} className="w-full accent-primary-500"
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

              {/* Row 2: Meals */}
              <div className="bg-white rounded-xl p-3 border border-gray-200 space-y-2">
                <p className="text-xs font-semibold text-gray-600">🍽️ How do you want to eat on the road?</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'fast', label: '🚀 Fast Food', sub: 'Drive-thrus, quick stops' },
                    { val: 'balanced', label: '⚖️ Balanced', sub: 'Mix of fast & sit-down' },
                    { val: 'sitdown', label: '🍽️ Sit-down', sub: 'Full meals, local spots' },
                  ].map(opt => (
                    <button key={opt.val} onClick={()=>setAiForm(f=>({...f,mealPref:opt.val as any}))}
                      className={`p-2 rounded-xl border text-left transition-all ${aiForm.mealPref===opt.val?'border-primary-400 bg-primary-50':'border-gray-200 bg-white hover:bg-gray-50'}`}>
                      <p className="text-xs font-semibold text-gray-700">{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.sub}</p>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">How often do you want snack/rest stops?</p>
                  <div className="flex gap-2">
                    {[
                      { val: 'none', label: '💨 None', sub: 'Push through' },
                      { val: 'few', label: '☕ A few', sub: 'Every 3-4 hrs' },
                      { val: 'frequent', label: '🛑 Frequent', sub: 'Every 1-2 hrs' },
                    ].map(opt => (
                      <button key={opt.val} onClick={()=>setAiForm(f=>({...f,stopFrequency:opt.val as any}))}
                        className={`flex-1 p-2 rounded-xl border text-center transition-all ${aiForm.stopFrequency===opt.val?'border-primary-400 bg-primary-50':'border-gray-200 bg-white hover:bg-gray-50'}`}>
                        <p className="text-xs font-semibold text-gray-700">{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: Sightseeing + RV type + scenic */}
              <div className="bg-white rounded-xl p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">⭐ Recommend sightseeing along the way?</p>
                    <p className="text-xs text-gray-400">Hitch will suggest attractions, parks, and landmarks</p>
                  </div>
                  <div onClick={()=>setAiForm(f=>({...f,wantSightseeing:!f.wantSightseeing}))}
                    className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors ${aiForm.wantSightseeing?'bg-primary-500':'bg-gray-200'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${aiForm.wantSightseeing?'translate-x-5':'translate-x-0'}`} />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <select className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white flex-1"
                    value={aiForm.rvType} onChange={e=>setAiForm(f=>({...f,rvType:e.target.value}))}>
                    {RV_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                    <input type="checkbox" checked={aiForm.avoidHighways} className="accent-primary-500"
                      onChange={e=>setAiForm(f=>({...f,avoidHighways:e.target.checked}))} /> Scenic routes
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                {aiError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{aiError}</p>}
                <button onClick={generateAI} disabled={aiLoading||!aiForm.startLocation}
                  className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2 shadow-sm">
                  {aiLoading ? <><Loader className="w-4 h-4 animate-spin"/>Planning... (15-20s)</> : <><img src="/hitch.png" className="w-4 h-4 rounded-full"/>Generate My Itinerary</>}
                </button>
              </div>
            </div>
          )}

          {/* Multi-Stop Trip Planner */}
          <div className="px-4 py-4 border-b border-gray-100">
            <MultiStopTripPlanner
              tripPlanId={tripPlan.id}
              onUpdate={onReload}
            />
          </div>
        </div>
      ) : (
        /* No trip yet */
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <img src="/hitch.png" alt="Hitch" className="w-20 h-20 rounded-full object-cover mx-auto mb-4 shadow-lg" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">No route planned yet!</h3>
          <p className="text-gray-500 max-w-sm mb-6">Let Hitch AI map out your drive — overnight stops, fuel stations, scenic detours and all. Just tell it where you're starting from.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-sm w-full text-left mb-6">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">💡 What Hitch plans for you</p>
            <ul className="space-y-1 text-sm text-amber-800">
              <li>🗺️ Turn-by-turn route from your home base</li>
              <li>⛽ Fuel stops based on your RV's tank size</li>
              <li>🌙 Overnight stops along the way</li>
              <li>🎯 Sightseeing detours if you want them</li>
              <li>🚛 RV-safe roads — no low bridges!</li>
            </ul>
          </div>
          <button onClick={onEditTrip} className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition shadow-sm flex items-center gap-2">
            <img src="/hitch.png" className="w-5 h-5 rounded-full" /> Plan My Route with Hitch
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
              {/* Live mode banner */}
              {nearbyStop && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 shadow-sm animate-pulse">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📍</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-800">Coming up in {nearbyStop.dist} mi</p>
                      <p className="text-base font-semibold text-gray-800">{nearbyStop.stop.campground?.name || nearbyStop.stop.customName}</p>
                      <p className="text-xs text-gray-500">{nearbyStop.stop.address}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => toggleConfirmed(nearbyStop.dayId, nearbyStop.stop)}
                      className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-600 flex items-center justify-center gap-1">
                      <Check className="w-4 h-4"/> Stopping here
                    </button>
                    <button onClick={() => setAmendingStop(nearbyStop)}
                      className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 flex items-center justify-center gap-1">
                      <X className="w-4 h-4"/> Skipping it
                    </button>
                  </div>
                </div>
              )}

              {/* Amend stop modal */}
              {amendingStop && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
                  <p className="text-sm font-bold text-gray-800">Why are you skipping?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['Already fueled up', 'Not hungry yet', 'Running ahead of schedule', 'Prefer a different spot', 'Too busy / no time', 'Other'].map(reason => (
                      <button key={reason} onClick={() => skipStop(amendingStop.dayId, amendingStop.stop, reason)}
                        className="text-xs border border-gray-200 rounded-xl px-3 py-2 text-gray-600 hover:bg-gray-50 hover:border-primary-300 text-left">
                        {reason}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setAmendingStop(null)} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center">Cancel</button>
                </div>
              )}

              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-gray-700">📅 {trip.title}</p>
                <div className="flex items-center gap-2">
                  {trip.startDate && <span className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">Departs {fmtDate(trip.startDate)}</span>}
                  {(trip as any).status === 'IN_PROGRESS' ? (
                    <button onClick={stopLiveMode}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 ${liveMode ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'}`}>
                      {liveMode ? '🟢 Live' : '▶ Resume GPS'}
                    </button>
                  ) : (
                    <button onClick={activateTrip}
                      className="text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-600 flex items-center gap-1">
                      🚗 Start Trip
                    </button>
                  )}
                  <button onClick={() => setShowSharePanel(v => !v)}
                    className={`text-xs px-2 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${showSharePanel ? 'bg-primary-50 border-primary-300 text-primary-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    👥 Share
                  </button>
                  <button onClick={deleteTrip}
                    className="text-xs border border-red-200 text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all flex items-center gap-1"
                    title="Delete itinerary and start over">
                    <Trash2 className="w-3 h-3"/> Reset
                  </button>
                </div>
              </div>

              {/* Share panel */}
              {showSharePanel && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
                  {/* Travel companions */}
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-2">👥 Travel Companions</p>
                    <p className="text-xs text-gray-400 mb-3">People in your RV can view and edit this itinerary</p>
                    <div className="flex gap-2 mb-3">
                      <input value={inviteUsername} onChange={e => setInviteUsername(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && inviteCompanion()}
                        placeholder="RVUnicorn username" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
                      <button onClick={inviteCompanion} disabled={inviteLoading || !inviteUsername.trim()}
                        className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                        {inviteLoading ? '...' : 'Add'}
                      </button>
                    </div>
                    {inviteMsg && <p className={`text-xs mb-2 ${inviteMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{inviteMsg}</p>}
                    {companions.length > 0 && (
                      <div className="space-y-1.5">
                        {companions.map(m => (
                          <div key={m.userId} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                            {m.user?.profileImage ? <img src={m.user.profileImage} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs text-primary-600 font-bold">{m.user?.firstName?.[0]}</div>}
                            <span className="text-sm text-gray-700 flex-1">{m.user?.firstName} {m.user?.lastName} <span className="text-gray-400">@{m.user?.username}</span></span>
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">{m.role}</span>
                            <button onClick={() => removeCompanion(m.userId)} className="text-gray-300 hover:text-red-400 p-1"><X className="w-3 h-3"/></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Share link */}
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-800 mb-1">🔗 Read-only share link</p>
                    <p className="text-xs text-gray-400 mb-3">Anyone with this link can view your itinerary</p>
                    {shareUrl ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input readOnly value={shareUrl} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 text-gray-600" />
                          <button onClick={() => navigator.clipboard.writeText(shareUrl)}
                            className="border border-gray-200 text-gray-500 px-3 py-2 rounded-xl text-xs hover:bg-gray-50">Copy</button>
                        </div>
                        <button onClick={revokeShare} className="text-xs text-red-400 hover:text-red-600">Revoke link</button>
                      </div>
                    ) : (
                      <button onClick={generateShareLink}
                        className="text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-2">
                        🔗 Generate share link
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Share panel */}
              {showSharePanel && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
                  {/* Travel companions */}
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-2">👥 Travel Companions</p>
                    <p className="text-xs text-gray-400 mb-3">People in your RV can view and edit this itinerary</p>
                    <div className="flex gap-2 mb-3">
                      <input value={inviteUsername} onChange={e => setInviteUsername(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && inviteCompanion()}
                        placeholder="RVUnicorn username" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
                      <button onClick={inviteCompanion} disabled={inviteLoading || !inviteUsername.trim()}
                        className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                        {inviteLoading ? '...' : 'Add'}
                      </button>
                    </div>
                    {inviteMsg && <p className={`text-xs mb-2 ${inviteMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{inviteMsg}</p>}
                    {companions.length > 0 && (
                      <div className="space-y-1.5">
                        {companions.map(m => (
                          <div key={m.userId} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                            {m.user?.profileImage ? <img src={m.user.profileImage} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs text-primary-600 font-bold">{m.user?.firstName?.[0]}</div>}
                            <span className="text-sm text-gray-700 flex-1">{m.user?.firstName} {m.user?.lastName} <span className="text-gray-400">@{m.user?.username}</span></span>
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">{m.role}</span>
                            <button onClick={() => removeCompanion(m.userId)} className="text-gray-300 hover:text-red-400 p-1"><X className="w-3 h-3"/></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Share link */}
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-800 mb-1">🔗 Read-only share link</p>
                    <p className="text-xs text-gray-400 mb-3">Anyone with this link can view your itinerary</p>
                    {shareUrl ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input readOnly value={shareUrl} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 text-gray-600" />
                          <button onClick={() => navigator.clipboard.writeText(shareUrl)}
                            className="border border-gray-200 text-gray-500 px-3 py-2 rounded-xl text-xs hover:bg-gray-50">Copy</button>
                        </div>
                        <button onClick={revokeShare} className="text-xs text-red-400 hover:text-red-600">Revoke link</button>
                      </div>
                    ) : (
                      <button onClick={generateShareLink}
                        className="text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-2">
                        🔗 Generate share link
                      </button>
                    )}
                  </div>
                </div>
              )}

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
                          <div key={stop.id} className={`flex items-start gap-2 p-2.5 rounded-xl border transition-all ${stop.notes?.startsWith('SKIPPED') ? 'bg-gray-50 border-gray-100 opacity-50' : stop.confirmed?'bg-green-50 border-green-200':'bg-white border-gray-100'}`}>
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
                              {(stop.type==='OVERNIGHT'||stop.type==='FUEL'||stop.type==='FOOD'||stop.type==='ATTRACTION'||stop.type==='WALMART') && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <button
                                    onClick={() => recommendations?.stopId === stop.id ? setRecommendations(null) : fetchRecommendations(stop, day.id)}
                                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border transition-all ${recommendations?.stopId===stop.id?'bg-primary-100 text-primary-700 border-primary-300':'bg-gray-50 text-gray-500 border-gray-200 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200'}`}>
                                    ✨ {recommendations?.stopId===stop.id ? 'Hide options' : 'See options'}
                                  </button>
                                  {stop.type==='OVERNIGHT' && (
                                    <a href={rvParkyUrl(lat,lng,name)} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition-all">
                                      <ExternalLink className="w-2.5 h-2.5"/> RVParky
                                    </a>
                                  )}
                                </div>
                              )}
                              {/* Recommendations panel */}
                              {recommendations?.stopId === stop.id && (
                                <div className="mt-2 space-y-1.5">
                                  {recommendations.loading ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                                      <Loader className="w-3 h-3 animate-spin"/> Finding nearby options...
                                    </div>
                                  ) : recommendations.items.length === 0 ? (
                                    <p className="text-xs text-gray-400 py-1">No options found nearby</p>
                                  ) : (
                                    <>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nearby options — tap to switch</p>
                                      {recommendations.items.map((rec: any) => (
                                        <button key={rec.id} onClick={() => replaceStop(day.id, stop, rec)}
                                          className="w-full text-left p-2 bg-white border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all group">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-primary-700">{rec.name}</p>
                                              {rec.address && <p className="text-xs text-gray-400 truncate">{rec.address}</p>}
                                              <div className="flex flex-wrap gap-1 mt-0.5">
                                                {rec.rating && <span className="text-xs text-amber-600">⭐ {rec.rating}</span>}
                                                {rec.distanceMiles && <span className="text-xs text-gray-400">{rec.distanceMiles} mi</span>}
                                                {rec.gasPrice && <span className="text-xs font-semibold text-green-600">${rec.gasPrice.toFixed(2)}/gal {rec.fuelType === 'diesel' ? '🛢️' : '⛽'}</span>}
                                                {rec.tags?.slice(0,2).map((t: string) => <span key={t} className="text-xs text-gray-500 bg-gray-100 px-1 rounded">{t}</span>)}
                                              </div>
                                            </div>
                                            <span className="text-xs text-primary-500 font-medium flex-shrink-0 mt-1">Select →</span>
                                          </div>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              {(trip as any).status === 'IN_PROGRESS' && !stop.confirmed && !(stop.notes?.startsWith('SKIPPED')) && (
                                <button onClick={() => setAmendingStop({stop, dayId: day.id})}
                                  className="text-xs text-orange-500 hover:text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 hover:bg-orange-50">
                                  Skip
                                </button>
                              )}
                              <button onClick={()=>deleteStop(day.id,stop.id)} className="p-1 text-gray-300 hover:text-red-400 rounded-lg">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
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
