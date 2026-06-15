import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Plus } from 'lucide-react';
import api from '../../services/api';

interface Props { user: any; cn: Record<string, string>; }

interface TripWithoutPhotos {
  tripId: string;
  tripName: string;
  campgroundName: string | null;
  startDate: string;
  endDate: string;
  daysAgo: number;
  stopCount: number;
  isWithin30Days: boolean;
}

export default function RigPulseCard({ user, cn }: Props) {
  const [maintenance, setMaintenance] = useState<any>(null);
  const [lastTrip, setLastTrip] = useState<any>(null);
  const [tripsWithoutPhotos, setTripsWithoutPhotos] = useState<TripWithoutPhotos[]>([]);
  const [rig, setRig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/maintenance/reminders/upcoming').catch(() => ({ data: [] })),
      api.get('/events/my-events?limit=1&status=completed').catch(() => ({ data: [] })),
      api.get('/rigs/trips-without-photos').catch(() => ({ data: [] })),
    ]).then(([maint, trips, noPhotos]) => {
      const reminders = Array.isArray(maint.data) ? maint.data : [];
      setMaintenance(reminders[0] || null);
      const tripList = Array.isArray(trips.data) ? trips.data : (trips.data?.events || []);
      setLastTrip(tripList[0] || null);
      setTripsWithoutPhotos(Array.isArray(noPhotos.data) ? noPhotos.data : []);
      setLoading(false);
    });
    if (user?.id) {
      api.get(`/rigs/user/${user.id}/owned`).then(r => {
        const rigs = Array.isArray(r.data) ? r.data : [];
        if (rigs.length > 0) {
          api.get(`/rigs/${rigs[0].slug}`).then(r2 => setRig(r2.data)).catch(() => setRig(rigs[0]));
        }
      }).catch(() => {});
    }
  }, []);

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

  const formatDaysAgo = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days <= 7) return `${days} days ago`;
    return new Date(Date.now() - days * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
      {/* Hero Photo */}
      <div className="relative h-[200px] overflow-hidden">
        {rigPhoto ? (
          <img src={rigPhoto} alt="Rig" className="w-full h-full object-cover" style={{ objectPosition: 'center 40%' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1B2B4B, #0F1C35)' }}>
            <span className="text-6xl">{'\u{1F690}'}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-[40%]" style={{ background: 'linear-gradient(to top, rgba(15,28,53,0.95), transparent)' }} />
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: cn.orange }} />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <p className="text-base font-bold text-white drop-shadow-lg">
              {user?.rvYear ? `${user.rvYear} ` : ''}{user?.rvMake || ''} {user?.rvModel || ''}
            </p>
            {(user?.rvType || user?.rvMpg) && (
              <p className="text-xs text-white/60">
                {user.rvType?.replace('_', ' ')}{user.rvMpg ? ` \u00B7 ${user.rvMpg} MPG` : ''}
              </p>
            )}
          </div>
          {/* Photo badge on hero */}
          {tripsWithoutPhotos.length >= 3 && (
            <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(232,168,56,0.9)', color: '#0F1C35' }}>
              {'\u{1F4F8}'} {tripsWithoutPhotos.length} trips need photos
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Co-Pilots */}
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
            <div className="h-2 rounded-full transition-all duration-1000"
              style={{ width: `${score}%`, background: scoreColor, boxShadow: score < 60 ? `0 0 8px ${cn.orange}` : 'none' }} />
          </div>
        </div>

        {/* Maintenance + Last Adventure / Trips Without Photos */}
        <div className="mb-4">
          {/* Maintenance — always shows */}
          <div className="mb-3">
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

          {/* Trips Without Photos list */}
          {tripsWithoutPhotos.length > 0 ? (
            <div className="pt-3" style={{ borderTop: `1px solid ${cn.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cn.gold }}>{'\u{1F4F8}'} Trips without photos</p>
                <span className="text-[10px]" style={{ color: cn.muted }}>{tripsWithoutPhotos.length} adventure{tripsWithoutPhotos.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-0 max-h-[140px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {tripsWithoutPhotos.map((trip) => (
                  <div key={trip.tripId} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${cn.border}` }}>
                    {/* Urgency dot */}
                    {trip.daysAgo <= 7 && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: trip.daysAgo > 30 ? cn.muted : cn.cream }}>
                        {(trip.campgroundName || trip.tripName || 'Trip').slice(0, 30)}
                      </p>
                      <p className="text-[10px]" style={{ color: cn.muted }}>
                        {formatDaysAgo(trip.daysAgo)}{trip.stopCount > 0 ? ` \u00B7 ${trip.stopCount} stop${trip.stopCount !== 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                    <Link
                      to={rigSlug ? `/rig/${rigSlug}?tab=photos&createAlbum=true&tripId=${trip.tripId}` : `/trips/${trip.tripId}`}
                      className="flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold transition hover:brightness-125"
                      style={trip.daysAgo > 30
                        ? { color: cn.muted, border: `1px solid ${cn.border}` }
                        : { background: 'rgba(232,168,56,0.15)', color: cn.gold, border: '1px solid rgba(232,168,56,0.3)' }
                      }
                    >
                      + {trip.daysAgo > 30 ? 'Add anyway' : 'Add Photos'}
                    </Link>
                  </div>
                ))}
              </div>
              {/* Hitch nudge */}
              {tripsWithoutPhotos.length >= 2 && (
                <div className="flex items-center gap-1.5 mt-2 pt-2" style={{ borderTop: `1px solid ${cn.border}` }}>
                  <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_40,h_40,c_fill/v1775261116/rvunicorn/characters/hitch.png" alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                  <span className="text-[9px] italic" style={{ color: cn.muted }}>The best time to add photos is right after a trip. The second best time is now! {'\u{1F920}'}</span>
                </div>
              )}
            </div>
          ) : lastTrip ? (
            /* Fallback: show Last Adventure if all trips have photos */
            <div className="pt-3" style={{ borderTop: `1px solid ${cn.border}` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cn.muted }}>Last Adventure</p>
              <p className="text-xs" style={{ color: cn.cream }}>
                {daysSinceTrip} day{daysSinceTrip !== 1 ? 's' : ''} ago
                {lastTrip.campground?.name && <span className="block text-[10px]" style={{ color: cn.muted }}>{lastTrip.campground.name}</span>}
              </p>
              <p className="text-[10px] mt-1" style={{ color: cn.success }}>{'\u2705'} All recent trips have photos {'\u2014'} nice work!</p>
            </div>
          ) : null}
        </div>

        {/* CTA */}
        <Link
          to={rigSlug ? `/rig/${rigSlug}` : '/my-rv'}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition hover:brightness-110"
          style={{ border: `1px solid ${cn.gold}`, color: cn.gold }}
        >
          Open Rig HQ {'\u2192'}
        </Link>
      </div>
    </div>
  );
}
