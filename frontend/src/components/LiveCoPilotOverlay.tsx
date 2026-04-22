import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation, AlertTriangle, Fuel, Moon, Coffee, ChevronUp, ChevronDown, X, Shield } from 'lucide-react';
import api from '../services/api';
import AlertBanner from './AlertBanner';
import SaveMeModal from './SaveMeModal';
import SubScoreGauges from './basecamp/SubScoreGauges';

interface LiveCoPilotOverlayProps {
  sessionId: string;
  corridorId?: string;
  onEnd: () => void;
  fatigueScore?: number;
  batteryLimitHours?: number;
  gps?: { lat: number; lon: number; speedMph: number; heading: number } | null;
}

interface LiveAlert {
  id: string;
  type: string;
  urgency: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  actionLabel?: string;
  distanceAhead?: number;
}

interface SmartSuggestion {
  type: string;
  name: string;
  distanceFromRoute: number;
  lat: number;
  lon: number;
  reason: string;
  phone?: string | null;
  id: string;
}

interface PingResult {
  currentSegmentIndex: number;
  currentSegment: any;
  nextSegment: any;
  milesRemaining: number;
  etaHours: number;
  alerts: LiveAlert[];
  milesDriven: number;
}

export default function LiveCoPilotOverlay({
  sessionId, corridorId, onEnd, fatigueScore, batteryLimitHours, gps,
}: LiveCoPilotOverlayProps) {
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saveMeActive, setSaveMeActive] = useState(false);
  const [saveMeStops, setSaveMeStops] = useState<any[]>([]);
  const [saveMeLoading, setSaveMeLoading] = useState(false);
  const [subScores, setSubScores] = useState<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const dismissedAlerts = useRef(new Set<string>());

  // Load initial corridor sub-scores
  useEffect(() => {
    if (corridorId) {
      api.get(`/route-copilot/live/${sessionId}`).then(({ data }) => {
        if (data.corridorId) {
          // Try to load corridor scores
          api.post('/route-copilot/corridor-analysis', {}).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [sessionId, corridorId]);

  // Periodic ping
  useEffect(() => {
    const doPing = async () => {
      if (!gps?.lat || !gps?.lon) return;
      try {
        const { data } = await api.post(`/route-copilot/live/${sessionId}/ping`, {
          lat: gps.lat,
          lon: gps.lon,
          speedMph: gps.speedMph || 0,
          heading: gps.heading || 0,
          fatigueScore: fatigueScore ?? 80,
        });
        setPingResult(data);

        // Merge new alerts (don't re-show dismissed ones)
        const newAlerts = (data.alerts || []).filter(
          (a: LiveAlert) => !dismissedAlerts.current.has(a.id)
        );
        if (newAlerts.length > 0) {
          setAlerts(prev => {
            const ids = new Set(prev.map(a => a.id));
            return [...prev, ...newAlerts.filter((a: LiveAlert) => !ids.has(a.id))];
          });
        }
      } catch (e) {
        console.error('[LiveCoPilot] Ping failed:', e);
      }
    };

    // Initial ping
    doPing();

    // Set up interval (3 minutes default)
    pingIntervalRef.current = setInterval(doPing, 180_000);

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [sessionId, gps?.lat, gps?.lon, fatigueScore]);

  // Dismiss alert handler
  const handleDismissAlert = useCallback((id: string) => {
    dismissedAlerts.current.add(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
    api.post(`/route-copilot/live/${sessionId}/dismiss-alert/${id}`).catch(() => {});
  }, [sessionId]);

  // Load smart suggestions
  const loadSuggestions = useCallback(async () => {
    try {
      const { data } = await api.get(`/route-copilot/live/${sessionId}/suggestions`);
      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch {}
  }, [sessionId]);

  // Save Me
  const activateSaveMe = useCallback(async () => {
    if (!gps?.lat || !gps?.lon) return;
    setSaveMeActive(true);
    setSaveMeLoading(true);
    try {
      const { data } = await api.post(`/route-copilot/live/${sessionId}/save-me`, {
        lat: gps.lat,
        lon: gps.lon,
      });
      setSaveMeStops(data.stops || []);
    } catch {}
    setSaveMeLoading(false);
  }, [sessionId, gps]);

  // End session
  const handleEnd = useCallback(async () => {
    try {
      await api.post(`/route-copilot/live/${sessionId}/end`);
    } catch {}
    onEnd();
  }, [sessionId, onEnd]);

  const suggestionIcons: Record<string, any> = {
    FUEL: Fuel,
    REST: Coffee,
    OVERNIGHT: Moon,
    FOOD: Coffee,
  };

  return (
    <>
      {/* Alert Banners — stacked at top */}
      {alerts.length > 0 && (
        <div className="space-y-2 mb-3">
          {alerts.slice(0, 3).map(alert => (
            <AlertBanner
              key={alert.id}
              id={alert.id}
              urgency={alert.urgency}
              title={alert.title}
              body={alert.body}
              actionLabel={alert.actionLabel}
              onDismiss={handleDismissAlert}
            />
          ))}
        </div>
      )}

      {/* Live Status Bar */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Live Co-Pilot</span>
          </div>
          <button onClick={handleEnd} className="text-xs text-white/40 hover:text-white/70 transition flex items-center gap-1">
            <X size={12} /> End
          </button>
        </div>

        {/* Current Status */}
        {pingResult && (
          <div className="px-4 py-3">
            {/* Key metrics row */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{pingResult.milesRemaining}</p>
                <p className="text-[10px] text-white/40">miles left</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{pingResult.etaHours}h</p>
                <p className="text-[10px] text-white/40">ETA</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{pingResult.milesDriven}</p>
                <p className="text-[10px] text-white/40">mi driven</p>
              </div>
            </div>

            {/* Current segment indicator */}
            {pingResult.currentSegment && (
              <div className="flex items-center gap-2 text-xs mb-3">
                <span className="text-white/40">Segment</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  pingResult.currentSegment.riskLevel === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                  pingResult.currentSegment.riskLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {pingResult.currentSegment.riskLevel}
                </span>
                <span className="text-white/60">
                  Mile {pingResult.currentSegment.startMile}-{pingResult.currentSegment.endMile}
                </span>
                {pingResult.currentSegment.weather && (
                  <span className="text-white/40 ml-auto">
                    {pingResult.currentSegment.weather.temp}°F
                    {pingResult.currentSegment.weather.windSpeed ? ` · ${pingResult.currentSegment.weather.windSpeed}mph wind` : ''}
                  </span>
                )}
              </div>
            )}

            {/* Next segment preview */}
            {pingResult.nextSegment && pingResult.nextSegment.riskLevel !== 'LOW' && (
              <div className={`rounded-lg px-3 py-2 text-xs mb-3 ${
                pingResult.nextSegment.riskLevel === 'HIGH' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'
              }`}>
                <span className="font-semibold">Ahead: </span>
                {pingResult.nextSegment.riskFactors?.[0] || `${pingResult.nextSegment.riskLevel} risk zone`}
              </div>
            )}

            {/* Sub-scores (if loaded) */}
            {subScores && (
              <div className="mb-3">
                <SubScoreGauges subScores={subScores} compact />
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={loadSuggestions}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
          >
            <Navigation size={14} /> Smart Stops
          </button>
          <button
            onClick={activateSaveMe}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <Shield size={14} /> Save Me
          </button>
        </div>
      </div>

      {/* Smart Suggestions Drawer */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mt-3 rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-4 py-2 flex items-center justify-between border-b border-white/5">
            <span className="text-xs font-bold text-blue-400">Smart Suggestions</span>
            <button onClick={() => setShowSuggestions(false)} className="text-white/30 hover:text-white/60">
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
            {suggestions.map((s) => {
              const Icon = suggestionIcons[s.type] || Navigation;
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Icon size={16} className="text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-white/40">{s.reason} · {s.distanceFromRoute}mi</p>
                  </div>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`, '_blank')}
                    className="text-[10px] font-bold text-emerald-400 px-2 py-1 rounded-lg bg-emerald-500/10"
                  >
                    Go
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save Me Modal */}
      {saveMeActive && (
        <SaveMeModal
          stops={saveMeStops}
          loading={saveMeLoading}
          onClose={() => setSaveMeActive(false)}
        />
      )}
    </>
  );
}
