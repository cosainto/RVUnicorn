import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, MapPin, Star } from 'lucide-react';
import api from '../../services/api';

const CN = { bg: '#0F1C35', body: '#1E2D42', card: '#162236', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

export default function ProfileCampgroundsPage() {
  const { username } = useParams<{ username: string }>();
  const [campgrounds, setCampgrounds] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    Promise.all([
      api.get(`/profile/${username}/campgrounds-visited`).catch(() => ({ data: [] })),
      api.get(`/profile/${username}`).catch(() => ({ data: null })),
    ]).then(([cgRes, profileRes]) => {
      setCampgrounds(Array.isArray(cgRes.data) ? cgRes.data : (cgRes.data?.campgrounds || []));
      setProfile(profileRes.data);
      setLoading(false);
    });
  }, [username]);

  const stateSet = new Set(campgrounds.map(c => c.state).filter(Boolean));
  const totalCheckins = campgrounds.reduce((s, c) => s + (c.visitCount || 1), 0);

  // Group by state
  const grouped = campgrounds.reduce((acc: Record<string, any[]>, c) => {
    const s = c.state || 'Unknown';
    if (!acc[s]) acc[s] = [];
    acc[s].push(c);
    return acc;
  }, {});

  return (
    <>
      <Helmet>
        <title>{profile?.firstName || username}'s Campgrounds · RVUnicorn</title>
      </Helmet>

      <div style={{ background: CN.body, minHeight: '100vh', color: CN.cream }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <Link to={`/profile/${username}`} className="p-2 rounded-lg transition hover:bg-white/5" style={{ color: CN.muted }}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {profile?.firstName || username}'s Campgrounds
            </h1>
          </div>

          <div className="flex gap-4 text-xs mb-6 ml-12" style={{ color: CN.muted }}>
            <span>{campgrounds.length} campgrounds</span>
            <span>·</span>
            <span>{stateSet.size} states</span>
            <span>·</span>
            <span>{totalCheckins} check-ins</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="rounded-xl overflow-hidden" style={{ background: CN.card }}>
                  <div className="aspect-square animate-pulse" style={{ background: CN.border }} />
                  <div className="p-2"><div className="h-3 w-20 rounded animate-pulse" style={{ background: CN.border }} /></div>
                </div>
              ))}
            </div>
          ) : campgrounds.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold mb-2">No campgrounds visited yet</p>
              <Link to="/campgrounds" className="inline-block px-6 py-3 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>
                Explore Campgrounds
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length).map(([state, cgs]) => (
                <div key={state}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: CN.gold }}>
                    {state} ({cgs.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {cgs.map((cg: any) => (
                      <Link
                        key={cg.campgroundId}
                        to={`/campgrounds/${cg.campgroundId}`}
                        className="rounded-xl overflow-hidden transition hover:brightness-110"
                        style={{ background: CN.card, border: `1px solid ${CN.border}` }}
                      >
                        <div className="aspect-square relative">
                          {(cg.userPhoto || cg.imageUrl) ? (
                            <img src={cg.userPhoto || cg.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: CN.border }}>
                              {cg.name?.[0] || '🏕️'}
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-semibold truncate" style={{ color: CN.cream }}>{cg.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px]" style={{ color: CN.muted }}>
                              <MapPin className="w-2.5 h-2.5 inline" /> {cg.state}
                            </span>
                            {cg.userRating && (
                              <span className="text-[10px]" style={{ color: CN.gold }}>
                                <Star className="w-2.5 h-2.5 inline fill-current" /> {cg.userRating}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
