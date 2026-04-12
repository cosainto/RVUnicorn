import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';

// ── localStorage keys (must stay in sync with DrivingMode.tsx) ────────────────
const LS = {
  driving:           'rvunicorn_driving',
  driveStart:        'rvunicorn_drive_start',
  driveRole:         'rvunicorn_drive_role',
  fatigueScore:      'rvu_fatigue_score',
  passengerSuggest:  'rvu_passenger_suggest_stop',
  passengerFlag:     'rvu_passenger_flag_fatigue',
  passengerOverride: 'rvu_passenger_override',
  driverNoResponse:  'rvu_driver_no_response',
  copilotChat:       'rvu_copilot_chat',
} as const;

type Role = 'driver' | 'passenger';

interface NextEventLite {
  id?: string;
  title?: string;
  endDate?: string;
  campground?: {
    id?: string;
    name?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
  } | null;
}

interface GpsSample {
  lat: number;
  lng: number;
  speedMph: number | null;  // null if device doesn't report speed
  heading: number | null;
  ts: number;
}

interface DrivingSessionContextValue {
  // ── Lifecycle ──
  isDriving: boolean;
  drivingMinimized: boolean;
  startDrive: (event?: NextEventLite | null) => void;
  exitDrive: () => void;
  minimizeDrive: () => void;
  restoreDrive: () => void;
  /** Reset session start to now without exiting — use for "Switch Driver" so the new shift's timer starts fresh. */
  restartSession: () => void;
  /** Passenger explicitly opted into the full DrivingMode takeover (e.g., tapped "Open Full Drive Mode" in the widget). */
  passengerFullView: boolean;
  openPassengerFullView: () => void;
  closePassengerFullView: () => void;

  // ── Role ──
  role: Role;
  setRole: (r: Role) => void;

  // ── Session timing ──
  sessionStart: number | null;
  elapsedSeconds: number;

  // ── Trip context ──
  nextEvent: NextEventLite | null;
  setNextEvent: (e: NextEventLite | null) => void;

  // ── GPS / motion ──
  gps: GpsSample | null;

  // ── Derived: ETA / miles remaining to destination ──
  milesRemaining: number | null;
  etaMinutes: number | null;

  // ── Mirrored fatigue + driver state (from DrivingMode via localStorage) ──
  fatigueScore: number;
  driverNoResponse: boolean;

  // ── Passenger → driver signals ──
  passengerSuggestStop: (note?: string) => void;
  passengerFlagFatigue: () => void;
  passengerSoftOverride: () => void;
}

const DrivingSessionContext = createContext<DrivingSessionContextValue | undefined>(undefined);

// ── Haversine (miles) ─────────────────────────────────────────────────────────
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function DrivingSessionProvider({ children }: { children: ReactNode }) {
  // ── Lifecycle state, hydrated from localStorage so refreshes don't drop the session ──
  const [isDriving, setIsDriving] = useState<boolean>(() => {
    if (localStorage.getItem(LS.driving) !== 'true') return false;
    // Auto-expire stale sessions (>18 hours) or missing start time (corrupt state)
    const startStr = localStorage.getItem(LS.driveStart);
    if (!startStr) {
      // Corrupt: driving=true but no start time — clean up
      localStorage.removeItem(LS.driving);
      localStorage.removeItem(LS.driveRole);
      return false;
    }
    const startMs = parseInt(startStr, 10);
    if (isNaN(startMs) || (Date.now() - startMs) / (1000 * 60 * 60) > 18) {
      localStorage.removeItem(LS.driving);
      localStorage.removeItem(LS.driveStart);
      localStorage.removeItem(LS.driveRole);
      return false;
    }
    return true;
  });
  const [drivingMinimized, setDrivingMinimized] = useState<boolean>(false);
  const [passengerFullView, setPassengerFullView] = useState<boolean>(false);
  const [role, setRoleState] = useState<Role>(() =>
    (localStorage.getItem(LS.driveRole) as Role) || 'driver'
  );
  const [sessionStart, setSessionStart] = useState<number | null>(() => {
    const saved = localStorage.getItem(LS.driveStart);
    return saved ? parseInt(saved, 10) : null;
  });
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [nextEvent, setNextEvent] = useState<NextEventLite | null>(null);
  const [gps, setGps] = useState<GpsSample | null>(null);
  const [fatigueScore, setFatigueScore] = useState<number>(0);
  const [driverNoResponse, setDriverNoResponse] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);

  // ── Force-clean stale sessions on every mount/render cycle ──────────────
  // The useState initializer only runs once. If React preserved stale state
  // (HMR, cached tab, etc.), this effect catches it.
  useEffect(() => {
    const drivingFlag = localStorage.getItem(LS.driving);
    const startStr = localStorage.getItem(LS.driveStart);
    if (drivingFlag !== 'true') {
      if (isDriving) setIsDriving(false);
      return;
    }
    if (!startStr || isNaN(parseInt(startStr, 10))) {
      localStorage.removeItem(LS.driving);
      localStorage.removeItem(LS.driveStart);
      localStorage.removeItem(LS.driveRole);
      if (isDriving) setIsDriving(false);
      return;
    }
    const hoursElapsed = (Date.now() - parseInt(startStr, 10)) / (1000 * 60 * 60);
    if (hoursElapsed > 18) {
      localStorage.removeItem(LS.driving);
      localStorage.removeItem(LS.driveStart);
      localStorage.removeItem(LS.driveRole);
      if (isDriving) setIsDriving(false);
    }
  }, []); // runs once on mount

  // ── Session timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDriving || !sessionStart) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - sessionStart) / 1000));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [isDriving, sessionStart]);

  // ── GPS watcher: only active while driving ────────────────────────────────
  useEffect(() => {
    if (!isDriving || typeof navigator === 'undefined' || !navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          // pos.coords.speed is m/s; convert to mph. Some devices return null.
          speedMph: pos.coords.speed != null ? pos.coords.speed * 2.23694 : null,
          heading: pos.coords.heading ?? null,
          ts: Date.now(),
        });
      },
      () => { /* swallow — widget will just show "—" */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isDriving]);

  // ── Mirror fatigue score + driver-no-response from localStorage ───────────
  // DrivingMode writes these on its own cadence; we poll so the widget can read them
  // without coupling directly to that component.
  useEffect(() => {
    if (!isDriving) return;
    const poll = () => {
      const f = parseInt(localStorage.getItem(LS.fatigueScore) || '0', 10);
      setFatigueScore(isNaN(f) ? 0 : f);
      const ts = localStorage.getItem(LS.driverNoResponse);
      setDriverNoResponse(!!ts && Date.now() - parseInt(ts, 10) < 90_000);
    };
    poll();
    const i = setInterval(poll, 3000);
    return () => clearInterval(i);
  }, [isDriving]);

  // ── Persist role changes ──────────────────────────────────────────────────
  useEffect(() => {
    if (isDriving) localStorage.setItem(LS.driveRole, role);
  }, [role, isDriving]);

  // ── Derived: miles remaining + ETA ───────────────────────────────────────
  const dest = nextEvent?.campground;
  let milesRemaining: number | null = null;
  let etaMinutes: number | null = null;
  if (gps && dest?.latitude != null && dest?.longitude != null) {
    milesRemaining = haversineMiles(gps.lat, gps.lng, dest.latitude, dest.longitude);
    // Use measured speed if it looks like real driving (>5 mph), otherwise assume 55.
    const effectiveMph = gps.speedMph != null && gps.speedMph > 5 ? gps.speedMph : 55;
    etaMinutes = (milesRemaining / effectiveMph) * 60;
  }

  // ── Lifecycle actions ─────────────────────────────────────────────────────
  const startDrive = useCallback((event?: NextEventLite | null) => {
    const now = Date.now();
    setSessionStart(now);
    setIsDriving(true);
    setDrivingMinimized(false);
    if (event !== undefined) setNextEvent(event);
    localStorage.setItem(LS.driving, 'true');
    localStorage.setItem(LS.driveStart, String(now));
    localStorage.setItem(LS.driveRole, role);
  }, [role]);

  const exitDrive = useCallback(() => {
    setIsDriving(false);
    setDrivingMinimized(false);
    setPassengerFullView(false);
    setSessionStart(null);
    setElapsedSeconds(0);
    setGps(null);
    setFatigueScore(0);
    setDriverNoResponse(false);
    localStorage.removeItem(LS.driving);
    localStorage.removeItem(LS.driveStart);
    localStorage.removeItem(LS.driveRole);
  }, []);

  const minimizeDrive = useCallback(() => {
    setDrivingMinimized(true);
    setPassengerFullView(false); // tapping "← Basecamp" from the takeover always returns the passenger to widget mode
  }, []);
  const restoreDrive = useCallback(() => setDrivingMinimized(false), []);

  const openPassengerFullView = useCallback(() => {
    setPassengerFullView(true);
    setDrivingMinimized(false);
  }, []);
  const closePassengerFullView = useCallback(() => setPassengerFullView(false), []);

  const restartSession = useCallback(() => {
    const now = Date.now();
    setSessionStart(now);
    setElapsedSeconds(0);
    localStorage.setItem(LS.driveStart, String(now));
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    localStorage.setItem(LS.driveRole, r);
  }, []);

  // ── Passenger → driver signals (also append to co-pilot chat for parity) ──
  const appendCopilotChat = (text: string, from: 'passenger' | 'driver' | 'system') => {
    try {
      const prev = JSON.parse(localStorage.getItem(LS.copilotChat) || '[]');
      const next = [...prev, { text, from, ts: Date.now() }].slice(-20);
      localStorage.setItem(LS.copilotChat, JSON.stringify(next));
    } catch { /* ignore quota / parse */ }
  };

  const passengerSuggestStop = useCallback((note?: string) => {
    const msg = note || 'Your passenger thinks you should stop soon.';
    localStorage.setItem(LS.passengerSuggest, msg);
    appendCopilotChat('Suggesting we stop soon 🛑', 'passenger');
  }, []);

  const passengerFlagFatigue = useCallback(() => {
    localStorage.setItem(LS.passengerFlag, String(Date.now()));
    appendCopilotChat('Flagging fatigue — please be careful 😴', 'passenger');
  }, []);

  const passengerSoftOverride = useCallback(() => {
    localStorage.setItem(LS.passengerOverride, '1');
    appendCopilotChat('Requesting override — please pull over ⚡', 'passenger');
  }, []);

  const value: DrivingSessionContextValue = {
    isDriving,
    drivingMinimized,
    startDrive,
    exitDrive,
    minimizeDrive,
    restoreDrive,
    restartSession,
    passengerFullView,
    openPassengerFullView,
    closePassengerFullView,
    role,
    setRole,
    sessionStart,
    elapsedSeconds,
    nextEvent,
    setNextEvent,
    gps,
    milesRemaining,
    etaMinutes,
    fatigueScore,
    driverNoResponse,
    passengerSuggestStop,
    passengerFlagFatigue,
    passengerSoftOverride,
  };

  return <DrivingSessionContext.Provider value={value}>{children}</DrivingSessionContext.Provider>;
}

export function useDrivingSession() {
  const ctx = useContext(DrivingSessionContext);
  if (!ctx) {
    throw new Error('useDrivingSession must be used within a DrivingSessionProvider');
  }
  return ctx;
}
