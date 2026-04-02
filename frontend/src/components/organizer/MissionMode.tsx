import { useState, useEffect, useCallback } from 'react';
import { Users, Radio, MapPin, Zap, AlertTriangle, MessageSquare, Plus, Cloud, ChevronDown, CheckCircle, X, Send, Clock } from 'lucide-react';
import api from '../../services/api';
import { useEventLifecycle } from '../../hooks/useEventLifecycle';

interface Props {
  eventId: string;
}

const SKIN_PREVIEW: Record<string, { emoji: string; label: string; quote: string }> = {
  TRAIL_GUIDE: { emoji: '🏔️', label: 'Trail Guide', quote: '"Stay calm. Stay sharp. Stay hydrated."' },
  PARTY_STARTER: { emoji: '🎉', label: 'Party Starter', quote: '"WHO\'S READY FOR THE BEST NIGHT EVER?! 🔥"' },
  OLD_TIMER: { emoji: '🤠', label: 'Old Timer', quote: '"Back in \'84 we didn\'t need GPS. We had instinct. And a lot of wrong turns."' },
};

const MODE_DESC: Record<string, string> = {
  FULLY_GUIDED: 'Hitch runs the show autonomously. You approve Big Moments.',
  ASSISTED: 'Hitch surfaces suggestions. You tap [Send It] to approve.',
  MANUAL: 'You control everything. Hitch stays quiet unless you tell him to talk.',
};

export default function MissionMode({ eventId }: Props) {
  const [event, setEvent] = useState<any>(null);
  const [heatMap, setHeatMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [blastMsg, setBlastMsg] = useState('');
  const [showPlanB, setShowPlanB] = useState(false);
  const [planBLoc, setPlanBLoc] = useState('');
  const [planBDesc, setPlanBDesc] = useState('');
  const [popupTitle, setPopupTitle] = useState('');
  const [popupTime, setPopupTime] = useState('');

  const loadMission = useCallback(async () => {
    try {
      const { data } = await api.get(`/events-v2/${eventId}/mission`);
      setEvent(data.event);
      setHeatMap(data.heatMap);
    } catch {} finally { setLoading(false); }
  }, [eventId]);

  useEffect(() => {
    loadMission();
    const interval = setInterval(loadMission, 30000);
    return () => clearInterval(interval);
  }, [loadMission]);

  const lifecycle = useEventLifecycle(
    event?.startDate || new Date().toISOString(),
    event?.endDate || new Date().toISOString(),
    event?.eventStatus,
  );

  const updateConfig = async (field: string, value: any) => {
    try {
      await api.put(`/events-v2/${eventId}/autopilot`, { [field]: value });
      loadMission();
    } catch {}
  };

  const activatePlanB = async () => {
    try {
      await api.post(`/events-v2/${eventId}/plan-b`, { planBLocation: planBLoc, planBDescription: planBDesc });
      setShowPlanB(false);
      loadMission();
    } catch {}
  };

  const sendBlast = async () => {
    if (!blastMsg.trim()) return;
    try {
      await api.post(`/events-v2/${eventId}/blast`, { message: blastMsg.trim() });
      setBlastMsg('');
    } catch {}
  };

  const createPopup = async () => {
    if (!popupTitle.trim()) return;
    try {
      await api.post(`/events-v2/${eventId}/popups`, {
        title: popupTitle.trim(),
        scheduledTime: popupTime || null,
      });
      setPopupTitle('');
      setPopupTime('');
      loadMission();
    } catch {}
  };

  const approvePopup = async (popupId: string) => {
    try {
      await api.put(`/events-v2/${eventId}/popups/${popupId}`, { status: 'LIVE' });
      loadMission();
    } catch {}
  };

  const dismissPopup = async (popupId: string) => {
    try {
      await api.put(`/events-v2/${eventId}/popups/${popupId}`, { status: 'DISMISSED' });
      loadMission();
    } catch {}
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-2xl animate-pulse">🎯</div></div>;
  if (!event) return <div className="text-center text-gray-500 py-12">Event not found</div>;

  const isPreEvent = lifecycle === 'UPCOMING';
  const isLive = lifecycle === 'LIVE';
  const isPost = lifecycle === 'ENDED' || event.isTripMemory;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] border-b border-white/10 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Mission Mode</p>
            <h1 className="text-lg font-bold text-white">{event.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1.5 bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full border border-red-500/30">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
            {isPreEvent && (
              <span className="text-xs text-blue-400 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
                <Clock className="w-3 h-3 inline mr-1" />Pre-Event
              </span>
            )}
            {isPost && (
              <span className="text-xs text-gray-400 bg-gray-500/20 px-3 py-1 rounded-full border border-gray-500/30">Post-Event</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ═══ PRE-EVENT PHASE ═══ */}
        {isPreEvent && (
          <>
            {/* Hitch Skin Selector */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
              <h2 className="text-sm font-bold text-amber-400 mb-3">🦄 Hitch Personality</h2>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(SKIN_PREVIEW).map(([key, { emoji, label, quote }]) => (
                  <button
                    key={key}
                    onClick={() => updateConfig('hitchSkin', key)}
                    className={`rounded-xl p-3 border text-left transition ${
                      event.hitchSkin === key
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                    }`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <p className="text-xs font-bold mt-1">{label}</p>
                    <p className="text-[10px] mt-1 italic opacity-70">{quote}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Autopilot Mode */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
              <h2 className="text-sm font-bold text-amber-400 mb-3">⚡ Autopilot Mode</h2>
              <div className="space-y-2">
                {['FULLY_GUIDED', 'ASSISTED', 'MANUAL'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => updateConfig('autopilotMode', mode)}
                    className={`w-full rounded-xl px-4 py-3 border text-left transition flex items-center justify-between ${
                      event.autopilotMode === mode
                        ? 'bg-purple-500/20 border-purple-500/50'
                        : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{mode.replace('_', ' ')}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{MODE_DESC[mode]}</p>
                    </div>
                    {event.autopilotMode === mode && <CheckCircle className="w-4 h-4 text-purple-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Attendee Preview */}
            {heatMap && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <h2 className="text-sm font-bold text-amber-400 mb-3">👥 Attendee Preview</h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
                    <p className="text-2xl font-bold text-green-400">{heatMap.going}</p>
                    <p className="text-[10px] text-green-300">Confirmed</p>
                  </div>
                  <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                    <p className="text-2xl font-bold text-amber-400">{heatMap.nearby}</p>
                    <p className="text-[10px] text-amber-300">Nearby</p>
                  </div>
                  <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
                    <p className="text-2xl font-bold text-blue-400">{event.attendees?.length || 0}</p>
                    <p className="text-[10px] text-blue-300">Total RSVPs</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ LIVE PHASE ═══ */}
        {isLive && (
          <>
            {/* Heat Map */}
            {heatMap && (
              <div className="bg-gradient-to-r from-[#0f172a] to-[#1a1a3e] rounded-2xl border border-white/10 p-4">
                <h2 className="text-sm font-bold text-amber-400 mb-3">📡 Live Heat Map</h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-3xl font-bold text-green-400">{heatMap.hereNow}</span>
                    </div>
                    <p className="text-[10px] text-green-300 font-semibold">HERE NOW</p>
                    <div className="flex justify-center gap-1 mt-2">
                      {(heatMap.hereNowUsers || []).slice(0, 5).map((u: any) => (
                        <div key={u.id} className="w-6 h-6 rounded-full bg-green-700 flex items-center justify-center text-[9px] text-white font-bold">
                          {u.profilePicture ? <img src={u.profilePicture} className="w-full h-full rounded-full object-cover" alt="" /> : u.firstName?.[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 border ${
                    heatMap.nearby > heatMap.hereNow
                      ? 'bg-red-500/10 border-red-500/30 animate-pulse'
                      : 'bg-amber-500/10 border-amber-500/20'
                  }`}>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="w-3 h-3 border-2 border-amber-400 rounded-full" />
                      <span className="text-3xl font-bold text-amber-400">{heatMap.nearby}</span>
                    </div>
                    <p className="text-[10px] text-amber-300 font-semibold">NEARBY NOT IN</p>
                    {heatMap.nearby > heatMap.hereNow && (
                      <p className="text-[9px] text-red-400 mt-1 animate-pulse">⚠️ More nearby than here!</p>
                    )}
                  </div>
                  <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="w-3 h-3 border-2 border-dashed border-blue-400 rounded-full" />
                      <span className="text-3xl font-bold text-blue-400">{heatMap.going}</span>
                    </div>
                    <p className="text-[10px] text-blue-300 font-semibold">ARRIVING</p>
                  </div>
                </div>
              </div>
            )}

            {/* Serendipity Cards */}
            {event.popUps?.filter((p: any) => p.status === 'SUGGESTED').length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-purple-500/30 p-4">
                <h2 className="text-sm font-bold text-purple-400 mb-3">✨ Serendipity Suggestions</h2>
                <div className="space-y-2">
                  {event.popUps.filter((p: any) => p.status === 'SUGGESTED').map((popup: any) => (
                    <div key={popup.id} className="bg-purple-500/10 rounded-xl px-4 py-3 border border-purple-500/20 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{popup.title}</p>
                        <p className="text-[10px] text-purple-300 mt-0.5">{popup.description}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 ml-3">
                        <button onClick={() => approvePopup(popup.id)} className="bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition">
                          Create Pop-Up
                        </button>
                        <button onClick={() => dismissPopup(popup.id)} className="text-gray-500 hover:text-gray-300 transition">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Highlight Reel */}
            {event.highlights?.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <h2 className="text-sm font-bold text-orange-400 mb-3">🔥 What's Getting People Fired Up</h2>
                <div className="space-y-2">
                  {event.highlights.slice(0, 5).map((h: any) => (
                    <div key={h.id} className="bg-white/5 rounded-lg px-3 py-2 flex items-center justify-between">
                      <p className="text-xs text-gray-300 flex-1 mr-3">"{h.messageSnippet}"</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-shrink-0">
                        {h.authorName && <span>{h.authorName}</span>}
                        <span>❤️ {h.reactionCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions Bar */}
            <div className="bg-[#0f172a] sticky bottom-0 rounded-2xl border border-white/10 p-3">
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setBlastMsg(blastMsg ? '' : ' ')}
                  className="flex flex-col items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 rounded-xl py-3 px-2 transition border border-amber-500/30"
                >
                  <Send className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-300">Push Msg</span>
                </button>
                <button
                  onClick={() => setShowPlanB(true)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-3 px-2 transition border ${
                    event.planBActivated
                      ? 'bg-red-500/30 border-red-500/50'
                      : 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-red-400" />
                  <span className="text-[10px] font-bold text-red-300">{event.planBActivated ? 'Plan B Active' : 'Plan B'}</span>
                </button>
                <button className="flex flex-col items-center gap-1 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl py-3 px-2 transition border border-purple-500/30">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] font-bold text-purple-300">Trigger Hitch</span>
                </button>
                <button
                  onClick={() => setPopupTitle(popupTitle ? '' : ' ')}
                  className="flex flex-col items-center gap-1 bg-blue-500/20 hover:bg-blue-500/30 rounded-xl py-3 px-2 transition border border-blue-500/30"
                >
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-bold text-blue-300">Sub-Event</span>
                </button>
              </div>

              {/* Blast message input */}
              {blastMsg !== '' && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={blastMsg.trim() ? blastMsg : ''}
                    onChange={e => setBlastMsg(e.target.value)}
                    placeholder="Message to all attendees..."
                    className="flex-1 bg-white/10 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-amber-500/50"
                  />
                  <button onClick={sendBlast} className="bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-amber-600 transition">Send</button>
                </div>
              )}

              {/* Pop-up creator */}
              {popupTitle !== '' && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={popupTitle.trim() ? popupTitle : ''}
                    onChange={e => setPopupTitle(e.target.value)}
                    placeholder="Pop-up event title..."
                    className="flex-1 bg-white/10 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-blue-500/50"
                  />
                  <input
                    type="time"
                    value={popupTime}
                    onChange={e => setPopupTime(e.target.value)}
                    className="bg-white/10 text-white text-sm rounded-lg px-2 py-2 border border-white/10 w-28"
                  />
                  <button onClick={createPopup} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-600 transition">Create</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ POST-EVENT PHASE ═══ */}
        {isPost && (
          <>
            {/* Success Story */}
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20 p-6 text-center">
              <h2 className="text-lg font-bold text-amber-400 mb-4">🏆 Event Wrap-Up</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-3xl font-bold text-white">{event.attendees?.length || 0}</p>
                  <p className="text-[10px] text-gray-400">Attended</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">{event.tripMemory?.newConnections || 0}</p>
                  <p className="text-[10px] text-gray-400">New Connections</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">{event.popUps?.filter((p: any) => p.status !== 'DISMISSED').length || 0}</p>
                  <p className="text-[10px] text-gray-400">Pop-Up Events</p>
                </div>
              </div>
            </div>

            {/* Frozen Highlight Reel */}
            {event.highlights?.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <h2 className="text-sm font-bold text-orange-400 mb-3">🔥 Top Moments</h2>
                <div className="space-y-2">
                  {event.highlights.slice(0, 5).map((h: any, i: number) => (
                    <div key={h.id} className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-3">
                      <span className="text-amber-400 font-bold text-sm">#{i + 1}</span>
                      <p className="text-xs text-gray-300 flex-1">"{h.messageSnippet}"</p>
                      <span className="text-[10px] text-gray-500">❤️ {h.reactionCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Time Suggestions */}
            {event.tripMemory?.nextTimeSuggestions?.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <h2 className="text-sm font-bold text-purple-400 mb-3">💡 Next Time Suggestions</h2>
                <div className="space-y-2">
                  {event.tripMemory.nextTimeSuggestions.map((s: string, i: number) => (
                    <div key={i} className="bg-purple-500/10 rounded-lg px-3 py-2 text-xs text-purple-200 border border-purple-500/20">
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm transition">
                Share Memory
              </button>
              <button className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold text-sm transition border border-white/10">
                Plan Next Event
              </button>
            </div>
          </>
        )}

        {/* Plan B Modal */}
        {showPlanB && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowPlanB(false)}>
            <div className="bg-[#1e293b] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-red-400 mb-4">⛈️ Activate Plan B</h3>
              <input
                value={planBLoc}
                onChange={e => setPlanBLoc(e.target.value)}
                placeholder="New location..."
                className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 mb-3 border border-white/10 focus:outline-none"
              />
              <textarea
                value={planBDesc}
                onChange={e => setPlanBDesc(e.target.value)}
                placeholder="Details (optional)..."
                className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 mb-4 border border-white/10 focus:outline-none h-20 resize-none"
              />
              <div className="flex gap-3">
                <button onClick={activatePlanB} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg font-bold text-sm transition">
                  Activate Plan B
                </button>
                <button onClick={() => setShowPlanB(false)} className="px-6 bg-white/10 text-gray-400 py-2.5 rounded-lg text-sm transition hover:bg-white/20">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
