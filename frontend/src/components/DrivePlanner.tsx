import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, 
  MapPin, Navigation, Fuel, Coffee, Clock, DollarSign, 
  Plus, X, Route, Truck, ChevronDown, ChevronUp,
  AlertCircle, Check, Loader2, Save, Share2, Eye, EyeOff,
  Users, Globe, Lock, Calendar, Tent, List, Map as MapIcon,
  ChevronRight, Copy, MessageSquare, ArrowRight
} from 'lucide-react';
import api from '../services/api';
import { decode } from '@here/flexpolyline';
import { useAuth } from '../contexts/AuthContext';

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface RouteStop {
  id: string;
  type: 'gas' | 'rest' | 'waypoint';
  name: string;
  lat: number;
  lng: number;
  address?: string;
  brand?: string;
  amenities?: string[];
  addedToRoute: boolean;
  distanceFromStart?: number;
}

interface RouteInfo {
  distance: number;
  duration: number;
  polyline: string;
  instructions?: RouteInstruction[];
}

interface RouteInstruction {
  instruction: string;
  distance: number;
  duration: number;
  action: string;
}

interface FuelEstimate {
  distanceMiles: number;
  gallonsNeeded: number;
  avgPricePerGallon: number;
  estimatedCost: number;
}

interface AutocompleteItem {
  id: string;
  title: string;
  address: { label: string };
  position?: { lat: number; lng: number };
}

interface Campground {
  id: string;
  name: string;
  slug: string;
  location: string;
  state: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
}

interface SavedTrip {
  id: string;
  name: string;
  description?: string;
  originAddress: string;
  originLat?: number;
  originLng?: number;
  destinationAddress: string;
  destinationLat?: number;
  destinationLng?: number;
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  visibility: string;
  plannedStartDate?: string;
  eventId?: string;
  campground?: Campground;
}

interface UserTrip {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
}

export default function DrivePlanner() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  // URL params for pre-population from Basecamp "Plan Route" button
  const urlEventId = searchParams.get('eventId');
  const urlEventTitle = searchParams.get('eventTitle');
  const urlCampgroundId = searchParams.get('campgroundId');
  const urlCampgroundName = searchParams.get('campgroundName');
  const urlCampgroundState = searchParams.get('campgroundState');
  const urlDestination = searchParams.get('destination');
  const urlStartDate = searchParams.get('startDate');
  
  // Location state
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [originSearch, setOriginSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<AutocompleteItem[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<AutocompleteItem[]>([]);
  
  // Campground selection
  const [showCampgroundPicker, setShowCampgroundPicker] = useState(false);
  const [showWishlistPicker, setShowWishlistPicker] = useState(false);
  const [showFriendsPicker, setShowFriendsPicker] = useState(false);
  const [wishlistCampgrounds, setWishlistCampgrounds] = useState<Campground[]>([]);
  const [friendsCheckins, setFriendsCheckins] = useState<any[]>([]);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [campgroundSearch, setCampgroundSearch] = useState('');
  const [campgrounds, setCampgrounds] = useState<Campground[]>([]);
  const [selectedCampground, setSelectedCampground] = useState<Campground | null>(null);
  const [loadingCampgrounds, setLoadingCampgrounds] = useState(false);
  
  // Route state
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routePoints, setRoutePoints] = useState<{lat: number; lng: number}[]>([]);
  const [waypoints, setWaypoints] = useState<Location[]>([]);
  const [stopsAlongRoute, setStopsAlongRoute] = useState<RouteStop[]>([]);
  const [fuelEstimate, setFuelEstimate] = useState<FuelEstimate | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stops' | 'directions' | 'attractions' | 'save'>('stops');
  const [showStops, setShowStops] = useState(true);
  const [stopFilter, setStopFilter] = useState<'all' | 'gas' | 'rest'>('all');
  const [maxDistance, setMaxDistance] = useState(5);
  
  // Route provider toggle
  const [routeProvider, setRouteProvider] = useState<'here' | 'google'>('here');
  const [attractionsAlongRoute, setAttractionsAlongRoute] = useState<any>({ attractions: [], restaurants: [], gasStations: [], hotels: [] });
  const [loadingAttractions, setLoadingAttractions] = useState(false);
  const [gasPrice, setGasPrice] = useState<{ price: number; diesel: number } | null>(null);
  const [mpg, setMpg] = useState(10);
  
  // Save trip state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [tripName, setTripName] = useState('');
  const [tripDescription, setTripDescription] = useState('');
  const [tripVisibility, setTripVisibility] = useState<'PRIVATE' | 'FRIENDS' | 'PUBLIC'>('PRIVATE');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [userTrips, setUserTrips] = useState<UserTrip[]>([]);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [savingTrip, setSavingTrip] = useState(false);
  
  // Refs
  const originDebounceRef = useRef<NodeJS.Timeout>();
  const destDebounceRef = useRef<NodeJS.Timeout>();
  const campgroundDebounceRef = useRef<NodeJS.Timeout>();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Load user's trips/events on mount
  useEffect(() => {
    if (user) {
      loadUserTrips();
      loadSavedTrips();
    }
  }, [user]);

  // Pre-populate origin from user's home city/state
  useEffect(() => {
    if (!user) return;
    const homeCity = (user as any).homeCity as string | undefined;
    const homeState = (user as any).homeState as string | undefined;
    if (!homeCity && !homeState) return;
    // Only set if origin hasn't been set yet
    if (origin) return;
    const homeAddress = [homeCity, homeState].filter(Boolean).join(', ');
    setOriginSearch(homeAddress);
    // Geocode it so route calculation works immediately
    api.get(`/drive-planner/geocode?q=${encodeURIComponent(homeAddress)}`)
      .then(({ data }) => {
        const pos = data?.items?.[0]?.position;
        if (pos?.lat && pos?.lng) {
          setOrigin({ lat: pos.lat, lng: pos.lng, address: homeAddress });
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const loadUserTrips = async () => {
    try {
      const { data } = await api.get('/events/my-events');
      setUserTrips(data);
    } catch (err) {
      console.error('Failed to load user trips:', err);
    }
  };

  const loadSavedTrips = async () => {
    try {
      const { data } = await api.get('/saved-trips/my-trips');
      setSavedTrips(data);
    } catch (err) {
      console.error('Failed to load saved trips:', err);
    }
  };

  const loadWishlist = async () => {
    if (!user) return;
    setLoadingWishlist(true);
    try {
      const { data } = await api.get('/wishlist');
      setWishlistCampgrounds(data.map((item: any) => item.campground).filter(Boolean));
    } catch (err) {
      console.error('Failed to load wishlist:', err);
    } finally {
      setLoadingWishlist(false);
    }
  };

  const loadFriendsCheckins = async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      const { data } = await api.get(`/drive-planner/users/${user.id}/friends/checkins`);
      setFriendsCheckins((data.checkIns || []).filter((c: any) => c.campground));
    } catch (err) {
      console.error('Failed to load friends check-ins:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Auto-populate from URL parameters (from Basecamp "Plan Route" button)
  useEffect(() => {
    const populateFromUrl = async () => {
      // If we have a campground ID, fetch its details and geocode
      if (urlCampgroundId) {
        try {
          // First try to get campground details from API
          const { data: campground } = await api.get(`/campgrounds/${urlCampgroundId}`);
          
          if (campground) {
            // If campground has coordinates, use them directly
            if (campground.latitude && campground.longitude) {
              const address = `${campground.name}${campground.state ? `, ${campground.state}` : ''}`;
              setDestSearch(address);
              setDestination({
                lat: campground.latitude,
                lng: campground.longitude,
                address: address,
              });
              setSelectedCampground(campground);
            } else {
              // Otherwise geocode the campground location
              const locationQuery = campground.location || `${campground.name}, ${campground.state}`;
              const { data: geoData } = await api.get(`/drive-planner/geocode?q=${encodeURIComponent(locationQuery)}`);
              
              if (geoData.items && geoData.items.length > 0) {
                const pos = geoData.items[0].position;
                const address = `${campground.name}${campground.state ? `, ${campground.state}` : ''}`;
                setDestSearch(address);
                setDestination({
                  lat: pos.lat,
                  lng: pos.lng,
                  address: address,
                });
                setSelectedCampground(campground);
              }
            }
          }
        } catch (err) {
          console.error('Failed to fetch campground:', err);
          // Fallback: try geocoding with name and state from URL params
          if (urlCampgroundName) {
            const fallbackQuery = `${urlCampgroundName}${urlCampgroundState ? `, ${urlCampgroundState}` : ''}`;
            try {
              const { data: geoData } = await api.get(`/drive-planner/geocode?q=${encodeURIComponent(fallbackQuery)}`);
              if (geoData.items && geoData.items.length > 0) {
                const pos = geoData.items[0].position;
                setDestSearch(fallbackQuery);
                setDestination({
                  lat: pos.lat,
                  lng: pos.lng,
                  address: fallbackQuery,
                });
              }
            } catch (geoErr) {
              console.error('Fallback geocoding failed:', geoErr);
            }
          }
        }
      } 
      // If we just have a destination string (no campground ID)
      else if (urlDestination) {
        setDestSearch(urlDestination);
        try {
          const { data } = await api.get(`/drive-planner/geocode?q=${encodeURIComponent(urlDestination)}`);
          if (data.items && data.items.length > 0) {
            const pos = data.items[0].position;
            setDestination({
              lat: pos.lat,
              lng: pos.lng,
              address: urlDestination,
            });
          }
        } catch (err) {
          console.error('Failed to geocode destination:', err);
        }
      }
      // If we have campground name but no ID (fallback)
      else if (urlCampgroundName) {
        const query = `${urlCampgroundName}${urlCampgroundState ? `, ${urlCampgroundState}` : ''}`;
        setDestSearch(query);
        try {
          const { data } = await api.get(`/drive-planner/geocode?q=${encodeURIComponent(query)}`);
          if (data.items && data.items.length > 0) {
            const pos = data.items[0].position;
            setDestination({
              lat: pos.lat,
              lng: pos.lng,
              address: query,
            });
          }
        } catch (err) {
          console.error('Failed to geocode campground name:', err);
        }
      }
      
      // Pre-select the event if provided
      if (urlEventId) {
        setSelectedEventId(urlEventId);
      }
      
      // Pre-fill trip name
      if (urlEventTitle) {
        setTripName(`Route to ${urlEventTitle}`);
      } else if (urlCampgroundName) {
        setTripName(`Route to ${urlCampgroundName}`);
      }
      
      // Pre-fill start date
      if (urlStartDate) {
        const date = new Date(urlStartDate);
        setPlannedStartDate(date.toISOString().split('T')[0]);
      }
    };
    
    populateFromUrl();
  }, [urlCampgroundId, urlCampgroundName, urlCampgroundState, urlDestination, urlEventId, urlEventTitle, urlStartDate]);

  // Autocomplete search
  const searchAutocomplete = useCallback(async (query: string, type: 'origin' | 'dest') => {
    if (query.length < 3) {
      type === 'origin' ? setOriginSuggestions([]) : setDestSuggestions([]);
      return;
    }

    try {
      const { data } = await api.get(`/drive-planner/autocomplete?q=${encodeURIComponent(query)}`);
      const items = data.items || [];
      type === 'origin' ? setOriginSuggestions(items) : setDestSuggestions(items);
    } catch (err) {
      console.error('Autocomplete error:', err);
    }
  }, []);

  // Search campgrounds
  const searchCampgrounds = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCampgrounds([]);
      return;
    }

    setLoadingCampgrounds(true);
    try {
      const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(query)}&limit=10`);
      setCampgrounds(data.campgrounds || data || []);
    } catch (err) {
      console.error('Campground search error:', err);
    } finally {
      setLoadingCampgrounds(false);
    }
  }, []);

  // Debounced handlers
  const handleOriginChange = (value: string) => {
    setOriginSearch(value);
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    originDebounceRef.current = setTimeout(() => searchAutocomplete(value, 'origin'), 300);
  };

  const handleDestChange = (value: string) => {
    setDestSearch(value);
    setSelectedCampground(null);
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    destDebounceRef.current = setTimeout(() => searchAutocomplete(value, 'dest'), 300);
  };

  const handleCampgroundSearch = (value: string) => {
    setCampgroundSearch(value);
    if (campgroundDebounceRef.current) clearTimeout(campgroundDebounceRef.current);
    campgroundDebounceRef.current = setTimeout(() => searchCampgrounds(value), 300);
  };

  // Select location from autocomplete
  const selectLocation = async (item: AutocompleteItem, type: 'origin' | 'dest') => {
    try {
      const { data } = await api.get(`/drive-planner/geocode?q=${encodeURIComponent(item.address.label)}`);
      
      if (data.items && data.items.length > 0) {
        const pos = data.items[0].position;
        const location: Location = {
          lat: pos.lat,
          lng: pos.lng,
          address: item.address.label,
        };

        if (type === 'origin') {
          setOrigin(location);
          setOriginSearch(item.title);
          setOriginSuggestions([]);
        } else {
          setDestination(location);
          setDestSearch(item.title);
          setDestSuggestions([]);
          setSelectedCampground(null);
        }
      }
    } catch (err) {
      console.error('Geocode error:', err);
    }
  };

  // Select campground as destination
  const selectCampground = async (campground: Campground) => {
    setSelectedCampground(campground);
    setShowCampgroundPicker(false);
    setCampgroundSearch('');
    setCampgrounds([]);
    
    if (campground.latitude && campground.longitude) {
      setDestination({
        lat: campground.latitude,
        lng: campground.longitude,
        address: `${campground.name}, ${campground.location}, ${campground.state}`,
      });
      setDestSearch(campground.name);
    } else {
      // Geocode if no coordinates
      try {
        const { data } = await api.get(`/drive-planner/geocode?q=${encodeURIComponent(`${campground.name}, ${campground.location}, ${campground.state}`)}`);
        if (data.items && data.items.length > 0) {
          const pos = data.items[0].position;
          setDestination({
            lat: pos.lat,
            lng: pos.lng,
            address: `${campground.name}, ${campground.location}, ${campground.state}`,
          });
          setDestSearch(campground.name);
        }
      } catch (err) {
        console.error('Campground geocode error:', err);
      }
    }
  };

  // Calculate route
  const calculateRoute = async () => {
    if (!origin || !destination) {
      setError('Please enter both origin and destination');
      return;
    }

    setLoading(true);
    setError(null);
    setAttractionsAlongRoute({ attractions: [], restaurants: [], gasStations: [], hotels: [] });

    try {
      let routeData: any;
      let points: {lat: number; lng: number}[] = [];

      if (routeProvider === 'google') {
        // Use Google Directions API
        const { data } = await api.post('/drive-planner/google-route', {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })),
        });

        setRoute({
          distance: parseFloat(data.distance.miles) * 1609.34,
          duration: data.duration.seconds,
          polyline: data.polyline,
          instructions: data.steps,
        });
        points = data.routePoints;
        setRoutePoints(points);

        // Get fuel estimate
        const { data: fuelData } = await api.post('/drive-planner/fuel-estimate', {
          distanceMeters: parseFloat(data.distance.miles) * 1609.34,
          mpg,
        });
        setFuelEstimate(fuelData);

        // Fetch gas prices for destination state
        try {
          const stateCode = urlCampgroundState || (selectedCampground as any)?.state || '';
          const { data: gasPriceData } = await api.get(`/drive-planner/gas-prices${stateCode ? `?state=${stateCode}` : ''}`);
          setGasPrice(gasPriceData);
        } catch (e) { console.error('Gas price fetch failed', e); }

      } else {
        // Use HERE Maps API (existing)
        const { data } = await api.post('/drive-planner/route', {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })),
          transportMode: 'truck',
        });

        const instructions: RouteInstruction[] = (data.route.actions || []).map((action: any) => ({
          instruction: action.instruction || action.action || 'Continue',
          distance: action.length || 0,
          duration: action.duration || 0,
          action: action.action || 'continue',
        }));

        setRoute({
          distance: data.route.summary.distance,
          duration: data.route.summary.duration,
          polyline: data.route.polyline,
          instructions,
        });

        points = decodePolyline(data.route.polyline);
        setRoutePoints(points);

        const { data: fuelData } = await api.post('/drive-planner/fuel-estimate', {
          distanceMeters: data.route.summary.distance,
          mpg,
        });
        setFuelEstimate(fuelData);
      }

      // Find truck stops and rest areas along route (existing)
      const { data: stopsData } = await api.post('/drive-planner/stops-along-route', {
        routePoints: points,
        maxDistance,
      });

      const allStops: RouteStop[] = [
        ...stopsData.gasStations.map((s: any) => ({
          id: s.id, type: 'gas' as const, name: s.name, lat: s.latitude, lng: s.longitude,
          address: `${s.city || ''}, ${s.state}`.trim().replace(/^,\s*/, ''),
          brand: s.brand, amenities: [s.hasRVParking && 'RV Parking', s.hasShowers && 'Showers',
            s.hasDumpStation && 'Dump Station', s.hasPropane && 'Propane', s.hasRestaurant && 'Restaurant'].filter(Boolean),
          addedToRoute: false,
        })),
        ...stopsData.restStops.map((s: any) => ({
          id: s.id, type: 'rest' as const, name: s.name, lat: s.latitude, lng: s.longitude,
          address: `${s.interstate || ''} - ${s.state}`,
          amenities: [s.hasRVParking && 'RV Parking', s.hasPetArea && 'Pet Area',
            s.hasWifi && 'WiFi', s.hasDumpStation && 'Dump Station'].filter(Boolean),
          addedToRoute: false,
        })),
      ];

      allStops.forEach(stop => {
        const distToOrigin = haversineDistance(origin.lat, origin.lng, stop.lat, stop.lng);
        stop.distanceFromStart = Math.round(distToOrigin * 0.621371);
      });
      allStops.sort((a, b) => (a.distanceFromStart || 0) - (b.distanceFromStart || 0));
      setStopsAlongRoute(allStops);

      // Fetch attractions along route (NEW!)
      setLoadingAttractions(true);
      try {
        const { data: attractionsData } = await api.post('/drive-planner/attractions-along-route', {
          userInterests: user?.campingInterests || [],
          routePoints: points,
          maxDistanceMiles: maxDistance,
          types: ['tourist_attraction', 'park', 'restaurant', 'lodging'],
        });
        setAttractionsAlongRoute(attractionsData);
      } catch (attErr) {
        console.error('Failed to load attractions:', attErr);
      } finally {
        setLoadingAttractions(false);
      }

      if (!tripName) {
        const destName = selectedCampground?.name || destination.address.split(',')[0];
        setTripName(`Trip to ${destName}`);
      }

    } catch (err: any) {
      console.error('Route calculation error:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to calculate route';
      setError(`Route error: ${msg} (status: ${err.response?.status || 'unknown'})`);
    } finally {
      setLoading(false);
    }
  };

  // Add stop as waypoint
  const addStopAsWaypoint = (stop: RouteStop) => {
    const newWaypoint: Location = {
      lat: stop.lat,
      lng: stop.lng,
      address: stop.name,
    };
    setWaypoints([...waypoints, newWaypoint]);
    setStopsAlongRoute(prev => 
      prev.map(s => s.id === stop.id ? { ...s, addedToRoute: true } : s)
    );
  };

  // Remove waypoint
  const removeWaypoint = (index: number) => {
    const removed = waypoints[index];
    setWaypoints(waypoints.filter((_, i) => i !== index));
    setStopsAlongRoute(prev => 
      prev.map(s => 
        s.lat === removed.lat && s.lng === removed.lng 
          ? { ...s, addedToRoute: false } 
          : s
      )
    );
  };

  // Save trip
  const saveTrip = async () => {
    if (!route || !origin || !destination) {
      setError('Please calculate a route first');
      return;
    }

    if (!tripName.trim()) {
      setError('Please enter a trip name');
      return;
    }

    setSavingTrip(true);
    try {
      const tripData = {
        name: tripName.trim(),
        description: tripDescription.trim() || null,
        originAddress: origin.address,
        originLat: origin.lat,
        originLng: origin.lng,
        destinationAddress: destination.address,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        campgroundId: selectedCampground?.id || null,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        polyline: route.polyline,
        plannedStops: waypoints.map((wp, i) => ({
          order: i,
          lat: wp.lat,
          lng: wp.lng,
          name: wp.address,
        })),
        estimatedFuelGallons: fuelEstimate?.gallonsNeeded || null,
        estimatedFuelCost: fuelEstimate?.estimatedCost || null,
        mpgUsed: mpg,
        plannedStartDate: plannedStartDate || null,
        eventId: selectedEventId || null,
        visibility: tripVisibility,
      };

      const { data } = await api.post('/saved-trips', tripData);
      
      setSavedTrips([data, ...savedTrips]);
      setShowSaveModal(false);
      setError(null);
      
      // Show success message
      alert('Trip saved successfully!');
    } catch (err: any) {
      console.error('Save trip error:', err);
      setError(err.response?.data?.error || 'Failed to save trip');
    } finally {
      setSavingTrip(false);
    }
  };

  // Delete a saved trip
  const deleteSavedTrip = async (tripId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the load trip click
    
    if (!confirm('Are you sure you want to delete this trip?')) {
      return;
    }
    
    try {
      await api.delete(`/saved-trips/${tripId}`);
      setSavedTrips(savedTrips.filter(t => t.id !== tripId));
    } catch (err: any) {
      console.error('Delete trip error:', err);
      setError(err.response?.data?.error || 'Failed to delete trip');
    }
  };

  // Load a saved trip into the planner
  const loadSavedTripData = (trip: SavedTrip) => {
    // Set origin from saved trip
    setOriginSearch(trip.originAddress);
    if (trip.originLat && trip.originLng) {
      setOrigin({
        lat: trip.originLat,
        lng: trip.originLng,
        address: trip.originAddress,
      });
    }
    
    // Set destination from saved trip
    setDestSearch(trip.destinationAddress);
    if (trip.destinationLat && trip.destinationLng) {
      setDestination({
        lat: trip.destinationLat,
        lng: trip.destinationLng,
        address: trip.destinationAddress,
      });
    }
    
    // Set other trip details
    setTripName(trip.name);
    setTripDescription(trip.description || '');
    if (trip.campground) {
      setSelectedCampground(trip.campground);
    }
    if (trip.plannedStartDate) {
      setPlannedStartDate(new Date(trip.plannedStartDate).toISOString().split('T')[0]);
    }
    if (trip.eventId) {
      setSelectedEventId(trip.eventId);
    }
    setTripVisibility(trip.visibility as 'PRIVATE' | 'FRIENDS' | 'PUBLIC');
    
    // If we have the polyline, we can display the route
    if (trip.polyline) {
      const points = decodePolyline(trip.polyline);
      setRoutePoints(points);
      setRoute({
        distance: trip.distanceMeters,
        duration: trip.durationSeconds,
        polyline: trip.polyline,
        instructions: [],
      });
    }
  };

  // Format helpers
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDistance = (meters: number): string => {
    const miles = meters / 1609.34;
    return `${Math.round(miles)} mi`;
  };

  const formatDistanceShort = (meters: number): string => {
    const miles = meters / 1609.34;
    if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`;
    return `${miles.toFixed(1)} mi`;
  };

  const filteredStops = stopsAlongRoute.filter(stop => {
    if (stopFilter === 'all') return true;
    return stop.type === stopFilter;
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Route className="w-7 h-7 text-primary-600" />
          Drive Planner
        </h1>
        <p className="text-gray-600 mt-1">
          Plan your RV trip with truck stops and rest areas along the way
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Route Planning */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Origin */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1 text-green-600" />
                  Starting Point
                </label>
                <input
                  type="text"
                  value={originSearch}
                  onChange={(e) => handleOriginChange(e.target.value)}
                  placeholder="Enter starting address..."
                  className="input"
                />
                {originSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {originSuggestions.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectLocation(item, 'origin')}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                      >
                        <p className="font-medium">{item.title}</p>
                        <p className="text-gray-500 text-xs truncate">{item.address.label}</p>
                      </button>
                    ))}
                  </div>
                )}
                {origin && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Location set
                  </p>
                )}
              </div>

              {/* Destination */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1 text-red-600" />
                  Destination
                  <button
                    onClick={() => { setShowCampgroundPicker(!showCampgroundPicker); setShowWishlistPicker(false); setShowFriendsPicker(false); }}
                    className="ml-2 text-primary-600 hover:text-primary-700 text-xs font-normal"
                  >
                    <Tent className="w-3 h-3 inline" /> Pick Campground
                  </button>
                  {user && <>
                    <button
                      onClick={() => { setShowWishlistPicker(!showWishlistPicker); setShowCampgroundPicker(false); setShowFriendsPicker(false); if (!showWishlistPicker) loadWishlist(); }}
                      className="ml-2 text-purple-600 hover:text-purple-700 text-xs font-normal"
                    >
                      🧞 Wishlist
                    </button>
                    <button
                      onClick={() => { setShowFriendsPicker(!showFriendsPicker); setShowCampgroundPicker(false); setShowWishlistPicker(false); if (!showFriendsPicker) loadFriendsCheckins(); }}
                      className="ml-2 text-green-600 hover:text-green-700 text-xs font-normal"
                    >
                      👥 Friends Here
                    </button>
                  </>}
                </label>
                
                {showCampgroundPicker ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={campgroundSearch}
                      onChange={(e) => handleCampgroundSearch(e.target.value)}
                      placeholder="Search campgrounds..."
                      className="input"
                      autoFocus
                    />
                    {loadingCampgrounds && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                    {campgrounds.length > 0 && (
                      <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                        {campgrounds.map((cg) => (
                          <button
                            key={cg.id}
                            onClick={() => selectCampground(cg)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b last:border-0"
                          >
                            {cg.imageUrl ? (
                              <img src={cg.imageUrl} alt="" className="w-12 h-12 rounded object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                                <Tent className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{cg.name}</p>
                              <p className="text-sm text-gray-500 truncate">{cg.location}, {cg.state}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setShowCampgroundPicker(false);
                        setCampgroundSearch('');
                      }}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel - enter address manually
                    </button>
                  </div>
                ) : showWishlistPicker ? (
                  <div>
                    {loadingWishlist ? (
                      <div className="flex items-center gap-2 py-3 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading wishlist...</div>
                    ) : wishlistCampgrounds.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">Your wishlist is empty.</p>
                    ) : (
                      <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                        {wishlistCampgrounds.map((cg) => (
                          <button key={cg.id} onClick={() => { selectCampground(cg); setShowWishlistPicker(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b last:border-0">
                            {cg.imageUrl ? <img src={cg.imageUrl} alt="" className="w-12 h-12 rounded object-cover" /> : <div className="w-12 h-12 rounded bg-purple-50 flex items-center justify-center"><span className="text-xl">🧞</span></div>}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{cg.name}</p>
                              <p className="text-sm text-gray-500 truncate">{cg.location}, {cg.state}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setShowWishlistPicker(false)} className="mt-2 text-xs text-gray-500 hover:text-gray-700">Cancel - enter address manually</button>
                  </div>
                ) : showFriendsPicker ? (
                  <div>
                    {loadingFriends ? (
                      <div className="flex items-center gap-2 py-3 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading friends' check-ins...</div>
                    ) : friendsCheckins.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">No friends are currently checked in anywhere.</p>
                    ) : (
                      <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                        {friendsCheckins.map((checkin: any) => (
                          <button key={checkin.id} onClick={() => { selectCampground(checkin.campground); setShowFriendsPicker(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b last:border-0">
                            {checkin.user.profilePicture ? <img src={checkin.user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700">{checkin.user.firstName?.[0]}</div>}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{checkin.campground.name}</p>
                              <p className="text-sm text-gray-500 truncate">{checkin.user.firstName} {checkin.user.lastName} is here · {checkin.campground.location}, {checkin.campground.state}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setShowFriendsPicker(false)} className="mt-2 text-xs text-gray-500 hover:text-gray-700">Cancel - enter address manually</button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={destSearch}
                      onChange={(e) => handleDestChange(e.target.value)}
                      placeholder="Enter destination or campground..."
                      className="input"
                    />
                    {destSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {destSuggestions.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => selectLocation(item, 'dest')}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                          >
                            <p className="font-medium">{item.title}</p>
                            <p className="text-gray-500 text-xs truncate">{item.address.label}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                
                {selectedCampground && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <Tent className="w-3 h-3" /> {selectedCampground.name}
                  </p>
                )}
                {destination && !selectedCampground && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Location set
                  </p>
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Search within:</label>
                <select
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value={2}>2 miles</option>
                  <option value={5}>5 miles</option>
                  <option value={10}>10 miles</option>
                  <option value={20}>20 miles</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">RV MPG:</label>
                <input
                  type="number"
                  value={mpg}
                  onChange={(e) => setMpg(parseInt(e.target.value) || 10)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  min={4}
                  max={30}
                />
              </div>
            </div>

            {/* Calculate Button */}
            <div className="flex gap-3">
              <button
                onClick={calculateRoute}
                disabled={loading || !origin || !destination}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Calculating Route...
                  </>
                ) : (
                  <>
                    <Navigation className="w-5 h-5" />
                    Plan My Trip
                  </>
                )}
              </button>
              
              {route && (
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Save Trip
                </button>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Route Summary */}
          {route && (
            <div className="bg-gradient-to-r from-primary-500 to-blue-500 text-white rounded-lg p-4">
              <h2 className="font-semibold text-lg mb-3">Trip Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <Route className="w-4 h-4" />
                    Distance
                  </div>
                  <p className="text-2xl font-bold">{formatDistance(route.distance)}</p>
                </div>
                <div className="bg-white/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <Clock className="w-4 h-4" />
                    Drive Time
                  </div>
                  <p className="text-2xl font-bold">{formatDuration(route.duration)}</p>
                </div>
                {fuelEstimate && (
                  <>
                    <div className="bg-white/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-white/80 text-sm">
                        <Fuel className="w-4 h-4" />
                        Fuel Needed
                      </div>
                      <p className="text-2xl font-bold">{fuelEstimate.gallonsNeeded} gal</p>
                    </div>
                    <div className="bg-white/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-white/80 text-sm">
                        <DollarSign className="w-4 h-4" />
                        Est. Fuel Cost
                      </div>
                      <p className="text-2xl font-bold">${fuelEstimate.estimatedCost}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Waypoints */}
              {waypoints.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <h3 className="font-medium mb-2">Planned Stops ({waypoints.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {waypoints.map((wp, index) => (
                      <div key={index} className="bg-white/20 rounded-full px-3 py-1 text-sm flex items-center gap-2">
                        <span>{index + 1}. {wp.address}</span>
                        <button
                          onClick={() => removeWaypoint(index)}
                          className="hover:text-red-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Visual Map */}
          {route && routePoints.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapIcon className="w-5 h-5 text-primary-600" />
                  Route Map
                </h3>
              </div>
              <div 
                ref={mapContainerRef}
                className="h-96 bg-gray-100 relative"
              >
                {/* Simple SVG Map Visualization */}
                <svg 
                  viewBox={getMapViewBox(routePoints, origin, destination)} 
                  className="w-full h-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Route line */}
                  <polyline
                    points={routePoints.map(p => `${p.lng},${-p.lat}`).join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="0.05"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Truck stops */}
                  {stopsAlongRoute.filter(s => s.type === 'gas').slice(0, 50).map(stop => (
                    <circle
                      key={stop.id}
                      cx={stop.lng}
                      cy={-stop.lat}
                      r="0.08"
                      fill={stop.addedToRoute ? '#16a34a' : '#f97316'}
                      stroke="#fff"
                      strokeWidth="0.02"
                    />
                  ))}
                  
                  {/* Rest stops */}
                  {stopsAlongRoute.filter(s => s.type === 'rest').slice(0, 30).map(stop => (
                    <rect
                      key={stop.id}
                      x={stop.lng - 0.06}
                      y={-stop.lat - 0.06}
                      width="0.12"
                      height="0.12"
                      fill={stop.addedToRoute ? '#16a34a' : '#0ea5e9'}
                      stroke="#fff"
                      strokeWidth="0.02"
                    />
                  ))}
                  
                  {/* Origin marker */}
                  {origin && (
                    <circle
                      cx={origin.lng}
                      cy={-origin.lat}
                      r="0.15"
                      fill="#22c55e"
                      stroke="#fff"
                      strokeWidth="0.03"
                    />
                  )}
                  
                  {/* Destination marker */}
                  {destination && (
                    <circle
                      cx={destination.lng}
                      cy={-destination.lat}
                      r="0.15"
                      fill="#ef4444"
                      stroke="#fff"
                      strokeWidth="0.03"
                    />
                  )}
                  
                  {/* Waypoint markers */}
                  {waypoints.map((wp, i) => (
                    <g key={i}>
                      <circle
                        cx={wp.lng}
                        cy={-wp.lat}
                        r="0.12"
                        fill="#8b5cf6"
                        stroke="#fff"
                        strokeWidth="0.02"
                      />
                      <text
                        x={wp.lng}
                        y={-wp.lat + 0.04}
                        fontSize="0.1"
                        fill="#fff"
                        textAnchor="middle"
                      >
                        {i + 1}
                      </text>
                    </g>
                  ))}
                </svg>
                
                {/* Map Legend */}
                <div className="absolute bottom-2 left-2 bg-white/90 rounded-lg p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Start</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>Destination</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span>Truck Stop</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-sky-500"></div>
                    <span>Rest Area</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span>Planned Stop</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs for Stops / Directions */}
          {route && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('stops')}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                    activeTab === 'stops' 
                      ? 'text-primary-600 border-b-2 border-primary-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  Stops ({stopsAlongRoute.length})
                </button>
                <button
                  onClick={() => setActiveTab('directions')}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                    activeTab === 'directions' 
                      ? 'text-primary-600 border-b-2 border-primary-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                  Directions
                </button>
                <button
                  onClick={() => setActiveTab('attractions')}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                    activeTab === 'attractions' 
                      ? 'text-primary-600 border-b-2 border-primary-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  Attractions {loadingAttractions ? '...' : `(${attractionsAlongRoute.attractions.length + attractionsAlongRoute.restaurants.length})`}
                </button>
              </div>

              {activeTab === 'stops' && (
                <>
                  {/* Filter tabs */}
                  <div className="px-4 py-2 flex gap-2 border-b bg-gray-50">
                    <button
                      onClick={() => setStopFilter('all')}
                      className={`px-3 py-1 rounded-full text-sm ${
                        stopFilter === 'all' ? 'bg-primary-500 text-white' : 'bg-white text-gray-700 border'
                      }`}
                    >
                      All ({stopsAlongRoute.length})
                    </button>
                    <button
                      onClick={() => setStopFilter('gas')}
                      className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                        stopFilter === 'gas' ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 border'
                      }`}
                    >
                      <Fuel className="w-4 h-4" />
                      Truck Stops ({stopsAlongRoute.filter(s => s.type === 'gas').length})
                    </button>
                    <button
                      onClick={() => setStopFilter('rest')}
                      className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                        stopFilter === 'rest' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 border'
                      }`}
                    >
                      <Coffee className="w-4 h-4" />
                      Rest Areas ({stopsAlongRoute.filter(s => s.type === 'rest').length})
                    </button>
                  </div>

                  {/* Stops list */}
                  <div className="max-h-96 overflow-y-auto">
                    {filteredStops.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        No stops found within {maxDistance} miles of route
                      </div>
                    ) : (
                      filteredStops.slice(0, 50).map((stop) => (
                        <div
                          key={stop.id}
                          className={`p-4 border-b border-gray-100 flex items-start gap-3 ${
                            stop.addedToRoute ? 'bg-green-50' : ''
                          }`}
                        >
                          <div className={`p-2 rounded-lg flex-shrink-0 ${
                            stop.type === 'gas' ? 'bg-orange-100' : 'bg-blue-100'
                          }`}>
                            {stop.type === 'gas' ? (
                              <Fuel className="w-5 h-5 text-orange-600" />
                            ) : (
                              <Coffee className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-gray-900">{stop.name}</p>
                                {stop.brand && stop.brand !== 'Independent' && (
                                  <p className="text-sm text-gray-600">{stop.brand}</p>
                                )}
                                <p className="text-sm text-gray-500">{stop.address}</p>
                                {stop.type === 'gas' && gasPrice && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">⛽ ~${gasPrice.price.toFixed(2)}/gal</span>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">🚛 Diesel ~${gasPrice.diesel.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                              {stop.distanceFromStart !== undefined && (
                                <span className="text-sm text-gray-500 whitespace-nowrap">
                                  ~{stop.distanceFromStart} mi
                                </span>
                              )}
                            </div>
                            {stop.amenities && stop.amenities.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {stop.amenities.map((amenity, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                                  >
                                    {amenity}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => addStopAsWaypoint(stop)}
                            disabled={stop.addedToRoute}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap flex-shrink-0 ${
                              stop.addedToRoute
                                ? 'bg-green-100 text-green-700'
                                : 'bg-primary-500 hover:bg-primary-600 text-white'
                            }`}
                          >
                            {stop.addedToRoute ? (
                              <>
                                <Check className="w-4 h-4" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                Add
                              </>
                            )}
                          </button>
                        </div>
                      ))
                    )}
                    {filteredStops.length > 50 && (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Showing 50 of {filteredStops.length} stops
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'directions' && (
                <div className="max-h-96 overflow-y-auto">
                  {route.instructions && route.instructions.length > 0 ? (
                    <div className="divide-y">
                      {/* Start */}
                      <div className="p-4 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">Start at {origin?.address}</p>
                        </div>
                      </div>
                      
                      {route.instructions.map((instr, i) => (
                        <div key={i} className="p-4 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-sm font-medium text-gray-600">
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-900">{instr.instruction}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              {formatDistanceShort(instr.distance)} · {formatDuration(instr.duration)}
                            </p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </div>
                      ))}
                      
                      {/* Destination */}
                      <div className="p-4 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">Arrive at {destination?.address}</p>
                          {selectedCampground && (
                            <p className="text-sm text-primary-600">{selectedCampground.name}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      Turn-by-turn directions not available
                    </div>
                  )}
                </div>
              )}
              {/* Attractions Tab */}
              {activeTab === 'attractions' && (
                <div className="max-h-[500px] overflow-y-auto p-4">
                  {loadingAttractions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                      <span className="ml-2 text-gray-600">Finding attractions along your route...</span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Attractions */}
                      {attractionsAlongRoute.attractions.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Camera className="w-4 h-4" /> Attractions ({attractionsAlongRoute.attractions.length})
                          </h4>
                          <div className="grid gap-3">
                            {attractionsAlongRoute.attractions.slice(0, 10).map((place: any) => (
                              <div key={place.placeId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                                {place.photo ? (
                                  <img src={place.photo} alt={place.name} className="w-16 h-16 rounded-lg object-cover" />
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Camera className="w-6 h-6 text-blue-500" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{place.name}</p>
                                  <p className="text-sm text-gray-500 truncate">{place.address}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {place.rating && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">★ {place.rating}</span>}
                                    <span className="text-xs text-gray-400">{place.distanceFromRoute} mi from route</span>
                                  </div>
                                </div>
                                <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg">
                                  <Navigation className="w-4 h-4" />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Restaurants */}
                      {attractionsAlongRoute.restaurants.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Coffee className="w-4 h-4" /> Restaurants ({attractionsAlongRoute.restaurants.length})
                          </h4>
                          <div className="grid gap-3">
                            {attractionsAlongRoute.restaurants.slice(0, 10).map((place: any) => (
                              <div key={place.placeId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                                {place.photo ? (
                                  <img src={place.photo} alt={place.name} className="w-16 h-16 rounded-lg object-cover" />
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-orange-100 flex items-center justify-center">
                                    <Coffee className="w-6 h-6 text-orange-500" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{place.name}</p>
                                  <p className="text-sm text-gray-500 truncate">{place.address}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {place.rating && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">★ {place.rating}</span>}
                                    {place.priceLevel && <span className="text-xs text-green-600">{'$'.repeat(place.priceLevel)}</span>}
                                    <span className="text-xs text-gray-400">{place.distanceFromRoute} mi</span>
                                  </div>
                                </div>
                                <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg">
                                  <Navigation className="w-4 h-4" />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hotels/Campgrounds */}
                      {attractionsAlongRoute.hotels.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Tent className="w-4 h-4" /> Lodging ({attractionsAlongRoute.hotels.length})
                          </h4>
                          <div className="grid gap-3">
                            {attractionsAlongRoute.hotels.slice(0, 5).map((place: any) => (
                              <div key={place.placeId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                                  <Tent className="w-5 h-5 text-green-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{place.name}</p>
                                  <p className="text-sm text-gray-500">{place.distanceFromRoute} mi from route</p>
                                </div>
                                <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg">
                                  <Navigation className="w-4 h-4" />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {attractionsAlongRoute.attractions.length === 0 && attractionsAlongRoute.restaurants.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                          <p>No attractions found along this route</p>
                          <p className="text-sm">Try increasing the search distance</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!route && !loading && (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Plan Your Journey</h3>
              <p className="text-gray-500">
                Enter your starting point and destination to find truck stops and rest areas along your route.
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Saved Trips */}
        <div className="space-y-6">
          {/* My Saved Trips */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Save className="w-5 h-5 text-primary-600" />
                My Saved Trips
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {savedTrips.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No saved trips yet. Plan a route and save it!
                </div>
              ) : (
                savedTrips.map((trip) => (
                  <div 
                    key={trip.id} 
                    className="p-4 border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                    onClick={() => loadSavedTripData(trip)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{trip.name}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {trip.originAddress.split(',')[0]} → {trip.destinationAddress.split(',')[0]}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{formatDistance(trip.distanceMeters)}</span>
                          <span>{formatDuration(trip.durationSeconds)}</span>
                          {trip.visibility === 'PRIVATE' && <Lock className="w-3 h-3" />}
                          {trip.visibility === 'FRIENDS' && <Users className="w-3 h-3" />}
                          {trip.visibility === 'PUBLIC' && <Globe className="w-3 h-3" />}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {trip.campground && (
                          <Tent className="w-4 h-4 text-primary-500" />
                        )}
                        <button
                          onClick={(e) => deleteSavedTrip(trip.id, e)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="Delete trip"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Link to Upcoming Trips */}
          {userTrips.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-600" />
                  My Upcoming Trips
                </h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {userTrips.slice(0, 5).map((trip) => (
                  <div key={trip.id} className="p-4 border-b last:border-0">
                    <p className="font-medium text-gray-900">{trip.title}</p>
                    <p className="text-sm text-gray-500">{trip.location}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(trip.startDate).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Trip Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Save Trip</h2>
              <button onClick={() => setShowSaveModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trip Name *</label>
                <input
                  type="text"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="e.g., Summer Road Trip to Yellowstone"
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={tripDescription}
                  onChange={(e) => setTripDescription(e.target.value)}
                  placeholder="Notes about this trip..."
                  rows={3}
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Planned Start Date</label>
                <input
                  type="date"
                  value={plannedStartDate}
                  onChange={(e) => setPlannedStartDate(e.target.value)}
                  className="input"
                />
              </div>
              
              {userTrips.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link to Existing Trip</label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="input"
                  >
                    <option value="">None - standalone trip</option>
                    {userTrips.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title} ({new Date(trip.startDate).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTripVisibility('PRIVATE')}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 ${
                      tripVisibility === 'PRIVATE' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                    }`}
                  >
                    <Lock className="w-5 h-5" />
                    <span className="text-sm">Private</span>
                  </button>
                  <button
                    onClick={() => setTripVisibility('FRIENDS')}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 ${
                      tripVisibility === 'FRIENDS' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-sm">Friends</span>
                  </button>
                  <button
                    onClick={() => setTripVisibility('PUBLIC')}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 ${
                      tripVisibility === 'PUBLIC' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                    }`}
                  >
                    <Globe className="w-5 h-5" />
                    <span className="text-sm">Public</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {tripVisibility === 'PRIVATE' && 'Only you can see this trip'}
                  {tripVisibility === 'FRIENDS' && 'Your friends can see and copy this trip'}
                  {tripVisibility === 'PUBLIC' && 'Anyone can see and copy this trip'}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveTrip}
                disabled={savingTrip || !tripName.trim()}
                className="btn btn-primary flex items-center gap-2"
              >
                {savingTrip ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Trip
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: Calculate SVG viewBox for route
function getMapViewBox(
  points: {lat: number; lng: number}[], 
  origin: Location | null, 
  destination: Location | null
): string {
  if (points.length === 0 && !origin && !destination) {
    return "-130 -50 60 30"; // Default US view
  }
  
  const allPoints = [
    ...points,
    ...(origin ? [{ lat: origin.lat, lng: origin.lng }] : []),
    ...(destination ? [{ lat: destination.lat, lng: destination.lng }] : []),
  ];
  
  const lngs = allPoints.map(p => p.lng);
  const lats = allPoints.map(p => p.lat);
  
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  
  const padding = 0.5;
  const width = (maxLng - minLng) + padding * 2;
  const height = (maxLat - minLat) + padding * 2;
  
  return `${minLng - padding} ${-(maxLat + padding)} ${width} ${height}`;
}

// Decode HERE flexible polyline
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  try {
    const decoded = decode(encoded);
    const points = decoded.polyline.map((coord: number[]) => ({
      lat: coord[0],
      lng: coord[1],
    }));
    
    const sampleRate = Math.max(1, Math.floor(points.length / 200));
    return points.filter((_: any, i: number) => i % sampleRate === 0);
  } catch (e) {
    console.error('Polyline decode error:', e);
    return [];
  }
}

// Haversine distance (km)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
