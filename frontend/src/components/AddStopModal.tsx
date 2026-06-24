import { useState, useEffect } from 'react';
import { X, Search, Loader, ChevronLeft } from 'lucide-react';
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

interface CampgroundRec {
  campgroundId: string;
  name: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  rating: number;
  reviewCount: number;
  driveHoursFromOrigin: number;
  driveMilesFromOrigin: number;
  distanceFromRoute?: number;
  amenities: string[];
  imageUrl?: string;
}

interface Props {
  tripPlanId: string;
  onClose: () => void;
  onAddGenericStop: () => void;
  onAddCampground: (data: { campgroundId: string; name: string; arrivalDate?: string; departureDate?: string; notes?: string }) => void;
  pitStopForm: any;
  setPitStopForm: (fn: any) => void;
}

export default function AddStopModal({ tripPlanId, onClose, onAddGenericStop, onAddCampground, pitStopForm, setPitStopForm }: Props) {
  const [mode, setMode] = useState<'type-select' | 'generic-form' | 'campground-recs' | 'campground-search' | 'campground-confirm'>('type-select');
  const [recommendations, setRecommendations] = useState<CampgroundRec[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ totalMiles: number; totalHours: number; originName?: string; destName?: string; message?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCampground, setSelectedCampground] = useState<CampgroundRec | null>(null);
  const [cgForm, setCgForm] = useState({ arrivalDate: '', departureDate: '', notes: '' });

  const handleTypeSelect = (typeId: string) => {
    setPitStopForm((f: any) => ({ ...f, stopType: typeId }));
    if (typeId === 'CAMPGROUND') {
      setMode('campground-recs');
      loadRecommendations();
    } else {
      setMode('generic-form');
    }
  };

  const loadRecommendations = async () => {
    if (!tripPlanId) return;
    setRecsLoading(true);
    try {
      const { data } = await api.get(`/smart-trip/${tripPlanId}/campground-recommendations`);
      setRecommendations(data.recommendations || []);
      setRouteInfo({ totalMiles: data.totalMiles, totalHours: data.totalHours, originName: data.originName, destName: data.destName, message: data.message });
    } catch {
      setRecommendations([]);
    } finally {
      setRecsLoading(false);
    }
  };

  const searchCampgrounds = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=8`);
      const list = Array.isArray(data) ? data : (data.campgrounds || []);
      setSearchResults(list);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (mode !== 'campground-search') return;
    const timer = setTimeout(() => searchCampgrounds(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectCampground = (cg: any) => {
    setSelectedCampground({
      campgroundId: cg.campgroundId || cg.id,
      name: cg.name,
      city: cg.city,
      state: cg.state,
      latitude: cg.latitude,
      longitude: cg.longitude,
      rating: cg.rating || cg.averageRating || cg.googleRating || 0,
      reviewCount: cg.reviewCount || cg.ratingCount || cg.googleReviewCount || 0,
      driveHoursFromOrigin: cg.driveHoursFromOrigin || 0,
      driveMilesFromOrigin: cg.driveMilesFromOrigin || 0,
      distanceFromRoute: cg.distanceFromRoute,
      amenities: cg.amenities || [],
      imageUrl: cg.imageUrl,
    });
    setCgForm({ arrivalDate: '', departureDate: '', notes: '' });
    setMode('campground-confirm');
  };

  const confirmAddCampground = () => {
    if (!selectedCampground) return;
    onAddCampground({
      campgroundId: selectedCampground.campgroundId,
      name: selectedCampground.name,
      arrivalDate: cgForm.arrivalDate || undefined,
      departureDate: cgForm.departureDate || undefined,
      notes: cgForm.notes || undefined,
    });
  };

  const nights = cgForm.arrivalDate && cgForm.departureDate
    ? Math.max(0, Math.round((new Date(cgForm.departureDate).getTime() - new Date(cgForm.arrivalDate).getTime()) / 86400000))
    : null;

  const driveTimeBadgeColor = (hours: number) => {
    if (hours <= 6) return 'bg-green-100 text-green-700 border-green-200';
    if (hours <= 8) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-orange-100 text-orange-700 border-orange-200';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {mode !== 'type-select' && (
              <button
                onClick={() => {
                  if (mode === 'campground-confirm') setMode('campground-recs');
                  else if (mode === 'campground-search') setMode('campground-recs');
                  else setMode('type-select');
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="text-lg font-bold text-gray-900">
              {mode === 'type-select' && 'Add Stop'}
              {mode === 'generic-form' && `Add ${STOP_TYPES.find(t => t.id === pitStopForm.stopType)?.label || 'Stop'}`}
              {mode === 'campground-recs' && '🏕️ Campgrounds Along Your Route'}
              {mode === 'campground-search' && '🔍 Search Campgrounds'}
              {mode === 'campground-confirm' && '🏕️ Add Campground'}
            </h3>
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

          {/* ── GENERIC FORM ── */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">How long are you staying?</label>
                <div className="flex gap-2">
                  <input type="number" value={pitStopForm.estimatedDuration} onChange={(e) => setPitStopForm((f: any) => ({ ...f, estimatedDuration: parseInt(e.target.value) || 0 }))} className="input flex-1" min="1" placeholder="2" />
                  <select value={pitStopForm.durationUnit || 'hours'} onChange={(e) => setPitStopForm((f: any) => ({ ...f, durationUnit: e.target.value }))} className="input w-24">
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={pitStopForm.notes} onChange={(e) => setPitStopForm((f: any) => ({ ...f, notes: e.target.value }))} className="input w-full" rows={2} placeholder="Any notes about this stop..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={onAddGenericStop} disabled={!pitStopForm.name} className="btn btn-primary flex-1 disabled:opacity-50">Add to Itinerary</button>
              </div>
            </div>
          )}

          {/* ── CAMPGROUND RECOMMENDATIONS ── */}
          {mode === 'campground-recs' && (
            <div className="space-y-3">
              {/* Route info */}
              {routeInfo && routeInfo.totalMiles > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  <p className="font-medium">Your route: ~{routeInfo.totalMiles.toLocaleString()} mi · ~{routeInfo.totalHours}h drive</p>
                  <p className="text-blue-500 mt-0.5">Showing stops between hour 4 and hour 12 of your journey</p>
                </div>
              )}

              {recsLoading ? (
                <div className="py-8 flex flex-col items-center gap-2">
                  <Loader className="w-6 h-6 animate-spin text-primary-400" />
                  <p className="text-sm text-gray-400">Finding campgrounds along your route...</p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-gray-500">{routeInfo?.message || 'No campground recommendations available for this route.'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recommendations.map((cg) => (
                    <button
                      key={cg.campgroundId}
                      onClick={() => selectCampground(cg)}
                      className="w-full text-left bg-gray-50 hover:bg-primary-50 border border-gray-200 hover:border-primary-300 rounded-xl p-3 transition group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 truncate">🏕️ {cg.name}</span>
                            {cg.rating > 0 && <span className="text-xs text-amber-600 flex-shrink-0">⭐ {cg.rating}</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[cg.city, cg.state].filter(Boolean).join(', ')}
                            {cg.distanceFromRoute !== undefined && cg.distanceFromRoute !== null && ` · ${cg.distanceFromRoute} mi from route`}
                          </p>
                          {cg.driveHoursFromOrigin > 0 && (
                            <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border mt-1 ${driveTimeBadgeColor(cg.driveHoursFromOrigin)}`}>
                              ~{cg.driveHoursFromOrigin}h from start
                            </span>
                          )}
                          {cg.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {cg.amenities.slice(0, 4).map((a, i) => (
                                <span key={i} className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">{a}</span>
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

              {/* Search instead */}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-xs text-gray-400 mb-2">Not seeing what you want?</p>
                <button
                  onClick={() => { setMode('campground-search'); setSearchQuery(''); setSearchResults([]); }}
                  className="w-full text-sm font-medium text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 border border-primary-200 py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" /> Search all campgrounds
                </button>
              </div>
            </div>
          )}

          {/* ── CAMPGROUND SEARCH ── */}
          {mode === 'campground-search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search campgrounds by name or location..."
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary-400"
                />
                {searching && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary-400" />}
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((cg: any) => (
                    <button
                      key={cg.id}
                      onClick={() => selectCampground(cg)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary-50 transition flex items-center gap-3 border border-gray-100"
                    >
                      <span className="text-lg">🏕️</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{cg.name}</p>
                        <p className="text-xs text-gray-400 truncate">{[cg.city || cg.location, cg.state].filter(Boolean).join(', ')}</p>
                      </div>
                      {(cg.averageRating > 0 || cg.googleRating > 0) && (
                        <span className="text-xs text-amber-600 flex-shrink-0">⭐ {cg.averageRating || cg.googleRating}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No campgrounds found for "{searchQuery}"</p>
              )}
            </div>
          )}

          {/* ── CAMPGROUND CONFIRM ── */}
          {mode === 'campground-confirm' && selectedCampground && (
            <div className="space-y-4">
              {/* Selected campground summary */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">🏕️ {selectedCampground.name}</p>
                    <p className="text-xs text-gray-500">{[selectedCampground.city, selectedCampground.state].filter(Boolean).join(', ')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedCampground.rating > 0 && <span className="text-xs text-amber-600">⭐ {selectedCampground.rating}</span>}
                      {selectedCampground.reviewCount > 0 && <span className="text-xs text-gray-400">{selectedCampground.reviewCount} reviews</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setMode('campground-recs')}
                    className="text-xs text-primary-500 hover:text-primary-700 flex-shrink-0"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Date pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Arrival Date</label>
                  <input
                    type="date"
                    value={cgForm.arrivalDate}
                    onChange={e => setCgForm(f => ({ ...f, arrivalDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Departure Date</label>
                  <input
                    type="date"
                    value={cgForm.departureDate}
                    onChange={e => setCgForm(f => ({ ...f, departureDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
              </div>
              {nights !== null && nights > 0 && (
                <p className="text-xs text-gray-500 -mt-2">{nights} night{nights !== 1 ? 's' : ''}</p>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={cgForm.notes}
                  onChange={e => setCgForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Site #, confirmation, etc."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                />
              </div>

              {/* Add button */}
              <button
                onClick={confirmAddCampground}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2.5 rounded-xl transition text-sm"
              >
                Add to Itinerary
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
