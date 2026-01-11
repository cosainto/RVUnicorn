import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Map,
  MapPin,
  X,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';
import api from '../services/api';

interface Campground {
  id: string;
  name: string;
  slug: string;
  location: string;
  state: string;
}

export default function MapViewPage() {
  const { username } = useParams<{ username: string }>();

  const [visitedStates, setVisitedStates] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);

  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [stateCampgrounds, setStateCampgrounds] = useState<Campground[]>([]);
  const [loadingCampgrounds, setLoadingCampgrounds] = useState(false);

  useEffect(() => {
    loadVisitedStates();
  }, [username]);

  const loadVisitedStates = async () => {
    try {
      setLoadingStates(true);
      const { data } = await api.get(`/profile/${username}/states`);
      setVisitedStates(data.states || []);
    } catch (err) {
      console.error('Load visited states error:', err);
    } finally {
      setLoadingStates(false);
    }
  };

  const handleStateClick = async (stateCode: string) => {
    setSelectedState(stateCode);
    setLoadingCampgrounds(true);

    try {
      const { data } = await api.get(`/campgrounds?state=${stateCode}`);
      setStateCampgrounds(data.campgrounds || []);
    } catch (err) {
      console.error('Load state campgrounds error:', err);
      setStateCampgrounds([]);
    } finally {
      setLoadingCampgrounds(false);
    }
  };

  const closePanel = () => {
    setSelectedState(null);
    setStateCampgrounds([]);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to={`/profile/${username}`}
          className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Profile
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
          <Map className="w-6 h-6 sm:w-8 sm:h-8 mr-3 text-primary-600" />
          States Visited ({visitedStates.length}/50)
        </h1>
        <p className="text-gray-600 mt-2">
          Click on a green state to see campgrounds visited there
        </p>
      </div>

      {loadingStates ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-500" />
          <p className="text-gray-600 mt-4">Loading map...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
          <ComposableMap projection="geoAlbersUsa" className="w-full">
            <Geographies geography="https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json">
              {({ geographies }) =>
                geographies.map((geo) => {
                  const stateCode = geo.properties.postal;
                  const isVisited = visitedStates.includes(stateCode);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => isVisited && handleStateClick(stateCode)}
                      fill={isVisited ? '#059669' : '#E5E7EB'}
                      stroke="#9CA3AF"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: {
                          outline: 'none',
                          fill: isVisited ? '#047857' : '#E5E7EB',
                        },
                        pressed: { outline: 'none' },
                      }}
                      className={`${
                        isVisited
                          ? 'cursor-pointer'
                          : 'cursor-not-allowed'
                      }`}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          <div className="mt-4 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-primary-600 rounded"></div>
              <span className="text-gray-700">Visited ({visitedStates.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-300 rounded"></div>
              <span className="text-gray-700">Not Visited ({50 - visitedStates.length})</span>
            </div>
          </div>
        </div>
      )}

      {/* State Detail Panel */}
      {selectedState && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-primary-600" />
              Campgrounds in {selectedState}
            </h2>
            <button
              onClick={closePanel}
              className="text-gray-500 hover:text-gray-700 p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loadingCampgrounds ? (
            <div className="text-center py-10">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-500" />
              <p className="text-gray-600 mt-4">Loading campgrounds...</p>
            </div>
          ) : stateCampgrounds.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p>No campgrounds found in {selectedState}</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">
                Found {stateCampgrounds.length} campground{stateCampgrounds.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stateCampgrounds.map((campground) => (
                  <Link
                    key={campground.id}
                    to={`/campgrounds/${campground.slug}`}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition group"
                  >
                    <div className="h-32 bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                      <MapPin className="w-12 h-12 text-white opacity-50" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 truncate">
                        {campground.name}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">
                        {campground.location}, {campground.state}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
