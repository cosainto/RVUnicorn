import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Camera, ChefHat, Users, Copy, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Helmet } from 'react-helmet-async';

export default function PublicTripViewPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth() as any;
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showConversion, setShowConversion] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${slug}/public`).then(r => r.json()).then(d => {
      if (d.error) setTrip(null); else setTrip(d);
    }).catch(() => setTrip(null)).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1C35' }}><div className="animate-spin w-10 h-10 border-b-2 rounded-full" style={{ borderColor: '#E8A838' }} /></div>;
  if (!trip) return <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0F1C35', color: '#F5F0E8' }}><p className="text-lg font-bold">This trip is private</p><Link to="/" className="text-sm" style={{ color: '#E8A838' }}>Go to RVUnicorn →</Link></div>;

  const heroPhoto = trip.stops[0]?.campground?.imageUrl || trip.photos[0]?.imageUrl || '';
  const isActive = trip.trip.isActive;
  const isCompleted = trip.trip.isCompleted;
  const days = trip.stats.nightsCamped;

  return (
    <>
      <Helmet>
        <title>{trip.trip.name} — {trip.owner.displayName}'s RV Trip on RVUnicorn</title>
        <meta property="og:title" content={trip.trip.name} />
        <meta property="og:description" content={`${trip.owner.displayName} is on a ${days}-day RV trip. Follow along on RVUnicorn.`} />
        {heroPhoto && <meta property="og:image" content={heroPhoto} />}
      </Helmet>

      <div className="min-h-screen" style={{ background: '#0F1C35', color: '#F5F0E8', fontFamily: "'DM Sans',sans-serif", paddingBottom: user ? 0 : '80px' }}>

        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden" style={{ height: '65vh', minHeight: '400px' }}>
          {heroPhoto && <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ animation: 'kenBurns 10s ease-in-out infinite' }} />}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0F1C35 0%, transparent 50%)' }} />

          {/* Logo */}
          <Link to="/" className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <img src="/images/Logo_RVUnicorn.png" alt="" className="w-8 h-8 rounded-full" />
            <span className="text-sm font-bold" style={{ color: '#E8A838' }}>RVUnicorn</span>
          </Link>

          {/* Live badge */}
          {isActive && trip.trip.ghostModeEnabled && (
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold" style={{ background: 'rgba(212,98,26,0.9)', color: '#F5F0E8' }}>
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> LIVE TRIP
            </div>
          )}

          {isCompleted && (
            <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full text-[12px]" style={{ background: 'rgba(232,168,56,0.15)', color: '#E8A838' }}>
              Trip completed
            </div>
          )}

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: "'Playfair Display',serif", textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{trip.trip.name}</h1>
            <div className="flex items-center gap-3 mb-2">
              {trip.owner.avatarUrl ? <img src={trip.owner.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: '#E8A838' }} /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#E8A838', color: '#0F1C35' }}>{trip.owner.displayName[0]}</div>}
              <span className="text-[14px]" style={{ color: 'rgba(245,240,232,0.8)' }}>A trip by {trip.owner.displayName}</span>
            </div>
            <p className="text-[13px]" style={{ color: 'rgba(245,240,232,0.5)' }}>
              {new Date(trip.trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(trip.trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {days} days
            </p>
            <p className="text-[13px] mt-1" style={{ color: '#E8A838' }}>{trip.stats.stopsCount} stops · {trip.stats.statesVisited} states</p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 space-y-8 mt-6">

          {/* ═══ LIVE BASECAMP ═══ */}
          {isActive && trip.currentBasecamp && (
            <div className="rounded-xl p-5 flex items-center gap-4" style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.2)' }}>
              <span className="text-2xl">{'\u{1F525}'}</span>
              <div>
                <p className="text-[16px] font-bold">{trip.owner.displayName} is camped at {trip.currentBasecamp.campgroundName}</p>
                <p className="text-[13px]" style={{ color: 'rgba(245,240,232,0.5)' }}>{trip.currentBasecamp.city}, {trip.currentBasecamp.state}</p>
              </div>
            </div>
          )}

          {/* ═══ CAMPGROUND STOPS ═══ */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "'Playfair Display',serif" }}>The Stops</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {trip.stops.map((stop: any, i: number) => (
                <div key={i} className="rounded-[14px] overflow-hidden" style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.1)' }}>
                  <div className="relative h-[200px]" style={{ background: 'linear-gradient(135deg, #1B2E50, #0F1C35)' }}>
                    {stop.campground?.imageUrl && <img src={stop.campground.imageUrl} alt="" className="w-full h-full object-cover" />}
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{
                      background: stop.status === 'visited' ? 'rgba(46,204,113,0.9)' : stop.status === 'current' ? 'rgba(212,98,26,0.9)' : 'rgba(232,168,56,0.7)',
                      color: '#F5F0E8',
                    }}>{stop.status === 'visited' ? 'Visited ✓' : stop.status === 'current' ? 'Here Now 🔥' : 'Coming Up'}</span>
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] uppercase mb-1" style={{ color: '#E8A838', letterSpacing: '0.08em' }}>Stop {stop.number} of {stop.total}</p>
                    <p className="text-[16px] font-bold">{stop.campground?.name || 'Unknown Stop'}</p>
                    <p className="text-[13px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{stop.campground?.city || stop.campground?.location}, {stop.campground?.state}</p>
                    <p className="text-[12px] mt-1" style={{ color: 'rgba(245,240,232,0.3)' }}>
                      {new Date(stop.dates.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(stop.dates.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    {stop.campground?.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {stop.campground.amenities.slice(0, 4).map((a: string, j: number) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,168,56,0.08)', color: '#E8C96A', border: '1px solid rgba(232,168,56,0.15)' }}>{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ PHOTO WALL ═══ */}
          {trip.photos.length >= 3 && (
            <div>
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "'Playfair Display',serif" }}>Along the Way</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {trip.photos.slice(0, 12).map((p: any, i: number) => (
                  <img key={p.id} src={p.imageUrl} alt="" className="rounded-lg object-cover aspect-square cursor-pointer hover:brightness-110 transition"
                    onClick={() => setLightboxIdx(i)} />
                ))}
              </div>
            </div>
          )}

          {/* ═══ CAMP KITCHEN ═══ */}
          {trip.recipes.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "'Playfair Display',serif" }}>What's Cooking</h2>
              <p className="text-[13px] mb-4" style={{ color: 'rgba(245,240,232,0.4)' }}>Recipes from this trip</p>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {trip.recipes.map((r: any, i: number) => (
                  <div key={i} className="flex-shrink-0 w-[200px] rounded-xl p-4" style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.1)' }}>
                    <span className="text-2xl mb-2 block" style={{ color: '#E8A838' }}>{'\u{1F468}\u200D\u{1F373}'}</span>
                    <p className="text-[14px] font-bold mb-1">{r.name}</p>
                    <p className="text-[12px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{r.campground || 'On the road'}</p>
                    <p className="text-[12px] italic mt-2" style={{ color: 'rgba(245,240,232,0.3)', filter: 'blur(2px)' }}>Ingredients and steps inside →</p>
                    <button onClick={() => user ? null : setShowConversion(true)} className="mt-2 w-full py-1.5 rounded-lg text-[12px] font-medium" style={{ background: 'rgba(232,168,56,0.12)', border: '1px solid rgba(232,168,56,0.3)', color: '#E8A838' }}>
                      See Recipe
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ CREW ═══ */}
          {trip.crew.length >= 2 && (
            <div>
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "'Playfair Display',serif" }}>The Crew</h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {trip.crew.map((c: any, i: number) => (
                  <div key={i} className="flex-shrink-0 text-center">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="w-[52px] h-[52px] rounded-full object-cover mx-auto border-2" style={{ borderColor: '#E8A838' }} /> : <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center mx-auto text-lg font-bold" style={{ background: '#E8A838', color: '#0F1C35' }}>{c.displayName[0]}</div>}
                    <p className="text-[12px] font-medium mt-1">{c.displayName}</p>
                  </div>
                ))}
                {!user && <div className="flex-shrink-0 flex items-center"><button onClick={() => setShowConversion(true)} className="text-[12px]" style={{ color: 'rgba(232,168,56,0.5)' }}>+ Join the crew</button></div>}
              </div>
            </div>
          )}

          {/* ═══ TRIP SUMMARY (completed) ═══ */}
          {isCompleted && (
            <div className="rounded-xl p-5" style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.15)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: '#E8A838' }}>Trip Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><span className="text-2xl font-bold block" style={{ fontFamily: "'Playfair Display',serif" }}>{days}</span><span className="text-[11px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Nights</span></div>
                <div><span className="text-2xl font-bold block" style={{ fontFamily: "'Playfair Display',serif" }}>{trip.stats.stopsCount}</span><span className="text-[11px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Stops</span></div>
                <div><span className="text-2xl font-bold block" style={{ fontFamily: "'Playfair Display',serif" }}>{trip.stats.statesVisited}</span><span className="text-[11px]" style={{ color: 'rgba(245,240,232,0.4)' }}>States</span></div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ STICKY CONVERSION BAR (non-auth only) ═══ */}
        {!user && (
          <div className="fixed bottom-0 left-0 right-0 z-[100] flex items-center justify-between px-4 py-3" style={{ background: '#0F1C35', borderTop: '1px solid rgba(232,168,56,0.2)', height: '72px' }}>
            <div className="flex items-center gap-3">
              <img src="/images/Logo_RVUnicorn.png" alt="" className="w-8 h-8 rounded-full" />
              <div>
                <p className="text-[14px] font-bold">Join the crew</p>
                <p className="text-[13px]" style={{ color: 'rgba(245,240,232,0.6)' }}>Follow along and plan your own adventure</p>
              </div>
            </div>
            <button onClick={() => setShowConversion(true)} className="px-6 py-2.5 rounded-full text-[14px] font-bold" style={{ background: '#D4621A', color: '#F5F0E8' }}>Join Free</button>
          </div>
        )}

        {/* ═══ CONVERSION MODAL ═══ */}
        {showConversion && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }} onClick={() => setShowConversion(false)}>
            <div className="w-full max-w-[500px] rounded-[20px] overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.2)' }} onClick={e => e.stopPropagation()}>
              {heroPhoto && <div className="h-[200px] relative"><img src={heroPhoto} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0F1C35, transparent)' }} /></div>}
              <div className="p-6 text-center">
                <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display',serif" }}>You found your people.</h2>
                <p className="text-[14px] mb-5" style={{ color: 'rgba(245,240,232,0.6)' }}>Join {trip.owner.displayName} and thousands of RVers on RVUnicorn.</p>
                <div className="space-y-3 text-left mb-6">
                  {[
                    ['\u{1F5FA}', 'Follow live trips from friends and the community'],
                    ['\u{1F373}', 'Access full recipes, routes, and campground details'],
                    ['\u{1F525}', 'Find your crew and plan trips together'],
                  ].map(([icon, text]) => (
                    <div key={text as string} className="flex items-center gap-3"><span className="text-lg">{icon}</span><span className="text-[13px]" style={{ color: 'rgba(245,240,232,0.7)' }}>{text}</span></div>
                  ))}
                </div>
                <Link to={`/register?ref=trip&tripSlug=${slug}&sharer=${trip.owner.username}`} className="block w-full py-3.5 rounded-xl text-[16px] font-bold text-center" style={{ background: '#D4621A', color: '#F5F0E8' }}>Create Free Account</Link>
                <Link to="/login" className="block w-full py-3 rounded-xl text-[14px] font-medium text-center mt-2" style={{ border: '1px solid rgba(232,168,56,0.3)', color: '#E8A838' }}>Sign In</Link>
                <p className="text-[11px] mt-3" style={{ color: 'rgba(245,240,232,0.3)' }}>No credit card. Free forever.</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ LIGHTBOX ═══ */}
        {lightboxIdx !== null && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90" onClick={() => setLightboxIdx(null)}>
            <button onClick={() => setLightboxIdx(null)} className="absolute top-4 right-4 z-10"><X className="w-6 h-6" style={{ color: 'rgba(245,240,232,0.5)' }} /></button>
            {lightboxIdx > 0 && <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i || 0) - 1); }} className="absolute left-4 text-3xl" style={{ color: 'rgba(245,240,232,0.5)' }}>‹</button>}
            {lightboxIdx < trip.photos.length - 1 && <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i || 0) + 1); }} className="absolute right-4 text-3xl" style={{ color: 'rgba(245,240,232,0.5)' }}>›</button>}
            <img src={trip.photos[lightboxIdx]?.imageUrl} alt="" className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          </div>
        )}

        <style>{`@keyframes kenBurns{0%{transform:scale(1)}100%{transform:scale(1.06)}}`}</style>
      </div>
    </>
  );
}
