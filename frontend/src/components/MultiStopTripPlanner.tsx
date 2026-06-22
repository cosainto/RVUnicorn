/**
 * MultiStopTripPlanner — redesigned with Start / Stops / Destination.
 * Any place type (campground is one option). Conditional dates.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, MapPin, Calendar, Navigation, ChevronRight, Clock, Search, X } from 'lucide-react';
import api from '../services/api';

const STOP_TYPES = [
  { value: 'CAMPGROUND', label: 'Campground', icon: '🏕️' },
  { value: 'OVERNIGHT', label: 'Overnight Stop', icon: '🌙' },
  { value: 'HOTEL', label: 'Hotel / Lodge', icon: '🏨' },
  { value: 'FUEL', label: 'Fuel / Rest', icon: '⛽' },
  { value: 'REST_AREA', label: 'Rest Area', icon: '🅿️' },
  { value: 'STORAGE', label: 'Storage / Service', icon: '🔒' },
  { value: 'FAMILY_PERSONAL', label: 'Family / Personal', icon: '🏠' },
  { value: 'CUSTOM', label: 'Custom Place', icon: '📍' },
];

const OVERNIGHT_TYPES = new Set(['CAMPGROUND', 'OVERNIGHT', 'HOTEL', 'BOONDOCKING', 'RV_PARK', 'HARVEST_HOST']);

interface Place {
  id?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  placeType?: string;
  location?: string;
}

interface Waypoint {
  type: string;
  id?: string;
  name: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  orderIndex: number;
  arrivalDate?: string;
  departureDate?: string;
  campgroundId?: string;
  campground?: Place;
  notes?: string;
}

interface Leg {
  from: number;
  to: number;
  distanceMiles: number;
  durationMinutes: number;
}

interface Props {
  tripPlanId: string;
  onUpdate?: () => void;
}

export default function MultiStopTripPlanner({ tripPlanId, onUpdate }: Props) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [totalMiles, setTotalMiles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddStop, setShowAddStop] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [stopSearch, setStopSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [newStopType, setNewStopType] = useState('CAMPGROUND');
  const [newStopDates, setNewStopDates] = useState({ arrivalDate: '', departureDate: '', notes: '' });
  const [newStopAddress, setNewStopAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchMode, setSearchMode] = useState<'campground' | 'address'>('campground');

  useEffect(() => { loadItinerary(); }, [tripPlanId]);

  const loadItinerary = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/trip-planner/trip/${tripPlanId}/full-itinerary`);
      setWaypoints(data.waypoints || []);
      setLegs(data.legs || []);
      setTotalMiles(data.totalMiles || 0);
    } catch {} finally { setLoading(false); }
  };

  const searchPlaces = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      setSearching(true);
      if (searchMode === 'campground') {
        const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=8`);
        setSearchResults((Array.isArray(data) ? data : (data.campgrounds || [])).map((cg: any) => ({ ...cg, placeType: 'CAMPGROUND' })));
      } else {
        // Search by address/town via geocode
        const { data } = await api.post('/rigs/search-stops', { query: q, radius: 50 });
        if (data.location) {
          setSearchResults([{ id: null, name: q, city: data.location.name, latitude: data.location.lat, longitude: data.location.lng, placeType: 'ADDRESS', ...data.location }]);
        } else {
          setSearchResults([]);
        }
      }
    } catch {} finally { setSearching(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchPlaces(stopSearch), 350);
    return () => clearTimeout(timer);
  }, [stopSearch, searchMode]);

  const resetModal = () => {
    setShowAddStop(false);
    setSelectedPlace(null);
    setStopSearch('');
    setSearchResults([]);
    setNewStopDates({ arrivalDate: '', departureDate: '', notes: '' });
    setNewStopType('CAMPGROUND');
    setNewStopAddress('');
    setInsertAt(null);
    setSearchMode('campground');
  };

  const handleAddStop = async () => {
    if (!selectedPlace && !newStopAddress.trim()) return;
    const isOvernight = OVERNIGHT_TYPES.has(newStopType);
    if (isOvernight && !newStopDates.arrivalDate) return;

    try {
      setSaving(true);
      if (selectedPlace?.placeType === 'CAMPGROUND' && selectedPlace.id) {
        await api.post(`/trip-planner/trip/${tripPlanId}/campground-stop`, {
          campgroundId: selectedPlace.id,
          arrivalDate: newStopDates.arrivalDate || null,
          departureDate: newStopDates.departureDate || null,
          notes: newStopDates.notes || null,
          orderIndex: insertAt !== null ? insertAt : undefined,
        });
      } else {
        // Generic stop (address, custom place, etc.)
        const name = selectedPlace?.name || newStopAddress.trim();
        await api.post(`/trips/${tripPlanId}/stops`, {
          stopType: newStopType,
          name,
          address: newStopAddress.trim() || selectedPlace?.address || '',
          city: selectedPlace?.city || '',
          state: selectedPlace?.state || '',
          arrivalDate: isOvernight ? newStopDates.arrivalDate : null,
          departureDate: isOvernight ? newStopDates.departureDate : null,
          notes: newStopDates.notes || null,
        });
      }
      await loadItinerary();
      onUpdate?.();
      resetModal();
    } catch (error) {
      console.error('Add stop error:', error);
    } finally { setSaving(false); }
  };

  const handleDeleteStop = async (stopId: string) => {
    if (!confirm('Remove this stop?')) return;
    try {
      await api.delete(`/trip-planner/pit-stop/${stopId}`);
      await loadItinerary();
      onUpdate?.();
    } catch {}
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  const stayNights = (arrival?: string, departure?: string) => {
    if (!arrival || !departure) return null;
    const diff = Math.round((new Date(departure).getTime() - new Date(arrival).getTime()) / 86400000);
    return diff > 0 ? `${diff} night${diff !== 1 ? 's' : ''}` : null;
  };

  const stopIcon = (type: string) => {
    const icons: Record<string, string> = {
      HOME: '🏠', FINAL_DESTINATION: '🏁', CAMPGROUND: '🏕️', RV_PARK: '🚐',
      HARVEST_HOST: '🌾', BOONDOCKING: '⛺', OVERNIGHT: '🌙', HOTEL: '🏨',
      FUEL: '⛽', REST_AREA: '🅿️', STORAGE: '🔒', FAMILY_PERSONAL: '🏠', CUSTOM: '📍',
    };
    return icons[type] || '📍';
  };

  const stopLabel = (type: string) => {
    if (type === 'HOME') return 'Start';
    if (type === 'FINAL_DESTINATION') return 'Destination';
    return STOP_TYPES.find(t => t.value === type)?.label || 'Stop';
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Trip Itinerary</h3>
          {totalMiles > 0 && (
            <p className="text-sm text-gray-500">{totalMiles.toLocaleString()} total miles · {legs.length} leg{legs.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <button onClick={() => { setInsertAt(null); setShowAddStop(true); }} className="btn btn-primary btn-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add Stop
        </button>
      </div>

      {waypoints.length === 0 ? (
        <div className="text-center py-10 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
          <Navigation className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="font-medium">No stops yet</p>
          <p className="text-sm mt-1">Add stops to build your journey — campgrounds, addresses, or any place along the way</p>
        </div>
      ) : (
        <div>
          {waypoints.map((wp, idx) => {
            const leg = legs.find(l => l.from === idx);
            const isLast = idx === waypoints.length - 1;
            const isStart = wp.type === 'HOME';
            const isDest = wp.type === 'FINAL_DESTINATION';
            const nights = stayNights(wp.arrivalDate, wp.departureDate);

            return (
              <div key={`${wp.id || wp.type}-${idx}`}>
                <div className={`flex items-start gap-3 p-4 rounded-xl border-2 transition ${isStart ? 'border-blue-200 bg-blue-50' : isDest ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex flex-col items-center pt-0.5">
                    <span className="text-2xl">{stopIcon(wp.type)}</span>
                    {!isLast && <div className="w-0.5 h-6 bg-gray-300 mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{stopLabel(wp.type)}</span>
                        </div>
                        <p className="font-bold text-gray-900 truncate">{wp.name}</p>
                        {wp.location && <p className="text-sm text-gray-500 truncate">{wp.location}</p>}
                      </div>
                      {wp.id && !isStart && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button title="Insert stop after" onClick={() => { setInsertAt(wp.orderIndex + 1); setShowAddStop(true); }} className="p-1 text-gray-400 hover:text-primary-600 transition"><Plus className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteStop(wp.id!)} className="p-1 text-gray-400 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    {(wp.arrivalDate || wp.departureDate) && (
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        {wp.arrivalDate && <span>Arrive {formatDate(wp.arrivalDate)}</span>}
                        {wp.departureDate && <><ChevronRight className="w-3 h-3" /><span>Leave {formatDate(wp.departureDate)}</span></>}
                        {nights && <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full font-medium">{nights}</span>}
                      </div>
                    )}
                    {wp.notes && <p className="text-xs text-gray-500 mt-1 italic">{wp.notes}</p>}
                  </div>
                </div>
                {leg && (
                  <div className="flex items-center gap-2 my-1 pl-14 text-xs text-gray-400">
                    <Navigation className="w-3 h-3" /><span className="font-medium text-gray-600">{leg.distanceMiles} mi</span>
                    <span>·</span><Clock className="w-3 h-3" /><span>~{formatDuration(leg.durationMinutes)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Stop Modal */}
      {showAddStop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-5 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold">{insertAt !== null ? 'Insert Stop' : 'Add a Stop'}</h3>
              <button onClick={resetModal}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Stop type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stop Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {STOP_TYPES.map(t => (
                    <button key={t.value} onClick={() => setNewStopType(t.value)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition ${newStopType === t.value ? 'bg-primary-100 text-primary-700 border-primary-300' : 'bg-gray-50 text-gray-600 border-gray-200'} border`}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search mode toggle */}
              <div className="flex gap-2">
                <button onClick={() => setSearchMode('campground')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${searchMode === 'campground' ? 'bg-primary-50 text-primary-700 border-primary-300' : 'bg-gray-50 text-gray-500 border-gray-200'} border`}>
                  🏕️ Search Campgrounds
                </button>
                <button onClick={() => setSearchMode('address')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${searchMode === 'address' ? 'bg-primary-50 text-primary-700 border-primary-300' : 'bg-gray-50 text-gray-500 border-gray-200'} border`}>
                  📍 Enter Address / Town
                </button>
              </div>

              {/* Place search or address input */}
              {!selectedPlace ? (
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input autoFocus type="text"
                      value={searchMode === 'address' ? newStopAddress : stopSearch}
                      onChange={e => searchMode === 'address' ? setNewStopAddress(e.target.value) : setStopSearch(e.target.value)}
                      placeholder={searchMode === 'campground' ? 'Search campgrounds...' : 'Enter address, town, or ZIP...'}
                      className="input pl-9" />
                    {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" /></div>}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-100">
                      {searchResults.map((r: any, i: number) => (
                        <button key={r.id || i} onClick={() => { setSelectedPlace(r); setStopSearch(''); setNewStopAddress(r.name || ''); setSearchResults([]); }}
                          className="w-full text-left px-4 py-3 hover:bg-primary-50 flex items-center gap-3 transition">
                          <MapPin className="w-4 h-4 text-primary-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{r.name}</p>
                            <p className="text-xs text-gray-500 truncate">{r.city || r.location}{r.state ? `, ${r.state}` : ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Manual address entry for non-campground stops */}
                  {searchMode === 'address' && newStopAddress.length >= 2 && !searching && searchResults.length === 0 && (
                    <button onClick={() => setSelectedPlace({ name: newStopAddress.trim() })}
                      className="mt-2 w-full text-left px-4 py-3 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                      <Plus className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Use "{newStopAddress.trim()}" as a custom stop</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{selectedPlace.name}</p>
                      {(selectedPlace.city || selectedPlace.state) && <p className="text-xs text-gray-500">{[selectedPlace.city, selectedPlace.state].filter(Boolean).join(', ')}</p>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedPlace(null)} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0"><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Dates — only for overnight-type stops */}
              {OVERNIGHT_TYPES.has(newStopType) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date *</label>
                    <input type="date" value={newStopDates.arrivalDate} onChange={e => setNewStopDates(p => ({ ...p, arrivalDate: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
                    <input type="date" value={newStopDates.departureDate} onChange={e => setNewStopDates(p => ({ ...p, departureDate: e.target.value }))} className="input" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={newStopDates.notes} onChange={e => setNewStopDates(p => ({ ...p, notes: e.target.value }))}
                  placeholder={newStopType === 'STORAGE' ? 'Unit #, gate code...' : newStopType === 'FUEL' ? 'Fuel type, price...' : 'Notes...'}
                  className="input" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleAddStop}
                  disabled={(!selectedPlace && !newStopAddress.trim()) || (OVERNIGHT_TYPES.has(newStopType) && !newStopDates.arrivalDate) || saving}
                  className="btn btn-primary flex-1 disabled:opacity-50">
                  {saving ? 'Adding...' : 'Add to Itinerary'}
                </button>
                <button onClick={resetModal} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
