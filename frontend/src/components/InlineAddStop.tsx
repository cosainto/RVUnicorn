import { Plus, ChevronDown } from 'lucide-react';

interface LegInfo {
  distanceMiles: number;
  durationMinutes: number;
}

interface Props {
  tripPlanId: string;
  legIndex: number;
  leg?: LegInfo | null;
  onAddStop?: (stop: any) => Promise<void>;
  onManualAdd: () => void;
}

export default function InlineAddStop({ leg, onManualAdd }: Props) {
  const fmtDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const isLongDrive = leg && leg.durationMinutes > 480; // > 8 hours

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center"><div className="w-0.5 flex-1 bg-gray-200" /></div>
      <div className="flex-1 py-1.5 space-y-1">
        {/* Drive info for this leg */}
        {leg && leg.distanceMiles > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
            <span className="font-medium text-gray-500">
              ~{fmtDuration(leg.durationMinutes)} · {leg.distanceMiles.toLocaleString()} mi
            </span>
          </div>
        )}

        {/* Long drive warning */}
        {isLongDrive && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            <span>⚠️</span>
            <span>Long drive — consider adding an overnight stop</span>
          </div>
        )}

        {/* Add Stop button — always opens the modal */}
        <button
          onClick={onManualAdd}
          className="text-xs text-primary-500 hover:text-primary-700 border border-dashed border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition w-full text-center flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add Stop <ChevronDown className="w-3 h-3 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
