import { useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

interface SuggestedFix {
  label: string;
  action: 'MOVE_ARRIVAL' | 'MOVE_DEPARTURE' | 'ADJUST_STOP' | 'REMOVE_STOP';
  newDate?: string;
  stopId?: string;
}

interface Conflict {
  type: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  affectedStopIds: string[];
  suggestedFix: SuggestedFix[];
}

interface ConflictResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
  suggestedArrivalDate: string | null;
  totalDaysNeeded: number;
  totalDaysAvailable: number;
  isScheduleFeasible: boolean;
}

interface ReschedulePreview {
  id: string;
  name: string;
  oldArrival: string | null;
  oldDeparture: string | null;
  newArrival: string;
  newDeparture: string;
}

interface Props {
  tripPlanId: string;
  eventId: string;
  result: ConflictResult;
  onDismiss: () => void;
  onResolved: () => void;
  onDeleteStop: (stopId: string) => void;
}

export default function TripConflictPanel({ tripPlanId, eventId, result, onDismiss, onResolved, onDeleteStop }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [reschedulePreview, setReschedulePreview] = useState<ReschedulePreview[] | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  if (!result.hasConflicts || result.conflicts.length === 0) return null;

  const errors = result.conflicts.filter(c => c.severity === 'ERROR');
  const warnings = result.conflicts.filter(c => c.severity === 'WARNING');

  const handleFix = async (fix: SuggestedFix) => {
    setApplying(fix.label);
    try {
      if (fix.action === 'MOVE_ARRIVAL' && fix.newDate) {
        await api.put(`/trips/${eventId}`, { endDate: fix.newDate });
        onResolved();
      } else if (fix.action === 'MOVE_DEPARTURE' && fix.newDate) {
        await api.put(`/trips/${eventId}`, { startDate: fix.newDate });
        onResolved();
      } else if (fix.action === 'REMOVE_STOP' && fix.stopId) {
        onDeleteStop(fix.stopId);
      } else if (fix.action === 'ADJUST_STOP' && fix.stopId && fix.newDate) {
        await api.put(`/trip-planner/pit-stop/${fix.stopId}`, { estimatedArrival: fix.newDate });
        onResolved();
      }
    } catch {} finally { setApplying(null); }
  };

  const handleAutoReschedule = async () => {
    setRescheduleLoading(true);
    try {
      const { data } = await api.post(`/trip-planner/trip/${tripPlanId}/auto-reschedule`);
      setReschedulePreview(data.suggestions || []);
    } catch {} finally { setRescheduleLoading(false); }
  };

  const applyReschedule = async () => {
    if (!reschedulePreview) return;
    setApplying('reschedule');
    try {
      await api.post(`/trip-planner/trip/${tripPlanId}/apply-reschedule`, { stops: reschedulePreview });
      setReschedulePreview(null);
      onResolved();
    } catch {} finally { setApplying(null); }
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?';

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-bold text-red-800">
            Date Conflicts ({errors.length} error{errors.length !== 1 ? 's' : ''}{warnings.length > 0 ? `, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}` : ''})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="text-red-400 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>
          {collapsed ? <ChevronDown className="w-4 h-4 text-red-400" /> : <ChevronUp className="w-4 h-4 text-red-400" />}
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Feasibility summary */}
          {!result.isScheduleFeasible && (
            <div className="text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2">
              Days needed: {result.totalDaysNeeded} minimum · Days available: {result.totalDaysAvailable} · Schedule is too tight
            </div>
          )}

          {/* Conflicts */}
          {result.conflicts.map((conflict, i) => (
            <div key={i} className={`rounded-lg p-3 ${conflict.severity === 'ERROR' ? 'bg-white border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">{conflict.severity === 'ERROR' ? '🔴' : '⚠️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700">{conflict.message}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {conflict.suggestedFix.map((fix, j) => (
                      <button
                        key={j}
                        onClick={() => fix.action === 'MOVE_ARRIVAL' && !fix.newDate ? handleAutoReschedule() : handleFix(fix)}
                        disabled={applying !== null}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg border transition disabled:opacity-50 bg-white text-red-700 border-red-200 hover:bg-red-50"
                      >
                        {applying === fix.label ? '...' : `→ ${fix.label}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Reschedule Preview Modal */}
          {reschedulePreview && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-gray-800">📅 Suggested Reschedule</p>
              <div className="space-y-2">
                {reschedulePreview.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 line-through">{fmtDate(s.oldArrival)}-{fmtDate(s.oldDeparture)}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-emerald-700 font-medium">{fmtDate(s.newArrival)}-{fmtDate(s.newDeparture)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={applyReschedule} disabled={applying === 'reschedule'} className="flex-1 text-xs font-semibold bg-emerald-500 text-white py-2 rounded-lg hover:bg-emerald-600 transition disabled:opacity-50">
                  {applying === 'reschedule' ? 'Applying...' : 'Apply These Dates'}
                </button>
                <button onClick={() => setReschedulePreview(null)} className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100 transition">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Small badge for itinerary header when panel is dismissed */
export function ConflictBadge({ count, onClick }: { count: number; onClick: () => void }) {
  if (count === 0) return null;
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full hover:bg-red-100 transition">
      <AlertTriangle className="w-3 h-3" /> {count} conflict{count !== 1 ? 's' : ''}
    </button>
  );
}
