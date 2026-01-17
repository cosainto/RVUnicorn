import { ComposableMap, Geographies, Geography, Marker, Line } from 'react-simple-maps';

interface MapMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'campground' | 'attraction' | 'visit' | 'gasStation' | 'restStop' | 'home';
  isCurrentlyCamping?: boolean;
  isVisited?: boolean;
  brand?: string;
}

interface HighwayLine {
  id: string;
  name: string;
  color: string;
  coordinates: [number, number][]; // [longitude, latitude]
}

interface USMapSVGProps {
  visitedStates: string[];
  plannedStates?: string[];
  stateColors?: Record<string, string>; // Custom colors per state (e.g., for gas prices)
  markers?: MapMarker[];
  highways?: HighwayLine[]; // Highway lines to render
  showHighways?: boolean;
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
  showHighways = false,
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
              
              // Determine colors based on state
              let fillColor = '#e5e7eb'; // Default gray
              let strokeColor = '#9ca3af';
              let hoverColor = '#d1d5db';
              let pressedColor = '#d1d5db';

              // Priority: customColor > visited > planned > default
              if (customColor) {
                fillColor = customColor;
                strokeColor = darkenColor(customColor, 30);
                hoverColor = lightenColor(customColor, 20);
                pressedColor = darkenColor(customColor, 15);
              } else if (isVisited) {
                fillColor = '#f97316';
                strokeColor = '#ea580c';
                hoverColor = '#fb923c';
                pressedColor = '#ea580c';
              } else if (isPlanned) {
                fillColor = '#93c5fd';
                strokeColor = '#60a5fa';
                hoverColor = '#bfdbfe';
                pressedColor = '#60a5fa';
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
        {markers.map((marker) => (
          <Marker 
            key={marker.id} 
            coordinates={[marker.longitude, marker.latitude]}
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
        </div>
      )}
    </div>
  );
}
