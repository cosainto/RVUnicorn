import { useState } from 'react';
import { Fuel, X, Plus, AlertTriangle } from 'lucide-react';

interface FuelRec {
  type: 'FILLUP_PREFERRED' | 'RESERVE_WARNING' | 'URGENT' | 'REMOTE_STRETCH';
  mileMarker: number;
  estimatedFuelPct: number;
  legIndex: number;
  message: string;
  nearbyStation?: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    distanceFromRoute: number;
    chain?: string;
  };
}

interface Props {
  rec: FuelRec;
  onAddToTrip: (rec: FuelRec) => Promise<void>;
  onDismiss: (rec: FuelRec) => void;
}

export default function FuelRecommendationNode({ rec, onAddToTrip, onDismiss }: Props) {
  const [adding, setAdding] = useState(false);

  const isUrgent = rec.type === 'URGENT';
  const isWarning = rec.type === 'RESERVE_WARNING';
  const isRemote = rec.type === 'REMOTE_STRETCH';

  const borderColor = isUrgent ? 'border-red-300' : isWarning ? 'border-amber-300' : isRemote ? 'border-orange-200' : 'border-amber-200';
  const bgColor = isUrgent ? 'bg-red-50' : isWarning ? 'bg-amber-50' : isRemote ? 'bg-orange-50' : 'bg-amber-50/50';
  const iconColor = isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : isRemote ? 'text-orange-600' : 'text-amber-500';

  const handleAdd = async () => {
    setAdding(true);
    try { await onAddToTrip(rec); } catch {} finally { setAdding(false); }
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-0.5 flex-1 bg-gray-200" />
      </div>
      <div className="flex-1 py-1.5">
        <div className={`rounded-xl border-2 border-dashed ${borderColor} ${bgColor} p-3`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {isRemote ? <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} /> : <Fuel className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />}
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${isUrgent ? 'text-red-800' : isWarning ? 'text-amber-800' : 'text-amber-700'}`}>
                  {isRemote ? '⚠️ Remote Stretch' : `⛽ Fuel Suggestion · ~${Math.round(rec.estimatedFuelPct)}% tank`}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">{rec.message}</p>
                {rec.nearbyStation && (
                  <div className="mt-1.5">
                    <p className="text-xs font-medium text-gray-700">{rec.nearbyStation.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {rec.nearbyStation.city}, {rec.nearbyStation.state}
                      {rec.nearbyStation.distanceFromRoute > 0 && ` · ${rec.nearbyStation.distanceFromRoute} mi from route`}
                    </p>
                    {rec.nearbyStation.chain && (
                      <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mt-1 inline-block">{rec.nearbyStation.chain}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {!isRemote && !isUrgent && (
              <button onClick={() => onDismiss(rec)} className="text-gray-300 hover:text-gray-500 p-0.5 transition flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {rec.nearbyStation && !isRemote && (
            <button onClick={handleAdd} disabled={adding} className="mt-2 w-full text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 py-1.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1">
              {adding ? 'Adding...' : <><Plus className="w-3.5 h-3.5" /> Add to Trip</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
