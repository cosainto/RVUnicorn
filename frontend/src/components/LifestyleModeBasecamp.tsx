import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ChevronRight, Sparkles } from 'lucide-react';
import api from '../services/api';
import RigPulseCardV2 from './basecamp/RigPulseCardV2';
import RVCircleCard from './basecamp/RVCircleCard';
import DiscoverCardV2 from './basecamp/DiscoverCardV2';
import DreamingSection from './basecamp/DreamingSection';
import CampKitchenSection from './basecamp/CampKitchenSection';
import BasecampFeed from './basecamp/BasecampFeed';
import TravelMap from './TravelMap';
import TripIntelligenceHeader from './basecamp/TripIntelligenceHeader';

const CN = {
  bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45',
  gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8',
  muted: '#8B9BB4', border: '#243552',
};

// ── Composition threshold: ≥3 real social items → social-rich mode ──
const SOCIAL_RICH_THRESHOLD = 3;

interface Props { user: any; }

export default function LifestyleModeBasecamp({ user }: Props) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [socialPulse, setSocialPulse] = useState<any[]>([]);
  const [hotStrip, setHotStrip] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    api.get('/basecamp/v2/dashboard').then(r => setData(r.data)).catch(() => setError(true));
    api.get('/basecamp/mc/social-pulse').then(r => setSocialPulse(r.data || [])).catch(() => {});
    api.get('/community/feed/hot-strip').then(r => setHotStrip(r.data || [])).catch(() => {});
  }, [user?.id]);

  // ── Composition rule: count real social content ──
  const liveCount = socialPulse.filter((i: any) => i.type === 'CHECKED_IN').length;
  const recentPostCount = socialPulse.filter((i: any) => i.type === 'RECENT_POST').length;
  const rvCircleCount = data?.rvCircle?.items?.length || 0;
  const socialItemCount = liveCount + recentPostCount + rvCircleCount;
  const isSocialRich = socialItemCount >= SOCIAL_RICH_THRESHOLD;

  // ── Hitch host cards: grounded pointers to real activity ──
  const hostCards: { text: string; link: string; type: string }[] = [];
  // Friends checked in → "X is camping at Y"
  for (const item of socialPulse.filter((i: any) => i.type === 'CHECKED_IN').slice(0, 2)) {
    hostCards.push({
      text: `${item.firstName} just checked into ${item.campgroundName}`,
      link: `/profile/${item.username}`,
      type: 'checkin',
    });
  }
  // Rig activity → "X's rig posted Y"
  for (const item of (data?.rvCircle?.items || []).slice(0, 1)) {
    if (item.navigateTo) {
      hostCards.push({
        text: `${item.actorRigName}: ${item.description}`,
        link: item.navigateTo,
        type: 'rig',
      });
    }
  }
  // Trending community → "Campers are discussing X"
  if (hotStrip.length > 0) {
    const top = hotStrip[0];
    hostCards.push({
      text: `Trending: "${(top.content || top.preview || '').slice(0, 60)}..."`,
      link: `/community`,
      type: 'community',
    });
  }

  return (
    <div style={{ background: CN.bg, minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 pt-6">

        <div className="space-y-4">

          {/* ═══ TIER 1 — CAMPING NOW AVATAR STRIP (hide when empty) ═══ */}
          {socialPulse.filter((i: any) => i.type === 'CHECKED_IN').length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: CN.muted }}>LIVE</span>
              <div className="overflow-x-auto scrollbar-hide flex-1" style={{ WebkitOverflowScrolling: 'touch' as any }}>
                <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
                  {socialPulse.filter((i: any) => i.type === 'CHECKED_IN').map((item: any, idx: number) => (
                    <Link key={idx} to={`/profile/${item.username}`} className="relative group flex-shrink-0" title={`${item.firstName} at ${item.campgroundName}`}>
                      {item.avatarUrl ? (
                        <img src={item.avatarUrl} className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500/60" alt="" />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 border-emerald-500/60" style={{ background: CN.border, color: CN.gold }}>{item.firstName?.[0] || '?'}</div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-[1.5px]" style={{ borderColor: CN.bg }} />
                      {/* Name tooltip on hover */}
                      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-20">
                        <div className="px-2 py-0.5 rounded text-[9px] font-medium whitespace-nowrap" style={{ background: CN.cardAlt, color: CN.cream, border: `1px solid ${CN.border}` }}>
                          {item.firstName}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TIER 2 — SOCIAL MAP + TRIP INTELLIGENCE ═══ */}
          {user?.id && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2">
                <div className="rounded-xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <TravelMap
                    userId={user.id}
                    isOwnProfile={true}
                    compact={false}
                    socialMode={true}
                    defaultLayers={['visits', 'friendsCheckins', 'recentAlbums', 'upcomingFriendTrips']}
                  />
                </div>
              </div>
              <div className="lg:col-span-1">
                <TripIntelligenceHeader compactMode={true} />
              </div>
            </div>
          )}

          {/* ═══ TIER 3 — RECENT REAL ACTIVITY ═══ */}
          {/* Rig Pulse (active trip or idle rig status — rich, personal) */}
          <RigPulseCardV2 data={data?.rigPulse || null} />

          {/* RV Circle (followed rig activity — social, rich cards) */}
          <RVCircleCard data={data?.rvCircle || null} />

          {/* ═══ TIER 4 — HITCH HOST CARDS (grounded, capped) ═══ */}
          {hostCards.length > 0 && (
            <div className="space-y-2">
              {hostCards.slice(0, isSocialRich ? 2 : 3).map((card, i) => (
                <Link key={i} to={card.link} className="flex items-center gap-3 px-4 py-3 rounded-xl transition hover:brightness-110" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                  <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_32,h_32,c_fill/v1775261116/rvunicorn/characters/hitch.png" className="w-8 h-8 rounded-full flex-shrink-0" alt="Hitch" />
                  <p className="text-xs flex-1 min-w-0" style={{ color: CN.cream }}>{card.text}</p>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: CN.muted }} />
                </Link>
              ))}
            </div>
          )}

          {/* ═══ TIER 5 — COMMUNITY HIGHLIGHTS (compact) ═══ */}
          {hotStrip.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: CN.cream }}>
                  <MessageCircle className="w-3.5 h-3.5" style={{ color: CN.gold }} /> Trending in Community
                </h4>
                <button onClick={() => setActiveTab('community')} className="text-[10px] font-medium" style={{ color: CN.gold }}>See all</button>
              </div>
              <div className="space-y-1.5">
                {hotStrip.slice(0, isSocialRich ? 2 : 3).map((post: any, i: number) => (
                  <Link key={post.id || i} to="/community" className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition hover:brightness-110" style={{ background: CN.cardAlt }}>
                    <p className="text-[11px] flex-1 truncate" style={{ color: CN.muted }}>{(post.content || post.preview || '').slice(0, 70)}</p>
                    <span className="flex items-center gap-0.5 text-[10px] flex-shrink-0" style={{ color: CN.muted }}>
                      <MessageCircle className="w-3 h-3" /> {post.commentCount || 0}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TIER 6 — DISCOVER / DREAMING / KITCHEN (secondary) ═══ */}
          <DiscoverCardV2 data={data?.discover || null} />
          <DreamingSection data={data?.dreaming || null} />
          <CampKitchenSection data={data?.campKitchen || null} />

          {/* ═══ NETWORK FEED (from your community) ═══ */}
          <BasecampFeed />

          {/* ═══ TIER 7 — AMBIENT / SYSTEM (capped when social-rich) ═══ */}
          {/* When social is thin, allow more system ambiance */}
          {!isSocialRich && (
            <div className="space-y-3">
              {/* Recent posts from friends (T7 expansion for cold start) */}
              {socialPulse.filter((i: any) => i.type === 'RECENT_POST').length > 0 && (
                <div className="rounded-xl p-3" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: CN.cream }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: CN.gold }} /> Recent from Friends
                  </h4>
                  {socialPulse.filter((i: any) => i.type === 'RECENT_POST').slice(0, 3).map((item: any, idx: number) => (
                    <Link key={idx} to={item.navigateTo || `/profile/${item.username}`} className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition hover:brightness-110 mb-1" style={{ background: CN.cardAlt }}>
                      {item.avatarUrl ? (
                        <img src={item.avatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: CN.border, color: CN.gold }}>{item.firstName?.[0]}</div>
                      )}
                      <p className="text-[11px] truncate" style={{ color: CN.muted }}>{item.firstName} {item.title ? `— ${item.title}` : 'posted something new'}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ COLD START — Warm invitation when social is thin ═══ */}
          {!isSocialRich && socialPulse.length === 0 && (
            <div className="rounded-xl p-5 text-center" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              <div className="text-3xl mb-2">🔥</div>
              <p className="text-sm font-semibold mb-1" style={{ color: CN.cream }}>Your campfire is warming up</p>
              <p className="text-xs mb-4" style={{ color: CN.muted }}>Follow some campers, check in at your next stop, or share a photo to bring your community to life.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/community" className="px-4 py-2 rounded-lg text-xs font-semibold transition" style={{ background: CN.gold, color: CN.bg }}>
                  Find Campers
                </Link>
                <Link to="/campgrounds" className="px-4 py-2 rounded-lg text-xs font-semibold transition" style={{ background: CN.cardAlt, color: CN.cream, border: `1px solid ${CN.border}` }}>
                  Explore Campgrounds
                </Link>
              </div>
            </div>
          )}

          {error && !data && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: CN.muted }}>Something went wrong loading your dashboard.</p>
              <button onClick={() => { setError(false); api.get('/basecamp/v2/dashboard').then(r => setData(r.data)).catch(() => setError(true)); }}
                className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: CN.gold, color: CN.bg }}>
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
