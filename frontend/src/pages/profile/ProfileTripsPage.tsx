import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Calendar, Moon, MapPin } from 'lucide-react';
import AlbumPhotoGrid from '../../components/AlbumPhotoGrid';
import api from '../../services/api';

const CN = { bg: '#0F1C35', body: '#1E2D42', card: '#162236', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

type SortMode = 'recent' | 'longest' | 'campgrounds';

export default function ProfileTripsPage() {
  const { username } = useParams<{ username: string }>();
  const [trips, setTrips] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>('recent');

  useEffect(() => {
    if (!username) return;
    Promise.all([
      api.get(`/profile/${username}/trips`).catch(() => ({ data: [] })),
      api.get(`/profile/${username}`).catch(() => ({ data: null })),
    ]).then(([tripsRes, profileRes]) => {
      setTrips(Array.isArray(tripsRes.data) ? tripsRes.data : (tripsRes.data?.trips || []));
      setProfile(profileRes.data);
      setLoading(false);
    });
  }, [username]);

  const sorted = [...trips].sort((a, b) => {
    if (sort === 'longest') return (b.nightsCount || 0) - (a.nightsCount || 0);
    if (sort === 'campgrounds') return (b.campgroundCount || 0) - (a.campgroundCount || 0);
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const totalNights = trips.reduce((s, t) => s + (t.nightsCount || 0), 0);
  const stateSet = new Set(trips.map(t => t.campgroundState).filter(Boolean));

  return (
    <>
      <Helmet>
        <title>{profile?.firstName || username}'s Trips · RVUnicorn</title>
      </Helmet>

      <div style={{ background: CN.body, minHeight: '100vh', color: CN.cream }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <Link to={`/profile/${username}`} className="p-2 rounded-lg transition hover:bg-white/5" style={{ color: CN.muted }}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {profile?.firstName || username}'s Adventures
            </h1>
          </div>

          {/* Stats bar */}
          <div className="flex gap-4 text-xs mb-6 ml-12" style={{ color: CN.muted }}>
            <span>{trips.length} trips</span>
            <span>·</span>
            <span>{totalNights} nights</span>
            <span>·</span>
            <span>{stateSet.size} states</span>
          </div>

          {/* Sort toggle */}
          <div className="flex gap-2 mb-6">
            {(['recent', 'longest', 'campgrounds'] as SortMode[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={{
                  background: sort === s ? `${CN.gold}20` : 'transparent',
                  color: sort === s ? CN.gold : CN.muted,
                  border: `1px solid ${sort === s ? CN.gold : CN.border}`,
                }}
              >
                {s === 'recent' ? 'Recent' : s === 'longest' ? 'Longest' : 'Most Campgrounds'}
              </button>
            ))}
          </div>

          {/* Trip grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl overflow-hidden" style={{ background: CN.card }}>
                  <div className="h-48 animate-pulse" style={{ background: CN.border }} />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-48 rounded animate-pulse" style={{ background: CN.border }} />
                    <div className="h-3 w-32 rounded animate-pulse" style={{ background: CN.border }} />
                  </div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold mb-2">No trips yet</p>
              <Link to="/events-v2/create" className="inline-block px-6 py-3 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>
                Plan Your First Trip
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sorted.map(trip => {
                const coverImg = trip.coverImage || trip.campgroundImageUrl;
                const nights = trip.nightsCount || 0;
                return (
                  <Link
                    key={trip.id}
                    to={`/trips/${trip.id}`}
                    className="rounded-2xl overflow-hidden transition hover:brightness-110 group"
                    style={{ background: CN.card, border: `1px solid ${CN.border}` }}
                  >
                    {/* Photo Grid */}
                    <div className="relative">
                      <AlbumPhotoGrid
                        photos={trip.coverPhotos || (coverImg ? [coverImg] : [])}
                        totalPhotoCount={trip.totalPhotoCount || (coverImg ? 1 : 0)}
                        campgroundName={trip.campgroundName}
                        campgroundPhoto={trip.campgroundImageUrl}
                      />
                      {nights > 0 && (
                        <span className="absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-bold z-10" style={{ background: `${CN.gold}20`, color: CN.gold }}>
                          <Moon className="w-3 h-3 inline mr-0.5" />{nights} nights
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="text-sm font-bold mb-1 group-hover:text-amber-400 transition" style={{ color: CN.cream }}>
                        {trip.title || `${trip.campgroundName || 'Trip'}${trip.campgroundState ? `, ${trip.campgroundState}` : ''}`}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px]" style={{ color: CN.muted }}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {trip.campgroundName && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {trip.campgroundName}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
