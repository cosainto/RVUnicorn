import { useState } from 'react';
import { Loader, Plus } from 'lucide-react';
import api from '../services/api';

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
  visitCount?: number;
}

interface Props {
  tripPlanId: string;
  onAddStop: (stop: StopResult, afterNodeIndex: number) => Promise<void>;
  nodeNames: string[]; // list of current timeline nodes for position picker
}

const CATEGORIES = [
  { id: 'GAS', label: 'Gas', emoji: '⛽' },
  { id: 'FOOD', label: 'Food', emoji: '🍔' },
  { id: 'RELAX', label: 'Relax', emoji: '😌' },
  { id: 'OVERNIGHT', label: 'Overnight', emoji: '🌙' },
  { id: 'ATTRACTIONS', label: 'Attractions', emoji: '📍' },
];

export default function CategoryStopFinder({ tripPlanId, onAddStop, nodeNames }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [results, setResults] = useState<StopResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [positionPickerId, setPositionPickerId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState(0);

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
    } catch {
      // Error silently
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
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

  const handleAddClick = (stop: StopResult) => {
    if (positionPickerId === stop.id) {
      setPositionPickerId(null);
      return;
    }
    setPositionPickerId(stop.id);
    setSelectedPosition(0);
  };

  const confirmAdd = async (stop: StopResult) => {
    setAddingId(stop.id);
    try {
      await onAddStop(stop, selectedPosition);
      setPositionPickerId(null);
      // Remove from results
      setResults(prev => prev.filter(r => r.id !== stop.id));
    } catch {
      // Error
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          🔍 Find stops along your route
        </p>
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 px-4 pb-3 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeCategory === cat.id
                ? 'bg-primary-100 text-primary-700 border-primary-300'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Results panel */}
      {activeCategory && (
        <div className="border-t border-gray-100">
          {loading ? (
            <div className="py-6 flex flex-col items-center gap-2">
              <Loader className="w-5 h-5 animate-spin text-primary-400" />
              <p className="text-xs text-gray-400">Finding stops...</p>
              {/* Skeleton cards */}
              <div className="w-full px-4 space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-400">
                No {CATEGORIES.find(c => c.id === activeCategory)?.label.toLowerCase()} stops found along this route
              </p>
              <p className="text-xs text-gray-300 mt-1">Try expanding the search radius</p>
            </div>
          ) : (
            <div className="px-4 py-2 space-y-1.5 max-h-96 overflow-y-auto">
              {results.map(stop => (
                <div key={stop.id} className="bg-gray-50 rounded-lg border border-gray-100 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">
                          {activeCategory === 'GAS' ? '⛽' : activeCategory === 'FOOD' ? '🍔' : activeCategory === 'OVERNIGHT' ? '🌙' : activeCategory === 'RELAX' ? '😌' : '📍'}
                        </span>
                        <p className="text-sm font-medium text-gray-800 truncate">{stop.name}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {(stop.city || stop.state) && (
                          <span className="text-xs text-gray-400 truncate">
                            {[stop.city, stop.state].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {stop.distanceFromRoute !== undefined && (
                          <span className="text-[10px] text-gray-400">{stop.distanceFromRoute} mi from route</span>
                        )}
                        {stop.rating && (
                          <span className="text-xs text-amber-600">⭐ {stop.rating}</span>
                        )}
                      </div>
                      {stop.badges && stop.badges.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {stop.badges.map((b, i) => (
                            <span key={i} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleAddClick(stop)}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-lg transition flex-shrink-0 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>

                  {/* Position picker */}
                  {positionPickerId === stop.id && (
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase">Add after:</p>
                      <select
                        value={selectedPosition}
                        onChange={e => setSelectedPosition(parseInt(e.target.value))}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary-400"
                      >
                        {nodeNames.map((name, idx) => (
                          <option key={idx} value={idx}>{name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => confirmAdd(stop)}
                        disabled={addingId === stop.id}
                        className="w-full text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 py-1.5 rounded-lg transition disabled:opacity-50"
                      >
                        {addingId === stop.id ? 'Adding...' : 'Confirm'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {hasMore && (
                <button
                  onClick={() => loadCategory(activeCategory!, offset)}
                  disabled={loadingMore}
                  className="w-full text-xs text-primary-500 hover:text-primary-700 py-2 transition"
                >
                  {loadingMore ? 'Loading...' : 'Show more →'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
