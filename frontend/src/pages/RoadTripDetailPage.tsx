import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, MapPin, Calendar, X, Search, AlertTriangle, GripVertical, Sparkles, Clock, Route, CheckCircle } from 'lucide-react';
import api from '../services/api';
import TravelMap from '../components/TravelMap';

const FONT_MAP: Record<string, string> = {
  playfair: "'Playfair Display', serif",
  montserrat: "'Montserrat', sans-serif",
  merriweather: "'Merriweather', serif",
  raleway: "'Raleway', sans-serif",
  lora: "'Lora', serif",
  oswald: "'Oswald', sans-serif",
  nunito: "'Nunito', sans-serif",
  cinzel: "'Cinzel', serif",
};

const PALETTE_GRADIENTS: Record<string, string> = {
  '#f97316': 'from-orange-400 to-red-500',
  '#0891b2': 'from-cyan-500 to-blue-600',
  '#16a34a': 'from-green-500 to-emerald-700',
  '#7c3aed': 'from-purple-500 to-violet-700',
  '#ca8a04': 'from-yellow-400 to-amber-600',
  '#dc2626': 'from-red-500 to-rose-700',
  '#0284c7': 'from-sky-400 to-blue-600',
  '#1e293b': 'from-slate-700 to-slate-900',
};

interface DriveInfo {
  distanceMiles: number;
  durationText: string;
  distanceText: string;
  durationHours: number;
  conflict?: string | null;
  needsOvernightStop?: boolean;
  overnightRecommendations?: any[];
  estimatedGasCost?: number | null;
  gasCostText?: string | null;
}

const GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Montserrat:wght@700&family=Merriweather:wght@700&family=Raleway:wght@700&family=Lora:wght@700&family=Oswald:wght@700&family=Nunito:wght@700&family=Cinzel:wght@700&display=swap";

export default function RoadTripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [roadTrip, setRoadTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddStop, setShowAddStop] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [campgroundResults, setCampgroundResults] = useState<any[]>([]);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [harvestHostResults, setHarvestHostResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [stopTab, setStopTab] = useState<'events' | 'campgrounds' | 'wishlist' | 'harvest'>('events');
  const [driveInfos, setDriveInfos] = useState<Record<string, DriveInfo>>({});
  const [loadingDrive, setLoadingDrive] = useState(false); // kept for reorder flow only
  const [generatingPlans, setGeneratingPlans] = useState(false);
  const [planResult, setPlanResult] = useState<string | null>(null);
  const [showHitchModal, setShowHitchModal] = useState(false);
  const [hitchPrefs, setHitchPrefs] = useState({ departureTime: '8:00 AM', milesPerDay: 300, rvType: 'Class A Motorhome', avoidHighways: false, stopFrequency: 'few' as 'none'|'few'|'frequent', mealPref: 'balanced' as 'fast'|'balanced'|'sitdown' });
  const DEP_TIMES = ['6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM'];
  const RV_TYPES = ['Class A Motorhome','Class B Van','Class C Motorhome','Fifth Wheel','Travel Trailer','Pop-Up Camper','Truck Camper'];
  const [removeModalStop, setRemoveModalStop] = useState<any | null>(null);
  const [removeModalLoading, setRemoveModalLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [homeLocation, setHomeLocation] = useState<string>('');
  const [showHomeEditModal, setShowHomeEditModal] = useState(false);
  const [homeEditValue, setHomeEditValue] = useState('');
  const [recalculatingHome, setRecalculatingHome] = useState(false);
  const [rvProfile, setRvProfile] = useState<any>(null);
  const [fuelPrices, setFuelPrices] = useState<any>(null);
  const [localMpg, setLocalMpg] = useState<number | null>(null);
  const [localFuelType, setLocalFuelType] = useState<string | null>(null);
  const [showMpgModal, setShowMpgModal] = useState(false);
  const [mpgEditValue, setMpgEditValue] = useState('');
  const [fuelTypeEditValue, setFuelTypeEditValue] = useState('gas');
  const [savingMpg, setSavingMpg] = useState(false);
  const [mapRoute, setMapRoute] = useState<any>(null);
  const [mapNewStates, setMapNewStates] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragItem = useRef<any>(null);
  const dragOverItem = useRef<any>(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = GOOGLE_FONTS;
    document.head.appendChild(link);
    loadRoadTrip();
  }, [id]);

  const loadRoadTrip = async () => {
    try {
      const { data } = await api.get(`/road-trips/${id}`);
      setRoadTrip(data);
      if (data.driveInfos) setDriveInfos(data.driveInfos);
      else calculateAllDriveTimes(data.stops);
      if (data.rvProfile) {
        setRvProfile(data.rvProfile);
        setLocalMpg(data.rvProfile.rvMpg);
        setLocalFuelType(data.rvProfile.rvFuelType || 'gas');
        setMpgEditValue(String(data.rvProfile.rvMpg || 10));
        setFuelTypeEditValue(data.rvProfile.rvFuelType || 'gas');
      }
      if (data.homeLocation) {
        setHomeLocation(data.homeLocation);
        setHomeEditValue(data.homeLocation);
      }
      if (data.fuelPrices) setFuelPrices(data.fuelPrices);
    } catch { navigate('/road-trips'); }
    finally { setLoading(false); }
  };

  // Fallback client-side drive time calculation (used after drag-reorder)
  const calculateAllDriveTimes = async (stops: any[]) => {
    if (stops.length < 2) return;
    setLoadingDrive(true);
    const promises = stops.slice(1).map(async (curr, idx) => {
      const prev = stops[idx];
      const originCg = prev.campground;
      const destCg = curr.campground;
      if (!originCg?.latitude || !destCg?.latitude) return null;
      try {
        const { data } = await api.post('/road-trips/drive-time', {
          origin: originCg.latitude + ',' + originCg.longitude,
          destination: destCg.latitude + ',' + destCg.longitude,
          departureDate: prev.endDate,
          arrivalDate: curr.startDate,
        });
        return { id: curr.id, data };
      } catch { return null; }
    });
    const results = await Promise.all(promises);
    const infos: Record<string, DriveInfo> = {};
    results.forEach(r => { if (r) infos[r.id] = r.data; });
    setDriveInfos(infos);
    setLoadingDrive(false);
  };

  const handleGeneratePlans = async () => {
    setShowHitchModal(false);
    setGeneratingPlans(true);
    setPlanResult(null);
    try {
      const { data } = await api.post('/road-trips/' + id + '/generate-plans', { hitchPrefs });
      setPlanResult((data.message || 'Done!') + " Open each event's Trip Planner tab to review your stops.");
    } catch { setPlanResult('Failed to generate plans'); }
    finally { setGeneratingPlans(false); }
  };

  const searchEvents = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/trips?search=${encodeURIComponent(q)}&limit=10`);
      const existing = new Set(roadTrip?.stops.map((s: any) => s.id) || []);
      setSearchResults((data.events || data || []).filter((e: any) => !existing.has(e.id)));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const searchCampgrounds = async (q: string) => {
    if (!q.trim()) { setCampgroundResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=10`);
      setCampgroundResults(data.campgrounds || data || []);
    } catch { setCampgroundResults([]); }
    finally { setSearching(false); }
  };

  const loadWishlist = async () => {
    try {
      const { data } = await api.get('/trips?wishlist=true');
      setWishlistItems(data.events || data || []);
    } catch { setWishlistItems([]); }
  };

  const addStop = async (eventId: string) => {
    try {
      await api.post(`/road-trips/${id}/stops`, { eventId });
      await loadRoadTrip();
      setShowAddStop(false);
      setSearchQuery(''); setSearchResults([]); setCampgroundResults([]);
    } catch { alert('Failed to add stop'); }
  };

  const addCampgroundStop = async (campground: any) => {
    try {
      const { data: newEvent } = await api.post('/events', {
        title: campground.name,
        campgroundId: campground.id,
        location: campground.city ? `${campground.city}, ${campground.state}` : campground.state,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        isWishlist: true,
      });
      await addStop(newEvent.id);
    } catch { alert('Failed to create stop from campground'); }
  };

  const searchHarvestHosts = async (q: string) => {
    if (!q || q.length < 2) { setHarvestHostResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/harvest-hosts?search=${encodeURIComponent(q)}&limit=10`);
      setHarvestHostResults(data?.hosts || data || []);
    } catch { setHarvestHostResults([]); }
    setSearching(false);
  };

  const addHarvestHostStop = async (host: any) => {
    try {
      const { data: newEvent } = await api.post('/events', {
        title: host.name,
        location: host.city ? `${host.city}, ${host.state}` : (host.state || host.address || ''),
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        isWishlist: true,
        description: `🍇 Harvest Host stay at ${host.name}${host.hostType ? ' (' + host.hostType + ')' : ''}`,
      });
      await addStop(newEvent.id);
    } catch { alert('Failed to create Harvest Host stop'); }
  };

  const removeStop = (stop: any) => {
    setRemoveModalStop(stop);
  };

  const handleRemoveFromTrip = async () => {
    if (!removeModalStop) return;
    setRemoveModalLoading(true);
    try {
      await api.delete(`/road-trips/${id}/stops/${removeModalStop.id}`);
      setRemoveModalStop(null);
      await loadRoadTrip();
    } catch { alert('Failed to remove stop'); }
    finally { setRemoveModalLoading(false); }
  };

  const handleMoveToWishlist = async () => {
    if (!removeModalStop) return;
    setRemoveModalLoading(true);
    try {
      // Remove from road trip + mark as wishlist in one shot
      await Promise.all([
        api.delete(`/road-trips/${id}/stops/${removeModalStop.id}`),
        api.put(`/events/${removeModalStop.id}`, { isWishlist: true }),
      ]);
      setRemoveModalStop(null);
      await loadRoadTrip();
    } catch { alert('Failed to move stop to wishlist'); }
    finally { setRemoveModalLoading(false); }
  };

  // Drag reorder
  const handleDragStart = (stop: any) => { dragItem.current = stop; setDragging(stop.id); };
  const handleDragEnter = (stop: any) => { dragOverItem.current = stop; setDragOver(stop.id); };
  const handleDragEnd = async () => {
    if (!dragItem.current || !dragOverItem.current || dragItem.current.id === dragOverItem.current.id) {
      setDragging(null); setDragOver(null); return;
    }
    const stops = [...roadTrip.stops];
    const fromIdx = stops.findIndex((s: any) => s.id === dragItem.current.id);
    const toIdx = stops.findIndex((s: any) => s.id === dragOverItem.current.id);
    const [moved] = stops.splice(fromIdx, 1);
    stops.splice(toIdx, 0, moved);
    const reordered = stops.map((s: any, i: number) => ({ ...s, stopNumber: i + 1 }));
    setRoadTrip({ ...roadTrip, stops: reordered });
    setDragging(null); setDragOver(null);
    try {
      await api.put(`/road-trips/${id}/stops/reorder`, {
        stopOrder: reordered.map((s: any) => ({ eventId: s.id, stopNumber: s.stopNumber }))
      });
      calculateAllDriveTimes(reordered);
    } catch { alert('Failed to save new order'); await loadRoadTrip(); }
  };

  const handleSaveHomeLocation = async () => {
    if (!homeEditValue.trim()) return;
    setRecalculatingHome(true);
    setHomeLocation(homeEditValue.trim());
    setShowHomeEditModal(false);
    // Recalculate home legs via map-route endpoint with overridden home
    try {
      const { data } = await api.get(`/road-trips/${id}/map-route`);
      if (data.route) setMapRoute(data.route);
    } catch(e) {}
    // Recalculate drive times — reload full road trip to get new home coords
    await loadRoadTrip();
    setRecalculatingHome(false);
  };

  const handleSaveMpg = async (saveGlobally: boolean) => {
    setSavingMpg(true);
    const newMpg = parseFloat(mpgEditValue) || 10;
    const newFuelType = fuelTypeEditValue;
    try {
      await api.put('/road-trips/update-rv', {
        rvMpg: newMpg,
        rvFuelType: newFuelType,
        tripOnly: !saveGlobally,
      });
      // Update local state immediately — no reload needed
      setLocalMpg(newMpg);
      setLocalFuelType(newFuelType);
      if (saveGlobally) {
        setRvProfile((prev: any) => prev ? { ...prev, rvMpg: newMpg, rvFuelType: newFuelType } : prev);
      }
      // Recalculate per-leg gas costs with new MPG + fuel price
      const newFuelPrice = newFuelType === 'diesel'
        ? (fuelPrices?.diesel || 3.90)
        : (fuelPrices?.gasoline || 3.50);
      setDriveInfos(prev => {
        const updated: Record<string, any> = {};
        Object.entries(prev).forEach(([key, d]: [string, any]) => {
          const gallons = d.distanceMiles / newMpg;
          const cost = Math.round(gallons * newFuelPrice * 100) / 100;
          updated[key] = {
            ...d,
            estimatedGasCost: cost,
            gasCostText: `$${cost.toFixed(2)} est. ${newFuelType === 'diesel' ? 'diesel' : 'fuel'} (${newMpg} MPG @ $${newFuelPrice.toFixed(2)}/gal)`,
          };
        });
        return updated;
      });
      setShowMpgModal(false);
    } catch(e) { alert('Failed to save'); }
    setSavingMpg(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;
  if (!roadTrip) return null;

  const gradient = PALETTE_GRADIENTS[roadTrip.color] || 'from-orange-400 to-red-500';
  const fontFamily = FONT_MAP[roadTrip.font] || FONT_MAP.playfair;
  const totalNights = roadTrip.stops.reduce((sum: number, s: any) => {
    if (!s.startDate || !s.endDate) return sum;
    return sum + Math.ceil((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 86400000);
  }, 0);
  const states = [...new Set(roadTrip.stops.map((s: any) => s.campground?.state).filter(Boolean))];
  const totalMiles = Object.values(driveInfos).reduce((sum, d) => sum + d.distanceMiles, 0);
  const effectiveMpg = localMpg || rvProfile?.rvMpg || 10;
  const effectiveFuelType = localFuelType || rvProfile?.rvFuelType || 'gas';
  const effectiveFuelPrice = effectiveFuelType === 'diesel' ? (fuelPrices?.diesel || 3.90) : (fuelPrices?.gasoline || 3.50);
  const totalFuelCost = totalMiles > 0 ? Math.round((totalMiles / effectiveMpg) * effectiveFuelPrice * 100) / 100 : 0;
  const hasConflicts = Object.values(driveInfos).some(d => d.conflict);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Banner */}
      <div className={`bg-gradient-to-r ${gradient} text-white`}>
        <div className="max-w-4xl mx-auto px-4 py-10">
          <button onClick={() => navigate('/road-trips')} className="flex items-center gap-2 text-white/80 hover:text-white mb-6 text-sm">
            <ArrowLeft className="w-4 h-4" /> All Road Trips
          </button>
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily }}>{roadTrip.title}</h1>
          {roadTrip.description && <p className="text-white/80 mb-4">{roadTrip.description}</p>}
          <div className="flex items-center gap-6 text-sm text-white/90 flex-wrap">
            <span>📍 {roadTrip.stops.length} stops</span>
            {totalNights > 0 && <span>🌙 {totalNights} nights</span>}
            {states.length > 0 && <span>🗺️ {states.join(' · ')}</span>}
            {totalMiles > 0 && <span>🚗 ~{totalMiles.toLocaleString()} miles total (est.)</span>}
            {hasConflicts && <span className="bg-red-500/30 border border-red-300/50 px-2 py-0.5 rounded-full text-xs font-bold">⚠️ Route conflicts detected</span>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-xl font-bold text-gray-900">Stops</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddStop(true)}
              className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow-md"
              style={{ backgroundColor: roadTrip.color }}>
              <Plus className="w-4 h-4" /> Add Stop
            </button>
          </div>
        </div>


        {/* RV Profile + Trip Summary Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Left: Trip totals */}
            <div className="flex gap-6 flex-wrap">
              {totalMiles > 0 && (
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-0.5">Total Distance</p>
                  <p className="text-lg font-bold text-gray-900">~{totalMiles.toLocaleString()} mi</p>
                </div>
              )}
              {totalFuelCost > 0 && (
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-0.5">Est. Fuel Cost</p>
                  <p className="text-lg font-bold text-gray-900">${totalFuelCost.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{effectiveFuelType === 'diesel' ? '⛽ Diesel' : '⛽ Gas'} @ ${effectiveFuelPrice.toFixed(2)}/gal</p>
                </div>
              )}
            </div>
            {/* Right: RV info */}
            <div className="flex items-center gap-3">
              {rvProfile?.rvPhotoUrl ? (
                <img src={rvProfile.rvPhotoUrl} alt="Your RV"
                  className="w-24 h-18 rounded-xl object-cover flex-shrink-0 border border-gray-100 shadow-md"
                  style={{ width: '96px', height: '72px' }} />
              ) : (
                <a href="/my-rv" title="Add a photo of your rig"
                  className="flex flex-col items-center justify-center w-24 h-18 rounded-xl bg-gray-50 border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition flex-shrink-0 group cursor-pointer"
                  style={{ width: '96px', height: '72px' }}>
                  <span className="text-2xl group-hover:scale-110 transition-transform">🚐</span>
                  <span className="text-xs text-gray-400 group-hover:text-orange-500 font-medium mt-0.5">Add rig pic</span>
                </a>
              )}
              <div className="text-right">
                {rvProfile?.rvModel ? (
                  <p className="text-sm font-semibold text-gray-800">
                    {rvProfile.rvYear && <span className="text-gray-500 font-normal">{rvProfile.rvYear} </span>}
                    {rvProfile.rvModel}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">{rvProfile?.rvType || 'RV'}</p>
                )}
                <p className="text-xs text-gray-500">
                  {effectiveMpg} MPG · {effectiveFuelType === 'diesel' ? 'Diesel' : 'Gas'}
                </p>
              </div>
              <button
                onClick={() => setShowMpgModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600"
              >
                ✏️ Edit
              </button>
            </div>
          </div>
          {!rvProfile?.rvMpg && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-amber-600 flex items-center gap-2">
              <span>⚠️</span>
              <span>No MPG set — using default of 10 MPG. <button onClick={() => setShowMpgModal(true)} className="underline font-medium">Set your MPG</button> for accurate fuel estimates.</span>
            </div>
          )}
        </div>

        {/* Route info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-sm text-blue-800 mb-4">
          <span className="text-base flex-shrink-0">🗺️</span>
          <div>
            <span className="font-semibold">Ready to hit the road?</span> Drive times and distances are shown between each stop.
            Click <span className="font-semibold">Customize My Drive</span> on any stop to build a day-by-day route with Hitch AI — rest stops, fuel, food, and attractions included.
          </div>
        </div>


        {loadingDrive && (
          <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Calculating drive times between stops... (est.)
          </div>
        )}

        {/* Stops timeline */}
        {roadTrip.stops.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🏕️</div>
            <p className="font-semibold text-gray-500">No stops yet</p>
            <p className="text-sm mt-1">Add your first campground stop to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {driveInfos['__home_to_first__'] && (() => {
              const d = driveInfos['__home_to_first__'];
              return (
                <div className="mx-4 mb-2 px-4 py-3 rounded-xl border bg-green-50 border-green-200 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 text-sm">🏠</div>
                  <div className="flex-1 min-w-0">
                    {homeLocation && <p className="text-xs text-green-600 font-medium">{homeLocation}</p>}
                    <p className="text-xs font-bold text-green-800">Home → Stop 1 · ~{d.distanceText} · ~{d.durationText} <span className="font-normal opacity-60">(est.)</span></p>
                    {d.gasCostText && <p className="text-xs text-green-600 mt-0.5">⛽ {d.gasCostText}</p>}
                  </div>
                  <button onClick={() => { setHomeEditValue(homeLocation); setShowHomeEditModal(true); }}
                    className="text-xs text-green-600 hover:text-green-800 border border-green-300 hover:bg-green-100 px-2 py-1 rounded-lg transition flex-shrink-0">
                    ✏️ Edit
                  </button>
                </div>
              );
            })()}
            {roadTrip.stops.map((stop: any, i: number) => {
              const drive = driveInfos[stop.id];
              return (
                <div key={stop.id}>
                  {/* Drive info between stops */}
                  {i > 0 && (
                    <div className={`mx-4 my-1 px-4 py-3 rounded-xl border ${drive?.conflict ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${drive?.conflict ? 'bg-red-100' : 'bg-blue-100'}`}>
                          <Route className={`w-4 h-4 ${drive?.conflict ? 'text-red-600' : 'text-blue-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {drive ? (
                            <>
                              <div className="flex items-center gap-3 flex-wrap">
                                <p className={`text-xs font-bold ${drive.conflict ? 'text-red-800' : 'text-blue-800'}`}>
                                  🚗 ~{drive.distanceText} · ~{drive.durationText} drive <span className="font-normal opacity-70">(est.)</span>
                                </p>
                                {drive.gasCostText && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    ⛽ {drive.gasCostText}
                                  </span>
                                )}
                              </div>
                              {drive.conflict && (
                                <div className="mt-1.5">
                                  <p className="text-xs text-red-700 font-medium">{drive.conflict}</p>
                                  {drive.needsOvernightStop && drive.overnightRecommendations && drive.overnightRecommendations.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs font-bold text-red-800 mb-1.5">💡 Recommended overnight stops along the way:</p>
                                      <div className="flex gap-2 flex-wrap">
                                        {drive.overnightRecommendations.map((cg: any) => (
                                          <a key={cg.id} href={`/campgrounds/${cg.id}`}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs text-red-700 hover:bg-red-50 transition">
                                            🏕️ {cg.name}, {cg.state}
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-blue-500">Calculating drive time...</p>
                          )}
                        </div>
                        {stop.campground?.city && roadTrip.stops[i-1]?.campground?.city && (
                          <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(roadTrip.stops[i-1].campground.city + ', ' + roadTrip.stops[i-1].campground.state)}&destination=${encodeURIComponent(stop.campground.city + ', ' + stop.campground.state)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs flex-shrink-0 hover:underline font-medium" style={{ color: roadTrip.color }}>
                            Directions →
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stop card */}
                  <div
                    draggable
                    onDragStart={() => handleDragStart(stop)}
                    onDragEnter={() => handleDragEnter(stop)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex transition-all ${dragging === stop.id ? 'opacity-50 scale-98' : ''} ${dragOver === stop.id && dragging !== stop.id ? 'border-2' : 'border-gray-100'}`}
                    style={dragOver === stop.id && dragging !== stop.id ? { borderColor: roadTrip.color, borderLeft: `4px solid ${roadTrip.color}` } : { borderLeft: `4px solid ${roadTrip.color}` }}>
                    
                    {/* Drag handle */}
                    <div className="flex items-center px-2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {stop.campground?.imageUrl && (
                      <img src={stop.campground.imageUrl} alt="" className="w-20 h-20 object-cover flex-shrink-0" />
                    )}

                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: roadTrip.color }}>
                            {stop.stopNumber || i + 1}
                          </div>
                          <div className="min-w-0">
                            <Link to={`/trips/${stop.id}`} className="font-bold text-gray-900 hover:underline truncate block"
                              style={{ fontFamily }}>{stop.title}</Link>
                            {stop.campground && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                {stop.campground.name}{stop.campground.city ? ` · ${stop.campground.city}, ${stop.campground.state}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <button onClick={() => removeStop(stop)} className="text-gray-300 hover:text-red-400 transition flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                        {stop.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(stop.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {stop.endDate && ` – ${new Date(stop.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                          </span>
                        )}
                        {stop._count?.subevents > 0 && <span>📅 {stop._count.subevents} activities</span>}
                        {stop._count?.tripPackItems > 0 && <span>🎒 {stop._count.tripPackItems} pack items</span>}
                        <Link to={(() => {
                          const prev = roadTrip.stops[i - 1];
                          const fromLabel = i === 0
                            ? '' // first stop — TripPlannerTab will use homeLocation
                            : prev?.campground?.name
                              ? `${prev.campground.name}, ${prev.campground.city || ''} ${prev.campground.state || ''}`.trim()
                              : prev?.title || '';
                          const toLabel = stop.campground?.name
                            ? `${stop.campground.name}, ${stop.campground.city || ''} ${stop.campground.state || ''}`.trim()
                            : stop.title || '';
                          const params = new URLSearchParams({ tab: 'trip', scrollTo: 'planner' });
                          if (fromLabel) params.set('from', fromLabel);
                          if (toLabel) params.set('to', toLabel);
                          return `/trips/${stop.id}?${params.toString()}`;
                        })()} className="ml-auto text-xs font-medium hover:underline" style={{ color: roadTrip.color }}>
                          Customize My Drive →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {driveInfos['__last_to_home__'] && (() => {
              const d = driveInfos['__last_to_home__'];
              return (
                <div className="mx-4 mt-2 px-4 py-3 rounded-xl border bg-green-50 border-green-200 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 text-sm">🏠</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-green-800">Stop {roadTrip.stops.length} → Home · ~{d.distanceText} · ~{d.durationText} <span className="font-normal opacity-60">(est.)</span></p>
                    {d.gasCostText && <p className="text-xs text-green-600 mt-0.5">⛽ {d.gasCostText}</p>}
                    {homeLocation && <p className="text-xs text-green-600 font-medium mt-0.5">{homeLocation}</p>}
                  </div>
                  <button onClick={() => { setHomeEditValue(homeLocation); setShowHomeEditModal(true); }}
                    className="text-xs text-green-600 hover:text-green-800 border border-green-300 hover:bg-green-100 px-2 py-1 rounded-lg transition flex-shrink-0">
                    ✏️ Edit
                  </button>
                </div>
              );
            })()}
          </div>
        )}


      </div>

      {false && showHitchModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="h-2 rounded-t-2xl" style={{ background: 'linear-gradient(to right, #f97316, #f59e0b)' }} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Plan with Hitch AI</h2>
                  <p className="text-xs text-gray-500">Answer once, Hitch plans every leg</p>
                </div>
                <button onClick={() => setShowHitchModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Depart each morning</label>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" value={hitchPrefs.departureTime} onChange={e => setHitchPrefs(p => ({...p, departureTime: e.target.value}))}>
                      {DEP_TIMES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Max miles/day: {hitchPrefs.milesPerDay}mi</label>
                    <input type="range" min={50} max={600} step={25} value={hitchPrefs.milesPerDay} className="w-full accent-orange-500 mt-2" onChange={e => setHitchPrefs(p => ({...p, milesPerDay: parseInt(e.target.value)}))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">RV Type</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" value={hitchPrefs.rvType} onChange={e => setHitchPrefs(p => ({...p, rvType: e.target.value}))}>
                    {RV_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Eating on the road?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([{val:'fast',label:'🚀 Fast Food'},{val:'balanced',label:'⚖️ Balanced'},{val:'sitdown',label:'🍽️ Sit-down'}] as any[]).map((opt: any) => (
                      <button key={opt.val} onClick={() => setHitchPrefs(p => ({...p, mealPref: opt.val}))} className={'p-2 rounded-xl border text-xs font-semibold transition-all ' + (hitchPrefs.mealPref === opt.val ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="avoidHwyRT" checked={hitchPrefs.avoidHighways} onChange={e => setHitchPrefs(p => ({...p, avoidHighways: e.target.checked}))} className="w-4 h-4 accent-orange-500" />
                  <label htmlFor="avoidHwyRT" className="text-xs text-gray-600 cursor-pointer">Avoid highways</label>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  Hitch will plan each leg — hometown to Stop 1, Stop 1 to Stop 2, and so on. Open each event Trip Planner after to review.
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowHitchModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleGeneratePlans} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-white font-bold rounded-xl hover:opacity-90 transition" style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)' }}>
                  <Sparkles className="w-4 h-4" /> Plan All {roadTrip.stops.length} Legs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Map Section */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <button
          onClick={async () => {
            setShowMap(prev => {
              const next = !prev;
              if (next && !mapRoute) {
                api.get(`/road-trips/${id}/map-route`)
                  .then(({ data }) => {
                    if (data.route) setMapRoute(data.route);
                    if (data.newStates) setMapNewStates(data.newStates);
                  })
                  .catch(() => {});
              }
              return next;
            });
          }}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: roadTrip.color }}>
              🗺️
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Route Map</p>
              <p className="text-xs text-gray-500">Gas prices, rest stops, truck stops along your route</p>
            </div>
          </div>
          <span className="text-gray-400 group-hover:text-gray-600 text-lg transition">
            {showMap ? '▲' : '▼'}
          </span>
        </button>

        {showMap && (
          <div className="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            {/* New states legend */}
            {mapNewStates.length > 0 && (
              <div className="mb-3 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-2 text-sm">
                <span className="w-4 h-4 rounded bg-teal-600 flex-shrink-0 inline-block" />
                <span className="text-teal-800 font-medium">New states on this trip:</span>
                <span className="text-teal-700">{mapNewStates.join(', ')}</span>
              </div>
            )}
            <TravelMap
              userId={roadTrip.userId}
              isOwnProfile={true}
              compact={false}
              initialRoute={mapRoute}
              newStateHighlights={mapNewStates}
            />
          </div>
        )}
      </div>

      {/* MPG / Fuel Edit Modal */}
      {showMpgModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-amber-400" />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">RV Fuel Settings</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Used to calculate trip fuel costs</p>
                </div>
                <button onClick={() => setShowMpgModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {rvProfile?.rvModel && (
                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 text-sm text-gray-600">
                  🚐 {rvProfile.rvYear && `${rvProfile.rvYear} `}{rvProfile.rvModel}
                </div>
              )}

              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Fuel Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['gas', 'diesel'] as const).map(ft => (
                      <button key={ft} onClick={() => setFuelTypeEditValue(ft)}
                        className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition ${fuelTypeEditValue === ft ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {ft === 'gas' ? '⛽ Gasoline' : '🛢️ Diesel'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    Miles Per Gallon (MPG)
                    {fuelPrices && <span className="ml-2 text-gray-400">
                      Current {fuelTypeEditValue} price: ${fuelTypeEditValue === 'diesel' ? fuelPrices.diesel?.toFixed(2) : fuelPrices.gasoline?.toFixed(2)}/gal
                    </span>}
                  </label>
                  <input
                    type="number" min="1" max="50" step="0.5"
                    value={mpgEditValue}
                    onChange={e => setMpgEditValue(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                    placeholder="e.g. 10"
                  />
                  {mpgEditValue && fuelPrices && (
                    <p className="text-xs text-gray-400 mt-1">
                      Est. cost for {totalMiles} miles: ~${(totalMiles / parseFloat(mpgEditValue || '10') * (fuelTypeEditValue === 'diesel' ? fuelPrices.diesel : fuelPrices.gasoline)).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {rvProfile?.rvMpg && (parseFloat(mpgEditValue) !== rvProfile.rvMpg || fuelTypeEditValue !== rvProfile.rvFuelType) ? (
                <div className="space-y-2">
                  <p className="text-xs text-center text-gray-500 mb-3">
                    Your saved MPG is <strong>{rvProfile.rvMpg}</strong>. Update your profile too?
                  </p>
                  <button onClick={() => handleSaveMpg(true)} disabled={savingMpg}
                    className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50">
                    {savingMpg ? 'Saving...' : 'Yes — Update My RV Profile'}
                  </button>
                  <button onClick={() => handleSaveMpg(false)} disabled={savingMpg}
                    className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition disabled:opacity-50">
                    No — This Trip Only
                  </button>
                </div>
              ) : (
                <button onClick={() => handleSaveMpg(true)} disabled={savingMpg}
                  className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50">
                  {savingMpg ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Home Location Modal */}
      {showHomeEditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-green-500 to-emerald-400" />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">Edit Home Location</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Starting and ending point of your road trip</p>
                </div>
                <button onClick={() => setShowHomeEditModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">City, State or Address</label>
                <input
                  value={homeEditValue}
                  onChange={e => setHomeEditValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveHomeLocation()}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400"
                  placeholder="e.g. Elmhurst, IL"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1.5">Drive times will recalculate after saving</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowHomeEditModal(false)}
                  className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={handleSaveHomeLocation} disabled={recalculatingHome || !homeEditValue.trim()}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-green-500 rounded-xl hover:bg-green-600 transition disabled:opacity-50">
                  {recalculatingHome ? 'Recalculating...' : 'Save & Recalculate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Stop Modal */}
      {removeModalStop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className={`h-2 bg-gradient-to-r ${gradient} rounded-t-2xl`} />
            <div className="p-6">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🏕️</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Remove Stop</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    What would you like to do with <span className="font-semibold text-gray-700">{removeModalStop.title}</span>?
                  </p>
                </div>
              </div>

              {/* Option 1: Move to Wishlist */}
              <button
                onClick={handleMoveToWishlist}
                disabled={removeModalLoading}
                className="w-full text-left p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition mb-3 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧞</span>
                  <div>
                    <p className="font-bold text-amber-800 text-sm">Save to Wishlist</p>
                    <p className="text-xs text-amber-600 mt-0.5">Remove from this trip but keep it for a future adventure</p>
                  </div>
                </div>
              </button>

              {/* Option 2: Remove from trip only */}
              <button
                onClick={handleRemoveFromTrip}
                disabled={removeModalLoading}
                className="w-full text-left p-4 rounded-xl border-2 border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 transition mb-4 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🗑️</span>
                  <div>
                    <p className="font-bold text-red-700 text-sm">Remove from Trip</p>
                    <p className="text-xs text-red-500 mt-0.5">Unlink from this road trip only — the event stays in your account</p>
                  </div>
                </div>
              </button>

              {removeModalLoading && (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-3">
                  <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                  Updating...
                </div>
              )}

              <button
                onClick={() => setRemoveModalStop(null)}
                disabled={removeModalLoading}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stop Modal */}
      {showAddStop && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className={`h-2 bg-gradient-to-r ${gradient} rounded-t-2xl`} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Add a Stop</h2>
                <button onClick={() => { setShowAddStop(false); setSearchQuery(''); setSearchResults([]); setCampgroundResults([]); setStopTab('events'); }}
                  className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
                {(['events', 'campgrounds', 'harvest', 'wishlist'] as const).map(tab => (
                  <button key={tab} onClick={() => {
                    setStopTab(tab);
                    setSearchQuery('');
                    setSearchResults([]);
                    setCampgroundResults([]);
                    setHarvestHostResults([]);
                    if (tab === 'wishlist') loadWishlist();
                  }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${stopTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {tab === 'events' ? '📅 Events' : tab === 'campgrounds' ? '🏕️ Camps' : tab === 'harvest' ? '🍇 Harvest' : '🧞 Wishlist'}
                  </button>
                ))}
              </div>
              {stopTab !== 'wishlist' && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      if (stopTab === 'events') searchEvents(e.target.value);
                      else if (stopTab === 'campgrounds') searchCampgrounds(e.target.value);
                      else if (stopTab === 'harvest') searchHarvestHosts(e.target.value);
                    }}
                    placeholder={stopTab === 'events' ? 'Search your events...' : stopTab === 'campgrounds' ? 'Search campgrounds...' : 'Search Harvest Hosts, wineries, farms...'}
                    className="input w-full pl-9" autoFocus />
                </div>
              )}
              {searching && <p className="text-sm text-gray-400 text-center py-4">Searching...</p>}
              {stopTab === 'events' && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((event: any) => (
                    <button key={event.id} onClick={() => addStop(event.id)}
                      className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition">
                      <p className="font-semibold text-gray-900 text-sm">{event.title}</p>
                      <p className="text-xs text-gray-500">{event.campground?.name || event.location || 'No location'}{event.startDate && ` · ${new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</p>
                    </button>
                  ))}
                  {!searchQuery && <p className="text-sm text-gray-400 text-center py-4">Type to search your existing events</p>}
                  {searchQuery && !searching && searchResults.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No events found</p>}
                </div>
              )}
              {stopTab === 'campgrounds' && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {campgroundResults.map((cg: any) => (
                    <button key={cg.id} onClick={() => addCampgroundStop(cg)}
                      className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition flex items-center gap-3">
                      {cg.imageUrl ? <img src={cg.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 text-lg">🏕️</div>}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{cg.name}</p>
                        <p className="text-xs text-gray-500">{cg.city ? `${cg.city}, ` : ''}{cg.state}</p>
                      </div>
                    </button>
                  ))}
                  {!searchQuery && <p className="text-sm text-gray-400 text-center py-4">Search any campground to add as a stop</p>}
                  {searchQuery && !searching && campgroundResults.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No campgrounds found</p>}
                </div>
              )}
              {stopTab === 'harvest' && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {harvestHostResults.map((host: any) => (
                    <button key={host.id} onClick={() => addHarvestHostStop(host)}
                      className="w-full text-left p-3 rounded-xl border border-green-200 hover:border-green-300 hover:bg-green-50 transition flex items-center gap-3">
                      {host.imageUrl
                        ? <img src={host.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 text-lg">🍇</div>
                      }
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{host.name}</p>
                        <p className="text-xs text-gray-500">{host.hostType && <span className="capitalize">{host.hostType} · </span>}{host.city ? `${host.city}, ` : ''}{host.state}</p>
                      </div>
                    </button>
                  ))}
                  {!searchQuery && <p className="text-sm text-gray-400 text-center py-4">Search wineries, farms, breweries and more</p>}
                  {searchQuery && !searching && harvestHostResults.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No Harvest Hosts found</p>}
                </div>
              )}
              {stopTab === 'wishlist' && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {wishlistItems.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No wishlist items yet</p>
                    : wishlistItems.map((event: any) => (
                      <button key={event.id} onClick={() => addStop(event.id)}
                        className="w-full text-left p-3 rounded-xl border border-amber-200 hover:bg-amber-50 transition">
                        <p className="font-semibold text-gray-900 text-sm">🧞 {event.title}</p>
                        <p className="text-xs text-gray-500">{event.campground?.name || event.location || 'No location'}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
