import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Navigation, Fuel, AlertTriangle, CheckCircle, XCircle, RotateCcw, Users, MapPin, Phone } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const FATIGUE_IMAGES = {
  ok:    null,
  mild:  'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774843506/rvunicorn/driving-mode/fatigue-4hour.png',
  tired: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774843506/rvunicorn/driving-mode/fatigue-8hour.png',
  danger:'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774843507/rvunicorn/driving-mode/fatigue-12hour.png',
};

const FATIGUE_LEVELS = [
  { hours: 0,  level: 'ok',     color: 'bg-green-500',  label: '🟢 Fresh',           msg: null },
  { hours: 4,  level: 'mild',   color: 'bg-yellow-400', label: '🟡 Getting Tired',    msg: "You've been driving 4 hours. How are you feeling?" },
  { hours: 8,  level: 'tired',  color: 'bg-orange-500', label: '🟠 Fatigued',         msg: "8 hours behind the wheel. Time for a real break." },
  { hours: 12, level: 'danger', color: 'bg-red-600',    label: '🔴 Unsafe — Stop Now',msg: "12+ hours driving. This is dangerous. Pull over now." },
];

function getFatigueLevel(hours: number) {
  if (hours >= 12) return FATIGUE_LEVELS[3];
  if (hours >= 8)  return FATIGUE_LEVELS[2];
  if (hours >= 4)  return FATIGUE_LEVELS[1];
  return FATIGUE_LEVELS[0];
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2,'0')}s`;
}

interface DrivingModeProps {
  nextEvent?: { title: string; campground?: { name: string; latitude?: number; longitude?: number; phone?: string } } | null;
  rvMpg?: number;
  onExit: () => void;
}

export default function DrivingMode({ nextEvent, rvMpg, onExit }: DrivingModeProps) {
  const { user } = useAuth();
  const [role, setRole] = useState<'driver' | 'passenger'>(() =>
    (localStorage.getItem('rvunicorn_drive_role') as 'driver' | 'passenger') || 'driver'
  );
  const [sessionStart, setSessionStart] = useState<number>(() => {
    const saved = localStorage.getItem('rvunicorn_drive_start');
    return saved ? parseInt(saved) : Date.now();
  });
  const [elapsed, setElapsed] = useState(0);
  const [alertDismissed, setAlertDismissed] = useState<string | null>(null);
  const [passengerCheck, setPassengerCheck] = useState<null | 'checking'>(null);
  const [nearbyStops, setNearbyStops] = useState<any[]>([]);
  const [showStops, setShowStops] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Persist session
  useEffect(() => {
    localStorage.setItem('rvunicorn_drive_start', String(sessionStart));
    localStorage.setItem('rvunicorn_drive_role', role);
  }, [sessionStart, role]);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionStart]);

  const hours = elapsed / 3600;
  const fatigue = getFatigueLevel(hours);
  const showAlert = fatigue.msg && fatigue.level !== alertDismissed;

  const switchDriver = () => {
    const newStart = Date.now();
    setSessionStart(newStart);
    setElapsed(0);
    setAlertDismissed(null);
    setRole(prev => prev === 'driver' ? 'passenger' : 'driver');
  };

  const loadNearbyStops = useCallback(async () => {
    if (!nextEvent?.campground?.latitude) return;
    try {
      const { data } = await api.get(
        `/overnight-spots/near?lat=${nextEvent.campground.latitude}&lng=${nextEvent.campground.longitude}&radius=50&limit=5`
      );
      setNearbyStops(data || []);
    } catch {}
  }, [nextEvent]);

  const handleNeedStop = () => {
    setShowStops(true);
    loadNearbyStops();
  };

  const dest = nextEvent?.campground;
  const navUrl = dest?.latitude
    ? `https://waze.com/ul?ll=${dest.latitude},${dest.longitude}&navigate=yes`
    : null;
  const googleUrl = dest?.latitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}&travelmode=driving`
    : null;

  // Fuel range estimate
  const fuelRange = rvMpg ? Math.round(rvMpg * 100) : null; // rough 100 gallon assumption

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full animate-pulse ${fatigue.color}`} />
          <span className="text-sm font-medium text-gray-300">{fatigue.label}</span>
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
          <button onClick={onExit} className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1.5">Exit</button>
        </div>
      </div>

      {/* ── DRIVER MODE ─────────────────────────────────────────────── */}
      {role === 'driver' && (
        <div className="flex-1 flex flex-col px-4 py-6 gap-5">

          {/* Fatigue alert */}
          {showAlert && (
            <div className={`rounded-2xl p-4 border ${
              fatigue.level === 'danger' ? 'bg-red-950 border-red-700' :
              fatigue.level === 'tired'  ? 'bg-orange-950 border-orange-700' :
              'bg-yellow-950 border-yellow-700'
            }`}>
              {FATIGUE_IMAGES[fatigue.level as keyof typeof FATIGUE_IMAGES] && (
                <img
                  src={FATIGUE_IMAGES[fatigue.level as keyof typeof FATIGUE_IMAGES]!}
                  alt="fatigue warning"
                  className="w-24 h-24 object-cover rounded-xl mx-auto mb-3"
                />
              )}
              <p className="text-center font-bold text-lg mb-1">
                {fatigue.level === 'danger' ? '🚨 STOP NOW' : '⚠️ Take a Break'}
              </p>
              <p className="text-center text-sm text-gray-300 mb-4">{fatigue.msg}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setAlertDismissed(fatigue.level)}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-bold transition"
                >
                  👍 I'm Good
                </button>
                <button
                  onClick={handleNeedStop}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold transition"
                >
                  🛑 Need Stop
                </button>
              </div>
            </div>
          )}

          {/* Drive time */}
          <div className="bg-gray-900 rounded-2xl p-5 text-center border border-gray-800">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Time Driving</p>
            <p className="text-5xl font-bold tabular-nums">{formatTime(elapsed)}</p>
            <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${fatigue.color}`}
                style={{ width: `${Math.min((hours / 12) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">Safe limit: 8 hrs · Stop by: 10 hrs</p>
          </div>

          {/* Navigate */}
          {dest && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <p className="text-xs text-gray-500 mb-2">Destination</p>
              <p className="font-bold text-lg mb-3">{dest.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {navUrl && (
                  <a href={navUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold transition">
                    <Navigation className="w-4 h-4" /> Waze
                  </a>
                )}
                {googleUrl && (
                  <a href={googleUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 bg-blue-800 hover:bg-blue-900 rounded-xl text-sm font-bold transition">
                    <MapPin className="w-4 h-4" /> Google Maps
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

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3">
            <button onClick={handleNeedStop}
              className="flex flex-col items-center gap-2 py-4 bg-gray-900 hover:bg-gray-800 rounded-2xl border border-gray-800 transition">
              <Fuel className="w-6 h-6 text-orange-400" />
              <span className="text-xs text-gray-400">Find Stop</span>
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

          {/* Nearby stops */}
          {showStops && nearbyStops.length > 0 && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <p className="text-sm font-bold mb-3 text-orange-400">⛽ Nearby Stops</p>
              <div className="space-y-2">
                {nearbyStops.slice(0, 4).map(s => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.category} · {s.distanceMiles} mi</p>
                    </div>
                    {s.latitude && (
                      <a href={`https://waze.com/ul?ll=${s.latitude},${s.longitude}&navigate=yes`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300">Go →</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PASSENGER MODE ──────────────────────────────────────────── */}
      {role === 'passenger' && (
        <div className="flex-1 flex flex-col px-4 py-6 gap-5">

          {/* Driver status */}
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Driver Status</p>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 ${
                FATIGUE_IMAGES[fatigue.level as keyof typeof FATIGUE_IMAGES] ? '' : 'bg-green-900 flex items-center justify-center'
              }`}>
                {FATIGUE_IMAGES[fatigue.level as keyof typeof FATIGUE_IMAGES] ? (
                  <img src={FATIGUE_IMAGES[fatigue.level as keyof typeof FATIGUE_IMAGES]!} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">😊</span>
                )}
              </div>
              <div>
                <p className="font-bold text-lg">{fatigue.label}</p>
                <p className="text-sm text-gray-400">Driving for {formatTime(elapsed)}</p>
              </div>
            </div>

            {/* Passenger check on driver */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 mb-3">How does the driver look?</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPassengerCheck('checking')}
                  className="py-2.5 bg-green-900 hover:bg-green-800 rounded-xl text-xs font-bold text-green-300 transition">
                  ✅ Good
                </button>
                <button
                  onClick={() => { setPassengerCheck('checking'); alert('Passenger flagged driver as tired. Suggest a break!'); }}
                  className="py-2.5 bg-yellow-900 hover:bg-yellow-800 rounded-xl text-xs font-bold text-yellow-300 transition">
                  😴 Tired
                </button>
                <button
                  onClick={() => { setPassengerCheck('checking'); setShowStops(true); loadNearbyStops(); alert('Finding stops now — pull over safely!'); }}
                  className="py-2.5 bg-red-900 hover:bg-red-800 rounded-xl text-xs font-bold text-red-300 transition">
                  🛑 Stop!
                </button>
              </div>
            </div>
          </div>

          {/* Switch driver button */}
          <button onClick={switchDriver}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition">
            <RotateCcw className="w-6 h-6" /> I'm Taking Over — Switch Driver
          </button>
          <p className="text-xs text-gray-600 text-center -mt-3">Resets the fatigue timer for the new driver</p>

          {/* Destination + trip info */}
          {nextEvent && (
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Heading to</p>
              <p className="font-bold">{nextEvent.campground?.name || nextEvent.title}</p>
              {dest && navUrl && (
                <a href={navUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                  <Navigation className="w-4 h-4" /> Open Navigation
                </a>
              )}
            </div>
          )}

          {/* Entertainment */}
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

          {/* Emergency */}
          <div className="bg-red-950 rounded-2xl p-4 border border-red-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-red-300">Emergency?</p>
              <p className="text-xs text-red-500">Good Sam · Coach-Net · AAA</p>
            </div>
            <a href="tel:911" className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold transition">
              Call 911
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
