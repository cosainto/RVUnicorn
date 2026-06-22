/**
 * RigStatesMap — US choropleth highlighting visited states.
 * Uses react-simple-maps with geoAlbersUsa projection (same as USAMap).
 * Campfire-night styled: gold visited, navy unvisited.
 */
// @ts-ignore — react-simple-maps has no type declarations
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

interface Props {
  visitedStates: string[];
}

export default function RigStatesMap({ visitedStates }: Props) {
  const visitedNames = new Set(visitedStates.map(abbr => STATE_NAMES[abbr]).filter(Boolean));
  const count = visitedStates.length;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 1000 }}
        width={800}
        height={500}
        style={{ background: CN.card }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => {
              const isVisited = visitedNames.has(geo.properties.name);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isVisited ? CN.gold : CN.bg}
                  stroke={CN.border}
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: isVisited ? CN.orange : CN.cardAlt, outline: 'none', cursor: 'default' },
                    pressed: { outline: 'none' },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: `1px solid ${CN.border}` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CN.muted }}>States Visited</span>
        <span className="text-sm font-bold" style={{ color: CN.gold }}>{count} / 50</span>
      </div>
    </div>
  );
}
