// ProfileMap.tsx - Interactive profile map showing states visited and trip history
// Features: Clickable US states, trip paths, heat map, stats

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Map, Flag, Route, Calendar, TrendingUp, 
  ChevronRight, Loader2, Eye, EyeOff 
} from 'lucide-react';

interface StateVisit {
  state: string;
  stateCode: string;
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  campgrounds: Array<{
    id: number;
    name: string;
    visitCount: number;
  }>;
}

interface TripPath {
  id: number;
  name: string;
  startDate: string;
  polyline?: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  campground?: {
    name: string;
    state: string;
  };
}

interface ProfileMapProps {
  userId: number;
  isOwnProfile?: boolean;
}

// US State abbreviations to full names
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
  DC: 'District of Columbia',
};

// State center coordinates for labels
const STATE_CENTERS: Record<string, { lat: number; lng: number }> = {
  AL: { lat: 32.7794, lng: -86.8287 }, AK: { lat: 64.0685, lng: -152.2782 },
  AZ: { lat: 34.2744, lng: -111.6602 }, AR: { lat: 34.8938, lng: -92.4426 },
  CA: { lat: 37.1841, lng: -119.4696 }, CO: { lat: 38.9972, lng: -105.5478 },
  CT: { lat: 41.6219, lng: -72.7273 }, DE: { lat: 38.9896, lng: -75.505 },
  FL: { lat: 28.6305, lng: -82.4497 }, GA: { lat: 32.6415, lng: -83.4426 },
  HI: { lat: 20.2927, lng: -156.3737 }, ID: { lat: 44.3509, lng: -114.613 },
  IL: { lat: 40.0417, lng: -89.1965 }, IN: { lat: 39.8942, lng: -86.2816 },
  IA: { lat: 42.0751, lng: -93.496 }, KS: { lat: 38.4937, lng: -98.3804 },
  KY: { lat: 37.5347, lng: -85.3021 }, LA: { lat: 31.0689, lng: -91.9968 },
  ME: { lat: 45.3695, lng: -69.2428 }, MD: { lat: 39.055, lng: -76.7909 },
  MA: { lat: 42.2596, lng: -71.8083 }, MI: { lat: 44.3467, lng: -85.4102 },
  MN: { lat: 46.2807, lng: -94.3053 }, MS: { lat: 32.7364, lng: -89.6678 },
  MO: { lat: 38.3566, lng: -92.458 }, MT: { lat: 47.0527, lng: -109.6333 },
  NE: { lat: 41.5378, lng: -99.7951 }, NV: { lat: 39.3289, lng: -116.6312 },
  NH: { lat: 43.6805, lng: -71.5811 }, NJ: { lat: 40.1907, lng: -74.6728 },
  NM: { lat: 34.4071, lng: -106.1126 }, NY: { lat: 42.9538, lng: -75.5268 },
  NC: { lat: 35.5557, lng: -79.3877 }, ND: { lat: 47.4501, lng: -100.4659 },
  OH: { lat: 40.2862, lng: -82.7937 }, OK: { lat: 35.5889, lng: -97.4943 },
  OR: { lat: 43.9336, lng: -120.5583 }, PA: { lat: 40.8781, lng: -77.7996 },
  RI: { lat: 41.6762, lng: -71.5562 }, SC: { lat: 33.9169, lng: -80.8964 },
  SD: { lat: 44.4443, lng: -100.2263 }, TN: { lat: 35.858, lng: -86.3505 },
  TX: { lat: 31.4757, lng: -99.3312 }, UT: { lat: 39.3055, lng: -111.6703 },
  VT: { lat: 44.0687, lng: -72.6658 }, VA: { lat: 37.5215, lng: -78.8537 },
  WA: { lat: 47.3826, lng: -120.4472 }, WV: { lat: 38.6409, lng: -80.6227 },
  WI: { lat: 44.6243, lng: -89.9941 }, WY: { lat: 42.9957, lng: -107.5512 },
};

const ProfileMap: React.FC<ProfileMapProps> = ({ userId, isOwnProfile = false }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const [loading, setLoading] = useState(true);
  const [stateVisits, setStateVisits] = useState<StateVisit[]>([]);
  const [tripPaths, setTripPaths] = useState<TripPath[]>([]);
  const [selectedState, setSelectedState] = useState<StateVisit | null>(null);
  const [showTripPaths, setShowTripPaths] = useState(true);
  const [mapView, setMapView] = useState<'states' | 'heatmap'>('states');

  // Stats
  const stats = useMemo(() => {
    const visitedStates = stateVisits.length;
    const totalVisits = stateVisits.reduce((sum, s) => sum + s.visitCount, 0);
    const totalCampgrounds = stateVisits.reduce((sum, s) => sum + s.campgrounds.length, 0);
    return { visitedStates, totalVisits, totalCampgrounds };
  }, [stateVisits]);

  // Fetch data
  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      try {
        const [statesRes, tripsRes] = await Promise.all([
          fetch(`/api/users/${userId}/states-visited`),
          fetch(`/api/users/${userId}/trip-paths`),
        ]);

        if (statesRes.ok) {
          const data = await statesRes.json();
          setStateVisits(data.states || []);
        }

        if (tripsRes.ok) {
          const data = await tripsRes.json();
          setTripPaths(data.trips || []);
        }
      } catch (error) {
        console.error('Error fetching map data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMapData();
  }, [userId]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      mapTypeId: 'terrain',
      mapTypeControl: false,
      streetViewControl: false,
      styles: [
        {
          featureType: 'administrative.province',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#94a3b8' }, { weight: 1 }],
        },
        {
          featureType: 'water',
          elementType: 'geometry.fill',
          stylers: [{ color: '#bfdbfe' }],
        },
        {
          featureType: 'landscape',
          elementType: 'geometry.fill',
          stylers: [{ color: '#f1f5f9' }],
        },
      ],
    });

    // Load US states GeoJSON
    dataLayerRef.current = new google.maps.Data();
    dataLayerRef.current.loadGeoJson(
      'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
      undefined,
      () => {
        updateStateStyles();
      }
    );
    dataLayerRef.current.setMap(googleMapRef.current);

    // Click handler for states
    dataLayerRef.current.addListener('click', (event: google.maps.Data.MouseEvent) => {
      const stateCode = getStateCodeFromFeature(event.feature);
      const stateData = stateVisits.find(s => s.stateCode === stateCode);
      if (stateData) {
        setSelectedState(stateData);
      }
    });

    // Hover effects
    dataLayerRef.current.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
      dataLayerRef.current?.overrideStyle(event.feature, {
        strokeWeight: 3,
        strokeColor: '#059669',
      });
    });

    dataLayerRef.current.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
      dataLayerRef.current?.revertStyle(event.feature);
    });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, []);

  // Update state styles when visits change
  useEffect(() => {
    updateStateStyles();
  }, [stateVisits, mapView]);

  // Update trip paths
  useEffect(() => {
    // Clear existing polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    if (!showTripPaths || !googleMapRef.current) return;

    tripPaths.forEach(trip => {
      if (trip.polyline) {
        // Decode polyline
        const path = google.maps.geometry.encoding.decodePath(trip.polyline);
        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.6,
          strokeWeight: 3,
        });
        polyline.setMap(googleMapRef.current);
        polylinesRef.current.push(polyline);
      } else if (trip.origin && trip.destination) {
        // Draw straight line between origin and destination
        const path = [trip.origin, trip.destination];
        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.4,
          strokeWeight: 2,
          icons: [{
            icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
            offset: '100%',
          }],
        });
        polyline.setMap(googleMapRef.current);
        polylinesRef.current.push(polyline);
      }
    });
  }, [tripPaths, showTripPaths]);

  // Get state code from GeoJSON feature
  const getStateCodeFromFeature = (feature: google.maps.Data.Feature): string => {
    const name = feature.getProperty('name') as string;
    return Object.entries(STATE_NAMES).find(([code, fullName]) => 
      fullName.toLowerCase() === name?.toLowerCase()
    )?.[0] || '';
  };

  // Update state fill colors based on visits
  const updateStateStyles = () => {
    if (!dataLayerRef.current) return;

    const visitedCodes = new Set(stateVisits.map(s => s.stateCode));
    const maxVisits = Math.max(...stateVisits.map(s => s.visitCount), 1);

    dataLayerRef.current.setStyle((feature) => {
      const stateCode = getStateCodeFromFeature(feature);
      const stateData = stateVisits.find(s => s.stateCode === stateCode);

      if (mapView === 'heatmap' && stateData) {
        // Heat map coloring based on visit count
        const intensity = stateData.visitCount / maxVisits;
        const color = getHeatColor(intensity);
        return {
          fillColor: color,
          fillOpacity: 0.7,
          strokeColor: '#ffffff',
          strokeWeight: 1,
        };
      } else if (visitedCodes.has(stateCode)) {
        return {
          fillColor: '#059669',
          fillOpacity: 0.6,
          strokeColor: '#ffffff',
          strokeWeight: 1,
        };
      } else {
        return {
          fillColor: '#e2e8f0',
          fillOpacity: 0.4,
          strokeColor: '#94a3b8',
          strokeWeight: 0.5,
        };
      }
    });
  };

  // Get heat map color based on intensity (0-1)
  const getHeatColor = (intensity: number): string => {
    // Green to yellow to red gradient
    if (intensity < 0.33) {
      return '#22c55e'; // Green
    } else if (intensity < 0.66) {
      return '#f59e0b'; // Amber
    } else {
      return '#ef4444'; // Red
    }
  };

  return (
    <div className="profile-map-container">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat">
          <Flag size={20} />
          <div>
            <span className="stat-value">{stats.visitedStates}</span>
            <span className="stat-label">States Visited</span>
          </div>
        </div>
        <div className="stat">
          <Calendar size={20} />
          <div>
            <span className="stat-value">{stats.totalVisits}</span>
            <span className="stat-label">Total Visits</span>
          </div>
        </div>
        <div className="stat">
          <Map size={20} />
          <div>
            <span className="stat-value">{stats.totalCampgrounds}</span>
            <span className="stat-label">Campgrounds</span>
          </div>
        </div>
        <div className="stat progress">
          <TrendingUp size={20} />
          <div>
            <span className="stat-value">{Math.round((stats.visitedStates / 50) * 100)}%</span>
            <span className="stat-label">US Coverage</span>
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div className="map-controls">
        <div className="view-toggle">
          <button
            className={mapView === 'states' ? 'active' : ''}
            onClick={() => setMapView('states')}
          >
            States
          </button>
          <button
            className={mapView === 'heatmap' ? 'active' : ''}
            onClick={() => setMapView('heatmap')}
          >
            Heat Map
          </button>
        </div>

        <button
          className={`trip-paths-toggle ${showTripPaths ? 'active' : ''}`}
          onClick={() => setShowTripPaths(!showTripPaths)}
        >
          {showTripPaths ? <Eye size={16} /> : <EyeOff size={16} />}
          Trip Paths
        </button>
      </div>

      {/* Map */}
      <div className="map-wrapper">
        {loading && (
          <div className="map-loading">
            <Loader2 className="spin" size={32} />
            <p>Loading travel history...</p>
          </div>
        )}
        <div ref={mapRef} className="google-map" />

        {/* Legend */}
        <div className="map-legend">
          {mapView === 'states' ? (
            <>
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#059669' }} />
                <span>Visited</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#e2e8f0' }} />
                <span>Not Visited</span>
              </div>
            </>
          ) : (
            <>
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#22c55e' }} />
                <span>1-2 visits</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#f59e0b' }} />
                <span>3-5 visits</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#ef4444' }} />
                <span>6+ visits</span>
              </div>
            </>
          )}
          {showTripPaths && (
            <div className="legend-item">
              <span className="legend-line" />
              <span>Trip Routes</span>
            </div>
          )}
        </div>
      </div>

      {/* State Detail Panel */}
      {selectedState && (
        <div className="state-detail-panel">
          <button className="close-panel" onClick={() => setSelectedState(null)}>×</button>
          
          <h3>{STATE_NAMES[selectedState.stateCode] || selectedState.state}</h3>
          
          <div className="state-stats">
            <div className="state-stat">
              <span className="value">{selectedState.visitCount}</span>
              <span className="label">Visits</span>
            </div>
            <div className="state-stat">
              <span className="value">{selectedState.campgrounds.length}</span>
              <span className="label">Campgrounds</span>
            </div>
          </div>

          <div className="visit-dates">
            <p>First visit: {new Date(selectedState.firstVisit).toLocaleDateString()}</p>
            <p>Last visit: {new Date(selectedState.lastVisit).toLocaleDateString()}</p>
          </div>

          {selectedState.campgrounds.length > 0 && (
            <div className="campground-list">
              <h4>Campgrounds Visited</h4>
              {selectedState.campgrounds.slice(0, 5).map(cg => (
                <Link 
                  key={cg.id} 
                  to={`/campgrounds/${cg.id}`}
                  className="campground-item"
                >
                  <span>{cg.name}</span>
                  <span className="visit-count">{cg.visitCount}×</span>
                  <ChevronRight size={16} />
                </Link>
              ))}
              {selectedState.campgrounds.length > 5 && (
                <Link 
                  to={`/campgrounds?state=${selectedState.stateCode}`}
                  className="see-all-link"
                >
                  See all {selectedState.campgrounds.length} campgrounds
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* States List (collapsed by default) */}
      <details className="states-list-section">
        <summary>View All Visited States ({stats.visitedStates})</summary>
        <div className="states-grid">
          {stateVisits
            .sort((a, b) => b.visitCount - a.visitCount)
            .map(state => (
              <button
                key={state.stateCode}
                className="state-card"
                onClick={() => setSelectedState(state)}
              >
                <span className="state-code">{state.stateCode}</span>
                <span className="state-name">{STATE_NAMES[state.stateCode]}</span>
                <span className="state-visits">{state.visitCount} visits</span>
              </button>
            ))
          }
        </div>
      </details>

      <style>{`
        .profile-map-container {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .stats-bar {
          display: flex;
          justify-content: space-around;
          padding: 16px;
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: white;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 700;
        }

        .stat-label {
          display: block;
          font-size: 12px;
          opacity: 0.9;
        }

        .map-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .view-toggle {
          display: flex;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }

        .view-toggle button {
          padding: 8px 16px;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;
        }

        .view-toggle button.active {
          background: #059669;
          color: white;
        }

        .trip-paths-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          color: #64748b;
        }

        .trip-paths-toggle.active {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .map-wrapper {
          position: relative;
          height: 450px;
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

        .map-legend {
          position: absolute;
          bottom: 16px;
          left: 16px;
          background: white;
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 6px;
        }

        .legend-item:last-child {
          margin-bottom: 0;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }

        .legend-line {
          width: 20px;
          height: 3px;
          background: #3b82f6;
          border-radius: 2px;
        }

        .state-detail-panel {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 280px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          padding: 16px;
          z-index: 20;
        }

        .close-panel {
          position: absolute;
          top: 8px;
          right: 12px;
          background: none;
          border: none;
          font-size: 24px;
          color: #94a3b8;
          cursor: pointer;
        }

        .state-detail-panel h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          color: #1e293b;
        }

        .state-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }

        .state-stat {
          text-align: center;
          flex: 1;
          padding: 10px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .state-stat .value {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: #059669;
        }

        .state-stat .label {
          font-size: 11px;
          color: #64748b;
        }

        .visit-dates {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 12px;
        }

        .visit-dates p {
          margin: 4px 0;
        }

        .campground-list h4 {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #64748b;
          text-transform: uppercase;
        }

        .campground-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          text-decoration: none;
          color: #374151;
          font-size: 13px;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .campground-item:hover {
          background: #f1f5f9;
        }

        .campground-item span:first-child {
          flex: 1;
        }

        .visit-count {
          color: #059669;
          font-weight: 500;
        }

        .see-all-link {
          display: block;
          text-align: center;
          padding: 8px;
          color: #059669;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
        }

        .states-list-section {
          border-top: 1px solid #e2e8f0;
        }

        .states-list-section summary {
          padding: 14px 16px;
          cursor: pointer;
          font-weight: 500;
          color: #374151;
        }

        .states-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 8px;
          padding: 0 16px 16px;
        }

        .state-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .state-card:hover {
          background: #ecfdf5;
          border-color: #059669;
        }

        .state-code {
          font-size: 20px;
          font-weight: 700;
          color: #059669;
        }

        .state-name {
          font-size: 12px;
          color: #64748b;
          margin: 4px 0;
        }

        .state-visits {
          font-size: 11px;
          color: #94a3b8;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .stats-bar {
            flex-wrap: wrap;
            gap: 16px;
          }

          .stat {
            flex-basis: 45%;
            justify-content: center;
          }

          .state-detail-panel {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            border-radius: 16px 16px 0 0;
          }
        }
      `}</style>
    </div>
  );
};

export default ProfileMap;
