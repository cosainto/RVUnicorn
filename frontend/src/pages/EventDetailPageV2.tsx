import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Calendar, Users, MapPin, Settings, Bell, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import MealCard from '../components/MealCard';
import EventCampgroundMap from '../components/EventCampgroundMap';
import LiveEventBadge from '../components/LiveEventBadge';
import { useEventPresence } from '../hooks/useEventPresence';
import { useEventLifecycle } from '../hooks/useEventLifecycle';

const MODE_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  FULL: { emoji: '🎪', label: 'Full', color: 'bg-amber-100 text-amber-800' },
  CASUAL: { emoji: '👀', label: 'Casual', color: 'bg-gray-100 text-gray-700' },
  NEARBY: { emoji: '🏕️', label: 'Nearby', color: 'bg-green-100 text-green-800' },
};

const BATTERY_COLORS: Record<string, string> = { OPEN: '#22c55e', BUSY: '#eab308', DND: '#ef4444' };

export default function EventDetailPageV2() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth() as any;
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'event' | 'campground'>('event');
  const [tab, setTab] = useState<'schedule' | 'announcements' | 'meals' | 'attendees'>('schedule');
  const [myAttendee, setMyAttendee] = useState<any>(null);
  const [joining, setJoining] = useState(false);

  const loadEvent = async () => {
    try {
      const { data } = await api.get(`/events-v2/${id}`);
      setEvent(data.event);
      const me = data.event?.attendees?.find((a: any) => a.userId === user?.id);
      setMyAttendee(me);
      if (me?.participationMode === 'NEARBY') setView('campground');
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (id) loadEvent(); }, [id, user]);

  const [waitlistInfo, setWaitlistInfo] = useState<{ position: number; message: string } | null>(null);

  const handleJoin = async (mode: string) => {
    setJoining(true);
    try {
      const { data } = await api.post(`/events-v2/${id}/join`, { participationMode: mode });
      if (data.waitlist) {
        setWaitlistInfo({ position: data.position, message: data.message });
      }
      loadEvent();
    } catch (e: any) {
      if (e.response?.data?.error === 'Event is full') {
        setWaitlistInfo({ position: 0, message: 'Event is full — try joining to get on the waitlist.' });
      }
    }
    finally { setJoining(false); }
  };

  const handleLeave = async () => {
    if (!confirm('Leave this event?')) return;
    try {
      await api.delete(`/events-v2/${id}/leave`);
      setMyAttendee(null);
      setWaitlistInfo(null);
      loadEvent();
    } catch {}
  };

  const updateMode = async (mode: string) => {
    try {
      await api.put(`/events-v2/${id}/attendance`, { participationMode: mode });
      setMyAttendee((prev: any) => ({ ...prev, participationMode: mode }));
      if (mode === 'NEARBY') setView('campground');
    } catch {}
  };

  const updateBattery = async (battery: string) => {
    try {
      await api.put(`/events-v2/${id}/attendance`, { socialBattery: battery });
      setMyAttendee((prev: any) => ({ ...prev, socialBattery: battery }));
    } catch {}
  };

  const lifecycle = useEventLifecycle(event?.startDate || '', event?.endDate || '', event?.eventStatus);
  const { hereNow } = useEventPresence(id);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-2xl animate-pulse">🏕️</div></div>;
  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Event not found</p></div>;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isOrganizer = event.organizerId === user?.id;
  const now = new Date();
  const happeningNow = event.scheduleItems?.find((item: any) => new Date(item.startTime) <= now && (!item.endTime || new Date(item.endTime) >= now));

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>{event.title} — RVUnicorn Events</title></Helmet>

      {/* Banner */}
      <div className="h-40 bg-gradient-to-br from-[#1B2B4B] to-[#2d4a7a] relative overflow-hidden">
        {event.bannerImage && <img src={event.bannerImage} className="w-full h-full object-cover opacity-60" alt="" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2">
            <h1 className="text-white font-bold text-xl">{event.title}</h1>
            <LiveEventBadge startDate={event.startDate} endDate={event.endDate} eventStatus={event.eventStatus} size="md" />
          </div>
          <div className="flex items-center gap-3 mt-1 text-white/70 text-xs">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(event.startDate)} – {formatDate(event.endDate)}</span>
            {(event.campground?.name || event.locationName) && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.campground?.name || event.locationName}</span>
            )}
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {event.attendees?.length || 0}</span>
          </div>
        </div>
        {isOrganizer && (
          <Link to={`/events-v2/${id}/manage`} className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 p-2 rounded-xl transition">
            <Settings className="w-4 h-4 text-white" />
          </Link>
        )}
      </div>

      {/* Happening Now */}
      {happeningNow && (
        <div className="bg-[#E86C3A] text-white px-4 py-2 flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="font-bold">Now:</span>
          <span>{happeningNow.title}</span>
          {happeningNow.location && <span className="text-orange-100">· {happeningNow.location}</span>}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Here Now strip — visible when event is LIVE */}
        {lifecycle === 'LIVE' && hereNow.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
            <p className="text-xs font-bold text-green-700 mb-2">🟢 Here Now ({hereNow.length})</p>
            <div className="flex gap-2 overflow-x-auto">
              {hereNow.map(p => (
                <Link key={p.userId} to={`/profile/${p.user.username || p.userId}`}
                  className="flex flex-col items-center gap-1 flex-shrink-0">
                  {p.user.profilePicture ? (
                    <div className="relative">
                      <img src={p.user.profilePicture} className="w-10 h-10 rounded-full object-cover ring-2 ring-green-400" alt="" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-sm font-bold text-green-700 ring-2 ring-green-400">
                        {p.user.firstName?.[0]}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                    </div>
                  )}
                  <span className="text-[10px] text-green-700 font-medium truncate max-w-[60px]">{p.user.firstName}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Waitlist banner */}
        {waitlistInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-blue-800">{'\u{1F3D5}'} {waitlistInfo.message}</p>
          </div>
        )}

        {/* Plan B banner */}
        {event?.planBActivated && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-amber-800">{'\u{26A0}'} Plan B Activated</p>
            {event.planBDescription && <p className="text-sm text-amber-700 mt-1">{event.planBDescription}</p>}
            {event.planBLocation && <p className="text-xs text-amber-600 mt-1">{'\u{1F4CD}'} {event.planBLocation}</p>}
          </div>
        )}

        {/* Capacity indicator */}
        {event?.maxAttendees && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(100, ((event.attendees?.filter((a: any) => a.status === 'ATTENDING' || a.status === 'HERE_NOW').length || 0) / event.maxAttendees) * 100)}%`,
                background: (event.attendees?.filter((a: any) => a.status === 'ATTENDING' || a.status === 'HERE_NOW').length || 0) >= event.maxAttendees ? '#ef4444' : '#C9A84C',
              }} />
            </div>
            <span className="text-xs text-gray-500">
              {event.attendees?.filter((a: any) => a.status === 'ATTENDING' || a.status === 'HERE_NOW').length || 0}/{event.maxAttendees} spots
            </span>
          </div>
        )}

        {/* Join / Mode controls */}
        {!myAttendee ? (
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              {event?.maxAttendees && (event.attendees?.filter((a: any) => a.status === 'ATTENDING' || a.status === 'HERE_NOW').length || 0) >= event.maxAttendees
                ? 'Event is full — join the waitlist'
                : 'How do you want to participate?'}
            </p>
            <div className="flex gap-2">
              {Object.entries(MODE_LABELS).map(([key, { emoji, label, color }]) => (
                <button key={key} onClick={() => handleJoin(key)} disabled={joining}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${color} border-transparent hover:border-current disabled:opacity-50`}>
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>
        ) : myAttendee.status === 'WAITLIST' ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800">On the Waitlist</p>
              <p className="text-xs text-blue-600 mt-0.5">We'll notify you when a spot opens</p>
            </div>
            <button onClick={handleLeave} className="text-xs text-red-500 hover:text-red-700">Leave Waitlist</button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              {Object.entries(MODE_LABELS).map(([key, { emoji, label }]) => (
                <button key={key} onClick={() => updateMode(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${myAttendee.participationMode === key ? 'bg-[#1B2B4B] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {emoji} {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {view === 'campground' && (
                <div className="flex gap-1">
                  {['OPEN', 'BUSY', 'DND'].map(b => (
                    <button key={b} onClick={() => updateBattery(b)}
                      className={`w-6 h-6 rounded-full border-2 transition ${myAttendee.socialBattery === b ? 'border-gray-900 scale-110' : 'border-gray-200'}`}
                      style={{ backgroundColor: BATTERY_COLORS[b] }} title={b} />
                  ))}
                </div>
              )}
              <button onClick={handleLeave} className="text-xs text-gray-400 hover:text-red-500 transition">Leave</button>
            </div>
          </div>
        )}

        {/* View toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          <button onClick={() => setView('event')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${view === 'event' ? 'bg-white shadow text-[#1B2B4B]' : 'text-gray-500'}`}>
            🎪 Event View
          </button>
          <button onClick={() => setView('campground')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${view === 'campground' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}>
            🏕️ Campground View
          </button>
        </div>

        {/* Event View */}
        {view === 'event' && (
          <div>
            {/* Tabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto">
              {(['schedule', 'announcements', 'meals', 'attendees'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${tab === t ? 'bg-[#1B2B4B] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Schedule */}
            {tab === 'schedule' && (
              <div className="space-y-2">
                {(event.scheduleItems || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No schedule items yet</p>
                ) : event.scheduleItems.map((item: any) => (
                  <div key={item.id} className={`bg-white rounded-xl border p-3 ${happeningNow?.id === item.id ? 'border-orange-300 bg-orange-50' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      </div>
                      {item.isOptional && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Optional</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>{new Date(item.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                      {item.endTime && <span>– {new Date(item.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                      {item.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.location}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Announcements */}
            {tab === 'announcements' && (
              <div className="space-y-3">
                {(event.announcements || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No announcements yet</p>
                ) : event.announcements.map((a: any) => (
                  <div key={a.id} className={`bg-white rounded-xl border p-4 ${a.isPinned ? 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
                    {a.isPinned && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold mb-1 inline-block">📌 Pinned</span>}
                    <h4 className="font-bold text-gray-900 text-sm">{a.title}</h4>
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">{a.body}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      {a.author?.profilePicture && <img src={a.author.profilePicture} className="w-4 h-4 rounded-full" alt="" />}
                      <span>{a.author?.firstName}</span>
                      <span>·</span>
                      <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Meals */}
            {tab === 'meals' && (
              <div className="space-y-3">
                {(event.meals || []).filter((m: any) => m.mealType === 'OFFICIAL').length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Official Meals</h3>
                    <div className="space-y-2">
                      {event.meals.filter((m: any) => m.mealType === 'OFFICIAL').map((m: any) => (
                        <MealCard key={m.id} meal={m} eventId={event.id} onUpdate={loadEvent} />
                      ))}
                    </div>
                  </div>
                )}
                {(event.meals || []).filter((m: any) => m.mealType !== 'OFFICIAL').length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Community Meals</h3>
                    <div className="space-y-2">
                      {event.meals.filter((m: any) => m.mealType !== 'OFFICIAL').map((m: any) => (
                        <MealCard key={m.id} meal={m} eventId={event.id} onUpdate={loadEvent} />
                      ))}
                    </div>
                  </div>
                )}
                {(event.meals || []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No meals planned yet</p>}
              </div>
            )}

            {/* Attendees */}
            {tab === 'attendees' && (() => {
              const PRESENCE_ORDER: Record<string, number> = { HERE_NOW: 0, GOING: 1, MAYBE: 2, NOT_GOING: 3 };
              const sorted = [...(event.attendees || [])].sort((a: any, b: any) =>
                (PRESENCE_ORDER[a.presenceStatus] ?? 1) - (PRESENCE_ORDER[b.presenceStatus] ?? 1)
              );
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sorted.map((a: any) => {
                    const isHere = a.presenceStatus === 'HERE_NOW';
                    return (
                      <Link key={a.id} to={`/profile/${a.user?.username}`}
                        className={`bg-white rounded-xl border p-3 text-center hover:border-orange-200 transition ${isHere ? 'border-green-300 bg-green-50/30' : 'border-gray-100'}`}>
                        <div className="relative inline-block">
                          {a.user?.profilePicture ? (
                            <img src={a.user.profilePicture} className={`w-12 h-12 rounded-full object-cover mx-auto ${isHere ? 'ring-2 ring-green-400' : ''}`} alt="" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center text-lg font-bold text-orange-700 mx-auto ${isHere ? 'ring-2 ring-green-400' : ''}`}>{a.user?.firstName?.[0]}</div>
                          )}
                          {isHere && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-1.5 truncate">{a.user?.firstName} {a.user?.lastName}</p>
                        {a.siteNumber && <p className="text-[10px] text-gray-400">Site {a.siteNumber}</p>}
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {isHere && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Here Now</span>}
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full ${MODE_LABELS[a.participationMode]?.color || 'bg-gray-100 text-gray-500'}`}>
                            {MODE_LABELS[a.participationMode]?.label || a.participationMode}
                          </span>
                          {a.socialBattery && (
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: BATTERY_COLORS[a.socialBattery] || '#ccc' }} />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Campground View */}
        {view === 'campground' && (
          <EventCampgroundMap eventId={event.id} campgroundName={event.campground?.name} />
        )}
      </div>
    </div>
  );
}
