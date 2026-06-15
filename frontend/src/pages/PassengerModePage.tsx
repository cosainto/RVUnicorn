import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Camera, MapPin, Fuel, UtensilsCrossed, Tent, Moon, Navigation, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552', success: '#4CAF82' };

type Screen = 'ROLE_SELECT' | 'DRIVER' | 'PASSENGER';
type Tab = 'dashboard' | 'campfire' | 'chat' | 'missions';

const STOP_TYPES = [
  { type: 'ROLLING', emoji: '\u{1F690}', label: 'Rolling Again', color: CN.success },
  { type: 'FUEL', emoji: '\u26FD', label: 'Fuel Stop', color: '#f59e0b' },
  { type: 'FOOD', emoji: '\u{1F354}', label: 'Food Stop', color: '#ef4444' },
  { type: 'SCENIC', emoji: '\u{1F4F8}', label: 'Scenic Stop', color: '#3b82f6' },
  { type: 'OVERNIGHT', emoji: '\u{1F319}', label: 'Overnight', color: '#1B2B4B' },
  { type: 'REST_AREA', emoji: '\u{1F6BB}', label: 'Rest Area', color: '#6b7280' },
];

export default function PassengerModePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('ROLE_SELECT');
  const [tab, setTab] = useState<Tab>('dashboard');
  const [session, setSession] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [points, setPoints] = useState(0);
  const [travelerFeed, setTravelerFeed] = useState<any[]>([]);
  const [nextTrip, setNextTrip] = useState<any>(null);
  const [showStopSheet, setShowStopSheet] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState({ name: '', fuelPrice: '', fuelGallons: '', notes: '', restaurantRating: 0 });
  const [submittingStop, setSubmittingStop] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefId, setDebriefId] = useState<string | null>(null);
  const [debriefQuestion, setDebriefQuestion] = useState(0);
  const [debriefRating, setDebriefRating] = useState(0);
  const [debriefText, setDebriefText] = useState('');
  const [tripRecap, setTripRecap] = useState<any>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  // Check for existing session on mount
  useEffect(() => {
    api.get('/passenger/session/active').then(r => {
      if (r.data) {
        setSession(r.data);
        setScreen(r.data.role === 'DRIVER' ? 'DRIVER' : 'PASSENGER');
      }
    }).catch(() => {});

    api.get('/trips/upcoming').then(r => {
      const trips = Array.isArray(r.data) ? r.data : [];
      if (trips.length > 0) setNextTrip(trips[0]);
    }).catch(() => {});
  }, []);

  // Load data when passenger mode active
  useEffect(() => {
    if (screen !== 'PASSENGER' || !session) return;
    api.get('/passenger/stops').then(r => setStops(r.data || [])).catch(() => {});
    api.get('/passenger/missions').then(r => setMissions(r.data || [])).catch(() => {});
    api.get('/passenger/points').then(r => setPoints(r.data?.points || 0)).catch(() => {});
    api.get('/passenger/traveler-feed').then(r => setTravelerFeed(r.data || [])).catch(() => {});
    api.get('/passenger/milestones').then(r => setMilestones(r.data || [])).catch(() => {});

    // Direction detection every 10 minutes
    const directionInterval = setInterval(() => {
      navigator.geolocation?.getCurrentPosition(pos => {
        api.post('/passenger/session/location', { lat: pos.coords.latitude, lng: pos.coords.longitude }).catch(() => {});
        api.post('/passenger/session/check-direction').then(r => {
          if (r.data?.changed && r.data?.direction === 'INBOUND') {
            setSession((s: any) => s ? { ...s, direction: 'INBOUND' } : s);
          }
        }).catch(() => {});
      }, () => {}, { timeout: 10000 });
    }, 10 * 60 * 1000);

    // Badge check every 5 minutes
    const badgeInterval = setInterval(() => {
      api.post('/passenger/check-badges').then(r => {
        if (r.data?.awarded?.length > 0) setNewBadges(r.data.awarded);
      }).catch(() => {});
    }, 5 * 60 * 1000);

    return () => { clearInterval(directionInterval); clearInterval(badgeInterval); };
  }, [screen, session]);

  const startSession = async (role: 'DRIVER' | 'PASSENGER') => {
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}

      const { data } = await api.post('/passenger/session/start', {
        role,
        tripId: nextTrip?.id,
        direction: 'OUTBOUND',
        lat, lng,
      });
      setSession(data);
      setScreen(role === 'DRIVER' ? 'DRIVER' : 'PASSENGER');
    } catch { alert('Failed to start session'); }
  };

  const logStop = async (stopType: string) => {
    if (stopType === 'ROLLING') {
      setSubmittingStop(true);
      let lat: number | undefined, lng: number | undefined;
      try { const pos = await new Promise<GeolocationPosition>((r, j) => navigator.geolocation.getCurrentPosition(r, j, { timeout: 5000 })); lat = pos.coords.latitude; lng = pos.coords.longitude; } catch {}
      await api.post('/passenger/stops', { stopType: 'OTHER', name: 'Rolling again', lat, lng }).catch(() => {});
      const r = await api.get('/passenger/stops');
      setStops(r.data || []);
      setSubmittingStop(false);
      return;
    }
    setShowStopSheet(stopType);
    setStopForm({ name: '', fuelPrice: '', fuelGallons: '', notes: '', restaurantRating: 0 });
  };

  const submitStop = async () => {
    if (!showStopSheet) return;
    setSubmittingStop(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      try { const pos = await new Promise<GeolocationPosition>((r, j) => navigator.geolocation.getCurrentPosition(r, j, { timeout: 5000 })); lat = pos.coords.latitude; lng = pos.coords.longitude; } catch {}
      await api.post('/passenger/stops', {
        stopType: showStopSheet,
        name: stopForm.name || null,
        lat, lng,
        notes: stopForm.notes || null,
        fuelPrice: stopForm.fuelPrice ? parseFloat(stopForm.fuelPrice) : null,
        fuelGallons: stopForm.fuelGallons ? parseFloat(stopForm.fuelGallons) : null,
        restaurantRating: stopForm.restaurantRating || null,
      });
      const r = await api.get('/passenger/stops');
      setStops(r.data || []);
      const p = await api.get('/passenger/points');
      setPoints(p.data?.points || 0);
      setShowStopSheet(null);
    } catch { alert('Failed to log stop'); }
    setSubmittingStop(false);
  };

  const completeMission = async (missionId: string) => {
    await api.post(`/passenger/missions/${missionId}/complete`).catch(() => {});
    const [m, p] = await Promise.all([api.get('/passenger/missions'), api.get('/passenger/points')]);
    setMissions(m.data || []);
    setPoints(p.data?.points || 0);
  };

  const startDebrief = async () => {
    if (!session?.tripId) return;
    try {
      const { data } = await api.post('/passenger/debrief/start', { tripId: session.tripId, sessionId: session.id });
      setDebriefId(data.id);
      setShowDebrief(true);
      setDebriefQuestion(0);
    } catch { alert('Failed to start debrief'); }
  };

  const submitDebriefAnswer = async (questionType: string, answer: any) => {
    if (!debriefId) return;
    await api.post(`/passenger/debrief/${debriefId}/answer`, { questionType, answer }).catch(() => {});
    setDebriefQuestion(q => q + 1);
    setDebriefRating(0);
    setDebriefText('');
    api.get('/passenger/points').then(r => setPoints(r.data?.points || 0)).catch(() => {});
  };

  const completeDebrief = async () => {
    if (!debriefId) return;
    await api.post(`/passenger/debrief/${debriefId}/complete`).catch(() => {});
    // Generate trip recap
    if (session?.tripId) {
      const { data } = await api.post(`/passenger/trip-recap/${session.tripId}`).catch(() => ({ data: null }));
      setTripRecap(data);
    }
    setShowDebrief(false);
    api.get('/passenger/points').then(r => setPoints(r.data?.points || 0)).catch(() => {});
  };

  const endSession = async () => {
    await api.post('/passenger/session/end').catch(() => {});
    navigate('/');
  };

  const destination = nextTrip?.campground?.name || nextTrip?.title || 'your destination';

  // ── ROLE SELECT SCREEN ──
  if (screen === 'ROLE_SELECT') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: CN.bg }}>
        <div className="max-w-sm w-full text-center">
          <span className="text-5xl block mb-4">{'\u{1F690}'}</span>
          {nextTrip && <p className="text-xs uppercase tracking-wider mb-1" style={{ color: CN.gold }}>En route to</p>}
          <h1 className="text-xl font-bold mb-6" style={{ color: CN.cream, fontFamily: "'Playfair Display', serif" }}>
            {nextTrip ? destination : 'Ready to hit the road?'}
          </h1>

          <div className="space-y-3">
            <button onClick={() => startSession('DRIVER')}
              className="w-full p-5 rounded-2xl text-left transition hover:brightness-110" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{'\u{1F697}'}</span>
                <div>
                  <p className="font-bold" style={{ color: CN.cream }}>I'm Driving</p>
                  <p className="text-xs" style={{ color: CN.muted }}>Minimal mode {'\u2014'} no distractions</p>
                </div>
              </div>
            </button>

            <button onClick={() => startSession('PASSENGER')}
              className="w-full p-5 rounded-2xl text-left transition hover:brightness-110" style={{ background: CN.card, border: `2px solid ${CN.gold}` }}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{'\u{1F392}'}</span>
                <div>
                  <p className="font-bold" style={{ color: CN.gold }}>I'm Riding Along</p>
                  <p className="text-xs" style={{ color: CN.cream }}>Passenger Mode {'\u2014'} full experience</p>
                </div>
              </div>
            </button>
          </div>

          <button onClick={() => navigate('/')} className="mt-6 text-xs" style={{ color: CN.muted }}>
            {'\u2190'} Back to Basecamp
          </button>
        </div>
      </div>
    );
  }

  // ── DRIVER SCREEN (intentionally minimal) ──
  if (screen === 'DRIVER') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#000' }}>
        <p className="text-sm mb-2" style={{ color: '#666' }}>Headed to</p>
        <h1 className="text-xl font-bold mb-1 text-white">{destination}</h1>
        <p className="text-sm mb-8" style={{ color: '#666' }}>Drive safe. Phone in the holder.</p>

        <button onClick={() => alert('Calling 911...')}
          className="w-full max-w-xs py-5 rounded-2xl text-xl font-black text-white mb-6" style={{ background: '#ef4444' }}>
          {'\u{1F6A8}'} Emergency
        </button>

        <button onClick={() => { setScreen('PASSENGER'); }}
          className="text-sm py-3 px-6 rounded-xl" style={{ border: '1px solid #333', color: '#666' }}>
          Hand phone to passenger {'\u2192'}
        </button>

        <button onClick={endSession} className="mt-8 text-xs" style={{ color: '#444' }}>
          End trip
        </button>
      </div>
    );
  }

  // ── PASSENGER DASHBOARD ──
  return (
    <div className="min-h-screen pb-20" style={{ background: CN.bg }}>

      {/* ── DASHBOARD TAB ── */}
      {tab === 'dashboard' && (
        <div className="space-y-4 p-4">

          {/* ZONE 1 — Trip Progress */}
          <div className="rounded-2xl p-4" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: CN.muted }}>
                  {session?.direction === 'INBOUND' ? 'Heading home' : 'En route to'}
                </p>
                <h2 className="text-lg font-bold" style={{ color: CN.cream, fontFamily: "'Playfair Display', serif" }}>{destination}</h2>
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ background: 'rgba(74,175,130,0.15)', color: CN.success }}>
                {session?.direction === 'INBOUND' ? '\u{1F3E1}' : '\u{1F3D5}\uFE0F'} {session?.direction}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: CN.muted }}>
              <span>{'\u26FD'} {stops.filter(s => s.stopType === 'FUEL').length} fuel stops</span>
              <span>{'\u00B7'}</span>
              <span>{'\u{1F4F8}'} {stops.filter(s => s.stopType === 'SCENIC').length} photos</span>
              <span>{'\u00B7'}</span>
              <span>{'\u2B50'} {points} pts</span>
            </div>
          </div>

          {/* ZONE 2 — Rig Broadcast (stop logging) */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: CN.muted }}>{'\u{1F4E2}'} Log a Stop</p>
            <div className="grid grid-cols-3 gap-2">
              {STOP_TYPES.map(st => (
                <button key={st.type} onClick={() => logStop(st.type)} disabled={submittingStop}
                  className="rounded-xl p-4 text-center transition hover:brightness-110 active:scale-95"
                  style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <span className="text-2xl block mb-1">{st.emoji}</span>
                  <span className="text-[10px] font-semibold" style={{ color: CN.cream }}>{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ZONE 3 — Recent Stops */}
          {stops.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2 px-1" style={{ color: CN.muted }}>{'\u{1F4CB}'} Your Stops</p>
              <div className="space-y-2">
                {stops.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    <span className="text-lg">{STOP_TYPES.find(t => t.type === s.stopType)?.emoji || '\u{1F4CD}'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: CN.cream }}>{s.name || s.stopType}</p>
                      <p className="text-[10px]" style={{ color: CN.muted }}>
                        {new Date(s.loggedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {s.fuelPrice ? ` \u00B7 $${s.fuelPrice}/gal` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ZONE 4 — Traveler Feed */}
          {travelerFeed.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2 px-1" style={{ color: CN.muted }}>{'\u{1F465}'} Travelers on the Road</p>
              <div className="space-y-2">
                {travelerFeed.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                    {item.user?.profilePicture ? <img src={item.user.profilePicture} className="w-8 h-8 rounded-full object-cover" alt="" /> : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: CN.gold }}>{item.user?.firstName?.[0] || '?'}</div>}
                    <div className="flex-1">
                      <p className="text-xs font-semibold" style={{ color: CN.cream }}>{item.user?.firstName}</p>
                      <p className="text-[10px]" style={{ color: CN.muted }}>
                        {item.type === 'ACTIVE_SESSION' ? `On the road \u00B7 ${item.direction}` : `${item.stopType} stop${item.name ? ` at ${item.name}` : ''}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End session */}
          <button onClick={endSession} className="w-full py-2 text-xs rounded-xl" style={{ border: `1px solid ${CN.border}`, color: CN.muted }}>
            End Passenger Mode
          </button>
        </div>
      )}

      {/* ── MISSIONS TAB ── */}
      {tab === 'missions' && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: CN.cream }}>{'\u{1F3AF}'} Road Missions</h2>
            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(232,168,56,0.15)', color: CN.gold }}>{'\u2B50'} {points} pts</span>
          </div>
          {missions.length === 0 ? (
            <p className="text-center py-8 text-xs" style={{ color: CN.muted }}>No missions yet</p>
          ) : (
            <div className="space-y-3">
              {missions.map(m => (
                <div key={m.id} className="rounded-2xl p-4" style={{ background: CN.card, border: `1px solid ${m.completedAt ? 'rgba(74,175,130,0.3)' : CN.border}` }}>
                  <div className="flex items-start gap-3">
                    <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_64,h_64,c_fill/v1775261116/rvunicorn/characters/hitch.png" className="w-10 h-10 rounded-full" alt="" />
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: m.completedAt ? CN.success : CN.cream }}>{m.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: CN.muted }}>{m.hitchPrompt || m.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold" style={{ color: CN.gold }}>+{m.points} pts</span>
                        {m.completedAt ? (
                          <span className="text-[10px] font-bold" style={{ color: CN.success }}>{'\u2713'} Complete</span>
                        ) : (
                          <button onClick={() => completeMission(m.id)}
                            className="px-3 py-1 rounded-full text-[10px] font-bold transition hover:brightness-110"
                            style={{ background: CN.gold, color: '#0F1C35' }}>
                            Complete Mission
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CAMPFIRE TAB (Phase 6) ── */}
      {tab === 'campfire' && (
        <div className="p-4">
          <div className="rounded-2xl p-6 text-center" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <span className="text-5xl block mb-3">{'\u{1F525}'}</span>
            <h3 className="font-bold mb-2" style={{ color: CN.cream }}>Destination Campfire</h3>
            <p className="text-xs mb-4" style={{ color: CN.muted }}>
              {session?.direction === 'INBOUND' ? 'The campfire from your trip' : `Campfire at ${destination}`}
            </p>
            {nextTrip?.campground?.id ? (
              <a href={`/campgrounds/${nextTrip.campground.id}?tab=campfire`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition hover:brightness-110" style={{ background: CN.gold, color: '#0F1C35' }}>
                {'\u{1F525}'} Open Campfire
              </a>
            ) : (
              <p className="text-xs" style={{ color: CN.muted }}>No campground linked to this trip</p>
            )}
          </div>
        </div>
      )}

      {/* ── ROAD CHAT TAB (Phase 7) ── */}
      {tab === 'chat' && (
        <div className="p-4">
          <div className="rounded-2xl p-6 text-center" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <span className="text-5xl block mb-3">{'\u{1F4AC}'}</span>
            <h3 className="font-bold mb-2" style={{ color: CN.cream }}>Road Chat</h3>
            <p className="text-xs mb-4" style={{ color: CN.muted }}>Chat with Hitch, Walter, and the crew while you ride</p>
            <a href="/hitch" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition hover:brightness-110" style={{ background: CN.gold, color: '#0F1C35' }}>
              {'\u{1F4AC}'} Open Road Chat
            </a>
          </div>
        </div>
      )}

      {/* ── MILESTONES BANNER (Phase 13) ── */}
      {milestones.length > 0 && tab === 'dashboard' && (
        <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-2">
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(232,168,56,0.95)', backdropFilter: 'blur(8px)' }}>
            <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_64,h_64,c_fill/v1775261116/rvunicorn/characters/hitch.png" className="w-8 h-8 rounded-full" alt="" />
            <p className="text-xs font-semibold flex-1" style={{ color: '#0F1C35' }}>{milestones[milestones.length - 1]?.message}</p>
            <button onClick={() => setMilestones([])} className="text-sm" style={{ color: '#0F1C35' }}>{'\u2715'}</button>
          </div>
        </div>
      )}

      {/* ── BADGE CELEBRATION OVERLAY (Phase 11) ── */}
      {newBadges.length > 0 && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="text-center max-w-xs">
            <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_128,h_128,c_fill/v1775261116/rvunicorn/characters/hitch.png" className="w-16 h-16 rounded-full mx-auto mb-4" alt="" />
            <span className="text-5xl block mb-3">{'\u{1F3C6}'}</span>
            <h2 className="text-xl font-bold mb-2" style={{ color: CN.gold }}>Badge Earned!</h2>
            <p className="text-sm mb-4" style={{ color: CN.cream }}>{newBadges.map(b => b.replace(/_/g, ' ')).join(', ')}</p>
            <button onClick={() => setNewBadges([])} className="px-6 py-2.5 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: '#0F1C35' }}>
              {'\u{1F389}'} Awesome!
            </button>
          </div>
        </div>
      )}

      {/* ── INBOUND TRANSITION PROMPT (Phase 9) ── */}
      {session?.direction === 'INBOUND' && !showDebrief && !tripRecap && tab === 'dashboard' && (
        <div className="fixed bottom-20 left-4 right-4 z-30">
          <div className="rounded-2xl p-4" style={{ background: CN.card, border: `2px solid ${CN.gold}` }}>
            <div className="flex items-center gap-3">
              <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_64,h_64,c_fill/v1775261116/rvunicorn/characters/hitch.png" className="w-10 h-10 rounded-full" alt="" />
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: CN.cream }}>Heading home! {'\u{1F3E1}'}</p>
                <p className="text-xs" style={{ color: CN.muted }}>Ready to capture your memories?</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={startDebrief} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ background: CN.gold, color: '#0F1C35' }}>Start Trip Debrief</button>
              <button onClick={() => {}} className="px-4 py-2 rounded-xl text-xs" style={{ border: `1px solid ${CN.border}`, color: CN.muted }}>Later</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TRIP DEBRIEF MODAL (Phase 10) ── */}
      {showDebrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: CN.bg }}>
          <div className="max-w-sm w-full text-center">
            <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_96,h_96,c_fill/v1775261116/rvunicorn/characters/hitch.png" className="w-12 h-12 rounded-full mx-auto mb-4" alt="" />

            {debriefQuestion === 0 && (
              <>
                <p className="text-sm mb-4" style={{ color: CN.cream }}>How was your trip overall?</p>
                <div className="flex justify-center gap-2 mb-4">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setDebriefRating(n)}
                      className={`w-12 h-12 rounded-xl text-xl transition ${debriefRating >= n ? 'bg-amber-400 text-white' : ''}`}
                      style={debriefRating < n ? { background: CN.cardAlt, color: CN.muted } : {}}>{'\u2B50'}</button>
                  ))}
                </div>
                <button onClick={() => submitDebriefAnswer('CAMPGROUND_RATING', { rating: debriefRating })} disabled={debriefRating === 0}
                  className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: CN.gold, color: '#0F1C35' }}>Next</button>
              </>
            )}

            {debriefQuestion === 1 && (
              <>
                <p className="text-sm mb-4" style={{ color: CN.cream }}>What was the best moment of this trip?</p>
                <textarea value={debriefText} onChange={e => setDebriefText(e.target.value)} rows={3}
                  placeholder="That sunset at White Sands was unreal..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent resize-none mb-4" style={{ border: `1px solid ${CN.border}`, color: CN.cream }} />
                <button onClick={() => { submitDebriefAnswer('TRIP_MEMORY', { text: debriefText }); }} disabled={!debriefText.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: CN.gold, color: '#0F1C35' }}>Next</button>
              </>
            )}

            {debriefQuestion === 2 && (
              <>
                <p className="text-sm mb-4" style={{ color: CN.cream }}>Would you go back?</p>
                <div className="flex gap-3 mb-4">
                  <button onClick={() => submitDebriefAnswer('WOULD_RETURN', { value: 'definitely' })}
                    className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'rgba(74,175,130,0.2)', color: CN.success, border: '1px solid rgba(74,175,130,0.3)' }}>
                    {'\u{1F44D}'} Definitely
                  </button>
                  <button onClick={() => submitDebriefAnswer('WOULD_RETURN', { value: 'maybe' })}
                    className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: CN.cardAlt, color: CN.gold, border: `1px solid ${CN.border}` }}>
                    {'\u{1F914}'} Maybe
                  </button>
                  <button onClick={() => submitDebriefAnswer('WOULD_RETURN', { value: 'no' })}
                    className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {'\u{1F44E}'} No
                  </button>
                </div>
              </>
            )}

            {debriefQuestion >= 3 && (
              <>
                <span className="text-5xl block mb-3">{'\u{1F389}'}</span>
                <p className="text-lg font-bold mb-2" style={{ color: CN.gold }}>Trip debrief complete!</p>
                <p className="text-xs mb-4" style={{ color: CN.muted }}>+50 CoPilot points earned</p>
                <button onClick={completeDebrief} className="w-full py-2.5 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: '#0F1C35' }}>
                  Generate Trip Recap
                </button>
              </>
            )}

            <button onClick={() => setShowDebrief(false)} className="mt-4 text-xs" style={{ color: CN.muted }}>Skip for now</button>
            <p className="text-[10px] mt-2" style={{ color: CN.muted }}>{debriefQuestion < 3 ? `${debriefQuestion + 1} of 3` : ''}</p>
          </div>
        </div>
      )}

      {/* ── TRIP RECAP CARD (Phase 12) ── */}
      {tripRecap && tab === 'dashboard' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,28,53,0.95)' }}>
          <div className="max-w-sm w-full rounded-2xl overflow-hidden" style={{ background: CN.card, border: `2px solid ${CN.gold}` }}>
            <div className="p-5 text-center" style={{ background: 'linear-gradient(135deg, #1B2B4B, #0F1C35)' }}>
              <span className="text-4xl block mb-2">{'\u{1F690}'}</span>
              <h2 className="text-lg font-bold" style={{ color: CN.gold, fontFamily: "'Playfair Display', serif" }}>Trip Complete!</h2>
              {tripRecap.narrative && <p className="text-xs mt-2 italic" style={{ color: CN.cream }}>{tripRecap.narrative}</p>}
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 rounded-lg" style={{ background: CN.cardAlt }}>
                  <p className="text-sm font-bold" style={{ color: CN.gold }}>{tripRecap.totalStops}</p>
                  <p className="text-[9px]" style={{ color: CN.muted }}>Stops</p>
                </div>
                <div className="text-center p-2 rounded-lg" style={{ background: CN.cardAlt }}>
                  <p className="text-sm font-bold" style={{ color: CN.gold }}>{tripRecap.fuelStops}</p>
                  <p className="text-[9px]" style={{ color: CN.muted }}>Fuel Stops</p>
                </div>
                <div className="text-center p-2 rounded-lg" style={{ background: CN.cardAlt }}>
                  <p className="text-sm font-bold" style={{ color: CN.gold }}>${tripRecap.totalFuelCost?.toFixed(0) || '0'}</p>
                  <p className="text-[9px]" style={{ color: CN.muted }}>Fuel Cost</p>
                </div>
              </div>

              {/* Day-by-day story */}
              {tripRecap.story?.length > 0 && (
                <div className="max-h-48 overflow-y-auto mb-4" style={{ scrollbarWidth: 'thin' }}>
                  {tripRecap.story.map((day: any) => (
                    <div key={day.dayNum} className="mb-3">
                      <p className="text-[10px] font-bold uppercase mb-1" style={{ color: CN.gold }}>Day {day.dayNum} {'\u2014'} {day.date}</p>
                      {day.entries.map((e: any, i: number) => (
                        <p key={i} className="text-[11px] py-0.5" style={{ color: CN.cream }}>
                          {e.emoji} {e.name} {'\u00B7'} {e.time} {e.details ? `\u00B7 ${e.details}` : ''}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => { setTripRecap(null); endSession(); }}
                className="w-full py-2.5 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: '#0F1C35' }}>
                {'\u{1F3E0}'} Return to Basecamp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM TAB BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 flex" style={{ background: CN.card, borderTop: `1px solid ${CN.border}` }}>
        {[
          { id: 'dashboard', emoji: '\u{1F3E0}', label: 'Dashboard' },
          { id: 'campfire', emoji: '\u{1F525}', label: 'Campfire' },
          { id: 'chat', emoji: '\u{1F4AC}', label: 'Road Chat' },
          { id: 'missions', emoji: '\u{1F3AF}', label: 'Missions' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className="flex-1 flex flex-col items-center gap-0.5 py-3 transition"
            style={{ color: tab === t.id ? CN.gold : CN.muted }}>
            <span className="text-lg">{t.emoji}</span>
            <span className="text-[9px] font-semibold">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── STOP DETAIL SHEET ── */}
      {showStopSheet && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="w-full rounded-t-2xl p-5" style={{ background: CN.card }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: CN.cream }}>
                {STOP_TYPES.find(s => s.type === showStopSheet)?.emoji} {STOP_TYPES.find(s => s.type === showStopSheet)?.label}
              </h3>
              <button onClick={() => setShowStopSheet(null)} style={{ color: CN.muted }}>{'\u2715'}</button>
            </div>

            <div className="space-y-3">
              <input type="text" value={stopForm.name} onChange={e => setStopForm(f => ({ ...f, name: e.target.value }))}
                placeholder={showStopSheet === 'FUEL' ? 'Station name' : showStopSheet === 'FOOD' ? 'Restaurant name' : 'Location name'}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent" style={{ border: `1px solid ${CN.border}`, color: CN.cream }} />

              {showStopSheet === 'FUEL' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: CN.muted }}>$</span>
                    <input type="number" step="0.01" value={stopForm.fuelPrice} onChange={e => setStopForm(f => ({ ...f, fuelPrice: e.target.value }))}
                      placeholder="3.49" className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm bg-transparent" style={{ border: `1px solid ${CN.border}`, color: CN.cream }} />
                  </div>
                  <input type="number" step="0.1" value={stopForm.fuelGallons} onChange={e => setStopForm(f => ({ ...f, fuelGallons: e.target.value }))}
                    placeholder="Gallons" className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent" style={{ border: `1px solid ${CN.border}`, color: CN.cream }} />
                </div>
              )}

              {showStopSheet === 'FOOD' && (
                <div className="flex gap-2">
                  {[{ v: 1, emoji: '\u{1F44D}', label: 'Worth it' }, { v: 0, emoji: '\u{1F610}', label: 'Okay' }, { v: -1, emoji: '\u{1F44E}', label: 'Skip' }].map(r => (
                    <button key={r.v} type="button" onClick={() => setStopForm(f => ({ ...f, restaurantRating: r.v }))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition ${stopForm.restaurantRating === r.v ? 'text-white' : ''}`}
                      style={stopForm.restaurantRating === r.v ? { background: CN.gold, color: '#0F1C35' } : { border: `1px solid ${CN.border}`, color: CN.muted }}>
                      {r.emoji} {r.label}
                    </button>
                  ))}
                </div>
              )}

              <textarea value={stopForm.notes} onChange={e => setStopForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)" rows={2}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent resize-none" style={{ border: `1px solid ${CN.border}`, color: CN.cream }} />

              <button onClick={submitStop} disabled={submittingStop}
                className="w-full py-3 rounded-xl font-bold text-sm transition hover:brightness-110 disabled:opacity-50" style={{ background: CN.gold, color: '#0F1C35' }}>
                {submittingStop ? 'Logging...' : 'Log It'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
