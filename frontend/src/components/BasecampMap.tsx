// BasecampMap.tsx - Enhanced interactive map for Basecamp page
// Shows: Favorited campgrounds, upcoming trips, friends' check-ins
// Uses Google Maps with marker clustering for performance

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  MapPin, Heart, Calendar, Users, Navigation, 
  ChevronRight, Loader2, Filter, X, Tent, Route 
} from 'lucide-react';

// Marker clustering library (add to package.json: @googlemaps/markerclusterer)
import { MarkerClusterer } from '@googlemaps/markerclusterer';

interface Campground {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  imageUrl?: string;
}

interface Trip {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  campground: Campground;
}

interface CheckIn {
  id: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    profilePhoto?: string;
  };
  campground: Campground;
  createdAt: string;
  note?: string;
}

interface BasecampMapProps {
  userId: number;
}

type MarkerType = 'favorites' | 'trips' | 'checkins' | 'overnightStops';

const MARKER_COLORS: Record<MarkerType, string> = {
  favorites: '#ef4444',       // red
  trips: '#3b82f6',           // blue
  checkins: '#22c55e',        // green
  overnightStops: '#1B2B4B',  // dark navy
};

const BasecampMap: React.FC<BasecampMapProps> = ({ userId }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Campground[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [overnightStops, setOvernightStops] = useState<any[]>([]);
  const [activeFilters, setActiveFilters] = useState<MarkerType[]>(['favorites', 'trips', 'checkins']);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'satellite' | 'terrain'>('terrain');

  // Fetch all data
  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      try {
        const [favRes, tripRes, checkInRes] = await Promise.all([
          fetch(`/api/users/${userId}/favorites`),
          fetch(`/api/users/${userId}/trips?upcoming=true`),
          fetch(`/api/users/${userId}/friends/checkins?limit=50`),
        ]);

        if (favRes.ok) {
          const favData = await favRes.json();
          setFavorites(favData.favorites || []);
        }

        if (tripRes.ok) {
          const tripData = await tripRes.json();
          setTrips(tripData.trips || []);
        }

        if (checkInRes.ok) {
          const checkInData = await checkInRes.json();
          setCheckIns(checkInData.checkIns || []);
        }
      } catch (error) {
        console.error('Error fetching map data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMapData();
  }, [userId]);

  // Initialize Google Map
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Custom map styling for outdoor/camping theme
    const mapStyles = [
      {
        featureType: 'poi.park',
        elementType: 'geometry.fill',
        stylers: [{ color: '#c8e6c9' }],
      },
      {
        featureType: 'water',
        elementType: 'geometry.fill',
        stylers: [{ color: '#b3e5fc' }],
      },
      {
        featureType: 'landscape.natural',
        elementType: 'geometry.fill',
        stylers: [{ color: '#e8f5e9' }],
      },
    ];

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 }, // Center of US
      zoom: 4,
      mapTypeId: mapStyle,
      styles: mapStyle === 'roadmap' ? mapStyles : undefined,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });

    infoWindowRef.current = new google.maps.InfoWindow();

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
    };
  }, []);

  // Update map style
  useEffect(() => {
    if (googleMapRef.current) {
      googleMapRef.current.setMapTypeId(mapStyle);
    }
  }, [mapStyle]);

  // Create custom marker icon
  const createMarkerIcon = (type: MarkerType): google.maps.Symbol => {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: MARKER_COLORS[type],
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 10,
    };
  };

  // Create advanced marker with custom SVG
  const createAdvancedMarkerIcon = (type: MarkerType): string => {
    const color = MARKER_COLORS[type];
    const icon = type === 'favorites' ? '\u2665' : type === 'trips' ? '\u25B2' : type === 'overnightStops' ? '\u{1F319}' : '\u25CF';
    
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="40" height="48" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 0C8.96 0 0 8.96 0 20c0 14 20 28 20 28s20-14 20-28C40 8.96 31.04 0 20 0z" fill="${color}"/>
        <circle cx="20" cy="18" r="10" fill="white"/>
        <text x="20" y="22" text-anchor="middle" font-size="14" fill="${color}">${icon}</text>
      </svg>
    `)}`;
  };

  // Update markers when data or filters change
  useEffect(() => {
    if (!googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }

    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    // Add favorite markers
    if (activeFilters.includes('favorites')) {
      favorites.forEach((campground) => {
        if (!campground.latitude || !campground.longitude) return;
        
        const marker = new google.maps.Marker({
          position: { lat: campground.latitude, lng: campground.longitude },
          map: googleMapRef.current,
          icon: {
            url: createAdvancedMarkerIcon('favorites'),
            scaledSize: new google.maps.Size(32, 38),
            anchor: new google.maps.Point(16, 38),
          },
          title: campground.name,
        });

        marker.addListener('click', () => {
          setSelectedItem({ type: 'favorite', data: campground });
          showInfoWindow(marker, campground, 'favorite');
        });

        markersRef.current.push(marker);
        bounds.extend(marker.getPosition()!);
        hasMarkers = true;
      });
    }

    // Add trip markers
    if (activeFilters.includes('trips')) {
      trips.forEach((trip) => {
        const campground = trip.campground;
        if (!campground?.latitude || !campground?.longitude) return;

        const marker = new google.maps.Marker({
          position: { lat: campground.latitude, lng: campground.longitude },
          map: googleMapRef.current,
          icon: {
            url: createAdvancedMarkerIcon('trips'),
            scaledSize: new google.maps.Size(32, 38),
            anchor: new google.maps.Point(16, 38),
          },
          title: `${trip.name} at ${campground.name}`,
        });

        marker.addListener('click', () => {
          setSelectedItem({ type: 'trip', data: trip });
          showInfoWindow(marker, trip, 'trip');
        });

        markersRef.current.push(marker);
        bounds.extend(marker.getPosition()!);
        hasMarkers = true;
      });
    }

    // Add check-in markers
    if (activeFilters.includes('checkins')) {
      checkIns.forEach((checkIn) => {
        const campground = checkIn.campground;
        if (!campground?.latitude || !campground?.longitude) return;

        const marker = new google.maps.Marker({
          position: { lat: campground.latitude, lng: campground.longitude },
          map: googleMapRef.current,
          icon: {
            url: createAdvancedMarkerIcon('checkins'),
            scaledSize: new google.maps.Size(32, 38),
            anchor: new google.maps.Point(16, 38),
          },
          title: `${checkIn.user.firstName} checked in at ${campground.name}`,
        });

        marker.addListener('click', () => {
          setSelectedItem({ type: 'checkin', data: checkIn });
          showInfoWindow(marker, checkIn, 'checkin');
        });

        markersRef.current.push(marker);
        bounds.extend(marker.getPosition()!);
        hasMarkers = true;
      });
    }

    // Add overnight stop markers
    if (activeFilters.includes('overnightStops')) {
      overnightStops.forEach((stop: any) => {
        if (!stop.latitude || !stop.longitude) return;

        const moonSvg = `data:image/svg+xml,${encodeURIComponent(`
          <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="12" fill="#1B2B4B" stroke="#E8A838" stroke-width="2"/>
            <path d="M14,7 A7,7 0 1,0 14,21 A5,5 0 1,1 14,7" fill="white"/>
          </svg>
        `)}`;

        const marker = new google.maps.Marker({
          position: { lat: stop.latitude, lng: stop.longitude },
          map: googleMapRef.current,
          icon: {
            url: moonSvg,
            scaledSize: new google.maps.Size(28, 28),
            anchor: new google.maps.Point(14, 14),
          },
          title: stop.name,
        });

        marker.addListener('click', () => {
          setSelectedItem({ type: 'overnightStop', data: stop });
        });

        markersRef.current.push(marker);
        bounds.extend(marker.getPosition()!);
        hasMarkers = true;
      });
    }

    // Set up clustering
    if (markersRef.current.length > 20) {
      clustererRef.current = new MarkerClusterer({
        map: googleMapRef.current,
        markers: markersRef.current,
        renderer: {
          render: ({ count, position }) => {
            return new google.maps.Marker({
              position,
              icon: {
                url: `data:image/svg+xml,${encodeURIComponent(`
                  <svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="25" cy="25" r="22" fill="#059669" stroke="white" stroke-width="3"/>
                    <text x="25" y="30" text-anchor="middle" font-size="14" font-weight="bold" fill="white">${count}</text>
                  </svg>
                `)}`,
                scaledSize: new google.maps.Size(50, 50),
              },
            });
          },
        },
      });
    }

    // Fit bounds if we have markers
    if (hasMarkers && markersRef.current.length > 0) {
      googleMapRef.current.fitBounds(bounds);
      // Don't zoom in too close for single markers
      const listener = google.maps.event.addListener(googleMapRef.current, 'idle', () => {
        if (googleMapRef.current!.getZoom()! > 12) {
          googleMapRef.current!.setZoom(12);
        }
        google.maps.event.removeListener(listener);
      });
    }
  }, [favorites, trips, checkIns, activeFilters]);

  // Show info window
  const showInfoWindow = (marker: google.maps.Marker, item: any, type: string) => {
    if (!infoWindowRef.current || !googleMapRef.current) return;

    let content = '';
    
    if (type === 'favorite') {
      content = `
        <div style="padding: 8px; max-width: 250px;">
          ${item.imageUrl ? `<img src="${item.imageUrl}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />` : ''}
          <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">${item.name}</h3>
          <p style="margin: 0; color: #666; font-size: 13px;">${item.city || ''}, ${item.state || ''}</p>
          <a href="/campgrounds/${item.id}" style="display: inline-block; margin-top: 8px; color: #059669; text-decoration: none; font-weight: 500;">View Details →</a>
        </div>
      `;
    } else if (type === 'trip') {
      const startDate = new Date(item.startDate).toLocaleDateString();
      const endDate = new Date(item.endDate).toLocaleDateString();
      content = `
        <div style="padding: 8px; max-width: 250px;">
          <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">${item.name}</h3>
          <p style="margin: 0 0 4px 0; color: #666; font-size: 13px;">📍 ${item.campground.name}</p>
          <p style="margin: 0; color: #3b82f6; font-size: 13px;">📅 ${startDate} - ${endDate}</p>
          <a href="/trips/${item.id}" style="display: inline-block; margin-top: 8px; color: #059669; text-decoration: none; font-weight: 500;">View Trip →</a>
        </div>
      `;
    } else if (type === 'checkin') {
      const checkInDate = new Date(item.createdAt).toLocaleDateString();
      content = `
        <div style="padding: 8px; max-width: 250px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            ${item.user.profilePhoto 
              ? `<img src="${item.user.profilePhoto}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" />`
              : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #22c55e; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">${item.user.firstName[0]}</div>`
            }
            <div>
              <p style="margin: 0; font-weight: 600;">${item.user.firstName} ${item.user.lastName}</p>
              <p style="margin: 0; color: #666; font-size: 12px;">${checkInDate}</p>
            </div>
          </div>
          <p style="margin: 0 0 4px 0; color: #666; font-size: 13px;">📍 ${item.campground.name}</p>
          ${item.note ? `<p style="margin: 8px 0 0 0; font-style: italic; color: #444;">"${item.note}"</p>` : ''}
        </div>
      `;
    }

    infoWindowRef.current.setContent(content);
    infoWindowRef.current.open(googleMapRef.current, marker);
  };

  // Toggle filter
  const toggleFilter = (filter: MarkerType) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  // Get directions to selected campground
  const getDirections = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <div className="basecamp-map-container">
      {/* Map Controls */}
      <div className="map-controls">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${activeFilters.includes('favorites') ? 'active' : ''}`}
            onClick={() => toggleFilter('favorites')}
            style={{ '--btn-color': MARKER_COLORS.favorites } as React.CSSProperties}
          >
            <Heart size={16} />
            <span>Favorites ({favorites.length})</span>
          </button>
          <button
            className={`filter-btn ${activeFilters.includes('trips') ? 'active' : ''}`}
            onClick={() => toggleFilter('trips')}
            style={{ '--btn-color': MARKER_COLORS.trips } as React.CSSProperties}
          >
            <Calendar size={16} />
            <span>Trips ({trips.length})</span>
          </button>
          <button
            className={`filter-btn ${activeFilters.includes('checkins') ? 'active' : ''}`}
            onClick={() => toggleFilter('checkins')}
            style={{ '--btn-color': MARKER_COLORS.checkins } as React.CSSProperties}
          >
            <Users size={16} />
            <span>Check-ins ({checkIns.length})</span>
          </button>
          <button
            className={`filter-btn ${activeFilters.includes('overnightStops') ? 'active' : ''}`}
            onClick={() => {
              toggleFilter('overnightStops');
              if (overnightStops.length === 0 && googleMapRef.current) {
                const center = googleMapRef.current.getCenter();
                if (center) {
                  fetch(`/api/overnight-stops/search?lat=${center.lat()}&lng=${center.lng()}&radius=100`)
                    .then(r => r.json())
                    .then(data => setOvernightStops(Array.isArray(data) ? data : []))
                    .catch(() => {});
                }
              }
            }}
            style={{ '--btn-color': '#E8A838' } as React.CSSProperties}
          >
            <span>{'\u{1F319}'}</span>
            <span>Overnight</span>
          </button>
        </div>

        <div className="map-style-toggle">
          <button 
            className={mapStyle === 'roadmap' ? 'active' : ''}
            onClick={() => setMapStyle('roadmap')}
          >
            Map
          </button>
          <button 
            className={mapStyle === 'satellite' ? 'active' : ''}
            onClick={() => setMapStyle('satellite')}
          >
            Satellite
          </button>
          <button 
            className={mapStyle === 'terrain' ? 'active' : ''}
            onClick={() => setMapStyle('terrain')}
          >
            Terrain
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="map-wrapper">
        {loading && (
          <div className="map-loading">
            <Loader2 className="animate-spin" size={32} />
            <p>Loading your camping map...</p>
          </div>
        )}
        <div ref={mapRef} className="google-map" />
      </div>

      {/* Legend */}
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-marker" style={{ background: MARKER_COLORS.favorites }} />
          <span>Favorited Campgrounds</span>
        </div>
        <div className="legend-item">
          <span className="legend-marker" style={{ background: MARKER_COLORS.trips }} />
          <span>Upcoming Trips</span>
        </div>
        <div className="legend-item">
          <span className="legend-marker" style={{ background: MARKER_COLORS.checkins }} />
          <span>Friends' Check-ins</span>
        </div>
      </div>

      {/* Quick Actions Panel */}
      {selectedItem && (
        <div className="quick-actions-panel">
          <button className="close-panel" onClick={() => setSelectedItem(null)}>
            <X size={20} />
          </button>
          
          {selectedItem.type === 'favorite' && (
            <div className="panel-content">
              <h4>{selectedItem.data.name}</h4>
              <div className="panel-actions">
                <Link to={`/campgrounds/${selectedItem.data.id}`} className="action-btn primary">
                  <Tent size={16} />
                  View Campground
                </Link>
                <button 
                  className="action-btn secondary"
                  onClick={() => getDirections(selectedItem.data.latitude, selectedItem.data.longitude)}
                >
                  <Navigation size={16} />
                  Get Directions
                </button>
                <Link to={`/drive-planner?destination=${selectedItem.data.id}`} className="action-btn secondary">
                  <Route size={16} />
                  Plan Drive
                </Link>
              </div>
            </div>
          )}

          {selectedItem.type === 'trip' && (
            <div className="panel-content">
              <h4>{selectedItem.data.name}</h4>
              <p className="panel-subtitle">at {selectedItem.data.campground.name}</p>
              <div className="panel-actions">
                <Link to={`/trips/${selectedItem.data.id}`} className="action-btn primary">
                  <Calendar size={16} />
                  View Trip
                </Link>
                <button 
                  className="action-btn secondary"
                  onClick={() => getDirections(selectedItem.data.campground.latitude, selectedItem.data.campground.longitude)}
                >
                  <Navigation size={16} />
                  Get Directions
                </button>
              </div>
            </div>
          )}

          {selectedItem.type === 'checkin' && (
            <div className="panel-content">
              <h4>{selectedItem.data.user.firstName}'s Check-in</h4>
              <p className="panel-subtitle">{selectedItem.data.campground.name}</p>
              <div className="panel-actions">
                <Link to={`/campgrounds/${selectedItem.data.campground.id}`} className="action-btn primary">
                  <Tent size={16} />
                  View Campground
                </Link>
                <Link to={`/profile/${selectedItem.data.user.username || selectedItem.data.user.id}`} className="action-btn secondary">
                  <Users size={16} />
                  View Profile
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .basecamp-map-container {
          position: relative;
          background: #f8fafc;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .map-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
          flex-wrap: wrap;
          gap: 12px;
        }

        .filter-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 2px solid #e2e8f0;
          border-radius: 24px;
          background: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          border-color: var(--btn-color);
          color: var(--btn-color);
        }

        .filter-btn.active {
          background: var(--btn-color);
          border-color: var(--btn-color);
          color: white;
        }

        .map-style-toggle {
          display: flex;
          background: #f1f5f9;
          border-radius: 8px;
          overflow: hidden;
        }

        .map-style-toggle button {
          padding: 8px 14px;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }

        .map-style-toggle button.active {
          background: #059669;
          color: white;
        }

        .map-wrapper {
          position: relative;
          height: 500px;
        }

        .google-map {
          width: 100%;
          height: 100%;
        }

        .map-loading {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.9);
          z-index: 10;
        }

        .map-loading p {
          margin-top: 12px;
          color: #64748b;
          font-weight: 500;
        }

        .map-legend {
          display: flex;
          justify-content: center;
          gap: 24px;
          padding: 12px;
          background: white;
          border-top: 1px solid #e2e8f0;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #64748b;
        }

        .legend-marker {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .quick-actions-panel {
          position: absolute;
          bottom: 60px;
          left: 16px;
          right: 16px;
          max-width: 400px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
          padding: 16px;
          z-index: 20;
        }

        .close-panel {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          padding: 4px;
        }

        .close-panel:hover {
          color: #475569;
        }

        .panel-content h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .panel-subtitle {
          margin: 0 0 12px 0;
          color: #64748b;
          font-size: 14px;
        }

        .panel-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn.primary {
          background: #059669;
          color: white;
          border: none;
        }

        .action-btn.primary:hover {
          background: #047857;
        }

        .action-btn.secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .action-btn.secondary:hover {
          background: #e2e8f0;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .map-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-buttons {
            justify-content: center;
          }

          .map-style-toggle {
            justify-content: center;
          }

          .map-legend {
            flex-wrap: wrap;
            gap: 12px;
          }

          .quick-actions-panel {
            left: 8px;
            right: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default BasecampMap;
