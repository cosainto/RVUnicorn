import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import api from '../../services/api';

interface Props { user: any; cn: Record<string, string>; }

function getWeekendDates(): { sat: string; sun: string } {
  const now = new Date();
  const day = now.getDay();
  const sat = new Date(now);
  sat.setDate(now.getDate() + (6 - day));
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { sat: fmt(sat), sun: fmt(sun) };
}

export default function WeekendNearYou({ user, cn }: Props) {
  const [campgrounds, setCampgrounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const weekend = getWeekendDates();

  useEffect(() => {
    const lat = (user as any)?.homeLatitude;
    const lng = (user as any)?.homeLongitude;
    if (!lat || !lng) {
      setLoading(false);
      return;
    }
    api.get(`/campgrounds/weekend-near-me?lat=${lat}&lng=${lng}&radius=320`)
      .then(r => setCampgrounds(r.data?.campgrounds || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
        <div className="h-5 w-48 rounded lifestyle-shimmer mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-32 rounded-xl lifestyle-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!campgrounds.length) return null;

  return (
    <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Compass className="w-4 h-4" style={{ color: cn.gold }} />
        <h3 className="text-sm font-bold" style={{ fontFamily: "'Playfair Display', serif", color: cn.cream }}>
          This Weekend Near You
        </h3>
      </div>
      <p className="text-xs mb-4" style={{ color: cn.muted }}>
        {(user as any)?.homeCity || 'Your area'}{(user as any)?.homeState ? `, ${(user as any).homeState}` : ''} · {weekend.sat} – {weekend.sun}
      </p>

      {/* Campground cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 overflow-x-auto sm:overflow-visible">
        {campgrounds.slice(0, 3).map((cg: any) => (
          <Link
            key={cg.id}
            to={`/campgrounds/${cg.id}`}
            className="rounded-xl p-3 transition hover:brightness-110 relative min-w-[200px]"
            style={{ background: cn.cardAlt, border: `1px solid ${cn.border}` }}
          >
            {cg.matchScore && (
              <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${cn.gold}20`, color: cn.gold }}>
                {cg.matchScore}% match
              </span>
            )}
            <p className="text-sm font-semibold truncate mb-1" style={{ color: cn.cream }}>{cg.name}</p>
            {cg.driveTimeMinutes && (
              <p className="text-[11px] mb-1" style={{ color: cn.muted }}>
                ~{Math.round(cg.driveTimeMinutes / 60)}h {cg.driveTimeMinutes % 60}m drive
              </p>
            )}
            {cg.amenitiesSummary && (
              <p className="text-[10px] leading-relaxed" style={{ color: cn.muted }}>{cg.amenitiesSummary}</p>
            )}
          </Link>
        ))}
      </div>

      {/* Footer link */}
      <div className="mt-4 text-center">
        <Link to="/hitch" className="text-xs font-semibold transition hover:brightness-110" style={{ color: cn.gold }}>
          Can't decide? Ask Hitch →
        </Link>
      </div>
    </div>
  );
}
