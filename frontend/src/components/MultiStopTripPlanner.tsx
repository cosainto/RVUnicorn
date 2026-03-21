import { useState, useEffect } from 'react';
import { Plus, Trash2, MapPin, Calendar, Navigation, ChevronRight, Clock, Search, X } from 'lucide-react';
import api from '../services/api';

interface Campground {
  id: string;
  name: string;
  location: string;
  state: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
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
  campground?: Campground;
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
  const [campgroundSearch, setCampgroundSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Campground[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCampground, setSelectedCampground] = useState<Campground | null>(null);
  const [newStopDates, setNewStopDates] = useState({ arrivalDate: '', departureDate: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadItinerary(); }, [tripPlanId]);

  const loadItinerary = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/trip-planner/trip/${tripPlanId}/full-itinerary`);
      setWaypoints(data.waypoints || []);
      setLegs(data.legs || []);
      setTotalMiles(data.totalMiles || 0);
    } catch (error) {
      console.error('Load itinerary error:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchCampgrounds = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      setSearching(true);
      const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=8`);
      setSearchResults(Array.isArray(data) ? data : (data.campgrounds || []));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchCampgrounds(campgroundSearch), 350);
    return () => clearTimeout(timer);
  }, [campgroundSearch]);

  const resetModal = () => {
    setShowAddStop(false);
    setSelectedCampground(null);
    setCampgroundSearch('');
    setSearchResults([]);
    setNewStopDates({ arrivalDate: '', departureDate: '', notes: '' });
    setInsertAt(null);
  };

  const handleAddStop = async () => {
    if (!selectedCampground || !newStopDates.arrivalDate) return;
    try {
      setSaving(true);
      await api.post(`/trip-planner/trip/${tripPlanId}/campground-stop`, {
        campgroundId: selectedCampground.id,
        arrivalDate: newStopDates.arrivalDate,
        departureDate: newStopDates.departureDate || null,
        notes: newStopDates.notes || null,
        orderIndex: insertAt !== null ? insertAt : undefined,
      });
      await loadItinerary();
      onUpdate?.();
      resetModal();
    } catch (error) {
      console.error('Add stop error:', error);
      alert('Failed to add stop');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStop = async (stopId: string) => {
    if (!confirm('Remove this stop?')) return;
    try {
      await api.delete(`/trip-planner/pit-stop/${stopId}`);
      await loadItinerary();
      onUpdate?.();
    } catch (error) {
      console.error('Delete stop error:', error);
    }
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
  };

  const formatDate = (d?: string) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const stayNights = (arrival?: string, departure?: string) => {
    if (!arrival || !departure) return null;
    const diff = Math.round((new Date(departure).getTime() - new Date(arrival).getTime()) / 86400000);
    return diff > 0 ? `${diff} night${diff !== 1 ? 's' : ''}` : null;
  };

  const stopIcon = (type: string) => {
    const icons: Record<string, string> = {
      HOME: '🏠', FINAL_DESTINATION: '🏁', CAMPGROUND: '🏕️',
      RV_PARK: '🚐', HARVEST_HOST: '🌾', BOONDOCKING: '⛺',
    };
    return icons[type] || '📍';
  };

  const stopBg = (type: string) => {
    if (type === 'HOME') return 'border-gray-200 bg-gray-50';
    if (type === 'FINAL_DESTINATION') return 'border-primary-200 bg-primary-50';
    return 'border-amber-200 bg-amber-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Multi-Stop Itinerary</h3>
          {totalMiles > 0 && (
            <p className="text-sm text-gray-500">
              {totalMiles.toLocaleString()} total miles &middot; {legs.length} leg{legs.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => { setInsertAt(null); setShowAddStop(true); }}
          className="btn btn-primary btn-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Stop
        </button>
      </div>

      {waypoints.length === 0 ? (
        <div className="text-center py-10 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
          <Navigation className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="font-medium">No intermediate stops yet</p>
          <p className="text-sm mt-1">Add campgrounds to build your multi-leg journey</p>
        </div>
      ) : (
        <div>
          {waypoints.map((wp, idx) => {
            const leg = legs.find(l => l.from === idx);
            const isLast = idx === waypoints.length - 1;
            const nights = stayNights(wp.arrivalDate, wp.departureDate);

            return (
              <div key={`${wp.id || wp.type}-${idx}`}>
                <div className={`flex items-start gap-3 p-4 rounded-xl border-2 transition ${stopBg(wp.type)}`}>
                  <div className="flex flex-col items-center pt-0.5">
                    <span className="text-2xl">{stopIcon(wp.type)}</span>
                    {!isLast && <div className="w-0.5 h-6 bg-gray-300 mt-1"></div>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{wp.name}</p>
                        {wp.location && <p className="text-sm text-gray-500 truncate">{wp.location}</p>}
                      </div>
                      {wp.id && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            title="Insert stop after this"
                            onClick={() => { setInsertAt(wp.orderIndex + 1); setShowAddStop(true); }}
                            className="p-1 text-gray-400 hover:text-primary-600 transition"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStop(wp.id!)}
                            className="p-1 text-gray-400 hover:text-red-500 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {(wp.arrivalDate || wp.departureDate) && (
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        {wp.arrivalDate && <span>Arrive {formatDate(wp.arrivalDate)}</span>}
                        {wp.departureDate && (
                          <>
                            <ChevronRight className="w-3 h-3" />
                            <span>Leave {formatDate(wp.departureDate)}</span>
                          </>
                        )}
                        {nights && (
                          <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full font-medium">
                            {nights}
                          </span>
                        )}
                      </div>
                    )}
                    {wp.notes && <p className="text-xs text-gray-500 mt-1 italic">{wp.notes}</p>}
                  </div>
                </div>

                {leg && (
                  <div className="flex items-center gap-2 my-1 pl-14 text-xs text-gray-400">
                    <Navigation className="w-3 h-3" />
                    <span className="font-medium text-gray-600">{leg.distanceMiles} mi</span>
                    <span>&middot;</span>
                    <Clock className="w-3 h-3" />
                    <span>~{formatDuration(leg.durationMinutes)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddStop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-5 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {insertAt !== null ? 'Insert Stop' : 'Add Campground Stop'}
              </h3>
              <button onClick={resetModal}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {!selectedCampground ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Campground</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      autoFocus
                      type="text"
                      value={campgroundSearch}
                      onChange={e => setCampgroundSearch(e.target.value)}
                      placeholder="Search by name or location..."
                      className="input pl-9"
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                      </div>
                    )}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-100">
                      {searchResults.map(cg => (
                        <button
                          key={cg.id}
                          onClick={() => { setSelectedCampground(cg); setCampgroundSearch(''); setSearchResults([]); }}
                          className="w-full text-left px-4 py-3 hover:bg-primary-50 flex items-center gap-3 transition"
                        >
                          <MapPin className="w-4 h-4 text-primary-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{cg.name}</p>
                            <p className="text-xs text-gray-500 truncate">{cg.location}{cg.state ? `, ${cg.state}` : ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {campgroundSearch.length >= 2 && !searching && searchResults.length === 0 && (
                    <p className="mt-2 text-sm text-gray-500 text-center py-2">No campgrounds found</p>
                  )}
                </div>
              ) : (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{selectedCampground.name}</p>
                      <p className="text-xs text-gray-500">{selectedCampground.location}, {selectedCampground.state}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCampground(null)} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date *</label>
                  <input
                    type="date"
                    value={newStopDates.arrivalDate}
                    onChange={e => setNewStopDates(p => ({ ...p, arrivalDate: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
                  <input
                    type="date"
                    value={newStopDates.departureDate}
                    onChange={e => setNewStopDates(p => ({ ...p, departureDate: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={newStopDates.notes}
                  onChange={e => setNewStopDates(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Site #, hookup type, etc."
                  className="input"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddStop}
                  disabled={!selectedCampground || !newStopDates.arrivalDate || saving}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                >
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
