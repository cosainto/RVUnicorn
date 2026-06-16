import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const CATEGORY_EMOJI: Record<string, string> = {
  TRAIL: '🥾',
  RESTAURANT: '🍽️',
  ATTRACTION: '🎡',
  MUSEUM: '🏛️',
  MARKET: '🛒',
  SCENIC_VIEW: '🌄',
  FISHING_SPOT: '🎣',
  PLAYGROUND: '🛝',
  OTHER: '📍',
};

interface AlsoVisitedItem {
  experienceId: string;
  name: string;
  category: string;
  distance: number;
  visitCount: number;
  avgRating: number | null;
  photoUrl: string | null;
}

interface Props {
  campgroundId: string;
  isAdventure?: boolean;
  isNeon?: boolean;
}

export default function CampgroundAlsoVisited({ campgroundId, isAdventure, isNeon }: Props) {
  const [items, setItems] = useState<AlsoVisitedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/campground-features/${campgroundId}/also-visited`)
      .then(r => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campgroundId]);

  if (loading) {
    return (
      <div className="mb-6">
        <h3 className={`text-lg font-bold mb-3 ${(isAdventure || isNeon) ? 'text-gray-200' : 'text-gray-800'}`}>
          🗺️ Visitors also explored:
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 w-40 h-24 rounded-xl animate-pulse" style={{ background: (isAdventure || isNeon) ? '#1a1a2e' : '#f3f4f6' }} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  const dark = isAdventure || isNeon;

  return (
    <div className="mb-6">
      <h3 className={`text-lg font-bold mb-3 ${dark ? 'text-gray-200' : 'text-gray-800'}`}>
        🗺️ Visitors also explored:
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {items.map(item => (
          <Link
            key={item.experienceId}
            to={`/experiences/${item.experienceId}`}
            className={`flex-shrink-0 w-44 rounded-xl overflow-hidden border transition hover:shadow-lg ${dark ? 'border-gray-700 bg-gray-800/60 hover:bg-gray-800' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            {item.photoUrl ? (
              <img src={item.photoUrl} alt={item.name} className="w-full h-20 object-cover" />
            ) : (
              <div className={`w-full h-20 flex items-center justify-center text-2xl ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                {CATEGORY_EMOJI[item.category] || '📍'}
              </div>
            )}
            <div className="p-2.5">
              <p className={`text-xs font-semibold truncate ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{item.name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[10px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{item.distance} mi</span>
                {item.avgRating && <span className="text-[10px] text-amber-500">⭐{item.avgRating}</span>}
              </div>
              <p className={`text-[10px] mt-0.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {item.visitCount} visitor{item.visitCount !== 1 ? 's' : ''} did this
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
