import React from 'react';
import { ComposableMap, Geographies, Geography, Marker, Line } from 'react-simple-maps';

interface MapMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'campground' | 'attraction' | 'visit' | 'gasStation' | 'restStop' | 'home' | 'favorite' | 'upcomingTrip' | 'friendCheckin' | 'overnightStop' | 'freeOvernight' | 'recentAlbum' | 'upcomingFriendTrip';
  isCurrentlyCamping?: boolean;
  isVisited?: boolean;
  brand?: string;
  user?: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
  };
  tripId?: string;
  albumId?: string;
  coverImageUrl?: string;
  departureDate?: string;
  clusterCount?: number;
}

interface HighwayLine {
  id: string;
  name: string;
  color: string;
  coordinates: [number, number][]; // [longitude, latitude]
}

// Wrap Marker to prevent bad coordinates from crashing the whole map
class SafeMarkerBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? null : this.props.children; }
}

interface USMapSVGProps {
  visitedStates: string[];
  plannedStates?: string[];
  stateColors?: Record<string, string>; // Custom colors per state (e.g., for gas prices)
  markers?: MapMarker[];
  highways?: HighwayLine[]; // Highway lines to render
  tripRoute?: {
    completedCoords: [number, number][];
    upcomingCoords: [number, number][];
    currentPosition?: { latitude: number; longitude: number; name: string };
    eventName?: string;
    dayNumber?: number;
    totalDays?: number;
  };
  userProfilePicture?: string;
  showHighways?: boolean;
  darkMode?: boolean;
  onStateClick: (state: string) => void;
  onStateHover?: (state: string | null) => void;
  onMarkerClick?: (marker: MapMarker) => void;
  isInteractive: boolean;
}

const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// Map state names to codes
const stateNameToCode: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

// Get marker color based on type
const getMarkerColor = (marker: MapMarker) => {
  if (marker.type === 'gasStation') {
    // Different colors for different brands
    if (marker.brand === 'Pilot') return '#dc2626'; // red
    if (marker.brand === 'Flying J') return '#dc2626'; // red
    if (marker.brand === "Love's") return '#facc15'; // yellow
    if (marker.brand === 'TA') return '#3b82f6'; // blue
    if (marker.brand === 'Petro') return '#3b82f6'; // blue
    return '#f97316'; // orange default
  }
  if (marker.type === 'home') {
    return marker.isCurrentlyCamping ? '#f97316' : '#22c55e'; // orange if camping, green if home
  }
  if (marker.type === 'restStop') {
    return '#0ea5e9'; // sky blue
  }
  if (marker.type === 'campground') {
    return marker.isVisited ? '#16a34a' : '#3b82f6'; // green if visited, blue if planned
  }
  if (marker.type === 'attraction') {
    return marker.isVisited ? '#f97316' : '#eab308'; // orange if visited, yellow if want to visit
  }
  if (marker.type === 'favorite') {
    return '#ef4444'; // red for favorites
  }
  if (marker.type === 'upcomingTrip') {
    return '#6366f1'; // indigo for upcoming trips
  }
  if (marker.type === 'overnightStop' || marker.type === 'freeOvernight') {
    return '#1B2B4B'; // dark navy for overnight stops
  }
  if (marker.type === 'friendCheckin') {
    return '#10b981'; // emerald for friends' check-ins
  }
  if (marker.type === 'recentAlbum') {
    return '#E8A838'; // gold for albums
  }
  if (marker.type === 'upcomingFriendTrip') {
    return '#6366f1'; // indigo for upcoming friend trips
  }
  return '#6b7280'; // gray default
};

// Lighten a hex color for hover state
const lightenColor = (hex: string, percent: number = 20): string => {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const newR = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
  const newG = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
  const newB = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

// Darken a hex color for pressed state
const darkenColor = (hex: string, percent: number = 15): string => {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const newR = Math.max(0, Math.round(r * (1 - percent / 100)));
  const newG = Math.max(0, Math.round(g * (1 - percent / 100)));
  const newB = Math.max(0, Math.round(b * (1 - percent / 100)));
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

export default function USMapSVG({
  visitedStates,
  plannedStates = [],
  stateColors,
  markers = [],
  highways = [],
  tripRoute,
  userProfilePicture,
  showHighways = false,
  darkMode = false,
  onStateClick,
  onStateHover,
  onMarkerClick,
  isInteractive
}: USMapSVGProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <ComposableMap projection="geoAlbersUsa">
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const stateName = geo.properties.name;
              const stateCode = stateNameToCode[stateName] || stateName;
              const isVisited = visitedStates.includes(stateCode);
              const isPlanned = plannedStates.includes(stateCode);
              const customColor = stateColors?.[stateCode];
              
              // Determine colors based on state + dark mode
              let fillColor = darkMode ? '#2a3b58' : '#e5e7eb';
              let strokeColor = darkMode ? '#3d4f6e' : '#9ca3af';
              let hoverColor = darkMode ? '#334a6a' : '#d1d5db';
              let pressedColor = darkMode ? '#253350' : '#d1d5db';

              // Priority: customColor > visited > planned > default
              if (customColor) {
                fillColor = customColor;
                strokeColor = darkenColor(customColor, 30);
                hoverColor = lightenColor(customColor, 20);
                pressedColor = darkenColor(customColor, 15);
              } else if (isVisited) {
                fillColor = darkMode ? '#E8622A' : '#f97316';
                strokeColor = darkMode ? '#c75a10' : '#ea580c';
                hoverColor = darkMode ? '#f07040' : '#fb923c';
                pressedColor = darkMode ? '#c75a10' : '#ea580c';
              } else if (isPlanned) {
                fillColor = darkMode ? '#4a80c4' : '#93c5fd';
                strokeColor = darkMode ? '#3b6eab' : '#60a5fa';
                hoverColor = darkMode ? '#5a90d4' : '#bfdbfe';
                pressedColor = darkMode ? '#3b6eab' : '#60a5fa';
              }
              
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => isInteractive && onStateClick(stateCode)}
                  onMouseEnter={() => onStateHover?.(stateCode)}
                  onMouseLeave={() => onStateHover?.(null)}
                  style={{
                    default: {
                      fill: fillColor,
                      stroke: strokeColor,
                      strokeWidth: 0.75,
                      outline: 'none',
                    },
                    hover: {
                      fill: hoverColor,
                      stroke: strokeColor,
                      strokeWidth: 0.75,
                      outline: 'none',
                      cursor: isInteractive ? 'pointer' : 'default',
                    },
                    pressed: {
                      fill: pressedColor,
                      stroke: strokeColor,
                      strokeWidth: 0.75,
                      outline: 'none',
                    },
                  }}
                />
              );
            })
          }
        </Geographies>

        {/* Render active trip route */}
        {tripRoute && tripRoute.completedCoords.length > 1 && (
          <Line
            from={tripRoute.completedCoords[0]}
            to={tripRoute.completedCoords[tripRoute.completedCoords.length - 1]}
            coordinates={tripRoute.completedCoords}
            stroke="#f97316"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="0"
            fill="none"
          />
        )}
        {tripRoute && tripRoute.upcomingCoords.length > 1 && (
          <>
            {/* Glow effect behind the route */}
            <Line
              from={tripRoute.upcomingCoords[0]}
              to={tripRoute.upcomingCoords[tripRoute.upcomingCoords.length - 1]}
              coordinates={tripRoute.upcomingCoords}
              stroke="#fb923c"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray="0"
              fill="none"
              strokeOpacity={0.25}
            />
            {/* Main route line */}
            <Line
              from={tripRoute.upcomingCoords[0]}
              to={tripRoute.upcomingCoords[tripRoute.upcomingCoords.length - 1]}
              coordinates={tripRoute.upcomingCoords}
              stroke="#f97316"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="8,5"
              fill="none"
            />
          </>
        )}
        {/* Stop markers along the route */}
        {tripRoute && tripRoute.allStops && tripRoute.allStops
          .filter((s: any) => s.latitude && s.longitude && !isNaN(Number(s.latitude)) && !isNaN(Number(s.longitude)))
          .map((stop: any, idx: number) => (
            <SafeMarkerBoundary key={`stop-${idx}`}>
              <Marker
                key={`stop-marker-${idx}`}
                coordinates={[Number(stop.longitude), Number(stop.latitude)]}
              >
                <circle cx={0} cy={0} r={5} fill="#f97316" stroke="#fff" strokeWidth={2} />
                <text
                  x={0}
                  y={-10}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#1e293b"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {idx === 0 || idx === (tripRoute.allStops.length - 1) ? '🏠' : `${idx}`}
                </text>
              </Marker>
            </SafeMarkerBoundary>
          ))
        }
        {/* User position marker on active route */}
        {tripRoute?.currentPosition && tripRoute.currentPosition.longitude && tripRoute.currentPosition.latitude && !isNaN(Number(tripRoute.currentPosition.longitude)) && !isNaN(Number(tripRoute.currentPosition.latitude)) && (
          <Marker coordinates={[Number(tripRoute.currentPosition.longitude), Number(tripRoute.currentPosition.latitude)]}>
            <g transform="translate(-12, -12)">
              <circle cx="12" cy="12" r="13" fill="#f97316" stroke="white" strokeWidth="2" />
              {userProfilePicture ? (
                <image href={userProfilePicture} x="1" y="1" width="22" height="22" clipPath="url(#circle-clip)" style={{borderRadius: '50%'}} />
              ) : (
                <text x="12" y="17" textAnchor="middle" fontSize="14">🚐</text>
              )}
              <clipPath id="circle-clip">
                <circle cx="12" cy="12" r="11" />
              </clipPath>
            </g>
          </Marker>
        )}

        {/* Render highway lines */}
        {showHighways && highways.map((highway) => (
          <Line
            key={highway.id}
            from={highway.coordinates[0]}
            to={highway.coordinates[highway.coordinates.length - 1]}
            coordinates={highway.coordinates}
            stroke={highway.color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        
        {/* Render markers/pins */}
        {markers.filter(m => m.latitude && m.longitude && !isNaN(Number(m.latitude)) && !isNaN(Number(m.longitude)) && Number(m.latitude) !== 0 && Number(m.longitude) !== 0).map((marker) => (
          <SafeMarkerBoundary key={marker.id}>
          <Marker 
            key={`m-${marker.id}`}
            coordinates={[Number(marker.longitude), Number(marker.latitude)]}
            onClick={() => onMarkerClick?.(marker)}
          >
            <g style={{ cursor: onMarkerClick ? 'pointer' : 'default' }}>
              {/* Different marker styles based on type */}
              {marker.type === 'gasStation' ? (
                <>
                  <circle
                    cx={0}
                    cy={0}
                    r={4}
                    fill={getMarkerColor(marker)}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                </>
              ) : marker.type === 'restStop' ? (
                <>
                  <rect
                    x={-3}
                    y={-3}
                    width={6}
                    height={6}
                    fill={getMarkerColor(marker)}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                </>
              ) : (marker.type === 'overnightStop' || marker.type === 'freeOvernight') ? (
                <>
                  {/* Moon pin — navy circle with white crescent */}
                  <circle
                    cx={0}
                    cy={0}
                    r={5}
                    fill="#1B2B4B"
                    stroke="#E8A838"
                    strokeWidth={1.5}
                  />
                  {/* Crescent moon shape */}
                  <path
                    d="M0,-3 A3,3 0 1,0 0,3 A2,2 0 1,1 0,-3"
                    fill="#fff"
                    transform="translate(0.5, 0) scale(0.7)"
                  />
                </>
              ) : marker.type === 'home' ? (
                <>
                  {/* Home marker - house shape */}
                  <g transform="translate(-8, -16) scale(0.7)">
                    {/* House roof */}
                    <path
                      d="M12 2 L2 12 L5 12 L5 22 L19 22 L19 12 L22 12 Z"
                      fill={getMarkerColor(marker)}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                    {/* Door */}
                    <rect x="10" y="14" width="4" height="8" fill="#fff" />
                    {/* Camping indicator (tent on top if camping) */}
                    {marker.isCurrentlyCamping && (
                      <circle cx="12" cy="-4" r="6" fill="#f97316" stroke="#fff" strokeWidth={1} />
                    )}
                  </g>
                </>
              ) : marker.type === 'friendCheckin' && marker.user ? (
                <>
                  {/* Friend check-in - profile picture */}
                  <defs>
                    <clipPath id={`clip-${marker.id}`}>
                      <circle cx={0} cy={-10} r={18} />
                    </clipPath>
                  </defs>
                  {/* White background circle */}
                  <circle
                    cx={0}
                    cy={-10}
                    r={20}
                    fill="#fff"
                    stroke="#10b981"
                    strokeWidth={4}
                  />
                  {/* Profile image */}
                  <image
                    href={marker.user.profilePicture || '/default-avatar.png'}
                    x={-18}
                    y={-26}
                    width={36}
                    height={36}
                    clipPath={`url(#clip-${marker.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                  {/* Small location pin at bottom */}
                  <circle
                    cx={0}
                    cy={8}
                    r={3}
                    fill="#10b981"
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  {/* Cluster badge */}
                  {marker.clusterCount && marker.clusterCount > 1 && (
                    <>
                      <circle cx={14} cy={-24} r={8} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
                      <text x={14} y={-20} textAnchor="middle" fill="#fff" fontSize={9} fontWeight="bold" fontFamily="sans-serif">{marker.clusterCount}</text>
                    </>
                  )}
                </>
              ) : marker.type === 'recentAlbum' ? (
                <>
                  {/* Album marker — rounded square thumbnail with owner badge */}
                  <defs>
                    <clipPath id={`album-clip-${marker.id}`}>
                      <rect x={-14} y={-22} width={28} height={28} rx={4} />
                    </clipPath>
                    <clipPath id={`album-owner-${marker.id}`}>
                      <circle cx={12} cy={4} r={6} />
                    </clipPath>
                  </defs>
                  {/* Thumbnail background */}
                  <rect x={-14} y={-22} width={28} height={28} rx={4} fill="#1B2B4B" stroke="#E8A838" strokeWidth={1.5} />
                  {/* Cover image */}
                  {marker.coverImageUrl ? (
                    <image
                      href={marker.coverImageUrl}
                      x={-14} y={-22} width={28} height={28}
                      clipPath={`url(#album-clip-${marker.id})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  ) : (
                    <text x={0} y={-6} textAnchor="middle" fill="#E8A838" fontSize={12} fontFamily="sans-serif">📷</text>
                  )}
                  {/* Owner avatar badge */}
                  <circle cx={12} cy={4} r={7} fill="#fff" />
                  {marker.user?.profilePicture ? (
                    <image
                      href={marker.user.profilePicture}
                      x={6} y={-2} width={12} height={12}
                      clipPath={`url(#album-owner-${marker.id})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  ) : (
                    <circle cx={12} cy={4} r={6} fill="#1B2B4B" />
                  )}
                  {/* Cluster badge */}
                  {marker.clusterCount && marker.clusterCount > 1 && (
                    <>
                      <circle cx={-10} cy={-18} r={7} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
                      <text x={-10} y={-14.5} textAnchor="middle" fill="#fff" fontSize={8} fontWeight="bold" fontFamily="sans-serif">{marker.clusterCount}</text>
                    </>
                  )}
                </>
              ) : marker.type === 'upcomingFriendTrip' ? (
                <>
                  {/* Upcoming friend trip — faded pin with calendar glyph */}
                  <g opacity={0.6}>
                    <ellipse cx={0} cy={2} rx={4} ry={2} fill="rgba(0,0,0,0.15)" />
                    <path
                      d="M0,-12 C-6,-12 -8,-6 -8,-4 C-8,2 0,8 0,8 C0,8 8,2 8,-4 C8,-6 6,-12 0,-12"
                      fill="#6366f1"
                      stroke="#fff"
                      strokeWidth={1}
                    />
                    {/* Calendar icon */}
                    <rect x={-4} y={-8} width={8} height={7} rx={1} fill="#fff" />
                    <rect x={-4} y={-8} width={8} height={3} rx={1} fill="#6366f1" />
                    <text x={0} y={-2.5} textAnchor="middle" fill="#6366f1" fontSize={4} fontWeight="bold" fontFamily="sans-serif">
                      {marker.departureDate ? new Date(marker.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', '\n').split('\n')[0] : ''}
                    </text>
                  </g>
                  {/* Owner avatar badge */}
                  {marker.user?.profilePicture && (
                    <>
                      <defs>
                        <clipPath id={`up-clip-${marker.id}`}><circle cx={8} cy={-14} r={5} /></clipPath>
                      </defs>
                      <circle cx={8} cy={-14} r={6} fill="#fff" />
                      <image
                        href={marker.user.profilePicture}
                        x={3} y={-19} width={10} height={10}
                        clipPath={`url(#up-clip-${marker.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </>
                  )}
                  {/* Cluster badge */}
                  {marker.clusterCount && marker.clusterCount > 1 && (
                    <>
                      <circle cx={-8} cy={-14} r={7} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
                      <text x={-8} y={-10.5} textAnchor="middle" fill="#fff" fontSize={8} fontWeight="bold" fontFamily="sans-serif">{marker.clusterCount}</text>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* Pin shadow */}
                  <ellipse
                    cx={0}
                    cy={2}
                    rx={4}
                    ry={2}
                    fill="rgba(0,0,0,0.2)"
                  />
                  {/* Pin body */}
                  <path
                    d="M0,-12 C-6,-12 -8,-6 -8,-4 C-8,2 0,8 0,8 C0,8 8,2 8,-4 C8,-6 6,-12 0,-12"
                    fill={getMarkerColor(marker)}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  {/* Pin center dot */}
                  <circle
                    cx={0}
                    cy={-4}
                    r={3}
                    fill="#fff"
                  />
                </>
              )}
            </g>
            <title>{marker.name}</title>
          </Marker>
          </SafeMarkerBoundary>
        ))}
      </ComposableMap>
      
      {/* Highway Legend */}
      {showHighways && highways.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-gray-600">
          {highways.map(highway => (
            <div key={highway.id} className="flex items-center gap-1">
              <div 
                className="w-4 h-1 rounded"
                style={{ backgroundColor: highway.color }}
              />
              <span>{highway.name}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Marker Legend */}
      {markers.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-gray-600">
          {markers.some(m => m.type === 'campground') && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-green-600">📍</span>
                <span>Visited Campground</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-blue-500">📍</span>
                <span>Planned</span>
              </div>
            </>
          )}
          {markers.some(m => m.type === 'gasStation') && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Truck Stop</span>
            </div>
          )}
          {markers.some(m => m.type === 'restStop') && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-sky-500"></div>
              <span>Rest Area</span>
            </div>
          )}
          {markers.some(m => m.type === 'overnightStop' || m.type === 'freeOvernight') && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ background: '#1B2B4B', border: '1.5px solid #E8A838' }}></div>
              <span>{'\u{1F319}'} Overnight Stop</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
