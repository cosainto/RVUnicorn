import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MapPin, Users } from 'lucide-react';

export default function JoinCrewPage() {
  const [params] = useSearchParams();
  const ref = params.get('ref') || '';
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref) { setLoading(false); return; }
    fetch(`/api/sharing/public-profile/${ref}`).then(r => r.json()).then(d => {
      if (!d.error) setProfile(d);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [ref]);

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1C35' }}><div className="animate-spin w-10 h-10 border-b-2 rounded-full" style={{ borderColor: '#E8A838' }} /></div>;

  return (
    <>
      <Helmet>
        <title>{profile ? `${profile.displayName} invited you to RVUnicorn` : 'Join RVUnicorn'}</title>
        <meta property="og:title" content={profile ? `${profile.displayName} invited you` : 'Join RVUnicorn'} />
        <meta property="og:description" content="The campfire community built for the road. Join free." />
        {profile?.avatarUrl && <meta property="og:image" content={profile.avatarUrl} />}
      </Helmet>

      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(232,98,42,0.08) 0%, transparent 60%), #0F1C35', fontFamily: "'DM Sans',sans-serif" }}>

        {/* Logo */}
        <Link to="/">
          <img src="/images/logo-icon-v2.png" alt="RVUnicorn" className="w-12 h-12 rounded-full mx-auto mb-4 border-2" style={{ borderColor: '#E8A838' }} />
        </Link>

        {profile ? (
          <>
            <p className="text-[13px] mb-6" style={{ color: '#E8A838' }}>You've been invited by {profile.displayName}</p>

            {/* Referrer card */}
            <div className="w-full max-w-sm rounded-2xl p-6 mb-6 text-center" style={{ background: 'rgba(27,46,80,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(201,168,76,0.18)' }}>
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-3 border-2" style={{ borderColor: '#E8A838' }} />
              : <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold" style={{ background: '#E8A838', color: '#0F1C35' }}>{profile.displayName[0]}</div>}

              <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Playfair Display',serif", color: '#F5F0E8' }}>{profile.displayName}</h2>

              {/* Stats */}
              <div className="flex justify-center gap-4 mb-3">
                <span className="text-[12px]" style={{ color: '#E8A838' }}>{profile.stateCount} states</span>
                <span className="text-[12px]" style={{ color: 'rgba(245,240,232,0.4)' }}>·</span>
                <span className="text-[12px]" style={{ color: '#E8A838' }}>{profile.checkinCount} check-ins</span>
                <span className="text-[12px]" style={{ color: 'rgba(245,240,232,0.4)' }}>·</span>
                <span className="text-[12px]" style={{ color: '#E8A838' }}>{profile.friendCount} friends</span>
              </div>

              {/* State dots */}
              {profile.visitedStates?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mb-3">
                  {profile.visitedStates.slice(0, 20).map((st: string) => (
                    <span key={st} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(232,168,56,0.1)', color: '#E8A838' }}>{st}</span>
                  ))}
                  {profile.visitedStates.length > 20 && <span className="text-[9px]" style={{ color: 'rgba(245,240,232,0.3)' }}>+{profile.visitedStates.length - 20} more</span>}
                </div>
              )}

              {/* Rig */}
              {profile.rvType && <p className="text-[11px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Travels in a {profile.rvType}</p>}

              {/* Currently at */}
              {profile.currentCampground && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10B981' }} />
                  <span className="text-[11px]" style={{ color: '#10B981' }}>{'\u{1F3D5}'} At {profile.currentCampground.name}, {profile.currentCampground.state}</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold text-center mb-2" style={{ fontFamily: "'Playfair Display',serif", color: '#F5F0E8' }}>
              Join {profile.displayName.split(' ')[0]} on the road.
            </h1>
            <p className="text-[14px] text-center mb-6 max-w-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
              See their routes, get notified when they're camping near you, and plan trips together.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-center mb-2" style={{ fontFamily: "'Playfair Display',serif", color: '#F5F0E8' }}>
              Find your herd.
            </h1>
            <p className="text-[14px] text-center mb-6 max-w-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
              The campfire community built for the road. Plan trips, meet people, and turn every stop into something shared.
            </p>
          </>
        )}

        {/* CTA */}
        <Link to={`/register${ref ? `?ref=${ref}` : ''}`} className="w-full max-w-sm block py-3.5 rounded-xl text-[16px] font-bold text-center mb-3" style={{ background: '#D4621A', color: '#F5F0E8' }}>
          {'\u{1F984}'} Join RVUnicorn Free
        </Link>
        <Link to="/login" className="text-[13px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Already have an account? <span style={{ color: '#E8A838' }}>Sign in</span></Link>

        {/* Value props */}
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          {[
            ['\u{1F3D5}', '16,000+ campgrounds'],
            ['\u{1F525}', 'Live campfire chat'],
            ['\u{1F5FA}', 'Smart trip planning'],
          ].map(([icon, text]) => (
            <span key={text as string} className="text-[12px] flex items-center gap-1.5" style={{ color: 'rgba(245,240,232,0.35)' }}>{icon} {text}</span>
          ))}
        </div>

        <p className="text-[11px] mt-6" style={{ color: 'rgba(245,240,232,0.2)' }}>No credit card. Free forever.</p>
      </div>
    </>
  );
}
