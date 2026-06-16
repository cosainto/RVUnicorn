import { useState, useEffect } from 'react';
import { MapPin, Route, Trophy, BarChart3, ChevronDown, ChevronRight, Camera, Film, Moon, Star, Play, Plus, Check, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const ROAD_BADGES: Record<string, { emoji: string; label: string; color: string }> = {
  HIGHWAY: { emoji: '🛣️', label: 'Highway', color: 'bg-blue-500/20 text-blue-400' },
  SCENIC: { emoji: '🏔️', label: 'Scenic', color: 'bg-green-500/20 text-green-400' },
  OFFGRID: { emoji: '🌲', label: 'Off-grid', color: 'bg-amber-500/20 text-amber-400' },
  MIXED: { emoji: '🚐', label: 'Mixed', color: 'bg-gray-500/20 text-gray-400' },
};

const MILESTONE_EMOJI: Record<string, string> = {
  MILES_100: '🚐', MILES_500: '🚐', MILES_1000: '🚐', NEW_STATE: '🗺️', NEW_PARK: '🌲',
  CAMPGROUND_10: '🏕️', LONGEST_DRIVE: '⛽', FAVORITE_RETURN: '⭐', CUSTOM: '🎉',
};

interface Props { slug: string; isOwner: boolean; rigName: string; }

export default function RigTripMode({ slug, isOwner, rigName }: Props) {
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  const [showStartTrip, setShowStartTrip] = useState(false);
  const [showAddStop, setShowAddStop] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newStopName, setNewStopName] = useState('');
  const [newStopCity, setNewStopCity] = useState('');
  const [newStopState, setNewStopState] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showOlderTrips, setShowOlderTrips] = useState(false);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [showStartJourney, setShowStartJourney] = useState(false);
  const [journeyName, setJourneyName] = useState('');
  const [journeySegments, setJourneySegments] = useState<{ name: string; from: string; to: string; startDate: string; endDate: string }[]>([{ name: '', from: '', to: '', startDate: '', endDate: '' }]);
  const [expandedJourney, setExpandedJourney] = useState<string | null>(null);

  useEffect(() => { load(); }, [slug]);

  const load = async () => {
    try {
      const [active, trips, journeyData] = await Promise.all([
        api.get(`/rigs/${slug}/trips/active`).then(r => r.data).catch(() => null),
        api.get(`/rigs/${slug}/trips`).then(r => r.data).catch(() => []),
        api.get(`/rigs/${slug}/journeys`).then(r => r.data).catch(() => []),
      ]);
      setTrip(active);
      setAllTrips(trips);
      setJourneys(journeyData);
      if (active?.stops?.length > 0) {
        const current = active.stops.find((s: any) => s.isCurrentStop);
        if (current) setExpandedStop(current.id);
      }
    } catch {}
    setLoading(false);
  };

  const startTrip = async () => {
    if (!newTripName.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/rigs/${slug}/trips`, { name: newTripName });
      setShowStartTrip(false);
      setNewTripName('');
      load();
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed'); }
    setSubmitting(false);
  };

  const addStop = async () => {
    if (!newStopName.trim() || !trip) return;
    setSubmitting(true);
    try {
      await api.post(`/rigs/${slug}/trips/${trip.id}/stops`, { name: newStopName, city: newStopCity, state: newStopState });
      setShowAddStop(false);
      setNewStopName(''); setNewStopCity(''); setNewStopState('');
      load();
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed'); }
    setSubmitting(false);
  };

  const checkoutStop = async (stopId: string) => {
    try {
      const { data } = await api.post(`/rigs/${slug}/trips/${trip.id}/stops/${stopId}/checkout`);
      if (data.newMilestones?.length > 0) {
        alert(`🎉 Milestone${data.newMilestones.length > 1 ? 's' : ''}: ${data.newMilestones.join(', ')}`);
      }
      load();
    } catch {}
  };

  const endTrip = async () => {
    if (!trip || !confirm(`End "${trip.name}"?`)) return;
    try {
      await api.post(`/rigs/${slug}/trips/${trip.id}/complete`);
      load();
    } catch {}
  };

  const createJourney = async () => {
    if (!journeyName.trim() || journeySegments.some(s => !s.name.trim())) return;
    setSubmitting(true);
    try {
      const { data: journey } = await api.post(`/rigs/${slug}/journeys`, { name: journeyName });
      for (const seg of journeySegments) {
        await api.post(`/rigs/${slug}/journeys/${journey.id}/segments`, seg);
      }
      setShowStartJourney(false);
      setJourneyName('');
      setJourneySegments([{ name: '', from: '', to: '', startDate: '', endDate: '' }]);
      load();
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed to create journey'); }
    setSubmitting(false);
  };

  const addSegmentRow = () => {
    setJourneySegments([...journeySegments, { name: '', from: '', to: '', startDate: '', endDate: '' }]);
  };

  const removeSegmentRow = (index: number) => {
    setJourneySegments(journeySegments.filter((_, i) => i !== index));
  };

  const updateSegment = (index: number, field: string, value: string) => {
    setJourneySegments(journeySegments.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;

  // ═══ NO ACTIVE TRIP STATE ═══
  if (!trip) {
    const completedTrips = allTrips.filter(t => t.status === 'COMPLETED');
    return (
      <div className="space-y-4">
        {isOwner && (
          <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.2)' }}>
            <span className="text-4xl block mb-2">🗺️</span>
            <h3 className="font-bold text-white text-lg">Start a Trip</h3>
            <p className="text-xs text-white/40 mt-1 mb-4">Document your journey with stops, routes, and milestones</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowStartTrip(true)} className="px-5 py-2 bg-amber-500 text-gray-900 font-semibold rounded-xl text-sm hover:bg-amber-400 transition">Start a Simple Trip</button>
              <button onClick={() => setShowStartJourney(true)} className="px-5 py-2 bg-gray-700 text-amber-400 font-semibold rounded-xl text-sm hover:bg-gray-600 border border-amber-500/30 transition">Start a Journey</button>
            </div>
          </div>
        )}
        {!isOwner && completedTrips.length === 0 && (
          <div className="text-center py-12"><MapPin className="w-10 h-10 mx-auto text-white/15 mb-3" /><p className="text-sm text-white/40">No trips yet</p></div>
        )}
        {completedTrips.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Past Trips</h3>
            {completedTrips.map(t => (
              <div key={t.id} className="rounded-xl p-4 mb-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {t.coverImageUrl && <img src={t.coverImageUrl} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />}
                <h4 className="font-bold text-sm text-white">{t.name}</h4>
                <div className="flex gap-3 mt-1 text-[10px] text-white/40">
                  <span>🛣️ {Math.round(t.totalMiles)} mi</span>
                  <span>🌙 {t.totalNights} nights</span>
                  <span>🗺️ {t.statesVisited?.length || 0} states</span>
                  <span>📍 {t._count?.stops || 0} stops</span>
                </div>
                {t.startDate && <p className="text-[10px] text-white/25 mt-1">{new Date(t.startDate).toLocaleDateString()} — {t.endDate ? new Date(t.endDate).toLocaleDateString() : 'ongoing'}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Journeys Section */}
        {journeys.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Journeys</h3>
            {journeys.map((j: any) => {
              const isExpanded = expandedJourney === j.id;
              const segments = j.segments || [];
              const statusColor = j.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : j.status === 'COMPLETED' ? 'bg-white/10 text-white/50' : 'bg-amber-500/20 text-amber-400';
              return (
                <div key={j.id} className="rounded-xl mb-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => setExpandedJourney(isExpanded ? null : j.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition">
                    <span className="text-lg">🗺️</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-amber-400 truncate">{j.name}</h4>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusColor}`}>{j.status || 'PLANNED'}</span>
                      </div>
                      <p className="text-[10px] text-white/40 mt-0.5">{segments.length} segment{segments.length !== 1 ? 's' : ''}</p>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-white/20" /> : <ChevronRight className="w-4 h-4 text-white/20" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-white/5 pt-3">
                      <div className="space-y-1">
                        {segments.map((seg: any, si: number) => {
                          const isLast = si === segments.length - 1;
                          const branch = isLast ? '└── ' : '├── ';
                          const startStr = seg.startDate ? new Date(seg.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                          const endStr = seg.endDate ? new Date(seg.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                          const dateRange = startStr && endStr ? ` (${startStr}-${endStr})` : startStr ? ` (${startStr})` : '';
                          return (
                            <div key={seg.id || si} className="flex items-start gap-1">
                              <span className="text-white/25 text-xs font-mono flex-shrink-0 leading-5">{branch}</span>
                              <div className="text-xs text-gray-300 leading-5">
                                <span className="font-semibold text-white/70">Segment {si + 1}:</span>{' '}
                                {seg.name || `${seg.from || '?'} → ${seg.to || '?'}`}
                                {seg.from && seg.to && seg.name && <span className="text-white/30"> · {seg.from} → {seg.to}</span>}
                                {dateRange && <span className="text-white/30">{dateRange}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {(j.totalMiles || j.totalNights || j.statesVisited?.length) && (
                        <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-white/40 flex gap-3">
                          {j.totalMiles > 0 && <span>🛣️ {Math.round(j.totalMiles).toLocaleString()} miles</span>}
                          {j.totalNights > 0 && <span>🌙 {j.totalNights} nights</span>}
                          {j.statesVisited?.length > 0 && <span>🗺️ {j.statesVisited.length} states</span>}
                        </div>
                      )}
                      {isOwner && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => { /* edit journey placeholder */ }} className="text-[10px] text-amber-400/60 hover:text-amber-400 transition">Edit Journey</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Start Trip Modal */}
        {showStartTrip && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowStartTrip(false)}>
            <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-gray-900 text-lg mb-4">Start a Trip</h3>
              <input value={newTripName} onChange={e => setNewTripName(e.target.value)} placeholder="Trip name (e.g. Summer 2026 Pacific Northwest)" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 mb-4" />
              <div className="flex gap-2">
                <button onClick={startTrip} disabled={!newTripName.trim() || submitting} className="flex-1 py-2.5 bg-primary-600 text-white font-semibold rounded-xl disabled:opacity-50">{submitting ? 'Starting...' : 'Start Journey'}</button>
                <button onClick={() => setShowStartTrip(false)} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Start Journey Modal */}
        {showStartJourney && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowStartJourney(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-lg">Start a Journey</h3>
                <button onClick={() => setShowStartJourney(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <input value={journeyName} onChange={e => setJourneyName(e.target.value)} placeholder="Journey name (e.g. Summer Southwest Tour 2026)" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 mb-4" />

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Segments</p>
              <div className="space-y-3">
                {journeySegments.map((seg, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-3 relative">
                    {journeySegments.length > 1 && (
                      <button onClick={() => removeSegmentRow(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-400"><X className="w-4 h-4" /></button>
                    )}
                    <p className="text-[10px] text-gray-400 font-semibold mb-1.5">Segment {i + 1}</p>
                    <input value={seg.name} onChange={e => updateSegment(i, 'name', e.target.value)} placeholder="Segment name" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2" />
                    <div className="flex gap-2 mb-2">
                      <input value={seg.from} onChange={e => updateSegment(i, 'from', e.target.value)} placeholder="From" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2" />
                      <span className="text-gray-300 self-center">→</span>
                      <input value={seg.to} onChange={e => updateSegment(i, 'to', e.target.value)} placeholder="To" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2" />
                    </div>
                    <div className="flex gap-2">
                      <input type="date" value={seg.startDate} onChange={e => updateSegment(i, 'startDate', e.target.value)} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600" />
                      <input type="date" value={seg.endDate} onChange={e => updateSegment(i, 'endDate', e.target.value)} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600" />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addSegmentRow} className="w-full mt-2 py-2 border border-dashed border-gray-300 text-gray-500 text-xs font-semibold rounded-xl hover:border-gray-400 hover:text-gray-600 transition flex items-center justify-center gap-1">
                <Plus className="w-3.5 h-3.5" />Add Segment
              </button>

              <div className="flex gap-2 mt-4">
                <button onClick={createJourney} disabled={!journeyName.trim() || journeySegments.some(s => !s.name.trim()) || submitting} className="flex-1 py-2.5 bg-amber-500 text-gray-900 font-semibold rounded-xl disabled:opacity-50 hover:bg-amber-400 transition">{submitting ? 'Creating...' : 'Create Journey'}</button>
                <button onClick={() => setShowStartJourney(false)} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══ ACTIVE TRIP ═══
  const stops = trip.stops || [];
  const routes = trip.routes || [];
  const milestones = trip.milestones || [];
  const currentStop = stops.find((s: any) => s.isCurrentStop);
  const daysOnTrip = trip.startDate ? Math.max(1, Math.ceil((Date.now() - new Date(trip.startDate).getTime()) / 86400000)) : 0;

  // Build feed: interleave stops, routes, milestones chronologically
  const feedItems: any[] = [];
  for (const s of stops) feedItems.push({ type: 'STOP', data: s, ts: new Date(s.arrivedAt).getTime() });
  for (const r of routes) feedItems.push({ type: 'ROUTE', data: r, ts: new Date(r.drivenAt).getTime() });
  for (const m of milestones) feedItems.push({ type: 'MILESTONE', data: m, ts: new Date(m.occurredAt).getTime() });
  feedItems.sort((a, b) => b.ts - a.ts);

  return (
    <div className="space-y-3">
      {/* Active Trip Banner */}
      <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(232,168,56,0.15), rgba(76,175,130,0.1))', border: '1px solid rgba(232,168,56,0.25)' }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-white">{trip.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
              <span className="text-xs text-green-400 font-medium">Active · {daysOnTrip} day{daysOnTrip !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {isOwner && (
            <button onClick={endTrip} className="text-[10px] text-white/30 hover:text-red-400 transition">End Trip</button>
          )}
        </div>
        {currentStop && <p className="text-xs text-amber-300/70">📍 Currently at {currentStop.name}{currentStop.city ? `, ${currentStop.city}` : ''}{currentStop.state ? `, ${currentStop.state}` : ''}</p>}
        {/* Stats */}
        <div className="flex gap-4 mt-3 text-[10px] text-white/50 font-semibold">
          <span>🛣️ {Math.round(trip.totalMiles)} mi</span>
          <span>🗺️ {trip.statesVisited?.length || 0} states</span>
          <span>🌙 {trip.totalNights} nights</span>
          <span>📍 {stops.length} stops</span>
        </div>
      </div>

      {/* Journey Strip */}
      {stops.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {stops.map((s: any, i: number) => (
            <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setExpandedStop(expandedStop === s.id ? null : s.id)}
                className={`px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition ${
                  s.isCurrentStop ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : expandedStop === s.id ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-white/5 text-white/40 border border-white/10'
                }`}>
                {s.isCurrentStop && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1" />}
                {s.state || s.name.split(' ').slice(0, 2).join(' ')}
              </button>
              {i < stops.length - 1 && <span className="text-white/15 text-[8px]">→</span>}
            </div>
          ))}
        </div>
      )}

      {/* Add Stop Button */}
      {isOwner && (
        <button onClick={() => setShowAddStop(true)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition">
          <Plus className="w-3.5 h-3.5" />Add Stop
        </button>
      )}

      {/* Feed */}
      {feedItems.map((item, i) => {
        if (item.type === 'STOP') {
          const s = item.data;
          const isExpanded = expandedStop === s.id;
          return (
            <div key={s.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => setExpandedStop(isExpanded ? null : s.id)} className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${s.isCurrentStop ? 'bg-green-500/20 border-2 border-green-500/30' : 'bg-amber-500/15 border-2 border-amber-500/20'}`}>
                  <MapPin className="w-4 h-4" style={{ color: s.isCurrentStop ? '#4CAF82' : '#E8A838' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-white">{s.name}</h4>
                  <p className="text-[10px] text-white/40">{s.city && `${s.city}, `}{s.state} · {new Date(s.arrivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{s.departedAt ? ` — ${new Date(s.departedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</p>
                  <div className="flex gap-2 mt-1 text-[10px] text-white/30">
                    {s.milesFromPreviousStop && <span>🛣️ {Math.round(s.milesFromPreviousStop)} mi</span>}
                    {s.nightsStayed > 0 && <span>🌙 {s.nightsStayed} night{s.nightsStayed > 1 ? 's' : ''}</span>}
                    {s.photoCount > 0 && <span><Camera className="w-3 h-3 inline" /> {s.photoCount}</span>}
                    {s.memberCount > 0 && <span>👥 {s.memberCount}</span>}
                  </div>
                </div>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-white/20 mt-1" /> : <ChevronRight className="w-4 h-4 text-white/20 mt-1" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
                  {s.coverImageUrl && <img src={s.coverImageUrl} alt="" className="w-full h-40 object-cover rounded-xl" />}
                  {s.summary && <p className="text-xs text-white/50 italic">{s.summary}</p>}
                  {isOwner && s.isCurrentStop && (
                    <button onClick={() => checkoutStop(s.id)} className="w-full py-2 bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-500/30 transition">Check Out of {s.name}</button>
                  )}
                </div>
              )}
            </div>
          );
        }
        if (item.type === 'ROUTE') {
          const r = item.data;
          const road = ROAD_BADGES[r.roadType] || ROAD_BADGES.MIXED;
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.06)' }}>
              <Route className="w-4 h-4 text-white/15 flex-shrink-0" />
              <div className="flex-1 text-[10px] text-white/40">
                <span className="font-semibold text-white/60">{Math.round(r.distanceMiles)} mi</span>
                {r.durationMinutes && <span> · {Math.floor(r.durationMinutes / 60)}h {r.durationMinutes % 60}m</span>}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${road.color}`}>{road.emoji} {road.label}</span>
              </div>
            </div>
          );
        }
        if (item.type === 'MILESTONE') {
          const m = item.data;
          return (
            <div key={m.id} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(232,168,56,0.1)', border: '1px solid rgba(232,168,56,0.2)' }}>
              <span className="text-xl">{MILESTONE_EMOJI[m.milestoneType] || '🎉'}</span>
              <div>
                <h4 className="text-sm font-bold text-amber-400">{m.title}</h4>
                {m.description && <p className="text-[10px] text-white/40">{m.description}</p>}
              </div>
            </div>
          );
        }
        return null;
      })}

      {feedItems.length === 0 && (
        <div className="text-center py-8">
          <MapPin className="w-8 h-8 mx-auto text-white/15 mb-2" />
          <p className="text-sm text-white/40">Add your first stop to start building your journey</p>
        </div>
      )}

      {/* Members */}
      {trip.members?.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-2">Trip Crew</p>
          <div className="flex gap-2">
            {trip.members.map((m: any) => (
              <Link key={m.id} to={`/profile/${m.user.username || m.user.id}`} className="flex items-center gap-1.5">
                {m.user.profilePicture ? <img src={m.user.profilePicture} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-[9px] font-bold text-amber-400">{m.user.firstName?.[0]}</div>}
                <span className="text-[10px] text-white/50">{m.user.firstName}</span>
                <span className="text-[8px] text-white/20">{m.role}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Add Stop Modal */}
      {showAddStop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddStop(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg mb-4">Add a Stop</h3>
            <div className="space-y-3">
              <input value={newStopName} onChange={e => setNewStopName(e.target.value)} placeholder="Stop name (e.g. Grand Teton NP)" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
              <div className="flex gap-2">
                <input value={newStopCity} onChange={e => setNewStopCity(e.target.value)} placeholder="City" className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
                <input value={newStopState} onChange={e => setNewStopState(e.target.value)} placeholder="State" className="w-20 text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={addStop} disabled={!newStopName.trim() || submitting} className="flex-1 py-2.5 bg-primary-600 text-white font-semibold rounded-xl disabled:opacity-50">{submitting ? 'Adding...' : 'Add Stop'}</button>
              <button onClick={() => setShowAddStop(false)} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
