import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, MapPin, Star, Sparkles, CalendarPlus, Loader2, Mountain, Utensils, Camera, Ticket, Compass, Clock, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AddToEventModal from './AddToEventModal';

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
  const [expanded, setExpanded] = useState(true);
  const [category, setCategory] = useState('ALL');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [aiPicks, setAiPicks] = useState<AiPick[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [loadingAi, setLoadingAi] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addToEventModal, setAddToEventModal] = useState<{ isOpen: boolean; thingId: string; thingTitle: string }>({ isOpen: false, thingId: '', thingTitle: '' });

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
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">Explore Nearby</h3>
            {!expanded && totalCount > 0 && (
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                {totalCount} activities
              </span>
            )}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-white/50" /> : <ChevronDown className="w-4 h-4 text-white/50" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4">
            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
              {CATEGORIES.map(cat => (
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
                {/* AI Picks */}
                {filteredAiPicks.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">AI Picks for You</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                      {filteredAiPicks.slice(0, 3).map(pick => (
                        <div
                          key={pick.placeId}
                          className="flex-shrink-0 w-64 rounded-xl overflow-hidden"
                          style={{ background: 'linear-gradient(135deg, rgba(232,168,56,0.15), rgba(168,85,247,0.1))' , border: '1px solid rgba(232,168,56,0.25)' }}
                        >
                          {pick.imageUrl ? (
                            <img src={pick.imageUrl} alt={pick.title} className="w-full h-28 object-cover" />
                          ) : (
                            <div className="w-full h-28 bg-gradient-to-br from-amber-500/20 to-purple-500/20 flex items-center justify-center">
                              <span className="text-3xl">{TYPE_CONFIG[pick.type]?.icon || '📍'}</span>
                            </div>
                          )}
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-bold text-sm text-white leading-tight line-clamp-1">{pick.title}</h4>
                              <span className="flex items-center gap-0.5 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                <Sparkles className="w-2.5 h-2.5" /> AI
                              </span>
                            </div>
                            <p className="text-[11px] text-amber-200/70 italic line-clamp-2 mb-2">{pick.tip}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-[10px] text-white/50">
                                {pick.rating && (
                                  <span className="flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 text-amber-400 fill-current" />
                                    {pick.rating.toFixed(1)}
                                  </span>
                                )}
                                <span>{pick.distance.toFixed(1)} mi</span>
                              </div>
                              {eventId && (
                                <button
                                  onClick={() => handleAddToTrip(pick)}
                                  disabled={addingId === pick.placeId}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500 text-gray-900 hover:bg-amber-400 transition disabled:opacity-50"
                                >
                                  {addingId === pick.placeId ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CalendarPlus className="w-3 h-3" />
                                  )}
                                  Add to Trip
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations grid */}
                {filteredRecs.length > 0 && (
                  <div>
                    {filteredAiPicks.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-white/40" />
                        <span className="text-xs font-bold text-white/40 uppercase tracking-wider">More Nearby</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                      {filteredRecs.slice(0, 6).map(rec => {
                        const typeInfo = TYPE_CONFIG[rec.type] || TYPE_CONFIG.OTHER;
                        return (
                          <div
                            key={rec.placeId}
                            className="bg-white/[0.07] rounded-xl overflow-hidden hover:bg-white/[0.12] transition group"
                          >
                            {rec.imageUrl ? (
                              <img src={rec.imageUrl} alt={rec.title} className="w-full h-24 object-cover" />
                            ) : (
                              <div className="w-full h-24 bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center">
                                <span className="text-2xl">{typeInfo.icon}</span>
                              </div>
                            )}
                            <div className="p-2.5">
                              <h4 className="font-semibold text-xs text-white leading-tight line-clamp-1 mb-1">{rec.title}</h4>
                              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${typeInfo.color}`}>
                                  {typeInfo.label}
                                </span>
                                <span className="text-[10px] text-white/40">{rec.distance.toFixed(1)} mi</span>
                                {rec.rating && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-white/50">
                                    <Star className="w-2.5 h-2.5 text-amber-400 fill-current" />
                                    {rec.rating.toFixed(1)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {rec.isOpen !== undefined && (
                                  <span className={`text-[9px] font-medium ${rec.isOpen ? 'text-green-400' : 'text-red-400'}`}>
                                    {rec.isOpen ? 'Open' : 'Closed'}
                                  </span>
                                )}
                                {eventId && (
                                  <button
                                    onClick={() => handleAddToTrip(rec)}
                                    disabled={addingId === rec.placeId}
                                    className="ml-auto flex items-center gap-0.5 px-2 py-1 rounded-lg text-[9px] font-bold bg-white/10 text-white/80 hover:bg-amber-500 hover:text-gray-900 transition disabled:opacity-50"
                                  >
                                    {addingId === rec.placeId ? (
                                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                    ) : (
                                      <CalendarPlus className="w-2.5 h-2.5" />
                                    )}
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* See all link */}
                {(recommendations.length > 6 || onSeeAll) && (
                  <button
                    onClick={onSeeAll}
                    className="w-full mt-3 py-2 text-center text-xs font-semibold text-amber-400 hover:text-amber-300 transition flex items-center justify-center gap-1"
                  >
                    See all nearby activities
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
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
