// EnhancedDrivePlanner.tsx - Full drive planning with Google + HERE routing
// Features: Route display, things to do along route, truck stops, rest areas, save itinerary

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Navigation, MapPin, Clock, Fuel, Coffee, Camera, 
  ChevronDown, ChevronUp, Plus, X, Save, Share2,
  Loader2, AlertCircle, Route, Utensils, ShoppingBag,
  Mountain, Building, Star, Filter, RotateCcw
} from 'lucide-react';

interface RoutePoint {
  lat: number;
  lng: number;
}

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  rating?: number;
  totalRatings?: number;
  types: string[];
  location: { lat: number; lng: number };
  photos?: string[];
  priceLevel?: number;
  isOpen?: boolean;
  distanceFromRoute?: number;
}

interface TruckStop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  amenities?: string[];
  distanceFromRoute?: number;
}

interface Waypoint {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  type: 'attraction' | 'truck_stop' | 'rest_area' | 'custom';
  duration?: number; // minutes to stay
  arrivalTime?: string;
}

interface RouteInfo {
  distance: string;
  duration: string;
  durationInTraffic?: string;
  polyline: string;
  legs: Array<{
    distance: string;
    duration: string;
    startAddress: string;
    endAddress: string;
  }>;
}

type RouteProvider = 'google' | 'here';
type AttractionCategory = 'restaurant' | 'attraction' | 'gas_station' | 'shopping' | 'outdoor';

const ATTRACTION_CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: Utensils, types: ['restaurant', 'cafe', 'bakery'] },
  { id: 'attraction', label: 'Attractions', icon: Camera, types: ['tourist_attraction', 'museum', 'amusement_park'] },
  { id: 'gas_station', label: 'Gas Stations', icon: Fuel, types: ['gas_station'] },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, types: ['shopping_mall', 'store'] },
  { id: 'outdoor', label: 'Outdoors', icon: Mountain, types: ['park', 'campground', 'natural_feature'] },
];

const EnhancedDrivePlanner: React.FC = () => {
  const [searchParams] = useSearchParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Form state
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState<RoutePoint | null>(null);
  const [destCoords, setDestCoords] = useState<RoutePoint | null>(null);

  // Route state
  const [routeProvider, setRouteProvider] = useState<RouteProvider>('google');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Waypoints & attractions
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [attractions, setAttractions] = useState<PlaceResult[]>([]);
  const [truckStops, setTruckStops] = useState<TruckStop[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<AttractionCategory[]>(['restaurant', 'attraction']);
  const [loadingAttractions, setLoadingAttractions] = useState(false);
  const [showAttractions, setShowAttractions] = useState(false);

  // RV settings
  const [vehicleHeight, setVehicleHeight] = useState('13.5'); // feet
  const [vehicleWeight, setVehicleWeight] = useState('26000'); // lbs
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);

  // Trip saving
  const [tripName, setTripName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Campsite picker
  const [showCampsitePicker, setShowCampsitePicker] = useState(false);
  const [campsiteSearch, setCampsiteSearch] = useState('');
  const [campsiteResults, setCampsiteResults] = useState<Array<{id: string; name: string; state: string; latitude: number; longitude: number}>>([]);
  const [loadingCampsites, setLoadingCampsites] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      mapTypeId: 'roadmap',
      mapTypeControl: true,
      streetViewControl: false,
    });

    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map: googleMapRef.current,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#059669',
        strokeWeight: 5,
        strokeOpacity: 0.8,
      },
    });

    // Initialize autocomplete
    initAutocomplete();

    // Check for destination from URL params
    const destId = searchParams.get('destination');
    if (destId) {
      loadCampgroundDestination(destId);
    }
  }, []);

  // Initialize Google Places Autocomplete
  const initAutocomplete = () => {
    const originInput = document.getElementById('origin-input') as HTMLInputElement;
    const destInput = document.getElementById('destination-input') as HTMLInputElement;

    if (originInput && window.google?.maps?.places) {
      const originAutocomplete = new google.maps.places.Autocomplete(originInput, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'us' },
      });

      originAutocomplete.addListener('place_changed', () => {
        const place = originAutocomplete.getPlace();
        if (place.geometry?.location) {
          setOrigin(place.formatted_address || place.name || '');
          setOriginCoords({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    }

    if (destInput && window.google?.maps?.places) {
      const destAutocomplete = new google.maps.places.Autocomplete(destInput, {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: 'us' },
      });

      destAutocomplete.addListener('place_changed', () => {
        const place = destAutocomplete.getPlace();
        if (place.geometry?.location) {
          setDestination(place.formatted_address || place.name || '');
          setDestCoords({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    }
  };

  // Load campground as destination
  const loadCampgroundDestination = async (campgroundId: string) => {
    try {
      const response = await fetch(`/api/campgrounds/${campgroundId}`);
      if (response.ok) {
        const campground = await response.json();
        setDestination(campground.name);
        setDestCoords({
          lat: campground.latitude,
          lng: campground.longitude,
        });
      }
    } catch (error) {
      console.error('Error loading campground:', error);
    }
  };

  // Use current location as origin
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setOriginCoords({ lat: latitude, lng: longitude });

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `/api/drive-planner/geocode/reverse?lat=${latitude}&lng=${longitude}`
          );
          if (response.ok) {
            const data = await response.json();
            setOrigin(data.address || 'Current Location');
          } else {
            setOrigin('Current Location');
          }
        } catch {
          setOrigin('Current Location');
        }
      },
      (error) => {
        setError('Unable to get your location. Please enter it manually.');
      }
    );
  };

  // Search campsites
  const searchCampsites = async (query: string) => {
    if (query.length < 2) {
      setCampsiteResults([]);
      return;
    }
    setLoadingCampsites(true);
    try {
      const response = await fetch("/api/campgrounds?search=" + encodeURIComponent(query) + "&limit=10");
      if (response.ok) {
        const data = await response.json();
        setCampsiteResults(data.campgrounds || data || []);
      }
    } catch (err) {
      console.error('Campsite search error:', err);
    } finally {
      setLoadingCampsites(false);
    }
  };

  // Select campsite as destination
  const selectCampsite = (campsite: {id: string; name: string; state: string; latitude: number; longitude: number}) => {
    setDestination(campsite.name + ", " + campsite.state);
    setDestCoords({ lat: campsite.latitude, lng: campsite.longitude });
    setShowCampsitePicker(false);
    setCampsiteSearch('');
    setCampsiteResults([]);
  };

  // Calculate route
  const calculateRoute = async () => {
    if (!originCoords || !destCoords) {
      setError('Please enter both origin and destination');
      return;
    }

    setLoading(true);
    setError(null);
    clearMarkers();

    try {
      if (routeProvider === 'google') {
        await calculateGoogleRoute();
      } else {
        await calculateHereRoute();
      }
    } catch (err: any) {
      setError(err.message || 'Error calculating route');
    } finally {
      setLoading(false);
    }
  };

  // Google Directions API
  const calculateGoogleRoute = async () => {
    const waypointLocations = waypoints.map(wp => ({
      location: new google.maps.LatLng(wp.location.lat, wp.location.lng),
      stopover: true,
    }));

    const directionsService = new google.maps.DirectionsService();
    
    const request: google.maps.DirectionsRequest = {
      origin: new google.maps.LatLng(originCoords!.lat, originCoords!.lng),
      destination: new google.maps.LatLng(destCoords!.lat, destCoords!.lng),
      waypoints: waypointLocations,
      optimizeWaypoints: waypoints.length > 1,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS,
      },
      avoidTolls,
      avoidHighways,
    };

    const result = await directionsService.route(request);
    
    if (result.routes.length > 0) {
      directionsRendererRef.current?.setDirections(result);
      
      const route = result.routes[0];
      const legs = route.legs;
      
      // Calculate totals
      let totalDistance = 0;
      let totalDuration = 0;
      let totalDurationInTraffic = 0;

      legs.forEach(leg => {
        totalDistance += leg.distance?.value || 0;
        totalDuration += leg.duration?.value || 0;
        totalDurationInTraffic += leg.duration_in_traffic?.value || totalDuration;
      });

      // Extract route points for finding attractions
      const points: RoutePoint[] = [];
      route.overview_path.forEach(point => {
        points.push({ lat: point.lat(), lng: point.lng() });
      });
      setRoutePoints(points);

      setRouteInfo({
        distance: `${(totalDistance / 1609.34).toFixed(1)} miles`,
        duration: formatDuration(totalDuration),
        durationInTraffic: formatDuration(totalDurationInTraffic),
        polyline: route.overview_polyline || '',
        legs: legs.map(leg => ({
          distance: leg.distance?.text || '',
          duration: leg.duration?.text || '',
          startAddress: leg.start_address || '',
          endAddress: leg.end_address || '',
        })),
      });

      // Fetch attractions and truck stops
      await Promise.all([
        fetchAttractionsAlongRoute(points),
        fetchTruckStopsAlongRoute(points),
      ]);
    }
  };

  // HERE Maps API (RV-optimized routing)
  const calculateHereRoute = async () => {
    const waypointParams = waypoints
      .map(wp => `${wp.location.lat},${wp.location.lng}`)
      .join('&via=');

    const params = new URLSearchParams({
      origin: `${originCoords!.lat},${originCoords!.lng}`,
      destination: `${destCoords!.lat},${destCoords!.lng}`,
      vehicleHeight,
      vehicleWeight,
      avoidTolls: avoidTolls.toString(),
      avoidHighways: avoidHighways.toString(),
    });

    if (waypointParams) {
      params.append('waypoints', waypointParams);
    }

    const response = await fetch(`/api/drive-planner/route/here?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to calculate route with HERE Maps');
    }

    const data = await response.json();
    
    // Decode HERE polyline and display on Google Map
    const points = decodeHerePolyline(data.polyline);
    setRoutePoints(points);

    // Clear Google directions and draw custom polyline
    directionsRendererRef.current?.setDirections({ routes: [] });
    
    const polyline = new google.maps.Polyline({
      path: points,
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeWeight: 5,
      strokeOpacity: 0.8,
    });
    polyline.setMap(googleMapRef.current);

    // Add markers for origin and destination
    addMarker(originCoords!, 'A', '#059669');
    addMarker(destCoords!, 'B', '#ef4444');

    // Fit bounds
    const bounds = new google.maps.LatLngBounds();
    points.forEach(point => bounds.extend(point));
    googleMapRef.current?.fitBounds(bounds);

    setRouteInfo({
      distance: `${(data.distance / 1609.34).toFixed(1)} miles`,
      duration: formatDuration(data.duration),
      polyline: data.polyline,
      legs: data.legs || [],
    });

    // Fetch attractions and truck stops
    await Promise.all([
      fetchAttractionsAlongRoute(points),
      fetchTruckStopsAlongRoute(points),
    ]);
  };

  // Decode HERE polyline
  const decodeHerePolyline = (encoded: string): RoutePoint[] => {
    // HERE uses flexible polyline encoding
    // This is a simplified decoder - use @here/flexpolyline for production
    const points: RoutePoint[] = [];
    let lat = 0, lng = 0;
    let index = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return points;
  };

  // Fetch attractions along route
  const fetchAttractionsAlongRoute = async (routePoints: RoutePoint[]) => {
    setLoadingAttractions(true);

    try {
      // Sample points along route (every ~50 miles)
      const samplePoints = sampleRoutePoints(routePoints, 80); // ~80km = 50 miles

      const types = selectedCategories
        .flatMap(cat => ATTRACTION_CATEGORIES.find(c => c.id === cat)?.types || []);

      const allAttractions: PlaceResult[] = [];

      for (const point of samplePoints) {
        const response = await fetch(
          `/api/things-to-do/nearby?lat=${point.lat}&lng=${point.lng}&radius=16000&types=${types.join(',')}`
        );

        if (response.ok) {
          const data = await response.json();
          allAttractions.push(...(data.places || []));
        }
      }

      // Deduplicate by place ID
      const uniqueAttractions = Array.from(
        new Map(allAttractions.map(a => [a.id, a])).values()
      );

      // Calculate distance from route for each attraction
      uniqueAttractions.forEach(attraction => {
        attraction.distanceFromRoute = calculateMinDistanceFromRoute(
          attraction.location,
          routePoints
        );
      });

      // Sort by rating and filter to closest
      const sortedAttractions = uniqueAttractions
        .filter(a => a.distanceFromRoute! < 16) // Within 10 miles
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 50);

      setAttractions(sortedAttractions);
      
      // Add markers for attractions
      sortedAttractions.forEach(attraction => {
        addAttractionMarker(attraction);
      });

    } catch (error) {
      console.error('Error fetching attractions:', error);
    } finally {
      setLoadingAttractions(false);
    }
  };

  // Fetch truck stops along route
  const fetchTruckStopsAlongRoute = async (routePoints: RoutePoint[]) => {
    try {
      // Get bounding box of route
      const bounds = getBoundingBox(routePoints);
      
      const response = await fetch(
        `/api/truck-stops?minLat=${bounds.minLat}&maxLat=${bounds.maxLat}&minLng=${bounds.minLng}&maxLng=${bounds.maxLng}`
      );

      if (response.ok) {
        const data = await response.json();
        
        // Filter to stops within 5 miles of route
        const nearbyStops = (data.truckStops || []).filter((stop: TruckStop) => {
          const distance = calculateMinDistanceFromRoute(
            { lat: stop.latitude, lng: stop.longitude },
            routePoints
          );
          stop.distanceFromRoute = distance;
          return distance < 8; // 5 miles
        });

        setTruckStops(nearbyStops.slice(0, 30));

        // Add markers
        nearbyStops.slice(0, 30).forEach((stop: TruckStop) => {
          addTruckStopMarker(stop);
        });
      }
    } catch (error) {
      console.error('Error fetching truck stops:', error);
    }
  };

  // Sample points along route
  const sampleRoutePoints = (points: RoutePoint[], intervalKm: number): RoutePoint[] => {
    const sampled: RoutePoint[] = [points[0]];
    let accumulated = 0;

    for (let i = 1; i < points.length; i++) {
      const dist = haversineDistance(
        points[i - 1].lat, points[i - 1].lng,
        points[i].lat, points[i].lng
      );
      accumulated += dist;

      if (accumulated >= intervalKm) {
        sampled.push(points[i]);
        accumulated = 0;
      }
    }

    // Always include the last point
    if (sampled[sampled.length - 1] !== points[points.length - 1]) {
      sampled.push(points[points.length - 1]);
    }

    return sampled;
  };

  // Haversine distance in km
  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Calculate minimum distance from route
  const calculateMinDistanceFromRoute = (
    point: { lat: number; lng: number },
    routePoints: RoutePoint[]
  ): number => {
    let minDistance = Infinity;

    // Sample every 10th point for performance
    for (let i = 0; i < routePoints.length; i += 10) {
      const distance = haversineDistance(
        point.lat, point.lng,
        routePoints[i].lat, routePoints[i].lng
      );
      if (distance < minDistance) minDistance = distance;
    }

    return minDistance * 0.621371; // Convert to miles
  };

  // Get bounding box of route
  const getBoundingBox = (points: RoutePoint[]) => {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    points.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    // Add 0.5 degree padding (~35 miles)
    return {
      minLat: minLat - 0.1,
      maxLat: maxLat + 0.1,
      minLng: minLng - 0.1,
      maxLng: maxLng + 0.1,
    };
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${minutes} min`;
    return `${hours}h ${minutes}m`;
  };

  // Add marker to map
  const addMarker = (position: RoutePoint, label: string, color: string) => {
    if (!googleMapRef.current) return;

    const marker = new google.maps.Marker({
      position,
      map: googleMapRef.current,
      label: {
        text: label,
        color: 'white',
        fontWeight: 'bold',
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
        scale: 15,
      },
    });

    markersRef.current.push(marker);
  };

  // Add attraction marker
  const addAttractionMarker = (attraction: PlaceResult) => {
    if (!googleMapRef.current) return;

    const marker = new google.maps.Marker({
      position: attraction.location,
      map: googleMapRef.current,
      icon: {
        url: `data:image/svg+xml,${encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#f59e0b" stroke="white" stroke-width="2"/>
            <text x="12" y="16" text-anchor="middle" font-size="12" fill="white">★</text>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(24, 24),
      },
      title: attraction.name,
    });

    marker.addListener('click', () => {
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px;">
            <h4 style="margin: 0 0 4px 0; font-size: 14px;">${attraction.name}</h4>
            ${attraction.rating ? `<p style="margin: 0; color: #f59e0b;">★ ${attraction.rating} (${attraction.totalRatings})</p>` : ''}
            <p style="margin: 4px 0; color: #666; font-size: 12px;">${attraction.distanceFromRoute?.toFixed(1)} mi from route</p>
            <button onclick="window.addWaypoint('${attraction.id}', '${attraction.name.replace(/'/g, "\\'")}', ${attraction.location.lat}, ${attraction.location.lng})" 
              style="margin-top: 8px; padding: 6px 12px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Add Stop
            </button>
          </div>
        `,
      });
      infoWindow.open(googleMapRef.current, marker);
    });

    markersRef.current.push(marker);
  };

  // Add truck stop marker
  const addTruckStopMarker = (stop: TruckStop) => {
    if (!googleMapRef.current) return;

    const marker = new google.maps.Marker({
      position: { lat: stop.latitude, lng: stop.longitude },
      map: googleMapRef.current,
      icon: {
        url: `data:image/svg+xml,${encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="2"/>
            <text x="12" y="16" text-anchor="middle" font-size="10" fill="white">⛽</text>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(24, 24),
      },
      title: stop.name,
    });

    marker.addListener('click', () => {
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px;">
            <h4 style="margin: 0 0 4px 0; font-size: 14px;">⛽ ${stop.name}</h4>
            <p style="margin: 4px 0; color: #666; font-size: 12px;">${stop.distanceFromRoute?.toFixed(1)} mi from route</p>
            ${stop.amenities?.length ? `<p style="margin: 4px 0; color: #666; font-size: 11px;">${stop.amenities.slice(0, 3).join(', ')}</p>` : ''}
            <button onclick="window.addWaypoint('truck-${stop.id}', '${stop.name.replace(/'/g, "\\'")}', ${stop.latitude}, ${stop.longitude})" 
              style="margin-top: 8px; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Add Stop
            </button>
          </div>
        `,
      });
      infoWindow.open(googleMapRef.current, marker);
    });

    markersRef.current.push(marker);
  };

  // Global function for adding waypoint from info window
  useEffect(() => {
    (window as any).addWaypoint = (id: string, name: string, lat: number, lng: number) => {
      addWaypoint({
        id,
        name,
        location: { lat, lng },
        type: id.startsWith('truck-') ? 'truck_stop' : 'attraction',
        duration: 30,
      });
    };

    return () => {
      delete (window as any).addWaypoint;
    };
  }, [waypoints]);

  // Clear markers
  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  // Add waypoint
  const addWaypoint = (waypoint: Waypoint) => {
    if (waypoints.some(wp => wp.id === waypoint.id)) return;
    setWaypoints(prev => [...prev, waypoint]);
  };

  // Remove waypoint
  const removeWaypoint = (id: string) => {
    setWaypoints(prev => prev.filter(wp => wp.id !== id));
  };

  // Recalculate route with waypoints
  useEffect(() => {
    if (routeInfo && waypoints.length > 0) {
      calculateRoute();
    }
  }, [waypoints.length]);

  // Save trip
  const saveTrip = async () => {
    if (!tripName || !routeInfo) return;

    try {
      const response = await fetch('/api/trips/from-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tripName,
          origin,
          destination,
          originCoords,
          destCoords,
          waypoints,
          routeInfo,
        }),
      });

      if (response.ok) {
        const trip = await response.json();
        setShowSaveModal(false);
        // Navigate to trip page
        window.location.href = `/trips/${trip.id}`;
      }
    } catch (error) {
      console.error('Error saving trip:', error);
    }
  };

  // Toggle category filter
  const toggleCategory = (category: AttractionCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <div className="drive-planner">
      {/* Header */}
      <div className="planner-header">
        <h1><Route size={28} /> Drive Planner</h1>
        <p>Plan your RV-friendly route with stops along the way</p>
      </div>

      <div className="planner-content">
        {/* Sidebar */}
        <div className="planner-sidebar">
          {/* Route Form */}
          <div className="route-form">
            <div className="form-group">
              <label>From</label>
              <div className="input-with-button">
                <input
                  id="origin-input"
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Enter starting location"
                />
                <button 
                  className="location-btn"
                  onClick={useCurrentLocation}
                  title="Use current location"
                >
                  <Navigation size={18} />
                </button>
              </div>
            </div>

            <div className="form-group" style={{position: 'relative'}}>
              <label>To</label>
              <div style={{display: 'flex', gap: '8px'}}>
                <input
                  id="destination-input"
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Enter destination or campground"
                  style={{flex: 1}}
                />
                <button 
                  type="button"
                  onClick={() => setShowCampsitePicker(!showCampsitePicker)}
                  title="Pick a campsite"
                  style={{padding: '8px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}}
                >
                  <MapPin size={18} />
                </button>
              </div>
              
              {showCampsitePicker && (
                <div style={{position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000, marginTop: '4px', maxHeight: '300px', overflowY: 'auto'}}>
                  <input
                    type="text"
                    value={campsiteSearch}
                    onChange={(e) => {
                      setCampsiteSearch(e.target.value);
                      searchCampsites(e.target.value);
                    }}
                    placeholder="Search campgrounds..."
                    autoFocus
                    style={{width: '100%', padding: '12px', border: 'none', borderBottom: '1px solid #e5e7eb', fontSize: '14px'}}
                  />
                  {loadingCampsites && <div style={{padding: '12px', color: '#6b7280', textAlign: 'center'}}>Searching...</div>}
                  {campsiteResults.length > 0 && (
                    <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                      {campsiteResults.map((campsite) => (
                        <li key={campsite.id} onClick={() => selectCampsite(campsite)} style={{padding: '12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6'}}>
                          <div style={{fontWeight: 'bold', color: '#111827', fontSize: '14px'}}>{campsite.name}</div>
                          <div style={{color: '#6b7280', fontSize: '12px', marginTop: '2px'}}>{campsite.state}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {campsiteSearch.length >= 2 && !loadingCampsites && campsiteResults.length === 0 && (
                    <div style={{padding: '12px', color: '#6b7280', textAlign: 'center'}}>No campgrounds found</div>
                  )}
                </div>
              )}
            </div>

            {/* Route Provider Toggle */}
            <div className="provider-toggle">
              <button
                className={routeProvider === 'google' ? 'active' : ''}
                onClick={() => setRouteProvider('google')}
              >
                Google (Traffic)
              </button>
              <button
                className={routeProvider === 'here' ? 'active' : ''}
                onClick={() => setRouteProvider('here')}
              >
                HERE (RV-Safe)
              </button>
            </div>

            {/* RV Settings (for HERE) */}
            {routeProvider === 'here' && (
              <div className="rv-settings">
                <h4>RV Settings</h4>
                <div className="settings-row">
                  <div className="setting">
                    <label>Height (ft)</label>
                    <input
                      type="number"
                      value={vehicleHeight}
                      onChange={(e) => setVehicleHeight(e.target.value)}
                    />
                  </div>
                  <div className="setting">
                    <label>Weight (lbs)</label>
                    <input
                      type="number"
                      value={vehicleWeight}
                      onChange={(e) => setVehicleWeight(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Route Options */}
            <div className="route-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={avoidTolls}
                  onChange={(e) => setAvoidTolls(e.target.checked)}
                />
                Avoid Tolls
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={avoidHighways}
                  onChange={(e) => setAvoidHighways(e.target.checked)}
                />
                Avoid Highways
              </label>
            </div>

            <button
              className="calculate-btn"
              onClick={calculateRoute}
              disabled={loading || !origin || !destination}
            >
              {loading ? <Loader2 className="spin" size={20} /> : <Route size={20} />}
              {loading ? 'Calculating...' : 'Calculate Route'}
            </button>

            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>

          {/* Route Info */}
          {routeInfo && (
            <div className="route-info">
              <h3>Route Summary</h3>
              <div className="info-grid">
                <div className="info-item">
                  <MapPin size={18} />
                  <span>{routeInfo.distance}</span>
                </div>
                <div className="info-item">
                  <Clock size={18} />
                  <span>{routeInfo.duration}</span>
                </div>
                {routeInfo.durationInTraffic && routeInfo.durationInTraffic !== routeInfo.duration && (
                  <div className="info-item traffic">
                    <Clock size={18} />
                    <span>{routeInfo.durationInTraffic} (traffic)</span>
                  </div>
                )}
              </div>

              <div className="route-actions">
                <button onClick={() => setShowSaveModal(true)}>
                  <Save size={16} /> Save Trip
                </button>
                <button onClick={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&origin=${originCoords?.lat},${originCoords?.lng}&destination=${destCoords?.lat},${destCoords?.lng}`;
                  window.open(url, '_blank');
                }}>
                  <Share2 size={16} /> Open in Maps
                </button>
              </div>
            </div>
          )}

          {/* Waypoints */}
          {waypoints.length > 0 && (
            <div className="waypoints-list">
              <h3>Stops ({waypoints.length})</h3>
              {waypoints.map((wp, index) => (
                <div key={wp.id} className="waypoint-item">
                  <div className="waypoint-number">{index + 1}</div>
                  <div className="waypoint-info">
                    <span className="waypoint-name">{wp.name}</span>
                    <span className="waypoint-duration">{wp.duration} min stop</span>
                  </div>
                  <button 
                    className="remove-waypoint"
                    onClick={() => removeWaypoint(wp.id)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="map-container">
          <div ref={mapRef} className="google-map" />

          {/* Attractions Panel */}
          {routeInfo && (
            <div className={`attractions-panel ${showAttractions ? 'open' : ''}`}>
              <button 
                className="panel-toggle"
                onClick={() => setShowAttractions(!showAttractions)}
              >
                <Camera size={18} />
                Things to Do Along Route
                {showAttractions ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>

              {showAttractions && (
                <div className="panel-content">
                  {/* Category Filters */}
                  <div className="category-filters">
                    {ATTRACTION_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        className={selectedCategories.includes(cat.id as AttractionCategory) ? 'active' : ''}
                        onClick={() => toggleCategory(cat.id as AttractionCategory)}
                      >
                        <cat.icon size={14} />
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <button 
                    className="refresh-btn"
                    onClick={() => fetchAttractionsAlongRoute(routePoints)}
                    disabled={loadingAttractions}
                  >
                    {loadingAttractions ? <Loader2 className="spin" size={14} /> : <RotateCcw size={14} />}
                    Refresh
                  </button>

                  {/* Attractions List */}
                  <div className="attractions-list">
                    {loadingAttractions ? (
                      <div className="loading-attractions">
                        <Loader2 className="spin" size={24} />
                        <p>Finding attractions...</p>
                      </div>
                    ) : attractions.length === 0 ? (
                      <p className="no-attractions">No attractions found along this route</p>
                    ) : (
                      attractions.map(attraction => (
                        <div key={attraction.id} className="attraction-item">
                          <div className="attraction-info">
                            <h4>{attraction.name}</h4>
                            <div className="attraction-meta">
                              {attraction.rating && (
                                <span className="rating">
                                  <Star size={12} fill="#f59e0b" stroke="#f59e0b" />
                                  {attraction.rating}
                                </span>
                              )}
                              <span className="distance">
                                {attraction.distanceFromRoute?.toFixed(1)} mi off route
                              </span>
                            </div>
                          </div>
                          <button
                            className="add-stop-btn"
                            onClick={() => addWaypoint({
                              id: attraction.id,
                              name: attraction.name,
                              location: attraction.location,
                              type: 'attraction',
                              duration: 30,
                            })}
                            disabled={waypoints.some(wp => wp.id === attraction.id)}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Truck Stops Section */}
                  {truckStops.length > 0 && (
                    <>
                      <h4 className="section-title">
                        <Fuel size={16} /> Truck Stops & Gas
                      </h4>
                      <div className="truck-stops-list">
                        {truckStops.slice(0, 10).map(stop => (
                          <div key={stop.id} className="truck-stop-item">
                            <div className="stop-info">
                              <span className="stop-name">{stop.name}</span>
                              <span className="stop-distance">
                                {stop.distanceFromRoute?.toFixed(1)} mi off route
                              </span>
                            </div>
                            <button
                              className="add-stop-btn"
                              onClick={() => addWaypoint({
                                id: `truck-${stop.id}`,
                                name: stop.name,
                                location: { lat: stop.latitude, lng: stop.longitude },
                                type: 'truck_stop',
                                duration: 20,
                              })}
                              disabled={waypoints.some(wp => wp.id === `truck-${stop.id}`)}
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Trip Modal */}
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Save Trip</h3>
            <div className="form-group">
              <label>Trip Name</label>
              <input
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="My Road Trip"
              />
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button className="save-btn" onClick={saveTrip} disabled={!tripName}>
                <Save size={16} /> Save Trip
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .drive-planner {
          min-height: 100vh;
          background: #f8fafc;
        }

        .planner-header {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: white;
          padding: 24px 32px;
        }

        .planner-header h1 {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 0 8px 0;
          font-size: 28px;
        }

        .planner-header p {
          margin: 0;
          opacity: 0.9;
        }

        .planner-content {
          display: flex;
          height: calc(100vh - 120px);
        }

        .planner-sidebar {
          width: 380px;
          background: white;
          border-right: 1px solid #e2e8f0;
          overflow-y: auto;
          padding: 20px;
        }

        .route-form {
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 6px;
          color: #374151;
        }

        .form-group input[type="text"],
        .form-group input[type="number"] {
          width: 100%;
          padding: 12px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #059669;
        }

        .input-with-button {
          display: flex;
          gap: 8px;
        }

        .input-with-button input {
          flex: 1;
        }

        .location-btn {
          padding: 12px;
          background: #f1f5f9;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }

        .location-btn:hover {
          background: #059669;
          border-color: #059669;
          color: white;
        }

        .provider-toggle {
          display: flex;
          background: #f1f5f9;
          border-radius: 8px;
          padding: 4px;
          margin-bottom: 16px;
        }

        .provider-toggle button {
          flex: 1;
          padding: 10px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }

        .provider-toggle button.active {
          background: white;
          color: #059669;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .rv-settings {
          background: #f8fafc;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .rv-settings h4 {
          margin: 0 0 12px 0;
          font-size: 13px;
          color: #64748b;
        }

        .settings-row {
          display: flex;
          gap: 12px;
        }

        .setting {
          flex: 1;
        }

        .setting label {
          display: block;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .setting input {
          width: 100%;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }

        .route-options {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #64748b;
          cursor: pointer;
        }

        .calculate-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: #059669;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .calculate-btn:hover:not(:disabled) {
          background: #047857;
        }

        .calculate-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 10px;
          background: #fef2f2;
          color: #dc2626;
          border-radius: 8px;
          font-size: 13px;
        }

        .route-info {
          background: #f8fafc;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .route-info h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
        }

        .info-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 16px;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: white;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .info-item.traffic {
          color: #f59e0b;
        }

        .route-actions {
          display: flex;
          gap: 8px;
        }

        .route-actions button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .route-actions button:hover {
          background: #f1f5f9;
        }

        .waypoints-list {
          margin-bottom: 20px;
        }

        .waypoints-list h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
        }

        .waypoint-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .waypoint-number {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #059669;
          color: white;
          border-radius: 50%;
          font-size: 13px;
          font-weight: 600;
        }

        .waypoint-info {
          flex: 1;
        }

        .waypoint-name {
          display: block;
          font-weight: 500;
          font-size: 14px;
        }

        .waypoint-duration {
          font-size: 12px;
          color: #64748b;
        }

        .remove-waypoint {
          padding: 6px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }

        .remove-waypoint:hover {
          color: #ef4444;
        }

        .map-container {
          flex: 1;
          position: relative;
        }

        .google-map {
          width: 100%;
          height: 100%;
        }

        .attractions-panel {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-top: 1px solid #e2e8f0;
          transition: transform 0.3s ease;
          max-height: 50%;
        }

        .attractions-panel.open {
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
        }

        .panel-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: white;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          color: #374151;
        }

        .panel-content {
          padding: 16px;
          max-height: 300px;
          overflow-y: auto;
        }

        .category-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .category-filters button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 20px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .category-filters button.active {
          background: #059669;
          border-color: #059669;
          color: white;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #f1f5f9;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          margin-bottom: 12px;
        }

        .attractions-list, .truck-stops-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .loading-attractions {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px;
          color: #64748b;
        }

        .no-attractions {
          text-align: center;
          color: #64748b;
          padding: 16px;
        }

        .attraction-item, .truck-stop-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .attraction-info h4, .stop-name {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
        }

        .attraction-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 4px;
        }

        .rating {
          display: flex;
          align-items: center;
          gap: 2px;
          font-size: 12px;
          color: #f59e0b;
        }

        .distance, .stop-distance {
          font-size: 12px;
          color: #64748b;
        }

        .add-stop-btn {
          padding: 8px;
          background: #059669;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .add-stop-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 16px 0 12px;
          font-size: 14px;
          color: #374151;
        }

        .stop-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          padding: 24px;
          border-radius: 16px;
          width: 400px;
          max-width: 90vw;
        }

        .modal h3 {
          margin: 0 0 16px 0;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .cancel-btn, .save-btn {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        }

        .cancel-btn {
          background: #f1f5f9;
          border: none;
          color: #64748b;
        }

        .save-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #059669;
          border: none;
          color: white;
        }

        .save-btn:disabled {
          background: #94a3b8;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .planner-content {
            flex-direction: column;
            height: auto;
          }

          .planner-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid #e2e8f0;
          }

          .map-container {
            height: 500px;
          }
        }
      `}</style>
    </div>
  );
};

export default EnhancedDrivePlanner;
