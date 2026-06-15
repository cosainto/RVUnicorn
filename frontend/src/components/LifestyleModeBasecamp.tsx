import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Wrench, Camera, MapPin } from 'lucide-react';
import RigPulseCard from './lifestyle/RigPulseCard';
import SocialFeed from './SocialFeed';
import CampgroundUpdatesFeed from './CampgroundUpdatesFeed';
import CommunityFeed from './CommunityFeed';
import api from '../services/api';

const CN = {
  bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45',
  gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8',
  muted: '#8B9BB4', border: '#243552', success: '#4CAF82',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props { user: any; }

export default function LifestyleModeBasecamp({ user }: Props) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [briefing, setBriefing] = useState<{ briefingText: string; actionSuggestions: any[] } | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [socialPulse, setSocialPulse] = useState<any[]>([]);
  const [dailyQuestion, setDailyQuestion] = useState<any>(null);
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [stateOfDay, setStateOfDay] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [nextTrip, setNextTrip] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [feedTab, setFeedTab] = useState<'friends' | 'community' | 'campgrounds' | 'feed'>('feed');
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);

  useEffect(() => { setMounted(true); }, []);

  // Parallel fetch all dashboard data
  useEffect(() => {
    if (!user?.id) return;

    // Dashboard summary (progress, streak)
    api.get('/basecamp/mc/dashboard').then(r => {
      setProgress(r.data.progress);
      if (r.data.briefing) setBriefing(r.data.briefing);
    }).catch(() => {});

    // Briefing (generate if not cached)
    api.post('/basecamp/mc/daily-briefing').then(r => {
      setBriefing(r.data);
    }).catch(() => {}).finally(() => setBriefingLoading(false));

    // Action items
    api.get('/basecamp/mc/action-items').then(r => setActionItems(r.data || [])).catch(() => {});

    // Social pulse
    api.get('/basecamp/mc/social-pulse').then(r => setSocialPulse(r.data || [])).catch(() => {});

    // Daily question
    api.get('/basecamp/mc/daily-question').then(r => setDailyQuestion(r.data)).catch(() => {});

    // State of day
    api.get('/basecamp/mc/state-of-day').then(r => setStateOfDay(r.data)).catch(() => {});

    // Streak
    api.post('/basecamp/mc/streak').catch(() => {});

    // Next trip
    api.get('/trips/upcoming').then(r => {
      const trips = Array.isArray(r.data) ? r.data : [];
      if (trips.length > 0) setNextTrip(trips[0]);
    }).catch(() => {});

    // Recommendations
    api.get('/campgrounds?limit=3&sort=rating').then(r => {
      setRecommendations((r.data?.campgrounds || r.data || []).slice(0, 3));
    }).catch(() => {});

    // Community
    api.get('/basecamp/community-posts?limit=10').then(r => setCommunityPosts(r.data?.posts || [])).catch(() => {});
  }, [user?.id]);

  const submitAnswer = async () => {
    if (!questionAnswer.trim() || !dailyQuestion) return;
    setSubmittingAnswer(true);
    try {
      await api.post('/basecamp/mc/daily-question/answer', { answer: questionAnswer });
      const r = await api.get('/basecamp/mc/daily-question');
      setDailyQuestion(r.data);
      setQuestionAnswer('');
    } catch {}
    setSubmittingAnswer(false);
  };

  const dayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ background: CN.bg, minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 pb-12 space-y-4 pt-6">

        {/* ═══ PHASE 1: HITCH DAILY BRIEFING ═══ */}
        <div className={`rounded-2xl p-5 transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: CN.card, border: `1px solid ${CN.border}`, borderLeft: `3px solid ${CN.orange}` }}>
          <div className="flex gap-3">
            <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_88,h_88,c_fill/v1775261116/rvunicorn/characters/hitch.png"
              alt="Hitch" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold mb-0.5" style={{ color: CN.cream }}>
                {getGreeting()}, {user?.firstName || 'friend'}! <span className="font-normal text-xs" style={{ color: CN.muted }}>{'\u00B7'} {dayStr}</span>
              </p>
              {briefingLoading && !briefing ? (
                <div className="space-y-2 mt-2">
                  <div className="h-3 rounded w-full" style={{ background: CN.border }} />
                  <div className="h-3 rounded w-3/4" style={{ background: CN.border }} />
                </div>
              ) : (
                <p className="text-[13px] leading-[1.7] mt-1" style={{ color: 'rgba(245,240,232,0.75)' }}>
                  {briefing?.briefingText || 'Welcome back to your RV command center. Check your action items below!'}
                </p>
              )}
              {briefing?.actionSuggestions && briefing.actionSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {briefing.actionSuggestions.map((a: any, i: number) => (
                    <button key={i} onClick={() => a.path && navigate(a.path)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition hover:brightness-110"
                      style={{ background: 'rgba(232,168,56,0.15)', color: CN.gold, border: `1px solid rgba(232,168,56,0.3)` }}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ PHASE 2: RIG COMMAND CARD ═══ */}
        <RigPulseCard user={user} cn={CN} />

        {/* Quick action buttons below rig card */}
        <div className="flex gap-2">
          {[
            { emoji: '\u{1F5FA}\uFE0F', label: 'Plan a Trip', path: '/events-v2/create' },
            { emoji: '\u{1F527}', label: 'Log Service', path: '/maintenance' },
            { emoji: '\u{1F4F8}', label: 'Add to Rig', path: '/my-rv' },
          ].map(btn => (
            <Link key={btn.path} to={btn.path}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition hover:brightness-110"
              style={{ background: CN.card, border: `1px solid ${CN.border}`, color: CN.gold }}>
              <span>{btn.emoji}</span> {btn.label}
            </Link>
          ))}
        </div>

        {/* ═══ PHASE 3: NEXT ADVENTURE ═══ */}
        <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
          {nextTrip ? (() => {
            const daysAway = Math.max(0, Math.ceil((new Date(nextTrip.startDate).getTime() - Date.now()) / 86400000));
            const countdownColor = daysAway > 14 ? CN.gold : daysAway > 7 ? '#f59e0b' : daysAway > 3 ? CN.orange : '#ef4444';
            return (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CN.muted }}>Next Adventure</p>
                    <h3 className="text-lg font-bold mt-1" style={{ color: CN.cream }}>{nextTrip.title || nextTrip.name}</h3>
                    {nextTrip.campground?.name && (
                      <Link to={`/campgrounds/${nextTrip.campground.id || nextTrip.campgroundId}`} className="text-xs hover:underline" style={{ color: CN.gold }}>
                        {nextTrip.campground.name}
                      </Link>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black" style={{ color: countdownColor, animation: daysAway <= 3 ? 'gold-pulse 2s ease-in-out infinite' : 'none' }}>{daysAway}</span>
                    <p className="text-[10px] font-bold uppercase" style={{ color: countdownColor }}>days away</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/trips/${nextTrip.id}`} className="flex-1 py-2 rounded-xl text-xs font-semibold text-center transition hover:brightness-110"
                    style={{ background: CN.gold, color: '#0F1C35' }}>
                    View Full Trip
                  </Link>
                  <Link to={`/trips/${nextTrip.id}`} className="px-4 py-2 rounded-xl text-xs font-semibold transition hover:brightness-110"
                    style={{ border: `1px solid ${CN.border}`, color: CN.cream }}>
                    Invite Someone
                  </Link>
                </div>
              </>
            );
          })() : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_64,h_64,c_fill/v1775261116/rvunicorn/characters/hitch.png"
                  alt="Hitch" className="w-8 h-8 rounded-full object-cover" />
                <p className="text-sm" style={{ color: CN.cream }}>Where to next? I have some ideas for your {user?.rvType?.replace('_', ' ') || 'rig'}...</p>
              </div>
              {recommendations.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                  {recommendations.map((cg: any) => (
                    <Link key={cg.id} to={`/campgrounds/${cg.id}`}
                      className="flex-shrink-0 w-44 rounded-xl overflow-hidden transition hover:brightness-110"
                      style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                      <div className="h-24 bg-gray-800">
                        {cg.imageUrl ? <img src={cg.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{'\u{1F3D5}\uFE0F'}</div>}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold truncate" style={{ color: CN.cream }}>{cg.name}</p>
                        <p className="text-[10px]" style={{ color: CN.muted }}>{cg.state}{cg.googleRating ? ` \u00B7 ${cg.googleRating}\u2B50` : ''}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link to="/events-v2/create"
                className="block w-full mt-3 py-2.5 rounded-xl text-sm font-bold text-center transition hover:brightness-110"
                style={{ background: CN.gold, color: '#0F1C35' }}>
                {'\u{1F5FA}\uFE0F'} Plan Your Next Adventure
              </Link>
            </>
          )}
        </div>

        {/* ═══ PHASE 4: ACTION CENTER ═══ */}
        {actionItems.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: CN.muted }}>{'\u26A1'} Your Action Items</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {actionItems.map((item: any, i: number) => (
                <button key={i} onClick={() => item.path ? navigate(item.path) : null}
                  className="rounded-xl p-3 text-left transition hover:brightness-110"
                  style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <span className="text-xl block mb-1">{item.emoji}</span>
                  <p className="text-xs font-medium line-clamp-2" style={{ color: CN.cream }}>{item.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PHASE 5: FRIENDS & RIGS LIVE STRIP ═══ */}
        {socialPulse.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: CN.muted }}>{'\u{1F465}'} Friends & Rigs Right Now</p>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {socialPulse.map((item: any, i: number) => (
                <Link key={i} to={item.type === 'CHECKED_IN' ? `/campgrounds/${item.campgroundId}` : item.navigateTo || `/profile/${item.username}`}
                  className="flex-shrink-0 w-40 rounded-xl p-3 transition hover:brightness-110"
                  style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    {item.avatarUrl ? (
                      <img src={item.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: item.type === 'CHECKED_IN' ? '2px solid #22c55e' : '2px solid transparent' }} />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: CN.gold }}>{item.firstName?.[0] || '?'}</div>
                    )}
                    <span className="text-xs font-semibold truncate" style={{ color: CN.cream }}>{item.firstName}</span>
                  </div>
                  <p className="text-[10px] line-clamp-2" style={{ color: CN.muted }}>
                    {item.type === 'CHECKED_IN' ? `Checked in at ${item.campgroundName}` : item.title || 'Posted recently'}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PHASE 7: TODAY'S CAMPFIRE QUESTION ═══ */}
        {dailyQuestion && (
          <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_64,h_64,c_fill/v1775261116/rvunicorn/characters/hitch.png"
                alt="Hitch" className="w-8 h-8 rounded-full" />
              <span className="text-xs font-semibold" style={{ color: CN.muted }}>Hitch wants to know...</span>
              {dailyQuestion.totalAnswers > 0 && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,168,56,0.15)', color: CN.gold }}>
                  {dailyQuestion.totalAnswers} answers
                </span>
              )}
            </div>
            <p className="text-sm font-bold mb-3" style={{ color: CN.cream }}>{dailyQuestion.question}</p>
            {!dailyQuestion.userAnswer ? (
              <div className="flex gap-2">
                <input value={questionAnswer} onChange={e => setQuestionAnswer(e.target.value)}
                  placeholder="Share your answer..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent"
                  style={{ border: `1px solid ${CN.border}`, color: CN.cream }}
                  onKeyDown={e => e.key === 'Enter' && submitAnswer()} />
                <button onClick={submitAnswer} disabled={submittingAnswer || !questionAnswer.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition hover:brightness-110 disabled:opacity-50"
                  style={{ background: CN.gold, color: '#0F1C35' }}>
                  {submittingAnswer ? '...' : 'Share'}
                </button>
              </div>
            ) : (
              <div>
                <div className="p-3 rounded-lg mb-2" style={{ background: CN.cardAlt }}>
                  <p className="text-xs" style={{ color: CN.cream }}>You: {dailyQuestion.userAnswer.text}</p>
                </div>
                {dailyQuestion.topAnswers?.filter((a: any) => a.userId !== user?.id).slice(0, 2).map((a: any, i: number) => (
                  <div key={i} className="p-2 rounded-lg mb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-[11px]" style={{ color: CN.muted }}>{a.firstName}: {a.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ PHASE 9: PROGRESS WIDGET ═══ */}
        {progress && (
          <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: CN.muted }}>{'\u{1F3C6}'} Your RVUnicorn Journey</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: `${progress.statesVisited}/48`, label: 'States', emoji: '\u{1F5FA}\uFE0F' },
                { value: String(progress.campgroundsVisited), label: 'Campgrounds', emoji: '\u{1F3D5}\uFE0F' },
                { value: `${progress.currentStreak} day${progress.currentStreak !== 1 ? 's' : ''}`, label: 'Streak', emoji: '\u{1F525}' },
                { value: String(progress.badgeCount), label: 'Badges', emoji: '\u{1F3C5}' },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: CN.cardAlt }}>
                  <span className="text-lg block">{stat.emoji}</span>
                  <p className="text-sm font-bold mt-1" style={{ color: CN.gold }}>{stat.value}</p>
                  <p className="text-[10px]" style={{ color: CN.muted }}>{stat.label}</p>
                </div>
              ))}
            </div>
            {progress.statesVisited < 48 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: CN.muted }}>State progress</span>
                  <span className="text-[10px] font-bold" style={{ color: CN.gold }}>{Math.round((progress.statesVisited / 48) * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ background: CN.border }}>
                  <div className="h-2 rounded-full" style={{ width: `${(progress.statesVisited / 48) * 100}%`, background: CN.gold }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ PHASE 10: STATE OF THE DAY ═══ */}
        {stateOfDay && (
          <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <div className="h-32 relative" style={{ background: 'linear-gradient(135deg, #1a4a3a, #0F1C35)' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CN.gold }}>{'\u{1F5FA}\uFE0F'} Today's Featured State</p>
                  <h3 className="text-2xl font-black mt-1" style={{ color: CN.cream }}>{stateOfDay.stateName}</h3>
                </div>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs mb-3" style={{ color: CN.muted }}>
                {stateOfDay.campgroundCount} campgrounds
              </p>
              {stateOfDay.topCampgrounds?.length > 0 && (
                <div className="space-y-2 mb-3">
                  {stateOfDay.topCampgrounds.map((cg: any) => (
                    <Link key={cg.id} to={`/campgrounds/${cg.id}`} className="flex items-center gap-2 p-2 rounded-lg transition hover:brightness-110" style={{ background: CN.cardAlt }}>
                      {cg.imageUrl && <img src={cg.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: CN.cream }}>{cg.name}</p>
                        {cg.googleRating && <p className="text-[10px]" style={{ color: CN.gold }}>{cg.googleRating} {'\u2B50'}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link to={`/campgrounds?state=${stateOfDay.state}`}
                className="block w-full py-2 rounded-xl text-xs font-semibold text-center transition hover:brightness-110"
                style={{ border: `1px solid ${CN.border}`, color: CN.gold }}>
                Explore {stateOfDay.stateName} campgrounds {'\u2192'}
              </Link>
            </div>
          </div>
        )}

        {/* ═══ PHASE 11: COMMUNITY FEED ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CN.muted }}>{'\u{1F4F0}'} From Your Network</p>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <div className="flex" style={{ borderBottom: `1px solid ${CN.border}` }}>
              {(['feed', 'friends', 'community', 'campgrounds'] as const).map(tab => (
                <button key={tab} onClick={() => setFeedTab(tab)}
                  className="flex-1 px-4 py-3 text-xs font-semibold transition"
                  style={{
                    color: feedTab === tab ? CN.gold : CN.muted,
                    borderBottom: feedTab === tab ? `2px solid ${CN.gold}` : '2px solid transparent',
                    background: feedTab === tab ? 'rgba(232,168,56,0.05)' : 'transparent',
                  }}>
                  {tab === 'feed' ? '\u2B50 For You' : tab === 'friends' ? '\u{1F465} Friends' : tab === 'community' ? '\u{1F3D5}\uFE0F Boards' : '\u{1F4CD} Campgrounds'}
                </button>
              ))}
            </div>
            <div className="p-4">
              {feedTab === 'feed' && <CommunityFeed />}
              {feedTab === 'friends' && <SocialFeed username={user?.username || ''} isOwnProfile={true} includePacking={true} />}
              {feedTab === 'community' && (
                communityPosts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: CN.muted }}>No community posts yet</p>
                    <Link to="/community" className="text-sm font-semibold" style={{ color: CN.gold }}>Start a discussion {'\u2192'}</Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {communityPosts.map((post: any) => (
                      <Link key={post.id} to="/community" className="flex gap-3 p-3 rounded-xl transition" style={{ background: CN.cardAlt }}>
                        <div className="flex-shrink-0 w-8 text-center pt-0.5">
                          <span className="text-sm font-bold" style={{ color: CN.gold }}>{post.voteScore}</span>
                          <div className="text-[10px]" style={{ color: CN.muted }}>pts</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold line-clamp-2" style={{ color: CN.cream }}>{post.title}</p>
                          <span className="text-[10px]" style={{ color: CN.muted }}>{post.author?.firstName}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              )}
              {feedTab === 'campgrounds' && <CampgroundUpdatesFeed />}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
