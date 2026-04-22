import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Fuel, Clock, Thermometer, Wind, MapPin, Navigation } from 'lucide-react';
import SubScoreGauges from './SubScoreGauges';

interface CorridorSegment {
  index: number;
  startMile: number;
  endMile: number;
  midLat: number;
  midLon: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  weather: { temp: number | null; condition: string | null; windSpeed: number | null } | null;
  fuelStopCount: number;
  restStopCount: number;
  overnightCount: number;
}

interface RiskZone {
  startMile: number;
  endMile: number;
  level: 'MEDIUM' | 'HIGH';
  reasons: string[];
}

interface FuelGap {
  startMile: number;
  endMile: number;
  gapMiles: number;
}

interface Flag {
  id: string;
  type: string;
  severity: string;
  label: string;
  detail?: string;
  action?: string;
  actionUrl?: string;
  deduction: number;
}

interface Props {
  corridorId: string;
  score: number;
  status: 'GO' | 'CAUTION' | 'NO_GO';
  headline: string;
  subheadline: string;
  subScores: { safety: number; comfort: number; convenience: number; flexibility: number };
  flags: Flag[];
  passedChecks: string[];
  metrics: {
    driveMiles: number | null;
    driveHours: number | null;
    fuelEstimate: number | null;
    weatherTemp: number | null;
    weatherCondition: string | null;
    windSpeed: number | null;
  };
  segments: CorridorSegment[];
  riskZones: RiskZone[];
  fuelGaps: FuelGap[];
  onStartLive?: () => void;
}

const statusColors = {
  GO: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', fill: '#22c55e' },
  CAUTION: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', fill: '#f59e0b' },
  NO_GO: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', fill: '#ef4444' },
};

const segmentRiskColors = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
};

export default function RouteCoPilotV2Card({
  score, status, headline, subheadline, subScores,
  flags, passedChecks, metrics, segments, riskZones, fuelGaps, onStartLive,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<CorridorSegment | null>(null);
  const colors = statusColors[status];

  return (
    <div className={`rounded-2xl ${colors.bg} border ${colors.border} overflow-hidden`}>
      {/* Header: Score + Status */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className={`text-2xl font-bold ${colors.text}`}>{score}</div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>{status.replace('_', ' ')}</div>
          </div>
          <div className="text-right">
            <div className="text-white font-semibold text-sm">{headline}</div>
            <div className="text-slate-400 text-xs">{subheadline}</div>
          </div>
        </div>

        {/* Sub-Score Gauges */}
        <SubScoreGauges subScores={subScores} compact />

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {metrics.fuelEstimate !== null && (
            <div className="bg-slate-800/60 rounded-xl p-2 text-center">
              <Fuel size={14} className="mx-auto text-amber-400 mb-1" />
              <div className="text-white text-sm font-bold">${metrics.fuelEstimate}</div>
              <div className="text-slate-400 text-[10px]">Fuel</div>
            </div>
          )}
          {metrics.driveHours !== null && (
            <div className="bg-slate-800/60 rounded-xl p-2 text-center">
              <Clock size={14} className="mx-auto text-blue-400 mb-1" />
              <div className="text-white text-sm font-bold">{metrics.driveHours}h</div>
              <div className="text-slate-400 text-[10px]">Drive</div>
            </div>
          )}
          {metrics.weatherTemp !== null && (
            <div className="bg-slate-800/60 rounded-xl p-2 text-center">
              <Thermometer size={14} className="mx-auto text-orange-400 mb-1" />
              <div className="text-white text-sm font-bold">{metrics.weatherTemp}°</div>
              <div className="text-slate-400 text-[10px]">Temp</div>
            </div>
          )}
          {metrics.driveMiles !== null && (
            <div className="bg-slate-800/60 rounded-xl p-2 text-center">
              <Navigation size={14} className="mx-auto text-purple-400 mb-1" />
              <div className="text-white text-sm font-bold">{metrics.driveMiles}mi</div>
              <div className="text-slate-400 text-[10px]">Distance</div>
            </div>
          )}
        </div>

        {/* Route Corridor Timeline */}
        {segments.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-slate-400 mb-2 font-medium">Route Corridor</div>
            <div className="flex gap-0.5 rounded-lg overflow-hidden">
              {segments.map((seg) => (
                <button
                  key={seg.index}
                  className="flex-1 h-6 relative group transition-all hover:h-8"
                  style={{ backgroundColor: segmentRiskColors[seg.riskLevel], opacity: selectedSegment?.index === seg.index ? 1 : 0.7 }}
                  onClick={() => setSelectedSegment(selectedSegment?.index === seg.index ? null : seg)}
                  title={`Mile ${seg.startMile}-${seg.endMile}: ${seg.riskLevel}`}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/80 opacity-0 group-hover:opacity-100">
                    {seg.startMile}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Mile 0</span>
              <span>Mile {segments[segments.length - 1]?.endMile}</span>
            </div>
          </div>
        )}

        {/* Selected Segment Detail */}
        {selectedSegment && (
          <div className="mt-2 bg-slate-800/60 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-semibold">Mile {selectedSegment.startMile}-{selectedSegment.endMile}</span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ backgroundColor: segmentRiskColors[selectedSegment.riskLevel] + '30', color: segmentRiskColors[selectedSegment.riskLevel] }}
              >
                {selectedSegment.riskLevel}
              </span>
            </div>
            {selectedSegment.weather && (
              <div className="text-slate-300 flex gap-3 mt-1">
                {selectedSegment.weather.temp !== null && <span>{selectedSegment.weather.temp}°F</span>}
                {selectedSegment.weather.condition && <span>{selectedSegment.weather.condition}</span>}
                {selectedSegment.weather.windSpeed !== null && <span><Wind size={10} className="inline mr-0.5" />{selectedSegment.weather.windSpeed}mph</span>}
              </div>
            )}
            <div className="text-slate-400 mt-1 flex gap-3">
              <span><Fuel size={10} className="inline mr-0.5" />{selectedSegment.fuelStopCount} fuel</span>
              <span><MapPin size={10} className="inline mr-0.5" />{selectedSegment.restStopCount} rest</span>
              <span>{selectedSegment.overnightCount} overnight</span>
            </div>
            {selectedSegment.riskFactors.length > 0 && (
              <div className="mt-1 text-amber-400">
                {selectedSegment.riskFactors.map((r, i) => <div key={i}>⚠ {r}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Risk Zones Summary */}
        {riskZones.length > 0 && (
          <div className="mt-3">
            {riskZones.map((zone, i) => (
              <div key={i} className={`text-xs px-3 py-1.5 rounded-lg mb-1 ${zone.level === 'HIGH' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                <AlertTriangle size={10} className="inline mr-1" />
                Risk zone mile {zone.startMile}-{zone.endMile}: {zone.reasons[0]}
              </div>
            ))}
          </div>
        )}

        {/* Fuel Gaps */}
        {fuelGaps.length > 0 && (
          <div className="mt-2">
            {fuelGaps.map((gap, i) => (
              <div key={i} className="text-xs px-3 py-1.5 rounded-lg mb-1 bg-amber-500/15 text-amber-400">
                <Fuel size={10} className="inline mr-1" />
                {Math.round(gap.gapMiles)}mi fuel gap (mile {gap.startMile}-{gap.endMile})
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expandable Flags + Checks */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 border-t border-slate-700/50"
      >
        <span>{flags.length} flag{flags.length !== 1 ? 's' : ''} · {passedChecks.length} passed</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {flags.map((flag) => (
            <div key={flag.id} className="flex items-start gap-2 text-xs">
              <AlertTriangle size={12} className={flag.severity === 'critical' ? 'text-red-400 mt-0.5' : flag.severity === 'high' ? 'text-orange-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
              <div>
                <div className="text-white font-medium">{flag.label}</div>
                {flag.detail && <div className="text-slate-400">{flag.detail}</div>}
              </div>
            </div>
          ))}
          {passedChecks.map((check, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <CheckCircle2 size={12} className="text-emerald-400 mt-0.5" />
              <span className="text-slate-300">{check}</span>
            </div>
          ))}
        </div>
      )}

      {/* Start Live Button */}
      {onStartLive && (
        <button
          onClick={onStartLive}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-emerald-500 hover:to-emerald-400 transition-all"
        >
          <Navigation size={16} />
          Start Live Co-Pilot
        </button>
      )}
    </div>
  );
}
