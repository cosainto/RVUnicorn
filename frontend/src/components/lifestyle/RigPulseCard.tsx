import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import api from '../../services/api';

interface Props { user: any; cn: Record<string, string>; }

export default function RigPulseCard({ user, cn }: Props) {
  const [maintenance, setMaintenance] = useState<any>(null);
  const [lastTrip, setLastTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/maintenance/reminders/upcoming').catch(() => ({ data: [] })),
      api.get('/events/my-events?limit=1&status=completed').catch(() => ({ data: [] })),
    ]).then(([maint, trips]) => {
      const reminders = Array.isArray(maint.data) ? maint.data : [];
      setMaintenance(reminders[0] || null);
      const tripList = Array.isArray(trips.data) ? trips.data : (trips.data?.events || []);
      setLastTrip(tripList[0] || null);
      setLoading(false);
    });
  }, []);

  // Trip Readiness Score
  let score = 100;
  if (maintenance?.nextDueDate && new Date(maintenance.nextDueDate) < new Date()) score -= 15;
  else if (maintenance?.nextDueDate && new Date(maintenance.nextDueDate) < new Date(Date.now() + 14 * 86400000)) score -= 10;
  if (!lastTrip || (lastTrip && new Date(lastTrip.endDate || lastTrip.startDate) < new Date(Date.now() - 90 * 86400000))) score -= 5;
  if (!user?.rvType) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const scoreColor = score >= 85 ? cn.success : score >= 60 ? cn.gold : cn.orange;
  const daysSinceTrip = lastTrip ? Math.floor((Date.now() - new Date(lastTrip.endDate || lastTrip.startDate).getTime()) / 86400000) : null;

  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}`, borderLeft: `3px solid ${cn.orange}` }}>
        <div className="h-6 w-48 rounded lifestyle-shimmer mb-3" />
        <div className="h-3 w-full rounded lifestyle-shimmer mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 rounded lifestyle-shimmer" />
          <div className="h-12 rounded lifestyle-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}`, borderLeft: `3px solid ${cn.orange}` }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Truck className="w-6 h-6 flex-shrink-0" style={{ color: cn.gold }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: cn.cream }}>
            {user?.rvYear ? `${user.rvYear} ` : ''}{user?.rvMake || ''} {user?.rvModel || ''}
          </p>
          {(user?.rvType || user?.rvMpg) && (
            <p className="text-xs" style={{ color: cn.muted }}>
              {user.rvType?.replace('_', ' ')}{user.rvMpg ? ` · ${user.rvMpg} MPG` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Readiness Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold" style={{ color: cn.muted }}>Trip Readiness Score</span>
          <span className="text-sm font-bold" style={{ color: scoreColor }}>{score}%</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: cn.border }}>
          <div
            className="h-2 rounded-full transition-all duration-1000"
            style={{ width: `${score}%`, background: scoreColor, boxShadow: score < 60 ? `0 0 8px ${cn.orange}` : 'none' }}
          />
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cn.muted }}>Next Maintenance</p>
          {maintenance ? (
            <p className="text-xs" style={{ color: cn.cream }}>
              {maintenance.title}
              {maintenance.nextDueDate && (
                <span className="block text-[10px]" style={{ color: new Date(maintenance.nextDueDate) < new Date() ? cn.orange : cn.muted }}>
                  {new Date(maintenance.nextDueDate) < new Date() ? 'Overdue' : new Date(maintenance.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs" style={{ color: cn.success }}>No upcoming maintenance — you're good ✓</p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cn.muted }}>Last Adventure</p>
          {lastTrip ? (
            <p className="text-xs" style={{ color: cn.cream }}>
              {daysSinceTrip} day{daysSinceTrip !== 1 ? 's' : ''} ago
              {lastTrip.campground?.name && <span className="block text-[10px]" style={{ color: cn.muted }}>{lastTrip.campground.name}</span>}
            </p>
          ) : (
            <p className="text-xs" style={{ color: cn.gold }}>No trips yet — let's change that</p>
          )}
        </div>
      </div>

      {/* CTA */}
      <Link
        to="/my-rv"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition hover:brightness-110"
        style={{ border: `1px solid ${cn.gold}`, color: cn.gold }}
      >
        Open Rig HQ →
      </Link>
    </div>
  );
}
