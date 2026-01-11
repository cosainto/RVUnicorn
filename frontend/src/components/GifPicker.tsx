import { useState, useEffect } from 'react';
import { X, Search, Loader } from 'lucide-react';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

interface GifResult {
  id: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
    };
    fixed_width_small: {
      url: string;
    };
  };
  title: string;
}

// You can get a free API key at https://developers.giphy.com/
const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // Public beta key - replace with your own

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<GifResult[]>([]);

  // Load trending GIFs on mount
  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      setTrending(data.data || []);
      setGifs(data.data || []);
    } catch (error) {
      console.error('Load trending GIFs error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!search.trim()) {
      setGifs(trending);
      return;
    }

    const timer = setTimeout(() => {
      searchGifs(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, trending]);

  const searchGifs = async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Search GIFs error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (gif: GifResult) => {
    // Use the fixed_height version for good quality/size balance
    onSelect(gif.images.fixed_height.url);
    onClose();
  };

  // Camping-related quick search suggestions
  const quickSearches = ['camping', 'rv', 'road trip', 'nature', 'campfire', 'adventure', 'excited', 'happy', 'thank you'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-xl">🎬</span> Choose a GIF
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search GIFs..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              autoFocus
            />
          </div>
          
          {/* Quick searches */}
          <div className="flex flex-wrap gap-1 mt-2">
            {quickSearches.map(term => (
              <button
                key={term}
                onClick={() => setSearch(term)}
                className="px-2 py-0.5 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 rounded-full text-xs text-gray-600 transition"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* GIF Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : gifs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No GIFs found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {gifs.map(gif => (
                <button
                  key={gif.id}
                  onClick={() => handleSelect(gif)}
                  className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary-500 transition group"
                >
                  <img
                    src={gif.images.fixed_width_small.url}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GIPHY Attribution */}
        <div className="p-2 border-t border-gray-100 flex justify-center">
          <img
            src="https://giphy.com/static/img/poweredby_giphy.png"
            alt="Powered by GIPHY"
            className="h-4 opacity-50"
          />
        </div>
      </div>
    </div>
  );
}

// Compact GIF button for comment inputs
export function GifButton({ onSelect }: { onSelect: (gifUrl: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition"
        title="Add GIF"
      >
        <span className="text-lg">GIF</span>
      </button>

      {showPicker && (
        <GifPicker
          onSelect={onSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}
