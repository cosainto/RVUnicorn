import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, MapPin, Star, Sparkles, CalendarPlus, Loader2, Mountain, Utensils, Camera, Ticket, Compass, Clock, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AddToEventModal from './AddToEventModal';
import NearbyTile, { assignBadge } from './nearby/NearbyTile';

interface Recommendation {
  placeId: string;
  sourceUrl: string;
  sourceName: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  distance: number;
  type: 'TRAIL' | 'EVENT' | 'ATTRACTION' | 'FOOD' | 'TOUR' | 'OTHER';
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  isOpen?: boolean;
  openingHours?: string[] | null;
  imageUrl?: string;
  existingId?: string;
  isSaved: boolean;
}

interface AiPick {
  placeId: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  distance: number;
  type: string;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
  sourceUrl: string;
  tip: string;
  openingHours?: string[] | null;
  isOpen?: boolean;
}

interface ExploreNearbyPanelProps {
  campgroundId: string;
  campgroundName: string;
  eventId?: string;
  onSeeAll?: () => void;
  onActivityAdded?: () => void;
}

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  TRAIL: { icon: '🥾', label: 'Outdoors', color: 'bg-green-500/20 text-green-300' },
  FOOD: { icon: '🍔', label: 'Food', color: 'bg-orange-500/20 text-orange-300' },
  ATTRACTION: { icon: '📸', label: 'Attraction', color: 'bg-purple-500/20 text-purple-300' },
  TOUR: { icon: '🎟️', label: 'Tour', color: 'bg-blue-500/20 text-blue-300' },
  EVENT: { icon: '🎪', label: 'Event', color: 'bg-pink-500/20 text-pink-300' },
  OTHER: { icon: '📍', label: 'Activity', color: 'bg-gray-500/20 text-gray-300' },
};

const CATEGORIES = [
  { key: 'ALL', label: 'All', icon: '✨' },
  { key: 'TRAIL', label: 'Outdoors', icon: '🥾' },
  { key: 'FOOD', label: 'Food', icon: '🍔' },
  { key: 'ATTRACTION', label: 'Attractions', icon: '📸' },
  { key: 'TOUR', label: 'Tours', icon: '🎟️' },
];

export default function ExploreNearbyPanel({ campgroundId, campgroundName, eventId, onSeeAll, onActivityAdded }: ExploreNearbyPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [category, setCategory] = useState('ALL');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [aiPicks, setAiPicks] = useState<AiPick[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [loadingAi, setLoadingAi] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addToEventModal, setAddToEventModal] = useState<{ isOpen: boolean; thingId: string; thingTitle: string }>({ isOpen: false, thingId: '', thingTitle: '' });
  const [showAllTiles, setShowAllTiles] = useState(false);

  useEffect(() => {
    loadRecommendations();
    loadAiPicks();
  }, [campgroundId]);

  const loadRecommendations = async () => {
    try {
      setLoadingRecs(true);
      const { data } = await api.get(`/things-to-do/campgrounds/${campgroundId}/recommendations?radius=30`);
      setRecommendations(data.recommendations || []);
    } catch {
      setRecommendations([]);
    } finally {
      setLoadingRecs(false);
    }
  };

  const loadAiPicks = async () => {
    try {
      setLoadingAi(true);
      const { data } = await api.get(`/things-to-do/campgrounds/${campgroundId}/ai-picks?radius=30`);
      setAiPicks(data.picks || []);
    } catch {
      setAiPicks([]);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleAddToTrip = async (item: Recommendation | AiPick) => {
    if (!user) return;
    setAddingId(item.placeId);
    try {
      let thingId = (item as Recommendation).existingId;
      if (!thingId) {
        const { data } = await api.post('/things-to-do/save', {
          campgroundId,
          placeId: item.placeId,
          sourceUrl: item.sourceUrl,
          sourceName: 'sourceName' in item ? (item as Recommendation).sourceName : 'Google',
          title: item.title,
          type: item.type || 'OTHER',
          lat: item.lat,
          lng: item.lng,
          address: item.address,
          imageUrl: item.imageUrl,
        });
        thingId = data.thingToDo?.id || data.id;
        setRecommendations(prev => prev.map(r => r.placeId === item.placeId ? { ...r, isSaved: true, existingId: thingId } : r));
      }
      setAddToEventModal({ isOpen: true, thingId: thingId!, thingTitle: item.title });
    } catch (e) {
      console.error('Save and add to event error', e);
    } finally {
      setAddingId(null);
    }
  };

  // Upsert a NearbyExperience by placeId then navigate to its detail page
  const goToExperience = async (item: Recommendation | AiPick) => {
    try {
      const { data } = await api.post('/experiences', {
        placeId: item.placeId,
        name: item.title,
        address: item.address,
        category: item.type || 'OTHER',
        latitude: item.lat,
        longitude: item.lng,
        photoUrls: item.imageUrl ? [item.imageUrl] : [],
        website: item.sourceUrl,
      });
      navigate(`/experiences/${data.id}`);
    } catch (err: any) {
      // If duplicate placeId, fetch existing and navigate
      try {
        const { data: nearby } = await api.get(`/experiences/nearby?lat=${item.lat}&lng=${item.lng}&radius=1`);
        const match = nearby.find((e: any) => e.placeId === item.placeId);
        if (match) navigate(`/experiences/${match.id}`);
        else window.open(item.sourceUrl, '_blank');
      } catch {
        window.open(item.sourceUrl, '_blank');
      }
    }
  };

  const filteredRecs = category === 'ALL'
    ? recommendations
    : recommendations.filter(r => r.type === category);

  const filteredAiPicks = category === 'ALL'
    ? aiPicks
    : aiPicks.filter(p => p.type === category);

  const totalCount = recommendations.length + aiPicks.length;
  const isLoading = loadingRecs && loadingAi;
  const hasContent = filteredAiPicks.length > 0 || filteredRecs.length > 0;

  if (!isLoading && totalCount === 0) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl overflow-hidden mb-6">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3.5 flex items-center justify-between group transition"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Compass className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-sm text-white">Explore Nearby</h3>
              {!expanded && totalCount > 0 && (
                <p className="text-[11px] text-white/40">{totalCount} activities & attractions nearby</p>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition ${
            expanded
              ? 'bg-white/10 text-white/60 group-hover:bg-white/15'
              : 'bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30'
          }`}>
            {expanded ? 'Hide' : 'Explore'}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4">
            {/* Section header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Explore Nearby</span>
              <span className="text-[10px] text-amber-400/60 italic">Powered by Hitch</span>
            </div>

            {/* Category filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
              {[
                { key: 'ALL', label: 'All', icon: '✨' },
                { key: 'TRAIL', label: 'Hiking', icon: '🥾' },
                { key: 'FOOD', label: 'Food', icon: '🍔' },
                { key: 'PLAYGROUND', label: 'Family', icon: '👨‍👩‍👧' },
                { key: 'SCENIC_VIEW', label: 'Scenic', icon: '🏔️' },
                { key: 'ATTRACTION', label: 'Attractions', icon: '📸' },
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    category === cat.key
                      ? 'bg-amber-500 text-gray-900'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                <span className="ml-2 text-sm text-white/50">Discovering nearby activities...</span>
              </div>
            ) : !hasContent ? (
              <div className="text-center py-8 text-white/40 text-sm">
                No activities found in this category
              </div>
            ) : (
              <>
                {/* Unified tile grid — AI picks merged with recommendations, AI picks ranked first */}
                {(() => {
                  const aiTiles = filteredAiPicks.map(p => ({
                    key: `ai-${p.placeId}`, name: p.title, imageUrl: p.imageUrl, distance: p.distance,
                    driveTime: Math.round(p.distance / 0.5), rating: p.rating, reviewCount: p.reviewCount,
                    category: p.type || 'OTHER', isAiPick: true, item: p as Recommendation | AiPick,
                  }));
                  const recTiles = filteredRecs.map(r => ({
                    key: `rec-${r.placeId}`, name: r.title, imageUrl: r.imageUrl, distance: r.distance,
                    driveTime: Math.round(r.distance / 0.5), rating: r.rating, reviewCount: r.reviewCount,
                    category: r.type || 'OTHER', isAiPick: false, item: r as Recommendation | AiPick,
                  }));
                  // Merge: AI picks first, then recs (dedup by name)
                  const seen = new Set<string>();
                  const merged = [...aiTiles, ...recTiles].filter(t => {
                    if (seen.has(t.name)) return false;
                    seen.add(t.name);
                    return true;
                  });
                  // Show 3 rows: 6 on mobile (2-col), 9 on md+ (3-col) — use 6 as default cap
                  const INITIAL_COUNT = 6;
                  const visible = showAllTiles ? merged : merged.slice(0, INITIAL_COUNT);
                  const hasMore = merged.length > INITIAL_COUNT;

                  return (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                        {visible.map(t => (
                          <NearbyTile
                            key={t.key}
                            name={t.name}
                            imageUrl={t.imageUrl}
                            distanceMiles={t.distance}
                            driveTimeMinutes={t.driveTime}
                            rating={t.rating}
                            reviewCount={t.reviewCount}
                            category={t.category}
                            badge={assignBadge({ rating: t.rating, reviewCount: t.reviewCount, category: t.category, isAiPick: t.isAiPick })}
                            onPress={() => goToExperience(t.item)}
                          />
                        ))}
                      </div>
                      {hasMore && (
                        <button
                          onClick={() => setShowAllTiles(!showAllTiles)}
                          className="w-full mt-3 py-2 text-center text-xs font-semibold text-amber-400 hover:text-amber-300 transition flex items-center justify-center gap-1"
                        >
                          {showAllTiles ? 'Show Less' : `Show More (${merged.length - INITIAL_COUNT} more)`}
                          {showAllTiles ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add to Event Modal */}
      <AddToEventModal
        isOpen={addToEventModal.isOpen}
        onClose={() => setAddToEventModal({ isOpen: false, thingId: '', thingTitle: '' })}
        thingToDoId={addToEventModal.thingId}
        thingTitle={addToEventModal.thingTitle}
        campgroundId={campgroundId}
        preselectedEventId={eventId}
        onActivityAdded={onActivityAdded}
      />
    </>
  );
}
