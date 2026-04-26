import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MapPin, Camera, Award, Truck } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import GateModal from '../../components/public/GateModal';
import { useGate } from '../../hooks/useGate';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552', success: '#4CAF82' };

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { requireAuth, gateModalProps } = useGate();

  useEffect(() => {
    if (!username) return;
    api.get(`/public/users/${username}`)
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="w-20 h-20 rounded-full mx-auto animate-pulse" style={{ background: CN.card }} />
          <div className="h-6 w-40 mx-auto rounded mt-4 animate-pulse" style={{ background: CN.card }} />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-lg font-semibold" style={{ color: CN.cream }}>Profile not found</p>
          <Link to="/" className="inline-block mt-6 px-6 py-3 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>
            Explore RVUnicorn
          </Link>
        </div>
      </div>
    );
  }

  const isFoundingMember = profile.badges?.some((b: any) => b.badge?.name?.toLowerCase().includes('founding'));

  return (
    <>
      <Helmet>
        <title>{profile.firstName} {profile.lastName} · RVUnicorn Member</title>
        <meta name="description" content={`${profile.firstName} has visited ${profile.statesVisited?.length || 0} states and logged ${profile.tripCount || 0} trips${profile.rvMake ? ` in their ${profile.rvMake} ${profile.rvModel || ''}` : ''}. See their adventures on RVUnicorn.`} />
        <meta property="og:title" content={`${profile.firstName} ${profile.lastName} · RVUnicorn`} />
        {profile.profilePicture && <meta property="og:image" content={profile.profilePicture} />}
        <meta property="og:url" content={`https://www.rvunicorn.com/u/${username}`} />
        <link rel="canonical" href={`https://www.rvunicorn.com/u/${username}`} />
      </Helmet>

      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-center">
          {/* Avatar */}
          {profile.profilePicture ? (
            <img src={profile.profilePicture} alt="" className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-2" style={{ borderColor: CN.gold }} />
          ) : (
            <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold" style={{ background: CN.gold, color: CN.bg }}>
              {profile.firstName?.[0]}{profile.lastName?.[0]}
            </div>
          )}

          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: CN.cream }}>
            {profile.firstName} {profile.lastName}
          </h1>

          {/* RV info */}
          {(profile.rvType || profile.rvMake) && (
            <p className="text-sm flex items-center justify-center gap-1.5 mb-2" style={{ color: CN.muted }}>
              <Truck className="w-4 h-4" />
              {profile.rvYear ? `${profile.rvYear} ` : ''}{profile.rvMake || ''} {profile.rvModel || ''}
            </p>
          )}

          <p className="text-xs mb-6" style={{ color: CN.muted }}>
            Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>

          {/* Follow button */}
          <button
            onClick={() => requireAuth('follow_user', { targetName: profile.firstName }, () => {})}
            className="px-6 py-2.5 rounded-xl text-sm font-bold transition hover:brightness-110 mb-8"
            style={{ background: CN.gold, color: CN.bg }}
          >
            Follow {profile.firstName}
          </button>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Trips', value: profile.tripCount || 0, icon: '🗺️' },
              { label: 'Check-ins', value: profile.checkInCount || 0, icon: '📍' },
              { label: 'Photos', value: profile.photoCount || 0, icon: '📸' },
              { label: 'States', value: profile.statesVisited?.length || 0, icon: '🏕️' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                <span className="text-lg">{s.icon}</span>
                <p className="text-xl font-bold mt-1" style={{ color: CN.cream }}>{s.value}</p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: CN.muted }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Badges */}
          {profile.badges?.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Award className="w-4 h-4" style={{ color: CN.gold }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: CN.muted }}>
                  {profile.badgeCount || profile.badges.length} Badge{(profile.badgeCount || profile.badges.length) !== 1 ? 's' : ''} Earned
                </span>
              </div>
              <div className="flex justify-center gap-2">
                {profile.badges.slice(0, 3).map((b: any, i: number) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-full" style={{ background: `${CN.gold}15`, color: CN.gold, border: `1px solid ${CN.gold}30` }}>
                    {b.badge?.icon || '🏆'} {b.badge?.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* States visited map placeholder */}
          {profile.statesVisited?.length > 0 && (
            <div className="rounded-xl p-4 mb-8" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: CN.muted }}>States Visited</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {profile.statesVisited.map((s: any) => (
                  <span key={s.state} className="text-[10px] px-2 py-1 rounded-full font-semibold" style={{ background: `${CN.gold}20`, color: CN.gold }}>
                    {s.state}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Founding Member card */}
          {isFoundingMember && (
            <div className="rounded-xl p-5 mb-8 text-left" style={{ background: CN.cardAlt, border: `1px solid ${CN.gold}` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🏆</span>
                <span className="text-sm font-bold" style={{ color: CN.gold }}>Founding Member</span>
              </div>
              <p className="text-sm mb-3" style={{ color: CN.cream }}>
                {profile.firstName} joined RVUnicorn as a Founding Member.
              </p>
              <p className="text-xs mb-3" style={{ color: CN.muted }}>
                Founding Member status is still available — free to claim.
              </p>
              <Link to="/register" className="inline-block px-4 py-2 rounded-lg text-xs font-bold transition hover:brightness-110" style={{ background: CN.gold, color: CN.bg }}>
                Claim Your Founding Member Status →
              </Link>
            </div>
          )}

          {/* Footer CTA */}
          <div className="p-6 rounded-2xl" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
            <p className="text-lg font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: CN.cream }}>
              Join the RV community
            </p>
            <p className="text-sm mb-4" style={{ color: CN.muted }}>
              Plan trips, find campgrounds, and connect with RVers like {profile.firstName}.
            </p>
            <Link to="/register" className="inline-block px-6 py-3 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>
              Join RVUnicorn — It's Free
            </Link>
          </div>
        </div>
      </div>

      <GateModal {...gateModalProps} />
    </>
  );
}
