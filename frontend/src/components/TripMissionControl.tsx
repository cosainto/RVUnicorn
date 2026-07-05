import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Package, MapPin, CheckCircle, Clock, AlertCircle, ChevronRight, Star, Flame, Navigation, Camera, RefreshCw } from 'lucide-react';
import api from '../services/api';
import DestinationSnapshotCard from './trips/DestinationSnapshotCard';

// ── Colors ──
const C = {
  bg: '#0F1C35', card: '#1B2B4B', cardLight: '#243352', border: '#2A3F5F',
  gold: '#C9A84C', orange: '#E8622A', cream: '#F5F0E8', muted: '#94A3B8',
  green: '#1D9E75', amber: '#BA7517', red: '#EF4444',
};

// ── Trip Mode Detection ──
export type TripMode = 'PLANNING' | 'COUNTDOWN' | 'TOMORROW' | 'DEPARTURE_DAY' | 'IN_PROGRESS' | 'COMPLETED';

export function detectTripMode(startDate?: string | Date | null, endDate?: string | Date | null): { mode: TripMode; daysUntil: number } {
  if (!startDate) return { mode: 'PLANNING', daysUntil: 999 };
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  const now = new Date();
  const daysUntil = Math.ceil((start.getTime() - now.getTime()) / 86400000);

  if (now > new Date(end.getTime() + 86400000)) return { mode: 'COMPLETED', daysUntil };
  if (now >= start && now <= end) return { mode: 'IN_PROGRESS', daysUntil };
  if (daysUntil === 0) return { mode: 'DEPARTURE_DAY', daysUntil: 0 };
  if (daysUntil === 1) return { mode: 'TOMORROW', daysUntil: 1 };
  if (daysUntil <= 6) return { mode: 'COUNTDOWN', daysUntil };
  return { mode: 'PLANNING', daysUntil };
}

// ── Trip Health Score ──
interface HealthResult {
  score: number;
  tier: 'ready' | 'almost' | 'attention' | 'incomplete';
  tierLabel: string;
  tierColor: string;
  actions: string[];
}

export function calculateTripHealth(event: any): HealthResult {
  let score = 0;
  const actions: string[] = [];

  // CRITICAL (60 pts)
  if (event.startDate) score += 15; else actions.push('Set a departure date');
  if (event.campground || event.location) score += 15; else actions.push('Choose a destination');

  const confirmedAttendees = (event.attendees || []).filter((a: any) =>
    ['ATTENDING', 'attending', 'GOING', 'going'].includes(a.status)
  );
  if (confirmedAttendees.length > 0) score += 15; else actions.push('No confirmed attendees yet');

  if (event.campground || event.location) score += 15; // has destination = has route

  // IMPORTANT (25 pts)
  const pendingAttendees = (event.attendees || []).filter((a: any) =>
    ['PENDING', 'pending', 'invited', 'INVITED'].includes(a.status)
  );
  if (pendingAttendees.length === 0) {
    score += 10;
  } else {
    actions.push(`${pendingAttendees.length} attendee${pendingAttendees.length > 1 ? 's' : ''} haven't responded`);
  }

  score += 8; // supply list — don't penalize unless user engaged
  score += 7; // fuel profile — give benefit of doubt

  // OPTIONAL (15 pts)
  if (event._count?.meals > 0) score += 8; else score += 4; // partial credit
  score += 7; // activities — give benefit of doubt

  score = Math.min(100, score);

  const tier = score >= 90 ? 'ready' : score >= 70 ? 'almost' : score >= 50 ? 'attention' : 'incomplete';
  const tierLabel = tier === 'ready' ? 'Trip is ready!' : tier === 'almost' ? 'Almost there' : tier === 'attention' ? 'Needs attention' : 'Incomplete';
  const tierColor = tier === 'ready' ? C.green : tier === 'almost' ? C.gold : tier === 'attention' ? C.amber : C.red;

  return { score, tier, tierLabel, tierColor, actions: actions.slice(0, 3) };
}

// ── Hitch Tip (campground-aware, cached per day) ──
function useHitchTip(mode: TripMode, destination?: string, campground?: any) {
  const [tip, setTip] = useState<string | null>(null);

  // Determine campground capabilities
  const hasHookups = campground?.hasElectricHookup || campground?.hasFullHookups || campground?.hasWaterHookup;

  const tips: Record<TripMode, string[]> = {
    PLANNING: [
      'Start with the campground — everything else follows.',
      'Check your rig\'s tire pressure and tread depth before trip planning.',
      'Book popular campgrounds early — they fill up fast in peak season.',
    ],
    COUNTDOWN: [
      'Time to check tire pressure and slide-outs before the big day!',
      ...(hasHookups
        ? ['Download offline maps for your route — cell service can be spotty.',
           'Confirm your site number and check-in time with the campground.',
           'Pack extra-long power and water hoses — site hookups vary in distance.']
        : ['Top off propane and fill the fresh water tank the day before.',
           'Download offline maps for your route — cell service can be spotty.',
           'Charge portable batteries and test your generator before departure.']),
    ],
    TOMORROW: [
      'Do a walk-around tonight: tires, lights, hitch, slides retracted.',
      'Charge all devices tonight — long drive tomorrow!',
      'Pack a cooler with road snacks and cold drinks for the drive.',
    ],
    DEPARTURE_DAY: [
      'You\'ve got everything you need — enjoy every mile!',
      'Take it slow pulling out. Check mirrors twice.',
      'First 30 minutes: listen for anything loose or rattling.',
    ],
    IN_PROGRESS: [
      'Take a photo of your site number — you\'ll forget it later.',
      'Walk the campground loop before sunset — best way to meet neighbors.',
    ],
    COMPLETED: [
      'Rate your campground while it\'s fresh — future campers will thank you.',
      'Upload your best photos to the trip scrapbook.',
    ],
  };
  useEffect(() => {
    const pool = tips[mode] || tips.PLANNING;
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setTip(pool[dayOfYear % pool.length]);
  }, [mode, hasHookups]);
  return tip;
}

// ── Main Component ──
interface Props {
  event: any;
  isOrganizer: boolean;
  canEdit: boolean;
  tripPlan?: any;
}

export default function TripMissionControl({ event, isOrganizer, canEdit, tripPlan }: Props) {
  const { mode, daysUntil } = detectTripMode(event.startDate, event.endDate);
  const health = calculateTripHealth(event);
  const hitchTip = useHitchTip(mode, event.campground?.name, event.campground);
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    if (event.campground?.latitude && event.campground?.longitude) {
      api.get(`/weather/${event.campground.id}`).then(r => setWeather(r.data)).catch(() => {});
    }
  }, [event.campground?.id]);

  const confirmedCount = (event.attendees || []).filter((a: any) =>
    ['ATTENDING', 'attending', 'GOING', 'going'].includes(a.status)
  ).length;
  const pendingCount = (event.attendees || []).filter((a: any) =>
    ['PENDING', 'pending', 'invited', 'INVITED'].includes(a.status)
  ).length;

  const departureStr = event.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'TBD';

  const duration = event.startDate && event.endDate
    ? Math.max(1, Math.ceil((new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 86400000))
    : null;

  // ── DEPARTURE DAY — Minimal Mobile Layout ──
  if (mode === 'DEPARTURE_DAY') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-2xl p-6 text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-3xl mb-2">🎉</p>
          <h2 className="text-xl font-bold" style={{ color: C.cream, fontFamily: "'Playfair Display', serif" }}>Today's the day!</h2>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Departing to {event.campground?.name || event.location || 'your destination'}</p>
          {tripPlan?.distanceMiles && (
            <p className="text-xs mt-2" style={{ color: C.gold }}>{tripPlan.distanceMiles} miles · ~{Math.round((tripPlan.durationMinutes || 0) / 60)}h drive</p>
          )}
        </div>

        {/* Weather today */}
        {weather && (
          <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Weather at destination</p>
              <p className="text-lg font-bold mt-1" style={{ color: C.cream }}>
                {weather.temperature ?? weather.temp}°F · {weather.condition || weather.description}
              </p>
            </div>
            <span className="text-3xl">{weather.condition?.toLowerCase().includes('sun') ? '☀️' : weather.condition?.toLowerCase().includes('rain') ? '🌧️' : '⛅'}</span>
          </div>
        )}

        {/* Pre-departure checklist */}
        <DepartureChecklist eventId={event.id} />

        {/* Campground info */}
        {event.campground && (
          <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Your campground</p>
            <p className="font-bold" style={{ color: C.cream }}>{event.campground.name}</p>
            {(event.campground.city || event.campground.state) && (
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                {[event.campground.city, event.campground.state, event.campground.zipCode].filter(Boolean).join(', ').replace(/, ([0-9])/, ' $1')}
              </p>
            )}
            {event.campground.phone && (
              <a href={`tel:${event.campground.phone}`} className="text-sm mt-1 block" style={{ color: C.gold }}>📞 {event.campground.phone}</a>
            )}
          </div>
        )}

        {/* Hitch tip */}
        {hitchTip && <HitchTipCard tip={hitchTip} />}
      </div>
    );
  }

  // ── COMPLETED MODE — Memory-focused banner ──
  if (mode === 'COMPLETED') {
    const daysAgo = daysUntil < 0 ? Math.abs(daysUntil) : 0;
    const dateRange = event.startDate
      ? `${new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${event.endDate && event.endDate !== event.startDate ? `–${new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : `, ${new Date(event.startDate).getFullYear()}`}`
      : '';

    return (
      <DestinationSnapshotCard event={event} />
    );
  }

  // ── ALL OTHER MODES (PLANNING, COUNTDOWN, TOMORROW, IN_PROGRESS) ──
  return (
    <div className="space-y-4">
      {/* ═══ HEADER — Countdown + Title ═══ */}
      <div className="rounded-2xl p-5 sm:p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Mode badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{
                background: mode === 'IN_PROGRESS' ? 'rgba(29,158,117,0.15)' : 'rgba(232,168,56,0.15)',
                color: mode === 'IN_PROGRESS' ? C.green : C.gold,
              }}>
                {mode === 'PLANNING' ? '🗺️ Planning' : mode === 'COUNTDOWN' ? '🎒 Countdown' : mode === 'TOMORROW' ? '⚡ Tomorrow' : '🚐 In Progress'}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold leading-tight mb-1" style={{ color: C.cream, fontFamily: "'Playfair Display', serif" }}>
              {event.title}
            </h1>

            {/* Destination */}
            {(event.campground?.name || event.location) && (
              <p className="text-sm flex items-center gap-1.5" style={{ color: C.muted }}>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.gold }} />
                <span>
                  {event.campground?.name || event.location}
                  {event.campground?.city && event.campground?.state && (
                    <span style={{ color: 'rgba(148,163,184,0.6)' }}> · {event.campground.city}, {event.campground.state}</span>
                  )}
                </span>
              </p>
            )}

            {/* Departure date */}
            {event.startDate && (
              <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: C.muted }}>
                <Calendar className="w-3.5 h-3.5" />
                Departing {departureStr}
                {duration && <span style={{ color: 'rgba(245,240,232,0.3)' }}>· {duration} night{duration !== 1 ? 's' : ''}</span>}
              </p>
            )}
          </div>

          {/* Countdown number */}
          {daysUntil >= 0 && mode !== 'IN_PROGRESS' && (
            <div className="text-center flex-shrink-0 rounded-xl px-4 py-3" style={{ background: C.cardLight }}>
              <p className="text-3xl font-bold" style={{ color: C.gold, fontFamily: "'Playfair Display', serif" }}>
                {daysUntil}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>
                {daysUntil === 1 ? 'day' : 'days'}
              </p>
            </div>
          )}
        </div>

        {/* Stats row — clickable */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          {[
            { icon: <Calendar className="w-3.5 h-3.5" />, value: daysUntil, label: 'Days Away', href: `/trips/${event.id}`, hint: 'View trip' },
            { icon: <Users className="w-3.5 h-3.5" />, value: confirmedCount, label: 'Going', href: `/trips/${event.id}?openPhase=plan`, hint: 'View attendees' },
            { icon: <Package className="w-3.5 h-3.5" />, value: event._count?.meals || 0, label: 'Meals', href: `/trips/${event.id}?openPhase=prepare`, hint: 'View or add meals' },
            { icon: <MapPin className="w-3.5 h-3.5" />, value: tripPlan?.pitStops?.length || 0, label: 'Stops', href: `/trips/${event.id}?openPhase=travel`, hint: 'View itinerary' },
          ].map(s => (
            <a key={s.label} href={s.href} title={s.hint}
              className="text-center rounded-lg py-2 transition hover:brightness-125 cursor-pointer block"
              style={{ background: C.cardLight }}>
              <div className="flex justify-center mb-1" style={{ color: C.muted }}>{s.icon}</div>
              <p className="text-lg font-bold" style={{ color: C.gold }}>{s.value}</p>
              <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: C.muted }}>{s.label}</p>
            </a>
          ))}
        </div>
      </div>

      {/* ═══ TRIP HEALTH (Planning & Countdown only) ═══ */}
      {(mode === 'PLANNING' || mode === 'COUNTDOWN' || mode === 'TOMORROW') && (
        <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">{health.tier === 'ready' ? '✅' : health.tier === 'almost' ? '🟡' : health.tier === 'attention' ? '🟠' : '🔴'}</span>
              <span className="text-sm font-semibold" style={{ color: C.cream }}>{health.tierLabel}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: health.tierColor }}>{health.score}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: C.cardLight }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${health.score}%`, background: health.tierColor }} />
          </div>

          {/* Action items */}
          {health.actions.length > 0 && (
            <div className="space-y-1.5">
              {health.actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
                  <AlertCircle className="w-3 h-3 flex-shrink-0" style={{ color: C.amber }} />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ WHO'S GOING ═══ */}
      {(event.attendees?.length > 0 || isOrganizer) && (
        <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: C.cream }}>
              <Users className="w-4 h-4" style={{ color: C.gold }} /> Who's Going
            </h3>
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(186,117,23,0.2)', color: C.amber }}>
                {pendingCount} awaiting
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Organizer */}
            {event.organizer && (
              <Link to={`/profile/${event.organizer.username}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition hover:brightness-110"
                style={{ background: 'rgba(29,158,117,0.15)', color: C.green }}>
                {event.organizer.profilePicture
                  ? <img src={event.organizer.profilePicture} className="w-5 h-5 rounded-full object-cover" alt="" />
                  : <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: C.green, color: C.bg }}>{event.organizer.firstName?.[0]}</div>
                }
                {event.organizer.firstName}
                <CheckCircle className="w-3 h-3" />
              </Link>
            )}
            {(event.attendees || []).filter((a: any) => a.user?.id !== event.organizerId).map((a: any) => {
              const isConfirmed = ['ATTENDING', 'attending', 'GOING', 'going'].includes(a.status);
              const isDeclined = ['not_going', 'NOT_GOING', 'declined', 'DECLINED'].includes(a.status);
              return (
                <Link key={a.id || a.userId} to={`/profile/${a.user?.username}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: isConfirmed ? 'rgba(29,158,117,0.15)' : isDeclined ? 'rgba(239,68,68,0.1)' : 'rgba(148,163,184,0.1)',
                    color: isConfirmed ? C.green : isDeclined ? C.red : C.muted,
                    textDecoration: isDeclined ? 'line-through' : 'none',
                  }}>
                  {a.user?.profilePicture
                    ? <img src={a.user.profilePicture} className="w-5 h-5 rounded-full object-cover" alt="" />
                    : <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: C.cardLight, color: C.muted }}>{a.user?.firstName?.[0] || '?'}</div>
                  }
                  {a.user?.firstName || 'Guest'}
                  {isConfirmed && <CheckCircle className="w-3 h-3" />}
                  {!isConfirmed && !isDeclined && <Clock className="w-3 h-3" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ CAMPGROUND INTEL (Countdown + Tomorrow) ═══ */}
      {(mode === 'COUNTDOWN' || mode === 'TOMORROW') && event.campground && (
        <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: C.cream }}>
            🏕 Know Before You Arrive
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg p-2.5" style={{ background: C.cardLight }}>
              <p style={{ color: C.muted }}>Campground</p>
              <p className="font-medium mt-0.5" style={{ color: C.cream }}>{event.campground.name}</p>
            </div>
            {(event.campground.city || event.campground.state) && (
              <div className="rounded-lg p-2.5" style={{ background: C.cardLight }}>
                <p style={{ color: C.muted }}>Location</p>
                <p className="font-medium mt-0.5" style={{ color: C.cream }}>{[event.campground.city, event.campground.state, event.campground.zipCode].filter(Boolean).join(', ').replace(/, ([0-9])/, ' $1')}</p>
              </div>
            )}
            {event.campground.phone && (
              <div className="rounded-lg p-2.5" style={{ background: C.cardLight }}>
                <p style={{ color: C.muted }}>Phone</p>
                <a href={`tel:${event.campground.phone}`} className="font-medium mt-0.5 block" style={{ color: C.gold }}>{event.campground.phone}</a>
              </div>
            )}
            {event.campground.googleRating && (
              <div className="rounded-lg p-2.5" style={{ background: C.cardLight }}>
                <p style={{ color: C.muted }}>Rating</p>
                <p className="font-medium mt-0.5 flex items-center gap-1" style={{ color: C.gold }}>
                  <Star className="w-3 h-3 fill-current" /> {event.campground.googleRating}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ WEATHER ═══ */}
      {weather && (mode === 'COUNTDOWN' || mode === 'TOMORROW' || mode === 'PLANNING') && (
        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Weather at {event.campground?.name || 'destination'}</p>
            <p className="text-lg font-bold mt-1" style={{ color: C.cream }}>
              {weather.temperature ?? weather.temp}°F · {weather.condition || weather.description}
            </p>
            {weather.sunset && <p className="text-xs mt-0.5" style={{ color: C.muted }}>🌅 Sunset {weather.sunset}</p>}
          </div>
          <span className="text-3xl">{weather.condition?.toLowerCase().includes('sun') ? '☀️' : weather.condition?.toLowerCase().includes('rain') ? '🌧️' : '⛅'}</span>
        </div>
      )}

      {/* ═══ ROUTE OVERVIEW ═══ */}
      {tripPlan && (tripPlan.pitStops?.length > 0 || tripPlan.distanceMiles) && (
        <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: C.cream }}>
            <Navigation className="w-4 h-4" style={{ color: C.gold }} /> Route Overview
          </h3>
          <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
            {tripPlan.startLocation && <span>{tripPlan.startLocation}</span>}
            {tripPlan.pitStops?.length > 0 && <span>→ {tripPlan.pitStops.length} stop{tripPlan.pitStops.length !== 1 ? 's' : ''}</span>}
            <span>→ {event.campground?.name || event.location || 'Destination'}</span>
          </div>
          <div className="flex gap-3 mt-2 text-xs" style={{ color: C.gold }}>
            {tripPlan.distanceMiles && <span>🛣 {tripPlan.distanceMiles} mi</span>}
            {tripPlan.durationMinutes && <span>⏱ {Math.floor(tripPlan.durationMinutes / 60)}h {tripPlan.durationMinutes % 60}m</span>}
          </div>
        </div>
      )}

      {/* ═══ HITCH TIP ═══ */}
      {hitchTip && <HitchTipCard tip={hitchTip} />}
    </div>
  );
}

// ── Hitch Tip Card ──
function HitchTipCard({ tip }: { tip: string }) {
  return (
    <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.15)' }}>
      <img src="/hitch.png" alt="Hitch" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.gold }}>Hitch says</p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: C.cream }}>{tip}</p>
      </div>
    </div>
  );
}

// ── Departure Day Checklist ──
function DepartureChecklist({ eventId }: { eventId: string }) {
  const storageKey = `departure-checklist-${eventId}`;
  const items = [
    { id: 'slides', label: 'Slides retracted' },
    { id: 'jacks', label: 'Jacks up' },
    { id: 'awning', label: 'Awning retracted' },
    { id: 'water', label: 'Water hose disconnected' },
    { id: 'tires', label: 'Tire pressure checked' },
    { id: 'devices', label: 'Devices charged' },
    { id: 'pets', label: 'Pets secured' },
  ];

  const [checked, setChecked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { return new Set(); }
  });

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  return (
    <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: C.cream }}>Pre-Departure Checklist</h3>
        <span className="text-xs font-bold" style={{ color: checked.size === items.length ? C.green : C.gold }}>
          {checked.size}/{items.length}
        </span>
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <button key={item.id} onClick={() => toggle(item.id)}
            className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-left transition active:scale-[0.98]"
            style={{ background: checked.has(item.id) ? 'rgba(29,158,117,0.1)' : C.cardLight }}>
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{
              background: checked.has(item.id) ? C.green : 'transparent',
              border: checked.has(item.id) ? 'none' : `2px solid ${C.border}`,
            }}>
              {checked.has(item.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-sm" style={{
              color: checked.has(item.id) ? C.green : C.cream,
              textDecoration: checked.has(item.id) ? 'line-through' : 'none',
            }}>{item.label}</span>
          </button>
        ))}
      </div>
      {checked.size === items.length && (
        <p className="text-center text-sm font-semibold mt-3" style={{ color: C.green }}>Ready to roll! 🚐</p>
      )}
    </div>
  );
}
