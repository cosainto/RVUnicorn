import { useState } from 'react';
import { Fuel, Moon, Utensils, MapPin, Star, Trash2, Plus, ChevronDown, ChevronUp, Loader2, DollarSign, Clock, Navigation, Truck, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface SmartStopsProps {
  tripPlan: any;
  eventId: string;
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

export default function SmartStops({ tripPlan, eventId, onAddPitStop }: SmartStopsProps) {
  const [loading, setLoading] = useState(false);
  const [smartStops, setSmartStops] = useState<any>(null);
  const [expandedStop, setExpandedStop] = useState<number | null>(null);
  const [addedStops, setAddedStops] = useState<Set<string>>(new Set());
  
  const [rvSettings, setRvSettings] = useState({
    mpg: 10,
    tankGallons: 50,
    drivingHoursPerDay: 8,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [stopTypes, setStopTypes] = useState({
    gas: true,
    overnight: true,
    food: true,
    dump: false,
  });

  const handleFindStops = async () => {
    if (!tripPlan?.routePolyline) {
      alert('Plan your route first to find smart stops');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/drive-planner/smart-stops', {
        polyline: tripPlan.routePolyline,
        totalMiles: tripPlan.distanceMiles,
        totalMinutes: tripPlan.durationMinutes,
        mpg: rvSettings.mpg,
        tankGallons: rvSettings.tankGallons,
        drivingHoursPerDay: rvSettings.drivingHoursPerDay,
        stopTypes: Object.entries(stopTypes).filter(([_, v]) => v).map(([k]) => k),
      });
      setSmartStops(data);
    } catch (error) {
      console.error('Smart stops error:', error);
      alert('Failed to find stops along route');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStop = async (place: StopPlace, stopType: string, notes: string) => {
    try {
      await api.post(`/trip-planner/trip/${tripPlan.id}/pit-stop`, {
        name: place.name,
        location: place.address,
        latitude: place.lat,
        longitude: place.lng,
        stopType,
        notes,
        estimatedDuration: stopType === 'OVERNIGHT' ? 600 : stopType === 'GAS' ? 20 : 45,
      });
      setAddedStops(prev => new Set([...prev, place.placeId]));
      onAddPitStop(place);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add stop');
    }
  };

  const getStopIcon = (type: string) => {
    switch (type) {
      case 'GAS': return <Fuel className="w-5 h-5 text-red-500" />;
      case 'OVERNIGHT': return <Moon className="w-5 h-5 text-indigo-500" />;
      case 'FOOD_REST': return <Utensils className="w-5 h-5 text-orange-500" />;
      case 'DUMP_STATION': return <Trash2 className="w-5 h-5 text-green-600" />;
      default: return <MapPin className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStopColor = (type: string) => {
    switch (type) {
      case 'GAS': return 'border-red-200 bg-red-50';
      case 'OVERNIGHT': return 'border-indigo-200 bg-indigo-50';
      case 'FOOD_REST': return 'border-orange-200 bg-orange-50';
      case 'DUMP_STATION': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const renderStars = (rating: number) => (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating?.toFixed(1)}</span>
    </span>
  );

  const renderPlaceCard = (place: StopPlace, stopType: string, extraNote?: string) => {
    const isAdded = addedStops.has(place.placeId);
    return (
      <div key={place.placeId} className="flex items-start gap-3 p-3 bg-white rounded-lg border hover:shadow-sm transition">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{place.name}</p>
          <p className="text-xs text-gray-500 truncate">{place.address}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {place.rating && renderStars(place.rating)}
            {place.totalRatings && <span className="text-xs text-gray-400">({place.totalRatings})</span>}
            {place.isOpen !== undefined && (
              <span className={`text-xs font-medium ${place.isOpen ? 'text-green-600' : 'text-red-500'}`}>
                {place.isOpen ? 'Open' : 'Closed'}
              </span>
            )}
            {place.parkingType && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{place.parkingType}</span>
            )}
          </div>
          {(place.note || extraNote) && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {place.note || extraNote}
            </p>
          )}
        </div>
        <button
          onClick={() => handleAddStop(place, stopType, place.note || extraNote || '')}
          disabled={isAdded}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            isAdded ? 'bg-green-100 text-green-700 cursor-default' : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isAdded ? '\u2713 Added' : '+ Add'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-600" />
          Smart RV Stops
        </h4>
        <button onClick={() => setShowSettings(!showSettings)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          {showSettings ? 'Hide' : 'RV'} Settings \u2699\uFE0F
        </button>
      </div>

      {showSettings && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">MPG</label>
              <input type="number" value={rvSettings.mpg}
                onChange={(e) => setRvSettings(prev => ({ ...prev, mpg: Number(e.target.value) }))}
                className="w-full text-sm border rounded-lg px-3 py-2 mt-1" min={3} max={30} step={0.5} />
              <p className="text-[10px] text-gray-400 mt-0.5">Class A: 6-10, C: 10-14</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Tank (gal)</label>
              <input type="number" value={rvSettings.tankGallons}
                onChange={(e) => setRvSettings(prev => ({ ...prev, tankGallons: Number(e.target.value) }))}
                className="w-full text-sm border rounded-lg px-3 py-2 mt-1" min={10} max={150} step={5} />
              <p className="text-[10px] text-gray-400 mt-0.5">Range: ~{Math.round(rvSettings.mpg * rvSettings.tankGallons)} mi</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Drive hrs/day</label>
              <input type="number" value={rvSettings.drivingHoursPerDay}
                onChange={(e) => setRvSettings(prev => ({ ...prev, drivingHoursPerDay: Number(e.target.value) }))}
                className="w-full text-sm border rounded-lg px-3 py-2 mt-1" min={4} max={14} step={1} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'gas', label: '\u26FD Gas Stops' },
              { key: 'overnight', label: '\uD83C\uDFD5\uFE0F Overnight' },
              { key: 'food', label: '\uD83C\uDF54 Food/Rest' },
              { key: 'dump', label: '\uD83D\uDEBF Dump Stations' },
            ].map(({ key, label }) => (
              <button key={key}
                onClick={() => setStopTypes(prev => ({ ...prev, [key]: !(prev as any)[key] }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                  (stopTypes as any)[key] ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-100 text-gray-400 border-gray-200'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleFindStops} disabled={loading || !tripPlan?.routePolyline}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Finding RV-friendly stops...</>
        ) : (
          <><Navigation className="w-5 h-5" /> Find Smart Stops Along Route</>
        )}
      </button>

      {smartStops && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <h5 className="font-semibold text-blue-900 mb-3">Trip Summary</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-700">{smartStops.summary.totalMiles}</p>
                <p className="text-xs text-blue-600">Total Miles</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-700">{smartStops.summary.totalDays}</p>
                <p className="text-xs text-indigo-600">{smartStops.summary.totalDays === 1 ? 'Day Trip' : 'Days'}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{smartStops.summary.gasStopsNeeded}</p>
                <p className="text-xs text-red-500">Gas Stops</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-700">${smartStops.summary.estimatedFuelCost}</p>
                <p className="text-xs text-green-600">~{smartStops.summary.estimatedGallons} gal</p>
              </div>
            </div>
            {smartStops.summary.overnightStopsNeeded > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-sm text-blue-800">
                  \uD83C\uDFD5\uFE0F {smartStops.summary.overnightStopsNeeded} overnight stop{smartStops.summary.overnightStopsNeeded > 1 ? 's' : ''} recommended ({rvSettings.drivingHoursPerDay}hr driving days)
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {smartStops.stops.map((stop: any, idx: number) => (
              <div key={idx} className={`rounded-xl border-2 ${getStopColor(stop.type)} overflow-hidden`}>
                <button onClick={() => setExpandedStop(expandedStop === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-3 text-left">
                  <div className="flex items-center gap-3">
                    {getStopIcon(stop.type)}
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{stop.reason}</p>
                      <p className="text-xs text-gray-500">
                        Mile {stop.milesFromStart}
                        {stop.type === 'GAS' && ` \u2022 ${stop.places?.length || 0} stations found`}
                        {stop.type === 'OVERNIGHT' && ` \u2022 ${stop.campgrounds?.length || 0} campgrounds, ${stop.freeParking?.length || 0} free options`}
                        {stop.type === 'FOOD_REST' && ` \u2022 ${stop.restaurants?.length || 0} restaurants`}
                        {stop.type === 'DUMP_STATION' && ` \u2022 ${stop.places?.length || 0} locations`}
                      </p>
                    </div>
                  </div>
                  {expandedStop === idx ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>

                {expandedStop === idx && (
                  <div className="px-3 pb-3 space-y-2">
                    {stop.type === 'GAS' && stop.places?.map((place: StopPlace) => 
                      renderPlaceCard(place, 'GAS', 'Look for truck lanes for easier RV access')
                    )}
                    {stop.type === 'OVERNIGHT' && (
                      <>
                        {stop.campgrounds?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-indigo-700 mb-2">\uD83C\uDFD5\uFE0F RV Parks & Campgrounds</p>
                            {stop.campgrounds.map((place: StopPlace) => renderPlaceCard(place, 'OVERNIGHT'))}
                          </div>
                        )}
                        {stop.freeParking?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-indigo-700 mb-2">\uD83C\uDD7F\uFE0F Free Overnight Options</p>
                            {stop.freeParking.map((place: StopPlace) => renderPlaceCard(place, 'OVERNIGHT', place.note))}
                          </div>
                        )}
                      </>
                    )}
                    {stop.type === 'FOOD_REST' && (
                      <>
                        {stop.restaurants?.map((place: StopPlace) => renderPlaceCard(place, 'FOOD'))}
                        {stop.restAreas?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-orange-700 mb-2">\uD83C\uDD7F\uFE0F Rest Areas</p>
                            {stop.restAreas.map((place: StopPlace) => renderPlaceCard(place, 'REST'))}
                          </div>
                        )}
                      </>
                    )}
                    {stop.type === 'DUMP_STATION' && stop.places?.map((place: StopPlace) => 
                      renderPlaceCard(place, 'DUMP')
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {smartStops.stops.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <p>No stops needed for this short trip! \uD83C\uDF89</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
