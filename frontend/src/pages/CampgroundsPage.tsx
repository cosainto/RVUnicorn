
const stripHtml = (html: string | null) => html?.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&") || "";
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Star, Plus, Phone, Globe, Navigation } from 'lucide-react';
import SuggestCampground from '../components/SuggestCampground';

interface Campground {
  id: string;
  name: string;
  slug: string;
  location: string;
  state: string | null;
  description: string;
  latitude: number | null;
  longitude: number | null;
  amenities: string[];
  imageUrl: string | null;
  phone: string | null;
  website: string | null;
  _count?: {
    reviews: number;
  };
}

const AMENITY_ICONS: Record<string, string> = {
  WIFI: '📶',
  SHOWERS: '🚿',
  RESTROOMS: '🚻',
  ELECTRIC_HOOKUPS: '⚡',
  WATER_HOOKUPS: '💧',
  SEWER_HOOKUPS: '🚰',
  DUMP_STATION: '♻️',
  LAUNDRY: '👕',
  CAMP_STORE: '🏪',
  RESTAURANT: '🍽️',
  PLAYGROUND: '🎪',
  POOL: '🏊',
  BEACH: '🏖️',
  BOAT_LAUNCH: '⛵',
  FISHING: '🎣',
  TRAILS: '🥾',
  CAMPING: '⛺',
};

export default function CampgroundsPage() {
  const [campgrounds, setCampgrounds] = useState<Campground[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchCampgrounds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (stateFilter) params.append('state', stateFilter);
      params.append('page', currentPage.toString());
      params.append('limit', '50');

      const res = await fetch(`/api/campgrounds?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch campgrounds');

      const data = await res.json();
      setCampgrounds(data.campgrounds ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
      setCampgrounds([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, stateFilter, currentPage]);

  useEffect(() => {
    fetchCampgrounds();
  }, [fetchCampgrounds]);

  const availableStates = useMemo(
    () => Array.from(new Set(campgrounds.map(c => c.state).filter(Boolean))).sort(),
    [campgrounds]
  );

  const getAmenityIcon = (amenity: string) => AMENITY_ICONS[amenity] ?? '✓';

  if (loading && campgrounds.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        <p className="mt-4 text-gray-600">Loading campgrounds...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover Campgrounds</h1>
        <p className="text-gray-600">Find your perfect camping destination</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              className="input pl-10 w-full"
              placeholder="Search campgrounds..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              className="input pl-10 w-full"
              value={stateFilter}
              onChange={e => {
                setStateFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All States</option>
              {availableStates.map(state => (
                <option key={state!} value={state!}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-secondary flex items-center justify-center gap-2"
            onClick={() => setShowSuggestModal(true)}
          >
            <Plus className="w-5 h-5" />
            Suggest Campground
          </button>
        </div>

        <p className="mt-4 text-sm text-gray-600">
          Found {total} campground{total !== 1 && 's'} (Page {currentPage} of {totalPages})
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campgrounds.map(c => (
          <Link
            key={c.id}
            to={`/campgrounds/${c.id}`}            
            className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden block"
          >
            <div className="relative h-48 bg-gradient-to-br from-primary-100 to-secondary-100">
              {c.imageUrl ? (
                <img src={c.imageUrl.startsWith("http") ? c.imageUrl : `${c.imageUrl}`} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <MapPin className="w-16 h-16 text-primary-300" />
                </div>
              )}
              {c.state && (
                <span className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full text-sm font-medium">
                  {c.state}
                </span>
              )}
            </div>

            <div className="p-6">
              <h3 className="text-xl font-bold mb-2 line-clamp-2">{c.name}</h3>

              <p className="text-sm text-gray-600 mb-3 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {c.location}
              </p>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{stripHtml(c.description)}</p>

              {c.amenities && c.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {c.amenities.slice(0, 6).map(a => (
                    <span
                      key={a}
                      title={a.replace(/_/g, ' ').toLowerCase()}
                      className="text-xs bg-gray-100 px-2 py-1 rounded"
                    >
                      {getAmenityIcon(a)}
                    </span>
                  ))}
                  {c.amenities.length > 6 && (
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      +{c.amenities.length - 6} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-4">
                {c.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Call
                  </span>
                )}
                {c.website && (
                  <span className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    Website
                  </span>
                )}
                {c.latitude !== null && c.longitude !== null && (
                  <span className="flex items-center gap-1">
                    <Navigation className="w-4 h-4" />
                    Directions
                  </span>
                )}
              </div>

              <div className="pt-4 border-t flex items-center gap-2 text-sm">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                {c._count?.reviews ?? 0} reviews
              </div>
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}

      {showSuggestModal && (
        <SuggestCampground
          onClose={() => setShowSuggestModal(false)}
          onSubmit={() => {
            setShowSuggestModal(false);
            fetchCampgrounds();
          }}
        />
      )}
    </div>
  );
}
