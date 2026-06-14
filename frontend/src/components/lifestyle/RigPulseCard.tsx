import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Plus } from 'lucide-react';
import api from '../../services/api';

interface Props { user: any; cn: Record<string, string>; }

export default function RigPulseCard({ user, cn }: Props) {
  const [maintenance, setMaintenance] = useState<any>(null);
  const [lastTrip, setLastTrip] = useState<any>(null);
  const [rig, setRig] = useState<any>(null);
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
    // Fetch user's rig (with co-pilots)
    if (user?.id) {
      api.get(`/rigs/user/${user.id}/owned`).then(r => {
        const rigs = Array.isArray(r.data) ? r.data : [];
        if (rigs.length > 0) {
          // Fetch full rig detail with pilots
          api.get(`/rigs/${rigs[0].slug}`).then(r2 => setRig(r2.data)).catch(() => setRig(rigs[0]));
        }
      }).catch(() => {});
    }
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

  const rigPhoto = rig?.heroPhoto || null;
  const pilots = rig?.pilots?.filter((p: any) => p.user?.id !== rig?.ownerId) || [];
  const rigSlug = rig?.slug;
  const isOwner = rig?.ownerId === user?.id;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: cn.card, border: `1px solid ${cn.border}`, borderLeft: `3px solid ${cn.orange}` }}>
      <div className="flex flex-col sm:flex-row">
        {/* Rig Photo */}
        <div className="sm:w-32 sm:h-auto h-40 flex-shrink-0">
          {rigPhoto ? (
            <img src={rigPhoto} alt="Rig" className="w-full h-full object-cover sm:rounded-l-xl" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: '#1B2B4B' }}>
              <span className="text-5xl">{'\u{1F690}'}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-5">
          {/* Header */}
          <div className="flex items-start gap-3 mb-2">
            <Truck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: cn.gold }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: cn.cream }}>
                {user?.rvYear ? `${user.rvYear} ` : ''}{user?.rvMake || ''} {user?.rvModel || ''}
              </p>
              {(user?.rvType || user?.rvMpg) && (
                <p className="text-xs" style={{ color: cn.muted }}>
                  {user.rvType?.replace('_', ' ')}{user.rvMpg ? ` \u00B7 ${user.rvMpg} MPG` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Co-Pilots Row */}
          {pilots.length > 0 ? (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex -space-x-2">
                {pilots.slice(0, 4).map((p: any) => (
                  p.user?.profilePicture ? (
                    <img key={p.id} src={p.user.profilePicture} alt={p.user.firstName} title={`${p.user.firstName} ${p.user.lastName || ''}`} className="w-7 h-7 rounded-full object-cover border-2" style={{ borderColor: cn.card }} />
                  ) : (
                    <div key={p.id} title={`${p.user?.firstName || ''} ${p.user?.lastName || ''}`} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2" style={{ borderColor: cn.card, background: 'rgba(232,168,56,0.2)', color: cn.gold }}>
                      {p.user?.firstName?.[0] || '?'}
                    </div>
                  )
                ))}
              </div>
              <span className="text-[11px]" style={{ color: cn.muted }}>
                {pilots.slice(0, 2).map((p: any) => p.user?.firstName).join(', ')}
                {pilots.length > 2 ? ` + ${pilots.length - 2} more` : ''}
                {' \u00B7 '}{pilots.length === 1 ? 'Co-Pilot' : 'Co-Pilots'}
              </span>
            </div>
          ) : isOwner && rigSlug ? (
            <Link to={`/rig/${rigSlug}/settings`} className="flex items-center gap-1.5 mb-3 text-[11px] transition hover:brightness-125" style={{ color: cn.muted }}>
              <Plus className="w-3 h-3" /> Add co-pilot
            </Link>
          ) : null}

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
                <p className="text-xs" style={{ color: cn.success }}>No upcoming maintenance {'\u2014'} you're good {'\u2713'}</p>
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
                <p className="text-xs" style={{ color: cn.gold }}>No trips yet {'\u2014'} let's change that</p>
              )}
            </div>
          </div>

          {/* CTA */}
          <Link
            to={rigSlug ? `/rig/${rigSlug}` : '/my-rv'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition hover:brightness-110"
            style={{ border: `1px solid ${cn.gold}`, color: cn.gold }}
          >
            Open Rig HQ {'\u2192'}
          </Link>
        </div>
      </div>
    </div>
  );
}
