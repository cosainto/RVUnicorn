import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Camera, Tent, MapPin, Plus, ChevronDown, MessageSquare, GitCompare, Wrench, Users, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Helmet } from 'react-helmet-async';

interface RigData { id: string; title?: string; description?: string; photos: string[]; videoUrl?: string; coPilots?: any[];
  user: { id: string; firstName: string; lastName: string; username: string; profilePicture?: string; rvType?: string; rvYear?: number; rvMake?: string; rvModel?: string }; }
interface TripData { id: string; title?: string; startDate: string; endDate?: string; location?: string; description?: string; }
interface PhotoData { id: string; imageUrl: string; caption?: string; createdAt: string; eventId?: string; }

export default function RigMemoryPage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [rig, setRig] = useState<RigData | null>(null);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showMods, setShowMods] = useState(false);
  const [similarRigs, setSimilarRigs] = useState<any[]>([]);
  const [similarTotal, setSimilarTotal] = useState(0);
  const [questions, setQuestions] = useState<any[]>([]);
  const [showAskForm, setShowAskForm] = useState(false);
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionContent, setQuestionContent] = useState('');
  const [submittingQ, setSubmittingQ] = useState(false);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [comparison, setComparison] = useState<any>(null);
  const isOwnProfile = user?.username === username;

  useEffect(() => { loadData(); }, [username]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rigRes] = await Promise.all([
        api.get(`/rv-showcase/${username}`).catch(() => ({ data: null })),
        api.get(`/profile/${username}`).catch(() => ({ data: null })),
      ]);
      setRig(rigRes.data);

      // Load trips
      try {
        const tripsRes = await api.get('/trips/my');
        const allTrips = Array.isArray(tripsRes.data) ? tripsRes.data : (tripsRes.data.trips || []);
        setTrips(allTrips.sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
        const allPhotos: PhotoData[] = [];
        for (const trip of allTrips.slice(0, 10)) {
          try { const pr = await api.get(`/photos/event/${trip.id}`); const tp = Array.isArray(pr.data) ? pr.data : (pr.data.photos || []); allPhotos.push(...tp.map((p: any) => ({ ...p, eventId: trip.id }))); } catch {}
        }
        setPhotos(allPhotos);
      } catch {}

      // Load similar rigs, questions, maintenance in parallel
      Promise.all([
        api.get(`/rv-showcase/${username}/similar-rigs`).then(r => { setSimilarRigs(r.data.rigs || []); setSimilarTotal(r.data.total || 0); }).catch(() => {}),
        api.get(`/rv-showcase/${username}/questions`).then(r => setQuestions(r.data.questions || [])).catch(() => {}),
        api.get(`/rv-showcase/${username}/maintenance-preview`).then(r => setMaintenance(r.data.records || [])).catch(() => {}),
      ]);
    } catch {}
    finally { setLoading(false); }
  };

  const handleAskQuestion = async () => {
    if (!questionTitle.trim()) return;
    setSubmittingQ(true);
    try {
      const { data } = await api.post(`/rv-showcase/${username}/questions`, { title: questionTitle, content: questionContent });
      setQuestions(prev => [data.question, ...prev]);
      setQuestionTitle(''); setQuestionContent(''); setShowAskForm(false);
    } catch {} finally { setSubmittingQ(false); }
  };

  const loadComparison = async () => {
    try { const { data } = await api.get(`/rv-showcase/${username}/compare`); setComparison(data); setShowCompare(true); } catch {}
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1A2E' }}><div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: '#C9A84C' }} /></div>;

  const rv = rig?.user || {} as any;
  const rigPhotos = rig?.photos || [];
  const rigName = rig?.title || '';
  const modelLine = [rv.rvYear, rv.rvMake, rv.rvModel].filter(Boolean).join(' ');
  const tripAlbums = trips.map(trip => ({ trip, photos: photos.filter(p => p.eventId === trip.id) }));
  const untaggedPhotos = photos.filter(p => !p.eventId);
  const capTags: string[] = [];
  if (rv.rvType) capTags.push(rv.rvType);
  if (rv.rvMake) capTags.push(`\u{1F699} ${rv.rvMake}`);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const daysBetween = (a: string, b?: string) => b ? Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000)) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        :root{--navy:#1B2B4B;--navy-deep:#0F1A2E;--gold:#C9A84C;--gold-light:#E8C96A;--campfire:#E8622A;--campfire-glow:rgba(232,98,42,0.12);--glass-hero:rgba(15,26,46,0.82);--glass-border:rgba(201,168,76,0.18);--muted:rgba(255,255,255,0.55);--cream:#FDF6E9}
        .font-playfair{font-family:'Playfair Display',serif}.font-dm{font-family:'DM Sans',sans-serif}
        .hero-glass{background:var(--glass-hero);backdrop-filter:blur(16px);border:1px solid var(--glass-border);border-radius:20px}
        .flat-card{background:var(--navy-deep);border:1px solid rgba(255,255,255,0.06);border-radius:14px}
      `}</style>

      <div className="min-h-screen font-dm" style={{ background: '#0F1C35', color: 'white' }}>
        <Helmet><title>{rv.firstName ? `${rv.firstName}'s Rig` : 'Rig'} — RVUnicorn</title></Helmet>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <Link to={`/profile/${username}`} className="text-[12px] flex items-center gap-1 hover:text-white transition" style={{ color: 'var(--muted)' }}><ChevronLeft className="w-3.5 h-3.5" /> Back to profile</Link>
        </div>

        {/* ══ RIG HERO ══ */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
          <div className="hero-glass overflow-hidden">
            <div className="grid md:grid-cols-2">
              {/* Photo carousel */}
              <div className="relative aspect-[4/3] md:aspect-auto" style={{ background: 'var(--navy)', minHeight: '280px' }}>
                {rigPhotos.length > 0 ? (<>
                  <img src={rigPhotos[photoIndex]} alt="RV" className="w-full h-full object-cover" />
                  {rigPhotos.length > 1 && (<>
                    <button onClick={() => setPhotoIndex(i => (i - 1 + rigPhotos.length) % rigPhotos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => setPhotoIndex(i => (i + 1) % rigPhotos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60"><ChevronRight className="w-4 h-4" /></button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">{rigPhotos.map((_: string, i: number) => <div key={i} className="w-2 h-2 rounded-full" style={{ background: i === photoIndex ? 'var(--gold)' : 'rgba(255,255,255,0.3)' }} />)}</div>
                  </>)}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 100%, var(--campfire-glow), transparent 70%)' }} />
                </>) : (
                  <div className="w-full h-full flex flex-col items-center justify-center"><Tent className="w-16 h-16 mb-3" style={{ color: 'rgba(201,168,76,0.3)' }} /><p className="text-[13px]" style={{ color: 'var(--muted)' }}>No rig photos yet</p></div>
                )}
              </div>

              {/* Rig identity */}
              <div className="p-7 lg:p-9 flex flex-col justify-center">
                <div className="flex items-start justify-between">
                  <div>
                    {rigName ? <h1 className="font-playfair text-[32px] font-bold italic leading-tight" style={{ color: '#FDF6E9' }}>{rigName}</h1>
                    : isOwnProfile ? <Link to="/my-rv" className="font-playfair text-[24px] font-bold italic" style={{ color: '#E8A838' }}>Name your rig →</Link>
                    : <h1 className="font-playfair text-[28px] font-bold" style={{ color: '#FDF6E9' }}>{rv.firstName}'s Rig</h1>}
                    {modelLine && <p className="text-[15px] mt-1" style={{ color: 'var(--muted)' }}>{modelLine}{rv.rvType && ` · ${rv.rvType}`}</p>}
                  </div>
                  <div className="flex gap-2">
                    {!isOwnProfile && <button onClick={loadComparison} className="text-[11px] font-medium px-3 py-1.5 rounded-full flex items-center gap-1" style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted)' }}><GitCompare className="w-3 h-3" />Compare</button>}
                    {isOwnProfile && <Link to="/my-rv" className="text-[11px] font-medium px-3 py-1.5 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted)' }}>Edit Rig</Link>}
                  </div>
                </div>

                {capTags.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{capTags.map(t => <span key={t} className="text-[11px] px-3 py-1 rounded-full" style={{ background: 'rgba(201,168,76,0.08)', color: '#E8C96A', border: '1px solid rgba(201,168,76,0.15)' }}>{t}</span>)}</div>}
                {rig?.description && <p className="text-[13px] mt-4 leading-relaxed" style={{ color: 'var(--muted)' }}>{rig.description}</p>}

                {/* Co-Pilots */}
                {(rig as any)?.coPilots?.length > 0 && (
                  <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <p className="text-[10px] font-semibold uppercase mb-2" style={{ color: 'rgba(245,240,232,0.4)', letterSpacing: '0.1em' }}>{'\u{1F699}'} Co-Pilots</p>
                    <div className="flex flex-wrap gap-2">
                      {(rig as any).coPilots.map((cp: any) => (
                        <Link key={cp.id} to={`/profile/${cp.username}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:brightness-110 transition" style={{ background: '#1B2E50' }}>
                          {cp.profilePicture ? <img src={cp.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>{cp.firstName?.[0]}{cp.lastName?.[0]}</div>}
                          <span className="text-[11px] font-medium" style={{ color: '#F5F0E8' }}>{cp.firstName} {cp.lastName}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lifetime stats */}
                <div className="grid grid-cols-4 gap-3 mt-5 pt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  {[{ v: trips.length, l: 'Trips' }, { v: trips.reduce((s, t) => s + daysBetween(t.startDate, t.endDate), 0), l: 'Nights' }, { v: photos.length, l: 'Photos' }, { v: new Set(trips.map(t => t.location).filter(Boolean)).size, l: 'Places' }].map(s => (
                    <div key={s.l} className="text-center"><span className="font-playfair text-xl font-bold block">{s.v}</span><span className="text-[10px] uppercase" style={{ color: '#E8A838', letterSpacing: '0.08em' }}>{s.l}</span></div>
                  ))}
                </div>

                <button onClick={() => setShowMods(!showMods)} className="flex items-center gap-1.5 mt-4 text-[12px] font-medium" style={{ color: '#E8A838' }}>
                  {'\u{1F527}'} Mods & Upgrades <ChevronDown className="w-3.5 h-3.5" style={{ transform: showMods ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
                </button>
              </div>
            </div>

            {showMods && (
              <div className="px-7 pb-6" style={{ borderTop: '1px solid var(--glass-border)' }}>
                <div className="pt-4"><p className="text-[13px]" style={{ color: 'var(--muted)' }}>No mods logged yet.</p>
                  {isOwnProfile && <button className="mt-2 text-[12px] font-medium flex items-center gap-1" style={{ color: '#E8622A' }}><Plus className="w-3.5 h-3.5" />Add Mod</button>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ MAIN CONTENT ══ */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 pb-12 space-y-6">

          {/* ── MAINTENANCE LOG PREVIEW ── */}
          {maintenance.length > 0 && (
            <div className="flat-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2"><Wrench className="w-4 h-4" style={{ color: '#E8A838' }} /> Maintenance Log</h3>
                {isOwnProfile && <Link to="/maintenance" className="text-[11px]" style={{ color: '#E8C96A' }}>View All →</Link>}
              </div>
              <div className="space-y-2">
                {maintenance.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#1B2E50' }}>
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: '#F5F0E8' }}>{m.title}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{m.category}{m.mileage ? ` · ${m.mileage.toLocaleString()} mi` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{new Date(m.serviceDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                      {m.cost && <p className="text-[11px] font-medium" style={{ color: '#E8A838' }}>${m.cost.toFixed(0)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RIG TIMELINE (Trip Albums) ── */}
          <div>
            <div className="text-center mb-6">
              <h2 className="font-playfair text-[26px] font-bold">Pursuit of Memories</h2>
              <p className="text-[14px] mt-1" style={{ color: 'var(--muted)' }}>Every trip. Every stop. Every moment.</p>
            </div>

            {tripAlbums.length > 0 ? (
              <div className="space-y-4">
                {tripAlbums.map(({ trip, photos: tripPhotos }) => (
                  <div key={trip.id} className="flat-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-playfair text-lg font-bold" style={{ color: '#F5F0E8' }}>{trip.title || trip.location || 'Trip'}</h3>
                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
                          {formatDate(trip.startDate)}{trip.endDate && ` — ${formatDate(trip.endDate)}`}
                          {trip.endDate && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(232,168,56,0.08)', color: '#E8C96A' }}>{daysBetween(trip.startDate, trip.endDate)} nights</span>}
                        </p>
                      </div>
                      {isOwnProfile && <Link to={`/trips/${trip.id}`} className="text-[11px] font-medium flex items-center gap-1" style={{ color: '#E8622A' }}><Plus className="w-3.5 h-3.5" />Add Photos</Link>}
                    </div>
                    {trip.location && <p className="text-[12px] mb-3" style={{ color: '#FDF6E9' }}>{'\u{1F4CD}'} {trip.location}</p>}
                    {tripPhotos.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {tripPhotos.slice(0, 5).map((photo, i) => (
                          <div key={photo.id} className="flex-shrink-0 relative">
                            <img src={photo.imageUrl} alt={photo.caption || ''} className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg object-cover" />
                            {photo.caption && <p className="absolute bottom-0 inset-x-0 text-[9px] p-1 bg-black/60 rounded-b-lg truncate text-center" style={{ color: '#FDF6E9' }}>{photo.caption}</p>}
                            {i === 4 && tripPhotos.length > 5 && <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center"><span className="text-sm font-bold">+{tripPhotos.length - 5}</span></div>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[12px] py-2" style={{ color: 'rgba(245,240,232,0.3)' }}>No photos from this trip yet.</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flat-card p-10 text-center" style={{ background: 'var(--campfire-glow)' }}>
                <span className="text-4xl block mb-3">{'\u{1F3D5}'}</span>
                <h3 className="font-playfair text-xl font-bold mb-1">Your rig has a story — start telling it.</h3>
                <p className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Check in on your next trip and photos will appear here automatically.</p>
                <Link to="/trips/new" className="inline-block px-6 py-2.5 rounded-full text-[13px] font-semibold" style={{ background: '#E8622A', color: 'white' }}>Plan a Trip</Link>
              </div>
            )}

            {untaggedPhotos.length > 0 && (
              <details className="flat-card overflow-hidden mt-4">
                <summary className="px-5 py-3 cursor-pointer text-[13px] font-medium" style={{ color: '#FDF6E9' }}>{'\u{1F4F8}'} Other Memories ({untaggedPhotos.length} photos)</summary>
                <div className="px-5 pb-5"><div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-2">{untaggedPhotos.slice(0, 18).map(p => <img key={p.id} src={p.imageUrl} alt="" className="aspect-square rounded-lg object-cover" />)}</div></div>
              </details>
            )}
          </div>

          {/* ── ASK ABOUT THIS RIG ── */}
          <div className="flat-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4" style={{ color: '#E8A838' }} /> Ask About This Rig</h3>
              {!isOwnProfile && user && <button onClick={() => setShowAskForm(!showAskForm)} className="text-[11px] font-medium px-3 py-1.5 rounded-full" style={{ background: '#E8622A', color: 'white' }}>Ask a Question</button>}
            </div>

            {showAskForm && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: '#1B2E50' }}>
                <input value={questionTitle} onChange={e => setQuestionTitle(e.target.value)} placeholder="Your question about this rig..." className="w-full px-3 py-2 rounded-lg text-[13px] mb-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                <textarea value={questionContent} onChange={e => setQuestionContent(e.target.value)} placeholder="Add details (optional)..." rows={2} className="w-full px-3 py-2 rounded-lg text-[13px] mb-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                <div className="flex gap-2">
                  <button onClick={handleAskQuestion} disabled={submittingQ || !questionTitle.trim()} className="px-4 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1 disabled:opacity-50" style={{ background: '#E8622A', color: 'white' }}><Send className="w-3 h-3" />{submittingQ ? 'Posting...' : 'Post'}</button>
                  <button onClick={() => setShowAskForm(false)} className="text-[12px]" style={{ color: 'var(--muted)' }}>Cancel</button>
                </div>
              </div>
            )}

            {questions.length > 0 ? (
              <div className="space-y-3">
                {questions.map((q: any) => (
                  <div key={q.id} className="p-3 rounded-xl" style={{ background: '#1B2E50' }}>
                    <div className="flex items-center gap-2 mb-1">
                      {q.author?.profilePicture ? <img src={q.author.profilePicture} alt="" className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>{q.author?.firstName?.[0]}</div>}
                      <span className="text-[11px] font-medium" style={{ color: '#F5F0E8' }}>{q.author?.firstName} {q.author?.lastName}</span>
                      <span className="text-[10px]" style={{ color: 'rgba(245,240,232,0.3)' }}>{new Date(q.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: '#FDF6E9' }}>{q.title}</p>
                    {q.content && <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>{q.content}</p>}
                    <p className="text-[10px] mt-2" style={{ color: 'rgba(245,240,232,0.3)' }}>{q._count?.posts || 0} {q._count?.posts === 1 ? 'reply' : 'replies'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-center py-4" style={{ color: 'rgba(245,240,232,0.3)' }}>{isOwnProfile ? 'No questions yet — share your rig page to get questions from the community.' : 'Be the first to ask about this rig!'}</p>
            )}
          </div>

          {/* ── RIGS LIKE THIS ── */}
          {similarRigs.length > 0 && (
            <div className="flat-card p-5">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4" style={{ color: '#E8A838' }} /> Rigs Like This {similarTotal > 4 && <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>({similarTotal} {rv.rvMake} owners)</span>}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {similarRigs.map((r: any) => (
                  <Link key={r.id} to={`/profile/${r.username}/rig`} className="p-3 rounded-xl hover:brightness-110 transition text-center" style={{ background: '#1B2E50' }}>
                    {r.profilePicture ? <img src={r.profilePicture} alt="" className="w-12 h-12 rounded-full object-cover mx-auto mb-2" /> : <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-[14px] font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>{r.firstName?.[0]}{r.lastName?.[0]}</div>}
                    <p className="text-[12px] font-medium truncate" style={{ color: '#F5F0E8' }}>{r.firstName} {r.lastName}</p>
                    <p className="text-[10px] truncate" style={{ color: 'rgba(245,240,232,0.4)' }}>{r.rvYear} {r.rvMake} {r.rvModel}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ══ RIG COMPARISON MODAL ══ */}
        {showCompare && comparison && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCompare(false)}>
            <div className="rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" style={{ background: '#0F1C35', border: '1px solid rgba(201,168,76,0.18)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-playfair text-xl font-bold">Rig Comparison</h2>
                <button onClick={() => setShowCompare(false)} className="text-[12px]" style={{ color: 'var(--muted)' }}>Close</button>
              </div>
              {comparison.viewerRig ? (
                <div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center"><p className="text-[11px] font-semibold" style={{ color: '#E8A838' }}>Theirs</p><p className="text-[12px]" style={{ color: '#F5F0E8' }}>{comparison.profileRig.rvYear} {comparison.profileRig.rvMake}</p><p className="text-[10px]" style={{ color: 'var(--muted)' }}>{comparison.profileRig.rvModel}</p></div>
                    <div className="text-center flex items-center justify-center"><GitCompare className="w-5 h-5" style={{ color: 'var(--muted)' }} /></div>
                    <div className="text-center"><p className="text-[11px] font-semibold" style={{ color: '#E8A838' }}>Yours</p><p className="text-[12px]" style={{ color: '#F5F0E8' }}>{comparison.viewerRig.rvYear} {comparison.viewerRig.rvMake}</p><p className="text-[10px]" style={{ color: 'var(--muted)' }}>{comparison.viewerRig.rvModel}</p></div>
                  </div>
                  <div className="space-y-1">
                    {[
                      { label: 'Type', a: comparison.profileRig.rvType, b: comparison.viewerRig.rvType },
                      { label: 'Length', a: comparison.profileRig.rvLength ? `${comparison.profileRig.rvLength} ft` : '—', b: comparison.viewerRig.rvLength ? `${comparison.viewerRig.rvLength} ft` : '—' },
                      { label: 'Sleeps', a: comparison.profileRig.rvSleeps || '—', b: comparison.viewerRig.rvSleeps || '—' },
                      { label: 'MPG', a: comparison.profileRig.rvMpg ? `~${comparison.profileRig.rvMpg}` : '—', b: comparison.viewerRig.rvMpg ? `~${comparison.viewerRig.rvMpg}` : '—' },
                      { label: 'Solar', a: comparison.profileRig.rvSolarWatts ? `${comparison.profileRig.rvSolarWatts}W` : '—', b: comparison.viewerRig.rvSolarWatts ? `${comparison.viewerRig.rvSolarWatts}W` : '—' },
                      { label: 'Fresh Water', a: comparison.profileRig.rvFreshWaterGal ? `${comparison.profileRig.rvFreshWaterGal} gal` : '—', b: comparison.viewerRig.rvFreshWaterGal ? `${comparison.viewerRig.rvFreshWaterGal} gal` : '—' },
                      { label: 'Generator', a: comparison.profileRig.rvGeneratorWatts ? `${comparison.profileRig.rvGeneratorWatts}W` : '—', b: comparison.viewerRig.rvGeneratorWatts ? `${comparison.viewerRig.rvGeneratorWatts}W` : '—' },
                      { label: 'Battery', a: comparison.profileRig.rvBatteryAh ? `${comparison.profileRig.rvBatteryAh} Ah` : '—', b: comparison.viewerRig.rvBatteryAh ? `${comparison.viewerRig.rvBatteryAh} Ah` : '—' },
                      { label: 'Fuel', a: comparison.profileRig.rvFuelType || '—', b: comparison.viewerRig.rvFuelType || '—' },
                    ].map(row => (
                      <div key={row.label} className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg" style={{ background: '#1B2E50' }}>
                        <p className="text-[12px] text-right" style={{ color: '#F5F0E8' }}>{row.a}</p>
                        <p className="text-[10px] text-center font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>{row.label}</p>
                        <p className="text-[12px]" style={{ color: '#F5F0E8' }}>{row.b}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{comparison.message || 'Add your rig to your profile to compare.'}</p>
                  <Link to="/my-rv" className="inline-block mt-3 px-5 py-2 rounded-full text-[12px] font-semibold" style={{ background: '#E8622A', color: 'white' }}>Set Up My Rig</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
