import React, { useState } from 'react';
import { Gauge, ChevronDown, ChevronUp, MapPin, Fuel, Clock, Route } from 'lucide-react';

interface PitStop {
  id: string;
  name: string;
  stopType: string;
  estimatedDuration?: number;
  distanceFromStart?: number;
}

interface TripPlan {
  distanceMiles?: number;
  durationMinutes?: number;
  startLocation?: string;
  endLocation?: string;
  pitStops?: PitStop[];
  routePreference?: string;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

interface Event {
  title?: string;
  campground?: { name?: string };
}

interface OdometerProjectionProps {
  tripPlan: TripPlan;
  event?: Event;
}

function formatMiles(miles: number): string {
  return miles.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getStopIcon(type: string): string {
  switch (type) {
    case 'GAS': return '⛽';
    case 'FOOD': return '🍔';
    case 'REST': return '🛑';
    case 'ATTRACTION': return '📸';
    case 'OVERNIGHT': return '🏕️';
    default: return '📍';
  }
}

const STOP_DURATIONS: Record<string, number> = {
  GAS: 15,
  FOOD: 45,
  REST: 20,
  ATTRACTION: 60,
  OVERNIGHT: 480,
  OTHER: 20,
};

const OdometerProjection: React.FC<OdometerProjectionProps> = ({ tripPlan, event }) => {
  const [expanded, setExpanded] = useState(false);
  const [currentOdometer, setCurrentOdometer] = useState<string>('');

  const baseMiles = tripPlan.distanceMiles || 0;
  const pitStops = tripPlan.pitStops || [];

  // Calculate stop mileage additions (detours are minimal, but time adds up)
  const stopMiles = pitStops.reduce((acc, stop) => {
    // Estimate ~2 miles per stop for parking/detour
    return acc + 2;
  }, 0);

  const totalMiles = baseMiles + stopMiles;

  // Calculate total drive time including stops
  const driveMinutes = tripPlan.durationMinutes || 0;
  const stopMinutes = pitStops.reduce((acc, stop) => {
    return acc + (stop.estimatedDuration || STOP_DURATIONS[stop.stopType] || 20);
  }, 0);
  const totalMinutes = driveMinutes + stopMinutes;

  // Projected odometer
  const projectedOdometer = currentOdometer
    ? parseFloat(currentOdometer.replace(/,/g, '')) + totalMiles
    : null;

  // Segment breakdown
  const segments = [
    {
      label: tripPlan.startLocation || 'Start',
      sublabel: 'Departure',
      icon: '🏠',
      miles: 0,
      cumulative: 0,
      duration: 0,
    },
    ...pitStops.map((stop, i) => {
      const prevMiles = i === 0 ? 0 : (pitStops[i - 1].distanceFromStart || 0);
      const thisMiles = stop.distanceFromStart || Math.round((baseMiles / (pitStops.length + 1)) * (i + 1));
      return {
        label: stop.name,
        sublabel: stop.stopType,
        icon: getStopIcon(stop.stopType),
        miles: thisMiles - prevMiles,
        cumulative: thisMiles,
        duration: stop.estimatedDuration || STOP_DURATIONS[stop.stopType] || 20,
      };
    }),
    {
      label: event?.campground?.name || tripPlan.endLocation || 'Destination',
      sublabel: 'Arrival',
      icon: '🏕️',
      miles: baseMiles - (pitStops.length > 0 ? (pitStops[pitStops.length - 1].distanceFromStart || 0) : 0),
      cumulative: totalMiles,
      duration: 0,
    },
  ];

  return (
    <div className="mt-4 bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Gauge className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">Trip Odometer Projection</p>
            <p className="text-xs text-gray-500">
              {formatMiles(totalMiles)} mi total · {formatDuration(totalMinutes)} with stops
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Summary stats - always visible */}
      <div className="grid grid-cols-3 gap-px bg-slate-200 border-t border-slate-200">
        <div className="bg-white p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
            <Route className="w-3.5 h-3.5" />
          </div>
          <p className="text-lg font-bold text-gray-900">{formatMiles(baseMiles)}</p>
          <p className="text-xs text-gray-500">Drive miles</p>
        </div>
        <div className="bg-white p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <p className="text-lg font-bold text-gray-900">{pitStops.length}</p>
          <p className="text-xs text-gray-500">Pit stops</p>
        </div>
        <div className="bg-white p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <p className="text-lg font-bold text-gray-900">{formatDuration(totalMinutes)}</p>
          <p className="text-xs text-gray-500">Total time</p>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 space-y-4 bg-white border-t border-slate-100">

          {/* Odometer calculator */}
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Gauge className="w-4 h-4" /> Odometer Calculator
            </p>
            <p className="text-xs text-blue-600 mb-3">
              Enter your current odometer reading to project your arrival reading.
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="Current odometer (miles)"
                value={currentOdometer}
                onChange={(e) => setCurrentOdometer(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              />
              <span className="text-sm text-blue-600 font-medium">mi</span>
            </div>
            {projectedOdometer !== null && (
              <div className="mt-3 flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-blue-200">
                <div>
                  <p className="text-xs text-gray-500">Projected odometer at arrival</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatMiles(projectedOdometer)}
                    <span className="text-sm font-normal text-gray-500 ml-1">mi</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Trip adds</p>
                  <p className="text-lg font-semibold text-gray-700">+{formatMiles(totalMiles)} mi</p>
                </div>
              </div>
            )}
          </div>

          {/* Route breakdown */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Route Breakdown</p>
            <div className="space-y-0">
              {segments.map((seg, i) => (
                <div key={i} className="relative flex gap-3">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-blue-200 flex items-center justify-center text-sm shadow-sm z-10">
                      {seg.icon}
                    </div>
                    {i < segments.length - 1 && (
                      <div className="w-px flex-1 bg-blue-100 my-1" style={{ minHeight: '24px' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm leading-tight">{seg.label}</p>
                        <p className="text-xs text-gray-400 capitalize">{seg.sublabel.toLowerCase()}</p>
                      </div>
                      <div className="text-right">
                        {seg.miles > 0 && (
                          <p className="text-xs font-semibold text-blue-600">+{formatMiles(seg.miles)} mi</p>
                        )}
                        {seg.duration > 0 && (
                          <p className="text-xs text-amber-600">~{formatDuration(seg.duration)} stop</p>
                        )}
                        <p className="text-xs text-gray-400">{formatMiles(seg.cumulative)} mi total</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Route options summary */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
              {tripPlan.routePreference || 'FASTEST'} route
            </span>
            {tripPlan.avoidTolls && (
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">No tolls</span>
            )}
            {tripPlan.avoidHighways && (
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">No highways</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OdometerProjection;
