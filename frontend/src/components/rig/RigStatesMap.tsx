/**
 * RigStatesMap — lightweight inline SVG choropleth of US states.
 * Highlights visited states in gold on navy. No external map library.
 */

const CN = { bg: '#0F1C35', card: '#162236', gold: '#E8A838', muted: '#8B9BB4', border: '#243552' };

// Simplified US state paths (viewBox 0 0 960 600)
const STATES: Record<string, string> = {
  AL: 'M628,434 L627,389 L672,385 L675,430 L669,453 L663,454 L661,448 Z',
  AK: 'M161,485 L183,485 L183,510 L161,510 Z',
  AZ: 'M205,384 L205,443 L247,447 L257,461 L270,442 L272,384 Z',
  AR: 'M580,393 L580,437 L626,434 L627,389 Z',
  CA: 'M121,285 L121,421 L177,434 L196,393 L181,343 L156,296 Z',
  CO: 'M303,303 L303,358 L393,358 L393,303 Z',
  CT: 'M843,218 L843,238 L870,234 L870,215 Z',
  DE: 'M814,295 L820,295 L822,318 L814,318 Z',
  FL: 'M670,453 L686,453 L728,474 L746,509 L729,540 L704,540 L671,508 L660,467 Z',
  GA: 'M672,385 L720,382 L724,435 L690,452 L669,453 L675,430 Z',
  HI: 'M275,498 L298,498 L298,518 L275,518 Z',
  ID: 'M225,158 L240,158 L260,226 L240,264 L215,264 L205,218 Z',
  IL: 'M570,270 L580,270 L586,340 L578,362 L558,362 L555,318 Z',
  IN: 'M610,270 L610,355 L586,355 L586,340 L580,270 Z',
  IA: 'M500,242 L560,242 L570,270 L555,290 L500,290 Z',
  KS: 'M398,340 L500,340 L500,386 L398,386 Z',
  KY: 'M610,355 L690,340 L700,360 L630,380 L586,380 L586,355 Z',
  LA: 'M580,437 L580,485 L620,495 L633,475 L626,434 Z',
  ME: 'M870,130 L895,130 L903,175 L878,192 L860,175 Z',
  MD: 'M760,295 L814,295 L814,318 L770,320 Z',
  MA: 'M843,200 L890,195 L893,210 L843,218 Z',
  MI: 'M590,175 L638,170 L650,228 L622,245 L590,245 L580,210 Z',
  MN: 'M480,140 L545,140 L555,220 L500,242 L480,225 Z',
  MS: 'M610,393 L610,465 L580,470 L580,437 L580,393 Z',
  MO: 'M500,340 L570,325 L578,362 L580,393 L530,393 L500,386 Z',
  MT: 'M250,120 L370,120 L375,185 L250,190 Z',
  NE: 'M380,258 L480,258 L500,290 L500,318 L395,318 Z',
  NV: 'M177,228 L205,228 L205,384 L165,345 L155,296 Z',
  NH: 'M855,148 L868,148 L870,195 L855,200 Z',
  NJ: 'M820,248 L832,245 L835,295 L820,300 Z',
  NM: 'M272,384 L272,460 L345,460 L345,384 Z',
  NY: 'M760,178 L843,175 L843,238 L810,252 L760,245 Z',
  NC: 'M700,360 L790,348 L808,370 L740,384 L720,382 Z',
  ND: 'M390,125 L480,125 L480,185 L390,185 Z',
  OH: 'M645,258 L694,255 L700,320 L686,340 L645,340 Z',
  OK: 'M370,386 L500,386 L500,412 L398,420 L365,400 Z',
  OR: 'M120,162 L195,158 L205,218 L160,234 L120,220 Z',
  PA: 'M710,240 L810,235 L814,295 L710,300 Z',
  RI: 'M870,215 L882,212 L882,228 L870,232 Z',
  SC: 'M720,382 L756,374 L762,410 L724,415 Z',
  SD: 'M390,185 L480,185 L480,258 L395,258 Z',
  TN: 'M590,370 L700,360 L700,392 L590,393 Z',
  TX: 'M345,400 L365,400 L398,420 L500,412 L500,460 L485,520 L420,540 L370,500 L340,460 Z',
  UT: 'M240,264 L303,264 L303,358 L250,358 L240,320 Z',
  VT: 'M840,148 L855,148 L855,200 L843,200 Z',
  VA: 'M700,320 L790,310 L808,348 L790,348 L700,360 Z',
  WA: 'M140,102 L225,102 L225,162 L160,162 L140,140 Z',
  WV: 'M710,300 L740,295 L750,340 L730,355 L700,340 L700,320 Z',
  WI: 'M520,150 L580,150 L590,175 L580,228 L555,225 L540,220 L520,200 Z',
  WY: 'M280,190 L375,190 L380,268 L280,268 Z',
};

interface Props {
  visitedStates: string[];
}

export default function RigStatesMap({ visitedStates }: Props) {
  const visited = new Set(visitedStates.map(s => s.toUpperCase()));
  const count = visited.size;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
      <svg viewBox="100 90 820 470" className="w-full" style={{ maxHeight: 280 }}>
        {Object.entries(STATES).map(([code, path]) => (
          <path
            key={code}
            d={path}
            fill={visited.has(code) ? CN.gold : CN.bg}
            stroke={CN.border}
            strokeWidth="1"
            opacity={visited.has(code) ? 1 : 0.5}
          >
            <title>{code}</title>
          </path>
        ))}
      </svg>
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: `1px solid ${CN.border}` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CN.muted }}>States Visited</span>
        <span className="text-sm font-bold" style={{ color: CN.gold }}>{count} / 50</span>
      </div>
    </div>
  );
}
