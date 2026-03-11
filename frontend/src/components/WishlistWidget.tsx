import { useState, useEffect } from 'react';
import { Heart, MapPin, ChevronRight, Star, Trash2, StickyNote, X, Calendar, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface WishlistItem {
  id: string;
  campgroundId: string;
  notes: string | null;
  priority: number;
  createdAt: string;
  campground: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
    imageUrl: string | null;
    photos: { url: string; imageUrl?: string }[];
  };
}

interface PlaceItem {
  id: string;
  placeId: string;
  name: string;
  address: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  type: string;
  rating: number | null;
  notes: string | null;
  createdAt: string;
}

export default function WishlistWidget() {
  const [activeTab, setActiveTab] = useState<'campgrounds' | 'places'>('campgrounds');
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      const [{ data }, { data: placesData }] = await Promise.all([
        api.get('/wishlist'),
        api.get('/place-wishlist'),
      ]);
      setItems(data);
      setPlaces(placesData);
    } catch (error) {
      console.error('Load wishlist error:', error);
    } finally {
      setLoading(false);
    }
  };

  const removePlace = async (placeId: string) => {
    try {
      await api.delete(`/place-wishlist/${placeId}`);
      setPlaces(prev => prev.filter(p => p.placeId !== placeId));
    } catch (e) {
      console.error('Remove place error', e);
    }
  };

  const removeFromWishlist = async (campgroundId: string) => {
    try {
      await api.delete(`/wishlist/${campgroundId}`);
      setItems(prev => prev.filter(i => i.campgroundId !== campgroundId));
    } catch (error) {
      console.error('Remove from wishlist error:', error);
    }
  };

  const updatePriority = async (campgroundId: string, priority: number) => {
    try {
      await api.put(`/wishlist/${campgroundId}`, { priority });
      setItems(prev => prev.map(i => 
        i.campgroundId === campgroundId ? { ...i, priority } : i
      ).sort((a, b) => b.priority - a.priority));
    } catch (error) {
      console.error('Update priority error:', error);
    }
  };

  const saveNotes = async (campgroundId: string) => {
    try {
      await api.put(`/wishlist/${campgroundId}`, { notes: noteText });
      setItems(prev => prev.map(i => 
        i.campgroundId === campgroundId ? { ...i, notes: noteText } : i
      ));
      setEditingNotes(null);
      setNoteText('');
    } catch (error) {
      console.error('Save notes error:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded mb-2"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (items.length === 0 && places.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-red-50 border-b">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-gray-900">My Wishlist</h3>
          </div>
        </div>
        <div className="relative">
          <img src="/images/Daydreaming.png" alt="Daydreaming about camping" className="w-full h-40 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/90 to-transparent flex flex-col items-center justify-end pb-3">
            <p className="text-gray-600 text-sm font-medium">Start daydreaming...</p>
            <Link to="/campgrounds" className="text-primary-600 text-sm hover:underline">
              Explore campgrounds →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-red-50 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
          <h3 className="font-semibold text-gray-900">My Wishlist</h3>
        </div>
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('campgrounds')}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-medium transition ${
              activeTab === 'campgrounds'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-600 hover:bg-red-50'
            }`}
          >
            🏕️ Campgrounds {items.length > 0 && <span className="ml-1 opacity-75">({items.length})</span>}
          </button>
          <button
            onClick={() => setActiveTab('places')}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-medium transition ${
              activeTab === 'places'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-600 hover:bg-red-50'
            }`}
          >
            📍 Places {places.length > 0 && <span className="ml-1 opacity-75">({places.length})</span>}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="divide-y max-h-96 overflow-y-auto">
        {/* Places Tab */}
        {activeTab === 'places' && places.length === 0 && (
          <div className="p-6 text-center">
            <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">No saved places yet</p>
            <p className="text-xs text-gray-300 mt-1">Heart restaurants, attractions & stops on your trips</p>
          </div>
        )}
        {activeTab === 'places' && places.map(place => (
          <div key={place.id} className="p-3 hover:bg-gray-50">
            <div className="flex gap-3">
              {place.imageUrl ? (
                <img src={place.imageUrl} alt={place.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 line-clamp-1">{place.name}</p>
                {place.address && (
                  <p className="text-xs text-gray-500 line-clamp-1">{place.address}</p>
                )}
                <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">
                  {place.type?.replace(/_/g, ' ') || 'Place'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {place.sourceUrl && (
                  <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => removePlace(place.placeId)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {place.notes && (
              <p className="mt-1 text-xs text-gray-600 bg-yellow-50 px-2 py-1 rounded">📝 {place.notes}</p>
            )}
          </div>
        ))}
        {/* Campgrounds Tab */}
        {activeTab === 'campgrounds' && items.length === 0 && (
          <div className="p-6 text-center">
            <Heart className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">No campgrounds wishlisted yet</p>
            <Link to="/campgrounds" className="text-xs text-primary-600 hover:underline mt-1 inline-block">
              Explore campgrounds →
            </Link>
          </div>
        )}
        {activeTab === 'campgrounds' && items.map(item => (
          <div key={item.id} className="p-3 hover:bg-gray-50">
            <div className="flex gap-3">
              {/* Photo */}
              <Link to={`/campgrounds/${item.campgroundId}`} className="flex-shrink-0">
                {(item.campground.imageUrl || item.campground.photos?.[0]?.imageUrl || item.campground.photos?.[0]?.url) ? (
                  <img 
                    src={item.campground.imageUrl || item.campground.photos?.[0]?.imageUrl || item.campground.photos?.[0]?.url} 
                    alt={item.campground.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link 
                  to={`/campgrounds/${item.campgroundId}`}
                  className="font-medium text-gray-900 hover:text-primary-600 line-clamp-1"
                >
                  {item.campground.name}
                </Link>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="w-3 h-3" />
                  {item.campground.city && `${item.campground.city}, `}{item.campground.state}
                </div>

                {/* Notes */}
                {item.notes && editingNotes !== item.campgroundId && (
                  <div 
                    className="mt-1 text-xs text-gray-600 bg-yellow-50 px-2 py-1 rounded cursor-pointer"
                    onClick={() => {
                      setEditingNotes(item.campgroundId);
                      setNoteText(item.notes || '');
                    }}
                  >
                    📝 {item.notes}
                  </div>
                )}

                {/* Priority stars */}
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3].map(star => (
                    <button
                      key={star}
                      onClick={() => updatePriority(item.campgroundId, item.priority === star ? 0 : star)}
                      className="p-0.5"
                    >
                      <Star 
                        className={`w-4 h-4 ${star <= item.priority ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setEditingNotes(item.campgroundId);
                    setNoteText(item.notes || '');
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title="Add note"
                >
                  <StickyNote className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeFromWishlist(item.campgroundId)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link
                  to={`/trips?createFromWishlist=true&campgroundId=${item.campgroundId}&campgroundName=${encodeURIComponent(item.campground.name)}`}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                  title="Plan a trip"
                >
                  <Calendar className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Edit notes inline */}
            {editingNotes === item.campgroundId && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 px-2 py-1 text-sm border rounded"
                  autoFocus
                />
                <button
                  onClick={() => saveNotes(item.campgroundId)}
                  className="px-2 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingNotes(null);
                    setNoteText('');
                  }}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t">
        <Link 
          to="/campgrounds" 
          className="text-sm text-primary-600 hover:underline flex items-center gap-1"
        >
          Explore more campgrounds <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
