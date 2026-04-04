import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Edit, Camera, Tent, MapPin, Plus, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Helmet } from 'react-helmet-async';

interface RigData {
  id: string; title?: string; description?: string; photos: string[]; videoUrl?: string;
  user: { id: string; firstName: string; lastName: string; username: string; profilePicture?: string; rvType?: string; rvYear?: number; rvMake?: string; rvModel?: string };
}
interface TripData {
  id: string; title?: string; startDate: string; endDate?: string; location?: string;
  description?: string;
  attendees?: any[];
  _count?: { attendees: number };
}
interface PhotoData { id: string; imageUrl: string; caption?: string; createdAt: string; eventId?: string; }

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function RigMemoryPage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [rig, setRig] = useState<RigData | null>(null);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showMods, setShowMods] = useState(false);
  const isOwnProfile = user?.username === username;
  const heroRef = useInView();

  useEffect(() => { loadData(); }, [username]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rigRes, profileRes] = await Promise.all([
        api.get(`/rv-showcase/${username}`).catch(() => ({ data: null })),
        api.get(`/profile/${username}`),
      ]);
      setRig(rigRes.data);

      // Load trips
      try {
        const tripsRes = await api.get('/trips/my');
        const allTrips = Array.isArray(tripsRes.data) ? tripsRes.data : (tripsRes.data.trips || []);
        setTrips(allTrips.sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));

        // Load photos for each trip
        const allPhotos: PhotoData[] = [];
        for (const trip of allTrips.slice(0, 10)) {
          try {
            const photoRes = await api.get(`/photos/event/${trip.id}`);
            const tripPhotos = Array.isArray(photoRes.data) ? photoRes.data : (photoRes.data.photos || []);
            allPhotos.push(...tripPhotos.map((p: any) => ({ ...p, eventId: trip.id })));
          } catch {}
        }
        setPhotos(allPhotos);
      } catch {}
    } catch {}
    finally { setLoading(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1A2E' }}><div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: '#C9A84C' }} /></div>;

  const rv = rig?.user || {} as any;
  const rigPhotos = rig?.photos || [];
  const rigName = rig?.title || '';
  const modelLine = [rv.rvYear, rv.rvMake, rv.rvModel].filter(Boolean).join(' ');

  // Group photos by trip
  const tripAlbums = trips.map(trip => ({
    trip,
    photos: photos.filter(p => p.eventId === trip.id),
  })).filter(ta => ta.photos.length > 0 || true); // Show all trips even without photos

  const untaggedPhotos = photos.filter(p => !p.eventId);

  // Capability tags
  const capTags: string[] = [];
  if (rv.rvType) capTags.push(`${rv.rvType}`);
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

      <div className="min-h-screen font-dm" style={{ background: 'var(--navy-deep)', color: 'white' }}>
        <Helmet>
          <title>{rv.firstName ? `${rv.firstName}'s Rig` : 'Rig'} — RVUnicorn</title>
        </Helmet>

        {/* Back link */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <Link to={`/profile/${username}`} className="text-[12px] flex items-center gap-1 hover:text-white transition" style={{ color: 'var(--muted)' }}>
            <ChevronLeft className="w-3.5 h-3.5" /> Back to profile
          </Link>
        </div>

        {/* ══ RIG HERO HEADER ══ */}
        <div ref={heroRef.ref} className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
          <div className="hero-glass overflow-hidden">
            <div className="grid md:grid-cols-2">
              {/* LEFT: Photo carousel */}
              <div className="relative aspect-[4/3] md:aspect-auto" style={{ background: 'var(--navy)', minHeight: '280px' }}>
                {rigPhotos.length > 0 ? (
                  <>
                    <img src={rigPhotos[photoIndex]} alt="RV" className="w-full h-full object-cover" />
                    {rigPhotos.length > 1 && (
                      <>
                        <button onClick={() => setPhotoIndex(i => (i - 1 + rigPhotos.length) % rigPhotos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60 transition"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={() => setPhotoIndex(i => (i + 1) % rigPhotos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60 transition"><ChevronRight className="w-4 h-4" /></button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {rigPhotos.map((_: string, i: number) => <div key={i} className="w-2 h-2 rounded-full transition" style={{ background: i === photoIndex ? 'var(--gold)' : 'rgba(255,255,255,0.3)' }} />)}
                        </div>
                      </>
                    )}
                    {/* Campfire glow behind */}
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 100%, var(--campfire-glow), transparent 70%)' }} />
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--navy), var(--navy-deep))' }}>
                    <Tent className="w-16 h-16 mb-3" style={{ color: 'rgba(201,168,76,0.3)' }} />
                    <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No rig photos yet</p>
                  </div>
                )}
              </div>

              {/* RIGHT: Rig identity */}
              <div className="p-7 lg:p-9 flex flex-col justify-center">
                <div className="flex items-start justify-between">
                  <div>
                    {rigName ? (
                      <h1 className="font-playfair text-[32px] font-bold italic leading-tight" style={{ color: 'var(--cream)' }}>{rigName}</h1>
                    ) : isOwnProfile ? (
                      <Link to="/my-rv" className="font-playfair text-[24px] font-bold italic" style={{ color: 'var(--gold)' }}>Name your rig →</Link>
                    ) : (
                      <h1 className="font-playfair text-[28px] font-bold" style={{ color: 'var(--cream)' }}>{rv.firstName}'s Rig</h1>
                    )}
                    {modelLine && <p className="text-[15px] mt-1" style={{ color: 'var(--muted)' }}>{modelLine}{rv.rvType && ` · ${rv.rvType}`}</p>}
                  </div>
                  {isOwnProfile && <Link to="/my-rv" className="text-[11px] font-medium px-3 py-1.5 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted)' }}>Edit Rig</Link>}
                </div>

                {/* Capability tags */}
                {capTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {capTags.map(t => <span key={t} className="text-[11px] px-3 py-1 rounded-full" style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--gold-light)', border: '1px solid rgba(201,168,76,0.15)' }}>{t}</span>)}
                  </div>
                )}

                {rig?.description && <p className="text-[13px] mt-4 leading-relaxed" style={{ color: 'var(--muted)' }}>{rig.description}</p>}

                {/* Lifetime stats */}
                <div className="grid grid-cols-4 gap-3 mt-6 pt-5" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <div className="text-center"><span className="font-playfair text-xl font-bold block">{trips.length}</span><span className="text-[10px] uppercase" style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>Trips</span></div>
                  <div className="text-center"><span className="font-playfair text-xl font-bold block">{trips.reduce((s, t) => s + daysBetween(t.startDate, t.endDate), 0)}</span><span className="text-[10px] uppercase" style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>Nights</span></div>
                  <div className="text-center"><span className="font-playfair text-xl font-bold block">{photos.length}</span><span className="text-[10px] uppercase" style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>Photos</span></div>
                  <div className="text-center"><span className="font-playfair text-xl font-bold block">{new Set(trips.map(t => t.location).filter(Boolean)).size}</span><span className="text-[10px] uppercase" style={{ color: 'var(--gold)', letterSpacing: '0.08em' }}>Places</span></div>
                </div>

                {/* Co-Pilots */}
                {(rig as any)?.coPilots?.length > 0 && (
                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <p className="text-[10px] font-semibold uppercase mb-3" style={{ color: 'rgba(245,240,232,0.4)', letterSpacing: '0.1em' }}>{'\u{1F699}'} Co-Pilots</p>
                    <div className="flex flex-wrap gap-2">
                      {(rig as any).coPilots.map((cp: any) => (
                        <Link key={cp.id} to={`/profile/${cp.username}`} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:brightness-110 transition" style={{ background: '#1B2E50' }}>
                          {cp.profilePicture ? (
                            <img src={cp.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>
                              {cp.firstName?.[0]}{cp.lastName?.[0]}
                            </div>
                          )}
                          <span className="text-[12px] font-medium" style={{ color: '#F5F0E8' }}>{cp.firstName} {cp.lastName}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mods toggle */}
                <button onClick={() => setShowMods(!showMods)} className="flex items-center gap-1.5 mt-4 text-[12px] font-medium" style={{ color: 'var(--gold)' }}>
                  {'\u{1F527}'} View Mods & Upgrades <ChevronDown className="w-3.5 h-3.5" style={{ transform: showMods ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
                </button>
              </div>
            </div>

            {/* Mods section (collapsible) */}
            {showMods && (
              <div className="px-7 pb-6" style={{ borderTop: '1px solid var(--glass-border)', animation: 'tabFade 200ms ease' }}>
                <div className="pt-4">
                  <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No mods logged yet. What have you done to make it yours?</p>
                  {isOwnProfile && <button className="mt-2 text-[12px] font-medium flex items-center gap-1" style={{ color: 'var(--campfire)' }}><Plus className="w-3.5 h-3.5" />Add Mod</button>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ TRIP MEMORY ALBUMS ══ */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 pb-12">
          <div className="text-center mb-8">
            <h2 className="font-playfair text-[26px] font-bold">Pursuit of Memories</h2>
            <p className="text-[14px] mt-1" style={{ color: 'var(--muted)' }}>Every trip. Every stop. Every moment.</p>
          </div>

          {tripAlbums.length > 0 ? (
            <div className="space-y-4">
              {tripAlbums.map(({ trip, photos: tripPhotos }) => (
                <div key={trip.id} className="flat-card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-playfair text-lg font-bold">{trip.title || trip.location || 'Trip'}</h3>
                      <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
                        {formatDate(trip.startDate)}
                        {trip.endDate && ` — ${formatDate(trip.endDate)}`}
                        {trip.endDate && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--gold-light)' }}>{daysBetween(trip.startDate, trip.endDate)} nights</span>}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <Link to={`/trips/${trip.id}`} className="text-[11px] font-medium flex items-center gap-1" style={{ color: 'var(--campfire)' }}>
                        <Plus className="w-3.5 h-3.5" />Add Photos
                      </Link>
                    )}
                  </div>

                  {trip.location && <p className="text-[12px] mb-3" style={{ color: 'var(--cream)' }}>{'\u{1F4CD}'} {trip.location}</p>}

                  {/* Photo strip */}
                  {tripPhotos.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {tripPhotos.slice(0, 5).map((photo, i) => (
                        <div key={photo.id} className="flex-shrink-0 relative">
                          <img src={photo.imageUrl} alt={photo.caption || ''} className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg object-cover" />
                          {i === 4 && tripPhotos.length > 5 && (
                            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                              <span className="text-sm font-bold">+{tripPhotos.length - 5}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] py-3" style={{ color: 'var(--muted)' }}>No photos from this trip yet.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flat-card p-10 text-center" style={{ background: 'var(--campfire-glow)' }}>
              <span className="text-4xl block mb-3">{'\u{1F3D5}'}</span>
              <h3 className="font-playfair text-xl font-bold mb-1">Your rig has a story — start telling it.</h3>
              <p className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Check in on your next trip and photos will appear here automatically.</p>
              <Link to="/trips/new" className="inline-block px-6 py-2.5 rounded-full text-[13px] font-semibold" style={{ background: 'var(--campfire)', color: 'white' }}>Plan a Trip</Link>
            </div>
          )}

          {/* Untagged photos */}
          {untaggedPhotos.length > 0 && (
            <details className="flat-card overflow-hidden mt-4">
              <summary className="px-5 py-3 cursor-pointer text-[13px] font-medium flex items-center gap-2" style={{ color: 'var(--cream)' }}>
                {'\u{1F4F8}'} Other Memories ({untaggedPhotos.length} photos)
              </summary>
              <div className="px-5 pb-5">
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-2">
                  {untaggedPhotos.slice(0, 18).map(p => (
                    <img key={p.id} src={p.imageUrl} alt="" className="aspect-square rounded-lg object-cover" />
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
