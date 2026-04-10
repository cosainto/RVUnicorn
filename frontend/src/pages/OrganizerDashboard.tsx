import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Calendar, Users, Radio, Plus, Settings, BarChart3, ChevronRight,
  Megaphone, Cloud, Sun, CloudRain, Snowflake, Wind, Send, MapPin,
  Tent, CheckCircle2
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { computeEventLifecycle } from '../hooks/useEventLifecycle';
import LiveEventBadge from '../components/LiveEventBadge';
import MissionMode from '../components/organizer/MissionMode';

const SKIN_LABELS: Record<string, string> = {
  TRAIL_GUIDE: '🏔️ Trail Guide',
  PARTY_STARTER: '🎉 Party Starter',
  OLD_TIMER: '🤠 Old Timer',
};

// Weather icon picker
function WeatherIcon({ condition }: { condition: string }) {
  const c = (condition || '').toLowerCase();
  if (c.includes('rain') || c.includes('shower')) return <CloudRain className="w-5 h-5 text-blue-400" />;
  if (c.includes('snow') || c.includes('sleet')) return <Snowflake className="w-5 h-5 text-blue-200" />;
  if (c.includes('wind')) return <Wind className="w-5 h-5 text-gray-400" />;
  if (c.includes('cloud') || c.includes('overcast')) return <Cloud className="w-5 h-5 text-gray-400" />;
  return <Sun className="w-5 h-5 text-amber-400" />;
}

export default function OrganizerDashboard() {
  const { user } = useAuth() as any;
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'events' | 'hitch' | 'analytics'>('events');
  const [missionEventId, setMissionEventId] = useState<string | null>(null);

  // ── "Today" panel state ──────────────────────────────────────────────────
  const [myCampground, setMyCampground] = useState<any>(null);
  const [todayCheckIns, setTodayCheckIns] = useState<any[]>([]);
  const [rverCount, setRverCount] = useState(0);
  const [weather, setWeather] = useState<any>(null);

  // ── Broadcast state ──────────────────────────────────────────────────────
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // ── Load organizer's campground + events ─────────────────────────────────
  useEffect(() => {
    const loadAll = async () => {
      try {
        // Get organizer's campground(s)
        const { data: bizData } = await api.get('/business/my');
        const campgrounds = bizData || [];
        const cg = campgrounds[0]; // primary campground
        if (cg) {
          setMyCampground(cg);

          // Parallel fetches: check-ins, occupancy, weather
          const [herdRes, tonightRes, weatherRes] = await Promise.allSettled([
            api.get(`/checkins/herd/campground/${cg.id}`),
            api.get(`/checkins/tonight/${cg.id}`),
            cg.latitude && cg.longitude
              ? api.get(`/weather/forecast?lat=${cg.latitude}&lon=${cg.longitude}`)
              : Promise.resolve(null),
          ]);

          // Today's check-ins — filter to today only
          if (herdRes.status === 'fulfilled') {
            const all = herdRes.value?.data || [];
            const today = new Date().toDateString();
            setTodayCheckIns(all.filter((c: any) => new Date(c.checkInDate || c.createdAt).toDateString() === today));
            // Also use total herd as fallback rverCount
            if (tonightRes.status !== 'fulfilled') setRverCount(all.length);
          }

          // Tonight occupancy
          if (tonightRes.status === 'fulfilled') {
            setRverCount(tonightRes.value?.data?.rverCount || 0);
          }

          // Weather
          if (weatherRes.status === 'fulfilled' && weatherRes.value) {
            setWeather(weatherRes.value.data);
          }
        }

        // Events
        const { data: evtData } = await api.get('/events-v2?limit=50');
        const mine = (evtData.events || []).filter((e: any) => e.organizerId === user?.id);
        setEvents(mine);
      } catch {}
      setLoading(false);
    };
    loadAll();
  }, [user?.id]);

  // ── Broadcast handler ────────────────────────────────────────────────────
  const sendBroadcast = useCallback(async () => {
    if (!broadcastText.trim() || !myCampground?.id) return;
    setBroadcastSending(true);
    try {
      await api.post(`/business/${myCampground.id}/broadcast`, {
        message: broadcastText.trim(),
      });
      setBroadcastSent(true);
      setBroadcastText('');
      setTimeout(() => { setBroadcastSent(false); setBroadcastOpen(false); }, 2000);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setBroadcastSending(false);
    }
  }, [broadcastText, myCampground?.id]);

  if (missionEventId) {
    return (
      <div>
        <button
          onClick={() => setMissionEventId(null)}
          className="fixed top-3 left-3 z-50 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/10 transition"
        >
          ← Back to Dashboard
        </button>
        <MissionMode eventId={missionEventId} />
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-2xl animate-pulse">🎯</div></div>;

  const liveEvents = events.filter(e => computeEventLifecycle(e.startDate, e.endDate, e.eventStatus) === 'LIVE');
  const upcomingEvents = events.filter(e => computeEventLifecycle(e.startDate, e.endDate, e.eventStatus) === 'UPCOMING');
  const pastEvents = events.filter(e => ['ENDED', 'CANCELLED'].includes(computeEventLifecycle(e.startDate, e.endDate, e.eventStatus)));

  return (

    <div className="min-h-screen bg-gray-50">
      <Helmet><title>Organizer Dashboard — RVUnicorn</title></Helmet>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1B2B4B] to-[#2d4a7a] px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <Link to="/basecamp" className="text-white/50 hover:text-white text-xs font-medium transition mb-2 inline-block">← Back to Basecamp</Link>
          <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">Co-Host Autopilot</p>
          <h1 className="text-white text-xl font-bold">Organizer Dashboard</h1>
          <p className="text-white/60 text-sm mt-1">Your command center for campground events</p>
        </div>
      </div>

      {/* ── TODAY AT YOUR CAMPGROUND ─────────────────────────────────── */}
      {myCampground && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">Today at {myCampground.name}</p>
              </div>
              <p className="text-[10px] text-gray-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 divide-x divide-gray-50">
              <div className="px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Tent className="w-3.5 h-3.5 text-green-500" />
                </div>
                <p className="text-lg font-bold text-gray-900">{rverCount}</p>
                <p className="text-[10px] text-gray-500">On Site</p>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <p className="text-lg font-bold text-gray-900">{todayCheckIns.length}</p>
                <p className="text-[10px] text-gray-500">Checked In Today</p>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {events.filter(e => computeEventLifecycle(e.startDate, e.endDate, e.eventStatus) === 'LIVE').length}
                </p>
                <p className="text-[10px] text-gray-500">Live Events</p>
              </div>
              <div className="px-3 py-3 text-center">
                {weather?.current ? (
                  <>
                    <div className="flex items-center justify-center mb-1">
                      <WeatherIcon condition={weather.current.condition || ''} />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{Math.round(weather.current.temp || 0)}°</p>
                    <p className="text-[10px] text-gray-500 truncate">{weather.current.condition || 'Clear'}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center mb-1">
                      <Sun className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                    <p className="text-lg font-bold text-gray-300">—</p>
                    <p className="text-[10px] text-gray-400">Weather</p>
                  </>
                )}
              </div>
            </div>

            {/* Today's check-in names (if any) */}
            {todayCheckIns.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-50 bg-green-50/50">
                <p className="text-[10px] text-green-700 font-semibold mb-1">Arrived today</p>
                <p className="text-xs text-green-800">
                  {todayCheckIns.slice(0, 5).map((c: any) => c.user?.firstName || 'Guest').join(', ')}
                  {todayCheckIns.length > 5 && ` +${todayCheckIns.length - 5} more`}
                </p>
              </div>
            )}

            {/* Broadcast megaphone */}
            <div className="px-4 py-3 border-t border-gray-100">
              {!broadcastOpen ? (
                <button
                  onClick={() => setBroadcastOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition hover:bg-amber-50"
                  style={{ background: 'rgba(245,158,11,0.08)', color: '#92400e', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <Megaphone className="w-4 h-4" /> Broadcast to All Campers
                </button>
              ) : broadcastSent ? (
                <div className="flex items-center justify-center gap-2 py-3 text-green-600 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Broadcast sent!
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                    📢 Send to {rverCount > 0 ? `all ${rverCount} campers on site` : 'all checked-in campers'}
                  </p>
                  <textarea
                    value={broadcastText}
                    onChange={e => setBroadcastText(e.target.value)}
                    placeholder="Storm warning — secure your awnings! · Happy hour at 5 · Fresh donuts at the office..."
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
                    rows={2}
                    maxLength={280}
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{broadcastText.length}/280</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setBroadcastOpen(false); setBroadcastText(''); }}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={sendBroadcast}
                        disabled={!broadcastText.trim() || broadcastSending}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:opacity-50"
                        style={{ background: '#E8622A' }}
                      >
                        <Send className="w-3 h-3" />
                        {broadcastSending ? 'Sending...' : 'Send Now'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-3xl mx-auto px-4 mt-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {([
            { key: 'events', label: '📋 My Events', icon: Calendar },
            { key: 'hitch', label: '🦄 Hitch Config', icon: Settings },
            { key: 'analytics', label: '📊 Analytics', icon: BarChart3 },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition ${
                tab === t.key ? 'bg-white shadow text-[#1B2B4B]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">

        {/* ── Events Tab ── */}
        {tab === 'events' && (
          <div className="space-y-4">
            {/* Live Events — prominent */}
            {liveEvents.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Live Now
                </h2>
                {liveEvents.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setMissionEventId(e.id)}
                    className="w-full bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border-2 border-red-300 p-4 text-left hover:shadow-lg transition mb-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{e.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{e.campground?.name || e.locationName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <LiveEventBadge startDate={e.startDate} endDate={e.endDate} size="md" />
                        <span className="bg-[#1B2B4B] text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                          Enter Mission Mode →
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span><Users className="w-3 h-3 inline mr-1" />{e._count?.attendees || 0} attending</span>
                      <span>{SKIN_LABELS[e.hitchSkin] || '🎉 Party Starter'}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Upcoming */}
            {upcomingEvents.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Upcoming</h2>
                <div className="space-y-2">
                  {upcomingEvents.map(e => (
                    <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between hover:border-orange-200 transition">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{e.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(e.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {e.campground?.name && ` · ${e.campground.name}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <LiveEventBadge startDate={e.startDate} endDate={e.endDate} />
                        <button
                          onClick={() => setMissionEventId(e.id)}
                          className="text-xs text-[#1B2B4B] font-semibold hover:underline"
                        >
                          Setup →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {pastEvents.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Past Events</h2>
                <div className="space-y-2">
                  {pastEvents.slice(0, 10).map(e => (
                    <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between opacity-75">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{e.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(e.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          · {e._count?.attendees || 0} attended
                        </p>
                      </div>
                      <button
                        onClick={() => setMissionEventId(e.id)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        View Memory →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {events.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🏕️</div>
                <p className="text-gray-500 text-sm mb-4">No events yet. Create your first one!</p>
                <Link
                  to="/events-v2/create"
                  className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition"
                >
                  <Plus className="w-4 h-4" /> Create Event
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Hitch Config Tab ── */}
        {tab === 'hitch' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-bold text-gray-900 text-sm mb-3">🦄 Default Hitch Personality</h3>
              <p className="text-xs text-gray-500 mb-3">Choose the default personality for new events. You can change this per-event in Mission Mode.</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(SKIN_LABELS).map(([key, label]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                    <p className="text-sm font-semibold">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-bold text-gray-900 text-sm mb-2">📝 Hitch FAQ Uploads</h3>
              <p className="text-xs text-gray-500">Upload FAQ documents per event so Hitch can answer attendee questions. Configure this in each event's Mission Mode.</p>
            </div>
          </div>
        )}

        {/* ── Analytics Tab ── */}
        {tab === 'analytics' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <h3 className="font-bold text-gray-900 text-sm mb-2">📊 Event Analytics</h3>
              <p className="text-xs text-gray-500 mb-4">Post-event Success Stories and connection metrics appear here after your events end.</p>
              {pastEvents.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-orange-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-orange-600">{pastEvents.length}</p>
                    <p className="text-[10px] text-gray-500">Events Hosted</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-green-600">
                      {pastEvents.reduce((sum, e) => sum + (e._count?.attendees || 0), 0)}
                    </p>
                    <p className="text-[10px] text-gray-500">Total Attendees</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-purple-600">
                      {pastEvents.filter(e => e.isTripMemory).length}
                    </p>
                    <p className="text-[10px] text-gray-500">Trip Memories</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No past events yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
