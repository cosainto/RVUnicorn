import { useState, useEffect } from 'react';
import { MapPin, ExternalLink, Bookmark, BookmarkCheck, Star, Filter, Loader2, X, Mountain, Utensils, Camera, Ticket, Map, Calendar, Sparkles, Clock, Heart, HeartOff, CalendarPlus } from 'lucide-react';
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
  isWishlisted?: boolean;
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
  isWishlisted?: boolean;
}

interface SavedThing {
  id: string;
  type: string;
  title: string;
  description?: string;
  address?: string;
  sourceUrl: string;
  sourceName: string;
  imageUrl?: string;
  tags: string[];
  distanceMiles?: number;
  pinned: boolean;
  saveCount: number;
  isSaved: boolean;
}

interface Props {
  isAdmin?: boolean;
  userInterests?: string[];
  campgroundId: string;
  campgroundName: string;
  eventId?: string;
  onActivityAdded?: () => void;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  TRAIL: { icon: Mountain, color: 'text-green-600', bg: 'bg-green-100', label: 'Trail' },
  FOOD: { icon: Utensils, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Food' },
  ATTRACTION: { icon: Camera, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Attraction' },
  EVENT: { icon: Ticket, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Event' },
  TOUR: { icon: Map, color: 'text-teal-600', bg: 'bg-teal-100', label: 'Tour' },
  OTHER: { icon: MapPin, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Other' }
};

const COMMON_TAGS = ['kid-friendly', 'dog-friendly', 'free', 'rainy-day', 'scenic', 'easy-access', 'reservation-required'];

export default function ThingsToDoSection({ campgroundId, campgroundName, onActivityAdded, isAdmin = false, userInterests = [], eventId }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'saved' | 'discover'>('discover');
  const [savedThings, setSavedThings] = useState<SavedThing[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addToEventModal, setAddToEventModal] = useState<{ isOpen: boolean; thingId: string; thingTitle: string } | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [radiusMiles, setRadiusMiles] = useState(30);
  const [showSaveModal, setShowSaveModal] = useState<Recommendation | null>(null);
  const [saveNote, setSaveNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [featuredItems, setFeaturedItems] = useState<SavedThing[]>([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [aiPicks, setAiPicks] = useState<AiPick[]>([]);
  const [loadingAiPicks, setLoadingAiPicks] = useState(false);
  const [aiPicksLoaded, setAiPicksLoaded] = useState(false);
  const [showHours, setShowHours] = useState<string | null>(null);
  const [wishlistingId, setWishlistingId] = useState<string | null>(null);

  const handleWishlist = async (item: { placeId: string; title: string; address?: string; sourceUrl?: string; imageUrl?: string; type?: string; rating?: number; isWishlisted?: boolean }) => {
    if (!user) return;
    setWishlistingId(item.placeId);
    try {
      if (item.isWishlisted) {
        await api.delete(`/place-wishlist/${item.placeId}`);
      } else {
        await api.post('/place-wishlist', {
          placeId: item.placeId,
          name: item.title,
          address: item.address,
          sourceUrl: item.sourceUrl,
          imageUrl: item.imageUrl,
          type: item.type || 'ATTRACTION',
          rating: item.rating,
        });
      }
      // Update recommendation state
      setRecommendations(prev => prev.map(r => r.placeId === item.placeId ? { ...r, isWishlisted: !item.isWishlisted } : r));
    } catch (e) {
      console.error('Wishlist error', e);
    } finally {
      setWishlistingId(null);
    }
  };
  const [addingToEventId, setAddingToEventId] = useState<string | null>(null);

  const saveAndAddToEvent = async (rec: Recommendation | AiPick) => {
    if (!user) return;
    setAddingToEventId(rec.placeId);
    try {
      let thingId = (rec as Recommendation).existingId;
      // Save first if not already saved
      if (!thingId) {
        const { data } = await api.post('/things-to-do/save', {
          campgroundId,
          placeId: rec.placeId,
          sourceUrl: rec.sourceUrl,
          sourceName: 'source' in rec ? (rec as Recommendation).sourceName : 'Google',
          title: rec.title,
          type: rec.type,
          lat: rec.lat,
          lng: rec.lng,
          address: rec.address,
          imageUrl: rec.imageUrl,
        });
        thingId = data.id;
        setRecommendations(prev => prev.map(r => r.placeId === rec.placeId ? { ...r, isSaved: true, existingId: thingId } : r));
        loadSavedThings();
      }
      setAddToEventModal({ isOpen: true, thingId: thingId!, thingTitle: rec.title });
    } catch (e) {
      console.error('Save and add to event error', e);
    } finally {
      setAddingToEventId(null);
    }
  };

  const [featuringId, setFeaturingId] = useState<string | null>(null);

  useEffect(() => { loadSavedThings(); loadFeatured(); }, [campgroundId]);

  // Auto-rotate featured carousel
  useEffect(() => {
    if (featuredItems.length <= 1) return;
    const timer = setInterval(() => {
      setFeaturedIndex(i => (i + 1) % featuredItems.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [featuredItems.length]);

  const loadSavedThings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/things-to-do/campgrounds/${campgroundId}/things-to-do`);
      setSavedThings(data);
    } catch (error) { console.error('Load saved things error:', error); }
    finally { setLoading(false); }
  };

  const loadFeatured = async () => {
    try {
      const { data } = await api.get(`/things-to-do/campgrounds/${campgroundId}/featured`);
      setFeaturedItems(data);
    } catch (error) { console.error('Load featured error:', error); }
  };

  const handleFeature = async (thingId: string, pinned: boolean) => {
    if (!isAdmin) return;
    try {
      setFeaturingId(thingId);
      await api.put(`/things-to-do/campgrounds/${campgroundId}/discovery/${thingId}/feature`, { pinned });
      loadSavedThings();
      loadFeatured();
    } catch (error) { console.error('Feature error:', error); }
    finally { setFeaturingId(null); }
  };

  const handleRemoveFromDiscovery = async (thingId: string) => {
    if (!isAdmin) return;
    if (!confirm('Remove this item from discovery?')) return;
    try {
      await api.delete(`/things-to-do/campgrounds/${campgroundId}/discovery/${thingId}`);
      loadSavedThings();
      loadFeatured();
    } catch (error) { console.error('Remove error:', error); }
  };

  const loadAiPicks = async () => {
    if (aiPicksLoaded) return;
    setLoadingAiPicks(true);
    try {
      const { data } = await api.get(`/things-to-do/campgrounds/${campgroundId}/ai-picks`, { params: { radius: radiusMiles } });
      setAiPicks(data.picks || []);
      setAiPicksLoaded(true);
    } catch (error) { console.error('AI picks error:', error); }
    finally { setLoadingAiPicks(false); }
  };

  const loadRecommendations = async () => {
    try {
      setDiscoverLoading(true);
      const { data } = await api.get(`/things-to-do/campgrounds/${campgroundId}/recommendations`, { params: { radius: radiusMiles } });
      const recs = data.recommendations || [];
      // Cross-reference with user's place wishlist
      if (user && recs.length > 0) {
        try {
          const { data: wishlistData } = await api.get('/place-wishlist');
          const savedIds = new Set((wishlistData || []).map((p: any) => p.placeId));
          setRecommendations(recs.map((r: any) => ({ ...r, isWishlisted: savedIds.has(r.placeId) })));
        } catch {
          setRecommendations(recs);
        }
      } else {
        setRecommendations(recs);
      }
    } catch (error) { console.error('Load recommendations error:', error); }
    finally { setDiscoverLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'discover') {
      if (recommendations.length === 0) loadRecommendations();
      if (!aiPicksLoaded) loadAiPicks();
    }
  }, [activeTab]);

  const handleSave = (rec: Recommendation) => {
    if (!user) { alert('Please log in to save things'); return; }
    setShowSaveModal(rec);
    setSaveNote('');
    setSelectedTags([]);
  };

  const confirmSave = async () => {
    if (!showSaveModal) return;
    const rec = showSaveModal;
    setSavingId(rec.placeId);
    try {
      await api.post('/things-to-do/save', {
        campgroundId, placeId: rec.placeId, sourceUrl: rec.sourceUrl, sourceName: rec.sourceName,
        title: rec.title, type: rec.type, lat: rec.lat, lng: rec.lng, address: rec.address,
        imageUrl: rec.imageUrl, tags: selectedTags, note: saveNote || undefined
      });
      setRecommendations(prev => prev.map(r => r.placeId === rec.placeId ? { ...r, isSaved: true } : r));
      loadSavedThings();
      setShowSaveModal(null);
    } catch (error) { console.error('Save error:', error); alert('Failed to save'); }
    finally { setSavingId(null); }
  };

  const handleUnsave = async (thingId: string) => {
    try {
      await api.delete(`/things-to-do/save/${thingId}`);
      setSavedThings(prev => prev.filter(t => t.id !== thingId));
      setRecommendations(prev => prev.map(r => r.existingId === thingId ? { ...r, isSaved: false } : r));
    } catch (error) { console.error('Unsave error:', error); }
  };

  const toggleTag = (tag: string) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const filteredSaved = typeFilter === 'all' ? savedThings : savedThings.filter(t => t.type === typeFilter);
  const filteredRecs = typeFilter === 'all' ? recommendations : recommendations.filter(r => r.type === typeFilter);

  const TypeIcon = ({ type }: { type: string }) => {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.OTHER;
    const Icon = config.icon;
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}><Icon className="w-3 h-3" />{config.label}</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Things to Do Nearby</h2>
        <p className="text-sm text-gray-600 mt-1">Discover attractions, trails, and restaurants near {campgroundName}</p>
      </div>

      {/* Featured Events & Activities Carousel */}
      {featuredItems.length > 0 && (
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Featured Events & Activities
              </h3>
              <div className="flex gap-1">
                {featuredItems.map((_, i) => (
                  <button key={i} onClick={() => setFeaturedIndex(i)} className={`w-2 h-2 rounded-full transition ${i === featuredIndex ? 'bg-white' : 'bg-white/40'}`} />
                ))}
              </div>
            </div>
            {featuredItems[featuredIndex] && (
              <a href={featuredItems[featuredIndex].sourceUrl} target="_blank" rel="noopener noreferrer" className="flex gap-4 group">
                {featuredItems[featuredIndex].imageUrl && (
                  <img src={featuredItems[featuredIndex].imageUrl} alt="" className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg group-hover:underline truncate">{featuredItems[featuredIndex].title}</p>
                  <p className="text-white/80 text-sm line-clamp-2">{featuredItems[featuredIndex].description || featuredItems[featuredIndex].address}</p>
                  {featuredItems[featuredIndex].distanceMiles && (
                    <p className="text-white/70 text-xs mt-1">{featuredItems[featuredIndex].distanceMiles.toFixed(1)} miles away</p>
                  )}
                </div>
                <ExternalLink className="w-5 h-5 text-white/60 flex-shrink-0" />
              </a>
            )}
          </div>
        </div>
      )}

      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab('saved')} className={`flex-1 px-4 py-3 text-sm font-medium transition ${activeTab === 'saved' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
          <BookmarkCheck className="w-4 h-4 inline mr-2" />Saved ({savedThings.length})
        </button>
        <button onClick={() => setActiveTab('discover')} className={`flex-1 px-4 py-3 text-sm font-medium transition ${activeTab === 'discover' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
          <Map className="w-4 h-4 inline mr-2" />Discover
        </button>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
            <option value="all">All Types</option>
            <option value="TRAIL">Trails</option>
            <option value="FOOD">Food</option>
            <option value="ATTRACTION">Attractions</option>
            <option value="EVENT">Events</option>
            <option value="TOUR">Tours</option>
          </select>
        </div>
        {activeTab === 'discover' && (
          <>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <select value={radiusMiles} onChange={(e) => { setRadiusMiles(Number(e.target.value)); setRecommendations([]); }} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
                <option value={10}>10 miles</option>
                <option value={20}>20 miles</option>
                <option value={30}>30 miles</option>
                <option value={50}>50 miles</option>
              </select>
            </div>
            <button onClick={loadRecommendations} disabled={discoverLoading} className="ml-auto text-sm text-blue-600 hover:text-blue-700 font-medium">
              {discoverLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </button>
          </>
        )}
      </div>

      <div className="p-4 max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : activeTab === 'saved' ? (
          filteredSaved.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600">No saved places yet</p>
              <button onClick={() => setActiveTab('discover')} className="mt-3 text-blue-600 hover:text-blue-700 font-medium text-sm">Discover nearby attractions →</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredSaved.map(thing => (
                <div key={thing.id} className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition">
                  {thing.imageUrl && <div className="relative h-32 bg-gray-100"><img src={thing.imageUrl} alt={thing.title} className="w-full h-full object-cover" />{thing.pinned && <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded">Pinned</span>}</div>}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{thing.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap"><TypeIcon type={thing.type} />{thing.distanceMiles && <span className="text-xs text-gray-500">{thing.distanceMiles.toFixed(1)} mi</span>}</div>
                      </div>
                      {eventId && (
                      <button onClick={() => setAddToEventModal({ isOpen: true, thingId: thing.id, thingTitle: thing.title })} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Add to schedule"><CalendarPlus className="w-5 h-5" /></button>
                    )}
                      <button onClick={() => handleUnsave(thing.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Unsave"><BookmarkCheck className="w-5 h-5" /></button>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button onClick={() => handleFeature(thing.id, !thing.pinned)} disabled={featuringId === thing.id} className={`p-1.5 rounded-lg transition ${thing.pinned ? 'text-yellow-600 bg-yellow-50' : 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'}`} title={thing.pinned ? 'Unfeature' : 'Feature'}>★</button>
                          <button onClick={() => handleRemoveFromDiscovery(thing.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Remove"><X className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    {thing.address && <p className="text-sm text-gray-500 mt-2 truncate">{thing.address}</p>}
                    {thing.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{thing.tags.slice(0, 3).map(tag => <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>)}</div>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">via {thing.sourceName}</span>
                      <a href={thing.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">View <ExternalLink className="w-3 h-3" /></a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : discoverLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /><span className="ml-3 text-gray-600">Finding nearby places...</span></div>
        ) : filteredRecs.length === 0 ? (
          <div className="text-center py-12"><Map className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-600">No recommendations found</p><p className="text-sm text-gray-400 mt-1">Try increasing the search radius</p></div>
        ) : (
          <>
          {/* AI Picks Section */}
          {(loadingAiPicks || aiPicks.length > 0) && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">AI Picks</h3>
                    <p className="text-xs text-gray-400">Curated by Hitch based on what campers love here</p>
                  </div>
                  {loadingAiPicks && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
                </div>
                {userInterests && userInterests.length > 0 && (
                  <span className="text-xs text-violet-600 bg-violet-50 border border-violet-200 px-2 py-1 rounded-full">💜 Personalized for you</span>
                )}
              </div>
              {loadingAiPicks ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1,2,3].map(i => <div key={i} className="h-40 bg-amber-50 rounded-xl animate-pulse border border-amber-100" />)}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {aiPicks.map(pick => {
                    // Check if this pick matches user interests
                    const matchesInterest = userInterests && userInterests.length > 0 && userInterests.some(interest =>
                      pick.title?.toLowerCase().includes(interest.toLowerCase()) ||
                      pick.tip?.toLowerCase().includes(interest.toLowerCase()) ||
                      interest.toLowerCase().includes(pick.type?.toLowerCase() || '')
                    );
                    return (
                    <a key={pick.placeId} href={pick.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className={`group rounded-xl overflow-hidden hover:shadow-lg transition block relative ${matchesInterest ? 'bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-300 ring-1 ring-violet-200' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200'}`}>
                      {/* Badges */}
                      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white shadow-sm">
                          ✨ AI Pick
                        </span>
                        {matchesInterest && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-600 text-white shadow-sm">
                            💜 Picked for you
                          </span>
                        )}
                      </div>
                      {pick.imageUrl
                        ? <div className="h-32 bg-gray-100 overflow-hidden"><img src={pick.imageUrl} alt={pick.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /></div>
                        : <div className={`h-16 ${matchesInterest ? 'bg-violet-100' : 'bg-amber-100'}`} />
                      }
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className={`font-bold text-sm leading-tight ${matchesInterest ? 'text-violet-900' : 'text-gray-900'}`}>{pick.title}</h4>
                          <span className={`text-xs font-medium whitespace-nowrap ${matchesInterest ? 'text-violet-600' : 'text-amber-600'}`}>{pick.distance} mi</span>
                        </div>
                        {pick.rating && <div className="flex items-center gap-1 mt-1"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /><span className="text-xs text-gray-600">{pick.rating} ({pick.reviewCount})</span></div>}
                        <p className={`text-xs mt-2 line-clamp-2 italic ${matchesInterest ? 'text-violet-700' : 'text-gray-600'}`}>"{pick.tip}"</p>
                        {/* Hours toggle */}
                        {pick.openingHours && pick.openingHours.length > 0 && (
                          <div className="mt-1">
                            <button onClick={(e) => { e.preventDefault(); setShowHours(showHours === pick.placeId ? null : pick.placeId); }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                              <Clock className="w-3 h-3" />{showHours === pick.placeId ? 'Hide hours' : 'See hours'}
                            </button>
                            {showHours === pick.placeId && (
                              <div className="mt-1 bg-white/60 rounded p-2 text-xs text-gray-600 space-y-0.5">
                                {pick.openingHours.map((h, i) => <div key={i}>{h}</div>)}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Actions */}
                        {user && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-100">
                            <button
                              onClick={(e) => { e.preventDefault(); handleWishlist({ placeId: pick.placeId, title: pick.title, address: pick.address, sourceUrl: pick.sourceUrl, imageUrl: pick.imageUrl, type: pick.type, rating: pick.rating, isWishlisted: pick.isWishlisted }); }}
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition ${pick.isWishlisted ? 'border-purple-400 text-white bg-purple-500' : 'border-gray-200 text-gray-500 hover:border-purple-400 hover:text-purple-600'}`}
                            >
                              <span className="text-sm">🧞</span>
                              {pick.isWishlisted ? 'Wishlisted' : 'Wishlist'}
                            </button>
                            {eventId && (
                              <button
                                onClick={(e) => { e.preventDefault(); saveAndAddToEvent(pick); }}
                                disabled={addingToEventId === pick.placeId}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600 transition"
                                title="Add to trip schedule"
                              >
                                {addingToEventId === pick.placeId ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarPlus className="w-3 h-3" />}
                                Add to Schedule
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </a>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-gray-200 mt-4 mb-4" />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {filteredRecs.map(rec => (
              <div key={rec.placeId} className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition flex gap-3 p-3">
                {/* Thumbnail */}
                {rec.imageUrl
                  ? <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100"><img src={rec.imageUrl} alt={rec.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /></div>
                  : <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center"><TypeIcon type={rec.type} /></div>
                }
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate text-sm">{rec.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <TypeIcon type={rec.type} />
                        <span className="text-xs text-gray-500">{rec.distance} mi</span>
                        {rec.isOpen !== undefined && <span className={`text-xs ${rec.isOpen ? 'text-green-600' : 'text-red-500'}`}>{rec.isOpen ? 'Open' : 'Closed'}</span>}
                      </div>
                    </div>
                    <button onClick={() => rec.isSaved ? null : handleSave(rec)} disabled={savingId === rec.placeId || rec.isSaved} className={`p-1.5 rounded-lg transition flex-shrink-0 ${rec.isSaved ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`} title={rec.isSaved ? 'Saved' : 'Save to RVUnicorn'}>
                      {savingId === rec.placeId ? <Loader2 className="w-4 h-4 animate-spin" /> : rec.isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                  </div>
                  {rec.address && <p className="text-xs text-gray-500 mt-1 truncate">{rec.address}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    {rec.rating && <span className="flex items-center gap-1 text-xs"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{rec.rating}{rec.reviewCount && <span className="text-gray-400">({rec.reviewCount})</span>}</span>}
                    {rec.priceLevel && <span className="text-green-600 text-xs">{'$'.repeat(rec.priceLevel)}<span className="text-gray-300">{'$'.repeat(4 - rec.priceLevel)}</span></span>}
                  </div>
                  {/* Hours */}
                  {rec.openingHours && rec.openingHours.length > 0 && (
                    <div className="mt-1">
                      <button onClick={() => setShowHours(showHours === rec.placeId ? null : rec.placeId)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                        <Clock className="w-3 h-3" />{showHours === rec.placeId ? 'Hide hours' : 'See hours'}
                      </button>
                      {showHours === rec.placeId && (
                        <div className="mt-1 bg-gray-50 rounded p-2 text-xs text-gray-600 space-y-0.5">
                          {rec.openingHours.map((h, i) => <div key={i}>{h}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">via {rec.sourceName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {user && (
                        <button
                          onClick={() => handleWishlist({ placeId: rec.placeId, title: rec.title, address: rec.address, sourceUrl: rec.sourceUrl, imageUrl: rec.imageUrl, type: rec.type, rating: rec.rating, isWishlisted: rec.isWishlisted })}
                          disabled={wishlistingId === rec.placeId}
                          className={`p-1 rounded transition text-xs flex items-center gap-0.5 ${rec.isWishlisted ? 'bg-purple-500 text-white rounded-full' : 'text-gray-400 hover:text-purple-500'}`}
                          title={rec.isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                        >
                          <span className="text-sm">🧞</span>
                        </button>
                      )}
                      {user && eventId && (
                        <button
                          onClick={() => saveAndAddToEvent(rec)}
                          disabled={addingToEventId === rec.placeId}
                          className="p-1 rounded transition text-gray-400 hover:text-green-600 hover:bg-green-50"
                          title="Add to trip schedule"
                        >
                          {addingToEventId === rec.placeId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <a href={rec.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">View <ExternalLink className="w-3 h-3" /></a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Save to RVUnicorn</h3>
              <button onClick={() => setShowSaveModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                {showSaveModal.imageUrl ? <img src={showSaveModal.imageUrl} alt={showSaveModal.title} className="w-16 h-16 rounded-lg object-cover" /> : <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center"><MapPin className="w-6 h-6 text-gray-400" /></div>}
                <div><h4 className="font-medium text-gray-900">{showSaveModal.title}</h4><p className="text-sm text-gray-500">{showSaveModal.distance} miles away</p></div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Add tags (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_TAGS.map(tag => <button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1 rounded-full text-sm transition ${selectedTags.includes(tag) ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-300'}`}>{tag}</button>)}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Your tip (optional)</label>
                <textarea value={saveNote} onChange={(e) => setSaveNote(e.target.value)} placeholder="Share a tip for other campers..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveModal(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button onClick={confirmSave} disabled={savingId === showSaveModal.placeId} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingId === showSaveModal.placeId ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><BookmarkCheck className="w-4 h-4" />Save</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add to Event Modal */}
      {addToEventModal && (
        <AddToEventModal
          isOpen={addToEventModal.isOpen}
          onClose={() => setAddToEventModal(null)}
          thingToDoId={addToEventModal.thingId}
          thingTitle={addToEventModal.thingTitle}
          campgroundId={campgroundId}
          onActivityAdded={onActivityAdded}
        />
      )}
    </div>
  );
}
