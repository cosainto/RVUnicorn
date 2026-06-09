import { Star } from 'lucide-react';

export type NearbyBadge = 'POPULAR' | 'FAMILY_FAVORITE' | 'HIDDEN_GEM' | 'AI_RECOMMENDED' | 'TRENDING' | 'MUST_SEE';

interface NearbyTileProps {
  name: string;
  imageUrl?: string;
  distanceMiles: number;
  driveTimeMinutes: number;
  rating?: number;
  reviewCount?: number;
  category: string;
  badge?: NearbyBadge;
  onPress: () => void;
}

const BADGE_CONFIG: Record<NearbyBadge, { label: string; bg: string }> = {
  MUST_SEE: { label: '🧭 Must-See Stop', bg: 'bg-amber-600/90' },
  TRENDING: { label: '🔥 Trending Nearby', bg: 'bg-red-600/90' },
  POPULAR: { label: '⭐ Popular with Campers', bg: 'bg-yellow-600/90' },
  FAMILY_FAVORITE: { label: '👨‍👩‍👧 Family Favorite', bg: 'bg-blue-600/90' },
  HIDDEN_GEM: { label: '🔍 Hidden Gem', bg: 'bg-purple-600/90' },
  AI_RECOMMENDED: { label: '🤖 AI Pick', bg: 'bg-amber-500/90' },
};

const CATEGORY_EMOJI: Record<string, string> = {
  TRAIL: '🥾', HIKING: '🥾', FOOD: '🍽️', RESTAURANT: '🍽️',
  FAMILY: '👨‍👩‍👧', PLAYGROUND: '👨‍👩‍👧', SCENIC_VIEW: '🏔️', SCENIC: '🏔️',
  MUSEUM: '🏛️', WATERFALL: '💧', WILDLIFE: '🦌', FISHING: '🎣', FISHING_SPOT: '🎣',
  SHOPPING: '🛍️', MARKET: '🛍️', ATTRACTION: '📸', EVENT: '🎪', TOUR: '🎟️', OTHER: '📍',
};

function getCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    TRAIL: 'Hiking', FOOD: 'Food', RESTAURANT: 'Food', ATTRACTION: 'Attraction',
    SCENIC_VIEW: 'Scenic View', SCENIC: 'Scenic View', MUSEUM: 'Museum',
    PLAYGROUND: 'Family Fun', FISHING_SPOT: 'Fishing', MARKET: 'Shopping',
    TOUR: 'Tour', EVENT: 'Event', WILDLIFE: 'Wildlife', WATERFALL: 'Waterfall',
    OTHER: 'Nearby',
  };
  return labels[cat] || cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function assignBadge(opts: { rating?: number; reviewCount?: number; category?: string; isAiPick?: boolean; trendingCount?: number }): NearbyBadge | undefined {
  const { rating = 0, reviewCount = 0, category = '', isAiPick, trendingCount = 0 } = opts;
  // Priority: MUST_SEE > TRENDING > POPULAR > FAMILY_FAVORITE > HIDDEN_GEM > AI_RECOMMENDED
  if (rating >= 4.8 && reviewCount >= 500) return 'MUST_SEE';
  if (trendingCount >= 3) return 'TRENDING';
  if (rating >= 4.5 && reviewCount >= 100) return 'POPULAR';
  const familyTypes = ['family', 'kids', 'playground', 'zoo', 'PLAYGROUND', 'FAMILY'];
  if (familyTypes.some(t => category.toLowerCase().includes(t)) && rating >= 4.0) return 'FAMILY_FAVORITE';
  if (reviewCount > 0 && reviewCount < 20 && rating >= 4.3) return 'HIDDEN_GEM';
  if (isAiPick) return 'AI_RECOMMENDED';
  return undefined;
}

export default function NearbyTile({ name, imageUrl, distanceMiles, driveTimeMinutes, rating, reviewCount, category, badge, onPress }: NearbyTileProps) {
  const emoji = CATEGORY_EMOJI[category] || CATEGORY_EMOJI[category?.toUpperCase()] || '📍';
  const label = getCategoryLabel(category);

  return (
    <div onClick={onPress} className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg transition cursor-pointer group flex flex-col">
      {/* Image — fixed 200px height */}
      <div className="relative h-[200px] bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-4xl">{emoji}</span>
          </div>
        )}
        {badge && (
          <div className={`absolute top-2 left-2 ${BADGE_CONFIG[badge].bg} text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm`}>
            {BADGE_CONFIG[badge].label}
          </div>
        )}
      </div>

      {/* Content — 30% of card */}
      <div className="p-2.5 flex-1 flex flex-col justify-between">
        <div>
          <h4 className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">{name}</h4>
          <span className="text-[11px] text-gray-500 mt-0.5 block">{emoji} {label}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-gray-400">{distanceMiles.toFixed(1)} mi · {driveTimeMinutes} min drive</span>
          {rating !== undefined && rating > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-gray-600">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              {rating.toFixed(1)}
              {reviewCount !== undefined && reviewCount > 0 && <span className="text-gray-400 ml-0.5">({reviewCount})</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
