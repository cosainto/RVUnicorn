import { useState } from 'react';
import { ChevronDown, Loader, Plus, X } from 'lucide-react';
import api from '../services/api';

interface LegInfo {
  distanceMiles: number;
  durationMinutes: number;
}

interface StopResult {
  id: string;
  name: string;
  city?: string;
  state?: string;
  type: string;
  lat?: number;
  lng?: number;
  rating?: number;
  category?: string;
  badges?: string[];
  distanceFromRoute?: number;
  campgroundId?: string;
  overnightStopId?: string;
  experienceId?: string;
}

interface Props {
  tripPlanId: string;
  legIndex: number;
  leg?: LegInfo | null;
  onAddStop: (stop: StopResult) => Promise<void>;
  onManualAdd: () => void;
}

const CATEGORIES = [
  { id: 'GAS', label: 'Gas', emoji: '⛽' },
  { id: 'FOOD', label: 'Food', emoji: '🍔' },
  { id: 'RELAX', label: 'Relax', emoji: '😌' },
  { id: 'OVERNIGHT', label: 'Overnight', emoji: '🌙' },
  { id: 'ATTRACTIONS', label: 'Attractions', emoji: '📍' },
];

export default function InlineAddStop({ tripPlanId, leg, onAddStop, onManualAdd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [results, setResults] = useState<StopResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const fmtDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const isLongDrive = leg && leg.durationMinutes > 480; // > 8 hours

  const loadCategory = async (category: string, newOffset = 0) => {
    if (newOffset === 0) {
      setLoading(true);
      setResults([]);
    } else {
      setLoadingMore(true);
    }
    try {
      const { data } = await api.get(`/smart-trip/${tripPlanId}/stops-by-category`, {
        params: { category, offset: newOffset },
      });
      if (newOffset === 0) {
        setResults(data.results);
      } else {
        setResults(prev => [...prev, ...data.results]);
      }
      setHasMore(data.hasMore);
      setOffset(newOffset + data.results.length);
    } catch {}
    setLoading(false);
    setLoadingMore(false);
  };

  const handleCategoryClick = (catId: string) => {
    if (activeCategory === catId) {
      setActiveCategory(null);
      setResults([]);
      return;
    }
    setActiveCategory(catId);
    setOffset(0);
    loadCategory(catId);
  };

  const handleAdd = async (stop: StopResult) => {
    setAddingId(stop.id);
    try {
      await onAddStop(stop);
      setResults(prev => prev.filter(r => r.id !== stop.id));
    } catch {}
    setAddingId(null);
  };

  const close = () => {
    setExpanded(false);
    setActiveCategory(null);
    setResults([]);
  };

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

        {/* Add Stop button */}
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-primary-500 hover:text-primary-700 border border-dashed border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition w-full text-center flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Stop <ChevronDown className="w-3 h-3 ml-0.5" />
          </button>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600">What kind of stop?</p>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Category pills */}
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                    activeCategory === cat.id
                      ? 'bg-primary-100 text-primary-700 border-primary-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
              <button
                onClick={() => { close(); onManualAdd(); }}
                className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-white text-gray-600 border-gray-200 hover:bg-gray-100 transition-all"
              >
                📋 Other
              </button>
            </div>

            {/* Results */}
            {activeCategory && (
              <div>
                {loading ? (
                  <div className="py-3 flex items-center justify-center gap-2 text-xs text-gray-400">
                    <Loader className="w-3.5 h-3.5 animate-spin" /> Finding stops...
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2 text-center">
                    No {CATEGORIES.find(c => c.id === activeCategory)?.label.toLowerCase()} stops found along this route
                  </p>
                ) : (
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {results.map(stop => (
                      <div key={stop.id} className="flex items-center justify-between gap-2 bg-white rounded-lg border border-gray-100 px-2.5 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{stop.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {(stop.city || stop.state) && (
                              <span className="text-[10px] text-gray-400 truncate">
                                {[stop.city, stop.state].filter(Boolean).join(', ')}
                              </span>
                            )}
                            {stop.distanceFromRoute !== undefined && (
                              <span className="text-[10px] text-gray-400">{stop.distanceFromRoute} mi off route</span>
                            )}
                            {stop.rating && <span className="text-[10px] text-amber-600">⭐ {stop.rating}</span>}
                          </div>
                          {stop.badges && stop.badges.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {stop.badges.map((b, i) => (
                                <span key={i} className="text-[9px] bg-green-50 text-green-700 px-1 py-0.5 rounded border border-green-200">{b}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleAdd(stop)}
                          disabled={addingId === stop.id}
                          className="text-[10px] font-semibold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded-lg transition flex-shrink-0 disabled:opacity-50"
                        >
                          {addingId === stop.id ? '...' : '+ Add'}
                        </button>
                      </div>
                    ))}
                    {hasMore && (
                      <button
                        onClick={() => loadCategory(activeCategory!, offset)}
                        disabled={loadingMore}
                        className="w-full text-[10px] text-primary-500 py-1.5"
                      >
                        {loadingMore ? 'Loading...' : 'Show more →'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
