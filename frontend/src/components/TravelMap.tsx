import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Award, Calendar, X, Plus, Trash2, Users, Image, Edit2, Heart, Navigation, Tent,
  Eye, EyeOff, UserCheck, Lock, Copy, ExternalLink,
  Fuel, Coffee, ParkingCircle, Layers, DollarSign, Route,
  ShowerHead, Store, Truck, Dog, Wifi, Droplet, RefreshCw, Send, ChevronDown, Info
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
  defaultLayers?: MapLayer[];   // override default active layers
  socialMode?: boolean;         // enables social map layers (albums, upcoming friend trips)
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

type MapLayer = 'visits' | 'gasPrices' | 'gasStations' | 'restStops' | 'highways' | 'favorites' | 'upcomingTrips' | 'friendsCheckins' | 'freeOvernight' | 'recentAlbums' | 'upcomingFriendTrips';

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

export default function TravelMap({ userId, isOwnProfile, compact = false, showTripFilter = false, profilePicture, initialRoute, newStateHighlights = [], defaultLayers, socialMode = false }: TravelMapProps) {
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
  const [activeLayers, setActiveLayers] = useState<MapLayer[]>(defaultLayers || ['visits', 'friendsCheckins']);
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

  // Social map state (albums + upcoming friend trips)
  const [socialAlbums, setSocialAlbums] = useState<any[]>([]);
  const [socialUpcoming, setSocialUpcoming] = useState<any[]>([]);

  // Grouped controls state (Basecamp social mode only)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showLegend, setShowLegend] = useState(false);
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
  const [stayType, setStayType] = useState<'camping' | 'overnight'>('camping');
  const [overnightSearch, setOvernightSearch] = useState('');
  const [overnightResults, setOvernightResults] = useState<any[]>([]);
  const [selectedOvernight, setSelectedOvernight] = useState<any>(null);
  const [overnightFlags, setOvernightFlags] = useState<Record<string, boolean>>({});
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', stopType: 'OTHER', city: '', state: '', address: '' });
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [newlyCreatedStop, setNewlyCreatedStop] = useState(false);
  const [visitPhotos, setVisitPhotos] = useState<File[]>([]);
  const [visitPhotoPreview, setVisitPhotoPreview] = useState<string[]>([]);
  const [visitLinkUrl, setVisitLinkUrl] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadTravelMap();
    loadHomeLocation();
    loadUpcomingTrips(); // load on mount so trip filter dropdown is always populated
    if (isOwnProfile) {
      loadFriends();
      loadAlbums();
      loadEvents();
    }
    if (socialMode) {
      loadSocialMapData();
      loadFriendsCheckins();
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
    if ((activeLayers.includes('recentAlbums') || activeLayers.includes('upcomingFriendTrips')) && socialAlbums.length === 0 && socialUpcoming.length === 0) {
      loadSocialMapData();
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

  const loadSocialMapData = async () => {
    try {
      const { data } = await api.get('/basecamp/social-map');
      setSocialAlbums(data.recentAlbums || []);
      setSocialUpcoming(data.upcomingFriendTrips || []);
    } catch (error) {
      console.error('Load social map error:', error);
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
      if (stayType === 'overnight' && editingVisit) {
        // Update existing overnight visit — link to a location retroactively
        await api.put(`/travel-map/visits/${editingVisit.id}`, {
          ...visitForm,
          visitType: 'OVERNIGHT',
          overnightStopId: selectedOvernight?.id || null,
          overnightStopName: selectedOvernight?.name || null,
          endDate: visitForm.startDate,
          latitude: selectedOvernight?.latitude || geoCoords?.lat,
          longitude: selectedOvernight?.longitude || geoCoords?.lng,
        });
        if (selectedOvernight) {
          await api.post(`/overnight-stops/${selectedOvernight.id}/visits`, {
            date: visitForm.startDate, nights: 1, note: visitForm.notes || null, tip: visitForm.notes || null,
            ...Object.fromEntries(Object.entries(overnightFlags).map(([k, v]) => [k, v])),
          }).catch(() => {});
        }
      } else if (stayType === 'overnight') {
        // Create new overnight visit
        if (selectedOvernight) {
          await api.post(`/overnight-stops/${selectedOvernight.id}/visits`, {
            date: visitForm.startDate, nights: 1, note: visitForm.notes || null, tip: visitForm.notes || null,
            ...Object.fromEntries(Object.entries(overnightFlags).map(([k, v]) => [k, v])),
          });
        }
        await api.post('/travel-map/visits', {
          state: visitForm.state,
          startDate: visitForm.startDate,
          endDate: visitForm.startDate,
          visitType: 'OVERNIGHT',
          overnightStopId: selectedOvernight?.id || null,
          overnightStopName: selectedOvernight?.name || null,
          notes: visitForm.notes || null,
          visibility: visitForm.visibility,
          latitude: selectedOvernight?.latitude || geoCoords?.lat,
          longitude: selectedOvernight?.longitude || geoCoords?.lng,
        });
      } else if (editingVisit) {
        await api.put(`/travel-map/visits/${editingVisit.id}`, { ...visitForm, visitType: 'CAMPING', linkUrl: visitLinkUrl || undefined, latitude: geoCoords?.lat, longitude: geoCoords?.lng });
      } else {
        const { data: newVisit } = await api.post('/travel-map/visits', { ...visitForm, visitType: 'CAMPING', linkUrl: visitLinkUrl || undefined, latitude: geoCoords?.lat, longitude: geoCoords?.lng });
        // Upload photos if any
        if (visitPhotos.length > 0 && newVisit?.id) {
          const formData = new FormData();
          visitPhotos.forEach(f => formData.append('photos', f));
          await api.post(`/travel-map/visits/${newVisit.id}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(() => {});
        }
      }
      const wasNewStop = newlyCreatedStop && selectedOvernight;
      const newStopName = selectedOvernight?.name;
      setShowAddVisitModal(false);
      setEditingVisit(null);
      setStayType('camping');
      setSelectedOvernight(null);
      setOvernightSearch('');
      setOvernightFlags({});
      setShowQuickAdd(false);
      setNewlyCreatedStop(false);
      setVisitPhotos([]);
      setVisitPhotoPreview([]);
      setVisitLinkUrl('');
      setGeoCoords(null);
      setVisitForm({ state: '', startDate: '', endDate: '', notes: '', campsiteId: '', eventId: '', attendeeIds: [], albumIds: [], visibility: 'PUBLIC' });
      await loadTravelMap();
      if (wasNewStop) {
        alert(`Visit logged! \u{1F319} ${newStopName} has been added to the RVUnicorn map \u2014 other RVers will thank you!`);
      }
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
    // Recent albums markers (curated)
    ...(activeLayers.includes('recentAlbums') ? (() => {
      // Curation: de-dupe against live friends at same campground, cap 15
      const liveCgIds = new Set(friendsCheckins.filter((c: any) => c.campground?.id).map((c: any) => c.campground.id));
      return socialAlbums
        .filter((a: any) => a.latitude && a.longitude && (!a.campgroundId || !liveCgIds.has(a.campgroundId)))
        .slice(0, 15)
        .map((a: any) => ({
          id: `album-${a.albumId}`,
          name: `${a.ownerFirstName || 'Friend'}'s album: ${a.albumTitle}`,
          latitude: a.latitude,
          longitude: a.longitude,
          type: "recentAlbum" as const,
          albumId: a.albumId,
          coverImageUrl: a.coverImageUrl,
          user: { id: '', username: a.ownerUsername, firstName: a.ownerFirstName, profilePicture: a.ownerAvatarUrl },
        }));
    })() : []),
    // Upcoming friend trips markers (cap 10, soonest first)
    ...(activeLayers.includes('upcomingFriendTrips') ? socialUpcoming
      .filter((t: any) => t.latitude && t.longitude)
      .slice(0, 10)
      .map((t: any) => ({
        id: `friend-trip-${t.tripId}`,
        name: `${t.ownerFirstName || 'Friend'}'s trip: ${t.tripTitle}`,
        latitude: t.latitude,
        longitude: t.longitude,
        type: "upcomingFriendTrip" as const,
        tripId: t.tripId,
        departureDate: t.departureDate,
        user: { id: '', username: t.ownerUsername, firstName: t.ownerFirstName, profilePicture: t.ownerAvatarUrl },
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

  // ── Phase 4: Lightweight proximity clustering for social markers ──
  // On a fixed national SVG, markers within ~2° overlap visually.
  // Only cluster social marker types; leave campgrounds/gas/etc untouched.
  const CLUSTER_RADIUS = 2; // degrees
  const SOCIAL_TYPES = new Set(['friendCheckin', 'recentAlbum', 'upcomingFriendTrip']);
  const TYPE_PRIORITY: Record<string, number> = { friendCheckin: 3, recentAlbum: 2, upcomingFriendTrip: 1 };

  const socialMarkers = mapMarkers.filter(m => SOCIAL_TYPES.has(m.type));
  const otherMarkers = mapMarkers.filter(m => !SOCIAL_TYPES.has(m.type));

  const clustered: typeof mapMarkers = [];
  const used = new Set<number>();

  for (let i = 0; i < socialMarkers.length; i++) {
    if (used.has(i)) continue;
    const anchor = socialMarkers[i];
    const group = [anchor];
    used.add(i);

    for (let j = i + 1; j < socialMarkers.length; j++) {
      if (used.has(j)) continue;
      const other = socialMarkers[j];
      const dLat = Math.abs(anchor.latitude - other.latitude);
      const dLng = Math.abs(anchor.longitude - other.longitude);
      if (dLat < CLUSTER_RADIUS && dLng < CLUSTER_RADIUS) {
        group.push(other);
        used.add(j);
      }
    }

    if (group.length === 1) {
      clustered.push(anchor);
    } else {
      // Pick highest-priority marker as the cluster face
      group.sort((a, b) => (TYPE_PRIORITY[b.type] || 0) - (TYPE_PRIORITY[a.type] || 0));
      clustered.push({ ...group[0], clusterCount: group.length });
    }
  }

  const finalMarkers = [...otherMarkers, ...clustered];

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
          <h3 className={`text-lg font-bold ${socialMode ? '' : 'text-gray-900'}`} style={socialMode ? { color: '#F5F0E8' } : undefined}>
            {visitedStates.length} {visitedStates.length === 1 ? 'State' : 'States'} Visited
            {plannedStates.length > 0 && ` • ${plannedStates.length} Planned`}
          </h3>
          <p className={`text-sm ${socialMode ? '' : 'text-gray-600'}`} style={socialMode ? { color: '#8B9BB4' } : undefined}>
            {isOwnProfile ? 'Click a state to view or add visits' : 'Click a state to view trips'}
          </p>
        </div>

      </div>

      {/* ══ SOCIAL MODE: Grouped Controls + Chips ══ */}
      {showLayerPanel && !compact && socialMode && (() => {
        const SOCIAL_LAYERS: MapLayer[] = ['friendsCheckins', 'recentAlbums', 'upcomingFriendTrips'];
        const isSocialOn = SOCIAL_LAYERS.some(l => activeLayers.includes(l));
        const toggleGroup = (group: string) => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
        const toggleSocialMaster = () => {
          if (isSocialOn) {
            setActiveLayers(prev => prev.filter(l => !SOCIAL_LAYERS.includes(l)));
          } else {
            setActiveLayers(prev => [...prev, ...SOCIAL_LAYERS.filter(l => !prev.includes(l))]);
          }
        };

        // Build chip data from active layers
        const chips: { label: string; layer: MapLayer | 'social'; color: string }[] = [];
        if (activeLayers.includes('visits')) chips.push({ label: 'My Visits', layer: 'visits', color: 'bg-orange-100 text-orange-700 border-orange-200' });
        if (activeLayers.includes('favorites')) chips.push({ label: 'Favorites', layer: 'favorites', color: 'bg-red-100 text-red-700 border-red-200' });
        if (activeLayers.includes('upcomingTrips')) chips.push({ label: 'My Trips', layer: 'upcomingTrips', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' });
        if (isSocialOn) chips.push({ label: 'Travel Activity', layer: 'social', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' });
        if (activeLayers.includes('highways')) chips.push({ label: 'Highways', layer: 'highways', color: 'bg-purple-100 text-purple-700 border-purple-200' });
        if (activeLayers.includes('freeOvernight')) chips.push({ label: 'Free Overnight', layer: 'freeOvernight', color: 'bg-teal-100 text-teal-700 border-teal-200' });
        if (activeLayers.includes('gasPrices')) chips.push({ label: 'Gas Prices', layer: 'gasPrices', color: 'bg-green-100 text-green-700 border-green-200' });
        if (activeLayers.includes('gasStations')) chips.push({ label: 'Truck Stops', layer: 'gasStations', color: 'bg-orange-100 text-orange-700 border-orange-200' });
        if (activeLayers.includes('restStops')) chips.push({ label: 'Rest Stops', layer: 'restStops', color: 'bg-blue-100 text-blue-700 border-blue-200' });

        return (
          <>
            {/* Active filter chips — single scrollable row */}
            {chips.length > 0 && (
              <div className="mb-3 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex gap-1.5 pb-1" style={{ minWidth: 'max-content' }}>
                  {chips.map(chip => (
                    <span key={chip.label} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${chip.color}`}>
                      {chip.label}
                      <button
                        onClick={() => {
                          if (chip.layer === 'social') { toggleSocialMaster(); }
                          else { toggleLayer(chip.layer as MapLayer); }
                        }}
                        className="ml-0.5 opacity-60 hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Compact "Layers" popover — replaces four stacked groups */}
            <div className="mb-3">
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, _layersOpen: !prev._layersOpen }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={{ background: '#1e3050', color: '#F5F0E8', border: '1px solid #243552' }}
              >
                <Layers className="w-3.5 h-3.5" style={{ color: '#E8A838' }} />
                Layers
                <ChevronDown className={`w-3 h-3 transition-transform ${expandedGroups._layersOpen ? 'rotate-180' : ''}`} style={{ color: '#8B9BB4' }} />
              </button>
              {expandedGroups._layersOpen && (
                <div className="mt-2 rounded-lg p-3 space-y-3" style={{ background: '#1e3050', border: '1px solid #243552' }}>
                  {/* Personal */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#8B9BB4' }}>Personal</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => toggleLayer('visits')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('visits') ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-[#243552] text-[#8B9BB4] hover:border-[#3d4f6e]'}`}>My Visits</button>
                      <button onClick={() => toggleLayer('favorites')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('favorites') ? 'bg-red-50 border-red-300 text-red-700' : 'border-[#243552] text-[#8B9BB4] hover:border-[#3d4f6e]'}`}>Favorites</button>
                      <button onClick={() => toggleLayer('upcomingTrips')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('upcomingTrips') ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-[#243552] text-[#8B9BB4] hover:border-[#3d4f6e]'}`}>My Trips</button>
                    </div>
                  </div>
                  {/* Social */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#8B9BB4' }}>Social</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={toggleSocialMaster} className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition ${isSocialOn ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-[#243552] text-[#8B9BB4] hover:border-[#3d4f6e]'}`}>Travel Activity</button>
                      {isSocialOn && <>
                        <button onClick={() => toggleLayer('friendsCheckins')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('friendsCheckins') ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-[#243552] text-[#8B9BB4]'}`}>Active</button>
                        <button onClick={() => toggleLayer('recentAlbums')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('recentAlbums') ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-[#243552] text-[#8B9BB4]'}`}>Albums</button>
                        <button onClick={() => toggleLayer('upcomingFriendTrips')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('upcomingFriendTrips') ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-[#243552] text-[#8B9BB4]'}`}>Upcoming</button>
                      </>}
                    </div>
                  </div>
                  {/* Travel + Utilities */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#8B9BB4' }}>Travel & Utilities</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => toggleLayer('highways')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('highways') ? 'bg-purple-50 border-purple-300 text-purple-700' : 'border-[#243552] text-[#8B9BB4] hover:border-[#3d4f6e]'}`}>Highways</button>
                      <button onClick={() => toggleLayer('freeOvernight')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('freeOvernight') ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-[#243552] text-[#8B9BB4] hover:border-[#3d4f6e]'}`}>Free Overnight</button>
                      <button onClick={() => toggleLayer('gasPrices')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('gasPrices') ? 'bg-green-50 border-green-300 text-green-700' : 'border-[#243552] text-[#8B9BB4] hover:border-[#3d4f6e]'}`}>Gas Prices</button>
                      <button onClick={() => toggleLayer('gasStations')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('gasStations') ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-[#243552] text-[#8B9BB4] hover:border-[#3d4f6e]'}`}>Truck Stops</button>
                      <button onClick={() => toggleLayer('restStops')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition ${activeLayers.includes('restStops') ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-[#243552] text-[#8B9BB4] hover:border-[#3d4f6e]'}`}>Rest Stops</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ══ NON-SOCIAL MODE: Original flat grid (TravelMapPage, Profile) ══ */}
      {showLayerPanel && !compact && !socialMode && (
        <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Map Layers
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <button onClick={() => toggleLayer('visits')} className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${activeLayers.includes('visits') ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300'}`}><MapPin className="w-6 h-6" /><span className="text-sm font-medium">My Visits</span></button>
            <button onClick={() => toggleLayer('gasPrices')} className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${activeLayers.includes('gasPrices') ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'}`}><DollarSign className="w-6 h-6" /><span className="text-sm font-medium">Gas Prices</span></button>
            <button onClick={() => toggleLayer('highways')} className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${activeLayers.includes('highways') ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-gray-300'}`}><Route className="w-6 h-6" /><span className="text-sm font-medium">Highways</span></button>
            <button onClick={() => toggleLayer('gasStations')} className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${activeLayers.includes('gasStations') ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 hover:border-gray-300'}`}><Fuel className="w-6 h-6" /><span className="text-sm font-medium">Truck Stops</span></button>
            <button onClick={() => toggleLayer('restStops')} className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${activeLayers.includes('restStops') ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}><Coffee className="w-6 h-6" /><span className="text-sm font-medium">Rest Stops</span></button>
            <button onClick={() => toggleLayer('favorites')} className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${activeLayers.includes('favorites') ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300'}`}><Heart className="w-6 h-6" /><span className="text-sm font-medium">Favorites</span></button>
            <button onClick={() => toggleLayer('upcomingTrips')} className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${activeLayers.includes('upcomingTrips') ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}><Tent className="w-6 h-6" /><span className="text-sm font-medium">Upcoming Trips</span></button>
            <button onClick={() => toggleLayer('freeOvernight')} className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${activeLayers.includes('freeOvernight') ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 hover:border-gray-300'}`}><span className="text-2xl leading-none">🌙</span><span className="text-sm font-medium">Free Overnight</span></button>
            <button onClick={() => toggleLayer('friendsCheckins')} className={`p-3 rounded-lg border-2 transition flex flex-col items-center gap-2 ${activeLayers.includes('friendsCheckins') ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:border-gray-300'}`}><Users className="w-6 h-6" /><span className="text-sm font-medium">Friends</span></button>
          </div>
        </div>
      )}

      {/* US Map */}
      <div className={`rounded-lg p-4 relative ${socialMode ? '' : 'bg-gradient-to-br from-blue-50 to-green-50'}`} style={socialMode ? { background: '#16284a' } : undefined}>
        <USMapSVG
          markers={finalMarkers}
          visitedStates={activeLayers.includes('visits') ? visitedStates : []}
          plannedStates={activeLayers.includes('visits') ? plannedStates : []}
          stateColors={getStateColors()}
          highways={activeLayers.includes('highways') ? getDisplayHighways() : []}
          showHighways={activeLayers.includes('highways')}
          darkMode={socialMode}
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
            } else if (marker.type === 'recentAlbum' && marker.albumId) {
              navigate(`/albums/${marker.albumId}`);
            } else if (marker.type === 'upcomingFriendTrip' && marker.tripId) {
              navigate(`/trips/${marker.tripId}`);
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

        {/* Floating corner legend (socialMode only) */}
        {socialMode && (
          <div className="absolute bottom-3 right-3 z-10">
            {showLegend ? (
              <div className="backdrop-blur-sm rounded-lg shadow-lg p-2.5 text-[11px] space-y-1.5 max-w-[160px]" style={{ background: 'rgba(14,24,44,0.92)', border: '1px solid #243552' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[10px] uppercase tracking-wide" style={{ color: '#E8A838' }}>Legend</span>
                  <button onClick={() => setShowLegend(false)} style={{ color: '#8B9BB4' }}><X className="w-3 h-3" /></button>
                </div>
                {activeLayers.includes('visits') && <>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#E8622A' }}></div><span style={{ color: '#F5F0E8' }}>Visited</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: '#4a80c4' }}></div><span style={{ color: '#F5F0E8' }}>Planned</span></div>
                </>}
                {activeLayers.includes('friendsCheckins') && <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></div><span style={{ color: '#F5F0E8' }}>Friends (live)</span></div>}
                {activeLayers.includes('recentAlbums') && <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: '#E8A838' }}></div><span style={{ color: '#F5F0E8' }}>Albums</span></div>}
                {activeLayers.includes('upcomingFriendTrips') && <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-indigo-400 opacity-60"></div><span style={{ color: '#F5F0E8' }}>Upcoming</span></div>}
              </div>
            ) : (
              <button onClick={() => setShowLegend(true)} className="backdrop-blur-sm rounded-full shadow px-2.5 py-1 text-[10px] font-medium flex items-center gap-1" style={{ background: 'rgba(14,24,44,0.85)', color: '#8B9BB4', border: '1px solid #243552' }}>
                <Info className="w-3 h-3" /> Legend
              </button>
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
                  {(() => {
                    const visits = stateDetail?.visits || getStateVisits(selectedState);
                    const campingCount = visits.filter((v: any) => v.visitType !== 'OVERNIGHT' && !v.notes?.startsWith('\u{1F319} Overnight')).length;
                    const overnightCount = visits.filter((v: any) => v.visitType === 'OVERNIGHT' || v.notes?.startsWith('\u{1F319} Overnight')).length;
                    const totalPhotos = visits.reduce((sum: number, v: any) => {
                      let count = (v.photoUrls || []).length;
                      (v.albums || []).forEach((a: any) => { count += a.photoCount || a._count?.photos || 0; });
                      (v.event?.photoAlbums || []).forEach((a: any) => { count += a._count?.photos || 0; });
                      return sum + count;
                    }, 0);
                    return (
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{isOwnProfile ? 'Your visits' : 'Trips'}</h3>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {campingCount > 0 && `${campingCount} camping trip${campingCount !== 1 ? 's' : ''}`}
                          {campingCount > 0 && overnightCount > 0 && ' \u00B7 '}
                          {overnightCount > 0 && `${overnightCount} overnight stop${overnightCount !== 1 ? 's' : ''}`}
                          {totalPhotos > 0 && ` \u00B7 ${totalPhotos} photos`}
                        </span>
                      </div>
                    );
                  })()}
                  {(stateDetail?.visits || getStateVisits(selectedState)).map((visit: any) => {
                    const isOvernight = visit.visitType === 'OVERNIGHT' || visit.notes?.startsWith('\u{1F319} Overnight');
                    return (
                    <div key={visit.id} className="rounded-xl p-4" style={{ background: isPlannedVisit(visit.startDate) ? 'rgba(74,144,217,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isPlannedVisit(visit.startDate) ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex flex-col gap-1.5">
                          {/* Type badge */}
                          {isOvernight ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit" style={{ background: 'rgba(27,43,75,0.8)', color: '#E8A838', border: '1px solid rgba(232,168,56,0.3)' }}>{'\u{1F319}'} Overnight Stop</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit" style={{ background: 'rgba(232,168,56,0.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>{'\u{1F3D5}\uFE0F'} Camping Trip</span>
                          )}
                          {/* Date */}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" style={{ color: isPlannedVisit(visit.startDate) ? '#4A90D9' : '#C9A84C' }} />
                            <span className="text-sm font-semibold">
                              {isOvernight
                                ? `Night of ${new Date(visit.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} \u00B7 1 night`
                                : formatDateRange(visit.startDate, visit.endDate)
                              }
                            </span>
                            {isPlannedVisit(visit.startDate) && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,144,217,0.2)', color: '#4A90D9' }}>Planned</span>}
                          </div>
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

                      {/* Location name — clickable to location detail */}
                      {visit.campsite && !isOvernight && (
                        <Link to={`/locations/campground/${visit.campsite.slug || visit.campsite.id}`} className="flex items-center gap-1.5 mb-2 text-[12px] hover:underline transition" style={{ color: '#C9A84C' }}>
                          <MapPin className="w-3.5 h-3.5" /> {visit.campsite.name}
                        </Link>
                      )}
                      {isOvernight && (
                        <div className="flex items-center gap-1.5 mb-2 text-[12px] flex-wrap">
                          <span>{'\u{1F319}'}</span>
                          {visit.overnightStopId ? (
                            <Link to={`/overnight-spots/${visit.overnightStopId}`} className="hover:underline font-semibold" style={{ color: '#E8A838' }}>
                              {visit.overnightStopName || 'Overnight Stop'}
                            </Link>
                          ) : (
                            <>
                              <span style={{ color: '#E8A838' }}>{visit.overnightStopName || 'Overnight Stop'}</span>
                              {isOwnProfile && (
                                <button onClick={() => {
                                  setStayType('overnight');
                                  setEditingVisit(visit);
                                  setVisitForm({ state: visit.state, startDate: visit.startDate.split('T')[0], endDate: '', notes: visit.notes || '', campsiteId: '', eventId: '', attendeeIds: [], albumIds: [], visibility: visit.visibility || 'PUBLIC' });
                                  setSelectedState(null);
                                  setShowAddVisitModal(true);
                                }} className="text-[10px] hover:underline" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                  {'\u00B7'} Link to a location {'\u2192'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {!isOvernight && visit.notes && (
                        <p className="text-[12px] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{visit.notes}</p>
                      )}

                      {/* ── PHOTO ALBUM ROW ── */}
                      {(() => {
                        // Collect all photo sources
                        const allPhotos: string[] = [...(visit.photoUrls || [])];
                        const allAlbums = [...(visit.albums || []), ...(visit.event?.photoAlbums || [])];
                        let totalPhotoCount = allPhotos.length;
                        const previewUrls: string[] = [...allPhotos.slice(0, 3)];
                        allAlbums.forEach((a: any) => {
                          totalPhotoCount += a.photoCount || a._count?.photos || 0;
                          const cover = a.coverPhoto || a.coverPhotoUrl || a.photos?.[0]?.imageUrl;
                          if (cover && previewUrls.length < 3) previewUrls.push(cover);
                        });
                        const linkTo = visit.eventId ? `/trips/${visit.eventId}?tab=remember` : visit.campsiteId ? `/campgrounds/${visit.campsiteId}` : null;
                        const daysOld = Math.floor((Date.now() - new Date(visit.startDate).getTime()) / 86400000);

                        if (totalPhotoCount > 0) {
                          return (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[11px]">{'\u{1F4F8}'}</span>
                              <div className="flex gap-1">
                                {previewUrls.slice(0, 3).map((url: string, i: number) => (
                                  linkTo ? (
                                    <Link key={i} to={linkTo}><img src={url} className="w-9 h-9 rounded-lg object-cover hover:ring-2 hover:ring-amber-500/50 transition" alt="" /></Link>
                                  ) : (
                                    <img key={i} src={url} className="w-9 h-9 rounded-lg object-cover" alt="" />
                                  )
                                ))}
                              </div>
                              {totalPhotoCount > 3 && linkTo && (
                                <Link to={linkTo} className="text-[11px] font-semibold hover:underline" style={{ color: '#C9A84C' }}>+{totalPhotoCount - 3} more {'\u2192'}</Link>
                              )}
                              {totalPhotoCount > 3 && !linkTo && (
                                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>+{totalPhotoCount - 3} more</span>
                              )}
                            </div>
                          );
                        }

                        // No photos — show add prompt if within 90 days and own profile
                        if (isOwnProfile && daysOld <= 90) {
                          return (
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="text-[11px]">{'\u{1F4F8}'}</span>
                              <span className="text-[11px] italic" style={{ color: 'rgba(255,255,255,0.3)' }}>No photos yet</span>
                              {visit.eventId && (
                                <Link to={`/trips/${visit.eventId}?tab=remember`} className="text-[11px] font-semibold hover:underline" style={{ color: '#C9A84C' }}>
                                  Add photos {'\u2192'}
                                </Link>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Copy trip */}
                      {!isOwnProfile && (
                        <button onClick={() => handleCopyTrip(visit)} disabled={copyingTrip === visit.id} className="mt-2 flex items-center gap-1 text-[11px] hover:opacity-80 transition" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <Copy className="w-3 h-3" /> {copyingTrip === visit.id ? 'Copying...' : 'Copy to my map'}
                        </button>
                      )}
                    </div>
                    );
                  })}
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
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="text-white p-5 rounded-t-2xl sticky top-0 z-10" style={{ background: '#1B2B4B' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{editingVisit ? 'Edit Visit' : 'Add Visit'}</h2>
                <button onClick={() => { setShowAddVisitModal(false); setEditingVisit(null); setStayType('camping'); setSelectedOvernight(null); }} className="text-white/60 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitVisit} className="p-6 space-y-4">
              {/* Stay Type Toggle */}
              {!editingVisit && (
                <div className="flex gap-2 p-1 rounded-xl" style={{ background: '#f3f4f6' }}>
                  <button type="button" onClick={() => { setStayType('camping'); setSelectedOvernight(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${stayType === 'camping' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                    {'\u{1F3D5}\uFE0F'} Camping Trip
                  </button>
                  <button type="button" onClick={() => { setStayType('overnight'); setVisitForm(f => ({ ...f, endDate: '', campsiteId: '' })); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition`}
                    style={stayType === 'overnight' ? { background: '#1B2B4B', color: '#E8A838', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' } : { color: '#6b7280' }}>
                    {'\u{1F319}'} Overnight Stop
                  </button>
                </div>
              )}

              {/* State */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={STATE_NAMES[visitForm.state]} disabled className="input bg-gray-100" />
              </div>

              {/* Date fields — conditional on type */}
              {stayType === 'camping' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input type="date" value={visitForm.startDate} onChange={(e) => setVisitForm({ ...visitForm, startDate: e.target.value })} className="input" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" value={visitForm.endDate} onChange={(e) => setVisitForm({ ...visitForm, endDate: e.target.value })} className="input" min={visitForm.startDate} />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Night of *</label>
                  <input type="date" value={visitForm.startDate} onChange={(e) => setVisitForm({ ...visitForm, startDate: e.target.value })} className="input" required />
                </div>
              )}

              {/* Location — conditional on type */}
              {stayType === 'camping' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campground</label>
                  {loadingCampgrounds ? (
                    <div className="input bg-gray-50 flex items-center justify-center">Loading...</div>
                  ) : (
                    <select value={visitForm.campsiteId} onChange={(e) => setVisitForm({ ...visitForm, campsiteId: e.target.value })} className="input">
                      <option value="">Select a campground...</option>
                      {campgrounds.map(cg => (<option key={cg.id} value={cg.id}>{cg.name}</option>))}
                    </select>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Where did you park?</label>
                  {selectedOvernight ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#1B2B4B', border: '1.5px solid #E8A838' }}>
                        <span className="text-xs">{'\u{1F319}'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{selectedOvernight.name}</p>
                        <p className="text-xs text-gray-500">{selectedOvernight.city}, {selectedOvernight.state}</p>
                      </div>
                      <button type="button" onClick={() => { setSelectedOvernight(null); setOvernightSearch(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                  ) : showQuickAdd ? (
                    /* ── INLINE QUICK-ADD FORM ── */
                    <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 space-y-3">
                      <p className="text-xs font-bold text-amber-700">{'\u2795'} Add a new location</p>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Location name</label>
                        <input type="text" value={quickAddForm.name} onChange={e => setQuickAddForm(f => ({ ...f, name: e.target.value }))} className="input text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-600 mb-1">Stop type</label>
                        <div className="flex gap-1 flex-wrap">
                          {[
                            { value: 'RETAIL', emoji: '\u{1F3EA}', label: 'Retail' },
                            { value: 'FUEL_CENTER', emoji: '\u26FD', label: 'Fuel' },
                            { value: 'REST_AREA', emoji: '\u{1F6D1}', label: 'Rest Area' },
                            { value: 'CASINO', emoji: '\u{1F3B0}', label: 'Casino' },
                            { value: 'OTHER', emoji: '\u{1F4CD}', label: 'Other' },
                          ].map(t => (
                            <button key={t.value} type="button" onClick={() => setQuickAddForm(f => ({ ...f, stopType: t.value }))}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${quickAddForm.stopType === t.value ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-gray-200 text-gray-600'}`}>
                              {t.emoji} {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-600 mb-0.5">City</label>
                          <input type="text" value={quickAddForm.city} onChange={e => setQuickAddForm(f => ({ ...f, city: e.target.value }))} className="input text-sm" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-600 mb-0.5">State</label>
                          <input type="text" value={quickAddForm.state} onChange={e => setQuickAddForm(f => ({ ...f, state: e.target.value }))} className="input text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Address (optional)</label>
                        <input type="text" value={quickAddForm.address} onChange={e => setQuickAddForm(f => ({ ...f, address: e.target.value }))} placeholder="Helps place it on the map" className="input text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={quickAddSaving || !quickAddForm.name.trim() || !quickAddForm.city.trim()}
                          onClick={async () => {
                            setQuickAddSaving(true);
                            try {
                              const { data: newStop } = await api.post('/overnight-stops', {
                                name: quickAddForm.name, stopType: quickAddForm.stopType,
                                city: quickAddForm.city, state: quickAddForm.state || visitForm.state,
                                address: quickAddForm.address || `${quickAddForm.city}, ${quickAddForm.state || visitForm.state}`,
                                latitude: geoCoords?.lat || 0, longitude: geoCoords?.lng || 0,
                              });
                              setSelectedOvernight(newStop);
                              setNewlyCreatedStop(true);
                              setShowQuickAdd(false);
                              setQuickAddForm({ name: '', stopType: 'OTHER', city: '', state: '', address: '' });
                            } catch { alert('Failed to add location'); }
                            setQuickAddSaving(false);
                          }}
                          className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50" style={{ background: '#E8A838' }}>
                          {quickAddSaving ? 'Adding...' : '\u2713 Use this location'}
                        </button>
                        <button type="button" onClick={() => { setShowQuickAdd(false); setQuickAddForm({ name: '', stopType: 'OTHER', city: '', state: '', address: '' }); }}
                          className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700">{'\u2715'} Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* ── SEARCH WITH ADD FALLBACK ── */
                    <>
                      <input type="text" value={overnightSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOvernightSearch(val);
                          if (val.length >= 2) {
                            api.get(`/overnight-stops?search=${encodeURIComponent(val)}&state=${visitForm.state}`).then(r => {
                              setOvernightResults(Array.isArray(r.data) ? r.data : []);
                            }).catch(() => setOvernightResults([]));
                          } else {
                            setOvernightResults([]);
                          }
                        }}
                        placeholder="Search Cracker Barrel, Walmart, Love's, rest areas..."
                        className="input" />
                      {overnightSearch.length >= 2 && (
                        <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                          {overnightResults.map((stop: any) => (
                            <button key={stop.id} type="button" onClick={() => { setSelectedOvernight(stop); setOvernightResults([]); setOvernightSearch(''); setNewlyCreatedStop(false); }}
                              className="w-full flex items-center gap-2 p-2 hover:bg-amber-50 text-left border-b border-gray-100 last:border-0">
                              <span className="text-sm">{stop.stopType === 'FUEL_CENTER' ? '\u26FD' : stop.stopType === 'REST_AREA' ? '\u{1F6D1}' : '\u{1F3EA}'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{stop.name}</p>
                                <p className="text-[10px] text-gray-500">{stop.city}, {stop.state}{stop.chain ? ` \u00B7 ${stop.chain.replace(/_/g, ' ')}` : ''}</p>
                              </div>
                            </button>
                          ))}
                          {overnightResults.length === 0 && (
                            <div className="p-2 text-center text-xs text-gray-400">{'\u{1F50D}'} No results for '{overnightSearch}'</div>
                          )}
                          {/* Always show Add fallback */}
                          <button type="button" onClick={() => {
                            // Smart chain detection
                            const q = overnightSearch.toLowerCase();
                            let detectedType = 'OTHER';
                            let detectedName = overnightSearch;
                            let detectedCity = '';
                            const fuelKeys = ['flying j', 'flyingj', 'pilot', 'loves', "love's", 'ta travel', 'petro', 'kwik trip', 'speedway', "buc-ee", 'bucees'];
                            const retailKeys = ['cracker barrel', 'walmart', 'wal-mart', "cabela", 'bass pro', 'costco', "sam's club"];
                            const restKeys = ['rest area', 'rest stop', 'welcome center', 'travel plaza', 'turnpike'];
                            if (fuelKeys.some(k => q.includes(k))) detectedType = 'FUEL_CENTER';
                            else if (retailKeys.some(k => q.includes(k))) detectedType = 'RETAIL';
                            else if (restKeys.some(k => q.includes(k))) detectedType = 'REST_AREA';
                            // Try to extract city: last word(s) after known chain name
                            const chainNames = [...fuelKeys, ...retailKeys, ...restKeys];
                            for (const cn of chainNames) {
                              if (q.includes(cn)) {
                                const after = overnightSearch.slice(q.indexOf(cn) + cn.length).trim();
                                if (after.length >= 2) { detectedCity = after; detectedName = overnightSearch.slice(0, q.indexOf(cn) + cn.length).trim(); }
                                break;
                              }
                            }
                            setQuickAddForm({ name: detectedName || overnightSearch, stopType: detectedType, city: detectedCity, state: visitForm.state ? (STATE_NAMES[visitForm.state] || visitForm.state) : '', address: '' });
                            setShowQuickAdd(true);
                            setOvernightResults([]);
                          }}
                            className="w-full p-2.5 text-left border-t border-gray-200 hover:bg-amber-50 transition flex items-center gap-2">
                            <span className="text-amber-500 font-bold text-sm">{'\u2795'}</span>
                            <span className="text-sm text-amber-700 font-medium">Add '{overnightSearch}' as a new location</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Quick feedback flags (overnight only) */}
              {stayType === 'overnight' && selectedOvernight && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quick feedback (tap all that apply)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'flagRVFriendly', label: 'RV-friendly', emoji: '\u2705' },
                      { key: 'flagFeltSafe', label: 'Felt safe', emoji: '\u2705' },
                      { key: 'flagBigRigOK', label: 'Big rig OK', emoji: '\u2705' },
                      { key: 'flagTightLot', label: 'Tight lot', emoji: '\u26A0\uFE0F' },
                      { key: 'flagHasShowers', label: 'Showers', emoji: '\u{1F6BF}' },
                      { key: 'flagHasElectric', label: 'Electric', emoji: '\u{1F50C}' },
                      { key: 'flagWellLit', label: 'Well-lit', emoji: '\u{1F4A1}' },
                    ].map(flag => (
                      <button key={flag.key} type="button"
                        onClick={() => setOvernightFlags(prev => ({ ...prev, [flag.key]: !prev[flag.key] }))}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition ${overnightFlags[flag.key] ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600'}`}>
                        {flag.emoji} {flag.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={visitForm.notes} onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} rows={3} className="input"
                  placeholder={stayType === 'overnight' ? 'Any tips for other RVers stopping here?' : 'Share details about your trip...'} />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{'\u{1F4F8}'} Photos</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {visitPhotoPreview.map((url, i) => (
                    <div key={i} className="relative w-16 h-16">
                      <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button type="button" onClick={() => { setVisitPhotos(p => p.filter((_, idx) => idx !== i)); setVisitPhotoPreview(p => p.filter((_, idx) => idx !== i)); }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">{'\u00D7'}</button>
                    </div>
                  ))}
                  {visitPhotos.length < 5 && (
                    <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-amber-400 transition">
                      <span className="text-gray-400 text-xl">+</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                        const files = Array.from(e.target.files || []).slice(0, 5 - visitPhotos.length);
                        setVisitPhotos(prev => [...prev, ...files]);
                        files.forEach(f => {
                          const reader = new FileReader();
                          reader.onload = (ev) => setVisitPhotoPreview(prev => [...prev, ev.target?.result as string]);
                          reader.readAsDataURL(f);
                        });
                        e.target.value = '';
                      }} />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">Up to 5 photos</p>
              </div>

              {/* URL Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{'\u{1F517}'} Link (optional)</label>
                <input type="url" value={visitLinkUrl} onChange={(e) => setVisitLinkUrl(e.target.value)}
                  placeholder="https://campground-website.com or blog post URL"
                  className="input" />
              </div>

              {/* Geolocation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{'\u{1F4CD}'} Location</label>
                {geoCoords ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-green-600 text-sm">{'\u2705'}</span>
                    <span className="text-xs text-green-700">Location set: {geoCoords.lat.toFixed(4)}, {geoCoords.lng.toFixed(4)}</span>
                    <button type="button" onClick={() => setGeoCoords(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => {
                    if (!navigator.geolocation) { alert('Geolocation not supported by your browser'); return; }
                    setGeoLoading(true);
                    navigator.geolocation.getCurrentPosition(
                      (pos) => { setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoLoading(false); },
                      (err) => { alert('Could not get location: ' + err.message); setGeoLoading(false); },
                      { enableHighAccuracy: true, timeout: 10000 }
                    );
                  }}
                    disabled={geoLoading}
                    className="w-full py-2 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition flex items-center justify-center gap-2">
                    {geoLoading ? (
                      <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Getting location...</>
                    ) : (
                      <>{'\u{1F4CD}'} Use my current location</>
                    )}
                  </button>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="flex-1 py-2.5 rounded-xl text-white font-semibold transition hover:brightness-110" style={{ background: '#E8622A' }}>
                  {editingVisit ? 'Save Changes' : 'Add Visit'}
                </button>
                <button type="button" onClick={() => { setShowAddVisitModal(false); setEditingVisit(null); setStayType('camping'); setSelectedOvernight(null); }}
                  className="px-4 py-2.5 rounded-xl font-semibold transition" style={{ border: '1px solid #1B2B4B', color: '#1B2B4B' }}>
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
