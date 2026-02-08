import { useState } from 'react';
import { Fuel, Moon, Utensils, MapPin, Star, Trash2, ChevronDown, ChevronUp, Loader2, Navigation, Compass, AlertTriangle, Settings, Route } from 'lucide-react';
import api from '../services/api';

interface SmartStopsProps {
  tripPlan: any;
  eventId: string;
  event?: any;
  onAddPitStop: (stop: any) => void;
}

interface StopPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  totalRatings?: number;
  isOpen?: boolean;
  placeId: string;
  priceLevel?: number;
  note?: string;
  parkingType?: string;
  photoRef?: string;
}

const STOP_CONFIG: Record<string, { icon: string; label: string; gradient: string; dot: string; bg: string; text: string }> = {
  GAS: { icon: '⛽', label: 'Fuel Stop', gradient: 'from-red-500 to-orange-500', dot: 'bg-red-500', bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  OVERNIGHT: { icon: '🏕️', label: 'Overnight', gradient: 'from-indigo-500 to-purple-500', dot: 'bg-indigo-500', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
  FOOD_REST: { icon: '🍽️', label: 'Food & Rest', gradient: 'from-amber-500 to-orange-500', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  DUMP_STATION: { icon: '🚿', label: 'Dump Station', gradient: 'from-emerald-500 to-green-500', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  ATTRACTION: { icon: '⭐', label: 'Attraction', gradient: 'from-violet-500 to-fuchsia-500', dot: 'bg-violet-500', bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700' },
};

export default function SmartStops({ tripPlan, eventId, event, onAddPitStop }: SmartStopsProps) {
  const [loading, setLoading] = useState(false);
  const [smartStops, setSmartStops] = useState<any>(null);
  const [expandedStop, setExpandedStop] = useState<number | null>(null);
  const [addedStops, setAddedStops] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  
  const [rvSettings, setRvSettings] = useState({ mpg: 10, tankGallons: 50, drivingHoursPerDay: 8 });
  const [stopTypes, setStopTypes] = useState({
    gas: true, overnight: true, food: true, dump: false, attractions: true,
  });

  const handleFindStops = async () => {
    setLoading(true);
    try {
      let polyline = tripPlan?.routePolyline;
      let totalMiles = tripPlan?.distanceMiles;
      let totalMinutes = tripPlan?.durationMinutes;

      if (!polyline) {
        let startLat = tripPlan?.startLatitude;
        let startLng = tripPlan?.startLongitude;
        let endLat = tripPlan?.endLatitude;
        let endLng = tripPlan?.endLongitude;

        if (!endLat && event?.campground?.latitude) {
          endLat = event.campground.latitude;
          endLng = event.campground.longitude;
        }
        if (!startLat && tripPlan?.startLocation) {
          try {
            const { data: geoData } = await api.get('/drive-planner/geocode?q=' + encodeURIComponent(tripPlan.startLocation));
            if (geoData.items?.[0]) { startLat = geoData.items[0].position.lat; startLng = geoData.items[0].position.lng; }
          } catch (e) { console.error('Geocode start error:', e); }
        }
        if (!endLat && tripPlan?.endLocation) {
          try {
            const { data: geoData } = await api.get('/drive-planner/geocode?q=' + encodeURIComponent(tripPlan.endLocation));
            if (geoData.items?.[0]) { endLat = geoData.items[0].position.lat; endLng = geoData.items[0].position.lng; }
          } catch (e) { console.error('Geocode end error:', e); }
        }
        if (!startLat || !endLat) { alert('Could not determine start and end locations.'); setLoading(false); return; }

        const { data: routeData } = await api.post('/drive-planner/google-route', {
          origin: { lat: startLat, lng: startLng }, destination: { lat: endLat, lng: endLng },
        });
        polyline = routeData.polyline;
        totalMiles = parseFloat(routeData.distance.miles);
        totalMinutes = routeData.duration.minutes;
      }

      if (!polyline || !totalMiles) { alert('Could not calculate route.'); setLoading(false); return; }

      const { data } = await api.post('/drive-planner/smart-stops', {
        polyline, totalMiles, totalMinutes,
        mpg: rvSettings.mpg, tankGallons: rvSettings.tankGallons,
        drivingHoursPerDay: rvSettings.drivingHoursPerDay,
        stopTypes: Object.entries(stopTypes).filter(([_, v]) => v).map(([k]) => k),
      });
      setSmartStops(data);
    } catch (error) {
      console.error('Smart stops error:', error);
      alert('Failed to find stops along route');
    } finally { setLoading(false); }
  };

  const handleAddStop = async (place: StopPlace, stopType: string, notes: string) => {
    try {
      await api.post(`/trip-planner/trip/${tripPlan.id}/pit-stop`, {
        name: place.name, location: place.address, latitude: place.lat, longitude: place.lng,
        stopType, notes, estimatedDuration: stopType === 'OVERNIGHT' ? 600 : stopType === 'GAS' ? 20 : 45,
      });
      setAddedStops(prev => new Set([...prev, place.placeId]));
      onAddPitStop(place);
    } catch (error: any) { alert(error.response?.data?.error || 'Failed to add stop'); }
  };

  const renderPlaceCard = (place: StopPlace, stopType: string, extraNote?: string) => {
    const isAdded = addedStops.has(place.placeId);
    return (
      <div key={place.placeId} className="group flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">{place.name}</p>
            {place.isOpen !== undefined && (
              <span className={`shrink-0 w-2 h-2 rounded-full ${place.isOpen ? 'bg-green-400' : 'bg-red-400'}`} title={place.isOpen ? 'Open now' : 'Closed'} />
            )}
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">{place.address}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {place.rating && (
              <span className="flex items-center gap-1 text-xs">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="font-medium text-gray-700">{place.rating.toFixed(1)}</span>
                {place.totalRatings && <span className="text-gray-400">({place.totalRatings > 999 ? `${(place.totalRatings/1000).toFixed(1)}k` : place.totalRatings})</span>}
              </span>
            )}
            {place.parkingType && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">{place.parkingType}</span>
            )}
          </div>
          {(place.note || extraNote) && (
            <p className="text-[11px] text-amber-600 mt-1.5 flex items-start gap-1 leading-tight">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              {place.note || extraNote}
            </p>
          )}
        </div>
        <button
          onClick={() => handleAddStop(place, stopType, place.note || extraNote || '')}
          disabled={isAdded}
          className={`shrink-0 mt-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            isAdded 
              ? 'bg-green-50 text-green-600 border border-green-200' 
              : 'bg-gray-900 text-white hover:bg-gray-700 shadow-sm hover:shadow'
          }`}
        >
          {isAdded ? '✓ Added' : '+ Add Stop'}
        </button>
      </div>
    );
  };

  const getPlacesForStop = (stop: any) => {
    if (stop.places) return { places: stop.places, sections: null };
    const sections: { title: string; places: StopPlace[]; note?: string }[] = [];
    if (stop.campgrounds?.length) sections.push({ title: '🏕️ RV Parks & Campgrounds', places: stop.campgrounds });
    if (stop.freeParking?.length) sections.push({ title: '🅿️ Free Overnight Parking', places: stop.freeParking, note: 'note' });
    if (stop.restaurants?.length) sections.push({ title: '🍽️ Restaurants', places: stop.restaurants });
    if (stop.restAreas?.length) sections.push({ title: '🅿️ Rest Areas', places: stop.restAreas });
    return { places: null, sections };
  };

  const getStopCount = (stop: any) => {
    if (stop.places) return stop.places.length;
    return (stop.campgrounds?.length || 0) + (stop.freeParking?.length || 0) + (stop.restaurants?.length || 0) + (stop.restAreas?.length || 0);
  };

  // Pre-results view
  if (!smartStops) {
    return (
      <div className="space-y-4">
        {/* Settings Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Route className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-sm">Smart Route Planner</h4>
              <p className="text-[11px] text-gray-400">AI-powered stops for your RV journey</p>
            </div>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} 
            className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {showSettings && (
          <div className="bg-gray-50 rounded-2xl p-4 space-y-4 border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">RV Profile</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'mpg', label: 'Fuel Economy', unit: 'mpg', hint: 'Class A: 6-10 · Class C: 10-14', min: 3, max: 30, step: 0.5 },
                { key: 'tankGallons', label: 'Tank Size', unit: 'gal', hint: `Range: ~${Math.round(rvSettings.mpg * rvSettings.tankGallons)} miles`, min: 10, max: 150, step: 5 },
                { key: 'drivingHoursPerDay', label: 'Drive Time', unit: 'hrs/day', hint: 'Recommended: 6-8 hrs', min: 4, max: 14, step: 1 },
              ].map(({ key, label, unit, hint, min, max, step }) => (
                <div key={key} className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
                  <div className="relative">
                    <input type="number" value={(rvSettings as any)[key]}
                      onChange={(e) => setRvSettings(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                      className="w-full text-sm font-semibold border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      min={min} max={max} step={step} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">{unit}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">{hint}</p>
                </div>
              ))}
            </div>
            
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-1">Find Along Route</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'gas', icon: '⛽', label: 'Gas' },
                { key: 'overnight', icon: '🏕️', label: 'Overnight' },
                { key: 'food', icon: '🍽️', label: 'Food' },
                { key: 'attractions', icon: '⭐', label: 'Attractions' },
                { key: 'dump', icon: '🚿', label: 'Dump' },
              ].map(({ key, icon, label }) => (
                <button key={key}
                  onClick={() => setStopTypes(prev => ({ ...prev, [key]: !(prev as any)[key] }))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                    (stopTypes as any)[key] 
                      ? 'bg-white text-gray-900 border-gray-300 shadow-sm' 
                      : 'bg-transparent text-gray-400 border-gray-100 hover:border-gray-200'
                  }`}>
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleFindStops} disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl font-bold text-sm hover:from-gray-800 hover:to-gray-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2.5 shadow-lg shadow-gray-900/20 hover:shadow-xl hover:shadow-gray-900/25">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing your route...</>
          ) : (
            <><Navigation className="w-4 h-4" /> Find Smart Stops Along Route</>
          )}
        </button>
      </div>
    );
  }

  // Results view
  const s = smartStops.summary;
  return (
    <div className="space-y-5">
      {/* Summary Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-5">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 rounded-full bg-blue-400 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-indigo-400 blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-sm tracking-wide flex items-center gap-2">
              <Route className="w-4 h-4 text-blue-400" /> Trip Overview
            </h4>
            <button onClick={() => { setSmartStops(null); }} className="text-xs text-gray-400 hover:text-white transition">← New search</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { value: `${s.totalMiles}`, label: 'miles', color: 'text-blue-300' },
              { value: s.totalDays === 1 ? 'Day Trip' : `${s.totalDays} Days`, label: s.totalDays === 1 ? '' : 'driving', color: 'text-indigo-300' },
              { value: `${s.gasStopsNeeded}`, label: 'fuel stops', color: 'text-red-300' },
              { value: `$${s.estimatedFuelCost}`, label: `~${s.estimatedGallons} gal`, color: 'text-emerald-300' },
            ].map(({ value, label, color }, i) => (
              <div key={i} className="text-center">
                <p className={`text-xl font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {s.overnightStopsNeeded > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-400" />
              <p className="text-xs text-gray-300">{s.overnightStopsNeeded} overnight stop{s.overnightStopsNeeded > 1 ? 's' : ''} recommended</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings & search again */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          {smartStops.stops.length} stop{smartStops.stops.length !== 1 ? 's' : ''} along your route
        </p>
        <button onClick={() => setShowSettings(!showSettings)} 
          className={`p-1.5 rounded-lg transition-all ${showSettings ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {showSettings && (
        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'mpg', label: 'MPG', min: 3, max: 30, step: 0.5 },
              { key: 'tankGallons', label: 'Tank (gal)', min: 10, max: 150, step: 5 },
              { key: 'drivingHoursPerDay', label: 'Hrs/day', min: 4, max: 14, step: 1 },
            ].map(({ key, label, min, max, step }) => (
              <div key={key}>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">{label}</label>
                <input type="number" value={(rvSettings as any)[key]}
                  onChange={(e) => setRvSettings(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-full text-sm font-semibold border rounded-xl px-3 py-2 mt-1" min={min} max={max} step={step} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries({ gas: '⛽ Gas', overnight: '🏕️ Night', food: '🍽️ Food', attractions: '⭐ Sights', dump: '🚿 Dump' }).map(([key, label]) => (
              <button key={key} onClick={() => setStopTypes(prev => ({ ...prev, [key]: !(prev as any)[key] }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${(stopTypes as any)[key] ? 'bg-white border-gray-300 shadow-sm text-gray-900' : 'text-gray-400 border-gray-100'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={handleFindStops} disabled={loading}
            className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold disabled:opacity-50">
            {loading ? 'Searching...' : 'Update Results'}
          </button>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Start marker */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 z-10">
            <span className="text-white text-xs font-black">A</span>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">{tripPlan?.startLocation || 'Start'}</p>
            <p className="text-[10px] text-gray-400">Mile 0</p>
          </div>
        </div>

        {/* Stops */}
        {smartStops.stops.map((stop: any, idx: number) => {
          const config = STOP_CONFIG[stop.type] || STOP_CONFIG.GAS;
          const isExpanded = expandedStop === idx;
          const { places, sections } = getPlacesForStop(stop);
          const count = getStopCount(stop);
          const stopType = stop.type === 'FOOD_REST' ? 'FOOD' : stop.type;

          return (
            <div key={idx} className="relative pl-11 pb-4">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gradient-to-b from-gray-200 to-gray-100" />
              
              {/* Timeline dot */}
              <div className={`absolute left-[8px] top-1 w-4 h-4 rounded-full ${config.dot} ring-4 ring-white shadow z-10`} />
              
              {/* Stop card */}
              <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${isExpanded ? 'shadow-lg ' + config.bg : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                <button onClick={() => setExpandedStop(isExpanded ? null : idx)}
                  className="w-full flex items-center gap-3 p-3 text-left">
                  <span className="text-xl">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{stop.reason}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Mile {stop.milesFromStart} · {count} option{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-gray-900 text-white rotate-180' : 'bg-gray-100 text-gray-400'}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {/* Single places array (gas, dump, attractions) */}
                    {places?.map((place: StopPlace) => 
                      renderPlaceCard(place, stopType, 
                        stop.type === 'GAS' ? 'Look for truck lanes for easier RV access' :
                        stop.type === 'ATTRACTION' ? 'Recommended detour along your route' : undefined
                      )
                    )}
                    
                    {/* Sectioned places (overnight, food_rest) */}
                    {sections?.map((section, sIdx) => (
                      <div key={sIdx} className={sIdx > 0 ? 'pt-2' : ''}>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{section.title}</p>
                        <div className="space-y-2">
                          {section.places.map((place: StopPlace) => renderPlaceCard(place, stopType, section.note === 'note' ? place.note : undefined))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* End marker */}
        <div className="flex items-center gap-3 pl-0 pt-2">
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 z-10">
            <span className="text-white text-xs font-black">B</span>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">{tripPlan?.endLocation || event?.campground?.name || 'Destination'}</p>
            <p className="text-[10px] text-gray-400">Mile {s.totalMiles}</p>
          </div>
        </div>
      </div>

      {smartStops.stops.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-2xl">
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-bold text-gray-900">Short trip — no stops needed!</p>
          <p className="text-xs text-gray-400 mt-1">You've got enough fuel to make it in one shot</p>
        </div>
      )}
    </div>
  );
}
