import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users, MessageCircle, Flame, Dog, ChevronDown } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import RSVPSiteForm from './RSVPSiteForm';

interface Props {
  eventId: string;
  campgroundName?: string;
}

const RIG_ICONS: Record<string, string> = {
  'Class A': '🚌', 'Class B': '🚐', 'Class C': '🚍', 'Van': '🚐',
  'Fifth Wheel': '🏠', 'Travel Trailer': '🚗', 'Tent': '⛺',
};

export default function EventCampgroundMap({ eventId, campgroundName }: Props) {
  const { user } = useAuth() as any;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'friends' | 'dogs' | 'social' | 'twins'>('all');
  const [myStatus, setMyStatus] = useState<string>('NOT_ARRIVED');
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const loadMap = async () => {
    try {
      const { data: d } = await api.get(`/events/${eventId}/campground-map`);
      setData(d);
      // Find current user's status
      for (const loop of d.loops || []) {
        const me = loop.attendees?.find((a: any) => a.userId === user?.id);
        if (me) { setMyStatus(me.arrivalStatus); break; }
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadMap(); }, [eventId]);

  const updateStatus = async (status: string) => {
    setStatusUpdating(true);
    try {
      await api.patch(`/events/${eventId}/arrival-status`, { status });
      setMyStatus(status);
      loadMap();
    } catch {}
    finally { setStatusUpdating(false); }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>;

  const allAttendees = data?.loops?.flatMap((l: any) => l.attendees) || [];
  const filtered = allAttendees.filter((a: any) => {
    if (filter === 'friends') return a.isFriend;
    if (filter === 'dogs') return a.hasDogs;
    if (filter === 'social') return a.isOpenToVisitors || a.campfireActive;
    if (filter === 'twins') return a.isRigTwin;
    return true;
  });

  const StatusButton = ({ status, icon, label }: { status: string; icon: string; label: string }) => (
    <button onClick={() => updateStatus(status)} disabled={statusUpdating}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${myStatus === status ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-100'}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Arrival status bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <p className="text-xs text-gray-500 mb-2 font-medium">Your status:</p>
        <div className="flex gap-2 flex-wrap">
          <StatusButton status="NOT_ARRIVED" icon="🟡" label="Not here yet" />
          <StatusButton status="CHECKED_IN" icon="🟢" label="I've arrived!" />
          <StatusButton status="CAMPFIRE_ACTIVE" icon="🔥" label="Campfire's on!" />
        </div>
      </div>

      {/* Incognito banner */}
      {data?.viewerIsHidden && (
        <div className="bg-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm">
          <span>🕶️</span>
          <span className="text-gray-600 flex-1">You're in incognito — you can see everyone but won't appear on the map.</span>
          <button onClick={() => setShowSiteForm(true)} className="text-orange-600 font-semibold text-xs">Update →</button>
        </div>
      )}

      {/* Map image */}
      {data?.mapImageUrl ? (
        <div className="rounded-xl overflow-hidden border border-gray-200 relative">
          <img src={data.mapImageUrl} className="w-full" alt="Campground map" style={{ touchAction: 'manipulation' }} />
          {/* Loop cluster badges */}
          {data.loops?.filter((l: any) => l.loopArea).map((loop: any, i: number) => (
            <div key={i} className="absolute bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow"
              style={{ top: `${20 + i * 15}%`, left: `${10 + (i % 3) * 30}%` }}>
              {loop.loopArea} · {loop.count} rigs
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{campgroundName || 'Campground'} map</p>
          <p className="text-xs text-gray-400">No map uploaded yet</p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All', icon: '' },
          { key: 'friends', label: 'Friends', icon: '👥' },
          { key: 'dogs', label: 'Dogs', icon: '🐶' },
          { key: 'social', label: 'Social', icon: '🔥' },
          { key: 'twins', label: 'Rig Twins', icon: '🚐' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition ${filter === f.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-100'}`}>
            {f.icon} {f.label} {f.key === 'all' ? `(${allAttendees.length})` : ''}
          </button>
        ))}
      </div>

      {/* Attendee cards by loop */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-2xl mb-2">🏕️</p>
          <p className="text-sm text-gray-500">No one has shared their site info yet — be the first!</p>
          <button onClick={() => setShowSiteForm(true)} className="mt-2 text-sm text-orange-600 font-semibold">Add my site →</button>
        </div>
      ) : (
        <div className="space-y-4">
          {data.loops?.filter((loop: any) => {
            const loopFiltered = loop.attendees?.filter((a: any) => filtered.includes(a));
            return loopFiltered?.length > 0;
          }).map((loop: any) => (
            <div key={loop.loopArea || 'other'}>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                {loop.loopArea || 'Other Attendees'} · {loop.count} rig{loop.count !== 1 ? 's' : ''}
                {loop.count >= 5 && <span className="text-orange-500 normal-case font-medium ml-1">— busy area!</span>}
              </h4>
              <div className="space-y-2">
                {loop.attendees?.filter((a: any) => filtered.includes(a)).map((a: any) => (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-3 flex gap-3">
                    {/* Rig icon */}
                    <div className="text-2xl flex-shrink-0 mt-0.5">{RIG_ICONS[a.user?.rvType] || '🚐'}</div>
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {a.user?.profilePicture ? (
                        <img src={a.user.profilePicture} className="w-10 h-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-sm font-bold text-orange-700">{a.user?.firstName?.[0]}</div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/profile/${a.user?.username}`} className="text-sm font-bold text-gray-900 hover:text-orange-600 transition truncate">{a.user?.firstName} {a.user?.lastName}</Link>
                        {a.arrivalStatus === 'CHECKED_IN' && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Checked in" />}
                        {a.arrivalStatus === 'CAMPFIRE_ACTIVE' && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0" title="Campfire active" />}
                        {a.arrivalStatus === 'NOT_ARRIVED' && <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" title="Not arrived" />}
                      </div>
                      {(a.user?.rvMake || a.user?.rvType) && (
                        <p className="text-xs text-gray-400 truncate">{[a.user?.rvYear, a.user?.rvMake, a.user?.rvModel].filter(Boolean).join(' ') || a.user?.rvType}</p>
                      )}
                      {(a.siteNumber || a.loopArea) && (
                        <div className="flex gap-1.5 mt-1">
                          {a.siteNumber && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Site {a.siteNumber}</span>}
                          {a.loopArea && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{a.loopArea}</span>}
                        </div>
                      )}
                      {/* Badges */}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {a.hasDogs && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">🐾 Dogs</span>}
                        {(a.isOpenToVisitors || a.campfireActive) && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">🔥 Social</span>}
                        {a.isRigTwin && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">🚐 Rig Twin!</span>}
                        {a.isFriend && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">👥 Friend</span>}
                      </div>
                      {/* Digital flag */}
                      {a.digitalFlag && (
                        <div className="mt-1.5 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5 text-xs text-orange-800 italic">
                          💬 {a.digitalFlag}
                        </div>
                      )}
                    </div>
                    {/* Quick actions */}
                    {a.userId !== user?.id && (
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Link to={`/profile/${a.user?.username}`} className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="Message">
                          <MessageCircle className="w-4 h-4 text-gray-400" />
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Update site form */}
      <button onClick={() => setShowSiteForm(!showSiteForm)}
        className="w-full text-xs text-orange-600 font-semibold hover:text-orange-700 transition flex items-center justify-center gap-1">
        <ChevronDown className={`w-3 h-3 transition ${showSiteForm ? 'rotate-180' : ''}`} />
        {showSiteForm ? 'Hide form' : 'Update my site info'}
      </button>
      {showSiteForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <RSVPSiteForm eventId={eventId} onSave={() => { setShowSiteForm(false); loadMap(); }} onSkip={() => setShowSiteForm(false)} />
        </div>
      )}
    </div>
  );
}
