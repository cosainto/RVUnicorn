import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Navigation, Fuel, AlertTriangle, RotateCcw, MapPin, Phone, Bell, Shield } from 'lucide-react';
import api from '../services/api';
import RoadChat from './RoadChat';
import { useAuth } from '../contexts/AuthContext';

// ── Fatigue images (Cloudinary) ───────────────────────────────────────────────
const FATIGUE_IMAGES = {
  ok:    null,
  mild:  'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774843506/rvunicorn/driving-mode/fatigue-4hour.png',
  tired: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774843506/rvunicorn/driving-mode/fatigue-8hour.png',
  danger:'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774843507/rvunicorn/driving-mode/fatigue-12hour.png',
};

// ── Score → UI mapping ────────────────────────────────────────────────────────
type FatigueKey = 'ok' | 'mild' | 'tired' | 'danger';

function getScoreInfo(score: number) {
  if (score >= 76) return { label: '🔴 Critical', ringColor: '#ef4444', textColor: 'text-red-400',    bg: 'bg-red-950',    border: 'border-red-700',    fatigueKey: 'danger' as FatigueKey };
  if (score >= 51) return { label: '🟠 Drifting', ringColor: '#f97316', textColor: 'text-orange-400', bg: 'bg-orange-950', border: 'border-orange-700', fatigueKey: 'tired'  as FatigueKey };
  if (score >= 26) return { label: '🟡 Alert',    ringColor: '#eab308', textColor: 'text-yellow-400', bg: 'bg-yellow-950', border: 'border-yellow-700', fatigueKey: 'mild'   as FatigueKey };
  return             { label: '🟢 Fresh',         ringColor: '#22c55e', textColor: 'text-green-400',  bg: 'bg-green-950',  border: 'border-green-700',  fatigueKey: 'ok'     as FatigueKey };
}

// ── Pure fatigue score (easy to unit-test) ────────────────────────────────────
function computeFatigueScore(params: {
  elapsedSeconds: number;
  multiDayLoad: number;
  dismissedHighAlert: boolean;
  recentChecks: string[];
  passengerFlagActive: boolean;
}): number {
  const { elapsedSeconds, multiDayLoad, dismissedHighAlert, recentChecks, passengerFlagActive } = params;
  const hours = elapsedSeconds / 3600;

  // Base score from drive duration
  let score = 0;
  if (hours >= 8)      score = 80 + Math.min((hours - 8) * 5, 20);
  else if (hours >= 6) score = 60 + (hours - 6) * 10;
  else if (hours >= 4) score = 35 + (hours - 4) * 12.5;
  else if (hours >= 2) score = 10 + (hours - 2) * 12.5;
  else if (hours >= 1) score = hours * 10;

  // Time-of-day penalty: 10 pm – 6 am
  const h = new Date().getHours();
  if (h >= 22 || h < 6) score += 15;

  // Multi-day fatigue carryover
  if (multiDayLoad > 6) score += 10;
  else if (multiDayLoad > 4) score += 5;

  // Driver dismissed a high-level alert without stopping
  if (dismissedHighAlert) score += 5;

  // Recent alertness check history
  const tiredCount = recentChecks.slice(-3).filter(c => c === 'tired').length;
  score += tiredCount * 5;

  // Passenger flagged fatigue (active for 30 min)
  if (passengerFlagActive) score += 10;

  return Math.min(Math.max(Math.round(score), 0), 100);
}

// ── Circular fatigue ring (SVG) ───────────────────────────────────────────────
function FatigueRing({ score, ringColor }: { score: number; ringColor: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = circ * (score / 100);
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="mx-auto">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#1f2937" strokeWidth="14" />
      <circle
        cx="70" cy="70" r={r} fill="none"
        stroke={ringColor} strokeWidth="14"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 1.2s ease, stroke 0.8s ease' }}
      />
      <text x="70" y="63" textAnchor="middle" fill="white" fontSize="30" fontWeight="bold" fontFamily="monospace">{score}</text>
      <text x="70" y="83" textAnchor="middle" fill="#6b7280" fontSize="10" letterSpacing="1">FATIGUE</text>
    </svg>
  );
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, '0')}s`;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface DrivingModeProps {
  nextEvent?: { title: string; campground?: { name: string; latitude?: number; longitude?: number; phone?: string } } | null;
  rvMpg?: number;
  onExit: () => void;
}

// ── localStorage key constants ────────────────────────────────────────────────
const LS = {
  driveStart:        'rvunicorn_drive_start',
  driveRole:         'rvunicorn_drive_role',
  fatigueScore:      'rvu_fatigue_score',
  lastStop:          'rvu_last_stop_time',
  alertnessChecks:   'rvu_alertness_checks',
  multiDayLoad:      'rvu_multi_day_load',
  driveHistory:      'rvu_drive_history',
  passengerSuggest:  'rvu_passenger_suggest_stop',
  passengerFlag:     'rvu_passenger_flag_fatigue',
  passengerOverride: 'rvu_passenger_override',
  driverNoResponse:  'rvu_driver_no_response',
};

// ═════════════════════════════════════════════════════════════════════════════
export default function DrivingMode({ nextEvent, onExit }: DrivingModeProps) {
  useAuth(); // session context

  // ── Core session ──────────────────────────────────────────────────────────
  const [role, setRole] = useState<'driver' | 'passenger'>(() =>
    (localStorage.getItem(LS.driveRole) as 'driver' | 'passenger') || 'driver'
  );
  const [sessionStart, setSessionStart] = useState<number>(() => {
    const saved = localStorage.getItem(LS.driveStart);
    return saved ? parseInt(saved) : Date.now();
  });
  const [elapsed, setElapsed] = useState(0);
  const [isStopped, setIsStopped] = useState(false);
  const [stopStart, setStopStart] = useState<number | null>(null);
  const [stoppedElapsed, setStoppedElapsed] = useState(0);
  const [totalStopTime, setTotalStopTime] = useState(0);
  const [breakCount, setBreakCount] = useState(0);
  const [longestDriveStretch, setLongestDriveStretch] = useState(0);
  const [currentStretchStart, setCurrentStretchStart] = useState<number>(Date.now());
  const [lastStopTimestamp, setLastStopTimestamp] = useState<number | null>(() => {
    const saved = localStorage.getItem(LS.lastStop);
    return saved ? parseInt(saved) : null;
  });

  // ── Smart Fatigue Engine ──────────────────────────────────────────────────
  const [fatigueScore, setFatigueScore] = useState(0);
  const [alertnessChecks, setAlertnessChecks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS.alertnessChecks) || '[]'); } catch { return []; }
  });
  const [multiDayLoad] = useState<number>(() =>
    parseFloat(localStorage.getItem(LS.multiDayLoad) || '0')
  );
  const [dismissedHighAlert, setDismissedHighAlert] = useState(false);
  const [passengerFlagActive, setPassengerFlagActive] = useState(false);
  const [passengerFlagExpiry, setPassengerFlagExpiry] = useState<number | null>(null);
  const elapsedRef = useRef(0);

  // ── Predictive Stop Banner ────────────────────────────────────────────────
  const [predictiveBannerVisible, setPredictiveBannerVisible] = useState(false);
  const [predictiveDismissedAt, setPredictiveDismissedAt] = useState<number | null>(null);

  // ── Alertness Check Loop ──────────────────────────────────────────────────
  const [alertnessCheckVisible, setAlertnessCheckVisible] = useState(false);
  const [alertnessNoRespSecs, setAlertnessNoRespSecs] = useState(0);
  const [alertnessPassengerAlert, setAlertnessPassengerAlert] = useState(false);
  const [lastAlertnessAt, setLastAlertnessAt] = useState<number>(Date.now());
  const alertnessCheckRef = useRef<NodeJS.Timeout | null>(null);
  const alertnessNoRespRef = useRef<NodeJS.Timeout | null>(null);

  // ── Passenger Co-Pilot ────────────────────────────────────────────────────
  const [passengerSuggestion, setPassengerSuggestion] = useState<string | null>(null);
  const [driverNoResponse, setDriverNoResponse] = useState(false);
  const [passengerFindingStops, setPassengerFindingStops] = useState(false);

  // ── Stops & Planner ───────────────────────────────────────────────────────
  const [nearbyStops, setNearbyStops] = useState<any[]>([]);
  const [showStops, setShowStops] = useState(false);
  const [showStopPlanner, setShowStopPlanner] = useState(false);
  const [stopReason, setStopReason] = useState('');
  const [loadingStops, setLoadingStops] = useState(false);

  // ── Stats & Debrief ───────────────────────────────────────────────────────
  const [showStats, setShowStats] = useState(false);
  const [showRoadChat, setShowRoadChat] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [aiDebrief, setAiDebrief] = useState('');
  const [loadingDebrief, setLoadingDebrief] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scoreIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const scoreInfo = getScoreInfo(fatigueScore);

  // ═══ Effects ══════════════════════════════════════════════════════════════

  // Persist session to localStorage
  useEffect(() => {
    localStorage.setItem(LS.driveStart, String(sessionStart));
    localStorage.setItem(LS.driveRole, role);
  }, [sessionStart, role]);

  // Keep elapsedRef in sync (used by score interval without re-triggering it)
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // Drive timer — pauses when stopped
  useEffect(() => {
    if (isStopped) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionStart, isStopped]);

  // Stop timer — counts up while stopped
  useEffect(() => {
    if (isStopped && stopStart) {
      stopTimerRef.current = setInterval(() => {
        setStoppedElapsed(Math.floor((Date.now() - stopStart) / 1000));
      }, 1000);
    } else {
      if (stopTimerRef.current) clearInterval(stopTimerRef.current);
      setStoppedElapsed(0);
    }
    return () => { if (stopTimerRef.current) clearInterval(stopTimerRef.current); };
  }, [isStopped, stopStart]);

  // Fatigue score — recalc every 60 s (and immediately on factor changes)
  useEffect(() => {
    const recalc = () => {
      const score = computeFatigueScore({
        elapsedSeconds: elapsedRef.current,
        multiDayLoad,
        dismissedHighAlert,
        recentChecks: alertnessChecks,
        passengerFlagActive,
      });
      setFatigueScore(score);
      localStorage.setItem(LS.fatigueScore, String(score));
    };
    recalc();
    scoreIntervalRef.current = setInterval(recalc, 60_000);
    return () => { if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current); };
  }, [multiDayLoad, dismissedHighAlert, alertnessChecks, passengerFlagActive]);

  // Expire passenger fatigue flag after 30 min
  useEffect(() => {
    if (!passengerFlagExpiry) return;
    const remaining = passengerFlagExpiry - Date.now();
    if (remaining <= 0) { setPassengerFlagActive(false); setPassengerFlagExpiry(null); return; }
    const t = setTimeout(() => { setPassengerFlagActive(false); setPassengerFlagExpiry(null); }, remaining);
    return () => clearTimeout(t);
  }, [passengerFlagExpiry]);

  // Predictive Stop Banner — evaluate whenever score or time factors shift
  useEffect(() => {
    if (role !== 'driver' || isStopped || showStats) { setPredictiveBannerVisible(false); return; }
    const dismissed20min = predictiveDismissedAt && (Date.now() - predictiveDismissedAt < 20 * 60 * 1000);
    if (dismissed20min) { setPredictiveBannerVisible(false); return; }

    const hour = new Date().getHours();
    const sinceLastStop = Date.now() - (lastStopTimestamp ?? sessionStart);
    const noStopIn2h30 = sinceLastStop > 2.5 * 60 * 60 * 1000;
    const eveningAndFatigue = hour >= 21 && fatigueScore > 50;
    const trendingCritical = fatigueScore > 55;

    setPredictiveBannerVisible(noStopIn2h30 || eveningAndFatigue || trendingCritical);
  }, [fatigueScore, role, isStopped, predictiveDismissedAt, lastStopTimestamp, sessionStart, showStats]);

  // Alertness Check Loop — interval adapts to score; survives tab switches
  useEffect(() => {
    if (role !== 'driver' || isStopped) return;
    const getIntervalMs = () => {
      if (fatigueScore >= 76) return 15 * 60 * 1000;
      if (fatigueScore >= 51) return 25 * 60 * 1000;
      return 45 * 60 * 1000;
    };
    const maybeShow = () => {
      if (alertnessCheckVisible || isStopped) return;
      if (Date.now() - lastAlertnessAt >= getIntervalMs()) {
        setAlertnessCheckVisible(true);
        setAlertnessNoRespSecs(0);
      }
    };
    alertnessCheckRef.current = setInterval(maybeShow, 15_000);
    document.addEventListener('visibilitychange', maybeShow);
    return () => {
      if (alertnessCheckRef.current) clearInterval(alertnessCheckRef.current);
      document.removeEventListener('visibilitychange', maybeShow);
    };
  }, [role, isStopped, fatigueScore, lastAlertnessAt, alertnessCheckVisible]);

  // Alertness no-response escalation (60 s pulse → 120 s passenger alert → 180 s stop forced)
  useEffect(() => {
    if (!alertnessCheckVisible) {
      if (alertnessNoRespRef.current) clearInterval(alertnessNoRespRef.current);
      setAlertnessNoRespSecs(0);
      setAlertnessPassengerAlert(false);
      return;
    }
    alertnessNoRespRef.current = setInterval(() => {
      setAlertnessNoRespSecs(prev => {
        const next = prev + 1;
        if (next === 120) {
          setAlertnessPassengerAlert(true);
          localStorage.setItem(LS.driverNoResponse, String(Date.now()));
        }
        if (next >= 180) {
          setAlertnessCheckVisible(false);
          setShowStopPlanner(true);
        }
        return next;
      });
    }, 1000);
    return () => { if (alertnessNoRespRef.current) clearInterval(alertnessNoRespRef.current); };
  }, [alertnessCheckVisible]);

  // Driver: poll localStorage for passenger → driver signals every 5 s
  useEffect(() => {
    if (role !== 'driver') return;
    const poll = setInterval(() => {
      const suggest = localStorage.getItem(LS.passengerSuggest);
      if (suggest) { setPassengerSuggestion(suggest); localStorage.removeItem(LS.passengerSuggest); }

      const flag = localStorage.getItem(LS.passengerFlag);
      if (flag) {
        setPassengerFlagActive(true);
        setPassengerFlagExpiry(parseInt(flag) + 30 * 60 * 1000);
        localStorage.removeItem(LS.passengerFlag);
      }

      const override = localStorage.getItem(LS.passengerOverride);
      if (override) { setShowStopPlanner(true); localStorage.removeItem(LS.passengerOverride); }
    }, 5_000);
    return () => clearInterval(poll);
  }, [role]);

  // Passenger: poll for driver no-response signal every 3 s
  useEffect(() => {
    if (role !== 'passenger') return;
    const poll = setInterval(() => {
      const ts = localStorage.getItem(LS.driverNoResponse);
      setDriverNoResponse(!!ts && Date.now() - parseInt(ts) < 90_000);
    }, 3_000);
    return () => clearInterval(poll);
  }, [role]);

  // ═══ Handlers ════════════════════════════════════════════════════════════

  const loadNearbyStops = useCallback(async () => {
    setLoadingStops(true);
    const doFetch = async (lat: number, lng: number) => {
      try {
        const { data } = await api.get(`/overnight-spots/near?lat=${lat}&lng=${lng}&radius=100&limit=8`);
        setNearbyStops(data || []);
        try { localStorage.setItem('rvu_cached_stops', JSON.stringify({ ts: Date.now(), stops: data || [] })); } catch {}
      } catch {
        try {
          const cached = JSON.parse(localStorage.getItem('rvu_cached_stops') || 'null');
          if (cached?.stops) setNearbyStops(cached.stops);
        } catch {}
      }
      setLoadingStops(false);
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => doFetch(pos.coords.latitude, pos.coords.longitude),
        () => doFetch(nextEvent?.campground?.latitude || 39.5, nextEvent?.campground?.longitude || -98.35),
        { timeout: 5000 }
      );
    } else {
      doFetch(nextEvent?.campground?.latitude || 39.5, nextEvent?.campground?.longitude || -98.35);
    }
  }, [nextEvent]);

  // Cache safety data on drive start for offline use
  useEffect(() => {
    try { localStorage.setItem('rvu_emergency_cache', JSON.stringify({ goodSam: '18008472869', coachNet: '18008632428', cachedAt: Date.now() })); } catch {}
    loadNearbyStops();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStopDriving = () => {
    const stretchSecs = Math.floor((Date.now() - currentStretchStart) / 1000);
    setLongestDriveStretch(prev => Math.max(prev, stretchSecs));
    const now = Date.now();
    setIsStopped(true);
    setStopStart(now);
    setBreakCount(prev => prev + 1);
    setLastStopTimestamp(now);
    localStorage.setItem(LS.lastStop, String(now));
    setShowStopPlanner(true);
  };

  const handleResumeDriving = () => {
    const stopDuration = stopStart ? Math.floor((Date.now() - stopStart) / 1000) : 0;
    setTotalStopTime(prev => prev + stopDuration);
    setIsStopped(false);
    setStopStart(null);
    setCurrentStretchStart(Date.now());
    setSessionStart(Date.now() - elapsed * 1000);
    setShowStops(false);
    setShowStopPlanner(false);
    setPassengerSuggestion(null);
  };

  const handleFindStops = (reason: string) => {
    setStopReason(reason);
    setShowStops(true);
    setShowStopPlanner(false);
    loadNearbyStops();
  };

  const handleAlertness = (response: 'good' | 'tired' | 'break') => {
    const updated = [...alertnessChecks.slice(-4), response];
    setAlertnessChecks(updated);
    localStorage.setItem(LS.alertnessChecks, JSON.stringify(updated));
    setLastAlertnessAt(Date.now());
    setAlertnessCheckVisible(false);
    localStorage.removeItem(LS.driverNoResponse);
    if (response === 'break') setShowStopPlanner(true);
  };

  const switchDriver = () => {
    setSessionStart(Date.now());
    setElapsed(0);
    setDismissedHighAlert(false);
    setAlertnessChecks([]);
    setLastAlertnessAt(Date.now());
    setRole(prev => prev === 'driver' ? 'passenger' : 'driver');
  };

  const handleExitWithStats = async () => {
    const grade = getDriveGrade();

    // Persist drive history for multi-day load tracking
    try {
      const prev = JSON.parse(localStorage.getItem(LS.driveHistory) || '[]');
      prev.push({ date: new Date().toISOString().slice(0, 10), hours: elapsed / 3600, grade });
      localStorage.setItem(LS.driveHistory, JSON.stringify(prev.slice(-3)));
      localStorage.setItem(LS.multiDayLoad, String(elapsed / 3600));
    } catch {}

    setShowStats(true);
    setLoadingDebrief(true);

    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
    const driveHours = parseFloat((elapsed / 3600).toFixed(1));
    const stopMins = Math.round(totalStopTime / 60);
    const longestStretchHours = parseFloat((longestDriveStretch / 3600).toFixed(1));
    const hour = new Date().getHours();
    const timeOfDay = hour >= 22 || hour < 6 ? 'late night (10pm–6am)' : hour >= 18 ? 'evening' : 'daytime';

    // Save drive session to backend
    try {
      await fetch('/api/drive-sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          totalDriveSeconds: elapsed,
          totalStopSeconds: totalStopTime,
          breakCount,
          longestStretchSecs: longestDriveStretch,
          fatigueScoreAtEnd: fatigueScore,
          grade,
          alertnessChecks,
        }),
      });
    } catch { /* non-critical — don't block debrief */ }

    // Get AI debrief from dedicated endpoint
    try {
      const res = await fetch('/api/hitch/drive-debrief', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          grade,
          driveHours,
          stopMins,
          breakCount,
          longestStretchHours,
          fatigueScore,
          alertnessChecks,
          timeOfDay,
        }),
      });
      const data = await res.json();
      setAiDebrief(data.debrief || '');
    } catch {
      setAiDebrief('Great drive! Keep taking regular breaks and stay hydrated on your next trip.');
    }

    setLoadingDebrief(false);
  };

  // Passenger co-pilot actions
  const passengerSuggestStop = () => {
    localStorage.setItem(LS.passengerSuggest, 'Your passenger thinks you should stop soon.');
    showToast('Stop suggestion sent to driver 💬');
  };

  const passengerFlagFatigue = () => {
    localStorage.setItem(LS.passengerFlag, String(Date.now()));
    showToast('Fatigue flag sent — sensitivity increased 😴', 'info');
  };

  const passengerSoftOverride = () => {
    localStorage.setItem(LS.passengerOverride, '1');
    showToast('Override request sent to driver ⚡', 'info');
  };

  // Destination helpers
  const dest = nextEvent?.campground;
  const GMAPS_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';
  const [showInlineMap, setShowInlineMap] = useState(false);
  const [userGeoStr, setUserGeoStr] = useState('current+location');
  const [roadTripStops, setRoadTripStops] = useState<Array<{ id: string; title: string; latitude?: number; longitude?: number; stopNumber?: number }>>([]);

  // Get current GPS position for map origin
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserGeoStr(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => setUserGeoStr('current+location'),
        { timeout: 5000 }
      );
    }
  }, []);

  // Fetch road trip stops for this event so we can build a multi-waypoint route
  useEffect(() => {
    if (!nextEvent?.id) return;
    const fetchStops = async () => {
      try {
        // Check if this event is part of a road trip
        const res = await api.get(`/events/${nextEvent.id}`);
        const ev = res.data;
        if (!ev?.roadTripId) return;
        // Fetch all stops for this road trip
        const rtRes = await api.get(`/road-trips/${ev.roadTripId}`);
        const stops = rtRes.data?.stops || [];
        // Map each stop to lat/lng via its campground
        const withCoords = stops
          .filter((s: any) => s.campground?.latitude && s.campground?.longitude)
          .map((s: any) => ({
            id: s.id,
            title: s.campground?.name || s.title,
            latitude: s.campground.latitude,
            longitude: s.campground.longitude,
            stopNumber: s.stopNumber,
          }))
          .sort((a: any, b: any) => (a.stopNumber || 0) - (b.stopNumber || 0));
        if (withCoords.length > 0) setRoadTripStops(withCoords);
      } catch {
        // Not a road trip event or fetch failed — single destination fallback
      }
    };
    fetchStops();
  }, [nextEvent?.id]);

  // Build Google Maps embed URL — multi-waypoint if road trip, single dest otherwise
  const buildMapUrl = () => {
    if (roadTripStops.length > 1) {
      // Multi-stop route: origin → waypoints → final destination
      const stops = roadTripStops;
      const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
      const waypoints = stops.slice(0, -1).map(s => `${s.latitude},${s.longitude}`).join('|');
      return `https://www.google.com/maps/embed/v1/directions?key=${GMAPS_KEY}&origin=${userGeoStr}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&mode=driving`;
    }
    if (dest?.latitude) {
      return `https://www.google.com/maps/embed/v1/directions?key=${GMAPS_KEY}&origin=${userGeoStr}&destination=${dest.latitude},${dest.longitude}&mode=driving`;
    }
    return null;
  };

  const inlineMapUrl = buildMapUrl();
  const wazeUrl = (() => {
    if (roadTripStops.length > 0) {
      // Waze to next unvisited stop (first stop in list)
      const next = roadTripStops[0];
      return `https://waze.com/ul?ll=${next.latitude},${next.longitude}&navigate=yes`;
    }
    return dest?.latitude ? `https://waze.com/ul?ll=${dest.latitude},${dest.longitude}&navigate=yes` : null;
  })();

  // Map label
  const mapStopLabel = roadTripStops.length > 1
    ? `${roadTripStops.length}-stop Road Trip Route`
    : dest?.name || 'Destination';

  // Drive grade helper (used in two places)
  const getDriveGrade = () =>
    fatigueScore <= 40 && longestDriveStretch < 10800 ? 'A'
    : fatigueScore <= 60 ? 'B'
    : fatigueScore <= 75 ? 'C' : 'D';

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${scoreInfo.textColor}`} />
          <span className={`text-sm font-bold ${scoreInfo.textColor}`}>{scoreInfo.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRole(r => r === 'driver' ? 'passenger' : 'driver')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
              role === 'driver' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            {role === 'driver' ? '🚐 Driver' : '🗺️ Passenger'}
          </button>
          <button onClick={handleExitWithStats} className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1.5">Exit</button>
        </div>
      </div>

      {/* ── Toast notification ──────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-700 text-green-100' :
          toast.type === 'info' ? 'bg-blue-800 text-blue-100' :
          'bg-red-800 text-red-100'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ══════════════════════════ DRIVER MODE ══════════════════════════════ */}
      {role === 'driver' && (
        <div className="flex-1 flex flex-col px-4 py-5 gap-4">

          {/* ── Alertness Check Modal ────────────────────────────────────── */}
          {alertnessCheckVisible && (
            <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
              <div className={`w-full max-w-sm rounded-2xl p-6 border-2 ${
                alertnessNoRespSecs >= 60 ? 'bg-red-950 border-red-500 animate-pulse' : 'bg-gray-900 border-blue-600'
              }`}>
                <div className="text-center mb-5">
                  <Bell className="w-10 h-10 mx-auto mb-3 text-blue-400" />
                  <p className="text-xl font-bold">Still feeling alert?</p>
                  {alertnessNoRespSecs >= 60 && alertnessNoRespSecs < 120 && (
                    <p className="text-sm text-red-400 mt-2 animate-pulse">⚠️ Tap to confirm you're okay</p>
                  )}
                  {alertnessPassengerAlert && (
                    <p className="text-sm text-orange-400 mt-2">🗺️ Passenger has been notified</p>
                  )}
                </div>
                <div className="space-y-2">
                  <button onClick={() => handleAlertness('good')}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-lg transition">
                    ✅ Yes, I'm Good
                  </button>
                  <button onClick={() => handleAlertness('tired')}
                    className="w-full py-3.5 bg-yellow-700 hover:bg-yellow-600 rounded-xl font-bold transition">
                    😴 Getting Tired
                  </button>
                  <button onClick={() => handleAlertness('break')}
                    className="w-full py-3.5 bg-red-700 hover:bg-red-600 rounded-xl font-bold transition">
                    🛑 Need a Break
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Driver Co-Pilot Chat Feed (read-only) ───────────────────── */}
          {(() => {
            let msgs: { text: string; from: string; ts: number }[] = [];
            try { msgs = JSON.parse(localStorage.getItem('rvu_copilot_chat') || '[]'); } catch {}
            if (msgs.length === 0) return null;
            return (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                <p className="text-xs text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Co-Pilot Messages
                </p>
                <div className="px-4 pb-3 space-y-2 max-h-32 overflow-y-auto">
                  {msgs.slice(-6).map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="max-w-[90%] rounded-2xl px-3 py-2 text-xs bg-purple-900 text-purple-100">
                        <p className="font-semibold text-[10px] mb-0.5 opacity-70">🗺️ Passenger</p>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Passenger suggestion card ────────────────────────────────── */}
          {passengerSuggestion && (
            <div className="bg-purple-950 border border-purple-600 rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">🗺️</span>
                <p className="text-sm text-purple-200 truncate">{passengerSuggestion}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { setShowStopPlanner(true); setPassengerSuggestion(null); }}
                  className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded-lg transition">Stop</button>
                <button onClick={() => setPassengerSuggestion(null)} className="text-xs text-purple-500">✕</button>
              </div>
            </div>
          )}

          {/* ── Predictive Stop Banner ───────────────────────────────────── */}
          {predictiveBannerVisible && !isStopped && (
            <div className="bg-amber-950 border border-amber-600 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-amber-300">📍 Recommended stop in ~30 min</p>
                <button
                  onClick={() => { setPredictiveDismissedAt(Date.now()); setPredictiveBannerVisible(false); }}
                  className="text-xs text-amber-600 hover:text-amber-400">✕</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleFindStops('Rest')}
                  className="flex-1 py-2 bg-amber-700 hover:bg-amber-600 rounded-xl text-xs font-bold transition">
                  View Stops
                </button>
                {nearbyStops[0]?.latitude && (
                  <a
                    href={`https://waze.com/ul?ll=${nearbyStops[0].latitude},${nearbyStops[0].longitude}&navigate=yes`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 rounded-xl text-xs font-bold text-center transition"
                  >
                    Waze →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Fatigue Ring + Drive Timer ───────────────────────────────── */}
          <div className={`rounded-2xl p-5 border ${isStopped ? 'bg-blue-950 border-blue-700' : scoreInfo.bg + ' ' + scoreInfo.border}`}>
            {isStopped ? (
              <div className="text-center">
                <p className="text-xs text-blue-300 mb-1 uppercase tracking-wide">Stopped</p>
                <p className="text-5xl font-bold tabular-nums text-blue-300">{formatTime(stoppedElapsed)}</p>
                <p className="text-xs text-blue-600 mt-2">Drive time paused · {formatTime(elapsed)} driven so far</p>
                <button onClick={handleResumeDriving}
                  className="mt-4 w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-base transition">
                  ▶ Resume Driving
                </button>
              </div>
            ) : (
              <div className="text-center">
                <FatigueRing score={fatigueScore} ringColor={scoreInfo.ringColor} />
                <p className="text-xs text-gray-500 mt-2 mb-0.5">Time Driving</p>
                <p className="text-3xl font-bold tabular-nums">{formatTime(elapsed)}</p>
                <p className="text-xs text-gray-600 mt-1">Safe limit: 8 hrs · Stop by: 10 hrs</p>
              </div>
            )}
          </div>

          {/* ── Critical intervention (score ≥ 76) ──────────────────────── */}
          {fatigueScore >= 76 && !isStopped && (
            <div className="bg-red-950 border-2 border-red-500 rounded-2xl p-4">
              <img src={FATIGUE_IMAGES.danger!} alt="danger" className="w-20 h-20 object-cover rounded-xl mx-auto mb-3" />
              <p className="text-center font-black text-xl mb-1">🚨 PULL OVER NOW</p>
              <p className="text-center text-sm text-red-300 mb-4">Fatigue score critical. This is not safe to continue.</p>
              <button onClick={() => { setDismissedHighAlert(true); handleStopDriving(); }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition">
                🛑 Find a Stop Now
              </button>
            </div>
          )}

          {/* ── Drifting nudge (score 51–75) ─────────────────────────────── */}
          {fatigueScore >= 51 && fatigueScore < 76 && !isStopped && (
            <div className="bg-orange-950 border border-orange-700 rounded-2xl p-4">
              {FATIGUE_IMAGES.tired && (
                <img src={FATIGUE_IMAGES.tired} alt="tired" className="w-16 h-16 object-cover rounded-xl mx-auto mb-2" />
              )}
              <p className="text-center font-bold text-lg mb-3">⚠️ You're Drifting</p>
              <div className="flex gap-2">
                <button onClick={() => setDismissedHighAlert(true)}
                  className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 rounded-xl text-sm font-bold transition">
                  👍 I'm Good
                </button>
                <button onClick={() => setShowStopPlanner(true)}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 rounded-xl text-sm font-bold transition">
                  🛑 Need Stop
                </button>
              </div>
            </div>
          )}

          {/* ── Destination ──────────────────────────────────────────────── */}
          {dest && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <p className="text-xs text-gray-500 mb-2">Destination</p>
              <p className="font-bold text-lg mb-3">{dest.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {inlineMapUrl && (
                  <button
                    onClick={() => setShowInlineMap(v => !v)}
                    className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold transition"
                  >
                    <Navigation className="w-4 h-4" />
                    {showInlineMap ? 'Hide Map' : roadTripStops.length > 1 ? `Show ${roadTripStops.length}-Stop Route` : 'Show Route Map'}
                  </button>
                )}
                {wazeUrl && (
                  <a href={wazeUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-bold transition">
                    <span className="text-base">🗺️</span> Open Waze
                  </a>
                )}
                {dest.phone && (
                  <a href={`tel:${dest.phone}`}
                    className="flex items-center justify-center gap-2 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-bold transition col-span-2">
                    <Phone className="w-4 h-4" /> Call Campground
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Inline Route Map ────────────────────────────────────────── */}
          {showInlineMap && inlineMapUrl && (
            <div className="rounded-2xl overflow-hidden border border-blue-700">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
                <p className="text-xs text-gray-400 font-medium">🗺️ {mapStopLabel}</p>
                <button onClick={() => setShowInlineMap(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
              </div>
              <iframe
                src={inlineMapUrl}
                width="100%"
                height="320"
                style={{ border: 0, display: 'block' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Route Map"
              />
            </div>
          )}

          {/* ── Multi-Day Fatigue Note ──────────────────────────────────── */}
          {multiDayLoad > 4 && !isStopped && (
            <div className="bg-gray-900 border border-amber-800 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl flex-shrink-0">😴</span>
              <div>
                <p className="text-xs font-bold text-amber-400">Multi-Day Fatigue</p>
                <p className="text-xs text-gray-400">You drove {multiDayLoad.toFixed(1)}h yesterday — fatigue baseline is elevated today.</p>
              </div>
            </div>
          )}

          {/* ── Quick actions ────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <button onClick={isStopped ? handleResumeDriving : handleStopDriving}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border transition ${
                isStopped ? 'bg-green-900 border-green-700 hover:bg-green-800' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'
              }`}>
              {isStopped ? <span className="text-2xl">▶</span> : <Fuel className="w-6 h-6 text-orange-400" />}
              <span className="text-xs text-gray-400">{isStopped ? 'Resume' : 'Stop'}</span>
            </button>
            <button onClick={switchDriver}
              className="flex flex-col items-center gap-2 py-4 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition">
              <RotateCcw className="w-6 h-6 text-blue-400" />
              <span className="text-xs text-gray-400">Switch Driver</span>
            </button>
            <a href="tel:18008472869"
              className="flex flex-col items-center gap-2 py-4 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <span className="text-xs text-gray-400">Roadside</span>
            </a>
          </div>

          {/* ── Road Chat (driver — collapsed by default for safety) ──────── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => setShowRoadChat(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition"
            >
              <div className="flex items-center gap-2">
                <span>🚐</span>
                <p className="text-sm font-bold text-white">Road Chat</p>
                <span className="text-xs text-amber-500 font-semibold">Passenger use recommended</span>
              </div>
              <span className="text-gray-500 text-xs">{showRoadChat ? '▲' : '▼'}</span>
            </button>
            {showRoadChat && (
              <div style={{ height: 340 }}>
                <RoadChat />
              </div>
            )}
          </div>

          {/* ── Stop Planner Modal ───────────────────────────────────────── */}
          {showStopPlanner && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4">
              <div className="bg-gray-900 rounded-2xl p-4 border border-blue-700 w-full max-w-sm">
                <p className="text-sm font-bold mb-3 text-blue-300">🛑 Why are you stopping?</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[['⛽','Gas'],['🍔','Food'],['😴','Rest'],['🚻','Restroom'],['🐕','Pets'],['🔧','Repair']].map(([emoji, label]) => (
                    <button key={label} onClick={() => handleFindStops(label)}
                      className={`py-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition ${
                        stopReason === label ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}>
                      <span className="text-xl">{emoji}</span>{label}
                    </button>
                  ))}
                </div>
                <button onClick={() => handleFindStops(stopReason || 'Stop')}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold transition">
                  Find Nearby Stops →
                </button>
                <button onClick={() => setShowStopPlanner(false)} className="w-full text-xs text-gray-600 mt-2 py-1">Cancel</button>
              </div>
            </div>
          )}

          {/* ── Nearby stops results ─────────────────────────────────────── */}
          {showStops && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-orange-400">{stopReason || 'Nearby'} Stops</p>
                <button onClick={() => { setShowStops(false); setShowStopPlanner(false); setPassengerFindingStops(false); }}
                  className="text-xs text-gray-500">✕</button>
              </div>
              {loadingStops ? (
                <div className="text-center py-4 text-gray-500 text-sm">Finding stops near you...</div>
              ) : nearbyStops.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No stops found nearby</p>
              ) : (
                <div className="space-y-2">
                  {nearbyStops.slice(0, 6).map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{s.name}</p>
                          {i === 0 && <span className="text-xs bg-green-800 text-green-200 px-1.5 py-0.5 rounded-full">Best</span>}
                        </div>
                        <p className="text-xs text-gray-500">{s.category} · {s.distanceMiles} mi</p>
                      </div>
                      {s.latitude && (
                        <a
                          href={`https://waze.com/ul?ll=${s.latitude},${s.longitude}&navigate=yes`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg transition"
                        >Waze →</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ PASSENGER MODE ══════════════════════════════ */}
      {role === 'passenger' && (
        <div className="flex-1 flex flex-col px-4 py-5 gap-4">

          {/* ── Driver no-response urgent alert ─────────────────────────── */}
          {driverNoResponse && (
            <div className="bg-red-950 border-2 border-red-500 rounded-2xl p-4 animate-pulse">
              <p className="text-center font-black text-lg text-red-300 mb-1">⚠️ Driver Hasn't Responded</p>
              <p className="text-center text-sm text-red-400 mb-3">Check on them NOW</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => {
                  localStorage.setItem(LS.passengerSuggest, "Passenger confirms: driver is okay!");
                  localStorage.removeItem(LS.driverNoResponse);
                  setDriverNoResponse(false);
                }} className="py-2.5 bg-green-700 hover:bg-green-600 rounded-xl text-xs font-bold text-green-200 transition">
                  ✅ They're OK
                </button>
                <button onClick={passengerFlagFatigue}
                  className="py-2.5 bg-yellow-800 hover:bg-yellow-700 rounded-xl text-xs font-bold text-yellow-200 transition">
                  😴 Looks Tired
                </button>
                <button onClick={passengerSoftOverride}
                  className="py-2.5 bg-red-700 hover:bg-red-600 rounded-xl text-xs font-bold text-red-200 transition">
                  🛑 Pull Over!
                </button>
              </div>
            </div>
          )}

          {/* ── Driver status card ───────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Driver Status</p>
            <div className="flex items-center gap-4 mb-4">
              <FatigueRing score={fatigueScore} ringColor={scoreInfo.ringColor} />
              <div>
                <p className={`font-bold text-lg ${scoreInfo.textColor}`}>{scoreInfo.label}</p>
                <p className="text-sm text-gray-400">Driving {formatTime(elapsed)}</p>
                <p className="text-xs text-gray-600 mt-1">{breakCount} break{breakCount !== 1 ? 's' : ''} taken</p>
              </div>
            </div>

            {/* Check-on-driver quick taps */}
            <div className="border-t border-gray-800 pt-3">
              <p className="text-sm text-gray-400 mb-2">How does the driver look?</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => localStorage.setItem(LS.passengerSuggest, "Passenger says: you look great, keep it up!")}
                  className="py-2.5 bg-green-900 hover:bg-green-800 rounded-xl text-xs font-bold text-green-300 transition">✅ Good</button>
                <button onClick={passengerFlagFatigue}
                  className="py-2.5 bg-yellow-900 hover:bg-yellow-800 rounded-xl text-xs font-bold text-yellow-300 transition">😴 Tired</button>
                <button onClick={passengerSoftOverride}
                  className="py-2.5 bg-red-900 hover:bg-red-800 rounded-xl text-xs font-bold text-red-300 transition">🛑 Stop!</button>
              </div>
            </div>
          </div>

          {/* ── Co-Pilot Chat Feed ───────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> Co-Pilot Chat
              </p>
            </div>

            {/* Message feed */}
            <div className="px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
              {(() => {
                // Collect all cross-mode messages from localStorage for display
                const msgs: { text: string; from: string; ts: number }[] = [];
                try {
                  const stored = localStorage.getItem('rvu_copilot_chat');
                  if (stored) msgs.push(...JSON.parse(stored));
                } catch {}
                if (msgs.length === 0) {
                  return <p className="text-xs text-gray-600 text-center py-3 italic">No messages yet — use the buttons below to communicate with the driver</p>;
                }
                return msgs.slice(-12).map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.from === 'passenger' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                      m.from === 'passenger' ? 'bg-purple-800 text-purple-100 rounded-br-sm' :
                      m.from === 'driver' ? 'bg-blue-900 text-blue-100 rounded-bl-sm' :
                      'bg-gray-800 text-gray-300'
                    }`}>
                      <p className="font-semibold text-[10px] mb-0.5 opacity-70">
                        {m.from === 'passenger' ? '🗺️ You' : m.from === 'driver' ? '🚐 Driver' : '🛡️ System'}
                      </p>
                      {m.text}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Quick action buttons as compact chips */}
            <div className="px-4 pb-4 pt-2 border-t border-gray-800">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => {
                  const msg = { text: 'Suggesting we stop soon 🛑', from: 'passenger', ts: Date.now() };
                  try {
                    const prev = JSON.parse(localStorage.getItem('rvu_copilot_chat') || '[]');
                    localStorage.setItem('rvu_copilot_chat', JSON.stringify([...prev, msg].slice(-20)));
                  } catch {}
                  passengerSuggestStop();
                }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-900 hover:bg-blue-800 border border-blue-700 rounded-xl text-xs font-semibold text-blue-200 transition">
                  💬 Suggest Stop
                </button>
                <button onClick={() => {
                  const msg = { text: 'Flagging fatigue — please be careful 😴', from: 'passenger', ts: Date.now() };
                  try {
                    const prev = JSON.parse(localStorage.getItem('rvu_copilot_chat') || '[]');
                    localStorage.setItem('rvu_copilot_chat', JSON.stringify([...prev, msg].slice(-20)));
                  } catch {}
                  passengerFlagFatigue();
                }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-yellow-900 hover:bg-yellow-800 border border-yellow-700 rounded-xl text-xs font-semibold text-yellow-200 transition">
                  😴 Flag Fatigue
                </button>
                <button onClick={() => { setPassengerFindingStops(true); setShowStops(true); loadNearbyStops(); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs font-semibold text-gray-200 transition">
                  🗺️ Find Stops
                </button>
                <button onClick={() => {
                  const msg = { text: 'Requesting override — please pull over ⚡', from: 'passenger', ts: Date.now() };
                  try {
                    const prev = JSON.parse(localStorage.getItem('rvu_copilot_chat') || '[]');
                    localStorage.setItem('rvu_copilot_chat', JSON.stringify([...prev, msg].slice(-20)));
                  } catch {}
                  passengerSoftOverride();
                }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-950 hover:bg-orange-900 border border-orange-700 rounded-xl text-xs font-semibold text-orange-300 transition">
                  ⚡ Override
                </button>
              </div>
            </div>
          </div>

          {/* ── Passenger-initiated stop finder results ──────────────────── */}
          {passengerFindingStops && showStops && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-purple-700">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-purple-400">🗺️ Stops Near You</p>
                <button onClick={() => { setShowStops(false); setPassengerFindingStops(false); }} className="text-xs text-gray-500">✕</button>
              </div>
              {loadingStops ? (
                <div className="text-center py-4 text-gray-500 text-sm">Searching...</div>
              ) : nearbyStops.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No stops found</p>
              ) : (
                <div className="space-y-2">
                  {nearbyStops.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.category} · {s.distanceMiles} mi</p>
                      </div>
                      <button onClick={() => {
                        localStorage.setItem(LS.passengerSuggest, `Passenger found a stop: ${s.name} (${s.distanceMiles} mi away)`);
                        showToast('Stop sent to driver! 🗺️');
                      }} className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded-lg transition">
                        Send →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Switch driver ────────────────────────────────────────────── */}
          <button onClick={switchDriver}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition">
            <RotateCcw className="w-6 h-6" /> I'm Taking Over — Switch Driver
          </button>
          <p className="text-xs text-gray-600 text-center -mt-3">Resets the fatigue timer for the new driver</p>

          {/* ── Destination ──────────────────────────────────────────────── */}
          {nextEvent && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Heading to</p>
              <p className="font-bold">{nextEvent.campground?.name || nextEvent.title}</p>
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                {inlineMapUrl && (
                  <button
                    onClick={() => setShowInlineMap(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
                  >
                    <Navigation className="w-4 h-4" />
                    {showInlineMap ? 'Hide Map' : 'Show Route Map'}
                  </button>
                )}
                {wazeUrl && (
                  <a href={wazeUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200">
                    🗺️ Open Waze
                  </a>
                )}
              </div>
              {showInlineMap && inlineMapUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-gray-700">
                  <iframe
                    src={inlineMapUrl}
                    width="100%"
                    height="260"
                    style={{ border: 0, display: 'block' }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Route Map"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Road Chat ────────────────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => setShowRoadChat(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🚐</span>
                <p className="text-sm font-bold text-white">Road Chat</p>
                <span className="text-xs text-gray-500">All drivers on RVUnicorn</span>
              </div>
              <span className="text-gray-500 text-xs">{showRoadChat ? '▲' : '▼'}</span>
            </button>
            {showRoadChat && (
              <div style={{ height: 380 }}>
                <RoadChat />
              </div>
            )}
          </div>

          {/* ── Entertainment ────────────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Pass the time</p>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/hitch" className="flex items-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition">
                🦄 Ask Hitch
              </Link>
              <Link to="/community" className="flex items-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition">
                🔥 Community
              </Link>
            </div>
          </div>

          {/* ── Emergency ────────────────────────────────────────────────── */}
          <div className="bg-red-950 rounded-2xl p-4 border border-red-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-red-300">Emergency?</p>
              <p className="text-xs text-red-500">Good Sam · Coach-Net</p>
            </div>
            <a href="tel:911" className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold transition">
              Call 911
            </a>
          </div>
        </div>
      )}

      {/* ── Drive Stats Modal ────────────────────────────────────────────────── */}
      {showStats && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col p-6 overflow-y-auto">
          <div className="max-w-sm mx-auto w-full space-y-5 pt-4">
            <h2 className="text-2xl font-bold text-white text-center">🏁 Drive Complete</h2>

            {/* Drive grade */}
            {(() => {
              const grade = getDriveGrade();
              const gradeColor = grade === 'A' ? 'text-green-400' : grade === 'B' ? 'text-blue-400' : grade === 'C' ? 'text-yellow-400' : 'text-red-400';
              const gradeMsg = grade === 'A' ? 'Outstanding drive!' : grade === 'B' ? 'Solid drive.' : grade === 'C' ? 'Some room to improve.' : 'Unsafe patterns detected.';
              return (
                <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
                  <p className={`text-7xl font-black ${gradeColor}`}>{grade}</p>
                  <p className="text-sm text-gray-400 mt-1">{gradeMsg}</p>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Drive Time',      value: formatTime(elapsed),             color: 'text-green-400' },
                { label: 'Stop Time',        value: formatTime(totalStopTime),       color: 'text-blue-400'  },
                { label: 'Breaks Taken',     value: String(breakCount),              color: 'text-amber-400' },
                { label: 'Longest Stretch',  value: formatTime(longestDriveStretch), color: 'text-red-400'   },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🦄</span>
                <p className="text-xs font-bold text-primary-400">Hitch Safety Debrief</p>
              </div>
              {loadingDebrief ? (
                <div className="flex gap-1 py-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-300 leading-relaxed">{aiDebrief}</p>
              )}
            </div>

            <button onClick={onExit}
              className="w-full py-4 bg-primary-600 hover:bg-primary-700 rounded-2xl font-bold text-lg transition">
              Done — End Drive
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
