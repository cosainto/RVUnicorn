import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Calendar, Users, Radio, Plus, Settings, BarChart3, ChevronRight,
  Megaphone, Cloud, Sun, CloudRain, Snowflake, Wind, Send, MapPin,
  Tent, CheckCircle2, Upload, Clock, AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { computeEventLifecycle } from '../hooks/useEventLifecycle';
import LiveEventBadge from '../components/LiveEventBadge';
import MissionMode from '../components/organizer/MissionMode';
import { format, formatDistanceToNow } from 'date-fns';

const SKIN_LABELS: Record<string, string> = {
  TRAIL_GUIDE: '🏔️ Trail Guide',
  PARTY_STARTER: '🎉 Party Starter',
  OLD_TIMER: '🤠 Old Timer',
};

const BROADCAST_TYPES = [
  { key: 'GENERAL', label: 'General', icon: '📢' },
  { key: 'SCHEDULE_CHANGE', label: 'Schedule Change', icon: '🔄' },
  { key: 'AMENITY', label: 'Amenity Alert', icon: '🔧' },
  { key: 'WEATHER', label: 'Weather', icon: '🌩️' },
  { key: 'WELCOME', label: 'Welcome', icon: '👋' },
  { key: 'ACTIVITY', label: 'Activity', icon: '🎉' },
  { key: 'URGENT', label: 'Urgent', icon: '🚨' },
];

const QUICK_TEMPLATES = [
  { icon: '🎉', text: 'Welcome to {campground}! WiFi: [network] Pass: [password]. Need anything? Reply here.' },
  { icon: '🍺', text: 'Happy hour at the pavilion — come say hi! 🍻' },
  { icon: '🌩️', text: 'Heads up: weather moving in. Secure awnings and loose items.' },
  { icon: '📋', text: 'Reminder: quiet hours begin at 10pm. Thanks for being great neighbors!' },
  { icon: '♻️', text: 'Recycling reminder: bins are by the entrance. Thank you!' },
];

const PERSONALITY_OPTIONS = [
  { key: 'TRAIL_GUIDE', emoji: '🥾', name: 'Trail Guide', desc: 'Knowledgeable, practical, knows every trail and amenity. Answers questions like a veteran park ranger.' },
  { key: 'PARTY_STARTER', emoji: '🎉', name: 'Party Starter', desc: 'Energetic and social. Encourages guests to meet each other and join activities.' },
  { key: 'OLD_TIMER', emoji: '🪵', name: 'Old Timer', desc: 'Warm, storytelling, unhurried. Makes guests feel like they\'ve found a second home.' },
];

// Weather icon picker
function WeatherIcon({ condition }: { condition: string }) {
  const c = (condition || '').toLowerCase();
  if (c.includes('rain') || c.includes('shower')) return <CloudRain className="w-5 h-5 text-blue-400" />;
  if (c.includes('snow') || c.includes('sleet')) return <Snowflake className="w-5 h-5 text-blue-200" />;
  if (c.includes('wind')) return <Wind className="w-5 h-5 text-gray-400" />;
  if (c.includes('cloud') || c.includes('overcast')) return <Cloud className="w-5 h-5 text-gray-400" />;
  return <Sun className="w-5 h-5 text-amber-400" />;
}

function SummitGate({ campgroundName }: { campgroundName?: string }) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-8 text-center">
      <div className="text-4xl mb-3">⛰️</div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">Summit Feature</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
        Broadcast messages to your guests, see repeat visitor rates, and let Hitch auto-answer questions — all included in Summit.
      </p>
      <Link to="/business/upgrade" className="inline-flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-600 transition">
        Upgrade to Summit →
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    SCHEDULED: 'bg-amber-100 text-amber-700',
    SENT: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function OrganizerDashboard() {
  const { user } = useAuth() as any;
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'events' | 'broadcast' | 'hitch' | 'analytics'>('events');
  const [missionEventId, setMissionEventId] = useState<string | null>(null);

  // Campground
  const [myCampground, setMyCampground] = useState<any>(null);
  const isSummit = myCampground?.tier === 'CLASS_A';

  // Today panel
  const [todayData, setTodayData] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);

  // Broadcast state
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastType, setBroadcastType] = useState('GENERAL');
  const [broadcastAudience, setBroadcastAudience] = useState('ALL_CHECKED_IN');
  const [broadcastScheduled, setBroadcastScheduled] = useState(false);
  const [broadcastScheduleTime, setBroadcastScheduleTime] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Hitch config
  const [hitchConfig, setHitchConfig] = useState<any>(null);
  const [hitchSaving, setHitchSaving] = useState(false);
  const [faqUploading, setFaqUploading] = useState(false);
  const [faqPreview, setFaqPreview] = useState('');
  const faqInputRef = useRef<HTMLInputElement>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);

  // ── Load data ──────────────────────────────────────────────────
  useEffect(() => {
    const loadAll = async () => {
      try {
        const { data: bizData } = await api.get('/business/my');
        const cg = (bizData || [])[0];
        if (cg) {
          setMyCampground(cg);

          // Parallel fetches
          const [todayRes, weatherRes, evtRes] = await Promise.allSettled([
            api.get(`/organizer/${cg.id}/today`),
            cg.latitude && cg.longitude ? api.get(`/weather/forecast?lat=${cg.latitude}&lon=${cg.longitude}`) : Promise.resolve(null),
            api.get('/events-v2?limit=50'),
          ]);

          if (todayRes.status === 'fulfilled') setTodayData(todayRes.value?.data);
          if (weatherRes.status === 'fulfilled' && weatherRes.value) setWeather(weatherRes.value.data);
          if (evtRes.status === 'fulfilled') {
            const mine = (evtRes.value?.data?.events || []).filter((e: any) => e.organizerId === user?.id);
            setEvents(mine);
          }
        }
      } catch {}
      setLoading(false);
    };
    loadAll();
  }, [user?.id]);

  // Auto-refresh today panel every 5 minutes
  useEffect(() => {
    if (!myCampground?.id) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/organizer/${myCampground.id}/today`);
        setTodayData(data);
      } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [myCampground?.id]);

  // Load broadcasts when tab opens
  useEffect(() => {
    if (tab === 'broadcast' && myCampground?.id) {
      api.get(`/organizer/${myCampground.id}/broadcasts`).then(({ data }) => setBroadcasts(data.broadcasts || [])).catch(() => {});
    }
  }, [tab, myCampground?.id]);

  // Load hitch config when tab opens
  useEffect(() => {
    if (tab === 'hitch' && myCampground?.id) {
      api.get(`/organizer/${myCampground.id}/hitch-config`).then(({ data }) => setHitchConfig(data.config)).catch(() => {});
    }
  }, [tab, myCampground?.id]);

  // Load analytics when tab opens
  useEffect(() => {
    if (tab === 'analytics' && myCampground?.id) {
      api.get(`/organizer/${myCampground.id}/analytics`).then(({ data }) => setAnalytics(data)).catch(() => {});
    }
  }, [tab, myCampground?.id]);

  // ── Broadcast handlers ─────────────────────────────────────
  const sendBroadcast = useCallback(async () => {
    if (!broadcastMsg.trim() || !myCampground?.id) return;
    setBroadcastSending(true);
    try {
      const payload: any = {
        message: broadcastMsg.trim(),
        type: broadcastType,
        audience: broadcastAudience,
      };
      if (broadcastScheduled && broadcastScheduleTime) {
        payload.scheduledFor = new Date(broadcastScheduleTime).toISOString();
      }
      await api.post(`/organizer/${myCampground.id}/broadcasts`, payload);
      setBroadcastMsg('');
      setBroadcastScheduled(false);
      // Reload broadcasts
      const { data } = await api.get(`/organizer/${myCampground.id}/broadcasts`);
      setBroadcasts(data.broadcasts || []);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setBroadcastSending(false);
    }
  }, [broadcastMsg, broadcastType, broadcastAudience, broadcastScheduled, broadcastScheduleTime, myCampground?.id]);

  // ── Hitch config handlers ──────────────────────────────────
  const saveHitchConfig = useCallback(async () => {
    if (!myCampground?.id || !hitchConfig) return;
    setHitchSaving(true);
    try {
      const { data } = await api.put(`/organizer/${myCampground.id}/hitch-config`, {
        personality: hitchConfig.personality,
        welcomeMessage: hitchConfig.welcomeMessage,
        autoRespond: hitchConfig.autoRespond,
        quietHoursStart: hitchConfig.quietHoursStart,
        quietHoursEnd: hitchConfig.quietHoursEnd,
      });
      setHitchConfig(data.config);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save config');
    } finally {
      setHitchSaving(false);
    }
  }, [hitchConfig, myCampground?.id]);

  const uploadFaq = useCallback(async (file: File) => {
    if (!myCampground?.id) return;
    setFaqUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/organizer/${myCampground.id}/hitch-config/upload-faq`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFaqPreview(data.preview);
      setHitchConfig((prev: any) => prev ? { ...prev, faqIndexedAt: data.faqIndexedAt, faqContent: data.preview } : prev);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to upload FAQ');
    } finally {
      setFaqUploading(false);
    }
  }, [myCampground?.id]);

  if (missionEventId) {
    return (
      <div>
        <button onClick={() => setMissionEventId(null)}
          className="fixed top-3 left-3 z-50 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/10 transition">
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
                <p className="text-lg font-bold text-gray-900">{todayData?.checkedInNow ?? '—'}</p>
                <p className="text-[10px] text-gray-500">Checked In</p>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <p className="text-lg font-bold text-gray-900">{todayData?.arrivingToday ?? '—'}</p>
                <p className="text-[10px] text-gray-500">Arriving Today</p>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Radio className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <p className="text-lg font-bold text-gray-900">{todayData?.campfireActivity?.messageCount24h ?? '—'}</p>
                <p className="text-[10px] text-gray-500">Campfire Msgs</p>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {todayData?.liveEvent ? '1' : '0'}
                </p>
                <p className="text-[10px] text-gray-500 truncate">
                  {todayData?.liveEvent ? todayData.liveEvent.title : 'No event'}
                </p>
              </div>
            </div>

            {/* Arriving today names */}
            {todayData?.arrivingTodayList?.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-50 bg-blue-50/50">
                <p className="text-[10px] text-blue-700 font-semibold mb-1">Arriving today</p>
                <p className="text-xs text-blue-800">
                  {todayData.arrivingTodayList.map((g: any) => g.displayName).join(', ')}
                </p>
              </div>
            )}

            {/* Hitch suggestion */}
            {todayData?.hitchSuggestion && (
              <div className="px-4 py-3 border-t border-gray-50" style={{ borderLeftWidth: 4, borderLeftColor: '#E8A838' }}>
                <p className="text-xs text-gray-700">
                  <span className="font-semibold text-amber-700">🎯 Hitch suggests:</span>{' '}
                  {todayData.hitchSuggestion}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-3xl mx-auto px-4 mt-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {([
            { key: 'events', label: '📋 Events' },
            { key: 'broadcast', label: '📢 Broadcast' },
            { key: 'hitch', label: '🧠 Hitch Config' },
            { key: 'analytics', label: '📊 Analytics' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition ${
                tab === t.key ? 'bg-white shadow text-[#1B2B4B]' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">

        {/* ── Events Tab ── */}
        {tab === 'events' && (
          <div className="space-y-4">
            {liveEvents.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Live Now
                </h2>
                {liveEvents.map(e => (
                  <button key={e.id} onClick={() => setMissionEventId(e.id)}
                    className="w-full bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border-2 border-red-300 p-4 text-left hover:shadow-lg transition mb-2">
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
                        <button onClick={() => setMissionEventId(e.id)} className="text-xs text-[#1B2B4B] font-semibold hover:underline">
                          Setup →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                      <button onClick={() => setMissionEventId(e.id)} className="text-xs text-gray-500 hover:text-gray-700">
                        View Memory →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {events.length === 0 && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6 text-center">
                <div className="text-4xl mb-3">🏕️</div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">Ready to Host?</h3>
                <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
                  Create your first event — a potluck, a group ride, a stargazing night, or a full rally.
                </p>
                <Link to="/events-v2/create"
                  className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-orange-600 transition shadow-sm">
                  <Plus className="w-4 h-4" /> Create Your First Event
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Broadcast Tab ── */}
        {tab === 'broadcast' && (
          !isSummit ? <SummitGate campgroundName={myCampground?.name} /> : (
            <div className="space-y-6">
              {/* Send a Broadcast */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 text-sm mb-4">Send a Broadcast</h3>

                <textarea
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value.slice(0, 160))}
                  placeholder="Your message to campers..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
                  rows={2}
                />
                <div className="flex items-center justify-between mt-1 mb-3">
                  <span className={`text-[10px] ${broadcastMsg.length > 140 ? 'text-red-500' : 'text-gray-400'}`}>
                    {broadcastMsg.length}/160
                  </span>
                  <button onClick={() => setTemplatesOpen(!templatesOpen)} className="text-[10px] text-amber-600 font-semibold hover:underline">
                    {templatesOpen ? 'Hide templates' : 'Quick templates ↓'}
                  </button>
                </div>

                {/* Templates */}
                {templatesOpen && (
                  <div className="space-y-1.5 mb-4">
                    {QUICK_TEMPLATES.map((t, i) => (
                      <button key={i}
                        onClick={() => { setBroadcastMsg(t.text.replace('{campground}', myCampground?.name || 'our campground')); setTemplatesOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-amber-50 text-xs text-gray-700 transition border border-gray-100">
                        {t.icon} {t.text.slice(0, 80)}...
                      </button>
                    ))}
                  </div>
                )}

                {/* Type pills */}
                <div className="mb-3">
                  <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {BROADCAST_TYPES.map((t) => (
                      <button key={t.key} onClick={() => setBroadcastType(t.key)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition border ${
                          broadcastType === t.key
                            ? t.key === 'URGENT' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-amber-100 text-amber-700 border-amber-300'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audience */}
                <div className="mb-3">
                  <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Audience</label>
                  <div className="space-y-1.5">
                    {[
                      { key: 'ALL_CHECKED_IN', label: `All checked-in guests (${todayData?.checkedInNow || 0})` },
                      { key: 'ARRIVING_TODAY', label: `Arriving today (${todayData?.arrivingToday || 0})` },
                      ...(todayData?.liveEvent ? [{ key: 'EVENT_ATTENDEES', label: `${todayData.liveEvent.title} attendees (${todayData.liveEvent.attendeeCount})` }] : []),
                    ].map((a) => (
                      <label key={a.key} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="audience" checked={broadcastAudience === a.key}
                          onChange={() => setBroadcastAudience(a.key)}
                          className="text-amber-500 focus:ring-amber-400" />
                        <span className="text-xs text-gray-700">{a.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Schedule toggle */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={broadcastScheduled} onChange={(e) => setBroadcastScheduled(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-400" />
                    <span className="text-xs text-gray-700">Schedule for later</span>
                  </label>
                  {broadcastScheduled && (
                    <input type="datetime-local" value={broadcastScheduleTime}
                      onChange={(e) => setBroadcastScheduleTime(e.target.value)}
                      className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  )}
                </div>

                <button onClick={sendBroadcast}
                  disabled={!broadcastMsg.trim() || broadcastSending || (broadcastScheduled && !broadcastScheduleTime)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
                  style={{ background: broadcastType === 'URGENT' ? '#dc2626' : '#E8622A' }}>
                  <Send className="w-4 h-4" />
                  {broadcastSending ? 'Sending...' : broadcastScheduled ? 'Schedule Broadcast' : `Send to ${
                    broadcastAudience === 'ALL_CHECKED_IN' ? (todayData?.checkedInNow || 0) :
                    broadcastAudience === 'ARRIVING_TODAY' ? (todayData?.arrivingToday || 0) :
                    (todayData?.liveEvent?.attendeeCount || 0)
                  } guests →`}
                </button>
              </div>

              {/* Broadcast History */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 text-sm mb-4">Broadcast History</h3>
                {broadcasts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No broadcasts yet. Your guests are waiting to hear from you.</p>
                ) : (
                  <div className="space-y-2">
                    {broadcasts.map((b: any) => {
                      const typeInfo = BROADCAST_TYPES.find((t) => t.key === b.type);
                      return (
                        <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                          <span className="text-lg">{typeInfo?.icon || '📢'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 line-clamp-1">{b.message}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400">{b.audience?.replace(/_/g, ' ')}</span>
                              <span className="text-[10px] text-gray-400">·</span>
                              <span className="text-[10px] text-gray-400">
                                {b.sentAt ? formatDistanceToNow(new Date(b.sentAt), { addSuffix: true }) :
                                 b.scheduledFor ? `Scheduled: ${format(new Date(b.scheduledFor), 'MMM d, h:mm a')}` : 'Draft'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {b.recipientCount != null && <span className="text-[10px] text-gray-400">{b.recipientCount} sent</span>}
                            <StatusBadge status={b.status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ── Hitch Config Tab ── */}
        {tab === 'hitch' && (
          <div className="space-y-4">
            {/* Personality Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 text-sm mb-4">🎭 Hitch Personality</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {PERSONALITY_OPTIONS.map((p) => (
                  <button key={p.key}
                    onClick={() => setHitchConfig((prev: any) => prev ? { ...prev, personality: p.key } : prev)}
                    className={`text-left p-3 rounded-xl border-2 transition ${
                      hitchConfig?.personality === p.key ? 'border-amber-400 bg-amber-50' : 'border-gray-100 hover:border-gray-200'
                    }`}>
                    <div className="text-2xl mb-1">{p.emoji}</div>
                    <p className="text-sm font-bold text-gray-900">{p.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{p.desc}</p>
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Welcome Message</label>
                <textarea
                  value={hitchConfig?.welcomeMessage || ''}
                  onChange={(e) => setHitchConfig((prev: any) => prev ? { ...prev, welcomeMessage: e.target.value } : prev)}
                  placeholder={`Hey there, welcome to ${myCampground?.name || 'our campground'}! I'm Hitch, your campground guide. Ask me anything...`}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={hitchConfig?.autoRespond !== false}
                    onChange={(e) => setHitchConfig((prev: any) => prev ? { ...prev, autoRespond: e.target.checked } : prev)}
                    className="rounded text-amber-500 focus:ring-amber-400" />
                  <span className="text-xs text-gray-700">Hitch auto-responds to common questions</span>
                </label>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-600">Quiet from</span>
                  <select value={hitchConfig?.quietHoursStart ?? ''}
                    onChange={(e) => setHitchConfig((prev: any) => prev ? { ...prev, quietHoursStart: e.target.value ? parseInt(e.target.value) : null } : prev)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="">Off</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-600">to</span>
                  <select value={hitchConfig?.quietHoursEnd ?? ''}
                    onChange={(e) => setHitchConfig((prev: any) => prev ? { ...prev, quietHoursEnd: e.target.value ? parseInt(e.target.value) : null } : prev)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="">Off</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={saveHitchConfig} disabled={hitchSaving}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
                style={{ background: '#E8622A' }}>
                {hitchSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>

            {/* FAQ Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 text-sm mb-3">📄 FAQ Document</h3>

              {hitchConfig?.faqIndexedAt ? (
                <div className="flex items-center gap-2 mb-3 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-700">
                    FAQ loaded — indexed on {format(new Date(hitchConfig.faqIndexedAt), 'MMM d, yyyy')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-3 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-amber-700">No FAQ uploaded. Hitch will use campground profile data only.</span>
                </div>
              )}

              {faqPreview && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">Preview</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{faqPreview.slice(0, 200)}...</p>
                </div>
              )}

              <input ref={faqInputRef} type="file" accept=".pdf,.txt,.md" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) uploadFaq(e.target.files[0]); }} />

              <button onClick={() => faqInputRef.current?.click()} disabled={faqUploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-amber-300 text-xs text-gray-600 hover:text-amber-700 transition w-full justify-center disabled:opacity-50">
                <Upload className="w-4 h-4" />
                {faqUploading ? 'Processing...' : 'Upload FAQ (.pdf, .txt, .md — max 5MB)'}
              </button>
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Upload your campground FAQ, rules, or welcome packet. Hitch will read it and answer questions about it.
              </p>
            </div>
          </div>
        )}

        {/* ── Analytics Tab ── */}
        {tab === 'analytics' && (
          !isSummit ? <SummitGate campgroundName={myCampground?.name} /> : (
            <div className="space-y-4">
              {/* Lifetime Stats */}
              {analytics?.allTime && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600">{analytics.allTime.totalEvents}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Total Events</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{analytics.allTime.totalAttendees}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Guests Hosted</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{analytics.allTime.repeatVisitorRate}%</p>
                    <p className="text-[10px] text-gray-500 mt-1">Repeat Visitors</p>
                    <p className="text-[10px] text-gray-400">came back 2+ times</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{analytics.allTime.totalBroadcastsSent}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Broadcasts Sent</p>
                  </div>
                </div>
              )}

              {/* Event Performance */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 text-sm mb-3">Your Events Performance</h3>
                {analytics?.recentEvents?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="pb-2 font-semibold">Event</th>
                          <th className="pb-2 font-semibold text-center">Date</th>
                          <th className="pb-2 font-semibold text-center">Attendees</th>
                          <th className="pb-2 font-semibold text-center">Returns</th>
                          <th className="pb-2 font-semibold text-center">Campfire</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.recentEvents.map((e: any) => (
                          <tr key={e.id} className="border-b border-gray-50">
                            <td className="py-2 font-medium text-gray-900 max-w-[160px] truncate">{e.title}</td>
                            <td className="py-2 text-center text-gray-500">{format(new Date(e.date), 'MMM d')}</td>
                            <td className="py-2 text-center text-gray-700 font-semibold">{e.attendeeCount}</td>
                            <td className="py-2 text-center">
                              <span className={`font-semibold ${e.returnedSince > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {e.returnedSince}
                              </span>
                            </td>
                            <td className="py-2 text-center text-gray-500">{e.campfireMessages} msgs</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Host your first event to start seeing data here.</p>
                )}
              </div>

              {/* Top Broadcasts */}
              {analytics?.topBroadcasts?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 text-sm mb-3">Top Broadcasts</h3>
                  <div className="space-y-2">
                    {analytics.topBroadcasts.map((b: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                        <span className="text-lg">{BROADCAST_TYPES.find((t) => t.key === b.type)?.icon || '📢'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 line-clamp-1">{b.message}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {b.sentAt ? formatDistanceToNow(new Date(b.sentAt), { addSuffix: true }) : ''} · {b.recipientCount} recipients
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
