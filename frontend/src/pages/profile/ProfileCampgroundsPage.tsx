import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, MapPin, Star, Heart, Search, MessageCircle, Calendar, Moon, Edit } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const CN = { bg: '#0F1C35', body: '#1E2D42', card: '#162236', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface CampgroundStay {
  campgroundId: string;
  name: string;
  city?: string;
  state?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  parkType?: string;
  visitCount: number;
  totalNights: number;
  firstVisit?: string;
  lastVisit?: string;
  lastVisitEnd?: string;
  siteNumbers: string[];
  isFavorite: boolean;
  userRating: number | null;
  userReview: string | null;
  wouldReturn: string | null;
}

interface Stats {
  totalCampgrounds: number;
  totalStates: number;
  totalNights: number;
  avgRating: number | null;
  mostVisited: { name: string; visitCount: number } | null;
  favoriteState: string | null;
  peakSeason: string | null;
  campingStyle: string;
  sinceYear: number;
}

interface Badge {
  id: string;
  emoji: string;
  label: string;
  earned: boolean;
  progress: string | null;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtShort = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function ProfileCampgroundsPage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const [campgrounds, setCampgrounds] = useState<CampgroundStay[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'rated' | 'revisited' | 'recent'>('all');

  const isOwner = currentUser?.username === username;

  useEffect(() => {
    if (!username) return;
    Promise.all([
      api.get(`/profile/${username}/campgrounds-visited`).catch(() => ({ data: { campgrounds: [], stats: null, badges: [], insights: [] } })),
      api.get(`/profile/${username}`).catch(() => ({ data: null })),
    ]).then(([cgRes, profileRes]) => {
      const data = cgRes.data;
      setCampgrounds(data.campgrounds || []);
      setStats(data.stats || null);
      setBadges(data.badges || []);
      setInsights(data.insights || []);
      setProfile(profileRes.data);
      setLoading(false);
    });
  }, [username]);

  const filtered = useMemo(() => {
    let list = campgrounds;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.state?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q));
    }
    if (filter === 'favorites') list = list.filter(c => c.isFavorite);
    if (filter === 'rated') list = list.filter(c => c.userRating);
    if (filter === 'revisited') list = list.filter(c => c.visitCount > 1);
    if (filter === 'recent') {
      const sixMonths = Date.now() - 180 * 86400000;
      list = list.filter(c => c.lastVisit && new Date(c.lastVisit).getTime() > sixMonths);
    }
    return list;
  }, [campgrounds, search, filter]);

  const firstName = profile?.firstName || username;
  const earnedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);

  if (loading) {
    return (
      <div style={{ background: CN.body, minHeight: '100vh', color: CN.cream }}>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-48 rounded-2xl" style={{ background: CN.bg }} />
            <div className="grid grid-cols-2 gap-4">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-64 rounded-xl" style={{ background: CN.card }} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{firstName}'s Camping History · RVUnicorn</title>
        <meta name="description" content={`${firstName} has stayed at ${stats?.totalCampgrounds || 0} campgrounds across ${stats?.totalStates || 0} states. See their full camping history, ratings, and tips on RVUnicorn.`} />
      </Helmet>

      <div style={{ background: CN.body, minHeight: '100vh', color: CN.cream }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

          {/* Back link */}
          <Link to={`/profile/${username}`} className="inline-flex items-center gap-1.5 text-sm mb-4 transition hover:opacity-80" style={{ color: CN.muted }}>
            <ArrowLeft className="w-4 h-4" /> Back to profile
          </Link>

          {campgrounds.length === 0 ? (
            /* ── EMPTY STATE ── */
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🏕️</div>
              <p className="text-lg font-semibold mb-2">No confirmed campground stays yet</p>
              <p className="text-sm mb-6" style={{ color: CN.muted }}>
                {isOwner ? 'Check in at your next campground to start your camping history!' : `${firstName} hasn't logged any campground stays yet.`}
              </p>
              {isOwner && (
                <Link to="/campgrounds" className="inline-block px-6 py-3 rounded-xl text-sm font-bold transition hover:brightness-110" style={{ background: CN.gold, color: CN.bg }}>
                  Find Campgrounds →
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* ══════════════════════════════════════════════════════════════
                 SECTION 1 — NARRATIVE HERO
              ══════════════════════════════════════════════════════════════ */}
              <div className="rounded-2xl p-6 sm:p-8 mb-6" style={{ background: CN.bg, border: `1px solid ${CN.border}` }}>
                <h1 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: CN.muted }}>
                  {firstName}'s Camping Journey
                </h1>
                <p className="text-xl sm:text-2xl font-bold leading-snug mb-5" style={{ fontFamily: "'Playfair Display', serif", color: CN.gold }}>
                  {firstName} has spent {stats?.totalNights || 0} nights camping across {stats?.totalStates || 0} states{stats?.sinceYear ? ` since ${stats.sinceYear}` : ''}.
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { emoji: '🏕️', value: stats?.totalCampgrounds || 0, label: 'Campgrounds' },
                    { emoji: '🗺️', value: stats?.totalStates || 0, label: 'States' },
                    { emoji: '🌙', value: stats?.totalNights || 0, label: 'Nights' },
                    { emoji: '⭐', value: stats?.avgRating ?? '—', label: 'Avg Rating' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.12)' }}>
                      <span className="text-base">{s.emoji}</span>
                      <p className="text-lg font-bold mt-0.5" style={{ color: CN.cream }}>{s.value}</p>
                      <p className="text-[10px] font-medium" style={{ color: CN.muted }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Second row — camping identity */}
                <div className="flex flex-wrap gap-2 mb-5 text-xs">
                  {stats?.mostVisited && (
                    <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(232,168,56,0.1)', border: '1px solid rgba(232,168,56,0.15)', color: CN.cream }}>
                      🔁 Most Visited: {stats.mostVisited.name} ({stats.mostVisited.visitCount}x)
                    </span>
                  )}
                  {stats?.peakSeason && (
                    <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(232,168,56,0.1)', border: '1px solid rgba(232,168,56,0.15)', color: CN.cream }}>
                      {stats.peakSeason === 'Spring' ? '🌸' : stats.peakSeason === 'Summer' ? '☀️' : stats.peakSeason === 'Fall' ? '🍂' : '❄️'} Peak: {stats.peakSeason}
                    </span>
                  )}
                  {stats?.campingStyle && (
                    <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(232,168,56,0.1)', border: '1px solid rgba(232,168,56,0.15)', color: CN.cream }}>
                      🏕️ {stats.campingStyle}
                    </span>
                  )}
                </div>

                {/* Earned badges strip */}
                {earnedBadges.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {earnedBadges.map(b => (
                      <span key={b.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: 'rgba(232,168,56,0.15)', color: CN.gold, border: '1px solid rgba(232,168,56,0.25)' }}>
                        {b.emoji} {b.label}
                      </span>
                    ))}
                    {lockedBadges.slice(0, 3).map(b => (
                      <span key={b.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium opacity-40"
                        style={{ background: 'rgba(255,255,255,0.05)', color: CN.muted, border: '1px solid rgba(255,255,255,0.08)' }}>
                        {b.emoji} {b.label} {b.progress && <span className="text-[9px]">({b.progress})</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════════
                 SECTION 2 — CAMPING INSIGHTS
              ══════════════════════════════════════════════════════════════ */}
              {insights.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: CN.muted }}>
                    💡 {firstName}'s Camping Style
                  </h2>
                  <div className="flex gap-2 flex-wrap">
                    {insights.map((ins, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ color: CN.gold, border: `1px solid rgba(232,168,56,0.25)`, background: 'rgba(232,168,56,0.06)' }}>
                        {ins}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                 SECTION 3 — FILTER BAR
              ══════════════════════════════════════════════════════════════ */}
              <div className="sticky top-0 z-10 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6" style={{ background: CN.body }}>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                  {([
                    { key: 'all', label: 'All' },
                    { key: 'favorites', label: '♥ Favorites' },
                    { key: 'rated', label: '⭐ Rated' },
                    { key: 'revisited', label: '🔁 Revisited' },
                    { key: 'recent', label: '🕐 Recent' },
                  ] as const).map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap"
                      style={filter === f.key
                        ? { background: CN.gold, color: CN.bg }
                        : { background: 'rgba(255,255,255,0.06)', color: CN.muted, border: '1px solid rgba(255,255,255,0.08)' }
                      }>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: CN.muted }} />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={`Search ${firstName}'s campgrounds...`}
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2"
                    style={{ background: CN.card, color: CN.cream, border: `1px solid ${CN.border}`, '--tw-ring-color': CN.gold } as any}
                  />
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════
                 SECTION 4 — MEMORY CARDS GRID
              ══════════════════════════════════════════════════════════════ */}
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: CN.muted }}>No campgrounds match your filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {filtered.map(cg => (
                    <MemoryCard key={cg.campgroundId} cg={cg} isOwner={isOwner} firstName={firstName} profileUsername={username || ''} />
                  ))}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                 SECTION 5 — LOG A PAST STAY (owner only)
              ══════════════════════════════════════════════════════════════ */}
              {isOwner && (
                <div className="mt-8 text-center py-6 rounded-xl" style={{ background: CN.card, border: `1px dashed ${CN.border}` }}>
                  <p className="text-sm mb-2" style={{ color: CN.muted }}>Missing a campground?</p>
                  <Link to="/campgrounds" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition hover:brightness-110"
                    style={{ background: 'rgba(232,168,56,0.15)', color: CN.gold, border: '1px solid rgba(232,168,56,0.25)' }}>
                    + Log a past stay
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Memory Card Component ── */
function MemoryCard({ cg, isOwner, firstName, profileUsername }: { cg: CampgroundStay; isOwner: boolean; firstName: string; profileUsername: string }) {
  return (
    <div className="rounded-xl overflow-hidden transition hover:ring-1" style={{ background: CN.card, border: `1px solid ${CN.border}`, '--tw-ring-color': CN.gold } as any}>
      {/* Photo */}
      <Link to={`/campgrounds/${cg.campgroundId}`} className="block relative" style={{ height: 180 }}>
        {cg.imageUrl ? (
          <img src={cg.imageUrl} alt={cg.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${CN.bg}, ${CN.card})` }}>
            <span className="text-2xl font-bold opacity-30" style={{ fontFamily: "'Playfair Display', serif", color: CN.gold }}>{cg.name}</span>
          </div>
        )}
        {/* Visit count badge */}
        {cg.visitCount > 1 && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: 'rgba(15,28,53,0.85)', color: CN.gold }}>
            Visited {cg.visitCount}x
          </span>
        )}
        {/* Favorite heart */}
        {cg.isFavorite && (
          <span className="absolute top-2 right-2">
            <Heart className="w-4 h-4 fill-current" style={{ color: '#ef4444' }} />
          </span>
        )}
      </Link>

      {/* Content */}
      <div className="p-3.5">
        <Link to={`/campgrounds/${cg.campgroundId}`}>
          <h3 className="font-semibold text-[15px] leading-tight hover:underline" style={{ color: CN.cream }}>{cg.name}</h3>
        </Link>
        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: CN.muted }}>
          <MapPin className="w-3 h-3" />
          {[cg.city, cg.state].filter(Boolean).join(', ')}
          {cg.parkType && /national|state/i.test(cg.parkType) && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              {/national/i.test(cg.parkType) ? 'NP' : 'SP'}
            </span>
          )}
        </p>

        {/* Dates + nights */}
        <div className="flex items-center gap-3 mt-2.5 text-xs" style={{ color: CN.muted }}>
          {cg.lastVisit && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {fmtShort(cg.lastVisit)}{cg.lastVisitEnd ? ` – ${fmtShort(cg.lastVisitEnd)}` : ''}
              {cg.lastVisit && cg.lastVisitEnd && (
                <span>, {new Date(cg.lastVisit).getFullYear()}</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: CN.muted }}>
          {cg.totalNights > 0 && (
            <span className="flex items-center gap-1"><Moon className="w-3 h-3" /> {cg.totalNights} night{cg.totalNights !== 1 ? 's' : ''}</span>
          )}
          {cg.siteNumbers.length > 0 && (
            <span>🪧 Site {cg.siteNumbers[0]}</span>
          )}
        </div>

        {/* Rating */}
        {cg.userRating && (
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3, 4, 5].map(n => (
              <Star key={n} className={`w-3.5 h-3.5 ${n <= cg.userRating! ? 'fill-current' : ''}`}
                style={{ color: n <= cg.userRating! ? CN.gold : CN.border }} />
            ))}
          </div>
        )}

        {/* Review snippet */}
        {cg.userReview ? (
          <p className="text-xs mt-2 line-clamp-2 italic" style={{ color: 'rgba(245,240,232,0.6)' }}>
            "{cg.userReview}"
          </p>
        ) : isOwner ? (
          <Link to={`/campgrounds/${cg.campgroundId}`} className="text-xs mt-2 block transition hover:underline" style={{ color: 'rgba(232,168,56,0.6)' }}>
            Add your thoughts →
          </Link>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${CN.border}` }}>
          <Link to={`/campgrounds/${cg.campgroundId}`}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition hover:brightness-110"
            style={{ background: 'rgba(232,168,56,0.1)', color: CN.gold }}>
            View Campground →
          </Link>
          {!isOwner && (
            <Link to={`/messages?to=${profileUsername}&text=${encodeURIComponent(`Hey ${firstName}, I'm thinking about staying at ${cg.name} — what did you think of it?`)}`}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg flex items-center gap-1 transition hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.05)', color: CN.muted }}>
              <MessageCircle className="w-3 h-3" /> Ask {firstName}
            </Link>
          )}
          {isOwner && (
            <Link to={`/campgrounds/${cg.campgroundId}`}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg flex items-center gap-1 transition hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.05)', color: CN.muted }}>
              <Edit className="w-3 h-3" /> Edit Memory
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
