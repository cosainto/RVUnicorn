import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Award, Calendar, X, Plus, Trash2, Users, Image, Edit2, Heart, Navigation, Tent,
  Eye, EyeOff, UserCheck, Lock, Copy, ExternalLink,
  Fuel, Coffee, ParkingCircle, Layers, DollarSign, Route,
  ShowerHead, Store, Truck, Dog, Wifi, Droplet, RefreshCw, Send
} from 'lucide-react';
import api from '../services/api';
import USMapSVG from './USMapSVG';
import interstateRoutes, { InterstateRoute } from '../data/interstateRoutes';

interface TravelMapProps {
  compact?: boolean;
  showTripFilter?: boolean;
  userId: string;
  isOwnProfile: boolean;
  profilePicture?: string;
  initialRoute?: any;       // pre-built route (skips active-route fetch)
  newStateHighlights?: string[]; // state codes to highlight as "new"
}

interface StateVisit {
  id: string;
  state: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  campsiteId?: string;
  eventId?: string;
  visibility?: string;
  campsite?: {
    id: string;
    name: string;
    slug?: string;
    location: string;
    state: string;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
  };
  event?: {
    id: string;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    location?: string;
    organizer?: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      profilePicture?: string;
    };
  };
  albums?: {
    id: string;
    title: string;
    coverPhotoId?: string;
    createdAt: string;
    photos: {
      imageUrl: string;
    }[];
    _count: {
      photos: number;
    };
  }[];
  attendees?: {
    id: string;
    user: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      profilePicture?: string;
    };
  }[];
}

interface Flair {
  id: string;
  campsiteId: string;
  state: string;
  earnedAt: string;
  campsite: {
    id: string;
    name: string;
    slug: string;
    location: string;
    state: string;
    imageUrl?: string;
  };
}

interface Friend {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

interface Album {
  id: string;
  title: string;
  _count: {
    photos: number;
  };
}

interface Event {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
}

interface GasPrice {
  stateCode: string;
  stateName: string;
  regularPrice: number;
  dieselPrice: number;
  updatedAt: string;
}

interface GasStation {
  id: string;
  name: string;
  brand: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  interstate?: string;
  exitNumber?: string;
  hasDiesel: boolean;
  hasTruckParking: boolean;
  hasRVParking: boolean;
  hasRestrooms: boolean;
  hasShowers: boolean;
  hasRestaurant: boolean;
  hasStore: boolean;
  hasPropane: boolean;
  hasDumpStation: boolean;
}

interface RestStop {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  interstate: string;
  direction?: string;
  mileMarker?: number;
  hasRestrooms: boolean;
  hasPicnicArea: boolean;
  hasPetArea: boolean;
  hasVending: boolean;
  hasWifi: boolean;
  hasRVParking: boolean;
  hasDumpStation: boolean;
  hasWater: boolean;
  is24Hours: boolean;
  notes?: string;
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: Eye, color: 'text-green-600', bg: 'bg-green-50', description: 'Anyone can see' },
  { value: 'FRIENDS', label: 'Friends Only', icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50', description: 'Only friends can see' },
  { value: 'PRIVATE', label: 'Private', icon: Lock, color: 'text-gray-600', bg: 'bg-gray-100', description: 'Only you can see' },
];

type MapLayer = 'visits' | 'gasPrices' | 'gasStations' | 'restStops' | 'highways' | 'favorites' | 'upcomingTrips' | 'friendsCheckins' | 'freeOvernight';

// Gas thresholds (national avg ~$3.30)
const getGasPriceColor = (price: number): string => {
  if (price < 2.90) return '#22c55e';
  if (price < 3.10) return '#84cc16';
  if (price < 3.30) return '#eab308';
  if (price < 3.50) return '#f97316';
  if (price < 3.80) return '#ef4444';
  return '#dc2626';
};

// Diesel thresholds (national avg ~$3.80, runs ~$0.50 higher than gas)
const getDieselPriceColor = (price: number): string => {
  if (price < 3.40) return '#22c55e';
  if (price < 3.60) return '#84cc16';
  if (price < 3.80) return '#eab308';
  if (price < 4.10) return '#f97316';
  if (price < 4.50) return '#ef4444';
  return '#dc2626';
};

const getFuelPriceColor = (price: number, fuelType: 'regular' | 'diesel'): string => {
  return fuelType === 'diesel' ? getDieselPriceColor(price) : getGasPriceColor(price);
};

export default function TravelMap({ userId, isOwnProfile, compact = false, showTripFilter = false, profilePicture, initialRoute, newStateHighlights = [] }: TravelMapProps) {
  // Original state
  const [visitedStates, setVisitedStates] = useState<string[]>([]);
  const [plannedStates, setPlannedStates] = useState<string[]>([]);
  const [stateVisits, setStateVisits] = useState<StateVisit[]>([]);
  const [flair, setFlair] = useState<Flair[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState<StateVisit | null>(null);
  const [campgrounds, setCampgrounds] = useState<any[]>([]);
  const [loadingCampgrounds, setLoadingCampgrounds] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isFriend, setIsFriend] = useState(true);
  const [copyingTrip, setCopyingTrip] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Basecamp map state - favorites, trips, friends' check-ins
  const [favorites, setFavorites] = useState<any[]>([]);
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [activeRoute, setActiveRoute] = useState<any>(null);
  const [friendsCheckins, setFriendsCheckins] = useState<any[]>([]);
  
  // Home location state
  const [homeLocation, setHomeLocation] = useState<{
    latitude: number;
    longitude: number;
    city: string;
    state: string;
  } | null>(null);
  const [isCurrentlyCamping, setIsCurrentlyCamping] = useState(false);

  // Roadtrip state
  const [activeLayers, setActiveLayers] = useState<MapLayer[]>(['visits', 'friendsCheckins']);
  const [gasPrices, setGasPrices] = useState<GasPrice[]>([]);
  const [gasStations, setGasStations] = useState<GasStation[]>([]);
  const [restStops, setRestStops] = useState<RestStop[]>([]);
  const [freeOvernightSpots, setFreeOvernightSpots] = useState<any[]>([]);
  const [selectedGasStation, setSelectedGasStation] = useState<GasStation | null>(null);
  const [selectedRestStop, setSelectedRestStop] = useState<RestStop | null>(null);
  const [selectedInterstate, setSelectedInterstate] = useState<string>('');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [selectedTripRoute, setSelectedTripRoute] = useState<any>(null);
  const [loadingTripRoute, setLoadingTripRoute] = useState(false);
  const [loadingRoadtrip, setLoadingRoadtrip] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [stateDetail, setStateDetail] = useState<any>(null);
  const [stateDetailLoading, setStateDetailLoading] = useState(false);
  const [stateDetailError, setStateDetailError] = useState<string | null>(null);
  const [shoutoutTarget, setShoutoutTarget] = useState<{ user: any; campgroundId?: string; campgroundName?: string } | null>(null);
  const [shoutoutMsg, setShoutoutMsg] = useState('');
  const [shoutoutSending, setShoutoutSending] = useState(false);
  const [shoutoutSent, setShoutoutSent] = useState(false);
  const [fuelType, setFuelType] = useState<'regular' | 'diesel'>('diesel');
  const [updatingPrices, setUpdatingPrices] = useState(true);
  const [priceStats, setPriceStats] = useState<any>(null);

  const [visitForm, setVisitForm] = useState({
    state: '',
    startDate: '',
    endDate: '',
    notes: '',
    campsiteId: '',
    eventId: '',
    attendeeIds: [] as string[],
    albumIds: [] as string[],
    visibility: 'PUBLIC',
  });

  useEffect(() => {
    loadTravelMap();
    loadHomeLocation();
    loadUpcomingTrips(); // load on mount so trip filter dropdown is always populated
    if (isOwnProfile) {
      loadFriends();
      loadAlbums();
      loadEvents();
    }
  }, [userId]);

  // Sync initialRoute prop -> activeRoute state whenever it arrives
  useEffect(() => {
    if (initialRoute) setActiveRoute(initialRoute);
  }, [initialRoute]);

  useEffect(() => {
    if (activeLayers.includes('gasPrices') && gasPrices.length === 0) {
      loadGasPrices();
    }
    if (activeLayers.includes('favorites') && favorites.length === 0) {
      loadFavorites();
    }
    // Use provided route or fetch active route
    if (initialRoute) {
      setActiveRoute(initialRoute);
    } else {
      api.get(`/trips/active-route/${userId}`)
        .then(r => { if (r.data?.route) setActiveRoute(r.data.route); })
        .catch(() => {});
    }

    if (activeLayers.includes('upcomingTrips') && upcomingTrips.length === 0) {
      loadUpcomingTrips();
    }
    if (activeLayers.includes('friendsCheckins') && friendsCheckins.length === 0) {
      loadFriendsCheckins();
    }
  }, [activeLayers, selectedInterstate]);

  useEffect(() => {
    if (activeLayers.includes('freeOvernight') && freeOvernightSpots.length === 0) {
      api.get('/overnight-spots/near?lat=39.5&lng=-98.35&radius=2000&limit=300')
        .then(({ data }) => setFreeOvernightSpots(data || []))
        .catch(() => {});
    }
    if (activeLayers.includes('gasStations') || activeLayers.includes('restStops')) {
      loadRoadtripResources();
    }
  }, [selectedInterstate, selectedTripRoute, activeLayers]);

  const loadFavorites = async () => {
    try {
      const { data } = await api.get(`/drive-planner/users/${userId}/favorites`);
      setFavorites(data.favorites || data || []);
    } catch (error) {
      console.error('Load favorites error:', error);
    }
  };

  const loadUpcomingTrips = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Load both single events AND road trips in parallel
      const [eventsRes, roadTripsRes] = await Promise.all([
        api.get('/trips/my').catch(() => ({ data: [] })),
        api.get('/road-trips').catch(() => ({ data: [] })),
      ]);

      const events = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      const upcoming = events
        .filter((e: any) => {
          if (e.isWishlist) return false;
          const startDate = new Date(e.startDate);
          startDate.setHours(0, 0, 0, 0);
          return startDate >= today;
        })
        .map((e: any) => ({
          id: e.id,
          name: e.title,
          title: e.title,
          startDate: e.startDate,
          endDate: e.endDate,
          campground: e.campground,
          type: 'event',
        }));

      const roadTrips = (Array.isArray(roadTripsRes.data) ? roadTripsRes.data : [])
        .filter((rt: any) => rt.stops?.length >= 2)
        .map((rt: any) => ({
          id: rt.id,
          name: '🚐 ' + rt.title,
          title: rt.title,
          startDate: rt.stops?.[0]?.startDate || null,
          type: 'roadtrip',
        }));

      setUpcomingTrips([...roadTrips, ...upcoming]);
    } catch (error) {
      console.error('Load upcoming trips error:', error);
    }
  };

  const loadFriendsCheckins = async () => {
    try {
      const { data } = await api.get(`/drive-planner/users/${userId}/friends/checkins?limit=50`);
      setFriendsCheckins(data.checkIns || data || []);
    } catch (error) {
      console.error('Load friends checkins error:', error);
    }
  };

  const loadTravelMap = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/travel-map/${userId}`);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const visits = data.stateVisits || [];
      const visited = new Set<string>();
      const planned = new Set<string>();
      
      visits.forEach((visit: StateVisit) => {
        const startDate = new Date(visit.startDate);
        startDate.setHours(0, 0, 0, 0);
        if (startDate <= today) {
          visited.add(visit.state);
        } else {
          planned.add(visit.state);
        }
      });
      
      setVisitedStates(Array.from(visited));
      setPlannedStates(Array.from(planned));
      setStateVisits(visits);
      setFlair(data.flair || []);
      setIsFriend(data.isFriend || false);
    } catch (error) {
      console.error('Load travel map error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHomeLocation = async () => {
    try {
      const { data } = await api.get(`/profile/${userId}/home-location`);
      if (data && data.homeLatitude && data.homeLongitude) {
        setHomeLocation({
          latitude: data.homeLatitude,
          longitude: data.homeLongitude,
          city: data.homeCity || '',
          state: data.homeState || '',
        });
      }
      
      // Check if currently on a trip
      const today = new Date();
      const activeTrip = stateVisits.find(visit => {
        const start = new Date(visit.startDate);
        const end = visit.endDate ? new Date(visit.endDate) : start;
        return start <= today && today <= end;
      });
      setIsCurrentlyCamping(!!activeTrip);
    } catch (error) {
      // Home location not set or not visible
    }
  };

  const loadGasPrices = async () => {
    try {
      const { data } = await api.get('/roadtrip/gas-prices');
      setGasPrices(data || []);
      
      // Also get stats
      try {
        const statsRes = await api.get('/gas-prices/current');
        setPriceStats(statsRes.data);
      } catch (e) {
        // Stats endpoint may not exist yet
      }
    } catch (error) {
      console.error('Load gas prices error:', error);
    }
  };

  const updateGasPrices = async () => {
    setUpdatingPrices(true);
    try {
      await api.get('/gas-prices/update');
      await loadGasPrices();
    } catch (error) {
      console.error('Update gas prices error:', error);
    } finally {
      setUpdatingPrices(false);
    }
  };

  const loadRoadtripResources = async () => {
    try {
      setLoadingRoadtrip(true);
      // If a trip is selected, filter stops to bounding box of that trip's route
      let params = '';
      if (selectedTripRoute?.allStops?.length >= 2) {
        const lats = selectedTripRoute.allStops.map((s: any) => s.latitude).filter(Boolean);
        const lngs = selectedTripRoute.allStops.map((s: any) => s.longitude).filter(Boolean);
        const minLat = Math.min(...lats) - 1;
        const maxLat = Math.max(...lats) + 1;
        const minLng = Math.min(...lngs) - 1;
        const maxLng = Math.max(...lngs) + 1;
        params = `?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}`;
      } else if (selectedInterstate) {
        params = `?interstate=${encodeURIComponent(selectedInterstate)}`;
      }
      const [stationsRes, stopsRes] = await Promise.all([
        activeLayers.includes('gasStations') ? api.get(`/roadtrip/gas-stations${params}`) : Promise.resolve({ data: gasStations }),
        activeLayers.includes('restStops') ? api.get(`/roadtrip/rest-stops${params}`) : Promise.resolve({ data: restStops }),
      ]);
      if (activeLayers.includes('gasStations')) setGasStations(stationsRes.data || []);
      if (activeLayers.includes('restStops')) setRestStops(stopsRes.data || []);
    } catch (error) {
      console.error('Load roadtrip resources error:', error);
    } finally {
      setLoadingRoadtrip(false);
    }
  };

  const handleTripSelect = async (tripId: string) => {
    setSelectedTripId(tripId);
    if (!tripId) {
      setSelectedTripRoute(null);
      setActiveRoute(initialRoute || null);
      return;
    }
    setLoadingTripRoute(true);
    const selectedTrip = upcomingTrips.find((t: any) => t.id === tripId);
    try {
      let route = null;
      if (selectedTrip?.type === 'roadtrip') {
        const { data } = await api.get(`/road-trips/${tripId}/map-route`);
        if (data.route) route = data.route;
      } else if (selectedTrip?.campground?.latitude) {
        // Single event with campground — can't draw a route, just mark on map
        route = {
          eventName: selectedTrip.name,
          allStops: [{ id: selectedTrip.id, name: selectedTrip.name, latitude: selectedTrip.campground.latitude, longitude: selectedTrip.campground.longitude, order: 0 }],
          completedCoords: [],
          upcomingCoords: [],
          currentPosition: { latitude: selectedTrip.campground.latitude, longitude: selectedTrip.campground.longitude, name: selectedTrip.name },
        };
      }

      if (route) {
        // For future trips, all coords go in upcomingCoords so the dashed line shows
        // USMapSVG needs at least 2 points to draw a line
        const allCoords = route.allStops
          ?.filter((s: any) => s.latitude && s.longitude)
          .map((s: any) => [s.longitude, s.latitude] as [number, number]) || [];

        const fixedRoute = {
          ...route,
          completedCoords: route.completedCoords?.length >= 2 ? route.completedCoords : [],
          upcomingCoords: allCoords.length >= 2 ? allCoords : (route.upcomingCoords || []),
        };

        setSelectedTripRoute(fixedRoute);
        setActiveRoute(fixedRoute);

        // Immediately load stops filtered to this route's bounding box
        if (activeLayers.includes('gasStations') || activeLayers.includes('restStops')) {
          const lats = fixedRoute.allStops?.map((s: any) => s.latitude).filter(Boolean) || [];
          const lngs = fixedRoute.allStops?.map((s: any) => s.longitude).filter(Boolean) || [];
          if (lats.length >= 2) {
            const params = `?minLat=${Math.min(...lats) - 1}&maxLat=${Math.max(...lats) + 1}&minLng=${Math.min(...lngs) - 1}&maxLng=${Math.max(...lngs) + 1}`;
            const [stationsRes, stopsRes] = await Promise.all([
              activeLayers.includes('gasStations') ? api.get(`/roadtrip/gas-stations${params}`) : Promise.resolve({ data: [] }),
              activeLayers.includes('restStops') ? api.get(`/roadtrip/rest-stops${params}`) : Promise.resolve({ data: [] }),
            ]);
            if (activeLayers.includes('gasStations')) setGasStations(stationsRes.data || []);
            if (activeLayers.includes('restStops')) setRestStops(stopsRes.data || []);
          }
        }
      }
    } catch (e) {
      console.error('Trip route fetch failed:', e);
    }
    setLoadingTripRoute(false);
  };

  const loadCampgrounds = async (stateCode: string) => {
    try {
      setLoadingCampgrounds(true);
      const { data } = await api.get(`/campgrounds?state=${encodeURIComponent(stateCode)}&limit=500`);
      setCampgrounds(Array.isArray(data) ? data : (data.campgrounds || []));
    } catch (error) {
      console.error('Load campgrounds error:', error);
      setCampgrounds([]);
    } finally {
      setLoadingCampgrounds(false);
    }
  };

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  const loadAlbums = async () => {
    try {
      const { data } = await api.get(`/photo-albums?userId=${userId}`);
      setAlbums(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load albums error:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const { data } = await api.get('/events');
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load events error:', error);
    }
  };

  const toggleLayer = (layer: MapLayer) => {
    setActiveLayers(prev => 
      prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer]
    );
  };

  const handleStateClick = async (stateCode: string) => {
    if (activeLayers.includes('gasPrices')) {
      const price = gasPrices.find(p => p.stateCode === stateCode);
      if (price) {
        setSelectedState(stateCode);
        return;
      }
    }
    setSelectedState(stateCode);
    setStateDetail(null);
    setStateDetailError(null);

    // Fetch detailed drill-down for visited states
    if (visitedStates.includes(stateCode) || plannedStates.includes(stateCode)) {
      setStateDetailLoading(true);
      try {
        const { data } = await api.get(`/travel-map/${userId}/state/${stateCode}`);
        setStateDetail(data);
      } catch (e: any) {
        const errMsg = e.response?.data?.message || e.response?.data?.error;
        if (e.response?.status === 403) {
          setStateDetailError(errMsg || "This user's travel map is private");
        }
      } finally { setStateDetailLoading(false); }
    }
  };

  const handleAddVisit = () => {
    if (!selectedState) return;
    setEditingVisit(null);
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);
    setVisitForm({
      state: selectedState,
      startDate: startDate,
      endDate: endDate.toISOString().split('T')[0],
      notes: '',
      campsiteId: '',
      eventId: '',
      attendeeIds: [],
      albumIds: [],
      visibility: 'PUBLIC',
    });
    loadCampgrounds(selectedState);
    setShowAddVisitModal(true);
  };

  const handleCopyTrip = async (visit: StateVisit) => {
    if (copyingTrip) return;
    setCopyingTrip(visit.id);
    try {
      await api.post(`/travel-map/visits/${visit.id}/copy`);
      alert('🎉 Trip copied to your Travel Map!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to copy trip');
    } finally {
      setCopyingTrip(null);
    }
  };

  const handleSubmitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVisit) {
        await api.put(`/travel-map/visits/${editingVisit.id}`, visitForm);
      } else {
        await api.post('/travel-map/visits', visitForm);
      }
      setShowAddVisitModal(false);
      setEditingVisit(null);
      setVisitForm({ state: '', startDate: '', endDate: '', notes: '', campsiteId: '', eventId: '', attendeeIds: [], albumIds: [], visibility: 'PUBLIC' });
      await loadTravelMap();
    } catch (error) {
      console.error('Save visit error:', error);
      alert('Failed to save visit');
    }
  };

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm('Delete this visit?')) return;
    try {
      await api.delete(`/travel-map/visits/${visitId}`);
      await loadTravelMap();
    } catch (error) {
      console.error('Delete visit error:', error);
    }
  };

  const getStateVisits = (stateCode: string) => stateVisits.filter(v => v.state === stateCode);

  const formatDateRange = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const startStr = start.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!endDate) return startStr;
    const end = new Date(endDate);
    return `${startStr} - ${end.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  };

  const isPlannedVisit = (startDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visitDate = new Date(startDate);
    visitDate.setHours(0, 0, 0, 0);
    return visitDate > today;
  };

  const getGasPriceColors = (): Record<string, string> => {
    const colors: Record<string, string> = {};
    gasPrices.forEach(price => {
      const priceValue = fuelType === 'diesel' ? price.dieselPrice : price.regularPrice;
      colors[price.stateCode] = getFuelPriceColor(priceValue, fuelType);
    });
    return colors;
  };

  const getStateColors = (): Record<string, string> | undefined => {
    if (activeLayers.includes('gasPrices')) return getGasPriceColors();
    // Highlight new (never-visited) states on the trip route in teal
    if (newStateHighlights.length > 0) {
      const colors: Record<string, string> = {};
      newStateHighlights.forEach(s => { colors[s] = '#93c5fd'; }); // planned blue — matches map legend
      return colors;
    }
    return undefined;
  };

  // Get highways to display
  const getDisplayHighways = () => {
    if (selectedInterstate && (activeLayers.includes('gasStations') || activeLayers.includes('restStops'))) {
      return interstateRoutes.filter(r => r.id === selectedInterstate);
    }
    return interstateRoutes;
  };

  // Build map markers
  const mapMarkers = [
    ...(activeLayers.includes('visits') ? stateVisits
      .filter(v => v.campsite?.latitude && v.campsite?.longitude)
      .map(v => ({
        id: `visit-${v.id}`,
        name: v.campsite!.name,
        latitude: v.campsite!.latitude!,
        longitude: v.campsite!.longitude!,
        type: "campground" as const,
        isVisited: !isPlannedVisit(v.startDate),
      })) : []),
    ...(activeLayers.includes('gasStations') ? gasStations
      .filter(s => {
        const lat = Number(s.latitude);
        const lng = Number(s.longitude);
        return s.latitude && s.longitude && !isNaN(lat) && !isNaN(lng)
          && lat >= 18 && lat <= 72 && lng >= -180 && lng <= -60;
      })
      .map(s => ({
        id: `gas-${s.id}`,
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        type: "gasStation" as const,
        brand: s.brand,
      })) : []),
    ...(activeLayers.includes('restStops') ? restStops
      .filter(s => {
        const lat = Number(s.latitude);
        const lng = Number(s.longitude);
        return s.latitude && s.longitude && !isNaN(lat) && !isNaN(lng)
          && lat >= 18 && lat <= 72 && lng >= -180 && lng <= -60;
      })
      .map(s => ({
        id: `rest-${s.id}`,
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        type: "restStop" as const,
      })) : []),
    ...(activeLayers.includes('freeOvernight') ? freeOvernightSpots
      .filter(s => s.latitude && s.longitude
        && s.latitude >= 18 && s.latitude <= 72
        && s.longitude >= -180 && s.longitude <= -60)
      .map(s => ({
        id: `free-${s.id}`,
        name: s.name,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        type: "freeOvernight" as const,
        category: s.category,
        notes: s.notes,
      })) : []),
    // Favorites markers
    ...(activeLayers.includes('favorites') ? favorites
      .filter(f => f.latitude && f.longitude)
      .map(f => ({
        id: `fav-${f.id}`,
        name: f.name,
        latitude: f.latitude,
        longitude: f.longitude,
        type: "favorite" as const,
      })) : []),
    // Upcoming trips markers
    ...(activeLayers.includes('upcomingTrips') ? upcomingTrips
      .filter(t => t.campground?.latitude && t.campground?.longitude)
      .map(t => ({
        id: `trip-${t.id}`,
        name: `${t.name || t.title} at ${t.campground.name}`,
        latitude: t.campground.latitude,
        longitude: t.campground.longitude,
        type: "upcomingTrip" as const,
        tripId: t.id,
      })) : []),
    // Friends' check-ins markers
    ...(activeLayers.includes('friendsCheckins') ? friendsCheckins
      .filter(c => c.campground?.latitude && c.campground?.longitude)
      .map(c => ({
        id: `checkin-${c.id}`,
        name: `${c.user?.firstName || "Friend"} at ${c.campground.name}`,
        latitude: c.campground.latitude,
        longitude: c.campground.longitude,
        type: "friendCheckin" as const,
        user: c.user,
      })) : []),
    // Home location marker
    ...(homeLocation ? [{
      id: 'home-location',
      name: `Home: ${homeLocation.city}, ${homeLocation.state}`,
      latitude: homeLocation.latitude,
      longitude: homeLocation.longitude,
      type: "home" as const,
      isCurrentlyCamping: isCurrentlyCamping,
    }] : []),
  ];

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading travel map...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {visitedStates.length} {visitedStates.length === 1 ? 'State' : 'States'} Visited
            {plannedStates.length > 0 && ` • ${plannedStates.length} Planned`}
          </h3>
          <p className="text-sm text-gray-600">
            {isOwnProfile ? 'Click a state to view or add visits' : 'Click a state to view trips'}
          </p>
        </div>
        
      </div>

      {/* Layer Control Panel */}
      {showLayerPanel && !compact && (
        <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Map Layers
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <button
              onClick={() => toggleLayer('visits')}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                activeLayers.includes('visits') ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <MapPin className="w-6 h-6" />
              <span className="text-sm font-medium">My Visits</span>
            </button>

            <button
              onClick={() => toggleLayer('gasPrices')}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                activeLayers.includes('gasPrices') ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-6 h-6" />
              <span className="text-sm font-medium">Gas Prices</span>
            </button>

            <button
              onClick={() => toggleLayer('highways')}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                activeLayers.includes('highways') ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Route className="w-6 h-6" />
              <span className="text-sm font-medium">Highways</span>
            </button>

            <button
              onClick={() => toggleLayer('gasStations')}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                activeLayers.includes('gasStations') ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Fuel className="w-6 h-6" />
              <span className="text-sm font-medium">Truck Stops</span>
            </button>

            <button
              onClick={() => toggleLayer('restStops')}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                activeLayers.includes('restStops') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Coffee className="w-6 h-6" />
              <span className="text-sm font-medium">Rest Stops</span>
            </button>

            <button
              onClick={() => toggleLayer('favorites')}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                activeLayers.includes('favorites') ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Heart className="w-6 h-6" />
              <span className="text-sm font-medium">Favorites</span>
            </button>

            <button
              onClick={() => toggleLayer('upcomingTrips')}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                activeLayers.includes('upcomingTrips') ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Tent className="w-6 h-6" />
              <span className="text-sm font-medium">Upcoming Trips</span>
            </button>

            <button
              onClick={() => toggleLayer('freeOvernight')}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                activeLayers.includes('freeOvernight') ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl leading-none">🌙</span>
              <span className="text-sm font-medium">Free Overnight</span>
            </button>

            <button
              onClick={() => toggleLayer('friendsCheckins')}
              className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                activeLayers.includes('friendsCheckins') ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Users className="w-6 h-6" />
              <span className="text-sm font-medium">Friends</span>
            </button>
          </div>

          {/* Gas Price Options */}
          {activeLayers.includes('gasPrices') && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Fuel Type:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFuelType('regular')}
                      className={`px-3 py-1 rounded-full text-sm ${fuelType === 'regular' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Regular
                    </button>
                    <button
                      onClick={() => setFuelType('diesel')}
                      className={`px-3 py-1 rounded-full text-sm ${fuelType === 'diesel' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Diesel
                    </button>
                  </div>
                </div>
                <button
                  onClick={updateGasPrices}
                  disabled={updatingPrices}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${updatingPrices ? 'animate-spin' : ''}`} />
                  Update Prices
                </button>
              </div>
              
              {/* Price Legend — thresholds differ for gas vs diesel */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-600">{fuelType === 'diesel' ? 'Diesel' : 'Gas'} Price:</span>
                {fuelType === 'diesel' ? (
                  <>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div><span>&lt;$3.40</span></div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#84cc16' }}></div><span>$3.40-3.60</span></div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }}></div><span>$3.60-3.80</span></div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div><span>$3.80-4.10</span></div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div><span>&gt;$4.10</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div><span>&lt;$2.90</span></div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#84cc16' }}></div><span>$2.90-3.10</span></div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }}></div><span>$3.10-3.30</span></div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div><span>$3.30-3.50</span></div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div><span>&gt;$3.50</span></div>
                  </>
                )}
              </div>

              {/* Price Stats */}
              {priceStats && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-green-50 p-2 rounded">
                    <span className="text-gray-600">Cheapest {fuelType}:</span>
                    <p className="font-bold text-green-700">
                      {fuelType === 'diesel' ? priceStats.cheapest.diesel?.stateName : priceStats.cheapest.regular?.stateName} - $
                      {fuelType === 'diesel' ? priceStats.cheapest.diesel?.dieselPrice?.toFixed(2) || "N/A" : priceStats.cheapest.regular?.regularPrice?.toFixed(2) || "N/A"}
                    </p>
                  </div>
                  <div className="bg-red-50 p-2 rounded">
                    <span className="text-gray-600">Most Expensive:</span>
                    <p className="font-bold text-red-700">
                      {fuelType === 'diesel' ? priceStats.mostExpensive.diesel?.stateName : priceStats.mostExpensive.regular?.stateName} - $
                      {fuelType === 'diesel' ? priceStats.mostExpensive.diesel?.dieselPrice?.toFixed(2) || "N/A" : priceStats.mostExpensive.regular?.regularPrice?.toFixed(2) || "N/A"}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded col-span-2">
                    <span className="text-gray-600">National Average:</span>
                    <p className="font-bold text-blue-700">
                      ${fuelType === 'diesel' ? priceStats.nationalAverage.diesel?.toFixed(2) || "N/A" : priceStats.nationalAverage.regular?.toFixed(2) || "N/A"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trip Route Filter - only on full Travel Map page */}
          {showTripFilter && (activeLayers.includes('gasStations') || activeLayers.includes('restStops') || activeLayers.includes('highways')) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-start gap-3 flex-col">
                <div className="flex items-center gap-3 flex-wrap w-full">
                  <span className="text-sm font-medium text-gray-700 flex-shrink-0">🗺️ Filter by Trip:</span>
                  <select
                    value={selectedTripId}
                    onChange={(e) => handleTripSelect(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white min-w-0"
                  >
                    <option value="">— Show all stops —</option>
                    {upcomingTrips.map((trip: any) => (
                      <option key={trip.id} value={trip.id}>
                        🏕️ {trip.name || trip.title}
                        {trip.startDate ? ` · ${new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                      </option>
                    ))}
                  </select>
                  {(loadingRoadtrip || loadingTripRoute) && (
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  )}
                </div>
                {selectedTripRoute && (
                  <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg w-full">
                    ✓ Showing fuel stops, rest areas, and truck stops along your route corridor
                    {selectedTripRoute.eventName && <span className="font-semibold"> for {selectedTripRoute.eventName}</span>}
                  </p>
                )}
                {!selectedTripId && (
                  <p className="text-xs text-gray-400">
                    Select a trip to filter stops along your route, or browse all stops on the map.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        {activeLayers.includes('visits') && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500"></div>
              <span className="text-gray-600">Visited</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-300"></div>
              <span className="text-gray-600">Planned</span>
            </div>
          </>
        )}
        {activeLayers.includes('gasStations') && (
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-orange-500" />
            <span className="text-gray-600">Truck Stops ({gasStations.length})</span>
          </div>
        )}
        {activeLayers.includes('restStops') && (
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600">Rest Stops ({restStops.length})</span>
          </div>
        )}
        {activeLayers.includes('favorites') && (
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            <span className="text-gray-600">Favorites ({favorites.length})</span>
          </div>
        )}
        {activeLayers.includes('upcomingTrips') && (
          <div className="flex items-center gap-2">
            <Tent className="w-4 h-4 text-indigo-500" />
            <span className="text-gray-600">Upcoming ({upcomingTrips.length})</span>
          </div>
        )}
        {activeLayers.includes('friendsCheckins') && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <span className="text-gray-600">Friends ({friendsCheckins.length})</span>
          </div>
        )}
      </div>

      {/* US Map */}
      <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-lg p-4 relative">
        <USMapSVG
          markers={mapMarkers}
          visitedStates={activeLayers.includes('visits') ? visitedStates : []}
          plannedStates={activeLayers.includes('visits') ? plannedStates : []}
          stateColors={getStateColors()}
          highways={activeLayers.includes('highways') ? getDisplayHighways() : []}
          showHighways={activeLayers.includes('highways')}
          tripRoute={activeRoute || undefined}
          userProfilePicture={profilePicture}
          onStateClick={handleStateClick}
          onStateHover={setHoveredState}
          onMarkerClick={(marker: any) => {
            if (marker.type === 'gasStation') {
              const station = gasStations.find(s => s.id === marker.id.replace('gas-', ''));
              if (station) setSelectedGasStation(station);
            } else if (marker.type === 'freeOvernight') {
              // Show info in a simple alert or future modal
              const spot = freeOvernightSpots.find(s => `free-${s.id}` === marker.id);
              if (spot) {
                const amenities = [spot.hasWifi && 'WiFi', spot.hasDump && 'Dump', spot.hasWater && 'Water'].filter(Boolean).join(', ');
                alert(`🌙 ${spot.name}\n${spot.category || 'Free Overnight'}\n${spot.notes || ''}\n${amenities ? 'Amenities: ' + amenities : 'No amenities listed'}`);
              }
            } else if (marker.type === 'restStop') {
              const stop = restStops.find(s => s.id === marker.id.replace('rest-', ''));
              if (stop) setSelectedRestStop(stop);
            } else if (marker.type === 'friendCheckin' && marker.user) {
              const checkin = friendsCheckins.find((c: any) => c.userId === marker.user?.id || c.user?.id === marker.user?.id);
              setShoutoutTarget({
                user: marker.user,
                campgroundId: checkin?.campgroundId || checkin?.campground?.id,
                campgroundName: marker.name?.replace(`${marker.user.firstName || ''} at `, '') || checkin?.campground?.name,
              });
              setShoutoutMsg('');
              setShoutoutSent(false);
            }
          }}
          isInteractive={true}
        />

        {hoveredState && (
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10 pointer-events-none">
            <p className="font-semibold">{STATE_NAMES[hoveredState]}</p>
            {activeLayers.includes('gasPrices') && gasPrices.find(p => p.stateCode === hoveredState) && (
              <div className="text-sm text-gray-600 mt-1">
                <p>Regular: ${gasPrices.find(p => p.stateCode === hoveredState)?.regularPrice?.toFixed(2) || "N/A"}</p>
                <p>Diesel: ${gasPrices.find(p => p.stateCode === hoveredState)?.dieselPrice?.toFixed(2) || "N/A"}</p>
              </div>
            )}
            {activeLayers.includes('visits') && (
              <p className="text-sm text-gray-600">
                {visitedStates.includes(hoveredState) 
                  ? `✓ Visited (${getStateVisits(hoveredState).filter(v => !isPlannedVisit(v.startDate)).length})`
                  : plannedStates.includes(hoveredState)
                  ? `📅 Planned (${getStateVisits(hoveredState).filter(v => isPlannedVisit(v.startDate)).length})`
                  : 'Not visited'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Shoutout Popover */}
      {shoutoutTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShoutoutTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {shoutoutTarget.user.profilePicture ? (
                  <img src={shoutoutTarget.user.profilePicture} className="w-10 h-10 rounded-full object-cover border-2 border-white/50" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">{shoutoutTarget.user.firstName?.[0] || '?'}</div>
                )}
                <div>
                  <div className="text-white font-semibold">{shoutoutTarget.user.firstName} {shoutoutTarget.user.lastName}</div>
                  {shoutoutTarget.campgroundName && <div className="text-emerald-100 text-xs">📍 {shoutoutTarget.campgroundName}</div>}
                </div>
              </div>
              <button onClick={() => setShoutoutTarget(null)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {shoutoutSent ? (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">📍</div>
                  <p className="font-semibold text-gray-800">Shoutout sent!</p>
                  <p className="text-sm text-gray-500 mt-1">{shoutoutTarget.user.firstName} will see it on their Basecamp</p>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setShoutoutTarget(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">Done</button>
                    <button onClick={() => navigate(`/profile/${shoutoutTarget.user.username}`)} className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition">View Profile</button>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    value={shoutoutMsg}
                    onChange={e => setShoutoutMsg(e.target.value)}
                    placeholder={`Say hey to ${shoutoutTarget.user.firstName}...`}
                    rows={3}
                    maxLength={280}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                    autoFocus
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">{shoutoutMsg.length}/280</span>
                    <button
                      onClick={async () => {
                        if (!shoutoutMsg.trim()) return;
                        setShoutoutSending(true);
                        try {
                          await api.post('/basecamp-activity/shoutout', {
                            targetUserId: shoutoutTarget.user.id,
                            campgroundId: shoutoutTarget.campgroundId,
                            message: shoutoutMsg.trim(),
                          });
                          setShoutoutSent(true);
                        } catch (e) { console.error(e); }
                        finally { setShoutoutSending(false); }
                      }}
                      disabled={!shoutoutMsg.trim() || shoutoutSending}
                      className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 transition"
                    >
                      <Send className="w-4 h-4" />
                      {shoutoutSending ? 'Sending...' : 'Send Shoutout'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gas Stations List */}
      {activeLayers.includes('gasStations') && gasStations.length > 0 && (
        <div className="mt-6">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-orange-500" />
            Truck Stops & Travel Centers
            <span className="text-sm font-normal text-gray-500">({gasStations.length})</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
            {gasStations.slice(0, 30).map((station) => (
              <div
                key={station.id}
                onClick={() => setSelectedGasStation(station)}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md cursor-pointer transition"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    station.brand === 'Pilot' || station.brand === 'Flying J' ? 'bg-red-100' :
                    station.brand === "Love's" ? 'bg-yellow-100' :
                    station.brand === 'TA' || station.brand === 'Petro' ? 'bg-blue-100' :
                    'bg-gray-100'
                  }`}>
                    <Fuel className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{station.name}</p>
                    <p className="text-sm text-gray-600 truncate">{station.city}, {station.state}</p>
                    {station.interstate && (
                      <p className="text-xs text-primary-600 mt-1">
                        <Route className="w-3 h-3 inline mr-1" />
                        {station.interstate} {station.exitNumber && `Exit ${station.exitNumber}`}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {station.hasRVParking && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">RV</span>}
                      {station.hasShowers && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Showers</span>}
                      {station.hasDumpStation && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Dump</span>}
                      {station.hasPropane && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Propane</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {gasStations.length > 30 && (
            <p className="text-center text-sm text-gray-500 mt-2">
              Showing 30 of {gasStations.length} stations. Filter by interstate to see more.
            </p>
          )}
        </div>
      )}

      {/* Rest Stops List */}
      {activeLayers.includes('restStops') && restStops.length > 0 && (
        <div className="mt-6">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Coffee className="w-5 h-5 text-blue-500" />
            Rest Areas
            <span className="text-sm font-normal text-gray-500">({restStops.length})</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
            {restStops.slice(0, 30).map((stop) => (
              <div
                key={stop.id}
                onClick={() => setSelectedRestStop(stop)}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md cursor-pointer transition"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <ParkingCircle className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{stop.name}</p>
                    <p className="text-sm text-gray-600">{stop.interstate} • {stop.direction || 'Both'}</p>
                    {stop.mileMarker && <p className="text-xs text-gray-500">Mile {stop.mileMarker}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {stop.hasRVParking && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">RV</span>}
                      {stop.hasPetArea && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Pets</span>}
                      {stop.hasWifi && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">WiFi</span>}
                      {stop.hasDumpStation && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Dump</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gas Station Modal */}
      {selectedGasStation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{selectedGasStation.name}</h2>
                <button onClick={() => setSelectedGasStation(null)} className="text-white hover:text-gray-200">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-orange-100">{selectedGasStation.brand}</p>
            </div>
            <div className="p-4">
              <p className="text-gray-700 mb-2">{selectedGasStation.address}</p>
              <p className="text-gray-600 mb-4">{selectedGasStation.city}, {selectedGasStation.state}</p>
              
              {selectedGasStation.interstate && (
                <p className="text-primary-600 font-medium mb-4">
                  <Route className="w-4 h-4 inline mr-1" />
                  {selectedGasStation.interstate} {selectedGasStation.exitNumber && `- Exit ${selectedGasStation.exitNumber}`}
                </p>
              )}

              <h4 className="font-semibold text-gray-900 mb-2">Amenities</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className={`flex items-center gap-2 ${selectedGasStation.hasDiesel ? 'text-green-600' : 'text-gray-400'}`}>
                  <Fuel className="w-4 h-4" /> Diesel
                </div>
                <div className={`flex items-center gap-2 ${selectedGasStation.hasRVParking ? 'text-green-600' : 'text-gray-400'}`}>
                  <Truck className="w-4 h-4" /> RV Parking
                </div>
                <div className={`flex items-center gap-2 ${selectedGasStation.hasShowers ? 'text-green-600' : 'text-gray-400'}`}>
                  <ShowerHead className="w-4 h-4" /> Showers
                </div>
                <div className={`flex items-center gap-2 ${selectedGasStation.hasRestaurant ? 'text-green-600' : 'text-gray-400'}`}>
                  <Coffee className="w-4 h-4" /> Restaurant
                </div>
                <div className={`flex items-center gap-2 ${selectedGasStation.hasStore ? 'text-green-600' : 'text-gray-400'}`}>
                  <Store className="w-4 h-4" /> Store
                </div>
                <div className={`flex items-center gap-2 ${selectedGasStation.hasDumpStation ? 'text-green-600' : 'text-gray-400'}`}>
                  <Droplet className="w-4 h-4" /> Dump Station
                </div>
                <div className={`flex items-center gap-2 ${selectedGasStation.hasPropane ? 'text-green-600' : 'text-gray-400'}`}>
                  <Fuel className="w-4 h-4" /> Propane
                </div>
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedGasStation.latitude},${selectedGasStation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full bg-primary-600 hover:bg-primary-700 text-white text-center py-2 rounded-lg"
              >
                Open in Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Rest Stop Modal */}
      {selectedRestStop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{selectedRestStop.name}</h2>
                <button onClick={() => setSelectedRestStop(null)} className="text-white hover:text-gray-200">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-blue-100">{selectedRestStop.interstate} • {selectedRestStop.state}</p>
            </div>
            <div className="p-4">
              {selectedRestStop.direction && <p className="text-gray-700 mb-2">Direction: {selectedRestStop.direction}</p>}
              {selectedRestStop.mileMarker && <p className="text-gray-600 mb-2">Mile Marker: {selectedRestStop.mileMarker}</p>}
              <p className={`text-sm mb-4 ${selectedRestStop.is24Hours ? 'text-green-600' : 'text-orange-600'}`}>
                {selectedRestStop.is24Hours ? '✓ Open 24 Hours' : 'Limited Hours'}
              </p>
              {selectedRestStop.notes && <p className="text-gray-600 italic mb-4">{selectedRestStop.notes}</p>}

              <h4 className="font-semibold text-gray-900 mb-2">Amenities</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className={`flex items-center gap-2 ${selectedRestStop.hasRestrooms ? 'text-green-600' : 'text-gray-400'}`}>
                  <Coffee className="w-4 h-4" /> Restrooms
                </div>
                <div className={`flex items-center gap-2 ${selectedRestStop.hasRVParking ? 'text-green-600' : 'text-gray-400'}`}>
                  <Truck className="w-4 h-4" /> RV Parking
                </div>
                <div className={`flex items-center gap-2 ${selectedRestStop.hasPetArea ? 'text-green-600' : 'text-gray-400'}`}>
                  <Dog className="w-4 h-4" /> Pet Area
                </div>
                <div className={`flex items-center gap-2 ${selectedRestStop.hasPicnicArea ? 'text-green-600' : 'text-gray-400'}`}>
                  <MapPin className="w-4 h-4" /> Picnic Area
                </div>
                <div className={`flex items-center gap-2 ${selectedRestStop.hasVending ? 'text-green-600' : 'text-gray-400'}`}>
                  <Store className="w-4 h-4" /> Vending
                </div>
                <div className={`flex items-center gap-2 ${selectedRestStop.hasWifi ? 'text-green-600' : 'text-gray-400'}`}>
                  <Wifi className="w-4 h-4" /> WiFi
                </div>
                <div className={`flex items-center gap-2 ${selectedRestStop.hasDumpStation ? 'text-green-600' : 'text-gray-400'}`}>
                  <Droplet className="w-4 h-4" /> Dump Station
                </div>
                <div className={`flex items-center gap-2 ${selectedRestStop.hasWater ? 'text-green-600' : 'text-gray-400'}`}>
                  <Droplet className="w-4 h-4" /> Water
                </div>
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedRestStop.latitude},${selectedRestStop.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full bg-primary-600 hover:bg-primary-700 text-white text-center py-2 rounded-lg"
              >
                Open in Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* State Modal */}
      {selectedState && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedState(null)}>
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: 'rgba(15,26,46,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(201,168,76,0.18)' }} onClick={e => e.stopPropagation()}>
            <div className="p-5 sticky top-0 z-10 flex items-center justify-between" style={{ background: 'rgba(15,26,46,0.98)', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
              <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display',serif", color: 'white' }}>{STATE_NAMES[selectedState]}</h2>
              <button onClick={() => setSelectedState(null)} className="p-1 hover:opacity-70"><X className="w-5 h-5 text-white" /></button>
            </div>

            <div className="p-5">
              {activeLayers.includes('gasPrices') && gasPrices.find(p => p.stateCode === selectedState) && (
                <div className="flex gap-4 text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <span>Regular: ${gasPrices.find(p => p.stateCode === selectedState)?.regularPrice?.toFixed(2) || "N/A"}</span>
                  <span>Diesel: ${gasPrices.find(p => p.stateCode === selectedState)?.dieselPrice?.toFixed(2) || "N/A"}</span>
                </div>
              )}

              {isOwnProfile && (
                <button onClick={handleAddVisit} className="mb-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#E8622A', color: 'white' }}>
                  <Plus className="w-4 h-4" /> Add Visit to {STATE_NAMES[selectedState]}
                </button>
              )}

              {stateDetailError ? (
                <div className="text-center py-8"><Lock className="w-10 h-10 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.2)' }} /><p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{stateDetailError}</p></div>
              ) : stateDetailLoading ? (
                <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />)}</div>
              ) : (stateDetail?.visits || getStateVisits(selectedState)).length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{isOwnProfile ? 'Your visits' : 'Trips'}</h3>
                  {(stateDetail?.visits || getStateVisits(selectedState)).map((visit: any) => (
                    <div key={visit.id} className="rounded-xl p-4" style={{ background: isPlannedVisit(visit.startDate) ? 'rgba(74,144,217,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isPlannedVisit(visit.startDate) ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" style={{ color: isPlannedVisit(visit.startDate) ? '#4A90D9' : '#C9A84C' }} />
                          <span className="text-sm font-semibold">{formatDateRange(visit.startDate, visit.endDate)}</span>
                          {isPlannedVisit(visit.startDate) && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,144,217,0.2)', color: '#4A90D9' }}>Planned</span>}
                        </div>
                        <div className="flex gap-1 items-center">
                          {(visit.event?.id || visit.eventId) && (
                            <Link to={`/trips/${visit.event?.id || visit.eventId}`} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: '#E8622A', color: 'white' }}>
                              <Eye className="w-3.5 h-3.5" /> View Trip
                            </Link>
                          )}
                          {isOwnProfile && (
                            <>
                              <button onClick={() => { setEditingVisit(visit); setVisitForm({ state: visit.state, startDate: visit.startDate.split('T')[0], endDate: visit.endDate?.split('T')[0] || '', notes: visit.notes || '', campsiteId: visit.campsiteId || '', eventId: visit.eventId || '', attendeeIds: visit.attendees?.map((a: any) => a.user?.id || a.id) || [], albumIds: visit.albums?.map((a: any) => a.id) || [], visibility: visit.visibility || 'PUBLIC' }); loadCampgrounds(visit.state); setSelectedState(null); setShowAddVisitModal(true); }} className="p-1.5 hover:opacity-70" style={{ color: '#C9A84C' }}><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteVisit(visit.id)} className="p-1.5 hover:opacity-70" style={{ color: '#ef4444' }}><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Event */}
                      {visit.event && (
                        <Link to={`/trips/${visit.event.id}`} className="flex items-center gap-3 mb-3 p-2 rounded-lg hover:bg-white/[0.03] transition">
                          {visit.event.coverImage && <img src={visit.event.coverImage} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="" />}
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#FDF6E9' }}>{visit.event.title}</p>
                            {visit.event.location && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{visit.event.location}</p>}
                          </div>
                        </Link>
                      )}

                      {/* Attendees / Co-travelers */}
                      {visit.attendees && visit.attendees.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[11px] font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            <Users className="w-3.5 h-3.5" /> {visit.attendees.length} {visit.attendees.length === 1 ? "traveler" : "travelers"} on this trip
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {visit.attendees.slice(0, 8).map((a: any) => {
                              const u = a.user || a;
                              const name = u.firstName || u.username || 'Guest';
                              return (
                                <Link key={u.id} to={`/profile/${u.username || u.id}`} className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:opacity-80 transition" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                  {u.profilePicture ? (
                                    <img src={u.profilePicture} alt="" className="w-5 h-5 rounded-full border" style={{ borderColor: 'rgba(201,168,76,0.4)' }} />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(201,168,76,0.2)', color: '#C9A84C' }}>{name[0]}</div>
                                  )}
                                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{name}</span>
                                </Link>
                              );
                            })}
                            {visit.attendees.length > 8 && <span className="text-[11px] self-center" style={{ color: 'rgba(255,255,255,0.3)' }}>+{visit.attendees.length - 8} more</span>}
                          </div>
                        </div>
                      )}

                      {/* Event attendees (if no StateVisitAttendees but event has attendees) */}
                      {(!visit.attendees || visit.attendees.length === 0) && visit.event?.attendees?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[11px] font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            <Users className="w-3.5 h-3.5" /> Also on this trip
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {visit.event.attendees.slice(0, 6).map((a: any) => {
                              const u = a.user || a;
                              return (
                                <Link key={u.id || a.userId} to={`/profile/${u.username || u.id || a.userId}`} className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:opacity-80 transition" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                  {u.profilePicture ? (
                                    <img src={u.profilePicture} alt="" className="w-5 h-5 rounded-full border" style={{ borderColor: 'rgba(201,168,76,0.4)' }} />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(201,168,76,0.2)', color: '#C9A84C' }}>{(u.firstName || '?')[0]}</div>
                                  )}
                                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{u.firstName || 'Guest'}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Campsite */}
                      {visit.campsite && (
                        <Link to={`/campgrounds/${visit.campsite.slug || visit.campsite.id}`} className="flex items-center gap-1.5 mb-2 text-[12px] hover:opacity-80 transition" style={{ color: '#C9A84C' }}>
                          <MapPin className="w-3.5 h-3.5" /> {visit.campsite.name}
                        </Link>
                      )}

                      {visit.notes && <p className="text-[12px] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{visit.notes}</p>}

                      {/* Event Photo Albums (from event's linked albums) */}
                      {visit.event?.photoAlbums?.length > 0 && (
                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[12px] font-semibold mb-2 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            <Image className="w-3.5 h-3.5" /> Trip Albums ({visit.event.photoAlbums.length})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {visit.event.photoAlbums.map((album: any) => (
                              <Link key={album.id} to={`/trips/${visit.event.id}?tab=remember`} className="group relative rounded-lg overflow-hidden aspect-square hover:ring-2 hover:ring-amber-500/50 transition" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                {(album.coverPhotoUrl || album.photos?.[0]?.imageUrl) ? (
                                  <img src={album.coverPhotoUrl || album.photos[0].imageUrl} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Image className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.15)' }} /></div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                                  <p className="text-white text-[10px] font-medium truncate">{album.title}</p>
                                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{album._count?.photos || 0} photos</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Photos / Albums */}
                      {visit.albums && visit.albums.length > 0 && (
                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[12px] font-semibold mb-2 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            <Image className="w-3.5 h-3.5" /> Albums ({visit.albums.length})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {visit.albums.map((album: any) => (
                              <Link key={album.id} to={`/media-albums/${album.id}`} className="group relative rounded-lg overflow-hidden aspect-square hover:ring-2 hover:ring-amber-500/50 transition" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                {(album.coverPhoto || album.photos?.[0]?.imageUrl) ? (
                                  <img src={album.coverPhoto || album.photos[0].imageUrl} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Image className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.15)' }} /></div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                                  <p className="text-white text-[10px] font-medium truncate">{album.title}</p>
                                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{album.photoCount || album._count?.photos || 0} photos</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Copy trip */}
                      {!isOwnProfile && (
                        <button onClick={() => handleCopyTrip(visit)} disabled={copyingTrip === visit.id} className="mt-2 flex items-center gap-1 text-[11px] hover:opacity-80 transition" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <Copy className="w-3 h-3" /> {copyingTrip === visit.id ? 'Copying...' : 'Copy to my map'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8"><MapPin className="w-10 h-10 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} /><p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No visits recorded</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Visit Modal */}
      {showAddVisitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-4 rounded-t-lg sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{editingVisit ? 'Edit Visit' : 'Add Visit'}</h2>
                <button onClick={() => { setShowAddVisitModal(false); setEditingVisit(null); }} className="text-white hover:text-gray-200">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitVisit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={STATE_NAMES[visitForm.state]} disabled className="input bg-gray-100" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={visitForm.startDate}
                  onChange={(e) => setVisitForm({ ...visitForm, startDate: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={visitForm.endDate}
                  onChange={(e) => setVisitForm({ ...visitForm, endDate: e.target.value })}
                  className="input"
                  min={visitForm.startDate}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campground</label>
                {loadingCampgrounds ? (
                  <div className="input bg-gray-50 flex items-center justify-center">Loading...</div>
                ) : (
                  <select
                    value={visitForm.campsiteId}
                    onChange={(e) => setVisitForm({ ...visitForm, campsiteId: e.target.value })}
                    className="input"
                  >
                    <option value="">Select a campground...</option>
                    {campgrounds.map(cg => (
                      <option key={cg.id} value={cg.id}>{cg.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
                  rows={3}
                  className="input"
                  placeholder="Share details about your trip..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1">
                  {editingVisit ? 'Save Changes' : 'Add Visit'}
                </button>
                <button type="button" onClick={() => { setShowAddVisitModal(false); setEditingVisit(null); }} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Flair */}
      {flair.length > 0 && (
        <div className="mt-6">
          <h4 className="font-semibold text-gray-900 mb-3">Badges</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {flair.map((f) => (
              <Link key={f.id} to={`/campgrounds/${f.campsite.slug}`} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition">
                <div className="flex items-start gap-2">
                  <Award className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{f.campsite.name}</p>
                    <p className="text-xs text-gray-600">{STATE_NAMES[f.state]}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
