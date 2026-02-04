import { useState, useEffect } from 'react';
import { Heart, MapPin, ChevronRight, Star, Trash2, StickyNote, X } from 'lucide-react';
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
    photos: { url: string }[];
  };
}

export default function WishlistWidget() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      const { data } = await api.get('/wishlist');
      setItems(data);
    } catch (error) {
      console.error('Load wishlist error:', error);
    } finally {
      setLoading(false);
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

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-red-50 border-b">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-gray-900">My Wishlist</h3>
          </div>
        </div>
        <div className="p-6 text-center">
          <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">No campgrounds saved yet</p>
          <Link to="/campgrounds" className="text-primary-600 text-sm hover:underline">
            Explore campgrounds →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-red-50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            <h3 className="font-semibold text-gray-900">My Wishlist</h3>
          </div>
          <span className="px-2 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
            {items.length}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="divide-y max-h-96 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className="p-3 hover:bg-gray-50">
            <div className="flex gap-3">
              {/* Photo */}
              <Link to={`/campgrounds/${item.campgroundId}`} className="flex-shrink-0">
                {item.campground.photos?.[0]?.url ? (
                  <img 
                    src={item.campground.photos[0].imageUrl} 
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
                  to={`/trips/create?campgroundId=${item.campgroundId}&campgroundName=${encodeURIComponent(item.campground.name)}`}
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
