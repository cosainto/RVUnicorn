import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Database, Edit3, X, CheckCircle } from 'lucide-react';
import api from '../services/api';

interface Campground {
  id: string;
  name: string;
  location: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface CampgroundSelectorProps {
  selectedCampgroundId: string | null;
  manualLocation: string;
  onCampgroundSelect: (campgroundId: string | null, campgroundName: string, location: string) => void;
  onManualLocationChange: (location: string) => void;
}

export default function CampgroundSelector({
  selectedCampgroundId,
  manualLocation,
  onCampgroundSelect,
  onManualLocationChange,
}: CampgroundSelectorProps) {
  const [mode, setMode] = useState<'database' | 'manual'>(selectedCampgroundId ? 'database' : manualLocation ? 'manual' : 'database');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Campground[]>([]);
  const [selectedCampground, setSelectedCampground] = useState<Campground | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCampgroundId) {
      loadSelectedCampground(selectedCampgroundId);
    }
  }, [selectedCampgroundId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (mode === 'database' && searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        searchCampgrounds(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, mode]);

  const loadSelectedCampground = async (id: string) => {
    try {
      const { data } = await api.get(`/campgrounds/${id}`);
      setSelectedCampground(data);
      setMode('database');
    } catch (error) {
      console.error('Load campground error:', error);
    }
  };

  const searchCampgrounds = async (query: string) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(query)}&limit=10`);
      const campgrounds = data.campgrounds || data || [];
      setSearchResults(campgrounds);
      setShowResults(true);
    } catch (error) {
      console.error('Search campgrounds error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCampground = (campground: Campground) => {
    setSelectedCampground(campground);
    setSearchQuery('');
    setShowResults(false);
    onCampgroundSelect(campground.id, campground.name, campground.location);
  };

  const handleClearSelection = () => {
    setSelectedCampground(null);
    setSearchQuery('');
    onCampgroundSelect(null, '', '');
  };

  const handleModeSwitch = (newMode: 'database' | 'manual') => {
    setMode(newMode);
    if (newMode === 'manual') {
      setSelectedCampground(null);
      setSearchQuery('');
      onCampgroundSelect(null, '', manualLocation);
    } else {
      onManualLocationChange('');
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        📍 Campground / Location
      </label>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => handleModeSwitch('database')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${
            mode === 'database'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Database className="w-4 h-4" />
          Search Campgrounds
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('manual')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${
            mode === 'manual'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          Enter Manually
        </button>
      </div>

      {mode === 'database' ? (
        <div ref={searchRef} className="relative">
          {selectedCampground ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-gray-900">{selectedCampground.name}</p>
                  <p className="text-sm text-gray-600">{selectedCampground.location}{selectedCampground.state ? `, ${selectedCampground.state}` : ''}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearSelection}
                className="p-1 text-gray-400 hover:text-red-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  placeholder="Search 5,500+ campgrounds..."
                  className="input w-full pl-10 pr-10"
                />
                {loading && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                  </div>
                )}
              </div>

              {showResults && searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((campground) => (
                    <button
                      key={campground.id}
                      type="button"
                      onClick={() => handleSelectCampground(campground)}
                      className="w-full text-left px-4 py-3 hover:bg-primary-50 border-b border-gray-100 last:border-0 transition"
                    >
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-primary-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">{campground.name}</p>
                          <p className="text-sm text-gray-600">
                            {`${campground.city || campground.location || ''}${campground.state ? `, ${campground.state}` : ''}${campground.zipCode ? ` ${campground.zipCode}` : ''}`}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showResults && searchQuery.length >= 2 && searchResults.length === 0 && !loading && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                  <p className="text-gray-600 text-center">
                    No campgrounds found. Try different keywords or{' '}
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('manual')}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      enter manually
                    </button>
                  </p>
                </div>
              )}
            </>
          )}

          <p className="text-xs text-gray-500 mt-2">
            💡 Search our database of federal campgrounds from Recreation.gov
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={manualLocation}
            onChange={(e) => onManualLocationChange(e.target.value)}
            placeholder="Campground name and address..."
            className="input w-full"
          />
          <p className="text-xs text-gray-500">
            💡 Enter the campground name and location. This won't link to the travel map.
          </p>
        </div>
      )}
    </div>
  );
}
