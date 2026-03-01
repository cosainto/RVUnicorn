import { useState, useEffect } from 'react';
import { Moon, MapPin, Navigation, Filter, Plus, Search } from 'lucide-react';
import api from '../services/api';
import OvernightStopCard from './OvernightStopCard';
import HarvestHostsTab from './HarvestHostsTab';

const STOP_TYPES = ['All', 'WALMART', 'CRACKER_BARREL', 'CABELAS', 'FLYING_J', 'LOVES', 'PILOT', 'REST_AREA', 'CASINO', 'OTHER'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function OvernightPlanner() {
  const [activeTab, setActiveTab] = useState<'stops' | 'harvest'>('stops');
  const [stops, setStops] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('');
  const [maxMiles, setMaxMiles] = useState<number>(300);
  const [maxHours, setMaxHours] = useState<number>(6);
  const [useHours, setUseHours] = useState(true);
  const [locationSearch, setLocationSearch] = useState('');
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [locating, setLocating] = useState(false);

  const fetchStops = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
        params.append('radius', maxMiles.toString());
      } else if (stateFilter) {
        params.append('state', stateFilter);
      }
      if (typeFilter !== 'All') params.append('type', typeFilter);
      const { data } = await api.get('/overnight-stops?' + params.toString());
      setStops(data);
    } catch (err) {
      console.error('Failed to fetch stops:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLocation || stateFilter) fetchStops();
  }, [userLocation, stateFilter, typeFilter]);

  const handleGeolocate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        alert('Could not get your location. Try selecting a state instead.');
        setLocating(false);
      }
    );
  };

  const handleAddToPitStops = (stop: any) => {
    // Copy coordinates to clipboard for now — future: integrate with trip planner
    const text = stop.name + ', ' + stop.address;
    navigator.clipboard?.writeText(text);
    alert('📋 Copied "' + text + '" — paste into your trip planner!');
  };

  const drivingRangeInfo = useHours
    ? 'Based on ' + maxHours + ' hrs driving at ~55 mph ≈ ' + Math.round(maxHours * 55) + ' miles'
    : 'Showing stops within ' + maxMiles + ' miles';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Moon className="w-6 h-6 text-indigo-600" /> Overnight Stop Planner
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Find safe places to sleep on the road — free parking lots, harvest hosts, truck stops, and more
        </p>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveTab('stops')}
          className={"px-4 py-2 text-sm font-semibold rounded-full transition " + (activeTab === 'stops' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300')}>
          🅿️ Free Overnight Stops
        </button>
        <button onClick={() => setActiveTab('harvest')}
          className={"px-4 py-2 text-sm font-semibold rounded-full transition " + (activeTab === 'harvest' ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300')}>
          🌾 Harvest Hosts
        </button>
      </div>

      {activeTab === 'harvest' && <HarvestHostsTab />}

      {activeTab === 'stops' && (
        <div className="space-y-5">
          {/* Driving range controls */}
          <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 space-y-4">
            <p className="text-sm font-bold text-indigo-900">How far do you want to drive before stopping?</p>
            
            {/* Toggle hours vs miles */}
            <div className="flex bg-white rounded-lg border border-indigo-200 p-0.5 w-fit">
              <button onClick={() => setUseHours(true)}
                className={"px-4 py-1.5 rounded-md text-sm font-semibold transition " + (useHours ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700')}>
                ⏰ By Hours
              </button>
              <button onClick={() => setUseHours(false)}
                className={"px-4 py-1.5 rounded-md text-sm font-semibold transition " + (!useHours ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700')}>
                📏 By Miles
              </button>
            </div>

            {useHours ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-indigo-800">Max driving hours per day</label>
                  <span className="text-sm font-bold text-indigo-900">{maxHours} hrs</span>
                </div>
                <input type="range" min={2} max={14} step={1} value={maxHours}
                  onChange={e => { setMaxHours(parseInt(e.target.value)); setMaxMiles(parseInt(e.target.value) * 55); }}
                  className="w-full accent-indigo-600" />
                <div className="flex justify-between text-xs text-indigo-500 mt-1">
                  <span>2 hrs</span><span>8 hrs (recommended)</span><span>14 hrs</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-indigo-800">Max miles before stopping</label>
                  <span className="text-sm font-bold text-indigo-900">{maxMiles} mi</span>
                </div>
                <input type="range" min={50} max={800} step={25} value={maxMiles}
                  onChange={e => setMaxMiles(parseInt(e.target.value))}
                  className="w-full accent-indigo-600" />
                <div className="flex justify-between text-xs text-indigo-500 mt-1">
                  <span>50 mi</span><span>300 mi</span><span>800 mi</span>
                </div>
              </div>
            )}
            <p className="text-xs text-indigo-600 font-medium">{drivingRangeInfo}</p>
          </div>

          {/* Location selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-bold text-gray-900">Where are you starting from?</p>
            <div className="flex gap-2">
              <button onClick={handleGeolocate} disabled={locating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                <Navigation className="w-4 h-4" />
                {locating ? 'Locating...' : 'Use my location'}
              </button>
              <span className="text-sm text-gray-400 self-center">or</span>
              <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setUserLocation(null); }}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                <option value="">Select a state...</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {userLocation && (
              <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Using your current location · showing stops within {maxMiles} miles
              </p>
            )}
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            {STOP_TYPES.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={"shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition " + (typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {t === 'All' ? 'All Types' : t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Results */}
          {!userLocation && !stateFilter ? (
            <div className="py-16 text-center bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-4xl mb-3">🌙</p>
              <p className="text-base font-semibold text-gray-700">Find overnight stops near you</p>
              <p className="text-sm text-gray-400 mt-1">Use your location or select a state to get started</p>
              <button onClick={handleGeolocate} disabled={locating}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition mx-auto">
                <Navigation className="w-4 h-4" />
                {locating ? 'Locating...' : 'Use my location'}
              </button>
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Finding overnight stops...</div>
          ) : stops.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">🏕️</p>
              <p className="text-sm font-medium text-gray-600">No stops found in this area yet</p>
              <p className="text-xs text-gray-400 mt-1">Know a good spot? Add it below!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 font-medium">{stops.length} stop{stops.length !== 1 ? 's' : ''} found</p>
              {stops.map(stop => (
                <OvernightStopCard key={stop.id} stop={stop} onAddToPitStops={handleAddToPitStops} />
              ))}
            </div>
          )}

          {/* Add new stop CTA */}
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Know a great overnight spot?</p>
              <p className="text-xs text-amber-700 mt-0.5">Help the community by adding it to the map</p>
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition">
              <Plus className="w-4 h-4" /> Add Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
