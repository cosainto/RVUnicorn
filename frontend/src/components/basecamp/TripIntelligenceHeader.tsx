import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Home, ChevronDown, ChevronUp, RefreshCw, Fuel, Clock, Thermometer, Wind, AlertTriangle, CheckCircle2, Pencil, X, ArrowRight, Tent, Navigation } from 'lucide-react';
import api from '../../services/api';
import PreTripIntelligenceCard from './PreTripIntelligenceCard';
import { formatDistanceToNow } from 'date-fns';

interface DestResult {
  type: 'CAMPGROUND' | 'LOCATION';
  id: string;
  name: string;
  city?: string;
  state?: string;
  lat: number | null;
  lon: number | null;
  maxRvLength?: number | null;
  heroPhotoUrl?: string | null;
  rigFits?: boolean | null;
}

interface QuickReport {
  driveMiles: number | null;
  driveHours: number | null;
  fuelEstimate: number | null;
  fuelGallons: number | null;
  fuelPricePerGallon: number | null;
  weather: { departureDay: any; arrivalDay: any };
  score: number;
  status: 'GO' | 'CAUTION' | 'NO_GO';
  headline: string;
  flags: any[];
  passedChecks: string[];
  rigFit: { fits: boolean; maxLength: number | null } | null;
}

interface UpcomingTrip {
  id: string;
  title: string;
  departureDate: string;
  primaryCampground?: any;
}

const STATUS_COLORS = {
  GO: { dot: '#22c55e', bar: 'from-green-500 to-emerald-400', text: 'text-green-400' },
  CAUTION: { dot: '#E8A838', bar: 'from-amber-500 to-yellow-400', text: 'text-amber-400' },
  NO_GO: { dot: '#ef4444', bar: 'from-red-500 to-orange-400', text: 'text-red-400' },
};

const SEV_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'BLOCKER' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'HIGH' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'MED' },
  low: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'LOW' },
};

export default function TripIntelligenceHeader({ onStartDrive }: { onStartDrive?: () => void } = {}) {
  const navigate = useNavigate();

  // Session data
  const [mode, setMode] = useState<'QUICK' | 'FORMAL'>('QUICK');
  const [upcomingTrips, setUpcomingTrips] = useState<UpcomingTrip[]>([]);
  const [activeTrip, setActiveTrip] = useState<UpcomingTrip | null>(null);

  // Start point
  const [startLabel, setStartLabel] = useState('');
  const [startLat, setStartLat] = useState<number | null>(null);
  const [startLon, setStartLon] = useState<number | null>(null);
  const [editingStart, setEditingStart] = useState(false);
  const [startQuery, setStartQuery] = useState('');
  const [startIcon, setStartIcon] = useState<'home' | 'checkin'>('home');

  // Destination
  const [destLabel, setDestLabel] = useState('');
  const [destLat, setDestLat] = useState<number | null>(null);
  const [destLon, setDestLon] = useState<number | null>(null);
  const [destCampgroundId, setDestCampgroundId] = useState<string | null>(null);
  const [destQuery, setDestQuery] = useState('');
  const [destResults, setDestResults] = useState<DestResult[]>([]);
  const [destFocused, setDestFocused] = useState(false);

  // Quick check results
  const [quickReport, setQuickReport] = useState<QuickReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const saveTimer = useRef<any>(null);
  const searchTimer = useRef<any>(null);

  // ── Load session on mount ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/trip-intelligence/session');
        const { session, upcomingTrips: trips, currentCheckIn, homeLocation } = data;

        setUpcomingTrips(trips || []);

        // Set default start point
        if (currentCheckIn?.lat) {
          setStartLabel(`${currentCheckIn.campgroundName}${currentCheckIn.state ? ', ' + currentCheckIn.state : ''}`);
          setStartLat(currentCheckIn.lat);
          setStartLon(currentCheckIn.lon);
          setStartIcon('checkin');
        } else if (homeLocation?.lat) {
          setStartLabel(homeLocation.label);
          setStartLat(homeLocation.lat);
          setStartLon(homeLocation.lon);
          setStartIcon('home');
        }

        // Restore session
        if (session) {
          if (session.quickStartLat) {
            setStartLabel(session.quickStartLabel || '');
            setStartLat(session.quickStartLat);
            setStartLon(session.quickStartLon);
          }
          if (session.quickDestLabel) {
            setDestLabel(session.quickDestLabel);
            setDestLat(session.quickDestLat);
            setDestLon(session.quickDestLon);
            setDestCampgroundId(session.quickDestCampgroundId);
          }
          if (session.mode === 'FORMAL' && trips?.length > 0) {
            setMode('FORMAL');
            const trip = trips.find((t: any) => t.id === session.activeTripId) || trips[0];
            setActiveTrip(trip);
          }
        }

        // Default to FORMAL if user has trips but no session
        if (!session && trips?.length > 0) {
          setMode('FORMAL');
          setActiveTrip(trips[0]);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  // Auto-run quick check when destination + start are set
  useEffect(() => {
    if (mode !== 'QUICK' || !destLat || !destLon || !startLat || !startLon) return;
    runQuickCheck();
  }, [destLat, destLon, startLat, startLon, mode]);

  // ── Destination search ──────────��──────────────────────────
  useEffect(() => {
    if (destQuery.length < 2) { setDestResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/trip-intelligence/destination-search?q=${encodeURIComponent(destQuery)}`);
        setDestResults(data.results || []);
      } catch { setDestResults([]); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [destQuery]);

  // ── Session persistence (debounced) ────────────────────────
  const persistSession = useCallback((overrides?: any) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put('/trip-intelligence/session', {
        quickStartLabel: startLabel,
        quickStartLat: startLat,
        quickStartLon: startLon,
        quickDestLabel: destLabel,
        quickDestLat: destLat,
        quickDestLon: destLon,
        quickDestCampgroundId: destCampgroundId,
        mode,
        activeTripId: activeTrip?.id || null,
        ...overrides,
      }).catch(() => {});
    }, 1000);
  }, [startLabel, startLat, startLon, destLabel, destLat, destLon, destCampgroundId, mode, activeTrip?.id]);

  // ── Quick check runner ────────────────���────────────────────
  async function runQuickCheck() {
    if (!startLat || !startLon || !destLat || !destLon) return;
    setChecking(true);
    setExpanded(true);
    try {
      const { data } = await api.post('/trip-intelligence/quick-check', {
        startLat, startLon, startLabel,
        destLat, destLon, destLabel,
        campgroundId: destCampgroundId,
      });
      setQuickReport(data);
    } catch { }
    setChecking(false);
  }

  // ── Handlers ────────────────────��──────────────────────────
  function selectDestination(result: DestResult) {
    setDestLabel(result.name + (result.state ? `, ${result.state}` : ''));
    setDestLat(result.lat);
    setDestLon(result.lon);
    setDestCampgroundId(result.type === 'CAMPGROUND' ? result.id : null);
    setDestQuery('');
    setDestResults([]);
    setDestFocused(false);
    persistSession({
      quickDestLabel: result.name + (result.state ? `, ${result.state}` : ''),
      quickDestLat: result.lat,
      quickDestLon: result.lon,
      quickDestCampgroundId: result.type === 'CAMPGROUND' ? result.id : null,
    });
  }

  function clearDestination() {
    setDestLabel('');
    setDestLat(null);
    setDestLon(null);
    setDestCampgroundId(null);
    setQuickReport(null);
    setExpanded(false);
    persistSession({ quickDestLabel: null, quickDestLat: null, quickDestLon: null, quickDestCampgroundId: null });
  }

  function switchMode(newMode: 'QUICK' | 'FORMAL') {
    setMode(newMode);
    if (newMode === 'FORMAL' && upcomingTrips.length > 0) {
      setActiveTrip(upcomingTrips[0]);
    }
    api.put('/trip-intelligence/session', { mode: newMode, activeTripId: newMode === 'FORMAL' ? (upcomingTrips[0]?.id || null) : null }).catch(() => {});
  }

  function selectTrip(trip: UpcomingTrip) {
    setActiveTrip(trip);
    api.put('/trip-intelligence/session', { activeTripId: trip.id }).catch(() => {});
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-2xl p-4" style={{ background: '#0F1C35', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="space-y-3">
          <div className="h-10 bg-white/5 rounded-full animate-pulse" />
          <div className="h-10 bg-white/5 rounded-full animate-pulse" />
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  const colors = quickReport ? STATUS_COLORS[quickReport.status as keyof typeof STATUS_COLORS] : null;
  const hasTrips = upcomingTrips.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header with mode toggle */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#E8A838' }}>Trip Intelligence</p>
        {hasTrips && (
          <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(232,168,56,0.3)' }}>
            <button onClick={() => switchMode('FORMAL')}
              className="px-3 py-1 text-[10px] font-bold transition"
              style={{ background: mode === 'FORMAL' ? '#E8A838' : 'transparent', color: mode === 'FORMAL' ? '#0F1C35' : 'rgba(245,240,232,0.6)' }}>
              📋 My Trip
            </button>
            <button onClick={() => switchMode('QUICK')}
              className="px-3 py-1 text-[10px] font-bold transition"
              style={{ background: mode === 'QUICK' ? '#E8A838' : 'transparent', color: mode === 'QUICK' ? '#0F1C35' : 'rgba(245,240,232,0.6)' }}>
              🔍 Quick Check
            </button>
          </div>
        )}
      </div>

      {/* FROM / TO inputs */}
      <div className="px-4 pb-3 space-y-2">
        {/* FROM */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold w-10 text-right" style={{ color: 'rgba(245,240,232,0.4)' }}>FROM</span>
          {editingStart ? (
            <div className="flex-1 relative">
              <input
                type="text"
                autoFocus
                value={startQuery}
                onChange={(e) => setStartQuery(e.target.value)}
                onBlur={() => setTimeout(() => setEditingStart(false), 200)}
                placeholder="Enter starting location..."
                className="w-full text-sm rounded-full px-4 py-2 outline-none"
                style={{ background: '#1a2d4a', border: '1px solid rgba(232,168,56,0.3)', color: '#F5F0E8' }}
              />
            </div>
          ) : (
            <button onClick={() => { setEditingStart(true); setStartQuery(startLabel); }}
              className="flex-1 flex items-center gap-2 rounded-full px-3 py-2 transition hover:brightness-110"
              style={{ background: '#1a2d4a' }}>
              {startIcon === 'checkin' ? <MapPin className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <Home className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
              <span className="text-sm truncate" style={{ color: startLabel ? '#F5F0E8' : 'rgba(245,240,232,0.4)' }}>
                {startLabel || 'Set your home location →'}
              </span>
              <Pencil className="w-3 h-3 ml-auto flex-shrink-0" style={{ color: 'rgba(245,240,232,0.3)' }} />
            </button>
          )}
        </div>

        {/* TO */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold w-10 text-right" style={{ color: 'rgba(245,240,232,0.4)' }}>TO</span>
          {mode === 'FORMAL' && activeTrip ? (
            <div className="flex-1 flex items-center gap-2 rounded-full px-3 py-2" style={{ background: '#1a2d4a' }}>
              <Tent className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-sm truncate" style={{ color: '#F5F0E8' }}>
                {activeTrip.primaryCampground?.name || activeTrip.title}
              </span>
              <span className="text-[10px] ml-auto flex-shrink-0 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(232,168,56,0.15)', color: '#E8A838' }}>
                {Math.max(0, Math.ceil((new Date(activeTrip.departureDate).getTime() - Date.now()) / 86400000))}d
              </span>
            </div>
          ) : destLabel ? (
            <div className="flex-1 flex items-center gap-2 rounded-full px-3 py-2" style={{ background: '#1a2d4a' }}>
              <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-sm truncate" style={{ color: '#F5F0E8' }}>{destLabel}</span>
              <button onClick={clearDestination} className="ml-auto flex-shrink-0">
                <X className="w-3.5 h-3.5" style={{ color: 'rgba(245,240,232,0.4)' }} />
              </button>
            </div>
          ) : (
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(245,240,232,0.4)' }} />
              <input
                type="text"
                value={destQuery}
                onChange={(e) => setDestQuery(e.target.value)}
                onFocus={() => setDestFocused(true)}
                onBlur={() => setTimeout(() => setDestFocused(false), 200)}
                placeholder="Search campgrounds or enter a city..."
                className="w-full text-sm rounded-full pl-9 pr-4 py-2 outline-none"
                style={{ background: '#1a2d4a', border: '1px solid rgba(232,168,56,0.15)', color: '#F5F0E8' }}
              />
              {/* Dropdown results */}
              {destFocused && destResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 max-h-72 overflow-y-auto"
                  style={{ background: '#0F1C35', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
                  {destResults.map((r) => (
                    <button key={r.id} onMouseDown={() => selectDestination(r)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#1a2d4a'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {r.heroPhotoUrl ? (
                        <img src={r.heroPhotoUrl} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(232,168,56,0.1)' }}>
                          {r.type === 'CAMPGROUND' ? <Tent className="w-4 h-4 text-amber-400" /> : <MapPin className="w-4 h-4 text-blue-400" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#F5F0E8' }}>{r.name}</p>
                        <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.5)' }}>
                          {[r.city, r.state].filter(Boolean).join(', ')}
                          {r.type === 'LOCATION' && ' · Location'}
                        </p>
                      </div>
                      {r.rigFits !== null && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${r.rigFits ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {r.rigFits ? '✓ Fits' : '⚠ Check'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trip switcher for FORMAL mode */}
      {mode === 'FORMAL' && upcomingTrips.length > 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {upcomingTrips.map((t) => {
            const days = Math.max(0, Math.ceil((new Date(t.departureDate).getTime() - Date.now()) / 86400000));
            const active = t.id === activeTrip?.id;
            return (
              <button key={t.id} onClick={() => selectTrip(t)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition whitespace-nowrap"
                style={{ background: active ? 'rgba(232,168,56,0.2)' : 'rgba(255,255,255,0.05)', color: active ? '#E8A838' : 'rgba(245,240,232,0.5)', border: active ? '1px solid rgba(232,168,56,0.4)' : '1px solid transparent' }}>
                {t.title} · {days}d
              </button>
            );
          })}
        </div>
      )}

      {/* ── FORMAL MODE → delegate to PreTripIntelligenceCard ── */}
      {mode === 'FORMAL' && activeTrip && (
        <div className="px-4 pb-4 space-y-3">
          <PreTripIntelligenceCard
            eventId={activeTrip.id}
            tripTitle={activeTrip.title}
            departureDate={activeTrip.departureDate}
            destination={activeTrip.primaryCampground?.name || activeTrip.title}
          />
          {onStartDrive && (
            <button onClick={onStartDrive}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition hover:brightness-110"
              style={{ background: '#1a2d4a', border: '1px solid rgba(232,168,56,0.25)' }}>
              <Navigation className="w-5 h-5 text-amber-400" />
              <div className="flex-1 text-left">
                <p className="text-sm font-bold" style={{ color: '#F5F0E8' }}>Start Driving Mode</p>
                <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.5)' }}>Guardian Mode · Fatigue score · Co-pilot</p>
              </div>
              <span className="text-xs font-semibold" style={{ color: '#E8A838' }}>Start →</span>
            </button>
          )}
        </div>
      )}

      {/* ── QUICK MODE ── */}
      {mode === 'QUICK' && (
        <>
          {/* Empty state */}
          {!destLabel && !checking && (
            <div className="px-4 pb-4 text-center">
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.4)' }}>
                Enter a destination above to see fuel cost, drive time, weather, and rig fit — instantly.
              </p>
            </div>
          )}

          {/* Loading state */}
          {checking && !quickReport && (
            <div className="px-4 pb-4">
              <p className="text-xs text-center mb-3" style={{ color: 'rgba(245,240,232,0.5)' }}>Hitch is checking your route...</p>
              <div className="grid grid-cols-4 gap-2">
                {[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
              </div>
            </div>
          )}

          {/* Quick check results */}
          {quickReport && destLabel && (
            <div className="px-4 pb-4">
              {/* Score bar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors?.dot }} />
                <p className={`text-xs font-bold uppercase tracking-wider ${colors?.text}`}>
                  {quickReport.headline}
                </p>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden ml-2">
                  <div className={`h-full rounded-full bg-gradient-to-r ${colors?.bar}`}
                    style={{ width: `${quickReport.score}%`, transition: 'width 0.6s ease-out' }} />
                </div>
                <span className="text-xs font-bold" style={{ color: 'rgba(245,240,232,0.7)' }}>{quickReport.score}</span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="rounded-xl p-2.5 text-center" style={{ background: '#1a2d4a' }}>
                  <Fuel className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-sm font-bold" style={{ color: '#F5F0E8' }}>{quickReport.fuelEstimate ? `$${quickReport.fuelEstimate}` : '—'}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{quickReport.fuelGallons ? `${quickReport.fuelGallons}gal` : ''}</p>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: '#1a2d4a' }}>
                  <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  <p className="text-sm font-bold" style={{ color: '#F5F0E8' }}>{quickReport.driveHours ? `${quickReport.driveHours}h` : '—'}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{quickReport.driveMiles ? `${quickReport.driveMiles}mi` : ''}</p>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: '#1a2d4a' }}>
                  <Thermometer className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                  <p className="text-sm font-bold" style={{ color: '#F5F0E8' }}>
                    {quickReport.weather?.arrivalDay?.temp != null ? `${quickReport.weather.arrivalDay.temp}°` : '—'}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'rgba(245,240,232,0.4)' }}>
                    {quickReport.weather?.arrivalDay?.condition || 'Weather'}
                  </p>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: '#1a2d4a' }}>
                  {quickReport.rigFit ? (
                    <>
                      <CheckCircle2 className={`w-4 h-4 mx-auto mb-1 ${quickReport.rigFit.fits ? 'text-green-400' : 'text-red-400'}`} />
                      <p className="text-sm font-bold" style={{ color: '#F5F0E8' }}>{quickReport.rigFit.fits ? 'Fits' : 'No'}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{quickReport.rigFit.maxLength}ft max</p>
                    </>
                  ) : (
                    <>
                      <Wind className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                      <p className="text-sm font-bold" style={{ color: '#F5F0E8' }}>
                        {quickReport.weather?.departureDay?.windSpeed ? `${quickReport.weather.departureDay.windSpeed}mph` : '—'}
                      </p>
                      <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Wind</p>
                    </>
                  )}
                </div>
              </div>

              {/* Flags */}
              {quickReport.flags.length > 0 && (
                <div className="space-y-2 mb-3">
                  {quickReport.flags.map((f: any) => {
                    const sev = SEV_BADGE[f.severity] || SEV_BADGE.medium;
                    return (
                      <div key={f.id} className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${f.severity === 'critical' ? '#ef4444' : f.severity === 'high' ? '#D4621A' : '#E8A838'}` }}>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>{sev.label}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold" style={{ color: '#F5F0E8' }}>{f.label}</p>
                          {f.action && (
                            f.actionUrl ? (
                              <Link to={f.actionUrl} className="text-[10px] font-semibold" style={{ color: '#E8A838' }}>{f.action} →</Link>
                            ) : (
                              <p className="text-[10px]" style={{ color: '#E8A838' }}>{f.action}</p>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Passed checks */}
              {quickReport.passedChecks.length > 0 && (
                <div className="space-y-1 mb-3">
                  {quickReport.passedChecks.map((c, i) => (
                    <p key={i} className="text-xs flex items-center gap-1.5" style={{ color: 'rgba(34,197,94,0.8)' }}>
                      <span>✓</span> {c}
                    </p>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 mb-3">
                <Link to={`/road-trips/new?destLabel=${encodeURIComponent(destLabel)}&destLat=${destLat}&destLon=${destLon}${destCampgroundId ? `&destCampgroundId=${destCampgroundId}` : ''}&startLabel=${encodeURIComponent(startLabel)}&startLat=${startLat}&startLon=${startLon}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition"
                  style={{ background: '#E8A838', color: '#0F1C35' }}>
                  Save as Trip <ArrowRight className="w-4 h-4" />
                </Link>
                <button onClick={runQuickCheck} disabled={checking}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-[10px] font-semibold transition disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(245,240,232,0.6)' }}>
                  <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Start Driving */}
              {onStartDrive && (
                <button onClick={onStartDrive}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition hover:brightness-110"
                  style={{ background: '#1a2d4a', border: '1px solid rgba(232,168,56,0.25)' }}>
                  <Navigation className="w-5 h-5 text-amber-400" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold" style={{ color: '#F5F0E8' }}>Start Driving Mode</p>
                    <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.5)' }}>Guardian Mode · Fatigue score · Co-pilot</p>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: '#E8A838' }}>Start →</span>
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
