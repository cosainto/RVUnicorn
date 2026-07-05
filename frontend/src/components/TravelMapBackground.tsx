import { useState, useEffect, memo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import api from '../services/api';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

interface Props {
  username?: string;
  userId?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders the user's US travel map as a faded SVG background.
 * Visited states in campfire orange, unvisited in dark navy.
 * Designed to be used as a card background at low opacity.
 */
function TravelMapBackground({ username, userId, className = '', style = {} }: Props) {
  const [visitedStates, setVisitedStates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = userId || username;
    if (!id) return;
    api.get(`/travel-map/${id}`)
      .then(r => {
        const states = (r.data?.visitedStates || r.data?.states || []).map((s: any) =>
          typeof s === 'string' ? s : s.stateCode || s.state
        );
        setVisitedStates(new Set(states));
      })
      .catch(() => {});
  }, [userId, username]);

  if (visitedStates.size === 0) {
    // Fallback: show campfire scene as subtle background
    return (
      <div className={`absolute inset-0 pointer-events-none ${className}`} style={{ opacity: 0.15, ...style }}>
        <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/v1783212647/rvunicorn/characters/campfire-scene.png"
          alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} style={{ opacity: 0.18, ...style }}>
      <ComposableMap
        projection="geoAlbersUsa"
        width={960}
        height={600}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: any) =>
            geographies.map((geo: any) => {
              const stateId = geo.properties?.name;
              // Match by state name or abbreviation
              const isVisited = visitedStates.has(geo.id) ||
                visitedStates.has(stateId) ||
                visitedStates.has(geo.properties?.STUSPS);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isVisited ? '#E8622A' : '#1B2B4B'}
                  stroke="#2A3F5F"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
}

export default memo(TravelMapBackground);
