import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Loader, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface SummaryData {
  totalMiles: number;
  totalMinutes: number;
  totalHours: number;
  fuelGallons: number;
  fuelCost: number;
  dieselPrice: number;
  driveDays: number;
  hoursPerDay: number;
  mpg: number;
  mpgSource: string;
  tankGallons: number;
  maxRange: number;
  tollEstimate: string;
  legs: {
    legIndex: number;
    from: string;
    to: string;
    distanceMiles: number;
    durationMinutes: number;
    fuelGallons: number;
    exceedsRange: boolean;
  }[];
  calculatedAt: string;
}

interface Props {
  tripPlanId: string;
  onSetMpg?: () => void;
}

export default function SmartTripSummary({ tripPlanId, onSetMpg }: Props) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showLegs, setShowLegs] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSummary();
  }, [tripPlanId]);

  const loadSummary = async () => {
    try {
      const { data } = await api.get(`/smart-trip/${tripPlanId}/summary`);
      if (data) {
        setSummary(data);
      } else {
        calculateSummary();
      }
    } catch {
      calculateSummary();
    }
  };

  const calculateSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/smart-trip/${tripPlanId}/calculate-summary`);
      setSummary(data);
    } catch {
      setError('Failed to calculate');
    } finally {
      setLoading(false);
    }
  };

  const fmtDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (loading && !summary) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader className="w-4 h-4 animate-spin" /> Calculating trip summary...
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" /> {error}
          <button onClick={calculateSummary} className="text-primary-500 hover:text-primary-700 ml-2 text-xs">Retry</button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📊</span>
          <span className="text-sm font-semibold text-gray-800">Trip Summary</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); calculateSummary(); }}
            className="text-gray-400 hover:text-primary-500 p-1 rounded-lg hover:bg-gray-100 transition"
            title="Recalculate"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-3 space-y-2">
          {/* Stats row — 4 stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">🛣 {summary.totalMiles.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 uppercase">miles</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">⏱ {fmtDuration(summary.totalMinutes)}</p>
              <p className="text-[10px] text-gray-400 uppercase">drive time</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">⛽ ~{summary.fuelGallons}</p>
              <p className="text-[10px] text-gray-400 uppercase">gallons</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-primary-600">💰 ~${Math.round(summary.fuelCost)}</p>
              <p className="text-[10px] text-gray-400 uppercase">est. cost</p>
            </div>
          </div>

          {/* Summary text */}
          <div className="text-center space-y-0.5">
            <p className="text-xs text-gray-500">
              Suggested: <span className="font-medium text-gray-700">{summary.driveDays} driving day{summary.driveDays !== 1 ? 's' : ''}</span>
            </p>
            <p className="text-[10px] text-gray-400">
              Based on {summary.mpg} MPG · Avg diesel ${summary.dieselPrice.toFixed(2)}/gal
            </p>
            {summary.tollEstimate !== 'N/A — toll data coming soon' ? null : (
              <p className="text-[10px] text-gray-300">Tolls: {summary.tollEstimate}</p>
            )}
          </div>

          {/* MPG nudge */}
          {summary.mpgSource === 'default' && onSetMpg && (
            <button
              onClick={onSetMpg}
              className="w-full text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-100 transition text-center"
            >
              ⚡ Add your rig MPG for accurate fuel estimates →
            </button>
          )}

          {/* Per-leg breakdown (expandable) */}
          {summary.legs.length > 1 && (
            <div>
              <button
                onClick={() => setShowLegs(!showLegs)}
                className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 py-1 transition"
              >
                {showLegs ? 'Hide' : 'Show'} per-leg breakdown
                {showLegs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showLegs && (
                <div className="space-y-1 mt-1">
                  {summary.legs.map((leg, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg ${leg.exceedsRange ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}
                    >
                      <span className="text-gray-600 truncate flex-1">
                        {leg.exceedsRange && '⚠️ '}Leg {i + 1}: {leg.from} → {leg.to}
                      </span>
                      <span className="text-gray-500 flex-shrink-0 ml-2">
                        {leg.distanceMiles} mi · {fmtDuration(leg.durationMinutes)} · ~{leg.fuelGallons} gal
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
