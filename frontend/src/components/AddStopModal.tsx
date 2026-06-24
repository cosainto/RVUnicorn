import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Loader, ChevronLeft, Minus, Plus } from 'lucide-react';
import api from '../services/api';

const STOP_TYPES = [
  { id: 'CAMPGROUND', label: 'Campground', emoji: '🏕️' },
  { id: 'OVERNIGHT', label: 'Overnight', emoji: '🌙' },
  { id: 'NAP', label: 'Nap', emoji: '😴' },
  { id: 'SNACK', label: 'Snack', emoji: '🍿' },
  { id: 'LUNCH', label: 'Lunch', emoji: '🥪' },
  { id: 'FOOD', label: 'Food', emoji: '🍔' },
  { id: 'GAS', label: 'Gas', emoji: '⛽' },
  { id: 'REPAIR', label: 'Repair', emoji: '🔧' },
  { id: 'WALK', label: 'Walk', emoji: '🚶' },
  { id: 'PLAY', label: 'Play', emoji: '🎮' },
  { id: 'DOG', label: 'Dog Break', emoji: '🐕' },
  { id: 'OTHER', label: 'Other', emoji: '📍' },
];

const OVERNIGHT_TYPES = new Set(['CAMPGROUND', 'OVERNIGHT']);
const MANUAL_ONLY = new Set(['OTHER']);

const SLIDER_LABELS: Record<string, string> = {
  CAMPGROUND: 'How long do you want to drive before stopping?',
  OVERNIGHT: 'How long do you want to drive before stopping?',
  GAS: 'How far do you want to drive before fueling?',
  FOOD: 'How far into the drive do you want to eat?',
  LUNCH: 'How far into the drive do you want lunch?',
  SNACK: 'How far into the drive for a snack?',
  RELAX: 'How long before you want a break?',
  WALK: 'How long before you want a break?',
  DOG: 'How long before you want a break?',
  PLAY: 'Where along your route is this stop?',
  NAP: 'How long before you want to rest?',
  REPAIR: 'Where do you need service?',
};

const DEFAULT_HOURS: Record<string, number> = {
  CAMPGROUND: 8, OVERNIGHT: 8, GAS: 4, FOOD: 5, LUNCH: 4.5,
  SNACK: 2.5, RELAX: 3, WALK: 2.5, DOG: 3, PLAY: 6, NAP: 3, REPAIR: 6,
};

const MAX_HOURS: Record<string, number> = {
  GAS: 8, SNACK: 8, WALK: 6, DOG: 6, RELAX: 8, NAP: 6,
};

interface Rec {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviewCount?: number;
  driveHours: number;
  driveMiles: number;
  distanceFromRoute?: number;
  badges: string[];
  campgroundId?: string;
  overnightStopId?: string;
  experienceId?: string;
  chain?: string;
  category?: string;
}

interface RouteInfo {
  totalMiles: number;
  totalHours: number;
  targetMiles?: number;
  targetDriveHours?: number;
  targetCity?: string;
  targetState?: string;
  originName?: string;
}

interface Props {
  tripPlanId: string;
  onClose: () => void;
  onAddGenericStop: (data?: any) => void;
  onAddCampground: (data: { campgroundId: string; name: string; arrivalDate?: string; departureDate?: string; notes?: string }) => void;
  pitStopForm: any;
  setPitStopForm: (fn: any) => void;
}

export default function AddStopModal({ tripPlanId, onClose, onAddGenericStop, onAddCampground, pitStopForm, setPitStopForm }: Props) {
  const [mode, setMode] = useState<'type-select' | 'recs' | 'search' | 'confirm' | 'generic-form'>('type-select');
  const [selectedType, setSelectedType] = useState('');
  const [recs, setRecs] = useState<Rec[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Rec | null>(null);
  const [confirmForm, setConfirmForm] = useState({ arrivalDate: '', departureDate: '', duration: '30', notes: '' });

  // Drive hours slider
  const [driveHours, setDriveHours] = useState(8);
  const [sliderTouched, setSliderTouched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeInfo = STOP_TYPES.find(t => t.id === selectedType);

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    setPitStopForm((f: any) => ({ ...f, stopType: typeId }));

    if (MANUAL_ONLY.has(typeId)) {
      setMode('generic-form');
      return;
    }

    const defaultH = DEFAULT_HOURS[typeId] || 8;
    setDriveHours(defaultH);
    setSliderTouched(false);
    setMode('recs');
    loadRecs(typeId, defaultH);
  };

  const loadRecs = useCallback(async (type: string, hours?: number) => {
    if (!tripPlanId) return;
    setRecsLoading(true);
    setRecs([]);
    try {
      const params: any = { type };
      if (hours !== undefined) params.driveHours = hours;
      const { data } = await api.get(`/smart-trip/${tripPlanId}/stop-recommendations`, { params });
      setRecs(data.recommendations || []);
      setRouteInfo({
        totalMiles: data.totalMiles,
        totalHours: data.totalHours,
        targetMiles: data.targetMiles,
        targetDriveHours: data.targetDriveHours,
        targetCity: data.targetCity,
        targetState: data.targetState,
        originName: data.originName,
      });
    } catch {
      setRecs([]);
    } finally {
      setRecsLoading(false);
    }
  }, [tripPlanId]);

  // Debounced reload when slider changes
  const handleSliderChange = (newHours: number) => {
    setDriveHours(newHours);
    setSliderTouched(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadRecs(selectedType, newHours);
    }, 500);
  };

  const adjustHours = (delta: number) => {
    const max = MAX_HOURS[selectedType] || 14;
    const newH = Math.max(1, Math.min(max, Math.round((driveHours + delta) * 2) / 2));
    handleSliderChange(newH);
  };

  // Search
  const runSearch = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      if (selectedType === 'CAMPGROUND') {
        const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=8`);
        setSearchResults((Array.isArray(data) ? data : (data.campgrounds || [])).map((c: any) => ({
          id: c.id, name: c.name, city: c.city || c.location, state: c.state,
          lat: c.latitude, lng: c.longitude, rating: c.averageRating || c.googleRating || 0,
          badges: [], campgroundId: c.id, driveHours: 0, driveMiles: 0,
        })));
      } else {
        const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=4`);
        setSearchResults((Array.isArray(data) ? data : (data.campgrounds || [])).map((c: any) => ({
          id: c.id, name: c.name, city: c.city || c.location, state: c.state,
          rating: c.averageRating || 0, badges: [], campgroundId: c.id, driveHours: 0, driveMiles: 0,
        })));
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (mode !== 'search') return;
    const timer = setTimeout(() => runSearch(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectRec = (rec: Rec) => {
    setSelected(rec);
    setConfirmForm({ arrivalDate: '', departureDate: '', duration: OVERNIGHT_TYPES.has(selectedType) ? '' : '30', notes: '' });
    setMode('confirm');
  };

  const confirmAdd = () => {
    if (!selected) return;
    if (selected.campgroundId && OVERNIGHT_TYPES.has(selectedType)) {
      onAddCampground({
        campgroundId: selected.campgroundId,
        name: selected.name,
        arrivalDate: confirmForm.arrivalDate || undefined,
        departureDate: confirmForm.departureDate || undefined,
        notes: confirmForm.notes || undefined,
      });
    } else {
      // Build full location: "3060 Owingsville Rd, Mt Sterling, KY"
      const locationParts = [selected.address, selected.city, selected.state].filter(Boolean);
      const location = locationParts.join(', ') || '';
      const defaultDurations: Record<string, number> = {
        OVERNIGHT: 720, CAMPGROUND: 720, NAP: 120, GAS: 20,
        FOOD: 45, LUNCH: 45, SNACK: 20, RELAX: 60, WALK: 60,
        PLAY: 120, DOG: 30, REPAIR: 120, OTHER: 30,
      };
      const duration = OVERNIGHT_TYPES.has(selectedType)
        ? (defaultDurations[selectedType] || 720)
        : (parseInt(confirmForm.duration) || defaultDurations[selectedType] || 30);

      // Pass data directly to avoid stale state from setPitStopForm + setTimeout
      onAddGenericStop({
        name: selected.name,
        location,
        stopType: selectedType,
        notes: confirmForm.notes || '',
        estimatedDuration: duration,
        latitude: selected.lat || null,
        longitude: selected.lng || null,
        overnightStopId: selected.overnightStopId || null,
        campgroundId: selected.campgroundId || null,
        estimatedArrival: confirmForm.arrivalDate ? new Date(confirmForm.arrivalDate).toISOString() : null,
        departureDate: confirmForm.departureDate ? new Date(confirmForm.departureDate).toISOString() : null,
      });
    }
  };

  const goBack = () => {
    if (mode === 'confirm') setMode('recs');
    else if (mode === 'search') setMode('recs');
    else if (mode === 'recs' || mode === 'generic-form') setMode('type-select');
    else onClose();
  };

  const nights = confirmForm.arrivalDate && confirmForm.departureDate
    ? Math.max(0, Math.round((new Date(confirmForm.departureDate).getTime() - new Date(confirmForm.arrivalDate).getTime()) / 86400000))
    : null;

  const driveTimeBadgeColor = (hours: number) => {
    if (hours <= 4) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (hours <= 8) return 'bg-green-100 text-green-700 border-green-200';
    if (hours <= 12) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-orange-100 text-orange-700 border-orange-200';
  };

  const headerTitle = () => {
    if (mode === 'type-select') return 'Add Stop';
    if (mode === 'generic-form') return `Add ${typeInfo?.emoji || ''} ${typeInfo?.label || 'Stop'}`;
    if (mode === 'recs') return `${typeInfo?.emoji || ''} ${typeInfo?.label || 'Stops'} Along Your Route`;
    if (mode === 'search') return `🔍 Search ${typeInfo?.label || 'Stops'}`;
    if (mode === 'confirm') return `${typeInfo?.emoji || ''} Add ${typeInfo?.label || 'Stop'}`;
    return 'Add Stop';
  };

  // Approximate miles for preview (instant, no API call)
  const previewMiles = Math.round(driveHours * 55);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {mode !== 'type-select' && (
              <button onClick={goBack} className="text-gray-400 hover:text-gray-600 p-1">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="text-lg font-bold text-gray-900">{headerTitle()}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {/* ── TYPE SELECT ── */}
          {mode === 'type-select' && (
            <div className="grid grid-cols-4 gap-2">
              {STOP_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id)}
                  className="p-2.5 rounded-xl border-2 text-center transition hover:border-primary-300 hover:bg-primary-50 border-gray-200"
                >
                  <span className="text-xl block">{type.emoji}</span>
                  <span className="text-[10px] text-gray-600 font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── GENERIC FORM (for OTHER) ── */}
          {mode === 'generic-form' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={pitStopForm.name} onChange={(e) => setPitStopForm((f: any) => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="e.g., Love's Travel Stop" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={pitStopForm.location} onChange={(e) => setPitStopForm((f: any) => ({ ...f, location: e.target.value }))} className="input w-full" placeholder="City, State or Address" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <div className="flex gap-2">
                  <input type="number" value={pitStopForm.estimatedDuration} onChange={(e) => setPitStopForm((f: any) => ({ ...f, estimatedDuration: parseInt(e.target.value) || 0 }))} className="input flex-1" min="1" />
                  <select value={pitStopForm.durationUnit || 'hours'} onChange={(e) => setPitStopForm((f: any) => ({ ...f, durationUnit: e.target.value }))} className="input w-24">
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={pitStopForm.notes} onChange={(e) => setPitStopForm((f: any) => ({ ...f, notes: e.target.value }))} className="input w-full" rows={2} placeholder="Any notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={onAddGenericStop} disabled={!pitStopForm.name} className="btn btn-primary flex-1 disabled:opacity-50">Add to Itinerary</button>
              </div>
            </div>
          )}

          {/* ── RECOMMENDATIONS (all types) ── */}
          {mode === 'recs' && (
            <div className="space-y-3">
              {/* ── Drive hours slider ── */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-gray-600">{SLIDER_LABELS[selectedType] || 'How far into the drive?'}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustHours(-0.5)}
                    className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition flex-shrink-0"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-lg font-bold text-gray-900">{driveHours % 1 === 0 ? driveHours : driveHours.toFixed(1)} hours</span>
                  </div>
                  <button
                    onClick={() => adjustHours(0.5)}
                    className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="range"
                  min="1"
                  max={MAX_HOURS[selectedType] || 14}
                  step="0.5"
                  value={driveHours}
                  onChange={e => handleSliderChange(parseFloat(e.target.value))}
                  className="w-full accent-primary-500"
                />
                <div className="flex justify-between text-[9px] text-gray-400 px-0.5">
                  <span>2hr</span><span>4hr</span><span>6hr</span><span>8hr</span>
                  {(MAX_HOURS[selectedType] || 14) > 8 && <span>10hr</span>}
                  {(MAX_HOURS[selectedType] || 14) > 10 && <span>12hr</span>}
                  {(MAX_HOURS[selectedType] || 14) > 12 && <span>14hr</span>}
                </div>

                {/* Preview line */}
                <div className="text-xs text-primary-600 bg-primary-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                  <span>📍</span>
                  <span>
                    Searching near:{' '}
                    {routeInfo?.targetCity && routeInfo?.targetState
                      ? `~${routeInfo.targetMiles || previewMiles} mi mark · ${routeInfo.targetCity}, ${routeInfo.targetState} area`
                      : `~${previewMiles} mi mark`}
                  </span>
                </div>

                {!sliderTouched && (
                  <p className="text-[10px] text-gray-400 text-center">
                    Default: {DEFAULT_HOURS[selectedType] || 8}hr · Adjust for this stop
                  </p>
                )}
              </div>

              {/* Route context */}
              {routeInfo && routeInfo.totalMiles > 0 && (
                <div className="text-[10px] text-gray-400 text-center">
                  Total route: ~{routeInfo.totalMiles.toLocaleString()} mi · ~{routeInfo.totalHours}h drive
                </div>
              )}

              {/* Results */}
              {recsLoading ? (
                <div className="py-6 flex flex-col items-center gap-2">
                  <Loader className="w-5 h-5 animate-spin text-primary-400" />
                  <p className="text-sm text-gray-400">Finding {typeInfo?.label?.toLowerCase() || 'stops'}...</p>
                </div>
              ) : recs.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-2xl mb-2">{typeInfo?.emoji}</p>
                  <p className="text-sm text-gray-500">No {typeInfo?.label?.toLowerCase()} stops found at the {driveHours}h mark</p>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting the slider or search manually</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recs.map((rec) => (
                    <button
                      key={rec.id}
                      onClick={() => selectRec(rec)}
                      className="w-full text-left bg-gray-50 hover:bg-primary-50 border border-gray-200 hover:border-primary-300 rounded-xl p-3 transition group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 truncate">
                              {typeInfo?.emoji} {rec.name}
                            </span>
                            {rec.rating && rec.rating > 0 && <span className="text-xs text-amber-600 flex-shrink-0">⭐ {Math.round(rec.rating * 10) / 10}</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[rec.address, rec.city, rec.state].filter(Boolean).join(', ')}
                            {rec.distanceFromRoute !== undefined && rec.distanceFromRoute !== null && ` · ${rec.distanceFromRoute} mi from route`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {rec.driveHours > 0 && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${driveTimeBadgeColor(rec.driveHours)}`}>
                                ~{Math.round(rec.driveHours * 10) / 10}h from start
                              </span>
                            )}
                            {rec.chain && <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{rec.chain}</span>}
                          </div>
                          {rec.badges.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {rec.badges.slice(0, 4).map((b, i) => (
                                <span key={i} className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">{b}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-primary-500 font-medium flex-shrink-0 mt-1 group-hover:text-primary-700">Select →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Search fallback */}
              <div className="border-t border-gray-100 pt-3 mt-1">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMode('search'); setSearchQuery(''); setSearchResults([]); }}
                    className="flex-1 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 py-2 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" /> Search
                  </button>
                  <button
                    onClick={() => { setMode('generic-form'); setPitStopForm((f: any) => ({ ...f, stopType: selectedType, name: '', location: '' })); }}
                    className="flex-1 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 py-2 rounded-lg transition"
                  >
                    Enter manually
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── SEARCH ── */}
          {mode === 'search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`Search ${typeInfo?.label?.toLowerCase() || 'stops'}...`}
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary-400"
                />
                {searching && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary-400" />}
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((r: any) => (
                    <button key={r.id} onClick={() => selectRec(r)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary-50 transition flex items-center gap-3 border border-gray-100">
                      <span className="text-lg">{typeInfo?.emoji || '📍'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                        <p className="text-xs text-gray-400 truncate">{[r.city, r.state].filter(Boolean).join(', ')}</p>
                      </div>
                      {r.rating > 0 && <span className="text-xs text-amber-600 flex-shrink-0">⭐ {r.rating}</span>}
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <div className="py-4 text-center">
                  <p className="text-sm text-gray-400">No results for "{searchQuery}"</p>
                  <button onClick={() => { setPitStopForm((f: any) => ({ ...f, stopType: selectedType, name: searchQuery, location: '' })); setMode('generic-form'); }}
                    className="text-xs text-primary-500 hover:text-primary-700 mt-2">Add "{searchQuery}" as a custom stop →</button>
                </div>
              )}
            </div>
          )}

          {/* ── CONFIRM ── */}
          {mode === 'confirm' && selected && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{typeInfo?.emoji} {selected.name}</p>
                    <p className="text-xs text-gray-500">{[selected.address, selected.city, selected.state].filter(Boolean).join(', ')}</p>
                    {selected.rating && selected.rating > 0 && <span className="text-xs text-amber-600">⭐ {Math.round(selected.rating * 10) / 10}</span>}
                  </div>
                  <button onClick={() => setMode('recs')} className="text-xs text-primary-500 hover:text-primary-700 flex-shrink-0">Change</button>
                </div>
              </div>

              {OVERNIGHT_TYPES.has(selectedType) && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Arrival Date</label>
                      <input type="date" value={confirmForm.arrivalDate} onChange={e => setConfirmForm(f => ({ ...f, arrivalDate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Departure Date</label>
                      <input type="date" value={confirmForm.departureDate} onChange={e => setConfirmForm(f => ({ ...f, departureDate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
                    </div>
                  </div>
                  {nights !== null && nights > 0 && <p className="text-xs text-gray-500 -mt-2">{nights} night{nights !== 1 ? 's' : ''}</p>}
                </>
              )}

              {!OVERNIGHT_TYPES.has(selectedType) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">How long?</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {['15', '30', '60', '120'].map(d => (
                      <button key={d} onClick={() => setConfirmForm(f => ({ ...f, duration: d }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${confirmForm.duration === d ? 'bg-primary-100 text-primary-700 border-primary-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                        {parseInt(d) < 60 ? `${d} min` : `${parseInt(d) / 60} hr`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                <input type="text" value={confirmForm.notes} onChange={e => setConfirmForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={selectedType === 'REPAIR' ? 'Describe the issue...' : selectedType === 'CAMPGROUND' ? 'Site #, confirmation...' : 'Any notes...'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
              </div>

              <button onClick={confirmAdd} className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2.5 rounded-xl transition text-sm">
                Add to Itinerary
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
