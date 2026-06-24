import { useState } from 'react';
import { X, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import api from '../services/api';

interface LegSuggestion {
  legIndex: number;
  fromName: string;
  toName: string;
  distanceMiles: number;
  durationMinutes: number;
  suggestionType: string;
  reason: string;
  suggestion: {
    id: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
    rating?: number;
    badges?: string[];
    overnightStopId?: string;
    campgroundId?: string;
    experienceId?: string;
  } | null;
  isDismissed: boolean;
  allDismissed: boolean;
  exceedsRange: boolean;
  maxRange: number;
}

interface Props {
  tripPlanId: string;
  leg: LegSuggestion;
  onAddStop: () => void;
  onDismiss: (legIndex: number, suggestionId: string) => void;
  onManualAdd: () => void;
}

const TYPE_EMOJI: Record<string, string> = {
  FUEL: '⛽',
  FUEL_WARNING: '⛽',
  OVERNIGHT: '🌙',
  FOOD: '🍔',
  ATTRACTION: '📍',
};

export default function SmartConnector({ tripPlanId, leg, onAddStop, onDismiss, onManualAdd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);

  const fmtDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleAdd = async () => {
    if (!leg.suggestion) return;
    setAdding(true);
    try {
      await api.post(`/smart-trip/${tripPlanId}/add-suggestion`, {
        legIndex: leg.legIndex,
        name: leg.suggestion.name,
        address: leg.suggestion.address || '',
        latitude: leg.suggestion.lat,
        longitude: leg.suggestion.lng,
        stopType: leg.suggestionType,
        campgroundId: leg.suggestion.campgroundId || null,
        overnightStopId: leg.suggestion.overnightStopId || null,
        experienceId: leg.suggestion.experienceId || null,
      });
      onAddStop();
    } catch {
      // Error handled silently
    } finally {
      setAdding(false);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (leg.suggestion) {
      onDismiss(leg.legIndex, leg.suggestion.id);
    }
  };

  const isFuelWarning = leg.exceedsRange || leg.suggestionType === 'FUEL_WARNING';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-0.5 flex-1 bg-gray-200" />
      </div>
      <div className="flex-1 py-1.5">
        {/* Drive info */}
        <div
          className={`rounded-lg px-3 py-2 transition cursor-pointer ${isFuelWarning && leg.suggestion ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}
          onClick={() => setExpanded(!expanded)}
        >
          {/* Compact view */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-gray-500 min-w-0">
              <span className="font-medium text-gray-600">
                {fmtDuration(leg.durationMinutes)} · {leg.distanceMiles} mi
              </span>
              {expanded ? <ChevronUp className="w-3 h-3 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
            </div>
          </div>

          {/* Fuel warning */}
          {isFuelWarning && leg.suggestion && !leg.isDismissed && !leg.allDismissed && (
            <div className="mt-1.5 flex items-start gap-2">
              <span className="text-xs">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-800">
                  Long leg ahead — fuel before leaving
                </p>
                <p className="text-[10px] text-amber-600">{leg.reason}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-amber-700 font-medium truncate">
                    ⛽ {leg.suggestion.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAdd(); }}
                    disabled={adding}
                    className="text-[10px] font-semibold text-white bg-amber-500 hover:bg-amber-600 px-2 py-0.5 rounded transition flex-shrink-0 disabled:opacity-50"
                  >
                    {adding ? <Loader className="w-3 h-3 animate-spin" /> : '+ Add'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Normal suggestion (non-fuel-warning) */}
          {!isFuelWarning && leg.suggestion && !leg.isDismissed && !leg.allDismissed && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-amber-500">💡</span>
              <span className="text-[10px] font-semibold text-amber-600">Hitch:</span>
              <span className="text-xs text-gray-600 truncate flex-1">
                {TYPE_EMOJI[leg.suggestionType] || '📍'} {leg.suggestion.name}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); handleAdd(); }}
                  disabled={adding}
                  className="text-[10px] font-semibold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-2 py-0.5 rounded transition disabled:opacity-50"
                >
                  {adding ? '...' : '+ Add'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-gray-300 hover:text-gray-500 p-0.5 transition"
                  title="Dismiss suggestion"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* All dismissed state */}
          {leg.allDismissed && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] text-gray-400 italic">Hitch is out of suggestions for this leg</span>
              <button
                onClick={(e) => { e.stopPropagation(); onManualAdd(); }}
                className="text-[10px] text-primary-500 hover:text-primary-700 border border-dashed border-primary-200 px-2 py-0.5 rounded transition"
              >
                + Add Stop
              </button>
            </div>
          )}

          {/* No suggestion and not dismissed */}
          {!leg.suggestion && !leg.allDismissed && !leg.isDismissed && (
            <div className="mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); onManualAdd(); }}
                className="text-[10px] text-primary-500 hover:text-primary-700 border border-dashed border-primary-200 px-2 py-0.5 rounded transition"
              >
                + Add Stop
              </button>
            </div>
          )}

          {/* Expanded detail */}
          {expanded && leg.suggestion && !leg.isDismissed && !leg.allDismissed && (
            <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                💡 Hitch suggests for this leg:
              </p>
              <div className="bg-white rounded-lg border border-gray-200 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {TYPE_EMOJI[leg.suggestionType] || '📍'} {leg.suggestion.name}
                    </p>
                    {leg.suggestion.address && (
                      <p className="text-xs text-gray-400 truncate">{leg.suggestion.address}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {leg.suggestion.rating && (
                        <span className="text-xs text-amber-600">⭐ {leg.suggestion.rating}</span>
                      )}
                      {leg.suggestion.badges?.map((b, i) => (
                        <span key={i} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                          {b}
                        </span>
                      ))}
                    </div>
                    {leg.reason && (
                      <p className="text-[10px] text-gray-400 mt-1 italic">{leg.reason}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAdd(); }}
                  disabled={adding}
                  className="mt-2 w-full text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {adding ? 'Adding...' : '+ Add to Trip'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
