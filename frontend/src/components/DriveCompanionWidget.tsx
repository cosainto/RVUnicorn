import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, AlertTriangle, X, Maximize2, Coffee, Zap } from 'lucide-react';
import { useDrivingSession } from '../contexts/DrivingSessionContext';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatEta(minutes: number | null): string {
  if (minutes == null || !isFinite(minutes)) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function fatigueLabel(score: number): { text: string; color: string; bg: string } {
  if (score >= 76) return { text: 'Critical',  color: '#fca5a5', bg: 'rgba(127,29,29,0.85)' };
  if (score >= 51) return { text: 'Drifting',  color: '#fdba74', bg: 'rgba(124,45,18,0.8)'  };
  if (score >= 26) return { text: 'Alert',     color: '#fde047', bg: 'rgba(113,63,18,0.8)'  };
  return                    { text: 'Fresh',   color: '#86efac', bg: 'rgba(20,83,45,0.8)'   };
}

// ═════════════════════════════════════════════════════════════════════════════
export default function DriveCompanionWidget() {
  const {
    isDriving,
    role,
    passengerFullView,
    openPassengerFullView,
    nextEvent,
    elapsedSeconds,
    gps,
    milesRemaining,
    etaMinutes,
    fatigueScore,
    driverNoResponse,
    passengerSuggestStop,
    passengerFlagFatigue,
    passengerSoftOverride,
  } = useDrivingSession();

  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Only render for passengers in an active drive session.
  // Drivers get the full takeover (mounted by BasecampPage).
  if (!isDriving || role !== 'passenger') return null;

  // If the passenger has opted into the full takeover, BasecampPage is rendering
  // DrivingMode — don't double up.
  if (passengerFullView) return null;

  const fatigue = fatigueLabel(fatigueScore);
  const speedMph = gps?.speedMph != null && gps.speedMph > 1 ? Math.round(gps.speedMph) : null;
  const destName = nextEvent?.campground?.name || nextEvent?.title || 'Destination';

  const flash = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 2200);
  };

  const onSuggest = () => { passengerSuggestStop(); flash('Stop suggestion sent 💬'); };
  const onFlag    = () => { passengerFlagFatigue(); flash('Fatigue flag sent 😴'); };
  const onOverride = () => { passengerSoftOverride(); flash('Override sent ⚡'); };
  const onGoFull = () => {
    openPassengerFullView();
    navigate('/basecamp');
  };

  // ── Compact card (default) ────────────────────────────────────────────────
  if (!expanded) {
    return (
      <>
        {actionToast && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full text-xs font-bold shadow-lg"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 220px)', background: 'rgba(17,24,39,0.95)', color: '#a7f3d0' }}
          >
            {actionToast}
          </div>
        )}
        <div
          className="fixed z-50 select-none"
          style={{
            right: 'max(env(safe-area-inset-right), 12px)',
            bottom: 'calc(env(safe-area-inset-bottom) + 80px)', // sit above MobileBottomNav
            width: 280,
          }}
        >
          <div
            className="rounded-2xl overflow-hidden cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              boxShadow: driverNoResponse
                ? '0 0 0 2px #ef4444, 0 12px 32px rgba(239,68,68,0.4)'
                : '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
              animation: driverNoResponse ? 'companionPulse 1.2s ease-in-out infinite' : 'none',
            }}
            onClick={() => setExpanded(true)}
          >
            <style>{`
              @keyframes companionPulse {
                0%, 100% { box-shadow: 0 0 0 2px #ef4444, 0 12px 32px rgba(239,68,68,0.4); }
                50%       { box-shadow: 0 0 0 3px #f87171, 0 12px 36px rgba(239,68,68,0.6); }
              }
            `}</style>

            {/* Header strip */}
            <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'rgba(59,130,246,0.15)', borderBottom: '1px solid rgba(59,130,246,0.25)' }}>
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🗺️</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Co-Pilot</span>
                {driverNoResponse && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                    DRIVER ALERT
                  </span>
                )}
              </div>
              <Maximize2 className="w-3 h-3 text-blue-300/60" />
            </div>

            {/* Body */}
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-gray-500 mb-0.5 truncate">→ {destName}</p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-2xl font-black tabular-nums text-white leading-none">{formatEta(etaMinutes)}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {milesRemaining != null ? `${Math.round(milesRemaining)} mi` : '— mi'}
                    {speedMph != null && <> · {speedMph} mph</>}
                  </p>
                </div>
                <div
                  className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                  style={{ background: fatigue.bg, color: fatigue.color, border: `1px solid ${fatigue.color}40` }}
                >
                  <span className="tabular-nums">{fatigueScore}</span>
                  <span>{fatigue.text}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">Driving for {formatElapsed(elapsedSeconds)}</p>
            </div>

            {/* Quick action chips */}
            <div className="grid grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <button
                onClick={(e) => { e.stopPropagation(); onSuggest(); }}
                className="py-2 text-[10px] font-bold transition flex items-center justify-center gap-1"
                style={{ background: '#1e293b', color: '#93c5fd' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
              >
                💬 Stop
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onFlag(); }}
                className="py-2 text-[10px] font-bold transition flex items-center justify-center gap-1"
                style={{ background: '#1e293b', color: '#fde047' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
              >
                <Coffee className="w-3 h-3" /> Tired
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onOverride(); }}
                className="py-2 text-[10px] font-bold transition flex items-center justify-center gap-1"
                style={{ background: '#1e293b', color: '#fdba74' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
              >
                <Zap className="w-3 h-3" /> Override
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Expanded sheet ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setExpanded(false)}>
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">🗺️ Passenger Co-Pilot</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">→ {destName}</p>
          </div>
          <button onClick={() => setExpanded(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <Stat label="ETA" value={formatEta(etaMinutes)} />
          <Stat label="Miles left" value={milesRemaining != null ? `${Math.round(milesRemaining)}` : '—'} />
          <Stat label="Speed" value={speedMph != null ? `${speedMph}` : '—'} suffix="mph" />
        </div>

        {/* Driver fatigue */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Driver State</p>
            {driverNoResponse && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> NOT RESPONDING
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div
              className="px-3 py-2 rounded-xl flex flex-col items-center min-w-[68px]"
              style={{ background: fatigue.bg, border: `1px solid ${fatigue.color}40` }}
            >
              <span className="text-2xl font-black tabular-nums" style={{ color: fatigue.color }}>{fatigueScore}</span>
              <span className="text-[10px] font-bold uppercase" style={{ color: fatigue.color }}>{fatigue.text}</span>
            </div>
            <div className="flex-1 text-xs text-gray-400">
              <p>Driving for <span className="text-white font-semibold">{formatElapsed(elapsedSeconds)}</span></p>
              <p className="mt-1 text-gray-600">
                {fatigueScore >= 51
                  ? 'Driver is showing signs of fatigue. Consider suggesting a stop.'
                  : 'Driver is alert. Keep an eye on the trend.'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <button
            onClick={onSuggest}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
            style={{ background: 'rgba(37,99,235,0.2)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.4)' }}
          >
            💬 Suggest a Stop Soon
          </button>
          <button
            onClick={onFlag}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
            style={{ background: 'rgba(202,138,4,0.2)', color: '#fde047', border: '1px solid rgba(202,138,4,0.4)' }}
          >
            <Coffee className="w-4 h-4" /> Flag Driver Fatigue
          </button>
          <button
            onClick={onOverride}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
            style={{ background: 'rgba(234,88,12,0.2)', color: '#fdba74', border: '1px solid rgba(234,88,12,0.4)' }}
          >
            <Zap className="w-4 h-4" /> Force Pull-Over Request
          </button>

          <div className="pt-2 border-t border-white/5 mt-2">
            <button
              onClick={onGoFull}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#cbd5e1' }}
            >
              <Navigation className="w-4 h-4" /> Open Full Drive Mode
            </button>
            <p className="text-[10px] text-gray-600 text-center mt-1.5">
              Full mode has Road Chat, stop finder, and overnight planning.
            </p>
          </div>
        </div>

        {actionToast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold shadow-lg" style={{ background: 'rgba(34,197,94,0.9)', color: '#fff' }}>
            {actionToast}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="px-3 py-3 text-center" style={{ background: '#0f172a' }}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-black tabular-nums text-white mt-0.5">
        {value}
        {suffix && <span className="text-[10px] text-gray-500 font-normal ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}
